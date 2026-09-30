import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README is the complete AHRASX operational manual", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const required of ["Pi", "OpenCode", "Codex CLI", "rust-v0.159.0", "rust-v0.161.0-alpha.4", "SessionStart", "@opencode-ai/plugin", ".opencode/plugins/", "Public repositories only", "bin/ahrasx.js init", "assess --harness", "--to latest", "Configuration", "Report interpretation", "Potential breaking changes", "before_next_upgrade", "Troubleshooting", "refine"]) assert.match(readme, new RegExp(required));
});
