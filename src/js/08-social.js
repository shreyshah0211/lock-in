/* Being seen, without being rated. How a check-in was proven, who noticed it,
   one kind of props for the effort, plans to train together, and duo streaks
   that can pause. Nothing here ranks people by reactions or by how they look,
   and nothing shows strangers who is at the gym. */

/* ---- how a check-in was proven ---- */
const PROOF = {
  both: ['Photo and workout', 'check', 'A photo at the gym, backed by a workout a watch or phone recorded.'],
  photo: ['Gym photo', 'camera', 'A photo taken at the gym.'],
  outside: ['Outside photo', 'pin', 'A photo from the entrance or outside, for gyms that do not allow photos inside.'],
  workout: ['Workout, no photo', 'heart', 'A workout a watch or phone recorded, with no photo.']
};
// Sample friends get a mix; your own check-ins carry the proof they were posted with.
function proofKey(p) { return PROOF[p.proof] ? p.proof : p.uid && p.uid !== 'me' && hash(p.id) % 4 === 0 ? 'both' : 'photo'; }
A.openProof = el => {
  const cur = el.dataset.k;
  openSheet(() => sheetHead('How check-ins are proven') + '<div class="sh-b"><p class="mute">Every check-in says what backs it. All four count for a streak.</p><div class="ways">' +
    Object.keys(PROOF).map(k => '<div class="way' + (k === cur ? ' on' : '') + '"><span class="conn-ic">' + ic(PROOF[k][1], 22) + '</span><div class="grow"><b>' + PROOF[k][0] + '</b><span>' + PROOF[k][2] + '</span></div>' + (k === cur ? '<span class="pill navy">This one</span>' : '') + '</div>').join('') +
    '</div><p class="mute" style="font-size:13px">A check mark next to a name means Claude looked at the photo and it showed a workout.</p></div>');
};

/* ---- props and who noticed ---- */
function propsN(p) { return p.by ? p.by.length : (p.rx.fire || 0) + (p.rx.flex || 0) + (p.rx.clap || 0); }
function noticedIds(p) { const ids = (p.by || []).slice(); p.comments.forEach(c => { if (c.uid !== 'me' && !ids.includes(c.uid)) ids.push(c.uid); }); return ids; }
// One line on Home: the friends who saw your latest check-in.
function noticedStrip() {
  const p = S.posts.find(x => x.uid === 'me' && x.ts > now() - WINDOW); if (!p) return '';
  const ppl = noticedIds(p).map(person).filter(Boolean); if (!ppl.length) return '';
  const nm = ppl.slice(0, 2).map(x => first(x.name)), what = TYPE[p.type].v.toLowerCase();
  const who = ppl.length === 1 ? nm[0] : ppl.length === 2 ? nm.join(' and ') : nm.join(', ') + ' and ' + (ppl.length - 2) + ' more';
  return '<button class="noticed" data-a="openNoticed" data-id="' + p.id + '"><span class="stack">' + ppl.slice(0, 3).map(x => avPlain(x.name, x.color, 30)).join('') + '</span><span class="grow"><b>' + esc(who) + '</b> noticed your ' + esc(what) + '</span>' + ic('chevR', 18) + '</button>';
}
A.openNoticed = el => {
  const id = el.dataset.id;
  openSheet(() => {
    const p = S.posts.find(x => x.id === id); if (!p) return '';
    const ids = noticedIds(p);
    return sheetHead('Who noticed') + '<div class="sh-b">' + (ids.length ? '<div class="rows">' + ids.map(i => {
      const u = person(i); if (!u) return '';
      const c = p.comments.filter(x => x.uid === i).pop(), gave = (p.by || []).includes(i);
      return '<button class="row" data-a="openProfile" data-id="' + i + '">' + av(u, 44, { nowarn: true }) + '<span class="grow" style="text-align:left"><span class="t" style="display:block;font-weight:700">' + esc(u.name) + '</span><span class="s mute" style="font-size:13px;display:block">' + (c ? (gave ? 'Gave props and said: ' : 'Said: ') + esc(c.text) : 'Gave props') + '</span></span>' + streakChip(pDays(u)) + '</button>';
    }).join('') + '</div>' : '<p class="empty">Nobody yet. Props show up here as friends see your check-in.</p>') +
      '<p class="mute" style="font-size:13px">Props are for the effort. There is one kind, and nobody is ranked by how many they get.</p></div>';
  });
};

