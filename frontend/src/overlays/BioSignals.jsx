import { useEffect, useState } from 'react'

function fmtM(v) {
  if (!v) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} K`
  return `${v}`
}

// System-wide bio rollup: one line per body with genus chips + max value
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
        <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-1.5 shadow-2xl w-[226px]">
          <p className="text-ed-muted text-xs font-mono">No bio signals yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex items-start justify-center pt-2 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-1.5 shadow-2xl w-[226px] font-mono">
        <p className="text-ed-orange text-xs">Bio signals: <span className="font-semibold">{data.total}</span></p>

        <div className="mt-1 space-y-0.5">
          {data.bodies.map(b => (
            <div key={b.body} className="flex items-center gap-1.5">
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
          ))}
        </div>

        <p className="text-ed-orange text-xs mt-1 border-t border-ed-orange/40 pt-0.5">
          Rewards: {fmtM(data.rewards)}
        </p>
      </div>
    </div>
  )
}
