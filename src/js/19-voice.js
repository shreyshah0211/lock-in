/* Say it. One microphone for the two things people would otherwise type: what they
   trained and what they ate. You describe it out loud, Lock In works out which it is,
   fills in the form, and you confirm before anything counts.

   Where the words come from depends on where the page is open:
   - inside Claude on a computer, Claude's own dictation listens and the words appear as you talk;
   - opened on its own in a browser that can listen, the browser does it;
   - everywhere else (the Claude app on a phone), the box opens the keyboard and the
     microphone key on it does the listening.
   The page never records or keeps sound. It only ever receives words.

   Claude turns the words into a workout or a meal when the page is allowed to ask it.
   Without it, the plain rules at the bottom of this file do a rougher job. */
const VOICE = { d: undefined, sr: null, rec: null, state: 'idle', off: false };
function initVoice() {
  try { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (SR && window.top === window) VOICE.sr = SR; } catch (e) { }
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('dictation').then(d => {
        VOICE.d = d || null; if (!d) return;
        bindDictation(d);
        if (D.say) drawSheets(false);
      }).catch(() => { VOICE.d = null; });
    } else { VOICE.d = typeof nativeDictation === 'function' ? nativeDictation() : null; if (VOICE.d) bindDictation(VOICE.d); }
  } catch (e) { VOICE.d = null; }
}
// One microphone, two places that listen: the Say it sheet, and the correction box on a meal.
function bindDictation(d) {
  d.onPartial(e => { const t = (e && e.text) || ''; if (VOICE.target === 'meal') mealVoice('partial', t); else if (D.say) { D.say.partial = t; sayPaint(); } });
  d.onFinal(e => { const t = (e && e.text) || ''; if (VOICE.target === 'meal') mealVoice('final', t); else sayHeard(t); });
  d.onState(e => { if (VOICE.target === 'meal') { VOICE.state = e.state || 'idle'; mealVoice('state', '', e.state, e.reason); } else voiceState(e.state, e.reason); });
}
// 'claude': Claude's dictation. 'web': the browser's own. 'kb': the microphone on the keyboard.
function voiceKind() { return VOICE.off ? 'kb' : VOICE.d ? 'claude' : VOICE.sr ? 'web' : 'kb'; }
function voiceStop() {
  try { if (VOICE.d && VOICE.state !== 'idle') VOICE.d.stop().catch(() => { }); } catch (e) { }
  try { if (VOICE.rec) VOICE.rec.stop(); } catch (e) { }
}
// The microphone cannot be used here: fall back to the keyboard for the rest of the visit, and say so once.
function voiceOff() { if (VOICE.off) return; VOICE.off = true; if (D.say) { drawSheets(false); toast('The microphone is off for this page. Use the microphone on your keyboard, or type it.'); } }
function sayHeard(text) {
  const s = D.say; if (!s || !text) return;
  s.text = ((s.text || '') + text).replace(/^\s+/, ''); s.partial = ''; s.heard = true;
  const ta = $('#say-text'); if (ta) ta.value = s.text;
  sayPaint();
}
function voiceState(state, reason) {
  VOICE.state = state || 'idle';
  const s = D.say; if (!s) return;
  if (VOICE.state === 'idle') {
    s.partial = '';
    if (reason === 'not_granted' || reason === 'unavailable') { voiceOff(); return; }
    if (reason === 'rate_limited' || reason === 'upstream_error') toast('The microphone had a problem. Try again, or type it.');
    // Said it and stopped: work it out without another tap.
    else if ((reason === 'stopped' || reason === 'viewer_stopped') && s.heard && (s.text || '').trim() && !s.busy) { sayPaint(); A.sayGo(); return; }
  }
  sayPaint();
}
// Redraws only the parts that change while listening, so the box keeps its cursor.
function sayPaint() {
  const s = D.say; if (!s) return;
  const b = $('#say-mic'), st = $('#say-state'), p = $('#say-part'), go = $('#say-go'), on = VOICE.state === 'listening';
  if (b) { b.classList.toggle('on', on); b.classList.toggle('wait', VOICE.state === 'starting' || VOICE.state === 'finishing'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  if (st) st.textContent = on ? 'Listening. Tap when you are done.' : VOICE.state === 'starting' ? 'Starting the microphone' : VOICE.state === 'finishing' ? 'Catching the last words' : (s.text || '').trim() ? 'Tap to add more' : 'Tap and talk';
  if (p) p.textContent = s.partial || '';
  if (go) go.disabled = !!s.busy || !(s.text || '').trim();
}
A.sayPaint = sayPaint;
function sayFocus() { const t = $('#say-text'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } } }

const SAY_COPY = {
  auto: ['Say it', 'Describe a workout or a meal. Lock In works out which it is and fills in the rest.', 'Leg day, 50 minutes, squat 225 for 5. Or: two eggs, toast and a banana.'],
  workout: ['Say what you trained', 'Describe the session the way you would to a friend. Lock In fills in the type, the time, how hard it was and your lifts.', 'Leg day, about 50 minutes. Squat 225 for 5, three sets. It felt hard.'],
  meal: ['Say what you ate', 'Describe it the way you would to a friend. Lock In estimates the calories and protein.', 'Two eggs, toast with peanut butter and a banana']
};
function saySheet() {
  const s = D.say; if (!s) return '';
  const k = voiceKind(), c = SAY_COPY[s.mode] || SAY_COPY.auto, has = (s.text || '').trim();
  const live = '<div class="say-live"><button id="say-mic" class="say-mic" data-a="sayMic" aria-pressed="false" aria-label="Start or stop the microphone">' + ic('mic', 36) + '</button><p id="say-state" aria-live="polite">Tap and talk</p></div>';
  const box = '<div class="field"><label for="say-text">' + (k === 'kb' ? 'What you said' : 'What it heard. Fix anything it got wrong.') + '</label><textarea class="input" id="say-text" data-m="say.text" data-on="sayPaint" placeholder="' + esc(c[2]) + '" autocapitalize="sentences">' + esc(s.text) + '</textarea><p id="say-part" class="say-part" aria-live="polite"></p></div>';
  const ask = s.ask ? '<div class="say-ask"><p>Could not tell which that was. Was it a workout or a meal?</p><div class="two"><button class="btn btn-line" data-a="sayAs" data-k="workout">' + ic('dumbbell', 18) + 'A workout</button><button class="btn btn-line" data-a="sayAs" data-k="food">' + ic('bowl', 18) + 'A meal</button></div></div>' : '';
  const go = '<button class="btn btn-go btn-w" id="say-go" data-a="sayGo"' + (s.busy || !has ? ' disabled' : '') + '>' + (s.busy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>Working it out' : 'Work it out') + '</button>';
  const kb = '<div class="say-kb">' + ic('mic', 22) + '<span><b>Tap the box, then the microphone on your keyboard.</b>Talk, and your words land in the box. You can type instead.</span></div>';
  return sheetHead(c[0]) + '<div class="sh-b say"><p class="mute say-lead">' + c[1] + '</p>' + (k === 'kb' ? box + ask + go + kb : live + box + ask + go) + '</div>';
}
A.openSay = el => {
  const k = el && el.dataset && SAY_COPY[el.dataset.k] ? el.dataset.k : 'auto';
  D.say = { mode: k, text: '', partial: '', busy: false, ask: false, force: '', heard: false };
  openSheet(saySheet, { cls: 'full', after: sayPaint, onClose: () => { voiceStop(); D.say = null; } });
  if (voiceKind() === 'kb') sayFocus();   // straight from the tap, so a phone opens its keyboard
};
// Called straight from the tap: a microphone only opens on the person's own press.
A.sayMic = () => {
  const s = D.say, k = voiceKind(); if (!s || s.busy) return;
  VOICE.target = 'say';
  if (k === 'claude') {
    if (VOICE.state !== 'idle') { VOICE.d.stop().catch(() => { }); return; }
    VOICE.d.start().catch(err => {
      const c = err && err.code;
      if (c === 'not_granted' || c === 'unavailable') voiceOff();
      else if (c !== 'stopped' && c !== 'dismissed') toast('The microphone did not start. Try again, or type it.');
    });
  } else if (k === 'web') {
    if (VOICE.rec) { try { VOICE.rec.stop(); } catch (e) { } return; }
    let rec; try { rec = new VOICE.sr(); } catch (e) { voiceOff(); return; }
    const base = (s.text || '').trim() ? s.text.replace(/\s*$/, ' ') : ''; let blocked = false;
    rec.continuous = true; rec.interimResults = true; try { rec.lang = navigator.language || 'en-US'; } catch (e) { }
    rec.onstart = () => voiceState('listening');
    rec.onresult = ev => {
      if (D.say !== s) return; let fin = '', part = '';
      for (let i = 0; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else part += r[0].transcript; }
      s.text = (base + fin).replace(/^\s+/, ''); s.partial = part; if (fin || part) s.heard = true;
      const ta = $('#say-text'); if (ta) ta.value = s.text; sayPaint();
    };
    rec.onerror = ev => { if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(ev.error)) blocked = true; };
    rec.onend = () => { VOICE.rec = null; voiceState('idle', blocked ? 'not_granted' : 'stopped'); };
    VOICE.rec = rec; voiceState('starting');
    try { rec.start(); } catch (e) { VOICE.rec = null; voiceState('idle', 'not_granted'); }
  } else sayFocus();
};
A.sayAs = el => { if (!D.say) return; D.say.force = el.dataset.k; A.sayGo(); };
A.sayGo = async () => {
  const s = D.say; if (!s || s.busy) return;
  const text = (s.text || '').trim(); if (!text) { toast('Say or type it first.'); return; }
  voiceStop();
  const force = s.force || (s.mode === 'workout' ? 'workout' : s.mode === 'meal' ? 'food' : '');
  // Just water: logged straight away, no estimate needed.
  const wml = force !== 'workout' && typeof waterFromText === 'function' ? waterFromText(text) : null;
  if (wml) { closeSheet(); A.waterAdd({ dataset: { ml: wml } }); return; }
  s.busy = true; s.ask = false; drawSheets(false);
  let r = await aiSay(text, force);
  if (D.say !== s) return;                       // closed while it was working
  if (r.state !== 'ok') r = guessSay(text, force);
  s.busy = false;
  if (r.kind === 'food') {
    const g = guessMeal(text);
    closeSheet();
    startMeal(null, r.guess ? Object.assign({ state: 'guess', text: text }, g) : Object.assign({ state: 'ai', kind: g.kind, text: text }, r.meal));
  } else if (r.kind === 'workout') {
    const w = r.workout, line = sayLine(w);
    closeSheet();
    if (D.ci && sheets.some(x => x.render === checkinSheet)) { sayApply(D.ci, w); drawSheets(false); toast(line ? 'Filled in: ' + line : 'Nothing specific came through. Fill it in below.', line ? 'check' : undefined); }
    else { D.said = w; openCam(null); }          // a check-in still needs its photo
  } else { s.ask = true; drawSheets(false); }
};
A.saidClear = () => { D.said = null; render(); };
// "Leg day, 50 min, hard, Squat 225 x 5"
function sayLine(w) {
  if (!w) return '';
  const lf = l => l.name + (l.w ? ' ' + l.w : '') + (l.reps ? ' x ' + l.reps : '');
  return [w.type ? TYPE[w.type].v : '', w.mins ? w.mins + ' min' : '', w.effort ? EFFORT[w.effort].toLowerCase() : '', w.lifts.length > 2 ? plural(w.lifts.length, 'lift') : w.lifts.map(lf).join(', '), w.tag ? w.tag.toLowerCase() : ''].filter(Boolean).join(', ');
}
// Put what was said into the check-in form. Only what was actually said changes.
function sayApply(d, w) {
  if (w.type && TYPE[w.type]) { d.type = w.type; d.touched = true; if (d.noPhoto) d.scene.stat.type = d.type; else if (!d.photo && d.scene) d.scene = sceneFor(d.type, d.scene.seed); }
  if (w.mins) d.mins = w.mins;
  if (w.effort) d.effort = w.effort;
  if (w.lifts.length) d.lifts = d.lifts.filter(l => l.name).concat(w.lifts.map(l => ({ name: l.name, w: l.w == null ? '' : l.w, reps: l.reps == null ? '' : l.reps, sets: l.sets == null ? '' : l.sets }))).slice(0, 12);
  if (w.tag) d.tag = w.tag;
  d.more = true; d.said = sayLine(w);
}
// What was said before the photo waits here, for half an hour at most.
function saidPending() { const w = D.said; if (w && Date.now() - w.at > 30 * 60000) D.said = null; return D.said || null; }

/* ---- Claude works it out ---- */
function liftName(n) {
  n = String(n || '').trim().replace(/\s+/g, ' ').slice(0, 40); if (!n) return '';
  const known = LIFT_NAMES.find(x => x.toLowerCase() === n.toLowerCase() || x.toLowerCase() + 's' === n.toLowerCase());
  return known || n.charAt(0).toUpperCase() + n.slice(1);
}
function shapeWorkout(res) {
  const n = (v, lo, hi) => v == null || v === '' || !isFinite(+v) || +v <= 0 ? null : clamp(Math.round(+v * 10) / 10, lo, hi), whole = v => v == null ? null : Math.round(v);
  const lifts = Array.isArray(res.lifts) ? res.lifts.slice(0, 8).map(l => ({ name: liftName(l && l.name), w: n(l && l.weight, 1, 2000), reps: whole(n(l && l.reps, 1, 200)), sets: whole(n(l && l.sets, 1, 30)) })).filter(l => l.name) : [];
  const mins = whole(n(res.minutes, 1, 600)), eff = whole(n(res.effort, 1, 4));
  return { type: TYPE[res.workout] ? res.workout : null, mins: mins == null ? null : clamp(mins, 10, 180), effort: eff, lifts: lifts, tag: TAGS.includes(res.tag) ? res.tag : '', at: Date.now() };
}
async function aiSay(text, force) {
  const s = await getAI(); if (!s) return { state: 'off' };
  try {
    const res = await s.json(
      'Someone said this out loud into a fitness app, so it is a rough transcript and a word or a number may have been heard wrong: "' + quoted(text, 600) + '". ' +
      (force === 'workout' ? 'They are describing a workout they did. ' : force === 'food' ? 'They are describing something they ate or drank. ' : 'Work out whether they are describing a workout they did or something they ate or drank. ') +
      'Reply with only a JSON object, in one of these shapes. ' +
      (force === 'food' ? '' : 'A workout: {"kind": "workout", "workout": "legs", "minutes": 50, "effort": 3, "lifts": [{"name": "Squat", "weight": 225, "reps": 5, "sets": 3}], "tag": ""}. "workout" is the best fit from: push, pull, legs, upper, full, cardio, core, sport, mobility, other. "minutes" is how long it lasted. "effort" is 1 easy, 2 steady, 3 hard or 4 all out. ' +
        '"lifts" lists each strength exercise they named, with a plain name such as Bench press, the weight in ' + (S.settings.units === 'kg' ? 'kilograms' : 'pounds') + ', the reps in one set and the number of sets. "tag" is one of Easy day, Sick, Exam week or Travelling when they said so, otherwise "". Use null for anything they did not say, and never invent a number. ') +
      (force === 'workout' ? '' : 'Food or drink: {"kind": "food", "name": "Veggie burrito bowl", "calories": 640, "protein_g": 24, "carbs_g": 88, "fat_g": 20, "fiber_g": 12, "sodium_mg": 900, "water_ml": 0, "items": [{"name": "rice", "calories": 210}], "confidence": "medium"}. ' + WATER_ASK + 'Use whole numbers, assume ordinary portions unless they say otherwise, and list up to 6 parts in "items" whose calories add up to the total. It is about ' + clock(now()) + '. ') +
      (force ? '' : 'If it is neither, or you cannot tell: {"kind": "other"}.'), { modelTier: 'quick' });
    const kind = force || (res && ['workout', 'food'].includes(res.kind) ? res.kind : 'other');
    if (kind === 'food') { const m = shapeMeal(Object.assign({}, res, { food: true })); return m ? { state: 'ok', kind: 'food', meal: m } : { state: 'ok', kind: 'food', guess: true }; }
    if (kind === 'workout') return { state: 'ok', kind: 'workout', workout: shapeWorkout(res || {}) };
    return { state: 'ok', kind: 'other' };
  } catch (e) { aiFail(e); return { state: 'off' }; }
}

/* ---- the plain rules, for when Claude cannot be asked ---- */
const SAY_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90 };
const SAY_LIFTS = [[/\bincline (?:dumbbell |db )?(?:bench|press)(?: press)?\b/g, 'Incline dumbbell press'], [/\b(?:romanian deadlifts?|rdls?)\b/g, 'Romanian deadlift'], [/\bleg press(?:es)?\b/g, 'Leg press'], [/\blat pull[- ]?downs?\b/g, 'Lat pulldown'],
  [/\b(?:overhead|shoulder|military) press(?:es)?\b|\bohp\b/g, 'Overhead press'], [/\bbench(?: press)?(?:es)?\b/g, 'Bench press'], [/\b(?:back |front )?squats?\b/g, 'Squat'], [/\bdeadlifts?\b/g, 'Deadlift'],
  [/\b(?:barbell |bent[- ]over |cable )?rows?\b/g, 'Barbell row'], [/\b(?:pull|chin)[- ]?ups?\b/g, 'Pull-up'], [/\b(?:dumbbell |bicep |biceps |hammer )?curls?\b/g, 'Dumbbell curl'], [/\bhip thrusts?\b/g, 'Hip thrust'], [/\blunges?\b/g, 'Lunge'], [/\bdips?\b/g, 'Dip']];
