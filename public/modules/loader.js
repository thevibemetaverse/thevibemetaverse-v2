// @ts-check
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Shared GLTFLoader with meshopt + Draco decoders for compressed GLB support.
 * Draco decoder files are vendored under public/vendor/draco/ to avoid
 * third-party CDN round-trips (see CLAUDE.md instant-load rules).
 */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/vendor/draco/');
// Kick off the WASM fetch at module-load time so it overlaps with other
// startup work (registry fetch, scene setup) instead of blocking the first
// GLB decode. Cheap if no draco-compressed asset is ever loaded.
dracoLoader.preload();

export const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
gltfLoader.setDRACOLoader(dracoLoader);
