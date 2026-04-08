// @ts-check
import * as THREE from 'three';
import { state } from './state.js';

const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

let xrControllersWired = false;
let xrControllerVisualsWired = false;

const xrRayMaterial = new THREE.LineBasicMaterial({
  color: 0x6fe0ff,
  transparent: true,
  opacity: 0.88,
  depthTest: true,
});
const xrDotMaterial = new THREE.MeshBasicMaterial({ color: 0xaaddff, depthTest: true });

/**
 * Procedural target ray + aim dot on XR controller connect (Quest exposes empty Groups until then).
 * @param {import('three').WebGLRenderer} renderer
 */
function wireXrControllerVisuals(renderer) {
  if (xrControllerVisualsWired) return;
  xrControllerVisualsWired = true;

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('connected', () => {
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const line = new THREE.Line(lineGeom, xrRayMaterial);
      line.name = 'xr-target-ray';
      line.scale.z = 0.72;

      const dotGeom = new THREE.SphereGeometry(0.015, 14, 14);
      const dot = new THREE.Mesh(dotGeom, xrDotMaterial);
      dot.name = 'xr-aim-orig';

      controller.add(line);
      controller.add(dot);
      controller.userData.xrViz = { line, dot };
    });
    controller.addEventListener('disconnected', () => {
      const v = controller.userData.xrViz;
      if (!v) return;
      controller.remove(v.line);
      controller.remove(v.dot);
      v.line.geometry.dispose();
      v.dot.geometry.dispose();
      delete controller.userData.xrViz;
    });
  }
}

/**
 * @param {'pending' | 'ready' | 'needs-https' | 'no-api' | 'unsupported' | 'error' | 'session'} mode
 * @param {HTMLButtonElement | null} [btn]
 * @param {string} [errorDetail]
 */
function setEnterVrButton(mode, btn, errorDetail) {
  const el = btn ?? document.getElementById('enter-vr');
  if (!el) return;
  el.classList.remove('enter-vr--pending', 'enter-vr--blocked');
  el.onclick = null;
  el.title = '';

  if (mode === 'session') {
    el.hidden = true;
    el.disabled = true;
    return;
  }

  el.hidden = false;

  if (mode === 'pending') {
    el.disabled = true;
    el.textContent = 'Checking VR…';
    el.classList.add('enter-vr--pending');
    return;
  }

  if (mode === 'ready') {
    el.disabled = false;
    el.textContent = 'Enter VR';
    el.setAttribute('aria-label', 'Enter VR');
    el.onclick = () => {
      void requestVrSession();
    };
    return;
  }

  el.disabled = true;

  if (mode === 'needs-https') {
    el.textContent = 'VR needs HTTPS';
    el.classList.add('enter-vr--blocked');
    el.setAttribute('aria-label', 'VR requires a secure connection');
    el.title =
      'WebXR only works on HTTPS or localhost. Use https:// for this site or open from localhost.';
    return;
  }

  if (mode === 'no-api') {
    el.textContent = 'No WebXR';
    el.setAttribute('aria-label', 'WebXR not available');
    el.title = 'This browser does not expose the WebXR API.';
    return;
  }

  if (mode === 'unsupported') {
    el.textContent = 'VR not supported';
    el.setAttribute('aria-label', 'Immersive VR not supported');
    el.title = 'This device or browser reports that immersive-vr sessions are not supported.';
    return;
  }

  if (mode === 'error') {
    el.textContent = 'VR check failed';
    el.classList.add('enter-vr--blocked');
    el.setAttribute('aria-label', 'VR availability check failed');
    el.title = errorDetail || 'isSessionSupported rejected or threw.';
    return;
  }
}

function createExitVrSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.strokeStyle = 'rgba(127,219,255,0.55)';
  ctx.lineWidth = 3;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(256 - r, 0);
  ctx.quadraticCurveTo(256, 0, 256, r);
  ctx.lineTo(256, 96 - r);
  ctx.quadraticCurveTo(256, 96, 256 - r, 96);
  ctx.lineTo(r, 96);
  ctx.quadraticCurveTo(0, 96, 0, 96 - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Exit VR', 128, 48);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.34, 0.13, 1);
  sprite.position.set(0.42, 0.1, -0.65);
  sprite.renderOrder = 10000;
  sprite.name = 'exit-vr-sprite';
  return sprite;
}

/**
 * @param {THREE.Object3D} controller
 */
function rayHitsExitSprite(controller) {
  if (!state.exitVrSprite) return false;
  state.exitVrSprite.updateMatrixWorld(true);
  _origin.setFromMatrixPosition(controller.matrixWorld);
  _quat.setFromRotationMatrix(controller.matrixWorld);
  _dir.set(0, 0, -1).applyQuaternion(_quat).normalize();
  _raycaster.set(_origin, _dir);
  _raycaster.far = 5;
  const hits = _raycaster.intersectObject(state.exitVrSprite, false);
  return hits.length > 0;
}

