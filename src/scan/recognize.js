// ---------------------------------------------------------------------------
// Tile recognition via Gemini (free tier), called straight from the browser.
// Plain fetch only, so scripts/eval-scan.mjs runs exactly the same code in Node.
// ---------------------------------------------------------------------------

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// Same ids as src/engine/tiles.js.
const range = (p) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => p + n)
export const TILE_IDS = [
  ...range('m'), ...range('s'), ...range('p'),
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
  'f1', 'f2', 'f3', 'f4', 'y1', 'y2', 'y3', 'y4',
]
const CONFIDENCE = ['high', 'medium', 'low']
const ZONES = ['concealed', 'revealed']
const LAYOUTS = ['single', 'left-right', 'top-bottom']

const SCHEMA = {
  type: 'OBJECT',
  required: ['layout', 'visibleTileCount', 'tiles', 'issues'],
  propertyOrdering: ['layout', 'visibleTileCount', 'tiles', 'issues'],
  properties: {
    layout: { type: 'STRING', enum: LAYOUTS },
    visibleTileCount: { type: 'INTEGER' },
    tiles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['id', 'confidence', 'note', 'group', 'zone'],
        propertyOrdering: ['note', 'id', 'confidence', 'group', 'zone'],
        properties: {
          note: { type: 'STRING' },
          id: { type: 'STRING', enum: [...TILE_IDS, 'unknown'] },
          confidence: { type: 'STRING', enum: CONFIDENCE },
          group: { type: 'INTEGER' },
          zone: { type: 'STRING', enum: ZONES },
        },
      },
    },
    issues: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

const SYSTEM = `You identify Chinese mahjong tiles in a photo of a player's hand. Tile sets vary a lot in artwork, so reason from the structure of each face, not from one particular style.

Output ids:
- Characters (wan): m1..m9. A Chinese numeral on top (一二三四五六七八九, or formal variants like 伍) over 萬/万 (often red).
- Bamboo (sticks): s1..s9. Count the sticks. Common layouts: 2 = two vertical sticks; 3 = triangle; 4 = 2x2; 5 = 2 + 1 centre + 2; 6 = two rows of 3; 7 = 1 on top + two rows of 3; 8 = an M over a W (or two rows of 4); 9 = 3x3.
- Dots (circles): p1..p9. Count the circles. 1 = one large circle; 7 = 3 diagonal + 4 in a square; 8 = two columns of 4; 9 = 3x3.
- Winds: we 東/东 East, ws 南 South, ww 西 West, wn 北 North. Some sets also print E/S/W/N in a corner.
- Dragons: dr 中 (red, any font); dg 發/发 (green); dw = White Dragon, drawn as a completely blank face, an empty blue or black rectangular frame, or the character 白.
- Flowers: f1 梅 plum, f2 蘭/兰 orchid, f3 竹 bamboo, f4 菊 chrysanthemum.
- Seasons: y1 春 spring, y2 夏 summer, y3 秋 autumn, y4 冬 winter.
- unknown: a face you cannot identify at all.

1 Bamboo (s1) is the hardest tile. It is usually NOT a single stick: most sets draw a bird (peacock, sparrow, rooster, phoenix-like bird, sometimes on a bamboo stalk), often brightly coloured; some draw one large ornate stick. A bird among suited tiles with no corner number is almost always s1.
Do not confuse s1 with flowers/seasons: bonus tiles usually show a small number 1-4 (Arabic or Chinese) in a corner, and/or one of the characters 梅蘭竹菊 / 春夏秋冬, and depict plants, people or scenes. The flower "竹" (f3) is a bonus tile, not a bamboo suit tile. If flowers and seasons are not labelled with characters, use the corner number and the colour of the number (sets typically print flowers in one colour and seasons in another); lower your confidence when you have to guess which group it belongs to.

Concealed vs revealed: players are asked to lay out their hand in two areas, concealed tiles (still in hand) and revealed sets (melded/exposed pungs, chows, kongs). Either:
- left-right: concealed tiles on the LEFT, revealed sets on the RIGHT; or
- top-bottom: concealed tiles on TOP, revealed sets BELOW.
The two areas are separated by the largest gap in the photo. Set layout to the arrangement you see. If the tiles are not split into two areas (one row or one cluster), layout = "single" and every tile's zone = "concealed". Otherwise zone = "concealed" for tiles in the left/top area and "revealed" for tiles in the right/bottom area.

group: number the physical clusters of tiles 1, 2, 3, ... in reading order. Tiles that touch or nearly touch share a group; any visible gap starts a new group. Revealed sets are usually separate clusters of 3 (pung or chow) or 4 (kong); keep each such set in its own group. Never let a group span both zones.

Procedure:
1. Count the tiles whose faces are visible and put that in visibleTileCount. Ignore tiles that are face down or belong to other players.
2. List every face-up tile exactly once, in reading order: left to right, then the next row down. If four identical tiles sit together, list all four.
3. For each tile, first write a short note on what you see (e.g. "bird design", "7 or 8 sticks", "glare over centre"), then the id, confidence, group and zone.
4. Confidence: "high" only when the face is clearly visible and unambiguous. "medium" when slightly blurred, partly covered, at a steep angle, or when you counted many sticks/dots. "low" when you are guessing. Prefer "low" over a confident wrong answer; the user reviews every flagged tile.
5. issues: short notes about photo problems (cut-off tiles, glare, blur, tiles face down). Empty if none.`

