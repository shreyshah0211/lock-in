/* One check-in a day, and lifts from a photo.
   The streak counts days, so a second gym photo the same day does not make a second
   check-in. It adds to the workout you already posted instead: snap the machine, the
   bar or the dumbbells, Claude reads the exercise and the weight, you confirm the reps. */

function todayCheckin() { const d = dayNum(now()); return S.checkins.filter(c => dayNum(c.ts) === d).pop() || null; }

// Claude looks at the equipment and reads the weight. A draft: the person confirms it.
async function aiLiftPhoto(blob) {
  const s = await getAIImages(); if (!s) return { state: 'off' };
  try {
    const res = await s.json('This photo was taken at the gym to log a lift in a gym habit app. Work out which exercise or machine it shows and read the weight being used. ' +
      'For a barbell, count the plates on each side, add both sides and the bar (a standard bar is 45 lb or 20 kg unless it is clearly different). For dumbbells or kettlebells, read the number printed on them (one dumbbell\'s weight, not the pair). For a machine with a stack, read the weight where the pin is; for a plate-loaded machine, add the plates. ' +
      'Use the unit printed on the equipment, lb or kg. Reply with only a JSON object like {"gym": true, "exercise": "Bench press", "weight": 225, "unit": "lb", "how": "two 45s each side plus the bar", "confidence": "medium"}. ' +
      '"exercise" is a plain common name such as Bench press, Squat, Lat pulldown, Leg press or Dumbbell curl. "how" is at most 10 words on how you read the weight. "confidence" is low, medium or high. ' +
      'If you can see the exercise but not the weight, give "weight": null. If it does not show gym equipment at all, reply {"gym": false}.', { images: [blob], modelTier: 'quick' });
    if (!res || res.gym === false) return { state: 'no' };
    return { state: 'ok', lift: liftFromAI(res) };
  } catch (e) { const c = aiFail(e); return { state: c === 'rate_limited' ? 'busy' : 'error' }; }
}
// A reading in the person's own units, with a known lift name where there is one.
function liftFromAI(r) {
  if (!r) return null;
  const raw = String(r.exercise || r.name || '').trim(); if (!raw) return null;
  const name = LIFT_NAMES.find(x => x.toLowerCase() === raw.toLowerCase()) || liftName(raw);
  let w = +r.weight; const unit = /kg/i.test(r.unit || '') ? 'kg' : 'lb';
  if (isFinite(w) && w > 0) { if (unit !== S.settings.units) w = unit === 'kg' ? w * KG_LB : w / KG_LB; w = Math.round(w * 2) / 2; } else w = '';
  return { name: name.slice(0, 40), w: w, how: typeof r.how === 'string' ? r.how.slice(0, 80) : '', conf: ['low', 'medium', 'high'].includes(r.confidence) ? r.confidence : 'medium', unit: unit };
}

