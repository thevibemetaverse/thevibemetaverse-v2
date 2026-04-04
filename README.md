# The Vibe Metaverse v2

Browser game built with **Three.js** and an **Express** backend that proxies Claude API calls for prompt-to-voxel object generation.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set at least your Anthropic API key:

```
CLAUDE_API_KEY=sk-ant-...
```

### Portals (optional)

The game loads `/portals.json` from the **same host** as the page. The Express server proxies that to **`PORTALS_SERVER`** (set this in your hosting provider’s environment for production). It must be the portals service **origin** only (e.g. `https://portals.example.com`); the server fetches `${PORTALS_SERVER}/portals.json`. Default when unset: `http://localhost:3001`.

If you deploy **static files only** (no Node), use the bundled empty `public/portals.json` until you add a backend proxy.

## Run locally

```bash
npm start
```

Open **http://localhost:3000** in your browser.

## How to play

- **WASD** — move
- **Click + drag** — rotate camera
- **TAB** — open the prompt bar (type a description like "a glowing lantern", press Enter)
- **Escape** — close the prompt bar
- You get **5 prompts per session** — shown as pips in the top-right corner

## Requirements

- [Node.js](https://nodejs.org/) v18+
