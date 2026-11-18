/* The friendlier layer: one capture button with a menu, a Today card on Home,
   next-weight suggestions, a weight log, and Coach. Nothing here removes a feature;
   it puts the ones that were already there where they are easier to reach. */

/* ---- one capture button ----
   The orange button opens every way to log something. Photo stays first and still
   works out on its own whether it is the gym or a meal. */
A.openCapture = () => {
  const si = snapInfo();
  openSheet(() => {
    const opt = (a, k, icon, t, s, extra) => '<button class="cap-o' + (extra || '') + '" data-a="' + a + '"' + (k ? ' data-k="' + k + '"' : '') + '><span class="cap-i">' + ic(icon, 24) + '</span><span class="grow"><b>' + t + '</b><small>' + s + '</small></span>' + ic('chevR', 18) + '</button>';
    return sheetHead('Log something') + '<div class="sh-b capture">' +
      (si.alive ? '<p class="cap-clock"><span class="dot" style="background:' + si.color + '"></span>' + fmtLeftShort(si.left) + ' left on your clock</p>' : si.rep ? '<p class="cap-clock warn"><span class="dot" style="background:' + si.color + '"></span>Snap a gym photo to save your streak</p>' : '') +
      opt('goCam', '', 'camera', 'Photo', todayCheckin() ? 'Checked in today. A gym photo adds a lift; a meal logs food.' : 'Gym check-in or a meal. Lock In works out which.', ' main') +
      opt('openLiftCam', '', 'dumbbell', 'Lift photo', 'Snap the machine or weights. Lock In reads the weight for today\'s workout.') +
      '<div class="cap-row">' +
      '<button class="cap-s" data-a="capGo" data-to="scanBarcode">' + ic('scan', 22) + '<b>Barcode</b></button>' +
      '<button class="cap-s" data-a="capGo" data-to="openSay" data-k="auto">' + ic('mic', 22) + '<b>Say it</b></button>' +
      '<button class="cap-s" data-a="capProgress">' + ic('lock', 22) + '<b>Progress</b></button>' +
      '<button class="cap-s" data-a="openWeigh">' + ic('trend', 22) + '<b>Weight</b></button></div>' +
      '<button class="link cap-nophoto" data-a="capGo" data-to="openNoPhoto">' + ic('info', 16) + 'No photos allowed in your gym?</button></div>';
  });
};
A.capProgress = (el, e) => openCam('progress', e);
// Each option replaces the menu rather than stacking on it, so closing it goes straight back.
A.capGo = (el, e) => { const fn = A[el.dataset.to]; closeAll(); if (fn) fn(el, e); };

/* ---- Today, on Home ---- */
function todayCard() {
  const t = dayTotals(foodDay(now())), g = S.goals, today = dayNum(now()), done = S.checkins.filter(c => dayNum(c.ts) === today).pop();
  const si = snapInfo(), ws = weekStats(), pGap = Math.max(0, Math.round(g.p - t.p)), kLeft = Math.round(g.kcal - t.kcal), hr = new Date(now()).getHours();
  const gym = done ? '<span class="td-ok">' + ic('check', 16) + '</span><span class="grow"><b>Trained today</b><small>' + esc(TYPE[done.type] ? TYPE[done.type].n : 'Workout') + ' at ' + clock(done.ts) + ((done.lifts || []).length ? ', ' + plural(done.lifts.length, 'lift') : '') + '</small></span><span class="btn btn-line btn-s">' + ic('plus', 15) + 'Lift</span>'
    : '<span class="td-dot" style="background:' + si.color + '"></span><span class="grow"><b>Not trained yet</b><small>' + (si.alive ? fmtLeftShort(si.left) + ' left on your clock' : 'Start your streak with a gym photo') + '</small></span><span class="btn btn-go btn-s">Check in</span>';
  let next;
  if (!done && si.alive && si.left < 12 * HOUR) next = ['bolt', 'Under 12 hours on your clock. A gym photo today keeps the streak.', 'openCapture', 'Check in'];
  else if (!done && ws.n < ws.goal) next = ['target', (ws.goal - ws.n) + ' more ' + (ws.goal - ws.n === 1 ? 'session' : 'sessions') + ' to hit ' + ws.goal + ' this week.', null, null];
  else if (pGap >= 25 && hr >= 14) next = ['sparkle', pGap + ' g protein to go today.', 'openCoach', 'Ideas'];
  else next = ['check', done ? 'Training done. Eat well and recover.' : 'On track today.', null, null];
  return '<div class="card today"><div class="td-h"><h2 class="h2">Today</h2><button class="link" data-a="openCoach">' + ic('sparkle', 15) + 'Ask Coach</button></div>' +
    '<button class="td-row" data-a="' + (done ? 'openLiftCam' : 'openCapture') + '">' + gym + '</button>' +
    '<button class="td-row td-food" data-a="openFood"><span class="grow"><span class="td-m"><b>' + fmtN(Math.round(t.p)) + '<small>/' + g.p + ' g</small></b><span>Protein</span>' + bar(t.p / g.p, 'var(--protein)') + '</span>' +
    '<span class="td-m"><b>' + fmtN(Math.abs(kLeft)) + '</b><span>kcal ' + (kLeft >= 0 ? 'left' : 'over') + '</span>' + bar(t.kcal / g.kcal, 'var(--iron)') + '</span>' +
    '<span class="td-m"><b>' + ws.n + '<small>/' + ws.goal + '</small></b><span>This week</span>' + bar(ws.n / ws.goal, 'var(--go)') + '</span></span></button>' +
    '<div class="td-next">' + ic(next[0], 16) + '<span class="grow">' + next[1] + '</span>' + (next[2] ? '<button class="link" data-a="' + next[2] + '">' + next[3] + '</button>' : '') + '</div></div>';
}

