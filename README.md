# The Vibe Metaverse v2

Browser game built with **HTML**, **JavaScript**, and **Three.js** (loaded from a CDN). Serve the folder over HTTP so ES modules work; opening `index.html` as a `file://` URL is unreliable.

## Run locally

From the project root:

```bash
npx serve
```

The first time, `npx` may ask to install `serve` — confirm with `y`.

You should see something like:

- **Local:** `http://localhost:<port>` (often `3000`; if that port is busy, `serve` picks another, e.g. `64951`)
- **Network:** same host on your LAN IP — use this to open the page from another device on your network

Open the **Local** URL in your browser. A `GET /` returning **200** means the app loaded.

### Harmless 404s

Browsers often request `favicon.ico` and Apple touch icons. This repo does not ship those files, so you may see **404** lines for them in the terminal. They do not affect the game.

## Requirements

- [Node.js](https://nodejs.org/) (for `npx` / `serve`)
