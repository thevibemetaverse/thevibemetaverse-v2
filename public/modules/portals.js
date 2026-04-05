import * as THREE from 'three';
import {
  fetchPortalsRegistry,
  spawnPortalRow,
  buildPortalUrl,
  createPortalMesh,
} from '@vibe/portals';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';
/** World Z in front of spawn (0,0,0); negative Z is toward the camera look direction at load. */
const ROW_Z = -10;
const ROW_SPACING = 6;

/** Same X layout as `spawnPortalRow` in the SDK (local copy — avoids relying on SDK export surface). */
function portalRowSlotX(slotIndex, totalSlots, spacing = ROW_SPACING) {
  const rowWidth = totalSlots <= 1 ? 0 : (totalSlots - 1) * spacing;
  return -rowWidth / 2 + slotIndex * spacing;
}

const PROXIMITY_DIST = 6;
const ENTER_DIST = 2;
/** Matches scaled torus outer radius (~15 * scale) for walk-in. */
const CUSTOM_REF_ENTER_DIST = 2.8;

const PIETER_PORTAL_URL = 'https://portal.pieter.com';
/** Matches `player.js` move speed (units/sec) for handoff query param. */
const PLAYER_MOVE_SPEED = 14;
/** Lift the Pieter mesh so the torus is not half-buried in the ground plane. */
const PIETER_ELEVATION_Y = 1.65;
/** Fixed world X for the Pieter (Vibeverse) torus — positive = to the right of the centered row (not in the row). */
const PIETER_PORTAL_X = 22;
/** Same depth as the dynamic portal row ({@link ROW_Z}). */
const PIETER_PORTAL_Z = ROW_Z;
/** When `?portal` is set: red return portal is this many units along X from the Pieter torus (same Z). */
const CUSTOM_REF_PORTAL_OFFSET_X = -ROW_SPACING;

const portalClock = new THREE.Clock();
let portals = [];
/** When `?portal` is set: red custom portal beside Pieter + ref navigation */
let customRefPortal = null;
/** Green torus portal at end of row → portal.pieter.com */
let pieterPortal = null;
let promptEl = null;
let navigating = false;
let _player = null;

function hasPortalQueryParam() {
  return new URLSearchParams(window.location.search).get('portal') != null;
}

/**
 * Red torus + particles portal (scaled like Pieter). Fixed beside {@link PIETER_PORTAL_X} when `?portal` is present.
 */
function createCustomRefPortal(scene) {
  const GROUP_SCALE = 0.11;
  const startPortalGroup = new THREE.Group();
  startPortalGroup.name = 'custom-ref-portal';
  const x = PIETER_PORTAL_X + CUSTOM_REF_PORTAL_OFFSET_X;
  startPortalGroup.position.set(x, PIETER_ELEVATION_Y, PIETER_PORTAL_Z);
  startPortalGroup.scale.setScalar(GROUP_SCALE);

  const startPortalGeometry = new THREE.TorusGeometry(15, 2, 16, 100);
  const startPortalMaterial = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    transparent: true,
    opacity: 0.8,
  });
  const startPortal = new THREE.Mesh(startPortalGeometry, startPortalMaterial);
  startPortalGroup.add(startPortal);

  const startPortalInnerGeometry = new THREE.CircleGeometry(13, 32);
  const startPortalInnerMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const startPortalInner = new THREE.Mesh(startPortalInnerGeometry, startPortalInnerMaterial);
  startPortalGroup.add(startPortalInner);

  const startPortalParticleCount = 1000;
  const startPortalParticles = new THREE.BufferGeometry();
  const startPortalPositions = new Float32Array(startPortalParticleCount * 3);
  const basePositions = new Float32Array(startPortalParticleCount * 3);
  const startPortalColors = new Float32Array(startPortalParticleCount * 3);

  for (let i = 0; i < startPortalParticleCount * 3; i += 3) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 15 + (Math.random() - 0.5) * 4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 4;
    startPortalPositions[i] = basePositions[i] = x;
    startPortalPositions[i + 1] = basePositions[i + 1] = y;
    startPortalPositions[i + 2] = basePositions[i + 2] = z;
    startPortalColors[i] = 0.8 + Math.random() * 0.2;
    startPortalColors[i + 1] = 0;
    startPortalColors[i + 2] = 0;
  }

  startPortalParticles.setAttribute('position', new THREE.BufferAttribute(startPortalPositions, 3));
  startPortalParticles.setAttribute('color', new THREE.BufferAttribute(startPortalColors, 3));

  const startPortalParticleMaterial = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
  });

  const startPortalParticleSystem = new THREE.Points(startPortalParticles, startPortalParticleMaterial);
  startPortalGroup.add(startPortalParticleSystem);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff3333';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CUSTOM PORTAL', 256, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const labelGeometry = new THREE.PlaneGeometry(30, 5);
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const label = new THREE.Mesh(labelGeometry, labelMaterial);
  label.position.y = 20;
  startPortalGroup.add(label);

  scene.add(startPortalGroup);

  return {
    group: startPortalGroup,
    particles: startPortalParticles,
    basePositions,
  };
}

