import * as THREE from 'three';
import { state } from './state.js';
import { FOG_DENSITY, MAX_DELTA } from './constants.js';
import { createRenderer, onResize } from './renderer.js';
import { createCamera, updateCamera } from './camera.js';
import { createWorld, updateTrees } from './world.js';
import { setupLighting } from './lighting.js';
import { createPlayer, updatePlayer } from './player.js';
import { loadPlayerModel } from './character.js';
import { initAvatarPicker } from './avatar-picker.js';
import { setupPlayerControls } from './controls.js';
import { initMobileControls } from './mobile-controls.js';
import { initPortals, updatePortals } from './portals.js';
import { initGrass, updateGrass } from './grass.js';
import { initSettings, updateSettings } from './settings.js';
import { initModels } from './models.js';
import { initChestMenu } from './chest-menu.js';
import { initDevTools } from './dev-tools.js';
import { initPortalEditor } from './portal-editor.js';
import { initClouds, updateClouds } from './clouds.js';
import { initMultiplayer, updateMultiplayer, notifyLocalNameChanged } from './multiplayer.js';
import { initNametag, setLocalNametagVisible } from './nametag.js';
import { beginInputFrame } from './input.js';
import { initWebXR, syncXrControllersToWorldAnchor } from './webxr.js';

export function init() {
  // Populate DOM refs
  state.dom.errorToast = document.getElementById('error-toast');

  createRenderer();

  // Scene
  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.FogExp2(0xCCE8FF, FOG_DENSITY);

  createCamera();
  createWorld();
  initClouds();
  initGrass();
  setupLighting();
  createPlayer();

  setupPlayerControls();
  initMobileControls();
  loadPlayerModel();
  initNametag({ onNameChanged: notifyLocalNameChanged });
  initAvatarPicker();
  initPortals(state.scene, state.player);
  initModels();
  initChestMenu();
  initSettings();
  initDevTools();
  initPortalEditor();
  initMultiplayer();
  initWebXR();

  window.addEventListener('resize', onResize);
  state.renderer.setAnimationLoop(animate);
}

/**
 * @param {number} _time
 * @param {globalThis.XRFrame | undefined} frame
 */
function animate(_time, frame) {
  beginInputFrame(frame);
  const delta = Math.min(state.clock.getDelta(), MAX_DELTA);
  updatePlayer(delta);
  updateMultiplayer(delta);
  updateGrass();
  updateTrees();
  updateClouds(delta);
  updatePortals();
  updateCamera();
  if (state.animationMixer) state.animationMixer.update(delta);
  updateSettings();
  updateLocalAvatarForVr();
  state.renderer.render(state.scene, state.camera);
  syncXrControllersToWorldAnchor(frame);
}

function updateLocalAvatarForVr() {
  const xr = state.renderer?.xr?.isPresenting === true;
  const hideBody = xr && state.vrPov === 'first';
  if (state.playerModel) state.playerModel.visible = !hideBody;
  setLocalNametagVisible(!hideBody);
}
