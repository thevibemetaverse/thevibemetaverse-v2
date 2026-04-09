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
  PORTAL_LABEL_Y_OFFSET_RATIO,
  PORTAL_PIETER_X,
  PORTAL_GLOBAL_X_OFFSET,
  PLAYER_SPAWN_Z,
  PORTAL_RETURN_Z,
} from './constants.js';
import { createTorusPortal, animateTorusPortal } from './portal-meshes.js';
import { checkProximity } from './portal-proximity.js';
import { gltfLoader } from './loader.js';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';
const PORTAL_V2_MODEL_PATH = 'assets/models/portal-v2.glb';

const portalClock = new THREE.Clock();
let portals = [];
let customRefPortal = null;
let pieterPortal = null;
let _player = null;

/** Load the portal-v2 GLB once and return the scene. */
function loadPortalModel() {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      PORTAL_V2_MODEL_PATH,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => {
        console.warn('[Portals] Failed to load portal-v2 model:', err);
        resolve(null);
      }
    );
  });
}

/**
 * Replace the procedural SDK portal visuals in a group with a clone of the GLB model.
 * Keeps the label sprite and a compatible portalMat for the update loop.
 */
function replacePortalWithModel(group, sourceModel) {
  // Preserve the label sprite (last child is typically the sprite)
  const label = [];
  group.traverse((child) => {
    if (child.isSprite) label.push(child);
  });

  // Dispose existing procedural resources
  const res = group.userData._portalResources;
  if (res) {
    res.portalGeo?.dispose();
    res.portalMat?.dispose();
    res.tex?.dispose();
    res.spriteMat?.dispose();
    delete group.userData._portalResources;
  }

  // Remove all children
  while (group.children.length) group.remove(group.children[0]);

  // Measure the replacement model before adding it to a transformed parent.
  const clone = sourceModel.clone();
  const bounds = new THREE.Box3().setFromObject(clone);
  const modelHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const labelY = bounds.max.y + modelHeight * PORTAL_LABEL_Y_OFFSET_RATIO;

  // Add GLB clone
  group.add(clone);

  // Re-add label sprites
  for (const s of label) {
    s.position.set(0, labelY, 0);
    group.add(s);
  }

  // Keep a dummy portalMat so the update loop doesn't error
  group.userData.portalMat = {
    uniforms: { time: { value: 0 } },
  };
}

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

  // Load portal-v2 model and registry in parallel
  const [portalModel, registryResult] = await Promise.all([
    loadPortalModel(),
    fetchPortalsRegistry(PORTALS_URL).catch((err) => {
      console.warn('[Portals] Could not load portals.json:', err);
      return [];
    }),
  ]);
  let data = registryResult;

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

  // Scatter portals in deterministic pseudo-random positions (seeded PRNG)
  const PORTAL_SCALE = 7.5;
  const SCATTER_MIN = 60;
  const SCATTER_MAX = 220;
  const MIN_SEPARATION = 40;
  const spawnPos = new THREE.Vector3(0, 0, PLAYER_SPAWN_Z);
  const placedPositions = [];

  // Simple seeded PRNG (mulberry32) — same seed = same layout every time
  let seed = 48271;
  function seededRandom() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  for (let i = 0; i < portals.length; i++) {
    let x, z, tooClose;
    let attempts = 0;
    do {
      const angle = seededRandom() * Math.PI * 2;
      const dist = SCATTER_MIN + seededRandom() * (SCATTER_MAX - SCATTER_MIN);
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
      tooClose = placedPositions.some(
        (p) => Math.hypot(p.x - x, p.z - z) < MIN_SEPARATION
      );
      attempts++;
    } while (tooClose && attempts < 50);

    placedPositions.push({ x, z });
    portals[i].group.scale.setScalar(PORTAL_SCALE);
    portals[i].group.position.set(x, PORTAL_PIETER_ELEVATION_Y, z);
    portals[i].group.lookAt(spawnPos.x, PORTAL_PIETER_ELEVATION_Y, spawnPos.z);
  }

  // Replace SDK procedural portal visuals with the GLB model
  if (portalModel) {
    for (const portal of portals) {
      replacePortalWithModel(portal.group, portalModel);
    }
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
