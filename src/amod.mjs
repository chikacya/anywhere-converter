export const MODULE_LIMITS = Object.freeze({ sets: 64, iconBytes: 65536, encodedBytes: 900000 });

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
  let rules = 0, parameters = 0;
  const errors = [];
  for (const s of sections) {
    if (s.type === "module") {
      for (const match of s.content.matchAll(/^icon-(?:light|dark)\s*=\s*(\S+)/gm)) {
        const base64 = match[1];
        const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
        if (bytes > MODULE_LIMITS.iconBytes || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) errors.push("模块图标无效或超过 64 KiB。");
      }
      continue;
    }
    let param = false, count = 0, parameterCount = 0;
    for (const line of s.content.split("\n")) {
      if (/^\s*\[Parameter\]/i.test(line)) param = true;
      if (/^\s*\[Rule\]/i.test(line)) param = false;
      if (/^\s*\d+,/.test(line)) { if (param) parameterCount++; else count++; }
    }
    rules += count; parameters += parameterCount;
    if (count > (s.type === "mitm" ? 10000 : 100000) || parameterCount > 256) errors.push("模块子规则集超过原生规则/参数上限。");
  }
  if (!sets.length || sets.length > MODULE_LIMITS.sets) errors.push("模块必须包含 1–64 个子规则集。");
  // Conservative upper bound, not .amod text size or an exact Swift JSONEncoder
  // reproduction. Account for escaped strings, UUID/model keys and parameters.
  // Fall back to standalone files before getting near the native sync limit.
  const encodedUpperBound = new TextEncoder().encode(JSON.stringify(content).replaceAll("/", "\\/")).length + rules * 512 + parameters * 1024 + sets.length * 2048 + 4096;
  if (encodedUpperBound > MODULE_LIMITS.encodedBytes) errors.push("模块编码预算可能超过 900,000 字节，请使用独立 AMRS/ARRS。");
  return { sets: sets.length, encodedUpperBound, errors };
}

export function packageAmod(result, options) {
  if (options.outputFormat !== "amod" || !result.files.length) return result;
  const first = result.files[0];
  const name = options.name || result.metadata?.name || first.name.replace(/\.[^.]+$/, "");
  const lines = ["[Module]", "name = " + name.replace(/[\r\n]/g, " ")];
  const icon = first.content.match(/^icon-light\s*=\s*(\S+)/m)?.[1];
  if (icon) lines.push("icon-light = " + icon);
  for (const file of result.files) {
    lines.push("", file.type === "amrs" ? "[MITM]" : "[Routing]", file.content.replace(/^icon-(?:light|dark)\s*=.*\n?/gm, "").trimEnd());
  }
  const content = lines.join("\n") + "\n";
  const budget = moduleBudget(content);
  if (budget.errors.length) {
    result.diagnostics.push({ level: "warning", code: "amod-budget-fallback", message: budget.errors.join(" ") });
    return result;
  }
  result.files = [{ name: first.name.replace(/\.[^.]+$/, ".amod"), type: "amod", content, ruleCount: result.files.reduce((sum, f) => sum + f.ruleCount, 0), moduleBudget: budget }];
  return result;
}
