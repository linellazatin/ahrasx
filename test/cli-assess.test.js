import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { saveConfig } from "../src/config.js";
import { runCli } from "../src/cli.js";

test("assess resolves the latest alias before writing report paths", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ahrasx-cli-assess-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  await writeFile(path.join(cwd, "target.js"), "ExtensionAPI.use();\n");
  await saveConfig(cwd, { schemaVersion: 1, harnesses: { pi: { targets: ["https://github.com/owner/repo"] } } });
  let text = ""; const output = new Writable({ write(c, _e, done) { text += c; done(); } });
  let diffRequested = false;
  let materializeInput;
  let capturedReport;
  const exitCode = await runCli(["assess", "--harness", "pi", "--from", "v1.0.0", "--to", "latest"], { cwd, input: Readable.from([]), output, error: output, services: { listStableReleases: async () => [{ tag: "v1.0.0" }, { tag: "v1.1.0" }], materializeRef: async (input) => { materializeInput = input; return { directory: cwd, repoUrl: input.repoUrl, revision: "abc" }; }, getUpstreamDiff: async () => { diffRequested = true; return "+ ExtensionAPI"; }, collectChangedSurfaces: () => [{ matcherId: "pi-extension-api" }], writeReport: async (report) => { capturedReport = report; return { jsonPath: "report.json", markdownPath: "report.md" }; } } });
  assert.equal(exitCode, 0);
  assert.equal(materializeInput.ref, undefined);
  assert.equal(diffRequested, true);
  assert.deepEqual(capturedReport.command, { name: "assess", harness: "pi", from: "v1.0.0", to: "v1.1.0" });
  assert.match(text, /report\.json/);
  assert.match(text, /inconclusive=0/);
});
