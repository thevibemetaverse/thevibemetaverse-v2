// @ts-check
import * as THREE from 'three';

/**
 * @typedef {'EXPLORING' | 'PROMPTING'} GameState
 */

/**
 * @typedef {Object} DomRefs
 * @property {HTMLElement | null} errorToast
 */

/**
 * @typedef {Object} GameStateObject
 *
 * @property {THREE.Scene | null} scene
 * @property {THREE.PerspectiveCamera | null} camera
 * @property {THREE.WebGLRenderer | null} renderer
 *
 * @property {THREE.Group | null} player - Root group for the player entity
 * @property {THREE.Object3D | null} playerModel - The loaded GLTF avatar model
 * @property {THREE.AnimationMixer | null} animationMixer
 * @property {THREE.AnimationAction | null} idleAnimAction
 * @property {THREE.AnimationAction | null} runAnimAction
 * @property {boolean | null} lastMovingState - Tracks previous frame's movement for crossfade
 * @property {THREE.Clock} clock
 *
 * @property {Record<string, boolean>} keys - Currently pressed key codes
 * @property {number} orbitAngle - Camera orbit angle in radians
 * @property {number} orbitDistance - Camera distance from player
 * @property {number} orbitHeight - Camera height above player
 * @property {boolean} isPointerDown - Whether the mouse/pointer is held down
 *
 * @property {GameState} gameState
 * @property {Set<string>} occupiedCells - Grid cell keys ("x,z") claimed by placed objects
 * @property {THREE.Object3D[]} placedObjects - AI-generated objects added to the scene
 *
 * @property {DomRefs} dom
 */

/** @type {GameStateObject} */
export const state = {
  // Three.js core
  scene: null,
  camera: null,
  renderer: null,

  // Player
  player: null,
  playerModel: null,
  animationMixer: null,
  idleAnimAction: null,
  runAnimAction: null,
  lastMovingState: null,
  clock: new THREE.Clock(),

  // Input
  keys: {},
  orbitAngle: 0,
  orbitDistance: 14,
  orbitHeight: 6,
  isPointerDown: false,

  // Game
  gameState: 'EXPLORING',
  occupiedCells: new Set(),
  placedObjects: [],

  // DOM refs (populated in init)
  dom: { errorToast: null },
};