/* ---- next weight ----
   Plain double progression from your own last set: hit the reps and the weight goes
   up a small step next time; miss them and you stay and add a rep. */
const LOWER = /squat|deadlift|leg press|hip thrust|lunge|rdl|romanian/i;
function nextLift(name) {
  const a = S.lifts[name]; if (!a || !a.length) return null;
  const e = a[a.length - 1], kg = S.settings.units === 'kg', step = LOWER.test(name) ? (kg ? 5 : 10) : (kg ? 2.5 : 5);
  const recent = a.slice(-3), stalled = recent.length === 3 && recent.every(x => x.w === e.w && x.reps <= e.reps);
  if (stalled && e.reps < 5) return { w: Math.round(e.w * .9 / step) * step, reps: 5, why: 'Same weight three times: drop about 10% and build back up.' };
  if (e.reps >= 5) return { w: e.w + step, reps: Math.max(3, Math.min(e.reps, 8)), why: 'You got ' + e.reps + ' reps last time: add ' + step + ' ' + S.settings.units + '.' };
  return { w: e.w, reps: e.reps + 1, why: 'Stay at ' + e.w + ' and add a rep.' };
}
function liftHints(d) {
  const named = d.lifts.map((l, i) => [i, String(l.name || '').trim()]).map(([i, n]) => [i, LIFT_NAMES.find(x => x.toLowerCase() === n.toLowerCase()) || n]).filter(([i, n]) => n && S.lifts[n] && S.lifts[n].length);
  if (!named.length) return '';
  return '<div class="lift-hints">' + named.map(([i, n]) => { const e = S.lifts[n][S.lifts[n].length - 1], nx = nextLift(n); return '<div class="lh">' + ic('trend', 15) + '<span class="grow"><b>' + esc(n) + '</b> last ' + e.w + ' × ' + e.reps + '. Try <b>' + nx.w + ' × ' + nx.reps + '</b></span><button class="link" data-a="ciUseNext" data-i="' + i + '" data-n="' + esc(n) + '">Use</button></div>'; }).join('') + '</div>';
}
A.ciUseNext = el => { const d = D.ci, l = d && d.lifts[+el.dataset.i], nx = nextLift(el.dataset.n); if (!l || !nx) return; l.w = nx.w; l.reps = nx.reps; drawSheets(false); };

