# Official Linux package migration

This file is the durable execution record for the migration from the macOS
DMG port to OpenAI's signed Linux packages. Update it in the same commit as
each completed milestone. A checked item must have evidence in the **Tests**
column and the commit SHA must be filled after the commit is created (the SHA
may be backfilled by the next milestone commit).

## Invariants

- [x] Migration branch: `codex/migrate-to-official-linux-package`
- [ ] Only signed stable OpenAI APT metadata is trusted for unattended builds.
- [ ] Only `amd64` and `arm64` are supported.
- [ ] A clean build preserves upstream `resources/app.asar` byte-for-byte.
- [ ] The output remains `codex-desktop` under `/opt/codex-desktop` and does not
  install the upstream APT source, key, or maintainer scripts.
- [ ] All optional features are disabled in committed configuration.
- [ ] Known retired feature IDs are ignored; arbitrary unknown IDs fail.
- [ ] Active sources outside CHANGELOG/migration history contain no DMG,
  Sparkle, macOS extraction, Electron download, or native rebuild paths.

## Milestones

| # | Milestone | Status | Tests / evidence | Commit SHA |
|---|---|---|---|---|
| 0 | Branch and exhaustive tracking record | complete | clean `main` at `4da3436f`; 86-ID official-ASAR probe and 34 manifests inventoried | `ea59dbc9` |
| 1 | Signed Linux-package source and extraction pipeline | complete | source-security tests; local official-package build; ASAR SHA equality | `33e2c03d` |
| 2 | Compact launcher and cross-format package payload | complete | launcher tests; amd64 deb/RPM builds; pacman/AppImage stage inspection | pending commit |
| 3 | Core patch retirement and feature retargeting | pending | one-feature builds; retired/unknown-ID tests | — |
| 4 | Signed-package updater and state migration | pending | updater release/download/promotion/rollback suite | — |
| 5 | Nix and signed-package CI/watchdog | pending | Nix evaluation; both architecture workflows | — |
| 6 | Documentation and final repository cleanup | pending | `ci-local.sh all`; forbidden-reference scan; diff audit | — |

## Build, package, updater, CI, and documentation checklist

### Upstream and build

- [x] Map host architecture to `amd64`/`arm64` and reject all others.
- [x] Verify `InRelease` with the pinned Codex Linux Repository key and
  fingerprint `3BFA0E4AE8B8CC16A2D9BA684A3B4A566C4660E4`.
- [x] Verify `Packages` size/SHA256 from `InRelease`.
- [x] Resolve and verify the indexed `chatgpt_<version>_<arch>.deb`.
- [x] Validate control name/version/architecture and mandatory Linux payload.
- [x] Extract data only; never run upstream maintainer scripts.
- [x] Support `./install.sh [path/to/chatgpt_*.deb]` and reject DMG inputs/env.
- [x] Stage `/usr/lib/chatgpt` directly, including native modules, `codex`, `rg`,
  code-mode host, locales, libraries, and Owl metadata.
- [x] Skip ASAR extraction/repack when no ASAR feature is enabled.
- [x] Emit build-info schema v2 `upstreamLinuxPackage` metadata.
- [ ] Remove DMG extraction, Electron download, native rebuild, managed runtime,
  webview server, external CLI repair, and duplicate bundled-resource staging.

### Launcher and packages

- [x] Replace the generated launcher with a compact official-runtime wrapper.
- [x] Keep declarative env/prelaunch/electronArgs/launcher/coldStart/afterExit hooks.
- [x] Pass URI/CLI arguments through unchanged; wait only for after-exit hooks.
- [x] Remove custom single-instance/warm-start/webview/process supervision.
- [x] Preserve `codex-desktop` identity and `/opt/codex-desktop` layout.
- [x] Retarget AppArmor to `/opt/codex-desktop/ChatGPT` for system packages.
- [x] Do not automatically add `--no-sandbox` to AppImage.
- [x] Align dependency mappings for deb/RPM/pacman and inspect every payload.

### Updater

