import { resolve } from "path";
import postcss from "postcss";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { compressToEncodedURIComponent } from "lz-string";

import { version } from "./package.json";

const orgId = process.env.ORG_ID;

if (!orgId) {
  throw new Error("Missing env ORG_ID");
}
const compressedOrgId = compressToEncodedURIComponent(orgId);

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.PLANNER_URL_BASE || "https://reise.atb.no",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@atb/theme/theme.css": `@atb-as/theme/lib/generated/themes/${orgId}-theme/theme.css`,
      "@atb/theme/typography.css": "@atb-as/theme/lib/generated/typography.css",
      "@atb/theme/typography.module.css":
        "@atb-as/theme/lib/generated/typography.module.css",
    },
  },
  plugins: [
    resolveRemainingTokens(),
    postCssHmr(),
    dts({
      include: [resolve(__dirname, "src/widget.ts")],
      rollupTypes: true,
    }),
  ],
  define: {
    "process.env": {
      MODULE_VERSION: version,
      COMPRESSED_ORG: compressedOrgId,
      ORG_ID: orgId,
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/widget.ts"),
      name: "PlannerWeb",
      fileName: `planner-web`,
    },
    outDir: resolve(__dirname, `dist/${compressedOrgId}/${version}`),
    rollupOptions: {
      output: {
        manualChunks: undefined,
        assetFileNames: `planner-web.css`,
      },
    },
  },
  css: {
    modules: {
      scopeBehaviour: "local",
      generateScopedName: "[name]__[local]",
    },
  },
});

// Workaround: CSS `composes` brings in styles from other files, but `token()`
// calls in those composed styles aren't processed by PostCSS. This plugin runs
// @atb-as/token again after CSS modules processing to resolve any remaining
// `token()` calls.
function resolveRemainingTokens() {
  const tokenPlugin = require("@atb-as/token");
  const processor = postcss([tokenPlugin]);
  return {
    name: "resolve-remaining-tokens",
    enforce: "post",

    // In dev, Vite transforms CSS into a JS module. From that JS file, extract
    // the CSS string, process it, and replace it in the JS.
    async transform(code, fileName) {
      if (!fileName.includes(".css") || !code.includes("token(")) return;

      const cssMatch = code.match(/const __vite__css = (".*")\n/s);
      if (!cssMatch) return;

      const rawCss = JSON.parse(cssMatch[1]);
      if (!rawCss.includes("token(")) return;

      const result = await processor.process(rawCss, { from: fileName });
      return code.replace(cssMatch[1], JSON.stringify(result.css));
    },

    // During build, CSS is extracted into a single .css file. Process this file
    // to resolve any remaining token() calls.
    async generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && fileName.endsWith(".css")) {
          const rawCss = asset.source.toString();
          if (!rawCss.includes("token(")) continue;
          const result = await processor.process(rawCss, { from: fileName });
          asset.source = result.css;
        }
      }
    },
  };
}

// Vite doesn't track CSS imports for hot module reloading. This invalidates all
// CSS modules to trigger a reload when a CSS module changes.
function postCssHmr() {
  return {
    name: "postcss-hmr",
    handleHotUpdate({ file, server }) {
      if (file.endsWith(".module.css")) {
        const affected = [...server.moduleGraph.idToModuleMap.values()].filter(
          (mod) => mod.file?.endsWith(".module.css") && mod.file !== file,
        );
        affected.forEach((mod) => server.moduleGraph.invalidateModule(mod));
        if (affected.length) return affected;
      }
    },
  };
}
