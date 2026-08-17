"use strict";

const CURRENT_USAGE_GATE =
  /([A-Za-z_$][\w$]*)=process\.platform!==`darwin`\|\|([A-Za-z_$][\w$]*)\.length===0\?\[\]:/g;
const PATCHED_USAGE_GATE =
  /([A-Za-z_$][\w$]*)=process\.platform!==`darwin`&&process\.platform!==`linux`\|\|([A-Za-z_$][\w$]*)\.length===0\?\[\]:/g;

function countMatches(source, pattern) {
  if (typeof source !== "string") return 0;
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].length;
}

function trayUsageMainContract(source) {
  const currentCount = countMatches(source, CURRENT_USAGE_GATE);
  const patchedCount = countMatches(source, PATCHED_USAGE_GATE);
  if (currentCount === 1 && patchedCount === 0) return "current";
  if (currentCount === 0 && patchedCount === 1) return "patched";
  return "drifted";
}

function applyTrayUsageMainPatch(source) {
  const contract = trayUsageMainContract(source);
  if (contract === "patched") return source;
  if (contract !== "current") {
    console.warn(
      "WARN: Could not find the current Linux tray-usage main-process contract - skipping tray usage patch",
    );
    return source;
  }

  const patched = source.replace(
    CURRENT_USAGE_GATE,
    (_match, menuItemsAlias, usageLimitsAlias) =>
      `${menuItemsAlias}=process.platform!==\`darwin\`&&process.platform!==\`linux\`||${usageLimitsAlias}.length===0?[]:`,
  );
  if (trayUsageMainContract(patched) !== "patched") {
    console.warn(
      "WARN: Linux tray-usage main-process contract changed while patching - skipping tray usage patch",
    );
    return source;
  }
  return patched;
}

const descriptors = [
  {
    id: "linux-tray-usage-main-process",
    phase: "main-bundle",
    order: 20_960,
    ciPolicy: "optional",
    apply: applyTrayUsageMainPatch,
  },
];

module.exports = {
  applyTrayUsageMainPatch,
  descriptors,
  trayUsageMainContract,
};
