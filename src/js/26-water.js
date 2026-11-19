/* Water. A daily goal, one-tap glasses and bottles, and drinks you log as meals
   (or say out loud) count too, so nothing is entered twice. Stored in millilitres,
   shown in fluid ounces when you use pounds. */
const ML_OZ = 29.5735;
function waterUS() { return S.settings.units !== 'kg'; }
function waterFmt(ml, bare) {
  if (waterUS()) return Math.round(ml / ML_OZ) + (bare ? '' : ' oz');
  return ml >= 1000 ? (Math.round(ml / 100) / 10) + (bare ? '' : ' L') : Math.round(ml) + (bare ? '' : ' ml');
}
const waterUnit = () => waterUS() ? 'oz' : 'ml';
/* The daily goal, from drinks (food brings roughly another fifth on top).
   - Base: the US National Academies adequate intake from beverages: about 3.0 L for men and
     2.2 L for women (2.6 and 1.8 L at 14 to 18). Without a body set, 2.6 L, between the two.
   - Weight: scaled from the reference body (70 kg men, 57 kg women) by the square root of the
     ratio, so a bigger body needs more but not proportionally more. Kept within 75 to 135%.
   - Training: the American College of Sports Medicine suggests 0.4 to 0.8 L an hour while
     exercising. Lock In adds 0.6 L an hour of today's workout (your gym time or check-in
     minutes; an hour if it does not know).
   A goal you type wins over all of this. */
const WATER_REF = { m: [3000, 2600, 70], f: [2200, 1800, 57] };
function waterBase() {
  const b = S.body; if (!b || typeof bodyKg !== 'function') return { ml: 2600, why: 'none' };
  const r = WATER_REF[b.sex === 'f' ? 'f' : 'm'], teen = +b.age && +b.age < 19, base = teen ? r[1] : r[0], kg = bodyKg(b);
  if (!(kg >= 30)) return { ml: base, why: 'sex' };
  return { ml: base * clamp(Math.sqrt(kg / r[2]), .75, 1.35), why: 'body' };
}
function waterWorkoutMins(fd) {
  const d = fd == null ? foodDay(now()) : fd, cs = S.checkins.filter(c => foodDay(c.ts) === d);
  if (!cs.length) return 0;
  const g = d === foodDay(now()) && typeof gymToday === 'function' ? gymToday() : null;
  const m = Math.max(g ? g.mins : 0, ...cs.map(c => +c.mins || 0));
  return clamp(m || 60, 20, 180);
}
function waterGoal(fd) {
  if (S.goals.water) return S.goals.water;
  return Math.round((waterBase().ml + waterWorkoutMins(fd) * 10) / 50) * 50;
}
// Today's water: what was added here, plus the fluid in drinks logged as meals.
function waterDay(fd) {
  const d = fd == null ? foodDay(now()) : fd, list = (S.water || []).filter(w => foodDay(w.ts) === d);
  const fromMeals = S.meals.filter(m => foodDay(m.ts) === d && m.ml > 0);
  return { ml: list.reduce((a, w) => a + w.ml, 0) + fromMeals.reduce((a, m) => a + m.ml, 0), list: list, meals: fromMeals };
}
const WATER_ADD = () => waterUS() ? [[8 * ML_OZ, '8 oz', 'Glass'], [16.9 * ML_OZ, '16.9 oz', 'Bottle'], [24 * ML_OZ, '24 oz', 'Big bottle']] : [[250, '250 ml', 'Glass'], [500, '500 ml', 'Bottle'], [750, '750 ml', 'Big bottle']];

