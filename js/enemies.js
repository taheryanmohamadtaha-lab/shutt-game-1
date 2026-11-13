'use strict';
/* دشمنان: انواع، هوش مصنوعی (گشت، شناسایی، پناه‌گرفتن، عقب‌نشینی، نیروی کمکی، حملهٔ گروهی) و رسم مدل */

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9;
  if (Math.abs(dx) < 1e-9) { if (ox < x0 || ox > x1) return -1; } else {
    let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) tmin = a; if (b < tmax) tmax = b; if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < y0 || oy > y1) return -1; } else {
    let a = (y0 - oy) / dy, b = (y1 - oy) / dy; if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) tmin = a; if (b < tmax) tmax = b; if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < z0 || oz > z1) return -1; } else {
    let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) tmin = a; if (b < tmax) tmax = b; if (tmin > tmax) return -1;
  }
  return tmin;
}

const ETYPES = {
  soldier: {
    fa: 'سرباز', hp: 60, speed: 3.1, dmg: 7, acc: 0.55, interval: 0.5, burst: 3, burstPause: 1.1, range: 44, pref: [9, 22],
    score: 100, coins: 30, size: 1, cover: true, col: [0.3, 0.36, 0.24], vest: [0.16, 0.19, 0.14], skin: [0.7, 0.52, 0.4], helm: [0.22, 0.28, 0.18],
  },
  sniper: {
    fa: 'تک‌تیرانداز', hp: 45, speed: 0, dmg: 34, acc: 0.8, interval: 3.4, burst: 1, burstPause: 0, range: 120, pref: [0, 999],
    score: 220, coins: 60, size: 1, aim: 1.3, col: [0.24, 0.3, 0.2], vest: [0.2, 0.25, 0.17], skin: [0.66, 0.5, 0.38], helm: [0.2, 0.26, 0.16], longGun: true, noRetreat: true,
  },
  armored: {
    fa: 'نیروی زرهی', hp: 170, speed: 2.3, dmg: 9, acc: 0.55, interval: 0.45, burst: 4, burstPause: 1.2, range: 44, pref: [8, 20], armor: 0.55,
    score: 250, coins: 60, size: 1.08, cover: false, col: [0.3, 0.3, 0.36], vest: [0.2, 0.2, 0.26], skin: [0.6, 0.45, 0.35], helm: [0.14, 0.14, 0.18], bulky: true,
  },
  rusher: {
    fa: 'مهاجم سریع', hp: 55, speed: 5.4, dmg: 8, acc: 0.45, interval: 0.4, burst: 2, burstPause: 0.6, range: 22, pref: [2.5, 10], melee: true,
    score: 120, coins: 35, size: 0.97, noRetreat: true, col: [0.4, 0.22, 0.2], vest: [0.28, 0.16, 0.14], skin: [0.74, 0.55, 0.42], helm: [0.7, 0.1, 0.1], band: true,
  },
  heavy: {
    fa: 'سلاح سنگین', hp: 330, speed: 1.8, dmg: 6, acc: 0.45, interval: 0.14, burst: 14, burstPause: 1.6, range: 50, pref: [12, 28], armor: 0.7,
    score: 350, coins: 80, size: 1.2, noRetreat: true, col: [0.34, 0.26, 0.16], vest: [0.2, 0.15, 0.1], skin: [0.6, 0.44, 0.34], helm: [0.16, 0.14, 0.1], bulky: true, orange: true,
  },
  commander: {
    fa: 'فرمانده', hp: 240, speed: 2.7, dmg: 10, acc: 0.62, interval: 0.35, burst: 4, burstPause: 1.0, range: 48, pref: [10, 24], armor: 0.7,
    score: 400, coins: 100, size: 1.05, cover: true, reinf: true, col: [0.22, 0.2, 0.26], vest: [0.12, 0.1, 0.16], skin: [0.68, 0.5, 0.4], helm: [0.5, 0.06, 0.08], gold: true,
  },
  officer: {
    fa: 'افسر دشمن', hp: 75, speed: 2.8, dmg: 5, acc: 0.3, interval: 1.2, burst: 1, burstPause: 0.5, range: 34, pref: [14, 30],
    score: 300, coins: 120, size: 1, noRetreat: true, col: [0.5, 0.44, 0.3], vest: [0.4, 0.34, 0.22], skin: [0.7, 0.52, 0.4], helm: [0.42, 0.36, 0.24], gold: true,
  },
  boss: {
    fa: 'فرمانده کلاه‌سیاه', hp: 1900, speed: 2.1, dmg: 12, acc: 0.6, interval: 0.12, burst: 9, burstPause: 1.3, range: 58, pref: [10, 26], armor: 0.5, headMul: 1.8,
    score: 2000, coins: 600, size: 1.35, noRetreat: true, col: [0.1, 0.1, 0.12], vest: [0.06, 0.06, 0.08], skin: [0.6, 0.44, 0.34], helm: [0.05, 0.05, 0.06], bulky: true, boss: true,
  },
};

