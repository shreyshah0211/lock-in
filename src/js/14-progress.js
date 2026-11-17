/* Progress, one tap down. The numbers on You stay simple; each of them opens
   what is behind it: the sessions, how effort points add up, which parts of the
   body got trained, last month in one screen, and an optional weekly note. */

/* ---- every number opens its sessions ---- */
function sessRow(c) {
  return '<button class="sess" data-a="openSession" data-id="' + c.id + '"><img src="' + imgOf(c) + '" alt=""><span class="grow"><b>' + esc(TYPE[c.type].v) + (c.tag ? '<span class="pill">' + esc(c.tag) + '</span>' : '') + '</b><small>' + dateLong(c.ts) + ', ' + c.mins + ' min, ' + EFFORT[c.effort].toLowerCase() + '</small></span><span class="pts">' + c.pts + '<small>points</small></span></button>';
}
A.openSessions = el => {
  const i = el.dataset.i;
  openSheet(() => {
    const wk = i == null ? null : weeklyTotals(8)[+i], a = wk ? wk.start : now() - 7 * DAY, b = wk ? wk.start + 7 * DAY + 1 : now() + 1;
    const cs = S.checkins.filter(c => c.ts >= a && c.ts < b).sort((x, y) => y.ts - x.ts), d = new Date(a);
    return sheetHead(i == null || +i === 7 ? 'Your last 7 days' : 'Week from ' + MO[d.getMonth()] + ' ' + d.getDate(), { back: true }) + '<div class="sh-b">' +
      '<div class="stats" style="margin:0;grid-template-columns:repeat(3,1fr)"><div><b>' + cs.length + '</b><span>check-ins</span></div><div><b>' + (cs.reduce((x, c) => x + c.mins, 0) / 60).toFixed(1) + '</b><span>hours</span></div><div><b>' + cs.reduce((x, c) => x + c.pts, 0) + '</b><span>effort points</span></div></div>' +
      (cs.length ? '<div class="sesslist">' + cs.map(sessRow).join('') + '</div>' : '<p class="empty">No check-ins in these 7 days.</p>') + '</div>';
  }, { cls: 'full' });
};
// One session: what it was, what backs it, and exactly where its points came from.
function ptsParts(c) {
  const out = [['Showing up', 8], [Math.min(c.mins, 120) + ' minutes, 1 point for every 4', Math.min(c.mins, 120) * .25], [EFFORT[c.effort] + ' effort, 6 a step', c.effort * 6]];
  if (c.nl) out.push([plural(Math.min(c.nl, 6), 'lift') + ' logged, 2 each', Math.min(c.nl, 6) * 2]);
  if (c.pr) out.push(['A new best', 6]);
  if (c.bonus) out.push(['Comeback bonus', c.bonus]);
  return out;
}
A.openSession = el => {
  const id = el.dataset.id;
  openSheet(() => {
    const c = S.checkins.find(x => x.id === id); if (!c) return '';
    const pf = PROOF[proofKey(c)], u = S.settings.units, band = BANDS[level(c.pts) - 1] || BANDS[0];
    return sheetHead(TYPE[c.type].v) + '<div class="sh-b"><div class="prev"><img src="' + imgOf(c) + '" alt=""></div>' +
      '<p class="mute" style="font-size:13.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + dateLong(c.ts) + ' at ' + clock(c.ts) + '<span class="pill">' + ic(pf[1], 13) + pf[0] + '</span>' + (c.tag ? '<span class="pill">' + esc(c.tag) + '</span>' : '') + '</p>' +
      (c.caption ? '<p>' + esc(c.caption) + '</p>' : '') +
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px"><b style="font-size:16px">' + c.pts + ' effort points</b><span class="pill" style="background:' + band[3] + ';color:' + band[4] + '">' + band[0] + ' session</span></div><div class="rows">' +
      ptsParts(c).map(p => '<div class="row" style="padding:9px 0"><div class="grow" style="font-size:14px">' + p[0] + '</div><b class="num" style="font-size:18px">+' + (Math.round(p[1] * 10) / 10) + '</b></div>').join('') + '</div></div>' +
      (c.pr ? '<div class="aicheck ok">' + ic('trend', 18) + 'New best: ' + esc(c.pr.lift) + ' ' + c.pr.w + ' ' + u + '</div>' : '') +
      (c.lifts && c.lifts.length ? '<div class="card" style="padding:6px 16px"><div class="rows">' + c.lifts.map(l => '<div class="row" style="padding:10px 0"><div class="grow">' + esc(l.name) + '</div><span class="mute" style="font-size:13.5px;font-weight:600">' + l.w + ' ' + u + (l.reps ? ', ' + plural(+l.reps, 'rep') : '') + (l.sets ? ', ' + plural(+l.sets, 'set') : '') + '</span></div>').join('') + '</div></div>' : '') + '</div>';
  });
};

