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
import { state } from './state.js';

// Same-origin; Express proxies to PORTALS_SERVER.
const PORTALS_URL = '/portals.json';

const portalClock = new THREE.Clock();
let portals = [];
let customRefPortal = null;
let pieterPortal = null;
let _player = null;

/** @type {Map<string, {sprite: THREE.Sprite, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, texture: THREE.CanvasTexture, lastText: string}>} */
const portalInfoSprites = new Map();

const INFO_CANVAS_W = 256;
const INFO_CANVAS_H = 64;

function createInfoSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = INFO_CANVAS_W;
  canvas.height = INFO_CANVAS_H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6, 1.5, 1);
  sprite.renderOrder = 998;
  return { sprite, canvas, ctx, texture, lastText: '' };
}

function renderInfoCanvas(ctx, canvas, text) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 20px Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Background pill
  const metrics = ctx.measureText(text);
  const pillW = metrics.width + 24;
  const pillH = 36;
  const pillX = (canvas.width - pillW) / 2;
  const pillY = (canvas.height - pillH) / 2;
  const r = 10;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.lineTo(pillX + pillW - r, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
  ctx.lineTo(pillX + pillW, pillY + pillH - r);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
  ctx.lineTo(pillX + r, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
  ctx.lineTo(pillX, pillY + r);
  ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
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
  let data;
  try {
    data = await fetchPortalsRegistry(PORTALS_URL);
  } catch (err) {
    console.warn('[Portals] Could not load portals.json:', err);
    data = [];
  }

  // After async fetch, lobbyGroup may exist — add portals there so they hide with the lobby
  const parentContainer = state.lobbyGroup || scene;

  const wantCustomPortal = hasPortalQueryParam();
  data = (data || []).filter((p) => p.url && !isSameDocumentDestination(p.url));

  const hubExitEntry = data.find((p) => p.slug === 'portal-network');
  const registryData = data.filter((p) => p.slug !== 'portal-network');

  const leadingSlots = 0;
  const trailingSlots = hubExitEntry ? 1 : 0;
  const totalSlots = leadingSlots + registryData.length + trailingSlots;

  portals = spawnPortalRow(parentContainer, registryData, {
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
    parentContainer.add(group);
    portals.push({ data: hubExitEntry, group });
  }

  // Pieter portal is anchored at a fixed X on the right.
  // Registry portals extend leftward from there.
  const pieterX = PORTAL_PIETER_X + PORTAL_GLOBAL_X_OFFSET;
  pieterPortal = createTorusPortal(parentContainer, {
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

  // Create info sprites for registry portals showing player count + countdown
  for (let i = 0; i < portals.length; i++) {
    const portal = portals[i];
    const roomId = portal.data.slug || (portal.data.title || `portal-${i}`).replace(/\s+/g, '-').toLowerCase();
    const info = createInfoSprite();
    info.sprite.position.set(0, 3.5, 0); // above portal (in local group space, scaled)
    portal.group.add(info.sprite);
    portalInfoSprites.set(roomId, info);
  }

  // Info sprite for Pieter portal
  if (pieterPortal) {
    const info = createInfoSprite();
    info.sprite.position.set(0, 3.5, 0);
    pieterPortal.group.add(info.sprite);
    portalInfoSprites.set('vibeverse-portal', info);
  }

  // Red return portal (?portal) — centered behind spawn, a few units along +Z.
  if (wantCustomPortal) {
    customRefPortal = createTorusPortal(parentContainer, {
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

  // Update portal info sprites from room countdown data
  // Sprite keys are portal slugs (e.g. "portal-network") but roomCountdowns
  // uses unique IDs with a random suffix (e.g. "portal-network-g8s2aa").
  // Match by prefix to find the active room for each portal.
  for (const [slug, info] of portalInfoSprites) {
    let roomData = null;
    for (const [roomId, data] of state.roomCountdowns) {
      if (roomId === slug || roomId.startsWith(slug + '-')) {
        if (!roomData || data.playerCount > roomData.playerCount) {
          roomData = data;
        }
      }
    }
    let text;
    if (roomData && roomData.playerCount > 0) {
      const m = Math.floor(roomData.countdown / 60);
      const s = roomData.countdown % 60;
      text = `${roomData.playerCount}p | ${m}:${String(s).padStart(2, '0')}`;
    } else {
      text = '';
    }
    if (text !== info.lastText) {
      info.lastText = text;
      if (text) {
        renderInfoCanvas(info.ctx, info.canvas, text);
        info.texture.needsUpdate = true;
        info.sprite.visible = true;
      } else {
        info.sprite.visible = false;
      }
    }
  }

  // Proximity detection and navigation
  checkProximity(_player, customRefPortal, pieterPortal, portals);
}
