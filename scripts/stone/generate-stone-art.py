"""Generate the Stone Mode wall, crack and ornament SVGs in public/stone/.

Deterministic (fixed seeds), plain vector paths only: no SVG filters, so the
browser rasterises each tile once. Every colour is a stone neutral and light
falls from the upper left: grooves are dark on their upper-left wall with a
lit lower-right lip.

    python -I scripts/stone/generate-stone-art.py
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "public" / "stone"
DARK = "#3a362f"
GROOVE = "#5f5a52"
LIGHT = "#f3f1ec"


def poly(points):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in points)


def jitter_line(rng, x0, y0, x1, y1, step=36, amp=0.9):
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) / step))
    pts = []
    for i in range(n + 1):
        t = i / n
        j = 0 if i in (0, n) else rng.uniform(-amp, amp)
        if abs(y1 - y0) < abs(x1 - x0):
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + j))
        else:
            pts.append((x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t))
    return pts


def crack_paths(rng, x, y, length, angle, branch=0.35, width=1.1):
    """Random-walk fissure with occasional branches; returns path strings."""
    paths = []
    pts = [(x, y)]
    travelled = 0
    while travelled < length:
        angle += rng.uniform(-0.55, 0.55)
        step = rng.uniform(5, 12)
        x += math.cos(angle) * step
        y += math.sin(angle) * step
        pts.append((x, y))
        travelled += step
        if rng.random() < branch * 0.08 and length - travelled > 40:
            paths += crack_paths(rng, x, y, (length - travelled) * rng.uniform(0.3, 0.6),
                                 angle + rng.choice([-1, 1]) * rng.uniform(0.5, 1.1), branch * 0.5, width * 0.7)
    d = poly(pts)
    paths.insert(0, (d, width))
    return paths


def crack_svg(paths, w, h, dx=0.9):
    body = []
    for d, wdt in paths:
        body.append(f'<path d="{d}" stroke="{LIGHT}" stroke-opacity="0.55" stroke-width="{wdt * 0.8:.2f}" transform="translate({dx} {dx})"/>')
        body.append(f'<path d="{d}" stroke="{DARK}" stroke-opacity="0.5" stroke-width="{wdt:.2f}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">{"".join(body)}</g></svg>\n')


def ashlar(seed=7, W=1600, H=1080):
    """Coursed ashlar wall: staggered blocks, hand-cut joints, pillowed faces,
    chipped arrises and a few old fissures. Tiles seamlessly."""
    rng = random.Random(seed)
    heights = []
    while sum(heights) < H - 200:
        heights.append(rng.randint(150, 205))
    heights.append(H - sum(heights))
    faces, bevels, joints, chips, cracks = [], [], [], [], []
    y = 0
    for ch in heights:
        x = rng.uniform(0, 200)
        stops = []
        while x < W + 1:
            stops.append(x)
            x += rng.uniform(230, 470)
        stops = [s % W for s in stops]
        stops = sorted(set(round(s, 1) for s in stops))
        blocks = [(stops[i], stops[(i + 1) % len(stops)] + (W if i == len(stops) - 1 else 0)) for i in range(len(stops))]
        for x0, x1 in blocks:
            for shift in (-W, 0, W):
                a, b = x0 + shift, x1 + shift
                if b < 0 or a > W:
                    continue
                tone = rng.random()
                if tone < 0.5:
                    faces.append(f'<rect x="{a + 2:.1f}" y="{y + 2}" width="{b - a - 4:.1f}" height="{ch - 4}" fill="#2f2c28" fill-opacity="{rng.uniform(0.0, 0.07):.3f}"/>')
                else:
                    faces.append(f'<rect x="{a + 2:.1f}" y="{y + 2}" width="{b - a - 4:.1f}" height="{ch - 4}" fill="#fffdf8" fill-opacity="{rng.uniform(0.0, 0.07):.3f}"/>')
                # Pillowed face: lit upper-left arris, shaded lower-right.
                bevels.append(f'<path d="{poly([(a + 4, y + ch - 5), (a + 4, y + 4), (b - 5, y + 4)])}" stroke="{LIGHT}" stroke-opacity="0.62" stroke-width="3"/>')
                bevels.append(f'<path d="{poly([(a + 5, y + ch - 4), (b - 4, y + ch - 4), (b - 4, y + 5)])}" stroke="{DARK}" stroke-opacity="0.24" stroke-width="3.2"/>')
                # Vertical joint (left edge of each block).
                vj = jitter_line(rng, a, y, a, y + ch, step=30, amp=0.8)
                joints.append(poly(vj))
                if rng.random() < 0.28:
                    cx, cy = (a + 3, y + 3) if rng.random() < 0.5 else (b - 3, y + ch - 3)
                    s = rng.uniform(7, 15)
                    sx = 1 if cx < (a + b) / 2 else -1
                    sy = 1 if cy < y + ch / 2 else -1
                    chips.append(f'<path d="{poly([(cx, cy), (cx + sx * s, cy), (cx, cy + sy * s * 0.8)])}Z" fill="{DARK}" fill-opacity="0.12"/>')
        joints.append(poly(jitter_line(rng, -10, y, W + 10, y, step=40, amp=0.9)))
        y += ch
    for _ in range(5):
        cx, cy = rng.uniform(120, W - 120), rng.uniform(120, H - 120)
        for d, wdt in crack_paths(rng, cx, cy, rng.uniform(90, 260), rng.uniform(0, math.tau)):
            cracks.append((d, wdt))
    crack_markup = "".join(
        f'<path d="{d}" stroke="{LIGHT}" stroke-opacity="0.5" stroke-width="{w * 0.8:.2f}" transform="translate(0.9 0.9)"/>'
        f'<path d="{d}" stroke="{DARK}" stroke-opacity="0.55" stroke-width="{w * 1.2:.2f}"/>' for d, w in cracks)
    joint_d = " ".join(joints)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        "<!-- Coursed ashlar wall for Stone Mode (generated by scripts/stone/generate-stone-art.py). -->"
        f'<g>{"".join(faces)}</g>'
        f'<g fill="none" stroke-linecap="round">{"".join(bevels)}</g>'
        f'<g>{"".join(chips)}</g>'
        f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
        f'<path d="{joint_d}" stroke="{LIGHT}" stroke-opacity="0.7" stroke-width="2" transform="translate(2.2 2.2)"/>'
        f'<path d="{joint_d}" stroke="{GROOVE}" stroke-opacity="0.7" stroke-width="4.2"/>'
        f'<path d="{joint_d}" stroke="{DARK}" stroke-opacity="0.45" stroke-width="1.6"/>'
        f"{crack_markup}</g></svg>\n"
    )


def slab_cracks(seed=21, W=1400, H=1600):
    rng = random.Random(seed)
    paths = []
    for cx, cy in ((W * 0.18, H * 0.2), (W * 0.78, H * 0.62), (W * 0.42, H * 0.9)):
        paths += crack_paths(rng, cx, cy, rng.uniform(160, 320), rng.uniform(0, math.tau), branch=0.5, width=1.0)
    return crack_svg(paths, W, H)


def card_crack(seed, w=320, h=220, corner="br"):
    rng = random.Random(seed)
    x, y, ang = {"br": (w - 6, h - 6, math.pi * 1.2), "tl": (6, 6, math.pi * 0.25), "tr": (w - 6, 6, math.pi * 0.8)}[corner]
    return crack_svg(crack_paths(rng, x, y, rng.uniform(110, 190), ang, branch=0.6, width=1.0), w, h, dx=0.8)


DENTILS = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="10" viewBox="0 0 24 10">'
    "<!-- Dentil course: small square blocks under a cornice, lit from the upper left. -->"
    f'<rect x="2" y="1" width="12" height="8" fill="#fffdf8" fill-opacity="0.18"/>'
    f'<path d="M2 9V1H14" fill="none" stroke="{LIGHT}" stroke-opacity="0.75" stroke-width="1"/>'
    f'<path d="M2.5 9.5H14.5V1.5" fill="none" stroke="{DARK}" stroke-opacity="0.38" stroke-width="1"/>'
    f'<rect x="15" y="1" width="9" height="8" fill="{DARK}" fill-opacity="0.08"/>'
    "</svg>\n"
)


def pilaster():
    """Fluted Doric pilaster split into capital / repeatable shaft / base."""
    w = 34
    flutes = "".join(
        f'<rect x="{4 + i * 5.2:.1f}" y="0" width="3.2" height="40" fill="{DARK}" fill-opacity="0.13"/>'
        f'<path d="M{4 + i * 5.2 + 3.2:.1f} 0V40" stroke="{LIGHT}" stroke-opacity="0.6" stroke-width="0.9"/>'
        f'<path d="M{4 + i * 5.2:.1f} 0V40" stroke="{DARK}" stroke-opacity="0.32" stroke-width="0.8"/>'
        for i in range(5))
    shaft = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="40" viewBox="0 0 {w} 40">'
             f'<rect x="1" y="0" width="{w - 2}" height="40" fill="#d5d1c9"/>'
             f'<path d="M1.5 0V40" stroke="{LIGHT}" stroke-width="1"/><path d="M{w - 1.5} 0V40" stroke="{DARK}" stroke-opacity="0.35" stroke-width="1"/>'
             f"{flutes}</svg>\n")
    capital = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w + 12}" height="30" viewBox="0 0 {w + 12} 30">'
               '<!-- Doric capital: abacus over an echinus. -->'
               f'<rect x="0.5" y="0.5" width="{w + 11}" height="9" fill="#dcd8d0" stroke="{DARK}" stroke-opacity="0.3"/>'
               f'<path d="M1 1H{w + 11}" stroke="{LIGHT}" stroke-width="1"/>'
               f'<path d="M3 10 Q{(w + 12) / 2} 26 {w + 9} 10Z" fill="#cfcac1" stroke="{DARK}" stroke-opacity="0.25"/>'
               f'<rect x="7" y="20" width="{w - 2}" height="10" fill="#d5d1c9"/>'
               f'<path d="M7 22H{w + 5}" stroke="{DARK}" stroke-opacity="0.3"/><path d="M7 23H{w + 5}" stroke="{LIGHT}" stroke-opacity="0.7"/>'
               "</svg>\n")
    base = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w + 12}" height="26" viewBox="0 0 {w + 12} 26">'
            '<!-- Attic base: torus moulding on a square plinth. -->'
            f'<rect x="6" y="0" width="{w}" height="8" fill="#d5d1c9"/>'
            f'<rect x="3" y="7" width="{w + 6}" height="7" rx="3.5" fill="#d9d5cd" stroke="{DARK}" stroke-opacity="0.28"/>'
            f'<path d="M5 8.5H{w + 7}" stroke="{LIGHT}" stroke-opacity="0.8"/>'
            f'<rect x="0.5" y="14.5" width="{w + 11}" height="11" fill="#cfcac1" stroke="{DARK}" stroke-opacity="0.3"/>'
            f'<path d="M1 15H{w + 11}" stroke="{LIGHT}" stroke-width="1"/>'
            "</svg>\n")
    return capital, shaft, base


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ashlar.svg").write_text(ashlar(), encoding="utf8")
    (OUT / "slab-cracks.svg").write_text(slab_cracks(), encoding="utf8")
    for name, seed, corner in (("crack-a", 3, "br"), ("crack-b", 11, "tl"), ("crack-c", 19, "tr")):
        (OUT / f"{name}.svg").write_text(card_crack(seed, corner=corner), encoding="utf8")
    (OUT / "dentils.svg").write_text(DENTILS, encoding="utf8")
    capital, shaft, base = pilaster()
    (OUT / "pilaster-capital.svg").write_text(capital, encoding="utf8")
    (OUT / "pilaster-shaft.svg").write_text(shaft, encoding="utf8")
    (OUT / "pilaster-base.svg").write_text(base, encoding="utf8")
    for f in sorted(OUT.glob("*.svg")):
        print(f.name, f.stat().st_size)
