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

In the desktop menu, the custom build is **ChatGPT Community** with a blue `C`;
the unqualified **ChatGPT** entry is OpenAI's package.

## Browser or Chrome plugin is visible but cannot connect

The first Community launch after migrating from the legacy pre-official build
refreshes cached Browser and Chrome plugins only when their bundled manifests
match the official Linux plugins and they contain a known retired Linux-port
marker. This one-time migration replaces the old custom Chrome extension host
and fixes the old `/tmp/codex-browser-use-<uid>` discovery path; the official
Linux runtime uses `/tmp/codex-browser-use`. It also removes legacy group-write
permission from the private `.plugin-appserver` runtime directory, which the
Chrome host rejects as an untrusted parent path.

If Browser was already loaded before that migration ran, fully exit every
ChatGPT process, fully exit Chrome/Chromium, start **ChatGPT Community**, and
then reopen the browser. Arbitrary plugin caches and user-authored plugins are
never rewritten.

If the legacy snapshot predates the recognized migration markers, remove only
the two re-creatable upstream-bundled caches, then restart Community followed
by Chrome:

```bash
pkill -TERM -x ChatGPT 2>/dev/null || true
rm -rf -- \
  "${CODEX_HOME:-$HOME/.codex}/plugins/cache/openai-bundled/browser" \
  "${CODEX_HOME:-$HOME/.codex}/plugins/cache/openai-bundled/chrome"
chmod go-w "${CODEX_HOME:-$HOME/.codex}/plugins/.plugin-appserver" 2>/dev/null || true
```

Do not delete the whole `plugins` directory: it may contain user plugins and
unrelated cached integrations.

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

## Old app backup cannot be removed

`codex-app.backup-*` directories are generated transactional backups, not
source files or additional installed applications. A backup created by an old
root-run build may be owned by root. Current builds collapse that cleanup
failure to one warning and continue with the accepted candidate.

Inspect the exact stale directories before changing or deleting anything:

```bash
find "$PWD" -maxdepth 1 -type d -name 'codex-app.backup-*' -print
```

For a confirmed stale path, replace `/absolute/path/to/backup` below with one
exact path printed above:

```bash
sudo chown -R -- "$(id -u):$(id -g)" /absolute/path/to/backup
rm -rf -- /absolute/path/to/backup
```

Never run the cleanup against the repository root, `codex-app/`, the active
updater rollback artifact, `$HOME`, or a wildcard you have not inspected.
