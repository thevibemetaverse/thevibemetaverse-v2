// @ts-check
import * as THREE from 'three';

/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.Group} */
let meatGroup;
/** @type {THREE.Group} */
let smokeGroup;
/** @type {THREE.Mesh[]} */
let smokeParticles = [];

let isAnimating = false;
let lastTime = 0;

const CANVAS_SIZE = 96;

/**
 * Build a small Three.js scene that renders a procedural smoked brisket
 * with rising smoke particles. Returns the canvas element to mount.
 */
export function createMeatPreview() {
  const canvas = document.createElement('canvas');
  canvas.className = 'chest-meat-canvas';

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0.7, 0.9, 2.5);
  camera.lookAt(0, 0, 0);

  setupLighting();

  // Meat (rotates)
  meatGroup = new THREE.Group();
  scene.add(meatGroup);
  buildMeat(meatGroup);

  // Smoke (does NOT rotate — stays vertical)
  smokeGroup = new THREE.Group();
  scene.add(smokeGroup);
  buildSmoke(smokeGroup);

  // Render an initial frame so it doesn't flash empty
  renderer.render(scene, camera);

  return canvas;
}

function setupLighting() {
  // Ambient base
  const ambient = new THREE.AmbientLight(0xffeedd, 0.45);
  scene.add(ambient);

  // Key light — warm white from upper-right
  const key = new THREE.DirectionalLight(0xfff2dd, 1.5);
  key.position.set(2.5, 3, 1.8);
  scene.add(key);

  // Warm fill — orange glow from below to suggest "still hot"
  const warmFill = new THREE.DirectionalLight(0xff5522, 0.55);
  warmFill.position.set(-1, -0.8, 1.2);
  scene.add(warmFill);

  // Gold rim light from behind
  const rim = new THREE.DirectionalLight(0xffaa44, 0.6);
  rim.position.set(-0.5, 1.5, -2);
  scene.add(rim);
}

function buildMeat(parent) {
  // Start with a sphere, scale to brisket proportions, then perturb vertices
  const geo = new THREE.SphereGeometry(0.62, 32, 20);
  geo.scale(1.45, 0.58, 1.0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Multi-frequency noise for organic surface
    const n1 = Math.sin(x * 4.3 + y * 2.7) * Math.cos(z * 3.9) * 0.05;
    const n2 = Math.sin(x * 9.1 + z * 7.4) * 0.025;
    const n3 = Math.cos(y * 11.3 + x * 8.2) * 0.018;
    const noise = n1 + n2 + n3;

    // Squish the top to look like a flat-top brisket
    const flatten = y > 0 ? 1 - y * 0.15 : 1;

    pos.setX(i, x + noise);
    pos.setY(i, y * flatten + noise * 0.4);
    pos.setZ(i, z + noise * 0.8);

    // ── Vertex colors: charred mahogany bark with hot crackle ──
    // Charred bark gets darker on top (smoke side), warmer on bottom edges
    const surfaceNoise = (Math.sin(x * 14 + z * 11) * 0.5 + 0.5);
    const crackle = (Math.sin(x * 22 + y * 18 + z * 15) * 0.5 + 0.5);

    // Base mahogany char
    let r = 0.18 + surfaceNoise * 0.10;
    let g = 0.06 + surfaceNoise * 0.04;
    let b = 0.02 + surfaceNoise * 0.01;

    // Hot orange glow in the crackle/cracks (where the meat shows through char)
    if (crackle > 0.78) {
      const heat = (crackle - 0.78) * 4.5;
      r += heat * 0.5;
      g += heat * 0.15;
      b += heat * 0.02;
    }

    // Top is darker (more smoke exposure)
    const topness = Math.max(0, y) * 0.6;
    r *= 1 - topness * 0.3;
    g *= 1 - topness * 0.4;
    b *= 1 - topness * 0.5;

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.08,
    emissive: new THREE.Color(0x441100),
    emissiveIntensity: 0.18,
  });

  const meat = new THREE.Mesh(geo, mat);
  parent.add(meat);

  // Subtle dark base/plate underneath so it sits in space
  const plateGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.04, 32);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.5,
    metalness: 0.3,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = -0.32;
  parent.add(plate);
}

function buildSmoke(parent) {
  smokeParticles = [];
  const geo = new THREE.SphereGeometry(0.09, 8, 6);

  for (let i = 0; i < 14; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(geo, mat);
    particle.userData = {
      vy: 0.18 + Math.random() * 0.12,
      vx: (Math.random() - 0.5) * 0.08,
      vz: (Math.random() - 0.5) * 0.08,
      life: Math.random() * 1.5,
      maxLife: 1.4 + Math.random() * 0.6,
      baseScale: 0.6 + Math.random() * 0.5,
    };
    resetSmoke(particle, true);
    parent.add(particle);
    smokeParticles.push(particle);
  }
}

function resetSmoke(particle, initial = false) {
  particle.position.x = (Math.random() - 0.5) * 0.5;
  particle.position.y = 0.18 + Math.random() * 0.06;
  particle.position.z = (Math.random() - 0.5) * 0.35;
  particle.userData.life = initial ? Math.random() * particle.userData.maxLife : 0;
  particle.scale.setScalar(particle.userData.baseScale * 0.4);
  /** @type {THREE.MeshBasicMaterial} */
  (particle.material).opacity = 0;
}

function animate(now) {
  if (!isAnimating) return;
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
  lastTime = now;

  // Slow auto-rotation
  meatGroup.rotation.y += dt * 0.45;
  // Subtle bob
  meatGroup.position.y = Math.sin(now * 0.0015) * 0.02;

  // Smoke particles
  for (const p of smokeParticles) {
    p.userData.life += dt;
    if (p.userData.life >= p.userData.maxLife) {
      resetSmoke(p);
      continue;
    }

    p.position.y += p.userData.vy * dt;
    p.position.x += p.userData.vx * dt;
    p.position.z += p.userData.vz * dt;

    const t = p.userData.life / p.userData.maxLife;
    // Fade in fast, fade out gently
    const opacity = t < 0.15
      ? (t / 0.15) * 0.55
      : (1 - (t - 0.15) / 0.85) * 0.55;
    /** @type {THREE.MeshBasicMaterial} */
    (p.material).opacity = Math.max(0, opacity);

    // Smoke expands as it rises
    const scale = p.userData.baseScale * (0.4 + t * 1.8);
    p.scale.setScalar(scale);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

export function startMeatAnimation() {
  if (isAnimating) return;
  isAnimating = true;
  lastTime = 0;
  requestAnimationFrame(animate);
}

export function stopMeatAnimation() {
  isAnimating = false;
}