/* ---- the lift sheet ---- */
function startLiftPhoto(ph) {
  D.snap = null;
  D.lift = { photo: ph ? ph.key : null, blob: ph ? ph.blob : null, art: ph ? null : sceneURI('rack', 14), state: ph ? 'reading' : 'sample', name: '', w: '', reps: '', sets: '', how: '', conf: '' };
  const L = D.lift;
  openSheet(liftSheet, { cls: 'full', onClose: () => { if (D.lift === L) D.lift = null; } });
  if (!ph) { liftFill(L, { name: 'Bench press', w: S.settings.units === 'kg' ? 60 : 135, how: 'a 45 on each side plus the bar (sample)', conf: 'high' }); L.state = 'sample'; drawSheets(false); return; }
  aiLiftPhoto(ph.blob).then(r => {
    if (D.lift !== L) return;
    L.state = r.state; if (r.lift) liftFill(L, r.lift);
    drawSheets(false);
  });
}
function liftFill(L, l) {
  L.name = l.name; L.w = l.w; L.how = l.how || ''; L.conf = l.conf || '';
  const prev = S.lifts[l.name] && S.lifts[l.name][S.lifts[l.name].length - 1];
  if (L.reps === '') L.reps = prev ? prev.reps : 8;
  if (L.sets === '') L.sets = 3;
}
function liftSheet() {
  const L = D.lift; if (!L) return '';
  const c = todayCheckin(), u = S.settings.units, src = L.photo ? PHOTOS[L.photo] : L.art;
  const st = {
    reading: ['', '<span class="spin"></span>Reading the exercise and the weight'],
    ok: [' ok', ic('sparkle', 18) + '<span>' + (L.w === '' ? 'Found the exercise but could not read the weight. Add it below.' : 'Read ' + L.w + ' ' + u + (L.how ? ': ' + esc(L.how) : '') + (L.conf === 'low' ? '. Not sure about this one, so check it.' : '.')) + '</span>'],
    sample: ['', ic('image', 18) + '<span>Sample photo. Your own photos get read by Claude.</span>'],
    no: [' no', ic('info', 18) + '<span>Could not see gym equipment in this photo. Type the lift in, or retake it closer to the weights.</span>'],
    busy: [' no', ic('info', 18) + '<span>Claude is busy. Type the lift in, or try the photo again in a moment.</span>'],
    error: [' no', ic('info', 18) + '<span>Could not read the photo just now. Type the lift in below.</span>'],
    off: ['', ic('info', 18) + '<span>Reading weights from photos needs Claude switched on. Type the lift in below.</span>']
  }[L.state] || ['', ''];
  const f = (k, label, ph, type) => '<div class="field"><label for="lp-' + k + '">' + label + '</label><input class="input" id="lp-' + k + '"' + (type ? ' type="number" inputmode="decimal" min="0"' : ' list="lift-names" autocomplete="off"') + ' data-m="lift.' + k + '" data-on="liftLive" value="' + esc(L[k]) + '" placeholder="' + ph + '"></div>';
  const nx = L.name && S.lifts[L.name] && S.lifts[L.name].length ? nextLift(L.name) : null, last = nx ? S.lifts[L.name][S.lifts[L.name].length - 1] : null;
  let h = sheetHead(c ? 'Add to today\'s workout' : 'Log a lift', { back: true }) + '<div class="sh-b"><div class="prev sq"><img src="' + src + '" alt="Your lift photo"></div><div class="aicheck' + st[0] + '">' + st[1] + '</div>';
  if (L.state !== 'reading') {
    h += f('name', 'Exercise', 'Bench press') + '<div class="lp-nums">' + f('w', 'Weight, ' + u, u, 1) + f('reps', 'Reps', '8', 1) + f('sets', 'Sets', '3', 1) + '</div>' +
      '<div id="lp-hint">' + (last ? '<p class="mute" style="font-size:13px">' + ic('trend', 14) + ' Last time ' + last.w + ' × ' + last.reps + '. Suggested ' + nx.w + ' × ' + nx.reps + '.</p>' : '') + '</div>' +
      (c ? '<p class="mute" style="font-size:13px">' + ic('check', 14) + ' Goes on today\'s ' + esc(TYPE[c.type] ? TYPE[c.type].n.toLowerCase() : 'workout') + ' check-in from ' + clock(c.ts) + '.</p>' : '<p class="mute" style="font-size:13px">' + ic('info', 14) + ' You have not checked in today. This photo becomes your check-in, with the lift on it.</p>');
  }
  return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="liftSave"' + (L.state === 'reading' ? ' disabled' : '') + '>' + (c ? 'Add to today' : 'Check in with this lift') + '</button></div>' +
    '<datalist id="lift-names">' + LIFT_NAMES.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
}
A.liftLive = el => {
  if (el.id !== 'lp-name') return;
  const L = D.lift, n = LIFT_NAMES.find(x => x.toLowerCase() === String(L.name).trim().toLowerCase()), box = $('#lp-hint'); if (!box) return;
  const a = n && S.lifts[n]; if (!a || !a.length) { box.innerHTML = ''; return; }
  const last = a[a.length - 1], nx = nextLift(n); box.innerHTML = '<p class="mute" style="font-size:13px">' + ic('trend', 14) + ' Last time ' + last.w + ' × ' + last.reps + '. Suggested ' + nx.w + ' × ' + nx.reps + '.</p>';
};
A.liftSave = () => {
  const L = D.lift; if (!L) return;
  const raw = String(L.name || '').trim(), name = LIFT_NAMES.find(x => x.toLowerCase() === raw.toLowerCase()) || liftName(raw);
  const lift = { name: name, w: +L.w, reps: Math.round(+L.reps) || 1, sets: Math.round(+L.sets) || '' };
  if (!raw) { toast('Add the exercise name.'); return; }
  if (!(lift.w > 0)) { toast('Add the weight.'); return; }
  const c = todayCheckin();
  if (!c) {
    // No check-in yet today: this photo is the check-in, with the lift already on it.
    const ph = L.photo ? { key: L.photo, blob: L.blob } : null; D.lift = null; closeAll();
    D.pendingLift = lift; startCheckin(ph); return;
  }
  const r = addLiftToday(c, lift);
  D.lift = null; closeAll(); save(); render();
  toast(r.pr ? 'New best on ' + name.toLowerCase() + ': ' + lift.w + ' ' + S.settings.units : name + ' ' + lift.w + ' × ' + lift.reps + ' added to today', r.pr ? 'trend' : 'check');
};
// A lift added after posting: it goes on the check-in, the lift history and the points.
function addLiftToday(c, l) {
  const arr = S.lifts[l.name] || (S.lifts[l.name] = []), best = arr.reduce((a, x) => Math.max(a, x.w), 0);
  arr.push({ ts: now(), w: l.w, reps: l.reps });
  const pr = best > 0 && l.w > best ? { lift: l.name, w: l.w, prev: best } : null;
  (c.lifts || (c.lifts = [])).push(l); c.nl = c.lifts.length;
  if (pr && !c.pr) c.pr = pr;
  c.pts = pointsFor({ mins: c.mins, effort: c.effort, nl: c.nl, pr: c.pr }) + (c.bonus || 0);
  const post = S.posts.find(p => p.cid === c.id); if (post && pr && !post.pr) post.pr = pr;
  if (pr) S.badges.pr = 1;
  return { pr: pr };
}
A.openLiftCam = (el, e) => openCam('lift', e);
