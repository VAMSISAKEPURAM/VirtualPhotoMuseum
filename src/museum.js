import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  THEMES, RELATIONSHIPS, OCCASIONS, makeFloorTexture, makeGlowTexture,
  makePlaceholderTexture, makePlaqueTexture, makeSignTexture, makeFamilyTreeTexture
} from './themes.js';
import { createCharacterMesh } from './characters.js';

export const ROOM_W = 14, ROOM_D = 12, ROOM_H = 5, WALL_T = 0.3;
export const DOOR_W = 3.4, DOOR_H = 3.4;
const SLOT_X = [-4.6, 0, 4.6];
export const PER_ROOM = 6;
const PHOTO_MAX_W = 3.4, PHOTO_MAX_H = 2.1, PHOTO_CY = 2.35;
const MAT_M = 0.12, FRAME_B = 0.09;
export const PLAYER_R = 0.35;
const VISIBLE_ROOMS = 2, LOAD_ROOMS = 1, UNLOAD_ROOMS = 3;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

function addBox(colliders, parent, mat, minX, maxX, minY, maxY, minZ, maxZ, collide, list) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ), mat);
  m.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  parent.add(m);
  if (collide) colliders.push({ minX, maxX, minZ, maxZ });
  if (list) list.push(m);
  return m;
}
function boxGeo(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function makeParticleTex(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'heart') {
    g.fillStyle = '#ff6b93';
    g.beginPath();
    g.moveTo(32, 52);
    g.bezierCurveTo(8, 36, 6, 14, 20, 12);
    g.bezierCurveTo(28, 10, 32, 18, 32, 22);
    g.bezierCurveTo(32, 18, 36, 10, 44, 12);
    g.bezierCurveTo(58, 14, 56, 36, 32, 52);
    g.fill();
  } else {
    g.fillStyle = '#ffffff';
    g.fillRect(18, 22, 28, 18);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class MuseumWorld {
  constructor(scene, aniso) {
    this.scene = scene;
    this.aniso = aniso;
    this.world = null;
    this.rooms = [];
    this.entries = [];
    this.colliders = [];
    this.poolLights = [];
    this.anchors = [];
    this.actors = [];
    this.particles = [];
    this.roomCount = 1;
    this.curRoom = -1;
    this.nearbyWalls = [];
    this.theme = THEMES.lovers;
    this.placeholder = null;
    this.generation = 0;
    this.heartTex = makeParticleTex('heart');
    this.confettiTex = makeParticleTex('confetti');
    this.fireLight = null;
  }

  dispose() {
    this.generation++;
    for (const a of this.actors) {
      this.scene.remove(a.mesh.group);
      a.mesh.dispose();
    }
    this.actors = [];
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.map && m.map !== this.heartTex && m.map !== this.confettiTex) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
    this.world = null;
    this.rooms = [];
    this.entries = [];
    this.colliders = [];
    this.poolLights = [];
    this.anchors = [];
    this.particles = [];
    this.nearbyWalls = [];
    this.curRoom = -1;
    this.fireLight = null;
  }

  build(state, activeIdx, keepPos, prevPositions) {
    this.dispose();
    const relId = state.relationship;
    const rel = RELATIONSHIPS[relId] || RELATIONSHIPS.family;
    const lookId = state.styleOverride === 'theme' ? relId : state.styleOverride;
    const T = this.theme = THEMES[lookId] || THEMES[relId] || THEMES.classic;

    this.scene.background = new THREE.Color(T.bg);
    this.scene.fog = new THREE.Fog(T.bg, 9, 32);
    const world = this.world = new THREE.Group();
    this.scene.add(world);

    const n = Math.max(1, Math.ceil(state.photos.length / PER_ROOM));
    this.roomCount = n;
    this.placeholder = makePlaceholderTexture();

    const floorTex = makeFloorTexture(T.floor);
    floorTex.anisotropy = this.aniso;
    const tile = T.floor === 'wood' ? 3.5 : 4;
    floorTex.repeat.set(ROOM_W / tile, ROOM_D / tile);
    const glowTex = makeGlowTexture();

    const M = {
      wall: new THREE.MeshStandardMaterial({ color: T.wall, roughness: 0.94 }),
      trim: new THREE.MeshStandardMaterial({ color: T.trim, roughness: 0.55 }),
      ceiling: new THREE.MeshStandardMaterial({ color: T.ceiling, roughness: 1 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: T.floor === 'wood' ? 0.55 : 0.4 }),
      frame: new THREE.MeshStandardMaterial({ color: T.frame, roughness: T.frameRough, metalness: T.frameMetal }),
      mat: new THREE.MeshStandardMaterial({ color: T.mat, roughness: 1 }),
      lamp: new THREE.MeshBasicMaterial({ color: T.light }),
      bench: new THREE.MeshStandardMaterial({ color: T.bench, roughness: 0.8 }),
      glow: new THREE.MeshBasicMaterial({
        map: glowTex, color: T.light, transparent: true, opacity: T.glow,
        blending: THREE.AdditiveBlending, depthWrite: false
      }),
      accent: new THREE.MeshStandardMaterial({ color: T.accent, roughness: 0.5 })
    };

    for (let i = 0; i < n; i++) {
      const cx = i * ROOM_W;
      const g = new THREE.Group();
      world.add(g);
      const room = { index: i, cx, group: g, walls: [], anchors: [] };
      this.rooms.push(room);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), M.floor);
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, 0); g.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), M.ceiling);
      ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, ROOM_H, 0); g.add(ceil);

      const x0 = cx - ROOM_W / 2 - WALL_T / 2, x1 = cx + ROOM_W / 2 + WALL_T / 2;
      addBox(this.colliders, g, M.wall, x0, x1, 0, ROOM_H, -ROOM_D / 2 - WALL_T, -ROOM_D / 2, true, room.walls);
      addBox(this.colliders, g, M.wall, x0, x1, 0, ROOM_H, ROOM_D / 2, ROOM_D / 2 + WALL_T, true, room.walls);
      addBox(this.colliders, g, M.trim, cx - ROOM_W / 2, cx + ROOM_W / 2, 0, 0.16, -ROOM_D / 2, -ROOM_D / 2 + 0.05, false);
      addBox(this.colliders, g, M.trim, cx - ROOM_W / 2, cx + ROOM_W / 2, 0, 0.16, ROOM_D / 2 - 0.05, ROOM_D / 2, false);

      for (const dx of [-3.5, 3.5]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.2), M.lamp);
        panel.position.set(cx + dx, ROOM_H - 0.03, 0);
        g.add(panel);
        const a = new THREE.Vector3(cx + dx, ROOM_H - 0.8, 0);
        room.anchors.push(a); this.anchors.push(a);
      }

      this._buildRoomDecor(g, cx, i, relId, T, M);
    }

    // Dividers with doorways
    for (let i = 0; i <= n; i++) {
      const owner = this.rooms[Math.min(i, n - 1)];
      const g = owner.group, list = owner.walls;
      const xb = i * ROOM_W - ROOM_W / 2, hw = WALL_T / 2;
      if (i === 0 || i === n) {
        addBox(this.colliders, g, M.wall, xb - hw, xb + hw, 0, ROOM_H, -ROOM_D / 2 - WALL_T, ROOM_D / 2 + WALL_T, true, list);
      } else {
        addBox(this.colliders, g, M.wall, xb - hw, xb + hw, 0, ROOM_H, -ROOM_D / 2 - WALL_T, -DOOR_W / 2, true, list);
        addBox(this.colliders, g, M.wall, xb - hw, xb + hw, 0, ROOM_H, DOOR_W / 2, ROOM_D / 2 + WALL_T, true, list);
        addBox(this.colliders, g, M.wall, xb - hw, xb + hw, DOOR_H, ROOM_H, -DOOR_W / 2, DOOR_W / 2, false, list);
        addBox(this.colliders, g, M.trim, xb - 0.22, xb + 0.22, 0, DOOR_H, -DOOR_W / 2, -DOOR_W / 2 + 0.1, false);
        addBox(this.colliders, g, M.trim, xb - 0.22, xb + 0.22, 0, DOOR_H, DOOR_W / 2 - 0.1, DOOR_W / 2, false);
        addBox(this.colliders, g, M.trim, xb - 0.22, xb + 0.22, DOOR_H - 0.1, DOOR_H, -DOOR_W / 2, DOOR_W / 2, false);
      }
    }

    // Welcome sign on west wall of room 1 (+ occasion banner/prop if selected)
    {
      const occ = OCCASIONS[state.occasion] || OCCASIONS.none;
      const signTitle = state.occasion === 'custom'
        ? (state.customOccasionText || '').trim() || occ.title
        : (occ.title || rel.welcomeTitle);
      const signSub = occ.sub
        ? `${occ.sub} · ${state.photos.length} photo${state.photos.length === 1 ? '' : 's'}`
        : `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} · ${n} room${n === 1 ? '' : 's'}`;
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 1.05),
        new THREE.MeshBasicMaterial({
          map: makeSignTexture(signTitle, signSub, T, relId),
          toneMapped: false
        })
      );
      sign.position.set(-ROOM_W / 2 + 0.02, relId === 'family' ? 3.55 : 3.0, 0);
      sign.rotation.y = Math.PI / 2;
      this.rooms[0].group.add(sign);

      if (relId === 'family') {
        const tree = new THREE.Mesh(
          new THREE.PlaneGeometry(3.1, 2.15),
          new THREE.MeshBasicMaterial({ map: makeFamilyTreeTexture(state.characters, T), toneMapped: false })
        );
        tree.position.set(-ROOM_W / 2 + 0.03, 1.75, 0);
        tree.rotation.y = Math.PI / 2;
        this.rooms[0].group.add(tree);
      }

      this._buildOccasionProp(this.rooms[0].group, state.occasion, T);
    }

    // Framed photos
    state.photos.forEach((photo, idx) => {
      const room = this.rooms[Math.floor(idx / PER_ROOM)];
      const k = idx % PER_ROOM;
      const north = k < 3, slot = k % 3;
      const ar = photo.w / photo.h;
      let pw = PHOTO_MAX_W, ph = pw / ar;
      if (ph > PHOTO_MAX_H) { ph = PHOTO_MAX_H; pw = ph * ar; }
      const isPolaroid = relId === 'friends';
      const matBottom = isPolaroid ? 0.34 : MAT_M;
      const ow = pw + 2 * MAT_M, oh = ph + MAT_M + matBottom;

      const g = new THREE.Group();
      g.add(new THREE.Mesh(mergeGeometries([
        boxGeo(ow + 2 * FRAME_B, FRAME_B, 0.08, 0, oh / 2 + FRAME_B / 2, 0.04),
        boxGeo(ow + 2 * FRAME_B, FRAME_B, 0.08, 0, -(oh / 2 + FRAME_B / 2), 0.04),
        boxGeo(FRAME_B, oh, 0.08, -(ow / 2 + FRAME_B / 2), 0, 0.04),
        boxGeo(FRAME_B, oh, 0.08, ow / 2 + FRAME_B / 2, 0, 0.04)
      ]), M.frame));
      const matMesh = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, 0.04), M.mat);
      matMesh.position.z = 0.02; g.add(matMesh);

      const imgMat = new THREE.MeshBasicMaterial({ map: this.placeholder, toneMapped: false });
      const imgMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), imgMat);
      imgMesh.position.set(0, isPolaroid ? (matBottom - MAT_M) / 2 : 0, 0.045);
      g.add(imgMesh);

      if (relId === 'lovers') {
        const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), M.accent);
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), M.accent);
        h1.position.set(-0.06, oh / 2 + FRAME_B + 0.09, 0.05);
        h2.position.set(0.06, oh / 2 + FRAME_B + 0.09, 0.05);
        g.add(h1, h2);
      } else if (isPolaroid) {
        for (const sx of [-1, 1]) {
          const tape = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.02), M.accent);
          tape.position.set((ow / 2 - 0.15) * sx, oh / 2 + 0.04, 0.07);
          tape.rotation.z = sx * -0.35;
          g.add(tape);
        }
      }

      const glow = new THREE.Mesh(new THREE.PlaneGeometry(ow + 2.6, oh + 2.2), M.glow);
      glow.position.set(0, 0.35, 0.012); g.add(glow);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(Math.min(pw * 0.7, 1.8), 0.05, 0.09), M.lamp);
      lamp.position.set(0, oh / 2 + FRAME_B + 0.22, 0.3); g.add(lamp);

      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.45),
        new THREE.MeshBasicMaterial({ map: makePlaqueTexture(photo.title, idx + 1, T, relId), toneMapped: false })
      );
      plaque.position.set(0, Math.max(-(oh / 2 + FRAME_B + 0.34), 0.62 - PHOTO_CY), 0.01);
      g.add(plaque);

      const x = room.cx + SLOT_X[slot];
      const z = north ? -ROOM_D / 2 : ROOM_D / 2;
      g.position.set(x, PHOTO_CY, z);
      g.rotation.y = north ? 0 : Math.PI;
      room.group.add(g);

      this.entries[idx] = { idx, photo, mat: imgMat, tex: null, loading: false, failed: false, roomIndex: room.index, x, z, pw };
    });

    // Lighting
    world.add(new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI));
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(T.light, T.lightI, 26, 1.6);
      l.position.set(0, ROOM_H - 0.8, 0);
      world.add(l); this.poolLights.push(l);
    }

    // Spawn characters
    const basePos = keepPos && prevPositions && prevPositions[0]
      ? new THREE.Vector3(clamp(prevPositions[0].x, -ROOM_W / 2 + 1, (n - 1) * ROOM_W + ROOM_W / 2 - 1), 0, clamp(prevPositions[0].z, -ROOM_D / 2 + 1, ROOM_D / 2 - 1))
      : new THREE.Vector3(0, 0, 3.2);

    this.actors = state.characters.map((spec, idx) => {
      const mesh = createCharacterMesh(spec, true);
      mesh.setLabelActive(idx === activeIdx);
      this.scene.add(mesh.group);
      const offsetX = idx === 0 ? 0 : ((idx % 2 === 1 ? -1 : 1) * (0.7 + Math.floor(idx / 2) * 0.55));
      const offsetZ = idx === 0 ? 0 : 0.7 + Math.floor(idx / 2) * 0.6;
      const pos = basePos.clone().add(new THREE.Vector3(offsetX, 0, offsetZ));
      pos.x = clamp(pos.x, -ROOM_W / 2 + 0.8, (n - 1) * ROOM_W + ROOM_W / 2 - 0.8);
      pos.z = clamp(pos.z, -ROOM_D / 2 + 0.8, ROOM_D / 2 - 0.8);
      mesh.group.position.set(pos.x, 0, pos.z);
      return {
        index: idx,
        spec,
        mesh,
        pos,
        vel: new THREE.Vector2(),
        heading: Math.PI,
        phase: idx * 0.9,
        stepK: 0,
        idleTimer: 2 + Math.random() * 3,
        idleBounce: 0,
        heartTimer: 0.4,
        emoteTime: 0,
        holdSide: null
      };
    });

    world.updateMatrixWorld(true);
    const activePos = this.actors[activeIdx]?.pos || basePos;
    this.updateRoomWindow(activePos, true);
    this.updateLights(activePos, 0, true);
  }

  _buildOccasionProp(g, occasion, T) {
    if (!occasion || occasion === 'none') return;
    const px = -4.8, pz = 3.6;
    const pedMat = new THREE.MeshStandardMaterial({ color: T.trim, roughness: 0.45 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.9, 18), pedMat);
    ped.position.set(px, 0.45, pz);
    g.add(ped);
    this.colliders.push({ minX: px - 0.5, maxX: px + 0.5, minZ: pz - 0.5, maxZ: pz + 0.5 });

    if (occasion === 'birthday') {
      const cakeMat = new THREE.MeshStandardMaterial({ color: '#ffd9e8', roughness: 0.6 });
      const icingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.22, 18), cakeMat);
      tier1.position.set(px, 1.01, pz); g.add(tier1);
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.18, 18), icingMat);
      tier2.position.set(px, 1.21, pz); g.add(tier2);
      const candleMat = new THREE.MeshStandardMaterial({ color: '#5ea4e6', roughness: 0.5 });
      const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf56' });
      for (const [cx, cz] of [[-0.08, 0], [0.08, 0], [0, 0.08]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), candleMat);
        c.position.set(px + cx, 1.37, pz + cz); g.add(c);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), flameMat);
        f.position.set(px + cx, 1.46, pz + cz); g.add(f);
      }
    } else if (occasion === 'anniversary' || occasion === 'wedding') {
      const goldMat = new THREE.MeshStandardMaterial({ color: '#f0cd7a', metalness: 0.85, roughness: 0.2 });
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 10, 24), goldMat);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 10, 24), goldMat);
      r1.position.set(px - 0.09, 1.15, pz); r1.rotation.y = 0.35;
      r2.position.set(px + 0.09, 1.15, pz); r2.rotation.y = -0.35;
      g.add(r1, r2);
    } else {
      const starMat = new THREE.MeshStandardMaterial({ color: '#f0cd7a', metalness: 0.75, roughness: 0.25 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 0.32, 14), starMat);
      cup.position.set(px, 1.1, pz); g.add(cup);
      const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), starMat);
      top.position.set(px, 1.36, pz); g.add(top);
    }
  }

  _buildRoomDecor(g, cx, idx, relId, T, M) {
    if (relId === 'lovers') {
      // Velvet bench + rose vase
      addBox(this.colliders, g, M.bench, cx - 1.3, cx + 1.3, 0, 0.42, -0.35, 0.35, true);
      addBox(this.colliders, g, M.trim, cx - 1.34, cx + 1.34, 0.42, 0.47, -0.39, 0.39, false);
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.28, 12), M.trim);
      vase.position.set(cx, 0.61, 0); g.add(vase);
      const rose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), M.accent);
      rose.position.set(cx, 0.8, 0); g.add(rose);
      // String lights across ceiling
      const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe3a8' });
      for (let b = -5; b <= 5; b += 2) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bulbMat);
        bulb.position.set(cx + b, ROOM_H - 0.35 - Math.cos(b * 0.25) * 0.25, -ROOM_D / 2 + 0.6);
        g.add(bulb);
      }
      // Floating petals / hearts
      for (let p = 0; p < 8; p++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, opacity: 0.72 }));
        const x = cx + (Math.random() - 0.5) * 10, y = 1 + Math.random() * 2.8, z = (Math.random() - 0.5) * 8;
        sp.position.set(x, y, z);
        sp.scale.setScalar(0.18 + Math.random() * 0.12);
        g.add(sp);
        this.particles.push({ sp, baseY: y, phase: Math.random() * 6.28, speed: 0.7 + Math.random() * 0.6, roomIndex: idx });
      }
    } else if (relId === 'friends') {
      // Bean bags
      for (const sx of [-1.1, 1.1]) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), sx < 0 ? M.bench : M.accent);
        bag.scale.set(1.1, 0.65, 1.1);
        bag.position.set(cx + sx, 0.32, 0);
        g.add(bag);
        this.colliders.push({ minX: cx + sx - 0.65, maxX: cx + sx + 0.65, minZ: -0.65, maxZ: 0.65 });
      }
      // Balloons in corners
      const bCols = ['#ff5ea8', '#38d9c0', '#ffbe3d', '#6c7bff'];
      [[-5.8, -4.8], [5.8, -4.8], [-5.8, 4.8], [5.8, 4.8]].forEach(([bx, bz], bi) => {
        const mat = new THREE.MeshStandardMaterial({ color: bCols[(bi + idx) % bCols.length], roughness: 0.3 });
        const bal = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mat);
        bal.position.set(cx + bx, 2.5 + (bi % 2) * 0.4, bz);
        bal.scale.y = 1.18;
        g.add(bal);
      });
      // Neon wall bar
      const neon = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: '#ff5ea8' }));
      neon.position.set(cx, 4.35, -ROOM_D / 2 + 0.08);
      g.add(neon);
      // Arcade prop in room 1 / even rooms
      if (idx % 2 === 0) {
        addBox(this.colliders, g, new THREE.MeshStandardMaterial({ color: '#262444', roughness: 0.5 }), cx + 5.6, cx + 6.4, 0, 1.85, -0.5, 0.5, true);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), new THREE.MeshBasicMaterial({ color: '#38d9c0' }));
        scr.position.set(cx + 5.58, 1.25, 0); scr.rotation.y = -Math.PI / 2; g.add(scr);
      }
      // Confetti
      for (let p = 0; p < 10; p++) {
        const col = bCols[p % bCols.length];
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.confettiTex, color: col, transparent: true, opacity: 0.85 }));
        const x = cx + (Math.random() - 0.5) * 10, y = 1.2 + Math.random() * 2.8, z = (Math.random() - 0.5) * 8;
        sp.position.set(x, y, z);
        sp.scale.setScalar(0.16);
        g.add(sp);
        this.particles.push({ sp, baseY: y, phase: Math.random() * 6.28, speed: 1.0 + Math.random() * 0.8, roomIndex: idx });
      }
    } else if (relId === 'family') {
      // Cozy rug + sofa
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.6), new THREE.MeshStandardMaterial({ color: '#b87654', roughness: 0.95 }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.015, 0); g.add(rug);
      addBox(this.colliders, g, M.bench, cx - 1.4, cx + 1.4, 0, 0.45, -0.45, 0.45, true);
      addBox(this.colliders, g, M.bench, cx - 1.4, cx + 1.4, 0.45, 0.88, -0.45, -0.22, false);
      // Potted plants
      const potMat = new THREE.MeshStandardMaterial({ color: '#9c5b3b', roughness: 0.8 });
      const leafMat = new THREE.MeshStandardMaterial({ color: '#4d7c42', roughness: 0.7 });
      for (const [px, pz] of [[-5.7, -4.8], [5.7, 4.8]]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 12), potMat);
        pot.position.set(cx + px, 0.21, pz); g.add(pot);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), leafMat);
        leaves.position.set(cx + px, 0.68, pz); g.add(leaves);
        this.colliders.push({ minX: cx + px - 0.35, maxX: cx + px + 0.35, minZ: pz - 0.35, maxZ: pz + 0.35 });
      }
      // Fireplace in last room's east wall (or first room)
      if (idx === 0) {
        const fx = ROOM_W / 2 - 0.35;
        addBox(this.colliders, g, new THREE.MeshStandardMaterial({ color: '#5c3c24', roughness: 0.8 }), fx - 0.25, fx + 0.25, 0, 1.4, -1.0, 1.0, true);
        const fire = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.95), new THREE.MeshBasicMaterial({ color: '#ff7b29' }));
        fire.position.set(fx - 0.22, 0.45, 0); g.add(fire);
        this.fireLight = new THREE.PointLight('#ff8a3d', 8, 9, 1.5);
        this.fireLight.position.set(fx - 0.6, 0.8, 0);
        g.add(this.fireLight);
      }
    } else {
      addBox(this.colliders, g, M.bench, cx - 1.3, cx + 1.3, 0, 0.42, -0.35, 0.35, true);
      addBox(this.colliders, g, M.trim, cx - 1.34, cx + 1.34, 0.42, 0.48, -0.39, 0.39, false);
    }
  }

  spawnHeart(x, y, z) {
    if (!this.world) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, opacity: 0.95 }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(0.22);
    this.world.add(sp);
    this.particles.push({ sp, baseY: y, phase: 0, speed: 1.4, life: 1.4, transient: true });
  }

  updateParticles(dt) {
    const t = performance.now() * 0.001;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.transient) {
        p.life -= dt;
        p.sp.position.y += dt * 0.55;
        p.sp.material.opacity = Math.max(0, p.life / 1.4);
        if (p.life <= 0) {
          this.world.remove(p.sp);
          p.sp.material.dispose();
          this.particles.splice(i, 1);
        }
      } else {
        p.sp.position.y = p.baseY + Math.sin(t * p.speed + p.phase) * 0.22;
      }
    }
    if (this.fireLight) {
      this.fireLight.intensity = 7.5 + Math.sin(t * 7.3) * 1.4 + Math.cos(t * 11.1) * 0.7;
    }
  }

  _loadEntry(e) {
    if (e.tex || e.loading || e.failed) return Promise.resolve();
    e.loading = true;
    const gen = this.generation;
    const img = new Image();
    img.decoding = 'async';
    img.src = e.photo.texUrl || e.photo.url;
    return img.decode().then(() => {
      if (gen !== this.generation) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.aniso;
      t.needsUpdate = true;
      e.tex = t; e.mat.map = t;
    }).catch(() => { if (gen === this.generation) e.failed = true; })
      .finally(() => { if (gen === this.generation) e.loading = false; });
  }

  _unloadEntry(e) {
    if (!e.tex) return;
    e.tex.dispose(); e.tex = null; e.mat.map = this.placeholder;
  }

  ensureTextures(c) {
    for (const e of this.entries) {
      const d = Math.abs(e.roomIndex - c);
      if (d <= LOAD_ROOMS) this._loadEntry(e);
      else if (d >= UNLOAD_ROOMS) this._unloadEntry(e);
    }
  }

  preloadAround() {
    const c = Math.max(0, this.curRoom);
    return withTimeout(
      Promise.all(this.entries.filter((e) => Math.abs(e.roomIndex - c) <= LOAD_ROOMS).map((e) => this._loadEntry(e))),
      9000
    );
  }

  updateRoomWindow(pos, force) {
    const c = clamp(Math.round(pos.x / ROOM_W), 0, this.roomCount - 1);
    if (c === this.curRoom && !force) return;
    this.curRoom = c;
    for (const r of this.rooms) r.group.visible = Math.abs(r.index - c) <= VISIBLE_ROOMS;
    this.nearbyWalls = [];
    for (let i = Math.max(0, c - 1); i <= Math.min(this.roomCount - 1, c + 1); i++) {
      this.nearbyWalls.push(...this.rooms[i].walls);
    }
    this.ensureTextures(c);
  }

  updateLights(pos, dt, snap) {
    if (!this.poolLights.length) return;
    const cands = [];
    for (let i = Math.max(0, this.curRoom - 1); i <= Math.min(this.roomCount - 1, this.curRoom + 1); i++) {
      cands.push(...this.rooms[i].anchors);
    }
    const px = pos.x, pz = pos.z;
    cands.sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    this.poolLights.forEach((l, i) => {
      const a = cands[i];
      if (a) { l.position.lerp(a, k); l.intensity = this.theme.lightI; }
      else l.intensity = 0;
    });
  }

  resolveCollisions(p) {
    const R = PLAYER_R;
    for (let it = 0; it < 3; it++) {
      for (const c of this.colliders) {
        if (p.x < c.minX - R || p.x > c.maxX + R || p.z < c.minZ - R || p.z > c.maxZ + R) continue;
        const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = R - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
        } else {
          const l = p.x - c.minX, r = c.maxX - p.x, u = p.z - c.minZ, dn = c.maxZ - p.z;
          const m = Math.min(l, r, u, dn);
          if (m === l) p.x = c.minX - R; else if (m === r) p.x = c.maxX + R;
          else if (m === u) p.z = c.minZ - R; else p.z = c.maxZ + R;
        }
      }
    }
  }
}
