import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderMarkdown, writeReport } from "../src/report.js";

test("renderMarkdown renders every canonical finding ID", () => {
  const markdown = renderMarkdown({ harness: { id: "pi" }, range: { from: { tag: "v1.0.0" }, to: { tag: "v1.1.0" } }, findings: [{ findingId: "F-1", classification: "confirmed_match", target: "https://github.com/owner/repo", path: "index.js", line: 1, matchedText: "ExtensionAPI" }], limitations: [] });
  assert.match(markdown, /F-1/);
  assert.match(markdown, /confirmed_match/);
});

test("reports retain upstream evidence, execution metadata, and structured triage", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-report-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = {
    command: { harness: "pi", from: "v1.0.0", to: "v1.1.0" },
    harness: { id: "pi" },
    range: { from: { tag: "v1.0.0" }, to: { tag: "v1.1.0" } },
    upstreamEvidence: [{ matcherId: "pi-extension-api", change: "remove", path: "api.ts", evidence: "ExtensionAPI" }],
    targets: [{ target: "https://github.com/owner/repo", revision: "abc", classification: "confirmed_match" }],
    findings: [{ findingId: "F-1", matcherId: "pi-extension-api", classification: "confirmed_match", target: "https://github.com/owner/repo", path: "extension.ts", line: 2, matchedText: "ExtensionAPI" }],
    triage: {
      potentialBreakingChanges: [{ matcherId: "pi-extension-api", kind: "api", priority: "high", urgency: "before_next_upgrade", findingIds: ["F-1"] }],
      reviewRecommended: [],
      watchouts: [],
      recommendations: ["Review direct target uses for pi-extension-api against removed upstream evidence before upgrading."],
    },
    limitations: ["Deterministic evidence is not proof of runtime compatibility."],
  };
  const { jsonPath, markdownPath } = await writeReport(report, directory);
  const json = JSON.parse(await readFile(jsonPath, "utf8"));
  const markdown = await readFile(markdownPath, "utf8");
  assert.equal(json.command.harness, "pi");
  assert.equal(json.upstreamEvidence[0].matcherId, "pi-extension-api");
  assert.match(json.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  for (const heading of ["Upstream evidence", "Potential breaking changes", "Review recommended", "Affected target evidence", "Watchouts", "Recommended verification"]) assert.match(markdown, new RegExp(heading));
});
