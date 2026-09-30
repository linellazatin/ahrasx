import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  configPath,
  loadConfig,
  parsePublicGitHubUrl,
  saveConfig,
  validateConfig,
} from "../src/config.js";

test("parsePublicGitHubUrl normalizes a canonical public repository URL", () => {
  assert.deepEqual(parsePublicGitHubUrl("https://github.com/Owner/Repo"), {
    owner: "Owner",
    repo: "Repo",
    url: "https://github.com/Owner/Repo",
  });
});

test("parsePublicGitHubUrl rejects unsupported or ambiguous repository URLs", () => {
  for (const value of [
    "http://github.com/owner/repo",
    "https://token@github.com/owner/repo",
    "https://gitlab.com/owner/repo",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/repo#readme",
  ]) {
    assert.throws(() => parsePublicGitHubUrl(value), /public GitHub repository URL/);
  }
});

test("validateConfig rejects duplicate targets and unknown harnesses", () => {
  assert.throws(
    () => validateConfig({
      schemaVersion: 1,
      harnesses: {
        pi: {
          targets: [
            "https://github.com/owner/repo",
            "https://github.com/owner/repo",
          ],
        },
      },
    }),
    /duplicate target/,
  );

  assert.throws(
    () => validateConfig({
      schemaVersion: 1,
      harnesses: { unknown: { targets: ["https://github.com/owner/repo"] } },
    }),
    /unknown harness/,
  );
});

test("saveConfig writes normalized configuration and loadConfig returns it", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ahrasx-config-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  const config = {
    schemaVersion: 1,
    harnesses: { pi: { targets: ["https://github.com/Owner/Repo"] } },
  };

  await saveConfig(cwd, config);

  assert.deepEqual(await loadConfig(cwd), config);
  assert.equal(
    await readFile(configPath(cwd), "utf8"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
});
