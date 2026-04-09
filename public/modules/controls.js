import { state } from './state.js';
import { CAMERA_ORBIT_SENSITIVITY } from './constants.js';

function clearStuckInput() {
  state.keys = {};
  state.isPointerDown = false;
}

export function setupPlayerControls() {
  // BFCache restore (e.g. back from a portal): keyup never fired for held keys
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) clearStuckInput();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (state.gameState === 'EXPLORING' || state.gameState === 'IN_ROOM') {
      state.keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
  });

  state.renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && (state.gameState === 'EXPLORING' || state.gameState === 'IN_ROOM')) state.isPointerDown = true;
  });
  window.addEventListener('pointerup', () => {
    state.isPointerDown = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!state.isPointerDown) return;
    state.orbitAngle -= e.movementX * CAMERA_ORBIT_SENSITIVITY;
  });
}
