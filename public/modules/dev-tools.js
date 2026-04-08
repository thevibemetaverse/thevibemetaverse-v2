// @ts-check
import * as THREE from 'three';
import { state } from './state.js';
import { getLoadedModels, onModelLoaded } from './models.js';

let selectedModel = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** @type {Record<string, HTMLInputElement>} */
const inputs = {};

export function initDevTools() {
  buildUI();
  setupClickSelection();

  onModelLoaded(() => {
    refreshDropdown();
    if (!selectedModel) {
      const first = getLoadedModels().values().next().value;
      if (first) selectModel(first);
    }
  });
}

function buildUI() {
  const slot = document.getElementById('dev-tools-slot');
  if (!slot) return;

  slot.innerHTML = `
    <div class="settings-panel__divider"></div>
    <div class="settings-panel__section-title">Model Editor</div>
    <div class="settings-panel__row">
      <select id="dt-model-select" class="settings-panel__select">
        <option value="">-- select model --</option>
      </select>
    </div>
    <div class="dt-model-name" id="dt-selected-name">No model selected</div>
    <div class="settings-panel__section-title">Position</div>
    <div class="settings-panel__input-row">
      <label>X</label><input type="number" id="dt-px" step="0.5">
      <label>Y</label><input type="number" id="dt-py" step="0.5">
      <label>Z</label><input type="number" id="dt-pz" step="0.5">
    </div>
    <div class="settings-panel__section-title">Rotation (deg)</div>
    <div class="settings-panel__input-row">
      <label>X</label><input type="number" id="dt-rx" step="5">
      <label>Y</label><input type="number" id="dt-ry" step="5">
      <label>Z</label><input type="number" id="dt-rz" step="5">
    </div>
    <div class="settings-panel__section-title">Scale</div>
    <div class="settings-panel__input-row">
      <label>X</label><input type="number" id="dt-sx" step="0.1">
      <label>Y</label><input type="number" id="dt-sy" step="0.1">
      <label>Z</label><input type="number" id="dt-sz" step="0.1">
    </div>
    <div class="settings-panel__row settings-panel__buttons">
      <button id="dt-copy" type="button">Copy Config</button>
      <button id="dt-copy-all" type="button">Copy All</button>
    </div>
    <div id="dt-toast" class="dt-toast"></div>
  `;

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
  if (!select) return;
  const models = getLoadedModels();
  const currentCount = select.options.length - 1;
  if (currentCount === models.size) return;

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
  const nameEl = document.getElementById('dt-selected-name');
  if (nameEl) nameEl.textContent = model.name || '(unnamed)';

  const select = /** @type {HTMLSelectElement} */ (document.getElementById('dt-model-select'));
  if (select) select.value = model.name || '';

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
    refreshDropdown();

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, state.camera);

    const targets = [];
    for (const [, model] of getLoadedModels()) {
      model.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
    }

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
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
  if (!toast) return;
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
  if (!selectedModel) return;
}
