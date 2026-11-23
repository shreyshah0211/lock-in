# Layout checks: nothing may spill sideways on small phones, and the desktop columns must hold.
import pathlib, sys
from playwright.sync_api import sync_playwright
import os; CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')   # set CHROME to your own Chrome or Chromium
root = pathlib.Path(__file__).resolve().parent.parent; url='file://'+str(root/'dist/index.html') + '?sample=1'; bad = 0
OV = "(() => { const v=document.querySelector('%s'); if(!v) return [false,['missing']]; const vr=v.getBoundingClientRect(); const bad=[...v.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>vr.right+1) && !e.closest('.frow') && !e.closest('.hscroll')}).slice(0,3).map(e=>String(e.className||e.tagName)); return [v.scrollWidth>v.clientWidth+1, bad]; })()"
def vis(pg, sel): pg.locator(sel).locator('visible=true').first.click()
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    for (w,h) in [(360,640),(375,667),(430,932)]:
        pg = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2).new_page(); pg.set_default_timeout(3000); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(500); pg.screenshot(path=str(root/f'shots/sz-{w}-intro.png')); pg.evaluate('closeAll()'); pg.wait_for_timeout(200)
        pg.screenshot(path=str(root/f'shots/sz-{w}-0home.png'))
        pg.evaluate('A.goCam()'); pg.wait_for_timeout(300); pg.screenshot(path=str(root/f'shots/sz-{w}-1cam.png'))
        vis(pg,'[data-a="camSample"][data-k="food"]'); pg.wait_for_timeout(1400); pg.screenshot(path=str(root/f'shots/sz-{w}-2meal.png'))
        ov = pg.evaluate(OV % '#layer .sheet:last-of-type')
        if ov[0] or ov[1]: bad += 1; print(w, 'meal draft overflow', ov)
        vis(pg,'[data-a="snapAs"][data-k="gym"]'); pg.wait_for_timeout(300); pg.screenshot(path=str(root/f'shots/sz-{w}-3composer.png'))
        ov = pg.evaluate(OV % '#layer .sheet:last-of-type')
        if ov[0] or ov[1]: bad += 1; print(w, 'composer overflow', ov)
        vis(pg,'[data-a="ciPost"]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(root/f'shots/sz-{w}-4done.png'))
        vis(pg,'.done [data-a="closeSheet"]')
        for t in ['home','you']:
            vis(pg, f'.tabbar [data-tab="{t}"]'); pg.wait_for_timeout(150)
            if t in ('food','you'): pg.screenshot(path=str(root/f'shots/sz-{w}-5{t}.png'))
            ov = pg.evaluate(OV % '#view')
            if ov[0] or ov[1]: bad += 1; print(w, t, 'overflow', ov)
        tb = pg.evaluate("(() => { const b=document.querySelector('.tabbar').getBoundingClientRect(), s=document.querySelector('.snap').getBoundingClientRect(); return [Math.round(s.left+s.width/2 - (b.left+b.width/2)), [...document.querySelectorAll('.tabbar button span')].every(e => e.scrollWidth <= e.clientWidth + 1)]; })()")
        if tb != [0, True]: bad += 1; print(w, 'tab bar: camera off-centre or labels clipped', tb)
        for a in ['A.openConnections()','A.openWidgets()','A.openTiers()','A.openEffort()','A.openFriends()','A.openSettings()','A.openProgress()','A.openBadges()','A.openGoals()','A.openIntro()','A.openIntro();D.intro=3;drawSheets(false)','A.openNoPhoto()','A.openMore()','A.openCharts()','A.openFoodWeek()','A.openEffortInfo()','A.openSessions({dataset:{}})','A.openSession({dataset:{id:S.checkins[S.checkins.length-1].id}})','A.openRecap()','A.openNutrients()',"A.openProof({dataset:{k:'photo'}})","A.openNoticed({dataset:{id:S.posts.find(p=>p.uid==='me').id}})","A.openProfile({dataset:{id:'maya'}})","A.openSay({dataset:{k:'auto'}})","A.openSay({dataset:{k:'workout'}})","A.openMap()"]:
            pg.evaluate('closeAll();'+a); pg.wait_for_timeout(200)
            ov = pg.evaluate(OV % '#layer .sheet:last-of-type')
            if ov[0] or ov[1]: bad += 1; print(w, a, 'overflow', ov)
        pg.evaluate('closeAll()')
        if errs: bad += 1
        print(w,h,'errors', errs or 'none')
    for (w,h) in [(1024,700),(1100,760),(1280,720),(1440,900),(1920,1080)]:
        pg = b.new_context(viewport={'width':w,'height':h}).new_page(); pg.set_default_timeout(3000); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(500); pg.evaluate('closeAll()')
        g = pg.evaluate("(() => { const r=s=>{const e=document.querySelector(s); const c=getComputedStyle(e); if(c.display==='none') return null; const b=e.getBoundingClientRect(); return [Math.round(b.left),Math.round(b.right)]}; return {side:r('#side'), phone:r('#phone'), rail:r('#rail'), tabs:r('#tabs'), docW: document.documentElement.scrollWidth, winW: innerWidth, docH: document.documentElement.scrollHeight, winH: innerHeight}; })()")
        ok = g['side'] and g['phone'] and g['tabs'] is None and g['side'][1] <= g['phone'][0] + 1 and (g['rail'] is None or g['phone'][1] <= g['rail'][0] + 1) and g['docW'] <= g['winW'] and g['docH'] <= g['winH'] and (g['rail'] is not None) == (w >= 1240)
        for t in ['home','you']:
            vis(pg, f'#side [data-tab="{t}"]'); pg.wait_for_timeout(150)
            for sel in ['#view','#side','#rail'] if g['rail'] else ['#view','#side']:
                ov = pg.evaluate(OV % sel)
                if ov[0] or ov[1]: bad += 1; print(w, t, sel, 'overflow', ov)
        for a in ['A.openFriends()','A.openTiers()','A.openGoals()','A.openIntro()',"A.openSay({dataset:{k:'auto'}})",'A.openMap()']:
            pg.evaluate('closeAll();'+a); pg.wait_for_timeout(500)   # sheets slide in over 0.34s; measure once they have settled
            ov = pg.evaluate(OV % '#layer .sheet:last-of-type')
            inside = pg.evaluate("(() => { const s=document.querySelector('#layer .sheet:last-of-type').getBoundingClientRect(), p=document.querySelector('#phone').getBoundingClientRect(); return s.left>=p.left-1 && s.right<=p.right+1 && s.top>=p.top-1 && s.bottom<=p.bottom+1; })()")
            if ov[0] or ov[1] or not inside: bad += 1; print(w, a, 'sheet problem', ov, 'inside column:', inside)
        pg.evaluate('closeAll()'); pg.screenshot(path=str(root/f'shots/sz-desk-{w}.png'))
        if not ok or errs: bad += 1
        print(w,h,'layout', 'ok' if ok else g, 'errors', errs or 'none')
    pg = b.new_context(viewport={'width':800,'height':1000}).new_page(); pg.goto(url); pg.wait_for_timeout(500); pg.evaluate('closeAll()'); pg.screenshot(path=str(root/'shots/sz-tablet.png'))
    b.close()
print('SIZES', 'FAILED' if bad else 'ALL PASSED'); sys.exit(1 if bad else 0)
