import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PixelMap } from './types';

const VERT = /* glsl */ `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    gl_PointSize = uSize * uPixelRatio * (30.0 / max(d, 0.1));
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float r = dot(p, p);
    if (r > 0.25) discard;
    float falloff = 1.0 - smoothstep(0.0, 0.25, r);
    vec3 c = vColor * (0.6 + 0.4 * falloff);
    float alpha = falloff;
    gl_FragColor = vec4(c, alpha);
  }
`;

export interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  points: THREE.Points;
  colors: Float32Array;
  material: THREE.ShaderMaterial;
  stripLines: THREE.LineSegments | null;
  rebuild(map: PixelMap): void;
  setShowWires(show: boolean): void;
  setPointSize(size: number): void;
  resize(): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement, map: PixelMap): SceneHandles {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x07070a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(8, -12, 6);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 0, 2);

  const grid = new THREE.GridHelper(20, 20, 0x333333, 0x1a1a1a);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSize: { value: 4.5 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const geom = new THREE.BufferGeometry();
  const colors = new Float32Array(map.count * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(map.positions, 3));
  geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;
  scene.add(points);

  let stripLines: THREE.LineSegments | null = null;
  function buildWires(m: PixelMap) {
    if (stripLines) {
      scene.remove(stripLines);
      stripLines.geometry.dispose();
      (stripLines.material as THREE.Material).dispose();
      stripLines = null;
    }
    const positions: number[] = [];
    for (const s of m.strips) {
      positions.push(s.top[0], s.top[1], s.top[2]);
      positions.push(s.top[0], s.top[1], s.top[2] - s.length_m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x202028, transparent: true, opacity: 0.5 });
    stripLines = new THREE.LineSegments(g, mat);
    stripLines.visible = false;
    scene.add(stripLines);
  }
  buildWires(map);

  const handles: SceneHandles = {
    renderer,
    scene,
    camera,
    controls,
    points,
    colors,
    material,
    stripLines,
    rebuild(newMap: PixelMap) {
      handles.colors = new Float32Array(newMap.count * 3);
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute('position', new THREE.BufferAttribute(newMap.positions, 3));
      newGeom.setAttribute('aColor', new THREE.BufferAttribute(handles.colors, 3));
      points.geometry.dispose();
      points.geometry = newGeom;
      buildWires(newMap);
      handles.stripLines = stripLines;
    },
    setShowWires(show: boolean) {
      if (stripLines) stripLines.visible = show;
    },
    setPointSize(size: number) {
      material.uniforms.uSize.value = size;
    },
    resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    },
    dispose() {
      renderer.dispose();
      points.geometry.dispose();
      material.dispose();
    },
  };

  window.addEventListener('resize', handles.resize);
  return handles;
}

export function uploadColors(handles: SceneHandles) {
  const attr = handles.points.geometry.getAttribute('aColor') as THREE.BufferAttribute;
  attr.array = handles.colors;
  attr.needsUpdate = true;
}
