// ===== ส่วนแสดงผล =====
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(res => setTimeout(res, ms));
const rarOf = id => RARITY.find(x => x.id === id);
const MEM_KEY = 'isekai_1inmil_memorial';
const MODE_LABEL = { child: '🧒 วัยเด็ก', adventure: '⚔️ ผจญภัย', service: '🏛️ สังกัด/รับราชการ', slow: '🌿 สโลว์ไลฟ์', retired: '🍵 วัยเกษียณ' };

const CFG = { len: 6, world: 'random' };
let speed = 1, timer = null, skipBless = false, blessTok = 0, selCls = null, selPath = 'free', alloc = {}, curYearEl = null;

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  document.body.classList.toggle('lock', id === 'life');
  toggleSheet(false);
  if (id !== 'home') clearInterval(homeTimer);
}

// ---------- ฉากและเสียง ----------
let homeTimer = null, homeIdx = 0, battleUntil = 0;
const seedOf = () => PX.hash(S.lookSeed) % 100000;

function heroAura() {
  if (S.cls === S.W.hidden) return '#ff5c8a';
  return S.rankIdx >= ranks().length - 2 ? '#ffd27a' : null;
}
function heroLook(age) { return PX.look(S, { aura: heroAura(), age }); }
function partnerLook(l) {
  return PX.look(S, { name: l.n, gender: l.g, partner: true, race: '', cls: null, age: S.age });
}
// คนรักที่จะวาดในฉาก (สูงสุด 4 คน): ฉากรักรวมคนที่คบหาอยู่ด้วย ฉากอื่นเฉพาะคู่ชีวิต
function partnerLooks(withDating) {
  return S.loves.filter(l => l.st === 'married' || (withDating && l.st === 'dating')).slice(0, 4).map(partnerLook);
}

function setScene(kind) {
  const o = { world: S.W.id, kind, seed: seedOf(), hero: heroLook(), enemyT: S.lastFight ? S.lastFight.t : 0 };
  if (kind === 'love' || ((kind === 'town' || kind === 'field') && S.married)) o.partners = partnerLooks(kind === 'love');
  PX.mount($('#lifeScene'), o);
}

function sceneKind(lines) {
  if (S.dead) return S.deathType === 'worldend' ? 'boss' : 'death';
  if (S.pending && S.pending.boss) return 'boss';
  if (S.doomOn && S.doom >= 50) return 'boss';
  if (S.partner && lines.some(l => l.type === 'love' && /💕|💍|👶/.test(l.t))) return 'love';
  if (lines.some(l => l.type === 'win' || l.type === 'lose') && S.lastFight) return 'battle';
  if (S.age < S.W.awakenAge) return 'home';
  if (S.mode === 'slow' || S.mode === 'retired') return 'field';
  return 'town';
}

// เพลงต่อสู้ค้างไว้อย่างน้อย 3 ปีหลังเจ็บหนัก กันเพลงสลับไปมาถี่เกินไป
function playMood(kind, lines) {
  if (kind === 'boss') return AUD.play(S.W.id, 'boss');
  if (lines.some(l => l.type === 'lose') || S.hp < maxHp() * 0.35) battleUntil = S.age + 3;
  AUD.play(S.W.id, S.age < battleUntil ? 'battle' : 'calm');
}

function yearSfx(lines) {
  const t = lines.map(l => l.type);
  if (t.includes('rare')) AUD.sfx('rare');
  else if (t.includes('rank')) AUD.sfx('rank');
  else if (t.includes('love')) AUD.sfx('love');
  else if (t.includes('lose')) AUD.sfx('lose');
  else if (t.includes('win') && speed <= 2) AUD.sfx('win');
}

function homeScene() {
  const w = WORLDS[homeIdx % WORLDS.length];
  const fake = { W: w, name: w.id + homeIdx, gender: homeIdx % 2 ? 'f' : 'm', race: { n: '' }, age: 25, cls: w.classes[homeIdx % w.classes.length] };
  const kind = ['town', 'battle', 'field', 'love', 'battle', 'town', 'home'][homeIdx % 7];
  PX.mount($('#homeScene'), {
    world: w.id, kind, seed: 1000 + homeIdx, hero: PX.look(fake), enemyT: 1 + (homeIdx * 3) % 8,
    partner: kind === 'love' ? PX.look(fake, { name: 'p' + homeIdx, gender: fake.gender === 'm' ? 'f' : 'm', partner: true }) : null,
  });
  $('#homeCap').textContent = w.icon + ' ' + w.name;
  homeIdx++;
}

function syncSnd() { $('#sndBtn').textContent = AUD.enabled ? '🔊' : '🔇'; }
$('#sndBtn').onclick = () => { AUD.setEnabled(!AUD.enabled); syncSnd(); };
document.addEventListener('pointerdown', () => AUD.unlock(), { once: true });
syncSnd();

