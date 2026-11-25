import * as THREE from 'three';

let GEO = null;
let BLOB_TEX = null;

function getSharedGeo() {
  if (GEO) return GEO;
  GEO = {
    torso: new THREE.CapsuleGeometry(0.2, 0.34, 4, 12),
    head: new THREE.SphereGeometry(0.17, 20, 16),
    cap: new THREE.SphereGeometry(0.182, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    longHairBack: new THREE.CapsuleGeometry(0.145, 0.24, 4, 10),
    braidSeg: new THREE.SphereGeometry(0.055, 10, 8),
    bun: new THREE.SphereGeometry(0.085, 12, 10),
    pigtail: new THREE.SphereGeometry(0.075, 10, 10),
    skirt: new THREE.ConeGeometry(0.25, 0.34, 16, 1, false),
    royalGown: new THREE.ConeGeometry(0.42, 0.92, 20, 1, false),
    tunicSkirt: new THREE.CylinderGeometry(0.21, 0.27, 0.28, 16),
    cape: new THREE.BoxGeometry(0.46, 0.95, 0.03),
    crownBand: new THREE.TorusGeometry(0.135, 0.018, 6, 18),
    crownPeak: new THREE.ConeGeometry(0.028, 0.09, 6),
    belt: new THREE.CylinderGeometry(0.215, 0.215, 0.06, 16),
    buckle: new THREE.BoxGeometry(0.09, 0.07, 0.03),
    vest: new THREE.BoxGeometry(0.15, 0.38, 0.04),
    eye: new THREE.SphereGeometry(0.02, 8, 8),
    glassesRim: new THREE.TorusGeometry(0.042, 0.008, 6, 14),
    arm: new THREE.CapsuleGeometry(0.058, 0.33, 4, 8),
    leg: new THREE.CapsuleGeometry(0.074, 0.58, 4, 8),
    boot: new THREE.CylinderGeometry(0.088, 0.082, 0.36, 12),
    hand: new THREE.SphereGeometry(0.055, 10, 10),
    shoe: new THREE.BoxGeometry(0.14, 0.1, 0.27),
    shadow: new THREE.CircleGeometry(0.5, 24)
  };
  const sc = document.createElement('canvas');
  sc.width = sc.height = 64;
  const sg = sc.getContext('2d');
  const grd = sg.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.52)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 64, 64);
  BLOB_TEX = new THREE.CanvasTexture(sc);
  return GEO;
}

const MAT_PANTS = new THREE.MeshStandardMaterial({ color: '#2b3040', roughness: 0.78 });
const MAT_SHOE = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.7 });
const MAT_EYE = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.4 });
const MAT_GLASSES = new THREE.MeshStandardMaterial({ color: '#c8a85a', metalness: 0.7, roughness: 0.3 });
const MAT_SILVER = new THREE.MeshStandardMaterial({ color: '#e6f3ff', metalness: 0.85, roughness: 0.2 });
const MAT_BELT = new THREE.MeshStandardMaterial({ color: '#1b355c', roughness: 0.5 });

export const TYPE_META = {
  male:   { label: 'Male',   scale: 1.0,  speedMul: 1.0 },
  female: { label: 'Female', scale: 0.96, speedMul: 1.0 },
  boy:    { label: 'Boy',    scale: 0.73, speedMul: 1.08 },
  girl:   { label: 'Girl',   scale: 0.71, speedMul: 1.08 },
  elder:  { label: 'Elder',  scale: 0.95, speedMul: 0.72 }
};

