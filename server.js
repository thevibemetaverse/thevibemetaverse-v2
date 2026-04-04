import 'dotenv/config';
import express from 'express';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PORTALS_PRODUCTION_ORIGIN } from './vendor/portals/sdk/network.js';

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

const CODEGEN_SYSTEM_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'codegen-system.txt'), 'utf-8'
);

/** Strip markdown code fences and extract just the JS code body. */
function extractCode(text) {
  let code = text.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const fnMatch = code.match(/^(?:function\s*\w*\s*\(\s*THREE\s*\)\s*\{)([\s\S]*)\}\s*$/);
  if (fnMatch) code = fnMatch[1].trim();
  return code;
}

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: CODEGEN_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Create: ${prompt}` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return res.status(502).json({ error: 'AI generation failed' });
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');
    const code = extractCode(text);

    if (!code || code.length < 10) {
      return res.status(502).json({ error: 'AI returned empty code' });
    }

    res.json({ code });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
