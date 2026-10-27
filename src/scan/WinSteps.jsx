import Tile from '../components/Tile.jsx'
import { isWind } from '../engine/tiles.js'

const WINDS = [['e', 'East 东'], ['s', 'South 南'], ['w', 'West 西'], ['n', 'North 北']]

// Step 2: tap the tile you won on, from either box. `units` is
// { concealed, revealed }, each a list of tile groups.
export function WinningTileStep({ units, selectedKey, onSelect }) {
  const boxes = [['concealed', 'Concealed 暗'], ['revealed', 'Revealed 明']].filter(([z]) => units[z].length)
  return (
    <div className="mt-3">
      <p className="text-sm text-ivory/70">
        Tap the tile you won on: the last tile you drew or claimed. Then press Next.
      </p>
      {boxes.map(([zone, label]) => (
      <div key={zone} className="mt-3 rounded-xl p-2.5 border-2 border-felt-700 bg-felt-900/50">
        <div className="mb-1.5 text-sm font-semibold text-ivory/70">{label}</div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {units[zone].map((unit) => (
            <div key={unit[0].key} className={`flex gap-0.5 rounded-lg ${unit.length > 1 ? 'bg-felt-700/70 p-1' : ''}`}>
              {unit.map((it) => {
                const on = it.key === selectedKey
                return (
                  <div
                    key={it.key}
                    className={`rounded-md transition-all ${on ? 'ring-[3px] ring-gold -translate-y-1.5 shadow-[0_0_14px_rgba(227,200,118,0.8)]' : ''}`}
                  >
                    <Tile id={it.id} size="md" onClick={() => onSelect(it)} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      ))}
      <p className="mt-2 text-xs text-ivory/45">
        Whether you drew it or took a discard, you'll say on the next step. That's what decides the
        concealed-hand points.
      </p>
    </div>
  )
}

// Does the hand contain a pung/kong of winds? Only then do seat and
// prevalent wind affect the score.
export function hasWindPung(ids) {
  const c = {}
  for (const id of ids) if (isWind(id)) c[id] = (c[id] || 0) + 1
  return Object.values(c).some((n) => n >= 3)
}
const hasKong = (ids) => {
  const c = {}
  for (const id of ids) c[id] = (c[id] || 0) + 1
  return Object.values(c).some((n) => n >= 4)
}

// Step 3: how the hand was won. `win` is { winType, flags, seatWind, prevalentWind }.
export function WinDetailsStep({ win, onChange, allIds, winningTile }) {
  const set = (patch) => onChange({ ...win, ...patch })
  const setFlag = (k, v) => onChange({ ...win, flags: { ...win.flags, [k]: v } })
  const winds = hasWindPung(allIds)

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-felt-900/50 p-2.5">
        <Tile id={winningTile} size="md" />
        <span className="text-sm text-ivory/70">Your winning tile</span>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-ivory mb-2">Where did the winning tile come from?</h3>
        <div className="grid gap-2">
          <Choice
            on={win.winType === 'selfdraw'}
            onClick={() => set({ winType: 'selfdraw', flags: { ...win.flags, robbingKong: false } })}
            title="I drew it from the wall"
            sub="Self-drawn 自摸"
          />
          <Choice
            on={win.winType === 'discard'}
            onClick={() => set({ winType: 'discard', flags: { ...win.flags, kongReplacement: false } })}
            title="Another player discarded it"
            sub="Won on a discard 点和"
          />
        </div>
      </section>

      {win.winType && (
        <section>
          <h3 className="text-sm font-semibold text-ivory mb-2">Anything special? <span className="font-normal text-ivory/50">(usually no)</span></h3>
          <div className="grid gap-2">
            <Check
              on={!!win.flags.lastTile}
              onChange={(v) => setFlag('lastTile', v)}
              label={win.winType === 'selfdraw' ? 'It was the last tile of the wall (海底捞月)' : 'It was the last discard of the game (河底捞鱼)'}
            />
            {win.winType === 'selfdraw' && hasKong(allIds) && (
              <Check
                on={!!win.flags.kongReplacement}
                onChange={(v) => setFlag('kongReplacement', v)}
                label="I drew it as the replacement tile after a kong (杠上开花)"
              />
            )}
            {win.winType === 'discard' && (
              <Check
                on={!!win.flags.robbingKong}
                onChange={(v) => setFlag('robbingKong', v)}
                label="I robbed it from another player's kong (抢杠和)"
              />
            )}
          </div>
        </section>
      )}

      {winds && (
        <section className="space-y-3">
          <p className="text-xs text-ivory/50">You have a pung of winds, so your winds matter:</p>
          <Segment label="Your seat wind 门风" value={win.seatWind} onSelect={(v) => set({ seatWind: v })} />
          <Segment label="Prevalent (round) wind 圈风" value={win.prevalentWind} onSelect={(v) => set({ prevalentWind: v })} />
        </section>
      )}
    </div>
  )
}

function Choice({ on, onClick, title, sub }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors
        ${on ? 'border-gold bg-gold/15' : 'border-felt-700 bg-felt-900/50'}`}
    >
      <div className={`font-semibold ${on ? 'text-gold' : 'text-ivory'}`}>{title}</div>
      <div className="text-xs text-ivory/50">{sub}</div>
    </button>
  )
}

function Check({ on, onChange, label }) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm
      ${on ? 'border-gold bg-gold/10 text-ivory' : 'border-felt-700 bg-felt-900/50 text-ivory/75'}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-gold" />
      {label}
    </label>
  )
}

function Segment({ label, value, onSelect }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ivory/50 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {WINDS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onSelect(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${value === v ? 'bg-gold text-brown-dark' : 'bg-felt-700 text-ivory/70'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
