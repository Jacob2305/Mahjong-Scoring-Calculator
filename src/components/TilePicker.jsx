import { useState } from 'react'
import Tile from './Tile.jsx'
import { TILE_SECTIONS, isFlower } from '../engine/tiles.js'

// Suit bar for the tabbed picker. Winds and dragons share the honours tab.
const TABS = [
  { key: 'man', cn: '万', en: 'Chars', sections: ['man'] },
  { key: 'sou', cn: '条', en: 'Bamboo', sections: ['sou'] },
  { key: 'pin', cn: '筒', en: 'Dots', sections: ['pin'] },
  { key: 'honor', cn: '字', en: 'Honours', sections: ['wind', 'dragon'] },
]

// Grid of tiles grouped into sections. Shows how many copies of each tile are
// already in the hand and disables a tile at its limit. With `tabbed`, a suit
// bar (next to `title`) shows one group at a time to keep the screen short.
export default function TilePicker({ counts, onAdd, picking, tabbed = false, title = null }) {
  const [tab, setTab] = useState('man')
  const shown = tabbed
    ? TILE_SECTIONS.filter((s) => TABS.find((t) => t.key === tab).sections.includes(s.key))
    : TILE_SECTIONS
  const inHand = (t) => TILE_SECTIONS
    .filter((s) => t.sections.includes(s.key))
    .reduce((n, s) => n + s.tiles.reduce((m, id) => m + (counts[id] || 0), 0), 0)

  return (
    <div>
      {(title || tabbed) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {title}
          {tabbed && (
            <div className="flex rounded-lg bg-felt-900/70 p-0.5" role="tablist">
              {TABS.map((t) => {
                const on = t.key === tab
                const n = inHand(t)
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(t.key)}
                    className={`relative rounded-md px-2.5 py-1 leading-none transition-colors
                      ${on ? 'bg-gold text-brown-dark' : 'text-ivory/60'}`}
                  >
                    <span className="block text-base font-semibold">{t.cn}</span>
                    <span className="block text-[9px] mt-0.5">{t.en}</span>
                    {n > 0 && !on && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-gold/80 text-brown-dark text-[9px] font-bold flex items-center justify-center">
                        {n}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        {shown.map((section) => (
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
    </div>
  )
}
