/* Home: your window, your friends' rings, and the feed. */
function leftClock(ms) {
  if (ms <= 0) return ['0:00', 'time is up'];
  const h = Math.floor(ms / HOUR), m = Math.floor(ms % HOUR / MIN), s = Math.floor(ms % MIN / 1e3);
  return h >= 1 ? [h + ':' + pad2(m), 'hours left'] : [m + ':' + pad2(s), 'minutes left'];
}
function repairLeft() { return canRepair() ? S.me.lost.at + DAY - now() : 0; }
function heroPanel() {
  const m = S.me, alive = pAlive(m), left = leftMs(), days = pDays(m), rep = repairLeft(), lc = leftClock(alive ? left : rep), unread = S.activity.some(a => !a.read);
  const state = alive ? timeState(left) : rep > 0 ? 'crit' : 'out';
  let h = '<section class="hero s-' + state + '"><div class="hero-top">' + wordmark() + '<div class="acts"><button class="hero-btn" data-a="openFriends">' + ic('users', 18) + 'Friends</button><button class="hero-btn" data-a="openActivity">' + ic('bell', 18) + 'Activity' + (unread ? '<span class="dot"></span>' : '') + '</button></div></div>';
  const mid = alive ? '<b data-live="clock">' + lc[0] + '</b><span data-live="clocklbl">' + lc[1] + '</span>' : rep > 0 ? '<b data-live="clock">' + lc[0] + '</b><span>to save your streak</span>' : '<b>0:00</b><span>on your clock</span>';
  h += '<div class="hero-dial">' + dial(204, alive ? left : rep, days, { id: 'me-dial', mid: mid, color: !alive && rep > 0 ? '#FF5347' : null }) + '</div>';
  if (alive) h += '<div class="hero-line"><button class="hero-streak" data-a="openTiers">' + flame(22, '#FF8A1E') + '<b>' + days + '</b> day streak</button><button class="pill" data-a="openPasses">' + ic('pass', 13) + plural(m.passes, 'pass') + '</button></div><p class="hero-sub">' + (left < 6 * HOUR ? 'Check in by ' + whenBy(deadline()) + ' or it ends.' : 'Next photo due ' + whenBy(deadline()) + '.') + '</p>';
  else if (rep > 0) h += '<div class="hero-line"><span>Your ' + m.lost.days + ' day streak ran out</span></div><p class="hero-sub">Check in before the clock above hits zero and you get it back. One comeback a month.</p>';
  else h += '<div class="hero-line"><span>' + (m.lost ? 'Your streak ended at ' + plural(m.lost.days, 'day') : 'No streak yet') + '</span></div><p class="hero-sub">One gym photo starts a new one' + (m.best ? '. Your best is ' + plural(m.best, 'day') : '') + '.</p>';
  return h + '</section>';
}
function postHTML(p, gated) {
  const u = person(p.uid); if (!u) return '';
  const mine = p.uid === 'me', days = p.day || 1, pf = PROOF[proofKey(p)];
  // Props are for the effort, and there is one kind. Nothing here rates how anyone looks.
  const props = '<button class="react" data-a="' + (mine ? 'openNoticed' : 'react') + '" data-id="' + p.id + '" aria-pressed="' + (!mine && !!p.mine) + '" aria-label="' + (mine ? 'See who gave you props' : 'Give props') + '"><span class="e">👏</span>Props<span class="n">' + propsN(p) + '</span></button>';
  const note = p.verified === false ? 'Not verified' : TYPE[p.type].v + ' at ' + p.gym;
  if (gated) return '<article class="post"><div class="shot gated"><img src="' + imgOf(p) + '" alt=""><div class="gate">' + avPlain(u.name, u.color, 54) + '<b>' + esc(first(u.name)) + ' checked in ' + ago(p.ts) + '</b><span>Check in to see it.</span></div></div></article>';
  return '<article class="post" id="p-' + p.id + '"><div class="shot" data-a="shotTap" data-id="' + p.id + '"><img src="' + imgOf(p) + '" alt="' + esc((mine ? 'Your' : first(u.name) + '\'s') + ' check-in') + '" loading="lazy">' +
    '<div class="post-h"><button class="post-who" data-a="openProfile" data-id="' + p.uid + '">' + av(u, 44, { dark: true, nowarn: true }) + '<span class="who"><b>' + esc(mine ? 'You' : u.name) + (p.verified === true ? ' ' + ic('check', 14) : '') + '</b><span>' + esc(note) + '</span></span></button><time>' + ago(p.ts) + '</time></div>' +
    '<div class="tags"><span class="stick">' + flame(17, tierColor(days)) + 'Day <span class="num" style="font-size:19px">' + days + '</span></span><span class="stick">' + p.mins + ' min, ' + EFFORT[p.effort].toLowerCase() + '</span></div></div>' +
    '<div class="post-a">' + props + '<button class="proof" data-a="openProof" data-k="' + proofKey(p) + '">' + ic(pf[1], 15) + pf[0] + '</button><button class="cbtn" data-a="openComments" data-id="' + p.id + '" aria-label="Comments">' + ic('comment', 20) + p.comments.length + '</button></div>' +
    (p.pr ? '<span class="pill hot post-pr">' + ic('trend', 15) + 'New best: ' + esc(p.pr.lift) + ' ' + p.pr.w + ' ' + S.settings.units + '</span>' : '') +
    (p.caption ? '<p class="post-c"><b>' + esc(mine ? 'You' : first(u.name)) + '</b> ' + esc(p.caption) + '</p>' : '') + '</article>';
}
// One photo per person: their latest check-in from the last 48 hours.
function feedPosts() {
  const seen = {}, out = [], cut = now() - WINDOW;
  S.posts.forEach(p => { if (seen[p.uid] || p.ts < cut) return; const u = person(p.uid); if (!u || (p.uid !== 'me' && !u.fol)) return; seen[p.uid] = 1; out.push(p); });
  return out;
}
// Home shows at most one card between your clock and the feed. First match wins: a workout
// your phone recorded, last month's recap (once), a friend about to run out, the offer to connect.
function homeCard() {
  const off = syncOfferCard(); if (off) return off;
  const det = detectedCard(); if (det) return det;
  const rc = recapCard(); if (rc) return rc;
  const close = following().filter(f => pAlive(f) && pLeft(f) < 6 * HOUR).sort((a, b) => pLeft(a) - pLeft(b))[0];
  if (close) return '<div class="nudge">' + av(close, 44) + '<div class="grow"><b>' + esc(first(close.name)) + '</b> has ' + fmtLeftShort(pLeft(close)) + ' left on a ' + pDays(close) + ' day streak.</div><button class="btn btn-ink btn-s" data-a="nudge" data-id="' + close.id + '"' + (close.nudged ? ' disabled' : '') + '>' + (close.nudged ? 'Nudged' : ic('bolt', 16) + 'Nudge') + '</button></div>';
  if (!connCount() && S.ui.connHint !== false) return '<div class="hint"><p>Let a recorded workout remind you to check in.</p><button data-a="openConnections">Connect</button><button data-a="hideConnHint" aria-label="Dismiss">' + ic('x', 18) + '</button></div>';
  return '';
}
// Food and workouts at a glance. Each opens the full page.
function todayTiles() {
  const t = dayTotals(foodDay(now())), g = S.goals, kc = S.ui.showKcal !== false, have = Math.round(kc ? t.kcal : t.p), goal = kc ? g.kcal : g.p, ws = weekStats();
  return '<div class="glance"><button class="tile" data-a="openFood"><span class="k">' + ic('bowl', 16) + 'Food today</span><span class="v">' + fmtN(have) + '<small>of ' + fmtN(goal) + (kc ? ' kcal' : ' g protein') + '</small></span>' + bar(have / goal, 'var(--iron)') + '<span class="d">' + Math.round(t.p) + ' g protein so far</span></button>' +
    '<button class="tile" data-a="tab" data-tab="you"><span class="k">' + ic('dumbbell', 16) + 'Gym this week</span><span class="v">' + ws.n + '<small>of ' + ws.goal + ' check-ins</small></span>' + bar(ws.n / ws.goal, 'var(--go)') + '<span class="d">' + ws.pts + ' effort points</span></button></div>';
}
VIEWS.home = () => {
  const fr = following(), alive = pAlive(S.me);
  let h = heroPanel() + homeCard() + noticedStrip() + todayTiles();
  const order = fr.slice().sort((a, b) => b.lastCheckin - a.lastCheckin);
  h += '<div class="sec" style="padding-bottom:0"><div class="sec-h"><h2 class="h2">Friends</h2><button class="link" data-a="openFriends">All ' + fr.length + '</button></div></div><div class="frow">' +
    order.map(f => '<button data-a="openProfile" data-id="' + f.id + '">' + av(f, 60) + '<span class="nm">' + esc(first(f.name)) + '</span>' + streakChip(pDays(f)) + '</button>').join('') +
    '<button data-a="openFriends" data-seg="find"><span class="av plain" style="--s:60px;--c:#676D85"><i>' + ic('plus', 24) + '</i></span><span class="nm">Find</span><span class="streak" style="visibility:hidden">0</span></button></div>';
  h += meetsSection();
  const posts = feedPosts();
  h += '<h2 class="feed-h">Last 48 hours</h2>' + (posts.length ? posts.map(p => postHTML(p, !alive && p.uid !== 'me')).join('') : '<p class="empty">Nobody has checked in yet. Be the first.</p>') + '<p class="feed-end">One photo per friend, their latest.<br>Friends and their posts are sample data.</p>';
  return h;
};

