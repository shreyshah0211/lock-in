/* Accounts. Lock In opens signed out. You type your email, get a 6-digit code, type it
   in, pick a name and a username, and you are in. Your streak, check-ins, meals and
   photos are saved to your account, and friends are real people who also signed up.

   The server is a Supabase project (see supabase/schema.sql and docs/accounts-setup.md).
   Its address and public key come from backend.json at build time; neither is a secret,
   every copy of the app carries them, and the database only lets a signed-in person
   read and change what the rules in schema.sql allow.

   Opened with ?sample=1 the app shows made-up data instead, for testing only. */
const BACKEND = /*BACKEND*/null;
const SKEY = 'lockin.session.v1', LKEY = 'lockin.local.v1';
const ACCT = { s: null, busy: false, pulled: 0, profile: '', find: null, findQ: '', findT: 0, sent: {} };
const acctReady = () => !!(BACKEND && BACKEND.url && BACKEND.key);
const acctOn = () => !DEMO && !!ACCT.s;
function acctLoad() {
  try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (s && s.refresh && s.uid) ACCT.s = s; } catch (e) { }
}
function acctKeep() { try { if (ACCT.s) localStorage.setItem(SKEY, JSON.stringify(ACCT.s)); else localStorage.removeItem(SKEY); } catch (e) { } }

/* ---- talking to the server ---- */
function acctErr(code, msg) { const e = new Error(msg || code); e.code = code; return e; }
async function acctCall(path, opts) {
  opts = opts || {};
  if (!acctReady()) throw acctErr('no_server');
  if (opts.auth !== false && ACCT.s && ACCT.s.exp < Date.now() + 60000) await acctRefresh();
  const h = { apikey: BACKEND.key, Authorization: 'Bearer ' + (opts.auth !== false && ACCT.s ? ACCT.s.token : BACKEND.key) };
  if (opts.body !== undefined) h['Content-Type'] = 'application/json';
  if (opts.prefer) h.Prefer = opts.prefer;
  let res;
  try { res = await fetch(BACKEND.url.replace(/\/+$/, '') + path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers: h, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }); }
  catch (e) { throw acctErr('unavailable'); }
  const txt = await res.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { }
  if (res.status === 401 && opts.auth !== false && ACCT.s && !opts.again) { await acctRefresh(true); return acctCall(path, Object.assign({}, opts, { again: true })); }
  if (!res.ok) throw acctErr((data && (data.error_code || data.code || data.error)) || 'http_' + res.status, (data && (data.msg || data.message || data.error_description)) || '');
  return data;
}
let _refreshing = null;
function acctRefresh(force) {
  if (_refreshing) return _refreshing;
  const s = ACCT.s; if (!s) return Promise.reject(acctErr('signed_out'));
  _refreshing = acctCall('/auth/v1/token?grant_type=refresh_token', { auth: false, body: { refresh_token: s.refresh } })
    .then(d => { acctSession(d); }, e => { if (e.code !== 'unavailable') acctSignedOut('Please sign in again.'); throw e; })
    .finally(() => { _refreshing = null; });
  return _refreshing;
}
function acctSession(d) {
  ACCT.s = { token: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000, uid: d.user ? d.user.id : ACCT.s.uid, email: d.user ? d.user.email : ACCT.s.email };
  acctKeep();
}
const qs = o => Object.keys(o).map(k => k + '=' + encodeURIComponent(o[k])).join('&');

