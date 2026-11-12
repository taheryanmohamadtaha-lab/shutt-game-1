'use strict';
/* کاراکتر سه‌بعدی دشمنان (مدل GLB اسکلتی با انیمیشن) — در صورت بارگذاری نشدن، مدل جعبه‌ای قدیمی جایگزین می‌شود */
const EModel = (() => {
  const M = { ready: false, failed: false, mesh: null, sk: null, base: new Float32Array(16), tmpR: new Float32Array(16), tmpS: new Float32Array(16), tmpM: new Float32Array(16) };
  let poseA, poseB, poseC, Gm, handNode = -1;
  const TINT = {
    soldier: [1, 1, 1], sniper: [0.72, 0.85, 0.72], armored: [0.62, 0.7, 1.0], rusher: [1.3, 0.78, 0.78],
    heavy: [1.1, 1.0, 0.85], commander: [0.62, 0.5, 0.85], officer: [1.0, 0.92, 0.65], boss: [0.34, 0.34, 0.4],
  };

  async function load(url) {
    try {
      const model = await GLTF.load(url);
      const sk = model.buildSkinned();
      const images = {};
      const need = new Set(sk.prims.map((p) => p.mat.tex).filter((t) => t >= 0));
      await Promise.all([...need].map((t) => model.image(t).then((im) => { images[t] = im; })));
      M.images = images; M.texCache = {};
      M.mesh = GE.skinCreate(sk, images, M.texCache);
      M.sk = sk;
      poseA = GLTF.newPose(sk.N); poseB = GLTF.newPose(sk.N); poseC = GLTF.newPose(sk.N);
      Gm = new Float32Array(sk.N * 16);
      handNode = sk.names.hand_r !== undefined ? sk.names.hand_r : -1;
      M.ready = true;
    } catch (err) {
      M.failed = true; window.__modelError = String(err && err.message || err);
      console.warn('enemy model unavailable, using boxes:', err);
    }
  }

  /* ماتریس پایه: T(x,y,z) · Ry(yaw) · Rx(fall) · Ry(π) · S(size)  — مدل رو به +Z ساخته شده، بازی رو به −Z */
  function baseMatrix(e, fall, out) {
    const s = e.size, cy = Math.cos(e.yaw), sy = Math.sin(e.yaw), ca = Math.cos(fall), sa = Math.sin(fall);
    // ستون‌ها: Ry(yaw)·Rx(fall)·Ry(π)·S
    // Ry(π)·S: x→-x*s, y→y*s, z→-z*s
    const a0 = -s, a5 = s, a10 = -s;
    // Rx(fall): y' = y*ca - z*sa ; z' = y*sa + z*ca
    // ستون X: (a0,0,0) → (a0, 0, 0)
    // ستون Y: (0,a5,0) → (0, a5*ca, a5*sa)
    // ستون Z: (0,0,a10) → (0, -a10*sa, a10*ca)
    const c0 = [a0, 0, 0], c1 = [0, a5 * ca, a5 * sa], c2 = [0, -a10 * sa, a10 * ca];
    const R = (v) => [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy];   // Ry(yaw)
    const x = R(c0), y = R(c1), z = R(c2);
    out.set([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, e.x, e.y + (fall ? 0.12 : 0), e.z, 1]);
    return out;
  }

  function draw(e, batch, fade) {
    const sk = M.sk, clips = sk.clips, now = performance.now() / 1000;
    const a = e._an || (e._an = { w: 0, lp: e.legPhase, t0: Math.random() * 5, last: now, bones: new Float32Array(sk.nUsed * 12), idleT: 0 });
    const dt = Math.min(0.1, now - a.last); a.last = now;
    const moving = !e.dead && Math.abs(e.legPhase - a.lp) > 1e-4;
    a.lp = e.legPhase;
    a.w += ((moving ? 1 : 0) - a.w) * Math.min(1, dt * 9);
    a.idleT += dt;
    const crouch = e.crouched;
    const idle = clips[crouch ? 'Crouch_Idle' : 'Idle'];
    const walkName = crouch ? 'Crouch_Walk_InPlace' : (e.d.speed > 4 ? 'Sprint_InPlace' : 'Walk_InPlace');
    const walk = clips[walkName];
    GLTF.samplePose(sk, idle, a.t0 + a.idleT, poseA);
    let P = poseA;
    if (a.w > 0.02 && walk) {
      const cyc = e.legPhase / (Math.PI * 2) * (walkName === 'Sprint_InPlace' ? 0.6 : walkName === 'Walk_InPlace' ? 0.85 : 0.7);
      GLTF.samplePose(sk, walk, cyc * walk.dur, poseB);
      GLTF.blendPose(poseA, poseB, a.w, poseC, sk.N); P = poseC;
    }
    const fall = e.dead ? Math.min(1, e.deadT / 0.55) * 1.45 : 0;
    baseMatrix(e, fall, M.base);
    GLTF.globals(sk, P, M.base, Gm);
    GLTF.packBones(sk, Gm, a.bones);
    const tn = TINT[e.type] || TINT.soldier;
    GE.skinQueue.push({ mesh: M.mesh, bones: a.bones, tint: tn, flash: e.flash * 0.55, alpha: fade });
    /* سلاح در دست راست */
    if (!e.dead && handNode >= 0) {
      const d = e.d, s = e.size;
      const hx = Gm[handNode * 16 + 12], hy = Gm[handNode * 16 + 13], hz = Gm[handNode * 16 + 14];
      const gl = (d.longGun ? 0.95 : (e.type === 'heavy' || d.boss ? 0.8 : 0.62)) * s;
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      const cxg = hx + fx * (gl / 2 - 0.12 * s), czg = hz + fz * (gl / 2 - 0.12 * s);
      batch.box(cxg, hy, czg, 0.08 * s, 0.1 * s, gl, e.yaw, 0, [0.08, 0.08, 0.09], fade, 0, 0);
      if (e.flashT > 0) batch.box(hx + fx * (gl + 0.05 * s), hy, hz + fz * (gl + 0.05 * s), 0.16, 0.16, 0.2, e.yaw, 0, [1, 0.85, 0.4], 1, 2, 0);
    }
  }

  M.load = load; M.draw = draw;
  return M;
})();
