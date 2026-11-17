'use strict';
const HOUR = 36e5, DAY = 24 * HOUR, WINDOW = 48 * HOUR, MIN = 6e4;
let S = null; // app state, set in state.js

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const fmtN = n => Math.round(n).toLocaleString('en-US');
const uid = () => Math.random().toString(36).slice(2, 10);

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => a + r() * (b - a);

function now() { return Date.now() + (S ? S.offset : 0); }
function dayNum(ts) { return Math.floor((ts - new Date(ts).getTimezoneOffset() * MIN) / DAY); }
function dayStart(n) { const d = new Date(n * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime(); }
// The food day rolls over at 4 AM so a late dinner still counts for the day it belongs to.
function foodDay(ts) { return dayNum(ts - 4 * HOUR); }

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtLeft(ms) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / HOUR), m = Math.floor(ms % HOUR / MIN), s = Math.floor(ms % MIN / 1e3);
  if (h >= 1) return h + 'h ' + pad2(m) + 'm';
  return m + 'm ' + pad2(s) + 's';
}
function fmtLeftShort(ms) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / HOUR);
  return h >= 1 ? h + 'h' : Math.max(1, Math.floor(ms / MIN)) + 'm';
}
function ago(ts) {
  const d = now() - ts;
  if (d < MIN) return 'just now';
  if (d < HOUR) return Math.floor(d / MIN) + ' min ago';
  if (d < DAY) return Math.floor(d / HOUR) + 'h ago';
  if (d < 2 * DAY) return 'yesterday';
  const dt = new Date(ts);
  if (d < 7 * DAY) return WD[dt.getDay()];
  return MO[dt.getMonth()] + ' ' + dt.getDate();
}
function clock(ts) {
  const d = new Date(ts); let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; return h + ':' + pad2(m) + ' ' + ap;
}
function dateLong(ts) { const d = new Date(ts); return WD[d.getDay()] + ', ' + MO[d.getMonth()] + ' ' + d.getDate(); }
function whenBy(ts) {
  const dn = dayNum(ts) - dayNum(now());
  const day = dn === 0 ? 'today' : dn === 1 ? 'tomorrow' : WD[new Date(ts).getDay()];
  return day + ' at ' + clock(ts);
}
function initials(name) { const p = name.trim().split(/\s+/); return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
function first(name) { return name.trim().split(/\s+/)[0]; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : /s$/.test(w) ? 'es' : 's'); }
function listNames(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
