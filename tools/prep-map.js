/* ساخت نقشهٔ بازی از مدل‌های BBR2 (GLB یا glTF+bin):
   CX=.. CZ=.. HALF=.. MARGIN=.. SCALE=.. START=x,z SKIP=regex node prep-map.js in.glb|in.gltf colors.json outDir name
   خروجی: <name>.glb (برش‌خورده، رنگ‌های میانگین، بدون بافت) و <name>-map.json (ارتفاع زمین + جعبه‌های برخورد + نقاط ظهور) */
const fs = require('fs'), path = require('path');
const [, , inGlb, colFile, outDir, NAME = 'map'] = process.argv;
const E = (k, d) => (process.env[k] !== undefined ? +process.env[k] : d);
const SCALE = E('SCALE', 0.5), CX = E('CX', 70), CZ = E('CZ', 0), HALF = E('HALF', 110);  // مرکز و نیم‌اندازهٔ برش (واحد اصلی)
const MARGIN = E('MARGIN', 40);                           // تزئینات بیرون از دیوار
const SKIP = new RegExp(process.env.SKIP || '^$');
const RES = 0.5;
let j, bin;
if (inGlb.endsWith('.gltf')) { j = JSON.parse(fs.readFileSync(inGlb)); bin = fs.readFileSync(path.join(path.dirname(inGlb), j.buffers[0].uri)); }
else { const buf = fs.readFileSync(inGlb), jl = buf.readUInt32LE(12); j = JSON.parse(buf.slice(20, 20 + jl).toString()); bin = buf.slice(20 + jl + 8); }
const colors = JSON.parse(fs.readFileSync(colFile));

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const loc = (n) => { if (n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1]; const [x, y, z, w] = q;
  const m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
  for (let i = 0; i < 3; i++) { m[i] *= s[0]; m[4 + i] *= s[1]; m[8 + i] *= s[2]; } m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; };
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const tp = (W, x, y, z) => [W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]];

function acc(ai) {
  const a = j.accessors[ai], bv = j.bufferViews[a.bufferView];
  const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], ct = a.componentType;
  const sz = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[ct], stride = bv.byteStride || nc * sz;
  const out = new Float64Array(a.count * nc), base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < nc; k++) {
    const o = base + i * stride + k * sz; let v;
    if (ct === 5126) v = bin.readFloatLE(o); else if (ct === 5125) v = bin.readUInt32LE(o); else if (ct === 5123) v = bin.readUInt16LE(o); else if (ct === 5121) v = bin[o]; else if (ct === 5122) v = bin.readInt16LE(o); else v = bin.readInt8(o);
    out[i * nc + k] = v;
  }
  return { data: out, nc, count: a.count };
}

/* ---- ماتریس نهایی: مقیاس و جابه‌جایی به مبدأ (فضای y-up اصلی) ---- */
const F = [SCALE, 0, 0, 0, 0, SCALE, 0, 0, 0, 0, SCALE, 0, -CX * SCALE, 0, -CZ * SCALE, 1];
const keepNode = new Set(); const parent = {};
const inst = [];   // { ni, W (فضای اصلی) }
function visit(i, P, par) {
  const n = j.nodes[i]; const W = mul(P, loc(n)); parent[i] = par;
  if (n.mesh !== undefined) inst.push({ ni: i, W, name: n.name || '' });
  (n.children || []).forEach((c) => visit(c, W, i));
}
j.scenes[0].nodes.forEach((i) => visit(i, I, -1));

