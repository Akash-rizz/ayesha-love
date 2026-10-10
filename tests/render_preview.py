"""QA helper: renders the heart word layout to a PNG so it can be eyeballed.

Reads the JSON written by tests/heart-layout.test.js and draws every word at
its exact position/size, plus the heart boundary as a faint guide.

    node tests/heart-layout.test.js        # writes tests/layout.json
    python3 tests/render_preview.py tests/layout.json /tmp/heart.png

`draw_heart()` is reused by make_share_card.py to build the social preview.
"""
import glob
import os
import json
import sys

from PIL import Image, ImageDraw, ImageFont

PREFIX = os.environ.get("PREFIX", "/data/data/com.termux/files/usr")
_CANDIDATES = [
    os.path.join(PREFIX, "share/fonts/TTF/DejaVuSerif.ttf"),
    "/system/fonts/NotoSerif-Regular.ttf",
    "/system/fonts/DroidSerif.ttf",
]
FONT = next((p for p in _CANDIDATES if os.path.exists(p)), None)
if not FONT:
    hits = glob.glob(os.path.join(PREFIX, "share/fonts/**/*.ttf"), recursive=True)
    FONT = hits[0]
FONT_ITALIC = FONT.replace(".ttf", "-Italic.ttf")
if not os.path.exists(FONT_ITALIC):
    FONT_ITALIC = FONT
SCALE = 26          # px per heart unit
PAD = 24            # png margin


def draw_heart(img, data, to_px, scale=SCALE, ink=(245, 239, 239, 255),
               outline=(60, 22, 30, 255)):
    """Draw the contour + every word of a layout onto `img` (in place)."""
    d = ImageDraw.Draw(img)
    curve = data["curve"]

    def xy(p):
        return (p["x"], p["y"]) if isinstance(p, dict) else (p[0], p[1])

    pts = [to_px(float(x), float(y)) for x, y in (xy(p) for p in curve)]
    d.line(pts + [pts[0]], fill=outline[:3], width=2)

    for word in data["words"]:
        size_px = max(9, int(round(word["size"] * scale)))
        font = ImageFont.truetype(FONT, size_px)
        cx, cy = to_px(word["x"], word["y"])
        bbox = d.textbbox((0, 0), word["text"], font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        # Fit the glyph run to the width the layout reserved for it, so the
        # preview shows real packing (the browser uses the same reserved box).
        target_w = word["uw"] * word["size"] * scale
        layer = Image.new("RGBA", (max(1, tw) + 4, max(1, th) + 4), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((2 - bbox[0], 2 - bbox[1]), word["text"],
                                   font=font, fill=ink)
        if abs(tw - target_w) > 1 and tw > 0:
            layer = layer.resize((max(1, int(round(target_w))) + 4, layer.height),
                                 Image.LANCZOS)
        d._image.paste(layer, (int(round(cx - layer.width / 2)),
                               int(round(cy - layer.height / 2))), layer)


def render_heart(layout, scale):
    """Returns an (RGBA image, (w, h)) of the heart on a transparent canvas."""
    box = layout["box"]
    w = int((box["maxX"] - box["minX"]) * scale) + 2 * PAD
    h = int((box["maxY"] - box["minY"]) * scale) + 2 * PAD
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def to_px(x, y):
        return (PAD + (x - box["minX"]) * scale, PAD + (y - box["minY"]) * scale)

    draw_heart(img, layout, to_px, scale=scale)
    return img


def main(src, dst):
    data = json.load(open(src))
    box = data["box"]
    w = int((box["maxX"] - box["minX"]) * SCALE) + 2 * PAD
    h = int((box["maxY"] - box["minY"]) * SCALE) + 2 * PAD

    img = Image.new("RGB", (w, h), (8, 7, 8))

    def to_px(x, y):
        return (PAD + (x - box["minX"]) * SCALE, PAD + (y - box["minY"]) * SCALE)

    draw_heart(img, data, to_px)

    img.save(dst)
    print("wrote", dst, img.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