const _fd = { x: 0, z: 0, d: 0 };

class Enemy {
  constructor(sp) {
    const d = ETYPES[sp.type];
    this.type = sp.type; this.d = d; this.size = d.size;
    this.x = sp.x; this.z = sp.z; this.y = sp.y || 0;
    if (!sp.y) {
      const L = G.L;
      if (L.terrain) this.y = L.groundAt(this.x, this.z, 0.3, 99);
      if (L.blocked(this.x, this.z, 0.4, this.y, 1.7)) {
        const f = L.nearestFree(this.x, this.z);
        if (f) { this.x = L.cc(f[0]); this.z = L.cc(f[1]); if (L.terrain) this.y = L.groundAt(this.x, this.z, 0.3, 99); }
      }
    }
    this.home = { x: this.x, z: this.z };
    this.yaw = Math.random() * 6.28; this.maxHp = Math.round(d.hp * (G.diff.hp || 1)); this.hp = this.maxHp;
    this.hold = !!(sp.hold || sp.guardBoss); this.guardBoss = !!sp.guardBoss;
    this.target = !!sp.target;
    this.state = this.hold ? 'hold' : 'patrol';
    this.alerted = false; this.canSee = false; this.dead = false; this.deadT = 0;
    this.flash = 0; this.t = Math.random() * 10; this.legPhase = Math.random() * 6;
    this.senseT = Math.random() * 0.2; this.lastSeenT = 99; this.reactT = 0;
    this.fireT = 0.5 + Math.random(); this.burstLeft = 0; this.aim = 0; this.flashT = 0;
    this.path = null; this.pathI = 0; this.idleT = Math.random() * 2; this.stateT = 0;
    this.coverCd = 0; this.retreated = false; this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 1 + Math.random() * 2;
    this.pref = [d.pref[0], d.pref[1] * (0.7 + Math.random() * 0.4)];
    this.meleeT = 0; this.reinfT = 8; this.crouched = false; this.dist = 99;
    this.stuckT = 0; this.sx = this.x; this.sz = this.z; this.gT = 6; this.phase = 0;
    this.id = Enemy.n = (Enemy.n || 0) + 1;
  }

  eyeY() { return this.y + 1.55 * this.size; }

  alert(spread) {
    if (this.dead) return;
    if (!this.alerted) {
      this.alerted = true; this.reactT = (0.3 + Math.random() * 0.5) * (G.diff.react || 1);
      if (this.state === 'patrol' || this.state === 'hold') this.state = 'engage';
      if (spread) G.alertAround(this.x, this.z, 26, this);
    }
  }

