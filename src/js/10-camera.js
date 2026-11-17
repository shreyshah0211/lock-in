/* The camera. One button for everything: snap your gym or your food and Lock In
   works out which it is. Where the browser lets a page use the camera you get a
   live viewfinder. Where it does not (a page hosted on Claude), the button opens
   the phone's own camera and the photo comes back here. */
const cam = { live: null, stream: null, facing: 'environment', busy: false };
const isTouch = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };
function camProbe() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cam.live = false; return; }
  // Inside another page's frame a phone cannot give this page a viewfinder, so go straight to the phone's own camera.
  let framed = true; try { framed = window.self !== window.top; } catch (e) { }
  if (framed && isTouch()) { cam.live = false; return; }
  try { navigator.permissions.query({ name: 'camera' }).then(p => { if (p.state === 'denied') cam.live = false; }).catch(() => { }); } catch (e) { }
}
async function camStart() {
  if (cam.live === false || cam.stream || cam.busy) return;
  cam.busy = true;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (S.ui.tab !== 'cam') s.getTracks().forEach(t => t.stop());
    else { cam.stream = s; cam.live = true; }
  } catch (e) { cam.live = false; }
  cam.busy = false;
  if (S.ui.tab === 'cam') render();
}
function camStop() { if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; } }
function camAttach() { const v = $('#cam-video'); if (v && cam.stream && v.srcObject !== cam.stream) { v.srcObject = cam.stream; const pr = v.play(); if (pr && pr.catch) pr.catch(() => { }); } }

VIEWS.cam = () => {
  const m = S.me, days = pDays(m), alive = pAlive(m), intent = D.camIntent, live = !!cam.stream, det = !intent && D.fromDetected, out = !intent && D.camOutside;
  const said = intent ? null : saidPending();
  const title = intent === 'progress' ? 'Take a progress photo' : intent === 'meal' ? 'Snap your meal' : out ? 'Snap the entrance or outside' : said ? 'Now snap your gym photo' : 'Snap your gym or your food';
  const sub = intent === 'progress' ? 'Saved privately. Only you can see these.' : out ? 'It counts as your check-in. Friends see it was taken outside the gym.' : said ? (sayLine(said) ? 'Heard: ' + esc(sayLine(said)) + '. It' : 'What you said') + ' fills in after the photo.' : det ? 'It goes with the ' + det.mins + ' minute workout ' + esc(det.src) + ' recorded.' : 'Lock In works out which it is and files it for you.';
  const how = live ? 'Point and tap the button.' : isTouch() ? 'Tap the button and your phone\'s camera opens.' : 'Click the button to pick a photo from your computer.';
  const pill = intent ? '<span style="padding-left:4px">' + (intent === 'meal' ? 'Adds to today\'s food' : 'Private photo') + '</span>' : flame(16, '#FF8A1E') + '<span>' + (alive ? days + ' days, ' + fmtLeftShort(leftMs()) + ' left' : canRepair() ? 'A gym photo saves your ' + m.lost.days + ' day streak' : 'A gym photo starts a streak') + '</span>';
  // Sample photos are for looking around. With your own data on, only real photos count.
  const sample = (k, label, src) => S.mode === 'real' ? '<span></span>' : '<button class="cam-side" data-a="camSample" data-k="' + k + '"><span class="b"><img src="' + src + '" alt=""></span>' + label + '</button>';
  const left = intent === 'progress' ? '<button class="cam-side" data-a="camPick"><span class="b">' + ic('image', 24) + '</span>Photo library</button>' : sample('gym', 'Try a gym photo', sceneURI('rack', 14));
  const right = intent === 'progress' ? sample('progress', 'Try a sample', progressURI(3)) : out ? '<span></span>' : sample('food', 'Try a meal photo', mealURI('bowl', 7));
  // Gym photos only: a reminder about who else is in the shot, and a way to check in where photos are not allowed.
  const sayAlt = intent === 'progress' ? '' : said ? '<button class="cam-alt" data-a="saidClear">Forget what I said</button>' : '<button class="cam-alt" data-a="openSay" data-k="' + (intent === 'meal' ? 'meal' : 'auto') + '">' + ic('mic', 16) + 'Say it instead</button>';
  const gymOnly = intent ? '' : '<p class="cam-note">Keep other people and locker rooms out of the shot.</p><button class="cam-alt" data-a="' + (out ? 'camOutsideOff">Back to the normal camera' : 'openNoPhoto">No photos allowed in your gym?') + '</button>';
  return '<div class="cam' + (live ? ' live' : '') + '">' + (live ? '<video id="cam-video" class="cam-bg" autoplay playsinline muted></video>' : '<div class="cam-bg cam-idle"></div>') + '<div class="cam-shade"></div>' +
    '<div class="cam-top"><button class="cam-txt" data-a="camClose">' + ic('x', 20) + 'Close</button><span class="cam-pill">' + pill + '</span>' +
    (live ? '<button class="cam-txt" data-a="camFlip">' + ic('flip', 20) + 'Flip</button>' : '') + '</div>' +
    '<div class="cam-mid"><div class="cam-frame"><i></i><p>' + (live ? '' : '<span class="cam-big">' + ic(out ? 'pin' : 'camera', 44) + '</span>') + title + '<small>' + sub + '</small></p></div></div>' +
    '<div class="cam-bot"><div class="cam-shoot">' + left + '<button class="shutter" data-a="camShoot" aria-label="Take a photo"><i></i></button>' + right + '</div>' +
    '<p class="cam-note">' + how + '</p>' + gymOnly + sayAlt + '</div></div>';
};

