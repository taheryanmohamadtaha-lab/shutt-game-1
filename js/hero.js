'use strict';
/* شخصیت اصلی بازی (کریس): مدل ثابت GLB با بافت؛ در صحنهٔ منوی اصلی نمایش داده می‌شود.
   (مدل اسکلت ندارد، پس برای بازوهای اول‌شخص از بازوهای انیمیشنی مدل Heavy استفاده می‌شود.) */
const Hero = (() => {
  const H = { ready: false, failed: false, height: 1.85, yawOffset: 0 };
  H.load = async function (url) {
    try {
      const model = await GLTF.load(url), j = model.j;
      const W = new Float32Array(16), prims = [];
      let minY = 1e9, maxY = -1e9;
      const raw = [];
      j.nodes.forEach((n, ni) => {
        if (n.mesh === undefined) return;
        model.worldMatrix(ni, W);
        for (const p of j.meshes[n.mesh].primitives) {
          const pos = model.acc(p.attributes.POSITION, true), nor = model.acc(p.attributes.NORMAL, true), uv = model.acc(p.attributes.TEXCOORD_0, true);
          const c = pos.count, vb = new Float32Array(c * 16);
          for (let v = 0; v < c; v++) {
            const x = pos.data[v * 3], y = pos.data[v * 3 + 1], z = pos.data[v * 3 + 2];
            const wx = W[0] * x + W[4] * y + W[8] * z + W[12], wy = W[1] * x + W[5] * y + W[9] * z + W[13], wz = W[2] * x + W[6] * y + W[10] * z + W[14];
            const a = nor.data[v * 3], b = nor.data[v * 3 + 1], d = nor.data[v * 3 + 2];
            vb[v * 16] = wx; vb[v * 16 + 1] = wy; vb[v * 16 + 2] = wz;
            vb[v * 16 + 3] = W[0] * a + W[4] * b + W[8] * d; vb[v * 16 + 4] = W[1] * a + W[5] * b + W[9] * d; vb[v * 16 + 5] = W[2] * a + W[6] * b + W[10] * d;
            vb[v * 16 + 6] = uv.data[v * 2]; vb[v * 16 + 7] = uv.data[v * 2 + 1]; vb[v * 16 + 12] = 1;
            if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
          }
          raw.push({ vb, idx: model.acc(p.indices).data, mat: model.material(p.material) });
        }
      });
      const s = H.height / (maxY - minY);
      const images = {};
      for (const r of raw) {
        for (let v = 0; v < r.vb.length / 16; v++) { r.vb[v * 16] *= s; r.vb[v * 16 + 1] = (r.vb[v * 16 + 1] - minY) * s; r.vb[v * 16 + 2] *= s; }
        if (r.mat.tex >= 0 && !images[r.mat.tex]) images[r.mat.tex] = await model.image(r.mat.tex);
        prims.push({ verts: r.vb, idx: r.idx, mat: { tex: r.mat.tex, color: [1, 1, 1, 1], double: true } });
      }
      H.mesh = GE.skinCreate({ nUsed: 1, prims }, images, {});
      H.ready = true;
    } catch (err) { H.failed = true; window.__heroError = String(err && err.message || err); console.warn('hero model unavailable:', err); }
  };
  const bones = new Float32Array(12);
  H.draw = function (x, y, z, yaw) {
    if (!H.ready) return;
    const c = Math.cos(yaw + H.yawOffset), s = Math.sin(yaw + H.yawOffset);
    bones.set([c, 0, s, x, 0, 1, 0, y, -s, 0, c, z]);
    GE.skinQueue.push({ mesh: H.mesh, bones: bones.slice(), tint: [1, 1, 1], flash: 0, alpha: 1 });
  };
  return H;
})();
