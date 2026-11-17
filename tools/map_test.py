# The globe on Home and the map it opens into: it turns, it unrolls into a flat map, each tap on a dot goes
# deeper (region, city, gym), and it only ever shows friends you follow at the gym of a posted check-in.
import pathlib, json, os
from playwright.sync_api import sync_playwright
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
root = pathlib.Path(__file__).resolve().parent.parent; url = 'file://' + str(root/'dist/index.html')
fails = []
def check(name, got, want):
    ok = got == want
    print(('ok  ' if ok else 'FAIL'), name, '->', json.dumps(got)[:200], '' if ok else ' (wanted ' + json.dumps(want) + ')')
    if not ok: fails.append(name)
def page(pw, **kw):
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(**(kw or dict(pw.devices['iPhone 14'])))
    pg = ctx.new_page(); pg.set_default_timeout(4000); pg.errs = []
    pg.on('console', lambda m: pg.errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.errs.append('pageerror: ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(700); pg.evaluate('closeAll()'); pg.wait_for_timeout(100)
    return b, pg
INK = "(() => { const c = document.querySelector('%s'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 0; i < d.length; i += 16) { if (d[i + 3] > 20) n++; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; } return [n, h]; })()"
def dot(pg, name):
    xy = pg.evaluate("(() => { const h = M.hits.find(h => h.group && h.name === '%s'), r = document.querySelector('#map-cv').getBoundingClientRect(); return h ? [r.left + h.x, r.top + h.y] : null; })()" % name)
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(1400)
def dots(pg): return pg.evaluate("M.hits.filter(h => h.group).map(h => [h.name, h.group.n]).sort()")

with sync_playwright() as pw:
    b, pg = page(pw); ev = pg.evaluate
    # the outlines
    check('no outline jumps across the date line', ev("geo().land.every(r => { for (let i = 1; i < r.n; i++) if (Math.abs(r.mx[i] - r.mx[i - 1]) > .5 && !(r.sl[i] === -1 && r.sl[i - 1] === -1)) return false; return true; })"), True)
    check('shapes that cross the date line are drawn on both sides', ev("geo().east.length + geo().west.length >= 3"), True)
    # the card on Home
    ev("document.querySelector('.gcard').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
    check('Home card counts friends and gyms', pg.locator('.gcard .gc-t span').inner_text(), '11 friends at 3 gyms in the last 48 hours')
    a = ev(INK % '#mini-globe'); pg.wait_for_timeout(1500); c = ev(INK % '#mini-globe')
    check('the small globe is drawn and turning', [a[0] > 500, a[1] != c[1]], [True, True])
    # open: globe grows, unrolls, ends flat
    pg.locator('.gcard').click(); pg.wait_for_timeout(350)
    mid = ev("[M.t > 0 && M.t < 1 || M.t === 0, !!M.anim, document.querySelector('#map-ui').classList.contains('on')]")
    check('part-way through it is still unrolling, with no buttons yet', mid, [True, True, False])
    pg.wait_for_timeout(1500)
    check('it ends as a flat map with its buttons', ev("[M.t, M.anim, document.querySelector('#map-ui').classList.contains('on'), sheets.length]"), [1, None, True, 1])
    check('region level: Seattle as one dot, Pullman as another', dots(pg), [['Chinook Rec', 1], ['Seattle', 11]])
    z0 = ev('M.z')
    dot(pg, 'Seattle'); z1 = ev('M.z')
    check('tapping the dot goes deeper and lists who was there', [z1 > z0 + 1, ev('M.card.title'), pg.locator('.mc-list .row').count()], [True, 'Seattle', 11])
    dot(pg, 'Seattle'); z2 = ev('M.z')
    check('deeper again: the two Seattle gyms separate', [z2 > z1 + 1, [d for d in dots(pg) if d[0] != 'Chinook Rec']], [True, [['IMA', 10], ['Northlake Strength', 1]]])
    dot(pg, 'IMA')
    check('the gym itself: its name and the people who checked in there', [ev('M.card.title'), pg.locator('.mc-list .row').count(), pg.locator('.mc-list .row .t').first.inner_text() != ''], ['IMA, Seattle', 10, True])
    cardTop = ev("document.querySelector('#map-card').getBoundingClientRect().top"); xy = ev("(() => { const h = M.hits.find(h => h.group && h.name === 'IMA'); return [h.x, h.y]; })()")
    check('the dot sits clear of the card and the top bar', [xy[1] > 70, xy[1] < cardTop - 30], [True, True])
    zb = ev("(() => { const z = document.querySelector('.map-zoom').getBoundingClientRect(); return z.bottom; })()")
    check('the zoom buttons are clear of the card', zb < cardTop, True)
    check('the card says what it does not show', 'Never where anyone is right now' in pg.locator('#map-card').inner_text(), True)
    # only people you follow
    ids = ev("mapPlaces().reduce((a, p) => a.concat(p.people), [])")
    check('everyone on the map is you or someone you follow', ev("mapPlaces().every(p => p.people.every(id => id === 'me' || following().some(f => f.id === id)))"), True)
    who = [i for i in ids if i != 'me'][0]
    ev("S.friends.find(f => f.id === '%s').fol = false; mapCardShow(); mapKick()" % who); pg.wait_for_timeout(200)
    check('unfollowing someone takes them off the map', [who in ev("mapPlaces().reduce((a, p) => a.concat(p.people), [])"), pg.locator('.mc-list .row').count()], [False, 9])
    ev("S.friends.find(f => f.id === '%s').fol = true" % who)
    old = ev("(() => { const f = following().find(f => f.gym === 'Northlake Strength'); f.lastCheckin = now() - 49 * HOUR; return f.id; })()")
    check('a check-in older than 48 hours drops off', ev("mapPlaces().some(p => p.name === 'Northlake Strength')"), False)
    # a row opens that person
    pg.locator('.mc-list .row').first.click(); pg.wait_for_timeout(400)
    check('a row opens that person over the map', ev('sheets.length'), 2)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # drag, wheel, buttons
    mx = ev('M.mx'); pg.mouse.move(150, 250); pg.mouse.down(); pg.mouse.move(110, 230, steps=4); pg.mouse.up(); pg.wait_for_timeout(200)
    check('dragging pans without counting as a tap', [ev('M.mx') > mx, ev('!!M.card')], [True, True])
    z = ev('M.z'); pg.mouse.move(150, 250); pg.mouse.wheel(0, 300); pg.wait_for_timeout(200)
    check('the wheel zooms', ev('M.z') < z, True)
    pg.locator('[data-a="mapWorld"]').click(); pg.wait_for_timeout(1500)
    lim = ev("(() => { const cv = document.querySelector('#map-cv'), Wz = 256 * Math.pow(2, M.z), top = M.my - cv.clientHeight / 2 / Wz, bot = M.my + cv.clientHeight / 2 / Wz; return [Math.abs(M.z - mapZoomMin(cv.clientWidth, cv.clientHeight)) < 1e-6, top >= MAP_N - 1e-6, bot <= MAP_S + 1e-6, M.card]; })()")
    check('the whole-world button stops short of the poles and clears the card', lim, [True, True, True, None])
    xy = ev("(() => { const h = M.hits.find(h => h.else), r = document.querySelector('#map-cv').getBoundingClientRect(); return [r.left + h.x, r.top + h.y, h.else[0]]; })()")
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(1200)
    check('another campus shows a sample total, never people', [ev('M.card.else[0]') == xy[2], pg.locator('.mc-list .row').count(), 'sample total' in pg.locator('#map-card').inner_text()], [True, 0, True])
    # close: rolls back up
    pg.locator('[data-a="mapClose"]').click(); pg.wait_for_timeout(400)
    check('closing rolls it back into a globe', ev("[M.t < 1, sheets.length]"), [True, 1])
    pg.wait_for_timeout(1000)
    check('and it lands back on Home', ev("[sheets.length, S.ui.tab, M.t]"), [0, 'home', 0])
    pg.locator('.gcard').click(); pg.wait_for_timeout(500); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape part-way through closes cleanly', ev("[sheets.length, M.anim]"), [0, None])
    check('no errors', pg.errs, []); b.close()

    # with your own data: your own check-in appears; friends and campus totals are still samples, and say so
    b, pg = page(pw); ev = pg.evaluate
    ev("goReal()"); pg.wait_for_timeout(500); ev("closeAll(); S.ui.tab = 'home'; render()"); pg.wait_for_timeout(300)
    check('your own data: you are not on the map before you check in', [ev('S.mode'), ev("mapPlaces().some(p => p.me)")], ['real', False])
    ev("S.me.lastCheckin = now() - HOUR; render()"); pg.wait_for_timeout(200)
    check('your own data: a check-in puts you at your gym', ev("mapPlaces().filter(p => p.me).map(p => [p.name, p.people.includes('me')])"), [['IMA', True]])
    ev("S.me.gym = 'Some other gym'; render()")
    check('your own data: a gym the map does not know sits at your campus under its own name', ev("mapPlaces().filter(p => p.me).map(p => [p.name, p.city])"), [['Some other gym', 'Seattle']])
    ev("S.me.campus = 'Somewhere else'; render()")
    check('your own data: with no known gym or campus you are left off', ev("mapPlaces().some(p => p.me)"), False)
    pg.locator('.gcard').click(); pg.wait_for_timeout(1900); xy = ev("(() => { const h = M.hits.find(h => h.group), r = document.querySelector('#map-cv').getBoundingClientRect(); return [r.left + h.x, r.top + h.y]; })()")
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(1300)
    check('your own data: the card says friends are samples', 'Friends are still samples.' in pg.locator('#map-card').inner_text(), True)
    check('no errors with your own data', pg.errs, []); b.close()

    # reduced motion: no animation, straight to the flat map
    b, pg = page(pw, viewport={'width': 390, 'height': 844}, reduced_motion='reduce'); ev = pg.evaluate
    ev("document.querySelector('.gcard').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    a = ev(INK % '#mini-globe'); pg.wait_for_timeout(900); c = ev(INK % '#mini-globe')
    check('reduced motion: the small globe is drawn but still', [a[0] > 500, a[1] == c[1]], [True, True])
    pg.locator('.gcard').click(); pg.wait_for_timeout(250)
    check('reduced motion: opens flat at once', ev("[M.t, M.anim, document.querySelector('#map-ui').classList.contains('on')]"), [1, None, True])
    pg.locator('[data-a="mapClose"]').click(); pg.wait_for_timeout(200)
    check('reduced motion: closes at once', ev('sheets.length'), 0)
    check('no errors with reduced motion', pg.errs, []); b.close()

    # on a computer the map fills the app column
    b, pg = page(pw, viewport={'width': 1440, 'height': 900}); ev = pg.evaluate
    pg.locator('.gcard').click(); pg.wait_for_timeout(1900)
    inside = ev("(() => { const s = document.querySelector('#map-cv').getBoundingClientRect(), p = document.querySelector('#phone').getBoundingClientRect(); return [Math.round(s.left - p.left), Math.round(s.right - p.right), Math.round(s.top - p.top), Math.round(s.bottom - p.bottom)]; })()")
    check('computer: the map fills the app column exactly', [inside, ev('M.t')], [[0, 0, 0, 0], 1])
    check('no errors on a computer', pg.errs, []); b.close()
print('MAP ALL PASSED' if not fails else 'MAP FAILED: ' + ', '.join(fails))
