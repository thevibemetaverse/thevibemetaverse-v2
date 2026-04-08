import * as THREE from 'three';
import { gltfLoader } from './loader.js';
import { state } from './state.js';
import {
  MULTIPLAYER_SEND_INTERVAL_MS,
  MULTIPLAYER_REMOTE_LERP,
  PLAYER_SPAWN_Z,
  DEFAULT_PLAYER_NAME,
} from './constants.js';
import {
  BUNDLED_METAVERSE_EXPLORER,
  buildPlayerVisualFromGltf,
  disposePlayerVisualResources,
  setMovingAnimationForContext,
} from './character.js';
import { createNametagSprite, updateNametagText } from './nametag.js';
import { setRoomWebSocket, enterRoom } from './meeting-room.js';

/** @type {WebSocket | null} */
let ws = null;
let lastSendAt = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let pingInterval = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function getLocalAvatarUrlForNetwork() {
  const u = new URLSearchParams(window.location.search).get('avatar_url');
  return u || '';
}

function resolveAvatarModelPath(avatarUrl) {
  if (!avatarUrl) return BUNDLED_METAVERSE_EXPLORER;
  return avatarUrl;
}

function disposeRemoteById(id) {
  const r = state.remotePlayers.get(id);
  if (!r) return;
  if (r.animationMixer) r.animationMixer.stopAllAction();
  if (r.modelRoot) {
    r.group.remove(r.modelRoot);
    disposePlayerVisualResources(r.modelRoot);
  }
  if (r.nametagSprite) {
    r.nametagSprite.material.map?.dispose();
    r.nametagSprite.material.dispose();
  }
  if (state.scene) state.scene.remove(r.group);
  state.remotePlayers.delete(id);
}

function clearAllRemotes() {
  for (const id of [...state.remotePlayers.keys()]) {
    disposeRemoteById(id);
  }
}

function ensureRemotePlayer(id, avatarUrl, name = DEFAULT_PLAYER_NAME) {
  if (id === state.localPlayerId) return;
  const existing = state.remotePlayers.get(id);
  if (existing) {
    if (existing.avatarUrl === avatarUrl) return;
    disposeRemoteById(id);
  }

  const group = new THREE.Group();
  group.position.set(0, 0, PLAYER_SPAWN_Z);
  state.scene.add(group);

  const nametagSprite = createNametagSprite(name);
  group.add(nametagSprite);

  const record = {
    id,
    avatarUrl,
    name,
    group,
    modelRoot: null,
    animationMixer: null,
    idleAnimAction: null,
    runAnimAction: null,
    lastMovingState: /** @type {boolean | null} */ (null),
    targetPosition: new THREE.Vector3(0, 0, PLAYER_SPAWN_Z),
    targetRotY: 0,
    moving: false,
    nametagSprite,
  };
  state.remotePlayers.set(id, record);

  const path = resolveAvatarModelPath(avatarUrl);
  gltfLoader.load(
    path,
    (gltf) => {
      const current = state.remotePlayers.get(id);
      if (!current || current.avatarUrl !== avatarUrl) return;
      if (current.modelRoot) return;
      const v = buildPlayerVisualFromGltf(current.group, gltf, path);
      current.modelRoot = v.modelRoot;
      current.animationMixer = v.animationMixer;
      current.idleAnimAction = v.idleAnimAction;
      current.runAnimAction = v.runAnimAction;
      current.lastMovingState = v.lastMovingState;
    },
    undefined,
    (err) => console.error('Remote avatar load failed:', id, err)
  );
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg?.type) return;

  switch (msg.type) {
    case 'welcome': {
      clearAllRemotes();
      state.localPlayerId = msg.id;
      const list = Array.isArray(msg.players) ? msg.players : [];
      for (const p of list) {
        if (p?.id && typeof p.avatarUrl === 'string') {
          ensureRemotePlayer(p.id, p.avatarUrl, p.name || DEFAULT_PLAYER_NAME);
        }
      }
      // Populate initial room countdowns from welcome
      if (Array.isArray(msg.rooms)) {
        for (const r of msg.rooms) {
          if (r.roomId) {
            state.roomCountdowns.set(r.roomId, {
              countdown: r.countdown ?? 60,
              playerCount: r.playerCount ?? 0,
            });
          }
        }
      }
      // Handle direct room link or reconnect into room
      if (state._pendingDirectRoomId) {
        const roomId = state._pendingDirectRoomId;
        state._pendingDirectRoomId = null;
        enterRoom(roomId, '');
      } else if (state.currentRoom !== 'lobby') {
        // Reconnect — re-join the room we were in
        const roomId = state.currentRoom;
        const gameUrl = state.currentRoomGameUrl;
        state.currentRoom = 'lobby'; // reset so enterRoom works
        state.gameState = 'EXPLORING';
        enterRoom(roomId, gameUrl);
      }
      break;
    }
    case 'player_joined': {
      if (msg.id && msg.id !== state.localPlayerId) {
        ensureRemotePlayer(
          msg.id,
          typeof msg.avatarUrl === 'string' ? msg.avatarUrl : '',
          typeof msg.name === 'string' ? msg.name : DEFAULT_PLAYER_NAME
        );
      }
      break;
    }
    case 'player_left': {
      if (msg.id) disposeRemoteById(msg.id);
      break;
    }
    case 'player_state': {
      if (!msg.id || msg.id === state.localPlayerId) break;
      let r = state.remotePlayers.get(msg.id);
      if (!r) {
        ensureRemotePlayer(msg.id, '');
        r = state.remotePlayers.get(msg.id);
      }
      if (!r) break;
      r.targetPosition.set(
        Number(msg.x) || 0,
        Number(msg.y) || 0,
        Number(msg.z) || 0
      );
      r.targetRotY = Number(msg.ry) || 0;
      r.moving = Boolean(msg.moving);
      break;
    }
    case 'player_avatar': {
      if (!msg.id || msg.id === state.localPlayerId) break;
      const existingName = state.remotePlayers.get(msg.id)?.name || DEFAULT_PLAYER_NAME;
      disposeRemoteById(msg.id);
      ensureRemotePlayer(
        msg.id,
        typeof msg.avatarUrl === 'string' ? msg.avatarUrl : '',
        existingName
      );
      break;
    }
    case 'player_name': {
      if (!msg.id || msg.id === state.localPlayerId) break;
      const r = state.remotePlayers.get(msg.id);
      if (r) {
        r.name = msg.name || DEFAULT_PLAYER_NAME;
        if (r.nametagSprite) updateNametagText(r.nametagSprite, r.name);
      }
      break;
    }
    case 'room_info': {
      // Update room countdown info for portal display
      if (Array.isArray(msg.rooms)) {
        state.roomCountdowns.clear();
        for (const r of msg.rooms) {
          if (r.roomId) {
            state.roomCountdowns.set(r.roomId, {
              countdown: r.countdown ?? 60,
              playerCount: r.playerCount ?? 0,
            });
          }
        }
      }
      break;
    }
    case 'room_welcome': {
      // Response to join_room — populate room player list
      if (Array.isArray(msg.players)) {
        for (const p of msg.players) {
          if (p?.id && p.id !== state.localPlayerId) {
            ensureRemotePlayer(p.id, p.avatarUrl || '', p.name || DEFAULT_PLAYER_NAME);
          }
        }
      }
      state.roomCountdown = typeof msg.countdown === 'number' ? msg.countdown : 60;
      state.roomPlayers = Array.isArray(msg.players) ? msg.players : [];
      break;
    }
    case 'room_state': {
      // Periodic countdown update from server — update both portal info and current room
      if (msg.roomId) {
        state.roomCountdowns.set(msg.roomId, {
          countdown: msg.countdown ?? 60,
          playerCount: msg.playerCount ?? 0,
        });
      }
      if (msg.roomId === state.currentRoom) {
        state.roomCountdown = typeof msg.countdown === 'number' ? msg.countdown : null;
        state.roomPlayers = Array.isArray(msg.players) ? msg.players : [];
      }
      break;
    }
    case 'room_launch': {
      // Game countdown hit zero — open game in new tab
      if (msg.gameUrl) {
        window.open(msg.gameUrl, '_blank');
      }
      break;
    }
    default:
      break;
  }
}

