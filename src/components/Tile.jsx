import { tileImage, tileLabel, tileAccent, parseTile } from '../engine/tiles.js'

// A single mahjong tile. Uses the FluffyStuff SVG for the 34 standard tiles;
// flowers & seasons (which that set lacks) are drawn as styled CSS tiles.
export default function Tile({ id, size = 'md', onClick, disabled, count }) {
  const dims = {
    sm: 'w-9 h-12 text-[10px]',
    md: 'w-11 h-[3.75rem] text-xs',
    lg: 'w-12 h-16 text-sm',
  }[size]

  const img = tileImage(id)
  const t = parseTile(id)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative shrink-0 ${dims} rounded-md bg-ivory shadow-tile
        flex items-center justify-center select-none
        transition-transform active:scale-95
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
    >
      {id === 'dw' ? (
        <WhiteDragonFace />
      ) : img ? (
        <img src={img} alt={id} draggable={false} className="w-[78%] h-[78%] object-contain" />
      ) : (
        <FlowerFace t={t} />
      )}
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full
          bg-gold text-brown-dark text-[10px] font-bold flex items-center justify-center shadow">
          {count}
        </span>
      )}
    </button>
  )
}

// White Dragon (白板): the standard tile is blank, so draw the conventional
// framed rectangle instead of the all-white image.
function WhiteDragonFace() {
  return (
    <div className="w-[62%] h-[74%] rounded-[3px] border-[3px] border-[#13314f]" />
  )
}

function FlowerFace({ t }) {
  const accent = tileAccent(t.id)
  const tag = t.kind === 'flower' ? '花' : '季'
  return (
    <div className="flex flex-col items-center justify-center leading-none" style={{ color: accent }}>
      <span className="text-base font-semibold" style={{ fontFamily: 'serif' }}>
        {tileLabel(t.id)}
      </span>
      <span className="mt-0.5 text-[8px] font-bold opacity-70">{tag}{t.value}</span>
    </div>
  )
}
