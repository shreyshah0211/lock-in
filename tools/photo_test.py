# Real photo through the one-button camera: with Claude and connectors mocked, without them, and with a live camera.
import pathlib, json, sys
from playwright.sync_api import sync_playwright
import os; CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')   # set CHROME to your own Chrome or Chromium
root = pathlib.Path(__file__).resolve().parent.parent; url = 'file://' + str(root/'dist/index.html'); IMG = str(root/'tools/test.jpg')
MOCK = '''
window.__cal = []; window.__imgs = 0; window.__calls = []; window.__snapKind = 'gym'; window.__screen = false; window.__inputs = [];
window.claude = { use: async (n) => {
  if (n === 'mcp') return { callTool: async (server, tool, args) => { if (window.__calFail) { const e = new Error('x'); e.code = window.__calFail; throw e; } window.__cal.push([server, tool, args]); return { content: [] }; } };
  if (n !== 'sample') return null;
  const fn = async () => ({ text: 'ok', truncated: false });
  fn.json = async (input, opts) => {
    await new Promise(r => setTimeout(r, 300));
    window.__imgs += (opts && opts.images) ? opts.images.length : 0; window.__inputs.push(input);
    const meal = { name: 'Paneer rice bowl', calories: 612, protein_g: 28, carbs_g: 74, fat_g: 21, fiber_g: 6, sodium_mg: 804, items: [{name:'rice', calories: 240},{name:'paneer', calories: 260}], confidence: 'medium' };
    if (input.includes('weekly note')) { window.__calls.push('note'); return { note: 'Four days running, then two off. Put the easy day in the middle next week.' }; }
    if (input.includes('one camera button for everything')) { window.__calls.push('snap'); const k = window.__snapKind; return k === 'gym' ? { kind: 'gym', workout: 'legs', note: 'squat rack and plates', screen: window.__screen } : k === 'food' ? Object.assign({ kind: 'food' }, meal) : { kind: 'other' }; }
    if (input.includes('outside check-in')) { window.__calls.push('outsidecheck'); return { gym: window.__outsideOk !== false, workout: 'other', note: 'rec centre entrance' }; }
    if (input.includes('gym habit app')) { window.__calls.push('gymcheck'); return { gym: false, workout: 'other', note: 'a plate of food' }; }
    if (input.includes('next 3 sessions')) { window.__calls.push('plan'); return [{focus:'Pull',why:'Nine days since your last pull day.'},{focus:'Cardio',why:'An easy day between lifts.'},{focus:'Legs',why:'Back to legs once you have recovered.'}]; }
    window.__calls.push('meal'); return Object.assign({ food: true }, meal);
  };
  fn.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 2e7, mediaTypes: ['image/jpeg','image/png'] } });
  return fn;
} };
'''
fails = []
def check(tag, name, got, want):
    ok = got == want
    print(('ok  ' if ok else 'FAIL'), tag, name, '->', json.dumps(got)[:200], '' if ok else ' (wanted ' + json.dumps(want) + ')')
    if not ok: fails.append(tag + ' ' + name)
