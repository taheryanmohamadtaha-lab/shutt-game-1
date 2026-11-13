'use strict';
/* هشت مأموریت با محیط، هدف و نقشهٔ متفاوت */

function norm3(x, y, z) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }

const ENVS = {
  mountain: { skyTop: [0.25, 0.45, 0.8], skyHor: [0.72, 0.82, 0.92], fog: [0.62, 0.72, 0.82], fogD: 0.011, amb: [0.5, 0.55, 0.62], sunDir: norm3(0.5, 0.75, 0.35), sunCol: [0.95, 0.88, 0.72], sunDisc: [1, 0.9, 0.7], ground: [0.38, 0.4, 0.3], amb2: 'wind', music: 'tense' },
  desert: { skyTop: [0.35, 0.55, 0.85], skyHor: [0.95, 0.82, 0.62], fog: [0.88, 0.76, 0.58], fogD: 0.012, amb: [0.62, 0.55, 0.45], sunDir: norm3(-0.4, 0.8, 0.4), sunCol: [1, 0.9, 0.7], sunDisc: [1, 0.85, 0.5], ground: [0.68, 0.55, 0.36], amb2: 'wind', music: 'combat' },
  tropic: { skyTop: [0.25, 0.52, 0.9], skyHor: [0.8, 0.9, 0.96], fog: [0.74, 0.84, 0.9], fogD: 0.008, amb: [0.64, 0.64, 0.62], sunDir: norm3(0.4, 0.8, 0.3), sunCol: [1, 0.93, 0.78], sunDisc: [1, 0.92, 0.72], ground: [0.76, 0.7, 0.5], amb2: 'sea', music: 'combat' },
  city: { skyTop: [0.38, 0.4, 0.44], skyHor: [0.62, 0.58, 0.54], fog: [0.5, 0.48, 0.46], fogD: 0.017, amb: [0.5, 0.48, 0.47], sunDir: norm3(0.3, 0.6, -0.5), sunCol: [0.7, 0.62, 0.5], sunDisc: [0.8, 0.6, 0.4], ground: [0.28, 0.28, 0.3], amb2: 'wind', music: 'combat' },
  port: { skyTop: [0.18, 0.3, 0.5], skyHor: [0.55, 0.62, 0.7], fog: [0.45, 0.52, 0.6], fogD: 0.015, amb: [0.42, 0.48, 0.56], sunDir: norm3(-0.6, 0.45, 0.3), sunCol: [0.8, 0.78, 0.7], sunDisc: [1, 0.8, 0.6], ground: [0.3, 0.32, 0.34], amb2: 'sea', music: 'tense' },
  forest: { skyTop: [0.08, 0.1, 0.14], skyHor: [0.22, 0.26, 0.3], fog: [0.15, 0.18, 0.2], fogD: 0.015, amb: [0.2, 0.25, 0.26], sunDir: norm3(0.2, 0.9, 0.1), sunCol: [0.25, 0.3, 0.38], sunDisc: [0, 0, 0], ground: [0.1, 0.18, 0.1], amb2: 'rain', rain: true, music: 'tense' },
  night: { skyTop: [0.01, 0.02, 0.06], skyHor: [0.04, 0.06, 0.1], fog: [0.03, 0.04, 0.07], fogD: 0.02, amb: [0.1, 0.12, 0.2], sunDir: norm3(-0.3, 0.7, 0.4), sunCol: [0.15, 0.2, 0.35], sunDisc: [0.4, 0.45, 0.6], stars: true, ground: [0.14, 0.14, 0.16], amb2: 'wind', nv: true, music: 'tense' },
  under: { skyTop: [0.02, 0.02, 0.03], skyHor: [0.03, 0.03, 0.04], fog: [0.03, 0.03, 0.04], fogD: 0.02, amb: [0.16, 0.16, 0.2], sunDir: norm3(0, 1, 0), sunCol: [0.05, 0.05, 0.06], sunDisc: [0, 0, 0], ground: [0.2, 0.2, 0.22], amb2: 'hum', music: 'tense', indoor: true },
  valley: { skyTop: [0.28, 0.5, 0.82], skyHor: [0.78, 0.86, 0.9], fog: [0.66, 0.76, 0.8], fogD: 0.0105, amb: [0.58, 0.62, 0.62], sunDir: norm3(0.45, 0.78, 0.3), sunCol: [0.95, 0.88, 0.7], sunDisc: [1, 0.9, 0.7], ground: [0.3, 0.45, 0.25], amb2: 'wind', music: 'tense' },
  grotto: { skyTop: [0.04, 0.06, 0.14], skyHor: [0.1, 0.14, 0.26], fog: [0.07, 0.1, 0.18], fogD: 0.012, amb: [0.34, 0.36, 0.5], sunDir: norm3(0.2, 0.9, 0.2), sunCol: [0.3, 0.34, 0.5], sunDisc: [0, 0, 0], ground: [0.2, 0.2, 0.26], amb2: 'hum', music: 'tense', stars: true },
  snow: { skyTop: [0.45, 0.55, 0.7], skyHor: [0.85, 0.88, 0.92], fog: [0.8, 0.84, 0.9], fogD: 0.015, amb: [0.65, 0.68, 0.75], sunDir: norm3(0.3, 0.55, 0.5), sunCol: [0.85, 0.85, 0.85], sunDisc: [1, 1, 1], ground: [0.88, 0.9, 0.95], amb2: 'snow', snow: true, music: 'combat' },
};

/* پخش تصادفی اشیا در ناحیه، با دور ماندن از نقاط ممنوع */
function scatter(L, count, x0, z0, x1, z1, keep, fn) {
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const x = L.rr(x0, x1), z = L.rr(z0, z1);
    let ok = true;
    for (const k of keep) { if (Math.hypot(x - k[0], z - k[1]) < k[2]) { ok = false; break; } }
    if (!ok) continue;
    fn(x, z); placed++;
  }
}

