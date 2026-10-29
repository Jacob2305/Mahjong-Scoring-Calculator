# 麻将计分 · MCR Calculator

A mobile-first Chinese Official Mahjong (MCR / Competition Rules) hand score
calculator. Tap your winning hand into a visual tile picker and get the
maximum-scoring fan-by-fan breakdown. Runs entirely client-side.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit checks (node --test style script)
```

## Build & deploy

`dist/` is build output and isn't committed.

- **Netlify from GitHub (recommended):** connect the repo in Netlify. `netlify.toml`
  tells it to run `npm run build` and publish `dist/`, so every push redeploys.
  Optionally add `VITE_GEMINI_API_KEY` under Site settings → Environment variables
  for the Gemini backup.
- **Netlify Drop:** run `npm run build` and drag the `dist/` folder onto
  [app.netlify.com/drop](https://app.netlify.com/drop).

## Scan hand — free, on-device

The **📷 Scan** button takes a photo (rear camera on phones) or an upload. A small
tile-detection model (YOLO11n, `public/models/mahjong-tiles.onnx`, ~10 MB) runs
**on the phone itself** with onnxruntime-web: no key, no server, no rate limits, and
it works offline once loaded. The model and runtime (~25 MB) download the first time
someone opens Scan, then the browser caches them. A scan takes 1–2 seconds.

The model returns a box and a confidence for every tile. `src/scan/detect.js` turns
those into the review screen's tiles: below 75% confidence a tile is flagged for you
to check, and the largest clear gap in the photo splits concealed (left/top) from
revealed (right/bottom). Then the tiles replace the hand.

- Model code: `src/scan/localScan.js` (browser) and `src/scan/detect.js` (tested by `test/scan-detect.mjs`)
- Retraining: label more photos in Roboflow, train in Colab (Ultralytics YOLO,
  `fliplr=0`), export to ONNX at 640, and replace `public/models/mahjong-tiles.onnx`.
  If the class list changes, update `MODEL_CLASSES` in `detect.js`.
- Training data: [Mahjong dataset by Jon Chan](https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s) on
  Roboflow Universe, CC BY 4.0.

### Gemini backup (optional)

If the on-device model can't load on a device, the app falls back to Google's Gemini
(free tier) when a key is set. Everything below is only needed for that backup.

### One-time setup (free, no card)

1. Open [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in
   with a Google account, and click **Create API key**. **Don't turn on billing**
   for that project. With billing off, the worst anyone can do with the key is use
   up the free daily scans; it can never cost money.
2. Copy `.env.example` to `.env` and paste the key after `VITE_GEMINI_API_KEY=`.
3. `npm run build`, then drag `dist/` onto Netlify Drop as usual.

Friends just open the link: the key is built into the site, so nobody else
needs one. Everyone's scans share your free quota (plenty for a mahjong table).
If too many scans hit at once, the app asks them to wait a minute.

**Recommended:** in the [Google Cloud console → Credentials](https://console.cloud.google.com/apis/credentials),
edit the key and restrict it to your site's address (`https://<your-site>.netlify.app/*`)
so other websites can't use it.

**Reliability:** a Gemini app subscription (Google AI Pro) does *not* apply to
API keys, so the key is on the free API tier. Google sometimes answers "high
demand" (HTTP 503) at busy times. The app retries automatically, then falls back
to older Flash models (`MODELS` in `src/scan/recognize.js`), and only shows an
error if every model is busy. For fewer busy errors, turn on billing for the
key's Google Cloud project (paid tier; scans cost a fraction of a cent). If you
do, restrict the key to your site's URL and set a budget alert, since the key is
visible in the site's code.

**Privacy:** on the free tier Google may use what you send to improve its
models. That's fine for photos of tiles; don't scan anything else.

### Testing accuracy

```bash
npm run eval:scan           # accuracy report over test/scan/ (free, uses the same key)
```

- Recognition prompt and request: `src/scan/recognize.js`
- Reference crops of your own sets: `src/scan/refs/`
- Test photos and labels: `test/scan/` (see its README)

## How it works

- **`src/engine/`** — the scoring core, framework-free and unit-tested:
  - `tiles.js` — tile ids, helpers, image mapping, picker catalog
  - `decompose.js` — recursive backtracking into 4 sets + a pair (kong-aware)
  - `fanRules.js` — detectors for all 81 fan plus the canonical point table
  - `exclusions.js` — the non-repeat (implied-fan) exclusion table
  - `scorer.js` — enumerates every decomposition + special hand, scores each,
    applies exclusions and returns the highest total
- **`src/components/`** — the React UI (tile picker, hand zones, results).

Tiles use the [FluffyStuff](https://github.com/FluffyStuff/riichi-mahjong-tiles)
SVG set for the 34 standard tiles; flowers and seasons (absent from that set)
are drawn as styled CSS tiles.

### Scoring notes

- A hand must reach **8 fan** (excluding flowers) to be valid.
- The five MCR principles are implemented: non-repeat (explicit exclusion
  table), non-separation and freedom-to-choose (all decompositions scored, best
  kept), non-identical and the set-usage cap (handled in detection).
- Concealed-pung counting on a discard win uses a documented heuristic: if the
  winning tile must have completed a pung (an all-pung hand, not a pair wait),
  one concealed pung is treated as exposed.
- Where the original brief's point tiers disagreed with the official 2006 MCR
  table (e.g. All Pungs = 6), the official value is used.