  sense(dist, dx, dz) {
    const L = G.L, d = this.d;
    let sees = false;
    if (P.alive) {
      const vis = (G.env.nv ? 36 : 70) * (P.crouch > 0.5 ? 0.78 : 1);
      if (dist < Math.min(vis, d.range * 1.15)) {
        let inFov = this.alerted || dist < 7;
        if (!inFov) inFov = Math.abs(angDiff(Math.atan2(-dx, -dz), this.yaw)) < 1.15;
        if (inFov) sees = L.los(this.x, this.eyeY(), this.z, P.x, P.eyeY() - 0.15, P.z);
      }
      if (!sees && G.noiseT > 0 && dist < 38 && !this.alerted) { this.alert(false); }
    }
    this.canSee = sees;
    if (sees) { this.lastSeenT = 0; if (!this.alerted) this.alert(true); } else this.lastSeenT += 0.2;
  }

  moveDir(dx, dz, spd, dt) {
    const L = G.L;
    const ox = this.x, oz = this.z;
    L.move(this, dx * spd * dt, dz * spd * dt, 0.38, this.y, 1.7 * this.size);
    // جدایی از هم‌تیمی‌ها
    const es = G.enemies;
    for (let i = 0; i < es.length; i++) {
      const o = es[i]; if (o === this || o.dead) continue;
      const ex = this.x - o.x, ez = this.z - o.z, dd = ex * ex + ez * ez;
      if (dd < 0.9 && dd > 0.0001) { const k = (0.95 - Math.sqrt(dd)) * 1.2 * dt * 3; L.move(this, ex * k, ez * k, 0.38, this.y, 1.7); }
    }
    if (L.terrain) this.y = L.groundAt(this.x, this.z, 0.3, this.y + 1);
    const moved = Math.hypot(this.x - ox, this.z - oz);
    this.legPhase += moved * 3.4;
    return moved;
  }

  faceTo(yaw, dt, rate) {
    const d = angDiff(yaw, this.yaw);
    const s = Math.min(Math.abs(d), (rate || 6) * dt);
    this.yaw += Math.sign(d) * s;
  }

  followPath(spd, dt) {
    if (!this.path || this.pathI >= this.path.length) return true;
    const p = this.path[this.pathI];
    const dx = p.x - this.x, dz = p.z - this.z, dd = Math.hypot(dx, dz);
    if (dd < 0.7) { this.pathI++; return this.pathI >= this.path.length; }
    this.faceTo(Math.atan2(-dx, -dz), dt, 7);
    const mv = this.moveDir(dx / dd, dz / dd, spd, dt);
    this.stuckT = mv < spd * dt * 0.25 ? this.stuckT + dt : 0;
    if (this.stuckT > 1.2) { this.path = null; this.stuckT = 0; return true; }
    return false;
  }

  planPath(tx, tz, maxExp) {
    if (G.pathBudget <= 0) return false;
    G.pathBudget--;
    const p = G.L.path(this.x, this.z, tx, tz, maxExp || 320);
    if (p && p.length) { this.path = p; this.pathI = 0; return true; }
    this.path = null; return false;
  }

  findCover() {
    const L = G.L;
    let best = null, bd = 1e9;
    const pe = P.eyeY();
    for (let k = 0; k < 8; k++) {
      const pt = L.randomFree(this.x, this.z, 10, 4);
      if (!pt) continue;
      const dd = Math.hypot(pt.x - this.x, pt.z - this.z);
      if (dd < 2.5) continue;
      if (L.los(pt.x, this.y + 1.4, pt.z, P.x, pe, P.z)) continue;
      if (dd < bd) { bd = dd; best = pt; }
    }
    if (best && this.planPath(best.x, best.z, 300)) return true;
    return false;
  }

