import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const EXCLUDED_DIRECTORIES = new Set([".git", ".superpowers", "build", "coverage", "dist", "docs", "node_modules", "reports", "test", "tests"]);
const SCANNABLE_EXTENSIONS = new Set([".cjs", ".js", ".json", ".jsonc", ".jsx", ".mjs", ".ts", ".tsx", ".yaml", ".yml"]);

function matchesTargetPath(relativePath, targetPaths) {
  return !targetPaths || targetPaths.some((targetPath) => relativePath === targetPath || targetPath.endsWith("/") && relativePath.startsWith(targetPath));
}

async function files(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, absolute));
    else if (SCANNABLE_EXTENSIONS.has(path.extname(entry.name))) result.push({ absolute, relative: path.relative(root, absolute) });
  }
  return result;
}

export async function scanTarget({ checkout, surfaces }) {
  const findings = [];
  for (const file of await files(checkout.directory)) {
    const text = await readFile(file.absolute, "utf8").catch(() => null);
    if (text === null || text.length > 1_000_000) continue;
    for (const [index, line] of text.split("\n").entries()) {
      for (const surface of surfaces) {
        if (!matchesTargetPath(file.relative, surface.targetPaths)) continue;
        if (typeof surface.token !== "string") surface.token.lastIndex = 0;
        const matches = typeof surface.token === "string" ? line.includes(surface.token) : surface.token.test(line);
        if (matches) findings.push({ findingId: `F-${findings.length + 1}`, classification: "confirmed_match", target: checkout.repoUrl, revision: checkout.revision, path: file.relative, line: index + 1, matcherId: surface.id, kind: surface.kind, matchedText: line.trim() });
      }
    }
  }
  return findings;
}
