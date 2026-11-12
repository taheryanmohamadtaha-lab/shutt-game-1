'use strict';
/* بازیکن: حرکت، دوربین، شلیک، خشاب، نارنجک و مدل سلاح در دست */
const P = {
  alive: true, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, rk: 0,
  hp: 100, maxHp: 100, armor: 0, maxArmor: 0,
  crouch: 0, crouching: false, speed: 0, bob: 0, onGround: true, stepD: 0, sprintK: 0, sprinting: false,
  ads: 0, adsOn: false, slots: [], cur: 0, fireT: 0, reloadT: 0, reloadTotal: 0, reloading: false, switchT: 0, shellT: 0,
  bloom: 0, flashT: 0, rz: 0, grenades: 2, maxGrenades: 2, grenCd: 0, nv: false, hurtT: 0, regenT: 0, prevFire: false,
  lastReloadPhase: -1, kickX: 0,

  eyeY() { return this.y + 1.65 - 0.55 * this.crouch; },
  slot() { return this.slots[this.cur]; },
  weapon() { return WEAPONS[this.slots[this.cur].id]; },

  reset(L, mission) {
    this.alive = true;
    this.x = L.start.x; this.z = L.start.z; this.y = 0; this.yaw = L.start.yaw || 0; this.pitch = 0; this.rk = 0;
    this.vx = this.vz = this.vy = 0;
    this.maxHp = 100; this.hp = 100;
    this.maxArmor = 25 * (Store.d.gearArmor || 0); this.armor = this.maxArmor;
    this.crouch = 0; this.crouching = false; this.ads = 0; this.adsOn = false; this.sprinting = false;
    this.reloading = false; this.switchT = 0; this.fireT = 0; this.bloom = 0; this.flashT = 0; this.rz = 0;
    this.maxGrenades = 2 + (Store.d.gearGrenade || 0); this.grenades = this.maxGrenades; this.grenCd = 0;
    this.nv = false; this.hurtT = 0; this.regenT = 0; this.cur = 0; this.speed = 0; this.prevFire = false;
    let ids = (Store.d.loadout || []).slice(0, 2).filter((id) => Store.d.weapons[id] && Store.d.weapons[id].owned);
    if (!ids.length) ids = ['ar1'];
    if (ids.length < 2) ids.push(ids[0] === 'pistol' ? 'ar1' : 'pistol');
    if (mission && mission.forceWeapon) ids = [mission.forceWeapon, 'pistol'];
    this.slots = ids.map((id) => { const s = weaponStats(id); return { id, mag: s.mag, res: s.reserve }; });
  },

  hurt(dmg, sx, sz) {
    if (!this.alive || G.state !== 'play') return;
    if (this.armor > 0) { const ab = Math.min(this.armor, dmg * 0.6); this.armor -= ab; dmg -= ab; }
    this.hp -= dmg; this.hurtT = 0.45; this.regenT = 5.5;
    G.stats.damageTaken += dmg;
    const rel = angDiff(Math.atan2(-(sx - this.x), -(sz - this.z)), this.yaw);
    UI.hurt(rel, dmg);
    Snd.hurt(); Snd.vibrate(40);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; G.onPlayerDeath(); }
  },
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
  addAmmo(frac) {
    for (const s of this.slots) { const st = weaponStats(s.id); s.res = Math.min(st.reserve * 1.5, s.res + Math.ceil(st.reserve * frac)); }
  },

  startReload() {
    const s = this.slot(), st = weaponStats(s.id), w = this.weapon();
    if (this.reloading || s.mag >= st.mag || s.res <= 0 || this.switchT > 0) return;
    this.reloading = true; this.adsOn = false;
    this.reloadTotal = w.shellReload ? 0.5 : w.reload; this.reloadT = this.reloadTotal; this.shellT = 0.45; this.lastReloadPhase = -1;
    Snd.reload(0);
  },
  swap() {
    if (this.slots.length < 2 || this.switchT > 0) return;
    this.cur = 1 - this.cur; this.switchT = 0.4; this.reloading = false; this.adsOn = false;
    Snd.reload(1);
  },
  throwGrenade() {
    if (this.grenades <= 0 || this.grenCd > 0 || !this.alive) return;
    this.grenades--; this.grenCd = 0.8;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = -Math.sin(this.yaw) * cp, fy = sp, fz = -Math.cos(this.yaw) * cp;
    const v = 15;
    G.spawnGrenade(this.x + fx * 0.5, this.eyeY() - 0.15, this.z + fz * 0.5, fx * v, fy * v + 3.5, fz * v, false);
    Snd.grenadePin();
  },

  /* ---------- شلیک ---------- */
  fireWeapon() {
    const s = this.slot(), w = this.weapon(), st = weaponStats(s.id);
    if (s.mag <= 0) { Snd.empty(); this.fireT = 0.2; if (s.res > 0) this.startReload(); return; }
    s.mag--; this.fireT = st.interval; this.flashT = 0.055; this.rz = Math.min(0.06, this.rz + 0.025);
    G.stats.shots++; G.noiseT = 1.3;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx0 = -Math.sin(this.yaw) * cp, fy0 = sp, fz0 = -Math.cos(this.yaw) * cp;
    const rx0 = Math.cos(this.yaw), rz0 = -Math.sin(this.yaw);
    const ux0 = -Math.sin(this.yaw) * (-sp), uy0 = cp, uz0 = -Math.cos(this.yaw) * (-sp);
    const ox = this.x, oy = this.eyeY(), oz = this.z;
    const moving = Math.min(1, this.speed / 4);
    let spread = st.spread * (1 + this.bloom) * (1 + moving * 0.6) * (1 - this.ads * 0.55) * (1 - this.crouch * 0.25) * (this.onGround ? 1 : 2.2);
    if (w.scoped && this.ads < 0.8) spread *= 6;
    /* مغناطیس گلوله: اگر نشانه نزدیک بدن دشمن است، مسیر به‌سمت مرکز بدنش کشیده می‌شود */
    let fx = fx0, fy = fy0, fz = fz0, rx = rx0, rz = rz0, ux = ux0, uy = uy0, uz = uz0;
    const lvl = this.assistLevel(), A = this.assist;
    if (lvl && A && A.ang < A.rad * [0, 1.6, 2.4, 3.2][lvl] + [0, 0.012, 0.02, 0.03][lvl]) {
      const b = [0, 0.6, 0.8, 0.92][lvl];
      let sx = fx0 + (A.dx - fx0) * b, sy = fy0 + (A.dy - fy0) * b, sz = fz0 + (A.dz - fz0) * b;
      const sl = Math.hypot(sx, sy, sz); fx = sx / sl; fy = sy / sl; fz = sz / sl;
      const rl = Math.hypot(fz, fx) || 1; rx = -fz / rl; rz = fx / rl;   // right = f × up
      ux = -(fy * fx) / rl; uy = rl; uz = -(fy * fz) / rl;
    }
    const mx = ox + fx * 0.8 + rx * 0.14 * (1 - this.ads) - ux * 0.1 * (1 - this.ads);
    const my = oy + fy * 0.8 - 0.1 * (1 - this.ads), mz = oz + fz * 0.8 + rz * 0.14 * (1 - this.ads) - uz * 0.1 * (1 - this.ads);
    let anyHit = false, anyHead = false, anyKill = false;
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * spread;
      let dx = fx + (rx * Math.cos(a) + ux * Math.sin(a)) * r, dy = fy + (uy * Math.sin(a)) * r, dz = fz + (rz * Math.cos(a) + uz * Math.sin(a)) * r;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const res = this.resolveRay(ox, oy, oz, dx, dy, dz, w, st.dmg, mx, my, mz);
      if (res.hit) anyHit = true; if (res.head) anyHead = true; if (res.kill) anyKill = true;
    }
    if (anyHit) { G.stats.hits++; UI.hitMarker(anyKill ? 'kill' : anyHead ? 'head' : 'hit'); anyKill ? Snd.kill() : anyHead ? Snd.headshot() : Snd.hit(); }
    Snd.shot(w.id, 1); Snd.vibrate(8);
    FX.muzzleLight(mx, my, mz, w.energy ? [0.3, 0.6, 1] : null);
    // لگد
    const kick = w.recoil * (1 - this.ads * 0.35) * (0.8 + Math.random() * 0.4);
    this.pitch += kick; this.rk += kick; this.yaw += (Math.random() - 0.5) * kick * 0.7;
    this.bloom = Math.min(1.4, this.bloom + (w.type === 'sniper' ? 0.6 : 0.12));
    if (w.type === 'sniper' || w.type === 'shotgun') this.adsOnAfterShot = this.adsOn;
    if (s.mag <= 0 && s.res > 0) { this.queueReload = 0.35; }
  },

  resolveRay(ox, oy, oz, dx, dy, dz, w, dmg, mx, my, mz) {
    const L = G.L, out = { hit: false, head: false, kill: false };
    const H = L.ray(ox, oy, oz, dx, dy, dz, w.range, 'solid');
    const tW = H ? H.t : w.range;
    const hits = [];
    for (const e of G.enemies) {
      if (e.dead) continue;
      const h = e.rayHit(ox, oy, oz, dx, dy, dz);
      if (h && h.t < tW) { h.e = e; hits.push(h); }
    }
    hits.sort((a, b) => a.t - b.t);
    const pierce = w.pierce || 1;
    let endT = tW;
    for (let i = 0; i < hits.length && i < pierce; i++) {
      const h = hits[i];
      let m = 1; if (w.falloff) m = 1 - 0.6 * Math.min(1, h.t / w.range);
      if (i > 0) m *= 0.7;
      const killed = h.e.damage(dmg * m, h.head);
      out.hit = true; if (h.head) out.head = true; if (killed) out.kill = true;
      FX.blood(ox + dx * h.t, oy + dy * h.t, oz + dz * h.t, h.head ? 5 : 3);
      endT = h.t;
      if (i === pierce - 1 || i === hits.length - 1) { if (pierce > 1 && hits.length <= pierce) endT = tW; }
    }
    if (hits.length && pierce === 1) endT = hits[0].t;
    if (H && (!hits.length || (pierce > 1 && hits.length <= pierce))) {
      const hx = H.x, hy = H.y, hz = H.z;
      if (w.energy) FX.spark(hx, hy, hz, H.nx, H.ny, H.nz, 5, [0.4, 0.7, 1]);
      else { FX.spark(hx, hy, hz, H.nx, H.ny, H.nz, 3); FX.dust(hx, hy, hz, H.nx, H.ny, H.nz, H.box ? H.box.col : null); FX.decal(hx, hy, hz, H.nx, H.ny, H.nz); }
      if (H.box && H.box.hp > 0) G.damageBox(H.box, dmg * (w.pellets > 1 ? 1 : 1));
      endT = tW;
    }
    FX.tracer(mx, my, mz, ox + dx * endT, oy + dy * endT, oz + dz * endT, w.tracer);
    return out;
  },

  /* ---------- به‌روزرسانی ---------- */
  update(dt) {
    if (!this.alive) return;
    const L = G.L;
    const s = this.slot(), w = this.weapon(), st = weaponStats(s.id);
    /* نگاه */
    const look = Ctl.takeLook();
    const zoom = 1 + this.ads * (w.zoom - 1);
    const sens = 0.0042 * Store.d.settings.sens / Math.pow(zoom, 0.85);
    let k = sens;
    /* کمک نشانه‌گیری: اصطکاک + مغناطیس به‌سمت دشمن */
    const lv = this.assistLevel();
    const T = this.assist = lv ? this.findAssist(lv) : null;
    this.onTarget = !!(T && T.ang < T.rad * 1.15);
    const wantsFire = Ctl.fire || this.autoFiring;
    if (T) k *= [1, 0.72, 0.55, 0.42][lv];
    this.yaw -= look.x * k; this.pitch -= look.y * k;
    if (T && (wantsFire || this.ads > 0.15 || lv >= 3 && T.ang < T.rad * 2.5)) {
      const act = Math.min(1, Math.hypot(look.x, look.y) / 22);          // اگر بازیکن خودش می‌چرخد کمتر بکش
      const rate = [0, 3.5, 7, 12][lv] * (1 - 0.75 * act) * (wantsFire ? 1 : 0.55);
      const f = Math.min(1, rate * dt);
      this.yaw += T.dyaw * f; this.pitch += T.dpitch * f;
    }
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    // بازیابی لگد
    if (this.rk > 0) { const rec = Math.min(this.rk, this.rk * 4 * dt + 0.02 * dt); this.rk -= rec; this.pitch -= rec * 0.55; }
    this.bloom = Math.max(0, this.bloom - dt * 2.8);
    this.rz = Math.max(0, this.rz - dt * 0.5);

    /* رویدادها */
    if (Ctl.take('reload')) this.startReload();
    if (Ctl.take('swap')) this.swap();
    if (Ctl.take('grenade')) this.throwGrenade();
    if (Ctl.take('nv') && G.env.nv) { this.nv = !this.nv; Snd.ui(); }
    if (Ctl.take('crouch')) this.crouching = !this.crouching;
    if (Ctl.take('ads')) { if (!this.reloading) this.adsOn = !this.adsOn; }
    if (Ctl.adsHold) { if (!this.reloading) this.adsOn = true; } else if (Ctl.adsHoldReleased) { this.adsOn = false; }
    Ctl.adsHoldReleased = false;

    /* حرکت */
    const mvx = Ctl.mv.x, mvy = Ctl.mv.y;
    const mag = Math.min(1, Math.hypot(mvx, mvy));
    const firing = Ctl.fire && this.slot().mag > 0;
    this.sprinting = Ctl.sprint && mvy > 0.4 && !this.crouching && !(firing && this.ads > 0.1);
    if (this.sprinting) { this.adsOn = false; }
    let sp = 4.5 * w.move * (this.crouching ? 0.5 : 1) * (this.ads > 0 ? 1 - 0.45 * this.ads : 1) * (this.sprinting ? 1.5 : 1);
    if (this.reloading) sp *= 0.92;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const nm = mag > 0 ? mag / Math.hypot(mvx, mvy) : 0;
    const tx = (fx * mvy + rx * mvx) * nm * sp, tz = (fz * mvy + rz * mvx) * nm * sp;
    const acc = Math.min(1, dt * (this.onGround ? 11 : 2.5));
    this.vx += (tx - this.vx) * acc; this.vz += (tz - this.vz) * acc;
    this.crouch += ((this.crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    const h = this.crouch > 0.5 ? 1.1 : 1.7;
    const ox = this.x, oz = this.z;
    L.move(this, this.vx * dt, this.vz * dt, 0.34, this.y, h);
    const moved = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-4);
    this.speed += (moved - this.speed) * Math.min(1, dt * 8);

    /* پرش و گرانش */
    if (Ctl.take('jump') && this.onGround) { this.vy = 6.1; this.onGround = false; this.crouching = false; }
    this.vy -= 18 * dt; this.y += this.vy * dt;
    const gh = L.groundAt(this.x, this.z, 0.3, this.y);
    if (this.y <= gh) {
      if (this.vy < -6) { Snd.step(1.6); }
      this.y = gh; this.vy = 0; this.onGround = true;
    } else this.onGround = false;
    if (this.vy > 0) {
      const cel = L.ceilingAt(this.x, this.z, 0.3, this.y + 0.3);
      if (this.y + 1.75 > cel) { this.y = cel - 1.75; this.vy = 0; }
    }
    if (this.y < -5) this.y = 0;

    /* قدم و لرزش */
    if (this.onGround && this.speed > 0.5) {
      this.bob += this.speed * dt * 1.9;
      this.stepD += this.speed * dt;
      if (this.stepD > (this.sprinting ? 2.2 : 1.7)) { this.stepD = 0; Snd.step(this.crouching ? 0.4 : 1); }
    } else this.bob += dt * 0.8;
    this.sprintK += ((this.sprinting ? 1 : 0) - this.sprintK) * Math.min(1, dt * 9);

    /* نشانه‌گیری */
    const canAds = !this.reloading && this.switchT <= 0 && !this.sprinting;
    if (!canAds) this.adsOn = false;
    this.ads += ((this.adsOn ? 1 : 0) - this.ads) * Math.min(1, dt / Math.max(0.05, w.ads) * 1.2);
    if (this.ads < 0.01) this.ads = 0; if (this.ads > 0.99) this.ads = 1;

    /* زمان‌ها */
    this.fireT -= dt; this.switchT -= dt; this.flashT -= dt; this.grenCd -= dt; this.hurtT -= dt;
    if (this.queueReload > 0) { this.queueReload -= dt; if (this.queueReload <= 0) this.startReload(); }

    /* خشاب */
    if (this.reloading) {
      this.reloadT -= dt;
      const frac = 1 - this.reloadT / this.reloadTotal;
      if (w.shellReload) {
        if (this.reloadT <= 0) {
          if (s.mag < st.mag && s.res > 0) { s.mag++; s.res--; Snd.reload(1); this.reloadT = this.reloadTotal = 0.45; } else { this.reloading = false; Snd.reload(2); }
        }
        if (Ctl.fire && s.mag > 0) this.reloading = false;
      } else {
        if (frac > 0.5 && this.lastReloadPhase < 1) { this.lastReloadPhase = 1; Snd.reload(1); }
        if (this.reloadT <= 0) {
          const need = st.mag - s.mag, take = Math.min(need, s.res);
          s.mag += take; s.res -= take; this.reloading = false; Snd.reload(2);
        }
      }
    }

    /* شلیک */
    this.autoFiring = !!(Store.d.settings.autoFire && this.onTarget && !(w.scoped && this.ads < 0.8) && this.assist && this.assist.dist < w.range * 0.9);
    const fireIn = Ctl.fire || this.autoFiring;
    const wantFire = fireIn && !this.sprinting && this.switchT <= 0;
    if (wantFire && this.fireT <= 0 && (!this.reloading || (w.shellReload && s.mag > 0))) {
      if (w.auto || !this.prevFire) { this.reloading = false; this.fireWeapon(); }
    }
    this.prevFire = fireIn;
    if (fireIn) this.sprinting = false;

    /* ترمیم آهسته */
    this.regenT -= dt;
    if (this.regenT <= 0 && this.hp < 50) this.hp = Math.min(50, this.hp + 3 * dt);
  },

  assistLevel() {
    const v = Store.d.settings.aimAssist;
    return v === true ? 3 : v === 'low' ? 1 : v === 'med' ? 2 : v === 'high' ? 3 : 0;
  },
  /* بهترین دشمن در مخروط نشانه‌گیری؛ نتیجه شامل زاویه تا مرکز بدن و جهت لازم برای چرخش */
  findAssist(lv) {
    const cp = Math.cos(this.pitch);
    const fx = -Math.sin(this.yaw) * cp, fz = -Math.cos(this.yaw) * cp, fy = Math.sin(this.pitch);
    const ex = this.x, ey = this.eyeY(), ez = this.z, L = G.L;
    const cone = [0, 0.09, 0.16, 0.24][lv];
    let best = null, bestScore = 1e9;
    const R = this._as || (this._as = { e: null, ang: 0, rad: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, dpitch: 0, dist: 0 });
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ty = e.y + (e.crouched ? 0.95 : 1.28) * e.size;
      const dx = e.x - ex, dy = ty - ey, dz = e.z - ez;
      const d = Math.hypot(dx, dy, dz); if (d > 90 || d < 0.8) continue;
      const dot = (dx * fx + dy * fy + dz * fz) / d;
      if (dot < 0.9) continue;
      const ang = Math.acos(Math.min(1, dot));
      const rad = Math.atan(0.42 * e.size / d);          // اندازهٔ ظاهری دشمن
      if (ang > cone + rad) continue;
      if (ang < bestScore && L.los(ex, ey, ez, e.x, ty, e.z)) {
        bestScore = ang; best = e;
        R.e = e; R.ang = ang; R.rad = rad; R.dx = dx / d; R.dy = dy / d; R.dz = dz / d; R.dist = d;
        R.dyaw = angDiff(Math.atan2(-dx, -dz), this.yaw);
        R.dpitch = Math.asin(Math.max(-1, Math.min(1, dy / d))) - this.pitch;
      }
    }
    return best ? R : null;
  },

  camera() {
    const bobY = this.onGround ? Math.abs(Math.sin(this.bob)) * 0.035 * Math.min(1, this.speed / 4) * (1 - this.ads * 0.8) : 0;
    const roll = 0;
    return { x: this.x, y: this.eyeY() + bobY - (this.hurtT > 0 ? 0.02 : 0), z: this.z, yaw: this.yaw, pitch: this.pitch, roll };
  },

  /* ---------- مدل سلاح در دست (فضای دوربین) ---------- */
  drawViewmodel(vm, vmt) {
    const slot = this.slot(), w = this.weapon(), g = w.gun;
    if (w.scoped && this.ads > 0.55) return;
    const ads = this.ads, tm = performance.now() / 1000;
    const bx = Math.sin(this.bob) * 0.012 * Math.min(1, this.speed / 4) * (1 - ads * 0.9);
    const by = Math.abs(Math.cos(this.bob)) * 0.01 * Math.min(1, this.speed / 4) * (1 - ads * 0.9);
    let ox = 0.15 * (1 - ads) + bx - 0.07 * this.sprintK;
    let oy = -0.105 * (1 - ads) - g.sightY * ads * 0.98 + by - 0.04 * this.sprintK;
    let oz = -0.27 - 0.03 * ads + this.rz;
    oy += Math.sin(tm * 1.4) * 0.002;
    let rxg = this.rz * 3 + this.sprintK * 0.25, ryg = this.sprintK * 0.55;
    if (this.reloading) {
      const f = 1 - this.reloadT / Math.max(0.01, this.reloadTotal);
      const dip = Math.sin(Math.PI * Math.min(1, Math.max(0, f)));
      oy -= 0.1 * dip; rxg -= 0.45 * dip; ox -= 0.03 * dip;
    }
    if (this.switchT > 0) { const k = this.switchT / 0.4; oy -= 0.28 * Math.sin(Math.PI * Math.min(1, k)); rxg -= 0.5 * Math.sin(Math.PI * Math.min(1, k)); }
    const ca = Math.cos(rxg), sa = Math.sin(rxg), cyy = Math.cos(ryg), syy = Math.sin(ryg);
    const put = (x, y, z, sx, sy, sz, col, mat, a) => {
      // چرخش حول X سپس Y در فضای محلی سلاح
      let y2 = y * ca - z * sa, z2 = y * sa + z * ca;
      const x3 = x * cyy + z2 * syy, z3 = -x * syy + z2 * cyy;
      (mat === 2 ? vmt : vm).box(ox + x3, oy + y2, oz + z3, sx, sy, sz, ryg, rxg, col, a === undefined ? 1 : a, mat || 0, 0);
    };
    for (const p of g.parts) put(p[0], p[1], p[2], p[3], p[4], p[5], PAL[p[6]] || p[6], p[6] === 'blue' || p[6] === 'gold' ? 2 : 0);
    // دست‌ها: بازوهای مدل Heavy با IK؛ در صورت نبود مدل، دستکش‌های جعبه‌ای
    const bh = w.model.bh, bl = w.model.bl;
    const gtv = (x, y, z) => { const y2 = y * ca - z * sa, z2 = y * sa + z * ca; return [ox + x * cyy + z2 * syy, oy + y2, oz - x * syy + z2 * cyy]; };
    const gdv = (x, y, z) => { const y2 = y * ca - z * sa, z2 = y * sa + z * ca; return [x * cyy + z2 * syy, y2, -x * syy + z2 * cyy]; };
    const short = bl < 0.18;
    const lg = short ? [-0.03, -bh / 2 - 0.05, -0.05] : [-0.005, -bh / 2 - 0.03, -(bl + (w.model.guard || 0.05) * 0.55)];
    if (!(typeof Arms !== 'undefined' && Arms.draw(gtv, gdv, [0, -bh / 2 - 0.05, 0], lg))) {
      put(0.0, -bh / 2 - 0.05, 0.0, 0.07, 0.1, 0.09, PAL.glove);
      put(0.01, -bh / 2 - 0.13, 0.12, 0.075, 0.075, 0.3, PAL.glove);
      put(-0.005, -bh / 2 - 0.03, -(bl + (w.model.guard || 0.05) * 0.55), 0.08, 0.075, 0.1, PAL.glove);
      put(-0.04, -bh / 2 - 0.1, -(bl * 0.45) + 0.12, 0.07, 0.07, 0.28, PAL.glove, 0);
    }
    if (this.flashT > 0 && this.ads < 0.9 || (this.flashT > 0 && !w.scoped)) {
      const m = g.muzzle, sz = 0.06 + Math.random() * 0.05;
      put(m[0], m[1], m[2] - 0.04, sz, sz, 0.08 + Math.random() * 0.06, w.energy ? [0.4, 0.75, 1] : [1, 0.85, 0.4], 2, 0.95);
      put(m[0], m[1], m[2] - 0.04, sz * 2, 0.012, 0.02, w.energy ? [0.5, 0.8, 1] : [1, 0.7, 0.3], 2, 0.85);
      put(m[0], m[1], m[2] - 0.04, 0.012, sz * 2, 0.02, w.energy ? [0.5, 0.8, 1] : [1, 0.7, 0.3], 2, 0.85);
    }
  },
};
