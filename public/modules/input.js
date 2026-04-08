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

/**
 * @param {Gamepad} a
 * @param {Gamepad} b
 */
function sortGamepadsByHand(a, b) {
  const rank = (/** @type {Gamepad} */ g) => {
    const h = g.hand;
    if (h === 'left') return 0;
    if (h === 'right') return 1;
    return 2;
  };
  return rank(a) - rank(b);
}

function pollNavigatorGamepads() {
  /** @type {Gamepad[]} */
  const pads = [];
  const list = navigator.getGamepads();
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (gp && gp.axes && gp.axes.length >= 2) pads.push(gp);
  }
  if (pads.length === 0) return;

  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (gp.axes.length >= 4) {
      const left = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      const right = applyDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
      state.controllerMove.x = left.x;
      state.controllerMove.z = left.y;
      state.controllerLook.x = right.x;
      state.controllerLook.z = right.y;
      return;
    }
  }

  pads.sort(sortGamepadsByHand);

  if (pads.length >= 2) {
    const movePad = pads[0];
    const lookPad = pads[1];
    const m = applyDeadzone(movePad.axes[0] ?? 0, movePad.axes[1] ?? 0);
    const l = applyDeadzone(lookPad.axes[0] ?? 0, lookPad.axes[1] ?? 0);
    state.controllerMove.x = m.x;
    state.controllerMove.z = m.y;
    state.controllerLook.x = l.x;
    state.controllerLook.z = l.y;
    return;
  }

  const m = applyDeadzone(pads[0].axes[0] ?? 0, pads[0].axes[1] ?? 0);
  state.controllerMove.x = m.x;
  state.controllerMove.z = m.y;
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

  /** @type {XRInputSource[]} */
  const withGamepad = [];
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (gp && gp.axes && gp.axes.length >= 2) withGamepad.push(src);
  }

  let yPressed = false;
  let lx = 0;
  let ly = 0;
  let rx = 0;
  let ry = 0;

  /** @type {XRInputSource[]} */
  const unknown = [];

  for (const src of withGamepad) {
    const gp = src.gamepad;
    if (!gp) continue;
    const dz = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    if (src.handedness === 'left') {
      lx += dz.x;
      ly += dz.y;
      if (isQuestLeftYPressed(gp)) yPressed = true;
    } else if (src.handedness === 'right') {
      rx += dz.x;
      ry += dz.y;
    } else {
      unknown.push(src);
    }
  }

  const hadLeftHanded = withGamepad.some((s) => s.handedness === 'left');
  const hadRightHanded = withGamepad.some((s) => s.handedness === 'right');

  let ui = 0;
  if (!hadLeftHanded && ui < unknown.length) {
    const src = unknown[ui++];
    const gp = src.gamepad;
    if (gp) {
      const dz = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      lx += dz.x;
      ly += dz.y;
      if (isQuestLeftYPressed(gp)) yPressed = true;
    }
  }
  if (!hadRightHanded && ui < unknown.length) {
    const src = unknown[ui++];
    const gp = src.gamepad;
    if (gp) {
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
