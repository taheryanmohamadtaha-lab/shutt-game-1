'use strict';
/* حلقهٔ اصلی بازی، منطق مأموریت‌ها، نارنجک، انفجار، گروگان‌ها و ارتباط اجزا */
let G = null;
const dynB = new GE.Batch(36000), transB = new GE.Batch(30000), vmB = new GE.Batch(5000), vmtB = new GE.Batch(1500);
const tmpLights = [];
let lastT = 0, menuAng = 0, menuLevel = null, booted = false;
const QUALITY = { low: 0.55, medium: 0.78, high: 1.0 };

function aliveCount() { let n = 0; for (const e of G.enemies) if (!e.dead) n++; return n; }

/* ======================== ساخت وضعیت بازی ======================== */
function newState(L, mission, state) {
  return {
    state, mission, L, env: L.env, enemies: [], grenades: [], pickups: [], hostages: [],
    time: 0, noiseT: 0, pathBudget: 2, flowT: 0, flowI: -1, flowJ: -1, flowAge: 0, shake: 0,
    diff: { acc: 0.82 + 0.04 * (mission ? mission.id : 1), dmg: 0.88 + 0.035 * (mission ? mission.id : 1) },
    stats: { kills: 0, headshots: 0, shots: 0, hits: 0, grenadeKills: 0, damageTaken: 0, score: 0, coins: 0 },
    gens: 0, saved: 0, targets: 0, hostageHarmed: false, boss: null, ending: 0, extractOn: false, timeLeft: 0,
    spawnTotal: 0,
    spawnGrenade, throwGrenade: throwGrenadeAt, damageBox, onKill, reinforce, onPlayerDeath,
    alertAround(x, z, r, src) { for (const e of this.enemies) if (!e.dead && !e.alerted && e !== src && Math.hypot(e.x - x, e.z - z) < r) e.alert(false); },
    flowDir(x, z, out) { return this.L.flowDir(x, z, out); },
    aliveCount,
  };
}

function setupMenu() {
  if (!menuLevel) { menuLevel = buildM1(); menuLevel.finalize(); }
  G = newState(menuLevel, null, 'menu');
  GE.setEnv(menuLevel.env); menuLevel.rebuild();
  FX.reset(menuLevel.env);
  Ctl.enabled = false; Ctl.reset(); Controls.show(false);
  UI.hud(false); document.body.classList.remove('scoped', 'nv');
}

function startMission(id) {
  const m = MISSIONS[id - 1];
  const L = m.build(); L.finalize();
  G = newState(L, m, 'play');
  GE.setEnv(L.env); GE.setFov(Store.d.settings.fov);
  P.reset(L, m);
  FX.reset(L.env);
  Enemy.n = 0;
  for (const sp of L.spawns) { const e = new Enemy(sp); G.enemies.push(e); if (sp.boss) G.boss = e; if (e.target) G.targets++; }
  G.spawnTotal = G.enemies.length;
  for (const p of L.pickups) G.pickups.push({ kind: p.kind, x: p.x, z: p.z, t: Math.random() * 6 });
  for (const h of L.hostages) G.hostages.push({ x: h.x, z: h.z, hp: 100, state: 'held', prog: 0, yaw: Math.random() * 6, t: 0 });
  G.timeLeft = m.time || 0;
  L.computeFlow(P.x, P.z);
  Snd.init(); Snd.music(m.music || L.env.music); Snd.ambience(L.env.amb2);
  Ctl.reset(); Ctl.enabled = true;
  Controls.setNV(!!L.env.nv); Controls.show(true); Controls.applyLayout();
  UI.hud(true); UI.startMissionHud(m);
  document.body.classList.toggle('night', !!L.env.nv);
  UI.radio(t(m.obj, m.objEn), '', 4500);
  Store.d.stats.shots = Store.d.stats.shots || 0;
  frameDelay = 0;
}
let frameDelay = 0;

