/* Meals. A photo estimate is a draft: Claude proposes, you confirm.
   Estimates from one photo run low and portion size is most of the error, so
   the review screen leads with portions, takes one line of correction, and
   shows a rounded number that says it is a rough estimate. */
const PORTION = [['S', 'Small', .7], ['M', 'Medium', 1], ['L', 'Large', 1.4]];
// What a sample photo is made of, so the portion controls have something to show.
const SAMPLE_ITEMS = { 'Veggie burrito bowl': [['Rice', 210], ['Black beans', 130], ['Vegetables and salsa', 90], ['Cheese and sour cream', 210]] };
// Fibre (g) and sodium (mg) for the built-in foods. Claude supplies them for real photos.
const FOOD_X = { 'Oatmeal with berries': [8, 120], 'Greek yogurt and granola': [3, 110], 'Veggie burrito bowl': [14, 980], 'Avocado toast with egg': [9, 420], 'Peanut butter toast': [5, 380], 'Protein shake': [2, 210], 'Pasta with tomato sauce': [7, 720], 'Big salad with feta': [7, 640], 'Falafel wrap': [10, 1050], 'Eggs and toast': [3, 520], 'Protein bar': [6, 190], 'Tofu stir-fry with rice': [6, 890], 'Cheese pizza, two slices': [4, 1180], 'Chicken and rice': [3, 760], 'Banana': [3, 1] };
function slotNow() { const h = new Date(now()).getHours(); return h < 4 ? 'snack' : h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : h < 22 ? 'dinner' : 'snack'; }
const round10 = v => Math.round(v / 10) * 10;
const isEstimate = st => st === 'ai' || st === 'sample' || st === 'guess';

