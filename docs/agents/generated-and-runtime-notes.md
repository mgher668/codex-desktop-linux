# Generated and runtime notes

Do not edit or commit generated application/package state:

- `codex-app/`, `codex-app-next/`, `.codex-app.candidate-*`
- `codex-*-app/`, `dist/`, `dist-next/`, `target/`
- `linux-features/features.json`, `linux-features/local/`
- staged feature manifests and build/patch reports
- updater config/state/cache/log directories under XDG paths

The baseline staged tree is extracted from `/usr/lib/chatgpt` in the verified
official package. Its runtime, native modules, commands, libraries, locales, and
Owl metadata remain upstream-owned. `start.sh` and `.codex-linux/` are generated
from repository templates and feature manifests.

With no ASAR features, compare the staged and package `resources/app.asar`
SHA-256 values. Any difference is a build bug. With features, consult the patch
report and staged feature manifest.

Updater candidates are siblings of the active tree and are promoted atomically.
Do not manually rename an active/candidate pair or delete its recovery journal.