// The water card on the Food tab: drops filling up, three buttons that always fit, and
// today's drinks, each with its own remove.
// Water on Food: how much, one bar, and two buttons. Everything else is under More.
function waterCard(fd) {
  const today = fd === foodDay(now()), w = waterDay(fd), g = waterGoal(fd);
  const bt = bottleButtons(1)[0], adds = WATER_ADD();
  const add = (extra, name, amt) => '<button class="wc-t" ' + extra + '>' + ic('plus', 16) + '<b>' + esc(name) + '</b><small>' + amt + '</small></button>';
  return '<div class="card water-c"><div class="wc-h"><span class="wc-n"><b class="num">' + waterFmt(w.ml, true) + '</b>' + waterUnit() + ' <span>of ' + waterFmt(g) + '</span></span>' +
    (today ? '<button class="link" data-a="openWater">More</button>' : '') + '</div>' + bar(w.ml / g, 'var(--water)') +
    (today ? '<div class="wc-add">' + add('data-a="waterAdd" data-ml="' + Math.round(adds[0][0]) + '" data-name="Glass"', 'Glass', adds[0][1]) +
      (bt ? add('data-a="bottleUse" data-id="' + bt[3] + '" data-ml="' + Math.round(bt[0]) + '" data-name="' + esc(bt[2]) + '"', bt[2], bt[1]) : add('data-a="waterAdd" data-ml="' + Math.round(adds[1][0]) + '" data-name="Bottle"', 'Bottle', adds[1][1])) + '</div>' : '') + '</div>';
}
const waterName = x => x.name || 'Water';
A.waterAdd = el => {
  const ml = Math.round(+el.dataset.ml); if (!(ml > 0)) return;
  const name = String(el.dataset.name || 'Water').slice(0, 40);
  (S.water || (S.water = [])).push({ id: uid(), ts: now(), ml: ml, name: name });
  const w = waterDay(), g = waterGoal(); save(); refresh();
  toast(w.ml >= g && w.ml - ml < g ? 'Water goal reached: ' + waterFmt(w.ml) : '+' + waterFmt(ml) + ' water. ' + waterFmt(Math.max(0, g - w.ml)) + ' to go', 'drop');
};
// More: other amounts, a custom one, and the goal.
A.openWater = () => {
  closeAll(); D.wt = { amt: '', goal: S.goals.water ? waterFmt(S.goals.water, true) : '' };
  openSheet(() => {
    const w = waterDay(), g = waterGoal(), u = waterUnit();
    return sheetHead('Water') + '<div class="sh-b"><div class="card mcard"><div class="mhead"><span class="mh-n"><b class="num">' + waterFmt(w.ml, true) + '</b>' + u + '</span><span class="mh-t">of ' + waterFmt(g) + ' today</span></div>' + bar(w.ml / g, 'var(--water)') + '</div>' +
      '<button class="btn btn-go btn-w" data-a="capGo" data-to="openWaterCam">' + ic('camera', 20) + 'Snap a bottle or glass</button>' +
      ((S.bottles || []).length ? '<div class="field"><span class="lbl">Your bottles</span><div class="rows wc-bottles">' + bottleButtons(6).map(x => '<div class="row"><button class="grow" data-a="bottleUse" data-id="' + x[3] + '" data-ml="' + Math.round(x[0]) + '" data-name="' + esc(x[2]) + '">' + ic('drop', 18) + '<b>' + esc(x[2]) + '</b><small>' + x[1] + '</small></button><button class="rm" data-a="bottleDel" data-id="' + x[3] + '" aria-label="Forget this bottle">' + ic('x', 16) + '</button></div>').join('') + '</div></div>' : '') +
      '<div class="wc-big">' + WATER_ADD().map(x => '<button data-a="waterAdd" data-ml="' + Math.round(x[0]) + '" data-name="' + x[2] + '">' + ic('drop', 24) + '<b>' + x[2] + '</b><small>' + x[1] + '</small></button>').join('') + '</div>' +
      '<div class="field"><label for="wt-amt">Another amount, ' + u + '</label><div class="send"><input class="input" id="wt-amt" type="number" inputmode="decimal" data-m="wt.amt" data-enter="waterCustom" placeholder="' + (waterUS() ? '12' : '330') + '"><button class="btn btn-ink wide" data-a="waterCustom">Add</button></div></div>' +
      (w.list.length || w.meals.length ? '<div class="card" style="padding:4px 16px"><div class="rows">' + w.list.slice().reverse().map(x => '<div class="row" style="padding:10px 0">' + ic('drop', 18) + '<div class="grow">' + esc(waterName(x)) + ', ' + clock(x.ts) + '</div><b>' + waterFmt(x.ml) + '</b><button class="rm" data-a="waterDel" data-id="' + x.id + '" aria-label="Remove">' + ic('x', 16) + '</button></div>').join('') +
        w.meals.map(m => '<div class="row" style="padding:10px 0">' + ic('bowl', 18) + '<div class="grow">' + esc(m.name) + ', ' + clock(m.ts) + '</div><b>' + waterFmt(m.ml) + '</b></div>').join('') + '</div></div>' : '') +
      '<div class="field"><label for="wt-goal">Daily goal, ' + u + '</label><div class="send"><input class="input" id="wt-goal" type="number" inputmode="decimal" data-m="wt.goal" data-enter="waterGoalSave" placeholder="Automatic: ' + waterFmt(waterGoal(), true) + '"><button class="btn btn-line wide" data-a="waterGoalSave">Save</button></div>' +
      '<p class="mute" style="font-size:12.5px">' + (S.goals.water ? 'Your own goal. Clear it to go back to automatic.' : waterWhy()) + ' Drinks you log as meals count too.</p></div></div>';
  });
};
function waterWhy() {
  const b = waterBase(), m = waterWorkoutMins(), u = waterUS();
  const base = b.why === 'none' ? 'Automatic: ' + waterFmt(Math.round(b.ml / 50) * 50) + ' from drinks, the middle of the US National Academies amounts for men and women. Set your goals from your body to make it yours.'
    : 'Automatic: ' + waterFmt(Math.round(b.ml / 50) * 50) + ' from drinks, from the US National Academies amounts for ' + (S.body.sex === 'f' ? 'women' : 'men') + (b.why === 'body' ? ', adjusted for your weight' : '') + '.';
  return base + (m ? ' Plus ' + waterFmt(m * 10) + ' for today\'s ' + m + ' minute workout (about ' + (u ? '20 oz' : '0.6 L') + ' an hour of exercise, per sports-medicine guidance).' : ' Training days add about ' + (u ? '20 oz' : '0.6 L') + ' an hour of exercise.') + ' Food adds roughly a fifth more on top.';
}
A.waterCustom = () => { const v = +D.wt.amt, ml = waterUS() ? v * ML_OZ : v; if (!(ml > 10 && ml < 5000)) { toast('Enter an amount in ' + waterUnit() + '.'); return; } D.wt.amt = ''; A.waterAdd({ dataset: { ml: Math.round(ml), name: 'Water' } }); };
A.waterDel = el => {
  const x = (S.water || []).find(w => w.id === el.dataset.id); if (!x) return;
  S.water = S.water.filter(w => w.id !== x.id); save(); refresh(); toast('Removed ' + waterName(x) + ', ' + waterFmt(x.ml), 'trash');
};
A.waterGoalSave = () => {
  const v = D.wt.goal === '' ? 0 : +D.wt.goal, ml = waterUS() ? v * ML_OZ : v;
  if (v && !(ml >= 500 && ml <= 8000)) { toast('Enter a goal between ' + (waterUS() ? '17 and 270 oz' : '500 and 8,000 ml') + ', or leave it empty for automatic.'); return; }
  S.goals.water = v ? Math.round(ml / 10) * 10 : 0; save(); closeAll(); refresh(); toast(v ? 'Water goal: ' + waterFmt(S.goals.water) : 'Water goal is automatic again', 'check');
};

