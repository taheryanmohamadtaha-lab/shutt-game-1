# میانگین رنگ بافت‌ها برای هر متریال (GLB یا glTF+فایل‌های بافت) — python3 avg_colors.py in.glb|in.gltf out.json
import sys, json, struct, io
from PIL import Image
import os
IS_GLTF = sys.argv[1].endswith('.gltf')
if IS_GLTF:
    j = json.load(open(sys.argv[1])); glb = b''; bo = 0
else:
    glb = open(sys.argv[1], 'rb').read()
    jl = struct.unpack('<I', glb[12:16])[0]
    j = json.loads(glb[20:20+jl])
    bo = 20 + jl + 8
def lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
out = {}
for mi, m in enumerate(j['materials']):
    pm = m['pbrMetallicRoughness']; f = pm.get('baseColorFactor', [1, 1, 1, 1])
    col = [f[0], f[1], f[2]]
    t = pm.get('baseColorTexture')
    if t is not None:
        img = j['images'][j['textures'][t['index']]['source']]
        if IS_GLTF:
            import urllib.parse
            im = Image.open(os.path.join(os.path.dirname(sys.argv[1]), urllib.parse.unquote(img['uri']))).convert('RGBA')
        else:
            bv = j['bufferViews'][img['bufferView']]
            im = Image.open(io.BytesIO(glb[bo+bv.get('byteOffset', 0): bo+bv.get('byteOffset', 0)+bv['byteLength']])).convert('RGBA')
        im.thumbnail((32, 32))
        px = [p for p in im.getdata() if p[3] > 40] or [(128, 128, 128, 255)]
        n = len(px)
        avg = [sum(p[k] for p in px) / n for k in range(3)]
        col = [col[k] * lin(avg[k]) for k in range(3)]
    out[mi] = col
json.dump(out, open(sys.argv[2], 'w'))
print({m['name'].replace('VuMaterialAsset_', ''): [round(c, 2) for c in out[i]] for i, m in enumerate(j['materials'])})