let _prevTab = 'home';
const _origTab = A.tab;
A.tab = el => { D.camIntent = null; D.camOutside = false; D.said = null; _origTab(el); };
function openCam(intent, e) {
  if (S.ui.tab !== 'cam') _prevTab = S.ui.tab;
  S.ui.tab = 'cam'; D.camIntent = intent || null; D.camOutside = false; if (intent) D.fromDetected = null;
  closeAll(); render();
  // On a phone where the page cannot show a viewfinder, go straight to the phone's camera.
  if (e && e.isTrusted && cam.live === false && isTouch() && intent !== 'progress') { const i = $('#cam-input'); i.value = ''; i.click(); }
}
A.goCam = (el, e) => { D.fromDetected = null; openCam(null, e); };
A.camClose = () => { S.ui.tab = _prevTab || 'home'; D.camIntent = null; D.camOutside = false; D.said = null; render(); };
A.camFlip = () => { cam.facing = cam.facing === 'user' ? 'environment' : 'user'; camStop(); camStart(); };
A.camShoot = async () => {
  const v = $('#cam-video');
  if (cam.stream && v && v.videoWidth) {
    const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    const blob = dataURLBlob(cv.toDataURL('image/jpeg', .9));
    if (blob) { try { gotPhoto(await fileToPhoto(blob)); } catch (err) { toast('The camera did not return a photo. Try again.'); } return; }
  }
  const i = $('#cam-input'); i.value = ''; i.click();
};
A.camPick = () => { const i = $('#pick-input'); i.value = ''; i.click(); };
A.camSample = el => gotPhoto(null, el.dataset.k);

function dataURLBlob(u) { const bin = atob(u.split(',')[1]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: 'image/jpeg' }); }
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
async function fileToPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const draw = (max, q) => { const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * sc)); cv.height = Math.max(1, Math.round(img.naturalHeight * sc)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv; };
    const small = draw(680, .72).toDataURL('image/jpeg', .72);
    const blob = dataURLBlob(draw(1280, .86).toDataURL('image/jpeg', .86));   // toBlob can wait a second for an idle moment; this does not
    const key = 'ph' + uid(); PHOTOS[key] = small;
    return { key: key, dataURL: small, blob: blob };
  } finally { URL.revokeObjectURL(url); }
}
async function onCamFile(e) {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  e.target.value = '';
  try { gotPhoto(await fileToPhoto(f)); }
  catch (err) { toast('That file would not open as a photo. Try a JPG or PNG.'); }
}

