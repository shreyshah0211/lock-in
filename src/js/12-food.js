/* Food: its own tab, led by the nutrition bar. Private by default.
   The bar stays on top. Everything more detailed sits under it or one tap down,
   and going over a target is stated plainly, never coloured as a failure. */
// The nutrition bar: how much of today's goal is eaten, with the three macros under it.
function nutritionBar(fd, big) {
  const t = dayTotals(fd), g = S.goals, kc = S.ui.showKcal !== false, have = kc ? t.kcal : t.p, goal = kc ? g.kcal : g.p, left = goal - have, unit = kc ? 'kcal' : 'g protein';
  const macro = (k, label, color) => '<div class="macro"><div class="l">' + label + '<span>' + Math.round(t[k]) + ' of ' + g[k] + ' g</span></div>' + bar(t[k] / g[k], color) + '</div>';
  return '<div class="nbar' + (big ? ' big' : '') + '"><div class="nb-top"><span class="nb-n"><b class="num">' + fmtN(Math.abs(Math.round(left))) + '</b>' + unit + (left >= 0 ? ' left' : ' over') + '</span><span class="nb-of">' + fmtN(Math.round(have)) + ' of ' + fmtN(goal) + '</span></div>' +
    '<div class="nb-bar"><i style="width:' + (clamp(have / goal, 0, 1) * 100).toFixed(1) + '%"></i></div>' +
    (kc ? '<div class="macros' + (big ? '' : ' mini') + '">' + macro('p', 'Protein', 'var(--protein)') + macro('c', 'Carbs', 'var(--carbs)') + macro('f', 'Fat', 'var(--fat)') + '</div>' : '') + '</div>';
}
function dayLabel(fd) { const t = foodDay(now()); return fd === t ? 'Today' : fd === t - 1 ? 'Yesterday' : dateLong(dayStart(fd)); }
function mealImg(m) { return (m.photo && photoSrc(m.photo)) || (m.img && /^https:\/\//.test(m.img) ? esc(m.img) : '') || mealURI(m.art.kind, m.art.seed); }
// Fibre and sodium for a meal: what Claude estimated, or the built-in figure for a built-in food.
function mealX(m) { return m.fib != null || m.na != null ? [m.fib || 0, m.na || 0] : FOOD_X[m.name] || null; }
// The last seven days: how many had anything logged, and the daily average over the finished ones.
function foodWeek() {
  const today = foodDay(now()), days = [];
  for (let d = today - 6; d <= today; d++) days.push(Object.assign({ d: d }, dayTotals(d)));
  const full = days.filter(x => x.d < today && x.meals.length), avg = k => full.length ? full.reduce((a, x) => a + x[k], 0) / full.length : 0;
  return { days: days, logged: days.filter(x => x.meals.length).length, full: full.length, kcal: avg('kcal'), p: avg('p') };
}
function foodWeekCard(fd) {
  const g = S.goals, kc = S.ui.showKcal !== false, k = kc ? 'kcal' : 'p', goal = g[k], w = foodWeek(), today = foodDay(now());
  const stat = (v, label) => '<div><b class="num">' + v + '</b><span>' + label + '</span></div>';
  let h = '<div class="card"><div class="wkstats">' + stat(w.logged + ' of 7', 'days logged') + (kc ? stat(fmtN(w.kcal), 'kcal a day') : '') + stat(Math.round(w.p) + ' g', 'protein a day') + '</div>';
  if (w.logged < 2) return h + '<p class="thresh">Log meals on 2 different days and your week shows up here as a chart.</p></div>';
  const scaleMax = Math.max(goal * 1.18, ...w.days.map(x => x[k]));
  h += '<div class="week"><div class="goal-line" style="bottom:calc(' + (goal / scaleMax * 82).toFixed(1) + '% + 19px)"><span>goal ' + fmtN(goal) + (kc ? '' : ' g') + '</span></div>' +
    w.days.map(x => '<button class="col' + (x.d === today ? ' today' : '') + (x.d === fd ? ' sel' : '') + '" data-a="foodGo" data-off="' + (x.d - today) + '" aria-label="' + dateLong(dayStart(x.d)) + ', ' + Math.round(x[k]) + (kc ? ' kcal' : ' g protein') + '"><i style="height:' + (x[k] / scaleMax * 82).toFixed(1) + '%"></i><span>' + WD[new Date(dayStart(x.d)).getDay()][0] + '</span></button>').join('') + '</div>';
  return h + '<p class="thresh">' + (kc ? 'Calories' : 'Protein') + ' per day. Tap a day to open it. The daily averages leave out today, because it is not finished.</p></div>';
}
function foodBody() {
  const off = S.ui.foodOff || 0, today = foodDay(now()), fd = today + off, t = dayTotals(fd), run = proteinRun(), kc = S.ui.showKcal !== false;
  let h = '<div class="seg"><button data-a="foodMode" data-k="1" aria-pressed="' + kc + '">Calories and macros</button><button data-a="foodMode" data-k="0" aria-pressed="' + !kc + '">Protein only</button></div>';
  h += '<div class="card">' + nutritionBar(fd, true) + (run > 0 ? '<div style="margin-top:14px"><span class="pill" style="background:#E3EEFF;color:#1B4FB5">' + ic('check', 14) + 'Protein goal ' + plural(run, 'day') + ' running</span></div>' : '') + '</div>';
  h += waterCard(fd);
  if (off === 0) {
    const rec = recentMeals();
    if (rec.length) h += '<div><div class="sec-h" style="margin-bottom:6px"><h2 class="h2">Log again</h2><span class="mute" style="font-size:13px;font-weight:600">one tap, same numbers</span></div><div class="again hscroll">' +
      rec.map(x => '<button data-a="mealAgain" data-id="' + x.m.id + '" aria-label="Log ' + esc(x.m.name) + ' again"><img src="' + mealImg(x.m) + '" alt=""><span class="grow"><b>' + esc(x.m.name) + '</b><small>' + (kc ? fmtN(x.m.kcal) + ' kcal, ' : '') + x.m.p + ' g protein</small></span><span class="plus">' + ic('plus', 18) + '</span></button>').join('') + '</div></div>';
  }
  const viaHealth = conn().health || conn().hconnect;
  h += '<div><div class="sec-h"><h2 class="h2">' + (off === 0 ? 'Meals today' : 'Meals') + '</h2>' + (off === 0 ? '<button class="link" data-a="openCapture">' + ic('plus', 15) + 'Add</button>' : '') + '</div>' +
    (t.meals.length ? '<div>' + t.meals.map(m => '<div class="mswipe"><div class="mswipe-acts"><button class="sw-edit" data-a="mealEdit" data-id="' + m.id + '">' + ic('pencil', 20) + 'Edit</button><button class="sw-del" data-a="mealDel" data-id="' + m.id + '">' + ic('trash', 20) + 'Delete</button></div>' +
      '<button class="meal" data-a="openMeal" data-id="' + m.id + '"><img src="' + mealImg(m) + '" alt=""><span class="grow"><span class="t" style="display:block;font-weight:700">' + esc(m.name) + '</span><span class="mute" style="font-size:13px">' + SLOTS.find(s => s[0] === m.slot)[1] + ', ' + clock(m.ts) + (m.est ? ', estimate' : '') + '</span></span><span class="k">' + (kc ? fmtN(m.kcal) + '<i>kcal</i>' : m.p + '<i>g</i>') + '<small>' + (kc ? m.p + ' g protein' : 'protein') + '</small></span></button></div>').join('') + '</div>' + (off === 0 && t.meals.length && !S.ui.swipeSeen ? '<p class="mute sw-tip">' + ic('info', 14) + 'Swipe a meal left to edit or delete it.</p>' : '')
      : '<p class="empty" style="padding:18px 0">Nothing logged ' + (off === 0 ? 'yet today. Tap Snap, or Add above, to log your first meal.' : 'on this day.') + '</p>') + '</div>';
  h += '<div><div class="sec-h"><h2 class="h2">Last 7 days</h2></div>' + foodWeekCard(fd) + '</div>';
  h += '<div class="menu" style="margin:0">' + menuRow('openGoals', 'target', 'Daily goals', S.body ? fmtN(S.goals.kcal) + ' kcal, ' + S.goals.p + ' g protein' : 'Set them from your body in 30 seconds') +
    menuRow('openNutrients', 'drop', 'Fibre and sodium', (off === 0 ? 'Today' : dayLabel(fd)) + ', as rough estimates') + '</div>';
  h += '<p class="mute" style="font-size:13px;display:flex;gap:8px;align-items:flex-start">' + ic('lock', 16) + '<span>Only you can see your food.' + (viaHealth ? ' Meals logged in other apps come in through ' + (conn().health ? 'Apple Health' : 'Health Connect') + '.' : '') + '</span></p>';
  return h;
}
VIEWS.food = () => {
  const off = S.ui.foodOff || 0;
  return '<header class="top"><h1>Food</h1><div class="daynav"><button data-a="foodDay" data-d="-1" aria-label="Previous day"' + (off <= -6 ? ' disabled' : '') + '>' + ic('chevL', 18) + '</button><b>' + dayLabel(foodDay(now()) + off) + '</b><button data-a="foodDay" data-d="1" aria-label="Next day"' + (off >= 0 ? ' disabled' : '') + '>' + ic('chevR', 18) + '</button></div></header>' +
    '<div class="pad vstack">' + foodBody() + '</div>';
};
A.openFood = () => { S.ui.tab = 'food'; S.ui.foodOff = 0; closeAll(); scrollPos.food = 0; render(); save(); };
A.foodDay = el => { S.ui.foodOff = clamp((S.ui.foodOff || 0) + (+el.dataset.d), -6, 0); render(); };
A.foodGo = el => { S.ui.foodOff = +el.dataset.off; render(); $('#view').scrollTop = 0; };
A.foodMode = el => { S.ui.showKcal = el.dataset.k === '1'; save(); refresh(); };
A.scanMeal = (el, e) => openCam('meal', e);
A.openMeal = el => {
  const id = el.dataset.id;
  openSheet(() => {
    const m = S.meals.find(x => x.id === id); if (!m) return '';
    const x = mealX(m);
    return sheetHead(m.name) + '<div class="sh-b"><div class="prev sq"><img src="' + mealImg(m) + '" alt=""></div>' +
      '<div class="stats" style="margin:0"><div><b>' + m.kcal + '</b><span>kcal</span></div><div><b>' + m.p + '</b><span>g protein</span></div><div><b>' + m.c + '</b><span>g carbs</span></div><div><b>' + m.f + '</b><span>g fat</span></div></div>' +
      '<p class="mute" style="font-size:13.5px">' + SLOTS.find(s => s[0] === m.slot)[1] + ', ' + dateLong(m.ts) + ' at ' + clock(m.ts) + (m.est ? '. A rough estimate from a photo or description.' : '.') + (x ? ' About ' + x[0] + ' g fibre and ' + fmtN(x[1]) + ' mg sodium.' : '') + '</p>' +
      '<div class="two"><button class="btn btn-ink" data-a="mealEdit" data-id="' + id + '">' + ic('pencil', 18) + 'Edit</button><button class="btn btn-line" data-a="delMeal" data-id="' + id + '">' + ic('trash', 18) + 'Remove</button></div></div>';
  });
};
A.delMeal = el => { S.meals = S.meals.filter(m => m.id !== el.dataset.id); (S.gone || (S.gone = {}))[el.dataset.id] = now(); save(); closeSheet(); refresh(); toast('Meal removed'); };
// Fibre and sodium live one tap down: useful to some people, noise to most.
const FIBRE_GUIDE = 30, SODIUM_GUIDE = 2300;
A.openNutrients = () => openSheet(() => {
  const fd = foodDay(now()) + (S.ui.foodOff || 0), meals = dayTotals(fd).meals, known = meals.filter(mealX), fib = known.reduce((a, m) => a + mealX(m)[0], 0), na = known.reduce((a, m) => a + mealX(m)[1], 0), miss = meals.length - known.length;
  return sheetHead('Fibre and sodium') + '<div class="sh-b"><p class="mute">' + dayLabel(fd) + '. These are rougher than the calories, so read them as a direction, not a measurement.</p>' +
    '<div class="two"><div class="tile"><div class="k">Fibre</div><div class="v">' + Math.round(fib) + '<small>g</small></div>' + bar(fib / FIBRE_GUIDE, 'var(--carbs)') + '<div class="d">A common guide is about ' + FIBRE_GUIDE + ' g a day.</div></div>' +
    '<div class="tile"><div class="k">Sodium</div><div class="v">' + fmtN(na) + '<small>mg</small></div>' + bar(na / SODIUM_GUIDE, 'var(--iron)') + '<div class="d">A common guide is under ' + fmtN(SODIUM_GUIDE) + ' mg a day.</div></div></div>' +
    (known.length ? '<div class="card" style="padding:6px 16px"><div class="rows">' + known.map(m => '<div class="row" style="padding:10px 0"><div class="grow">' + esc(m.name) + '</div><span class="mute" style="font-size:13px;font-weight:600;white-space:nowrap">' + mealX(m)[0] + ' g, ' + fmtN(mealX(m)[1]) + ' mg</span></div>').join('') + '</div></div>' : '<p class="empty" style="padding:8px 0">Nothing logged on this day yet.</p>') +
    (miss ? '<p class="mute" style="font-size:13px">' + plural(miss, 'meal') + ' you typed in by hand ' + (miss === 1 ? 'has' : 'have') + ' no fibre or sodium figure, so the totals leave ' + (miss === 1 ? 'it' : 'them') + ' out.</p>' : '') +
    '<p class="mute" style="font-size:13px">General guides for adults, not advice for you. A dietitian or doctor can set numbers that fit you.</p></div>';
});
A.openGoals = () => {
  D.goals = Object.assign({}, S.goals);
  openSheet(() => {
    const f = (k, label, unit) => '<div class="field"><label for="gl-' + k + '">' + label + '</label><input class="input" id="gl-' + k + '" type="number" inputmode="numeric" min="0" data-m="goals.' + k + '" value="' + esc(D.goals[k]) + '" placeholder="' + unit + '"></div>';
    return sheetHead('Daily goals') + '<div class="sh-b"><button class="btn btn-go btn-w" data-a="openBodyGoals">' + ic('target', 19) + (S.body ? 'Work them out again from my body' : 'Work them out from my body') + '</button><p class="mute" style="font-size:13px">Or type your own:</p><div class="two">' + f('p', 'Protein, g', 'g') + f('kcal', 'Calories', 'kcal') + f('c', 'Carbs, g', 'g') + f('f', 'Fat, g', 'g') + '</div><button class="btn btn-ink btn-w" data-a="saveGoals">Save goals</button></div>';
  });
};
A.saveGoals = () => {
  const g = D.goals, lim = { kcal: [800, 8000], p: [10, 400], c: [10, 900], f: [10, 400] };
  Object.keys(lim).forEach(k => { const v = Math.round(+g[k]); if (isFinite(v) && v > 0) S.goals[k] = clamp(v, lim[k][0], lim[k][1]); });
  save(); closeSheet(); refresh(); toast('Goals saved', 'check');
};
