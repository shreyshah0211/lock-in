/* Your own data follows your Claude account.
   A page hosted on Claude can keep a private document for each signed-in person.
   In "my own streak" mode the app saves what is yours there (your streak, check-ins,
   meals, lifts, goals and photos), so it survives a cleared browser and shows up on
   every device you open it on. The sample you can look around in never leaves the
   device, and the sample friends are never saved.

   One document holds everything except photos; each photo is a document of its own.
   Two copies are combined, never swapped: check-ins, meals, lifts and progress
   photos are joined by id, so nothing logged on one device is lost to another, and
   the single-value settings come from whichever copy changed last. Only "Erase my
   data" replaces a copy outright. */
const SYNC = { db: null, doc: null, ready: false, state: 'none', remote: null, seen: '', sent: '', busy: false, again: false, wait: Promise.resolve() };
const KEEP_MEALS = 45 * DAY, KEEP_CHECKINS = 300;

// The same JSON whatever order the keys arrive in, so two equal copies always compare equal.
function canon(v) { return JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x); }
function sansRev(c) { const o = Object.assign({}, c); delete o.rev; return o; }
// What is yours, as one plain object. No clock readings, so it only changes when you change something.
function coreOf() {
  const cut = now() - KEEP_MEALS, gone = {};
  Object.keys(S.gone || {}).forEach(k => { if (S.gone[k] > now() - 60 * DAY) gone[k] = S.gone[k]; });
  return { v: 1, epoch: S.epoch || 0, me: S.me, checkins: S.checkins.slice(-KEEP_CHECKINS), meals: S.meals.filter(m => m.ts > cut), goals: S.goals, body: S.body || null, settings: S.settings, badges: S.badges, lifts: S.lifts, progress: S.progress, weekNote: S.weekNote || null, conn: S.conn, squads: S.squads, gone: gone, ui: { showKcal: S.ui.showKcal !== false, recapSeen: S.ui.recapSeen || '' } };
}
// Called on every save: notes the moment your own data last changed. Waits while the account is still being read.
function syncStamp() {
  if (S.mode !== 'real' || SYNC.state === 'connecting') return;
  const j = canon(coreOf());
  if (j !== SYNC.seen) { SYNC.seen = j; S.rev = Date.now(); }
}
function syncPush() {
  if (!SYNC.ready || S.mode !== 'real' || !SYNC.seen || SYNC.seen === SYNC.sent) return;
  if (SYNC.busy) { SYNC.again = true; return; }   // one write at a time
  const j = SYNC.seen, body = JSON.parse(j); body.rev = S.rev || Date.now();
  SYNC.busy = true;
  SYNC.doc.set(body).then(() => { SYNC.sent = j; SYNC.remote = body; syncState('on'); }, e => {
    const code = e && e.code;
    syncState(code === 'quota_exceeded' ? 'full' : 'error');
    if (code === 'unavailable') setTimeout(syncPush, 3000 + Math.random() * 2000);
  }).then(() => { SYNC.busy = false; if (SYNC.again) { SYNC.again = false; syncPush(); } });
}
function syncState(st) {
  if (SYNC.state === st) return;
  SYNC.state = st;
  if (S && typeof softRefresh === 'function') softRefresh();
}

