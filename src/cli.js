import { readFile } from "node:fs/promises";
import readline from "node:readline";

import { CONFIG_SCHEMA_VERSION, SUPPORTED_HARNESS_IDS } from "./contracts.js";
import { loadConfig, parsePublicGitHubUrl, saveConfig } from "./config.js";
import { fetchReleaseDiff, listReleases } from "./github.js";
import { materializeRef } from "./git.js";
import { getHarness } from "./harnesses/registry.js";
import { assess } from "./engine/assess.js";
import { collectChangedSurfaces } from "./engine/evidence.js";
import { resolveRange } from "./engine/range.js";
import { writeReport } from "./report.js";

const HELP_TEXT = [
  "AHRASX release assessment CLI",
  "",
  "Usage:",
  "  ahrasx <command> [options]",
  "  ahrasx --help [command]",
  "  ahrasx --version",
  "",
  "Commands:",
  "  init       Configure public GitHub target repositories for a harness",
  "  assess     Compare a harness release range with configured target repositories",
  "  refine     Reserved; no model provider is installed in this version",
  "",
  "Global options:",
  "  -h, --help [command]  Show this help or detailed help for a command",
  "  -v, --version         Print the version from package.json",
  "",
  "Quick start:",
  "  ahrasx init",
  "  ahrasx assess --harness pi --from v0.87.0 --to latest",
  "",
  'Run "ahrasx --help assess" for assessment options and examples.',
  "",
].join("\n");

const COMMAND_HELP = {
  init: [
    "Usage: ahrasx init",
    "",
    "Interactively choose one harness and add one or more public GitHub target URLs.",
    "The configuration is written to .ahrasx/config.json in the current directory.",
    "Running init again replaces that harness's target list and preserves other",
    "harness configurations. URLs must be exact public repository URLs, for example:",
    "  https://github.com/owner/repository",
    "",
    "Supported harnesses: pi, opencode, codex",
    "",
  ].join("\n"),
  assess: [
    "Usage: ahrasx assess --harness <id> --from <tag> --to <tag|latest>",
    "",
    "Required options:",
    "  --harness <id>  Harness configured by init: pi, opencode, or codex",
    "  --from <tag>    Exact published stable or prerelease tag to start from",
    "  --to <tag>      Exact published stable or prerelease tag to end at",
    "  --to latest     Resolve the highest stable release for this harness",
    "",
    "Examples:",
    "  ahrasx assess --harness pi --from v0.87.0 --to latest",
    "  ahrasx assess --harness opencode --from v1.18.20 --to v1.18.33",
    "  ahrasx assess --harness codex --from rust-v0.159.0 --to rust-v0.159.2",
    "  ahrasx assess --harness codex --from rust-v0.159.0 --to rust-v0.161.0-alpha.4",
    "",
    "The command reads .ahrasx/config.json, retrieves public release metadata and",
    "the upstream comparison diff, scans configured targets at their current",
    "default branch revision, and writes JSON and Markdown reports under reports/.",
    "Reports store resolved release tags and target revisions. A target match is",
    "review evidence, not a guarantee of incompatibility. Draft releases are",
    'excluded. The "latest" alias is stable-only and can be used only with --to.',
    "",
  ].join("\n"),
  refine: [
    "Usage: ahrasx refine",
    "",
    "Refinement is not available in this version because no model provider is",
    'installed. Deterministic assessment remains available through "ahrasx assess".',
    "",
  ].join("\n"),
};

function helpText(command) {
  return command && COMMAND_HELP[command] ? COMMAND_HELP[command] : HELP_TEXT;
}

async function packageVersion() {
  const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  if (typeof metadata.version !== "string") throw new Error("Package version is unavailable.");
  return metadata.version;
}

function createPrompter(input, output) {
  const lines = [];
  const waiters = [];
  let closed = false;
  const reader = readline.createInterface({ input, terminal: false });

  reader.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(line);
    } else {
      lines.push(line);
    }
  });
  reader.on("close", () => {
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()(null);
    }
  });

  return {
    async ask(prompt) {
      output.write(prompt);
      if (lines.length > 0) {
        return lines.shift();
      }
      if (closed) {
        return null;
      }
      return new Promise((resolve) => waiters.push(resolve));
    },
    close() {
      reader.close();
    },
  };
}

async function existingConfig(cwd) {
  try {
    return await loadConfig(cwd);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { schemaVersion: CONFIG_SCHEMA_VERSION, harnesses: {} };
    }
    throw error;
  }
}

