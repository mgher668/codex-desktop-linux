# Update manager

`codex-update-manager` is an optional Rust component in native packages. It
updates the custom distribution without transferring ownership to the official
`chatgpt` package.

## Release discovery

The service verifies OpenAI's signed stable `InRelease`, the digest of the
architecture-specific `Packages` file, and the selected package SHA-256. An
unchanged version/architecture/SHA tuple is a no-op. Downloads are cached as:

```text
<version>-<architecture>-<sha256>.deb
```

Signature, index, package hash, metadata, or payload failures never replace the
working app.

## Rebuild

The packaged update-builder extracts the official payload, applies only the
locally enabled features, generates the selected package format, and places the
result beside the active install. It contains its own minimal Node/ASAR build
tools but does not install them in the application runtime.

Enabled feature drift rejects the candidate. Disabled features are neither
loaded nor probed. Native helper binaries belong to the project release package
and are not rebuilt for each upstream refresh.

## Promotion and rollback

Building may proceed while ChatGPT is running. Promotion does not: the updater
waits for process exit, then performs the same atomic candidate exchange used by
manual rebuilds. A durable journal recovers interrupted promotion, and the
immediately previous managed package remains the rollback target.

Automated user-local operations cannot override the running-app guard or
silently accept unverified input. A failed privileged installation remains
failed until an explicit retry or a newer candidate.

Legacy schema state is treated as an incompatible pending candidate and reset;
the installed package and recorded rollback artifact are preserved.

## Commands

```bash
codex-update-manager status
codex-update-manager check-now
codex-update-manager build-update
codex-update-manager install-ready
codex-update-manager retry-install
codex-update-manager rollback
```

The service is controlled with:

```bash
systemctl --user enable --now codex-update-manager.service
journalctl --user -u codex-update-manager.service
```

Update interaction is exposed through the service, CLI, desktop actions, and
notification actions. The upstream ASAR is not patched to add an update button.

## Validation scenarios

Tests cover new and unchanged releases, interrupted downloads, all trust
failures, build-while-running, promotion-after-exit, rollback, cleanup, and old
state migration. Run:

```bash
cargo test -p codex-update-manager
cargo clippy -p codex-update-manager --all-targets -- -D warnings
```
