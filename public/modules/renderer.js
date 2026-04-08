import * as THREE from 'three';
import { state } from './state.js';
import { MAX_PIXEL_RATIO, TONE_MAPPING_EXPOSURE } from './constants.js';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  state.renderer = renderer;
}

export function onResize() {
  if (state.renderer?.xr?.isPresenting) return;
  if (!state.camera) return;
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}
