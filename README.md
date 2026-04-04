# The Vibe Metaverse v2

A Three.js world on the **portal network**: players walk through portals into other games and back. If you only care about wiring your own game, start below.

---

## Copy this into your coding agent

Paste the whole block into Cursor, Claude Code, Copilot Chat, etc.:

````
Add a portal to The Vibe Metaverse portal network in my Three.js game.

1. Import createVibePortal from:
   https://portals.thevibemetaverse.com/embed.js
   That import auto-registers this page with the network (the browser document title is used as the game name everywhere).

2. After I have scene, camera, and something representing the player position (e.g. player.position), call:
   const portal = createVibePortal({ scene, camera });
   Position the portal mesh (it is a THREE.Group), add it to the scene.

3. In my animation/render loop, every frame call:
   portal.update(player.position)
   (or whatever Vector3 tracks the player.)

4. Proximity: around 6 units shows the enter prompt; around 2 units it navigates. If the URL has ?ref= (player came from another game), the embed shows a Return portal — no extra code.

5. Optional: set a clear <title> in HTML so other games see a good label above my portal.

Do not remove my existing game logic; only add the import, portal creation/placement, and portal.update in the loop.
````

**Embed URL (if you edit by hand):** `https://portals.thevibemetaverse.com/embed.js`

---

## Add a portal yourself

### 1. Import

```js
import { createVibePortal } from 'https://portals.thevibemetaverse.com/embed.js';
```

Loading this URL **registers** your game (`window.location.origin` + `document.title`) with the portal registry.

### 2. Create and place

```js
const portal = createVibePortal({
  scene,
  camera,
});

portal.position.set(0, 0, -10);
scene.add(portal);
```

### 3. Drive it every frame

```js
function animate() {
  requestAnimationFrame(animate);
  portal.update(player.position);
  renderer.render(scene, camera);
}
```

Within **~6 units** the UI prompts; within **~2 units** navigation runs.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scene` | `THREE.Scene` | — | Your scene |
| `camera` | `THREE.Camera` | — | Your camera |
| `label` | `string` | `'The Vibe Metaverse'` | Text above the portal (ignored when showing Return) |
| `username` | `string` | `null` | Passed to the destination as a query param |
| `avatar` | `string` | `null` | Avatar URL for the destination |
| `scale` | `number` | `1` | Portal size; proximity distances scale with this |
| `proximityDist` | `number` | `6` | Show prompt within this distance (world units) |
| `enterDist` | `number` | `2` | Auto-navigate within this distance |
| `game` | `string` | `'the-vibe-metaverse'` | Registry slug to navigate to |

### Name on the network

Other games read your label from the page title:

```html
<title>Cool Space Game</title>
```

### Return trips

If the URL contains `?ref=...`, the embed builds a **Return** portal that sends the player back. No extra code.

---

## Run this repo locally

Browser game (Three.js) plus an Express backend that proxies **Claude** for prompt-to-voxel generation.

**Install**

```bash
npm install
```

**Config**

Copy `.env.example` to `.env` and set at least:

```
CLAUDE_API_KEY=sk-ant-...
```

**Start**

```bash
npm start
```

Open **http://localhost:3000**.

**Controls**

- **WASD** — move  
- **Click + drag** — rotate camera  
- **TAB** — prompt bar (describe an object, Enter)  
- **Escape** — close prompt bar  
- **5 prompts per session** (pips in the corner)

**Requirements:** [Node.js](https://nodejs.org/) v18+