/* ---------- when the gym does not allow photos ----------
   Plenty of gyms ban photos inside. Two other kinds of proof count, and every
   check-in says which kind it was. */
A.openNoPhoto = () => openSheet(() => {
  const d = S.detected, src = workoutSource();
  const way = (icon, t, s, btn) => '<div class="way"><span class="conn-ic">' + ic(icon, 22) + '</span><div class="grow"><b>' + t + '</b><span>' + s + '</span></div>' + btn + '</div>';
  return sheetHead('No photos in your gym?') + '<div class="sh-b"><p class="mute">Some gyms do not allow photos inside. You can still check in, and friends see how each check-in was proven.</p><div class="ways">' +
    way('pin', 'A photo from outside', 'The entrance, the building, your bag at the door.', '<button class="btn btn-ink btn-s" data-a="camOutside">Use this</button>') +
    way('heart', 'A recorded workout', d ? esc(d.src) + ' saw ' + d.mins + ' minutes, ' + ago(d.at) + '.' : src ? 'Nothing new from ' + esc(src.n) + ' yet. It shows up here after your next workout.' : 'Connect Apple Health or Health Connect and a recorded workout can stand in for the photo.',
      d ? '<button class="btn btn-ink btn-s" data-a="ciWorkout">Use this</button>' : src ? '' : '<button class="btn btn-soft btn-s" data-a="openConnections">Connect</button>') +
    '</div><div class="aicheck">' + ic('info', 18) + '<span>Wherever you take it, keep other people and locker rooms out of the shot.</span></div></div>';
});
A.camOutside = () => { D.camOutside = true; D.fromDetected = null; closeSheet(); render(); };
A.camOutsideOff = () => { D.camOutside = false; render(); };
A.ciWorkout = () => { const d = S.detected; if (!d) return; closeAll(); D.snap = null; startCheckin(null, { workout: d }); };

/* ---------- what is this photo? ----------
   Every photo lands here. Claude looks at it once and says gym, food or neither,
   and sends back the details for whichever it is. You never have to wait for it:
   the same three choices are on screen from the first moment. */
