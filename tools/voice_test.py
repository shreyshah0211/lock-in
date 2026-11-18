# Say it: describe a workout or a meal out loud and Lock In fills in the form.
# Three ways the words can arrive are covered here, each with a stand-in:
#   1. Claude's dictation (simulated: the test decides what was "heard"), with Claude working it out (simulated answers)
#   2. no microphone at all: the keyboard route, with the plain rules working it out
#   3. dictation refused by the person: the sheet falls back to the keyboard
# Nothing here uses a real microphone or the real model.
import pathlib, json, os
from playwright.sync_api import sync_playwright
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
root = pathlib.Path(__file__).resolve().parent.parent; url = 'file://' + str(root/'dist/index.html')
MOCK = '''
window.__dict = { state: 'idle', part: [], fin: [], st: [], deny: %s, starts: 0 };
window.__asked = [];
window.claude = { use: async (n) => {
  if (n === 'dictation') { if (%s) return null; const d = window.__dict, set = (s, r) => { d.state = s; d.st.forEach(h => h({ state: s, reason: r })); };
    d.set = set; d.say = t => d.fin.forEach(h => h({ text: t })); d.guess = t => d.part.forEach(h => h({ text: t }));
    return { start: () => { d.starts++; if (d.deny) { set('starting'); return new Promise((_, rej) => setTimeout(() => { set('idle', 'not_granted'); rej({ code: 'not_granted', message: 'no' }); }, 30)); }
               set('starting'); return new Promise(r => setTimeout(() => { set('listening'); r(); }, 30)); },
             stop: () => new Promise(r => setTimeout(() => { if (d.state !== 'idle') set('idle', 'stopped'); r(); }, 30)), active: () => d.state !== 'idle',
             onPartial: h => { d.part.push(h); return () => {}; }, onFinal: h => { d.fin.push(h); return () => {}; }, onState: h => { d.st.push(h); return () => {}; } }; }
  if (n === 'sample') { if (%s) return null; return { limits: async () => ({ images: true }), json: async (prompt) => { window.__asked.push(prompt);
      const said = (/out loud into a fitness app[^"]*"([^"]*)"/.exec(prompt) || [])[1] || '';
      if (/gibberish/.test(said)) return { kind: 'other' };
      if (/They are describing something they ate/.test(prompt) || /dal|eggs|toast|rice|roti/.test(said)) return { kind: 'food', name: 'Dal, rice and two rotis', calories: 610, protein_g: 24, carbs_g: 98, fat_g: 12, fiber_g: 14, sodium_mg: 820, items: [{ name: 'dal', calories: 220 }, { name: 'rice', calories: 210 }, { name: 'rotis', calories: 180 }], confidence: 'medium' };
      return { kind: 'workout', workout: 'legs', minutes: 50, effort: 3, lifts: [{ name: 'squat', weight: 225, reps: 5, sets: 3 }, { name: 'Romanian deadlift', weight: 185, reps: 8, sets: null }], tag: '' }; } }; }
  return null;
} };
%s
'''
fails = []
def check(name, got, want):
    ok = got == want
    print(('ok  ' if ok else 'FAIL'), name, '->', json.dumps(got)[:200], '' if ok else ' (wanted ' + json.dumps(want) + ')')
    if not ok: fails.append(name)
