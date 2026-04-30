# Planner Web Widget

A standalone, embeddable travel planner widget built with vanilla TypeScript and
CSS Modules. It allows external websites to embed trip search and departure
lookup functionality.

The widget is built once per organization (atb, nfk, fram, troms, vkt, farte)
and themed using `@atb-as/theme`.

## How it works

### Architecture

```
src/
  widget.ts              Main library (vanilla TS, no framework)
  widget.module.css      Styles (CSS Modules, composed from styles/)
  styles/                Shared CSS dependencies (search, selector, assistant)
server.mts                Express server for docs and static file serving
scripts/                 Build pipeline
dist/                    Build output (per-org versioned bundles)
```

The widget is a UMD/ESM library bundled with Vite. External sites load the JS
and CSS files, then call `window.PlannerWeb.createWidget()` to render the
widget.

### Build output

Each build produces three files per organization, output to
`dist/<compressed-org-id>/<version>/`:

- `planner-web.umd.js` — UMD bundle (for `<script>` tags)
- `planner-web.mjs` — ESM bundle
- `planner-web.css` — Styles

The organization ID is compressed with `lz-string` for use in URLs.

### Server

`server.mts` is a lightweight Express server that:

- **`GET /widget`** — Documentation page with a live demo, installation
  instructions, and version history
- **`GET /widget/preview/:version?`** — Fullscreen widget preview (defaults to
  latest version)
- **`/widget/<compressed-org>/<version>/*`** — Static serving of built widget
  artifacts

### Runtime dependencies

The widget calls the planner-web BFF at runtime for geocoding:

- `<urlBase>/api/departures/autocomplete` — Location search
- `<urlBase>/api/departures/reverse` — Reverse geocoding (for "My location")

The `urlBase` is configured by the consumer when calling `createWidget()`.

## How to test it

### Prerequisites

```bash
yarn install
```

### Build and run locally

Build the widget for a single org:

```bash
ORG_ID=atb yarn build:widget
```

Build for all orgs:

```bash
yarn build:all-widgets
```

Start the documentation/preview server:

```bash
ORG_ID=atb yarn start
```

Then open:

- http://localhost:3001/widget — Documentation page with live demo
- http://localhost:3001/widget/preview — Fullscreen widget preview

### Manual testing

1. Build the widget for the org you want to test
2. Start the server
3. Open the documentation page and verify:
   - The live demo renders and is interactive
   - Location autocomplete works (requires the planner-web BFF to be running)
   - Tab switching between "Find trip" and "See departures" works
   - Time selection (now / depart / arrive) works
   - The "My location" geolocation button works (requires HTTPS or localhost)
4. Check the fullscreen preview at `/widget/preview`

### Testing in an external page

Create an HTML file and load the widget:

```html
<link
  rel="stylesheet"
  href="http://localhost:3001/widget/<org-id>/<version>/planner-web.css"
/>
<div id="planner-widget"></div>
<script src="http://localhost:3001/widget/<org-id>/<version>/planner-web.umd.js"></script>
<script>
  const widget = window.PlannerWeb.createWidget({
    urlBase: 'https://reiseplanlegger.example.no/',
    language: 'nb',
  });
  document.querySelector('#planner-widget').innerHTML = widget.output;
  widget.init();
</script>
```

## How to make and release changes

### Making changes

1. Edit the source files in `src/`. The main entry point is `src/widget.ts`.
2. Build for a single org to iterate quickly:
   ```bash
   ORG_ID=atb yarn build:widget
   ```
3. Start the server and verify in the browser:
   ```bash
   ORG_ID=atb yarn start
   ```

### Key files

| File                      | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `src/widget.ts`           | Widget logic, HTML generation, Web Components, translations |
| `src/widget.module.css`   | Widget styles (composes from `src/styles/`)                 |
| `src/styles/*.module.css` | Shared CSS for search inputs, time selectors, layout        |
| `vite.config.js`          | Vite build config (lib mode, org-specific theming)          |
| `server.mts`              | Express server for docs and preview pages                   |
| `postcss.config.js`       | PostCSS config (token processing, autoprefixer)             |

### Versioning

Update the `version` field in `package.json`. The version is baked into the
build artifacts and used for the output path (`dist/<org>/<version>/`).

Follow semantic versioning:

- **Major** (`*.y.z`): Breaking changes that require consumers to update their
  HTML
- **Minor** (`x.*.z`): New features, backwards compatible — no consumer HTML
  changes needed
- **Patch** (`x.y.*`): Bug fixes, no changes needed other than loading the new
  bundle

### Releasing

1. Update `version` in `package.json`
2. Build all org variants:
   ```bash
   yarn build:all-widgets
   ```
3. Verify the output in `dist/` — each org should have the new version directory
4. Deploy the server (or the `dist/` directory to a CDN/static host)

### CSS notes

The widget uses CSS Modules with `composes` to share styles from `src/styles/`.
PostCSS runs twice during the build as a workaround for `composes` not being
fully resolved before other PostCSS plugins process the CSS. This is handled
automatically by `scripts/build-widget.sh`.
