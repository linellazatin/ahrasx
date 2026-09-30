export default Object.freeze({
  id: "opencode",
  displayName: "OpenCode",
  upstream: "https://github.com/anomalyco/opencode",
  releasePolicy: { stableSemver: true },
  surfaceMatchers: [
    { id: "opencode-plugin-input-client", kind: "api", paths: ["packages/plugin/src/index.ts"], token: "client:", targetToken: /\binput(?:\s*&&)?\s*\.\s*client\b/, targetPaths: [".opencode/plugins/"] },
    { id: "opencode-plugin-factory", kind: "api", paths: ["packages/plugin/src/index.ts"], token: "export type Plugin =", targetToken: /\bexport\s+default\s+async\s*\(\s*input\b/, targetPaths: [".opencode/plugins/"] },
    { id: "opencode-plugin-tool", kind: "api", paths: ["packages/plugin/src/index.ts"], token: "tool?: {", targetToken: /\btool\s*:/, targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-config", kind: "hook", paths: ["packages/plugin/src/index.ts"], token: "config?:", targetToken: /\bconfig\s*:/, targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-tool-after", kind: "hook", paths: ["packages/plugin/src/index.ts"], token: "tool.execute.after", targetToken: "tool.execute.after", targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-system-transform", kind: "hook", paths: ["packages/plugin/src/index.ts"], token: "experimental.chat.system.transform", targetToken: "experimental.chat.system.transform", targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-session-compacting", kind: "hook", paths: ["packages/plugin/src/index.ts"], token: "experimental.session.compacting", targetToken: "experimental.session.compacting", targetPaths: [".opencode/plugins/"] },
    { id: "opencode-hook-compaction-autocontinue", kind: "hook", paths: ["packages/plugin/src/index.ts"], token: "experimental.compaction.autocontinue", targetToken: "experimental.compaction.autocontinue", targetPaths: [".opencode/plugins/"] },
  ],
});
