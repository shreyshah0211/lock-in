/* A read of your week with a plan, the first-run intro, and widget previews. */
function hourLbl(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
function daysSince(type) { for (let i = S.checkins.length - 1; i >= 0; i--) if (S.checkins[i].type === type) return Math.floor((now() - S.checkins[i].ts) / DAY); return 999; }
function weeklyRead() {
  const t = now(), a = checkinsSince(t - 7 * DAY), b = S.checkins.filter(c => c.ts >= t - 14 * DAY && c.ts < t - 7 * DAY), out = [];
  out.push('You checked in ' + plural(a.length, 'time') + ' in the last 7 days' + (b.length ? ', ' + (a.length > b.length ? (a.length - b.length) + ' more than' : a.length < b.length ? (b.length - a.length) + ' fewer than' : 'the same as') + ' the week before.' : '.'));
  const neg = ['push', 'pull', 'legs', 'cardio'].map(k => ({ k: k, d: daysSince(k) })).sort((x, y) => y.d - x.d)[0];
  if (neg.d >= 6) out.push(neg.d >= 999 ? 'You have not logged a ' + TYPE[neg.k].n.toLowerCase() + ' session yet.' : TYPE[neg.k].n + ' has not shown up in ' + neg.d + ' days.');
  const hrs = {}; S.checkins.slice(-30).forEach(c => { const h = new Date(c.ts).getHours(); hrs[h] = (hrs[h] || 0) + 1; });
  const top = Object.keys(hrs).sort((x, y) => hrs[y] - hrs[x])[0];
  if (top !== undefined) out.push('You usually check in around ' + hourLbl(+top) + '.');
  return out;
}
function rulePlan() {
  return ['push', 'pull', 'legs', 'cardio', 'core'].map(k => ({ k: k, d: daysSince(k) })).sort((x, y) => y.d - x.d).slice(0, 3)
    .map(o => ({ focus: TYPE[o.k].n, why: o.d >= 999 ? 'You have not logged one yet.' : o.d === 0 ? 'Keeps your split balanced.' : 'Last one was ' + plural(o.d, 'day') + ' ago.' }));
}
function planEvents(items) {
  // three sessions, two days apart, at the hour the person usually trains
  const hrs = {}; S.checkins.slice(-30).forEach(c => { const h = new Date(c.ts).getHours(); hrs[h] = (hrs[h] || 0) + 1; });
  const hour = +(Object.keys(hrs).sort((x, y) => hrs[y] - hrs[x])[0] || 18), base = realTime(now());
  return items.map((it, i) => { const d = new Date(base + (i * 2 + 1) * DAY); d.setHours(hour, 0, 0, 0); return { title: 'Lock In: ' + it.focus, start: d.getTime(), end: d.getTime() + HOUR, desc: it.why }; });
}
A.openPlan = async () => {
  D.plan = { state: 'working', items: [] };
  const d = D.plan;
  openSheet(() => {
    if (d.state === 'working') return sheetHead('Your next 3 sessions') + '<div class="sh-b"><div class="aicheck"><span class="spin"></span>Looking at your last two weeks</div></div>';
    const evs = planEvents(d.items);
    return sheetHead('Your next 3 sessions') + '<div class="sh-b"><ol class="plan">' + d.items.map((it, i) => '<li><span class="n">' + (i + 1) + '</span><div><b>' + esc(it.focus) + '</b><span class="mute" style="display:block;font-size:13px;font-weight:600">' + dateLong(evs[i].start) + ', ' + clock(evs[i].start) + '</span><p>' + esc(it.why) + '</p></div></li>').join('') + '</ol>' +
      '<div class="aicheck' + (d.state === 'ai' ? ' ok' : '') + '">' + (d.state === 'ai' ? ic('sparkle', 18) + 'Written by Claude from your recent check-ins.' : ic('info', 18) + 'Built from what you have trained least recently.') + '</div>' + calControl('plan', _mcp ? 'Add all three to Google Calendar' : 'Add the first to Google Calendar') + '</div>';
  });
  const ai = await getAI(), done = (items, state) => { if (D.plan !== d) return; d.items = items; d.state = state; const evs = planEvents(items); calSet('plan', Object.assign({}, evs[0], { many: evs })); if (sheets.length) drawSheets(false); };
  if (!ai) { setTimeout(() => done(rulePlan(), 'rule'), 500); return; }
  const recent = S.checkins.slice(-14).map(c => Math.floor((now() - c.ts) / DAY) + 'd ago: ' + TYPE[c.type].n + ', ' + c.mins + ' min, ' + EFFORT[c.effort].toLowerCase()).join('\n');
  try {
    const res = await ai.json('You are helping someone plan gym sessions in a habit app. They aim for ' + S.me.goalPerWeek + ' sessions a week. Their recent sessions, newest last:\n' + recent + '\n\nSuggest their next 3 sessions so the week stays balanced and recovery makes sense. Reply with only a JSON array of exactly 3 objects like {"focus": "Pull", "why": "one short plain sentence"}. "focus" must be one of: Push, Pull, Legs, Upper body, Full body, Cardio, Core, Stretch.', { modelTier: 'quick' });
    const items = Array.isArray(res) ? res.slice(0, 3).map(x => ({ focus: String(x.focus || '').slice(0, 24), why: String(x.why || '').slice(0, 160) })).filter(x => x.focus) : [];
    if (items.length === 3) done(items, 'ai'); else done(rulePlan(), 'rule');
  } catch (e) { aiFail(e); done(rulePlan(), 'rule'); }
};

/* ---- first-run intro: four screens, then the camera ----
   The last screen sets your own targets and shows them in the real nutrition bar,
   so the first thing the app counts toward is yours. From there you either start
   your own streak from zero or look around the sample first. */
const INTRO_N = 4;
function introTargets() {
  const g = S.goals, step = (k, label, val, unit, d) => '<div class="it-row"><span><b>' + label + '</b><small>' + unit + '</small></span><div class="stepper"><button data-a="introStep" data-k="' + k + '" data-d="' + (-d) + '" aria-label="Less">' + ic('minus') + '</button><span class="v">' + fmtN(val) + '</span><button data-a="introStep" data-k="' + k + '" data-d="' + d + '" aria-label="More">' + ic('plus') + '</button></div></div>';
  return '<div class="intro-targets">' + step('gym', 'Gym', S.me.goalPerWeek, 'check-ins a week', 1) + step('kcal', 'Calories', g.kcal, 'a day', 100) + step('p', 'Protein', g.p, 'grams a day', 10) +
    '<div class="it-bar"><small>Your day so far, against your targets</small>' + nutritionBar(foodDay(now()), false) + '</div></div>';
}
A.openIntro = () => {
  D.intro = 0;
  openSheet(() => {
    const i = D.intro, fr = following().slice(0, 4), last = i === INTRO_N - 1;
    const steps = [
      { art: dial(216, WINDOW * 0.74, 23, { mid: '<b>35:30</b><span>hours left</span>' }), t: 'One gym photo. 48 hours.', s: 'Every check-in puts 48 hours on your clock. Post the next one before it runs out.' },
      { art: '<div class="intro-snap"><span class="snap-demo">' + ic('camera', 54) + '</span><div><span>' + ic('dumbbell', 18) + 'Gym photo, your streak grows</span><span>' + ic('bowl', 18) + 'Food photo, your calories are counted</span></div></div>', t: 'One button for everything', s: 'Snap your gym or your food. Lock In works out which it is and files it for you.' },
      { art: '<div class="intro-rings">' + fr.map(f => av(f, 76, { dark: true, nowarn: true })).join('') + '</div>', t: 'Your friends can see your clock', s: 'You can see theirs too. Nudge whoever is about to run out.' },
      { art: introTargets(), t: 'Set your own targets', s: 'Change them any time. Food stays private to you.' }
    ][i];
    return '<div class="intro"><button class="cam-ic" style="align-self:flex-end" data-a="closeSheet" aria-label="Skip the intro">' + ic('x') + '</button><div class="intro-art">' + steps.art + '</div><h2>' + steps.t + '</h2><p>' + steps.s + '</p>' +
      '<div class="dots">' + Array.from({ length: INTRO_N }, (_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') + '</div>' + (last && S.mode !== 'real' ? '<button class="btn btn-go btn-w" data-a="introReal"' + (D.realBusy ? ' disabled' : '') + '>' + (D.realBusy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>Checking your account' : ic('camera', 20) + 'Start my own streak') + '</button><button class="intro-skip" data-a="closeSheet">Look around the sample first</button>'
        : '<button class="btn btn-go btn-w" data-a="introNext">' + (last ? ic('camera', 20) + 'Take a photo' : 'Next') + '</button>') + '</div>';
  }, { cls: 'full dark', onClose: () => { if (S.ui.coach) { S.ui.coach = false; save(); } } });
};
A.introNext = () => { if (D.intro < INTRO_N - 1) { D.intro++; drawSheets(false); } else { closeAll(); A.goCam(); } };
A.introReal = async () => { await goReal(); closeAll(); A.goCam(); };
A.introStep = el => {
  const k = el.dataset.k, d = +el.dataset.d;
  if (k === 'gym') S.me.goalPerWeek = clamp(S.me.goalPerWeek + d, 1, 7); else S.goals[k] = clamp(S.goals[k] + d, k === 'kcal' ? 1200 : 40, k === 'kcal' ? 6000 : 300);
  save(); drawSheets(false);
};

/* ---- widget previews and reminders ---- */
A.openWidgets = () => openSheet(() => {
  const m = S.me, alive = pAlive(m), left = leftMs(), days = pDays(m), s = S.settings, close = following().filter(f => pAlive(f)).sort((a, b) => pLeft(a) - pLeft(b))[0];
  const row = (t, d, on, key) => '<div class="setrow"><div class="grow"><div class="t">' + t + '</div><div class="s">' + d + '</div></div>' + sw(on, 'setToggle', 'data-k="' + key + '"') + '</div>';
  return sheetHead('Widget and reminders', { back: true }) + '<div class="sh-b"><p class="mute">Your clock, where you already look. You should not have to open the app to know how long you have.</p>' +
    '<div class="wdg-row"><div class="wdg sq">' + dial(104, left, days, { mid: '<b style="font-size:26px">' + (alive ? fmtLeftShort(left) : '0h') + '</b><span>left</span>' }) + '<div class="wdg-s">' + flame(15, '#FF8A1E') + days + ' days</div></div>' +
    '<div class="wdg-col"><div class="wdg lock"><div class="wl"><span>' + flame(17, '#FF8A1E') + '<b>' + days + '</b></span><span>' + (alive ? fmtLeftShort(left) + ' left' : 'Clock ran out') + '</span></div><span class="wbar"><i style="width:' + (clamp(left / WINDOW, 0, 1) * 100).toFixed(0) + '%;background:' + timeColor(left, true) + '"></i></span></div>' +
    (close ? '<div class="wdg lock"><div class="wl"><span>' + esc(first(close.name)) + ', ' + fmtLeftShort(pLeft(close)) + ' left</span><span class="pill">Nudge</span></div></div>' : '') + '</div></div>' +
    '<p class="mute" style="font-size:13px">Previews of a home screen widget and two lock screen updates. The real app adds them to your phone.</p>' +
    '<div><h3 class="h2">Reminders</h3>' + row('My clock is running out', 'A heads-up 6 hours and 1 hour before.', s.remind.closing, 'remind.closing') + row('A friend needs a nudge', 'When someone you follow is about to lose a streak.', s.remind.friends, 'remind.friends') + '</div></div>';
}, { cls: 'full' });
