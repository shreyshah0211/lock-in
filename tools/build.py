import base64, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
fm = root/'tools/node_modules/@fontsource-variable'
def face(family, path, weights):
    b = base64.b64encode((fm/path).read_bytes()).decode()
    return '@font-face{font-family:"%s";font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}' % (family, weights, b)
fonts = face('Figtree', 'figtree/files/figtree-latin-wght-normal.woff2', '300 900') + '\n' + face('Big Shoulders Display', 'big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2', '100 900')
css = (root/'src/styles.css').read_text()
js = '\n'.join(p.read_text() for p in sorted((root/'src/js').glob('*.js')))
assert '</script' not in js.lower()
html = (root/'src/shell.html').read_text().replace('/*FONTS*/', fonts).replace('/*CSS*/', css).replace('/*JS*/', js)
(root/'dist/index.html').write_text(html)
print('built', len(html)//1024, 'KB')
