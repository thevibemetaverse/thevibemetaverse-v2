// @ts-check

/**
 * Top-down pixel-art steak sprite for the chest menu.
 *
 * Uses the 16×16 Steak sprite from the FreePixelFood asset pack
 * (art: benmhenry@gmail.com, code: davidahenry@gmail.com). The PNG lives
 * at /textures/steak.png and is scaled up crisp via CSS
 * `image-rendering: pixelated` (see styles.css .chest-meat-canvas).
 *
 * Returns an <img> element — chest-menu.js just appends whatever this
 * returns into the slot, and an <img> plays nicely with the existing
 * `.chest-meat-canvas` CSS (width/height/filter/image-rendering all apply).
 */

export function createMeatPreview() {
  const img = document.createElement('img');
  img.className = 'chest-meat-canvas';
  img.src = 'textures/steak.png';
  img.alt = 'Wagyu A5 Brisket';
  img.draggable = false;
  return img;
}
