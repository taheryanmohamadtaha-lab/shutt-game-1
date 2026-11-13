'use strict';
/* ذخیره‌سازی پیشرفت بازی (LocalStorage با پشتیبان حافظه) */
const Store = (() => {
  const KEY = 'shadow_operation_save_v1';
  let mem = null;
  let timer = null;

  const RANKS = [
    { xp: 0, fa: 'سرباز', en: 'Private' },
    { xp: 250, fa: 'سرجوخه', en: 'Corporal' },
    { xp: 700, fa: 'گروهبان', en: 'Sergeant' },
    { xp: 1500, fa: 'ستوان', en: 'Lieutenant' },
    { xp: 3000, fa: 'سروان', en: 'Captain' },
    { xp: 5500, fa: 'سرگرد', en: 'Major' },
    { xp: 9000, fa: 'سرهنگ', en: 'Colonel' },
    { xp: 14000, fa: 'سرتیپ', en: 'General' },
  ];

  function defaults() {
    const up = () => ({ dmg: 0, acc: 0, rate: 0, mag: 0 });
    return {
      v: 1,
      name: 'سایه',
      coins: 600,
      xp: 0,
      weapons: { pistol: { owned: true, up: up() }, g3: { owned: true, up: up() }, ar1: { owned: true, up: up() } },
      loadout: ['g3', 'pistol'],
      gearGrenade: 0,
      gearArmor: 0,
      missions: { 1: { unlocked: true, stars: 0, best: 0, done: false } },
      stats: { kills: 0, headshots: 0, shots: 0, hits: 0, deaths: 0, playtime: 0, missionsDone: 0, grenadeKills: 0, totalScore: 0 },
      ach: {},
      daily: { date: '', tasks: [], progress: {}, claimed: {} },
      settings: {
        quality: 'medium', shadows: 'soft', sens: 1.0, fov: 75,
        music: 0.5, sfx: 0.8, vibrate: true, lang: 'fa',
        btnScale: 1, layout: {}, aimAssist: 'high', autoFire: false, difficulty: 'normal', lookAccel: 'med',
      },
    };
  }

  function merge(base, src) {
    for (const k in src) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object') merge(base[k], src[k]);
      else base[k] = src[k];
    }
    return base;
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return raw;
    } catch (e) { /* ignore */ }
    return mem;
  }

  let data = defaults();
  try {
    const raw = read();
    if (raw) data = merge(defaults(), JSON.parse(raw));
    /* مهاجرت: تفنگ G3 برای ذخیره‌های قدیمی */
    if (raw && !JSON.parse(raw).weapons.g3) { data.weapons.g3 = { owned: true, up: { dmg: 0, acc: 0, rate: 0, mag: 0 } }; if (data.loadout[0] === 'ar1') data.loadout[0] = 'g3'; }
  } catch (e) { data = defaults(); }

  function save() {
    const s = JSON.stringify(data);
    mem = s;
    try { localStorage.setItem(KEY, s); } catch (e) { /* ignore */ }
  }
  function saveSoon() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; save(); }, 600);
  }

  function rankIndex(xp) {
    let r = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = i;
    return r;
  }

  return {
    get d() { return data; },
    RANKS, save, saveSoon,
    rankIndex,
    rank() { return rankIndex(data.xp); },
    reset() { data = defaults(); save(); },
  };
})();
