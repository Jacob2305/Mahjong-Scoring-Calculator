import { scoreHand } from '../src/engine/scorer.js'

let pass = 0, fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ok  -', name) }
  else { fail++; console.log('FAIL  -', name, extra) }
}
const ids = (r) => r.fans.map((f) => f.id)

// 1. Chicken / low hand -> invalid (< 8 excluding flowers)
{
  const r = scoreHand({
    concealed: ['m1', 'm2', 'm3', 'm7', 'm8', 'm9', 's2', 's3', 's4', 'p4', 'p5', 'p6', 'p9', 'p9'],
    ctx: { winType: 'discard', waitType: 'none' },
  })
  console.log('\n[1] low hand:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('low hand is invalid (<8)', r.valid === false)
}

// 2. Full Flush bamboo chow hand
{
  const r = scoreHand({
    concealed: ['s1', 's2', 's3', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's5', 's5'],
    ctx: { winType: 'discard', waitType: 'none' },
  })
  console.log('[2] full flush:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('full flush valid', r.valid === true)
  check('has fullFlush', ids(r).includes('fullFlush'))
}

// 3. All Pungs with a dragon
{
  const r = scoreHand({
    concealed: ['m2', 'm2', 'm2', 's4', 's4', 's4', 'p6', 'p6', 'p6', 'dr', 'dr', 'dr', 'm9', 'm9'],
    ctx: { winType: 'discard', waitType: 'none' },
  })
  console.log('[3] all pungs+dragon:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('all pungs valid', r.valid === true)
  check('has allPungs', ids(r).includes('allPungs'))
  check('has dragonPung', ids(r).includes('dragonPung'))
}

// 4. Seven Pairs (concealedHand must NOT double count)
{
  const r = scoreHand({
    concealed: ['m1', 'm1', 'm2', 'm2', 'm3', 'm3', 's4', 's4', 's5', 's5', 'p7', 'p7', 'p8', 'p8'],
    ctx: { winType: 'discard', waitType: 'pair' },
  })
  console.log('[4] seven pairs:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('seven pairs valid', r.valid === true)
  check('has sevenPairs', ids(r).includes('sevenPairs'))
  check('no concealedHand double count', !ids(r).includes('concealedHand'))
}

// 5. Self-draw with a melded set adds Self-Drawn (1)
{
  const r = scoreHand({
    concealed: ['m2', 'm2', 'm2', 's4', 's4', 's4', 'p6', 'p6', 'p6', 'm9', 'm9'],
    melded: ['dr', 'dr', 'dr'],
    ctx: { winType: 'selfdraw', waitType: 'none' },
  })
  console.log('[5] self draw + meld:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('has selfDraw', ids(r).includes('selfDraw'))
}

// 6. Big Three Dragons (should exclude dragonPung / twoDragonPungs)
{
  const r = scoreHand({
    concealed: ['dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'dw', 'dw', 'dw', 'm2', 'm3', 'm4', 's5', 's5'],
    ctx: { winType: 'discard', waitType: 'none' },
  })
  console.log('[6] big three dragons:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('has bigThreeDragons', ids(r).includes('bigThreeDragons'))
  check('no dragonPung leak', !ids(r).includes('dragonPung'))
}

// 7. Thirteen Orphans
{
  const r = scoreHand({
    concealed: ['m1', 'm9', 's1', 's9', 'p1', 'p9', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw', 'm1'],
    ctx: { winType: 'discard', waitType: 'none' },
  })
  console.log('[7] thirteen orphans:', r.fanTotal, 'fan ->', ids(r).join(', '))
  check('has thirteenOrphans', ids(r).includes('thirteenOrphans'))
}

// 8. Pure Straight + flowers point transfer sanity
{
  const r = scoreHand({
    concealed: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 's2', 's3', 's4', 'p5', 'p5'],
    flowers: ['f1', 'f2'],
    ctx: { winType: 'selfdraw', waitType: 'none' },
  })
  console.log('[8] pure straight:', r.fanTotal, 'fan +', r.flowerPts, 'flowers ->', ids(r).join(', '))
  check('has pureStraight', ids(r).includes('pureStraight'))
  check('flowers counted', r.flowerPts === 2)
  check('transfers present', r.transfers && r.transfers.winnerTotal > 0)
}

// 9. Closed wait — winning tile is the middle of a chow
{
  const r = scoreHand({
    concealed: ['m4', 'm5', 'm6', 's7', 's8', 's9', 'p1', 'p2', 'p3', 'dr', 'dr', 'dr', 'm9', 'm9'],
    ctx: { winType: 'discard', winningTile: 'm5' },
  })
  console.log('[9] closed wait:', ids(r).join(', '))
  check('has closedWait', ids(r).includes('closedWait'))
}

// 10. Edge wait — winning tile is the 3 completing 1-2-3
{
  const r = scoreHand({
    concealed: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 's7', 's8', 's9', 'dr', 'dr', 'dr', 'p2', 'p2'],
    ctx: { winType: 'discard', winningTile: 'm3' },
  })
  console.log('[10] edge wait:', ids(r).join(', '))
  check('has edgeWait', ids(r).includes('edgeWait'))
}

// 11. Pair/single wait completing the pair by discard keeps all pungs concealed
{
  const r = scoreHand({
    concealed: ['m2', 'm2', 'm2', 's4', 's4', 's4', 'p6', 'p6', 'p6', 'dr', 'dr', 'dr', 'm9', 'm9'],
    ctx: { winType: 'discard', winningTile: 'm9' },
  })
  console.log('[11] pair wait:', ids(r).join(', '))
  check('has pairWait', ids(r).includes('pairWait'))
  check('discard-on-pair keeps fourConcealedPungs', ids(r).includes('fourConcealedPungs'))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
