import {
  BUNDLED_HARE,
  BUNDLED_METAVERSE_EXPLORER,
  BUNDLED_ROBOT,
  setPlayerAvatarUrl,
} from './character.js';

/** @type {Array<[string, string | null]>} */
const AVATAR_SLOTS = [
  ['explorer', null],
  ['robot', BUNDLED_ROBOT],
  ['rabbit', BUNDLED_HARE],
];

function syncActiveButtons(container) {
  const params = new URLSearchParams(window.location.search);
  const current = params.get('avatar_url');
  for (const [key, path] of AVATAR_SLOTS) {
    const btn = container.querySelector(`[data-avatar="${key}"]`);
    if (!btn) continue;
    const active =
      path == null
        ? !current || current === BUNDLED_METAVERSE_EXPLORER
        : current === path;
    btn.classList.toggle('active', active);
  }
}

export function initAvatarPicker() {
  const bar = document.getElementById('avatar-picker');
  if (!bar) return;

  for (const [key, path] of AVATAR_SLOTS) {
    const btn = bar.querySelector(`[data-avatar="${key}"]`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      setPlayerAvatarUrl(path);
      syncActiveButtons(bar);
    });
  }

  syncActiveButtons(bar);
}
