/* Procedural Web Audio engine + user-uploaded custom music tracks + floor-aware footsteps. */

const TRACKS = {
  lovers: [
    { name: 'Moonlight Waltz', bpm: 68, chords: [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0]], style: 'piano_strings' },
    { name: 'Rosewood Nocturne', bpm: 62, chords: [[293.66, 349.23, 440.0, 523.25], [196.0, 246.94, 293.66, 349.23], [261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 440.0]], style: 'piano_strings' }
  ],
  friends: [
    { name: 'Sunny Polaroid', bpm: 108, chords: [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]], style: 'lofi_pop' },
    { name: 'Arcade Afternoon', bpm: 116, chords: [[293.66, 369.99, 440.0], [220.0, 277.18, 329.63], [246.94, 293.66, 369.99], [196.0, 246.94, 293.66]], style: 'lofi_pop' }
  ],
  family: [
    { name: 'Sunday Morning', bpm: 84, chords: [[196.0, 246.94, 293.66, 392.0], [261.63, 329.63, 392.0, 493.88], [146.83, 220.0, 293.66, 369.99], [196.0, 246.94, 293.66, 392.0]], style: 'acoustic_warm' },
    { name: 'Hearthside', bpm: 76, chords: [[261.63, 329.63, 392.0], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]], style: 'acoustic_warm' }
  ]
};

