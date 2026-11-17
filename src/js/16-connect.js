/* Connections to other apps and devices.
   Workouts come in through the two phone-level health stores and nothing else:
   Apple Health and Health Connect. Strava, Garmin, Whoop and the rest reach Lock In
   through those, which is also what their own terms allow a friends feed to do.
   Google Calendar is real when the page is allowed to use the viewer's calendar
   connector, and falls back to a calendar link otherwise. The health stores cannot
   be reached from a web page, so here they are simulated with labelled sample data. */
const CONNS = [
  { k: 'health', n: 'Apple Health', g: 'in', icon: 'heart', d: 'One switch covers nearly everything on iPhone. Whatever writes to Apple Health comes along: Apple Watch, Garmin, Whoop, Oura, Fitbit, Strava.', reads: ['Workouts', 'Steps and active calories', 'Sleep'], src: 'Apple Health' },
  { k: 'hconnect', n: 'Health Connect', g: 'in', icon: 'heart', d: 'The same for Android: Pixel Watch, Galaxy Watch, Fitbit and the apps that sync to them.', reads: ['Workouts', 'Steps and active calories', 'Sleep'], src: 'Health Connect' },
  { k: 'gcal', n: 'Google Calendar', g: 'out', icon: 'calendar', d: 'Put your next check-in deadline on your calendar.', reads: [], real: true }
];
// Apps Lock In never connects to directly. Their workouts arrive through the health store on the phone.
const CONN_VIA = [['Strava', 'wave'], ['Garmin', 'clock'], ['Whoop', 'bolt'], ['Oura', 'target'], ['Fitbit', 'heart'], ['Hevy', 'dumbbell']];
const CONN = Object.fromEntries(CONNS.map(c => [c.k, c]));
const WORKOUT_SRC = ['health', 'hconnect'];
function conn() { return S.conn || (S.conn = {}); }
function connCount() { return CONNS.filter(c => conn()[c.k]).length; }
function workoutSource() { const k = WORKOUT_SRC.find(x => conn()[x]); return k ? CONN[k] : null; }

/* ---- a workout your watch or phone recorded ----
   A recorded workout never checks you in by itself. It reminds you, and fills in
   the time and effort once you add the photo. The photo stays the check-in. */
function makeDetected(src) {
  return { id: uid(), src: src.src, type: nextType(), mins: 46 + Math.floor(Math.random() * 14), hr: 128 + Math.floor(Math.random() * 22), kcal: 310 + Math.floor(Math.random() * 160), at: now() - (25 + Math.random() * 30) * MIN };
}
function refreshDetected() {
  const src = workoutSource();
  if (!src) { S.detected = null; return; }
  // a new recorded workout turns up once the last one is used and some time has passed
  if (!S.detected && (!S.detectedUsedAt || now() - S.detectedUsedAt > 18 * HOUR)) S.detected = makeDetected(src);
}
function detectedCard() {
  const d = S.detected; if (!d) return '';
  return '<section class="detect"><div class="dt-h"><span class="dt-ic">' + ic('heart', 20) + '</span><div><b>' + esc(d.src) + ' saw a ' + d.mins + ' minute workout</b><span>' + ago(d.at) + '. Add a photo to make it your check-in.</span></div></div>' +
    '<div class="dt-a"><button class="btn btn-go" data-a="detPhoto">' + ic('camera', 18) + 'Add your photo</button><button class="btn btn-soft" data-a="detSkip">Not now</button></div>' +
    '<button class="dt-alt" data-a="ciWorkout">Check in without a photo</button></section>';
}
A.detPhoto = () => { const d = S.detected; A.goCam(); D.fromDetected = d; render(); };
A.detSkip = () => { S.detected = null; S.detectedUsedAt = now(); save(); render(); };

/* ---- sample numbers a health source would supply ---- */
function healthToday() {
  const src = workoutSource(); if (!src) return null;
  const d = new Date(now()), frac = clamp((d.getHours() + d.getMinutes() / 60 - 7) / 15, 0.04, 1), seed = hash('h' + dayNum(now()));
  return { steps: Math.round((6200 + seed % 5200) * frac), kcal: Math.round((380 + seed % 300) * frac), sleep: 6.2 + (seed % 20) / 10, src: src.n };
}

