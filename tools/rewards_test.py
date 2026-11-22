import os, sys, json
from playwright.sync_api import sync_playwright
# Locked rewards, end to end: read a product, lock it, count days, win, miss, weight guardrails.
# usage: rewards_test.py [screenshot folder] [folder with a saved store page as p.js and p.html]
import tempfile
out = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(); url = 'file://' + os.path.abspath('dist/index.html')
if len(sys.argv) > 2:
    js = open(sys.argv[2] + '/p.js', encoding='utf8', errors='replace').read(); html = open(sys.argv[2] + '/p.html', encoding='utf8', errors='replace').read()
else:
    js = json.dumps({'title': 'Bimbobox Dark Green Jacket', 'featured_image': '//cdn.shopify.com/s/files/x.jpg',
        'variants': [{'id': 100 + i, 'title': t, 'price': 8900, 'available': True} for i, t in enumerate(['XS', 'S', 'M', 'L', 'XL', 'XXL'])]})
    html = '<meta property="og:site_name" content="Scuffers"><meta property="og:price:currency" content="EUR">'
fails = []
def ok(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if extra and not cond else ''))
    if not cond: fails.append(name)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ['CHROME'])
    ctx = b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(700)
    pg.add_style_tag(content=":root{--sat:59px !important}")
    ev = pg.evaluate
    def shot(n, wait=400): pg.wait_for_timeout(wait); pg.screenshot(path=f'{out}/{n}.png')
    ev("closeAll();S.ui.tab='home';render();0")
    ok('home has the two tabs', ev("document.querySelectorAll('.home-seg button').length") == 2)
    lbl = ev("document.querySelectorAll('.home-seg button')[1].textContent"); ok('tab shows sample progress', lbl.startswith('Reward '), lbl)
    shot('1-home-friends')
    ev("A.homeSeg({dataset:{k:'rewards'}});document.querySelector('#view').scrollTop=330;0"); shot('2-sample')
    ok('sample card shows its cover', ev("document.querySelectorAll('.card.rw .rw-tiles i').length>=rwActive().target"))
    ok('pieces uncovered match the days', ev("(()=>{const r=rwActive(),p=rwProg(r),g=rwGrid(r);return document.querySelectorAll('.card.rw .rw-tiles i.open').length===Math.floor(p.frac*g.cells)})()"))
    ev("S.rewards=[];render();document.querySelector('#view').scrollTop=330;0"); shot('3-empty')
    ok('empty state offers a pick', ev("!!document.querySelector('[data-a=rwNew]')")); ok('no numbered steps', ev("!document.querySelector('.rw-how')"))
    # product from a real store page
    ev("window.__js=%s;window.__html=%s;rwGet=u=>Promise.resolve(/\\.js$/.test(u)?__js:__html);0" % (json.dumps(js), json.dumps(html)))
    ev("A.rwNew();D.rw.url='scuffers.com/products/bimbobox-dark-green-jacket';A.rwFind();0"); pg.wait_for_timeout(500)
    p = ev("JSON.parse(JSON.stringify(D.rw.p))"); print(p['name'], p['cur'], p['store'], len(p['variants']), p['img'][:60])
    ok('name read', p['name'] == 'Bimbobox Dark Green Jacket'); ok('sizes read', len(p['variants']) >= 3); ok('price read', p['variants'][0]['price'] == 89)
    ok('currency read', p['cur'] == 'EUR'); ok('image is https', p['img'].startswith('https://'))
    shot('4-pick', 1200)
    ev("A.rwSize({dataset:{i:'2'}});A.rwStep({dataset:{to:'goal'}});0"); shot('5-goal')
    t0 = ev("D.rw.target"); ev("A.rwTarget({dataset:{d:'1'}});0"); ok('stepper works', ev("D.rw.target") == t0 + 1)
    ev("A.rwStep({dataset:{to:'lock'}});D.rw.witness='Maya';D.rw.seal='Gift card 1234-5678';drawSheets(false);0"); shot('6-lock')
    # a tap must not lock; a hold must
    pg.click('.rw-hold'); pg.wait_for_timeout(200); ok('tap does not lock', ev("!rwActive()"))
    box = pg.locator('.rw-hold').bounding_box(); pg.mouse.move(box['x'] + 50, box['y'] + 20); pg.mouse.down(); pg.wait_for_timeout(1600); pg.mouse.up(); pg.wait_for_timeout(300)
    r = ev("JSON.parse(JSON.stringify(rwActive()))"); print(r)
    ok('hold locks', bool(r)); ok('checkout link goes to the cart', r and r['buy'].startswith('https://scuffers.com/cart/') and r['buy'].endswith(':1'), r and r['buy'])
    ok('size kept', r and r['size'] == p['variants'][2]['title'])
    ok('witness and seal kept', r['witness'] == 'Maya' and r['seal'] == 'Gift card 1234-5678')
    ok('sealed note is hidden while locked', '1234' not in ev("document.querySelector('#view').textContent") and 'sealed inside' in ev("document.querySelector('#view').textContent"))
    ok('asks to send the deal to the witness', 'Send the deal to Maya' in ev("document.querySelector('#view').textContent"))
    ev("document.querySelector('#view').scrollTop=330;0"); shot('7-locked', 3200)
    ok('second reward refused', ev("A.rwNew();!D.rw"))
    ev("A.rwOpts({dataset:{id:rwActive().id}});0"); shot('8-undo'); ok('undo offered in first day', ev("!!document.querySelector('[data-a=rwUndo]')"))
    ev("closeAll();S.offset+=2*DAY;A.rwOpts({dataset:{id:rwActive().id}});0"); shot('9-options')
    ok('no undo after a day', ev("!document.querySelector('[data-a=rwUndo]')")); ok('give up needs two taps', ev("A.rwQuit({dataset:{id:rwActive().id}});rwActive()!=null"))
    # pause moves the end date
    e0 = ev("rwActive().end"); ev("closeAll();A.rwPause({dataset:{id:rwActive().id}});S.offset+=3*DAY;A.rwPause({dataset:{id:rwActive().id}});0")
    ok('pause moves the end by 3 days', abs(ev("rwActive().end") - e0 - 3 * 86400000) < 5000); ok('only one pause', ev("rwActive().paused===true"))
    # a check-in counts
    d0 = ev("rwProg(rwActive()).done"); ev("doCheckin({type:'lift',mins:45,effort:3,lifts:[],caption:'',photo:null,verified:true});0")
    ok('a check-in adds a day', ev("rwProg(rwActive()).done") == d0 + 1, (d0,))
    ev("doCheckin({type:'lift',mins:45,effort:3,lifts:[],caption:'',photo:null,verified:true});0"); ok('two in one day count once', ev("rwProg(rwActive()).done") == d0 + 1)
    ok('after a check-in the new piece shows', ev("rwDoneLine().includes('Piece '+rwProg(rwActive()).done+' of')&&rwDoneLine().includes('open new')"))
    # win
    ev("rwActive().target=rwProg(rwActive()).done;closeAll();S.ui.tab='home';render();rwTick();0"); shot('10-won', 900)
    ok('win opens the celebration', ev("!!document.querySelector('.rw-win')")); ok('win shows the sealed note', '1234-5678' in ev("document.querySelector('.rw-win').textContent")); href = ev("(document.querySelector('.rw-win a.btn-go')||{}).href||''"); ok('celebration links to checkout', '/cart/' in href, href)
    ev("closeAll();render();document.querySelector('#view').scrollTop=330;0"); shot('11-earned')
    ok('earned card stays until ordered', ev("!!document.querySelector('.card.rw.won')")); ok('can lock the next one', ev("!!document.querySelector('[data-a=rwNew]')"))
    ev("A.rwBought({dataset:{id:rwCurrent().id}});0")
    # miss
    ev("A.rwNew();D.rw.manual=true;D.rw.name='Running shoes';D.rw.price=140;D.rw.target=25;D.rw.seal='combo 4-4-2';D.rw.witness='Leo';A.rwLock();0")
    ok('typed-in reward locks', ev("rwActive()&&rwActive().name==='Running shoes'"))
    ev("S.offset+=40*DAY;rwTick();render();document.querySelector('#view').scrollTop=330;0"); shot('12-missed')
    ok('missed after the date', ev("S.rewards[S.rewards.length-1].state") == 'missed')
    vt = ev("document.querySelector('#view').textContent"); ok('miss is named, with the witness', 'You missed Running shoes' in vt and 'Tell Leo' in vt); ok('record shown', 'Kept 1 of 2' in vt, vt[-300:])
    ok('a missed seal stays shut', 'combo' not in vt and 'Sealed until' in vt); ok('missed seal opens 30 days later', ev("S.offset+=31*DAY;A.rwSealOpen({dataset:{id:S.rewards[S.rewards.length-1].id}});const z=document.querySelector('#layer').textContent.includes('combo 4-4-2');closeAll();S.offset-=31*DAY;render();z")); ok('history lists both', ev("document.querySelectorAll('.rw-past').length") == 2)
    ok('missed item is locked out', ev("rwLockedOut({name:'running shoes',url:''})>now()&&!document.querySelector('.rw-past [data-a=rwAgain]')"))
    ok('locked-out item cannot be picked', ev("A.rwNew();D.rw.manual=true;D.rw.name='Running shoes';A.rwStep({dataset:{to:'goal'}});A.rwLock();const z=D.rw.step==='pick'&&!rwActive();closeAll();z"))
    ev("S.offset+=31*DAY;render();0")
    ok('try again starts at the goal', ev("A.rwAgain({dataset:{id:S.rewards[S.rewards.length-1].id}});D.rw.step==='goal'&&D.rw.p.name==='Running shoes'"))
    # weight guardrails
    ev("S.settings.units='kg';S.weights=[{ts:now()-DAY,kg:80}];S.body={sex:'m',age:25,weight:80,cm:180,act:2,goal:'lose',pace:.5};D.rw.kind='weight';D.rw.period='30';0")
    chk = lambda w: ev("D.rw.toW=%s;JSON.parse(JSON.stringify(rwWeightCheck(D.rw,rwPeriod(D.rw)[2])))" % w)
    ok('safe loss accepted', chk(78).get('ok') is True); ok('crash loss refused', not chk(70).get('ok')); ok('gain capped', not chk(84).get('ok'))
    ev("S.body.age=16;0"); ok('under 18 refused', not chk(78).get('ok')); ev("S.body.age=25;S.body.cm=200;S.weights=[{ts:now()-DAY,kg:75}];0"); ok('healthy-weight floor', not chk(73.5).get('ok'), chk(73.5))
    ev("S.body.cm=180;S.weights=[{ts:now()-DAY,kg:80}];D.rw.toW=78;drawSheets(false);0"); shot('13-weight')
    ev("A.rwStep({dataset:{to:'lock'}});A.rwLock();0"); ok('weight reward locks', ev("rwActive()&&rwActive().kind==='weight'&&rwActive().toKg===78"))
    ev("S.weights.push({ts:now()+DAY,kg:77.9});S.weights.shift();S.offset+=DAY+HOUR;rwTick();0"); pg.wait_for_timeout(200)
    ok('reaching the weight wins', ev("S.rewards[S.rewards.length-1].state") == 'won'); shot('14-weight-won', 600)
    # other stores
    o = ev("""JSON.parse(JSON.stringify(rwParse(new URL('https://www.example-shop.com/p/123'),'','<title>x</title><meta content="Trail &amp; Road Shoe" property="og:title"><meta property="og:image" content="https://img.example.com/a.jpg"><meta property="product:price:amount" content="1.299,50"><meta property="product:price:currency" content="eur">')))""")
    ok('non-Shopify page read', o and o['name'] == 'Trail & Road Shoe' and o['variants'][0]['price'] == 1299.5 and o['cur'] == 'EUR' and o['store'] == 'Example-shop', o)
    ok('junk link refused', ev("rwLookup('not a link').then(x=>x===null)")); ok('unsafe link dropped', ev("rwHttps('javascript:alert(1)')===''"))
    ev("closeAll();S.rewards=[];S.offset+=3*DAY;tick();A.goCam();gotPhoto(null,'gym');0"); pg.wait_for_timeout(1500)
    ok('check-in button has no points', 'point' not in ev("document.querySelector('#ci-post').textContent").lower())
    ev("A.ciPost();0"); pg.wait_for_timeout(600); txt = ev("document.querySelector('#layer').textContent").lower(); shot('15-done')
    ok('done screen has no points', 'point' not in txt, txt[:200])
    ev("closeAll();A.camClose&&A.camClose();S.ui.tab='you';S.ui.youSeg='training';render();0"); ok('training has no points', 'point' not in ev("document.querySelector('#view').textContent").lower()); shot('16-training')
    print('page errors:', errs); ok('no page errors', not errs)
    b.close()
print('FAILED: ' + ', '.join(fails) if fails else 'ALL PASS')

sys.exit(1 if fails else 0)
