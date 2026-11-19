/* You: your card, workout progress, the grid, lifts, and a short menu. Every number opens what is behind it. */
function badgeShape(sh, color) {
  const p = { circle: '<circle cx="30" cy="30" r="26"/>', hex: '<polygon points="30,3 53.4,16.5 53.4,43.5 30,57 6.6,43.5 6.6,16.5"/>', shield: '<path d="M30 3 53 11v19c0 13-9.5 22-23 27C16.5 52 7 43 7 30V11z"/>', star: '<polygon points="30,2 37.7,11.4 49.8,10.2 48.6,22.3 58,30 48.6,37.7 49.8,49.8 37.7,48.6 30,58 22.3,48.6 10.2,49.8 11.4,37.7 2,30 11.4,22.3 10.2,10.2 22.3,11.4"/>' }[sh];
  return '<svg class="shape" viewBox="0 0 60 60" fill="' + color + '" aria-hidden="true">' + p + '</svg>';
}
function spark(vals, w, h) {
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  const pts = vals.map((v, i) => (i / (vals.length - 1) * (w - 8) + 4).toFixed(1) + ',' + (h - 4 - (v - mn) / sp * (h - 8)).toFixed(1));
  const last = pts[pts.length - 1].split(',');
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--go)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.4" fill="var(--go)"/></svg>';
}
function lineChart(entries) {
  const W = 340, H = 170, L = 38, R = 12, T = 14, B = 26, vals = entries.map(e => e.w);
  let mn = Math.min(...vals), mx = Math.max(...vals); const padv = Math.max(5, (mx - mn) * .15); mn = Math.floor((mn - padv) / 5) * 5; mx = Math.ceil((mx + padv) / 5) * 5;
  const t0 = entries[0].ts, t1 = entries[entries.length - 1].ts, x = ts => L + (t1 === t0 ? .5 : (ts - t0) / (t1 - t0)) * (W - L - R), y = v => T + (1 - (v - mn) / (mx - mn || 1)) * (H - T - B);
  const pts = entries.map(e => x(e.ts).toFixed(1) + ',' + y(e.w).toFixed(1)), lastE = entries[entries.length - 1];
  let grid = '';
  [mn, (mn + mx) / 2, mx].forEach(v => { grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#DADDE7" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#676D85" font-weight="600">' + Math.round(v) + '</text>'; });
  const d0 = new Date(t0), d1 = new Date(t1);
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Progress chart">' + grid +
    '<polygon points="' + x(t0).toFixed(1) + ',' + (H - B) + ' ' + pts.join(' ') + ' ' + x(t1).toFixed(1) + ',' + (H - B) + '" fill="var(--go)" opacity=".12"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--go)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    entries.map(e => '<circle cx="' + x(e.ts).toFixed(1) + '" cy="' + y(e.w).toFixed(1) + '" r="2.6" fill="#fff" stroke="var(--go)" stroke-width="2"/>').join('') +
    '<circle cx="' + x(lastE.ts).toFixed(1) + '" cy="' + y(lastE.w).toFixed(1) + '" r="5.5" fill="var(--go)" stroke="#fff" stroke-width="2.5"/>' +
    '<text x="' + L + '" y="' + (H - 6) + '" font-size="11" fill="#676D85" font-weight="600">' + MO[d0.getMonth()] + ' ' + d0.getDate() + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" fill="#676D85" font-weight="600">' + MO[d1.getMonth()] + ' ' + d1.getDate() + '</text></svg>';
}
function dayDetail() {
  const d = S.ui.heatSel; if (d == null) return '';
  const cs = S.checkins.filter(c => dayNum(c.ts) === d), lbl = dateLong(dayStart(d));
  if (!cs.length) return '<div class="dayd"><span><b>' + lbl + '</b><br>' + (lapseDays()[d] ? 'Your clock ran out and a streak ended here.' : 'Rest day. No check-in.') + '</span></div>';
  return '<div class="dayd"><span><b>' + lbl + '</b>' + cs.map(c => '<button class="dd-s" data-a="openSession" data-id="' + c.id + '">' + esc(TYPE[c.type].v) + ', ' + c.mins + ' min, ' + EFFORT[c.effort].toLowerCase() + ', ' + c.pts + ' points' + ic('chevR', 15) + '</button>').join('') + '</span></div>';
}
function menuRow(action, icon, title, sub) {
  return '<button data-a="' + action + '"><span class="mi">' + ic(icon, 20) + '</span><span class="g"><b>' + title + '</b><span>' + sub + '</span></span><span class="chev">' + ic('chevR', 18) + '</span></button>';
}
// Workout progress: the same numbers wherever they are shown.
function weekStats() {
  const wk = weeklyTotals(8), cur = wk[7], prev = wk[6], eff = efficiency(28, 0), avg4 = Math.round(wk.slice(3, 7).reduce((a, w) => a + w.pts, 0) / 4), r = avg4 ? cur.pts / avg4 : 1;
  // the verdict comes before the number: this week against your own last four
  const verdict = !avg4 ? ['Your first weeks', ''] : r > 1.15 ? ['Above your usual', 'up'] : r < .85 ? ['Below your usual', ''] : ['About your usual', ''];
  return { wk: wk, n: cur.n, goal: S.me.goalPerWeek, hours: cur.mins / 60, pts: cur.pts, dPts: cur.pts - prev.pts, avg4: avg4, verdict: verdict, eff: eff, dEff: eff - efficiency(56, 28), hits: wk.filter(w => w.n >= S.me.goalPerWeek).length };
}
function progressTiles(ws) {
  const lb = latestBest(), d = lb && new Date(lb.ts);
  return '<div class="two"><button class="tile" data-a="openSessions"><div class="k">Check-ins</div><div class="v">' + ws.n + '<small>of ' + ws.goal + ' this week</small></div>' + bar(ws.n / ws.goal, 'var(--go)') + '<div class="d">Tap to see each one.</div></button>' +
    '<button class="tile" data-a="openSessions"><div class="k">Time trained</div><div class="v">' + ws.hours.toFixed(1) + '<small>hours</small></div><div class="d">Across ' + plural(ws.n, 'session') + '.</div></button>' +
    '<button class="tile" data-a="openEffortInfo"><div class="k">Effort points</div><div class="verdict ' + ws.verdict[1] + '">' + ws.verdict[0] + '</div><div class="v">' + ws.pts + '</div><div class="d">' + (ws.avg4 ? 'Your usual week is ' + ws.avg4 + '. ' : '') + 'See how points work.</div></button>' +
    (lb ? '<button class="tile" data-a="openLift" data-n="' + esc(lb.name) + '"><div class="k">Latest best</div><div class="v">' + lb.w + '<small>' + S.settings.units + '</small></div><div class="d">' + esc(lb.name) + ', ' + MO[d.getMonth()] + ' ' + d.getDate() + '.</div></button>'
      : '<div class="tile"><div class="k">Latest best</div><div class="v">0</div><div class="d">Log the same lift twice and your best shows up here.</div></div>') + '</div>';
}
function weekBars(ws) {
  const maxW = Math.max(1, ...ws.wk.map(w => w.pts)), total = ws.wk.reduce((a, w) => a + w.n, 0);
  if (total < 3) return '<div class="card"><div class="card-k">Effort points, last 8 weeks</div><p class="thresh">Check in 3 times and your weekly trend appears here. You have ' + total + ' so far.</p></div>';
  return '<div class="card"><div class="card-k">Effort points, last 8 weeks</div><div class="wk">' + ws.wk.map((w, i) => { const d = new Date(w.start), lbl = i === 7 ? 'Now' : (d.getMonth() + 1) + '/' + d.getDate(); return '<button class="' + (i === 7 ? 'cur' : '') + '" data-a="openSessions" data-i="' + i + '" aria-label="Week from ' + lbl + ', ' + w.pts + ' points, ' + plural(w.n, 'check-in') + '"><em>' + (w.pts || '') + '</em><i style="height:' + (w.pts / maxW * 58).toFixed(1) + '%"></i><span>' + lbl + '</span></button>'; }).join('') + '</div><p style="font-size:13.5px;margin-top:12px">You hit your goal of ' + ws.goal + ' check-ins in <b>' + ws.hits + ' of the last 8 weeks</b>. Tap a week to see its sessions.</p></div>';
}
function splitCard() {
  const split = splitByType(60), n = checkinsSince(now() - 60 * DAY).length;
  if (n < 3) return '<div class="card"><div class="card-k">What you train, last 60 days</div><p class="thresh">Check in 3 times to see how your training splits between push, pull, legs and the rest.</p></div>';
  return '<div class="card"><div class="card-k">What you train, last 60 days</div><div class="split">' + split.map(s => '<i style="width:' + (s.pct * 100).toFixed(1) + '%;background:' + TYPE[s.k].c + '"></i>').join('') + '</div><div class="split-l">' + split.map(s => '<span><i style="background:' + TYPE[s.k].c + '"></i>' + TYPE[s.k].n + ' ' + Math.round(s.pct * 100) + '%</span>').join('') + '</div></div>';
}
function liftRows(names) {
  return names.map(n => { const a = S.lifts[n], best = Math.max(...a.map(e => e.w)), gain = best - a[0].w; return '<button class="liftrow" data-a="openLift" data-n="' + esc(n) + '"><span style="flex:1;min-width:0;text-align:left"><span style="font-weight:700;display:block">' + esc(n) + '</span><span class="mute" style="font-size:13px">' + (gain > 0 ? 'Up ' + gain + ' ' + S.settings.units + ' since ' + MO[new Date(a[0].ts).getMonth()] : a.length === 1 ? '1 entry' : a.length + ' entries') + '</span>' + (nextLift(n) ? '<span class="lift-next">Next: ' + nextLift(n).w + ' × ' + nextLift(n).reps + '</span>' : '') + '</span>' + (a.length > 1 ? spark(a.map(e => e.w), 74, 30) : '') + '<span class="v">' + best + '</span></button>'; }).join('');
}
function myLifts() { return Object.keys(S.lifts).filter(n => S.lifts[n].length); }
function badgeBtn(b) { const on = !!S.badges[b.k]; return '<button class="bdg' + (on ? '' : ' off') + '" data-a="openBadge" data-k="' + b.k + '"><span class="m">' + badgeShape(b.sh, on ? b.c : '#E4E6EE') + '<span class="gl">' + (b.icon === 'flame' ? flame(24, on ? '#fff' : '#B4B9C9') : ic(b.icon, 24)) + '</span></span>' + b.n + '</button>'; }
// You: Food, Training, Body. Everything else sits behind the gear.
VIEWS.you = () => {
  const dp = dayPts(), lz = lapseDays(), ws = weekStats(), lifts = myLifts(), seg = S.ui.youSeg || 'food';
  const pg = S.progress.slice().sort((a, b) => b.ts - a.ts).slice(0, 3), hl = healthToday(), off = S.ui.foodOff || 0;
  const sec = (title, link, body) => '<div class="sec"><div class="sec-h"><h2 class="h2">' + title + '</h2>' + (link || '') + '</div>' + body + '</div>';
  let h = '<header class="top"><h1>You</h1><button class="icon-btn" data-a="openMore" aria-label="More and settings">' + ic('gear', 22) + '</button></header>';
  h += '<div class="pad"><div class="seg you-seg">' + [['food', 'Food'], ['training', 'Training'], ['body', 'Body']].map(x => '<button data-a="youSeg" data-k="' + x[0] + '" aria-pressed="' + (seg === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>';
  if (seg === 'food') {
    h += '<div class="pad food-day"><h2>' + dayLabel(foodDay(now()) + off) + '</h2><button class="icon-btn" data-a="foodDay" data-d="-1" aria-label="Previous day"' + (off <= -6 ? ' disabled' : '') + '>' + ic('chevL', 20) + '</button><button class="icon-btn" data-a="foodDay" data-d="1" aria-label="Next day"' + (off >= 0 ? ' disabled' : '') + '>' + ic('chevR', 20) + '</button></div>';
    h += '<div class="pad vstack">' + foodBody() + '</div>';
  } else if (seg === 'training') {
    h += sec('This week', '', progressTiles(ws));
    h += sec('Last 6 months', '', '<div class="card">' + heatGrid(d => level(dp[d] || 0), 26, true, d => lz[d]) + dayDetail() + '</div>');
    h += sec('Lifts', '', '<div class="card" style="padding:4px 18px">' + (lifts.length ? liftRows(lifts) : '<p class="empty">Lifts you log show up here.</p>') + '</div>');
    h += '<div class="menu" style="margin-top:22px">' + menuRow('openCharts', 'trend', 'Charts', 'Weekly effort and what you train') + menuRow('openBadges', 'trophy', 'Milestones', BADGES.filter(b => S.badges[b.k]).length + ' of ' + BADGES.length) + '</div>';
  } else {
    h += sec('Weight', '', weightCard());
    h += sec('Progress photos', '<button class="link" data-a="openProgress">All</button>', '<div class="pgrid four">' + pg.map(p => '<button data-a="openProgress"><img src="' + pgSrc(p) + '" alt="' + esc(p.tag) + ' progress photo"><span>' + MO[new Date(p.ts).getMonth()] + ' ' + new Date(p.ts).getDate() + '</span></button>').join('') +
      '<button data-a="addProgress" class="pg-add">' + ic('plus', 22) + '<b>Add</b></button></div>');
    if (hl) h += sec('Today', '', '<div class="health"><div><b>' + fmtN(hl.steps) + '</b><span>steps</span></div><div><b>' + hl.kcal + '</b><span>active kcal</span></div><div><b>' + Math.floor(hl.sleep) + 'h ' + pad2(Math.round(hl.sleep % 1 * 60)) + 'm</b><span>sleep</span></div></div>');
  }
  return h + '<div style="height:24px"></div>';
};
// The charts that used to fill Training, one tap down.
A.openCharts = () => openSheet(() => { const ws = weekStats(); return sheetHead('Charts', { back: true }) + '<div class="sh-b">' + weekNoteCard() + weekBars(ws) + splitCard() + bodyCard() + '</div>'; }, { cls: 'full' });
// The gear: your profile, the tools, and settings.
A.openMore = () => {
  const nc = connCount();
  openSheet(() => sheetHead('More') + '<div class="sh-b">' + userCard(S.me) + '<div class="menu" style="margin:0">' +
    menuRow('openCoach', 'sparkle', 'Coach', 'Ask about training or food') +
    menuRow('openPlan', 'calendar', 'Plan my next 3 sessions', 'From what you trained lately') +
    menuRow('openRecap', 'calendar', 'Monthly recap', 'Last month in one screen') +
    menuRow('openMyGym', 'pin', 'My gym', S.gymLoc ? esc(S.gymLoc.name) : 'Notice when you arrive and leave') +
    menuRow('openNoPhoto', 'info', 'No photos at your gym?', 'Other ways to check in') +
    menuRow('openConnections', 'heart', 'Connections', nc ? plural(nc, 'app') + ' connected' : 'Apple Health and more') +
    menuRow('openWidgets', 'clock', 'Widget and reminders', 'Your clock on your home screen') +
    menuRow('openTiers', 'info', 'How streaks work', 'The 48 hours and rest passes') +
    menuRow('openSettings', 'gear', 'Settings', 'Profile, privacy, your data') + '</div></div>', { cls: 'full' });
};
A.youSeg = el => { S.ui.youSeg = el.dataset.k; save(); render(); $('#view').scrollTop = Math.min($('#view').scrollTop, 330); };
A.heatSel = el => { const d = +el.dataset.d; S.ui.heatSel = S.ui.heatSel === d ? null : d; render(); };

/* ---- all lifts ---- */
A.openEffort = () => {
  openSheet(() => {
    const lifts = myLifts();
    return sheetHead('Lifts', { back: true }) + '<div class="sh-b"><p class="mute" style="font-size:14px">Your best on each lift, in ' + S.settings.units + '. Add lifts when you check in.</p><div class="card" style="padding:4px 18px">' + (lifts.length ? liftRows(lifts) : '<p class="empty">Add a lift when you check in and it shows up here.</p>') + '</div></div>';
  }, { cls: 'full' });
};
A.openLift = el => {
  const name = el.dataset.n; D.lf = { w: '', reps: '' };
  openSheet(() => {
    const a = S.lifts[name] || [], best = a.length ? Math.max(...a.map(e => e.w)) : 0, u = S.settings.units;
    return sheetHead(name) + '<div class="sh-b"><div class="two"><div class="tile"><div class="k">Best</div><div class="v">' + best + '<small>' + u + '</small></div></div><div class="tile"><div class="k">Gained</div><div class="v">' + (a.length ? best - a[0].w : 0) + '<small>' + u + ' since ' + (a.length ? MO[new Date(a[0].ts).getMonth()] : '') + '</small></div></div></div>' +
      (a.length > 1 ? '<div class="card" style="padding:12px 8px 6px">' + lineChart(a) + '</div>' : '<p class="thresh">Log this lift once more and its chart appears here.</p>') +
      '<div class="rows">' + a.slice(-3).reverse().map(e => '<div class="row"><div class="grow"><div class="t">' + e.w + ' ' + u + ' for ' + plural(e.reps, 'rep') + '</div><div class="s">' + dateLong(e.ts) + '</div></div>' + (e.w === best ? '<span class="pill hot">Best</span>' : '') + '</div>').join('') + '</div>' +
      '<div class="field"><span class="lbl">Add a set</span><div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px"><input class="input" id="lf-w" type="number" inputmode="decimal" placeholder="Weight, ' + u + '" data-m="lf.w" value="' + esc(D.lf.w) + '" aria-label="Weight"><input class="input" id="lf-r" type="number" inputmode="numeric" placeholder="Reps" data-m="lf.reps" value="' + esc(D.lf.reps) + '" aria-label="Reps"><button class="btn btn-ink" data-a="liftAdd" data-n="' + esc(name) + '">Add</button></div></div></div>';
  });
};
A.liftAdd = el => {
  const name = el.dataset.n, w = +D.lf.w, reps = Math.round(+D.lf.reps) || 1;
  if (!(w > 0)) { toast('Enter the weight you lifted.'); return; }
  const a = S.lifts[name] || (S.lifts[name] = []), best = a.length ? Math.max(...a.map(e => e.w)) : 0;
  a.push({ ts: now(), w: w, reps: reps }); D.lf = { w: '', reps: '' };
  if (w > best && best > 0) { toast('New best on ' + name.toLowerCase() + ': ' + w + ' ' + S.settings.units, 'trend'); S.badges.pr = 1; }
  save(); refresh();
};

/* ---- badges ---- */
A.openBadges = () => openSheet(() => sheetHead('Milestones', { back: true }) + '<div class="sh-b"><div class="badges">' + BADGES.map(badgeBtn).join('') + '</div></div>', { cls: 'full' });
A.openBadge = el => {
  const b = BADGES.find(x => x.k === el.dataset.k), on = !!S.badges[b.k];
  openSheet(() => sheetHead(b.n) + '<div class="sh-b" style="align-items:center;text-align:center"><div class="bdg' + (on ? '' : ' off') + '"><span class="m" style="width:110px;height:110px">' + badgeShape(b.sh, on ? b.c : '#E4E6EE') + '<span class="gl">' + (b.icon === 'flame' ? flame(46, on ? '#fff' : '#B4B9C9') : ic(b.icon, 46)) + '</span></span></div><p>' + esc(b.d) + '</p><span class="pill ' + (on ? 'ok' : '') + '">' + (on ? ic('check', 14) + 'Earned' : ic('lock', 13) + 'Not earned yet') + '</span></div>');
};

/* ---- progress photos ---- */
function pgSrc(p) { return (p.photo && photoSrc(p.photo)) || progressURI(p.art || 0); }
A.openProgress = () => openSheet(() => {
  const pg = S.progress.slice().sort((a, b) => b.ts - a.ts);
  return sheetHead('Progress photos', { back: true }) + '<div class="sh-b"><div class="aicheck">' + ic('lock', 18) + 'Only you can see these. They never go to your feed.</div><div class="pgrid">' + pg.map(p => '<button data-a="openCompare"><img src="' + pgSrc(p) + '" alt="' + esc(p.tag) + ' progress photo"><span>' + MO[new Date(p.ts).getMonth()] + ' ' + new Date(p.ts).getDate() + '</span></button>').join('') +
    '<button data-a="addProgress" style="display:grid;place-items:center;font-weight:700;font-size:13px"><span style="position:static;background:none;color:var(--iron);display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px">' + ic('plus', 22) + 'Add photo</span></button></div>' +
    (pg.length > 1 ? '<button class="btn btn-ink btn-w" data-a="openCompare">Compare first and latest</button>' : '') + '</div>';
}, { cls: 'full' });
A.addProgress = (el, e) => openCam('progress', e);
A.openCompare = () => {
  const all = S.progress.slice().sort((a, b) => a.ts - b.ts); if (all.length < 2) { toast('Add a second photo to compare.'); return; }
  const tag = all[all.length - 1].tag, same = all.filter(p => p.tag === tag), pg = same.length > 1 ? same : all;
  const a = pg[0], b = pg[pg.length - 1], lab = p => MO[new Date(p.ts).getMonth()] + ' ' + new Date(p.ts).getDate();
  openSheet(() => sheetHead(same.length > 1 ? 'Compare: ' + tag.toLowerCase() : 'Compare') + '<div class="sh-b"><div class="cmp" id="cmp"><img src="' + pgSrc(a) + '" alt="Earlier photo"><img class="b" src="' + pgSrc(b) + '" alt="Latest photo"><div class="h"></div><span class="lab l">' + lab(a) + '</span><span class="lab r">' + lab(b) + '</span></div><p class="mute" style="font-size:13.5px;text-align:center">Drag across the photo. ' + Math.round((b.ts - a.ts) / DAY / 7) + ' weeks apart.</p></div>',
    { after: el => { const c = $('#cmp', el); if (!c || c.dataset.w) return; c.dataset.w = 1; const mv = e => { const r = c.getBoundingClientRect(); c.style.setProperty('--x', clamp((e.clientX - r.left) / r.width * 100, 2, 98) + '%'); }; c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); mv(e); }); c.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') mv(e); }); } });
};

/* ---- how streaks work ---- */
A.openTiers = () => openSheet(() => {
  const days = pDays(S.me), nx = nextMilestone(days);
  const rule = (c, icon, t, d) => '<div class="row"><span class="av plain" style="--s:40px;--c:' + c + '"><i>' + ic(icon, 18) + '</i></span><div class="grow"><div class="t" style="white-space:normal">' + t + '</div><div class="s">' + d + '</div></div></div>';
  return sheetHead('How streaks work') + '<div class="sh-b"><div class="rows">' +
    rule('#FF5A1F', 'camera', 'A gym photo gives you 48 hours', 'Your streak grows a day for every day you stay on the clock.') +
    rule('#12996B', 'pass', 'Rest passes add 24 hours', 'You start with two and earn one every 7 check-ins.') +
    rule('#2F7BFF', 'check', 'One comeback a month', 'Miss your window, check in within 24 hours, and the streak is restored.') + '</div>' +
    '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><b style="font-size:16px">Milestones</b><span class="mute" style="font-size:13px;font-weight:600">' + (nx ? plural(nx - days, 'day') + ' to ' + nx : 'All reached') + '</span></div><div class="miles">' +
    MILESTONES.map((n, i) => { const prev = i ? MILESTONES[i - 1] : 0, f = clamp((days - prev) / (n - prev), 0, 1); return '<div class="' + (days >= n ? 'on' : '') + '"><i><b style="width:' + (f * 100).toFixed(0) + '%"></b></i>' + n + ' days</div>'; }).join('') + '</div></div></div>';
});

/* ---- settings ---- */
A.openSettings = () => {
  D.st = { name: S.me.name, handle: S.me.handle, campus: S.me.campus, gym: S.me.gym };
  openSheet(() => {
    const s = S.settings, m = S.me;
    const row = (t, d, on, key) => '<div class="setrow"><div class="grow"><div class="t">' + t + '</div><div class="s">' + d + '</div></div>' + sw(on, 'setToggle', 'data-k="' + key + '"') + '</div>';
    const inp = (k, label) => '<div class="field"><label for="st-' + k + '">' + label + '</label><input class="input" id="st-' + k + '" data-m="st.' + k + '" data-on="stLive" value="' + esc(D.st[k]) + '" maxlength="28" autocomplete="off"></div>';
    return sheetHead('Settings', { back: true }) + '<div class="sh-b">' + dataCard() +
      '<div class="two">' + inp('name', 'Name') + inp('handle', 'Username') + inp('campus', 'Campus') + inp('gym', 'Home gym') + '</div>' +
      '<div class="field"><span class="lbl">Weekly goal</span><div class="stepper"><button data-a="goalStep" data-d="-1" aria-label="Fewer">' + ic('minus') + '</button><span class="v">' + m.goalPerWeek + '</span><button data-a="goalStep" data-d="1" aria-label="More">' + ic('plus') + '</button><span class="u">check-ins a week</span></div></div>' +
      '<div><h3 class="h2">What friends can see</h3>' + row('Streak and time left', 'Always on. It is the point of the app.', true, 'locked') + row('Workouts and effort points', 'What you trained, how long and how hard.', s.share.workouts, 'share.workouts') + row('Lifts and new bests', 'Weights you log.', s.share.lifts, 'share.lifts') +
      '<div class="setrow"><div class="grow"><div class="t">Food, health data and progress photos</div><div class="s">Always private.</div></div>' + ic('lock', 20) + '</div></div>' +
      '<div><h3 class="h2">Streak</h3>' + row('Use rest passes automatically', 'Spend a pass instead of losing the streak.', s.autoPass, 'autoPass') + '</div>' +
      '<button class="btn btn-line btn-w" data-a="openIntro">Replay the intro</button>' +
      (S.mode === 'real' ? '' : '<div class="card"><h3 class="h2" style="margin-bottom:4px">Prototype tools</h3><p class="mute" style="font-size:13.5px;margin-bottom:12px">Jump forward in time to watch your clock drain, or start the sample data over.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-white btn-s" data-a="skip" data-h="6">Skip 6 hours</button><button class="btn btn-white btn-s" data-a="skip" data-h="24">Skip 24 hours</button><button class="btn btn-white btn-s" data-a="resetDemo">Start over</button></div></div>') + '</div>';
  }, { cls: 'full', onClose: () => { render(); } });
};
A.stLive = () => {
  const d = D.st, m = S.me;
  if (d.name.trim()) m.name = d.name.trim(); if (d.handle.trim()) m.handle = d.handle.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
  if (d.campus.trim()) m.campus = d.campus.trim(); if (d.gym.trim()) m.gym = d.gym.trim(); save();
};
A.setToggle = el => {
  const k = el.dataset.k; if (k === 'locked') { toast('Your streak is always visible to friends.'); return; }
  if (k === 'autoPass') S.settings.autoPass = !S.settings.autoPass; else setPath(S.settings, k, !getPath(S.settings, k));
  save(); drawSheets(false);
};
A.goalStep = el => { S.me.goalPerWeek = clamp(S.me.goalPerWeek + (+el.dataset.d), 1, 7); save(); drawSheets(false); };
A.skip = el => skipTime(+el.dataset.h);
A.resetDemo = () => { resetDemo(); closeAll(); S.ui.tab = 'home'; scrollPos.home = 0; refreshDetected(); render(); toast('Started over with fresh sample data', 'check'); };
