import * as THREE from 'three';
import {
  fetchPortalsRegistry,
  spawnPortalRow,
  createPortalMesh,
} from '@vibe/portals';
import {
  PORTAL_ROW_Z,
  PORTAL_ROW_SPACING,
  PORTAL_ROW_OFFSET_X,
  PORTAL_PIETER_TORUS_EXTRA_X,
  PORTAL_PIETER_ELEVATION_Y,
  PORTAL_PIETER_X,
} from './constants.js';
import { createTorusPortal, animateTorusPortal } from './portal-meshes.js';
import { checkProximity } from './portal-proximity.js';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';

const portalClock = new THREE.Clock();
let portals = [];
let customRefPortal = null;
let pieterPortal = null;
let _player = null;

/** Same X layout as `spawnPortalRow` in the SDK. */
function portalRowSlotX(slotIndex, totalSlots, spacing = PORTAL_ROW_SPACING) {
  const rowWidth = totalSlots <= 1 ? 0 : (totalSlots - 1) * spacing;
  return -rowWidth / 2 + slotIndex * spacing;
}

function hasPortalQueryParam() {
  return new URLSearchParams(window.location.search).get('portal') != null;
}

/** Registry entries that point at this same page cause a reload loop. */
function isSameDocumentDestination(portalUrl) {
  if (!portalUrl || typeof portalUrl !== 'string') return true;
  try {
    const dest = new URL(portalUrl, window.location.href);
    const here = new URL(window.location.href);
    const dPath = dest.pathname.replace(/\/$/, '') || '/';
    const hPath = here.pathname.replace(/\/$/, '') || '/';
    return dest.origin === here.origin && dPath === hPath;
  } catch {
    return true;
  }
}

export async function initPortals(scene, player) {
  _player = player;
  let data;
  try {
    data = await fetchPortalsRegistry(PORTALS_URL);
  } catch (err) {
    console.warn('[Portals] Could not load portals.json:', err);
    data = [];
  }

  const wantCustomPortal = hasPortalQueryParam();
  data = (data || []).filter((p) => p.url && !isSameDocumentDestination(p.url));

  const hubExitEntry = data.find((p) => p.slug === 'portal-network');
  const registryData = data.filter((p) => p.slug !== 'portal-network');

  const leadingSlots = 0;
  const trailingSlots = hubExitEntry ? 1 : 0;
  const totalSlots = leadingSlots + registryData.length + trailingSlots;

  portals = spawnPortalRow(scene, registryData, {
    rowZ: PORTAL_ROW_Z,
    spacing: PORTAL_ROW_SPACING,
    leadingSlots,
    trailingSlots,
  });

  const hubSlotIndex = leadingSlots + registryData.length;

  if (hubExitEntry) {
    const group = createPortalMesh({
      label: hubExitEntry.title || hubExitEntry.slug,
      name: 'portal-' + hubExitEntry.slug,
    });
    scene.add(group);
    portals.push({ data: hubExitEntry, group });
  }

  // Position and scale all portals in a flat row
  const PORTAL_SCALE = 2.5;
  for (let i = 0; i < portals.length; i++) {
    const slotIndex = i < registryData.length ? i : hubSlotIndex;
    const x =
      portalRowSlotX(slotIndex, totalSlots, PORTAL_ROW_SPACING) +
      PORTAL_ROW_OFFSET_X;
    portals[i].group.scale.setScalar(PORTAL_SCALE);
    portals[i].group.position.set(x, PORTAL_PIETER_ELEVATION_Y, PORTAL_ROW_Z);
    portals[i].group.lookAt(0, PORTAL_PIETER_ELEVATION_Y, 0);
  }

  // Green Vibeverse portal — place in the slot *after* the hub row so it never stacks on the hub
  // (previously PORTAL_PIETER_X - PORTAL_ROW_SPACING matched the rightmost hub slot).
  const pieterX =
    portalRowSlotX(totalSlots, totalSlots + 1, PORTAL_ROW_SPACING) +
    PORTAL_ROW_OFFSET_X +
    PORTAL_PIETER_TORUS_EXTRA_X;
  pieterPortal = createTorusPortal(scene, {
    color: 0x00ff00,
    label: 'VIBEVERSE PORTAL',
    name: 'pieter-portal',
    position: new THREE.Vector3(
      pieterX,
      PORTAL_PIETER_ELEVATION_Y,
      PORTAL_ROW_Z
    ),
  });

  // Red custom return portal (only when ?portal is set)
  if (wantCustomPortal) {
    customRefPortal = createTorusPortal(scene, {
      color: 0xff0000,
      label: 'CUSTOM PORTAL',
      name: 'custom-ref-portal',
      position: new THREE.Vector3(
        PORTAL_PIETER_X + PORTAL_ROW_OFFSET_X,
        PORTAL_PIETER_ELEVATION_Y,
        PORTAL_ROW_Z
      ),
    });
  }
}

export function updatePortals() {
  const elapsed = portalClock.getElapsedTime();

  // Animate torus particle effects
  if (customRefPortal) animateTorusPortal(customRefPortal, elapsed);
  if (pieterPortal) animateTorusPortal(pieterPortal, elapsed);

  // Animate SDK portal shader uniforms
  for (const portal of portals) {
    portal.group.userData.portalMat.uniforms.time.value = elapsed;
  }

  // Proximity detection and navigation
  checkProximity(_player, customRefPortal, pieterPortal, portals);
}
