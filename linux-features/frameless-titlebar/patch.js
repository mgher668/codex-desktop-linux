"use strict";

const MAIN_MARKER = "/*codexLinuxFramelessTitlebarMainV1*/";
const WEBVIEW_MARKER = "/*codexLinuxFramelessTitlebarWebviewV1*/";

function applyFramelessTitlebarBranchPatch(source) {
  let changed = false;
  const combined = /([A-Za-z_$][\w$]*)===`win32`\|\|\1===`linux`\?\{titleBarStyle:`hidden`,titleBarOverlay:(?:\1===`linux`\?codexLinuxTitleBarOverlay\(([A-Za-z_$][\w$]*)\):)?([A-Za-z_$][\w$]*)\(\2\),(\.\.\.([A-Za-z_$][\w$]*)===`quickChat`\?\{resizable:!0\}:\{\})\}:/g;
  const patched = source.replace(
    combined,
    (_match, platform, zoom, overlay, quickOptions) => {
      changed = true;
      return `${platform}===\`win32\`?{titleBarStyle:\`hidden\`,titleBarOverlay:${overlay}(${zoom}),${quickOptions}}:${platform}===\`linux\`?{titleBarStyle:\`hidden\`,${quickOptions}}:`;
    },
  );
  if (!changed && !/[A-Za-z_$][\w$]*===`linux`\?\{titleBarStyle:`hidden`,\.\.\./.test(patched)) {
    console.warn("WARN: Could not find official BrowserWindow titlebar branch for frameless-titlebar");
  }
  return patched;
}

function applyFramelessTitlebarOverlaySyncPatch(source) {
  let patched = source.replace(
    /(setWindowZoom\([^)]*\)\{(?=[\s\S]{0,600}?,([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*&&this\.windowAppearances\.get\()[\s\S]{0,600}?)\(process\.platform===`win32`\|\|process\.platform===`linux`\)&&\(this\.windowZooms\.set\(([A-Za-z_$][\w$]*)\.id,([A-Za-z_$][\w$]*)\),\3\.setTitleBarOverlay\((?:process\.platform===`linux`\?codexLinuxTitleBarOverlay\(\4\):)?([A-Za-z_$][\w$]*)\(\4\)\)\)/g,
    (_match, prefix, _appearance, win, zoom, overlay) =>
      `${prefix}process.platform===\`win32\`&&(this.windowZooms.set(${win}.id,${zoom}),${win}.setTitleBarOverlay(${overlay}(${zoom})))`,
  );
  patched = patched.replace(
    /installApplicationMenuTitleBarOverlaySync\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)\{if\(process\.platform!==`win32`&&process\.platform!==`linux`\|\|\2!==`primary`&&\2!==`quickChat`\)return;let ([A-Za-z_$][\w$]*)=\(\)=>\{\1\.isDestroyed\(\)\|\|\1\.setTitleBarOverlay\((?:process\.platform===`linux`\?codexLinuxTitleBarOverlay\(this\.windowZooms\.get\(\1\.id\)\):)?([A-Za-z_$][\w$]*)\(this\.windowZooms\.get\(\1\.id\)\)\)\};return ([A-Za-z_$][\w$]*)\.nativeTheme\.on\(`updated`,\3\),\3\(\),\(\)=>\{\5\.nativeTheme\.off\(`updated`,\3\)\}\}/g,
    (_match, win, type, update, overlay, electron) =>
      `installApplicationMenuTitleBarOverlaySync(${win},${type}){if(process.platform!==\`win32\`||${type}!==\`primary\`&&${type}!==\`quickChat\`)return;let ${update}=()=>{${win}.isDestroyed()||${win}.setTitleBarOverlay(${overlay}(this.windowZooms.get(${win}.id)))};return ${electron}.nativeTheme.on(\`updated\`,${update}),${update}(),()=>{${electron}.nativeTheme.off(\`updated\`,${update})}}`,
  );
  return patched;
}

function applyFramelessTitlebarMainPatch(source) {
  if (source.includes(MAIN_MARKER)) return source;
  const patched = applyFramelessTitlebarOverlaySyncPatch(
    applyFramelessTitlebarBranchPatch(source),
  );
  if (patched === source) return source;
  return `${MAIN_MARKER}${patched}`;
}

function applyFramelessTitlebarWebviewTransforms(source) {
  let patched = source.replace(
    /applicationMenu:Object\.freeze\(\{left:0,right:\d+\}\)/g,
    "applicationMenu:Object.freeze({left:0,right:0})",
  );
  patched = patched.replace(
    /codexLinuxUseWindowControlsSafeArea:![A-Za-z_$][\w$]*,side:`end`/g,
    "codexLinuxUseWindowControlsSafeArea:!1,side:`end`",
  );
  patched = patched.split("case`win32`:case`linux`:return`application-menu`")
    .join("case`win32`:return`application-menu`;case`linux`:return`native`");
  patched = patched.replace(
    /([A-Za-z_$][\w$]*)\.includes\(`win`\)\|\|([A-Za-z_$][\w$]*)\.includes\(`windows`\)\|\|\1\.includes\(`linux`\)\?([A-Za-z_$][\w$]*)\?\?([A-Za-z_$][\w$]*)\.applicationMenu:\4\.default/g,
    (_match, platform, ua, fallback, layout) =>
      `${platform}.includes(\`win\`)||${ua}.includes(\`windows\`)?${fallback}??${layout}.applicationMenu:${layout}.default`,
  );
  return patched;
}

function applyFramelessTitlebarWebviewPatch(source) {
  if (source.includes(WEBVIEW_MARKER)) return source;
  const patched = applyFramelessTitlebarWebviewTransforms(source);
  if (patched === source) {
    console.warn("WARN: Could not identify official frameless-titlebar webview surface");
    return source;
  }
  return `${WEBVIEW_MARKER}${patched}`;
}

module.exports = {
  descriptors: [
    {
      id: "main-process",
      phase: "main-bundle",
      order: 20_720,
      ciPolicy: "optional",
      apply: applyFramelessTitlebarMainPatch,
    },
    {
      id: "webview-window-controls-layout",
      phase: "webview-asset",
      order: 20_730,
      ciPolicy: "optional",
      pattern: /^app-initial-[^.]+\.js$/,
      missingDescription: "main app chrome bundle",
      skipDescription: "frameless titlebar webview layout patch",
      apply: applyFramelessTitlebarWebviewPatch,
    },
  ],
  applyFramelessTitlebarBranchPatch,
  applyFramelessTitlebarMainPatch,
  applyFramelessTitlebarOverlaySyncPatch,
  applyFramelessTitlebarWebviewPatch,
  applyFramelessTitlebarWebviewTransforms,
};
