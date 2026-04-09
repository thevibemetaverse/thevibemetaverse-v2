// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { XR_METERS_TO_WORLD, XR_RIG_FOOT_OFFSET_Y } from './constants.js';

const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scaleDecomp = new THREE.Vector3();
const _unitScale = new THREE.Vector3(1, 1, 1);
const _anchorM = new THREE.Matrix4();
const _rawPose = new THREE.Matrix4();
const _worldCtrl = new THREE.Matrix4();
const _headRef = new THREE.Matrix4();
const _invHead = new THREE.Matrix4();
const _rel = new THREE.Matrix4();
const _relScaled = new THREE.Matrix4();
const _scaledLocal = new THREE.Matrix4();

/**
 * XR matrices use meters; game avatars use {@link XR_METERS_TO_WORLD}–sized units. Scale translation only
 * so hand orientation stays valid.
 * @param {THREE.Matrix4} src
 * @param {number} factor
 * @param {THREE.Matrix4} out
 */
function scaleMat4Translation(src, factor, out) {
  src.decompose(_origin, _quat, _scaleDecomp);
  _origin.multiplyScalar(factor);
  out.compose(_origin, _quat, _unitScale);
}

/**
 * WebXR reports controller poses in session reference space (meters).
 * - First person: world = translate(avatar feet) * scaled pose (hands by the character).
 * - Third person: parent to camera and use local = scaled(inv(viewerRef) * targetRay) so aids sit by your
 *   headset, not at the avatar where FP would be.
 * Call after renderer.render so camera.matrixWorld matches the current frame.
 * @param {globalThis.XRFrame | undefined} xrFrame
 */
export function syncXrControllersToWorldAnchor(xrFrame) {
  const r = state.renderer;
  const cam = state.camera;
  if (!r?.xr?.isPresenting || !state.scene || !state.player || !cam) return;

  const ref = r.xr.getReferenceSpace();
  const p = state.player.position;
  const third = state.vrPov === 'third';

  for (let i = 0; i < 2; i++) {
    const c = r.xr.getController(i);
    attachXrControllerViz(c);
    c.matrixAutoUpdate = false;
    _rawPose.copy(c.matrix);

    if (third) {
      if (c.parent !== cam) {
        if (c.parent) c.parent.remove(c);
        cam.add(c);
      }
      let ok = false;
      if (xrFrame && ref) {
        const pose = xrFrame.getViewerPose(ref);
        if (pose) {
          _headRef.fromArray(pose.transform.matrix);
          _invHead.copy(_headRef).invert();
          _rel.multiplyMatrices(_invHead, _rawPose);
          scaleMat4Translation(_rel, XR_METERS_TO_WORLD, _relScaled);
          c.matrix.copy(_relScaled);
          ok = true;
        }
      }
      if (!ok) {
        scaleMat4Translation(_rawPose, XR_METERS_TO_WORLD, _scaledLocal);
        _anchorM.makeTranslation(p.x, p.y + XR_RIG_FOOT_OFFSET_Y, p.z);
        _worldCtrl.multiplyMatrices(_anchorM, _scaledLocal);
        cam.updateMatrixWorld(true);
        _invHead.copy(cam.matrixWorld).invert();
        _rel.multiplyMatrices(_invHead, _worldCtrl);
        c.matrix.copy(_rel);
      }
      c.updateMatrixWorld(true);
    } else {
      if (c.parent !== state.scene) {
        if (c.parent) c.parent.remove(c);
        state.scene.add(c);
      }
      _anchorM.makeTranslation(p.x, p.y + XR_RIG_FOOT_OFFSET_Y, p.z);
      scaleMat4Translation(_rawPose, XR_METERS_TO_WORLD, _scaledLocal);
      _worldCtrl.multiplyMatrices(_anchorM, _scaledLocal);
      c.matrix.copy(_worldCtrl);
      c.updateMatrixWorld(true);
    }
  }
}

let xrControllersWired = false;
let xrControllerVisualsWired = false;

const xrRayMaterial = new THREE.LineBasicMaterial({
  color: 0x6fe0ff,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
});
const xrDotMaterial = new THREE.MeshBasicMaterial({
  color: 0xaaddff,
  depthTest: false,
});

/**
 * @param {THREE.Object3D} controller
 */
function attachXrControllerViz(controller) {
  if (controller.userData.xrViz) return;

  const lineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const line = new THREE.Line(lineGeom, xrRayMaterial);
  line.name = 'xr-target-ray';
  line.frustumCulled = false;
  line.renderOrder = 10002;
  line.scale.z = 1.85;

  const dotGeom = new THREE.SphereGeometry(0.022, 16, 16);
  const dot = new THREE.Mesh(dotGeom, xrDotMaterial);
  dot.name = 'xr-aim-orig';
  dot.frustumCulled = false;
  dot.renderOrder = 10003;

  const ringGeom = new THREE.TorusGeometry(0.038, 0.007, 10, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff4dce,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.name = 'xr-grip-ring';
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.02;
  ring.frustumCulled = false;
  ring.renderOrder = 10001;

  controller.add(line);
  controller.add(dot);
  controller.add(ring);
  controller.userData.xrViz = { line, dot, ring, ringMat };
}

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
      attachXrControllerViz(controller);
    });
    controller.addEventListener('disconnected', () => {
      const v = controller.userData.xrViz;
      if (!v) return;
      controller.remove(v.line);
      controller.remove(v.dot);
      if (v.ring) controller.remove(v.ring);
      v.line.geometry.dispose();
      v.dot.geometry.dispose();
      if (v.ring) v.ring.geometry.dispose();
      if (v.ringMat) v.ringMat.dispose();
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
  const ts = state.xrTrackingScale;
  if (ts) {
    ts.scale.setScalar(XR_METERS_TO_WORLD);
    state.xrRig.add(ts);
    ts.add(state.camera);
  } else {
    state.xrRig.add(state.camera);
  }
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

  if (state.xrTrackingScale) {
    state.xrTrackingScale.scale.set(1, 1, 1);
    if (state.camera) state.xrTrackingScale.remove(state.camera);
  }
  if (state.xrRig && state.xrTrackingScale) {
    state.xrRig.remove(state.xrTrackingScale);
  } else if (state.xrRig && state.camera) {
    state.xrRig.remove(state.camera);
  }
  state.scene?.remove(state.xrRig);

  const r = state.renderer;
  if (r) {
    const c0 = r.xr.getController(0);
    const c1 = r.xr.getController(1);
    if (c0.parent) c0.parent.remove(c0);
    if (c1.parent) c1.parent.remove(c1);
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
