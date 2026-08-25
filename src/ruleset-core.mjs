import { normalizeIconBase64 } from "./core.mjs";

const RULE_TYPES = new Map([
  [0, { key: "ipCIDR", label: "IPv4 CIDR", placeholder: "10.0.0.0/8" }],
  [1, { key: "ipCIDR6", label: "IPv6 CIDR", placeholder: "2001:db8::/32" }],
  [2, { key: "domainSuffix", label: "域名后缀", placeholder: "example.com" }],
  [3, { key: "domainKeyword", label: "域名关键字", placeholder: "example" }],
]);

export const RULESET_LIMITS = Object.freeze({
  maxRules: 100000,
  maxBytes: 8 * 1024 * 1024,
  maxNameLength: 120,
  maxRuleValueBytes: 65535,
});

export const RULESET_TYPES = Object.freeze([...RULE_TYPES].map(([id, value]) => ({ id, ...value })));

export function parseArrs(source, options = {}) {
  const maxRules = Number(options.maxRules || RULESET_LIMITS.maxRules);
  const maxBytes = Number(options.maxBytes || RULESET_LIMITS.maxBytes);
  const text = String(source || "").replace(/\r\n?/g, "\n");
  const bytes = byteLength(text);
  const diagnostics = [];
  const headers = { name: "", routing: 0, iconLight: "", iconDark: "" };
  const rules = [];
  const seen = new Set();
  if (bytes > maxBytes) {
    diagnostics.push(diagnostic("error", "ruleset-too-large", `规则集正文超过 ${formatBytes(maxBytes)} 上限。`));
    return { headers, rules, diagnostics, bytes, valid: false };
  }
  for (const [offset, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    const lineNumber = offset + 1;
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const header = parseHeader(line);
    if (header) {
      if (header.key === "name") headers.name = header.value.slice(0, RULESET_LIMITS.maxNameLength);
      if (header.key === "routing") headers.routing = normalizeRouting(header.value);
      if (header.key === "icon-light") headers.iconLight = header.value;
      if (header.key === "icon-dark") headers.iconDark = header.value;
      continue;
    }
    const parsed = parseRule(line);
    if (!parsed) {
      diagnostics.push(diagnostic("warning", "ruleset-line-skipped", "无法识别的规则行已跳过。", lineNumber, raw));
      continue;
    }
    const rule = normalizeRule(parsed);
    if (!rule) {
      diagnostics.push(diagnostic("warning", "ruleset-rule-invalid", "规则值无效或超过长度上限，已跳过。", lineNumber, raw));
      continue;
    }
    const key = `${rule.type}\u001f${rule.value}`;
    if (seen.has(key)) {
      diagnostics.push(diagnostic("info", "ruleset-rule-duplicate", "重复规则已合并。", lineNumber, raw));
      continue;
    }
    seen.add(key);
    rules.push(rule);
    if (rules.length > maxRules) {
      diagnostics.push(diagnostic("error", "ruleset-rule-limit", `规则数超过 Anywhere 的 ${maxRules.toLocaleString("en-US")} 条上限。`));
      break;
    }
  }
  return { headers, rules, diagnostics, bytes, valid: !diagnostics.some((item) => item.level === "error") };
}

export function buildArrs(input = {}) {
  const parsed = Array.isArray(input.rules)
    ? normalizeRules(input.rules)
    : parseArrs(input.source || "");
  const rules = Array.isArray(parsed) ? parsed : parsed.rules;
  const diagnostics = Array.isArray(parsed) ? [] : parsed.diagnostics;
  const headers = input.headers || (!Array.isArray(parsed) ? parsed.headers : {});
  const name = sanitizeName(input.name ?? headers.name ?? "未命名规则集");
  const routing = normalizeRouting(input.routing ?? headers.routing ?? 0);
  const lines = [
    "# Published by Anywhere Converter Rule Studio",
    `name = ${name}`,
    `routing = ${routing}`,
  ];
  const iconLight = normalizeIconHeader(input.iconLight ?? headers.iconLight, "icon-light", diagnostics);
  const iconDark = normalizeIconHeader(input.iconDark ?? headers.iconDark, "icon-dark", diagnostics);
  if (iconLight) lines.push(`icon-light = ${iconLight}`);
  if (iconDark) lines.push(`icon-dark = ${iconDark}`);
  lines.push("");
  for (const rule of rules) lines.push(`${rule.type}, ${rule.value}`);
  const content = lines.join("\n").trimEnd() + "\n";
  const bytes = byteLength(content);
  if (rules.length > RULESET_LIMITS.maxRules) diagnostics.push(diagnostic("error", "ruleset-rule-limit", `规则数超过 Anywhere 的 ${RULESET_LIMITS.maxRules.toLocaleString("en-US")} 条上限。`));
  if (bytes > RULESET_LIMITS.maxBytes) diagnostics.push(diagnostic("error", "ruleset-too-large", `规则集正文超过 ${formatBytes(RULESET_LIMITS.maxBytes)} 上限。`));
  return { content, name, routing, rules, ruleCount: rules.length, bytes, diagnostics, valid: !diagnostics.some((item) => item.level === "error") };
}

export function addRule(source, type, value) {
  const parsed = parseArrs(source);
  const rule = normalizeRule({ type: Number(type), value });
  if (!rule) return { ...parsed, diagnostics: [...parsed.diagnostics, diagnostic("error", "ruleset-rule-invalid", "请输入有效规则。")] };
  return buildArrs({ headers: parsed.headers, rules: [...parsed.rules, rule] });
}

export function normalizeRouting(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "1" || text === "direct") return 1;
  if (text === "2" || text === "reject") return 2;
  return 0;
}