def page(pw, deny=False, nodict=False, noai=False, nosr=False, phone=True):
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(**(dict(pw.devices['iPhone 14']) if phone else dict(viewport={'width': 1280, 'height': 800})))
    ctx.add_init_script(MOCK % ('true' if deny else 'false', 'true' if nodict else 'false', 'true' if noai else 'false', 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition;' if nosr else ''))
    pg = ctx.new_page(); pg.set_default_timeout(4000); pg.errs = []
    pg.on('console', lambda m: pg.errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.errs.append('pageerror: ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(700); pg.evaluate('closeAll()'); pg.wait_for_timeout(100)
    return b, pg
def vis(pg, sel): pg.locator(sel).locator('visible=true').first.click()
def shot(pg, n): pg.screenshot(path=str(root/'shots'/f'voice-{n}.png'))

with sync_playwright() as pw:
    # ---- 1. Claude's dictation, Claude works it out ----
    b, pg = page(pw); ev = pg.evaluate
    check('the microphone route is Claude dictation', ev('voiceKind()'), 'claude')
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300)
    check('the capture menu has a Say it button', pg.locator('.capture [data-to="openSay"]').count(), 1)
    vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(350); shot(pg, '01-sheet')
    check('the sheet opens with a microphone', [pg.locator('#say-mic').count(), pg.locator('#say-state').inner_text(), pg.locator('#say-go').is_disabled()], [1, 'Tap and talk', True])
    vis(pg, '#say-mic'); pg.wait_for_timeout(120)
    check('tapping the microphone starts listening', [ev('__dict.starts'), ev("document.querySelector('#say-mic').classList.contains('on')"), pg.locator('#say-state').inner_text()], [1, True, 'Listening. Tap when you are done.'])
    ev("__dict.guess('I had dal')"); pg.wait_for_timeout(60)
    check('words show as a guess while you talk', pg.locator('#say-part').inner_text(), 'I had dal')
    ev("__dict.say(' I had dal, rice'); __dict.say(' and two rotis')"); pg.wait_for_timeout(60); shot(pg, '02-listening')
    check('settled words land in the box', [pg.locator('#say-text').input_value(), pg.locator('#say-part').inner_text()], ['I had dal, rice and two rotis', ''])
    meals0 = ev('S.meals.length')
    vis(pg, '#say-mic'); pg.wait_for_timeout(700); shot(pg, '03-meal')
    check('stopping works it out with no extra tap: a meal draft opens', [ev('!!D.meal'), ev('D.say'), ev('D.meal && D.meal.name'), ev('D.meal && +D.meal.kcal'), ev('D.meal && D.meal.state')], [True, None, 'Dal, rice and two rotis', 610, 'ai'])
    check('Claude was asked once, with what was said', [ev('__asked.length'), ev("__asked[0].includes('I had dal, rice and two rotis')")], [1, True])
    vis(pg, '[data-a="mealLog"]'); pg.wait_for_timeout(400)
    check('logging it adds the meal to today', [ev('S.meals.length') - meals0, ev('S.meals[S.meals.length-1].name'), ev('S.meals[S.meals.length-1].p'), ev('S.ui.tab')], [1, 'Dal, rice and two rotis', 24, 'food'])

    # a workout said from Home: it waits for the photo, then fills the check-in
    ev("S.offset += 24 * HOUR; tick(); render()");
    vis(pg, '.tabbar [data-tab="home"]'); pg.wait_for_timeout(200); vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300)
    vis(pg, '#say-mic'); pg.wait_for_timeout(100); ev("__dict.say(' Leg day, fifty minutes, squat 225 for 5 for three sets, then RDLs 185 for 8. Felt hard.')"); pg.wait_for_timeout(60)
    ev("__dict.set('idle', 'viewer_stopped')"); pg.wait_for_timeout(600); shot(pg, '04-camera')
    check('a workout goes to the camera for its photo', [ev('S.ui.tab'), ev('sheets.length'), ev('!!D.said'), pg.locator('.cam-frame p').inner_text().split('\n')[0]], ['cam', 0, True, 'Now snap your gym photo'])
    check('the camera says what it heard', 'Heard: Leg day, 50 min, hard, Squat 225 x 5, Romanian deadlift 185 x 8' in pg.locator('.cam-frame').inner_text(), True)
    n0 = ev('S.checkins.length')
    vis(pg, '[data-a="camSample"][data-k="gym"]'); pg.wait_for_timeout(1300); shot(pg, '05-composer')
    d = ev('({type: D.ci.type, mins: D.ci.mins, effort: D.ci.effort, lifts: D.ci.lifts, more: D.ci.more, said: D.ci.said, pending: D.said || null})')
    check('the check-in is filled in from what was said', [d['type'], d['mins'], d['effort'], d['more'], d['pending']], ['legs', 50, 3, True, None])
    check('lifts are filled in, with known names tidied', d['lifts'], [{'name': 'Squat', 'w': 225, 'reps': 5, 'sets': 3}, {'name': 'Romanian deadlift', 'w': 185, 'reps': 8, 'sets': ''}])
    check('the form shows where the details came from', pg.locator('#ci-proof').inner_text().count('From what you said: Leg day, 50 min, hard'), 1)
    check('the lift fields show the numbers', [pg.locator('#lf-n0').input_value(), pg.locator('#lf-w0').input_value(), pg.locator('#lf-r0').input_value(), pg.locator('#lf-s0').input_value()], ['Squat', '225', '5', '3'])
    vis(pg, '[data-a="ciPost"]'); pg.wait_for_timeout(1500)
    c = ev('S.checkins[S.checkins.length-1]')
    check('posting saves the session with its lifts', [ev('S.checkins.length') - n0, c['type'], c['mins'], c['effort'], len(c.get('lifts') or [])], [1, 'legs', 50, 3, 2])
    ev('closeAll()'); pg.wait_for_timeout(200)

    # from inside the check-in form
    ev("S.offset += 24 * HOUR; tick(); render()")
    vis(pg, '.snap'); pg.wait_for_timeout(300); vis(pg, '.capture [data-a="goCam"]'); pg.wait_for_timeout(300); vis(pg, '[data-a="camSample"][data-k="gym"]'); pg.wait_for_timeout(1300)
    check('the check-in form has a Say button', pg.locator('.say-in').inner_text(), 'Say what you trained')
    vis(pg, '.say-in'); pg.wait_for_timeout(300)
    check('it opens in workout mode', [ev('D.say.mode'), pg.locator('.sheet').last.locator('h2').inner_text()], ['workout', 'Say what you trained'])
    pg.fill('#say-text', 'squats and rdls, about fifty minutes'); pg.wait_for_timeout(60)
    check('typing in the box enables the button', pg.locator('#say-go').is_disabled(), False)
    vis(pg, '#say-go'); pg.wait_for_timeout(600); shot(pg, '06-composer-said')
    check('the form behind is filled in and the sheet closes', [ev('sheets.length'), ev('D.ci.type'), ev('D.ci.mins'), len(ev('D.ci.lifts')), pg.locator('.say-in').inner_text()], [1, 'legs', 50, 2, 'Say it again'])
    check('in workout mode Claude is told it is a workout', ev("__asked[__asked.length-1].includes('They are describing a workout they did.')"), True)
    ev('closeAll(); A.camClose()'); pg.wait_for_timeout(200)

    # something that is neither: it asks, and the answer settles it
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300); pg.fill('#say-text', 'gibberish words'); vis(pg, '#say-go'); pg.wait_for_timeout(500); shot(pg, '07-ask')
    check('unclear words get one question', [pg.locator('.say-ask').count(), ev('!!D.say')], [1, True])
    vis(pg, '[data-a="sayAs"][data-k="food"]'); pg.wait_for_timeout(600)
    check('answering "a meal" opens a meal draft', [ev('!!D.meal'), ev('D.say')], [True, None])
    ev('closeAll()'); pg.wait_for_timeout(150)

    # leaving the camera forgets what was said
    vis(pg, '.tabbar [data-tab="home"]'); pg.wait_for_timeout(150); vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300); pg.fill('#say-text', 'push day 40 minutes'); vis(pg, '#say-go'); pg.wait_for_timeout(600)
    check('said first, camera next', [ev('S.ui.tab'), ev('!!D.said')], ['cam', True])
    vis(pg, '[data-a="saidClear"]'); pg.wait_for_timeout(200)
    check('"Forget what I said" clears it', [ev('D.said'), pg.locator('.cam-frame p').inner_text().split('\n')[0]], [None, 'Snap your gym or your food'])
    vis(pg, '[data-a="camClose"]'); pg.wait_for_timeout(200)
    # closing the sheet stops the microphone
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300); vis(pg, '#say-mic'); pg.wait_for_timeout(120); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('closing the sheet stops listening', [ev('sheets.length'), ev('__dict.state'), ev('D.say')], [0, 'idle', None])
    # the Food tab
    vis(pg, '.tabbar [data-tab="food"]'); pg.wait_for_timeout(200)
    check('Food has Say it next to Snap a meal', pg.locator('.food-acts [data-a="openSay"]').inner_text(), 'Say it')
    vis(pg, '.food-acts [data-a="openSay"]'); pg.wait_for_timeout(300)
    check('from Food it opens in meal mode', [ev('D.say.mode'), pg.locator('.sheet').last.locator('h2').inner_text()], ['meal', 'Say what you ate'])
    check('no errors with dictation', pg.errs, []); b.close()

    # ---- 2. no microphone and no Claude: keyboard route, plain rules ----
    b, pg = page(pw, nodict=True, noai=True, nosr=True); ev = pg.evaluate
    check('with no microphone the route is the keyboard', ev('voiceKind()'), 'kb')
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(350); shot(pg, '08-keyboard')
    check('the keyboard sheet has no microphone button, says how, and puts the cursor in the box', [pg.locator('#say-mic').count(), pg.locator('.say-kb').count(), ev("document.activeElement && document.activeElement.id")], [0, 1, 'say-text'])
    check('the box is 16px so the phone does not zoom', ev("getComputedStyle(document.querySelector('#say-text')).fontSize"), '16px')
    box = ev("(() => { const r = document.querySelector('#say-go').getBoundingClientRect(); return Math.round(r.bottom); })()")
    check('the button sits in the top half, clear of a phone keyboard', box < 470, True)
    pg.fill('#say-text', 'Push day, an hour and a half, bench 185 for 5, 3 sets of 8 incline press at 60 pounds, felt easy'); vis(pg, '#say-go'); pg.wait_for_timeout(600)
    vis(pg, '[data-a="camSample"][data-k="gym"]'); pg.wait_for_timeout(1300)
    d = ev('({type: D.ci.type, mins: D.ci.mins, effort: D.ci.effort, lifts: D.ci.lifts})')
    check('plain rules: type, time and effort', [d['type'], d['mins'], d['effort']], ['push', 90, 1])
    check('plain rules: lifts', d['lifts'], [{'name': 'Bench press', 'w': 185, 'reps': 5, 'sets': ''}, {'name': 'Incline dumbbell press', 'w': 60, 'reps': 8, 'sets': 3}])
    ev('closeAll(); A.camClose()'); pg.wait_for_timeout(200)
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300); pg.fill('#say-text', 'two eggs and toast'); vis(pg, '#say-go'); pg.wait_for_timeout(600)
    check('plain rules: a meal opens as a rough guess', [ev('!!D.meal'), ev('D.meal && D.meal.state'), ev('D.meal && +D.meal.kcal > 0')], [True, 'guess', True])
    ev('closeAll()')
    rules = ev('''[
      ["ran 3 miles on the treadmill, 25 minutes", "workout"], ["leg day, squats 3 by 10 at 135", "workout"], ["a bowl of oatmeal with a banana", "food"],
      ["chicken burrito bowl and a coffee", "food"], ["hello there", "other"], ["pull ups and rows for 45 minutes, brutal", "workout"]
    ].map(x => [x[0], sayKind(x[0]) === x[1]])''')
    check('plain rules tell workouts from meals', [r for r in rules if not r[1]], [])
    w = ev('guessWorkout("leg day, squats 3 by 10 at 135, lunges 2 sets of twelve, an hour, tough, exam week")')
    check('plain rules: sets by reps, spoken numbers, tags', [w['type'], w['mins'], w['effort'], w['tag'], w['lifts']], ['legs', 60, 3, 'Exam week', [{'name': 'Squat', 'w': 135, 'reps': 10, 'sets': 3}, {'name': 'Lunge', 'w': None, 'reps': 12, 'sets': 2}]])
    w = ev('guessWorkout("ran 3 miles on the treadmill, 25 minutes, steady")')
    check('plain rules: cardio', [w['type'], w['mins'], w['effort'], w['lifts']], ['cardio', 25, 2, []])
    check('no errors on the keyboard route', pg.errs, []); b.close()

    # ---- 3. dictation refused ----
    b, pg = page(pw, deny=True); ev = pg.evaluate
    vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300); vis(pg, '#say-mic'); pg.wait_for_timeout(300); shot(pg, '09-refused')
    check('refused: the sheet switches to the keyboard and stays open', [ev('voiceKind()'), pg.locator('#say-mic').count(), pg.locator('.say-kb').count(), ev('!!D.say')], ['kb', 0, 1, True])
    check('refused: it says so once', pg.locator('.toast').count(), 1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); vis(pg, '[data-a="openCapture"]'); pg.wait_for_timeout(300); vis(pg, '.capture [data-to="openSay"]'); pg.wait_for_timeout(300)
    check('refused: it does not ask again', [ev('__dict.starts'), pg.locator('#say-mic').count()], [1, 0])
    check('no errors when refused', pg.errs, []); b.close()

    # ---- on a computer ----
    b, pg = page(pw, phone=False); ev = pg.evaluate
    check('the side menu has Say it', pg.locator('#side .side-say').inner_text(), 'Say it')
    vis(pg, '#side .side-say'); pg.wait_for_timeout(350); shot(pg, '10-desktop')
    check('it opens on a computer too', [pg.locator('#say-mic').count(), ev('D.say.mode')], [1, 'auto'])
    check('no errors on a computer', pg.errs, []); b.close()

print('VOICE ALL PASSED' if not fails else 'VOICE FAILED: ' + ', '.join(fails))
