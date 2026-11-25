import * as THREE from 'three';
import { RELATIONSHIPS, THEMES, OCCASIONS, ROYAL_FEMALE_DEFAULT, ROYAL_MALE_DEFAULT } from './themes.js';
import { TYPE_META, angleLerp, animateCharacter, updateCompanions } from './characters.js';
import { audio } from './audio.js';
import { updatePreview, stopPreview } from './preview.js';
import { MuseumWorld, ROOM_W, ROOM_D, ROOM_H, DOOR_W, PER_ROOM } from './museum.js';

const FULL_MAX = 2048, TEX_MAX = 1280;
const ACCEPT = /^image\/(jpeg|png|webp|gif|avif|bmp)$/i;
const ACCEPT_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

const SHIRT_PALETTE = ['#c84b6e', '#38b6ff', '#38d9c0', '#d4a84b', '#6b8e5a', '#7e5bef', '#e07a5f', '#2f6fb3'];
const HAIR_PALETTE = ['#1b1817', '#2c1810', '#5a3822', '#9c6b3b', '#d9b25f', '#b5492e', '#d8d8dc'];
const SKIN_PALETTE = ['#fde0c8', '#f0c08a', '#dfa672', '#b87a4b', '#8d5524', '#5c381c'];
const DEFAULT_NAMES = ['Alex', 'Maya', 'Sam', 'Chloe', 'Leo', 'Lily'];

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

const state = {
  photos: [],
  relationship: 'lovers',
  occasion: 'none',
  customOccasionText: '',
  styleOverride: 'theme',
  characters: RELATIONSHIPS.lovers.defaultChars.map((c) => ({ ...c })),
  activeCharIdx: 0,
  editingCharIdx: 0,
  step: 1,
  inMuseum: false,
  hasGeneratedOnce: false
};
let nextId = 1;
let savedPositions = null;

/* ====================================================================
 * Small UI helpers
 * ==================================================================== */
let toastTimer = 0;
function toast(msg, ms = 3800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function showLoader(text) { $('#loaderText').textContent = text || 'Loading…'; $('#loader').classList.add('show'); }
function hideLoader() { $('#loader').classList.remove('show'); }
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));

/* ====================================================================
 * Image upload + processing (all local)
 * ==================================================================== */
function isImageFile(f) { return ACCEPT.test(f.type || '') || ACCEPT_EXT.test(f.name || ''); }
function prettyTitle(name) {
  const t = name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (t || 'Untitled').slice(0, 60);
}
function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}
function drawScaled(img, maxSide) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) throw new Error('empty image');
  const s = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  return c;
}
const canvasToBlob = (c, q = 0.9) =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q));