/* ======================== مرحله ۱: عملیات شروع ======================== */
function buildM1() {
  const L = new Level(ENVS.mountain, 36, 101);
  L.groundPlane(ENVS.mountain.ground);
  L.mountainsRing([0.36, 0.34, 0.33], 10, 17);
  L.start = { x: 0, z: 28, yaw: 0 };
  const keep = [[0, 28, 7], [0, -2, 0]];
  // پایگاه کوچک
  L.building(-12, -10, 12, 9, 3.6, [0.46, 0.46, 0.4], ['s'], { light: true });
  L.building(14, -14, 10, 8, 3.6, [0.42, 0.45, 0.4], ['w'], { light: true });
  L.building(0, -24, 14, 7, 3.6, [0.45, 0.42, 0.38], ['s'], { light: true });
  L.sandbag(-4, 6, 5); L.sandbag(5, 4, 4); L.sandbag(-10, 12, 4, true); L.sandbag(11, 9, 5);
  L.sandbag(0, -6, 6); L.sandbag(-20, -2, 4, true); L.sandbag(22, 0, 4, true);
  for (const [x, z] of [[-6, 1], [7, -2], [-18, 8], [20, 10], [2, -14], [-3, -16]]) L.crate(x, z, 1.3);
  L.barrel(8, -4); L.barrel(8.8, -4.5); L.barrel(-14, 2); L.barrel(19, -5);
  L.lamp(-6, 12, 5, [1, 0.9, 0.6], 16); L.lamp(8, -8, 5, [1, 0.9, 0.6], 16);
  scatter(L, 22, -32, -32, 32, 22, keep.concat([[-12, -10, 9], [14, -14, 8], [0, -24, 10]]), (x, z) => (L.r() < 0.5 ? L.rock(x, z, L.rr(0.8, 1.6)) : L.pine(x, z, L.rr(5, 8))));
  // دشمنان
  L.enemy('soldier', -4, -2, { patrol: true });
  L.enemy('soldier', 6, -8, { patrol: true });
  L.enemy('soldier', -14, -4, { patrol: true });
  L.enemy('soldier', 16, -8, { patrol: true });
  L.enemy('soldier', 0, -16, { patrol: true });
  L.enemy('soldier', -8, -18, { patrol: true });
  L.pickup('health', -2, 20); L.pickup('ammo', 3, 18); L.pickup('ammo', -12, -2); L.pickup('health', 14, -9);
  return L;
}

/* ======================== مرحله ۱ (نسخهٔ دره جنگلی با مدل GLB) ======================== */
function buildM1Valley() {
  if (!Forest.ready) return buildM1();
  const L = Forest.build();
  L.start = { x: -1.5, z: 25, yaw: 0 };
  for (const [x, z] of [[-3, 12], [5, 6], [-9, 1], [8, -5], [0, -9], [-6, 18]]) L.enemy('soldier', x, z, { patrol: true });
  L.pickup('health', -3, 21); L.pickup('ammo', 3, 20); L.pickup('ammo', -10, 6); L.pickup('health', 9, 0);
  return L;
}


/* انتخاب نقاط آزاد و پراکنده روی نقشه (فاصله از شروع و از یکدیگر) */
function pickSpots(L, n, minStart, minBetween, cand) {
  const pts = [];
  const ok = (x, z) => !L.blocked(x, z, 0.7, L.terrain ? L.terrain.h(x, z) : 0, 1.8);
  let list = cand;
  if (!list) { list = []; const h = L.half - 3; for (let x = -h; x <= h; x += 3) for (let z = -h; z <= h; z += 3) list.push([x, z]); }
  list = list.filter(([x, z]) => ok(x, z) && Math.hypot(x - L.start.x, z - L.start.z) >= minStart);
  for (let k = 0; k < n && list.length; k++) {
    // دورترین نقطه از انتخاب‌های قبلی (و شروع)
    let best = null, bd = -1;
    for (const c of list) {
      let d = Math.hypot(c[0] - L.start.x, c[1] - L.start.z) * 0.5;
      for (const q of pts) d = Math.min(d, Math.hypot(c[0] - q[0], c[1] - q[1]));
      if (d > bd + 1e-6 && (pts.length === 0 || d >= minBetween * 0.6)) { bd = d; best = c; }
    }
    if (!best) break;
    pts.push(best); list = list.filter((c) => c !== best);
  }
  return pts;
}

/* ======================== مرحله ۳ (نسخهٔ شهر ساحلی با مدل GLB) ======================== */
function buildM3Tropic() {
  if (!Tropic.ready) return buildM3();
  const L = Tropic.build(ENVS.tropic);
  const types = [['soldier'], ['soldier'], ['soldier'], ['soldier'], ['soldier'], ['soldier'], ['rusher'], ['rusher'], ['armored'], ['soldier'], ['soldier'], ['soldier'], ['soldier'], ['rusher'], ['soldier'], ['sniper', { hold: true }]];
  const spots = pickSpots(L, types.length + 6, 14, 6, L.spawnSpots);
  types.forEach((t, i) => { const p = spots[i]; if (p) L.enemy(t[0], p[0], p[1], Object.assign({ patrol: t[0] !== 'sniper' }, t[1] || {})); });
  spots.slice(types.length).forEach((p, i) => L.pickup(i % 2 ? 'ammo' : 'health', p[0], p[1]));
  L.pickup('health', L.start.x - 3, L.start.z - 2); L.pickup('ammo', L.start.x + 3, L.start.z - 2);
  return L;
}

/* ======================== مرحله ۵ (نسخهٔ دره جنگلی بارانی با مدل GLB) ======================== */
function buildM5Valley() {
  if (!Forest.ready) return buildM5();
  const L = Forest.build('forest');
  L.start = { x: -1.5, z: 25, yaw: 0 };
  const off = pickSpots(L, 5, 22, 10);
  for (const [x, z] of off) {
    L.enemy('officer', x, z, { hold: true, target: true });
    const g = pickSpots(L, 6, 0, 0, [[x + 5, z - 3], [x - 5, z + 4], [x + 4, z + 5], [x - 4, z - 5], [x + 7, z], [x - 7, z]]).slice(0, 2);
    for (const [gx, gz] of g) L.enemy('soldier', gx, gz, { patrol: true });
  }
  const r = pickSpots(L, 2, 12, 8);
  for (const [x, z] of r.slice(0, 1)) L.enemy('rusher', x, z, { patrol: true });
  L.pickup('health', -3, 21); L.pickup('ammo', 3, 20); L.pickup('ammo', -10, 6); L.pickup('health', 9, 0);
  return L;
}

