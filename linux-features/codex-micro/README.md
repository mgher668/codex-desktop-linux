# Codex Micro

This opt-in Linux feature enables the Work Louder Codex Micro integration that
already ships in the upstream Codex desktop app. It does two narrowly scoped
things:

1. enables the upstream Codex Micro feature gate locally; and
2. adds the verified `node-hid@3.3.0` Linux prebuild for the current app's
   nested Work Louder dependency.

The feature is disabled by default.

## Enable

Copy `linux-features/features.example.json` to the gitignored
`linux-features/features.json`, then add `codex-micro` to `enabled` and rebuild:

```json
{
  "enabled": [
    "codex-micro"
  ]
}
```

```bash
./install.sh
```

The feature rejects the build if the current DMG no longer contains the
expected Codex Micro gate/route or the exact nested `node-hid` loader contract.
Only the pinned x64 and arm64 prebuilds are supported; there is no source-build
fallback.

## Runtime libraries

Native packages declare the required `libudev.so.1` and `libusb-1.0.so.0`
dependencies. For AppImage, source, or user-local installs, install them
yourself:

```bash
# Debian / Ubuntu
sudo apt install libudev1 libusb-1.0-0

# Fedora
sudo dnf install systemd-libs libusb1

# Arch Linux
sudo pacman -S systemd-libs libusb
```

## Device access

Feature-enabled Debian, RPM, and pacman packages install
`/usr/lib/udev/rules.d/70-codex-micro.rules`. Reload the rules after the first
install, then reconnect USB or Bluetooth:

```bash
sudo udevadm control --reload-rules
```

AppImage, source, Home Manager, and direct flake installs cannot change host
udev policy. Install the tracked rule once:

```bash
sudo install -Dm0644 \
  linux-features/codex-micro/resources/70-codex-micro.rules \
  /etc/udev/rules.d/70-codex-micro.rules
sudo udevadm control --reload-rules
```

The USB rule imports `usb_id` before matching the observed Work Louder
VID/PID/interface (`303a:8360`, interface `00`). The Bluetooth rule matches the
same vendor HID channel on the Bluetooth HID bus. Both rules use `uaccess` and
`0660`; they do not make hidraw devices world-writable.

NixOS installs the rule automatically when the feature is selected through the
module. Home Manager and direct flake users must use the manual rule procedure
above.

## Bluetooth

Pair the Micro through the desktop Bluetooth settings before opening Codex.
Channel selection and pairing mode are device operations; see the Work Louder
Micro setup guide.

## Verify

With the Micro connected, identify its hidraw node and exercise the actual rule:

```bash
udevadm info --attribute-walk --name=/dev/hidrawN
sudo udevadm test "$(udevadm info --query=path --name=/dev/hidrawN)"
getfacl /dev/hidrawN
```

The test output must show the Codex Micro rule, imported USB properties for a
USB connection, the `uaccess` tag, and mode `0660`. Then open
`Settings -> Codex Micro` and verify connection state, buttons, dial, joystick,
battery/status reporting, and lighting controls.

Run focused checks with:

```bash
node --test linux-features/codex-micro/test.js
node --test scripts/lib/linux-features.test.js
```
