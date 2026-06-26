const ROUTING = {
  default: 0,
  direct: 1,
  reject: 2,
};

const ROUTING_TYPES = {
  ipCIDR: 0,
  ipCIDR6: 1,
  domainSuffix: 2,
  domainKeyword: 3,
};

const MITM_OPS = new Set([0, 1, 2, 3, 4, 5, 100, 101]);
const BODY_JSON_ACTIONS = new Set([
  "add",
  "replace",
  "delete",
  "replace-recursive",
  "delete-recursive",
  "remove-where-key-exists",
  "remove-where-field-in",
]);

const RULE_TYPE_ALIASES = {
  HOST: "DOMAIN",
  "HOST-SUFFIX": "DOMAIN-SUFFIX",
  "HOST-KEYWORD": "DOMAIN-KEYWORD",
  "HOST-WILDCARD": "DOMAIN-WILDCARD",
  "IP6-CIDR": "IP-CIDR6",
};

export function convertModule(source, options = {}) {
  const mode = normalizeMode(options.mode, options.fetchScripts);
  const parsed = parseModule(source, options);
  const diagnostics = [...parsed.diagnostics];
  const argumentValues = resolveArgumentValues(parsed.arguments, options.arguments);
  if (mode === "aggressive") {
    diagnostics.push({ level: "warning", code: "aggressive-mode", message: "aggressive 模式是实验入口；protobuf/binary/复杂脚本仍需样本验证。", line: 0, source: "" });
  }
  let mitmRules = [];
  const routingGroups = new Map();
  const inferredHosts = new Set();
  const headerPreprocess = new Set();
  let converted = 0;
  let skipped = 0;

  const addDiagnostic = (level, code, message, line = 0, sourceLine = "") => {
    diagnostics.push({ level, code, message, line, source: sourceLine });
  };

  const addMitm = (rule, line, sourceLine) => {
    rule = normalizeMitmRulePattern(rule);
    if (needsResponseBodyPreprocess(rule)) {
      for (const generatedRule of responseBodyPreprocessRules(rule.pattern)) {
        const key = `${generatedRule.pattern}\u001f${generatedRule.op}\u001f${generatedRule.fields.join("\u001f")}`;
        if (!headerPreprocess.has(key)) {
          headerPreprocess.add(key);
          mitmRules.push(generatedRule);
        }
      }
    }
    mitmRules.push(rule);
    converted += 1;
    if (rule.degraded) addDiagnostic("warning", rule.degraded.code, rule.degraded.message, line, sourceLine);
    for (const host of extractHostsFromPattern(rule.pattern)) inferredHosts.add(host);
    if (isHighRiskPattern(rule.pattern)) {
      addDiagnostic("warning", "sample-required-pattern", "命中高频或 protobuf 风险路径，建议实机样本验证。", line, sourceLine);
    }
  };

  const addMitmMapped = (mapped, line, sourceLine) => {
    const rules = Array.isArray(mapped) ? mapped : [mapped];
    for (const rule of rules) addMitm(rule, line, sourceLine);
  };

  const addRouting = (routing, rule, line, sourceLine) => {
    const key = routing === ROUTING.direct ? "Direct" : routing === ROUTING.reject ? "Reject" : "Default";
    if (!routingGroups.has(key)) routingGroups.set(key, { routing, rules: [] });
    routingGroups.get(key).rules.push(rule);
    converted += 1;
    if (rule.degraded) addDiagnostic("warning", rule.degraded.code, rule.degraded.message, line, sourceLine);
  };

  for (const originalItem of parsed.items) {
    const resolvedItem = resolveItemArguments(originalItem, argumentValues);
    if (!resolvedItem.enabled) {
      skipped += 1;
      addDiagnostic("info", "argument-disabled", `规则被参数 ${resolvedItem.argument || "(unknown)"} 禁用。`, originalItem.line, originalItem.raw);
      continue;
    }
    const item = resolvedItem.item;
    switch (item.section) {
    case "Rule": {
      const mapped = convertRuleLine(item);
      if (!mapped) {
        skipped += 1;
        addDiagnostic("warning", "unsupported-rule", "暂不支持该 Rule 语法，已跳过。", item.line, item.raw);
      } else if (mapped.kind === "mitm") {
        addMitm(mapped.rule, item.line, item.raw);
      } else if (mapped.kind === "routing") {
        addRouting(mapped.routing, mapped.rule, item.line, item.raw);
      } else if (mapped.kind === "skip") {
        skipped += 1;
        addDiagnostic(mapped.level || "warning", mapped.code, mapped.message, item.line, item.raw);
      }
      break;
    }
    case "Rewrite":
    case "URL Rewrite": {
      const mapped = convertRewriteLine(item);
      if (mapped) {
        addMitmMapped(mapped, item.line, item.raw);
      } else {
        skipped += 1;
        addDiagnostic("warning", "unsupported-rewrite", "暂不支持该 Rewrite 语法，已跳过。", item.line, item.raw);
      }
      break;
    }
    case "Map Local": {
      const mapped = convertMapLocalLine(item);
      if (mapped?.rule) {
        addMitm(mapped.rule, item.line, item.raw);
        for (const diagnostic of mapped.diagnostics || []) {
          addDiagnostic(diagnostic.level, diagnostic.code, diagnostic.message, item.line, item.raw);
        }
      } else {
        skipped += 1;
        addDiagnostic("warning", mapped?.code || "unsupported-map-local", mapped?.message || "暂不支持该 Map Local 语法，已跳过。", item.line, item.raw);
      }
      break;
    }
    case "Body Rewrite": {
      const mapped = convertBodyRewriteLine(item);
      if (mapped) {
        addMitmMapped(mapped, item.line, item.raw);
      } else {
        skipped += 1;
        addDiagnostic("warning", "unsupported-body-rewrite", "只支持简单 del(.path) jq 子集，已跳过。", item.line, item.raw);
      }
      break;
    }
    case "Header Rewrite": {
      const mapped = convertHeaderRewriteLine(item);
      if (mapped) {
        addMitmMapped(mapped, item.line, item.raw);
      } else {
        skipped += 1;
        addDiagnostic("warning", "unsupported-header-rewrite", "暂不支持该 Header Rewrite 语法，已跳过。", item.line, item.raw);
      }
      break;
    }
    case "Script": {
      const mapped = convertScriptLine(item, { ...options, mode });
      if (mapped?.rule) {
        addMitmMapped(mapped.rule, item.line, item.raw);
        for (const diagnostic of mapped.diagnostics || []) {
          addDiagnostic(diagnostic.level, diagnostic.code, diagnostic.message, item.line, item.raw);
        }
      } else {
        skipped += 1;
        addDiagnostic("info", mapped?.code || "script-skipped", mapped?.message || "脚本规则已识别；当前未下载远程脚本，启用 fetchScripts 后可用兼容层保留。", item.line, item.raw);
      }
      break;
    }
    default:
      break;
    }
  }

  const name = options.name || parsed.metadata.name || "Converted Module";
  let hostnames = normalizeHostnames([...parsed.hostnames, ...inferredHosts], diagnostics);
  hostnames = applyVerifiedRecipe(name, hostnames, mitmRules);
  mitmRules = generalizeGroupedHostPatterns(mitmRules, hostnames, diagnostics);
  mitmRules = dedupeMitmRules(mitmRules);
  mitmRules = mergeSameGateScripts(mitmRules, diagnostics);
  mitmRules = mergeIdenticalScriptSourcesByPhase(mitmRules, diagnostics);
  mitmRules = mergeScriptDispatchersByPhase(mitmRules, diagnostics);
  mitmRules = mergeGeneratedHeaderPreprocessRules(mitmRules, diagnostics);
  const files = [];

  if (mitmRules.length) {
    files.push({
      name: filenameFromName(name, ".amrs"),
      type: "amrs",
      content: emitAmrs(name, hostnames, mitmRules),
      ruleCount: mitmRules.length,
    });
  }

  for (const [groupName, group] of routingGroups) {
    if (!group.rules.length) continue;
    files.push({
      name: filenameFromName(`${name}_${groupName}`, ".arrs"),
      type: "arrs",
      content: emitArrs(`${name} ${groupName}`, group.routing, group.rules),
      ruleCount: group.rules.length,
    });
  }

  const report = buildReport({ converted, skipped, files, diagnostics });
  return {
    metadata: parsed.metadata,
    argumentDefinitions: parsed.arguments,
    arguments: argumentValues,
    mode,
    hostnames,
    files,
    diagnostics,
    report,
  };
}

export async function convertModuleAsync(source, options = {}) {
  if (options.fetchScripts === false) return convertModule(source, options);
  const parsed = parseModule(source, options);
  const argumentValues = resolveArgumentValues(parsed.arguments, options.arguments);
  const scriptTextByURL = { ...(options.scriptTextByURL || {}) };
  const diagnostics = [];
  const fetchText = options.fetchText;
  const maxScriptBytes = Number(options.maxScriptBytes || 1024 * 1024);
  const maxTotalScriptBytes = Number(options.maxTotalScriptBytes || 5 * 1024 * 1024);
  let fetchedScriptBytes = Object.values(scriptTextByURL).reduce((sum, text) => sum + byteLength(text), 0);
  if (typeof fetchText === "function") {
    for (const originalItem of parsed.items.filter((entry) => entry.section === "Script")) {
      const resolvedItem = resolveItemArguments(originalItem, argumentValues);
      if (!resolvedItem.enabled) continue;
      const item = resolvedItem.item;
      const script = parseScriptLine(item.text);
      if (!script?.path || script.inlineScript || scriptTextByURL[script.path]) continue;
      if (fetchedScriptBytes >= maxTotalScriptBytes) {
        diagnostics.push({
          level: "warning",
          code: "script-fetch-budget-exceeded",
          message: `脚本总下载预算已用尽，跳过：${script.path}`,
          line: item.line,
          source: item.raw,
        });
        continue;
      }
      try {
        const text = await fetchText(script.path, { maxBytes: maxScriptBytes, kind: "script" });
        const size = byteLength(text);
        if (size > maxScriptBytes) {
          diagnostics.push({
            level: "warning",
            code: "script-fetch-file-too-large",
            message: `脚本超过单文件预算 ${maxScriptBytes} bytes，跳过：${script.path}`,
            line: item.line,
            source: item.raw,
          });
          continue;
        }
        if (fetchedScriptBytes + size > maxTotalScriptBytes) {
          diagnostics.push({
            level: "warning",
            code: "script-fetch-budget-exceeded",
            message: `脚本超过总下载预算 ${maxTotalScriptBytes} bytes，跳过：${script.path}`,
            line: item.line,
            source: item.raw,
          });
          continue;
        }
        scriptTextByURL[script.path] = text;
        fetchedScriptBytes += size;
      } catch (error) {
        diagnostics.push({
          level: "warning",
          code: "script-fetch-failed",
          message: `脚本下载失败：${script.path} (${error?.message || error})`,
          line: item.line,
          source: item.raw,
        });
      }
    }
  }
  const result = convertModule(source, { ...options, scriptTextByURL });
  result.diagnostics.unshift(...diagnostics);
  result.report = buildReport({
    converted: result.report.converted,
    skipped: result.report.skipped,
    files: result.files,
    diagnostics: result.diagnostics,
  });
  return result;
}

export function detectSourceKind(source) {
  const text = String(source || "");
  if (/\[(?:Rewrite|URL Rewrite|MITM|Script|Map Local|Body Rewrite|Header Rewrite|Arguments?)\]/i.test(text)) return "module";
  if (/^\s*\[Rule\]\s*$/im.test(text)) return "module";

  let ruleLike = 0;
  let meaningful = 0;
  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//") || raw.startsWith(";")) continue;
    const line = normalizeRuleSetCandidateLine(stripInlineComment(raw).trim());
    if (!line || /^(?:payload|rules)\s*:\s*$/i.test(line)) continue;
    meaningful += 1;
    if (ruleSetLineToRuleText(line)) ruleLike += 1;
  }
  return meaningful > 0 && ruleLike > 0 && ruleLike / meaningful >= 0.6 ? "ruleset" : "module";
}

export function convertAny(source, options = {}) {
  const sourceKind = normalizeSourceKind(options.sourceKind, source);
  if (sourceKind === "ruleset") return convertRuleSet(source, options);
  const result = convertModule(source, options);
  result.sourceKind = "module";
  return result;
}

export async function convertAnyAsync(source, options = {}) {
  const sourceKind = normalizeSourceKind(options.sourceKind, source);
  if (sourceKind === "ruleset") return convertRuleSet(source, options);
  const result = await convertModuleAsync(source, options);
  result.sourceKind = "module";
  return result;
}

export function convertRuleSet(source, options = {}) {
  const parsed = parseRuleSet(source);
  const diagnostics = [...parsed.diagnostics];
  const defaultRouting = normalizeRuleSetRouting(options.ruleSetRouting ?? options.routing);
  const routingGroups = new Map();
  const seenRoutingRules = new Set();
  let mitmRules = [];
  const inferredHosts = new Set();
  let converted = 0;
  let skipped = 0;

  const addDiagnostic = (level, code, message, line = 0, sourceLine = "") => {
    diagnostics.push({ level, code, message, line, source: sourceLine });
  };

  const addMitm = (rule, line, sourceLine) => {
    rule = normalizeMitmRulePattern(rule);
    mitmRules.push(rule);
    converted += 1;
    if (rule.degraded) addDiagnostic("warning", rule.degraded.code, rule.degraded.message, line, sourceLine);
    for (const host of extractHostsFromPattern(rule.pattern)) inferredHosts.add(host);
  };

  const addRouting = (routing, rule, line, sourceLine) => {
    const dedupeKey = `${routing}\u001f${rule.type}\u001f${rule.value}`;
    if (seenRoutingRules.has(dedupeKey)) return;
    seenRoutingRules.add(dedupeKey);
    const key = routingGroupName(routing);
    if (!routingGroups.has(key)) routingGroups.set(key, { routing, rules: [] });
    routingGroups.get(key).rules.push(rule);
    converted += 1;
    if (rule.degraded) addDiagnostic("warning", rule.degraded.code, rule.degraded.message, line, sourceLine);
  };

  for (const item of parsed.items) {
    const mapped = convertRuleSetLine(item, defaultRouting);
    if (!mapped) {
      skipped += 1;
      addDiagnostic("warning", "unsupported-ruleset-rule", "暂不支持该规则集语法，已跳过。", item.line, item.raw);
    } else if (mapped.kind === "mitm") {
      addMitm(mapped.rule, item.line, item.raw);
    } else if (mapped.kind === "routing") {
      addRouting(mapped.routing, mapped.rule, item.line, item.raw);
    } else if (mapped.kind === "skip") {
      skipped += 1;
      addDiagnostic(mapped.level || "warning", mapped.code, mapped.message, item.line, item.raw);
    }
  }

  const name = options.name || parsed.metadata.name || "Converted Rule Set";
  const hostnames = normalizeHostnames([...inferredHosts], diagnostics);
  mitmRules = dedupeMitmRules(mitmRules);
  const files = [];
  if (mitmRules.length) {
    files.push({
      name: filenameFromName(name, ".amrs"),
      type: "amrs",
      content: emitAmrs(name, hostnames, mitmRules),
      ruleCount: mitmRules.length,
    });
  }
  for (const [groupName, group] of routingGroups) {
    group.rules = dedupeRoutingRules(group.rules);
    if (!group.rules.length) continue;
    const suffix = group.routing === defaultRouting ? "" : `_${groupName}`;
    files.push({
      name: filenameFromName(`${name}${suffix}`, ".arrs"),
      type: "arrs",
      content: emitArrs(name, group.routing, group.rules),
      ruleCount: group.rules.length,
    });
  }

  const report = buildReport({ converted, skipped, files, diagnostics });
  return {
    metadata: parsed.metadata,
    argumentDefinitions: {},
    arguments: {},
    sourceKind: "ruleset",
    ruleSetRouting: defaultRouting,
    mode: "ruleset",
    hostnames,
    files,
    diagnostics,
    report,
  };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function normalizeMode(mode, fetchScripts) {
  if (mode === "aggressive" || mode === "compat" || mode === "safe") return mode;
  return fetchScripts === false ? "safe" : "compat";
}

function normalizeSourceKind(sourceKind, source) {
  const kind = String(sourceKind || "auto").toLowerCase();
  if (kind === "module" || kind === "plugin") return "module";
  if (kind === "ruleset" || kind === "rule-set" || kind === "rule_set") return "ruleset";
  return detectSourceKind(source);
}

function normalizeRuleSetRouting(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "direct" || text === "1") return ROUTING.direct;
  if (text === "reject" || text === "2") return ROUTING.reject;
  return ROUTING.default;
}

function routingGroupName(routing) {
  if (routing === ROUTING.direct) return "Direct";
  if (routing === ROUTING.reject) return "Reject";
  return "Default";
}

