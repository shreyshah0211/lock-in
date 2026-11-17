/* The globe, and the map it opens into.
   Home shows a small turning globe with a dot wherever friends trained in the last
   48 hours. Tapping it grows the globe to the full screen and unrolls it into a flat
   map you can pan, pinch and tap deeper into: region, city, then the gym itself and
   who checked in there.

   What it shows is deliberately narrow. A friend appears at the gym they checked in
   at, after they posted, and only if you follow them. It never shows where anyone is
   right now, and other campuses appear as totals, never as people.

   Everything is drawn on a canvas from the outlines in 18-geodata.js, so it works
   with no map service. The two Seattle lakes are sketched by hand. */
const RAD = Math.PI / 180;
const mercX = lon => (lon + 180) / 360;
const mercY = lat => { const p = clamp(lat, -85, 85) * RAD; return (1 - Math.log(Math.tan(Math.PI / 4 + p / 2)) / Math.PI) / 2; };
// Where the sample gyms and campuses are: [lat, lon, city]
const GYMS = { 'IMA': [47.6536, -122.3012, 'Seattle'], 'Northlake Strength': [47.6512, -122.3352, 'Seattle'], 'Chinook Rec': [46.7365, -117.164, 'Pullman'], 'Rec Center': [44.0437, -123.0735, 'Eugene'] };
const CAMPUS_AT = { UW: [47.6553, -122.3035, 'Seattle'], WSU: [46.7319, -117.1542, 'Pullman'], Oregon: [44.0448, -123.0726, 'Eugene'] };
// Other campuses, as totals for the last 48 hours. Sample numbers, and places only.
const ELSEWHERE = [['Los Angeles', 34.07, -118.44, 412], ['Berkeley', 37.87, -122.26, 288], ['Austin', 30.28, -97.74, 301], ['Ann Arbor', 42.28, -83.74, 266], ['Boston', 42.36, -71.09, 354], ['New York', 40.73, -73.99, 520], ['Toronto', 43.66, -79.4, 233], ['Vancouver', 49.26, -123.25, 160], ['Mexico City', 19.33, -99.18, 118], ['São Paulo', -23.56, -46.73, 95], ['London', 51.52, -0.13, 298], ['Paris', 48.85, 2.34, 141], ['Berlin', 52.51, 13.33, 102], ['Lagos', 6.52, 3.39, 61], ['Delhi', 28.55, 77.19, 187], ['Singapore', 1.3, 103.77, 140], ['Seoul', 37.46, 126.95, 173], ['Tokyo', 35.71, 139.76, 156], ['Sydney', -33.89, 151.19, 122]];
// Names drawn on the map, each from the zoom level where it helps: [name, lat, lon, from zoom, up to zoom, size]
const MAP_LABELS = [['Washington', 47.35, -120.2, 4.9, 8.2, 13], ['Oregon', 43.9, -120.6, 4.9, 8.2, 13], ['Idaho', 44.3, -114.7, 4.9, 8.2, 13], ['British Columbia', 50.6, -123.2, 4.9, 8.2, 13], ['Montana', 46.9, -110.6, 4.9, 8.2, 13], ['California', 40.3, -122.3, 4.9, 8.2, 13],
  ['Portland', 45.52, -122.68, 6.4, 11, 12], ['Spokane', 47.66, -117.43, 6.4, 11, 12], ['Tacoma', 47.25, -122.44, 8, 12, 12], ['Bellevue', 47.61, -122.165, 9.2, 13, 12], ['Everett', 47.98, -122.2, 8, 12, 12],
  ['Lake Washington', 47.615, -122.252, 10.4, 15, 11], ['Lake Union', 47.639, -122.334, 11.6, 15, 11], ['Puget Sound', 47.62, -122.44, 9.2, 13, 11], ['University District', 47.664, -122.314, 11.8, 15, 12], ['Capitol Hill', 47.623, -122.316, 11.8, 15, 12], ['Downtown', 47.607, -122.336, 11.2, 15, 12], ['Fremont', 47.653, -122.352, 12.2, 15, 12]];
