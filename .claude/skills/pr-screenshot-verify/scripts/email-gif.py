"""email-gif.py: turn a clip recorded by email-gifs.mjs into an email GIF.

Usage:
    python email-gif.py <outDir>/<clip> [<outDir>/<clip> ...]

Writes, next to each clip folder:
    <clip>.gif              1440 x 900, loops, the caption bar on top
    <clip>-first-frame.png  what older Outlook shows, and a poster
    <clip>.webp             the same first frame, small, for a web page

One palette for every frame, taken from frames across the whole clip, so a
colour that only appears late (a red status, the click ripple) still has an
entry, and flat greys do not flicker from frame to frame. No dithering:
interface screenshots are flat colour, and dither noise makes every frame
differ, which makes the file several times bigger.

Needs Pillow: pip install pillow
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install pillow")

EMAIL_LIMIT = 5_000_000  # bytes; bigger ones slow the email down and some servers refuse them


def encode(folder):
    m = json.loads((folder / "manifest.json").read_text())
    left, width, height = m.get("cropLeft", 0), m["width"], m["height"]
    strips = [Image.open(folder / f"caption-{i}.png").convert("RGB") for i in range(len(m["captions"]))]
    top = strips[0].height
    frames, durations = [], []
    for f in m["frames"]:
        shot = Image.open(folder / f["file"]).convert("RGB").crop((left, 0, width, height))
        canvas = Image.new("RGB", (width - left, height + top))
        canvas.paste(strips[f["caption"]], (0, 0))
        canvas.paste(shot, (0, top))
        frames.append(canvas)
        durations.append(max(20, f["ms"]))
    sample = frames[:: max(1, len(frames) // 16)][:16]
    w, h = frames[0].size
    mosaic = Image.new("RGB", (w, h * len(sample)))
    for i, im in enumerate(sample):
        mosaic.paste(im, (0, i * h))
    palette = mosaic.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    quantized = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in frames]
    out = folder.parent / f"{m['name']}.gif"
    quantized[0].save(out, save_all=True, append_images=quantized[1:], duration=durations,
                      loop=0, optimize=False, disposal=1)
    frames[0].save(folder.parent / f"{m['name']}-first-frame.png")
    frames[0].save(folder.parent / f"{m['name']}.webp", "WEBP", quality=82, method=6)
    size = out.stat().st_size
    print(f"{out.name}: {w}x{h}, {len(frames)} frames, {sum(durations) / 1000:.1f} s, {size / 1e6:.2f} MB")
    if size > EMAIL_LIMIT:
        print(f"  warning: over {EMAIL_LIMIT / 1e6:.0f} MB. Scroll less, or split the flow in two.")
    if m.get("errors"):
        print(f"  warning: the browser reported {len(m['errors'])} error(s) while recording; see manifest.json")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python email-gif.py <outDir>/<clip> [...]")
    for arg in sys.argv[1:]:
        encode(Path(arg))