// ---------- หน้าแรก ----------
function renderHome() {
  const random = `
    <button class="wcard random ${CFG.world === 'random' ? 'on' : ''}" data-w="random" style="--wc: var(--pink)">
      <div class="wi">🎲</div>
      <div class="wn">ให้โชคชะตาเลือก</div>
      <div class="wd">สุ่มโลกจากทั้ง 7 โลก เทพธิดาประทับใจในความกล้า จึงประทานพรเพิ่มให้</div>
      <div class="bonus"><span>โอกาสสกิลหายากสูงขึ้น</span><span>ได้สกิล 2 อย่าง</span><span>แต้มสถานะ +${RANDOM_BONUS_POINTS}</span><span>${Math.round(HIDDEN_CHANCE_RANDOM * 100)}% ปลดล็อกอาชีพลับ</span></div>
    </button>`;
  const cards = WORLDS.map(w => `
    <button class="wcard ${CFG.world === w.id ? 'on' : ''}" data-w="${w.id}" style="--wc:${w.color}">
      <span class="wdanger" title="ความอันตราย">${'☠'.repeat(Math.max(1, Math.round(w.danger * 3) - 1))}</span>
      <div class="wi">${w.icon}</div>
      <div class="wn">${w.name}</div>
      <div class="wt">${w.tag}</div>
      <div class="wd">${w.desc}</div>
    </button>`).join('');
  $('#worlds').innerHTML = random + cards;
  $$('#worlds .wcard').forEach(b => b.onclick = () => { CFG.world = b.dataset.w; renderHome(); });
  const w = worldById(CFG.world);
  $('#bornHint').textContent = w ? 'จะไปเกิดที่ ' + w.name + ' · อัตราสุ่มสกิลแบบปกติ' : 'โลกปลายทางจะถูกเปิดเผยหลังความตาย';
  renderMemorial();
  clearInterval(homeTimer);
  homeScene();
  homeTimer = setInterval(homeScene, 4500);
  AUD.play('heaven', 'calm');
}

function loadMem() { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || []; } catch (e) { return []; } }
function saveMem(list) { try { localStorage.setItem(MEM_KEY, JSON.stringify(list.slice(0, 40))); return true; } catch (e) { return false; } }

function renderMemorial() {
  const list = loadMem();
  $('#memorial').innerHTML = list.length ? list.map(m => `
    <div class="mcard">
      <div class="mn">${esc(m.name)}</div>
      <div class="mm">${m.icon} ${esc(m.world)} · ${esc(m.cls)} · อายุ ${m.age} ปี</div>
      <div class="mt">${esc(m.title)}</div>
      ${m.epi ? `<div class="me">“${esc(m.epi)}”</div>` : ''}
      <div class="mm">1 ใน ${esc(m.oneIn)}</div>
    </div>`).join('') : '<div class="mempty">ยังไม่มีชีวิตใดถูกจารึก</div>';
}

$$('#lenSeg button').forEach(b => b.onclick = () => {
  CFG.len = +b.dataset.len;
  $$('#lenSeg button').forEach(x => x.classList.toggle('on', x === b));
});

$('#btnBorn').onclick = () => {
  AUD.unlock();
  newLife(CFG.world === 'random' ? null : CFG.world);
  runBlessing();
};

// ---------- พรจากเทพธิดา ----------
function fxText(fx) {
  const t = [];
  if (fx.st) t.push(Object.entries(fx.st).map(([k, v]) => STAT_NAMES[k] + (v > 0 ? '+' : '') + v).join(' '));
  if (fx.xp) t.push('EXP ×' + fx.xp);
  if (fx.pow) t.push('พลังต่อสู้ ×' + fx.pow);
  if (fx.surv) t.push('ลดความเสียหาย ' + Math.round(fx.surv * 100) + '%');
  if (fx.gold) t.push('รายได้ ×' + fx.gold);
  if (fx.life) t.push('อายุขัย +' + fx.life);
  if (fx.revive) t.push('ฟื้นคืนชีพ ' + fx.revive + ' ครั้ง');
  if (fx.growth) t.push('แต้มต่อเลเวล +' + fx.growth);
  if (fx.charm) t.push('โอกาสความรัก ↑');
  if (fx.comp) t.push('ได้สหายง่ายขึ้น');
  return t.join(' · ');
}

function skillCard(s) {
  const R = rarOf(s.r);
  return `<div class="scard ${s.r}" style="--rc:var(--r-${s.r})">
    <div class="rr">${R.id} · ${R.name}</div>
    <div class="sn">${esc(s.n)}</div>
    <div class="sd">${esc(s.d)}</div>
    <div class="sfx">${fxText(s.fx)}</div>
  </div>`;
}

function renderOdds() {
  const col = S.random ? 1 : 0;
  $('#oddsTable').innerHTML = '<table><tr><th>ระดับ</th><th>ปกติ</th><th>ให้โชคชะตาเลือก</th></tr>' +
    RARITY.map(r => `<tr><td style="color:var(--r-${r.id})">${r.id} ${r.name}</td><td>${r.w[0]}%</td><td>${r.w[1]}%</td></tr>`).join('') +
    '</table><p class="hint">ตอนนี้ใช้อัตรา: ' + (col ? 'ให้โชคชะตาเลือก' : 'ปกติ') + '</p>';
}

