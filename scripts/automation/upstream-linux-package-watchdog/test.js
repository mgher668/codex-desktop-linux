"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pinsFromMetadata, sha256Sri } = require("./watchdog.js");

test("watchdog creates architecture pins from a single signed stable version", () => {
  const amdSha = "a".repeat(64);
  const armSha = "b".repeat(64);
  const pins = pinsFromMetadata([
    { version: "26.1", architecture: "amd64", repositoryPath: "pool/amd.deb", sha256: amdSha },
    { version: "26.1", architecture: "arm64", repositoryPath: "pool/arm.deb", sha256: armSha },
  ]);
  assert.equal(pins.version, "26.1");
  assert.equal(pins.amd64.sri, sha256Sri(amdSha));
  assert.equal(pins.arm64.repositoryPath, "pool/arm.deb");
});

test("watchdog rejects a split stable version", () => {
  assert.throws(() => pinsFromMetadata([
    { version: "1", architecture: "amd64", repositoryPath: "a", sha256: "a".repeat(64) },
    { version: "2", architecture: "arm64", repositoryPath: "b", sha256: "b".repeat(64) },
  ]), /versions differ/);
});

test("pin refresh automation polls signed metadata and gates builds on changes", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "../../../.github/workflows/update-official-linux-pins.yml"),
    "utf8",
  );
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.match(workflow, /watchdog\.js --write --json/);
  assert.match(workflow, /if: steps\.pins\.outputs\.changed == 'true'/);
});
