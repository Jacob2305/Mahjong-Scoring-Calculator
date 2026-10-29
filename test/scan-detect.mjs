import { MODEL_CLASSES, toTileId, decode, toHand, letterbox, confidenceOf } from '../src/scan/detect.js'
import { TILE_IDS } from '../src/scan/recognize.js'

let pass = 0, fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ok  -', name) }
  else { fail++; console.log('FAIL  -', name, extra) }
}

// Class names map onto every app tile id exactly once.
{
  const ids = MODEL_CLASSES.map(toTileId)
  check('42 classes', MODEL_CLASSES.length === 42)
  check('every class maps to a valid tile id', ids.every((id) => TILE_IDS.includes(id)), ids.join(' '))
  check('mapping is one-to-one', new Set(ids).size === 42)
  check('1B→s1, 9C→m9, 5D→p5', toTileId('1B') === 's1' && toTileId('9C') === 'm9' && toTileId('5D') === 'p5')
  check('flowers/seasons/honours', toTileId('2F') === 'f2' && toTileId('3S') === 'y3' && toTileId('SW') === 'ws' && toTileId('WD') === 'dw')
}

// Fake model output: tiles as [cls, x, y] in a 640×640 input, 40×50 boxes.
function fakeOutput(tiles, anchors = 50) {
  const rows = 4 + MODEL_CLASSES.length
  const data = new Float32Array(rows * anchors)
  tiles.forEach(([cls, x, y, score = 0.9], a) => {
    data[a] = x; data[anchors + a] = y; data[2 * anchors + a] = 40; data[3 * anchors + a] = 50
    data[(4 + MODEL_CLASSES.indexOf(cls)) * anchors + a] = score
  })
  return { data, dims: [1, rows, anchors] }
}
const noPad = { scale: 1, padX: 0, padY: 0 }

{
  const { data, dims } = fakeOutput([['1B', 100, 100], ['1B', 102, 101, 0.6], ['RD', 300, 100, 0.2]])
  const d = decode(data, dims, noPad)
  check('overlapping duplicate dropped, low score dropped', d.length === 1 && d[0].cls === '1B', JSON.stringify(d))
}
{
  const box = letterbox(1280, 640) // scale 0.5, padY 160
  const { data, dims } = fakeOutput([['5D', 320, 320]])
  const [d] = decode(data, dims, box)
  check('boxes mapped back to original pixels', Math.round(d.x1) === 600 && Math.round(d.y1) === 270, JSON.stringify(d))
}

const row = (classes, x0, y, step = 42) => classes.map((c, i) => [c, x0 + i * step, y])

{
  const { data, dims } = fakeOutput(row(['1C', '2C', '3C', '4D', '4D', '4D', '7B', '8B', '9B', 'EW', 'EW', 'RD', 'RD', 'RD'], 30, 300))
  const h = toHand(decode(data, dims, noPad))
  check('touching row → single layout', h.layout === 'single', h.layout)
  check('all concealed, one group', h.tiles.every((t) => t.zone === 'concealed' && t.group === 1))
  check('reading order kept', h.tiles.map((t) => t.id).join(' ') === 'm1 m2 m3 p4 p4 p4 s7 s8 s9 we we dr dr dr')
}
{
  const conc = row(['1C', '2C', '3C', '4D', '4D', '4D', '7B', '8B', '9B', 'EW', 'EW'], 20, 300)
  const rev = row(['RD', 'RD', 'RD'], 520, 300)
  const { data, dims } = fakeOutput([...rev, ...conc])
  const h = toHand(decode(data, dims, noPad))
  check('big gap → left-right', h.layout === 'left-right', h.layout)
  check('right side revealed', h.tiles.filter((t) => t.zone === 'revealed').map((t) => t.id).join(' ') === 'dr dr dr')
  check('concealed listed first', h.tiles[0].zone === 'concealed' && h.tiles[0].id === 'm1')
}
{
  const conc = row(['1C', '2C', '3C', '4D', '4D', '4D', '7B', '8B'], 100, 150)
  const rev = [...row(['RD', 'RD', 'RD'], 100, 400), ...row(['5B', '6B', '7B'], 300, 400)]
  const { data, dims } = fakeOutput([...conc, ...rev])
  const h = toHand(decode(data, dims, noPad))
  check('rows far apart → top-bottom', h.layout === 'top-bottom', h.layout)
  const groups = new Set(h.tiles.filter((t) => t.zone === 'revealed').map((t) => t.group))
  check('two revealed sets → two groups', groups.size === 2, [...groups].join(','))
}
{
  check('empty photo explains itself', toHand([]).issues.length === 1)
  check('confidence bands', confidenceOf(0.9) === 'high' && confidenceOf(0.6) === 'medium' && confidenceOf(0.35) === 'low')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
