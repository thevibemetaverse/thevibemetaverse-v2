import * as THREE from 'three';
import { buildPortalUrl } from '@vibe/portals';
import {
  PORTAL_PROXIMITY_DIST,
  PORTAL_ENTER_DIST,
  PORTAL_CUSTOM_REF_ENTER_DIST,
  PLAYER_MOVE_SPEED,
} from './constants.js';
import { enterRoom } from './meeting-room.js';

const PIETER_PORTAL_URL = 'https://portal.pieter.com';

/** Cached vector to avoid per-frame allocation in checkProximity. */
const _worldPos = new THREE.Vector3();

/** Fun metaverse-themed room name slugs. */
const ROOM_NAMES = [
  // Snow Crash
  'sweet-bby-rays',
  'hiro-protagonist',
  'yt',
  'raven',
  'juanita-marquez',
  'uncle-enzo',
  'lagos',
  'yts-mom',
  'black-sun',
  'the-street',
  'snow-crash',
  'metaball',
  'reason',
  'kourier',
  'mr-lee',
  'ng-security',
  'avatara',
  'da5id',
  'the-deliverator',
  'cosa-nostra-pizza',
  'rat-thing',
  'the-librarian',
  'burbclave',
  'franchise-ghetto',
  'vitaly-chernobyl',
  'enki',
  'babel',
  'brandy',
  // Metaverse culture
  'crypto-is-not-the-metaverse',
  'open-metaverse',
  'big-green-egg',
  'the-oasis',
  'the-matrix',
  'second-life-og',
  'club-penguin-walked-so-we-could-run',
  'habbo-hotel',
  'touch-grass',
];

/** Build a room ID that starts with the portal slug so sprite matching works. */
function uniqueRoomId(prefix) {
  const name = ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)];
  const rand = Math.random().toString(36).slice(2, 5);
  return `${prefix}-${name}-${rand}`;
}

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

function buildPieterPortalUrl() {
  const currentParams = new URLSearchParams(window.location.search);
  const newParams = new URLSearchParams();
  newParams.append('portal', 'true');
  newParams.append('username', currentParams.get('username') || 'guest');
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
  return PIETER_PORTAL_URL + (paramString ? '?' + paramString : '');
}

/**
 * Check player proximity to all portals and handle enter/navigation.
 * @param {THREE.Object3D} player
 * @param {object|null} customRefPortal
 * @param {object|null} pieterPortal
 * @param {Array} registryPortals
 */
export function checkProximity(player, customRefPortal, pieterPortal, registryPortals) {
  const worldPos = _worldPos;

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
    promptEl.textContent = 'Entering meeting room…';
    promptEl.style.display = 'block';
    if (best.dist < PORTAL_CUSTOM_REF_ENTER_DIST) {
      navigating = true;
      const roomId = uniqueRoomId('ref');
      if (promptEl) promptEl.style.display = 'none';
      enterRoom(roomId, refUrl.startsWith('http') ? refUrl : 'https://' + refUrl);
      navigating = false;
    }
  } else if (best?.kind === 'pieter' && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Entering meeting room…';
    promptEl.style.display = 'block';
    if (best.dist < PORTAL_CUSTOM_REF_ENTER_DIST) {
      navigating = true;
      if (promptEl) promptEl.style.display = 'none';
      const pieterUrl = buildPieterPortalUrl();
      enterRoom(uniqueRoomId('vibeverse'), pieterUrl);
      navigating = false;
    }
  } else if (best?.kind === 'registry' && best.portal && !navigating) {
    const portalTitle = best.portal.data.title || best.portal.data.slug;
    ensurePrompt();
    promptEl.textContent = 'Entering meeting room…';
    promptEl.style.display = 'block';

    if (best.dist < PORTAL_ENTER_DIST) {
      navigating = true;
      const gameUrl = buildPortalUrl(best.portal.data, {
        username: urlParams.get('username') || undefined,
        avatarUrl: urlParams.get('avatar_url') || undefined,
        fromPortal: document.title || undefined,
      });
      if (promptEl) promptEl.style.display = 'none';
      const slug = best.portal.data.slug || portalTitle.replace(/\s+/g, '-').toLowerCase();
      enterRoom(uniqueRoomId(slug), gameUrl, portalTitle);
      navigating = false;
    }
  } else if (promptEl) {
    promptEl.style.display = 'none';
  }
}
