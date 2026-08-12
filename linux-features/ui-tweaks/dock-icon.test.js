#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const { patchUniqueAssetFile } = require("../../scripts/patches/lib/assets.js");
const {
  applyDockIconMainPatch,
  applyDockIconSettingsPatch,
  descriptors,
  dockIconEnabled,
} = require("./patches/dock-icon.js");

const currentAppInfoSource = [
  "function NS(e){return{dark:`icon-codex-dark-color.png`,light:`icon-codex-light.png`}}",
  "function pae(e,t){if(process.platform!==`darwin`||t==null)return null;let n=NS(e),r=PS(`${MS(e,t)}.png`),i=PS(n.dark),a=PS(n.light);return r==null||i==null||a==null?null:{appDefault:r,codexDark:i,codexLight:a}}",
  "function PS(e){if(e==null)return null;let t=l.app.isPackaged?(0,p.join)(process.resourcesPath,e):null,n=t!=null&&(0,_.existsSync)(t)?t:(0,p.join)(l.app.getAppPath(),`src`,`icons`,e),r=l.nativeImage.createFromPath(n);return r.isEmpty()?null:r.resize({width:128,height:128,quality:`best`}).toDataURL()}",
].join("");

const currentRuntimeSource = [
  "function $Te({appBrand:e,buildFlavor:i,settingsStore:f,repoRoot:g,isMacOS:v,onWindowRegistered:C,disposables:w}){",
  "let T=(0,p.join)(g,`electron`,`src`,`icons`),E=e=>{if(!l.app.isPackaged)return null;let t=(0,p.join)(process.resourcesPath,e);return(0,_.existsSync)(t)?t:null},",
  "D=e=>null,O=e=>E(e)??D(e),k=()=>f.get(n.ks.DOCK_ICON_PREFERENCE)??`app-default`,A=()=>O(`${MS(i,e)}.png`),j=process.platform===`linux`?G5(i,e,T):null,M=NS(i),N=()=>l.nativeTheme.shouldUseDarkColorsForSystemIntegratedUI?M.dark:M.light,",
  "P=t=>{if(t===`app-default`&&i!==a.a.Dev&&(l.app.isPackaged||e===n.Sc.ChatGPT)){let e=l.app.dock;e!=null&&Reflect.apply(e.setIcon.bind(e),e,[null]);return}let r=t===`codex-system`?N():null,o=(r==null?null:O(r))??A(),s=o==null?l.nativeImage.createEmpty():l.nativeImage.createFromPath(o);s.isEmpty()||l.app.dock?.setIcon(s)},",
  "F=()=>{if(!v)return;let e=k();P(e),dle({preference:e,resourceName:e===`codex-system`?M.light:null}).then(e=>{e&&P(k())})};",
  "if(v){F();let e=()=>{let e=k();e===`codex-system`&&P(e)};l.nativeTheme.on(`updated`,e),w.add(()=>{l.nativeTheme.off(`updated`,e)})}",
  "let I=null,L=new VTe({onWindowRegistered:e=>{I?.registerWindow(e),C?.(e)}});return{updateDockIcon:F,windowManager:L}}",
].join("");

const currentTraySource =
  "let V9=null,H9=null,W9=!1;async function gEe(e){return H9??V9??(H9=(async()=>{let t=await _Ee(e.buildFlavor,e.appBrand,e.repoRoot),n=new l.Tray(t.defaultIcon,process.platform===`win32`&&l.app.isPackaged?dEe(e.buildFlavor):void 0);if(!W9)return n.destroy(),null;return V9=new Jxe(n)})(),H9)}";

const currentMainSource = currentAppInfoSource + currentRuntimeSource + currentTraySource;
const currentSettingsSource =
  "function oa(){let e=(0,Q.c)(27),t=B(C),n=z(),{platform:r}=_t(),{data:i}=H(Kn),a=V(K.dockIconPreference);if(r!==`macOS`||ke.ChatGPT!==`chatgpt`||sr.Agent===`prod`)return null;let c=i?.dockIconPreviews;if(c==null)return null;return W(c,a)}";

