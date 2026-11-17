/* Sample photos. Friends' posts and seeded meals have no real photos, so these
   small drawn scenes stand in for them. A real photo replaces the scene when
   the person takes one. */
const MOODS = {
  dawn: { w1: '#FBD6B4', w2: '#F3AD92', fl: '#2A2630', lt: '#FFF4E2' },
  day: { w1: '#DDE7EE', w2: '#BACAD9', fl: '#262A33', lt: '#FFFFFF' },
  amber: { w1: '#F6D795', w2: '#E8AC62', fl: '#2B2622', lt: '#FFF5D2' },
  neon: { w1: '#3C2C80', w2: '#1B1648', fl: '#131127', lt: '#FF6AD5' },
  night: { w1: '#2C3A6E', w2: '#161D3F', fl: '#0F1328', lt: '#9DBEFF' },
  mint: { w1: '#D2EBDF', w2: '#9FD0BC', fl: '#232B2A', lt: '#FFFFFF' }
};
const PLATES = ['#E23B32', '#2D6BE0', '#F2B91C', '#2E9E5B'];
const STEEL = '#1B1F2B', CHROME = '#C9CED9';
const n1 = v => Number(v).toFixed(1);

function speckle(r, y0, n) {
  let s = ''; const cols = ['#6C86D8', '#9AA0B0', '#D4D7DE', '#D8573F', '#E3B341'];
  for (let i = 0; i < n; i++) s += '<circle cx="' + n1(r() * 400) + '" cy="' + n1(y0 + r() * (500 - y0)) + '" r="' + n1(0.8 + r() * 1.3) + '" fill="' + pick(r, cols) + '" opacity="' + (0.25 + r() * 0.4).toFixed(2) + '"/>';
  return s;
}
function floorG(r, m, y) {
  return '<rect x="0" y="' + y + '" width="400" height="' + (500 - y) + '" fill="' + m.fl + '"/><rect x="0" y="' + y + '" width="400" height="5" fill="#000" opacity=".28"/>' + speckle(r, y + 8, 70);
}
function beam(x) { return '<polygon points="' + x + ',0 ' + (x + 120) + ',0 ' + (x + 270) + ',500 ' + (x + 80) + ',500" fill="url(#l)"/>'; }
function barbell(r, cy, innerL, innerR, n) {
  let s = '<rect x="12" y="' + (cy - 3.5) + '" width="376" height="7" rx="3.5" fill="' + CHROME + '"/>';
  const c0 = Math.floor(r() * 4); let xl = innerL, xr = innerR;
  for (let i = 0; i < n; i++) {
    const h = i < 2 ? 126 : i === 2 ? 98 : 72, w = i < 2 ? 14 : 11, c = PLATES[(c0 + i) % 4];
    xl -= w + 2;
    const y = cy - h / 2;
    s += '<rect x="' + xl + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + c + '"/><rect x="' + xl + '" y="' + y + '" width="3" height="' + h + '" rx="1.5" fill="#fff" opacity=".2"/>';
    s += '<rect x="' + xr + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + c + '"/><rect x="' + xr + '" y="' + y + '" width="3" height="' + h + '" rx="1.5" fill="#fff" opacity=".2"/>';
    xr += w + 2;
  }
  s += '<rect x="' + (xl - 9) + '" y="' + (cy - 9) + '" width="7" height="18" rx="2" fill="#8D93A3"/><rect x="' + (xr + 2) + '" y="' + (cy - 9) + '" width="7" height="18" rx="2" fill="#8D93A3"/>';
  return s;
}
function hex(cx, cy, R) {
  let p = '';
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; p += n1(cx + R * Math.cos(a)) + ',' + n1(cy + R * Math.sin(a)) + ' '; }
  return '<polygon points="' + p + '" fill="#23262F"/><circle cx="' + cx + '" cy="' + cy + '" r="' + n1(R * 0.42) + '" fill="#3D4250"/>';
}
function kettle(cx, cy, R) {
  return '<path d="M' + (cx - R * 0.62) + ' ' + (cy - R * 0.7) + ' a' + n1(R * 0.62) + ' ' + n1(R * 0.7) + ' 0 0 1 ' + n1(R * 1.24) + ' 0" fill="none" stroke="#20232B" stroke-width="' + n1(R * 0.3) + '"/><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#20232B"/><circle cx="' + (cx - R * 0.3) + '" cy="' + (cy - R * 0.3) + '" r="' + n1(R * 0.22) + '" fill="#fff" opacity=".14"/>';
}

