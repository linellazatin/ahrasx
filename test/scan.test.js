import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanTarget } from "../src/engine/scan.js";

test("scanTarget captures matcher locations from target source", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-scan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "extension.js"), "import { ExtensionAPI } from 'pi';\n");
  const findings = await scanTarget({ checkout: { directory, repoUrl: "https://github.com/owner/repo", revision: "abc" }, surfaces: [{ matcherId: "pi-extension-api", kind: "api", token: "ExtensionAPI" }] });
  assert.deepEqual(findings.map(({ path: file, line, matchedText }) => ({ path: file, line, matchedText })), [{ path: "extension.js", line: 1, matchedText: "import { ExtensionAPI } from 'pi';" }]);
});

test("scanTarget preserves matcher IDs and excludes documentation and test fixtures", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-scan-filter-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all([
    writeFile(path.join(directory, "extension.ts"), "ExtensionAPI.register();\n"),
    (async () => { await (await import("node:fs/promises")).mkdir(path.join(directory, "docs")); await writeFile(path.join(directory, "docs", "notes.md"), "ExtensionAPI\n"); })(),
    (async () => { await (await import("node:fs/promises")).mkdir(path.join(directory, "tests")); await writeFile(path.join(directory, "tests", "extension.test.ts"), "ExtensionAPI\n"); })(),
  ]);
  const findings = await scanTarget({ checkout: { directory, repoUrl: "https://github.com/owner/repo", revision: "abc" }, surfaces: [{ id: "pi-extension-api", kind: "api", token: "ExtensionAPI" }] });
  assert.deepEqual(findings.map(({ path: file, matcherId }) => ({ path: file, matcherId })), [{ path: "extension.ts", matcherId: "pi-extension-api" }]);
});

test("scanTarget honors exact target paths for harness configuration surfaces", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-scan-paths-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await (await import("node:fs/promises")).mkdir(path.join(directory, ".codex-plugin"));
  await Promise.all([
    writeFile(path.join(directory, "plugin.json"), '{"hooks":"unrelated"}\n'),
    writeFile(path.join(directory, ".codex-plugin", "plugin.json"), '{"hooks":"./hooks/hooks.json"}\n'),
  ]);

  const findings = await scanTarget({
    checkout: { directory, repoUrl: "https://github.com/owner/repo", revision: "abc" },
    surfaces: [{ id: "codex-plugin-hooks", kind: "hook", token: "hooks", targetPaths: [".codex-plugin/plugin.json"] }],
  });

  assert.deepEqual(findings.map(({ path: file, line }) => ({ path: file, line })), [{ path: ".codex-plugin/plugin.json", line: 1 }]);
});

test("scanTarget finds OpenCode plugin input access and hook declarations only in plugin source", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-scan-opencode-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await (await import("node:fs/promises")).mkdir(path.join(directory, ".opencode", "plugins"), { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "unrelated.js"), "const client = input && input.client;\n"),
    writeFile(path.join(directory, ".opencode", "plugins", "memory.mjs"), "const client = input && input.client;\nreturn { 'tool.execute.after': async () => {} };\n"),
  ]);

  const findings = await scanTarget({
    checkout: { directory, repoUrl: "https://github.com/owner/repo", revision: "abc" },
    surfaces: [
      { id: "opencode-plugin-input", kind: "api", token: /\binput(?:\s*&&)?\s*\.\s*client\b/, targetPaths: [".opencode/plugins/"] },
      { id: "opencode-hook-tool-after", kind: "hook", token: "tool.execute.after", targetPaths: [".opencode/plugins/"] },
    ],
  });

  assert.deepEqual(findings.map(({ matcherId, path: file, line }) => ({ matcherId, path: file, line })), [
    { matcherId: "opencode-plugin-input", path: ".opencode/plugins/memory.mjs", line: 1 },
    { matcherId: "opencode-hook-tool-after", path: ".opencode/plugins/memory.mjs", line: 2 },
  ]);
});
