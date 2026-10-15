/**
 * Metro configuration for the Expo app inside the REFLEX npm monorepo.
 *
 * Background — two react-natives coexist in this tree (verified via
 * `npm ls react-native --all`):
 *  • GOOD:  react-native@0.74.5 in apps/mobile/node_modules (+ its nested
 *    @react-native/virtualized-lists@0.74.87) — what the app declares.
 *  • PHANTOM: react-native@0.84.1 nested under
 *    node_modules/expo/node_modules (dragged in by @expo/vector-icons).
 *    RN 0.84 ships RAW TypeScript (`} as ReactNativePublicAPI;`), so if
 *    Metro compiles it, Babel dies with "Missing semicolon".
 *
 * Hence this config does three things:
 *  • `watchFolders` includes the workspace root → Metro watches
 *    `packages/engine` and hot-reloads engine changes.
 *  • `nodeModulesPaths` resolves modules from both the app-level and the
 *    workspace-root `node_modules` (hoisted deps + `@reflex/engine` link).
 *  • `resolveRequest` redirects anything that would resolve INTO the
 *    phantom 0.84 copy back to the single good 0.74.5 tree.
 *
 * NOTE: `disableHierarchicalLookup = true` was tried here and REVERTED —
 * it breaks legitimate nested transitive deps (the good copy's own
 * `react-native/node_modules/@react-native/virtualized-lists` becomes
 * unresolvable: "Unable to resolve @react-native/virtualized-lists
 * from FlatList.js"). Do not re-add it.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require("@expo/metro-config");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Single good copy: apps/mobile/node_modules/react-native@0.74.5.
const GOOD_RN_PKG = path.join(
  projectRoot,
  "node_modules",
  "react-native",
  "package.json"
);

// Single React instance: apps/mobile/node_modules/react@18.2.0.
// (Root hoists react@18.3.1 for the web app — bundling both breaks hooks.)
const LOCAL_REACT_PKG = path.join(
  projectRoot,
  "node_modules",
  "react",
  "package.json"
);

// Matches any file inside the phantom 0.84 install.
const PHANTOM_RN_SEGMENT = ["expo", "node_modules", "react-native"].join(
  path.sep
);

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so engine edits trigger mobile reloads.
config.watchFolders = [workspaceRoot];

// Resolve hoisted deps + the symlinked @reflex/engine from the root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Redirect phantom-copy resolutions to the good 0.74.5 tree,
// and force a single React instance (local mobile copy).
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exact 'react' AND subpaths ('react/jsx-runtime', …) → local mobile
  // instance only. Subpaths matter: files compiled with the automatic
  // JSX runtime import 'react/jsx-runtime' as a separate specifier, and
  // without this they resolve to the root react@18.3.1 while 'react'
  // itself is pinned local — two reconcilers → hooks crash
  // ("recentlyCreatedOwnerStacks of undefined" in withDevTools).
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return context.resolveRequest(
      { ...context, originModulePath: LOCAL_REACT_PKG },
      moduleName,
      platform
    );
  }
  const result = context.resolveRequest(context, moduleName, platform);
  if (
    result &&
    result.filePath &&
    result.filePath.includes(PHANTOM_RN_SEGMENT)
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: GOOD_RN_PKG },
      moduleName,
      platform
    );
  }
  return result;
};

module.exports = config;