- [ ] Poll signed APT metadata instead of a DMG HEAD request.
- [ ] Cache by version/architecture/SHA256.
- [ ] Rebuild by extraction plus enabled feature application only.
- [ ] Keep Node/ASAR tooling in update-builder, not the app runtime.
- [ ] Preserve candidate promotion, running-app guard, rollback, and cleanup.
- [ ] Reset incompatible pending DMG state without losing installed/rollback data.
- [ ] Remove DMG parser/cache compatibility after migration.

### Nix, CI, and watchdog

- [ ] Nix fetches architecture-specific official `.deb` hashes and wraps ELF deps.
- [ ] Remove DMG, Electron, and `nix/native-modules` inputs.
- [ ] Replace both DMG watchdogs with one signed-package watchdog.
- [ ] Replace `update-codex-hash.yml` with official `.deb` pin refresh.
- [ ] Convert upstream-build workflow to signed APT metadata and both arches.

### Documentation

- [ ] Rewrite README, architecture, build/package, native setup, updater, Nix,
  troubleshooting, feature architecture, validation playbook, and `AGENTS.md`.
- [ ] Explain official `chatgpt` versus custom `codex-desktop` coexistence.
- [ ] Explain shared `Codex` profile and concurrent-launch restriction.
- [ ] Document feature retirement and zero default ASAR patches.
- [ ] Retain DMG history only in CHANGELOG and this migration record.

## Core patch audit (official 26.803.81509 baseline)

Source links for every row: [descriptors](../../scripts/patches/core/README.md),
[implementations](../../scripts/patches/impl/), and
[tests](../../scripts/patch-linux-window-ui.test.js). Replace these directory
links with the exact retained feature descriptor/test when code is moved.

