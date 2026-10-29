import Tile from '../components/Tile.jsx'
import TilePicker from '../components/TilePicker.jsx'
import { tileName } from '../engine/tiles.js'

const BONUS = ['f1', 'f2', 'f3', 'f4', 'y1', 'y2', 'y3', 'y4']

// Bottom sheet to correct one scanned tile (or add a missing one).
// `item` is null when adding.
export default function TileChooser({ item, counts, onPick, onRemove, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-felt-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ivory">{item ? 'Fix this tile' : 'Add a missing tile'}</h3>
          <button onClick={onClose} className="rounded-lg bg-felt-700 w-8 h-8 text-ivory/70">✕</button>
        </div>

        {item && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-felt-900/60 p-3">
            {item.id === 'unknown' ? (
              <div className="w-12 h-16 rounded-md bg-ivory/20 flex items-center justify-center text-2xl text-ivory/60">?</div>
            ) : (
              <Tile id={item.id} size="lg" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-ivory">
                {item.id === 'unknown' ? 'Not identified' : tileName(item.id)}
              </div>
              {item.note && <div className="text-ivory/60 text-xs mt-0.5">{item.note}</div>}
              <div className="text-ivory/40 text-xs mt-0.5">Scan confidence: {item.confidence}</div>
            </div>
          </div>
        )}

        {item && (
          <button onClick={onRemove} className="mb-4 w-full rounded-xl py-2.5 font-semibold bg-red-800/80 text-ivory">
            Remove this tile
          </button>
        )}

        <div className="text-sm uppercase tracking-wide mb-2 text-gold/80">
          {item ? 'Change it to' : 'Tap the tile to add'}
        </div>
        <TilePicker counts={counts} onAdd={onPick} picking />
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-gold/80 mb-1.5">Flowers 花 · Seasons 季</div>
          <div className="flex flex-wrap gap-1.5">
            {BONUS.map((id) => (
              <Tile key={id} id={id} size="md" count={counts[id] || 0} onClick={() => onPick(id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
