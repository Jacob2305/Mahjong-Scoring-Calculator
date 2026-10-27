import { isFlower, isSuited, tileName } from '../engine/tiles.js'

// A standard set: pung (3 same), kong (4 same) or chow (3 in a row, one suit).
export function isSet(ids) {
  if (ids.some((id) => id === 'unknown' || isFlower(id))) return false
  if ((ids.length === 3 || ids.length === 4) && ids.every((id) => id === ids[0])) return true
  if (ids.length !== 3 || !ids.every(isSuited) || !ids.every((id) => id[0] === ids[0][0])) return false
  const v = ids.map((id) => Number(id[1])).sort((a, b) => a - b)
  return v[1] === v[0] + 1 && v[2] === v[1] + 1
}

// Revealed tiles should all be complete sets. `units` are the revealed side's
// draggable units (arrays of tile ids).
export function validateRevealed(units) {
  const loose = units.filter((u) => !isSet(u)).reduce((n, u) => n + u.length, 0)
  return loose
    ? [`${loose} revealed tile${loose > 1 ? 's' : ''} not in a complete set. Revealed tiles should be pungs, chows or kongs`]
    : []
}

// Sanity checks on a scanned tile list. Errors block committing to the
// calculator; warnings are shown but don't block.
export function validateScan(ids) {
  const errors = []
  const warnings = []

  const unknown = ids.filter((id) => id === 'unknown').length
  if (unknown) errors.push(`${unknown} tile${unknown > 1 ? 's' : ''} not identified — tap to set`)

  const counts = {}
  for (const id of ids) if (id !== 'unknown') counts[id] = (counts[id] || 0) + 1
  for (const [id, n] of Object.entries(counts)) {
    const max = isFlower(id) ? 1 : 4
    if (n > max) errors.push(`${n}× ${tileName(id)} (max ${max})`)
  }

  const main = ids.filter((id) => id === 'unknown' || !isFlower(id)).length
  if (main < 14) warnings.push(`${main} tiles found; a winning hand has 14`)
  else if (main > 18) warnings.push(`${main} tiles found; the most possible is 18 (four kongs)`)
  else if (main > 14) {
    warnings.push(`${main} tiles: only valid with ${main - 14} kong${main > 15 ? 's' : ''}. Check that no extra tile was picked up`)
  }

  return { errors, warnings }
}
