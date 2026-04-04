import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Before express.static so this is never shadowed by public/portals.json
app.get('/portals.json', async (req, res) => {
  const base = (process.env.PORTALS_SERVER || 'http://localhost:3001').replace(/\/$/, '');
  const upstream = `${base}/portals.json`;
  try {
    const r = await fetch(upstream);
    if (!r.ok) {
      console.warn('Portals upstream returned', r.status, upstream);
      return res.json([]);
    }
    const data = await r.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn('Could not reach portals server:', err.message, upstream);
    res.json([]);
  }
});

app.use(express.static(join(__dirname, 'public')));
app.use('/assets', express.static(join(__dirname, 'assets')));
// Shared portal visuals (portal-mesh.js) — single source with ../portals package
app.use('/vendor/portals', express.static(join(__dirname, '..', 'portals')));

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
