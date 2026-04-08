// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_TARGET_HEIGHT } from './constants.js';

const NAMETAG_Y = PLAYER_TARGET_HEIGHT + 1.0;
const CANVAS_W = 512;
const CANVAS_H = 64;
const FONT = 'bold 36px Courier New, monospace';
const SPRITE_SCALE_X = 8;
const SPRITE_SCALE_Y = 1;

/**
 * Draw name text onto a canvas and return it.
 * @param {string} name
 * @param {HTMLCanvasElement} [existingCanvas]
 * @returns {HTMLCanvasElement}
 */
function renderNameCanvas(name, existingCanvas) {
  const canvas = existingCanvas || document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const displayName = name || 'metaverse-explorer';
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Black outline
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeText(displayName, CANVAS_W / 2, CANVAS_H / 2);

  // White fill
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayName, CANVAS_W / 2, CANVAS_H / 2);

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

export function initNametag() {
  const input = /** @type {HTMLInputElement} */ (
    document.getElementById('player-name-input')
  );
  if (!input) return;

  // Create local player nametag
  localNametag = createNametagSprite(state.localPlayerName);
  if (state.player) {
    state.player.add(localNametag);
  }

  // Live update as user types
  input.addEventListener('input', () => {
    const name = input.value.trim() || 'metaverse-explorer';
    state.localPlayerName = name;
    if (localNametag) {
      updateNametagText(localNametag, name);
    }
    // Broadcast name change
    import('./multiplayer.js')
      .then((m) => m.notifyLocalNameChanged())
      .catch(() => {});
  });
}
