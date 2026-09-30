import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function renderMarkdown(report) {
  const lines = [`# AHRASX assessment: ${report.harness.id}`, "", `Range: ${report.range.from.tag} → ${report.range.to.tag}`, `Generated: ${report.generatedAt ?? "not recorded"}`, "", "## Upstream evidence", ""];
  for (const evidence of report.upstreamEvidence ?? []) lines.push(`- [${evidence.change}] ${evidence.matcherId} in ${evidence.path}: \`${evidence.evidence}\``);
  if (!(report.upstreamEvidence ?? []).length) lines.push("- No declared integration-surface changes were detected.");
  lines.push("", "## Potential breaking changes", "");
  for (const item of report.triage?.potentialBreakingChanges ?? []) lines.push(`- [${item.priority} / ${item.urgency}] ${item.matcherId}: ${item.findingIds.join(", ")}`);
  if (!(report.triage?.potentialBreakingChanges ?? []).length) lines.push("- None detected by deterministic removal matching.");
  lines.push("", "## Review recommended", "");
  for (const item of report.triage?.reviewRecommended ?? []) lines.push(`- [${item.priority} / ${item.urgency}] ${item.matcherId}: ${item.findingIds.join(", ")}`);
  if (!(report.triage?.reviewRecommended ?? []).length) lines.push("- None detected.");
  lines.push("", "## Affected target evidence", "");
  for (const finding of report.findings) lines.push(`- ${finding.findingId} [${finding.classification}] ${finding.target}:${finding.path}:${finding.line}: \`${finding.matchedText}\``);
  if (!report.findings.length) lines.push("- No target matches detected.");
  lines.push("", "## Watchouts", "");
  for (const watchout of report.triage?.watchouts ?? []) lines.push(`- [${watchout.priority} / ${watchout.urgency}] ${watchout.matcherId}: no deterministic target scanner.`);
  for (const limitation of report.limitations ?? []) lines.push(`- ${limitation}`);
  lines.push("", "## Recommended verification", "");
  for (const recommendation of report.triage?.recommendations ?? []) lines.push(`- ${recommendation}`);
  lines.push("- Inspect each matched location against its linked upstream evidence, then run the target repository's relevant compatibility tests.");
  return `${lines.join("\n")}\n`;
}

export async function writeReport(report, reportsDir) {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const withoutDigest = { ...report, generatedAt };
  const payload = { ...withoutDigest, digest: createHash("sha256").update(JSON.stringify(withoutDigest)).digest("hex") };
  const stem = `assessment-${Date.now()}`;
  const jsonPath = path.join(reportsDir, `${stem}.json`);
  const markdownPath = path.join(reportsDir, `${stem}.md`);
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(payload));
  return { jsonPath, markdownPath };
}
