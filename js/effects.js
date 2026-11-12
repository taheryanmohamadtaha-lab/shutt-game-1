'use strict';
/* جلوه‌های بصری: ذرات، ردگلوله، جای گلوله، نورهای پویا، باران و برف */
const FX = (() => {
  const MAXP = 480;
  const ps = [];
  for (let i = 0; i < MAXP; i++) ps.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 0.1, s1: 0.1, r: 1, g: 1, b: 1, a: 1, grav: 0, mat: 0, drag: 0 });
  let cur = 0, cap = 220;
  const tracers = [];
  const decals = []; let dcur = 0;
  const lights = [];
  let wx = null, wcount = 0, wkind = null;

  function spawn(x, y, z, vx, vy, vz, life, s0, s1, c, a, grav, mat, drag) {
    const p = ps[cur]; cur = (cur + 1) % cap;
    p.on = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.s0 = s0; p.s1 = s1; p.r = c[0]; p.g = c[1]; p.b = c[2]; p.a = a; p.grav = grav || 0; p.mat = mat || 0; p.drag = drag || 0;
  }
  const R = () => Math.random() - 0.5;

  const api = {
    setQuality(q) {
      cap = q === 'low' ? 90 : q === 'medium' ? 220 : MAXP;
      if (cur >= cap) cur = 0;
      wcount = q === 'low' ? 60 : q === 'medium' ? 120 : 200;
    },
    reset(env) {
      for (const p of ps) p.on = false;
      tracers.length = 0; decals.length = 0; dcur = 0; lights.length = 0;
      wkind = env && env.rain ? 'rain' : env && env.snow ? 'snow' : null;
      if (wkind) {
        wx = new Float32Array(wcount * 3);
        for (let i = 0; i < wcount; i++) { wx[i * 3] = R() * 36; wx[i * 3 + 1] = Math.random() * 20; wx[i * 3 + 2] = R() * 36; }
      } else wx = null;
    },
    tracer(x0, y0, z0, x1, y1, z1, col) { tracers.push({ x0, y0, z0, x1, y1, z1, life: 0.07, col: col || [1, 0.85, 0.4] }); if (tracers.length > 40) tracers.shift(); },
    spark(x, y, z, nx, ny, nz, n, col) {
      col = col || [1, 0.8, 0.35];
      for (let i = 0; i < n; i++) spawn(x, y, z, (nx + R() * 1.4) * 3, (ny + R() * 1.4) * 3 + 1, (nz + R() * 1.4) * 3, 0.25 + Math.random() * 0.25, 0.05, 0.02, col, 1, 9, 2, 0);
    },
    dust(x, y, z, nx, ny, nz, col) {
      col = col || [0.6, 0.58, 0.52];
      for (let i = 0; i < 2; i++) spawn(x, y, z, (nx + R()) * 0.8, (ny + R()) * 0.8 + 0.3, (nz + R()) * 0.8, 0.5, 0.1, 0.35, col, 0.45, -0.3, 0, 1.5);
    },
    blood(x, y, z, n) {
      for (let i = 0; i < n; i++) spawn(x, y, z, R() * 3, Math.random() * 2.5, R() * 3, 0.5 + Math.random() * 0.3, 0.07, 0.04, [0.5, 0.03, 0.03], 0.9, 10, 0, 0.5);
    },
    debris(x, y, z, col, n) {
      for (let i = 0; i < n; i++) spawn(x + R() * 0.5, y + R() * 0.4, z + R() * 0.5, R() * 6, Math.random() * 5 + 1, R() * 6, 0.9 + Math.random() * 0.6, 0.12, 0.08, col, 1, 14, 0, 0.3);
    },
    smoke(x, y, z, n, big) {
      for (let i = 0; i < n; i++) spawn(x + R() * 0.6, y, z + R() * 0.6, R() * 0.8, 0.8 + Math.random(), R() * 0.8, 1.5 + Math.random(), 0.3, big ? 1.8 : 1.0, [0.2, 0.2, 0.2], 0.5, -0.2, 0, 1);
    },
    explosion(x, y, z, r) {
      for (let i = 0; i < 14; i++) spawn(x, y + 0.3, z, R() * r * 1.6, Math.random() * r * 1.2, R() * r * 1.6, 0.35 + Math.random() * 0.3, 0.5, 1.8, [1, 0.55 + Math.random() * 0.3, 0.12], 0.9, -1, 2, 2.5);
      for (let i = 0; i < 10; i++) spawn(x, y + 0.5, z, R() * r, Math.random() * r * 0.8, R() * r, 1.4 + Math.random(), 0.6, 2.4, [0.16, 0.16, 0.16], 0.6, -0.4, 0, 1.6);
      for (let i = 0; i < 14; i++) spawn(x, y + 0.3, z, R() * r * 3, Math.random() * r * 2.2, R() * r * 3, 0.8 + Math.random() * 0.5, 0.1, 0.05, [1, 0.7, 0.2], 1, 12, 2, 0.2);
      lights.push({ x, y: y + 1.5, z, r: r * 3, cr: 3, cg: 1.6, cb: 0.6, life: 0.45, max: 0.45 });
    },
    muzzleLight(x, y, z, col) { lights.push({ x, y, z, r: 9, cr: col ? col[0] * 2 : 2, cg: col ? col[1] * 1.6 : 1.5, cb: col ? col[2] * 1.2 : 0.7, life: 0.06, max: 0.06 }); },
    decal(x, y, z, nx, ny, nz) {
      const d = decals[dcur] || (decals[dcur] = {});
      d.x = x + nx * 0.012; d.y = y + ny * 0.012; d.z = z + nz * 0.012;
      d.ax = Math.abs(nx) > 0.5 ? 0 : 1; d.ay = Math.abs(ny) > 0.5 ? 0 : 1; d.az = Math.abs(nz) > 0.5 ? 0 : 1;
      dcur = (dcur + 1) % 48;
    },
    update(dt) {
      for (let i = 0; i < cap; i++) {
        const p = ps[i]; if (!p.on) continue;
        p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
        const dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr; p.vz *= dr; p.vy = (p.vy - p.grav * dt) * (p.drag && p.grav <= 0 ? dr : 1);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.grav > 0 && p.y < (G && G.L && G.L.terrain ? G.L.terrain.h(p.x, p.z) : 0) + 0.03) { p.y = (G && G.L && G.L.terrain ? G.L.terrain.h(p.x, p.z) : 0) + 0.03; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      }
      for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; if (tracers[i].life <= 0) tracers.splice(i, 1); }
      for (let i = lights.length - 1; i >= 0; i--) { lights[i].life -= dt; if (lights[i].life <= 0) lights.splice(i, 1); }
      if (wx) {
        const snow = wkind === 'snow';
        for (let i = 0; i < wcount; i++) {
          const k = i * 3;
          wx[k + 1] -= (snow ? 2.0 + (i % 5) * 0.2 : 26) * dt;
          if (snow) { wx[k] += Math.sin(wx[k + 1] * 0.7 + i) * 0.6 * dt; wx[k + 2] += Math.cos(wx[k + 1] * 0.5 + i) * 0.4 * dt; } else wx[k] -= 3 * dt;
          if (wx[k + 1] < -1) { wx[k + 1] = 18 + Math.random() * 3; wx[k] = R() * 36; wx[k + 2] = R() * 36; }
        }
      }
    },
    /* خروجی نورهای پویا برای شیدر */
    getLights(out) { for (let i = 0; i < lights.length && i < 2; i++) { const l = lights[i]; const k = l.life / l.max; out.push({ x: l.x, y: l.y, z: l.z, r: l.r, cr: l.cr * k, cg: l.cg * k, cb: l.cb * k }); } },
    draw(dyn, trans, cam) {
      for (let i = 0; i < cap; i++) {
        const p = ps[i]; if (!p.on) continue;
        const k = 1 - p.life / p.max;
        const s = p.s0 + (p.s1 - p.s0) * k;
        const a = p.a * (p.mat === 2 ? Math.min(1, p.life / p.max * 2) : Math.min(1, p.life / p.max * 1.6));
        trans.box(p.x, p.y, p.z, s, s, s, k * 6, k * 3, [p.r, p.g, p.b], a, p.mat, 0);
      }
      for (const t of tracers) trans.beam(t.x0, t.y0, t.z0, t.x1, t.y1, t.z1, 0.025, t.col, Math.min(1, t.life * 18) * 0.85, 2);
      for (const d of decals) {
        if (!d.x) continue;
        const dx = d.x - cam.x, dz = d.z - cam.z;
        if (dx * dx + dz * dz > 700) continue;
        dyn.box(d.x, d.y, d.z, d.ax ? 0.13 : 0.012, d.ay ? 0.13 : 0.012, d.az ? 0.13 : 0.012, 0, 0, [0.04, 0.04, 0.04], 0.85, 0, 0);
      }
      if (wx) {
        const snow = wkind === 'snow';
        for (let i = 0; i < wcount; i++) {
          const k = i * 3;
          const x = cam.x + wx[k], y = wx[k + 1], z = cam.z + wx[k + 2];
          if (snow) trans.box(x, y, z, 0.07, 0.07, 0.07, 0, 0, [0.95, 0.97, 1], 0.85, 2, 0);
          else trans.beam(x, y, z, x + 0.1, y + 0.6, z, 0.012, [0.75, 0.82, 0.95], 0.35, 2);
        }
      }
    },
  };
  api.setQuality('medium');
  return api;
})();
