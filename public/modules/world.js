import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Tree } from '@dgreenheck/ez-tree';
import { state } from './state.js';
import { seededRandom } from './utils.js';
import { GROUND_SIZE, SKY_RADIUS, TREE_COUNT, TREE_MIN_DIST, TREE_MAX_DIST, TREE_CLEARANCE } from './constants.js';

export function createWorld() {
  createSky();
  createGround();
  createHills();
  createTrees();
}

function createSky() {
  const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x5BA3D9) },
      bottomColor: { value: new THREE.Color(0xD4EEFF) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = smoothstep(-0.05, 0.6, h);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  state.scene.add(new THREE.Mesh(skyGeo, skyMat));
}

function createGround() {
  const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d6b1a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  state.scene.add(ground);
}

function createHills() {
  const hillColor = new THREE.Color(0x6BBF47);

  const clusters = [
    { x: 0, z: -200, count: 5 },
    { x: 120, z: -170, count: 4 },
    { x: -120, z: -170, count: 4 },
    { x: 200, z: -100, count: 3 },
    { x: -200, z: -100, count: 3 },
    { x: 170, z: -180, count: 3 },
    { x: -170, z: -180, count: 3 },
    { x: 240, z: -40, count: 3 },
    { x: -240, z: -40, count: 3 },
    { x: 90, z: -220, count: 3 },
    { x: -90, z: -220, count: 3 },
    // Rear ring — full surround
    { x: 0, z: 220, count: 4 },
    { x: 150, z: 180, count: 3 },
    { x: -150, z: 180, count: 3 },
    { x: 230, z: 80, count: 3 },
    { x: -230, z: 80, count: 3 },
  ];

  const rand = seededRandom(42);

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const radius = 20 + rand() * 30;
      const geo = new THREE.SphereGeometry(radius, 24, 16);

      const color = hillColor.clone();
      color.offsetHSL(0, (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.08);
      const mat = new THREE.MeshLambertMaterial({ color });

      const hill = new THREE.Mesh(geo, mat);
      hill.scale.y = 0.35 + rand() * 0.25;

      const offsetX = (rand() - 0.5) * 30;
      const offsetZ = (rand() - 0.5) * 20;
      hill.position.set(
        cluster.x + offsetX,
        -(radius * hill.scale.y * 0.3),
        cluster.z + offsetZ
      );

      hill.receiveShadow = true;
      state.scene.add(hill);
    }
  }
}

/** Base preset for ez-tree — deciduous oak style */
const BASE_PRESET = {
  seed: 31055,
  type: 'deciduous',
  bark: {
    type: 'oak',
    tint: 13552830,
    flatShading: false,
    textured: true,
    textureScale: { x: 0.5, y: 5 },
  },
  branch: {
    levels: 3,
    angle: { 1: 39, 2: 39, 3: 51 },
    children: { 0: 10, 1: 4, 2: 3 },
    force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.010869565217391311 },
    gnarliness: { 0: -0.05, 1: 0.2, 2: 0.16, 3: 0.049999999999999996 },
    length: { 0: 45, 1: 29.42, 2: 15.3, 3: 4.6 },
    radius: { 0: 3.03, 1: 0.53, 2: 0.79, 3: 1.11 },
    sections: { 0: 12, 1: 8, 2: 6, 3: 4 },
    segments: { 0: 8, 1: 6, 2: 4, 3: 3 },
    start: { 1: 0.32, 2: 0.34, 3: 0 },
    taper: { 0: 0.7, 1: 0.6199999999999999, 2: 0.7599999999999999, 3: 0 },
    twist: { 0: 0.09, 1: -0.07, 2: 0, 3: 0 },
  },
  leaves: {
    type: 'ash',
    billboard: 'double',
    angle: 30,
    count: 10,
    start: 0.01,
    size: 4.62,
    sizeVariance: 0.72,
    tint: 16777215,
    alphaTest: 0.5,
  },
};

/**
 * Deep-clone the base preset and apply per-tree variation so each tree
 * looks slightly different while staying cohesive.
 */
