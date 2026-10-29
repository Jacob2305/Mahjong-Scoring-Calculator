import { useMemo, useState } from 'react'
import HandDisplay from './components/HandDisplay.jsx'
import WinningSlot from './components/WinningSlot.jsx'
import TilePicker from './components/TilePicker.jsx'
import GameContext from './components/GameContext.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import Tile from './components/Tile.jsx'
import ScanButton from './scan/ScanButton.jsx'
import { scoreHand } from './engine/scorer.js'
import { sortTiles } from './engine/tiles.js'

const DEFAULT_CTX = {
  seatWind: 'e',
  prevalentWind: 'e',
  winType: 'discard',
  winningTile: null,
  flags: {},
}

export default function App() {
  const [screen, setScreen] = useState('input')
  const [concealed, setConcealed] = useState([])
  const [melded, setMelded] = useState([])
  const [flowers, setFlowers] = useState([])
  const [zone, setZone] = useState('concealed')
  const [ctx, setCtx] = useState(DEFAULT_CTX)
  const [picking, setPicking] = useState(false)
  const [about, setAbout] = useState(false)

  const counts = useMemo(() => {
    const c = {}
    for (const t of [...concealed, ...melded]) c[t] = (c[t] || 0) + 1
    return c
  }, [concealed, melded])

  const tileCount = concealed.length + melded.length

  // The winning tile must still be in the concealed hand to count.
  const winningTile = concealed.includes(ctx.winningTile) ? ctx.winningTile : null
  const scoringCtx = useMemo(() => ({ ...ctx, winningTile }), [ctx, winningTile])

  const result = useMemo(
    () => scoreHand({ concealed, melded, flowers, ctx: scoringCtx }),
    [concealed, melded, flowers, scoringCtx],
  )

  function addTile(id) {
    // In "pick winning tile" mode, the next picker tap designates the win tile.
    if (picking) {
      setCtx((c) => ({ ...c, winningTile: id }))
      setPicking(false)
      return
    }
    if (tileCount >= 18) return
    const setter = zone === 'concealed' ? setConcealed : setMelded
    setter((arr) => [...arr, id])
  }

  function removeTile(z, idx) {
    if (z === 'concealed') setConcealed((a) => a.filter((_, i) => i !== idx))
    else setMelded((a) => a.filter((_, i) => i !== idx))
  }

  // Drag-and-drop between the boxes: move these tiles (indices into `from`).
  function moveTiles(from, idxs, to) {
    const src = from === 'concealed' ? concealed : melded
    const moving = idxs.map((i) => src[i])
    const keep = (a) => a.filter((_, i) => !idxs.includes(i))
    if (from === 'concealed') setConcealed(keep)
    else setMelded(keep)
    if (to === 'concealed') setConcealed((a) => [...a, ...moving])
    else setMelded((a) => [...a, ...moving])
  }

  function clearAll() {
    setConcealed([]); setMelded([]); setFlowers([])
  }

  // A finished scan replaces the whole hand and win details, then goes
  // straight to the score. "Back" from results lands on the filled-in hand.
  function applyScan({ concealed, melded, flowers, ctx: scanCtx }) {
    setConcealed(sortTiles(concealed))
    setMelded(sortTiles(melded))
    setFlowers(sortTiles(flowers))
    setZone('concealed')
    setPicking(false)
    setCtx(scanCtx)
    setScreen('results')
  }

  if (screen === 'results') {
    return (
      <ResultsScreen
        result={result}
        concealed={concealed}
        melded={melded}
        onBack={() => setScreen('input')}
      />
    )
  }

  const over = tileCount > 14
  return (
    <div className="min-h-full felt-bg">
      <div className="mx-auto max-w-md px-4 pb-28">
        {/* Top bar */}
        <header className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-felt-900/85 backdrop-blur flex items-center justify-between">
          <h1 className="font-bold text-ivory text-lg">
            麻将计分 <span className="text-gold font-semibold text-sm">· MCR</span>
          </h1>
          <div className="flex items-center gap-2">
            <ScanButton ctx={ctx} onCommit={applyScan} />
            <button onClick={clearAll} className="rounded-lg bg-felt-700 px-2.5 py-1 text-xs text-ivory/70">Clear</button>
            <button onClick={() => setAbout(true)} className="rounded-lg bg-felt-700 w-7 h-7 text-ivory/70">?</button>
          </div>
        </header>

        <div className="mt-3 space-y-4">
          {/* Hand zones double as the active-zone selector */}
          <HandDisplay
            concealed={concealed}
            melded={melded}
            activeZone={zone}
            onSelectZone={setZone}
            onRemove={removeTile}
            onMove={moveTiles}
          />

          {flowers.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-felt-900/50 px-2.5 py-2">
              <span className="text-xs text-ivory/55 shrink-0">Flowers 花</span>
              <div className="flex flex-wrap gap-1">
                {flowers.map((id, i) => (
                  <Tile key={id + i} id={id} size="sm" onClick={() => setFlowers((f) => f.filter((_, j) => j !== i))} />
                ))}
              </div>
            </div>
          )}

          {/* Status row: tile count, the winning-tile slot, and the main Scan button */}
          <div className="flex items-center gap-3 text-sm">
            <div className="shrink-0 leading-tight">
              <div className="text-ivory/70">
                <span className="font-bold text-ivory tabular-nums">{tileCount}</span> / 14 tiles
              </div>
              {result.complete ? (
                <div className="text-emerald-400 text-xs font-semibold">✓ winning shape</div>
              ) : over ? (
                <div className="text-amber-400 text-xs">kongs only</div>
              ) : (
                <div className="text-ivory/40 text-xs">{Math.max(0, 14 - tileCount)} to go</div>
              )}
            </div>
            <WinningSlot
              tile={ctx.winningTile}
              valid={!!winningTile}
              picking={picking}
              onToggle={() => setPicking((p) => !p)}
              onClear={() => { setCtx((c) => ({ ...c, winningTile: null })); setPicking(false) }}
            />
            <ScanButton ctx={ctx} onCommit={applyScan} variant="big" />
          </div>

          <TilePicker
            counts={counts}
            onAdd={addTile}
            picking={picking}
            tabbed
            title={
              <span className={`text-sm uppercase tracking-wide ${picking ? 'text-gold animate-pulse' : 'text-gold/80'}`}>
                {picking ? 'Tap the tile you won on' : 'Tap to add tiles'}
              </span>
            }
          />

          {/* Game context moved to the bottom */}
          <GameContext ctx={ctx} onChange={setCtx} />
        </div>
      </div>

      {/* Fixed Calculate button */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-felt-700 bg-felt-900/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-md">
          <button
            disabled={!result.complete}
            onClick={() => setScreen('results')}
            className={`w-full rounded-xl py-3.5 font-bold text-lg transition-all
              ${result.complete
                ? 'bg-gradient-to-r from-gold-light to-gold text-brown-dark shadow-lg active:scale-[0.99]'
                : 'bg-felt-700 text-ivory/40'}`}
          >
            {result.complete
              ? `Calculate Score${result.valid ? '' : ' · (below 8 fan)'}`
              : `Add ${Math.max(0, 14 - tileCount) || 'valid'} tiles`}
          </button>
        </div>
      </div>

      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  )
}

