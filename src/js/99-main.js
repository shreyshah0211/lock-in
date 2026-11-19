/* The right-hand panel on a computer, and start-up. On a phone the same
   things live on Home, Food and You. */
function renderRail() {
  const r = $('#rail'); if (!r) return;
  const m = S.me, alive = pAlive(m), left = leftMs(), days = pDays(m), ws = weekStats(), rep = !alive && canRepair();
  let h = '';
  if (S.ui.tab !== 'home' && S.ui.tab !== 'cam') h += '<section class="rcard dark"><div class="rc-h">' + flame(20, '#FF8A1E') + '<b class="num">' + days + '</b><span>day streak</span></div>' +
    (alive ? '<p><b data-live="left">' + fmtLeft(left) + '</b> left on your clock</p><div class="bar"><i style="width:' + (clamp(left / WINDOW, 0, 1) * 100).toFixed(1) + '%;background:' + timeColor(left, true) + '"></i></div>' : '<p>' + (rep ? 'A gym photo in the next ' + fmtLeftShort(repairLeft()) + ' brings your streak back.' : 'A gym photo starts a new streak.') + '</p>') +
    '<button class="btn btn-go btn-w" data-a="goCam">' + ic('camera', 20) + 'Snap a photo</button></section>';
  if (S.ui.tab !== 'food') h += '<section class="rcard"><div class="rc-t"><h2>Food today</h2><button class="link" data-a="openFood">Open Food</button></div>' + nutritionBar(foodDay(now()), false) + '</section>';
  if (S.ui.tab !== 'you') h += '<section class="rcard"><div class="rc-t"><h2>Workouts this week</h2><button class="link" data-a="tab" data-tab="you">See progress</button></div>' +
    '<div class="rc-stat"><span><b class="num">' + ws.n + '</b> of ' + ws.goal + ' check-ins</span><span><b class="num">' + ws.pts + '</b> effort points</span></div>' + bar(ws.n / ws.goal, 'var(--go)') + '</section>';
  h += S.mode === 'real' ? '<section class="rcard plain"><h2>This is your own data</h2><p>Your streak, check-ins, meals and lifts are yours' + (SYNC.state === 'on' ? ' and are saved to your Claude account' : '') + '. Friends, squads and rewards are still samples.</p><div class="rowb"><button class="btn btn-line btn-s" data-a="openIntro">How it works</button><button class="btn btn-line btn-s" data-a="openSettings">Your data</button></div></section>'
    : '<section class="rcard plain"><h2>This is a working prototype</h2><p>Friends and their posts are sample data. What you do here is saved in this browser only. Use these to see how the clock behaves.</p>' +
    '<div class="rowb"><button class="btn btn-ink btn-s" data-a="skip" data-h="6">Skip 6 hours</button><button class="btn btn-ink btn-s" data-a="skip" data-h="24">Skip 24 hours</button></div>' +
    '<div class="rowb"><button class="btn btn-line btn-s" data-a="openIntro">How it works</button><button class="btn btn-line btn-s" data-a="resetDemo">Start over</button></div></section>';
  r.innerHTML = h;
}

function boot() {
  loadState(); initAI(); initVoice(); initMCP(); initSync(); camProbe();
  document.addEventListener('touchstart', () => { }, { passive: true });   // lets iPhone show pressed states
  if (S.ui.tab === 'cam') S.ui.tab = 'home';   // never reopen on the camera
  $('#cam-input').addEventListener('change', onCamFile);
  $('#pick-input').addEventListener('change', onCamFile);
  tick(); refreshDetected(); render();
  if (S.ui.coach) A.openIntro();   // first visit: three screens, then the camera
  let urgent = pAlive(S.me) && leftMs() < 6 * HOUR, alive = pAlive(S.me), n = 0;
  setInterval(() => {
    const had = !!S.detected; refreshDetected();
    const ch = tick() || had !== !!S.detected, a = pAlive(S.me), u = a && leftMs() < 6 * HOUR;
    if (ch || u !== urgent || a !== alive) { urgent = u; alive = a; softRefresh(); }
    else if (++n % 30 === 0) { renderTabs(); renderRail(); }
    live();
  }, 1000);
  // Leaving the app turns the camera off; coming back to the camera screen turns it on again.
  document.addEventListener('visibilitychange', () => { if (document.hidden) camStop(); else { tick(); softRefresh(); if (S.ui.tab === 'cam') camStart(); } });
}
boot();
