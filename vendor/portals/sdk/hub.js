/**
 * Hub layout helpers — e.g. The Vibe Metaverse showing a row of portals to other games.
 */

import { createPortalMesh } from '../portal-mesh.js';

/**
 * Place registry entries in a horizontal row (centered on X, facing origin).
 *
 * @param {THREE.Scene} scene
 * @param {Array<{ slug: string, title?: string, [k: string]: unknown }>} entries
 * @param {object} [options]
 * @param {number} [options.rowZ=-10]
 * @param {number} [options.spacing=6]
 * @returns {Array<{ data: object, group: THREE.Group }>}
 */
export function spawnPortalRow(scene, entries, options = {}) {
  const rowZ = options.rowZ ?? -10;
  const spacing = options.spacing ?? 6;
  const count = entries.length;
  if (count === 0) return [];

  const rowWidth = (count - 1) * spacing;
  const result = [];

  for (let i = 0; i < count; i++) {
    const portalData = entries[i];
    const x = -rowWidth / 2 + i * spacing;
    const group = createPortalMesh({
      label: portalData.title || portalData.slug,
      name: 'portal-' + portalData.slug,
    });
    group.position.set(x, 0, rowZ);
    group.lookAt(0, 0, 0);
    scene.add(group);
    result.push({ data: portalData, group });
  }

  return result;
}
