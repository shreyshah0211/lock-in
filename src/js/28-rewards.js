/* Locked rewards. Pick something you want, set a goal, and lock it. You only get it
   if you hit the goal: gym days by a date, or a weight by a date. Once the first day
   has passed nothing about it can be changed, which is what makes it work.

   Lock In never takes or holds money. When you win, one tap opens the store's own
   checkout with the item in the cart, and you pay the store. When you miss, nothing
   is charged; the reward is simply not yours this time.
   Rewards stay on this phone: they are not part of what syncs to your account. */
const RW_PAUSE_MAX = 14 * DAY, RW_VISIT_MIN = 20;

function rewards() {
  if (!S.rewards) S.rewards = S.mode === 'sample' ? [rwSample()] : [];
  return S.rewards;
}
function rwActive() { return rewards().find(r => r.state === 'locked') || null; }
// The one the Rewards tab leads with: the locked one, or one you earned and have not ordered yet.
function rwCurrent() { return rwActive() || rewards().slice().reverse().find(r => r.state === 'won' && !r.bought) || null; }
const rwEndOfDay = ts => dayStart(dayNum(ts)) + DAY - 1000;
const rwDate = ts => { const d = new Date(ts); return MO[d.getMonth()] + ' ' + d.getDate(); };
const rwHttps = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
function rwMoney(v, cur) {
  if (!(v > 0)) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD', maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); } catch (e) { return '$' + fmtN(v); }
}
// Simple drawings for rewards with no photo, and for what friends are working towards.
const RW_ART = {
  hoodie: '<path d="M44 34c4-9 28-9 32 0l22 10 10 44-15 5-5-20v47H32V73l-5 20-15-5 10-44z" fill="#9AA1B8"/><path d="M44 34c2 14 30 14 32 0-3 20-29 20-32 0z" fill="#7F87A3"/><path d="M46 96h28v14H46z" fill="#8990AA"/><path d="M56 48v16M64 48v16" stroke="#F3F4F8" stroke-width="2" stroke-linecap="round"/>',
  shoe: '<path d="M18 92c0-10 6-20 14-20 6 0 8 8 18 8l14-18c6 2 10 12 20 18 12 6 20 6 20 16v6H18z" fill="#FF7A3D"/><path d="M18 102h86v8H18z" fill="#F3F4F8"/><path d="M58 74l8 6M64 66l8 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  phones: '<path d="M30 84V70a30 30 0 0160 0v14" fill="none" stroke="#3D4460" stroke-width="8" stroke-linecap="round"/><rect x="20" y="78" width="22" height="38" rx="10" fill="#5B6388"/><rect x="78" y="78" width="22" height="38" rx="10" fill="#5B6388"/>',
  bottle: '<rect x="50" y="26" width="20" height="14" rx="4" fill="#3D4460"/><path d="M44 46h32l4 14v58a8 8 0 01-8 8H48a8 8 0 01-8-8V60z" fill="#2AA7E8"/><rect x="40" y="74" width="40" height="18" fill="#fff" opacity=".35"/>',
  bag: '<path d="M40 56c0-22 40-22 40 0" fill="none" stroke="#3D4460" stroke-width="7" stroke-linecap="round"/><rect x="18" y="56" width="84" height="56" rx="16" fill="#12996B"/><rect x="18" y="74" width="84" height="8" fill="#0E6B4C"/><rect x="54" y="70" width="12" height="16" rx="3" fill="#F3F4F8"/>'
};
function rwArt(kind) { return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><rect width="120" height="150" fill="#E4E7EF"/>' + (RW_ART[kind] || RW_ART.hoodie) + '</svg>'); }
function rwImg(r, cls) { return '<img class="' + (cls || 'rw-img') + '" src="' + esc(rwHttps(r.img) || rwArt(r.art)) + '" alt="" onerror="this.onerror=null;this.src=\'' + rwArt(r.art) + '\'">'; }
// The reward's picture, whole.
function rwCover(r, extra) { return '<div class="rw-cover">' + rwImg(r, 'rw-cimg') + (extra || '') + '</div>'; }
// A reward you missed or gave up on cannot be locked again for 30 days.
const RW_OUT = 30 * DAY;
const rwKey = r => (r.url || '').replace(/[?#].*$/, '').toLowerCase() || String(r.name || '').trim().toLowerCase();
function rwLockedOut(d) {
  const k = rwKey(d); if (!k) return 0;
  const m = rewards().filter(r => !r.sample && (r.state === 'missed' || r.state === 'quit') && rwKey(r) === k).map(r => (r.doneAt || r.end) + RW_OUT).sort().pop();
  return m && m > now() ? m : 0;
}
function rwSample() {
  const start = now() - 11 * DAY, days = {};
  S.checkins.forEach(c => { if (c.ts >= start) days[dayNum(c.ts)] = 1; });
  const r = { id: uid(), sample: true, name: 'Grey zip hoodie', img: '', price: 119, cur: 'USD', url: '', buy: '', store: 'Sample store', size: 'M', kind: 'gym',
    target: Object.keys(days).length + 14, start: start, end: rwEndOfDay(now() + 18 * DAY), lockedAt: start, state: 'locked' };
  r.code = 'SAMPLE15'; r.off = 15; r.spare0 = 12;
  return r;
}

/* ---- progress ---- */
const rwEnd = r => r.end + (r.pausedAt ? Math.min(now() - r.pausedAt, RW_PAUSE_MAX) : 0);
// Days that count: any check-in, or a visit to your gym of 20 minutes or more that the phone noticed.
function rwGymDays(r) {
  const a = dayNum(r.start), end = r.doneAt || rwEnd(r), days = {};
  S.checkins.forEach(c => { if (c.ts <= end && dayNum(c.ts) >= a) days[dayNum(c.ts)] = 1; });
  if (S.gymLoc && typeof GYM !== 'undefined') GYM.visits.forEach(v => { const t = v.in + (S.offset || 0); if (t <= end && dayNum(t) >= a && visitMins(v) >= RW_VISIT_MIN) days[dayNum(t)] = 1; });
  return days;
}
function rwProg(r) {
  const end = rwEnd(r), today = dayNum(now()), daysLeft = Math.max(0, dayNum(end) - today + 1), over = now() > end;
  if (r.kind === 'weight') {
    const tr = weightTrend(), fresh = tr && tr.latest.ts >= r.start && now() - tr.latest.ts < 7 * DAY, cur = tr ? tr.avg : r.fromKg, lose = r.toKg < r.fromKg;
    const frac = clamp((r.fromKg - cur) / (r.fromKg - r.toKg), 0, 1), gap = Math.max(0, lose ? cur - r.toKg : r.toKg - cur);
    return { kind: 'weight', cur: cur, gap: gap, frac: frac, fresh: !!fresh, hit: !!fresh && gap <= 0.049, daysLeft: daysLeft, over: over, lose: lose };
  }
  const days = rwGymDays(r), done = Object.keys(days).length, need = Math.max(0, r.target - done), avail = over ? 0 : daysLeft - (days[today] ? 1 : 0);
  return { kind: 'gym', days: days, done: done, need: need, avail: avail, spare: avail - need, todayDone: !!days[today], frac: done / r.target, hit: done >= r.target, daysLeft: daysLeft, over: over };
}
// Wins and misses are decided here, a few times a minute, so a check-in from anywhere counts.
function rwTick() {
  if (!S || !S.checkins) return;
  let ch = false;
  rewards().forEach(r => {
    if (r.state !== 'locked') return;
    if (r.pausedAt && now() - r.pausedAt >= RW_PAUSE_MAX) { rwResume(r); ch = true; }
    const p = rwProg(r);
    if (p.hit) { r.state = 'won'; r.doneAt = now(); r.got = p.kind === 'gym' ? p.done : null; ch = true; if (!r.sample) addActivity({ icon: 'trophy', text: 'You earned ' + r.name + '.' }); }
    else if (p.over) { r.state = 'missed'; r.doneAt = r.end; r.got = p.kind === 'gym' ? p.done : null; ch = true; if (!r.sample) addActivity({ icon: 'lock', text: 'You missed ' + r.name + '. It is locked out for 30 days.' }); }
  });
  if (ch) { save(); softRefresh(); }
  const w = rewards().find(r => r.state === 'won' && !r.seen);
  if (w && !sheets.length && S.ui.tab !== 'cam') rwCelebrate(w);
}
setInterval(rwTick, 4000);
function rwResume(r) { r.end += Math.min(now() - r.pausedAt, RW_PAUSE_MAX); r.pausedAt = null; r.paused = true; }

/* ---- the Rewards tab on Home ---- */
function homeSeg(seg) {
  const r = rwActive(), p = r ? rwProg(r) : null, owed = !r && rwCurrent();
  const lbl = p ? 'Reward ' + (p.kind === 'gym' ? p.done + '/' + r.target : Math.round(p.frac * 100) + '%')  : owed ? 'Reward earned' : 'Rewards';
  return '<div class="pad home-seg"><div class="seg">' + [['friends', 'Friends'], ['rewards', lbl]].map(x => '<button data-a="homeSeg" data-k="' + x[0] + '" aria-pressed="' + (seg === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>';
}
A.homeSeg = el => { S.ui.homeSeg = el.dataset.k; save(); render(); };
function rwSub(r) { return [r.store, r.size, rwMoney(r.price, r.cur)].filter(Boolean).map(esc).join(' · '); }
function rwGoalTxt(r) {
  if (r.kind === 'weight') return 'Reach ' + wShow(r.toKg) + ' ' + wUnit() + ' by ' + rwDate(r.end);
  return plural(r.target, 'gym day') + ' by ' + rwDate(r.end);
}
function rwCard(r) {
  const p = rwProg(r), u = wUnit();
  const tag = '<span class="rw-tag">' + (r.state === 'won' ? ic('check', 13) + 'Earned' : r.pausedAt ? ic('hourglass', 13) + 'Paused' : ic('lock', 13) + 'Locked') + '</span>';
  let h = '<div class="card rw' + (r.state === 'won' ? ' won' : '') + '">' + rwCover(r, tag) + '<div class="rw-id"><b class="rw-name">' + esc(r.name) + '</b><span class="rw-sub">' + rwSub(r) + '</span>' + rwExtras(r) + '</div>';
  if (r.state === 'won') {
    return h + rwSealBox(r) + '<p class="rw-line"><b>You earned it.</b> ' + (r.kind === 'gym' ? plural(r.got || r.target, 'gym day') + ', done ' + rwDate(r.doneAt) + '.' : 'You reached ' + wShow(r.toKg) + ' ' + u + ' on ' + rwDate(r.doneAt) + '.') + '</p>' +
      rwBuyBtn(r) + '<button class="btn btn-line btn-w" data-a="rwBought" data-id="' + r.id + '">' + ic('check', 17) + 'I ordered it</button></div>';
  }
  if (p.kind === 'gym') {
    const st = p.spare < 0 ? 'bad' : p.spare <= 2 ? 'warn' : 'ok';
    const line = p.spare < 0 ? 'Out of reach this time: ' + p.need + ' to go and only ' + plural(p.avail, 'day') + ' left.'
      : (p.todayDone ? 'Today is done. ' : '') + (p.need <= 3 ? 'Nearly there: ' + p.need + ' to go. ' : p.need + ' to go. ') + (p.spare === 0 ? 'No spare days left: every day from here has to count.' : r.spare0 >= p.spare ? p.spare + ' of your ' + plural(r.spare0, 'spare day') + ' left.' : 'You can miss ' + p.spare + ' of the ' + p.avail + ' days left.');
    h += '<div class="rw-n"><b class="num">' + p.done + '</b><span>of ' + plural(r.target, 'gym day') + '</span><em>' + (r.pausedAt ? 'paused' : plural(p.daysLeft, 'day') + ' left') + '</em></div>' + bar(p.frac, 'var(--go)') +
      '<p class="rw-line ' + st + '">' + line + '</p>';
  } else {
    h += '<div class="rw-n"><b class="num">' + wShow(p.cur) + '</b><span>' + u + ' now, goal ' + wShow(r.toKg) + '</span><em>' + (r.pausedAt ? 'paused' : plural(p.daysLeft, 'day') + ' left') + '</em></div>' + bar(p.frac, 'var(--go)') +
      '<p class="rw-line">' + (p.gap <= 0.049 ? 'You are there. Log your weight this week to confirm it.' : wShow(p.gap) + ' ' + u + ' to go, judged on the average of your last weigh-ins.') + '</p>';
  }
  h += '<div class="rw-acts">' + (p.kind === 'gym' ? (p.spare < 0 || p.todayDone ? '' : '<button class="btn btn-go" data-a="goCam">' + ic('camera', 18) + 'Check in today</button>') : '<button class="btn btn-go" data-a="openWeigh">' + ic('plus', 18) + 'Log my weight</button>') +
'</div>' + (r.sample ? '' : '<button class="link rw-giveup" data-a="rwOpts" data-id="' + r.id + '">Give up on this reward</button>');
  return h + '</div>';
}
/* ---- discounts ----
   A reward can carry a discount code that stays sealed until it is earned. On a win it is
   shown and, for Shopify stores, already on the checkout link. A code comes from the person
   (a welcome code they found) or from a brand that gives finishers a discount.
   Partner brands go here once there is a deal: store host -> { off: percent, code, by }.
   A code kept in the app can be read by anyone who digs for it, so a brand that needs
   one-time codes needs a server that hands one out on a verified win. */
const RW_PARTNERS = {};
function rwPartner(url) { try { return RW_PARTNERS[new URL(url).hostname.replace(/^www\./, '')] || null; } catch (e) { return null; } }
const rwCode = s0 => String(s0 || '').trim().replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40);
function rwBuyUrl(r) {
  const u = rwHttps(r.buy) || rwHttps(r.url); if (!u || !r.code || r.state !== 'won') return u;
  return /\/cart\/\d+:\d+$/.test(u) ? u + '?discount=' + encodeURIComponent(r.code) : u;
}
function rwOffTxt(r) { return r.off > 0 ? r.off + '% off' : 'A discount'; }
// Shown only once it is earned: the code, and what it should come to.
function rwCodeBox(r) {
  if (!r.code || r.state !== 'won') return '';
  const u = rwBuyUrl(r), on = /[?&]discount=/.test(u || ''), was = r.priceNow > 0 ? r.priceNow : r.price, now1 = r.off > 0 && was > 0 ? was * (1 - r.off / 100) : 0;
  return '<div class="rw-codebox"><small>' + ic('sparkle', 13) + (r.off > 0 ? r.off + '% off for finishing' : 'Your discount for finishing') + '</small><b>' + esc(r.code) + '</b><span>' + (on ? 'Already on the checkout.' : 'Enter it at the checkout.') + (now1 ? ' About ' + esc(rwMoney(Math.round(now1 * 100) / 100, r.cur)) + ', down from ' + esc(rwMoney(was, r.cur)) + '.' : '') + '</span></div>';
}
function rwBuyBtn(r) {
  const u = rwBuyUrl(r);
  return rwCodeBox(r) + (u ? '<a class="btn btn-go btn-w" href="' + esc(u) + '" target="_blank" rel="noopener">' + ic('trophy', 18) + 'Get it: open the checkout</a><p class="rw-fine">Opens ' + esc(r.store || 'the store') + ' with it ready to buy. You pay the store, not Lock In. The price may have changed since you locked it.</p>'
    : '<button class="btn btn-go btn-w" data-a="rwNoLink">' + ic('trophy', 18) + 'Go and get it</button>');
}
A.rwNoLink = () => toast('This one has no link. It is yours: go and buy it.', 'trophy');
function rwPast(r) {
  const won = r.state === 'won', what = r.kind === 'gym' ? (r.got != null ? r.got + ' of ' + r.target + ' gym days' : plural(r.target, 'gym day')) : 'Goal ' + wShow(r.toKg) + ' ' + wUnit();
  const sealAt = (r.seal || r.code) && !won ? (r.doneAt || r.end) + RW_OUT : 0;
  return '<div class="row rw-past">' + rwImg(r, 'rw-thumb') + '<div class="grow"><div class="t">' + esc(r.name) + '</div><div class="s">' + what + ', ' + rwDate(r.doneAt || r.end) + '</div>' +
    (r.seal || (r.code && !won && !r.partner) ? '<button class="link rw-sealed" data-a="rwSealOpen" data-id="' + r.id + '">' + ic('lock', 13) + (won || sealAt <= now() ? 'Read what you sealed' : 'Sealed until ' + rwDate(sealAt)) + '</button>' : '') + '</div>' +
    '<span class="pill' + (won ? ' rw-ok' : '') + '">' + (won ? 'Earned' : r.state === 'quit' ? 'Gave up' : 'Missed') + '</span>' +
    (won || r.sample ? '' : rwLockedOut(r) ? '<span class="rw-back">Back ' + rwDate(rwLockedOut(r)) + '</span>' : '<button class="link" data-a="rwAgain" data-id="' + r.id + '">Try again</button>') + '</div>';
}
function rewardsView() {
  const cur = rwCurrent(), past = rewards().filter(r => r !== cur && r.state !== 'locked').reverse();
  let h = '<div class="pad rw-wrap">';
  const miss = rewards().slice().reverse().find(r => !r.sample && (r.state === 'missed' || r.state === 'quit') && !r.ack);
  if (miss) h += '<div class="card rw-miss"><b>' + (miss.state === 'quit' ? 'You gave up on ' : 'You missed ') + esc(miss.name) + '</b><p>' + (miss.kind === 'gym' && miss.got != null ? miss.got + ' of ' + miss.target + ' gym days. ' : '') + 'It is locked out until ' + rwDate((miss.doneAt || miss.end) + RW_OUT) + '. The next one starts whenever you are ready.</p>' +
    '<button class="btn btn-line btn-w" data-a="rwAck" data-id="' + miss.id + '">OK</button></div>';
  if (cur) h += rwCard(cur);
  if (!rwActive()) {
    h += '<div class="card rw-new"><h2 class="h2">' + (cur ? 'Lock the next one' : past.length ? 'Lock another reward' : 'Earn something you want') + '</h2>' +
      (cur || past.length ? '' : '<p class="rw-pitch">Pick something you want and lock it behind a goal. Finish, and it is yours to order. Miss, and it is gone for a month.</p>') +
      '<button class="btn btn-ink btn-w" data-a="rwNew">' + ic('lock', 18) + 'Pick a reward</button><p class="rw-fine">Lock In never takes or holds your money.</p></div>';
  }
  const fin = rewards().filter(r => !r.sample && r.state !== 'locked'), kept = fin.filter(r => r.state === 'won').length;
  const shelf = past.filter(r => r.state === 'won'); past.splice(0, past.length, ...past.filter(r => r.state !== 'won'));
  if (shelf.length) h += '<div class="rw-hist"><div class="sec-h"><h2 class="h2">Earned</h2>' + (fin.length ? '<span class="rw-rec">Kept ' + kept + ' of ' + fin.length + '</span>' : '') + '</div><div class="rw-shelf">' +
    shelf.map(r => '<button data-a="rwSealOpen" data-id="' + r.id + '">' + rwImg(r, 'rw-simg') + '<b>' + esc(r.name) + '</b><small>' + rwDate(r.doneAt) + (r.seal ? ' ' + ic('lock', 11) : '') + '</small></button>').join('') + '</div></div>';
  rwWatch();
  if (past.length) h += '<div class="rw-hist"><div class="sec-h"><h2 class="h2">' + (shelf.length ? 'Missed' : 'Past rewards') + '</h2>' + (fin.length && !shelf.length ? '<span class="rw-rec">Kept ' + kept + ' of ' + fin.length + '</span>' : '') + '</div><div class="rows">' + past.map(rwPast).join('') + '</div></div>';
  return h + '</div>';
}

/* ---- finding the product behind a link ---- */
function rwGet(url) {
  const h = appNative();
  if (h) return h.postMessage({ op: 'page', url: url }).then(r => (r && r.text) || '');
  return fetch(url).then(r => r.ok ? r.text() : '');   // most stores refuse this from a browser; the iPhone app fetches it itself
}
const rwEnt = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function rwNum(s) {
  s = String(s == null ? '' : s).replace(/[^\d.,]/g, ''); if (!s) return 0;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c > d) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  return +s || 0;
}
function rwMeta(html, key) {
  const k = key.replace(/[.:]/g, '\\$&');
  const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*?content=["\']([^"\']*)["\']', 'i')) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' + k + '["\']', 'i'));
  return m ? rwEnt(m[1]) : '';
}
// What a product page says about itself. Shopify stores also give sizes and a link straight to the checkout.
function rwParse(u, js, html) {
  const store0 = u.hostname.replace(/^www\./, ''); let p = null;
  const cur = (rwMeta(html, 'og:price:currency') || rwMeta(html, 'product:price:currency') || (html.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/) || [])[1] || 'USD').toUpperCase();
  const site = rwMeta(html, 'og:site_name');
  try {
    const j = js && JSON.parse(js);
    if (j && j.title && Array.isArray(j.variants) && j.variants.length) {
      const img = j.featured_image || (j.images || [])[0] || '';
      p = { name: String(j.title), img: /^\/\//.test(img) ? 'https:' + img : img, shop: true,
        variants: j.variants.map(v => ({ id: String(v.id), title: String(v.title || ''), price: (+v.price || 0) / 100, ok: v.available !== false })) };
      if (p.variants.length === 1 && /default title/i.test(p.variants[0].title)) p.variants[0].title = '';
      const want = u.searchParams.get('variant'), i = p.variants.findIndex(v => v.id === want);
      p.vi = i >= 0 ? i : Math.max(0, p.variants.findIndex(v => v.ok));
    }
  } catch (e) { }
  if (!p) {
    const name = rwMeta(html, 'og:title') || rwEnt((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]);
    if (!name) return null;
    const price = rwNum(rwMeta(html, 'og:price:amount') || rwMeta(html, 'product:price:amount') || (html.match(/"price"\s*:\s*"?([\d.,]+)/) || [])[1]);
    p = { name: name, img: rwMeta(html, 'og:image'), variants: [{ id: '', title: '', price: price, ok: true }], vi: 0 };
  }
  p.name = p.name.slice(0, 80); p.img = rwHttps(p.img); p.cur = cur; p.url = u.href; p.origin = u.origin;
  p.store = (site || store0.split('.')[0].replace(/^./, c => c.toUpperCase())).slice(0, 30);
  return p;
}
async function rwLookup(raw) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw.trim() : 'https://' + raw.trim()); } catch (e) { return null; }
  if (!/\./.test(u.hostname)) return null;
  u.protocol = 'https:'; u.hash = '';
  const m = u.pathname.match(/\/products\/([^\/?#]+)/);
  const got = await Promise.all([m ? rwGet(u.origin + '/products/' + m[1] + '.js').catch(() => '') : '', rwGet(u.href).catch(() => '')]);
  return rwParse(u, got[0], got[1] || '');
}

/* ---- picking and locking a reward ---- */
// How long it runs: to the end of this month when there is enough of it left, 30 days, or to the end of next month.
function rwPeriods() {
  const d = new Date(now()), eom = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime(), next = new Date(d.getFullYear(), d.getMonth() + 2, 0, 23, 59, 59).getTime(), out = [];
  if (dayNum(eom) - dayNum(now()) + 1 >= 14) out.push(['month', 'To ' + rwDate(eom), eom]);
  out.push(['30', '30 days', rwEndOfDay(now() + 29 * DAY)]);
  if (!rewards().some(r => !r.sample && r.state !== 'locked')) out.push(['14', '2 weeks', rwEndOfDay(now() + 13 * DAY)]);   // a short first one is easier to finish
  else if (dayNum(next) - dayNum(now()) + 1 <= 62) out.push(['next', 'To ' + rwDate(next), next]);
  return out;
}
function rwPeriod(G) { const ps = rwPeriods(); return ps.find(x => x[0] === G.period) || ps[0]; }
const rwSpan = end => dayNum(end) - dayNum(now()) + 1;   // days that can count, today included
// A stretch you can reach: your last four weeks, plus a fifth.
function rwSuggest(n) {
  const cut = now() - 28 * DAY, days = {}; S.checkins.forEach(c => { if (c.ts > cut) days[dayNum(c.ts)] = 1; });
  const recent = Object.keys(days).length;
  return { recent: recent, target: clamp(Math.round((recent ? recent / 28 * 1.2 : 3 / 7) * n), Math.min(4, n), Math.max(1, n - 2)) };
}
// A weight target has to be reachable at a safe pace and never under a healthy weight.
function rwWeightCheck(G, end) {
  const tr = weightTrend(), b = S.body, u = wUnit();
  if (!tr || now() - tr.latest.ts > 7 * DAY) return { msg: 'Log your weight first, so there is a starting point. You can do that on You, under Body.' };
  if (!b || !bodyReady(b)) return { msg: 'Add your age and height under You, Body, Goals from your body. Lock In needs them to keep a weight target safe.' };
  if (+b.age < 18) return { msg: 'Weight rewards are for people 18 and over. Gym days work for everyone.' };
  const from = tr.avg, v = +G.toW; if (!(v > 0)) return { from: from, msg: '' };
  const to = S.settings.units === 'kg' ? v : v / KG_LB, weeks = (end - now()) / (7 * DAY), lose = to < from, most = from * (lose ? .01 : .005) * weeks;
  if (Math.abs(from - to) < .45) return { from: from, msg: 'Pick a target at least 1 ' + u + ' away from your ' + wShow(from) + ' ' + u + ' average.' };
  if (Math.abs(from - to) > most) return { from: from, msg: (lose ? 'That is faster than 1% of your weight a week. ' : 'That is faster than a lean gain. ') + 'The furthest target by ' + rwDate(end) + ' is ' + wShow(lose ? from - most : from + most) + ' ' + u + '.' };
  const m = bodyCm(b) / 100, floor = 18.5 * m * m;
  if (lose && to < floor) return { from: from, msg: 'That would be under a healthy weight for your height. The lowest target is ' + wShow(floor) + ' ' + u + '.' };
  return { from: from, to: to, ok: true, msg: (lose ? 'About ' : 'About +') + wShow(Math.abs(from - to) / weeks) + ' ' + u + ' a week, from your ' + wShow(from) + ' ' + u + ' average.' };
}
A.rwNew = () => {
  if (rwActive()) { toast('One locked reward at a time. Finish this one first.'); return; }
  closeAll();
  D.rw = Object.assign({ step: 'pick', url: '', busy: false, err: '', p: null, manual: false, name: '', price: '', kind: 'gym', period: rwPeriods()[0][0], target: 0, toW: '', code: '', off: '' }, D.rwSeed || {}); D.rwSeed = null;
  openSheet(rwSheet, { cls: 'full', onClose: () => { D.rw = null; } });
};
A.rwAgain = el => {
  const r = rewards().find(x => x.id === el.dataset.id); if (!r) return;
  D.rwSeed = { step: 'goal', p: { name: r.name, img: r.img, cur: r.cur, url: r.url, store: r.store, origin: '', buyFixed: r.buy, variants: [{ id: '', title: r.size || '', price: r.price, ok: true }], vi: 0 }, kind: r.kind };
  A.rwNew();
};
function rwDraft(G) {
  if (G.p) { const v = G.p.variants[G.p.vi] || G.p.variants[0]; return { name: G.p.name, img: G.p.img, price: v.price, cur: G.p.cur, url: G.p.url, store: G.p.store, size: v.title,
    buy: G.p.buyFixed || (G.p.shop && v.id ? G.p.origin + '/cart/' + v.id + ':1' : G.p.url) }; }
  const link = rwHttps(/^https?:\/\//i.test(G.url) ? G.url.trim().replace(/^http:/i, 'https:') : G.url.trim() ? 'https://' + G.url.trim() : '');
  return { name: String(G.name || '').trim().slice(0, 80), img: '', price: +G.price || 0, cur: 'USD', url: link, store: '', size: '', buy: link };
}
function rwSheet() {
  const G = D.rw; if (!G) return '';
  const d = rwDraft(G), per = rwPeriod(G), n = rwSpan(per[2]);
  const head = t => (G.step === 'pick' ? sheetHead(t) : sheetHead(t, { back: true }).replace('data-a="closeSheet" aria-label="Back"', 'data-a="rwBack" aria-label="Back"')) + '<div class="sh-b rw-sheet"><div class="rw-steps"><i class="on"></i><i class="' + (G.step !== 'pick' ? 'on' : '') + '"></i><i class="' + (G.step === 'lock' ? 'on' : '') + '"></i></div>';
  const prod = '<div class="rw-top">' + rwImg(d) + '<div class="grow"><b class="rw-name">' + esc(d.name) + '</b><span class="rw-sub">' + rwSub(d) + '</span></div></div>';
  if (G.step === 'pick') {
    let h = head('Pick your reward') + '<p class="mute">Something you want and would not just buy anyway. Paste its link from the store.</p>' +
      '<div class="send"><input class="input" id="rw-url" type="url" inputmode="url" data-m="rw.url" data-enter="rwFind" placeholder="scuffers.com/products/..." autocomplete="off" autocapitalize="off" value="' + esc(G.url) + '">' +
      '<button class="btn btn-ink" data-a="rwFind"' + (G.busy ? ' disabled' : '') + ' aria-label="Find it">' + (G.busy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>' : ic('search', 20)) + '</button></div>';
    if (G.err) h += '<div class="aicheck no">' + ic('info', 18) + '<span>' + esc(G.err) + '</span></div>';
    if (G.p) {
      h += '<div class="card">' + prod + (G.p.variants.length > 1 ? '<div class="rw-sizes">' + G.p.variants.map((v, i) => '<button data-a="rwSize" data-i="' + i + '" aria-pressed="' + (i === G.p.vi) + '"' + (v.ok ? '' : ' class="out"') + '>' + esc(v.title) + '</button>').join('') + '</div>' +
        (G.p.variants[G.p.vi].ok ? '' : '<p class="rw-fine">Sold out right now. You can still lock it; it may be back by the time you earn it.</p>') : '') + '</div>';
    } else if (G.manual) {
      h += '<div class="field"><label for="rw-name">What is it?</label><input class="input" id="rw-name" data-m="rw.name" data-on="rwLive" placeholder="Grey zip hoodie" maxlength="80" value="' + esc(G.name) + '"></div>' +
        '<div class="field"><label for="rw-price">About how much? (optional)</label><input class="input" id="rw-price" type="number" inputmode="decimal" min="0" data-m="rw.price" placeholder="120" value="' + esc(G.price) + '"></div>';
    } else h += '<button class="link rw-alt" data-a="rwManual">No link? Type it in instead</button>';
    const out = rwLockedOut(d);
    if (out) h += '<div class="aicheck no" id="rw-out">' + ic('lock', 18) + '<span>You missed this one, so it is locked out until ' + rwDate(out) + '. Pick something else for now.</span></div>';
    return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" id="rw-next" data-a="rwStep" data-to="goal"' + (d.name && !out ? '' : ' disabled') + '>Next: set the goal</button></div>';
  }
  if (G.step === 'goal') {
    const ps = rwPeriods(); let ok = true;
    let h = head('Set the goal') + '<div class="card">' + prod + '</div>' +
      '<div class="field"><span class="lbl">What earns it?</span><div class="seg">' + [['gym', 'Gym days'], ['weight', 'Body weight']].map(x => '<button data-a="rwKind" data-k="' + x[0] + '" aria-pressed="' + (G.kind === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="lbl">By when?</span><div class="seg">' + ps.map(x => '<button data-a="rwPer" data-k="' + x[0] + '" aria-pressed="' + (per[0] === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>';
    if (G.kind === 'gym') {
      const sg = rwSuggest(n); if (!G.target) G.target = sg.target; G.target = clamp(G.target, 1, n);
      const spare = n - G.target;
      h += '<div class="field"><span class="lbl">How many gym days?</span><div class="rw-step"><button data-a="rwTarget" data-d="-1" aria-label="Fewer">' + ic('minus', 22) + '</button><span><b class="num">' + G.target + '</b><small>of the next ' + n + ' days</small></span><button data-a="rwTarget" data-d="1" aria-label="More">' + ic('plus', 22) + '</button></div>' +
        '<p class="mute rw-note">' + (sg.recent ? 'You trained ' + plural(sg.recent, 'day') + ' in the last four weeks. ' : '') + 'That is about ' + (Math.round(G.target / n * 70) / 10) + ' a week, and you could miss ' + plural(spare, 'day') + '.' +
        (spare < 2 ? ' Leave a day or two spare: goals with no room tend to get dropped after one miss.' : G.target < sg.target ? ' A bit more of a stretch works better.' : '') + '</p></div>';
    } else {
      const c = rwWeightCheck(G, per[2]); ok = !!c.ok;
      h += (c.from ? '<div class="field"><label for="rw-tow">Target weight, ' + wUnit() + '</label><input class="input" id="rw-tow" type="number" inputmode="decimal" min="0" data-m="rw.toW" data-on="rwLive" placeholder="' + wShow(c.from) + '" value="' + esc(G.toW) + '">' : '<div class="field">') +
        '<div id="rw-wmsg">' + (c.msg ? '<p class="mute rw-note">' + esc(c.msg) + '</p>' : '') + '</div></div>' +
        '<p class="rw-fine">Weight moves slowly and jumps around day to day, so this is judged on the average of your last weigh-ins. Gym days are the goal most people can count on.</p>';
    }
    return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" id="rw-next" data-a="rwStep" data-to="lock"' + (ok ? '' : ' disabled') + '>Next: lock it</button></div>';
  }
  const goal = G.kind === 'gym' ? plural(G.target, 'gym day') + ' by ' + rwDate(per[2]) : 'Reach ' + G.toW + ' ' + wUnit() + ' by ' + rwDate(per[2]);
  return head('Lock it in') + '<div class="card rw-deal">' + prod + '<div class="rw-goal">' + ic('target', 18) + '<b>' + goal + '</b></div></div>' +
    '<ul class="rw-rules"><li>' + ic('lock', 16) + '<span>Once you lock it, the reward, the goal and the date <b>cannot be changed</b>.</span></li>' +
    '<li>' + ic('trophy', 16) + '<span>Hit the goal and the checkout opens with it ready to buy. You pay the store.</span></li>' +
    '<li>' + ic('x', 16) + '<span>Miss it and you do not get it, and you cannot lock this item again for 30 days. No money is taken, ever.</span></li></ul>' +
    (rwPartner(d.url) ? '<div class="aicheck ok">' + ic('sparkle', 18) + '<span>' + esc(d.store || 'This store') + ' gives finishers ' + rwPartner(d.url).off + '% off. It is added to your checkout when you earn it.</span></div>'
      : '<div class="field"><label for="rw-code">Discount code (optional)</label><div class="rw-code"><input class="input" id="rw-code" data-m="rw.code" placeholder="WELCOME15" maxlength="40" autocomplete="off" autocapitalize="characters" value="' + esc(G.code) + '"><input class="input" id="rw-off" type="number" inputmode="numeric" min="0" max="90" data-m="rw.off" placeholder="% off" value="' + esc(G.off) + '"></div><p class="rw-fine left">Got a code for this store? It is sealed with the reward and put on the checkout for you when you finish. Until then you cannot see it here.</p></div>') +
    '<p class="rw-fine">The deal is with yourself: do not buy it until you have earned it.</p></div>' +
    '<div class="sticky-cta"><button class="btn btn-go btn-w rw-hold" data-hold="rwLock" data-a="rwHoldHint">' + ic('lock', 18) + '<span>Hold to lock it in</span></button></div>';
}
A.rwFind = async () => {
  const G = D.rw; if (!G || G.busy) return;
  const raw = String(G.url || '').trim(); if (!raw) { toast('Paste the link to what you want.'); return; }
  G.busy = true; G.err = ''; G.p = null; drawSheets(false);
  let p = null; try { p = await rwLookup(raw); } catch (e) { }
  if (D.rw !== G) return;
  G.busy = false;
  if (p) { G.p = p; G.manual = false; } else { G.manual = true; G.err = appNative() ? 'Could not read that page. Type in what it is, and the link is kept for when you earn it.' : 'Reading a store page works in the iPhone app. Here, type in what it is; the link is kept for when you earn it.'; }
  drawSheets(false);
};
A.rwManual = () => { D.rw.manual = true; drawSheets(false); const i = $('#rw-name'); if (i) i.focus(); };
A.rwSize = el => { D.rw.p.vi = +el.dataset.i; drawSheets(false); };
// Typing must not redraw the sheet, or the keyboard closes: only the button and the note change.
A.rwLive = () => {
  const G = D.rw, b = $('#rw-next'); if (!G) return;
  if (G.step === 'pick') { const d = rwDraft(G); if (b) b.disabled = !d.name || !!rwLockedOut(d); return; }
  const c = rwWeightCheck(G, rwPeriod(G)[2]), box = $('#rw-wmsg');
  if (box) box.innerHTML = c.msg ? '<p class="mute rw-note">' + esc(c.msg) + '</p>' : '';
  if (b) b.disabled = !c.ok;
};
A.rwKind = el => { D.rw.kind = el.dataset.k; drawSheets(false); };
A.rwPer = el => { D.rw.period = el.dataset.k; D.rw.target = 0; drawSheets(false); };
A.rwTarget = el => { const G = D.rw; G.target = clamp(G.target + (+el.dataset.d), 1, rwSpan(rwPeriod(G)[2])); drawSheets(false); };
A.rwStep = el => { const G = D.rw, to = el.dataset.to; if (to === 'goal' && (!rwDraft(G).name || rwLockedOut(rwDraft(G)))) { drawSheets(false); return; } G.step = to; drawSheets(false); const s = $('#layer .sheet:last-of-type'); if (s) s.scrollTop = 0; };
A.rwBack = () => { const G = D.rw; if (!G) return; G.step = G.step === 'lock' ? 'goal' : 'pick'; drawSheets(false); };
A.rwHoldHint = () => toast('Keep holding the button to lock it in.');
A.rwLock = () => {
  const G = D.rw; if (!G || rwActive()) return;
  const d = rwDraft(G), per = rwPeriod(G); if (!d.name || rwLockedOut(d)) return;
  const r = Object.assign(d, { id: uid(), kind: G.kind, start: dayStart(dayNum(now())), end: per[2], lockedAt: now(), state: 'locked' });
  if (G.kind === 'weight') { const c = rwWeightCheck(G, per[2]); if (!c.ok) { G.step = 'goal'; drawSheets(false); return; } r.fromKg = Math.round(c.from * 10) / 10; r.toKg = Math.round(c.to * 10) / 10; }
  else { r.target = clamp(G.target, 1, rwSpan(per[2])); r.spare0 = rwSpan(per[2]) - r.target; }
  const pt = rwPartner(r.url); r.code = pt ? pt.code : rwCode(G.code); r.off = r.code ? clamp(Math.round(pt ? pt.off : +G.off || 0), 0, 90) : 0; r.partner = !!pt;
  rewards().push(r); addActivity({ icon: 'lock', text: 'You locked ' + r.name + ': ' + rwGoalTxt(r) + '.' }); S.ui.homeSeg = 'rewards'; S.ui.tab = 'home'; D.rw = null;
  closeAll(); save(); render();
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { }
  toast('Locked. ' + r.name + ' is yours if you make it.', 'lock');
};
// Press and hold: a lock should take a moment of meaning it.
let _hold = null;
function holdEnd() { if (_hold) { clearTimeout(_hold.t); _hold.b.classList.remove('holding'); _hold = null; } }
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('[data-hold]'); if (!b || b.disabled) return;
  holdEnd(); b.classList.add('holding');
  _hold = { b: b, t: setTimeout(() => { const fn = A[b.dataset.hold]; holdEnd(); if (fn) fn(b); }, 1300) };
});
document.addEventListener('pointerup', holdEnd);
document.addEventListener('pointercancel', holdEnd);

/* ---- after it is locked ---- */
A.rwOpts = el => {
  const id = el.dataset.id; D.rwQuit = false;
  openSheet(() => {
    const r = rewards().find(x => x.id === id); if (!r || r.state !== 'locked') return '';
    return sheetHead('Give up?') + '<div class="sh-b"><div class="rw-goal">' + ic('target', 18) + '<b>' + esc(r.name) + ': ' + rwGoalTxt(r) + '</b></div>' +
      '<p class="mute">Giving up counts as a miss. You do not get it, and you cannot lock this item again for 30 days.</p>' +
      '<button class="btn btn-line btn-w rw-quit" data-a="rwQuit" data-id="' + id + '">' + (D.rwQuit ? 'Tap again to give up for good' : 'Give up on this reward') + '</button><button class="btn btn-ink btn-w" data-a="closeSheet">Keep going</button></div>';
  });
};
A.rwQuit = el => {
  const r = rewards().find(x => x.id === el.dataset.id); if (!r || r.state !== 'locked') return;
  if (!D.rwQuit) { D.rwQuit = true; drawSheets(false); return; }
  const p = rwProg(r); r.state = 'quit'; r.doneAt = now(); r.got = p.kind === 'gym' ? p.done : null; D.rwQuit = false;
  closeAll(); save(); render(); toast('Reward given up');
};
function rwCelebrate(r) {
  r.seen = true; save();
  S.ui.homeSeg = 'rewards';
  openSheet(() => sheetHead('You earned it') + '<div class="sh-b rw-win"><div class="rw-burst">' + rwImg(r, 'rw-big') + '<span>' + ic('check', 26) + '</span></div>' +
    '<h3>' + esc(r.name) + '</h3>' + rwSealBox(r) + '<p class="mute">' + (r.kind === 'gym' ? plural(r.got || r.target, 'gym day') + ' since ' + rwDate(r.start) + '. You said you would, and you did.' : 'You reached ' + wShow(r.toKg) + ' ' + wUnit() + '. You said you would, and you did.') + '</p>' +
    rwBuyBtn(r) + '</div>', { onClose: () => { if (S.ui.tab === 'home') render(); } });
}
A.rwBought = el => { const r = rewards().find(x => x.id === el.dataset.id); if (!r) return; r.bought = now(); save(); render(); toast('Enjoy it. Lock the next one while it is fresh.', 'trophy'); };

// Twice a day, look at the store again: has the price moved, is your size still there?
function rwWatch() {
  const r = rwCurrent(); if (!r || r.sample || !rwHttps(r.url) || !(appNative() || window.__rwWatch) || now() - (r.checked || 0) < 12 * HOUR) return;
  r.checked = now();
  rwLookup(r.url).then(p => {
    if (!p) return;
    const v = p.variants.find(x => x.title === r.size) || (p.variants.length === 1 ? p.variants[0] : null); if (!v) return;
    const was = [r.priceNow, r.inStock]; r.priceNow = v.price > 0 ? v.price : r.priceNow; r.inStock = v.ok;
    save(); if (was[0] !== r.priceNow || was[1] !== r.inStock) softRefresh();
  }).catch(() => { });
}
A.rwAck = el => { const r = rewards().find(x => x.id === el.dataset.id); if (r) { r.ack = true; save(); render(); } };
// What is sealed inside, money set aside, and what the store says today.
function rwExtras(r) {
  const bits = []; if (r.code && r.state === 'locked') bits.push(ic('sparkle', 13) + rwOffTxt(r) + ' waiting when you finish');
  if (r.seal && r.state === 'locked') bits.push(ic('lock', 13) + 'Something is sealed inside');
  if (r.aside && r.state === 'locked') bits.push(ic('dollar', 13) + esc(rwMoney(r.price, r.cur)) + ' set aside for it');
  if (r.state === 'locked' || (r.state === 'won' && !r.bought)) {
    if (r.inStock === false) bits.push(ic('info', 13) + (r.size ? 'Size ' + esc(r.size) + ' is' : 'It is') + ' sold out right now');
    if (r.priceNow > 0 && Math.abs(r.priceNow - r.price) >= .5) bits.push(ic('trend', 13) + 'Now ' + esc(rwMoney(r.priceNow, r.cur)) + (r.priceNow < r.price ? ', down from ' : ', up from ') + esc(rwMoney(r.price, r.cur)));
  }
  return bits.length ? '<span class="rw-x">' + bits.map(b => '<span>' + b + '</span>').join('') + '</span>' : '';
}
function rwSealBox(r) {
  const code = r.code && r.state !== 'won' && !r.partner ? 'Code: ' + r.code + (r.off ? ' (' + r.off + '% off)' : '') : '', txt = [r.seal, code].filter(Boolean).join('\n');
  return txt ? '<div class="rw-sealbox"><small>' + ic('lock', 13) + 'You sealed this inside</small><p>' + esc(txt) + '</p></div>' : '';
}
A.rwSealOpen = el => {
  const r = rewards().find(x => x.id === el.dataset.id); if (!r || (!r.seal && !(r.code && !r.partner) && r.state !== 'won')) return;
  const at = r.state === 'won' ? 0 : (r.doneAt || r.end) + RW_OUT;
  if (at > now()) { toast('Sealed until ' + rwDate(at) + '.', 'lock'); return; }
  openSheet(() => sheetHead(r.name) + '<div class="sh-b">' + (r.state === 'won' ? rwCover(r) + '<p class="mute">Earned ' + rwDate(r.doneAt) + (r.kind === 'gym' ? ' with ' + plural(r.got || r.target, 'gym day') : '') + '.</p>' : '') + rwSealBox(r) + '</div>');
};
// After a check-in: how far along the reward is now.
function rwDoneLine() {
  const r = rwActive(); if (!r || r.kind !== 'gym' || r.pausedAt) return '';
  const p = rwProg(r); if (!p.todayDone) return '';
  const mark = [[.75, 'Three quarters there'], [.5, 'Halfway'], [.25, 'A quarter of the way']].find(m => (p.done - 1) / r.target < m[0] && p.frac >= m[0]);
  return '<button class="rw-done" data-a="rwGo">' + rwCover(r) + '<span><b>' + (p.hit ? 'That is the goal' : mark ? mark[1] + ': ' + p.done + ' of ' + r.target : 'Gym day ' + p.done + ' of ' + r.target) + '</b><small>' +
    (p.hit ? esc(r.name) + ' is yours.' : p.need + ' to go for your ' + esc(r.name) + '.') + '</small></span>' + ic('chevR', 18) + '</button>';
}
A.rwGo = () => { closeAll(); if (S.ui.tab === 'cam' && A.camClose) A.camClose(); S.ui.tab = 'home'; S.ui.homeSeg = 'rewards'; save(); render(); $('#view').scrollTop = 330; };
// On Home's Today card: the reward you are working towards, one tap from its tab.
function rwTodayRow() {
  const r = rwCurrent(); if (!r) return '';
  const p = rwProg(r);
  const sub = r.state === 'won' ? 'Earned. Tap to get it.' : r.pausedAt ? 'Paused' : p.kind === 'gym' ? (p.spare < 0 ? 'Out of reach this time' : p.need + ' to go, ' + plural(p.daysLeft, 'day') + ' left') : wShow(p.gap) + ' ' + wUnit() + ' to go, ' + plural(p.daysLeft, 'day') + ' left';
  return '<button class="td-row td-rw" data-a="homeSeg" data-k="rewards">' + rwCover(r) + '<span class="grow"><b>' + esc(r.name) + '</b><small>' + sub + '</small></span><span class="td-go">' + ic('chevR', 18) + '</span></button>';
}

/* ---- reminders ----
   At most one a day, and only when it would change something: a piece waiting, spare days
   nearly gone, the last few days. They follow the streak reminder switch in Settings. */
function rwNotes() {
  const r = rwActive(), out = []; if (!r || r.sample || r.pausedAt || !(S.settings.remind && S.settings.remind.closing)) return out;
  const p = rwProg(r), at = (day, h) => dayStart(day) + h * HOUR, today = dayNum(now()), endDay = dayNum(r.end), used = {};
  const add = (id, when, body) => { const d = dayNum(when); if (when > now() + 2 * MIN && when < r.end && !used[d]) { used[d] = 1; out.push({ id: id, at: realTime(when), title: r.name, body: body }); } };
  if (p.kind === 'gym') {
    if (p.need > 0 && p.spare >= 0) {
      if (!p.todayDone && p.spare <= 2) add('spare', at(today, 18), p.spare === 0 ? 'No spare days left. A gym day today keeps it in reach.' : plural(p.spare, 'spare day') + ' left. A gym day today keeps it safe.');
      if (p.need === 1) add('last', at(p.todayDone ? today + 1 : today, 9), 'One more gym day and it is yours.');
      add('three', at(endDay - 2, 9), p.need + ' gym ' + (p.need === 1 ? 'day' : 'days') + ' to go and 3 days left.');
    }
  } else if (!p.hit) add('weigh', at(endDay - 2, 9), '3 days left. Log your weight to see where you stand.');
  return out;
}
let _rwNoteKey = '';
function rwRemindSync() {
  const h = appNative(); if (!h || !S || !S.checkins) return;
  const items = rwNotes(), key = JSON.stringify(items.map(x => [x.id, Math.round(x.at / 60000), x.body]));
  if (key === _rwNoteKey) return; _rwNoteKey = key;
  h.postMessage({ op: 'notes', items: items }).catch(() => { });
}
setTimeout(rwRemindSync, 2500);
setInterval(rwRemindSync, 60000);