/* ---- combining two copies ---- */
function mergeCore(a, b) {
  if ((a.epoch || 0) !== (b.epoch || 0)) return (a.epoch || 0) > (b.epoch || 0) ? a : b;   // an erase replaces everything before it
  const newer = (a.rev || 0) >= (b.rev || 0) ? a : b, older = newer === a ? b : a, gone = Object.assign({}, older.gone, newer.gone);
  const join = (x, y) => { const seen = {}, out = []; (x || []).concat(y || []).forEach(i => { if (i && !seen[i.id] && !gone[i.id]) { seen[i.id] = 1; out.push(i); } }); return out.sort((p, q) => p.ts - q.ts); };
  const lifts = {};
  [newer.lifts || {}, older.lifts || {}].forEach(L => Object.keys(L).forEach(n => { const have = lifts[n] || (lifts[n] = []); L[n].forEach(e => { if (!have.some(h => h.ts === e.ts && h.w === e.w)) have.push(e); }); }));
  Object.keys(lifts).forEach(n => lifts[n].sort((p, q) => p.ts - q.ts));
  // the streak belongs to whichever copy saw the latest check-in
  const la = (a.me && a.me.lastCheckin) || 0, lb = (b.me && b.me.lastCheckin) || 0, me = la === lb ? newer.me : la > lb ? a.me : b.me;
  return Object.assign({}, newer, { me: me, checkins: join(newer.checkins, older.checkins), meals: join(newer.meals, older.meals), progress: join(newer.progress, older.progress), lifts: lifts, badges: Object.assign({}, older.badges, newer.badges), gone: gone, epoch: a.epoch || 0, rev: Math.max(a.rev || 0, b.rev || 0) });
}
// Check-ins made here become posts in the feed. On a device that has only just received them, rebuild the recent ones.
function ensureMyPosts() {
  const m = S.me, have = {}; S.posts.forEach(p => { if (p.cid) have[p.cid] = 1; });
  S.checkins.filter(c => c.ts > now() - 4 * DAY && c.aud !== 'me' && !have[c.id]).forEach(c => {
    S.posts.push({ id: uid(), uid: 'me', ts: c.ts, type: c.type, mins: c.mins, effort: c.effort, caption: c.caption || '', scene: c.scene, photo: c.photo, gym: m.gym, day: m.streakStart && c.ts >= m.streakStart ? dayNum(c.ts) - dayNum(m.streakStart) + 1 : 1,
      rx: { fire: 0, flex: 0, clap: 0 }, mine: null, comments: [], pr: c.pr || null, verified: c.verified, cid: c.id, aud: c.aud || 'friends', proof: c.proof || 'photo', screen: !!c.screen, tag: c.tag || '', by: [] });
  });
  S.posts.sort((a, b) => b.ts - a.ts);
}
// Put a combined copy on screen. keepOlder keeps what this device holds beyond what is saved (older meals, very old check-ins).
function applyCore(c, keepOlder) {
  const real = S.mode === 'real', base = real ? S : realState(S), gone = c.gone || {}, cut = now() - KEEP_MEALS;
  const join = (x, y) => { const seen = {}, out = []; x.concat(y).forEach(i => { if (!seen[i.id] && !gone[i.id]) { seen[i.id] = 1; out.push(i); } }); return out.sort((p, q) => p.ts - q.ts); };
  const mine = real && keepOlder ? { ci: S.checkins.slice(0, -KEEP_CHECKINS), ml: S.meals.filter(m => m.ts <= cut) } : { ci: [], ml: [] };
  base.me = Object.assign({}, c.me, { id: 'me' });
  base.checkins = join(c.checkins || [], S.checkins.length > KEEP_CHECKINS ? mine.ci : []); base.meals = join(c.meals || [], mine.ml); base.progress = (c.progress || []).slice();
  ['goals', 'body', 'settings', 'badges', 'lifts', 'conn', 'squads'].forEach(k => { if (c[k]) base[k] = c[k]; });
  base.weekNote = c.weekNote || null; base.gone = gone; base.epoch = c.epoch || 0; if (c.ui) Object.assign(base.ui, c.ui);
  base.mode = 'real'; base.offset = 0; base.rev = c.rev || 0; base.ui.coach = false;
  S = base; upgradeState(); ensureMyPosts(); _dp = null; _lz = null;
  if (S.ui.tab === 'cam' && !sheets.length) S.ui.tab = 'home';
  SYNC.seen = canon(coreOf());
  tick(); refreshDetected(); save(); refresh();
}
// The account's copy has arrived (at start-up, or because another device saved). Combine, show, and send back what it lacks.
function syncMeet(remote) {
  const mine = Object.assign(coreOf(), { rev: S.rev || 0 }), theirs = canon(sansRev(remote));
  SYNC.remote = remote; SYNC.sent = theirs;
  if (theirs === canon(sansRev(mine))) { SYNC.seen = theirs; return; }
  const m = mergeCore(mine, remote);
  if (canon(sansRev(m)) !== canon(sansRev(mine))) applyCore(m, (mine.epoch || 0) === (remote.epoch || 0));
  else SYNC.seen = canon(sansRev(mine));
  if (SYNC.seen !== SYNC.sent) { S.rev = Date.now(); syncPush(); }
}

