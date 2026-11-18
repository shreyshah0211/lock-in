/* My gym. Set it once, from where you are standing or by searching, and the iPhone app
   notes when you arrive and when you leave (ios/LockIn/GymWatcher.swift). That time fills
   in your check-in and shows on Today. Your location and visits stay on the phone: they
   are not synced to your account and friends never see them. */
const GYM = { visits: [], inside: false, status: 'unknown', watching: false, loaded: false };
function gymSync() {
  if (S.gymLoc) GYMS[S.gymLoc.name] = [S.gymLoc.lat, S.gymLoc.lon, ''];   // a gym you set is a real place on the friends map too
  const h = appNative(); if (!h) return Promise.resolve();
  return h.postMessage({ op: 'gymVisits' }).then(r => {
    if (!r) return;
    const was = JSON.stringify([GYM.visits.length, GYM.inside]);
    GYM.visits = (r.visits || []).map(v => ({ in: v.in, out: v.out || null })); GYM.inside = !!r.inside; GYM.status = r.status; GYM.watching = !!r.watching; GYM.loaded = true;
    if (JSON.stringify([GYM.visits.length, GYM.inside]) !== was) softRefresh();
  }).catch(() => { });
}
setTimeout(gymSync, 800);
setInterval(gymSync, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) gymSync(); });

const visitEnd = v => v.out || Date.now();
const visitMins = v => Math.max(0, Math.round((visitEnd(v) - v.in) / 60000));
function fmtMins(m) { return m >= 60 ? Math.floor(m / 60) + ' h ' + pad2(m % 60) + ' min' : m + ' min'; }
// Today's time at the gym: the visit you are in now, or the longest one today.
function gymToday() {
  const d = dayNum(Date.now()), today = GYM.visits.filter(v => dayNum(v.in) === d || (v.out && dayNum(v.out) === d));
  if (!today.length) return null;
  const now0 = today.find(v => !v.out);
  return now0 ? { inside: true, mins: visitMins(now0), v: now0 } : { inside: false, mins: Math.max(...today.map(visitMins)), v: today.reduce((a, v) => visitMins(v) > visitMins(a) ? v : a) };
}

