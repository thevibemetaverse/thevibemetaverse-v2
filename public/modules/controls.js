import { state } from './state.js';

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
    if (state.gameState === 'EXPLORING') {
      state.keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
  });

  state.renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && state.gameState === 'EXPLORING') state.isPointerDown = true;
  });
  window.addEventListener('pointerup', () => {
    state.isPointerDown = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!state.isPointerDown) return;
    state.orbitAngle -= e.movementX * 0.006;
  });
}
