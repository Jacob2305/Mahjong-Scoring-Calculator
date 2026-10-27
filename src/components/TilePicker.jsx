import Tile from './Tile.jsx'
import { TILE_SECTIONS, isFlower } from '../engine/tiles.js'

// Scrollable grid of every tile, grouped into sections. Shows how many copies
// of each tile are already in the hand and disables a tile at its limit.
export default function TilePicker({ counts, onAdd, picking }) {
  return (
    <div className="space-y-3">
      {TILE_SECTIONS.map((section) => (
        <div key={section.key}>
          <div className="text-[11px] uppercase tracking-wide text-gold/80 mb-1.5">
            {section.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {section.tiles.map((id) => {
              const used = counts[id] || 0
              const max = isFlower(id) ? 1 : 4
              return (
                <Tile
                  key={id}
                  id={id}
                  size="md"
                  count={used}
                  disabled={!picking && used >= max}
                  onClick={() => onAdd(id)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
