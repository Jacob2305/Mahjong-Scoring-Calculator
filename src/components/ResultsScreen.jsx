import { useEffect, useState } from 'react'
import FanCard from './FanCard.jsx'
import Tile from './Tile.jsx'
import { tileSortKey, tileName } from '../engine/tiles.js'

export default function ResultsScreen({ result, concealed = [], melded = [], onBack }) {
  const score = useCountUp(result.total)
  const scoringFans = result.fans.filter((f) => f.id !== 'flower')
  const flowerFan = result.fans.find((f) => f.id === 'flower')

  return (
    <div className="min-h-full felt-bg">
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-felt-900/85 backdrop-blur flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg bg-felt-700 px-3 py-1.5 text-sm font-medium text-ivory/80"
          >
            ← Back
          </button>
          <h1 className="font-semibold text-ivory">Score</h1>
        </header>

        {/* Summary card */}
        <div className={`mt-4 rounded-2xl p-5 text-center shadow-xl
          ${result.valid ? 'bg-gradient-to-br from-felt-700 to-felt-800' : 'bg-felt-800'}`}>
          <div className="text-7xl font-black tabular-nums text-gold drop-shadow">{score}</div>
          <div className="text-ivory/70 mt-1">total points</div>
          <div className="mt-3 inline-flex items-center gap-2">
            {result.valid ? (
              <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-sm font-semibold text-white">
                ✓ Valid hand
              </span>
            ) : (
              <span className="rounded-full bg-rose-700/90 px-3 py-1 text-sm font-semibold text-white">
                ✗ Invalid · needs ≥ 8 fan
              </span>
            )}
          </div>
          <div className="mt-3 text-xs text-ivory/60">
            {result.fanTotal} fan{result.flowerPts ? ` + ${result.flowerPts} flower` : ''} ·{' '}
            {result.ctx.winType === 'selfdraw' ? 'Self-draw' : 'By discard'}
            {result.ctx.winningTile ? ` · won on ${tileName(result.ctx.winningTile)}` : ''}
          </div>
        </div>

        {/* The hand */}
        <div className="mt-4">
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gold/80">Your hand</h2>
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-felt-900/50 p-2">
            {[...concealed].sort((a, b) => tileSortKey(a) - tileSortKey(b)).map((id, i) => (
              <Tile key={'c' + i + id} id={id} size="md" />
            ))}
            {melded.length > 0 && (
              <div className="mx-1 h-12 w-px self-center bg-felt-600" aria-hidden />
            )}
            {[...melded].sort((a, b) => tileSortKey(a) - tileSortKey(b)).map((id, i) => (
              <Tile key={'m' + i + id} id={id} size="md" />
            ))}
          </div>
          {melded.length > 0 && (
            <div className="mt-1 text-[11px] text-ivory/45">Concealed 暗 · Melded 明 (right of divider)</div>
          )}
        </div>

        {/* Fan breakdown */}
        <h2 className="mt-5 mb-2 text-sm uppercase tracking-wide text-gold/80">
          Fan breakdown ({scoringFans.length})
        </h2>
        <div className="space-y-2">
          {scoringFans.length === 0 && (
            <div className="rounded-xl bg-felt-800/70 px-3 py-4 text-center text-ivory/50 text-sm">
              No scoring patterns — not a winning hand.
            </div>
          )}
          {scoringFans.map((f) => (
            <FanCard key={f.id} fan={f} />
          ))}
        </div>

        {/* Flowers (do not count toward the 8-point minimum) */}
        {flowerFan && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm uppercase tracking-wide text-gold/80">
              Flowers (excluded from the 8-fan minimum)
            </h2>
            <div className="flex items-center justify-between rounded-xl bg-felt-800/70 px-3 py-2.5">
              <span className="text-ivory">Flower / Season ×{flowerFan.count}</span>
              <span className="text-gold font-bold">+{flowerFan.total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Animate the total score counting up.
function useCountUp(target, ms = 650) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, start
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}
