import vm from "node:vm";
import { convertModule, internals } from "../src/core.mjs";

export const scriptModule = (scriptPath = "https://example.com/s.js", options = "") => `[Script]\ns=type=http-response,pattern=^https://example.com/,requires-body=1,script-path=${scriptPath}${options}\n[MITM]\nhostname=example.com`;

export function convertScript(source, options = {}) {
  return convertModule(scriptModule("https://example.com/s.js", options.binary ? ",binary-body-mode=1" : ""), {
    fetchScripts: true, scriptTextByURL: { "https://example.com/s.js": source }, ...options,
  });
}

export async function runConverted(result, input, overrides = {}, context = {}) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const ctx = { body: bytes, phase: "response", url: "https://example.com/feed", method: "GET", headers: [], status: 200, ...context };
  const errors = [], responses = []; let decodes = 0; let done = 0;
  const scope = vm.createContext({ ctx, console: { log(){}, warn(){}, error:e=>errors.push(String(e)) }, Anywhere: {
    codec: {
      utf8: { encode: s => new TextEncoder().encode(s), decode: b => { decodes++; return new TextDecoder().decode(b); } },
      base64: { encode: b => Buffer.from(b).toString("base64"), decode: s => new Uint8Array(Buffer.from(s, "base64")) },
    },
    done: () => done++, log: { error: e => errors.push(String(e)), info() {}, warning() {} },
    respond: value => responses.push(value),
    store: { getString() {}, set() {}, delete() {} },
    ...overrides,
  }});
  for (const line of result.files[0].content.split("\n")) {
    if (!(ctx.phase === 'request' ? /^0, 100,/ : /^1, 100,/).test(line)) continue;
    const fields = internals.parseCsv(line);
    if (!new RegExp(fields[2]).test(ctx.url)) continue;
    const code = Buffer.from(fields[3], "base64").toString();
    const running = vm.runInContext(code + ";process(ctx)", scope, { timeout: 2000 });
    let timer;
    try { await Promise.race([running, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("adapter did not settle")), 2000); })]); }
    finally { clearTimeout(timer); }
  }
  return { bytes: ctx.body, text: new TextDecoder().decode(ctx.body), errors, responses, decodes, done };
}

export async function runUpstream(source, input) {
  let output = input;
  const scope = vm.createContext({ $response: { body: input }, $request: { url: "https://example.com/feed" }, $done: value => { output = value?.body ?? output; } });
  try { await vm.runInContext("(function(){" + source + "})()", scope, { timeout: 2000 }); } catch {}
  return output;
}
