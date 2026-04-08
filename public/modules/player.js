import * as THREE from 'three';
import { state } from './state.js';
import { setMovingAnimation } from './character.js';
import {
  MOVE_STICKY_FRAMES,
  PLAYER_MOVE_SPEED,
  PLAYER_WORLD_LIMIT,
  PLAYER_SPAWN_Z,
} from './constants.js';

let moveStickyFrames = 0;

export function createPlayer() {
  state.player = new THREE.Group();
  state.player.position.set(0, 0, PLAYER_SPAWN_Z);
  state.scene.add(state.player);
}

export function updatePlayer(delta) {
  if (!state.player) return;
  if (state.gameState !== 'EXPLORING') return;

  const speed = PLAYER_MOVE_SPEED * delta;
  const forward = new THREE.Vector3(
    -Math.sin(state.orbitAngle),
    0,
    -Math.cos(state.orbitAngle)
  );
  const right = new THREE.Vector3(
    Math.cos(state.orbitAngle),
    0,
    -Math.sin(state.orbitAngle)
  );
  const move = new THREE.Vector3();
  if (state.keys['KeyW'] || state.keys['ArrowUp']) move.add(forward);
  if (state.keys['KeyS'] || state.keys['ArrowDown']) move.sub(forward);
  if (state.keys['KeyA'] || state.keys['ArrowLeft']) move.sub(right);
  if (state.keys['KeyD'] || state.keys['ArrowRight']) move.add(right);

  if (state.moveInput.x !== 0 || state.moveInput.z !== 0) {
    move.x += forward.x * -state.moveInput.z + right.x * state.moveInput.x;
    move.z += forward.z * -state.moveInput.z + right.z * state.moveInput.x;
  }

  const hasMoveInput = move.lengthSq() > 0;
  if (hasMoveInput) moveStickyFrames = MOVE_STICKY_FRAMES;
  else if (moveStickyFrames > 0) moveStickyFrames--;
  const isMovingForAnimation = moveStickyFrames > 0;

  setMovingAnimation(isMovingForAnimation);

  if (hasMoveInput) {
    move.normalize().multiplyScalar(speed);
    state.player.position.add(move);
    const face = Math.atan2(move.x, move.z);
    state.player.rotation.y = face;
  }

  state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -PLAYER_WORLD_LIMIT, PLAYER_WORLD_LIMIT);
  state.player.position.z = THREE.MathUtils.clamp(state.player.position.z, -PLAYER_WORLD_LIMIT, PLAYER_WORLD_LIMIT);
}
