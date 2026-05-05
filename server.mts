import express, { type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import lzString from "lz-string";

interface WidgetVersion {
  version: string;
  created: string;
  urls: { css: string; umd: string; esm: string };
}

interface Manifest {
  latest: WidgetVersion | null;
  all: WidgetVersion[];
}

const app = express();
const PORT = process.env.PORT || 3001;
const orgId = process.env.ORG_ID || "atb";
const compressedOrgId = lzString.compressToEncodedURIComponent(orgId);
const PLANNER_URL_BASE =
  process.env.PLANNER_URL_BASE || "https://reise.atb.no/";

const distDir = path.resolve(import.meta.dirname, "dist");

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Proxy API requests to the planner backend
app.use("/api", plannerWebProxy);
app.use("/assets", plannerWebProxy);

async function plannerWebProxy(req: Request, res: Response) {
  const target = new URL(req.originalUrl, PLANNER_URL_BASE);
  try {
    const response = await fetch(target.toString(), {
      method: req.method,
      headers: { Accept: "application/json" },
    });
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-type") res.setHeader(key, value);
    });
    const body = await response.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err) {
    console.error("API proxy error:", err instanceof Error ? err.message : err);
    res.status(502).json({ error: "Failed to proxy request" });
  }
}

// Serve widget build artifacts as static files
app.use(
  "/widget",
  express.static(distDir, {
    setHeaders: (res: import("http").ServerResponse) =>
      res.setHeader(
        "Cache-Control",
        process.env.NODE_ENV === "production"
          ? "public, max-age=604800, stale-while-revalidate=86400"
          : "no-cache",
      ),
  }),
);

// Load manifest for the current org
function getManifest(): Manifest {
  const manifestPath = path.join(
    "available-widgets",
    compressedOrgId,
    "manifest.json",
  );
  if (!fs.existsSync(manifestPath)) {
    return { latest: null, all: [] };
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

// Fullscreen widget preview (with optional version)
app.get("/widget/preview/:version?", (req: Request, res: Response) => {
  const manifest = getManifest();
  if (!manifest.latest) {
    return res
      .status(404)
      .send("No widget builds found. Run build:widget first.");
  }

  const urlBase = `${req.protocol}://${req.get("host")}`;
  const version = req.params.version || manifest.latest.version;
  const widgetPath = `/widget/${compressedOrgId}/${version}`;
  const cssUrl = `${urlBase}${widgetPath}/planner-web.css`;
  const umdUrl = `${urlBase}${widgetPath}/planner-web.umd.js`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Preview - v${version}</title>
  <link rel="stylesheet" href="${cssUrl}">
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .wrapper {
      height: 100%;
      position: relative;
      display: grid;
      grid-template-areas: 'main' 'alternatives';
    }
    .widget {
      grid-area: main;
      display: grid;
      width: 100%;
      max-width: 1024px;
      padding: 2rem;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div id="planner-widget" class="widget"></div>
  </div>
  <script src="${umdUrl}"></script>
  <script>
    const widget = window.PlannerWeb.createWidget({
      urlBase: '${urlBase}/',
      plannerUrlBase: '${PLANNER_URL_BASE}',
      language: 'nb',
      outputOverrideOptions: { layoutMode: 'doubleColumn' },
    });
    document.querySelector('#planner-widget').innerHTML = widget.output;
    widget.init();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Widget server running at http://localhost:${PORT}`);
  console.log(`  Org: ${orgId} (${compressedOrgId})`);
  console.log(`  Preview: http://localhost:${PORT}/widget/preview`);
});