/* ======================== مرحله ۲: حمله به پایگاه ======================== */
function buildM2() {
  const L = new Level(ENVS.desert, 44, 202);
  L.groundPlane(ENVS.desert.ground);
  L.mountainsRing([0.62, 0.5, 0.34], 8, 14);
  L.start = { x: 0, z: 36, yaw: 0 };
  const wc = [0.6, 0.55, 0.45];
  // دیوار محوطه با دروازه
  L.fence(-28, 18, -4, 18, 4, 0.8, wc); L.fence(4, 18, 28, 18, 4, 0.8, wc);
  L.fence(-28, -30, 28, -30, 4, 0.8, wc);
  L.fence(-28, -30, -28, 18, 4, 0.8, wc); L.fence(28, -30, 28, 18, 4, 0.8, wc);
  L.add(-4, 3.2, 17.6, 4, 4, 18.4, wc, {});
  L.tower(-27, 17, 6); L.tower(27, 17, 6); L.tower(0, -29, 7);
  L.building(-18, 8, 12, 8, 3.6, [0.58, 0.5, 0.38], ['e'], { light: true });
  L.building(18, 6, 12, 8, 3.6, [0.58, 0.5, 0.38], ['w'], { light: true });
  L.building(-16, -18, 14, 8, 3.6, [0.55, 0.48, 0.36], ['n'], { light: true });
  L.building(18, -18, 12, 9, 3.6, [0.55, 0.48, 0.36], ['n'], { light: true });
  L.generator(-18, 8, null); L.generator(18, 6, null); L.generator(0, -22, null);
  L.add(-5, 0, -27, 5, 3.4, -25, [0.5, 0.45, 0.35], { kind: 'wall' });
  L.container(-8, -4, 'x', [0.2, 0.34, 0.5]); L.container(8, -6, 'x', [0.5, 0.25, 0.2]); L.container(-6, 8, 'z', [0.3, 0.4, 0.25]);
  L.sandbag(0, 14, 8); L.sandbag(-10, 14, 4); L.sandbag(10, 14, 4); L.sandbag(-2, 2, 5); L.sandbag(4, -10, 5, true);
  for (const [x, z] of [[-4, 12], [6, 10], [-22, -6], [22, -8], [10, -22], [-10, -26], [3, -2], [-3, -12]]) L.crate(x, z, 1.3);
  L.barrel(-12, 2); L.barrel(-12.8, 2.4); L.barrel(14, -2); L.barrel(24, -6); L.barrel(-24, -12);
  L.lamp(-8, 12, 5, [1, 0.85, 0.5], 16); L.lamp(8, 0, 5, [1, 0.85, 0.5], 16); L.lamp(0, -8, 5, [1, 0.85, 0.5], 16);
  scatter(L, 12, -40, 20, 40, 42, [[0, 36, 6]], (x, z) => L.rock(x, z, L.rr(0.8, 1.8), [0.6, 0.5, 0.36]));
  for (const [x, z] of [[-6, 12], [8, 8], [-10, -2], [14, -8], [-20, -14], [22, -14], [0, -6], [-4, -18], [10, -20], [-22, 0]]) L.enemy('soldier', x, z, { patrol: true });
  L.enemy('sniper', -27, 17, { hold: true, y: 6.25 }); L.enemy('sniper', 27, 17, { hold: true, y: 6.25 }); L.enemy('sniper', 0, -29, { hold: true, y: 7.25 });
  L.enemy('armored', 0, -10, { patrol: true });
  L.pickup('health', -2, 28); L.pickup('ammo', 2, 28); L.pickup('health', -14, 2); L.pickup('ammo', 14, 0); L.pickup('ammo', 0, -18); L.pickup('health', 10, -12);
  return L;
}

/* ======================== مرحله ۳: شهر متروکه ======================== */
function buildM3() {
  const L = new Level(ENVS.city, 52, 303);
  L.groundPlane(ENVS.city.ground);
  L.mountainsRing([0.3, 0.3, 0.32], 9, 14);
  L.start = { x: 0, z: 44, yaw: 0 };
  const cols = [[0.42, 0.38, 0.34], [0.36, 0.36, 0.38], [0.45, 0.4, 0.33], [0.32, 0.34, 0.33]];
  // بلوک‌های ساختمانی در شبکه (خیابان‌ها در x=0 و z=0 و حاشیه)
  const blocks = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [ox, oz, w, d] of [[14, 14, 14, 12], [34, 14, 10, 12], [14, 34, 14, 10], [34, 34, 10, 10]]) {
      const cx = sx * ox, cz = sz * oz;
      if (Math.abs(cz) > 44 || Math.abs(cx) > 46) continue;
      if (sz === 1 && Math.abs(cx) < 20 && cz > 36) continue; // محل شروع
      blocks.push([cx, cz, w, d]);
    }
  }
  blocks.forEach(([cx, cz, w, d], i) => {
    const h = 4 + (i % 3) * 2.2;
    const door = [['n', 's', 'e', 'w'][i % 4], ['w', 'n', 's', 'e'][i % 4]];
    L.building(cx, cz, w, d, h, cols[i % 4], door, { light: i % 2 === 0 });
    // تخریب: سوراخ در دیوار — جعبهٔ آوار
    L.add(cx + w / 2 - 1.5, 0, cz - d / 2 - 1.5, cx + w / 2 + 0.5, 1.0, cz - d / 2 + 0.5, [0.35, 0.32, 0.3], { kind: 'rubble' });
  });
  // خودروها و سنگرها در خیابان
  L.car(-4, 24, 'z', [0.3, 0.2, 0.2]); L.car(5, 12, 'z', [0.2, 0.25, 0.32]); L.car(-3, -6, 'z', [0.35, 0.33, 0.2]); L.car(4, -22, 'z', [0.25, 0.25, 0.25]);
  L.car(-24, 3, 'x', [0.3, 0.3, 0.3]); L.car(22, -3, 'x', [0.35, 0.2, 0.2]);
  L.sandbag(0, 30, 6); L.sandbag(-8, 0, 4, true); L.sandbag(8, 0, 4, true); L.sandbag(0, -14, 6); L.sandbag(-2, 6, 3, true);
  for (const [x, z] of [[2, 34], [-6, 18], [7, 4], [-7, -10], [6, -16], [-22, 8], [24, -8], [-10, 28], [12, 30], [0, -34]]) L.crate(x, z, 1.4, [0.35, 0.3, 0.2]);
  L.barrel(-5, 14); L.barrel(5.8, 14.2); L.barrel(-6, -22); L.barrel(8, -30); L.barrel(-20, -4);
  L.lamp(-8, 36, 5, [1, 0.8, 0.5], 14); L.lamp(8, 20, 5, [1, 0.8, 0.5], 14); L.lamp(-8, 0, 5, [1, 0.7, 0.4], 14); L.lamp(8, -24, 5, [1, 0.75, 0.4], 14);
  const ens = [['soldier', 0, 14], ['soldier', -12, 8], ['soldier', 10, 2], ['soldier', -8, -4], ['soldier', 4, -10], ['soldier', -4, -18], ['rusher', 18, -10], ['rusher', -22, -2], ['armored', 2, -26], ['soldier', 20, 20], ['soldier', -22, 22], ['soldier', 24, -26], ['soldier', -26, -24], ['rusher', 0, -36], ['soldier', 14, -36], ['sniper', -34, -34, { hold: true }]];
  for (const e of ens) L.enemy(e[0], e[1], e[2], Object.assign({ patrol: true }, e[3] || {}));
  L.pickup('health', -4, 38); L.pickup('ammo', 4, 38); L.pickup('health', -8, 6); L.pickup('ammo', 8, -6); L.pickup('health', 0, -20); L.pickup('ammo', -10, -26);
  return L;
}

