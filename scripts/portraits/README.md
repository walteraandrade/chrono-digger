# Portraits

Public-domain Commons photos → Workers AI pixel-art redraw → 64×64, one shared 16-color palette, one flat background.

```bash
pip install pillow numpy
CLOUDFLARE_ACCOUNT_ID=<id> python scripts/portraits/build.py
```

- `portraits.json`: grid size, color count, background color, model, shared style prompt, and per-character source, crop (`[x0, y0, side]`, fractions of image width) and description.
- `generated/<id>.png`: approved 512px model outputs. Committed because the model never redraws the same face twice. Only missing ones are generated; `--regenerate princip harrach` redoes specific ones.
- Output: `public/portraits/<id>.png` (indexed, palette index 0 = background). Preview and photo cache: `.cache/portraits/`.
- Token: `CLOUDFLARE_API_TOKEN`, or the `npx wrangler login` OAuth token. `flux-2-klein-4b` costs ~31 neurons per image (free tier: 10,000/day).
- The model sometimes answers `Your output has been flagged` or times out; the script retries 4 times.

Sources and credits live in `portraits.json`.
