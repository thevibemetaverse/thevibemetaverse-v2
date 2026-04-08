// @ts-check
import * as THREE from 'three';
import { gltfLoader } from './loader.js';
import { state } from './state.js';
import {
  MEETING_ROOM_MODEL_PATH,
  MEETING_ROOM_EXIT_DIST,
  MEETING_ROOM_PLAYER_SPAWN,
  MEETING_ROOM_EXIT_POSITION,
  ROOM_CAMERA_ORBIT_DISTANCE,
  ROOM_CAMERA_ORBIT_HEIGHT,
  CAMERA_ORBIT_DISTANCE,
  CAMERA_ORBIT_HEIGHT,
  PLAYER_SPAWN_Z,
} from './constants.js';
import { disableLobbyLighting, enableLobbyLighting } from './lighting.js';

/** @type {THREE.Group | null} */
let roomGroup = null;

/** @type {THREE.Mesh | null} */
let wallScreen = null;

/** @type {HTMLCanvasElement | null} */
let screenCanvas = null;

/** @type {CanvasRenderingContext2D | null} */
let screenCtx = null;

/** @type {THREE.CanvasTexture | null} */
let screenTexture = null;

let screenDirty = true;
let lastCountdown = -1;
let lastPlayerCount = -1;

/** The portal position the player entered from, so we can return them nearby. */
let entryReturnZ = PLAYER_SPAWN_Z;
let savedOrbitAngle = 0;

/** @type {THREE.FogBase | null} */
let cachedFog = null;

/** Whether the GLB has finished loading. */
let modelLoaded = false;

/** Pending room join if model hasn't loaded yet. */
let pendingJoin = null;

