import { state } from './state.js';
import { openPrompt, closePrompt, submitPrompt } from './prompt.js';

export function setupPlayerControls() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (state.gameState === 'EXPLORING' && state.promptsRemaining > 0) openPrompt();
      return;
    }
    if (e.code === 'Escape') {
      if (state.gameState === 'PROMPTING') closePrompt();
      return;
    }
    if (state.gameState === 'EXPLORING') {
      state.keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
  });

  // Prompt input: Enter to submit
  state.dom.promptInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') {
      e.preventDefault();
      submitPrompt();
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      closePrompt();
    }
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
