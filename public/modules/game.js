import * as THREE from 'three';
import { state } from './state.js';
import { FOG_DENSITY, MAX_DELTA } from './constants.js';
import { createRenderer, onResize } from './renderer.js';
import { createCamera, updateCamera } from './camera.js';
import { createWorld } from './world.js';
import { setupLighting } from './lighting.js';
import { createPlayer, updatePlayer } from './player.js';
import { loadPlayerModel } from './character.js';
import { initAvatarPicker } from './avatar-picker.js';
import { setupPlayerControls } from './controls.js';
import { initPortals, updatePortals } from './portals.js';

export function init() {
  // Populate DOM refs
  state.dom.errorToast = document.getElementById('error-toast');

  createRenderer();

  // Scene
  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.FogExp2(0xCCE8FF, FOG_DENSITY);

  createCamera();
  createWorld();
  setupLighting();
  createPlayer();

  setupPlayerControls();
  loadPlayerModel();
  initAvatarPicker();
  initPortals(state.scene, state.player);

  window.addEventListener('resize', onResize);
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(state.clock.getDelta(), MAX_DELTA);
  updatePlayer(delta);
  updatePortals();
  updateCamera();
  if (state.animationMixer) state.animationMixer.update(delta);
  state.renderer.render(state.scene, state.camera);
}
