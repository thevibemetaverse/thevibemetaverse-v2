import * as THREE from 'three';

/**
 * Creates a torus portal with particles and a label.
 * @param {THREE.Scene} scene
 * @param {object} opts
 * @param {number} opts.color - Hex color for torus/particles
 * @param {string} opts.label - Text for the label
 * @param {string} opts.name - Group name
 * @param {THREE.Vector3} opts.position
 * @returns {{ group: THREE.Group, particles: THREE.BufferGeometry, basePositions: Float32Array }}
 */
export function createTorusPortal(scene, { color, label, name, position }) {
  const GROUP_SCALE = 0.25;
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(position);
  group.scale.setScalar(GROUP_SCALE);

  const r = (color >> 16 & 0xFF) / 255;
  const g = (color >> 8 & 0xFF) / 255;
  const b = (color & 0xFF) / 255;

  // Torus ring (keep visually full; lower tubular segments than 100 for FPS)
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(15, 2, 12, 48),
    new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      transparent: true,
      opacity: 0.8,
    })
  );
  group.add(torus);

  // Inner disc
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(13, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  group.add(inner);

  const particleCount = 420;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const basePositions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 15 + (Math.random() - 0.5) * 4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 4;
    positions[i] = basePositions[i] = x;
    positions[i + 1] = basePositions[i + 1] = y;
    positions[i + 2] = basePositions[i + 2] = z;
    colors[i] = r * (0.8 + Math.random() * 0.2);
    colors[i + 1] = g * (0.8 + Math.random() * 0.2);
    colors[i + 2] = b * (0.8 + Math.random() * 0.2);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    })
  );
  group.add(pts);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const hexStr = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = hexStr;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 5),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  labelMesh.position.y = 20;
  group.add(labelMesh);

  scene.add(group);

  return { group, particles: geo, basePositions };
}

/**
 * Animate particle positions for a torus portal (call each frame).
 */
export function animateTorusPortal(portal, elapsed) {
  const positions = portal.particles.attributes.position.array;
  const base = portal.basePositions;
  const t = elapsed * 2.2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = base[i];
    positions[i + 1] = base[i + 1] + 0.05 * Math.sin(t + i * 0.01);
    positions[i + 2] = base[i + 2];
  }
  portal.particles.attributes.position.needsUpdate = true;
}