/**
 * Green Pieter / Vibeverse exit portal (same mesh style as custom ref). Uses {@link PIETER_PORTAL_X} / {@link PIETER_PORTAL_Z}.
 */
function createPieterPortal(scene) {
  const GROUP_SCALE = 0.11;
  const g = new THREE.Group();
  g.name = 'pieter-portal';
  g.position.set(PIETER_PORTAL_X, PIETER_ELEVATION_Y, PIETER_PORTAL_Z);
  g.scale.setScalar(GROUP_SCALE);

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(15, 2, 16, 100),
    new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      transparent: true,
      opacity: 0.8,
    })
  );
  g.add(torus);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(13, 32),
    new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  g.add(inner);

  const n = 1000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  const basePositions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 3) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 15 + (Math.random() - 0.5) * 4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 4;
    positions[i] = basePositions[i] = x;
    positions[i + 1] = basePositions[i + 1] = y;
    positions[i + 2] = basePositions[i + 2] = z;
    colors[i] = 0;
    colors[i + 1] = 0.8 + Math.random() * 0.2;
    colors[i + 2] = 0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    })
  );
  g.add(pts);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#00ff00';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('VIBEVERSE PORTAL', canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 5),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  label.position.y = 20;
  g.add(label);

  scene.add(g);

  return {
    group: g,
    particles: geo,
    basePositions,
  };
}

function navigateToRefPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const refUrl = urlParams.get('ref');
  if (!refUrl) return;
  let url = refUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  const newParams = new URLSearchParams();
  for (const [key, value] of urlParams) {
    if (key !== 'ref') {
      newParams.append(key, value);
    }
  }
  const paramString = newParams.toString();
  navigating = true;
  window.location.href = url + (paramString ? '?' + paramString : '');
}

function navigateToPieterPortal() {
  const currentParams = new URLSearchParams(window.location.search);
  const newParams = new URLSearchParams();
  newParams.append('portal', 'true');
  newParams.append('username', currentParams.get('username') || 'guest');
  newParams.append('color', 'white');
  newParams.append('speed', String(PLAYER_MOVE_SPEED));
  for (const [key, value] of currentParams) {
    newParams.append(key, value);
  }
  const paramString = newParams.toString();
  navigating = true;
  window.location.href = PIETER_PORTAL_URL + (paramString ? '?' + paramString : '');
}

// BFCache restore: navigating was left true when we navigated away
window.addEventListener('pageshow', (e) => {
  if (e.persisted) navigating = false;
});

/** Registry entries that point at this same page cause a reload loop (see buildPortalUrl). */
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

  /** Layout: [sdk portals...] [hub_exit?] — Pieter + optional red ref are fixed off-row (see PIETER_PORTAL_*). */
  const leadingSlots = 0;
  const trailingSlots = hubExitEntry ? 1 : 0;
  const totalSlots = leadingSlots + registryData.length + trailingSlots;

  portals = spawnPortalRow(scene, registryData, {
    rowZ: ROW_Z,
    spacing: ROW_SPACING,
    leadingSlots,
    trailingSlots,
  });

  // Normalize SDK portal heights so they form a uniform row
  for (const portal of portals) {
    portal.group.position.y = PIETER_ELEVATION_Y;
    portal.group.lookAt(0, PIETER_ELEVATION_Y, 0);
  }

  const hubSlotIndex = leadingSlots + registryData.length;

  if (hubExitEntry) {
    const group = createPortalMesh({
      label: hubExitEntry.title || hubExitEntry.slug,
      name: 'portal-' + hubExitEntry.slug,
    });
    const x = portalRowSlotX(hubSlotIndex, totalSlots, ROW_SPACING);
    group.position.set(x, PIETER_ELEVATION_Y, ROW_Z);
    group.lookAt(0, PIETER_ELEVATION_Y, 0);
    scene.add(group);
    portals.push({ data: hubExitEntry, group });
  }

  pieterPortal = createPieterPortal(scene);

  if (wantCustomPortal) {
    customRefPortal = createCustomRefPortal(scene);
  }
}

