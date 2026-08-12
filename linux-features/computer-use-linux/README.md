# Linux Computer Use

Disabled-by-default Linux Computer Use integration. It owns the seven ASAR
descriptors that used to be unconditional core port glue and stages the native
MCP plugin only when explicitly enabled.

The upstream-package rebuild does not compile Rust. Release/package jobs must
provide prebuilt `codex-computer-use-linux` and `codex-computer-use-cosmic`
binaries in `target/release/` or set `CODEX_COMPUTER_USE_BINARY_SOURCE` and
`CODEX_COMPUTER_USE_COSMIC_BINARY_SOURCE`.