async function runBlessing() {
  show('bless');
  skipBless = false;
  const tok = ++blessTok;
  $('#blessLines').innerHTML = '';
  $('#rollCards').innerHTML = '';
  $('#btnToBuild').classList.add('hidden');
  $('#btnSkip').classList.remove('hidden');
  renderOdds();
  const W = S.W;
  PX.mount($('#blessScene'), { world: 'heaven', kind: 'bless', seed: 7, goddess: PX.goddess() });
  AUD.play('heaven', 'bless');
  const line = (html, cls = '') => {
    const p = document.createElement('p');
    p.className = 'bline ' + cls;
    p.innerHTML = html;
    $('#blessLines').appendChild(p);
    return p;
  };
  // รอแบบตัดจบได้ทันทีเมื่อกดข้าม
  const pause = async ms => { const end = Date.now() + ms; while (!skipBless && Date.now() < end) await wait(40); };
  const stale = () => tok !== blessTok;

  line('ในชาติก่อน คุณ' + S.prevDeath);
  await pause(1100); if (stale()) return;
  line(S.random
    ? '“เจ้าเลือกฝากชะตาไว้กับโชค... กล้าหาญดี ข้าจะประทานพรให้มากกว่าคนอื่น”'
    : '“ขออภัยในความตายที่ไม่ทันตั้งตัว ข้าจะส่งเจ้าไปยังโลกที่เจ้าปรารถนา”', 'speak');
  await pause(1300); if (stale()) return;

  if (S.random) {
    const p = line('<span class="spin">…</span>');
    if (!skipBless) {
      for (let i = 0; i < 14 && !skipBless; i++) {
        p.innerHTML = '<span class="spin">' + pick(WORLDS).icon + ' ' + pick(WORLDS).name + '</span>';
        await wait(70 + i * 12);
      }
    }
    p.innerHTML = '<span class="spin">' + W.icon + ' ' + W.name + '</span>';
  } else {
    line('<span class="spin">' + W.icon + ' ' + W.name + '</span>');
  }
  PX.mount($('#blessScene'), { world: W.id, kind: 'bless', seed: seedOf(), goddess: PX.goddess(), hero: PX.look(S, { age: 2 }) });
  AUD.sfx('choice');
  await pause(900); if (stale()) return;

  const g = S.gender === 'm' ? 'ชาย' : 'หญิง';
  line(`เกิดเป็น <span class="chip">${S.race.n}</span> <span class="chip">เพศ${g}</span><br>ในฐานะ <span class="chip">${W.births[S.birth.id]}</span>`, 'big');
  await pause(1300); if (stale()) return;

  line('“และนี่คือพรของข้า”', 'speak');
  for (const s of S.skills) {
    await pause(800); if (stale()) return;
    $('#rollCards').insertAdjacentHTML('beforeend', skillCard(s));
    AUD.sfx(s.r === 'UR' || s.r === 'SSR' ? 'bless' : s.r === 'SR' ? 'rare' : 'win');
  }
  await pause(900); if (stale()) return;
  if (S.hidden) {
    line('🌟 สายเลือดพิเศษตื่นขึ้น — ปลดล็อก <b style="color:var(--pink)">อาชีพลับ: ' + W.hidden.n + '</b>', 'big');
    await pause(900); if (stale()) return;
  }
  line('ชะตาชีวิตนี้คือ <b style="color:var(--gold)">1 ใน ' + fmtOneIn(S.oneIn) + '</b>');
  $('#btnSkip').classList.add('hidden');
  $('#btnToBuild').classList.remove('hidden');
}

$('#btnSkip').onclick = () => { skipBless = true; };
$('#btnToBuild').onclick = () => openBuild();

// ---------- สร้างตัวละคร ----------
function openBuild() {
  const W = S.W;
  selCls = S.hidden ? W.hidden.id : W.classes[0].id;
  $('#nameInput').value = randName(S.gender);
  $('#fateBar').innerHTML =
    `<span class="fchip">${W.icon} ${W.name}</span><span class="fchip">${S.race.n} · ${S.gender === 'm' ? 'ชาย' : 'หญิง'}</span>` +
    `<span class="fchip">${W.births[S.birth.id]}</span>` +
    S.skills.map(s => `<span class="fchip sk" style="--rc:var(--r-${s.r})">${s.r} ${esc(s.n)}</span>`).join('');
  selPath = 'free';
  presetAlloc('class');
  renderPaths();
  renderClasses();
  show('build');
  AUD.play(W.id, 'calm');
}

$('#btnName').onclick = () => { $('#nameInput').value = randName(S.gender); };
$('#btnLook').onclick = () => { S.lookSeed = String(Math.random()); renderBuildScene(); };