/* ---- the screens before you are in ---- */
// What stands between you and the app: 'email', 'code', 'profile', or '' when you are in.
function acctStep() {
  if (DEMO) return '';
  if (!ACCT.s) { try { if (!acctReady() && localStorage.getItem(LKEY)) return ''; } catch (e) { } return D.gate && D.gate.step === 'code' ? 'code' : 'email'; }
  return S.me.handle && S.me.name ? '' : 'profile';
}
function acctGate() {
  const step = acctStep(), ph = $('#phone'); ph.classList.toggle('gate', !!step);
  if (!step) return false;
  ph.classList.remove('dark-top', 'cam-on', 'past'); setTimeout(chromeSync, 0);
  const G = D.gate || (D.gate = { step: 'email', email: '', code: '', name: '', handle: '', err: '', busy: false });
  const err = G.err ? '<p class="gate-err">' + ic('info', 16) + '<span>' + esc(G.err) + '</span></p>' : '';
  const btn = (a, label) => '<button class="btn btn-go btn-w" data-a="' + a + '"' + (G.busy ? ' disabled' : '') + '>' + (G.busy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>' : '') + label + '</button>';
  let h = '<div class="gate"><div class="gate-top">' + wordmark() + '</div><div class="gate-body">';
  if (step === 'email') {
    h += '<h1>One gym photo.<br>48 hours on the clock.</h1><p class="gate-sub">Sign in or join with your email. We send you a 6-digit code; there is no password.</p>' +
      '<input class="input gate-in" id="gate-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com" data-m="gate.email" data-enter="gateSend" value="' + esc(G.email) + '">' + err +
      (acctReady() ? btn('gateSend', 'Send my code') : '<p class="gate-err">' + ic('info', 16) + '<span>This copy of Lock In is not connected to its server yet, so codes cannot be sent.</span></p><button class="btn btn-go btn-w" data-a="gateLocal">Use it on this phone only</button>') +
      '<p class="gate-fine">Your email is used to sign you in and nothing else.</p>';
  } else if (step === 'code') {
    h += '<h1>Check your email</h1><p class="gate-sub">We sent a 6-digit code to <b>' + esc(G.email) + '</b>.</p>' +
      '<input class="input gate-in gate-code" id="gate-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" data-m="gate.code" data-on="gateCodeLive" data-enter="gateVerify" value="' + esc(G.code) + '">' + err + btn('gateVerify', 'Sign in') +
      '<div class="gate-links"><button class="link" data-a="gateSend">Send a new code</button><button class="link" data-a="gateBack">Use another email</button></div>';
  } else {
    h += '<h1>Who are you?</h1><p class="gate-sub">Friends find you by your username.</p>' +
      '<div class="field"><label for="gate-name">Name</label><input class="input gate-in" id="gate-name" autocomplete="given-name" maxlength="28" placeholder="Your first name" data-m="gate.name" value="' + esc(G.name) + '"></div>' +
      '<div class="field"><label for="gate-handle">Username</label><input class="input gate-in" id="gate-handle" autocomplete="off" autocapitalize="off" maxlength="20" placeholder="letters, numbers, _" data-m="gate.handle" data-enter="gateProfile" value="' + esc(G.handle) + '"></div>' + err + btn('gateProfile', 'Start') +
      '<div class="gate-links"><button class="link" data-a="acctSignOut">Sign out</button></div>';
  }
  const v = $('#view'); v.innerHTML = h + '</div></div>'; v.scrollTop = 0; curTab = null;
  $('#tabs').innerHTML = ''; const sd = $('#side'); if (sd) sd.innerHTML = '';
  if (!G.busy && !G.focused) { G.focused = step; const i = v.querySelector('.gate-in'); if (i) setTimeout(() => { try { i.focus(); } catch (e) { } }, 50); }
  return true;
}
function gateSet(o) { Object.assign(D.gate, o); if (o.step) D.gate.focused = ''; render(); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
A.gateSend = async () => {
  const G = D.gate; if (!G || G.busy) return;
  const email = String(G.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { gateSet({ err: 'That does not look like an email address.' }); return; }
  gateSet({ email: email, err: '', busy: true });
  try { await acctCall('/auth/v1/otp', { auth: false, body: { email: email, create_user: true } }); gateSet({ busy: false, step: 'code', code: '' }); }
  catch (e) { gateSet({ busy: false, err: e.code === 'unavailable' ? 'No connection. Check your internet and try again.' : /rate|429/.test(e.code) ? 'Too many codes asked for. Wait a minute and try again.' : 'Could not send the code. Try again in a moment.' }); }
};
A.gateCodeLive = el => { const v = el.value.replace(/\D/g, '').slice(0, 6); if (v !== el.value) el.value = v; D.gate.code = v; if (v.length === 6) A.gateVerify(); };
A.gateVerify = async () => {
  const G = D.gate; if (!G || G.busy) return;
  const code = String(G.code || '').replace(/\D/g, ''); if (code.length !== 6) { gateSet({ err: 'Type the 6 digits from the email.' }); return; }
  gateSet({ err: '', busy: true });
  try {
    const d = await acctCall('/auth/v1/verify', { auth: false, body: { type: 'email', email: G.email, token: code } });
    acctSession(d); G.busy = false; G.err = ''; G.step = 'profile'; G.focused = '';
    await acctEnter();
  } catch (e) { gateSet({ busy: false, code: '', err: e.code === 'unavailable' ? 'No connection. Check your internet and try again.' : 'That code is wrong or has expired. Check it, or send a new one.' }); }
};
A.gateBack = () => gateSet({ step: 'email', code: '', err: '' });
A.gateLocal = () => { try { localStorage.setItem(LKEY, '1'); } catch (e) { } D.gate = null; render(); };
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
A.gateProfile = async () => {
  const G = D.gate; if (!G || G.busy) return;
  const name = String(G.name || '').trim().slice(0, 28), handle = String(G.handle || '').trim().replace(/^@/, '').toLowerCase();
  if (!name) { gateSet({ err: 'Add your name.' }); return; }
  if (!HANDLE_RE.test(handle)) { gateSet({ err: 'A username is 3 to 20 letters, numbers or underscores.' }); return; }
  gateSet({ err: '', busy: true, name: name, handle: handle });
  try {
    await acctCall('/rest/v1/profiles?on_conflict=id', { prefer: 'resolution=merge-duplicates,return=minimal', body: acctProfileRow(name, handle) });
    S.me.name = name; S.me.handle = handle; ACCT.profile = ''; D.gate = null; save(); render(); acctPull();
    toast('You are in. Your streak starts with your first gym photo.', 'check');
  } catch (e) { gateSet({ busy: false, err: e.code === '23505' ? 'That username is taken. Try another.' : e.code === 'unavailable' ? 'No connection. Check your internet and try again.' : 'Could not save that. Try again.' }); }
};

/* ---- signing in, out, and leaving ---- */
// Just signed in, or the app opened already signed in: load the profile, then the saved data, then friends.
async function acctEnter() {
  try {
    const rows = await acctCall('/rest/v1/profiles?' + qs({ id: 'eq.' + ACCT.s.uid, select: '*' }));
    const p = rows && rows[0];
    if (p) { S.me.name = p.name || S.me.name; S.me.handle = p.username; if (p.color) S.me.color = p.color; if (D.gate) D.gate = null; }
  } catch (e) { if (e.code === 'signed_out') return; }
  render();
  acctSyncStart(); acctPull();
}
function acctWipe() {
  ACCT.s = null; ACCT.profile = ''; ACCT.pulled = 0; ACCT.sent = {}; acctKeep();
  SYNC.doc = null; SYNC.ready = false; SYNC.remote = null; SYNC.seen = ''; SYNC.sent = ''; SYNC.state = 'none';
  try { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); } catch (e) { }
  PHOTOS = {}; S = emptyState(); upgradeState(); _dp = null; _lz = null;
}
function acctSignedOut(msg) { acctWipe(); closeAll(); D.gate = { step: 'email', email: '', code: '', name: '', handle: '', err: msg || '', busy: false }; render(); }
A.acctSignOut = async () => {
  try { if (ACCT.s) await acctCall('/auth/v1/logout', { method: 'POST', body: {} }); } catch (e) { }
  acctSignedOut('');
};
// Deleting takes two taps. It removes the account and everything saved with it, for good.
A.acctDelete = async () => {
  if (!D.delArmed) { D.delArmed = true; drawSheets(false); setTimeout(() => { if (D.delArmed) { D.delArmed = false; if (sheets.length) drawSheets(false); } }, 6000); return; }
  D.delArmed = false;
  try { await acctCall('/rest/v1/rpc/delete_me', { body: {} }); acctSignedOut('Your account and everything in it were deleted.'); }
  catch (e) { toast(e.code === 'unavailable' ? 'No connection. Your account was not deleted.' : 'Could not delete the account just now. Try again.'); drawSheets(false); }
};
function acctDataCard() {
  const st = SYNC.state, where = st === 'on' ? 'Saved to your account. It follows you to any phone you sign in on.' : st === 'connecting' ? 'Connecting to your account.' : 'Your account could not be reached just now, so changes stay on this phone until it can.';
  return '<div class="card"><h3 class="h2" style="margin-bottom:4px">Your account</h3><p class="mute" style="font-size:13.5px;margin-bottom:4px">' + esc(ACCT.s.email || '') + '</p><p class="mute" style="font-size:13.5px;margin-bottom:12px">' + where + '</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-white btn-s" data-a="acctSignOut">Sign out</button><button class="btn btn-white btn-s" data-a="acctDelete"' + (D.delArmed ? ' style="background:#FCE3E0;color:#A61D11"' : '') + '>' + (D.delArmed ? 'Tap again to delete everything' : 'Delete my account') + '</button></div></div>';
}

/* ---- your own data, saved to your account ----
   The same saving the app already does, pointed at one row per person on the server.
   Photos are a row each. It reads again whenever the app comes back to the front. */
function acctDoc() {
  const uid0 = () => ACCT.s.uid;
  return {
    set: body => acctCall('/rest/v1/user_state?on_conflict=user_id', { prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: uid0(), data: body, updated_at: new Date().toISOString() } }),
    read: () => acctCall('/rest/v1/user_state?' + qs({ user_id: 'eq.' + uid0(), select: 'data' })).then(r => (r && r[0] && r[0].data) || null),
    collection: () => ({ doc: key => ({
      set: v => acctCall('/rest/v1/user_photos?on_conflict=user_id,key', { prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: uid0(), key: key, data: v.d } }),
      get: () => acctCall('/rest/v1/user_photos?' + qs({ user_id: 'eq.' + uid0(), key: 'eq.' + key, select: 'data' })).then(r => ({ exists: !!(r && r[0]), data: () => ({ d: r[0].data }) }))
    }) })
  };
}
function acctSyncStart() {
  if (!acctOn()) return false;
  SYNC.doc = acctDoc(); SYNC.ready = false; SYNC.state = 'connecting';
  SYNC.wait = SYNC.doc.read().then(data => { if (acctOn()) syncFirst(data); }, () => { syncState('error'); setTimeout(() => { if (acctOn() && !SYNC.ready) acctSyncStart(); }, 8000); });
  return true;
}
function acctSyncAgain() { if (acctOn() && SYNC.ready && SYNC.doc) SYNC.doc.read().then(d => { if (d && acctOn()) syncRemote(d); }, () => { }); }

