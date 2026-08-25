import test from "node:test";
import assert from "node:assert/strict";
import { addRule, buildArrs, parseArrs } from "../src/ruleset-core.mjs";

const ICON_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3z8AAAAASUVORK5CYII=";

test("Rule Studio parses, normalizes and emits Anywhere arrs", () => {
  const parsed = parseArrs(`name = 工作规则\nrouting = reject\n2, *.Example.COM\n0, 1.2.3.4\n2, example.com\n`);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.headers.routing, 2);
  assert.deepEqual(parsed.rules, [{ type: 2, value: "example.com" }, { type: 0, value: "1.2.3.4/32" }]);
  const output = buildArrs({ headers: parsed.headers, rules: parsed.rules });
  assert.match(output.content, /^name = 工作规则/m);
  assert.match(output.content, /^routing = 2/m);
  assert.match(output.content, /2, example\.com/);
});

test("Rule Studio can append a structured rule to source", () => {
  const result = addRule("name = Demo\n2, example.com\n", 1, "2001:db8::1");
  assert.equal(result.valid, true);
  assert.match(result.content, /1, 2001:db8::1\/128/);
});

test("Rule Studio preserves a validated inline icon and rejects invalid image data", () => {
  const output = buildArrs({ source: "name = Icon Test\nicon-light = " + ICON_PNG_BASE64 + "\n2, example.com\n" });
  assert.equal(output.valid, true);
  assert.match(output.content, new RegExp("^icon-light = " + ICON_PNG_BASE64 + "$", "m"));
  const invalid = buildArrs({ source: "icon-light = not-image-data\n2, example.com\n" });
  assert.equal(invalid.valid, false);
  assert.match(invalid.diagnostics[0].message, /icon-light/);
});