export function initMeetingRoom() {
  // Copy invite link with C key
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (state.currentRoom !== 'lobby' && e.code === 'KeyC') {
      copyInviteLink();
    }
  });

  // Create room group
  roomGroup = new THREE.Group();
  roomGroup.visible = false;
  state.meetingRoomGroup = roomGroup;
  state.scene.add(roomGroup);

  // Sky sphere visible through windows
  const skyGeo = new THREE.SphereGeometry(200, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87CEEB,
    side: THREE.BackSide,
    fog: false,
  });
  const skySphere = new THREE.Mesh(skyGeo, skyMat);
  roomGroup.add(skySphere);

  // Add interior lighting
  const pointLight = new THREE.PointLight(0xffffff, 2, 100);
  pointLight.position.set(0, 18, 0);
  roomGroup.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xffffff, 1, 80);
  pointLight2.position.set(0, 15, -15);
  roomGroup.add(pointLight2);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  roomGroup.add(ambientLight);

  // Create wall screen for countdown display
  screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 256;
  screenCtx = screenCanvas.getContext('2d');
  screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.minFilter = THREE.LinearFilter;

  const screenGeo = new THREE.PlaneGeometry(16, 8);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide });
  wallScreen = new THREE.Mesh(screenGeo, screenMat);
  wallScreen.position.set(0, 14, -24);
  roomGroup.add(wallScreen);

  // Recessed door cutout on the wall, to the right of the countdown screen
  const doorW = 6;
  const doorH = 12;
  const doorDepth = 3;
  const doorX = MEETING_ROOM_EXIT_POSITION.x;
  const doorY = doorH / 2;
  const doorZ = MEETING_ROOM_EXIT_POSITION.z;
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

  const doorGroup = new THREE.Group();
  doorGroup.position.set(doorX, doorY, doorZ);

  // Back face (deepest part of the recess)
  const backGeo = new THREE.PlaneGeometry(doorW, doorH);
  const back = new THREE.Mesh(backGeo, doorMat);
  back.position.z = -doorDepth;
  doorGroup.add(back);

  // Left wall
  const sideGeo = new THREE.PlaneGeometry(doorDepth, doorH);
  const left = new THREE.Mesh(sideGeo, doorMat);
  left.position.set(-doorW / 2, 0, -doorDepth / 2);
  left.rotation.y = Math.PI / 2;
  doorGroup.add(left);

  // Right wall
  const right = new THREE.Mesh(sideGeo, doorMat);
  right.position.set(doorW / 2, 0, -doorDepth / 2);
  right.rotation.y = -Math.PI / 2;
  doorGroup.add(right);

  // Ceiling
  const topGeo = new THREE.PlaneGeometry(doorW, doorDepth);
  const top = new THREE.Mesh(topGeo, doorMat);
  top.position.set(0, doorH / 2, -doorDepth / 2);
  top.rotation.x = Math.PI / 2;
  doorGroup.add(top);

  // Front face (flush with wall, masks the wall surface)
  const frontMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const frontGeo = new THREE.PlaneGeometry(doorW, doorH);
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.z = 0.05;
  doorGroup.add(front);

  // Load exit sign above the door
  gltfLoader.load(
    '/assets/models/exit_sing.glb',
    (gltf) => {
      const sign = gltf.scene;
      const box = new THREE.Box3().setFromObject(sign);
      const size = box.getSize(new THREE.Vector3());
      const targetW = 4;
      const scale = targetW / Math.max(size.x, 0.01);
      sign.scale.setScalar(scale);
      // Position above the door
      sign.position.set(0, doorH / 2 + 0.5, -0.5);
      doorGroup.add(sign);
    },
    undefined,
    (err) => console.error('Failed to load exit sign:', err)
  );

  roomGroup.add(doorGroup);

  // Create exit door marker (visible guide)
  const exitMarkerGeo = new THREE.PlaneGeometry(6, 8);
  const exitMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const exitMarker = new THREE.Mesh(exitMarkerGeo, exitMarkerMat);
  exitMarker.position.set(
    MEETING_ROOM_EXIT_POSITION.x,
    4,
    MEETING_ROOM_EXIT_POSITION.z
  );
  roomGroup.add(exitMarker);

  // Load meeting room GLB
  gltfLoader.load(
    MEETING_ROOM_MODEL_PATH,
    (gltf) => {
      const model = gltf.scene;

      // Scale room to ~60 units across — large enough to walk around in
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetSize = 80;
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);
      }

      // Center on floor
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      model.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
      });

      roomGroup.add(model);
      modelLoaded = true;

      // If there was a pending join, execute it now
      if (pendingJoin) {
        const { roomId, gameUrl } = pendingJoin;
        pendingJoin = null;
        enterRoom(roomId, gameUrl);
      }
    },
    undefined,
    (err) => console.error('Failed to load meeting room model:', err)
  );

  // Check for direct room link
  const roomMatch = window.location.pathname.match(/^\/room\/(.+)$/);
  if (roomMatch) {
    const roomId = decodeURIComponent(roomMatch[1]);
    // Delay join until WS is connected — multiplayer.js will handle this via checkDirectRoomLink()
    state._pendingDirectRoomId = roomId;
  }

  renderScreen();
}

/**
 * Enter a meeting room.
 * @param {string} roomId
 * @param {string} gameUrl
 */
