import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { compressToEncodedURIComponent } from "lz-string";

import { version } from "./package.json";

// Workaround: CSS `composes` brings in styles from other files, but the
// `token()` calls in those composed styles aren't processed by PostCSS
// (same issue the build script works around by running PostCSS twice).
// This plugin resolves any remaining `token()` calls after CSS modules
// processing, using the same camelCase→kebab-case→CSS-var logic as
// the @atb-as/token PostCSS plugin.
function resolveRemainingTokens() {
  const camelToKebab = (str) =>
    str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return {
    name: "resolve-remaining-tokens",
    enforce: "post",
    transform(code, id) {
      if (!id.includes(".css")) return;
      if (!code.includes("token(")) return;
      const result = code.replace(
        /token\(\s*(['"])([\w.]+)\1\s*\)/g,
        (_match, _q, path) =>
          `var(--${camelToKebab(path).replace(/\./g, "-")})`,
      );
      return result !== code ? result : undefined;
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
