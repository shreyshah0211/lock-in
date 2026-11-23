# Accounts, end to end, against a stand-in server that behaves like the Supabase project:
# sign up with an emailed code, pick a username, start empty, add a friend, accept a
# request, check in, sign out, sign back in on a "new phone", delete the account.
# usage: account_test.py [screenshot folder]
import os, sys, json, re, tempfile, pathlib, urllib.parse
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
BASE = 'https://lockin-test.supabase.co'
html = (root/'dist/index.html').read_text()
assert 'const BACKEND = null;' in html or 'const BACKEND = {' in html
html = re.sub(r'const BACKEND = (null|\{[^;]*\});', 'const BACKEND = ' + json.dumps({'url': BASE, 'key': 'test-key'}) + ';', html, count=1)
page_file = root/'dist/_account_test.html'; page_file.write_text(html)
url = 'file://' + str(page_file)

fails = []
def ok(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra)[:300] if extra != '' and not cond else ''))
    if not cond: fails.append(name)

# ---- the stand-in server ----
DB = {'users': {}, 'profiles': {}, 'state': {}, 'photos': {}, 'follows': {}, 'posts': {}, 'codes': {}, 'tokens': {}, 'log': []}
def seed_person(uid, username, name, last=0):
    DB['users'][uid] = username + '@example.com'
    DB['profiles'][uid] = {'id': uid, 'username': username, 'name': name, 'color': '#D9466B', 'campus': '', 'gym': 'IMA', 'bio': '', 'last_checkin': last, 'streak_start': last or None, 'best': 3, 'total': 9, 'lost': None}
def who(req):
    return DB['tokens'].get((req.headers.get('authorization') or '').replace('Bearer ', ''))
def session(uid):
    n = len(DB['tokens']) + 1; tok = 'tok%d' % n; DB['tokens'][tok] = uid
    return {'access_token': tok, 'refresh_token': 'ref-' + uid, 'expires_in': 3600, 'user': {'id': uid, 'email': DB['users'][uid]}}
