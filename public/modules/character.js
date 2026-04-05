import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state } from './state.js';

export function loadPlayerModel() {
  const params = new URLSearchParams(window.location.search);
  const avatarUrl = params.get('avatar_url');
  const modelPath = avatarUrl || 'assets/3d/metaverse-explorer.glb';

  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => {
      state.playerModel = gltf.scene;
      state.playerModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(state.playerModel);
      const size = box.getSize(new THREE.Vector3());
      const targetHeight = 2.2;
      const scale = targetHeight / Math.max(size.y, 0.001);
      state.playerModel.scale.setScalar(scale);

      box.setFromObject(state.playerModel);
      const center = new THREE.Vector3();
      box.getCenter(center);
      state.playerModel.position.set(-center.x, -box.min.y, -center.z);

      state.player.add(state.playerModel);

      setupCharacterAnimations(gltf);
    },
    undefined,
    (err) => {
      console.error('Failed to load character model:', err);
    }
  );
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

function setupCharacterAnimations(gltf) {
  const clips = gltf.animations;
  if (!clips.length) return;

  state.animationMixer = new THREE.AnimationMixer(state.playerModel);
  const { idle: idleClip, run: runClip } = pickIdleAndRunClips(clips);

  if (idleClip) state.idleAnimAction = state.animationMixer.clipAction(idleClip);
  if (runClip) state.runAnimAction = state.animationMixer.clipAction(runClip);

  if (state.idleAnimAction && state.runAnimAction) {
    state.idleAnimAction.play();
    state.runAnimAction.play();
    state.runAnimAction.setEffectiveWeight(0);
    state.lastMovingState = false;
  } else if (state.runAnimAction && !state.idleAnimAction) {
    state.runAnimAction.stop();
    resetSkinnedMeshesToBindPose(state.playerModel);
    state.lastMovingState = false;
  } else if (state.idleAnimAction) {
    state.idleAnimAction.play();
    state.lastMovingState = false;
  }
}

export function setMovingAnimation(isMoving) {
  if (!state.animationMixer) return;

  if (state.idleAnimAction && state.runAnimAction) {
    if (state.lastMovingState === isMoving) return;
    const fade = 0.25;
    if (isMoving) {
      state.idleAnimAction.crossFadeTo(state.runAnimAction, fade, false);
    } else {
      state.runAnimAction.crossFadeTo(state.idleAnimAction, fade, false);
    }
    state.lastMovingState = isMoving;
    return;
  }

  if (state.runAnimAction && !state.idleAnimAction) {
    if (state.lastMovingState === isMoving) return;
    state.lastMovingState = isMoving;
    if (isMoving) {
      state.runAnimAction.reset();
      state.runAnimAction.play();
    } else {
      state.runAnimAction.stop();
      resetSkinnedMeshesToBindPose(state.playerModel);
    }
    return;
  }

  if (state.idleAnimAction && !state.runAnimAction) {
    state.lastMovingState = false;
  }
}
