#!/bin/bash
set -Eeuo pipefail

REPO_DIR=/work
CI_JOB="${1:-${CI_JOB:-}}"
PACKAGE_VERSION="${CI_PACKAGE_VERSION:-2026.08.12.000000+local}"

die() { echo "[ci:${CI_JOB}][ERROR] $*" >&2; exit 1; }

install_apt() {
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        bash ca-certificates curl dpkg-dev g++ gcc git gnupg make nodejs npm \
        pkg-config python3 rpm rpm2cpio sudo tar unzip util-linux xz-utils
}

install_fedora() {
    dnf install -y bash ca-certificates curl dpkg gcc gcc-c++ git gnupg2 make \
        nodejs npm python3 rpm-build tar unzip util-linux xz
}

install_arch() {
    pacman -Syu --noconfirm --needed base-devel ca-certificates curl dpkg git \
        gnupg nodejs npm python rustup sudo unzip util-linux xz zstd
}

prepare() {
    case "$CI_JOB" in
        rpm) install_fedora ;;
        pacman) install_arch ;;
        nix) return 0 ;;
        *) install_apt ;;
    esac
}

build_clean_app() {
    export CODEX_LINUX_FEATURES_CONFIG="$REPO_DIR/linux-features/features.example.json"
    "$REPO_DIR/install.sh"
}

run_core() {
    bash tests/scripts_smoke.sh
    node --test scripts/patch-linux-window-ui.test.js scripts/lib/linux-features.test.js linux-features/*/test.js
    if command -v cargo >/dev/null 2>&1; then
        cargo test -p codex-update-manager
    fi
}

run_package() {
    build_clean_app
    export PACKAGE_VERSION PACKAGE_WITH_UPDATER=0
    case "$CI_JOB" in
        deb) ./scripts/build-deb.sh ;;
        rpm) ./scripts/build-rpm.sh ;;
        pacman) ./scripts/build-pacman.sh ;;
    esac
}

run_upstream() {
    node scripts/automation/upstream-linux-package-watchdog/watchdog.js --json
    build_clean_app
    ./codex-app/start.sh --diagnose
}

run_install_deps() {
    bash scripts/install-deps.sh
    output="$(./install.sh /tmp/retired-source.dmg 2>&1)" && status=0 || status=$?
    test "$status" -ne 0
    grep -q "macOS DMG inputs are no longer supported" <<<"$output"
}

run_nix() {
    export NIX_CONFIG="${NIX_CONFIG:-experimental-features = nix-command flakes}"
    nix flake check --no-write-lock-file --option sandbox false
    nix build .#codex-desktop --no-link --option sandbox false
}

[ -n "$CI_JOB" ] || die "missing job"
cd "$REPO_DIR"
prepare
case "$CI_JOB" in
    core) run_core ;;
    deb|rpm|pacman) run_package ;;
    upstream) run_upstream ;;
    install-deps) run_install_deps ;;
    nix) run_nix ;;
    *) die "unsupported job" ;;
esac