/* ---- effort points, explained ---- */
// Session bands share their thresholds and colours with the squares on your grid.
const BANDS = [['Light', 'under 30', 'var(--h1)', '#FFE2A6', '#6B4A00'], ['Solid', '30 to 41', 'var(--h2)', '#FFB648', '#4A2E00'], ['Hard', '42 to 53', 'var(--h3)', '#FF7A1A', '#fff'], ['All out', '54 or more', 'var(--h4)', '#E8321F', '#fff']];
A.openEffortInfo = () => openSheet(() => {
  const ws = weekStats(), cs = checkinsSince(now() - 7 * DAY), delta = d => d > 0 ? 'up ' + d : d < 0 ? 'down ' + (-d) : 'level';
  return sheetHead('Effort points') + '<div class="sh-b">' +
    '<p>A check-in earns 8 points for showing up, 1 for every 4 minutes up to two hours, 6 for each step of how hard it felt, 2 for each lift you log and 6 for a new best.</p>' +
    '<div class="card"><div class="verdict ' + ws.verdict[1] + '">' + ws.verdict[0] + '</div><div class="num" style="font-size:54px">' + ws.pts + '</div><div class="mute" style="font-size:13.5px;margin-top:4px">' + (ws.avg4 ? 'points in the last 7 days. Your usual week is ' + ws.avg4 + ', the average of the four weeks before.' : 'points in the last 7 days. After a few weeks this compares you with your own usual.') + '</div></div>' +
    '<div><h3 class="h2" style="margin-bottom:4px">What one session is worth</h3><p class="mute" style="font-size:13.5px;margin-bottom:10px">The same four steps colour the squares on your grid.</p><div class="bands">' +
    BANDS.map((b, i) => '<div><i style="background:' + b[2] + '"></i><b>' + b[0] + '</b><span>' + b[1] + ' points</span><em>' + cs.filter(c => level(c.pts) === i + 1).length + ' this week</em></div>').join('') + '</div></div>' +
    '<div class="card"><div class="card-k">Intensity</div><div class="num" style="font-size:38px">' + ws.eff + '<span style="font-family:var(--body);font-size:13px;font-weight:600;color:var(--mute);margin-left:5px">points an hour, last 28 days</span></div><p style="font-size:13.5px;margin-top:8px">That is ' + delta(ws.dEff) + ' on the 28 days before. It describes how packed your sessions were. A long easy session lowers it, and that is a fine way to train.</p></div>' +
    '<p class="mute" style="font-size:13px">Points compare you with yourself and rank friends on showing up and effort. Nothing about how anyone looks goes into them.</p></div>';
});