export async function initializeProject({ cwd, input, output }) {
  const prompt = createPrompter(input, output);
  try {
    let harnessId;
    while (!harnessId) {
      const response = await prompt.ask(`Harness (${SUPPORTED_HARNESS_IDS.join(", ")}): `);
      if (response === null) {
        throw new Error("No harness selected.");
      }
      if (SUPPORTED_HARNESS_IDS.includes(response.trim())) {
        harnessId = response.trim();
      } else {
        output.write("Choose a supported harness.\n");
      }
    }

    const targets = [];
    output.write("Add public GitHub target URLs. Submit an empty line when finished.\n");
    while (true) {
      const response = await prompt.ask("Target URL: ");
      if (response === null) {
        break;
      }
      if (!response.trim()) {
        break;
      }
      try {
        const target = parsePublicGitHubUrl(response).url;
        if (targets.some((value) => value.toLowerCase() === target.toLowerCase())) {
          output.write("Target already added.\n");
        } else {
          targets.push(target);
        }
      } catch (error) {
        output.write(`${error.message}\n`);
      }
    }
    if (targets.length === 0) {
      throw new Error("At least one target URL is required.");
    }

    const config = await existingConfig(cwd);
    config.harnesses[harnessId] = { targets };
    const saved = await saveConfig(cwd, config);
    output.write(`Configured ${harnessId} with ${targets.length} target(s).\n`);
    for (const target of saved.harnesses[harnessId].targets) {
      output.write(`${target}\n`);
    }
    return saved;
  } finally {
    prompt.close();
  }
}

export async function runCli(argv, { cwd, input, output, error, services = {} }) {
  const [command] = argv;
  try {
    if (argv.includes("--version") || argv.includes("-v")) {
      output.write((await packageVersion()) + "\n");
      return 0;
    }
    if (!command || command === "--help" || command === "-h") {
      output.write(helpText(argv[1]));
      return 0;
    }
    if (command === "init") {
      if (argv.includes("--help") || argv.includes("-h")) {
        output.write(helpText("init"));
        return 0;
      }
      await initializeProject({ cwd, input, output });
      return 0;
    }
    if (command === "assess") {
      if (argv.includes("--help") || argv.includes("-h")) {
        output.write(helpText("assess"));
        return 0;
      }
      const values = Object.fromEntries(argv.slice(1).reduce((pairs, value, index, all) => value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
      const harness = getHarness(values.harness);
      if (!harness || !values.from || !values.to) throw new Error("assess requires --harness, --from, and --to.");
      const config = await loadConfig(cwd);
      const targets = config.harnesses[harness.id]?.targets;
      if (!targets?.length) throw new Error(`No configured targets for ${harness.id}.`);
      const releases = await (services.listReleases ?? services.listStableReleases ?? listReleases)(harness.upstream);
      const range = resolveRange(releases, values.from, values.to, harness.releasePolicy);
      const targetMaterializer = (target) => (services.materializeRef ?? materializeRef)({ repoUrl: target, cacheDir: `${cwd}/.ahrasx/cache` });
      const diff = await (services.getUpstreamDiff ?? fetchReleaseDiff)(harness.upstream, range.from.tag, range.to.tag);
      const changedSurfaces = (services.collectChangedSurfaces ?? collectChangedSurfaces)({ diff, matchers: harness.surfaceMatchers });
      const report = await assess({
        command: { name: "assess", harness: harness.id, from: range.from.tag, to: range.to.tag },
        harness,
        range,
        changedSurfaces,
        targets,
        materializeTarget: targetMaterializer,
      });
      const paths = await (services.writeReport ?? writeReport)(report, `${cwd}/reports`);
      output.write(`${paths.jsonPath}\n${paths.markdownPath}\n`);
      const counts = Object.fromEntries(["confirmed_match", "no_match", "inconclusive"].map((classification) => [classification, report.targets.filter((target) => target.classification === classification).length]));
      output.write(`Summary: confirmed_match=${counts.confirmed_match} no_match=${counts.no_match} inconclusive=${counts.inconclusive}\n`);
      return 0;
    }
    if (command === "refine") {
      if (argv.includes("--help") || argv.includes("-h")) {
        output.write(helpText("refine"));
        return 0;
      }
      throw new Error("No refinement provider is installed; deterministic assessment remains available.");
    }
    throw new Error(`Unknown command: ${command}.`);
  } catch (exception) {
    error.write(`${exception.message}\n`);
    return 1;
  }
}
