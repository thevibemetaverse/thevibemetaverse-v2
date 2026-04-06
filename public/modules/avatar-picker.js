import { setPlayerAvatarUrl } from './character.js';

function syncActiveButtons(container) {
  const explorerBtn = container.querySelector('[data-avatar="explorer"]');
  if (!explorerBtn) return;
  const params = new URLSearchParams(window.location.search);
  const hasAvatarUrl = Boolean(params.get('avatar_url'));
  explorerBtn.classList.toggle('active', !hasAvatarUrl);
}

export function initAvatarPicker() {
  const bar = document.getElementById('avatar-picker');
  if (!bar) return;

  const explorer = bar.querySelector('[data-avatar="explorer"]');
  if (explorer) {
    explorer.addEventListener('click', () => {
      setPlayerAvatarUrl(null);
      syncActiveButtons(bar);
    });
  }

  syncActiveButtons(bar);
}
