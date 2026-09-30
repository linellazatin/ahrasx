import { scanTarget } from "./scan.js";

function createTriage({ harness, changedSurfaces, findings }) {
  const findingsByMatcher = new Map();
  for (const finding of findings) {
    const findingIds = findingsByMatcher.get(finding.matcherId) ?? [];
    findingIds.push(finding.findingId);
    findingsByMatcher.set(finding.matcherId, findingIds);
  }
  const changesByMatcher = new Map();
  for (const change of changedSurfaces) {
    const changes = changesByMatcher.get(change.matcherId) ?? [];
    changes.push(change);
    changesByMatcher.set(change.matcherId, changes);
  }
  const potentialBreakingChanges = [];
  const reviewRecommended = [];
  const watchouts = [];
  const recommendations = [];
  for (const [matcherId, changes] of changesByMatcher) {
    const matcher = harness.surfaceMatchers.find((candidate) => candidate.id === matcherId);
    const findingIds = findingsByMatcher.get(matcherId) ?? [];
    const hasRemoval = changes.some((change) => change.change === "remove");
    if (findingIds.length) {
      const item = { matcherId, kind: matcher.kind, priority: hasRemoval ? "high" : "normal", urgency: "before_next_upgrade", findingIds };
      if (hasRemoval) {
        potentialBreakingChanges.push(item);
        recommendations.push(`Review direct target uses for ${matcherId} against removed upstream evidence before upgrading.`);
      } else {
        reviewRecommended.push(item);
        recommendations.push(`Review direct target uses for ${matcherId} before upgrading.`);
      }
    } else if (matcher.targetToken === null) {
      watchouts.push({ matcherId, kind: matcher.kind, priority: "normal", urgency: "before_next_upgrade" });
      recommendations.push(`Manually review ${matcherId} because this surface has no deterministic target scanner.`);
    }
  }
  return { potentialBreakingChanges, reviewRecommended, watchouts, recommendations };
}

export async function assess({ command, harness, range, changedSurfaces, targets, materializeTarget }) {
  const changedIds = new Set(changedSurfaces.map((surface) => surface.matcherId));
  const surfaces = harness.surfaceMatchers
    .filter((surface) => changedIds.has(surface.id))
    .filter((surface) => surface.targetToken !== null)
    .map((surface) => ({ ...surface, token: surface.targetToken ?? surface.token }));
  const findings = [];
  const targetResults = [];
  for (const target of targets) {
    try {
      const checkout = await materializeTarget(target);
      const targetFindings = await scanTarget({ checkout, surfaces });
      const findingIds = [];
      for (const finding of targetFindings) {
        const findingId = `F-${findings.length + 1}`;
        findings.push({ ...finding, findingId });
        findingIds.push(findingId);
      }
      targetResults.push({ target, revision: checkout.revision, classification: targetFindings.length ? "confirmed_match" : "no_match", findingIds });
    } catch (error) {
      targetResults.push({ target, classification: "inconclusive", error: error.message });
    }
  }
  return {
    command,
    harness,
    range,
    upstreamEvidence: changedSurfaces,
    findings,
    targets: targetResults,
    triage: createTriage({ harness, changedSurfaces, findings }),
    limitations: ["A confirmed match is evidence of a changed integration surface, not proof of incompatibility.", "Surfaces without a targetToken are reported as upstream evidence only and require manual target review."],
  };
}
