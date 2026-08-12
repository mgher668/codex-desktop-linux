# Nix

The flake downloads the official architecture-specific Linux package pinned in
`nix/upstream-linux-packages.json`, verifies its hash through Nix, extracts the
ELF payload, and wraps it with the required Nix libraries.

```bash
nix run github:ilysenko/codex-desktop-linux
nix build .#codex-desktop
```

Supported systems are `x86_64-linux` and `aarch64-linux`. The flake maps these
to upstream `amd64` and `arm64` packages. It does not replace Electron or build
upstream native modules.

## Features

Use the NixOS or Home Manager module and pass explicit feature IDs. Defaults are
empty. Feature resources and required retained helper crates are staged by the
Nix derivation; helpers are release-built as Nix inputs, not during an update.

```nix
programs.codex-desktop = {
  enable = true;
  linuxFeatures = [ "read-aloud" ];
};
```

## Updating pins

Pins are updated from signed OpenAI APT metadata:

```bash
scripts/ci/update-official-linux-pins.sh
```

The automation checks both architectures. Do not hand-invent or bypass hashes.
Validate changes with:

```bash
nix flake check
nix build .#codex-desktop
```

Nix outputs keep the custom desktop identity and shared upstream `Codex` user
profile. Do not run the Nix and official applications concurrently.
