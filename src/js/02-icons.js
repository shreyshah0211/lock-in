const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  bowl: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M10 3.5c0 2-1.6 2-1.6 4M14.5 3.5c0 2-1.6 2-1.6 4"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2a5.6 5.6 0 0 1 3.5 5.3"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevL: '<path d="M14.5 5 8 12l6.5 7"/>',
  chevR: '<path d="M9.5 5 16 12l-6.5 7"/>',
  chevD: '<path d="M5 9.5 12 16l7-6.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  comment: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  share: '<path d="M12 15V4M8 7.5 12 4l4 3.5"/><path d="M6 12v7.5h12V12"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  flip: '<path d="M4.5 9.5a8 8 0 0 1 14-2.5M19.5 14.5a8 8 0 0 1-14 2.5"/><path d="M19 3.5V7h-3.5M5 20.5V17h3.5"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.5-4 3.5 3 2.5-2 3.5 3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  drop: '<path d="M12 3.5c3 3.8 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.5-6.2 5.5-10z"/>',
  dumbbell: '<path d="M8 7.5v9M5 9.5v5M16 7.5v9M19 9.5v5M8 12h8M3 12h2M19 12h2"/>',
  pass: '<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6z"/><path d="M10 9.5v5M14 9.5v5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  send: '<path d="M20 4 3.5 10.5l6.5 2.5 2.5 6.5z"/><path d="m10 13 4-4"/>',
  pencil: '<path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19z"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  pin: '<path d="M12 21c4-4.5 6.5-7.6 6.5-11a6.5 6.5 0 0 0-13 0c0 3.4 2.5 6.5 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  sparkle: '<path d="M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z"/><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V6a2 2 0 0 1 2-2h8"/>',
  download: '<path d="M12 4v11M8 11.5l4 3.5 4-3.5M5 19.5h14"/>',
  trend: '<path d="M4 16l5-5 3.5 3.5L20 7"/><path d="M15 7h5v5"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 12h8"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2.5h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  crown: '<path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.2"/>',
  hourglass: '<path d="M7 4h10M7 20h10M8 4c0 4.5 8 4.5 8 8s-8 3.5-8 8M16 4c0 4.5-8 4.5-8 8s8 3.5 8 8"/>',
  trash: '<path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  moon: '<path d="M19 14.5A8 8 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  dollar: '<path d="M12 3.5v17M16 7.5c-.6-1.3-2-2-4-2-2.3 0-4 1.1-4 3 0 4.3 8.300 2 8.300 6.300 0 1.900-1.800 3.200-4.300 3.200-2.200 0-3.900-.9-4.500-2.500"/>',
  wave: '<path d="M3 12c2.500 0 2.500-4 5-4s2.500 8 5 8 2.500-8 5-8 2.500 4 3 4"/>'
};
const FLAME = '<path d="M12 23c-4.400 0-8-3.300-8-7.600 0-3 1.700-5.100 3.400-7.100C9 6.400 10.600 4.600 11 1.500c3 1.800 5 4.600 5.300 7.600.800-.6 1.400-1.600 1.600-2.800C19.800 8.500 20 11.600 20 15.400c0 4.300-3.600 7.600-8 7.600z"/>';

function ic(name, size, cls) {
  const s = size || 22;
  return '<svg class="' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
}
function flame(size, color) {
  const s = size || 16;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true"' + (color ? ' style="color:' + color + '"' : '') + '><g fill="currentColor">' + FLAME + '</g><path fill="#fff" fill-opacity=".55" d="M12 20.600c-2 0-3.500-1.500-3.500-3.400 0-1.600 1-2.600 1.900-3.700.700-.8 1.300-1.700 1.600-3 1.900 1.400 3.500 3.600 3.500 6.400 0 2.100-1.500 3.700-3.500 3.700z"/></svg>';
}
