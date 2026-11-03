# -*- coding: utf-8 -*-
"""生成插件列表用的 180x180 位图图标（列表不收 SVG）。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "icon-180.png")
os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

d.rounded_rectangle([0, 0, S - 1, S - 1], radius=112, fill=(16, 24, 38, 255))

# 盾牌
shield = [(256, 78), (392, 128), (392, 232), (376, 300), (322, 372), (256, 412),
          (190, 372), (136, 300), (120, 232), (120, 128)]
d.polygon(shield, outline=(91, 158, 255, 255), width=20)
d.line(shield + [shield[0]], fill=(91, 158, 255, 255), width=20, joint="curve")

# 两条被"打码"的横线
d.rounded_rectangle([178, 196, 334, 220], radius=11, fill=(143, 160, 189, 255))
d.rounded_rectangle([178, 244, 300, 268], radius=11, fill=(143, 160, 189, 255))

# 斜杠：划掉
d.line([(176, 320), (336, 160)], fill=(43, 217, 165, 255), width=24)
d.ellipse([176 - 12, 320 - 12, 176 + 12, 320 + 12], fill=(43, 217, 165, 255))
d.ellipse([336 - 12, 160 - 12, 336 + 12, 160 + 12], fill=(43, 217, 165, 255))

img.resize((180, 180), Image.LANCZOS).save(OUT)
print("saved", OUT)
