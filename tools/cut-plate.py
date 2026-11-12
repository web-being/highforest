# Cut a whitened botanical plate out of its paper: paper becomes transparent, the drawing keeps
# its own colours. Printed areas stay opaque (so a coloured ground does not tint them); only the
# one-to-two-pixel fringe next to paper is given partial alpha and has the white taken out of it.
# Needs numpy, scipy and Pillow. The plates on white paper are kept in atlas/plates/.
# usage: python3 tools/cut-plate.py atlas/plates/<name>.webp out.png
#        cwebp -q 84 -alpha_q 92 out.png -o botanical-terpenes/plates/<name>.webp
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
P = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32) / 255
w = P.min(axis=2)                                        # 1 = white paper
paper = w > 0.94                                         # faint tone left in the paper counts as paper
paper[:3] = paper[-3:] = paper[:, :3] = paper[:, -3:] = True   # scan edges
d = ndi.distance_transform_edt(~paper)                   # px from a printed pixel to the nearest paper
inside = np.clip((d - 0.5) / 1.5, 0, 1)                  # 0 on the fringe, 1 from two pixels in
fringe = np.clip((1 - w) * 2.5, 0, 1)                    # alpha a fringe pixel can justify by its own darkness
a = np.where(paper, 0, fringe + (1 - fringe) * inside)

# dust: isolated specks of a few pixels
lab, n = ndi.label(a > 0.2)
if n:
    size = ndi.sum(np.ones_like(a), lab, index=np.arange(1, n + 1))
    a[np.isin(lab, np.flatnonzero(size < 6) + 1)] = 0

# take the white back out of partially transparent pixels: P = a·C + (1 − a)·white
safe = np.maximum(a, 1e-3)[..., None]
C = np.clip((P - (1 - a[..., None])) / safe, 0, 1)
C = np.where(a[..., None] > 0.999, P, C)
rgba = np.dstack([C, a])
Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(out)
print(src.split('/')[-1], 'transparent %.1f%%' % ((a == 0).mean() * 100), 'partial %.1f%%' % (((a > 0) & (a < 1)).mean() * 100))
