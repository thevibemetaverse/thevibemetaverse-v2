import * as THREE from 'three';
import { fetchPortalsRegistry, spawnPortalRow } from '@vibe/portals';
import {
  PORTAL_ROW_Z,
  PORTAL_ROW_SPACING,
  PORTAL_PIETER_ELEVATION_Y,
  PORTAL_LABEL_Y_OFFSET_RATIO,
  PORTAL_GLB_LABEL_SCALE,
  PORTAL_PIETER_X,
  PORTAL_GLOBAL_X_OFFSET,
  PORTAL_VIEW_LEFT_BIAS_X,
  PLAYER_SPAWN_Z,
  PORTAL_RETURN_Z,
  PORTAL_SCALE,
  PORTAL_SCATTER_HALF_WIDTH,
  PORTAL_SCATTER_FRONT_MIN,
  PORTAL_SCATTER_FRONT_MAX,
  PORTAL_SCATTER_MIN_SEPARATION,
} from './constants.js';
import { createTorusPortal, animateTorusPortal } from './portal-meshes.js';
import { checkProximity } from './portal-proximity.js';
import { gltfLoader } from './loader.js';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';
const PORTALS_ORIGIN = 'https://portal.thevibemetaverse.com';
const PORTAL_V2_MODEL_PATH = 'assets/models/portal-v2.glb';

const textureLoader = new THREE.TextureLoader();
const portalClock = new THREE.Clock();
let portals = [];
let customRefPortal = null;
let pieterPortal = null;
let _player = null;

/** Inner disk in portal-v2.glb — named `PortalSurface` in the asset. */
function tintPortalSurface(root, colorHex, imageUrl) {
  const c = new THREE.Color(colorHex);
  root.traverse((child) => {
    if (!child.isMesh || child.name !== 'PortalSurface') return;
    // Clone materials so each portal gets its own instance
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => m.clone());
    } else {
      child.material = child.material.clone();
    }
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of materials) {
      if (mat?.color) mat.color.copy(c);
      if (mat?.emissive) mat.emissive.set(0x000000);
    }
    // Apply the portal image from the SDK registry as the surface texture
    if (imageUrl) {
      textureLoader.load(imageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = Array.isArray(child.material)
          ? child.material[0]
          : child.material;
        if (mat) {
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        }
      });
    }
  });
}

/** Load the portal-v2 GLB once and return the scene. */
function loadPortalModel() {
  return new Promise((resolve) => {
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
function replacePortalWithModel(group, sourceModel, imageUrl) {
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
  tintPortalSurface(clone, 0x000000, imageUrl);
  const bounds = new THREE.Box3().setFromObject(clone);
  const modelHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const labelY = bounds.max.y + modelHeight * PORTAL_LABEL_Y_OFFSET_RATIO;

  // Add GLB clone
  group.add(clone);

  // Re-add label sprites (boost scale vs tall GLB arch — see PORTAL_GLB_LABEL_SCALE)
  for (const s of label) {
    s.position.set(0, labelY, 0);
    s.scale.multiplyScalar(PORTAL_GLB_LABEL_SCALE);
    group.add(s);
  }

  // Keep a dummy portalMat so the update loop doesn't error
  group.userData.portalMat = {
    uniforms: { time: { value: 0 } },
  };
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

  const registryData = data.filter((p) => p.slug !== 'portal-network');
  // Scatter slot i follows registry order; reverse so last registry entries get earlier slots.
  registryData.reverse();

  // Strip portalImageUrl so the SDK doesn't try to load relative paths (404s).
  // We apply the images ourselves on the GLB PortalSurface after replacement.
  const rowEntries = registryData.map((p) => ({ ...p, portalImageUrl: '' }));
  portals = spawnPortalRow(scene, rowEntries, {
    rowZ: PORTAL_ROW_Z,
    spacing: PORTAL_ROW_SPACING,
  });

  // Pieter portal is anchored at a fixed X on the right.
  // Registry portals extend leftward from there.
  const pieterX =
    PORTAL_PIETER_X + PORTAL_GLOBAL_X_OFFSET + PORTAL_VIEW_LEFT_BIAS_X;
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

  // Scatter portals in deterministic pseudo-random positions (seeded PRNG),
  // biased into a band in front of spawn so they are visible sooner on load.
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
      const xOffset = (seededRandom() * 2 - 1) * PORTAL_SCATTER_HALF_WIDTH;
      const zOffset = -(
        PORTAL_SCATTER_FRONT_MIN +
        seededRandom() *
          (PORTAL_SCATTER_FRONT_MAX - PORTAL_SCATTER_FRONT_MIN)
      );
      x = spawnPos.x + xOffset + PORTAL_VIEW_LEFT_BIAS_X;
      z = spawnPos.z + zOffset;
      tooClose = placedPositions.some(
        (p) => Math.hypot(p.x - x, p.z - z) < PORTAL_SCATTER_MIN_SEPARATION
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
    for (let i = 0; i < portals.length; i++) {
      const imgPath = registryData[i]?.portalImageUrl;
      const imgUrl = imgPath
        ? new URL('PORTALS/' + imgPath, PORTALS_ORIGIN + '/').href
        : null;
      replacePortalWithModel(portals[i].group, portalModel, imgUrl);
    }
  }

  // Red return portal (?portal) — centered behind spawn, a few units along +Z.
  if (wantCustomPortal) {
    customRefPortal = createTorusPortal(scene, {
      color: 0xff0000,
      label: getReturnPortalLabel(),
      name: 'custom-ref-portal',
      position: new THREE.Vector3(
        PORTAL_GLOBAL_X_OFFSET + PORTAL_VIEW_LEFT_BIAS_X,
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
