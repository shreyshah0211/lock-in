/* Claude does the looking in this prototype when the page is allowed to ask it:
   it decides whether a photo is a gym or food, checks the gym, and estimates the
   meal. Without it, the app asks you what the photo is and uses labelled samples.
   Every answer is a draft. The person confirms or corrects it before it counts. */
let _ai, _aiP = null, _aiBlocked = false, _aiImg;
function initAI() {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      _aiP = window.claude.use('sample').then(s => { _ai = s || null; return _ai; }).catch(() => { _ai = null; return null; });
    } else if (nativeClaude()) {
      _aiP = nativeClaudeAI().then(s => { _ai = s; return s; });
    } else { _ai = null; _aiP = Promise.resolve(null); }
  } catch (e) { _ai = null; _aiP = Promise.resolve(null); }
}
/* Inside the iPhone app (ios/) there is no window.claude. The app offers a "claude" message
   handler instead, which calls the Claude API with a key kept on the native side
   (ios/LockIn/ClaudeBridge.swift). This wraps it in the same json()/limits() shape. */
function nativeClaude() { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.claude || null; } catch (e) { return null; } }
function blobB64(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); }
async function nativeClaudeAI() {
  const h = nativeClaude(), err = e => { const x = new Error('claude'); x.code = (e && e.message) || 'upstream_error'; return x; };
  try { const st = await h.postMessage({ op: 'status' }); if (!st || !st.ready) return null; } catch (e) { return null; }
  return {
    limits: () => Promise.resolve({ images: true }),
    json: async (prompt, opt) => {
      const imgs = await Promise.all(((opt && opt.images) || []).map(async b => ({ type: b.type || 'image/jpeg', data: await blobB64(b) })));
      let txt; try { txt = await h.postMessage({ op: 'json', prompt: String(prompt), images: imgs }); } catch (e) { throw err(e); }
      return JSON.parse(txt);
    }
  };
}
function getAI(waitMs) {
  if (_aiBlocked) return Promise.resolve(null);
  if (_ai !== undefined) return Promise.resolve(_ai);
  return Promise.race([_aiP, new Promise(r => setTimeout(() => r(null), waitMs || 3500))]);
}
async function getAIImages() {
  const s = await getAI(); if (!s) return null;
  if (_aiImg === undefined) { try { const l = await s.limits(); _aiImg = !!(l && l.images); } catch (e) { _aiImg = false; } }
  return _aiImg ? s : null;
}
function aiFail(e) {
  const c = e && e.code;
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) _aiBlocked = true;
  return c || 'upstream_error';
}
const num = (v, lo, hi) => { v = Math.round(+v); return isFinite(v) ? clamp(v, lo, hi) : 0; };
const quoted = (t, n) => String(t || '').slice(0, n).replace(/"/g, '\'');
// A photo of a screen is flagged, never rejected: gyms are full of glass and mirrors, so the flag can be wrong.
const SCREEN_ASK = 'Add "screen": true if the image is a photo of another screen or a screenshot instead of the real scene in front of the camera, otherwise "screen": false. ';

// outside: the gym does not allow photos inside, so the photo is of the entrance or the building.
async function aiGymCheck(blob, outside) {
  const s = await getAIImages(); if (!s) return { state: 'off' };
  try {
    const res = await s.json(outside
      ? 'This photo was just taken as an outside check-in for a gym habit app, because the gym does not allow photos inside. Decide whether it plausibly shows the outside or entrance of a gym, fitness centre, rec centre, climbing gym, studio, pool or sports facility, or the person at such a door with a gym bag. ' +
        'A home interior, food, a street with no such building, or an unrelated scene does not count. ' +
        'Reply with only a JSON object like {"gym": true, "workout": "other", "note": "rec centre entrance", "screen": false}. "workout" is always "other". "note" is at most 8 words describing what you see. ' + SCREEN_ASK
      : 'This photo was just taken as a check-in for a gym habit app. Decide whether it plausibly shows the person at a workout: a gym, weights or machines, a studio, a court, a pool, a track, a trail run, or a home workout setup. ' +
        'A bedroom with no equipment, food, or an unrelated scene is not a workout. ' +
        'Reply with only a JSON object like {"gym": true, "workout": "legs", "note": "squat rack and plates", "screen": false}. ' +
        '"workout" is your best guess from: push, pull, legs, upper, full, cardio, core, sport, mobility, other. "note" is at most 8 words describing what you see. ' + SCREEN_ASK,
      { images: [blob], modelTier: 'quick' });
    return { state: res && res.gym ? 'ok' : 'no', workout: !outside && res && TYPE[res.workout] ? res.workout : null, note: res && typeof res.note === 'string' ? res.note.slice(0, 80) : '', screen: !!(res && res.screen === true) };
  } catch (e) { const c = aiFail(e); return { state: c === 'rate_limited' ? 'busy' : _aiBlocked ? 'off' : 'error' }; }
}
const WATER_ASK = '"water_ml" is the fluid in it, in millilitres: the whole volume for a drink (water, coffee, tea, milk, juice, a shake, soda), the broth for a soup, and 0 for solid food. ';
const MEAL_FORMAT = 'Reply with only a JSON object like {"food": true, "name": "Veggie burrito bowl", "calories": 640, "protein_g": 24, "carbs_g": 88, "fat_g": 20, "fiber_g": 12, "sodium_mg": 900, "water_ml": 0, "items": [{"name": "rice", "calories": 210}], "confidence": "medium"}. ' + WATER_ASK +
  'Use whole numbers. "name" is a short plain name for the whole meal. "items" lists up to 6 parts, and their calories add up to the total. "confidence" is low, medium or high. If it is not food or drink, reply {"food": false}.';
function shapeMeal(res) {
  if (!res || res.food === false || !res.name) return null;
  const opt = (v, hi) => v == null || !isFinite(+v) ? null : num(v, 0, hi);
  return { name: String(res.name).slice(0, 60), kcal: num(res.calories, 0, 5000), p: num(res.protein_g, 0, 400), c: num(res.carbs_g, 0, 800), f: num(res.fat_g, 0, 400), fib: opt(res.fiber_g, 200), na: opt(res.sodium_mg, 20000), ml: opt(res.water_ml, 4000) || 0,
    items: Array.isArray(res.items) ? res.items.slice(0, 6).map(i => ({ name: String(i.name || '').slice(0, 40), kcal: num(i.calories, 0, 5000) })).filter(i => i.name) : [], conf: ['low', 'medium', 'high'].includes(res.confidence) ? res.confidence : 'medium' };
}
// What the model is told besides the photo: the time of day, and anything the person typed to correct it.
function mealContext(hint) {
  const slot = SLOTS.find(s => s[0] === slotNow())[1].toLowerCase();
  return 'It is being logged at about ' + clock(now()) + ', most likely as ' + slot + '. Estimates from photos tend to come out low, mostly on oil, sauces and dense portions, so do not round down. ' +
    (hint ? 'The person who ate it adds this, and it overrides what the photo suggests: "' + quoted(hint, 200) + '". ' : '');
}
// One look at a fresh photo: gym, food or neither, with the details for whichever it is.
async function aiSnap(blob) {
  const s = await getAIImages(); if (!s) return { state: 'off' };
  try {
    const res = await s.json(
      'This photo was just taken in a fitness app that has one camera button for everything. Work out what it shows so the app can file it. Reply with only a JSON object, in one of three shapes. ' +
      'If it plausibly shows the person at a workout (a gym, weights or machines, a studio, a court, a pool, a track, a trail run, or a home workout setup): {"kind": "gym", "workout": "legs", "note": "squat rack and plates", "lift": {"exercise": "Squat", "weight": 225, "unit": "lb"}, "screen": false}. "workout" is your best guess from: push, pull, legs, upper, full, cardio, core, sport, mobility, other. "note" is at most 8 words describing what you see. "lift" is only for when the photo clearly shows one exercise and you can read its weight (count barbell plates on both sides plus the bar, read the number on a dumbbell, or where the pin sits on a machine stack); otherwise "lift": null. ' +
      'If it shows food or drink: {"kind": "food", "name": "Veggie burrito bowl", "calories": 640, "protein_g": 24, "carbs_g": 88, "fat_g": 20, "fiber_g": 12, "sodium_mg": 900, "water_ml": 0, "items": [{"name": "rice", "calories": 210}], "confidence": "medium", "screen": false}. ' + WATER_ASK + 'Use whole numbers, judge portion sizes from the plate and what surrounds it, list up to 6 parts in "items" whose calories add up to the total, and set "confidence" to low, medium or high. ' + mealContext('') +
      'If it is neither, such as an unrelated scene: {"kind": "other", "screen": false}. ' + SCREEN_ASK,
      { images: [blob], modelTier: 'quick' });
    const kind = res && ['gym', 'food', 'other'].includes(res.kind) ? res.kind : 'other';
    return { state: 'ok', kind: kind, screen: !!(res && res.screen === true), gym: kind === 'gym' ? { workout: TYPE[res.workout] ? res.workout : null, note: typeof res.note === 'string' ? res.note.slice(0, 80) : '', lift: res.lift && typeof liftFromAI === 'function' ? liftFromAI(res.lift) : null } : null, meal: kind === 'food' ? shapeMeal(Object.assign({ food: true }, res)) : null };
  } catch (e) { return { state: aiFail(e) === 'rate_limited' ? 'busy' : 'off' }; }
}
async function aiMealPhoto(blob, hint) {
  const s = await getAIImages(); if (!s) return { state: 'off' };
  try {
    const res = await s.json('Estimate the nutrition of the meal in this photo for a food log. Judge portion sizes from the plate and what surrounds it. ' + mealContext(hint) + MEAL_FORMAT, { images: [blob], modelTier: 'quick' });
    const m = shapeMeal(res); return m ? { state: 'ai', meal: m } : { state: 'notfood' };
  } catch (e) { aiFail(e); return { state: 'off' }; }
}
async function aiMealText(text, hint) {
  const s = await getAI(); if (!s) return { state: 'off' };
  try {
    const res = await s.json('Estimate the nutrition of this meal for a food log. The person wrote: "' + quoted(text, 400) + '". Assume ordinary portions unless they say otherwise. ' + (hint ? 'They then corrected it with: "' + quoted(hint, 200) + '". ' : '') + MEAL_FORMAT, { modelTier: 'quick' });
    const m = shapeMeal(res); return m ? { state: 'ai', meal: m } : { state: 'notfood' };
  } catch (e) { aiFail(e); return { state: 'off' }; }
}
function guessMeal(text) {
  const t = (text || '').toLowerCase(); let best = null, score = 0;
  FOOD_DB.forEach(f => { const s = f.keys.filter(k => t.includes(k)).length; if (s > score) { score = s; best = f; } });
  const f = best || FOOD_DB[2];
  return { name: best ? f.name : (text.trim().slice(0, 40) || f.name), kcal: f.kcal, p: f.p, c: f.c, f: f.f, items: [], conf: 'low', kind: f.kind };
}
// The optional weekly note. It gets the tags people put on sessions, so a light week during exams reads as that.
async function aiWeekNote(lines, goal) {
  const s = await getAI(); if (!s) return { state: 'off' };
  try {
    const res = await s.json('You write one short weekly note inside a gym habit app. The person aims for ' + goal + ' sessions a week. Their last 14 days, newest last, with any tag they added:\n' + lines + '\n\n' +
      'Write two sentences at most, in plain words, speaking to them as "you". Do not repeat totals they can already see on screen. Say one thing about the pattern they might not have noticed, then one small suggestion for the coming week. ' +
      'A tag such as easy day, sick, exam week or travelling explains a light stretch: respect it and never criticise it. No exclamation marks, no medical advice. Reply with only a JSON object like {"note": "..."}.', { modelTier: 'quick' });
    const note = res && typeof res.note === 'string' ? res.note.trim().slice(0, 320) : '';
    return note ? { state: 'ai', note: note } : { state: 'off' };
  } catch (e) { aiFail(e); return { state: 'off' }; }
}
