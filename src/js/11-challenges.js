/* Compete: where you stand among friends this week, the squads you share a streak with,
   how those squads rank in the league, and the rewards mock-up. */
function ordinal(n) { const v = n % 100, s = ['th', 'st', 'nd', 'rd']; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function goalEnds(g) {
  // squad goals always have an end: the date they carry, or the end of this week or month
  if (g.ends) return g.ends;
  const d = new Date(now());
  return /week/i.test(g.title) ? weekStart(now()) + 7 * DAY : new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
function goalLeft(g) { const ms = goalEnds(g) - now(), d = Math.ceil(ms / DAY); return ms <= 0 ? 'ended' : d <= 1 ? 'ends today' : d + ' days left'; }
function rankCard(rows, me) {
  const above = rows[me.rk - 2], below = rows[me.rk];
  const line = above ? (above.pts - me.pts + 1) + ' more points puts you ahead of ' + esc(first(above.p.name)) + '.' : below ? 'You lead ' + esc(first(below.p.name)) + ' by ' + (me.pts - below.pts) + ' points.' : 'Follow a few friends to get a leaderboard.';
  return '<section class="rank"><div><span class="rk-l">Last 7 days</span><div class="rk-n"><span class="num">' + ordinal(me.rk) + '</span><span>of ' + rows.length + '</span></div></div><div class="rk-r"><span class="num">' + me.pts + '</span><span>effort points</span></div><p>' + line + '</p></section>';
}
function squadStreak(sq) {
  const ms = sq.members.map(person).filter(Boolean), down = ms.filter(p => !pAlive(p)), risk = ms.filter(p => pAlive(p) && pLeft(p) < 6 * HOUR);
  return { members: ms, down: down, risk: risk, days: down.length ? 0 : dayNum(now()) - dayNum(sq.since) + 1 };
}
function squadCard(sq) {
  const st = squadStreak(sq), d0 = st.down[0], r0 = st.risk[0];
  const line = d0 ? (d0.id === 'me' ? 'Your' : esc(first(d0.name)) + '\'s') + ' clock ran out, so the squad streak reset.' : r0 ? (r0.id === 'me' ? 'You have ' : esc(first(r0.name)) + ' has ') + fmtLeftShort(pLeft(r0)) + ' left. The squad streak is at risk.' : 'Everyone is on the clock.';
  return '<button class="squad" data-a="openSquad" data-id="' + sq.id + '"><span style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b style="font-size:17px">' + esc(sq.name) + '</b>' + streakChip(st.days, 20) + '</span>' +
    '<span style="display:flex;align-items:center;gap:12px"><span class="stack">' + st.members.map(p => av(p, 40, { nowarn: true })).join('') + '</span></span><span class="' + (st.risk.length || st.down.length ? 'down' : 'mute') + '" style="font-size:13.5px;font-weight:600">' + line + '</span>' +
    '<span class="ch" style="padding:0;border:0"><span class="grow"><span class="s" style="display:flex;justify-content:space-between;gap:10px"><span>' + esc(sq.goal.title) + '</span><span>' + goalLeft(sq.goal) + '</span></span><span class="prog">' + bar(sq.goal.have / sq.goal.need, 'var(--go)') + '<span>' + sq.goal.have + '/' + sq.goal.need + '</span></span></span></span></button>';
}
function lbRows() { return following().map(f => ({ p: f, pts: f.weekPts })).concat([{ p: S.me, pts: myWeekPts(), me: true }]).sort((a, b) => b.pts - a.pts).map((r, i) => Object.assign(r, { rk: i + 1 })); }
function lbRow(r) {
  return '<button data-a="openProfile" data-id="' + r.p.id + '" class="row' + (r.me ? ' me' : '') + '"><span class="rk">' + r.rk + '</span>' + av(r.p, 42, { nowarn: true }) + '<span class="grow"><span class="t" style="display:block">' + esc(r.me ? 'You' : r.p.name) + '</span>' + streakChip(pDays(r.p)) + '</span><span class="pts">' + r.pts + '<small>points</small></span></button>';
}
VIEWS.ch = () => {
  const rows = lbRows(), me = rows.find(r => r.me), top = rows.slice(0, 3), show = me.rk <= 3 ? top : top.concat([me]);
  let h = '<header class="top"><h1>Compete</h1></header>' + rankCard(rows, me);
  h += '<div class="sec" style="padding-top:18px"><div class="sec-h"><h2 class="h2">Friends</h2><button class="link" data-a="openBoard">All ' + rows.length + '</button></div><div class="rows lb">' + show.map(lbRow).join('') + '</div></div>';
  h += '<div class="sec"><div class="sec-h"><h2 class="h2">Squads</h2><button class="link" data-a="newSquad">New squad</button></div><div style="display:flex;flex-direction:column;gap:12px">' + (S.squads.length ? S.squads.map(squadCard).join('') : '<p class="empty">No squads yet. Start one with a few friends.</p>') + '</div></div>';
  h += leagueSection() + rewardsSection();
  h += '<p class="pad mute" style="font-size:13px;margin-top:18px">A squad shares one streak, and it only grows while everyone stays on the clock. Points come from how long and how hard you train, never from how you look.</p>';
  return h;
};
A.openBoard = () => openSheet(() => sheetHead('Friends, last 7 days', { back: true }) + '<div class="sh-b"><div class="rows lb">' + lbRows().map(lbRow).join('') + '</div></div>', { cls: 'full' });
A.newSquad = () => {
  D.ns = { name: '', invite: {} };
  openSheet(() => sheetHead('Start a squad') + '<div class="sh-b"><p class="mute">A squad shares one streak. It only grows while every member stays on the clock.</p><div class="field"><label for="ns-name">Squad name</label><input class="input" id="ns-name" data-m="ns.name" value="' + esc(D.ns.name) + '" placeholder="6 AM crew" maxlength="30" autocomplete="off"></div>' +
    '<div class="field"><span class="lbl">Who is in</span><div class="chips">' + following().map(f => '<button class="chip" data-a="nsInvite" data-id="' + f.id + '" aria-pressed="' + !!D.ns.invite[f.id] + '">' + esc(first(f.name)) + '</button>').join('') + '</div></div><button class="btn btn-go btn-w" data-a="nsCreate">Start squad</button></div>');
};
A.nsInvite = el => { D.ns.invite[el.dataset.id] = !D.ns.invite[el.dataset.id]; drawSheets(false); };
A.nsCreate = () => {
  const ids = Object.keys(D.ns.invite).filter(k => D.ns.invite[k]);
  if (!ids.length) { toast('Pick at least one friend for your squad.'); return; }
  S.squads.push({ id: 's' + uid(), name: D.ns.name.trim() || 'New squad', members: ['me'].concat(ids), since: now(), goal: { title: '20 check-ins together this month', have: 0, need: 20, ends: now() + 30 * DAY }, chat: [] });
  save(); closeSheet(); render(); toast('Squad started', 'check');
};
A.openSquad = el => {
  const id = el.dataset.id; D.sq = '';
  openSheet(() => {
    const sq = S.squads.find(x => x.id === id); if (!sq) return '';
    const st = squadStreak(sq);
    return sheetHead(sq.name, { back: true }) + '<div class="sh-b"><div class="card" style="display:flex;align-items:center;gap:14px"><div style="flex:1"><div class="mute" style="font-size:13px;font-weight:600">Squad streak</div><div class="num" style="font-size:54px">' + st.days + '<span style="font-size:20px;color:var(--mute)"> days</span></div></div><div style="flex:1.2"><div class="mute" style="font-size:13px;font-weight:600;margin-bottom:6px">' + esc(sq.goal.title) + '</div>' + bar(sq.goal.have / sq.goal.need, 'var(--go)') + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px"><span class="num" style="font-size:18px">' + sq.goal.have + '/' + sq.goal.need + '</span><span class="mute" style="font-size:12.5px;font-weight:600">' + goalLeft(sq.goal) + '</span></div></div></div>' +
      '<div><h3 class="h2" style="margin-bottom:4px">Members</h3><div class="rows">' + st.members.map(p => {
        const alive = pAlive(p), left = pLeft(p);
        return '<div class="row">' + av(p, 44) + '<div class="grow"><div class="t">' + esc(p.id === 'me' ? 'You' : p.name) + '</div><div class="s">' + (alive ? fmtLeft(left) + ' left' : 'Clock ran out') + '</div></div>' + streakChip(pDays(p)) + (p.id !== 'me' && alive && left < 12 * HOUR ? '<button class="btn btn-ink btn-s" data-a="nudge" data-id="' + p.id + '"' + (p.nudged ? ' disabled' : '') + '>' + (p.nudged ? 'Nudged' : 'Nudge') + '</button>' : '') + '</div>';
      }).join('') + '</div></div>' +
      '<div><h3 class="h2" style="margin-bottom:10px">Chat</h3><div class="chat">' + (sq.chat.length ? sq.chat.map(c => { const cu = person(c.uid) || S.me, me = c.uid === 'me'; return '<div class="msg' + (me ? ' mine' : '') + '">' + (me ? '' : avPlain(cu.name, cu.color, 28)) + '<p>' + (me ? '' : '<small>' + esc(first(cu.name)) + '</small>') + esc(c.text) + '</p></div>'; }).join('') : '<p class="mute">Nobody has said anything yet.</p>') + '</div>' +
      '<div class="send" style="margin-top:12px"><input class="input" id="sq-input" placeholder="Message the squad" data-m="sq" data-enter="sqSend" data-id="' + id + '" value="' + esc(D.sq || '') + '" autocomplete="off"><button class="btn btn-ink" data-a="sqSend" data-id="' + id + '" aria-label="Send">' + ic('send', 20) + '</button></div></div></div>';
  }, { cls: 'full' });
};
A.sqSend = el => {
  const sq = S.squads.find(x => x.id === el.dataset.id), text = (D.sq || '').trim(); if (!sq || !text) return;
  sq.chat.push({ uid: 'me', text: text, ts: now() }); D.sq = ''; save(); drawSheets(false);
  const i = $('#sq-input'); if (i) i.focus();
  const others = sq.members.filter(m => m !== 'me');
  if (others.length) setTimeout(() => { sq.chat.push({ uid: pick(Math.random, others), text: pick(Math.random, ['On it.', 'Say less.', 'See you there.', 'Someone hold me to this.', 'Count me in.']), ts: now() }); save(); if (sheets.length && document.activeElement && document.activeElement.id === 'sq-input') { const v = $('#sq-input').value; drawSheets(false); const n = $('#sq-input'); if (n) { n.value = v; n.focus(); } } else softRefresh(); }, 2600);
};