/* ======================== مرحله ۴: نجات گروگان‌ها (بندر) ======================== */
function buildM4() {
  const L = new Level(ENVS.port, 46, 404);
  L.groundPlane(ENVS.port.ground);
  // دریا: جعبهٔ آبی غیر برخوردی در یک طرف
  L.add(-60, -0.6, -60, 60, -0.05, -34, [0.08, 0.2, 0.3], { solid: false, opaque: false, mat: 1, ao: 0, kind: 'water' });
  L.add(-50, 0, -34, 50, 1.2, -32.5, [0.35, 0.33, 0.3], { kind: 'wall' }); // لبهٔ اسکله
  L.mountainsRing([0.3, 0.32, 0.34], 6, 11);
  L.start = { x: 0, z: 38, yaw: 0 };
  L.extract = { x: 0, z: 38, r: 4.5 };
  // کانتینرها
  const ccols = [[0.55, 0.2, 0.15], [0.15, 0.3, 0.5], [0.2, 0.45, 0.25], [0.6, 0.5, 0.15], [0.4, 0.4, 0.42]];
  let ci = 0;
  for (const [x, z, a] of [[-24, 14, 'x'], [-24, 8, 'x'], [-12, 20, 'z'], [12, 20, 'z'], [24, 14, 'x'], [24, 8, 'x'], [-30, -8, 'x'], [30, -8, 'x'], [-8, -6, 'x'], [8, -10, 'x'], [-20, -22, 'z'], [20, -22, 'z']]) {
    L.container(x, z, a, ccols[ci++ % 5]);
    if (ci % 3 === 0) L.container(x, z, a, ccols[(ci + 2) % 5], 2.6);
  }
  // سه سوله با گروگان
  L.building(-30, -22, 9, 8, 3.6, [0.4, 0.42, 0.44], ['e'], { light: true });
  L.building(0, -24, 9, 8, 3.6, [0.4, 0.42, 0.44], ['s'], { light: true });
  L.building(30, -22, 9, 8, 3.6, [0.4, 0.42, 0.44], ['w'], { light: true });
  L.hostage(-31, -22); L.hostage(0, -25); L.hostage(31, -22);
  L.building(0, 4, 14, 8, 4, [0.45, 0.45, 0.42], ['s', 'n'], { light: true });
  L.sandbag(-6, 30, 5); L.sandbag(6, 30, 5); L.sandbag(0, 14, 6); L.sandbag(-14, -2, 4, true); L.sandbag(14, -2, 4, true);
  for (const [x, z] of [[-4, 26], [5, 24], [-16, 4], [16, 4], [-12, -14], [12, -16], [0, -12], [-20, 28], [22, 28]]) L.crate(x, z, 1.4, [0.35, 0.32, 0.25]);
  L.barrel(-3, 22); L.barrel(3, 22.8); L.barrel(-18, -10); L.barrel(18, -12); L.barrel(8, 0);
  L.lamp(-10, 28, 6, [1, 0.9, 0.7], 18); L.lamp(10, 28, 6, [1, 0.9, 0.7], 18); L.lamp(-14, 0, 6, [1, 0.9, 0.7], 18); L.lamp(14, 0, 6, [1, 0.9, 0.7], 18); L.lamp(0, -14, 6, [1, 0.9, 0.7], 18);
  // نگهبانان
  const ens = [['soldier', -29, -16], ['soldier', -33, -26], ['armored', -26, -20], ['soldier', 2, -18], ['soldier', -3, -28], ['armored', 4, -20], ['soldier', 29, -16], ['soldier', 33, -26], ['soldier', 26, -18],
    ['soldier', -10, 6], ['soldier', 10, 8], ['soldier', 0, -4], ['rusher', -18, -4], ['rusher', 18, -2], ['soldier', -6, 18], ['soldier', 8, 16]];
  for (const e of ens) L.enemy(e[0], e[1], e[2], { patrol: true });
  L.enemy('sniper', -40, 10, { hold: true });
  L.pickup('health', -4, 32); L.pickup('ammo', 4, 32); L.pickup('health', -14, 8); L.pickup('ammo', 14, 8); L.pickup('health', 0, -8); L.pickup('ammo', -20, -14); L.pickup('ammo', 20, -14);
  return L;
}

/* ======================== مرحله ۵: عملیات تک‌تیرانداز (جنگل بارانی) ======================== */
function buildM5() {
  const L = new Level(ENVS.forest, 90, 505);
  L.groundPlane(ENVS.forest.ground);
  L.mountainsRing([0.12, 0.16, 0.14], 14, 24);
  L.start = { x: 0, z: 80, yaw: 0 };
  const keep = [[0, 80, 8]];
  // سه خوشهٔ هدف
  const clusters = [[-45, 20], [48, 0], [0, -50], [-50, -55], [55, -48]];
  for (const [cx, cz] of clusters) {
    keep.push([cx, cz, 14]);
    L.building(cx, cz, 10, 8, 3.8, [0.22, 0.24, 0.22], [cz > 0 ? 's' : 'n', 'e'], { light: true });
    L.sandbag(cx - 10, cz + 4, 5); L.sandbag(cx + 10, cz - 4, 5);
    L.crate(cx + 7, cz + 8, 1.3); L.barrel(cx - 8, cz - 7);
    L.lamp(cx + 9, cz + 7, 5, [0.9, 0.8, 0.5], 14);
  }
  // ردهٔ جنگل
  scatter(L, 120, -86, -86, 86, 86, keep, (x, z) => L.pine(x, z, L.rr(6, 11)));
  scatter(L, 20, -86, -86, 86, 86, keep, (x, z) => L.rock(x, z, L.rr(0.9, 2)));
  // برج دیده‌بانی و پشت‌بام‌ها
  L.tower(-48, 12, 6); L.tower(40, -8, 6);
  L.lamp(-4, 76, 5, [0.8, 0.9, 1], 12);
  // اهداف (افسران) و نگهبانان
  L.enemy('officer', -45, 20, { hold: true, target: true });
  L.enemy('officer', 48, 0, { hold: true, target: true });
  L.enemy('officer', 0, -50, { hold: true, target: true });
  L.enemy('officer', -50, -55, { hold: true, target: true });
  L.enemy('officer', 55, -48, { hold: true, target: true });
  for (const [cx, cz] of clusters) {
    L.enemy('soldier', cx + 6, cz - 4, { patrol: true }); L.enemy('soldier', cx - 6, cz + 5, { patrol: true });
  }
  L.enemy('sniper', -48, 12, { hold: true, y: 6.25 }); L.enemy('sniper', 40, -8, { hold: true, y: 6.25 });
  L.enemy('rusher', 0, -20, { patrol: true });
  L.pickup('health', -3, 74); L.pickup('ammo', 3, 74); L.pickup('ammo', -3, 70); L.pickup('health', 20, 40); L.pickup('ammo', -20, 40); L.pickup('health', 0, 10);
  return L;
}