async function processImage(file) {
  const { img, url } = await loadImageEl(file);
  try {
    const full = drawScaled(img, FULL_MAX);
    const w = full.width, h = full.height;
    const fullBlob = await canvasToBlob(full, 0.9);
    let texBlob = fullBlob;
    if (Math.max(w, h) > TEX_MAX) {
      const t = drawScaled(img, TEX_MAX);
      texBlob = await canvasToBlob(t, 0.88);
      t.width = t.height = 0;
    }
    const th = drawScaled(img, 260);
    const thumb = th.toDataURL('image/jpeg', 0.8);
    th.width = th.height = 0; full.width = full.height = 0;
    return {
      id: nextId++, title: prettyTitle(file.name), w, h, thumb,
      url: URL.createObjectURL(fullBlob),
      texUrl: texBlob === fullBlob ? null : URL.createObjectURL(texBlob)
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setProcessing(done, total) {
  const box = $('#processing');
  if (done === null) { box.hidden = true; return; }
  box.hidden = false;
  $('#processingBar').style.width = `${Math.round((done / total) * 100)}%`;
  $('#processingText').textContent = `Preparing photos… ${done} / ${total}`;
}

let addChain = Promise.resolve();
function addFiles(fileList) {
  const job = addChain.then(() => doAddFiles(fileList));
  addChain = job.catch(() => {});
  return job;
}
async function doAddFiles(fileList) {
  const all = Array.from(fileList || []);
  if (!all.length) return 0;
  const ok = all.filter(isImageFile);
  const skipped = all.length - ok.length;
  if (!ok.length) { toast('No supported images found. Use JPG, PNG, WebP, GIF, AVIF or BMP.'); return 0; }
  let added = 0, failed = 0;
  setProcessing(0, ok.length);
  for (let i = 0; i < ok.length; i++) {
    try {
      const p = await processImage(ok[i]);
      state.photos.push(p);
      added++;
      $('#grid').append(makeCard(p, state.photos.length - 1));
      updateCount();
    } catch (e) { failed++; }
    setProcessing(i + 1, ok.length);
  }
  setProcessing(null);
  const msgs = [];
  if (skipped) msgs.push(`${skipped} unsupported file${skipped > 1 ? 's' : ''} skipped`);
  if (failed) msgs.push(`${failed} image${failed > 1 ? 's' : ''} couldn’t be read`);
  if (msgs.length) { const m = msgs.join(' · '); toast(m[0].toUpperCase() + m.slice(1)); }
  return added;
}

function makeCard(p, i) {
  const li = document.createElement('li');
  li.className = 'card';
  const img = new Image();
  img.src = p.thumb; img.alt = p.title; img.draggable = false;
  const rm = document.createElement('button');
  rm.type = 'button'; rm.className = 'remove'; rm.textContent = '×';
  rm.setAttribute('aria-label', `Remove ${p.title}`);
  rm.onclick = () => removePhoto(p.id);
  const input = document.createElement('input');
  input.type = 'text'; input.value = p.title; input.maxLength = 60;
  input.setAttribute('aria-label', `Title for photo ${i + 1}`);
  input.oninput = () => { p.title = input.value.trim() || 'Untitled'; img.alt = p.title; };
  li.append(img, rm, input);
  return li;
}
function renderGrid() {
  const grid = $('#grid');
  grid.textContent = '';
  const frag = document.createDocumentFragment();
  state.photos.forEach((p, i) => frag.append(makeCard(p, i)));
  grid.append(frag);
  updateCount();
}
function updateCount() {
  const n = state.photos.length;
  const rooms = Math.max(1, Math.ceil(n / PER_ROOM));
  $('#countLabel').textContent = n ? `${n} photo${n > 1 ? 's' : ''} · ${rooms} room${rooms > 1 ? 's' : ''}` : 'No photos yet';
  $('#clearAll').hidden = n === 0;
  if (state.step === 1) $('#wizNext').disabled = n === 0;
}
function revokePhoto(p) { URL.revokeObjectURL(p.url); if (p.texUrl) URL.revokeObjectURL(p.texUrl); }
function removePhoto(id) {
  const i = state.photos.findIndex((p) => p.id === id);
  if (i < 0) return;
  revokePhoto(state.photos[i]);
  state.photos.splice(i, 1);
  renderGrid();
}

/* ====================================================================
 * 4-Step Setup Wizard
 * ==================================================================== */
function setStep(step) {
  if (step > 1 && state.photos.length === 0) {
    toast('Please upload at least one photo first.');
    return;
  }
  state.step = clamp(step, 1, 4);
  for (let i = 1; i <= 4; i++) {
    $(`#step${i}`).hidden = i !== state.step;
  }
  document.querySelectorAll('.step-pill').forEach((btn) => {
    const s = Number(btn.dataset.step);
    btn.classList.toggle('active', s === state.step);
    btn.classList.toggle('done', s < state.step);
  });
  $('#wizBack').hidden = state.step === 1;
  $('#wizNext').hidden = state.step === 4;
  $('#generateBtn').hidden = state.step !== 4;
  $('#wizNext').disabled = state.step === 1 && state.photos.length === 0;

  if (state.step === 2) { renderRelCards(); renderOccasionStep(); renderMusicList(); }
  if (state.step === 3) renderCharStep();
  else stopPreview();
  if (state.step === 4) renderReview();
}

function applyRelationship(relId) {
  state.relationship = relId;
  const rel = RELATIONSHIPS[relId];
  // Keep existing characters if compatible, otherwise normalize count & types
  if (state.characters.length < rel.minChars || state.characters.length > rel.maxChars) {
    state.characters = rel.defaultChars.map((c) => ({ ...c }));
  } else {
    state.characters.forEach((c) => {
      if (!rel.types.includes(c.type)) c.type = 'male';
    });
  }
  state.editingCharIdx = clamp(state.editingCharIdx, 0, state.characters.length - 1);
  state.activeCharIdx = clamp(state.activeCharIdx, 0, state.characters.length - 1);
  renderRelCards();
}

function renderRelCards() {
  const box = $('#relCards');
  box.textContent = '';
  Object.values(RELATIONSHIPS).forEach((rel) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `rel-card${state.relationship === rel.id ? ' selected' : ''}`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(state.relationship === rel.id));

    const swatches = rel.swatches.map((c) => `<i style="background:${c}"></i>`).join('');
    btn.innerHTML = `
      <div class="rel-top">
        <span class="rel-title">${rel.icon} ${rel.label}</span>
        <span class="rel-swatches">${swatches}</span>
      </div>
      <div class="rel-gallery">${rel.galleryName}</div>
      <div class="rel-desc">${rel.desc}</div>
      <div class="rel-music">&#9835; ${rel.musicLabel}</div>
    `;
    btn.onclick = () => applyRelationship(rel.id);
    box.append(btn);
  });
  $('#styleOverride').value = state.styleOverride;
}

function renderOccasionStep() {
  const box = $('#occasionBtns');
  box.textContent = '';
  Object.values(OCCASIONS).forEach((occ) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pill-btn${state.occasion === occ.id ? ' active' : ''}`;
    b.textContent = `${occ.icon} ${occ.label}`;
    b.onclick = () => {
      state.occasion = occ.id;
      renderOccasionStep();
    };
    box.append(b);
  });
  const customInput = $('#customOccasionInput');
  customInput.hidden = state.occasion !== 'custom';
  customInput.value = state.customOccasionText;
}

function renderMusicList() {
  const list = $('#musicList');
  const status = $('#musicStatus');
  list.textContent = '';
  if (!audio.customTracks.length) {
    status.textContent = state.occasion === 'birthday'
      ? 'Using built-in Birthday & theme soundtrack'
      : 'Using built-in theme soundtrack';
    return;
  }
  status.textContent = `${audio.customTracks.length} custom track${audio.customTracks.length > 1 ? 's' : ''} added`;
  audio.customTracks.forEach((tr) => {
    const li = document.createElement('li');
    li.className = 'music-chip';
    const span = document.createElement('span');
    span.textContent = `♪ ${tr.name}`;
    const rm = document.createElement('button');
    rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', `Remove ${tr.name}`);
    rm.onclick = () => { audio.removeCustomTrack(tr.id); renderMusicList(); };
    li.append(span, rm);
    list.append(li);
  });
}

function setCharCount(count) {
  const rel = RELATIONSHIPS[state.relationship];
  const n = clamp(count, rel.minChars, rel.maxChars);
  while (state.characters.length < n) {
    const idx = state.characters.length;
    const base = idx % 2 === 0 ? ROYAL_FEMALE_DEFAULT : ROYAL_MALE_DEFAULT;
    state.characters.push({
      ...base,
      type: rel.types[idx % rel.types.length],
      name: DEFAULT_NAMES[idx % DEFAULT_NAMES.length]
    });
  }
  if (state.characters.length > n) state.characters.length = n;
  state.editingCharIdx = clamp(state.editingCharIdx, 0, n - 1);
  state.activeCharIdx = clamp(state.activeCharIdx, 0, n - 1);
  renderCharStep();
}

function renderSwatches(containerId, palette, currentVal, onPick) {
  const el = $(containerId);
  el.textContent = '';
  palette.forEach((col) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch${currentVal.toLowerCase() === col.toLowerCase() ? ' active' : ''}`;
    b.style.background = col;
    b.setAttribute('aria-label', `Color ${col}`);
    b.onclick = () => onPick(col);
    el.append(b);
  });
}

