# ChatGPT Community for Linux

`codex-desktop` is a custom, multi-format distribution of OpenAI's official
Linux ChatGPT desktop application. It verifies and repackages the signed
official Linux payload, adds an optional-feature framework, and provides native
packages, AppImage, Nix, and transactional updates.

The custom build appears in application menus as **ChatGPT Community** and uses
an icon marked with a blue `C`, while its package and executable identity remain
`codex-desktop`.

OpenAI's signed Linux `.deb` is the only upstream source. The official Electron
runtime and native modules are reused directly rather than reconstructed.

The project preserves the complete upstream runtime instead of reconstructing
the application. With no optional
ASAR features enabled, the official `resources/app.asar` is copied byte-for-byte.

## Quick start

```bash
git clone https://github.com/ilysenko/codex-desktop-linux.git
cd codex-desktop-linux
bash scripts/install-deps.sh
make install-native
```

To choose optional features interactively before installing, run
`make setup-native`, then `make install-native`. To install dependencies, build,
package, and install in one command, use `make bootstrap-native`.
`make install-native` builds the release helpers required by the enabled local
features before consuming the official package; updater rebuilds reuse those
packaged binaries and never run Cargo.

`install.sh` resolves the current `amd64` or `arm64` package through OpenAI's
signed stable APT metadata. To build from an already downloaded package that
you trust:

```bash
UPSTREAM_DEB=/path/to/chatgpt_<version>_<arch>.deb make build-app
```

The verifier checks the pinned repository-key fingerprint, the signed index,
the architecture-specific `Packages` digest, package metadata, package digest,
and required Linux payload. It extracts only the data archive and never runs
the upstream package scripts. An explicitly supplied local `.deb` is checked
for package shape and its SHA-256 is recorded, but its provenance is the
caller's responsibility because repository discovery is intentionally skipped.

## Outputs

```bash
make deb
make rpm
make pacman
make appimage
nix build .#codex-desktop
```

All native outputs install as `codex-desktop` under `/opt/codex-desktop` and do
not register OpenAI's APT source. They can be installed beside the official
`chatgpt` package. Both applications intentionally retain the upstream `Codex`
profile for data compatibility, so do not run them at the same time: upstream's
single-instance lock decides which process receives a second launch.

The official runtime already includes `codex`, `rg`, code-mode host, native
modules, libraries, locales, desktop assets, and Owl metadata. AppImage uses
the bundled CLI and does not silently disable Chromium sandboxing. Native
packages install an AppArmor policy adapted to the custom executable path.

## Optional Linux features

All features are disabled by default. Use the wizard:

```bash
make setup-native
make install-native
```

For manual configuration, copy `linux-features/features.example.json` to the
gitignored `linux-features/features.json`, edit the enabled IDs, and run
`make install-native`.

Enabled features may stage resources, set environment variables, add launcher
hooks, package helpers, or patch a temporary ASAR copy. A feature patch drift
rejects an update candidate; disabled features are not probed. Known retired
IDs are ignored for smooth config migration, while unknown IDs remain errors.

The baseline core patch registry is empty. Platform fixes are added to core
only when the current official package cannot pass mandatory launch/work tests;
all extensions remain opt-in.

See [Linux features](docs/linux-features-architecture.md) and the README beside
each feature descriptor.

The first Community launch after upgrading from the former Linux port also
repairs only the known legacy Browser and Chrome bundled-plugin caches. If a
browser integration was already loaded, fully exit every ChatGPT process and
restart ChatGPT Community. See [troubleshooting](docs/troubleshooting.md).

## Updates

Native packages can include `codex-update-manager`, a user service that polls
the same signed metadata, caches packages by version/architecture/SHA-256,
rebuilds only the enabled features, and promotes the candidate after the app
exits. Installation and rollback are transactional. The app itself receives no
ASAR update button.

```bash
codex-update-manager status
codex-update-manager check-now
codex-update-manager install-ready
codex-update-manager rollback
```

## Development

```bash
bash tests/scripts_smoke.sh
node --test scripts/lib/upstream-linux-package.test.js
node --test scripts/patch-linux-window-ui.test.js scripts/lib/linux-features.test.js linux-features/*/test.js
cargo test -p codex-update-manager
./scripts/ci-local.sh all
```

Generated `codex-app/`, candidates, `dist/`, and `target/` are not source files.
Read [architecture](docs/architecture.md), [build and packaging](docs/build-and-packaging.md),
[updater](docs/updater.md), [Nix](docs/nix.md), and
[troubleshooting](docs/troubleshooting.md) before changing their owners.

This project is community-maintained and is not an OpenAI product.
