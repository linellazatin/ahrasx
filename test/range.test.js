import assert from "node:assert/strict";
import test from "node:test";
import { resolveRange } from "../src/engine/range.js";

const releases = [{ tag: "v1.0.0" }, { tag: "v1.1.0" }, { tag: "v2.0.0" }];
test("resolveRange returns an ordered immutable release range", () => {
  const range = resolveRange(releases, "v1.0.0", "v2.0.0");
  assert.deepEqual(range.compareRefs, ["v1.0.0", "v2.0.0"]);
  assert.throws(() => resolveRange(releases, "v2.0.0", "v1.0.0"), /before/);
  assert.throws(() => resolveRange(releases, "v0.1.0", "v1.0.0"), /not found/);
});

test("resolveRange accepts a harness-specific tag prefix", () => {
  const releases = [{ tag: "rust-v0.159.0" }, { tag: "rust-v0.159.2" }];
  const range = resolveRange(releases, "rust-v0.159.0", "rust-v0.159.2", { tagPrefix: "rust-v" });
  assert.deepEqual(range.compareRefs, ["rust-v0.159.0", "rust-v0.159.2"]);
});

test("resolveRange resolves latest to the highest stable release under each harness policy", () => {
  const regular = resolveRange([{ tag: "v1.1.0" }, { tag: "v2.0.0" }, { tag: "v1.0.0" }], "v1.0.0", "latest");
  const prefixed = resolveRange([{ tag: "rust-v0.159.0" }, { tag: "rust-v0.160.0" }, { tag: "rust-v0.159.2" }], "rust-v0.159.0", "latest", { tagPrefix: "rust-v" });

  assert.deepEqual(regular.compareRefs, ["v1.0.0", "v2.0.0"]);
  assert.deepEqual(prefixed.compareRefs, ["rust-v0.159.0", "rust-v0.160.0"]);
  assert.throws(() => resolveRange([{ tag: "v1.0.0" }], "latest", "v1.0.0"), /only be used as --to/);
});

test("resolveRange accepts ordered prerelease endpoints without changing latest", () => {
  const releases = [
    { tag: "rust-v0.159.0", prerelease: false },
    { tag: "rust-v0.159.2", prerelease: false },
    { tag: "rust-v0.160.0-alpha.6.1", prerelease: true },
    { tag: "rust-v0.161.0-alpha.4", prerelease: true },
    { tag: "rusty-v8-v152.2.0", prerelease: false },
  ];

  const prereleaseRange = resolveRange(releases, "rust-v0.159.0", "rust-v0.161.0-alpha.4", { tagPrefix: "rust-v" });
  const stableLatest = resolveRange(releases, "rust-v0.159.0", "latest", { tagPrefix: "rust-v" });

  assert.deepEqual(prereleaseRange.compareRefs, ["rust-v0.159.0", "rust-v0.161.0-alpha.4"]);
  assert.deepEqual(prereleaseRange.releases.map((release) => release.tag), ["rust-v0.159.0", "rust-v0.159.2", "rust-v0.160.0-alpha.6.1", "rust-v0.161.0-alpha.4"]);
  assert.deepEqual(stableLatest.compareRefs, ["rust-v0.159.0", "rust-v0.159.2"]);
});
