import * as THREE from 'three';
import { state } from './state.js';
import { setMovingAnimation } from './character.js';
import {
  PLAYER_MOVE_SPEED,
  PLAYER_WORLD_LIMIT,
  PLAYER_SPAWN_Z,
  GAMEPAD_ORBIT_SPEED,
  VR_FP_COMFORT_YAW_SPEED,
} from './constants.js';

export function createPlayer() {
  state.player = new THREE.Group();
  state.player.position.set(0, 0, PLAYER_SPAWN_Z);
  state.scene.add(state.player);
}

export function updatePlayer(delta) {
  if (!state.player) return;
  if (state.gameState !== 'EXPLORING') return;

  const xrOn = state.renderer?.xr?.isPresenting === true;
  if (xrOn) {
    if (state.vrPov === 'third') {
      state.orbitAngle -= state.controllerLook.x * GAMEPAD_ORBIT_SPEED * delta;
    } else {
      state.vrComfortYaw -= state.controllerLook.x * VR_FP_COMFORT_YAW_SPEED * delta;
    }
  } else if (state.controllerLook.x !== 0) {
    state.orbitAngle -= state.controllerLook.x * GAMEPAD_ORBIT_SPEED * delta;
  }

  let moveYaw = state.orbitAngle;
  if (xrOn && state.vrPov === 'first') {
    moveYaw = state.headYaw + state.vrComfortYaw;
  }

  const speed = PLAYER_MOVE_SPEED * delta;
  const forward = new THREE.Vector3(-Math.sin(moveYaw), 0, -Math.cos(moveYaw));
  const right = new THREE.Vector3(Math.cos(moveYaw), 0, -Math.sin(moveYaw));
  const move = new THREE.Vector3();
  if (state.keys['KeyW'] || state.keys['ArrowUp']) move.add(forward);
  if (state.keys['KeyS'] || state.keys['ArrowDown']) move.sub(forward);
  if (state.keys['KeyA'] || state.keys['ArrowLeft']) move.sub(right);
  if (state.keys['KeyD'] || state.keys['ArrowRight']) move.add(right);

  if (state.moveInput.x !== 0 || state.moveInput.z !== 0) {
    move.x += forward.x * -state.moveInput.z + right.x * state.moveInput.x;
    move.z += forward.z * -state.moveInput.z + right.z * state.moveInput.x;
  }

  const cmx = state.controllerMove.x;
  const cmz = state.controllerMove.z;
  if (cmx !== 0 || cmz !== 0) {
    move.x += forward.x * -cmz + right.x * cmx;
    move.z += forward.z * -cmz + right.z * cmx;
  }

  const isMoving = move.lengthSq() > 0;
  state.localPlayerMoving = isMoving;
  setMovingAnimation(isMoving);

  if (isMoving) {
    move.normalize().multiplyScalar(speed);
    state.player.position.add(move);
    const face = Math.atan2(move.x, move.z);
    state.player.rotation.y = face;
  }

  state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -PLAYER_WORLD_LIMIT, PLAYER_WORLD_LIMIT);
  state.player.position.z = THREE.MathUtils.clamp(state.player.position.z, -PLAYER_WORLD_LIMIT, PLAYER_WORLD_LIMIT);
}