def vis(pg, sel): pg.locator(sel).locator('visible=true').first.click()
def go(pw, mock):
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2); pg = ctx.new_page(); pg.set_default_timeout(4000)
    errs=[]
    pg.on('console', lambda m: errs.append('console: '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    if mock: pg.add_init_script(MOCK)
    tag = 'ai  ' if mock else 'noai'; ev = pg.evaluate
    def shot(n): pg.screenshot(path=str(root/'shots'/f'ph-{tag.strip()}-{n}.png'))
    def snap(): vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); pg.wait_for_timeout(250); pg.set_input_files('#cam-input', IMG); pg.wait_for_timeout(1500)
    pg.goto(url); pg.wait_for_timeout(500); ev('closeAll()')
    check(tag, 'camera falls back when no live camera', ev("(A.goCam(), new Promise(r => setTimeout(() => r([cam.live, !!document.querySelector('#cam-video')]), 400)))"), [False, False]); ev("A.camClose()")
    if mock:
        # a gym photo is recognised in one call and lands in the check-in
        snap(); shot('0-gym')
        check(tag, 'gym photo -> check-in', ev("[D.snap && D.snap.kind, D.ci && D.ci.ai, D.ci && D.ci.type, D.ci && D.ci.note, window.__imgs, window.__calls.join()]"), ['gym', 'ok', 'legs', 'squat rack and plates', 1, 'snap'])
        vis(pg, '[data-a="snapAs"][data-k="food"]'); pg.wait_for_timeout(900); shot('1-switched-meal')
        check(tag, 'switch to meal runs a meal estimate', ev("[D.snap.kind, D.snap.manual, D.meal && D.meal.state, D.meal && D.meal.kcal, window.__calls.join()]"), ['food', True, 'ai', 610, 'snap,meal'])
        vis(pg, '[data-a="snapAs"][data-k="gym"]'); pg.wait_for_timeout(500)
        check(tag, 'switch back reuses the first look', ev("[D.ci && D.ci.ai, window.__calls.join()]"), ['ok', 'snap,meal'])
        vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1700)
        check(tag, 'posted and verified', ev("[S.posts[0].uid, S.posts[0].verified, D.snap, S.ui.tab, S.posts[0].proof]"), ['me', True, None, 'home', 'photo'])
        vis(pg, '.done [data-a="calGo"]'); pg.wait_for_timeout(500)
        check(tag, 'calendar event sent to connector', ev("[window.__cal[0][0], window.__cal[0][1], Object.keys(window.__cal[0][2]).sort().join()]"), ['Google Calendar', 'create_event', 'availability,description,endTime,overrideReminders,startTime,summary'])
        vis(pg, '.done [data-a="closeSheet"]'); pg.wait_for_timeout(300)
        # food
        before = ev("dayTotals(foodDay(now())).kcal"); ev("window.__snapKind='food'; window.__calls=[]"); snap(); shot('2-food')
        check(tag, 'food photo -> meal, one call', ev("[D.snap.kind, D.meal && D.meal.state, D.meal && D.meal.name, window.__calls.join()]"), ['food', 'ai', 'Paneer rice bowl', 'snap'])
        check(tag, 'estimate is a rounded draft with its parts', ev("[D.meal.kcal, D.meal.items.map(i => i.name).join(), document.querySelector('.mh-n').textContent, document.querySelector('.mh-t').textContent]"), [610, 'rice,paneer', 'About 610kcal', 'Rough estimate'])
        vis(pg, '[data-a="mealItem"][data-i="0"][data-v="1.4"]'); pg.wait_for_timeout(150)
        check(tag, 'a large part raises the total', ev("[D.meal.kcal, D.meal.p]"), [730, 33])
        vis(pg, '[data-a="mealSize"][data-v="0.7"]'); pg.wait_for_timeout(150)
        check(tag, 'a small plate lowers it', ev("D.meal.kcal"), 510)
        pg.fill('#ml-hint', 'no rice, extra paneer'); vis(pg, '[data-a="mealRefine"]'); pg.wait_for_timeout(900)
        check(tag, 'a correction re-estimates from the photo', ev("[D.meal.kcal, D.meal.size, D.meal.hint, window.__calls.join(), window.__inputs[window.__inputs.length - 1].includes('no rice, extra paneer')]"), [610, 1, '', 'snap,meal', True])
        vis(pg, '[data-a="mealNums"]'); pg.fill('#ml-kcal', '700'); pg.wait_for_timeout(100)
        check(tag, 'typed numbers become yours', ev("[D.meal.kcal, document.querySelector('.mh-t').textContent]"), [700, 'Your numbers'])
        vis(pg, '[data-a="mealLog"]'); pg.wait_for_timeout(500); shot('3-food-tab')
        check(tag, 'meal logged, Food tab opens', ev("[S.ui.tab, dayTotals(foodDay(now())).kcal - %d, sheets.length, S.meals[S.meals.length - 1].fib, S.meals[S.meals.length - 1].est]" % before), ['food', 700, 0, 6, False])
        check(tag, 'log again adds the same numbers', ev("(() => { const b = document.querySelector('[data-a=mealAgain]'), m = S.meals.find(x => x.id === b.dataset.id), k0 = dayTotals(foodDay(now())).kcal; b.click(); return [dayTotals(foodDay(now())).kcal - k0 === m.kcal, S.meals[S.meals.length - 1].src]; })()"), [True, 'again'])
        # a photo of a screen cannot be posted: it asks for a retake
        ev("window.__snapKind='gym'; window.__screen=true; window.__calls=[]"); snap(); shot('3b-screen')
        check(tag, 'screen photo: blocked, retake prompt', ev("[D.ci && D.ci.screen, !!document.querySelector('.aicheck.warn'), document.querySelector('#ci-post').disabled]"), [True, True, True])
        n = ev("S.checkins.length"); ev("A.ciPost()"); check(tag, 'screen photo: post refused', ev("S.checkins.length - %d" % n), 0)
        vis(pg, '[data-a="ciRetake"]'); pg.wait_for_timeout(300)
        check(tag, 'retake goes back to the camera', ev("[D.ci, D.snap, S.ui.tab, sheets.length]"), [None, None, 'cam', 0]); ev("window.__screen=false; A.camClose()")
        # neither
        ev("window.__snapKind='other'; window.__calls=[]"); snap(); shot('4-unsure')
        check(tag, 'unclear photo asks', ev("[D.snap.state, D.snap.kind, document.querySelectorAll('.snap-ask button').length]"), ['unsure', None, 3])
        # not a gym, filed as a check-in anyway: Claude's gym check says no and it cannot be posted
        vis(pg, '[data-a="snapPick"][data-k="gym"]'); pg.wait_for_timeout(700); shot('4b-not-gym')
        check(tag, 'not a gym: check-in blocked', ev("[D.ci && D.ci.ai, document.querySelector('#ci-post').disabled, !!document.querySelector('[data-a=ciRetake]'), !!document.querySelector('.nophoto-link')]"), ['no', True, True, True])
        n = ev("S.checkins.length"); ev("A.ciPost()"); check(tag, 'not a gym: post refused', ev("S.checkins.length - %d" % n), 0)
        vis(pg, '[data-a="ciRetake"]'); pg.wait_for_timeout(300); ev("A.camClose()")
        ev("window.__snapKind='other'; window.__calls=[]"); snap()
        vis(pg, '[data-a="snapPick"][data-k="progress"]'); pg.wait_for_timeout(300); n = ev("S.progress.length"); vis(pg, '[data-a="pgSave"]'); pg.wait_for_timeout(400)
        check(tag, 'progress photo saved', ev("[S.progress.length - %d, S.ui.tab]" % n), [1, 'you'])
        ev("closeAll()")
        # typed meal, plan
        vis(pg, '.tabbar [data-tab="food"]'); vis(pg, '.food-acts [data-a="openSay"]'); pg.fill('#say-text','two eggs and toast'); vis(pg, '#say-go'); pg.wait_for_timeout(900)
        check(tag, 'typed meal estimated, no switcher', ev("[D.meal && D.meal.state, D.snap, !!document.querySelector('.kind')]"), ['ai', None, False]); ev("closeAll()")
        vis(pg, '.tabbar [data-tab="you"]'); ev("A.openPlan()"); pg.wait_for_timeout(900); check(tag, 'plan', ev("D.plan && D.plan.state"), 'ai'); shot('5-plan'); ev("closeAll()")
        vis(pg, '[data-a="weekNote"]'); pg.wait_for_timeout(900)
        check(tag, 'weekly note is written on request', ev("[S.weekNote && S.weekNote.text.slice(0, 17), !!document.querySelector('.wnote')]"), ['Four days running', True]); shot('5b-note')
        ev("window.__calFail='server_not_connected'; A.openConnections()"); vis(pg, '[data-a="openConn"][data-k="gcal"]'); vis(pg, '[data-a="calGo"]'); pg.wait_for_timeout(500)
        check(tag, 'calendar failure falls back to a link', ev("!!document.querySelector('.sheet a[href*=\"calendar.google.com\"]')"), True); ev("closeAll()")
    else:
        snap(); shot('0-ask')
        check(tag, 'no Claude: asks what the photo is', ev("[D.snap.state, document.querySelectorAll('.snap-ask button').length]"), ['off', 3])
        vis(pg, '[data-a="snapPick"][data-k="gym"]'); pg.wait_for_timeout(600); shot('1-composer')
        check(tag, 'picked gym -> check-in without a check', ev("[D.ci && D.ci.ai, D.snap.kind]"), ['off', 'gym'])
        vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1600)
        check(tag, 'posted, unverified', ev("[S.posts[0].uid, S.posts[0].verified, S.posts[0].proof]"), ['me', None, 'photo'])
        check(tag, 'calendar link offered', (pg.get_attribute('.done-links a', 'href') or '')[:44], 'https://calendar.google.com/calendar/render?')
        vis(pg, '.done [data-a="closeSheet"]'); pg.wait_for_timeout(300)
        vis(pg, '.tabbar [data-tab="food"]'); vis(pg, '[data-a="scanMeal"]'); pg.wait_for_timeout(250); pg.set_input_files('#cam-input', IMG); pg.wait_for_timeout(1300); shot('2-meal')
        check(tag, 'from Food, no Claude: straight to the meal form', ev("[D.snap.kind, D.meal && D.meal.state]"), ['food', 'off']); ev("closeAll()")
    # proof that needs no photo inside the gym
    n0 = ev("window.__calls ? window.__calls.length : 0")
    ev("closeAll(); D.camIntent = null; S.ui.tab = 'home'; render()"); vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); vis(pg, '[data-a="openNoPhoto"]'); vis(pg, '[data-a="camOutside"]'); pg.wait_for_timeout(200)
    pg.set_input_files('#cam-input', IMG); pg.wait_for_timeout(900); shot('6-outside')
    check(tag, 'outside photo gets an outside check', ev("[D.ci && D.ci.ai, D.ci && D.ci.outside, (window.__calls ? window.__calls.length : 0) - %d]" % n0), ['ok', True, 1] if mock else ['off', True, 0])
    vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1600)
    check(tag, 'outside photo is labelled', ev("[S.posts[0].proof, S.checkins[S.checkins.length - 1].proof, document.querySelector('#p-' + S.posts[0].id + ' .proof').textContent]"), ['outside', 'outside', 'Outside photo'])
    vis(pg, '.done [data-a="closeSheet"]'); pg.wait_for_timeout(200)
    if mock:
        ev("window.__outsideOk = false"); vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); vis(pg, '[data-a="openNoPhoto"]'); vis(pg, '[data-a="camOutside"]'); pg.wait_for_timeout(200)
        pg.set_input_files('#cam-input', IMG); pg.wait_for_timeout(900)
        check(tag, 'outside photo that is not a gym is blocked', ev("[D.ci && D.ci.ai, document.querySelector('#ci-post').disabled]"), ['no', True])
        ev("window.__outsideOk = true; closeAll(); D.ci = null; D.snap = null; A.camClose && A.camClose(); S.ui.tab = 'home'; render()")
    ev("A.connOn({dataset:{k:'health'}})"); pg.wait_for_timeout(300)
    vis(pg, '.dt-alt'); pg.wait_for_timeout(400); shot('7-workout-only')
    check(tag, 'recorded workout stands in for the photo', ev("[D.ci.noPhoto, D.ci.ai, D.ci.photo, !!D.ci.scene.stat, !!document.querySelector('.kind')]"), [True, 'workout', None, True, False])
    vis(pg, '[data-a="ciMore"]'); vis(pg, '[data-a="ciTag"][data-k="Exam week"]'); vis(pg, '[data-a="ciLiftAdd"]'); pg.fill('#lf-n0', 'Squat'); pg.fill('#lf-w0', '270'); pg.fill('#lf-r0', '2')
    vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1600); shot('8-newbest')
    check(tag, 'workout-only check-in: label, tag, new best banner', ev("[S.posts[0].proof, S.checkins[S.checkins.length - 1].tag, S.detected, (document.querySelector('.pr-banner b') || {}).textContent, S.posts[0].pr.prev]"), ['workout', 'Exam week', None, 'New best: Squat 270 lb', 255])
    vis(pg, '.done [data-a="closeSheet"]'); pg.wait_for_timeout(200)
    check(tag, 'league counts the check-ins', ev("S.league.rows.find(r => r.sq === 'cse').total"), 110)
    # a comeback after a lost streak earns the bonus
    ev("S.settings.autoPass = false; skipTime(80)"); pg.wait_for_timeout(200)
    check(tag, 'streak lost', ev("[pAlive(S.me), !!S.me.lost]"), [False, True])
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); vis(pg, '[data-a="camSample"][data-k="gym"]'); pg.wait_for_timeout(1200); pts = ev("ciPts(D.ci)"); vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1500)
    check(tag, 'comeback bonus', ev("[S.checkins[S.checkins.length - 1].bonus, S.checkins[S.checkins.length - 1].pts - %d]" % pts), [20, 20])
    vis(pg, '.done [data-a="closeSheet"]'); pg.wait_for_timeout(200)
    # plans, props, duo pause
    vis(pg, '[data-a="newMeet"]'); vis(pg, '[data-a="nmPost"]'); pg.wait_for_timeout(300)
    check(tag, 'plan posted', ev("[S.meets.filter(m => m.uid === 'me').length, !!document.querySelector('[data-a=meetCancel]')]"), [1, True])
    check(tag, 'props: one kind, counted once', ev("(() => { const p = S.posts.find(x => x.uid !== 'me' && !x.mine), n = propsN(p); A.react({dataset:{id:p.id}}); const up = propsN(p) - n; A.react({dataset:{id:p.id}}); return [up, propsN(p) - n]; })()"), [1, 0])
    check(tag, 'duo pause holds the number', ev("(() => { const f = person('maya'), d = f.duo; A.duoPause({dataset:{id:'maya'}}); const p = !!f.duoPaused; A.duoPause({dataset:{id:'maya'}}); return [p, f.duo === d, !!f.duoPaused]; })()"), [True, True, False])
    # empty states say what unlocks them
    saved = ev("JSON.stringify(S.checkins)")
    check(tag, 'empty charts state their threshold', ev("(() => { const keep = S.checkins; S.checkins = []; S.ui.tab = 'you'; render(); const n = document.querySelectorAll('#view .thresh').length; S.checkins = keep; render(); return n; })()"), 3)
    ev("A.openProgress()"); vis(pg, '.sheet [data-a="addProgress"]'); pg.wait_for_timeout(200); pg.set_input_files('#pick-input', IMG); pg.wait_for_timeout(900)
    check(tag, 'progress photo from the library skips recognition', ev("[!!D.pg, D.snap, !!document.querySelector('.kind')]"), [True, None, False]); vis(pg, '[data-a="pgSave"]'); pg.wait_for_timeout(500)
    pg.reload(); pg.wait_for_timeout(700)
    check(tag, 'survives a reload', ev("[Object.keys(PHOTOS).length > 0, S.ui.tab !== 'cam', sheets.length]"), [True, True, 0])
    check(tag, 'no console errors', errs[:4], [])
    b.close()
