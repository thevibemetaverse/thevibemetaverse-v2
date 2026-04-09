// @ts-check
import * as THREE from 'three';
import { CAMERA_ORBIT_DISTANCE, CAMERA_ORBIT_HEIGHT, DEFAULT_PLAYER_NAME } from './constants.js';

/**
 * @typedef {'EXPLORING' | 'PROMPTING' | 'IN_ROOM'} GameState
 */

/**
 * @typedef {Object} RoomPortalInfo
 * @property {number} countdown
 * @property {number} playerCount
 */

/**
 * @typedef {'first' | 'third'} VrPovMode
 */

/**
 * @typedef {Object} DomRefs
 * @property {HTMLElement | null} errorToast
 */

/**
 * @typedef {Object} RemotePlayerRecord
 * @property {string} id
 * @property {string} avatarUrl
 * @property {string} name
 * @property {import('three').Group} group
 * @property {import('three').Object3D | null} modelRoot
 * @property {import('three').AnimationMixer | null} animationMixer
 * @property {import('three').AnimationAction | null} idleAnimAction
 * @property {import('three').AnimationAction | null} runAnimAction
 * @property {boolean | null} lastMovingState
 * @property {import('three').Vector3} targetPosition
 * @property {number} targetRotY
 * @property {boolean} moving
 * @property {import('three').Sprite | null} nametagSprite
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
 * @property {{x: number, z: number}} moveInput - Normalized movement vector from joystick (0,0 when idle)
 * @property {boolean} isTouchDevice - Whether touch input is available
 *
 * @property {boolean} webXrSupported - immersive-vr supported (hides touch overlays when true)
 * @property {VrPovMode} vrPov - VR camera mode (third = default)
 * @property {number} headYaw - headset yaw on XZ plane (rad), updated while in XR
 * @property {number} vrComfortYaw - FP VR extra yaw from right stick (rad)
 * @property {{ x: number, z: number }} controllerMove - left stick (gamepad / XR), deadzoned
 * @property {{ x: number, z: number }} controllerLook - right stick look / orbit input
 * @property {import('three').Group | null} xrRig - parent of camera while in XR
 * @property {import('three').Group | null} xrTrackingScale - uniform scale (meters → world units) between xrRig and camera in VR
 * @property {import('three').Sprite | null} exitVrSprite - view-space exit control
 * @property {boolean} prevVrYButton - edge-detect Quest Y (left hand)
 *
 * @property {GameState} gameState
 * @property {Set<string>} occupiedCells - Grid cell keys ("x,z") claimed by placed objects
 * @property {THREE.Object3D[]} placedObjects - AI-generated objects added to the scene
 * @property {boolean} devMode - Whether dev tools are active
 *
 * @property {string | null} localPlayerId - Assigned by multiplayer welcome (UUID).
 * @property {boolean} localPlayerMoving - Updated each frame from movement input (for network).
 * @property {string} localPlayerName - Display name above head (default 'metaverse-explorer').
 *
 * @property {Map<string, RemotePlayerRecord>} remotePlayers - Other clients (id → record).
 *
 * @property {string} currentRoom - 'lobby' or a room ID.
 * @property {string} currentRoomGameUrl - Game URL for the current meeting room.
 * @property {string} currentRoomGameTitle - Human-readable game title for the current room.
 * @property {THREE.Group | null} lobbyGroup - Container for all lobby objects.
 * @property {THREE.Group | null} meetingRoomGroup - Container for meeting room objects.
 * @property {Map<string, RoomPortalInfo>} roomCountdowns - Per-room info for portal display.
 * @property {Array<{id: string, name: string}>} roomPlayers - Players in the current room.
 * @property {number | null} roomCountdown - Countdown seconds for current room.
 * @property {string | null} roomHostName - Display name of the current room host.
 * @property {boolean} isRoomHost - Whether the local player is the room host.
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
  orbitDistance: CAMERA_ORBIT_DISTANCE,
  orbitHeight: CAMERA_ORBIT_HEIGHT,
  isPointerDown: false,
  moveInput: { x: 0, z: 0 },
  isTouchDevice: false,

  webXrSupported: false,
  vrPov: 'third',
  headYaw: 0,
  vrComfortYaw: 0,
  controllerMove: { x: 0, z: 0 },
  controllerLook: { x: 0, z: 0 },
  xrRig: null,
  xrTrackingScale: null,
  exitVrSprite: null,
  prevVrYButton: false,

  // Game
  gameState: 'EXPLORING',
  occupiedCells: new Set(),
  placedObjects: [],
  devMode: false,

  localPlayerId: null,
  localPlayerMoving: false,
  localPlayerName: DEFAULT_PLAYER_NAME,
  remotePlayers: new Map(),

  // Rooms
  currentRoom: 'lobby',
  currentRoomGameUrl: '',
  currentRoomGameTitle: '',
  lobbyGroup: null,
  meetingRoomGroup: null,
  roomCountdowns: new Map(),
  roomPlayers: [],
  roomCountdown: null,
  roomHostName: null,
  isRoomHost: false,

  /** @type {string | null} */
  _pendingDirectRoomId: null,

  // DOM refs (populated in init)
  dom: { errorToast: null },
};
