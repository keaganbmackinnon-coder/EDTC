import { useEffect, useState } from 'react'

function fmtM(v) {
  if (!v) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} K`
  return `${v}`
}

// One predicted/sampled species line, SrvSurvey-style: "?Genus ?Species  value"
function SpeciesLine({ sp }) {
  const predicted = sp.state === 'predicted'
  const done = sp.state === 'done'
  const cls = done ? 'text-ed-muted line-through'
    : sp.state === 'sampling' ? 'text-ed-success'
    : 'text-ed-gold'
  return (
    <div className={`flex items-baseline gap-1 text-[10px] leading-4 ${cls}`}>
      <span className="flex-1 min-w-0 truncate">
        {predicted ? '?' : ''}{sp.name || sp.genus}
      </span>
      <span className="shrink-0">{fmtM(sp.value)}</span>
      {sp.ff_value > sp.value && (
        <span className="shrink-0 text-ed-gold/80">×5</span>
      )}
    </div>
  )
}

// System-wide bio rollup: one line per body with genus chips + max value.
// The body the CMDR just FSS'd/DSS'd (payload.focus) expands to show its
// predicted species — same info SrvSurvey surfaces during FSS.
export default function BioSignals() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const off = window.__edtc?.on('bio_panel', (payload) => {
      setData(payload?.clear ? null : payload)
    })
    const offJump = window.__edtc?.on('system_changed', () => setData(null))
    return () => { off(); offJump() }
  }, [])

  if (!data) {
    return (
      <div className="w-full flex items-start justify-center pt-2 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-1.5 shadow-2xl w-[248px]">
          <p className="text-ed-muted text-xs font-mono">No bio signals yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex items-start justify-center pt-2 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-1.5 shadow-2xl w-[248px] font-mono">
        <p className="text-ed-orange text-xs">Bio signals: <span className="font-semibold">{data.total}</span></p>

        <div className="mt-1 space-y-0.5">
          {data.bodies.map(b => {
            const focused = data.focus != null && b.body_id === data.focus
            return (
              <div key={b.body_id ?? b.body}>
                <div className="flex items-center gap-1.5">
                  <span className="text-ed-text text-sm w-7 shrink-0 truncate">{b.body}</span>
                  <span className="flex gap-0.5 flex-1 min-w-0 overflow-hidden">
                    {b.chips.map((c, i) => (
                      <span key={i}
                            title={c.genus}
                            className={`text-[9px] px-1 rounded-sm border leading-4 shrink-0 ${
                              c.done ? 'text-ed-muted border-ed-border line-through'
                                : c.predicted ? 'text-ed-gold border-ed-gold/50'
                                : 'text-ed-success border-ed-success/50'
                            }`}>
                        {c.genus.slice(0, 3)}
                      </span>
                    ))}
                  </span>
                  <span className="text-ed-success text-xs shrink-0">{fmtM(b.value)}</span>
                </div>
                {focused && b.species?.length > 0 && (
                  <div className="ml-7 mb-0.5 border-l border-ed-border pl-1.5">
                    {b.species.map((sp, i) => <SpeciesLine key={i} sp={sp} />)}
                    {!b.confirmed && (
                      <p className="text-ed-muted text-[9px] leading-4">predicted — DSS to confirm</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-ed-orange text-xs mt-1 border-t border-ed-orange/40 pt-0.5">
          Rewards: {fmtM(data.rewards)}
          {data.ff_rewards > data.rewards && (
            <span className="text-ed-gold"> (FF: {fmtM(data.ff_rewards)})</span>
          )}
        </p>
      </div>
    </div>
  )
}