/* ======================== انفجار و آسیب جعبه‌ها ======================== */
function explode(x, y, z, r, dmg, owner, srcBox) {
  const L = G.L;
  FX.explosion(x, y, z, r);
  const dp = Math.hypot(P.x - x, P.z - z);
  Snd.explosion(Math.max(0.25, 1 - dp / 60));
  Snd.vibrate(dp < r ? 80 : 20);
  G.shake = Math.max(G.shake, Math.max(0, 1 - dp / (r * 4)));
  // دشمنان
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, (e.y + 1) - y, e.z - z);
    if (d > r) continue;
    if (!L.los(x, y, z, e.x, e.y + 1, e.z)) continue;
    if (owner === 'enemy') continue;
    G.killSrc = owner;
    e.damage(dmg * Math.pow(1 - d / r, 0.8), false);
    G.killSrc = null;
  }
  // بازیکن
  if (P.alive && dp < r && (P.y + 1 - y) < r) {
    const d = Math.hypot(P.x - x, P.eyeY() - y, P.z - z);
    if (d < r && L.los(x, y, z, P.x, P.eyeY(), P.z)) {
      const f = Math.pow(1 - d / r, 0.8);
      P.hurt(dmg * f * (owner === 'player' ? 0.45 : 0.7), x, z);
    }
  }
  // گروگان‌ها
  for (const h of G.hostages) {
    if (h.state === 'saved' || h.hp <= 0) continue;
    const d = Math.hypot(h.x - x, 1 - y, h.z - z);
    if (d < r) {
      h.hp -= dmg * (1 - d / r); G.hostageHarmed = true;
      if (h.hp <= 0) { h.state = 'dead'; endMission(false, t('گروگان کشته شد!', 'A hostage was killed!')); }
    }
  }
  // اشیا
  for (const b of L.boxes) {
    if (b.dead || b.hp <= 0 || b === srcBox) continue;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    const d = Math.hypot(cx - x, cy - y, cz - z);
    if (d < r + 1) damageBox(b, dmg * Math.max(0.2, 1 - d / (r + 1)));
  }
}

function damageBox(b, dmg) {
  if (b.dead || !b.maxHp) return;
  b.hp -= dmg;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
  if (b.hp > 0) { FX.debris(cx, cy, cz, b.col, 1); return; }
  b.hp = 0;
  const L = G.L;
  L.remove(b);
  switch (b.kind) {
    case 'barrel': explode(cx, cy, cz, 5.2, 130, 'player', b); break;
    case 'car': explode(cx, cy, cz, 4.2, 90, 'player', b); FX.smoke(cx, cy + 1, cz, 6, true); break;
    case 'gen': {
      explode(cx, cy, cz, 5.5, 110, 'player', b);
      for (const g of L.boxes) if (g.kind === 'glow' && !g.dead && g.x0 >= b.x0 - 0.2 && g.x1 <= b.x1 + 0.2 && g.z0 >= b.z0 - 0.2 && g.z1 <= b.z1 + 0.2 && Math.abs(g.y0 - b.y1) < 0.3) L.remove(g);
      G.gens++;
      UI.radio(t(`هدف نابود شد (${G.gens}/${G.mission.count || 3})`, `Target destroyed (${G.gens}/${G.mission.count || 3})`), '', 2500);
      Snd.pickup();
      break;
    }
    default: FX.debris(cx, cy, cz, b.col, 10); FX.smoke(cx, cy, cz, 2, false);
  }
}

