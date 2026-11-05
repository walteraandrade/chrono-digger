"""Turn public-domain Commons photos into pixel-art portraits sharing one grid, palette and background.

Usage: CLOUDFLARE_ACCOUNT_ID=... python scripts/portraits/build.py [--regenerate ID ...] [--scale 6]
Requires: pillow, numpy. Token: CLOUDFLARE_API_TOKEN, or the wrangler OAuth login.
"""

import argparse
import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("portraits.json")
CACHE = ROOT / ".cache" / "portraits"
GENERATED = Path(__file__).with_name("generated")
WRANGLER_CONFIG = Path.home() / ".config" / ".wrangler" / "config" / "default.toml"
SOURCE_WIDTH = 1600
AI_INPUT_SIZE = 496
AI_OUTPUT_SIZE = 512
AI_ATTEMPTS = 4
BACKGROUND_THRESHOLD = 24
SENTINEL = (255, 0, 255)
USER_AGENT = "chrono-digger-portraits/0.2 (https://github.com/walteraandrade/chrono-digger)"


def fetch(request: urllib.request.Request | str) -> bytes:
    if isinstance(request, str):
        request = urllib.request.Request(request, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def source_image(title: str, portrait_id: str) -> Image.Image:
    cached = CACHE / f"{portrait_id}.img"
    if not cached.exists():
        query = urllib.parse.urlencode(
            {"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url",
             "iiurlwidth": SOURCE_WIDTH, "format": "json"}
        )
        pages = json.loads(fetch(f"https://commons.wikimedia.org/w/api.php?{query}"))["query"]["pages"]
        info = next(iter(pages.values()))["imageinfo"][0]
        cached.write_bytes(fetch(info.get("thumburl", info["url"])))
    return Image.open(cached).convert("RGB")


def crop_square(image: Image.Image, crop: list[float]) -> Image.Image:
    x0, y0, side = (round(value * image.width) for value in crop)
    return image.crop((x0, y0, x0 + side, y0 + side))


def required_env(name: str, hint: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(hint)
    return value


def api_token() -> str:
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return os.environ["CLOUDFLARE_API_TOKEN"]
    match = WRANGLER_CONFIG.exists() and re.search(r'^oauth_token = "(.+)"$', WRANGLER_CONFIG.read_text(), re.M)
    if not match:
        raise SystemExit("Set CLOUDFLARE_API_TOKEN or run `npx wrangler login`.")
    return match.group(1)


def multipart(fields: dict[str, str], files: dict[str, bytes]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        for name, value in fields.items()
    ] + [
        f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}.png"\r\n'
        f"Content-Type: image/png\r\n\r\n".encode() + data + b"\r\n"
        for name, data in files.items()
    ]
    return b"".join(parts) + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


def run_model(model: str, prompt: str, photo: Image.Image) -> Image.Image:
    buffer = BytesIO()
    photo.resize((AI_INPUT_SIZE, AI_INPUT_SIZE), Image.Resampling.LANCZOS).save(buffer, "PNG")
    body, content_type = multipart(
        {"prompt": prompt, "width": str(AI_OUTPUT_SIZE), "height": str(AI_OUTPUT_SIZE)},
        {"input_image_0": buffer.getvalue()},
    )
    account = required_env("CLOUDFLARE_ACCOUNT_ID", "Set CLOUDFLARE_ACCOUNT_ID.")
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
        data=body,
        headers={"Authorization": f"Bearer {api_token()}", "Content-Type": content_type},
    )
    for attempt in range(1, AI_ATTEMPTS + 1):
        try:
            result = json.loads(fetch(request))["result"]
            return Image.open(BytesIO(base64.b64decode(result["image"]))).convert("RGB")
        except urllib.error.HTTPError as error:
            print(f"  attempt {attempt}: {error.code} {error.read()[:200]!r}")
            time.sleep(2)
    raise SystemExit("Model kept failing (flagged output or timeout); retry or tweak the description.")


def ai_portrait(entry: dict, manifest: dict, regenerate: bool) -> Image.Image:
    cached = GENERATED / f"{entry['id']}.png"
    if regenerate or not cached.exists():
        print(f"generating {entry['id']}")
        photo = crop_square(source_image(entry["file"], entry["id"]), entry["crop"])
        run_model(manifest["model"], f"{manifest['style']} {entry['description']}", photo).save(cached)
    return Image.open(cached).convert("RGB")


def background_mask(image: Image.Image) -> np.ndarray:
    filled = image.copy()
    edge = image.width - 1
    for seed in [(0, 0), (edge // 2, 0), (edge, 0), (0, edge // 2), (edge, edge // 2)]:
        if filled.getpixel(seed) != SENTINEL:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=BACKGROUND_THRESHOLD)
    return np.all(np.asarray(filled) == SENTINEL, axis=-1)


def hex_to_rgb(color: str) -> list[int]:
    return [int(color[i : i + 2], 16) for i in (1, 3, 5)]


def shrink(image: Image.Image, size: int) -> tuple[Image.Image, np.ndarray]:
    mask = Image.fromarray(background_mask(image).astype(np.uint8) * 255).resize((size, size), Image.Resampling.BOX)
    return image.resize((size, size), Image.Resampling.BOX), np.asarray(mask) >= 128


def figure_palette(images: list[Image.Image], masks: list[np.ndarray], colors: int) -> Image.Image:
    pixels = np.concatenate([np.asarray(image)[~mask] for image, mask in zip(images, masks)])
    return Image.fromarray(pixels.reshape(1, -1, 3)).quantize(colors, method=Image.Quantize.MEDIANCUT)


def to_palette(image: Image.Image, mask: np.ndarray, figure: Image.Image, background: str) -> Image.Image:
    indices = np.asarray(image.quantize(palette=figure, dither=Image.Dither.NONE)).astype(np.uint8) + 1
    indices[mask] = 0
    out = Image.fromarray(indices, mode="P")
    out.putpalette(hex_to_rgb(background) + figure.getpalette()[: 3 * 255])
    return out


def contact_sheet(images: list[Image.Image], scale: int, gap: int = 16) -> Image.Image:
    size = images[0].width * scale
    sheet = Image.new("RGB", (len(images) * (size + gap) + gap, size + 2 * gap), (15, 17, 21))
    for index, image in enumerate(images):
        sheet.paste(image.convert("RGB").resize((size, size), Image.Resampling.NEAREST), (gap + index * (size + gap), gap))
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "portraits")
    parser.add_argument("--scale", type=int, default=6)
    parser.add_argument("--regenerate", nargs="*", default=[], metavar="ID")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    GENERATED.mkdir(exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)
    entries = manifest["portraits"]
    shrunk = [shrink(ai_portrait(entry, manifest, entry["id"] in args.regenerate), manifest["size"]) for entry in entries]
    figure = figure_palette([image for image, _ in shrunk], [mask for _, mask in shrunk], manifest["colors"] - 1)
    portraits = [to_palette(image, mask, figure, manifest["background"]) for image, mask in shrunk]
    for entry, image in zip(entries, portraits):
        image.save(args.out / f"{entry['id']}.png")
    contact_sheet(portraits, args.scale).save(CACHE / "preview.png")
    print(f"{len(portraits)} portraits -> {args.out}; preview -> {CACHE / 'preview.png'}")


if __name__ == "__main__":
    main()
