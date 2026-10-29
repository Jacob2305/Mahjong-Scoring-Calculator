import { useEffect, useMemo, useRef, useState } from 'react'
import Tile from '../components/Tile.jsx'
import TileChooser from './TileChooser.jsx'
import { validateScan, validateRevealed, isSet, bestCaseFan } from './validate.js'
import { WinningTileStep, WinDetailsStep } from './WinSteps.jsx'
import { isFlower } from '../engine/tiles.js'
import { scoreHand, FALSE_WIN_PENALTY } from '../engine/scorer.js'

const STEP_TITLE = { tiles: 'Check the scan', winning: 'Winning tile', details: 'How did you win?' }

const ZONES = ['concealed', 'revealed']
const ZONE_LABEL = { concealed: 'Concealed 暗', revealed: 'Revealed 明' }
const ZONE_SUB = { concealed: 'in hand', revealed: 'melded sets' }

let nextKey = 0
export function toReviewItems(tiles) {
  return tiles.map((t) => ({
    key: nextKey++, id: t.id, confidence: t.confidence, note: t.note, ok: false,
    zone: t.zone || 'concealed', group: `g${t.group}`,
  }))
}

function PrimaryButton({ enabled, onClick, children }) {
  return (
    <button
      disabled={!enabled}
      onClick={onClick}
      className={`flex-1 rounded-xl py-3.5 font-bold transition-all
        ${enabled ? 'bg-gradient-to-r from-gold-light to-gold text-brown-dark' : 'bg-felt-700 text-ivory/40'}`}
    >
      {children}
    </button>
  )
}

const isFlagged = (it) => it.id === 'unknown' || it.confidence !== 'high'
const needsReview = (it) => isFlagged(it) && !it.ok

// Split one zone's tiles into draggable units: a cluster of tiles the scanner
// saw together moves as one when it's a pung, chow or kong; anything else
// moves tile by tile.
function unitsOf(items, zone) {
  const units = []
  let run = []
  const flush = () => {
    if (!run.length) return
    if (isSet(run.map((it) => it.id))) units.push(run)
    else for (const it of run) units.push([it])
    run = []
  }
  for (const it of items) {
    if (it.zone !== zone || isFlower(it.id)) continue
    if (run.length && run[0].group !== it.group) flush()
    run.push(it)
  }
  flush()
  return units
}

