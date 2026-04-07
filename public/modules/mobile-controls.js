// @ts-check
import { state } from './state.js';
import { CAMERA_ORBIT_SENSITIVITY } from './constants.js';

const JOYSTICK_RADIUS = 35; // max knob travel from center (px)

export function initMobileControls() {
  state.isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!state.isTouchDevice) return;

  const container = document.getElementById('mobile-controls');
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  const orbitZone = document.getElementById('orbit-zone');
  if (!container || !joystickZone || !joystickKnob || !orbitZone) return;

  container.classList.add('visible');

  // ── Joystick ──────────────────────────────────────────────
  let joystickTouchId = /** @type {number | null} */ (null);
  let joystickCenterX = 0;
  let joystickCenterY = 0;

  joystickZone.addEventListener('touchstart', (e) => {
    if (joystickTouchId !== null) return; // already tracking
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    const rect = joystickZone.getBoundingClientRect();
    joystickCenterX = rect.left + rect.width / 2;
    joystickCenterY = rect.top + rect.height / 2;
    e.preventDefault();
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    const t = findTouch(e.changedTouches, joystickTouchId);
    if (!t) return;
    let dx = t.clientX - joystickCenterX;
    let dy = t.clientY - joystickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Normalize to -1..1 range
    state.moveInput.x = dx / JOYSTICK_RADIUS;
    state.moveInput.z = dy / JOYSTICK_RADIUS;
    e.preventDefault();
  }, { passive: false });

  const resetJoystick = (/** @type {TouchEvent} */ e) => {
    const t = findTouch(e.changedTouches, joystickTouchId);
    if (!t) return;
    joystickTouchId = null;
    joystickKnob.style.transform = 'translate(0px, 0px)';
    state.moveInput.x = 0;
    state.moveInput.z = 0;
  };
  joystickZone.addEventListener('touchend', resetJoystick);
  joystickZone.addEventListener('touchcancel', resetJoystick);

  // ── Camera orbit (right side) ─────────────────────────────
  let orbitTouchId = /** @type {number | null} */ (null);
  let orbitPrevX = 0;

  orbitZone.addEventListener('touchstart', (e) => {
    if (orbitTouchId !== null) return;
    const t = e.changedTouches[0];
    orbitTouchId = t.identifier;
    orbitPrevX = t.clientX;
    e.preventDefault();
  }, { passive: false });

  orbitZone.addEventListener('touchmove', (e) => {
    const t = findTouch(e.changedTouches, orbitTouchId);
    if (!t) return;
    const deltaX = t.clientX - orbitPrevX;
    orbitPrevX = t.clientX;
    state.orbitAngle -= deltaX * CAMERA_ORBIT_SENSITIVITY;
    e.preventDefault();
  }, { passive: false });

  const resetOrbit = (/** @type {TouchEvent} */ e) => {
    const t = findTouch(e.changedTouches, orbitTouchId);
    if (!t) return;
    orbitTouchId = null;
  };
  orbitZone.addEventListener('touchend', resetOrbit);
  orbitZone.addEventListener('touchcancel', resetOrbit);
}

/** @param {TouchList} touches @param {number | null} id */
function findTouch(touches, id) {
  if (id === null) return null;
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === id) return touches[i];
  }
  return null;
}
