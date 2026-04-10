// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { getModel } from './models.js';
import { createMeatPreview, startMeatAnimation, stopMeatAnimation } from './chest-meat-preview.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** @type {{ x: number, y: number }} */
let pointerStart = { x: 0, y: 0 };

/** @type {HTMLElement} */
let overlay;

/** @type {HTMLElement} */
let meatSlot;

/** @type {HTMLElement} */
let meatItem;

/** @type {HTMLElement} */
let viewCountEl;

let viewCount = 0;

function createDOM() {
  overlay = document.createElement('div');
  overlay.id = 'chest-overlay';

  const container = document.createElement('div');
  container.className = 'chest-container';

  // Title bar
  const titleBar = document.createElement('div');
  titleBar.className = 'chest-title-bar';

  const title = document.createElement('span');
  title.className = 'chest-title';
  title.textContent = 'Smoked Meat';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'chest-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeChestMenu);

  titleBar.append(title, closeBtn);

  // Rarity badge
  const rarity = document.createElement('div');
  rarity.className = 'chest-rarity';
  rarity.textContent = 'ULTRA LEGENDARY';

  // Grid
  const grid = document.createElement('div');
  grid.className = 'chest-grid';

  for (let i = 0; i < 16; i++) {
    const slot = document.createElement('div');
    slot.className = 'chest-slot';

    if (i === 0) {
      slot.classList.add('has-item');
      meatSlot = slot;

      meatItem = document.createElement('div');
      meatItem.className = 'chest-item';

      const glow = document.createElement('div');
      glow.className = 'chest-item-glow';

      // Light beam that appears on hover
      const beam = document.createElement('div');
      beam.className = 'chest-item-beam';

      // 3D smoked brisket preview (Three.js canvas)
      const meatCanvas = createMeatPreview();

      const name = document.createElement('span');
      name.className = 'chest-item-name';
      name.textContent = 'Wagyu A5 Brisket';

      // Edition tooltip — visible on hover
      const edition = document.createElement('span');
      edition.className = 'chest-item-edition';
      edition.textContent = '1 of 1';

      meatItem.append(beam, glow, meatCanvas, name, edition);
      slot.appendChild(meatItem);
    }

    grid.appendChild(slot);
  }

  // Price reveal — lives below grid, revealed on item hover
  const priceReveal = document.createElement('div');
  priceReveal.className = 'chest-price-reveal';

  const priceAmount = document.createElement('span');
  priceAmount.className = 'chest-price-amount';
  priceAmount.textContent = '$1,000,000';

  const priceLabel = document.createElement('span');
  priceLabel.className = 'chest-price-label';
  priceLabel.textContent = 'ACQUIRE';

  priceReveal.append(priceAmount, priceLabel);

  // Minecraft-style viewer counter — prominent, top of chest
  const viewerRow = document.createElement('div');
  viewerRow.className = 'chest-viewers';

  const viewerLabel = document.createElement('span');
  viewerLabel.className = 'chest-viewers-label';
  viewerLabel.textContent = 'VIEWED';

  viewCountEl = document.createElement('span');
  viewCountEl.className = 'chest-viewers-count';
  viewCountEl.textContent = '0';

  const viewerStatus = document.createElement('span');
  viewerStatus.className = 'chest-viewers-status';
  viewerStatus.textContent = 'UNCLAIMED';

  viewerRow.append(viewerLabel, viewCountEl, viewerStatus);

  // Tagline — the one killer line
  const tagline = document.createElement('div');
  tagline.className = 'chest-tagline';
  tagline.textContent = 'Be the person who bought it.';

  // Footer
  const footer = document.createElement('div');
  footer.className = 'chest-footer';
  footer.textContent = 'Smoked Meat Collection';

  container.append(titleBar, viewerRow, rarity, grid, priceReveal, tagline, footer);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Hover state on meat item — dims grid, reveals price
  meatItem.addEventListener('mouseenter', () => {
    if (!state.meatSold) container.classList.add('item-hovered');
  });
  meatItem.addEventListener('mouseleave', () => {
    container.classList.remove('item-hovered');
  });

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeChestMenu();
  });
}

function openChestMenu() {
  state.gameState = 'CHEST_MENU';
  state.chestMenuOpen = true;
  state.isPointerDown = false;
  state.keys = {};

  // Increment view count
  if (!state.meatSold) {
    viewCount++;
    viewCountEl.textContent = String(viewCount);
    viewCountEl.classList.remove('chest-viewers-count--bump');
    // Force reflow to restart animation
    void viewCountEl.offsetWidth;
    viewCountEl.classList.add('chest-viewers-count--bump');
  }

  overlay.classList.add('open');
  startMeatAnimation();
}

function closeChestMenu() {
  state.gameState = 'EXPLORING';
  state.chestMenuOpen = false;
  overlay.classList.remove('open');
  stopMeatAnimation();
}

function setupClickDetection() {
  const canvas = state.renderer.domElement;

  canvas.addEventListener('pointerdown', (e) => {
    pointerStart.x = e.clientX;
    pointerStart.y = e.clientY;
  });

  canvas.addEventListener('click', (e) => {
    if (state.gameState !== 'EXPLORING') return;

    // Drag discrimination — skip if pointer moved too far (was orbit drag)
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    if (Math.hypot(dx, dy) > 5) return;

    const bbq = getModel('bbq-sauce');
    if (!bbq) return;

    // Raycast against BBQ sauce meshes only
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, state.camera);

    /** @type {THREE.Mesh[]} */
    const targets = [];
    bbq.traverse((child) => {
      if (/** @type {THREE.Mesh} */ (child).isMesh) {
        targets.push(/** @type {THREE.Mesh} */ (child));
      }
    });

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      openChestMenu();
    }
  });
}

function setupEscListener() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.chestMenuOpen) {
      closeChestMenu();
    }
  });
}

export function initChestMenu() {
  createDOM();
  setupClickDetection();
  setupEscListener();
}