const SAY_TYPE = { 'Bench press': 'push', 'Overhead press': 'push', 'Incline dumbbell press': 'push', 'Dip': 'push', 'Barbell row': 'pull', 'Pull-up': 'pull', 'Lat pulldown': 'pull', 'Dumbbell curl': 'pull', 'Deadlift': 'pull', 'Squat': 'legs', 'Romanian deadlift': 'legs', 'Leg press': 'legs', 'Hip thrust': 'legs', 'Lunge': 'legs' };
const SAY_DAY = [[/\bleg(?:s)? day\b|\blegs\b|\blower body\b/, 'legs'], [/\bpush day\b|\bchest day\b|\bshoulder day\b|\bchest and tri/, 'push'], [/\bpull day\b|\bback day\b|\bback and bi/, 'pull'], [/\bupper(?: body)?\b|\barm day\b|\barms\b/, 'upper'], [/\bfull body\b|\bwhole body\b/, 'full'],
  [/\bcardio\b|\bran\b|\brun(?:ning)?\b|\bjog(?:ged|ging)?\b|\btreadmill\b|\bbiked?\b|\bcycl(?:ed|ing)\b|\bsw[ai]m\b|\bswimming\b|\belliptical\b|\bstair ?master\b|\bmiles?\b|\bhiit\b/, 'cardio'], [/\bcore\b|\babs\b|\bplanks?\b|\bcrunches\b/, 'core'],
  [/\bbasketball\b|\bsoccer\b|\btennis\b|\bfootball\b|\bvolleyball\b|\bclimb(?:ed|ing)\b|\bbouldering\b|\bbadminton\b|\bpickleball\b|\bboxing\b/, 'sport'], [/\byoga\b|\bstretch(?:ed|ing)?\b|\bmobility\b|\bpilates\b/, 'mobility']];
