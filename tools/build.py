import base64, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
fm = root/'tools/node_modules/@fontsource-variable'
def face(family, path, weights):
    b = base64.b64encode((fm/path).read_bytes()).decode()
    return '@font-face{font-family:"%s";font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}' % (family, weights, b)
fonts = face('Geist', 'geist/files/geist-latin-wght-normal.woff2', '100 900')
css = (root/'src/styles.css').read_text()
js = '\n'.join(p.read_text() for p in sorted((root/'src/js').glob('*.js')))
import json
cfg = root/'backend.json'
backend = json.loads(cfg.read_text()) if cfg.exists() else None
if backend and not (str(backend.get('url', '')).startswith('https://') and backend.get('key')): backend = None
js = js.replace('/*BACKEND*/null', json.dumps({'url': backend['url'], 'key': backend['key']}) if backend else 'null')
assert '</script' not in js.lower()
html = (root/'src/shell.html').read_text().replace('/*FONTS*/', fonts).replace('/*CSS*/', css).replace('/*JS*/', js)
(root/'dist/index.html').write_text(html)
print('built', len(html)//1024, 'KB')
print('server:', backend['url'] if backend else 'not set (backend.json missing): sign-in is off')
