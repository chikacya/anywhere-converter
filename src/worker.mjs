import { convertAnyAsync, detectSourceKind, internals, parseModule, parseRuleSet, validateAnywhereOutput } from "./core.mjs";
import { renderHome } from "./ui.mjs";

const memoryStore = new Map();
const memoryRateStore = new Map();
const memoryFetchCache = new Map();
const memoryDynamicCache = new Map();

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return optionsResponse();
      if (request.method === "GET" && url.pathname === "/") return htmlResponse(renderHome());
      if (request.method === "GET" && url.pathname === "/health") return jsonResponse({
        ok: true,
        version: "0.1.0",
        capabilities: ["url-input", "text-input", "argument-form", "script-fetch", "script-recovery", "native-js-lift", "aggressive-js-lift", "ruleset-conversion", "dynamic-subscription", "cache-bust-refresh", "browser-download", "fallback-snapshot"],
      });
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

  const scriptTextByURL = normalizeScriptTextByURL(input.scriptTextByURL, env);
  const result = await convertAnyAsync(input.source, {
    name: input.name,
    mode: input.mode,
    sourceKind: input.sourceKind,
    ruleSetRouting: input.ruleSetRouting,
    arguments: isPlainObject(input.arguments) ? input.arguments : {},
    preserveParameters: truthyInput(input.preserveParameters),
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
      snapshotHash = await sha256(input.source + "\n" + (input.name || "") + "\n" + (input.sourceUrl || "") + "\n" + scriptOverrideHash(scriptTextByURL));
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
  const result = await convertAnyAsync(fetched.source, {
    name,
    mode,
    sourceKind,
    ruleSetRouting,
    arguments: args,
    preserveParameters,
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
  if (!sourceUrl || Object.keys(scriptTextByURL || {}).length) return { files: [], importUrl: "" };

  const base = new URL(request.url);
  const requestedKind = String(input.sourceKind || "").toLowerCase();
  const sourceKind = requestedKind && requestedKind !== "auto" ? requestedKind : result.sourceKind;
  const query = dynamicSearchParams(sourceUrl, input.name || "", input.arguments || {}, input.fetchScripts, input.mode, sourceKind, input.ruleSetRouting ?? result.ruleSetRouting, input.cacheBust, input.preserveParameters);
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

function dynamicSearchParams(sourceUrl, name, args, fetchScripts, mode, sourceKind, ruleSetRouting, cacheBust, preserveParameters) {
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
      "access-control-allow-headers": "content-type",
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
      "access-control-allow-headers": "content-type",
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