/* ---- which parts of the body got trained ---- */
const REGIONS = [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'], ['core', 'Core'], ['legs', 'Legs']];
const TYPE_REGIONS = { push: { chest: 1, shoulders: 1, arms: 1 }, pull: { back: 1, arms: 1 }, legs: { legs: 1 }, upper: { chest: 1, back: 1, shoulders: 1, arms: 1 }, full: { chest: 1, back: 1, shoulders: 1, arms: 1, core: 1, legs: 1 }, cardio: { legs: .5 }, core: { core: 1 }, sport: { legs: .5, core: .5 }, mobility: {}, other: {} };
function bodyLoad(days) {
  const out = {}; REGIONS.forEach(r => { out[r[0]] = { n: 0, last: null }; });
  checkinsSince(now() - days * DAY).forEach(c => { const w = TYPE_REGIONS[c.type] || {}; Object.keys(w).forEach(k => { out[k].n += w[k]; if (out[k].last == null || c.ts > out[k].last) out[k].last = c.ts; }); });
  // shade each part against the one that got the most work, so the map shows balance rather than volume
  const top = Math.max(...REGIONS.map(r => out[r[0]].n));
  REGIONS.forEach(r => { const o = out[r[0]]; o.lv = o.n > 0 ? Math.max(1, Math.ceil(o.n / top * 4)) : 0; });
  return out;
}
function bodySVG(load) {
  const col = k => 'var(--h' + load[k].lv + ')', r = (k, x, y, w, h, rx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '" style="fill:' + col(k) + '"/>';
  const fig = (dx, back) => '<g transform="translate(' + dx + ' 0)"><circle cx="50" cy="15" r="11" fill="#D5D9E4"/><rect x="45" y="24" width="10" height="9" fill="#D5D9E4"/>' +
    r('shoulders', 17, 31, 26, 17, 8.5) + r('shoulders', 57, 31, 26, 17, 8.5) + r('arms', 9, 47, 13, 60, 6.5) + r('arms', 78, 47, 13, 60, 6.5) +
    (back ? r('back', 29, 33, 42, 58, 11) + r('legs', 31, 94, 18, 108, 9) + r('legs', 51, 94, 18, 108, 9)
      : r('chest', 29, 33, 42, 34, 11) + r('core', 32, 70, 36, 36, 10) + r('legs', 31, 110, 18, 92, 9) + r('legs', 51, 110, 18, 92, 9)) +
    '<text x="50" y="218" text-anchor="middle" font-size="11" font-weight="700" fill="#676D85">' + (back ? 'Back' : 'Front') + '</text></g>';
  return '<svg viewBox="6 2 188 220" role="img" aria-label="Body map of what you trained">' + fig(0, false) + fig(100, true) + '</svg>';
}
function bodyCard() {
  if (checkinsSince(now() - 28 * DAY).length < 3) return '<div class="card"><div class="card-k">What you trained, last 28 days</div><p class="thresh">Check in 3 times and a body map appears here, showing which parts got the work.</p></div>';
  const load = bodyLoad(28);
  return '<div class="card"><div class="card-k">What you trained, last 28 days</div><div class="body">' + bodySVG(load) + '<div class="body-l">' + REGIONS.map(r => { const o = load[r[0]]; return '<div><i style="background:var(--h' + o.lv + ')"></i><b>' + r[1] + '</b><span>' + (o.last == null ? 'Not in 28 days' : plural(Math.max(1, Math.round(o.n)), 'session') + ', ' + ago(o.last)) + '</span></div>'; }).join('') + '</div></div></div>';
}
// The most recent time you beat your own record on any lift.
function latestBest() {
  let out = null;
  Object.keys(S.lifts).forEach(n => { const a = S.lifts[n]; if (a.length < 2) return; const best = Math.max(...a.map(e => e.w)), e = a.find(x => x.w === best); if (!out || e.ts > out.ts) out = { name: n, w: best, ts: e.ts }; });
  return out;
}

/* ---- last month, shown once on Home ---- */
function recapData() {
  const d = new Date(now()), b = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), a0 = new Date(d.getFullYear(), d.getMonth() - 1, 1), a = a0.getTime(), pa = new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime();
  const cs = S.checkins.filter(c => c.ts >= a && c.ts < b); if (!cs.length) return null;
  const prev = S.checkins.filter(c => c.ts >= pa && c.ts < a).length, byType = {}; cs.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1; });
  const top = Object.keys(byType).sort((x, y) => byType[y] - byType[x])[0];
  let lift = null;
  Object.keys(S.lifts).forEach(n => { const arr = S.lifts[n], before = arr.filter(e => e.ts < a), inM = arr.filter(e => e.ts >= a && e.ts < b); if (!before.length || !inM.length) return; const g = Math.max(...inM.map(e => e.w)) - Math.max(...before.map(e => e.w)); if (g > 0 && (!lift || g > lift.g)) lift = { n: n, g: g }; });
  const pts = {}; cs.forEach(c => { const k = new Date(c.ts).getDate(); pts[k] = (pts[k] || 0) + c.pts; });
  return { key: a0.getFullYear() + '-' + (a0.getMonth() + 1), name: MO_FULL[a0.getMonth()], n: cs.length, dn: cs.length - prev, hadPrev: prev > 0, hours: cs.reduce((x, c) => x + c.mins, 0) / 60, pts: cs.reduce((x, c) => x + c.pts, 0), days: Object.keys(pts).length,
    len: Math.round((b - a) / DAY), lead: a0.getDay(), top: top, topN: byType[top], lift: lift, dayPts: pts };
}
function recapCard() {
  const r = recapData(); if (!r || S.ui.recapSeen === r.key) return '';
  return '<section class="detect"><div class="dt-h"><span class="dt-ic">' + ic('calendar', 20) + '</span><div><b>Your ' + r.name + ' recap is ready</b><span>' + plural(r.n, 'check-in') + ' and ' + r.hours.toFixed(1) + ' hours trained.</span></div></div>' +
    '<div class="dt-a"><button class="btn btn-ink" data-a="openRecap">See my ' + r.name + '</button><button class="btn btn-soft" data-a="recapSkip">Not now</button></div></section>';
}
A.recapSkip = () => { const r = recapData(); if (r) S.ui.recapSeen = r.key; save(); render(); };
A.openRecap = () => {
  const r = recapData(); if (!r) { toast('Your first recap arrives when a month with check-ins ends.'); return; }
  S.ui.recapSeen = r.key; save();
  openSheet(() => {
    let cal = ''; for (let i = 0; i < r.lead; i++) cal += '<span></span>';
    for (let k = 1; k <= r.len; k++) cal += '<i class="l' + level(r.dayPts[k] || 0) + '"></i>';
    const dn = !r.hadPrev ? 'Your first full month.' : r.dn > 0 ? r.dn + ' more than the month before.' : r.dn < 0 ? (-r.dn) + ' fewer than the month before.' : 'The same as the month before.';
    return sheetHead(r.name + ' recap', { back: true }) + '<div class="sh-b"><div class="two">' +
      '<div class="tile"><div class="k">Check-ins</div><div class="v">' + r.n + '</div><div class="d">' + dn + '</div></div>' +
      '<div class="tile"><div class="k">Time trained</div><div class="v">' + r.hours.toFixed(1) + '<small>hours</small></div><div class="d">About ' + Math.round(r.hours * 60 / r.n) + ' minutes a session.</div></div>' +
      '<div class="tile"><div class="k">Days you showed up</div><div class="v">' + r.days + '<small>of ' + r.len + '</small></div></div>' +
      '<div class="tile"><div class="k">Effort points</div><div class="v">' + fmtN(r.pts) + '</div></div></div>' +
      '<div class="card"><div class="card-k">' + r.name + ', day by day</div><div class="mcal-h">' + WD.map(w => '<span>' + w[0] + '</span>').join('') + '</div><div class="mcal">' + cal + '</div></div>' +
      '<div class="card" style="padding:6px 16px"><div class="rows"><div class="row" style="padding:12px 0"><div class="grow"><div class="t" style="font-weight:700">Trained most</div><div class="s mute" style="font-size:13px">' + TYPE[r.top].n + ', ' + plural(r.topN, 'session') + '</div></div>' + ic('dumbbell', 20) + '</div>' +
      (r.lift ? '<div class="row" style="padding:12px 0"><div class="grow"><div class="t" style="font-weight:700">Biggest gain</div><div class="s mute" style="font-size:13px">' + esc(r.lift.n) + ', up ' + r.lift.g + ' ' + S.settings.units + '</div></div>' + ic('trend', 20) + '</div>' : '') + '</div></div>' +
      '<p class="mute" style="font-size:13px">A recap shows up on Home once when a month ends. After that it lives on You.</p></div>';
  }, { cls: 'full', onClose: () => render() });
};

