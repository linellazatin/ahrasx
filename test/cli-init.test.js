import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { loadConfig } from "../src/config.js";
import { runCli } from "../src/cli.js";

function outputBuffer() {
  let value = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        value += chunk.toString();
        callback();
      },
    }),
    text: () => value,
  };
}

async function temporaryCwd(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ahrasx-cli-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  return cwd;
}

test("init writes selected harness targets and reports canonical URLs", async (t) => {
  const cwd = await temporaryCwd(t);
  const output = outputBuffer();

  const exitCode = await runCli(["init"], {
    cwd,
    input: Readable.from([
      "pi\nhttps://github.com/linellazatin/nanomneme\nhttps://github.com/linellazatin/opl-pi-sht\n\n",
    ]),
    output: output.stream,
    error: output.stream,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(await loadConfig(cwd), {
    schemaVersion: 1,
    harnesses: {
      pi: {
        targets: [
          "https://github.com/linellazatin/nanomneme",
          "https://github.com/linellazatin/opl-pi-sht",
        ],
      },
    },
  });
  assert.match(output.text(), /Configured pi/);
  assert.match(output.text(), /https:\/\/github\.com\/linellazatin\/nanomneme/);
});

test("init retries after an invalid target URL", async (t) => {
  const cwd = await temporaryCwd(t);
  const output = outputBuffer();

  const exitCode = await runCli(["init"], {
    cwd,
    input: Readable.from(["codex\nnot-a-url\nhttps://github.com/openai/codex\n\n"]),
    output: output.stream,
    error: output.stream,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual((await loadConfig(cwd)).harnesses.codex.targets, [
    "https://github.com/openai/codex",
  ]);
  assert.match(output.text(), /Expected a public GitHub repository URL/);
});