/* ======================== مرحله ۶: حمله شبانه (انبار مهمات) ======================== */
function buildM6() {
  const L = new Level(ENVS.night, 46, 606);
  L.groundPlane(ENVS.night.ground);
  L.mountainsRing([0.08, 0.09, 0.11], 7, 12);
  L.start = { x: 0, z: 38, yaw: 0 };
  L.extract = { x: 0, z: -38, r: 4 };
  const wc = [0.28, 0.28, 0.3];
  // انبارهای بزرگ با دو درب
  L.building(-22, 14, 16, 12, 5, wc, ['s', 'e'], { light: true });
  L.building(22, 14, 16, 12, 5, wc, ['s', 'w'], { light: true });
  L.building(-22, -12, 16, 12, 5, wc, ['n', 'e'], { light: true });
  L.building(22, -12, 16, 12, 5, wc, ['n', 'w'], { light: true });
  L.building(0, -26, 14, 8, 4.5, [0.3, 0.22, 0.2], ['s'], { light: true });
  // مخازن
  for (const [x, z] of [[-8, 26], [8, 26], [0, 0]]) { L.add(x - 2, 0, z - 2, x + 2, 4, z + 2, [0.34, 0.34, 0.38], { kind: 'tank', mat: 0 }); }
  for (const [x, z, a] of [[-6, -2, 'x'], [8, 6, 'z'], [-10, -22, 'x'], [12, -28, 'x'], [-34, 0, 'z'], [34, 0, 'z']]) L.container(x, z, a, [0.22, 0.25, 0.28]);
  for (const [x, z] of [[-4, 18], [6, 10], [-12, 0], [14, -4], [-2, -14], [8, -18], [-30, 30], [30, 30], [-16, 30], [16, 32]]) L.crate(x, z, 1.4, [0.25, 0.22, 0.16]);
  for (const [x, z] of [[-5, 14], [-4.2, 14.4], [5, 2], [14, -14], [-14, -4], [0, -16], [30, -2]]) L.barrel(x, z);
  L.lamp(-10, 32, 6, [0.8, 0.9, 1], 18, 1.1); L.lamp(10, 32, 6, [0.8, 0.9, 1], 18, 1.1); L.lamp(0, 8, 6, [1, 0.85, 0.6], 18, 1.1);
  L.lamp(-10, -6, 6, [1, 0.8, 0.5], 18, 1.1); L.lamp(10, -6, 6, [1, 0.8, 0.5], 18, 1.1); L.lamp(0, -20, 6, [1, 0.3, 0.2], 16, 1.1);
  const ens = [['soldier', -22, 10], ['soldier', -26, 16], ['soldier', 22, 10], ['rusher', 26, 16], ['soldier', -22, -10], ['soldier', -26, -14], ['soldier', 22, -14], ['armored', 20, -8],
    ['soldier', 0, 18], ['soldier', -6, 4], ['soldier', 8, -2], ['rusher', -12, -8], ['soldier', 2, -24], ['armored', -2, -30], ['soldier', 14, -22], ['soldier', -14, -24], ['heavy', 0, -14]];
  for (const e of ens) L.enemy(e[0], e[1], e[2], { patrol: true });
  L.enemy('sniper', -34, -32, { hold: true });
  L.pickup('health', -3, 34); L.pickup('ammo', 3, 34); L.pickup('health', -20, 2); L.pickup('ammo', 20, 2); L.pickup('health', 0, -8); L.pickup('ammo', -8, -18); L.pickup('health', 8, -34);
  return L;
}

