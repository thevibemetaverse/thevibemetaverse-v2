import * as THREE from 'three';
import { buildPortalUrl } from '@vibe/portals';
import {
  PORTAL_PROXIMITY_DIST,
  PORTAL_ENTER_DIST,
  PORTAL_CUSTOM_REF_ENTER_DIST,
  PLAYER_MOVE_SPEED,
  PLAYER_SPAWN_Z,
  DEFAULT_PLAYER_NAME,
} from './constants.js';

const PIETER_PORTAL_URL = 'https://portal.pieter.com';

/** Ground-plane distance — portal groups are elevated in Y, so 3D distance never matches tuning. */
function distanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

let promptEl = null;
let navigating = false;
/** Set after BFCache restore — tells the next checkProximity call to teleport player to spawn. */
let pendingRespawn = false;
/** Timestamp (ms) until which portal checks are suppressed (cooldown after respawn). */
let cooldownUntil = 0;

// BFCache restore: player is still near the portal — flag a respawn + cooldown so we
// don't immediately re-trigger navigation.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    navigating = false;
    pendingRespawn = true;
    cooldownUntil = performance.now() + 1500; // 1.5s grace period
  }
});

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

/** Distance to place the player in front of the portal after using it. */
const PORTAL_RESPAWN_OFFSET = 12;

/** Open a portal URL in a new tab and respawn the player in front of the portal. */
function openPortalAndRespawn(url, portalGroup) {
  navigating = true;
  window.open(url, '_blank');
  // Place player a short distance in front of the portal (along its forward/facing direction)
  if (_player && portalGroup) {
    const portalPos = new THREE.Vector3();
    portalGroup.getWorldPosition(portalPos);
    // Portals face toward spawn — their -Z local axis points at the player.
    // Get the portal's forward direction and offset the player along it.
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(portalGroup.quaternion).normalize();
    _player.position.set(
      portalPos.x + forward.x * PORTAL_RESPAWN_OFFSET,
      0,
      portalPos.z + forward.z * PORTAL_RESPAWN_OFFSET
    );
  } else if (_player) {
    _player.position.set(0, 0, PLAYER_SPAWN_Z);
  }
  cooldownUntil = performance.now() + 2000;
  if (promptEl) promptEl.style.display = 'none';
  // Allow portal checks again after cooldown
  setTimeout(() => { navigating = false; }, 2000);
}

/** @type {THREE.Object3D|null} */
let _player = null;

/** Store reference to player for respawn after portal use. */
export function setPortalPlayer(player) {
  _player = player;
}

function navigateToRefPortal(_portalGroup) {
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
  const dest = url + (paramString ? '?' + paramString : '');
  navigating = true;
  if (promptEl) promptEl.style.display = 'none';
  window.location.href = dest;
}

function navigateToPieterPortal(portalGroup) {
  const currentParams = new URLSearchParams(window.location.search);
  const newParams = new URLSearchParams();
  newParams.append('portal', 'true');
  newParams.append(
    'username',
    currentParams.get('username') || DEFAULT_PLAYER_NAME
  );
  newParams.append('color', 'white');
  newParams.append('speed', String(PLAYER_MOVE_SPEED));
  for (const [key, value] of currentParams) {
    newParams.append(key, value);
  }
  newParams.set(
    'from_portal',
    document.title || document.location.hostname || 'The Vibe Metaverse'
  );
  const paramString = newParams.toString();
  openPortalAndRespawn(PIETER_PORTAL_URL + (paramString ? '?' + paramString : ''), portalGroup);
}

function navigateToRegistryPortal(portal) {
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  const avatar = params.get('avatar_url');

  openPortalAndRespawn(buildPortalUrl(portal.data, {
    username: username || undefined,
    avatarUrl: avatar || undefined,
    fromPortal: document.title || undefined,
  }), portal.group);
}

/**
 * Check player proximity to all portals and handle enter/navigation.
 * @param {THREE.Object3D} player
 * @param {object|null} customRefPortal
 * @param {object|null} pieterPortal
 * @param {Array} registryPortals
 */
export function checkProximity(player, customRefPortal, pieterPortal, registryPortals) {
  // After BFCache restore, teleport player back to spawn so they aren't inside a portal.
  if (pendingRespawn && player) {
    player.position.set(0, 0, PLAYER_SPAWN_Z);
    pendingRespawn = false;
  }

  // Suppress portal checks during cooldown (prevents instant re-trigger after respawn).
  if (performance.now() < cooldownUntil) {
    if (promptEl) promptEl.style.display = 'none';
    return;
  }

  const worldPos = new THREE.Vector3();

  let refDist = Infinity;
  if (player && customRefPortal) {
    customRefPortal.group.getWorldPosition(worldPos);
    refDist = distanceXZ(player.position, worldPos);
  }

  let pieterDist = Infinity;
  if (player && pieterPortal) {
    pieterPortal.group.getWorldPosition(worldPos);
    pieterDist = distanceXZ(player.position, worldPos);
  }

  let nearestRegistry = null;
  let nearestRegistryDist = Infinity;

  for (const portal of registryPortals) {
    if (player) {
      portal.group.getWorldPosition(worldPos);
      const dist = distanceXZ(player.position, worldPos);
      if (dist < nearestRegistryDist) {
        nearestRegistryDist = dist;
        nearestRegistry = portal;
      }
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const refUrl = urlParams.get('ref');
  const fromPortalName = urlParams.get('from_portal');
  const candidates = [];
  if (customRefPortal && refUrl && refDist < PORTAL_PROXIMITY_DIST) {
    candidates.push({ kind: 'ref', dist: refDist });
  }
  if (pieterPortal && pieterDist < PORTAL_PROXIMITY_DIST) {
    candidates.push({ kind: 'pieter', dist: pieterDist });
  }
  if (nearestRegistry && nearestRegistryDist < PORTAL_PROXIMITY_DIST) {
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
    promptEl.textContent = fromPortalName
      ? `Returning to ${fromPortalName}…`
      : 'Entering portal…';
    promptEl.style.display = 'block';
    if (best.dist < PORTAL_CUSTOM_REF_ENTER_DIST) {
      navigateToRefPortal(customRefPortal.group);
    }
  } else if (best?.kind === 'pieter' && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering Vibeverse portal...';
    promptEl.style.display = 'block';
    if (best.dist < PORTAL_CUSTOM_REF_ENTER_DIST) {
      navigateToPieterPortal(pieterPortal.group);
    }
  } else if (best?.kind === 'registry' && best.portal && !navigating) {
    ensurePrompt();
    promptEl.textContent =
      'Entering ' + (best.portal.data.title || best.portal.data.slug) + '...';
    promptEl.style.display = 'block';

    if (best.dist < PORTAL_ENTER_DIST) {
      navigateToRegistryPortal(best.portal);
    }
  } else if (promptEl) {
    promptEl.style.display = 'none';
  }
}
