'use strict';
/* رابط کاربری فارسی/راست‌چین: منوها، فروشگاه، HUD، مأموریت‌های روزانه و دستاوردها */
function t(fa, en) { return Store.d.settings.lang === 'en' && en !== undefined && en !== '' ? en : fa; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const nf = (n) => Math.round(n).toLocaleString(Store.d.settings.lang === 'en' ? 'en-US' : 'fa-IR');
const pn = (n) => String(n).replace(/\d/g, (d) => (Store.d.settings.lang === 'en' ? d : '۰۱۲۳۴۵۶۷۸۹'[d]));
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return pn(String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')); };

/* ===================== مأموریت‌های روزانه ===================== */
const DAILY_POOL = [
  { k: 'kills', n: [20, 35, 55], fa: 'دشمن را از بین ببر', en: 'Eliminate enemies' },
  { k: 'head', n: [3, 6, 10], fa: 'ضربهٔ سر بزن', en: 'Land headshots' },
  { k: 'grenade', n: [1, 3, 5], fa: 'دشمن را با نارنجک بکش', en: 'Kill enemies with grenades' },
  { k: 'missions', n: [1, 2, 3], fa: 'مأموریت را با موفقیت تمام کن', en: 'Complete missions' },
];
const Daily = {
  today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  ensure() {
    const D = Store.d.daily, td = this.today();
    if (D.date === td && D.tasks.length) return;
    let seed = 0; for (const c of td) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rnd = mulberry32(seed || 7);
    const pool = DAILY_POOL.slice().sort(() => rnd() - 0.5).slice(0, 3);
    D.date = td; D.progress = {}; D.claimed = {};
    D.tasks = pool.map((p) => { const lv = Math.floor(rnd() * 3); return { k: p.k, n: p.n[lv], coins: 250 + lv * 200, xp: 60 + lv * 50 }; });
    Store.saveSoon();
  },
  tick(k, n) { this.ensure(); const D = Store.d.daily; D.progress[k] = (D.progress[k] || 0) + n; Store.saveSoon(); },
  claim(i) {
    const D = Store.d.daily, tk = D.tasks[i];
    if (!tk || D.claimed[i] || (D.progress[tk.k] || 0) < tk.n) return false;
    D.claimed[i] = true; Store.d.coins += tk.coins; Store.d.xp += tk.xp; Store.save(); return true;
  },
};

/* ===================== دستاوردها ===================== */
const ACHS = [
  { id: 'first', fa: 'اولین خون', en: 'First Blood', d: 'یک دشمن را بکش', de: 'Kill one enemy', coins: 50, ok: (s) => s.stats.kills >= 1 },
  { id: 'k100', fa: 'شکارچی', en: 'Hunter', d: '۱۰۰ دشمن را بکش', de: 'Kill 100 enemies', coins: 300, ok: (s) => s.stats.kills >= 100 },
  { id: 'k500', fa: 'ماشین جنگی', en: 'War Machine', d: '۵۰۰ دشمن را بکش', de: 'Kill 500 enemies', coins: 800, ok: (s) => s.stats.kills >= 500 },
  { id: 'h25', fa: 'تک‌تیرانداز ماهر', en: 'Marksman', d: '۲۵ ضربهٔ سر بزن', de: 'Land 25 headshots', coins: 300, ok: (s) => s.stats.headshots >= 25 },
  { id: 'g5', fa: 'استاد انفجار', en: 'Demolition', d: '۵ کشتن با نارنجک', de: '5 grenade kills', coins: 250, ok: (s) => s.stats.grenadeKills >= 5 },
  { id: 'm1', fa: 'اولین عملیات', en: 'First Op', d: 'یک مأموریت را تمام کن', de: 'Finish one mission', coins: 100, ok: (s) => s.stats.missionsDone >= 1 },
  { id: 'm4', fa: 'سرباز کهنه‌کار', en: 'Veteran', d: '۴ مأموریت را تمام کن', de: 'Finish 4 missions', coins: 400, ok: (s) => s.stats.missionsDone >= 4 },
  { id: 'm8', fa: 'پایان کلاه‌سیاه', en: 'End of Blackcap', d: 'همهٔ ۸ مأموریت را تمام کن', de: 'Finish all 8 missions', coins: 1500, ok: (s) => s.stats.missionsDone >= 8 },
  { id: 'arm', fa: 'زرادخانه', en: 'Arsenal', d: '۴ سلاح داشته باش', de: 'Own 4 weapons', coins: 250, ok: (s) => Object.keys(s.weapons).filter((k) => s.weapons[k].owned).length >= 4 },
  { id: 'upg', fa: 'مکانیک سلاح', en: 'Gunsmith', d: '۱۰ ارتقا انجام بده', de: 'Buy 10 upgrades', coins: 250, ok: (s) => Object.keys(s.weapons).reduce((a, k) => { const u = s.weapons[k].up; return a + (u ? u.dmg + u.acc + u.rate + u.mag : 0); }, 0) >= 10 },
  { id: 'rank', fa: 'ستوان', en: 'Lieutenant', d: 'به درجهٔ ستوان برس', de: 'Reach Lieutenant', coins: 300, ok: (s) => Store.rankIndex(s.xp) >= 3 },
  { id: 'star3', fa: 'سه ستاره', en: 'Triple Star', d: 'در یک مأموریت ۳ ستاره بگیر', de: 'Get 3 stars on a mission', coins: 400, ok: (s) => Object.keys(s.missions).some((k) => s.missions[k].stars >= 3) },
  { id: 'flaw', fa: 'بی‌خدشه', en: 'Flawless', d: 'با سلامتی بالای ۸۰٪ پیروز شو', de: 'Win with over 80% health', coins: 300, ok: (s) => !!s.ach.__flawless },
];

/* ===================== رابط ===================== */
const UI = {
  cur: null, prev: [], el: {}, hudT: 0, radarT: 0, hitT: 0, radioT: 0, last: {}, shopSel: 'ar1', shopTab: 'weapons', selMission: 1, slotSel: 0,

  init() {
    const $ = (id) => document.getElementById(id);
    for (const id of ['screens', 'hud', 'objTitle', 'objSub', 'timer', 'radar', 'killfeed', 'radio', 'hitmark', 'vignette', 'hurtDirs', 'markers', 'hpFill', 'hpText', 'arFill', 'arText', 'wName', 'ammoMag', 'ammoRes', 'grenN', 'reloadBar', 'reloadFill', 'toast', 'scoreN', 'crosshair', 'nvOverlay']) this.el[id] = $(id);
    this.rctx = this.el.radar.getContext('2d');
    this.el.screens.addEventListener('click', (e) => this.onClick(e));
    this.el.screens.addEventListener('input', (e) => this.onInput(e));
    this.el.screens.addEventListener('change', (e) => this.onInput(e));
    document.getElementById('editBar').addEventListener('click', (e) => {
      const a = e.target.closest('[data-edit]'); if (!a) return;
      if (a.dataset.edit === 'reset') Controls.resetLayout();
      else { Controls.editMode(false); document.getElementById('editBar').classList.add('hidden'); Store.save(); this.show('settings'); }
    });
    // نشانگرهای هدف
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'mk'; d.innerHTML = '<b></b><span></span>'; this.el.markers.appendChild(d); }
    this.mk = Array.from(this.el.markers.children);
    Daily.ensure();
  },

  /* ---------- نمایش صفحه‌ها ---------- */
  show(name, arg) {
    if (name && this.cur && name !== this.cur && !['pause', 'result', 'splash', 'menu'].includes(name)) this.prev.push({ n: this.cur, a: this.curArg });
    if (name === 'menu' || name === 'pause' || name === 'result') this.prev = [];
    this.cur = name; this.curArg = arg;
    const sc = this.el.screens;
    if (!name) { sc.className = 'hidden'; sc.innerHTML = ''; document.body.classList.remove('inMenu'); return; }
    document.body.classList.add('inMenu');
    sc.className = 'screen s-' + name;
    sc.innerHTML = this['r_' + name](arg);
    const sel = sc.querySelector('[data-keep]'); if (sel) sel.scrollTop = this.scrollKeep || 0;
  },
  refresh() { const sc = this.el.screens; const sel = sc.querySelector('[data-keep]'); this.scrollKeep = sel ? sel.scrollTop : 0; this.show(this.cur, this.curArg); if (this.prev.length && this.prev[this.prev.length - 1].n === this.cur) this.prev.pop(); },
  back() {
    if (G && G.state === 'play') { pauseGame(); return; }
    if (this.cur === 'pause') { resumeGame(); return; }
    if (this.prev.length) { const p = this.prev.pop(); const c = this.cur; this.cur = null; this.show(p.n, p.a); this.prev = this.prev.filter((x) => x.n !== c); return; }
    if (this.cur && this.cur !== 'menu' && this.cur !== 'splash') this.show('menu');
  },
  toast(msg, ms) {
    const el = this.el.toast; el.textContent = msg; el.classList.add('on');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('on'), ms || 2200);
  },

  head(title, back) {
    return `<div class="bar"><button class="btn back" data-act="back">${t('بازگشت', 'Back')} ${Store.d.settings.lang === 'en' ? '‹' : '›'}</button><h2>${title}</h2><div class="coins">${nf(Store.d.coins)} <i class="coin"></i></div></div>`;
  },

  /* ---------- صفحه‌ها ---------- */
  r_splash() {
    return `<div class="splash"><div class="logo">${t('عملیات سایه', 'SHADOW OPERATION')}</div><div class="sub">${t('بازی تیراندازی سه‌بعدی اول‌شخص', 'First-Person 3D Shooter')}</div>
      <button class="btn big pulse" data-act="start-audio">${t('برای شروع لمس کن', 'Tap to start')}</button></div>`;
  },
  r_menu() {
    const S = Store.d, rk = Store.RANKS[Store.rank()];
    const next = Store.RANKS[Store.rank() + 1];
    const prog = next ? Math.min(100, (S.xp - rk.xp) / (next.xp - rk.xp) * 100) : 100;
    const cont = this.nextMission();
    const it = (act, fa, en, cls) => `<button class="btn menuBtn ${cls || ''}" data-act="${act}"><span>${t(fa, en)}</span></button>`;
    return `<div class="menu"><div class="menuLeft"><div class="logo sm">${t('عملیات سایه', 'SHADOW OPERATION')}</div>
      <div class="sub">${t('بازی تیراندازی سه‌بعدی اول‌شخص', 'First-Person 3D Shooter')}</div>
      <div class="card profileMini"><div class="rankIcon">${'★'.repeat(Math.min(5, Store.rank() + 1))}</div><div><b>${esc(S.name)}</b><div class="dim">${t(rk.fa, rk.en)}</div></div>
      <div class="xpbar"><i style="width:${prog}%"></i></div><div class="coins">${nf(S.coins)} <i class="coin"></i></div></div></div>
      <div class="menuGrid">
      ${it('start-game', 'شروع بازی', 'New Game', 'primary')}
      ${it('continue', 'ادامه بازی', 'Continue', 'primary')}
      ${it('levels', 'انتخاب مرحله', 'Mission Select')}
      ${it('loadout', 'انتخاب سلاح', 'Loadout')}
      ${it('shop', 'فروشگاه و ارتقا', 'Shop & Upgrades')}
      ${it('profile', 'پروفایل بازیکن', 'Profile')}
      ${it('daily', 'مأموریت‌های روزانه', 'Daily Missions')}
      ${it('ach', 'دستاوردها', 'Achievements')}
      ${it('settings', 'تنظیمات', 'Settings')}
      ${it('help', 'راهنمای بازی', 'How to Play')}
      ${it('exit', 'خروج', 'Exit', 'danger')}
      </div><div class="ver">v1.0 · ${t('مرحلهٔ بعدی', 'Next')}: ${t(cont.fa, cont.en)}</div></div>`;
  },
  nextMission() {
    for (const m of MISSIONS) { const s = Store.d.missions[m.id]; if (s && s.unlocked && !s.done) return m; }
    return MISSIONS[0];
  },
  r_levels() {
    const cards = MISSIONS.map((m) => {
      const s = Store.d.missions[m.id], lock = !(s && s.unlocked);
      const stars = s ? '★'.repeat(s.stars || 0) + '☆'.repeat(3 - (s.stars || 0)) : '☆☆☆';
      return `<button class="lvl ${lock ? 'lock' : ''} ${s && s.done ? 'done' : ''}" data-act="${lock ? 'locked' : 'brief'}" data-arg="${m.id}">
        <div class="num">${pn(m.id)}</div><div class="nm">${t(m.fa, m.en)}</div><div class="ar dim">${t(m.area, m.areaEn)}</div>
        <div class="st">${lock ? '🔒' : stars}</div>${s && s.best ? `<div class="dim sm">${t('رکورد', 'Best')}: ${nf(s.best)}</div>` : ''}</button>`;
    }).join('');
    return `${this.head(t('انتخاب مرحله', 'Mission Select'))}<div class="lvlGrid" data-keep>${cards}</div>`;
  },
  r_brief(id) {
    const m = MISSIONS[id - 1]; this.selMission = id;
    const ld = (Store.d.loadout || []).map((w) => `<span class="chip">${t(WEAPONS[w].fa, WEAPONS[w].en)}</span>`).join('');
    const env = ENV_NAMES[m.id] || '';
    return `${this.head(`${t('مأموریت', 'Mission')} ${pn(m.id)}: ${t(m.fa, m.en)}`)}
      <div class="briefWrap" data-keep><div class="card brief"><div class="dim">${t(m.area, m.areaEn)}</div>
      <p class="story">${t(m.brief, m.briefEn)}</p>
      <div class="obj"><b>${t('هدف', 'Objective')}:</b> ${t(m.obj, m.objEn)}</div>
      <div class="obj sec"><b>${t('مأموریت فرعی', 'Bonus')}:</b> ${t(m.bonus.fa, m.bonus.en)}</div>
      ${m.time ? `<div class="obj sec"><b>${t('زمان', 'Time limit')}:</b> ${fmtTime(m.time)}</div>` : ''}
      <div class="obj sec"><b>${t('جایزه', 'Reward')}:</b> ${nf(m.reward)} <i class="coin"></i></div></div>
      <div class="card"><div class="dim">${t('تجهیزات', 'Loadout')}</div><div>${m.forceWeapon ? `<span class="chip">${t(WEAPONS[m.forceWeapon].fa, WEAPONS[m.forceWeapon].en)}</span><span class="chip">${t(WEAPONS.pistol.fa, WEAPONS.pistol.en)}</span>` : ld}</div>
      <div class="btnRow"><button class="btn primary big" data-act="go" data-arg="${m.id}">${t('شروع عملیات', 'Deploy')}</button>
      <button class="btn" data-act="loadout">${t('تغییر سلاح', 'Change Weapons')}</button></div></div></div>`;
  },
  r_loadout() {
    const S = Store.d;
    const slot = (i) => { const id = S.loadout[i]; return `<button class="slot ${this.slotSel === i ? 'sel' : ''}" data-act="slot" data-arg="${i}"><div class="dim">${t(i ? 'سلاح دوم' : 'سلاح اول', i ? 'Secondary' : 'Primary')}</div><b>${id ? t(WEAPONS[id].fa, WEAPONS[id].en) : '—'}</b></button>`; };
    const list = WEAPON_ORDER.map((id) => {
      const w = WEAPONS[id], own = S.weapons[id] && S.weapons[id].owned, eq = S.loadout.includes(id);
      return `<div class="wcard ${own ? '' : 'lock'} ${eq ? 'eq' : ''}"><div class="wtop"><b>${t(w.fa, w.en)}</b><span class="dim">${this.typeName(w.type)}</span></div>
        <div class="dim sm">${w.desc}</div>${this.bars(id)}
        ${own ? `<button class="btn sm" data-act="equip" data-arg="${id}">${eq ? t('✓ انتخاب شده', '✓ Equipped') : t('انتخاب برای اسلات', 'Equip')}</button>` : `<div class="dim sm">🔒 ${t('قفل — در فروشگاه بخر', 'Locked — buy in shop')}</div>`}</div>`;
    }).join('');
    return `${this.head(t('انتخاب سلاح', 'Loadout'))}<div class="slots">${slot(0)}${slot(1)}</div><div class="wgrid" data-keep>${list}</div>`;
  },
  typeName(ty) { return { pistol: t('کلت', 'Pistol'), rifle: t('تفنگ تهاجمی', 'Assault'), smg: t('مسلسل سبک', 'SMG'), shotgun: t('شاتگان', 'Shotgun'), lmg: t('مسلسل سنگین', 'LMG'), sniper: t('تک‌تیرانداز', 'Sniper'), special: t('ویژه', 'Special') }[ty] || ty; },
  bars(id) {
    const w = WEAPONS[id], st = weaponStats(id);
    const b = (lbl, v) => `<div class="bar2"><span>${lbl}</span><i><u style="width:${Math.max(4, Math.min(100, v))}%"></u></i></div>`;
    return b(t('قدرت', 'Power'), st.dmg * Math.min(w.pellets, 4) / 150 * 100 * (w.pellets > 1 ? 1.1 : 1.3)) + b(t('سرعت', 'Rate'), 60 / st.interval / 9.5) +
      b(t('دقت', 'Accuracy'), (1 - st.spread * 11) * 100) + b(t('برد', 'Range'), w.range / 4) + b(t('خشاب', 'Mag'), st.mag / 0.8);
  },
  r_shop() {
    const S = Store.d, tab = this.shopTab;
    const tabs = `<div class="tabs"><button class="tab ${tab === 'weapons' ? 'on' : ''}" data-act="tab" data-arg="weapons">${t('سلاح‌ها', 'Weapons')}</button><button class="tab ${tab === 'gear' ? 'on' : ''}" data-act="tab" data-arg="gear">${t('تجهیزات', 'Gear')}</button></div>`;
    let body = '';
    if (tab === 'weapons') {
      const sel = this.shopSel, w = WEAPONS[sel], own = S.weapons[sel] && S.weapons[sel].owned;
      const list = WEAPON_ORDER.map((id) => { const o = S.weapons[id] && S.weapons[id].owned; return `<button class="sitem ${sel === id ? 'on' : ''}" data-act="sel" data-arg="${id}"><span>${t(WEAPONS[id].fa, WEAPONS[id].en)}</span><small>${o ? '✓' : (WEAPONS[id].rank > Store.rank() ? '🔒' : nf(WEAPONS[id].price))}</small></button>`; }).join('');
      let det = `<div class="wtop"><b class="big">${t(w.fa, w.en)}</b><span class="dim">${this.typeName(w.type)}</span></div><div class="dim sm">${w.desc}</div>${this.bars(sel)}`;
      if (!own) {
        const rankOk = Store.rank() >= w.rank, can = rankOk && S.coins >= w.price;
        det += `<div class="buyRow">${rankOk ? '' : `<div class="warn">${t('درجهٔ لازم', 'Required rank')}: ${t(Store.RANKS[w.rank].fa, Store.RANKS[w.rank].en)}</div>`}
          <button class="btn primary ${can ? '' : 'dis'}" data-act="buy" data-arg="${sel}">${t('خرید', 'Buy')} — ${nf(w.price)} <i class="coin"></i></button></div>`;
      } else {
        const up = S.weapons[sel].up;
        det += '<div class="upg">' + Object.keys(UPG).map((k) => {
          const lv = up[k], max = lv >= UPG_MAX, cost = upgCost(w, lv);
          return `<div class="urow"><span>${t(UPG[k].fa, UPG[k].en)}</span><span class="pips">${'●'.repeat(lv)}${'○'.repeat(UPG_MAX - lv)}</span>
            <button class="btn sm ${max || S.coins < cost ? 'dis' : ''}" data-act="upg" data-arg="${k}">${max ? t('حداکثر', 'MAX') : nf(cost) + ' <i class="coin"></i>'}</button></div>`;
        }).join('') + '</div>';
      }
      body = `<div class="shopCols"><div class="slist" data-keep>${list}</div><div class="sdet card" data-keep>${det}</div></div>`;
    } else {
      const g1 = S.gearGrenade || 0, g2 = S.gearArmor || 0, c1 = 500 * (g1 + 1), c2 = 700 * (g2 + 1);
      body = `<div class="gearRow">
        <div class="card gear"><b>${t('ظرفیت نارنجک', 'Grenade capacity')}</b><div class="dim sm">${t('هر سطح یک نارنجک بیشتر در ابتدای مأموریت', '+1 grenade per level at mission start')}</div>
          <div class="pips">${'●'.repeat(g1)}${'○'.repeat(3 - g1)}</div><button class="btn ${g1 >= 3 || S.coins < c1 ? 'dis' : ''}" data-act="gear" data-arg="gren">${g1 >= 3 ? t('حداکثر', 'MAX') : nf(c1) + ' <i class="coin"></i>'}</button></div>
        <div class="card gear"><b>${t('جلیقهٔ ضدگلوله', 'Body armor')}</b><div class="dim sm">${t('هر سطح ۲۵ واحد زره در ابتدای مأموریت', '+25 armor per level at mission start')}</div>
          <div class="pips">${'●'.repeat(g2)}${'○'.repeat(4 - g2)}</div><button class="btn ${g2 >= 4 || S.coins < c2 ? 'dis' : ''}" data-act="gear" data-arg="armor">${g2 >= 4 ? t('حداکثر', 'MAX') : nf(c2) + ' <i class="coin"></i>'}</button></div></div>`;
    }
    return `${this.head(t('فروشگاه و ارتقا', 'Shop & Upgrades'))}${tabs}${body}`;
  },
  r_profile() {
    const S = Store.d, st = S.stats, rk = Store.RANKS[Store.rank()], next = Store.RANKS[Store.rank() + 1];
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
    const row = (a, b) => `<div class="prow"><span>${a}</span><b>${b}</b></div>`;
    return `${this.head(t('پروفایل بازیکن', 'Player Profile'))}<div class="profWrap" data-keep>
      <div class="card"><label class="dim">${t('نام بازیکن', 'Callsign')}</label><input class="inp" data-set="name" maxlength="16" value="${esc(S.name)}">
      <div class="rankBig">${'★'.repeat(Math.min(5, Store.rank() + 1))}</div><b class="big">${t(rk.fa, rk.en)}</b>
      <div class="xpbar"><i style="width:${next ? Math.min(100, (S.xp - rk.xp) / (next.xp - rk.xp) * 100) : 100}%"></i></div>
      <div class="dim sm">XP ${nf(S.xp)}${next ? ' / ' + nf(next.xp) : ''}</div></div>
      <div class="card">${row(t('تعداد کشته‌ها', 'Kills'), nf(st.kills))}${row(t('ضربهٔ سر', 'Headshots'), nf(st.headshots))}${row(t('دقت تیراندازی', 'Accuracy'), pn(acc) + '٪')}
      ${row(t('مأموریت‌های تمام‌شده', 'Missions done'), pn(st.missionsDone) + ' / ۸')}${row(t('کشتن با نارنجک', 'Grenade kills'), nf(st.grenadeKills))}
      ${row(t('مرگ‌ها', 'Deaths'), nf(st.deaths))}${row(t('زمان بازی', 'Play time'), pn(Math.floor(st.playtime / 60)) + ' ' + t('دقیقه', 'min'))}${row(t('امتیاز کل', 'Total score'), nf(st.totalScore))}</div></div>`;
  },
  r_daily() {
    Daily.ensure();
    const D = Store.d.daily;
    const rows = D.tasks.map((tk, i) => {
      const p = DAILY_POOL.find((x) => x.k === tk.k), cur = Math.min(tk.n, D.progress[tk.k] || 0), done = cur >= tk.n, cl = D.claimed[i];
      return `<div class="card task"><div><b>${pn(tk.n)} ${t(p.fa, p.en)}</b><div class="dim sm">${t('پاداش', 'Reward')}: ${nf(tk.coins)} <i class="coin"></i> + ${pn(tk.xp)} XP</div>
        <div class="xpbar"><i style="width:${cur / tk.n * 100}%"></i></div><div class="dim sm">${pn(cur)} / ${pn(tk.n)}</div></div>
        <button class="btn ${done && !cl ? 'primary' : 'dis'}" data-act="claim" data-arg="${i}">${cl ? t('دریافت شد ✓', 'Claimed ✓') : t('دریافت جایزه', 'Claim')}</button></div>`;
    }).join('');
    return `${this.head(t('مأموریت‌های روزانه', 'Daily Missions'))}<div class="dailyWrap" data-keep>${rows}<div class="dim sm center">${t('هر روز ماموریت‌های جدید ساخته می‌شود.', 'New tasks appear every day.')}</div></div>`;
  },
  r_ach() {
    const S = Store.d;
    const cards = ACHS.map((a) => { const on = !!S.ach[a.id]; return `<div class="card ach ${on ? 'on' : ''}"><div class="ico">${on ? '🏅' : '🔒'}</div><div><b>${t(a.fa, a.en)}</b><div class="dim sm">${t(a.d, a.de)}</div><div class="dim sm">${nf(a.coins)} <i class="coin"></i></div></div></div>`; }).join('');
    return `${this.head(t('دستاوردها', 'Achievements'))}<div class="achGrid" data-keep>${cards}</div>`;
  },
  r_settings() {
    const s = Store.d.settings, opt = (key, val, lbl) => `<button class="seg ${s[key] === val ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${val}">${lbl}</button>`;
    const rng = (key, min, max, step, val) => `<input type="range" data-set="${key}" min="${min}" max="${max}" step="${step}" value="${val}">`;
    return `${this.head(t('تنظیمات', 'Settings'))}<div class="setWrap" data-keep>
      <div class="srow"><span>${t('زبان', 'Language')}</span><div class="segs">${opt('lang', 'fa', 'فارسی')}${opt('lang', 'en', 'English')}</div></div>
      <div class="srow"><span>${t('کیفیت گرافیک', 'Graphics quality')}</span><div class="segs">${opt('quality', 'low', t('پایین', 'Low'))}${opt('quality', 'medium', t('متوسط', 'Medium'))}${opt('quality', 'high', t('بالا', 'High'))}</div></div>
      <div class="srow"><span>${t('کیفیت سایه‌ها', 'Shadow quality')}</span><div class="segs">${opt('shadows', 'off', t('خاموش', 'Off'))}${opt('shadows', 'soft', t('نرم', 'Soft'))}${opt('shadows', 'hard', t('پررنگ', 'Hard'))}</div></div>
      <div class="srow"><span>${t('حساسیت دوربین', 'Look sensitivity')}</span>${rng('sens', 0.3, 2.5, 0.05, s.sens)}<b id="v-sens">${s.sens}</b></div>
      <div class="srow"><span>${t('میدان دید (FOV)', 'Field of view')}</span>${rng('fov', 60, 100, 1, s.fov)}<b id="v-fov">${s.fov}</b></div>
      <div class="srow"><span>${t('صدای موسیقی', 'Music volume')}</span>${rng('music', 0, 1, 0.05, s.music)}<b id="v-music">${Math.round(s.music * 100)}</b></div>
      <div class="srow"><span>${t('صدای افکت‌ها', 'Effects volume')}</span>${rng('sfx', 0, 1, 0.05, s.sfx)}<b id="v-sfx">${Math.round(s.sfx * 100)}</b></div>
      <div class="srow"><span>${t('اندازهٔ دکمه‌ها', 'Button size')}</span>${rng('btnScale', 0.7, 1.4, 0.05, s.btnScale)}<b id="v-btnScale">${Math.round(s.btnScale * 100)}</b></div>
      <div class="srow"><span>${t('لرزش', 'Vibration')}</span><div class="segs">${opt('vibrate', true, t('روشن', 'On'))}${opt('vibrate', false, t('خاموش', 'Off'))}</div></div>
      <div class="srow"><span>${t('کمک نشانه‌گیری', 'Aim assist')}</span><div class="segs">${opt('aimAssist', true, t('روشن', 'On'))}${opt('aimAssist', false, t('خاموش', 'Off'))}</div></div>
      <div class="srow"><span>${t('دویدن خودکار با جوی‌استیک', 'Auto-sprint on stick')}</span><div class="segs">${opt('autoSprint', true, t('روشن', 'On'))}${opt('autoSprint', false, t('خاموش', 'Off'))}</div></div>
      <div class="srow"><button class="btn" data-act="editlayout">${t('تنظیم چیدمان دکمه‌ها', 'Edit button layout')}</button>
      <button class="btn danger" data-act="reset-ask">${t('پاک کردن پیشرفت', 'Reset progress')}</button></div></div>`;
  },
  r_help() {
    const li = (a, b) => `<li><b>${a}</b> — ${b}</li>`;
    return `${this.head(t('راهنمای بازی', 'How to Play'))}<div class="helpWrap" data-keep><div class="card"><h3>${t('کنترل لمسی', 'Touch controls')}</h3><ul>
      ${li(t('سمت چپ صفحه', 'Left side'), t('کشیدن انگشت = حرکت (جوی‌استیک)', 'drag = move (joystick)'))}
      ${li(t('سمت راست صفحه', 'Right side'), t('کشیدن انگشت = چرخاندن دوربین', 'drag = look around'))}
      ${li(t('دکمهٔ بزرگ', 'Big button'), t('شلیک (می‌توانی هم‌زمان انگشت را بکشی)', 'fire (you can drag while holding)'))}
      ${li(t('هدف', 'Aim'), t('نشانه‌گیری با دوربین/اسکوپ', 'aim down sights / scope'))}
      ${li(t('خشاب', 'Reload'), t('تعویض خشاب', 'reload'))}
      ${li(t('پرش / نشستن / دویدن', 'Jump / Crouch / Sprint'), t('حرکت‌های ویژه', 'movement'))}
      ${li(t('تعویض', 'Swap'), t('جابه‌جایی بین دو سلاح', 'switch weapons'))}
      ${li(t('نارنجک', 'Grenade'), t('پرتاب نارنجک', 'throw grenade'))}
      ${li(t('دید', 'NV'), t('دید شبانه (مرحلهٔ شب)', 'night vision (night mission)'))}</ul></div>
      <div class="card"><h3>${t('رایانه', 'Keyboard & mouse')}</h3><ul>
      ${li('W A S D', t('حرکت', 'move'))}${li(t('ماوس', 'Mouse'), t('نگاه / کلیک چپ شلیک / کلیک راست نشانه‌گیری', 'look / LMB fire / RMB aim'))}
      ${li('Space', t('پرش', 'jump'))}${li('C', t('نشستن', 'crouch'))}${li('Shift', t('دویدن', 'sprint'))}${li('R', t('خشاب', 'reload'))}${li('Q', t('تعویض سلاح', 'swap'))}${li('G', t('نارنجک', 'grenade'))}${li('N', t('دید شبانه', 'night vision'))}${li('Esc', t('توقف', 'pause'))}</ul></div>
      <div class="card"><h3>${t('نکته‌ها', 'Tips')}</h3><ul>
      <li>${t('پشت موانع پناه بگیر؛ دشمنان هم پناه می‌گیرند و نیروی کمکی صدا می‌زنند.', 'Use cover; enemies also take cover and call reinforcements.')}</li>
      <li>${t('ضربهٔ سر آسیب بسیار بیشتری دارد.', 'Headshots deal far more damage.')}</li>
      <li>${t('بشکه‌های قرمز منفجر می‌شوند — دشمنان را کنارشان بکش!', 'Red barrels explode — shoot them near enemies!')}</li>
      <li>${t('با پیک‌آپ‌ها (سبز = سلامتی، زرد = مهمات) دوباره پُر شو.', 'Pick up health (green) and ammo (yellow) crates.')}</li>
      <li>${t('پیشرفت به‌صورت خودکار ذخیره می‌شود و بازی آفلاین کار می‌کند.', 'Progress saves automatically; the game works offline.')}</li></ul></div></div>`;
  },
  r_pause() {
    return `<div class="pauseBox card"><h2>${t('توقف', 'Paused')}</h2>
      <button class="btn primary" data-act="resume">${t('ادامه', 'Resume')}</button><button class="btn" data-act="restart">${t('شروع دوباره مأموریت', 'Restart mission')}</button>
      <button class="btn" data-act="settings">${t('تنظیمات', 'Settings')}</button><button class="btn danger" data-act="quit">${t('خروج به منوی اصلی', 'Quit to menu')}</button></div>`;
  },
  r_result(r) {
    const m = r.mission, row = (a, b) => `<div class="prow"><span>${a}</span><b>${b}</b></div>`;
    const next = MISSIONS[m.id];
    const stars = r.win ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '';
    return `<div class="resultBox card"><h2 class="${r.win ? 'win' : 'lose'}">${r.win ? t('مأموریت موفق', 'MISSION COMPLETE') : t('مأموریت ناموفق', 'MISSION FAILED')}</h2>
      ${r.why ? `<div class="dim center">${esc(r.why)}</div>` : ''}<div class="stars">${stars}</div>
      <div class="resCols"><div>${row(t('امتیاز', 'Score'), nf(r.score))}${row(t('دشمنان کشته‌شده', 'Kills'), pn(r.kills))}${row(t('ضربهٔ سر', 'Headshots'), pn(r.headshots))}${row(t('دقت', 'Accuracy'), pn(Math.round(r.acc * 100)) + '٪')}</div>
      <div>${row(t('زمان', 'Time'), fmtTime(r.time))}${row(t('پاداش', 'Coins'), nf(r.coins) + ' <i class="coin"></i>')}${row('XP', '+' + nf(r.xp))}
      ${r.win ? row(t('مأموریت فرعی', 'Bonus'), r.bonusOk ? '✓' : '✗') : ''}</div></div>
      ${r.rankUp ? `<div class="newAch">${t('ارتقای درجه!', 'RANK UP!')} ${t(Store.RANKS[Store.rank()].fa, Store.RANKS[Store.rank()].en)}</div>` : ''}
      ${(r.newAch || []).map((a) => `<div class="newAch">🏅 ${t(a.fa, a.en)} +${nf(a.coins)}</div>`).join('')}
      <div class="btnRow">${r.win && next ? `<button class="btn primary" data-act="go" data-arg="${next.id}">${t('مأموریت بعدی', 'Next mission')}</button>` : ''}
      <button class="btn" data-act="go" data-arg="${m.id}">${t('تلاش دوباره', 'Retry')}</button><button class="btn" data-act="shop">${t('فروشگاه', 'Shop')}</button><button class="btn" data-act="quit">${t('منوی اصلی', 'Main menu')}</button></div></div>`;
  },
  r_exit() {
    return `<div class="pauseBox card"><h2>${t('خروج از بازی؟', 'Exit game?')}</h2><div class="btnRow"><button class="btn danger" data-act="exit-yes">${t('بله، خروج', 'Yes, exit')}</button><button class="btn" data-act="back">${t('انصراف', 'Cancel')}</button></div></div>`;
  },
  r_confirmReset() {
    return `<div class="pauseBox card"><h2>${t('پاک کردن همهٔ پیشرفت؟', 'Erase all progress?')}</h2><div class="dim center">${t('این کار قابل بازگشت نیست.', 'This cannot be undone.')}</div><div class="btnRow"><button class="btn danger" data-act="reset-yes">${t('بله، پاک شود', 'Yes, erase')}</button><button class="btn" data-act="back">${t('انصراف', 'Cancel')}</button></div></div>`;
  },

  /* ---------- رویدادها ---------- */
  onClick(e) {
    const el = e.target.closest('[data-act]'); if (!el || el.classList.contains('dis') && !['claim'].includes(el.dataset.act)) { if (el && el.classList.contains('dis')) { Snd.empty(); } return; }
    Snd.init();
    const act = el.dataset.act, arg = el.dataset.arg, S = Store.d;
    if (act !== 'locked') Snd.ui();
    switch (act) {
      case 'start-audio': this.tryFullscreen(); Snd.music('menu'); this.show('menu'); break;
      case 'back': this.back(); break;
      case 'start-game': this.show('brief', 1); break;
      case 'continue': this.show('brief', this.nextMission().id); break;
      case 'levels': case 'loadout': case 'shop': case 'profile': case 'daily': case 'ach': case 'settings': case 'help': case 'exit': this.show(act); break;
      case 'locked': this.toast(t('ابتدا مرحلهٔ قبل را تمام کن', 'Finish the previous mission first')); Snd.uiBack(); break;
      case 'brief': this.show('brief', +arg); break;
      case 'go': this.show(null); this.tryFullscreen(); startMission(+arg); break;
      case 'slot': this.slotSel = +arg; this.refresh(); break;
      case 'equip': {
        const id = arg, i = this.slotSel;
        const other = S.loadout[1 - i];
        if (other === id) S.loadout[1 - i] = S.loadout[i];
        S.loadout[i] = id; Store.save(); this.slotSel = 1 - i; this.refresh(); break;
      }
      case 'tab': this.shopTab = arg; this.refresh(); break;
      case 'sel': this.shopSel = arg; this.refresh(); break;
      case 'buy': {
        const w = WEAPONS[arg];
        if (Store.rank() < w.rank) { this.toast(t('درجهٔ شما کافی نیست', 'Rank too low')); break; }
        if (S.coins < w.price) { this.toast(t('سکهٔ کافی نیست', 'Not enough coins')); break; }
        S.coins -= w.price; S.weapons[arg] = { owned: true, up: { dmg: 0, acc: 0, rate: 0, mag: 0 } };
        Snd.pickup(); Store.save(); this.toast(t('سلاح خریداری شد!', 'Weapon purchased!')); this.checkAch(); this.refresh(); break;
      }
      case 'upg': {
        const id = this.shopSel, w = WEAPONS[id], up = S.weapons[id].up, k = arg, cost = upgCost(w, up[k]);
        if (up[k] >= UPG_MAX || S.coins < cost) break;
        S.coins -= cost; up[k]++; Snd.pickup(); Store.save(); this.checkAch(); this.refresh(); break;
      }
      case 'gear': {
        if (arg === 'gren' && (S.gearGrenade || 0) < 3) { const c = 500 * ((S.gearGrenade || 0) + 1); if (S.coins >= c) { S.coins -= c; S.gearGrenade = (S.gearGrenade || 0) + 1; Snd.pickup(); } }
        if (arg === 'armor' && (S.gearArmor || 0) < 4) { const c = 700 * ((S.gearArmor || 0) + 1); if (S.coins >= c) { S.coins -= c; S.gearArmor = (S.gearArmor || 0) + 1; Snd.pickup(); } }
        Store.save(); this.refresh(); break;
      }
      case 'claim': if (Daily.claim(+arg)) { Snd.win(); this.toast(t('جایزه دریافت شد!', 'Reward claimed!')); this.checkAch(); } this.refresh(); break;
      case 'set': {
        let v = el.dataset.val; if (v === 'true') v = true; else if (v === 'false') v = false;
        S.settings[el.dataset.key] = v; Store.save(); applySettings(); this.refresh(); break;
      }
      case 'editlayout': this.show(null); Controls.editMode(true); document.getElementById('editBar').classList.remove('hidden'); break;
      case 'reset-ask': this.show('confirmReset'); break;
      case 'reset-yes': Store.reset(); applySettings(); Daily.ensure(); this.prev = []; this.show('menu'); this.toast(t('پیشرفت پاک شد', 'Progress erased')); break;
      case 'resume': resumeGame(); break;
      case 'restart': this.show(null); startMission(G.mission.id); break;
      case 'quit': quitToMenu(); break;
      case 'exit-yes': this.exitApp(); break;
    }
  },
  onInput(e) {
    const el = e.target, S = Store.d;
    if (!el.dataset.set) return;
    const k = el.dataset.set;
    if (k === 'name') { S.name = el.value.slice(0, 16) || 'سایه'; Store.saveSoon(); return; }
    const v = parseFloat(el.value);
    S.settings[k] = v;
    const lab = document.getElementById('v-' + k); if (lab) lab.textContent = (k === 'music' || k === 'sfx' || k === 'btnScale') ? Math.round(v * 100) : v;
    if (e.type === 'change') Store.save();
    if (k === 'music' || k === 'sfx') Snd.setVolumes(S.settings.music, S.settings.sfx);
    if (k === 'fov') GE.setFov(v);
    if (k === 'btnScale') Controls.applyLayout();
  },
  tryFullscreen() {
    try {
      const d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen && 'ontouchstart' in window) d.requestFullscreen().then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (er) { /* ignore */ } }).catch(() => {});
      else if (screen.orientation && screen.orientation.lock && 'ontouchstart' in window) screen.orientation.lock('landscape').catch(() => {});
    } catch (er) { /* ignore */ }
  },
  exitApp() {
    const a = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    Store.save();
    if (a && a.exitApp) { a.exitApp(); return; }
    window.close();
    this.show('menu'); this.toast(t('برای خروج، برگه یا برنامه را ببندید.', 'Close the tab/app to exit.'), 3000);
  },

  /* ---------- دستاوردها ---------- */
  checkAch() {
    const S = Store.d, out = [];
    for (const a of ACHS) {
      if (S.ach[a.id]) continue;
      if (a.id === 'rich') continue;
      if (a.ok(S)) { S.ach[a.id] = true; S.coins += a.coins; out.push(a); }
    }
    if (out.length) { Store.save(); if (!(G && G.state === 'end')) this.toast('🏅 ' + out.map((a) => t(a.fa, a.en)).join('، ')); }
    return out;
  },

  /* ---------- HUD ---------- */
  hud(on) { this.el.hud.classList.toggle('hidden', !on); this.last = {}; },
  startMissionHud(m) {
    this.el.objTitle.textContent = t(m.fa, m.en);
    this.el.killfeed.innerHTML = ''; this.el.radio.textContent = ''; this.last = {};
    this.el.vignette.style.opacity = 0; this.el.hurtDirs.innerHTML = '';
  },
  hurt(rel, dmg) {
    this.el.vignette.style.opacity = Math.min(0.9, 0.35 + dmg / 40);
    clearTimeout(this.vigT); this.vigT = setTimeout(() => { this.el.vignette.style.opacity = 0; }, 260);
    const d = document.createElement('div'); d.className = 'hd'; d.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)`;
    this.el.hurtDirs.appendChild(d); setTimeout(() => d.remove(), 900);
  },
  hitMarker(kind) {
    const h = this.el.hitmark; h.className = 'on ' + kind;
    clearTimeout(this.hmT); this.hmT = setTimeout(() => { h.className = ''; }, kind === 'kill' ? 260 : 140);
  },
  killFeed(name, head, score) {
    const d = document.createElement('div'); d.className = 'kf' + (head ? ' head' : '');
    d.textContent = `${head ? '◎ ' : ''}${name}  +${pn(score)}`;
    const kf = this.el.killfeed; kf.appendChild(d); while (kf.children.length > 4) kf.firstChild.remove();
    setTimeout(() => d.remove(), 3200);
  },
  radio(msg, _x, ms) {
    if (!msg) return;
    const r = this.el.radio; r.textContent = msg; r.classList.add('on');
    clearTimeout(this.radioT); this.radioT = setTimeout(() => r.classList.remove('on'), ms || 3000);
  },

  setTxt(id, v) { if (this.last[id] !== v) { this.last[id] = v; this.el[id].textContent = v; } },

  frame(dt) {
    const m = G.mission, e = this.el;
    this.hudT -= dt;
    // سلامتی/زره و مهمات هر فریم ارزان‌اند؛ ولی متن را فقط در صورت تغییر می‌نویسیم
    const hp = Math.ceil(P.hp);
    if (this.last.hp !== hp) { this.last.hp = hp; e.hpFill.style.width = (P.hp / P.maxHp * 100) + '%'; e.hpText.textContent = pn(hp); e.hpFill.classList.toggle('low', P.hp < 30); }
    const ar = Math.ceil(P.armor);
    if (this.last.ar !== ar) { this.last.ar = ar; e.arFill.style.width = (P.maxArmor ? P.armor / P.maxArmor * 100 : 0) + '%'; e.arText.textContent = P.maxArmor ? pn(ar) : '—'; }
    const s = P.slot(), w = P.weapon();
    this.setTxt('wName', t(w.fa, w.en)); this.setTxt('ammoMag', pn(s.mag)); this.setTxt('ammoRes', pn(s.res)); this.setTxt('grenN', pn(P.grenades));
    e.ammoMag.classList.toggle('low', s.mag <= Math.ceil(weaponStats(s.id).mag * 0.25));
    this.setTxt('scoreN', nf(G.stats.score));
    if (P.reloading) { e.reloadBar.classList.add('on'); e.reloadFill.style.width = ((1 - P.reloadT / P.reloadTotal) * 100) + '%'; } else e.reloadBar.classList.remove('on');
    // اسکوپ و دید شبانه
    const scoped = w.scoped && P.ads > 0.6;
    if (this.last.scoped !== scoped) { this.last.scoped = scoped; document.body.classList.toggle('scoped', scoped); }
    const nv = !!(P.nv && G.env.nv);
    if (this.last.nv !== nv) { this.last.nv = nv; document.body.classList.toggle('nv', nv); }
    // جای نشانه
    const sp = (w.spread * 900 * (1 + P.bloom) * (1 - P.ads * 0.5)) + 6 + Math.min(18, P.speed * 1.5);
    if (Math.abs((this.last.sp || 0) - sp) > 0.8) { this.last.sp = sp; e.crosshair.style.setProperty('--sp', sp.toFixed(1) + 'px'); }
    e.crosshair.style.opacity = (scoped || P.ads > 0.6 && w.type === 'sniper') ? 0 : 1;
    if (this.hudT > 0) return;
    this.hudT = 0.1;
    // هدف مأموریت و زمان
    let sub = '';
    switch (m.type) {
      case 'kill': sub = `${t('دشمنان باقی‌مانده', 'Hostiles left')}: ${pn(aliveCount())}`; break;
      case 'destroy': sub = `${t(m.id === 7 ? 'راکتورها' : 'مولدها', m.id === 7 ? 'Reactors' : 'Generators')}: ${pn(G.gens)} / ${pn(m.count)}`; break;
      case 'rescue': sub = `${t('گروگان نجات‌یافته', 'Hostages safe')}: ${pn(G.saved)} / ${pn(m.count)}`; break;
      case 'snipe': sub = `${t('افسران حذف‌شده', 'Officers down')}: ${pn(G.targetsKilled || 0)} / ${pn(m.count)}`; break;
      case 'boss': sub = G.boss && !G.boss.dead ? `${t('سلامتی فرمانده', 'Commander HP')}: ${pn(Math.ceil(G.boss.hp / G.boss.maxHp * 100))}٪` : ''; break;
      case 'reach': { const need = Math.ceil(G.spawnTotal * (m.needKills || 0)); sub = G.extractOn ? t('به منطقهٔ تخلیه برس!', 'Reach extraction!') : `${t('دشمنان حذف‌شده', 'Hostiles down')}: ${pn(G.stats.kills)} / ${pn(need)}`; break; }
    }
    this.setTxt('objSub', sub);
    this.setTxt('timer', m.time ? fmtTime(G.timeLeft) : fmtTime(G.time));
    e.timer.classList.toggle('low', !!m.time && G.timeLeft < 60);
    this.markers(m); this.radarDraw();
  },

  markers(m) {
    const list = [], L = G.L;
    const add = (x, y, z, label, kind, prog) => { if (list.length < 8) list.push({ x, y, z, label, kind, prog }); };
    if (m.type === 'destroy') for (const b of L.boxes) if (b.kind === 'gen' && !b.dead) add((b.x0 + b.x1) / 2, b.y1 + 1.2, (b.z0 + b.z1) / 2, t(m.id === 7 ? 'راکتور' : 'مولد', m.id === 7 ? 'Reactor' : 'Generator'), 'obj');
    if (m.type === 'rescue') {
      for (const h of G.hostages) if (h.state === 'held') add(h.x, 2.3, h.z, h.prog > 0 ? t('در حال آزادسازی ', 'Freeing ') + pn(Math.floor(h.prog / 3 * 100)) + '٪' : t('گروگان', 'Hostage'), 'obj');
      if (G.hostages.some((h) => h.state === 'freed') && L.extract) add(L.extract.x, 3, L.extract.z, t('منطقهٔ امن', 'Safe zone'), 'safe');
    }
    if (m.type === 'snipe') for (const e of G.enemies) if (e.target && !e.dead) add(e.x, e.y + 2.8, e.z, t('هدف', 'Target'), 'tgt');
    if (m.type === 'reach' && G.extractOn && L.extract) add(L.extract.x, 3, L.extract.z, t('تخلیه', 'Extract'), 'safe');
    if (m.type === 'boss' && G.boss && !G.boss.dead) add(G.boss.x, G.boss.y + 3.1, G.boss.z, t('فرمانده', 'Commander'), 'tgt');
    const out = { x: 0, y: 0 };
    for (let i = 0; i < this.mk.length; i++) {
      const el = this.mk[i], it = list[i];
      if (!it || !GE.project(it.x, it.y, it.z, out)) { el.style.display = 'none'; continue; }
      const dd = Math.hypot(it.x - P.x, it.z - P.z);
      el.style.display = ''; el.className = 'mk ' + it.kind;
      el.style.left = Math.max(4, Math.min(96, out.x * 100)) + '%'; el.style.top = Math.max(8, Math.min(88, out.y * 100)) + '%';
      el.lastChild.textContent = `${it.label} ${pn(Math.round(dd))}${t('م', 'm')}`;
    }
  },

  radarDraw() {
    const c = this.rctx, W = 120, R = 56;
    c.clearRect(0, 0, W, W);
    c.save(); c.translate(W / 2, W / 2);
    c.fillStyle = 'rgba(8,14,18,0.55)'; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(120,220,150,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.stroke(); c.beginPath(); c.arc(0, 0, R / 2, 0, 6.283); c.stroke();
    const range = 34, k = R / range, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    const plot = (x, z, col, r) => {
      const dx = x - P.x, dz = z - P.z;
      // محور جلو = بالا
      let rx = dx * cy - dz * sy, rz = dx * sy + dz * cy;
      let d = Math.hypot(rx, rz); if (d > range) { rx *= range / d; rz *= range / d; }
      c.fillStyle = col; c.beginPath(); c.arc(rx * k, rz * k, r, 0, 6.283); c.fill();
    };
    for (const e of G.enemies) if (!e.dead && (e.alerted || e.dist < 24 || e.target)) plot(e.x, e.z, e.target ? '#ffd23a' : (e.alerted ? '#ff4b3a' : '#d99a3a'), e.target ? 3.2 : 2.4);
    for (const h of G.hostages) if (h.state === 'held' || h.state === 'freed') plot(h.x, h.z, '#4db3ff', 3);
    if (G.L.extract && (G.extractOn || G.mission.type === 'rescue')) plot(G.L.extract.x, G.L.extract.z, '#3dff7a', 3.4);
    for (const p of G.pickups) if (Math.hypot(p.x - P.x, p.z - P.z) < 20) plot(p.x, p.z, p.kind === 'health' ? '#7dff9a' : '#ffe14d', 1.6);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill();
    c.restore();
  },
};

const ENV_NAMES = {};