const SAY_FOOD = /\b(ate|eat|eaten|eating|drank|drink|breakfast|lunch|dinner|snack|bowl|plate|slices?|cups?|glass|sandwich|burrito|rice|eggs?|toast|chicken|paneer|dal|roti|naan|salad|pasta|pizza|shake|smoothie|oats|oatmeal|yogurt|bananas?|apples?|coffee|tea|milk|cheese|beans|tofu|noodles|curry|wrap|burger|fries|cereal|bar|soup|bread|butter|peanut)\b/g;
const SAY_GYM = /\b(gym|workout|worked out|trained|training|lifted|lifting|sets?|reps?|treadmill|minutes?|mins?|hours?|sweat|session|warm[- ]?up)\b/g;
// Spoken numbers as digits ("three sets of eight" becomes "3 sets of 8").
function sayDigits(t) { return t.replace(/\b(for|of|by|x|times|at)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/g, (m, a, b) => a + ' ' + SAY_NUM[b]).replace(/\b(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty-five|forty|fifty|sixty|ninety)\b(?=\s+(?:sets?|reps?|minutes?|mins?|hours?|times|plates?|x|by|for|pounds?|lbs?|kilos?|kgs?)\b)/g, m => SAY_NUM[m]); }
// The numbers in one stretch of words: weight, reps in a set, sets.
function sayNums(seg) {
  const l = { w: null, reps: null, sets: null }; let m;
  if ((m = /(\d+)\s*sets?(?:\s*(?:of|x|by)\s*(\d+))?/.exec(seg))) { l.sets = +m[1]; if (m[2]) l.reps = +m[2]; }
  if ((m = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kgs?|kilos?)/.exec(seg)) || (m = /(?:at|with|@)\s*(\d+(?:\.\d+)?)/.exec(seg))) l.w = +m[1];
  if ((m = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kgs?|kilos?)?\s*(?:for|x|×|times|by)\s*(\d+)/.exec(seg))) {
    const a = +m[1], b = +m[2];
    if (a > 12 || /lbs?|pounds?|kgs?|kilos?/.test(m[0])) { if (l.w == null) l.w = a; if (l.reps == null) l.reps = b; }   // 225 for 5
    else if (l.sets == null) { l.sets = a; if (l.reps == null) l.reps = b; }                                             // 3 by 10
  }
  if (l.reps == null && (m = /(\d+)\s*reps?/.exec(seg))) l.reps = +m[1];
  return l;
}
// Each exercise takes the numbers said in the same breath, before or after its name.
function sayLifts(t) {
  const found = [], taken = [];
  SAY_LIFTS.forEach(L => { L[0].lastIndex = 0; let m; while ((m = L[0].exec(t))) { const a = m.index, b = a + m[0].length; if (!taken.some(x => a < x[1] && b > x[0])) { taken.push([a, b]); found.push({ name: L[1], a: a, b: b, w: null, reps: null, sets: null }); } } });
  found.sort((x, y) => x.a - y.a);
  const fill = (l, n) => { ['w', 'reps', 'sets'].forEach(k => { if (l[k] == null && n[k] != null) l[k] = n[k]; }); };
  const cut = /[,.;\n]|\bthen\b|\bfollowed by\b/g; let from = 0, m, last = null; const parts = [];
  while ((m = cut.exec(t))) { parts.push([from, m.index]); from = m.index + m[0].length; } parts.push([from, t.length]);
  parts.forEach(pt => {
    const here = found.filter(f => f.a >= pt[0] && f.a < pt[1]), seg = t.slice(pt[0], pt[1]);
    if (here.length === 1) fill(here[0], sayNums(seg.replace(t.slice(here[0].a, here[0].b), ' ')));
    else if (here.length > 1) here.forEach((f, i) => fill(f, sayNums(t.slice(f.b, here[i + 1] ? here[i + 1].a : pt[1]))));
    else if (last && /\bsets?\b|\breps?\b|\d\s*(?:for|x|by)\s*\d|lbs?\b|pounds?\b|kgs?\b|kilos?\b/.test(seg)) fill(last, sayNums(seg));
    if (here.length) last = here[here.length - 1];
  });
  return found.filter((l, i, a) => a.findIndex(x => x.name === l.name) === i).slice(0, 8).map(l => ({ name: l.name, w: l.w, reps: l.reps, sets: l.sets }));
}
function guessWorkout(text) {
  const t = sayDigits(String(text || '').toLowerCase()), lifts = sayLifts(t);
  let type = (SAY_DAY.find(d => d[0].test(t)) || [])[1] || null;
  if (!type && lifts.length) { const ks = lifts.map(l => SAY_TYPE[l.name]), has = k => ks.includes(k); type = has('legs') && (has('push') || has('pull')) ? 'full' : has('push') && has('pull') ? 'upper' : ks[0] || null; }
  let mins = 0, m;
  if ((m = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/.exec(t))) mins += Math.round(+m[1] * 60);
  if (/\bhalf an hour\b/.test(t)) mins += 30; else if (/\band a half\b/.test(t) && mins) mins += 30;
  if ((m = /(\d+)\s*(?:minutes?|mins?)\b/.exec(t))) mins += +m[1];
  const effort = /\ball[- ]out\b|\bbrutal\b|\bdestroyed\b|\bkiller\b|\bmaxed\b|\bwrecked\b|\bexhaust/.test(t) ? 4 : /\bhard\b|\btough\b|\bheavy\b|\bintense\b|\bstruggl|\bdifficult\b/.test(t) ? 3 : /\beasy\b|\blight\b|\bchill\b|\brecovery\b|\bdeload\b/.test(t) ? 1 : /\bsteady\b|\bmoderate\b|\bdecent\b|\bsolid\b|\bnormal\b|\bokay\b|\bfine\b/.test(t) ? 2 : null;
  const tag = /\bexams?\b|\bfinals\b|\bmidterms?\b/.test(t) ? 'Exam week' : /\bsick\b|\bill\b|\ba cold\b/.test(t) ? 'Sick' : /\btravell?ing\b|\bhotel gym\b|\bon the road\b/.test(t) ? 'Travelling' : /\beasy day\b/.test(t) ? 'Easy day' : '';
  return { type: type, mins: mins ? clamp(mins, 10, 180) : null, effort: effort, lifts: lifts, tag: tag, at: Date.now() };
}
function sayKind(text) {
  const t = String(text || '').toLowerCase(), n = re => (t.match(re) || []).length;
  const w = n(SAY_GYM) + 2 * sayLifts(t).length + (SAY_DAY.some(d => d[0].test(t)) ? 2 : 0);
  const f = n(SAY_FOOD) + FOOD_DB.reduce((a, x) => a + x.keys.filter(k => t.includes(k)).length, 0);
  return w > f ? 'workout' : f > w ? 'food' : 'other';
}
function guessSay(text, force) {
  const kind = force || sayKind(text);
  if (kind === 'food') return { state: 'ok', kind: 'food', guess: true };
  if (kind === 'workout') return { state: 'ok', kind: 'workout', workout: guessWorkout(text) };
  return { state: 'ok', kind: 'other' };
}