/* ---- start-up ---- */
// The account is read through one listener. Only an answer the store has confirmed counts: a copy
// cached from an earlier visit, or silence, must never be mistaken for "the account is empty".
function initSync() {
  if (S.mode === 'real') SYNC.seen = canon(coreOf());   // what was loaded counts as already stamped
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  SYNC.state = 'connecting';
  let settle; SYNC.wait = new Promise(res => { settle = res; });
  const giveUp = () => { if (!SYNC.ready) syncState('error'); settle(); };   // local only for now; nothing is sent
  (async () => {
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const id = db && user ? await user.id() : null;
      if (!id) { syncState('none'); settle(); return; }
      SYNC.db = db; SYNC.doc = db.collection('data/users/' + id).doc('core');
      setTimeout(giveUp, 10000);
      SYNC.doc.onSnapshot(s => {
        const md = s.metadata || {}; if (md.fromCache || md.hasPendingWrites) return;
        const data = s.exists ? JSON.parse(JSON.stringify(s.data())) : null;   // delivered data is frozen; the app needs its own copy
        if (!SYNC.ready) { syncFirst(data); settle(); } else if (data) syncRemote(data);
      }, () => { SYNC.ready = false; giveUp(); });
    } catch (e) { giveUp(); }
  })();
}
function syncFirst(remote) {
  SYNC.ready = true; SYNC.remote = remote && remote.me ? remote : null;
  const r = SYNC.remote;
  if (S.mode === 'real') { syncState('on'); if (r) syncMeet(r); else { syncStamp(); syncPush(); } photoFlush(); }
  else if (r && FRESH) {
    // a new or cleared browser, and the account already has your data: pick up where you left off
    SYNC.sent = canon(sansRev(r)); applyCore(r, false); closeAll(); render(); syncState('on'); toast('Welcome back. Your streak is here.', 'check');
  } else syncState(r ? 'offer' : 'idle');
}
// A change saved by another device while this one is open.
function syncRemote(c) {
  if (!c || !c.me) return;
  if (S.mode === 'real') syncMeet(c);
  else { SYNC.remote = c; if (SYNC.state === 'idle') syncState('offer'); }
}

/* ---- photos: one small document each, fetched when a screen needs one ---- */
const _photoAsked = {};
let _photoT = 0;
function photosCol() { return SYNC.doc.collection('photos'); }
function photoPush(key, dataURL) {
  if (!SYNC.ready || S.mode !== 'real' || !dataURL || dataURL.length > 240000) return;
  _photoAsked[key] = 1;
  photosCol().doc(key).set({ d: dataURL, ts: Date.now() }).then(() => { (S.sentPhotos || (S.sentPhotos = {}))[key] = 1; save(); }, e => { if (e && e.code === 'quota_exceeded') syncState('full'); });
}
// Photos taken while the account could not be reached go up once it can.
function photoFlush() {
  if (!SYNC.ready || S.mode !== 'real') return;
  const used = {}; S.checkins.concat(S.meals, S.progress).forEach(x => { if (x.photo) used[x.photo] = 1; });
  Object.keys(PHOTOS).forEach(k => { if (used[k] && !(S.sentPhotos || {})[k]) photoPush(k, PHOTOS[k]); });
}
function photoSrc(key) {
  if (PHOTOS[key]) return PHOTOS[key];
  if (SYNC.ready && S.mode === 'real' && !_photoAsked[key]) {
    _photoAsked[key] = 1;
    photosCol().doc(key).get().then(s => {
      const d = s.exists && s.data().d; if (!d) return;
      savePhoto(key, d, true);
      clearTimeout(_photoT); _photoT = setTimeout(softRefresh, 250);   // several photos arriving together redraw once
    }).catch(() => { });
  }
  return null;
}

