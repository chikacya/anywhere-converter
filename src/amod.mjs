export const MODULE_LIMITS = Object.freeze({ sets: 64, iconBytes: 65536, encodedBytes: 900000 });

const UUID = "00000000-0000-0000-0000-000000000000";
const utf8 = new TextEncoder();
const jsonBytes = value => utf8.encode(JSON.stringify(value).replaceAll("/", "\\/")).length;

// Match the native CSV parser: whitespace inside quoted strings is significant.
function csv(input) {
  const fields = []; let i = 0;
  while (true) {
    while (/[ \t]/.test(input[i] || "\n")) i++;
    let value = "";
    if (input[i] === '"') {
      i++;
      while (i < input.length) {
        if (input[i] === '"') {
          i++;
          if (input[i] !== '"') break;
        }
        value += input[i++];
      }
      while (/[ \t]/.test(input[i] || "\n")) i++;
    } else {
      while (i < input.length && input[i] !== ",") value += input[i++];
      value = value.trim();
    }
    fields.push(value);
    if (i >= input.length) return fields;
    i++;
  }
}

// Coding keys from Shared/Models/{Module,RoutingRule,MITMRule}.swift.
// Rule UUIDs and routing seeds are not encoded in Module; scripts stay base64.
function mitmRule(fields) {
  const [phase, op, urlPattern, ...args] = fields;
  let operation;
  switch (op) {
    case "0": {
      const [mode, value = ""] = args;
      const kind = ["transparent", "redirect302", "reject200Text", "reject200Gif", "reject200Data"][Number(mode)];
      if (!kind) throw Error("未知 Rewrite 类型");
      const rewrite = { kind };
      if (mode === "0" || mode === "1") rewrite.url = value;
      else if (mode === "2") rewrite.content = value;
      else if (mode === "4") rewrite.base64 = value;
      operation = { kind: "rewrite", rewrite };
      break;
    }
    case "1": case "3": operation = { kind: op === "1" ? "headerAdd" : "headerReplace", name: args[0], value: args[1] }; break;
    case "2": operation = { kind: "headerDelete", name: args[0] }; break;
    case "4": operation = { kind: "bodyReplace", search: args[0], replacement: args[1] }; break;
    case "5": {
      const actions = {
        add: ["add", "path", "value"], replace: ["replace", "path", "value"], delete: ["delete", "path"],
        "replace-recursive": ["replaceRecursive", "key", "value"], "delete-recursive": ["deleteRecursive", "key"],
        "remove-where-key-exists": ["removeWhereKeyExists", "path", "key"],
        "remove-where-field-in": ["removeWhereFieldIn", "path", "field", "values"],
      };
      const spec = actions[args[0]];
      if (!spec) throw Error("未知 JSON 操作");
      const json = { action: spec[0] };
      spec.slice(1).forEach((key, i) => { json[key] = args[i + 1]; });
      operation = { kind: "bodyJSON", json };
      break;
    }
    case "100": case "101": operation = { kind: op === "100" ? "script" : "streamScript", script: args[0] }; break;
    default: throw Error("未知 MITM 操作");
  }
  return { phase: op === "0" || phase === "0" ? "httpRequest" : "httpResponse", urlPattern, operation };
}

function parameter(fields) {
  const [type, dataType, name, label, description, initial, choices = ""] = fields;
  const options = type === "1" ? choices.replace(/^\[/, "").replace(/\]$/, "").split(",").map(x => x.trim()).filter(Boolean) : [];
  const defaultValue = type === "1" && !initial ? options[0] || "" : initial;
  if (type === "1" && defaultValue && !options.includes(defaultValue)) options.unshift(defaultValue);
  return { type: Number(type), dataType: Number(dataType), name, defaultValue, options,
    ...(label ? { label } : {}), ...(description ? { description } : {}) };
}

export function splitAmod(content) {
  const sections = []; let current = { type: "module", content: "" };
  for (const line of String(content).split(/\r?\n/)) {
    const marker = line.trim().match(/^\[\s*(Module|Routing|MITM)\s*\]$/i);
    if (marker) { sections.push(current); current = { type: marker[1].toLowerCase(), content: "" }; }
    else current.content += line + "\n";
  }
  sections.push(current);
  return sections.filter(s => s.content.trim());
}