function variedPreset(rand) {
  const p = JSON.parse(JSON.stringify(BASE_PRESET));

  // Unique seed per tree
  p.seed = Math.floor(rand() * 65536);

  // Slight trunk length variation (±15%)
  const lengthScale = 0.85 + rand() * 0.30;
  p.branch.length[0] *= lengthScale;
  p.branch.length[1] *= lengthScale;

  // Vary children count on trunk (5-9)
  p.branch.children[0] = 5 + Math.floor(rand() * 5);

  // Slight gnarliness variation
  p.branch.gnarliness[1] = 0.15 + rand() * 0.20;

  // Vary leaf count (12-20) and size (2.0-3.2)
  p.leaves.count = 12 + Math.floor(rand() * 9);
  p.leaves.size = 2.0 + rand() * 1.2;

  // Slight branching angle variation
  p.branch.angle[1] = 40 + Math.floor(rand() * 20);
  p.branch.angle[2] = 65 + Math.floor(rand() * 25);

  return p;
}

/**
 * Apply a preset object to a Tree instance's options using its built-in copy().
 */
function applyPreset(tree, preset) {
  tree.options.copy(preset);
}

/**
 * Compute tree placement positions up-front (cheap), then generate and
 * merge geometry in batches via requestIdleCallback so the main thread
 * stays responsive during load.
 */
function createTrees() {
  const rand = seededRandom(123);

  // --- 1. Compute positions (fast) ---
  const positions = [];
  let attempts = 0;
  while (positions.length < TREE_COUNT && attempts < 1500) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = TREE_MIN_DIST + rand() * (TREE_MAX_DIST - TREE_MIN_DIST);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const tooClose = positions.some(
      (p) => Math.hypot(p.x - x, p.z - z) < TREE_CLEARANCE
    );
    if (tooClose) continue;
    // Keep a big circle around spawn clear so the player has open space
    if (Math.hypot(x, z) < 100) continue;

    const scale = 0.35 + rand() * 0.15;
    const rotY = rand() * Math.PI * 2;
    positions.push({ x, z, scale, rotY, preset: variedPreset(rand) });
  }

  // --- 2. Generate trees in batches off the main thread ---
  const BATCH = 5;
  let idx = 0;
  const barkGeoms = [];
  const leafGeoms = [];
  let barkMat = null;
  let leafMat = null;

  function processBatch() {
    const end = Math.min(idx + BATCH, positions.length);
    for (; idx < end; idx++) {
      const p = positions[idx];
      const tree = new Tree();
      applyPreset(tree, p.preset);
      tree.generate();

      tree.scale.set(p.scale, p.scale, p.scale);
      tree.position.set(p.x, 0, p.z);
      tree.rotation.y = p.rotY;
      tree.updateMatrixWorld(true);

      // Collect transformed geometries and materials
      tree.traverse((child) => {
        if (!child.isMesh) return;
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);

        // Bark meshes have textured materials, leaves have alpha
        if (child.material.alphaTest > 0) {
          leafGeoms.push(geo);
          if (!leafMat) leafMat = child.material;
        } else {
          barkGeoms.push(geo);
          if (!barkMat) barkMat = child.material;
        }
      });

      tree.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
        }
      });
    }

    if (idx < positions.length) {
      // More trees to generate — yield to main thread
      (typeof requestIdleCallback === 'function' ? requestIdleCallback : requestAnimationFrame)(processBatch);
    } else {
      // --- 3. Merge into 2 draw calls ---
      if (barkGeoms.length) {
        const merged = mergeGeometries(barkGeoms, false);
        const mesh = new THREE.Mesh(merged, barkMat);
        mesh.castShadow = true;
        state.scene.add(mesh);
        barkGeoms.forEach((g) => g.dispose());
      }
      if (leafGeoms.length) {
        const merged = mergeGeometries(leafGeoms, false);
        const mesh = new THREE.Mesh(merged, leafMat);
        mesh.castShadow = true;
        state.scene.add(mesh);
        leafGeoms.forEach((g) => g.dispose());
      }
    }
  }

  processBatch();
}
