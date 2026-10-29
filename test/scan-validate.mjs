import { validateScan, validateRevealed, isSet, bestCaseFan } from '../src/scan/validate.js'

let pass = 0, fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ok  -', name) }
  else { fail++; console.log('FAIL  -', name, extra) }
}

const hand14 = ['m1', 'm2', 'm3', 'm7', 'm8', 'm9', 's2', 's3', 's4', 'p4', 'p5', 'p6', 'p9', 'p9']

{
  const r = validateScan(hand14)
  check('14 tiles: no errors or warnings', !r.errors.length && !r.warnings.length, JSON.stringify(r))
}
{
  const r = validateScan([...hand14, 'f1', 'y2'])
  check('flowers do not count toward 14', !r.errors.length && !r.warnings.length, JSON.stringify(r))
}
{
  const r = validateScan(['s1', 's1', 's1', 's1', 's1', ...hand14.slice(5)])
  check('5 of one tile is an error', r.errors.some((e) => e.includes('5×')), JSON.stringify(r))
}
{
  const r = validateScan([...hand14, 'f1', 'f1'])
  check('duplicate flower is an error', r.errors.length === 1, JSON.stringify(r))
}
{
  const r = validateScan([...hand14, 'p9', 'p9'])
  check('16 tiles warns about kongs', !r.errors.length && r.warnings.some((w) => w.includes('kong')), JSON.stringify(r))
}
{
  const r = validateScan(hand14.slice(0, 12))
  check('12 tiles warns', r.warnings.length === 1, JSON.stringify(r))
}
{
  const r = validateScan([...hand14.slice(0, 13), 'unknown'])
  check('unknown tile is an error', r.errors.some((e) => e.includes('not identified')), JSON.stringify(r))
}

check('pung is a set', isSet(['dr', 'dr', 'dr']))
check('kong is a set', isSet(['p5', 'p5', 'p5', 'p5']))
check('chow is a set (any order)', isSet(['s3', 's1', 's2']))
check('mixed-suit run is not a set', !isSet(['s1', 'm2', 's3']))
check('honour run is not a set', !isSet(['we', 'ws', 'ww']))
check('pair is not a set', !isSet(['m9', 'm9']))
check('revealed sets: no warning', validateRevealed([['dr', 'dr', 'dr'], ['s1', 's2', 's3']]).length === 0)
check('loose revealed tile warns', validateRevealed([['dr', 'dr', 'dr'], ['m9']]).length === 1)

// False-win check before the win conditions are asked.
{
  const broken = ['m1', 'm2', 'm4', 'm7', 'm8', 'm9', 's2', 's3', 's4', 'p4', 'p5', 'p6', 'p9', 'p9']
  check('not a winning hand → null', bestCaseFan(broken, []) === null)
  check('plain hand can reach 8 in the best case', bestCaseFan(hand14, []) >= 8)
  const pungs = bestCaseFan(['m2', 'm2', 'm2', 's4', 's4', 's4', 'p6', 'p6', 'p6', 'm9', 'm9'], [['dr', 'dr', 'dr']])
  check('big hand scores high', pungs >= 8, pungs)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