export function moduleBudget(content) {
  const sections = splitAmod(content);
  const sets = sections.filter(x => x.type !== "module");
  const errors = [];
  const model = { id: UUID, name: "", enabled: true, routingRuleSets: [], mitmRuleSets: [], updatedAt: 999999999.999999 };
  for (const s of sections) {
    if (s.type === "module") {
      for (const raw of s.content.split("\n")) {
        const header = raw.trim().match(/^(name|description|icon-light|icon-dark)\s*=\s*(.*)$/i);
        if (!header) continue;
        const key = header[1].toLowerCase(), value = header[2].trim();
        if (key.startsWith("icon-")) {
          const bytes = Math.floor(value.length * 3 / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
          if (bytes > MODULE_LIMITS.iconBytes || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) errors.push("模块图标无效或超过 64 KiB。");
          model[key === "icon-light" ? "iconLight" : "iconDark"] = value;
        } else if (key === "name" || value) model[key] = value;
      }
      continue;
    }
    const isMITM = s.type === "mitm";
    const collection = isMITM ? model.mitmRuleSets : model.routingRuleSets;
    const child = { id: UUID, name: "", rules: [], ...(isMITM ? { enabled: true, domainSuffixes: [] } : {}) };
    let section = "rule";
    const parameters = [];
    for (const raw of s.content.split("\n")) {
      const line = raw.trim();
      if (!line || /^(#|\/\/)/.test(line)) continue;
      const marker = line.match(/^\[\s*(.*?)\s*\]$/);
      if (marker) { section = /^(parameter|parameters|param|params)$/i.test(marker[1]) ? "parameter" : /^(rule|rules)$/i.test(marker[1]) ? "rule" : "ignored"; continue; }
      const header = line.match(/^(name|hostname|routing|icon-light|icon-dark)\s*=\s*(.*)$/i);
      if (header) {
        if (header[1].toLowerCase() === "name") child.name = header[2].trim();
        if (isMITM && header[1].toLowerCase() === "hostname") child.domainSuffixes = header[2].split(",").map(x => x.trim()).filter(Boolean);
        continue;
      }
      if (!(isMITM ? /^"?\d+"?\s*,/ : /^\d+\s*,/).test(line)) continue;
      try {
        if (!isMITM) {
          const comma = line.indexOf(","), type = Number(line.slice(0, comma));
          let value = line.slice(comma + 1).trim();
          if ((type === 0 || type === 1) && !value.includes("/")) value += type === 0 ? "/32" : "/128";
          child.rules.push({ type, value });
        } else if (section === "parameter") parameters.push(parameter(csv(line)));
        else if (section === "rule") child.rules.push(mitmRule(csv(line)));
      } catch (error) { errors.push("无法估算模块编码：" + error.message); }
    }
    if (!child.name) child.name = (isMITM ? "MITM " : "Routing ") + (collection.length + 1);
    if (parameters.length) child.parameters = parameters;
    collection.push(child);
    if (child.rules.length > (isMITM ? 10000 : 100000) || parameters.length > 256) errors.push("模块子规则集超过原生规则/参数上限。");
  }
  if (!sets.length || sets.length > MODULE_LIMITS.sets) errors.push("模块必须包含 1–64 个子规则集。");
  // Native JSONEncoder escapes slashes. Reserve space for subscriptionURL,
  // date representation and ordinary parameter overrides. Arbitrarily long
  // user edits remain subject to the app's final validateLimits() check.
  const encodedBytes = jsonBytes(model), reservedBytes = 4096;
  const encodedUpperBound = encodedBytes + reservedBytes;
  if (encodedUpperBound > MODULE_LIMITS.encodedBytes) errors.push("模块编码预算可能超过 900,000 字节，请使用独立 AMRS/ARRS。");
  return { sets: sets.length, encodedBytes, reservedBytes, encodedUpperBound, errors };
}

export function packageAmod(result, options) {
  const format = options.outputFormat || "auto";
  if (format === "standalone" || (format !== "amod" && result.sourceKind !== "module") || !result.files.length) return result;
  const first = result.files[0];
  const name = options.name || result.metadata?.name || first.name.replace(/\.[^.]+$/, "");
  const lines = ["[Module]", "name = " + name.replace(/[\r\n]/g, " ")];
  const description = String(options.description ?? result.metadata?.description ?? result.metadata?.desc ?? "").replace(/[\r\n\u0000]/g, " ").trim();
  if (description) lines.push("description = " + description);
  const icon = first.content.match(/^icon-light\s*=\s*(\S+)/m)?.[1];
  if (icon) lines.push("icon-light = " + icon);
  for (const file of result.files) {
    lines.push("", file.type === "amrs" ? "[MITM]" : "[Routing]", file.content.replace(/^icon-(?:light|dark)\s*=.*\n?/gm, "").trimEnd());
  }
  const content = lines.join("\n") + "\n";
  const budget = moduleBudget(content);
  if (budget.errors.length) {
    result.diagnostics.push({ level: "warning", code: "amod-budget-fallback", message: budget.errors.join(" ") + " 已保留完整独立文件，请使用本次生成的独立订阅链接。" });
    return result;
  }
  result.files = [{ name: first.name.replace(/\.[^.]+$/, ".amod"), type: "amod", content, ruleCount: result.files.reduce((sum, f) => sum + f.ruleCount, 0), moduleBudget: budget }];
  return result;
}
