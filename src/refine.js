export function validateRefinement({ sourceReport, refinement }) {
  if (!refinement || refinement.sourceReportDigest !== sourceReport.digest) throw new TypeError("Refinement source digest does not match the canonical report.");
  if (!Array.isArray(refinement.recommendations)) throw new TypeError("Refinement recommendations must be an array.");
  const findingIds = new Set(sourceReport.findings.map((finding) => finding.findingId));
  for (const recommendation of refinement.recommendations) {
    if (!Array.isArray(recommendation.findingIds) || recommendation.findingIds.some((id) => !findingIds.has(id))) throw new TypeError("Refinement references an unknown finding.");
  }
  return { sourceReportDigest: sourceReport.digest, recommendations: refinement.recommendations.map(({ findingIds, text }) => ({ findingIds: [...findingIds], text })) };
}

export async function writeRefinement({ reportPath, refinement, outputDir }) {
  const sourceReport = JSON.parse(await readFile(reportPath, "utf8"));
  const validated = validateRefinement({ sourceReport, refinement });
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${path.basename(reportPath, ".json")}.refined.md`);
  const lines = ["# AHRASX optional refinement", "", `Source report: ${reportPath}`, `Source digest: ${validated.sourceReportDigest}`, "", "This interpretation does not modify canonical evidence.", "", "## Recommendations", ""];
  for (const recommendation of validated.recommendations) lines.push(`- [${recommendation.findingIds.join(", ")}] ${recommendation.text}`);
  await writeFile(outputPath, `${lines.join("\n")}\n`);
  return outputPath;
}
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