/* ======================== نارنجک ======================== */
function spawnGrenade(x, y, z, vx, vy, vz, hostile) { G.grenades.push({ x, y, z, vx, vy, vz, t: 0, hostile: !!hostile, rot: 0 }); }
function throwGrenadeAt(x, y, z, tx, tz, hostile) {
  const dx = tx - x, dz = tz - z, dist = Math.hypot(dx, dz);
  const T = Math.max(0.9, Math.min(2.4, dist / 11));
  spawnGrenade(x, y, z, dx / T, (0.12 - y + 0.5 * 16 * T * T) / T, dz / T, hostile);
  Snd.grenadePin();
}
function updateGrenades(dt) {
  const L = G.L;
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const g = G.grenades[i];
    g.t += dt; g.rot += dt * 8;
    g.vy -= 16 * dt;
    const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
    if (L.blocked(nx, g.z, 0.12, g.y - 0.1, 0.25)) { g.vx *= -0.45; Snd.bounce(); } else g.x = nx;
    if (L.blocked(g.x, nz, 0.12, g.y - 0.1, 0.25)) { g.vz *= -0.45; Snd.bounce(); } else g.z = nz;
    g.y += g.vy * dt;
    const gh = L.groundAt(g.x, g.z, 0.1, g.y + 0.3) + 0.12;
    if (g.y < gh) {
      g.y = gh;
      if (g.vy < -2) Snd.bounce();
      g.vy = -g.vy * 0.38; g.vx *= 0.72; g.vz *= 0.72;
      if (Math.abs(g.vy) < 1.2) g.vy = 0;
    }
    if (g.t >= GRENADE.fuse) {
      G.grenades.splice(i, 1);
      explode(g.x, g.y, g.z, GRENADE.radius, GRENADE.dmg, g.hostile ? 'enemy' : 'player');
    }
  }
}

/* ======================== کشتن، نیروی کمکی ======================== */
function onKill(e, head) {
  const d = e.d, S = G.stats;
  S.kills++; if (head) S.headshots++;
  S.score += d.score + (head ? 50 : 0); S.coins += d.coins;
  const st = Store.d.stats; st.kills++; if (head) st.headshots++;
  if (G.killSrc === 'player') { S.grenadeKills++; st.grenadeKills++; Daily.tick('grenade', 1); }
  Daily.tick('kills', 1); if (head) Daily.tick('head', 1);
  FX.blood(e.x, e.y + 1.2, e.z, 8);
  if (e.target) G.targets--, G.targetsKilled = (G.targetsKilled || 0) + 1;
  UI.killFeed(d.fa, head, d.score + (head ? 50 : 0));
  if (e.target) UI.radio(t(`افسر حذف شد (${G.targetsKilled}/${G.mission.count})`, `Officer down (${G.targetsKilled}/${G.mission.count})`), '', 2500);
  if (Math.random() < (d.boss ? 0 : 0.2)) G.pickups.push({ kind: Math.random() < 0.5 ? 'health' : 'ammo', x: e.x, z: e.z, t: 0 });
  Store.saveSoon();
}
function reinforce(n, type, fa, en) {
  if (fa) UI.radio(t(fa, en), '', 3000);
  Snd.radio();
  const L = G.L;
  for (let i = 0; i < n; i++) {
    if (aliveCount() >= 26) break;
    let pt = null;
    for (let k = 0; k < 14 && !pt; k++) {
      const c = L.randomFree(P.x, P.z, 40, 1);
      if (c && Math.hypot(c.x - P.x, c.z - P.z) > 18 && !L.los(c.x, 1.5, c.z, P.x, P.eyeY(), P.z)) pt = c;
    }
    if (!pt) pt = L.randomFree(P.x, P.z, 40, 20);
    if (!pt) continue;
    const e = new Enemy({ type, x: pt.x, z: pt.z });
    e.alerted = true; e.state = 'engage'; e.reactT = 0.5;
    G.enemies.push(e);
  }
}