/* ======================== مرحله ۷: پایگاه زیرزمینی ======================== */
function buildM7() {
  const L = new Level(ENVS.under, 40, 707);
  const wc = [0.26, 0.27, 0.3];
  L.groundPlane([0.18, 0.18, 0.2]);
  L.start = { x: 0, z: 32, yaw: 0 };
  // سقف
  L.add(-44, 5.0, -44, 44, 5.6, 44, [0.15, 0.15, 0.17], { kind: 'roof', ao: 0 });
  // دیوار بیرونی
  L.fence(-36, -36, 36, -36, 5, 0.8, wc); L.fence(-36, 36, 36, 36, 5, 0.8, wc);
  L.fence(-36, -36, -36, 36, 5, 0.8, wc); L.fence(36, -36, 36, 36, 5, 0.8, wc);
  // سالن ورودی + سه راهرو/اتاق
  L.room(-10, 16, 10, 36, 5, wc, [{ s: 'n', p: 0, w: 3.2 }]);
  L.room(-34, 0, -10, 16, 5, wc, [{ s: 'e', p: 8, w: 3.2 }, { s: 'n', p: -22, w: 3.2 }]);
  L.room(10, 0, 34, 16, 5, wc, [{ s: 'w', p: 8, w: 3.2 }, { s: 'n', p: 22, w: 3.2 }]);
  L.room(-34, -34, -10, 0, 5, wc, [{ s: 'e', p: -18, w: 3.2 }, { s: 's', p: -22, w: 3.2 }]);
  L.room(10, -34, 34, 0, 5, wc, [{ s: 'w', p: -18, w: 3.2 }, { s: 's', p: 22, w: 3.2 }]);
  L.room(-10, -34, 10, 0, 5, wc, [{ s: 'w', p: -18, w: 3.2 }, { s: 'e', p: -18, w: 3.2 }, { s: 's', p: 0, w: 3.2 }]);
  // راکتورها
  L.generator(-22, -17, [0.15, 0.3, 0.4]); L.generator(22, -17, [0.15, 0.3, 0.4]); L.generator(0, -26, [0.15, 0.3, 0.4]);
  // سنگرها و جعبه‌ها
  for (const [x, z] of [[0, 28], [-4, 22], [4, 22], [-22, 8], [-28, 4], [22, 8], [28, 4], [-22, -6], [22, -6], [-4, -10], [4, -10], [0, -18]]) L.crate(x, z, 1.4, [0.25, 0.28, 0.3]);
  for (const [x, z] of [[-14, 4], [14, 4], [-14, -28], [14, -28], [-6, -6]]) L.barrel(x, z);
  L.sandbag(-2, 18.5, 3); L.sandbag(2, 18.5, 3);
  // نورها: قرمز و آبی
  L.light(0, 4, 26, 16, 0.5, 0.9, 1.0); L.light(-22, 4, 8, 16, 1, 0.5, 0.3); L.light(22, 4, 8, 16, 0.5, 0.9, 1);
  L.light(-22, 4, -17, 18, 0.2, 1, 0.5); L.light(22, 4, -17, 18, 0.2, 1, 0.5); L.light(0, 4, -26, 18, 1, 0.2, 0.2); L.light(0, 4, -10, 16, 1, 0.8, 0.5);
  L.light(-22, 4, -6, 16, 1, 0.9, 0.6); L.light(22, 4, -6, 16, 1, 0.9, 0.6);
  const strip = (x, z, col) => L.add(x - 0.8, 4.4, z - 0.15, x + 0.8, 4.6, z + 0.15, col, { solid: false, mat: 2, ao: 0, kind: 'glow' });
  for (const [x, z] of [[0, 26], [0, 20], [-22, 8], [22, 8], [-22, -6], [22, -6], [-22, -17], [22, -17], [0, -26], [0, -10]]) strip(x, z, [0.8, 0.9, 1]);
  const ens = [['soldier', -2, 22], ['soldier', 3, 28], ['armored', -26, 8], ['soldier', -20, 6], ['armored', 26, 6], ['soldier', 20, 10], ['soldier', -22, -8], ['armored', -26, -20], ['heavy', -18, -18],
    ['soldier', 22, -8], ['armored', 26, -20], ['heavy', 18, -18], ['soldier', 4, -8], ['soldier', -4, -12], ['armored', 4, -24], ['heavy', -4, -28], ['rusher', 0, -4]];
  for (const e of ens) L.enemy(e[0], e[1], e[2], { patrol: true });
  L.pickup('health', 0, 32); L.pickup('ammo', 4, 32); L.pickup('health', -26, 10); L.pickup('ammo', 26, 10); L.pickup('health', 0, -6); L.pickup('ammo', -28, -10); L.pickup('health', 28, -10); L.pickup('ammo', 0, -30);
  return L;
}

/* ======================== مرحله ۸: نبرد نهایی ======================== */
function buildM8() {
  const L = new Level(ENVS.snow, 50, 808);
  L.groundPlane(ENVS.snow.ground);
  L.mountainsRing([0.78, 0.82, 0.88], 12, 20);
  L.start = { x: 0, z: 42, yaw: 0 };
  const wc = [0.45, 0.48, 0.52];
  // قلعه: حیاط مرکزی با دیوار و برج
  L.fence(-24, 10, -3, 10, 5, 0.9, wc); L.fence(3, 10, 24, 10, 5, 0.9, wc);
  L.fence(-24, -34, 24, -34, 5, 0.9, wc); L.fence(-24, -34, -24, 10, 5, 0.9, wc); L.fence(24, -34, 24, 10, 5, 0.9, wc);
  L.add(-3, 3.8, 9.55, 3, 5, 10.45, wc, {});
  L.tower(-23, 9, 7); L.tower(23, 9, 7); L.tower(-23, -33, 7); L.tower(23, -33, 7);
  L.building(0, -24, 16, 10, 5, [0.4, 0.43, 0.47], ['s'], { light: true });
  L.building(-16, -10, 10, 8, 4, [0.42, 0.45, 0.48], ['e'], { light: true });
  L.building(16, -10, 10, 8, 4, [0.42, 0.45, 0.48], ['w'], { light: true });
  L.sandbag(-6, 4, 5); L.sandbag(6, 4, 5); L.sandbag(0, -6, 6); L.sandbag(-12, -20, 4, true); L.sandbag(12, -20, 4, true); L.sandbag(-8, 28, 5); L.sandbag(8, 28, 5);
  for (const [x, z] of [[-10, 0], [10, 0], [-4, -12], [4, -12], [0, 20], [-14, 22], [14, 22], [-18, -2], [18, -2], [-8, -16], [8, -16]]) L.crate(x, z, 1.4, [0.4, 0.38, 0.3]);
  L.barrel(-4, 0); L.barrel(4.8, 0.4); L.barrel(-14, -26); L.barrel(14, -26); L.barrel(0, 14);
  L.lamp(-8, 8, 6, [1, 0.8, 0.6], 18); L.lamp(8, 8, 6, [1, 0.8, 0.6], 18); L.lamp(-8, -14, 6, [1, 0.8, 0.6], 18); L.lamp(8, -14, 6, [1, 0.8, 0.6], 18);
  scatter(L, 40, -46, -46, 46, 46, [[0, 42, 8], [0, -8, 28]], (x, z) => (L.r() < 0.6 ? L.pine(x, z, L.rr(6, 10), true) : L.rock(x, z, L.rr(0.8, 1.8), [0.7, 0.72, 0.78])));
  // دشمنان
  const ens = [['soldier', -10, 14], ['soldier', 10, 14], ['soldier', -6, 0], ['soldier', 6, 0], ['armored', -12, -4], ['armored', 12, -4], ['heavy', 0, -8], ['soldier', -16, -16], ['soldier', 16, -16],
    ['rusher', -4, 18], ['rusher', 4, 18], ['soldier', -2, -18], ['soldier', 2, -18], ['soldier', -18, 20], ['soldier', 18, 20]];
  for (const e of ens) L.enemy(e[0], e[1], e[2], { patrol: true });
  L.enemy('sniper', -23, 9, { hold: true, y: 7.25 }); L.enemy('sniper', 23, 9, { hold: true, y: 7.25 });
  L.enemy('sniper', -23, -33, { hold: true, y: 7.25 }); L.enemy('sniper', 23, -33, { hold: true, y: 7.25 });
  L.enemy('boss', 0, -24, { hold: true, boss: true });
  L.enemy('commander', -3, -22, { guardBoss: true }); L.enemy('commander', 3, -22, { guardBoss: true });
  L.pickup('health', -3, 38); L.pickup('ammo', 3, 38); L.pickup('health', 0, 24); L.pickup('ammo', -14, 20); L.pickup('ammo', 14, 20); L.pickup('health', -10, -2); L.pickup('health', 10, -2); L.pickup('ammo', 0, -10);
  return L;
}