export class RecognitionError extends Error {
  constructor(message, kind) {
    super(message)
    this.kind = kind // 'busy' | 'quota' | 'key' | 'network' | 'blocked' | 'bad-output' | 'other'
  }
}

// refs: [{ id, label, mediaType, data(base64) }] — labelled crops of the user's own sets.
function buildParts({ imageBase64, mediaType, refs }) {
  const parts = []
  if (refs.length) {
    parts.push({ text: "Reference tiles from this player's own sets. Each image is one tile; its correct id is given before it." })
    for (const r of refs) {
      parts.push({ text: `id ${r.id} (${r.label}):` })
      parts.push({ inline_data: { mime_type: r.mediaType, data: r.data } })
    }
  }
  parts.push({ text: 'Identify every face-up tile in this photo:' })
  parts.push({ inline_data: { mime_type: mediaType, data: imageBase64 } })
  return parts
}

// Tried in order. The newest model is the most accurate but also the busiest;
// older stable Flash models take over when it's overloaded.
export const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash']
const ATTEMPTS_PER_MODEL = 3
const TIMEOUT_MS = 40000
const TRANSIENT = new Set([429, 500, 502, 503, 504])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const backoff = (attempt) => [1000, 3000][attempt] + Math.random() * 500

// One request to one model. Throws RecognitionError; `.transient` means a retry
// (or a different model) may well succeed. `.status` / `.detail` record what
// Google actually answered, for the per-attempt log.
async function attemptOnce({ apiKey, model, body }) {
  const transient = (msg, kind = 'busy', extra = {}) =>
    Object.assign(new RecognitionError(msg, kind), { transient: true }, extra)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: ctrl.signal,
    })
  } catch (err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new RecognitionError('No connection. Scanning needs internet.', 'network')
    }
    throw err.name === 'AbortError'
      ? transient('The scanner took too long to answer.', 'busy', { status: 'timeout' })
      : transient('Could not reach the scanner.', 'busy', { status: 'network', detail: err.message })
  } finally {
    clearTimeout(timer)
  }

  let data = {}
  try { data = await res.json() } catch { /* non-JSON error */ }
  const http = { status: res.status, detail: data.error?.message || '' }
  if (TRANSIENT.has(res.status)) throw transient(`HTTP ${res.status}`, res.status === 429 ? 'quota' : 'busy', http)
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const msg = data.error?.message || ''
    if (/api key|permission|referer|unauthor/i.test(msg) || res.status !== 400) {
      throw new RecognitionError("Scanning isn't working: the site's Gemini key was rejected.", 'key')
    }
    throw new RecognitionError(`Scan request rejected: ${msg || res.status}`, 'other')
  }
  if (res.status === 404) throw transient(`Model ${model} not available`, 'other', http)
  if (!res.ok) throw transient(`HTTP ${res.status}`, 'other', http)

  const cand = data.candidates?.[0]
  if (!cand || data.promptFeedback?.blockReason || cand.finishReason === 'SAFETY') {
    throw new RecognitionError('The image was blocked by the scanner. Try another photo.', 'blocked')
  }
  const text = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('')
  try {
    return { parsed: JSON.parse(text), data }
  } catch {
    // Truncated or malformed output: usually fine on a second try.
    throw transient('Could not read the scanner output.', 'bad-output', { status: 'bad-output', detail: cand.finishReason || '' })
  }
}

