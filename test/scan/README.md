# Scan test photos

1. Put photos in `photos/`.
2. Add one entry per photo to `labels.json` under `"photos"` (copy `_example`).
3. Run `npm run eval:scan` (or `npm run eval:scan -- --dry` to check the labels first).

Each run makes one free Gemini request per photo, one at a time, and waits
automatically if it hits the free per-minute limit. Results are
saved to `results/` so you can compare runs after changing the prompt or adding
reference crops.

## Label fields

| field | meaning |
|---|---|
| `file` | filename in `photos/` |
| `tiles` | every face-up tile in the photo, using the app's ids (`m1-m9`, `s1-s9`, `p1-p9`, `we ws ww wn`, `dr dg dw`, `f1-f4`, `y1-y4`) |
| `melded` | optional: the revealed tiles in the photo (a subset of `tiles`); use `[]` if none. Checks that the concealed/revealed split is right. Lay revealed sets to the **right** of (or **below**) the concealed tiles with a clear gap. |
| `ordered` | `true` if `tiles` is written left to right, top row first. This gives exact "X was read as Y" confusions. If it's `false` or missing, order doesn't matter and confusions are estimated. |
| `tags.s1Style` | how this set draws 1 Bamboo: `peacock`, `sparrow`, `phoenix`, `stick`, `colored-stick`, ... It drives the per-style 1 Bamboo breakdown. |
| `tags.*` | anything else useful: `set`, `lighting`, `angle`, `pose` (flat/standing) |

## Photos wanted (aim for 20–40)

1. **Every 1 Bamboo style you own**, alone and inside a full hand. Same for
   flowers/seasons, red dragon and white dragon (blank vs framed) variants.
2. **Full 14-tile hands laid flat, face up, in one row**, shot from directly above.
   This is the main use case. Add a few in **two rows**.
3. **Tiles standing on a rack**, shot from your seat at about 30–45°.
4. **Lighting:** daylight, warm lamp, phone flash (glare), one dim shot.
5. **Angles:** straight down, slight tilt, one with a tile partly cut off.
6. **Hard content:** lots of 7/8/9 bamboo and dots (counting), a kong (4 of a kind),
   and a 15–18 tile hand.

Your phone's normal resolution is fine and there's no need to crop. Name files so you can
tell them apart, e.g. `peacock_flat_lamp.jpg`.

## Fixing misreads

If one style keeps getting misread, put a close-up crop of that tile in
`src/scan/refs/` named `<id>_<style>.jpg` (e.g. `s1_sparrow.jpg`) and
re-run. See the README there.
