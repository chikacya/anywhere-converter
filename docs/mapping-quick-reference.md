# Mapping Quick Reference

Status:

- `stable`: emitted without compatibility warnings.
- `partial`: emitted with diagnostics; user should review.
- `sample-required`: rules are emitted, but real request/response samples or device validation are required before treating the output as stable.
- `blocked`: not emitted unless a future explicit recipe exists.

## MITM Header

| Loon/Surge | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `[MITM] hostname = *.example.com` | `hostname = example.com` | stable | Anywhere uses suffix matching, not wildcard syntax. |
| `%APPEND% host` | `host` | stable | `%APPEND%` is stripped. |
| URL host `(a\|b).example.com` + matching MITM hosts | `^https://[^/]+/path` | partial | Only simple host alternatives are generalized; hostname still limits scope. |
| `api?.example.com` | skipped | partial | Complex wildcard has no safe suffix equivalent. |

## Routing Rules

| Loon/Surge | Anywhere `.arrs` | Status | Notes |
| --- | --- | --- | --- |
| `DOMAIN-SUFFIX,x,REJECT` | `2, x`, `routing = 2` | stable | Exact equivalent enough for suffix rules. |
| `DOMAIN,x,REJECT` | `2, x`, `routing = 2` | partial | Anywhere has suffix only, so exact-domain semantics widen. |
| `HOST,x,ACTION` | same as `DOMAIN,x,ACTION` | partial | Alias used by some rule sources; mapped through the shared domain path. |
| `HOST-SUFFIX,x,ACTION` | same as `DOMAIN-SUFFIX,x,ACTION` | stable | Alias used by some rule sources. |
| `HOST-KEYWORD,x,ACTION` | same as `DOMAIN-KEYWORD,x,ACTION` | partial | Alias used by some rule sources. |
| `DOMAIN-WILDCARD,x,ACTION` / `HOST-WILDCARD,x,ACTION` | `2, normalized-domain` | partial | Complex wildcard semantics are collapsed to suffix matching, matching the anywhere-rules converter boundary. |
| `DOMAIN-KEYWORD,x,REJECT` | `3, x`, `routing = 2` | partial | Keyword rules can overmatch. |
| `IP-CIDR,x,REJECT` | `0, x`, `routing = 2` | stable | Bare IPv4 gets `/32`. |
| `IP-CIDR6,x,REJECT` / `IP6-CIDR,x,REJECT` | `1, x`, `routing = 2` | stable | Bare IPv6 gets `/128`; `IP6-CIDR` is normalized as an alias. |
| `AND(URL-REGEX, USER-AGENT), REJECT` | `.amrs` request reject | partial | Source-backed URL reject is emitted; the User-Agent condition cannot be represented and is recorded as a degradation. Known AMDC `mobileDispatch` patterns are normalized to `amdc.m.taobao.com`. |
| other `AND/OR/NOT` | skipped | blocked | Complex boolean routing is not represented in `.arrs`. |

## Standalone Rule Sets

| Loon/Surge rule set | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `DOMAIN-SUFFIX,x` with `ruleSetRouting=reject` | `2, x`, `routing = 2` | stable | Standalone rule sets often omit policy; the selected rule-set routing supplies it. |
| `DOMAIN-SUFFIX,x` with `ruleSetRouting=direct` | `2, x`, `routing = 1` | stable | Same parser, different Anywhere initial routing. |
| `DOMAIN-SUFFIX,x` with `ruleSetRouting=default` | `2, x`, `routing = 0` | stable | Useful when the user wants the imported set to keep default handling. |
| `example.com`, `+.example.com`, `*.example.com` | `DOMAIN-SUFFIX,example.com` -> `.arrs` | partial | Domain-set shorthand is treated as suffix matching. |
| `.example.com` | `DOMAIN-SUFFIX,example.com` -> `.arrs` | partial | Matches common domain-set shorthand. |
| YAML `payload:` list | parsed item-by-item | stable | Supports common list syntax used by rule providers. |
| `URL-REGEX,x` with `ruleSetRouting=reject` | `.amrs` request reject | stable | URL regex cannot live in `.arrs`, so reject routing emits MITM rules. |
| `URL-REGEX,x` without reject routing | skipped | blocked | Direct/default URL regex routing has no native `.arrs` equivalent. |
| duplicate routing entries | emitted once | stable | Dedupe is by routing/type/value. |
| `RULE-SET`, `DOMAIN-SET`, `PROCESS-NAME`, `GEOIP`, `IP-ASN` | skipped | blocked | These are provider references, process/device conditions, or geo/runtime concepts outside Anywhere `.arrs`. |

## Rewrite

