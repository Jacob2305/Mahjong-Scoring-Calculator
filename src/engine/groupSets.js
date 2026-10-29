import { isSuited, tileSortKey } from './tiles.js'

// Split one hand box into display units: sets (kong, pung, chow) get bracketed,
// everything else stays loose. Display only; scoring still reads the flat tiles.
// Input: tile ids. Output: arrays of indices into that input, in hand order.
// Picks the split with the most sets; on a tie, the one that leaves a pair loose
// (the eyes of a winning hand), then the one that uses kongs.
export function groupSets(ids) {
  const order = ids.map((id, i) => i).sort((a, b) => tileSortKey(ids[a]) - tileSortKey(ids[b]) || a - b)
  const best = search(order.map((i) => ids[i]), new Map())
  // Map each set back to concrete indices.
  const pool = new Map()
  for (const i of order) {
    if (!pool.has(ids[i])) pool.set(ids[i], [])
    pool.get(ids[i]).push(i)
  }
  const units = best.sets.map((set) => set.map((id) => pool.get(id).shift()))
  for (const left of pool.values()) for (const i of left) units.push([i])
  const key = (u) => tileSortKey(ids[u[0]]) * 100 + u.length
  return units.sort((a, b) => key(a) - key(b))
}

function score(r) {
  const loose = {}
  let pair = false
  for (const t of r.loose) if ((loose[t] = (loose[t] || 0) + 1) === 2) pair = true
  return r.sets.length * 4 + (pair ? 2 : 0) + r.sets.filter((set) => set.length === 4).length
}

// tiles: sorted ids. Returns { sets, loose }. Memoised on the remaining tiles.
function search(tiles, memo) {
  if (!tiles.length) return { sets: [], loose: [] }
  const k = tiles.join(',')
  if (memo.has(k)) return memo.get(k)
  const [first, ...rest] = tiles
  const options = []

  const same = tiles.filter((t) => t === first).length
  for (const n of [4, 3]) {
    if (same >= n) {
      const r = search(tiles.slice(n), memo)
      options.push({ sets: [Array(n).fill(first), ...r.sets], loose: r.loose })
    }
  }
  if (isSuited(first) && Number(first[1]) <= 7) {
    const a = first[0] + (Number(first[1]) + 1)
    const b = first[0] + (Number(first[1]) + 2)
    const ia = rest.indexOf(a)
    if (ia >= 0) {
      const after = [...rest.slice(0, ia), ...rest.slice(ia + 1)]
      const ib = after.indexOf(b)
      if (ib >= 0) {
        const r = search([...after.slice(0, ib), ...after.slice(ib + 1)], memo)
        options.push({ sets: [[first, a, b], ...r.sets], loose: r.loose })
      }
    }
  }
  // Or leave the first tile loose.
  const skip = search(rest, memo)
  options.push({ sets: skip.sets, loose: [first, ...skip.loose] })

  // Ties go to the earliest option: sets before loose tiles.
  const best = options.reduce((p, q) => (score(q) > score(p) ? q : p))
  memo.set(k, best)
  return best
}
