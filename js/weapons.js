'use strict';
/* سلاح‌های اختصاصی بازی + مدل سه‌بعدی ساخته‌شده از جعبه‌ها */
const PAL = {
  m: [0.11, 0.11, 0.12], b: [0.2, 0.21, 0.23], w: [0.33, 0.22, 0.12], g: [0.18, 0.22, 0.16],
  glove: [0.1, 0.12, 0.1], skin: [0.72, 0.52, 0.4], red: [0.8, 0.12, 0.1], blue: [0.1, 0.5, 1.0], gold: [0.8, 0.6, 0.1],
};

function buildGun(o) {
  const parts = [];
  const P = (x, y, z, sx, sy, sz, c) => parts.push([x, y, z, sx, sy, sz, c]);
  P(0, 0, -o.bl / 2 + 0.05, o.bw, o.bh, o.bl, o.body || 'b');
  P(0, o.bh * 0.18, -(o.bl + o.barrel / 2) + 0.05, o.bt, o.bt, o.barrel, 'm');
  if (o.guard) P(0, -o.bh * 0.08, -o.bl - o.guard / 2 + 0.07, o.bw * 1.15, o.bh * 0.8, o.guard, o.guardCol || 'm');
  if (o.stock) P(0, -o.bh * 0.15, 0.05 + o.stock / 2, o.bw * 0.9, o.bh * 1.2, o.stock, o.stockCol || 'w');
  P(0, -o.bh / 2 - 0.035, 0.0, 0.026, 0.08, 0.034, 'm');
  if (o.mag) P(0, -o.bh / 2 - o.mag / 2, -o.bl * 0.45, o.magW || 0.026, o.mag, 0.04, o.magCol || 'm');
  if (o.drum) P(0, -o.bh / 2 - 0.045, -o.bl * 0.45, 0.07, 0.09, 0.07, 'm');
  if (o.scope) {
    P(0, o.bh / 2 + 0.04, -o.bl * 0.45, 0.034, 0.034, o.scope, 'm');
    P(0, o.bh / 2 + 0.018, -o.bl * 0.3, 0.014, 0.025, 0.014, 'm');
    P(0, o.bh / 2 + 0.018, -o.bl * 0.6, 0.014, 0.025, 0.014, 'm');
  } else if (!o.noSight) {
    P(0, o.bh / 2 + 0.012, -o.bl * 0.15, 0.012, 0.022, 0.012, 'm');
    P(0, o.bh / 2 + 0.012, -o.bl * 0.85, 0.008, 0.022, 0.008, 'm');
  }
  if (o.accent) P(o.bw / 2 + 0.002, 0.0, -o.bl * 0.5, 0.004, o.bh * 0.3, o.bl * 0.3, o.accent);
  return { parts, muzzle: [0, o.bh * 0.18, -(o.bl + o.barrel) + 0.05], sightY: o.bh / 2 + 0.03 };
}