const SCENES = {
  rack(r, m) {
    const cy = 200 + Math.floor(r() * 34);
    let s = '<rect x="0" y="150" width="400" height="6" fill="#fff" opacity=".2"/>' + beam(30 + r() * 120) + floorG(r, m, 374);
    s += '<rect x="70" y="378" width="68" height="10" rx="4" fill="' + STEEL + '"/><rect x="262" y="378" width="68" height="10" rx="4" fill="' + STEEL + '"/>';
    s += '<rect x="96" y="92" width="16" height="290" rx="3" fill="' + STEEL + '"/><rect x="288" y="92" width="16" height="290" rx="3" fill="' + STEEL + '"/><rect x="96" y="92" width="208" height="14" rx="3" fill="' + STEEL + '"/>';
    for (let y = 122; y < 366; y += 22) s += '<circle cx="104" cy="' + y + '" r="2.2" fill="#fff" opacity=".25"/><circle cx="296" cy="' + y + '" r="2.2" fill="#fff" opacity=".25"/>';
    s += '<rect x="112" y="304" width="52" height="8" rx="2" fill="' + STEEL + '"/><rect x="236" y="304" width="52" height="8" rx="2" fill="' + STEEL + '"/>';
    s += '<rect x="86" y="' + (cy + 3) + '" width="12" height="11" rx="2" fill="#3A4050"/><rect x="302" y="' + (cy + 3) + '" width="12" height="11" rx="2" fill="#3A4050"/>';
    return s + barbell(r, cy, 90, 310, 2 + Math.floor(r() * 3));
  },
  bench(r, m) {
    let s = '<rect x="0" y="130" width="400" height="5" fill="#fff" opacity=".2"/>' + beam(120 + r() * 120) + floorG(r, m, 382);
    s += '<rect x="118" y="196" width="14" height="192" rx="3" fill="' + STEEL + '"/><rect x="268" y="196" width="14" height="192" rx="3" fill="' + STEEL + '"/>';
    s += '<rect x="108" y="218" width="12" height="11" rx="2" fill="#3A4050"/><rect x="280" y="218" width="12" height="11" rx="2" fill="#3A4050"/>';
    s += barbell(r, 214, 110, 290, 1 + Math.floor(r() * 3));
    s += '<polygon points="176,290 224,290 240,374 160,374" fill="#2C303D"/><polygon points="182,296 218,296 230,366 170,366" fill="#3B4052"/>';
    s += '<rect x="166" y="374" width="9" height="20" fill="' + STEEL + '"/><rect x="225" y="374" width="9" height="20" fill="' + STEEL + '"/>';
    return s;
  },
  dumbbells(r, m) {
    let s = '<rect x="28" y="54" width="344" height="196" rx="6" fill="#fff" opacity=".22"/><rect x="142" y="54" width="2" height="196" fill="#000" opacity=".12"/><rect x="256" y="54" width="2" height="196" fill="#000" opacity=".12"/>';
    s += '<polygon points="60,54 120,54 60,250 28,250 28,160" fill="#fff" opacity=".16"/>' + floorG(r, m, 394);
    s += '<rect x="34" y="262" width="10" height="136" rx="2" fill="' + STEEL + '"/><rect x="356" y="262" width="10" height="136" rx="2" fill="' + STEEL + '"/>';
    for (let i = 0; i < 7; i++) { const R = 14 + i * 1.2; s += hex(64 + i * 45.5, 318 - R * 0.86, R); }
    s += '<rect x="28" y="318" width="344" height="9" rx="3" fill="' + STEEL + '"/>';
    for (let i = 0; i < 6; i++) { const R = 21 + i * 1.3; s += hex(70 + i * 52, 386 - R * 0.86, R); }
    s += '<rect x="28" y="386" width="344" height="9" rx="3" fill="' + STEEL + '"/>';
    return s;
  },
  treadmill(r, m) {
    let s = '<rect x="0" y="40" width="400" height="232" fill="' + m.lt + '" opacity=".5"/>';
    for (let i = 0; i < 9; i++) { const w = 26 + r() * 30, h = 20 + r() * 70; s += '<rect x="' + n1(i * 46 + r() * 10) + '" y="' + n1(272 - h) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="#000" opacity=".13"/>'; }
    for (let x = 0; x <= 400; x += 100) s += '<rect x="' + (x - 3) + '" y="40" width="6" height="232" fill="' + STEEL + '" opacity=".85"/>';
    s += '<rect x="0" y="36" width="400" height="7" fill="' + STEEL + '" opacity=".85"/><rect x="0" y="268" width="400" height="7" fill="' + STEEL + '" opacity=".85"/>' + floorG(r, m, 392);
    [0, 190].forEach(o => {
      s += '<rect x="' + (26 + o) + '" y="374" width="156" height="20" rx="9" fill="' + STEEL + '"/><rect x="' + (36 + o) + '" y="374" width="136" height="5" rx="2" fill="#3A4050"/>';
      s += '<path d="M' + (152 + o) + ' 378 L' + (166 + o) + ' 258" stroke="' + STEEL + '" stroke-width="10" stroke-linecap="round"/><path d="M' + (160 + o) + ' 300 L' + (106 + o) + ' 314" stroke="' + STEEL + '" stroke-width="7" stroke-linecap="round"/>';
      s += '<g transform="rotate(-12 ' + (168 + o) + ' 250)"><rect x="' + (140 + o) + '" y="234" width="56" height="32" rx="6" fill="' + STEEL + '"/><rect x="' + (147 + o) + '" y="240" width="42" height="14" rx="3" fill="#7FD6B4" opacity=".9"/></g>';
    });
    return s;
  },
  mat(r, m) {
    const mc = pick(r, ['#6C5CE7', '#1FA971', '#F2542D', '#2F7BFF']);
    let s = beam(60 + r() * 160) + '<rect x="0" y="300" width="400" height="200" fill="#C99C6E"/><rect x="0" y="300" width="400" height="5" fill="#000" opacity=".2"/>';
    for (let y = 334; y < 500; y += 34) s += '<rect x="0" y="' + y + '" width="400" height="1.5" fill="#000" opacity=".1"/>';
    s += '<polygon points="66,444 334,444 302,350 98,350" fill="' + mc + '"/><polygon points="66,444 334,444 331,436 69,436" fill="#000" opacity=".16"/>';
    s += '<rect x="246" y="316" width="44" height="24" rx="4" fill="#8C6FD6"/><rect x="258" y="298" width="44" height="22" rx="4" fill="#A58BE6"/>';
    s += kettle(84, 322, 24) + '<rect x="318" y="282" width="12" height="9" rx="2" fill="#20232B"/><rect x="313" y="290" width="22" height="50" rx="8" fill="#5FB3E8"/><rect x="317" y="296" width="4" height="36" rx="2" fill="#fff" opacity=".4"/>';
    return s;
  },
  court(r) {
    const key = pick(r, ['#2D6BE0', '#E23B32', '#2E9E5B']);
    let s = '<rect width="400" height="500" fill="#D9A766"/>';
    for (let x = 25; x < 400; x += 25) s += '<rect x="' + x + '" y="0" width="1.5" height="500" fill="#000" opacity=".07"/>';
    s += '<rect x="130" y="-4" width="140" height="200" fill="' + key + '" opacity=".6"/>';
    s += '<g fill="none" stroke="#fff" stroke-width="4" opacity=".92"><rect x="130" y="-4" width="140" height="200"/><circle cx="200" cy="196" r="58"/><path d="M40 -4V96A170 170 0 0 0 360 96V-4"/><path d="M-4 5h408"/></g>';
    s += '<rect x="160" y="20" width="80" height="6" rx="2" fill="#fff"/><circle cx="200" cy="46" r="13" fill="none" stroke="#FF6A2B" stroke-width="4"/>';
    const bx = 110 + r() * 180, by = 320 + r() * 110;
    s += '<ellipse cx="' + n1(bx + 6) + '" cy="' + n1(by + 10) + '" rx="24" ry="20" fill="#000" opacity=".2"/><circle cx="' + n1(bx) + '" cy="' + n1(by) + '" r="24" fill="#F07D2A"/>';
    s += '<g fill="none" stroke="#7A3A10" stroke-width="2"><path d="M' + n1(bx - 24) + ' ' + n1(by) + 'h48M' + n1(bx) + ' ' + n1(by - 24) + 'v48"/><path d="M' + n1(bx - 17) + ' ' + n1(by - 17) + 'q17 17 0 34M' + n1(bx + 17) + ' ' + n1(by - 17) + 'q-17 17 0 34"/></g>';
    return s;
  },
  track(r) {
    let s = '<circle cx="' + n1(250 + r() * 80) + '" cy="150" r="46" fill="#FFF4CC" opacity=".92"/>';
    s += '<path d="M0 272Q60 236 120 262T240 250T400 264V310H0z" fill="#2F5D46"/><rect x="0" y="292" width="400" height="208" fill="#3F8F5A"/>';
    s += '<ellipse cx="200" cy="650" rx="340" ry="340" fill="#C5533A"/>';
    for (let k = 1; k < 5; k++) s += '<ellipse cx="200" cy="650" rx="' + (340 - k * 27) + '" ry="' + (340 - k * 27) + '" fill="none" stroke="#fff" stroke-width="2.5" opacity=".8"/>';
    s += '<ellipse cx="200" cy="650" rx="205" ry="205" fill="#3F8F5A"/>';
    return s;
  },
  pool(r) {
    let s = '<rect width="400" height="500" fill="#1F9FD8"/>';
    for (let i = 0; i < 9; i++) { const y = 70 + i * 50 + r() * 16; s += '<path d="M-10 ' + n1(y) + 'q50 ' + n1(-14 - r() * 10) + ' 100 0t100 0t100 0t100 0t100 0" fill="none" stroke="#fff" stroke-width="3" opacity=".15"/>'; }
    [50, 150, 250, 350].forEach(x => { s += '<rect x="' + (x - 4) + '" y="124" width="8" height="380" fill="#0B3C5D" opacity=".55"/><rect x="' + (x - 20) + '" y="116" width="40" height="8" fill="#0B3C5D" opacity=".55"/>'; });
    [100, 200, 300].forEach(x => { s += '<path d="M' + x + ' 44V500" stroke="#fff" stroke-width="7"/><path d="M' + x + ' 44V500" stroke="#E23B32" stroke-width="7" stroke-dasharray="16 16"/>'; });
    s += '<rect width="400" height="46" fill="#E7E3D8"/><rect y="40" width="400" height="6" fill="#000" opacity=".12"/>';
    return s;
  },
  bike(r, m) {
    let s = '<circle cx="300" cy="150" r="130" fill="' + m.lt + '" opacity=".16"/><circle cx="70" cy="110" r="80" fill="#5ED3FF" opacity=".12"/>' + floorG(r, m, 394);
    [0, 172].forEach(o => {
      s += '<rect x="' + (66 + o) + '" y="388" width="176" height="9" rx="4" fill="' + STEEL + '"/>';
      s += '<circle cx="' + (112 + o) + '" cy="340" r="46" fill="#151824" stroke="#3A4050" stroke-width="6"/><circle cx="' + (112 + o) + '" cy="340" r="9" fill="#8D93A3"/>';
      s += '<path d="M' + (112 + o) + ' 340L' + (172 + o) + ' 264L' + (216 + o) + ' 388M' + (178 + o) + ' 270L' + (188 + o) + ' 228M' + (126 + o) + ' 304L' + (114 + o) + ' 234M' + (98 + o) + ' 230h34" fill="none" stroke="' + STEEL + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<rect x="' + (170 + o) + '" y="216" width="42" height="11" rx="5.5" fill="' + STEEL + '"/>';
    });
    return s;
  },
  rig(r, m) {
    let s = beam(80 + r() * 140) + floorG(r, m, 386);
    s += '<rect x="56" y="96" width="14" height="294" rx="3" fill="' + STEEL + '"/><rect x="330" y="96" width="14" height="294" rx="3" fill="' + STEEL + '"/><rect x="38" y="96" width="324" height="10" rx="5" fill="' + CHROME + '"/>';
    [172, 228].forEach(x => { s += '<path d="M' + x + ' 106V238" stroke="#E8D9B5" stroke-width="4"/><circle cx="' + x + '" cy="256" r="18" fill="none" stroke="#D9B36A" stroke-width="6"/>'; });
    s += '<polygon points="284,342 336,342 329,390 291,390" fill="#E9E7E0"/><ellipse cx="310" cy="342" rx="26" ry="6" fill="#fff"/>';
    for (let i = 0; i < 12; i++) s += '<circle cx="' + n1(276 + r() * 70) + '" cy="' + n1(392 + r() * 16) + '" r="' + n1(1 + r() * 2) + '" fill="#fff" opacity=".7"/>';
    return s + kettle(104, 366, 20) + kettle(150, 362, 24);
  }
};
const SCENE_MOODS = {
  rack: ['day', 'amber', 'night', 'mint'], bench: ['day', 'night', 'amber'], dumbbells: ['day', 'mint', 'dawn'],
  treadmill: ['dawn', 'day', 'night'], mat: ['dawn', 'mint', 'amber'], court: ['day'], track: ['dawn', 'amber'],
  pool: ['day'], bike: ['neon', 'night'], rig: ['day', 'amber', 'mint']
};
const TYPE_SCENES = {
  push: ['bench', 'dumbbells'], pull: ['rig', 'dumbbells'], legs: ['rack'], upper: ['dumbbells', 'bench'],
  full: ['rack', 'rig', 'dumbbells'], cardio: ['treadmill', 'bike', 'track'], core: ['mat'],
  sport: ['court', 'pool', 'track'], mobility: ['mat'], other: ['dumbbells', 'rig']
};
function sceneSVG(kind, seed) {
  const r = rng(seed), m = MOODS[pick(r, SCENE_MOODS[kind] || ['day'])];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"><defs>' +
    '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + m.w1 + '"/><stop offset="1" stop-color="' + m.w2 + '"/></linearGradient>' +
    '<radialGradient id="v" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>' +
    '<linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + m.lt + '" stop-opacity=".5"/><stop offset="1" stop-color="' + m.lt + '" stop-opacity="0"/></linearGradient></defs>' +
    '<rect width="400" height="500" fill="url(#w)"/>' + SCENES[kind](r, m) + '<rect width="400" height="500" fill="url(#v)"/></svg>';
}

/* ---- meals, seen from above ---- */
function scatter(r, n, cx, cy, R, fn) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R; s += fn(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r); }
  return s;
}
const dish = '<circle cx="200" cy="200" r="158" fill="#FBFAF6"/><circle cx="200" cy="200" r="120" fill="none" stroke="#000" stroke-opacity=".06" stroke-width="3"/>';
const bowlOf = c => '<circle cx="200" cy="200" r="152" fill="#F4F1EA"/><circle cx="200" cy="200" r="130" fill="' + c + '"/>';
const MEALS = {
  bowl(r) {
    let s = bowlOf('#F3EAD6');
    s += scatter(r, 60, 200, 200, 120, (x, y) => '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="4" ry="2" fill="#fff" opacity=".8"/>');
    s += scatter(r, 16, 150, 160, 52, (x, y, q) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(12 + q() * 8) + '" fill="' + pick(q, ['#5E9E48', '#7DB85C', '#4A8438']) + '"/>');
    s += scatter(r, 8, 256, 170, 40, (x, y, q) => '<rect x="' + n1(x - 12) + '" y="' + n1(y - 12) + '" width="24" height="24" rx="6" fill="' + pick(q, ['#D98A3D', '#C9773B', '#E3A257']) + '" transform="rotate(' + n1(q() * 80) + ' ' + n1(x) + ' ' + n1(y) + ')"/>');
    s += scatter(r, 14, 230, 262, 36, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="7" fill="#3B2A22"/>');
    s += '<path d="M112 250q30 -24 60 0t60 0" fill="none" stroke="#E8642C" stroke-width="6" stroke-linecap="round" opacity=".85"/>';
    return s;
  },
  oats(r) {
    let s = bowlOf(pick(r, ['#E9D7B4', '#FBFBF7']));
    s += scatter(r, 40, 200, 200, 118, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="3" fill="#C9A66B" opacity=".7"/>');
    s += scatter(r, 7, 160, 170, 46, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="13" fill="#C2314B"/><circle cx="' + n1(x - 4) + '" cy="' + n1(y - 4) + '" r="3" fill="#fff" opacity=".4"/>');
    s += scatter(r, 9, 246, 236, 40, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="9" fill="#3C4A8F"/>');
    s += scatter(r, 5, 236, 150, 34, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="16" fill="#F6E3A1"/><circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="6" fill="#E9CF7E"/>');
    return s;
  },
  toast(r) {
    const top = pick(r, [['#9BC26B', '#7FA853'], ['#A8703C', '#8A5A2E']]);
    let s = dish;
    [[-10, 124, 118], [9, 214, 128]].forEach(([rot, x, y]) => {
      s += '<g transform="rotate(' + rot + ' ' + (x + 50) + ' ' + (y + 70) + ')"><rect x="' + x + '" y="' + y + '" width="104" height="144" rx="26" fill="#C98F4F"/><rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="88" height="128" rx="20" fill="#EBC58A"/><rect x="' + (x + 14) + '" y="' + (y + 14) + '" width="76" height="116" rx="16" fill="' + top[0] + '"/>';
      s += scatter(r, 9, x + 52, y + 72, 40, (a, b) => '<circle cx="' + n1(a) + '" cy="' + n1(b) + '" r="3" fill="' + top[1] + '"/>') + '</g>';
    });
    s += scatter(r, 6, 200, 200, 90, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="2.5" fill="#D93A2B"/>');
    return s;
  },
  shake(r) {
    const c = pick(r, ['#E9B7C6', '#C9A27C', '#CFE3B0', '#F1DCA7']);
    let s = '<circle cx="204" cy="208" r="104" fill="#000" opacity=".12"/><circle cx="200" cy="200" r="100" fill="#fff" opacity=".65"/><circle cx="200" cy="200" r="86" fill="' + c + '"/>';
    s += scatter(r, 14, 200, 200, 70, (x, y, q) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(3 + q() * 6) + '" fill="#fff" opacity=".5"/>');
    s += '<rect x="196" y="60" width="16" height="170" rx="8" fill="#E23B32" transform="rotate(24 200 200)"/><rect x="200" y="60" width="4" height="170" rx="2" fill="#fff" opacity=".4" transform="rotate(24 200 200)"/>';
    return s;
  },
  pasta(r) {
    let s = dish;
    for (let i = 0; i < 30; i++) { const a = r() * 360, rr = 30 + r() * 62; s += '<path d="M' + n1(200 - rr) + ' 200a' + n1(rr) + ' ' + n1(rr * 0.55) + ' 0 0 1 ' + n1(rr * 2) + ' 0" fill="none" stroke="' + pick(r, ['#F1CF72', '#EBC35C', '#F5DA8C']) + '" stroke-width="9" stroke-linecap="round" transform="rotate(' + n1(a) + ' 200 200)"/>'; }
    s += '<circle cx="200" cy="196" r="46" fill="#C8402F" opacity=".92"/>' + scatter(r, 12, 200, 196, 40, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="3" fill="#fff" opacity=".8"/>');
    s += '<ellipse cx="186" cy="180" rx="16" ry="8" fill="#3F8A3A" transform="rotate(-30 186 180)"/><ellipse cx="216" cy="204" rx="16" ry="8" fill="#4E9B46" transform="rotate(40 216 204)"/>';
    return s;
  },
  salad(r) {
    let s = bowlOf('#EDF3E2');
    s += scatter(r, 34, 200, 200, 108, (x, y, q) => '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="26" ry="13" fill="' + pick(q, ['#6FAE4E', '#8CC265', '#4E8B3A', '#A4D07A']) + '" transform="rotate(' + n1(q() * 180) + ' ' + n1(x) + ' ' + n1(y) + ')"/>');
    s += scatter(r, 7, 200, 200, 96, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="13" fill="#D93A2B"/><circle cx="' + n1(x - 4) + '" cy="' + n1(y - 4) + '" r="3.5" fill="#fff" opacity=".45"/>');
    s += scatter(r, 7, 200, 200, 90, (x, y, q) => '<rect x="' + n1(x - 9) + '" y="' + n1(y - 9) + '" width="18" height="18" rx="3" fill="#FBFBF5" transform="rotate(' + n1(q() * 90) + ' ' + n1(x) + ' ' + n1(y) + ')"/>');
    s += scatter(r, 5, 200, 200, 90, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="10" fill="none" stroke="#9A4C8F" stroke-width="3"/>');
    return s;
  },
  wrap(r) {
    let s = dish;
    [[-14, 112, 124], [12, 208, 128]].forEach(([rot, x, y]) => {
      s += '<g transform="rotate(' + rot + ' ' + (x + 42) + ' ' + (y + 74) + ')"><rect x="' + x + '" y="' + y + '" width="84" height="150" rx="38" fill="#E8CFA0"/><ellipse cx="' + (x + 42) + '" cy="' + (y + 30) + '" rx="34" ry="22" fill="#F4E4C2"/>';
      s += '<ellipse cx="' + (x + 42) + '" cy="' + (y + 30) + '" rx="26" ry="15" fill="#6FAE4E"/><circle cx="' + (x + 34) + '" cy="' + (y + 28) + '" r="7" fill="#E8642C"/><circle cx="' + (x + 50) + '" cy="' + (y + 33) + '" r="6" fill="#F2B91C"/><circle cx="' + (x + 44) + '" cy="' + (y + 22) + '" r="5" fill="#8A4FA0"/></g>';
    });
    return s + scatter(r, 5, 200, 290, 40, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="2.5" fill="#3F8A3A"/>');
  },
  eggs(r) {
    let s = dish;
    [[158, 170], [226, 214]].forEach(([x, y]) => { s += '<ellipse cx="' + x + '" cy="' + y + '" rx="54" ry="48" fill="#fff" stroke="#EFEBDD" stroke-width="3"/><circle cx="' + (x + 4) + '" cy="' + (y - 2) + '" r="21" fill="#F5B21A"/><circle cx="' + (x - 3) + '" cy="' + (y - 9) + '" r="5" fill="#fff" opacity=".5"/>'; });
    s += '<polygon points="96,268 176,300 108,318" fill="#C98F4F"/><polygon points="104,274 164,298 112,310" fill="#EBC58A"/>';
    s += scatter(r, 4, 280, 140, 30, (x, y) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="13" fill="#D93A2B"/>');
    return s;
  },
  bar(r) {
    const c = pick(r, ['#2F7BFF', '#17936A', '#E23B32', '#6C5CE7']);
    return '<g transform="rotate(-18 200 200)"><rect x="86" y="150" width="228" height="100" rx="14" fill="' + c + '"/><rect x="86" y="182" width="228" height="20" fill="#fff" opacity=".25"/><rect x="60" y="158" width="60" height="84" rx="8" fill="#6B4226"/><rect x="66" y="166" width="48" height="10" rx="4" fill="#8A5A36"/><path d="M118 150l-10 14 10 14-10 14 10 14-10 14 10 16-10 14" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/></g>';
  }
};
function mealSVG(kind, seed) {
  const r = rng(seed), table = pick(r, ['#E6D2B5', '#DAD7CF', '#C9D6CF', '#EBC9B0', '#D6DCE8']);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice"><rect width="400" height="400" fill="' + table + '"/>';
  if (kind !== 'shake' && kind !== 'bar') s += '<circle cx="206" cy="212" r="160" fill="#000" opacity=".13"/>';
  return s + (MEALS[kind] || MEALS.bowl)(r) + '</svg>';
}

const _art = new Map();
function svgURI(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
function sceneURI(kind, seed) { const k = 's' + kind + seed; if (!_art.has(k)) _art.set(k, svgURI(sceneSVG(SCENES[kind] ? kind : 'dumbbells', seed))); return _art.get(k); }
function mealURI(kind, seed) { const k = 'm' + kind + seed; if (!_art.has(k)) _art.set(k, svgURI(mealSVG(kind, seed))); return _art.get(k); }
function sceneFor(type, seed) { const r = rng(seed); return { kind: pick(r, TYPE_SCENES[type] || TYPE_SCENES.other), seed: seed }; }

/* Stand-in for a private progress photo: a mirror and a plain figure. */
function progressURI(i) {
  const k = 'p' + i; if (_art.has(k)) return _art.get(k);
  const m = [MOODS.day, MOODS.mint, MOODS.dawn, MOODS.amber][i % 4], w = 58 + i * 5;
  const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + m.w1 + '"/><stop offset="1" stop-color="' + m.w2 + '"/></linearGradient></defs>' +
    '<rect width="300" height="400" fill="url(#w)"/><rect x="30" y="24" width="240" height="330" rx="10" fill="#fff" opacity=".28"/><polygon points="60,24 120,24 60,354 30,354 30,200" fill="#fff" opacity=".2"/>' +
    '<rect x="0" y="340" width="300" height="60" fill="' + m.fl + '"/>' +
    '<g fill="#1E2647"><circle cx="150" cy="104" r="26"/><rect x="' + (150 - w / 2) + '" y="140" width="' + w + '" height="104" rx="22"/><rect x="' + (150 - w / 2 - 20) + '" y="146" width="18" height="90" rx="9"/><rect x="' + (150 + w / 2 + 2) + '" y="146" width="18" height="90" rx="9"/><rect x="' + (150 - w / 2 + 2) + '" y="236" width="' + (w / 2 - 5) + '" height="112" rx="12"/><rect x="' + (150 + 3) + '" y="236" width="' + (w / 2 - 5) + '" height="112" rx="12"/></g></svg>';
  _art.set(k, svgURI(s)); return _art.get(k);
}
// A check-in with no photo shows the recorded workout instead: minutes, heart rate, active calories.
function statURI(st) {
  const k = 'w' + [st.mins, st.hr, st.kcal, st.type].join('.');
  if (_art.has(k)) return _art.get(k);
  const f = ' font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"', r = rng(st.hr * 31 + st.mins);
  let line = 'M30 436';
  for (let x = 30; x <= 370; x += 17) line += ' L' + x + ' ' + (436 - (x > 110 && x < 320 ? 16 + r() * 34 : r() * 10)).toFixed(0);
  const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g" cx="85%" cy="0%" r="110%"><stop offset="0" stop-color="#2C3C80"/><stop offset="1" stop-color="#12162B"/></radialGradient></defs>' +
    '<rect width="400" height="500" fill="url(#g)"/><path d="' + line + '" fill="none" stroke="#FF5A1F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>' +
    '<text x="34" y="150"' + f + ' font-size="21" font-weight="700" fill="#AEB6D9">Recorded workout, no photo</text>' +
    '<text x="28" y="282"' + f + ' font-size="148" font-weight="800" fill="#fff" letter-spacing="-4">' + st.mins + '</text>' +
    '<text x="34" y="322"' + f + ' font-size="25" font-weight="700" fill="#fff">minutes</text>' +
    '<text x="34" y="352"' + f + ' font-size="19" font-weight="600" fill="#AEB6D9">' + st.hr + ' bpm average, ' + st.kcal + ' active kcal</text></svg>';
  _art.set(k, svgURI(s)); return _art.get(k);
}
