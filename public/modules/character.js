import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state } from './state.js';
import { PLAYER_TARGET_HEIGHT, ANIMATION_CROSSFADE } from './constants.js';

export const BUNDLED_METAVERSE_EXPLORER = 'assets/models/metaverse-explorer.glb';
export const SAMPLE_FOX_GLB =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Fox/glTF-Binary/Fox.glb';
export const SAMPLE_DUCK_GLB =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF-Binary/Duck.glb';

export function disposePlayerVisualResources(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}

function disposeCurrentPlayerModel() {
  if (state.animationMixer) {
    state.animationMixer.stopAllAction();
    state.animationMixer = null;
  }
  state.idleAnimAction = null;
  state.runAnimAction = null;
  state.lastMovingState = null;
  if (state.playerModel) {
    state.player.remove(state.playerModel);
    disposePlayerVisualResources(state.playerModel);
    state.playerModel = null;
  }
}

function resetSkinnedMeshesToBindPose(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child.isSkinnedMesh && child.skeleton) {
      child.skeleton.pose();
    }
  });
}

function pickIdleAndRunClips(animations) {
  if (!animations.length) return { idle: null, run: null };
  const run =
    animations.find((c) => /run|sprint|jog/i.test(c.name)) ||
    animations.find((c) => /walk/i.test(c.name));
  const idle = animations.find((c) =>
    /idle|stand|breath|t-?pose/i.test(c.name)
  );
  if (idle && run) return { idle, run };
  if (animations.length >= 2) {
    return { idle: animations[0], run: animations[1] };
  }
  const only = animations[0];
  if (/idle|stand|breath/i.test(only.name)) {
    return { idle: only, run: null };
  }
  return { idle: null, run: only };
}

/**
 * @param {THREE.Object3D} modelRoot
 * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTF} gltf
 */
function setupCharacterAnimationsOnModel(modelRoot, gltf) {
  const clips = gltf.animations;
  if (!clips.length) {
    return {
      animationMixer: null,
      idleAnimAction: null,
      runAnimAction: null,
      lastMovingState: /** @type {boolean | null} */ (null),
    };
  }

  const animationMixer = new THREE.AnimationMixer(modelRoot);
  const { idle: idleClip, run: runClip } = pickIdleAndRunClips(clips);

  /** @type {THREE.AnimationAction | null} */
  let idleAnimAction = null;
  /** @type {THREE.AnimationAction | null} */
  let runAnimAction = null;

  if (idleClip) idleAnimAction = animationMixer.clipAction(idleClip);
  if (runClip) runAnimAction = animationMixer.clipAction(runClip);

  if (idleAnimAction && runAnimAction) {
    idleAnimAction.play();
    runAnimAction.play();
    runAnimAction.setEffectiveWeight(0);
  } else if (runAnimAction && !idleAnimAction) {
    runAnimAction.stop();
    resetSkinnedMeshesToBindPose(modelRoot);
  } else if (idleAnimAction) {
    idleAnimAction.play();
  }

  return {
    animationMixer,
    idleAnimAction,
    runAnimAction,
    lastMovingState: false,
  };
}

/**
 * Attach scaled avatar mesh and animations under parentGroup (e.g. local player or remote root).
 * @param {THREE.Group} parentGroup
 * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTF} gltf
 */
export function buildPlayerVisualFromGltf(parentGroup, gltf) {
  const modelRoot = gltf.scene;
  modelRoot.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const targetHeight = PLAYER_TARGET_HEIGHT;
  const scale = targetHeight / Math.max(size.y, 0.001);
  modelRoot.scale.setScalar(scale);

  box.setFromObject(modelRoot);
  const center = new THREE.Vector3();
  box.getCenter(center);
  modelRoot.position.set(-center.x, -box.min.y, -center.z);

  parentGroup.add(modelRoot);

  const anim = setupCharacterAnimationsOnModel(modelRoot, gltf);
  return {
    modelRoot,
    animationMixer: anim.animationMixer,
    idleAnimAction: anim.idleAnimAction,
    runAnimAction: anim.runAnimAction,
    lastMovingState: anim.lastMovingState,
  };
}

function applyLoadedGltf(gltf) {
  const v = buildPlayerVisualFromGltf(state.player, gltf);
  state.playerModel = v.modelRoot;
  state.animationMixer = v.animationMixer;
  state.idleAnimAction = v.idleAnimAction;
  state.runAnimAction = v.runAnimAction;
  state.lastMovingState = v.lastMovingState;
}

export function loadPlayerModelFromUrl(modelPath) {
  disposeCurrentPlayerModel();
  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => applyLoadedGltf(gltf),
    undefined,
    (err) => {
      console.error('Failed to load character model:', err);
    }
  );
}

export function loadPlayerModel() {
  const params = new URLSearchParams(window.location.search);
  const avatarUrl = params.get('avatar_url');
  const modelPath = avatarUrl || BUNDLED_METAVERSE_EXPLORER;
  loadPlayerModelFromUrl(modelPath);
}

export function replaceAvatarUrlInHistory(urlOrNull) {
  const u = new URL(window.location.href);
  if (urlOrNull) u.searchParams.set('avatar_url', urlOrNull);
  else u.searchParams.delete('avatar_url');
  history.replaceState({}, '', u);
}

/** Hosted Fox/Duck URL, or null for bundled Metaverse Explorer (clears avatar_url). */
export function setPlayerAvatarUrl(urlOrNull) {
  replaceAvatarUrlInHistory(urlOrNull);
  loadPlayerModelFromUrl(urlOrNull || BUNDLED_METAVERSE_EXPLORER);
  queueMicrotask(() =>
    import('./multiplayer.js')
      .then((m) => m.notifyLocalAvatarChanged())
      .catch(() => {})
  );
}

/**
 * @param {{
 *   animationMixer: THREE.AnimationMixer | null,
 *   idleAnimAction: THREE.AnimationAction | null,
 *   runAnimAction: THREE.AnimationAction | null,
 *   playerModel: THREE.Object3D | null,
 *   lastMovingState: boolean | null,
 * }} ctx
 * @param {boolean} isMoving
 */
export function setMovingAnimationForContext(ctx, isMoving) {
  if (!ctx.animationMixer) return;

  if (ctx.idleAnimAction && ctx.runAnimAction) {
    if (ctx.lastMovingState === isMoving) return;
    const fade = ANIMATION_CROSSFADE;
    if (isMoving) {
      ctx.idleAnimAction.crossFadeTo(ctx.runAnimAction, fade, false);
    } else {
      ctx.runAnimAction.crossFadeTo(ctx.idleAnimAction, fade, false);
    }
    ctx.lastMovingState = isMoving;
    return;
  }

  if (ctx.runAnimAction && !ctx.idleAnimAction) {
    if (ctx.lastMovingState === isMoving) return;
    ctx.lastMovingState = isMoving;
    if (isMoving) {
      ctx.runAnimAction.reset();
      ctx.runAnimAction.play();
    } else {
      ctx.runAnimAction.stop();
      resetSkinnedMeshesToBindPose(ctx.playerModel);
    }
    return;
  }

  if (ctx.idleAnimAction && !ctx.runAnimAction) {
    ctx.lastMovingState = false;
  }
}

export function setMovingAnimation(isMoving) {
  const ctx = {
    animationMixer: state.animationMixer,
    idleAnimAction: state.idleAnimAction,
    runAnimAction: state.runAnimAction,
    playerModel: state.playerModel,
    lastMovingState: state.lastMovingState,
  };
  setMovingAnimationForContext(ctx, isMoving);
  state.lastMovingState = ctx.lastMovingState;
}
