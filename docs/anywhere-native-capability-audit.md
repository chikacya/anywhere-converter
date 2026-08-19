# Anywhere Native Capability Audit

This table is generated from the current Anywhere MITM script engine source and documents how the generic converter uses those native capabilities. It is a guardrail: adding a converter feature should update this file and the tests together.

| Anywhere native capability | Source API shape | Converter status | Notes |
| --- | --- | --- | --- |
| `Anywhere.codec.utf8` | `encode`, `decode` | bridged | Used by wrappers and generated scripts. Also backs `TextEncoder` / `TextDecoder` fallback. |
| `Anywhere.codec.base64` | `encode`, `decode` | bridged | Used for script loading and `atob` / `btoa` fallback. |
| `Anywhere.codec.base64url` | `encode`, `decode` | documented only | Available to hand-written scripts. No common Loon/Surge API needs automatic mapping yet. |
| `Anywhere.codec.hex` | `encode`, `decode` | documented only | Available to hand-written scripts. |
| `Anywhere.codec.gzip` | `encode`, `decode` | bridged | Exposed through `$utils.gzip` / `$utils.ungzip`. |
| `Anywhere.codec.deflate` | `encode`, `decode` | documented only | Available to hand-written scripts; not mapped to a common Loon/Surge helper yet. |
| `Anywhere.codec.brotli` | `encode`, `decode` | documented only | Available to hand-written scripts; not mapped to a common Loon/Surge helper yet. |
| `Anywhere.codec.protobuf` | `decode`, `encode`, `encodeVarint`, `decodeVarint` | preserved/manual | Generic converter marks protobuf/binary scripts as `sample-required`; it does not infer field semantics. |
| `Anywhere.crypto` | hashes, HMAC, random bytes, UUID, AES-GCM | partial bridge | `crypto.getRandomValues` and `crypto.randomUUID` are bridged. Full WebCrypto `crypto.subtle` is not emulated. |
| `Anywhere.jwt` | `decode`, `encode` | documented only | Available to hand-written scripts. No generic Loon/Surge mapping yet. |
| `Anywhere.json` | JSON path editing helpers | native output | Body JSON rewrite and lifted JS JSON recipes emit native `body-json` rules rather than JS calls. |
| `Anywhere.store` | `get`, `getString`, `set`, `delete`, `keys`, optional `onDisk` | bridged | Backs `$persistentStore`, `$prefs`, and Env storage helpers; persistent-store shims use the on-disk backing. |
| `Anywhere.params` | `get`, `keys`, `all` | native output + bridged | `[Parameter]` output is emitted when parameter preservation is enabled; script `$argument` templates read `Anywhere.params` at runtime. |
| `Anywhere.log` | `info`, `warning`, `error`, `debug` | bridged | Used by wrapper logging and Env `log/logErr`. |
| `Anywhere.done` / `exit` / `respond` | control flow | bridged | Backs `$done` and fixed request responses. |
| `Anywhere.http` | `get`, `post`, `request` | bridged | Backs `$httpClient`, `$task.fetch`, Env `get/post`, and global `fetch()`. |
| `TextEncoder` / `TextDecoder` globals | Web text codec | bridged | Anywhere installs these natively; wrapper also provides fallback for older clients or isolated evaluation. |
| `script` op `100` | buffered `process(ctx)` | native output | Generic script preservation and generated responder/proxy scripts use buffered scripts. Anywhere decodes `gzip` / `deflate` / `br` before script/body rules and emits identity afterward. |
| `stream-script` op `101` | per-frame `process(ctx)` | documented/manual | Available for SSE/NDJSON/gRPC/long streams. The generic converter does not auto-convert Loon/Surge response scripts to `101` because their `$response.body` semantics are whole-message, not per-frame. |
| `ctx.originalUrl` | pre-transparent-rewrite URL | review guardrail | Available when a native transparent rewrite and script share a flow. Future URL/script composition changes must distinguish it from rewritten `ctx.url`. |
| Per-invocation JS compilation | fresh context and compile on every hit | reported | Reports expose total script bytes and the maximum per-hit script size; optimization should target the latter rather than only the final AMRS size. |
| Response body codec negotiation | Accept-Encoding clamp + Content-Encoding decode | native runtime | Converter relies on Anywhere's runtime clamp/decode for body rules and no longer emits synthetic `accept-encoding: identity` preprocess rules. |

## Explicit Non-Goals

- The converter does not translate arbitrary `crypto.subtle` workflows into `Anywhere.crypto`.
- The converter does not translate generic protobuf bundles into field-level native edits.
- The converter does not expose every native codec through a Loon/Surge alias unless a real plugin pattern needs it.
- The converter does not auto-map buffered Loon/Surge `http-response` scripts to `stream-script`; streaming endpoints are diagnosed for manual review.
- `XMLHttpRequest` is still not emulated; scripts using it should be treated as sample-required/manual until a focused compatibility shim is justified by real samples.
