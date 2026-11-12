'use strict';
/* محیط «دره جنگلی»: مدل GLB زمین جنگل → نقشهٔ ارتفاع (قابل راه رفتن) + درخت/سنگ/بوته به‌صورت هندسهٔ ایستا + برخورد */
const Forest = (() => {
  const F = { ready: false, failed: false, model: null };

  async function load(url) {
    try { F.model = await GLTF.load(url); F.ready = true; }
    catch (err) { F.failed = true; window.__forestError = String(err && err.message || err); console.warn('forest model unavailable:', err); }
  }

  /* نقشهٔ ارتفاع با رسترایز مثلث‌های زمین */
  function heightmap(tris, res) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const t of tris) for (const v of t) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
    const nx = Math.ceil((x1 - x0) / res) + 1, nz = Math.ceil((z1 - z0) / res) + 1;
    const H = new Float32Array(nx * nz).fill(NaN);
    for (const [a, b, c] of tris) {
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / res)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / res));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) / res)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - z0) / res));
      const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(den) < 1e-9) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = x0 + i * res, pz = z0 + j * res;
        const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den;
        const l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
        H[j * nx + i] = l1 * a[1] + l2 * b[1] + l3 * c[1];
      }
    }
    for (let k = 0; k < H.length; k++) if (isNaN(H[k])) H[k] = 30;     // بیرون از نقشه = دیوار
    return {
      x0, z0, nx, nz, res, x1, z1,
      h(x, z) {
        let fx = (x - x0) / res, fz = (z - z0) / res;
        if (fx < 0 || fz < 0 || fx > nx - 1.001 || fz > nz - 1.001) return 30;
        const i = fx | 0, j = fz | 0; fx -= i; fz -= j;
        const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
        return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
      },
    };
  }

  F.load = load;
  F.build = function () {
    const M = F.model;
    // مرکز نقشه را به مبدأ می‌بریم
    const raw = M.triangles('Forest_Terrain', 0, 0);
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const t of raw) for (const v of t) { a0 = Math.min(a0, v[0]); a1 = Math.max(a1, v[0]); b0 = Math.min(b0, v[2]); b1 = Math.max(b1, v[2]); }
    const ox = -(a0 + a1) / 2, oz = -(b0 + b1) / 2;
    const tris = raw.map((t) => t.map((v) => [v[0] + ox, v[1], v[2] + oz]));
    const T = heightmap(tris, 0.5);
    const half = Math.ceil(Math.max(a1 - a0, b1 - b0) / 2) + 1;

    const L = new Level(ENVS.valley, half, 101);
    L.batch = new GE.Batch(330000);
    L.terrain = T;
    const deco = new GE.Batch(330000);
    const info = M.bakeStatic(deco, {
      ox, oz,
      mat: (nm) => (nm === 'Forest_Terrain' ? 1 : 0),
      color: (nm, r, g, b) => (nm === 'Forest_Terrain' ? [r * 1.1, g * 1.1, b * 1.1] : [r * 1.05, g * 1.05, b * 1.05]),
    });
    L.deco = deco;
    /* برخورد اشیا */
    for (const r of info) {
      const nm = r.name.split('.')[0];
      const gy = Math.max(0, T.h(r.cx, r.cz));
      if (nm === 'Tree') L.add(r.cx - 0.38, 0, r.cz - 0.38, r.cx + 0.38, gy + 6, r.cz + 0.38, [0.3, 0.2, 0.1], { hidden: true, kind: 'tree' });
      else if (nm === 'Stump') L.add(r.cx - 0.5, 0, r.cz - 0.5, r.cx + 0.5, gy + 1.6, r.cz + 0.5, [0.3, 0.2, 0.1], { hidden: true });
      else if (/^Rock_/.test(nm)) {
        const sx = (r.maxX - r.minX) * 0.36, sz = (r.maxZ - r.minZ) * 0.36, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
        L.add(cx - sx, 0, cz - sz, cx + sx, r.maxY - 0.1, cz + sz, [0.4, 0.4, 0.4], { hidden: true, kind: 'rock' });
      } else if (nm === 'Fence') {
        const sx = (r.maxX - r.minX) * 0.4, sz = (r.maxZ - r.minZ) * 0.4, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
        L.add(cx - sx, 0, cz - sz, cx + sx, r.maxY, cz + sz, [0.4, 0.3, 0.2], { hidden: true });
      }
    }
    F.stats = { verts: deco.n, tris: deco.n / 3 | 0, colliders: L.boxes.length, half, ox, oz };
    return L;
  };
  return F;
})();