  /* ---------- شلیک ---------- */
  shoot(dist) {
    const d = this.d, s = this.size;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const mx = this.x + fx * 0.7 * s, mz = this.z + fz * 0.7 * s, my = this.y + 1.3 * s;
    const ty = P.y + 1.15 - P.crouch * 0.4;
    let p = d.acc * G.diff.acc * (1 - 0.45 * Math.min(1, dist / d.range));
    if (P.crouch > 0.5) p *= 0.8;
    if (P.speed > 4.5) p *= 0.82;
    p = Math.max(0.06, Math.min(0.95, p));
    let ex, ey, ez;
    const hit = Math.random() < p;
    if (hit) { ex = P.x + (Math.random() - 0.5) * 0.3; ey = ty; ez = P.z + (Math.random() - 0.5) * 0.3; }
    else {
      const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.4;
      ex = P.x + Math.cos(a) * r; ey = ty + (Math.random() - 0.4) * 1.2; ez = P.z + Math.sin(a) * r;
    }
    FX.tracer(mx, my, mz, ex, ey, ez, d.longGun ? [1, 0.3, 0.2] : [1, 0.75, 0.3]);
    this.flashT = 0.07;
    Snd.shot(d.longGun ? 'sniper' : 'enemy', Math.max(0.08, 1 - dist / 80) * (d.longGun ? 0.8 : 0.7));
    if (hit) P.hurt(d.dmg * G.diff.dmg * (d.longGun ? 1 : (1 - 0.3 * dist / d.range)), this.x, this.z);
  }

