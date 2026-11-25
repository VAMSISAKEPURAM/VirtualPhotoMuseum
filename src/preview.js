import * as THREE from 'three';
import { createCharacterMesh } from './characters.js';

let renderer = null, scene = null, camera = null, currentMesh = null, raf = 0;

export function updatePreview(spec) {
  const canvas = document.getElementById('previewCanvas');
  if (!canvas) return;
  if (!renderer) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 1.15, 2.95);
    camera.lookAt(0, 0.92, 0);
    scene.add(new THREE.HemisphereLight('#fff6e8', '#332820', 1.3));
    const dir = new THREE.DirectionalLight('#ffffff', 1.1);
    dir.position.set(2, 4, 3);
    scene.add(dir);
  }
  const w = canvas.clientWidth || 220, h = canvas.clientHeight || 240;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  if (currentMesh) {
    scene.remove(currentMesh.group);
    currentMesh.dispose();
  }
  currentMesh = createCharacterMesh(spec, false);
  scene.add(currentMesh.group);

  if (!raf) {
    const tick = () => {
      if (!renderer || canvas.offsetParent === null) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
      if (currentMesh) {
        currentMesh.group.rotation.y += 0.014;
        currentMesh.torso.scale.y = 1 + Math.sin(performance.now() / 500) * 0.015;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
  }
}

export function stopPreview() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}
