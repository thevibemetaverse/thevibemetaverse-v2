import * as THREE from 'three';
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
  });
  state.scene.add(new THREE.Mesh(skyGeo, skyMat));
}

function createGround() {
  const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x7EC850 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  state.scene.add(ground);
}

function createHills() {
  const hillColor = new THREE.Color(0x6BBF47);

  const clusters = [
    { x: 0, z: -60, count: 4 },
    { x: 40, z: -50, count: 3 },
    { x: -40, z: -50, count: 3 },
    { x: 65, z: -30, count: 3 },
    { x: -65, z: -30, count: 3 },
    { x: 55, z: -55, count: 2 },
    { x: -55, z: -55, count: 2 },
    { x: 80, z: -10, count: 2 },
    { x: -80, z: -10, count: 2 },
    { x: 30, z: -70, count: 2 },
    { x: -30, z: -70, count: 2 },
  ];

  const rand = seededRandom(42);

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const radius = 10 + rand() * 15;
      const geo = new THREE.SphereGeometry(radius, 24, 16);

      const color = hillColor.clone();
      color.offsetHSL(0, (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.08);
      const mat = new THREE.MeshLambertMaterial({ color });

      const hill = new THREE.Mesh(geo, mat);
      hill.scale.y = 0.35 + rand() * 0.25;

      const offsetX = (rand() - 0.5) * 15;
      const offsetZ = (rand() - 0.5) * 10;
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

function createTrees() {
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
  const canopyGeo = new THREE.SphereGeometry(1, 8, 6);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });

  const rand = seededRandom(123);

  const treePositions = [];
  const treeCount = TREE_COUNT;
  /** Inner radius keeps spawn and the portal row (negative Z) clear of canopy. */
  const minDist = TREE_MIN_DIST;
  const maxDist = TREE_MAX_DIST;
  let attempts = 0;

  while (treePositions.length < treeCount && attempts < 800) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = minDist + rand() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const tooClose = treePositions.some(
      (p) => Math.hypot(p.x - x, p.z - z) < TREE_CLEARANCE
    );
    if (tooClose) continue;
    // Extra guard: keep a wedge toward negative Z clear for portal sightlines
    if (Math.abs(x) < 22 && z < 6 && z > -32) continue;

    treePositions.push({ x, z });

    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);

    const canopy = new THREE.Mesh(canopyGeo, canopyMat.clone());
    canopy.material.color.offsetHSL(0, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.1);
    canopy.position.y = 2.5;
    canopy.castShadow = true;
    tree.add(canopy);

    const scale = 0.7 + rand() * 0.8;
    tree.scale.set(scale, scale, scale);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * Math.PI * 2;

    state.scene.add(tree);
  }
}
