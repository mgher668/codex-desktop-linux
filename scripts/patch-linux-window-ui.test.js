#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  corePatchDescriptors,
  featurePatchDescriptors,
  patchExtractedApp,
} = require("./patches/runner.js");
const { createPatchReport } = require("./lib/patch-report.js");

test("official Linux baseline has an empty core patch registry", () => {
  assert.deepEqual(corePatchDescriptors(), []);
  assert.equal(featurePatchDescriptors({
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  }).length, 0);
});

test("empty registry leaves an extracted official-style app unchanged", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-empty-patch-registry-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const buildDir = path.join(root, ".vite", "build");
  const webviewDir = path.join(root, "webview", "assets");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(webviewDir, { recursive: true });
  const mainPath = path.join(buildDir, "main-fixture.js");
  const assetPath = path.join(webviewDir, "app-initial-fixture.js");
  fs.writeFileSync(mainPath, "const officialMain=true;\n");
  fs.writeFileSync(assetPath, "const officialWebview=true;\n");
  const before = new Map([
    [mainPath, fs.readFileSync(mainPath)],
    [assetPath, fs.readFileSync(assetPath)],
  ]);
  const report = createPatchReport();
  patchExtractedApp(root, {
    report,
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  });
  assert.deepEqual(report.patches, []);
  for (const [filePath, bytes] of before) assert.deepEqual(fs.readFileSync(filePath), bytes);
});
