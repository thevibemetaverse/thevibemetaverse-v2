import * as THREE from 'three';
import { fetchPortalsRegistry, spawnPortalRow, buildPortalUrl } from '@vibe/portals';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';
/** World Z in front of spawn (0,0,0); negative Z is toward the camera look direction at load. */
const ROW_Z = -10;
const ROW_SPACING = 6;
const PROXIMITY_DIST = 6;
const ENTER_DIST = 2;

const portalClock = new THREE.Clock();
let portals = [];
let promptEl = null;
let navigating = false;
let _player = null;

// BFCache restore: navigating was left true when we navigated away
window.addEventListener('pageshow', (e) => {
  if (e.persisted) navigating = false;
});

export async function initPortals(scene, player) {
  _player = player;
  let data;
  try {
    data = await fetchPortalsRegistry(PORTALS_URL);
  } catch (err) {
    console.warn('[Portals] Could not load portals.json:', err);
    return;
  }

  if (!data || data.length === 0) return;

  portals = spawnPortalRow(scene, data, { rowZ: ROW_Z, spacing: ROW_SPACING });
}

export function updatePortals() {
  if (portals.length === 0) return;

  const elapsed = portalClock.getElapsedTime();
  let nearest = null;
  let nearestDist = Infinity;

  for (const portal of portals) {
    portal.group.userData.portalMat.uniforms.time.value = elapsed;

    if (_player) {
      const worldPos = new THREE.Vector3();
      portal.group.getWorldPosition(worldPos);
      const dist = _player.position.distanceTo(worldPos);
      if (dist < PROXIMITY_DIST && dist < nearestDist) {
        nearest = portal;
        nearestDist = dist;
      }
    }
  }

  if (nearest && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering ' + (nearest.data.title || nearest.data.slug) + '...';
    promptEl.style.display = 'block';

    // Walk-in trigger: navigate when player reaches the portal
    if (nearestDist < ENTER_DIST) {
      navigating = true;
      const portal = nearest;
      promptEl.textContent = 'Entering ' + (portal.data.title || portal.data.slug) + '...';
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
