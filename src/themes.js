import * as THREE from 'three';

export const OCCASIONS = {
  none:        { id: 'none',        label: 'Just Exploring', icon: '🏛️', title: '',                      sub: '' },
  birthday:    { id: 'birthday',    label: 'Happy Birthday', icon: '🎂', title: 'Happy Birthday!',       sub: 'Wishing you the happiest year ahead' },
  anniversary: { id: 'anniversary', label: 'Anniversary',    icon: '💍', title: 'Happy Anniversary!',    sub: 'Celebrating our special milestone together' },
  wedding:     { id: 'wedding',     label: 'Wedding',        icon: '🥂', title: 'Forever & Always',      sub: 'A celebration of love and new beginnings' },
  graduation:  { id: 'graduation',  label: 'Congratulations',icon: '🎓', title: 'Congratulations!',      sub: 'Cheers to an unforgettable achievement' },
  custom:      { id: 'custom',      label: 'Custom Event',   icon: '✨', title: 'Special Celebration',   sub: 'Made just for us' }
};

export const ROYAL_FEMALE_DEFAULT = {
  type: 'female', outfit: 'royal', name: 'Ice Queen',
  shirt: '#5ea4e6', hair: '#e6cf8b', skin: '#f5cba7',
  accent: '#d8efff', cape: '#7ec0f5', boots: '#4888c8'
};

export const ROYAL_MALE_DEFAULT = {
  type: 'male', outfit: 'royal', name: 'Ice Prince',
  shirt: '#4f90d4', hair: '#5a3b28', skin: '#e8b890',
  accent: '#e8f4ff', cape: '#3a75b8', boots: '#1c3f6e'
};

export const RELATIONSHIPS = {
  lovers: {
    id: 'lovers',
    label: 'Lovers',
    icon: '♥',
    galleryName: 'Romance Gallery',
    welcomeTitle: 'Our Love Story',
    musicLabel: 'Slow piano & warm strings',
    desc: 'Rose & gold palette, heart frames, candlelit glow, floating petals & rose-vase benches.',
    swatches: ['#4b1626', '#f2b8c6', '#d8a84e'],
    minChars: 2,
    maxChars: 2,
    types: ['male', 'female'],
    defaultChars: [
      { ...ROYAL_FEMALE_DEFAULT },
      { ...ROYAL_MALE_DEFAULT }
    ]
  },
  friends: {
    id: 'friends',
    label: 'Friends',
    icon: '★',
    galleryName: 'Fun Hangout',
    welcomeTitle: 'Our Squad Memories',
    musicLabel: 'Upbeat lo-fi & playful pop',
    desc: 'Bright pastel & neon accents, Polaroid frames, balloons, confetti, bean bags & arcade props.',
    swatches: ['#eef3ff', '#ff5ea8', '#38d9c0'],
    minChars: 1,
    maxChars: 6,
    types: ['male', 'female'],
    defaultChars: [
      { ...ROYAL_FEMALE_DEFAULT, name: 'Maya' },
      { ...ROYAL_MALE_DEFAULT, name: 'Liam' },
      { type: 'male', outfit: 'casual', name: 'Sam', shirt: '#38d9c0', hair: '#18181c', skin: '#8d5524' }
    ]
  },
  family: {
    id: 'family',
    label: 'Family',
    icon: '⌂',
    galleryName: 'Family Home',
    welcomeTitle: 'The Family Album',
    musicLabel: 'Warm acoustic guitar & piano',
    desc: 'Cozy wood & cream living room, family-tree wall, sofa, rugs, plants & fireplace.',
    swatches: ['#f2e6d3', '#7a4b26', '#6b8e5a'],
    minChars: 1,
    maxChars: 6,
    types: ['male', 'female', 'boy', 'girl', 'elder'],
    defaultChars: [
      { ...ROYAL_FEMALE_DEFAULT, name: 'Mom' },
      { ...ROYAL_MALE_DEFAULT, name: 'Dad' },
      { type: 'girl', outfit: 'casual', name: 'Lily', shirt: '#e6a8d7', hair: '#4a2c18', skin: '#f4c798' },
      { type: 'elder', outfit: 'casual', name: 'Grandpa', shirt: '#6f7c60', hair: '#d8d8dc', skin: '#ebc095' }
    ]
  }
};