const KINDS = [['gym', 'Check-in', 'Gym check-in', 'Counts for your streak and goes to your friends.', 'dumbbell'], ['food', 'Meal', 'Meal', 'Adds calories and protein to today.', 'bowl'], ['progress', 'Progress', 'Progress photo', 'Private. Only you ever see it.', 'lock']];
function gotPhoto(ph, sampleKind) {
  const intent = D.camIntent;
  if (intent === 'progress' || sampleKind === 'progress') { D.snap = null; startProgress(ph); return; }
  const out = !intent && !!D.camOutside; D.camOutside = false;
  const s = D.snap = { ph: ph, sample: !ph, sampleKind: sampleKind || 'gym', kind: null, state: 'working', gym: null, meal: null, manual: false, screen: false, outside: out };
  // An outside photo is taken at its word. It would never look like a gym, so there is nothing to check.
  if (out) { s.kind = 'gym'; s.manual = true; s.state = 'outside'; startCheckin(ph); return; }
  openSheet(snapSheet, { cls: 'full dark' });
  if (!ph) { setTimeout(() => { if (D.snap !== s || s.kind) return; s.kind = sampleKind || 'gym'; s.state = 'sample'; snapRoute(); }, 950); return; }
  setTimeout(() => { if (D.snap === s && s.state === 'working') { s.state = 'slow'; drawSheets(false); } }, 12000);
  aiSnap(ph.blob).then(r => {
    if (D.snap !== s || s.kind) return;
    s.screen = !!r.screen;
    if (r.state === 'ok' && r.kind !== 'other') { s.kind = r.kind; s.gym = r.gym; s.meal = r.meal; s.state = 'ai'; snapRoute(); }
    else if (r.state !== 'ok' && intent === 'meal') { s.kind = 'food'; s.state = r.state; snapRoute(); }
    else { s.state = r.state === 'ok' ? 'unsure' : r.state; drawSheets(false); }
  });
}
function snapSrc(s) { return s.ph ? PHOTOS[s.ph.key] : s.sampleKind === 'food' ? mealURI('bowl', 7) : sceneURI('rack', 14); }
function snapSheet() {
  const s = D.snap; if (!s) return '';
  const working = s.state === 'working';
  const msg = { slow: 'This is taking longer than usual. Tell me what it is, or keep waiting.', unsure: s.screen ? 'This looks like a photo of a screen, so I could not tell what it is. What should I do with it?' : 'I could not tell what this is. What should I do with it?', busy: 'The photo check is busy right now. What is this photo?', off: 'Recognising photos needs Claude switched on for this page. For now, tell me what this is.' }[s.state] || '';
  return '<div class="snapw' + (working ? ' w' : '') + '"><div class="prev"><img src="' + snapSrc(s) + '" alt="The photo you just took"></div>' +
    (working ? '<div class="snap-work"><span class="spin lt"></span><b>Working out what this is</b><span>A few seconds. Or tell me now.</span></div>' : '') +
    '<div class="snap-ask">' + (working ? '' : '<p>' + msg + '</p>') + KINDS.map(k => '<button data-a="snapPick" data-k="' + k[0] + '"><span class="ki">' + ic(k[4], 22) + '</span><span><b>' + k[2] + '</b><small>' + k[3] + '</small></span></button>').join('') + '</div>' +
    '<button class="intro-skip" data-a="snapCancel">Cancel</button></div>';
}
function snapRoute() {
  const s = D.snap; if (!s) return;
  closeSheet();
  if (s.kind === 'food') startMeal(s.ph); else if (s.kind === 'progress') startProgress(s.ph); else startCheckin(s.ph);
}
A.snapPick = el => { const s = D.snap; if (!s) return; s.kind = el.dataset.k; s.manual = true; snapRoute(); };
A.snapCancel = () => { D.snap = null; closeSheet(); };
// The switch at the top of every review screen: one tap moves the photo to where it belongs.
A.snapAs = el => { const s = D.snap, k = el.dataset.k; if (!s || s.kind === k) return; s.kind = k; s.manual = true; s.outside = false; D.ci = D.meal = D.pg = null; snapRoute(); };
function kindSwitch() {
  const s = D.snap; if (!s) return '';
  const what = s.kind === 'gym' ? 'a gym photo' : s.kind === 'food' ? 'food' : 'a progress photo';
  const why = s.outside ? 'Filed as an outside photo' : s.manual || (s.state !== 'ai' && s.state !== 'sample') ? 'Filed as ' + what : 'Recognised as ' + what;
  return '<div class="kind"><div class="kind-l"><span>' + ic('sparkle', 16) + why + '</span><span>Wrong? Tap where it belongs.</span></div><div class="seg">' + KINDS.map(k => '<button data-a="snapAs" data-k="' + k[0] + '" aria-pressed="' + (s.kind === k[0]) + '">' + k[1] + '</button>').join('') + '</div></div>';
}

