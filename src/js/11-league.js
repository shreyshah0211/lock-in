/* The squad league and the rewards that could sit on top of it.
   Squads are ranked on check-ins per member, so a big squad cannot win on size,
   and only showing up counts: never weight lifted, never looks. The other squads
   are sample data. Rewards are a mock-up: nothing is real and nobody pays to enter. */
const LEAGUE_SEED = [['6 AM crew', 6, 3.9, '#C2610C'], ['Fourth floor west', 8, 3.4, '#2D6BE0'], ['Climbing club', 11, 3.1, '#17936A'], ['Row house', 9, 3.6, '#8C6FD6'], ['Intramural hoops', 7, 2.8, '#E0527A'], ['Chem study group', 5, 2.5, '#0E8F8F'], ['Late shift lifters', 4, 3.2, '#3B4A8A'], ['Greek Row runners', 12, 2.9, '#B03A8C'], ['Club swim', 10, 3.3, '#2AA7E8'], ['Commuter lot crew', 6, 2.2, '#6B7280']];
function seedLeague() {
  const t = now(), start = weekStart(t) - 6 * 7 * DAY;   // the quarter is in its seventh week
  const rows = LEAGUE_SEED.map((x, i) => ({ id: 'lg' + i, name: x[0], n: x[1], rate: x[2], color: x[3], total: Math.round(x[1] * x[2] * 6.45), week: Math.round(x[1] * x[2] * .45) }));
  rows.push({ id: 'lgcse', sq: 'cse', total: 107, week: 8 }, { id: 'lgf7', sq: 'f7', total: 68, week: 5 });
  return { start: start, weeks: 11, weekOf: weekStart(t), rows: rows };
}
function leagueName() { const m = new Date(S.league.start + 21 * DAY).getMonth(); return (m >= 8 ? 'Autumn' : m <= 2 ? 'Winter' : m <= 5 ? 'Spring' : 'Summer') + ' quarter'; }
function leagueWeek() { return clamp(Math.floor((now() - S.league.start) / (7 * DAY)) + 1, 1, S.league.weeks); }
// Standings, with your own squads kept in step with the squads you actually have.
function leagueRows(byWeek) {
  const L = S.league, wk = weekStart(now());
  if (wk > L.weekOf) {   // Monday: weekly standings start again
    L.rows.forEach(r => { if (!r.sq) { r.total += Math.round(r.n * r.rate * .55); r.week = Math.round(r.n * r.rate * .1); } else r.week = 0; });
    L.weekOf = wk; save();
  }
  S.squads.forEach(sq => { if (!L.rows.some(r => r.sq === sq.id)) L.rows.push({ id: 'lg' + sq.id, sq: sq.id, total: 0, week: 0 }); });
  return L.rows.map(r => {
    const sq = r.sq ? S.squads.find(x => x.id === r.sq) : null; if (r.sq && !sq) return null;
    const n = sq ? sq.members.length : r.n, v = (byWeek ? r.week : r.total) / n;
    return { r: r, name: sq ? sq.name : r.name, n: n, mine: !!sq, color: sq ? '#FF5A1F' : r.color, v: v };
  }).filter(Boolean).sort((a, b) => b.v - a.v).map((x, i) => Object.assign(x, { rk: i + 1 }));
}
function leagueBump() { S.league.rows.forEach(r => { const sq = r.sq && S.squads.find(x => x.id === r.sq); if (sq && sq.members.includes('me')) { r.total++; r.week++; } }); }
function leagueRow(x) {
  const inner = '<span class="rk">' + x.rk + '</span>' + avPlain(x.name, x.color, 42) + '<span class="grow"><span class="t" style="display:block">' + esc(x.name) + '</span><span class="mute" style="font-size:12.5px;font-weight:600">' + x.n + ' members' + (x.mine ? ', your squad' : '') + '</span></span><span class="pts">' + x.v.toFixed(1) + '<small>per member</small></span>';
  return x.mine ? '<button class="row me" data-a="openSquad" data-id="' + x.r.sq + '">' + inner + '</button>' : '<div class="row">' + inner + '</div>';
}
function leagueSeg() { const w = !!S.ui.lgWeek; return '<div class="seg" style="margin-bottom:6px"><button data-a="lgSeg" data-w="0" aria-pressed="' + !w + '">This quarter</button><button data-a="lgSeg" data-w="1" aria-pressed="' + w + '">This week</button></div>'; }
function leagueSection() {
  const rows = leagueRows(!!S.ui.lgWeek), top = rows.slice(0, 3), mine = rows.filter(x => x.mine && x.rk > 3), best = rows.find(x => x.mine);
  const above = best && best.rk > 1 ? rows[best.rk - 2] : null, need = above ? Math.ceil((above.v - best.v) * best.n + .001) : 0;
  return '<div class="sec"><div class="sec-h"><h2 class="h2">Squad league</h2><button class="link" data-a="openLeague">All ' + rows.length + ' squads</button></div>' +
    '<p class="sec-sub">' + leagueName() + ', week ' + leagueWeek() + ' of ' + S.league.weeks + '. Ranked on check-ins per member, so a big squad cannot win on size.</p>' + leagueSeg() +
    '<div class="rows lb">' + top.concat(mine).map(leagueRow).join('') + '</div>' +
    (best ? '<p class="lg-line">' + (above ? plural(need, 'more check-in') + ' from ' + esc(best.name) + ' and you pass ' + esc(above.name) + '.' : esc(best.name) + ' leads the league.') + '</p>' : '<p class="lg-line">Start or join a squad to enter the league.</p>') + '</div>';
}
A.lgSeg = el => { S.ui.lgWeek = el.dataset.w === '1'; save(); refresh(); };
A.openLeague = () => openSheet(() => {
  const rows = leagueRows(!!S.ui.lgWeek), end = S.league.start + S.league.weeks * 7 * DAY;
  return sheetHead('Squad league', { back: true }) + '<div class="sh-b"><p class="mute">' + leagueName() + ', week ' + leagueWeek() + ' of ' + S.league.weeks + '. It ends ' + dateLong(end - DAY) + '.</p>' + leagueSeg() +
    '<div class="rows lb">' + rows.map(leagueRow).join('') + '</div>' +
    '<div class="card"><div class="card-k">How the league is scored</div><p style="font-size:14px">A squad\'s score is its check-ins divided by its members. Every kind of check-in counts the same. Weight lifted, effort points and photos play no part, and the board shows squads, never individual people. Weekly standings start again each Monday.</p></div>' +
    '<p class="mute" style="font-size:13px">Your squads are real. The other squads are sample data.</p></div>';
}, { cls: 'full' });

