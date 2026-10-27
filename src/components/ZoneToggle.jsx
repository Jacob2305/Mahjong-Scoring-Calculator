// Large, prominent Concealed / Melded selector — the most-used control.
export default function ZoneToggle({ active, onChange }) {
  const Tab = ({ zone, cn, en }) => {
    const on = active === zone
    return (
      <button
        type="button"
        onClick={() => onChange(zone)}
        className={`flex-1 py-3 rounded-xl font-semibold transition-all
          flex flex-col items-center leading-tight
          ${on
            ? 'bg-gold text-brown-dark shadow-lg scale-[1.02]'
            : 'bg-felt-700 text-ivory/70'}`}
      >
        <span className="text-lg">{cn}</span>
        <span className="text-[11px] uppercase tracking-wide opacity-80">{en}</span>
      </button>
    )
  }
  return (
    <div className="flex gap-2">
      <Tab zone="concealed" cn="暗 Concealed" en="in hand" />
      <Tab zone="melded" cn="明 Melded" en="exposed" />
    </div>
  )
}
