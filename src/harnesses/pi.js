export default Object.freeze({
  id: "pi",
  displayName: "Pi",
  upstream: "https://github.com/earendil-works/pi",
  releasePolicy: { stableSemver: true },
  surfaceMatchers: [
    { id: "pi-extension-api", kind: "api", paths: ["packages/coding-agent/src/"], token: "ExtensionAPI", targetToken: "ExtensionAPI" },
    { id: "pi-lifecycle-hook", kind: "hook", paths: ["packages/coding-agent/src/"], token: "before_provider_request", targetToken: "before_provider_request" },
    { id: "pi-extension-context", kind: "api", paths: ["packages/coding-agent/src/"], token: /\bExtension(?:Tool)?Context\b/, targetToken: /\bExtension(?:Tool)?Context\b/ },
    { id: "pi-extension-config", kind: "config", paths: ["packages/coding-agent/src/"], token: "--no-extensions", targetToken: null },
  ],
});
