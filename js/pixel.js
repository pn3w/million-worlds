// ===== พิกเซลอาร์ต v2: ฉากและตัวละครวาดด้วยโค้ดทั้งหมด =====
// ความละเอียด 288×162 วาดลงบัฟเฟอร์พิกเซลโดยตรง แล้วลงเงา/เส้นขอบอัตโนมัติให้ดูเป็นงานพิกเซลอาร์ตแบบวาดมือ
const PX = (() => {
  const VW = 288, VH = 162, HORIZON = 118, FEET = 150;

  // ---------- สีและสุ่ม ----------
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
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lit = (c, t) => mix(c, '#ffffff', t);
  const dim = (c, t) => mix(c, '#000000', t);
  const pickR = (r, a) => a[Math.floor(r() * a.length)];
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const bay = (x, y) => (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

  const U32 = new Map();
  function u32(col) {
    let v = U32.get(col);
    if (v === undefined) { const [r, g, b] = rgb(col); v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; U32.set(col, v); }
    return v;
  }
  function u32mix(a, b, t) {
    const ch = (s) => [(a >> s) & 255, (b >> s) & 255];
    const [ar, br] = ch(0), [ag, bg] = ch(8), [ab, bb] = ch(16);
    return ((255 << 24) | (Math.round(ab + (bb - ab) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ar + (br - ar) * t)) >>> 0;
  }
  const BLACK = u32('#000000'), WHITE = u32('#ffffff');

  // บัฟเฟอร์พิกเซล (เร็วกว่าการ fillRect ทีละจุดมาก)
  function Raster(w, h) {
    const img = new ImageData(w, h), d = new Uint32Array(img.data.buffer);
    const R = {
      w, h, img, d,
      px(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = u32(col); },
      rect(x, y, rw, rh, col) {
        const v = u32(col); x = Math.round(x); y = Math.round(y);
        const x1 = Math.min(w, x + Math.round(rw)), y1 = Math.min(h, y + Math.round(rh));
        for (let j = Math.max(0, y); j < y1; j++) for (let i = Math.max(0, x); i < x1; i++) d[j * w + i] = v;
      },
      blend(x, y, col, a) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = y * w + x;
        d[i] = u32mix(d[i], u32(col), a);
      },
      filled(x, y) { return x >= 0 && y >= 0 && x < w && y < h && (d[y * w + x] >>> 24) !== 0; },
    };
    return R;
  }
  function toCanvas(R) {
    const cv = document.createElement('canvas');
    cv.width = R.w; cv.height = R.h;
    cv.getContext('2d').putImageData(R.img, 0, 0);
    return cv;
  }

  // ---------- เครื่องมือวาดฉาก ----------
  function gradient(R, y0, y1, cols) {
    const n = cols.length - 1, bands = 10;
    for (let y = Math.max(0, y0); y < Math.min(R.h, y1); y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1) * n;
      const i = Math.min(n - 1, Math.floor(t)), f = t - i;
      const q = f * bands, b = Math.floor(q), fr = q - b;
      const lo = u32(mix(cols[i], cols[i + 1], b / bands)), hi = u32(mix(cols[i], cols[i + 1], Math.min(1, (b + 1) / bands)));
      for (let x = 0; x < R.w; x++) R.d[y * R.w + x] = fr > bay(x, y) ? hi : lo;
    }
  }

  // ก้อนกลมลงแสงสามระดับ (แสงมาจากซ้ายบน) — ใช้ทำเมฆ พุ่มไม้ ควัน
  function puff(R, cx, cy, r, tones, lx = -0.7, ly = -0.7) {
    const v = tones.map(u32);
    const rr = r * r + r * 0.3;
    for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) {
      if (x * x + y * y > rr) continue;
      const X = Math.round(cx + x), Y = Math.round(cy + y);
      if (X < 0 || Y < 0 || X >= R.w || Y >= R.h) continue;
      const l = (x * lx + y * ly) / r + (bay(X, Y) - 0.5) * 0.4;
      R.d[Y * R.w + X] = l > 0.4 ? v[0] : l < -0.28 ? v[2] : v[1];
    }
  }

  function cloud(R, rnd, x, y, w, tones) {
    const n = Math.max(3, Math.round(w / 10));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), s = Math.sin(t * Math.PI);
      puff(R, x + t * w, y - s * w * 0.09, 4 + s * w * 0.15 + rnd() * 3, tones);
    }
    for (let i = 0; i <= n; i++) puff(R, x - 3 + i * (w + 6) / n, y + 4 + rnd() * 2, 3 + rnd() * 3, [tones[1], tones[1], tones[2]]);
  }

  function disc(R, cx, cy, r, col) { for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y)); R.rect(cx - hw, cy + y, hw * 2 + 1, 1, col); } }

  function glow(R, cx, cy, r, col, a = 0.5) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d < 1) R.blend(cx + x, cy + y, col, a * (1 - d) * (1 - d));
    }
  }

  // แนวภูเขา/เนินแบบมีด้านรับแสง
  function ridge(R, rnd, base, amp, step, col, opt = {}) {
    const pts = [];
    for (let x = -step; x <= R.w + step * 2; x += step) pts.push(base - rnd() * amp);
    const hs = [];
    for (let x = 0; x < R.w; x++) {
      const k = (x + step) / step, i = Math.floor(k), f = k - i;
      const ff = opt.sharp ? f : (1 - Math.cos(f * Math.PI)) / 2;
      hs.push(pts[i] + (pts[i + 1] - pts[i]) * ff + (opt.rough ? (rnd() - 0.5) * opt.rough : 0));
    }
    const light = opt.light || lit(col, 0.18);
    for (let x = 0; x < R.w; x++) {
      const y = Math.round(hs[x]);
      const facing = x > 0 && hs[x] < hs[x - 1] - 0.15;
      R.rect(x, y, 1, R.h - y, col);
      if (facing) for (let j = 0; j < (opt.faceDepth || 14); j++) if (j < 6 || bay(x, y + j) > j / (opt.faceDepth || 14)) R.px(x, y + j, light);
      if (opt.snow && y < base - amp * 0.62) R.rect(x, y, 1, 2 + (facing ? 2 : 0), opt.snow);
    }
    return hs;
  }

  function skyline(R, rnd, base, col, o) {
    let x = -Math.floor(rnd() * 10);
    const out = [];
    while (x < R.w) {
      const w = o.minW + Math.floor(rnd() * (o.maxW - o.minW)), h = o.minH + Math.floor(rnd() * (o.maxH - o.minH));
      const top = base - h;
      if (o.broken) {
        for (let xx = 0; xx < w; xx++) {
          const cut = rnd() < 0.18 ? Math.floor(rnd() * h * 0.35) : 0;
          R.rect(x + xx, top + cut + (xx % 5 === 0 && rnd() < 0.5 ? 2 : 0), 1, h + 40, col);
        }
        if (o.holes) for (let k = 0; k < w * h / 50; k++) R.rect(x + rnd() * (w - 2), top + 4 + rnd() * (h - 6), 2, 2, o.holes);
      } else {
        R.rect(x, top, w, h + 40, col);
        R.rect(x, top, 1, h, lit(col, 0.08));
        if (rnd() < 0.35) { R.rect(x + Math.floor(w / 2), top - 6, 1, 6, col); if (o.beacon) R.px(x + Math.floor(w / 2), top - 7, o.beacon); }
        if (rnd() < 0.25) R.rect(x + 2, top - 3, w - 4, 3, col);
      }
      if (o.win) for (let wy = top + 3; wy < base - 2; wy += 3) for (let wx = x + 2; wx < x + w - 2; wx += 2) if (rnd() < o.winP) R.px(wx, wy, pickR(rnd, o.win));
      out.push([x, top, w]);
      x += w + Math.floor(rnd() * (o.gap || 3));
    }
    return out;
  }

  function tri(R, cx, top, h, col, slope = 1) {
    for (let i = 0; i < h; i++) { const hw = Math.floor(i * slope); R.rect(cx - hw, top + i, hw * 2 + 1, 1, col); }
  }

  function line(R, x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let i = 0; i <= n; i++) R.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col);
  }

  // สายไฟห้อยโค้ง
  function wire(R, x0, y0, x1, y1, sag, col) {
    for (let i = 0; i <= 80; i++) { const t = i / 80; R.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag, col); }
  }

  // ต้นไม้ใบเป็นพุ่มสามระดับแสง (ใช้กับต้นไม้ดอก/ต้นสนในโลกต่าง ๆ)
  function canopy(R, rnd, cx, cy, w, h, tones, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      puff(R, cx + Math.cos(a) * d * w * 0.5, cy + Math.sin(a) * d * h * 0.5, 3 + rnd() * 5, tones);
    }
    for (let i = 0; i < n; i++) R.px(cx + (rnd() - 0.5) * w, cy + (rnd() - 0.5) * h, lit(tones[0], 0.35));
  }

  function branch(R, rnd, x, y, ang, len, thick, col, depth, tips) {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    for (let t = 0; t < thick; t++) line(R, x + t * 0.5, y + t * 0.5, x1 + t * 0.3, y1 + t * 0.3, col);
    if (depth <= 0) { if (tips) tips.push([x1, y1]); return; }
    branch(R, rnd, x1, y1, ang - 0.4 - rnd() * 0.3, len * 0.72, Math.max(1, thick - 1), col, depth - 1, tips);
    branch(R, rnd, x1, y1, ang + 0.35 + rnd() * 0.3, len * 0.68, Math.max(1, thick - 1), col, depth - 1, tips);
  }

  function grassTufts(R, rnd, x0, x1, base, cols, n, hmax) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), h = 3 + rnd() * hmax, lean = (rnd() - 0.5) * 3;
      const col = pickR(rnd, cols);
      for (let j = 0; j < h; j++) R.px(x + lean * j / h, base - j, col);
    }
  }

  // ---------- จานสีของแต่ละโลก ----------
  const PAL = {
    fantasy: { sky: ['#6fa6e2', '#a7cfee', '#dcedf0', '#f8e2b8'], cloud: ['#fffaf2', '#f2d6e4', '#c6a6d2'], sun: '#fff3c4', far: '#9ea7d6', mid: '#7f8fc4', ground: ['#86c064', '#56924a', '#356a38'], acc: '#ffd27a', leaf: ['#fbd2e4', '#e2a2cc', '#a070b0'], fx: 'leaf', enemy: '#5aa04a', day: true },
    future: { sky: ['#0e031c', '#260a46', '#561a72', '#b03e86'], cloud: ['#6a2a84', '#44185e', '#2a1040'], sun: '#ff7ac8', far: '#2c1854', mid: '#1c0f3a', ground: ['#2a2440', '#1a162c', '#100e1e'], acc: '#38e1ff', neon: ['#38e1ff', '#ff3fa4', '#c6ff3f', '#ffd23f'], fx: 'rain', enemy: '#8aa0b8' },
    apoc: { sky: ['#3a3420', '#6e6236', '#a8975a', '#d8c486'], cloud: ['#cdb98c', '#9e8a62', '#6c5c42'], sun: '#fff0c0', far: '#80744f', mid: '#544a34', ground: ['#86744c', '#5e5034', '#3c3222'], acc: '#9be15d', fx: 'ash', enemy: '#6f8a4a', day: true },
    war: { sky: ['#2a1a32', '#7c3a3e', '#d4723c', '#f6b664'], cloud: ['#fbcc94', '#da885c', '#8c4a40'], sun: '#ffe6a6', far: '#8c4c4a', mid: '#5c3032', ground: ['#86743e', '#5e4e2c', '#3c301c'], acc: '#e0a060', fx: 'ember', enemy: '#4a4a58', day: true },
    fwar: { sky: ['#14060c', '#4a0e18', '#9c2622', '#e4642c'], cloud: ['#8e3e2c', '#5c201e', '#2e0e10'], sun: '#ffb464', far: '#5c1c24', mid: '#340d14', ground: ['#5e4432', '#402c20', '#261a12'], acc: '#ff7a59', fx: 'ember', enemy: '#5a3a6a' },
    hunter: { sky: ['#0c0a26', '#261a5c', '#5c3e9c', '#c674aa'], cloud: ['#7e5cb4', '#4c3684', '#2a1c52'], sun: '#ffd4ea', far: '#2c2462', mid: '#1c1842', ground: ['#383850', '#26263c', '#18182c'], acc: '#a07bff', neon: ['#ffd23f', '#ffffff', '#ff8a3f', '#7ad7ff'], fx: 'spark', enemy: '#7a4ad0' },
    wuxia: { sky: ['#f2e8cc', '#f6eedc', '#ece0c4', '#dccca8'], cloud: ['#fcf8f0', '#e8dece', '#cabeaa'], sun: '#d8432f', far: '#aeb2a6', mid: '#6c746c', ground: ['#8e9e6c', '#64744e', '#404c36'], acc: '#c0392b', leaf: ['#ffd8e0', '#f2a4bc', '#c46c8c'], fx: 'petal', enemy: '#3a3a3a', day: true },
    heaven: { sky: ['#fff6dc', '#ffeabc', '#f6d6f2', '#dac6ff'], cloud: ['#ffffff', '#f4ecff', '#dacaf2'], sun: '#fffbe8', far: '#ffffff', mid: '#ffffff', ground: ['#ffffff', '#f4ecff', '#e4d8f8'], acc: '#ffcf6b', fx: 'gold', enemy: '#ffffff', day: true },
  };
  // บรรยากาศตามสถานการณ์ (ค่ำคืน/ภัยพิบัติ/ความรัก)
  const MOOD = {
    death: { sky: ['#04050e', '#0c1430', '#1a2650', '#2c3c6c'], cloud: ['#3c4a72', '#283250', '#161c34'], tint: ['#0a1030', 0.55], night: true },
    boss: { sky: ['#080004', '#2a0610', '#6c1018', '#b42c1a'], cloud: ['#5c1c1c', '#3a100e', '#1a0606'], tint: ['#1a0408', 0.5], night: true },
    love: { sky: ['#3c2052', '#a24c82', '#f28c8c', '#ffcaa2'], cloud: ['#ffdad2', '#f2a2b2', '#aa628c'], tint: ['#6a2a50', 0.18] },
  };

  function env(o) {
    const P = PAL[o.world];
    const M = MOOD[o.kind] || null;
    let sky = M ? M.sky : P.sky, cl = M ? M.cloud : P.cloud;
    if (o.kind === 'boss' && o.world === 'wuxia') { sky = ['#0a0614', '#241840', '#4c3c70', '#7a6a90']; cl = ['#5a5078', '#3a3256', '#201a36']; }
    const tint = M ? (c => mix(c, M.tint[0], M.tint[1])) : (c => c);
    return { P, sky, cl, T: tint, night: M ? !!M.night : !P.day, kind: o.kind, world: o.world, r: rng(o.seed) };
  }

  // ---------- ฉากหลังของแต่ละโลก ----------
  function castle(R, x, base, E) {
    const wall = E.T('#eef0f6'), shade = E.T('#b8bed4'), roof = E.T('#4a6ac8'), roofL = E.T('#6e8ee0'), win = E.night ? '#ffd27a' : E.T('#36406a');
    R.rect(x, base - 26, 46, 26, wall); R.rect(x + 30, base - 26, 16, 26, shade);
    for (let i = 0; i < 46; i += 4) R.rect(x + i, base - 29, 2, 3, i > 28 ? shade : wall);
    [[x - 8, 44, 10], [x + 40, 38, 9], [x + 16, 58, 12], [x + 6, 40, 7]].forEach(([tx, th, tw]) => {
      R.rect(tx, base - th, tw, th, wall); R.rect(tx + Math.ceil(tw * 0.6), base - th, Math.floor(tw * 0.4), th, shade);
      const rh = Math.round(tw * 1.5);
      for (let i = 0; i < rh; i++) { const hw = Math.floor(i * (tw / 2 + 1) / rh); R.rect(tx + tw / 2 - hw, base - th - rh + i, hw, 1, roofL); R.rect(tx + tw / 2, base - th - rh + i, hw + 1, 1, roof); }
      for (let wy = base - th + 6; wy < base - 8; wy += 9) R.rect(tx + Math.floor(tw / 2) - 1, wy, 2, 3, win);
    });
    R.rect(x + 20, base - 76, 1, 8, E.T('#5a4a3a')); R.rect(x + 21, base - 76, 6, 3, E.T(E.P.acc));
    R.rect(x + 18, base - 11, 8, 11, E.T('#3a2e2a')); R.rect(x + 19, base - 13, 6, 2, E.T('#3a2e2a'));
  }

  function pagoda(R, x, base, E) {
    const wall = E.T('#8a2e24'), roof = E.T('#2e2a2a'), roofL = E.T('#4a4444');
    for (let i = 0; i < 4; i++) {
      const w = 22 - i * 5, y = base - 10 - i * 12;
      R.rect(x - w / 2, y, w, 10, wall); R.rect(x - w / 2, y, 2, 10, E.T('#a8483a'));
      for (let k = 2; k < w - 2; k += 3) R.px(x - w / 2 + k, y + 4, E.T('#ffd27a'));
      R.rect(x - w / 2 - 6, y - 3, w + 12, 3, roof); R.rect(x - w / 2 - 6, y - 3, w + 12, 1, roofL);
      R.rect(x - w / 2 - 8, y - 5, 2, 2, roof); R.rect(x + w / 2 + 6, y - 5, 2, 2, roof);
    }
    R.rect(x, base - 64, 1, 10, roof); R.px(x, base - 65, E.T('#ffd27a'));
  }

  function house(R, x, base, w, h, E, style) {
    const P = E.P, T = E.T, warm = E.night || E.world === 'future' || E.world === 'hunter' ? '#ffd27a' : T('#4a5070');
    if (style === 'timber') {
      const wall = T('#f2e6cc'), beam = T('#6a4028'), roof = T('#c0503c'), roofD = T('#8a3428');
      R.rect(x, base - h, w, h, wall); R.rect(x + w - 4, base - h, 4, h, T('#d6c8ac'));
      R.rect(x, base - h, w, 2, beam); R.rect(x, base - Math.floor(h / 2), w, 1, beam);
      for (let i = 0; i <= w; i += 7) R.rect(x + i, base - h, 2, h, beam);
      const rh = Math.ceil(w / 2) + 2;
      for (let i = 0; i < rh; i++) { R.rect(x + w / 2 - i - 1, base - h - rh + i, i + 1, 1, roof); R.rect(x + w / 2, base - h - rh + i, i + 2, 1, roofD); }
      for (let i = 2; i < rh; i += 3) R.rect(x + w / 2 - i, base - h - rh + i, i * 2, 1, T('#a8402e'));
      R.rect(x + w - 8, base - h - rh + 2, 4, 8, T('#7a6a62'));
      R.rect(x + 4, base - 9, 5, 9, beam);
      for (let wx = x + 12; wx < x + w - 5; wx += 9) { R.rect(wx, base - h + 5, 4, 4, warm); R.rect(wx, base - h + 7, 4, 1, beam); }
    } else if (style === 'neon') {
      const wall = T('#2a2848'), trim = T('#3c3a64');
      R.rect(x, base - h, w, h, wall); R.rect(x, base - h, 2, h, trim);
      for (let wy = base - h + 3; wy < base - 8; wy += 5) for (let wx = x + 4; wx < x + w - 3; wx += 5) R.rect(wx, wy, 3, 2, pickR(E.r, ['#ffd27a', '#38e1ff', '#2a2848', '#ff7ac8']));
      const nc = pickR(E.r, P.neon || ['#ff3fa4']);
      R.rect(x + 3, base - h - 6, w - 6, 5, T('#14122a')); R.rect(x + 4, base - h - 5, w - 8, 3, nc); glow(R, x + w / 2, base - h - 4, w / 2, nc, 0.35);
      R.rect(x + w / 2 - 3, base - 9, 6, 9, T('#100e20')); R.rect(x + w / 2 - 3, base - 10, 6, 1, nc);
    } else if (style === 'shack') {
      const wall = T('#7e6a4a'), metal = T('#8e8a80'), rust = T('#9a5a32');
      R.rect(x, base - h, w, h, wall);
      for (let i = 0; i < w; i += 3) R.rect(x + i, base - h, 1, h, T('#6a583c'));
      R.rect(x + 3, base - h + 3, 6, 5, metal); R.rect(x + w - 10, base - h + 6, 7, 4, rust);
      for (let i = -2; i < w + 3; i++) R.rect(x + i, base - h - 3 + Math.floor(i / 8), 1, 3, i % 4 === 0 ? rust : metal);
      R.rect(x + w / 2 - 3, base - 9, 6, 9, T('#2a2218')); R.rect(x + w - 8, base - h + 12, 4, 3, E.night ? '#ffd27a' : T('#3a3426'));
    } else if (style === 'thatch') {
      const wall = T('#d8c49a'), roof = T('#b48a46'), roofD = T('#8a6630');
      R.rect(x, base - h, w, h, wall); R.rect(x + w - 4, base - h, 4, h, T('#bca880'));
      const rh = Math.ceil(w / 2);
      for (let i = 0; i < rh; i++) { R.rect(x + w / 2 - i - 3, base - h - rh + i + 2, i + 3, 1, roof); R.rect(x + w / 2, base - h - rh + i + 2, i + 3, 1, roofD); }
      for (let i = 0; i < w + 6; i += 2) R.px(x - 3 + i, base - h + 2, roofD);
      R.rect(x + 5, base - 9, 5, 9, T('#5a3a22')); R.rect(x + w - 11, base - h + 5, 4, 4, warm);
    } else if (style === 'stone') {
      const wall = T('#8e8a86'), roof = T('#4a2a2a');
      R.rect(x, base - h, w, h, wall);
      for (let yy = base - h + 2; yy < base; yy += 4) for (let xx = x + ((yy / 4) % 2) * 3; xx < x + w; xx += 6) R.rect(xx, yy, 5, 3, T('#9e9a96'));
      const rh = Math.ceil(w / 2);
      for (let i = 0; i < rh; i++) R.rect(x + w / 2 - i - 1, base - h - rh + i, i * 2 + 2, 1, i % 3 === 0 ? T('#3a2020') : roof);
      R.rect(x + 4, base - 10, 6, 10, T('#3a2a22')); R.rect(x + w - 10, base - h + 5, 4, 5, '#ffb464');
    } else if (style === 'shophouse') {
      const wall = T(pickR(E.r, ['#e8d8b0', '#c8d8e0', '#e8c0a8'])), dark = T('#2a2a3a');
      R.rect(x, base - h, w, h, wall); R.rect(x, base - h, w, 2, T('#8a8a96'));
      for (let wx = x + 3; wx < x + w - 3; wx += 6) { R.rect(wx, base - h + 4, 4, 5, dark); R.rect(wx, base - h + 4, 4, 1, T('#6a6a7a')); }
      R.rect(x, base - 12, w, 2, T('#c0392b'));
      R.rect(x + 2, base - 10, w - 4, 10, T('#4a4a5a'));
      for (let i = x + 3; i < x + w - 3; i += 2) R.px(i, base - 9 + (i % 4 === 0 ? 1 : 0), T('#7a7a8a'));
      const sc = pickR(E.r, P.neon || ['#ffd23f']); R.rect(x + w / 2 - 6, base - h - 5, 12, 4, sc); glow(R, x + w / 2, base - h - 3, 10, sc, 0.3);
    } else if (style === 'courtyard') {
      const wall = T('#f2ead8'), roof = T('#2e2a2a'), roofL = T('#4a4444'), pillar = T('#a8382c');
      R.rect(x, base - h, w, h, wall);
      for (let i = 0; i <= w; i += 8) R.rect(x + i, base - h, 2, h, pillar);
      R.rect(x - 6, base - h - 4, w + 12, 4, roof); R.rect(x - 6, base - h - 4, w + 12, 1, roofL);
      R.rect(x - 8, base - h - 6, 3, 2, roof); R.rect(x + w + 5, base - h - 6, 3, 2, roof);
      R.rect(x + 2, base - h - 9, w - 4, 5, roof); R.rect(x + 2, base - h - 9, w - 4, 1, roofL);
      R.rect(x + w / 2 - 4, base - 10, 8, 10, T('#5a2a22'));
      [x + 6, x + w - 9].forEach(lx => { R.rect(lx, base - h + 4, 3, 4, '#e8543a'); glow(R, lx + 1, base - h + 6, 5, '#ff8a3f', 0.3); });
    }
  }

  const HOUSE_STYLE = { fantasy: 'timber', future: 'neon', apoc: 'shack', war: 'thatch', fwar: 'stone', hunter: 'shophouse', wuxia: 'courtyard', heaven: 'timber' };

  function sky(R, E) {
    gradient(R, 0, HORIZON + 12, E.sky);
    const r = E.r;
    if (E.night || E.world === 'future' || E.world === 'hunter' || E.world === 'fwar') {
      for (let i = 0; i < 70; i++) { const x = r() * VW, y = r() * 80; R.blend(x, y, '#ffffff', 0.25 + r() * 0.6); }
    }
    // ดวงอาทิตย์/ดวงจันทร์
    if (E.kind === 'death') { glow(R, 58, 30, 22, '#c8d8ff', 0.35); disc(R, 58, 30, 9, '#f2f0dc'); disc(R, 62, 27, 7, mix(E.sky[1], '#000000', 0.1)); }
    else if (E.kind === 'boss') { glow(R, 210, 60, 40, '#ff3a1a', 0.35); }
    else if (E.world === 'wuxia') { glow(R, 222, 34, 26, '#ff9a6a', 0.25); disc(R, 222, 34, 12, E.P.sun); }
    else if (E.world === 'future') { glow(R, 224, 38, 34, '#ff6ac0', 0.4); disc(R, 224, 38, 18, '#ff8ad0'); for (let x = -30; x <= 30; x++) R.px(224 + x, 38 + x * 0.12, '#ffd0ec'); }
    else if (E.world === 'apoc') { glow(R, 200, 46, 40, '#fff0c0', 0.5); glow(R, 200, 46, 12, '#ffffff', 0.6); }
    else if (E.world === 'hunter' || E.world === 'fwar') { /* ใช้ประตูมิติ/ภูเขาไฟเป็นแหล่งแสงแทน */ }
    else { glow(R, 236, 26, 40, E.P.sun, 0.55); disc(R, 236, 26, 10, '#fffbe8'); }
    // เมฆ
    const n = E.world === 'wuxia' ? 3 : 5;
    for (let i = 0; i < n; i++) cloud(R, r, -20 + r() * (VW + 20), 12 + r() * 46, 30 + r() * 46, E.cl);
  }

  function backdrop(R, E) {
    const r = E.r, T = E.T, B = HORIZON, P = E.P, k = E.kind;
    switch (E.world) {
      case 'fantasy': {
        ridge(R, r, B - 22, 34, 30, T(P.far), { snow: T('#f4f6ff'), light: T(lit(P.far, 0.25)) });
        ridge(R, r, B - 6, 14, 22, T(mix(P.ground[1], P.far, 0.55)), { light: T(mix(P.ground[0], P.far, 0.4)) });
        if (k !== 'boss' && k !== 'battle') castle(R, 186, B - 8, E);
        for (let i = 0; i < 14; i++) { const x = r() * VW; puff(R, x, B - 2 - r() * 4, 3 + r() * 3, [T('#4e8a4a'), T('#356a3a'), T('#24502c')]); }
        break;
      }
      case 'future': {
        skyline(R, r, B - 4, T(P.far), { minW: 10, maxW: 22, minH: 34, maxH: 92, win: P.neon, winP: 0.18, beacon: '#ff3a3a' });
        for (let i = 0; i < 9; i++) { const x = r() * VW, y = 20 + r() * 50; R.rect(x, y, 4, 1, pickR(r, P.neon)); R.blend(x - 1, y, pickR(r, P.neon), 0.4); }
        const bs = skyline(R, r, B + 6, T(P.mid), { minW: 14, maxW: 30, minH: 16, maxH: 56, win: ['#ffd27a', '#38e1ff', '#ff7ac8'], winP: 0.22 });
        bs.forEach(([x, top, w], i) => { if (i % 2 === 0 && w > 14) { const c = pickR(r, P.neon); R.rect(x + 3, top + 5, w - 6, 8, T('#0a0818')); R.rect(x + 4, top + 6, w - 8, 6, c); for (let j = x + 5; j < x + w - 5; j += 3) R.px(j, top + 8 + (j % 2), '#ffffff'); glow(R, x + w / 2, top + 9, w * 0.8, c, 0.22); } });
        break;
      }
      case 'apoc': {
        skyline(R, r, B - 2, T(P.far), { minW: 12, maxW: 26, minH: 30, maxH: 80, broken: true, holes: T(mix(P.far, P.sky[2], 0.6)) });
        // สะพานทางด่วนที่หักกลาง
        R.rect(0, B - 30, 120, 6, T('#6a6048')); R.rect(0, B - 30, 120, 1, T('#8a7e60'));
        for (let i = 120; i < 132; i++) R.rect(i, B - 30 + (i - 120) * 0.8, 1, 6, T('#6a6048'));
        [20, 70].forEach(px => R.rect(px, B - 24, 6, 30, T('#5a5240')));
        skyline(R, r, B + 6, T(P.mid), { minW: 8, maxW: 18, minH: 10, maxH: 34, broken: true, win: ['#1a160e'], winP: 0.3 });
        break;
      }
      case 'war': {
        ridge(R, r, B - 26, 36, 34, T(P.far), { light: T(lit(P.far, 0.2)) });
        if (k !== 'boss') { const fx = 210; R.rect(fx, B - 36, 40, 16, T(dim(P.far, 0.3))); [fx - 4, fx + 18, fx + 38].forEach(t => { R.rect(t, B - 46, 7, 26, T(dim(P.far, 0.3))); for (let i = 0; i < 7; i += 2) R.rect(t + i, B - 48, 1, 2, T(dim(P.far, 0.3))); }); }
        ridge(R, r, B - 4, 14, 20, T(P.mid), { light: T(lit(P.mid, 0.15)) });
        for (let i = 0; i < 3; i++) { const sx = 30 + r() * 220; for (let j = 0; j < 9; j++) puff(R, sx + j * 1.5 + Math.sin(j) * 2, B - 10 - j * 6, 3 + j * 0.6, [T('#8a7a74'), T('#6a5a58'), T('#4a3e40')]); }
        if (k !== 'boss') for (let i = 0; i < 6; i++) {
          const x = 14 + i * 46 + r() * 12;
          for (let j = 0; j < 12; j++) { R.rect(x - j, B - 4 + j - 12, j + 1, 1, T('#e4d4ac')); R.rect(x, B - 4 + j - 12, j + 1, 1, T('#c0b088')); }
          R.rect(x, B - 26, 1, 10, T('#3a2a1a')); R.rect(x + 1, B - 26, 7, 4, T(P.acc)); R.rect(x + 1, B - 23, 6, 1, T(dim(P.acc, 0.3)));
        }
        break;
      }
      case 'fwar': {
        // ภูเขาไฟพร้อมลาวา
        for (let i = 0; i < 46; i++) R.rect(70 - i * 1.6, B - 72 + i * 1.5, i * 3.2 + 10, 2, T(i < 4 ? '#2a0c10' : P.far));
        glow(R, 78, B - 74, 30, '#ff6a2a', 0.55);
        for (let i = 0; i < 4; i++) { let x = 74 + r() * 8; for (let y = B - 70; y < B - 20; y += 2) { x += (r() - 0.5) * 3; R.rect(x, y, 2, 2, '#ff8a3a'); } }
        ridge(R, r, B - 10, 26, 12, T(P.mid), { sharp: true, light: T(lit(P.mid, 0.12)) });
        if (k !== 'boss') {
          castle(R, 196, B - 6, { ...E, T: c => mix(c, '#2a0a10', 0.7) });
          [[200, B - 44], [236, B - 52]].forEach(([fx, fy]) => { glow(R, fx, fy, 14, '#ff7a2a', 0.5); for (let j = 0; j < 6; j++) puff(R, fx + j * 2, fy - 4 - j * 6, 3 + j, ['#4a2a2a', '#3a1e20', '#2a1416']); });
          bakeSprite(R, T_ENEMY.DRAGON, 1, { a: '#1a0408', b: '#1a0408', e: '#ff7a59', w: '#1a0408' }, 150, 44);
          bakeSprite(R, T_ENEMY.DRAGON, 1, { a: '#2a0a10', b: '#2a0a10', e: '#ff7a59', w: '#2a0a10' }, 40, 30);
        }
        break;
      }
      case 'hunter': {
        if (k !== 'home') {
          // ประตูมิติหมุนวนกลางฟ้า
          const cx = 196, cy = 32;
          glow(R, cx, cy, 44, '#b07bff', 0.55);
          for (let ring = 0; ring < 5; ring++) {
            const rr = 26 - ring * 5, cols = ['#2a1060', '#5a2ab0', '#9a6aff', '#d8b8ff', '#ffffff'];
            for (let a = 0; a < Math.PI * 2; a += 0.02) { const wob = Math.sin(a * 5 + ring) * 1.5; R.px(cx + Math.cos(a) * (rr + wob), cy + Math.sin(a) * (rr * 0.82 + wob), cols[ring]); }
          }
          disc(R, cx, cy, 6, '#12062a');
          for (let i = 0; i < 4; i++) { let x = cx + (r() - 0.5) * 40, y = cy + 20; for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 6; y += 3; R.px(x, y, '#e0d0ff'); } }
        }
        skyline(R, r, B - 2, T(P.far), { minW: 8, maxW: 18, minH: 34, maxH: 64, win: P.neon, winP: 0.14, beacon: '#ff3a3a' });
        // ยอดปรางค์วัดตัดกับตึกสูง
        { const px = 46; for (let i = 0; i < 30; i++) R.rect(px - (30 - i) * 0.35, B - 8 - i * 1.6, (30 - i) * 0.7 + 2, 2, T('#3a2e5a')); R.rect(px, B - 62, 1, 8, T('#ffd27a')); }
        skyline(R, r, B + 6, T(P.mid), { minW: 12, maxW: 24, minH: 14, maxH: 44, win: ['#ffd27a', '#ffffff', '#7ad7ff'], winP: 0.24 });
        break;
      }
      case 'wuxia': {
        // ภูเขาหินปูนแบบภาพหมึกจีน ซ้อนสี่ชั้นมีหมอกคั่น
        const layers = [['#c8c8bc', B - 46, 30], ['#a0a69a', B - 30, 34], ['#7a8278', B - 16, 30], ['#525a52', B - 4, 22]];
        layers.forEach(([col, base, amp], li) => {
          let x = -10;
          while (x < VW + 10) {
            // ยอดเขาหินปูนทรงสูงชะลูด ด้านซ้ายรับแสง
            const w = 16 + r() * 18, h = amp * (0.8 + r() * 0.7);
            for (let yy = 0; yy < h + 40; yy++) {
              const t = Math.min(1, yy / h), hw = w / 2 * Math.pow(t, 0.45);
              R.rect(x - hw, base - h + yy, hw * 2, 1, T(col));
              if (yy < h) R.rect(x - hw, base - h + yy, Math.max(1, hw * 0.55), 1, T(lit(col, 0.2)));
            }
            if (li >= 2 && r() < 0.6) { const tx = x - w * 0.15, ty = base - h + 6 + r() * h * 0.3; puff(R, tx, ty, 2 + r() * 2, [T('#6e8a62'), T('#4e6a50'), T('#384e3e')]); }
            x += w * (0.75 + r() * 0.6);
          }
          for (let y = base - 8; y < base + 4; y++) for (let xx = 0; xx < VW; xx++) R.blend(xx, y, '#f6f0e2', 0.18 * (1 - Math.abs(y - base + 2) / 8));
          if (li === 2 && k !== 'boss') pagoda(R, 64, base - 18, E);
        });
        for (let i = 0; i < 5; i++) { const x = 120 + r() * 80, y = 30 + r() * 30; R.px(x, y, '#3a3a3a'); R.px(x - 1, y - 1, '#3a3a3a'); R.px(x + 1, y - 1, '#3a3a3a'); }
        break;
      }
      case 'heaven': {
        for (let i = 0; i < 5; i++) { const x = 30 + i * 60; R.rect(x, B - 50, 6, 60, '#fff4dc'); R.rect(x + 4, B - 50, 2, 60, '#eadcf4'); R.rect(x - 2, B - 52, 10, 3, '#ffe6a8'); }
        for (let i = 0; i < 8; i++) cloud(R, E.r, -20 + i * 44, B - 4, 44, E.cl);
        break;
      }
    }
  }

  function ground(R, E) {
    const r = E.r, T = E.T, P = E.P, B = HORIZON;
    if (E.world === 'heaven') { for (let i = 0; i < 9; i++) cloud(R, r, -20 + i * 40, B + 18 + r() * 14, 46, E.cl); return; }
    gradient(R, B + 6, VH, (E.kind === 'death' ? ['#26343a', '#16201e', '#0c1212'] : P.ground).map(T));
    // พื้นผิว
    for (let i = 0; i < 260; i++) { const y = B + 8 + Math.pow(r(), 0.7) * (VH - B - 8); R.px(r() * VW, y, T(dim(P.ground[1], 0.2 + r() * 0.2))); }
    if (E.world === 'fantasy' || E.world === 'war' || E.world === 'wuxia') {
      // ทางเดินดิน
      for (let y = B + 8; y < VH; y++) { const t = (y - B - 8) / (VH - B - 8), cx = 150 + Math.sin(t * 3) * 14 - t * 30, hw = 3 + t * 22; R.rect(cx - hw, y, hw * 2, 1, T(mix('#c8a876', P.ground[1], 0.25 + bay(cx | 0, y) * 0.15))); }
    }
    if (E.world === 'future' || E.world === 'hunter') {
      // ถนนเปียกสะท้อนแสงไฟ
      for (let i = 0; i < 26; i++) { const x = r() * VW, c = pickR(r, P.neon); for (let y = B + 10; y < VH; y += 2) if (bay(x | 0, y) > 0.4) R.blend(x, y, c, 0.35 * (1 - (y - B) / (VH - B))); }
      R.rect(0, B + 24, VW, 1, T('#5a5a7a'));
      for (let x = 0; x < VW; x += 18) R.rect(x, B + 34, 9, 1, T('#d8d8a8'));
    }
    if (E.world === 'apoc') {
      for (let i = 0; i < 3; i++) { const x = 20 + i * 100 + r() * 40, y = B + 14 + r() * 10; R.rect(x, y, 22, 7, T('#7a3a2a')); R.rect(x + 4, y - 4, 13, 5, T('#6a3424')); R.rect(x + 6, y - 3, 8, 3, T('#2a2a2a')); R.rect(x + 2, y + 6, 4, 3, '#1a1a1a'); R.rect(x + 16, y + 6, 4, 3, '#1a1a1a'); }
    }
    if (E.world === 'fwar') for (let i = 0; i < 5; i++) { let x = r() * VW; for (let y = B + 10; y < VH; y += 2) { x += (r() - 0.5) * 4; R.px(x, y, '#ff7a3a'); } }
    if (E.kind !== 'death' && (E.world === 'fantasy' || E.world === 'wuxia' || E.world === 'war')) grassTufts(R, r, 0, VW, VH, [T(P.ground[0]), T(lit(P.ground[0], 0.15)), T(P.ground[1])], 120, 4);
  }

  function middle(R, E) {
    const k = E.kind, r = E.r, T = E.T, B = HORIZON + 10, st = HOUSE_STYLE[E.world];
    if (k === 'home') house(R, 176, B + 14, 60, 34, E, st);
    if (k === 'town') { house(R, 160, B + 2, 34, 22, E, st); house(R, 200, B + 6, 46, 30, E, st); house(R, 252, B + 3, 34, 24, E, st); }
    if (k === 'field') {
      house(R, 214, B + 2, 36, 22, E, st);
      const crop = E.world === 'apoc' ? '#8aa040' : E.world === 'future' ? '#3ae0a0' : '#64b84a';
      for (let y = B + 8; y < VH - 2; y += 3) for (let x = 150 + (y - B) * 0.8; x < VW; x += 4) { R.rect(x, y, 2, 1, T(crop)); R.px(x, y - 1, T(lit(crop, 0.3))); }
      if (E.world === 'fantasy' || E.world === 'war') { const wx = 262, wy = B - 30; R.rect(wx, wy, 6, 30, T('#d8c8a8')); tri(R, wx + 3, wy - 6, 6, T('#8a4a2a')); for (let a = 0; a < 4; a++) line(R, wx + 3, wy + 2, wx + 3 + Math.cos(a * 1.57 + 0.4) * 14, wy + 2 + Math.sin(a * 1.57 + 0.4) * 14, T('#6a5a4a')); }
    }
    if (k === 'love') {
      const tones = (E.P.leaf || ['#ffc8d8', '#f090b0', '#b05a84']).map(T);
      R.rect(226, B - 34, 5, 50, T('#5a3a2a')); R.rect(226, B - 34, 2, 50, T('#7a5440'));
      canopy(R, r, 226, B - 44, 64, 38, tones, 40);
      [[150, B - 4], [176, B]].forEach(([lx, ly]) => { R.rect(lx, ly - 18, 1, 18, T('#3a2a22')); R.rect(lx - 2, ly - 22, 5, 5, '#ffb04a'); glow(R, lx, ly - 20, 9, '#ffb04a', 0.45); });
    }
    if (k === 'death') {
      const tx = 144, ty = FEET;
      R.rect(tx - 11, ty - 30, 22, 30, '#8e94a2'); disc(R, tx, ty - 30, 11, '#8e94a2');
      R.rect(tx - 11, ty - 30, 4, 30, '#a8aebc'); R.rect(tx + 8, ty - 30, 3, 30, '#6e7482');
      R.rect(tx - 1, ty - 34, 3, 16, '#5e6472'); R.rect(tx - 6, ty - 29, 13, 3, '#5e6472');
      for (let i = 0; i < 12; i++) R.px(tx - 11 + r() * 22, ty - 10 + r() * 10, '#4e7a4a');
      R.rect(tx - 16, ty - 2, 32, 3, '#4a5a44');
      [[-20, '#e86a8a'], [16, '#ffd27a'], [22, '#ffffff'], [-26, '#b07bff']].forEach(([dx, c]) => { R.rect(tx + dx, ty - 6, 1, 6, '#3a6a3a'); R.rect(tx + dx - 1, ty - 8, 3, 2, c); });
    }
  }

  // เฟรมกรอบหน้า (ต้นไม้ สายไฟ ธง) ให้ภาพมีระยะลึกแบบภาพประกอบเกม
  function foreground(R, E) {
    const r = E.r, T = E.T, w = E.world;
    if (w === 'fantasy' || w === 'wuxia') {
      const tones = (E.P.leaf).map(c => T(mix(c, '#4a2a4a', 0.12)));
      const trunk = T(w === 'wuxia' ? '#3a3030' : '#4a3040');
      const tips = [];
      branch(R, r, -6, 70, -0.9, 34, 5, trunk, 3, tips);
      tips.forEach(([x, y]) => canopy(R, r, x, y, 34, 24, tones, 10));
      canopy(R, r, 8, 6, 70, 30, tones, 26);
      if (w === 'wuxia') {
        // กิ่งสนยื่นจากขวาบน
        const pine = [T('#4a6a4a'), T('#2e4a36'), T('#1c3024')];
        line(R, VW, 18, VW - 60, 30, T('#3a2a22')); line(R, VW, 19, VW - 60, 31, T('#3a2a22'));
        [[VW - 58, 28], [VW - 36, 22], [VW - 14, 16]].forEach(([x, y]) => { for (let i = 0; i < 6; i++) puff(R, x + i * 3 - 8, y - 2 + Math.sin(i) * 2, 4, pine); });
      } else canopy(R, r, VW - 6, 4, 50, 22, tones, 16);
      grassTufts(R, r, 0, 54, VH, [T('#24402a'), T('#1a3020'), T('#2e5034')], 60, 12);
      grassTufts(R, r, VW - 54, VW, VH, [T('#24402a'), T('#1a3020'), T('#2e5034')], 60, 12);
    }
    if (w === 'apoc' || w === 'fwar') {
      const tips = [];
      const col = T(w === 'fwar' ? '#1a0a0c' : '#2e2618');
      R.rect(VW - 22, 40, 7, VH, col);
      branch(R, r, VW - 19, 44, -2.2, 26, 4, col, 4, tips);
      branch(R, r, VW - 19, 70, -2.6, 20, 3, col, 3, tips);
      for (let i = 0; i < 10; i++) R.rect(r() * 50, VH - 6 - r() * 8, 4 + r() * 8, 3 + r() * 5, T(w === 'fwar' ? '#2a1a14' : '#4e4430'));
    }
    if (w === 'future' || w === 'hunter') {
      const col = T('#0c0a16');
      R.rect(10, 20, 3, VH, col); R.rect(4, 28, 16, 2, col);
      wire(R, 12, 30, VW + 10, 18, 16, col); wire(R, 12, 34, VW + 10, 26, 20, col); wire(R, 12, 30, 140, -10, 8, col);
      if (w === 'future') { const c = '#ff3fa4'; R.rect(VW - 18, 34, 12, 46, '#14102a'); for (let y = 38; y < 76; y += 8) R.rect(VW - 15, y, 6, 5, c); glow(R, VW - 12, 56, 22, c, 0.35); }
      else { const c = '#ffd23f'; R.rect(VW - 26, 60, 20, 10, '#2a1a10'); R.rect(VW - 24, 62, 16, 6, c); glow(R, VW - 16, 65, 16, c, 0.3); }
    }
    if (w === 'war') {
      const col = T('#3a2a1a');
      R.rect(18, 22, 2, VH, col);
      for (let y = 0; y < 26; y++) { const wv = Math.sin(y * 0.3) * 2; R.rect(20, 24 + y, 22 + wv - (y > 20 ? (y - 20) * 2 : 0), 1, T(y % 7 === 0 ? '#6a1a1a' : '#9a2a2a')); }
      R.rect(26, 30, 8, 8, T('#ffd27a'));
      grassTufts(R, r, 0, 60, VH, [T('#3a3a1e'), T('#4e4a26')], 50, 10);
      grassTufts(R, r, VW - 60, VW, VH, [T('#3a3a1e'), T('#4e4a26')], 50, 10);
    }
  }

  function finish(R, E) {
    // ลำแสงเฉียงและขอบมืด
    if (!E.night && E.world !== 'future' && E.world !== 'hunter') {
      for (let k = 0; k < 4; k++) {
        const x0 = 150 + k * 34, w = 8 + k * 3;
        for (let y = 0; y < VH; y++) for (let x = 0; x < w; x++) R.blend(x0 + x - y * 0.6, y, '#fff6dc', 0.07);
      }
    }
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const dx = (x - VW / 2) / (VW / 2), dy = (y - VH / 2) / (VH / 2), d = dx * dx * 0.7 + dy * dy;
      if (d > 0.55) R.blend(x, y, '#000000', Math.min(0.42, (d - 0.55) * 0.55));
    }
  }

  // ---------- สไปรต์: ลงเงาและเส้นขอบอัตโนมัติ ----------
  function shadeOutline(R, emissive) {
    const { w, h, d } = R, src = d.slice();
    const has = i => (src[i] >>> 24) !== 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!has(i) || (emissive && emissive.has(src[i]))) continue;
      const up = y > 0 && has(i - w), left = x > 0 && has(i - 1), ul = x > 0 && y > 0 && has(i - w - 1);
      const dn = y < h - 1 && has(i + w), right = x < w - 1 && has(i + 1);
      if (!up || (!left && !ul)) d[i] = u32mix(src[i], WHITE, 0.24);
      else if (!dn || !right) d[i] = u32mix(src[i], BLACK, 0.3);
    }
    const s2 = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((s2[i] >>> 24) !== 0) continue;
      const n = [x > 0 && i - 1, x < w - 1 && i + 1, y > 0 && i - w, y < h - 1 && i + w].find(j => j !== false && (s2[j] >>> 24) !== 0);
      if (n !== undefined) d[i] = u32mix(s2[n], BLACK, 0.72);
    }
  }

  // ขยายสไปรต์ด้วย EPX (Scale2x) ให้เส้นโค้งเนียนแทนก้อนสี่เหลี่ยม
  function epx(g) {
    const h = g.length, w = g[0].length, out = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : g[y][x];
    for (let y = 0; y < h; y++) {
      let r0 = '', r1 = '';
      for (let x = 0; x < w; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        let p1 = P, p2 = P, p3 = P, p4 = P;
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = D;
        r0 += p1 + p2; r1 += p3 + p4;
      }
      out.push(r0, r1);
    }
    return out;
  }

  const T_ENEMY = {
    SLIME: ['...aaaa...', '..aaaaaa..', '.aaaaaaaa.', '.aewaaewa.', 'aaaaaaaaaa', 'aaaaaaaaaa', '.bbbbbbbb.'],
    GOBLIN: ['..aaa...', '.aaaaa..', 'aeaeaaa.', '.awaaa..', '..bbb...', '.abbba..', 'a.bbb.a.', '..bbb...', '..b.b...', '..b.b...', '.bb.bb..'],
    BEAST: ['.aa...........', 'aaaa..........', 'eaaaa....a....', 'aaaaaaaaaaa...', 'wwaaaaaaaaaaa.', '..aaaaaaaaaaaa', '..aa.aa..aa.aa', '..aa.aa..aa.aa', '..bb.bb..bb.bb'],
    KNIGHT: ['...mmm....', '..mmmmm...', '..meemm...', '..mmmmm...', '...mm.....', '.aaaaaaa..', 'aaaaaaaaa.', 'maaaaaaam.', 'm.aaaaa.m.', 'm.aaaaa.m.', 'w.bbbbb.m.', '..bb.bb...', '..bb.bb...', '..bb.bb...', '..bb.bb...', '.mmm.mmm..'],
    ZOMBIE: ['..aaa...', '.aaaaa..', '.eaeaa..', '.aaaaa..', '..bbb...', 'aabbbb..', '..bbbb..', '..bbbb..', '..bbbb..', '..b.bb..', '..b..b..', '..b..b..', '.bb.bb..'],
    ROBOT: ['..mmmmm...', '..meeem...', '..mmmmm...', '....m.....', '.mmmmmmm..', 'mmammmamm.', 'm.mmmmm.m.', 'm.mmmmm.m.', 'e.mmmmm.e.', '..mm.mm...', '..mm.mm...', '..mm.mm...', '.mmm.mmm..'],
    GIANT: ['....aaaa....', '...aaaaaa...', '...aeaaea...', '...aaaaaa...', '....awwa....', '..aaaaaaaa..', '.aaaaaaaaaa.', 'aaabbbbbbaaa', 'aa.bbbbbb.aa', 'aa.bbbbbb.aa', 'aa.bbbbbb.aa', 'w..bbbbbb..w', '...bbbbbb...', '...bb..bb...', '...bb..bb...', '...bb..bb...', '..bbb..bbb..'],
    DRAGON: ['..........aa............', '.........aaaa.......a...', '........aaaaaa.....aa...', '.......aaaaaaaa...aaa...', '..bbb..aaaaaaaaa.aaaa...', '.beebb..aaaaaaaaaaaa....', 'wbbbbbb...aaaaaaaaa.....', '.wbbbbbbbbbbbbbbbb......', '....bbbbbbbbbbbbbbbbb...', '.....bbbbbbbbbbbbbbbbbb.', '......bbbbbbbbbbbb...bbb', '......bb..bb..bb......bb', '......bb..bb..bb........', '.....bbb.bbb.bbb........'],
  };
  const ENEMIES = {
    fantasy: [['SLIME', 1, 1], ['GOBLIN', 1, 1], ['BEAST', 1, 1], ['GOBLIN', 2, 1], ['GIANT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['DRAGON', 2, 1], ['GIANT', 2, 1]],
    future: [['ROBOT', 1, 1], ['KNIGHT', 1, 2], ['ROBOT', 2, 1], ['KNIGHT', 2, 1], ['ROBOT', 2, 1], ['ROBOT', 1, 3], ['KNIGHT', 2, 1], ['BEAST', 2, 1], ['ROBOT', 2, 2]],
    apoc: [['ZOMBIE', 1, 1], ['ZOMBIE', 1, 3], ['BEAST', 1, 2], ['KNIGHT', 1, 3], ['ZOMBIE', 2, 1], ['BEAST', 2, 1], ['ZOMBIE', 1, 6], ['ZOMBIE', 2, 2], ['SLIME', 2, 1]],
    war: [['KNIGHT', 1, 1], ['KNIGHT', 1, 2], ['KNIGHT', 1, 3], ['BEAST', 2, 1], ['KNIGHT', 1, 5], ['KNIGHT', 2, 1], ['KNIGHT', 1, 7], ['KNIGHT', 2, 2], ['KNIGHT', 2, 3]],
    fwar: [['GOBLIN', 2, 1], ['KNIGHT', 1, 2], ['ZOMBIE', 1, 3], ['BEAST', 2, 1], ['GIANT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['GIANT', 2, 1], ['DRAGON', 2, 1]],
    hunter: [['GOBLIN', 1, 2], ['BEAST', 1, 1], ['GOBLIN', 2, 1], ['ZOMBIE', 2, 1], ['KNIGHT', 2, 1], ['DRAGON', 1, 1], ['BEAST', 2, 2], ['GOBLIN', 1, 6], ['GIANT', 2, 1]],
    wuxia: [['KNIGHT', 1, 1], ['KNIGHT', 1, 2], ['BEAST', 1, 1], ['KNIGHT', 2, 1], ['DRAGON', 1, 1], ['KNIGHT', 2, 1], ['BEAST', 2, 1], ['KNIGHT', 2, 1], ['GIANT', 2, 1]],
  };

  function tplRaster(tpl, level, pal, shade = true) {
    let g = tpl;
    for (let i = 0; i < level; i++) g = epx(g);
    const R = Raster(g[0].length + 2, g.length + 2);
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') R.px(x + 1, y + 1, pal[ch]); }));
    if (shade) shadeOutline(R, new Set([u32(pal.e)]));
    return R;
  }

  // วาดสไปรต์เทมเพลตลงฉากพื้นหลังโดยตรง (เช่น มังกรบินบนฟ้า)
  function bakeSprite(R, tpl, level, pal, cx, cy) {
    const S = tplRaster(tpl, level, pal, false);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const v = S.d[y * S.w + x]; if (v >>> 24) { const X = Math.round(cx - S.w / 2 + x), Y = Math.round(cy - S.h / 2 + y); if (X >= 0 && Y >= 0 && X < R.w && Y < R.h) R.d[Y * R.w + X] = v; } }
  }

  const spriteCache = new Map();
  function cached(key, make) {
    let v = spriteCache.get(key);
    if (!v) { v = make(); if (spriteCache.size > 300) spriteCache.clear(); spriteCache.set(key, v); }
    return v;
  }

  function enemyPal(world, t) {
    const P = PAL[world];
    const a = mix(P.enemy, '#8a1a2a', t / 12);
    return { a, b: mix(a, '#000000', 0.32), e: world === 'future' ? '#38e1ff' : '#ff3b3b', w: '#f0eee8', m: world === 'war' || world === 'wuxia' ? mix('#8a909c', a, 0.3) : '#a8b2c6' };
  }

  function enemyCanvas(world, t, hit) {
    return cached('e|' + world + '|' + t + '|' + hit, () => {
      const [name, s] = ENEMIES[world][t];
      const pal = hit ? { a: '#ffffff', b: '#ffffff', e: '#ffffff', w: '#ffffff', m: '#ffffff' } : enemyPal(world, t);
      return toCanvas(tplRaster(T_ENEMY[name], s >= 2 ? 2 : 1, pal));
    });
  }

  function drawEnemy(c, world, t, x, feet, frame, hit) {
    t = Math.max(0, Math.min(8, t));
    const n = ENEMIES[world][t][2];
    const cv = enemyCanvas(world, t, false), hv = hit ? enemyCanvas(world, t, true) : null;
    const bob = frame % 16 < 8 ? 0 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const dx = (i % 3) * Math.min(28, cv.width * 0.7) + Math.floor(i / 3) * 10, dy = Math.floor(i / 3) * -6;
      c.drawImage(i === 0 && hv ? hv : cv, Math.round(x - cv.width / 2 + dx), Math.round(feet - cv.height + dy + (i === 0 ? bob : 0) + 1));
    }
  }

  function drawBoss(c, world, frame) {
    const key = 'boss|' + world;
    const cv = cached(key, () => {
      const tpl = world === 'future' ? T_ENEMY.ROBOT : world === 'apoc' || world === 'hunter' ? T_ENEMY.GIANT : T_ENEMY.DRAGON;
      const R = tplRaster(tpl, 2, { a: '#1c0a12', b: '#12060c', e: '#ff3b3b', w: '#3a1a1a', m: '#2a1424' }, false);
      // แสงขอบสีแดงด้านซ้ายบน
      const src = R.d.slice();
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const i = y * R.w + x; if ((src[i] >>> 24) && src[i] !== u32('#ff3b3b') && (!(src[i - R.w] >>> 24) || !(src[i - 1] >>> 24))) R.d[i] = u32('#a8302a'); }
      const big = document.createElement('canvas');
      const sc = world === 'future' ? 2 : world === 'apoc' || world === 'hunter' ? 2 : 1.6;
      big.width = Math.round(R.w * sc); big.height = Math.round(R.h * sc);
      const bc = big.getContext('2d'); bc.imageSmoothingEnabled = false;
      bc.drawImage(toCanvas(R), 0, 0, big.width, big.height);
      return big;
    });
    const bob = Math.round(Math.sin(frame * 0.12) * 2);
    c.drawImage(cv, Math.round(VW - cv.width + 20), Math.round(FEET + 6 - cv.height + bob));
  }

  // ---------- ตัวละคร ----------
  const STAT_COL = { str: '#b8413a', agi: '#3c8f5a', int: '#3f5fc0', vit: '#7d8798', luk: '#c8962e', cha: '#9a4cbb' };
  // [ชุด, หมวก/ผม, อาวุธ, ผ้าคลุมหลัง]
  const GEAR = {
    sword: ['plate', 'none', 'sword', true], knight: ['plate', 'helmet', 'sword+shield', true], mage: ['robe', 'wizard', 'staff'], priest: ['robe', 'hoodw', 'staffw'],
    thief: ['leather', 'hood', 'dagger'], tamer: ['leather', 'none', 'pet'], smith: ['apron', 'bandana', 'hammer'], hero: ['plate', 'circlet', 'sword+shield', true],
    hacker: ['tech', 'none', 'tablet'], cyborg: ['tech', 'visor', 'gun'], pilot: ['tech', 'visor', 'gun'], psion: ['tech', 'circlet', 'orb'], ninja: ['tech', 'mask', 'dagger'],
    nano: ['tech', 'goggles', 'hammer'], idol: ['casual', 'none', 'mic'], quantum: ['tech', 'visor', 'orb', true],
    gunner: ['tactical', 'cap', 'gun'], brawler: ['casual', 'bandana', 'axe'], medic: ['casual', 'none', 'kit'], scav: ['leather', 'hood', 'bag'], mech: ['apron', 'goggles', 'hammer'],
    leader: ['tactical', 'none', 'flag', true], apex: ['casual', 'none', 'claw'],
    pike: ['plate', 'helmet', 'spear'], archer: ['leather', 'hood', 'bow'], cav: ['plate', 'helmet', 'spear', true], tact: ['robe', 'none', 'book'], surgeon: ['robe', 'none', 'kit'],
    merchant: ['casual', 'cap', 'bag'], genius: ['plate', 'none', 'flag', true],
    dknight: ['plate', 'horns', 'spear', true], warmage: ['robe', 'wizard', 'staff'], ranger: ['leather', 'hood', 'bow'], paladin: ['plate', 'helmet', 'hammer+shield', true],
    beast: ['leather', 'none', 'pet'], shadow: ['leather', 'mask', 'dagger'], runesmith: ['apron', 'none', 'hammer'], ancient: ['plate', 'horns', 'spear', true],
    fighter: ['casual', 'none', 'sword'], caster: ['casual', 'none', 'staff'], healer: ['casual', 'none', 'staffw'], tankh: ['tactical', 'none', 'sword+shield'],
    assassin: ['tech', 'mask', 'dagger'], summoner: ['casual', 'none', 'pet'], crafter: ['apron', 'goggles', 'hammer'], player: ['casual', 'hood', 'dagger'],
  };
  const GEAR_WUXIA = { sword: ['hanfu', 'bun', 'sword'], palm: ['hanfu', 'bun', 'none'], alch: ['hanfu', 'bun', 'gourd'], array: ['hanfu', 'bun', 'book'], poison: ['hanfu', 'mask', 'dagger'], monk: ['monk', 'bald', 'staff'], heir: ['hanfu', 'bun', 'sword', true] };
  const SKINS = ['#f4cca4', '#e2ae80', '#c88c5c', '#94603e', '#f6d8bc'];
  const HAIR_ALL = ['#2a1d14', '#5a3a1e', '#d0a450', '#ecd494', '#9a2e2a', '#1a1a2a', '#dadae2', '#3a5ab0', '#b84a8a'];
  const HAIR_REAL = ['#2a1d14', '#5a3a1e', '#1a1a2a', '#3a2a1a'];

  // ลักษณะตัวละครจากสถานะเกม (คงที่ตาม seed เพื่อให้หน้าตาเหมือนเดิมตลอดชีวิต)
  function look(st, opt = {}) {
    const r = rng(hash(opt.name || st.lookSeed || st.name || 'x'));
    const world = st.W.id;
    const cls = opt.cls || st.cls;
    const female = (opt.gender || st.gender) === 'f';
    const real = world === 'war' || world === 'hunter' || world === 'apoc' || world === 'wuxia';
    const race = opt.race === undefined ? st.race.n : opt.race;
    const gear = cls ? ((world === 'wuxia' && GEAR_WUXIA[cls.id]) || GEAR[cls.id] || ['tunic', 'none', 'none']) : null;
    const L = {
      female, world,
      skin: pickR(r, SKINS),
      hair: pickR(r, real ? HAIR_REAL : HAIR_ALL),
      hairStyle: female ? 2 + Math.floor(r() * 2) : Math.floor(r() * 2),
      acc: PAL[world].acc,
    };
    const main = cls ? cls.main[0] : pickR(r, Object.keys(STAT_COL));
    let out = opt.partner ? pickR(r, Object.values(STAT_COL)) : STAT_COL[main];
    if (world === 'apoc') out = mix(out, '#6a5a3a', 0.45);
    if (world === 'future' || world === 'hunter') out = mix(out, '#1a1a2a', 0.3);
    if (world === 'wuxia') out = mix(out, '#f0e8d8', 0.3);
    L.outfit = out;
    if (opt.partner || !gear) {
      const def = { fantasy: 'tunic', war: 'tunic', fwar: 'tunic', future: 'tech', hunter: 'casual', apoc: 'casual', wuxia: 'hanfu' }[world] || 'tunic';
      L.suit = female ? (world === 'wuxia' ? 'hanfu' : world === 'future' ? 'tech' : 'dress') : def;
      L.hat = world === 'wuxia' && !female ? 'bun' : 'none';
      L.weapon = 'none'; L.cape = false;
    } else {
      [L.suit, L.hat, L.weapon, L.cape] = gear;
      L.cape = !!L.cape;
      if (L.hat === 'bun' && female) L.hat = 'none';
    }
    if (race) {
      if (race.includes('เอลฟ์')) { L.elf = true; L.skin = '#f6dec8'; }
      if (race.includes('แคระ')) { L.dwarf = true; }
      if (race.includes('สัตว์') || race.includes('จิ้งจอก')) { L.ears = true; L.tail = true; }
      if (race.includes('มังกร')) { L.horns = true; }
      if (race.includes('ออร์ค')) { L.skin = '#7a9a5a'; L.tusk = true; }
      if (race.includes('แอนดรอยด์')) { L.skin = '#dae2ea'; L.android = true; }
      if (race.includes('กลายพันธุ์')) { L.skin = '#aabc8c'; }
      if (race.includes('ต่างดาว')) { L.skin = '#b2caf2'; }
    }
    const age = opt.age === undefined ? st.age : opt.age;
    const L2 = typeof lifespan === 'function' && st.stats && !opt.partner ? lifespan() : 75;
    L.stage = age < 13 ? 'child' : age >= L2 * 0.72 ? 'elder' : 'adult';
    if (L.stage === 'elder') L.hair = '#dcdce2';
    if (L.stage === 'child') { L.suit = 'tunic'; L.weapon = 'none'; L.cape = false; if (L.hat !== 'bun') L.hat = 'none'; }
    if (opt.aura) L.aura = opt.aura;
    return L;
  }

  // วาดตัวละครแบบแบน (ยังไม่ลงเงา) — หันขวา, cx = กลางตัว, feet = ระดับเท้า
  function personFlat(R, L, cx, feet, bob) {
    const child = L.stage === 'child', dwarf = L.dwarf && !child;
    const tT = 13, tH = child ? 6 : dwarf ? 9 : 11, legH = child ? 4 : dwarf ? 6 : 9, bootH = child ? 2 : 3;
    const lT = tT + tH, bT = lT + legH, H = bT + bootH;
    const tx = child ? 4 : dwarf ? 2 : 3, tw = child ? 8 : dwarf ? 12 : 10;
    const ox = cx - 8, oy = feet - H + bob;
    const P = (x, y, w, h, col) => R.rect(ox + x, oy + y, w, h, col);
    const { skin, hair, outfit: out } = L;
    const steel = '#aab4c8', wood = '#7a5230', gold = '#e8b84a', boot = '#4a3020';
    const fx = tx + tw, fy = tT + tH - 1; // มือหน้า
    const glows = [];

    // ปีก (เทพธิดา) อยู่หลังสุด
    if (L.wings) for (let i = 0; i < 16; i++) {
      const len = 22 - Math.abs(i - 4) * 1.1;
      P(tx - 2 - i, tT - 6 + Math.floor(i * 0.4), 1, len, i % 3 === 2 ? '#e2d6f4' : '#ffffff');
      P(fx + 2 + i, tT - 6 + Math.floor(i * 0.4), 1, len, i % 3 === 2 ? '#e2d6f4' : '#ffffff');
    }
    if (L.cape) { const cc = dim(out, 0.25); P(tx - 3, tT + 1, 5, tH + legH - 1, cc); P(tx - 4 - bob, tT + tH + legH - 4, 3, 3, cc); }
    if (L.hairStyle === 2 && !['helmet', 'horns', 'hood', 'hoodw', 'visor', 'bald'].includes(L.hat)) P(2, 3, 5, child ? 10 : 15, hair);
    if (L.tail) { P(tx - 4, tT + tH - 4, 4, 2, hair); P(tx - 6, tT + tH - 7, 3, 4, hair); P(tx - 6, tT + tH - 8, 2, 1, lit(hair, 0.3)); }
    // ปืนสะพายหลัง/ถุง
    if (L.weapon === 'bag') { P(tx - 2, tT + tH - 4, 5, 5, '#8a6a3a'); line(R, ox + tx + 1, oy + tT, ox + fx - 1, oy + tT + tH - 3, '#5a4028'); }
    // แขนหลัง
    const sleeve = { plate: steel, robe: out, hanfu: out, tech: '#2c3242', tactical: '#3a3e30', monk: skin }[L.suit] || out;
    P(tx - 2, tT + 1, 2, tH - 1, dim(sleeve, 0.12)); P(tx - 2, tT + tH - 1, 2, 2, dim(skin, 0.1));

    // ขาและรองเท้า
    const legC = { plate: dim(steel, 0.1), tech: '#262a36', casual: '#3e5c8e', tactical: '#5a5a40', leather: '#4a3a2a', apron: '#4a3a2a', tunic: '#5a4a3a' }[L.suit] || dim(out, 0.4);
    const bootC = { plate: dim(steel, 0.35), tech: '#1c2028', casual: '#e8e8e8', tactical: '#1e1e1e' }[L.suit] || boot;
    const bl = tx + 1, fl = tx + tw - 5;
    P(bl, lT, 3, legH, dim(legC, 0.12)); P(fl, lT, 3, legH, legC);
    P(bl - 1, bT, 4, bootH, dim(bootC, 0.1)); P(fl, bT, 5, bootH, bootC);
    if (L.suit === 'casual') { P(bl - 1, H - 1, 4, 1, '#9aa0aa'); P(fl, H - 1, 5, 1, '#9aa0aa'); }
    if (L.suit === 'tech') { P(fl + 1, lT + 2, 1, legH - 2, L.acc); }

    // ลำตัวตามชุด
    const S = L.suit;
    if (S === 'robe' || S === 'hanfu' || S === 'monk' || S === 'dress') {
      const rc = S === 'monk' ? '#d8862a' : out;
      for (let y = tT; y < bT + (S === 'dress' ? 0 : 1); y++) { const grow = Math.floor((y - tT) / 6); P(tx - grow, y, tw + grow * 2, 1, rc); }
      if (S === 'robe') { P(tx + tw / 2 - 1, tT, 2, bT - tT + 1, L.acc === '#38e1ff' ? L.acc : gold); P(tx, tT + tH - 3, tw, 2, dim(rc, 0.3)); }
      if (S === 'hanfu') { for (let i = 0; i < 6; i++) P(tx + 2 + i, tT + i, 1, 1, '#f6f0e4'); P(tx - 1, tT + tH - 3, tw + 2, 3, dim(rc, 0.45)); P(tx + tw - 3, tT + tH - 1, 2, 5, dim(rc, 0.45)); }
      if (S === 'monk') { P(tx, tT, 3, 5, skin); for (let i = 0; i < 6; i++) P(tx + 3 + i, tT + i, 1, 1, '#8a3a1a'); P(tx, tT + tH - 3, tw, 2, '#8a3a1a'); }
      if (S === 'dress') { P(tx + 1, tT, tw - 2, 4, lit(rc, 0.15)); P(tx, tT + 5, tw, 1, '#ffffff'); }
    } else if (S === 'plate') {
      P(tx, tT, tw, tH, steel); P(tx + 2, tT + 2, 3, 4, lit(steel, 0.35));
      P(tx + 3, tT + 3, 4, tH + 2, out); P(tx + 3, tT + 3, 4, 1, lit(out, 0.25));
      P(tx, tT + tH - 2, tw, 1, '#5a3a1e'); P(tx + tw / 2 - 1, tT + tH - 2, 2, 1, gold);
      P(tx - 2, tT, 4, 3, lit(steel, 0.15)); P(fx - 2, tT, 4, 3, lit(steel, 0.15));
    } else if (S === 'leather' || S === 'tunic') {
      P(tx, tT, tw, tH, out); P(tx + 1, tT + 1, 2, 3, lit(out, 0.2));
      if (S === 'leather') { P(tx, tT, 3, tH - 1, '#7a5030'); P(fx - 3, tT, 3, tH - 1, '#7a5030'); P(fx - 3, tT + 3, 2, 2, '#a07040'); }
      P(tx, tT + tH - 2, tw, 1, '#4a3020'); P(tx + 5, tT + tH - 2, 2, 1, gold);
      if (L.female && S === 'tunic') P(tx - 1, lT, tw + 2, 3, out);
    } else if (S === 'tech') {
      P(tx, tT, tw, tH, '#2c3242'); P(tx + 2, tT + 1, tw - 4, 4, '#3c4456');
      P(tx + 1, tT + 5, 1, 4, L.acc); P(fx - 2, tT + 5, 1, 4, L.acc); P(tx + 4, tT + 2, 2, 2, L.acc);
      P(tx - 1, tT, 3, 3, '#3c4456'); P(fx - 2, tT, 3, 3, '#3c4456');
      glows.push([ox + tx + 5, oy + tT + 3, L.acc, 5]);
    } else if (S === 'casual') {
      P(tx + 3, tT, 4, tH - 1, '#ececf0'); P(tx, tT, 3, tH, out); P(fx - 3, tT, 3, tH, out);
      P(tx, tT, tw, 1, lit(out, 0.2)); P(tx + 3, tT + tH - 2, 4, 1, '#3e5c8e');
    } else if (S === 'tactical') {
      P(tx, tT, tw, tH, '#3a3e30'); P(tx + 1, tT + 1, tw - 2, tH - 3, '#5e6a3e');
      for (let i = 0; i < 3; i++) P(tx + 1 + i * 3, tT + tH - 5, 2, 2, '#46502e');
      P(tx, tT + tH - 2, tw, 1, '#1e1e1e');
    } else if (S === 'apron') {
      P(tx, tT, tw, tH, out); P(tx + 2, tT + 2, tw - 3, tH + 4, '#7a5030'); P(tx + 2, tT + 2, tw - 3, 1, '#9a6a40');
    }
    // คอ
    P(6, 11, 4, 2, dim(skin, 0.12));
    // หัว
    P(4, 3, 8, 9, skin); P(4, 3, 2, 9, dim(skin, 0.08));
    P(8, 7, 1, 2, '#1a1420'); P(10, 7, 1, 2, '#1a1420'); P(8, 7, 1, 1, '#4a5a8a');
    P(9, 10, 2, 1, dim(skin, 0.25));
    if (child) P(9, 9, 2, 1, mix(skin, '#ff6a6a', 0.35));
    if (L.elf) { P(2, 6, 2, 1, skin); P(1, 5, 1, 1, skin); }
    if (L.tusk) P(11, 10, 1, 1, '#f4f0e0');
    if (L.android) { P(5, 6, 1, 4, '#38e1ff'); glows.push([ox + 5, oy + 8, '#38e1ff', 3]); }
    // ผม
    const H2 = L.hat;
    if (H2 !== 'helmet' && H2 !== 'horns' && H2 !== 'visor' && H2 !== 'bald') {
      P(3, 1, 10, 4, hair); P(3, 3, 3, 6, hair); P(4, 1, 6, 1, lit(hair, 0.3));
      if (L.hairStyle === 0) P(9, 4, 3, 1, hair);
      if (L.hairStyle === 1) { [4, 6, 8, 10].forEach(x => P(x, 0, 1, 1, hair)); P(5, -1, 1, 1, hair); P(9, -1, 1, 1, hair); P(11, 4, 2, 2, hair); }
      if (L.hairStyle >= 2) { P(3, 3, 2, 10, hair); P(10, 3, 3, 2, hair); }
      if (L.hairStyle === 3) { P(0, 4, 3, 9, hair); P(2, 4, 1, 1, '#c0392b'); }
      if ((L.stage === 'elder' && !L.female) || L.dwarf) P(7, 9, 6, L.dwarf ? 6 : 4, hair);
    }
    if (L.ears) { P(4, -1, 2, 3, hair); P(9, -1, 2, 3, hair); P(5, 0, 1, 1, '#f0a0a0'); }
    // หมวก
    switch (H2) {
      case 'helmet': case 'horns':
        P(3, 0, 10, 11, steel); P(4, 1, 3, 4, lit(steel, 0.35)); P(7, 6, 6, 1, '#141820'); P(8, 8, 4, 1, '#3a4252');
        if (H2 === 'helmet') { P(5, -3, 5, 3, out); P(3, -2, 3, 2, out); }
        else { P(1, -3, 2, 4, '#ece2c8'); P(0, -5, 2, 2, '#ece2c8'); P(13, -3, 2, 4, '#ece2c8'); P(14, -5, 2, 2, '#ece2c8'); }
        break;
      case 'wizard': {
        const hc = dim(out, 0.25);
        P(1, 3, 15, 2, hc);
        for (let i = 0; i < 12; i++) P(4 - Math.floor(i * 0.25), 2 - i, Math.max(1, 8 - Math.floor(i * 0.65)), 1, hc);
        P(4, 1, 8, 1, gold); P(7, 0, 2, 1, L.acc);
        break;
      }
      case 'hood': case 'hoodw': {
        const hc = H2 === 'hoodw' ? '#f2eef8' : dim(out, 0.35);
        P(3, 1, 10, 3, hc); P(3, 1, 3, 11, hc); P(2, 4, 2, 9, hc); P(11, 2, 2, 2, hc); P(6, 0, 5, 1, hc);
        P(3, 11, 9, 3, hc);
        break;
      }
      case 'visor':
        P(3, 0, 10, 10, '#3a4252'); P(4, 1, 3, 3, '#56607a'); P(6, 5, 7, 3, L.acc); P(12, -3, 1, 4, '#56607a');
        glows.push([ox + 9, oy + 6, L.acc, 7]);
        break;
      case 'mask': P(6, 8, 7, 4, '#1a1a24'); P(3, 3, 10, 1, '#1a1a24'); P(1, 4, 2, 4, '#1a1a24'); break;
      case 'goggles': P(3, 3, 10, 1, '#4a3a2a'); P(8, 2, 4, 2, '#9ad7ff'); P(8, 2, 1, 1, '#ffffff'); break;
      case 'cap': P(3, 1, 10, 3, dim(out, 0.2)); P(10, 3, 5, 1, dim(out, 0.4)); break;
      case 'bandana': P(3, 2, 10, 2, '#c0392b'); P(0, 3, 3, 4, '#c0392b'); break;
      case 'circlet': P(4, 4, 8, 1, gold); P(10, 4, 1, 1, L.acc); glows.push([ox + 10, oy + 4, L.acc, 3]); break;
      case 'bun': P(5, -2, 5, 3, hair); P(4, -1, 7, 1, hair); P(10, -2, 2, 1, gold); break;
      case 'bald': P(4, 2, 8, 2, skin); P(5, 2, 3, 1, lit(skin, 0.3)); for (let i = 0; i < 5; i++) P(4 + i * 2, tT + 1, 1, 1, '#6a3a1a'); break;
    }
    if (L.horns) { P(4, -1, 2, 2, '#ece2c8'); P(10, -1, 2, 2, '#ece2c8'); P(3, -3, 1, 2, '#ece2c8'); }
    if (L.halo) { P(3, -5, 10, 1, '#ffd27a'); glows.push([ox + 8, oy - 5, '#ffe8a8', 8]); }

    // โล่ (แขนหลัง)
    if (L.weapon.includes('shield')) {
      P(tx - 4, tT + 2, 7, 9, steel); P(tx - 3, tT + 3, 5, 7, out); P(tx - 1, tT + 5, 2, 2, gold);
      P(tx - 3, tT + 11, 5, 1, steel); P(tx - 2, tT + 12, 3, 1, steel);
    }
    // อาวุธ (ก่อนมือหน้า เพื่อให้มือดูถือไว้)
    const W = L.weapon.split('+')[0];
    switch (W) {
      case 'sword': P(fx + 1, fy - 17, 2, 16, '#dfe6f0'); P(fx + 1, fy - 17, 1, 16, '#ffffff'); P(fx + 1, fy - 18, 1, 1, '#dfe6f0'); P(fx - 1, fy - 1, 6, 1, gold); P(fx + 1, fy + 2, 2, 1, gold); break;
      case 'spear': P(fx + 1, fy - 24, 1, 34, wood); P(fx, fy - 30, 3, 6, '#dfe6f0'); P(fx + 1, fy - 31, 1, 1, '#dfe6f0'); P(fx, fy - 24, 3, 2, out); break;
      case 'staff': P(fx + 1, fy - 20, 1, 32, wood); P(fx - 1, fy - 25, 1, 4, wood); P(fx + 3, fy - 25, 1, 4, wood); P(fx, fy - 26, 3, 3, L.acc); glows.push([ox + fx + 1, oy + fy - 25, L.acc, 7]); break;
      case 'staffw': P(fx + 1, fy - 20, 1, 32, '#f4f0e6'); P(fx - 1, fy - 24, 5, 1, gold); P(fx, fy - 26, 3, 3, '#fff2c0'); glows.push([ox + fx + 1, oy + fy - 25, '#fff2c0', 7]); break;
      case 'orb': P(fx + 3, fy - 10, 3, 3, L.acc); glows.push([ox + fx + 4, oy + fy - 9, L.acc, 8]); break;
      case 'bow': for (let t = -12; t <= 12; t++) { const xx = fx + 3 + Math.round((1 - (t / 12) ** 2) * 3); P(xx, fy + t, 2, 1, wood); } P(fx + 2, fy - 12, 1, 25, '#ececec'); break;
      case 'gun': P(fx - 6, fy - 2, 14, 3, '#3a3f4a'); P(fx + 8, fy - 1, 7, 1, '#2a2e36'); P(fx - 9, fy - 1, 4, 3, '#2a2e36'); P(fx - 1, fy - 4, 6, 2, '#20242c'); P(fx + 1, fy + 1, 2, 4, '#2a2e36'); P(fx + 14, fy - 1, 1, 1, L.acc); glows.push([ox + fx + 15, oy + fy - 1, L.acc, 3]); break;
      case 'dagger': P(fx + 1, fy - 8, 1, 7, '#dfe6f0'); P(fx + 2, fy - 7, 1, 5, '#ffffff'); P(fx, fy - 1, 3, 1, gold); break;
      case 'hammer': P(fx + 1, fy - 14, 1, 20, wood); P(fx - 2, fy - 19, 8, 5, '#8a909c'); P(fx - 2, fy - 19, 8, 1, '#b8bec8'); break;
      case 'axe': P(fx + 1, fy - 16, 1, 22, wood); P(fx + 2, fy - 18, 5, 8, '#c0c6d0'); P(fx + 6, fy - 18, 1, 8, '#ffffff'); break;
      case 'book': P(fx, fy - 3, 6, 5, dim(out, 0.35)); P(fx + 1, fy - 3, 4, 1, '#f2e8d0'); P(fx + 2, fy - 1, 2, 2, L.acc); glows.push([ox + fx + 3, oy + fy, L.acc, 4]); break;
      case 'tablet': P(fx + 2, fy - 10, 8, 6, L.acc); P(fx + 3, fy - 9, 6, 1, '#ffffff'); glows.push([ox + fx + 6, oy + fy - 7, L.acc, 7]); break;
      case 'kit': P(fx, fy, 6, 5, '#f2f2f2'); P(fx + 2, fy, 2, 5, '#d03030'); P(fx, fy + 2, 6, 1, '#d03030'); break;
      case 'gourd': P(fx, fy, 4, 4, '#c8962e'); P(fx + 1, fy - 2, 2, 2, '#c8962e'); P(fx + 1, fy - 3, 2, 1, '#c0392b'); break;
      case 'mic': P(fx + 1, fy - 3, 1, 4, '#222222'); P(fx, fy - 6, 3, 3, '#c8c8c8'); glows.push([ox + fx + 6, oy + fy - 10, '#ff7ac8', 4]); break;
      case 'flag': { P(fx + 1, fy - 28, 1, 34, wood); for (let y = 0; y < 8; y++) P(fx + 2, fy - 28 + y, 11 + Math.round(Math.sin(y * 0.8 + bob) * 1.5), 1, y === 0 ? lit(L.acc, 0.2) : L.acc); P(fx + 5, fy - 26, 3, 3, '#ffffff'); break; }
      case 'claw': for (let i = 0; i < 3; i++) P(fx + 2, fy - 1 + i * 2, 4, 1, '#f0e8d8'); glows.push([ox + fx + 4, oy + fy + 1, '#9be15d', 5]); break;
    }
    // แขนหน้าและมือ
    P(fx, tT + 1, 2, tH - 2, sleeve); P(fx, fy, 2, 2, skin);
    if (S === 'plate') P(fx, tT + 3, 2, 1, lit(steel, 0.3));
    if (S === 'robe' || S === 'hanfu') P(fx - 1, fy - 2, 4, 2, sleeve);
    return { H, glows, width: tw };
  }

  function petFlat(R, L, x, feet) {
    const col = L.world === 'future' ? '#8aa0b8' : L.world === 'fantasy' || L.world === 'fwar' ? '#d8a040' : '#9a9aa8';
    const P = (dx, dy, w, h, c) => R.rect(x + dx, feet + dy, w, h, c);
    P(0, -8, 11, 5, col); P(8, -12, 5, 5, col); P(12, -10, 2, 2, col); P(11, -11, 1, 1, '#1a1420');
    P(8, -14, 1, 2, col); P(11, -14, 1, 2, col);
    [0, 3, 6, 9].forEach(dx => P(dx, -3, 2, 3, col));
    P(-3, -9, 3, 2, col); P(-4, -11, 2, 2, col);
    if (L.world === 'fantasy' || L.world === 'fwar') { P(2, -11, 5, 3, lit(col, 0.2)); P(1, -13, 3, 2, lit(col, 0.2)); }
  }

  // สร้าง (และแคช) สไปรต์ตัวละครที่ลงเงา/เส้นขอบแล้ว
  function personCanvas(L, bob) {
    const key = 'p|' + JSON.stringify(L) + '|' + bob;
    return cached(key, () => {
      const R = Raster(72, 64);
      const res = personFlat(R, L, 40, 60, bob);
      if (L.weapon === 'pet' && L.stage !== 'child') petFlat(R, L, 6, 60);
      shadeOutline(R, new Set([u32(L.acc), u32('#38e1ff'), u32('#fff2c0'), u32('#ffd27a')]));
      return { cv: toCanvas(R), glows: res.glows };
    });
  }

  function drawPerson(c, L, x, feet, frame, flip) {
    const bob = frame % 20 < 10 ? 0 : 1;
    const { cv, glows } = personCanvas(L, bob);
    c.save();
    if (flip) { c.translate(x * 2, 0); c.scale(-1, 1); }
    // เงาที่พื้น
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.fillRect(Math.round(x - 9), feet, 18, 2); c.fillRect(Math.round(x - 6), feet + 2, 12, 1);
    c.drawImage(cv, Math.round(x - 40), Math.round(feet - 60));
    // แสงเรืองของอาวุธ/อุปกรณ์ กะพริบเบา ๆ
    for (const [gx, gy, col, r] of glows) {
      const pulse = 0.22 + Math.sin(frame * 0.25 + gx) * 0.08;
      c.fillStyle = col;
      for (let y = -r; y <= r; y++) for (let xx = -r; xx <= r; xx++) {
        const d = Math.sqrt(xx * xx + y * y) / r;
        if (d < 1 && (1 - d) * pulse * 2.2 > bay(gx + xx, gy + y)) { c.globalAlpha = 0.35; c.fillRect(Math.round(x - 40 + gx + xx), Math.round(feet - 60 + gy + y), 1, 1); }
      }
      c.globalAlpha = 1;
    }
    if (L.aura) {
      c.fillStyle = L.aura;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + frame * 0.1;
        c.fillRect(Math.round(x + Math.cos(a) * 14), Math.round(feet - 20 + Math.sin(a) * 24), 1, i % 3 === 0 ? 2 : 1);
      }
    }
    c.restore();
  }

  // ---------- อนุภาค ----------
  const FX = {
    leaf: { n: 18, col: ['#fbd2e4', '#e2a2cc', '#ffffff'], vy: [0.25, 0.6], vx: [-0.6, -0.2], sway: true },
    rain: { n: 70, col: ['#38e1ff', '#ff3fa4', '#8890c0'], vy: [3.5, 5], vx: [-0.5, -0.5], len: 4 },
    ash: { n: 40, col: ['#c8c0a8', '#9a9482'], vy: [0.2, 0.45], vx: [-0.4, 0.4] },
    ember: { n: 34, col: ['#ff9a3f', '#ff5a2a', '#ffd23f'], vy: [-0.7, -0.25], vx: [-0.25, 0.25] },
    spark: { n: 30, col: ['#c8a8ff', '#8a5aff', '#ffffff'], vy: [-0.25, 0.15], vx: [-0.15, 0.15], blink: true },
    petal: { n: 22, col: ['#f2a4bc', '#ffd8e0'], vy: [0.3, 0.65], vx: [-0.7, -0.25], sway: true },
    gold: { n: 40, col: ['#ffd27a', '#ffffff', '#ffe8a8'], vy: [-0.2, 0.05], vx: [-0.12, 0.12], blink: true },
    heart: { n: 12, col: ['#ff6a9a', '#ffb0c8'], vy: [-0.45, -0.25], vx: [-0.12, 0.12], heart: true },
    firefly: { n: 16, col: ['#d8ff8a', '#ffe88a'], vy: [-0.12, 0.12], vx: [-0.2, 0.2], blink: true },
  };
  function makeParts(kind, r) {
    const f = FX[kind];
    if (!f) return [];
    return Array.from({ length: f.n }, () => ({ x: r() * VW, y: r() * VH, vx: f.vx[0] + r() * (f.vx[1] - f.vx[0]), vy: f.vy[0] + r() * (f.vy[1] - f.vy[0]), col: pickR(r, f.col), ph: r() * 6, f }));
  }
  function stepParts(c, parts, frame) {
    for (const p of parts) {
      p.x += p.vx + (p.f.sway ? Math.sin(frame * 0.1 + p.ph) * 0.35 : 0);
      p.y += p.vy;
      if (p.y > VH) { p.y = -4; p.x = Math.random() * VW; }
      if (p.y < -5) { p.y = VH; p.x = Math.random() * VW; }
      if (p.x < -4) p.x = VW; if (p.x > VW + 4) p.x = 0;
      if (p.f.blink && Math.sin(frame * 0.2 + p.ph) < 0) continue;
      c.fillStyle = p.col;
      const X = Math.round(p.x), Y = Math.round(p.y);
      if (p.f.heart) { c.fillRect(X, Y, 2, 1); c.fillRect(X + 3, Y, 2, 1); c.fillRect(X, Y + 1, 5, 1); c.fillRect(X + 1, Y + 2, 3, 1); c.fillRect(X + 2, Y + 3, 1, 1); }
      else if (p.f.sway) { c.fillRect(X, Y, 2, 1); c.fillRect(X + 1, Y + 1, 1, 1); }
      else c.fillRect(X, Y, 1, p.f.len || 1);
    }
  }

  // ---------- ประกอบฉาก ----------
  const baseCache = new Map();
  function buildBase(o) {
    const key = [o.world, o.kind, o.seed].join('|');
    if (baseCache.has(key)) return baseCache.get(key);
    const E = env(o);
    const R = Raster(VW, VH);
    sky(R, E);
    backdrop(R, E);
    ground(R, E);
    middle(R, E);
    foreground(R, E);
    finish(R, E);
    const cv = toCanvas(R);
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
    c.imageSmoothingEnabled = false;
    c.drawImage(buildBase(o), 0, 0);
    const k = o.kind;
    const ps = o.partners || (o.partner ? [o.partner] : []);
    if (k === 'battle' && o.hero) {
      const lunge = frame % 24 < 4;
      drawEnemy(c, o.world, o.enemyT || 0, 204, FEET, frame, lunge && frame % 24 >= 2);
      drawPerson(c, o.hero, lunge ? 108 : 94, FEET, frame);
      if (lunge) { c.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) c.fillRect(140 + i * 2, 104 + Math.round(Math.sin(i / 13 * Math.PI) * -10) + i, 2, 1); }
    } else if (k === 'boss') {
      if (o.world === 'wuxia') {
        if (frame % 30 < 3) { let x = 180 + Math.random() * 60; c.fillStyle = '#efe4ff'; for (let y = 0; y < FEET - 14; y += 3) { x += (Math.random() - 0.5) * 9; c.fillRect(Math.round(x), y, 2, 3); } c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(0, 0, VW, VH); }
      } else {
        drawBoss(c, o.world, frame);
        if (frame % 40 < 2) { c.fillStyle = 'rgba(255,60,40,.16)'; c.fillRect(0, 0, VW, VH); }
      }
      if (o.hero) drawPerson(c, o.hero, 76, FEET, frame);
    } else if (k === 'love') {
      [150, 104, 174, 80].slice(0, ps.length).forEach((x, i) => drawPerson(c, ps[i], x, FEET, frame + 5 + i * 3, x > 126));
      if (o.hero) drawPerson(c, o.hero, 126, FEET, frame);
    } else if (k === 'death') {
      const fl = frame % 6 < 3;
      c.fillStyle = '#efe6d2'; c.fillRect(160, FEET - 12, 3, 6);
      c.fillStyle = fl ? '#ffd27a' : '#ff9a3f'; c.fillRect(160, FEET - 15 - (fl ? 1 : 0), 3, 3);
      if (o.hero) { c.globalAlpha = 0.38; drawPerson(c, o.hero, 144, FEET - 58 - Math.round(Math.sin(frame * 0.1) * 3), frame); c.globalAlpha = 1; }
    } else if (k === 'bless') {
      drawPerson(c, o.goddess, 150, FEET - 18 + Math.round(Math.sin(frame * 0.08) * 3), frame);
      if (o.hero) drawPerson(c, o.hero, 94, FEET, frame);
    } else if (o.hero) {
      [76, 128, 54, 150].slice(0, ps.length).forEach((x, i) => drawPerson(c, ps[i], x, FEET, frame + 7 + i * 3, x > 102));
      drawPerson(c, o.hero, 102, FEET, frame);
    }
    stepParts(c, parts, frame);
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

  // ภาพนิ่งขยายขนาดแบบจำนวนเต็ม (ใช้ทำการ์ดแชร์) — scale อ้างอิงความกว้าง 192 เดิม
  function snapshot(o, scale) {
    const k = Math.max(1, Math.round(192 * scale / VW));
    const small = document.createElement('canvas');
    small.width = VW; small.height = VH;
    drawFrame(small.getContext('2d'), o, 4, makeParts(fxKind(o), rng(o.seed + 7)));
    const big = document.createElement('canvas');
    big.width = VW * k; big.height = VH * k;
    const bc = big.getContext('2d');
    bc.imageSmoothingEnabled = false;
    bc.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }

  const goddess = () => ({ skin: '#f8e4d0', hair: '#f2d070', hairStyle: 2, female: true, suit: 'robe', hat: 'circlet', outfit: '#f6f2ff', weapon: 'staffw', acc: '#ffd27a', stage: 'adult', wings: true, halo: true, aura: '#ffe8a8', world: 'heaven', cape: false });

  return { mount, snapshot, look, goddess, hash, VW, VH };
})();