// Three steps after a scan:
//   1. tiles   — what the scanner found, split into concealed and revealed.
//                Tap a tile to change or remove it; drag a tile (with its set)
//                to the other box. Unsure tiles are marked but don't block Next.
//   2. winning — tap the tile you won on.
//   3. details — self-draw vs discard, special wins, winds (only if relevant).
// Then onCommit({ concealed, melded, flowers, ctx }) and straight to the score.
export default function ScanReview({ photoUrl, initialItems, issues, ctx, onCommit, onRetake, onCancel }) {
  const [step, setStep] = useState('tiles')
  const [winKey, setWinKey] = useState(null)
  const [win, setWin] = useState({ winType: null, flags: {}, seatWind: ctx.seatWind, prevalentWind: ctx.prevalentWind })
  const [items, setItems] = useState(initialItems)
  const scroller = useRef(null)
  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [step])
  const [editing, setEditing] = useState(null) // item key, { add: zone }, or null
  const [showPhoto, setShowPhoto] = useState(false)
  const [verdict, setVerdict] = useState(null) // false-win warning on the tiles page
  const [drag, setDrag] = useState(null) // { keys, ids, from, x, y, over }
  const press = useRef(null)
  const justDragged = useRef(false) // swallow the click that follows a drag
  const zoneRefs = { concealed: useRef(null), revealed: useRef(null) }

  const ids = items.map((it) => it.id)
  const units = useMemo(() => ({ concealed: unitsOf(items, 'concealed'), revealed: unitsOf(items, 'revealed') }), [items])
  const flowers = items.filter((it) => isFlower(it.id))
  const { errors, warnings } = useMemo(() => {
    const v = validateScan(ids)
    return { errors: v.errors, warnings: [...v.warnings, ...validateRevealed(units.revealed.map((u) => u.map((it) => it.id)))] }
  }, [items])
  const pending = items.filter(needsReview).length
  const counts = useMemo(() => {
    const c = {}
    for (const id of ids) if (id !== 'unknown') c[id] = (c[id] || 0) + 1
    return c
  }, [items])
  const tilesDone = items.length > 0 && errors.length === 0

  // The winning tile can be picked from either box (null if it was removed
  // since). The set it completes is never a meld in MCR, and the engine
  // expects the winning tile in the concealed hand, so if it was picked from a
  // revealed set, that set is scored as concealed. Drawn vs discarded (asked
  // next) is what decides concealed-hand vs fully-concealed points.
  const winUnit = [...units.concealed, ...units.revealed].find((u) => u.some((it) => it.key === winKey)) || null
  const winItem = winUnit?.find((it) => it.key === winKey) || null
  const winFromRevealed = !!winUnit && units.revealed.includes(winUnit)
  const hand = {
    concealed: [...units.concealed.flat(), ...(winFromRevealed ? winUnit : [])].map((it) => it.id),
    melded: units.revealed.filter((u) => u !== winUnit).flat().map((it) => it.id),
    flowers: flowers.map((it) => it.id),
  }
  const fullCtx = { ...ctx, ...win, winningTile: winItem?.id ?? null }
  const result = useMemo(
    () => (step === 'details' ? scoreHand({ ...hand, ctx: fullCtx }) : null),
    [step, items, win, winKey],
  )
  const canScore = !!(win.winType && result?.complete)

  // Catch a false win before asking how they won.
  function tilesNext() {
    const ids = (list) => list.map((it) => it.id)
    const best = bestCaseFan(ids(units.concealed.flat()), units.revealed.map(ids), ids(flowers))
    if (best === null) setVerdict({ kind: 'notWinning' })
    else if (best < 8) setVerdict({ kind: 'underEight', fan: best })
    else setStep('winning')
  }

  const current = typeof editing === 'number' ? items.find((it) => it.key === editing) : null
  const update = (key, patch) => setItems((arr) => arr.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  // Moved tiles go to the end so they show up last in their new box.
  function moveUnit(keys, zone) {
    setItems((arr) => [
      ...arr.filter((it) => !keys.includes(it.key)),
      ...arr.filter((it) => keys.includes(it.key)).map((it) => ({ ...it, zone })),
    ])
  }

  function pick(id) {
    if (editing?.add) {
      setItems((arr) => [...arr, { key: nextKey++, id, confidence: 'high', note: 'added by you', ok: true, zone: editing.add, group: `u${nextKey}` }])
    } else {
      update(editing, { id, ok: true, note: id === current.id ? current.note : 'corrected by you' })
    }
    setEditing(null)
  }

  // ---- drag (pointer events, so it works with touch and mouse) -------------
  function zoneAt(x, y) {
    for (const z of ZONES) {
      const r = zoneRefs[z].current?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z
    }
    return null
  }
  function onPointerDown(e, unit, tapKey, zone) {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { keys: unit.map((it) => it.key), ids: unit.map((it) => it.id), from: zone, x0: e.clientX, y0: e.clientY, tapKey, dragging: false }
  }
  function onPointerMove(e) {
    const p = press.current
    if (!p) return
    if (!p.dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8) return
    p.dragging = true
    setDrag({ keys: p.keys, ids: p.ids, from: p.from, x: e.clientX, y: e.clientY, over: zoneAt(e.clientX, e.clientY) })
  }
  function onPointerUp(e) {
    const p = press.current
    press.current = null
    if (!p) return
    // A tap is handled by onClick, which fires after the finger lifts. Opening
    // the sheet here would let that same tap land on a button inside it.
    justDragged.current = p.dragging
    if (!p.dragging) return
    setDrag(null)
    const over = zoneAt(e.clientX, e.clientY)
    if (over && over !== p.from) moveUnit(p.keys, over)
  }
  function onPointerCancel() { press.current = null; setDrag(null) }
  function onTileClick(key) {
    if (justDragged.current) { justDragged.current = false; return }
    setEditing(key)
  }

  const tileFace = (it, size = 'md') =>
    it.id === 'unknown'
      ? <div className={`${size === 'sm' ? 'w-9 h-12' : 'w-11 h-[3.75rem]'} rounded-md bg-ivory/25 text-2xl text-ivory/70 flex items-center justify-center`}>?</div>
      : <Tile id={it.id} size={size} />

  const badge = (it) =>
    needsReview(it) ? (
      <span className={`pointer-events-none absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shadow
        ${it.id === 'unknown' || it.confidence === 'low' ? 'bg-red-500 text-white' : 'bg-amber-400 text-brown-dark'}`}>?</span>
    ) : isFlagged(it) ? (
      <span className="pointer-events-none absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center shadow">✓</span>
    ) : null

  return (
    <div ref={scroller} className="fixed inset-0 z-40 felt-bg overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32">
        <header className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-felt-900/90 backdrop-blur flex items-center justify-between">
          <h2 className="font-bold text-ivory text-lg">
            {STEP_TITLE[step]} <span className="text-xs font-normal text-ivory/40">{['tiles', 'winning', 'details'].indexOf(step) + 1}/3</span>
          </h2>
          <button onClick={onCancel} className="rounded-lg bg-felt-700 px-2.5 py-1 text-xs text-ivory/70">Cancel</button>
        </header>

        {step === 'winning' && (
          <WinningTileStep units={units} selectedKey={winItem?.key} onSelect={(it) => setWinKey(it.key)} />
        )}
        {step === 'details' && (
          <>
            <WinDetailsStep win={win} onChange={setWin} allIds={[...hand.concealed, ...hand.melded]} winningTile={winItem.id} />
            {win.winType && result && !result.complete && (
              <div className="mt-4 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-sm text-red-100">
                ⛔ These tiles don't make a winning hand. Declaring it is a false win: pay {FALSE_WIN_PENALTY.notWinning} to
                each other player. Go back and check the tiles and which side they're on.
              </div>
            )}
            {win.winType && result?.complete && !result.valid && (
              <div className="mt-4 rounded-lg bg-amber-900/40 border border-amber-700/70 px-3 py-2 text-sm text-amber-100">
                ⚠ Only {result.fanTotal} fan, under the 8-fan minimum. Declaring it is a false win: pay{' '}
                {FALSE_WIN_PENALTY.underEight} to each other player.
              </div>
            )}
          </>
        )}

        {step === 'tiles' && (<>
        <button
          onClick={() => setShowPhoto((s) => !s)}
          className="mt-3 w-full overflow-hidden rounded-xl border border-felt-700 bg-felt-900/60"
        >
          <img
            src={photoUrl}
            alt="Your photo"
            className={`w-full object-contain transition-all ${showPhoto ? 'max-h-[70vh]' : 'max-h-28'}`}
          />
        </button>

        <p className="mt-3 text-sm text-ivory/70">
          {items.length} tiles found. Tap a tile to change or remove it. Drag tiles to move them
          between boxes; sets move together.
          {pending > 0 && (
            <span className="text-amber-300"> <b>?</b> marks {pending} tile{pending > 1 ? 's' : ''} the scanner wasn't sure about.</span>
          )}
        </p>
        <p className="mt-1.5 text-xs text-ivory/50">
          The set you won on can be in either box. It's scored correctly either way.
        </p>

        <div className="mt-3 space-y-2">
          {ZONES.map((zone) => {
            const target = drag && drag.over === zone && drag.from !== zone
            return (
              <div
                key={zone}
                ref={zoneRefs[zone]}
                className={`rounded-xl p-2.5 border-2 transition-colors
                  ${target ? 'border-gold bg-gold/10' : 'border-felt-700 bg-felt-900/50'}`}
              >
                <div className="mb-1.5 text-sm font-semibold text-ivory/70">
                  {ZONE_LABEL[zone]} <span className="font-normal opacity-60">{ZONE_SUB[zone]}</span>
                </div>
                <div className="min-h-[3.75rem] flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  {units[zone].length === 0 && (
                    <span className="px-1 text-xs text-ivory/30">
                      {zone === 'revealed' ? 'none. Drag revealed sets here' : 'none'}
                    </span>
                  )}
                  {units[zone].map((unit) => {
                    const dragging = drag && drag.keys.includes(unit[0].key)
                    return (
                      <div
                        key={unit[0].key}
                        className={`flex gap-0.5 rounded-lg ${unit.length > 1 ? 'bg-felt-700/70 p-1' : ''} ${dragging ? 'opacity-30' : ''}`}
                      >
                        {unit.map((it) => (
                          <div
                            key={it.key}
                            className="relative select-none"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => onPointerDown(e, unit, it.key, zone)}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerCancel}
                            onClick={() => onTileClick(it.key)}
                          >
                            {tileFace(it)}
                            {badge(it)}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => setEditing({ add: zone })}
                    className="w-11 h-[3.75rem] rounded-md border-2 border-dashed border-ivory/25 text-ivory/40 text-xl"
                    aria-label={`Add a missing tile to ${zone}`}
                  >+</button>
                </div>
              </div>
            )
          })}

          {flowers.length > 0 && (
            <div className="rounded-xl p-2.5 border-2 border-felt-700 bg-felt-900/50">
              <div className="mb-1.5 text-sm font-semibold text-ivory/70">Flowers 花</div>
              <div className="flex flex-wrap gap-1.5">
                {flowers.map((it) => (
                  <div key={it.key} className="relative" onClick={() => setEditing(it.key)}>
                    {tileFace(it)}
                    {badge(it)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(errors.length > 0 || warnings.length > 0 || issues?.length > 0) && (
          <div className="mt-4 space-y-1.5 text-sm">
            {errors.map((e) => (
              <div key={e} className="rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-red-100">⛔ {e}</div>
            ))}
            {warnings.map((w) => (
              <div key={w} className="rounded-lg bg-amber-900/40 border border-amber-700/70 px-3 py-2 text-amber-100">⚠ {w}</div>
            ))}
            {issues?.map((s) => (
              <div key={s} className="rounded-lg bg-felt-800 px-3 py-2 text-ivory/60 text-xs">📷 {s}</div>
            ))}
          </div>
        )}
        </>)}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-felt-700 bg-felt-900/95 backdrop-blur px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md flex gap-2">
          {step === 'tiles' ? (
            <>
              <button onClick={onRetake} className="rounded-xl px-4 py-3.5 font-semibold bg-felt-700 text-ivory/80">Retake</button>
              <PrimaryButton enabled={tilesDone} onClick={tilesNext}>
                {errors.length ? 'Fix errors above' : 'Next'}
              </PrimaryButton>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(step === 'details' ? 'winning' : 'tiles')}
                className="rounded-xl px-4 py-3.5 font-semibold bg-felt-700 text-ivory/80"
              >Back</button>
              {step === 'winning' ? (
                <PrimaryButton enabled={!!winItem} onClick={() => setStep('details')}>
                  {winItem ? 'Next' : 'Tap your winning tile'}
                </PrimaryButton>
              ) : (
                <PrimaryButton enabled={canScore} onClick={() => onCommit({ ...hand, ctx: fullCtx })}>
                  {!win.winType ? 'Choose where it came from' : canScore ? 'Calculate score' : 'Not a winning hand'}
                </PrimaryButton>
              )}
            </>
          )}
        </div>
      </div>

      {/* The unit being dragged follows the finger. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex gap-0.5 rounded-lg bg-felt-700/90 p-1 shadow-2xl"
          style={{ left: drag.x - 20, top: drag.y - 34 }}
        >
          {drag.ids.map((id, i) => <div key={i}>{tileFace({ id }, 'sm')}</div>)}
        </div>
      )}

      {verdict && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setVerdict(null)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-felt-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {verdict.kind === 'notWinning' ? (
              <>
                <h3 className="font-bold text-lg text-red-200">⛔ Not a winning hand</h3>
                <p className="mt-2 text-sm text-ivory/75">
                  These tiles don't make a complete hand (four sets and a pair, or a special hand).
                </p>
                <p className="mt-2 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-sm text-red-100">
                  False win: pay <b>{FALSE_WIN_PENALTY.notWinning}</b> to each other player
                  ({FALSE_WIN_PENALTY.notWinning * 3} total).
                </p>
                <p className="mt-2 text-xs text-ivory/50">If the scan got a tile wrong or missed one, fix it and try again.</p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg text-amber-200">⚠ Under 8 fan</h3>
                <p className="mt-2 text-sm text-ivory/75">
                  Even in the best case this hand scores <b>{verdict.fan} fan</b>, below the 8-fan minimum.
                </p>
                <p className="mt-2 rounded-lg bg-amber-900/40 border border-amber-700/70 px-3 py-2 text-sm text-amber-100">
                  False win: pay <b>{FALSE_WIN_PENALTY.underEight}</b> to each other player
                  ({FALSE_WIN_PENALTY.underEight * 3} total).
                </p>
                <p className="mt-2 text-xs text-ivory/50">
                  Only a special win (last tile, kong replacement tile, robbing a kong) could add enough.
                </p>
              </>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setVerdict(null)} className="flex-1 rounded-xl py-3 font-semibold bg-felt-700 text-ivory/80">
                Fix the tiles
              </button>
              {verdict.kind === 'underEight' && (
                <button
                  onClick={() => { setVerdict(null); setStep('winning') }}
                  className="flex-1 rounded-xl py-3 font-semibold bg-felt-700 text-ivory/80"
                >Continue anyway</button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing !== null && (
        <TileChooser
          item={current}
          counts={counts}
          onPick={pick}
          onRemove={() => { setItems((arr) => arr.filter((it) => it.key !== editing)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