/* ---- switching between the sample and your own data ---- */
// Start your own streak. If the account already holds your data, that is what opens: nothing is overwritten.
async function goReal() {
  if (S.mode === 'real') return;
  if (SYNC.state === 'connecting') { D.realBusy = true; if (sheets.length) drawSheets(false); await SYNC.wait; D.realBusy = false; }
  if (S.mode === 'real') return;   // the saved copy arrived while we waited
  if (SYNC.remote) { SYNC.sent = canon(sansRev(SYNC.remote)); applyCore(SYNC.remote, false); syncState('on'); toast('Welcome back. Your streak is here.', 'check'); return; }
  S = realState(S); upgradeState(); _dp = null; _lz = null; S.ui.tab = 'home';
  if (SYNC.ready) syncState('on');
  refreshDetected(); save(); render();
}
A.syncOpen = () => { goReal(); };
A.syncStay = () => { S.ui.pinSample = true; save(); render(); };
A.goReal = async () => { await goReal(); closeAll(); S.ui.tab = 'home'; scrollPos.home = 0; render(); if (!S.checkins.length) toast('Your own streak starts with your first gym photo', 'camera'); };
A.goSample = () => {
  S = seedState(); upgradeState(); _dp = null; _lz = null; S.ui.coach = false; S.ui.pinSample = true;
  if (SYNC.ready) SYNC.state = SYNC.remote ? 'offer' : 'idle';
  closeAll(); S.ui.tab = 'home'; scrollPos.home = 0; refreshDetected(); save(); render(); toast('Sample data loaded. Your own data is untouched.', 'check');
};
// Erasing takes two taps, because it cannot be undone.
A.eraseMine = () => {
  if (!D.eraseArmed) { D.eraseArmed = true; drawSheets(false); setTimeout(() => { if (D.eraseArmed) { D.eraseArmed = false; if (sheets.length) drawSheets(false); } }, 5000); return; }
  D.eraseArmed = false; PHOTOS = {}; try { localStorage.removeItem(PKEY); } catch (e) { }
  S = realState(S); upgradeState(); S.epoch = Date.now(); _dp = null; _lz = null;
  closeAll(); S.ui.tab = 'home'; scrollPos.home = 0; refreshDetected(); save(); render(); toast('Your data was erased. Starting from zero.', 'check');
};
// Home, on a device still showing the sample when the account already has your own data.
function syncOfferCard() {
  if (S.mode === 'real' || SYNC.state !== 'offer' || S.ui.pinSample) return '';
  const r = SYNC.remote, n = r && r.checkins ? r.checkins.length : 0;
  return '<section class="detect"><div class="dt-h"><span class="dt-ic">' + ic('user', 20) + '</span><div><b>Your own streak is saved to your account</b><span>' + (n ? plural(n, 'check-in') + ' so far. ' : '') + 'This device is showing the sample.</span></div></div>' +
    '<div class="dt-a"><button class="btn btn-ink" data-a="syncOpen">Open my own</button><button class="btn btn-soft" data-a="syncStay">Stay on the sample</button></div></section>';
}
// Settings: whose data this is and where it is kept, in plain words.
function dataCard() {
  const real = S.mode === 'real', st = SYNC.state;
  const where = !real ? 'Sample data, for looking around. Nothing here is saved to your account.'
    : st === 'on' ? 'Saved to your Claude account. It follows you to any device and survives a cleared browser.'
      : st === 'connecting' ? 'Connecting to your Claude account.'
        : st === 'full' ? 'Your account storage for this page is full, so new photos stay on this device only.'
          : st === 'error' ? 'Your account could not be reached just now, so changes are on this device until it can.'
            : 'Saved on this device only. Open Lock In inside Claude while signed in and it saves to your account.';
  return '<div class="card"><h3 class="h2" style="margin-bottom:4px">' + (real ? 'Your own data' : 'Sample data') + '</h3><p class="mute" style="font-size:13.5px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start">' + ic(real && st === 'on' ? 'check' : 'info', 16) + '<span>' + where + '</span></p><div style="display:flex;gap:8px;flex-wrap:wrap">' +
    (real ? '<button class="btn btn-white btn-s" data-a="goSample">Look at the sample</button><button class="btn btn-white btn-s" data-a="eraseMine"' + (D.eraseArmed ? ' style="background:#FCE3E0;color:#A61D11"' : '') + '>' + (D.eraseArmed ? 'Tap again to erase everything' : 'Erase my data') + '</button>'
      : '<button class="btn btn-ink btn-s" data-a="goReal">' + (SYNC.remote ? 'Open my own streak' : 'Start my own streak') + '</button>') + '</div></div>';
}
