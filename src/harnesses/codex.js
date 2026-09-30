export default Object.freeze({
  id: "codex",
  displayName: "Codex CLI",
  upstream: "https://github.com/openai/codex",
  releasePolicy: { stableSemver: true, tagPrefix: "rust-v" },
  surfaceMatchers: [
    { id: "codex-plugin-mcp-config", kind: "config", paths: ["codex-rs/plugin/"], token: "mcp_servers", targetToken: "mcp_servers", targetPaths: [".codex-plugin/plugin.json"] },
    { id: "codex-plugin-hooks", kind: "config", paths: ["codex-rs/plugin/"], token: "PluginManifestHooks", targetToken: "hooks", targetPaths: [".codex-plugin/plugin.json"] },
    { id: "codex-session-start-hook", kind: "hook", paths: ["codex-rs/app-server-protocol/src/protocol/v2/hook.rs", "codex-rs/plugin/"], token: "SessionStart", targetToken: "SessionStart", targetPaths: ["hooks/hooks.json"] },
  ],
});
