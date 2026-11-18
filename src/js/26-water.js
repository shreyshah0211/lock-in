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
// About 35 ml per kg of body weight, and half a litre more on a training day. A typed goal wins.
function waterGoal(fd) {
  if (S.goals.water) return S.goals.water;
  const kg = S.body && typeof bodyKg === 'function' ? bodyKg(S.body) : 0;
  const base = kg >= 30 ? Math.round(kg * 35 / 50) * 50 : 2500;
  const trained = S.checkins.some(c => foodDay(c.ts) === (fd == null ? foodDay(now()) : fd));
  return base + (trained ? 500 : 0);
}
// Today's water: what was added here, plus the fluid in drinks logged as meals.
function waterDay(fd) {
  const d = fd == null ? foodDay(now()) : fd, list = (S.water || []).filter(w => foodDay(w.ts) === d);
  const fromMeals = S.meals.filter(m => foodDay(m.ts) === d && m.ml > 0);
  return { ml: list.reduce((a, w) => a + w.ml, 0) + fromMeals.reduce((a, m) => a + m.ml, 0), list: list, meals: fromMeals };
}
const WATER_ADD = () => waterUS() ? [[8 * ML_OZ, '8 oz', 'Glass'], [16.9 * ML_OZ, '16.9 oz', 'Bottle'], [24 * ML_OZ, '24 oz', 'Big bottle']] : [[250, '250 ml', 'Glass'], [500, '500 ml', 'Bottle'], [750, '750 ml', 'Big bottle']];

// The water card on the Food tab: drops filling up, and one tap to add.
function waterCard(fd) {
  const today = fd === foodDay(now()), w = waterDay(fd), g = waterGoal(fd), frac = clamp(w.ml / g, 0, 1), n = 8, full = Math.round(frac * n);
  const drops = Array.from({ length: n }, (_, i) => '<i class="' + (i < full ? 'on' : '') + '">' + ic('drop', 22) + '</i>').join('');
  return '<div class="card water-c"><div class="wc-h"><span class="wc-n"><b class="num">' + waterFmt(w.ml, true) + '</b>' + waterUnit() + ' <span>of ' + waterFmt(g) + '</span></span>' +
    (today ? '<button class="link" data-a="openWater">More</button>' : '') + '</div>' +
    '<div class="wc-drops" aria-label="' + Math.round(frac * 100) + '% of your water goal">' + drops + '</div>' +
    (today ? '<div class="wc-add">' + WATER_ADD().slice(0, 2).map(x => '<button class="btn btn-soft btn-s" data-a="waterAdd" data-ml="' + Math.round(x[0]) + '">' + ic('plus', 15) + x[2] + ' <small>' + x[1] + '</small></button>').join('') +
      (w.list.length ? '<button class="btn btn-soft btn-s wc-undo" data-a="waterUndo" aria-label="Undo the last water">' + ic('x', 15) + '</button>' : '') + '</div>' : '') +
    (w.meals.length ? '<p class="mute wc-note">' + ic('bowl', 14) + ' Includes ' + waterFmt(w.meals.reduce((a, m) => a + m.ml, 0)) + ' from ' + listNames(w.meals.map(m => m.name.toLowerCase()).slice(0, 3)) + '.</p>' : '') + '</div>';
}
A.waterAdd = el => {
  const ml = Math.round(+el.dataset.ml); if (!(ml > 0)) return;
  (S.water || (S.water = [])).push({ id: uid(), ts: now(), ml: ml });
  const w = waterDay(), g = waterGoal(); save(); refresh();
  toast(w.ml >= g && w.ml - ml < g ? 'Water goal reached: ' + waterFmt(w.ml) : '+' + waterFmt(ml) + ' water. ' + waterFmt(Math.max(0, g - w.ml)) + ' to go', 'drop');
};
A.waterUndo = () => {
  const list = (S.water || []).filter(w => foodDay(w.ts) === foodDay(now())); const last = list[list.length - 1]; if (!last) return;
  S.water = S.water.filter(w => w.id !== last.id); save(); refresh(); toast('Removed ' + waterFmt(last.ml));
};
// More: other amounts, a custom one, and the goal.
A.openWater = () => {
  closeAll(); D.wt = { amt: '', goal: S.goals.water ? waterFmt(S.goals.water, true) : '' };
  openSheet(() => {
    const w = waterDay(), g = waterGoal(), u = waterUnit();
    return sheetHead('Water') + '<div class="sh-b"><div class="card mcard"><div class="mhead"><span class="mh-n"><b class="num">' + waterFmt(w.ml, true) + '</b>' + u + '</span><span class="mh-t">of ' + waterFmt(g) + ' today</span></div>' + bar(w.ml / g, 'var(--water)') + '</div>' +
      '<div class="wc-big">' + WATER_ADD().map(x => '<button data-a="waterAdd" data-ml="' + Math.round(x[0]) + '">' + ic('drop', 24) + '<b>' + x[2] + '</b><small>' + x[1] + '</small></button>').join('') + '</div>' +
      '<div class="field"><label for="wt-amt">Another amount, ' + u + '</label><div class="send"><input class="input" id="wt-amt" type="number" inputmode="decimal" data-m="wt.amt" data-enter="waterCustom" placeholder="' + (waterUS() ? '12' : '330') + '"><button class="btn btn-ink wide" data-a="waterCustom">Add</button></div></div>' +
      (w.list.length || w.meals.length ? '<div class="card" style="padding:4px 16px"><div class="rows">' + w.list.slice().reverse().map(x => '<div class="row" style="padding:10px 0">' + ic('drop', 18) + '<div class="grow">Water, ' + clock(x.ts) + '</div><b>' + waterFmt(x.ml) + '</b><button class="rm" data-a="waterDel" data-id="' + x.id + '" aria-label="Remove">' + ic('x', 16) + '</button></div>').join('') +
        w.meals.map(m => '<div class="row" style="padding:10px 0">' + ic('bowl', 18) + '<div class="grow">' + esc(m.name) + ', ' + clock(m.ts) + '</div><b>' + waterFmt(m.ml) + '</b></div>').join('') + '</div></div>' : '') +
      '<div class="field"><label for="wt-goal">Daily goal, ' + u + '</label><div class="send"><input class="input" id="wt-goal" type="number" inputmode="decimal" data-m="wt.goal" data-enter="waterGoalSave" placeholder="Automatic: ' + waterFmt(waterGoal(), true) + '"><button class="btn btn-line wide" data-a="waterGoalSave">Save</button></div>' +
      '<p class="mute" style="font-size:12.5px">' + (S.goals.water ? 'Your own goal. Clear it to go back to automatic.' : 'Automatic: about 35 ml per kg of body weight' + (S.body ? '' : ' (set your goals from your body to use yours)') + ', plus 500 ml on days you train.') + ' Drinks you log as meals count too.</p></div></div>';
  });
};
A.waterCustom = () => { const v = +D.wt.amt, ml = waterUS() ? v * ML_OZ : v; if (!(ml > 10 && ml < 5000)) { toast('Enter an amount in ' + waterUnit() + '.'); return; } D.wt.amt = ''; A.waterAdd({ dataset: { ml: Math.round(ml) } }); };
A.waterDel = el => { S.water = (S.water || []).filter(w => w.id !== el.dataset.id); save(); drawSheets(false); render(); };
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
