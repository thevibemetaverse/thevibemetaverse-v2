import * as THREE from 'three';
import { state } from './state.js';
import { createRenderer, onResize } from './renderer.js';
import { createCamera, updateCamera } from './camera.js';
import { createWorld } from './world.js';
import { setupLighting } from './lighting.js';
import { createPlayer, updatePlayer } from './player.js';
import { loadPlayerModel } from './character.js';
import { setupPlayerControls } from './controls.js';
import { initHUD, updateHUD } from './hud.js';
import { initPortals, updatePortals } from './portals.js';

export function init() {
  // Populate DOM refs
  state.dom.hudPips = document.getElementById('hud-pips');
  state.dom.tabHint = document.getElementById('tab-hint');
  state.dom.promptBar = document.getElementById('prompt-bar');
  state.dom.promptInput = document.getElementById('prompt-input');
  state.dom.materializingEl = document.getElementById('materializing');
  state.dom.errorToast = document.getElementById('error-toast');

  createRenderer();

  // Scene
  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.FogExp2(0xCCE8FF, 0.006);

  createCamera();
  createWorld();
  setupLighting();
  createPlayer();

  setupPlayerControls();
  loadPlayerModel();
  initHUD();
  updateHUD();
  initPortals(state.scene, state.player);

  window.addEventListener('resize', onResize);
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(state.clock.getDelta(), 0.1);
  updatePlayer(delta);
  updatePortals();
  updateCamera();
  if (state.animationMixer) state.animationMixer.update(delta);
  state.renderer.render(state.scene, state.camera);
}