/* ---- weight log ---- */
function weights() { return (S.weights || []).slice().sort((a, b) => a.ts - b.ts); }
const wUnit = () => S.settings.units === 'kg' ? 'kg' : 'lb';
const wShow = kg => Math.round((S.settings.units === 'kg' ? kg : kg * KG_LB) * 10) / 10;
// The trend: an average of the last 7 entries, and the change per week over the last 3 weeks.
function weightTrend() {
  const w = weights(); if (!w.length) return null;
  const last = w.slice(-7), avg = last.reduce((a, x) => a + x.kg, 0) / last.length;
  const recent = w.filter(x => x.ts > now() - 21 * DAY); let perWeek = null;
  if (recent.length >= 3 && recent[recent.length - 1].ts - recent[0].ts > 6 * DAY) {
    const n = recent.length, mt = recent.reduce((a, x) => a + x.ts, 0) / n, mk = recent.reduce((a, x) => a + x.kg, 0) / n;
    const slope = recent.reduce((a, x) => a + (x.ts - mt) * (x.kg - mk), 0) / (recent.reduce((a, x) => a + (x.ts - mt) * (x.ts - mt), 0) || 1);
    perWeek = slope * 7 * DAY;
  }
  return { latest: w[w.length - 1], avg: avg, perWeek: perWeek, n: w.length };
}
function weightCard() {
  const tr = weightTrend(), b = S.body, u = wUnit();
  if (!tr) return '<div class="card"><p class="empty" style="padding:6px 0">Log your weight now and then. Lock In shows the trend, not the daily noise.</p><button class="btn btn-ink btn-w" data-a="openWeigh">' + ic('plus', 18) + 'Log my weight</button></div>';
  const w = weights(), dir = tr.perWeek == null ? '' : Math.abs(tr.perWeek) < .05 ? 'Holding steady' : (tr.perWeek < 0 ? 'Down ' : 'Up ') + wShow(Math.abs(tr.perWeek)) + ' ' + u + ' a week';
  const aim = b && b.goal !== 'keep' && b.target ? ' Goal ' + b.target + ' ' + u + '.' : '';
  return '<div class="card"><div class="two"><div class="tile"><div class="k">Latest</div><div class="v">' + wShow(tr.latest.kg) + '<small>' + u + '</small></div><div class="d">' + dateLong(tr.latest.ts) + '</div></div><div class="tile"><div class="k">Trend</div><div class="v" style="font-size:20px">' + (dir || 'Log a few more') + '</div><div class="d">7-entry average ' + wShow(tr.avg) + ' ' + u + '.' + aim + '</div></div></div>' +
    (w.length > 1 ? '<div style="padding:12px 0 2px">' + lineChart(w.slice(-30).map(x => ({ ts: x.ts, w: wShow(x.kg) }))) + '</div>' : '') +
    '<button class="btn btn-ink btn-w" data-a="openWeigh">' + ic('plus', 18) + 'Log my weight</button></div>';
}
A.openWeigh = () => {
  const tr = weightTrend(); D.wg = { v: tr ? wShow(tr.latest.kg) : (S.body && S.body.weight) || '' };
  closeAll();
  openSheet(() => sheetHead('Log my weight') + '<div class="sh-b"><p class="mute">Weigh in the morning, before eating, for the steadiest trend.</p>' +
    '<div class="send"><input class="input" id="wg-v" type="number" inputmode="decimal" data-m="wg.v" data-enter="weighSave" value="' + esc(D.wg.v) + '"><span class="bc-unit">' + wUnit() + '</span></div>' +
    '<button class="btn btn-go btn-w" data-a="weighSave">Save</button></div>', { after: el => { const i = el && el.querySelector('#wg-v'); if (i) { i.focus(); i.select && i.select(); } } });
};
A.weighSave = () => {
  const v = +D.wg.v, kg = S.settings.units === 'kg' ? v : v / KG_LB;
  if (!(kg > 25 && kg < 350)) { toast('Enter your weight in ' + wUnit() + '.'); return; }
  S.weights = (S.weights || []).filter(x => dayNum(x.ts) !== dayNum(now())); S.weights.push({ ts: now(), kg: Math.round(kg * 10) / 10 });
  let msg = 'Weight saved';
  // Goals set from your body follow your weight.
  if (S.body) { S.body.weight = Math.round(v * 10) / 10; const g = goalsFor(S.body); if (g && (g.kcal !== S.goals.kcal || g.p !== S.goals.p)) { S.goals = { kcal: g.kcal, p: g.p, c: g.c, f: g.f }; msg = 'Saved. Goals now ' + fmtN(g.kcal) + ' kcal, ' + g.p + ' g protein'; } }
  closeAll(); save(); refresh(); toast(msg, 'check');
};

/* ---- Coach ----
   A chat with Claude that knows your training, food and goals. It only reads; it never changes anything. */