/* ---- the weekly note: optional, short, written when you ask for it ---- */
function weekNoteCard() {
  const wn = S.weekNote, cur = wn && wn.wk === weekStart(now());
  return '<div class="card"><p style="font-size:15px">' + weeklyRead().map(esc).join(' ') + '</p>' +
    (cur ? '<p class="wnote">' + ic('sparkle', 16) + '<span>' + esc(wn.text) + '</span></p><div class="wn-f"><span>Written by Claude from your last two weeks.</span><button class="link" data-a="weekNote">Write it again</button></div>'
      : '<button class="btn btn-white btn-s" style="margin-top:12px" data-a="weekNote"' + (D.wnBusy ? ' disabled' : '') + '>' + (D.wnBusy ? '<span class="spin"></span>Writing' : ic('sparkle', 16) + 'Write my weekly note') + '</button>') + '</div>';
}
A.weekNote = async () => {
  if (D.wnBusy) return;
  D.wnBusy = true; render();
  const lines = S.checkins.filter(c => c.ts > now() - 14 * DAY).map(c => Math.floor((now() - c.ts) / DAY) + 'd ago: ' + TYPE[c.type].n + ', ' + c.mins + ' min, ' + EFFORT[c.effort].toLowerCase() + (c.tag ? ', tagged "' + c.tag.toLowerCase() + '"' : '')).join('\n') || 'No sessions in the last 14 days.';
  const r = await aiWeekNote(lines, S.me.goalPerWeek);
  D.wnBusy = false;
  if (r.state === 'ai') { S.weekNote = { wk: weekStart(now()), text: r.note }; save(); }
  else toast('The weekly note needs Claude switched on for this page.');
  softRefresh();
};