function renderCharStep() {
  const rel = RELATIONSHIPS[state.relationship];
  $('#charRuleNote').textContent = state.relationship === 'lovers'
    ? 'Lovers features exactly 2 visitors walking together.'
    : `Choose ${rel.minChars} to ${rel.maxChars} visitors for ${rel.label}.`;

  const countBox = $('#charCountBtns');
  countBox.textContent = '';
  for (let n = 1; n <= 6; n++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pill-btn${state.characters.length === n ? ' active' : ''}`;
    b.textContent = String(n);
    b.disabled = n < rel.minChars || n > rel.maxChars;
    b.onclick = () => setCharCount(n);
    countBox.append(b);
  }

  const tabs = $('#charTabs');
  tabs.textContent = '';
  state.characters.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `char-tab${i === state.editingCharIdx ? ' active' : ''}`;
    b.innerHTML = `<span class="dot" style="background:${c.shirt}"></span>${c.name || `Guest ${i + 1}`}`;
    b.onclick = () => { state.editingCharIdx = i; renderCharStep(); };
    tabs.append(b);
  });

  const ch = state.characters[state.editingCharIdx];
  $('#charName').value = ch.name;

  const typeBox = $('#charTypeBtns');
  typeBox.textContent = '';
  rel.types.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pill-btn${ch.type === t ? ' active' : ''}`;
    b.textContent = TYPE_META[t].label;
    b.onclick = () => { ch.type = t; renderCharStep(); };
    typeBox.append(b);
  });

  const outfitBox = $('#charOutfitBtns');
  outfitBox.textContent = '';
  [
    { id: 'royal', label: 'Royal Ice' },
    { id: 'casual', label: 'Casual' }
  ].forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pill-btn${(ch.outfit || 'royal') === o.id ? ' active' : ''}`;
    b.textContent = o.label;
    b.onclick = () => { ch.outfit = o.id; renderCharStep(); };
    outfitBox.append(b);
  });

  renderSwatches('#shirtSwatches', SHIRT_PALETTE, ch.shirt, (col) => { ch.shirt = col; renderCharStep(); });
  renderSwatches('#hairSwatches', HAIR_PALETTE, ch.hair, (col) => { ch.hair = col; renderCharStep(); });
  renderSwatches('#skinSwatches', SKIN_PALETTE, ch.skin, (col) => { ch.skin = col; renderCharStep(); });
  $('#shirtColor').value = ch.shirt;
  $('#hairColor').value = ch.hair;
  $('#skinColor').value = ch.skin;

  $('#previewLabel').textContent = `${ch.name || 'Guest'} (${TYPE_META[ch.type].label})`;
  updatePreview(ch);
}

function renderReview() {
  const rel = RELATIONSHIPS[state.relationship];
  const occ = OCCASIONS[state.occasion] || OCCASIONS.none;
  const occText = state.occasion === 'custom'
    ? ((state.customOccasionText || '').trim() || occ.title)
    : (occ.id === 'none' ? 'Standard gallery' : `${occ.icon} ${occ.label}`);
  const rooms = Math.max(1, Math.ceil(state.photos.length / PER_ROOM));
  const lookName = state.styleOverride === 'theme' ? rel.galleryName : THEMES[state.styleOverride].name;
  const musicText = audio.customTracks.length
    ? `${audio.customTracks.length} custom track${audio.customTracks.length > 1 ? 's' : ''} (${audio.customTracks[0].name})`
    : rel.musicLabel;
  const chips = state.characters.map((c) =>
    `<span class="review-chip"><i style="background:${c.shirt}"></i>${c.name || 'Guest'} (${TYPE_META[c.type].label})</span>`
  ).join('');

  $('#reviewSummary').innerHTML = `
    <div class="review-card">
      <h3>Photos &amp; Occasion</h3>
      <p><strong>${state.photos.length}</strong> photo${state.photos.length === 1 ? '' : 's'} across <strong>${rooms}</strong> room${rooms === 1 ? '' : 's'}</p>
      <p style="color:var(--gold-2)">${occText}</p>
    </div>
    <div class="review-card">
      <h3>Theme &amp; Music</h3>
      <p><strong>${rel.icon} ${rel.label}</strong> &middot; ${lookName}</p>
      <p style="color:var(--muted)">&#9835; ${musicText}</p>
    </div>
    <div class="review-card" style="grid-column: 1 / -1;">
      <h3>Visitors (${state.characters.length})</h3>
      <div class="review-chars">${chips}</div>
    </div>
  `;
}

/* ====================================================================
 * Renderer, MuseumWorld & Camera
 * ==================================================================== */
let renderer, scene, camera, canvasEl, aniso = 4, museum = null;
let yaw = 0, pitch = -0.05, firstPerson = false, camDist = 3.6, nearEntry = null, touchRun = false;
const keys = new Set();
const joy = { x: 0, y: 0 };
let dragging = false, dragMoved = 0, welcomeOpen = false;
const raycaster = new THREE.Raycaster();
const _dir = new THREE.Vector3(), _target = new THREE.Vector3();

function initRenderer() {
  if (renderer) return true;
  canvasEl = $('#scene');
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !isTouch, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.05, 85);
  camera.rotation.order = 'YXZ';
  museum = new MuseumWorld(scene, aniso);
  window.addEventListener('resize', onResize);
  canvasEl.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('Graphics context was lost. Please reload.', 8000); });
  setupMuseumInput();
  return true;
}
function onResize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 80 : 70;
  camera.updateProjectionMatrix();
  setupMinimapSize();
}

function renderCharChips() {
  const box = $('#charChips');
  box.textContent = '';
  if (!museum) return;
  museum.actors.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `char-chip${i === state.activeCharIdx ? ' active' : ''}`;
    b.innerHTML = `<span class="num">${i + 1}</span><span class="dot" style="background:${a.spec.shirt}"></span><span>${a.spec.name || `Guest ${i + 1}`}</span>`;
    b.onclick = (e) => { switchCharacter(i); e.currentTarget.blur(); };
    box.append(b);
  });
}

function switchCharacter(idx) {
  if (!museum || idx < 0 || idx >= museum.actors.length || idx === state.activeCharIdx) return;
  museum.actors[state.activeCharIdx]?.mesh.setLabelActive(false);
  state.activeCharIdx = idx;
  museum.actors[state.activeCharIdx]?.mesh.setLabelActive(true);
  renderCharChips();
}

function triggerEmote() {
  if (!museum) return;
  museum.actors.forEach((a, i) => {
    a.emoteTime = i === state.activeCharIdx ? 1.8 : 1.4;
  });
}

const viewerOpen = () => !$('#viewer').hidden;
const inputBlocked = () => viewerOpen() || welcomeOpen;

function update(dt) {
  if (!museum || !museum.actors.length) return;
  const active = museum.actors[state.activeCharIdx] || museum.actors[0];
  const meta = TYPE_META[active.spec.type] || TYPE_META.male;
  const blocked = inputBlocked();

  let f = 0, r = 0;
  if (!blocked) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    f += -joy.y; r += joy.x;
  }
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const run = !blocked && (keys.has('ShiftLeft') || keys.has('ShiftRight') || touchRun);
  const maxSpeed = (run ? 6.2 : 3.3) * meta.speedMul;

  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const tx = (fx * f + rx * r) * maxSpeed, tz = (fz * f + rz * r) * maxSpeed;
  const blend = 1 - Math.exp(-10 * dt);
  active.vel.x += (tx - active.vel.x) * blend;
  active.vel.y += (tz - active.vel.y) * blend;
  active.pos.x += active.vel.x * dt;
  active.pos.z += active.vel.y * dt;
  museum.resolveCollisions(active.pos);

  const speed = Math.hypot(active.vel.x, active.vel.y);
  let targetHeading = active.heading;
  if (firstPerson) targetHeading = yaw + Math.PI;
  else if (speed > 0.2) targetHeading = Math.atan2(active.vel.x, active.vel.y);
  active.heading = angleLerp(active.heading, targetHeading, 1 - Math.exp(-14 * dt));

  if (active.emoteTime > 0) active.emoteTime = Math.max(0, active.emoteTime - dt);
  animateCharacter(
    active, dt, speed, run,
    state.relationship === 'lovers' && museum.actors.length === 2,
    active.holdSide, active.emoteTime,
    (isRun) => audio.footstep(isRun)
  );

  for (const a of museum.actors) {
    if (a !== active && a.emoteTime > 0) a.emoteTime = Math.max(0, a.emoteTime - dt);
  }
  updateCompanions(
    museum.actors, state.activeCharIdx, state.relationship,
    ROOM_W, museum.roomCount, dt,
    (p) => museum.resolveCollisions(p),
    (x, y, z) => museum.spawnHeart(x, y, z)
  );

  museum.updateRoomWindow(active.pos, false);
  updateCamera(active, dt);
  museum.updateLights(active.pos, dt, false);
  museum.updateParticles(dt);

  const near = blocked ? null : findNearest(active.pos);
  if (near !== nearEntry) { nearEntry = near; refreshPrompt(); }
}

function updateCamera(active, dt) {
  const scale = (TYPE_META[active.spec.type] || TYPE_META.male).scale;
  if (firstPerson) {
    active.mesh.group.visible = false;
    camera.position.set(active.pos.x, 1.62 * scale, active.pos.z);
    camera.rotation.set(pitch, yaw, 0);
    return;
  }
  const elev = clamp(0.28 - pitch, -0.12, 1.15), dist = camera.aspect < 0.8 ? 4.8 : 3.6;
  _dir.set(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
  _target.set(active.pos.x, 1.42 * scale, active.pos.z);
  raycaster.set(_target, _dir);
  raycaster.near = 0; raycaster.far = dist + 0.3;
  const hits = raycaster.intersectObjects(museum.nearbyWalls, false);
  let d = dist;
  if (hits.length) d = clamp(hits[0].distance - 0.3, 0.5, dist);
  camDist = d < camDist ? d : camDist + (d - camDist) * (1 - Math.exp(-6 * dt));
  camera.position.copy(_target).addScaledVector(_dir, camDist);
  camera.position.y = clamp(camera.position.y, 0.25, ROOM_H - 0.3);
  camera.lookAt(_target.x, _target.y + 0.15, _target.z);
  active.mesh.group.visible = camDist > 0.9;
}

function findNearest(pos) {
  let best = null, bd = 3.8;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  for (const e of museum.entries) {
    if (!e || Math.abs(e.roomIndex - museum.curRoom) > 1) continue;
    const dx = e.x - pos.x, dz = e.z - pos.z, d = Math.hypot(dx, dz);
    if (d > bd) continue;
    if ((dx * fx + dz * fz) / (d || 1) < 0.25) continue;
    best = e; bd = d;
  }
  return best;
}

function refreshPrompt() {
  const p = $('#prompt');
  $('#touchE').classList.toggle('ready', !!nearEntry);
  if (!nearEntry) { p.hidden = true; return; }
  p.textContent = '';
  if (isTouch) p.append('Tap View · ');
  else { const k = document.createElement('kbd'); k.textContent = 'E'; p.append(k, ' View · '); }
  p.append(`“${nearEntry.photo.title}”`);
  p.hidden = false;
}

function interact() {
  if (inputBlocked() || !nearEntry) return;
  // Characters look at the photo
  if (museum) {
    museum.actors.forEach((a) => {
      a.heading = Math.atan2(nearEntry.x - a.pos.x, nearEntry.z - a.pos.z);
      a.mesh.group.rotation.y = a.heading;
    });
  }
  openViewer(nearEntry.idx);
}

function toggleView() {
  firstPerson = !firstPerson;
  const b = $('#viewBtn');
  b.textContent = firstPerson ? 'Camera: 1st person' : 'Camera: 3rd person';
  b.setAttribute('aria-pressed', String(firstPerson));
  if (firstPerson) pitch = clamp(pitch, -1.2, 1.2);
}

/* ---- photo viewer ---- */
let viewerIdx = -1;
function openViewer(idx) {
  viewerIdx = idx;
  showViewerPhoto();
  $('#viewer').hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
  keys.clear(); joy.x = joy.y = 0;
  $('#viewerClose').focus();
}
function showViewerPhoto() {
  const p = state.photos[viewerIdx];
  if (!p) return;
  const img = $('#viewerImg');
  img.src = p.url; img.alt = p.title;
  $('#viewerTitle').textContent = p.title;
  $('#viewerCount').textContent = `${viewerIdx + 1} / ${state.photos.length}`;
}
function stepViewer(d) {
  const n = state.photos.length;
  if (!n) return;
  viewerIdx = (viewerIdx + d + n) % n;
  showViewerPhoto();
}
function closeViewer() {
  $('#viewer').hidden = true;
  viewerIdx = -1;
  if (canvasEl) canvasEl.focus({ preventScroll: true });
}

/* ---- museum input ---- */
let inputReady = false;
function setupMuseumInput() {
  if (inputReady) return;
  inputReady = true;

  window.addEventListener('keydown', (e) => {
    if (!state.inMuseum) return;
    if (viewerOpen()) {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowLeft') stepViewer(-1);
      else if (e.key === 'ArrowRight') stepViewer(1);
      return;
    }
    if (e.target && e.target.tagName === 'SELECT') return;
    if (e.code === 'KeyE' && !e.repeat) interact();
    else if (e.code === 'KeyV' && !e.repeat) toggleView();
    else if (e.code === 'KeyQ' && !e.repeat) triggerEmote();
    else if (e.code === 'Tab') {
      e.preventDefault();
      if (museum && museum.actors.length > 1) switchCharacter((state.activeCharIdx + 1) % museum.actors.length);
    } else if (/^Digit[1-6]$/.test(e.code)) {
      const n = Number(e.code.slice(5)) - 1;
      if (museum && n < museum.actors.length) switchCharacter(n);
    }
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !(e.target && e.target.tagName === 'BUTTON')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (e) => {
    if (!state.inMuseum || inputBlocked()) return;
    if (document.pointerLockElement === canvasEl || dragging) {
      yaw -= e.movementX * 0.0024;
      pitch = clamp(pitch - e.movementY * 0.0024, -1.25, 1.25);
      dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    }
  });
  canvasEl.addEventListener('mousedown', () => { dragging = true; dragMoved = 0; });
  window.addEventListener('mouseup', () => { dragging = false; });
  canvasEl.addEventListener('click', () => {
    if (isTouch || inputBlocked() || dragMoved > 4 || document.pointerLockElement === canvasEl) return;
    const r = canvasEl.requestPointerLock && canvasEl.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    $('#hint').style.visibility = document.pointerLockElement === canvasEl ? 'hidden' : 'visible';
  });

  $('#viewerClose').onclick = closeViewer;
  $('#viewerPrev').onclick = () => stepViewer(-1);
  $('#viewerNext').onclick = () => stepViewer(1);
  $('#viewer').addEventListener('click', (e) => { if (e.target === $('#viewer')) closeViewer(); });
  $('#viewBtn').onclick = (e) => { toggleView(); e.currentTarget.blur(); };
  $('#emoteBtn').onclick = (e) => { triggerEmote(); e.currentTarget.blur(); };
  $('#soundBtn').onclick = (e) => {
    audio.init();
    audio.enabled = !audio.enabled;
    audio.setPlaying(state.inMuseum);
    updateAudioUI();
    e.currentTarget.blur();
  };
  $('#volSlider').oninput = (e) => audio.setVolume(Number(e.target.value) / 100);
  $('#nextTrackBtn').onclick = (e) => {
    audio.init();
    const name = audio.nextTrack();
    toast(`Playing: ${name}`, 2400);
    e.currentTarget.blur();
  };
  $('#hudMusicBtn').onclick = (e) => { $('#musicInput').click(); e.currentTarget.blur(); };
  $('#editSetupBtn').onclick = backToSetup;
  $('#moreBtn').onclick = () => $('#moreInput').click();
  $('#moreInput').onchange = async (e) => { const files = e.target.files; await addMoreFiles(files); e.target.value = ''; };
  $('#welcomeGo').onclick = () => {
    welcomeOpen = false; $('#welcome').hidden = true;
    const ok = audio.init();
    if (!ok) toast('Audio could not start automatically.', 3200);
    audio.setTheme(state.relationship, museum?.theme?.floor, state.occasion);
    audio.setPlaying(true);
    updateAudioUI();
    if (!isTouch && canvasEl.requestPointerLock) { const r = canvasEl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); }
    canvasEl.focus({ preventScroll: true });
  };

  if (isTouch) setupTouch();
}

function updateAudioUI() {
  const btn = $('#soundBtn');
  btn.textContent = audio.enabled ? 'Sound on' : 'Sound off';
  btn.setAttribute('aria-pressed', String(audio.enabled));
}

let lookId = null, lastLook = null;
function setupTouch() {
  const zone = $('#joy'), knob = $('#joyKnob');
  let jid = null;
  const R = 46;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
  const handle = (t) => {
    const r = zone.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    joy.x = dx / R; joy.y = dy / R; setKnob(dx, dy);
  };
  zone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; jid = t.identifier; handle(t); }, { passive: false });
  canvasEl.addEventListener('touchstart', (e) => {
    if (lookId !== null) return;
    const t = e.changedTouches[0];
    lookId = t.identifier; lastLook = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!state.inMuseum || inputBlocked()) return;
    let used = false;
    for (const t of e.changedTouches) {
      if (t.identifier === jid) { handle(t); used = true; }
      else if (t.identifier === lookId && lastLook) {
        yaw -= (t.clientX - lastLook.x) * 0.005;
        pitch = clamp(pitch - (t.clientY - lastLook.y) * 0.005, -1.25, 1.25);
        lastLook = { x: t.clientX, y: t.clientY }; used = true;
      }
    }
    if (used) e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) { jid = null; joy.x = joy.y = 0; setKnob(0, 0); }
      if (t.identifier === lookId) { lookId = null; lastLook = null; }
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  $('#touchE').addEventListener('touchstart', (e) => { e.preventDefault(); interact(); }, { passive: false });
  $('#touchE').addEventListener('click', interact);
  const runBtn = $('#touchRun');
  runBtn.addEventListener('click', () => { touchRun = !touchRun; runBtn.setAttribute('aria-pressed', String(touchRun)); });
}

/* ====================================================================
 * Minimap (shows all characters, active highlighted)
 * ==================================================================== */
let mm, mctx, mmSize = 168, mmDpr = 1;
function setupMinimapSize() {
  mm = mm || $('#minimap');
  mctx = mctx || mm.getContext('2d');
  mmSize = mm.clientWidth || 168;
  mmDpr = Math.min(window.devicePixelRatio || 1, 2);
  mm.width = Math.round(mmSize * mmDpr);
  mm.height = Math.round(mmSize * mmDpr);
}
function drawMinimap() {
  if (!mctx || !museum || !museum.rooms.length) return;
  const active = museum.actors[state.activeCharIdx] || museum.actors[0];
  if (!active) return;
  const S = mmSize, sc = mmSize / 34;
  mctx.setTransform(mmDpr, 0, 0, mmDpr, 0, 0);
  mctx.clearRect(0, 0, S, S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#0f0f12'; mctx.fillRect(0, 0, S, S);
  mctx.translate(S / 2 - active.pos.x * sc, S / 2 - active.pos.z * sc);

  const lo = Math.max(0, museum.curRoom - 3), hi = Math.min(museum.roomCount - 1, museum.curRoom + 3);
  mctx.lineWidth = 1.5; mctx.strokeStyle = 'rgba(225,225,225,0.8)'; mctx.fillStyle = '#2a2a30';
  for (let i = lo; i <= hi; i++) {
    const r = museum.rooms[i], x = (r.cx - ROOM_W / 2) * sc, y = (-ROOM_D / 2) * sc;
    mctx.fillRect(x, y, ROOM_W * sc, ROOM_D * sc);
    mctx.strokeRect(x, y, ROOM_W * sc, ROOM_D * sc);
  }
  mctx.fillStyle = '#2a2a30';
  for (let i = Math.max(1, lo); i <= hi; i++) {
    mctx.fillRect((i * ROOM_W - ROOM_W / 2) * sc - 1.5, (-DOOR_W / 2) * sc, 3, DOOR_W * sc);
  }
  for (const e of museum.entries) {
    if (!e || e.roomIndex < lo || e.roomIndex > hi) continue;
    const north = e.z < 0;
    mctx.fillStyle = e === nearEntry ? '#ffffff' : '#e9b84e';
    const w = e.pw * sc;
    mctx.fillRect(e.x * sc - w / 2, e.z * sc + (north ? 1 : -4), w, 3);
  }

  // Companion dots
  museum.actors.forEach((a, i) => {
    if (i === state.activeCharIdx) return;
    mctx.beginPath();
    mctx.arc(a.pos.x * sc, a.pos.z * sc, 3.8, 0, Math.PI * 2);
    mctx.fillStyle = a.spec.shirt || '#88ccff';
    mctx.fill();
    mctx.lineWidth = 1; mctx.strokeStyle = '#fff'; mctx.stroke();
  });
  mctx.restore();

  // Active player marker + view cone
  mctx.save();
  mctx.translate(S / 2, S / 2);
  mctx.rotate(-yaw);
  mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, S * 0.28, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); mctx.closePath();
  mctx.fillStyle = 'rgba(255,214,120,0.25)'; mctx.fill();
  mctx.restore();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, 5, 0, Math.PI * 2);
  mctx.fillStyle = active.spec.shirt || '#ffd978'; mctx.fill();
  mctx.lineWidth = 2; mctx.strokeStyle = '#fff'; mctx.stroke();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2);
  mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(255,255,255,0.35)'; mctx.stroke();
}

/* ====================================================================
 * Screens / Flow
 * ==================================================================== */
let raf = 0, welcomed = false, lastT = 0;
function startLoop() {
  if (raf) return;
  lastT = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    update(dt);
    renderer.render(scene, camera);
    drawMinimap();
  };
  raf = requestAnimationFrame(tick);
}
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

async function generate() {
  if (!state.photos.length) return;
  stopPreview();
  showLoader('Building your personalized museum…');
  await nextPaint();
  if (!initRenderer()) {
    hideLoader();
    toast('Your browser couldn’t start WebGL, so the 3D museum can’t be shown here.', 7000);
    return;
  }
  state.inMuseum = true;
  $('#uploadScreen').hidden = true;
  $('#museumScreen').hidden = false;
  const rel = RELATIONSHIPS[state.relationship];
  const occ = OCCASIONS[state.occasion];
  $('#themeBadge').textContent = occ && occ.id !== 'none'
    ? `${rel.icon} ${rel.label} · ${occ.icon} ${occ.label}`
    : `${rel.icon} ${rel.label}`;
  onResize();

  const keep = state.hasGeneratedOnce && savedPositions !== null;
  museum.build(state, state.activeCharIdx, keep, savedPositions);
  state.hasGeneratedOnce = true;
  renderCharChips();
  await museum.preloadAround();

  if (welcomed) {
    audio.init();
    audio.setTheme(state.relationship, museum.theme.floor, state.occasion);
    audio.setPlaying(true);
    updateAudioUI();
  }
  startLoop();
  hideLoader();
  if (!welcomed) {
    welcomed = true; welcomeOpen = true;
    $('#welcome').hidden = false;
    $('#welcomeGo').focus();
  } else if (!isTouch) {
    toast('Click the scene to look around with the mouse');
  }
}

function backToSetup() {
  if (museum && museum.actors.length) {
    savedPositions = museum.actors.map((a) => a.pos.clone());
  }
  state.inMuseum = false;
  stopLoop();
  closeViewer();
  keys.clear(); joy.x = joy.y = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  if (museum) museum.dispose();
  $('#prompt').hidden = true;
  $('#museumScreen').hidden = true;
  $('#uploadScreen').hidden = false;
  audio.setPlaying(false);
  setStep(2);
}

async function addMoreFiles(files) {
  if (!files || !files.length) return;
  showLoader('Adding photos…');
  await nextPaint();
  const added = await addFiles(files);
  if (added && museum) {
    const pos = museum.actors.map((a) => a.pos.clone());
    renderGrid();
    museum.build(state, state.activeCharIdx, true, pos);
    renderCharChips();
    await museum.preloadAround();
    toast(`${added} photo${added > 1 ? 's' : ''} added`);
  }
  hideLoader();
}

/* ====================================================================
 * Wizard wiring
 * ==================================================================== */
(function initWizard() {
  const dz = $('#dropzone'), input = $('#fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', async () => { await addFiles(input.files); input.value = ''; });

  const stop = (e) => e.preventDefault();
  let depth = 0;
  window.addEventListener('dragenter', (e) => { stop(e); depth++; if (!state.inMuseum && state.step === 1) dz.classList.add('over'); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) dz.classList.remove('over'); });
  window.addEventListener('dragover', stop);
  window.addEventListener('drop', async (e) => {
    stop(e); depth = 0; dz.classList.remove('over');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    if (state.inMuseum) await addMoreFiles(files);
    else if (state.step === 1) await addFiles(files);
  });

  $('#clearAll').addEventListener('click', () => { state.photos.forEach(revokePhoto); state.photos = []; renderGrid(); });
  $('#styleOverride').addEventListener('change', (e) => { state.styleOverride = e.target.value; });
  $('#customOccasionInput').addEventListener('input', (e) => { state.customOccasionText = e.target.value.slice(0, 44); });
  $('#addMusicBtn').addEventListener('click', () => $('#musicInput').click());
  $('#musicInput').addEventListener('change', (e) => {
    const added = audio.addCustomTracks(e.target.files);
    e.target.value = '';
    if (added.length) {
      renderMusicList();
      toast(`Added ${added.length} music track${added.length > 1 ? 's' : ''}`);
    } else {
      toast('No supported audio files found (use MP3, WAV, OGG, M4A).');
    }
  });

  $('#charName').addEventListener('input', (e) => {
    const ch = state.characters[state.editingCharIdx];
    ch.name = e.target.value.slice(0, 20);
    $('#previewLabel').textContent = `${ch.name || 'Guest'} (${TYPE_META[ch.type].label})`;
    const activeTab = document.querySelectorAll('.char-tab')[state.editingCharIdx];
    if (activeTab) activeTab.lastChild.textContent = ch.name || `Guest ${state.editingCharIdx + 1}`;
  });
  $('#shirtColor').addEventListener('input', (e) => { state.characters[state.editingCharIdx].shirt = e.target.value; updatePreview(state.characters[state.editingCharIdx]); });
  $('#hairColor').addEventListener('input', (e) => { state.characters[state.editingCharIdx].hair = e.target.value; updatePreview(state.characters[state.editingCharIdx]); });
  $('#skinColor').addEventListener('input', (e) => { state.characters[state.editingCharIdx].skin = e.target.value; updatePreview(state.characters[state.editingCharIdx]); });

  document.querySelectorAll('.step-pill').forEach((btn) => {
    btn.addEventListener('click', () => setStep(Number(btn.dataset.step)));
  });
  $('#wizBack').addEventListener('click', () => setStep(state.step - 1));
  $('#wizNext').addEventListener('click', () => setStep(state.step + 1));
  $('#generateBtn').addEventListener('click', generate);
  updateCount();
  setStep(1);
})();

if (/[?&]debug\b/.test(location.search)) {
  window.__museum = {
    state,
    museum: () => museum,
    look: (y, p = 0) => { yaw = y; pitch = p; },
    switchCharacter,
    get nearEntry() { return nearEntry; },
    get firstPerson() { return firstPerson; }
  };
}
