# Build and packaging

## Prerequisites

Baseline builds require Bash, curl, `gpgv`, `dpkg-deb`, Node.js 20+, npm,
Python 3, SHA-256 utilities, tar, make, and a C/C++ toolchain. Rust is needed
for updater/native helper release builds. Install common dependencies with:

```bash
bash scripts/install-deps.sh
```

## Build the application tree

Resolve and verify the latest signed stable package for the host architecture:

```bash
./install.sh
```

This is a Linux `.deb`-only source pipeline. Retired source inputs and
compatibility variables are rejected rather than emulated; the official
Electron runtime and native modules are preserved directly.

Use an explicit already-downloaded package that you trust:

```bash
./install.sh /path/to/chatgpt_<version>_<arch>.deb
UPSTREAM_DEB=/path/to/chatgpt_<version>_<arch>.deb make build-app
```

The explicit package is validated for package name, version, architecture, and
required payload, and its SHA-256 is recorded in build metadata. Supplying a
local file deliberately skips signed repository discovery, so the caller is
responsible for its provenance. Source package formats from the retired build
architecture are rejected with a clear error and have no compatibility
fallback.

Inspection writes reports without promoting an app:

```bash
make inspect-upstream
```

Generated metadata under `.codex-linux/build-info.json` uses schema v2 and
records `upstreamLinuxPackage` version, architecture, repository path, and
SHA-256.

## Baseline ASAR invariant

`linux-features/features.example.json` contains no enabled features. For that
configuration, the installer copies `resources/app.asar` directly and compares
its SHA-256 with the package payload. No ASAR extraction tool runs.

If a selected feature contains patch descriptors, the installer patches a
temporary extraction, repacks deterministically, and writes a feature-aware
patch report. An enabled feature drift blocks candidate acceptance.

## Package formats

First build `codex-app/`, then choose an output:

```bash
make deb
make rpm
make pacman
make appimage
```

For an installed native build, `make setup-native` is only the optional-feature
wizard, `make install-native` performs build/package/install, and
`make bootstrap-native` first installs build dependencies and then performs the
same installation flow.

Shared payload logic lives in `scripts/lib/package-common.sh`. Native packages
install to `/opt/codex-desktop`, provide `/usr/bin/codex-desktop`, install a
separate **ChatGPT Community** desktop entry and community-marked icon, and may
include the updater service/update-builder.
Their dependency declarations correspond to libraries required by the official
ELF runtime. They do not install OpenAI's repository configuration.

The deb package uses the upstream dependency baseline. RPM and pacman templates
map those library capabilities to their distribution names. Native packages
adapt the upstream AppArmor policy to `/opt/codex-desktop/ChatGPT`.

AppImage uses the official bundled `codex` and does not add `--no-sandbox`.
Systems that prohibit unprivileged user namespaces receive a diagnostic instead
of an insecure automatic fallback.

## Update-builder payload

`packaging/update-builder/` contains only source verification/extraction,
feature selection/descriptors/resources, the ASAR toolchain, package templates,
required build helpers, and already staged release executables for enabled
native features. It excludes the full repository, Cargo workspaces, and
disabled features, and never contains an app-runtime Node installation.

## Cross-format validation

Payload, launcher, updater, feature framework, or package-common changes affect
all formats unless explicitly scoped. Run:

```bash
bash tests/scripts_smoke.sh
./scripts/ci-local.sh pr
./scripts/ci-local.sh all
```

Inspect the final packages for the `ChatGPT` ELF, byte identity of clean
`app.asar`, bundled commands, desktop files, AppArmor policy, update-builder,
and absence of upstream package-manager configuration.
