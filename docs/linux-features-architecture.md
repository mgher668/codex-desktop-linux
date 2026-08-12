# Linux features architecture

`linux-features/` is the only extension boundary for optional integrations.
Repository features live in `linux-features/<id>/`; private local features live
in the gitignored `linux-features/local/<id>/`. Every feature requires adjacent
`feature.json` and `README.md` files.

Features are always disabled by default. Enable them only in the gitignored
configuration:

```json
{
  "enabled": ["read-aloud"],
  "settings": {
    "read-aloud": { "example": "value" }
  }
}
```

Known retired IDs are discarded during config loading. Other unknown IDs,
duplicate IDs, malformed settings, default-enabled manifests, unmet
requirements, and conflicts are errors.

## Manifest

```json
{
  "id": "my-feature",
  "title": "My Feature",
  "description": "Optional Linux integration.",
  "defaultEnabled": false,
  "entrypoints": {
    "patchDescriptors": "./patch.js",
    "stageHook": "./stage.sh"
  },
  "resources": [],
  "runtimeHooks": {},
  "packageResources": [],
  "packageDependencies": {},
  "packageHooks": [],
  "requires": [],
  "conflicts": []
}
```

Use `stageHook` only when the operation cannot be represented declaratively.
Feature patching supports only `entrypoints.patchDescriptors`; removed legacy
entrypoint aliases are rejected.

## Lifecycle

1. The installer validates enabled manifests and relationships.
2. If any enabled feature has ASAR descriptors, a temporary ASAR copy is
   extracted, patched, deterministically repacked, and reported. Otherwise ASAR
   is never opened.
3. Declarative app resources and launcher hooks are staged.
4. Remaining legacy stage hooks run.
5. Native package resources/dependencies/hooks are applied to package staging.
6. The launcher loads env, prelaunch, Electron-argument, launcher, cold-start,
   and after-exit hooks.

The enabled feature snapshot is recorded in build metadata and must match at
package time. The update-builder includes only enabled descriptors/resources
and repeats the same validation. Drift in an enabled feature rejects the
candidate; disabled features are not probed.

## ASAR descriptors

Descriptor modules export an array or `{ descriptors: [] }`. IDs are reported
as `feature:<feature-id>:<descriptor-id>`. Supported phases are
`main-bundle`, `extracted-app:pre-webview`, `webview-asset`, and
`extracted-app:post-webview`. Descriptors must be idempotent and fail softly
unless the feature deliberately declares a required acceptance surface.

The baseline core registry is empty, so features must be self-contained and
must not compose with deleted core IDs. A generic core extension point may be
added only when unavoidable and must remain feature-agnostic.

## Declarative app resources

```json
{
  "resources": [{
    "source": "assets/tool.json",
    "target": ".codex-linux/features/my-feature/tool.json",
    "mode": "0644"
  }]
}
```

Sources stay inside the feature. Targets stay inside the app and cannot be the
app root. Modes are quoted octal strings. Staged files are tracked so disabling
a feature removes framework-owned files on the next rebuild.

## Runtime hooks

```json
{
  "runtimeHooks": {
    "env": "env",
    "prelaunch": "prelaunch.sh",
    "electronArgs": "electron-args",
    "launcher": "launcher.sh",
    "coldStart": "cold-start.sh",
    "afterExit": "after-exit.sh"
  }
}
```

- `env`: sourced as environment assignments.
- `prelaunch`: synchronous executable before runtime start.
- `electronArgs`: one argument per non-comment line.
- `launcher`: may emit `env KEY=VALUE` or `electron-arg VALUE`.
- `coldStart`: background hook at launch.
- `afterExit`: requires the wrapper to wait, then runs after process exit.

Hooks receive the original launcher arguments and feature/app directory
environment. Keep them bounded; the compact launcher does not supervise helper
processes or provide a second application lifecycle.

## Native package extensions

`packageResources` place feature-owned files outside the app directory;
`packageDependencies` map runtime dependencies for deb/RPM/pacman; package hooks
perform the remaining narrowly scoped staging work. Targets must stay inside
the package root and cannot overlap the packaged app tree. Special permission
bits are rejected.

Native Rust helpers are built once as project release components. They must not
be rebuilt merely because a new official application package appeared. Delete
an orphan helper crate when its last feature consumer is removed.

## Design rule

The official Linux application is the baseline. A default core patch is allowed
only for a reproduced mandatory launch/work failure with a regression test.
Everything optional, distro/editor/browser/workflow-specific, experimental, or
minority-use belongs here and stays disabled by default.
