import sys, random, pathlib, json
from playwright.sync_api import sync_playwright
import os; CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')   # set CHROME to your own Chrome or Chromium
root = pathlib.Path(__file__).resolve().parent.parent; url='file://'+str(root/'dist/index.html')
seed = int(sys.argv[1]) if len(sys.argv)>1 else 1
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv)>3 else (390, 844)
random.seed(seed)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':VW,'height':VH}); pg = ctx.new_page(); pg.set_default_timeout(1500)
    errs=[]; log=[]
    pg.on('console', lambda m: errs.append('console: '+m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)+' after '+' > '.join(log[-4:])))
    pg.on('filechooser', lambda fc: fc.set_files([]))
    pg.goto(url); pg.wait_for_timeout(500)
    if len(sys.argv) > 4 and sys.argv[4] == 'real': pg.evaluate("closeAll(); S = realState(S); upgradeState(); render()")   # run on your-own-data mode
    for i in range(260):
        els = pg.query_selector_all('[data-a]')
        vis = []
        for e in els:
            try:
                if e.is_visible(): vis.append(e)
            except Exception: pass
        if not vis:
            # the page redrew between the query and the check; try again
            pg.wait_for_timeout(60); continue
        # prefer the top sheet if one is open
        top = pg.query_selector('#layer .sheet:last-of-type')
        if top and random.random()<.8:
            inner = [e for e in vis if pg.evaluate('(a)=>a[0].contains(a[1])',[top,e])]
            if inner: vis = inner
        # pick an action first, then one element that has it, so big grids do not swallow the run
        by = {}
        for e in vis:
            try: by.setdefault(e.get_attribute('data-a'), []).append(e)
            except Exception: pass
        if not by: continue
        a = random.choice(sorted(by)); e = random.choice(by[a])
        if a in ('resetDemo','camShoot','camPick'): continue
        log.append(a+(':'+(e.get_attribute('data-id') or e.get_attribute('data-k') or e.get_attribute('data-tab') or '')))
        try:
            e.click(force=True, timeout=800)
        except Exception as ex:
            pass
        if random.random()<.15:
            inp = pg.query_selector('#layer input.input:not([type=number]), #layer textarea')
            if inp:
                try: inp.fill('test '+str(i))
                except Exception: pass
        if random.random()<.1:
            try: pg.keyboard.press('Escape')
            except Exception: pass
        if i%60==59: pg.evaluate('skipTime(7)')
        pg.wait_for_timeout(25)
    pg.wait_for_timeout(300)
    # reload to test persisted state
    pg.reload(); pg.wait_for_timeout(600)
    print('last', log[-3:], 'tab', pg.evaluate('S.ui.tab'), 'sheets', pg.evaluate('sheets.length'))
    print('seed',seed,'at',VW,'actions',len(log),'errors', json.dumps(errs[:8],indent=1) if errs else 'none')
    b.close()