function withFeatureConfig(config, fn) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dock-icon-config-"));
  process.env.CODEX_LINUX_FEATURES_CONFIG = path.join(tempDir, "features.json");
  try {
    fs.writeFileSync(process.env.CODEX_LINUX_FEATURES_CONFIG, JSON.stringify(config));
    return fn();
  } finally {
    if (originalConfig == null) delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    else process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function captureWarns(fn) {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));
  try {
    return { value: fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function dockConfig(enabled) {
  return {
    enabled: ["ui-tweaks"],
    settings: {
      "ui-tweaks": { tweaks: { appearance: { dockIcon: { enabled } } } },
    },
  };
}

function runStage({ enabled = true, officialIcon = "official-icon", desktopMetadata = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dock-icon-stage-"));
  const upstream = path.join(root, "upstream");
  const install = path.join(root, "install");
  const config = path.join(root, "features.json");
  fs.mkdirSync(path.join(upstream, "resources"), { recursive: true });
  fs.mkdirSync(path.join(install, ".codex-linux", "upstream-package"), { recursive: true });
  if (officialIcon != null) {
    fs.writeFileSync(path.join(upstream, "resources", "icon-chatgpt.png"), officialIcon);
  }
  if (desktopMetadata) {
    fs.writeFileSync(
      path.join(install, ".codex-linux", "upstream-package", "chatgpt.desktop"),
      "[Desktop Entry]\nName=ChatGPT\nExec=chatgpt %U\nIcon=chatgpt\n",
    );
  }
  fs.writeFileSync(config, JSON.stringify(dockConfig(enabled)));
  const result = childProcess.spawnSync("bash", [path.join(__dirname, "stage.sh")], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_LINUX_FEATURES_CONFIG: config,
      CODEX_UPSTREAM_APP_DIR: upstream,
      INSTALL_DIR: install,
      SCRIPT_DIR: path.resolve(__dirname, "../.."),
    },
  });
  return { root, upstream, install, result };
}

test("Dock icon descriptors remain disabled until the nested tweak is enabled", () => {
  withFeatureConfig({ enabled: ["ui-tweaks"] }, () => {
    const dockDescriptors = loadLinuxFeaturePatchDescriptors().filter((descriptor) =>
      descriptor.id.includes(":appearance-dock-icon-"),
    );
    assert.equal(dockDescriptors.length, 2);
    assert.equal(dockDescriptors.every((descriptor) => descriptor.enabled({}) === false), true);
  });
  withFeatureConfig(dockConfig(true), () => {
    const dockDescriptors = loadLinuxFeaturePatchDescriptors().filter((descriptor) =>
      descriptor.id.includes(":appearance-dock-icon-"),
    );
    assert.equal(dockDescriptors.length, 2);
    assert.equal(dockDescriptors.every((descriptor) => descriptor.enabled({}) === true), true);
  });
  assert.equal(dockIconEnabled({}), false);
});

test("main patch restores official previews and synchronizes Linux windows and tray", () => {
  const patched = applyDockIconMainPatch(currentMainSource);
  assert.notEqual(patched, currentMainSource);
  assert.match(patched, /function codexLinuxDockIconResourcePath/);
  assert.match(patched, /function codexLinuxApplyDockIcon/);
  assert.match(patched, /BrowserWindow\.getAllWindows\(\)/);
  assert.match(patched, /V9\.tray\.setImage\(s\)/);
  assert.match(patched, /globalThis\.codexLinuxDockIconImage/);
  assert.match(patched, /spawn\(codexLinuxSyncScript/);
  assert.equal(applyDockIconMainPatch(patched), patched);
});

test("main patch rejects drift at every official-package insertion point byte-identically", () => {
  const patched = applyDockIconMainPatch(currentMainSource);
  const currentPoints = [
    "if(process.platform!==`darwin`||t==null)return null",
    "function PS(e){if(e==null)return null;let t=l.app.isPackaged?(0,p.join)(process.resourcesPath,e):null",
    "E=e=>{if(!l.app.isPackaged)return null;let t=(0,p.join)(process.resourcesPath,e);return(0,_.existsSync)(t)?t:null}",
    "P=t=>{if(t===`app-default`",
    "F=()=>{if(!v)return;",
    "if(v){F();let e=()=>",
    "onWindowRegistered:e=>{I?.registerWindow(e),C?.(e)}",
    "n=new l.Tray(t.defaultIcon,process.platform===`win32`",
  ];
  const patchedPoints = [
    "if(process.platform!==`darwin`&&process.platform!==`linux`||t==null)return null",
    "function codexLinuxDockIconResourcePath",
    "E=e=>{if(!l.app.isPackaged&&process.platform!==`linux`)return null",
    "P=function codexLinuxApplyDockIcon",
    "F=()=>{if(!v&&process.platform!==`linux`)return;",
    "if(v||process.platform===`linux`){F();let e=()=>",
    "onWindowRegistered:e=>{I?.registerWindow(e),C?.(e),process.platform===`linux`&&setImmediate(F)}",
    "n=new l.Tray(process.platform===`linux`&&globalThis.codexLinuxDockIconImage",
  ];

  for (const point of currentPoints) {
    const driftedPoint = `${point.slice(0, -1)}DRIFT${point.slice(-1)}`;
    const drifted = currentMainSource.replace(point, driftedPoint);
    const result = captureWarns(() => applyDockIconMainPatch(drifted));
    assert.equal(result.value, drifted, point);
    assert.match(result.warnings.join("\n"), /complete current Dock icon main-process contract/);
  }
  for (const point of patchedPoints) {
    const driftedPoint = `${point.slice(0, -1)}DRIFT${point.slice(-1)}`;
    const drifted = patched.replace(point, driftedPoint);
    const result = captureWarns(() => applyDockIconMainPatch(drifted));
    assert.equal(result.value, drifted, point);
    assert.match(result.warnings.join("\n"), /complete current Dock icon main-process contract/);
  }

  const mixed = currentMainSource.replace(currentPoints[0], patchedPoints[0]);
  assert.equal(captureWarns(() => applyDockIconMainPatch(mixed)).value, mixed);
  const duplicate = currentMainSource + currentMainSource;
  assert.equal(captureWarns(() => applyDockIconMainPatch(duplicate)).value, duplicate);
});

test("settings patch exposes the official row on Linux across minified aliases", () => {
  const patched = applyDockIconSettingsPatch(currentSettingsSource);
  assert.match(
    patched,
    /if\(r!==`macOS`&&r!==`linux`\|\|ke\.ChatGPT!==`chatgpt`\|\|sr\.Agent===`prod`\)return null/,
  );
  assert.equal(applyDockIconSettingsPatch(patched), patched);

  const aliases = currentSettingsSource
    .replace("r!==`macOS`", "platform!==`macOS`")
    .replace("ke.ChatGPT", "brand.ChatGPT")
    .replace("sr.Agent", "flavor.Agent");
  assert.match(applyDockIconSettingsPatch(aliases), /platform!==`linux`/);
});

test("settings drift, duplicates, and mixed contracts remain byte-identical", () => {
  const patched = applyDockIconSettingsPatch(currentSettingsSource);
  for (const source of [
    currentSettingsSource.replace(".dockIconPreviews", ".dockIconPreviewsDrift"),
    currentSettingsSource + currentSettingsSource,
    currentSettingsSource + patched,
  ]) {
    const result = captureWarns(() => applyDockIconSettingsPatch(source));
    assert.equal(result.value, source);
    assert.match(result.warnings.join("\n"), /current Dock icon settings contract/);
  }
});

test("descriptors select only current official-package contracts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dock-icon-assets-"));
  try {
    const assets = path.join(root, "webview", "assets");
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, "general-settings-h4wYKRAT.js"), currentSettingsSource);
    fs.writeFileSync(path.join(assets, "general-settings-CsA3Lt9Z.js"), "old DMG fixture");
    const settingsDescriptor = descriptors.find((descriptor) =>
      descriptor.id.endsWith("settings-row"),
    );
    const result = patchUniqueAssetFile(
      root,
      settingsDescriptor.pattern,
      settingsDescriptor.assetMatch,
      settingsDescriptor.apply,
      settingsDescriptor.missingDescription,
      "ambiguous Dock icon Settings bundles",
    );
    assert.deepEqual(result, {
      matched: 1,
      changed: 1,
      assetName: "general-settings-h4wYKRAT.js",
    });
    assert.match(
      fs.readFileSync(path.join(assets, "general-settings-h4wYKRAT.js"), "utf8"),
      /!==`linux`/,
    );
    assert.equal(
      fs.readFileSync(path.join(assets, "general-settings-CsA3Lt9Z.js"), "utf8"),
      "old DMG fixture",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("staging copies the signed-package icon and current package metadata contract", () => {
  const { root, install, result } = runStage();
  try {
    assert.equal(result.status, 0, result.stderr);
    const target = path.join(install, "resources", "dock-icon");
    assert.equal(fs.readFileSync(path.join(target, "icon-chatgpt.png"), "utf8"), "official-icon");
    assert.deepEqual(
      fs.readFileSync(path.join(target, "icon-codex-dark-color.png")),
      fs.readFileSync(path.resolve(__dirname, "../../assets/codex-linux.png")),
    );
    assert.deepEqual(
      fs.readFileSync(path.join(target, "icon-codex-light.png")),
      fs.readFileSync(path.resolve(__dirname, "../../assets/codex-linux.png")),
    );
    assert.equal(fs.statSync(path.join(target, "sync-desktop-icon.sh")).mode & 0o777, 0o755);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("staging fails soft and removes its payload when official resources or metadata drift", () => {
  for (const options of [{ officialIcon: null }, { desktopMetadata: false }]) {
    const { root, install, result } = runStage(options);
    try {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /WARN: Official Linux Dock icon/);
      assert.equal(fs.existsSync(path.join(install, "resources", "dock-icon")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("nested disable leaves no Dock payload", () => {
  const { root, install, result } = runStage({ enabled: false });
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(install, "resources", "dock-icon")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("desktop synchronization updates and cleans up only its managed launcher", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dock-icon-desktop-"));
  const dataHome = path.join(root, "share");
  const source = path.join(root, "codex-desktop.desktop");
  const helper = path.join(__dirname, "sync-desktop-icon.sh");
  const appDir = path.join(root, "app");
  fs.mkdirSync(path.join(appDir, "resources", "dock-icon"), { recursive: true });
  fs.copyFileSync(helper, path.join(appDir, "resources", "dock-icon", "sync-desktop-icon.sh"));
  fs.writeFileSync(
    source,
    "[Desktop Entry]\nName=ChatGPT Community\nExec=/usr/bin/codex-desktop %u\nIcon=codex-desktop\nStartupWMClass=codex-desktop\n",
  );
  try {
    const sync = childProcess.spawnSync("bash", [helper, "chatgpt"], {
      input: Buffer.from("selected-icon"),
      env: {
        ...process.env,
        CODEX_LINUX_DESKTOP_FILE_SOURCE: source,
        XDG_DATA_HOME: dataHome,
      },
    });
    assert.equal(sync.status, 0, sync.stderr?.toString());
    const desktop = path.join(dataHome, "applications", "codex-desktop.desktop");
    assert.match(fs.readFileSync(desktop, "utf8"), /X-Codex-Linux-Dock-Icon=1/);
    assert.match(fs.readFileSync(desktop, "utf8"), /Icon=.*codex-desktop-dock-chatgpt\.png/);

    fs.rmSync(path.join(appDir, "resources", "dock-icon"), { recursive: true, force: true });
    const cleanup = childProcess.spawnSync("bash", [helper, appDir], {
      env: {
        ...process.env,
        CODEX_LINUX_FEATURE_HOOK_PHASE: "prelaunch",
        CODEX_LINUX_APP_DIR: appDir,
        XDG_DATA_HOME: dataHome,
      },
    });
    assert.equal(cleanup.status, 0, cleanup.stderr?.toString());
    assert.equal(fs.existsSync(desktop), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("desktop synchronization preserves unmanaged launchers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dock-icon-unmanaged-"));
  const dataHome = path.join(root, "share");
  const desktop = path.join(dataHome, "applications", "codex-desktop.desktop");
  fs.mkdirSync(path.dirname(desktop), { recursive: true });
  fs.writeFileSync(desktop, "[Desktop Entry]\nName=Custom\nIcon=custom\n");
  try {
    const result = childProcess.spawnSync("bash", [path.join(__dirname, "sync-desktop-icon.sh"), "chatgpt"], {
      input: Buffer.from("selected-icon"),
      env: { ...process.env, XDG_DATA_HOME: dataHome },
    });
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.equal(fs.readFileSync(desktop, "utf8"), "[Desktop Entry]\nName=Custom\nIcon=custom\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
