# Troubleshooting

## Source verification fails

Run the verifier test suite and inspect the generated metadata:

```bash
node --test scripts/lib/upstream-linux-package.test.js
./install.sh --inspect --report-dir /tmp/codex-inspect
```

Do not bypass a signature or hash failure. Confirm system time, HTTPS access to
`persistent.oaistatic.com`, `gpgv`, the pinned key fingerprint, and sufficient
disk space. An explicit package must match host architecture and be named
`chatgpt` in control metadata.

## The app does not launch

```bash
/opt/codex-desktop/start.sh --diagnose
/opt/codex-desktop/ChatGPT --version
journalctl --user -u codex-update-manager.service --no-pager
```

The diagnostic checks the official executable, ASAR, bundled `codex`, `rg`, and
code-mode host. It also warns when Chromium sandbox prerequisites are missing.

## Chromium sandbox or AppArmor

Prefer a native package, which installs an AppArmor profile adapted to
`/opt/codex-desktop/ChatGPT`. AppImage intentionally refuses to disable the
sandbox automatically. Enable unprivileged user namespaces according to your
distribution policy or use the native package.

## Official and custom apps interfere

Both use the upstream `Codex` profile. Fully exit the official `chatgpt` process
before starting `codex-desktop`, and vice versa. Their packages and desktop
entries can coexist, but upstream single-instance locking prevents reliable
parallel sessions.

## A feature build fails after an upstream release

Disable the feature in `linux-features/features.json` and rebuild to confirm the
official baseline. Enabled feature drift deliberately blocks candidate
promotion. Report the feature ID, package version/architecture, and patch report.

Known retired feature IDs are ignored. A misspelled or arbitrary unknown ID is
an error; correct the config rather than adding a compatibility alias.

## Updater is waiting

```bash
codex-update-manager status
systemctl --user status codex-update-manager.service
```

`WaitingForAppExit` is expected: close all ChatGPT/Codex desktop processes. For
a failed privileged install, use the explicit retry command after fixing the
reported package-manager issue. Roll back with `codex-update-manager rollback`.

## Clean rebuild

Generated state may be removed and rebuilt:

```bash
make clean-dist
make build-app
make package
```

Do not delete the updater rollback artifact unless you intentionally give up
the recovery path.
