const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Production documents permit the lab decoder after direct or client navigation", async () => {
  const configModule = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../next.config.js"), "utf8"),
    {
      module: configModule,
      require,
      __dirname: path.join(__dirname, ".."),
      process: { env: { NODE_ENV: "production" } },
    },
  );
  const rules = await configModule.exports.headers();
  const policies = rules
    .filter((rule) => rule.source === "/(.*)" || rule.source === "/lab/:path*")
    .flatMap((rule) => rule.headers)
    .filter((header) => header.key === "Content-Security-Policy");
  assert.ok(policies.length, "Public documents must receive a CSP");
  for (const { value } of policies) {
    const scripts = value.split(";").map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src ")).split(/\s+/).slice(1);
    assert.ok(scripts.includes("'wasm-unsafe-eval'"), "Compressed models need WebAssembly even when Home is reached from another route");
    assert.ok(!scripts.includes("'unsafe-eval'"), "Production must continue to block JavaScript eval");
    assert.ok(scripts.includes("'self'"));
    assert.ok(!scripts.some((source) => /^(https?:|data:|blob:|\*)/.test(source)), "External script sources remain blocked");
  }
});
