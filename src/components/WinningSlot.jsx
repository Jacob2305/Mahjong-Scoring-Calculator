import Tile from './Tile.jsx'

// A single tile-sized slot for the winning tile. Tap it to arm "pick" mode,
// then tap the tile you won on from the bottom picker. The engine derives the
// wait from it. The × clears it.
export default function WinningSlot({ tile, valid, picking, onToggle, onClear }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      title="Mark the tile you won on"
      className={`relative shrink-0 w-9 h-12 rounded-md flex items-center justify-center
        cursor-pointer border-2 transition-all
        ${picking
          ? 'border-gold bg-gold/15 animate-pulse'
          : tile
            ? 'border-transparent'
            : 'border-dashed border-felt-600 bg-felt-900/40'}`}
    >
      {tile ? (
        <span className={valid ? '' : 'opacity-40'}>
          <Tile id={tile} size="sm" />
        </span>
      ) : (
        <span className="text-center leading-none text-ivory/45">
          <span className="block text-sm">和</span>
          <span className="block text-[8px] uppercase tracking-wide">win</span>
        </span>
      )}
      {tile && (
        <span
          onClick={(e) => { e.stopPropagation(); onClear() }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-felt-600 text-ivory
            text-[10px] leading-none flex items-center justify-center shadow"
        >
          ✕
        </span>
      )}
    </div>
  )
}
