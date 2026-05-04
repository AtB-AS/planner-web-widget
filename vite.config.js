import { resolve } from "path";
import postcss from "postcss";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { compressToEncodedURIComponent } from "lz-string";

import { version } from "./package.json";

// Workaround: CSS `composes` brings in styles from other files, but the
// `token()` calls in those composed styles aren't processed by PostCSS
// (same issue the build script works around by running PostCSS twice).
// This plugin runs @atb-as/token again after CSS modules processing to
// resolve any remaining `token()` calls.
function resolveRemainingTokens() {
  const tokenPlugin = require("@atb-as/token");
  const processor = postcss([tokenPlugin]);
  return {
    name: "resolve-remaining-tokens",
    enforce: "post",
    async transform(code, id) {
      if (!id.includes(".css") || !code.includes("token(")) return;
      // In dev, Vite has already transformed CSS into a JS module.
      // Extract the CSS string, process it, and replace it in the JS.
      const cssMatch = code.match(/const __vite__css = (".*")\n/s);
      if (cssMatch) {
        const rawCss = JSON.parse(cssMatch[1]);
        if (!rawCss.includes("token(")) return;
        const result = await processor.process(rawCss, { from: id });
        return code.replace(cssMatch[1], JSON.stringify(result.css));
      }
      // During build, code is still raw CSS
      const result = await processor.process(code, { from: id });
      return result.css;
    },
  };
}

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
