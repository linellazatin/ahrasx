# AHRASX

`AHRASX` is a CLI tool for assessing whether changes between public releases of an agent harness may affect public projects that integrate with that harness. It compares upstream source changes with configured target repositories, saves the evidence as JSON, and renders a Markdown report. Assessment is deterministic and source based; findings identify locations to review and do not prove runtime incompatibility.

## Supported harnesses and scope

| Harness | ID | Upstream repository | Release tag notes | Assessed integration scope |
| --- | --- | --- | --- | --- |
| Pi | `pi` | [`earendil-works/pi`](https://github.com/earendil-works/pi) | Stable and published prerelease SemVer tags | Extension APIs, context, and discovery configuration |
| OpenCode | `opencode` | [`anomalyco/opencode`](https://github.com/anomalyco/opencode) | Stable and published prerelease SemVer tags | Public `@opencode-ai/plugin` contract; target plugin source under `.opencode/plugins/` |
| Codex CLI | `codex` | [`openai/codex`](https://github.com/openai/codex) | Tags use the `rust-v` prefix, such as `rust-v0.159.0` | Plugin MCP declarations, plugin hooks, and the `SessionStart` hook event |

In `v0.1.0`, target repositories must be public GitHub repositories. AHRASX does not use GitHub authentication, access private repositories, modify repositories, open pull requests, or automatically change code. It uses public release metadata, public compare diffs, and Git to read upstream and target sources.

## Public repositories only

Private GitHub repositories, local target paths, authenticated GitHub access, and GitHub writes are outside the `v0.1.0` scope.

Coverage is limited to the declared integration surfaces in the table. A missing finding means no configured changed surface was detected in target source; it does not establish full compatibility.

## Requirements

- Node.js 26.10.0 or newer.
- Git available on PATH.
- Network access to public GitHub release, comparison, and repository endpoints.

Run commands from the AHRASX project directory. Invoke the CLI with node bin/ahrasx.js; the examples use this form so they work directly from a checkout.

## Quick start

```sh
node bin/ahrasx.js --help
node bin/ahrasx.js init
node bin/ahrasx.js assess --harness pi --from v0.87.0 --to latest
```

The first command prints CLI usage, the second creates a project configuration, and the third assesses the selected release range against the Pi target repositories in that configuration. Each successful assessment prints the JSON report path, Markdown report path, and target classification counts.

## Commands and options

### Global help

```sh
node bin/ahrasx.js --help
node bin/ahrasx.js -h
node bin/ahrasx.js --help assess
node bin/ahrasx.js init --help
node bin/ahrasx.js assess --help
node bin/ahrasx.js refine --help
```

The top-level help lists commands and quick-start usage. Command-specific help explains setup, assessment options, or the current refinement boundary.

### Version

```sh
node bin/ahrasx.js --version
node bin/ahrasx.js -v
```

The version is read from the project's package.json.

### Initialize target configuration

```sh
node bin/ahrasx.js init
```

Choose one supported harness ID when prompted, then enter one or more repository URLs in the form https://github.com/OWNER/REPOSITORY. Submit an empty line to finish. `AHRASX` validates and normalizes each URL, rejects duplicates, and writes `.ahrasx/config.json` under the current working directory. Running init again replaces the target list for the selected harness and preserves configuration for other harnesses.

Example configuration:

```json
{
  "schemaVersion": 1,
  "harnesses": {
    "pi": {
      "targets": [
        "https://github.com/linellazatin/nanomneme",
        "https://github.com/linellazatin/opl-pi-sht",
        "https://github.com/linellazatin/openpi-memory"
      ]
    },
    "codex": {
      "targets": ["https://github.com/linellazatin/nanomneme"]
    }
  }
}
```

You can inspect or edit this JSON directly, but it must retain the schema version, known harness IDs, and valid unique public GitHub repository URLs. The working directory determines which configuration AHRASX reads.

### Assess a release range

```sh
node bin/ahrasx.js assess --harness <pi|opencode|codex> --from <release-tag> --to <release-tag|latest>
```

All three options are required. The selected harness must have at least one target configured by init. Release tags must exist in that harness's public GitHub releases and be in ascending semantic-version order. Published prerelease tags are accepted as explicit `--from` or `--to` values; draft releases are excluded. SemVer prerelease precedence is used when ordering tags.

Examples:

```sh
node bin/ahrasx.js assess --harness pi --from v0.87.0 --to v0.99.1
node bin/ahrasx.js assess --harness pi --from v0.87.0 --to latest
node bin/ahrasx.js assess --harness opencode --from v1.18.20 --to v1.18.33
node bin/ahrasx.js assess --harness codex --from rust-v0.159.0 --to rust-v0.159.2
node bin/ahrasx.js assess --harness codex --from rust-v0.159.0 --to rust-v0.161.0-alpha.4
```

Use latest only as the `--to` value. It resolves to the highest stable release supported by the selected harness; it never selects a prerelease. The report records the resolved concrete tag so the assessment remains reproducible. Use the exact upstream tag spelling, including `rust-v`for Codex CLI.

For each assessment, `AHRASX` validates the arguments and configuration, loads public release metadata, fetches the upstream comparison diff, detects changes to the harness's declared surfaces, obtains each target's current default-branch revision, scans supported source files, and writes reports under `reports/` in the current working directory. It does not change the target repositories. Existing `AHRASX` target cache clones are refreshed and reused under `.ahrasx/cache/`.

Assessment exits successfully when it can produce a report, including when an individual target is `inconclusive`. The summary reports counts for `confirmed_match`, `no_match`, and `inconclusive`. An acquisition or scanning failure for one target is recorded as `inconclusive` while other target results are retained. An invalid harness, missing arguments, invalid release range, missing configuration, or inability to produce a report returns a nonzero exit code.

### Refine

```sh
node bin/ahrasx.js refine
```

The command is reserved, but no model provider is installed in `v0.1.0`, so it prints an explanatory error and exits nonzero. The deterministic assessment report remains available through assess. Refinement must not be treated as part of canonical evidence in this version.

## Configuration and generated files

All project data is relative to the directory where the command is run:

- `.ahrasx/config.json` stores harness-scoped target repository URLs.
- `.ahrasx/cache/` stores reusable Git clones used to inspect target repositories.
- `reports/assessment-<timestamp>.json` stores the canonical machine-readable assessment.
- `reports/assessment-<timestamp>.md` renders the same assessment for reading.

Keep the JSON report with any follow-up review. It includes the command with resolved tags, harness and release metadata, upstream changed-surface evidence, target revisions and findings, deterministic triage, limitations, generation time, and a `SHA-256` digest. Markdown is a presentation of this evidence; JSON is authoritative.

## Reading assessment reports

- `confirmed_match` means target source contains a configured surface that changed upstream. It is a review signal, not proof of breakage.
- `no_match` means no changed declared surface matched scanned target source. It does not prove full compatibility.
- `inconclusive` means AHRASX could not complete acquisition or scanning for that target; inspect the sanitized error in JSON.
- Potential breaking changes are direct target matches associated with removed upstream lines. Review the target usage against the linked upstream evidence before upgrading.
- Review recommended identifies direct matches when the upstream evidence shows additions.
- Watchouts identify changed upstream surfaces without a deterministic target scanner and need manual review.
- Triage priority is `high` or `normal`; urgency is `before_next_upgrade` in v0.1.0. These labels guide review and do not imply a confirmed runtime failure.

The report records finding IDs, matcher IDs, paths, line numbers, target revisions, and matched text to help locate relevant code. Inspect the surrounding code and run the target project's own compatibility tests before deciding whether to update it.

## Troubleshooting

### Expected a public GitHub repository URL
- enter an exact HTTPS repository URL with only owner and repository path; omit credentials, branch paths, query strings, and fragments.

### No configured targets
- run init from the same working directory and select the harness being assessed.

### Requested release tag was not found
- verify the exact release tag spelling and that it is a published GitHub release, not a draft or an untagged source commit.

### Start release must be before end release
- swap the endpoints or choose an ascending range according to semantic-version ordering.

### `latest` errors
- latest is valid only as `--to latest`, and resolves only to a stable release.

### Prerelease tag errors
- provide the exact published prerelease tag, including its harness-specific prefix where applicable.

### `inconclusive` target
- confirm the public repository is reachable, Git is installed, and network access is available; then rerun and inspect the report's error field.

### No findings
- this can mean no declared integration surface changed or that no target source matched the changed surface. It is not a runtime compatibility guarantee.

### Reports or configuration not appearing where expected 
- run the command from the intended project directory; all paths are relative to the current working directory.

## Development commands

```sh
npm test
npm run check
```

`npm test` runs the Node.js test suite. `npm run check` performs JavaScript syntax checks and runs the same suite.

## Deferred work

Scheduled release polling, persistent last-assessed versions, notification delivery, private-repository authentication, and provider-backed refinement are not included in version 0.1.0. AHRASX currently provides the deterministic assessment command that a future release-watching automation can call.
