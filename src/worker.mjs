import { convertAnyAsync, detectSourceKind, internals, normalizeIconBase64, parseModule, parseRuleSet, validateAnywhereOutput } from "./core.mjs";
import { buildArrs } from "./ruleset-core.mjs";
import { RuleSetWorkspace } from "./ruleset-workspace.mjs";
import { renderAppIcon, renderHome, renderManifest, renderServiceWorker } from "./ui.mjs";

export { RuleSetWorkspace };

const memoryStore = new Map();
const memoryRateStore = new Map();
const memoryFetchCache = new Map();
const memoryDynamicCache = new Map();
const memoryIconCache = new Map();
const memoryRuleSetWorkspaces = new Map();
const memoryPublishedRuleSets = new Map();
const memoryPublicRuleSetCache = new Map();

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return optionsResponse();
      if (request.method === "GET" && (url.pathname === "/" || /^\/editor\/[A-Za-z0-9_-]+$/.test(url.pathname))) return htmlResponse(renderHome());
      if (request.method === "GET" && url.pathname === "/manifest.webmanifest") return manifestResponse(renderManifest());
      if (request.method === "GET" && url.pathname === "/sw.js") return serviceWorkerResponse(renderServiceWorker());
      if (request.method === "GET" && /^\/icons\/icon-(?:192|512)\.svg$/.test(url.pathname)) return iconResponse(renderAppIcon(url.pathname.includes("512") ? 512 : 192));
      if (request.method === "GET" && url.pathname === "/health") return jsonResponse({
        ok: true,
        version: "0.1.0",
        capabilities: ["url-input", "text-input", "custom-icon", "icon-url", "argument-form", "script-fetch", "script-recovery", "native-js-lift", "aggressive-js-lift", "ruleset-conversion", "dynamic-subscription", "cache-bust-refresh", "browser-download", "fallback-snapshot", "pwa", "ruleset-studio", "published-arrs", "workspace-key"],
      });
      if (request.method === "POST" && url.pathname === "/api/workspaces") {
        const limited = await rateLimit(request, env, "workspace-create");
        if (limited) return limited;
        return await handleWorkspaceCreate(request, env);
      }
      if (url.pathname.startsWith("/api/workspaces/")) {
        const limited = await rateLimit(request, env, "workspace-edit");
        if (limited) return limited;
        return await handleWorkspaceApi(request, env, url);
      }
      if (request.method === "GET" && /^\/s\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/rules\.arrs$/.test(url.pathname)) {
        const limited = await rateLimit(request, env, "ruleset-subscribe");
        if (limited) return limited;
        return await handlePublishedRuleSet(request, env, url);
      }
      if (request.method === "POST" && url.pathname === "/api/inspect") {
        const limited = await rateLimit(request, env, "inspect");
        if (limited) return limited;
        return await handleInspect(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/convert") {
        const limited = await rateLimit(request, env, "convert");
        if (limited) return limited;
        return await handleConvert(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/icon") {
        const limited = await rateLimit(request, env, "icon");
        if (limited) return limited;
        return await handleIconPreview(request, env);
      }
      if (request.method === "GET" && url.pathname === "/sub/deeplink") {
        const limited = await rateLimit(request, env, "subscribe");
        if (limited) return limited;
        return await handleDynamicDeeplink(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/sub/")) {
        const limited = await rateLimit(request, env, "subscribe");
        if (limited) return limited;
        return await handleDynamicRuleFetch(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/r/")) return await handleRuleFetch(url, env);
      return jsonResponse({ error: "not_found" }, 404);
    } catch (error) {
      const isSyntaxError = error instanceof SyntaxError;
      const status = isSyntaxError ? 400 : 500;
      return jsonResponse({
        error: isSyntaxError ? "invalid_json" : "internal_error",
        detail: error?.message || "Worker failed while handling the request.",
      }, status);
    }
  },
};

async function handleWorkspaceCreate(request, env) {
  const workspaceId = randomId(12);
  const key = randomId(32);
  const result = await callWorkspace(env, workspaceId, "init", { workspaceId, keyHash: await secretHash(key) });
  if (result.error) return jsonResponse(result, result.status || 400);
  const base = requestBaseUrl(request);
  return jsonResponse({
    workspace: result.workspace,
    workspaceId,
    editUrl: `${base}/editor/${workspaceId}#key=${key}`,
    warning: "请保存管理链接。该链接是匿名工作区的唯一管理凭证，服务端无法找回。",
  }, 201);
}

async function handleWorkspaceApi(request, env, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const workspaceId = parts[2] || "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(workspaceId)) return jsonResponse({ error: "bad_workspace_id" }, 400);
  const key = workspaceKeyFromRequest(request);
  if (!key) return jsonResponse({ error: "workspace_unauthorized", detail: "缺少工作区管理凭证。" }, 401);
  const keyHash = await secretHash(key);
  if (parts.length === 3 && request.method === "GET") {
    return workspaceApiResponse(await callWorkspace(env, workspaceId, "list", { keyHash }), undefined, request);
  }
  if (parts.length === 4 && parts[3] === "rulesets" && request.method === "POST") {
    const input = await readInput(request);
    const document = ruleSetDocumentFromInput(input, randomId(10));
    if (document.error) return jsonResponse(document, 422);
    const result = await callWorkspace(env, workspaceId, "create", { keyHash, document: document.value });
    if (!result.error && result.ruleSet) await putPublishedRuleSet(env, workspaceId, result.ruleSet);
    return workspaceApiResponse(result, result.error ? undefined : 201, request);
  }
  const ruleSetId = parts[4] || "";
  if (parts.length === 5 && parts[3] === "rulesets" && /^[A-Za-z0-9_-]{8,80}$/.test(ruleSetId)) {
    if (request.method === "GET") return workspaceApiResponse(await callWorkspace(env, workspaceId, "read", { keyHash, ruleSetId }), undefined, request);
    if (request.method === "PUT") {
      const input = await readInput(request);
      const document = ruleSetDocumentFromInput({ ...input, id: ruleSetId }, ruleSetId);
      if (document.error) return jsonResponse(document, 422);
      const ifMatch = request.headers.get("if-match") || input.revision;
      const result = await callWorkspace(env, workspaceId, "save", { keyHash, document: document.value, ifMatch: Number(ifMatch) });
      if (!result.error && result.ruleSet) await putPublishedRuleSet(env, workspaceId, result.ruleSet);
      return workspaceApiResponse(result, undefined, request);
    }
    if (request.method === "DELETE") {
      const result = await callWorkspace(env, workspaceId, "remove", { keyHash, ruleSetId });
      if (!result.error) await deletePublishedRuleSet(env, workspaceId, ruleSetId);
      return workspaceApiResponse(result);
    }
  }
  return jsonResponse({ error: "workspace_route_not_found" }, 404);
}

function workspaceApiResponse(result, successStatus = undefined, request = undefined) {
  if (result?.error) {
    const status = result.error === "workspace_unauthorized" ? 401
      : result.error === "ruleset_not_found" || result.error === "workspace_not_found" ? 404
        : result.error === "ruleset_conflict" ? 409 : 400;
    return jsonResponse(result, status);
  }
  if (request && result?.ruleSet) {
    const workspaceId = new URL(request.url).pathname.split("/").filter(Boolean)[2];
    result.ruleSet.subscriptionUrl = `${requestBaseUrl(request)}/s/${workspaceId}/${result.ruleSet.id}/rules.arrs`;
  }
  return jsonResponse(result, successStatus || 200);
}

async function handlePublishedRuleSet(request, env, url) {
  const [, , workspaceId, ruleSetId] = url.pathname.split("/");
  const cached = await getCachedPublishedRuleSet(request, env);
  if (cached) return cached;
  let ruleSet = await getPublishedRuleSet(env, workspaceId, ruleSetId);
  if (!ruleSet) {
    const result = await callWorkspace(env, workspaceId, "public", { ruleSetId });
    if (result.error || !result.ruleSet) return textResponse("Rule set not found", 404);
    ruleSet = result.ruleSet;
    await putPublishedRuleSet(env, workspaceId, ruleSet);
  }
  const etag = `"${workspaceId}-${ruleSetId}-${ruleSet.revision}"`;
  const headers = {
    "content-type": "text/plain; charset=utf-8",
    "content-disposition": `inline; filename="${safeRuleSetFilename(ruleSet.name)}.arrs"`,
    "cache-control": `public, max-age=${ruleSetCacheTtl(env)}, stale-while-revalidate=86400`,
    etag,
    "x-converter-source": "rule-studio",
    "x-ruleset-revision": String(ruleSet.revision),
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const response = new Response(ruleSet.content, { headers });
  await putCachedPublishedRuleSet(request, response.clone(), env);
  return response;
}

function ruleSetDocumentFromInput(input, id) {
  const result = buildArrs({
    source: String(input?.source || ""),
    name: input?.name,
    routing: input?.routing,
  });
  if (!result.valid) return { error: "ruleset_invalid", detail: result.diagnostics.map((item) => item.message).join(" "), diagnostics: result.diagnostics };
  return { value: { id, name: result.name, routing: result.routing, content: result.content, ruleCount: result.ruleCount, bytes: result.bytes } };
}

async function callWorkspace(env, workspaceId, action, payload = {}) {
  if (env.RULESET_WORKSPACE) {
    const stub = env.RULESET_WORKSPACE.get(env.RULESET_WORKSPACE.idFromName(workspaceId));
    const response = await stub.fetch("https://ruleset.internal/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    return response.json();
  }
  return memoryWorkspaceCall(workspaceId, action, payload);
}

function memoryWorkspaceCall(workspaceId, action, payload) {
  let state = memoryRuleSetWorkspaces.get(workspaceId);
  if (action === "init") {
    if (!state) {
      state = { id: workspaceId, keyHash: payload.keyHash, createdAt: Date.now(), updatedAt: Date.now(), rulesets: [] };
      memoryRuleSetWorkspaces.set(workspaceId, state);
      return { workspace: memoryWorkspaceSummary(state), created: true };
    }
    return { workspace: memoryWorkspaceSummary(state), created: false };
  }
  if (!state) return { error: "workspace_not_found" };
  if (action === "public") return memoryPublicRuleSet(state, payload.ruleSetId);
  if (!payload.keyHash || payload.keyHash !== state.keyHash) return { error: "workspace_unauthorized" };
  if (action === "list") return { workspace: memoryWorkspaceSummary(state) };
  const index = state.rulesets.findIndex((item) => item.id === payload.ruleSetId || item.id === payload.document?.id);
  if (action === "read") return index < 0 ? { error: "ruleset_not_found" } : { ruleSet: { ...state.rulesets[index] } };
  if (action === "create") {
    if (state.rulesets.length >= 20) return { error: "workspace_ruleset_limit", detail: "每个工作区最多 20 份规则集。" };
    if (memoryWorkspaceBytes(state) + payload.document.bytes > 32 * 1024 * 1024) return { error: "workspace_storage_limit", detail: "工作区总容量超过 32 MiB。" };
    const item = { ...payload.document, revision: 1, createdAt: Date.now(), updatedAt: Date.now() };
    state.rulesets.push(item);
    state.updatedAt = Date.now();
    return { ruleSet: { ...item }, workspace: memoryWorkspaceSummary(state) };
  }
  if (action === "save") {
    if (index < 0) return { error: "ruleset_not_found" };
    const current = state.rulesets[index];
    if (Number(payload.ifMatch) !== current.revision) return { error: "ruleset_conflict", ruleSet: { ...current } };
    if (memoryWorkspaceBytes(state) - current.bytes + payload.document.bytes > 32 * 1024 * 1024) return { error: "workspace_storage_limit", detail: "工作区总容量超过 32 MiB。" };
    const item = { ...payload.document, revision: current.revision + 1, createdAt: current.createdAt, updatedAt: Date.now() };
    state.rulesets[index] = item;
    state.updatedAt = Date.now();
    return { ruleSet: { ...item }, workspace: memoryWorkspaceSummary(state) };
  }
  if (action === "remove") {
    if (index < 0) return { error: "ruleset_not_found" };
    state.rulesets.splice(index, 1);
    state.updatedAt = Date.now();
    return { workspace: memoryWorkspaceSummary(state) };
  }
  return { error: "workspace_bad_action" };
}

function memoryWorkspaceSummary(state) {
  return { id: state.id, createdAt: state.createdAt, updatedAt: state.updatedAt, ruleSets: state.rulesets.map(({ content, ...item }) => ({ ...item })) };
}

function memoryWorkspaceBytes(state) {
  return state.rulesets.reduce((sum, item) => sum + Number(item.bytes || 0), 0);
}

function memoryPublicRuleSet(state, ruleSetId) {
  const ruleSet = state.rulesets.find((item) => item.id === ruleSetId);
  return ruleSet ? { ruleSet: { id: ruleSet.id, name: ruleSet.name, revision: ruleSet.revision, updatedAt: ruleSet.updatedAt, content: ruleSet.content } } : { error: "ruleset_not_found" };
}

async function putPublishedRuleSet(env, workspaceId, ruleSet) {
  const key = publishedRuleSetKey(workspaceId, ruleSet.id);
  const value = JSON.stringify({ id: ruleSet.id, name: ruleSet.name, revision: ruleSet.revision, updatedAt: ruleSet.updatedAt, content: ruleSet.content });
  memoryPublishedRuleSets.set(key, value);
  if (env.CONVERTER_KV) await env.CONVERTER_KV.put(key, value);
}

async function getPublishedRuleSet(env, workspaceId, ruleSetId) {
  const key = publishedRuleSetKey(workspaceId, ruleSetId);
  const memory = memoryPublishedRuleSets.get(key);
  if (memory) return JSON.parse(memory);
  if (!env.CONVERTER_KV) return null;
  const value = await env.CONVERTER_KV.get(key);
  return value ? JSON.parse(value) : null;
}

async function deletePublishedRuleSet(env, workspaceId, ruleSetId) {
  const key = publishedRuleSetKey(workspaceId, ruleSetId);
  memoryPublishedRuleSets.delete(key);
  if (env.CONVERTER_KV) await env.CONVERTER_KV.delete(key);
}

function publishedRuleSetKey(workspaceId, ruleSetId) {
  return `published-ruleset:${workspaceId}:${ruleSetId}`;
}

async function getCachedPublishedRuleSet(request, env) {
  const ttl = ruleSetCacheTtl(env);
  const cached = memoryPublicRuleSetCache.get(request.url);
  if (cached && cached.expiresAt > Date.now()) return new Response(cached.body, { status: cached.status, headers: cached.headers });
  if (ttl <= 0 || typeof caches === "undefined" || !caches.default) return null;
  return caches.default.match(request);
}

async function putCachedPublishedRuleSet(request, response, env) {
  const ttl = ruleSetCacheTtl(env);
  if (ttl <= 0 || response.status !== 200) return;
  const body = await response.clone().text();
  memoryPublicRuleSetCache.set(request.url, { body, status: response.status, headers: Object.fromEntries(response.headers.entries()), expiresAt: Date.now() + ttl * 1000 });
  if (typeof caches !== "undefined" && caches.default) await caches.default.put(request, response);
}

function ruleSetCacheTtl(env) {
  const configured = Number(env.RULESET_CACHE_TTL_SECONDS || 300);
  return Number.isFinite(configured) && configured >= 30 ? configured : 300;
}

function workspaceKeyFromRequest(request) {
  const header = String(request.headers.get("authorization") || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function randomId(bytes) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function secretHash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function requestBaseUrl(request) {
  const url = new URL(request.url);
  return url.origin;
}

function safeRuleSetFilename(value) {
  return String(value || "rule-set").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 96) || "rule-set";
}

async function handleInspect(request, env) {
  const input = await readInput(request);
  if (!input.source?.trim() && input.url) {
    const fetched = await fetchSourceURL(input.url, env);
    if (fetched.error) return jsonResponse({ error: fetched.error, detail: fetched.detail }, fetched.status || 400);
    input.source = fetched.source;
    input.sourceUrl = fetched.url;
  }
  if (!input.source?.trim()) return jsonResponse({ error: "missing_source" }, 400);
  if (new TextEncoder().encode(input.source).length > maxInputBytes(env)) {
    return jsonResponse({ error: "input_too_large" }, 413);
  }

  const sourceKind = normalizeInputSourceKind(input.sourceKind, input.source);
  const parsed = sourceKind === "ruleset" ? parseRuleSet(input.source) : parseModule(input.source);
  const argumentOverrides = isPlainObject(input.arguments) ? input.arguments : {};
  return jsonResponse({
    sourceKind,
    metadata: parsed.metadata,
    argumentDefinitions: parsed.arguments || {},
    arguments: internals.resolveArgumentValues(parsed.arguments || {}, argumentOverrides),
    sourceUrl: input.sourceUrl || "",
    source: input.includeSource === true ? input.source : undefined,
    diagnostics: parsed.diagnostics,
  });
}

async function handleIconPreview(request, env) {
  const input = await readInput(request);
  const result = await fetchIconURL(input.iconUrl, env);
  if (result.error) return jsonResponse({ error: result.error, detail: result.detail }, result.status || 400);
  return jsonResponse({
    iconUrl: result.url,
    base64: result.base64,
    mimeType: result.mimeType,
    bytes: result.bytes,
  });
}

async function handleConvert(request, env) {
  const input = await readInput(request);
  if (!input.source?.trim() && input.url) {
    const fetched = await fetchSourceURL(input.url, env);
    if (fetched.error) return jsonResponse({ error: fetched.error, detail: fetched.detail }, fetched.status || 400);
    input.source = fetched.source;
    input.sourceUrl = fetched.url;
  }
  if (!input.source?.trim()) return jsonResponse({ error: "missing_source" }, 400);
  if (new TextEncoder().encode(input.source).length > maxInputBytes(env)) {
    return jsonResponse({ error: "input_too_large" }, 413);
  }

  const icon = await resolveIconInput(input, env);
  if (icon.error) return jsonResponse({ error: icon.error, detail: icon.detail }, icon.status || 400);
  const scriptTextByURL = normalizeScriptTextByURL(input.scriptTextByURL, env);
  const result = await convertAnyAsync(input.source, {
    name: input.name,
    mode: input.mode,
    sourceKind: input.sourceKind,
    ruleSetRouting: input.ruleSetRouting,
    arguments: isPlainObject(input.arguments) ? input.arguments : {},
    preserveParameters: truthyInput(input.preserveParameters),
    iconLightBase64: icon.base64,
    scriptTextByURL,
    fetchScripts: input.fetchScripts == null ? true : input.fetchScripts === true || input.fetchScripts === "true" || input.fetchScripts === "1",
    maxScriptBytes: maxScriptBytes(env),
    maxTotalScriptBytes: maxTotalScriptBytes(env),
    maxScriptFetches: maxScriptFetches(env),
    maxMapLocalBytes: maxMapLocalBytes(env),
    maxTotalMapLocalBytes: maxTotalMapLocalBytes(env),
    maxMapLocalFetches: maxMapLocalFetches(env),
    fetchText: async (url, options = {}) => {
      const fetched = await fetchSourceURL(url, env, options.maxBytes || maxScriptBytes(env), { cache: "memory" });
      if (fetched.error) throw new Error(fetched.detail || fetched.error);
      return fetched.source;
    },
  });
  const base = new URL(request.url);
  base.pathname = "/";
  base.search = "";
  const baseUrl = base.toString().replace(/\/$/, "");
  const dynamic = dynamicLinksForResult(request, result, input, scriptTextByURL);
  const dynamicByName = new Map((dynamic.files || []).map((file) => [file.name, file]));
  let snapshotHash = "";
  const snapshotFiles = [];

  const ensureSnapshotHash = async () => {
    if (!snapshotHash) {
      snapshotHash = await sha256(input.source + "\n" + (input.name || "") + "\n" + (input.sourceUrl || "") + "\n" + scriptOverrideHash(scriptTextByURL) + "\n" + (icon.base64 || "") + "\n" + (icon.url || ""));
    }
    return snapshotHash;
  };

  const files = [];
  for (const file of result.files) {
    const validation = validateAnywhereOutput(file);
    const dynamicFile = dynamicByName.get(file.name);
    let fileUrl = dynamicFile?.url || "";
    if (!fileUrl) {
      const hash = await ensureSnapshotHash();
      const storedName = encodeURIComponent(file.name);
      const key = `${hash}/${file.name}`;
      await putFile(env, key, file.content);
      fileUrl = `${baseUrl}/r/${hash}/${storedName}`;
      snapshotFiles.push({ name: file.name, url: fileUrl });
    }
    files.push({
      name: file.name,
      type: file.type,
      ruleCount: file.ruleCount,
      url: fileUrl,
      validation,
      content: input.includeContent === false ? undefined : file.content,
    });
  }

  const snapshotImportUrl = snapshotFiles.length
    ? `anywhere://add-rule-set?${snapshotFiles.map((file) => `link=${encodeURIComponent(file.url)}`).join("&")}`
    : "";
  return jsonResponse({
    hash: snapshotHash || undefined,
    report: result.report,
    summary: summarizeResult(result, files),
    metadata: result.metadata,
    sourceKind: result.sourceKind,
    ruleSetRouting: result.ruleSetRouting,
    mode: result.mode,
    argumentDefinitions: result.argumentDefinitions,
    arguments: result.arguments,
    preservedParameters: result.preservedParameters,
    sourceUrl: input.sourceUrl || "",
    source: input.includeSource === true ? input.source : undefined,
    hostnames: result.hostnames,
    diagnostics: result.diagnostics,
    files,
    importUrl: dynamic.importUrl || snapshotImportUrl,
    snapshotImportUrl: snapshotImportUrl || undefined,
    dynamicImportUrl: dynamic.importUrl || undefined,
    dynamicFiles: dynamic.files,
    storage: snapshotImportUrl ? (env.CONVERTER_KV ? "kv" : "memory") : "dynamic",
    icon: icon.base64 ? { source: icon.source, url: icon.url || undefined, mimeType: icon.mimeType, bytes: icon.bytes } : undefined,
  });
}

function summarizeResult(result, files) {
  const visibleWarnings = result.diagnostics.filter((item) => item.level === "warning" && !isBenignSummaryDiagnostic(item));
  const scriptMetrics = result.report.scriptMetrics || {};
  return {
    status: result.report.status,
    converted: result.report.converted,
    skipped: result.report.skipped,
    fileCount: files.length,
    ruleCount: files.reduce((sum, file) => sum + file.ruleCount, 0),
    validationErrors: files.reduce((sum, file) => sum + file.validation.filter((item) => item.level === "error").length, 0),
    sampleRequired: result.report.status === "sample-required",
    sampleReasons: uniqueDiagnosticCodes(result.diagnostics.filter((item) => isSampleRequiredDiagnostic(item))),
    nativeLiftCount: result.diagnostics.filter((item) => item.code === "script-native-lift" || item.code === "script-respond-lift").length,
    compatScriptCount: result.diagnostics.filter((item) => item.code === "script-compat-layer").length,
    scriptRuleCount: scriptMetrics.scriptRuleCount || 0,
    totalScriptBytes: scriptMetrics.totalScriptBytes || 0,
    maxPerHitScriptBytes: scriptMetrics.maxPerHitScriptBytes || 0,
    warnings: uniqueDiagnosticCodes(visibleWarnings).slice(0, 8),
    scriptRecoveryUrls: scriptRecoveryUrls(result.diagnostics),
  };
}

async function handleDynamicRuleFetch(request, env) {
  const cached = await getCachedDynamicResponse(request, env);
  if (cached) return cached;

  const url = new URL(request.url);
  const kind = dynamicKindFromPath(url.pathname);
  if (!kind) return jsonResponse({ error: "bad_dynamic_path" }, 400);

  const converted = await convertFromDynamicQuery(request, env);
  if (converted.error) return jsonResponse({ error: converted.error, detail: converted.detail }, converted.status || 400);

  const file = selectDynamicFile(converted.result.files, kind);
  if (!file) return textResponse(`Error: no ${kind} rules in module`, 404);

  const response = textResponse(file.content, 200, {
    "cache-control": `public, max-age=${dynamicCacheTtl(env)}`,
    "content-disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
    "x-converter-source": "dynamic",
    "x-converter-cache-ttl": String(dynamicCacheTtl(env)),
  });
  await putCachedDynamicResponse(request, response.clone(), env);
  return response;
}

async function handleDynamicDeeplink(request, env) {
  const converted = await convertFromDynamicQuery(request, env);
  if (converted.error) return jsonResponse({ error: converted.error, detail: converted.detail }, converted.status || 400);

  const dynamic = dynamicLinksForResult(request, converted.result, {
    url: converted.sourceUrl,
    sourceUrl: converted.sourceUrl,
    name: converted.name,
    fetchScripts: converted.fetchScripts,
    arguments: converted.arguments,
    sourceKind: converted.sourceKind,
    ruleSetRouting: converted.ruleSetRouting,
    mode: converted.mode,
    preserveParameters: converted.preserveParameters,
    cacheBust: converted.cacheBust,
    iconUrl: converted.iconUrl,
  }, {});
  if (!dynamic.importUrl) return textResponse("Error: no rules to import", 404);

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "text") {
    return textResponse(dynamic.importUrl, 200, { "cache-control": `public, max-age=${dynamicCacheTtl(env)}` });
  }
  if ((request.headers.get("accept") || "").includes("text/html")) {
    return htmlResponse(dynamicImportHtml(dynamic.importUrl, dynamic.files));
  }
  return Response.redirect(dynamic.importUrl, 302);
}

async function convertFromDynamicQuery(request, env) {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) return { error: "missing_url", detail: "url parameter is required", status: 400 };

  const fetched = await fetchSourceURL(rawUrl, env);
  if (fetched.error) return fetched;

  const name = url.searchParams.get("name") || "";
  const fetchScripts = url.searchParams.get("fetchScripts") == null
    ? url.searchParams.get("fetch") !== "false"
    : url.searchParams.get("fetchScripts") !== "false";
  const mode = url.searchParams.get("mode") === "aggressive" ? "aggressive" : "compat";
  const sourceKind = normalizeInputSourceKind(url.searchParams.get("sourceKind"), fetched.source);
  const ruleSetRouting = normalizeRuleSetRoutingParam(url.searchParams.get("ruleSetRouting")) || "default";
  const args = argumentsFromSearchParams(url.searchParams);
  const preserveParameters = truthyInput(url.searchParams.get("preserveParameters") || url.searchParams.get("preserveArguments"));
  const cacheBust = normalizeCacheBust(url.searchParams.get("cacheBust") || url.searchParams.get("_"));
  const iconUrl = String(url.searchParams.get("iconUrl") || "").trim();
  const icon = iconUrl ? await fetchIconURL(iconUrl, env) : { base64: "", source: "none", url: "" };
  if (icon.error) return icon;
  const result = await convertAnyAsync(fetched.source, {
    name,
    mode,
    sourceKind,
    ruleSetRouting,
    arguments: args,
    preserveParameters,
    iconLightBase64: icon.base64,
    fetchScripts,
    maxScriptBytes: maxScriptBytes(env),
    maxTotalScriptBytes: maxTotalScriptBytes(env),
    maxScriptFetches: maxScriptFetches(env),
    maxMapLocalBytes: maxMapLocalBytes(env),
    maxTotalMapLocalBytes: maxTotalMapLocalBytes(env),
    maxMapLocalFetches: maxMapLocalFetches(env),
    fetchText: async (resourceUrl, options = {}) => {
      const resource = await fetchSourceURL(resourceUrl, env, options.maxBytes || maxScriptBytes(env), { cache: "memory" });
      if (resource.error) throw new Error(resource.detail || resource.error);
      return resource.source;
    },
  });
  return {
    result,
    sourceUrl: fetched.url,
    name,
    mode,
    sourceKind: result.sourceKind,
    ruleSetRouting: result.ruleSetRouting,
    fetchScripts,
    arguments: args,
    preserveParameters,
    cacheBust,
    iconUrl: icon.url || iconUrl,
  };
}

function dynamicKindFromPath(pathname) {
  if (pathname.endsWith("/mitm.amrs")) return "mitm";
  if (pathname.endsWith("/reject.arrs")) return "reject";
  if (pathname.endsWith("/direct.arrs")) return "direct";
  if (pathname.endsWith("/rule.arrs")) return "rule";
  return "";
}

function selectDynamicFile(files, kind) {
  if (kind === "mitm") return files.find((file) => file.type === "amrs");
  const arrs = files.filter((file) => file.type === "arrs");
  if (kind === "reject") return arrs.find((file) => routingOfArrs(file.content) === 2);
  if (kind === "direct") return arrs.find((file) => routingOfArrs(file.content) === 1);
  if (kind === "rule") return arrs.find((file) => routingOfArrs(file.content) === 0) || arrs[0];
  return null;
}

function routingOfArrs(content) {
  const match = String(content || "").match(/^routing\s*=\s*(\d+)/m);
  return match ? Number(match[1]) : 0;
}

function dynamicLinksForResult(request, result, input, scriptTextByURL) {
  const sourceUrl = input.sourceUrl || input.url || "";
  if (!sourceUrl || Object.keys(scriptTextByURL || {}).length || String(input.iconLightBase64 || "").trim()) return { files: [], importUrl: "" };

  const base = new URL(request.url);
  const requestedKind = String(input.sourceKind || "").toLowerCase();
  const sourceKind = requestedKind && requestedKind !== "auto" ? requestedKind : result.sourceKind;
  const query = dynamicSearchParams(sourceUrl, input.name || "", input.arguments || {}, input.fetchScripts, input.mode, sourceKind, input.ruleSetRouting ?? result.ruleSetRouting, input.cacheBust, input.preserveParameters, input.iconUrl);
  const files = [];
  for (const file of result.files || []) {
    const path = dynamicPathForFile(file);
    if (!path) continue;
    const itemUrl = new URL(base.origin + path);
    itemUrl.search = query.toString();
    files.push({ name: file.name, type: file.type, ruleCount: file.ruleCount, url: itemUrl.toString() });
  }
  return {
    files,
    importUrl: files.length ? `anywhere://add-rule-set?${files.map((file) => `link=${encodeURIComponent(file.url)}`).join("&")}` : "",
  };
}

function dynamicPathForFile(file) {
  if (file.type === "amrs") return "/sub/mitm.amrs";
  if (file.type !== "arrs") return "";
  const routing = routingOfArrs(file.content);
  if (routing === 2) return "/sub/reject.arrs";
  if (routing === 1) return "/sub/direct.arrs";
  return "/sub/rule.arrs";
}

function dynamicSearchParams(sourceUrl, name, args, fetchScripts, mode, sourceKind, ruleSetRouting, cacheBust, preserveParameters, iconUrl = "") {
  const params = new URLSearchParams();
  params.set("url", sourceUrl);
  if (name) params.set("name", name);
  if (fetchScripts === false || fetchScripts === "false" || fetchScripts === "0") params.set("fetch", "false");
  if (mode === "aggressive") params.set("mode", "aggressive");
  const normalizedSourceKind = String(sourceKind || "").toLowerCase();
  if (normalizedSourceKind === "ruleset" || normalizedSourceKind === "rule-set") params.set("sourceKind", "ruleset");
  const routing = normalizeRuleSetRoutingParam(ruleSetRouting);
  if (routing) params.set("ruleSetRouting", routing);
  const bust = normalizeCacheBust(cacheBust);
  if (bust) params.set("cacheBust", bust);
  if (truthyInput(preserveParameters)) params.set("preserveParameters", "true");
  if (String(iconUrl || "").trim()) params.set("iconUrl", String(iconUrl).trim());
  for (const [key, value] of Object.entries(args || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) continue;
    params.set(`argument.${key}`, String(value));
  }
  return params;
}

function normalizeCacheBust(value) {
  const text = String(value ?? "").trim();
  return /^[A-Za-z0-9._:-]{1,80}$/.test(text) ? text : "";
}

function argumentsFromSearchParams(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("argument.")) continue;
    const name = key.slice("argument.".length);
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) continue;
    out[name] = value;
  }
  return out;
}

