import { useEffect, useState } from 'react'

const HIDE_BELOW = 10_000

function fmtK(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`
  return `${n}`
}

export default function FssValues() {
  const [data, setData] = useState(null) // {system, bodies, body_count}

  useEffect(() => {
    const off = window.__edtc?.on('fss_update', (payload) => setData(payload))
    const offJump = window.__edtc?.on('system_changed', () => setData(null))
    return () => { off(); offJump() }
  }, [])

  const bodies = data?.bodies ?? []
  const total = bodies.reduce((s, b) => s + (b.value || 0), 0)
  const allScanned = data?.body_count > 0 && bodies.length >= data.body_count
  const shown = bodies
    .filter(b => (b.value || 0) >= HIDE_BELOW || b.bio_count > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 12)
  const hiding = bodies.length - shown.length

  return (
    <div className="w-full h-screen flex items-start justify-center pt-2 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-2 shadow-2xl min-w-[300px] max-w-[312px]">

        <p className="text-ed-success text-sm font-mono font-semibold truncate">
          <Flag lit /> {data?.system || 'FSS Values'}
          {allScanned && <span className="ml-1.5">✔</span>}
        </p>

        <p className="text-ed-orange text-xs font-mono mt-0.5">
          Scanned {allScanned ? `all ${bodies.length}` : bodies.length} bodies: {fmtK(total)} CR
        </p>
        {hiding > 0 && (
          <p className="text-ed-muted text-[10px] font-mono">( Hiding {hiding} bodies &lt; 10 K CR )</p>
        )}

        {shown.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {shown.map(b => <BodyRow key={b.body} b={b} />)}
          </div>
        )}
        {bodies.length === 0 && (
          <p className="text-ed-muted text-xs font-mono mt-1">Scanning…</p>
        )}

        <div className="text-ed-muted/70 text-[9px] font-mono mt-1.5 border-t border-ed-border pt-1 leading-tight">
          <p>Scan value | DSS value · 🌿 Bio</p>
          <p>🌐 Terraformable · 🛬 Landable · ⚑ Undiscovered</p>
        </div>
      </div>
    </div>
  )
}

function Flag({ lit }) {
  return <span className={lit ? 'text-ed-success' : 'text-ed-orange'}>⚑</span>
}

function BodyRow({ b }) {
  const colour = b.dss ? 'text-ed-success' : 'text-ed-orange'
  return (
    <div className="font-mono text-xs leading-snug">
      <p className={`truncate ${colour}`}>
        {!b.discovered && <span className="mr-1">⚑</span>}
        {b.short} - {b.class}
        {b.terraformable && <span className="ml-1">🌐</span>}
        {b.bio_count > 0 && <span className="ml-1">🌿</span>}
        {b.landable && b.bio_count === 0 && <span className="ml-1 text-ed-muted">🛬</span>}
      </p>
      <p className="pl-3 text-[11px]">
        <span className={colour}>{fmtK(b.value)}</span>
        {b.mapped_value > 0 && (
          <span className="text-ed-text/70"> | {b.mapped_value.toLocaleString()}</span>
        )}
        {b.bio_count > 0 && (
          <span className="text-ed-success"> | {b.bio_count} Genus</span>
        )}
      </p>
    </div>
  )
}