/* ======================== پایان مأموریت ======================== */
function endMission(win, why) {
  if (G.state !== 'play' && !(G.state === 'end' && false)) return;
  G.state = 'end'; G.ending = 0; Ctl.reset(); Ctl.enabled = false; Controls.show(false);
  document.body.classList.remove('scoped');
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  win ? Snd.win() : Snd.lose();
  Snd.music(null);
  const m = G.mission, S = G.stats, sv = Store.d.missions[m.id] || (Store.d.missions[m.id] = { unlocked: true, stars: 0, best: 0, done: false });
  const acc = S.shots ? S.hits / S.shots : 0;
  const first = !sv.done;
  let bonusOk = false;
  const b = m.bonus;
  if (b) bonusOk = b.type === 'headshots' ? S.headshots >= b.n : b.type === 'kills' ? S.kills >= b.n : b.type === 'noAlarm' ? !G.hostageHarmed : false;
  const timeBonus = win ? Math.max(0, Math.round((m.par - G.time) * 3)) : 0;
  const accBonus = win ? Math.round(acc * 500) : 0;
  const score = S.score + (win ? 500 : 0) + timeBonus + accBonus + (bonusOk && win ? 300 : 0);
  const stars = win ? 1 + (G.time <= m.par ? 1 : 0) + (bonusOk ? 1 : 0) : 0;
  const coins = Math.round(S.coins * (win ? 1 : 0.5) + (win ? m.reward * (first ? 1 : 0.4) : 0) + (win && bonusOk ? 150 : 0));
  const xp = Math.round(S.kills * 5 + (win ? m.xp * (first ? 1 : 0.5) : 20));
  const oldRank = Store.rank();
  Store.d.coins += coins; Store.d.xp += xp;
  Store.d.stats.deaths += win ? 0 : 1;
  Store.d.stats.shots += S.shots; Store.d.stats.hits += S.hits;
  Store.d.stats.playtime += Math.round(G.time); Store.d.stats.totalScore += score;
  if (win) {
    if (first) Store.d.stats.missionsDone++;
    sv.done = true; sv.stars = Math.max(sv.stars || 0, stars); sv.best = Math.max(sv.best || 0, score);
    const nx = Store.d.missions[m.id + 1]; if (MISSIONS[m.id] && !nx) Store.d.missions[m.id + 1] = { unlocked: true, stars: 0, best: 0, done: false }; else if (nx) nx.unlocked = true;
    Daily.tick('missions', 1);
    if (P.hp >= 80) Store.d.ach.__flawless = true;
  }
  Store.save();
  const res = { win, why, mission: m, score, kills: S.kills, headshots: S.headshots, acc, time: G.time, coins, xp, stars, bonusOk, timeBonus, accBonus, rankUp: Store.rank() > oldRank, first };
  const newAch = UI.checkAch(res);
  res.newAch = newAch;
  setTimeout(() => { if (G && G.state === 'end') UI.showResult(res); }, win ? 1400 : 1800);
}
function onPlayerDeath() {
  UI.radio(t('زخمی شدی!', 'You are down!'), '', 1500);
  endMission(false, t('شما کشته شدید', 'You were killed'));
}

/* ======================== گروگان‌ها ======================== */
function updateHostages(dt) {
  const L = G.L, ex = L.extract;
  for (const h of G.hostages) {
    h.t += dt;
    if (h.state === 'held') {
      const d = Math.hypot(P.x - h.x, P.z - h.z);
      if (d < 3.2 && P.alive) {
        h.prog += dt;
        if (h.prog >= 3) { h.state = 'freed'; Snd.pickup(); UI.radio(t('گروگان آزاد شد! او را به منطقهٔ امن ببر', 'Hostage freed! Escort to the safe zone'), '', 3000); }
      } else h.prog = Math.max(0, h.prog - dt * 0.5);
    } else if (h.state === 'freed') {
      const dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz);
      if (d > 2.6) { L.move(h, dx / d * 4.4 * dt, dz / d * 4.4 * dt, 0.35, 0, 1.7); h.moving = true; } else h.moving = false;
      h.yaw = Math.atan2(-dx, -dz);
      if (ex && Math.hypot(h.x - ex.x, h.z - ex.z) < ex.r) { h.state = 'saved'; G.saved++; Snd.pickup(); UI.radio(t(`گروگان نجات یافت (${G.saved}/${G.mission.count})`, `Hostage safe (${G.saved}/${G.mission.count})`), '', 2500); }
    }
  }
}

/* ======================== پیک‌آپ‌ها ======================== */
function updatePickups(dt) {
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; p.t += dt;
    if (Math.hypot(P.x - p.x, P.z - p.z) < 1.5 && Math.abs(P.y - (G.L.terrain ? G.L.terrain.h(p.x, p.z) : 0)) < 2.5) {
      if (p.kind === 'health') { if (P.hp >= P.maxHp) continue; P.heal(45); UI.radio(t('+ سلامتی', '+ Health'), '', 1200); }
      else { P.addAmmo(0.5); if (P.grenades < P.maxGrenades) P.grenades++; UI.radio(t('+ مهمات', '+ Ammo'), '', 1200); }
      Snd.pickup(); G.pickups.splice(i, 1);
    }
  }
}

