import * as THREE from 'three';
import { state } from './state.js';
import { SKY_RADIUS } from './constants.js';

/** @type {THREE.ShaderMaterial | null} */
let cloudMaterial = null;

let elapsedTime = 0;

export function initClouds() {
  const geo = new THREE.SphereGeometry(SKY_RADIUS - 1, 64, 32);

  cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunColor: { value: new THREE.Color(1.0, 0.99, 0.92) },
      uCloudColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
      uShadowColor: { value: new THREE.Color(0.58, 0.62, 0.74) },
      uWindSpeed: { value: 0.006 },
      uCoverage: { value: 0.38 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunColor;
      uniform vec3 uCloudColor;
      uniform vec3 uShadowColor;
      uniform float uWindSpeed;
      uniform float uCoverage;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.48;
        }
        return v;
      }

      float cloudShape(vec2 p) {
        vec2 wind = vec2(uTime * uWindSpeed, uTime * uWindSpeed * 0.3);
        p += wind;
        // Light domain warp for soft organic shapes without swirls
        float warp = fbm(p + vec2(5.2, 1.3));
        return fbm(p + warp * 0.6);
      }

      void main() {
        vec3 dir = normalize(vNormal);

        // Only render clouds in the upper hemisphere
        float height = dir.y;
        if (height < 0.05) discard;

        // Project sphere position to a flat UV for the noise
        // Use xz / y to get a "dome projection" — clouds appear on the dome surface
        vec2 uv = dir.xz / (height + 0.1) * 0.8;

        float n = cloudShape(uv);

        float cloud = smoothstep(uCoverage, uCoverage + 0.28, n);

        // Fade clouds near the horizon so they blend with sky gradient
        float horizonFade = smoothstep(0.05, 0.25, height);
        cloud *= horizonFade;

        if (cloud < 0.01) discard;

        // Lighting
        float n2 = cloudShape(uv + vec2(0.03, 0.02));
        float shadow = smoothstep(0.0, 0.4, n2 - n);
        float light = 1.0 - shadow * 0.5;

        // Silver lining at edges
        float edgeGlow = smoothstep(0.0, 0.12, cloud) * (1.0 - smoothstep(0.12, 0.5, cloud));

        vec3 color = mix(uShadowColor, uCloudColor, light);
        color += uSunColor * edgeGlow * 0.3;

        gl_FragColor = vec4(color, cloud * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, cloudMaterial);
  mesh.frustumCulled = false;
  state.scene.add(mesh);
}

/** @param {number} delta */
export function updateClouds(delta) {
  if (cloudMaterial) {
    elapsedTime += delta;
    cloudMaterial.uniforms.uTime.value = elapsedTime;
  }
}
