import * as THREE from 'three';
import { state } from './state.js';

export function setupLighting() {
  const ambient = new THREE.AmbientLight(0xB0E0FF, 0.8);
  state.scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x7EC850, 0.5);
  state.scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xFFFDD0, 1.4);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.001;
  state.scene.add(sun);

  // Procedural environment map for reflections on metallic/glossy objects
  const pmremGenerator = new THREE.PMREMGenerator(state.renderer);
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(100, 16, 8);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x88CCEE) },
      bottomColor: { value: new THREE.Color(0xAADD88) },
    },
    vertexShader: `varying vec3 vWorldPos;
      void main(){vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vWorldPos;
      void main(){float h=normalize(vWorldPos).y;gl_FragColor=vec4(mix(bottomColor,topColor,smoothstep(-0.1,0.5,h)),1.0);}`,
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const sunLight = new THREE.DirectionalLight(0xFFFFDD, 2);
  sunLight.position.set(30, 50, 20);
  envScene.add(sunLight);
  envScene.add(new THREE.AmbientLight(0xCCDDEE, 1));
  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  state.scene.environment = envMap;
  pmremGenerator.dispose();
}
