// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { GAMEPAD_STICK_DEADZONE, VR_GAMEPAD_STICK_DEADZONE } from './constants.js';

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
 * @param {number} x
 * @param {number} y
 */
function applyVrStickDeadzone(x, y) {
  const m = Math.hypot(x, y);
  if (m < VR_GAMEPAD_STICK_DEADZONE) return { x: 0, y: 0 };
  const s = (m - VR_GAMEPAD_STICK_DEADZONE) / (1 - VR_GAMEPAD_STICK_DEADZONE) / m;
  return { x: x * s, y: y * s };
}

/**
 * Quest / OpenXR sometimes map thumbstick to axes 2–3 or squeeze/trigger to 0–1.
 * Pick the axis pair with the largest deflection after VR deadzone.
 * @param {Gamepad} gp
 */
function pickBestThumbstickPair(gp) {
  const a = gp.axes;
  if (!a || a.length < 2) return { x: 0, y: 0 };
  /** @type {Array<[number, number]>} */
  const pairs = [[a[0] ?? 0, a[1] ?? 0]];
  if (a.length >= 4) pairs.push([a[2] ?? 0, a[3] ?? 0]);
  if (a.length >= 6) pairs.push([a[4] ?? 0, a[5] ?? 0]);

  let bestX = 0;
  let bestY = 0;
  let bestMag = 0;
  for (const [ax, ay] of pairs) {
    const d = applyVrStickDeadzone(ax, ay);
    const mag = Math.hypot(d.x, d.y);
    if (mag > bestMag) {
      bestMag = mag;
      bestX = d.x;
      bestY = d.y;
    }
  }
  return { x: bestX, y: bestY };
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
  if (!b?.length) return false;
  return !!(b[5]?.pressed || b[4]?.pressed);
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
  if (ref && xrFrame) {
    const pose = xrFrame.getViewerPose(ref);
    if (pose) {
      _mat.fromArray(pose.transform.matrix);
      _mat.decompose(_vec, _quat, _scale);
      _euler.setFromQuaternion(_quat, 'YXZ');
      state.headYaw = _euler.y;
    }
  }

  const session = renderer.xr.getSession();
  if (!session) return;

  let yPressed = false;
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (!gp || src.handedness === 'right') continue;
    if (isQuestLeftYPressed(gp)) yPressed = true;
  }

  /**
   * Quest sometimes omits axes on `getGamepads()` in immersive mode; `inputSource.gamepad` can
   * still have thumbsticks. Use whichever source has stronger deflection this frame.
   */
  fillVrThumbsticksImmersive(session);

  clampStickLen(state.controllerMove);
  clampStickLen(state.controllerLook);

  if (!yPressed) {
    yPressed = scanNavigatorGamepadsForVrY();
  }

  if (yPressed && !state.prevVrYButton) {
    state.vrPov = state.vrPov === 'first' ? 'third' : 'first';
  }
  state.prevVrYButton = yPressed;
}

/**
 * @param {XRSession} session
 * @returns {{ lx: number, ly: number, rx: number, ry: number }}
 */
function readSticksFromXrInputSources(session) {
  /** @type {XRInputSource[]} */
  const withGamepad = [];
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (gp && gp.axes && gp.axes.length >= 2) withGamepad.push(src);
  }

  let lx = 0;
  let ly = 0;
  let rx = 0;
  let ry = 0;
  const hadLeft = withGamepad.some((s) => s.handedness === 'left');
  const hadRight = withGamepad.some((s) => s.handedness === 'right');
  /** @type {XRInputSource[]} */
  const unknown = [];

  for (const src of withGamepad) {
    const gp = src.gamepad;
    if (!gp) continue;
    const t = pickBestThumbstickPair(gp);
    if (src.handedness === 'left') {
      lx += t.x;
      ly += t.y;
    } else if (src.handedness === 'right') {
      rx += t.x;
      ry += t.y;
    } else {
      unknown.push(src);
    }
  }

  let ui = 0;
  if (!hadLeft && unknown[ui]) {
    const gp = unknown[ui++].gamepad;
    if (gp) {
      const t = pickBestThumbstickPair(gp);
      lx += t.x;
      ly += t.y;
    }
  }
  if (!hadRight && unknown[ui]) {
    const gp = unknown[ui].gamepad;
    if (gp) {
      const t = pickBestThumbstickPair(gp);
      rx += t.x;
      ry += t.y;
    }
  }

  return { lx, ly, rx, ry };
}

/**
 * @returns {{ lx: number, ly: number, rx: number, ry: number }}
 */
function getNavigatorVrSticks() {
  /** @type {Gamepad[]} */
  const pads = [];
  const list = navigator.getGamepads();
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (gp && gp.axes && gp.axes.length >= 2) pads.push(gp);
  }
  if (pads.length === 0) return { lx: 0, ly: 0, rx: 0, ry: 0 };

  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (gp.axes.length >= 4) {
      const m = applyVrStickDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      const l = applyVrStickDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
      return { lx: m.x, ly: m.y, rx: l.x, ry: l.y };
    }
  }

  pads.sort(sortGamepadsByHand);

  if (pads.length >= 2) {
    const m = pickBestThumbstickPair(pads[0]);
    const l = pickBestThumbstickPair(pads[1]);
    return { lx: m.x, ly: m.y, rx: l.x, ry: l.y };
  }

  const m = pickBestThumbstickPair(pads[0]);
  return { lx: m.x, ly: m.y, rx: 0, ry: 0 };
}

/**
 * @param {XRSession} session
 */
function fillVrThumbsticksImmersive(session) {
  const a = readSticksFromXrInputSources(session);
  const b = getNavigatorVrSticks();
  const magA = Math.abs(a.lx) + Math.abs(a.ly) + Math.abs(a.rx) + Math.abs(a.ry);
  const magB = Math.abs(b.lx) + Math.abs(b.ly) + Math.abs(b.rx) + Math.abs(b.ry);
  const u = magB > magA ? b : a;
  state.controllerMove.x = u.lx;
  state.controllerMove.z = u.ly;
  state.controllerLook.x = u.rx;
  state.controllerLook.z = u.ry;
}

function scanNavigatorGamepadsForVrY() {
  /** @type {Gamepad[]} */
  const gps = [];
  const list = navigator.getGamepads();
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (gp?.buttons?.length) gps.push(gp);
  }
  const candidates = gps.filter((g) => g.hand !== 'right');
  if (candidates.length === 0) return false;
  candidates.sort(sortGamepadsByHand);
  return isQuestLeftYPressed(candidates[0]);
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

  if (renderer.xr.isPresenting) {
    pollWebXrInput(xrFrame, renderer);
  } else {
    state.prevVrYButton = false;
    pollNavigatorGamepads();
    clampStickLen(state.controllerMove);
    clampStickLen(state.controllerLook);
  }
}
