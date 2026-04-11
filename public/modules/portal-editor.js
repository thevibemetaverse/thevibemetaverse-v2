// @ts-check
import * as THREE from 'three';
import {
  getMovablePortalHandles,
  swapPortalModelByHandleId,
  onPortalsReady,
} from './portals.js';
import {
  PORTAL_GLOBAL_X_OFFSET,
  PORTAL_VIEW_LEFT_BIAS_X,
} from './constants.js';

/** @type {ReturnType<typeof getMovablePortalHandles>} */
let handles = [];
let selectedHandle = null;

/** @type {Record<string, HTMLInputElement>} */
const inputs = {};

export function initPortalEditor() {
  buildUI();
  onPortalsReady(() => {
    handles = getMovablePortalHandles();
    refreshPortalDropdown();
    if (handles.length > 0) selectHandle(handles[0]);
  });
}

function buildUI() {
  const slot = document.getElementById('portal-editor-slot');
  if (!slot) return;

  slot.innerHTML = `
    <div class="settings-panel__divider"></div>
    <div class="settings-panel__section-title">Portal Editor</div>

    <div class="settings-panel__row">
      <select id="pe-portal-select" class="settings-panel__select">
        <option value="">-- select portal --</option>
      </select>
    </div>
    <div class="dt-model-name" id="pe-selected-name">No portal selected</div>

    <div id="pe-model-row-wrap">
      <div class="settings-panel__section-title">Model</div>
      <div class="settings-panel__row">
        <select id="pe-model-select" class="settings-panel__select">
          <option value="assets/models/portal_black_and_gold.glb">black_and_gold</option>
          <option value="assets/models/portal_grey.glb">grey</option>
          <option value="assets/models/portal_tan.glb">tan</option>
        </select>
      </div>
    </div>

    <div class="settings-panel__section-title">Position</div>
    <div class="settings-panel__input-row">
      <label>X</label><input type="number" id="pe-px" step="0.5">
      <label>Y</label><input type="number" id="pe-py" step="0.5">
      <label>Z</label><input type="number" id="pe-pz" step="0.5">
    </div>

    <div class="settings-panel__section-title">Rotation (deg)</div>
    <div class="settings-panel__input-row">
      <label>X</label><input type="number" id="pe-rx" step="5">
      <label>Y</label><input type="number" id="pe-ry" step="5">
      <label>Z</label><input type="number" id="pe-rz" step="5">
    </div>

    <div class="settings-panel__row settings-panel__buttons">
      <button id="pe-copy" type="button">Copy Config</button>
    </div>
    <div id="pe-toast" class="dt-toast"></div>
  `;

  for (const id of ['px', 'py', 'pz', 'rx', 'ry', 'rz']) {
    inputs[id] = /** @type {HTMLInputElement} */ (
      document.getElementById(`pe-${id}`)
    );
    inputs[id].addEventListener('input', onInputChange);
  }

  document
    .getElementById('pe-portal-select')
    .addEventListener('change', onPortalDropdownChange);
  document
    .getElementById('pe-model-select')
    .addEventListener('change', onModelDropdownChange);
  document.getElementById('pe-copy').addEventListener('click', copySelectedConfig);
}

function refreshPortalDropdown() {
  const select = /** @type {HTMLSelectElement} */ (
    document.getElementById('pe-portal-select')
  );
  if (!select) return;
  select.innerHTML = '<option value="">-- select portal --</option>';
  for (const h of handles) {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.label;
    select.appendChild(opt);
  }
}

function onPortalDropdownChange(e) {
  const id = /** @type {HTMLSelectElement} */ (e.target).value;
  const h = handles.find((x) => x.id === id);
  if (h) selectHandle(h);
}

async function onModelDropdownChange(e) {
  if (!selectedHandle || selectedHandle.kind !== 'registry') return;
  const path = /** @type {HTMLSelectElement} */ (e.target).value;
  await swapPortalModelByHandleId(selectedHandle.id, path);
  // Refresh handles so the modelPath we read next time is current. The
  // group reference is stable, so re-selecting by id just re-reads the
  // new modelPath into our local selection.
  handles = getMovablePortalHandles();
  const same = handles.find((h) => h.id === selectedHandle.id);
  if (same) selectedHandle = same;
}

