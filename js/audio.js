// ===== ดนตรีและเสียงเอฟเฟกต์ สร้างสดด้วย Web Audio (ไม่ใช้ไฟล์เพลง) =====
const AUD = (() => {
  const PREF_KEY = 'isekai_1inmil_sound';
  let ctx = null, master, bus, sfxBus, noiseBuf;
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== 'off'; } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  let song = null, curKey = '', want = null, step = 0, nextT = 0, timer = null;

  // root = โน้ต MIDI, scale = ช่วงเสียง, prog = ลำดับคอร์ด (ดีกรีในสเกล)
  const STYLE = {
    fantasy: { root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 96, lead: 'square', bass: 'triangle', pad: 'triangle' },
    future: { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], bpm: 108, lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', filter: 1500 },
    apoc: { root: 52, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 1, 0], bpm: 70, lead: 'triangle', bass: 'sine', pad: 'sine', sparse: 0.5 },
    war: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 6, 0, 4], bpm: 92, lead: 'square', bass: 'triangle', pad: 'triangle', snare: true },
    fwar: { root: 48, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 0], bpm: 112, lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', filter: 1900 },
    hunter: { root: 54, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], bpm: 120, lead: 'square', bass: 'sawtooth', pad: 'triangle', filter: 2400 },
    wuxia: { root: 67, scale: [0, 2, 4, 7, 9], prog: [0, 3, 1, 4], bpm: 76, lead: 'triangle', bass: 'sine', pad: 'sine', pluck: true },
    heaven: { root: 72, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], bpm: 64, lead: 'sine', bass: 'sine', pad: 'sine' },
  };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0; master.connect(ctx.destination);
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume(); });
    return true;
  }

  function tone(t, freq, dur, type, vol, out, opt = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide, t + dur);
    const a = opt.attack || 0.01, rel = opt.pluck ? dur * 0.9 : Math.min(0.08, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    if (opt.pluck) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(vol, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    let node = o;
    if (opt.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.filter; o.connect(f); node = f; }
    node.connect(g); g.connect(out || bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, vol, type, freq, out) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || bus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  function kick(t, vol) { tone(t, 130, 0.14, 'sine', vol, bus, { slide: 40 }); }

  // สร้างเพลงวน 8 ห้องแบบสุ่มคงที่ตามโลกและอารมณ์ เพื่อให้ฟังเป็นทำนองเดิมทุกครั้ง
  function compose(world, mood) {
    const base = STYLE[mood === 'bless' ? 'heaven' : world] || STYLE.fantasy;
    const s = { ...base, mood };
    if (mood === 'battle') { s.bpm = base.bpm * 1.22; s.drums = 2; s.density = 0.55; }
    else if (mood === 'boss') { s.root = base.root - 5; s.scale = [0, 2, 3, 5, 7, 8, 11]; s.prog = [0, 5, 0, 6]; s.bpm = base.bpm * 1.3; s.drums = 3; s.density = 0.6; s.lead = 'sawtooth'; s.filter = 1600; }
    else if (mood === 'sad') { s.bpm = base.bpm * 0.62; s.drums = 0; s.density = 0.22; s.lead = 'sine'; s.bass = 'sine'; }
    else if (mood === 'bless') { s.drums = 0; s.density = 0.5; }
    else { s.drums = base.snare ? 1 : world === 'hunter' || world === 'future' ? 1 : 0; s.density = 0.36 * (base.sparse ? 0.7 : 1); }
    const r = rng(hash(world + mood));
    const n = s.scale.length;
    s.mel = [];
    let deg = 7;
    for (let bar = 0; bar < 8; bar++) {
      const ch = s.prog[bar % s.prog.length];
      for (let i = 0; i < 16; i++) {
        const strong = i % 4 === 0;
        const p = strong ? s.density + 0.25 : i % 2 === 0 ? s.density : s.density * 0.35;
        if (bar % 4 === 3 && i > 11) { s.mel.push(null); continue; }
        if (r() < p) {
          if (strong) deg = ch + [0, 2, 4, 7][Math.floor(r() * 4)];
          else deg += [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)];
          deg = Math.max(2, Math.min(n * 2 + 2, deg));
          s.mel.push(deg);
        } else s.mel.push(null);
      }
    }
    // ห้อง 5-8 ซ้ำท่อน 1-4 แต่เปลี่ยนตอนจบ ให้ฟังเป็นเพลงมากขึ้น
    for (let i = 64; i < 112; i++) s.mel[i] = s.mel[i - 64];
    return s;
  }

  const noteOf = (s, deg, oct = 0) => {
    const n = s.scale.length;
    return s.root + Math.floor(deg / n) * 12 + s.scale[((deg % n) + n) % n] + oct * 12;
  };

  function schedStep(t) {
    const s = song, i = step % 128, bar = Math.floor(i / 16), k = i % 16;
    const dur = 60 / s.bpm / 4;
    const ch = s.prog[bar % s.prog.length];
    // pad
    if (k === 0 && s.mood !== 'battle') [0, 2, 4].forEach(d => tone(t, mtof(noteOf(s, ch + d, -1)), dur * 16, s.pad, 0.018, bus, { attack: 0.3, filter: 1200 }));
    // bass
    const bassEvery = s.drums >= 2 ? 4 : 8;
    if (k % bassEvery === 0) tone(t, mtof(noteOf(s, ch, -2)), dur * (bassEvery - 0.5), s.bass, 0.07, bus, { filter: 700 });
    // melody
    const m = s.mel[i];
    if (m !== null && m !== undefined) {
      const len = s.mel[i + 1] === null ? dur * 2 : dur * 0.95;
      tone(t, mtof(noteOf(s, m)), len, s.lead, s.lead === 'sine' ? 0.06 : 0.035, bus, { filter: s.filter, pluck: s.pluck });
    }
    // drums
    if (s.drums >= 1) {
      if (k % 8 === 0) kick(t, s.drums >= 3 ? 0.5 : 0.32);
      if (s.drums >= 2 && k % 2 === 0) noise(t, 0.03, 0.05, 'highpass', 7000);
      if ((s.snare || s.drums >= 2) && k % 8 === 4) noise(t, 0.12, s.drums >= 3 ? 0.18 : 0.11, 'bandpass', 1800);
      if (s.drums >= 3 && k % 4 === 2) kick(t, 0.25);
    }
    step++;
  }

  function tick() {
    if (!song || !ctx) return;
    while (nextT < ctx.currentTime + 0.2) { schedStep(nextT); nextT += 60 / song.bpm / 4; }
  }

  function play(world, mood) {
    want = [world, mood];
    if (!ctx || !enabled) return;
    const key = world + ':' + mood;
    if (key === curKey) return;
    curKey = key;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.35);
    setTimeout(() => {
      if (curKey !== key) return;
      song = compose(world, mood); step = 0; nextT = ctx.currentTime + 0.05;
      bus.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.6);
      if (!timer) timer = setInterval(tick, 50);
    }, 380);
  }

  function stop() { curKey = ''; song = null; if (ctx) bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); }

  const SFX = {
    rank: t => [0, 4, 7, 12].forEach((n, i) => tone(t + i * 0.07, mtof(72 + n), 0.12, 'square', 0.06, sfxBus)),
    rare: t => [0, 7, 12, 16, 19, 24].forEach((n, i) => tone(t + i * 0.06, mtof(79 + n), 0.25, 'sine', 0.07, sfxBus, { pluck: true })),
    love: t => [0, 7, 12].forEach((n, i) => tone(t + i * 0.16, mtof(76 + n), 0.6, 'triangle', 0.08, sfxBus, { pluck: true })),
    win: t => { tone(t, mtof(76), 0.06, 'square', 0.04, sfxBus); tone(t + 0.06, mtof(83), 0.08, 'square', 0.04, sfxBus); },
    lose: t => { noise(t, 0.18, 0.2, 'lowpass', 600, sfxBus); tone(t, 110, 0.25, 'sine', 0.15, sfxBus, { slide: 55 }); },
    death: t => [12, 7, 3, 0].forEach((n, i) => tone(t + i * 0.35, mtof(60 + n), 0.6, 'triangle', 0.08, sfxBus, { pluck: true })),
    choice: t => { tone(t, mtof(84), 0.12, 'sine', 0.07, sfxBus, { pluck: true }); tone(t + 0.1, mtof(91), 0.2, 'sine', 0.06, sfxBus, { pluck: true }); },
    boss: t => { tone(t, 55, 1.2, 'sawtooth', 0.09, sfxBus, { filter: 300, slide: 40 }); noise(t, 1, 0.08, 'lowpass', 200, sfxBus); },
    bless: t => [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24].forEach((n, i) => tone(t + i * 0.05, mtof(72 + n), 0.5, 'sine', 0.04, sfxBus, { pluck: true })),
    click: t => tone(t, mtof(88), 0.04, 'square', 0.025, sfxBus),
  };

  function sfx(name) {
    if (!ctx || !enabled || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01);
  }

  function setEnabled(v) {
    enabled = v;
    try { localStorage.setItem(PREF_KEY, v ? 'on' : 'off'); } catch (e) { /* ไม่เป็นไร */ }
    if (v && !init()) return;
    if (!ctx) return;
    master.gain.linearRampToValueAtTime(v ? 0.8 : 0, ctx.currentTime + 0.2);
    if (v) { ctx.resume(); if (want) { curKey = ''; play(want[0], want[1]); } }
  }

  // ต้องเรียกจากการคลิกของผู้ใช้ เพราะเบราว์เซอร์ไม่ให้เล่นเสียงเอง
  function unlock() {
    if (!enabled || !init()) return;
    ctx.resume();
    if (want && !curKey) play(want[0], want[1]);
  }

  return { play, stop, sfx, unlock, setEnabled, get enabled() { return enabled; } };
})();
