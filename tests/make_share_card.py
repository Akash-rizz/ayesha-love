"""Builds assets/share-card.png — the 1200x630 image shown when the link is
shared in WhatsApp, iMessage, X, Discord, or as a Google/Chrome preview.

    node tests/heart-layout.test.js          # writes tests/layout.json
    python3 tests/make_share_card.py

Reuses draw_heart() from render_preview.py so the card shows the exact same
heart that the site renders.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_preview as rp  # noqa: E402

W, H = 1200, 630
BG = (8, 7, 8)
IVORY = (245, 239, 239)
ROSE = (216, 154, 165)
CRIMSON = (142, 24, 48)

SERIF = rp.FONT
SERIF_IT = rp.FONT_ITALIC
SERIF_BI = rp.FONT_ITALIC.replace("-Italic", "-BoldItalic")
if not os.path.exists(SERIF_BI):
    SERIF_BI = SERIF
SANS = rp.FONT.replace("DejaVuSerif", "DejaVuSans")
if not os.path.exists(SANS):
    SANS = SERIF


def tracked_text(d, xy, text, font, fill, tracking):
    """Letter-spaced text (PIL has no native letter-spacing)."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking
    return x


def main():
    layout = json.load(open(os.path.join(HERE, "layout.json")))
    card = Image.new("RGB", (W, H), BG)

    # soft crimson bloom behind the heart
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(28):
        r = 300 - i * 9
        a = 5
        gd.ellipse([300 - r, 315 - r * 0.92, 300 + r, 315 + r * 0.92],
                   fill=(CRIMSON[0], CRIMSON[1], CRIMSON[2], a))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    card = Image.alpha_composite(card.convert("RGBA"), glow)

    # the heart, exactly as the site lays it out
    heart_h = 470
    scale = heart_h / (layout["box"]["maxY"] - layout["box"]["minY"])
    heart = rp.render_heart(layout, scale)
    card.alpha_composite(heart, (44, (H - heart.height) // 2))

    d = ImageDraw.Draw(card)
    left = 44 + heart.width + 52

    tracked_text(d, (left, 176), "A PRIVATE LITTLE UNIVERSE",
                 ImageFont.truetype(SANS, 19), ROSE, 5.5)

    d.text((left, 208), "I Love You,", font=ImageFont.truetype(SERIF_IT, 78),
           fill=IVORY)
    d.text((left, 300), "Ayesha", font=ImageFont.truetype(SERIF_BI, 92),
           fill=IVORY)
    heart_w = d.textlength("Ayesha", font=ImageFont.truetype(SERIF_BI, 92))
    d.text((left + heart_w + 16, 316), "♥", font=ImageFont.truetype(SERIF, 62),
           fill=ROSE)

    d.rectangle([left, 424, left + 104, 427], fill=CRIMSON)
    d.text((left, 452), "Made with love, just for you.",
           font=ImageFont.truetype(SERIF_IT, 27), fill=ROSE)
    d.text((left, 500), "Tap the link and open your surprise.",
           font=ImageFont.truetype(SANS, 20), fill=(150, 140, 142))

    out = os.path.join(os.path.dirname(HERE), "assets", "share-card.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    card.convert("RGB").save(out, optimize=True)
    print("wrote", out, (W, H),
          "%.0f KB" % (os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
