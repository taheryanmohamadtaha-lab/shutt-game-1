'use strict';
/* کنترل: جوی‌استیک و دکمه‌های لمسی (قابل شخصی‌سازی) + صفحه‌کلید/ماوس برای رایانه */
const Ctl = {
  mv: { x: 0, y: 0 }, lx: 0, ly: 0, fire: false, sprint: false, adsHold: false, adsHoldReleased: false,
  ev: {}, enabled: false, editing: false,
  take(n) { const v = this.ev[n]; this.ev[n] = false; return !!v; },
  push(n) { this.ev[n] = true; },
  takeLook() { const r = { x: this.lx, y: this.ly }; this.lx = 0; this.ly = 0; return r; },
  reset() { this.mv.x = this.mv.y = 0; this.fire = false; this.sprint = false; this.ev = {}; this.lx = this.ly = 0; this.adsHold = false; },
};

/* چیدمان پیش‌فرض: مرکز دکمه به درصد صفحه و اندازه به پیکسل */
const BTN_DEFAULT = {
  fire: { x: 88, y: 66, s: 104 },
  ads: { x: 75, y: 77, s: 66 },
  jump: { x: 94, y: 38, s: 60 },
  crouch: { x: 83, y: 41, s: 56 },
  reload: { x: 72, y: 52, s: 56 },
  grenade: { x: 62, y: 80, s: 56 },
  swap: { x: 62, y: 62, s: 50 },
  sprint: { x: 33, y: 80, s: 56 },
  nv: { x: 50, y: 22, s: 46 },
  pause: { x: 96, y: 8, s: 42 },
  home: { x: 4, y: 8, s: 42 },
};