def live(pw):
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, permissions=['camera']); pg = ctx.new_page(); pg.set_default_timeout(5000); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(url); pg.wait_for_timeout(500); pg.evaluate('closeAll()')
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(root/'shots/ph-live-0.png'))
    check('live', 'viewfinder is on', pg.evaluate("[cam.live, !!cam.stream, (document.querySelector('#cam-video')||{}).videoWidth > 0, !!document.querySelector('[data-a=\"camFlip\"]')]"), [True, True, True, True])
    vis(pg, '[data-a="camShoot"]'); pg.wait_for_timeout(900); pg.screenshot(path=str(root/'shots/ph-live-1.png'))
    check('live', 'shutter takes the frame', pg.evaluate("[!!(D.snap && D.snap.ph), Object.keys(PHOTOS).length, D.snap.state]"), [True, 1, 'off'])
    pg.evaluate("A.snapCancel(); A.camClose()"); pg.wait_for_timeout(300)
    check('live', 'camera released on leaving', pg.evaluate("[cam.stream, S.ui.tab]"), [None, 'home'])
    check('live', 'no console errors', errs[:4], [])
    b.close()
with sync_playwright() as pw:
    go(pw, False); go(pw, True); live(pw)
print('FAILED: ' + ', '.join(fails) if fails else 'ALL PASSED'); sys.exit(1 if fails else 0)
