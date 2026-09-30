import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { materializeRef, runGit } from "../src/git.js";

test("runGit executes an argument array without a shell", async () => {
  const result = await runGit(["--version"]);
  assert.match(result.stdout, /^git version /);
  await assert.rejects(() => runGit("--version"), /argument array/);
});

test("materializeRef refreshes an existing AHRASX cache clone", async (t) => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "ahrasx-cache-"));
  t.after(() => rm(cacheDir, { force: true, recursive: true }));
  const repoUrl = "https://github.com/owner/repo";
  const id = createHash("sha256").update(`${repoUrl}@default`).digest("hex").slice(0, 16);
  const directory = path.join(cacheDir, id);
  await mkdir(path.join(directory, ".git"), { recursive: true });
  const calls = [];

  const result = await materializeRef({ repoUrl, cacheDir }, { runGitImpl: async (args, options) => {
    calls.push({ args, options });
    return args[0] === "rev-parse" ? { stdout: "deadbeef\n", stderr: "" } : { stdout: "", stderr: "" };
  } });

  assert.deepEqual(calls.map((call) => call.args), [
    ["fetch", "--depth", "1", "origin"],
    ["checkout", "--detach", "FETCH_HEAD"],
    ["rev-parse", "HEAD"],
  ]);
  assert.equal(result.directory, directory);
  assert.equal(result.revision, "deadbeef");
});
