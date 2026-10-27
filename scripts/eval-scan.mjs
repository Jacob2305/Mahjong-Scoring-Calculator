// Run tile recognition over every labelled photo in test/scan/ and report
// accuracy per tile, confusions and confidence calibration.
//
//   npm run eval:scan                      # all photos
//   npm run eval:scan -- --only peacock    # photos whose filename contains "peacock"
//   npm run eval:scan -- --model gemini-2.5-flash   # force one model (no fallback)
//   npm run eval:scan -- --dry             # check labels.json without calling the API
//
// Needs VITE_GEMINI_API_KEY in .env (the same free key the site uses).
// Runs one photo at a time with the same retry + backup-model logic as the app.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { recognizeHand, RecognitionError, TILE_IDS, MODELS } from '../src/scan/recognize.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIR = path.join(ROOT, 'test/scan')
const PHOTOS = path.join(SCAN_DIR, 'photos')
const RESULTS = path.join(SCAN_DIR, 'results')
const REFS = path.join(ROOT, 'src/scan/refs')
const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2)
const flag = (name) => argv.includes('--' + name)
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const forced = opt('model', '')
const models = forced ? [forced] : MODELS
const model = models.join(' > ')
const only = opt('only', '')
const concurrency = Number(opt('concurrency', 1))

// ---- labels ---------------------------------------------------------------
const labelsPath = path.join(SCAN_DIR, 'labels.json')
const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8')).photos || []
const problems = []
for (const l of labels) {
  if (!fs.existsSync(path.join(PHOTOS, l.file))) problems.push(`${l.file}: file not found in test/scan/photos/`)
  const bad = [...(l.tiles || []), ...(l.melded || [])].filter((t) => !TILE_IDS.includes(t))
  if (bad.length) problems.push(`${l.file}: unknown tile ids ${bad.join(', ')}`)
}
const unlabelled = fs.existsSync(PHOTOS)
  ? fs.readdirSync(PHOTOS).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f) && !labels.some((l) => l.file === f))
  : []
if (unlabelled.length) console.log(`Note: ${unlabelled.length} photo(s) have no entry in labels.json: ${unlabelled.join(', ')}`)
if (problems.length) {
  console.error('labels.json problems:\n  ' + problems.join('\n  '))
  process.exit(1)
}
const todo = labels.filter((l) => l.file.includes(only))
if (!todo.length) {
  console.log('No labelled photos to run. Add photos to test/scan/photos/ and entries to test/scan/labels.json.')
  process.exit(0)
}
console.log(`${todo.length} photo(s), models: ${model}`)
if (flag('dry')) process.exit(0)
if (!apiKey) {
  console.error('Set VITE_GEMINI_API_KEY in .env (free key from https://aistudio.google.com/apikey).')
  process.exit(1)
}

// ---- run ------------------------------------------------------------------
const MEDIA = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const refs = fs.existsSync(REFS)
  ? fs.readdirSync(REFS).filter((f) => MEDIA[path.extname(f).toLowerCase()] && TILE_IDS.includes(f.split(/[_.]/)[0])).sort().map((f) => ({
      id: f.split(/[_.]/)[0],
      label: path.basename(f, path.extname(f)),
      mediaType: MEDIA[path.extname(f).toLowerCase()],
      data: fs.readFileSync(path.join(REFS, f)).toString('base64'),
    }))
  : []
if (refs.length) console.log(`Using ${refs.length} reference crop(s) from src/scan/refs/`)