export const THEMES = {
  lovers: {
    id: 'lovers', name: 'Romance Gallery',
    wall: '#3c1622', trim: '#d6a44e', ceiling: '#220a12', floor: 'marble_rose',
    frame: '#d4a348', frameMetal: 0.78, frameRough: 0.28, mat: '#f8ebee',
    bg: '#15060b', light: '#ffd5a8', hemiSky: '#ffd9df', hemiGround: '#4a1b28', hemiI: 0.82,
    lightI: 18, glow: 0.42, plaque: '#fff3f5', plaqueText: '#4a1625', bench: '#781d38', accent: '#ff6b93'
  },
  friends: {
    id: 'friends', name: 'Fun Hangout',
    wall: '#eef2fb', trim: '#ff5ea8', ceiling: '#f8faff', floor: 'terrazzo',
    frame: '#ffffff', frameMetal: 0.05, frameRough: 0.55, mat: '#ffffff',
    bg: '#1c1833', light: '#fff8ee', hemiSky: '#ffffff', hemiGround: '#b0b8d4', hemiI: 1.05,
    lightI: 15, glow: 0.22, plaque: '#ffffff', plaqueText: '#1f2340', bench: '#38d9c0', accent: '#ff5ea8'
  },
  family: {
    id: 'family', name: 'Family Home',
    wall: '#f2e6d3', trim: '#6e4726', ceiling: '#faf4ea', floor: 'wood',
    frame: '#6b4222', frameMetal: 0.12, frameRough: 0.52, mat: '#fbf6ec',
    bg: '#1c140e', light: '#ffe4bd', hemiSky: '#fff3df', hemiGround: '#7a5d43', hemiI: 0.96,
    lightI: 16, glow: 0.28, plaque: '#faf2e4', plaqueText: '#382210', bench: '#855840', accent: '#6b8e5a'
  },
  classic: {
    id: 'classic', name: 'Classic',
    wall: '#e9dfcb', trim: '#5a3d22', ceiling: '#f3ede0', floor: 'wood',
    frame: '#b88a2e', frameMetal: 0.7, frameRough: 0.35, mat: '#f5f0e4',
    bg: '#17120d', light: '#ffe9c2', hemiSky: '#fff4e0', hemiGround: '#6b5a46', hemiI: 0.9,
    lightI: 16, glow: 0.3, plaque: '#f3ead4', plaqueText: '#2b1d10', bench: '#6b2f2a', accent: '#d4a84b'
  },
  modern: {
    id: 'modern', name: 'Modern',
    wall: '#f2f2f0', trim: '#c9c9c4', ceiling: '#ffffff', floor: 'concrete',
    frame: '#111111', frameMetal: 0.1, frameRough: 0.6, mat: '#ffffff',
    bg: '#cfd3d8', light: '#ffffff', hemiSky: '#ffffff', hemiGround: '#9a9a9a', hemiI: 1.0,
    lightI: 14, glow: 0.16, plaque: '#ffffff', plaqueText: '#111111', bench: '#222222', accent: '#666666'
  },
  dark: {
    id: 'dark', name: 'Dark',
    wall: '#2a2e38', trim: '#0e1014', ceiling: '#15171c', floor: 'dark',
    frame: '#c9a24b', frameMetal: 0.8, frameRough: 0.35, mat: '#14161b',
    bg: '#07080a', light: '#ffe2a8', hemiSky: '#aab4d0', hemiGround: '#20222a', hemiI: 0.55,
    lightI: 20, glow: 0.5, plaque: '#101216', plaqueText: '#e8d9b0', bench: '#3a3f4c', accent: '#c9a24b'
  }
};

