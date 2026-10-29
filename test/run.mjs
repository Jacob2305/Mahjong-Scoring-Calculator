import { scoreHand } from '../src/engine/scorer.js'
import { groupSets } from '../src/engine/groupSets.js'

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

// Melded Hand (全求人): all four sets revealed, won by discard on the pair.
{
  const melded = ['m1', 'm2', 'm3', 's2', 's3', 's4', 'p4', 'p5', 'p6', 'm7', 'm8', 'm9']
  const r = scoreHand({ concealed: ['p9', 'p9'], melded, ctx: { winType: 'discard', winningTile: 'p9' } })
  check('melded hand by discard', ids(r).includes('meldedHand'))
  check('melded hand does not also count single wait', !ids(r).includes('pairWait'), ids(r).join(','))
  const s = scoreHand({ concealed: ['p9', 'p9'], melded, ctx: { winType: 'selfdraw', winningTile: 'p9' } })
  check('self-draw is not a melded hand', !ids(s).includes('meldedHand'))
}

// Fan table fixes: official values and the fans that were missing.
{
  const fan = (r, id) => r.fans.find((f) => f.id === id)
  const dragons = scoreHand({ concealed: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'dr', 'dr', 'dr', 'dg', 'dg', 'dg', 'm9', 'm9'], ctx: { winType: 'selfdraw' } })
  check('Two Concealed Pungs is worth 2', fan(dragons, 'twoConcealedPungs')?.total === 2, JSON.stringify(fan(dragons, 'twoConcealedPungs')))
  const simples = scoreHand({ concealed: ['m2', 'm3', 'm4', 's3', 's4', 's5', 'p4', 'p5', 'p6', 'p6', 'p7', 'p8', 's8', 's8'], ctx: { winType: 'discard' } })
  check('All Simples 2', fan(simples, 'allSimples')?.total === 2, ids(simples).join(','))
  check('All Simples replaces No Honors', !fan(simples, 'noHonors'))
  const withTerminal = scoreHand({ concealed: ['m1', 'm2', 'm3', 's3', 's4', 's5', 'p4', 'p5', 'p6', 'p6', 'p7', 'p8', 's8', 's8'], ctx: { winType: 'discard' } })
  check('a 1 means no All Simples', !fan(withTerminal, 'allSimples'))
  const oneKong = scoreHand({ concealed: ['s5', 's5', 's5', 's5', 'm2', 'm3', 'm4', 'p6', 'p7', 'p8', 'dr', 'dr', 'dr', 'p2', 'p2'], ctx: { winType: 'discard' } })
  check('Concealed Kong 2', fan(oneKong, 'concealedKong')?.total === 2, ids(oneKong).join(','))
  const twoKongs = scoreHand({ concealed: ['m2', 'm3', 'm4', 'p6', 'p7', 'p8', 'p2', 'p2'], melded: ['s5', 's5', 's5', 's5', 'dr', 'dr', 'dr', 'dr'], ctx: { winType: 'discard' } })
  const twoConcKongs = scoreHand({ concealed: ['s5', 's5', 's5', 's5', 'dr', 'dr', 'dr', 'dr', 'm2', 'm3', 'm4', 'p6', 'p7', 'p8', 'p2', 'p2'], ctx: { winType: 'discard' } })
  check('Two Concealed Kongs 8', fan(twoConcKongs, 'twoConcealedKongs')?.total === 8 && !fan(twoConcKongs, 'concealedKong'), ids(twoConcKongs).join(','))
  const ms = scoreHand({ concealed: ['m1', 'm2', 'm3', 'm1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'we', 'we'], ctx: { winType: 'discard' } })
  check('Mixed Straight counts once with a repeated chow', fan(ms, 'mixedStraight')?.count === 1 && ms.fanTotal === 11, `${ms.fanTotal} ${ids(ms).join(',')}`)
  const termPungs = scoreHand({ concealed: ['m1', 'm1', 'm1', 's9', 's9', 's9', 'p2', 'p3', 'p4', 'm4', 'm5', 'm6', 'p7', 'p7'], ctx: { winType: 'discard' } })
  check('Pung of Terminals counted for each 1/9 pung', fan(termPungs, 'pungTerminalsHonors')?.count === 2, ids(termPungs).join(','))
  const triple = scoreHand({ concealed: ['m5', 'm5', 'm5', 's5', 's5', 's5', 'p5', 'p5', 'p5', 'm1', 'm2', 'm3', 'we', 'we'], ctx: { winType: 'discard' } })
  check('Triple Pung 16', fan(triple, 'triplePung')?.total === 16, ids(triple).join(','))
  check('Two Melded Kongs 4 (instead of 2× Melded Kong)', fan(twoKongs, 'twoMeldedKongs')?.total === 4 && !fan(twoKongs, 'meldedKong'), ids(twoKongs).join(','))
}

// Set brackets on the home screen.
{
  const show = (ids) => groupSets(ids).map((u) => u.map((i) => ids[i]).join(' ')).join(' | ')
  check('chows and loose pair', show(['p9', 'm3', 'm1', 'm2', 'p9']) === 'm1 m2 m3 | p9 | p9', show(['p9', 'm3', 'm1', 'm2', 'p9']))
  check('kong stays whole', show(['dr', 'dr', 'dr', 'dr', 'we', 'we', 'we']) === 'we we we | dr dr dr dr')
  check('two chows before a loose pair', show(['m2', 'm3', 'm4', 'm2', 'm3', 'm4', 'm5', 'm5']) === 'm2 m3 m4 | m2 m3 m4 | m5 | m5')
  const ids = ['s5', 'm1', 's5', 's5']
  check('indices cover every tile once', groupSets(ids).flat().sort().join() === '0,1,2,3')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