export function enterRoom(roomId, gameUrl) {
  if (state.currentRoom !== 'lobby') return;
  if (!modelLoaded) {
    pendingJoin = { roomId, gameUrl };
    return;
  }

  state.currentRoom = roomId;
  state.currentRoomGameUrl = gameUrl;
  state.gameState = 'IN_ROOM';

  // Hide lobby, show room
  if (state.lobbyGroup) state.lobbyGroup.visible = false;
  if (roomGroup) roomGroup.visible = true;
  disableLobbyLighting();

  // Disable outdoor fog inside the room
  cachedFog = state.scene.fog;
  state.scene.fog = null;

  // Reposition player inside room
  if (state.player) {
    entryReturnZ = state.player.position.z;
    savedOrbitAngle = state.orbitAngle;
    state.player.position.set(
      MEETING_ROOM_PLAYER_SPAWN.x,
      MEETING_ROOM_PLAYER_SPAWN.y,
      MEETING_ROOM_PLAYER_SPAWN.z
    );
  }

  // Tighten camera for indoor + slight angle
  state.orbitDistance = ROOM_CAMERA_ORBIT_DISTANCE;
  state.orbitHeight = ROOM_CAMERA_ORBIT_HEIGHT;
  state.orbitAngle = 0.4;

  // Face the player toward the camera
  if (state.player) {
    state.player.rotation.y = state.orbitAngle + Math.PI;
  }

  // Update browser URL to the room link
  const roomUrl = `/room/${encodeURIComponent(roomId)}`;
  window.history.pushState({ roomId }, '', roomUrl);

  // Show copy link UI
  showCopyLinkUI();

  // Send join_room via WS
  sendRoomMessage({ type: 'join_room', roomId, gameUrl });

  screenDirty = true;
}

/**
 * Exit the meeting room back to the lobby.
 */
export function exitRoom() {
  if (state.currentRoom === 'lobby') return;

  // Send leave_room via WS
  sendRoomMessage({ type: 'leave_room' });

  state.currentRoom = 'lobby';
  state.currentRoomGameUrl = '';
  state.gameState = 'EXPLORING';
  state.roomPlayers = [];
  state.roomCountdown = null;

  // Show lobby, hide room
  if (roomGroup) roomGroup.visible = false;
  if (state.lobbyGroup) state.lobbyGroup.visible = true;
  enableLobbyLighting();

  // Restore outdoor fog
  if (cachedFog) state.scene.fog = cachedFog;

  // Reposition player back near where they entered
  if (state.player) {
    state.player.position.set(0, 0, entryReturnZ + 5);
  }

  // Restore camera
  state.orbitDistance = CAMERA_ORBIT_DISTANCE;
  state.orbitHeight = CAMERA_ORBIT_HEIGHT;
  state.orbitAngle = savedOrbitAngle;

  // Restore browser URL
  window.history.pushState({}, '', '/');

  // Hide copy link UI
  hideCopyLinkUI();
}

/**
 * Per-frame update for the meeting room.
 * @param {number} _delta
 */
export function updateMeetingRoom(_delta) {
  if (state.currentRoom === 'lobby') return;

  // Check if countdown or player list changed
  if (state.roomCountdown !== lastCountdown || state.roomPlayers.length !== lastPlayerCount) {
    screenDirty = true;
    lastCountdown = state.roomCountdown;
    lastPlayerCount = state.roomPlayers.length;
  }

  // Update wall screen
  if (screenDirty) {
    renderScreen();
    screenDirty = false;
  }

  // Check exit door proximity
  if (state.player) {
    const dx = state.player.position.x - MEETING_ROOM_EXIT_POSITION.x;
    const dz = state.player.position.z - MEETING_ROOM_EXIT_POSITION.z;
    const dist = Math.hypot(dx, dz);
    if (dist < MEETING_ROOM_EXIT_DIST) {
      exitRoom();
    }
  }
}

/** Render countdown + player list onto the wall screen canvas. */
function renderScreen() {
  if (!screenCtx || !screenCanvas || !screenTexture) return;
  const ctx = screenCtx;
  const w = screenCanvas.width;
  const h = screenCanvas.height;

  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  // Countdown
  const secs = state.roomCountdown ?? 60;
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  ctx.fillStyle = secs <= 10 ? '#ff4444' : '#00ff88';
  ctx.font = 'bold 72px Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeStr, w / 2, h / 3);

  // Player list
  const names = state.roomPlayers.map((p) => p.name);
  if (state.localPlayerName && !names.includes(state.localPlayerName)) {
    names.unshift(state.localPlayerName);
  }

  ctx.fillStyle = '#aaa';
  ctx.font = '20px Courier New, monospace';
  ctx.fillText(names.length + ' player' + (names.length !== 1 ? 's' : '') + ' in room', w / 2, h / 2 + 20);

  // Show up to 6 names
  ctx.fillStyle = '#fff';
  ctx.font = '16px Courier New, monospace';
  const showNames = names.slice(0, 6);
  for (let i = 0; i < showNames.length; i++) {
    ctx.fillText(showNames[i], w / 2, h / 2 + 50 + i * 22);
  }
  if (names.length > 6) {
    ctx.fillStyle = '#888';
    ctx.fillText(`+${names.length - 6} more`, w / 2, h / 2 + 50 + 6 * 22);
  }

  screenTexture.needsUpdate = true;
}

