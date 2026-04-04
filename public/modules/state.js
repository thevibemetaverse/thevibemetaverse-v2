import * as THREE from 'three';

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
  gameState: 'EXPLORING', // EXPLORING | PROMPTING | GENERATING
  promptsRemaining: 5,
  occupiedCells: new Set(),
  placedObjects: [],

  // DOM refs (populated in init)
  dom: {},
};
