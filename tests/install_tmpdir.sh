#!/bin/bash
set -Eeuo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fixture_root="$HOME/.cache/codex-desktop-dev"
mkdir -p "$fixture_root"
fixture="$(mktemp -d "$fixture_root/tmpdir-test.XXXXXX")"
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1])" "$fixture"' EXIT

check_case() {
    local inherited="$1" cache="$2" expected="$3"
    HOME="$fixture/home" XDG_CACHE_HOME="$cache" TMPDIR="$inherited" \
        CODEX_INSTALLER_SOURCE_ONLY=1 bash -eu -c '
        source "$1/install.sh"
        [[ "$TMPDIR" == "$2" ]]
        [[ "$WORK_DIR" == "$TMPDIR/"* && -d "$WORK_DIR" ]]
        [[ "$(printenv TMPDIR)" == "$TMPDIR" ]]
        printf "%s" "$WORK_DIR" > "$3"
    ' bash "$REPO_DIR" "$expected" "$fixture/work-path"
    [[ ! -e "$(cat "$fixture/work-path")" ]]
}
check_case '' "$fixture/cache" "$fixture/cache/codex-desktop-dev/tmp"
check_case "$fixture/cache:-$fixture/cache/tmp" "$fixture/cache" "$fixture/cache/codex-desktop-dev/tmp"
check_case relative "$fixture/cache" "$fixture/cache/codex-desktop-dev/tmp"
check_case '' '' "$fixture/home/.cache/codex-desktop-dev/tmp"
check_case '' "$fixture/cache:-broken" "$fixture/home/.cache/codex-desktop-dev/tmp"
check_case '' relative "$fixture/home/.cache/codex-desktop-dev/tmp"
check_case "$fixture/custom tmp" "$fixture/cache" "$fixture/custom tmp"
echo '[tmpdir] defaults, invalid paths, explicit override, inheritance and cleanup passed'
