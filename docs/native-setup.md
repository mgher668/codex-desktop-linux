# Native setup

The guided path configures optional features and installs the correct custom
package format for the current Linux distribution:

```bash
make setup-native
make bootstrap-native
```

`bootstrap-native` installs build dependencies, resolves the current official
package through signed metadata, stages `codex-app/`, builds deb/RPM/pacman as
appropriate, and installs `codex-desktop`.

For a noninteractive clean install:

```bash
bash scripts/install-deps.sh
make install-native
```

For an offline/reproducible source package input:

```bash
UPSTREAM_DEB=/absolute/path/chatgpt_<version>_<arch>.deb make install-native
```

Optional features are selected in the gitignored
`linux-features/features.json`. The wizard never enables a feature implicitly.
Review each feature README, required system services, and cleanup behavior.

`codex-desktop` can coexist with official `chatgpt`, but both retain the same
upstream user profile. Exit one before starting the other.

Useful checks:

```bash
codex-desktop --diagnose
systemctl --user status codex-update-manager.service
```
