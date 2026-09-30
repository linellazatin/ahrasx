import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { collectChangedSurfaces } from "../src/engine/evidence.js";
import { getHarness } from "../src/harnesses/registry.js";

const matchers = [
  { id: "api", kind: "api", paths: ["src/extensions/"], token: "registerTool" },
  { id: "hook", kind: "hook", paths: ["src/hooks/"], token: /before_[a-z_]+/ },
];

test("collectChangedSurfaces returns changed code lines matching declared surfaces", async () => {
  const diff = await readFile(new URL("./fixtures/upstream-diffs/surfaces.patch", import.meta.url), "utf8");

  assert.deepEqual(collectChangedSurfaces({ diff, matchers }), [
    {
      matcherId: "api",
      kind: "api",
      path: "src/extensions/api.js",
      change: "add",
      evidence: "registerTool({ name: 'recall_memory' });",
    },
    {
      matcherId: "hook",
      kind: "hook",
      path: "src/hooks/lifecycle.js",
      change: "remove",
      evidence: "before_provider_request: legacyHandler,",
    },
  ]);
});

test("collectChangedSurfaces bounds oversized structured-line evidence", () => {
  const evidence = `"mcp_servers":"${"x".repeat(1_000)}"`;
  const findings = collectChangedSurfaces({
    diff: `diff --git a/src/config.json b/src/config.json\n+${evidence}\n`,
    matchers: [{ id: "config", kind: "config", paths: ["src/"], token: "mcp_servers" }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidenceTruncated, true);
  assert.equal(findings[0].evidenceLength, evidence.length);
  assert.ok(findings[0].evidence.length < evidence.length);
});

test("OpenCode ignores an internal built-in plugin factory signature change", () => {
  const findings = collectChangedSurfaces({
    diff: [
      "diff --git a/packages/opencode/src/plugin/azure.ts b/packages/opencode/src/plugin/azure.ts",
      "--- a/packages/opencode/src/plugin/azure.ts",
      "+++ b/packages/opencode/src/plugin/azure.ts",
      "-export async function AzureAuthPlugin(_input: PluginInput): Promise<Hooks> {",
      "+export async function AzureAuthPlugin(): Promise<Hooks> {",
    ].join("\n"),
    matchers: getHarness("opencode").surfaceMatchers,
  });

  assert.deepEqual(findings, []);
});

test("OpenCode reports changes to a declared public hook contract", () => {
  const findings = collectChangedSurfaces({
    diff: [
      "diff --git a/packages/plugin/src/index.ts b/packages/plugin/src/index.ts",
      "--- a/packages/plugin/src/index.ts",
      "+++ b/packages/plugin/src/index.ts",
      '-  "tool.execute.after"?: (input: { tool: string }) => Promise<void>',
    ].join("\n"),
    matchers: getHarness("opencode").surfaceMatchers,
  });

  assert.deepEqual(findings.map(({ matcherId, kind, path, change }) => ({ matcherId, kind, path, change })), [
    {
      matcherId: "opencode-hook-tool-after",
      kind: "hook",
      path: "packages/plugin/src/index.ts",
      change: "remove",
    },
  ]);
});
