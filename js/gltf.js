'use strict';
/* لودر GLB (glTF 2.0 باینری) + پخش انیمیشن اسکلتی — بدون وابستگی خارجی
   - مدل ایستا (محیط): هندسه با ماتریس جهان به Batch ریخته می‌شود
   - مدل اسکلتی (کاراکتر): دادهٔ رأس‌ها، اسکلت و انیمیشن‌ها برای رندر GPU آماده می‌شود */
const GLTF = (() => {
  const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

  /* ---------- ماتریس‌ها (ستونی، مثل WebGL) ---------- */
  function ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; }
  function mul(a, b, o) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function compose(t, q, s, o) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    o[0] = (1 - (yy + zz)) * s[0]; o[1] = (xy + wz) * s[0]; o[2] = (xz - wy) * s[0]; o[3] = 0;
    o[4] = (xy - wz) * s[1]; o[5] = (1 - (xx + zz)) * s[1]; o[6] = (yz + wx) * s[1]; o[7] = 0;
    o[8] = (xz + wy) * s[2]; o[9] = (yz - wx) * s[2]; o[10] = (1 - (xx + yy)) * s[2]; o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
    return o;
  }
  function slerp(a, ai, b, bi, f, o, oi) {
    let ax = a[ai], ay = a[ai + 1], az = a[ai + 2], aw = a[ai + 3];
    let bx = b[bi], by = b[bi + 1], bz = b[bi + 2], bw = b[bi + 3];
    let d = ax * bx + ay * by + az * bz + aw * bw;
    if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0, s1;
    if (d > 0.9995) { s0 = 1 - f; s1 = f; } else {
      const th = Math.acos(d), sn = Math.sin(th);
      s0 = Math.sin((1 - f) * th) / sn; s1 = Math.sin(f * th) / sn;
    }
    const x = ax * s0 + bx * s1, y = ay * s0 + by * s1, z = az * s0 + bz * s1, w = aw * s0 + bw * s1;
    const l = Math.hypot(x, y, z, w) || 1;
    o[oi] = x / l; o[oi + 1] = y / l; o[oi + 2] = z / l; o[oi + 3] = w / l;
  }

  class Model {
    constructor(json, bin) {
      this.j = json; this.bin = bin; this._acc = {};
      this.scene = (json.scenes && json.scenes[json.scene || 0] || { nodes: [] }).nodes;
      this.parent = new Int32Array(json.nodes.length).fill(-1);
      json.nodes.forEach((n, i) => (n.children || []).forEach((c) => { this.parent[c] = i; }));
    }
    /* خواندن accessor به‌صورت آرایهٔ فشرده؛ normalized → float */
    acc(i, asFloat) {
      const key = i + (asFloat ? 'f' : '');
      if (this._acc[key]) return this._acc[key];
      const a = this.j.accessors[i], nc = NC[a.type], T = CT[a.componentType];
      const bv = this.j.bufferViews[a.bufferView];
      const base = this.bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
      const es = T.BYTES_PER_ELEMENT, stride = bv.byteStride || nc * es;
      let out;
      if (stride === nc * es && base % es === 0) out = new T(this.bin.buffer, base, a.count * nc).slice();
      else {
        out = new T(a.count * nc);
        const dv = new DataView(this.bin.buffer);
        for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) {
          const off = base + k * stride + c * es;
          out[k * nc + c] = es === 1 ? (T === Int8Array ? dv.getInt8(off) : dv.getUint8(off)) : es === 2 ? (T === Int16Array ? dv.getInt16(off, true) : dv.getUint16(off, true)) : (T === Uint32Array ? dv.getUint32(off, true) : dv.getFloat32(off, true));
        }
      }
      if (asFloat && T !== Float32Array) {
        const f = new Float32Array(out.length), d = a.normalized ? NORM[a.componentType] : 1;
        for (let k = 0; k < out.length; k++) f[k] = out[k] / d;
        out = f;
      }
      const r = { data: out, count: a.count, nc };
      this._acc[key] = r; return r;
    }
    localMatrix(n, o) {
      if (n.matrix) { for (let k = 0; k < 16; k++) o[k] = n.matrix[k]; return o; }
      return compose(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1], o);
    }
    worldMatrix(i, o) {
      const chain = []; for (let k = i; k >= 0; k = this.parent[k]) chain.push(k);
      ident(o); const t = new Float32Array(16), l = new Float32Array(16);
      for (let k = chain.length - 1; k >= 0; k--) { this.localMatrix(this.j.nodes[chain[k]], l); mul(o, l, t); o.set(t); }
      return o;
    }
    material(i) {
      const m = i === undefined ? null : this.j.materials[i];
      const pbr = (m && m.pbrMetallicRoughness) || {};
      return { color: pbr.baseColorFactor || [1, 1, 1, 1], tex: pbr.baseColorTexture ? pbr.baseColorTexture.index : -1, double: !!(m && m.doubleSided) };
    }
    /* تصویر بافت index (از bufferView) → Promise<HTMLImageElement> */
    image(texIndex) {
      const t = this.j.textures[texIndex], im = this.j.images[t.source];
      const bv = this.j.bufferViews[im.bufferView];
      const bytes = new Uint8Array(this.bin.buffer, this.bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
      const url = URL.createObjectURL(new Blob([bytes], { type: im.mimeType || 'image/png' }));
      return new Promise((res, rej) => { const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = rej; img.src = url; });
    }

    /* ===== مدل ایستا: ریختن همهٔ مش‌ها در Batch ===== */
    bakeStatic(batch, opt) {
      opt = opt || {};
      const W = new Float32Array(16), info = [];
      const ox = opt.ox || 0, oz = opt.oz || 0;
      this.j.nodes.forEach((n, ni) => {
        if (n.mesh === undefined || n.skin !== undefined) return;
        this.worldMatrix(ni, W);
        const nm = n.name || '';
        let skip = false;
        if (opt.filter && !opt.filter(nm, n)) skip = true;
        if (skip) return;
        const mesh = this.j.meshes[n.mesh];
        const rec = { name: nm, mesh: n.mesh, minY: 1e9, maxY: -1e9, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, cx: W[12] + ox, cy: W[13], cz: W[14] + oz, sy: Math.hypot(W[4], W[5], W[6]) };
        for (const p of mesh.primitives) {
          const pos = this.acc(p.attributes.POSITION, true), nor = p.attributes.NORMAL !== undefined ? this.acc(p.attributes.NORMAL, true) : null;
          const col = p.attributes.COLOR_0 !== undefined ? this.acc(p.attributes.COLOR_0, true) : null;
          const mat = this.material(p.material);
          const idx = p.indices !== undefined ? this.acc(p.indices).data : null;
          const cnt = idx ? idx.length : pos.count;
          for (let k = 0; k < cnt; k++) {
            const v = idx ? idx[k] : k;
            const px = pos.data[v * 3], py = pos.data[v * 3 + 1], pz = pos.data[v * 3 + 2];
            const wx = W[0] * px + W[4] * py + W[8] * pz + W[12] + ox;
            const wy = W[1] * px + W[5] * py + W[9] * pz + W[13];
            const wz = W[2] * px + W[6] * py + W[10] * pz + W[14] + oz;
            let nx = 0, ny = 1, nz = 0;
            if (nor) {
              const a = nor.data[v * 3], b = nor.data[v * 3 + 1], c = nor.data[v * 3 + 2];
              nx = W[0] * a + W[4] * b + W[8] * c; ny = W[1] * a + W[5] * b + W[9] * c; nz = W[2] * a + W[6] * b + W[10] * c;
              const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
            }
            let r = mat.color[0], g = mat.color[1], b2 = mat.color[2];
            if (col) { r *= col.data[v * col.nc]; g *= col.data[v * col.nc + 1]; b2 *= col.data[v * col.nc + 2]; }
            if (opt.color) { const c = opt.color(nm, r, g, b2, wy); r = c[0]; g = c[1]; b2 = c[2]; }
            batch.vert(wx, wy, wz, nx, ny, nz, r, g, b2, 1, typeof opt.mat === 'function' ? opt.mat(nm) : (opt.mat || 0));
            if (wy < rec.minY) rec.minY = wy; if (wy > rec.maxY) rec.maxY = wy;
            if (wx < rec.minX) rec.minX = wx; if (wx > rec.maxX) rec.maxX = wx;
            if (wz < rec.minZ) rec.minZ = wz; if (wz > rec.maxZ) rec.maxZ = wz;
          }
        }
        info.push(rec);
      });
      return info;
    }
    /* همهٔ مثلث‌های یک مش (فضای جهان) برای ساخت نقشهٔ ارتفاع */
    triangles(nodeName, ox, oz) {
      const W = new Float32Array(16), out = [];
      this.j.nodes.forEach((n, ni) => {
        if (n.mesh === undefined || n.name !== nodeName) return;
        this.worldMatrix(ni, W);
        for (const p of this.j.meshes[n.mesh].primitives) {
          const pos = this.acc(p.attributes.POSITION, true), idx = this.acc(p.indices).data;
          const tf = (v) => [W[0] * pos.data[v * 3] + W[4] * pos.data[v * 3 + 1] + W[8] * pos.data[v * 3 + 2] + W[12] + (ox || 0), W[1] * pos.data[v * 3] + W[5] * pos.data[v * 3 + 1] + W[9] * pos.data[v * 3 + 2] + W[13], W[2] * pos.data[v * 3] + W[6] * pos.data[v * 3 + 1] + W[10] * pos.data[v * 3 + 2] + W[14] + (oz || 0)];
          for (let k = 0; k < idx.length; k += 3) out.push([tf(idx[k]), tf(idx[k + 1]), tf(idx[k + 2])]);
        }
      });
      return out;
    }

    /* ===== مدل اسکلتی ===== */
    buildSkinned() {
      const j = this.j, skin = j.skins[0], nj = skin.joints.length;
      const ibmAll = this.acc(skin.inverseBindMatrices).data;
      /* مرتب‌سازی گره‌ها: والد قبل از فرزند */
      const order = [], seen = new Uint8Array(j.nodes.length);
      const visit = (i) => { if (seen[i]) return; seen[i] = 1; order.push(i); (j.nodes[i].children || []).forEach(visit); };
      this.scene.forEach(visit);
      /* پریمیتیوها و مصرف مفصل‌ها */
      const used = new Map(); const prims = [];
      j.nodes.forEach((n) => {
        if (n.mesh === undefined || n.skin === undefined) return;
        for (const p of j.meshes[n.mesh].primitives) {
          const pos = this.acc(p.attributes.POSITION, true), nor = this.acc(p.attributes.NORMAL, true), uv = this.acc(p.attributes.TEXCOORD_0, true);
          const J = this.acc(p.attributes.JOINTS_0).data, Wt = this.acc(p.attributes.WEIGHTS_0, true).data;
          const n4 = pos.count, vb = new Float32Array(n4 * 16);
          for (let v = 0; v < n4; v++) {
            vb.set(pos.data.subarray(v * 3, v * 3 + 3), v * 16); vb.set(nor.data.subarray(v * 3, v * 3 + 3), v * 16 + 3);
            vb[v * 16 + 6] = uv.data[v * 2]; vb[v * 16 + 7] = uv.data[v * 2 + 1];
            for (let c = 0; c < 4; c++) {
              const w = Wt[v * 4 + c]; let ji = J[v * 4 + c];
              if (w <= 0.0001) { vb[v * 16 + 8 + c] = 0; vb[v * 16 + 12 + c] = 0; continue; }
              if (!used.has(ji)) used.set(ji, used.size);
              vb[v * 16 + 8 + c] = used.get(ji); vb[v * 16 + 12 + c] = w;
            }
          }
          prims.push({ verts: vb, idx: this.acc(p.indices).data, mat: this.material(p.material), name: n.name });
        }
      });
      const usedList = []; used.forEach((u, ji) => { usedList[u] = ji; });
      /* انیمیشن‌ها */
      const clips = {};
      for (const a of j.animations || []) {
        const ch = a.channels.map((c) => {
          const s = a.samplers[c.sampler];
          return { node: c.target.node, path: c.target.path, t: this.acc(s.input).data, v: this.acc(s.output, true).data };
        });
        let dur = 0; ch.forEach((c) => { dur = Math.max(dur, c.t[c.t.length - 1]); });
        clips[a.name] = { ch, dur };
      }
      const N = j.nodes.length;
      const rest = { T: new Float32Array(N * 3), R: new Float32Array(N * 4), S: new Float32Array(N * 3) };
      j.nodes.forEach((n, i) => {
        rest.T.set(n.translation || [0, 0, 0], i * 3); rest.R.set(n.rotation || [0, 0, 0, 1], i * 4); rest.S.set(n.scale || [1, 1, 1], i * 3);
      });
      const sk = {
        prims, clips, order, rest, N, nodes: j.nodes, parent: this.parent, joints: skin.joints, ibm: ibmAll, usedList, nUsed: usedList.length,
        names: {}, tmp: new Float32Array(16), tmp2: new Float32Array(16),
      };
      j.nodes.forEach((n, i) => { if (n.name) sk.names[n.name] = i; });
      return sk;
    }
  }

  /* ---------- نمونه‌برداری انیمیشن در زمان t (حلقه‌ای) → poseTRS ---------- */
  function samplePose(sk, clip, t, P) {
    P.T.set(sk.rest.T); P.R.set(sk.rest.R); P.S.set(sk.rest.S);
    if (!clip) return;
    const tt = clip.dur > 0 ? ((t % clip.dur) + clip.dur) % clip.dur : 0;
    for (const c of clip.ch) {
      const ts = c.t; let lo = 0, hi = ts.length - 1;
      if (tt >= ts[hi]) lo = hi; else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= tt) lo = m; else hi = m; } }
      const nx = Math.min(lo + 1, ts.length - 1);
      const f = nx === lo ? 0 : (tt - ts[lo]) / (ts[nx] - ts[lo]);
      const n = c.node;
      if (c.path === 'rotation') slerp(c.v, lo * 4, c.v, nx * 4, f, P.R, n * 4);
      else {
        const k = 3, arr = c.path === 'translation' ? P.T : P.S;
        for (let q = 0; q < 3; q++) arr[n * 3 + q] = c.v[lo * k + q] + (c.v[nx * k + q] - c.v[lo * k + q]) * f;
      }
    }
  }
  function blendPose(A, B, f, O, N) {
    for (let i = 0; i < N * 3; i++) { O.T[i] = A.T[i] + (B.T[i] - A.T[i]) * f; O.S[i] = A.S[i] + (B.S[i] - A.S[i]) * f; }
    for (let i = 0; i < N; i++) slerp(A.R, i * 4, B.R, i * 4, f, O.R, i * 4);
  }
  function newPose(N) { return { T: new Float32Array(N * 3), R: new Float32Array(N * 4), S: new Float32Array(N * 3) }; }

  /* ماتریس‌های جهانی گره‌ها از روی پوز؛ model: ماتریس پایه (جهان) */
  function globals(sk, P, base, G) {
    const l = sk.tmp;
    for (const i of sk.order) {
      compose([P.T[i * 3], P.T[i * 3 + 1], P.T[i * 3 + 2]], [P.R[i * 4], P.R[i * 4 + 1], P.R[i * 4 + 2], P.R[i * 4 + 3]], [P.S[i * 3], P.S[i * 3 + 1], P.S[i * 3 + 2]], l);
      const p = sk.parent[i];
      const out = G.subarray(i * 16, i * 16 + 16);
      if (p < 0) mul(base, l, out); else mul(G.subarray(p * 16, p * 16 + 16), l, out);
    }
  }
  /* بسته‌بندی ماتریس مفصل‌ها به‌صورت ۳ ردیف vec4 (ردیفی) برای شیدر */
  function packBones(sk, G, out) {
    const m = sk.tmp2;
    for (let u = 0; u < sk.nUsed; u++) {
      const ji = sk.usedList[u];
      mul(G.subarray(sk.joints[ji] * 16, sk.joints[ji] * 16 + 16), sk.ibm.subarray(ji * 16, ji * 16 + 16), m);
      const o = u * 12;
      for (let r = 0; r < 3; r++) { out[o + r * 4] = m[r]; out[o + r * 4 + 1] = m[4 + r]; out[o + r * 4 + 2] = m[8 + r]; out[o + r * 4 + 3] = m[12 + r]; }
    }
  }

  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('GLB ' + res.status + ' ' + url);
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
    let off = 12, json = null, bin = null;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004E4942) bin = new Uint8Array(buf, off + 8, len);
      off += 8 + len;
    }
    return new Model(json, bin);
  }

  return { load, Model, samplePose, blendPose, newPose, globals, packBones, compose, mul, ident };
})();
