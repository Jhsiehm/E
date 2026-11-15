"""Regenerate the still Casevex tab icons from the logo mark.

Writes app/icon1.png (16px), app/icon2.png (32px), app/favicon.ico
(16, 32, 48) and app/apple-icon.png. Geometry and colours mirror
lib/favicon-mark.ts (FINE and PIXEL); keep them in step.
Run: python3 scripts/make-favicons.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TILE = "#142f40"
ROSE, PLUM, TEAL, LIGHT = "#a6445d", "#7a4d66", "#62929e", "#9fc1c9"
FINE = dict(size=32, cell=6, gap=2, margin=1, tile_radius=3, box_radius=1)
PIXEL = dict(size=16, cell=3, gap=1, margin=1, tile_radius=2, box_radius=0)


def resting(i):
    if i % 4 == 3:
        return LIGHT
    if i < 3:
        return ROSE
    if i in (4, 5, 8):
        return PLUM
    return TEAL


def draw(layout, px, pad=0.0, square=False):
    """Draw `layout` at `px` pixels. Drawn 8x larger and shrunk so edges
    stay clean. `pad` insets the mark for the iPhone icon, which iOS
    crops to its own rounded shape."""
    ss = 8
    big = px * ss
    k = big / (layout["size"] + 2 * pad)
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tile_r = 0 if square else layout["tile_radius"] * k
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=tile_r, fill=TILE)
    step = layout["cell"] + layout["gap"]
    for i in range(16):
        x = (layout["margin"] + (i % 4) * step + pad) * k
        y = (layout["margin"] + (i // 4) * step + pad) * k
        w = layout["cell"] * k
        d.rounded_rectangle(
            [x, y, x + w - 1, y + w - 1], radius=layout["box_radius"] * k, fill=resting(i)
        )
    return im.resize((px, px), Image.BOX)


icon16, icon32, icon48 = draw(PIXEL, 16), draw(FINE, 32), draw(FINE, 48)
icon16.save(ROOT / "app/icon1.png")
icon32.save(ROOT / "app/icon2.png")
# Pillow builds the .ico from its largest image, so that one goes first.
icon48.save(ROOT / "app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)],
            append_images=[icon16, icon32])
draw(FINE, 180, pad=5, square=True).convert("RGB").save(ROOT / "app/apple-icon.png")
print("wrote app/icon1.png, app/icon2.png, app/favicon.ico, app/apple-icon.png")