let copiedFeedbackTimer = null;
let showCopiedFeedback = false;

function copyInviteLink() {
  const url = `${window.location.origin}/room/${encodeURIComponent(state.currentRoom)}`;
  navigator.clipboard.writeText(url).then(() => {
    showCopiedFeedback = true;
    screenDirty = true;
    if (copiedFeedbackTimer) clearTimeout(copiedFeedbackTimer);
    copiedFeedbackTimer = setTimeout(() => {
      showCopiedFeedback = false;
      screenDirty = true;
    }, 2000);
  }).catch(() => {});
}

/** @type {HTMLElement | null} */
let copyLinkContainer = null;

function showCopyLinkUI() {
  const roomCode = state.currentRoom;
  const inviteUrl = `${window.location.origin}/room/${encodeURIComponent(roomCode)}`;

  if (copyLinkContainer) {
    // Update with new room code
    const codeEl = copyLinkContainer.querySelector('[data-role="code"]');
    const urlEl = copyLinkContainer.querySelector('[data-role="url"]');
    if (codeEl) codeEl.textContent = roomCode;
    if (urlEl) urlEl.textContent = inviteUrl;
    copyLinkContainer.style.display = 'flex';
    return;
  }

  copyLinkContainer = document.createElement('div');
  copyLinkContainer.style.cssText = `
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
    z-index: 20; display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 16px 24px;
    background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px; backdrop-filter: blur(10px);
    font-family: 'Courier New', monospace; color: #fff;
  `;

  const label = document.createElement('div');
  label.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.1em;';
  label.textContent = 'Room Code';
  copyLinkContainer.appendChild(label);

  const codeEl = document.createElement('div');
  codeEl.setAttribute('data-role', 'code');
  codeEl.style.cssText = 'font-size: 18px; font-weight: 700; color: #00ff88; letter-spacing: 0.05em;';
  codeEl.textContent = roomCode;
  copyLinkContainer.appendChild(codeEl);

  const urlEl = document.createElement('div');
  urlEl.setAttribute('data-role', 'url');
  urlEl.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  urlEl.textContent = inviteUrl;
  copyLinkContainer.appendChild(urlEl);

  const btn = document.createElement('button');
  btn.textContent = 'Copy Invite Link';
  btn.style.cssText = `
    margin-top: 4px; padding: 8px 20px; font-family: 'Courier New', monospace; font-size: 14px;
    color: #fff; background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px;
    cursor: pointer; transition: background 0.15s;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.25)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.12)'; });
  btn.addEventListener('click', () => {
    copyInviteLink();
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Invite Link'; }, 2000);
  });

  copyLinkContainer.appendChild(btn);
  document.body.appendChild(copyLinkContainer);
}

function hideCopyLinkUI() {
  if (copyLinkContainer) {
    copyLinkContainer.style.display = 'none';
  }
}

/** @type {WebSocket | null} */
let _ws = null;

/**
 * Set the WebSocket reference so we can send room messages.
 * Called from multiplayer.js after connection.
 * @param {WebSocket | null} ws
 */
export function setRoomWebSocket(ws) {
  _ws = ws;
}

/** @param {object} msg */
function sendRoomMessage(msg) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg));
  }
}
