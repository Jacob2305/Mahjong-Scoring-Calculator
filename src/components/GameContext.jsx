const WINDS = [['e', 'East 东'], ['s', 'South 南'], ['w', 'West 西'], ['n', 'North 北']]

// Seat/prevalent winds, win type, wait type and advanced situational flags.
export default function GameContext({ ctx, onChange }) {
  const set = (patch) => onChange({ ...ctx, ...patch })
  const setFlag = (k, v) => onChange({ ...ctx, flags: { ...ctx.flags, [k]: v } })

  return (
    <div className="space-y-3 rounded-xl bg-felt-800/70 p-3">
      <Segment label="Seat Wind 门风" options={WINDS} value={ctx.seatWind} onSelect={(v) => set({ seatWind: v })} />
      <Segment label="Prevalent Wind 圈风" options={WINDS} value={ctx.prevalentWind} onSelect={(v) => set({ prevalentWind: v })} />
      <Segment
        label="Win Type"
        options={[['discard', 'By Discard'], ['selfdraw', 'Self Draw']]}
        value={ctx.winType}
        onSelect={(v) => set({ winType: v })}
      />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-ivory/50 mb-1.5">Special win</div>
        <div className="grid grid-cols-1 gap-1.5">
          <Flag label="Last tile of the game (海底/河底)" k="lastTile" ctx={ctx} setFlag={setFlag} />
          <Flag label="Kong replacement draw (岭上开花)" k="kongReplacement" ctx={ctx} setFlag={setFlag} />
          <Flag label="Robbing the kong (抢杠)" k="robbingKong" ctx={ctx} setFlag={setFlag} />
        </div>
      </div>
    </div>
  )
}

function Segment({ label, options, value, onSelect }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ivory/50 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${value === v ? 'bg-gold text-brown-dark' : 'bg-felt-700 text-ivory/70'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Flag({ label, k, ctx, setFlag }) {
  const on = !!(ctx.flags && ctx.flags[k])
  return (
    <label className="flex items-center gap-2 text-sm text-ivory/80">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setFlag(k, e.target.checked)}
        className="w-4 h-4 accent-gold"
      />
      {label}
    </label>
  )
}
