/* The rules of the app: the 48-hour window, streak days, rest passes,
   and a small simulation that keeps the sample friends checking in. */
function deadline() { return S.me.lastCheckin + WINDOW + S.me.ext; }
function leftMs() { return S.me.streakStart ? deadline() - now() : 0; }
function person(id) { return id === 'me' ? S.me : S.friends.find(f => f.id === id) || null; }
function pLeft(p) { return p.id === 'me' ? leftMs() : (p.streakStart ? p.lastCheckin + WINDOW - now() : 0); }
function pAlive(p) { return !!p.streakStart && pLeft(p) > 0; }
function pDays(p) { return pAlive(p) ? dayNum(now()) - dayNum(p.streakStart) + 1 : 0; }
// One colour system for time left: safe, closing, almost out. Streaks are a single flame colour.
function timeState(left) { return left <= 0 ? 'out' : left < 6 * HOUR ? 'crit' : left < 12 * HOUR ? 'close' : 'safe'; }
function timeColor(left, dark) { return { safe: dark ? '#3DDC97' : '#18AE7A', close: dark ? '#FFB020' : '#F2A20C', crit: dark ? '#FF5347' : '#E8321F', out: '#B4B9C9' }[timeState(left)]; }
function tierColor(days) { return days > 0 ? '#FF8A1E' : '#B4B9C9'; }
function tierCls(days) { return days > 0 ? 't-flame' : 't-none'; }
const MILESTONES = [7, 30, 100, 365];
const COMEBACK_PTS = 20;   // a small bonus for the first check-in after a streak ends
function nextMilestone(days) { return MILESTONES.find(x => x > days) || null; }
function following() { return S.friends.filter(f => f.fol); }
function weekStart(ts) { const n = dayNum(ts), dow = (new Date(dayStart(n)).getDay() + 6) % 7; return dayStart(n - dow); }

function addActivity(a) {
  S.activity.unshift(Object.assign({ id: uid(), ts: now(), read: false }, a));
  if (S.activity.length > 40) S.activity.length = 40;
}

/* ---- derived numbers for the person ---- */
let _dp = null, _dpN = -1;
function dayPts() {
  if (_dp && _dpN === S.checkins.length) return _dp;
  _dp = {}; S.checkins.forEach(c => { const d = dayNum(c.ts); _dp[d] = (_dp[d] || 0) + c.pts; }); _dpN = S.checkins.length;
  return _dp;
}
function checkinsSince(ts) { return S.checkins.filter(c => c.ts >= ts); }
function myWeekPts() { return checkinsSince(now() - 7 * DAY).reduce((a, c) => a + c.pts, 0); }
function weeklyTotals(n) {
  const t = now(), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = t - (i + 1) * 7 * DAY, b = t - i * 7 * DAY + 1, cs = S.checkins.filter(c => c.ts >= a && c.ts < b);
    out.push({ start: a, pts: cs.reduce((x, c) => x + c.pts, 0), n: cs.length, mins: cs.reduce((x, c) => x + c.mins, 0) });
  }
  return out;
}
function efficiency(fromDaysAgo, toDaysAgo) {
  const a = now() - fromDaysAgo * DAY, b = now() - toDaysAgo * DAY, cs = S.checkins.filter(c => c.ts >= a && c.ts < b);
  const mins = cs.reduce((x, c) => x + c.mins, 0);
  return mins ? Math.round(cs.reduce((x, c) => x + c.pts, 0) / (mins / 60)) : 0;
}
function splitByType(days) {
  const cs = checkinsSince(now() - days * DAY), m = {};
  cs.forEach(c => { m[c.type] = (m[c.type] || 0) + 1; });
  return Object.keys(m).map(k => ({ k: k, n: m[k], pct: m[k] / cs.length })).sort((a, b) => b.n - a.n);
}
function dayTotals(fd) {
  const meals = S.meals.filter(m => foodDay(m.ts) === fd).sort((a, b) => a.ts - b.ts);
  const t = { kcal: 0, p: 0, c: 0, f: 0, meals: meals };
  meals.forEach(m => { t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; });
  return t;
}
function proteinRun() {
  const fd = foodDay(now()); let n = 0;
  if (dayTotals(fd).p >= S.goals.p) n++;
  for (let d = fd - 1; d > fd - 60; d--) { if (dayTotals(d).p >= S.goals.p) n++; else break; }
  return n;
}
function friendLevel(f, d) {
  const today = dayNum(now()); if (d > today) return -1;
  const u = hash(f.id + ':' + d) / 4294967296, ld = dayNum(f.lastCheckin);
  if (d === ld) return 2 + hash(f.id + 'L' + d) % 3;
  if (d > ld) return 0;
  const inS = pAlive(f) && d >= dayNum(f.streakStart), p = inS ? .58 + f.rel * .22 : .2 + f.rel * .3;
  if (u < p) return 1 + Math.floor(u / p * 4);
  if (inS && hash(f.id + ':' + (d - 1)) / 4294967296 >= p) return 2;
  return 0;
}
function myBadgeState() {
  const cs = S.checkins, m = S.me;
  return {
    first: cs.length >= 1, week: Math.max(m.best, pDays(m)) >= 7, month: Math.max(m.best, pDays(m)) >= 30, hundred: Math.max(m.best, pDays(m)) >= 100,
    fifty: cs.length >= 50, pr: cs.some(c => c.pr), saved: !!m.usedPass
  };
}
function checkBadges() {
  const st = myBadgeState(), fresh = [];
  BADGES.forEach(b => { if (st[b.k] && !S.badges[b.k]) { S.badges[b.k] = 1; fresh.push(b); addActivity({ icon: 'trophy', text: 'New badge: ' + b.n + '.' }); } });
  return fresh;
}

