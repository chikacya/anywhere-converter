import test from "node:test";
import assert from "node:assert/strict";
import { convertAny, convertModule, convertModuleAsync, convertRuleSet, validateAnywhereOutput, internals } from "../src/core.mjs";

test("converts stable routing and URL-REGEX reject rules", () => {
  const source = `
#!name = HTTPDNS Test
[Rule]
DOMAIN, dns.example.com, REJECT
DOMAIN-SUFFIX, ads.example.com, REJECT
DOMAIN-KEYWORD, tracker, REJECT
IP-CIDR, 1.2.3.4/32, REJECT, no-resolve
URL-REGEX, "^http:\\/\\/1\\.2\\.3\\.4\\/dns\\?", REJECT
`;
  const result = convertModule(source);
  assert.equal(result.files.length, 2);
  const amrs = result.files.find((file) => file.type === "amrs");
  const arrs = result.files.find((file) => file.type === "arrs");
  assert.match(amrs.content, /0, 0, \^http/);
  assert.match(arrs.content, /routing = 2/);
  assert.match(arrs.content, /2, dns\.example\.com/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
  assert.deepEqual(validateAnywhereOutput(arrs), []);
});

test("converts plain Loon Surge rule set to arrs with selected routing", () => {
  const result = convertRuleSet(`
#!name = Ads Rule Set
DOMAIN-SUFFIX, ads.example.com
DOMAIN-KEYWORD, tracker
IP-CIDR, 1.2.3.0/24, no-resolve
`, { ruleSetRouting: "reject" });
  assert.equal(result.sourceKind, "ruleset");
  assert.equal(result.files.length, 1);
  const arrs = result.files[0];
  assert.equal(arrs.type, "arrs");
  assert.match(arrs.content, /name = Ads Rule Set/);
  assert.match(arrs.content, /routing = 2/);
  assert.match(arrs.content, /2, ads\.example\.com/);
  assert.match(arrs.content, /3, tracker/);
  assert.match(arrs.content, /0, 1\.2\.3\.0\/24/);
  assert.deepEqual(validateAnywhereOutput(arrs), []);
});

test("auto-detects yaml and domain-set style rule sets", () => {
  const result = convertAny(`
payload:
  - '+.example.com'
  - '*.cdn.example.com'
  - 2001:db8::/32
`, { name: "Domain Set Mini", ruleSetRouting: "direct" });
  assert.equal(result.sourceKind, "ruleset");
  const arrs = result.files.find((file) => file.type === "arrs");
  assert.match(arrs.content, /routing = 1/);
  assert.match(arrs.content, /2, example\.com/);
  assert.match(arrs.content, /2, cdn\.example\.com/);
  assert.match(arrs.content, /1, 2001:db8::\/32/);
  assert.deepEqual(validateAnywhereOutput(arrs), []);
});

test("converts rule set URL-REGEX to mitm reject when routing is reject", () => {
  const result = convertRuleSet(`
URL-REGEX, ^https?:\\/\\/ads\\.example\\.com\\/banner
`, { name: "Regex Reject Set", ruleSetRouting: "reject" });
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /0, 0, \^https/);
  assert.match(amrs.content, /hostname = ads\.example\.com/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("aligns rule set aliases and wildcard handling with anywhere-rules converter", () => {
  const result = convertRuleSet(`
# NAME: Alias Rule Set
HOST, exact.example.com
HOST-SUFFIX, .suffix.example.com.
HOST-KEYWORD, CDN
HOST-WILDCARD, *.wild.example.com
IP6-CIDR, 2001:db8::/32
DOMAIN-SUFFIX, suffix.example.com
DOMAIN-SUFFIX, suffix.example.com
`, { ruleSetRouting: "direct" });
  const arrs = result.files.find((file) => file.type === "arrs");
  assert.match(arrs.content, /routing = 1/);
  assert.match(arrs.content, /2, exact\.example\.com/);
  assert.match(arrs.content, /2, suffix\.example\.com/);
  assert.match(arrs.content, /3, cdn/);
  assert.match(arrs.content, /2, wild\.example\.com/);
  assert.match(arrs.content, /1, 2001:db8::\/32/);
  assert.equal(arrs.content.match(/2, suffix\.example\.com/g).length, 1);
  assert(result.diagnostics.some((item) => item.code === "domain-exact-degraded"));
  assert(result.diagnostics.some((item) => item.code === "domain-wildcard-degraded"));
  assert.deepEqual(validateAnywhereOutput(arrs), []);
});

test("converts module rule HOST aliases through shared rule mapping", () => {
  const result = convertModule(`
#!name = Host Alias Mini
[Rule]
HOST-SUFFIX, cdn.example.com, DIRECT
HOST-KEYWORD, tracker, REJECT
`);
  const direct = result.files.find((file) => file.type === "arrs" && /routing = 1/.test(file.content));
  const reject = result.files.find((file) => file.type === "arrs" && /routing = 2/.test(file.content));
  assert.match(direct.content, /2, cdn\.example\.com/);
  assert.match(reject.content, /3, tracker/);
  assert.deepEqual(validateAnywhereOutput(direct), []);
  assert.deepEqual(validateAnywhereOutput(reject), []);
});

test("degrades simple AND URL-REGEX USER-AGENT reject to URL reject", () => {
  const source = `
#!name = Logical And Mini
[Rule]
AND,((URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch"),(USER-AGENT,"XianYu*")),REJECT
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /hostname = amdc\.m\.taobao\.com/);
  assert.match(amrs.content, /0, 0, \^http:\/\/amdc\\\.m\\\.taobao\\\.com\/amdc\/mobileDispatch/);
  assert.equal(result.report.skipped, 0);
  assert(result.diagnostics.some((item) => item.code === "logical-and-degraded"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("converts MITM hostname and simple rewrite actions", () => {
  const source = `
#!name = Weibo Mini
[Rewrite]
^https?:\\/\\/api\\.example\\.com\\/ad reject-dict
^https?:\\/\\/api\\.example\\.com\\/banner response-body-json-jq 'del(.data.banner)'
[MITM]
hostname = *.example.com, *api.example.com
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /hostname = example\.com/);
  assert.match(amrs.content, /0, 0, \^https/);
  assert.match(amrs.content, /1, 5, \^https/);
  assert.match(amrs.content, /api\.example\.com/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("generalizes simple grouped hosts only inside known hostnames", () => {
  const pattern = "^https://(a|b)\\.example\\.com/path";
  assert.deepEqual(internals.extractHostsFromPattern(pattern), ["a.example.com", "b.example.com"]);
  assert.equal(
    internals.generalizeGroupedHostPattern(pattern, new Set(["a.example.com", "b.example.com"])),
    "^https://[^/]+/path",
  );
  assert.equal(internals.generalizeGroupedHostPattern(pattern, new Set(["a.example.com"])), "");
});

test("expands grouped digit host patterns for MITM inference", () => {
  const pattern = "^https?:\\/\\/(ipv4|interface\\d?)\\.music\\.163\\.com\\/eapi\\/";
  const hosts = internals.extractHostsFromPattern(pattern);
  assert(hosts.includes("ipv4.music.163.com"));
  assert(hosts.includes("interface.music.163.com"));
  assert(hosts.includes("interface1.music.163.com"));
  assert(hosts.includes("interface9.music.163.com"));
  assert.equal(
    internals.generalizeGroupedHostPattern(pattern, new Set(hosts)),
    "^https?://[^/]+/eapi/",
  );
});

test("keeps literal host from leading wildcard hostname", () => {
  const result = convertModule(`
#!name = Spotify Host Mini
[Rewrite]
^https?:\\/\\/spclient\\.spotify\\.com\\/path reject
[MITM]
hostname = %APPEND% *spclient.spotify.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /hostname = spclient\.spotify\.com, spotify\.com/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts simple request url replacement script to proxy request script", () => {
  const result = convertModule(`
#!name = URL Proxy Mini
[Script]
http-request ^https?:\\/\\/spclient\\.spotify\\.com\\/path script-path=https://example.com/url.js
[MITM]
hostname = spclient.spotify.com
`, {
    fetchScripts: true,
    scriptTextByURL: {
      "https://example.com/url.js": `
let url = $request.url;
if (url.includes('platform=iphone')) {
  url = url.replace(/platform=iphone/, 'platform=ipad');
}
$done({ url });
`,
    },
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLine = amrs.content.split("\n").find((line) => line.startsWith("0, 100,"));
  const fields = internals.parseCsv(scriptLine);
  const generated = Buffer.from(fields[3], "base64").toString("utf8");
  assert.match(generated, /Anywhere\.http\.request/);
  assert.match(generated, /Anywhere\.respond/);
  assert(result.diagnostics.some((item) => item.code === "script-url-proxy-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("normalizes query boundary without touching captures", () => {
  const reject = internals.normalizeMitmRulePattern({ phase: 0, op: 0, pattern: "^https://a.test/(foo|bar)\\?", fields: ["2", "{}"] });
  assert.equal(reject.pattern, "^https://a.test/(foo|bar)(?:\\?|$)");
  const transparent = internals.normalizeMitmRulePattern({ phase: 0, op: 0, pattern: "^https://a.test/(foo|bar)\\?", fields: ["0", "https://b.test/$1"] });
  assert.equal(transparent.pattern, "^https://a.test/(foo|bar)(?:\\?|$)");
});

test("converts surge dash rewrite syntax", () => {
  const result = convertModule(`
#!name = Dash Rewrite Mini
[URL Rewrite]
^https:\\/\\/api\\.example\\.com\\/ad - reject-dict
[MITM]
hostname = api.example.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /0, 0, \^https/);
  assert.match(amrs.content, /\{\}/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("converts trailing header URL rewrite syntax", () => {
  const result = convertModule(`
#!name = Header URL Rewrite Mini
[Rewrite]
^https:\\/\\/api\\.example\\.com\\/artist\\/(.*)&platform=iphone https://api.example.com/artist/$1&platform=ipad header
[MITM]
hostname = api.example.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("0, 0,"));
  assert.deepEqual(internals.parseCsv(line).slice(3), ["0", "https://api.example.com/artist/$1&platform=ipad"]);
  assert.equal(result.report.skipped, 0);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("parses arguments and gates enabled rules", async () => {
  const source = `
#!name = Argument Mini
[Argument]
script_enable = switch,true,false,tag=脚本开关
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/ad\\? script-path=https://example.com/ad.js, requires-body=true, enable={script_enable}
[MITM]
hostname = api.example.com
`;
  let fetchCount = 0;
  const enabled = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => {
      fetchCount += 1;
      return "$done({ body: '{}' })";
    },
  });
  assert.equal(enabled.arguments.script_enable, true);
  assert.equal(fetchCount, 1);
  assert(enabled.files.find((file) => file.type === "amrs").content.includes("1, 100,"));

  const disabled = await convertModuleAsync(source, {
    fetchScripts: true,
    arguments: { script_enable: false },
    fetchText: async () => {
      fetchCount += 1;
      return "$done({ body: '{}' })";
    },
  });
  assert.equal(disabled.arguments.script_enable, false);
  assert.equal(fetchCount, 1);
  assert.equal(disabled.files.length, 0);
  assert(disabled.diagnostics.some((item) => item.code === "argument-disabled"));
});

test("parses argument labels descriptions and select options", () => {
  const switchArg = internals.parseArgumentLine("enabled = switch,true,false,tag=启用功能,desc=关闭后跳过规则");
  assert.equal(switchArg.name, "enabled");
  assert.equal(switchArg.type, "switch");
  assert.equal(switchArg.defaultValue, true);
  assert.deepEqual(switchArg.options, [true, false]);
  assert.equal(switchArg.tag, "启用功能");
  assert.equal(switchArg.desc, "关闭后跳过规则");
  assert.deepEqual(internals.parseArgumentLine("short = switch,true,tag=短开关").options, [true, false]);

  const selectArg = internals.parseArgumentLine('LogLevel = select,"WARN","OFF","ERROR","INFO",tag=[调试] 日志等级,desc=选择输出等级');
  assert.equal(selectArg.defaultValue, "WARN");
  assert.deepEqual(selectArg.options, ["WARN", "OFF", "ERROR", "INFO"]);
  assert.equal(selectArg.tag, "[调试] 日志等级");
  assert.equal(selectArg.desc, "选择输出等级");
});

test("parses Surge metadata arguments and triple placeholders", () => {
  const source = `
#!name=Reven
#!arguments=Mock:"https://mock.example/reven"
[URL Rewrite]
^https:\\/\\/api\\.revenuecat\\.com\\/(.+)$ {{{Mock}}}/$1 header
[MITM]
hostname = api.revenuecat.com
`;
  const result = convertModule(source);
  assert.equal(result.argumentDefinitions.Mock.defaultValue, "https://mock.example/reven");
  assert.equal(result.arguments.Mock, "https://mock.example/reven");
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /https:\/\/mock\.example\/reven\/\$1/);
  assert.doesNotMatch(amrs.content, /\{\{\{Mock\}\}\}/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("parses metadata argument descriptions and lets section arguments override", () => {
  const source = `
#!name = Metadata Arguments Mini
#!arguments=日志级别:info, enabled:false, Mode:auto
#!arguments-desc=日志级别: 输出等级\\nenabled: 总开关
[Argument]
enabled = switch,true,false,tag=启用,desc=覆盖头部简写
[URL Rewrite]
^https:\\/\\/api\\.example\\.com\\/{{日志级别}}/{Mode} reject
`;
  const result = convertModule(source);
  assert.equal(result.argumentDefinitions["日志级别"].defaultValue, "info");
  assert.equal(result.argumentDefinitions["日志级别"].desc, "输出等级");
  assert.equal(result.argumentDefinitions.enabled.defaultValue, true);
  assert.equal(result.argumentDefinitions.enabled.desc, "覆盖头部简写");
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /\/info\/auto/);
});

test("argument substitution avoids regex quantifiers", () => {
  const item = { section: "Rewrite", text: "^https://a.test/202\\d{5}/{path} reject", raw: "", line: 1 };
  const resolved = internals.resolveItemArguments(item, { path: "ad" });
  assert.equal(resolved.item.text, "^https://a.test/202\\d{5}/ad reject");
});

test("map local base64 without headers maps to reject data", () => {
  const source = `
#!name = Bili Mini
[Map Local]
^https:\\/\\/grpc\\.biliapi\\.net\\/bilibili\\.app\\.interface\\.v1\\.Teenagers\\/ModeStatus$ data-type=base64 data="AAAAAAA="
[MITM]
hostname = grpc.biliapi.net
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /0, 0, \^https/);
  assert.match(amrs.content, /, 4, AAAAAAA=/);
  assert(result.diagnostics.some((item) => item.code === "sample-required-pattern"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("map local with headers uses generated respond script", () => {
  const source = `
#!name = Map Local Header Mini
[Map Local]
^https:\\/\\/api\\.example\\.com\\/config$ data-type=text data="{}" status-code=201 header="Content-Type:application/json"
[MITM]
hostname = api.example.com
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLine = amrs.content.split("\n").find((line) => line.startsWith("0, 100,"));
  const fields = internals.parseCsv(scriptLine);
  const generated = Buffer.from(fields[3], "base64").toString("utf8");
  assert.match(generated, /Anywhere\.respond/);
  assert.match(generated, /status: 201/);
  assert.match(generated, /application\/json/);
  assert(result.diagnostics.some((item) => item.code === "map-local-script-response"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("map local with status 200 and content-type stays native", () => {
  const source = `
#!name = Map Local Native Header Mini
[Map Local]
^https:\\/\\/api\\.example\\.com\\/config$ data-type=text data="{}" status-code=200 header="Content-Type:application/json"
[MITM]
hostname = api.example.com
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  const ruleLine = amrs.content.split("\n").find((line) => line.startsWith("0, 0,"));
  assert.deepEqual(internals.parseCsv(ruleLine).slice(3), ["2", "{}"]);
  assert(!amrs.content.includes("Anywhere.respond"));
  assert(result.diagnostics.some((item) => item.code === "map-local-native-trivial-header"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("does not emit stale content-type headers", () => {
  const result = convertModule(`
#!name = Header Check
[Rewrite]
^https?:\\/\\/api\\.example\\.com\\/empty reject-array
[MITM]
hostname = api.example.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert(!amrs.content.includes("content-type ="));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("jq helper only accepts simple supported subset", () => {
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", "del(.data.banner)")?.fields, ["delete", "$.data.banner"]);
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", "delpaths([[\"data\",\"banner\"]])")?.fields, ["delete", "$.data.banner"]);
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", ".items |= map(select(.type != \"ad\"))")?.fields, ["remove-where-field-in", "$.items", "type", "[\"ad\"]"]);
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", ".items |= map(select(.type != \"ad\" and .type != \"banner\"))")?.fields, ["remove-where-field-in", "$.items", "type", "[\"ad\",\"banner\"]"]);
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", "del(.items[] | select(.category == \"group\"))")?.fields, ["remove-where-field-in", "$.items", "category", "[\"group\"]"]);
  assert.deepEqual(internals.jqToBodyJson(1, "^https://a.test", ".items |= map(select(has(\"adCategory\") | not))")?.fields, ["remove-where-key-exists", "$.items", "adCategory"]);
  assert.equal(internals.jqToBodyJson(1, "^https://a.test", ".items |= map(select(.ad|not))"), null);
  assert.equal(internals.jqToBodyJson(1, "^https://a.test", ".items |= map(select(.title | test(\"ad\"; \"i\") | not))"), null);
});

test("converts supported complex jq filters to generated JSON scripts", () => {
  const source = `
#!name = JQ Script Mini
[Rewrite]
^https:\\/\\/api\\.example\\.com\\/mix response-body-json-jq '.heData |= map(select(.item.list[].bizType != "SceneListenCard"))'
^https:\\/\\/api\\.example\\.com\\/category response-body-json-jq '.categoryList |= map(.itemList |= map(select(.title | test("直播|SVIP"; "i") | not))) | .customCategoryList |= map(select(.title | test("直播|SVIP"; "i") | not))'
^https:\\/\\/api\\.example\\.com\\/home response-body-json-jq '.data.serviceModule.entrances |= map(select(.name == "全部服务"))'
[MITM]
hostname = api.example.com
`;
  const result = convertModule(source);
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLines = amrs.content.split("\n").filter((item) => item.startsWith("1, 100,"));
  assert.equal(scriptLines.length, 1);
  const generated = Buffer.from(internals.parseCsv(scriptLines[0])[3], "base64").toString("utf8");
  assert.match(generated, /remove-array-where-nested-field-in/);
  assert.match(generated, /filter-child-array-regex-not/);
  assert.match(generated, /keep-array-field-in/);
  assert(result.diagnostics.some((item) => item.code === "script-dispatcher-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("converts body replace regex from Loon rewrite", () => {
  const result = convertModule(`
#!name = Pinduoduo Mini
[Rewrite]
^https?:\\/\\/mobile\\.yangkeduo\\.com\\/goods$ response-body-replace-regex "list":\\[.+\\] "list":[]
[MITM]
hostname = mobile.yangkeduo.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /0, 2, \^https/);
  assert.match(amrs.content, /0, 1, \^https/);
  const bodyReplaceLine = amrs.content.split("\n").find((line) => line.startsWith("1, 5,"));
  assert.deepEqual(internals.parseCsv(bodyReplaceLine).slice(3), ["replace-recursive", "list", "[]"]);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("converts header rewrite actions", () => {
  const result = convertModule(`
#!name = Header Mini
[Header Rewrite]
http-request ^https:\\/\\/api\\.example\\.com\\/v1 header-del if-none-match
[Rewrite]
^https:\\/\\/grpc\\.example\\.com\\/Service$ response-header-add grpc-status 0
[MITM]
hostname = api.example.com, grpc.example.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.match(amrs.content, /0, 2, \^https/);
  assert.match(amrs.content, /if-none-match/);
  assert.match(amrs.content, /1, 1, \^https/);
  assert.match(amrs.content, /grpc-status, 0/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("merges generated accept-encoding preprocess headers", () => {
  const result = convertModule(`
#!name = Header Merge Mini
[Rewrite]
^https:\\/\\/api\\.example\\.com\\/a response-body-json-del data.ad
^https:\\/\\/api\\.example\\.com\\/b response-body-json-del data.ad
[MITM]
hostname = api.example.com
`);
  const amrs = result.files.find((file) => file.type === "amrs");
  const deleteHeaders = amrs.content.split("\n").filter((line) => line.startsWith("0, 2,"));
  const addHeaders = amrs.content.split("\n").filter((line) => line.startsWith("0, 1,"));
  assert.equal(deleteHeaders.length, 3);
  assert.equal(addHeaders.length, 1);
  assert(deleteHeaders.some((line) => line.includes("accept-encoding")));
  assert(deleteHeaders.some((line) => line.includes("if-none-match")));
  assert(deleteHeaders.some((line) => line.includes("if-modified-since")));
  assert(deleteHeaders.every((line) => /\^https:\/\/api\\\.example\\\.com\/\(\?:a\|b\)/.test(line)));
  assert(result.diagnostics.some((item) => item.code === "generated-header-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("wraps and merges same-gate remote scripts when enabled", async () => {
  const source = `
#!name = Script Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/v1 script-path=https://example.com/a.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/v1 script-path=https://example.com/b.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async (url) => url.endsWith("a.js")
      ? "$done({ body: JSON.stringify({a:1}) })"
      : "$response.body = JSON.stringify({b:2}); $done({})",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 100,"));
  assert.equal(scriptLines.length, 1);
  const fields = internals.parseCsv(scriptLines[0]);
  const wrapped = Buffer.from(fields[3], "base64").toString("utf8");
  assert.match(wrapped, /function __anywhere_part_0/);
  assert.match(wrapped, /function __anywhere_part_1/);
  assert(result.diagnostics.some((item) => item.code === "script-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("response scripts requiring body remove conditional cache headers", async () => {
  const source = `
#!name = Response Body Script Cache Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/profile script-path=https://example.com/profile.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => "$done({ body: $response.body })",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const lines = amrs.content.split("\n");
  assert(lines.some((line) => line.startsWith("0, 2,") && line.includes("accept-encoding")));
  assert(lines.some((line) => line.startsWith("0, 1,") && line.includes("accept-encoding, identity")));
  assert(lines.some((line) => line.startsWith("0, 2,") && line.includes("if-none-match")));
  assert(lines.some((line) => line.startsWith("0, 2,") && line.includes("if-modified-since")));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("warns instead of blocking Env-style require branches", async () => {
  const source = `
#!name = Env Require Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/timeline script-path=https://example.com/env.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
function Env() {
  return { isNode: function () { return false; }, load: function () { if (this.isNode()) require("fs"); } };
}
$done({ body: $response.body });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  assert(amrs.content.includes("1, 100,"));
  assert(result.diagnostics.some((item) => item.code === "script-node-require-branch"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("preserves scripts that execute dynamic code as sample-required", async () => {
  const source = `
#!name = Dynamic Code Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/data script-path=https://example.com/dynamic.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const payload = $response.body;
eval(payload);
$done({ body: payload });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  assert(amrs.content.includes("0, 100,") || amrs.content.includes("1, 100,"));
  assert.equal(result.report.status, "sample-required");
  assert(result.diagnostics.some((item) => item.code === "script-dynamic-sample-required"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("async converter fetches scripts by default", async () => {
  const source = `
#!name = Default Compat Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/default script-path=https://example.com/default.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  let fetched = false;
  const result = await convertModuleAsync(source, {
    fetchText: async () => {
      fetched = true;
      return "$done({ body: '{}' })";
    },
  });
  assert.equal(fetched, true);
  assert.equal(result.mode, "compat");
  assert(result.files.find((file) => file.type === "amrs").content.includes("1, 100,"));
});

test("enforces remote script file and total download budgets", async () => {
  const source = `
#!name = Script Budget Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/a script-path=https://example.com/a.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/b script-path=https://example.com/b.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/c script-path=https://example.com/c.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    maxScriptBytes: 80,
    maxTotalScriptBytes: 24,
    fetchText: async (url) => {
      if (url.endsWith("a.js")) return "$done({ body: 'a' })";
      if (url.endsWith("b.js")) return "$done({ body: '" + "b".repeat(120) + "' })";
      return "$done({ body: 'c' })";
    },
  });
  assert(result.diagnostics.some((item) => item.code === "script-fetch-file-too-large"));
  assert(result.diagnostics.some((item) => item.code === "script-fetch-budget-exceeded"));
});

test("compat wrapper includes Env and async http lifecycle support", async () => {
  const source = `
#!name = Env Async Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/env script-path=https://example.com/env.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => "const $ = new Env('mini'); $.get('https://example.com', () => $.done({ body: '{}' }));",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /async function process/);
  assert.match(wrapped, /function Env/);
  assert.match(wrapped, /__donePromise/);
  assert.match(wrapped, /__pendingHttp/);
  assert.match(wrapped, /function __setTimeout/);
  assert.match(wrapped, /function __URLShim/);
  assert.match(wrapped, /function __TextDecoderShim/);
  assert.match(wrapped, /function __atobShim/);
  assert.match(wrapped, /function __fetch/);
  assert.match(wrapped, /var __cryptoShim/);
  assert.match(wrapped, /"setTimeout", "clearTimeout", "setInterval", "clearInterval"/);
  assert.match(wrapped, /"URL", "URLSearchParams"/);
  assert.match(wrapped, /"TextEncoder", "TextDecoder", "atob", "btoa"/);
  assert.match(wrapped, /"fetch", "crypto"/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("compat wrapper exposes global fetch and WebCrypto random shim", async () => {
  const source = `
#!name = JS Compat Native Globals Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/native-globals.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const bytes = new Uint8Array(4);
crypto.getRandomValues(bytes);
void crypto.subtle;
fetch("https://config.example.com/profile").then(resp => resp.json()).then(obj => $done({ body: JSON.stringify(obj) }));
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /function __fetch/);
  assert.match(wrapped, /getRandomValues/);
  assert.match(wrapped, /Anywhere\.crypto\.randomBytes/);
  assert(result.diagnostics.some((item) => item.code === "script-http-client"));
  assert(result.diagnostics.some((item) => item.code === "script-webcrypto-lite"));
  assert(result.diagnostics.some((item) => item.code === "script-webcrypto-subtle"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("preserves comma-separated script arguments after argument substitution", async () => {
  const source = `
#!name = Script Argument Array Mini
[Argument]
tab=switch, true
useractivity=switch, false
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/arg.js, requires-body=true, argument=[{tab},{useractivity}]
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => "$done({ body: $argument })",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /var \$argument = "\[true,false\]"/);
  assert.deepEqual(internals.parseKeyValueTokens("argument=[true,false], requires-body=true"), {
    argument: "[true,false]",
    "requires-body": "true",
  });
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("warns when script arguments are declared but source does not read argument", async () => {
  const source = `
#!name = Unused Script Argument Mini
[Argument]
create=switch, false
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/no-arg.js, requires-body=true, argument={create}
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => "const obj = JSON.parse($response.body); obj.ok = true; $done({ body: JSON.stringify(obj) });",
  });
  assert(result.diagnostics.some((item) => item.code === "script-argument-unused"));
  const amrs = result.files.find((file) => file.type === "amrs");
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts simple JSON mutation scripts to native body-json", async () => {
  const source = `
#!name = JS Lift JSON Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/lift.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const obj = JSON.parse($response.body);
delete obj.data.ad;
obj.data.vip = true;
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const lines = amrs.content.split("\n").filter((line) => line.startsWith("1, 5,"));
  assert.equal(lines.length, 2);
  assert.deepEqual(internals.parseCsv(lines[0]).slice(3), ["delete", "$.data.ad"]);
  assert.deepEqual(internals.parseCsv(lines[1]).slice(3), ["replace", "$.data.vip", "true"]);
  assert(!amrs.content.includes("1, 100,"));
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts JSON mutation scripts with literal constants", async () => {
  const source = `
#!name = JS Lift JSON Constants Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/lift-constants.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const EMPTY = [];
const OFF = false;
let obj = JSON.parse($response.body);
obj.data.ads = EMPTY;
obj.data.enabled = OFF;
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const bodyJsonLines = amrs.content.split("\n").filter((item) => item.startsWith("1, 5,"));
  assert.equal(bodyJsonLines.length, 2);
  const fields = bodyJsonLines.map((line) => internals.parseCsv(line).slice(3));
  assert(fields.some((item) => item[0] === "replace" && item[1] === "$.data.ads" && item[2] === "[]"));
  assert(fields.some((item) => item[0] === "replace" && item[1] === "$.data.enabled" && item[2] === "false"));
  assert(!amrs.content.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts simple response body replace scripts to native body-replace", async () => {
  const source = `
#!name = JS Lift Replace Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/text script-path=https://example.com/replace.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
$response.body = $response.body.replace(/"ads":\\[.+?\\]/g, '"ads":[]');
$done({ body: $response.body });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 4,"));
  assert.deepEqual(internals.parseCsv(line).slice(3), ['"ads":\\[.+?\\]', '"ads":[]']);
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts simple array filter scripts to native body-json", async () => {
  const source = `
#!name = JS Lift Filter Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/filter.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
let obj = JSON.parse($response.body);
obj.data.items = obj.data.items.filter(item => item.type !== "ad");
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 5,"));
  assert.deepEqual(internals.parseCsv(line).slice(3), ["remove-where-field-in", "$.data.items", "type", "[\"ad\"]"]);
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts guarded JSON scripts with request url and response body aliases", async () => {
  const source = `
#!name = JS Lift Alias Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/alias.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const url = $request.url;
let responseBody = $response.body;
let obj = JSON.parse(responseBody);
if (url.includes("/feed")) {
  obj.data.rows = obj.data.rows.filter(item => item.model_type !== "ads");
  delete obj.data.banner;
}
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const bodyJsonLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 5,"));
  assert.equal(bodyJsonLines.length, 2);
  const fields = bodyJsonLines.map((line) => internals.parseCsv(line).slice(3));
  assert.deepEqual(fields, [
    ["remove-where-field-in", "$.data.rows", "model_type", "[\"ads\"]"],
    ["delete", "$.data.banner"],
  ]);
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("does not lift unrelated guarded URL branches onto concrete patterns", async () => {
  const source = `
#!name = JS Lift Branch Overlap Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/branch-overlap.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const url = $request.url;
const obj = JSON.parse($response.body);
if (url.includes("/feed")) {
  delete obj.data.banner;
}
if (url.includes("/vip")) {
  delete obj.data.card;
}
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const bodyJsonLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 5,"));
  assert.equal(bodyJsonLines.length, 1);
  assert.deepEqual(internals.parseCsv(bodyJsonLines[0]).slice(3), ["delete", "$.data.banner"]);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts guarded existence deletes without lifting conditional assignments", async () => {
  const source = `
#!name = JS Lift Guarded Delete Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/util\\/update script-path=https://example.com/guarded-delete.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const url = $request.url;
let obj = JSON.parse($response.body);
if (url.includes("/util/update") && obj.data) {
  if (obj.data.ad_black_list) {
    delete obj.data.ad_black_list;
  }
  if (obj.data.operation_float) {
    delete obj.data.operation_float;
  }
  if (obj.data.flag) {
    obj.data.enabled = true;
  }
}
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const bodyJsonLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 5,"));
  const fields = bodyJsonLines.map((line) => internals.parseCsv(line).slice(3));
  assert.deepEqual(fields, [
    ["delete", "$.data.ad_black_list"],
    ["delete", "$.data.operation_float"],
  ]);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("compat mode lifts statically guarded JSON branch mutations", async () => {
  const source = `
#!name = JS Guarded Branch Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/ script-path=https://example.com/branch.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const script = `
let obj = JSON.parse($response.body);
if ($request.url.includes("/feed")) {
  obj.data.ads = [];
  delete obj.data.banner;
}
$done({ body: JSON.stringify(obj) });
`;
  const compat = await convertModuleAsync(source, {
    fetchScripts: true,
    mode: "compat",
    fetchText: async () => script,
  });
  const compatAmrs = compat.files.find((file) => file.type === "amrs");
  const bodyJsonLines = compatAmrs.content.split("\n").filter((item) => item.startsWith("1, 5,"));
  assert.equal(bodyJsonLines.length, 2);
  const fields = bodyJsonLines.map((line) => internals.parseCsv(line));
  assert(fields.every((item) => item[2].includes("(?=.*(?:/feed))")));
  assert(fields.some((item) => item[3] === "replace" && item[4] === "$.data.ads" && item[5] === "[]"));
  assert(fields.some((item) => item[3] === "delete" && item[4] === "$.data.banner"));
  assert(!compatAmrs.content.includes("1, 100,"));
  assert(compat.diagnostics.some((item) => item.code === "script-native-lift"));
  assert(!compat.diagnostics.some((item) => item.code === "script-aggressive-native-lift"));
  assert.deepEqual(validateAnywhereOutput(compatAmrs), []);
});

test("aggressive mode lifts array splice clears", async () => {
  const source = `
#!name = JS Aggressive Splice Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/splice.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const script = `
let obj = JSON.parse($response.body);
obj.data.items.splice(0);
$done({ body: JSON.stringify(obj) });
`;
  const compat = await convertModuleAsync(source, {
    fetchScripts: true,
    mode: "compat",
    fetchText: async () => script,
  });
  const compatAmrs = compat.files.find((file) => file.type === "amrs");
  assert(compatAmrs.content.includes("1, 100,"));
  assert(!compat.diagnostics.some((item) => item.code === "script-aggressive-native-lift"));

  const aggressive = await convertModuleAsync(source, {
    fetchScripts: true,
    mode: "aggressive",
    fetchText: async () => script,
  });
  const aggressiveAmrs = aggressive.files.find((file) => file.type === "amrs");
  const line = aggressiveAmrs.content.split("\n").find((item) => item.startsWith("1, 5,"));
  assert.deepEqual(internals.parseCsv(line).slice(3), ["replace", "$.data.items", "[]"]);
  assert(!aggressiveAmrs.content.includes("1, 100,"));
  assert(aggressive.diagnostics.some((item) => item.code === "aggressive-mode"));
  assert(aggressive.diagnostics.some((item) => item.code === "script-aggressive-native-lift"));
  assert.deepEqual(validateAnywhereOutput(aggressiveAmrs), []);
});

test("lifts multiple exact filter exclusions to native body-json", async () => {
  const source = `
#!name = JS Lift Multi Filter Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/multi-filter.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
let obj = JSON.parse($response.body);
obj.data.items = obj.data.items.filter(item => item.type !== "ad" && item.type !== "sponsor");
$response.body = JSON.stringify(obj);
$done({});
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 5,"));
  assert.deepEqual(internals.parseCsv(line).slice(3), ["remove-where-field-in", "$.data.items", "type", "[\"ad\",\"sponsor\"]"]);
  assert(!amrs.content.includes("1, 100,"));
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts trivial recursive delete walkers to native body-json", async () => {
  const source = `
#!name = JS Lift Recursive Delete Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/feed script-path=https://example.com/recursive-delete.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const obj = JSON.parse($response.body);
function walk(node) {
  if (!node || typeof node !== "object") return;
  delete node.ad;
  delete node.promo;
  Object.keys(node).forEach(key => walk(node[key]));
}
walk(obj);
$done({ body: JSON.stringify(obj) });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const bodyJsonLines = amrs.content.split("\n").filter((item) => item.startsWith("1, 5,"));
  assert.equal(bodyJsonLines.length, 2);
  const fields = bodyJsonLines.map((line) => internals.parseCsv(line).slice(3));
  assert(fields.some((item) => item[0] === "delete-recursive" && item[1] === "ad"));
  assert(fields.some((item) => item[0] === "delete-recursive" && item[1] === "promo"));
  assert(!amrs.content.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-native-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts static request header and url mutations", async () => {
  const source = `
#!name = Request Lift Mini
[Script]
http-request ^https:\\/\\/api\\.example\\.com\\/old script-path=https://example.com/request.js, requires-body=false
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const nextUrl = "https://api.example.com/new";
const headerName = "x-test";
const headerValue = "1";
const cacheHeader = "if-none-match";
$request.url = nextUrl;
$request.headers[headerName] = headerValue;
delete $request.headers[cacheHeader];
$done($request);
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const lines = amrs.content.split("\n");
  assert(lines.some((line) => line.includes(", 0, ^https://api") && line.includes("https://api.example.com/new")));
  assert(lines.some((line) => line.includes("0, 3,") && line.includes("x-test, 1")));
  assert(lines.some((line) => line.includes("0, 2,") && line.includes("if-none-match")));
  assert(!amrs.content.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-request-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts static request url replace and header object assign", async () => {
  const source = `
#!name = Request Replace Lift Mini
[Script]
http-request ^https:\\/\\/old\\.example\\.com\\/api\\/(.*) script-path=https://example.com/request-replace.js, requires-body=false
[MITM]
hostname = old.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
$request.url = $request.url.replace(/^https:\\/\\/old\\.example\\.com\\/api\\/(.*)/, "https://new.example.com/api/$1");
Object.assign($request.headers, { "x-test": "1", "Cache-Control": "no-cache" });
$done($request);
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const lines = amrs.content.split("\n");
  assert(lines.some((line) => line.includes(", 0, ^https://old") && line.includes("https://new.example.com/api/$1")));
  assert(lines.some((line) => line.includes("0, 3,") && line.includes("x-test, 1")));
  assert(lines.some((line) => line.includes("0, 3,") && line.includes("cache-control, no-cache")));
  assert(!amrs.content.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-request-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts static request done object mutations", async () => {
  const source = `
#!name = Request Done Object Lift Mini
[Script]
http-request ^https:\\/\\/api\\.example\\.com\\/old script-path=https://example.com/request-done-object.js, requires-body=false
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const nextUrl = "https://api.example.com/new";
$done({
  url: nextUrl,
  headers: { "x-test": "1", "Cache-Control": "no-cache" }
});
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const lines = amrs.content.split("\n");
  assert(lines.some((line) => line.includes(", 0, ^https://api") && line.includes("https://api.example.com/new")));
  assert(lines.some((line) => line.includes("0, 3,") && line.includes("x-test, 1")));
  assert(lines.some((line) => line.includes("0, 3,") && line.includes("cache-control, no-cache")));
  assert(!amrs.content.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-request-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts fixed request response scripts to lightweight respond script", async () => {
  const source = `
#!name = JS Lift Respond Mini
[Script]
http-request ^https:\\/\\/api\\.example\\.com\\/ad script-path=https://example.com/respond.js, requires-body=false
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
$done({ response: { status: 302, headers: { Location: "https://example.com/blank", "Cache-Control": "no-cache" }, body: "" } });
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("0, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /Anywhere\.respond/);
  assert.match(wrapped, /status: 302/);
  assert(!wrapped.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-respond-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("lifts query parameter request redirects to lightweight respond script", async () => {
  const source = `
#!name = Query Redirect Mini
[Script]
http-request ^https:\\/\\/www\\.example\\.com\\/link script-path=https://example.com/redirect.js, requires-body=false
[MITM]
hostname = www.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
let url = $request.url;
let match = url.match(/url=([^&]+)/);
if (match) {
  let realUrl = decodeURIComponent(match[1]);
  $done({ response: { status: 302, headers: { Location: realUrl, "Cache-Control": "no-cache" } } });
  return;
}
$done({});
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("0, 100,"));
  const lifted = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(lifted, /decodeURIComponent/);
  assert.match(lifted, /Anywhere\.respond/);
  assert.match(lifted, /status: 302/);
  assert(!lifted.includes("new Function"));
  assert(result.diagnostics.some((item) => item.code === "script-query-redirect-lift"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("wraps script argument and task fetch compatibility", async () => {
  const source = `
#!name = JS Compat Task Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/config script-path=https://example.com/task.js, requires-body=true, argument=foo=bar&enabled=1
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const request = { url: "https://config.example.com/profile?" + $argument };
$task.fetch(request).then(resp => $done({ body: resp.body }));
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /var \$argument = "foo=bar&enabled=1"/);
  assert.match(wrapped, /var \$task = \{/);
  assert.match(wrapped, /fetch: function/);
  assert.match(wrapped, /\$task, \$argument/);
  assert(result.diagnostics.some((item) => item.code === "script-http-client"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("uses script timeout in compatibility wrapper with bounded upper limit", async () => {
  const source = `
#!name = JS Compat Timeout Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/slow script-path=https://example.com/slow.js, requires-body=true, timeout=60
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
setTimeout(() => $done({ body: $response.body }), 200);
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /__setTimeout\(resolve, 10000\)/);
  assert.match(wrapped, /globalThis\.setTimeout = __setTimeout/);
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("binary body mode exposes response body as bytes and writes bytes back", async () => {
  const source = `
#!name = Binary Body Compat Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/proto script-path=https://example.com/proto.js, requires-body=true, binary-body-mode=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async () => `
const bytes = $response.body;
bytes[0] = 7;
$done($response);
`,
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const line = amrs.content.split("\n").find((item) => item.startsWith("1, 100,"));
  const wrapped = Buffer.from(internals.parseCsv(line)[3], "base64").toString("utf8");
  assert.match(wrapped, /var __binaryBodyMode = true/);
  assert.match(wrapped, /body: __binaryBodyMode \? __bodyBytes : __bodyText/);
  assert.match(wrapped, /ctx\.body = __bodyOut\(\$response\.body\)/);
  assert(result.diagnostics.some((item) => item.code === "script-binary-sample-required"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("merges same-phase scripts into gated dispatcher", async () => {
  const source = `
#!name = Script Dispatcher Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/a script-path=https://example.com/a.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/b script-path=https://example.com/b.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async (url) => url.endsWith("a.js")
      ? "$done({ body: 'a' })"
      : "$done({ body: 'b' })",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 100,"));
  assert.equal(scriptLines.length, 1);
  const fields = internals.parseCsv(scriptLines[0]);
  assert.match(fields[2], /\^https:\/\/api\\\.example\\\.com\/\(\?:a\|b\)/);
  const wrapped = Buffer.from(fields[3], "base64").toString("utf8");
  assert.match(wrapped, /new RegExp/);
  assert.match(wrapped, /__anywhere_part_0/);
  assert.match(wrapped, /__anywhere_part_1/);
  assert(result.diagnostics.some((item) => item.code === "script-dispatcher-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("fetches legacy script-response-header and script-response-body URLs", async () => {
  const source = `
#!name = Legacy Script Syntax Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/header url script-response-header https://example.com/header.js
http-response ^https:\\/\\/api\\.example\\.com\\/body script-response-body https://example.com/body.js
[MITM]
hostname = api.example.com
`;
  const fetched = [];
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async (url) => {
      fetched.push(url);
      return url.endsWith("header.js")
        ? "$done({ headers: $response.headers })"
        : "$done({ body: $response.body })";
    },
  });
  assert.deepEqual(fetched, ["https://example.com/header.js", "https://example.com/body.js"]);
  assert(!result.diagnostics.some((item) => item.code === "script-source-missing"));
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 100,"));
  assert.equal(scriptLines.length, 1);
  assert(result.diagnostics.some((item) => item.code === "script-dispatcher-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});

test("merges identical script sources before gated dispatcher", async () => {
  const source = `
#!name = Reused Script Mini
[Script]
http-response ^https:\\/\\/api\\.example\\.com\\/a script-path=https://example.com/reused.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/b script-path=https://example.com/reused.js, requires-body=true
http-response ^https:\\/\\/api\\.example\\.com\\/c script-path=https://example.com/other.js, requires-body=true
[MITM]
hostname = api.example.com
`;
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    fetchText: async (url) => url.endsWith("reused.js")
      ? "$done({ body: 'reused' })"
      : "$done({ body: 'other' })",
  });
  const amrs = result.files.find((file) => file.type === "amrs");
  const scriptLines = amrs.content.split("\n").filter((line) => line.startsWith("1, 100,"));
  assert.equal(scriptLines.length, 1);
  const wrapped = Buffer.from(internals.parseCsv(scriptLines[0])[3], "base64").toString("utf8");
  assert.match(wrapped, /\|/);
  assert.equal((wrapped.match(/reused/g) || []).length < 4, true);
  assert(result.diagnostics.some((item) => item.code === "script-source-merged"));
  assert(result.diagnostics.some((item) => item.code === "script-dispatcher-merged"));
  assert.deepEqual(validateAnywhereOutput(amrs), []);
});
