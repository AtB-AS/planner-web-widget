import { resolve } from "path";
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
  resolve: {
    alias: {
      "@atb/theme/theme.css": `@atb-as/theme/lib/generated/themes/${orgId}-theme/theme.css`,
      "@atb/theme/typography.css": "@atb-as/theme/lib/generated/typography.css",
      "@atb/theme/typography.module.css":
        "@atb-as/theme/lib/generated/typography.module.css",
    },
  },
  plugins: [
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