function normalizeInputSourceKind(value, source = "") {
  const text = String(value || "").toLowerCase();
  if (text === "module" || text === "plugin") return "module";
  if (text === "ruleset" || text === "rule-set" || text === "rule_set") return "ruleset";
  return detectSourceKind(source);
}

function normalizeRuleSetRoutingParam(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "direct" || text === "1") return "direct";
  if (text === "reject" || text === "2") return "reject";
  if (text === "default" || text === "0") return "default";
  return "";
}

function dynamicCacheTtl(env) {
  const configured = Number(env.DYNAMIC_CACHE_TTL_SECONDS || env.FETCH_CACHE_TTL_SECONDS || 15 * 60);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

async function getCachedDynamicResponse(request, env) {
  const ttl = dynamicCacheTtl(env);
  if (ttl <= 0) return null;
  const key = request.url;
  const memory = memoryDynamicCache.get(key);
  if (memory && memory.expiresAt > Date.now()) {
    return new Response(memory.body, {
      status: memory.status,
      headers: {
        ...memory.headers,
        "x-converter-cache": "memory",
      },
    });
  }
  if (typeof caches === "undefined" || !caches.default) return null;
  const response = await caches.default.match(request);
  if (!response) return null;
  const headers = new Headers(response.headers);
  headers.set("x-converter-cache", "hit");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function putCachedDynamicResponse(request, response, env) {
  const ttl = dynamicCacheTtl(env);
  if (ttl <= 0 || response.status !== 200) return;
  const body = await response.clone().text();
  memoryDynamicCache.set(request.url, {
    body,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    expiresAt: Date.now() + ttl * 1000,
  });
  if (typeof caches === "undefined" || !caches.default) return;
  await caches.default.put(request, response);
}

function dynamicImportHtml(importUrl, files) {
  const fileItems = files.map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a></li>`).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Anywhere 动态订阅</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17202a; background: #edf3f8; }
    main { width: min(720px, calc(100vw - 32px)); margin: 40px auto; padding: 18px; border: 2px solid #17202a; border-radius: 8px; background: #fff; box-shadow: 5px 5px 0 rgba(23,32,42,.18); }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { color: #5d6b78; line-height: 1.55; }
    a.button { display: inline-flex; align-items: center; min-height: 38px; padding: 0 12px; border-radius: 6px; background: #2554d7; color: #fff; font-weight: 800; text-decoration: none; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Anywhere 动态订阅</h1>
    <p>这个导入链接保留原始模块 URL，Anywhere 访问规则文件时会由 Worker 重新拉取上游并转换。</p>
    <p><a class="button" href="${escapeHtml(importUrl)}">导入 Anywhere</a></p>
    <p><code>${escapeHtml(importUrl)}</code></p>
    <ul>${fileItems}</ul>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSampleRequiredDiagnostic(diagnostic) {
  const code = diagnostic?.code || "";
  return code === "sample-required-pattern" || /sample-required/.test(code);
}

function isBenignSummaryDiagnostic(diagnostic) {
  return diagnostic?.code === "domain-exact-degraded" || diagnostic?.code === "logical-and-degraded";
}

function scriptRecoveryUrls(diagnostics) {
  const codes = new Set(["script-fetch-failed", "script-fetch-file-too-large", "script-fetch-budget-exceeded", "script-fetch-count-exceeded", "script-source-missing"]);
  const urls = [];
  const seen = new Set();
  for (const diagnostic of diagnostics) {
    if (!codes.has(diagnostic?.code)) continue;
    for (const url of extractHttpUrls(`${diagnostic.message || ""}\n${diagnostic.source || ""}`)) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return urls.slice(0, 16);
}

function extractHttpUrls(text) {
  const out = [];
  const pattern = /https?:\/\/[^\s"'<>),]+/g;
  for (const match of String(text || "").matchAll(pattern)) {
    out.push(match[0].replace(/[.;\]]+$/g, ""));
  }
  return out;
}

function uniqueDiagnosticCodes(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const code = item.code || item.level || "diagnostic";
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function truthyInput(value) {
  if (value === true) return true;
  return /^(?:1|true|yes|on)$/i.test(String(value || ""));
}

function normalizeScriptTextByURL(value, env) {
  if (!isPlainObject(value)) return {};
  const out = {};
  let total = 0;
  for (const [rawUrl, text] of Object.entries(value)) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(url.protocol)) continue;
    const source = String(text || "");
    const size = new TextEncoder().encode(source).length;
    if (size > maxScriptBytes(env)) continue;
    if (total + size > maxTotalScriptBytes(env)) break;
    out[url.toString()] = source;
    total += size;
  }
  return out;
}

function scriptOverrideHash(value) {
  if (!isPlainObject(value)) return "";
  return JSON.stringify(Object.keys(value).sort().map((key) => [key, String(value[key] || "")]));
}

async function handleRuleFetch(url, env) {
  const match = url.pathname.match(/^\/r\/([^/]+)\/(.+)$/);
  if (!match) return jsonResponse({ error: "bad_rule_path" }, 400);
  const hash = match[1];
  const filename = decodeURIComponent(match[2]);
  if (!/\.(amrs|arrs)$/i.test(filename)) return jsonResponse({ error: "bad_rule_extension" }, 400);
  const content = await getFile(env, `${hash}/${filename}`);
  if (content == null) return jsonResponse({ error: "rule_not_found" }, 404);
  return new Response(content, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

async function readInput(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      name: String(form.get("name") || ""),
      url: String(form.get("url") || ""),
      source: String(form.get("source") || ""),
    };
  }
  return { source: await request.text() };
}

async function resolveIconInput(input, env) {
  const inline = String(input.iconLightBase64 || "").trim();
  const remote = String(input.iconUrl || "").trim();
  if (inline && remote) return { error: "ambiguous_icon_source", detail: "请只选择上传图片或图片 URL 中的一种。", status: 400 };
  if (inline) {
    const normalized = normalizeIconBase64(inline, maxIconBytes(env));
    if (normalized.error) return { error: "invalid_icon", detail: normalized.error, status: /超过/.test(normalized.error) ? 413 : 400 };
    return { ...normalized, source: "upload", url: "" };
  }
  if (remote) return fetchIconURL(remote, env);
  return { base64: "", mimeType: "", bytes: 0, source: "none", url: "" };
}

async function fetchIconURL(rawUrl, env) {
  const requested = String(rawUrl || "").trim();
  if (!requested) return { error: "missing_icon_url", detail: "请填写图片 URL。", status: 400 };
  let original;
  try {
    original = new URL(requested);
  } catch {
    return { error: "bad_icon_url", detail: "图片 URL 无法解析。", status: 400 };
  }
  if (!isSafeRemoteURL(original)) return { error: "blocked_icon_url", detail: "图片只允许使用公网 http/https URL。", status: 400 };

  const cached = memoryIconCache.get(original.toString());
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, source: "url" };

  const limit = maxIconBytes(env);
  let lastFailure = "";
  for (const candidate of fetchURLCandidates(original)) {
    let current = candidate;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      if (!isSafeRemoteURL(current)) {
        lastFailure = "重定向目标不是公网 http/https URL。";
        break;
      }
      let response;
      try {
        response = await fetch(current.toString(), {
          headers: { "user-agent": "AnywhereModuleConverter/0.1", accept: "image/png,image/jpeg,image/webp,image/gif,image/*;q=0.8" },
          redirect: "manual",
        });
      } catch (error) {
        lastFailure = error?.message || "图片下载失败。";
        break;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === 5) {
          lastFailure = redirectCount === 5 ? "图片重定向次数超过上限。" : "图片重定向缺少 Location。";
          break;
        }
        try {
          current = new URL(location, current);
        } catch {
          lastFailure = "图片重定向 URL 无法解析。";
          break;
        }
        continue;
      }
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        break;
      }
      const contentLength = Number(response.headers.get("content-length") || "0");
      if (contentLength > limit) return { error: "icon_too_large", detail: `图片超过 ${limit} bytes 上限。`, status: 413 };
      let bytes;
      try {
        bytes = await readBoundedBytes(response, limit);
      } catch (error) {
        return { error: "icon_too_large", detail: error?.message || `图片超过 ${limit} bytes 上限。`, status: 413 };
      }
      const normalized = normalizeIconBase64(bytesToBase64(bytes), limit);
      if (normalized.error) return { error: "invalid_icon", detail: normalized.error, status: /超过/.test(normalized.error) ? 413 : 400 };
      const value = { ...normalized, source: "url", url: original.toString(), finalUrl: current.toString() };
      memoryIconCache.set(original.toString(), { value, expiresAt: Date.now() + Math.max(60, fetchCacheTtl(env)) * 1000 });
      return value;
    }
  }
  return { error: "icon_fetch_failed", detail: lastFailure || "图片下载失败。", status: 502 };
}

function isSafeRemoteURL(url) {
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !isBlockedFetchHost(url.hostname);
}

async function readBoundedBytes(response, limit) {
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > limit) throw new Error(`图片超过 ${limit} bytes 上限。`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`图片超过 ${limit} bytes 上限。`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  if (typeof btoa === "function") return btoa(binary);
  return globalThis.Buffer.from(bytes).toString("base64");
}

async function fetchSourceURL(rawUrl, env, byteLimit, options = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "bad_source_url", detail: "URL 无法解析。" };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "bad_source_url", detail: "只允许 http/https URL。" };
  }
  if (isBlockedFetchHost(url.hostname)) {
    return { error: "blocked_source_url", detail: "不允许拉取 localhost、内网或链路本地地址。" };
  }
  const platformCache = options.cache !== "memory";
  const cached = await getCachedFetchSource(url.toString(), env, { platformCache });
  if (cached != null) {
    const limit = byteLimit || maxInputBytes(env);
    if (new TextEncoder().encode(cached).length > limit) return { error: "input_too_large", detail: "远程内容超过大小限制。", status: 413 };
    return { source: cached, url: url.toString(), cached: true };
  }
  let response;
  let lastFailure = "";
  for (const candidate of fetchURLCandidates(url)) {
    try {
      response = await fetch(candidate.toString(), {
        headers: { "user-agent": "AnywhereModuleConverter/0.1" },
        redirect: "follow",
      });
    } catch (error) {
      lastFailure = error?.message || "fetch failed";
      continue;
    }
    if (response.ok) break;
    lastFailure = `HTTP ${response.status}`;
    response = null;
  }
  if (!response) {
    return { error: "source_fetch_failed", detail: lastFailure || "fetch failed", status: 502 };
  }
  const limit = byteLimit || maxInputBytes(env);
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > limit) return { error: "input_too_large", detail: "远程模块超过大小限制。", status: 413 };
  const source = await response.text();
  if (new TextEncoder().encode(source).length > limit) return { error: "input_too_large", detail: "远程模块超过大小限制。", status: 413 };
  await putCachedFetchSource(url.toString(), source, env, { platformCache });
  return { source, url: url.toString() };
}

function fetchURLCandidates(url) {
  const out = [url];
  const jsdelivr = githubRawToJsDelivr(url);
  if (jsdelivr) out.push(jsdelivr);
  return out;
}

function githubRawToJsDelivr(url) {
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4) return null;
  const [owner, repo] = parts;
  let ref = parts[2];
  let pathStart = 3;
  if (parts[2] === "refs" && (parts[3] === "heads" || parts[3] === "tags") && parts[4]) {
    ref = parts[4];
    pathStart = 5;
  }
  const filePath = parts.slice(pathStart).join("/");
  if (!owner || !repo || !ref || !filePath) return null;
  return new URL(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${filePath}${url.search}`);
}

async function rateLimit(request, env, scope) {
  const limit = Number(env.RATE_LIMIT_PER_MINUTE || 60);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const bucket = Math.floor(Date.now() / 60000);
  const identity = await sha256(`${scope}:${ip}`);
  const key = `rate:${scope}:${bucket}:${identity}`;
  const current = await getRateCount(env, key);
  if (current >= limit) {
    return jsonResponse({
      error: "rate_limited",
      detail: `请求过于频繁，请稍后再试。当前限制为每分钟 ${limit} 次。`,
    }, 429, { "retry-after": "60" });
  }
  await putRateCount(env, key, current + 1);
  return null;
}

async function getRateCount(env, key) {
  if (env.CONVERTER_KV) {
    const value = await env.CONVERTER_KV.get(key);
    return Number(value || 0) || 0;
  }
  const item = memoryRateStore.get(key);
  if (!item || item.expiresAt < Date.now()) return 0;
  return item.count;
}

async function putRateCount(env, key, count) {
  if (env.CONVERTER_KV) {
    await env.CONVERTER_KV.put(key, String(count), { expirationTtl: 90 });
    return;
  }
  memoryRateStore.set(key, { count, expiresAt: Date.now() + 90 * 1000 });
}

async function getCachedFetchSource(url, env, options = {}) {
  const ttl = fetchCacheTtl(env);
  if (ttl <= 0) return null;
  const memory = memoryFetchCache.get(url);
  if (memory && memory.expiresAt > Date.now()) return memory.source;
  if (options.platformCache === false) return null;
  if (typeof caches === "undefined" || !caches.default) return null;
  const response = await caches.default.match(new Request(url, { method: "GET" }));
  if (!response) return null;
  return response.text();
}

async function putCachedFetchSource(url, source, env, options = {}) {
  const ttl = fetchCacheTtl(env);
  if (ttl <= 0) return;
  memoryFetchCache.set(url, { source, expiresAt: Date.now() + ttl * 1000 });
  if (options.platformCache === false) return;
  if (typeof caches === "undefined" || !caches.default) return;
  const response = new Response(source, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": `public, max-age=${ttl}`,
    },
  });
  await caches.default.put(new Request(url, { method: "GET" }), response);
}

function isBlockedFetchHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1, 3).map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

async function putFile(env, key, content) {
  memoryStore.set(key, content);
  if (env.CONVERTER_KV) await env.CONVERTER_KV.put(key, content, { expirationTtl: 60 * 60 * 24 * 30 });
}

async function getFile(env, key) {
  if (env.CONVERTER_KV) {
    const value = await env.CONVERTER_KV.get(key);
    if (value != null) return value;
  }
  return memoryStore.get(key) ?? null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function maxInputBytes(env) {
  const configured = Number(env.MAX_INPUT_BYTES || 512 * 1024);
  return Number.isFinite(configured) && configured > 0 ? configured : 512 * 1024;
}

function maxScriptBytes(env) {
  const configured = Number(env.MAX_SCRIPT_BYTES || 1024 * 1024);
  return Number.isFinite(configured) && configured > 0 ? configured : 1024 * 1024;
}

function maxTotalScriptBytes(env) {
  const configured = Number(env.MAX_TOTAL_SCRIPT_BYTES || 5 * 1024 * 1024);
  return Number.isFinite(configured) && configured > 0 ? configured : 5 * 1024 * 1024;
}

function maxScriptFetches(env) {
  const configured = Number(env.MAX_SCRIPT_FETCHES || 45);
  if (configured === 0) return 0;
  return Number.isFinite(configured) && configured > 0 ? configured : 45;
}

function maxMapLocalBytes(env) {
  const configured = Number(env.MAX_MAP_LOCAL_BYTES || 512 * 1024);
  return Number.isFinite(configured) && configured > 0 ? configured : 512 * 1024;
}

function maxTotalMapLocalBytes(env) {
  const configured = Number(env.MAX_TOTAL_MAP_LOCAL_BYTES || 2 * 1024 * 1024);
  return Number.isFinite(configured) && configured > 0 ? configured : 2 * 1024 * 1024;
}

function maxMapLocalFetches(env) {
  const configured = Number(env.MAX_MAP_LOCAL_FETCHES || 16);
  return Number.isFinite(configured) && configured > 0 ? configured : 16;
}

function maxIconBytes(env) {
  const anywhereLimit = 256 * 1024;
  const configured = Number(env.MAX_ICON_BYTES || anywhereLimit);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, anywhereLimit) : anywhereLimit;
}

function fetchCacheTtl(env) {
  const configured = Number(env.FETCH_CACHE_TTL_SECONDS || 15 * 60);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization, if-match",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function textResponse(body, status = 200, extraHeaders = {}) {
  return new Response(String(body ?? ""), {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization, if-match",
      "access-control-max-age": "86400",
    },
  });
}

function htmlResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function manifestResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function serviceWorkerResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/",
    },
  });
}

function iconResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
