# Worker Deployment

## Local Preview

```sh
npm install
npm run dev
```

Open the URL printed by Wrangler.

## Cloudflare Setup

```sh
npx wrangler login
npx wrangler kv namespace create CONVERTER_KV
```

Copy the returned id into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONVERTER_KV"
id = "your_namespace_id"
```

Deploy:

```sh
npm run deploy
```

## API

`POST /api/inspect`

Reads module metadata, rule-set kind, and `[Argument]` definitions without generating rule files. This is what the browser UI uses to render the parameter form before conversion.

`POST /api/convert`

```json
{
  "url": "https://example.com/module.plugin",
  "sourceKind": "auto",
  "ruleSetRouting": "default",
  "arguments": {
    "smzdm_enable": false
  },
  "scriptTextByURL": {
    "https://example.com/remote-script.js": "const body = $response.body; $done({ body });"
  },
  "includeContent": false,
  "includeSource": true
}
```

Response includes:

- `report.status`
- `summary`
- `diagnostics`
- resolved `arguments`
- `argumentDefinitions`
- `sourceKind`, either `module` or `ruleset`
- `ruleSetRouting` for standalone rule-set conversions
- `files[].url`
- `importUrl`, which points to dynamic `/sub/*` subscriptions for URL-based conversions when possible
- `dynamicImportUrl` and `dynamicFiles[]` when the result can be represented as original-URL-backed subscriptions
- `snapshotImportUrl` only when the conversion must fall back to hash-backed generated files
- `source` when `includeSource=true`
- `summary.scriptRecoveryUrls` when remote script source could not be fetched and can be supplied through `scriptTextByURL`

The browser UI requests `includeContent=true` and can download the generated files directly from that response. `下载文件` saves the selected `.amrs` / `.arrs`; `下载全部` creates a client-side zip. These downloads do not hit `/sub/*` or `/r/*`, so they are the preferred path when the user wants to reduce Worker subscription traffic.

`GET /sub/deeplink?url=<source-url>`

Builds a dynamic `anywhere://add-rule-set?...` link from the original module or rule-set URL. Use `format=text` to return the raw import URL.

`GET /sub/mitm.amrs?url=<source-url>`

Returns a dynamically converted MITM ruleset. The Worker fetches the original source URL, converts it, selects the generated `.amrs`, and caches the response for `DYNAMIC_CACHE_TTL_SECONDS`.

`GET /sub/reject.arrs?url=<source-url>`

`GET /sub/direct.arrs?url=<source-url>`

`GET /sub/rule.arrs?url=<source-url>`

Return dynamically converted routing rulesets selected by Anywhere routing value.

Standalone rule sets can use the same `.arrs` endpoints:

```text
GET /sub/reject.arrs?url=<ruleset-url>&sourceKind=ruleset&ruleSetRouting=reject
```

Use `ruleSetRouting=default`, `direct`, or `reject` when the upstream rule set omits a policy action.

`GET /r/:hash/:filename.amrs`

Returns generated `.amrs` or `.arrs` content from a fallback conversion snapshot.

## Production Notes

- Use KV in production; memory storage is only for local preview.
- Dynamic `/sub/*` links are the normal public URL conversion output because they preserve the original source link and can follow upstream updates after cache expiry. These conversions do not generate hashes. Snapshot `/r/:hash/*` links are only fallback output and still need KV if they must survive Worker isolate restarts.
- `RATE_LIMIT_PER_MINUTE` controls the simple per-client limit for `/api/inspect`, `/api/convert`, and `/sub/*`; set it to `0` only for trusted private deployments.
- `FETCH_CACHE_TTL_SECONDS` controls public remote URL fetch caching. User-pasted module text is not cached by this path.
- `DYNAMIC_CACHE_TTL_SECONDS` controls the converted `/sub/*` response cache. Keep it non-zero for public deployments to reduce repeated conversion CPU and upstream fetch pressure.
- Remote script fetching is on by default. Set `fetchScripts=false` only for offline/native diagnostics.
- `MAX_SCRIPT_FETCHES` caps how many unique remote scripts one conversion fetches before emitting `script-fetch-count-exceeded`; keep it below your Worker subrequest limit for public deployments. Set it to `0` only for trusted private Workers where the platform limit is known.
- Remote `Map Local data-type=file` text resources use independent `MAX_MAP_LOCAL_BYTES`, `MAX_TOTAL_MAP_LOCAL_BYTES`, and `MAX_MAP_LOCAL_FETCHES` budgets. Unknown or binary-looking files are not downloaded.
- `scriptTextByURL` can provide trusted script text for remote script URLs that are blocked, deleted, or protected by anti-bot rules. Values are bounded by `MAX_SCRIPT_BYTES` and `MAX_TOTAL_SCRIPT_BYTES`.
- Dynamic links cannot carry `scriptTextByURL`; conversions with manual script bodies use `snapshotImportUrl` as the import target.
- The browser UI exposes the same source recovery path: failed script URLs are shown as "补脚本" chips and can be filled in without editing JSON.
- Tune `RATE_LIMIT_PER_MINUTE` for expected public traffic.
- Increase input, script, or Map Local download budgets only after measuring Worker CPU, memory, and subrequest usage.
