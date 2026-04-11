// @ts-check
import * as THREE from 'three';
import { gltfLoader } from './loader.js';
import { state } from './state.js';

/**
 * @typedef {Object} ModelPlacement
 * @property {string} name - Unique identifier for this placement
 * @property {string} path - URL or relative path to the .glb/.gltf file
 * @property {[number, number, number]} position - [x, y, z]
 * @property {[number, number, number]} [rotation] - [x, y, z] in degrees
 * @property {[number, number, number] | number} [scale] - Uniform number or [x, y, z]
 * @property {boolean} [noReceiveShadow] - Skip receiveShadow on all meshes (use for models with interior/small surfaces)
 */

/** @type {ModelPlacement[]} */
export const MODEL_PLACEMENTS = [
  {
    name: 'chest-freezer',
    path: 'assets/models/chest_freezer.glb',
    position: [43, 3, -38.5],
    rotation: [0, -50, 0],
    scale: 0.1,
  },
  {
    name: 'bbq-sauce',
    path: 'assets/models/sweet_baby_rays_bbq_sauce.glb',
    position: [35, 5, -51.5],
    rotation: [0, -25, 0],
    scale: 5,
  },
  {
    name: 'eiffel-tower',
    path: 'assets/models/eiffel_tower.glb',
    position: [2, 0, -100.5],
    rotation: [0, -90, 0],
    scale: 10,
  },
];

/** @type {Map<string, THREE.Object3D>} */
const loadedModels = new Map();

/** @type {Array<() => void>} */
const onLoadCallbacks = [];

const loader = gltfLoader;

/**
 * Load and place a single model in the scene.
 * @param {ModelPlacement} placement
 * @returns {Promise<THREE.Object3D>}
 */
function loadModel(placement) {
  return new Promise((resolve, reject) => {
    loader.load(
      placement.path,
      (gltf) => {
        const model = gltf.scene;
        model.name = placement.name;
        model.userData.path = placement.path;

        // Position
        model.position.set(...placement.position);

        // Rotation (degrees -> radians)
        if (placement.rotation) {
          model.rotation.set(
            THREE.MathUtils.degToRad(placement.rotation[0]),
            THREE.MathUtils.degToRad(placement.rotation[1]),
            THREE.MathUtils.degToRad(placement.rotation[2])
          );
        }

        // Scale
        if (placement.scale != null) {
          if (typeof placement.scale === 'number') {
            model.scale.setScalar(placement.scale);
          } else {
            model.scale.set(...placement.scale);
          }
        }

        // Shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            if (!placement.noReceiveShadow) child.receiveShadow = true;
          }
        });

        state.scene.add(model);
        loadedModels.set(placement.name, model);
        onLoadCallbacks.forEach((cb) => cb());
        resolve(model);
      },
      undefined,
      (err) => {
        console.error(`Failed to load model "${placement.name}":`, err);
        reject(err);
      }
    );
  });
}

/** Register a callback that fires each time a model finishes loading. */
export function onModelLoaded(cb) {
  onLoadCallbacks.push(cb);
}

/** Load all models from the registry. */
export function initModels() {
  for (const placement of MODEL_PLACEMENTS) {
    loadModel(placement);
  }
}

/** Get a loaded model by name. */
export function getModel(name) {
  return loadedModels.get(name);
}

/** Get all loaded models. */
export function getLoadedModels() {
  return loadedModels;
}
