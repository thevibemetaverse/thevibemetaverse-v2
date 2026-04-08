import { state } from './state.js';
import { COMMIT_HASH } from './version.js';

let panel;
let fpsEl;
let panelVisible = false;
let frames = 0;
let lastTime = performance.now();

export function initSettings() {
  panel = document.getElementById('settings-panel');
  fpsEl = document.getElementById('fps-counter');
  const closeBtn = document.getElementById('settings-close');
  const commitEl = document.getElementById('commit-hash');

  commitEl.textContent = COMMIT_HASH;
  closeBtn.addEventListener('click', () => toggle(false));

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      toggle();
    }
  });
}

export function updateSettings() {
  if (!panelVisible) return;
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
  panelVisible = force !== undefined ? force : !panelVisible;
  panel.classList.toggle('hidden', !panelVisible);
  if (panelVisible) {
    frames = 0;
    lastTime = performance.now();
    fpsEl.textContent = '--';
  }
}