/* ---- rewards, as a mock-up ---- */
const PERKS = { 7: 'a free coffee', 30: 'a free smoothie', 100: 'a Lock In shirt', 365: 'a year of free smoothies' };
function drawEntries() {
  // one entry for each week of the quarter in which you reached your weekly goal
  let n = 0; const L = S.league;
  for (let w = 0; w < leagueWeek(); w++) { const a = L.start + w * 7 * DAY, b = a + 7 * DAY; if (S.checkins.filter(c => c.ts >= a && c.ts < b).length >= S.me.goalPerWeek) n++; }
  return n;
}
function rewardList() {
  const m = S.me, days = pDays(m), best = Math.max(m.best || 0, days), nx = nextMilestone(days), got = MILESTONES.filter(x => best >= x), pot = S.league.rows.reduce((a, r) => a + r.total, 0), en = drawEntries();
  return [
    { k: 'comeback', icon: 'bolt', t: 'Comeback bonus', v: '+' + COMEBACK_PTS, s: m.lost && !pAlive(m) ? 'Ready now. Your next check-in earns ' + COMEBACK_PTS + ' extra points.' : 'If a streak ends, your first check-in back earns ' + COMEBACK_PTS + ' extra points.',
      d: 'Missing a window is when people quit for good. The first check-in after a streak ends earns ' + COMEBACK_PTS + ' extra effort points, so coming back is worth more than staying away. This one already works in the prototype.' },
    { k: 'perk', icon: 'crown', t: 'Milestone perks', v: got.length + ' of ' + MILESTONES.length, s: nx ? plural(nx - days, 'day') + ' to ' + PERKS[nx] + ' at ' + nx + ' days.' : 'Every milestone reached.',
      d: 'A streak milestone unlocks a small perk from a business near campus, shown as a code at the counter.' },
    { k: 'draw', icon: 'target', t: 'Quarterly draw', v: en + (en === 1 ? ' entry' : ' entries'), s: 'Free to enter. Every week you hit your goal adds an entry.',
      d: 'One prize is drawn when the quarter ends, paid for by a sponsor. Entry is free and automatic: each week you reach your own weekly goal adds one entry, so a beginner aiming for 2 sessions has the same chance as someone aiming for 6.' },
    { k: 'cause', icon: 'heart', t: 'Squad cause', v: '$' + fmtN(pot), s: 'A sponsor gives $1 for every squad check-in. The winning squad picks the cause.',
      d: 'Every check-in by a squad member adds $1 from a sponsor to one shared total. When the quarter ends, the squad at the top of the league chooses the campus cause it goes to. Members never pay in and never get paid out.' }
  ];
}
// One row on Compete; the list opens on its own sheet.
function rewardsSection() {
  return '<div class="sec"><div class="menu" style="margin:0">' + menuRow('openRewards', 'crown', 'Rewards', 'Sample: how prizes could work') + '</div></div>';
}
A.openRewards = () => openSheet(() => sheetHead('Rewards') + '<div class="sh-b"><p class="mute">How prizes could work. None of it is real yet, and nobody ever pays to enter.</p>' + rewardsList() + '</div>', { cls: 'full' });
function rewardsList() {
  return '<div class="conn-list">' +
    rewardList().map(r => '<button class="conn" data-a="openReward" data-k="' + r.k + '"><span class="conn-ic">' + ic(r.icon, 22) + '</span><span class="grow"><b>' + r.t + '</b><span>' + r.s + '</span></span><span class="rw-v">' + r.v + '</span></button>').join('') + '</div>';
}
A.openReward = el => openSheet(() => {
  const r = rewardList().find(x => x.k === el.dataset.k), best = Math.max(S.me.best || 0, pDays(S.me));
  let extra = '';
  if (r.k === 'perk') extra = '<div class="card" style="padding:6px 16px"><div class="rows">' + MILESTONES.map(n => '<div class="row" style="padding:12px 0"><div class="grow"><div class="t" style="font-weight:700">' + n + ' days</div><div class="s mute" style="font-size:13px">' + PERKS[n].replace(/^a /, 'A ') + '</div></div>' + (best >= n ? '<span class="pill ok">' + ic('check', 13) + 'Code SAMPLE-' + n + '</span>' : '<span class="pill">' + ic('lock', 12) + 'Locked</span>') + '</div>').join('') + '</div></div>';
  if (r.k === 'draw') extra = '<div class="two"><div class="tile"><div class="k">Your entries</div><div class="v">' + drawEntries() + '</div><div class="d">Weeks you hit your goal of ' + S.me.goalPerWeek + '.</div></div><div class="tile"><div class="k">Drawn</div><div class="v" style="font-size:26px;line-height:1.15">' + dateLong(S.league.start + S.league.weeks * 7 * DAY - DAY) + '</div><div class="d">When the quarter ends.</div></div></div>';
  if (r.k === 'cause') extra = '<div class="card"><div class="mute" style="font-size:13px;font-weight:600">Raised so far this quarter</div><div class="num" style="font-size:54px;margin-top:8px">' + r.v + '</div><div class="mute" style="font-size:13.5px;margin-top:4px">Across ' + S.league.rows.length + ' squads.</div></div>';
  return sheetHead(r.t) + '<div class="sh-b"><p>' + r.d + '</p>' + extra + '<div class="aicheck">' + ic('info', 18) + '<span>Sample. No sponsor has agreed to anything, no money moves in this prototype, and the real thing would need official rules and legal review first.</span></div></div>';
});