A.openMyGym = () => {
  closeAll(); D.gy = { q: '', results: null, busy: false, name: (S.gymLoc && S.gymLoc.name) || S.me.gym || '' };
  gymSync().then(() => drawSheets(false));
  openSheet(myGymSheet, { cls: 'full' });
};
function myGymSheet() {
  const g = S.gymLoc, G = D.gy; if (!G) return '';
  let h = sheetHead('My gym') + '<div class="sh-b">';
  if (!appNative()) return h + '<p class="mute">Knowing when you are at the gym works in the iPhone app, which can use your phone\'s location.</p></div>';
  if (g) {
    const t = gymToday(), recent = GYM.visits.slice().reverse().filter(v => visitMins(v) >= 5).slice(0, 8);
    h += '<div class="card gy-now"><span class="gy-dot' + (GYM.inside ? ' on' : '') + '"></span><div class="grow"><b>' + esc(g.name) + '</b><span class="mute">' + (GYM.inside && t ? 'You are here now, ' + fmtMins(t.mins) : t ? 'Today: ' + fmtMins(t.mins) : 'Not here right now') + '</span></div><button class="btn btn-soft btn-s" data-a="gymMap">' + ic('pin', 15) + 'Map</button></div>';
    if (GYM.status !== 'always') h += '<div class="aicheck no">' + ic('info', 18) + '<span>' + (GYM.status === 'denied' ? 'Location is off for Lock In. Turn it on in Settings, Lock In, Location, and choose Always.' : 'For Lock In to notice you arriving while the app is closed, set Location to Always in Settings, Lock In.') + '</span></div>';
    h += '<div class="field"><span class="lbl">Recent visits</span>' + (recent.length ? '<div class="card" style="padding:4px 16px"><div class="rows">' + recent.map(v => '<div class="row" style="padding:10px 0"><div class="grow"><div class="t">' + dateLong(v.in) + '</div><div class="s">' + clock(v.in) + ' to ' + (v.out ? clock(v.out) : 'now') + '</div></div><b>' + fmtMins(visitMins(v)) + '</b></div>').join('') + '</div></div>' : '<p class="mute" style="font-size:13.5px">Your visits show up here after your next trip to the gym.</p>') + '</div>' +
      '<div class="two"><button class="btn btn-line" data-a="gymChange">' + ic('pencil', 16) + 'Change gym</button><button class="btn btn-line" data-a="gymStop">' + ic('x', 16) + 'Stop</button></div>';
    return h + '<p class="mute" style="font-size:12.5px">Your location and visits stay on this phone. Friends never see them.</p></div>';
  }
  h += '<p class="mute">Set your gym once. The app then notes when you arrive and when you leave, times your workout, and fills it into your check-in.</p>' +
    '<button class="btn btn-go btn-w" data-a="gymHere"' + (G.busy ? ' disabled' : '') + '>' + (G.busy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>Finding you' : ic('pin', 18) + 'I am at my gym now') + '</button>' +
    '<div class="field"><label for="gy-q">Or search for it</label><div class="send"><input class="input" id="gy-q" data-m="gy.q" data-enter="gymSearch" placeholder="IMA, 24 Hour Fitness, Planet Fitness" autocomplete="off" value="' + esc(G.q) + '"><button class="btn btn-ink" data-a="gymSearch" aria-label="Search">' + ic('search', 20) + '</button></div></div>';
  if (G.results) h += G.results.length ? '<div class="card" style="padding:4px 16px"><div class="rows">' + G.results.map((r, i) => '<button class="row" data-a="gymPick" data-i="' + i + '" style="text-align:left"><div class="grow"><div class="t">' + esc(r.name) + '</div><div class="s">' + esc(r.address || '') + '</div></div>' + (r.km != null ? '<span class="mute" style="font-size:13px;white-space:nowrap">' + (r.km < 10 ? Math.round(r.km * 10) / 10 : Math.round(r.km)) + ' km</span>' : '') + '</button>').join('') + '</div></div>' : '<p class="mute">Nothing found. Try another name.</p>';
  return h + '<p class="mute" style="font-size:12.5px">Your phone will ask for your location. Choose Always so arrivals are noticed while the app is closed. It stays on this phone.</p></div>';
}
A.gymHere = () => {
  const G = D.gy; G.busy = true; drawSheets(false);
  appNative().postMessage({ op: 'gymHere' }).then(loc => { G.busy = false; gymSet({ name: G.name || 'My gym', lat: loc.lat, lon: loc.lon }); })
    .catch(() => { G.busy = false; drawSheets(false); toast('Could not find your location. Check that Location is on for Lock In.'); });
};
A.gymSearch = () => {
  const G = D.gy, q = String(G.q || '').trim(); if (!q) return;
  appNative().postMessage({ op: 'gymSearch', q: q }).then(r => { G.results = r || []; drawSheets(false); }).catch(() => { G.results = []; drawSheets(false); });
};
A.gymPick = el => { const r = D.gy.results[+el.dataset.i]; if (r) gymSet({ name: r.name, lat: r.lat, lon: r.lon }); };
function gymSet(g) {
  S.gymLoc = { name: String(g.name).slice(0, 40), lat: g.lat, lon: g.lon, radius: 150 };
  S.me.gym = S.gymLoc.name; GYMS[S.gymLoc.name] = [g.lat, g.lon, ''];
  save(); drawSheets(false); render();
  appNative().postMessage({ op: 'gymWatch', name: S.gymLoc.name, lat: g.lat, lon: g.lon, radius: 150 }).then(st => { GYM.status = st; gymSync().then(() => drawSheets(false)); toast(st === 'always' ? S.gymLoc.name + ' set. Lock In will notice when you arrive.' : S.gymLoc.name + ' set. Choose Always in Settings so it works with the app closed.', 'check'); }).catch(() => { });
}
A.gymChange = () => { S.gymLoc = null; save(); D.gy.results = null; drawSheets(false); };
A.gymStop = () => { S.gymLoc = null; save(); appNative().postMessage({ op: 'gymStop' }).catch(() => { }); GYM.watching = false; closeAll(); render(); toast('Stopped noticing gym visits'); };
A.gymMap = () => { appNative().postMessage({ op: 'gymMap' }).catch(() => { }); };
