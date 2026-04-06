import { state } from './state.js';

export function showError(msg) {
  state.dom.errorToast.textContent = msg;
  state.dom.errorToast.classList.add('visible');
  setTimeout(() => state.dom.errorToast.classList.remove('visible'), 3000);
}
