import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';

const WORLD_LIMIT = 300;
const STALE_MS = 45_000;
const PRUNE_INTERVAL_MS = 10_000;

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

  /** @type {Map<import('ws').WebSocket, { id: string, avatarUrl: string, lastSeen: number }>} */
  const sockets = new Map();

  function broadcast(obj, except) {
    const raw = JSON.stringify(obj);
    for (const client of wss.clients) {
      if (client.readyState !== 1) continue;
      if (client === except) continue;
      client.send(raw);
    }
  }

  function removeClient(ws, reason) {
    const meta = sockets.get(ws);
    if (!meta) return;
    sockets.delete(ws);
    broadcast({ type: 'player_left', id: meta.id }, null);
    if (reason) console.warn('[ws] client removed:', meta.id, reason);
  }

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
        sockets.set(ws, { id, avatarUrl, lastSeen: Date.now() });

        const others = [];
        for (const [otherWs, m] of sockets) {
          if (otherWs === ws) continue;
          others.push({ id: m.id, avatarUrl: m.avatarUrl });
        }
        ws.send(
          JSON.stringify({
            type: 'welcome',
            id,
            players: others,
          })
        );
        broadcast({ type: 'player_joined', id, avatarUrl }, ws);
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

      if (msg.type === 'state') {
        const x = clampWorld(Number(msg.x));
        const y = Number.isFinite(Number(msg.y)) ? Number(msg.y) : 0;
        const z = clampWorld(Number(msg.z));
        const ry = Number.isFinite(Number(msg.ry)) ? Number(msg.ry) : 0;
        const moving = Boolean(msg.moving);
        broadcast(
          {
            type: 'player_state',
            id: meta.id,
            x,
            y,
            z,
            ry,
            moving,
          },
          ws
        );
      }
    });

    ws.on('close', () => removeClient(ws));
    ws.on('error', () => removeClient(ws));
  });
}