// Hand-sketched water, so the city level reads as Seattle. Approximate shorelines, [lon, lat].
const LAKES = [
  [[-122.262, 47.757], [-122.245, 47.757], [-122.225, 47.735], [-122.213, 47.705], [-122.207, 47.676], [-122.203, 47.65], [-122.224, 47.64], [-122.24, 47.632], [-122.228, 47.612], [-122.205, 47.607], [-122.198, 47.585], [-122.19, 47.56], [-122.195, 47.53], [-122.205, 47.505], [-122.218, 47.498], [-122.24, 47.512], [-122.262, 47.522], [-122.258, 47.545], [-122.248, 47.562], [-122.262, 47.556], [-122.285, 47.572], [-122.287, 47.6], [-122.28, 47.622], [-122.276, 47.64], [-122.288, 47.644], [-122.3, 47.647], [-122.297, 47.655], [-122.285, 47.658], [-122.279, 47.655], [-122.277, 47.649], [-122.268, 47.66], [-122.262, 47.672], [-122.25, 47.683], [-122.268, 47.697], [-122.278, 47.718], [-122.28, 47.745]],
  [[-122.34, 47.652], [-122.33, 47.65], [-122.325, 47.645], [-122.327, 47.633], [-122.335, 47.627], [-122.341, 47.63], [-122.342, 47.64], [-122.346, 47.647]],
  [[-122.325, 47.652], [-122.317, 47.653], [-122.315, 47.647], [-122.321, 47.643], [-122.326, 47.646]]
];
const ISLANDS = [[[-122.243, 47.593], [-122.222, 47.597], [-122.205, 47.585], [-122.203, 47.56], [-122.208, 47.535], [-122.225, 47.527], [-122.243, 47.54], [-122.25, 47.565], [-122.25, 47.582]]];
const MAP_C = { sky: '#080B1C', ocean: '#0F1535', land: '#27305F', line: 'rgba(160,172,230,.28)', label: 'rgba(190,198,235,.8)', dot: '#FF5A1F', me: '#3DDC97' };

/* ---- outlines, decoded once ---- */
let _geo = null;
function geo() {
  if (_geo) return _geo;
  const wrap = d => d > 180 ? d - 360 : d < -180 ? d + 360 : d;
  // Longitude is unrolled along each outline, so a shape that crosses the date line stays in one piece on
  // the flat map (x0 and x1 say how far it reaches). An outline that circles a pole is closed along that pole.
  const ring = (pts, closed) => {
    const u = [pts[0][0]]; for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + wrap(pts[i][0] - pts[i - 1][0]));
    let q = pts.map((p, i) => [u[i], p[1]]);
    const turn = closed ? u[u.length - 1] + wrap(pts[0][0] - pts[pts.length - 1][0]) - u[0] : 0;
    if (Math.abs(turn) > 180) { const pole = pts[0][1] < 0 ? -90 : 90; q = q.concat([[u[0] + turn, pts[0][1]], [u[0] + turn, pole], [u[0], pole]]); }
    const n = q.length, o = { n: n, mx: new Float32Array(n), my: new Float32Array(n), lr: new Float32Array(n), sl: new Float32Array(n), cl: new Float32Array(n), x0: 9, x1: -9 };
    q.forEach((p, i) => { o.mx[i] = mercX(p[0]); o.my[i] = mercY(p[1]); o.lr[i] = p[0] * RAD; o.sl[i] = Math.sin(p[1] * RAD); o.cl[i] = Math.cos(p[1] * RAD); o.x0 = Math.min(o.x0, o.mx[i]); o.x1 = Math.max(o.x1, o.mx[i]); });
    return o;
  };
  const unpack = (list, q, closed) => list.map(r => { const pts = []; let x = 0, y = 0; for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; pts.push([x / q, y / q]); } return ring(pts, closed); });
  // round the corners of the hand-sketched water (each pass cuts every corner once)
  const soft = pts => { for (let n = 0; n < 3; n++) { const o = []; pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }); pts = o; } return pts; };
  // lines of latitude and longitude, every 20 degrees: they show the globe turning and the map unrolling
  const grat = [];
  for (let lon = -180; lon <= 180; lon += 20) { const pts = []; for (let lat = -80; lat <= 80; lat += 4) pts.push([lon, lat]); grat.push(ring(pts, false)); }
  for (let lat = -80; lat <= 80; lat += 20) { const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push([lon, lat]); grat.push(ring(pts, false)); }
  const land = unpack(GEO.land.r, GEO.land.q, true);
  _geo = { land: land, east: land.filter(r => r.x1 > 1), west: land.filter(r => r.x0 < 0), mid: unpack(GEO.mid.r, GEO.mid.q, true), hi: unpack(GEO.hi.r, GEO.hi.q, true), borders: unpack(GEO.borders.l, GEO.borders.q, false), lakes: LAKES.map(l => ring(soft(l), true)), islands: ISLANDS.map(l => ring(soft(l), true)), grat: grat };
  return _geo;
}