/* ---- the window ---- */
// Miss your window and you get one comeback a month: check in within 24 hours and the streak is restored.
function canRepair() { const m = S.me; return !!(m.lost && m.lost.start && now() - m.lost.at < DAY && (!m.lastRepair || now() - m.lastRepair > 30 * DAY)); }
let _lz = null, _lzN = -1;
function lapseDays() {
  // days on which a window ran out, so the grid can show where streaks ended
  if (_lz && _lzN === S.checkins.length) return _lz;
  _lz = {}; const c = S.checkins;
  for (let i = 0; i < c.length - 1; i++) if (c[i + 1].ts - c[i].ts > WINDOW + DAY) _lz[dayNum(c[i].ts + WINDOW)] = 1;
  _lzN = c.length; return _lz;
}
function endStreak() {
  const m = S.me, days = Math.max(1, dayNum(deadline()) - dayNum(m.streakStart) + 1);
  m.best = Math.max(m.best, days); m.lost = { days: days, at: deadline(), start: m.streakStart }; m.streakStart = null; m.ext = 0;
  addActivity({ icon: 'hourglass', text: 'Your streak ended at ' + days + ' days.' + (canRepair() ? ' Check in within 24 hours to get it back.' : ' Check in to start a new one.') });
  toast('Your streak ended at ' + days + ' days', 'hourglass');
}
function useRestPass(manual) {
  const m = S.me; if (m.passes < 1 || !m.streakStart) return false;
  m.passes--; m.ext += DAY; m.usedPass = true;
  addActivity({ icon: 'pass', text: manual ? 'You used a rest pass. 24 hours added.' : 'A rest pass saved your streak. You have 24 more hours.' });
  toast(manual ? 'Rest pass used. 24 hours added.' : 'A rest pass saved your streak', 'pass');
  checkBadges();
  return true;
}
function tick() {
  const m = S.me; let changed = false;
  if (m.streakStart) {
    let guard = 0;
    while (deadline() - now() <= 0 && guard++ < 5) {
      changed = true;
      if (!(m.passes > 0 && S.settings.autoPass && useRestPass(false))) { endStreak(); break; }
    }
  }
  if (simulate()) changed = true;
  if (changed) save();
  return changed;
}
function simulate() {
  const t = now(); let ch = false; const live = [];
  S.friends.forEach(f => {
    let guard = 0;
    while (f.nextAt <= t && guard++ < 80) {
      const at = f.nextAt, rr = rng(hash(f.id + at));
      if (!f.streakStart || at - f.lastCheckin > WINDOW) {
        if (f.streakStart) f.lost = { days: dayNum(f.lastCheckin + WINDOW) - dayNum(f.streakStart) + 1, at: f.lastCheckin + WINDOW };
        f.streakStart = at;
      }
      f.lastCheckin = at; f.total++; f.best = Math.max(f.best, dayNum(at) - dayNum(f.streakStart) + 1);
      if (f.fol && at > t - 4 * DAY) {
        const p = mkPost(f, at, rr); p.rx = { fire: Math.floor(rr() * 4), flex: 0, clap: 0 }; p.comments = [];
        S.posts.push(p);
        if (at > t - 3 * MIN) live.push(f);
      }
      f.weekPts += 28 + Math.floor(rr() * 30);
      f.nextAt = at + (rr() > f.rel ? between(rr, 49, 68) : between(rr, 15, 45)) * HOUR;
      ch = true;
    }
  });
  if (ch) {
    S.posts.sort((a, b) => b.ts - a.ts); if (S.posts.length > 70) S.posts.length = 70;
    live.forEach(f => {
      if (f.nudged) { f.nudged = 0; addActivity({ icon: 'bolt', uid: f.id, text: first(f.name) + ' checked in after your nudge.' }); toast('Your nudge worked. ' + first(f.name) + ' just checked in.', 'bolt'); }
      else toast(first(f.name) + ' just checked in', 'check');
    });
  }
  return ch;
}

