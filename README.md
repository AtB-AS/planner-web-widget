# Planner Web Widget

An embeddable JS widget that allows the user to start trip and departure
searches on PTA websites. It redirects to planner-web with the selected
locations and time as query parameters.

The widget is built once per organization (atb, nfk, fram, troms, vkt, farte)
and themed using `@atb-as/theme`.

## Setup

```bash
pnpm install
```

### Development

To start a development server on http://localhost:5173/, run:

```bash
ORG_ID=atb pnpm dev
```

This previews [index.html](index.html), which loads and mounts [widget.ts](src/widget.ts). Changes to code are hot-reloaded in the browser.

### Building and previewing a new version

Build for all orgs:

```bash
pnpm build:all-widgets
```

Start the documentation/preview server:

```bash
ORG_ID=atb pnpm start
```

Then open http://localhost:3001/widget/preview


## How it works

The widget is a vanilla JS library with no framework dependencies. Host websites
integrate it in these steps:

1. Load the CSS and JS files (UMD or ESM), through `<link>` and `<script>` tags.
2. Calling `createWidget()` with configuration. This returns an HTML string
   containing the full widget markup and an initialization function.
3. Inserting HTML content into the page. Can happen client or server-side.
4. After the markup is in the DOM, calling `init()` attaches event listeners to
   make the widget interactive.

At runtime the widget calls the planner-web backend for location autocomplete
and reverse geocoding. When the user submits a search, the browser navigates to
planner-web with the selected locations and time as query parameters.

### Build output

Each build produces four files per organization, output to
`dist/<version>/<org-id>/`:

- `planner-web.umd.js`: UMD bundle (for `<script>` tags)
- `planner-web.mjs`: ESM bundle
- `planner-web.d.ts`: TypeScript types for the ESM bundle
- `planner-web.css`: Styles

### Integrating the widget

Include the following in your HTML,

```html
<link rel="stylesheet"href="https://reise.example.no/widget/<version>/<org-id>/planner-web.css" />
```

```html
<div id="planner-widget"></div>
```

```html
<script src="https://reise.example.no/widget/<version>/<org-id>/planner-web.umd.js"></script>
<script>
  const widget = window.PlannerWeb.createWidget({
    urlBase: 'https://reise.example.no/',
    language: 'nb',
  });
  document.querySelector('#planner-widget').innerHTML = widget.output;
  widget.init();
</script>
```

### Server

`server.mts` is a lightweight Express server that:

- **`/widget/preview/:version?`**: Fullscreen widget preview (defaults to
  latest version)
- **`/widget/<version>/<org-id>/*`**: Static serving of built widget
  artifacts

Run `ORG_ID=atb pnpm start` to start the server locally.

## Release

1. Update `version` in `package.json`
2. Build all org variants:
   ```bash
   pnpm build:all-widgets
   ```
3. Verify the output in `dist/`. Each org should have the new version directory.

> [!NOTE]
> To preview the built widget before deploying, run `ORG_ID=atb pnpm start`.
> Then open http://localhost:3001/widget/preview

4. Deploy the server or the `dist/` directory to a CDN/static host
