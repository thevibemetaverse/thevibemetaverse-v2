import * as THREE from 'three';

const PORTALS_URL = 'https://portals.thevibemetaverse.com/portals.json';
const PORTAL_RADIUS = 20;
const PROXIMITY_DIST = 3;

const portalClock = new THREE.Clock();
let portals = [];
let promptEl = null;
let navigating = false;
let currentNearestPortal = null;
let _player = null;

export async function initPortals(scene, player) {
  _player = player;
  let data;
  try {
    const res = await fetch(PORTALS_URL);
    data = await res.json();
  } catch (err) {
    console.warn('[Portals] Could not load portals.json:', err);
    return;
  }

  if (!data || data.length === 0) return;

  const count = data.length;
  const arcSpan = Math.min(Math.PI * 0.6, count * 0.4);
  const startAngle = Math.PI / 2 - arcSpan / 2;

  for (let i = 0; i < count; i++) {
    const portalData = data[i];
    const angle = count === 1
      ? Math.PI / 2
      : startAngle + (i / (count - 1)) * arcSpan;

    const x = Math.cos(angle) * PORTAL_RADIUS;
    const z = Math.sin(angle) * PORTAL_RADIUS;

    const group = createPortalMesh(portalData);
    group.position.set(x, 0, z);
    group.lookAt(0, 0, 0);

    scene.add(group);
    portals.push({ data: portalData, group });
  }

  window.addEventListener('keydown', onKeyDown);
}

function createPortalMesh(data) {
  const group = new THREE.Group();
  group.name = 'portal-' + data.slug;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x333355,
    roughness: 0.4,
    metalness: 0.8,
  });

  const pillarGeo = new THREE.BoxGeometry(0.25, 3.2, 0.25);
  const leftPillar = new THREE.Mesh(pillarGeo, frameMat);
  leftPillar.position.set(-1.3, 1.6, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, frameMat);
  rightPillar.position.set(1.3, 1.6, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  const archGeo = new THREE.TorusGeometry(1.3, 0.13, 8, 32, Math.PI);
  const arch = new THREE.Mesh(archGeo, frameMat);
  arch.position.set(0, 3.2, 0);
  arch.rotation.z = Math.PI;
  arch.castShadow = true;
  group.add(arch);

  const neonMat = new THREE.MeshBasicMaterial({ color: 0x7fdbff });
  const stripGeo = new THREE.BoxGeometry(0.04, 3.2, 0.04);
  const ls = new THREE.Mesh(stripGeo, neonMat);
  ls.position.set(-1.12, 1.6, 0.12);
  group.add(ls);
  const rs = new THREE.Mesh(stripGeo, neonMat);
  rs.position.set(1.12, 1.6, 0.12);
  group.add(rs);

  const portalMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color1: { value: new THREE.Color(0x7fdbff) },
      color2: { value: new THREE.Color(0xc792ea) },
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
        vec2 center = vUv - 0.5;
        float dist = length(center);
        float angle = atan(center.y, center.x);

        float swirl = sin(angle * 3.0 + dist * 8.0 - time * 2.0) * 0.5 + 0.5;
        float pulse = sin(time * 1.5) * 0.15 + 0.85;
        float ring = sin(dist * 12.0 - time * 3.0) * 0.5 + 0.5;

        vec3 col = mix(color1, color2, swirl * ring);
        float alpha = smoothstep(0.55, 0.3, dist) * pulse;

        gl_FragColor = vec4(col * 1.5, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), portalMat);
  surface.position.set(0, 1.65, 0.05);
  group.add(surface);

  const light1 = new THREE.PointLight(0x7fdbff, 2, 8);
  light1.position.set(0, 2, 1);
  group.add(light1);
  const light2 = new THREE.PointLight(0xc792ea, 1, 6);
  light2.position.set(0, 1, 1.5);
  group.add(light2);

  // Title label
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fdbff';
  ctx.shadowColor = '#7fdbff';
  ctx.shadowBlur = 12;
  ctx.fillText(data.title || data.slug, 256, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, 4.0, 0);
  sprite.scale.set(4, 0.5, 1);
  group.add(sprite);

  group.userData.portalMat = portalMat;
  return group;
}

export function updatePortals() {
  if (portals.length === 0) return;

  const elapsed = portalClock.getElapsedTime();
  let nearest = null;
  let nearestDist = Infinity;

  for (const portal of portals) {
    portal.group.userData.portalMat.uniforms.time.value = elapsed;

    if (_player) {
      const worldPos = new THREE.Vector3();
      portal.group.getWorldPosition(worldPos);
      const dist = _player.position.distanceTo(worldPos);
      if (dist < PROXIMITY_DIST && dist < nearestDist) {
        nearest = portal;
        nearestDist = dist;
      }
    }
  }

  currentNearestPortal = nearest;

  if (nearest && !navigating) {
    ensurePrompt();
    promptEl.textContent = 'Press E to enter ' + (nearest.data.title || nearest.data.slug);
    promptEl.style.display = 'block';
  } else if (promptEl) {
    promptEl.style.display = 'none';
  }
}

function ensurePrompt() {
  if (promptEl) return;
  promptEl = document.createElement('div');
  promptEl.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: #fff; font-family: 'Courier New', monospace; font-size: 16px;
    text-align: center; text-shadow: 0 0 12px rgba(127,219,255,0.8);
    background: rgba(0,0,0,0.7); padding: 10px 20px; border-radius: 8px;
    border: 1px solid rgba(127,219,255,0.5); z-index: 99999;
    pointer-events: none;
  `;
  document.body.appendChild(promptEl);
}

function onKeyDown(e) {
  if (e.code !== 'KeyE' || !currentNearestPortal || navigating) return;

  navigating = true;
  const portal = currentNearestPortal;
  if (promptEl) promptEl.textContent = 'Entering ' + (portal.data.title || portal.data.slug) + '...';

  const url = new URL(portal.data.url);
  url.searchParams.set('portal', 'true');
  url.searchParams.set('ref', window.location.href);

  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  const avatar = params.get('avatar_url');
  if (username) url.searchParams.set('username', username);
  if (avatar) url.searchParams.set('avatar_url', avatar);

  setTimeout(() => {
    window.location.href = url.toString();
  }, 500);
}
