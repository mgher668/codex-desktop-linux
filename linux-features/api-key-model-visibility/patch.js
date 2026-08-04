"use strict";

const JS_IDENT = "[A-Za-z_$][\\w$]*";
const PATCH_MARKER = "codexLinuxApiKeyModelVisibility";

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

function applyApiKeyModelVisibilityPatch(source) {
  if (source.includes(PATCH_MARKER)) {
    return source;
  }

  // Current upstream shape (refactored): the allowlist gate lives in a
  // per-model visibility helper, e.g.
  //   function q$r({additionalAvailableModels:e,authMethod:t,availableModels:n,model:r,useHiddenModels:i}){return e?.has(r.model)===!0||(i&&t!==`amazonBedrock`?n.has(r.model):!r.hidden)}
  // Bypass the allowlist for API-key authenticated hosts the same way it is
  // already bypassed for non-ChatGPT hosts: add `&&authMethod!==`apikey``.
  const helperPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{additionalAvailableModels:${JS_IDENT},authMethod:(${JS_IDENT}),` +
      `availableModels:${JS_IDENT},model:${JS_IDENT},useHiddenModels:(${JS_IDENT})\\}\\)\\{return` +
      `[\\s\\S]{0,300}?)\\3&&\\2!==\\\`amazonBedrock\\\`(?=[,;?])`,
    "g",
  );
  const patched = source.replace(
    helperPattern,
    (_match, prefix, authMethodVar, useHiddenModelsVar) =>
      `${prefix}${useHiddenModelsVar}&&${authMethodVar}!==\`amazonBedrock\`&&` +
      `${authMethodVar}!==\`apikey\`/*${PATCH_MARKER}*/`,
  );
  if (patched !== source) {
    return patched;
  }

  // Legacy upstream shape: inline gate in the catalog filter function with
  // authMethod as the first destructured parameter.
  const legacyPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{authMethod:(${JS_IDENT}),availableModels:${JS_IDENT},` +
      `defaultModel:${JS_IDENT},enabledReasoningEfforts:${JS_IDENT},` +
      `includeUltraReasoningEffort:${JS_IDENT},models:${JS_IDENT},` +
      `useHiddenModels:(${JS_IDENT})\\}\\)\\{let[\\s\\S]{0,600}?[,;]${JS_IDENT}=)` +
      `\\3&&\\2!==\\\`amazonBedrock\\\`(?=[,;])`,
    "g",
  );
  const patchedLegacy = source.replace(
    legacyPattern,
    (_match, prefix, authMethodVar, useHiddenModelsVar) =>
      `${prefix}${useHiddenModelsVar}&&${authMethodVar}!==\`amazonBedrock\`&&` +
      `${authMethodVar}!==\`apikey\`/*${PATCH_MARKER}*/`,
  );
  if (patchedLegacy !== source) {
    return patchedLegacy;
  }

  if (
    source.includes("list-models-for-host") &&
    source.includes("useHiddenModels") &&
    source.includes("amazonBedrock")
  ) {
    warn("Could not find desktop model allowlist gate", "API key model visibility patch");
  }
  return source;
}

const descriptors = [
  {
    id: "api-key-model-visibility-ui",
    phase: "webview-asset",
    order: 20550,
    ciPolicy: "optional",
    // Upstream renamed the app main webview chunk from `app-initial~app-main~*.js`
    // to `app-initial-*.js` (vite split the combined chunk); match both shapes.
    pattern: /^app-initial(~app-main~|-).*\.js$/,
    missingDescription: "app main webview bundle",
    skipDescription: "API key model visibility patch",
    apply: applyApiKeyModelVisibilityPatch,
  },
];

module.exports = {
  applyApiKeyModelVisibilityPatch,
  descriptors,
};