function coachContext() {
  const m = S.me, g = S.goals, t = dayTotals(foodDay(now())), ws = weekStats(), recent = checkinsSince(now() - 14 * DAY);
  const lifts = myLifts().slice(0, 8).map(n => { const a = S.lifts[n], e = a[a.length - 1]; return n + ' last ' + e.w + 'x' + e.reps + ' (best ' + Math.max(...a.map(x => x.w)) + ')'; }).join('; ');
  const tr = weightTrend(), b = S.body;
  return 'Streak: ' + pDays(m) + ' days, ' + (pAlive(m) ? fmtLeftShort(leftMs()) + ' left on the 48 hour clock' : 'not active') + '. Weekly goal ' + ws.goal + ' sessions, ' + ws.n + ' done this week. ' +
    'Last 14 days: ' + (recent.map(c => (TYPE[c.type] ? TYPE[c.type].n : c.type) + ' ' + c.mins + 'min').join(', ') || 'no check-ins') + '. ' +
    'Lifts in ' + S.settings.units + ': ' + (lifts || 'none logged') + '. ' +
    'Food today: ' + Math.round(t.kcal) + ' of ' + g.kcal + ' kcal, ' + Math.round(t.p) + ' of ' + g.p + ' g protein, ' + Math.round(t.c) + ' g carbs, ' + Math.round(t.f) + ' g fat. Meals: ' + (t.meals.map(x => x.name).join(', ') || 'none') + '. ' +
    'Foods they log often: ' + recentMeals().slice(0, 6).map(x => x.m.name + ' (' + x.m.p + ' g protein)').join(', ') + '. ' +
    (b ? 'Goal: ' + ({ lose: 'lose fat', keep: 'maintain', gain: 'build muscle' })[b.goal] + '. ' : '') + (tr ? 'Weight ' + wShow(tr.latest.kg) + ' ' + wUnit() + (tr.perWeek != null ? ', trend ' + wShow(tr.perWeek) + ' ' + wUnit() + ' a week' : '') + '. ' : '') +
    'Local time ' + clock(now()) + '.';
}
const COACH_ASK = ['What can I eat tonight to hit my protein?', 'What should I train tomorrow?', 'How is my week going?', 'How do I get my bench moving again?'];
A.openCoach = () => {
  closeAll();
  D.coach = { text: '', busy: false };
  openSheet(coachSheet, { cls: 'full', after: el => { const c = el && el.querySelector('.coach-log'); if (c) c.scrollTop = c.scrollHeight; } });
};
function coachSheet() {
  const c = D.coach; if (!c) return '';
  const log = S.coachLog || [];
  return sheetHead('Coach', { right: log.length ? '<button class="link" data-a="coachClear" style="margin-right:8px">Clear</button>' : '' }) + '<div class="sh-b coach">' +
    '<div class="coach-log">' + (log.length ? log.map(m => '<div class="msg' + (m.r === 'me' ? ' mine' : '') + '">' + (m.r === 'me' ? '' : '<span class="coach-av">' + ic('sparkle', 16) + '</span>') + '<p>' + esc(m.t).replace(/\n/g, '<br>') + '</p></div>').join('') :
      '<div class="coach-empty">' + ic('sparkle', 28) + '<b>Ask about your training or food</b><span>Coach sees your check-ins, lifts, meals and goals. It gives ideas; it never changes anything.</span></div>') +
      (c.busy ? '<div class="msg"><span class="coach-av">' + ic('sparkle', 16) + '</span><p><span class="spin"></span></p></div>' : '') + '</div>' +
    (log.length ? '' : '<div class="chips coach-q">' + COACH_ASK.map(q => '<button class="chip" data-a="coachAsk" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>') +
    '<div class="send"><input class="input" id="coach-in" placeholder="Ask Coach" data-m="coach.text" data-enter="coachSend" value="' + esc(c.text) + '" autocomplete="off"><button class="btn btn-ink" data-a="coachSend" aria-label="Send"' + (c.busy ? ' disabled' : '') + '>' + ic('send', 20) + '</button></div>' +
    '<p class="mute" style="font-size:12px">General fitness ideas, not medical advice.</p></div>';
}
A.coachAsk = el => { D.coach.text = el.dataset.q; A.coachSend(); };
A.coachClear = () => { S.coachLog = []; save(); drawSheets(false); };
A.coachSend = async () => {
  const c = D.coach; if (!c || c.busy) return;
  const q = String(c.text || '').trim(); if (!q) return;
  const log = S.coachLog || (S.coachLog = []);
  log.push({ r: 'me', t: q.slice(0, 500) }); c.text = ''; c.busy = true; drawSheets(false); coachScroll();
  const s = await getAI();
  let reply;
  if (!s) reply = 'Coach needs Claude switched on. In the iPhone app that means adding your API key; see the README.';
  else {
    try {
      const convo = log.slice(-10).map(m => (m.r === 'me' ? 'Them: ' : 'Coach: ') + m.t).join('\n');
      const res = await s.json('You are Coach inside Lock In, a gym habit app for someone who lifts. What you know about them right now: ' + coachContext() + '\n\nThe conversation so far:\n' + convo + '\n\n' +
        'Answer their last message. Be specific to their numbers and the foods they already eat. Plain words, speaking to them as "you", at most 110 words, short lines or a short list when it helps. No medical claims; if something sounds like an injury or a health problem, say to see a professional. ' +
        'Reply with only a JSON object like {"reply": "..."}.', { modelTier: 'quick' });
      reply = res && typeof res.reply === 'string' && res.reply.trim() ? res.reply.trim().slice(0, 1200) : 'Sorry, I did not get that. Try asking another way.';
    } catch (e) { aiFail(e); reply = 'Could not reach Coach just now. Check your connection and try again.'; }
  }
  log.push({ r: 'ai', t: reply }); if (log.length > 40) log.splice(0, log.length - 40);
  if (D.coach === c) c.busy = false;
  save(); drawSheets(false); coachScroll();
};
function coachScroll() { const l = $('.coach-log'); if (l) l.scrollTop = l.scrollHeight; }
