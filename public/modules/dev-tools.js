// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { getLoadedModels, onModelLoaded } from './models.js';

let panel = null;
let selectedModel = null;
let isActive = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** @type {Record<string, HTMLInputElement>} */
const inputs = {};

export function initDevTools() {
  // Activate with ?dev=true in URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'true') return;

  isActive = true;
  createPanel();
  setupClickSelection();

  // When models finish loading, refresh dropdown and auto-select first
  onModelLoaded(() => {
    refreshDropdown();
    if (!selectedModel) {
      const first = getLoadedModels().values().next().value;
      if (first) selectModel(first);
    }
  });

  console.log('[Dev Tools] Active — double-click a model or use dropdown to select');
}

function createPanel() {
  panel = document.createElement('div');
  panel.id = 'dev-tools-panel';
  panel.innerHTML = `
    <style>
      #dev-tools-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.85);
        color: #eee;
        padding: 14px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 13px;
        z-index: 10000;
        min-width: 260px;
        user-select: none;
      }
      #dev-tools-panel h3 {
        margin: 0 0 10px;
        font-size: 14px;
        color: #6cf;
      }
      #dev-tools-panel .dt-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }
      #dev-tools-panel label {
        width: 28px;
        text-align: right;
        flex-shrink: 0;
      }
      #dev-tools-panel input[type="number"] {
        width: 70px;
        background: #222;
        color: #eee;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 3px 5px;
        font-family: monospace;
        font-size: 12px;
      }
      #dev-tools-panel .dt-section {
        margin-bottom: 10px;
      }
      #dev-tools-panel .dt-section-title {
        color: #aaa;
        font-size: 11px;
        margin-bottom: 4px;
        text-transform: uppercase;
      }
      #dev-tools-panel button {
        background: #335;
        color: #eee;
        border: 1px solid #557;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-family: monospace;
        font-size: 12px;
        margin-right: 6px;
      }
      #dev-tools-panel button:hover { background: #447; }
      #dev-tools-panel .dt-model-name {
        color: #6f6;
        font-size: 13px;
        margin-bottom: 8px;
      }
      #dev-tools-panel select {
        background: #222;
        color: #eee;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 3px 5px;
        font-family: monospace;
        font-size: 12px;
        width: 100%;
        margin-bottom: 8px;
      }
    </style>
    <h3>Dev Tools</h3>
    <div>
      <select id="dt-model-select"><option value="">-- click or select model --</option></select>
    </div>
    <div class="dt-model-name" id="dt-selected-name">No model selected</div>
    <div class="dt-section">
      <div class="dt-section-title">Position</div>
      <div class="dt-row"><label>X</label><input type="number" id="dt-px" step="0.5"></div>
      <div class="dt-row"><label>Y</label><input type="number" id="dt-py" step="0.5"></div>
      <div class="dt-row"><label>Z</label><input type="number" id="dt-pz" step="0.5"></div>
    </div>
    <div class="dt-section">
      <div class="dt-section-title">Rotation (deg)</div>
      <div class="dt-row"><label>X</label><input type="number" id="dt-rx" step="5"></div>
      <div class="dt-row"><label>Y</label><input type="number" id="dt-ry" step="5"></div>
      <div class="dt-row"><label>Z</label><input type="number" id="dt-rz" step="5"></div>
    </div>
    <div class="dt-section">
      <div class="dt-section-title">Scale</div>
      <div class="dt-row"><label>X</label><input type="number" id="dt-sx" step="0.1"></div>
      <div class="dt-row"><label>Y</label><input type="number" id="dt-sy" step="0.1"></div>
      <div class="dt-row"><label>Z</label><input type="number" id="dt-sz" step="0.1"></div>
    </div>
    <div>
      <button id="dt-copy">Copy Config</button>
      <button id="dt-copy-all">Copy All</button>
    </div>
    <div id="dt-toast" style="display:none; margin-top:8px; color:#6f6; font-size:12px;"></div>
  `;
  document.body.appendChild(panel);

  // Cache input refs
  for (const id of ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz']) {
    inputs[id] = /** @type {HTMLInputElement} */ (document.getElementById(`dt-${id}`));
    inputs[id].addEventListener('input', onInputChange);
  }

  document.getElementById('dt-copy').addEventListener('click', copySelectedConfig);
  document.getElementById('dt-copy-all').addEventListener('click', copyAllConfigs);
  document.getElementById('dt-model-select').addEventListener('change', onDropdownSelect);
}