/* ======================== نقشه‌های GLB برای مأموریت‌های ۲، ۴، ۶، ۷ ======================== */
const gy = (L, x, z) => (L.terrain ? L.terrain.h(x, z) : 0);
function guardsAround(L, x, z, types, extra) {
  const ring = [[x + 4.5, z], [x - 4.5, z], [x, z + 4.5], [x, z - 4.5], [x + 3.5, z + 3.5], [x - 3.5, z - 3.5]];
  const g = pickSpots(L, types.length, 0, 0, ring);
  types.forEach((t, i) => { const p = g[i]; if (p) L.enemy(t, p[0], p[1], Object.assign({ patrol: true }, extra || {})); });
}
function scatterEnemies(L, types, minStart, minBetween) {
  const spots = pickSpots(L, types.length, minStart, minBetween, L.spawnSpots);
  types.forEach((t, i) => { const p = spots[i]; if (p) L.enemy(t, p[0], p[1], t === 'sniper' ? { hold: true } : { patrol: true }); });
  return spots;
}
function scatterPickups(L, n, minStart) {
  const spots = pickSpots(L, n, minStart, 10, L.spawnSpots);
  spots.forEach((p, i) => L.pickup(i % 2 ? 'ammo' : 'health', p[0], p[1]));
  L.pickup('health', L.start.x - 2.5, L.start.z); L.pickup('ammo', L.start.x + 2.5, L.start.z);
}

function buildM2Ridge() {
  if (!MapLib.ready('goldrush')) return buildM2();
  const L = MapLib.build('goldrush', ENVS.desert, 202);
  const gens = pickSpots(L, 3, 26, 24, L.spawnSpots);
  for (const [x, z] of gens) { L.generator(x, z, null); guardsAround(L, x, z, ['soldier', 'soldier']); L.light(x, gy(L, x, z) + 4, z, 14, 1, 0.8, 0.4); }
  scatterEnemies(L, ['soldier', 'soldier', 'soldier', 'soldier', 'rusher', 'rusher', 'armored', 'soldier', 'sniper', 'sniper'], 14, 9);
  scatterPickups(L, 6, 10);
  return L;
}

function buildM4Glacier() {
  if (!MapLib.ready('glacier')) return buildM4();
  const L = MapLib.build('glacier', ENVS.snow, 404);
  L.extract = { x: L.start.x, z: L.start.z, r: 4.5 };
  const hs = pickSpots(L, 3, 28, 24, L.spawnSpots);
  hs.forEach(([x, z], i) => { L.hostage(x, z); guardsAround(L, x, z, i === 1 ? ['soldier', 'armored', 'soldier'] : ['soldier', 'soldier', 'armored']); });
  scatterEnemies(L, ['soldier', 'soldier', 'rusher', 'soldier', 'sniper', 'soldier'], 16, 10);
  scatterPickups(L, 6, 10);
  return L;
}

function buildM6Planet() {
  if (!MapLib.ready('planet')) return buildM6();
  const L = MapLib.build('planet', ENVS.night, 606);
  // منطقهٔ تخلیه: دورترین نقطه از شروع
  let far = null, fd = -1;
  for (const c of L.spawnSpots) { const d = Math.hypot(c[0] - L.start.x, c[1] - L.start.z); if (d > fd) { fd = d; far = c; } }
  L.extract = { x: far[0], z: far[1], r: 4 };
  const types = ['soldier', 'soldier', 'soldier', 'rusher', 'soldier', 'armored', 'soldier', 'rusher', 'soldier', 'soldier', 'armored', 'sniper', 'soldier', 'soldier'];
  const spots = scatterEnemies(L, types, 10, 6);
  const lamps = pickSpots(L, 10, 0, 7, L.spawnSpots);
  lamps.forEach(([x, z], i) => L.light(x, gy(L, x, z) + 4, z, 16, i % 2 ? 1 : 0.5, i % 2 ? 0.35 : 0.8, i % 2 ? 0.25 : 1));
  L.light(far[0], gy(L, far[0], far[1]) + 4, far[1], 18, 0.3, 1, 0.5);
  scatterPickups(L, 6, 8);
  return L;
}

function buildM7Grotto() {
  if (!MapLib.ready('grotto')) return buildM7();
  const L = MapLib.build('grotto', ENVS.grotto, 707);
  const rs = pickSpots(L, 3, 22, 16, L.spawnSpots);
  rs.forEach(([x, z], i) => { L.generator(x, z, [0.15, 0.3, 0.4]); L.light(x, gy(L, x, z) + 4, z, 18, 0.3, 0.8, 1); guardsAround(L, x, z, i === 0 ? ['armored', 'soldier'] : ['armored', 'heavy']); });
  scatterEnemies(L, ['soldier', 'soldier', 'rusher', 'soldier', 'armored', 'soldier', 'sniper', 'rusher'], 10, 7);
  const lamps = pickSpots(L, 6, 0, 8, L.spawnSpots);
  lamps.forEach(([x, z]) => L.light(x, gy(L, x, z) + 4, z, 16, 0.9, 0.5, 1));
  L.light(L.start.x, gy(L, L.start.x, L.start.z) + 4, L.start.z, 16, 0.5, 0.9, 1);
  scatterPickups(L, 6, 8);
  return L;
}