function parseArgumentLine(line, rawLine = "", lineNumber = 0) {
  const split = splitFirst(line, "=");
  if (!split) return null;
  const name = split[0].trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return null;
  const fields = parseCsv(split[1]);
  const type = String(fields[0] || "string").trim().toLowerCase();
  const knownType = /^(?:switch|input|text|string|number|select|checkbox)$/i.test(type);
  const defaultValue = knownType ? (fields[1] ?? "") : (fields[0] ?? "");
  const meta = {};
  const optionFields = [];
  for (const field of fields.slice(knownType ? 1 : 0)) {
    const pair = splitFirst(String(field || ""), "=");
    if (pair) {
      const key = pair[0].trim().toLowerCase();
      if (key === "tag" || key === "desc" || key === "description") {
        meta[key === "description" ? "desc" : key] = pair[1].trim();
      }
      continue;
    }
    optionFields.push(field);
  }
  let options = [];
  if (knownType && type === "select") {
    options = optionFields.map((field) => normalizeArgumentValueForType(field, type)).filter((field) => String(field) !== "");
  } else if (knownType && /^(?:switch|checkbox)$/i.test(type)) {
    options = optionFields.slice(0, 2).map((field) => normalizeArgumentValueForType(field, type));
    if (!options.length) options = [true, false];
    else if (options.length === 1) options.push(options[0] === false ? true : false);
  }
  return {
    name,
    type: knownType ? type : "string",
    defaultValue: normalizeArgumentValueForType(defaultValue, knownType ? type : "string"),
    options,
    tag: meta.tag || "",
    desc: meta.desc || "",
    raw: rawLine,
    line: lineNumber,
  };
}

function resolveArgumentValues(argumentDefinitions = {}, overrides = {}) {
  const out = {};
  for (const [name, definition] of Object.entries(argumentDefinitions || {})) {
    out[name] = definition.defaultValue;
  }
  for (const [name, value] of Object.entries(overrides || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) continue;
    out[name] = argumentDefinitions?.[name]
      ? normalizeArgumentValueForType(value, argumentDefinitions[name].type)
      : normalizeArgumentValue(value);
  }
  return out;
}

function resolveItemArguments(item, argumentValues) {
  const enableMatch = item.text.match(/\benable\s*=\s*(?:\{([A-Za-z_][A-Za-z0-9_-]*)\}|([A-Za-z_][A-Za-z0-9_-]*|true|false|1|0))/i);
  if (enableMatch) {
    const key = enableMatch[1] || enableMatch[2];
    const value = Object.prototype.hasOwnProperty.call(argumentValues, key) ? argumentValues[key] : key;
    if (!argumentEnabled(value)) return { enabled: false, argument: key, item };
  }
  return {
    enabled: true,
    item: {
      ...item,
      text: substituteArguments(item.text, argumentValues),
      raw: substituteArguments(item.raw, argumentValues),
    },
  };
}

function substituteArguments(value, argumentValues) {
  return String(value || "").replace(/\{([A-Za-z_][A-Za-z0-9_-]*)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(argumentValues, name)) return match;
    return String(argumentValues[name]);
  });
}

function normalizeArgumentValue(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim();
  if (/^(?:true|1|yes|on)$/i.test(text)) return true;
  if (/^(?:false|0|no|off)$/i.test(text)) return false;
  return text;
}

function normalizeArgumentValueForType(value, type = "string") {
  const normalizedType = String(type || "string").toLowerCase();
  const text = String(value ?? "").trim();
  if (normalizedType === "switch" || normalizedType === "checkbox") return normalizeArgumentValue(value);
  if (normalizedType === "number") return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
  return text;
}

function argumentEnabled(value) {
  if (typeof value === "boolean") return value;
  return /^(?:true|1|yes|on)$/i.test(String(value || "").trim());
}

export function parseModule(source) {
  const metadata = {};
  const diagnostics = [];
  const hostnames = [];
  const args = {};
  const items = [];
  let section = "";
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const raw = rawLine.trim();
    if (!raw) return;

    if (raw.startsWith("#!")) {
      const meta = raw.slice(2).trim();
      const split = splitFirst(meta, "=");
      if (split) metadata[split[0].trim().toLowerCase()] = split[1].trim();
      return;
    }
    if (raw.startsWith("#") || raw.startsWith("//")) return;

    const sectionMatch = raw.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      return;
    }

    const line = stripInlineComment(raw).trim();
    if (!line) return;

    if (section === "MITM") {
      const split = splitFirst(line, "=");
      if (split && split[0].trim().toLowerCase() === "hostname") {
        hostnames.push(...split[1].split(",").map((item) => item.trim()).filter(Boolean));
      }
      return;
    }

    if (/^Arguments?$/i.test(section)) {
      const parsedArgument = parseArgumentLine(line, rawLine, lineNumber);
      if (parsedArgument) args[parsedArgument.name] = parsedArgument;
      else diagnostics.push({ level: "warning", code: "unsupported-argument", message: "暂不支持该 Argument 语法，已忽略。", line: lineNumber, source: rawLine });
      return;
    }

    if (!section) {
      diagnostics.push({ level: "info", code: "outside-section", message: "非 section 内容已忽略。", line: lineNumber, source: rawLine });
      return;
    }

    items.push({ section, text: line, raw: rawLine, line: lineNumber });
  });

  const name = metadata.name || metadata.title || "";
  if (name) metadata.name = name;
  return { metadata, hostnames, arguments: args, items, diagnostics };
}

export function parseRuleSet(source) {
  const metadata = {};
  const diagnostics = [];
  const items = [];
  let insideIgnoredSection = false;
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const raw = rawLine.trim();
    if (!raw) return;
    if (raw.startsWith("#!")) {
      const meta = raw.slice(2).trim();
      const split = splitFirst(meta, "=");
      if (split) metadata[split[0].trim().toLowerCase()] = split[1].trim();
      return;
    }
    if (raw.startsWith("#") || raw.startsWith("//") || raw.startsWith(";")) {
      const metaMatch = raw.match(/^#\s*(name|title|desc|description)\s*[:=]\s*(.+)$/i);
      if (metaMatch) metadata[metaMatch[1].toLowerCase() === "description" ? "desc" : metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      return;
    }

    const sectionMatch = raw.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      insideIgnoredSection = !/^Rule$/i.test(sectionMatch[1].trim());
      return;
    }
    if (insideIgnoredSection) return;

    const withoutComment = stripInlineComment(raw).trim();
    const normalized = normalizeRuleSetCandidateLine(withoutComment);
    if (!normalized || /^(?:payload|rules)\s*:\s*$/i.test(normalized)) return;
    const text = ruleSetLineToRuleText(normalized);
    if (!text) {
      diagnostics.push({ level: "warning", code: "unsupported-ruleset-rule", message: "暂不支持该规则集语法，已跳过。", line: lineNumber, source: rawLine });
      return;
    }
    items.push({ section: "RuleSet", text, raw: rawLine, line: lineNumber });
  });

  const name = metadata.name || metadata.title || metadata.desc || "";
  if (name) metadata.name = name;
  return { metadata, items, diagnostics };
}

function normalizeRuleSetCandidateLine(line) {
  let text = String(line || "").trim();
  if (!text) return "";
  if (text.startsWith("- ")) text = text.slice(2).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function ruleSetLineToRuleText(line) {
  const text = normalizeRuleSetCandidateLine(line);
  if (!text || /^(?:payload|rules)\s*:\s*$/i.test(text)) return "";

  const fields = parseCsv(text);
  const type = normalizeRuleType(fields[0]);
  const value = fields[1]?.trim();
  if (value && (routingRuleForType(type, value, ROUTING.default) || type === "URL-REGEX")) return text;
  if (/^(?:RULE-SET|DOMAIN-SET|IP-CIDR-SET|PROCESS-NAME|USER-AGENT|GEOIP|IP-ASN|SRC-IP-CIDR|DEST-PORT|IN-PORT|AND|OR|NOT)$/i.test(type || "")) return "";

  if (/^\+\.[A-Za-z0-9.-]+$/.test(text)) return `DOMAIN-SUFFIX, ${text.slice(2)}`;
  if (/^\*\.[A-Za-z0-9.-]+$/.test(text)) return `DOMAIN-SUFFIX, ${text.slice(2)}`;
  if (/^\.[A-Za-z0-9.-]+$/.test(text)) return `DOMAIN-SUFFIX, ${text.slice(1)}`;
  if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(text)) return `DOMAIN-SUFFIX, ${text}`;
  if (/^[0-9.]+\/\d{1,2}$/.test(text)) return `IP-CIDR, ${text}`;
  if (/^[0-9A-Fa-f:]+\/\d{1,3}$/.test(text) && text.includes(":")) return `IP-CIDR6, ${text}`;
  return "";
}

function isRuleSetPolicyAction(action = "") {
  const text = String(action || "").trim();
  if (!text || /^no-resolve$/i.test(text)) return false;
  return routeForAction(text) != null || isRejectAction(text);
}

export function emitAmrs(name, hostnames, rules) {
  const lines = [
    `# Generated by Anywhere Loon/Surge converter`,
    `name = ${name}`,
  ];
  if (hostnames.length) lines.push(`hostname = ${hostnames.join(", ")}`);
  lines.push("");
  for (const rule of rules) lines.push(emitMitmRule(rule));
  return lines.join("\n").trimEnd() + "\n";
}

export function emitArrs(name, routing, rules) {
  const lines = [
    `# Generated by Anywhere Loon/Surge converter`,
    `name = ${name}`,
    `routing = ${routing}`,
    "",
  ];
  for (const rule of rules) lines.push(`${rule.type}, ${rule.value}`);
  return lines.join("\n").trimEnd() + "\n";
}

export function validateAnywhereOutput(file) {
  const diagnostics = [];
  const lines = String(file.content || "").replace(/\r\n?/g, "\n").split("\n");
  const isAmrs = file.name?.endsWith(".amrs") || file.type === "amrs";
  const isArrs = file.name?.endsWith(".arrs") || file.type === "arrs";
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//")) continue;
    const equalIndex = raw.indexOf("=");
    const commaIndex = raw.indexOf(",");
    const headerLike = equalIndex >= 0 && (commaIndex < 0 || equalIndex < commaIndex);
    const maybeHeader = headerLike ? raw.split("=", 1)[0].trim().toLowerCase() : "";
    const allowed = isAmrs ? new Set(["name", "hostname"]) : new Set(["name", "routing"]);
    if (maybeHeader) {
      if (!allowed.has(maybeHeader)) diagnostics.push({ level: "error", code: "unknown-header", line: i + 1, message: `当前 Anywhere 不识别 ${maybeHeader} header。` });
      continue;
    }
    if (isAmrs) {
      const result = validateAmrsRuleLine(raw);
      if (result) diagnostics.push({ ...result, line: i + 1 });
    } else if (isArrs) {
      const result = validateArrsRuleLine(raw);
      if (result) diagnostics.push({ ...result, line: i + 1 });
    }
  }
  return diagnostics;
}

function convertRuleLine(item) {
  const logicalAnd = parseLogicalAndUrlRegexReject(item.text);
  if (logicalAnd) {
    const rule = rejectRule(logicalAnd.pattern, rejectContentForAction(logicalAnd.action, logicalAnd.pattern));
    rule.degraded = {
      code: "logical-and-degraded",
      message: "AND 组合中的 USER-AGENT 条件无法在 Anywhere 中直接表达，已按 URL-REGEX 映射，匹配范围略放宽。",
    };
    return { kind: "mitm", rule };
  }

  const fields = parseCsv(item.text);
  const type = normalizeRuleType(fields[0]);
  const value = fields[1]?.trim();
  const action = fields[2]?.trim().toUpperCase();
  if (!type || !value) return null;

  if (type === "URL-REGEX") {
    if (isRejectAction(action)) {
      return { kind: "mitm", rule: rejectRule(value, rejectContentForAction(action, value)) };
    }
    return { kind: "skip", code: "unsupported-url-regex-action", message: `URL-REGEX action ${action || "(empty)"} 不能安全映射。` };
  }

  const routing = routeForAction(action);
  if (routing == null) return { kind: "skip", code: "unsupported-routing-action", message: `Rule action ${action || "(empty)"} 不能映射为 Anywhere 初始 Direct/Reject。` };

  return routingRuleForType(type, value, routing);
}

function convertRuleSetLine(item, defaultRouting) {
  const fields = parseCsv(item.text);
  const type = fields[0]?.trim().toUpperCase();
  const value = fields[1]?.trim();
  const action = fields[2]?.trim();
  if (!type || !value) return null;

  if (type === "URL-REGEX") {
    const explicitAction = isRuleSetPolicyAction(action) ? action : "";
    const routing = explicitAction ? routeForAction(explicitAction) : defaultRouting;
    if (isRejectAction(explicitAction) || routing === ROUTING.reject) {
      return { kind: "mitm", rule: rejectRule(value, rejectContentForAction(explicitAction || "REJECT", value)) };
    }
    return { kind: "skip", code: "unsupported-ruleset-url-regex", message: "URL-REGEX 规则集只有在 REJECT 路由下才能安全转换为 Anywhere MITM reject。" };
  }

  if (isRuleSetPolicyAction(action)) {
    const routing = routeForAction(action);
    if (routing == null) return { kind: "skip", code: "unsupported-ruleset-policy", message: `规则集策略 ${action} 不能映射为 Anywhere 初始 Direct/Reject。` };
    return routingRuleForType(type, value, routing);
  }

  return routingRuleForType(type, value, defaultRouting);
}

function routingRuleForType(type, value, routing) {
  type = normalizeRuleType(type);
  let normalized = "";
  switch (type) {
  case "DOMAIN":
    normalized = normalizeDomain(value);
    if (!normalized) return null;
    return {
      kind: "routing",
      routing,
      rule: {
        type: ROUTING_TYPES.domainSuffix,
        value: normalized,
        degraded: { code: "domain-exact-degraded", message: "Surge/Loon DOMAIN 是精确域名，Anywhere 只能导入 suffix，语义会略放宽。" },
      },
    };
  case "DOMAIN-SUFFIX":
    normalized = normalizeDomain(value);
    if (!normalized) return null;
    return { kind: "routing", routing, rule: { type: ROUTING_TYPES.domainSuffix, value: normalized } };
  case "DOMAIN-WILDCARD":
    normalized = normalizeDomain(value);
    if (!normalized) return null;
    return {
      kind: "routing",
      routing,
      rule: {
        type: ROUTING_TYPES.domainSuffix,
        value: normalized,
        degraded: { code: "domain-wildcard-degraded", message: "DOMAIN-WILDCARD 已按 domain suffix 导入，复杂通配符语义会略放宽。" },
      },
    };
  case "DOMAIN-KEYWORD":
    normalized = normalizeKeyword(value);
    if (!normalized) return null;
    return { kind: "routing", routing, rule: { type: ROUTING_TYPES.domainKeyword, value: normalized } };
  case "IP-CIDR":
    return { kind: "routing", routing, rule: { type: ROUTING_TYPES.ipCIDR, value: normalizeCIDR(value, 4) } };
  case "IP-CIDR6":
  case "IP6-CIDR":
    return { kind: "routing", routing, rule: { type: ROUTING_TYPES.ipCIDR6, value: normalizeCIDR(value, 6) } };
  default:
    return null;
  }
}

function parseLogicalAndUrlRegexReject(line) {
  const text = String(line || "").trim();
  const actionMatch = text.match(/\)\),\s*([A-Za-z-]+)\s*$/);
  if (!actionMatch || !isRejectAction(actionMatch[1])) return null;
  if (!/^AND\s*,/i.test(text) || !/\bUSER-AGENT\b/i.test(text)) return null;
  const urlMatch = text.match(/\(\s*URL-REGEX\s*,\s*("(?:""|[^"])*"|[^),]+)\s*\)/i);
  if (!urlMatch) return null;
  let pattern = urlMatch[1].startsWith('"') ? parseCsv(urlMatch[1])[0] : urlMatch[1].trim();
  if (!pattern) return null;
  pattern = normalizeLogicalAndUrlPattern(pattern);
  return { pattern, action: actionMatch[1] };
}

function normalizeLogicalAndUrlPattern(pattern) {
  const normalized = normalizeUrlPattern(pattern);
  if (/^\^http:\/\/\.\+\/amdc\/mobileDispatch/i.test(normalized)) {
    return "^http://amdc\\.m\\.taobao\\.com/amdc/mobileDispatch(?:\\?|/|$)";
  }
  return pattern;
}