/* ---- the connections screen ---- */
function connRow(x) {
  const on = !!conn()[x.k];
  return '<button class="conn" data-a="openConn" data-k="' + x.k + '"><span class="conn-ic">' + ic(x.icon, 22) + '</span><span class="grow"><b>' + x.n + '</b><span>' + (on ? 'Connected' : x.real ? 'Works for real in this prototype' : x.k === 'health' ? 'iPhone and Apple Watch' : 'Android phones and watches') + '</span></span><span class="pill ' + (on ? 'ok' : '') + '">' + (on ? ic('check', 13) + 'On' : 'Connect') + '</span></button>';
}
A.openConnections = () => {
  openSheet(() => {
    const list = g => '<div class="conn-list">' + CONNS.filter(x => x.g === g).map(connRow).join('') + '</div>';
    return sheetHead('Connections', { back: true }) + '<div class="sh-b">' +
      '<div><h3 class="h2">Bring workouts in</h3><p class="mute" style="font-size:13.5px;margin:2px 0 10px">When your watch or phone records a workout, Lock In reminds you to add the photo and fills in the time for you. In a gym with no photos, the workout can be the check-in.</p>' + list('in') + '</div>' +
      '<div><h3 class="h2">These arrive through them</h3><p class="mute" style="font-size:13.5px;margin:2px 0 10px">Lock In does not connect to these directly. Switch on sharing to Apple Health or Health Connect inside each app, and their workouts come along.</p><div class="later">' + CONN_VIA.map(x => '<span>' + ic(x[1], 16) + x[0] + '</span>').join('') + '</div></div>' +
      '<div><h3 class="h2" style="margin-bottom:10px">Send deadlines out</h3>' + list('out') + '</div>' +
      '<p class="mute" style="font-size:13px">In this prototype Apple Health and Health Connect use sample data, because a web page cannot open their permission screens. Google Calendar is the real thing.</p></div>';
  }, { cls: 'full' });
};
A.openConn = el => {
  const k = el.dataset.k, x = CONN[k];
  if (k === 'gcal') { openCalSheet(); return; }
  openSheet(() => {
    const on = !!conn()[k];
    return sheetHead(x.n) + '<div class="sh-b"><div style="display:flex;gap:14px;align-items:center"><span class="conn-ic big">' + ic(x.icon, 30) + '</span><p style="flex:1">' + x.d + '</p></div>' +
      '<div class="card" style="padding:6px 16px"><div class="rows">' + x.reads.map(r => '<div class="row" style="padding:11px 0"><div class="grow">' + r + '</div>' + ic('check', 18) + '</div>').join('') + '</div></div>' +
      '<p class="mute" style="font-size:13px">Lock In only reads what is listed, keeps it private to you, and never uses it for ads.</p>' +
      '<div class="aicheck">' + ic('info', 18) + 'Prototype: this turns on sample ' + x.n + ' data. The real app would open ' + x.n + '\'s own permission screen here.</div>' +
      (on ? '<button class="btn btn-line btn-w" data-a="connOff" data-k="' + k + '">Disconnect ' + x.n + '</button>' : '<button class="btn btn-go btn-w" data-a="connOn" data-k="' + k + '">Connect ' + x.n + '</button>') + '</div>';
  });
};
A.connOn = el => {
  const k = el.dataset.k, x = CONN[k]; conn()[k] = true;
  let msg = x.n + ' connected';
  if (WORKOUT_SRC.includes(k)) { S.detectedUsedAt = 0; S.detected = null; refreshDetected(); msg = x.n + ' connected. It found a workout from today.'; }
  addActivity({ icon: 'check', text: x.n + ' is connected.' });
  save(); closeSheet(); refresh(); toast(msg, 'check');
};
A.connOff = el => { const k = el.dataset.k; conn()[k] = false; if (!workoutSource()) S.detected = null; save(); closeSheet(); refresh(); toast(CONN[k].n + ' disconnected'); };

