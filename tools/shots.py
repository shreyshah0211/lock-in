import sys, pathlib, json
from playwright.sync_api import sync_playwright
import os; CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')   # set CHROME to your own Chrome or Chromium
root = pathlib.Path(__file__).resolve().parent.parent
url = 'file://' + str(root/'dist/index.html')
which = sys.argv[1:] or ['all']
def run(pw, name, vw, vh, steps):
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':vw,'height':vh}, device_scale_factor=2 if vw<500 else 1)
    pg = ctx.new_page(); pg.set_default_timeout(3000); errs=[]
    pg.on('console', lambda m: errs.append('console: '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(700)
    if name not in ('first', 'real'): pg.evaluate('closeAll()')
    for i,(label, fn) in enumerate(steps):
        try:
            if fn: fn(pg)
            pg.wait_for_timeout(450)
            pg.screenshot(path=str(root/'shots'/f'{name}-{i:02d}-{label}.png'))
        except Exception as e:
            errs.append(f'STEP {label}: {str(e)[:160]}')
    print(name, 'errors:', json.dumps(errs, indent=1) if errs else 'none')
    b.close()
def click(sel): return lambda pg: pg.locator(sel).locator('visible=true').first.click()
def act(a, extra=''): return click(f'[data-a="{a}"]{extra}')
def js(code): return lambda pg: pg.evaluate(code)
def scroll(y): return lambda pg: pg.evaluate(f"document.querySelector('#view').scrollTop={y}")
def sscroll(y): return lambda pg: pg.evaluate(f"(()=>{{const s=document.querySelectorAll('.sheet');s[s.length-1].scrollTop={y}}})()")
tab = lambda t: click(f'.tabbar [data-tab="{t}"]')
back = lambda pg: pg.keyboard.press('Escape')
def seq(*fns):
    def run(pg):
        for f in fns:
            f(pg); pg.wait_for_timeout(180)
    return run
W = lambda ms: (lambda pg: pg.wait_for_timeout(ms))
flows = {
 'home': [('home',None),('home2',scroll(430)),('home3',scroll(1150)),('friends',seq(scroll(0),click('.hero [data-a="openFriends"]'))),('profile',click('.sheet [data-a="openProfile"][data-id="maya"]')),('activity',seq(back,back,act('openActivity'))),('passes',seq(back,act('openPasses'))),('rules',seq(back,act('openTiers')))],
 'first': [('intro',None),('intro2',act('introNext')),('intro3',act('introNext')),('intro4',act('introNext')),('targets',seq(click('[data-a="introStep"][data-k="kcal"][data-d="100"]'),click('[data-a="introStep"][data-k="p"][data-d="10"]'))),('cam',seq(act('introReal'),W(500))),('reload',lambda pg: (pg.reload(), pg.wait_for_timeout(600)))],
 'real': [('intro4',js("D.intro = 3; drawSheets(false)")),('camera',seq(act('introReal'),W(500))),('home',act('camClose')),('home2',scroll(520)),('ch',tab('ch')),('food',tab('food')),('you',tab('you')),('you2',scroll(620)),('settings',act('openSettings')),('activity',seq(back,tab('home'),act('openActivity'))),('sample',seq(back,js("A.openSettings()"),act('goSample'))),('settings2',js("A.openSettings()"))],
 'cam': [('cam',act('goCam')),('working',click('[data-a="camSample"][data-k="gym"]')),('composer',W(1100)),('more',seq(act('ciMore'),sscroll(600))),('posted',act('ciPost')),('done2',W(1500)),('duo',act('doneDuo')),('home-after',click('.done [data-a="closeSheet"]')),('feed',scroll(520)),
         ('mealwork',seq(scroll(0),act('goCam'),click('[data-a="camSample"][data-k="food"]'))),('meal',W(1500)),('asgym',click('[data-a="snapAs"][data-k="gym"]')),('asprog',click('[data-a="snapAs"][data-k="progress"]')),('asmeal',seq(click('[data-a="snapAs"][data-k="food"]'),W(500))),('logged',act('mealLog')),
         ('progcam',seq(tab('you'),js("A.addProgress()"))),('progsheet',click('[data-a="camSample"]')),('progsaved',act('pgSave'))],
 'ch': [('ch',tab('ch')),('ch2',scroll(520)),('board',act('openBoard')),('squad',seq(back,scroll(300),click('[data-a="openSquad"]'))),('newsquad',seq(back,scroll(0),act('newSquad')))],
 'food': [('food',tab('food')),('food2',scroll(520)),('prev',seq(scroll(0),click('[data-a="foodDay"][data-d="-1"]'))),('type',seq(click('[data-a="foodDay"][data-d="1"]'),click('.food-acts [data-a="openSay"]'))),('goals',seq(back,act('openGoals'))),('mealcam',seq(back,act('scanMeal')))],
 'you': [('you',tab('you')),('you2',scroll(520)),('you3',scroll(1040)),('you4',scroll(1560)),('you5',scroll(2200)),('lifts',seq(scroll(0),js("A.openEffort()"))),('lift',click('.sheet [data-a="openLift"]')),('badges',seq(back,back,act('openBadges'))),('progress',seq(back,act('openProgress'))),('widgets',seq(back,act('openWidgets'))),('plan',seq(back,act('openPlan'),W(600))),('settings',seq(back,act('openSettings')))],
 'conn': [('conns',seq(tab('you'),js("A.openConnections()"))),('health',click('[data-a="openConn"][data-k="health"]')),('on',act('connOn')),('home',seq(back,tab('home'),scroll(0))),('detcam',act('detPhoto')),('detcomposer',seq(click('[data-a="camSample"][data-k="gym"]'),W(1100))),('detpost',act('ciPost')),('done',W(1400)),('feed',seq(click('.done [data-a="closeSheet"]'),scroll(560))),('cal',seq(scroll(0),js("A.openConnections()"),click('[data-a="openConn"][data-k="gcal"]'))),('via',seq(back,sscroll(300))),('you',seq(back,tab('you'),scroll(0)))],
 'social': [('noticed',click('.noticed')),('proof',seq(back,scroll(1150),click('.proof'))),('meets',seq(back,scroll(560))),('meetnew',act('newMeet')),('meetposted',act('nmPost')),('meetin',act('meetIn')),('joined',W(4600)),('recap',seq(scroll(0),act('openRecap'))),('recap2',sscroll(500)),('duo',seq(back,js("A.openProfile({dataset:{id:'maya'}})"),W(300),sscroll(260))),('duopaused',act('duoPause')),('nudge',seq(back,scroll(0),act('nudge')))],
 'proof': [('cam',act('goCam')),('nophoto',act('openNoPhoto')),('outside',act('camOutside')),('outcomposer',seq(click('[data-a="camSample"][data-k="gym"]'),W(400))),('outposted',seq(act('ciPost'),W(1500))),('outfeed',seq(click('.done [data-a="closeSheet"]'),scroll(700))),
           ('health',seq(scroll(0),js("A.connOn({dataset:{k:'health'}})"),W(300))),('wo-composer',click('.dt-alt')),('wo-more',seq(act('ciMore'),sscroll(700),click('[data-a="ciTag"][data-k="Exam week"]'))),('wo-posted',seq(act('ciPost'),W(1500))),('wo-feed',seq(click('.done [data-a="closeSheet"]'),scroll(700))),
           ('pr',seq(scroll(0),act('goCam'),click('[data-a="camSample"][data-k="gym"]'),W(1100),act('ciMore'),act('ciLiftAdd'),lambda pg: (pg.fill('#lf-n0','Squat'), pg.fill('#lf-w0','265'), pg.fill('#lf-r0','3')),act('ciPost'),W(1600)))],
 'depth': [('you',tab('you')),('sessions',click('[data-a="openSessions"]')),('session',click('.sess')),('effort',seq(back,back,act('openEffortInfo'))),('effort2',sscroll(500)),('week',seq(back,scroll(430),click('.wk button:nth-child(5)'))),('body',seq(back,scroll(900))),('day',seq(scroll(1400),click('.heat button.l3, .heat button.l2'))),('recapmenu',seq(scroll(3000),act('openRecap'))),
           ('food',seq(back,tab('food'))),('food2',scroll(560)),('food3',scroll(1100)),('nutrients',act('openNutrients')),('again',seq(back,scroll(250),click('[data-a="mealAgain"]'))),('protein',seq(scroll(0),click('[data-a="foodMode"][data-k="0"]'))),('protein2',scroll(700)),
           ('mealdraft',seq(click('[data-a="foodMode"][data-k="1"]'),act('scanMeal'),click('[data-a="camSample"][data-k="food"]'),W(1500))),('mealdraft2',sscroll(420)),('portions',seq(click('[data-a="mealItem"][data-i="0"][data-v="1.4"]'),click('[data-a="mealSize"][data-v="0.7"]'),sscroll(300))),('nums',seq(act('mealNums'),sscroll(900))),
           ('league',seq(back,act('camClose'),tab('ch'),scroll(620))),('leaguewk',click('[data-a="lgSeg"][data-w="1"]')),('leagueall',act('openLeague')),('rewards',seq(back,scroll(1250))),('perk',click('[data-a="openReward"][data-k="perk"]')),('draw',seq(back,click('[data-a="openReward"][data-k="draw"]'))),('cause',seq(back,click('[data-a="openReward"][data-k="cause"]')))],
 'lost': [('amber',js("skipTime(21)")),('red',js("skipTime(8)")),('pass',js("skipTime(3)")),('lost',js("skipTime(26)")),('gated',scroll(700)),('repaircam',seq(scroll(0),act('goCam'))),('repair',seq(click('[data-a="camSample"][data-k="gym"]'),W(1100),act('ciPost'))),('repaired',W(1400)),('gone',seq(click('.done [data-a="closeSheet"]'),js("skipTime(80)"))),('gonecam',act('goCam'))],
}
def fill(sel, text): return lambda pg: pg.fill(sel, text)
def dot(name): return lambda pg: pg.mouse.click(*pg.evaluate("(() => { const h = M.hits.find(h => h.group && h.name === '%s'), r = document.querySelector('#map-cv').getBoundingClientRect(); return [r.left + h.x, r.top + h.y]; })()" % name))
flows['map'] = [('card',js("document.querySelector('.gcard').scrollIntoView({block:'center'})")),('grow',seq(click('.gcard'),W(100))),('unroll',W(150)),('region',W(1200)),('city',seq(dot('Seattle'),W(1300))),('gyms',seq(dot('Seattle'),W(1300))),('gym',seq(dot('IMA'),W(1300))),('profile',click('.mc-list .row')),('world',seq(back,act('mapWorld'),W(1500))),('campus',seq(lambda pg: pg.mouse.click(*pg.evaluate("(() => { const h = M.hits.find(h => h.else), r = document.querySelector('#map-cv').getBoundingClientRect(); return [r.left + h.x, r.top + h.y]; })()")),W(1300))),('closing',seq(act('mapClose'),W(60))),('closed',W(1200))]
flows['say'] = [('home',None),('sheet',click('.say-fab')),('said',fill('#say-text','Leg day, 50 minutes, squat 225 for 5 for 3 sets, then lunges 2 sets of 12. Felt hard.')),('camera',seq(click('#say-go'),W(500))),('composer',seq(click('[data-a="camSample"][data-k="gym"]'),W(1100))),('filled',sscroll(430)),('lifts',sscroll(900)),
                ('camsay',seq(js("closeAll(); A.camClose(); A.goCam()"),W(200))),('food',seq(act('camClose'),tab('food'))),('foodsay',click('.food-acts [data-a="openSay"]')),('meal',seq(fill('#say-text','two eggs, toast with peanut butter and a banana'),click('#say-go'),W(700)))]
side = lambda t: click('#side [data-tab="%s"]' % t)
desk = [('home',None),('home2',scroll(600)),('ch',side('ch')),('food',side('food')),('you',side('you')),('you2',scroll(700)),('friends',click('#side [data-a="openFriends"]')),('settings',seq(back,click('#side [data-a="openSettings"]'))),('cam',seq(back,click('#side [data-a="goCam"]'))),('composer',seq(click('[data-a="camSample"][data-k="gym"]'),W(1100))),('done',seq(act('ciPost'),W(1500))),('after',click('.done [data-a="closeSheet"]')),('meal',seq(click('#rail [data-a="goCam"], #side [data-a="goCam"]'),click('[data-a="camSample"][data-k="food"]'),W(1500))),('logged',act('mealLog')),('skip',seq(click('#rail [data-a="skip"][data-h="24"]'),click('#rail [data-a="skip"][data-h="24"]'))),('say',click('#side .side-say')),('map',seq(back,side('home'),click('.gcard'),W(1700))),('mapgym',seq(dot('Seattle'),W(1300)))]
with sync_playwright() as pw:
    for k,steps in flows.items():
        if 'all' in which or k in which: run(pw, k, 390, 844, steps)
    if 'all' in which or 'desk' in which:
        run(pw, 'desk', 1440, 900, desk)
        run(pw, 'deskmid', 1100, 760, [('home',None),('you',side('you')),('food',side('food')),('cam',click('#side [data-a="goCam"]'))])
        run(pw, 'tablet', 800, 1000, [('home',None)])
