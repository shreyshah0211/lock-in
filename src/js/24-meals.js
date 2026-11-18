/* Easier meal fixes. Say what to change instead of typing it, and swipe a meal
   on the Food tab to edit or delete it. */

/* ---- say what to change ----
   Uses whichever microphone this page has: the iPhone app's own, Claude's dictation,
   or the browser's. Where there is none, the keyboard's microphone does the listening. */
let _mealRec = null;
A.mealMic = () => {
  const d = D.meal; if (!d || d.busy) return;
  const k = voiceKind();
  if (k === 'claude') {
    if (d.listening) { VOICE.d.stop().catch(() => { }); return; }
    VOICE.target = 'meal'; d.listening = true; d.hint = ''; drawSheets(false);
    VOICE.d.start().catch(err => { const c = err && err.code; mealVoice('state', '', 'idle', c || 'unavailable'); });
  } else if (k === 'web') {
    if (_mealRec) { try { _mealRec.stop(); } catch (e) { } return; }
    let rec; try { rec = new VOICE.sr(); } catch (e) { mealKeyboard(); return; }
    rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; mealVoice(e.results[e.results.length - 1].isFinal ? 'final' : 'partial', t); };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') VOICE.off = true; };
    rec.onend = () => { _mealRec = null; mealVoice('state', '', 'idle', VOICE.off ? 'not_granted' : 'stopped'); };
    _mealRec = rec; d.listening = true; d.hint = ''; drawSheets(false);
    try { rec.start(); } catch (e) { _mealRec = null; d.listening = false; mealKeyboard(); }
  } else mealKeyboard();
};
function mealKeyboard() { const d = D.meal; if (d) { d.listening = false; drawSheets(false); } const i = $('#ml-hint'); if (i) i.focus(); toast('Tap the microphone on your keyboard and say what to change.'); }
// Words as they arrive, then a fresh estimate as soon as you stop talking.
function mealVoice(kind, text, state, reason) {
  const d = D.meal; if (!d) { VOICE.target = 'say'; return; }
  if (kind === 'partial' || kind === 'final') {
    d.hint = text; const i = $('#ml-hint'); if (i) i.value = text; return;
  }
  if (state !== 'idle') return;
  d.listening = false; VOICE.target = 'say';
  if (reason === 'not_granted' || reason === 'unavailable') { VOICE.off = reason === 'not_granted'; drawSheets(false); toast(reason === 'not_granted' ? 'Lock In does not have the microphone. Turn it on in Settings, or type the change.' : 'The microphone is not available right now. Type the change instead.'); return; }
  if (String(d.hint || '').trim()) A.mealRefine(); else { drawSheets(false); if (reason === 'no_speech') toast('Did not catch that. Tap the microphone and try again.'); }
}

/* ---- edit a logged meal ---- */
A.mealEdit = el => {
  const m = S.meals.find(x => x.id === el.dataset.id); if (!m) return;
  closeAll(); swipeClose(); D.snap = null;
  D.meal = { editId: m.id, photo: m.photo || null, img: m.img || null, art: m.art || { kind: 'bowl', seed: 3 }, text: m.name, name: m.name, kcal: m.kcal, p: m.p, c: m.c, f: m.f,
    base: { kcal: m.kcal, p: m.p, c: m.c, f: m.f, fib: m.fib, na: m.na, ml: m.ml || 0 }, items: [], size: 1, slot: m.slot, state: 'edit', conf: '', hint: '', nums: true, busy: false, typed: true };
  openSheet(mealSheet, { cls: 'full', onClose: () => { if (D.meal && D.meal.editId) D.meal = null; } });
};
A.mealDel = el => {
  const id = el.dataset.id, m = S.meals.find(x => x.id === id); if (!m) return;
  swipeClose();
  S.meals = S.meals.filter(x => x.id !== id); (S.gone || (S.gone = {}))[id] = now(); save(); refresh();
  toast(m.name + ' removed (' + fmtN(m.kcal) + ' kcal)', 'trash');
};

/* ---- swipe a meal row ----
   Drag left to show Edit and Delete. Vertical scrolling still works, and only one row is open at a time. */
const SW = { el: null, x0: 0, y0: 0, dx: 0, open: null, axis: null, id: null };
const SW_W = 152;
function swipeRow(row) { return row && row.closest('.mswipe'); }
function swipeSet(el, x, anim) { const r = el.querySelector('.meal'); if (!r) return; r.style.transition = anim ? 'transform .22s ease' : 'none'; r.style.transform = x ? 'translateX(' + x + 'px)' : ''; el.classList.toggle('open', x < 0); }
function swipeClose() { if (SW.open) { swipeSet(SW.open, 0, true); SW.open = null; } }
document.addEventListener('pointerdown', e => {
  const el = swipeRow(e.target); if (!el || e.target.closest('.mswipe-acts')) { if (SW.open && !e.target.closest('.mswipe-acts')) swipeClose(); return; }
  if (SW.open && SW.open !== el) swipeClose();
  SW.el = el; SW.x0 = e.clientX; SW.y0 = e.clientY; SW.dx = 0; SW.axis = null; SW.id = e.pointerId; SW.start = el.classList.contains('open') ? -SW_W : 0;
});
document.addEventListener('pointermove', e => {
  if (!SW.el || e.pointerId !== SW.id) return;
  const dx = e.clientX - SW.x0, dy = e.clientY - SW.y0;
  if (!SW.axis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; SW.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
  if (SW.axis !== 'x') { SW.el = null; return; }
  SW.dx = dx; swipeSet(SW.el, clamp(SW.start + dx, -SW_W - 30, 0), false);
});
document.addEventListener('pointerup', e => {
  if (!SW.el || e.pointerId !== SW.id) return;
  const el = SW.el; SW.el = null;
  if (SW.axis !== 'x') return;
  const open = SW.start + SW.dx < -SW_W / 2;
  swipeSet(el, open ? -SW_W : 0, true); SW.open = open ? el : null;
  if (open && !S.ui.swipeSeen) { S.ui.swipeSeen = true; save(); const tip = $('.sw-tip'); if (tip) tip.remove(); }
  SW.justSwiped = Date.now();   // a swipe is not a tap on the meal
});
document.addEventListener('pointercancel', () => { if (SW.el) { swipeSet(SW.el, SW.start, true); SW.el = null; } });
// Stop the click that ends a swipe from opening the meal.
document.addEventListener('click', e => { if (SW.justSwiped && Date.now() - SW.justSwiped < 350 && swipeRow(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
