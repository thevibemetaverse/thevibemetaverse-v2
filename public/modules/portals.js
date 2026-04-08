import * as THREE from 'three';
import {
  fetchPortalsRegistry,
  spawnPortalRow,
  createPortalMesh,
} from '@vibe/portals';
import {
  PORTAL_HALLWAY_START_Z,
  PORTAL_HALLWAY_DEPTH_STEP,
  PORTAL_HALLWAY_LANE_HALF,
  PORTAL_ROW_OFFSET_X,
  PORTAL_PIETER_ELEVATION_Y,
  PORTAL_PIETER_TERMINAL_GAP,
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

function hasPortalQueryParam() {
  return new URLSearchParams(window.location.search).get('portal') != null;
}

/**
 * Milliseconds since registration for ordering — oldest first (closest to spawn).
 * Entries without `registeredAt` / `updatedAt` sort last.
 * @param {{ registeredAt?: string, updatedAt?: string }} p
 */
function portalRegisteredTimeMs(p) {
  const raw = p.registeredAt || p.updatedAt;
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  return Number.POSITIVE_INFINITY;
}

/** Oldest API entries first so they sit nearest the player along the hallway. */
function sortRegistryOldestFirst(entries) {
  return [...entries].sort(
    (a, b) => portalRegisteredTimeMs(a) - portalRegisteredTimeMs(b)
  );
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

/**
 * Two parallel lines along -Z: even index left (-X), odd index right (+X).
 * Pieter’s portal is placed past the end, centered on X.
 */
function layoutHallwayPortals() {
  const PORTAL_SCALE = 2.5;
  const y = PORTAL_PIETER_ELEVATION_Y;

  const centerX = PORTAL_ROW_OFFSET_X;
  for (let i = 0; i < portals.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = centerX + side * PORTAL_HALLWAY_LANE_HALF;
    const z = PORTAL_HALLWAY_START_Z - i * PORTAL_HALLWAY_DEPTH_STEP;
    portals[i].group.scale.setScalar(PORTAL_SCALE);
    portals[i].group.position.set(x, y, z);
    // Circle mesh faces +Z; rotate ±90° on Y only so left/right lanes face each other.
    if (i % 2 === 0) {
      portals[i].group.rotation.set(0, Math.PI / 2, 0);
    } else {
      portals[i].group.rotation.set(0, -Math.PI / 2, 0);
    }
  }

  const pieterZ =
    PORTAL_HALLWAY_START_Z -
    portals.length * PORTAL_HALLWAY_DEPTH_STEP -
    PORTAL_PIETER_TERMINAL_GAP;

  if (pieterPortal) {
    pieterPortal.group.position.set(PORTAL_ROW_OFFSET_X, y, pieterZ);
  }

  if (customRefPortal) {
    customRefPortal.group.position.set(PORTAL_ROW_OFFSET_X, y, PORTAL_RETURN_Z);
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

  const registryData = sortRegistryOldestFirst(data);

  portals = spawnPortalRow(scene, registryData, {
    rowZ: PORTAL_HALLWAY_START_Z,
    spacing: PORTAL_HALLWAY_DEPTH_STEP,
    leadingSlots: 0,
    trailingSlots: 0,
  });

  pieterPortal = createTorusPortal(scene, {
    color: 0x00ff00,
    label: 'VIBEVERSE PORTAL',
    name: 'pieter-portal',
    position: new THREE.Vector3(
      PORTAL_ROW_OFFSET_X,
      PORTAL_PIETER_ELEVATION_Y,
      PORTAL_HALLWAY_START_Z
    ),
  });

  if (wantCustomPortal) {
    customRefPortal = createTorusPortal(scene, {
      color: 0xff0000,
      label: 'CUSTOM PORTAL',
      name: 'custom-ref-portal',
      position: new THREE.Vector3(
        PORTAL_ROW_OFFSET_X,
        PORTAL_PIETER_ELEVATION_Y,
        PORTAL_RETURN_Z
      ),
    });
  }

  layoutHallwayPortals();
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
