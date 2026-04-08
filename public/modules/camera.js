import * as THREE from 'three';
import { state } from './state.js';
import {
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_LOOK_Y_WITH_MODEL,
  CAMERA_LOOK_Y_WITHOUT_MODEL,
  XR_RIG_FOOT_OFFSET_Y,
  XR_THIRD_PERSON_ORBIT_DISTANCE,
  XR_THIRD_PERSON_ORBIT_HEIGHT,
} from './constants.js';

export function createCamera() {
  state.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
  state.camera.position.set(0, state.orbitHeight, state.orbitDistance);
  state.xrRig = new THREE.Group();
}

export function updateCamera() {
  if (!state.player || !state.camera) return;

  const presenting = state.renderer?.xr?.isPresenting === true;
  if (!presenting && state.camera.parent) {
    state.camera.parent.remove(state.camera);
  }

  const p = state.player.position;
  const lookY = state.playerModel ? CAMERA_LOOK_Y_WITH_MODEL : CAMERA_LOOK_Y_WITHOUT_MODEL;

  if (presenting && state.xrRig) {
    if (state.vrPov === 'first') {
      state.xrRig.position.set(p.x, p.y + XR_RIG_FOOT_OFFSET_Y, p.z);
      state.xrRig.rotation.set(0, 0, 0);
    } else {
      const dist = XR_THIRD_PERSON_ORBIT_DISTANCE;
      const h = XR_THIRD_PERSON_ORBIT_HEIGHT;
      const ey = p.y + lookY;
      state.xrRig.position.set(
        p.x + Math.sin(state.orbitAngle) * dist,
        p.y + h,
        p.z + Math.cos(state.orbitAngle) * dist
      );
      state.xrRig.lookAt(p.x, ey, p.z);
    }
    state.camera.position.set(0, 0, 0);
    state.camera.rotation.set(0, 0, 0);
    return;
  }

  state.camera.position.set(
    p.x + Math.sin(state.orbitAngle) * state.orbitDistance,
    p.y + state.orbitHeight,
    p.z + Math.cos(state.orbitAngle) * state.orbitDistance
  );
  state.camera.lookAt(p.x, p.y + lookY, p.z);
}
