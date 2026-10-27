const TIER_STYLES = {
  gold: 'bg-gradient-to-br from-gold-light to-gold text-brown-dark',
  orange: 'bg-amber-500 text-brown-dark',
  blue: 'bg-sky-600 text-ivory',
  gray: 'bg-felt-600 text-ivory',
}

// One scoring rule in the breakdown list.
export default function FanCard({ fan }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-felt-800/70 px-3 py-2.5">
      <div
        className={`shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center
          font-bold leading-none ${TIER_STYLES[fan.tier]}`}
      >
        <span className="text-lg">{fan.points}</span>
        <span className="text-[9px] uppercase tracking-wide opacity-80">fan</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-ivory">{fan.name}</span>
          <span className="text-ivory/60 text-sm">{fan.nameCn}</span>
          {fan.count > 1 && (
            <span className="text-gold text-xs font-bold">×{fan.count}</span>
          )}
        </div>
        <div className="text-ivory/55 text-xs mt-0.5">{fan.desc}</div>
      </div>
      <div className="shrink-0 text-gold font-bold text-lg tabular-nums">+{fan.total}</div>
    </div>
  )
}