/* ---- plans: "lifting at 5, who's in?" ----
   Only friends see a plan. It says when someone intends to train, never where anyone is right now. */
function meetAt(dayOff, hour) { const d = new Date(now()); d.setHours(hour, 0, 0, 0); return d.getTime() + dayOff * DAY; }
function seedMeets() {
  const soon = meetAt(0, 17) > now() + 45 * MIN ? meetAt(0, 17) : meetAt(1, 17);
  return [{ id: 'm' + uid(), uid: 'leo', type: 'push', at: soon, going: ['kenji', 'zoe'], note: 'Bench is usually free then.' }, { id: 'm' + uid(), uid: 'maya', type: 'legs', at: meetAt(1, 7), going: ['sofia'], note: '' }];
}
function meetsNow() { return S.meets.filter(m => m.at > now() - HOUR && (m.uid === 'me' || (person(m.uid) && person(m.uid).fol))).sort((a, b) => a.at - b.at); }
function meetWhen(ts) { const d = dayNum(ts) - dayNum(now()); return (d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : WD[new Date(ts).getDay()]) + ' at ' + clock(ts); }
function meetCard(m) {
  const mine = m.uid === 'me', u = person(m.uid), inn = m.going.includes('me'), others = m.going.filter(x => x !== 'me').map(person).filter(Boolean);
  const who = others.length ? listNames(others.map(x => first(x.name))) + (others.length === 1 ? ' is in' : ' are in') : mine ? 'Nobody has joined yet' : 'Be the first to join';
  return '<div class="meet"><div class="meet-h">' + av(u, 40, { nowarn: true }) + '<div class="grow"><b>' + (mine ? 'Your plan: ' + TYPE[m.type].n.toLowerCase() : esc(TYPE[m.type].n + ' with ' + first(u.name))) + '</b><span>' + meetWhen(m.at) + ', ' + esc(u.gym) + '</span></div></div>' +
    (m.note ? '<p>' + esc(m.note) + '</p>' : '') +
    '<div class="meet-f"><span>' + esc(who) + '</span>' + (mine ? '<button class="btn btn-soft btn-s" data-a="meetCancel" data-id="' + m.id + '">Cancel plan</button>' : '<button class="btn ' + (inn ? 'btn-soft' : 'btn-ink') + ' btn-s" data-a="meetIn" data-id="' + m.id + '" aria-pressed="' + inn + '">' + (inn ? ic('check', 16) + 'You are in' : 'I am in') + '</button>') + '</div></div>';
}
function meetsSection() {
  const ms = meetsNow();
  return '<div class="sec" style="padding-bottom:0"><div class="sec-h"><h2 class="h2">Training plans</h2><button class="link" data-a="newMeet">Post a plan</button></div></div>' +
    (ms.length ? '<div class="meets hscroll">' + ms.map(meetCard).join('') + '</div>' : '<div class="hint" style="margin-top:0"><p>Going later? Say when, and friends can join you.</p><button data-a="newMeet">Post a plan</button></div>');
}
A.meetIn = el => {
  const m = S.meets.find(x => x.id === el.dataset.id); if (!m) return;
  const i = m.going.indexOf('me'), u = person(m.uid);
  if (i >= 0) m.going.splice(i, 1); else m.going.push('me');
  save(); refresh(); toast(i >= 0 ? 'You are out of ' + first(u.name) + '\'s plan' : 'You are in. ' + first(u.name) + ' can see it.', i >= 0 ? null : 'check');
};
A.meetCancel = el => { S.meets = S.meets.filter(x => x.id !== el.dataset.id); save(); refresh(); toast('Plan cancelled'); };
function meetTimes() {
  const t = now(), out = [['In an hour', t + HOUR]];
  [[0, 17], [0, 19], [1, 7], [1, 17]].forEach(x => { const ts = meetAt(x[0], x[1]); if (ts > t + 90 * MIN) out.push([meetWhen(ts), ts]); });
  return out.slice(0, 4);
}
A.newMeet = () => {
  D.nm = { type: nextType(), at: 0, note: '' };
  openSheet(() => {
    const d = D.nm, times = meetTimes();
    return sheetHead('Post a plan') + '<div class="sh-b"><p class="mute">Tell friends when you are going. Whoever wants to join taps once.</p>' +
      '<div class="field"><span class="lbl">What are you training?</span><div class="chips">' + TYPES.slice(0, 7).map(t => '<button class="chip" data-a="nmType" data-k="' + t.k + '" aria-pressed="' + (d.type === t.k) + '">' + t.n + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="lbl">When?</span><div class="chips">' + times.map((x, i) => '<button class="chip" data-a="nmAt" data-i="' + i + '" aria-pressed="' + (d.at === i) + '">' + x[0] + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="nm-note">Note</label><input class="input" id="nm-note" data-m="nm.note" value="' + esc(d.note) + '" placeholder="Meet by the squat racks" maxlength="60" autocomplete="off"></div>' +
      '<p class="mute" style="font-size:13px;display:flex;gap:8px;align-items:flex-start">' + ic('lock', 16) + '<span>Only your friends see plans. They show when you intend to train at ' + esc(S.me.gym) + ', never where you are right now.</span></p>' +
      '<button class="btn btn-go btn-w" data-a="nmPost">Post plan</button></div>';
  });
};
A.nmType = el => { D.nm.type = el.dataset.k; drawSheets(false); };
A.nmAt = el => { D.nm.at = +el.dataset.i; drawSheets(false); };
A.nmPost = () => {
  const d = D.nm, tm = meetTimes()[d.at] || meetTimes()[0], m = { id: 'm' + uid(), uid: 'me', type: d.type, at: tm[1], going: [], note: d.note.trim() };
  S.meets.push(m); save(); closeSheet(); refresh(); toast('Plan posted to your friends', 'check');
  // a sample friend joins a few seconds later, so you can see what it looks like
  const f = following().filter(x => pAlive(x))[Math.floor(Math.random() * 4)];
  if (f) setTimeout(() => {
    if (!S.meets.includes(m)) return;
    m.going.push(f.id); addActivity({ icon: 'users', uid: f.id, text: first(f.name) + ' is in for your ' + TYPE[m.type].n.toLowerCase() + ' plan, ' + meetWhen(m.at).toLowerCase() + '.' });
    save(); softRefresh(); toast(first(f.name) + ' is in for your plan', 'users');
  }, 4500);
};

/* ---- duo streaks can pause ----
   A shared streak should never trap anyone. Pausing holds the number, and neither person sees a break. */
function duoCard(f) {
  const nm = esc(first(f.name));
  return '<div class="card"><div style="display:flex;gap:12px;align-items:center"><div class="stack">' + avPlain(S.me.name, S.me.color, 38) + avPlain(f.name, f.color, 38) + '</div><div style="flex:1"><div style="font-weight:700">Duo streak: ' + f.duo + ' days' + (f.duoPaused ? ', paused' : '') + '</div><div class="mute" style="font-size:13px">' +
    (f.duoPaused ? 'It holds at ' + f.duo + ' and picks up where it left off. Neither of you sees a break.' : 'You and ' + nm + ' have both stayed inside your windows for ' + f.duo + ' days.') + '</div></div></div>' +
    '<button class="btn btn-white btn-s" style="margin-top:12px" data-a="duoPause" data-id="' + f.id + '">' + (f.duoPaused ? 'Resume the duo streak' : 'Pause it, for travel, exams or being ill') + '</button></div>';
}
A.duoPause = el => {
  const f = person(el.dataset.id); if (!f || !f.duo) return;
  f.duoPaused = f.duoPaused ? 0 : now(); save(); refresh();
  toast(f.duoPaused ? 'Duo streak paused at ' + f.duo + ' days' : 'Duo streak with ' + first(f.name) + ' is back on', 'check');
};
