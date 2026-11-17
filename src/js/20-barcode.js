/* Barcode. Scan a packaged food and log it with the label's own numbers, which
   beat any photo estimate. The product comes from Open Food Facts, a free open
   database; Claude then reads it against your goals for today.

   Where the scan happens depends on where the page runs:
   - inside the iPhone app, the app's own camera scanner (ios/LockIn/FoodScanner.swift);
   - anywhere else, you type the number printed under the bars.
   The lookup goes through the app when it can, and straight to Open Food Facts otherwise. */
function foodNative() { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.food || null; } catch (e) { return null; } }
const BC = { can: null };
async function bcCanScan() {
  if (BC.can !== null) return BC.can;
  const h = foodNative(); if (!h) return (BC.can = false);
  try { BC.can = !!(await h.postMessage({ op: 'canScan' })); } catch (e) { BC.can = false; }
  return BC.can;
}
async function bcLookup(code) {
  const h = foodNative();
  if (h) {
    try { return JSON.parse(await h.postMessage({ op: 'product', code: code })); }
    catch (e) { const x = new Error('lookup'); x.code = (e && e.message) || 'offline'; throw x; }
  }
  let r;
  try { r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=code,product_name,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments,nutriscore_grade,nova_group,additives_tags,allergens_tags,ingredients_text,image_front_small_url'); }
  catch (e) { const x = new Error('lookup'); x.code = 'offline'; throw x; }
  const j = await r.json().catch(() => null);
  if (!j || j.status !== 1 || !j.product) { const x = new Error('lookup'); x.code = 'not_found'; throw x; }
  return j.product;
}

// The parts of an Open Food Facts product the app uses, per 100 g (or ml) and per serving.
function bcShape(p, code) {
  const n = p.nutriments || {}, v = k => { const x = +n[k]; return isFinite(x) ? x : null; };
  const per100 = { kcal: v('energy-kcal_100g'), p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g'), fib: v('fiber_100g'), sug: v('sugars_100g'), sat: v('saturated-fat_100g'), na: v('sodium_100g') };
  if (per100.kcal == null && v('energy_100g') != null) per100.kcal = v('energy_100g') / 4.184;   // some labels only give kJ
  const sq = +p.serving_quantity, unit = /ml/i.test(p.nutrition_data_per || '') || /ml|fl/i.test(p.serving_size || '') ? 'ml' : 'g';
  const tags = a => (Array.isArray(a) ? a : []).map(t => String(t).replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
  return {
    code: code, name: String(p.product_name || '').trim() || 'Unnamed product', brand: String(p.brands || '').split(',')[0].trim(), qty: p.quantity || '',
    serving: isFinite(sq) && sq > 0 ? { amt: Math.round(sq * 10) / 10, label: p.serving_size || '' } : null, unit: unit, per100: per100,
    nutri: /^[a-e]$/.test(p.nutriscore_grade || '') ? p.nutriscore_grade : null, nova: [1, 2, 3, 4].includes(+p.nova_group) ? +p.nova_group : null,
    additives: [...new Set(tags(p.additives_tags).map(t => t.toUpperCase()))], allergens: tags(p.allergens_tags), ingredients: String(p.ingredients_text || '').trim().slice(0, 1200),
    img: /^https:\/\//.test(p.image_front_small_url || '') ? p.image_front_small_url : null
  };
}
// How much of the product: grams (or ml) eaten.
function bcAmount(d) { return Math.max(0, +d.amt || 0); }
function bcTotals(d) {
  const k = bcAmount(d) / 100, x = d.prod.per100, r = (val, dp) => val == null ? null : Math.round(val * k * (dp || 1)) / (dp || 1);
  return { kcal: Math.round((x.kcal || 0) * k), p: r(x.p || 0, 1), c: r(x.c || 0, 1), f: r(x.f || 0, 1), fib: r(x.fib), sug: r(x.sug), sat: r(x.sat), na: x.na == null ? null : Math.round(x.na * k * 1000) };
}

const NUTRI_COL = { a: '#1E8F4E', b: '#7AC547', c: '#F2B30C', d: '#EE7A1B', e: '#D8311B' };
const NOVA_TXT = { 1: 'Unprocessed or minimally processed', 2: 'Processed culinary ingredient', 3: 'Processed food', 4: 'Ultra-processed food' };

/* ---- entry ---- */
A.scanBarcode = async () => {
  if (await bcCanScan()) {
    let code;
    try { code = await foodNative().postMessage({ op: 'scan' }); }
    catch (e) { const why = e && e.message; if (why === 'type' || why === 'unsupported') bcTypeSheet(); return; }
    if (code) bcOpen(String(code));
  } else bcTypeSheet();
};
function bcTypeSheet() {
  D.bcType = { code: '' };
  openSheet(() => sheetHead('Type the barcode') + '<div class="sh-b"><p class="mute">The number printed under the bars, usually 8, 12 or 13 digits.</p>' +
    '<div class="field"><label for="bc-code">Barcode number</label><input class="input" id="bc-code" inputmode="numeric" autocomplete="off" data-m="bcType.code" data-enter="bcTyped" placeholder="0 49000 02891 1"></div>' +
    '<button class="btn btn-ink btn-w" data-a="bcTyped">Look it up</button></div>', { after: el => { const i = el && el.querySelector('#bc-code'); if (i) i.focus(); } });
}
A.bcTyped = () => {
  const code = String((D.bcType && D.bcType.code) || '').replace(/\D/g, '');
  if (code.length < 6) { toast('That number looks too short. Check the digits under the bars.'); return; }
  closeSheet(); bcOpen(code);
};

/* ---- the product sheet ---- */
function bcOpen(code) {
  D.bc = { code: code, state: 'loading', prod: null, amt: 100, mode: 'serving', n: 1, slot: slotNow(), ai: null };
  const d = D.bc;
  openSheet(bcSheet, { cls: 'full', onClose: () => { if (D.bc === d) D.bc = null; } });
  bcLookup(code).then(p => {
    if (D.bc !== d) return;
    d.prod = bcShape(p, code); d.state = d.prod.per100.kcal == null ? 'nonum' : 'ok';
    if (d.prod.serving) { d.mode = 'serving'; d.amt = d.prod.serving.amt; } else { d.mode = 'grams'; d.amt = 100; }
    // Scanned before: start from the amount you ate last time.
    const last = S.meals.filter(m => m.code === code && m.amt).sort((a, b) => b.ts - a.ts)[0];
    if (last) { d.amt = last.amt; d.mode = 'grams'; if (d.prod.serving && Math.abs(last.amt / d.prod.serving.amt - Math.round(last.amt / d.prod.serving.amt * 2) / 2) < .01) { d.mode = 'serving'; d.n = Math.round(last.amt / d.prod.serving.amt * 2) / 2; } }
    drawSheets(false);
    if (d.state === 'ok') bcInsight(d);
  }).catch(e => { if (D.bc !== d) return; d.state = e && e.code === 'not_found' ? 'missing' : 'offline'; drawSheets(false); });
}
function bcSheet() {
  const d = D.bc; if (!d) return '';
  if (d.state === 'loading') return sheetHead('Scanned food', { back: true }) + '<div class="sh-b"><div class="aicheck"><span class="spin"></span>Looking up ' + esc(d.code) + '</div></div>';
  if (d.state === 'missing' || d.state === 'offline') {
    return sheetHead('Scanned food', { back: true }) + '<div class="sh-b"><div class="aicheck no">' + ic('info', 18) + '<span>' + (d.state === 'missing' ? 'Barcode ' + esc(d.code) + ' is not in the food database yet.' : 'Could not reach the food database. Check your connection and try again.') + '</span></div>' +
      '<p class="mute">You can snap the nutrition label instead, and Claude reads the numbers off it.</p>' +
      '<div class="two"><button class="btn btn-go" data-a="bcLabel">' + ic('camera', 20) + 'Snap the label</button><button class="btn btn-line" data-a="' + (d.state === 'offline' ? 'bcRetry' : 'scanBarcode') + '">' + ic('scan', 19) + (d.state === 'offline' ? 'Try again' : 'Scan again') + '</button></div></div>';
  }
  const p = d.prod, t = bcTotals(d), kc = S.ui.showKcal !== false;
  let h = sheetHead('Scanned food', { back: true }) + '<div class="sh-b">';
  h += '<div class="bc-top">' + (p.img ? '<img src="' + esc(p.img) + '" alt="">' : '<span class="bc-ph">' + ic('scan', 30) + '</span>') + '<div class="grow"><b>' + esc(p.name) + '</b><span class="mute">' + esc([p.brand, p.qty].filter(Boolean).join(', ')) + '</span>' +
    '<div class="chips bc-badges">' + (p.nutri ? '<span class="pill bc-ns" style="background:' + NUTRI_COL[p.nutri] + ';color:#fff">Nutri-Score ' + p.nutri.toUpperCase() + '</span>' : '') + (p.nova ? '<span class="pill' + (p.nova === 4 ? ' hot' : p.nova === 1 ? ' ok' : '') + '">NOVA ' + p.nova + '</span>' : '') + '</div></div></div>';
  if (d.state === 'nonum') return h + '<div class="aicheck no">' + ic('info', 18) + '<span>The database has this product but no nutrition numbers for it. Snap the label instead.</span></div><button class="btn btn-go btn-w" data-a="bcLabel">' + ic('camera', 20) + 'Snap the label</button></div>';

  h += '<div class="card mcard"><div class="mhead"><span class="mh-n"><b class="num">' + fmtN(t.kcal) + '</b>kcal</span><span class="mh-t">From the label</span></div>' +
    '<div class="mmac"><span><b>' + t.p + ' g</b>protein</span><span><b>' + t.c + ' g</b>carbs</span><span><b>' + t.f + ' g</b>fat</span></div></div>';

  // How much: servings when the label gives one, or grams.
  const u = p.unit;
  h += '<div class="field"><span class="lbl">How much did you have?</span>' + (p.serving ? '<div class="seg"><button data-a="bcMode" data-k="serving" aria-pressed="' + (d.mode === 'serving') + '">Servings</button><button data-a="bcMode" data-k="grams" aria-pressed="' + (d.mode === 'grams') + '">' + (u === 'ml' ? 'Millilitres' : 'Grams') + '</button></div>' : '');
  if (d.mode === 'serving' && p.serving) {
    h += '<div class="bc-step"><button class="icon-btn" data-a="bcStep" data-d="-0.5" aria-label="Half a serving less"' + (d.n <= .5 ? ' disabled' : '') + '>' + ic('minus', 20) + '</button><span><b class="num">' + d.n + '</b> ' + (d.n === 1 ? 'serving' : 'servings') + '<small>' + esc(p.serving.label || p.serving.amt + ' ' + u) + ' each</small></span><button class="icon-btn" data-a="bcStep" data-d="0.5" aria-label="Half a serving more">' + ic('plus', 20) + '</button></div>';
  } else {
    h += '<div class="send"><input class="input" id="bc-amt" type="number" inputmode="decimal" min="0" data-m="bc.amt" data-on="bcAmt" value="' + esc(d.amt) + '"><span class="bc-unit">' + u + '</span></div>' +
      '<div class="chips">' + [30, 50, 100, 150, 250].map(g => '<button class="chip" data-a="bcGrams" data-v="' + g + '" aria-pressed="' + (+d.amt === g) + '">' + g + ' ' + u + '</button>').join('') + '</div>';
  }
  h += '</div>';

  // How it fits today.
  const today = dayTotals(foodDay(now())), g = S.goals, leftK = g.kcal - today.kcal - t.kcal, leftP = g.p - today.p - t.p, dens = t.kcal > 0 ? t.p / t.kcal * 100 : 0;
  h += '<div class="card bc-fit"><div class="sec-h" style="margin:0 0 8px"><h2 class="h2" style="font-size:16px">After this, today</h2></div><div class="two">' +
    (kc ? '<div class="tile"><div class="k">Calories</div><div class="v">' + fmtN(Math.abs(Math.round(leftK))) + '<small>' + (leftK >= 0 ? 'left' : 'over') + '</small></div>' + bar((today.kcal + t.kcal) / g.kcal, 'var(--go)') + '</div>' : '') +
    '<div class="tile"><div class="k">Protein</div><div class="v">' + (leftP > 0 ? Math.round(leftP) + '<small>g to go</small>' : ic('check', 22) + '<small>goal hit</small>') + '</div>' + bar((today.p + t.p) / g.p, 'var(--protein)') + '</div></div>' +
    (t.kcal > 40 ? '<p class="mute" style="font-size:13px;margin-top:10px">' + (dens >= 10 ? ic('check', 14) + ' High protein: ' : '') + Math.round(dens * 10) / 10 + ' g protein per 100 kcal' + (dens >= 10 ? '.' : dens < 3 ? ', low for the calories.' : '.') + '</p>' : '') + '</div>';

  // Claude's read.
  h += bcInsightCard(d);

  // The detail.
  const row = (k, v) => v == null ? '' : '<div class="row" style="padding:9px 0"><div class="grow">' + k + '</div><b>' + v + '</b></div>';
  h += '<div class="card" style="padding:6px 16px"><div class="rows">' + row('Sugar', t.sug == null ? null : t.sug + ' g') + row('Saturated fat', t.sat == null ? null : t.sat + ' g') + row('Fibre', t.fib == null ? null : t.fib + ' g') + row('Sodium', t.na == null ? null : fmtN(t.na) + ' mg') +
    row('Processing', p.nova ? NOVA_TXT[p.nova] : null) + row('Additives', p.additives.length ? p.additives.length + '' : null) + '</div></div>';
  if (p.allergens.length) h += '<div class="aicheck no">' + ic('info', 18) + '<span>Contains ' + esc(p.allergens.join(', ')) + '</span></div>';
  if (p.ingredients) h += '<details class="bc-ing"><summary>Ingredients' + (p.additives.length ? ' and additives' : '') + '</summary><p>' + esc(p.ingredients) + '</p>' + (p.additives.length ? '<p class="mute">Additives: ' + esc(p.additives.join(', ')) + '</p>' : '') + '</details>';
  h += '<div class="field"><span class="lbl">Which meal</span><div class="chips">' + SLOTS.map(s => '<button class="chip" data-a="bcSlot" data-k="' + s[0] + '" aria-pressed="' + (d.slot === s[0]) + '">' + s[1] + '</button>').join('') + '</div></div>';
  h += '<p class="mute" style="font-size:12.5px">Product data from Open Food Facts, a free database anyone can add to. Check the numbers against the pack.</p>';
  return h + '</div><div class="sticky-cta"><button class="btn btn-go btn-w" data-a="bcLog"' + (t.kcal <= 0 && !bcAmount(d) ? ' disabled' : '') + '>Log ' + fmtN(t.kcal) + ' kcal</button></div>';
}
function bcInsightCard(d) {
  const a = d.ai;
  if (!a || a.state === 'off') return '';
  if (a.state === 'working') return '<div class="aicheck"><span class="spin"></span>Claude is reading the label</div>';
  if (a.state !== 'ok') return '';
  const r = a.r, li = (arr, icn) => arr.map(x => '<li>' + ic(icn, 15) + '<span>' + esc(x) + '</span></li>').join('');
  return '<div class="card bc-ai"><div class="bc-ai-h">' + ic('sparkle', 18) + '<b>' + esc(r.verdict) + '</b>' + (r.score ? '<span class="pill' + (r.score >= 7 ? ' ok' : r.score <= 4 ? ' hot' : '') + '">' + r.score + '/10 for you</span>' : '') + '</div>' +
    (r.good.length || r.watch.length ? '<ul class="bc-ai-l">' + li(r.good, 'check') + li(r.watch, 'info') + '</ul>' : '') +
    (r.swap ? '<p class="mute" style="font-size:13.5px;margin-top:8px"><b>Try instead:</b> ' + esc(r.swap) + '</p>' : '') + '</div>';
}
// Claude reads the product against today's numbers. Optional: the sheet works without it.
async function bcInsight(d) {
  d.ai = { state: 'working' }; drawSheets(false);
  const s = await getAI(); if (D.bc !== d) return;
  if (!s) { d.ai = { state: 'off' }; drawSheets(false); return; }
  const p = d.prod, x = p.per100, today = dayTotals(foodDay(now())), g = S.goals, body = S.body || {};
  const r1 = v => v == null ? 'unknown' : Math.round(v * 10) / 10;
  const facts = 'Product: ' + quoted([p.brand, p.name].filter(Boolean).join(' '), 120) + (p.qty ? ' (' + quoted(p.qty, 40) + ')' : '') + '. Per 100 ' + p.unit + ': ' + Math.round(x.kcal) + ' kcal, protein ' + r1(x.p) + ' g, carbs ' + r1(x.c) + ' g, sugar ' + r1(x.sug) + ' g, fat ' + r1(x.f) + ' g, saturated fat ' + r1(x.sat) + ' g, fibre ' + r1(x.fib) + ' g, sodium ' + (x.na == null ? 'unknown' : Math.round(x.na * 1000) + ' mg') + '. ' +
    (p.serving ? 'One serving is ' + quoted(p.serving.label || p.serving.amt + ' ' + p.unit, 40) + '. ' : '') + (p.nutri ? 'Nutri-Score ' + p.nutri.toUpperCase() + '. ' : '') + (p.nova ? 'NOVA group ' + p.nova + '. ' : '') +
    (p.additives.length ? 'Additives: ' + quoted(p.additives.join(', '), 200) + '. ' : '') + (p.ingredients ? 'Ingredients: "' + quoted(p.ingredients, 700) + '". ' : '');
  const me = 'The person lifts and tracks food in a gym habit app. Their daily goal is ' + g.kcal + ' kcal and ' + g.p + ' g protein' + (body.goal ? ', and they want to ' + ({ lose: 'lose fat', keep: 'maintain their weight', gain: 'build muscle' })[body.goal] : '') + '. So far today they have eaten ' + Math.round(today.kcal) + ' kcal and ' + Math.round(today.p) + ' g protein. ';
  try {
    const res = await s.json(facts + me + 'Give a short, honest read of this product for them, in plain words, speaking to them as "you". No medical claims and no moralising about food. ' +
      'Reply with only a JSON object like {"verdict": "Solid protein snack, light on sugar", "score": 7, "good": ["17 g protein per serving"], "watch": ["Sweetened with sucralose"], "swap": ""}. ' +
      '"verdict" is at most 8 words. "score" is 1 to 10 for how well it fits their goal. "good" and "watch" have at most 3 short points each, each under 12 words, drawn from the facts above. "swap" is one specific better-fitting alternative, or "" if this is already a good pick.', { modelTier: 'quick' });
    if (D.bc !== d) return;
    const arr = v => (Array.isArray(v) ? v : []).filter(z => typeof z === 'string' && z.trim()).slice(0, 3).map(z => z.trim().slice(0, 90));
    d.ai = res && typeof res.verdict === 'string' ? { state: 'ok', r: { verdict: res.verdict.slice(0, 70), score: num(res.score, 0, 10) || null, good: arr(res.good), watch: arr(res.watch), swap: typeof res.swap === 'string' ? res.swap.trim().slice(0, 120) : '' } } : { state: 'off' };
  } catch (e) { aiFail(e); if (D.bc === d) d.ai = { state: 'off' }; }
  if (D.bc === d) drawSheets(false);
}
A.bcRetry = () => { const d = D.bc; if (!d) return; closeSheet(); bcOpen(d.code); };
A.bcLabel = (el, e) => { closeAll(); D.bc = null; openCam('meal', e); };
A.bcMode = el => { const d = D.bc, p = d.prod; d.mode = el.dataset.k; if (d.mode === 'serving' && p.serving) d.amt = Math.round(p.serving.amt * d.n * 10) / 10; drawSheets(false); };
A.bcStep = el => { const d = D.bc, p = d.prod; d.n = clamp(Math.round((d.n + +el.dataset.d) * 2) / 2, .5, 20); d.amt = Math.round(p.serving.amt * d.n * 10) / 10; drawSheets(false); };
A.bcGrams = el => { D.bc.amt = +el.dataset.v; drawSheets(false); };
// Typing an amount redraws everything but the box being typed in.
A.bcAmt = () => { const ae = document.activeElement, pos = ae && ae.selectionStart; drawSheets(false); const i = $('#bc-amt'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { } } };
A.bcSlot = el => { D.bc.slot = el.dataset.k; drawSheets(false); };
A.bcLog = () => {
  const d = D.bc; if (!d || !d.prod) return;
  const t = bcTotals(d), p = d.prod, amt = bcAmount(d); if (!amt) { toast('Set how much you had first.'); return; }
  const name = (p.brand && p.name.toLowerCase().indexOf(p.brand.toLowerCase()) < 0 ? p.brand + ' ' : '') + p.name;
  S.meals.push({ id: uid(), ts: now(), name: name.slice(0, 60), kcal: t.kcal, p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f), fib: t.fib == null ? null : Math.round(t.fib), na: t.na == null ? null : round10(t.na),
    slot: d.slot, art: { kind: 'bowl', seed: 3 }, photo: null, img: p.img, src: 'barcode', est: false, code: p.code, amt: amt });
  checkBadges();
  D.bc = null; S.ui.foodOff = 0; S.ui.tab = 'food'; scrollPos.food = 0; closeAll(); save(); render();
  toast(fmtN(t.kcal) + ' kcal and ' + Math.round(t.p) + ' g protein added to today', 'check');
};
