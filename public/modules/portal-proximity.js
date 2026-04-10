import * as THREE from 'three';
import { buildPortalUrl } from '@vibe/portals';
import {
  PORTAL_PROXIMITY_DIST,
  PORTAL_ENTER_DIST,
  PORTAL_CUSTOM_REF_ENTER_DIST,
  PLAYER_MOVE_SPEED,
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

// BFCache restore: navigating was left true when we navigated away
window.addEventListener('pageshow', (e) => {
  if (e.persisted) navigating = false;
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
  navigating = true;
  window.location.href = PIETER_PORTAL_URL + (paramString ? '?' + paramString : '');
}

function navigateToRegistryPortal(portal) {
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  const avatar = params.get('avatar_url');

  window.location.href = buildPortalUrl(portal.data, {
    username: username || undefined,
    avatarUrl: avatar || undefined,
    fromPortal: document.title || undefined,
  });
}

/**
 * Check player proximity to all portals and handle enter/navigation.
 * @param {THREE.Object3D} player
 * @param {object|null} customRefPortal
 * @param {object|null} pieterPortal
 * @param {Array} registryPortals
 */
export function checkProximity(player, customRefPortal, pieterPortal, registryPortals) {
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
      navigateToRefPortal();
    }
  } else if (best?.kind === 'pieter' && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering Vibeverse portal...';
    promptEl.style.display = 'block';
    if (best.dist < PORTAL_CUSTOM_REF_ENTER_DIST) {
      navigateToPieterPortal();
    }
  } else if (best?.kind === 'registry' && best.portal && !navigating) {
    ensurePrompt();
    promptEl.textContent =
      'Entering ' + (best.portal.data.title || best.portal.data.slug) + '...';
    promptEl.style.display = 'block';

    if (best.dist < PORTAL_ENTER_DIST) {
      navigating = true;
      promptEl.textContent =
        'Entering ' + (best.portal.data.title || best.portal.data.slug) + '...';
      navigateToRegistryPortal(best.portal);
    }
  } else if (promptEl) {
    promptEl.style.display = 'none';
  }
}
