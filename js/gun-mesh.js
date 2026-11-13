'use strict';
/* مدل سه‌بعدی HK G3 (از مدل GLB، سبک‌شده با tools/prep-gun.js) به‌صورت مش GPU ثابت؛ با همان خط لولهٔ اسکین (یک استخوان = ماتریس سلاح) رسم می‌شود */
const GunMesh = (() => {
  const G = { ready: false, failed: false, meshes: {} };
  const gam = (c) => Math.pow(c, 0.45);
  G.load = async function (key, url) {
    try {
      const d = await fetch(url).then((r) => { if (!r.ok) throw new Error('gun ' + r.status); return r.json(); });
      const b64 = (s, T) => { const raw = atob(s), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i); return new T(u8.buffer); };
      const prims = d.parts.map((p) => {
        const v = b64(p.v, Float32Array), n = v.length / 6, out = new Float32Array(n * 16);
        for (let i = 0; i < n; i++) { out.set(v.subarray(i * 6, i * 6 + 6), i * 16); out[i * 16 + 12] = 1; }   // pos3 nor3 uv2(0) joints4(0) weights4(1,0,0,0)
        return { verts: out, idx: b64(p.i, Uint16Array), mat: { tex: -1, color: [gam(p.color[0]), gam(p.color[1]), gam(p.color[2]), 1], double: false } };
      });
      G.meshes[key] = GE.skinCreate({ nUsed: 1, prims }, {}, {});
      G.ready = true;
    } catch (err) { G.failed = true; window.__gunError = String(err && err.message || err); console.warn('gun mesh unavailable:', err); }
  };
  const bones = new Float32Array(12);
  /* ox,oy,oz: انتقال در فضای دید؛ rxg, ryg: چرخش حول X سپس Y (همانند put در drawViewmodel) */
  G.draw = function (key, ox, oy, oz, rxg, ryg, flash) {
    const m = G.meshes[key]; if (!m) return false;
    const ca = Math.cos(rxg), sa = Math.sin(rxg), cy = Math.cos(ryg), sy = Math.sin(ryg);
    bones.set([cy, sy * sa, sy * ca, ox, 0, ca, -sa, oy, -sy, cy * sa, cy * ca, oz]);
    GE.vmSkinQueue.push({ mesh: m, bones: bones.slice(), tint: [1, 1, 1], flash: flash || 0, alpha: 1 });
    return true;
  };
  return G;
})();
