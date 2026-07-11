import { useEffect, useState } from 'react'

const SCAN_DOTS = [0, 1, 2]

export default function ExoTracker() {
  const [scans, setScans] = useState([])
  const [dist, setDist] = useState(null)

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
      // A completed species clears the distance helper for it
      if (payload.completed) setDist(d => (d && d.species === payload.species ? null : d))
    })

    const offDist = window.__edtc?.on('exo_distance', (payload) => setDist(payload))

    // Reset on new system
    const offJump = window.__edtc?.on('system_jumped', () => { setScans([]); setDist(null) })
    return () => { off(); offDist(); offJump() }
  }, [])

  const active = scans.filter(s => !s.completed)
  const done = scans.filter(s => s.completed)

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[310px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Exobiology</span>
          {done.length > 0 && (
            <span className="ml-auto text-ed-success text-xs font-mono">{done.length} logged</span>
          )}
        </div>

        {dist && <DistanceBar dist={dist} />}

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

function DistanceBar({ dist }) {
  const pct = dist.required ? Math.min(100, (dist.distance / dist.required) * 100) : 100
  const remaining = Math.max(0, (dist.required ?? 0) - (dist.distance ?? 0))
  return (
    <div className={`rounded px-2 py-1.5 mb-2 border ${dist.clear ? 'border-ed-success/50 bg-ed-success/10' : 'border-ed-orange/40 bg-ed-orange/10'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-ed-muted truncate">{dist.species}</span>
        <span className={`text-[11px] font-mono font-semibold ${dist.clear ? 'text-ed-success' : 'text-ed-orange'}`}>
          {dist.clear ? 'Sample here ✓' : `+${Math.round(remaining)} m`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ed-dark overflow-hidden">
        <div className={`h-full ${dist.clear ? 'bg-ed-success' : 'bg-ed-orange'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-ed-muted font-mono mt-0.5">
        {Math.round(dist.distance)}/{dist.required} m · sample {dist.samples}/3
      </p>
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