function refreshDropdown() {
  const select = /** @type {HTMLSelectElement} */ (document.getElementById('dt-model-select'));
  const models = getLoadedModels();
  // Keep existing options if count matches
  const currentCount = select.options.length - 1;
  if (currentCount === models.size) return;

  // Rebuild options
  select.innerHTML = '<option value="">-- select model --</option>';
  for (const [name] of models) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

function onDropdownSelect(e) {
  const name = /** @type {HTMLSelectElement} */ (e.target).value;
  if (!name) return;
  const model = getLoadedModels().get(name);
  if (model) selectModel(model);
}

function selectModel(model) {
  selectedModel = model;
  document.getElementById('dt-selected-name').textContent = model.name || '(unnamed)';

  // Update dropdown
  const select = /** @type {HTMLSelectElement} */ (document.getElementById('dt-model-select'));
  select.value = model.name || '';

  // Fill inputs from model
  inputs.px.value = String(round(model.position.x));
  inputs.py.value = String(round(model.position.y));
  inputs.pz.value = String(round(model.position.z));
  inputs.rx.value = String(round(THREE.MathUtils.radToDeg(model.rotation.x)));
  inputs.ry.value = String(round(THREE.MathUtils.radToDeg(model.rotation.y)));
  inputs.rz.value = String(round(THREE.MathUtils.radToDeg(model.rotation.z)));
  inputs.sx.value = String(round(model.scale.x));
  inputs.sy.value = String(round(model.scale.y));
  inputs.sz.value = String(round(model.scale.z));
}

function onInputChange() {
  if (!selectedModel) return;

  selectedModel.position.set(
    parseFloat(inputs.px.value) || 0,
    parseFloat(inputs.py.value) || 0,
    parseFloat(inputs.pz.value) || 0
  );
  selectedModel.rotation.set(
    THREE.MathUtils.degToRad(parseFloat(inputs.rx.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inputs.ry.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inputs.rz.value) || 0)
  );
  selectedModel.scale.set(
    parseFloat(inputs.sx.value) || 1,
    parseFloat(inputs.sy.value) || 1,
    parseFloat(inputs.sz.value) || 1
  );
}

function setupClickSelection() {
  state.renderer.domElement.addEventListener('dblclick', (e) => {
    if (!isActive) return;
    refreshDropdown();

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, state.camera);

    // Collect all model meshes
    const targets = [];
    for (const [, model] of getLoadedModels()) {
      model.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
    }

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      // Walk up to find the root model (direct child of scene)
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== state.scene) {
        obj = obj.parent;
      }
      selectModel(obj);
    }
  });
}

function getConfigForModel(model) {
  const sx = round(model.scale.x);
  const sy = round(model.scale.y);
  const sz = round(model.scale.z);
  const isUniform = sx === sy && sy === sz;

  return {
    name: model.name,
    path: model.userData.path || '/* update path */',
    position: [round(model.position.x), round(model.position.y), round(model.position.z)],
    rotation: [
      round(THREE.MathUtils.radToDeg(model.rotation.x)),
      round(THREE.MathUtils.radToDeg(model.rotation.y)),
      round(THREE.MathUtils.radToDeg(model.rotation.z)),
    ],
    scale: isUniform ? sx : [sx, sy, sz],
  };
}

function showToast(msg) {
  const toast = document.getElementById('dt-toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

function copySelectedConfig() {
  if (!selectedModel) return;
  const config = getConfigForModel(selectedModel);
  const text = JSON.stringify(config, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied config to clipboard');
  });
}

function copyAllConfigs() {
  const configs = [];
  for (const [, model] of getLoadedModels()) {
    configs.push(getConfigForModel(model));
  }
  const text = JSON.stringify(configs, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${configs.length} model config(s) to clipboard`);
  });
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export function updateDevTools() {
  if (!isActive || !selectedModel) return;
  // Sync inputs if model was moved externally
  // (currently models are static, but this future-proofs it)
}