export function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeFloorTexture(kind) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (kind === 'wood') {
    const rows = 8, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = 0, first = true;
      while (x < S) {
        let len = first ? 60 + Math.random() * 180 : 190 + Math.random() * 230;
        first = false;
        if (x + len > S - 40) len = S - x;
        g.fillStyle = `hsl(${24 + Math.random() * 8},${42 + Math.random() * 10}%,${30 + Math.random() * 9}%)`;
        g.fillRect(x, r * rh, len, rh);
        g.strokeStyle = 'rgba(40,20,8,0.2)'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const gy = r * rh + 3 + Math.random() * (rh - 6);
          g.beginPath(); g.moveTo(x, gy);
          g.bezierCurveTo(x + len * 0.3, gy + (Math.random() - 0.5) * 3, x + len * 0.6, gy + (Math.random() - 0.5) * 3, x + len, gy);
          g.stroke();
        }
        g.fillStyle = 'rgba(20,10,4,0.55)'; g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(20,10,4,0.55)'; g.fillRect(0, r * rh, S, 2);
    }
  } else if (kind === 'marble_rose') {
    g.fillStyle = '#361a24'; g.fillRect(0, 0, S, S);
    const t = S / 2;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#45202d' : '#351722';
      g.fillRect(x * t, y * t, t, t);
    }
    g.strokeStyle = 'rgba(255, 210, 220, 0.12)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      g.beginPath(); g.moveTo(Math.random() * S, 0);
      g.bezierCurveTo(Math.random() * S, S * 0.3, Math.random() * S, S * 0.7, Math.random() * S, S);
      g.stroke();
    }
    g.strokeStyle = 'rgba(216, 168, 78, 0.35)'; g.lineWidth = 3;
    g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  } else if (kind === 'terrazzo') {
    g.fillStyle = '#dfe5f2'; g.fillRect(0, 0, S, S);
    const chips = ['#ff5ea8', '#38d9c0', '#ffbe3d', '#6c7bff', '#ffffff'];
    for (let i = 0; i < 650; i++) {
      g.fillStyle = chips[i % chips.length];
      g.globalAlpha = 0.45 + Math.random() * 0.35;
      g.beginPath();
      g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 7, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(130,145,180,0.35)'; g.lineWidth = 2;
    g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  } else if (kind === 'concrete') {
    g.fillStyle = '#d8d6d1'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) {
      const v = 185 + Math.floor(Math.random() * 55);
      g.fillStyle = `rgba(${v},${v},${v - 4},0.1)`;
      g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    g.strokeStyle = 'rgba(120,120,125,0.14)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.moveTo(Math.random() * S, 0);
      g.bezierCurveTo(Math.random() * S, S * 0.3, Math.random() * S, S * 0.7, Math.random() * S, S);
      g.stroke();
    }
    g.strokeStyle = 'rgba(90,90,95,0.55)'; g.lineWidth = 3;
    g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  } else {
    const t = S / 2;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#1d2028' : '#14161c';
      g.fillRect(x * t, y * t, t, t);
    }
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 2 + Math.random() * 5);
    }
    g.strokeStyle = '#0a0b0e'; g.lineWidth = 4;
    g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  }
  return canvasTex(c, true);
}

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 6, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function makePlaceholderTexture() {
  const t = new THREE.DataTexture(new Uint8Array([205, 205, 205, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function makePlaqueTexture(title, num, T, relId) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 150;
  const g = c.getContext('2d');
  g.fillStyle = T.plaque; g.fillRect(0, 0, 640, 150);
  g.strokeStyle = relId === 'friends' ? T.accent : T.plaqueText;
  g.globalAlpha = relId === 'friends' ? 0.85 : 0.35;
  g.lineWidth = 4; g.strokeRect(6, 6, 628, 138); g.globalAlpha = 1;

  const fontFam = relId === 'friends' ? SANS : SERIF;
  const isLovers = relId === 'lovers';
  g.fillStyle = T.plaqueText; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 50, text = isLovers ? `♥ ${title}` : title;
  g.font = `${isLovers ? 'italic ' : ''}bold ${size}px ${fontFam}`;
  while (g.measureText(text).width > 570 && size > 24) {
    size -= 2;
    g.font = `${isLovers ? 'italic ' : ''}bold ${size}px ${fontFam}`;
  }
  while (g.measureText(text).width > 570 && text.length > 3) {
    text = text.slice(0, -2);
    g.font = `${isLovers ? 'italic ' : ''}bold ${size}px ${fontFam}`;
  }
  if (text !== (isLovers ? `♥ ${title}` : title)) text = text.trimEnd() + '…';
  g.fillText(text, 320, 64);

  g.globalAlpha = 0.65;
  g.font = `${relId === 'friends' ? '600' : 'italic'} 25px ${fontFam}`;
  const sub = isLovers ? `Memory ♥ ${num}` : relId === 'friends' ? `Snap #${num}` : `Album No. ${num}`;
  g.fillText(sub, 320, 116);
  g.globalAlpha = 1;

  const t = canvasTex(c, false);
  t.anisotropy = 4;
  return t;
}

export function makeSignTexture(line1, line2, T, relId) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = T.plaque; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = relId === 'friends' ? T.accent : T.plaqueText;
  g.globalAlpha = 0.45; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 236); g.globalAlpha = 1;
  const fontFam = relId === 'friends' ? SANS : SERIF;
  g.fillStyle = T.plaqueText; g.textAlign = 'center'; g.textBaseline = 'middle';
  let sz = 76;
  g.font = `bold ${sz}px ${fontFam}`;
  while (g.measureText(line1).width > 940 && sz > 36) { sz -= 4; g.font = `bold ${sz}px ${fontFam}`; }
  g.fillText(line1, 512, 106);
  g.globalAlpha = 0.68; g.font = `italic 36px ${fontFam}`; g.fillText(line2, 512, 190); g.globalAlpha = 1;
  const t = canvasTex(c, false);
  t.anisotropy = 4;
  return t;
}

export function makeFamilyTreeTexture(chars, T) {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 560;
  const g = c.getContext('2d');
  g.fillStyle = T.plaque; g.fillRect(0, 0, 800, 560);
  g.strokeStyle = T.trim; g.lineWidth = 10; g.strokeRect(12, 12, 776, 536);

  g.fillStyle = '#6e4726';
  g.fillRect(384, 300, 32, 190);
  g.beginPath(); g.moveTo(400, 320); g.lineTo(290, 230); g.lineWidth = 14; g.strokeStyle = '#6e4726'; g.stroke();
  g.beginPath(); g.moveTo(400, 320); g.lineTo(510, 230); g.stroke();

  const greens = ['#5b824d', '#6d985c', '#4b703e'];
  [[400, 185, 130], [280, 215, 88], [520, 215, 88]].forEach(([x, y, r], i) => {
    g.fillStyle = greens[i % greens.length];
    g.globalAlpha = 0.28;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  });
  g.globalAlpha = 1;

  g.fillStyle = T.plaqueText; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 44px ${SERIF}`;
  g.fillText('Our Family Tree', 400, 64);

  const count = chars.length;
  chars.forEach((ch, i) => {
    const angle = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * 1.9;
    const bx = 400 + Math.sin(angle) * 230;
    const by = 185 + Math.cos(angle) * 45 + (i % 2 ? 42 : -18);
    g.fillStyle = '#fffaf0';
    g.strokeStyle = ch.shirt || '#6b8e5a';
    g.lineWidth = 4;
    g.beginPath(); g.roundRect(bx - 82, by - 26, 164, 52, 14); g.fill(); g.stroke();
    g.fillStyle = T.plaqueText;
    g.font = `bold 24px ${SERIF}`;
    g.fillText((ch.name || 'Guest').slice(0, 12), bx, by);
  });

  const t = canvasTex(c, false);
  t.anisotropy = 4;
  return t;
}