export function updatePortals() {
  const elapsed = portalClock.getElapsedTime();
  const hasRegistryPortals = portals.length > 0;

  function animateTorusPortal(p) {
    const positions = p.particles.attributes.position.array;
    const base = p.basePositions;
    const t = elapsed * 2.2;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = base[i];
      positions[i + 1] = base[i + 1] + 0.05 * Math.sin(t + i * 0.01);
      positions[i + 2] = base[i + 2];
    }
    p.particles.attributes.position.needsUpdate = true;
  }

  if (customRefPortal) animateTorusPortal(customRefPortal);
  if (pieterPortal) animateTorusPortal(pieterPortal);

  const worldPos = new THREE.Vector3();
  let refDist = Infinity;
  if (_player && customRefPortal) {
    customRefPortal.group.getWorldPosition(worldPos);
    refDist = _player.position.distanceTo(worldPos);
  }

  let pieterDist = Infinity;
  if (_player && pieterPortal) {
    pieterPortal.group.getWorldPosition(worldPos);
    pieterDist = _player.position.distanceTo(worldPos);
  }

  let nearestRegistry = null;
  let nearestRegistryDist = Infinity;

  if (hasRegistryPortals) {
    for (const portal of portals) {
      portal.group.userData.portalMat.uniforms.time.value = elapsed;

      if (_player) {
        portal.group.getWorldPosition(worldPos);
        const dist = _player.position.distanceTo(worldPos);
        if (dist < nearestRegistryDist) {
          nearestRegistryDist = dist;
          nearestRegistry = portal;
        }
      }
    }
  }

  const refUrl = new URLSearchParams(window.location.search).get('ref');
  const candidates = [];
  if (customRefPortal && refUrl && refDist < PROXIMITY_DIST) {
    candidates.push({ kind: 'ref', dist: refDist });
  }
  if (pieterPortal && pieterDist < PROXIMITY_DIST) {
    candidates.push({ kind: 'pieter', dist: pieterDist });
  }
  if (nearestRegistry && nearestRegistryDist < PROXIMITY_DIST) {
    candidates.push({
      kind: 'registry',
      dist: nearestRegistryDist,
      portal: nearestRegistry,
    });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const best = candidates[0];

  if (best?.kind === 'ref' && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering custom portal...';
    promptEl.style.display = 'block';
    if (best.dist < CUSTOM_REF_ENTER_DIST) {
      navigateToRefPortal();
    }
  } else if (best?.kind === 'pieter' && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering Vibeverse portal...';
    promptEl.style.display = 'block';
    if (best.dist < CUSTOM_REF_ENTER_DIST) {
      navigateToPieterPortal();
    }
  } else if (best?.kind === 'registry' && best.portal && !navigating) {
    ensurePrompt();
    promptEl.textContent =
      'Entering ' + (best.portal.data.title || best.portal.data.slug) + '...';
    promptEl.style.display = 'block';

    if (best.dist < ENTER_DIST) {
      navigating = true;
      const portal = best.portal;
      promptEl.textContent =
        'Entering ' + (portal.data.title || portal.data.slug) + '...';
      navigateToPortal(portal);
    }
  } else if (promptEl) {
    promptEl.style.display = 'none';
  }
}

function ensurePrompt() {
  if (promptEl) return;
  promptEl = document.createElement('div');
  promptEl.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: #fff; font-family: 'Courier New', monospace; font-size: 16px;
    text-align: center; text-shadow: 0 0 12px rgba(127,219,255,0.8);
    background: rgba(0,0,0,0.7); padding: 10px 20px; border-radius: 8px;
    border: 1px solid rgba(127,219,255,0.5); z-index: 99999;
    pointer-events: none;
  `;
  document.body.appendChild(promptEl);
}

function navigateToPortal(portal) {
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  const avatar = params.get('avatar_url');

  window.location.href = buildPortalUrl(portal.data, {
    username: username || undefined,
    avatarUrl: avatar || undefined,
  });
}
