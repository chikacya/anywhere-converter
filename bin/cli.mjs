#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { convertAnyAsync, normalizeIconBase64, validateAnywhereOutput } from "../src/core.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._ = [...(args._ || []), item];
      continue;
    }
    const [rawKey, inline] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const value = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
    if (key === "argument") args.argument = [...(args.argument || []), value];
    else if (key === "scriptText") args.scriptText = [...(args.scriptText || []), value];
    else args[key] = value;
  }
  return args;
}

function parseArgumentOverrides(args) {
  const out = {};
  if (args.arguments) {
    try {
      Object.assign(out, JSON.parse(args.arguments));
    } catch (error) {
      console.error(`Invalid --arguments JSON: ${error.message}`);
      process.exit(2);
    }
  }
  for (const entry of args.argument || []) {
    const split = String(entry).split("=", 2);
    if (split.length !== 2 || !split[0]) {
      console.error(`Invalid --argument value: ${entry}`);
      process.exit(2);
    }
    out[split[0]] = split[1];
  }
  return out;
}

function loadScriptTextOverrides(args) {
  const out = {};
  if (args.scriptTextByURL) {
    try {
      Object.assign(out, JSON.parse(args.scriptTextByURL));
    } catch (error) {
      console.error(`Invalid --script-text-by-url JSON: ${error.message}`);
      process.exit(2);
    }
  }
  for (const entry of args.scriptText || []) {
    const splitAt = String(entry).indexOf("=");
    if (splitAt <= 0) {
      console.error(`Invalid --script-text value: ${entry}`);
      process.exit(2);
    }
    const url = String(entry).slice(0, splitAt);
    const file = String(entry).slice(splitAt + 1);
    out[url] = fs.readFileSync(file, "utf8");
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const input = args.input || args._?.[0];
if (!input) {
  console.error("Usage: node bin/cli.mjs --input <module.plugin|sgmodule|ruleset.list> [--icon-file icon.png | --icon-url https://...] [--source-kind auto|module|ruleset] [--rule-set-routing default|direct|reject] [--out-dir ./out] [--json]");
  process.exit(2);
}

async function loadIconBase64(args) {
  if (args.iconFile && args.iconUrl) {
    console.error("Use only one of --icon-file or --icon-url.");
    process.exit(2);
  }
  let encoded = "";
  if (args.iconFile) encoded = fs.readFileSync(args.iconFile).toString("base64");
  if (args.iconUrl) {
    const response = await fetch(args.iconUrl, { redirect: "follow" });
    if (!response.ok) throw new Error(`icon HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 256 * 1024) throw new Error("icon exceeds 262144 bytes");
    encoded = Buffer.from(await readBoundedIconBytes(response, 256 * 1024)).toString("base64");
  }
  if (!encoded) return "";
  const normalized = normalizeIconBase64(encoded);
  if (normalized.error) throw new Error(normalized.error);
  return normalized.base64;
}

async function readBoundedIconBytes(response, limit) {
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > limit) throw new Error(`icon exceeds ${limit} bytes`);
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
      throw new Error(`icon exceeds ${limit} bytes`);
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

const source = fs.readFileSync(input, "utf8");
const result = await convertAnyAsync(source, {
  name: args.name,
  mode: args.mode,
  sourceKind: args.sourceKind,
  ruleSetRouting: args.ruleSetRouting,
  arguments: parseArgumentOverrides(args),
  preserveParameters: args.preserveParameters === true || args.preserveParameters === "1" || args.preserveParameters === "true",
  iconLightBase64: await loadIconBase64(args),
  scriptTextByURL: loadScriptTextOverrides(args),
  fetchScripts: args.fetchScripts == null ? true : args.fetchScripts === "1" || args.fetchScripts === "true",
  maxScriptBytes: args.maxScriptBytes ? Number(args.maxScriptBytes) : undefined,
  maxTotalScriptBytes: args.maxTotalScriptBytes ? Number(args.maxTotalScriptBytes) : undefined,
  maxScriptFetches: args.maxScriptFetches ? Number(args.maxScriptFetches) : undefined,
  maxMapLocalBytes: args.maxMapLocalBytes ? Number(args.maxMapLocalBytes) : undefined,
  maxTotalMapLocalBytes: args.maxTotalMapLocalBytes ? Number(args.maxTotalMapLocalBytes) : undefined,
  maxMapLocalFetches: args.maxMapLocalFetches ? Number(args.maxMapLocalFetches) : undefined,
  fetchText: async (url, options = {}) => {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const maxBytes = options.maxBytes || 1024 * 1024;
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`${options.kind || "resource"} exceeds ${maxBytes} bytes`);
    return text;
  },
});

const validation = [];
for (const file of result.files) {
  validation.push({ file: file.name, diagnostics: validateAnywhereOutput(file) });
}

if (args.json) {
  console.log(JSON.stringify({ ...result, validation }, null, 2));
  process.exit(validation.some((item) => item.diagnostics.some((d) => d.level === "error")) ? 1 : 0);
}

const outDir = args.outDir || path.join(path.dirname(new URL(import.meta.url).pathname), "out");
fs.mkdirSync(outDir, { recursive: true });
for (const file of result.files) {
  fs.writeFileSync(path.join(outDir, file.name), file.content, "utf8");
}
fs.writeFileSync(path.join(outDir, "conversion-report.json"), JSON.stringify({ report: result.report, diagnostics: result.diagnostics, validation }, null, 2), "utf8");

console.log(`status: ${result.report.status}`);
console.log(`converted: ${result.report.converted}, skipped: ${result.report.skipped}, files: ${result.files.length}`);
for (const file of result.files) console.log(`- ${path.join(outDir, file.name)} (${file.ruleCount} rules)`);
const errors = validation.flatMap((item) => item.diagnostics.filter((d) => d.level === "error").map((d) => `${item.file}:${d.line} ${d.message}`));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