A.hideConnHint = () => { S.ui.connHint = false; save(); render(); };
A.nudge = el => { nudge(el.dataset.id); refresh(); };
A.react = el => {
  const p = S.posts.find(x => x.id === el.dataset.id); if (!p || p.uid === 'me') return;
  if (p.mine) { p.rx[p.mine]--; p.mine = null; } else { p.rx.fire++; p.mine = 'fire'; }
  save();
  const b = $('#p-' + p.id + ' .react'); if (b) { b.setAttribute('aria-pressed', String(!!p.mine)); b.lastChild.textContent = propsN(p); }
};
let _tapT = 0, _tapId = null;
A.shotTap = el => {
  // double tap a photo to give props
  const t = Date.now(), id = el.dataset.id;
  if (_tapId === id && t - _tapT < 360) {
    const p = S.posts.find(x => x.id === id);
    if (p && !p.mine) A.react({ dataset: { id: id } });
    const b = document.createElement('div'); b.className = 'burst'; b.textContent = '👏'; el.appendChild(b); setTimeout(() => b.remove(), 720);
    _tapId = null;
  } else { _tapT = t; _tapId = id; }
};

/* ---- comments ---- */
A.openComments = el => {
  const id = el.dataset.id; D.cm = '';
  openSheet(() => {
    const p = S.posts.find(x => x.id === id); if (!p) return '';
    const u = person(p.uid);
    return sheetHead('Comments') + '<div class="sh-b"><div class="row" style="border:0;padding:0">' + av(u, 40) + '<div class="grow"><div class="t">' + esc(p.uid === 'me' ? 'You' : u.name) + '</div><div class="s">' + esc(p.caption || TYPE[p.type].v) + '</div></div></div>' +
      '<div class="chat">' + (p.comments.length ? p.comments.map(c => { const cu = person(c.uid) || S.me, me = c.uid === 'me'; return '<div class="msg' + (me ? ' mine' : '') + '">' + (me ? '' : avPlain(cu.name, cu.color, 28)) + '<p>' + (me ? '' : '<small>' + esc(first(cu.name)) + '</small>') + esc(c.text) + '</p></div>'; }).join('') : '<p class="mute">No comments yet. Say something nice.</p>') + '</div>' +
      '<div class="send"><input class="input" id="cm-input" placeholder="Add a comment" data-m="cm" data-enter="sendComment" data-id="' + id + '" value="' + esc(D.cm || '') + '" autocomplete="off"><button class="btn btn-ink" data-a="sendComment" data-id="' + id + '" aria-label="Send">' + ic('send', 20) + '</button></div></div>';
  });
};
A.sendComment = el => {
  const p = S.posts.find(x => x.id === el.dataset.id), text = (D.cm || '').trim(); if (!p || !text) return;
  p.comments.push({ uid: 'me', text: text, ts: now() }); D.cm = ''; save(); refresh();
  const i = $('#cm-input'); if (i) i.focus();
};

