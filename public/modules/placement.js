import * as THREE from 'three';
import { state } from './state.js';

export function placeGeneratedObject(group) {
  const facing = state.player.rotation.y;
  const baseX = Math.round(state.player.position.x + Math.sin(facing) * 8);
  const baseZ = Math.round(state.player.position.z + Math.cos(facing) * 8);

  // Enable shadows on all meshes
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Compute bounding box to derive occupancy
  const box = new THREE.Box3().setFromObject(group);

  // Build occupancy blocks from bounding box
  const blocks = [];
  const minX = Math.floor(box.min.x);
  const maxX = Math.ceil(box.max.x);
  const minZ = Math.floor(box.min.z);
  const maxZ = Math.ceil(box.max.z);
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      blocks.push({ x, y: 0, z });
    }
  }

  // Find clear position using spiral search
  const canPlace = (ax, az) => {
    for (const b of blocks) {
      if (state.occupiedCells.has(`${ax + b.x},${b.y},${az + b.z}`)) return false;
    }
    return true;
  };

  let anchorX = baseX, anchorZ = baseZ;
  if (!canPlace(baseX, baseZ)) {
    outer:
    for (let r = 1; r <= 20; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          if (canPlace(baseX + dx, baseZ + dz)) {
            anchorX = baseX + dx;
            anchorZ = baseZ + dz;
            break outer;
          }
        }
      }
    }
  }

  // Mark occupied
  for (const b of blocks) {
    state.occupiedCells.add(`${anchorX + b.x},${b.y},${anchorZ + b.z}`);
  }

  group.position.set(anchorX, 0, anchorZ);
  state.scene.add(group);
  state.placedObjects.push(group);
}
