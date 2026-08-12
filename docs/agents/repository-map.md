# Repository map

| Area | Source of truth |
|---|---|
| Signed upstream | `scripts/lib/upstream-linux-package.js`, `.sh`, pinned key under `assets/` |
| Build orchestration | `install.sh`, `scripts/lib/install-helpers.sh`, `build-info.*` |
| Launcher | `launcher/start.sh.template` |
| ASAR engine | `scripts/patches/`, `scripts/patch-linux-window-ui.js`, `patch-report.js` |
| Linux features | `linux-features/<id>/feature.json`, adjacent README/resources/hooks |
| Shared packaging | `scripts/lib/package-common.sh` |
| Package formats | `scripts/build-deb.sh`, `build-rpm.sh`, `build-pacman.sh`, `build-appimage.sh` |
| Native runtime hooks | `packaging/linux/` |
| AppImage runtime | `packaging/appimage/` |
| Updater | `updater/src/`, `packaging/update-builder/` |
| Release watchdog | `scripts/automation/upstream-linux-package-watchdog/` |
| Nix | `flake.nix`, `nix/upstream-linux-packages.json`, `nix/*.nix` |
| CI | `.github/workflows/`, `scripts/ci/`, `scripts/ci-local.sh` |
| Computer Use | `computer-use-linux/` and retained feature descriptors |

The official Linux package supplies the complete application runtime and
bundled commands. There is no repository-owned runtime replacement layer.
The packaged desktop entry is **ChatGPT Community**; `codex-desktop` remains
the package, executable, and installation-path identity.

Generated output includes `codex-app/`, `codex-app.backup-*`, candidates,
`dist/`, `dist-next/`, and `target/`. Fix their source owners and regenerate.