/* ---- activity ---- */
A.openActivity = () => {
  openSheet(() => sheetHead('Activity') + '<div class="sh-b">' + (S.activity.length ? '' : '<p class="empty">Nothing yet. Props, nudges and passes show up here.</p>') + '<div class="rows">' + S.activity.map(a => {
    const u = a.uid ? person(a.uid) : null;
    return '<div class="row">' + (u ? av(u, 42, { nowarn: true }) : '<span class="av plain" style="--s:42px;--c:var(--wash)"><i style="color:var(--iron)">' + ic(a.icon === 'flame' ? 'bell' : a.icon, 20) + '</i></span>') +
      '<div class="grow"><div style="font-weight:' + (a.read ? 500 : 700) + '">' + esc(a.text) + '</div><div class="s">' + ago(a.ts) + '</div></div>' +
      (a.act === 'nudge' && u && pAlive(u) && pLeft(u) < 6 * HOUR ? '<button class="btn btn-ink btn-s" data-a="nudge" data-id="' + u.id + '"' + (u.nudged ? ' disabled' : '') + '>' + (u.nudged ? 'Nudged' : 'Nudge') + '</button>' : '') + '</div>';
  }).join('') + '</div></div>', { onClose: () => { S.activity.forEach(a => a.read = true); save(); render(); } });
};