// How far the portions have moved the estimate: each part's size, then the whole plate.
function mealFactor(d) {
  const sum = d.items.reduce((a, i) => a + i.kcal, 0), on = d.items.reduce((a, i) => a + i.kcal * i.mult, 0);
  return (sum > 0 ? on / sum : 1) * d.size;
}
function mealRecalc(d) {
  if (!d.base) return;
  const k = mealFactor(d), b = d.base;
  d.kcal = round10(b.kcal * k); d.p = Math.round(b.p * k); d.c = Math.round(b.c * k); d.f = Math.round(b.f * k);
}
// A fresh estimate arrived: keep it as the base and start the portions at medium.
function mealSet(d, m, state) {
  const x = FOOD_X[m.name];
  d.name = m.name; d.base = { kcal: +m.kcal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0, fib: m.fib != null ? m.fib : x ? x[0] : null, na: m.na != null ? m.na : x ? x[1] : null, ml: +m.ml || 0 };
  d.items = (m.items || []).map(i => ({ name: i.name, kcal: i.kcal, mult: 1 })); d.size = 1; d.conf = m.conf || ''; d.state = state; d.nums = false;
  mealRecalc(d);
}
// The same dish logged before, so one meal does not get two different numbers.
function mealPrior(d) {
  const n = String(d.name || '').trim().toLowerCase(); if (!n) return null;
  const m = S.meals.filter(x => x.name.toLowerCase() === n).sort((a, b) => b.ts - a.ts)[0];
  return m && Math.abs(m.kcal - (+d.kcal || 0)) > 20 ? m : null;
}
function startMeal(ph, preset) {
  const kind = pick(Math.random, ['bowl', 'salad', 'pasta', 'wrap', 'eggs', 'oats']);
  const sn = preset ? null : D.snap, seen = sn && sn.meal;   // Claude already estimated this photo
  if (preset) D.snap = null;
  D.meal = { photo: ph ? ph.key : null, art: ph ? null : { kind: preset ? preset.kind || 'bowl' : sn && sn.sample ? 'bowl' : kind, seed: sn && sn.sample ? 7 : Math.floor(Math.random() * 1e5) }, text: preset ? preset.text || '' : '',
    name: '', kcal: '', p: '', c: '', f: '', base: null, items: [], size: 1, slot: slotNow(), state: 'working', conf: '', hint: '', nums: false, busy: false };
  const d = D.meal, fill = (m, state) => { if (D.meal !== d) return; mealSet(d, m, state); drawSheets(false); };
  openSheet(mealSheet, { cls: 'full', onClose: () => { if (D.meal) D.snap = null; } });
  if (preset) { fill(preset, preset.state); return; }
  if (seen) { fill(seen, 'ai'); return; }
  if (!ph) {
    const f = FOOD_DB.filter(x => x.kind === d.art.kind)[0] || FOOD_DB[2];
    setTimeout(() => fill({ name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, items: (SAMPLE_ITEMS[f.name] || []).map(i => ({ name: i[0], kcal: i[1] })) }, 'sample'), sn ? 250 : 900); return;
  }
  aiMealPhoto(ph.blob).then(r => {
    if (D.meal !== d) return;
    if (r.state === 'ai') fill(r.meal, 'ai'); else { d.state = r.state; d.nums = true; drawSheets(false); }
  });
}
function mealHead(d) {
  if (d.kcal === '' || d.kcal == null) return '<div class="mhead"><span class="mh-n"><b class="num">0</b>kcal</span><span class="mh-t">Add the numbers below</span></div>';
  const est = isEstimate(d.state) && !d.typed;
  return '<div class="mhead"><span class="mh-n"><b class="num">' + (est ? 'About ' : '') + fmtN(+d.kcal) + '</b>kcal</span><span class="mh-t">' + (est ? 'Rough estimate' : 'Your numbers') + '</span></div>' +
    '<div class="mmac"><span><b>' + Math.round(+d.p || 0) + ' g</b>protein</span><span><b>' + Math.round(+d.c || 0) + ' g</b>carbs</span><span><b>' + Math.round(+d.f || 0) + ' g</b>fat</span>' + (d.base && d.base.ml > 0 ? '<span class="mm-w"><b>' + waterFmt(d.base.ml * mealFactor(d)) + '</b>water</span>' : '') + '</div>';
}
function mealSheet() {
  const d = D.meal; if (!d) return '';
  const src = d.photo ? PHOTOS[d.photo] || photoSrc(d.photo) : d.img ? esc(d.img) : mealURI(d.art.kind, d.art.seed), working = d.state === 'working', est = isEstimate(d.state);
  const st = {
    working: ['', '<span class="spin"></span>Estimating calories and macros'],
    ai: [' ok', ic('sparkle', 18) + '<span>Claude\'s estimate from your ' + (d.photo ? 'photo' : 'description') + (d.conf ? ', ' + d.conf + ' confidence' : '') + '. Photo estimates often run low, so check the portions.</span>'],
    sample: ['', ic('image', 18) + '<span>Sample estimate for a sample photo. Your own photos get a real one.</span>'],
    edit: ['', ic('pencil', 18) + '<span>Editing a meal you logged. Change anything, or say what to change.</span>'],
    guess: ['', ic('info', 18) + '<span>Rough match from a small built-in food list. Check the numbers.</span>'],
    notfood: [' no', ic('info', 18) + '<span>This does not look like food. Type the details in, or switch it above.</span>'],
    off: ['', ic('info', 18) + '<span>Photo estimates need Claude switched on for this page. Type the numbers in for now.</span>']
  }[d.state];
  const fld = (k, label, unit) => '<div class="field"><label for="ml-' + k + '">' + label + '</label><input class="input" id="ml-' + k + '" type="number" inputmode="numeric" min="0" data-m="meal.' + k + '" data-on="mealNum" value="' + esc(d[k]) + '" placeholder="' + unit + '"></div>';
  const seg = (action, cur, attr) => '<div class="seg' + (attr ? ' sml' : '') + '">' + PORTION.map(p => '<button data-a="' + action + '" data-v="' + p[2] + '"' + (attr || '') + ' aria-pressed="' + (cur === p[2]) + '" aria-label="' + p[1] + '">' + (attr ? p[0] : p[1]) + '</button>').join('') + '</div>';
  const items = d.items.length ? '<div class="field"><span class="lbl">What is in it</span><div class="mitems">' + d.items.map((it, i) => '<div class="mitem"><span class="grow"><b>' + esc(it.name) + '</b><small>' + Math.round(it.kcal * it.mult / 5) * 5 + ' kcal</small></span>' + seg('mealItem', it.mult, ' data-i="' + i + '"') +
    '<button class="rm" data-a="mealItemDel" data-i="' + i + '" aria-label="Remove ' + esc(it.name) + '">' + ic('x', 18) + '</button></div>').join('') + '</div></div>' : '';
  const prior = est ? mealPrior(d) : null;
  let h = sheetHead(d.editId ? 'Edit meal' : 'Log a meal', { back: true }) + '<div class="sh-b">' + kindSwitch() + '<div class="prev sq"><img src="' + src + '" alt="Your meal"></div><div class="aicheck' + st[0] + '">' + st[1] + '</div>';
  if (!working) {
    h += '<div class="card mcard" id="ml-head">' + mealHead(d) + '</div>' +
      (prior ? '<div class="aicheck">' + ic('clock', 18) + '<span>Last time you logged this at ' + fmtN(prior.kcal) + ' kcal.</span><button class="link" data-a="mealUsePrior">Use that</button></div>' : '') +
      '<div class="field"><label for="ml-name">What is it?</label><input class="input" id="ml-name" data-m="meal.name" value="' + esc(d.name) + '" placeholder="Veggie burrito bowl" autocomplete="off"></div>' + items;
    if (d.base) h += '<div class="field"><span class="lbl">' + (d.items.length ? 'How big was the whole plate?' : 'How big was the portion?') + '</span>' + seg('mealSize', d.size) + '</div>';
    if (est || d.editId) h += '<div class="field fix"><span class="lbl">Not quite right? Tell it what to change</span>' +
      '<button class="btn btn-w fix-mic' + (d.listening ? ' on' : '') + '" data-a="mealMic"' + (d.busy ? ' disabled' : '') + '>' + (d.busy ? '<span class="spin"></span>Re-estimating' : ic('mic', 22) + (d.listening ? 'Listening. Tap when done' : 'Say what to change')) + '</button>' +
      '<div class="send"><input class="input" id="ml-hint" data-m="meal.hint" data-enter="mealRefine" value="' + esc(d.hint) + '" placeholder="Or type it: no rice, extra paneer" autocomplete="off"><button class="btn btn-ink wide" data-a="mealRefine"' + (d.busy ? ' disabled' : '') + '>Fix</button></div></div>';
    h += d.nums || !d.base ? '<div class="mgrid">' + fld('kcal', 'Calories', 'kcal') + fld('p', 'Protein', 'g') + fld('c', 'Carbs', 'g') + fld('f', 'Fat', 'g') + '</div>' : '<button class="btn btn-line btn-w" data-a="mealNums">' + ic('pencil', 18) + 'Type the numbers yourself</button>';
    h += '<div class="field"><span class="lbl">Which meal</span><div class="chips">' + SLOTS.map(s => '<button class="chip" data-a="mealSlot" data-k="' + s[0] + '" aria-pressed="' + (d.slot === s[0]) + '">' + s[1] + '</button>').join('') + '</div></div>';
  }
  return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="mealLog"' + (working ? ' disabled' : '') + '>' + (d.editId ? 'Save changes' : 'Log meal') + '</button></div>';
}
A.mealSlot = el => { D.meal.slot = el.dataset.k; drawSheets(false); };
A.mealSize = el => { const d = D.meal; d.size = +el.dataset.v; d.typed = false; mealRecalc(d); drawSheets(false); };
A.mealItem = el => { const d = D.meal; d.items[+el.dataset.i].mult = +el.dataset.v; d.typed = false; mealRecalc(d); drawSheets(false); };
A.mealItemDel = el => {
  const d = D.meal, it = d.items[+el.dataset.i], sum = d.items.reduce((a, i) => a + i.kcal, 0); if (!it) return;
  // taking a part out removes its share of the estimate for good
  const keep = sum > 0 ? 1 - it.kcal / sum : 1; ['kcal', 'p', 'c', 'f'].forEach(k => { d.base[k] *= keep; });
  d.items.splice(+el.dataset.i, 1); d.typed = false; mealRecalc(d); drawSheets(false);
};
A.mealNums = () => { D.meal.nums = true; drawSheets(false); const i = $('#ml-kcal'); if (i) i.focus(); };
// Typing a number makes it yours: the portions keep working from the number you typed.
A.mealNum = el => {
  const d = D.meal, k = el.id.slice(3), f = mealFactor(d) || 1;
  if (!d.base) d.base = { kcal: 0, p: 0, c: 0, f: 0, fib: null, na: null };
  d.base[k] = (+d[k] || 0) / f; d.typed = true;
  const hd = $('#ml-head'); if (hd) hd.innerHTML = mealHead(d);
};
A.mealUsePrior = () => {
  const d = D.meal, m = mealPrior(d); if (!m) return;
  d.base = { kcal: m.kcal, p: m.p, c: m.c, f: m.f, fib: m.fib != null ? m.fib : null, na: m.na != null ? m.na : null }; d.items = []; d.size = 1; d.kcal = m.kcal; d.p = m.p; d.c = m.c; d.f = m.f; d.typed = true;
  drawSheets(false); toast('Using the numbers from last time', 'check');
};
A.mealRefine = async () => {
  const d = D.meal; if (!d || d.busy) return;
  const hint = String(d.hint || '').trim(); if (!hint) { toast('Say what to change first, like "no rice" or "double the paneer".'); return; }
  d.busy = true; drawSheets(false);
  const sn = D.snap, blob = sn && sn.ph ? sn.ph.blob : null;
  const r = blob ? await aiMealPhoto(blob, hint) : await aiMealText(d.text || d.name, hint);
  if (D.meal !== d) return;
  d.busy = false;
  if (r.state === 'ai') { mealSet(d, r.meal, 'ai'); d.hint = ''; d.typed = false; toast('Re-estimated with your note', 'check'); }
  else toast(r.state === 'notfood' ? 'That did not come back as food. Change the numbers yourself instead.' : 'Re-estimating needs Claude switched on for this page. Change the portions or the numbers instead.');
  drawSheets(false);
};
A.mealLog = () => {
  const d = D.meal; if (!d) return;
  if (!String(d.name).trim() || d.kcal === '' || isNaN(+d.kcal)) { toast('Add a name and the calories to log this meal.'); return; }
  const k = d.base ? mealFactor(d) : 1, b = d.base || {}, est = isEstimate(d.state) && !d.typed;
  if (d.editId) {
    const m = S.meals.find(x => x.id === d.editId);
    if (m) Object.assign(m, { ml: b.ml ? Math.round(b.ml * k) : m.ml || 0, name: String(d.name).trim(), kcal: Math.round(+d.kcal), p: Math.round(+d.p || 0), c: Math.round(+d.c || 0), f: Math.round(+d.f || 0), fib: b.fib != null ? Math.round(b.fib * k) : m.fib, na: b.na != null ? round10(b.na * k) : m.na, slot: d.slot, est: est, edited: now() });
    D.meal = null; closeAll(); save(); render(); toast(m ? 'Meal updated: ' + fmtN(m.kcal) + ' kcal, ' + m.p + ' g protein' : 'That meal is gone', 'check'); return;
  }
  if (d.photo) savePhoto(d.photo, PHOTOS[d.photo]);
  S.meals.push({ id: uid(), ts: now(), name: String(d.name).trim(), kcal: Math.round(+d.kcal), p: Math.round(+d.p || 0), c: Math.round(+d.c || 0), f: Math.round(+d.f || 0), fib: b.fib != null ? Math.round(b.fib * k) : null, na: b.na != null ? round10(b.na * k) : null,
    slot: d.slot, art: d.art || { kind: 'bowl', seed: 3 }, photo: d.photo, src: d.state, est: est, ml: b.ml ? Math.round(b.ml * k) : 0 });
  checkBadges();
  const added = S.meals[S.meals.length - 1];
  D.meal = null; D.snap = null; D.camIntent = null; S.ui.foodOff = 0; S.ui.tab = 'food'; scrollPos.food = 0; closeAll(); save(); render();
  toast((est ? 'About ' : '') + fmtN(added.kcal) + ' kcal and ' + added.p + ' g protein added to today', 'check');
};
// Meals logged before, most often first. One tap logs one again with the numbers it had last time.
function recentMeals() {
  const seen = {}, out = [];
  S.meals.slice().sort((a, b) => b.ts - a.ts).forEach(m => { const k = m.name.toLowerCase(); if (seen[k]) { seen[k].n++; return; } seen[k] = { m: m, n: 1 }; out.push(seen[k]); });
  return out.sort((a, b) => b.n - a.n || b.m.ts - a.m.ts).slice(0, 8);
}
A.mealAgain = el => {
  const m = S.meals.find(x => x.id === el.dataset.id); if (!m) return;
  S.meals.push(Object.assign({}, m, { id: uid(), ts: now(), slot: slotNow(), src: 'again' }));
  S.ui.foodOff = 0; save(); refresh();
  toast(m.name + ' logged again: ' + fmtN(m.kcal) + ' kcal, ' + m.p + ' g protein', 'check');
};
