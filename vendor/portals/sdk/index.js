/**
 * @vibe/portals — SDK for the Vibe Portal Network.
 *
 * - **Mesh** — same swirl / label look everywhere (any Three.js game).
 * - **Registry** — fetch `/portals.json` and build handoff URLs.
 * - **Hub** — optional row layout for metaverse-style hubs.
 *
 * High-level single-portal helper for *other* games: import from `@vibe/portals/embed`
 * (or `embed.js` from your portals host).
 */

export { createPortalMesh, disposePortalMesh } from '../portal-mesh.js';
export { fetchPortalsRegistry, buildPortalUrl } from './registry.js';
export { spawnPortalRow, getPortalRowSlotX } from './hub.js';
export { PORTALS_PRODUCTION_ORIGIN } from './network.js';
