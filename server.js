const express = require("express");
const path = require("path");
const fs = require("fs");
const { compressToEncodedURIComponent } = require("lz-string");

const app = express();
const PORT = process.env.PORT || 3001;
const orgId = process.env.ORG_ID || "atb";
const compressedOrgId = compressToEncodedURIComponent(orgId);
const PLANNER_URL_BASE =
  process.env.PLANNER_URL_BASE || "https://reise.atb.no/";

const distDir = path.resolve(__dirname, "dist");

// Proxy API requests to the planner backend to avoid CORS issues
app.use("/api", async (req, res) => {
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
    console.error("API proxy error:", err.message);
    res.status(502).json({ error: "Failed to proxy request" });
  }
});

// Serve widget build artifacts as static files
app.use("/widget", express.static(distDir, { maxAge: "7d" }));

// Load manifest for the current org
function getManifest() {
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

// Documentation page
app.get("/widget", (req, res) => {
  const manifest = getManifest();
  if (!manifest.latest) {
    return res
      .status(404)
      .send("No widget builds found. Run build:widget first.");
  }

  const urlBase = `${req.protocol}://${req.get("host")}`;
  const latest = manifest.latest;
  const cssUrl = `${urlBase}${latest.urls.css}`;
  const umdUrl = `${urlBase}${latest.urls.umd}`;
  const esmUrl = `${urlBase}${latest.urls.esm}`;

  const versionsHtml = manifest.all
    .map(
      (mod) => `
      <details>
        <summary>
          <strong>${mod.version}</strong> (${new Date(mod.created).toLocaleDateString()})
        </summary>
        <pre><code>&lt;script src="${urlBase}${mod.urls.umd}"&gt;&lt;/script&gt;</code></pre>
        <pre><code>&lt;script src="${urlBase}${mod.urls.esm}"&gt;&lt;/script&gt;</code></pre>
        <pre><code>&lt;link rel="stylesheet" href="${urlBase}${mod.urls.css}" /&gt;</code></pre>
      </details>`,
    )
    .join("\n");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Documentation</title>
  <link rel="stylesheet" href="${cssUrl}">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; color: #333; }
    main { max-width: 960px; margin: 0 auto; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    h2 { margin-top: 2rem; }
    h3 { margin-top: 1.5rem; }
    pre { background: #282a36; color: #f8f8f2; padding: 1rem; border-radius: 6px; overflow-x: auto; position: relative; }
    code { font-family: 'Fira Code', monospace; font-size: 0.9rem; }
    .demo { margin: 1rem 0; }
    details { margin: 0.5rem 0; }
    summary { cursor: pointer; padding: 0.5rem 0; }
    .copy-btn {
      position: absolute; top: 0.5rem; right: 0.5rem;
      background: rgba(255,255,255,0.1); border: none; color: #f8f8f2;
      padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
    .copy-btn:hover { background: rgba(255,255,255,0.2); }
    ul { list-style-position: inside; }
  </style>
</head>
<body>
  <main>
    <h1>Widget Documentation</h1>

    <h2>Demo</h2>
    <div class="demo" id="planner-widget"></div>
    <p><em>Note: Widget is without padding. Should be up to consumer to decide when integrating.</em></p>

    <h2>Installation (latest version v${latest.version})</h2>

    <p>Install by copying HTML provided below. After loading JS and CSS file it can be initialized using the following code:</p>

    <pre><code>${escapeHtml(`<script>
  const widget = window.PlannerWeb.createWidget({
    urlBase: '${urlBase}/',
    plannerUrlBase: '${PLANNER_URL_BASE}',
    language: 'nn',
    outputOverrideOptions: {
      inheritFont: false,
      layoutMode: 'doubleColumn',
    },
  });
  widget.init();
</script>`)}</code></pre>

    <h3>HTML output</h3>
    <p>The HTML output is available via <code>widget.output</code> after calling <code>createWidget()</code>.</p>

    <h3>Scripts (UMD / ESM)</h3>
    <pre><code>${escapeHtml(`<script src="${umdUrl}"></script>`)}</code></pre>
    <pre><code>${escapeHtml(`<script src="${esmUrl}"></script>`)}</code></pre>

    <h3>Styling</h3>
    <pre><code>${escapeHtml(`<link rel="stylesheet" href="${cssUrl}" />`)}</code></pre>

    <h3>Using dynamic output</h3>
    <p>You can inject HTML automatically by using <code>widget.output</code> property. This can be done server side or by using client side frameworks.</p>
    <p>One advantage of doing this dynamically is that code is automatically updated on new releases.
    <strong>Note: This is optional and not required if you use the HTML directly.</strong></p>

    <pre><code>${escapeHtml(`<div id="planner-web"></div>
<script>
  document.querySelector('#planner-web').innerHTML = widget.output;
  widget.urls; // URLs to JS and CSS files
</script>`)}</code></pre>

    <h2>Complete example</h2>
    <pre><code>${escapeHtml(`<link rel="stylesheet" href="${cssUrl}" />

<style>
  .wrapper { background: #007ab5; display: flex; justify-content: center; }
  .example { max-width: 1024px; width: 100%; }
</style>

<div class="wrapper">
  <div id="planner-widget" class="example"></div>
</div>

<script src="${umdUrl}"></script>
<script>
  const widget = window.PlannerWeb.createWidget({
    urlBase: '${urlBase}/',
    plannerUrlBase: '${PLANNER_URL_BASE}',
    outputOverrideOptions: { layoutMode: 'doubleColumn' },
  });
  document.querySelector('#planner-widget').innerHTML = widget.output;
  widget.init();
</script>`)}</code></pre>

    <h2>All versions</h2>
    <p><a href="https://github.com/AtB-AS/planner-web/releases">Read changelog</a></p>
    <ul>
      <li><code>Major (*.y.z)</code>: Requires HTML update. Not backwards compatible</li>
      <li><code>Minor (x.*.z)</code>: New features, backwards compatible. No HTML update needed</li>
      <li><code>Patch (x.y.*)</code>: Bug fix, no changes needed other than using new bundles</li>
    </ul>
    ${versionsHtml}
  </main>

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

// Fullscreen widget preview (with optional version)
app.get("/widget/preview/:version?", (req, res) => {
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

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.listen(PORT, () => {
  console.log(`Widget server running at http://localhost:${PORT}/widget`);
  console.log(`  Org: ${orgId} (${compressedOrgId})`);
  console.log(`  Preview: http://localhost:${PORT}/widget/preview`);
});
