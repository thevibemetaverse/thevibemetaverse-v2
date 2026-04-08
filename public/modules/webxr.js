// @ts-check
import * as THREE from 'three';
import { state } from './state.js';

const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

let xrControllersWired = false;

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
  const enterBtn = document.getElementById('enter-vr');
  if (enterBtn) enterBtn.hidden = true;
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
  const enterBtn = document.getElementById('enter-vr');
  if (enterBtn && state.webXrSupported) enterBtn.hidden = false;
}

export function initWebXR() {
  const r = state.renderer;
  if (!r || !('xr' in navigator)) return;

  r.xr.addEventListener('sessionstart', onVrSessionStart);
  r.xr.addEventListener('sessionend', onVrSessionEnd);

  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((supported) => {
      state.webXrSupported = supported;
      const btn = document.getElementById('enter-vr');
      if (btn) {
        btn.hidden = !supported;
        btn.addEventListener('click', () => {
          void requestVrSession();
        });
      }
      syncMobileControlsForWebXr();
    })
    .catch(() => {
      state.webXrSupported = false;
      syncMobileControlsForWebXr();
    });
}
