import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { parsePublicGitHubUrl } from "./config.js";

export async function runGit(args, { cwd } = {}) {
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) throw new TypeError("Git arguments must be an argument array.");
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, shell: false });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`git failed (${code}): ${stderr.trim().slice(0, 500)}`)));
  });
}

async function hasGitDirectory(directory) {
  try {
    await access(path.join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function materializeRef({ repoUrl, ref, cacheDir }, { runGitImpl = runGit } = {}) {
  const repository = parsePublicGitHubUrl(repoUrl);
  const id = createHash("sha256").update(`${repository.url}@${ref ?? "default"}`).digest("hex").slice(0, 16);
  const directory = path.join(cacheDir, id);
  await mkdir(cacheDir, { recursive: true });
  if (await hasGitDirectory(directory)) {
    await runGitImpl(["fetch", "--depth", "1", "origin"], { cwd: directory });
    await runGitImpl(["checkout", "--detach", "FETCH_HEAD"], { cwd: directory });
  } else {
    const args = ["clone", "--depth", "1"];
    if (ref) args.push("--branch", ref);
    args.push(repository.url, directory);
    await runGitImpl(args);
  }
  const { stdout } = await runGitImpl(["rev-parse", "HEAD"], { cwd: directory });
  return { directory, revision: stdout.trim(), repoUrl: repository.url, ref };
}