function selectHandle(h) {
  selectedHandle = h;
  const nameEl = document.getElementById('pe-selected-name');
  if (nameEl) nameEl.textContent = h.label;

  const select = /** @type {HTMLSelectElement} */ (
    document.getElementById('pe-portal-select')
  );
  if (select) select.value = h.id;

  // Model dropdown only applies to registry portals — hide it for the
  // always-torus pieter and return portals.
  const modelWrap = document.getElementById('pe-model-row-wrap');
  const modelSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById('pe-model-select')
  );
  if (h.kind === 'registry') {
    if (modelWrap) modelWrap.style.display = '';
    if (modelSelect && h.modelPath) modelSelect.value = h.modelPath;
  } else {
    if (modelWrap) modelWrap.style.display = 'none';
  }

  const g = h.group;
  inputs.px.value = String(round(g.position.x));
  inputs.py.value = String(round(g.position.y));
  inputs.pz.value = String(round(g.position.z));
  inputs.rx.value = String(round(THREE.MathUtils.radToDeg(g.rotation.x)));
  inputs.ry.value = String(round(THREE.MathUtils.radToDeg(g.rotation.y)));
  inputs.rz.value = String(round(THREE.MathUtils.radToDeg(g.rotation.z)));
}

function onInputChange() {
  if (!selectedHandle) return;
  const g = selectedHandle.group;
  g.position.set(
    parseFloat(inputs.px.value) || 0,
    parseFloat(inputs.py.value) || 0,
    parseFloat(inputs.pz.value) || 0
  );
  g.rotation.set(
    THREE.MathUtils.degToRad(parseFloat(inputs.rx.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inputs.ry.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inputs.rz.value) || 0)
  );
}

function showToast(msg) {
  const toast = /** @type {HTMLElement & { _timer?: number }} */ (
    document.getElementById('pe-toast')
  );
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = /** @type {any} */ (
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2000)
  );
}

function copySelectedConfig() {
  if (!selectedHandle) return;
  const g = selectedHandle.group;
  const x = round(g.position.x);
  const y = round(g.position.y);
  const z = round(g.position.z);
  const rx = round(THREE.MathUtils.radToDeg(g.rotation.x));
  const ry = round(THREE.MathUtils.radToDeg(g.rotation.y));
  const rz = round(THREE.MathUtils.radToDeg(g.rotation.z));

  let text;
  if (selectedHandle.kind === 'pieter') {
    const pieterXConst = round(x - PORTAL_GLOBAL_X_OFFSET - PORTAL_VIEW_LEFT_BIAS_X);
    text =
      `// Pieter portal — paste into public/modules/constants.js\n` +
      `PORTAL_PIETER_X = ${pieterXConst};\n` +
      `PORTAL_PIETER_ELEVATION_Y = ${y};\n` +
      `PORTAL_ROW_Z = ${z};\n` +
      `PORTAL_PIETER_ROTATION_DEG = [${rx}, ${ry}, ${rz}];`;
  } else if (selectedHandle.kind === 'return') {
    text =
      `// Custom return portal — no dedicated X/Y constants.\n` +
      `// Nearest editable: PORTAL_RETURN_Z in constants.js.\n` +
      `PORTAL_RETURN_Z = ${z};\n` +
      `// full transform for reference:\n` +
      `//   position: [${x}, ${y}, ${z}]\n` +
      `//   rotation (deg): [${rx}, ${ry}, ${rz}]`;
  } else {
    const slug = selectedHandle.slug ?? '';
    const modelPath = selectedHandle.modelPath ?? '';
    text =
      `// Registry portal override — paste inside initPortals after the scatter loop:\n` +
      `{\n` +
      `  const p = portals.find((q) => q.data?.slug === ${JSON.stringify(slug)});\n` +
      `  if (p) {\n` +
      `    p.group.position.set(${x}, ${y}, ${z});\n` +
      `    p.group.rotation.set(\n` +
      `      THREE.MathUtils.degToRad(${rx}),\n` +
      `      THREE.MathUtils.degToRad(${ry}),\n` +
      `      THREE.MathUtils.degToRad(${rz}),\n` +
      `    );\n` +
      `    // model: ${modelPath}\n` +
      `  }\n` +
      `}`;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied portal config to clipboard');
  });
}

function round(n) {
  return Math.round(n * 100) / 100;
}
