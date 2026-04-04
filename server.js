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

const CODEGEN_SYSTEM_PROMPT = `You are a 3D object generator that writes Three.js code in a STYLIZED LOW-POLY aesthetic. Think games like Astroneer, Crossy Road, Monument Valley — clean geometry, pleasing colors, charming proportions.

Return ONLY a JavaScript function body. No markdown, no backticks, no explanation.
The code receives one argument: THREE (the Three.js library).
It MUST return a THREE.Group. y=0 is ground. Keep within ~8×8×8 units.

ART DIRECTION:
- Stylized, not realistic. Exaggerate proportions for charm (big heads, stubby legs, etc.)
- Use a cohesive color palette — 3-5 harmonious colors per object, not random hex values
- Prefer smooth shading (high segment counts: 32+ for spheres, 24+ for cylinders)
- Use MeshStandardMaterial: vary roughness (0.3 for polished, 0.9 for matte) and metalness meaningfully
- Add subtle color variation between similar parts (slightly shift hue/lightness)
- For living things: round, soft shapes. For man-made things: crisp edges + smooth curves

GEOMETRY TOOLKIT:
- SphereGeometry(r, 32, 24) — organic forms, heads, bodies (use partial: phiStart/phiLength/thetaStart/thetaLength)
- CylinderGeometry(rTop, rBot, h, 24) — taper for limbs (different top/bottom radius)
- LatheGeometry(points, 24) — surfaces of revolution: vases, bottles, tree trunks, horns
- TubeGeometry(curve, 20, radius, 8) — tails, tentacles, branches, handles
- ExtrudeGeometry(shape, {depth, bevelEnabled, bevelSize}) — flat profiles into 3D: stars, hearts, buildings
- THREE.Shape + moveTo/lineTo/bezierCurveTo — 2D profiles for extrusion
- THREE.CatmullRomCurve3 — smooth 3D paths for TubeGeometry
- TorusGeometry, TorusKnotGeometry, ConeGeometry, BoxGeometry
- Use castShadow=true on all visible meshes

CRITICAL RULES:
- NO gaps between parts. Overlap/intersect shapes at joints.
- Use helper functions and loops for repeated elements (petals, windows, scales, teeth).
- Proportions matter more than detail count. Get the silhouette right first.
- Ground the object: make sure it sits ON y=0, not floating.

EXAMPLE — "a fox" (stylized animal):
const g = new THREE.Group();
const mat = (color, r=0.7) => new THREE.MeshStandardMaterial({color, roughness:r, metalness:0.05});
// Body — elongated sphere
const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat(0xE8751A));
body.scale.set(1, 0.85, 1.4);
body.position.set(0, 1.8, 0);
body.castShadow = true;
g.add(body);
// Head — large sphere (stylized big head)
const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 24), mat(0xF08030));
head.position.set(0, 2.5, 1.3);
head.castShadow = true;
g.add(head);
// Snout — small stretched sphere
const snout = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), mat(0xFAD0A0, 0.6));
snout.scale.set(0.8, 0.7, 1.2);
snout.position.set(0, 2.3, 1.9);
g.add(snout);
// Nose
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(0x222222, 0.3));
nose.position.set(0, 2.35, 2.2);
g.add(nose);
// Eyes
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(0x111111, 0.2));
  eye.position.set(side * 0.3, 2.7, 1.8);
  g.add(eye);
  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat(0xFFFFFF, 0.4));
  eyeWhite.position.set(side * 0.3, 2.7, 1.75);
  g.add(eyeWhite);
}
// Ears — cones
for (const side of [-1, 1]) {
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 12), mat(0xE8751A));
  ear.position.set(side * 0.35, 3.2, 1.2);
  ear.rotation.z = side * 0.2;
  ear.castShadow = true;
  g.add(ear);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 12), mat(0xFFC0A0, 0.5));
  inner.position.set(side * 0.35, 3.15, 1.25);
  inner.rotation.z = side * 0.2;
  g.add(inner);
}
// Legs — tapered cylinders
const legPositions = [[-0.45,0,0.5],[0.45,0,0.5],[-0.45,0,-0.5],[0.45,0,-0.5]];
for (const [lx,,lz] of legPositions) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 12), mat(0xD06818));
  leg.position.set(lx, 0.5, lz);
  leg.castShadow = true;
  g.add(leg);
  // Paw
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), mat(0x333333, 0.5));
  paw.scale.y = 0.5;
  paw.position.set(lx, 0.05, lz + 0.05);
  g.add(paw);
}
// Tail — curved tube
const tailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1.7, -1.2),
  new THREE.Vector3(0, 2.2, -1.8),
  new THREE.Vector3(0.1, 2.8, -1.9),
  new THREE.Vector3(0, 3.1, -1.5),
]);
const tailGeo = new THREE.TubeGeometry(tailCurve, 16, 0.15, 8, false);
const tail = new THREE.Mesh(tailGeo, mat(0xF08030));
tail.castShadow = true;
g.add(tail);
// White tail tip
const tipCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 2.8, -1.9),
  new THREE.Vector3(0, 3.1, -1.5),
]);
const tipGeo = new THREE.TubeGeometry(tipCurve, 8, 0.18, 8, false);
g.add(new THREE.Mesh(tipGeo, mat(0xFFF8F0)));
return g;

EXAMPLE — "a lantern" (man-made object):
const g = new THREE.Group();
const metal = (c) => new THREE.MeshStandardMaterial({color:c, roughness:0.3, metalness:0.8});
const glass = new THREE.MeshPhysicalMaterial({color:0xFFE4B0, transmission:0.6, roughness:0.1, ior:1.4, thickness:0.5, emissive:0xFF8C00, emissiveIntensity:0.3});
// Base plate
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.15, 24), metal(0x554433));
base.position.y = 0.075;
base.castShadow = true;
g.add(base);
// Glass body using LatheGeometry
const glassProfile = [
  new THREE.Vector2(0.5, 0.15), new THREE.Vector2(0.45, 0.5),
  new THREE.Vector2(0.4, 1.0), new THREE.Vector2(0.38, 1.5),
  new THREE.Vector2(0.4, 2.0), new THREE.Vector2(0.45, 2.3),
  new THREE.Vector2(0.35, 2.5),
];
const glassBody = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 24), glass);
glassBody.castShadow = true;
g.add(glassBody);
// Metal frame bars
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 8), metal(0x443322));
  bar.position.set(Math.cos(angle) * 0.42, 1.4, Math.sin(angle) * 0.42);
  bar.castShadow = true;
  g.add(bar);
}
// Top cap
const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 24), metal(0x554433));
cap.position.y = 2.75;
cap.castShadow = true;
g.add(cap);
// Handle ring
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), metal(0x554433));
handle.position.y = 3.1;
handle.castShadow = true;
g.add(handle);
// Inner glow light
const light = new THREE.PointLight(0xFF8C00, 2, 10);
light.position.y = 1.3;
g.add(light);
return g;

Return ONLY the function body code. No wrapping function, no markdown fences.`;

/** Strip markdown code fences and extract just the JS code body. */
function extractCode(text) {
  // Remove markdown code fences if present
  let code = text.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Remove wrapping function declaration if the model added one
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
    // #region agent log
    fetch('http://127.0.0.1:7772/ingest/6305c9be-d297-4877-b67b-49e5d9973c7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be2a27'},body:JSON.stringify({sessionId:'be2a27',location:'server.js:generate:catch',message:'generate handler error',data:{msg:String(err?.message)},timestamp:Date.now(),hypothesisId:'H1',runId:'dragon-debug'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
