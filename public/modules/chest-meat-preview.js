// @ts-check

/**
 * Top-down Minecraft-style pixel-art steak sprite.
 *
 * Inspired directly by the MC steak icon: an organic irregular silhouette
 * with a dark outline, a shaded red meat body (darker rim → base → bright
 * highlight), and a thin cream fat cap running along the bottom arc only.
 *
 * No marbling noise at this resolution — at 32px, pixel-level marbling reads
 * as dither/static, not fat. MC-style meat gets its premium look from clean
 * shaded zones, not from procedural noise.
 */

const CANVAS_SIZE = 32;

// ── Palette ──────────────────────────────────────────────────────────────
// High-contrast MC-style palette. Each tone is distinct enough to read at
// display size.
/** @type {[number, number, number, number]} */ const OUTLINE      = [ 30,  6, 10, 255];
/** @type {[number, number, number, number]} */ const MEAT_DARK    = [114, 14, 22, 255];
/** @type {[number, number, number, number]} */ const MEAT_BASE    = [176, 28, 34, 255];
/** @type {[number, number, number, number]} */ const MEAT_BRIGHT  = [214, 52, 56, 255];
/** @type {[number, number, number, number]} */ const MEAT_HILITE  = [236, 96, 96, 255];
/** @type {[number, number, number, number]} */ const FAT_DARK     = [172, 134, 72, 255];
/** @type {[number, number, number, number]} */ const FAT_MID      = [218, 188, 128, 255];
/** @type {[number, number, number, number]} */ const FAT_LIGHT    = [246, 228, 172, 255];

export function createMeatPreview() {
  const canvas = document.createElement('canvas');
  canvas.className = 'chest-meat-canvas';
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.imageSmoothingEnabled = false;

  drawPixelSteak(ctx, CANVAS_SIZE);

  return canvas;
}

/**
 * Paint the steak sprite pixel-by-pixel.
 *
 * For each pixel inside the asymmetric blob shape we compute `depth` —
 * the fractional distance from the edge toward the center (0 at rim, 1 at
 * heart). Depth drives the shading zones:
 *   depth < 0.06               → dark outline (1 px ring)
 *   depth < 0.20 (upper arc)   → dark red outer meat
 *   depth < 0.45               → base red
 *   depth ≥ 0.45               → bright red interior (slight dither)
 *   depth < 0.38 (bottom arc)  → fat cap band (3-tone cream)
 */
function drawPixelSteak(ctx, size) {
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Canvas starts fully transparent
  for (let i = 3; i < data.length; i += 4) data[i] = 0;

  const setPx = (x, y, c) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    data[i]     = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = c[3];
  };

  // ── Shape ──────────────────────────────────────────────────────────────
  // Asymmetric blob — wider than tall, bulge on the right, organic wobble.
  const cx = 15.5;
  const cy = 14.8;
  const rxB = 12;
  const ryB = 9.6;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (px + 0.5 - cx) / rxB;
      const dy = (py + 0.5 - cy) / ryB;
      const angle = Math.atan2(dy, dx);

      // Organic radius — one strong asymmetry + multi-scale wobble
      let r = 1.0;
      r += 0.10 * Math.cos(angle - 0.25);
      r += 0.06 * Math.sin(angle * 3 + 1.3);
      r += 0.04 * Math.cos(angle * 5 - 0.6);
      r += 0.025 * Math.sin(angle * 9 + 2.0);

      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;

      // 0 at rim, 1 at center
      const depth = 1 - d / r;

      // Bottom arc (excluding the side corners) where the fat cap lives
      const inBottomArc = angle > 0.35 && angle < Math.PI - 0.35;

      let color;

      if (depth < 0.06) {
        // Dark outline ring around the whole silhouette
        color = OUTLINE;
      } else if (inBottomArc && depth < 0.38) {
        // Fat cap: three tonal bands — darker next to the outline,
        // then mid, then bright cream toward the meat boundary.
        if (depth < 0.13)      color = FAT_DARK;
        else if (depth < 0.24) color = FAT_MID;
        else                   color = FAT_LIGHT;
      } else if (depth < 0.18) {
        // Dark red along the outer meat edge (pixel-art ambient occlusion)
        color = MEAT_DARK;
      } else if (depth < 0.44) {
        color = MEAT_BASE;
      } else {
        // Bright meat center — subtle 3-step dither so it isn't a flat blob
        const dither = (px * 3 + py * 5) % 8;
        if (dither === 0)      color = MEAT_BASE;
        else if (dither === 1) color = MEAT_HILITE;
        else                   color = MEAT_BRIGHT;
      }

      setPx(px, py, color);
    }
  }

  // ── Top-rim light accent ───────────────────────────────────────────────
  // Brighten a few meat pixels just inside the upper rim so the flat sprite
  // reads as lit from above — the classic pixel-art trick for suggesting
  // volume on a 2D shape.
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      if (data[i + 3] !== 255) continue;

      // Only meat pixels (not fat cap)
      const isMeat = data[i] > 90 && data[i + 1] < 80;
      if (!isMeat) continue;

      // Only the upper half of the shape
      if (py >= cy) continue;

      // Pixel directly above must be outside the shape or the outline
      const aboveI = ((py - 1) * size + px) * 4;
      const aboveAlpha = py > 0 ? data[aboveI + 3] : 0;
      const aboveIsOutline =
        py > 0 &&
        data[aboveI]     === OUTLINE[0] &&
        data[aboveI + 1] === OUTLINE[1] &&
        data[aboveI + 2] === OUTLINE[2];

      if (aboveAlpha === 0 || aboveIsOutline) {
        // Dithered highlight — skip every third pixel for a broken edge
        if ((px + py) % 3 !== 0) {
          data[i]     = MEAT_HILITE[0];
          data[i + 1] = MEAT_HILITE[1];
          data[i + 2] = MEAT_HILITE[2];
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}

// Animation hooks kept for chest-menu.js compatibility — the sprite is
// completely static so both are no-ops.
export function startMeatAnimation() {
  // no-op
}

export function stopMeatAnimation() {
  // no-op
}