// Gentle music-box Happy Birthday melody (in C major)
const BIRTHDAY_MELODY = [
  261.63, 261.63, 293.66, 261.63, 349.23, 329.63, 0,
  261.63, 261.63, 293.66, 261.63, 392.00, 349.23, 0,
  261.63, 261.63, 523.25, 440.00, 349.23, 329.63, 293.66, 0,
  466.16, 466.16, 440.00, 349.23, 392.00, 349.23, 0, 0
];

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.musicBus = null;
    this.verb = null;
    this.noise = null;
    this.enabled = true;
    this.volume = 0.7;
    this.themeId = 'lovers';
    this.occasion = 'none';
    this.trackIdx = 0;
    this.step = 0;
    this.timer = 0;
    this.playing = false;
    this.floorKind = 'wood';
    this.blocked = false;

    this.customTracks = [];
    this.customIdx = 0;
    this.audioEl = null;
    this._nextCustomId = 1;
  }

  init() {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.addEventListener('ended', () => {
        if (this.customTracks.length > 1) {
          this.customIdx = (this.customIdx + 1) % this.customTracks.length;
          this._playCustomCurrent();
        } else if (this.customTracks.length === 1) {
          this.audioEl.currentTime = 0;
          this.audioEl.play().catch(() => {});
        }
      });
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.enabled) {
        this.ctx.resume().catch(() => { this.blocked = true; });
      }
      return !this.blocked;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.blocked = true; return false; }
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this._makeImpulse(2.6, 2.5);
      const wet = ctx.createGain();
      wet.gain.value = 0.38;
      this.verb.connect(wet);
      wet.connect(this.master);

      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.45;
      this.sfx.connect(this.master);

      const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = nb;
      this._newBus();
      return true;
    } catch (e) {
      this.blocked = true;
      return false;
    }
  }

  addCustomTracks(fileList) {
    const added = [];
    for (const f of Array.from(fileList || [])) {
      if (!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.name || '')) continue;
      const track = {
        id: this._nextCustomId++,
        name: f.name.replace(/\.[^.]+$/, ''),
        url: URL.createObjectURL(f)
      };
      this.customTracks.push(track);
      added.push(track);
    }
    if (added.length && this.playing) {
      this.customIdx = this.customTracks.length - added.length;
      this._playCustomCurrent();
    }
    return added;
  }

  removeCustomTrack(id) {
    const idx = this.customTracks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    URL.revokeObjectURL(this.customTracks[idx].url);
    this.customTracks.splice(idx, 1);
    if (this.customIdx >= this.customTracks.length) this.customIdx = 0;
    if (this.playing) {
      if (this.customTracks.length) this._playCustomCurrent();
      else { this._stopCustom(); this.applyGain(); if (!this.timer && this.ctx) this._tick(); }
    }
  }

  _playCustomCurrent() {
    if (!this.audioEl || !this.customTracks.length) return;
    const tr = this.customTracks[this.customIdx % this.customTracks.length];
    if (this.audioEl.src !== tr.url) this.audioEl.src = tr.url;
    this.audioEl.volume = this.enabled ? this.volume : 0;
    if (this.playing && this.enabled) {
      this.audioEl.play().catch(() => {});
    }
  }

  _stopCustom() {
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  _makeImpulse(secs, decay) {
    const len = Math.floor(this.ctx.sampleRate * secs);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _newBus() {
    if (!this.ctx) return;
    const oldBus = this.musicBus;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.001, this.ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.32, this.ctx.currentTime + 0.8);
    bus.connect(this.master);
    bus.connect(this.verb);
    this.musicBus = bus;
    if (oldBus) {
      oldBus.gain.cancelScheduledValues(this.ctx.currentTime);
      oldBus.gain.setValueAtTime(oldBus.gain.value, this.ctx.currentTime);
      oldBus.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.75);
      setTimeout(() => { try { oldBus.disconnect(); } catch (e) {} }, 850);
    }
  }

  setTheme(relId, floorKind, occasion = 'none') {
    const next = TRACKS[relId] ? relId : 'family';
    if (floorKind) this.floorKind = floorKind;
    this.occasion = occasion || 'none';
    if (next !== this.themeId) {
      this.themeId = next;
      this.trackIdx = 0;
      this.step = 0;
      if (this.ctx) this._newBus();
    }
  }

  nextTrack() {
    if (this.customTracks.length) {
      this.customIdx = (this.customIdx + 1) % this.customTracks.length;
      this._playCustomCurrent();
      return this.customTracks[this.customIdx].name;
    }
    const list = TRACKS[this.themeId] || TRACKS.family;
    this.trackIdx = (this.trackIdx + 1) % list.length;
    this.step = 0;
    if (this.ctx) this._newBus();
    return list[this.trackIdx].name;
  }

  currentTrackName() {
    if (this.customTracks.length) return this.customTracks[this.customIdx % this.customTracks.length].name;
    if (this.occasion === 'birthday' && this.trackIdx === 0) return 'Birthday Music Box';
    const list = TRACKS[this.themeId] || TRACKS.family;
    return list[this.trackIdx % list.length].name;
  }

  setPlaying(active) {
    this.playing = active;
    if (active) {
      if (this.customTracks.length) this._playCustomCurrent();
      if (!this.timer && this.ctx) this._tick();
    } else {
      this._stopCustom();
    }
    this.applyGain();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  applyGain() {
    if (this.audioEl) {
      this.audioEl.volume = this.enabled && this.playing ? this.volume : 0;
      if (!this.enabled || !this.playing) this.audioEl.pause();
      else if (this.customTracks.length) this.audioEl.play().catch(() => {});
    }
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended' && this.enabled && this.playing) {
      this.ctx.resume().catch(() => {});
    }
    const target = this.enabled && this.playing ? this.volume : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.14);
  }

  _tick() {
    clearTimeout(this.timer);
    if (!this.ctx || !this.playing) { this.timer = 0; return; }

    // If user uploaded custom music, keep synth music silent while footsteps still work
    if (this.customTracks.length) {
      this.timer = setTimeout(() => this._tick(), 500);
      return;
    }

    const list = TRACKS[this.themeId] || TRACKS.family;
    const track = list[this.trackIdx % list.length];
    const eighthMs = (60 / track.bpm / 2) * 1000;

    if (this.enabled && this.ctx.state === 'running' && this.musicBus) {
      if (this.occasion === 'birthday' && this.trackIdx === 0) {
        const note = BIRTHDAY_MELODY[this.step % BIRTHDAY_MELODY.length];
        if (note > 0) this._tone(note, 0.85, 'sine', 0.16, 0.015, 2200);
        if (this.step % 4 === 0) {
          const bass = track.chords[Math.floor(this.step / 8) % track.chords.length][0];
          this._tone(bass * 0.5, 1.4, 'triangle', 0.09, 0.04, 700);
        }
      } else {
        const chord = track.chords[Math.floor(this.step / 8) % track.chords.length];
        const beat = this.step % 8;
        if (track.style === 'piano_strings') this._playLovers(chord, beat);
        else if (track.style === 'lofi_pop') this._playFriends(chord, beat);
        else this._playFamily(chord, beat);
      }
      this.step++;
    }
    this.timer = setTimeout(() => this._tick(), eighthMs);
  }

  _tone(freq, dur, type, gainPeak, attack = 0.02, cutoff = 1800) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _drum(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(125, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + 0.18);
    } else if (this.noise) {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'hat' ? 5200 : 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(kind === 'hat' ? 0.07 : 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'hat' ? 0.05 : 0.11));
      s.connect(f); f.connect(g); g.connect(this.musicBus);
      s.start(t);
    }
  }

  _playLovers(chord, beat) {
    if (beat === 0) chord.slice(0, 3).forEach((f) => this._tone(f * 0.5, 3.2, 'triangle', 0.08, 0.45, 900));
    const arp = [0, 1, 2, 3, 2, 1, 2, 3][beat];
    if (beat % 2 === 0 || beat === 5) this._tone(chord[arp % chord.length], 1.7, 'sine', 0.14, 0.03, 1400);
  }

  _playFriends(chord, beat) {
    if (beat === 0 || beat === 4) this._drum('kick');
    if (beat === 2 || beat === 6) this._drum('snare');
    if (beat % 2 === 1) this._drum('hat');
    if (beat === 0 || beat === 3) this._tone(chord[0] * 0.5, 0.45, 'triangle', 0.16, 0.01, 700);
    if (beat === 0 || beat === 2 || beat === 5) chord.forEach((f) => this._tone(f, 0.4, 'triangle', 0.07, 0.015, 2200));
  }

  _playFamily(chord, beat) {
    if (beat === 0) this._tone(chord[0] * 0.5, 2.2, 'sine', 0.13, 0.04, 800);
    const idx = [0, 2, 1, 2, 3 % chord.length, 2, 1, 0][beat];
    this._tone(chord[idx], 1.1, 'triangle', 0.11, 0.012, 1500);
  }

  footstep(running) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || ctx.state !== 'running' || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.82 + Math.random() * 0.36;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = this.floorKind === 'wood' ? 560 : this.floorKind === 'marble_rose' ? 1150 : 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(running ? 0.36 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t);
  }
}

export const audio = new MusicEngine();
