import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';

const WORLD_LIMIT = 300;
const STALE_MS = 45_000;
const PRUNE_INTERVAL_MS = 10_000;
const DEFAULT_PLAYER_NAME = 'metaverse-explorer';
const MAX_NAME_LENGTH = 20;
const COUNTDOWN_SECONDS = 60;
const COUNTDOWN_TICK_MS = 1000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

function notifyDiscord(playerName, playerCount) {
  if (!DISCORD_WEBHOOK_URL) return;
  fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `**${playerName}** joined the metaverse! (${playerCount} player${playerCount === 1 ? '' : 's'} online)`,
    }),
  }).catch(() => {});
}

function clampWorld(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, n));
}

/**
 * Attach multiplayer WebSocket hub to an existing HTTP server.
 * @param {import('http').Server} server
 */
export function attachMultiplayerWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  /** @type {Map<import('ws').WebSocket, { id: string, avatarUrl: string, name: string, lastSeen: number, room: string }>} */
  const sockets = new Map();

  /**
   * Room state tracked on the server.
   * @type {Map<string, { players: Set<import('ws').WebSocket>, startTime: number | null, gameUrl: string }>}
   */
  const rooms = new Map();

  function broadcast(obj, except) {
    const raw = JSON.stringify(obj);
    for (const client of wss.clients) {
      if (client.readyState !== 1) continue;
      if (client === except) continue;
      client.send(raw);
    }
  }

  function broadcastToRoom(obj, room, except) {
    const raw = JSON.stringify(obj);
    for (const [client, meta] of sockets) {
      if (client.readyState !== 1) continue;
      if (client === except) continue;
      if (meta.room !== room) continue;
      client.send(raw);
    }
  }

  /** Build a room_state snapshot and send it to ALL connected clients. */
  function broadcastRoomInfo() {
    const roomList = [];
    for (const [roomId, room] of rooms) {
      if (room.players.size === 0) continue;
      const remaining = room.startTime
        ? Math.max(0, COUNTDOWN_SECONDS - Math.floor((Date.now() - room.startTime) / 1000))
        : COUNTDOWN_SECONDS;
      const players = [];
      for (const ws of room.players) {
        const m = sockets.get(ws);
        if (m) players.push({ id: m.id, name: m.name });
      }
      roomList.push({ roomId, countdown: remaining, playerCount: room.players.size, players, gameUrl: room.gameUrl });
    }
    broadcast({ type: 'room_info', rooms: roomList }, null);
  }

  function getOrCreateRoom(roomId, gameUrl) {
    let room = rooms.get(roomId);
    if (!room) {
      room = { players: new Set(), startTime: null, gameUrl: gameUrl || '' };
      rooms.set(roomId, room);
    }
    if (gameUrl && !room.gameUrl) room.gameUrl = gameUrl;
    return room;
  }

  function joinRoom(ws, meta, roomId, gameUrl) {
    const oldRoom = meta.room;
    if (oldRoom === roomId) return;

    // Leave old room if it was a meeting room
    if (oldRoom !== 'lobby') {
      leaveRoom(ws, meta);
    }

    const room = getOrCreateRoom(roomId, gameUrl);
    room.players.add(ws);
    meta.room = roomId;

    // Start countdown if first player
    if (room.players.size === 1) {
      room.startTime = Date.now();
    }

    // Tell room members about the new player
    broadcastToRoom({ type: 'player_joined', id: meta.id, avatarUrl: meta.avatarUrl, name: meta.name }, roomId, ws);

    // Send the joiner the list of players already in the room
    const roomPlayers = [];
    for (const rws of room.players) {
      const m = sockets.get(rws);
      if (m && rws !== ws) roomPlayers.push({ id: m.id, avatarUrl: m.avatarUrl, name: m.name });
    }
    const remaining = room.startTime
      ? Math.max(0, COUNTDOWN_SECONDS - Math.floor((Date.now() - room.startTime) / 1000))
      : COUNTDOWN_SECONDS;
    ws.send(JSON.stringify({
      type: 'room_welcome',
      roomId,
      countdown: remaining,
      players: roomPlayers,
      gameUrl: room.gameUrl,
    }));

    broadcastRoomInfo();
  }

  function leaveRoom(ws, meta) {
    const roomId = meta.room;
    if (roomId === 'lobby') return;

    const room = rooms.get(roomId);
    if (room) {
      room.players.delete(ws);
      // Reset countdown if room empties
      if (room.players.size === 0) {
        room.startTime = null;
      }
      broadcastToRoom({ type: 'player_left', id: meta.id }, roomId, null);
    }
    meta.room = 'lobby';
    broadcastRoomInfo();
  }

  function removeClient(ws, reason) {
    const meta = sockets.get(ws);
    if (!meta) return;
    // Leave any room first
    if (meta.room !== 'lobby') {
      leaveRoom(ws, meta);
    }
    sockets.delete(ws);
    broadcast({ type: 'player_left', id: meta.id }, null);
    if (reason) console.warn('[ws] client removed:', meta.id, reason);
  }

  // Stale client pruning
  setInterval(() => {
    const now = Date.now();
    for (const [ws, meta] of sockets) {
      if (now - meta.lastSeen > STALE_MS) {
        try {
          ws.close(4000, 'stale');
        } catch {
          /* ignore */
        }
        removeClient(ws, 'stale');
      }
    }
  }, PRUNE_INTERVAL_MS);

  // Countdown tick — check all active rooms every second
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      if (room.players.size === 0 || !room.startTime) continue;
      const elapsed = Math.floor((now - room.startTime) / 1000);
      const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);

      if (remaining <= 0) {
        // Launch the game for all players in this room
        broadcastToRoom({ type: 'room_launch', roomId, gameUrl: room.gameUrl }, roomId, null);
        // Reset the room
        room.startTime = null;
        // Move all players back to lobby
        for (const ws of room.players) {
          const m = sockets.get(ws);
          if (m) m.room = 'lobby';
        }
        room.players.clear();
        broadcastRoomInfo();
      }
    }
    // Periodically broadcast room info so portal displays stay fresh
    broadcastRoomInfo();
  }, COUNTDOWN_TICK_MS);

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      const meta = sockets.get(ws);
      if (meta) meta.lastSeen = Date.now();

      if (msg.type === 'hello') {
        if (meta) return;
        const id = randomUUID();
        const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl : '';
        const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_PLAYER_NAME : DEFAULT_PLAYER_NAME;
        sockets.set(ws, { id, avatarUrl, name, lastSeen: Date.now(), room: 'lobby' });

        const others = [];
        for (const [otherWs, m] of sockets) {
          if (otherWs === ws) continue;
          if (m.room !== 'lobby') continue;
          others.push({ id: m.id, avatarUrl: m.avatarUrl, name: m.name });
        }

        // Include current room states so the client can show portal info
        const roomList = [];
        for (const [roomId, room] of rooms) {
          if (room.players.size === 0) continue;
          const remaining = room.startTime
            ? Math.max(0, COUNTDOWN_SECONDS - Math.floor((Date.now() - room.startTime) / 1000))
            : COUNTDOWN_SECONDS;
          roomList.push({ roomId, countdown: remaining, playerCount: room.players.size, gameUrl: room.gameUrl });
        }

        ws.send(
          JSON.stringify({
            type: 'welcome',
            id,
            players: others,
            rooms: roomList,
          })
        );
        broadcast({ type: 'player_joined', id, avatarUrl, name }, ws);
        notifyDiscord(name, sockets.size);
        return;
      }

      if (!meta) return;

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'avatar') {
        const next = typeof msg.avatarUrl === 'string' ? msg.avatarUrl : '';
        meta.avatarUrl = next;
        broadcast({ type: 'player_avatar', id: meta.id, avatarUrl: next }, ws);
        return;
      }

      if (msg.type === 'name') {
        const next = typeof msg.name === 'string' ? msg.name.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_PLAYER_NAME : DEFAULT_PLAYER_NAME;
        meta.name = next;
        broadcast({ type: 'player_name', id: meta.id, name: next }, ws);
        return;
      }

      if (msg.type === 'join_room') {
        const roomId = typeof msg.roomId === 'string' ? msg.roomId.trim() : '';
        if (!roomId) return;
        const gameUrl = typeof msg.gameUrl === 'string' ? msg.gameUrl : '';
        joinRoom(ws, meta, roomId, gameUrl);
        return;
      }

      if (msg.type === 'leave_room') {
        leaveRoom(ws, meta);
        return;
      }

      if (msg.type === 'state') {
        const x = clampWorld(Number(msg.x));
        const y = Number.isFinite(Number(msg.y)) ? Number(msg.y) : 0;
        const z = clampWorld(Number(msg.z));
        const ry = Number.isFinite(Number(msg.ry)) ? Number(msg.ry) : 0;
        const moving = Boolean(msg.moving);
        // Only broadcast state to players in the same room
        broadcastToRoom(
          {
            type: 'player_state',
            id: meta.id,
            x,
            y,
            z,
            ry,
            moving,
          },
          meta.room,
          ws
        );
      }
    });

    ws.on('close', () => removeClient(ws));
    ws.on('error', () => removeClient(ws));
  });
}