/* ---------- check-in ---------- */
const TAGS = ['Easy day', 'Sick', 'Exam week', 'Travelling'];   // context for a session, so a light week is read as what it was
function nextType() {
  const last = S.checkins[S.checkins.length - 1], cyc = ['push', 'pull', 'legs'];
  if (!last) return 'full';
  const i = cyc.indexOf(last.type); return i < 0 ? 'push' : cyc[(i + 1) % 3];
}
// opts.workout: check in on the recorded workout alone, with no photo at all.
function startCheckin(ph, opts) {
  const only = opts && opts.workout;
  const det = only || (D.fromDetected && S.detected && D.fromDetected.id === S.detected.id ? S.detected : null); D.fromDetected = null;
  const sn = only ? null : D.snap, seen = sn && sn.gym, out = !!(sn && sn.outside);   // seen: Claude already looked at this photo
  const type = det ? det.type : seen && seen.workout ? seen.workout : nextType();
  D.ci = { type: type, touched: !!det, mins: det ? det.mins : 50, effort: det ? (det.hr > 150 ? 4 : det.hr > 138 ? 3 : 2) : 3, lifts: [], caption: '', audience: 'friends', more: false, tag: '', device: det ? det.src : '',
    photo: ph ? ph.key : null, scene: only ? { stat: { mins: det.mins, hr: det.hr, kcal: det.kcal, type: type } } : ph ? null : sceneFor(type, Math.floor(Math.random() * 1e6)),
    noPhoto: !!only, outside: out, screen: !!(sn && sn.screen), ai: only ? 'workout' : out ? 'outside' : !ph ? 'sample' : seen ? 'ok' : 'checking', note: seen ? seen.note : '' };
  const said = saidPending(); if (said) { sayApply(D.ci, said); D.said = null; }   // described out loud before the photo
  openSheet(checkinSheet, { cls: 'full', onClose: () => { if (D.ci) D.snap = null; } });
  if (ph && !seen && !out) {
    const d = D.ci;
    aiGymCheck(ph.blob).then(r => {
      if (D.ci !== d) return;
      d.ai = r.state; d.note = r.note || ''; d.screen = !!r.screen;
      const box = $('#ci-proof'); if (box) box.innerHTML = aiRow(d);
      if (r.workout && !d.touched && r.workout !== d.type) { d.type = r.workout; const tc = $('#ci-types'); if (tc) tc.innerHTML = typeChips(d); }
    });
  }
}
// What backs this check-in, said in plain words above the form.
function aiRow(d) {
  const m = {
    checking: ['', '<span class="spin"></span>Checking that this looks like a gym'],
    ok: [' ok', ic('check', 18) + 'Gym photo verified' + (d.note ? ': ' + esc(d.note) : '')],
    no: [' no', ic('info', 18) + 'This does not look like a workout. You can still post it, marked as not verified.'],
    sample: ['', ic('image', 18) + 'Sample photo. Your own photos get checked by Claude.'],
    busy: ['', ic('info', 18) + 'The gym check is busy right now. Posting without it.'],
    off: ['', ic('info', 18) + 'Checking photos needs Claude switched on for this page. Posting without it.'],
    outside: ['', ic('pin', 18) + 'Outside photo. It counts, and friends see it was taken outside the gym.'],
    workout: [' ok', ic('heart', 18) + 'No photo. This check-in rests on the ' + d.mins + ' minute workout ' + esc(d.device) + ' recorded.']
  }[d.ai] || ['', ''];
  return '<div class="aicheck' + m[0] + '">' + m[1] + '</div>' +
    (d.device && !d.noPhoto ? '<div class="aicheck ok">' + ic('heart', 18) + d.mins + ' minutes and effort filled in from ' + esc(d.device) + '.</div>' : '') +
    (d.said ? '<div class="aicheck ok">' + ic('mic', 18) + '<span>From what you said: ' + esc(d.said) + '</span></div>' : '') +
    (d.screen ? '<div class="aicheck warn">' + ic('info', 18) + '<span>This looks like a photo of a screen. Retake it if you can.</span><button class="link" data-a="ciRetake">Retake</button></div>' : '');
}
function ciProof(d) { return d.noPhoto ? 'workout' : d.outside ? 'outside' : d.device ? 'both' : 'photo'; }
function typeChips(d) { return TYPES.map(t => '<button class="chip" data-a="ciType" data-k="' + t.k + '" aria-pressed="' + (d.type === t.k) + '">' + t.n + '</button>').join(''); }
function ciPts(d) { return pointsFor({ mins: d.mins, effort: d.effort, nl: d.lifts.filter(l => l.name).length }); }
function checkinSheet() {
  const d = D.ci; if (!d) return '';
  const m = S.me, day = pAlive(m) ? pDays(m) : canRepair() ? m.lost.days : 1, src = imgOf(d);
  const eff = [1, 2, 3, 4].map(n => '<button data-a="ciEffort" data-n="' + n + '" aria-pressed="' + (d.effort === n) + '"><span class="fl">' + flame(15).repeat(n) + '</span>' + EFFORT[n] + '</button>').join('');
  const lifts = d.lifts.length ? '<div class="lift-h"><span>Exercise</span><span>Weight</span><span>Reps</span><span>Sets</span><span></span></div>' + d.lifts.map((l, i) =>
    '<div class="lift"><input class="input" id="lf-n' + i + '" list="lift-names" placeholder="Bench press" data-m="ci.lifts.' + i + '.name" data-on="ciPtsLive" value="' + esc(l.name || '') + '" autocomplete="off"><input class="input" id="lf-w' + i + '" type="number" inputmode="decimal" placeholder="' + S.settings.units + '" data-m="ci.lifts.' + i + '.w" value="' + esc(l.w) + '"><input class="input" id="lf-r' + i + '" type="number" inputmode="numeric" placeholder="5" data-m="ci.lifts.' + i + '.reps" value="' + esc(l.reps) + '"><input class="input" id="lf-s' + i + '" type="number" inputmode="numeric" placeholder="3" data-m="ci.lifts.' + i + '.sets" value="' + esc(l.sets) + '"><button class="rm" data-a="ciLiftDel" data-i="' + i + '" aria-label="Remove exercise">' + ic('x', 18) + '</button></div>').join('') : '';
  // Two questions are enough to post. Everything else is optional and tucked away.
  const more = d.more ? '<div class="field"><span class="lbl">How long?</span><div class="stepper"><button data-a="ciMins" data-d="-5" aria-label="5 minutes less">' + ic('minus') + '</button><span class="v" id="ci-mins">' + d.mins + '</span><button data-a="ciMins" data-d="5" aria-label="5 minutes more">' + ic('plus') + '</button><span class="u">minutes</span></div></div>' +
    '<div class="field"><span class="lbl">Lifts</span>' + lifts + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-line btn-s" data-a="ciLiftAdd">' + ic('plus', 16) + 'Add a lift</button>' + '</div></div>' +
    '<div class="field"><span class="lbl">Anything to note about today?</span><div class="chips">' + TAGS.map(t => '<button class="chip" data-a="ciTag" data-k="' + t + '" aria-pressed="' + (d.tag === t) + '">' + t + '</button>').join('') + '</div></div>' +
    '<div class="field"><label for="ci-cap">Caption</label><input class="input" id="ci-cap" placeholder="Say something about today" maxlength="120" data-m="ci.caption" value="' + esc(d.caption) + '" autocomplete="off"></div>' +
    '<div class="field"><span class="lbl">Who can see it</span><div class="seg">' + [['friends', 'Friends'], ['squads', 'My squads'], ['me', 'Only me']].map(x => '<button data-a="ciAud" data-k="' + x[0] + '" aria-pressed="' + (d.audience === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>'
    : '<button class="btn btn-line btn-w" data-a="ciMore">' + ic('plus', 18) + 'Add time, lifts, a note or a caption</button>';
  return sheetHead('New check-in', { back: true }) + '<div class="sh-b">' + kindSwitch() +
    '<div class="prev"><img src="' + src + '" alt="' + (d.noPhoto ? 'Your recorded workout' : 'Your check-in photo') + '"><div class="tags"><span class="stick">' + flame(17, '#FF8A1E') + '<span style="color:#fff">Day <span class="num" style="font-size:19px">' + day + '</span></span></span><span class="stick">' + clock(now()) + ' at ' + esc(m.gym) + '</span></div></div>' +
    '<div class="proofs" id="ci-proof">' + aiRow(d) + '</div>' +
    '<button class="btn btn-line btn-w say-in" data-a="openSay" data-k="workout">' + ic('mic', 20) + (d.said ? 'Say it again' : 'Say what you trained') + '</button>' +
    '<div class="field"><span class="lbl">What did you train?</span><div class="chips" id="ci-types">' + typeChips(d) + '</div></div>' +
    '<div class="field"><span class="lbl">How hard was it?</span><div class="effort">' + eff + '</div></div>' + more +
    '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="ciPost">Post check-in<span id="ci-pts" style="opacity:.85;font-weight:600">+' + ciPts(d) + ' points</span></button></div>' +
    '<datalist id="lift-names">' + LIFT_NAMES.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
}
A.ciType = el => { const d = D.ci; d.type = el.dataset.k; d.touched = true; if (d.noPhoto) d.scene.stat.type = d.type; else if (!d.photo) d.scene = sceneFor(d.type, d.scene.seed); drawSheets(false); };
A.ciMins = el => { D.ci.mins = clamp(D.ci.mins + (+el.dataset.d), 10, 180); $('#ci-mins').textContent = D.ci.mins; A.ciPtsLive(); };
A.ciEffort = el => { D.ci.effort = +el.dataset.n; drawSheets(false); };
A.ciAud = el => { D.ci.audience = el.dataset.k; drawSheets(false); };
A.ciTag = el => { D.ci.tag = D.ci.tag === el.dataset.k ? '' : el.dataset.k; drawSheets(false); };
A.ciMore = () => { D.ci.more = true; drawSheets(false); };
A.ciRetake = () => { D.ci = null; D.snap = null; closeSheet(); };
A.ciLiftAdd = () => { D.ci.lifts.push({ name: '', w: '', reps: '', sets: '' }); drawSheets(false); const i = $('#lf-n' + (D.ci.lifts.length - 1)); if (i) i.focus(); };
A.ciLiftDel = el => { D.ci.lifts.splice(+el.dataset.i, 1); drawSheets(false); };
A.ciPtsLive = () => { const e = $('#ci-pts'); if (e) e.textContent = '+' + ciPts(D.ci) + ' points'; };
A.ciPost = () => {
  const d = D.ci; if (!d) return;
  const before = leftMs();
  if (d.photo) savePhoto(d.photo, PHOTOS[d.photo]);
  const res = doCheckin({ type: d.type, mins: d.mins, effort: d.effort, lifts: d.lifts, caption: d.caption.trim(), photo: d.photo, scene: d.scene, verified: d.ai === 'ok' && !d.screen ? true : d.ai === 'no' ? false : d.ai === 'sample' ? 'sample' : null, audience: d.audience, proof: ciProof(d), tag: d.tag, screen: d.screen });
  if (d.device) { S.detected = null; S.detectedUsedAt = now(); save(); }
  S.ui.coach = false; save();
  D.ci = null; D.snap = null; D.camIntent = null; closeAll(); S.ui.tab = 'home'; scrollPos.home = 0; render();
  showDone(res, before);
};
// After a check-in: the clock refills, a new best gets its moment, then one suggestion.
function duoPick() {
  if (duoCount() >= DUO_MAX) return null;
  return following().filter(f => !f.duo && pAlive(f)).sort((a, b) => b.lastCheckin - a.lastCheckin)[0] || null;
}
function showDone(res, leftBefore) {
  const from = leftBefore > 0 ? Math.ceil(clamp(leftBefore / WINDOW, 0, 1) * 48) : 0;
  calSet('done', deadlineEvent());
  const duo = duoPick(); D.doneDuo = duo ? duo.id : null;
  openSheet(() => {
    const m = S.me, days = pDays(m), f = D.doneDuo ? person(D.doneDuo) : null, pr = res.c.pr, u = S.settings.units;
    const next = f ? (f.duo ? '<div class="aicheck ok" style="justify-content:center">' + ic('check', 18) + 'Duo streak started with ' + esc(first(f.name)) + '</div>' : '<button class="btn btn-glass" data-a="doneDuo">' + ic('users', 18) + 'Start a duo streak with ' + esc(first(f.name)) + '</button>') : '';
    return '<div class="done">' + dial(pr ? 196 : 236, WINDOW, days, { id: 'done-dial', mid: '<b' + (pr ? ' style="font-size:58px"' : '') + '>48:00</b><span>back on your clock</span>' }) +
      '<h2>' + (res.repaired ? 'Streak restored' : res.had ? 'Day ' + days + ', locked in' : 'New streak started') + '</h2>' +
      '<p>Your next photo is due ' + whenBy(deadline()) + '.</p>' +
      (pr ? '<div class="pr-banner">' + ic('trend', 24) + '<div><b>New best: ' + esc(pr.lift) + ' ' + pr.w + ' ' + u + '</b><span>' + (pr.prev ? 'Up ' + (Math.round((pr.w - pr.prev) * 10) / 10) + ' ' + u + ' on your old best of ' + pr.prev + '.' : 'Your heaviest yet.') + '</span></div></div>' : '') +
      '<div class="earn"><span class="pill">' + ic('bolt', 15) + '+' + res.pts + ' effort points</span>' + res.earned.map(e => '<span class="pill">' + ic(e.icon, 15) + esc(e.text) + '</span>').join('') + '</div>' +
      '<div class="acts"><button class="btn btn-white" data-a="closeSheet">Done</button>' + next + '<div class="done-links">' + doneCal() + '</div></div></div>';
  }, { cls: 'full dark', after: (el, sh) => { if (!el || sh.ran) return; sh.ran = true; animateDial($('#done-dial'), from); } });
}
function doneCal() {
  const st = (D.cal || (D.cal = {})).done || {}, ev = D.calEv && D.calEv.done; if (!ev) return '';
  if (st.ok) return '<span>' + ic('check', 16) + 'On your calendar</span>';
  if (!_mcp || st.err) return '<a href="' + esc(calLink(ev)) + '" target="_blank" rel="noopener">' + ic('calendar', 16) + 'Add deadline to calendar</a>';
  return '<button data-a="calGo" data-k="done"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '<span class="spin"></span>Adding' : ic('calendar', 16) + 'Add deadline to calendar') + '</button>';
}
A.doneDuo = () => { if (D.doneDuo) A.startDuo({ dataset: { id: D.doneDuo }, quiet: true }); };
function animateDial(dialEl, fromLit) {
  if (!dialEl) return;
  const lines = $$('line', dialEl), col = lines[47].getAttribute('stroke');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lines.forEach((l, i) => { if (i < 48 - fromLit) l.setAttribute('stroke', 'rgba(255,255,255,.14)'); });
  let k = fromLit; const step = () => { if (k >= 48) return; k++; const l = lines[48 - k]; if (l) l.setAttribute('stroke', col); setTimeout(step, 22); };
  setTimeout(step, 260);
}

/* ---------- progress photo ---------- */
const PG_TAGS = ['Front', 'Side', 'Back', 'Arms', 'Legs', 'Form check'];
function startProgress(ph) {
  D.pg = { photo: ph ? ph.key : null, art: ph ? null : S.progress.length % 4, tag: 'Front', note: '' };
  openSheet(() => {
    const d = D.pg; if (!d) return '';
    return sheetHead('Progress photo', { back: true }) + '<div class="sh-b">' + kindSwitch() + '<div class="prev" style="aspect-ratio:3/4"><img src="' + (d.photo ? PHOTOS[d.photo] : progressURI(d.art)) + '" alt="Your progress photo"></div>' +
      '<div class="aicheck">' + ic('lock', 18) + 'Private. Progress photos never go to your feed.</div>' +
      '<div class="field"><span class="lbl">What is this a photo of?</span><div class="chips">' + PG_TAGS.map(t => '<button class="chip" data-a="pgTag" data-k="' + t + '" aria-pressed="' + (d.tag === t) + '">' + t + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="pg-note">Note</label><input class="input" id="pg-note" data-m="pg.note" value="' + esc(d.note) + '" placeholder="Week 12, bulking" autocomplete="off"></div>' +
      '</div><div class="sticky-cta"><button class="btn btn-ink btn-w" data-a="pgSave">Save to progress</button></div>';
  }, { cls: 'full', onClose: () => { if (D.pg) D.snap = null; } });
}
A.pgTag = el => { D.pg.tag = el.dataset.k; drawSheets(false); };
A.pgSave = () => {
  const d = D.pg; if (!d) return;
  if (d.photo) savePhoto(d.photo, PHOTOS[d.photo]);
  S.progress.push({ id: uid(), ts: now(), tag: d.tag, note: d.note.trim(), photo: d.photo, art: d.art });
  D.pg = null; D.snap = null; D.camIntent = null; S.ui.tab = 'you'; closeAll(); save(); render(); A.openProgress();
  toast('Saved to your progress photos', 'lock');
};
