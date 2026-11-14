'use strict';
/* کتابخانهٔ نقشه‌های GLB: مدل برش‌خوردهٔ سبک + نقشهٔ ارتفاع و جعبه‌های برخورد از پیش‌ساخته (tools/prep-map.js) */
const MapLib = (() => {
  const M = { defs: {} };
  /* رنگ‌دهی تکمیلی هر نقشه (روی رنگ میانگین بافت) */
  const TINT = {
    tropic: (r, g, b) => [r * 1.12, g * 1.12, b * 1.12],
    goldrush: (r, g, b) => [r * 1.25, g * 1.15, b * 1.0],
    glacier: (r, g, b) => [Math.min(1, r * 0.5 + 0.3), Math.min(1, g * 0.5 + 0.34), Math.min(1, b * 0.5 + 0.4)],
    planet: (r, g, b) => [r * 1.35, g * 0.9, b * 0.85],
    grotto: (r, g, b) => [r * 1.1, g * 1.1, b * 1.2],
  };

  M.load = async function (key, glbUrl, mapUrl) {
    const d = M.defs[key] = { ready: false, failed: false };
    try {
      const [model, map] = await Promise.all([GLTF.load(glbUrl), fetch(mapUrl).then((r) => { if (!r.ok) throw new Error('map ' + r.status); return r.json(); })]);
      const raw = atob(map.h), u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      map.H = new Int16Array(u8.buffer);
      d.model = model; d.map = map; d.ready = true;
    } catch (err) { d.failed = true; (window.__mapErrors = window.__mapErrors || {})[key] = String(err && err.message || err); console.warn('map unavailable:', key, err); }
  };
  M.ready = (key) => !!(M.defs[key] && M.defs[key].ready);

  M.build = function (key, env, seed) {
    const d = M.defs[key], m = d.map, H = m.H, nx = m.nx, nz = m.nz, res = m.res;
    const L = new Level(env, m.half, seed || 303);
    L.batch = new GE.Batch(260000);
    L.terrain = {
      h(x, z) {
        let fx = (x - m.x0) / res, fz = (z - m.z0) / res;
        if (fx < 0 || fz < 0 || fx > nx - 1.001 || fz > nz - 1.001) return 30;
        const i = fx | 0, j = fz | 0; fx -= i; fz -= j;
        const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d2 = H[(j + 1) * nx + i + 1];
        return ((a + (b - a) * fx) * (1 - fz) + (c + (d2 - c) * fx) * fz) / 100;
      },
    };
    const deco = new GE.Batch(260000);
    const tint = TINT[key] || ((r, g, b) => [r, g, b]);
    d.model.bakeStatic(deco, { oy: m.yoff, jitter: 0.003, mat: 0, color: (nm, r, g, b) => tint(r, g, b) });
    L.deco = deco;
    for (const r of m.rects) L.add(r[0], r[4] - 0.3, r[1], r[2], r[5], r[3], [0.5, 0.45, 0.4], { hidden: true, kind: 'wall' });
    L.start = { x: m.start[0], z: m.start[1], yaw: 0 };
    L.spawnSpots = m.spawns;
    L.mapKey = key;
    return L;
  };
  return M;
})();

/* سازگاری با کد قبلی */
const Tropic = { get ready() { return MapLib.ready('tropic'); }, build: (env) => MapLib.build('tropic', env, 303) };
