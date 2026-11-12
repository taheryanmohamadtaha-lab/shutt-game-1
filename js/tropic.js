'use strict';
/* محیط «شهر ساحلی گرمسیری»: مدل GLB (ساختمان‌ها، نخل‌ها، وسایل) + نقشهٔ ارتفاع و جعبه‌های برخورد از پیش‌ساخته (tools/prep-tropic.js) */
const Tropic = (() => {
  const T = { ready: false, failed: false, model: null, map: null };

  async function load(glbUrl, mapUrl) {
    try {
      const [model, map] = await Promise.all([GLTF.load(glbUrl), fetch(mapUrl).then((r) => { if (!r.ok) throw new Error('map ' + r.status); return r.json(); })]);
      const raw = atob(map.h), u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      map.H = new Int16Array(u8.buffer);
      T.model = model; T.map = map; T.ready = true;
    } catch (err) { T.failed = true; window.__tropicError = String(err && err.message || err); console.warn('tropic model unavailable:', err); }
  }

  T.load = load;
  T.build = function (env) {
    const M = T.model, m = T.map, H = m.H, nx = m.nx, nz = m.nz, res = m.res;
    const L = new Level(env, m.half, 303);
    L.batch = new GE.Batch(260000);
    L.terrain = {
      h(x, z) {
        let fx = (x - m.x0) / res, fz = (z - m.z0) / res;
        if (fx < 0 || fz < 0 || fx > nx - 1.001 || fz > nz - 1.001) return 30;
        const i = fx | 0, j = fz | 0; fx -= i; fz -= j;
        const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
        return ((a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz) / 100;
      },
    };
    const deco = new GE.Batch(260000);
    M.bakeStatic(deco, { oy: m.yoff, mat: 0, color: (nm, r, g, b) => [r * 1.12, g * 1.12, b * 1.12] });
    L.deco = deco;
    for (const r of m.rects) L.add(r[0], r[4] - 0.3, r[1], r[2], r[5], r[3], [0.5, 0.45, 0.4], { hidden: true, kind: 'wall' });
    L.start = { x: m.start[0], z: m.start[1], yaw: 0 };
    L.spawnSpots = m.spawns;
    T.stats = { tris: deco.n / 3 | 0, colliders: L.boxes.length };
    return L;
  };
  return T;
})();
