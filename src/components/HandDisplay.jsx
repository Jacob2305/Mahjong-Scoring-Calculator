import { useMemo, useRef, useState } from 'react'
import Tile from './Tile.jsx'
import { groupSets } from '../engine/groupSets.js'

const ZONES = [
  { zone: 'concealed', label: 'Concealed 暗', sub: 'in hand', empty: 'tap to select, then add tiles below' },
  { zone: 'melded', label: 'Melded 明', sub: 'exposed', empty: 'tap to select, or drag sets here' },
]

// The two hand zones double as the active-zone selector: tap a box to make it
// active (it lights up gold); tiles you add then drop into it. Sets are
// bracketed. Tap a tile to remove it; drag a tile or bracketed set to move it
// to the other box.
export default function HandDisplay({ concealed, melded, activeZone, onSelectZone, onRemove, onMove }) {
  const tiles = { concealed, melded }
  const units = useMemo(() => ({ concealed: groupSets(concealed), melded: groupSets(melded) }), [concealed, melded])
  const zoneRefs = { concealed: useRef(null), melded: useRef(null) }
  const press = useRef(null)
  const justDragged = useRef(false) // swallow the click that follows a drag
  const lastTap = useRef(null) // which tile in a set was pressed
  const [drag, setDrag] = useState(null) // { from, idxs, ids, x, y, over }

  function zoneAt(x, y) {
    for (const { zone } of ZONES) {
      const r = zoneRefs[zone].current?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return zone
    }
    return null
  }
  function onPointerDown(e, zone, unit) {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const tapIdx = Number(e.target.closest('[data-idx]')?.dataset.idx ?? unit[0])
    press.current = { from: zone, idxs: unit, ids: unit.map((i) => tiles[zone][i]), tapIdx, x0: e.clientX, y0: e.clientY, dragging: false }
  }
  function onPointerMove(e) {
    const p = press.current
    if (!p) return
    if (!p.dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8) return
    p.dragging = true
    setDrag({ from: p.from, idxs: p.idxs, ids: p.ids, x: e.clientX, y: e.clientY, over: zoneAt(e.clientX, e.clientY) })
  }
  function onPointerUp(e) {
    const p = press.current
    press.current = null
    if (!p) return
    justDragged.current = p.dragging
    lastTap.current = p.tapIdx
    if (!p.dragging) return // a tap: the click handler removes the tile
    setDrag(null)
    const over = zoneAt(e.clientX, e.clientY)
    if (over && over !== p.from) onMove(p.from, p.idxs, over)
  }
  function onPointerCancel() { press.current = null; setDrag(null) }

  return (
    <div className="space-y-2">
      {ZONES.map(({ zone, label, sub, empty }) => {
        const active = activeZone === zone
        const target = drag && drag.over === zone && drag.from !== zone
        return (
          <div
            key={zone}
            ref={zoneRefs[zone]}
            role="button"
            tabIndex={0}
            onClick={() => onSelectZone(zone)}
            className={`cursor-pointer rounded-xl p-2.5 transition-all border-2
              ${target ? 'border-gold bg-gold/20' : active ? 'border-gold bg-gold/10 shadow-lg' : 'border-felt-700 bg-felt-900/50'}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-sm font-semibold ${active ? 'text-gold' : 'text-ivory/55'}`}>
                {label} <span className="font-normal opacity-70">{sub}</span>
              </span>
              {active && (
                <span className="text-[10px] uppercase tracking-wide text-gold/90">← adding here</span>
              )}
            </div>
            <div className="min-h-[3.75rem] flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
              {units[zone].length === 0 && (
                <span className="self-center px-1 text-xs text-ivory/30">{empty}</span>
              )}
              {units[zone].map((unit) => {
                const dragging = drag && drag.from === zone && drag.idxs.includes(unit[0])
                return (
                  <div
                    key={zone + unit.join('-') + tiles[zone][unit[0]]}
                    className={`flex gap-0.5 rounded-lg select-none ${unit.length > 1 ? 'bg-felt-700/70 p-1' : ''} ${dragging ? 'opacity-30' : ''}`}
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => onPointerDown(e, zone, unit)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onClick={(e) => {
                      e.stopPropagation() // don't also select the box
                      if (justDragged.current) { justDragged.current = false; return }
                      onRemove(zone, lastTap.current ?? unit[0])
                    }}
                  >
                    {unit.map((idx) => (
                      <span key={idx} data-idx={idx}><Tile id={tiles[zone][idx]} size="md" /></span>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* The set being dragged follows the finger. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex gap-0.5 rounded-lg bg-felt-700/90 p-1 shadow-2xl"
          style={{ left: drag.x - 20, top: drag.y - 34 }}
        >
          {drag.ids.map((id, i) => <Tile key={i} id={id} size="sm" />)}
        </div>
      )}
    </div>
  )
}
