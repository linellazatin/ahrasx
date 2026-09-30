function matchesPath(path, allowedPaths) {
  return allowedPaths.some((allowedPath) => path.startsWith(allowedPath));
}

function matchesToken(source, token) {
  if (typeof token === "string") {
    return source.includes(token);
  }
  token.lastIndex = 0;
  return token.test(source);
}

function commentOnly(source) {
  return /^(?:\/\/|\/\*|\*|#|<!--)/.test(source.trim());
}

function boundedEvidence(evidence) {
  const maxLength = 480;
  if (evidence.length <= maxLength) return { evidence };
  return { evidence: `${evidence.slice(0, maxLength)}... [truncated]`, evidenceTruncated: true, evidenceLength: evidence.length };
}

export function collectChangedSurfaces({ diff, matchers }) {
  const findings = [];
  let path = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      path = match ? match[2] : null;
      continue;
    }
    if (!path || line.startsWith("+++") || line.startsWith("---") || !(line.startsWith("+") || line.startsWith("-"))) {
      continue;
    }
    const evidence = line.slice(1).trim();
    if (!evidence || commentOnly(evidence)) {
      continue;
    }
    for (const matcher of matchers) {
      if (matchesPath(path, matcher.paths) && matchesToken(evidence, matcher.token)) {
        findings.push({
          matcherId: matcher.id,
          kind: matcher.kind,
          path,
          change: line.startsWith("+") ? "add" : "remove",
          ...boundedEvidence(evidence),
        });
      }
    }
  }
  return findings;
}
