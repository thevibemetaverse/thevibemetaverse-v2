import * as THREE from 'three';
import { state } from './state.js';
import { setMovingAnimation } from './character.js';

export function createPlayer() {
  state.player = new THREE.Group();
  state.scene.add(state.player);
}

export function updatePlayer(delta) {
  if (!state.player) return;
  if (state.gameState !== 'EXPLORING') return;

  const speed = 14 * delta;
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

  const isMoving = move.lengthSq() > 0;
  setMovingAnimation(isMoving);

  if (isMoving) {
    move.normalize().multiplyScalar(speed);
    state.player.position.add(move);
    const face = Math.atan2(move.x, move.z);
    state.player.rotation.y = face;
  }

  const limit = 120;
  state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -limit, limit);
  state.player.position.z = THREE.MathUtils.clamp(state.player.position.z, -limit, limit);
}
