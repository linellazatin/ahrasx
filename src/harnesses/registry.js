import codex from "./codex.js";
import opencode from "./opencode.js";
import pi from "./pi.js";

const harnesses = Object.freeze([pi, opencode, codex]);

export function listHarnesses() {
  return harnesses;
}

export function getHarness(id) {
  return harnesses.find((harness) => harness.id === id) ?? null;
}