function renderBuildScene() {
  const cls = classOf(selCls);
  PX.mount($('#buildScene'), {
    world: S.W.id, kind: 'town', seed: seedOf(),
    hero: PX.look(S, { cls, age: 25, aura: cls === S.W.hidden ? '#ff5c8a' : null }),
  });
}

function renderClasses() {
  const W = S.W;
  const list = (S.hidden ? [W.hidden] : []).concat(W.classes);
  $('#classGrid').innerHTML = list.map(c => `
    <button class="ccard ${c.id === selCls ? 'on' : ''} ${c === W.hidden ? 'secret' : ''}" data-c="${c.id}">
      <div class="ci">${c.i}</div>
      <div class="cn">${c.n}</div>
      <div class="cp">${c.path}</div>
      <div class="cd">${c.d}</div>
      <div class="cs">หลัก: ${c.main.map(k => STAT_NAMES[k]).join(' ')}${c.fx ? ' · ' + fxText(c.fx) : ''}</div>
    </button>`).join('');
  $$('#classGrid .ccard').forEach(b => b.onclick = () => {
    selCls = b.dataset.c;
    presetAlloc('class');
    renderClasses();
  });
  renderAlloc();
  renderBuildScene();
}

function renderPaths() {
  const W = S.W;
  $('#pathGrid').innerHTML = LIFE_PATHS.map(p => `
    <button class="ccard path ${p.id === selPath ? 'on' : ''} pk-${p.id}" data-p="${p.id}">
      <div class="ci">${p.i}</div>
      <div class="cn">${esc(p.n(W))}</div>
      <div class="cd">${esc(p.d(W))}</div>
      <div class="cs">${esc(p.tags)}</div>
    </button>`).join('');
  $$('#pathGrid .ccard').forEach(b => b.onclick = () => {
    selPath = b.dataset.p;
    renderPaths();
    renderAlloc();
  });
}

function ptsLeft() { return freePoints() - STAT_KEYS.reduce((s, k) => s + alloc[k], 0); }

function presetAlloc(kind) {
  const cls = classOf(selCls);
  STAT_KEYS.forEach(k => { alloc[k] = 0; });
  const fp = freePoints();
  if (kind === 'class') {
    // อาชีพหลักได้น้ำหนักสองเท่าของรอง
    const keys = [...cls.main, ...cls.main, ...(cls.sub || [])];
    for (let i = 0; i < fp; i++) alloc[keys[i % keys.length]]++;
  } else if (kind === 'balance') {
    for (let i = 0; i < fp; i++) alloc[STAT_KEYS[i % 6]]++;
  } else if (kind === 'luck') {
    alloc.luk = fp;
  }
}

$$('.presets button').forEach(b => b.onclick = () => { presetAlloc(b.dataset.preset); renderAlloc(); });

function previewStats() {
  const cls = classOf(selCls);
  const st = baseStats(cls);
  STAT_KEYS.forEach(k => { st[k] += alloc[k]; });
  const fx = pathFx(combineFx(cls), selPath);
  const w = k => cls.main.includes(k) ? 1.2 : (cls.sub || []).includes(k) ? 0.7 : 0.25;
  let pow = 12;
  STAT_KEYS.forEach(k => { pow += st[k] * w(k); });
  pow = Math.round(pow * fx.pow);
  const life = Math.round(S.W.life + (S.race.life || 0) + S.birth.life + fx.life + (st.vit - 10) * 0.3);
  return { cls, st, fx, pow, life, hp: Math.round(60 + st.vit * 2.5) };
}

function renderAlloc() {
  const P = previewStats();
  const base = baseStats(P.cls);
  $('#ptsLeft').textContent = ptsLeft();
  const maxV = Math.max(30, ...STAT_KEYS.map(k => P.st[k]));
  $('#allocRows').innerHTML = STAT_KEYS.map(k => `
    <div class="arow">
      <div class="al ${P.cls.main.includes(k) ? 'main' : ''}">${STAT_ICONS[k]} ${STAT_NAMES[k]}</div>
      <div class="abar"><i style="width:${P.st[k] / maxV * 100}%"></i><i style="width:${base[k] / maxV * 100}%; opacity:.35"></i></div>
      <div class="actl"><button data-k="${k}" data-d="-1" aria-label="ลด${STAT_NAMES[k]}">−</button><span>${P.st[k]}${alloc[k] ? ' <small class="muted">+' + alloc[k] + '</small>' : ''}</span><button data-k="${k}" data-d="1" aria-label="เพิ่ม${STAT_NAMES[k]}">+</button></div>
    </div>`).join('');
  $$('#allocRows .actl button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, d = +b.dataset.d;
    if (d > 0 && ptsLeft() <= 0) return;
    if (d < 0 && alloc[k] <= 0) return;
    alloc[k] += d;
    renderAlloc();
  });
  const fx = P.fx;
  $('#preview').innerHTML = `
    <div>พลังต่อสู้เริ่มต้น <b>${P.pow}</b></div>
    <div>พลังชีวิต <b>${P.hp}</b></div>
    <div>อายุขัยโดยประมาณ <b>${P.life} ปี</b></div>
    <div>EXP <b>×${fx.xp.toFixed(2)}</b></div>
    <div>ลดความเสียหาย <b>${Math.round(fx.surv * 100)}%</b></div>
    ${fx.revive ? `<div>ฟื้นคืนชีพ <b>${fx.revive} ครั้ง</b></div>` : ''}`;
  $('#btnStart').disabled = ptsLeft() < 0;
}

