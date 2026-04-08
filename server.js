import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PORTALS_PRODUCTION_ORIGIN } from './vendor/portals/sdk/network.js';
import { attachMultiplayerWebSocket } from './server/multiplayer-ws.js';

/** Ensure the static portal hub (network index) is listed so the metaverse is not the only destination. */
function mergePortalHub(entries, portalsOrigin) {
  const list = Array.isArray(entries) ? [...entries] : [];
  const origin = portalsOrigin.replace(/\/$/, '');
  const hubUrl = `${origin}/`;
  const hubOrigin = new URL(hubUrl).origin;
  const hasHub = list.some((p) => {
    if (!p?.url) return false;
    try {
      const u = new URL(p.url);
      if (u.origin !== hubOrigin) return false;
      const path = u.pathname.replace(/\/$/, '') || '/';
      return path === '/' || path === '/index.html';
    } catch {
      return false;
    }
  });
  if (!hasHub) {
    list.push({
      slug: 'portal-network',
      title: 'Portal Network',
      url: hubUrl,
    });
  }
  return list;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Before express.static so this is never shadowed by public/portals.json
app.get('/portals.json', async (req, res) => {
  const base = (process.env.PORTALS_SERVER || PORTALS_PRODUCTION_ORIGIN).replace(/\/$/, '');
  const upstream = `${base}/portals.json`;
  try {
    const r = await fetch(upstream);
    if (!r.ok) {
      console.warn('Portals upstream returned', r.status, upstream);
      return res.json([]);
    }
    const data = await r.json();
    const list = Array.isArray(data) ? data : [];
    // Remove our own entry so we never show a portal back to ourselves
    const selfOrigin = new URL(req.protocol + '://' + req.get('host')).origin;
    const filtered = list.filter((p) => {
      if (!p?.url) return false;
      try { return new URL(p.url).origin !== selfOrigin; } catch { return true; }
    });
    res.json(mergePortalHub(filtered, base));
  } catch (err) {
    console.warn('Could not reach portals server:', err.message, upstream);
    res.json([]);
  }
});

app.use(express.static(join(__dirname, 'public')));
app.use('/assets', express.static(join(__dirname, 'assets')));
// Portal mesh: always served from vendor/ (separate portals repo is not bundled on deploy).
// If you clone the portals repo beside this app (../portals), that copy wins locally for iteration.
const siblingPortals = join(__dirname, '..', 'portals');
if (existsSync(siblingPortals)) {
  app.use('/vendor/portals', express.static(siblingPortals));
}
app.use('/vendor/portals', express.static(join(__dirname, 'vendor', 'portals')));

const server = createServer(app);
attachMultiplayerWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
