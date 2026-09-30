import assert from "node:assert/strict";
import test from "node:test";

import { getHarness, listHarnesses } from "../src/harnesses/registry.js";

test("registry exposes the initial modular harness set", () => {
  assert.deepEqual(listHarnesses().map((harness) => harness.id), ["pi", "opencode", "codex"]);
  assert.equal(getHarness("pi").upstream, "https://github.com/earendil-works/pi");
  assert.equal(getHarness("missing"), null);
});

test("each harness owns unique declarative surface matcher identifiers", () => {
  for (const harness of listHarnesses()) {
    const identifiers = harness.surfaceMatchers.map((matcher) => matcher.id);
    assert.equal(new Set(identifiers).size, identifiers.length, `${harness.id} matcher IDs`);
    assert.ok(harness.surfaceMatchers.every((matcher) => matcher.paths.length > 0));
  }
});

test("built-in matchers declare whether they can be searched in target source", () => {
  for (const harness of listHarnesses()) {
    for (const matcher of harness.surfaceMatchers) {
      assert.ok(Object.hasOwn(matcher, "targetToken"), `${harness.id}/${matcher.id} target scan intent`);
      assert.ok(matcher.targetToken === null || typeof matcher.targetToken === "string" || matcher.targetToken instanceof RegExp, `${harness.id}/${matcher.id} target token`);
    }
  }
});

test("Pi extension-discovery evidence uses its explicit command-line surface", () => {
  const matcher = getHarness("pi").surfaceMatchers.find((candidate) => candidate.id === "pi-extension-config");
  assert.equal(matcher.token, "--no-extensions");
  assert.equal(matcher.targetToken, null);
});

test("Codex matchers target plugin manifests and SessionStart hook declarations", () => {
  const matchers = getHarness("codex").surfaceMatchers;
  assert.deepEqual(matchers.map(({ id, token, targetToken, targetPaths }) => ({ id, token, targetToken, targetPaths })), [
    { id: "codex-plugin-mcp-config", token: "mcp_servers", targetToken: "mcp_servers", targetPaths: [".codex-plugin/plugin.json"] },
    { id: "codex-plugin-hooks", token: "PluginManifestHooks", targetToken: "hooks", targetPaths: [".codex-plugin/plugin.json"] },
    { id: "codex-session-start-hook", token: "SessionStart", targetToken: "SessionStart", targetPaths: ["hooks/hooks.json"] },
  ]);
});

test("OpenCode matchers target the public plugin package and plugin source", () => {
  const matchers = getHarness("opencode").surfaceMatchers;
  assert.deepEqual(matchers.map(({ id, paths, targetPaths }) => ({ id, paths, targetPaths })), [
    { id: "opencode-plugin-input-client", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-plugin-factory", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-plugin-tool", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-config", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-tool-after", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-system-transform", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-session-compacting", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-compaction-autocontinue", paths: ["packages/plugin/src/index.ts"], targetPaths: [".opencode/plugins/"] },
  ]);
});