/* ======================== منطق مأموریت ======================== */
function checkMission(dt) {
  const m = G.mission, L = G.L;
  if (m.time) {
    G.timeLeft = m.time - G.time;
    if (G.timeLeft <= 0) { endMission(false, t('زمان تمام شد', 'Time is up')); return; }
  }
  let done = false;
  switch (m.type) {
    case 'kill': done = aliveCount() === 0; break;
    case 'destroy': done = G.gens >= m.count; break;
    case 'rescue': done = G.saved >= m.count; break;
    case 'snipe': done = (G.targetsKilled || 0) >= m.count; break;
    case 'boss': done = G.boss && G.boss.dead; break;
    case 'reach': {
      const need = Math.ceil(G.spawnTotal * (m.needKills || 0));
      G.extractOn = G.stats.kills >= need;
      const ex = L.extract;
      if (G.extractOn && ex && Math.hypot(P.x - ex.x, P.z - ex.z) < ex.r) done = true;
      break;
    }
  }
  if (done) endMission(true);
}

/* ======================== به‌روزرسانی ======================== */
function update(dt) {
  const L = G.L;
  G.time += dt; G.noiseT -= dt; G.pathBudget = 2; G.shake = Math.max(0, G.shake - dt * 1.6);
  if (Ctl.take('pause')) { pauseGame(); return; }
  P.update(dt);
  // میدان جریان
  G.flowT -= dt;
  if (G.flowT <= 0) {
    G.flowT = 0.3;
    const ci = L.cx(P.x), cj = L.cx(P.z);
    if (ci !== G.flowI || cj !== G.flowJ || G.time - G.flowAge > 2 || L.navDirty) { G.flowI = ci; G.flowJ = cj; G.flowAge = G.time; L.computeFlow(P.x, P.z); }
  }
  for (const e of G.enemies) e.update(dt);
  updateGrenades(dt); updatePickups(dt); updateHostages(dt);
  FX.update(dt);
  if (L.dirty) L.rebuild();
  if (G.state === 'play') checkMission(dt);
  // حذف اجساد قدیمی
  if (G.enemies.length > 40) G.enemies = G.enemies.filter((e) => !e.dead || e.deadT < 7.5);
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause'; Ctl.reset(); Ctl.enabled = false; Controls.show(false);
  if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  UI.show('pause');
}
function resumeGame() {
  if (G.state !== 'pause') return;
  G.state = 'play'; Ctl.enabled = true; Ctl.reset(); Controls.show(true); UI.show(null);
}
function quitToMenu() {
  Snd.music('menu'); Snd.ambience(null);
  setupMenu(); UI.show('menu');
}

