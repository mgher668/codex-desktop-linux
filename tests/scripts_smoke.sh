#!/bin/bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

fail() { echo "[smoke][ERROR] $*" >&2; exit 1; }
assert_file() { [ -f "$1" ] || fail "missing file: $1"; }
assert_executable() { [ -x "$1" ] || fail "not executable: $1"; }
assert_contains() { rg -q -- "$2" "$1" || fail "$1 does not contain $2"; }
assert_absent() { ! rg -q -- "$2" "$1" || fail "$1 unexpectedly contains $2"; }

assert_executable install.sh
assert_executable scripts/rebuild-candidate.sh
assert_executable scripts/ci/update-nix-hashes.sh
assert_executable scripts/ci/validate-nix-pins.sh
assert_file assets/openai-codex-linux-repository-key.gpg.base64
assert_file nix/upstream-linux-packages.json

bash -n install.sh launcher/start.sh.template scripts/rebuild-candidate.sh
bash -n scripts/lib/*.sh scripts/build-deb.sh scripts/build-rpm.sh scripts/build-pacman.sh scripts/build-appimage.sh

assert_contains install.sh 'upstream-linux-package.sh'
assert_contains install.sh 'CODEX_TARGET_ARCH'
assert_absent install.sh 'scripts/lib/dmg.sh'
assert_contains launcher/start.sh.template '/ChatGPT'
assert_absent launcher/start.sh.template 'webview-server'
assert_absent launcher/start.sh.template 'cli-preflight'
assert_contains packaging/linux/control 'official Linux runtime'
assert_contains packaging/linux/codex-desktop.spec 'official runtime'
assert_contains packaging/linux/codex-packaged-runtime.sh 'codex-update-manager check-now'
assert_absent packaging/linux/codex-packaged-runtime.sh '--if-stale'

if find scripts/patches/core -name patch.js -print -quit | grep -q .; then
    fail "official baseline core registry must remain empty"
fi

node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = "linux-features";
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "local") continue;
  const feature = path.join(root, entry.name, "feature.json");
  if (!fs.existsSync(feature)) continue;
  const manifest = JSON.parse(fs.readFileSync(feature, "utf8"));
  if (!fs.existsSync(path.join(root, entry.name, "README.md"))) {
    throw new Error(`${manifest.id} has no README`);
  }
}
const pins = JSON.parse(fs.readFileSync("nix/upstream-linux-packages.json", "utf8"));
for (const architecture of ["amd64", "arm64"]) {
  if (!pins[architecture].repositoryPath.endsWith(`_${architecture}.deb`)) {
    throw new Error(`bad ${architecture} pin`);
  }
}
NODE

node --test launcher/start.test.js scripts/lib/upstream-linux-package.test.js \
  scripts/automation/upstream-linux-package-watchdog/test.js \
  scripts/patch-linux-window-ui.test.js scripts/lib/linux-features.test.js

echo "[smoke] official Linux-package source, launcher, feature registry, packages, and pins are coherent"
