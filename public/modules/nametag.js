// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_TARGET_HEIGHT } from './constants.js';

const NAMETAG_Y = PLAYER_TARGET_HEIGHT + 1.0;
/** Fixed canvas width — never changes, so Three.js texture uploads stay stable. */
const CANVAS_W = 512;
const CANVAS_H = 80;
const FONT = 'bold 32px Courier New, monospace';
const SPRITE_SCALE_X = 8;
const SPRITE_SCALE_Y = 1.25;
const NAME_BROADCAST_DEBOUNCE_MS = 300;
const PAD_X = 24;
const PAD_Y = 8;
const RADIUS = 16;

/** 2D context used only for measureText — never the same canvas as the sprite texture. */
const measureCtx = document.createElement('canvas').getContext('2d');

/**
 * Measure text width on a dedicated canvas so metrics are never affected by the
 * same 2D context that backs a WebGL CanvasTexture (some browsers mis-report
 * width there, which clips long names and distorts the sprite).
 * @param {string} text
 */
function measureTextWidth(text) {
  if (!measureCtx) return 0;
  measureCtx.font = FONT;
  return measureCtx.measureText(text).width;
}

/**
 * Draw a rounded rectangle path.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw name text onto a canvas and return it.
 * @param {string} name
 * @param {HTMLCanvasElement} [existingCanvas]
 * @returns {HTMLCanvasElement}
 */
function renderNameCanvas(name, existingCanvas) {
  const canvas = existingCanvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  let displayName = name ?? '';
  let textW = measureTextWidth(displayName);

  // Truncate with ellipsis if text exceeds available space.
  const maxTextW = CANVAS_W - PAD_X * 2;
  if (textW > maxTextW) {
    const ellipsis = '…';
    let low = 0;
    let high = displayName.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = displayName.slice(0, mid) + ellipsis;
      if (measureTextWidth(candidate) <= maxTextW) low = mid;
      else high = mid - 1;
    }
    displayName = displayName.slice(0, low) + ellipsis;
    textW = measureTextWidth(displayName);
  }

  // Fixed canvas size — never changes, avoiding Three.js texture resize issues.
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pillW = textW + PAD_X * 2;
  const pillH = CANVAS_H - PAD_Y * 2;
  const pillX = (CANVAS_W - pillW) / 2;
  const pillY = PAD_Y;

  // Pill background with subtle gradient
  roundRect(ctx, pillX, pillY, pillW, pillH, RADIUS);
  const grad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
  grad.addColorStop(0, 'rgba(30, 30, 40, 0.7)');
  grad.addColorStop(1, 'rgba(20, 20, 30, 0.55)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Thin border
  roundRect(ctx, pillX, pillY, pillW, pillH, RADIUS);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Text shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  // White text, always centered
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayName, CANVAS_W / 2, CANVAS_H / 2);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  return canvas;
}

/**
 * Create a sprite with a nametag texture.
 * @param {string} name
 * @returns {THREE.Sprite}
 */
export function createNametagSprite(name) {
  const canvas = renderNameCanvas(name);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SPRITE_SCALE_X, SPRITE_SCALE_Y, 1);
  sprite.position.set(0, NAMETAG_Y, 0);
  sprite.renderOrder = 999;
  return sprite;
}

/**
 * Update an existing nametag sprite's text.
 * @param {THREE.Sprite} sprite
 * @param {string} name
 */
export function updateNametagText(sprite, name) {
  const material = /** @type {THREE.SpriteMaterial} */ (sprite.material);
  const texture = /** @type {THREE.CanvasTexture} */ (material.map);
  renderNameCanvas(name, /** @type {HTMLCanvasElement} */ (texture.image));
  texture.needsUpdate = true;
}

/** @type {THREE.Sprite | null} */
let localNametag = null;

/**
 * Toggle local nametag visibility (e.g. hide in VR first-person).
 * @param {boolean} visible
 */
export function setLocalNametagVisible(visible) {
  if (localNametag) localNametag.visible = visible;
}

/**
 * @param {object} opts
 * @param {() => void} opts.onNameChanged - called when the local player name changes (debounced)
 */
export function initNametag({ onNameChanged }) {
  const input = /** @type {HTMLInputElement} */ (
    document.getElementById('player-name-input')
  );
  if (!input) return;

  input.value = state.localPlayerName;

  // Create local player nametag
  localNametag = createNametagSprite(state.localPlayerName);
  if (state.player) {
    state.player.add(localNametag);
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;

  // Live update as user types
  input.addEventListener('input', () => {
    const name = input.value.trim();
    state.localPlayerName = name;
    if (localNametag) {
      updateNametagText(localNametag, name);
    }
    // Debounce the network broadcast
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onNameChanged();
    }, NAME_BROADCAST_DEBOUNCE_MS);
  });
}
