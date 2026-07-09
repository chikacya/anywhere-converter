# JavaScript Mapping And Lift

This document defines how the generic converter handles Loon/Surge JavaScript. Hand-converted modules remain validation oracles; they are not templates for generated output.

## Goals

- Always allow opt-in remote script fetching in compat mode.
- Preserve ordinary Loon/Surge JSON rewrite scripts through the compatibility wrapper.
- Lift only high-confidence JavaScript patterns into Anywhere native operations.
- Keep protobuf, binary schemas, large bundles, external HTTP workflows, and complex async logic as `sample-required` or compat script output. External HTTP is still supported by the compat wrapper through `Anywhere.http.request()`; it is just not treated as a native body/header lift.
- Separate default native lift from `aggressive` native lift. Default `compat` should lift 100% statically provable JavaScript, including static URL-guarded JSON mutations. `aggressive` is reserved for common but slightly more assumption-heavy patterns such as array `splice(0)` clears.

## API Compatibility Mapping

| Loon/Surge API | Anywhere mapping | Converter behavior |
| --- | --- | --- |
| `$request.url` | `ctx.url` | Readable in wrapper. Request URL mutation is not considered native-safe. |
| `$request.method` | `ctx.method` | Readable in wrapper. Method mutation is not native-safe. |
| `$request.headers` | `ctx.headers` converted to an object | Readable in wrapper. Header mutation needs explicit native header rules or manual review. |
| `$request.body` | decoded `ctx.body` text | Preserved for text bodies. Binary request bodies remain risky. |
| `$response.status` | `ctx.status` | Readable in wrapper. |
| `$response.headers` | `ctx.headers` converted to an object | Readable in wrapper. |
| `$response.body` | decoded `ctx.body` text | Preserved for text response scripts. |
| `$done({ body })` | assign `ctx.body`, then `Anywhere.done()` | Supported by compat wrapper. Response bodies that grow more than 65,535 bytes over the original body are left unchanged to avoid Anywhere's HTTP/2 `response grew over cap` fallback. |
| `$done({ response })` | `Anywhere.respond()` | Supported for request-phase mock/redirect style scripts. |
| `$done({})` | `Anywhere.done()` | Supported. |
| `$persistentStore.read/write` | `Anywhere.store.getString/set` | Supported for simple string values. |
| `$prefs.valueForKey/setValueForKey` | `$persistentStore` aliases | Supported. |
| `$argument` | parsed `argument=` string | Supported in compat wrapper for script-level arguments. |
| `$httpClient.get/post/put/delete` | `Anywhere.http.request()` | Preserved with async lifecycle waiting and warning because it parks the current connection and needs timeout/budget validation. |
| `$task.fetch` | `Anywhere.http.request()` Promise wrapper | Preserved for common Quantumult X / mixed Env scripts, with the same external HTTP warning and budget caveats. |
| global `fetch()` | `Anywhere.http.request()` response-like Promise | Preserved in compat wrapper for common `text()`, `json()`, `arrayBuffer()`, `status`, `ok`, `headers`, and `url` usage. |
| `timeout=` script option | bounded compat wait timeout | Parsed for wrapped scripts and clamped to 1-10 seconds so upstream `timeout=60` does not stall Anywhere indefinitely. |
| Remote script download budget | diagnostics before wrapping | Enforced by `maxScriptBytes` and `maxTotalScriptBytes`; oversized scripts are skipped with explicit warnings. |
| `$notification` / `$notify` | no-op | Preserved as no-op. |
| `$utils.gzip/ungzip` | `Anywhere.codec.gzip` | Preserved. |
| `TextEncoder` / `TextDecoder` | Anywhere text codec globals, fallback to `Anywhere.codec.utf8` | Preserved in compat wrapper. |
| `atob` / `btoa` | `Anywhere.codec.base64` fallback | Preserved in compat wrapper for common base64 helpers. |
| `crypto.getRandomValues` / `crypto.randomUUID` | `Anywhere.crypto.randomBytes` / `Anywhere.crypto.uuid` fallback | Preserved in compat wrapper. Full `crypto.subtle` is not emulated. |
| `bodyBytes` / protobuf buffers | `Anywhere.codec.protobuf` only when hand-written | Generic converter does not infer field-level protobuf edits; mark `sample-required`. |
| `import` / `importScripts` | none | Hard blocker. |
| `eval()` / `new Function()` in source scripts | compat wrapper only | Preserved as `sample-required`; dynamic runtime code cannot be considered stable without samples. |
| Env helper `getdata/setdata/getjson/setjson/get/post/wait/time/queryStr/done` | wrapper Env shim | Implemented for common BoxJS/Env-style scripts; not a full task/runtime implementation. |
| Env template `require(...)` branch | no direct mapping | Warning only; common Node.js branches are kept but need real-device validation. |

Response growth note: Anywhere decodes negotiated response compression before body scripts, then applies a relative growth cap on HTTP/2 response rewrites. Scripts that decrypt or decompress an inner payload must re-encode it in the original shape when possible; otherwise the converted body can be discarded by the runtime even if the JavaScript itself succeeds.

## Native Lift Table

Native lift runs before compat wrapping. It is intentionally narrow: if a script does not exactly match a safe pattern, the converter keeps it as a compat script.

