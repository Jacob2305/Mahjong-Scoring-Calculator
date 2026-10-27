import Tile from './Tile.jsx'
import { tileSortKey } from '../engine/tiles.js'

// The two hand zones double as the active-zone selector: tap a box to make it
// active (it lights up gold); tiles you add then drop into it. Tap any tile to
// remove it.
export default function HandDisplay({ concealed, melded, activeZone, onSelectZone, onRemove }) {
  const Zone = ({ label, sub, zone, tiles, empty }) => {
    const active = activeZone === zone
    const list = tiles
      .map((t, i) => [t, i])
      .sort((a, b) => tileSortKey(a[0]) - tileSortKey(b[0]))
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectZone(zone)}
        className={`cursor-pointer rounded-xl p-2.5 transition-all border-2
          ${active ? 'border-gold bg-gold/10 shadow-lg' : 'border-felt-700 bg-felt-900/50'}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-semibold ${active ? 'text-gold' : 'text-ivory/55'}`}>
            {label} <span className="font-normal opacity-70">{sub}</span>
          </span>
          {active && (
            <span className="text-[10px] uppercase tracking-wide text-gold/90">← adding here</span>
          )}
        </div>
        <div className="min-h-[3.75rem] flex flex-wrap gap-1">
          {list.length === 0 && (
            <span className="self-center px-1 text-xs text-ivory/30">{empty}</span>
          )}
          {list.map(([id, idx]) => (
            <Tile
              key={zone + idx + id}
              id={id}
              size="md"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(zone, idx)
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Zone label="Concealed 暗" sub="in hand" zone="concealed" tiles={concealed} empty="tap to select, then add tiles below" />
      <Zone label="Melded 明" sub="exposed" zone="melded" tiles={melded} empty="tap to select for exposed sets" />
    </div>
  )
}