/* ======================== رسم ======================== */
function drawWorld(cam) {
  dynB.clear(); transB.clear(); vmB.clear(); vmtB.clear();
  const sh = Store.d.settings.shadows === 'off' ? 0 : Store.d.settings.shadows === 'hard' ? 0.5 : 0.3;
  for (const e of G.enemies) {
    const dx = e.x - cam.x, dz = e.z - cam.z;
    if (dx * dx + dz * dz > 150 * 150) continue;
    if (sh) e.drawShadow(dynB, sh);
    e.draw(dynB, transB);
  }
  // گروگان‌ها
  for (const h of G.hostages) {
    if (h.state === 'saved' || h.state === 'dead') continue;
    const sw = h.moving ? Math.sin(h.t * 9) * 0.6 : 0, cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
    const Q = (lx, ly, lz, sx, sy2, sz, c, rx, mat) => dynB.box(h.x + lx * cy + lz * sy, ly, h.z - lx * sy + lz * cy, sx, sy2, sz, h.yaw, rx || 0, c, 1, mat || 0, 0);
    Q(-0.12, 0.86 - 0.4 * Math.cos(sw), -0.4 * Math.sin(sw), 0.18, 0.8, 0.2, [0.4, 0.34, 0.24], sw);
    Q(0.12, 0.86 - 0.4 * Math.cos(-sw), 0.4 * Math.sin(sw), 0.18, 0.8, 0.2, [0.4, 0.34, 0.24], -sw);
    Q(0, 1.16, 0, 0.46, 0.6, 0.28, [0.85, 0.85, 0.88]);
    Q(0, 1.63, 0, 0.24, 0.26, 0.24, [0.7, 0.52, 0.4]);
    Q(0, 1.2, 0.22, 0.4, 0.12, 0.12, [0.7, 0.52, 0.4]);
    if (h.state === 'held') Q(0, 1.55, -0.13, 0.22, 0.05, 0.03, [0.9, 0.9, 0.9]);
    dynB.box(h.x, 0.02, h.z, 0.9, 0.02, 0.9, 0, 0, [0, 0, 0], 0.3, 0, 0);
  }
  // پیک‌آپ‌ها
  for (const p of G.pickups) {
    const y = (G.L.terrain ? G.L.terrain.h(p.x, p.z) : 0) + 0.55 + Math.sin(p.t * 2.5) * 0.08;
    if (p.kind === 'health') {
      dynB.box(p.x, y, p.z, 0.46, 0.34, 0.34, p.t, 0, [0.92, 0.92, 0.92], 1, 0, 0);
      dynB.box(p.x, y, p.z, 0.2, 0.36, 0.36, p.t, 0, [0.9, 0.1, 0.1], 1, 2, 0);
      dynB.box(p.x, y, p.z, 0.48, 0.12, 0.2, p.t, 0, [0.9, 0.1, 0.1], 1, 2, 0);
    } else {
      dynB.box(p.x, y, p.z, 0.5, 0.3, 0.34, p.t, 0, [0.2, 0.3, 0.16], 1, 0, 0);
      dynB.box(p.x, y + 0.17, p.z, 0.3, 0.05, 0.2, p.t, 0, [1, 0.8, 0.15], 1, 2, 0);
    }
    transB.beam(p.x, 0.1, p.z, p.x, 1.3, p.z, 0.05, p.kind === 'health' ? [0.2, 1, 0.3] : [1, 0.85, 0.2], 0.25, 2);
  }
  for (const g of G.grenades) dynB.box(g.x, g.y, g.z, 0.14, 0.18, 0.14, g.rot, g.rot * 0.7, g.hostile ? [0.5, 0.15, 0.1] : [0.15, 0.2, 0.12], 1, 0, 0);
  // منطقهٔ تخلیه
  const ex = G.L.extract;
  if (ex && (G.mission.type === 'rescue' || G.extractOn)) {
    const pulse = 0.5 + 0.3 * Math.sin(G.time * 3);
    transB.beam(ex.x, 0, ex.z, ex.x, 14, ex.z, 0.22, [0.2, 1, 0.45], 0.35 * pulse + 0.15, 2);
    for (let a = 0; a < 16; a++) { const an = a / 16 * 6.283; transB.box(ex.x + Math.cos(an) * ex.r, 0.15, ex.z + Math.sin(an) * ex.r, 0.35, 0.3, 0.35, 0, 0, [0.2, 1, 0.45], 0.7, 2, 0); }
  }
  // علامت مولدها
  FX.draw(dynB, transB, cam);
  if (G.state !== 'menu' && P.alive) P.drawViewmodel(vmB, vmtB);
}

