/* Goals from your body. Instead of guessing four numbers, say who you are and what
   you want, and Lock In works the targets out. You see the numbers before they are
   saved, and you can still type your own afterwards.

   - Energy: Mifflin-St Jeor for resting burn, times an activity factor.
   - Losing fat: a deficit of 0.25 to 1% of body weight a week (0.5% suggested).
   - Building muscle: a small surplus, 0.25 or 0.5% of body weight a week.
   - Protein: 1.8 g per kg, or 2.2 g per kg while losing fat, to hold on to muscle.
   - Fat: about 27% of calories, never under 0.6 g per kg. Carbs fill the rest. */
const ACT = [['Mostly sitting', 1.2, 'Desk days, little walking'], ['Lightly active', 1.375, 'On your feet some, or 1 to 2 workouts a week'], ['Active', 1.55, '3 to 5 workouts a week'], ['Very active', 1.725, 'Hard training most days'], ['Athlete', 1.9, 'Twice a day, or a physical job']];
const GOALS = [['lose', 'Lose fat'], ['keep', 'Stay the same'], ['gain', 'Build muscle']];
const PACE = { lose: [[.25, 'Gentle'], [.5, 'Steady'], [.75, 'Faster'], [1, 'Aggressive']], gain: [[.25, 'Lean'], [.5, 'Faster']] };
const KG_LB = 2.20462;

function bodyKg(b) { const w = +b.weight; return S.settings.units === 'kg' ? w : w / KG_LB; }
function bodyCm(b) { return S.settings.units === 'kg' ? +b.cm : ((+b.ft || 0) * 12 + (+b.inch || 0)) * 2.54; }
function bodyReady(b) { return bodyKg(b) >= 30 && bodyKg(b) <= 300 && bodyCm(b) >= 120 && bodyCm(b) <= 230 && +b.age >= 13 && +b.age <= 100; }
// The targets for a body, or null while something needed is missing.
function goalsFor(b) {
  if (!bodyReady(b)) return null;
  const w = bodyKg(b), h = bodyCm(b), a = +b.age;
  const bmr = 10 * w + 6.25 * h - 5 * a + (b.sex === 'f' ? -161 : 5), tdee = bmr * (ACT[b.act] || ACT[2])[1];
  const pace = b.goal === 'keep' ? 0 : +b.pace || .5, perDay = w * pace / 100 * 7700 / 7;   // about 7,700 kcal in a kilo of body fat
  const floor = b.sex === 'f' ? 1200 : 1500;
  const kcal = Math.round(Math.max(floor, b.goal === 'lose' ? tdee - perDay : b.goal === 'gain' ? tdee + perDay : tdee) / 10) * 10;
  const p = Math.round(w * (b.goal === 'lose' ? 2.2 : 1.8) / 5) * 5;
  const f = Math.round(Math.max(w * .6, kcal * .27 / 9));
  const c = Math.max(50, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal: kcal, p: p, c: c, f: f, tdee: Math.round(tdee / 10) * 10, perWeek: w * pace / 100 };
}
// When a target weight would be reached at this pace.
function goalDate(b, g) {
  const t = +b.target; if (!t || b.goal === 'keep' || !g || !g.perWeek) return null;
  const tk = S.settings.units === 'kg' ? t : t / KG_LB, w = bodyKg(b), diff = b.goal === 'lose' ? w - tk : tk - w;
  if (diff <= 0) return null;
  return now() + diff / g.perWeek * 7 * DAY;
}

