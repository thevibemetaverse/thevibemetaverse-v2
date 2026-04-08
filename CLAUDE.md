# The Vibe Metaverse v2

## What This Is

A multiplayer 3D browser game built with Three.js for The Vibe Metaverse v2 competition. Must be instantly playable — no login, no loading screens, no heavy downloads. The only acceptable gate is an optional username prompt.

## Running Locally

```
npm start          # runs node server.js on port 3000 (or PORT env var)
```

No build step. No bundler. Open `http://localhost:3000` and you're in.

## Competition Rules That Affect Code

- **Instant load**: No splash screens, no large asset downloads. Procedurally generate where possible instead of loading files
- **Free & accessible**: No login, no signup, playable on the web
- **3D engine**: Three.js
- **Multiplayer**: Uses WebSockets (`/ws` endpoint)

## Project Structure

```
server.js                    → Express server, static files, portal proxy, WS attach
server/multiplayer-ws.js     → WebSocket hub (player join/leave/state/avatar/name)
public/
  index.html                 → Entry point, loads game.js as ES module
  modules/
    game.js                  → Init sequence + animate loop (orchestrator)
    state.js                 → Single shared state object (JSDoc-typed)
    constants.js             → All tunable numbers (speeds, sizes, limits)
    player.js                → Local player movement + physics
    character.js             → Avatar model loading + animation
    multiplayer.js           → WebSocket client, remote player sync
    camera.js                → Third-person orbit camera
    controls.js              → Keyboard/mouse input
    mobile-controls.js       → Touch joystick + swipe
    world.js                 → Ground, trees, sky
    grass.js                 → Instanced grass (50K blades, custom shader)
    clouds.js                → Shader-driven cloud dome
    lighting.js              → Sun, ambient, hemisphere lights + shadows
    portals.js               → Portal network integration
    portal-meshes.js         → Portal 3D meshes
    portal-proximity.js      → Enter-portal detection
    settings.js              → In-game settings panel
    hud.js                   → HUD overlay
    nametag.js               → Player name sprites
    avatar-picker.js         → Avatar selection UI
    models.js                → GLTF model loading
    renderer.js              → WebGL renderer setup
    utils.js                 → Shared helpers
    dev-tools.js             → Debug tools (dev mode only)
    loader.js                → Asset loading utilities
    version.js               → Version display
  textures/                  → Texture assets (keep minimal — prefer procedural)
assets/models/               → GLB models (avatars, environment)
vendor/portals/              → Vendored portals SDK (served at /vendor/portals)
```

## Init Order (game.js)

Order matters — later modules depend on earlier ones:

1. `createRenderer` → sets up WebGL renderer on state
2. Scene + Fog
3. `createCamera`
4. `createWorld` → ground, trees, sky (needs scene)
5. `initClouds` → cloud dome (needs scene)
6. `initGrass` → instanced grass (needs scene)
7. `setupLighting` → lights + shadows (needs scene, renderer)
8. `createPlayer` → player group (needs scene)
9. `setupPlayerControls` → input bindings (needs player)
10. `initMobileControls` → touch controls (needs player)
11. `loadPlayerModel` → GLTF avatar (needs player)
12. `initNametag` → name sprite (needs player)
13. `initAvatarPicker` → avatar selection UI
14. `initPortals` → portal network (needs scene)
15. `initModels` → environment models (needs scene)
16. `initSettings` → settings panel
17. `initDevTools` → debug tools
18. `initMultiplayer` → WebSocket connection (needs player, scene)

When adding a new `initX()`, place it in this sequence based on its dependencies.

## Animate Loop (game.js)

Runs every frame. Delta is clamped to `MAX_DELTA` (0.1s) to prevent physics jumps:

`updatePlayer → updateMultiplayer → updateGrass → updateTrees → updateClouds → updatePortals → updateCamera → animationMixer.update → updateSettings → renderer.render`

**Target: 60+ FPS.** Everything in this loop runs every frame — keep it cheap.