/* ---- what friends see of you: your profile row and your check-in photos ---- */
function acctProfileRow(name, handle) {
  const m = S.me;
  return { id: ACCT.s.uid, username: handle || m.handle, name: name || m.name, color: m.color || '#141A33', campus: m.campus || '', gym: m.gym || '', bio: m.bio || '',
    last_checkin: Math.round(m.lastCheckin || 0), streak_start: m.streakStart ? Math.round(m.streakStart) : null, best: Math.max(m.best || 0, pDays(m)), total: S.checkins.length, lost: m.lost || null, updated_at: new Date().toISOString() };
}
// Runs after every save: sends the profile when it changed, and any check-in friends have not been sent yet.
function acctAfterSave() {
  if (!acctOn() || acctStep()) return;
  const row = acctProfileRow(), key = JSON.stringify(Object.assign({}, row, { updated_at: 0 }));
  if (key !== ACCT.profile) {
    const was = ACCT.profile; ACCT.profile = key;
    acctCall('/rest/v1/profiles?on_conflict=id', { prefer: 'resolution=merge-duplicates,return=minimal', body: row }).catch(e => { ACCT.profile = was; if (e.code === '23505') { toast('That username is taken. Yours was not changed.'); } });
  }
  S.posts.filter(p => p.uid === 'me' && p.aud !== 'me' && !p.up && !ACCT.sent[p.id] && p.ts > now() - 4 * DAY).forEach(p => {
    ACCT.sent[p.id] = 1;
    const ph = p.photo && PHOTOS[p.photo];
    acctCall('/rest/v1/posts?on_conflict=id', { prefer: 'resolution=merge-duplicates,return=minimal', body: { id: p.id, user_id: ACCT.s.uid, ts: Math.round(p.ts), type: p.type, mins: p.mins || 0, effort: p.effort || 0, caption: String(p.caption || '').slice(0, 300), day: p.day || 1, photo: ph && ph.length <= 400000 ? ph : null, scene: p.scene || null, pr: p.pr || null, verified: p.verified === true } })
      .then(() => { p.up = true; save(); }, () => { delete ACCT.sent[p.id]; });
  });
}

