# Lock In on a phone, with your own data: start from zero, save to the account, and follow the same
# person across devices. The account store is simulated here: one Python dict shared by every "device".
import pathlib, json, sys, os
from playwright.sync_api import sync_playwright
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
root = pathlib.Path(__file__).resolve().parent.parent; url = 'file://' + str(root/'dist/index.html'); IMG = str(root/'tools/test.jpg')
DB = {}
MOCK = '''
window.__dbDelay = %d;
window.claude = { use: async (n) => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (n === 'user') return { id: async () => 'u_test', isOwner: async () => true };
  if (n !== 'db') return null;
  // like the real store: delivered data is deeply frozen, and a listener may first hand over an unconfirmed cached copy
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const snap = (path, j, cached) => ({ id: path.split('/').pop(), exists: j != null, data: () => j == null ? undefined : freeze(JSON.parse(j)), metadata: { fromCache: !!cached, hasPendingWrites: false } });
  const doc = path => ({ id: path.split('/').pop(), path,
    get: async () => { await wait(window.__dbDelay); return snap(path, await window.__dbGet(path)); },
    set: async data => { await wait(60); await window.__dbSet(path, JSON.stringify(data)); },
    onSnapshot: (next) => { let last; next(snap(path, null, true)); const t = setInterval(async () => { await wait(window.__dbDelay); const j = await window.__dbGet(path); if (j !== last) { last = j; next(snap(path, j)); } }, 250); return () => clearInterval(t); },
    collection: sub => col(path + '/' + sub) });
  const col = path => ({ path, doc: id => doc(path + '/' + id) });
  return { doc, collection: col };
} };
'''
CORE = 'data/users/u_test/core'
fails = []
def check(name, got, want):
    ok = got == want
    print(('ok  ' if ok else 'FAIL'), name, '->', json.dumps(got)[:170], '' if ok else ' (wanted ' + json.dumps(want) + ')')
    if not ok: fails.append(name)
def core(): return json.loads(DB[CORE]) if CORE in DB else None
def device(pw, browser, kind, delay=40):
    opts = dict(pw.devices['iPhone 14']) if kind == 'phone' else dict(viewport={'width': 1280, 'height': 800})
    ctx = browser.new_context(**opts)
    ctx.expose_function('__dbGet', lambda p: DB.get(p))
    # the real store hands keys back in its own order; sorting them here proves the app does not depend on it
    ctx.expose_function('__dbSet', lambda p, j: DB.__setitem__(p, json.dumps(json.loads(j), sort_keys=True)))
    ctx.add_init_script(MOCK % delay)
    pg = ctx.new_page(); pg.set_default_timeout(4000); pg.errs = []
    pg.on('console', lambda m: pg.errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.errs.append('pageerror: ' + str(e)))
    pg.on('filechooser', lambda fc: None)
    return pg