const matNames = (n) => j.meshes[n.mesh].primitives.map((p) => (j.materials[p.material] || {}).name || '').join('+');
const isUp = (nm, n) => /NPC|Parrot|Seagull|Animated|Penguin|Whale|UnderwaterBlocker|Forcefield/.test(nm + matNames(n)) || SKIP.test(nm + matNames(n));
const inBox = (x, z, m) => x >= CX - HALF - m && x <= CX + HALF + m && z >= CZ - HALF - m && z <= CZ + HALF + m;
function meshBounds(mi, W) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of j.meshes[mi].primitives) { const a = j.accessors[p.attributes.POSITION];
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) { const v = tp(W, cx ? a.max[0] : a.min[0], cy ? a.max[1] : a.min[1], cz ? a.max[2] : a.min[2]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } } }
  return { mn, mx };
}
const kept = [];
for (const it of inst) {
  if (isUp(it.name, j.nodes[it.ni])) continue;
  const b = meshBounds(j.nodes[it.ni].mesh, it.W);
  const cx = (b.mn[0] + b.mx[0]) / 2, cz = (b.mn[2] + b.mx[2]) / 2, sx = b.mx[0] - b.mn[0], sz = b.mx[2] - b.mn[2];
  const big = sx > 120 || sz > 120;     // قطعات بزرگ زمین: اگر با برش همپوشانی دارند
  const ok = big ? (b.mx[0] > CX - HALF - MARGIN && b.mn[0] < CX + HALF + MARGIN && b.mx[2] > CZ - HALF - MARGIN && b.mn[2] < CZ + HALF + MARGIN) : inBox(cx, cz, MARGIN);
  if (!ok) continue;
  /* حذف دکوراسیون ریز بیرون از محدوده‌ی بازی برای سبک بودن */
  if (!big && !inBox(cx, cz, 0) && /Plant|Prop|Chair|Bench|Surf|Umbrella|Rocks_Small|Lamp/.test(it.name + matNames(j.nodes[it.ni])) && !/Treeline|Palm/.test(it.name + matNames(j.nodes[it.ni]))) continue;
  kept.push(it);
}

/* ---- شمارش مثلث‌ها ---- */
let tris = 0;
for (const it of kept) for (const p of j.meshes[j.nodes[it.ni].mesh].primitives) tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
console.log('kept instances', kept.length, 'of', inst.length, 'tris', Math.round(tris));