| Loon/Surge | Anywhere `.amrs` | Status | Notes |
| --- | --- | --- | --- |
| `reject` | `0, 0, pattern, 2` | stable | Empty text response. |
| `reject-dict` | `0, 0, pattern, 2, {}` | stable | Fixed JSON object. |
| `reject-array` | `0, 0, pattern, 2, []` | stable | Fixed JSON array. |
| `reject-img` | `0, 0, pattern, 3` | stable | 1x1 GIF. |
| image-like `reject` | `0, 0, pattern, 3` | partial | Uses conservative image/material path heuristics. |
| `302 <url>` | `0, 0, pattern, 1, url` | stable | Synthetic 302. `$1` / `${10}` capture templates are preserved. |
| `307 <url>` | `0, 0, pattern, 1, url` | partial | Downgraded to 302. |
| transparent URL rewrite | `0, 0, pattern, 0, url` | stable | Native transparent rewrite. `$1` / `${10}` capture templates are preserved. Cross-host targets are diagnosed because Anywhere must route the rewritten upstream host successfully. |
| `mock-response-body data=...` | `0, 0, pattern, 2, data` | stable | Non-200 status is not emitted as native rewrite. |
| `mock-response-body data-type=base64` | `0, 0, pattern, 4, base64` | stable | Useful for fixed binary/gRPC mock. |

## Header Rewrite

| Loon/Surge | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `request-header-add name value` | `0, 1, pattern, name, value` | stable | Native header add. Framing/hop-by-hop headers such as `content-length` and `connection` are skipped because Anywhere rejects setting them. |
| `request-header-del name` | `0, 2, pattern, name` | stable | Native header delete. |
| `request-header-replace name value` | `0, 3, pattern, name, value` | stable | Native header replace. Framing/hop-by-hop headers are skipped for the same reason as add. |
| response variants | phase `1` | stable | Same operation IDs. |

## Body Rewrite

| Loon/Surge | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `response-body-replace-regex search replacement` | `1, 4, pattern, search, replacement` | stable | Replacement may use `$1` / `${10}` capture templates; Anywhere expands them natively. |
| `"list":\[.+\] -> "list":[]` | `replace-recursive list []` | stable | Generic JSON-array cleanup heuristic. |
| `response-body-json-del a.b` | `1, 5, pattern, delete, $.a.b` | stable | Loose path to JSONPath. |
| `response-body-json-replace a true` | `1, 5, pattern, replace, $.a, true` | stable | Value kept as JSON literal/text. |
| jq `del(.a.b)` | `body-json delete $.a.b` | stable | Whitelisted jq subset. |
| jq `delpaths([["a","b"]])` | `body-json delete $.a.b` | stable | Single-path subset. |
| jq `del(.items[] | select(.x == "ad"))` | `remove-where-field-in $.items x ["ad"]` | stable | Single array path and equality only. |
| jq `.items |= map(select(.x != "ad"))` | `remove-where-field-in $.items x ["ad"]` | stable | Single field blacklist, including `and` for the same field. |
| jq `.items |= map(select(has("ad") | not))` | `remove-where-key-exists $.items ad` | stable | Single array path only. |
| complex jq `map(select(...))` | script or skipped | partial | Nested arrays, regex `test`, startswith, keep-only logic, and multi-field predicates need scripts/samples. |

## Map Local

| Source | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `data-type=text data="..."` | `0, 0, pattern, 2, ...` | stable | Headers/status are not preserved by native rewrite. |
| `data-type=json data="..."` | `0, 0, pattern, 2, ...` | stable | Content-Type is not preserved. |
| `data-type=base64` | `0, 0, pattern, 4, ...` | stable | Binary fixed response. |
| `data-type=tiny-gif` | `0, 0, pattern, 3` | stable | 1x1 GIF. |
| `status-code=200 header="Content-Type:..."` | native fixed body | stable | Content-Type-only headers are treated as non-semantic for fixed body output. |
| `header=...` | `0, 100, pattern, base64(process)` | partial | Generated request script calls `Anywhere.respond` to preserve headers. |
| `status-code != 200` | `0, 100, pattern, base64(process)` | partial | Generated request script preserves status and body. |

## Script

| Source | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| remote response script, standard UI path | `1, 100, pattern, base64(process)` or native lift | partial | Remote scripts are fetched by default. |
| remote response script, aggressive UI path | native lift when URL-guarded JSON mutation is static | partial | Opt-in; keeps protobuf/binary/dynamic/helper-call logic out of native lift. |
| remote response script, `fetchScripts=false` diagnostics | skipped with diagnostics | partial | Offline/native-only diagnostics. |
| same phase + same pattern scripts | merged dispatcher | partial | Preserves order for exact same gate. |
| same phase + different patterns | gated dispatcher over union pattern | partial | Each wrapped script runs only when its original pattern matches. |
| request script mutating URL/header/method | blocked | blocked | Must be lifted to native rewrite/header. |
| `$httpClient` | wrapped to `Anywhere.http` | sample-required | Parks current request and has body/time budgets. |
| binary/protobuf script | wrapped, flagged | sample-required | See protobuf strategy. |

## Arguments

| Source | Anywhere | Status | Notes |
| --- | --- | --- | --- |
| `[Argument] foo = switch,true,false,...` | resolved `arguments.foo = true` | stable | Defaults are returned in reports/API responses. |
| `enable={foo}` with `foo=false` | rule skipped with `argument-disabled` diagnostic | stable | Disabled script rules are not fetched. |
| `{foo}` placeholder | substituted before conversion | stable | Only identifier placeholders are replaced; regex quantifiers like `{5}` are preserved. |
