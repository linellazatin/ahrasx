import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assess } from "../src/engine/assess.js";

test("assess preserves successful target findings when another target fails", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ahrasx-assess-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(path.join(directory, "extension.js"), "ExtensionAPI.register();\n");
  const report = await assess({
    harness: { id: "pi", surfaceMatchers: [
      { id: "api", kind: "api", paths: ["src/"], token: "ExtensionAPI" },
      { id: "config", kind: "config", paths: ["src/"], token: "extensions", targetToken: null },
    ] },
    range: { from: { tag: "v1.0.0" }, to: { tag: "v1.1.0" } },
    changedSurfaces: [
      { matcherId: "api", kind: "api", path: "src/api.ts", change: "remove", evidence: "ExtensionAPI" },
      { matcherId: "config", kind: "config", path: "src/config.ts", change: "add", evidence: "extensions" },
    ],
    targets: ["https://github.com/owner/ok", "https://github.com/owner/ok2", "https://github.com/owner/fail"],
    materializeTarget: async (target) => {
      if (target.endsWith("/fail")) throw new Error("unavailable");
      return { directory, repoUrl: target, revision: "abc" };
    },
  });
  assert.equal(report.findings.length, 2);
  assert.equal(new Set(report.findings.map((finding) => finding.findingId)).size, 2);
  assert.deepEqual(report.targets.map((target) => target.classification), ["confirmed_match", "confirmed_match", "inconclusive"]);
  assert.deepEqual(report.upstreamEvidence, [
    { matcherId: "api", kind: "api", path: "src/api.ts", change: "remove", evidence: "ExtensionAPI" },
    { matcherId: "config", kind: "config", path: "src/config.ts", change: "add", evidence: "extensions" },
  ]);
  assert.deepEqual(report.targets[0], {
    target: "https://github.com/owner/ok",
    revision: "abc",
    classification: "confirmed_match",
    findingIds: ["F-1"],
  });
  assert.deepEqual(report.triage, {
    potentialBreakingChanges: [{ matcherId: "api", kind: "api", priority: "high", urgency: "before_next_upgrade", findingIds: ["F-1", "F-2"] }],
    reviewRecommended: [],
    watchouts: [{ matcherId: "config", kind: "config", priority: "normal", urgency: "before_next_upgrade" }],
    recommendations: [
      "Review direct target uses for api against removed upstream evidence before upgrading.",
      "Manually review config because this surface has no deterministic target scanner.",
    ],
  });
});