function doCheckin(o) {
  const t = now(), m = S.me, had = pAlive(m), before = pDays(m);
  const repaired = !had && canRepair(), comeback = !had && !!m.lost;
  if (repaired) { m.streakStart = m.lost.start; m.lastRepair = t; m.lost = null; }
  else if (!had) { m.streakStart = t; m.lost = null; m.passes = Math.max(m.passes, 2); }
  m.lastCheckin = t; m.ext = 0;
  let pr = null;
  const lifts = (o.lifts || []).filter(l => l.name && +l.w > 0);
  lifts.forEach(l => {
    const arr = S.lifts[l.name] || (S.lifts[l.name] = []), best = arr.reduce((a, x) => Math.max(a, x.w), 0);
    arr.push({ ts: t, w: +l.w, reps: +l.reps || 1 });
    if (best > 0 && +l.w > best && !pr) pr = { lift: l.name, w: +l.w, prev: best };
  });
  const c = mkCheckin({ ts: t, type: o.type, mins: o.mins, effort: o.effort, nl: lifts.length, photo: o.photo, caption: o.caption, verified: o.verified, pr: pr, lifts: lifts });
  if (o.scene) c.scene = o.scene;
  // how this check-in was proven: photo, photo plus a recorded workout, a photo from outside, or the workout alone
  c.proof = o.proof || 'photo'; c.aud = o.audience || 'friends'; if (o.tag) c.tag = o.tag; if (o.screen) c.screen = true;
  const earned = [];
  if (comeback) { c.pts += COMEBACK_PTS; c.bonus = COMEBACK_PTS; earned.push({ icon: 'bolt', text: 'Back after a break' }); }
  S.checkins.push(c);
  if (repaired) { earned.push({ icon: 'check', text: 'Streak restored' }); addActivity({ icon: 'check', text: 'You got your streak back. One comeback a month.' }); }
  m.sincePass++;
  if (m.sincePass >= 7 && m.passes < 2) { m.passes++; m.sincePass = 0; earned.push({ icon: 'pass', text: 'Rest pass earned' }); addActivity({ icon: 'pass', text: 'You earned a rest pass.' }); }
  const after = pDays(m); if (after > m.best) m.best = after;
  let post = null;
  if (o.audience !== 'me') {
    post = { id: uid(), uid: 'me', ts: t, type: c.type, mins: c.mins, effort: c.effort, caption: c.caption, scene: c.scene, photo: c.photo, gym: m.gym, day: after, rx: { fire: 0, flex: 0, clap: 0 }, mine: null, comments: [], pr: pr, verified: c.verified, cid: c.id, aud: o.audience, proof: c.proof, screen: !!c.screen, tag: c.tag || '', by: [] };
    S.posts.unshift(post);
  }
  checkBadges().forEach(b => earned.push({ icon: 'trophy', text: b.n + ' badge' }));
  save();
  return { c: c, before: before, after: after, earned: earned, had: had || repaired, repaired: repaired, pts: c.pts };
}
// Sample friends give props to a new post over the next minute so the feed feels alive.
function friendsReact(postId) {
  const fr = following().filter(f => pAlive(f)).slice(0, 6);
  [[5, 'fire'], [11, 'flex'], [19, 'fire'], [32, 'clap'], [47, 'fire']].forEach((step, i) => {
    setTimeout(() => {
      const p = S.posts.find(x => x.id === postId), f = fr[i % fr.length]; if (!p || !f) return;
      p.rx[step[1]]++; if (p.by && !p.by.includes(f.id)) p.by.push(f.id);
      if (i === 0 || i === 2) { addActivity({ icon: 'flame', uid: f.id, text: first(f.name) + ' gave props to your check-in.' }); toast(first(f.name) + ' gave you props', 'flame'); }
      if (i === 3) { p.comments.push({ uid: f.id, text: pick(Math.random, COMMENTS), ts: now() }); addActivity({ icon: 'comment', uid: f.id, text: first(f.name) + ' commented on your check-in.' }); }
      save(); softRefresh();
    }, step[0] * 1000);
  });
}
// A nudge is an invitation, never a telling-off. This is what the friend receives.
const NUDGE_LINES = ['Still time today. Want to go together?', 'Heading to the gym later. Come with me?', 'Your clock is low. I will save you a rack.'];
function nudge(id) {
  const f = person(id); if (!f) return;
  f.nudged = 1; f.nextAt = Math.min(f.nextAt, now() + (9 + Math.random() * 9) * 1000);
  toast('Sent to ' + first(f.name) + ': "' + pick(Math.random, NUDGE_LINES) + '"', 'bolt'); save();
}
function skipTime(hours) { S.offset += hours * HOUR; tick(); save(); refresh(); toast('Skipped ahead ' + hours + ' hours', 'clock'); }
