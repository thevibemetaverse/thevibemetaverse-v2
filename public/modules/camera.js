import * as THREE from 'three';
import { state } from './state.js';
import { CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_LOOK_Y_WITH_MODEL, CAMERA_LOOK_Y_WITHOUT_MODEL } from './constants.js';

export function createCamera() {
  state.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
  state.camera.position.set(0, state.orbitHeight, state.orbitDistance);
}

export function updateCamera() {
  if (!state.player) return;
  const p = state.player.position;
  state.camera.position.set(
    p.x + Math.sin(state.orbitAngle) * state.orbitDistance,
    p.y + state.orbitHeight,
    p.z + Math.cos(state.orbitAngle) * state.orbitDistance
  );
  const lookY = state.playerModel ? CAMERA_LOOK_Y_WITH_MODEL : CAMERA_LOOK_Y_WITHOUT_MODEL;
  state.camera.lookAt(p.x, p.y + lookY, p.z);
}