A.openBodyGoals = () => {
  const lb = S.settings.units !== 'kg';
  D.body = Object.assign({ sex: 'm', age: '', weight: '', ft: '', inch: '', cm: '', act: 2, goal: 'keep', pace: .5, target: '' }, S.body || {});
  openSheet(bodySheet, { cls: 'full' });
  if (lb && !D.body.ft && D.body.cm) { const i = Math.round(D.body.cm / 2.54); D.body.ft = Math.floor(i / 12); D.body.inch = i % 12; }
};
function bodySheet() {
  const b = D.body; if (!b) return '';
  const lb = S.settings.units !== 'kg', u = lb ? 'lb' : 'kg';
  const num = (k, label, ph, extra) => '<div class="field"><label for="bg-' + k + '">' + label + '</label><input class="input" id="bg-' + k + '" type="number" inputmode="decimal" min="0" data-m="body.' + k + '" data-on="bodyLive" value="' + esc(b[k]) + '" placeholder="' + ph + '"' + (extra || '') + '></div>';
  const seg = (action, cur, list) => '<div class="seg">' + list.map(x => '<button data-a="' + action + '" data-k="' + x[0] + '" aria-pressed="' + (String(cur) === String(x[0])) + '">' + x[1] + '</button>').join('') + '</div>';
  let h = sheetHead('Set my goals', { back: true }) + '<div class="sh-b"><p class="mute">A few facts about you, and Lock In works out your calories and macros. You see them before anything is saved.</p>';
  h += '<div class="field"><span class="lbl">What do you want?</span>' + seg('bodyGoal', b.goal, GOALS) + '</div>';
  if (PACE[b.goal]) h += '<div class="field"><span class="lbl">How fast?</span>' + seg('bodyPace', b.pace, PACE[b.goal].map(p => [p[0], p[1]])) + '<p class="mute" style="font-size:13px">' + bodyPaceTxt(b) + '</p></div>';
  h += '<div class="field"><span class="lbl">Body</span>' + seg('bodySex', b.sex, [['m', 'Male'], ['f', 'Female']]) + '<p class="mute" style="font-size:12.5px">Used only for the resting-burn formula.</p></div>';
  h += '<div class="two">' + num('age', 'Age', '21') + num('weight', 'Weight, ' + u, lb ? '170' : '77') + '</div>';
  h += lb ? '<div class="two">' + num('ft', 'Height, feet', '5') + num('inch', 'Inches', '10') + '</div>' : num('cm', 'Height, cm', '178');
  h += '<div class="field"><span class="lbl">How active are you, gym included?</span><div class="rows bg-act">' + ACT.map((x, i) => '<button class="row" data-a="bodyAct" data-k="' + i + '" aria-pressed="' + (+b.act === i) + '"><span class="grow"><b>' + x[0] + '</b><small class="mute">' + x[2] + '</small></span>' + (+b.act === i ? ic('check', 20) : '') + '</button>').join('') + '</div></div>';
  if (b.goal !== 'keep') h += num('target', 'Goal weight, ' + u + ' (optional)', b.goal === 'lose' ? (lb ? '160' : '72') : (lb ? '180' : '82'));
  h += '<div id="bg-out">' + bodyOut(b) + '</div>';
  return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="bodySave"' + (goalsFor(b) ? '' : ' disabled') + ' id="bg-save">Use these goals</button></div>';
}
function bodyPaceTxt(b) {
  const w = bodyKg(b), lb = S.settings.units !== 'kg', per = w ? w * b.pace / 100 : 0;
  return 'About ' + b.pace + '% of your weight a week' + (per ? ', ' + (lb ? Math.round(per * KG_LB * 10) / 10 + ' lb' : Math.round(per * 10) / 10 + ' kg') : '') + '.' +
    (b.goal === 'lose' && b.pace >= 1 ? ' Fast loss costs more muscle and is harder to keep up.' : b.goal === 'lose' && b.pace === .5 ? ' A pace most people can hold.' : b.goal === 'gain' && b.pace === .25 ? ' Slow, to keep most of the gain as muscle.' : '');
}
function bodyOut(b) {
  const g = goalsFor(b);
  if (!g) return '<div class="aicheck">' + ic('info', 18) + '<span>Fill in your age, weight and height to see your numbers.</span></div>';
  const when = goalDate(b, g);
  return '<div class="card bg-res"><div class="mhead"><span class="mh-n"><b class="num">' + fmtN(g.kcal) + '</b>kcal a day</span><span class="mh-t">' + (b.goal === 'keep' ? 'Your maintenance' : 'You burn about ' + fmtN(g.tdee)) + '</span></div>' +
    '<div class="mmac"><span><b>' + g.p + ' g</b>protein</span><span><b>' + g.c + ' g</b>carbs</span><span><b>' + g.f + ' g</b>fat</span></div>' +
    (when ? '<p class="mute" style="font-size:13px;margin-top:10px">' + ic('calendar', 14) + ' At this pace you reach ' + esc(b.target) + ' ' + (S.settings.units === 'kg' ? 'kg' : 'lb') + ' around ' + dateLong(when) + '.</p>' : '') +
    '<p class="mute" style="font-size:12.5px;margin-top:8px">A starting point from a standard formula, not medical advice. If your weight is not moving the way you want after 2 to 3 weeks, adjust by about 100 to 200 kcal.</p></div>';
}
A.bodyLive = () => {
  const o = $('#bg-out'); if (o) o.innerHTML = bodyOut(D.body);
  const s = $('#bg-save'); if (s) s.disabled = !goalsFor(D.body);
};
A.bodyGoal = el => { const b = D.body; b.goal = el.dataset.k; if (PACE[b.goal] && !PACE[b.goal].some(p => p[0] === +b.pace)) b.pace = PACE[b.goal][Math.min(1, PACE[b.goal].length - 1)][0]; if (b.goal === 'gain') b.pace = .25; drawSheets(false); };
A.bodyPace = el => { D.body.pace = +el.dataset.k; drawSheets(false); };
A.bodySex = el => { D.body.sex = el.dataset.k; drawSheets(false); };
A.bodyAct = el => { D.body.act = +el.dataset.k; drawSheets(false); };
A.bodySave = () => {
  const b = D.body, g = goalsFor(b); if (!g) return;
  S.body = { sex: b.sex, age: +b.age, weight: +b.weight, ft: +b.ft || 0, inch: +b.inch || 0, cm: Math.round(bodyCm(b)), act: +b.act, goal: b.goal, pace: +b.pace, target: +b.target || null, at: now() };
  S.goals = { kcal: g.kcal, p: g.p, c: g.c, f: g.f };
  D.body = null; closeAll(); save(); refresh();
  toast('Goals set: ' + fmtN(g.kcal) + ' kcal and ' + g.p + ' g protein a day', 'check');
};
