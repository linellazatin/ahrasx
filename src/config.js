import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONFIG_SCHEMA_VERSION, SUPPORTED_HARNESS_IDS } from "./contracts.js";

const REPOSITORY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parsePublicGitHubUrl(value) {
  if (typeof value !== "string") {
    throw new TypeError("Expected a public GitHub repository URL.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("Expected a public GitHub repository URL.");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    segments.length !== 2 ||
    !segments.every((segment) => REPOSITORY_SEGMENT.test(segment))
  ) {
    throw new TypeError("Expected a public GitHub repository URL.");
  }

  const [owner, repo] = segments;
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

export function configPath(cwd) {
  return path.join(cwd, ".ahrasx", "config.json");
}

export function validateConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Configuration must be an object.");
  }
  if (value.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new TypeError(`Expected schemaVersion ${CONFIG_SCHEMA_VERSION}.`);
  }
  if (!value.harnesses || typeof value.harnesses !== "object" || Array.isArray(value.harnesses)) {
    throw new TypeError("Configuration must contain harnesses.");
  }

  const harnesses = {};
  for (const [harnessId, harnessConfig] of Object.entries(value.harnesses)) {
    if (!SUPPORTED_HARNESS_IDS.includes(harnessId)) {
      throw new TypeError(`unknown harness: ${harnessId}.`);
    }
    if (!harnessConfig || typeof harnessConfig !== "object" || !Array.isArray(harnessConfig.targets)) {
      throw new TypeError(`Harness ${harnessId} must contain targets.`);
    }

    const targets = harnessConfig.targets.map((target) => parsePublicGitHubUrl(target).url);
    if (new Set(targets.map((target) => target.toLowerCase())).size !== targets.length) {
      throw new TypeError(`Harness ${harnessId} contains a duplicate target.`);
    }
    harnesses[harnessId] = { targets };
  }

  return { schemaVersion: CONFIG_SCHEMA_VERSION, harnesses };
}

export async function loadConfig(cwd) {
  const contents = await readFile(configPath(cwd), "utf8");
  return validateConfig(JSON.parse(contents));
}

export async function saveConfig(cwd, config) {
  const normalized = validateConfig(config);
  const destination = configPath(cwd);
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.config-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
  return normalized;
}