async function prepare(file) {
  // Match the browser: upright, 1568 px long edge, JPEG q85.
  const buf = await sharp(path.join(PHOTOS, file))
    .rotate()
    .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return buf.toString('base64')
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function runOne(label) {
  try {
    const imageBase64 = await prepare(label.file)
    for (let round = 0; ; round++) {
      try {
        const r = await recognizeHand({ apiKey, imageBase64, refs, models })
        return { ...label, pred: r.tiles, issues: r.issues, visibleTileCount: r.visibleTileCount, ms: r.ms, model: r.model, attempts: r.attempts }
      } catch (err) {
        // Every model busy or rate-limited: give the free tier a breather, then go again.
        if (!(err instanceof RecognitionError && err.kind === 'busy') || round >= 2) throw err
        console.log(`  all models busy, waiting ${30 * (round + 1)}s...`)
        await wait(30000 * (round + 1))
      }
    }
  } catch (err) {
    return { ...label, error: err.message }
  }
}
const runs = []
let next = 0
await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
  while (next < todo.length) {
    const label = todo[next++]
    const r = await runOne(label)
    runs.push(r)
    console.log(`  ${r.error ? 'ERR ' : 'done'} ${label.file}${r.error ? ' - ' + r.error : ` (${(r.ms / 1000).toFixed(1)}s)`}`)
  }
}))
const position = (r) => todo.findIndex((t) => t.file === r.file)
runs.sort((a, b) => position(a) - position(b))

// ---- scoring --------------------------------------------------------------
const countOf = (ids) => ids.reduce((c, id) => ((c[id] = (c[id] || 0) + 1), c), {})
const suitOf = (id) => (id === 'unknown' ? '?' : 'msp'.includes(id[0]) ? id[0] : id[0] === 'y' ? 'f' : id[0])

// Ordered labels get a true alignment; unordered ones pair leftover misses with
// leftover extras (same suit first) to guess what was mistaken for what.
function alignOrdered(truth, pred) {
  const n = truth.length, m = pred.length
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (truth[i - 1] === pred[j - 1] ? 0 : 1))
  const out = []
  let i = n, j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (truth[i - 1] === pred[j - 1] ? 0 : 1)) {
      if (truth[i - 1] !== pred[j - 1]) out.push([truth[i - 1], pred[j - 1]])
      i--; j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { out.push([truth[i - 1], '(missed)']); i-- }
    else { out.push(['(extra)', pred[j - 1]]); j-- }
  }
  return out
}
function alignUnordered(truth, pred) {
  const t = countOf(truth), p = countOf(pred)
  const missing = [], extra = []
  for (const id of new Set([...truth, ...pred])) {
    const diff = (t[id] || 0) - (p[id] || 0)
    for (let k = 0; k < Math.abs(diff); k++) (diff > 0 ? missing : extra).push(id)
  }
  const out = []
  for (const m of missing) {
    let k = extra.findIndex((e) => suitOf(e) === suitOf(m))
    if (k < 0) k = 0
    out.push([m, extra.length ? extra.splice(k, 1)[0] : '(missed)'])
  }
  for (const e of extra) out.push(['(extra)', e])
  return out
}

const perTile = {} // id -> { truth, pred, tp }
const confusions = {}
const calib = { high: [0, 0], medium: [0, 0], low: [0, 0] }
const s1Styles = {} // style -> { truth, tp }
let exact = 0, totalMs = 0, ok = 0, zoneChecked = 0, zoneOk = 0

for (const r of runs) {
  if (r.error) continue
  ok++
  const predIds = r.pred.map((t) => t.id)
  const tc = countOf(r.tiles), pc = countOf(predIds)
  for (const id of new Set([...r.tiles, ...predIds])) {
    const row = (perTile[id] ||= { truth: 0, pred: 0, tp: 0 })
    row.truth += tc[id] || 0
    row.pred += pc[id] || 0
    row.tp += Math.min(tc[id] || 0, pc[id] || 0)
  }
  // Calibration: walk predictions, a tile is "correct" if the truth still has one left.
  const left = { ...tc }
  for (const t of r.pred) {
    const hit = left[t.id] > 0
    if (hit) left[t.id]--
    calib[t.confidence][0]++
    if (hit) calib[t.confidence][1]++
  }
  const errs = (r.ordered ? alignOrdered : alignUnordered)(r.tiles, predIds)
  r.errors = errs
  if (!errs.length) exact++
  // Concealed/revealed split: did exactly the labelled melded tiles land on the revealed side?
  if (Array.isArray(r.melded)) {
    zoneChecked++
    const got = r.pred.filter((t) => t.zone === 'revealed').map((t) => t.id).sort().join()
    r.zoneOk = got === [...r.melded].sort().join()
    if (r.zoneOk) zoneOk++
  }
  for (const [a, b] of errs) confusions[`${a} → ${b}`] = (confusions[`${a} → ${b}`] || 0) + 1
  const style = r.tags?.s1Style
  if (style && tc.s1) {
    const s = (s1Styles[style] ||= { truth: 0, tp: 0 })
    s.truth += tc.s1
    s.tp += Math.min(tc.s1, pc.s1 || 0)
  }
  totalMs += r.ms
}

