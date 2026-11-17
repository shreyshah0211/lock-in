import sys, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent / 'shots'
out, names = sys.argv[1], sys.argv[2:]
ims = [Image.open(root/n) for n in names]
w = 390; hs = [int(im.height * w / im.width) for im in ims]
sheet = Image.new('RGB', (w*len(ims) + 12*(len(ims)-1), max(hs)), '#888')
x = 0
for im,h in zip(ims,hs):
    sheet.paste(im.resize((w,h), Image.LANCZOS), (x,0)); x += w+12
sheet.save(root/out)
print(out, sheet.size)