// onStatus(text) is called while retrying so the UI can explain the wait.
export async function recognizeHand({ apiKey, imageBase64, mediaType = 'image/jpeg', refs = [], models = MODELS, onStatus = () => {} }) {
  if (!apiKey) throw new RecognitionError('No Gemini API key set.', 'key')
  const started = Date.now()
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: buildParts({ imageBase64, mediaType, refs }) }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
  })

  let last
  let attempts = 0
  // One row per request: what Google answered and how long it took.
  const log = []
  for (const [mi, model] of models.entries()) {
    if (mi > 0) onStatus('Trying a backup model…')
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      attempts++
      const t0 = Date.now()
      try {
        const { parsed, data } = await attemptOnce({ apiKey, model, body })
        log.push({ model, status: 200, kind: 'ok', message: '', ms: Date.now() - t0 })
        printLog(log)
        const layout = LAYOUTS.includes(parsed.layout) ? parsed.layout : 'single'
        const tiles = (parsed.tiles || []).map((t, i) => ({
          id: TILE_IDS.includes(t.id) ? t.id : 'unknown',
          confidence: CONFIDENCE.includes(t.confidence) ? t.confidence : 'low',
          note: t.note || '',
          group: Number.isInteger(t.group) ? t.group : 1000 + i,
          zone: layout !== 'single' && t.zone === 'revealed' ? 'revealed' : 'concealed',
        }))
        return {
          layout,
          tiles,
          visibleTileCount: parsed.visibleTileCount,
          issues: parsed.issues || [],
          model,
          attempts,
          usage: data.usageMetadata,
          ms: Date.now() - started,
          log,
        }
      } catch (err) {
        log.push({ model, status: err.status ?? '?', kind: err.kind, message: err.detail || err.message, ms: Date.now() - t0 })
        if (!err.transient) {
          printLog(log)
          throw Object.assign(err, { log })
        }
        last = err
        if (err.message.startsWith('Model ')) break // model gone: skip straight to the next
        if (attempt < ATTEMPTS_PER_MODEL - 1) {
          onStatus('Google is busy, retrying…')
          await sleep(backoff(attempt))
        }
      }
    }
  }
  printLog(log)
  throw Object.assign(new RecognitionError(failureMessage(log), last?.kind === 'bad-output' ? 'bad-output' : 'busy'), { log })
}

// Name the cause that dominated the failed attempts instead of a generic "overloaded".
function failureMessage(log) {
  const count = (pred) => log.filter(pred).length
  const quota = count((r) => r.status === 429)
  const busy = count((r) => [500, 502, 503, 504].includes(r.status))
  const slow = count((r) => r.status === 'timeout')
  const bad = count((r) => r.status === 'bad-output')
  const top = Math.max(quota, busy, slow, bad)
  if (top === 0) return 'Could not reach the scanner. Try again in a minute.'
  if (quota === top) return 'The free scan limit for this site was reached. Try again in a minute, or tomorrow if it keeps happening.'
  if (busy === top) return "Google's servers are busy right now. Try again in a minute."
  if (slow === top) return 'The scanner took too long to answer. Try again, or a photo with fewer tiles.'
  return 'Could not read the scanner output. Try another photo.'
}

// "3.8-flash: 503 ×3 · 2.5-flash: 200"
export function summarizeLog(log = []) {
  const groups = []
  for (const r of log) {
    const name = r.model.replace(/^gemini-/, '')
    const g = groups.at(-1)
    if (g && g.name === name && g.status === r.status) g.n++
    else groups.push({ name, status: r.status, n: 1 })
  }
  return groups.map((g) => `${g.name}: ${g.status}${g.n > 1 ? ` ×${g.n}` : ''}`).join(' · ')
}

function printLog(log) {
  if (typeof console.table === 'function' && typeof window !== 'undefined') console.table(log)
}