  /* ---------- به‌روزرسانی ---------- */
  update(dt) {
    if (this.dead) { this.deadT += dt; return; }
    const d = this.d, L = G.L;
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 4); this.flashT -= dt;
    this.coverCd -= dt; this.meleeT -= dt; this.fireT -= dt;
    const dx = P.x - this.x, dz = P.z - this.z, dist = Math.hypot(dx, dz);
    this.dist = dist;
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.17 + Math.random() * 0.1; this.sense(dist, dx, dz); }
    if (this.canSee) this.reactT -= dt;
    const want = Math.atan2(-dx, -dz);

    if (d.reinf || d.boss) this.special(dt, dist);

    switch (this.state) {
      case 'patrol': this.doPatrol(dt); break;
      case 'hold': {
        if (this.guardBoss) {
          const b = G.boss;
          if (b && !b.dead && Math.hypot(b.x - this.x, b.z - this.z) > 7) { if (!this.path) this.planPath(b.x, b.z, 200); this.followPath(d.speed * 0.6, dt); }
        }
        this.yaw += Math.sin(this.t * 0.7) * 0.25 * dt;
        break;
      }
      case 'engage': this.doCombat(dt, dist, dx, dz, want); break;
      case 'cover': {
        if (this.stateT > 0) {
          this.stateT -= dt; this.crouched = true;
          this.faceTo(want, dt, 3);
          if (this.stateT <= 0) { this.crouched = false; this.state = 'engage'; this.coverCd = 5; }
        } else if (this.followPath(d.speed * 1.1, dt)) {
          this.stateT = 1.5 + Math.random() * 1.8;
        }
        break;
      }
      case 'retreat': {
        this.stateT -= dt;
        const l = dist || 1;
        this.faceTo(Math.atan2(dx, dz), dt, 8);
        const mv = this.moveDir(-dx / l, -dz / l, d.speed * 1.2, dt);
        if (mv < 0.01) this.moveDir(-dz / l, dx / l, d.speed * 1.2, dt);
        if (this.stateT <= 0) this.state = 'engage';
        break;
      }
    }
  }

  doPatrol(dt) {
    const d = this.d;
    if (!this.path || this.pathI >= this.path.length) {
      this.path = null;
      if (this.idleT > 0) { this.idleT -= dt; this.yaw += Math.sin(this.t) * 0.4 * dt; return; }
      const pt = G.L.randomFree(this.home.x, this.home.z, 13, 8);
      if (pt && this.planPath(pt.x, pt.z, 260)) return;
      this.idleT = 0.8 + Math.random() * 1.5;
      return;
    }
    if (this.followPath(d.speed * 0.42, dt)) { this.path = null; this.idleT = 1 + Math.random() * 3; }
  }

  doCombat(dt, dist, dx, dz, want) {
    const d = this.d, L = G.L;
    const mobile = d.speed > 0;
    if (mobile && !this.retreated && !d.noRetreat && this.hp < this.maxHp * 0.25) {
      this.state = 'retreat'; this.stateT = 3; this.retreated = true; G.alertAround(this.x, this.z, 28, this);
      return;
    }
    if (mobile && d.cover && this.canSee && this.hp < this.maxHp * 0.72 && this.coverCd <= 0) {
      if (this.findCover()) { this.state = 'cover'; this.stateT = 0; return; }
      this.coverCd = 4;
    }
    if (this.canSee || this.lastSeenT < 1.2) this.faceTo(want, dt, d.longGun ? 3 : 6);

    /* شلیک */
    if (this.canSee && dist <= d.range && this.reactT <= 0 && P.alive) {
      const aimed = Math.abs(angDiff(want, this.yaw)) < 0.3;
      if (d.aim) {
        if (aimed) this.aim += dt; else this.aim = Math.max(0, this.aim - dt);
        if (this.aim >= d.aim && this.fireT <= 0) { this.shoot(dist); this.aim = 0; this.fireT = d.interval; }
      } else if (aimed) {
        if (this.burstLeft > 0) {
          if (this.fireT <= 0) {
            this.shoot(dist); this.burstLeft--;
            this.fireT = this.burstLeft > 0 ? d.interval : d.burstPause * (0.75 + Math.random() * 0.6);
          }
        } else if (this.fireT <= 0) this.burstLeft = d.burst;
      }
      if (d.melee && dist < 2.1 && this.meleeT <= 0) { P.hurt(15 * G.diff.dmg, this.x, this.z); this.meleeT = 0.9; Snd.hit(); }
    } else { this.aim = Math.max(0, this.aim - dt * 2); if (!this.canSee) this.burstLeft = 0; }

    if (!mobile) return;
    /* حرکت */
    if (this.canSee) {
      const l = dist || 1;
      if (dist > this.pref[1]) this.advance(dt, dx, dz, l, 1);
      else if (dist < this.pref[0]) {
        const mv = this.moveDir(-dx / l, -dz / l, d.speed * 0.8, dt);
        if (mv < 0.005) this.strafeDir = -this.strafeDir;
      } else {
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeDir = -this.strafeDir; this.strafeT = 1 + Math.random() * 2.4; }
        const mv = this.moveDir(-dz / l * this.strafeDir, dx / l * this.strafeDir, d.speed * 0.55, dt);
        if (mv < 0.004) { this.strafeDir = -this.strafeDir; this.strafeT = 1.5; }
      }
    } else {
      if (this.lastSeenT > 14) { this.alerted = false; this.state = this.hold ? 'hold' : 'patrol'; this.idleT = 1; return; }
      this.advance(dt, dx, dz, dist || 1, 1);
    }
  }

  advance(dt, dx, dz, l, k) {
    const d = this.d;
    if (G.flowDir(this.x, this.z, _fd)) {
      if (_fd.x || _fd.z) {
        const mv = this.moveDir(_fd.x, _fd.z, d.speed * k, dt);
        if (mv < d.speed * dt * 0.2) this.moveDir(-_fd.z, _fd.x, d.speed * k, dt);
        if (!this.canSee) this.faceTo(Math.atan2(-_fd.x, -_fd.z), dt, 6);
      }
    } else {
      this.moveDir(dx / l, dz / l, d.speed * k, dt);
    }
  }

  special(dt, dist) {
    const d = this.d;
    if (!this.alerted) return;
    this.reinfT -= dt;
    if (d.reinf && this.reinfT <= 0 && G.aliveCount() < 24) {
      this.reinfT = 28; G.reinforce(2, 'soldier', 'قوای کمکی دشمن در راه است!', 'Enemy reinforcements incoming!');
    }
    if (d.boss) {
      const f = this.hp / this.maxHp;
      if (this.phase === 0 && f < 0.66) { this.phase = 1; G.reinforce(3, 'soldier', 'فرمانده نیروی کمکی خواست!', 'The commander called backup!'); }
      if (this.phase === 1 && f < 0.33) { this.phase = 2; G.reinforce(2, 'armored', 'نیروی زرهی از راه رسید!', 'Armored troops arrive!'); G.reinforce(2, 'rusher', '', ''); }
      this.gT -= dt;
      if (this.gT <= 0 && this.canSee && dist > 8 && dist < 45) {
        this.gT = this.phase === 2 ? 5 : 8;
        G.throwGrenade(this.x, this.y + 1.8, this.z, P.x, P.z, true);
      }
    }
  }

  /* ---------- آسیب ---------- */
  damage(dmg, head) {
    if (this.dead) return false;
    const d = this.d;
    let m = head ? (d.headMul || 2.4) : 1;
    if (!head && d.armor) m *= d.armor;
    this.hp -= dmg * m; this.flash = 1;
    if (!this.alerted) this.alert(true);
    else if (this.state === 'hold' && d.speed === 0) this.state = 'engage';
    if (this.hp <= 0) { this.die(head); return true; }
    return false;
  }
  die(head) {
    this.dead = true; this.deadT = 0; this.hp = 0;
    G.onKill(this, head);
  }

  /* ---------- رسم ---------- */
  draw(dyn, trans) {
    const d = this.d, s = this.size;
    const fall = this.dead ? Math.min(1, this.deadT / 0.55) : 0;
    if (this.dead && this.deadT > 7.5) return;
    const fade = this.dead && this.deadT > 6 ? Math.max(0, 1 - (this.deadT - 6) / 1.5) : 1;
    const batch = fade < 1 ? trans : dyn;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const fa = fall * 1.45;
    const ca = Math.cos(fa), sa = Math.sin(fa);
    const crouchD = this.crouched ? 0.45 : 0;
    const flash = this.flash;
    const mix = (c) => flash > 0 ? [c[0] + (1 - c[0]) * flash * 0.7, c[1] + (1 - c[1]) * flash * 0.7, c[2] + (1 - c[2]) * flash * 0.7] : c;
    const self = this;
    const P_ = (lx, ly, lz, sx, sy2, sz, col, rx, mat) => {
      lx *= s; ly = (ly - (ly > 0.5 ? crouchD : 0)) * s; lz *= s;
      // سقوط به عقب حول پاها
      let y2 = ly, z2 = lz;
      if (fa) { y2 = ly * ca - lz * sa; z2 = ly * sa + lz * ca; }
      const wx = self.x + lx * cy + z2 * sy, wz = self.z - lx * sy + z2 * cy;
      batch.box(wx, self.y + y2 + (fa ? 0.12 : 0), wz, sx * s, sy2 * s, sz * s, self.yaw, (rx || 0) + fa, mix(col), fade, mat || 0, 0);
    };
    if (EModel.ready) EModel.draw(this, batch, fade);
    else {
      const sw = this.dead ? 0 : Math.sin(this.legPhase) * 0.7 * (this.crouched ? 0.2 : 1);
      const lw = d.bulky ? 0.22 : 0.18;
      // پاها (محور چرخش: لگن)
      const hip = 0.86 - crouchD * 0.5;
      for (const sgn of [-1, 1]) {
        const a = sw * sgn;
        const ly = hip - 0.4 * Math.cos(a) * (1 - crouchD * 0.3), lz = -0.4 * Math.sin(a);
        P_(sgn * 0.12, ly, lz, lw, 0.82, 0.22, d.vest, a);
      }
      // تنه
      const tw = d.bulky ? 0.6 : 0.5;
      P_(0, 1.16, 0, tw, 0.62, 0.3, d.col);
      P_(0, 1.2, -0.02, tw + 0.04, 0.48, 0.34, d.vest);
      if (d.boss) P_(0, 1.2, -0.18, 0.18, 0.18, 0.04, [1, 0.15, 0.1], 0, 2);
      if (d.orange) P_(0, 1.0, -0.17, 0.4, 0.1, 0.03, [0.95, 0.5, 0.1], 0, 2);
      // سر
      P_(0, 1.63, 0, 0.25, 0.26, 0.25, d.skin);
      P_(0, 1.74, 0.0, 0.29, 0.13, 0.3, d.helm);
      if (d.band) P_(0, 1.68, -0.01, 0.27, 0.05, 0.27, [0.85, 0.1, 0.1]);
      if (d.bulky || d.longGun) P_(0, 1.63, -0.13, 0.22, 0.08, 0.03, [0.05, 0.05, 0.07], 0, d.boss ? 2 : 0);
      if (d.gold) P_(0, 1.5, -0.17, 0.1, 0.06, 0.03, [0.9, 0.7, 0.15], 0, 2);
      // دست‌ها و سلاح
      const gl = d.longGun ? 0.95 : (d.type === 'heavy' || d.boss ? 0.8 : 0.62);
      P_(0.2, 1.2, -0.22, 0.11, 0.11, 0.5, d.col);
      P_(-0.18, 1.22, -0.34, 0.11, 0.11, 0.5, d.col);
      P_(0.12, 1.22, -0.35 - gl / 2 + 0.2, 0.08, 0.1, gl, [0.08, 0.08, 0.09]);
      if (d.boss || d.type === 'heavy') P_(0.12, 1.12, -0.42, 0.09, 0.14, 0.2, [0.12, 0.12, 0.13]);
      // جرقهٔ دهانه
      if (!this.dead && this.flashT > 0) P_(0.12, 1.22, -0.35 - gl - 0.1, 0.16, 0.16, 0.2, [1, 0.85, 0.4], 0, 2);
    }
    // لیزر تک‌تیرانداز
    if (!this.dead && d.aim && this.aim > 0.25 && this.canSee) {
      const my = this.y + 1.3 * s;
      const a = Math.min(1, this.aim / d.aim);
      trans.beam(this.x, my, this.z, P.x, P.y + 1.15, P.z, 0.012 + 0.02 * a, [1, 0.1, 0.1], 0.3 + 0.6 * a, 2);
    }
    // نشانگر هدف
    if (this.target && !this.dead) {
      const bob = Math.sin(this.t * 3) * 0.08;
      trans.box(this.x, this.y + 2.35 * s + bob, this.z, 0.2, 0.2, 0.2, this.t * 2, 0.6, [1, 0.85, 0.1], 0.9, 2, 0);
    }
  }

  drawShadow(dyn, a) {
    if (this.dead || a <= 0) return;
    dyn.box(this.x, this.y + 0.02, this.z, 0.9 * this.size, 0.02, 0.9 * this.size, 0, 0, [0, 0, 0], a, 0, 0);
  }

  /* برخورد پرتو با سر/بدن؛ برمی‌گرداند {t, head} یا null */
  rayHit(ox, oy, oz, dx, dy, dz) {
    if (this.dead) return null;
    const s = this.size, y = this.y, cd = this.crouched ? 0.45 * s : 0;
    const hw = 0.24 * s, bw = 0.44 * s;
    const th = rayAABB(ox, oy, oz, dx, dy, dz, this.x - hw, y + 1.5 * s - cd, this.z - hw, this.x + hw, y + 1.85 * s - cd, this.z + hw);
    const tb = rayAABB(ox, oy, oz, dx, dy, dz, this.x - bw, y, this.z - bw, this.x + bw, y + 1.5 * s - cd, this.z + bw);
    if (th >= 0 && (tb < 0 || th <= tb + 0.05)) return { t: th, head: true };
    if (tb >= 0) return { t: tb, head: false };
    return null;
  }
}

for (const k in ETYPES) ETYPES[k].type = k;
