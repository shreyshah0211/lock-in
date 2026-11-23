/* Rendering plumbing: one view per tab, a stack of sheets above it, and
   click handling through data-a attributes. */
const A = {};        // actions by name
const VIEWS = {};    // tab -> html
const D = {};        // drafts for open forms
const sheets = [];
const scrollPos = {};
let curTab = null;

function render() {
  const v = $('#view');
  if (curTab) scrollPos[curTab] = v.scrollTop;
  if (S.ui.tab === 'food') { S.ui.tab = 'you'; S.ui.youSeg = 'food'; }   // Food lives inside You now
  if (!VIEWS[S.ui.tab]) S.ui.tab = 'home';
  const tab = S.ui.tab;
  $('#phone').classList.toggle('cam-on', tab === 'cam');
  $('#phone').classList.toggle('dark-top', tab === 'home');   // Home's dark clock runs up into the status bar
  v.innerHTML = (VIEWS[tab] || VIEWS.home)();
  v.scrollTop = curTab === tab ? scrollPos[tab] || 0 : (tab === 'home' ? scrollPos.home || 0 : 0);
  curTab = tab;
  if (tab === 'cam') { camAttach(); camStart(); } else camStop();
  renderTabs(); renderRail();
  live(); globeMini();
}
// The camera button: always in the middle, always the same. The ring around it is your clock.
function snapInfo() {
  const m = S.me, alive = pAlive(m), left = leftMs(), rep = !alive && canRepair();
  const urgent = alive && left < 6 * HOUR;
  return { alive: alive, left: left, urgent: urgent, rep: rep, frac: alive ? clamp(left / WINDOW, 0, 1) : 0, color: alive ? timeColor(left) : rep ? '#E8321F' : '#B4B9C9',
    label: urgent ? fmtLeftShort(left) + ' left' : rep ? 'Save streak' : 'Snap' };
}
const NAV = [['home', 'home', 'Home'], ['you', 'user', 'You']];
function renderTabs() {
  const t = S.ui.tab, si = snapInfo(), C = 2 * Math.PI * 34;
  const tabBtn = it => '<button data-a="tab" data-tab="' + it[0] + '"' + (t === it[0] ? ' aria-current="page"' : '') + '>' + ic(it[1], 23) + '<span>' + it[2] + '</span></button>';
  // phone: Home, the camera, You
  $('#tabs').innerHTML = '<div class="tabbar">' + tabBtn(NAV[0]) + '<span class="snap-lbl' + (si.urgent || si.rep ? ' warn' : '') + '">' + si.label + '</span>' + tabBtn(NAV[1]) + '</div>' +
    '<button class="snap' + (si.urgent || si.rep ? ' urgent' : '') + '" data-a="goCam" aria-label="Camera: gym, lift or food">' +
    '<svg class="snap-ring" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="34" fill="none" stroke="rgba(18,22,43,.1)" stroke-width="4"/><circle cx="38" cy="38" r="34" fill="none" stroke="' + si.color + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (si.frac * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 38 38)"/></svg>' +
    '<span class="snap-core">' + ic('camera', 28) + '</span></button>' ;
  // computer: the same places down the side, with words next to everything
  const sd = $('#side'); if (!sd) return;
  const m = S.me, days = pDays(m);
  sd.innerHTML = '<button class="side-logo" data-a="tab" data-tab="home" aria-label="Lock In home">' + wordmark() + '</button>' +
    '<div class="side-nav">' + NAV.map(it => '<button data-a="tab" data-tab="' + it[0] + '"' + (t === it[0] ? ' aria-current="page"' : '') + '>' + ic(it[1], 22) + '<span>' + it[2] + '</span></button>').join('') + '</div>' +
    '<button class="btn btn-go side-snap' + (si.urgent || si.rep ? ' urgent' : '') + '" data-a="goCam">' + ic('camera', 22) + 'Snap a photo</button>' +
    '<button class="btn btn-line side-say" data-a="openSay" data-k="auto">' + ic('mic', 20) + 'Say it</button>' +
    '<p class="side-clock"><span class="dot" style="background:' + si.color + '"></span>' + (si.alive ? '<span><b data-live="left">' + fmtLeft(si.left) + '</b> left on your clock</span>' : si.rep ? '<span>Snap a gym photo to save your streak</span>' : '<span>Snap a gym photo to start a streak</span>') + '</p>' +
    '<div class="side-foot"><button data-a="openFriends">' + ic('users', 20) + '<span>Friends</span></button><button data-a="openSettings">' + ic('gear', 20) + '<span>Settings</span></button>' +
    '<div class="side-me">' + av(m, 38, { plain: true }) + '<span><b>' + esc(m.name) + '</b><small>' + flameTxt(days) + '</small></span></div></div>';
}
function flameTxt(days) { return days > 0 ? days + ' day streak' : 'No streak yet'; }
function openSheet(fn, opts) { sheets.push(Object.assign({ render: fn }, opts || {})); drawSheets(true); }
function closeSheet() { const s = sheets.pop(); if (s && s.onClose) s.onClose(); drawSheets(false); }
function closeAll() { while (sheets.length) { const s = sheets.pop(); if (s.onClose) s.onClose(); } drawSheets(false); }
function drawSheets(animateTop) {
  const L = $('#layer'), topEl = L.querySelector('.sheet:last-of-type'), keep = topEl ? topEl.scrollTop : 0;
  L.innerHTML = sheets.map((s, i) => {
    const still = !(animateTop && i === sheets.length - 1) ? ' still' : '';
    return '<div class="scrim' + still + '" data-a="closeSheet"></div><div class="sheet ' + (s.cls || '') + still + '" role="dialog" aria-modal="true">' + s.render() + '</div>';
  }).join('');
  const nt = L.querySelector('.sheet:last-of-type');
  if (nt && !animateTop) nt.scrollTop = keep;
  if (sheets.length) { const s = sheets[sheets.length - 1]; if (s.after) s.after(nt, s); }
}
function refresh() { render(); drawSheets(false); }
// Redraw only when nothing is being typed, so background events never steal focus.
function softRefresh() {
  const ae = document.activeElement;
  if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
  refresh();
}
function sheetHead(title, opts) {
  opts = opts || {};
  return '<div class="grab"></div><div class="sh-h">' + (opts.back ? '<button class="icon-btn" data-a="closeSheet" aria-label="Back">' + ic('chevL') + '</button>' : '') + '<h2>' + esc(title) + '</h2>' + (opts.right || '') + (opts.back ? '' : '<button class="icon-btn" data-a="closeSheet" aria-label="Close">' + ic('x') + '</button>') + '</div>';
}
function toast(msg, icon) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = (icon ? ic(icon, 18) : '') + '<span>' + esc(msg) + '</span>';
  box.appendChild(t);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}