/* ---- saying it ----
   "Two glasses of water", "a bottle of water", "16 ounces of water": logged straight away,
   no Claude needed. Anything with food in it goes to the meal estimate, which counts its fluid. */
const W_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: .5, 'half a': .5 };
const W_UNIT = [[/^glass(es)?$/, 250], [/^cups?$/, 240], [/^bottles?$/, 500], [/^(oz|ounces?)$/, ML_OZ], [/^(ml|millilit(er|re)s?)$/, 1], [/^(l|lit(er|re)s?)$/, 1000]];
function waterFromText(text) {
  const t = String(text || '').toLowerCase(); if (!/\bwater\b/.test(t)) return null;
  const re = /(\d+(?:\.\d+)?|half a|half|an|a|one|two|three|four|five|six)\s*(glass(?:es)?|cups?|bottles?|oz|ounces?|ml|millilit(?:er|re)s?|lit(?:er|re)s?|l)\b/g;
  let ml = 0, m; while ((m = re.exec(t))) { const n = W_NUM[m[1]] != null ? W_NUM[m[1]] : +m[1], u = W_UNIT.find(x => x[0].test(m[2])); if (u && n > 0) ml += n * u[1]; }
  // anything left besides the water itself means it was more than water
  const rest = t.replace(re, ' ').replace(/\b(i|just|had|have|drank|drink|drunk|some|of|the|and|water|sparkling|cold|ice|a|an|glass|bottle|today|now|more|another)\b/g, ' ').replace(/[^a-z]+/g, '');
  if (rest.length) return null;
  return Math.round(ml || 250);
}

/* ---- water from a photo ----
   Snap any bottle or glass: Claude names it and says how much it holds. You pick how
   much of it you drank, and the bottle is remembered as a one-tap button. */