function makeLabelTexture(name, active) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 76;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 320, 76);
  g.font = 'bold 30px system-ui, -apple-system, sans-serif';
  const tw = Math.min(260, g.measureText(name).width + 44);
  const rx = (320 - tw) / 2;
  g.fillStyle = active ? 'rgba(28, 22, 14, 0.92)' : 'rgba(14, 14, 18, 0.76)';
  g.beginPath(); g.roundRect(rx, 10, tw, 54, 27); g.fill();
  g.lineWidth = active ? 4 : 2;
  g.strokeStyle = active ? '#f0cd7a' : 'rgba(255,255,255,0.28)';
  g.stroke();
  g.fillStyle = active ? '#ffe8a8' : '#f3f3f6';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.slice(0, 16), 160, 38, tw - 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCharacterMesh(spec, withLabel = true) {
  const G = getSharedGeo();
  const meta = TYPE_META[spec.type] || TYPE_META.male;
  const isRoyal = spec.outfit === 'royal';

  const skinMat = new THREE.MeshStandardMaterial({ color: spec.skin || '#f0c08a', roughness: 0.72 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: spec.shirt || '#5ea4e6', roughness: isRoyal ? 0.45 : 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: spec.hair || '#2a1a10', roughness: 0.75 });
  const capeMat = new THREE.MeshStandardMaterial({
    color: spec.cape || spec.shirt || '#7ec0f5',
    roughness: 0.5, transparent: spec.type === 'female' && isRoyal, opacity: spec.type === 'female' && isRoyal ? 0.72 : 1
  });
  const pantsMat = isRoyal && spec.type === 'male'
    ? new THREE.MeshStandardMaterial({ color: spec.shirt || '#4f90d4', roughness: 0.6 })
    : MAT_PANTS;
  const bootMat = isRoyal
    ? new THREE.MeshStandardMaterial({ color: spec.type === 'male' ? '#1c3f6e' : (spec.shirt || '#4888c8'), roughness: 0.4 })
    : MAT_SHOE;

  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(meta.scale);
  group.add(rig);

  const body = new THREE.Group();
  rig.add(body);

  const torso = new THREE.Mesh(G.torso, shirtMat);
  torso.position.y = 1.08;
  torso.scale.set(spec.type === 'female' ? 0.88 : 1, 1, spec.type === 'female' ? 0.68 : 0.75);
  body.add(torso);

  if (isRoyal) {
    // Flowing royal cape
    const cape = new THREE.Mesh(G.cape, capeMat);
    cape.position.set(0, 0.92, -0.2);
    cape.rotation.x = 0.14;
    body.add(cape);

    if (spec.type === 'female' || spec.type === 'girl') {
      // Long ice gown
      const gown = new THREE.Mesh(G.royalGown, shirtMat);
      gown.position.y = 0.56;
      body.add(gown);
    } else {
      // Male royal tunic + white vest + belt & buckle
      const vest = new THREE.Mesh(G.vest, MAT_SILVER);
      vest.position.set(0, 1.1, 0.15);
      body.add(vest);
      const tunic = new THREE.Mesh(G.tunicSkirt, shirtMat);
      tunic.position.y = 0.84;
      body.add(tunic);
      const belt = new THREE.Mesh(G.belt, MAT_BELT);
      belt.position.y = 0.92;
      body.add(belt);
      const buckle = new THREE.Mesh(G.buckle, MAT_SILVER);
      buckle.position.set(0, 0.92, 0.21);
      body.add(buckle);
    }
  } else if (spec.type === 'female' || spec.type === 'girl') {
    const skirt = new THREE.Mesh(G.skirt, shirtMat);
    skirt.position.y = 0.8;
    body.add(skirt);
  }

  const head = new THREE.Mesh(G.head, skinMat);
  head.position.y = 1.58;
  body.add(head);

  const cap = new THREE.Mesh(G.cap, hairMat);
  cap.position.set(0, 1.6, -0.01);
  cap.rotation.x = -0.2;
  body.add(cap);

  if (isRoyal) {
    // Silver royal tiara / crown
    const band = new THREE.Mesh(G.crownBand, MAT_SILVER);
    band.position.set(0, 1.73, 0);
    band.rotation.x = Math.PI / 2 - 0.12;
    body.add(band);
    for (let p = -1; p <= 1; p++) {
      const peak = new THREE.Mesh(G.crownPeak, MAT_SILVER);
      peak.position.set(p * 0.06, 1.79 - Math.abs(p) * 0.015, 0.11 - Math.abs(p) * 0.02);
      body.add(peak);
    }
  }

  if (spec.type === 'female') {
    if (isRoyal) {
      // Side braid over right shoulder (matching Ice Queen photo)
      for (let s = 0; s < 6; s++) {
        const seg = new THREE.Mesh(G.braidSeg, hairMat);
        seg.position.set(0.16 + s * 0.008, 1.5 - s * 0.075, 0.08 + s * 0.012);
        seg.scale.setScalar(1 - s * 0.09);
        body.add(seg);
      }
    } else {
      const back = new THREE.Mesh(G.longHairBack, hairMat);
      back.position.set(0, 1.46, -0.1);
      back.scale.set(1.05, 1, 0.7);
      body.add(back);
    }
  } else if (spec.type === 'girl') {
    for (const s of [-1, 1]) {
      const pig = new THREE.Mesh(G.pigtail, hairMat);
      pig.position.set(0.19 * s, 1.54, -0.04);
      body.add(pig);
    }
  } else if (spec.type === 'elder') {
    const bun = new THREE.Mesh(G.bun, hairMat);
    bun.position.set(0, 1.64, -0.17);
    body.add(bun);
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(G.glassesRim, MAT_GLASSES);
      rim.position.set(0.062 * s, 1.58, 0.165);
      body.add(rim);
    }
  }

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(G.eye, MAT_EYE);
    eye.position.set(0.062 * s, 1.58, 0.158);
    body.add(eye);
  }

  const makeLimb = (x, y, geo, mat, endKind) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const m = new THREE.Mesh(geo, mat);
    const len = endKind === 'hand' ? 0.33 : 0.58;
    const rad = endKind === 'hand' ? 0.058 : 0.074;
    m.position.y = -(len / 2 + rad * 0.6);
    p.add(m);
    if (endKind === 'hand') {
      const h = new THREE.Mesh(G.hand, skinMat);
      h.position.y = -(len + rad * 1.2) - 0.01;
      p.add(h);
    } else {
      if (isRoyal && spec.type === 'male') {
        const boot = new THREE.Mesh(G.boot, bootMat);
        boot.position.y = -(len + rad * 0.6) + 0.12;
        p.add(boot);
      }
      const f = new THREE.Mesh(G.shoe, bootMat);
      f.position.set(0, -(len + rad * 1.2) - 0.03, 0.05);
      p.add(f);
    }
    body.add(p);
    return p;
  };

  const armOffset = spec.type === 'female' ? 0.24 : 0.27;
  const armL = makeLimb(-armOffset, 1.32, G.arm, shirtMat, 'hand');
  const armR = makeLimb(armOffset, 1.32, G.arm, shirtMat, 'hand');
  const legL = makeLimb(-0.1, 0.8, G.leg, pantsMat, 'foot');
  const legR = makeLimb(0.1, 0.8, G.leg, pantsMat, 'foot');

  const shadow = new THREE.Mesh(G.shadow, new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.scale.setScalar(meta.scale);
  group.add(shadow);

  let label = null;
  let labelTex = null;
  if (withLabel) {
    labelTex = makeLabelTexture(spec.name || 'Guest', false);
    label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: true }));
    label.position.set(0, 2.02 * meta.scale + (isRoyal ? 0.28 : 0.16), 0);
    label.scale.set(1.25, 0.3, 1);
    group.add(label);
  }

  const mats = [skinMat, shirtMat, hairMat, capeMat, bootMat, shadow.material];
  if (pantsMat !== MAT_PANTS) mats.push(pantsMat);

  return {
    group, rig, body, torso, armL, armR, legL, legR, label,
    mats,
    setLabelActive(active) {
      if (!label) return;
      const next = makeLabelTexture(spec.name || 'Guest', active);
      label.material.map = next;
      label.material.needsUpdate = true;
      if (labelTex) labelTex.dispose();
      labelTex = next;
    },
    dispose() {
      this.mats.forEach((m) => m.dispose());
      if (label) label.material.dispose();
      if (labelTex) labelTex.dispose();
    }
  };
}