/* ---- who trained where ---- */
// One entry per gym: the friends you follow (and you) whose latest check-in there is under 48 hours old.
function mapPlaces() {
  const by = {}, add = (p, mine) => {
    if (!p.lastCheckin || now() - p.lastCheckin > WINDOW) return;
    const at = GYMS[p.gym] || CAMPUS_AT[p.campus]; if (!at) return;
    const k = GYMS[p.gym] ? p.gym : p.campus, o = by[k] || (by[k] = { name: GYMS[p.gym] ? p.gym : p.gym || p.campus, city: at[2], lat: at[0], lon: at[1], people: [], me: false });
    o.people.push(p.id); if (mine) o.me = true;
  };
  following().forEach(f => add(f, false)); add(S.me, true);
  return Object.keys(by).map(k => by[k]).sort((a, b) => b.people.length - a.people.length);
}
function globeCard() {
  const pl = mapPlaces(), n = pl.reduce((a, p) => a + p.people.filter(id => id !== 'me').length, 0);
  const line = n ? plural(n, 'friend') + ' at ' + plural(pl.length, 'gym') + ' in the last 48 hours' : pl.length ? 'Your last check-in is on the map. Friends you follow show up here too.' : 'Nobody you follow has checked in in the last 48 hours';
  return '<div class="pad" style="margin-top:14px"><button class="gcard" data-a="openMap"><span class="gc-t"><b>Where friends trained</b><span>' + line + '</span><em>' + ic('pin', 15) + 'Open the map</em></span><canvas id="mini-globe" aria-hidden="true"></canvas></button></div>';
}

/* ---- drawing ----
   One painter does the globe, the flat map and every frame in between. P.t runs from
   0 (globe) to 1 (flat), and each point is drawn part-way between its place on the
   globe and its place on the map. Points on the far side of the globe sit on its rim. */
