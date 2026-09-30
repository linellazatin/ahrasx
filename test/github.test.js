import assert from "node:assert/strict";
import test from "node:test";
import { listReleases } from "../src/github.js";

test("listReleases retains published prereleases and excludes drafts", async () => {
  const releases = await listReleases("https://github.com/owner/repo", async () => ({
    ok: true,
    json: async () => [
      { tag_name: "v1.0.0", draft: false, prerelease: false, published_at: "2026-01-01T00:00:00Z" },
      { tag_name: "v1.1.0-rc.1", draft: false, prerelease: true },
      { tag_name: "v1.2.0", draft: true, prerelease: false },
    ],
  }));
  assert.deepEqual(releases, [
    { tag: "v1.0.0", prerelease: false, publishedAt: "2026-01-01T00:00:00Z", notes: "" },
    { tag: "v1.1.0-rc.1", prerelease: true, publishedAt: null, notes: "" },
  ]);
});