const WEAPONS = {
  pistol: {
    id: 'pistol', fa: 'کلت سایه', en: 'Shade Pistol', type: 'pistol',
    dmg: 30, rpm: 360, auto: false, mag: 12, reserve: 96, reload: 1.25, spread: 0.014, ads: 0.35, recoil: 0.018,
    range: 70, pellets: 1, zoom: 1.2, price: 0, rank: 0, move: 1.05, tracer: [1, 0.85, 0.4],
    model: { bl: 0.15, bw: 0.034, bh: 0.065, barrel: 0.0, bt: 0.022, mag: 0.0, noSight: false },
    desc: 'سلاح کمکی سبک و دقیق',
  },
  ar1: {
    id: 'ar1', fa: 'رعد AR-7', en: 'Raad AR-7', type: 'rifle',
    dmg: 25, rpm: 620, auto: true, mag: 30, reserve: 180, reload: 1.9, spread: 0.02, ads: 0.3, recoil: 0.022,
    range: 140, pellets: 1, zoom: 1.5, price: 0, rank: 0, move: 1.0, tracer: [1, 0.9, 0.5],
    model: { bl: 0.27, bw: 0.04, bh: 0.075, barrel: 0.18, bt: 0.02, stock: 0.17, mag: 0.1, guard: 0.1 },
    desc: 'تفنگ تهاجمی همه‌کاره',
  },
  smg: {
    id: 'smg', fa: 'زنبور SM-3', en: 'Hornet SM-3', type: 'smg',
    dmg: 17, rpm: 920, auto: true, mag: 35, reserve: 210, reload: 1.6, spread: 0.028, ads: 0.4, recoil: 0.016,
    range: 60, pellets: 1, zoom: 1.35, price: 900, rank: 1, move: 1.1, tracer: [1, 0.85, 0.35], falloff: true,
    model: { bl: 0.2, bw: 0.038, bh: 0.07, barrel: 0.08, bt: 0.02, stock: 0.1, mag: 0.11, magCol: 'b' },
    desc: 'نرخ آتش بالا، مناسب نبرد نزدیک',
  },
  shotgun: {
    id: 'shotgun', fa: 'تندر SG-12', en: 'Thunder SG-12', type: 'shotgun',
    dmg: 12, rpm: 80, auto: false, mag: 6, reserve: 42, reload: 2.6, spread: 0.06, ads: 0.6, recoil: 0.07,
    range: 30, pellets: 9, zoom: 1.2, price: 1300, rank: 2, move: 1.0, tracer: [1, 0.8, 0.3], falloff: true, shellReload: true,
    model: { bl: 0.28, bw: 0.045, bh: 0.065, barrel: 0.22, bt: 0.03, stock: 0.17, mag: 0, guard: 0.14, guardCol: 'w', noSight: true },
    desc: 'مرگبار در فاصله نزدیک',
  },
  ar2: {
    id: 'ar2', fa: 'شهاب AR-9', en: 'Shahab AR-9', type: 'rifle',
    dmg: 34, rpm: 500, auto: true, mag: 25, reserve: 150, reload: 2.0, spread: 0.014, ads: 0.22, recoil: 0.03,
    range: 170, pellets: 1, zoom: 1.8, price: 2200, rank: 3, move: 0.97, tracer: [1, 0.9, 0.5],
    model: { bl: 0.3, bw: 0.042, bh: 0.08, barrel: 0.2, bt: 0.02, stock: 0.18, mag: 0.1, guard: 0.12, scope: 0.07, accent: 'gold' },
    desc: 'قدرت و دقت بالا برای فواصل متوسط',
  },
  lmg: {
    id: 'lmg', fa: 'کوه LM-5', en: 'Kuh LM-5', type: 'lmg',
    dmg: 27, rpm: 720, auto: true, mag: 80, reserve: 320, reload: 3.6, spread: 0.034, ads: 0.5, recoil: 0.025,
    range: 140, pellets: 1, zoom: 1.4, price: 3200, rank: 4, move: 0.82, tracer: [1, 0.85, 0.35],
    model: { bl: 0.3, bw: 0.05, bh: 0.09, barrel: 0.24, bt: 0.026, stock: 0.17, drum: true, guard: 0.14, mag: 0 },
    desc: 'خشاب بزرگ، آتش پوششی سنگین',
  },
  sniper: {
    id: 'sniper', fa: 'عقاب SR-1', en: 'Eagle SR-1', type: 'sniper',
    dmg: 150, rpm: 52, auto: false, mag: 5, reserve: 35, reload: 2.8, spread: 0.03, ads: 0.0, recoil: 0.09,
    range: 400, pellets: 1, zoom: 4.0, price: 3800, rank: 4, move: 0.9, tracer: [1, 1, 0.8], scoped: true,
    model: { bl: 0.34, bw: 0.04, bh: 0.075, barrel: 0.34, bt: 0.022, stock: 0.2, mag: 0.05, scope: 0.16, guard: 0.0 },
    desc: 'تک‌تیرانداز دوربرد با دوربین',
  },
  pulse: {
    id: 'pulse', fa: 'پالس PX-X', en: 'Pulse PX-X', type: 'special',
    dmg: 48, rpm: 330, auto: true, mag: 24, reserve: 120, reload: 2.2, spread: 0.012, ads: 0.25, recoil: 0.012,
    range: 200, pellets: 1, zoom: 1.6, price: 5200, rank: 5, move: 1.0, tracer: [0.3, 0.7, 1.0], pierce: 3, energy: true,
    model: { bl: 0.26, bw: 0.046, bh: 0.085, barrel: 0.14, bt: 0.03, stock: 0.1, mag: 0.07, magCol: 'blue', guard: 0.08, guardCol: 'blue', accent: 'blue', body: 'b' },
    desc: 'سلاح تخیلی؛ پرتو پلاسما از چند دشمن عبور می‌کند',
  },
};
const WEAPON_ORDER = ['pistol', 'ar1', 'smg', 'shotgun', 'ar2', 'lmg', 'sniper', 'pulse'];
for (const k of WEAPON_ORDER) { WEAPONS[k].gun = buildGun(WEAPONS[k].model); }

/* ارتقا: هر ویژگی تا سطح ۵ */
const UPG = {
  dmg: { fa: 'قدرت', en: 'Power', per: 0.09 },
  acc: { fa: 'دقت', en: 'Accuracy', per: 0.12 },
  rate: { fa: 'سرعت شلیک', en: 'Fire rate', per: 0.06 },
  mag: { fa: 'ظرفیت خشاب', en: 'Magazine', per: 0.12 },
};
const UPG_MAX = 5;
function upgCost(w, lvl) { return Math.round(Math.max(200, w.price * 0.16) * Math.pow(1 + lvl, 1.35)); }

/* مشخصات نهایی سلاح با احتساب ارتقاها */
function weaponStats(id) {
  const w = WEAPONS[id];
  const u = (Store.d.weapons[id] && Store.d.weapons[id].up) || { dmg: 0, acc: 0, rate: 0, mag: 0 };
  return {
    dmg: w.dmg * (1 + UPG.dmg.per * u.dmg),
    spread: w.spread * (1 - UPG.acc.per * u.acc * 0.9),
    interval: 60 / (w.rpm * (1 + UPG.rate.per * u.rate)),
    mag: Math.round(w.mag * (1 + UPG.mag.per * u.mag)),
    reserve: Math.round(w.reserve * (1 + UPG.mag.per * u.mag)),
  };
}

/* نارنجک */
const GRENADE = { dmg: 150, radius: 6.5, fuse: 2.0 };