| JavaScript pattern | Anywhere native output | Current status |
| --- | --- | --- |
| `const obj = JSON.parse($response.body); delete obj.a.b; $done({ body: JSON.stringify(obj) })` | `body-json delete $.a.b` | Implemented for scripts without control flow. |
| `obj.a.b = true/false/null/number/"text"; $done({ body: JSON.stringify(obj) })` | `body-json replace $.a.b <literal>` | Implemented for scripts without control flow. |
| `const EMPTY = []; obj.a.b = EMPTY` | `body-json replace $.a.b []` | Implemented for JSON literal constants (`string/number/boolean/null/object/array`) without control flow. |
| `$response.body = $response.body.replace(/regex/g, "value"); $done({ body: $response.body })` | `body-replace regex value` | Implemented for simple literal replacements. |
| Array `filter` removing `field !== literal` | `body-json remove-where-field-in` | Implemented for single-field literal exclusions without control flow. |
| Array `filter` removing multiple exact values on the same field | `body-json remove-where-field-in` | Implemented for `item.field !== a && item.field !== b` and `![a,b].includes(item.field)`. |
| Static URL guard around JSON mutation | URL-intersection `body-json` rules | Implemented in default compat when the branch condition and mutation path are static. |
| Supported jq `map(select(...))` filters that exceed native body-json | generated JSON response script | Implemented for nested array field exclusion, title regex exclusion, and keep-only equality filters. |
| Trivial recursive `delete node.ad` walkers | `body-json delete-recursive ad` | Implemented only when the script parses JSON, recursively walks from the parsed root, deletes direct fields, and stringifies the same root. |
| `$done({ response: { status, headers, body } })` | lightweight request script with `Anywhere.respond()` | Implemented for fixed status, string body, and static string headers. |
| `decodeURIComponent(queryParam)` then `$done({ response: { status: 302, headers: { Location } } })` | lightweight request redirect script | Implemented for common query-parameter redirectors such as `url=...`; target must decode to `http(s)`. |
| `$request.url = "https://..."` then `$done($request)` | request rewrite transparent target | Implemented for static target URLs. |
| `$request.url = $request.url.replace(/^https:\/\/old\/(.*)/, "https://new/$1")` | request rewrite transparent target | Implemented only when replacement is a complete `http(s)` target. |
| `let url = $request.url; url = url.replace(/a/, "b"); $done({ url })` | lightweight request proxy script with `Anywhere.http.request()` and `Anywhere.respond()` | Implemented for simple static string/regex replacements on the local URL variable. This is a proxy fallback for request URL mutation, not a full JS interpreter. |
| `$request.headers["name"] = "value"` then `$done($request)` | request header replace | Implemented for static names and values. |
| `delete $request.headers["name"]` then `$done($request)` | request header delete | Implemented for static names. |
| `const name = "x"; $request.headers[name] = "v"` | request header replace/delete | Implemented for string literal constants only. |
| `Object.assign($request.headers, { "x": "1" })` | request header replace | Implemented for static string header objects. |
| `$done({ url: "https://...", headers: { "x": "1" } })` | request rewrite + header replace | Implemented for static URL and static string headers. |
| Dynamic request URL/header mutation | compat/manual | Not lifted unless the target and header values are static and high-confidence. |

## Aggressive Native Lift

`aggressive` mode is opt-in. It is for patterns that are still static, but need a little more context than the default path is willing to assume.

| JavaScript pattern | Anywhere output | Why it is aggressive |
| --- | --- | --- |
| `obj.data.items.splice(0)` | `body-json replace $.data.items []` | Common array-clear idiom, but not 100% equivalent if the source value is not an array. |
| `if ($request.url.includes("/feed")) { obj.data.items.splice(0) }` | URL-intersection `body-json replace $.data.items []` | Same array-type assumption, plus branch splitting. |

Aggressive lift does not native-lift:

- protobuf/binary scripts,
- `eval`, `new Function`, `import`, `importScripts`, or `require`,
- `$httpClient`, `$task.fetch`, `fetch`, or `XMLHttpRequest` driven transformations; `$httpClient` and `$task.fetch` remain supported through the compatibility wrapper using `Anywhere.http.request()`,
- dynamic object paths or root object reassignment,
- helper calls such as `clean(obj)` where the mutation body is outside the visible branch,
- nested control flow inside the lifted branch.

This means `aggressive` can improve classic JSON ad-cleanup scripts, but it is not a general JavaScript interpreter.

## Non-Lift Cases

The converter must not lift these into native rules automatically:

- Control flow that changes behavior by URL, status, headers, or nested runtime conditions.
- Dynamic object paths or computed property names.
- Cross-request storage logic.
- External HTTP enrichment as native `body-json` or header rules. `$httpClient` and `$task.fetch` are preserved in compat scripts through `Anywhere.http.request()`.
- Crypto, protobuf, flatbuffer, or arbitrary binary parsing.
- Full WebCrypto `crypto.subtle` workflows. The compat wrapper only provides random helpers because those map cleanly to `Anywhere.crypto`.
- Runtime dynamic code execution through `eval()` or `new Function()`.
- Large bundles or minified app-specific frameworks.
- Feed cleanup requiring real response samples to identify item schema.

## Status Semantics

- `stable`: native rules only, no warnings.
- `partial`: native rules or compat scripts emitted with warnings.
- `sample-required`: rules are emitted, but binary/protobuf/high-frequency feed behavior needs real traffic validation before the result is considered stable.
- `blocked`: source cannot be fetched, has hard unsupported imports, or emits no usable rule.
