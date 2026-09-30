function version(tag, { tagPrefix = "" } = {}) {
  const normalizedTag = tagPrefix && tag.startsWith(tagPrefix) ? tag.slice(tagPrefix.length) : tag;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(normalizedTag);
  if (!match) throw new TypeError(`Release tag is not valid semver: ${tag}.`);
  return { core: match.slice(1, 4).map(Number), prerelease: match[4]?.split(".") ?? [] };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) < Number(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function compare(left, right, policy) {
  const a = version(left, policy);
  const b = version(right, policy);
  for (let index = 0; index < a.core.length; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function isComparableRelease(release, policy) {
  try {
    version(release.tag, policy);
    return true;
  } catch {
    return false;
  }
}

export function resolveRange(releases, fromTag, toTag, policy) {
  if (fromTag === "latest") throw new RangeError("latest may only be used as --to.");
  const comparableReleases = releases.filter((release) => isComparableRelease(release, policy));
  const from = comparableReleases.find((release) => release.tag === fromTag);
  const to = toTag === "latest"
    ? comparableReleases.filter((release) => !release.prerelease).reduce((latest, release) => !latest || compare(release.tag, latest.tag, policy) > 0 ? release : latest, null)
    : comparableReleases.find((release) => release.tag === toTag);
  if (!from || !to) throw new RangeError("Requested release tag was not found.");
  if (compare(from.tag, to.tag, policy) > 0) throw new RangeError("Start release must be before end release.");
  const selected = comparableReleases.filter((release) => compare(release.tag, from.tag, policy) >= 0 && compare(release.tag, to.tag, policy) <= 0);
  return Object.freeze({ from, to, releases: Object.freeze(selected), compareRefs: Object.freeze([from.tag, to.tag]) });
}
