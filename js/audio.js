'use strict';
/* صدا و موسیقی — همه صداها با Web Audio API ساخته می‌شوند (بدون فایل خارجی، کاملاً آفلاین) */
const Snd = (() => {
  let ctx = null, master = null, musicG = null, sfxG = null, noiseBuf = null;
  let musicTimer = null, musicStep = 0, musicTrack = null, musicNext = 0;
  let ambNodes = [];
  let vols = { music: 0.5, sfx: 0.8 };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicG = ctx.createGain(); musicG.connect(master);
    sfxG = ctx.createGain(); sfxG.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setVolumes(vols.music, vols.sfx);
  }

  function setVolumes(m, s) {
    vols.music = m; vols.sfx = s;
    if (!ctx) return;
    musicG.gain.value = m * 0.35;
    sfxG.gain.value = s;
  }

  function noise(dur, vol, freq, q, type, when, dest) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 2000; f.Q.value = q || 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxG);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, vol, type, when, slideTo, dest) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.05);
  }

  /* پروفایل صدای شلیک برای هر سلاح */
  const SHOT = {
    pistol: { n: 0.12, f: 3200, thump: 180, td: 0.09, v: 0.55 },
    ar1: { n: 0.14, f: 2600, thump: 120, td: 0.1, v: 0.6 },
    ar2: { n: 0.16, f: 2200, thump: 100, td: 0.12, v: 0.65 },
    smg: { n: 0.09, f: 3800, thump: 150, td: 0.07, v: 0.45 },
    lmg: { n: 0.2, f: 1800, thump: 80, td: 0.15, v: 0.75 },
    shotgun: { n: 0.3, f: 1500, thump: 70, td: 0.22, v: 0.9 },
    sniper: { n: 0.5, f: 1300, thump: 55, td: 0.35, v: 1.0 },
    pulse: { n: 0.0, f: 0, thump: 0, td: 0, v: 0.5, laser: true },
    enemy: { n: 0.1, f: 2400, thump: 130, td: 0.08, v: 0.4 },
  };

  function shot(kind, vol) {
    if (!ctx) return;
    const p = SHOT[kind] || SHOT.ar1;
    const v = (vol === undefined ? 1 : vol) * p.v;
    if (v < 0.01) return;
    if (p.laser) {
      tone(1400, 0.18, 0.25 * v, 'sawtooth', 0, 260);
      tone(700, 0.2, 0.2 * v, 'square', 0, 180);
      return;
    }
    noise(p.n, v, p.f, 0.8, 'lowpass');
    noise(p.n * 0.6, v * 0.5, 6000, 0.5, 'highpass');
    tone(p.thump, p.td, v * 0.9, 'sine', 0, 40);
  }

  function explosion(vol) {
    if (!ctx) return;
    const v = vol === undefined ? 1 : vol;
    noise(1.2, 1.0 * v, 700, 0.6, 'lowpass');
    noise(0.6, 0.6 * v, 3000, 0.6, 'bandpass');
    tone(90, 0.8, 0.9 * v, 'sine', 0, 28);
  }

  const api = {
    init, setVolumes, shot, explosion,
    step(v) { noise(0.06, 0.12 * (v || 1), 500, 1, 'lowpass'); },
    reload(phase) {
      if (phase === 0) { tone(900, 0.05, 0.25, 'square'); noise(0.05, 0.25, 4000, 1, 'highpass'); }
      else if (phase === 1) { tone(500, 0.06, 0.3, 'square'); noise(0.08, 0.3, 3000, 1, 'highpass'); }
      else { tone(1200, 0.04, 0.3, 'square', 0); tone(800, 0.08, 0.3, 'square', ctx ? ctx.currentTime + 0.05 : 0); }
    },
    empty() { tone(1500, 0.03, 0.2, 'square'); },
    hurt() { tone(160, 0.25, 0.5, 'sawtooth', 0, 70); noise(0.2, 0.3, 900, 1, 'lowpass'); },
    hit() { tone(1800, 0.05, 0.2, 'triangle'); },
    headshot() { tone(2400, 0.08, 0.3, 'triangle'); tone(1200, 0.12, 0.25, 'triangle', ctx ? ctx.currentTime + 0.04 : 0); },
    kill() { tone(900, 0.1, 0.2, 'triangle'); },
    pickup() { tone(660, 0.08, 0.3, 'sine'); tone(990, 0.12, 0.3, 'sine', ctx ? ctx.currentTime + 0.07 : 0); },
    ui() { tone(700, 0.05, 0.25, 'triangle'); },
    uiBack() { tone(420, 0.06, 0.25, 'triangle'); },
    grenadePin() { tone(1100, 0.04, 0.3, 'square'); },
    bounce() { noise(0.05, 0.25, 1500, 1, 'bandpass'); },
    radio() { noise(0.25, 0.18, 2500, 3, 'bandpass'); tone(1000, 0.1, 0.1, 'square'); },
    win() {
      if (!ctx) return; const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 0.35, 'triangle', t + i * 0.14));
    },
    lose() {
      if (!ctx) return; const t = ctx.currentTime;
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 0.35, 'sawtooth', t + i * 0.2));
    },
    alarm() { tone(880, 0.2, 0.3, 'square'); tone(660, 0.2, 0.3, 'square', ctx ? ctx.currentTime + 0.2 : 0); },
    vibrate(ms) { if (Store.d.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } },
  };

  /* ---------------- موسیقی رویه‌ای ---------------- */
  const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  const TRACKS = {
    menu: { bpm: 84, root: 45, bassPat: [0, -1, 0, -1, 3, -1, 0, -1], arp: [0, 2, 4, 2, 0, 2, 4, 6], drums: false },
    combat: { bpm: 126, root: 40, bassPat: [0, 0, 3, 0, 0, 0, 5, 3], arp: [0, 4, 2, 4, 0, 4, 3, 4], drums: true },
    tense: { bpm: 96, root: 38, bassPat: [0, -1, -1, 0, -1, 5, -1, -1], arp: [0, 2, 4, 6, 4, 2, 0, 2], drums: true },
  };

  function schedule() {
    if (!ctx || !musicTrack) return;
    const tr = TRACKS[musicTrack];
    const stepDur = 60 / tr.bpm / 2;
    while (musicNext < ctx.currentTime + 0.3) {
      const s = musicStep % 8;
      const bar = Math.floor(musicStep / 8) % 4;
      const shift = [0, 0, 3, 5][bar];
      const t = musicNext;
      const b = tr.bassPat[s];
      if (b >= 0) tone(mtof(tr.root + SCALE_MINOR[(b + shift) % 7] ), stepDur * 1.6, 0.5, 'sawtooth', t, null, musicG);
      const a = tr.arp[s];
      tone(mtof(tr.root + 24 + SCALE_MINOR[(a + shift) % 7]), stepDur * 0.9, 0.16, 'triangle', t, null, musicG);
      if (s === 0 && bar % 2 === 0) tone(mtof(tr.root + 12 + SCALE_MINOR[shift % 7]), stepDur * 7, 0.12, 'sine', t, null, musicG);
      if (tr.drums) {
        if (s % 4 === 0) { tone(120, 0.14, 0.7, 'sine', t, 40, musicG); }
        if (s % 4 === 2) noise(0.12, 0.35, 2500, 1, 'bandpass', t, musicG);
        noise(0.03, 0.08, 7000, 1, 'highpass', t, musicG);
      } else if (s % 4 === 0) {
        tone(100, 0.2, 0.35, 'sine', t, 45, musicG);
      }
      musicNext += stepDur; musicStep++;
    }
  }

  api.music = function (name) {
    if (!ctx) return;
    if (musicTrack === name) return;
    musicTrack = name;
    musicStep = 0; musicNext = ctx.currentTime + 0.1;
    if (musicTimer) clearInterval(musicTimer);
    if (name) musicTimer = setInterval(schedule, 120);
    else musicTimer = null;
  };

  api.stopAmbience = function () {
    ambNodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } });
    ambNodes = [];
  };

  /* صداهای محیطی: باد، باران، وزوز زیرزمین */
  api.ambience = function (kind) {
    api.stopAmbience();
    if (!ctx) return;
    function loopNoise(freq, q, type, vol) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(sfxG); src.start();
      ambNodes.push(src);
      return { f, g };
    }
    if (kind === 'wind' || kind === 'snow') {
      const n = loopNoise(420, 1.4, 'bandpass', 0.08);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
      const lg = ctx.createGain(); lg.gain.value = 200;
      lfo.connect(lg); lg.connect(n.f.frequency); lfo.start(); ambNodes.push(lfo);
    } else if (kind === 'rain') {
      loopNoise(5000, 0.5, 'highpass', 0.06);
      loopNoise(300, 0.7, 'lowpass', 0.05);
    } else if (kind === 'hum') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const g = ctx.createGain(); g.gain.value = 0.04;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
      o.connect(f); f.connect(g); g.connect(sfxG); o.start(); ambNodes.push(o);
    } else if (kind === 'sea') {
      const n = loopNoise(600, 0.6, 'lowpass', 0.07);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
      const lg = ctx.createGain(); lg.gain.value = 300;
      lfo.connect(lg); lg.connect(n.f.frequency); lfo.start(); ambNodes.push(lfo);
    }
  };

  return api;
})();
