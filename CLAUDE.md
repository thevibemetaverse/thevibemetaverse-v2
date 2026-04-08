# The Vibe Metaverse v2

## What This Is

A web-based game entry for The Vibe Metaverse v2 competition. This is a browser game that must be instantly playable with no friction.

## Competition Rules

- **AI-written code**: At least 90% of the code must be written by AI
- **Free & accessible**: The game must be playable on the web with no login, no signup, and free-to-play (preferably on its own domain or subdomain)
- **3D engine**: Three.js
- **No loading screens or heavy downloads**: The game must load almost instantly — no splash screens, no large asset downloads. The only acceptable gate is an optional username prompt

## Development Guidelines

- Use Three.js unless there's a strong reason to use something else
- Keep assets minimal and lightweight — inline or procedurally generate where possible
- Avoid external asset dependencies that add load time
- Target instant load: the player should be in the game within seconds of opening the page
- If multiplayer, use WebSockets or WebRTC for real-time communication
- make FPS 60 or above

## Code Patterns

### Shared State with JSDoc Types

All game state lives in `public/modules/state.js` as a single exported object typed with JSDoc. When adding new properties to state:

1. Add the property to the `GameStateObject` typedef with its type and a brief description
2. Add the initial value to the `state` object
3. Keep `@ts-check` enabled — editors will catch type mismatches without a build step

This project uses **no build step** (no TypeScript, no bundler). Use JSDoc typedefs for type safety instead of TypeScript.

### Adding a New Module

1. Create a new file in `public/modules/`
2. Import state: `import { state } from './state.js';`
3. Export `initX()` and/or `updateX()` functions
4. Wire `initX()` into `game.js` `init()` — order matters, see the existing sequence
5. Wire `updateX()` into the `animate()` loop if it needs per-frame updates
6. Use `state` for any data that needs to be shared across modules — do not pass data between modules directly
