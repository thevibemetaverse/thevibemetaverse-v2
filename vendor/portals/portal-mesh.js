import * as THREE from 'three';

/**
 * Shared 3D portal visuals for the Vibe Metaverse portal network.
 *
 * Import from this package (same origin as embed.js) so games and embed stay in sync:
 *   import { createPortalMesh } from 'https://your-portals-host/portal-mesh.js';
 *
 * The metaverse dev server exposes it at /vendor/portals/portal-mesh.js
 */

const DEFAULT_COLOR1 = 0x7fdbff;
const DEFAULT_COLOR2 = 0xc792ea;
const RETURN_COLOR1 = 0xffcb6b;
const RETURN_COLOR2 = 0xff9e64;

/**
 * @param {object} [opts]
 * @param {string} [opts.label] — Title above the portal (defaults to "Portal")
 * @param {boolean} [opts.isReturn] — Warm palette for return portals
 * @param {THREE.Color} [opts.color1] — Override accent / swirl (optional)
 * @param {THREE.Color} [opts.color2] — Override secondary swirl (optional)
 * @param {string} [opts.name] — `group.name` (default `"vibe-portal"`)
 * @param {number} [opts.scale] — Uniform scale multiplier (default 1)
 * @param {string} [opts.origin] — "center" (default) or "bottom" — bottom places the portal base at y=0
 * @returns {THREE.Group} `userData.portalMat` is the ShaderMaterial; use `disposePortalMesh(group)` when done
 */
export function createPortalMesh(opts = {}) {
  const {
    label = 'Portal',
    isReturn = false,
    color1: color1Opt,
    color2: color2Opt,
    name = 'vibe-portal',
    scale = 1,
    origin = 'center',
  } = opts;

  const color1 = color1Opt
    ? color1Opt.clone()
    : new THREE.Color(isReturn ? RETURN_COLOR1 : DEFAULT_COLOR1);
  const color2 = color2Opt
    ? color2Opt.clone()
    : new THREE.Color(isReturn ? RETURN_COLOR2 : DEFAULT_COLOR2);

  const group = new THREE.Group();
  group.name = name;

  const portalRadius = 1.45 * scale;
  const portalGeo = new THREE.CircleGeometry(portalRadius, 64);

  // y offset: "center" keeps original 1.65 behavior, "bottom" places portal base at y=0
  const portalY = origin === 'bottom' ? portalRadius : 1.65 * scale;
  const portalMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color1: { value: color1 },
      color2: { value: color2 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.001) discard;

        float angle = atan(p.y, p.x);
        float pulse = sin(time * 2.2) * 0.12 + 0.88;

        // Dark "depth" void in the center (reads as a hole, not a flat sticker)
        float voidMask = smoothstep(0.62, 0.08, r);
        float voidNoise = sin(angle * 5.0 + r * 18.0 - time * 1.5) * 0.5 + 0.5;
        vec3 voidCol = mix(color1 * 0.06, color2 * 0.04, voidNoise * voidMask);
        voidCol *= smoothstep(0.55, 0.0, r);

        // Bright energy ring (main portal rim)
        float ringBand = smoothstep(0.78, 0.62, r) * smoothstep(0.38, 0.58, r);
        float swirl = sin(angle * 16.0 + r * 22.0 - time * 3.5) * 0.5 + 0.5;
        float ripple = sin(r * 40.0 - time * 6.0) * 0.5 + 0.5;
        vec3 ringCol = mix(color1, color2, swirl * ripple);
        ringCol *= (1.1 + 0.6 * pulse);

        // Hot inner edge of the ring
        float innerEdge = smoothstep(0.58, 0.48, r) * smoothstep(0.32, 0.5, r);
        vec3 edgeGlow = mix(color1, vec3(1.0), 0.35) * innerEdge * (0.9 + 0.4 * sin(time * 4.0));

        // Soft outer halo
        float outer = smoothstep(1.0, 0.82, r) * smoothstep(0.72, 0.98, r);
        vec3 halo = color1 * outer * 2.2 * pulse;

        vec3 col = voidCol + ringCol * ringBand + edgeGlow + halo;

        float alpha =
          voidMask * 0.92 * smoothstep(0.65, 0.0, r) +
          ringBand * 0.98 +
          innerEdge * 0.95 +
          outer * 0.75;
        alpha = clamp(alpha * pulse, 0.0, 0.98);

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const portalSurface = new THREE.Mesh(portalGeo, portalMat);
  portalSurface.position.set(0, portalY, 0);
  portalSurface.renderOrder = 1;
  group.add(portalSurface);

  const light1 = new THREE.PointLight(color1, 3.5, 10 * scale);
  light1.position.set(0, portalY, 0.9 * scale);
  group.add(light1);

  const light2 = new THREE.PointLight(color2, 2, 8 * scale);
  light2.position.set(0, portalY, -0.4 * scale);
  group.add(light2);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  const hex = '#' + color1.getHexString();
  ctx.fillStyle = hex;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 12;
  ctx.fillText(label, 256, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, portalY + portalRadius + 0.55 * scale, 0);
  sprite.scale.set(4 * scale, 0.5 * scale, 1);
  group.add(sprite);

  group.userData.portalMat = portalMat;
  group.userData._portalResources = {
    portalGeo,
    portalMat,
    tex,
    spriteMat,
  };

  return group;
}

/** Release GPU/CPU resources for a group built by {@link createPortalMesh}. */
export function disposePortalMesh(group) {
  const r = group.userData._portalResources;
  if (!r) return;
  r.portalGeo.dispose();
  r.portalMat.dispose();
  r.tex.dispose();
  r.spriteMat.dispose();
  delete group.userData._portalResources;
}
