// ---------------------------------------------------------------------------
// On-device tile detection: turns the YOLO model's raw output into the same
// result shape the Gemini scanner returns, so the review screen works unchanged.
// Pure functions only (no browser APIs), so test/scan-detect.mjs can run them.
// ---------------------------------------------------------------------------

import { tileName } from '../engine/tiles.js'

export const INPUT_SIZE = 640

// Class order baked into public/models/mahjong-tiles.onnx (from its metadata).
// Names follow the Roboflow dataset: <number><B bamboo|C characters|D dots|F flower|S season>,
// winds EW/SW/WW/NW, dragons RD/GD/WD.
export const MODEL_CLASSES = [
  '1B', '1C', '1D', '1F', '1S', '2B', '2C', '2D', '2F', '2S', '3B', '3C', '3D', '3F', '3S',
  '4B', '4C', '4D', '4F', '4S', '5B', '5C', '5D', '6B', '6C', '6D', '7B', '7C', '7D',
  '8B', '8C', '8D', '9B', '9C', '9D', 'EW', 'GD', 'NW', 'RD', 'SW', 'WD', 'WW',
]

const HONOURS = { EW: 'we', SW: 'ws', WW: 'ww', NW: 'wn', RD: 'dr', GD: 'dg', WD: 'dw' }
const SUIT = { B: 's', C: 'm', D: 'p', F: 'f', S: 'y' }

// Model class name → app tile id (src/engine/tiles.js).
export function toTileId(cls) {
  return HONOURS[cls] || SUIT[cls[1]] + cls[0]
}

const MIN_SCORE = 0.3 // drop guesses below this
const NMS_IOU = 0.5

// Confidence → the review screen's high / medium / low.
export const confidenceOf = (score) => (score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low')

// Fit an image into the square model input, centred, keeping its shape.
export function letterbox(width, height, size = INPUT_SIZE) {
  const scale = Math.min(size / width, size / height)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  return { scale, w, h, padX: Math.floor((size - w) / 2), padY: Math.floor((size - h) / 2) }
}

// RGBA pixels of the letterboxed input → float32 CHW tensor data in 0..1.
export function toTensorData(rgba, size = INPUT_SIZE) {
  const n = size * size
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 255
    out[n + i] = rgba[i * 4 + 1] / 255
    out[2 * n + i] = rgba[i * 4 + 2] / 255
  }
  return out
}

const iou = (a, b) => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
  if (w <= 0 || h <= 0) return 0
  const inter = w * h
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter)
}

// Raw output [1, 4 + classes, anchors] → boxes in original image pixels.
// `box` = the letterbox() used for the input.
export function decode(output, dims, box) {
  const [, rows, anchors] = dims
  const classes = rows - 4
  const found = []
  for (let a = 0; a < anchors; a++) {
    let best = -1
    let score = 0
    let second = -1
    let secondScore = 0
    for (let c = 0; c < classes; c++) {
      const s = output[(4 + c) * anchors + a]
      if (s > score) { second = best; secondScore = score; best = c; score = s }
      else if (s > secondScore) { second = c; secondScore = s }
    }
    if (score < MIN_SCORE) continue
    const cx = (output[a] - box.padX) / box.scale
    const cy = (output[anchors + a] - box.padY) / box.scale
    const w = output[2 * anchors + a] / box.scale
    const h = output[3 * anchors + a] / box.scale
    found.push({
      cls: MODEL_CLASSES[best], score,
      alt: second >= 0 ? MODEL_CLASSES[second] : null, altScore: secondScore,
      x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2,
    })
  }
  // One box per tile: keep the most confident, drop heavy overlaps of any class.
  found.sort((p, q) => q.score - p.score)
  const kept = []
  for (const d of found) if (kept.every((k) => iou(k, d) < NMS_IOU)) kept.push(d)
  return kept
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

// Widest empty strip between boxes along one axis: { gap, at }.
function widestGap(dets, lo, hi) {
  const spans = dets.map((d) => [d[lo], d[hi]]).sort((p, q) => p[0] - q[0])
  let end = spans[0]?.[1] ?? 0
  let gap = 0
  let at = 0
  for (const [s, e] of spans.slice(1)) {
    if (s - end > gap) { gap = s - end; at = (s + end) / 2 }
    end = Math.max(end, e)
  }
  return { gap, at }
}

// Rows top to bottom, tiles left to right, and a new group at each visible gap.
function readingOrder(dets, tileW, tileH, nextGroup) {
  const rows = []
  for (const d of [...dets].sort((p, q) => (p.y1 + p.y2) - (q.y1 + q.y2))) {
    const cy = (d.y1 + d.y2) / 2
    const row = rows.find((r) => Math.abs(r.cy - cy) < tileH * 0.5)
    if (row) row.items.push(d)
    else rows.push({ cy, items: [d] })
  }
  const out = []
  for (const row of rows) {
    row.items.sort((p, q) => p.x1 - q.x1)
    let group = nextGroup()
    row.items.forEach((d, i) => {
      if (i > 0 && d.x1 - row.items[i - 1].x2 > tileW * 0.35) group = nextGroup()
      out.push({ ...d, group })
    })
  }
  return out
}

// Detections → { layout, tiles, visibleTileCount, issues }, like recognizeHand().
// Concealed vs revealed follows the app's instructions: the largest clear gap
// splits the photo, concealed on the left (or top), revealed on the right (or below).
export function toHand(dets) {
  if (!dets.length) {
    return { layout: 'single', tiles: [], visibleTileCount: 0, issues: ['No tiles found. Shoot from above with the tiles filling the frame.'] }
  }
  const tileW = median(dets.map((d) => d.x2 - d.x1))
  const tileH = median(dets.map((d) => d.y2 - d.y1))
  const gx = widestGap(dets, 'x1', 'x2')
  const gy = widestGap(dets, 'y1', 'y2')
  const rx = gx.gap / tileW
  const ry = gy.gap / tileH

  let layout = 'single'
  let isRevealed = () => false
  if (Math.max(rx, ry) >= 0.6) {
    if (rx >= ry) { layout = 'left-right'; isRevealed = (d) => (d.x1 + d.x2) / 2 > gx.at }
    else { layout = 'top-bottom'; isRevealed = (d) => (d.y1 + d.y2) / 2 > gy.at }
  }

  let g = 0
  const nextGroup = () => ++g
  const concealed = readingOrder(dets.filter((d) => !isRevealed(d)), tileW, tileH, nextGroup)
  const revealed = readingOrder(dets.filter(isRevealed), tileW, tileH, nextGroup)

  const tiles = [
    ...concealed.map((d) => ({ ...d, zone: 'concealed' })),
    ...revealed.map((d) => ({ ...d, zone: 'revealed' })),
  ].map((d) => {
    const id = toTileId(d.cls)
    let note = `${Math.round(d.score * 100)}% sure`
    if (d.alt && d.altScore >= 0.15) note += `, or maybe ${tileName(toTileId(d.alt))}`
    return { id, confidence: confidenceOf(d.score), note, group: d.group, zone: d.zone, score: d.score, box: [d.x1, d.y1, d.x2, d.y2] }
  })

  return { layout, tiles, visibleTileCount: tiles.length, issues: [] }
}
