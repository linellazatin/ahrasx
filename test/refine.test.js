import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { writeRefinement, validateRefinement } from "../src/refine.js";
import { runCli } from "../src/cli.js";

const report = { digest: "abc", findings: [{ findingId: "F-1" }] };

test("validateRefinement accepts only recommendations anchored to canonical findings", () => {
  assert.deepEqual(validateRefinement({ sourceReport: report, refinement: { sourceReportDigest: "abc", recommendations: [{ findingIds: ["F-1"], text: "Add coverage." }] } }).recommendations[0].findingIds, ["F-1"]);
  assert.throws(() => validateRefinement({ sourceReport: report, refinement: { sourceReportDigest: "abc", recommendations: [{ findingIds: ["F-2"], text: "Unsupported." }] } }), /unknown finding/);
  assert.throws(() => validateRefinement({ sourceReport: report, refinement: { sourceReportDigest: "wrong", recommendations: [] } }), /digest/);
});

test("writeRefinement creates a separate interpretation linked to canonical evidence", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-refine-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const reportPath = path.join(directory, "report.json");
  await writeFile(reportPath, JSON.stringify(report));
  const outputPath = await writeRefinement({ reportPath, refinement: { sourceReportDigest: "abc", recommendations: [{ findingIds: ["F-1"], text: "Add coverage." }] }, outputDir: directory });
  assert.match(outputPath, /refined\.md$/);
});

test("refine reports the explicit no-provider boundary", async () => {
  let text = "";
  const output = new Writable({ write(chunk, _encoding, callback) { text += chunk; callback(); } });
  assert.equal(await runCli(["refine", "report.json"], { cwd: process.cwd(), input: Readable.from([]), output, error: output }), 1);
  assert.match(text, /No refinement provider is installed/);
  assert.match(text, /deterministic assessment remains available/);
});
