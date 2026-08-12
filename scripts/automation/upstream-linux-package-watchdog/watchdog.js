#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  resolveOfficialPackage,
} = require("../../lib/upstream-linux-package.js");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const PINS_PATH = path.join(REPO_ROOT, "nix/upstream-linux-packages.json");

function sha256Sri(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("invalid SHA256");
  return `sha256-${Buffer.from(hex, "hex").toString("base64")}`;
}

function pinsFromMetadata(entries) {
  const versions = new Set(entries.map((entry) => entry.version));
  if (versions.size !== 1) throw new Error("amd64 and arm64 stable versions differ");
  const pins = { version: entries[0].version };
  for (const entry of entries) {
    pins[entry.architecture] = {
      repositoryPath: entry.repositoryPath,
      sha256: entry.sha256,
      sri: sha256Sri(entry.sha256),
    };
  }
  return pins;
}

async function probe(repository) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-linux-package-watchdog-"));
  try {
    const entries = [];
    for (const architecture of ["amd64", "arm64"]) {
      const outputDir = path.join(root, architecture);
      entries.push(await resolveOfficialPackage({
        architecture,
        repository,
        outputDir,
        metadataPath: path.join(outputDir, "metadata.json"),
        keyBase64Path: path.join(REPO_ROOT, "assets/openai-codex-linux-repository-key.gpg.base64"),
        metadataOnly: true,
      }));
    }
    return pinsFromMetadata(entries);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const repository = process.env.CODEX_UPSTREAM_LINUX_REPOSITORY
    ?? "https://persistent.oaistatic.com/codex-app-prod/linux/deb";
  const current = JSON.parse(fs.readFileSync(PINS_PATH, "utf8"));
  const latest = await probe(repository);
  const changed = JSON.stringify(current) !== JSON.stringify(latest);
  if (args.has("--write")) {
    fs.writeFileSync(PINS_PATH, `${JSON.stringify(latest, null, 2)}\n`);
  }
  const result = { changed, current, latest, wrote: args.has("--write") };
  if (args.has("--json")) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${changed ? "changed" : "unchanged"}: ${latest.version}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { pinsFromMetadata, sha256Sri };