const MISSIONS = [
  {
    id: 1, build: buildM1Valley, fa: 'عملیات شروع', en: 'Operation Start', area: 'دره جنگلی', areaEn: 'Forest Valley',
    brief: 'سرگرد کیان: «سایه، این اولین عملیات توست. گروهی به نام «کلاه‌سیاه» دره جنگلی را اشغال کرده‌اند. وارد شو، با کنترل‌ها آشنا شو و همهٔ نیروهای دشمن را پاک‌سازی کن.»',
    briefEn: 'Major Kian: "Shadow, this is your first op. The Blackcap group holds the forest valley. Get in, learn the controls and clear every hostile."',
    type: 'kill', obj: 'همهٔ نیروهای دشمن را نابود کن', objEn: 'Eliminate all hostiles',
    par: 150, reward: 400, xp: 120, bonus: { type: 'headshots', n: 3, fa: 'سه ضربهٔ سر بزن', en: 'Land 3 headshots' }, music: 'menu',
  },
  {
    id: 2, build: buildM2Ridge, fa: 'حمله به پایگاه', en: 'Base Assault', area: 'پایگاه مخفی در بیابان', areaEn: 'Desert Hideout',
    brief: 'سرگرد کیان: «پایگاه مخفی در بیابان برق خود را از سه مولد تأمین می‌کند. مولدها را نابود کن تا سامانهٔ ارتباطی‌شان از کار بیفتد. مراقب تک‌تیراندازهای روی برج‌ها باش.»',
    briefEn: 'Major Kian: "The desert hideout runs on three generators. Destroy them to cut their comms. Watch the snipers on the towers."',
    type: 'destroy', obj: 'سه مولد برق را نابود کن', objEn: 'Destroy the three generators', count: 3,
    par: 240, reward: 600, xp: 180, bonus: { type: 'kills', n: 8, fa: '۸ دشمن را از بین ببر', en: 'Kill 8 enemies' },
  },
  {
    id: 3, build: buildM3Tropic, fa: 'شهر متروکه', en: 'Abandoned City', area: 'شهر ساحلی متروکه', areaEn: 'Abandoned Coastal Town',
    brief: 'سرگرد کیان: «شهر متروکه پر از نیروهای مهاجم است. در خیابان‌ها پشت موانع پناه بگیر؛ مهاجمان سریع از ساختمان‌ها بیرون می‌آیند. همه را پاک‌سازی کن.»',
    briefEn: 'Major Kian: "The ruined city is full of raiders. Use cover in the streets; fast rushers will pour from the buildings. Clear them all."',
    type: 'kill', obj: 'شهر را از دشمن پاک‌سازی کن', objEn: 'Clear the city of hostiles',
    par: 330, reward: 800, xp: 240, bonus: { type: 'headshots', n: 6, fa: 'شش ضربهٔ سر بزن', en: 'Land 6 headshots' },
  },
  {
    id: 4, build: buildM4Glacier, fa: 'نجات گروگان‌ها', en: 'Hostage Rescue', area: 'دره یخی یخچال', areaEn: 'Glacier Gulch',
    brief: 'سرگرد کیان: «سه نفر از دانشمندان ما در دره‌های یخی اسیرند. به هر گروگان نزدیک شو و چند ثانیه کنارش بمان تا آزاد شود؛ بعد همه را به منطقهٔ امن برگردان.»',
    briefEn: 'Major Kian: "Three of our scientists are held in the frozen gulch. Stay close to each until freed, then bring them all back to the safe zone."',
    type: 'rescue', obj: 'گروگان‌ها را آزاد و به منطقهٔ امن برسان', objEn: 'Free the hostages and bring them to safety', count: 3,
    par: 360, reward: 1000, xp: 300, bonus: { type: 'noAlarm', fa: 'هیچ گروگانی آسیب نبیند', en: 'No hostage harmed' },
  },
  {
    id: 5, build: buildM5Valley, fa: 'عملیات تک‌تیرانداز', en: 'Sniper Operation', area: 'جنگل تاریک و بارانی', areaEn: 'Dark Rainy Forest',
    brief: 'سرگرد کیان: «پنج افسر دشمن در جنگل پراکنده‌اند. تفنگ عقاب در اختیار توست. از دور شکارشان کن؛ ولی زمان محدود است. هدف‌ها با نشانگر زرد مشخص شده‌اند.»',
    briefEn: 'Major Kian: "Five enemy officers are scattered through the forest. You get the Eagle rifle. Hunt them from range — time is limited. Targets are marked in yellow."',
    type: 'snipe', obj: 'پنج افسر دشمن را حذف کن', objEn: 'Eliminate five enemy officers', count: 5,
    time: 420, par: 300, reward: 1200, xp: 360, forceWeapon: 'sniper', bonus: { type: 'headshots', n: 3, fa: 'سه ضربهٔ سر بزن', en: 'Land 3 headshots' },
  },
  {
    id: 6, build: buildM6Planet, fa: 'حمله شبانه', en: 'Night Raid', area: 'پایگاه سیارهٔ سرخ', areaEn: 'Red Planet Outpost',
    brief: 'سرگرد کیان: «شب‌هنگام به پایگاه سیارهٔ سرخ می‌زنیم. دید شبانه را با دکمهٔ «دید» روشن کن. تا انتهای پایگاه پیش برو و به منطقهٔ تخلیه برس؛ وقت محدود است.»',
    briefEn: 'Major Kian: "We hit the Red Planet outpost at night. Toggle night vision with the NV button. Push to the far end of the outpost and reach extraction before time runs out."',
    type: 'reach', obj: 'دشمنان را پاک و به منطقهٔ تخلیه برس', objEn: 'Clear hostiles and reach extraction',
    time: 480, par: 360, reward: 1500, xp: 420, bonus: { type: 'kills', n: 14, fa: '۱۴ دشمن را از بین ببر', en: 'Kill 14 enemies' }, needKills: 0.6,
  },
  {
    id: 7, build: buildM7Grotto, fa: 'پایگاه زیرزمینی', en: 'Underground Base', area: 'پایگاه زیرزمینی دشمن', areaEn: 'Enemy Underground Base',
    brief: 'سرگرد کیان: «نیروهای زرهی و سنگین در پایگاه زیرزمینی منتظرند. سه راکتور انرژی را نابود کن. هر اتاق را با احتیاط پاک کن؛ فضا تنگ است.»',
    briefEn: 'Major Kian: "Armored and heavy troops wait underground. Destroy the three energy reactors. Clear each room carefully — space is tight."',
    type: 'destroy', obj: 'سه راکتور انرژی را نابود کن', objEn: 'Destroy the three reactors', count: 3,
    par: 420, reward: 1800, xp: 480, bonus: { type: 'kills', n: 12, fa: '۱۲ دشمن را از بین ببر', en: 'Kill 12 enemies' },
  },
  {
    id: 8, build: buildM8, fa: 'نبرد نهایی', en: 'Final Battle', area: 'قلعهٔ برفی', areaEn: 'Snow Fortress',
    brief: 'سرگرد کیان: «این پایان کار است. فرمانده اصلی «کلاه‌سیاه» در قلعهٔ برفی سنگر گرفته. محافظانش را بشکن و خودش را از پا درآور. موفق باشی، سایه.»',
    briefEn: 'Major Kian: "This is the end. Commander Blackcap has dug into the snow fortress. Break his guards and take him down. Good luck, Shadow."',
    type: 'boss', obj: 'فرمانده دشمن را شکست بده', objEn: 'Defeat the enemy commander',
    par: 480, reward: 3000, xp: 700, bonus: { type: 'headshots', n: 8, fa: 'هشت ضربهٔ سر بزن', en: 'Land 8 headshots' },
  },
];
MISSIONS[0].music = undefined;
