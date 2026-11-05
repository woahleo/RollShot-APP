# Draws the iPhone app icon and splash screen from the Rollshot mark.
# Run from the repo root: python3 scripts/app-icons.py ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png
import sys
from PIL import Image, ImageDraw, ImageFont
FONT = "src/assets/fonts/Outfit-200.ttf"
STOPS = [(253,80,154),(163,133,193),(72,186,232),(143,198,165),(253,200,76)]
def grad(x, w):
    t = x / (w - 1) * (len(STOPS) - 1); i = min(int(t), len(STOPS) - 2); f = t - i
    a, b = STOPS[i], STOPS[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))
def mark(size, bar=True, bg=(255,255,255), ink=(10,10,10)):
    """The Rollshot R-dot mark, laid out like public/icon-512.png, scaled to `size`."""
    s = size / 512
    im = Image.new("RGB", (size, size), bg); d = ImageDraw.Draw(im)
    # Draw the R big, then fit it exactly into the box it has on the 512 icon (152,146 → 309,361).
    f = ImageFont.truetype(FONT, 1200)
    tmp = Image.new("L", (1400, 1400), 0); td = ImageDraw.Draw(tmp); td.text((100, 0), "R", font=f, fill=255)
    glyph = tmp.crop(tmp.getbbox())
    w, h = round((309 - 152 + 1) * s), round((361 - 146 + 1) * s)
    glyph = glyph.resize((w, h), Image.LANCZOS)
    im.paste(Image.new("RGB", (w, h), ink), (round(152 * s), round(146 * s)), glyph)
    d.ellipse((334 * s, 306 * s, 389 * s, 361 * s), fill=(255, 79, 154))
    if bar:
        for x in range(size): d.line([(x, round(489 * s)), (x, size)], fill=grad(x, size))
    return im
if __name__ == "__main__":
    mark(1024).save(sys.argv[1])
    # Splash: the mark small in the middle of a white square, no bar.
    sp = Image.new("RGB", (2732, 2732), (255, 255, 255)); m = mark(560, bar=False)
    sp.paste(m, ((2732 - 560) // 2, (2732 - 560) // 2)); sp.save(sys.argv[2])