function mapPaint(ctx, P) {
  const G = geo(), e = P.t, ge = 1 - e, Wz = 256 * Math.pow(2, P.z), ox = P.w / 2 - P.mx * Wz, oy = P.h / 2 - P.my * Wz;
  const l0 = P.glon * RAD, sp0 = Math.sin(P.glat * RAD), cp0 = Math.cos(P.glat * RAD);
  // a point of a ring, by index (k shifts it a whole world sideways on the flat map). Returns whether it is on the near side.
  const px = (r, i, out, k) => {
    if (e >= 1) { out[0] = ox + (r.mx[i] + k) * Wz; out[1] = oy + r.my[i] * Wz; return true; }
    const dl = r.lr[i] - l0, cdl = Math.cos(dl), cl = r.cl[i], sl = r.sl[i], near = sp0 * sl + cp0 * cl * cdl >= 0;
    let x = cl * Math.sin(dl), y = cp0 * sl - sp0 * cl * cdl;
    if (!near) { const d = Math.hypot(x, y) || 1e-9; x /= d; y /= d; }
    out[0] = (P.gx + P.R * x) * ge + (ox + r.mx[i] * Wz) * e; out[1] = (P.gy - P.R * y) * ge + (oy + r.my[i] * Wz) * e;
    return near;
  };
  const tmp = [0, 0], trace = (rings, close, k) => { ctx.beginPath(); for (const r of rings) { px(r, 0, tmp, k || 0); ctx.moveTo(tmp[0], tmp[1]); for (let i = 1; i < r.n; i++) { px(r, i, tmp, k || 0); ctx.lineTo(tmp[0], tmp[1]); } if (close) ctx.closePath(); } };
  // thin lines: the near side first, then the far side, which only shows as the globe unrolls
  const lines = (rings, alpha) => {
    ctx.lineWidth = 1;
    for (let far = 0; far < 2; far++) {
      const a = far ? alpha * e : alpha; if (a < .004 || (far && e >= 1)) continue;
      ctx.strokeStyle = 'rgba(170,186,255,' + a.toFixed(3) + ')'; ctx.beginPath();
      for (const r of rings) { let pn = px(r, 0, tmp, 0), x0 = tmp[0], y0 = tmp[1]; for (let i = 1; i < r.n; i++) { const n = px(r, i, tmp, 0); if ((pn || n) !== !!far) { ctx.moveTo(x0, y0); ctx.lineTo(tmp[0], tmp[1]); } x0 = tmp[0]; y0 = tmp[1]; pn = n; } }
      ctx.stroke();
    }
  };
  // any place, by latitude and longitude: [x, y, on the near side]
  const at = (lat, lon) => {
    const fx = ox + mercX(lon) * Wz, fy = oy + mercY(lat) * Wz; if (e >= 1) return [fx, fy, true];
    const dl = lon * RAD - l0, sl = Math.sin(lat * RAD), cl = Math.cos(lat * RAD), cdl = Math.cos(dl), near = sp0 * sl + cp0 * cl * cdl > 0.05;
    return [(P.gx + P.R * cl * Math.sin(dl)) * ge + fx * e, (P.gy - P.R * (cp0 * sl - sp0 * cl * cdl)) * ge + fy * e, near || e > .6];
  };
  ctx.clearRect(0, 0, P.w, P.h);
  if (P.bg > 0) { ctx.globalAlpha = P.bg; ctx.fillStyle = MAP_C.sky; ctx.fillRect(0, 0, P.w, P.h); ctx.globalAlpha = 1; }
  if (e > 0) { ctx.globalAlpha = e * (P.bg || 1); ctx.fillStyle = MAP_C.ocean; ctx.fillRect(0, 0, P.w, P.h); ctx.globalAlpha = 1; }
  if (e < 1) {   // the sphere: a soft glow around it, then the lit ocean
    const R = P.R * (1 + e * 1.6), glow = ctx.createRadialGradient(P.gx, P.gy, R * .86, P.gx, P.gy, R * 1.22);
    glow.addColorStop(0, 'rgba(88,120,255,.42)'); glow.addColorStop(1, 'rgba(88,120,255,0)');
    ctx.globalAlpha = ge; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(P.gx, P.gy, R * 1.22, 0, 7); ctx.fill();
    const sea = ctx.createRadialGradient(P.gx - R * .35, P.gy - R * .4, R * .1, P.gx, P.gy, R);
    sea.addColorStop(0, '#22308A'); sea.addColorStop(1, '#0D1338');
    ctx.fillStyle = sea; ctx.beginPath(); ctx.arc(P.gx, P.gy, R, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  // land is brighter on the lit globe and settles to the map's tone as it flattens
  ctx.fillStyle = e >= 1 ? MAP_C.land : 'rgb(' + Math.round(mix(64, 39, e)) + ',' + Math.round(mix(80, 48, e)) + ',' + Math.round(mix(158, 95, e)) + ')';
  trace(G.land, true); ctx.fill('evenodd');
  if (e >= 1) { trace(G.east, true, -1); ctx.fill(); trace(G.west, true, 1); ctx.fill(); }   // the parts that reach past the date line
  const ga = P.mini ? .13 : e >= 1 ? .075 * clamp(4.4 - P.z, 0, 1) : mix(.17, .075, e);
  if (ga > 0) lines(G.grat, ga);
  if (e >= 1) {
    const box = (b, rings) => { const x0 = ox + mercX(b[0]) * Wz, x1 = ox + mercX(b[2]) * Wz, y0 = oy + mercY(b[3]) * Wz, y1 = oy + mercY(b[1]) * Wz; ctx.fillStyle = MAP_C.ocean; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.fillStyle = MAP_C.land; trace(rings, true); ctx.fill('evenodd'); };
    if (P.z >= 4.4) box(GEO.mid.box, G.mid);       // finer coastline for the Pacific Northwest
    if (P.z >= 7.6) box(GEO.hi.box, G.hi);         // and finer again around Seattle
    if (P.z >= 8.6) { ctx.fillStyle = MAP_C.ocean; trace(G.lakes, true); ctx.fill(); ctx.fillStyle = MAP_C.land; trace(G.islands, true); ctx.fill(); }
    if (P.z >= 4.4) { ctx.strokeStyle = MAP_C.line; ctx.lineWidth = 1; trace(G.borders, false); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = MAP_C.label;
    MAP_LABELS.forEach(L => { if (P.z < L[3] || P.z >= L[4]) return; const p = at(L[1], L[2]); if (p[0] < -60 || p[0] > P.w + 60 || p[1] < (P.top || 0) || p[1] > (P.bot || P.h) - 10) return; ctx.font = '600 ' + L[5] + 'px Figtree,system-ui,sans-serif'; ctx.fillText(L[0], p[0], p[1]); });
  }
  // other campuses: small pale dots, named once there is room
  P.hits = [];
  ELSEWHERE.forEach(c => {
    const p = at(c[1], c[2]); if (!p[2]) return;
    ctx.fillStyle = 'rgba(214,222,255,' + (P.mini ? .55 : .7) + ')'; ctx.beginPath(); ctx.arc(p[0], p[1], P.mini ? 1.6 : 3.2, 0, 7); ctx.fill();
    if (e >= 1) { P.hits.push({ x: p[0], y: p[1], r: 18, else: c }); if (P.z >= 3.1 && p[1] > (P.top || 0) && p[1] < (P.bot || P.h) - 22) { ctx.font = '600 11px Figtree,system-ui,sans-serif'; ctx.fillStyle = 'rgba(190,198,235,.7)'; ctx.textAlign = 'center'; ctx.fillText(c[0], p[0], p[1] + 12); } }
  });
  // friends: gyms that sit close together on screen are drawn as one dot until you go deeper
  const groups = [];
  (P.places || []).forEach(pl => { const p = at(pl.lat, pl.lon); if (!p[2]) return; const g = groups.find(q => Math.hypot(q.x - p[0], q.y - p[1]) < (P.mini ? 10 : 44)); if (g) { g.places.push(pl); g.n += pl.people.length; g.x = (g.x * (g.places.length - 1) + p[0]) / g.places.length; g.y = (g.y * (g.places.length - 1) + p[1]) / g.places.length; } else groups.push({ x: p[0], y: p[1], places: [pl], n: pl.people.length }); });
  groups.forEach(g => {
    const r = P.mini ? 3.4 : 12 + Math.min(7, g.n * .9), pulse = P.mini || e < 1 ? 1 + .35 * Math.sin((P.time || 0) / 420) : 1;
    const halo = ctx.createRadialGradient(g.x, g.y, r * .4, g.x, g.y, r * 2.6 * pulse); halo.addColorStop(0, 'rgba(255,110,40,.55)'); halo.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(g.x, g.y, r * 2.6 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = MAP_C.dot; ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, 7); ctx.fill();
    if (P.mini) return;
    if (g.places.some(p => p.me)) { ctx.strokeStyle = MAP_C.me; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(g.x, g.y, r + 3.5, 0, 7); ctx.stroke(); }
    if (P.sel && g.places.some(p => P.sel.includes(p.name))) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, r + 8, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + (r > 15 ? 15 : 13) + 'px Figtree,system-ui,sans-serif'; ctx.fillText(g.n, g.x, g.y + .5);
    if (e >= 1) {
      const cities = g.places.map(p => p.city).filter((c, i, a) => a.indexOf(c) === i), name = g.places.length === 1 ? g.places[0].name : cities.length === 1 ? cities[0] : plural(g.places.length, 'gym');
      ctx.font = '700 12.5px Figtree,system-ui,sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,11,28,.85)'; ctx.strokeText(name, g.x, g.y + r + 13); ctx.fillStyle = '#fff'; ctx.fillText(name, g.x, g.y + r + 13);
      P.hits.push({ x: g.x, y: g.y, r: r + 14, group: g, name: name });
    }
  });
}
function mapCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [ctx, w, h];
}
const noMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* ---- the small globe on Home ---- */
const MINI = { cx: .6, cy: .78, r: .74, raf: 0, last: 0 };   // centre and radius as fractions of the canvas, so the globe runs off the card's edge
function miniView(t) { return { glon: -112 + 15 * Math.sin(t / 5200), glat: 36 + 4 * Math.sin(t / 7900) }; }
function miniDraw(t) {
  const cv = $('#mini-globe'); if (!cv || !cv.clientWidth) return false;
  const [ctx, w, h] = mapCanvas(cv), v = miniView(noMotion() ? 0 : t);
  mapPaint(ctx, { w: w, h: h, t: 0, z: 1, mx: .5, my: .5, gx: w * MINI.cx, gy: h * MINI.cy, R: h * MINI.r, glon: v.glon, glat: v.glat, places: mapPlaces(), mini: true, time: t, bg: 0 });
  return true;
}
// Called after every render: draw at once (so a redraw never flashes), then keep it turning while Home is in view.
function globeMini() {
  if (!miniDraw(performance.now()) || MINI.raf || noMotion()) return;
  const loop = t => {
    MINI.raf = 0;
    if (!$('#mini-globe')) return;                       // left Home: stop until the next render
    if (!sheets.length && !document.hidden && t - MINI.last > 32) { MINI.last = t; miniDraw(t); }
    MINI.raf = requestAnimationFrame(loop);
  };
  MINI.raf = requestAnimationFrame(loop);
}

/* ---- the full-screen map ---- */
const M = { t: 0, mx: .5, my: .5, z: 2, anim: null, sel: null, card: null, from: null, ptrs: {}, moved: 0, hits: [], raf: 0, hint: true };
const easeIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, easeOut = x => 1 - Math.pow(1 - x, 3), mix = (a, b, k) => a + (b - a) * k;
// The flat map stops at 78 north and 58 south, so the stretched polar ends never fill the screen.
const MAP_N = mercY(78), MAP_S = mercY(-58);
function mapZoomMin(w, h) { return Math.log2(Math.max(w, h / (MAP_S - MAP_N)) / 256); }
function mapClamp(w, h) {
  M.z = clamp(M.z, mapZoomMin(w, h), 14.5);
  const Wz = 256 * Math.pow(2, M.z), hx = w / 2 / Wz, hy = h / 2 / Wz;
  M.mx = hx >= .5 ? .5 : clamp(M.mx, hx, 1 - hx); M.my = 2 * hy >= MAP_S - MAP_N ? (MAP_N + MAP_S) / 2 : clamp(M.my, MAP_N + hy, MAP_S - hy);
}
// How much of the screen the card at the bottom covers, so dots and names can keep clear of it.
function mapCardH() { const c = $('#map-card'); return c && M.card ? c.offsetHeight + 14 : 0; }
// The zoom that fits a set of places, with room around them.
function mapFit(places, w, h, cap) {
  const xs = places.map(p => mercX(p.lon)), ys = places.map(p => mercY(p.lat)), dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
  const z = Math.min(dx ? Math.log2(Math.max(120, w - 150) / 256 / dx) : 99, dy ? Math.log2(Math.max(120, h - 190 - mapCardH()) / 256 / dy) : 99);
  return { mx: (Math.max(...xs) + Math.min(...xs)) / 2, my: (Math.max(...ys) + Math.min(...ys)) / 2, z: Math.min(z, cap) };
}
function mapFrame(t) {
  M.raf = 0;
  const cv = $('#map-cv'); if (!cv) { M.anim = null; return; }
  const [ctx, w, h] = mapCanvas(cv), a = M.anim, big = { x: w / 2, y: h * .43, r: Math.min(w, h) * .4 }, from = M.from || big;
  let g = 1, view = miniView(0), done = !a;
  if (a) {
    const k = clamp((t - a.t0) / a.dur, 0, 1); done = k >= 1;
    if (a.kind === 'open') { g = easeOut(Math.min(1, k / .46)); M.t = easeIO(clamp((k - .3) / .7, 0, 1)); view = { glon: mix(a.v.glon, -118, g), glat: mix(a.v.glat, 42, g) }; }
    else if (a.kind === 'close') { g = 1 - easeIO(clamp((k - .5) / .5, 0, 1)); M.t = 1 - easeIO(Math.min(1, k / .62)); view = { glon: mix(a.v.glon, -118, g), glat: mix(a.v.glat, 42, g) }; }
    else { const q = easeIO(k); M.mx = mix(a.a.mx, a.b.mx, q); M.my = mix(a.a.my, a.b.my, q); M.z = mix(a.a.z, a.b.z, q) - (a.hop || 0) * Math.sin(Math.PI * q); }
  }
  mapClamp(w, h);
  const P = { w: w, h: h, t: M.t, z: M.z, mx: M.mx, my: M.my, gx: mix(from.x, big.x, g), gy: mix(from.y, big.y, g), R: mix(from.r, big.r, g), glon: view.glon, glat: view.glat, places: mapPlaces(), sel: M.sel, time: t, bg: Math.min(1, g * 1.8), top: 66, bot: h - mapCardH() };
  mapPaint(ctx, P); M.hits = P.hits;
  if (done) {
    M.anim = null;
    if (a && a.kind === 'close') { M.t = 0; closeSheet(); return; }
    if (a && a.kind === 'open') { const ui = $('#map-ui'); if (ui) ui.classList.add('on'); }
    if (a && a.then) a.then();
    return;
  }
  M.raf = requestAnimationFrame(mapFrame);
}
function mapKick() { if (!M.raf) M.raf = requestAnimationFrame(mapFrame); }
function mapFly(to, then) {
  const a = { mx: M.mx, my: M.my, z: M.z }, far = Math.hypot(to.mx - a.mx, to.my - a.my) * 256 * Math.pow(2, Math.min(a.z, to.z));
  if (noMotion()) { M.mx = to.mx; M.my = to.my; M.z = to.z; M.anim = null; mapKick(); if (then) then(); return; }
  M.anim = { kind: 'fly', a: a, b: to, t0: performance.now(), dur: 620 + Math.min(500, far * .5), hop: far > 500 ? .7 : 0, then: then }; mapKick();
}
function mapCardHTML() {
  const c = M.card; if (!c) return M.hint ? '<p class="map-hint">' + (mapPlaces().length ? 'Tap a dot to go deeper. Pinch or scroll to zoom.' : 'No check-ins to show yet. Pinch or scroll to look around.') + '</p>' : '';
  if (c.else) return '<div class="map-card"><div class="mc-h"><b>' + esc(c.else[0]) + '</b><button class="mc-x" data-a="mapClear" aria-label="Hide this card">' + ic('x', 18) + '</button></div><p><span class="num" style="font-size:34px">' + fmtN(c.else[3]) + '</span> check-ins in the last 48 hours.</p><p class="mc-n">A sample total for squads on campuses there. Other campuses show as totals. People are never shown.</p></div>';
  const places = mapPlaces().filter(p => c.names.includes(p.name));
  const rows = places.map(pl => (places.length > 1 ? '<div class="mc-g">' + esc(pl.name) + '</div>' : '') + pl.people.map(id => {
    const u = person(id), post = S.posts.find(p => p.uid === id); if (!u) return '';
    return '<button class="row" data-a="openProfile" data-id="' + id + '">' + av(u, 40, { nowarn: true, dark: true }) + '<span class="grow"><span class="t">' + esc(id === 'me' ? 'You' : u.name) + '</span><span class="s">' + (post ? esc(TYPE[post.type].v) + ', ' : '') + ago(u.lastCheckin) + '</span></span>' + streakChip(pDays(u)) + '</button>';
  }).join('')).join('');
  return '<div class="map-card"><div class="mc-h"><b>' + esc(c.title) + '</b><button class="mc-x" data-a="mapClear" aria-label="Hide this card">' + ic('x', 18) + '</button></div><div class="mc-list">' + rows + '</div><p class="mc-n">The gym each friend checked in at, after they posted. Never where anyone is right now.' + (S.mode === 'real' ? ' Friends are still samples.' : '') + '</p></div>';
}
function mapSheet() {
  return '<div class="mapw"><canvas id="map-cv" aria-label="Map of where your friends trained in the last 48 hours"></canvas><div id="map-ui" class="' + (M.t >= 1 ? 'on' : '') + '">' +
    '<div class="map-top"><button class="cam-txt" data-a="mapClose">' + ic('x', 20) + 'Close</button><span class="cam-pill">' + ic('clock', 15) + '<span>Last 48 hours</span></span></div>' +
    '<div class="map-zoom"><button data-a="mapZoom" data-d="1" aria-label="Zoom in">' + ic('plus', 20) + '</button><button data-a="mapZoom" data-d="-1" aria-label="Zoom out">' + ic('minus', 20) + '</button><button data-a="mapWorld" aria-label="Show the whole world">' + ic('target', 20) + '</button></div>' +
    '<div id="map-card">' + mapCardHTML() + '</div></div></div>';
}
A.openMap = () => {
  if (S.ui.tab !== 'home') { S.ui.tab = 'home'; render(); }
  const mini = $('#mini-globe'), ph = $('#phone').getBoundingClientRect(), now0 = performance.now(), v = miniView(noMotion() ? 0 : now0);
  if (mini && mini.clientWidth) { const r = mini.getBoundingClientRect(); M.from = { x: r.left - ph.left + r.width * MINI.cx, y: r.top - ph.top + r.height * MINI.cy, r: r.height * MINI.r }; } else M.from = null;
  const pl = mapPlaces(), fit = pl.length ? mapFit(pl, ph.width, ph.height, 5.3) : { mx: mercX(-98), my: mercY(40), z: 3 };
  M.mx = fit.mx; M.my = fit.my; M.z = Math.max(fit.z, 2.6); M.sel = null; M.card = null; M.t = noMotion() ? 1 : 0; M.ptrs = {};
  M.anim = noMotion() ? null : { kind: 'open', t0: now0, dur: 1450, v: v };
  openSheet(mapSheet, { cls: 'full dark map', after: () => mapKick(), onClose: () => { M.anim = null; M.t = 0; } });
};
// Close the way it opened: the map rolls back into a globe and settles into its card.
A.mapClose = () => { if (noMotion() || M.t < 1) { closeSheet(); return; } const ui = $('#map-ui'); if (ui) ui.classList.remove('on'); M.card = null; M.sel = null; M.anim = { kind: 'close', t0: performance.now(), dur: 1000, v: miniView(performance.now()) }; mapKick(); };
A.mapZoom = el => { const cv = $('#map-cv'); if (!cv) return; mapFly({ mx: M.mx, my: M.my, z: clamp(M.z + (+el.dataset.d) * 1.4, mapZoomMin(cv.clientWidth, cv.clientHeight), 14.5) }); };
A.mapWorld = () => { const cv = $('#map-cv'); if (!cv) return; M.card = null; M.sel = null; mapCardShow(); mapFly({ mx: M.mx, my: (MAP_N + MAP_S) / 2, z: mapZoomMin(cv.clientWidth, cv.clientHeight) }); };
A.mapClear = () => { M.card = null; M.sel = null; mapCardShow(); mapKick(); };
function mapCardShow() { const c = $('#map-card'); if (c) c.innerHTML = mapCardHTML(); }
// A tap on a dot goes one level deeper: region, then city, then the gym and who was there.
function mapTap(x, y) {
  const hit = M.hits.filter(h => Math.hypot(h.x - x, h.y - y) <= h.r).sort((a, b) => (a.else ? 1 : 0) - (b.else ? 1 : 0) || Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  const cv = $('#map-cv'), w = cv.clientWidth, h = cv.clientHeight; M.hint = false;
  if (!hit) { if (M.card) A.mapClear(); return; }
  const lift = () => Math.max(0, (mapCardH() - 60) / 2);   // how far above the middle of the screen the dot should sit
  if (hit.else) { M.sel = null; M.card = { else: hit.else }; mapCardShow(); mapFly({ mx: mercX(hit.else[2]), my: mercY(hit.else[1]) + lift() / (256 * Math.pow(2, Math.max(M.z, 4.6))), z: Math.max(M.z, 4.6) }); return; }
  const g = hit.group, single = g.places.length === 1;
  M.sel = g.places.map(p => p.name); M.card = { title: hit.name + (single ? ', ' + g.places[0].city : ''), names: M.sel }; mapCardShow();
  const fit = mapFit(g.places, w, h, 13.4);
  // several gyms under one dot: zoom until they separate. One gym: go in close.
  const z = single ? Math.max(M.z, Math.min(13.4, M.z + 3.2)) : Math.max(M.z + 1.2, Math.min(fit.z, M.z + 4.5));
  mapFly({ mx: fit.mx, my: fit.my + lift() / (256 * Math.pow(2, z)), z: z });
}
// Dragging pans, two fingers pinch, the wheel zooms about the pointer.
document.addEventListener('pointerdown', e => {
  if (e.target.id !== 'map-cv' || M.t < 1) return;
  try { e.target.setPointerCapture(e.pointerId); } catch (err) { }
  M.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; M.moved = 0; M.anim = null;
});
document.addEventListener('pointermove', e => {
  const p = M.ptrs[e.pointerId], cv = $('#map-cv'); if (!p || !cv) return;
  const ids = Object.keys(M.ptrs), Wz = 256 * Math.pow(2, M.z), r = cv.getBoundingClientRect(), w = r.width, h = r.height;
  if (ids.length === 1) { M.mx -= (e.clientX - p.x) / Wz; M.my -= (e.clientY - p.y) / Wz; M.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); }
  else if (ids.length === 2) {
    const o = M.ptrs[ids.find(i => +i !== e.pointerId)], d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y), cx = (e.clientX + o.x) / 2 - r.left, cy = (e.clientY + o.y) / 2 - r.top;
    if (d0 > 0 && d1 > 0) { const ux = M.mx + (cx - w / 2) / Wz, uy = M.my + (cy - h / 2) / Wz; M.z = clamp(M.z + Math.log2(d1 / d0), mapZoomMin(w, h), 14.5); const W2 = 256 * Math.pow(2, M.z); M.mx = ux - (cx - w / 2) / W2; M.my = uy - (cy - h / 2) / W2; }
    M.moved += 10;
  }
  p.x = e.clientX; p.y = e.clientY; mapKick();
});
const mapUp = e => {
  const p = M.ptrs[e.pointerId]; if (!p) return;
  const single = Object.keys(M.ptrs).length === 1; delete M.ptrs[e.pointerId];
  const cv = $('#map-cv'); if (!cv || e.type === 'pointercancel') return;
  if (single && M.moved < 8) { const r = cv.getBoundingClientRect(); mapTap(e.clientX - r.left, e.clientY - r.top); }
};
document.addEventListener('pointerup', mapUp); document.addEventListener('pointercancel', mapUp);
document.addEventListener('wheel', e => {
  if (!e.target || e.target.id !== 'map-cv' || M.t < 1) return;
  e.preventDefault();
  const cv = e.target, r = cv.getBoundingClientRect(), w = r.width, h = r.height, cx = e.clientX - r.left, cy = e.clientY - r.top, Wz = 256 * Math.pow(2, M.z), ux = M.mx + (cx - w / 2) / Wz, uy = M.my + (cy - h / 2) / Wz;
  M.anim = null; M.z = clamp(M.z - e.deltaY * .0035, mapZoomMin(w, h), 14.5);
  const W2 = 256 * Math.pow(2, M.z); M.mx = ux - (cx - w / 2) / W2; M.my = uy - (cy - h / 2) / W2; mapKick();
}, { passive: false });
window.addEventListener('resize', () => { if ($('#map-cv')) mapKick(); });