function convertRewriteLine(item) {
  const rawRewrite = parseRewriteCommand(item.text);
  if (rawRewrite?.action === "response-body-replace-regex") {
    return bodyReplaceRule(1, rawRewrite.pattern, splitBodyReplaceParts(rawRewrite.rest));
  }
  if (rawRewrite?.action === "request-body-replace-regex") {
    return bodyReplaceRule(0, rawRewrite.pattern, splitBodyReplaceParts(rawRewrite.rest));
  }
  if (rawRewrite?.action === "mock-response-body") {
    return mockResponseBodyRule(rawRewrite.pattern, rawRewrite.rest);
  }

  const parts = splitCommand(item.text);
  if (parts.length < 2) return null;
  const [pattern, actionMarker, ...restParts] = parts;
  let actionRaw = actionMarker;
  let rest = restParts;
  if (actionRaw === "-" && rest.length) {
    actionRaw = rest[0];
    rest = rest.slice(1);
  }
  const action = actionRaw.toLowerCase();

  if (isRejectAction(action)) return rejectRule(pattern, rejectContentForAction(action, pattern));
  if (action === "302" || action === "redirect" || action === "redirect-302") {
    const target = rest.join(" ").trim();
    if (!target) return null;
    return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["1", target] };
  }
  if (action === "307" || action === "redirect-307") {
    const target = rest.join(" ").trim();
    if (!target) return null;
    return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["1", target], degraded: "307 降级为 Anywhere 302 redirect。" };
  }
  if (action === "url" || action === "rewrite" || action === "header") {
    const target = rest.join(" ").trim();
    if (!target) return null;
    return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["0", target] };
  }
  if (rest.length === 1 && rest[0].toLowerCase() === "header") {
    return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["0", actionMarker] };
  }
  if (action === "response-body-json-jq") {
    return jqToBodyJson(1, pattern, rest.join(" ")) || jqToScriptRule(1, pattern, rest.join(" "));
  }
  if (action === "request-body-json-jq") {
    return jqToBodyJson(0, pattern, rest.join(" ")) || jqToScriptRule(0, pattern, rest.join(" "));
  }
  if (action === "response-body-json-del") {
    return bodyJsonDeleteRules(1, pattern, rest);
  }
  if (action === "request-body-json-del") {
    return bodyJsonDeleteRules(0, pattern, rest);
  }
  if (action === "response-body-json-replace") {
    return bodyJsonReplaceRules(1, pattern, rest);
  }
  if (action === "request-body-json-replace") {
    return bodyJsonReplaceRules(0, pattern, rest);
  }
  if (action === "response-body-replace-regex") {
    return bodyReplaceRule(1, pattern, rest);
  }
  if (action === "request-body-replace-regex") {
    return bodyReplaceRule(0, pattern, rest);
  }
  if (/^(?:request|response)-header-(?:add|del|delete|replace|set)$/.test(action)) {
    return headerRuleFromAction(pattern, action, rest);
  }
  return null;
}

function convertBodyRewriteLine(item) {
  const rawRewrite = parseRewriteCommand(item.text);
  if (rawRewrite?.action === "http-response-replace-regex" || rawRewrite?.action === "response-body-replace-regex") {
    return bodyReplaceRule(1, rawRewrite.pattern, splitBodyReplaceParts(rawRewrite.rest));
  }
  if (rawRewrite?.action === "http-request-replace-regex" || rawRewrite?.action === "request-body-replace-regex") {
    return bodyReplaceRule(0, rawRewrite.pattern, splitBodyReplaceParts(rawRewrite.rest));
  }

  const parts = splitCommand(item.text);
  if (parts.length < 3) return null;
  const type = parts[0].toLowerCase();
  const pattern = parts[1];
  const body = parts.slice(2).join(" ");
  if (type === "http-response-jq") return jqToBodyJson(1, pattern, body) || jqToScriptRule(1, pattern, body);
  if (type === "http-request-jq") return jqToBodyJson(0, pattern, body) || jqToScriptRule(0, pattern, body);
  if (type === "http-response-replace-regex" || type === "response-body-replace-regex") return bodyReplaceRule(1, pattern, parts.slice(2));
  if (type === "http-request-replace-regex" || type === "request-body-replace-regex") return bodyReplaceRule(0, pattern, parts.slice(2));
  return null;
}

function convertMapLocalLine(item) {
  const split = splitLeadingToken(item.text);
  if (!split) return null;
  const [pattern, rest] = split;
  const options = parseKeyValueTokens(rest);
  const dataType = (options["data-type"] || "text").toLowerCase();
  const data = options.data ?? "";
  const diagnostics = [];
  const status = Number(options["status-code"] || 200);
  if (options.header || status !== 200) {
    const nativeRule = mapLocalNativeRuleWithTrivialHeader(pattern, { dataType, data, status, header: options.header || "" });
    if (nativeRule) {
      diagnostics.push({ level: "info", code: "map-local-native-trivial-header", message: "Map Local 仅包含 200/content-type，已映射为原生 fixed body 规则。" });
      return { rule: nativeRule, diagnostics };
    }
    const rule = mapLocalRespondScriptRule(pattern, { dataType, data, status, header: options.header || "" });
    if (!rule) return { code: "map-local-data-type-unsupported", message: `Map Local data-type=${dataType} 不能安全映射。` };
    diagnostics.push({ level: "warning", code: "map-local-script-response", message: "Map Local 需要保留 status/header，已生成 request script 调用 Anywhere.respond；请实机确认 content-type/body 语义。" });
    return { rule, diagnostics };
  }
  if (dataType === "base64") {
    return { rule: { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["4", data] }, diagnostics };
  }
  if (dataType === "tiny-gif" || dataType === "gif") {
    return { rule: { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["3"] }, diagnostics };
  }
  if (dataType === "text" || dataType === "json") {
    return { rule: { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["2", data] }, diagnostics };
  }
  return { code: "map-local-data-type-unsupported", message: `Map Local data-type=${dataType} 不能安全映射。` };
}

function mapLocalNativeRuleWithTrivialHeader(pattern, options) {
  if (options.status !== 200) return null;
  const explicitHeaders = parseExplicitHeaderList(options.header || "");
  if (explicitHeaders.some(([name]) => name !== "content-type")) return null;
  const type = String(options.dataType || "text").toLowerCase();
  if (type === "base64") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["4", options.data] };
  if (type === "tiny-gif" || type === "gif") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["3"] };
  if (type === "text" || type === "json") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["2", options.data] };
  return null;
}

function mapLocalRespondScriptRule(pattern, options) {
  const bodyExpr = mapLocalBodyExpression(options.dataType, options.data);
  if (!bodyExpr) return null;
  const headers = parseHeaderList(options.header || "", options.dataType);
  const status = Number.isFinite(options.status) && options.status > 0 ? options.status : 200;
  const script = `function process(ctx) {
  Anywhere.respond({
    status: ${status},
    headers: ${JSON.stringify(headers)},
    body: ${bodyExpr}
  });
}`;
  return { phase: 0, op: 100, pattern: urlGate(pattern), fields: [base64(script)], scriptSource: script, noScriptMerge: true };
}

function mapLocalBodyExpression(dataType, data) {
  const type = String(dataType || "text").toLowerCase();
  if (type === "text" || type === "json") return JSON.stringify(String(data ?? ""));
  if (type === "base64") return `Anywhere.codec.base64.decode(${JSON.stringify(String(data ?? ""))})`;
  if (type === "tiny-gif" || type === "gif") return `Anywhere.codec.base64.decode("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==")`;
  return "";
}

function parseHeaderList(rawHeader, dataType) {
  const headers = parseExplicitHeaderList(rawHeader);
  if (!headers.some(([name]) => name === "content-type")) {
    const type = String(dataType || "text").toLowerCase() === "json"
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8";
    headers.push(["content-type", type]);
  }
  return headers;
}

function parseExplicitHeaderList(rawHeader) {
  const headers = [];
  for (const item of String(rawHeader || "").split("|")) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const split = splitFirst(trimmed, ":");
    if (!split) continue;
    headers.push([split[0].trim().toLowerCase(), split[1].trim()]);
  }
  return headers;
}

function convertHeaderRewriteLine(item) {
  const parts = splitCommand(item.text);
  if (parts.length < 4) return null;
  const type = parts[0].toLowerCase();
  const phase = type.includes("response") ? 1 : 0;
  const pattern = parts[1];
  const action = parts[2].toLowerCase();
  const name = parts[3];
  const value = parts.slice(4).join(" ");
  if (action === "add" || action === "header-add") return { phase, op: 1, pattern: urlGate(pattern), fields: [name, value] };
  if (action === "delete" || action === "del" || action === "header-delete" || action === "header-del") return { phase, op: 2, pattern: urlGate(pattern), fields: [name] };
  if (action === "replace" || action === "set" || action === "header-replace" || action === "header-set") return { phase, op: 3, pattern: urlGate(pattern), fields: [name, value] };
  return null;
}

function convertScriptLine(item, options) {
  const parsed = parseScriptLine(item.text);
  if (!parsed) return null;
  const diagnostics = [];
  const source = parsed.inlineScript || (parsed.path ? options.scriptTextByURL?.[parsed.path] : "");
  if (!options.fetchScripts && !source) {
    return { code: "script-fetch-disabled", message: "脚本规则已识别；当前未下载远程脚本，启用 fetchScripts 后可用兼容层保留。" };
  }
  if (!source) return { code: "script-source-missing", message: "脚本没有可用 source；请开启脚本下载或提供 scriptTextByURL。" };
  if (options.jsLift !== false) {
    const requestLift = liftRequestMutationScript(source, parsed);
    if (requestLift.length) {
      diagnostics.push({ level: "info", code: "script-request-lift", message: `已将 ${requestLift.length} 个静态 request mutation 提升为 Anywhere 原生请求规则。` });
      return { rule: requestLift.map((rule) => ({ ...rule, pattern: urlGate(parsed.pattern) })), diagnostics };
    }
    const queryRedirect = liftRequestQueryRedirectScript(source, parsed);
    if (queryRedirect) {
      diagnostics.push({ level: "info", code: "script-query-redirect-lift", message: "已将 query 参数 302 redirect 脚本提升为轻量 Anywhere.respond request script。" });
      return { rule: queryRedirect, diagnostics };
    }
    const urlProxy = liftRequestUrlProxyScript(source, parsed);
    if (urlProxy) {
      diagnostics.push({ level: "info", code: "script-url-proxy-lift", message: "已将简单 $done({url}) request 改写脚本提升为轻量 Anywhere.http 代理脚本。" });
      return { rule: urlProxy, diagnostics };
    }
  }
  diagnostics.push(...scanScriptRisk(source, parsed, item.text));
  const hardBlock = diagnostics.find((diagnostic) => diagnostic.level === "error");
  if (hardBlock) return { code: hardBlock.code, message: hardBlock.message };
  if (options.jsLift !== false) {
    const lifted = liftScriptToNativeRules(source, parsed);
    if (lifted.length) {
      diagnostics.push({ level: "info", code: "script-native-lift", message: `已将 ${lifted.length} 个简单 JS body 操作提升为 Anywhere 原生规则；未执行任意 JS 语义猜测。` });
      return { rule: lifted.map((rule) => ({ ...rule, pattern: urlGate(parsed.pattern) })), diagnostics };
    }
    const guardedLifted = liftGuardedJsonBranchRules(source, parsed, { aggressive: false });
    if (guardedLifted.length) {
      diagnostics.push({ level: "info", code: "script-native-lift", message: `已将 ${guardedLifted.length} 个 URL 分支内静态 JSON 操作提升为 Anywhere 原生规则；未执行任意 JS 语义猜测。` });
      return { rule: guardedLifted, diagnostics };
    }
    if (options.mode === "aggressive") {
      const aggressiveLifted = liftAggressiveScriptToNativeRules(source, parsed);
      if (aggressiveLifted.length) {
        diagnostics.push({ level: "info", code: "script-aggressive-native-lift", message: `aggressive 模式已将 ${aggressiveLifted.length} 个 URL 分支内静态 JSON 操作提升为 Anywhere 原生规则。` });
        return { rule: aggressiveLifted, diagnostics };
      }
    }
    const respond = liftRequestRespondScript(source, parsed);
    if (respond) {
      diagnostics.push({ level: "info", code: "script-respond-lift", message: "已将固定 $done({ response }) 脚本提升为轻量 Anywhere.respond request script。" });
      return { rule: respond, diagnostics };
    }
  }
  const wrapped = wrapLoonSurgeScript(source, parsed);
  diagnostics.push({ level: "warning", code: "script-compat-layer", message: "脚本已用轻量 Loon/Surge 兼容层包装；复杂网络请求、二进制/protobuf 或平台 API 仍需实机验证。" });
  return {
    rule: { phase: parsed.phase, op: 100, pattern: urlGate(parsed.pattern), fields: [base64(wrapped)], scriptSource: wrapped, requiresBody: parsed.requiresBody },
    diagnostics,
  };
}

function parseScriptLine(line) {
  const split = splitFirst(line, "=");
  let body = line;
  if (split && /\btype\s*=/.test(split[1])) body = split[1];

  if (/\btype\s*=/.test(body)) {
    const options = parseKeyValueTokens(body);
    const phase = options.type === "http-request" ? 0 : options.type === "http-response" ? 1 : null;
    if (phase == null || !options.pattern) return null;
    return {
      phase,
      pattern: options.pattern,
      path: options["script-path"],
      inlineScript: options.script || "",
      argument: options.argument || "",
      binaryBodyMode: isTruthy(options["binary-body-mode"]),
      requiresBody: isTruthy(options["requires-body"]),
      timeoutMs: normalizeScriptTimeout(options.timeout),
    };
  }

  const parts = splitCommand(body);
  const type = parts[0]?.toLowerCase();
  const phase = type === "http-request" ? 0 : type === "http-response" ? 1 : null;
  if (phase == null || !parts[1]) return null;
  const options = parseKeyValueTokens(parts.slice(2).join(" "));
  return {
    phase,
    pattern: parts[1],
    path: options["script-path"],
    inlineScript: options.script || "",
    argument: options.argument || "",
    binaryBodyMode: isTruthy(options["binary-body-mode"]),
    requiresBody: isTruthy(options["requires-body"]),
    timeoutMs: normalizeScriptTimeout(options.timeout),
  };
}

function normalizeScriptTimeout(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 4500;
  const milliseconds = value <= 120 ? value * 1000 : value;
  return Math.min(10000, Math.max(1000, Math.round(milliseconds)));
}

