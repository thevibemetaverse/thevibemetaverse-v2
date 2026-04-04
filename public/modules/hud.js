import { state } from './state.js';

export function initHUD() {
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    state.dom.hudPips.appendChild(pip);
  }
}

export function updateHUD() {
  const pips = state.dom.hudPips.querySelectorAll('.pip');
  pips.forEach((pip, i) => {
    pip.classList.toggle('used', i >= state.promptsRemaining);
  });
  state.dom.tabHint.style.display = state.promptsRemaining > 0 ? 'block' : 'none';
}

export function showError(msg) {
  state.dom.errorToast.textContent = msg;
  state.dom.errorToast.classList.add('visible');
  setTimeout(() => state.dom.errorToast.classList.remove('visible'), 3000);
}