| Patch ID | Official baseline | Final action | Status / evidence |
|---|---|---|---|
| `linux-quit-guard` | upstream-applied | delete | pending |
| `linux-explicit-quit-prompt-bypass` | applies | delete port lifecycle code | pending |
| `linux-explicit-quit-drain-timeout` | applies | delete port lifecycle code | pending |
| `linux-explicit-tray-quit` | applies | delete port lifecycle code | pending |
| `linux-explicit-ipc-quit` | applies | delete port lifecycle code | pending |
| `linux-window-options` | applies | delete port window code | pending |
| `linux-managed-window-system-context-menu` | applies | delete port window code | pending |
| `linux-menu` | applies | delete port menu code | pending |
| `linux-application-menu` | upstream-applied | delete | pending |
| `linux-app-reload-shortcuts` | applies | delete port menu code | pending |
| `linux-set-icon` | applies | delete port window code | pending |
| `linux-ready-to-show-window-state` | applies | delete port window code | pending |
| `linux-resize-repaint` | applies | delete port window code | pending |
| `linux-opaque-background` | applies | delete port window code | pending |
| `linux-x11-project-picker` | applies | delete port window code | pending |
| `linux-native-titlebar` | applies | delete; feature owns customization | pending |
| `linux-avatar-overlay-mouse-passthrough` | applies | delete port window code | pending |
| `linux-file-manager` | upstream-applied | delete | pending |
| `linux-terminal-host-environment` | applies | delete port shell code | pending |
| `linux-terminal-user-path` | applies | delete port shell code | pending |
| `linux-tray` | applies | delete port lifecycle code | pending |
| `linux-build-info-tray` | applies | delete port lifecycle code | pending |
| `linux-single-instance` | upstream-applied | delete | pending |
| `linux-computer-use-avatar-cursor` | applies | move to `computer-use-linux` | pending |
| `linux-computer-use-ui-feature` | disabled | move to `computer-use-linux` | pending |
| `linux-computer-use-plugin-gate` | applies | move to `computer-use-linux` | pending |
| `linux-chrome-plugin-auto-install` | applies | delete old browser port glue | pending |
| `linux-computer-use-native-desktop-apps` | disabled | move to `computer-use-linux` | pending |
| `linux-bundled-plugin-reconcile-stale-snapshot` | applies | delete old browser port glue | pending |
| `linux-bundled-plugin-copy-permissions` | applies | delete old browser port glue | pending |
| `linux-browser-use-socket-directory` | applies | delete old browser port glue | pending |
| `linux-browser-use-route-liveness` | applies | delete old browser port glue | pending |
| `linux-local-app-server-feature-enablement-handler` | applies | delete generic upstream fix | pending |
| `linux-remote-control-config-preservation` | upstream-applied | delete | pending |
| `linux-app-updater-menu` | applies | delete; updater uses actions/CLI | pending |
| `linux-notification-actions` | applies | validate; optional feature only if needed | pending |
| `linux-settings-persistence` | applies | delete generic upstream fix | pending |
| `linux-launch-actions` | applies | delete port lifecycle code | pending |
| `linux-hotkey-window-prewarm` | applies | delete port lifecycle code | pending |
| `linux-git-origins-source-fallback` | applies | delete generic upstream fix | pending |
| `linux-xdg-documents-dir` | applies | delete port shell code | pending |
| `linux-external-open-env` | applies | delete port shell code | pending |
| `main-process-ui` | applies | delete port UI aggregate | pending |
| `linux-host-child-process-environment` | applies | delete port shell code | pending |
| `linux-worker-file-manager` | upstream-applied | delete | pending |
| `linux-multi-instance-bootstrap-lock` | applies | delete upstream lifecycle workaround | pending |
| `linux-bootstrap-failure-exit` | applies | delete upstream lifecycle workaround | pending |
| `browser-use-node-repl-approval` | applies | delete old browser port glue | pending |
| `linux-chrome-native-host-runtime` | applies | delete old browser port glue | pending |
| `linux-owl-feature-binding-fallback` | upstream-applied | delete | pending |
| `automation-schedule-multi-time-rrule` | applies | move to `automation-extensions` | pending |
| `linux-projectless-xdg-documents-dir` | applies | delete port shell code | pending |
| `linux-app-sunset-gate` | upstream-applied | delete | pending |
| `opaque-window-default-general-settings` | applies | delete; feature owns customization | pending |
| `opaque-window-default-webview-index` | upstream-applied | delete | pending |
| `linux-app-server-feature-enablement` | upstream-applied | delete | pending |
| `linux-fast-mode-model-guard` | upstream-applied | delete | pending |
| `linux-window-controls-safe-area` | applies | delete; feature owns customization | pending |
| `linux-app-server-backfill-wait` | upstream-applied | delete | pending |
| `linux-i18n-gate` | applies | delete generic upstream fix | pending |
| `linux-skills-list-dedupe` | upstream-applied | delete | pending |
| `linux-settings-search-visibility` | applies | delete generic upstream fix | pending |
| `automation-update-eager-tool` | applies | move to `automation-extensions` | pending |
| `linux-config-write-version-conflict` | applies | delete generic upstream fix | pending |
| `linux-sidebar-scroll-performance` | applies | move to `linux-performance-workarounds` | pending |
| `linux-app-shell-tab-layout-performance` | applies | move to `linux-performance-workarounds` | pending |
| `linux-markdown-animation-performance` | applies | move to `linux-performance-workarounds` | pending |
| `composer-persistent-rate-limit-footer` | upstream-applied | delete | pending |
| `subagent-nickname-metadata-shape` | applies | delete generic upstream fix | pending |
| `linux-tooltip-window-controls-collision` | applies | delete; feature owns customization | pending |
| `local-environment-action-modal-draft` | applies | delete generic upstream fix | pending |
| `linux-thread-side-panel-native-tooltip` | upstream-applied | delete | pending |
| `linux-browser-use-availability` | applies | delete old browser port glue | pending |
| `linux-browser-use-non-local-navigation` | upstream-applied | delete | pending |
| `linux-chat-search-hydration` | upstream-applied | delete | pending |
| `linux-browser-use-webview-attach-recovery-store` | applies | delete old browser port glue | pending |
| `linux-browser-use-webview-attach-recovery-host` | applies | delete old browser port glue | pending |
| `linux-computer-use-ui-availability` | disabled | move to `computer-use-linux` | pending |
| `linux-computer-use-host-platform` | disabled | move to `computer-use-linux` | pending |
| `linux-computer-use-install-flow` | disabled | move to `computer-use-linux` | pending |
| `linux-browser-use-external-availability` | applies | delete old browser port glue | pending |
| `linux-app-updater-bridge` | applies | delete; updater uses actions/CLI | pending |
| `browser-annotation-screenshot` | applies | delete generic upstream fix | pending |
| `keybinds-settings` | applies | delete port fallback | pending |
| `package-desktop-name` | applies | delete port identity rewrite | pending |
| `linux-workspace-root-open-targets` | applies | delete port open-target rewrite | pending |