// ---- report ---------------------------------------------------------------
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-').padStart(5)
const order = [...TILE_IDS, 'unknown']

console.log('\n=== Per photo ===')
for (const r of runs) {
  if (r.error) { console.log(`  ERROR  ${r.file}: ${r.error}`); continue }
  const tag = r.errors.length ? `${r.errors.length} err` : 'exact'
  console.log(`  ${tag.padEnd(6)} ${r.file}  truth ${r.tiles.length} / found ${r.pred.length}  ${(r.ms / 1000).toFixed(1)}s  ${r.model}${r.attempts > 1 ? ` (${r.attempts} tries)` : ''}`)
  for (const [a, b] of r.errors) console.log(`           ${a} → ${b}`)
  if (r.zoneOk === false) {
    const got = r.pred.filter((t) => t.zone === 'revealed').map((t) => t.id)
    console.log(`           revealed side: expected [${r.melded.join(' ')}], got [${got.join(' ')}]`)
  }
}

console.log('\n=== Per tile (recall = found / actually there, precision = right / predicted) ===')
console.log('  tile    truth  pred  recall  prec')
for (const id of order) {
  const row = perTile[id]
  if (!row) continue
  const mark = row.tp < row.truth || row.tp < row.pred ? '  <-' : ''
  console.log(`  ${id.padEnd(7)} ${String(row.truth).padStart(5)} ${String(row.pred).padStart(5)}  ${pct(row.tp, row.truth)}  ${pct(row.tp, row.pred)}${mark}`)
}

if (Object.keys(s1Styles).length) {
  console.log('\n=== 1 Bamboo by style ===')
  for (const [style, s] of Object.entries(s1Styles)) console.log(`  ${style.padEnd(14)} ${s.tp}/${s.truth}  ${pct(s.tp, s.truth)}`)
}

const conf = Object.entries(confusions).sort((a, b) => b[1] - a[1])
if (conf.length) {
  console.log('\n=== Confusions (truth → predicted) ===')
  for (const [k, n] of conf) console.log(`  ${k.padEnd(22)} ×${n}`)
}

console.log('\n=== Confidence calibration (how often each level was right) ===')
for (const [lvl, [n, right]] of Object.entries(calib)) console.log(`  ${lvl.padEnd(7)} ${String(n).padStart(4)} tiles  ${pct(right, n)} correct`)

const allTp = Object.values(perTile).reduce((a, r) => a + r.tp, 0)
const allTruth = Object.values(perTile).reduce((a, r) => a + r.truth, 0)
console.log(`\n=== Summary ===`)
console.log(`  photos ok ${ok}/${runs.length}, exact hands ${exact}/${ok}, tile recall ${pct(allTp, allTruth).trim()}`)
console.log(`  avg latency ${ok ? (totalMs / ok / 1000).toFixed(1) : '-'}s`)
if (zoneChecked) console.log(`  concealed/revealed split right: ${zoneOk}/${zoneChecked} photos`)
const byModel = {}
for (const r of runs) {
  if (r.error) continue
  const m = (byModel[r.model] ||= { photos: 0, exact: 0 })
  m.photos++
  if (!r.errors.length) m.exact++
}
for (const [m, s] of Object.entries(byModel)) console.log(`  answered by ${m}: ${s.photos} photo(s), ${s.exact} exact`)

fs.mkdirSync(RESULTS, { recursive: true })
const out = path.join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-')}_${forced || 'fallback'}.json`)
fs.writeFileSync(out, JSON.stringify({ model, runs }, null, 2))
console.log(`  saved ${path.relative(ROOT, out)}`)
