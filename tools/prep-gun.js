/* تبدیل مدل تفنگ GLB به فایل JSON سبک برای نمایش اول‌شخص:
   node prep-gun.js in.glb out.json  (محور: لولهٔ تفنگ به −Z، مبدأ روی دستگیره، مقیاس به متر)
   env: SCALE=0.073  GX=-0.2 (محل دستگیره روی محور X مدل)  GY=0.35  WELD=0.0025 (متر) */
const fs = require('fs');
const [, , inF, outF] = process.argv;
const S = +(process.env.SCALE || 0.073), GX = +(process.env.GX || -0.2), GY = +(process.env.GY || 0.35), WELD = +(process.env.WELD || 0.0025);
const b = fs.readFileSync(inF), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), bin = b.slice(20 + jl + 8);
const mul = (a, c) => { const o = new Array(16).fill(0); for (let k = 0; k < 4; k++) for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) o[k * 4 + r] += a[q * 4 + r] * c[k * 4 + q]; return o; };
const loc = (n) => { if (n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1]; const [x, y, z, w] = q;
  const m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
  for (let i = 0; i < 3; i++) { m[i] *= s[0]; m[4 + i] *= s[1]; m[8 + i] *= s[2]; } m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; };
function acc(ai) { const a = j.accessors[ai], bv = j.bufferViews[a.bufferView]; const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const sz = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType], stride = bv.byteStride || nc * sz; const out = new Float64Array(a.count * nc), base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < nc; k++) { const o = base + i * stride + k * sz; out[i * nc + k] = a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5125 ? bin.readUInt32LE(o) : a.componentType === 5123 ? bin.readUInt16LE(o) : bin[o]; }
  return { d: out, nc, count: a.count }; }
const groups = new Map(); let tin = 0, tout = 0;
(function visit(i, P) {
  const n = j.nodes[i], W = mul(P, loc(n));
  if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) {
    const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), idx = p.indices !== undefined ? acc(p.indices).d : null, cnt = idx ? idx.length : pos.count;
    let g = groups.get(p.material); if (!g) { g = { v: [], map: new Map(), idx: [], cell: new Map() }; groups.set(p.material, g); }
    const vid = (k) => { const v = idx ? idx[k] : k; const x = pos.d[v * 3], y = pos.d[v * 3 + 1], z = pos.d[v * 3 + 2];
      const wx = W[0] * x + W[4] * y + W[8] * z + W[12], wy = W[1] * x + W[5] * y + W[9] * z + W[13], wz = W[2] * x + W[6] * y + W[10] * z + W[14];
      // مدل: لوله +X، بالا +Y → گیم: لوله −Z، بالا +Y، راست +X
      const gx = wz * S, gy = (wy - GY) * S, gz = -(wx - GX) * S;
      const nx = W[0] * nor.d[v * 3] + W[4] * nor.d[v * 3 + 1] + W[8] * nor.d[v * 3 + 2], ny = W[1] * nor.d[v * 3] + W[5] * nor.d[v * 3 + 1] + W[9] * nor.d[v * 3 + 2], nz = W[2] * nor.d[v * 3] + W[6] * nor.d[v * 3 + 1] + W[10] * nor.d[v * 3 + 2];
      const l = Math.hypot(nx, ny, nz) || 1; const N3 = [nz / l, ny / l, -nx / l];
      const key = Math.round(gx / WELD) + ',' + Math.round(gy / WELD) + ',' + Math.round(gz / WELD) + ',' + Math.round(N3[0] * 3) + ',' + Math.round(N3[1] * 3) + ',' + Math.round(N3[2] * 3);
      let id = g.map.get(key); if (id === undefined) { id = g.v.length / 6; g.map.set(key, id); g.v.push(gx, gy, gz, N3[0], N3[1], N3[2]); } return id; };
    for (let k = 0; k < cnt; k += 3) { tin++; const a = vid(k), c = vid(k + 1), d = vid(k + 2); if (a === c || c === d || a === d) continue; g.idx.push(a, c, d); tout++; }
  }
  (n.children || []).forEach((c) => visit(c, W));
})(j.scenes[0].nodes[0], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const parts = [];
for (const [mi, g] of groups) {
  if (g.v.length / 6 > 65000) throw new Error('too many verts');
  parts.push({ color: j.materials[mi].pbrMetallicRoughness.baseColorFactor.slice(0, 3).map((x) => +x.toFixed(3)), v: Buffer.from(new Float32Array(g.v).buffer).toString('base64'), i: Buffer.from(new Uint16Array(g.idx).buffer).toString('base64') });
}
console.log('tris in', tin, 'out', tout, 'verts', [...groups.values()].reduce((a, g) => a + g.v.length / 6, 0));
fs.writeFileSync(outF, JSON.stringify({ scale: S, parts }));
console.log('bytes', fs.statSync(outF).size);
