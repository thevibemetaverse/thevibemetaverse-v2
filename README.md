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

## Adding a Portal to Your Game

Want your Three.js game to connect to the Vibe Metaverse portal network? Add the portal embed and players can walk between your game and every other game on the network.

### 1. Import the embed

Add this import to your main JavaScript file:

```js
import { createVibePortal } from 'https://portals-production-ee2d.up.railway.app/embed.js';
```

This does two things automatically:
- **Registers your game** with the portal network — your page's `<title>` tag is used as your game's name across the entire network (this is what players see above your portal in every other game)
- **Exports `createVibePortal()`** so you can place a portal in your scene

### 2. Create a portal in your scene

```js
const portal = createVibePortal({
  scene: scene,     // your Three.js scene
  camera: camera,   // your Three.js camera
});

// Position it wherever you want in your world
portal.position.set(0, 0, -10);
scene.add(portal);
```

### 3. Update every frame

In your render/animation loop, pass the player's position so the portal can detect proximity:

```js
function animate() {
  requestAnimationFrame(animate);
  portal.update(player.position);
  renderer.render(scene, camera);
}
```

When a player walks within **6 units**, a prompt appears. At **2 units**, they're automatically transported to the destination.

### 4. Handle return portals

If a player arrives at your game from another portal, the URL will contain a `?ref=` parameter. The embed handles this automatically — a "Return" portal appears so players can go back where they came from.

### Options reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scene` | `THREE.Scene` | — | Your Three.js scene |
| `camera` | `THREE.Camera` | — | Your Three.js camera |
| `label` | `string` | `'The Vibe Metaverse'` | Text displayed above the portal |
| `username` | `string` | `null` | Player name, passed to destination via query param |
| `avatar` | `string` | `null` | Avatar URL, passed to destination via query param |
| `scale` | `number` | `1` | Portal size multiplier |
| `proximityDist` | `number` | `6` | Distance (units) to show the prompt |
| `enterDist` | `number` | `2` | Distance (units) to auto-navigate |
| `game` | `string` | `'the-vibe-metaverse'` | Portal slug to navigate to |

### How it works under the hood

1. Your game loads `embed.js`, which auto-registers your game's URL and title with the portal registry
2. The registry at `https://portals-production-ee2d.up.railway.app/portals.json` maintains the list of all connected games
3. Each game fetches this list and renders portals to every other game (filtering out itself)
4. Walking into a portal navigates to the destination with `?portal=true&ref=<origin>` query params
5. The destination game sees the `ref` param and shows a return portal back

### Add a portal with a coding agent

If you're using a coding agent (Claude Code, Cursor, etc.), paste this prompt:

> Add a portal to The Vibe Metaverse portal network in my Three.js game.
>
> Import `createVibePortal` from `https://portals-production-ee2d.up.railway.app/embed.js`. This import auto-registers my game with the network using the page's `<title>` tag as the game name.
>
> Call `createVibePortal({ scene, camera })` to create the portal mesh. Position it somewhere visible near the player spawn point, add it to the scene, and call `portal.update(playerPosition)` in the animation loop so it can detect when the player walks into it. The portal auto-navigates when a player gets within 2 units.
>
> Return portals are handled automatically — if `?ref=` is in the URL, a return portal appears. No extra code needed.

### Your game's name on the network

Your page's `<title>` tag is automatically used as the label above your portal in every other game on the network. Just make sure your HTML has a good title:

```html
<title>Cool Space Game</title>
```

### Register manually (without the embed)

If you just want your game listed without using the SDK portal mesh, send a POST:

```bash
curl -X POST https://portals-production-ee2d.up.railway.app/api/register \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://yourgame.com", "title": "Cool Space Game"}'
```

## Requirements

- [Node.js](https://nodejs.org/) v18+