$('#btnStart').onclick = () => {
  const name = $('#nameInput').value.trim() || randName(S.gender);
  finalizeBuild(name, selCls, alloc, selPath);
  startLife();
};

// ---------- ใช้ชีวิต ----------
function startLife() {
  $('#log').innerHTML = '';
  curYearEl = null;
  show('life');
  const yr = newYearEl(0);
  sayLine(yr, '✨ ' + esc(S.name) + ' ลืมตาดูโลกใหม่ใน' + S.W.name + ' ในฐานะ' + S.W.births[S.birth.id], 'rank');
  battleUntil = 0;
  setScene('home');
  AUD.play(S.W.id, 'calm');
  setSpeed(1);
  renderSheet();
  schedule();
}

function yearMs() { return CFG.len * 60000 / Math.max(lifespan(), 40); }

function schedule(mult = 1) {
  clearTimeout(timer);
  if (!speed || S.dead || S.pending) return;
  const ms = yearMs() / speed * mult;
  const f = $('#yrFill');
  f.style.transition = 'none'; f.style.width = '0';
  void f.offsetWidth;
  f.style.transition = 'width ' + ms + 'ms linear'; f.style.width = '100%';
  timer = setTimeout(step, ms);
}

function setSpeed(sp) {
  speed = sp;
  $$('#speedSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sp === sp));
  if (sp) schedule(); else { clearTimeout(timer); const f = $('#yrFill'); f.style.transition = 'none'; }
}
$$('#speedSeg button').forEach(b => b.onclick = () => setSpeed(+b.dataset.sp));
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || !$('#life').classList.contains('active') || e.target.tagName === 'INPUT') return;
  e.preventDefault();
  if (S && !S.pending) setSpeed(speed ? 0 : 1);
});

// บันทึกเลื่อนอยู่ในกรอบของตัวเอง ถ้าผู้เล่นเลื่อนขึ้นไปอ่านย้อนหลัง จะไม่ดึงกลับลงมาเอง
function nearBottom() { const l = $('#log'); return l.scrollHeight - l.scrollTop - l.clientHeight < 90; }
function toBottom() {
  const l = $('#log');
  l.scrollTo({ top: l.scrollHeight, behavior: speed >= 2 ? 'auto' : 'smooth' });
  $('#btnLatest').classList.add('hidden');
}
$('#btnLatest').onclick = toBottom;
// หมุนจอหรือย่อหน้าต่างแล้วยังอยู่ปีล่าสุดเหมือนเดิม
window.addEventListener('resize', () => { if ($('#btnLatest').classList.contains('hidden')) $('#log').scrollTop = $('#log').scrollHeight; });
$('#log').addEventListener('scroll', () => { if (nearBottom()) $('#btnLatest').classList.add('hidden'); });

function toggleSheet(open) {
  $('#sheet').classList.toggle('open', open);
  $('#sheetBack').classList.toggle('hidden', !open);
}
$('#btnSheet').onclick = () => toggleSheet(!$('#sheet').classList.contains('open'));
$('#sheetBack').onclick = () => toggleSheet(false);

function newYearEl(age) {
  const el = document.createElement('div');
  el.className = 'yr cur';
  el.innerHTML = `<div class="ya">${age} ปี</div><div class="yl"></div>`;
  if (curYearEl) curYearEl.classList.remove('cur');
  $('#log').appendChild(el);
  curYearEl = el;
  return el;
}

function sayLine(yr, html, type) {
  const p = document.createElement('p');
  p.className = 'ln-' + (type || 'info');
  p.innerHTML = html;
  yr.querySelector('.yl').appendChild(p);
}

function step() {
  const stick = nearBottom();
  const lines = yearTick();
  const yr = newYearEl(S.age);
  lines.forEach(l => sayLine(yr, esc(l.t), l.type));
  // ปีที่ไม่มีอะไรสำคัญ แสดงแบบย่อและผ่านไปเร็วขึ้น
  const quiet = !S.pending && !S.dead && lines.every(l => l.type === 'quiet' || l.type === 'info');
  if (quiet) yr.classList.add('yr-q');
  $('#ageNum').textContent = S.age;
  renderSheet();
  if (stick) toBottom(); else $('#btnLatest').classList.remove('hidden');
  if (S.dead) return finish();
  const kind = sceneKind(lines);
  setScene(kind);
  playMood(kind, lines);
  yearSfx(lines);
  if (S.pending) return showChoice(S.pending);
  schedule(quiet ? 0.5 : 1);
}

