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
import { initDevTools } from './dev-tools.js';
import { initClouds, updateClouds } from './clouds.js';
import { initMultiplayer, updateMultiplayer, notifyLocalNameChanged } from './multiplayer.js';
import { initNametag } from './nametag.js';
import { initMeetingRoom, updateMeetingRoom } from './meeting-room.js';

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
  initSettings();
  initDevTools();

  // Reparent all lobby objects into a group so we can hide/show them
  state.lobbyGroup = new THREE.Group();
  const sceneChildren = [...state.scene.children];
  for (const child of sceneChildren) {
    // Keep camera, lights, and player at scene root — they persist across rooms
    if (child === state.camera) continue;
    if (child.isLight) continue;
    if (child === state.player) continue;
    state.scene.remove(child);
    state.lobbyGroup.add(child);
  }
  state.scene.add(state.lobbyGroup);

  initMeetingRoom();

  // If navigated directly to a room URL, hide lobby before first frame renders
  if (state._pendingDirectRoomId) {
    state.lobbyGroup.visible = false;
  }

  initMultiplayer();

  window.addEventListener('resize', onResize);
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(state.clock.getDelta(), MAX_DELTA);
  updatePlayer(delta);
  updateMultiplayer(delta);
  if (state.currentRoom === 'lobby') {
    updateGrass();
    updateTrees();
    updateClouds(delta);
    updatePortals();
  } else {
    updateMeetingRoom(delta);
  }
  updateCamera();
  if (state.animationMixer) state.animationMixer.update(delta);
  updateSettings();
  state.renderer.render(state.scene, state.camera);
}