## Linux feature audit

Manifest links are relative to `linux-features/<id>/feature.json`; every retained
or new feature must also keep its adjacent README and feature-local tests.

| Feature ID | Decision | Status / evidence |
|---|---|---|
| `agent-workspace` | retain and retarget | pending |
| `api-key-model-visibility` | retain and retarget | pending |
| `api-key-service-tier` | retain and retarget | pending |
| `appshots` | retain and retarget | pending |
| `authenticated-proxy` | retain and retarget | pending |
| `codex-micro` | simplify; remove node-hid/native rebuild | pending |
| `codex-wrapper-updater` | retire | pending |
| `conversation-delete` | retain and retarget | pending |
| `conversation-mode` | retain and retarget | pending |
| `copilot-reasoning-effort` | retain and retarget | pending |
| `deferred-update-build` | retire | pending |
| `directory-only-working-tree-watch` | audit on official runtime | pending |
| `example-feature` | retire | pending |
| `frameless-titlebar` | retain; remove core composition | pending |
| `global-dictation` | retain and retarget | pending |
| `mcp-helper-reaper` | audit on official runtime | pending |
| `node-repl-reaper` | audit on official runtime | pending |
| `omarchy-theme` | retain and retarget | pending |
| `open-target-discovery` | retire | pending |
| `persistent-status-panel` | retain and retarget | pending |
| `pet-overlay` | audit on X11 and Wayland | pending |
| `project-group-last-updated-sort` | retain and retarget | pending |
| `project-task-sort` | retain and retarget | pending |
| `read-aloud` | retain and retarget | pending |
| `read-aloud-mcp` | retain and retarget | pending |
| `record-and-replay` | retain and retarget | pending |
| `remote-control-ui` | audit official pairing/reconnect/storage | pending |
| `remote-mobile-control` | audit official mobile recovery | pending |
| `shallow-repository-watches` | audit Parcel watcher | pending |
| `shared-app-server-socket` | retain and retarget | pending |
| `ssh-command-wrapper` | retain and retarget | pending |
| `thorium-chrome-plugin` | retain and retarget | pending |
| `ui-tweaks` | retain; use official icons/metadata | pending |
| `x11-ewmh-computer-use` | retain and retarget | pending |

### New disabled-by-default feature destinations

- [ ] `computer-use-linux`: seven UI/plugin/cursor/native-app descriptors and
  only the staging required by a verified consumer.
- [ ] `notification-actions`: only if clean official notification action tests fail.
- [ ] `linux-performance-workarounds`: sidebar, tab layout, Markdown animation.
- [ ] `automation-extensions`: multi-time RRULE and eager `automation_update`.

## Validation log

| Date | Scope | Command / environment | Result | Commit |
|---|---|---|---|---|
| 2026-08-12 | Baseline inventory | official 26.803.81509 ASAR patch probe | 17 upstream-applied, 64 applied, 5 disabled; 86 total | pre-migration |
| 2026-08-12 | Source security | `node --test scripts/lib/upstream-linux-package.test.js` | 4/4 pass: valid/tampered/wrong-key signature, release/package hashes and metadata | pending commit |
| 2026-08-12 | Clean baseline | local official `chatgpt_26.803.81509_amd64.deb` with empty feature config | upstream/output ASAR SHA `87a32f5d…ff9ff66`; launcher diagnose passes; schema v2 emitted | pending commit |
| 2026-08-12 | Launcher | `node --test launcher/start.test.js` | 2/2 pass: hook composition, exact argument forwarding, diagnose | pending commit |
| 2026-08-12 | Package payload | updater-disabled amd64 builders | deb and RPM built/inspected; AppImage and pacman staged/inspected; official `codex` retained, duplicate CLI absent, AppArmor path correct | pending commit |