function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-felt-800 p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ivory text-lg">About 关于</h2>
          <button onClick={onClose} className="rounded-lg bg-felt-700 w-8 h-8 text-ivory/70">✕</button>
        </div>
        <div className="space-y-3 text-sm text-ivory/80 leading-relaxed">
          <p>
            Scores a winning hand under <b>Chinese Official (MCR / Competition)</b> rules.
            A hand must reach <b>8 fan</b> to be valid.
          </p>
          <div>
            <p className="font-semibold text-ivory mb-1">How to use</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Tap the <b>Concealed 暗</b> or <b>Melded 明</b> box to make it active — it lights up gold.</li>
              <li>Pick a suit in the bar, then tap tiles to drop them into the active box.</li>
              <li>Sets are bracketed. Tap a tile to remove it; drag a tile or set to move it to the other box.</li>
              <li>Four identical tiles in a box are read as a <b>kong</b> (14 + kongs tiles).</li>
              <li>Set the seat/prevalent winds, win type and your wait, then tap <b>Calculate Score</b>.</li>
            </ol>
          </div>
          <p className="text-ivory/55 text-xs">
            The engine enumerates every valid decomposition, scores all 81 fan, applies the
            non-repeat (implied-fan) exclusions and returns the highest total.
          </p>
        </div>
      </div>
    </div>
  )
}
