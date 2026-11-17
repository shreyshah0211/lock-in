const KEY = 'lockin.v5', PKEY = 'lockin.photos.v4';
let PHOTOS = {};   // photo key -> data URL (photos the person took)
let MEM = false;   // true when browser storage is unavailable
let FRESH = false; // true when this page load found nothing saved in the browser

function pointsFor(c) {
  return Math.round(8 + Math.min(c.mins, 120) * 0.25 + c.effort * 6 + Math.min(c.nl || 0, 6) * 2 + (c.pr ? 6 : 0));
}
function level(pts) { return !pts ? 0 : pts < 30 ? 1 : pts < 42 ? 2 : pts < 54 ? 3 : 4; }

function mkCheckin(o) {
  return { id: uid(), ts: o.ts, type: o.type, mins: o.mins, effort: o.effort, nl: o.nl || 0, pts: pointsFor(o), scene: sceneFor(o.type, o.seed || Math.floor(Math.random() * 1e6)), photo: o.photo || null, caption: o.caption || '', verified: o.verified === undefined ? true : o.verified, pr: o.pr || null, lifts: o.lifts || null };
}
function seedCheckins(t, r) {
  const today = dayNum(t), lastTs = t - 16.8 * HOUR, lastDay = dayNum(lastTs), out = [];
  const rot = ['push', 'pull', 'legs', 'cardio', 'upper', 'legs', 'full', 'core'];
  let ri = 0, prev = false, gap = 0;
  for (let d = today - 330; d <= lastDay; d++) {
    let on;
    if (d === lastDay) on = true;
    else if (d >= today - 22) on = d === today - 22 || !prev || r() < .64;
    else if (d >= today - 26) on = false;
    else if (d >= today - 104 && d <= today - 64) on = !prev || r() < .74;
    else if (gap > 0) { on = false; gap--; }
    else { on = r() < .5; if (r() < .05) gap = 3 + Math.floor(r() * 4); }
    prev = on;
    if (!on) continue;
    const hr = r() < .1 ? between(r, 7.2, 9) : r() < .22 ? between(r, 20.5, 21.8) : between(r, 15.5, 19.8);
    const type = rot[ri++ % rot.length], effort = r() < .15 ? 1 : r() < .5 ? 2 : r() < .88 ? 3 : 4;
    out.push(mkCheckin({ ts: d === lastDay ? lastTs : dayStart(d) + hr * HOUR, type: type, mins: Math.round(between(r, 32, 82) / 2) * 2, effort: effort, nl: (type === 'cardio' || type === 'core') ? 0 : 2 + Math.floor(r() * 4), seed: Math.floor(r() * 1e6) }));
  }
  return out;
}
function mkPost(f, ts, r, extra) {
  const type = pick(r, f.types);
  const others = FRIEND_SEED.filter(x => x[0] !== f.id);
  const nc = r() < .35 ? 0 : 1 + Math.floor(r() * 3), comments = [];
  for (let i = 0; i < nc; i++) comments.push({ uid: pick(r, others)[0], text: pick(r, COMMENTS), ts: ts + (10 + r() * 90) * MIN });
  return Object.assign({
    id: uid(), uid: f.id, ts: ts, type: type, mins: Math.round(between(r, 28, 86)), effort: 1 + Math.floor(r() * 4),
    caption: pick(r, CAPTIONS[type]), scene: sceneFor(type, Math.floor(r() * 1e6)), photo: null, gym: f.gym,
    day: f.streakStart && ts >= f.streakStart ? dayNum(ts) - dayNum(f.streakStart) + 1 : 1,
    rx: { fire: Math.floor(r() * 26) + 2, flex: Math.floor(r() * 12), clap: Math.floor(r() * 8) }, mine: null, comments: comments, pr: null, verified: true
  }, extra || {});
}
function seedMeals(t, r) {
  const out = [], fd = foodDay(t);
  const HIT_A = ['Eggs and toast', 'Tofu stir-fry with rice', 'Protein shake', 'Veggie burrito bowl', 'Protein bar'];
  const HIT_B = ['Greek yogurt and granola', 'Falafel wrap', 'Protein shake', 'Tofu stir-fry with rice', 'Protein bar'];
  const MISS = ['Oatmeal with berries', 'Big salad with feta', 'Banana', 'Pasta with tomato sauce'];
  const hours = [8.4, 12.8, 16.2, 19.6, 21.7], slots = ['breakfast', 'lunch', 'snack', 'dinner', 'snack'];
  for (let d = fd - 7; d <= fd; d++) {
    const tpl = d >= fd - 4 ? ((fd - d) % 2 ? HIT_B : HIT_A) : MISS;
    tpl.forEach((name, i) => {
      const ts = dayStart(d) + (hours[i] + between(r, -.3, .3)) * HOUR;
      if (ts > t) return;
      const f = FOOD_DB.find(x => x.name === name);
      out.push({ id: uid(), ts: ts, name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, slot: slots[i], art: { kind: f.kind, seed: Math.floor(r() * 1e5) }, photo: null, src: 'seed' });
    });
  }
  return out;
}
function seedState() {
  const t = Date.now(), r = rng(90210), today = dayNum(t);
  const mkPerson = (a, fol) => {
    const f = { id: a[0], name: a[1], color: a[2], campus: a[3], gym: a[4], streakStart: a[5] > 0 ? dayStart(today - (a[5] - 1)) + 30 * MIN : null, lastCheckin: t - a[6] * HOUR, total: a[7], best: a[8], rel: a[9], types: a[10], duo: a[11], bio: a[12], weekPts: WEEK_PTS[a[0]] !== undefined ? WEEK_PTS[a[0]] : 90 + hash(a[0]) % 200, nudged: 0, fol: fol, note: a[13] || '' };
    if (f.streakStart && f.streakStart > f.lastCheckin) f.streakStart = f.lastCheckin;
    f.nextAt = Math.max(f.lastCheckin + between(r, 15, 43) * HOUR, t + between(r, .6, 7) * HOUR);
    if (f.nextAt > f.lastCheckin + WINDOW - 20 * MIN && f.rel > .6) f.nextAt = f.lastCheckin + WINDOW - between(r, 25, 120) * MIN;
    return f;
  };
  const friends = FRIEND_SEED.map(a => mkPerson(a, true)).concat(PEOPLE_SEED.map(a =>
    mkPerson([a[0], a[1], a[2], a[3], a[4], a[5], 3 + hash(a[0]) % 30, Math.round(a[5] * 2.3) + 6, a[5], .88, [['push', 'pull', 'legs'], ['cardio', 'core', 'full'], ['legs', 'upper', 'sport']][hash(a[0]) % 3], 0, a[6], a[6]], false)));
  const by = id => friends.find(f => f.id === id);
  by('arjun').nextAt = t + 1.5 * HOUR; by('lucas').nextAt = t + 19 * HOUR; by('lucas').lost = { days: 12, at: t - 22 * HOUR };
  by('sofia').nextAt = t + 30 * HOUR; by('hana').nextAt = t + 27 * HOUR;

  const posts = [];
  friends.forEach(f => {
    if (!f.streakStart || !f.fol) return;
    posts.push(mkPost(f, f.lastCheckin, r, f.id === 'maya' ? { type: 'legs', caption: 'Squats before sunrise. 225 moved like it was nothing.', scene: { kind: 'rack', seed: 14 }, pr: { lift: 'Squat', w: 225 } } : null));
    if (['maya', 'leo', 'kenji', 'amara', 'omar', 'priya'].includes(f.id)) posts.push(mkPost(f, f.lastCheckin - between(r, 21, 40) * HOUR, r));
  });
  const checkins = seedCheckins(t, r), last = checkins[checkins.length - 1];
  last.type = 'legs'; last.scene = sceneFor('legs', 77); last.caption = 'Leg day done. The elevator is my friend now.';
  posts.push({ id: uid(), uid: 'me', ts: last.ts, type: last.type, mins: last.mins, effort: last.effort, caption: last.caption, scene: last.scene, photo: null, gym: 'IMA', day: dayNum(last.ts) - (today - 22) + 1, rx: { fire: 14, flex: 6, clap: 2 }, mine: null, comments: [{ uid: 'maya', text: 'Twenty-three days. Keep it going.', ts: last.ts + 22 * MIN }, { uid: 'leo', text: 'Save me a rack Thursday?', ts: last.ts + 50 * MIN }], pr: null, verified: true, cid: last.id });
  posts.sort((a, b) => b.ts - a.ts);

  const lifts = {};
  Object.keys(LIFT_SEED).forEach(name => {
    const [a, b] = LIFT_SEED[name], n = 11, arr = [];
    for (let i = 0; i < n; i++) { const p = i / (n - 1); arr.push({ ts: t - (150 - p * 146) * DAY, w: Math.round((a + (b - a) * (p * .85 + .15 * Math.sqrt(p)) + between(r, -4, 4)) / 5) * 5, reps: 5 }); }
    arr[n - 1].w = b; lifts[name] = arr;
  });

  return {
    v: 4, createdAt: t, offset: 0, mode: 'sample', rev: 0, conn: {}, detected: null, detectedUsedAt: 0,
    me: { id: 'me', name: 'Shrey', handle: 'shrey', campus: 'UW', gym: 'IMA', color: '#141A33', bio: '', lastCheckin: last.ts, streakStart: dayStart(today - 22) + 17 * HOUR, passes: 1, ext: 0, sincePass: 4, best: 41, lost: null, goalPerWeek: 4, usedPass: false, lastRepair: 0 },
    checkins: checkins, friends: friends,
    requests: [{ id: 'rq1', name: 'Nina Alvarez', color: '#D9466B', note: 'Trains at IMA' }, { id: 'rq2', name: 'Sam Whitaker', color: '#2D8B57', note: '2 friends in common' }],
    posts: posts, meals: seedMeals(t, r),
    goals: { kcal: 2400, p: 120, c: 290, f: 80 },
    lifts: lifts,
    challenges: [],
    squads: [
      { id: 'cse', name: 'CSE lifters', members: ['me', 'leo', 'kenji', 'zoe', 'omar'], since: t - 12 * DAY, goal: { title: '40 check-ins together this month', have: 27, need: 40 }, chat: [{ uid: 'leo', text: 'Who is in for 6pm tomorrow?', ts: t - 5 * HOUR }, { uid: 'kenji', text: 'Me. Bring chalk.', ts: t - 4.6 * HOUR }, { uid: 'zoe', text: 'Can someone spot me on bench? I am scared of it', ts: t - 3 * HOUR }] },
      { id: 'f7', name: 'Floor 7', members: ['me', 'arjun', 'priya', 'hana'], since: t - 5 * DAY, goal: { title: 'Everyone checks in 3 times this week', have: 9, need: 12 }, chat: [{ uid: 'priya', text: 'Arjun. Your window. Go.', ts: t - 40 * MIN }, { uid: 'hana', text: 'Day two for me, do not let me quit', ts: t - 30 * MIN }] }
    ],
    activity: [
      { id: uid(), ts: t - 14 * MIN, icon: 'hourglass', uid: 'arjun', text: 'Arjun has under 2 hours left on a 16 day streak.', act: 'nudge', read: false },
      { id: uid(), ts: t - 2.1 * HOUR, icon: 'flame', uid: 'maya', text: 'Maya reacted to your leg day.', read: false },
      { id: uid(), ts: t - 9 * HOUR, icon: 'trophy', text: 'Rivalry week: UW is ahead by 87 check-ins.', read: true },
      { id: uid(), ts: t - 26 * HOUR, icon: 'pass', text: 'You earned a rest pass.', read: true },
      { id: uid(), ts: t - 2.2 * DAY, icon: 'users', uid: 'hana', text: 'Hana started following you.', read: true }
    ],
    progress: [
      { id: uid(), ts: t - 84 * DAY, tag: 'Front', art: 0 }, { id: uid(), ts: t - 56 * DAY, tag: 'Front', art: 1 }, { id: uid(), ts: t - 28 * DAY, tag: 'Front', art: 2 }, { id: uid(), ts: t - 2 * DAY, tag: 'Front', art: 3 }
    ],
    badges: { first: 1, week: 1, month: 1, fifty: 1, pr: 1, squad: 1 },
    settings: { share: { streak: true, workouts: true, lifts: true, food: false, photos: false }, remind: { closing: true, friends: true, morning: false }, autoPass: true, units: 'lb' },
    ui: { tab: 'home', coach: true, connHint: true, foodOff: 0, heatSel: null, frSeg: 'friends', spot: false, showKcal: true }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const st = JSON.parse(raw); if (st && st.v === 4 && st.me && st.checkins) { S = st; } }
    const p = localStorage.getItem(PKEY); if (p) PHOTOS = JSON.parse(p) || {};
  } catch (e) { MEM = true; }
  if (!S) { S = seedState(); FRESH = true; }
  upgradeState();
  S.ui.tab = S.ui.tab || 'home';
}
// Things added after the first builds. State saved by an older build picks them up here.
function upgradeState() {
  if (!S.meets) S.meets = seedMeets();
  if (!S.league) S.league = seedLeague();
  if (S.conn && S.conn.strava) delete S.conn.strava;   // Strava now arrives through Apple Health or Health Connect
  S.posts.forEach(p => { if (p.uid === 'me' && !p.by) p.by = following().slice(0, Math.min(9, p.rx.fire + p.rx.flex + p.rx.clap)).map(f => f.id); });
  if (S.ui.recapSeen === undefined) S.ui.recapSeen = '';
  if (!S.mode) S.mode = 'sample';   // 'sample' to look around, 'real' for your own data
  if (!S.rev) S.rev = 0;
}
// Your own data, from zero. The sample friends stay, so the social screens have people in them.
function realState(from) {
  const st = seedState(), old = from || S;
  Object.assign(st.me, { name: old.me.name, handle: old.me.handle, campus: old.me.campus, gym: old.me.gym, goalPerWeek: old.me.goalPerWeek, lastCheckin: 0, streakStart: null, passes: 2, ext: 0, sincePass: 0, best: 0, lost: null, usedPass: false, lastRepair: 0 });
  st.checkins = []; st.meals = []; st.lifts = {}; st.progress = []; st.badges = {}; st.activity = []; st.requests = []; st.squads = [];
  st.posts = st.posts.filter(p => p.uid !== 'me'); st.friends.forEach(f => { f.duo = 0; });
  st.goals = Object.assign({}, old.goals); st.body = old.body ? Object.assign({}, old.body) : undefined; st.settings = JSON.parse(JSON.stringify(old.settings));
  st.mode = 'real'; st.rev = Date.now(); st.ui.coach = false;
  return st;
}
let _saveT = 0;
function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    syncStamp();   // marks the moment your own data last changed
    if (!MEM) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { MEM = true; } }
    syncPush();
  }, 250);
}
function savePhoto(key, dataURL, localOnly) {
  PHOTOS[key] = dataURL;
  if (!localOnly) photoPush(key, dataURL);
  if (MEM) return;
  // Browser storage is small, so keep only the newest photos; older ones fall back to a drawn scene.
  const keys = Object.keys(PHOTOS);
  let keep = keys.slice(-14);
  for (; ;) {
    try { const o = {}; keep.forEach(k => o[k] = PHOTOS[k]); localStorage.setItem(PKEY, JSON.stringify(o)); return; }
    catch (e) { if (keep.length <= 1) return; keep = keep.slice(Math.ceil(keep.length / 3)); }
  }
}
function resetDemo() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); } catch (e) { }
  PHOTOS = {}; S = seedState(); upgradeState(); save();
}
