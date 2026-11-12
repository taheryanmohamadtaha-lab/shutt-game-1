'use strict';
/* بازوهای اول‌شخص: فقط مش «Heavy_Hands» از همان مدل GLB دشمنان، با IK دوبازویی تا دست‌ها روی سلاح بنشینند.
   اگر مدل بارگذاری نشود، دستکش‌های جعبه‌ای قدیمی کشیده می‌شوند. */
const Arms = (() => {
  const A = { ready: false, tried: false, mesh: null };
  const CFG = {
    scale: 0.5,                        // مقیاس مدل نسبت به اندازهٔ اصلی
    reach: 1.5,                        // کشیدگی طول بازو و ساعد (دست‌ها نسبت به سلاح کوچک خیلی دور نشوند)
    shoulder: [0.0, -0.3, -0.05],      // مرکز دو شانه در فضای دید (دوربین در مبدأ)
    rWrist: [0.0, -0.03, 0.075],       // جابه‌جایی مچ راست نسبت به نقطهٔ دستگیره (فضای سلاح)
    lWrist: [0.0, -0.035, 0.075],
    rollR: 0, rollL: 0,                // چرخش اضافه دور محور انگشتان (رادیان)
    fingR: [0.0, 0.0, -1], fingL: [0.0, 0.0, -1],
  };
  A.cfg = CFG;
  let sk, N, ids = {}, sub = null, Gm, poseA, bones, tint = [1.05, 1.0, 0.98];

  function build() {
    A.tried = true;
    try {
      sk = EModel.sk; N = sk.N;
      const prims = sk.prims.filter((p) => p.name === 'Heavy_Hands');
      if (!prims.length) throw new Error('Heavy_Hands not found');
      A.mesh = GE.skinCreate(Object.assign({}, sk, { prims }), EModel.images, EModel.texCache);
      for (const k of ['upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'middle_01_r', 'middle_01_l', 'clavicle_r', 'clavicle_l']) {
        if (sk.names[k] === undefined) throw new Error('bone ' + k);
        ids[k] = sk.names[k];
      }
      /* زیردرخت هر استخوان برای چرخاندن دست و بازو */
      const kids = Array.from({ length: N }, () => []);
      for (let i = 0; i < N; i++) if (sk.parent[i] >= 0) kids[sk.parent[i]].push(i);
      sub = {};
      for (const k of ['upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l']) {
        const out = [], st = [ids[k]];
        while (st.length) { const n = st.pop(); out.push(n); st.push(...kids[n]); }
        sub[k] = out;
      }
      Gm = new Float32Array(N * 16); poseA = GLTF.newPose(N); bones = new Float32Array(sk.nUsed * 12);
      A.ready = true;
    } catch (err) { A.failed = true; window.__armsError = String(err && err.message || err); console.warn('arms unavailable:', err); }
  }

  const P = (i) => [Gm[i * 16 + 12], Gm[i * 16 + 13], Gm[i * 16 + 14]];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* ماتریس چرخش ۳×۳ (محور-زاویه، ستونی) */
  function axisAngle(ax, ang) {
    const [x, y, z] = nrm(ax), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, t * x * y - s * z, t * y * y + c, t * y * z + s * x, t * x * z + s * y, t * y * z - s * x, t * z * z + c];
  }
  function fromTo(a, b) {
    a = nrm(a); b = nrm(b);
    const d = Math.max(-1, Math.min(1, dot(a, b)));
    let ax = cross(a, b);
    if (len(ax) < 1e-6) { if (d > 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1]; ax = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]); }
    return axisAngle(ax, Math.acos(d));
  }
  /* اعمال چرخش R حول نقطهٔ c روی همهٔ گره‌های زیردرخت */
  function rotSub(list, R, c) {
    for (const n of list) {
      const o = n * 16;
      for (let col = 0; col < 3; col++) {
        const x = Gm[o + col * 4], y = Gm[o + col * 4 + 1], z = Gm[o + col * 4 + 2];
        Gm[o + col * 4] = R[0] * x + R[3] * y + R[6] * z; Gm[o + col * 4 + 1] = R[1] * x + R[4] * y + R[7] * z; Gm[o + col * 4 + 2] = R[2] * x + R[5] * y + R[8] * z;
      }
      const x = Gm[o + 12] - c[0], y = Gm[o + 13] - c[1], z = Gm[o + 14] - c[2];
      Gm[o + 12] = R[0] * x + R[3] * y + R[6] * z + c[0]; Gm[o + 13] = R[1] * x + R[4] * y + R[7] * z + c[1]; Gm[o + 14] = R[2] * x + R[5] * y + R[8] * z + c[2];
    }
  }

  /* IK دوبازویی: مچ به نقطهٔ T می‌رسد؛ آرنج به‌سمت pole خم می‌شود؛ انگشتان به‌سمت fingDir */
  function solve(side, T, pole, fingDir, roll) {
    const up = 'upperarm_' + side, lo = 'lowerarm_' + side, hd = 'hand_' + side;
    const S = P(ids[up]);
    let E = P(ids[lo]), W = P(ids[hd]);
    const L1 = len(sub3(E, S)), L2 = len(sub3(W, E));
    let d = sub3(T, S), D = len(d); const dh = nrm(d);
    const Dc = Math.min(Math.max(D, Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
    const a = (L1 * L1 - L2 * L2 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let pv = sub3(pole, [dh[0] * dot(pole, dh), dh[1] * dot(pole, dh), dh[2] * dot(pole, dh)]); pv = nrm(pv);
    const E2 = [S[0] + dh[0] * a + pv[0] * h, S[1] + dh[1] * a + pv[1] * h, S[2] + dh[2] * a + pv[2] * h];
    rotSub(sub[up], fromTo(sub3(E, S), sub3(E2, S)), S);
    E = P(ids[lo]); W = P(ids[hd]);
    const Wt = [S[0] + dh[0] * Dc, S[1] + dh[1] * Dc, S[2] + dh[2] * Dc];
    rotSub(sub[lo], fromTo(sub3(W, E), sub3(Wt, E)), E);
    /* جهت انگشتان */
    W = P(ids[hd]);
    const f = sub3(P(ids['middle_01_' + side]), W);
    rotSub(sub[hd], fromTo(f, fingDir), W);
    if (roll) rotSub(sub[hd], axisAngle(fingDir, roll), W);
  }

  /* gunToView(x,y,z) → نقطه در فضای دید، gunDirToView(x,y,z) → بردار؛ g: مختصات دستگیره‌ها در فضای سلاح */
  A.draw = function (gunToView, gunDirToView, rGrip, lGrip) {
    if (!A.tried && EModel.ready) build();
    if (!A.ready) return false;
    if (P.ads > 0.45) return true;            // در حالت نشانه‌گیری بازوها جلوی دید را نگیرند
    const s = CFG.scale, clips = sk.clips;
    GLTF.samplePose(sk, clips.Idle, 0, poseA);
    for (const k of ['lowerarm_r', 'hand_r', 'lowerarm_l', 'hand_l']) for (let c = 0; c < 3; c++) poseA.T[ids[k] * 3 + c] *= CFG.reach;
    /* پایه: Ry(π)·S → مدل رو به −Z؛ سپس انتقال تا مرکز شانه‌ها روی نقطهٔ ثابت بنشیند */
    const base = new Float32Array([-s, 0, 0, 0, 0, s, 0, 0, 0, 0, -s, 0, 0, 0, 0, 1]);
    GLTF.globals(sk, poseA, base, Gm);
    const cr = P(ids.clavicle_r), cl = P(ids.clavicle_l);
    const dx = CFG.shoulder[0] - (cr[0] + cl[0]) / 2, dy = CFG.shoulder[1] - (cr[1] + cl[1]) / 2, dz = CFG.shoulder[2] - (cr[2] + cl[2]) / 2;
    for (let i = 0; i < N; i++) { Gm[i * 16 + 12] += dx; Gm[i * 16 + 13] += dy; Gm[i * 16 + 14] += dz; }
    const tr = gunToView(rGrip[0] + CFG.rWrist[0], rGrip[1] + CFG.rWrist[1], rGrip[2] + CFG.rWrist[2]);
    const tl = gunToView(lGrip[0] + CFG.lWrist[0], lGrip[1] + CFG.lWrist[1], lGrip[2] + CFG.lWrist[2]);
    solve('r', tr, [0.6, -1, 0.5], nrm(gunDirToView(CFG.fingR[0], CFG.fingR[1], CFG.fingR[2])), CFG.rollR);
    solve('l', tl, [-0.6, -1, 0.5], nrm(gunDirToView(CFG.fingL[0], CFG.fingL[1], CFG.fingL[2])), CFG.rollL);
    A.dbg = { tr, tl, hr: P(ids.hand_r), hl: P(ids.hand_l), er: P(ids.lowerarm_r), el: P(ids.lowerarm_l) };
    GLTF.packBones(sk, Gm, bones);
    GE.vmSkinQueue.push({ mesh: A.mesh, bones, tint, flash: 0, alpha: 1 });
    return true;
  };
  return A;
})();
