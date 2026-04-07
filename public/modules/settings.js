import { state } from './state.js';

let panel;
let fpsEl;
let frames = 0;
let lastTime = performance.now();

export function initSettings() {
  panel = document.getElementById('settings-panel');
  fpsEl = document.getElementById('fps-counter');
  const closeBtn = document.getElementById('settings-close');

  closeBtn.addEventListener('click', () => toggle(false));

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      toggle();
    }
  });
}

export function updateSettings() {
  if (panel.classList.contains('hidden')) return;
  frames++;
  const now = performance.now();
  if (now - lastTime >= 500) {
    const fps = Math.round((frames * 1000) / (now - lastTime));
    fpsEl.textContent = fps;
    frames = 0;
    lastTime = now;
  }
}

function toggle(force) {
  panel.classList.toggle('hidden', force !== undefined ? !force : undefined);
  if (!panel.classList.contains('hidden')) {
    frames = 0;
    lastTime = performance.now();
    fpsEl.textContent = '--';
  }
}
