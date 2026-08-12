#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadLinuxFeaturePatchDescriptors } = require("../../scripts/lib/linux-features.js");
const {
  applyFramelessTitlebarMainPatch,
  applyFramelessTitlebarWebviewPatch,
} = require("./patch.js");

test("frameless-titlebar is disabled by default and exposes standalone descriptors", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "frameless-titlebar-"));
  try {
    const config = path.join(temp, "features.json");
    fs.writeFileSync(config, '{"enabled":[]}\n');
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: path.join(__dirname, ".."), featuresConfigPath: config }), []);
    fs.writeFileSync(config, '{"enabled":["frameless-titlebar"]}\n');
    const descriptors = loadLinuxFeaturePatchDescriptors({ featuresRoot: path.join(__dirname, ".."), featuresConfigPath: config });
    assert.deepEqual(descriptors.map(({ id }) => id), [
      "feature:frameless-titlebar:main-process",
      "feature:frameless-titlebar:webview-window-controls-layout",
    ]);
    assert.ok(descriptors.every(({ composesPatches }) => composesPatches == null));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("main patch removes Linux overlay ownership and is idempotent", () => {
  const source = [
    "case`quickChat`:case`primary`:return n===`darwin`?{}:n===`win32`||n===`linux`?{titleBarStyle:`hidden`,titleBarOverlay:n===`linux`?codexLinuxTitleBarOverlay(r):j9(r),...e===`quickChat`?{resizable:!0}:{}}:{};",
    "setWindowZoom(e,t){let n=c.BrowserWindow.fromWebContents(e),r=n&&this.windowAppearances.get(n.id);(process.platform===`win32`||process.platform===`linux`)&&(this.windowZooms.set(n.id,t),n.setTitleBarOverlay(process.platform===`linux`?codexLinuxTitleBarOverlay(t):j9(t)))}",
    "installApplicationMenuTitleBarOverlaySync(e,t){if(process.platform!==`win32`&&process.platform!==`linux`||t!==`primary`&&t!==`quickChat`)return;let n=()=>{e.isDestroyed()||e.setTitleBarOverlay(process.platform===`linux`?codexLinuxTitleBarOverlay(this.windowZooms.get(e.id)):j9(this.windowZooms.get(e.id)))};return c.nativeTheme.on(`updated`,n),n(),()=>{c.nativeTheme.off(`updated`,n)}}",
  ].join("");
  const patched = applyFramelessTitlebarMainPatch(source);
  assert.notEqual(patched, source);
  assert.equal(applyFramelessTitlebarMainPatch(patched), patched);
  assert.match(patched, /n===`linux`\?\{titleBarStyle:`hidden`/);
  assert.doesNotMatch(patched, /n===`linux`\?\{titleBarStyle:`hidden`,titleBarOverlay/);
});

test("webview patch removes Linux application-menu insets and is idempotent", () => {
  const source = "applicationMenu:Object.freeze({left:0,right:138});case`win32`:case`linux`:return`application-menu`;a.includes(`win`)||b.includes(`windows`)||a.includes(`linux`)?c??d.applicationMenu:d.default";
  const patched = applyFramelessTitlebarWebviewPatch(source);
  assert.equal(applyFramelessTitlebarWebviewPatch(patched), patched);
  assert.match(patched, /right:0/);
  assert.match(patched, /case`linux`:return`native`/);
  assert.doesNotMatch(patched, /includes\(`linux`\)\?/);
});