/* ---- Google Calendar: real ---- */
let _mcp;
function initMCP() {
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('mcp').then(m => { _mcp = m || null; }).catch(() => { _mcp = null; }); else _mcp = null; }
  catch (e) { _mcp = null; }
}
function realTime(ts) { return ts - S.offset; }   // prototype time can be skipped ahead; calendars need the real clock
function calLocal(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':00'; }
function calLink(ev) {
  const z = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + z(ev.start) + '/' + z(ev.end) + '&details=' + encodeURIComponent(ev.desc);
}
function deadlineEvent() {
  const end = realTime(deadline());
  return { title: 'Lock In: check in by ' + clock(end), start: end - HOUR, end: end, desc: 'Your 48 hours run out at ' + clock(end) + '. Post a gym photo before then to keep your streak.' };
}
const CAL_ERR = {
  needs_reauth: 'Google Calendar needs reconnecting in Claude settings, under Connectors.',
  server_not_connected: 'Google Calendar is not connected to Claude yet. Add it in Claude settings, under Connectors.',
  selection_required: 'Choose which Google Calendar connector to use in Claude, then try again.',
  not_in_manifest: 'Calendar access was not allowed for this page.',
  approval_required: 'Adding the event needs your approval in Claude.',
  blocked_by_policy: 'Your organization does not allow this page to use Google Calendar.',
  not_granted: 'Calendar access is not available in this view.'
};
async function calAdd(ev) {
  if (!_mcp) return { ok: false, code: 'none' };
  try {
    await _mcp.callTool('Google Calendar', 'create_event', { summary: ev.title, startTime: calLocal(ev.start), endTime: calLocal(ev.end), description: ev.desc, availability: 'AVAILABILITY_FREE', overrideReminders: [{ method: 'popup', minutes: 30 }] });
    return { ok: true };
  } catch (e) { return { ok: false, code: (e && e.code) || 'upstream_error' }; }
}
// One calendar control used everywhere: a one-tap button when the connector is there, a plain link otherwise.
function calControl(key, label) {
  const st = (D.cal || (D.cal = {}))[key] || {}, ev = D.calEv && D.calEv[key];
  if (!ev) return '';
  if (st.ok) return '<div class="aicheck ok">' + ic('check', 18) + 'Added to your Google Calendar.</div>';
  const link = '<a class="btn btn-line btn-w" href="' + esc(calLink(ev)) + '" target="_blank" rel="noopener">' + ic('calendar', 18) + (st.err ? 'Open it in Google Calendar instead' : label) + '</a>';
  if (!_mcp) return link;
  return (st.err ? '<div class="aicheck no">' + ic('info', 18) + esc(st.err) + '</div>' + link : '<button class="btn btn-line btn-w" data-a="calGo" data-k="' + key + '"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '<span class="spin"></span>Adding' : ic('calendar', 18) + label) + '</button>');
}
function calSet(key, ev) { (D.calEv || (D.calEv = {}))[key] = ev; if (D.cal) delete D.cal[key]; }
A.calGo = async el => {
  const key = el.dataset.k, ev = D.calEv && D.calEv[key]; if (!ev) return;
  const st = D.cal[key] = { busy: true }; drawSheets(false);
  const evs = Array.isArray(ev.many) ? ev.many : [ev]; let res = { ok: true };
  for (const one of evs) { res = await calAdd(one); if (!res.ok) break; }
  st.busy = false;
  if (res.ok) { st.ok = true; conn().gcal = true; save(); toast('Added to Google Calendar', 'check'); }
  else st.err = CAL_ERR[res.code] || 'Google Calendar could not be reached just now.';
  if (sheets.length) drawSheets(false);
};
function openCalSheet() {
  calSet('deadline', deadlineEvent());
  openSheet(() => {
    const alive = pAlive(S.me);
    return sheetHead('Google Calendar') + '<div class="sh-b"><div style="display:flex;gap:14px;align-items:center"><span class="conn-ic big">' + ic('calendar', 30) + '</span><p style="flex:1">' + CONN.gcal.d + '</p></div>' +
      (alive ? '<div class="card"><div class="mute" style="font-size:13px;font-weight:600">Your next deadline</div><div style="font-size:18px;font-weight:800;margin-top:2px">' + dateLong(realTime(deadline())) + ' at ' + clock(realTime(deadline())) + '</div><div class="mute" style="font-size:13.5px;margin-top:4px">The event lands in the hour before, with a reminder 30 minutes ahead.</div></div>' + calControl('deadline', 'Add my deadline to Google Calendar')
        : '<div class="aicheck">' + ic('info', 18) + 'You have no deadline right now. Check in first, then add it.</div>') +
      '<p class="mute" style="font-size:13px">' + (_mcp ? 'This uses the Google Calendar connector on your Claude account and asks before it adds anything.' : 'This opens Google Calendar with the event filled in, ready to save.') + '</p></div>';
  });
}