export function angleLerp(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

export function animateCharacter(actor, dt, speed, running, isLoversPair, holdSide, emoteTime, onStep) {
  const ch = actor.mesh;
  const amp = Math.min(1.3, speed / 3.3) * 0.75;
  if (speed > 0.45) {
    actor.phase += dt * speed * 1.9;
    const k = Math.floor(actor.phase / Math.PI);
    if (k !== actor.stepK) {
      actor.stepK = k;
      if (onStep) onStep(running);
    }
  }
  const s = Math.sin(actor.phase);
  ch.legL.rotation.x = s * amp;
  ch.legR.rotation.x = -s * amp;
  ch.armL.rotation.x = -s * amp * 0.85;
  ch.armR.rotation.x = s * amp * 0.85;
  ch.armL.rotation.z = 0;
  ch.armR.rotation.z = 0;
  ch.body.position.y = Math.abs(s) * 0.042 * Math.min(1, amp * 1.5);
  ch.torso.scale.y = 1 + Math.sin(performance.now() / 600 + actor.index) * 0.012;

  if (isLoversPair && holdSide) {
    if (holdSide === 'left') {
      ch.armL.rotation.z = -0.38;
      ch.armL.rotation.x *= 0.25;
    } else {
      ch.armR.rotation.z = 0.38;
      ch.armR.rotation.x *= 0.25;
    }
  }

  if (emoteTime > 0) {
    const t = performance.now() * 0.01;
    ch.armR.rotation.x = -2.4 + Math.sin(t * 2) * 0.4;
    ch.armR.rotation.z = 0.35 + Math.sin(t * 2) * 0.25;
    ch.body.position.y += Math.abs(Math.sin(t)) * 0.08;
  } else if (actor.idleBounce > 0 && speed < 0.25) {
    const t = performance.now() * 0.009;
    ch.armL.rotation.x = -2.2 + Math.sin(t) * 0.35;
    ch.body.position.y += Math.abs(Math.sin(t * 1.3)) * 0.06;
  }

  ch.group.position.set(actor.pos.x, 0, actor.pos.z);
  ch.group.rotation.y = actor.heading;
}

export function updateCompanions(actors, activeIdx, relationship, roomW, roomCount, dt, resolveCollisions, onHeartSpawn) {
  const leader = actors[activeIdx];
  if (!leader) return;
  const leaderSpeed = Math.hypot(leader.vel.x, leader.vel.y);
  const leaderRoom = Math.max(0, Math.min(roomCount - 1, Math.round(leader.pos.x / roomW)));
  const lx = Math.sin(leader.heading), lz = Math.cos(leader.heading);
  const rx = Math.cos(leader.heading), rz = -Math.sin(leader.heading);

  let compSlot = 0;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    if (i === activeIdx) continue;
    compSlot++;
    const meta = TYPE_META[a.spec.type] || TYPE_META.male;

    let sideOff = 0, fwdOff = 0;
    if (relationship === 'lovers' && actors.length === 2) {
      sideOff = 0.62;
      fwdOff = -0.05;
    } else if (relationship === 'family' && (a.spec.type === 'boy' || a.spec.type === 'girl')) {
      sideOff = (compSlot % 2 === 0 ? -1 : 1) * (0.75 + Math.floor(compSlot / 2) * 0.55);
      fwdOff = 0.85;
    } else {
      const row = Math.floor((compSlot - 1) / 2);
      const col = compSlot % 2 === 1 ? -1 : 1;
      sideOff = col * (0.95 + row * 0.35);
      fwdOff = -1.1 - row * 0.95;
    }

    const goalX = leader.pos.x + lx * fwdOff + rx * sideOff;
    const goalZ = leader.pos.z + lz * fwdOff + rz * sideOff;

    const myRoom = Math.max(0, Math.min(roomCount - 1, Math.round(a.pos.x / roomW)));
    let steerX = goalX, steerZ = goalZ;
    if (myRoom !== leaderRoom) {
      const dir = leaderRoom > myRoom ? 1 : -1;
      const doorX = (myRoom + (dir > 0 ? 0.5 : -0.5)) * roomW;
      steerX = doorX + dir * 0.8;
      steerZ = 0;
    }

    const dx = steerX - a.pos.x, dz = steerZ - a.pos.z;
    const dist = Math.hypot(dx, dz);
    const stopDist = relationship === 'lovers' ? 0.14 : 0.25;
    const maxSpd = (leaderSpeed > 4.0 ? 5.9 : 3.4) * meta.speedMul;
    let tx = 0, tz = 0;
    if (dist > stopDist) {
      const spd = Math.min(maxSpd, dist * 3.2);
      tx = (dx / dist) * spd;
      tz = (dz / dist) * spd;
    }

    const blend = 1 - Math.exp(-9 * dt);
    a.vel.x += (tx - a.vel.x) * blend;
    a.vel.y += (tz - a.vel.y) * blend;
    a.pos.x += a.vel.x * dt;
    a.pos.z += a.vel.y * dt;

    for (let j = 0; j < actors.length; j++) {
      if (i === j) continue;
      const o = actors[j];
      const minSep = relationship === 'lovers' && actors.length === 2 ? 0.52 : 0.72;
      const sx = a.pos.x - o.pos.x, sz = a.pos.z - o.pos.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 1e-4 && sd < minSep) {
        const push = (minSep - sd) * 0.5;
        a.pos.x += (sx / sd) * push;
        a.pos.z += (sz / sd) * push;
      }
    }
    resolveCollisions(a.pos);

    const speed = Math.hypot(a.vel.x, a.vel.y);
    const targetHeading = speed > 0.25 ? Math.atan2(a.vel.x, a.vel.y) : leader.heading;
    a.heading = angleLerp(a.heading, targetHeading, 1 - Math.exp(-10 * dt));

    if (relationship === 'friends' && leaderSpeed < 0.25 && speed < 0.25) {
      a.idleTimer -= dt;
      if (a.idleTimer <= 0) {
        a.idleBounce = 1.4;
        a.idleTimer = 3.5 + Math.random() * 4;
      }
    }
    if (a.idleBounce > 0) a.idleBounce = Math.max(0, a.idleBounce - dt);

    let holdSide = null;
    if (relationship === 'lovers' && actors.length === 2) {
      const dToLeader = Math.hypot(leader.pos.x - a.pos.x, leader.pos.z - a.pos.z);
      if (dToLeader < 1.15) {
        holdSide = 'left';
        leader.holdSide = 'right';
        if (leaderSpeed < 0.25 && speed < 0.25 && onHeartSpawn) {
          a.heartTimer -= dt;
          if (a.heartTimer <= 0) {
            onHeartSpawn((leader.pos.x + a.pos.x) / 2, 1.75, (leader.pos.z + a.pos.z) / 2);
            a.heartTimer = 0.85 + Math.random() * 0.7;
          }
        }
      } else {
        leader.holdSide = null;
      }
    }

    animateCharacter(a, dt, speed, leaderSpeed > 4.0, relationship === 'lovers', holdSide, a.emoteTime);
  }
}