function showChoice(c) {
  clearTimeout(timer);
  const f = $('#yrFill'); f.style.transition = 'none';
  $('#choice').classList.toggle('boss', !!c.boss);
  $('#choice').classList.toggle('twist', !!c.twist);
  $('#choice').classList.toggle('love', !!c.love);
  AUD.sfx(c.boss ? 'boss' : c.twist ? 'rare' : c.love ? 'love' : 'choice');
  if (c.love) setScene('love');
  $('#chAge').textContent = 'อายุ ' + S.age + ' ปี · ' + S.W.icon + ' ' + S.W.name;
  $('#chTitle').textContent = c.title;
  $('#chText').textContent = c.text(S);
  $('#chOpts').innerHTML = choiceOpts(c).map((o, i) =>
    `<button data-i="${i}">${esc(o.t)}${o.d ? `<span class="od">${esc(o.d)}</span>` : ''}</button>`).join('');
  $$('#chOpts button').forEach(b => b.onclick = () => {
    const opt = choiceOpts(c)[+b.dataset.i];
    const { res, extra } = applyChoice(c, +b.dataset.i);
    sayLine(curYearEl, '➤ <b>' + esc(c.title) + '</b> — เลือก “' + esc(opt.t) + '”<br>' + esc(res), 'choice');
    extra.forEach(l => sayLine(curYearEl, esc(l.t), l.type));
    $('#choice').classList.add('hidden');
    renderSheet();
    toBottom();
    if (S.dead) return finish();
    if (c.boss) {
      AUD.sfx((c.id === 'laststand' ? !S.doomOn : S.bossState === 'win') ? 'rare' : 'lose');
      battleUntil = 0;
      setScene('town');
      AUD.play(S.W.id, 'calm');
    }
    if (!speed) setSpeed(1); else schedule();
  });
  $('#choice').classList.remove('hidden');
}

function bar(cls, v, max) { return `<div class="bar ${cls}"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></div>`; }