/* ---- ساخت GLB جدید: هندسهٔ برش‌خورده در فضای نهایی، گروه‌بندی بر اساس متریال، رأس‌های یکتا ---- */
const LIM = (HALF + MARGIN) * SCALE;
const groups = new Map();   // material -> { pos:[], nor:[], idx:[], map:Map }
let outTris = 0;
for (const it of kept) {
  const W = mul(F, it.W);
  for (const p of j.meshes[j.nodes[it.ni].mesh].primitives) {
    const pos = acc(p.attributes.POSITION), nor = p.attributes.NORMAL !== undefined ? acc(p.attributes.NORMAL) : null;
    const idx = p.indices !== undefined ? acc(p.indices).data : null; const cnt = idx ? idx.length : pos.count;
    let g = groups.get(p.material); if (!g) { g = { pos: [], nor: [], idx: [], map: new Map() }; groups.set(p.material, g); }
    const wp = (v) => tp(W, pos.data[v * 3], pos.data[v * 3 + 1], pos.data[v * 3 + 2]);
    for (let k = 0; k < cnt; k += 3) {
      const vs = [idx ? idx[k] : k, idx ? idx[k + 1] : k + 1, idx ? idx[k + 2] : k + 2];
      const P3 = vs.map(wp);
      const cx = (P3[0][0] + P3[1][0] + P3[2][0]) / 3, cz = (P3[0][2] + P3[1][2] + P3[2][2]) / 3;
      if (Math.abs(cx) > LIM || Math.abs(cz) > LIM) continue;
      let fn = null;
      for (let q = 0; q < 3; q++) {
        let n3;
        if (nor) { const a = nor.data[vs[q] * 3], b = nor.data[vs[q] * 3 + 1], c = nor.data[vs[q] * 3 + 2]; n3 = [W[0] * a + W[4] * b + W[8] * c, W[1] * a + W[5] * b + W[9] * c, W[2] * a + W[6] * b + W[10] * c]; }
        else { if (!fn) { const u = [P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], v = [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]]; fn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; } n3 = fn; }
        const l = Math.hypot(n3[0], n3[1], n3[2]) || 1; n3 = [n3[0] / l, n3[1] / l, n3[2] / l];
        const key = Math.round(P3[q][0] * 50) + ',' + Math.round(P3[q][1] * 50) + ',' + Math.round(P3[q][2] * 50) + ',' + Math.round(n3[0] * 20) + ',' + Math.round(n3[1] * 20) + ',' + Math.round(n3[2] * 20);
        let id = g.map.get(key);
        if (id === undefined) { id = g.pos.length / 3; g.map.set(key, id); g.pos.push(P3[q][0], P3[q][1], P3[q][2]); g.nor.push(n3[0], n3[1], n3[2]); }
        g.idx.push(id);
      }
      outTris++;
    }
  }
}
console.log('output tris', outTris);
const chunks = [], bvList = [], accList = [], meshes = [], nodes = [], mats = []; let off = 0;
const push = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } chunks.push(buf); bvList.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target }); off += buf.length; return bvList.length - 1; };
for (const [mi, g] of groups) {
  if (!g.idx.length) continue;
  const P = new Float32Array(g.pos), N = new Float32Array(g.nor), Ix = g.pos.length / 3 > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx);
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
  const ap = accList.push({ bufferView: push(Buffer.from(P.buffer), 34962), componentType: 5126, count: P.length / 3, type: 'VEC3', min: mn, max: mx }) - 1;
  const an = accList.push({ bufferView: push(Buffer.from(N.buffer), 34962), componentType: 5126, count: N.length / 3, type: 'VEC3' }) - 1;
  const ai = accList.push({ bufferView: push(Buffer.from(Ix.buffer), 34963), componentType: Ix instanceof Uint32Array ? 5125 : 5123, count: Ix.length, type: 'SCALAR' }) - 1;
  mats.push({ name: j.materials[mi].name, pbrMetallicRoughness: { baseColorFactor: [...colors[mi], 1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true });
  meshes.push({ name: j.materials[mi].name, primitives: [{ attributes: { POSITION: ap, NORMAL: an }, indices: ai, material: mats.length - 1 }] });
  nodes.push({ name: j.materials[mi].name, mesh: meshes.length - 1 });
}
const gj = { asset: { version: '2.0', generator: 'prep-map' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: mats, accessors: accList, bufferViews: bvList, buffers: [{ byteLength: off }] };
let js = Buffer.from(JSON.stringify(gj)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
let bb = Buffer.concat(chunks); bb = Buffer.concat([bb, Buffer.alloc((4 - bb.length % 4) % 4)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
const h1 = Buffer.alloc(8); h1.writeUInt32LE(js.length, 0); h1.write('JSON', 4); const h2 = Buffer.alloc(8); h2.writeUInt32LE(bb.length, 0); h2.write('BIN\0', 4);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, NAME + '.glb'), Buffer.concat([head, h1, js, h2, bb]));
console.log('glb bytes', 12 + 8 + js.length + 8 + bb.length);

/* ---- نقشهٔ ارتفاع و برخورد ---- */
const X0 = -HALF * SCALE, Z0 = -HALF * SCALE, NX = Math.ceil(2 * HALF * SCALE / RES) + 1, NZ = NX;
const lowG = new Float32Array(NX * NZ).fill(1e9);              // پایین‌ترین سطح رو به بالا
const surf = Array.from({ length: NX * NZ }, () => null);       // سایر ارتفاع‌های اشغال: [y0,y1] به‌صورت جفت
const ivals = new Array(NX * NZ);
function addIv(c, a, b) { (ivals[c] || (ivals[c] = [])).push(a, b); }
for (const it of kept) {
  const W = mul(F, it.W);
  for (const p of j.meshes[j.nodes[it.ni].mesh].primitives) {
    const pos = acc(p.attributes.POSITION); const idx = p.indices !== undefined ? acc(p.indices).data : null; const cnt = idx ? idx.length : pos.count;
    const V = (k) => { const v = idx ? idx[k] : k; return tp(W, pos.data[v * 3], pos.data[v * 3 + 1], pos.data[v * 3 + 2]); };
    for (let k = 0; k < cnt; k += 3) {
      const a = V(k), b = V(k + 1), c = V(k + 2);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) continue; nx /= nl; ny /= nl; nz /= nl;
      const mnx = Math.min(a[0], b[0], c[0]), mxx = Math.max(a[0], b[0], c[0]), mnz = Math.min(a[2], b[2], c[2]), mxz = Math.max(a[2], b[2], c[2]);
      const i0 = Math.max(0, Math.floor((mnx - X0) / RES)), i1 = Math.min(NX - 1, Math.ceil((mxx - X0) / RES)), j0 = Math.max(0, Math.floor((mnz - Z0) / RES)), j1 = Math.min(NZ - 1, Math.ceil((mxz - Z0) / RES));
      if (i1 < 0 || j1 < 0 || i0 >= NX || j0 >= NZ) continue;
      const ymn = Math.min(a[1], b[1], c[1]), ymx = Math.max(a[1], b[1], c[1]);
      if (Math.abs(ny) < 0.35) {                      // دیوار/سطح تند: همهٔ سلول‌های ردپا
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) addIv(jj * NX + ii, ymn, ymx);
      } else {                                        // سطح افقی: ارتفاع در مرکز سلول
        const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue;
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          const px = X0 + ii * RES, pz = Z0 + jj * RES;
          const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den, l3 = 1 - l1 - l2;
          if (l1 < -0.05 || l2 < -0.05 || l3 < -0.05) continue;
          const y = l1 * a[1] + l2 * b[1] + l3 * c[1], cI = jj * NX + ii;
          if (ny > 0.7) { if (y < lowG[cI]) lowG[cI] = y; addIv(cI, y, y); } else addIv(cI, y, y);
        }
      }
    }
  }
}
/* ارتفاع زمین: پایین‌ترین سطح رو به بالا؛ خانه‌های خالی از همسایه پر می‌شوند */
let missing = 0; for (let c = 0; c < lowG.length; c++) if (lowG[c] > 1e8) missing++;
for (let pass = 0; pass < 20 && missing; pass++) {
  const cp = lowG.slice(); missing = 0;
  for (let jj = 0; jj < NZ; jj++) for (let ii = 0; ii < NX; ii++) { const c = jj * NX + ii; if (cp[c] < 1e8) continue; let s = 0, n = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = ii + di, j2 = jj + dj; if (i2 < 0 || j2 < 0 || i2 >= NX || j2 >= NZ) continue; const v = cp[j2 * NX + i2]; if (v < 1e8) { s += v; n++; } } if (n) lowG[c] = s / n; else missing++; }
}
for (let c = 0; c < lowG.length; c++) if (lowG[c] > 1e8) lowG[c] = 0;
/* جابه‌جایی ارتفاع: میانهٔ ارتفاع مرکز نقشه صفر شود */
const mid = []; for (let jj = NZ / 4 | 0; jj < NZ * 3 / 4; jj++) for (let ii = NX / 4 | 0; ii < NX * 3 / 4; ii++) mid.push(lowG[jj * NX + ii]); mid.sort((a, b) => a - b);
const YOFF = -mid[mid.length >> 1];
console.log('y offset', YOFF.toFixed(2));
/* مانع بودن: سطحی/دیواره‌ای بین g+0.7 و g+2.0 */
const blocked = new Uint8Array(NX * NZ), top = new Float32Array(NX * NZ);
for (let c = 0; c < blocked.length; c++) {
  const g = lowG[c], iv = ivals[c]; if (!iv) continue;
  let hi = -1e9;
  for (let k = 0; k < iv.length; k += 2) { if (iv[1 + k] > g + 0.75 && iv[k] < g + 2.1) { blocked[c] = 1; hi = Math.max(hi, Math.min(iv[1 + k], g + 6)); } }
  if (blocked[c]) top[c] = hi;
}
/* ارتفاع نهایی زمین با ایجاد هموارسازی ملایم */
const H16 = new Int16Array(NX * NZ); for (let c = 0; c < H16.length; c++) H16[c] = Math.round((lowG[c] + YOFF) * 100);
/* ادغام سلول‌های مانع به مستطیل (حریصانه) */
const used = new Uint8Array(NX * NZ), rects = [];
for (let jj = 0; jj < NZ; jj++) for (let ii = 0; ii < NX; ii++) {
  const c = jj * NX + ii; if (!blocked[c] || used[c]) continue;
  let w = 1; while (ii + w < NX && blocked[c + w] && !used[c + w]) w++;
  let h = 1; outer: while (jj + h < NZ) { for (let k = 0; k < w; k++) if (!blocked[(jj + h) * NX + ii + k] || used[(jj + h) * NX + ii + k]) break outer; h++; }
  let hi = 0, lo = 1e9; for (let b = 0; b < h; b++) for (let k = 0; k < w; k++) { used[(jj + b) * NX + ii + k] = 1; hi = Math.max(hi, top[(jj + b) * NX + ii + k]); lo = Math.min(lo, lowG[(jj + b) * NX + ii + k]); }
  rects.push([+(X0 + ii * RES - RES / 2).toFixed(2), +(Z0 + jj * RES - RES / 2).toFixed(2), +(X0 + (ii + w) * RES - RES / 2).toFixed(2), +(Z0 + (jj + h) * RES - RES / 2).toFixed(2), +(lo + YOFF).toFixed(2), +(hi + YOFF).toFixed(2)]);
}
console.log('blocked cells', blocked.reduce((a, b) => a + b, 0), 'rects', rects.length);
/* دسترس‌پذیری از نقطهٔ شروع */
const walk = (c) => !blocked[c];
function nearestFree(x, z) { let best = -1, bd = 1e9; for (let jj = 0; jj < NZ; jj++) for (let ii = 0; ii < NX; ii++) { const c = jj * NX + ii; if (blocked[c]) continue; const d = Math.hypot(X0 + ii * RES - x, Z0 + jj * RES - z); if (d < bd) { bd = d; best = c; } } return best; }
const START = process.env.START ? process.env.START.split(',').map(Number) : [0, 0];
const s0 = nearestFree(START[0], START[1]);
const reach = new Uint8Array(NX * NZ), q = [s0]; reach[s0] = 1;
for (let h = 0; h < q.length; h++) { const c = q[h], ci = c % NX, cj = (c / NX) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = ci + di, j2 = cj + dj; if (i2 < 1 || j2 < 1 || i2 >= NX - 1 || j2 >= NZ - 1) continue; const c2 = j2 * NX + i2; if (reach[c2] || blocked[c2]) continue; if (Math.abs(H16[c2] - H16[c]) > 60) continue; reach[c2] = 1; q.push(c2); } }
console.log('reachable cells', q.length, 'start', (X0 + (s0 % NX) * RES).toFixed(1), (Z0 + ((s0 / NX) | 0) * RES).toFixed(1));
/* قابلیت دید: خانه‌هایی که در شعاع ۱.۵ متر مانع ندارند و دسترس‌پذیرند — نمونه‌برداری شبکه‌ای */
const spawns = []; const STEP = 5;
for (let jj = 6; jj < NZ - 6; jj += STEP * 2) for (let ii = 6; ii < NX - 6; ii += STEP * 2) {
  let ok = true; for (let dj = -3; dj <= 3 && ok; dj++) for (let di = -3; di <= 3; di++) { const c = (jj + dj) * NX + ii + di; if (blocked[c] || !reach[c]) { ok = false; break; } }
  if (ok) spawns.push([+(X0 + ii * RES).toFixed(1), +(Z0 + jj * RES).toFixed(1)]);
}
console.log('spawn candidates', spawns.length);
fs.writeFileSync(path.join(outDir, NAME + '-map.json'), JSON.stringify({ x0: X0, z0: Z0, nx: NX, nz: NZ, res: RES, half: HALF * SCALE, yoff: YOFF, h: Buffer.from(H16.buffer).toString('base64'), rects, spawns, start: [+(X0 + (s0 % NX) * RES).toFixed(1), +(Z0 + ((s0 / NX) | 0) * RES).toFixed(1)] }));
/* پیش‌نمایش */
fs.writeFileSync(path.join(outDir, 'preview.json'), JSON.stringify({ NX, NZ, blocked: Buffer.from(blocked).toString('base64'), reach: Buffer.from(reach).toString('base64'), h: Array.from(H16.filter((_, i) => i % 1 === 0)).length }));