const Controls = (() => {
  let root, joyEl, knobEl, joyHint;
  const ptrs = new Map();
  let joyId = null, joyBase = null;
  const JR = 62;

  function layout() { return Store.d.settings.layout || (Store.d.settings.layout = {}); }

  function applyLayout() {
    const sc = Store.d.settings.btnScale || 1, lay = layout();
    root.querySelectorAll('[data-b]').forEach((el) => {
      const id = el.dataset.b, df = BTN_DEFAULT[id]; if (!df) return;
      const p = lay[id] || df;
      const s = df.s * sc;
      el.style.left = p.x + '%'; el.style.top = p.y + '%';
      el.style.width = s + 'px'; el.style.height = s + 'px';
      el.style.fontSize = Math.round(s * 0.34) + 'px';
    });
    if (joyHint) { const jl = lay.joy || { x: 15, y: 70 }; joyHint.style.left = jl.x + '%'; joyHint.style.top = jl.y + '%'; }
  }

  function setJoy(px, py) {
    const dx = px - joyBase.x, dy = py - joyBase.y, d = Math.hypot(dx, dy);
    const k = d > JR ? JR / d : 1;
    knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const m = Math.min(1, d / JR);
    const dead = 0.12;
    const mm = m < dead ? 0 : (m - dead) / (1 - dead);
    Ctl.mv.x = d > 0 ? dx / d * mm : 0; Ctl.mv.y = d > 0 ? -dy / d * mm : 0;
    if (Ctl.mv.y > 0.95 && m > 0.98 && !Ctl.sprint && Store.d.settings.autoSprint) Ctl.sprint = true;
    updateSprintBtn();
  }
  function endJoy() {
    joyId = null; Ctl.mv.x = Ctl.mv.y = 0;
    joyEl.classList.remove('on'); knobEl.style.transform = 'translate(0,0)';
    if (joyHint) joyHint.style.display = '';
  }
  function updateSprintBtn() { const b = root.querySelector('[data-b="sprint"]'); if (b) b.classList.toggle('active', !!Ctl.sprint); }
  function updateAdsBtn() { const b = root.querySelector('[data-b="ads"]'); if (b) b.classList.toggle('active', P.adsOn); }

  function btnDown(id, e, el) {
    el.classList.add('down');
    switch (id) {
      case 'fire': Ctl.fire = true; break;
      case 'sprint': Ctl.sprint = !Ctl.sprint; updateSprintBtn(); break;
      case 'ads': Ctl.push('ads'); setTimeout(updateAdsBtn, 30); break;
      case 'pause': case 'home': Ctl.push('pause'); break;
      default: Ctl.push(id);
    }
  }
  function btnUp(id, el) {
    el.classList.remove('down');
    if (id === 'fire') Ctl.fire = false;
  }

  function init() {
    root = document.getElementById('touch');
    joyEl = document.getElementById('joy'); knobEl = document.getElementById('joyKnob'); joyHint = document.getElementById('joyHint');
    applyLayout();

    root.addEventListener('pointerdown', (e) => {
      if (!Ctl.enabled && !Ctl.editing) return;
      const btn = e.target.closest('[data-b]');
      if (Ctl.editing) {
        if (btn) { ptrs.set(e.pointerId, { type: 'drag', el: btn }); root.setPointerCapture(e.pointerId); }
        else if (e.clientX < window.innerWidth * 0.45) { ptrs.set(e.pointerId, { type: 'dragjoy' }); root.setPointerCapture(e.pointerId); }
        e.preventDefault(); return;
      }
      e.preventDefault();
      try { root.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (btn) {
        const id = btn.dataset.b;
        const rec = { type: 'btn', id, el: btn, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY };
        ptrs.set(e.pointerId, rec); btnDown(id, e, btn); return;
      }
      if (e.clientX < window.innerWidth * 0.46 && joyId === null) {
        joyId = e.pointerId; joyBase = { x: e.clientX, y: e.clientY };
        joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on');
        if (joyHint) joyHint.style.display = 'none';
        ptrs.set(e.pointerId, { type: 'joy' }); setJoy(e.clientX, e.clientY); return;
      }
      ptrs.set(e.pointerId, { type: 'look', lx: e.clientX, ly: e.clientY });
    });
    Ctl.lookFingerDown = () => { for (const r of ptrs.values()) if (r.type === 'look' || (r.type === 'btn' && r.id === 'fire')) return true; return false; };
    root.addEventListener('pointermove', (e) => {
      const r = ptrs.get(e.pointerId); if (!r) return;
      if (r.type === 'drag') {
        const p = { x: Math.max(3, Math.min(97, e.clientX / window.innerWidth * 100)), y: Math.max(5, Math.min(95, e.clientY / window.innerHeight * 100)) };
        layout()[r.el.dataset.b] = p; applyLayout(); return;
      }
      if (r.type === 'dragjoy') {
        layout().joy = { x: Math.max(5, Math.min(45, e.clientX / window.innerWidth * 100)), y: Math.max(20, Math.min(90, e.clientY / window.innerHeight * 100)) };
        applyLayout(); return;
      }
      if (r.type === 'joy') { setJoy(e.clientX, e.clientY); return; }
      if (r.type === 'btn' && r.id !== 'fire' && r.id !== 'pause' && r.id !== 'home' && !r.conv) {
        /* کشیدن انگشت از روی هر دکمه‌ای (غیر از شلیک) = چرخش دوربین؛ دکمه فشرده‌نشده حساب می‌شود */
        if (Math.hypot(e.clientX - r.sx, e.clientY - r.sy) > 16) { r.conv = true; r.el.classList.remove('down'); r.lx = e.clientX; r.ly = e.clientY; }
      }
      if (r.type === 'look' || (r.type === 'btn' && (r.id === 'fire' || r.conv))) {
        Ctl.lx += e.clientX - r.lx; Ctl.ly += e.clientY - r.ly; r.lx = e.clientX; r.ly = e.clientY;
      }
    });
    const up = (e) => {
      const r = ptrs.get(e.pointerId); if (!r) return;
      ptrs.delete(e.pointerId);
      if (r.type === 'joy') endJoy();
      else if (r.type === 'btn') btnUp(r.id, r.el);
      else if (r.type === 'drag' || r.type === 'dragjoy') Store.save();
    };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- صفحه‌کلید و ماوس ---- */
    const canvas = document.getElementById('gl');
    const keys = {};
    window.addEventListener('keydown', (e) => {
      if (!Ctl.enabled || e.repeat && e.code !== 'KeyW') { if (!Ctl.enabled) return; }
      keys[e.code] = true;
      switch (e.code) {
        case 'Space': Ctl.push('jump'); e.preventDefault(); break;
        case 'KeyC': case 'ControlLeft': Ctl.push('crouch'); break;
        case 'KeyR': Ctl.push('reload'); break;
        case 'KeyQ': case 'Digit1': case 'Digit2': Ctl.push('swap'); break;
        case 'KeyG': Ctl.push('grenade'); break;
        case 'KeyN': Ctl.push('nv'); break;
        case 'Escape': case 'KeyP': Ctl.push('pause'); break;
        case 'ShiftLeft': Ctl.sprint = true; break;
      }
      recalcKeys();
    });
    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      if (e.code === 'ShiftLeft') Ctl.sprint = false;
      recalcKeys();
    });
    function recalcKeys() {
      if (joyId !== null) return;
      const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      Ctl.mv.x = x; Ctl.mv.y = y;
    }
    canvas.addEventListener('mousedown', (e) => {
      if (!Ctl.enabled) return;
      if (document.pointerLockElement !== canvas && canvas.requestPointerLock && !('ontouchstart' in window)) { try { canvas.requestPointerLock(); } catch (er) { /* ignore */ } }
      if (e.button === 0) Ctl.fire = true;
      if (e.button === 2) { Ctl.adsHold = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) Ctl.fire = false;
      if (e.button === 2) { Ctl.adsHold = false; Ctl.adsHoldReleased = true; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!Ctl.enabled || document.pointerLockElement !== canvas) return;
      Ctl.lx += e.movementX; Ctl.ly += e.movementY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { if (Ctl.enabled) { Ctl.reset(); } });
  }

  return {
    init, applyLayout,
    show(on) { root.classList.toggle('hidden', !on); },
    setNV(on) { const b = root.querySelector('[data-b="nv"]'); if (b) b.style.display = on ? '' : 'none'; },
    editMode(on) {
      Ctl.editing = on; root.classList.toggle('editing', on); root.classList.toggle('hidden', !on && !Ctl.enabled);
      if (on) applyLayout();
    },
    resetLayout() { Store.d.settings.layout = {}; applyLayout(); Store.save(); },
    updateAdsBtn, updateSprintBtn,
  };
})();
