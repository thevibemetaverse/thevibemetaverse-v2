import {
  SAMPLE_HARE_GLB,
  SAMPLE_ROBOT_GLB,
  SAMPLE_TRICERATOPS_GLB,
  setPlayerAvatarUrl,
} from './character.js';

/** `path: null` = bundled Metaverse Explorer (clears `avatar_url`). */
const PICKER_ENTRIES = [
  { key: 'explorer', path: null },
  { key: 'triceratops', path: SAMPLE_TRICERATOPS_GLB },
  { key: 'hare', path: SAMPLE_HARE_GLB },
  { key: 'robot', path: SAMPLE_ROBOT_GLB },
];

function syncActiveButtons(container) {
  const avatarUrl = new URLSearchParams(window.location.search).get('avatar_url');
  for (const { key, path } of PICKER_ENTRIES) {
    const btn = container.querySelector(`[data-avatar="${key}"]`);
    if (!btn) continue;
    const active = path == null ? !avatarUrl : avatarUrl === path;
    btn.classList.toggle('active', active);
  }
}

export function initAvatarPicker() {
  const bar = document.getElementById('avatar-picker');
  if (!bar) return;

  for (const { key, path } of PICKER_ENTRIES) {
    const btn = bar.querySelector(`[data-avatar="${key}"]`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      setPlayerAvatarUrl(path);
      syncActiveButtons(bar);
    });
  }

  syncActiveButtons(bar);
}
