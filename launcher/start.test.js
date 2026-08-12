"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const templatePath = path.join(__dirname, "start.sh.template");

function writeExecutable(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, { mode: 0o755 });
}

function createApp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launcher-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const launcher = fs.readFileSync(templatePath, "utf8")
    .replaceAll("__CODEX_LINUX_APP_ID__", "codex-desktop")
    .replaceAll("__CODEX_LINUX_APP_DISPLAY_NAME__", "ChatGPT");
  writeExecutable(path.join(root, "start.sh"), launcher);
  for (const relative of ["resources/app.asar", "resources/codex", "resources/rg", "resources/codex-code-mode-host"]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "fixture", { mode: relative === "resources/app.asar" ? 0o644 : 0o755 });
  }
  writeExecutable(path.join(root, "ChatGPT"), `#!/bin/bash
printf '%s\n' "$CHROME_DESKTOP" "$BAMF_DESKTOP_FILE_HINT" "$HOOK_ENV" "$LAUNCHER_ENV" > "$TEST_ROOT/environment"
printf '%s\n' "$@" > "$TEST_ROOT/arguments"
exit 7
`);
  return root;
}

test("launcher composes declarative hooks and forwards arguments", (t) => {
  const root = createApp(t);
  const hooks = path.join(root, ".codex-linux");
  fs.mkdirSync(path.join(hooks, "env.d"), { recursive: true });
  fs.writeFileSync(path.join(hooks, "env.d", "fixture.env"), "HOOK_ENV=from-env\n");
  fs.mkdirSync(path.join(hooks, "electron-args.d"), { recursive: true });
  fs.writeFileSync(path.join(hooks, "electron-args.d", "fixture.args"), "# comment\n--feature-arg=one two\n");
  writeExecutable(path.join(hooks, "prelaunch.d", "fixture.sh"), "#!/bin/bash\nprintf prelaunch > \"$TEST_ROOT/prelaunch\"\n");
  writeExecutable(path.join(hooks, "launcher.d", "fixture.sh"), "#!/bin/bash\nprintf '%s\\n' 'env LAUNCHER_ENV=from-launcher' 'electron-arg --launcher-arg=value'\n");
  writeExecutable(path.join(hooks, "after-exit.d", "fixture.sh"), "#!/bin/bash\nprintf after-exit > \"$TEST_ROOT/after-exit\"\n");

  const result = childProcess.spawnSync(path.join(root, "start.sh"), ["codex://thread/123", "--new-window"], {
    env: { ...process.env, TEST_ROOT: root }, encoding: "utf8",
  });
  assert.equal(result.status, 7);
  assert.deepEqual(fs.readFileSync(path.join(root, "environment"), "utf8").trim().split("\n"), [
    "codex-desktop.desktop",
    "/usr/share/applications/codex-desktop.desktop",
    "from-env",
    "from-launcher",
  ]);
  assert.deepEqual(fs.readFileSync(path.join(root, "arguments"), "utf8").trim().split("\n"), [
    "--feature-arg=one two",
    "--launcher-arg=value",
    "codex://thread/123",
    "--new-window",
  ]);
  assert.equal(fs.readFileSync(path.join(root, "prelaunch"), "utf8"), "prelaunch");
  assert.equal(fs.readFileSync(path.join(root, "after-exit"), "utf8"), "after-exit");
});

test("diagnose validates the official runtime without starting it", (t) => {
  const root = createApp(t);
  const result = childProcess.spawnSync(path.join(root, "start.sh"), ["--diagnose"], {
    env: { ...process.env, TEST_ROOT: root }, encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /ok: .*\/ChatGPT/);
  assert.equal(fs.existsSync(path.join(root, "arguments")), false);
});
