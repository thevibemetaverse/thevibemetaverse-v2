import * as THREE from 'three';
import { state } from './state.js';

export function createCamera() {
  state.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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
  const lookY = state.playerModel ? 1.2 : 0.8;
  state.camera.lookAt(p.x, p.y + lookY, p.z);
}