/* ---- friends ---- */
function friendRow(f) {
  const alive = pAlive(f), days = pDays(f), left = pLeft(f);
  return '<button class="row" data-a="openProfile" data-id="' + f.id + '">' + av(f, 48) + '<div class="grow"><div class="t">' + esc(f.name) + '</div><div class="s">' +
    (alive ? plural(days, 'day') + ' streak' : f.lost ? 'Streak ended at ' + plural(f.lost.days, 'day') : 'No streak right now') + (f.duo ? ' <span class="pill" style="height:20px;font-size:11.5px;margin-left:4px">Duo ' + f.duo + (f.duoPaused ? ', paused' : '') + '</span>' : '') + '</div></div>' +
    (alive ? '<span class="pill tl" style="--tc:' + timeColor(left) + '">' + fmtLeftShort(left) + ' left</span>' : '<span class="pill">0h</span>') + '</button>';
}
function friendsList() {
  const q = (D.frq || '').trim().toLowerCase(), seg = S.ui.frSeg, match = f => !q || f.name.toLowerCase().includes(q);
  if (seg === 'friends') {
    const l = following().filter(match).sort((a, b) => (pAlive(b) - pAlive(a)) || pLeft(a) - pLeft(b));
    return l.length ? '<p class="mute" style="font-size:13px;margin-bottom:2px">Least time left first, so you know who to nudge.</p><div class="rows">' + l.map(friendRow).join('') + '</div>' : '<p class="empty">No friends match that name.</p>';
  }
  if (seg === 'find') {
    const l = S.friends.filter(f => !f.fol).filter(match);
    return '<div class="card" style="display:flex;gap:12px;align-items:center"><div class="grow" style="flex:1"><div style="font-weight:700">Find a training partner</div><div class="mute" style="font-size:13px">Show me to people at ' + esc(S.me.gym) + ' who want someone to train with.</div></div>' + sw(S.ui.spot, 'toggleSpot') + '</div>' +
      (l.length ? '<div class="rows">' + l.map(f => '<div class="row"><button data-a="openProfile" data-id="' + f.id + '" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0">' + av(f, 48) + '<span class="grow" style="flex:1;min-width:0;display:block"><span class="t" style="display:block">' + esc(f.name) + '</span><span class="s">' + esc(f.note || f.gym) + '</span></span></button>' + streakChip(pDays(f)) + '<button class="btn btn-ink btn-s" data-a="follow" data-id="' + f.id + '">Follow</button></div>').join('') + '</div>' : '<p class="empty">You follow everyone we could suggest.</p>');
  }
  return S.requests.length ? '<div class="rows">' + S.requests.map(rq => '<div class="row">' + avPlain(rq.name, rq.color, 48) + '<div class="grow"><div class="t">' + esc(rq.name) + '</div><div class="s">' + esc(rq.note) + '</div></div><button class="btn btn-ink btn-s" data-a="reqYes" data-id="' + rq.id + '">Accept</button><button class="icon-btn" style="width:36px;height:36px" data-a="reqNo" data-id="' + rq.id + '" aria-label="Decline">' + ic('x', 18) + '</button></div>').join('') + '</div>' : '<p class="empty">No follow requests right now.</p>';
}
A.openFriends = el => {
  if (el && el.dataset.seg) S.ui.frSeg = el.dataset.seg;
  D.frq = '';
  openSheet(() => sheetHead('Friends', { back: true }) + '<div class="sh-b">' +
    '<input class="input" id="fr-search" type="search" placeholder="Search by name" data-m="frq" data-on="frSearch" value="' + esc(D.frq || '') + '" autocomplete="off">' +
    '<div class="seg">' + [['friends', 'Friends ' + following().length], ['find', 'Find people'], ['req', 'Requests' + (S.requests.length ? ' ' + S.requests.length : '')]].map(x => '<button data-a="frSeg" data-seg="' + x[0] + '" aria-pressed="' + (S.ui.frSeg === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
    '<div id="fr-list" style="display:flex;flex-direction:column;gap:12px">' + friendsList() + '</div></div>', { cls: 'full' });
};
A.frSearch = () => { const l = $('#fr-list'); if (l) l.innerHTML = friendsList(); };
A.frSeg = el => { S.ui.frSeg = el.dataset.seg; drawSheets(false); };
A.toggleSpot = () => { S.ui.spot = !S.ui.spot; save(); drawSheets(false); toast(S.ui.spot ? 'You are visible to training partners at ' + S.me.gym : 'Hidden from training partners'); };
A.follow = el => { const f = person(el.dataset.id); if (!f) return; f.fol = true; addActivity({ icon: 'users', uid: f.id, text: 'You followed ' + first(f.name) + '.' }); save(); refresh(); toast('Following ' + first(f.name), 'check'); };
A.unfollow = el => { const f = person(el.dataset.id); if (!f) return; f.fol = false; save(); refresh(); toast('Unfollowed ' + first(f.name)); };
A.reqYes = el => { const i = S.requests.findIndex(r => r.id === el.dataset.id); if (i < 0) return; const rq = S.requests.splice(i, 1)[0]; save(); drawSheets(false); toast(first(rq.name) + ' now follows you', 'check'); };
A.reqNo = el => { const i = S.requests.findIndex(r => r.id === el.dataset.id); if (i < 0) return; S.requests.splice(i, 1); save(); drawSheets(false); };

/* ---- someone else's profile ---- */
function heatGrid(levelAt, weeks, interactive, missAt) {
  const today = dayNum(now()), dow = new Date(dayStart(today)).getDay(), startD = today - dow - (weeks - 1) * 7;
  let cells = '', months = '', lastM = -1, lastW = -9;
  for (let w = 0; w < weeks; w++) {
    const d0 = startD + w * 7, mo = new Date(dayStart(d0 + 6)).getMonth();
    const show = mo !== lastM && w < weeks - 1 && w - lastW > 2; months += '<span>' + (show ? MO[mo] : '') + '</span>'; if (show) lastW = w; if (show || w > 0) lastM = mo;
    for (let i = 0; i < 7; i++) {
      const d = d0 + i, lv = d > today ? -1 : levelAt(d);
      if (lv < 0) cells += '<span class="fut"></span>';
      else cells += interactive ? '<button class="l' + lv + (lv === 0 && missAt && missAt(d) ? ' miss' : '') + (S.ui.heatSel === d ? ' sel' : '') + (d === today ? ' today' : '') + '" data-a="heatSel" data-d="' + d + '" aria-label="' + dateLong(dayStart(d)) + '"></button>' : '<span class="l' + lv + '"></span>';
    }
  }
  return '<div class="heat-m">' + months + '</div><div class="heat">' + cells + '</div>';
}
const heatLegend = '<span class="legend">Less<i style="background:var(--h0);margin-left:4px"></i><i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4);margin-right:4px"></i>More effort</span>';
A.openProfile = el => {
  const id = el.dataset.id;
  if (id === 'me') { S.ui.tab = 'you'; closeAll(); render(); return; }
  openSheet(() => {
    const f = person(id); if (!f) return '';
    const days = pDays(f);
    const posts = S.posts.filter(p => p.uid === id).slice(0, 6);
    let h = sheetHead(f.name, { back: true }) + '<div class="sh-b" style="gap:16px">' + userCard(f).replace('class="ucard', 'style="margin:0" class="ucard');
    if (f.bio) h += '<p>' + esc(f.bio) + '</p>';
    h += '<div style="display:flex;gap:8px">' + (f.fol ? '<button class="btn btn-line" style="flex:1" data-a="unfollow" data-id="' + id + '">' + ic('check', 18) + 'Following</button>' : '<button class="btn btn-ink" style="flex:1" data-a="follow" data-id="' + id + '">Follow</button>') +
      '<button class="btn btn-soft" style="flex:1" data-a="nudge" data-id="' + id + '"' + (f.nudged ? ' disabled' : '') + '>' + ic('bolt', 18) + (f.nudged ? 'Nudged' : 'Nudge') + '</button></div><button class="btn btn-soft btn-w" data-a="trainWith" data-id="' + id + '">' + ic('dumbbell', 18) + 'Ask to train together</button>';
    if (!f.duo && f.fol) h += duoCount() < DUO_MAX ? '<button class="btn btn-line btn-w" data-a="startDuo" data-id="' + id + '">' + ic('users', 18) + 'Start a duo streak with ' + esc(first(f.name)) + '</button>' : '<p class="mute" style="font-size:13px;text-align:center">You have ' + DUO_MAX + ' duo streaks, the most you can keep at once.</p>';
    if (f.duo) h += duoCard(f);
    h += '<div class="stats" style="margin:0;grid-template-columns:repeat(3,1fr)"><div><b>' + Math.max(f.best, days) + '</b><span>best streak</span></div><div><b>' + fmtN(f.total) + '</b><span>check-ins</span></div><div><b>' + f.weekPts + '</b><span>points, 7 days</span></div></div>';
    h += '<div class="card">' + heatGrid(d => friendLevel(f, d), 26, false) + '<div class="heat-f"><span>Last 6 months</span>' + heatLegend + '</div></div>';
    if (posts.length) h += '<div><h3 class="h2" style="margin-bottom:10px">Recent check-ins</h3><div class="pgrid">' + posts.map(p => '<button data-a="noop"><img src="' + imgOf(p) + '" alt="' + esc(TYPE[p.type].v) + '"><span>' + ago(p.ts) + '</span></button>').join('') + '</div></div>';
    return h + '</div>';
  }, { cls: 'full' });
};
const DUO_MAX = 5;
function duoCount() { return S.friends.filter(f => f.duo).length; }
A.startDuo = el => { const f = person(el.dataset.id); if (!f || f.duo) return; if (duoCount() >= DUO_MAX) { toast('You can keep ' + DUO_MAX + ' duo streaks at once'); return; } f.duo = 1; addActivity({ icon: 'users', uid: f.id, text: 'You started a duo streak with ' + first(f.name) + '.' }); save(); refresh(); if (!el.quiet) toast('Duo streak started with ' + first(f.name), 'check'); };
A.trainWith = el => { const f = person(el.dataset.id); toast('Asked ' + first(f.name) + ' to train together', 'dumbbell'); };
A.openPasses = () => {
  openSheet(() => {
    const m = S.me;
    return sheetHead('Rest passes') + '<div class="sh-b"><div class="card" style="display:flex;gap:14px;align-items:center"><span class="av plain" style="--s:54px;--c:#DFF3EA"><i style="color:#0E6B4C">' + ic('pass', 28) + '</i></span><div style="flex:1"><div class="num" style="font-size:34px">' + m.passes + ' of 2</div><div class="mute" style="font-size:13.5px">passes ready</div></div></div>' +
      '<p>A rest pass adds 24 hours to your clock. You earn one every 7 check-ins and can hold two. Sick day, exam week, travel: it covers you.</p>' +
      '<div class="setrow" style="border:0;padding:0"><div class="grow"><div class="t">Use a pass automatically</div><div class="s">If your time runs out, spend a pass instead of losing the streak.</div></div>' + sw(S.settings.autoPass, 'toggleAutoPass') + '</div>' +
      '<div class="ch" style="border:0;padding:0"><div class="grow"><div class="s">Next pass</div><div class="prog">' + bar(m.sincePass / 7) + '<span>' + m.sincePass + '/7</span></div></div></div>' +
      '<button class="btn btn-ink btn-w" data-a="usePass"' + (m.passes > 0 && pAlive(m) ? '' : ' disabled') + '>Use a pass now, add 24 hours</button></div>';
  });
};
A.toggleAutoPass = () => { S.settings.autoPass = !S.settings.autoPass; save(); drawSheets(false); };
A.usePass = () => { if (useRestPass(true)) { save(); refresh(); } };
