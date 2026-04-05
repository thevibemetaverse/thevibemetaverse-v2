import {
  SAMPLE_FOX_GLB,
  SAMPLE_DUCK_GLB,
  setPlayerAvatarUrl,
} from './character.js';

function currentKindFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('avatar_url');
  if (!raw) return 'explorer';
  if (raw === SAMPLE_FOX_GLB) return 'fox';
  if (raw === SAMPLE_DUCK_GLB) return 'duck';
  return 'other';
}

function syncActiveButtons(container) {
  const kind = currentKindFromUrl();
  container.querySelectorAll('[data-avatar]').forEach((btn) => {
    const k = btn.getAttribute('data-avatar');
    const active =
      (k === 'explorer' && kind === 'explorer') ||
      (k === 'fox' && kind === 'fox') ||
      (k === 'duck' && kind === 'duck');
    btn.classList.toggle('active', active);
  });
}

export function initAvatarPicker() {
  const bar = document.getElementById('avatar-picker');
  if (!bar) return;

  bar.querySelectorAll('[data-avatar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-avatar');
      if (kind === 'explorer') setPlayerAvatarUrl(null);
      else if (kind === 'fox') setPlayerAvatarUrl(SAMPLE_FOX_GLB);
      else if (kind === 'duck') setPlayerAvatarUrl(SAMPLE_DUCK_GLB);
      syncActiveButtons(bar);
    });
  });

  syncActiveButtons(bar);
}
