import * as THREE from 'three';
import { state } from './state.js';
import { SHADOW_MAP_SIZE, SUN_INTENSITY, SUN_POSITION, AMBIENT_INTENSITY, HEMI_INTENSITY, SHADOW_RADIUS, SHADOW_NORMAL_BIAS } from './constants.js';

/** @type {THREE.Light[]} */
const lobbyLights = [];

export function setupLighting() {
  const ambient = new THREE.AmbientLight(0xC8DDEF, AMBIENT_INTENSITY);
  state.scene.add(ambient);
  lobbyLights.push(ambient);

  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8CB86A, HEMI_INTENSITY);
  state.scene.add(hemi);
  lobbyLights.push(hemi);

  const sun = new THREE.DirectionalLight(0xFFFDD0, SUN_INTENSITY);
  sun.position.set(...SUN_POSITION);
  sun.castShadow = true;
  sun.shadow.mapSize.width = SHADOW_MAP_SIZE;
  sun.shadow.mapSize.height = SHADOW_MAP_SIZE;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.001;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS;
  state.scene.add(sun);
  lobbyLights.push(sun);

  // Procedural environment map for reflections on metallic/glossy objects
  const pmremGenerator = new THREE.PMREMGenerator(state.renderer);
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(100, 16, 8);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x88CCEE) },
      bottomColor: { value: new THREE.Color(0x99BB88) },
    },
    vertexShader: `varying vec3 vWorldPos;
      void main(){vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vWorldPos;
      void main(){float h=normalize(vWorldPos).y;gl_FragColor=vec4(mix(bottomColor,topColor,smoothstep(-0.1,0.5,h)),1.0);}`,
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const sunLight = new THREE.DirectionalLight(0xFFFFDD, 2);
  sunLight.position.set(...SUN_POSITION);
  envScene.add(sunLight);
  envScene.add(new THREE.AmbientLight(0xCCDDEE, 1));
  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  state.scene.environment = envMap;
  pmremGenerator.dispose();
}

/** @type {THREE.Texture | null} */
let _cachedEnvMap = null;

/** Store/restore environment map when toggling room. */
export function disableLobbyLighting() {
  _cachedEnvMap = state.scene?.environment || null;
  for (const light of lobbyLights) light.visible = false;
  if (state.scene) state.scene.environment = null;
}

export function enableLobbyLighting() {
  for (const light of lobbyLights) light.visible = true;
  if (state.scene && _cachedEnvMap) state.scene.environment = _cachedEnvMap;
}