/* ---- friends: real people ---- */
function acctPerson(p) {
  return { id: p.id, real: true, name: p.name || p.username, handle: p.username, color: p.color || '#5B6388', campus: p.campus || '', gym: p.gym || '', bio: p.bio || '', streakStart: p.streak_start || null, lastCheckin: p.last_checkin || 0,
    total: p.total || 0, best: p.best || 0, lost: p.lost || null, rel: .5, weekPts: 0, types: ['full'], fol: true, days: {} };
}
// Friends, requests waiting on you, and the last few days of check-ins. Asked for at start-up, when the app returns, and every minute or so.
async function acctPull() {
  if (!acctOn() || acctStep() || ACCT.busy) return;
  ACCT.busy = true;
  try {
    const me = ACCT.s.uid;
    const [out, inc, posts] = await Promise.all([
      acctCall('/rest/v1/follows?' + qs({ follower: 'eq.' + me, select: 'status,p:profiles!follows_followee_fkey(*)' })),
      acctCall('/rest/v1/follows?' + qs({ followee: 'eq.' + me, status: 'eq.pending', select: 'p:profiles!follows_follower_fkey(*)' })),
      acctCall('/rest/v1/posts?' + qs({ ts: 'gt.' + Math.round(now() - 35 * DAY), select: 'id,user_id,ts,type,mins,effort,caption,day,scene,pr,verified', order: 'ts.desc', limit: 400 }))
    ]);
    if (!acctOn()) return;
    const was = JSON.stringify([S.friends.map(f => [f.id, f.lastCheckin, f.fol, f.name]), S.requests.map(r => r.id), S.posts.length]);
    const old = {}; S.friends.forEach(f => { old[f.id] = f; });
    ACCT.pending = {}; (out || []).forEach(r => { if (r.p && r.status === 'pending') ACCT.pending[r.p.id] = 1; });
    S.friends = (out || []).filter(r => r.p && r.status === 'ok').map(r => Object.assign(acctPerson(r.p), { nudged: old[r.p.id] && old[r.p.id].nudged }));
    S.requests = (inc || []).filter(r => r.p).map(r => ({ id: r.p.id, name: r.p.name || r.p.username, color: r.p.color || '#5B6388', note: '@' + r.p.username }));
    const by = {}; S.friends.forEach(f => { by[f.id] = f; });
    const mine = S.posts.filter(p => p.uid === 'me'), theirs = [];
    (posts || []).forEach(p => {
      const f = by[p.user_id]; if (!f) return;
      f.days[dayNum(p.ts)] = clamp(p.effort || 2, 1, 4);
      if (p.ts > now() - 4 * DAY) theirs.push({ id: p.id, uid: p.user_id, ts: p.ts, type: TYPE[p.type] ? p.type : 'full', mins: p.mins, effort: p.effort, caption: p.caption || '', scene: p.scene && p.scene.kind ? p.scene : sceneFor('full', hash(p.id) % 1000), photo: 'r:' + p.id,
        gym: f.gym, day: p.day || 1, rx: { fire: 0, flex: 0, clap: 0 }, mine: null, comments: [], pr: p.pr || null, verified: p.verified, aud: 'friends', proof: 'photo', by: [] });
    });
    S.posts = mine.concat(theirs).sort((a, b) => b.ts - a.ts);
    ACCT.pulled = Date.now();
    if (JSON.stringify([S.friends.map(f => [f.id, f.lastCheckin, f.fol, f.name]), S.requests.map(r => r.id), S.posts.length]) !== was) { save(); softRefresh(); }
  } catch (e) { } finally { ACCT.busy = false; }
}
// A friend's check-in photo, fetched the first time a screen shows it.
const _postAsked = {};
function acctPostPhoto(key) {
  if (PHOTOS[key]) return PHOTOS[key];
  if (!acctOn() || _postAsked[key]) return null;
  _postAsked[key] = 1;
  acctCall('/rest/v1/posts?' + qs({ id: 'eq.' + key.slice(2), select: 'photo' })).then(r => { const d = r && r[0] && r[0].photo; if (!d || !/^data:image\//.test(d)) return; PHOTOS[key] = d; clearTimeout(_photoT); _photoT = setTimeout(softRefresh, 250); }).catch(() => { delete _postAsked[key]; });
  return null;
}
// Finding people by username.
function acctFindHTML() {
  const q = (D.frq || '').trim().replace(/^@/, '').toLowerCase();
  if (q.length < 2) return '<p class="empty">Search for a friend by their username.</p>';
  if (ACCT.findQ !== q || !ACCT.find) return '<p class="empty"><span class="spin"></span></p>';
  if (!ACCT.find.length) return '<p class="empty">Nobody has the username "' + esc(q) + '".</p>';
  return '<div class="rows">' + ACCT.find.map(p => {
    const f = S.friends.find(x => x.id === p.id), pend = (ACCT.pending || {})[p.id];
    return '<div class="row">' + avPlain(p.name || p.username, p.color || '#5B6388', 48) + '<div class="grow"><div class="t">' + esc(p.name || p.username) + '</div><div class="s">@' + esc(p.username) + (p.gym ? ', ' + esc(p.gym) : '') + '</div></div>' +
      (f ? '<span class="pill">Friends</span>' : pend ? '<span class="pill">Requested</span>' : '<button class="btn btn-ink btn-s" data-a="follow" data-id="' + p.id + '">Add</button>') + '</div>';
  }).join('') + '</div>';
}
function acctFind() {
  const q = (D.frq || '').trim().replace(/^@/, '').toLowerCase(); if (q.length < 2 || q === ACCT.findQ) return;
  clearTimeout(ACCT.findT);
  ACCT.findT = setTimeout(() => {
    ACCT.findQ = q; ACCT.find = null;
    acctCall('/rest/v1/profiles?' + qs({ username: 'ilike.' + q.replace(/[%_*\\]/g, '') + '*', id: 'neq.' + ACCT.s.uid, select: 'id,username,name,color,gym', limit: 12 }))
      .then(r => { if (ACCT.findQ === q) { ACCT.find = r || []; A.frSearch(); } }, () => { if (ACCT.findQ === q) { ACCT.find = []; A.frSearch(); } });
  }, 300);
}
// The Friends sheet's actions, pointed at real people when signed in.
(() => {
  const follow = A.follow, unfollow = A.unfollow, yes = A.reqYes, no = A.reqNo, search = A.frSearch;
  A.frSearch = () => { if (acctOn() && S.ui.frSeg === 'find') acctFind(); search(); };
  A.follow = el => {
    if (!acctOn()) return follow(el);
    const id = el.dataset.id; (ACCT.pending || (ACCT.pending = {}))[id] = 1; A.frSearch(); drawSheets(false);
    acctCall('/rest/v1/follows', { prefer: 'return=minimal', body: { follower: ACCT.s.uid, followee: id } }).then(() => toast('Request sent', 'check'), e => { if (e.code !== '23505') { delete ACCT.pending[id]; drawSheets(false); toast('Could not send the request. Try again.'); } });
  };
  A.unfollow = el => {
    if (!acctOn()) return unfollow(el);
    const id = el.dataset.id, me = ACCT.s.uid; S.friends = S.friends.filter(f => f.id !== id); S.posts = S.posts.filter(p => p.uid !== id); closeAll(); save(); render();
    Promise.all([acctCall('/rest/v1/follows?' + qs({ follower: 'eq.' + me, followee: 'eq.' + id }), { method: 'DELETE' }), acctCall('/rest/v1/follows?' + qs({ follower: 'eq.' + id, followee: 'eq.' + me }), { method: 'DELETE' })]).then(() => toast('Removed from your friends'), () => acctPull());
  };
  A.reqYes = el => {
    if (!acctOn()) return yes(el);
    const id = el.dataset.id; S.requests = S.requests.filter(r => r.id !== id); drawSheets(false);
    acctCall('/rest/v1/rpc/accept_follow', { body: { from_id: id } }).then(() => { toast('You are friends now', 'check'); acctPull(); }, () => { toast('Could not accept just now. Try again.'); acctPull(); });
  };
  A.reqNo = el => {
    if (!acctOn()) return no(el);
    const id = el.dataset.id; S.requests = S.requests.filter(r => r.id !== id); drawSheets(false);
    acctCall('/rest/v1/follows?' + qs({ follower: 'eq.' + id, followee: 'eq.' + ACCT.s.uid }), { method: 'DELETE' }).catch(() => acctPull());
  };
})();

/* ---- start-up ---- */
function acctBoot() {
  if (DEMO) return;
  acctLoad();
  if (ACCT.s) acctEnter();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && acctOn()) { acctSyncAgain(); acctPull(); } });
  setInterval(() => { if (!document.hidden && acctOn() && Date.now() - ACCT.pulled > 60000) acctPull(); }, 15000);
}
