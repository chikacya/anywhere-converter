import { parse } from "acorn";

const SCRIPT_ACTION = /^script-(request|response)-(header|body)$/;
const SECTION_NAMES = new Map([
  ["mitm", "MITM"], ["rewrite", "Rewrite"], ["url rewrite", "URL Rewrite"],
  ["rewrite_local", "Rewrite"], ["rule", "Rule"], ["filter_local", "Rule"],
  ["script", "Script"], ["map local", "Map Local"], ["body rewrite", "Body Rewrite"],
  ["header rewrite", "Header Rewrite"], ["argument", "Argument"], ["arguments", "Arguments"],
]);

export function normalizeSection(name) {
  return SECTION_NAMES.get(name.trim().toLowerCase()) || name.trim();
}

export function parseQXRewrite(text) {
  const match = text.match(/^(\S+)\s+url\s+(\S+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const [, pattern, rawAction, rawValue = ""] = match;
  const action = rawAction.toLowerCase(), value = rawValue.trim();
  const base = { dialect: "quantumult-x", pattern, action, value };
  const script = action.match(SCRIPT_ACTION);
  if (script || /^script-(?:analyze-)?echo-response$/.test(action)) {
    if (!/^https?:\/\/\S+$/i.test(value)) return { ...base, error: "qx-local-script", message: "QX 本地脚本路径不可下载，请提供远程 JS URL 或在脚本补全中提供源码。" };
    return { ...base, section: "Script", script: {
      dialect: "quantumult-x", phase: script?.[1] === "response" ? 1 : 0,
      pattern, path: value, requiresBody: script?.[2] === "body" || action === "script-analyze-echo-response",
      qxEcho: /echo-response$/.test(action), binaryBodyMode: false, argument: "",
    } };
  }
  if (["reject-200", "reject-img", "reject-dict", "reject-array", "reject", "301", "302", "303", "307", "308"].includes(action)) {
    return { ...base, section: "Rewrite", text: `${pattern} ${action}${value ? " " + value : ""}` };
  }
  if (action === "request-body" || action === "response-body") {
    const separator = new RegExp("\\s+" + action + "(?:\\s+|$)").exec(value);
    if (!separator) return { ...base, error: "qx-body-rewrite-invalid", message: "QX body rewrite 缺少第二个 request-body/response-body 分隔符。" };
    return { ...base, section: "Rewrite", bodyReplace: {
      phase: action === "response-body" ? 1 : 0,
      search: value.slice(0, separator.index), replacement: value.slice(separator.index + separator[0].length),
    } };
  }
  if (/^jsonjq-(request|response)-body$/.test(action)) {
    return { ...base, section: "Rewrite", text: `${pattern} ${action.includes("response") ? "response" : "request"}-body-json-jq ${value}` };
  }
  return { ...base, error: "qx-rewrite-unsupported", message: `QX ${action} 无完整等价映射，已跳过；整段头正则、echo-response 资源和 task 不能作为普通 URL rewrite 猜测。` };
}

// Only an actual parsed JS program can use rule metadata inside comments. Never
// execute a config's prose, or bind this source to unrelated URLs in its header.
export function scriptCommentConfig(source, options = {}) {
  const comments = [];
  let ast;
  try { ast = parse(source, { ecmaVersion: "latest", allowReturnOutsideFunction: true, onComment: comments }); }
  catch { return null; }
  if (!ast.body.length || !/\$(?:request|response|done|task|prefs)\b/.test(source)) return null;
  const rules = [], hosts = [], metadata = {};
  for (const comment of comments) for (const line of comment.value.split(/\r?\n/)) {
    const text = line.trim().replace(/^\*\s?/, "");
    const rule = parseQXRewrite(text);
    if (rule?.script) rules.push({ ...rule, line: source.slice(0, comment.start).split("\n").length, raw: text });
    const hostname = text.match(/^hostname\s*=\s*(.*)$/i);
    if (hostname) hosts.push(...hostname[1].split(",").map(x => x.trim()).filter(Boolean));
    const title = text.match(/^(?:@ScriptName\s+|脚本名称\s*[:：]\s*)(.+)$/i);
    if (title) metadata.name = title[1].trim();
  }
  const pathKey = raw => { try { const u = new URL(raw); u.hash = ""; u.search = ""; return u.href; } catch { return raw; } };
  const paths = new Set(rules.map(r => pathKey(r.script.path)));
  const selected = options.sourceUrl
    ? rules.filter(r => pathKey(r.script.path) === pathKey(options.sourceUrl))
    : paths.size === 1 ? rules : [];
  const diagnostics = selected.length ? [] : [{ level: "warning", code: "script-metadata-required", message: "独立 JS 缺少与当前脚本对应的 URL 匹配、阶段或 hostname 信息；请提供关联 rewrite，不能猜测拦截范围。", line: 0, source: "" }];
  return { metadata, hostnames: hosts, arguments: {}, diagnostics, items: selected.map(rule => ({
    section: "Script", dialect: "quantumult-x", text: rule.raw, raw: rule.raw, line: rule.line,
    script: { ...rule.script, inlineScript: source },
  })) };
}
