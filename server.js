import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/assets', express.static(join(__dirname, 'assets')));

const VOXEL_SYSTEM_PROMPT = `You are a voxel object generator. Given a description, return ONLY valid JSON (no markdown, no backticks, no explanation).

Return this shape:
{
  "blocks": [
    { "x": 0, "y": 0, "z": 0, "color": "#8B4513" },
    { "x": 0, "y": 1, "z": 0, "color": "#8B4513" }
  ],
  "glow": null
}

Rules:
- Each block is a 1×1×1 cube at integer coordinates.
- x,y,z are RELATIVE to the object origin. y=0 is ground level. Build upward.
- Max 64 blocks. Max bounding box 8×8×8.
- Use color to convey material: brown for wood, gray for stone, green for leaves, etc.
- "glow" adds a point light to the object. Set to { "color": "#ffaa44", "intensity": 1.5 } for things that emit light, or null for everything else.
- Be creative but recognizable. A "tree" should look like a tree in block form.
- Return ONLY the JSON.`;

/** First balanced `{ ... }` in text, respecting strings (handles preamble / trailing junk). */
function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseVoxelPayloadFromModelText(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const extracted = extractFirstJsonObject(clean);
    if (extracted) {
      return JSON.parse(extracted);
    }
    throw new Error('JSON parse failed after extraction');
  }
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
        max_tokens: 4096,
        system: VOXEL_SYSTEM_PROMPT,
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
    const voxelData = parseVoxelPayloadFromModelText(text);

    res.json(voxelData);
  } catch (err) {
    console.error('Generate error:', err);
    // #region agent log
    fetch('http://127.0.0.1:7772/ingest/6305c9be-d297-4877-b67b-49e5d9973c7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be2a27'},body:JSON.stringify({sessionId:'be2a27',location:'server.js:generate:catch',message:'generate handler error',data:{msg:String(err?.message)},timestamp:Date.now(),hypothesisId:'H1',runId:'dragon-debug'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
