import * as THREE from 'three';
import {
  fetchPortalsRegistry,
  spawnPortalRow,
  createPortalMesh,
} from '@vibe/portals';
import {
  PORTAL_ROW_Z,
  PORTAL_ROW_SPACING,
  PORTAL_PIETER_ELEVATION_Y,
  PORTAL_PIETER_X,
  PORTAL_GLOBAL_X_OFFSET,
  PLAYER_SPAWN_Z,
  PORTAL_RETURN_Z,
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

/** Label for the red return torus — `from_portal` from handoff, else hostname from `ref`. */
function getReturnPortalLabel() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('from_portal')?.trim();
  if (explicit) return explicit;
  const ref = params.get('ref');
  if (ref) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      if (host) return host;
    } catch {
      /* ignore */
    }
  }
  return 'Return';
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

  // Pieter portal is anchored at a fixed X on the right.
  // Registry portals extend leftward from there.
  const pieterX = PORTAL_PIETER_X + PORTAL_GLOBAL_X_OFFSET;
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
  pieterPortal.group.lookAt(0, PORTAL_PIETER_ELEVATION_Y, PLAYER_SPAWN_Z);

  // Position and scale registry portals extending leftward from pieter portal
  const PORTAL_SCALE = 2.5;
  for (let i = 0; i < portals.length; i++) {
    const slotIndex = i < registryData.length ? i : hubSlotIndex;
    // Rightmost registry slot sits one spacing left of pieter; rest extend further left
    const x = pieterX - (totalSlots - slotIndex) * PORTAL_ROW_SPACING;
    portals[i].group.scale.setScalar(PORTAL_SCALE);
    portals[i].group.position.set(x, PORTAL_PIETER_ELEVATION_Y, PORTAL_ROW_Z);
    portals[i].group.lookAt(0, PORTAL_PIETER_ELEVATION_Y, PLAYER_SPAWN_Z);
  }

  // Red return portal (?portal) — centered behind spawn, a few units along +Z.
  if (wantCustomPortal) {
    customRefPortal = createTorusPortal(scene, {
      color: 0xff0000,
      label: getReturnPortalLabel(),
      name: 'custom-ref-portal',
      position: new THREE.Vector3(
        PORTAL_GLOBAL_X_OFFSET,
        PORTAL_PIETER_ELEVATION_Y,
        PORTAL_RETURN_Z
      ),
    });
    customRefPortal.group.lookAt(0, PORTAL_PIETER_ELEVATION_Y, PLAYER_SPAWN_Z);
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