def vis(pg, sel): pg.locator(sel).locator('visible=true').first.click()
OV = "(() => { const v=document.querySelector('%s'); const vr=v.getBoundingClientRect(); return [...v.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.right>vr.right+1 && !e.closest('.frow') && !e.closest('.hscroll') && !e.closest('.gated')}).length; })()"   # a gated photo is blurred and scaled inside a clipped box
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    A = device(pw, b, 'phone'); ev = A.evaluate
    def shot(pg, n): pg.screenshot(path=str(root/'shots'/f'phone-{n}.png'))
    A.goto(url); A.wait_for_timeout(700); shot(A, '00-intro')
    check('phone: first run opens the intro on sample data', ev("[S.mode, sheets.length, FRESH, document.querySelectorAll('.dots i').length]"), ['sample', 1, True, 4])
    for _ in range(3): vis(A, '[data-a="introNext"]'); A.wait_for_timeout(150)
    vis(A, '[data-a="introStep"][data-k="kcal"][data-d="100"]'); shot(A, '01-targets')
    vis(A, '[data-a="introReal"]'); A.wait_for_timeout(900); shot(A, '02-camera')
    check('start my own streak: empty, on the camera, targets kept', ev("[S.mode, S.ui.tab, S.checkins.length, S.meals.length, S.goals.kcal, pAlive(S.me), S.offset]"), ['real', 'cam', 0, 0, 2500, False, 0])
    check('no sample photos once the data is yours', ev("document.querySelectorAll('[data-a=camSample]').length"), 0)
    check('saved to the account straight away', [core() is not None, core() and len(core()['checkins']), ev("SYNC.state")], [True, 0, 'on'])
    # every screen works with nothing in it
    for t in ['home', 'ch', 'food', 'you']:
        ev("S.ui.tab = '%s'; render()" % t); A.wait_for_timeout(120); shot(A, '03-empty-' + t)
        check('empty %s tab fits the phone' % t, ev(OV % '#view'), 0)
    check('empty charts say what unlocks them', ev("document.querySelectorAll('#view .thresh').length"), 3)
    # a real photo becomes day 1
    vis(A, '.tabbar [data-tab="home"]'); vis(A, '[data-a="goCam"]'); A.wait_for_timeout(200); A.set_input_files('#cam-input', IMG); A.wait_for_timeout(1300)
    vis(A, '[data-a="snapPick"][data-k="gym"]'); A.wait_for_timeout(500); shot(A, '04-composer')
    check('composer fits the phone', ev(OV % '#layer .sheet:last-of-type'), 0)
    vis(A, '[data-a="ciPost"]'); A.wait_for_timeout(1700); shot(A, '05-day1')
    key = ev("S.checkins[0].photo")
    check('first photo starts the streak', ev("[S.checkins.length, pDays(S.me), S.posts[0].uid, S.me.passes]"), [1, 1, 'me', 2])
    A.wait_for_timeout(600)
    check('check-in and its photo are in the account', [len(core()['checkins']), core()['me']['streakStart'] is not None, (CORE + '/photos/' + key) in DB], [1, True, True])
    vis(A, '.done [data-a="closeSheet"]'); A.wait_for_timeout(200); shot(A, '06-home')
    vis(A, '.tabbar [data-tab="food"]'); vis(A, '.food-acts [data-a="openSay"]'); A.wait_for_timeout(200)
    check('fields are 16px so the phone does not zoom', ev("getComputedStyle(document.querySelector('#say-text')).fontSize"), '16px')
    A.fill('#say-text', 'two eggs and toast'); vis(A, '#say-go'); A.wait_for_timeout(500); shot(A, '07-meal'); vis(A, '[data-a="mealLog"]'); A.wait_for_timeout(900); shot(A, '08-food')
    check('meal logged and saved', [ev("S.meals.length"), len(core()['meals'])], [1, 1])
    check('photos can be tapped on a phone', ev("(S.ui.tab = 'home', render(), getComputedStyle(document.querySelector('.shot')).cursor)"), 'pointer')
    # the same person on a laptop: nothing saved there, yet everything arrives
    B = device(pw, b, 'laptop'); B.goto(url); B.wait_for_timeout(1500); B.screenshot(path=str(root/'shots/phone-09-laptop.png'))
    check('laptop: picks up the account with no intro', B.evaluate("[S.mode, S.checkins.length, S.meals.length, sheets.length, pDays(S.me), S.posts.some(p => p.uid === 'me')]"), ['real', 1, 1, 0, 1, True])
    B.wait_for_timeout(700)
    check('laptop: the check-in photo arrives', B.evaluate("!!PHOTOS['%s']" % key), True)
    B.evaluate("A.openGoals()"); B.fill('#gl-p', '150'); vis(B, '[data-a="saveGoals"]'); B.wait_for_timeout(900)
    check('laptop: data from the account can be changed, and the change reaches the phone', [B.evaluate("S.goals.p"), core()['goals']['p'], ev("S.goals.p")], [150, 150, 150])
    n = len(DB); B.wait_for_timeout(1200)
    check('two open devices do not keep rewriting the account', [len(DB), B.evaluate("SYNC.seen === SYNC.sent"), ev("SYNC.seen === SYNC.sent")], [n, True, True])
    B.evaluate("S.ui.tab = 'food'; render()"); vis(B, '[data-a="mealAgain"]'); A.wait_for_timeout(1500)
    check('a meal logged on the laptop shows on the phone', [ev("S.meals.length"), len(core()['meals'])], [2, 2])
    # both devices log at the same moment: nothing is lost
    ev("A.mealAgain({dataset:{id:S.meals[0].id}})"); B.evaluate("A.mealAgain({dataset:{id:S.meals[0].id}})"); A.wait_for_timeout(2500)
    check('logged on both at once: both keep all four', [ev("S.meals.length"), B.evaluate("S.meals.length"), len(core()['meals'])], [4, 4, 4])
    B.evaluate("A.delMeal({dataset:{id:S.meals[3].id}})"); A.wait_for_timeout(1800)
    check('a removed meal stays removed everywhere', [ev("S.meals.length"), B.evaluate("S.meals.length"), len(core()['meals'])], [3, 3, 3])
    # Safari clears the page's storage: the next open brings it all back
    ev("localStorage.clear()"); A.reload(); A.wait_for_timeout(1600); shot(A, '10-restored')
    check('cleared browser: restored from the account', ev("[S.mode, S.checkins.length, S.meals.length, sheets.length, pDays(S.me)]"), ['real', 1, 3, 0, 1])
    # a slow connection must never let an empty device overwrite the account
    C = device(pw, b, 'phone', delay=2500); C.goto(url); C.wait_for_timeout(400)
    C.evaluate("D.intro = 3; drawSheets(false)"); vis(C, '[data-a="introReal"]'); C.wait_for_timeout(300)
    check('slow account: the button waits', C.evaluate("[S.mode, !!document.querySelector('[data-a=introReal][disabled]')]"), ['sample', True])
    C.wait_for_timeout(3200)
    check('slow account: existing data opens, nothing overwritten', [C.evaluate("[S.mode, S.checkins.length, S.meals.length]"), len(core()['checkins']), len(core()['meals'])], [['real', 1, 3], 1, 3])
    # a device left on the sample offers the saved data
    C.evaluate("A.goSample(); S.ui.pinSample = false; SYNC.state = 'offer'; render()"); C.wait_for_timeout(300); C.screenshot(path=str(root/'shots/phone-11-offer.png'))
    check('sample device offers your own streak', C.evaluate("[S.mode, !!document.querySelector('[data-a=syncOpen]')]"), ['sample', True])
    vis(C, '[data-a="syncOpen"]'); C.wait_for_timeout(500)
    check('opening it brings the data in', C.evaluate("[S.mode, S.checkins.length]"), ['real', 1])
    # settings say where the data lives; erase takes two taps and reaches every device
    ev("A.openSettings()"); A.wait_for_timeout(250); shot(A, '12-settings')
    check('settings: saved to the account, no time-skip tools', ev("[document.querySelector('.sheet .card p').textContent.slice(0, 29), !!document.querySelector('.sheet [data-a=skip]')]"), ['Saved to your Claude account.', False])
    vis(A, '[data-a="eraseMine"]'); A.wait_for_timeout(150)
    check('erase asks twice', ev("[S.checkins.length, document.querySelector('[data-a=eraseMine]').textContent]"), [1, 'Tap again to erase everything'])
    vis(A, '[data-a="eraseMine"]'); A.wait_for_timeout(2200)
    check('erase empties the account and the other devices', [ev("S.checkins.length"), len(core()['checkins']), len(core()['meals']), core()['epoch'] > 0, B.evaluate("[S.checkins.length, S.meals.length]")], [0, 0, 0, True, [0, 0]])
    for name, pg in [('phone', A), ('laptop', B), ('slow phone', C)]: check('no errors on the ' + name, pg.errs[:3], [])
    b.close()
print('PHONE FAILED: ' + ', '.join(fails) if fails else 'PHONE ALL PASSED'); sys.exit(1 if fails else 0)