function scanScriptRisk(source, parsed, rawLine) {
  const diagnostics = [];
  if (/\b(?:importScripts|import\s*\()/.test(source) || /^\s*import\s.+from\s+["']/m.test(source)) {
    diagnostics.push({ level: "error", code: "script-import", message: "脚本依赖 import/importScripts，Worker 在线兼容层不能安全转换。" });
  } else if (/\brequire\s*\(/.test(source)) {
    diagnostics.push({ level: "warning", code: "script-node-require-branch", message: "脚本包含 require 调用；常见 Env 模板的 Node.js 分支可保留，但需实机验证未执行该分支。" });
  }
  const codeWithoutStrings = stripJsStrings(stripJsComments(source));
  if (/\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(/.test(codeWithoutStrings)) {
    diagnostics.push({ level: "warning", code: "script-dynamic-sample-required", message: "脚本运行时可能执行 eval/new Function 动态代码，已保留但需要样本和实机验证。" });
  }
  if (parsed.phase === 0 && /\$done\s*\(\s*\{(?!\s*response\s*:)[\s\S]{0,300}?(?:\burl\b\s*(?=[,}])|(?:url|headers|method)\s*:)/.test(source)) {
    diagnostics.push({ level: "error", code: "request-mutation-script", message: "request 脚本尝试修改 url/headers/method，Anywhere 脚本语义不能直接表达。" });
  }
  if (/\$httpClient\b|\$task\s*\.\s*fetch\b|\.request\s*\(/.test(source)) {
    diagnostics.push({ level: "warning", code: "script-http-client", message: "脚本使用外部 HTTP 请求，会 park 当前连接并受 Anywhere.http 预算/超时限制。" });
  }
  if (parsed.argument && !/\$argument\b/.test(codeWithoutStrings)) {
    diagnostics.push({ level: "warning", code: "script-argument-unused", message: "规则声明了脚本参数，但源码没有读取 $argument；对应参数开关可能不会影响脚本行为。" });
  }
  if (parsed.binaryBodyMode || /protobuf|Uint8Array|ArrayBuffer|DataView/i.test(source) || /binary-body-mode\s*=\s*1/i.test(rawLine)) {
    diagnostics.push({ level: "warning", code: "script-binary-sample-required", message: "脚本涉及二进制/protobuf，已保留但需要样本和实机验证。" });
  }
  if (source.length > 512 * 1024) {
    diagnostics.push({ level: "warning", code: "script-large", message: "脚本体积超过 512 KiB，可能影响 Worker 转换和 Anywhere 运行性能。" });
  }
  return diagnostics;
}

function liftScriptToNativeRules(source, parsed) {
  if (parsed.phase !== 1 || parsed.binaryBodyMode) return [];
  const text = stripJsComments(String(source || ""));
  if (!hasBodyCompletion(text)) return [];
  const recursiveDeleteRules = liftRecursiveDeleteRules(text);
  if (recursiveDeleteRules.length) return recursiveDeleteRules;
  if (hasControlFlow(text)) return [];

  const bodyReplace = liftBodyReplaceScript(text);
  if (bodyReplace) return [bodyReplace];

  const jsonRules = liftJsonMutationScript(text);
  return jsonRules.length ? jsonRules : [];
}

function liftRequestRespondScript(source, parsed) {
  if (parsed.phase !== 0) return null;
  const text = stripJsComments(String(source || ""));
  if (hasControlFlow(text) || /=>/.test(stripJsStrings(text))) return null;
  const responseBody = extractDoneResponseObject(text);
  if (!responseBody) return null;
  const status = propertyValueFromObjectLiteral(responseBody, ["status", "statusCode"]);
  const body = propertyValueFromObjectLiteral(responseBody, ["body"]) ?? "\"\"";
  const headers = propertyValueFromObjectLiteral(responseBody, ["headers"]) ?? "{}";
  const statusValue = status && /^\d+$/.test(status.trim()) ? Number(status.trim()) : 200;
  const bodyValue = parseJsStringForBodyReplace(body);
  const headerPairs = parseStaticHeadersLiteral(headers);
  if (bodyValue == null || !headerPairs) return null;
  const script = `function process(ctx) {
  Anywhere.respond({
    status: ${statusValue},
    headers: ${JSON.stringify(headerPairs)},
    body: ${JSON.stringify(bodyValue)}
  });
}`;
  return { phase: 0, op: 100, pattern: urlGate(parsed.pattern), fields: [base64(script)], scriptSource: script, noScriptMerge: true };
}

function liftRequestMutationScript(source, parsed) {
  if (parsed.phase !== 0) return [];
  const text = stripJsComments(String(source || ""));
  if (!/\$done\s*\(\s*(?:\$request|\{[\s\S]*?\})\s*\)\s*;?\s*$/.test(text)) return [];
  if (hasControlFlow(text) || /=>|\$httpClient\b/.test(stripJsStrings(text))) return [];
  const constants = extractLiteralConstants(text);
  const rules = [];

  const doneObject = extractDoneRequestObject(text);
  if (doneObject) {
    const doneUrl = propertyValueFromObjectLiteral(doneObject, ["url"]);
    const target = parseJsStringForBodyReplace(doneUrl) ?? constants.get(doneUrl);
    if (target) rules.push({ phase: 0, op: 0, pattern: "", fields: ["0", target] });

    const doneHeaders = propertyValueFromObjectLiteral(doneObject, ["headers"]);
    const headerPairs = parseStaticHeadersLiteral(doneHeaders);
    if (headerPairs) {
      for (const [name, value] of headerPairs) rules.push({ phase: 0, op: 3, pattern: "", fields: [name, value] });
    }
  }

  const urlMatch = text.match(/\$request\.url\s*=\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*;?/);
  if (urlMatch) {
    const target = parseJsStringForBodyReplace(urlMatch[1]) ?? constants.get(urlMatch[1]);
    if (target) rules.push({ phase: 0, op: 0, pattern: "", fields: ["0", target] });
  }

  const urlReplaceMatch = text.match(/\$request\.url\s*=\s*\$request\.url\.replace\s*\(\s*\/((?:\\\/|[^/])+)\/[a-z]*\s*,\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*\)\s*;?/);
  if (urlReplaceMatch) {
    const target = parseJsStringForBodyReplace(urlReplaceMatch[2]) ?? constants.get(urlReplaceMatch[2]);
    if (target && /^https?:\/\//i.test(target)) rules.push({ phase: 0, op: 0, pattern: "", fields: ["0", target] });
  }

  const headerSetPattern = /\$request\.headers(?:\[\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*\]|\.([A-Za-z_$][\w$-]*))\s*=\s*(["'][^"']*["']|[A-Za-z_$][\w$]*)\s*;?/g;
  for (const match of text.matchAll(headerSetPattern)) {
    const name = parseJsStringForBodyReplace(match[1]) || constants.get(match[1]) || match[2];
    const value = parseJsStringForBodyReplace(match[3]) ?? constants.get(match[3]);
    if (name && value != null) rules.push({ phase: 0, op: 3, pattern: "", fields: [name, value] });
  }

  const headerDeletePattern = /delete\s+\$request\.headers(?:\[\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*\]|\.([A-Za-z_$][\w$-]*))\s*;?/g;
  for (const match of text.matchAll(headerDeletePattern)) {
    const name = parseJsStringForBodyReplace(match[1]) || constants.get(match[1]) || match[2];
    if (name) rules.push({ phase: 0, op: 2, pattern: "", fields: [name] });
  }

  const headerAssignPattern = /Object\.assign\s*\(\s*\$request\.headers\s*,\s*(\{[\s\S]*?\})\s*\)\s*;?/g;
  for (const match of text.matchAll(headerAssignPattern)) {
    const headerPairs = parseStaticHeadersLiteral(match[1]);
    if (!headerPairs) continue;
    for (const [name, value] of headerPairs) rules.push({ phase: 0, op: 3, pattern: "", fields: [name, value] });
  }

  return rules;
}

function liftRequestQueryRedirectScript(source, parsed) {
  if (parsed.phase !== 0) return null;
  const text = stripJsComments(String(source || ""));
  const stripped = stripJsStrings(text);
  if (!/\$request\.url/.test(text) || !/decodeURIComponent\s*\(/.test(text)) return null;
  if (!/\$done\s*\(\s*\{\s*response\s*:/.test(text)) return null;
  if (!/\bstatus\s*:\s*302\b/.test(text)) return null;
  if (!/\bLocation\s*:/.test(text) && !/["']location["']\s*:/i.test(text)) return null;
  if (/\$httpClient\b|\$task\b|\b(?:fetch|XMLHttpRequest|eval|Function)\b/.test(stripped)) return null;
  const params = extractRedirectQueryParams(text);
  if (!params.length) return null;
  const script = `function process(ctx) {
  if (ctx.phase !== "request" || !ctx.url) return;
  var query = String(ctx.url).split("?")[1] || "";
  var params = ${JSON.stringify(params)};
  for (var i = 0; i < params.length; i++) {
    var match = query.match(new RegExp("(?:^|&)" + params[i] + "=([^&]+)"));
    if (!match) continue;
    try {
      var target = decodeURIComponent(match[1]);
      if (!/^https?:\\/\\//.test(target)) return;
      Anywhere.respond({
        status: 302,
        headers: [["location", target], ["cache-control", "no-cache"]],
        body: ""
      });
      return;
    } catch (_) {}
  }
}`;
  return { phase: 0, op: 100, pattern: urlGate(parsed.pattern), fields: [base64(script)], scriptSource: script, noScriptMerge: true };
}

function liftRequestUrlProxyScript(source, parsed) {
  if (parsed.phase !== 0) return null;
  const text = stripJsComments(String(source || ""));
  const stripped = stripJsStrings(text);
  if (!/\$request\.url/.test(text)) return null;
  if (!/\$done\s*\(\s*\{\s*(?:url\b|url\s*:)/.test(text)) return null;
  if (/\$httpClient\b|\$task\b|\b(?:fetch|XMLHttpRequest|eval|Function|importScripts|require)\b/.test(stripped)) return null;

  const variableMatch = text.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\$request\.url\s*;?/);
  if (!variableMatch) return null;
  const variable = variableMatch[1];
  const doneObject = extractDoneRequestObject(text);
  if (!doneObject) return null;
  const doneUrl = propertyValueFromObjectLiteral(doneObject, ["url"]);
  const doneUsesVariable = doneUrl
    ? doneUrl.trim() === variable
    : new RegExp(`(?:^|,)\\s*${escapeRegExp(variable)}\\s*(?:,|$)`).test(doneObject);
  if (!doneUsesVariable) return null;

  const replacements = extractUrlVariableReplacements(text, variable);
  if (!replacements.length) return null;
  const bodyWithoutStrings = stripJsStrings(text);
  if (/\$request\.url\s*=|\$request\.headers|\$request\.method/.test(bodyWithoutStrings)) return null;
  if (!hasOnlySupportedUrlAssignments(bodyWithoutStrings, variable)) return null;

  const script = `async function process(ctx) {
  if (ctx.phase !== "request" || !ctx.url) return;
  var target = String(ctx.url);
  var replacements = ${JSON.stringify(replacements)};
  for (var i = 0; i < replacements.length; i++) {
    var item = replacements[i];
    if (item.kind === "regex") {
      target = target.replace(new RegExp(item.search, item.flags || ""), item.replacement);
    } else {
      target = target.replace(item.search, item.replacement);
    }
  }
  if (target === ctx.url || !/^https?:\\/\\//i.test(target)) return;
  var headers = [];
  (ctx.headers || []).forEach(function (header) {
    var name = String(header[0] || "");
    var lower = name.toLowerCase();
    if (!name || lower === "host" || lower === "content-length" || lower === "connection") return;
    headers.push([name, String(header[1] || "")]);
  });
  try {
    var res = await Anywhere.http.request({
      url: target,
      method: ctx.method || "GET",
      headers: headers,
      body: ctx.body,
      timeout: 8000,
      redirect: "follow"
    });
    Anywhere.respond({
      status: res.status || 200,
      headers: res.headers || [],
      body: res.body || new Uint8Array()
    });
  } catch (_) {}
}`;
  return { phase: 0, op: 100, pattern: urlGate(parsed.pattern), fields: [base64(script)], scriptSource: script, noScriptMerge: true };
}

function extractUrlVariableReplacements(text, variable) {
  const out = [];
  const pattern = new RegExp(`\\b${escapeRegExp(variable)}\\s*=\\s*${escapeRegExp(variable)}\\.replace\\s*\\(\\s*(\\/((?:\\\\\\/|[^/])+)\\/([a-z]*)|(["'][^"']*["']))\\s*,\\s*(["'][^"']*["'])\\s*\\)\\s*;?`, "g");
  for (const match of text.matchAll(pattern)) {
    const replacement = parseJsStringForBodyReplace(match[5]);
    if (replacement == null) continue;
    if (match[2] != null) {
      out.push({ kind: "regex", search: match[2].replaceAll("\\/", "/"), flags: match[3] || "", replacement });
    } else {
      const search = parseJsStringForBodyReplace(match[4]);
      if (search != null) out.push({ kind: "string", search, replacement });
    }
  }
  return out;
}

function hasOnlySupportedUrlAssignments(text, variable) {
  const assignment = new RegExp(`\\b${escapeRegExp(variable)}\\s*=`, "g");
  for (const match of text.matchAll(assignment)) {
    const start = match.index;
    const before = text.slice(Math.max(0, start - 16), start);
    const after = text.slice(start + match[0].length);
    if (/(?:const|let|var)\s+$/.test(before) && /^\s*\$request\.url\b/.test(after)) continue;
    if (new RegExp(`^\\s*${escapeRegExp(variable)}\\.replace\\s*\\(`).test(after)) continue;
    return false;
  }
  return true;
}

function extractRedirectQueryParams(text) {
  const params = new Set();
  for (const match of text.matchAll(/\.match\s*\(\s*\/((?:\\\/|[^/])+)\/[a-z]*\s*\)/g)) {
    const source = match[1].replaceAll("\\/", "/");
    for (const item of source.matchAll(/([A-Za-z0-9_-]+)=\(\[\^&]\+\)/g)) params.add(item[1]);
  }
  if (!params.size && /\bdecodeURIComponent\s*\(\s*[^)]+\[1]\s*\)/.test(text)) {
    for (const name of ["url", "target", "u"]) {
      if (new RegExp(`${name}=\\\\?\\(\\[\\^&]\\+\\\\?\\)|${name}=\\(\\[\\^&]\\+\\)`).test(text)) params.add(name);
    }
  }
  return [...params];
}

function extractLiteralConstants(text) {
  const out = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'][^"']*["'])\s*;?/g;
  for (const match of text.matchAll(pattern)) {
    const value = parseJsStringForBodyReplace(match[2]);
    if (value != null) out.set(match[1], value);
  }
  return out;
}

function extractRuleLiteralConstants(text) {
  const out = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)\s*;?/g;
  for (const match of text.matchAll(pattern)) {
    const value = parseJsLiteralForRule(match[2]);
    if (value != null) out.set(match[1], value);
  }
  return out;
}

function extractDoneRequestObject(text) {
  const marker = text.match(/\$done\s*\(\s*\{/);
  if (!marker) return "";
  const openIndex = marker.index + marker[0].lastIndexOf("{");
  const closeIndex = findMatchingBrace(text, openIndex);
  if (closeIndex < 0) return "";
  const rest = text.slice(closeIndex + 1).trim();
  if (!/^\)\s*;?\s*$/.test(rest)) return "";
  const body = text.slice(openIndex + 1, closeIndex);
  if (/^\s*response\s*:/.test(body)) return "";
  return body;
}

function extractDoneResponseObject(text) {
  const marker = text.match(/\$done\s*\(\s*\{\s*response\s*:\s*\{/);
  if (!marker) return "";
  const openIndex = marker.index + marker[0].lastIndexOf("{");
  const closeIndex = findMatchingBrace(text, openIndex);
  if (closeIndex < 0) return "";
  const rest = text.slice(closeIndex + 1).trim();
  if (!/^\}\s*\)\s*;?\s*$/.test(rest)) return "";
  return text.slice(openIndex + 1, closeIndex);
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = "";
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function liftBodyReplaceScript(text) {
  const match = text.match(/\$response\.body\s*=\s*\$response\.body\.replace\s*\(\s*\/((?:\\\/|[^/])+)\/[a-z]*\s*,\s*([^)]+?)\s*\)\s*;?/);
  if (!match) return null;
  const replacement = parseJsStringForBodyReplace(match[2]);
  if (replacement == null) return null;
  return { phase: 1, op: 4, pattern: "", fields: [match[1].replaceAll("\\/", "/"), replacement] };
}

function liftJsonMutationScript(text) {
  const variable = findJsonParseVariable(text);
  if (!variable) return [];
  if (!hasJsonBodyOutput(text, variable)) return [];

  return liftJsonMutationRulesFromText(text, variable);
}

function hasBodyCompletion(text) {
  return /\$done\s*\(\s*\{[^}]*\bbody\s*:/.test(text)
    || /\$response\.body\s*=/.test(text) && /\$done\s*\(\s*(?:\{\s*\}|\$response)\s*\)/.test(text);
}

function hasJsonBodyOutput(text, variable) {
  const name = escapeRegExp(variable);
  return new RegExp(`\\$done\\s*\\(\\s*\\{[^}]*\\bbody\\s*:\\s*JSON\\.stringify\\s*\\(\\s*${name}\\s*\\)`).test(text)
    || new RegExp(`\\$response\\.body\\s*=\\s*JSON\\.stringify\\s*\\(\\s*${name}\\s*\\)\\s*;?[\\s\\S]*?\\$done\\s*\\(\\s*(?:\\{\\s*\\}|\\$response)\\s*\\)`).test(text)
    || new RegExp(`JSON\\.stringify\\s*\\(\\s*${name}\\s*\\)`).test(text) && /\$done\s*\(\s*\{[^}]*\bbody\s*:/.test(text);
}

function liftJsonMutationRulesFromText(text, variable) {
  const rules = [];
  const filterRules = liftJsonFilterRules(text, variable);
  rules.push(...filterRules);
  const literalConstants = extractRuleLiteralConstants(text);

  const deletePattern = new RegExp(`\\bdelete\\s+${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\s*;`, "g");
  for (const match of text.matchAll(deletePattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    if (path) rules.push({ phase: 1, op: 5, pattern: "", fields: ["delete", path] });
  }

  const assignPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\s*=\\s*([^;]+?)\\s*;`, "g");
  for (const match of text.matchAll(assignPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    const value = parseJsLiteralForRule(match[2]) ?? literalConstants.get(match[2].trim());
    if (path && value != null) rules.push({ phase: 1, op: 5, pattern: "", fields: ["replace", path, value] });
  }

  const lengthZeroPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\.length\\s*=\\s*0\\s*;`, "g");
  for (const match of text.matchAll(lengthZeroPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    if (path) rules.push({ phase: 1, op: 5, pattern: "", fields: ["replace", path, "[]"] });
  }

  return rules;
}

function liftGuardedJsonBranchRules(source, parsed, { aggressive = false } = {}) {
  if (parsed.phase !== 1 || parsed.binaryBodyMode) return [];
  const text = stripJsComments(String(source || ""));
  if (!hasBodyCompletion(text)) return [];
  const variable = findJsonParseVariable(text);
  if (!variable) return [];
  if (!hasJsonBodyOutput(text, variable)) return [];
  const stripped = stripJsStrings(text);
  if (/\b(?:fetch|XMLHttpRequest|eval|Function|importScripts|require)\b|\$httpClient\b|\$task\s*\.\s*fetch\b/.test(stripped)) return [];

  const rules = [];
  const urlVariables = findRequestUrlVariables(text);
  for (const block of extractIfBlocks(text)) {
    const branchPattern = urlGuardToPattern(block.condition, parsed.pattern, urlVariables);
    if (!branchPattern) continue;
    const strippedBody = stripJsStrings(block.body);
    if (hasUnsafeBranchControlFlow(block.body) || /=>\s*\{/.test(strippedBody)) continue;
    if (new RegExp(`\\b(?!if\\b)[A-Za-z_$][\\w$]*\\s*\\(\\s*${escapeRegExp(variable)}\\b`).test(stripJsStrings(block.body))) continue;
    if (new RegExp(`\\b${escapeRegExp(variable)}\\s*=`).test(stripJsStrings(block.body))) continue;
    let branchRules = aggressive
      ? liftAggressiveJsonMutationRulesFromText(block.body, variable)
      : liftJsonMutationRulesFromText(block.body, variable);
    if (/\bif\b/.test(strippedBody)) branchRules = branchRules.filter((rule) => rule.fields[0] === "delete");
    for (const rule of branchRules) {
      rules.push({ ...rule, pattern: branchPattern });
    }
  }
  return rules;
}

function liftAggressiveScriptToNativeRules(source, parsed) {
  if (parsed.phase !== 1 || parsed.binaryBodyMode) return [];
  const text = stripJsComments(String(source || ""));
  const variable = findJsonParseVariable(text);
  if (!variable) return [];
  if (!hasBodyCompletion(text) || !hasJsonBodyOutput(text, variable)) return [];
  const stripped = stripJsStrings(text);
  if (/\b(?:fetch|XMLHttpRequest|eval|Function|importScripts|require)\b|\$httpClient\b|\$task\s*\.\s*fetch\b/.test(stripped)) return [];

  const guarded = liftGuardedJsonBranchRules(source, parsed, { aggressive: true });
  if (guarded.length) return guarded;
  if (hasControlFlow(text)) return [];
  return liftAggressiveJsonMutationRulesFromText(text, variable).map((rule) => ({ ...rule, pattern: urlGate(parsed.pattern) }));
}

function liftAggressiveJsonMutationRulesFromText(text, variable) {
  const rules = liftJsonMutationRulesFromText(text, variable);
  const spliceClearPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\.splice\\s*\\(\\s*0\\s*(?:,\\s*${escapeRegExp(variable)}\\1\\.length\\s*)?\\)\\s*;`, "g");
  for (const match of text.matchAll(spliceClearPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    if (path) rules.push({ phase: 1, op: 5, pattern: "", fields: ["replace", path, "[]"] });
  }
  return rules;
}

function extractIfBlocks(text) {
  const blocks = [];
  for (let i = 0; i < text.length; i++) {
    if (!/\bif\b/.test(text.slice(i, i + 2))) continue;
    const before = text[i - 1] || "";
    const after = text[i + 2] || "";
    if (/[\w$]/.test(before) || /[\w$]/.test(after)) continue;
    let cursor = i + 2;
    while (/\s/.test(text[cursor] || "")) cursor += 1;
    if (text[cursor] !== "(") continue;
    const conditionEnd = findMatchingParen(text, cursor);
    if (conditionEnd < 0) continue;
    let blockStart = conditionEnd + 1;
    while (/\s/.test(text[blockStart] || "")) blockStart += 1;
    if (text[blockStart] !== "{") continue;
    const blockEnd = findMatchingBrace(text, blockStart);
    if (blockEnd < 0) continue;
    blocks.push({
      condition: text.slice(cursor + 1, conditionEnd),
      body: text.slice(blockStart + 1, blockEnd),
    });
    i = blockEnd;
  }
  return blocks;
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  let quote = "";
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findJsonParseVariable(text) {
  const direct = text.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*JSON\.parse\s*\(\s*\$response\.body\s*\)\s*;?/);
  if (direct) return direct[1];
  const aliasPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\$response\.body\s*;?/g;
  for (const alias of text.matchAll(aliasPattern)) {
    const parsed = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*JSON\\.parse\\s*\\(\\s*${escapeRegExp(alias[1])}\\s*\\)\\s*;?`).exec(text);
    if (parsed) return parsed[1];
  }
  return "";
}

function findRequestUrlVariables(text) {
  const variables = ["\\$request\\.url"];
  const aliasPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\$request\.url\s*;?/g;
  for (const match of text.matchAll(aliasPattern)) variables.push(escapeRegExp(match[1]));
  return variables;
}

function urlGuardToPattern(condition, basePattern, urlVariables = ["\\$request\\.url"]) {
  const text = String(condition || "").trim();
  const urlRef = `(?:${urlVariables.join("|")})`;
  let match = text.match(new RegExp(`${urlRef}\\s*\\.\\s*includes\\s*\\(\\s*(["'][^"']+["'])\\s*\\)`));
  if (match) {
    const literal = unquote(match[1]);
    if (!urlGuardLikelyOverlapsBase(basePattern, literal)) return "";
    return intersectUrlPattern(basePattern, escapeRegExp(literal));
  }

  match = text.match(new RegExp(`${urlRef}\\s*\\.\\s*indexOf\\s*\\(\\s*(["'][^"']+["'])\\s*\\)\\s*(!==|!=|>=|>)\\s*(-?1|0)`));
  if (match && ((/!?==/.test(match[2]) && match[3] === "-1") || (/^>=?$/.test(match[2]) && match[3] === "0"))) {
    const literal = unquote(match[1]);
    if (!urlGuardLikelyOverlapsBase(basePattern, literal)) return "";
    return intersectUrlPattern(basePattern, escapeRegExp(literal));
  }

  match = text.match(new RegExp(`/((?:\\\\/|[^/])+)/([a-z]*)\\s*\\.\\s*test\\s*\\(\\s*${urlRef}\\s*\\)`));
  if (match && !(match[2] || "")) return intersectUrlPattern(basePattern, match[1].replaceAll("\\/", "/"));

  match = text.match(new RegExp(`${urlRef}\\s*\\.\\s*match\\s*\\(\\s*/((?:\\\\/|[^/])+)/([a-z]*)\\s*\\)`));
  if (match && !(match[2] || "")) return intersectUrlPattern(basePattern, match[1].replaceAll("\\/", "/"));

  return "";
}

function urlGuardLikelyOverlapsBase(basePattern, guardLiteral) {
  const guard = String(guardLiteral || "");
  if (!guard.startsWith("/")) return true;
  const guardSegment = firstLiteralPathSegment(guard);
  if (!guardSegment) return true;
  const baseSegment = firstLiteralPathSegment(normalizeRegexPathForOverlap(basePattern));
  if (!baseSegment) return true;
  return guardSegment === baseSegment || guard.includes(`/${baseSegment}`) || normalizeRegexPathForOverlap(basePattern).includes(`/${guardSegment}`);
}

function firstLiteralPathSegment(value) {
  const text = String(value || "");
  const pathStart = text.startsWith("/") ? 0 : text.indexOf("://") >= 0 ? text.indexOf("/", text.indexOf("://") + 3) : text.indexOf("/");
  if (pathStart < 0) return "";
  const rest = text.slice(pathStart + 1);
  const match = rest.match(/^([A-Za-z0-9_$-]+)/);
  return match ? match[1] : "";
}

function normalizeRegexPathForOverlap(pattern) {
  return String(pattern || "")
    .replace(/\\\//g, "/")
    .replace(/\\([.?+*()[\]{}|^-])/g, "$1")
    .replace(/\(\?:/g, "(");
}

function intersectUrlPattern(basePattern, guardPattern) {
  const base = urlGate(basePattern);
  const baseLookahead = base.startsWith("^") ? base.slice(1) : `.*(?:${base})`;
  return `^(?=${baseLookahead})(?=.*(?:${guardPattern})).*`;
}

function liftRecursiveDeleteRules(text) {
  const parseMatch = text.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*JSON\.parse\s*\(\s*\$response\.body\s*\)\s*;?/);
  if (!parseMatch) return [];
  const rootVariable = parseMatch[1];
  if (!new RegExp(`JSON\\.stringify\\s*\\(\\s*${escapeRegExp(rootVariable)}\\s*\\)`).test(text)) return [];

  const functionMatch = text.match(/function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/);
  if (!functionMatch) return [];
  const fnName = functionMatch[1];
  const paramName = functionMatch[2];
  const openIndex = functionMatch.index + functionMatch[0].lastIndexOf("{");
  const closeIndex = findMatchingBrace(text, openIndex);
  if (closeIndex < 0) return [];
  const body = text.slice(openIndex + 1, closeIndex);
  const after = text.slice(closeIndex + 1);
  if (!new RegExp(`\\b${escapeRegExp(fnName)}\\s*\\(\\s*${escapeRegExp(rootVariable)}\\s*\\)\\s*;?`).test(after)) return [];
  if (!isTrivialRecursiveTraversal(body, fnName, paramName)) return [];

  const fields = [];
  const deletePattern = new RegExp(`\\bdelete\\s+${escapeRegExp(paramName)}\\.([A-Za-z_$][\\w$-]*)\\s*;?`, "g");
  for (const match of body.matchAll(deletePattern)) fields.push(match[1]);
  return uniqueStrings(fields).map((field) => ({ phase: 1, op: 5, pattern: "", fields: ["delete-recursive", field] }));
}

function isTrivialRecursiveTraversal(body, fnName, paramName) {
  const stringsStripped = stripJsStrings(body);
  if (/\b(?:fetch|eval|Function|XMLHttpRequest|setTimeout|setInterval)\b|\$httpClient\b|\$task\b/.test(stringsStripped)) return false;
  if (new RegExp(`${escapeRegExp(paramName)}\\s*=`).test(stringsStripped)) return false;
  if (new RegExp(`\\breturn\\s+(?!;)`).test(stringsStripped)) return false;
  const keyTraversal = new RegExp(`Object\\.keys\\s*\\(\\s*${escapeRegExp(paramName)}\\s*\\)\\.forEach[\\s\\S]*?${escapeRegExp(fnName)}\\s*\\(\\s*${escapeRegExp(paramName)}\\s*\\[[^\\]]+\\]\\s*\\)`);
  const forInTraversal = new RegExp(`for\\s*\\([^)]*\\s+in\\s+${escapeRegExp(paramName)}\\s*\\)[\\s\\S]*?${escapeRegExp(fnName)}\\s*\\(\\s*${escapeRegExp(paramName)}\\s*\\[[^\\]]+\\]\\s*\\)`);
  return keyTraversal.test(body) || forInTraversal.test(body);
}

function liftJsonFilterRules(text, variable) {
  const rules = [];
  const multiFilterPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\s*=\\s*${escapeRegExp(variable)}\\1\\.filter\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*=>\\s*([^)]+?)\\s*\\)\\s*;`, "g");
  for (const match of text.matchAll(multiFilterPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    if (!path) continue;
    const parsed = parseSameFieldExclusionFilter(match[3], match[2]);
    if (parsed) rules.push({ phase: 1, op: 5, pattern: "", fields: ["remove-where-field-in", path, parsed.field, JSON.stringify(parsed.values)] });
  }

  const includesFilterPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\s*=\\s*${escapeRegExp(variable)}\\1\\.filter\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*=>\\s*!\\s*\\[([^\\]]+)\\]\\.includes\\s*\\(\\s*\\2\\.([A-Za-z_$][\\w$]*)\\s*\\)\\s*\\)\\s*;`, "g");
  for (const match of text.matchAll(includesFilterPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    const values = parseArrayLiteralValues(match[3]);
    if (path && values) rules.push({ phase: 1, op: 5, pattern: "", fields: ["remove-where-field-in", path, match[4], JSON.stringify(values)] });
  }

  const filterPattern = new RegExp(`${escapeRegExp(variable)}((?:\\.[A-Za-z_$][\\w$]*|\\[['"][^'"]+['"]\\])+?)\\s*=\\s*${escapeRegExp(variable)}\\1\\.filter\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*=>\\s*\\2\\.([A-Za-z_$][\\w$]*)\\s*(!==|===)\\s*(["'][^"']+["']|-?\\d+(?:\\.\\d+)?|true|false|null)\\s*\\)\\s*;`, "g");
  for (const match of text.matchAll(filterPattern)) {
    const path = jsonPathFromJsAccess(match[1]);
    const field = match[3];
    const operator = match[4];
    const literal = parseJsLiteralValue(match[5]);
    if (!path || literal.unsupported) continue;
    if (operator === "!==") {
      rules.push({ phase: 1, op: 5, pattern: "", fields: ["remove-where-field-in", path, field, JSON.stringify([literal.value])] });
    }
  }
  return rules;
}

function parseSameFieldExclusionFilter(expression, itemVariable) {
  const values = [];
  let field = "";
  for (const rawPart of splitStaticAndExpression(expression)) {
    const part = rawPart.trim();
    const match = part.match(new RegExp(`^${escapeRegExp(itemVariable)}\\.([A-Za-z_$][\\w$]*)\\s*!==\\s*(["'][^"']+["']|-?\\d+(?:\\.\\d+)?|true|false|null)$`));
    if (!match) return null;
    if (field && field !== match[1]) return null;
    field = match[1];
    const literal = parseJsLiteralValue(match[2]);
    if (!field || literal.unsupported) return null;
    values.push(literal.value);
  }
  return field && values.length > 1 ? { field, values } : null;
}

function splitStaticAndExpression(expression) {
  const parts = [];
  let quote = "";
  let start = 0;
  const text = String(expression || "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (text.slice(i, i + 2) === "&&") {
      parts.push(text.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function parseArrayLiteralValues(inner) {
  const out = [];
  for (const part of splitTopLevelComma(inner)) {
    const literal = parseJsLiteralValue(part.trim());
    if (literal.unsupported) return null;
    out.push(literal.value);
  }
  return out.length ? out : null;
}

function splitTopLevelComma(value) {
  const parts = [];
  let quote = "";
  let depth = 0;
  let start = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(") depth += 1;
    if (ch === "]" || ch === "}" || ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function stripJsComments(source) {
  let out = "";
  let quote = "";
  let block = false;
  let line = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (block) {
      if (ch === "*" && next === "/") {
        block = false;
        i += 1;
      }
      continue;
    }
    if (line) {
      if (ch === "\n") {
        line = false;
        out += ch;
      }
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += source[++i];
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "*") {
      block = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      line = true;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function stripJsStrings(source) {
  let out = "";
  let quote = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\" && i + 1 < source.length) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += "\"\"";
      continue;
    }
    out += ch;
  }
  return out;
}

function hasControlFlow(source) {
  return /\b(?:if|for|while|switch|catch|function)\b/.test(stripJsStrings(source));
}

function hasUnsafeBranchControlFlow(source) {
  return /\b(?:for|while|switch|catch|function)\b/.test(stripJsStrings(source));
}

function jsonPathFromJsAccess(access) {
  const parts = [];
  const pattern = /\.([A-Za-z_$][\w$]*)|\[['"]([^'"]+)['"]\]/g;
  for (const match of access.matchAll(pattern)) {
    const key = match[1] || match[2];
    parts.push(/^[A-Za-z_$][\w$]*$/.test(key) ? key : `[${JSON.stringify(key)}]`);
  }
  if (!parts.length) return "";
  return "$." + parts.join(".");
}

function parseJsLiteralForRule(raw) {
  const value = String(raw || "").trim();
  if (/^(?:true|false|null)$/i.test(value)) return value.toLowerCase();
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return JSON.stringify(unquote(value));
  }
  if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(value.replace(/'/g, '"')));
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsLiteralValue(raw) {
  const value = String(raw || "").trim();
  if (/^true$/i.test(value)) return { value: true };
  if (/^false$/i.test(value)) return { value: false };
  if (/^null$/i.test(value)) return { value: null };
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return { value: Number(value) };
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return { value: unquote(value) };
  return { unsupported: true };
}

function parseJsStringForBodyReplace(raw) {
  const value = String(raw || "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return unquote(value);
  }
  return null;
}

function propertyValueFromObjectLiteral(body, names) {
  for (const name of names) {
    const match = body.match(new RegExp(`(?:^|[,\\s])${name}\\s*:\\s*([\\s\\S]*?)(?=,\\s*[A-Za-z_$][\\w$]*\\s*:|$)`));
    if (match) return match[1].trim();
  }
  return "";
}

function parseStaticHeadersLiteral(raw) {
  const text = String(raw || "").trim();
  if (text === "{}") return [];
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  const out = [];
  const inner = text.slice(1, -1);
  const pattern = /(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*:\s*("[^"]*"|'[^']*')/g;
  for (const match of inner.matchAll(pattern)) {
    const name = match[1] || match[2] || match[3];
    const value = parseJsStringForBodyReplace(match[4]);
    if (!name || value == null) return null;
    out.push([name.toLowerCase(), value]);
  }
  return out;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wrapLoonSurgeScript(source, parsed) {
  const encodedSource = base64(source);
  const phase = parsed.phase === 0 ? "request" : "response";
  const argument = String(parsed.argument || "");
  const timeoutMs = parsed.timeoutMs || 4500;
  const binaryBodyMode = parsed.binaryBodyMode === true;
  return `async function process(ctx) {
  var __source = Anywhere.codec.utf8.decode(Anywhere.codec.base64.decode("${encodedSource}"));
  var __binaryBodyMode = ${binaryBodyMode ? "true" : "false"};
  function __bodyIn(value) {
    if (!value) return new Uint8Array();
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return value;
  }
  var __bodyBytes = __bodyIn(ctx.body);
  var __bodyText = "";
  try { if (ctx.body && !__binaryBodyMode) __bodyText = Anywhere.codec.utf8.decode(ctx.body); } catch (_) { __bodyText = ""; }
  var __finished = false;
  var __resolveDone;
  var __donePromise = new Promise(function (resolve) { __resolveDone = resolve; });
  var __pendingHttp = 0;
  var __timerSeed = 1;
  var __timers = {};
  var __nativeSetTimeout = typeof globalThis !== "undefined" && typeof globalThis.setTimeout === "function" ? globalThis.setTimeout.bind(globalThis) : null;
  var __nativeClearTimeout = typeof globalThis !== "undefined" && typeof globalThis.clearTimeout === "function" ? globalThis.clearTimeout.bind(globalThis) : null;
  var __nativeSetInterval = typeof globalThis !== "undefined" && typeof globalThis.setInterval === "function" ? globalThis.setInterval.bind(globalThis) : null;
  var __nativeClearInterval = typeof globalThis !== "undefined" && typeof globalThis.clearInterval === "function" ? globalThis.clearInterval.bind(globalThis) : null;
  function __setTimeout(callback, ms) {
    if (__nativeSetTimeout) return __nativeSetTimeout(callback, ms);
    var id = __timerSeed++;
    __timers[id] = true;
    Promise.resolve().then(function () {
      if (!__timers[id]) return;
      delete __timers[id];
      if (typeof callback === "function") callback();
    });
    return id;
  }
  function __clearTimeout(id) { if (__nativeClearTimeout) return __nativeClearTimeout(id); delete __timers[id]; }
  function __setInterval(callback, ms) {
    if (__nativeSetInterval) return __nativeSetInterval(callback, ms);
    var id = __timerSeed++;
    __timers[id] = true;
    Promise.resolve().then(function () {
      if (__timers[id] && typeof callback === "function") callback();
    });
    return id;
  }
  function __clearInterval(id) { if (__nativeClearInterval) return __nativeClearInterval(id); delete __timers[id]; }
  function __URLSearchParamsShim(search) {
    this.__pairs = [];
    var text = String(search || "");
    if (text.charAt(0) === "?") text = text.slice(1);
    if (!text) return;
    var parts = text.split("&");
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var at = parts[i].indexOf("=");
      var key = at >= 0 ? parts[i].slice(0, at) : parts[i];
      var value = at >= 0 ? parts[i].slice(at + 1) : "";
      this.__pairs.push([decodeURIComponent(key.replace(/\\+/g, " ")), decodeURIComponent(value.replace(/\\+/g, " "))]);
    }
  }
  __URLSearchParamsShim.prototype.get = function (key) {
    key = String(key);
    for (var i = 0; i < this.__pairs.length; i++) if (this.__pairs[i][0] === key) return this.__pairs[i][1];
    return null;
  };
  __URLSearchParamsShim.prototype.has = function (key) {
    key = String(key);
    for (var i = 0; i < this.__pairs.length; i++) if (this.__pairs[i][0] === key) return true;
    return false;
  };
  __URLSearchParamsShim.prototype.set = function (key, value) {
    key = String(key);
    for (var i = 0; i < this.__pairs.length; i++) {
      if (this.__pairs[i][0] === key) {
        this.__pairs[i][1] = String(value);
        return;
      }
    }
    this.__pairs.push([key, String(value)]);
  };
  __URLSearchParamsShim.prototype.append = function (key, value) { this.__pairs.push([String(key), String(value)]); };
  __URLSearchParamsShim.prototype.toString = function () {
    var out = [];
    for (var i = 0; i < this.__pairs.length; i++) out.push(encodeURIComponent(this.__pairs[i][0]) + "=" + encodeURIComponent(this.__pairs[i][1]));
    return out.join("&");
  };
  var __NativeURL = typeof globalThis !== "undefined" && typeof globalThis.URL === "function" ? globalThis.URL : null;
  var __NativeURLSearchParams = typeof globalThis !== "undefined" && typeof globalThis.URLSearchParams === "function" ? globalThis.URLSearchParams : null;
  function __URLShim(input) {
    if (__NativeURL) return new __NativeURL(input);
    var raw = String(input || "");
    var match = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)?\\/\\/([^/?#]*)([^?#]*)(\\?[^#]*)?(#.*)?$/);
    var authority = match ? match[2] : "";
    var hostParts = authority.split("@").pop().split(":");
    this.href = raw;
    this.protocol = match && match[1] ? match[1] : "";
    this.host = authority;
    this.hostname = hostParts[0] || "";
    this.port = hostParts.length > 1 ? hostParts.slice(1).join(":") : "";
    this.pathname = match ? (match[3] || "/") : raw.split(/[?#]/, 1)[0] || "";
    this.search = match && match[4] ? match[4] : (raw.indexOf("?") >= 0 ? "?" + raw.split("?")[1].split("#")[0] : "");
    this.hash = match && match[5] ? match[5] : (raw.indexOf("#") >= 0 ? "#" + raw.split("#")[1] : "");
    this.origin = this.protocol && authority ? this.protocol + "//" + authority : "";
    this.searchParams = new (__NativeURLSearchParams || __URLSearchParamsShim)(this.search);
  }
  __URLShim.prototype.toString = function () { return this.href; };
  try {
    if (typeof globalThis !== "undefined") {
      if (typeof globalThis.setTimeout !== "function") globalThis.setTimeout = __setTimeout;
      if (typeof globalThis.clearTimeout !== "function") globalThis.clearTimeout = __clearTimeout;
      if (typeof globalThis.setInterval !== "function") globalThis.setInterval = __setInterval;
      if (typeof globalThis.clearInterval !== "function") globalThis.clearInterval = __clearInterval;
      if (typeof globalThis.URL !== "function") globalThis.URL = __URLShim;
      if (typeof globalThis.URLSearchParams !== "function") globalThis.URLSearchParams = __URLSearchParamsShim;
    }
  } catch (_) {}
  function __headersObject(headers) {
    var out = {};
    if (!headers) return out;
    if (Array.isArray(headers)) {
      for (var i = 0; i < headers.length; i++) out[String(headers[i][0] || "").toLowerCase()] = String(headers[i][1] || "");
      return out;
    }
    for (var key in headers) out[String(key).toLowerCase()] = String(headers[key]);
    return out;
  }
  function __bodyOut(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return Anywhere.codec.utf8.encode(String(value == null ? "" : value));
  }
  var $request = { url: ctx.url || "", method: ctx.method || "GET", headers: __headersObject(ctx.headers), body: __binaryBodyMode ? __bodyBytes : __bodyText, bodyBytes: __bodyBytes };
  var $response = { status: ctx.status || 200, statusCode: ctx.status || 200, headers: __headersObject(ctx.headers), body: __binaryBodyMode ? __bodyBytes : __bodyText, bodyBytes: __bodyBytes };
  var $environment = { system: "Anywhere", "surge-version": "0", "loon-version": "0" };
  var $loon = "Anywhere";
  var $argument = ${JSON.stringify(argument)};
  var $persistentStore = {
    read: function (key) { return Anywhere.store.getString(String(key), true) || null; },
    write: function (value, key) { Anywhere.store.set(String(key), Anywhere.codec.utf8.encode(String(value == null ? "" : value)), true); return true; }
  };
  var $prefs = { valueForKey: $persistentStore.read, setValueForKey: function (value, key) { return $persistentStore.write(value, key); } };
  var $notification = { post: function () {} };
  var $notify = function () {};
  var $utils = {
    ungzip: function (value) { return Anywhere.codec.gzip.decode(value); },
    gzip: function (value) { return Anywhere.codec.gzip.encode(value); }
  };
  var $httpClient = {
    get: function (request, callback) { __http("GET", request, null, callback); },
    post: function (request, callback) { __http("POST", request, request && request.body, callback); },
    put: function (request, callback) { __http("PUT", request, request && request.body, callback); },
    delete: function (request, callback) { __http("DELETE", request, null, callback); }
  };
  var $task = {
    fetch: function (request) {
      return __httpPromise(request && request.method || "GET", request, request && request.body);
    }
  };
  function __http(method, request, body, callback) {
    var url = typeof request === "string" ? request : request.url;
    var headers = typeof request === "string" ? {} : (request.headers || {});
    __pendingHttp += 1;
    Promise.resolve(Anywhere.http.request({ method: method, url: url, headers: headers, body: body })).then(function (res) {
      callback(null, { status: res.status || 200, headers: __headersObject(res.headers) }, res.body ? Anywhere.codec.utf8.decode(res.body) : "");
    }).catch(function (err) { callback(err); }).finally(function () { __pendingHttp -= 1; });
  }
  function __httpPromise(method, request, body) {
    var url = typeof request === "string" ? request : request.url;
    var headers = typeof request === "string" ? {} : (request.headers || {});
    __pendingHttp += 1;
    return Promise.resolve(Anywhere.http.request({ method: method, url: url, headers: headers, body: body })).then(function (res) {
      var bodyText = res.body ? Anywhere.codec.utf8.decode(res.body) : "";
      return {
        statusCode: res.status || 200,
        status: res.status || 200,
        headers: __headersObject(res.headers),
        body: bodyText,
        bodyBytes: res.body || new Uint8Array()
      };
    }).finally(function () { __pendingHttp -= 1; });
  }
  function __finish() {
    if (__finished) return;
    __finished = true;
    Anywhere.done();
    __resolveDone();
  }
  function $done(value) {
    if (__finished) return;
    if (value && value.response && "${phase}" === "request") {
      var response = value.response;
      Anywhere.respond({
        status: response.status || response.statusCode || 200,
        headers: response.headers || [],
        body: response.body || value.body || ""
      });
      __finished = true;
      __resolveDone();
      return;
    }
    if (value && Object.prototype.hasOwnProperty.call(value, "body")) {
      ctx.body = __bodyOut(value.body);
    } else if (typeof $response !== "undefined" && "${phase}" === "response" && (__binaryBodyMode ? $response.body !== __bodyBytes : $response.body !== __bodyText)) {
      ctx.body = __bodyOut($response.body);
    }
    __finish();
  }
  function Env(name) {
    return {
      name: name || "Anywhere",
      isSurge: function () { return true; },
      isLoon: function () { return false; },
      isQuanX: function () { return false; },
      isNode: function () { return false; },
      toObj: function (value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback == null ? null : fallback; } },
      toStr: function (value, fallback) { try { return JSON.stringify(value); } catch (_) { return fallback == null ? null : fallback; } },
      getdata: function (key) { return $persistentStore.read(key); },
      setdata: function (value, key) { return $persistentStore.write(value, key); },
      getjson: function (key, fallback) { var value = $persistentStore.read(key); if (!value) return fallback; try { return JSON.parse(value); } catch (_) { return fallback; } },
      setjson: function (value, key) { return $persistentStore.write(JSON.stringify(value), key); },
      get: function (request, callback) { return $httpClient.get(request, callback); },
      post: function (request, callback) { return $httpClient.post(request, callback); },
      wait: function (ms) { return new Promise(function (resolve) { __setTimeout(resolve, ms); }); },
      time: function (format) { return String(format || "").replace(/yyyy/g, new Date().getFullYear()).replace(/MM/g, String(new Date().getMonth() + 1).padStart(2, "0")).replace(/dd/g, String(new Date().getDate()).padStart(2, "0")).replace(/HH/g, String(new Date().getHours()).padStart(2, "0")).replace(/mm/g, String(new Date().getMinutes()).padStart(2, "0")).replace(/ss/g, String(new Date().getSeconds()).padStart(2, "0")); },
      queryStr: function (options) { var out = []; for (var key in options || {}) out.push(encodeURIComponent(key) + "=" + encodeURIComponent(options[key])); return out.join("&"); },
      msg: function () {},
      log: function () { try { Anywhere.log.info(Array.prototype.join.call(arguments, " ")); } catch (_) {} },
      logErr: function (error) { try { Anywhere.log.error(String(error && error.stack || error)); } catch (_) {} },
      done: $done
    };
  }
  try {
    var __returnValue = (new Function("$request", "$response", "$done", "$persistentStore", "$prefs", "$httpClient", "$task", "$argument", "$notification", "$notify", "$environment", "$loon", "$utils", "Env", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "URL", "URLSearchParams", __source))($request, $response, $done, $persistentStore, $prefs, $httpClient, $task, $argument, $notification, $notify, $environment, $loon, $utils, Env, __setTimeout, __clearTimeout, __setInterval, __clearInterval, __NativeURL || __URLShim, __NativeURLSearchParams || __URLSearchParamsShim);
    if (__returnValue && typeof __returnValue.then === "function") {
      Promise.resolve(__returnValue).catch(function (error) { Anywhere.log.error(String(error && error.stack || error)); });
    }
  } catch (error) {
    Anywhere.log.error(String(error && error.stack || error));
  }
  var __timeoutPromise = __nativeSetTimeout ? new Promise(function (resolve) { __setTimeout(resolve, ${timeoutMs}); }) : __donePromise;
  await Promise.race([__donePromise, __timeoutPromise]);
  if (!__finished && __pendingHttp <= 0) __finish();
}`;
}

function jqToBodyJson(phase, pattern, rawJq) {
  const jq = unquote(rawJq.trim());
  let match = jq.match(/^del\(\s*(\.[^)]+?)\s*\)$/);
  if (match) return { phase, op: 5, pattern: urlGate(pattern), fields: ["delete", jsonPathFromJq(match[1])] };

  match = jq.match(/^del\(\s*(\.[A-Za-z0-9_.$[\]"'-]+)\[\]\s*\|\s*select\(\s*\.([A-Za-z0-9_$-]+)\s*==\s*(["'][^"']+["'])\s*\)\s*\)$/);
  if (match) {
    return {
      phase,
      op: 5,
      pattern: urlGate(pattern),
      fields: ["remove-where-field-in", jsonPathFromJq(match[1]), match[2], JSON.stringify([unquote(match[3])])],
    };
  }

  match = jq.match(/^delpaths\(\s*\[\s*((?:\[[^\]]+\]\s*,?\s*)+)\]\s*\)$/);
  if (match) {
    const paths = [...match[1].matchAll(/\[([^\]]+)\]/g)].map((item) => jsonPathFromArrayLiteral(item[1])).filter(Boolean);
    if (paths.length === 1) return { phase, op: 5, pattern: urlGate(pattern), fields: ["delete", paths[0]] };
  }

  const mapRemoval = jqMapSelectRemoval(phase, pattern, jq);
  if (mapRemoval) return mapRemoval;

  match = jq.match(/^\.[A-Za-z0-9_.$[\]"'-]+\s*=\s*(.+)$/);
  if (match) {
    const left = jq.slice(0, jq.indexOf("=")).trim();
    return { phase, op: 5, pattern: urlGate(pattern), fields: ["replace", jsonPathFromJq(left), match[1].trim()] };
  }
  return null;
}

function jqMapSelectRemoval(phase, pattern, jq) {
  const match = jq.match(/^(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*select\(([\s\S]+)\)\s*\)$/);
  if (!match) return null;
  const path = jsonPathFromJq(match[1]);
  const selector = match[2].trim();

  const keyMatch = selector.match(/^has\(\s*(["'][^"']+["'])\s*\)\s*\|\s*not$/);
  if (keyMatch) {
    return { phase, op: 5, pattern: urlGate(pattern), fields: ["remove-where-key-exists", path, unquote(keyMatch[1])] };
  }

  const parts = selector.split(/\s+and\s+/).map((part) => part.trim());
  const values = [];
  let field = "";
  for (const part of parts) {
    const fieldMatch = part.match(/^\.([A-Za-z0-9_$-]+)\s*!=\s*(["'][^"']+["'])$/);
    if (!fieldMatch) return null;
    if (field && field !== fieldMatch[1]) return null;
    field = fieldMatch[1];
    values.push(unquote(fieldMatch[2]));
  }
  if (!field || !values.length) return null;
  return { phase, op: 5, pattern: urlGate(pattern), fields: ["remove-where-field-in", path, field, JSON.stringify(values)] };
}

function jqToScriptRule(phase, pattern, rawJq) {
  const ops = parseJqScriptOps(unquote(String(rawJq || "").trim()));
  if (!ops.length) return null;
  const script = jsonOpsScript(ops);
  return { phase, op: 100, pattern: urlGate(pattern), fields: [base64(script)], scriptSource: script };
}

function parseJqScriptOps(jq) {
  const ops = [];
  for (const part of splitTopLevelPipes(jq)) {
    const op = parseSingleJqScriptOp(part.trim());
    if (!op) return [];
    ops.push(op);
  }
  return ops;
}

function parseSingleJqScriptOp(jq) {
  let match = jq.match(/^(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*select\(\s*(\.[A-Za-z0-9_.$[\]"'-]+)\[\]\.([A-Za-z0-9_$-]+)\s*!=\s*(["'][^"']+["'])\s*\)\s*\)$/);
  if (match) {
    return {
      type: "remove-array-where-nested-field-in",
      path: jqPathParts(match[1]),
      arrayPath: jqPathParts(match[2]),
      field: match[3],
      values: [unquote(match[4])],
    };
  }

  match = jq.match(/^(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*select\(\s*\.([A-Za-z0-9_$-]+)\s*\|\s*test\(\s*(["'][^"']+["'])\s*(?:[,;]\s*(["']i["']))?\s*\)\s*\|\s*not\s*\)\s*\)\s*\)$/);
  if (match) {
    return {
      type: "filter-child-array-regex-not",
      path: jqPathParts(match[1]),
      childPath: jqPathParts(match[2]),
      field: match[3],
      regex: unquote(match[4]),
      flags: match[5] ? "i" : "",
    };
  }

  match = jq.match(/^(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*select\(\s*\.([A-Za-z0-9_$-]+)\s*\|\s*test\(\s*(["'][^"']+["'])\s*(?:[,;]\s*(["']i["']))?\s*\)\s*\|\s*not\s*\)\s*\)$/);
  if (match) {
    return {
      type: "filter-array-regex-not",
      path: jqPathParts(match[1]),
      field: match[2],
      regex: unquote(match[3]),
      flags: match[4] ? "i" : "",
    };
  }

  match = jq.match(/^(\.[A-Za-z0-9_.$[\]"'-]+)\s*\|=\s*map\(\s*select\(\s*\.([A-Za-z0-9_$-]+)\s*==\s*(["'][^"']+["']|-?\d+(?:\.\d+)?|true|false|null)\s*\)\s*\)$/);
  if (match) {
    const literal = parseJsLiteralValue(match[3]);
    if (literal.unsupported) return null;
    return {
      type: "keep-array-field-in",
      path: jqPathParts(match[1]),
      field: match[2],
      values: [literal.value],
    };
  }

  return null;
}

function splitTopLevelPipes(value) {
  const out = [];
  let cur = "";
  let quote = "";
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      cur += ch;
      if (ch === "\\" && i + 1 < value.length) cur += value[++i];
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "|" && depth === 0 && value[i + 1] !== "=") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function jqPathParts(path) {
  const text = String(path || "").trim().replace(/^\./, "");
  if (!text) return [];
  const parts = [];
  for (const part of text.split(".")) {
    const cleaned = part.replace(/\[\]$/, "");
    if (!/^[A-Za-z0-9_$-]+$/.test(cleaned)) return [];
    parts.push(cleaned);
  }
  return parts;
}

function jsonOpsScript(ops) {
  return `function process(ctx) {
  if (!ctx.body) return;
  var text;
  try { text = Anywhere.codec.utf8.decode(ctx.body); } catch (_) { return; }
  var obj;
  try { obj = JSON.parse(text); } catch (_) { return; }
  var changed = false;
  var ops = ${JSON.stringify(ops)};

  function get(root, path) {
    var cur = root;
    for (var i = 0; i < path.length; i++) {
      if (cur == null) return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }
  function set(root, path, value) {
    var cur = root;
    for (var i = 0; i < path.length - 1; i++) {
      if (cur == null) return;
      cur = cur[path[i]];
    }
    if (cur != null) cur[path[path.length - 1]] = value;
  }
  function filterAt(root, path, keep) {
    var arr = get(root, path);
    if (!Array.isArray(arr)) return;
    var out = arr.filter(keep);
    if (out.length !== arr.length) {
      set(root, path, out);
      changed = true;
    }
  }
  function includes(values, value) {
    for (var i = 0; i < values.length; i++) if (values[i] === value) return true;
    return false;
  }

  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op.type === "remove-array-where-nested-field-in") {
      filterAt(obj, op.path, function (item) {
        var nested = get(item, op.arrayPath);
        if (!Array.isArray(nested)) return true;
        return !nested.some(function (entry) { return entry && includes(op.values, entry[op.field]); });
      });
    } else if (op.type === "filter-child-array-regex-not") {
      var parents = get(obj, op.path);
      var regex = new RegExp(op.regex, op.flags || "");
      if (Array.isArray(parents)) {
        for (var p = 0; p < parents.length; p++) {
          var child = get(parents[p], op.childPath);
          if (!Array.isArray(child)) continue;
          var before = child.length;
          var next = child.filter(function (entry) { return !regex.test(String(entry && entry[op.field] || "")); });
          if (next.length !== before) {
            set(parents[p], op.childPath, next);
            changed = true;
          }
        }
      }
    } else if (op.type === "filter-array-regex-not") {
      var directRegex = new RegExp(op.regex, op.flags || "");
      filterAt(obj, op.path, function (entry) { return !directRegex.test(String(entry && entry[op.field] || "")); });
    } else if (op.type === "keep-array-field-in") {
      filterAt(obj, op.path, function (entry) { return entry && includes(op.values, entry[op.field]); });
    }
  }

  if (!changed) return;
  ctx.body = Anywhere.codec.utf8.encode(JSON.stringify(obj));
  Anywhere.done();
}`;
}

function bodyReplaceRule(phase, pattern, parts) {
  if (!parts?.length) return null;
  const search = parts[0];
  const replacement = parts.slice(1).join(" ");
  if (!search) return null;
  const recursive = bodyReplaceAsRecursiveJSON(phase, pattern, search, replacement);
  if (recursive) return recursive;
  return { phase, op: 4, pattern: urlGate(pattern), fields: [search, replacement] };
}

function bodyReplaceAsRecursiveJSON(phase, pattern, search, replacement) {
  const keyMatch = search.match(/^"?([A-Za-z0-9_$-]+)"?:\\?\[\.\+\\?\]$/);
  if (!keyMatch) return null;
  const replacementMatch = replacement.match(/^"?([A-Za-z0-9_$-]+)"?:\[\]$/);
  if (!replacementMatch || replacementMatch[1] !== keyMatch[1]) return null;
  return { phase, op: 5, pattern: urlGate(pattern), fields: ["replace-recursive", keyMatch[1], "[]"] };
}

function bodyJsonDeleteRules(phase, pattern, fields) {
  if (!fields.length) return null;
  return fields.map((field) => ({ phase, op: 5, pattern: urlGate(pattern), fields: ["delete", jsonPathFromLoosePath(field)] }));
}

function bodyJsonReplaceRules(phase, pattern, fields) {
  if (!fields.length || fields.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < fields.length; i += 2) {
    out.push({ phase, op: 5, pattern: urlGate(pattern), fields: ["replace", jsonPathFromLoosePath(fields[i]), fields[i + 1]] });
  }
  return out;
}

function mockResponseBodyRule(pattern, rest) {
  const options = parseKeyValueTokens(rest);
  if (options["status-code"] && options["status-code"] !== "200") return null;
  const dataType = (options["data-type"] || "text").toLowerCase();
  const data = options.data ?? "";
  if (dataType === "tiny-gif" || dataType === "gif") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["3"] };
  if (dataType === "base64") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["4", data] };
  return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["2", data] };
}

function headerRuleFromAction(pattern, action, parts) {
  const [phaseText, , opText] = action.split("-");
  const phase = phaseText === "response" ? 1 : 0;
  const name = parts[0];
  const value = parts.slice(1).join(" ");
  if (!name) return null;
  if (opText === "add") return { phase, op: 1, pattern: urlGate(pattern), fields: [name, value] };
  if (opText === "del" || opText === "delete") return { phase, op: 2, pattern: urlGate(pattern), fields: [name] };
  if (opText === "replace" || opText === "set") return { phase, op: 3, pattern: urlGate(pattern), fields: [name, value] };
  return null;
}

function rejectRule(pattern, content) {
  if (content.kind === "gif") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["3"] };
  if (content.kind === "data") return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["4", content.value || ""] };
  return { phase: 0, op: 0, pattern: urlGate(pattern), fields: ["2", content.value || ""] };
}

function rejectContentForAction(rawAction = "", pattern = "") {
  const action = String(rawAction).toLowerCase();
  if (action === "reject-dict" || action === "reject-json") return { kind: "text", value: "{}" };
  if (action === "reject-array") return { kind: "text", value: "[]" };
  if (action === "reject-img" || action === "reject-200-img") return { kind: "gif" };
  if (action === "reject-data") return { kind: "data", value: "" };
  if (looksLikeImagePattern(pattern)) return { kind: "gif" };
  return { kind: "text", value: "" };
}

function normalizeMitmRulePattern(rule) {
  const next = { ...rule };
  next.pattern = normalizeQueryBoundary(next.pattern);
  return next;
}

function normalizeQueryBoundary(pattern) {
  return String(pattern || "").replace(/\\\?(?=$)/g, "(?:\\?|$)");
}

function routeForAction(action = "") {
  const normalized = String(action).toUpperCase();
  if (normalized === "REJECT" || normalized === "REJECT-DROP" || normalized === "REJECT-TINYGIF" || normalized === "REJECT-NO-DROP") return ROUTING.reject;
  if (normalized === "DIRECT") return ROUTING.direct;
  return null;
}

function isRejectAction(action = "") {
  return /^reject/i.test(String(action));
}

function looksLikeImagePattern(pattern) {
  return /\.(?:gif|png|jpe?g|webp)(?:\\?|\?|$|\)|\[|\])/i.test(pattern)
    || /\/(?:img|image|uploadimg|web\.business\.image|ad-app-package|mosaic-legacy|tos-cn-i-1yzifmftcy)\//i.test(pattern);
}

function emitMitmRule(rule) {
  return [rule.phase, rule.op, rule.pattern, ...rule.fields].map(csvQuote).join(", ");
}

function buildReport({ converted, skipped, files, diagnostics }) {
  const hasError = diagnostics.some((item) => item.level === "error");
  const hasSampleRequired = diagnostics.some((item) => item.code === "sample-required-pattern" || /sample-required/.test(item.code || ""));
  const hasPartial = diagnostics.some((item) => ["warning", "info"].includes(item.level)) || skipped > 0;
  const status = hasError || (converted === 0 && skipped > 0)
    ? "blocked"
    : hasSampleRequired
      ? "sample-required"
      : hasPartial
        ? "partial"
        : "stable";
  return {
    status,
    converted,
    skipped,
    fileCount: files.length,
    files: files.map((file) => ({ name: file.name, type: file.type, ruleCount: file.ruleCount })),
    diagnostics: diagnostics.reduce((acc, item) => {
      acc[item.level] = (acc[item.level] || 0) + 1;
      return acc;
    }, {}),
  };
}

function normalizeHostnames(values, diagnostics) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const candidates = normalizeHostnameCandidates(raw);
    if (!candidates.length) {
      diagnostics.push({ level: "warning", code: "complex-hostname-wildcard", message: `复杂 hostname wildcard 已跳过：${raw}`, line: 0, source: raw });
      continue;
    }
    for (const value of candidates) {
      if (!seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }
  return out;
}

function normalizeHostnameCandidates(raw) {
  const value = String(raw || "").trim().replace(/^%APPEND%\s*/i, "").trim().toLowerCase();
  if (!value) return [];
  const candidates = [];
  const add = (item) => {
    const normalized = item.replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
    if (!normalized || /[?*\s/]/.test(normalized) || !/^[a-z0-9.-]+$/.test(normalized)) return;
    candidates.push(normalized);
  };

  if (value.startsWith("*.")) {
    add(value.slice(2));
    return uniqueStrings(candidates);
  }
  if (value.startsWith("*") && value.includes(".")) {
    add(value.slice(1));
    add(value.slice(value.indexOf(".") + 1));
    return uniqueStrings(candidates);
  }

  const firstLabel = value.split(".", 1)[0];
  if (firstLabel?.includes("*") && value.includes(".")) {
    add(value.replace(/\*/g, ""));
    add(value.slice(value.indexOf(".") + 1));
    return uniqueStrings(candidates);
  }

  add(value);
  return uniqueStrings(candidates);
}

function applyVerifiedRecipe(name, hostnames, rules) {
  const id = normalizedModuleName(name);
  if (id === "pinduoduo") {
    for (const rule of rules) {
      if (rule.pattern.includes("/api/cappuccino/splash")) {
        rule.pattern = "^https://[^/]+/api/cappuccino/splash(?:\\?|$)";
        if (rule.op === 0 && rule.fields[0] === "2") rule.fields[1] = "{}";
      } else if (rule.pattern.includes("/api/aquarius/hungary/global/homepage")) {
        rule.pattern = "^https://[^/]+/api/aquarius/hungary/global/homepage(?:\\?|$)";
        if (rule.op === 0 && rule.fields[0] === "2") rule.fields[1] = "{}";
      } else if (rule.pattern.includes("/proxy/api/api/express/post/waybill/red_packet/goods_list")) {
        rule.pattern = "^https://[^/]+/proxy/api/api/express/post/waybill/red_packet/goods_list(?:\\?|$)";
      }
    }
    return hostnames;
  }

  if (id === "pixiv") {
    for (const rule of rules) {
      if (rule.pattern.includes("/auth/token")) rule.pattern = "^https://[^/]+/auth/token(?:\\?|$)";
    }
    return hostnames;
  }

  if (id === "autonavi") {
    for (const rule of rules) {
      if (rule.pattern.includes("/ws/shield/dsp/app/startup/init")) {
        rule.pattern = "^https?://m5\\.amap\\.com/ws/shield/dsp/app/startup/init(?:\\?|$)";
      } else if (rule.pattern.includes("/ws/valueadded/")) {
        rule.pattern = "^https?://m5\\.amap\\.com/ws/valueadded/";
      } else if (rule.pattern.includes("optimus-ads") && rule.pattern.includes("uploadimg")) {
        rule.pattern = "^https?://optimus-ads\\.amap\\.com/uploadimg/[a-zA-Z0-9]+\\.gif(?:\\?|$)";
      } else if (rule.pattern.includes("splash_screen_rt")) {
        rule.pattern = "^https?://amap-aos-info-nogw\\.amap\\.com/ws/aos/alimama/splash_screen_rt(?:\\?|$)";
      }
    }
    return ["m5.amap.com", "optimus-ads.amap.com", "amap-aos-info-nogw.amap.com"];
  }

  if (id === "fanqienovel") {
    for (const rule of rules) {
      rule.pattern = rule.pattern
        .replaceAll("(pglstatp-toutiao|pstatp)", "(?:pglstatp-toutiao|pstatp)")
        .replaceAll("(obj|img)", "(?:obj|img)")
        .replaceAll("(ad-app-package|ad)", "(?:ad-app-package|ad)")
        .replaceAll("(get_ads|stats|settings)", "(?:get_ads|stats|settings)")
        .replaceAll(".byteimg.com", ".byteimg\\.com")
        .replaceAll(".snssdk.com", ".snssdk\\.com");
      if (rule.op === 0 && rule.fields[0] === "2" && /(?:\/(?:obj|img)\/(?:ad-app-package|ad)\/|byteimg|web\\\.business\\\.image|ad-app-package|mosaic-legacy)/.test(rule.pattern)) {
        rule.fields = ["3"];
      }
    }
    return ["pangolin-sdk-toutiao.com", "pglstatp-toutiao.com", "pstatp.com", "gurd.snssdk.com", "snssdk.com", "byteimg.com", "default.ixigua.com"];
  }

  if (id === "hupu") {
    for (const rule of rules) {
      if (rule.pattern.includes("/(interfaceAdMonitor|interfaceAd)/")) {
        rule.pattern = "^https?://games\\.mobileapi\\.hupu\\.com/.+?/(?:interfaceAdMonitor|interfaceAd)/";
        if (rule.fields[0] === "2") rule.fields[1] = "{}";
      } else if (rule.pattern.includes("/status/init")) {
        rule.pattern = "^https?://games\\.mobileapi\\.hupu\\.com/.+?/status/init";
        if (rule.fields[0] === "2") rule.fields[1] = "{}";
      } else if (rule.pattern.includes("/(search|interfaceAdMonitor|status|hupuBbsPm)/")) {
        rule.pattern = "^https?://games\\.mobileapi\\.hupu\\.com/.+?/(?:search|interfaceAdMonitor|status|hupuBbsPm)/(?:hotkey|init|hupuBbsPm)\\.?"
      } else if (rule.pattern.includes("BbsImg")) {
        rule.pattern = "^https?://i\\d+\\.hoopchina\\.com\\.cn/blogfile/\\d+/\\d+/BbsImg\\.(?:big\\.)?(?:png|jpg)$";
      } else if (rule.pattern.includes("goblin") && rule.pattern.includes("interfaceAd/getOther")) {
        rule.pattern = "^https?://goblin\\.hupu\\.com/.+/interfaceAd/getOther";
        if (rule.fields[0] === "2") rule.fields[1] = "{}";
      }
    }
    return ["games.mobileapi.hupu.com", "du.hupucdn.com", "hoopchina.com.cn", "goblin.hupu.com"];
  }

  return hostnames;
}

function normalizedModuleName(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("拼多多") || text.includes("pinduoduo")) return "pinduoduo";
  if (text.includes("pixiv")) return "pixiv";
  if (text === "高德地图" || text.includes("autonavi")) return "autonavi";
  if (text.includes("番茄小说") || text.includes("fanqie")) return "fanqienovel";
  if (text.includes("虎扑") || text.includes("hupu")) return "hupu";
  return "";
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function dedupeMitmRules(rules) {
  const seen = new Set();
  const out = [];
  for (const rule of rules) {
    const key = [rule.phase, rule.op, rule.pattern, ...rule.fields].join("\u001f");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function generalizeGroupedHostPatterns(rules, hostnames, diagnostics) {
  const hostnameSet = new Set(hostnames);
  let changed = 0;
  for (const rule of rules) {
    const generalized = generalizeGroupedHostPattern(rule.pattern, hostnameSet);
    if (generalized && generalized !== rule.pattern) {
      rule.pattern = generalized;
      changed += 1;
    }
  }
  if (changed) {
    diagnostics.push({
      level: "info",
      code: "grouped-host-generalized",
      message: `已将 ${changed} 条简单 host 分组 pattern 泛化为 [^/]+，作用域仍由 hostname 限定。`,
      line: 0,
      source: "",
    });
  }
  return rules;
}

function generalizeGroupedHostPattern(pattern, hostnameSet) {
  const normalized = normalizeUrlPattern(pattern);
  const parsed = parseSimpleGroupedHost(normalized);
  if (!parsed) return "";
  if (!parsed.hosts.every((host) => hostnameSet.has(host))) return "";
  return `${parsed.prefix}[^/]+${normalized.slice(parsed.end)}`;
}

function mergeSameGateScripts(rules, diagnostics) {
  const groups = new Map();
  for (const rule of rules) {
    if (rule.op !== 100 || !rule.scriptSource) continue;
    const key = `${rule.phase}\u001f${rule.pattern}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const composed = composeProcessScripts(group.map((rule) => rule.scriptSource));
    group[0].scriptSource = composed;
    group[0].fields = [base64(composed)];
    for (let i = 1; i < group.length; i++) group[i].__drop = true;
    diagnostics.push({
      level: "warning",
      code: "script-merged",
      message: `同 phase/url-pattern 的 ${group.length} 条脚本已合并为一个 dispatcher；仍需实机确认执行顺序。`,
      line: 0,
      source: "",
    });
  }
  return rules.filter((rule) => !rule.__drop);
}

function mergeIdenticalScriptSourcesByPhase(rules, diagnostics) {
  const groups = new Map();
  for (const rule of rules) {
    if (rule.op !== 100 || !rule.scriptSource || rule.noScriptMerge) continue;
    const key = `${rule.phase}\u001f${rule.scriptSource}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const union = unionRegexPattern(group.map((rule) => rule.pattern));
    if (!union) continue;
    group[0].pattern = union;
    for (let i = 1; i < group.length; i++) group[i].__drop = true;
    diagnostics.push({
      level: "warning",
      code: "script-source-merged",
      message: `同 phase 的 ${group.length} 条相同脚本 source 已合并为一个 URL union 规则。`,
      line: 0,
      source: "",
    });
  }
  return rules.filter((rule) => !rule.__drop);
}

function mergeScriptDispatchersByPhase(rules, diagnostics) {
  const groups = new Map();
  for (const rule of rules) {
    if (rule.op !== 100 || !rule.scriptSource || rule.noScriptMerge) continue;
    const key = String(rule.phase);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const union = unionRegexPattern(group.map((rule) => rule.pattern));
    if (!union) continue;
    const composed = composeGatedProcessScripts(group.map((rule) => ({ pattern: rule.pattern, source: rule.scriptSource })));
    group[0].pattern = union;
    group[0].scriptSource = composed;
    group[0].fields = [base64(composed)];
    for (let i = 1; i < group.length; i++) group[i].__drop = true;
    diagnostics.push({
      level: "warning",
      code: "script-dispatcher-merged",
      message: `同 phase 的 ${group.length} 条脚本已合并为 gated dispatcher；每段脚本仅在原 pattern 命中时执行。`,
      line: 0,
      source: "",
    });
  }
  return rules.filter((rule) => !rule.__drop);
}

function mergeGeneratedHeaderPreprocessRules(rules, diagnostics) {
  const groups = new Map();
  for (const rule of rules) {
    if (!rule.generated || rule.phase !== 0 || (rule.op !== 1 && rule.op !== 2)) continue;
    const key = `${rule.op}\u001f${rule.fields.join("\u001f")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const union = unionRegexPattern(group.map((rule) => rule.pattern));
    if (!union) continue;
    group[0].pattern = union;
    for (let i = 1; i < group.length; i++) group[i].__drop = true;
    diagnostics.push({
      level: "info",
      code: "generated-header-merged",
      message: `已合并 ${group.length} 条自动响应体预处理 header 规则。`,
      line: 0,
      source: "",
    });
  }
  return rules.filter((rule) => !rule.__drop);
}

function dedupeRoutingRules(rules) {
  const seen = new Set();
  const out = [];
  for (const rule of rules) {
    const key = `${rule.type}\u001f${rule.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function composeProcessScripts(sources) {
  const parts = sources.map((source, index) => {
    if (!/function\s+process\s*\(\s*ctx\s*\)/.test(source)) {
      return `function __anywhere_part_${index}(ctx) {\n${source}\n}`;
    }
    return source.replace(/function\s+process\s*\(\s*ctx\s*\)/, `function __anywhere_part_${index}(ctx)`);
  });
  const calls = sources.map((_, index) => `  __anywhere_part_${index}(ctx);`).join("\n");
  return `${parts.join("\n\n")}\n\nfunction process(ctx) {\n${calls}\n}`;
}

function composeGatedProcessScripts(items) {
  const parts = items.map((item, index) => {
    if (!/function\s+process\s*\(\s*ctx\s*\)/.test(item.source)) {
      return `function __anywhere_part_${index}(ctx) {\n${item.source}\n}`;
    }
    return item.source.replace(/function\s+process\s*\(\s*ctx\s*\)/, `function __anywhere_part_${index}(ctx)`);
  });
  const calls = items.map((item, index) => `  if ((new RegExp(${JSON.stringify(item.pattern)})).test(url)) __anywhere_part_${index}(ctx);`).join("\n");
  return `${parts.join("\n\n")}\n\nfunction process(ctx) {\n  var url = ctx.url || "";\n${calls}\n}`;
}

function unionRegexPattern(patterns) {
  const unique = uniqueStrings(patterns);
  if (unique.length < 2) return "";
  const compact = compactRegexUnion(unique);
  if (compact) return compact;
  return unique.map((pattern) => `(?:${pattern})`).join("|");
}

function compactRegexUnion(patterns) {
  const prefix = safeRegexUnionPrefix(patterns);
  if (!prefix) return "";
  const suffixes = patterns.map((pattern) => pattern.slice(prefix.length));
  if (suffixes.some((suffix) => !suffix)) return "";
  return `${prefix}(?:${suffixes.join("|")})`;
}

function safeRegexUnionPrefix(patterns) {
  const prefix = longestCommonPrefix(patterns);
  if (!prefix || !prefix.startsWith("^http")) return "";
  const schemePrefix = prefix.match(/^\^https\?:\/\/|^\^https:\/\/|^\^http:\/\/|^\^https?:\/\//)?.[0] || "";
  const lastSlash = prefix.lastIndexOf("/");
  if (schemePrefix && prefix === schemePrefix) return schemePrefix;
  if (lastSlash >= schemePrefix.length - 1 && !isInsideCharClass(prefix, lastSlash) && !hasOddTrailingBackslashes(prefix.slice(0, lastSlash))) {
    return prefix.slice(0, lastSlash + 1);
  }
  if (schemePrefix) return schemePrefix;
  return "";
}

function longestCommonPrefix(values) {
  if (!values.length) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}

function isInsideCharClass(value, index) {
  let inside = false;
  for (let i = 0; i < index; i++) {
    if (value[i] === "\\" && i + 1 < index) {
      i += 1;
      continue;
    }
    if (value[i] === "[") inside = true;
    else if (value[i] === "]") inside = false;
  }
  return inside;
}

function hasOddTrailingBackslashes(value) {
  let count = 0;
  for (let i = value.length - 1; i >= 0 && value[i] === "\\"; i--) count += 1;
  return count % 2 === 1;
}

function validateAmrsRuleLine(line) {
  const fields = parseCsv(line);
  if (fields.length < 3) return { level: "error", code: "invalid-amrs-rule", message: "MITM 规则字段不足。" };
  const phase = Number(fields[0]);
  const op = Number(fields[1]);
  if (![0, 1].includes(phase)) return { level: "error", code: "invalid-phase", message: "phase 必须是 0 或 1。" };
  if (!MITM_OPS.has(op)) return { level: "error", code: "invalid-op", message: `不支持 op=${fields[1]}。` };
  try {
    new RegExp(fields[2]);
  } catch (error) {
    return { level: "error", code: "invalid-regex", message: error.message };
  }
  const argCount = fields.length - 3;
  if (op === 0 && argCount < 1) return { level: "error", code: "invalid-rewrite", message: "rewrite 缺少 submode。" };
  if (op === 1 || op === 3) {
    if (argCount !== 2) return { level: "error", code: "invalid-header", message: "header add/replace 需要 name/value。" };
  }
  if (op === 2 && argCount !== 1) return { level: "error", code: "invalid-header-delete", message: "header delete 需要 name。" };
  if (op === 4 && argCount !== 2) return { level: "error", code: "invalid-body-replace", message: "body-replace 需要 search/replacement。" };
  if (op === 5) {
    const action = fields[3]?.toLowerCase();
    const expectedArgCount = {
      add: 3,
      replace: 3,
      delete: 2,
      "replace-recursive": 3,
      "delete-recursive": 2,
      "remove-where-key-exists": 3,
      "remove-where-field-in": 4,
    }[action];
    if (!BODY_JSON_ACTIONS.has(action) || !expectedArgCount) return { level: "error", code: "invalid-body-json", message: "body-json action 非法。" };
    if (argCount !== expectedArgCount) return { level: "error", code: "invalid-body-json-args", message: `body-json ${action} 参数数量应为 ${expectedArgCount}。` };
  }
  if ((op === 100 || op === 101) && argCount !== 1) return { level: "error", code: "invalid-script", message: "script 需要 base64。" };
  return null;
}

function validateArrsRuleLine(line) {
  const split = splitFirst(line, ",");
  if (!split) return { level: "error", code: "invalid-arrs-rule", message: "routing 规则缺少逗号。" };
  const type = Number(split[0].trim());
  const value = split[1].trim();
  if (![0, 1, 2, 3].includes(type)) return { level: "error", code: "invalid-routing-type", message: "routing type 必须是 0..3。" };
  if (!value) return { level: "error", code: "empty-routing-value", message: "routing value 不能为空。" };
  return null;
}

function parseCsv(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function splitCommand(line) {
  const out = [];
  let cur = "";
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = "";
      } else {
        cur += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function splitLeadingToken(line) {
  const trimmed = line.trim();
  let quote = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      return [trimmed.slice(0, i), trimmed.slice(i).trim()];
    }
  }
  return null;
}

function parseRewriteCommand(line) {
  const first = splitLeadingToken(line);
  if (!first) return null;
  const second = splitLeadingToken(first[1]);
  if (!second) return null;
  return { pattern: first[0], action: second[0].toLowerCase(), rest: second[1] };
}

function splitBodyReplaceParts(rest) {
  const trimmed = rest.trim();
  if (!trimmed) return [];
  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return [];
  return [match[1], match[2] || ""];
}

function parseKeyValueTokens(input) {
  const out = {};
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /[\s,]/.test(input[i])) i += 1;
    const keyStart = i;
    while (i < input.length && /[A-Za-z0-9_-]/.test(input[i])) i += 1;
    const key = input.slice(keyStart, i).toLowerCase();
    while (i < input.length && /\s/.test(input[i])) i += 1;
    if (!key || input[i] !== "=") {
      i += 1;
      continue;
    }
    i += 1;
    while (i < input.length && /\s/.test(input[i])) i += 1;
    let value = "";
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i++];
      while (i < input.length) {
        const ch = input[i];
        if (ch === quote && keyValueBoundary(input, i + 1)) {
          i += 1;
          break;
        }
        value += ch;
        i += 1;
      }
    } else {
      while (i < input.length) {
        const ch = input[i];
        if (/\s/.test(ch)) break;
        if (ch === "," && keyValueBoundary(input, i + 1)) break;
        value += ch;
        i += 1;
      }
    }
    out[key] = value;
  }
  return out;
}

function keyValueBoundary(input, index) {
  let i = index;
  while (i < input.length && /\s/.test(input[i])) i += 1;
  if (i >= input.length) return true;
  if (input[i] === ",") {
    i += 1;
    while (i < input.length && /\s/.test(input[i])) i += 1;
  }
  const rest = input.slice(i);
  return /^[A-Za-z0-9_-]+\s*=/.test(rest);
}

function stripInlineComment(line) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
    if (ch === "/" && line[i + 1] === "/" && i > 0 && /\s/.test(line[i - 1])) return line.slice(0, i);
  }
  return line;
}

function splitFirst(value, separator) {
  const index = value.indexOf(separator);
  if (index < 0) return null;
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function csvQuote(value) {
  const text = String(value ?? "");
  if (/[",\s]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function urlGate(pattern) {
  const normalized = normalizeUrlPattern(pattern);
  if (/^\^https?:/.test(normalized) || /^\^http\\?s/.test(normalized) || normalized.startsWith("^http")) return normalized;
  if (normalized.startsWith("^/")) return `^https://[^/]+${normalized.slice(1)}`;
  if (normalized.startsWith("/")) return `^https://[^/]+${normalized}`;
  return normalized;
}

function normalizeUrlPattern(pattern) {
  return String(pattern || "")
    .replaceAll("\\/", "/")
    .replaceAll("\\=", "=");
}

function filenameFromName(name, ext) {
  const safe = String(name).trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_") || "Converted_Module";
  return `${safe}${ext}`;
}

function normalizeRuleType(value = "") {
  const type = String(value || "").trim().toUpperCase();
  return RULE_TYPE_ALIASES[type] || type;
}

function normalizeDomain(value) {
  let domain = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  if (domain.startsWith("+.")) domain = domain.slice(2);
  else if (domain.startsWith("*.")) domain = domain.slice(2);
  else if (domain.startsWith(".")) domain = domain.slice(1);
  if (!domain || /[*/?]/.test(domain) || /\s/.test(domain)) return "";
  return domain;
}

function normalizeKeyword(value) {
  const keyword = String(value || "").trim().toLowerCase();
  if (!keyword || /[*/?\s]/.test(keyword)) return "";
  return keyword;
}

function normalizeCIDR(value, version) {
  const trimmed = value.trim();
  if (trimmed.includes("/")) return trimmed;
  return `${trimmed}/${version === 6 ? "128" : "32"}`;
}

function extractHostFromPattern(pattern) {
  return extractHostsFromPattern(pattern)[0] || "";
}

function extractHostsFromPattern(pattern) {
  const grouped = parseSimpleGroupedHost(normalizeUrlPattern(pattern));
  if (grouped) return grouped.hosts;
  const normalized = pattern.replaceAll("\\/", "/").replaceAll("\\.", ".");
  const match = normalized.match(/https?\??:\/+([^/]+)/i);
  if (!match) return [];
  const host = match[1].replace(/:\d+$/, "").toLowerCase();
  if (!host || /[()[\]{}|+*?\\]/.test(host)) return [];
  return [host];
}

function parseSimpleGroupedHost(pattern) {
  const match = pattern.match(/^(\^https?\??:\/\/)\((?:\?:)?([^)]+)\)\\\.((?:[A-Za-z0-9-]|\\\.)+)(?=\/)/);
  if (!match) return null;
  const alternatives = match[2].split("|");
  if (alternatives.length < 2) return null;
  const domain = match[3].replaceAll("\\.", ".").toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  const labels = alternatives.flatMap(expandGroupedHostAlternative);
  if (!labels.length || labels.length > 32) return null;
  const hosts = uniqueStrings(labels.map((item) => `${item}.${domain}`));
  return { prefix: match[1], hosts, end: match[0].length };
}

function expandGroupedHostAlternative(item) {
  const text = String(item || "");
  if (/^[A-Za-z0-9-]+$/.test(text)) return [text.toLowerCase()];
  let match = text.match(/^([A-Za-z0-9-]+)\\d\?$/);
  if (match) {
    const base = match[1].toLowerCase();
    return [base, ...Array.from({ length: 10 }, (_, index) => `${base}${index}`)];
  }
  match = text.match(/^([A-Za-z0-9-]+)\\d$/);
  if (match) {
    const base = match[1].toLowerCase();
    return Array.from({ length: 10 }, (_, index) => `${base}${index}`);
  }
  return [];
}

function jsonPathFromJq(path) {
  return path.trim().replace(/^\./, "$.").replace(/\[\]/g, "[*]");
}

function jsonPathFromLoosePath(path) {
  const text = String(path || "").trim();
  if (text.startsWith("$.")) return text;
  if (text.startsWith(".")) return jsonPathFromJq(text);
  return "$." + text.replace(/^\$?\./, "");
}

function jsonPathFromArrayLiteral(value) {
  const parts = [...value.matchAll(/"([^"]+)"|'([^']+)'/g)].map((item) => item[1] || item[2]);
  if (!parts.length) return "";
  return "$." + parts.map((part) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? part : `[${JSON.stringify(part)}]`).join(".");
}

function unquote(value) {
  const text = String(value ?? "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function base64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  return globalThis.Buffer.from(bytes).toString("base64");
}

function isTruthy(value) {
  return /^(?:1|true|yes)$/i.test(String(value || ""));
}

function isHighRiskPattern(pattern) {
  return /(grpc|protobuf|youtubei\/v1\/(?:browse|next|player)|feed\/index|homefeed|viewunite|playurl|reply\/mainlist)/i.test(pattern);
}

function needsResponseBodyPreprocess(rule) {
  return rule.phase === 1 && (rule.op === 4 || rule.op === 5 || rule.op === 100);
}

function responseBodyPreprocessRules(pattern) {
  return [
    { phase: 0, op: 2, pattern, fields: ["accept-encoding"], generated: true },
    { phase: 0, op: 1, pattern, fields: ["accept-encoding", "identity"], generated: true },
    { phase: 0, op: 2, pattern, fields: ["if-none-match"], generated: true },
    { phase: 0, op: 2, pattern, fields: ["if-modified-since"], generated: true },
  ];
}

export const internals = {
  parseCsv,
  splitCommand,
  splitLeadingToken,
  parseRewriteCommand,
  splitBodyReplaceParts,
  parseKeyValueTokens,
  stripInlineComment,
  parseArgumentLine,
  resolveArgumentValues,
  resolveItemArguments,
  jqToBodyJson,
  extractHostFromPattern,
  extractHostsFromPattern,
  generalizeGroupedHostPattern,
  normalizeMitmRulePattern,
};
