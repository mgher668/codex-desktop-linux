# Native setup

The guided path configures optional features and installs the correct custom
package format for the current Linux distribution:

```bash
make setup-native
make install-native
```

`setup-native` only writes the gitignored optional-feature configuration; it
does not need to run for the default feature-free build.
`install-native` builds any release-mode Rust helpers required by the enabled
features before staging the application. Later signed-package updater rebuilds
reuse those packaged executables and do not invoke Cargo.

`bootstrap-native` installs build dependencies, resolves the current official
package through signed metadata, stages `codex-app/`, builds deb/RPM/pacman as
appropriate, and installs `codex-desktop`.

For a fresh machine, that combined path is:

```bash
make bootstrap-native
```

For a noninteractive clean install:

```bash
bash scripts/install-deps.sh
make install-native
```

For an offline source package input that you already trust:

```bash
UPSTREAM_DEB=/absolute/path/chatgpt_<version>_<arch>.deb make install-native
```

The local package's control metadata, architecture, required payload, and
computed SHA-256 are checked. Because this form skips signed repository
discovery, it does not independently establish the file's provenance.

Optional features are selected in the gitignored
`linux-features/features.json`. The wizard never enables a feature implicitly.
Review each feature README, required system services, and cleanup behavior.

The installed custom application is shown as **ChatGPT Community**, while its
package and command remain `codex-desktop`. It can coexist with official
`chatgpt`, but both retain the same upstream `Codex` user profile. Fully exit
one before starting the other.

Useful checks:

```bash
codex-desktop --diagnose
systemctl --user status codex-update-manager.service
```