## Multiplayer Architecture

- **Client** (`multiplayer.js`): sends local player state (position, rotation, moving flag) every 50ms via WebSocket
- **Server** (`server/multiplayer-ws.js`): stateless relay hub. Broadcasts state to all other clients. Clamps x/z to `±300`, sanitizes values, prunes stale clients (45s timeout)
- **Not server-authoritative**: client computes its own position and reports it. Server only validates bounds
- **Message types**: `hello`/`welcome`, `ping`/`pong`, `state`, `avatar`, `name`, `player_joined`, `player_left`
- When adding new multiplayer events: add the message type handler in `multiplayer-ws.js`, send/receive in `multiplayer.js`, store remote player data on `state.remotePlayers`

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
4. Wire `initX()` into `game.js` `init()` at the correct position based on dependencies (see Init Order above)
5. Wire `updateX()` into the `animate()` loop if it needs per-frame updates
6. Use `state` for any data that needs to be shared across modules — do not pass data between modules directly

### Constants

All tunable numbers (speeds, distances, sizes, limits) live in `public/modules/constants.js`. Don't scatter magic numbers in module files — import from constants.

### Assets & Vendored Libraries

- **Models**: GLB files go in `assets/models/`. Only use model files when procedural generation would be impractical (e.g. character avatars). Simple shapes (trees, rocks, ground) should be procedural
- **Textures**: Prefer procedural canvas textures over image files. If a texture file is truly needed, keep it under 5KB
- **Vendored libs**: go in `vendor/`. Served by Express. Never rely on CDN imports — vendor locally to avoid extra network round-trips

## Performance Rules

### Shaders (GLSL)

- Never call expensive shader functions (FBM, noise) twice with similar inputs — cache the first result or use a cheaper approximation for secondary samples
- Wrap time uniforms to prevent float precision loss in long sessions: `(elapsedTime % 1000)` — GLSL floats have ~7 digits of precision and lose the ability to represent small increments after ~10K seconds, causing animation stutter/freeze
- GLSL functions like `normalize()`, `clamp()`, etc. return new values — they do NOT mutate in-place. Always assign the return value: `v0 = normalize(v0);`
- Verify `mix()` chains carefully — if two consecutive `mix()` calls use the same interpolant, the first result gets overwritten

### Geometry & Draw Calls

- Don't over-tessellate geometry that's shader-driven — if the visual shape comes entirely from the shader, use minimal segments (e.g. 32×16 not 64×32)
- Merge static geometry with `BufferGeometryUtils.mergeGeometries()` when spawning many similar objects — 30 trees × 5 sub-meshes = 150 draw calls; merging can reduce this to 2
- Use `InstancedMesh` for repeated identical geometry (grass, particles, debris)
- Never set `frustumCulled = false` unless the mesh truly has no useful bounding box — offscreen instances still cost GPU time

### Shadows

- Only set `castShadow = true` on meshes that need to cast visible shadows. Skip `receiveShadow` on small/complex meshes (tree branches, leaves, grass) where self-shadowing is imperceptible
- Every shadow-casting mesh is re-rendered from the light's POV every frame — minimize the count

### Init & Load Performance

- Never run expensive procedural generation (tree geometry, terrain mesh) synchronously during init — batch, defer, or share/reuse geometry across instances
- Avoid CDN dependencies that add network round-trips — vendor libraries locally under `/vendor/` or `/public/vendor/`
- Procedurally generate simple textures (gradients, alpha masks) via `<canvas>` instead of loading image files — fewer HTTP requests, aligns with competition instant-load rules
- Use `structuredClone()` instead of `JSON.parse(JSON.stringify())` for deep cloning

### Render Loop Hygiene

- Never access the DOM (classList, getBoundingClientRect, querySelector, etc.) in the render loop — cache DOM state as a JS boolean on change, check the boolean per-frame
- Remove unused imports — they add confusion and may pull in unnecessary modules
- The render loop should only contain GPU-relevant work and state updates
