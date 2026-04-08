// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { GAMEPAD_STICK_DEADZONE } from './constants.js';

const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _vec = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * @param {number} x
 * @param {number} y
 */
function applyDeadzone(x, y) {
  const m = Math.hypot(x, y);
  if (m < GAMEPAD_STICK_DEADZONE) return { x: 0, y: 0 };
  const s = (m - GAMEPAD_STICK_DEADZONE) / (1 - GAMEPAD_STICK_DEADZONE) / m;
  return { x: x * s, y: y * s };
}

/**
 * @param {{ x: number, z: number }} v
 */
function clampStickLen(v) {
  const m = Math.hypot(v.x, v.z);
  if (m > 1 && m > 0) {
    v.x /= m;
    v.z /= m;
  }
}

/**
 * Left Touch secondary face button (Y) — index 4 on common Quest mappings.
 * @param {Gamepad} gp
 */
function isQuestLeftYPressed(gp) {
  const b = gp.buttons;
  return !!(b && b[4]?.pressed);
}

function pollNavigatorGamepads() {
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (!gp || gp.axes.length < 4) continue;
    const left = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const right = applyDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
    state.controllerMove.x = left.x;
    state.controllerMove.z = left.y;
    state.controllerLook.x = right.x;
    state.controllerLook.z = right.y;
    return;
  }
}

/**
 * @param {globalThis.XRFrame | undefined} xrFrame
 * @param {import('three').WebGLRenderer} renderer
 */
function pollWebXrInput(xrFrame, renderer) {
  const ref = renderer.xr.getReferenceSpace();
  if (!ref) return;

  const pose = xrFrame.getViewerPose(ref);
  if (pose) {
    _mat.fromArray(pose.transform.matrix);
    _mat.decompose(_vec, _quat, _scale);
    _euler.setFromQuaternion(_quat, 'YXZ');
    state.headYaw = _euler.y;
  }

  const session = renderer.xr.getSession();
  if (!session) return;

  let yPressed = false;
  let lx = 0;
  let ly = 0;
  let rx = 0;
  let ry = 0;

  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (!gp) continue;
    if (src.handedness === 'left') {
      const dz = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      lx += dz.x;
      ly += dz.y;
      if (isQuestLeftYPressed(gp)) yPressed = true;
    } else if (src.handedness === 'right') {
      // Each XR input source exposes its own stick on axes 0–1 (not 2–3).
      const dz = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      rx += dz.x;
      ry += dz.y;
    }
  }

  state.controllerMove.x = lx;
  state.controllerMove.z = ly;
  state.controllerLook.x = rx;
  state.controllerLook.z = ry;
  clampStickLen(state.controllerMove);
  clampStickLen(state.controllerLook);

  if (yPressed && !state.prevVrYButton) {
    state.vrPov = state.vrPov === 'first' ? 'third' : 'first';
  }
  state.prevVrYButton = yPressed;
}

/**
 * Reset ephemeral sticks, then fill from WebXR (in session) or standard gamepad.
 * @param {globalThis.XRFrame | undefined} xrFrame - from setAnimationLoop(time, frame) in XR
 */
export function beginInputFrame(xrFrame) {
  state.controllerMove.x = 0;
  state.controllerMove.z = 0;
  state.controllerLook.x = 0;
  state.controllerLook.z = 0;

  const renderer = state.renderer;
  if (!renderer) return;

  if (renderer.xr.isPresenting && xrFrame) {
    pollWebXrInput(xrFrame, renderer);
  } else {
    state.prevVrYButton = false;
    pollNavigatorGamepads();
    clampStickLen(state.controllerMove);
    clampStickLen(state.controllerLook);
  }
}