function sendState() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!state.localPlayerId || !state.player) return;
  const now = performance.now();
  if (now - lastSendAt < MULTIPLAYER_SEND_INTERVAL_MS) return;
  lastSendAt = now;
  const p = state.player.position;
  ws.send(
    JSON.stringify({
      type: 'state',
      x: p.x,
      y: p.y,
      z: p.z,
      ry: state.player.rotation.y,
      moving: state.localPlayerMoving,
    })
  );
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    ws = new WebSocket(wsUrl());
  } catch (e) {
    console.warn('WebSocket failed', e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    setRoomWebSocket(ws);
    ws.send(
      JSON.stringify({
        type: 'hello',
        avatarUrl: getLocalAvatarUrlForNetwork(),
        name: state.localPlayerName,
      })
    );
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  };

  ws.onmessage = (ev) => handleMessage(/** @type {string} */ (ev.data));

  ws.onclose = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    ws = null;
    setRoomWebSocket(null);
    state.localPlayerId = null;
    clearAllRemotes();
    scheduleReconnect();
  };

  ws.onerror = () => {};
}

export function initMultiplayer() {
  connect();
}

export function updateMultiplayer(delta) {
  sendState();

  const k = 1 - Math.exp(-MULTIPLAYER_REMOTE_LERP * delta);
  for (const r of state.remotePlayers.values()) {
    r.group.position.lerp(r.targetPosition, k);
    r.group.rotation.y = THREE.MathUtils.lerp(
      r.group.rotation.y,
      r.targetRotY,
      k
    );

    const ctx = {
      animationMixer: r.animationMixer,
      idleAnimAction: r.idleAnimAction,
      runAnimAction: r.runAnimAction,
      playerModel: r.modelRoot,
      lastMovingState: r.lastMovingState,
    };
    setMovingAnimationForContext(ctx, r.moving);
    r.lastMovingState = ctx.lastMovingState;
    if (r.animationMixer) r.animationMixer.update(delta);
  }
}

export function notifyLocalAvatarChanged() {
  const url = getLocalAvatarUrlForNetwork();
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'avatar', avatarUrl: url }));
  }
}

export function notifyLocalNameChanged() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'name', name: state.localPlayerName }));
  }
}
