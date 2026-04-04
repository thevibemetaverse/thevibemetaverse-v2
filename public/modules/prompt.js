import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { state } from './state.js';
import { updateHUD, showError } from './hud.js';
import { placeGeneratedObject } from './placement.js';
import { setMovingAnimation } from './character.js';

const CSG = { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION };

export function openPrompt() {
  if (state.gameState !== 'EXPLORING' || state.promptsRemaining <= 0) return;
  state.gameState = 'PROMPTING';
  Object.keys(state.keys).forEach(k => state.keys[k] = false);
  setMovingAnimation(false);
  state.dom.promptBar.classList.add('visible');
  state.dom.promptInput.value = '';
  state.dom.promptInput.focus();
  state.dom.tabHint.style.display = 'none';
}

export function closePrompt() {
  state.gameState = 'EXPLORING';
  state.dom.promptBar.classList.remove('visible');
  state.dom.promptInput.value = '';
  state.dom.promptInput.blur();
  if (state.promptsRemaining > 0) state.dom.tabHint.style.display = 'block';
}

export async function submitPrompt() {
  const text = state.dom.promptInput.value.trim();
  if (!text) return;

  state.gameState = 'GENERATING';
  state.dom.promptBar.classList.remove('visible');
  state.dom.materializingEl.classList.add('visible');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const { code } = await res.json();
    if (!code) throw new Error('No code returned');

    const group = executeGeneratedCode(code);
    if (!group) throw new Error('Code did not produce a valid object');

    placeGeneratedObject(group);
    state.promptsRemaining--;
    updateHUD();
  } catch (err) {
    console.error('Generation failed:', err);
    showError('Something went wrong — prompt not consumed');
  }

  state.dom.materializingEl.classList.remove('visible');
  state.gameState = 'EXPLORING';
  if (state.promptsRemaining > 0) state.dom.tabHint.style.display = 'block';
}

function executeGeneratedCode(code) {
  try {
    const fn = new Function('THREE', 'CSG', code);
    const result = fn(THREE, CSG);
    if (result && result.isGroup) return result;
    if (result && result.isMesh) {
      const g = new THREE.Group();
      g.add(result);
      return g;
    }
    console.error('Generated code did not return a Group or Mesh');
    return null;
  } catch (e) {
    console.error('Generated code execution error:', e);
    return null;
  }
}
