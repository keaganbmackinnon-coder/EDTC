import { useEffect, useState } from 'react'

const SCAN_DOTS = [0, 1, 2]

export default function ExoTracker() {
  const [scans, setScans] = useState([])

  useEffect(() => {
    const off = window.__edtc?.on('exo_scan', (payload) => {
      setScans(prev => {
        const key = `${payload.body}::${payload.species}`
        const existing = prev.find(s => s.key === key)
        const updated = { ...payload, key }
        if (existing) {
          return prev.map(s => s.key === key ? updated : s)
        }
        return [updated, ...prev].slice(0, 6)
      })
    })

    // Reset on new system
    const offJump = window.__edtc?.on('system_jumped', () => setScans([]))
    return () => { off(); offJump() }
  }, [])

  const active = scans.filter(s => !s.completed)
  const done = scans.filter(s => s.completed)

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[310px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Exobiology</span>
          {done.length > 0 && (
            <span className="ml-auto text-ed-success text-xs font-mono">{done.length} logged</span>
          )}
        </div>

        {scans.length === 0 ? (
          <p className="text-ed-muted text-xs font-mono">No scans in progress</p>
        ) : (
          <div className="space-y-2">
            {active.map(s => <ScanRow key={s.key} scan={s} />)}
            {done.map(s => <ScanRow key={s.key} scan={s} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ScanRow({ scan }) {
  return (
    <div className={`rounded px-2 py-1.5 ${scan.completed ? 'bg-ed-success/10 border border-ed-success/20' : 'bg-ed-dark border border-ed-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-mono font-semibold truncate ${scan.completed ? 'text-ed-success' : 'text-ed-text'}`}>
            {scan.species || 'Unknown species'}
          </p>
          <p className="text-[10px] text-ed-muted font-mono">
            {scan.genus} · Body {scan.body}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {SCAN_DOTS.map(i => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full border ${
                i < scan.scan_count
                  ? 'bg-ed-success border-ed-success'
                  : 'bg-transparent border-ed-border'
              }`}
            />
          ))}
        </div>
      </div>
      {!scan.completed && (
        <p className="text-[10px] text-ed-muted font-mono mt-0.5">
          {scan.scan_count}/3 samples
        </p>
      )}
    </div>
  )
}
