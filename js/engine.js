// ===== เอนจินจำลองชีวิต (ไม่แตะ DOM) =====

let S = null;

const rand = () => Math.random();
const r = (a, b) => Math.floor(a + rand() * (b - a + 1));
const rf = (a, b) => a + rand() * (b - a);
const chance = p => rand() < p;
const pick = a => a[Math.floor(rand() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const worldById = id => WORLDS.find(w => w.id === id);

function wpick(arr, wf) {
  const total = arr.reduce((s, x) => s + wf(x), 0);
  let x = rand() * total;
  for (const it of arr) { x -= wf(it); if (x <= 0) return it; }
  return arr[arr.length - 1];
}
const wprob = (arr, it, wf) => wf(it) / arr.reduce((s, x) => s + wf(x), 0);

const FREE_POINTS = 20;
const RANDOM_BONUS_POINTS = 6;
const HIDDEN_CHANCE_RANDOM = 0.4;

// ---------- การสุ่มชะตา ----------
function rollSkill(worldId, randomPath, exclude) {
  const col = randomPath ? 1 : 0;
  const rar = wpick(RARITY, x => x.w[col]);
  const pool = SKILLS.filter(s => s.r === rar.id && (!s.w || s.w === worldId) && !exclude.includes(s.n));
  const sk = pick(pool);
  // ความน่าจะเป็นอ้างอิงจากอัตราปกติ เพื่อให้ "1 ใน N" สื่อว่าหายากจริงแค่ไหน
  const p = (rar.w[0] / 100) * (1 / pool.length);
  return { ...sk, p };
}

function newLife(worldId) {
  const random = !worldId;
  const W = random ? pick(WORLDS) : worldById(worldId);
  const col = random ? 1 : 0;
  const race = wpick(W.races, x => x.w);
  const birth = wpick(BIRTH_TIERS, b => b.w[col]);
  const skills = [rollSkill(W.id, random, [])];
  if (random) skills.push(rollSkill(W.id, random, [skills[0].n]));
  const bestRar = Math.max(...skills.map(s => RARITY.findIndex(x => x.id === s.r)));
  const hidden = random ? chance(HIDDEN_CHANCE_RANDOM) || bestRar >= 3 : bestRar >= 3 && chance(0.5);

  let p = wprob(W.races, race, x => x.w) * wprob(BIRTH_TIERS, birth, b => b.w[0]);
  skills.forEach(s => { p *= s.p; });
  if (hidden) p *= 0.15;

  S = {
    W, random, race, birth, skills, hidden,
    gender: chance(0.5) ? 'm' : 'f',
    prevDeath: pick(PREV_DEATHS),
    lookSeed: String(Math.random()),
    oneIn: Math.max(2, Math.round(1 / p)),
  };
  return S;
}

// ---------- สร้างตัวละคร ----------
function classOf(id) { return id === S.W.hidden.id ? S.W.hidden : S.W.classes.find(c => c.id === id); }

function baseStats(cls) {
  const st = {};
  STAT_KEYS.forEach(k => { st[k] = 5; });
  const add = o => { if (o) for (const k in o) st[k] += o[k]; };
  cls.main.forEach(k => { st[k] += 3; });
  (cls.sub || []).forEach(k => { st[k] += 1; });
  add(S.race.st); add(S.birth.st);
  S.skills.forEach(s => add(s.fx.st));
  return st;
}

function combineFx(cls) {
  const fx = { xp: 1, pow: 1, surv: 0, gold: 1, charm: 0, comp: 0, life: 0, revive: 0, growth: 0, immune: 0 };
  const merge = f => {
    if (!f) return;
    for (const k in f) {
      if (k === 'st') continue;
      if (k === 'xp' || k === 'pow' || k === 'gold') fx[k] *= f[k];
      else fx[k] += f[k];
    }
  };
  S.skills.forEach(s => merge(s.fx));
  merge(cls.fx);
  fx.surv = Math.min(fx.surv, 0.7);
  return fx;
}

const pathOf = id => LIFE_PATHS.find(p => p.id === id) || LIFE_PATHS[1];

// ผลของเส้นทางชีวิตทับลงบน fx ของสกิลและอาชีพ
function pathFx(fx, pathId) {
  const f = { ...fx }, pf = pathOf(pathId).fx;
  for (const k in pf) {
    if (k === 'xp' || k === 'pow' || k === 'gold') f[k] *= pf[k];
    else f[k] += pf[k];
  }
  return f;
}

function freePoints() { return FREE_POINTS + (S.random ? RANDOM_BONUS_POINTS : 0); }

function finalizeBuild(name, clsId, alloc, pathId) {
  const cls = classOf(clsId);
  const stats = baseStats(cls);
  STAT_KEYS.forEach(k => { stats[k] += alloc[k] || 0; });
  Object.assign(S, {
    name, cls, alloc: { ...alloc }, stats, path: pathOf(pathId).id, fx: pathFx(combineFx(cls), pathId),
    doom: 0, doomOn: false,
    age: 0, level: 1, xp: 0, gold: S.birth.gold, fame: S.birth.fame,
    maxHpMod: 0, lifeBonus: 0, powMul: 1, risk: 0,
    mode: 'child', modeHist: [], married: false, partner: null, spouseLost: false, kids: 0,
    loves: [], loveSeq: 0, loveLater: null,
    comps: [], titles: [], flags: {}, wins: 0, losses: 0, kills: 0, biggest: null,
    bossState: null, bossRetry: 0, rankIdx: 0, dead: false, cause: '', deathType: '',
    used: {}, lastChoice: -10, parentsAlive: S.birth.id !== 'orphan', disciple: null,
    revives: 0, out: [], pending: null, history: [],
  });
  S.revives = S.fx.revive;
  S.hp = maxHp();
  return S;
}

// ---------- ค่าที่คำนวณได้ ----------
const ranks = () => S.cls.ranks || S.W.ranks;
const rankName = i => ranks()[i === undefined ? S.rankIdx : i][0];
const rankLabel = () => S.cls.ranks ? 'ระดับ' : S.W.rankLabel;
const maxHp = () => Math.max(20, Math.round(60 + S.stats.vit * 2.5 + S.maxHpMod));
const tier = () => clamp(Math.floor(S.level / 11), 0, 8);
const enemyPow = t => (40 + 72 * t) * (1 + t * 0.04);
const xpNeed = L => 20 + L * 3;

function lifespan() {
  const W = S.W;
  const realm = W.rankLife ? W.rankLife[Math.min(S.rankIdx, W.rankLife.length - 1)] : 0;
  return Math.round(W.life + (S.race.life || 0) + S.birth.life + S.fx.life + S.lifeBonus + realm + (S.stats.vit - 10) * 0.3);
}

function statWeight(k) {
  if (S.cls.main.includes(k)) return 1.2;
  if ((S.cls.sub || []).includes(k)) return 0.7;
  return 0.25;
}

function power() {
  let p = 8 + S.level * 4;
  STAT_KEYS.forEach(k => { p += S.stats[k] * statWeight(k); });
  p *= S.fx.pow * S.powMul * (1 + 0.05 * Math.min(S.comps.length, 4));
  const L = lifespan(), dec = L * 0.72;
  if (S.age > dec) p *= Math.max(0.4, 1 - (S.age - dec) / (L * 0.6));
  if (S.hp < maxHp() * 0.3) p *= 0.8;
  return Math.round(p);
}

const winChance = (P, E) => clamp(P / (P + E) * 1.15 + (S.stats.luk - 10) * 0.004, 0.05, 0.96);

// ---------- ตัวช่วย ----------
function say(t, type = 'info') { S.out.push({ t, type }); }

function randName(g) {
  const n = S.W.names;
  const first = pick(n[g || (chance(0.5) ? 'm' : 'f')]);
  const last = pick(n.last);
  return last ? first + ' ' + last : first;
}

function growthWeights() {
  const w = {};
  STAT_KEYS.forEach(k => {
    w[k] = (S.alloc[k] || 0) + 1 + (S.cls.main.includes(k) ? 3 : 0) + ((S.cls.sub || []).includes(k) ? 1 : 0);
  });
  return w;
}

function distribute(points) {
  const w = growthWeights();
  for (let i = 0; i < points; i++) S.stats[wpick(STAT_KEYS, k => w[k])]++;
}

function gainXp(n) {
  n = Math.round(n * S.fx.xp);
  S.xp += n;
  let ups = 0;
  while (S.xp >= xpNeed(S.level) && S.level < 150) {
    S.xp -= xpNeed(S.level);
    S.level++; ups++;
    distribute(3 + S.fx.growth);
  }
  return n;
}

function changeHp(n, cause) {
  S.hp = Math.min(maxHp(), S.hp + n);
  if (S.hp > 0 || S.dead) return;
  if (S.revives > 0) {
    S.revives--;
    S.hp = Math.round(maxHp() * 0.6);
    S.flags.revived = (S.flags.revived || 0) + 1;
    say('⏳ หัวใจหยุดเต้น... แล้วเวลาก็ย้อนกลับ! คุณฟื้นขึ้นมาพร้อมความทรงจำของความตาย (เหลือ ' + S.revives + ' ครั้ง)', 'rare');
    return;
  }
  die(cause || 'บาดเจ็บสาหัสจนไม่อาจฟื้น', 'battle');
}

function die(cause, type) {
  if (S.dead) return;
  S.dead = true; S.cause = cause; S.deathType = type || 'other';
}

function check(t) {
  t = clamp(t, 0, 8);
  return chance(winChance(power(), enemyPow(t) * rf(0.85, 1.15)));
}

const G = {
  get S() { return S; },
  get W() { return S.W; },
  st(k, v) { S.stats[k] = Math.max(1, S.stats[k] + v); },
  gold(n) { S.gold = Math.max(0, S.gold + Math.round(n)); },
  fame(n) { S.fame = Math.max(0, S.fame + n); },
  xp(n) { gainXp(n); },
  hp(n) { changeHp(n, S.ctxCause); },
  pow(m) { S.powMul *= m; },
  title(t) { if (!S.titles.includes(t)) S.titles.push(t); },
  comp(n) { if (S.comps.length < 5) S.comps.push(n); },
  flag(k) { S.flags[k] = true; },
  mode(m) { S.mode = m; S.modeHist.push(m); },
  partner(desc, married, gender) { return addLove(desc, gender, married ? 'married' : 'dating').n; },
  spouses() { return spouses(); },
  leave(l, why) { loveEnd(l, 'left', why); },
  kid() { S.kids++; },
  tier() { return tier(); },
  r, chance, pick, randName, check, die,
};

// ---------- การต่อสู้ ----------
function fight() {
  const W = S.W;
  const grown = S.age >= 18; // วัยรุ่นยังไม่เจอศัตรูเกินระดับหรือการโจมตีถึงตาย
  const t = clamp(tier() + pick([-1, 0, 0, 0, 1]) + (grown && chance(0.08) ? 2 : 0) + (grown && chance(0.02) ? 1 : 0), 0, 8);
  const P = power();
  const E = enemyPow(t) * rf(0.8, 1.2);
  const name = W.enemies[t];
  if (chance(winChance(P, E))) {
    S.wins++;
    const xp = gainXp(30 * (1 + t * 0.7));
    const g = Math.round(15 * Math.pow(1 + t, 1.5) * S.fx.gold * rf(0.6, 1.4));
    S.gold += g;
    S.fame += 1 + t * (t >= 5 ? 2 : 1);
    if (!S.biggest || t > S.biggest.t) S.biggest = { t, name };
    S.lastFight = { t, win: true };
    return { win: true, name, xp, t };
  }
  S.losses++;
  S.lastFight = { t, win: false };
  const ratio = clamp(E / P, 0.5, 3);
  let dmg = Math.round(rf(20, 50) * W.danger * (1 + S.risk) * Math.pow(ratio, 1.3) * (1 - S.fx.surv));
  // ศัตรูที่เหนือกว่ามากมีโอกาสปลิดชีพในครั้งเดียว
  if (grown && ratio > 1.5 && chance(0.12 * W.danger * (1 + S.risk) * (1 - S.fx.surv))) dmg = Math.max(dmg, S.hp);
  changeHp(-dmg, 'ถูก' + name + 'สังหาร');
  return { win: false, name, dmg, t };
}

function battles(n) {
  const res = [];
  for (let i = 0; i < n && !S.dead; i++) res.push(fight());
  res.slice(0, 2).forEach(b => {
    if (b.win) say('⚔️ ปราบ' + b.name + 'ได้สำเร็จ (+' + b.xp + ' EXP)', b.t >= tier() + 2 ? 'rare' : 'win');
    else say('💥 พ่ายแพ้ให้' + b.name + ' บาดเจ็บ (−' + b.dmg + ' HP)', 'lose');
  });
  if (res.length > 2) {
    const rest = res.slice(2), w = rest.filter(b => b.win).length;
    say('⚔️ ต่อสู้อีก ' + rest.length + ' ครั้ง ชนะ ' + w + ' ครั้ง', 'win');
  }
}

// ---------- หนึ่งปี ----------
const BATTLE_RATE = { adventure: 1.6, service: 0.9, slow: 0.25, retired: 0.12, child: 0 };

function yearTick() {
  S.out = [];
  S.pending = null;
  S.age++;
  const W = S.W;
  const prevRank = S.rankIdx;
  S.hp = Math.min(maxHp(), S.hp + maxHp() * 0.25 + S.stats.vit * 0.5);

  if (S.age < 6) {
    if (S.age === 1 || chance(0.55)) say('🍼 ' + pick(W.child));
    if (chance(0.5)) distribute(1);
  } else if (S.age < W.awakenAge) {
    if (chance(0.7)) say('📖 ' + pick(W.train));
    distribute(2);
    gainXp(10);
  } else if (S.age === W.awakenAge) {
    say('🔔 ' + W.awaken + ' 「' + S.cls.i + ' ' + S.cls.n + '」', 'rank');
    if (S.cls === W.hidden) say('🌟 ผู้คนรอบตัวตกตะลึง นี่คืออาชีพลับที่ไม่ได้ปรากฏมาหลายร้อยปี!', 'rare');
    const P = pathOf(S.path);
    if (P.mode) { G.mode(P.mode); say(P.i + ' ตามเส้นทางที่ตั้งใจไว้ตั้งแต่เกิด คุณเลือกที่จะ' + W.modes[P.mode], 'rank'); }
    else S.pending = LIFE_MODE_CHOICE;
  } else {
    adultYear();
  }

  updateRank(prevRank);
  if (!S.dead) agingCheck();
  if (!S.dead && !S.pending) S.pending = pickChoice();
  return S.out;
}

function updateRank(prev) {
  const rk = ranks();
  let idx = 0;
  rk.forEach(([, lv], i) => { if (S.level >= lv) idx = i; });
  if (idx > S.rankIdx) {
    S.rankIdx = idx;
    if (S.age >= S.W.awakenAge) say('🏅 เลื่อน' + rankLabel() + 'เป็น 「' + rankName() + '」 (Lv. ' + S.level + ')', 'rank');
    if (idx === rk.length - 1) G.title(rankName() + 'คนแรกในรอบยุค');
  }
  return idx !== prev;
}

function adultYear() {
  const W = S.W, before = S.out.length;

  // งานประจำ
  if (S.cls.craft) {
    const g = Math.round(40 * Math.pow(1 + S.rankIdx, 1.6) * S.fx.gold * rf(0.6, 1.4));
    S.gold += g;
    const xp = gainXp(28 * (1 + tier() * 0.6) * rf(0.8, 1.2));
    S.fame += 1 + S.rankIdx;
    if (chance(0.45)) say('🛠️ ผลงานของคุณขายได้ ' + fmtGold(g) + ' (+' + xp + ' EXP)', 'win');
  }
  if (S.mode === 'service') {
    const g = Math.round(30 * Math.pow(1 + S.rankIdx, 1.5) * rf(0.9, 1.1));
    S.gold += g; S.fame += 2;
    gainXp(12 * (1 + tier() * 0.5));
    if (chance(0.25)) say('📜 ได้รับเงินประจำตำแหน่ง ' + fmtGold(g));
  }
  if (S.mode === 'slow' || S.mode === 'retired') {
    S.gold += Math.round(25 * (1 + S.rankIdx) * S.fx.gold * rf(0.6, 1.4));
    if (chance(0.4)) say('🌿 ' + pick(W.slow));
  }

  // การต่อสู้
  let rate = (BATTLE_RATE[S.mode] || 0) * pathOf(S.path).battle;
  if (S.cls.craft) rate *= 0.35;
  if (S.flags.peace) rate *= 0.6;
  if (S.flags.elite) rate *= 1.2;
  const n = Math.floor(rate) + (chance(rate % 1) ? 1 : 0);
  battles(n);
  if (S.dead) return;

  // ชีวิตส่วนตัว
  romance();
  if (S.parentsAlive && S.age >= 35 && chance(0.07)) {
    S.parentsAlive = false;
    say('🕯️ พ่อแม่ในชาตินี้จากไปอย่างสงบ คุณได้ใช้เวลาอยู่กับท่านจนวาระสุดท้าย', 'sad');
  }
  if (S.comps.length < 4 && S.age <= 60 && chance(0.05 + S.fx.comp)) {
    const left = W.comps.filter(c => !S.comps.includes(c));
    if (left.length) { const c = pick(left); S.comps.push(c); say('🤝 ' + c + ' เข้าร่วมเดินทางกับคุณ', 'love'); }
  }
  if (S.comps.length && S.mode === 'adventure' && chance(0.025)) {
    const c = S.comps.splice(r(0, S.comps.length - 1), 1)[0];
    say('🕯️ ' + c + ' จากไปในการต่อสู้ คุณจะไม่มีวันลืม', 'sad');
  }
  if (chance(0.03 + S.stats.luk * 0.002)) {
    if (chance(0.5)) { const g = Math.round(r(200, 800) * (1 + S.rankIdx)); S.gold += g; say('💎 ค้นพบสมบัติที่ซ่อนอยู่ มูลค่า ' + fmtGold(g), 'rare'); }
    else { S.powMul *= 1.06; say('🗡️ ได้รับอุปกรณ์วิเศษชิ้นใหม่ พลังต่อสู้เพิ่มขึ้น', 'rare'); }
  }
  if (chance(0.05)) say('🌍 ' + pick(W.worldEv), 'world');

  // ภัยระดับโลก — เส้นทางผู้กล้าเจอเร็วกว่า
  const early = pathOf(S.path).bossEarly;
  const bossLv = early ? W.boss.lv * 0.85 : W.boss.lv, bossAge = early ? W.boss.age - 4 : W.boss.age;
  if (!S.bossState && S.age >= W.awakenAge + 3 && S.age >= S.bossRetry && (S.level >= bossLv || S.age >= bossAge)) {
    S.pending = bossChoice();
  }
  doomYear();
  if (S.dead) return;
  // วัยเกษียณ
  if (!S.pending && !S.flags.retireAsked && S.age >= 45 && S.age >= lifespan() * 0.68) {
    S.flags.retireAsked = true;
    S.pending = RETIRE_CHOICE;
  }

  if (S.out.length === before) say('· ' + pick(W.quiet), 'quiet');
}

// ---------- ความรัก ----------
// S.loves = [{ n ชื่อ, g เพศ, d คำบรรยาย, st: dating|married|lost|left, since, wed, patience }]
// S.partner / S.married / S.spouseLost ยังคงอยู่เป็น "คนหลัก" ให้ UI และอีเวนต์เดิมใช้ต่อได้
const spouses = () => S.loves.filter(l => l.st === 'married');
const datings = () => S.loves.filter(l => l.st === 'dating');
const activeLoves = () => S.loves.filter(l => l.st === 'married' || l.st === 'dating');
const otherGender = () => (chance(0.85) ? (S.gender === 'm' ? 'f' : 'm') : S.gender);
// ชื่อในแต่ละโลกมีไม่มาก — กันไม่ให้คนใหม่ชื่อซ้ำกับคนที่เคยอยู่ในชีวิตรัก
function loveName(g) {
  let n;
  for (let i = 0; i < 12; i++) { n = randName(g); if (!S.loves.some(l => l.n === n)) break; }
  return n;
}

function syncLove() {
  const lost = S.loves.filter(l => l.st === 'lost');
  const main = spouses()[0] || datings()[0] || lost[lost.length - 1] || null;
  S.partner = main ? main.n : null;
  S.partnerGender = main ? main.g : null;
  S.partnerDesc = main ? main.d : null;
  S.married = spouses().length > 0;
  S.spouseLost = !S.married && lost.length > 0;
  S.marriedAge = main ? main.wed : null;
  if (spouses().length >= 3) G.title('ผู้ครองฮาเร็ม');
}

function addLove(d, g, st, name) {
  g = g || otherGender();
  const l = { n: name || loveName(g), g, d, st, since: S.age, wed: st === 'married' ? S.age : null, patience: 2 };
  if (st === 'married' && spouses().length) S.flags.harem = true;
  S.loves.push(l);
  syncLove();
  return l;
}

function marry(l) {
  if (spouses().length) S.flags.harem = true;
  l.st = 'married'; l.wed = S.age;
  syncLove();
}

function loveEnd(l, st, why) {
  l.st = st; l.endAge = S.age;
  if (why) say(why, st === 'lost' ? 'sad' : 'info');
  syncLove();
}

// คนที่มาขอ: ข้อเสนอเฉพาะโลก (W.suitors) ปนกับคนที่สารภาพรักจาก W.partners
function rollSuitor() {
  const W = S.W;
  if (W.suitors && chance(0.65)) {
    const s = pick(W.suitors);
    const g = s.g || otherGender();
    const x = (f, m) => (g === 'f' ? f : m);
    return { g, n: loveName(g), t: s.t, d: s.d(x), gold: s.gold || 0, fame: s.fame || 0, snub: s.snub || 0 };
  }
  const g = otherGender();
  return { g, n: loveName(g), d: pick(W.partners), confess: true, gold: 0, fame: 0, snub: 0 };
}

// คำที่เปลี่ยนตามเพศของอีกฝ่าย เช่น x('ลูกสาว', 'ลูกชาย')
function suitorText(o) {
  const x = (f, m) => (o.g === 'f' ? f : m);
  if (o.confess) return o.d + ' ชื่อ ' + o.n + ' สารภาพกับคุณตรง ๆ ว่าอยากใช้ชีวิตที่เหลือด้วยกัน';
  return o.t(o.n, x);
}

function loveOffer(o, again) {
  o = o || rollSuitor();
  const sp = spouses(), dt = datings();
  const others = sp.length ? 'ทั้งที่คุณมีคู่ชีวิตอยู่แล้วคือ ' + sp.map(l => l.n).join(', ') : dt.length ? 'ขณะที่คุณกำลังคบหากับ ' + dt.map(l => l.n).join(', ') : '';
  const id = 'love' + (++S.loveSeq);
  const opts = [
    {
      t: sp.length ? 'ยอมรับ รับเป็นคู่ชีวิตอีกคน' : 'ยอมรับ',
      d: sp.length ? 'เข้าสู่เส้นทางฮาเร็ม — ครอบครัวใหญ่ขึ้น แต่ความวุ่นวายก็เช่นกัน' : 'แต่งงานเลย' + (o.gold || o.fame ? ' ได้สินสอด/ชื่อเสียงจากอีกฝ่าย' : ''),
      fx: () => {
        const l = addLove(o.d, o.g, 'married', o.n);
        if (o.gold) G.gold(o.gold * (1 + S.rankIdx * 0.3));
        if (o.fame) G.fame(o.fame);
        if (sp.length) {
          G.st('cha', 1);
          return '💍 ' + l.n + ' เข้ามาเป็นคู่ชีวิตอีกคนของคุณ บ้านหลังนี้คึกคักขึ้นอีกเท่าตัว' + (spouses().length >= 3 ? ' ตอนนี้ใคร ๆ ก็เรียกบ้านคุณว่าฮาเร็ม' : '');
        }
        dt.forEach(d => { if (chance(0.6)) loveEnd(d, 'left', '💔 ' + d.n + ' รู้ข่าวการแต่งงานแล้วเดินจากไปโดยไม่พูดอะไร'); });
        return '💍 คุณกับ ' + l.n + ' แต่งงานกันท่ามกลางคำอวยพรของทุกคน';
      },
    },
    {
      t: 'ปฏิเสธ',
      d: sp.length ? 'ซื่อสัตย์ต่อคู่ชีวิต เสน่ห์ ↑' : o.snub ? 'อีกฝ่ายอาจเสียหน้า ชื่อเสียง ↓' : '',
      fx: () => {
        if (o.snub) G.fame(-o.snub);
        if (sp.length) {
          S.loyalty = (S.loyalty || 0) + 1;
          G.st('cha', 1);
          if (S.loyalty >= 2) S.flags.loyal = true;
          return 'คุณตอบว่าหัวใจมีเจ้าของแล้ว ' + sp[0].n + ' ได้ยินเรื่องนี้แล้วยิ้มทั้งวัน';
        }
        return o.n + ' พยักหน้ารับอย่างสงบ ' + (o.snub ? 'แต่คนรอบตัวอีกฝ่ายไม่ค่อยพอใจนัก' : 'แล้วขอบคุณที่คุณตอบตรง ๆ');
      },
    },
  ];
  if (!again) opts.push({
    t: 'บ่ายเบี่ยง ขอเวลาคิด',
    d: 'อีกฝ่ายอาจกลับมาถามใหม่ในอีกไม่กี่ปี',
    fx: () => { S.loveLater = { o, at: S.age + r(2, 4) }; return o.n + ' บอกว่าจะรอคำตอบ แล้วจากไปพร้อมรอยยิ้มที่อ่านไม่ออก'; },
  });
  opts.push({
    t: 'ดูกันไปก่อน',
    d: 'เริ่มคบหา แล้วค่อยตัดสินใจทีหลัง',
    fx: () => { const l = addLove(o.d, o.g, 'dating', o.n); return '💕 คุณกับ ' + l.n + ' เริ่มคบหากัน' + (sp.length ? ' ทั้งที่รู้ว่าคุณมีคู่ชีวิตอยู่แล้ว' : ''); },
  });
  return {
    id, love: true,
    title: again ? '💌 ' + o.n + ' กลับมาขอคำตอบ' : o.confess ? '💌 คำสารภาพรัก' : '💌 ข้อเสนอเรื่องคู่ครอง',
    text: () => (again ? 'หลายปีผ่านไป ' + o.n + ' ยังรอคำตอบจากคุณ — ' : '') + suitorText(o) + (others ? ' — ' + others : ''),
    opts,
  };
}

function datingChoice(l) {
  const sp = spouses();
  const yrs = Math.max(1, S.age - l.since);
  return {
    id: 'love' + (++S.loveSeq), love: true,
    title: '💞 ความสัมพันธ์กับ ' + l.n,
    text: () => 'คุณคบหากับ ' + l.n + ' มา ' + yrs + ' ปีแล้ว คืนหนึ่งอีกฝ่ายถามตรง ๆ ว่าความสัมพันธ์นี้จะไปทางไหน' + (sp.length ? ' ทั้งที่รู้ว่าคุณมีคู่ชีวิตอยู่แล้ว' : ''),
    opts: [
      { t: 'ขอแต่งงาน', d: sp.length ? 'รับเป็นคู่ชีวิตอีกคน (ฮาเร็ม)' : 'ใช้ชีวิตคู่ด้วยกัน', fx: () => { marry(l); return '💍 ' + l.n + ' ร้องไห้ทั้งที่ยิ้ม แล้วตอบตกลงก่อนคุณจะพูดจบ'; } },
      { t: 'คบกันแบบนี้ต่อไป', d: 'อีกฝ่ายอาจรอไม่ไหว', fx: () => {
        l.patience--; l.since = S.age;
        if (l.patience <= 0) { loveEnd(l, 'left'); return '💔 ' + l.n + ' บอกว่ารอมามากพอแล้ว และขอเดินทางของตัวเอง'; }
        return l.n + ' พยักหน้า แต่แววตานั้นเหนื่อยขึ้นนิดหนึ่ง';
      } },
      { t: 'เลิกรา', d: 'เสน่ห์ ↓', fx: () => { G.st('cha', -1); loveEnd(l, 'left'); return 'คุณกับ ' + l.n + ' แยกทางกันอย่างเงียบ ๆ'; } },
    ],
  };
}

function romance() {
  const W = S.W;
  const canAsk = !S.pending && S.age >= 17 && S.age <= 55 && S.age - S.lastChoice >= 2;

  // ข้อเสนอที่บ่ายเบี่ยงไว้กลับมาอีกครั้ง
  if (canAsk && S.loveLater && S.age >= S.loveLater.at) {
    const o = S.loveLater.o;
    S.loveLater = null;
    if (chance(0.7)) { S.pending = loveOffer(o, true); return; }
    say('💭 ได้ข่าวว่า ' + o.n + ' ที่คุณเคยบ่ายเบี่ยงไว้ ไปแต่งงานกับคนอื่นแล้ว', 'info');
  }

  // คบหาอยู่ → ถึงเวลาต้องตัดสินใจ
  for (const l of datings()) {
    if (canAsk && S.age - l.since >= 1 && chance(0.4)) { S.pending = datingChoice(l); return; }
    if (chance(0.25)) say('💕 ' + pick(DATE_LINES).replace('{n}', l.n), 'love');
  }

  // คนใหม่เข้ามาในชีวิต — คนโสดเจอบ่อย คนมีคู่เจอน้อยกว่า (แต่ถ้ามีฮาเร็มแล้ว ข่าวลือดึงคนเข้ามามากขึ้น)
  if (canAsk) {
    const act = activeLoves().length;
    let p = act === 0
      ? 0.09 + S.stats.cha * 0.003 + S.fx.charm + (S.mode === 'slow' ? 0.05 : 0)
      : 0.02 + S.stats.cha * 0.0015 + S.fx.charm * 0.5 + (S.flags.harem ? 0.03 : 0);
    if (S.flags.loyal) p *= 0.4;
    if (S.age > 45) p *= 0.5;
    if (chance(p)) { S.pending = loveOffer(); return; }
  }

  const sp = spouses();
  if (!sp.length) return;
  // ลูก — คู่ชีวิตยิ่งมาก ลูกยิ่งมีโอกาสมากขึ้น
  if (S.age <= 48 && S.kids < 6 + 2 * (sp.length - 1) && chance((0.13 + (S.mode === 'slow' ? 0.06 : 0)) * (1 + 0.35 * (sp.length - 1)))) {
    S.kids++;
    say('👶 ลูกคนที่ ' + S.kids + ' ถือกำเนิด' + (sp.length > 1 ? 'กับ ' + pick(sp).n : '') + ' ชื่อ ' + pick(W.names[chance(0.5) ? 'm' : 'f']), 'love');
  }
  // ค่าใช้จ่ายฮาเร็ม — ถ้าเงินหมด อาจมีคนจากไป
  if (sp.length >= 2) {
    const cost = Math.round(12 * (1 + S.rankIdx) * (sp.length - 1));
    if (S.gold >= cost) S.gold -= cost;
    else if (chance(0.3)) { const l = pick(sp); loveEnd(l, 'left', '💔 ' + l.n + ' ทนความขัดสนในบ้านไม่ไหว จึงขอแยกทางไป'); }
  }
  for (const l of spouses()) {
    if (chance(0.006 * (S.age > 55 ? 4 : 1))) loveEnd(l, 'lost', '🕯️ ' + l.n + ' คู่ชีวิตของคุณจากไปก่อน หลังใช้ชีวิตร่วมกัน ' + (S.age - l.wed) + ' ปี');
  }
}

function agingCheck() {
  const L = lifespan();
  let p = 0;
  if (S.age > L * 0.85) p = 0.05 + (S.age - L * 0.85) / (L * 0.3) * 0.5;
  else if (S.age >= 20) p = 0.002;
  if (!chance(p)) return;
  if (S.age < L * 0.6) die('ล้มป่วยด้วยโรคร้ายและจากไปก่อนวัยอันควร', 'illness');
  else if (S.kids > 0) die('จากไปอย่างสงบด้วยวัยชรา ท่ามกลางลูกหลานที่รายล้อม', 'old');
  else die('จากไปอย่างสงบด้วยวัยชรา', 'old');
}

// ---------- เหตุการณ์ทางเลือก ----------
// เงื่อนไขของตัวเลือก: ค่าที่ต้องมีถึงจะเลือกได้ (สเตตัส, level, fame, gold)
function reqStatus(opt) {
  if (!opt.req) return [];
  return Object.entries(opt.req).map(([k, need]) => {
    const have = k === 'level' ? S.level : k === 'fame' ? Math.round(S.fame) : k === 'gold' ? S.gold : S.stats[k];
    return { k, need, have, ok: have >= need };
  });
}
const optOpen = opt => reqStatus(opt).every(x => x.ok);

function pickChoice() {
  if (S.age - S.lastChoice < 3) return null;
  const pool = CHOICES.filter(c =>
    (!c.w || c.w === S.W.id) && S.age >= c.min && S.age <= c.max && !S.used[c.id] && (!c.cond || c.cond(S)) &&
    (typeof c.opts === 'function' || c.opts.some(optOpen)));
  for (const c of pool.sort(() => rand() - 0.5)) {
    if (chance(c.p)) return c;
  }
  return null;
}

function choiceOpts(c) { return typeof c.opts === 'function' ? c.opts() : c.opts; }

function applyChoice(c, i) {
  const opt = choiceOpts(c)[i];
  if (!optOpen(opt)) return null;
  S.used[c.id] = true;
  S.lastChoice = S.age;
  S.ctxCause = 'บาดเจ็บสาหัสจากเหตุการณ์ "' + c.title + '"';
  S.out = [];
  const before = { ...S.stats };
  const res = opt.fx(S);
  // สรุปค่าสถานะที่เปลี่ยนจากการเลือกครั้งนี้
  const diff = STAT_KEYS.filter(k => S.stats[k] !== before[k]).map(k => STAT_NAMES[k] + ' ' + (S.stats[k] > before[k] ? '+' : '−') + Math.abs(S.stats[k] - before[k]));
  if (diff.length) say((diff.some(d => d.includes('+')) ? '📈 ' : '📉 ') + diff.join(' · '), 'gain');
  S.history.push({ age: S.age, title: c.title, pick: opt.t });
  S.pending = null;
  updateRank(S.rankIdx);
  return { res, extra: S.out };
}

function bossChoice() {
  const B = S.W.boss;
  const P = power();
  const pct = Math.round(winChance(P, B.pow) * 100);
  return {
    id: 'boss', title: '⚠️ ' + B.n, boss: true,
    text: () => B.intro,
    opts: [
      { t: B.ascend ? 'ฝ่าทัณฑ์สวรรค์' : 'ออกไปเผชิญหน้า', d: 'พลังของคุณ ' + P + ' ปะทะ ' + B.pow + ' · โอกาสชนะราว ' + pct + '%', fx: bossFight },
      B.ascend
        ? { t: 'กดพลังไว้ รอให้พร้อมกว่านี้', d: 'ปลอดภัยกว่า', fx: bossAvoid }
        : S.path === 'hero'
          ? { t: 'หนีหน้าที่ผู้กล้า', d: 'รอดแน่ แต่ชื่อเสียงพังและอาจไม่มีใครหยุดมันได้', fx: bossAvoid }
          : { t: 'อยู่แนวหลัง ปกป้องคนที่รัก', d: 'ปลอดภัยกว่า แต่ถ้าไม่มีใครหยุดมัน โลกอาจถูกทำลาย', fx: bossAvoid },
    ],
  };
}

// ---------- ภัยล้างโลก ----------
const doomOf = () => DOOM[S.W.id];
const doomPow = () => doomOf().pow || S.W.boss.pow;

function startDoom() {
  if (S.doomOn || S.flags.doomStopped) return;
  S.doomOn = true; S.doom = 5;
  S.risk += 0.1;
}

// ทุกปี: ภัยลุกลาม (ชิวเร็วกว่า) มีโอกาสที่ผู้กล้าคนอื่นจะหยุดได้ ถึง 60% มีศึกสุดท้าย ถึง 100% โลกแตก
function doomYear() {
  const D = doomOf(), P = pathOf(S.path);
  // โลกที่บอสคือทัณฑ์สวรรค์ (ยุทธภพ) — ภัยล้างโลกตื่นเองตามอายุ เฉพาะคนที่เลือกใช้ชีวิตชิว
  if (D.age && P.doomFast && !S.flags.doomRolled && S.age >= D.age) {
    S.flags.doomRolled = true;
    if (chance(0.5)) { startDoom(); say('🌑 ' + D.n + 'ตื่นขึ้นจากผนึก ไม่มีใครในยุคนี้แข็งแกร่งพอจะหยุดมัน', 'world'); }
  }
  if (!S.doomOn) return;
  if (chance(P.doomFast ? 0.04 : 0.08)) {
    S.doomOn = false; S.flags.doomStopped = true; S.risk = Math.max(0, S.risk - 0.1);
    say('🌅 ผู้กล้าที่ไม่มีใครรู้จักหยุด' + D.n + 'ไว้ได้ในวินาทีสุดท้าย โลกรอดมาได้อีกครั้ง', 'world');
    return;
  }
  const before = S.doom;
  S.doom = Math.min(100, S.doom + r(8, 16) * (P.doomFast ? 1.4 : 1));
  [25, 50, 75].forEach((th, i) => { if (before < th && S.doom >= th) say('☄️ ' + D.signs[i], 'world'); });
  if (S.doom >= 100) {
    die(D.end, 'worldend');
    return;
  }
  if (S.doom >= 60 && !S.flags.lastStand && !S.pending) {
    S.flags.lastStand = true;
    S.pending = lastStandChoice();
  }
}

function lastStandChoice() {
  const D = doomOf();
  const E = doomPow() * 0.85; // ผู้รอดชีวิตทั้งโลกรวมพลังช่วย
  const pct = Math.round(winChance(power(), E) * 100);
  return {
    id: 'laststand', title: '☄️ วันสิ้นโลก', boss: true,
    text: () => D.last,
    opts: [
      { t: 'ลุกขึ้นสู้เป็นครั้งสุดท้าย', d: 'พลังของคุณ ' + power() + ' · โอกาสชนะราว ' + pct + '%', fx: () => {
        if (chance(winChance(power(), E))) {
          S.doomOn = false; S.flags.doomStopped = true; S.risk = Math.max(0, S.risk - 0.1);
          G.fame(600); gainXp(1500); G.title('ผู้หยุดวันสิ้นโลก');
          return D.n + 'ล้มลงต่อหน้าผู้รอดชีวิตทั้งโลก คนที่ไม่เคยถือดาบมาทั้งชีวิตกลับกลายเป็นผู้ช่วยโลกไว้';
        }
        changeHp(-maxHp() * rf(0.7, 1.4), 'ล้มลงในศึกสุดท้ายกับ' + D.n);
        return S.dead ? 'คุณสู้จนลมหายใจสุดท้าย...' : 'คุณพ่ายแพ้แต่ยังรอดมาได้ เวลาของโลกนี้เหลือน้อยเต็มที';
      } },
      { t: 'พาคนที่รักหนีไปให้ไกลที่สุด', d: 'ใช้เวลาที่เหลือกับครอบครัว', fx: () => { S.flags.withLoved = true; G.st('cha', 2); return 'คุณพาทุกคนที่รักไปยังหุบเขาที่ไกลที่สุดที่หาได้ ทุกคืนนั่งดูดาวด้วยกันราวกับไม่มีอะไรจะเกิดขึ้น'; } },
      { t: 'ใช้ชีวิตวันสุดท้ายให้คุ้มที่สุด', d: 'โชค เสน่ห์ ↑ เงิน ↓', fx: () => { G.st('luk', 3); G.st('cha', 2); G.gold(-Math.floor(S.gold * 0.6)); return 'คุณใช้เงินที่เก็บมาทั้งชีวิตจัดงานเลี้ยงให้ทั้งเมือง ถ้าโลกจะจบ ก็ขอให้จบด้วยเสียงหัวเราะ'; } },
    ],
  };
}

function bossFight() {
  const B = S.W.boss;
  if (chance(winChance(power(), B.pow))) {
    S.bossState = 'win';
    G.fame(500); G.gold(r(3000, 8000)); gainXp(1500); G.title(B.title);
    if (B.ascend) { die('ฝ่าทัณฑ์สวรรค์สำเร็จ ทะยานขึ้นสู่สรวงสวรรค์เป็นเซียนอมตะ', 'ascend'); }
    return B.win;
  }
  changeHp(-maxHp() * rf(0.7, 1.4), B.killed);
  if (S.dead) return B.lose + '...';
  if (B.ascend) { S.bossRetry = S.age + 8; G.st('vit', -3); return B.lose + ' แต่คุณรอดมาได้อย่างหวุดหวิด รากฐานเสียหาย ต้องบำเพ็ญใหม่อีกหลายปี'; }
  S.bossState = 'lost';
  if (chance(S.path === 'hero' ? 0.65 : 0.5)) return B.lose + ' คุณรอดชีวิตมาได้อย่างปาฏิหาริย์ และในที่สุดพันธมิตรก็ร่วมกันผนึกมันไว้ได้';
  startDoom();
  return B.lose + ' คุณรอดชีวิตมาได้อย่างปาฏิหาริย์ แต่ไม่มีใครหยุดมันได้อีกแล้ว โลกเริ่มเดินเข้าสู่จุดจบ';
}

function bossAvoid() {
  const B = S.W.boss;
  if (B.ascend) { S.bossRetry = S.age + 5; return 'คุณกดพลังไว้ เมฆดำค่อย ๆ สลายไป'; }
  S.bossState = 'avoid';
  if (S.path === 'hero') { G.fame(-80); G.title('ผู้กล้าที่หนีศึก'); }
  if (chance(pathOf(S.path).rescue)) return 'ในที่สุดภัยครั้งนี้ก็ถูกปราบโดยผู้อื่น คุณได้แต่มองดูจากที่ไกล';
  startDoom();
  return 'ไม่มีใครหยุดมันได้ โลกเริ่มเดินเข้าสู่จุดจบ ทุกอย่างอันตรายขึ้นทุกปี';
}

// ---------- สรุปชีวิต ----------
function fmtGold(n) { return Math.round(n * S.W.goldMul).toLocaleString('th-TH') + ' ' + S.W.cur; }

function fmtOneIn(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, '') + ' ล้านล้าน';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' พันล้าน';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' ล้าน';
  return Math.round(n).toLocaleString('th-TH');
}

function finalOneIn() {
  let n = S.oneIn;
  if (S.bossState === 'win') n *= 25;
  if (S.rankIdx === ranks().length - 1) n *= 8;
  if (S.flags.revived) n *= 2;
  if (S.deathType === 'return') n *= 30;
  if (S.deathType === 'worldend') n *= 10;
  if (S.titles.includes('ผู้หยุดวันสิ้นโลก')) n *= 20;
  if (S.kids >= 4) n *= 2;
  if (S.loves.filter(l => l.wed !== null).length >= 3) n *= 3;
  return n;
}

function achievements() {
  const a = [];
  const top = ranks().length - 1;
  if (S.bossState === 'win') a.push(['👑', S.W.boss.title]);
  if (S.rankIdx === top) a.push(['🏆', 'ไปถึง' + rankLabel() + 'สูงสุด']);
  if (S.cls === S.W.hidden) a.push(['🌟', 'ผู้ครองอาชีพลับ']);
  if (S.skills.some(s => s.r === 'UR')) a.push(['🌈', 'ผู้ได้รับพรลิขิตสวรรค์']);
  if (S.wins >= 100) a.push(['⚔️', 'ผ่านศึกร้อยครั้ง']);
  if (S.married && S.kids >= 3) a.push(['🏡', 'ครอบครัวใหญ่อบอุ่น']);
  const wedN = S.loves.filter(l => l.wed !== null).length;
  if (wedN >= 3) a.push(['👑', 'ฮาเร็ม ' + wedN + ' คน']);
  else if (S.flags.loyal && wedN === 1 && S.loves[0] && S.loves[0].wed !== null) a.push(['💍', 'รักเดียวใจเดียว']);
  if (S.mode === 'slow' || S.modeHist[0] === 'slow') a.push(['🌿', 'สโลว์ไลฟ์ในต่างโลก']);
  if (S.flags.revived) a.push(['⏳', 'ตายแล้วฟื้น ' + S.flags.revived + ' ครั้ง']);
  if (S.age >= 100) a.push(['🐢', 'อายุเกินร้อยปี']);
  if (S.age < 30 && S.deathType === 'battle') a.push(['🥀', 'ดาวที่ดับไปก่อนเวลา']);
  if (S.gold * S.W.goldMul >= 50000 * S.W.goldMul) a.push(['💰', 'มหาเศรษฐีแห่งยุค']);
  if (S.disciple) a.push(['📿', 'มีผู้สืบทอด']);
  if (S.deathType === 'return') a.push(['🚪', 'ผู้กลับสู่โลกเดิม']);
  if (S.deathType === 'worldend') a.push(['☄️', 'อยู่จนวันสิ้นโลก']);
  if (S.titles.includes('ผู้หยุดวันสิ้นโลก')) a.push(['🌅', 'ผู้หยุดวันสิ้นโลก']);
  if (S.path === 'chill' && S.bossState !== 'win' && S.deathType !== 'worldend' && !S.doomOn) a.push(['🍵', 'ชิวจนจบโดยโลกไม่แตก']);
  if (S.comps.length >= 3) a.push(['🤝', 'สหายร่วมทางมากมาย']);
  return a;
}

function lifeTitle() {
  if (S.deathType === 'ascend') return 'ชีวิตที่บำเพ็ญจนเป็นเซียนอมตะ';
  if (S.bossState === 'win') return 'ชีวิตของ' + S.W.boss.title;
  if (S.deathType === 'return') return 'ชีวิตที่เลือกกลับบ้าน';
  if (S.deathType === 'worldend') return S.flags.withLoved ? 'ชีวิตที่อยู่กับคนที่รักจนวันสิ้นโลก' : 'ชีวิตสุดท้ายก่อนโลกล่มสลาย';
  if (S.titles.includes('ผู้หยุดวันสิ้นโลก')) return 'ชีวิตของผู้หยุดวันสิ้นโลก';
  if (S.titles.length) return 'ชีวิตของ "' + S.titles[S.titles.length - 1] + '"';
  return 'ชีวิตของ' + S.cls.n + ' ระดับ ' + rankName();
}

function biography() {
  const W = S.W, g = S.gender === 'm' ? 'ชาย' : 'หญิง';
  const sk = S.skills.map(s => '「' + s.n + '」(' + RARITY.find(x => x.id === s.r).name + ')').join(' และ ');
  const p = [];
  p.push('ในชาติก่อน' + S.prevDeath + ' เทพธิดาจึงส่งวิญญาณมาเกิดใหม่ใน' + W.name);
  p.push('เกิดเป็น' + S.race.n + 'เพศ' + g + ' ในฐานะ' + W.births[S.birth.id] + ' พร้อมพรสกิล ' + sk);
  p.push('ตั้งแต่ลืมตาก็ตั้งใจว่าจะเดินตามเส้นทาง「' + pathOf(S.path).n(W) + '」');
  p.push('ตื่นพลังเป็น' + S.cls.n + ' เมื่ออายุ ' + W.awakenAge + ' ปี และไต่' + rankLabel() + 'จนถึง 「' + rankName() + '」 (Lv. ' + S.level + ')');
  if (S.wins + S.losses > 0) p.push('ผ่านการต่อสู้ ' + (S.wins + S.losses) + ' ครั้ง ชนะ ' + S.wins + ' ครั้ง' + (S.biggest ? ' ศัตรูที่แข็งแกร่งที่สุดที่เคยล้มได้คือ' + S.biggest.name : ''));
  if (S.bossState === 'win') p.push('ปราบ' + W.boss.n + 'ได้สำเร็จ จนได้รับสมญานาม 「' + W.boss.title + '」');
  else if (S.bossState === 'lost') p.push('เคยยืนหยัดต่อสู้กับ' + W.boss.n + ' แม้จะไม่อาจเอาชนะได้');
  if (S.titles.includes('ผู้หยุดวันสิ้นโลก')) p.push('ในวันที่โลกใกล้ล่มสลาย ได้ลุกขึ้นหยุด' + DOOM[W.id].n + 'ไว้ได้ในศึกสุดท้าย');
  if (S.deathType === 'worldend') p.push('ได้เห็นโลกใบนี้ค่อย ๆ ล่มสลาย' + (S.flags.withLoved ? ' และอยู่เคียงข้างคนที่รักจนวินาทีสุดท้าย' : ''));
  const wed = S.loves.filter(l => l.wed !== null);
  const kidsTxt = S.kids ? ' มีลูก ' + S.kids + ' คน' : '';
  if (wed.length >= 2) p.push('ใช้ชีวิตคู่กับคู่ชีวิตถึง ' + wed.length + ' คน ได้แก่ ' + wed.map(l => l.n).join(', ') + kidsTxt);
  else if (wed.length) p.push('ใช้ชีวิตคู่กับ ' + wed[0].n + (wed[0].st === 'lost' ? ' จนอีกฝ่ายจากไปก่อน' : wed[0].st === 'left' ? ' แม้สุดท้ายจะแยกทางกัน' : '') + kidsTxt);
  else if (S.loves.length) p.push('เคยมีความรักกับ ' + S.loves.map(l => l.n).slice(0, 3).join(', ') + ' แต่ไม่ได้ลงเอยด้วยการแต่งงาน');
  else if (S.kids) p.push('รับเลี้ยงลูก ' + S.kids + ' คน');
  if (S.comps.length) p.push('มีสหายร่วมทางอย่าง' + S.comps.slice(0, 3).join(', '));
  if (S.disciple) p.push('ถ่ายทอดวิชาให้ศิษย์ชื่อ ' + S.disciple);
  if (S.titles.length) p.push('ได้รับฉายา ' + S.titles.map(t => '「' + t + '」').join(' '));
  p.push('ทิ้งทรัพย์สินไว้ ' + fmtGold(S.gold));
  p.push(S.cause + ' เมื่ออายุ ' + S.age + ' ปี');
  return p.join(' ');
}

if (typeof module !== 'undefined') module.exports = { newLife, finalizeBuild, yearTick, applyChoice, choiceOpts, freePoints, power, lifespan, get S() { return S; } };