function setPath(o, path, val) { const ks = path.split('.'); for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] || (o[ks[i]] = {}); o[ks[ks.length - 1]] = val; }
function getPath(o, path) { return path.split('.').reduce((a, k) => a == null ? a : a[k], o); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-m]'); if (!el) return;
  setPath(D, el.dataset.m, el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value);
  if (el.dataset.on && A[el.dataset.on]) A[el.dataset.on](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheets.length) closeSheet();
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter && A[e.target.dataset.enter]) { e.preventDefault(); A[e.target.dataset.enter](e.target, e); }
});

A.tab = el => { S.ui.tab = el.dataset.tab; closeAll(); render(); save(); };
A.closeSheet = () => closeSheet();
A.noop = () => { };

/* ---- shared parts ---- */
function av(p, size, opts) {
  opts = opts || {};
  const s = size || 44, left = pLeft(p), alive = pAlive(p), days = pDays(p), frac = alive ? clamp(left / WINDOW, 0, 1) : 0, C = 2 * Math.PI * 46;
  let ring = '';
  if (!opts.plain) {
    ring = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="' + (opts.dark ? '#2D3763' : alive ? '#DCDDD5' : '#C4C7D0') + '" stroke-width="6"' + (alive ? '' : ' stroke-dasharray="3 8"') + '/>' +
      (alive ? '<circle cx="50" cy="50" r="46" fill="none" stroke="' + timeColor(left, opts.dark) + '" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="' + (frac * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(' + (-90 + (1 - frac) * 360).toFixed(1) + ' 50 50)"/>' : '') + '</svg>';
  }
  const urgent = alive && left < 6 * HOUR && !opts.plain && !opts.nowarn;
  return '<span class="av' + (opts.plain ? ' plain' : '') + '" style="--s:' + s + 'px;--c:' + p.color + '">' + ring + '<i>' + esc(initials(p.name)) + '</i>' + (urgent ? '<span class="warn">' + ic('hourglass', 10) + '</span>' : '') + '</span>';
}
function avPlain(name, color, size) { return '<span class="av plain" style="--s:' + (size || 40) + 'px;--c:' + color + '"><i>' + esc(initials(name)) + '</i></span>'; }
function streakChip(days, size) {
  return '<span class="streak ' + tierCls(days) + '"' + (size ? ' style="font-size:' + size + 'px"' : '') + '>' + flame(size ? size * .85 : 15) + '<span style="color:var(--iron)">' + days + '</span></span>';
}
function dial(size, left, days, opts) {
  opts = opts || {};
  const lit = left > 0 ? Math.ceil(clamp(left / WINDOW, 0, 1) * 48) : 0, urgent = left > 0 && left < 6 * HOUR;
  const col = opts.color || timeColor(left, true), dim = opts.dim || 'rgba(255,255,255,.14)';
  let t = '';
  for (let i = 0; i < 48; i++) {
    const on = i >= 48 - lit, major = i % 12 === 0;
    t += '<line x1="50" y1="' + (major ? 3 : 4.6) + '" x2="50" y2="12.4" transform="rotate(' + (i * 7.5) + ' 50 50)" stroke="' + (on ? col : dim) + '" stroke-width="' + (major ? 2.7 : 2.1) + '" stroke-linecap="round"/>';
  }
  return '<div class="dial"' + (opts.id ? ' id="' + opts.id + '"' : '') + ' style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' + t + '</svg><div class="mid">' + (opts.mid || '') + '</div></div>';
}
function wordmark() {
  // The O is the 48-hour clock: a ring with the time already used shown in orange.
  return '<span class="wordmark" aria-label="Lock In">L<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.7" fill="none" stroke="currentColor" stroke-width="4.4"/><path d="M12 3.3a8.7 8.7 0 0 1 7.530 13.050" fill="none" stroke="#FF5A1F" stroke-width="4.4"/></svg>CK<span class="gap"></span>IN</span>';
}
function imgOf(o) {
  // a real photo when there is one, else the drawn scene, or the workout card when there was no photo at all
  const ph = o.photo && photoSrc(o.photo); if (ph) return ph;
  return o.scene.stat ? statURI(o.scene.stat) : sceneURI(o.scene.kind, o.scene.seed);
}
function bar(frac, color) { return '<div class="bar"><i style="width:' + (clamp(frac, 0, 1) * 100).toFixed(1) + '%' + (color ? ';background:' + color : '') + '"></i></div>'; }
function sw(on, action, attrs) { return '<button class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-a="' + action + '" ' + (attrs || '') + '></button>'; }

/* numbers that tick every second without redrawing the screen */
function live() {
  const m = S.me, alive = pAlive(m), rep = alive ? 0 : repairLeft(), left = alive ? leftMs() : rep, lc = leftClock(left);
  $$('[data-live="left"]').forEach(el => { el.textContent = alive ? fmtLeft(left) : '0h'; });
  $$('[data-live="clock"]').forEach(el => { el.textContent = lc[0]; });
  $$('[data-live="clocklbl"]').forEach(el => { el.textContent = lc[1]; });
  const d = $('#me-dial');
  if (d && (alive || rep > 0)) {
    const lit = Math.ceil(clamp(left / WINDOW, 0, 1) * 48), col = alive ? timeColor(left, true) : '#FF5347';
    $$('line', d).forEach((l, i) => { const want = i >= 48 - lit ? col : 'rgba(255,255,255,.14)'; if (l.getAttribute('stroke') !== want) l.setAttribute('stroke', want); });
  }
}

/* The user card: who someone is, their streak and tier, how much time they
   have left, and their last two weeks, all in one glance. */
function userCard(p) {
  const me = p.id === 'me', alive = pAlive(p), days = pDays(p), left = pLeft(p), today = dayNum(now()), dp = me ? dayPts() : null;
  let sq = '', n = 0;
  for (let d = today - 13; d <= today; d++) { const lv = me ? level(dp[d] || 0) : Math.max(0, friendLevel(p, d)); if (lv > 0) n++; sq += '<i class="l' + lv + '"></i>'; }
  return '<section class="ucard"><div class="uc-top">' + av(p, 68, { dark: true, nowarn: true }) +
    '<div class="uc-id"><b>' + esc(p.name) + '</b>' + (me ? '<span>@' + esc(p.handle) + '</span>' : '') + '<span>' + esc(p.campus) + ', trains at ' + esc(p.gym) + '</span></div>' +
    '<div class="uc-streak ' + tierCls(days) + '"><span class="uc-n">' + flame(24) + '<span class="num">' + days + '</span></span><small>day streak</small></div></div>' +
    '<div><div class="uc-lbl"><span>Last 14 days</span><span>' + n + ' with a check-in</span></div><div class="uc-days">' + sq + '</div></div>' +
    '<div class="uc-foot">' + (alive ? '<span style="color:' + timeColor(left, true) + '">' + (me ? '<span data-live="left">' + fmtLeft(left) + '</span>' : fmtLeft(left)) + ' left</span><div class="bar"><i style="width:' + (clamp(left / WINDOW, 0, 1) * 100).toFixed(1) + '%;background:' + timeColor(left, true) + '"></i></div>'
      : '<span>' + (p.lost ? 'Streak ended at ' + plural(p.lost.days, 'day') : 'No streak right now') + '</span><div class="bar"><i style="width:0"></i></div>') + '<span class="pill">Best ' + Math.max(p.best || 0, days) + '</span></div></section>';
}
