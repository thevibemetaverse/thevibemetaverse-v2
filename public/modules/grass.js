import * as THREE from 'three';
import { state } from './state.js';

const BLADE_WIDTH = 0.12;
const BLADE_HEIGHT = 1;
const BLADE_JOINTS = 5;
const INSTANCES_PER_PATCH = 50000;
const PATCH_SIZE = 100;
// Grid of patches: 4×4 covers ±200 units (fog hides anything further)
const GRID_CELLS = 4;

let grassMaterial = null;

export function initGrass() {
  const loader = new THREE.TextureLoader();
  const diffuseMap = loader.load('./textures/blade_diffuse.jpg');
  const alphaMap = loader.load('./textures/blade_alpha.jpg');

  // Base blade geometry — a thin plane subdivided along Y for bending
  const baseGeom = new THREE.PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 1, BLADE_JOINTS);
  baseGeom.translate(0, BLADE_HEIGHT / 2, 0);

  grassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      bladeHeight: { value: BLADE_HEIGHT },
      map: { value: diffuseMap },
      alphaMap: { value: alphaMap },
      time: { value: 0 },
      tipColor: { value: new THREE.Color(0.0, 0.6, 0.0).convertSRGBToLinear() },
      bottomColor: { value: new THREE.Color(0.0, 0.1, 0.0).convertSRGBToLinear() },
    },
    vertexShader: /* glsl */ `
      precision mediump float;
      attribute vec3 offset;
      attribute vec4 orientation;
      attribute float halfRootAngleSin;
      attribute float halfRootAngleCos;
      attribute float stretch;
      uniform float time;
      uniform float bladeHeight;
      varying vec2 vUv;
      varying float frc;

      // Simplex noise (webgl-noise by stegu)
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      vec3 rotateVectorByQuaternion(vec3 v, vec4 q) {
        return 2.0 * cross(q.xyz, v * q.w + cross(q.xyz, v)) + v;
      }

      vec4 slerp(vec4 v0, vec4 v1, float t) {
        v0 = normalize(v0);
        v1 = normalize(v1);
        float dot_ = dot(v0, v1);
        if (dot_ < 0.0) { v1 = -v1; dot_ = -dot_; }
        const float DOT_THRESHOLD = 0.9995;
        if (dot_ > DOT_THRESHOLD) {
          vec4 result = normalize(t*(v1 - v0) + v0);
          return result;
        }
        float theta_0 = acos(dot_);
        float theta = theta_0*t;
        float sin_theta = sin(theta);
        float sin_theta_0 = sin(theta_0);
        float s0 = cos(theta) - dot_ * sin_theta / sin_theta_0;
        float s1 = sin_theta / sin_theta_0;
        return (s0 * v0) + (s1 * v1);
      }

      void main() {
        frc = position.y / float(bladeHeight);
        float noise = 1.0 - (snoise(vec2((time - offset.x/50.0), (time - offset.z/50.0))));
        vec4 direction = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);
        direction = slerp(direction, orientation, frc);
        vec3 vPosition = vec3(position.x, position.y + position.y * stretch, position.z);
        vPosition = rotateVectorByQuaternion(vPosition, direction);

        // Wind
        float halfAngle = noise * 0.15;
        vPosition = rotateVectorByQuaternion(vPosition, normalize(vec4(sin(halfAngle), 0.0, -sin(halfAngle), cos(halfAngle))));

        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(offset + vPosition, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform sampler2D map;
      uniform sampler2D alphaMap;
      uniform vec3 tipColor;
      uniform vec3 bottomColor;
      varying vec2 vUv;
      varying float frc;

      void main() {
        float alpha = texture2D(alphaMap, vUv).r;
        if (alpha < 0.15) discard;
        vec4 col = texture2D(map, vUv);
        vec3 grassColor = mix(bottomColor, tipColor, frc);
        col.rgb = mix(grassColor, col.rgb, frc);
        gl_FragColor = col;

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  // Create a grid of grass patches, each with the original density
  const halfGrid = (GRID_CELLS * PATCH_SIZE) / 2;
  const halfPatch = PATCH_SIZE / 2;
  const maxH = BLADE_HEIGHT * 2.8;

  for (let gx = 0; gx < GRID_CELLS; gx++) {
    for (let gz = 0; gz < GRID_CELLS; gz++) {
      const centerX = -halfGrid + halfPatch + gx * PATCH_SIZE;
      const centerZ = -halfGrid + halfPatch + gz * PATCH_SIZE;

      const instancedGeo = new THREE.InstancedBufferGeometry();
      instancedGeo.index = baseGeom.index;
      instancedGeo.attributes.position = baseGeom.attributes.position;
      instancedGeo.attributes.uv = baseGeom.attributes.uv;
      instancedGeo.instanceCount = INSTANCES_PER_PATCH;

      const attrData = getAttributeData(INSTANCES_PER_PATCH, PATCH_SIZE, centerX, centerZ);

      instancedGeo.setAttribute('offset',
        new THREE.InstancedBufferAttribute(new Float32Array(attrData.offsets), 3));
      instancedGeo.setAttribute('orientation',
        new THREE.InstancedBufferAttribute(new Float32Array(attrData.orientations), 4));
      instancedGeo.setAttribute('stretch',
        new THREE.InstancedBufferAttribute(new Float32Array(attrData.stretches), 1));
      instancedGeo.setAttribute('halfRootAngleSin',
        new THREE.InstancedBufferAttribute(new Float32Array(attrData.halfRootAngleSin), 1));
      instancedGeo.setAttribute('halfRootAngleCos',
        new THREE.InstancedBufferAttribute(new Float32Array(attrData.halfRootAngleCos), 1));

      // Tight bounding sphere per patch for effective frustum culling
      instancedGeo.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(centerX, maxH / 2, centerZ),
        Math.sqrt(halfPatch * halfPatch + (maxH / 2) * (maxH / 2) + halfPatch * halfPatch)
      );

      const grassMesh = new THREE.Mesh(instancedGeo, grassMaterial);
      grassMesh.frustumCulled = true;
      state.scene.add(grassMesh);
    }
  }
}

export function updateGrass() {
  if (grassMaterial) {
    grassMaterial.uniforms.time.value = state.clock.elapsedTime / 4;
  }
}

function getAttributeData(instances, width, offsetCenterX, offsetCenterZ) {
  const offsets = [];
  const orientations = [];
  const stretches = [];
  const halfRootAngleSin = [];
  const halfRootAngleCos = [];

  let quaternion_0 = new THREE.Vector4();
  let quaternion_1 = new THREE.Vector4();

  const min = -0.25;
  const max = 0.25;

  for (let i = 0; i < instances; i++) {
    const offsetX = offsetCenterX + Math.random() * width - width / 2;
    const offsetZ = offsetCenterZ + Math.random() * width - width / 2;
    const offsetY = 0; // flat ground
    offsets.push(offsetX, offsetY, offsetZ);

    // Random Y rotation
    let angle = Math.PI - Math.random() * (2 * Math.PI);
    halfRootAngleSin.push(Math.sin(0.5 * angle));
    halfRootAngleCos.push(Math.cos(0.5 * angle));

    let RotationAxis = new THREE.Vector3(0, 1, 0);
    let x = RotationAxis.x * Math.sin(angle / 2.0);
    let y = RotationAxis.y * Math.sin(angle / 2.0);
    let z = RotationAxis.z * Math.sin(angle / 2.0);
    let w = Math.cos(angle / 2.0);
    quaternion_0.set(x, y, z, w).normalize();

    // Random X rotation
    angle = Math.random() * (max - min) + min;
    RotationAxis = new THREE.Vector3(1, 0, 0);
    x = RotationAxis.x * Math.sin(angle / 2.0);
    y = RotationAxis.y * Math.sin(angle / 2.0);
    z = RotationAxis.z * Math.sin(angle / 2.0);
    w = Math.cos(angle / 2.0);
    quaternion_1.set(x, y, z, w).normalize();
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    // Random Z rotation
    angle = Math.random() * (max - min) + min;
    RotationAxis = new THREE.Vector3(0, 0, 1);
    x = RotationAxis.x * Math.sin(angle / 2.0);
    y = RotationAxis.y * Math.sin(angle / 2.0);
    z = RotationAxis.z * Math.sin(angle / 2.0);
    w = Math.cos(angle / 2.0);
    quaternion_1.set(x, y, z, w).normalize();
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    orientations.push(quaternion_0.x, quaternion_0.y, quaternion_0.z, quaternion_0.w);

    // Variety in height — first third are taller
    if (i < instances / 3) {
      stretches.push(Math.random() * 1.8);
    } else {
      stretches.push(Math.random());
    }
  }

  return { offsets, orientations, stretches, halfRootAngleCos, halfRootAngleSin };
}

function multiplyQuaternions(q1, q2) {
  const x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;
  const y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;
  const z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;
  const w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;
  return new THREE.Vector4(x, y, z, w);
}