/**
 * @param {Event} e
 */
function onControllerSelect(e) {
  const controller = /** @type {THREE.Object3D} */ (e.target);
  if (!rayHitsExitSprite(controller)) return;
  state.renderer?.xr.getSession()?.end();
}

export function syncMobileControlsForWebXr() {
  const container = document.getElementById('mobile-controls');
  if (!container) return;
  if (state.webXrSupported) {
    container.classList.remove('visible');
  } else if (state.isTouchDevice) {
    container.classList.add('visible');
  }
}

async function requestVrSession() {
  const r = state.renderer;
  if (!r || !navigator.xr) return;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor'],
    });
    await r.xr.setSession(session);
  } catch (err) {
    console.warn('[WebXR] requestSession failed:', err);
  }
}

function onVrSessionStart() {
  state.vrPov = 'third';
  state.vrComfortYaw = 0;
  state.prevVrYButton = false;

  if (!state.scene || !state.camera || !state.xrRig) return;

  state.exitVrSprite = createExitVrSprite();

  state.scene.add(state.xrRig);
  state.xrRig.add(state.camera);
  if (state.exitVrSprite) state.camera.add(state.exitVrSprite);

  const r = state.renderer;
  if (!r) return;

  const c0 = r.xr.getController(0);
  const c1 = r.xr.getController(1);
  if (!xrControllersWired) {
    c0.addEventListener('select', onControllerSelect);
    c1.addEventListener('select', onControllerSelect);
    xrControllersWired = true;
  }
  state.scene.add(c0);
  state.scene.add(c1);

  document.getElementById('mobile-controls')?.classList.remove('visible');
  setEnterVrButton('session', document.getElementById('enter-vr'));
}

function onVrSessionEnd() {
  state.vrComfortYaw = 0;
  state.prevVrYButton = false;
  state.vrPov = 'third';

  if (state.exitVrSprite && state.camera) {
    state.camera.remove(state.exitVrSprite);
    const mat = /** @type {THREE.SpriteMaterial} */ (state.exitVrSprite.material);
    mat.map?.dispose();
    mat.dispose();
    state.exitVrSprite = null;
  }

  if (state.xrRig && state.camera) {
    state.xrRig.remove(state.camera);
    state.scene?.remove(state.xrRig);
  }

  const r = state.renderer;
  if (r && state.scene) {
    state.scene.remove(r.xr.getController(0));
    state.scene.remove(r.xr.getController(1));
  }

  syncMobileControlsForWebXr();
  if (state.webXrSupported) {
    setEnterVrButton('ready', document.getElementById('enter-vr'));
  }
}

/**
 * @param {import('three').WebGLRenderer} r
 */
async function probeWebXrSupport(r) {
  const btn = document.getElementById('enter-vr');
  setEnterVrButton('pending', btn);

  if (!window.isSecureContext) {
    state.webXrSupported = false;
    console.warn(
      '[WebXR] Insecure context — use https:// or localhost. isSecureContext=',
      window.isSecureContext
    );
    setEnterVrButton('needs-https', btn);
    syncMobileControlsForWebXr();
    return;
  }

  if (!('xr' in navigator) || !navigator.xr) {
    state.webXrSupported = false;
    console.warn('[WebXR] navigator.xr is not available.');
    setEnterVrButton('no-api', btn);
    syncMobileControlsForWebXr();
    return;
  }

  try {
    const gl = r.getContext();
    if (gl && typeof gl.makeXRCompatible === 'function') {
      await gl.makeXRCompatible();
    }
  } catch (e) {
    console.warn('[WebXR] makeXRCompatible:', e);
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    state.webXrSupported = supported;
    if (supported) {
      setEnterVrButton('ready', btn);
      console.info('[WebXR] immersive-vr is supported.');
    } else {
      setEnterVrButton('unsupported', btn);
      console.warn('[WebXR] immersive-vr is not supported on this device/browser.');
    }
  } catch (err) {
    state.webXrSupported = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[WebXR] isSessionSupported failed:', err);
    setEnterVrButton('error', btn, msg);
  }

  syncMobileControlsForWebXr();
}

export function initWebXR() {
  const r = state.renderer;
  if (!r) return;

  wireXrControllerVisuals(r);

  r.xr.addEventListener('sessionstart', onVrSessionStart);
  r.xr.addEventListener('sessionend', onVrSessionEnd);

  void probeWebXrSupport(r);
}