function startWaterPhoto(ph, seen) {
  D.wp = { photo: ph ? ph.key : null, state: ph ? (seen ? 'ok' : 'reading') : 'sample', bottle: seen || null, part: 1, keep: true };
  const W = D.wp;
  if (!ph) W.bottle = { name: 'Stanley Quencher 40 oz (sample)', ml: Math.round(40 * ML_OZ), fill: 1 };
  if (W.bottle) W.part = waterPart(W.bottle.fill);
  closeAll(); if (S.ui.tab === 'cam') A.camClose();
  openSheet(waterPhotoSheet, { cls: 'full', onClose: () => { if (D.wp === W) D.wp = null; } });
  if (ph && !seen) aiWaterPhoto(ph.blob).then(r => {
    if (D.wp !== W) return;
    W.state = r.state; if (r.water) { W.bottle = r.water; W.part = waterPart(r.water.fill); }
    drawSheets(false);
  });
}
// How much of it to log: the whole bottle unless it looks partly drunk already.
function waterPart(fill) { return fill >= .85 ? 1 : fill >= .6 ? .75 : fill >= .35 ? .5 : .25; }
function waterPhotoSheet() {
  const W = D.wp; if (!W) return '';
  const b = W.bottle, src = W.photo ? PHOTOS[W.photo] : null;
  const st = { reading: ['', '<span class="spin"></span>Working out what it holds'], no: [' no', ic('info', 18) + '<span>Could not see a bottle or a glass in this photo. Retake it, or add water by hand.</span>'],
    busy: [' no', ic('info', 18) + '<span>Claude is busy. Try again in a moment, or add water by hand.</span>'], error: [' no', ic('info', 18) + '<span>Could not read the photo just now. Add water by hand.</span>'],
    off: ['', ic('info', 18) + '<span>Reading bottles from photos needs Claude switched on. Add water by hand.</span>'] }[W.state];
  let h = sheetHead('Add water', { back: true }) + '<div class="sh-b">' + (src ? '<div class="prev sq"><img src="' + src + '" alt="Your bottle"></div>' : '');
  if (!b || st) return h + '<div class="aicheck' + (st ? st[0] : '') + '">' + (st ? st[1] : '') + '</div>' + (W.state !== 'reading' ? '<button class="btn btn-ink btn-w" data-a="openWater">' + ic('drop', 18) + 'Add water by hand</button>' : '') + '</div>';
  const parts = [[1, 'All of it'], [.75, '¾'], [.5, 'Half'], [.25, '¼']];
  h += '<div class="aicheck ok">' + ic('drop', 18) + '<span><b>' + esc(b.name) + '</b>, holds ' + waterFmt(b.ml) + (b.fill < .85 ? '. Looks about ' + Math.round(b.fill * 100) + '% full.' : '.') + '</span></div>' +
    '<div class="field"><span class="lbl">How much did you drink?</span><div class="seg">' + parts.map(p => '<button data-a="wpPart" data-v="' + p[0] + '" aria-pressed="' + (W.part === p[0]) + '">' + p[1] + '</button>').join('') + '</div></div>' +
    '<div class="card mcard"><div class="mhead"><span class="mh-n"><b class="num">' + waterFmt(b.ml * W.part, true) + '</b>' + waterUnit() + '</span><span class="mh-t">to today\'s water</span></div></div>' +
    '<div class="setrow"><div class="grow"><div class="t">Save this bottle</div><div class="s">One tap next time, no photo needed.</div></div>' + sw(W.keep, 'wpKeep') + '</div>';
  return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="wpSave">Add ' + waterFmt(b.ml * W.part) + ' water</button></div>';
}
A.wpPart = el => { D.wp.part = +el.dataset.v; drawSheets(false); };
A.wpKeep = () => { D.wp.keep = !D.wp.keep; drawSheets(false); };
A.wpSave = () => {
  const W = D.wp; if (!W || !W.bottle) return;
  const ml = Math.round(W.bottle.ml * W.part);
  if (W.keep) {
    const list = S.bottles || (S.bottles = []), name = W.bottle.name.replace(/\s*\(sample\)$/, '');
    const same = list.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (same) { same.ml = W.bottle.ml; same.used = now(); } else list.unshift({ id: uid(), name: name, ml: W.bottle.ml, used: now() });
    if (list.length > 6) list.length = 6;
  }
  D.wp = null; closeAll();
  A.waterAdd({ dataset: { ml: ml, name: W.bottle.name.replace(/\s*\(sample\)$/, '').replace(/\s+\d+(\.\d+)?\s*(oz|ml|l)$/i, '') } });
};
// Saved bottles, most recently used first, become add buttons.
function bottleButtons(max) {
  return (S.bottles || []).slice().sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, max).map(x => [x.ml, waterFmt(x.ml), x.name.replace(/\s+\d+(\.\d+)?\s*(oz|ml|l)$/i, ''), x.id]);
}
A.bottleUse = el => { const b = (S.bottles || []).find(x => x.id === el.dataset.id); if (b) b.used = now(); A.waterAdd(el); };
A.bottleDel = el => { S.bottles = (S.bottles || []).filter(x => x.id !== el.dataset.id); save(); drawSheets(false); render(); };
A.openWaterCam = (el, e) => openCam('water', e);
