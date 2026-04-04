# The Vibe Metaverse v2

Browser game built with **Three.js** and an **Express** backend that proxies Claude API calls for prompt-to-voxel object generation.

## Setup

```bash
npm install
```

Create a `.env` file in the project root with your Anthropic API key:

```
CLAUDE_API_KEY=sk-ant-...
```

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
