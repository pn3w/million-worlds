// ===== พิกเซลอาร์ต: ฉากและตัวละครที่วาดด้วยโค้ดทั้งหมด =====
const PX = (() => {
  const VW = 192, VH = 108, HORIZON = 80, FEET = 99;

  // ---------- ตัวช่วยพื้นฐาน ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const BAYER = [[0, 2], [3, 1]];
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
  const pickR = (r, a) => a[Math.floor(r() * a.length)];

  // ไล่สีแบบดิทเธอร์ (ให้ฟีลพิกเซลยุค 16 บิต)
  function gradient(c, y0, y1, cols) {
    const n = cols.length - 1, bands = 6;
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1) * n;
      const i = Math.min(n - 1, Math.floor(t)), f = t - i;
      const q = f * bands, b = Math.floor(q), fr = q - b;
      const lo = mix(cols[i], cols[i + 1], b / bands), hi = mix(cols[i], cols[i + 1], Math.min(1, (b + 1) / bands));
      rect(c, 0, y, VW, 1, lo);
      c.fillStyle = hi;
      for (let x = 0; x < VW; x++) if (fr > (BAYER[y & 1][x & 1] + 0.5) / 4) c.fillRect(x, y, 1, 1);
    }
  }

  function ridge(c, r, base, amp, step, col) {
    const pts = [];
    for (let x = -step; x <= VW + step; x += step) pts.push(base - r() * amp);
    for (let x = 0; x < VW; x++) {
      const k = (x + step) / step, i = Math.floor(k), f = k - i;
      const y = pts[i] + (pts[i + 1] - pts[i]) * f;
      rect(c, x, y, 1, VH - y, col);
    }
  }

  function skyline(c, r, base, col, minH, maxH, minW, maxW, winCols, winP, broken) {
    let x = -Math.floor(r() * 8);
    while (x < VW) {
      const w = minW + Math.floor(r() * (maxW - minW)), h = minH + Math.floor(r() * (maxH - minH));
      if (broken) {
        for (let xx = 0; xx < w; xx += 2) { const hh = h - (r() < 0.45 ? r() * h * 0.45 : 0); rect(c, x + xx, base - hh, 2, hh + 30, col); }
      } else {
        rect(c, x, base - h, w, h + 30, col);
        if (r() < 0.3) rect(c, x + Math.floor(w / 2), base - h - 4, 1, 4, col);
      }
      if (winCols) for (let wy = base - h + 2; wy < base - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < winP) rect(c, wx, wy, 1, 1, pickR(r, winCols));
      x += w + Math.floor(r() * 3);
    }
  }

  function tri(c, cx, top, h, col, slope = 1) {
    for (let i = 0; i < h; i++) rect(c, cx - Math.floor(i * slope), top + i, Math.floor(i * slope) * 2 + 1, 1, col);
  }

  function castle(c, x, base, col, acc) {
    rect(c, x, base - 22, 30, 22, col);
    for (let i = 0; i < 30; i += 4) rect(c, x + i, base - 24, 2, 2, col);
    [[x - 6, 34], [x + 28, 30], [x + 12, 40]].forEach(([tx, th]) => {
      rect(c, tx, base - th, 8, th, col);
      tri(c, tx + 4, base - th - 8, 8, col, 0.5);
      rect(c, tx + 3, base - th + 6, 2, 3, acc);
    });
    rect(c, x + 16, base - 54, 1, 6, col); rect(c, x + 17, base - 54, 4, 2, acc);
    rect(c, x + 12, base - 8, 6, 8, '#1a1420');
  }

  function pagoda(c, x, base, col, roof) {
    for (let i = 0; i < 3; i++) {
      const w = 16 - i * 4, y = base - 8 - i * 9;
      rect(c, x - w / 2, y, w, 8, col);
      rect(c, x - w / 2 - 4, y - 2, w + 8, 2, roof);
      rect(c, x - w / 2 - 5, y - 3, 1, 1, roof); rect(c, x + w / 2 + 4, y - 3, 1, 1, roof);
    }
    rect(c, x, base - 36, 1, 5, roof);
  }

  function tree(c, x, base, trunk, leaf, size) {
    rect(c, x, base - size, 2, size, trunk);
    for (let i = 0; i < size; i++) {
      const w = Math.round(Math.sin(i / size * Math.PI) * size * 0.7) + 2;
      rect(c, x + 1 - w / 2, base - size * 1.6 + i, w, 1, leaf);
    }
  }

  function house(c, x, base, w, h, wall, roof, style, win) {
    if (style === 'tent') { tri(c, x + w / 2, base - h, h, wall, w / h / 2); rect(c, x + w / 2 - 1, base - 5, 3, 5, '#1a1420'); return; }
    rect(c, x, base - h, w, h, wall);
    if (style === 'peak') tri(c, x + w / 2, base - h - Math.floor(w / 2) + 1, Math.floor(w / 2), roof);
    if (style === 'curve') { rect(c, x - 3, base - h - 2, w + 6, 3, roof); rect(c, x - 4, base - h - 3, 1, 1, roof); rect(c, x + w + 3, base - h - 3, 1, 1, roof); }
    if (style === 'flat') { rect(c, x, base - h - 1, w, 1, roof); rect(c, x + 2, base - h + 2, w - 4, 2, roof); }
    if (style === 'shack') { for (let i = 0; i < w + 2; i++) rect(c, x - 1 + i, base - h - 2 + Math.floor(i / 6), 1, 2, roof); rect(c, x + 2, base - h + 4, 3, 2, mix(wall, '#000000', 0.3)); }
    rect(c, x + 2, base - 6, 3, 6, '#1a1420');
    for (let wx = x + 7; wx < x + w - 2; wx += 5) rect(c, wx, base - h + 4, 2, 2, win);
  }

  function portal(c, cx, cy, rx, ry, cols) {
    cols.forEach((col, i) => {
      const k = 1 - i / cols.length;
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx * k * k) + (y * y) / (ry * ry * k * k);
        if (d <= 1 && (i === 0 ? ((x + y) & 1) === 0 : true)) rect(c, cx + x, cy + y, 1, 1, col);
      }
    });
  }

  function clouds(c, r, y, col, n) {
    for (let i = 0; i < n; i++) {
      const x = r() * VW, w = 14 + r() * 24;
      rect(c, x, y + r() * 10, w, 2, col); rect(c, x + 3, y - 2 + r() * 10, w - 6, 2, col);
    }
  }

  // ---------- จานสีของแต่ละโลก ----------
  const PAL = {
    fantasy: { sky: ['#24346e', '#4a72c4', '#a8cdf0'], far: '#5d78b0', mid: '#34507a', ground: ['#4f8a3e', '#2e5a2c'], acc: '#ffd27a', enemy: '#5aa04a', fx: 'leaf', house: ['#d8c8a8', '#a0453a', 'peak'], day: true },
    future: { sky: ['#0a0418', '#2a0b4d', '#7a1f7a'], far: '#22134a', mid: '#140b2c', ground: ['#22223a', '#121222'], acc: '#38e1ff', neon: ['#38e1ff', '#ff3fa4', '#c6ff3f', '#ffd23f'], enemy: '#8aa0b8', fx: 'rain', house: ['#2a2a48', '#ff3fa4', 'flat'] },
    apoc: { sky: ['#2a2818', '#5e5a2e', '#a39a58'], far: '#4e4a32', mid: '#2c291c', ground: ['#5a4e36', '#3a3222'], acc: '#9be15d', enemy: '#6f8a4a', fx: 'ash', house: ['#6a5a40', '#5a4a3a', 'shack'], day: true },
    war: { sky: ['#2e1c2a', '#8a3e2c', '#e89a52'], far: '#6a3a32', mid: '#3a2020', ground: ['#6a5638', '#43361f'], acc: '#e0a060', enemy: '#4a4a58', fx: 'ember', house: ['#c8b890', '#7a4a2a', 'tent'], day: true },
    fwar: { sky: ['#170812', '#5a1420', '#cf4a2a'], far: '#4a1620', mid: '#24090f', ground: ['#4e3a2a', '#2c1e16'], acc: '#ff7a59', enemy: '#5a3a6a', fx: 'ember', house: ['#8a7a6a', '#4a2a2a', 'peak'] },
    hunter: { sky: ['#0e0a26', '#2c1d62', '#6a52b0'], far: '#2e2460', mid: '#18122f', ground: ['#34344a', '#1e1e2c'], acc: '#a07bff', neon: ['#ffd23f', '#ffffff', '#ff8a3f'], enemy: '#7a4ad0', fx: 'spark', house: ['#3a3a52', '#a07bff', 'flat'] },
    wuxia: { sky: ['#f0e6cc', '#e0cfa4', '#c4b088'], far: '#9aa098', mid: '#5a625c', ground: ['#7a8a62', '#4f5c44'], acc: '#c0392b', enemy: '#3a3a3a', fx: 'petal', house: ['#e8dcc0', '#3a3a3a', 'curve'], day: true },
    heaven: { sky: ['#fff4d6', '#ffe0a8', '#d8b8ff'], far: '#ffffff', mid: '#ffffff', ground: ['#ffffff', '#efe6ff'], acc: '#ffcf6b', enemy: '#fff', fx: 'gold' },
  };
  const SKY_OVERRIDE = {
    death: ['#05060f', '#121a3a', '#2a3460'],
    boss: ['#080006', '#3a0812', '#8a2014'],
    love: ['#2e1a48', '#b8507a', '#ffb08a'],
  };

  // ---------- ภาพไกลของแต่ละโลก ----------
  function backdrop(c, r, world, kind, P) {
    const B = HORIZON;
    switch (world) {
      case 'fantasy':
        ridge(c, r, B - 6, 22, 24, P.far);
        if (kind !== 'battle' && kind !== 'boss') castle(c, 132, B - 4, mix(P.far, '#000000', 0.25), P.acc);
        ridge(c, r, B + 2, 8, 12, P.mid);
        for (let i = 0; i < 6; i++) tree(c, 6 + r() * 90, B + 2, '#4a3020', '#2e5a34', 6 + r() * 4);
        break;
      case 'future':
        skyline(c, r, B, P.far, 20, 58, 6, 14, P.neon, 0.25);
        for (let i = 0; i < 4; i++) rect(c, r() * VW, 10 + r() * 30, 3, 1, pickR(r, P.neon));
        skyline(c, r, B + 4, P.mid, 8, 30, 8, 18, P.neon, 0.12);
        break;
      case 'apoc':
        skyline(c, r, B, P.far, 14, 44, 8, 16, null, 0, true);
        skyline(c, r, B + 4, P.mid, 6, 20, 6, 14, ['#c8b060'], 0.03, true);
        for (let i = 0; i < 3; i++) { const x = r() * VW; rect(c, x, B - 6, 1, 10, '#2a2418'); rect(c, x - 2, B - 4, 2, 1, '#2a2418'); rect(c, x + 1, B - 6, 2, 1, '#2a2418'); }
        break;
      case 'war':
        ridge(c, r, B - 4, 26, 30, P.far);
        ridge(c, r, B + 2, 10, 14, P.mid);
        if (kind !== 'boss') for (let i = 0; i < 4; i++) { const x = 20 + i * 40 + r() * 10; tri(c, x, B - 6, 8, '#b8a880', 0.8); rect(c, x, B - 14, 1, 5, '#3a2a1a'); rect(c, x + 1, B - 14, 3, 2, P.acc); }
        for (let i = 0; i < 3; i++) { const x = r() * VW; for (let k = 0; k < 6; k++) rect(c, x + k * 0.6, B - 10 - k * 4, 3, 3, mix(P.sky[1], '#555555', 0.5)); }
        break;
      case 'fwar':
        ridge(c, r, B - 2, 34, 10, P.far);
        if (kind !== 'boss') { castle(c, 22, B, P.mid, P.acc); drawTpl(c, T.DRAGON, 150, 34, 1, { a: '#2a0a10', b: '#2a0a10', e: '#ff7a59', w: '#2a0a10' }, false); }
        ridge(c, r, B + 4, 6, 8, P.mid);
        break;
      case 'hunter':
        skyline(c, r, B, P.far, 24, 62, 7, 15, P.neon, 0.18);
        if (kind !== 'home') portal(c, 140, 26, 14, 18, ['#5a3ab0', '#8a5aff', '#c8a8ff', '#1a0a3a']);
        skyline(c, r, B + 4, P.mid, 10, 26, 10, 20, P.neon, 0.1);
        break;
      case 'wuxia':
        if (kind !== 'boss' && kind !== 'death') { for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if ((x - 7) ** 2 + (y - 7) ** 2 < 42) rect(c, 150 + x, 12 + y, 1, 1, '#d8432f'); }
        ridge(c, r, B - 20, 30, 18, mix(P.far, '#ffffff', 0.3));
        clouds(c, r, B - 26, '#f4eedc', 5);
        ridge(c, r, B - 6, 22, 14, P.far);
        if (kind !== 'boss') pagoda(c, 40, B - 14, '#4a4440', '#2a2626');
        clouds(c, r, B - 8, '#efe8d6', 4);
        ridge(c, r, B + 2, 8, 10, P.mid);
        break;
      case 'heaven':
        clouds(c, r, 30, '#ffffff', 6);
        for (let i = 0; i < 7; i++) { const x = 20 + i * 26; for (let y = 0; y < B; y += 2) if (((x + y) & 3) === 0) rect(c, x + y * 0.3, y, 1, 1, '#ffffff'); }
        break;
    }
  }

  function middle(c, r, world, kind, P) {
    const B = HORIZON + 6;
    if (!P.house) return;
    const [wall, roof, style] = P.house;
    const win = world === 'wuxia' ? '#d8432f' : P.acc;
    if (kind === 'home') house(c, 116, B + 2, 30, 18, wall, roof, style, win);
    if (kind === 'town') { house(c, 104, B, 22, 14, wall, roof, style, win); house(c, 130, B + 1, 28, 20, mix(wall, '#000000', 0.15), roof, style, win); house(c, 162, B, 24, 13, wall, roof, style, win); }
    if (kind === 'field') {
      house(c, 150, B - 2, 22, 13, wall, roof, style, win);
      for (let y = B + 4; y < VH - 2; y += 3) for (let x = 100; x < VW; x += 4) rect(c, x + (y % 2) * 2, y, 2, 1, world === 'apoc' ? '#7a9a3a' : '#5ab04a');
    }
    if (kind === 'love') tree(c, 150, B + 6, '#4a3020', world === 'wuxia' ? '#e8a0b0' : '#d06a9a', 16);
    if (kind === 'death') {
      rect(c, 89, B - 10, 14, 18, '#8a8f9a'); rect(c, 90, B - 12, 12, 2, '#8a8f9a'); rect(c, 92, B - 13, 8, 1, '#8a8f9a');
      rect(c, 95, B - 8, 2, 8, '#5a5f6a'); rect(c, 92, B - 6, 8, 2, '#5a5f6a');
      [84, 106, 110].forEach(x => { rect(c, x, B + 6, 1, 3, '#3a6a3a'); rect(c, x - 1, B + 5, 3, 1, pickR(r, ['#e86a8a', '#ffd27a', '#ffffff'])); });
    }
  }

  // ---------- เทมเพลตสไปรต์ศัตรู (หันซ้าย) ----------
  const T = {
    SLIME: ['...aaaa...', '..aaaaaa..', '.aaaaaaaa.', '.aewaaewa.', 'aaaaaaaaaa', 'aaaaaaaaaa', '.bbbbbbbb.'],
    GOBLIN: ['..aaa...', '.aaaaa..', 'aeaeaaa.', '.awaaa..', '..bbb...', '.abbba..', 'a.bbb.a.', '..bbb...', '..b.b...', '..b.b...', '.bb.bb..'],
    BEAST: ['.aa...........', 'aaaa..........', 'eaaaa....a....', 'aaaaaaaaaaa...', 'wwaaaaaaaaaaa.', '..aaaaaaaaaaaa', '..aa.aa..aa.aa', '..aa.aa..aa.aa', '..bb.bb..bb.bb'],
    KNIGHT: ['...mmm....', '..mmmmm...', '..meemm...', '..mmmmm...', '...mm.....', '.aaaaaaa..', 'aaaaaaaaa.', 'maaaaaaam.', 'm.aaaaa.m.', 'm.aaaaa.m.', 'w.bbbbb.m.', '..bb.bb...', '..bb.bb...', '..bb.bb...', '..bb.bb...', '.mmm.mmm..'],
    ZOMBIE: ['..aaa...', '.aaaaa..', '.eaeaa..', '.aaaaa..', '..bbb...', 'aabbbb..', '..bbbb..', '..bbbb..', '..bbbb..', '..b.bb..', '..b..b..', '..b..b..', '.bb.bb..'],
    ROBOT: ['..mmmmm...', '..meeem...', '..mmmmm...', '....m.....', '.mmmmmmm..', 'mmammmamm.', 'm.mmmmm.m.', 'm.mmmmm.m.', 'e.mmmmm.e.', '..mm.mm...', '..mm.mm...', '..mm.mm...', '.mmm.mmm..'],
    GIANT: ['....aaaa....', '...aaaaaa...', '...aeaaea...', '...aaaaaa...', '....awwa....', '..aaaaaaaa..', '.aaaaaaaaaa.', 'aaabbbbbbaaa', 'aa.bbbbbb.aa', 'aa.bbbbbb.aa', 'aa.bbbbbb.aa', 'w..bbbbbb..w', '...bbbbbb...', '...bb..bb...', '...bb..bb...', '...bb..bb...', '..bbb..bbb..'],
    DRAGON: ['..........aa............', '.........aaaa.......a...', '........aaaaaa.....aa...', '.......aaaaaaaa...aaa...', '..bbb..aaaaaaaaa.aaaa...', '.beebb..aaaaaaaaaaaa....', 'wbbbbbb...aaaaaaaaa.....', '.wbbbbbbbbbbbbbbbb......', '....bbbbbbbbbbbbbbbbb...', '.....bbbbbbbbbbbbbbbbbb.', '......bbbbbbbbbbbb...bbb', '......bb..bb..bb......bb', '......bb..bb..bb........', '.....bbb.bbb.bbb........'],
  };
  // [เทมเพลต, สเกล, จำนวน] ตามระดับศัตรู 0-8
  const ENEMIES = {
    fantasy: [['SLIME', 1, 1], ['GOBLIN', 1, 1], ['BEAST', 1, 1], ['GOBLIN', 2, 1], ['GIANT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['DRAGON', 2, 1], ['GIANT', 3, 1]],
    future: [['ROBOT', 1, 1], ['KNIGHT', 1, 2], ['ROBOT', 2, 1], ['KNIGHT', 2, 1], ['ROBOT', 3, 1], ['ROBOT', 2, 3], ['KNIGHT', 2, 1], ['BEAST', 2, 1], ['ROBOT', 3, 2]],
    apoc: [['ZOMBIE', 1, 1], ['ZOMBIE', 1, 3], ['BEAST', 1, 2], ['KNIGHT', 1, 3], ['ZOMBIE', 2, 1], ['BEAST', 2, 1], ['ZOMBIE', 1, 6], ['ZOMBIE', 3, 1], ['SLIME', 5, 1]],
    war: [['KNIGHT', 1, 1], ['KNIGHT', 1, 2], ['KNIGHT', 1, 3], ['BEAST', 2, 1], ['KNIGHT', 1, 5], ['KNIGHT', 2, 1], ['KNIGHT', 1, 7], ['KNIGHT', 2, 2], ['KNIGHT', 2, 4]],
    fwar: [['GOBLIN', 2, 1], ['KNIGHT', 1, 2], ['ZOMBIE', 1, 3], ['BEAST', 2, 1], ['GIANT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['GIANT', 3, 1], ['DRAGON', 2, 1]],
    hunter: [['GOBLIN', 1, 2], ['BEAST', 1, 1], ['GOBLIN', 2, 1], ['ZOMBIE', 2, 1], ['KNIGHT', 2, 1], ['DRAGON', 1, 1], ['BEAST', 2, 2], ['GOBLIN', 1, 6], ['GIANT', 3, 1]],
    wuxia: [['KNIGHT', 1, 1], ['KNIGHT', 1, 2], ['BEAST', 1, 1], ['KNIGHT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['BEAST', 2, 1], ['KNIGHT', 2, 1], ['GIANT', 3, 1]],
  };

  function drawTpl(c, tpl, x, feet, s, pal, flip) {
    const h = tpl.length, w = tpl[0].length;
    const ox = Math.round(x - (w * s) / 2), oy = feet - h * s;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const ch = tpl[yy][xx];
      if (ch === '.') continue;
      rect(c, ox + (flip ? w - 1 - xx : xx) * s, oy + yy * s, s, s, pal[ch]);
    }
  }

  function enemyPal(world, t) {
    const P = PAL[world];
    const a = mix(P.enemy, '#8a1a2a', t / 12);
    return { a, b: mix(a, '#000000', 0.35), e: world === 'future' ? '#38e1ff' : '#ff3b3b', w: '#f0eee8', m: world === 'war' || world === 'wuxia' ? mix('#7a7f8a', a, 0.3) : '#9aa4b8' };
  }

  function drawEnemy(c, world, t, x, feet, frame, hit) {
    const [name, s0, n] = ENEMIES[world][Math.max(0, Math.min(8, t))];
    const pal = enemyPal(world, t);
    const tpl = T[name];
    const s = Math.max(1, Math.min(s0 * 2, Math.floor(72 / tpl.length)));
    const bob = frame % 16 < 8 ? 0 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const dx = ((i % 3) * 13 + Math.floor(i / 3) * 6) * Math.min(s, 2) / 1.4, dy = Math.floor(i / 3) * -4;
      drawTpl(c, tpl, x + dx, feet + dy + (i === 0 ? bob : 0), s, hit && i === 0 ? { a: '#ffffff', b: '#ffffff', e: '#ffffff', w: '#ffffff', m: '#ffffff' } : pal, false);
    }
  }

  // ---------- ตัวละคร ----------
  const STAT_COL = { str: '#b8413a', agi: '#3c8f5a', int: '#3f5fc0', vit: '#7d8798', luk: '#c8962e', cha: '#9a4cbb' };
  const WEAPON = {
    sword: 'sword', knight: 'sword+shield', cav: 'spear', pike: 'spear', fighter: 'sword', dknight: 'spear', tankh: 'sword+shield',
    mage: 'staff', caster: 'staff', warmage: 'staff', psion: 'orb', array: 'book', quantum: 'orb',
    priest: 'staffw', healer: 'staffw', medic: 'kit', surgeon: 'kit', paladin: 'hammer+shield', monk: 'none', palm: 'none',
    archer: 'bow', ranger: 'bow', gunner: 'gun', cyborg: 'gun', pilot: 'gun', hacker: 'tablet',
    thief: 'dagger', assassin: 'dagger', ninja: 'dagger', shadow: 'dagger', poison: 'dagger', player: 'dagger',
    tamer: 'pet', beast: 'pet', summoner: 'pet', smith: 'hammer', mech: 'hammer', nano: 'hammer', crafter: 'hammer', runesmith: 'hammer',
    alch: 'gourd', merchant: 'bag', scav: 'bag', idol: 'mic', leader: 'flag', genius: 'flag', tact: 'book', brawler: 'axe',
    hero: 'sword', apex: 'claw', ancient: 'spear', heir: 'sword',
  };
  const ROBE = ['mage', 'caster', 'warmage', 'priest', 'healer', 'array', 'alch', 'monk', 'psion', 'tact', 'heir'];
  const SKINS = ['#f2c9a0', '#e0ac7e', '#c68a5a', '#8d5a3a', '#f5d6b8'];
  const HAIR_ALL = ['#2a1d14', '#5a3a1e', '#c8a050', '#e8d090', '#8a2a2a', '#1a1a2a', '#d0d0d8', '#3a5ab0', '#b04080'];
  const HAIR_REAL = ['#2a1d14', '#5a3a1e', '#1a1a2a', '#3a2a1a'];

  // ลักษณะตัวละครจากสถานะเกม (ค่าคงที่ตามชื่อ เพื่อให้หน้าตาเหมือนเดิมตลอดชีวิต)
  function look(st, opt = {}) {
    const r = rng(hash(opt.name || st.lookSeed || st.name || 'x'));
    const world = st.W.id;
    const cls = opt.cls || st.cls;
    const female = (opt.gender || st.gender) === 'f';
    const real = world === 'war' || world === 'hunter' || world === 'apoc' || world === 'wuxia';
    const race = opt.race === undefined ? st.race.n : opt.race;
    const L = {
      female, world,
      skin: pickR(r, SKINS),
      hair: pickR(r, real ? HAIR_REAL : HAIR_ALL),
      hairStyle: female ? 2 + Math.floor(r() * 2) : Math.floor(r() * 2),
      weapon: cls ? WEAPON[cls.id] || 'none' : 'none',
      robe: cls ? ROBE.includes(cls.id) || (world === 'wuxia' && r() < 0.5) : false,
      acc: PAL[world].acc,
    };
    if (opt.partner) { L.weapon = 'none'; L.robe = world === 'wuxia' || r() < 0.3; }
    const main = cls ? cls.main[0] : pickR(r, Object.keys(STAT_COL));
    let out = opt.partner ? pickR(r, Object.values(STAT_COL)) : STAT_COL[main];
    if (world === 'apoc') out = mix(out, '#6a5a3a', 0.5);
    if (world === 'future' || world === 'hunter') out = mix(out, '#1a1a2a', 0.45);
    if (world === 'wuxia') out = mix(out, '#e8e0d0', 0.35);
    L.outfit = out;
    L.outfit2 = world === 'future' ? PAL.future.acc : mix(out, '#000000', 0.35);
    L.leg = world === 'future' ? '#1a1a2a' : mix(out, '#1a1a2a', 0.6);
    if (race) {
      if (race.includes('เอลฟ์')) { L.elf = true; L.skin = '#f4dcc4'; }
      if (race.includes('แคระ')) { L.dwarf = true; }
      if (race.includes('สัตว์') || race.includes('จิ้งจอก')) { L.ears = true; L.tail = true; }
      if (race.includes('มังกร')) { L.horns = true; }
      if (race.includes('ออร์ค')) { L.skin = '#7a9a5a'; L.tusk = true; }
      if (race.includes('แอนดรอยด์')) { L.skin = '#d8e0e8'; L.android = true; }
      if (race.includes('กลายพันธุ์')) { L.skin = '#a8b88a'; }
      if (race.includes('ต่างดาว')) { L.skin = '#b0c8f0'; }
    }
    const age = opt.age === undefined ? st.age : opt.age;
    const L2 = typeof lifespan === 'function' && st.stats && !opt.partner ? lifespan() : 75;
    L.stage = age < 13 ? 'child' : age >= L2 * 0.72 ? 'elder' : 'adult';
    if (L.stage === 'elder') L.hair = '#d4d4d8';
    if (opt.aura) L.aura = opt.aura;
    return L;
  }

  // วาดตัวละครขยาย 2 เท่า ให้เห็นรายละเอียดชัดบนฉาก
  function drawPerson(c, L, x, feet, frame, flip, sc = 2) {
    c.save();
    c.translate(x, feet); c.scale(flip ? -sc : sc, sc); c.translate(-x, -feet);
    const child = L.stage === 'child', elder = L.stage === 'elder';
    const torso = child ? 4 : L.dwarf ? 5 : 7, legs = child ? 2 : L.dwarf ? 3 : 4;
    const total = 7 + torso + legs + 1;
    const bob = frame % 20 < 10 ? 0 : 1;
    const ox = x - 4, oy = feet - total + bob;
    const R = (dx, dy, w, h, col) => rect(c, ox + dx, oy + dy, w, h, col);
    const { skin, hair, outfit: out, outfit2: out2, leg } = L;
    const boot = '#3a2618', ty = 7;

    if (L.aura) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + frame * 0.12;
        rect(c, x + Math.cos(a) * 8, oy + total / 2 + Math.sin(a) * (total / 2 + 3), 1, 1, L.aura);
      }
    }
    if (L.wings) {
      for (let i = 0; i < 9; i++) { R(-2 - i, ty - 2 + Math.floor(i / 2), 1, 7 - Math.floor(i / 2), '#ffffff'); R(9 + i, ty - 2 + Math.floor(i / 2), 1, 7 - Math.floor(i / 2), '#ffffff'); }
    }
    if (L.hairStyle === 2) R(0, 1, 2, child ? 6 : 9, hair);
    if (L.hairStyle === 3) R(-1, 2, 2, 5, hair);
    if (L.tail) { R(-2, ty + torso - 3, 2, 1, hair); R(-3, ty + torso - 4, 1, 1, hair); }

    // ขาและลำตัว
    if (L.robe && !child) {
      R(1, ty, 6, torso + legs, out); R(0, ty + torso + legs - 1, 8, 1, out);
      R(2, ty + torso + legs, 2, 1, boot); R(5, ty + torso + legs, 2, 1, boot);
      R(4, ty, 1, torso + legs, out2);
    } else {
      R(2, ty + torso, 2, legs, leg); R(4, ty + torso, 2, legs, leg);
      R(2, ty + torso + legs, 2, 1, boot); R(4, ty + torso + legs, 3, 1, boot);
      R(1, ty, 6, torso, out);
      if (L.female && !child) R(1, ty + torso - 1, 6, 2, out);
    }
    R(1, ty + torso - 2, 6, 1, out2);
    R(3, ty, 2, 1, out2);
    // แขน
    R(0, ty + 1, 1, torso - 2, out); R(0, ty + torso - 1, 1, 1, skin);
    if (L.weapon && L.weapon.includes('shield')) { R(-2, ty + 1, 3, 5, '#8a95a8'); R(-1, ty + 2, 1, 3, L.acc); }
    // หัว
    R(1, 1, 6, 6, skin);
    R(1, 0, 6, 2, hair); R(1, 2, 1, 2, hair);
    if (L.hairStyle === 1) { R(2, -1, 1, 1, hair); R(4, -1, 1, 1, hair); R(6, -1, 1, 1, hair); }
    if (L.hairStyle === 0) R(6, 2, 1, 1, hair);
    if (L.hairStyle >= 2) R(1, 2, 1, 4, hair);
    R(4, 3, 1, 1, '#1a1420'); R(6, 3, 1, 1, '#1a1420');
    if (child) R(5, 5, 2, 1, mix(skin, '#ff6a6a', 0.35));
    if (L.elf) { R(0, 3, 1, 1, skin); R(-1, 2, 1, 1, skin); }
    if (L.ears) { R(1, -1, 1, 2, hair); R(5, -1, 1, 2, hair); }
    if (L.horns) { R(2, -1, 1, 1, '#e8e0d0'); R(6, -1, 1, 1, '#e8e0d0'); R(1, -2, 1, 1, '#e8e0d0'); }
    if (L.tusk) R(6, 5, 1, 1, '#f0eee8');
    if (L.android) R(2, 3, 1, 3, '#38e1ff');
    if ((elder && !L.female) || L.dwarf) R(3, 5, 4, L.dwarf ? 3 : 2, hair);
    if (L.halo) R(2, -3, 4, 1, '#ffd27a');
    // แขนหน้าและอาวุธ
    R(7, ty + 1, 1, torso - 2, out); R(7, ty + torso - 1, 1, 1, skin);
    if (!child) weapon(R, L, ty + torso - 1);
    if (L.weapon === 'pet' && !child) drawPet(c, L, x - 13, feet, frame);
    c.restore();
  }

  function weapon(R, L, hy) {
    const W = L.weapon.split('+')[0], steel = '#dfe6f0', wood = '#7a5230';
    switch (W) {
      case 'sword': R(8, hy - 9, 1, 9, steel); R(7, hy, 3, 1, '#c8962e'); R(8, hy + 1, 1, 1, '#5a3a1e'); break;
      case 'spear': R(8, hy - 12, 1, 16, wood); R(8, hy - 15, 1, 3, steel); R(7, hy - 13, 3, 1, steel); break;
      case 'staff': R(8, hy - 10, 1, 13, wood); R(7, hy - 13, 3, 3, L.acc); break;
      case 'staffw': R(8, hy - 10, 1, 13, '#f0eee8'); R(7, hy - 12, 3, 2, '#ffd27a'); R(8, hy - 13, 1, 1, '#ffd27a'); break;
      case 'orb': R(9, hy - 6, 2, 2, L.acc); R(10, hy - 7, 1, 1, '#ffffff'); break;
      case 'bow': R(9, hy - 5, 1, 10, wood); R(8, hy - 6, 1, 1, wood); R(8, hy + 5, 1, 1, wood); R(8, hy - 5, 1, 10, '#e8e8e8'); break;
      case 'gun': R(7, hy - 1, 7, 2, '#3a3f4a'); R(9, hy + 1, 1, 2, '#3a3f4a'); R(13, hy - 1, 1, 1, L.acc); break;
      case 'dagger': R(8, hy - 3, 1, 3, steel); R(8, hy, 1, 1, '#5a3a1e'); break;
      case 'hammer': R(8, hy - 7, 1, 9, wood); R(7, hy - 9, 4, 3, '#8a8f9a'); break;
      case 'axe': R(8, hy - 8, 1, 10, wood); R(9, hy - 8, 2, 4, '#c0c6d0'); break;
      case 'book': R(8, hy - 1, 3, 3, '#8a3a2a'); R(9, hy - 1, 1, 3, '#e8dcc0'); break;
      case 'tablet': R(8, hy - 2, 3, 3, '#1a1a2a'); R(9, hy - 1, 1, 1, '#38e1ff'); break;
      case 'kit': R(8, hy, 3, 3, '#e8e8e8'); R(9, hy, 1, 3, '#d03030'); break;
      case 'gourd': R(8, hy, 2, 3, '#c8962e'); R(8, hy - 1, 1, 1, '#c8962e'); break;
      case 'bag': R(8, hy, 3, 3, '#8a6a3a'); break;
      case 'mic': R(8, hy - 2, 1, 3, '#222222'); R(8, hy - 3, 2, 2, '#bbbbbb'); break;
      case 'flag': R(8, hy - 14, 1, 16, wood); R(9, hy - 14, 5, 4, L.acc); break;
      case 'claw': R(8, hy, 2, 1, '#e8e0d0'); R(8, hy + 1, 1, 1, '#e8e0d0'); break;
    }
  }

  function drawPet(c, L, x, feet, frame) {
    const col = L.world === 'future' ? '#8aa0b8' : L.world === 'fwar' || L.world === 'fantasy' ? '#d8a040' : '#9a9aa8';
    const b = frame % 12 < 6 ? 0 : 1;
    rect(c, x, feet - 5 + b, 7, 4, col); rect(c, x + 5, feet - 7 + b, 3, 3, col); rect(c, x + 7, feet - 6 + b, 1, 1, '#1a1420');
    rect(c, x, feet - 1, 1, 1, col); rect(c, x + 5, feet - 1, 1, 1, col); rect(c, x - 1, feet - 6 + b, 1, 2, col);
  }

  // ---------- อนุภาค ----------
  const FX = {
    leaf: { n: 10, col: ['#7ac060', '#a8d070'], vy: [0.2, 0.5], vx: [-0.4, -0.1] },
    rain: { n: 40, col: ['#38e1ff', '#ff3fa4', '#8890c0'], vy: [2.5, 3.5], vx: [-0.3, -0.3], len: 3 },
    ash: { n: 26, col: ['#b8b098', '#8a8470'], vy: [0.15, 0.35], vx: [-0.3, 0.3] },
    ember: { n: 22, col: ['#ff9a3f', '#ff5a2a', '#ffd23f'], vy: [-0.5, -0.2], vx: [-0.2, 0.2] },
    spark: { n: 20, col: ['#c8a8ff', '#8a5aff', '#ffffff'], vy: [-0.2, 0.1], vx: [-0.1, 0.1], blink: true },
    petal: { n: 14, col: ['#f0a0b8', '#ffd0dc'], vy: [0.25, 0.5], vx: [-0.5, -0.2], sway: true },
    gold: { n: 28, col: ['#ffd27a', '#ffffff', '#ffe8a8'], vy: [-0.15, 0.05], vx: [-0.1, 0.1], blink: true },
    heart: { n: 8, col: ['#ff6a9a', '#ffb0c8'], vy: [-0.35, -0.2], vx: [-0.1, 0.1], heart: true },
    firefly: { n: 12, col: ['#d8ff8a', '#ffe88a'], vy: [-0.1, 0.1], vx: [-0.15, 0.15], blink: true },
  };
  function makeParts(kind, r) {
    const f = FX[kind];
    if (!f) return [];
    return Array.from({ length: f.n }, () => ({ x: r() * VW, y: r() * VH, vx: f.vx[0] + r() * (f.vx[1] - f.vx[0]), vy: f.vy[0] + r() * (f.vy[1] - f.vy[0]), col: pickR(r, f.col), ph: r() * 6, f }));
  }
  function stepParts(c, parts, frame) {
    for (const p of parts) {
      p.x += p.vx + (p.f.sway ? Math.sin(frame * 0.1 + p.ph) * 0.3 : 0);
      p.y += p.vy;
      if (p.y > VH) { p.y = -3; p.x = Math.random() * VW; }
      if (p.y < -4) { p.y = VH; p.x = Math.random() * VW; }
      if (p.x < -3) p.x = VW; if (p.x > VW + 3) p.x = 0;
      if (p.f.blink && Math.sin(frame * 0.2 + p.ph) < 0) continue;
      if (p.f.heart) { rect(c, p.x, p.y, 1, 1, p.col); rect(c, p.x + 2, p.y, 1, 1, p.col); rect(c, p.x, p.y + 1, 3, 1, p.col); rect(c, p.x + 1, p.y + 2, 1, 1, p.col); }
      else rect(c, p.x, p.y, 1, p.f.len || 1, p.col);
    }
  }

  // ---------- ประกอบฉาก ----------
  const baseCache = new Map();
  function buildBase(o) {
    const key = [o.world, o.kind, o.seed].join('|');
    if (baseCache.has(key)) return baseCache.get(key);
    const cv = document.createElement('canvas');
    cv.width = VW; cv.height = VH;
    const c = cv.getContext('2d');
    const P = PAL[o.world];
    const r = rng(o.seed);
    let sky = SKY_OVERRIDE[o.kind] || P.sky;
    if (o.kind === 'boss' && o.world === 'wuxia') sky = ['#0a0614', '#2a1a4a', '#5a4a7a'];
    gradient(c, 0, HORIZON + 4, sky);
    const night = o.kind === 'death' || o.kind === 'boss' || !P.day;
    if (night && o.world !== 'heaven') for (let i = 0; i < 40; i++) rect(c, r() * VW, r() * 55, 1, 1, r() < 0.2 ? '#ffffff' : '#9aa4c8');
    if (o.kind === 'death') for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x - 4) ** 2 + (y - 4) ** 2 < 17 && !((x - 6) ** 2 + (y - 3) ** 2 < 10)) rect(c, 30 + x, 12 + y, 1, 1, '#f0eed8');
    if (o.kind === 'boss') clouds(c, r, 8, '#1a0a14', 7);
    if (o.world === 'fantasy' && o.kind !== 'boss' && o.kind !== 'death') clouds(c, r, 14, '#d8e8ff', 3);
    backdrop(c, r, o.world, o.kind, P);
    if (o.world === 'heaven') gradient(c, HORIZON + 4, VH, ['#ffffff', '#f0e6ff']);
    else {
      gradient(c, HORIZON + 4, VH, o.kind === 'death' ? ['#1e2a2a', '#0e1414'] : P.ground);
      for (let i = 0; i < 40; i++) rect(c, r() * VW, HORIZON + 6 + r() * 22, 1, 1, mix(P.ground[0], '#000000', 0.25));
    }
    middle(c, r, o.world, o.kind, P);
    if (baseCache.size > 40) baseCache.clear();
    baseCache.set(key, cv);
    return cv;
  }

  function fxKind(o) {
    if (o.kind === 'love') return 'heart';
    if (o.kind === 'death') return 'firefly';
    if (o.kind === 'bless' || o.world === 'heaven') return 'gold';
    if (o.kind === 'boss') return 'ember';
    return PAL[o.world].fx;
  }

  function drawFrame(c, o, frame, parts) {
    c.drawImage(buildBase(o), 0, 0);
    stepParts(c, parts, frame);
    const k = o.kind;
    if (k === 'battle' && o.hero) {
      const lunge = frame % 24 < 4;
      drawEnemy(c, o.world, o.enemyT || 0, 138, FEET, frame, lunge && frame % 24 >= 2);
      drawPerson(c, o.hero, lunge ? 72 : 62, FEET, frame);
      if (lunge) for (let i = 0; i < 8; i++) rect(c, 96 + i * 2, 70 + i * 2, 2, 1, '#ffffff');
    } else if (k === 'boss') {
      if (o.world === 'wuxia') {
        if (frame % 30 < 3) { let x = 120 + Math.random() * 40; for (let y = 0; y < FEET - 10; y += 3) { x += (Math.random() - 0.5) * 6; rect(c, x, y, 2, 3, '#e8d8ff'); } c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 0, VW, VH); }
      } else {
        const pal = { a: '#140810', b: '#0a0408', e: '#ff3b3b', w: '#3a1a1a', m: '#2a1a24' };
        drawTpl(c, o.world === 'future' ? T.ROBOT : o.world === 'apoc' || o.world === 'hunter' ? T.GIANT : T.DRAGON, 150, FEET + 4, o.world === 'future' ? 6 : o.world === 'apoc' || o.world === 'hunter' ? 4 : 3, pal, false);
        if (frame % 40 < 2) { c.fillStyle = 'rgba(255,60,40,.15)'; c.fillRect(0, 0, VW, VH); }
      }
      if (o.hero) drawPerson(c, o.hero, 48, FEET, frame);
    } else if (k === 'love') {
      // คนรักหลายคนยืนสลับซ้าย-ขวารอบตัวเอก
      const ps = o.partners || (o.partner ? [o.partner] : []);
      [100, 68, 116, 52].slice(0, ps.length).forEach((x, i) => drawPerson(c, ps[i], x, FEET, frame + 5 + i * 3, x > 84));
      if (o.hero) drawPerson(c, o.hero, 84, FEET, frame);
    } else if (k === 'death') {
      const fl = frame % 6 < 3;
      rect(c, 104, FEET - 9, 2, 4, '#e8e0d0'); rect(c, 104, FEET - 11 - (fl ? 1 : 0), 2, 2, fl ? '#ffd27a' : '#ff9a3f');
      if (o.hero) { c.globalAlpha = 0.35; drawPerson(c, o.hero, 96, FEET - 34 - Math.round(Math.sin(frame * 0.1) * 2), frame); c.globalAlpha = 1; }
    } else if (k === 'bless') {
      drawPerson(c, o.goddess, 96, FEET - 10 + Math.round(Math.sin(frame * 0.08) * 2), frame);
      if (o.hero) drawPerson(c, o.hero, 60, FEET, frame);
    } else if (o.hero) {
      const ps = o.partners || (o.partner ? [o.partner] : []);
      [50, 86, 34, 102].slice(0, ps.length).forEach((x, i) => drawPerson(c, ps[i], x, FEET, frame + 7 + i * 3, x > 68));
      drawPerson(c, o.hero, 68, FEET, frame);
    }
  }

  // ---------- ลูปแอนิเมชัน ----------
  const mounts = new Map();
  let last = 0, frame = 0, running = false;
  function loop(ts) {
    if (ts - last > 95) {
      last = ts; frame++;
      for (const [cv, m] of mounts) {
        if (!cv.isConnected) { mounts.delete(cv); continue; }
        if (cv.offsetParent === null) continue;
        drawFrame(m.c, m.o, frame, m.parts);
      }
    }
    if (mounts.size) requestAnimationFrame(loop); else running = false;
  }

  function mount(cv, o) {
    cv.width = VW; cv.height = VH;
    const prev = mounts.get(cv);
    const fk = fxKind(o);
    const parts = prev && prev.fk === fk ? prev.parts : makeParts(fk, rng(o.seed + 7));
    const m = { c: cv.getContext('2d'), o, parts, fk };
    mounts.set(cv, m);
    drawFrame(m.c, o, frame, parts);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  // วาดภาพนิ่งขยายขนาด (ใช้ทำการ์ดแชร์)
  function snapshot(o, scale) {
    const small = document.createElement('canvas');
    small.width = VW; small.height = VH;
    const sc = small.getContext('2d');
    drawFrame(sc, o, 4, makeParts(fxKind(o), rng(o.seed + 7)));
    const big = document.createElement('canvas');
    big.width = VW * scale; big.height = VH * scale;
    const bc = big.getContext('2d');
    bc.imageSmoothingEnabled = false;
    bc.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }

  const goddess = () => ({ skin: '#f8e4d0', hair: '#f0d070', hairStyle: 2, female: true, robe: true, outfit: '#f4f0ff', outfit2: '#ffd27a', leg: '#f4f0ff', weapon: 'staffw', acc: '#ffd27a', stage: 'adult', wings: true, halo: true, aura: '#ffe8a8', world: 'heaven' });

  return { mount, snapshot, look, goddess, hash, VW, VH };
})();
