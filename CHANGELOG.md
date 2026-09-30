# Changelog

## 0.1.0 - initial

### Added

- Validated public GitHub configuration and interactive `init` for harness-scoped target repositories.
- Added a modular registry for Pi, OpenCode, and Codex, with harness-specific changed-surface matchers.
- Added Pi extension matching with explicit API, context, and discovery-configuration surfaces.
- Added OpenCode plugin and event matching with public plugin-contract matchers scoped to `.opencode/plugins/` target source.
- Added Codex notification matching with scoped plugin MCP, plugin-hook, and `SessionStart` contract surfaces.
- Added public release lookup, stable and published-prerelease SemVer ranges, Codex `rust-v` tags, stable-only `--to latest`, upstream comparison diffs, and isolated Git acquisition for target repositories.
- Added `assess` reporting in canonical JSON and Markdown, including command provenance, resolved release tags and target revisions, upstream evidence, findings, and deterministic triage. Partial target failures remain in the report.
- Added optional refinement validation that requires the canonical report digest and known finding IDs; no model provider is installed in v0.1.0.
- Added global and command-specific `--help`, `--version` and `-v`, and the complete README operational manual.
- Reused and refreshed target cache clones, resolved default-branch revisions, and assigned globally unique finding IDs across multiple targets.
- Excluded documentation and test fixtures from target source scans, preserved matcher IDs, and restricted configuration matchers to declared target paths.
- Bounded oversized upstream evidence and retained truncation metadata.
