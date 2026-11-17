/* Things only the iPhone app can do, through its "app" message handler
   (ios/LockIn/AppBridge.swift): Apple Maps for the gyms, and streak reminders.
   In a browser the map falls back to the Apple Maps website and reminders are off. */
function appNative() { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.app || null; } catch (e) { return null; } }

// Apple Maps, centred on one gym, with every gym friends trained at as a pin.
A.mapApple = el => {
  const focus = el && el.dataset.n, places = mapPlaces(), h = appNative();
  const p = places.find(x => x.name === focus) || places[0]; if (!p) return;
  if (h) { h.postMessage({ op: 'map', focus: p.name, places: places.map(x => ({ name: x.name, city: x.city, lat: x.lat, lon: x.lon, count: x.people.length })) }).catch(() => { }); return; }
  window.open('https://maps.apple.com/?ll=' + p.lat + ',' + p.lon + '&q=' + encodeURIComponent(p.name) + '&z=16', '_blank');
};

// Streak reminders: 12, 3 and 1 hour before the clock runs out. Rescheduled whenever the clock changes.
let _remindKey = '';
function remindSync() {
  const h = appNative(); if (!h) return;
  const on = !!(S.settings.remind && S.settings.remind.closing) && pAlive(S.me);
  const due = on ? realTime(deadline()) : 0, days = pDays(S.me);
  const key = on + ':' + Math.round(due / 60000) + ':' + days; if (key === _remindKey) return;
  _remindKey = key;
  h.postMessage({ op: 'remind', on: on, deadline: due, days: days }).then(ok => { if (on && ok === false && !S.ui.remindDenied) { S.ui.remindDenied = true; save(); } }).catch(() => { });
}
setTimeout(remindSync, 1500);
setInterval(remindSync, 60000);

// Speech to text in the iPhone app, shaped like Claude's dictation so the Say it sheet uses it as is.
function nativeDictation() {
  const h = appNative(); if (!h) return null;
  const L = { partial: [], final: [], state: [] };
  window.__speech = e => { if (e && L[e.type]) L[e.type].forEach(f => f(e)); };
  const fail = c => { L.state.forEach(f => f({ state: 'idle', reason: c })); const x = new Error(c); x.code = c; return x; };
  return {
    onPartial: f => L.partial.push(f), onFinal: f => L.final.push(f), onState: f => L.state.push(f),
    start: () => { L.state.forEach(f => f({ state: 'starting' })); return h.postMessage({ op: 'listen' }).then(ok => { if (!ok) throw fail('unavailable'); }, err => { throw fail((err && err.message) || 'unavailable'); }); },
    stop: () => h.postMessage({ op: 'listenStop' })
  };
}