function render(dt) {
  let cam, zoomFov = 0;
  if (G.state === 'menu') {
    menuAng += dt * 0.1;
    const R = 27, cx = 0, cz = -6;
    const px = cx + Math.sin(menuAng) * R, pz = cz + Math.cos(menuAng) * R, py = 8 + Math.sin(menuAng * 0.7) * 2;
    const fx = cx - px, fy = 2.5 - py, fz = cz - pz;
    cam = { x: px, y: py, z: pz, yaw: Math.atan2(-fx, -fz), pitch: Math.atan2(fy, Math.hypot(fx, fz)) };
  } else {
    cam = P.camera();
    if (!P.alive) { cam.y = Math.max(0.3, cam.y - Math.min(1.3, G.ending * 1.2)); cam.pitch = Math.max(-0.9, cam.pitch - G.ending * 0.5); }
    if (G.shake > 0) { cam.yaw += (Math.random() - 0.5) * 0.03 * G.shake; cam.pitch += (Math.random() - 0.5) * 0.03 * G.shake; }
    if (P.hurtT > 0) cam.pitch += (Math.random() - 0.5) * 0.01;
    if (P.ads > 0) {
      const w = P.weapon(), z = 1 + P.ads * (w.zoom - 1);
      zoomFov = 2 * Math.atan(Math.tan(Store.d.settings.fov * Math.PI / 360) / z);
    }
  }
  drawWorld(cam);
  // نورها
  tmpLights.length = 0;
  FX.getLights(tmpLights);
  const L = G.L;
  if (L.lights.length) {
    const arr = L.lights.map((l) => ({ l, d: (l.x - cam.x) * (l.x - cam.x) + (l.z - cam.z) * (l.z - cam.z) })).sort((a, b) => a.d - b.d);
    for (let i = 0; i < arr.length && tmpLights.length < 4; i++) tmpLights.push(arr[i].l);
  }
  const nv = G.state !== 'menu' && P.nv && G.env.nv;
  GE.render(cam, dynB, transB, vmB, vmtB, tmpLights, nv, zoomFov);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  if (!(dt > 0)) dt = 0.016;
  if (dt > 0.05) dt = 0.05;
  if (G) {
    try {
      if (G.state === 'play') { update(dt); UI.frame(dt); }
      else if (G.state === 'end') { G.ending += dt; FX.update(dt); for (const e of G.enemies) if (e.dead) e.deadT += dt; }
      else if (G.state === 'menu') FX.update(dt);
      render(dt);
    } catch (err) { console.error(err); window.__lastError = String(err && err.stack || err); }
  }
}

/* ======================== راه‌اندازی ======================== */
function applySettings() {
  const s = Store.d.settings;
  Snd.setVolumes(s.music, s.sfx);
  FX.setQuality(s.quality);
  GE.setFov(s.fov);
  document.documentElement.lang = s.lang === 'en' ? 'en' : 'fa';
  document.documentElement.dir = s.lang === 'en' ? 'ltr' : 'rtl';
  if (GE.gl) GE.resize(QUALITY[s.quality] || 0.78);
  Controls.applyLayout();
}

function boot() {
  const canvas = document.getElementById('gl');
  try { GE.init(canvas); } catch (err) {
    document.getElementById('app').innerHTML = '<div class="fatal">' + t('مرورگر یا دستگاه شما از WebGL پشتیبانی نمی‌کند.', 'WebGL is not supported on this device.') + '</div>';
    return;
  }
  Controls.init(); UI.init();
  applySettings();
  setupMenu();
  UI.show('splash');
  EModel.load('assets/models/heavy.glb');
  Forest.load('assets/models/forest.glb');
  window.addEventListener('resize', () => { GE.resize(QUALITY[Store.d.settings.quality] || 0.78); });
  window.addEventListener('orientationchange', () => setTimeout(() => GE.resize(QUALITY[Store.d.settings.quality] || 0.78), 200));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G && G.state === 'play') pauseGame(); Store.save(); } });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G && G.state === 'play' && Ctl.enabled && !('ontouchstart' in window)) pauseGame(); });
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp && CapApp.addListener) CapApp.addListener('backButton', () => UI.back());
  window.addEventListener('beforeunload', () => Store.save());
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  }
  booted = true;
  requestAnimationFrame((n) => { lastT = n; requestAnimationFrame(frame); });
}

window.addEventListener('error', (e) => { window.__lastError = e.message + ' @' + (e.filename || '') + ':' + e.lineno; });
window.addEventListener('DOMContentLoaded', boot);
