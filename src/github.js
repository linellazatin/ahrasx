import { parsePublicGitHubUrl } from "./config.js";

export async function listReleases(upstream, fetchImpl = fetch) {
  const { owner, repo } = parsePublicGitHubUrl(upstream);
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;
  const response = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) {
    throw new Error(`GitHub release request failed (${response.status}) for ${url}.`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`GitHub release response was invalid for ${url}.`);
  }
  return payload
    .filter((release) => !release.draft && typeof release.tag_name === "string")
    .map((release) => ({ tag: release.tag_name, prerelease: Boolean(release.prerelease), publishedAt: release.published_at ?? null, notes: release.body ?? "" }));
}

export async function fetchReleaseDiff(upstream, fromTag, toTag, fetchImpl = fetch) {
  const { owner, repo } = parsePublicGitHubUrl(upstream);
  const url = `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(fromTag)}...${encodeURIComponent(toTag)}.diff`;
  const response = await fetchImpl(url, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`GitHub compare request failed (${response.status}) for ${url}.`);
  return response.text();
}