export function sanitizeName(value) {
  return String(value || "未命名规则集").replace(/[\r\n=]/g, " ").trim().slice(0, RULESET_LIMITS.maxNameLength) || "未命名规则集";
}

export function ruleTypeInfo(type) {
  return RULE_TYPES.get(Number(type)) || null;
}

function parseHeader(line) {
  const equal = line.indexOf("=");
  if (equal < 1) return null;
  const key = line.slice(0, equal).trim().toLowerCase();
  if (!new Set(["name", "routing", "icon-light", "icon-dark"]).has(key)) return null;
  return { key, value: line.slice(equal + 1).trim() };
}

function parseRule(line) {
  const comma = line.indexOf(",");
  if (comma < 1) return null;
  const type = Number(line.slice(0, comma).trim());
  if (!RULE_TYPES.has(type)) return null;
  return { type, value: line.slice(comma + 1).trim() };
}

function normalizeRules(rules) {
  const out = [];
  const seen = new Set();
  for (const candidate of rules || []) {
    const rule = normalizeRule(candidate);
    if (!rule) continue;
    const key = `${rule.type}\u001f${rule.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function normalizeRule(candidate) {
  const type = Number(candidate?.type);
  if (!RULE_TYPES.has(type)) return null;
  let value = String(candidate?.value || "").trim().replace(/\s+/g, "");
  if (!value || byteLength(value) > RULESET_LIMITS.maxRuleValueBytes) return null;
  if (type === 0 && !value.includes("/")) value += "/32";
  if (type === 1 && !value.includes("/")) value += "/128";
  if (type === 2 || type === 3) value = value.toLowerCase().replace(/^\*\./, "").replace(/^\./, "").replace(/\.$/, "");
  return value ? { type, value } : null;
}

function normalizeIconHeader(value, header, diagnostics) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = normalizeIconBase64(raw);
  if (normalized.error) {
    diagnostics.push(diagnostic("error", "ruleset-icon-invalid", header + "：" + normalized.error));
    return "";
  }
  return normalized.base64;
}

function diagnostic(level, code, message, line = 0, source = "") {
  return { level, code, message, line, source };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function formatBytes(value) {
  return `${Math.round(Number(value || 0) / (1024 * 1024))} MiB`;
}