function renderSheet() {
  const W = S.W, mh = maxHp();
  const det = $('#shDet');
  const open = det ? det.open : true;
  $('#mini').innerHTML = `
    <div class="mhp"><span>❤️</span>${bar('hp', S.hp, mh)}<b>${Math.max(0, Math.round(S.hp))}/${mh}</b></div>
    <span>${S.cls.i} <b>Lv. ${S.level}</b></span>
    <span class="sh-rank">${rankLabel()} ${esc(rankName())}</span>
    <span>⚔️ <b>${power().toLocaleString('th-TH')}</b></span>
    <span>💰 <b>${fmtGold(S.gold)}</b></span>`;
  const fam = [];
  const LOVE_ICON = { married: '💍 คู่ชีวิต: ', dating: '💕 คนรัก: ', lost: '🕯️ คู่ชีวิตผู้ล่วงลับ: ' };
  S.loves.filter(l => LOVE_ICON[l.st]).forEach(l => fam.push(LOVE_ICON[l.st] + esc(l.n) + `<span class="muted"> — ${esc(l.d)}</span>`));
  if (S.kids) fam.push('👶 ลูก ' + S.kids + ' คน');
  if (S.disciple) fam.push('📿 ศิษย์: ' + esc(S.disciple));
  $('#sheet').innerHTML = `
    <div class="sh-name">${esc(S.name)}</div>
    <div class="sh-sub">${W.icon} ${W.name} · ${S.race.n} · ${S.gender === 'm' ? 'ชาย' : 'หญิง'}</div>
    <div class="sh-cls"><span class="ic">${S.cls.i}</span><div><div>${S.cls.n} <span class="muted">Lv. ${S.level}</span></div>
      <div class="sh-rank">${rankLabel()} ${esc(rankName())}</div></div></div>
    <div class="kv" style="margin-top:8px"><span>พลังชีวิต</span><b>${Math.max(0, Math.round(S.hp))} / ${mh}</b></div>${bar('hp', S.hp, mh)}
    <div class="kv"><span>EXP</span><b>${S.xp} / ${20 + S.level * 3}</b></div>${bar('xp', S.xp, 20 + S.level * 3)}
    <div class="kv"><span>พลังต่อสู้</span><b>${power().toLocaleString('th-TH')}</b></div>
    <div class="kv"><span>ทรัพย์สิน</span><b>${fmtGold(S.gold)}</b></div>
    <div class="kv"><span>ชื่อเสียง</span><b>${Math.round(S.fame).toLocaleString('th-TH')}</b></div>
    <div class="kv"><span>ชะตาที่เลือก</span><b>${pathOf(S.path).i} ${esc(pathOf(S.path).n(W))}</b></div>
    <div class="kv"><span>เส้นทาง</span><b>${MODE_LABEL[S.mode] || ''}</b></div>
    ${S.doomOn ? `<div class="kv doom-bar"><span>☄️ ${esc(DOOM[W.id].n)}กลืนโลก</span><b>${Math.round(S.doom)}%</b></div>${bar('doom', S.doom, 100)}` : ''}
    <div class="kv"><span>อายุขัยโดยประมาณ</span><b>${lifespan()} ปี</b></div>
    <details id="shDet" ${open ? 'open' : ''}>
      <summary class="muted" style="cursor:pointer;margin-top:8px">รายละเอียด</summary>
      <div class="sh-sec"><h4>ค่าสถานะ</h4><div class="stats">${STAT_KEYS.map(k =>
        `<div class="${S.cls.main.includes(k) ? 'main' : ''}"><span>${STAT_ICONS[k]} ${STAT_NAMES[k]}</span><b>${S.stats[k]}</b></div>`).join('')}</div></div>
      <div class="sh-sec"><h4>สกิล</h4><div class="tags">${S.skills.map(s =>
        `<span class="tag r" style="--rc:var(--r-${s.r})" title="${esc(s.d)}">${s.r} ${esc(s.n)}</span>`).join('')}
        ${S.revives ? `<span class="tag">⏳ ฟื้นได้อีก ${S.revives}</span>` : ''}</div></div>
      ${S.titles.length ? `<div class="sh-sec"><h4>ฉายา</h4><div class="tags">${S.titles.map(t => `<span class="tag t">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${fam.length ? `<div class="sh-sec"><h4>ครอบครัว</h4><ul class="list">${fam.map(f => `<li>${f}</li>`).join('')}</ul></div>` : ''}
      ${S.comps.length ? `<div class="sh-sec"><h4>สหายร่วมทาง</h4><ul class="list">${S.comps.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      <div class="sh-sec"><h4>บันทึกการต่อสู้</h4><div class="kv"><span>ชนะ / แพ้</span><b>${S.wins} / ${S.losses}</b></div></div>
    </details>`;
}

// ---------- จบชีวิต ----------
function finish() {
  clearTimeout(timer);
  $('#yrFill').style.transition = 'none';
  sayLine(curYearEl, '🕯️ ' + esc(S.cause), 'death');
  toBottom();
  setScene(S.deathType === 'worldend' ? 'boss' : 'death');
  AUD.play(S.W.id, 'sad');
  AUD.sfx('death');
  setTimeout(renderEnd, 1800);
}

function renderEnd() {
  const W = S.W;
  $('#endTitle').textContent = lifeTitle();
  $('#endName').textContent = S.name;
  $('#endSub').textContent = W.icon + ' ' + W.name + ' · ' + S.cls.n + ' · ' + (S.age) + ' ปีในต่างโลก';
  const oi = fmtOneIn(finalOneIn());
  $('#endOneIn').innerHTML = 'ชีวิตนี้คือ 1 ใน <b>' + oi + '</b>';
  $('#endBio').textContent = biography();
  const ach = achievements();
  $('#endAch').innerHTML = ach.map(([i, t]) => `<span>${i} ${esc(t)}</span>`).join('');
  $('#endStats').innerHTML = [
    ['เลเวล', S.level], [rankLabel(), rankName()], ['ชนะการต่อสู้', S.wins + ' ครั้ง'],
    ['ทรัพย์สิน', fmtGold(S.gold)], ['ชื่อเสียง', Math.round(S.fame).toLocaleString('th-TH')], ['ลูก', S.kids + ' คน'],
  ].map(([a, b]) => `<div><small>${a}</small><b>${esc(b)}</b></div>`).join('');
  $('#endChoices').innerHTML = S.history.length
    ? S.history.map(h => `<li>อายุ ${h.age} ปี · ${esc(h.title)} → ${esc(h.pick)}</li>`).join('')
    : '<li>ไม่มี</li>';
  $('#epitaph').value = '';
  $('#endMsg').textContent = '';
  $('#btnSave').disabled = false;
  S.oneInText = oi;
  show('end');
  // โลกถูกทำลาย: ใช้ฉากภัยใหญ่ (ท้องฟ้าแดง + ตัวร้าย) แทนหลุมศพ
  PX.mount($('#endScene'), { world: S.W.id, kind: S.deathType === 'worldend' ? 'boss' : 'death', seed: seedOf(), hero: heroLook() });
  refreshCard();
}

// ---------- การ์ดแชร์ ----------
function wrapText(c, text, maxW) {
  const seg = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map(x => x.segment) : [...text];
  const lines = [];
  let cur = '';
  for (const w of seg) {
    if (c.measureText(cur + w).width > maxW && cur) { lines.push(cur); cur = w.trimStart(); }
    else cur += w;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function makeCard() {
  if (document.fonts) await document.fonts.ready;
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b0d14'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W, 0, 60, W, 0, 1000);
  g.addColorStop(0, 'rgba(139,107,255,.28)'); g.addColorStop(1, 'rgba(139,107,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  const kind = S.mode === 'slow' || S.mode === 'retired' ? 'field' : 'town';
  const snap = PX.snapshot({ world: S.W.id, kind, seed: seedOf(), hero: heroLook(30), partners: S.loves.filter(l => l.wed !== null && l.st !== 'left').slice(0, 4).map(partnerLook) }, 5);
  c.drawImage(snap, 60, 60);
  c.strokeStyle = '#2a3248'; c.lineWidth = 4; c.strokeRect(60, 60, snap.width, snap.height);

  c.textAlign = 'center';
  const put = (t, font, col, y) => { c.font = font; c.fillStyle = col; c.fillText(t, W / 2, y); };
  let y = 680;
  put(lifeTitle(), '500 38px Kanit', '#ffcf6b', y); y += 78;
  put(S.name, '700 70px Kanit', '#e9ecf4', y); y += 56;
  put(S.W.icon + ' ' + S.W.name + ' · ' + S.cls.n + ' · ' + S.age + ' ปี', '400 32px Sarabun', '#8b93a8', y); y += 92;
  put('ชีวิตนี้คือ', '500 34px Kanit', '#c5cbd9', y); y += 82;
  const gr = c.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
  gr.addColorStop(0, '#ffcf6b'); gr.addColorStop(1, '#ff5c8a');
  put('1 ใน ' + S.oneInText, '700 78px Kanit', gr, y); y += 72;
  put('Lv. ' + S.level + ' · ' + rankLabel() + ' ' + rankName() + ' · ชนะ ' + S.wins + ' ศึก' + (S.kids ? ' · ลูก ' + S.kids + ' คน' : ''), '400 30px Sarabun', '#c5cbd9', y); y += 64;
  c.font = '400 30px Sarabun';
  const ach = achievements().map(([i, t]) => i + ' ' + t).join('   ');
  wrapText(c, ach, 900).slice(0, 3).forEach(l => { put(l, '400 30px Sarabun', '#e9ecf4', y); y += 44; });
  const epi = $('#epitaph').value.trim();
  if (epi) {
    y += 16;
    c.font = 'italic 400 34px Sarabun';
    wrapText(c, '“' + epi + '”', 900).slice(0, 2).forEach(l => { put(l, 'italic 400 34px Sarabun', '#c5cbd9', y); y += 48; });
  }
  c.textAlign = 'left'; c.font = '700 34px Kanit'; c.fillStyle = '#e9ecf4'; c.fillText('ล้านโลก หนึ่งชีวิต', 60, H - 60);
  c.textAlign = 'right'; c.font = '400 28px Sarabun'; c.fillStyle = '#8b93a8'; c.fillText('#ล้านโลกหนึ่งชีวิต', W - 60, H - 60);
  return cv;
}

let cardCanvas = null, cardTimer = null;
async function refreshCard() {
  cardCanvas = await makeCard();
  $('#cardImg').src = cardCanvas.toDataURL('image/png');
}
$('#epitaph').addEventListener('input', () => { clearTimeout(cardTimer); cardTimer = setTimeout(refreshCard, 400); });

$('#btnCard').onclick = () => {
  if (!cardCanvas) return;
  const a = document.createElement('a');
  a.href = cardCanvas.toDataURL('image/png');
  a.download = 'ล้านโลก-' + S.name + '.png';
  a.click();
};

if (navigator.canShare) $('#btnShare').classList.remove('hidden');
$('#btnShare').onclick = () => {
  if (!cardCanvas) return;
  cardCanvas.toBlob(async blob => {
    const file = new File([blob], 'life.png', { type: 'image/png' });
    try {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'ล้านโลก หนึ่งชีวิต', text: S.name + ' — ' + lifeTitle() });
      else $('#endMsg').textContent = 'เบราว์เซอร์นี้แชร์รูปไม่ได้ ลองดาวน์โหลดแทน';
    } catch (e) { /* ผู้ใช้ยกเลิกการแชร์ */ }
  });
};

$('#btnSave').onclick = () => {
  const list = loadMem();
  list.unshift({
    name: S.name, icon: S.W.icon, world: S.W.name, cls: S.cls.n, age: S.age,
    title: lifeTitle(), epi: $('#epitaph').value.trim(), oneIn: S.oneInText, at: Date.now(),
  });
  $('#endMsg').textContent = saveMem(list) ? 'จารึกชีวิตนี้ลงอนุสรณ์แล้ว' : 'บันทึกไม่ได้ (เบราว์เซอร์ปิดการเก็บข้อมูล)';
  $('#btnSave').disabled = true;
};

$('#btnCopy').onclick = async () => {
  const txt = S.name + ' — ' + lifeTitle() + '\n' + biography() + '\nชีวิตนี้คือ 1 ใน ' + S.oneInText +
    ($('#epitaph').value.trim() ? '\n“' + $('#epitaph').value.trim() + '”' : '') + '\n#ล้านโลกหนึ่งชีวิต';
  try { await navigator.clipboard.writeText(txt); $('#endMsg').textContent = 'คัดลอกแล้ว'; }
  catch (e) { $('#endMsg').textContent = 'คัดลอกไม่ได้ในเบราว์เซอร์นี้'; }
};

$('#btnAgain').onclick = () => { renderHome(); show('home'); };

renderHome();
