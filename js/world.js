'use strict';
/* دنیای بازی: جعبه‌ها (هندسه + برخورد)، پرتاب پرتو، شبکهٔ مسیریابی، A* و میدان جریان */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Level {
  constructor(env, half, seed) {
    this.env = env; this.half = half;
    this.rnd = mulberry32(seed || 1);
    this.boxes = [];
    this.lights = [];
    this.spawns = [];
    this.pickups = [];
    this.hostages = [];
    this.start = { x: 0, z: 0, yaw: 0 };
    this.extract = null;
    this.dirty = true;
    this.batch = new GE.Batch(90000);
    this.cell = 1.5;
    this.nav = null; this.flow = null; this.flowCell = -1;
    this.nextId = 1;
  }

  r() { return this.rnd(); }
  rr(a, b) { return a + (b - a) * this.rnd(); }

  /* افزودن جعبه. opt: solid, opaque, mat, kind, hp, vis */
  add(x0, y0, z0, x1, y1, z1, col, opt) {
    opt = opt || {};
    const j = 0.93 + this.rnd() * 0.14;
    const b = {
      id: this.nextId++, x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1),
      x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1),
      col: [col[0] * j, col[1] * j, col[2] * j],
      mat: opt.mat === undefined ? 1 : opt.mat,
      solid: opt.solid !== false, opaque: opt.opaque !== false,
      kind: opt.kind || 'wall', hp: opt.hp || 0, maxHp: opt.hp || 0,
      ao: opt.ao === undefined ? 0.3 : opt.ao, dead: false, hidden: !!opt.hidden,
    };
    this.boxes.push(b); this.dirty = true;
    return b;
  }

  /* ---- ساخت اشیا ---- */
  groundPlane(col) {
    const h = this.half + 30;
    return this.add(-h, -1, -h, h, 0, h, col, { solid: false, opaque: false, mat: 1, ao: 0, kind: 'ground' });
  }
  wall(x0, z0, x1, z1, h, col, y0) {
    return this.add(x0, y0 || 0, z0, x1, (y0 || 0) + h, z1, col);
  }
  /* دیوار نازک در یک محور (طول از (x0,z0) تا (x1,z1) که یکی از محورها ثابت است) */
  fence(x0, z0, x1, z1, h, th, col, opt) {
    th = th || 0.4;
    if (Math.abs(x1 - x0) >= Math.abs(z1 - z0)) return this.add(x0, 0, z0 - th / 2, x1, h, z0 + th / 2, col, opt);
    return this.add(x0 - th / 2, 0, z0, x0 + th / 2, h, z1, col, opt);
  }
  crate(x, z, s, col, y) {
    s = s || 1.2;
    return this.add(x - s / 2, y || 0, z - s / 2, x + s / 2, (y || 0) + s, z + s / 2, col || [0.42, 0.3, 0.16], { kind: 'crate', hp: 70, mat: 1 });
  }
  barrel(x, z, col) {
    return this.add(x - 0.36, 0, z - 0.36, x + 0.36, 1.05, z + 0.36, col || [0.7, 0.18, 0.12], { kind: 'barrel', hp: 40, mat: 0 });
  }
  sandbag(x, z, len, vertical) {
    const c = [0.55, 0.5, 0.36];
    if (vertical) return this.add(x - 0.4, 0, z - len / 2, x + 0.4, 1.0, z + len / 2, c, { kind: 'cover' });
    return this.add(x - len / 2, 0, z - 0.4, x + len / 2, 1.0, z + 0.4, c, { kind: 'cover' });
  }
  rock(x, z, s, col) {
    col = col || [0.34, 0.33, 0.32];
    this.add(x - s, 0, z - s * 0.8, x + s, s * 1.3, z + s * 0.8, col, {});
    this.add(x - s * 0.6, s * 1.3, z - s * 0.5, x + s * 0.5, s * 1.9, z + s * 0.5, [col[0] * 1.05, col[1] * 1.05, col[2] * 1.05], {});
  }
  tree(x, z, h, leaf, trunk) {
    h = h || 6; leaf = leaf || [0.12, 0.3, 0.14]; trunk = trunk || [0.28, 0.18, 0.1];
    this.add(x - 0.25, 0, z - 0.25, x + 0.25, h * 0.55, z + 0.25, trunk, { kind: 'tree' });
    const w = h * 0.32;
    this.add(x - w, h * 0.4, z - w, x + w, h * 0.7, z + w, leaf, { solid: false, mat: 1, ao: 0 });
    this.add(x - w * 0.7, h * 0.7, z - w * 0.7, x + w * 0.7, h * 0.92, z + w * 0.7, [leaf[0] * 1.1, leaf[1] * 1.1, leaf[2] * 1.1], { solid: false, mat: 1, ao: 0 });
    this.add(x - w * 0.35, h * 0.92, z - w * 0.35, x + w * 0.35, h * 1.08, z + w * 0.35, leaf, { solid: false, mat: 1, ao: 0 });
  }
  pine(x, z, h, snow) {
    const c = snow ? [0.85, 0.88, 0.92] : [0.08, 0.22, 0.12];
    this.add(x - 0.22, 0, z - 0.22, x + 0.22, h * 0.4, z + 0.22, [0.25, 0.16, 0.09], { kind: 'tree' });
    let y = h * 0.2, w = h * 0.3;
    for (let i = 0; i < 4; i++) {
      this.add(x - w, y, z - w, x + w, y + h * 0.2, z + w, c, { solid: false, mat: 1, ao: 0 });
      y += h * 0.19; w *= 0.7;
    }
  }
  lamp(x, z, h, col, radius, intensity) {
    col = col || [1, 0.85, 0.5]; h = h || 4.5;
    this.add(x - 0.1, 0, z - 0.1, x + 0.1, h, z + 0.1, [0.15, 0.15, 0.17], { kind: 'prop' });
    this.add(x - 0.3, h, z - 0.3, x + 0.3, h + 0.2, z + 0.3, col, { solid: false, mat: 2, ao: 0, kind: 'glow' });
    const k = intensity || 1;
    this.lights.push({ x, y: h - 0.3, z, r: radius || 14, cr: col[0] * k, cg: col[1] * k, cb: col[2] * k });
  }
  /* ساختمان توخالی با در. door: 'n','s','e','w' یا آرایه‌ای از آنها */
  building(cx, cz, w, d, h, col, doors, opt) {
    opt = opt || {};
    const t = 0.45, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const dw = 2.4, dh = 2.6;
    const ds = Array.isArray(doors) ? doors : (doors ? [doors] : []);
    const wallX = (zc, name) => { // دیوار شمالی/جنوبی (امتداد X)
      const zz0 = zc - t / 2, zz1 = zc + t / 2;
      if (ds.indexOf(name) >= 0) {
        const gx = cx - dw / 2, gx1 = cx + dw / 2;
        this.add(x0, 0, zz0, gx, h, zz1, col); this.add(gx1, 0, zz0, x1, h, zz1, col);
        this.add(gx, dh, zz0, gx1, h, zz1, col);
      } else this.add(x0, 0, zz0, x1, h, zz1, col);
    };
    const wallZ = (xc, name) => {
      const xx0 = xc - t / 2, xx1 = xc + t / 2;
      if (ds.indexOf(name) >= 0) {
        const gz = cz - dw / 2, gz1 = cz + dw / 2;
        this.add(xx0, 0, z0, xx1, h, gz, col); this.add(xx0, 0, gz1, xx1, h, z1, col);
        this.add(xx0, dh, gz, xx1, h, gz1, col);
      } else this.add(xx0, 0, z0, xx1, h, z1, col);
    };
    wallX(z0 + t / 2, 'n'); wallX(z1 - t / 2, 's'); wallZ(x0 + t / 2, 'w'); wallZ(x1 - t / 2, 'e');
    if (opt.roof !== false) this.add(x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.35, z1 + 0.2, opt.roofCol || [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], { kind: 'roof' });
    if (opt.light) this.lights.push({ x: cx, y: h - 0.6, z: cz, r: Math.max(w, d) * 0.9, cr: 1.0, cg: 0.8, cb: 0.5 });
  }
  container(x, z, along, col, y) {
    const w = along === 'z' ? 2.5 : 6.1, d = along === 'z' ? 6.1 : 2.5;
    return this.add(x - w / 2, y || 0, z - d / 2, x + w / 2, (y || 0) + 2.6, z + d / 2, col || [0.55, 0.2, 0.15], { mat: 1, kind: 'container' });
  }
  car(x, z, along, col) {
    col = col || [0.3, 0.32, 0.36];
    const w = along === 'z' ? 1.9 : 4.2, d = along === 'z' ? 4.2 : 1.9;
    this.add(x - w / 2, 0.25, z - d / 2, x + w / 2, 1.0, z + d / 2, col, { mat: 0, kind: 'car', hp: 120 });
    const cw = along === 'z' ? w * 0.9 : w * 0.5, cd = along === 'z' ? d * 0.5 : d * 0.9;
    this.add(x - cw / 2, 1.0, z - cd / 2, x + cw / 2, 1.5, z + cd / 2, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.9], { mat: 0, kind: 'prop' });
  }
  generator(x, z, col) {
    const g0 = this.terrain ? this.terrain.h(x, z) : 0;
    const b = this.add(x - 1.2, g0 - 0.3, z - 1.0, x + 1.2, g0 + 2.2, z + 1.0, col || [0.2, 0.34, 0.2], { kind: 'gen', hp: 260, mat: 0 });
    this.add(x - 0.9, g0 + 2.2, z - 0.7, x + 0.9, g0 + 2.5, z + 0.7, [0.9, 0.7, 0.1], { solid: false, mat: 2, ao: 0, kind: 'glow' });
    b.mark = [x, z];
    return b;
  }
  tower(x, z, h) {
    const c = [0.3, 0.28, 0.25];
    for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) this.add(x + dx - 0.2, 0, z + dz - 0.2, x + dx + 0.2, h, z + dz + 0.2, c, {});
    const f = this.add(x - 2, h, z - 2, x + 2, h + 0.25, z + 2, [0.35, 0.3, 0.24], { kind: 'platform' });
    this.add(x - 2, h + 0.25, z - 2, x + 2, h + 1.0, z - 1.85, [0.35, 0.3, 0.24], { kind: 'rail', opaque: false });
    this.add(x - 2, h + 0.25, z + 1.85, x + 2, h + 1.0, z + 2, [0.35, 0.3, 0.24], { kind: 'rail', opaque: false });
    this.add(x - 2, h + 0.25, z - 2, x - 1.85, h + 1.0, z + 2, [0.35, 0.3, 0.24], { kind: 'rail', opaque: false });
    this.add(x + 1.85, h + 0.25, z - 2, x + 2, h + 1.0, z + 2, [0.35, 0.3, 0.24], { kind: 'rail', opaque: false });
    f.top = h + 0.25;
    return f;
  }
  /* مرز کوهستانی */
  mountainsRing(col, hmin, hmax) {
    const h = this.half;
    const seg = 8;
    for (let side = 0; side < 4; side++) {
      for (let i = -h; i < h; i += seg) {
        const hh = this.rr(hmin, hmax);
        const dep = this.rr(5, 9);
        let x0, z0, x1, z1;
        if (side === 0) { x0 = i; x1 = i + seg + 0.5; z0 = -h - dep; z1 = -h + 0.5; }
        else if (side === 1) { x0 = i; x1 = i + seg + 0.5; z0 = h - 0.5; z1 = h + dep; }
        else if (side === 2) { z0 = i; z1 = i + seg + 0.5; x0 = -h - dep; x1 = -h + 0.5; }
        else { z0 = i; z1 = i + seg + 0.5; x0 = h - 0.5; x1 = h + dep; }
        this.add(x0, 0, z0, x1, hh, z1, col, { kind: 'mountain', ao: 0.1 });
        this.add(x0 + 1, hh, z0 + (side < 2 ? (side === 0 ? 0 : 1) : 1), x1 - 1, hh + hh * 0.35, z1 - 1, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.95], { kind: 'mountain', ao: 0 });
      }
    }
  }
  /* اتاق با دیوار و درگاه‌ها: doors [{s:'n'|'s'|'e'|'w', p:مرکز(نسبت به مختصات), w:عرض}] */
  room(x0, z0, x1, z1, h, col, doors, th) {
    th = th || 0.5; doors = doors || [];
    const sides = {
      n: { a: x0, b: x1, c: z0, ax: 'x' }, s: { a: x0, b: x1, c: z1, ax: 'x' },
      w: { a: z0, b: z1, c: x0, ax: 'z' }, e: { a: z0, b: z1, c: x1, ax: 'z' },
    };
    for (const k in sides) {
      const S = sides[k];
      const ds = doors.filter((d) => d.s === k).sort((p, q) => p.p - q.p);
      let cur = S.a;
      const seg = (u0, u1) => {
        if (u1 - u0 < 0.05) return;
        if (S.ax === 'x') this.add(u0, 0, S.c - th / 2, u1, h, S.c + th / 2, col);
        else this.add(S.c - th / 2, 0, u0, S.c + th / 2, h, u1, col);
      };
      const lintel = (u0, u1) => {
        if (S.ax === 'x') this.add(u0, 2.7, S.c - th / 2, u1, h, S.c + th / 2, col);
        else this.add(S.c - th / 2, 2.7, u0, S.c + th / 2, h, u1, col);
      };
      for (const d of ds) {
        seg(cur, d.p - d.w / 2); lintel(d.p - d.w / 2, d.p + d.w / 2); cur = d.p + d.w / 2;
      }
      seg(cur, S.b);
    }
  }

  /* ---- موجودیت‌ها ---- */
  enemy(type, x, z, opt) { this.spawns.push(Object.assign({ type, x, z }, opt || {})); }
  pickup(kind, x, z) { this.pickups.push({ kind, x, z }); }
  hostage(x, z) { this.hostages.push({ x, z }); }
  light(x, y, z, r, cr, cg, cb) { this.lights.push({ x, y, z, r, cr, cg, cb }); }

  /* ---- نهایی‌سازی ---- */
  finalize() {
    this.rebuild();
    this.buildNav();
  }
  rebuild() {
    const bt = this.batch; bt.clear();
    for (const b of this.boxes) {
      if (b.dead || b.hidden) continue;
      bt.box((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, 0, 0, b.col, 1, b.mat, b.y0 < 0.2 ? b.ao : 0);
    }
    if (this.deco && this.deco.n) { bt.f.set(this.deco.f.subarray(0, this.deco.n * GE.FLOATS), bt.n * GE.FLOATS); bt.n += this.deco.n; }
    this.dirty = false;
    GE.setStatic(bt);
  }
  remove(b) { if (b.dead) return; b.dead = true; this.dirty = true; this.navDirty = true; }

  /* ---- برخورد ---- */
  circleBox(x, z, r, b) {
    const cx = x < b.x0 ? b.x0 : (x > b.x1 ? b.x1 : x);
    const cz = z < b.z0 ? b.z0 : (z > b.z1 ? b.z1 : z);
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < r * r;
  }
  blocked(x, z, r, y, h) {
    const hh = this.half - 0.6;
    if (x < -hh || x > hh || z < -hh || z > hh) return true;
    if (this.terrain && this.terrain.h(x, z) > y + 1.5) return true;
    const bs = this.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.solid || b.dead) continue;
      if (b.y1 <= y + 0.5 || b.y0 >= y + h) continue;
      if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
      if (this.circleBox(x, z, r, b)) return true;
    }
    return false;
  }
  /* حرکت لغزان دایره؛ pos:{x,z} */
  move(pos, dx, dz, r, y, h) {
    const T = this.terrain;
    if (T) {
      const h0 = T.h(pos.x, pos.z);
      /* شیب بیش از ~۴۸ درجه قابل صعود نیست */
      const ok = (nx, nz, d) => { const h1 = T.h(nx, nz); return h1 <= h0 + 1.1 * d + 0.02 || h1 <= y + 0.05; };
      if (dx !== 0 && ok(pos.x + dx, pos.z, Math.abs(dx)) && !this.blocked(pos.x + dx, pos.z, r, y, h)) pos.x += dx;
      if (dz !== 0 && ok(pos.x, pos.z + dz, Math.abs(dz)) && !this.blocked(pos.x, pos.z + dz, r, y, h)) pos.z += dz;
      return;
    }
    if (dx !== 0 && !this.blocked(pos.x + dx, pos.z, r, y, h)) pos.x += dx;
    if (dz !== 0 && !this.blocked(pos.x, pos.z + dz, r, y, h)) pos.z += dz;
  }
  groundAt(x, z, r, y) {
    let best = 0;
    if (this.terrain) { const th = this.terrain.h(x, z); if (th <= y + 0.55) best = th; }
    const bs = this.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.solid || b.dead || b.y1 <= best || b.y1 > y + 0.55) continue;
      if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
      best = b.y1;
    }
    return best;
  }
  ceilingAt(x, z, r, y) {
    let best = 1e9;
    const bs = this.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.solid || b.dead || b.y0 < y - 0.01 || b.y0 >= best) continue;
      if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
      best = b.y0;
    }
    return best;
  }

  /* پرتو در برابر جعبه‌ها. mode: 'solid' (گلوله) | 'opaque' (دید). نتیجه در this.hit */
  ray(ox, oy, oz, dx, dy, dz, maxT, mode) {
    let bestT = maxT, bestB = null, bn = 0; // bn: 1..6 face
    const bs = this.boxes;
    const idx = 1 / (dx || 1e-9), idy = 1 / (dy || 1e-9), idz = 1 / (dz || 1e-9);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.dead) continue;
      if (mode === 'opaque' ? !b.opaque : !b.solid) continue;
      let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let face = t1 < t2 ? 1 : 2;
      t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
      let a = Math.min(t1, t2), c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; face = t1 < t2 ? 3 : 4; }
      if (c < tmax) tmax = c;
      t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
      a = Math.min(t1, t2); c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; face = t1 < t2 ? 5 : 6; }
      if (c < tmax) tmax = c;
      if (tmax < 0 || tmin > tmax) continue;
      const t = tmin > 0.0001 ? tmin : (tmax > 0.0001 ? 0 : -1);
      if (t < 0 || t >= bestT) continue;
      if (tmin <= 0.0001) continue; // شروع داخل جعبه نادیده گرفته می‌شود
      bestT = t; bestB = b; bn = face;
    }
    // زمین (نقشهٔ ارتفاع)
    if (this.terrain) {
      const T = this.terrain;
      if (oy > T.h(ox, oz) - 0.2) {
        const lim = Math.min(bestT, maxT);
        for (let t = 0.6; t < lim + 0.6; t += 0.6) {
          const tt = Math.min(t, lim);
          if (oy + dy * tt < T.h(ox + dx * tt, oz + dz * tt)) {
            let a = Math.max(0, tt - 0.6), b = tt;
            for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (oy + dy * m < T.h(ox + dx * m, oz + dz * m)) b = m; else a = m; }
            if (b < bestT) { bestT = b; bestB = null; bn = 3; }
            break;
          }
          if (tt >= lim) break;
        }
      }
    } else if (mode !== 'opaque' && dy < -1e-6) {
      const t = -oy / dy;
      if (t > 0.0001 && t < bestT) { bestT = t; bestB = null; bn = 3; }
    }
    if (bestT >= maxT) return null;
    const H = this.hitInfo || (this.hitInfo = { t: 0, box: null, nx: 0, ny: 0, nz: 0, x: 0, y: 0, z: 0 });
    H.t = bestT; H.box = bestB;
    H.nx = bn === 1 ? 1 : bn === 2 ? -1 : 0; H.ny = bn === 3 ? 1 : bn === 4 ? -1 : 0; H.nz = bn === 5 ? 1 : bn === 6 ? -1 : 0;
    H.x = ox + dx * bestT; H.y = oy + dy * bestT; H.z = oz + dz * bestT;
    return H;
  }
  /* خط دید بین دو نقطه */
  los(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return !this.ray(x0, y0, z0, dx / d, dy / d, dz / d, d - 0.05, 'opaque');
  }

  /* ---- مسیریابی ---- */
  buildNav() {
    const n = Math.ceil(2 * this.half / this.cell);
    this.n = n;
    const g = new Uint8Array(n * n);
    const m = 0.42;
    for (const b of this.boxes) {
      if (!b.solid || b.dead || b.y1 < 0.9 || b.y0 > 1.5) continue;
      const i0 = Math.max(0, Math.floor((b.x0 - m + this.half) / this.cell)), i1 = Math.min(n - 1, Math.floor((b.x1 + m + this.half) / this.cell));
      const j0 = Math.max(0, Math.floor((b.z0 - m + this.half) / this.cell)), j1 = Math.min(n - 1, Math.floor((b.z1 + m + this.half) / this.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * n + i] = 1;
    }
    if (this.terrain) {
      const T = this.terrain;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = this.cc(i), z = this.cc(j), h0 = T.h(x, z);
        const sl = Math.hypot(T.h(x + 0.75, z) - T.h(x - 0.75, z), T.h(x, z + 0.75) - T.h(x, z - 0.75)) / 1.5;
        if (h0 > 4.2 || sl > 0.85) g[j * n + i] = 1;
      }
    }
    // لبه‌ها مسدود
    for (let i = 0; i < n; i++) { g[i] = 1; g[(n - 1) * n + i] = 1; g[i * n] = 1; g[i * n + n - 1] = 1; }
    this.grid = g;
    this.flow = new Int16Array(n * n);
    this.queue = new Int32Array(n * n);
    this.flowCell = -1; this.navDirty = false;
  }
  cx(x) { return Math.floor((x + this.half) / this.cell); }
  cc(i) { return -this.half + (i + 0.5) * this.cell; }
  free(i, j) { return i > 0 && j > 0 && i < this.n - 1 && j < this.n - 1 && !this.grid[j * this.n + i]; }
  /* نزدیک‌ترین سلول آزاد */
  nearestFree(x, z) {
    let i = this.cx(x), j = this.cx(z);
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 8; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (this.free(i + di, j + dj)) return [i + di, j + dj];
      }
    }
    return null;
  }
  computeFlow(px, pz) {
    if (this.navDirty) this.buildNav();
    const s = this.nearestFree(px, pz);
    if (!s) return;
    const n = this.n, f = this.flow, q = this.queue, g = this.grid;
    f.fill(32767);
    let qh = 0, qt = 0;
    const si = s[1] * n + s[0];
    f[si] = 0; q[qt++] = si;
    while (qh < qt) {
      const c = q[qh++]; const ci = c % n, cj = (c - ci) / n; const d = f[c] + 1;
      for (let k = 0; k < 8; k++) {
        const di = k === 0 ? 1 : k === 1 ? -1 : k === 2 ? 0 : k === 3 ? 0 : k === 4 ? 1 : k === 5 ? 1 : k === 6 ? -1 : -1;
        const dj = k === 0 ? 0 : k === 1 ? 0 : k === 2 ? 1 : k === 3 ? -1 : k === 4 ? 1 : k === 5 ? -1 : k === 6 ? 1 : -1;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nn = nj * n + ni;
        if (g[nn] || f[nn] <= d) continue;
        if (di !== 0 && dj !== 0 && (g[cj * n + ni] || g[nj * n + ci])) continue;
        f[nn] = d; q[qt++] = nn;
      }
    }
  }
  /* جهت حرکت از (x,z) به سمت هدف میدان جریان؛ out={x,z}؛ false اگر مسیری نیست */
  flowDir(x, z, out) {
    const n = this.n, f = this.flow, g = this.grid;
    let i = this.cx(x), j = this.cx(z);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    let cur = f[j * n + i];
    if (g[j * n + i]) { const nf = this.nearestFree(x, z); if (!nf) return false; i = nf[0]; j = nf[1]; cur = f[j * n + i]; }
    if (cur >= 32767) return false;
    let best = cur, bi = i, bj = j;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n || g[nj * n + ni]) continue;
      if (di && dj && (g[j * n + ni] || g[nj * n + i])) continue;
      const v = f[nj * n + ni];
      if (v < best) { best = v; bi = ni; bj = nj; }
    }
    if (bi === i && bj === j) { out.x = 0; out.z = 0; out.d = cur; return cur === 0; }
    const tx = this.cc(bi) - x, tz = this.cc(bj) - z;
    const l = Math.hypot(tx, tz) || 1;
    out.x = tx / l; out.z = tz / l; out.d = cur;
    return true;
  }
  /* A* روی شبکه؛ خروجی آرایه‌ای از نقاط یا null */
  path(sx, sz, tx, tz, maxExp) {
    const s = this.nearestFree(sx, sz), t = this.nearestFree(tx, tz);
    if (!s || !t) return null;
    const n = this.n, g = this.grid;
    const si = s[1] * n + s[0], ti = t[1] * n + t[0];
    if (si === ti) return [{ x: this.cc(t[0]), z: this.cc(t[1]) }];
    const gs = new Map(), came = new Map(), closed = new Set();
    const open = [[0, si]];
    gs.set(si, 0);
    maxExp = maxExp || 600;
    let exp = 0, found = false;
    const heur = (i) => { const ii = i % n, jj = (i - ii) / n; return Math.hypot(ii - t[0], jj - t[1]); };
    while (open.length && exp++ < maxExp) {
      // خروج کمینه (آرایهٔ کوچک)
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const cur = open[bi][1]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === ti) { found = true; break; }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const ci = cur % n, cj = (cur - ci) / n;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nn = nj * n + ni;
        if (g[nn] || closed.has(nn)) continue;
        if (di && dj && (g[cj * n + ni] || g[nj * n + ci])) continue;
        const ng = gs.get(cur) + (di && dj ? 1.414 : 1);
        if (gs.has(nn) && gs.get(nn) <= ng) continue;
        gs.set(nn, ng); came.set(nn, cur);
        open.push([ng + heur(nn), nn]);
      }
    }
    if (!found) return null;
    const out = [];
    let c = ti;
    while (c !== si) { const ci = c % n, cj = (c - ci) / n; out.push({ x: this.cc(ci), z: this.cc(cj) }); c = came.get(c); }
    out.reverse();
    return out;
  }
  /* نقطهٔ تصادفی آزاد در شعاع */
  randomFree(x, z, rad, tries) {
    for (let k = 0; k < (tries || 20); k++) {
      const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * rad;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const i = this.cx(px), j = this.cx(pz);
      if (this.free(i, j)) return { x: this.cc(i), z: this.cc(j) };
    }
    return null;
  }
}