def handle(route):
    req = route.request; u = urllib.parse.urlparse(req.url); q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
    body = json.loads(req.post_data) if req.post_data else None; path = u.path; m = req.method
    DB['log'].append(m + ' ' + path)
    def send(data=None, status=200): route.fulfill(status=status, content_type='application/json', body=json.dumps(data) if data is not None else '', headers={'access-control-allow-origin': '*'})
    if m == 'OPTIONS': return route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    if req.headers.get('apikey') != 'test-key': return send({'message': 'no api key'}, 401)
    if path == '/auth/v1/otp':
        DB['codes'][body['email']] = '123456'; return send({})
    if path == '/auth/v1/verify':
        if DB['codes'].get(body['email']) != body['token']: return send({'error_code': 'otp_expired', 'msg': 'Token has expired or is invalid'}, 403)
        uid = next((k for k, e in DB['users'].items() if e == body['email']), None)
        if not uid: uid = 'u%d' % (len(DB['users']) + 1); DB['users'][uid] = body['email']
        return send(session(uid))
    if path == '/auth/v1/token':
        uid = body['refresh_token'].replace('ref-', '')
        return send(session(uid)) if uid in DB['users'] else send({'error_code': 'refresh_token_not_found'}, 400)
    me = who(req)
    if not me or me not in DB['users']: return send({'message': 'JWT expired'}, 401)
    if path == '/auth/v1/logout': return send(None, 204)
    eq = lambda k: (q.get(k) or '').replace('eq.', '')
    if path == '/rest/v1/profiles':
        if m == 'POST':
            if body['id'] != me: return send({'code': '42501'}, 403)
            if not re.match(r'^[a-z0-9_]{3,20}$', body['username']): return send({'code': '23514'}, 400)
            if any(p['username'] == body['username'] and k != me for k, p in DB['profiles'].items()): return send({'code': '23505', 'message': 'duplicate key'}, 409)
            DB['profiles'][me] = {k: v for k, v in body.items() if k != 'updated_at'}; return send(None, 201)
        if 'id' in q and q['id'].startswith('eq.'): return send([p for k, p in DB['profiles'].items() if k == eq('id')])
        pat = q.get('username', '').replace('ilike.', '').rstrip('*')
        return send([p for k, p in DB['profiles'].items() if p['username'].startswith(pat) and k != me])
    if path == '/rest/v1/user_state':
        if m == 'POST': DB['state'][me] = body['data']; return send(None, 201)
        return send([{'data': DB['state'][me]}] if me in DB['state'] else [])
    if path == '/rest/v1/user_photos':
        if m == 'POST': DB['photos'][(me, body['key'])] = body['data']; return send(None, 201)
        k = (me, eq('key')); return send([{'data': DB['photos'][k]}] if k in DB['photos'] else [])
    if path == '/rest/v1/follows':
        if m == 'POST':
            if body['follower'] != me or body.get('status', 'pending') != 'pending': return send({'code': '42501'}, 403)
            if (me, body['followee']) in DB['follows']: return send({'code': '23505'}, 409)
            DB['follows'][(me, body['followee'])] = 'pending'; return send(None, 201)
        if m == 'DELETE':
            k = (eq('follower'), eq('followee'))
            if me in k: DB['follows'].pop(k, None)
            return send(None, 204)
        if 'follower' in q: return send([{'status': st, 'p': DB['profiles'].get(b)} for (a, b), st in DB['follows'].items() if a == me])
        return send([{'p': DB['profiles'].get(a)} for (a, b), st in DB['follows'].items() if b == me and st == 'pending'])
    if path == '/rest/v1/rpc/accept_follow':
        k = (body['from_id'], me)
        if DB['follows'].get(k) == 'pending': DB['follows'][k] = 'ok'; DB['follows'][(me, body['from_id'])] = 'ok'
        return send(None, 204)
    if path == '/rest/v1/posts':
        if m == 'POST':
            if body['user_id'] != me: return send({'code': '42501'}, 403)
            DB['posts'][body['id']] = body; return send(None, 201)
        can = lambda p: p['user_id'] == me or DB['follows'].get((me, p['user_id'])) == 'ok'
        if 'id' in q: return send([{'photo': p.get('photo')} for k, p in DB['posts'].items() if k == eq('id') and can(p)])
        return send(sorted([{k: v for k, v in p.items() if k != 'photo'} for p in DB['posts'].values() if can(p)], key=lambda p: -p['ts']))
    if path == '/rest/v1/rpc/delete_me':
        for t in ('users', 'profiles', 'state'): DB[t].pop(me, None)
        DB['follows'] = {k: v for k, v in DB['follows'].items() if me not in k}; DB['posts'] = {k: p for k, p in DB['posts'].items() if p['user_id'] != me}
        return send(None, 204)
    send({'message': 'not found ' + path}, 404)

PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ['CHROME'])
    def phone():
        ctx = b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
        pg.route(BASE + '/**', handle); pg.goto(url); pg.wait_for_timeout(700)
        pg.add_style_tag(content=":root{--sat:59px !important}")
        return pg
    pg = phone(); ev = pg.evaluate; n = [0]
    def shot(name): n[0] += 1; pg.wait_for_timeout(350); pg.screenshot(path='%s/a%02d-%s.png' % (out, n[0], name))
    text = lambda: ev("document.querySelector('#view').textContent")
    now_ms = ev("Date.now()")
    seed_person('maya', 'maya_lifts', 'Maya Okafor', now_ms - 3 * 3600000); seed_person('leo', 'leo_p', 'Leo Park', now_ms - 30 * 3600000)
    DB['posts']['pm1'] = {'id': 'pm1', 'user_id': 'maya', 'ts': now_ms - 3 * 3600000, 'type': 'legs', 'mins': 50, 'effort': 3, 'caption': 'Squats', 'day': 12, 'photo': PIXEL, 'scene': None, 'pr': None, 'verified': True}

    # signed out, and nothing made up underneath
    ok('opens on the sign-in screen', ev("document.querySelector('#phone').classList.contains('gate')") and 'Send my code' in text()); shot('signin')
    ok('no sample people or data', ev("S.friends.length===0&&S.posts.length===0&&S.checkins.length===0&&S.meals.length===0&&S.me.name===''&&S.mode==='real'&&(S.rewards||[]).length===0"))
    ok('tab bar is hidden while signed out', ev("getComputedStyle(document.querySelector('#tabs')).display") == 'none')
    pg.fill('#gate-email', 'not-an-email'); pg.click('[data-a=gateSend]'); pg.wait_for_timeout(200); ok('bad email refused before sending', 'does not look like an email' in text() and '/auth/v1/otp' not in ' '.join(DB['log']))
    pg.fill('#gate-email', 'Shrey@Example.com'); pg.click('[data-a=gateSend]'); pg.wait_for_timeout(500)
    ok('code is sent and the code screen shows', 'Check your email' in text() and DB['codes'].get('shrey@example.com') == '123456'); shot('code')
    pg.fill('#gate-code', '000000'); pg.wait_for_timeout(600); ok('wrong code refused', 'wrong or has expired' in text() and ev("!ACCT.s"))
    pg.fill('#gate-code', '123456'); pg.wait_for_timeout(900)
    ok('right code signs in and asks who you are', ev("!!ACCT.s&&ACCT.s.email==='shrey@example.com'") and 'Who are you?' in text()); shot('profile')
    pg.fill('#gate-name', 'Shrey'); pg.fill('#gate-handle', 'maya_lifts'); pg.click('[data-a=gateProfile]'); pg.wait_for_timeout(500); ok('taken username refused', 'username is taken' in text())
    pg.fill('#gate-handle', 'No Spaces!'); pg.click('[data-a=gateProfile]'); pg.wait_for_timeout(300); ok('bad username refused', '3 to 20 letters' in text())
    pg.fill('#gate-handle', 'shrey'); pg.click('[data-a=gateProfile]'); pg.wait_for_timeout(900)
    me = ev("ACCT.s.uid")
    ok('profile saved and the app opens', ev("!document.querySelector('#phone').classList.contains('gate')") and DB['profiles'].get(me, {}).get('username') == 'shrey'); shot('home-empty')
    ok('home is empty with a way to add friends', 'Add your friends' in text() and 'No streak yet' in text())
    ok('your data row is created on the server', me in DB['state'] and DB['state'][me]['checkins'] == [])

    # friends
    ev("A.openFriends({dataset:{seg:'find'}});0"); pg.fill('#fr-search', 'may'); pg.wait_for_timeout(900); lt = ev("document.querySelector('#layer').textContent")
    ok('finds a person by username', 'Maya Okafor' in lt and '@maya_lifts' in lt, lt); shot('find')
    pg.click('#layer [data-a=follow]'); pg.wait_for_timeout(500); ok('add sends a request, not a friendship', DB['follows'].get((me, 'maya')) == 'pending' and 'Requested' in ev("document.querySelector('#layer').textContent") and ev("S.friends.length") == 0)
    ok('a pending request shows none of their photos', ev("acctPull().then(()=>S.posts.length)") == 0)
    DB['follows'][(me, 'maya')] = 'ok'; DB['follows'][('maya', me)] = 'ok'; DB['follows'][('leo', me)] = 'pending'
    ev("closeAll();acctPull().then(()=>0)"); pg.wait_for_timeout(700)
    ok('an accepted friend appears with their clock', ev("S.friends.length===1&&S.friends[0].name==='Maya Okafor'&&pAlive(S.friends[0])"))
    ok('their check-in is in the feed', ev("S.posts.length===1&&S.posts[0].uid==='maya'") and ev("!!document.querySelector('.feed .post')"))
    pg.wait_for_timeout(700); ok('their photo is fetched', ev("PHOTOS['r:pm1']") == PIXEL); shot('home-friend')
    ok('a request for you is waiting', ev("S.requests.length===1&&S.requests[0].name==='Leo Park'"))
    ev("A.openFriends({dataset:{seg:'req'}});0"); pg.wait_for_timeout(200); pg.click('#layer [data-a=reqYes]'); pg.wait_for_timeout(900)
    ok('accepting makes you friends both ways', DB['follows'].get(('leo', me)) == 'ok' and DB['follows'].get((me, 'leo')) == 'ok' and ev("S.friends.length") == 2)
    ev("closeAll();A.openProfile({dataset:{id:'maya'}});0"); pg.wait_for_timeout(300); lt = ev("document.querySelector('#layer').textContent"); shot('friend')
    ok('a real friend has no nudge or duo buttons', 'Nudge' not in lt and 'duo' not in lt.lower() and 'Tap to remove' in lt)

    # your own check-in goes to your account and to friends
    ev("closeAll();savePhoto('ph1','%s');doCheckin({type:'push',mins:40,effort:3,lifts:[],caption:'Chest',photo:'ph1',verified:true,audience:'friends'});save();0" % PIXEL); pg.wait_for_timeout(1500)
    mine = [p for p in DB['posts'].values() if p['user_id'] == me]
    ok('check-in is posted for friends with its photo', len(mine) == 1 and mine[0]['photo'] == PIXEL and mine[0]['caption'] == 'Chest', mine)
    ok('profile carries the new streak', DB['profiles'][me]['last_checkin'] > 0 and DB['profiles'][me]['streak_start'] and DB['profiles'][me]['total'] == 1)
    ok('check-in is saved to your account', len(DB['state'][me]['checkins']) == 1 and DB['photos'].get((me, 'ph1')) == PIXEL)
    ev("S.meals.push({id:'m1',ts:now(),name:'Eggs',kcal:300,p:20,c:2,f:22,slot:'breakfast'});save();0"); pg.wait_for_timeout(1200); ok('a meal is saved to your account', len(DB['state'][me]['meals']) == 1)
    ok('food never goes into anything friends can read', 'Eggs' not in json.dumps(DB['posts']) + json.dumps(DB['profiles']))
    ev("A.openSettings();0"); pg.wait_for_timeout(300); lt = ev("document.querySelector('#layer').textContent"); shot('settings')
    ok('settings show the account, not sample tools', 'shrey@example.com' in lt and 'Sign out' in lt and 'Delete my account' in lt and 'sample' not in lt.lower())

    # sign out, then sign in again on another phone
    ev("A.acctSignOut();0"); pg.wait_for_timeout(700)
    ok('sign out returns to sign-in and clears the phone', 'Send my code' in text() and ev("S.checkins.length===0&&S.friends.length===0&&!localStorage.getItem('lockin.session.v1')"))
    p2 = phone(); pg = p2; ev = pg.evaluate
    pg.fill('#gate-email', 'shrey@example.com'); pg.click('[data-a=gateSend]'); pg.wait_for_timeout(400); pg.fill('#gate-code', '123456'); pg.wait_for_timeout(1800)
    ok('signing in again skips the name step', ev("!document.querySelector('#phone').classList.contains('gate')&&S.me.handle==='shrey'"))
    ok('your streak, check-in and meal come back', ev("S.checkins.length===1&&S.meals.length===1&&pAlive(S.me)&&pDays(S.me)===1"), ev("[S.checkins.length,S.meals.length]"))
    ok('your friends come back', ev("S.friends.length") == 2); shot('second-phone')
    pg.reload(); pg.wait_for_timeout(1500); ok('stays signed in after closing the app', ev("!document.querySelector('#phone').classList.contains('gate')&&S.checkins.length===1&&!!ACCT.s"))

    # an expired session is renewed quietly
    DB['tokens'].clear(); ev("acctPull().then(()=>0)"); pg.wait_for_timeout(900); ok('an expired session renews itself', ev("!!ACCT.s&&S.friends.length===2") and 'POST /auth/v1/token' in DB['log'])

    # remove a friend, then delete the account
    ev("A.unfollow({dataset:{id:'leo'}});0"); pg.wait_for_timeout(700); ok('removing a friend removes both directions', (me, 'leo') not in DB['follows'] and ('leo', me) not in DB['follows'] and ev("S.friends.length") == 1)
    ev("A.openSettings();A.acctDelete();0"); pg.wait_for_timeout(200); ok('delete needs a second tap', me in DB['users'])
    ev("A.acctDelete();0"); pg.wait_for_timeout(900)
    ok('deleting removes the account and everything in it', me not in DB['users'] and me not in DB['profiles'] and me not in DB['state'] and not [p for p in DB['posts'].values() if p['user_id'] == me])
    ok('and returns to sign-in', 'Send my code' in ev("document.querySelector('#view').textContent")); shot('deleted')
    print('page errors:', p2.errs); ok('no page errors', not p2.errs)
    b.close()
page_file.unlink()
print('FAILED: ' + ', '.join(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
