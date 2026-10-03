"""frames-to-gif.py: turn a film recorded by drive.mjs into a GIF and a frame strip.

Usage:
    python frames-to-gif.py <shots-dir>/<name>-frames

Reads frames.json in that folder (written by drive.mjs) and writes, next to the
folder, <name>.gif (plays at real speed, loops) and <name>-strip.png (eight
frames in a grid, for the collapsed "Frame by frame" section of the comment).

Needs Pillow, the standard Python image library: pip install pillow
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install pillow")


def load_film(folder):
    """Return the frames as images, how long each shows, and the output names."""
    with open(folder / "frames.json", encoding="utf-8") as f:
        film = json.load(f)
    images = [Image.open(folder / fr["file"]).convert("RGB") for fr in film["frames"]]
    durations = [fr["ms"] for fr in film["frames"]]
    return images, durations, film["gif"], film["strip"]


def write_gif(images, durations, out):
    """Write a looping GIF. One palette for every frame keeps the file small
    and stops flat greys flickering from frame to frame."""
    palette = images[len(images) // 2].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, optimize=True, disposal=1)


def motion_end(images, sliver=0.002):
    """Index of the last frame where more than a sliver of the screen changed.
    A blinking text cursor changes every frame too, but only a few pixels, so
    it does not count as motion."""
    area = images[0].width * images[0].height
    last = 0
    for i in range(1, len(images)):
        box = ImageChops.difference(images[i - 1], images[i]).getbbox()
        if box and (box[2] - box[0]) * (box[3] - box[1]) > sliver * area:
            last = i
    return last


def write_strip(images, out, count=8, cols=4, gap=12):
    """Write up to `count` frames in a grid, at half size, spread over the part
    of the film where something moves, plus the frame it settles on."""
    moving = images[:min(len(images), motion_end(images) + 2)] if len(images) > 2 else images
    step = max(1, (len(moving) - 1) / max(1, count - 1))
    picked = [moving[round(i * step)] for i in range(min(count, len(moving)))]
    w, h = picked[0].width // 2, picked[0].height // 2
    rows = (len(picked) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap), (226, 229, 233))
    for i, im in enumerate(picked):
        x = gap + (i % cols) * (w + gap)
        y = gap + (i // cols) * (h + gap)
        sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    sheet.save(out, optimize=True)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python frames-to-gif.py <shots-dir>/<name>-frames")
    folder = Path(sys.argv[1])
    images, durations, gif_name, strip_name = load_film(folder)
    write_gif(images, durations, folder.parent / gif_name)
    write_strip(images, folder.parent / strip_name)
    size_kb = (folder.parent / gif_name).stat().st_size // 1024
    print(f"wrote {gif_name} ({len(images)} frames, {size_kb} KB) and {strip_name}")
    if size_kb > 9000:
        print("warning: GitHub shows images up to 10 MB. Film a shorter flow or a smaller window.")


if __name__ == "__main__":
    main()
