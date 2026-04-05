/**
 * Hub layout helpers — e.g. The Vibe Metaverse showing a row of portals to other games.
 */

import { createPortalMesh } from '../portal-mesh.js';

/**
 * World X for a slot index in a row (same layout as {@link spawnPortalRow}).
 *
 * @param {number} slotIndex — 0-based index along the row
 * @param {number} totalSlots — Total slots including any leading reserved slots
 * @param {number} [spacing=6]
 */
export function getPortalRowSlotX(slotIndex, totalSlots, spacing = 6) {
  const rowWidth = totalSlots <= 1 ? 0 : (totalSlots - 1) * spacing;
  return -rowWidth / 2 + slotIndex * spacing;
}

/**
 * Place registry entries in a horizontal row (centered on X, facing origin).
 *
 * @param {THREE.Scene} scene
 * @param {Array<{ slug: string, title?: string, [k: string]: unknown }>} entries
 * @param {object} [options]
 * @param {number} [options.rowZ=-10]
 * @param {number} [options.spacing=6]
 * @param {number} [options.leadingSlots=0] — Extra indices reserved at the start (e.g. custom portal at slot 0)
 * @param {number} [options.trailingSlots=0] — Extra indices reserved at the end (e.g. fixed exit portal)
 * @returns {Array<{ data: object, group: THREE.Group }>}
 */
export function spawnPortalRow(scene, entries, options = {}) {
  const rowZ = options.rowZ ?? -10;
  const spacing = options.spacing ?? 6;
  const leadingSlots = options.leadingSlots ?? 0;
  const trailingSlots = options.trailingSlots ?? 0;
  const count = entries.length;
  const totalSlots = leadingSlots + count + trailingSlots;
  if (totalSlots === 0) return [];

  const rowWidth = totalSlots <= 1 ? 0 : (totalSlots - 1) * spacing;
  const result = [];

  for (let i = 0; i < count; i++) {
    const portalData = entries[i];
    const slotIndex = leadingSlots + i;
    const x = -rowWidth / 2 + slotIndex * spacing;
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
