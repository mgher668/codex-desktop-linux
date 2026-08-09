#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const patcher = path.join(__dirname, "patch-chrome-plugin.js");

test("patches current Chrome skill and profile resolvers idempotently", () => {
  const pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-chrome-plugin-current-"));
  const scriptsDir = path.join(pluginDir, "scripts");
  const skillDir = path.join(pluginDir, "skills", "control-chrome");
  const profileScript = `function resolveChromeProfileDirectory(userDataDirectory) {
  const localStateProfile =
    resolveChromeProfileDirectoryFromLocalState(userDataDirectory);
  if (localStateProfile) return localStateProfile;

  return findLatestChromeProfile(userDataDirectory);
}

function resolveChromeProfileDirectoryFromLocalState(userDataDirectory) {
  return null;
}
`;

  try {
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "Do not inspect browser cookies, local storage, profiles, passwords, or session stores. Browser discovery must remain read-only.\n",
      "utf8",
    );
    for (const scriptName of ["check-extension-installed.js", "open-chrome-window.js"]) {
      fs.writeFileSync(path.join(scriptsDir, scriptName), profileScript, "utf8");
    }

    const firstResult = spawnSync(process.execPath, [patcher, pluginDir], {
      encoding: "utf8",
    });
    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(firstResult.stderr, "");

    const firstSources = new Map();
    const skillPath = path.join(skillDir, "SKILL.md");
    const patchedSkill = fs.readFileSync(skillPath, "utf8");
    assert.match(patchedSkill, /browser\.tabs\.new\(\)/);
    assert.match(patchedSkill, /start a different Chrome, Brave, or Chromium profile/);
    firstSources.set(skillPath, patchedSkill);

    for (const scriptName of ["check-extension-installed.js", "open-chrome-window.js"]) {
      const scriptPath = path.join(scriptsDir, scriptName);
      const source = fs.readFileSync(scriptPath, "utf8");
      assert.match(source, /resolveChromeProfileDirectoryFromRunningProcess/);
      assert.equal(source.match(/function linuxProcessDirectories/g)?.length, 1);
      firstSources.set(scriptPath, source);
    }

    const secondResult = spawnSync(process.execPath, [patcher, pluginDir], {
      encoding: "utf8",
    });
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(secondResult.stderr, "");
    assert.match(secondResult.stdout, /SKILL\.md already patched: Chrome profile launch guard/);
    assert.match(secondResult.stdout, /check-extension-installed\.js already patched:/);
    assert.match(secondResult.stdout, /open-chrome-window\.js already patched:/);
    for (const [filePath, firstSource] of firstSources) {
      assert.equal(fs.readFileSync(filePath, "utf8"), firstSource);
    }
  } finally {
    fs.rmSync(pluginDir, { recursive: true, force: true });
  }
});
