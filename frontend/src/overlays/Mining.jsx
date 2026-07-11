import { useEffect, useState } from 'react'

// NOTE: overlay windows have no pywebview API bridge — data arrives via
// backend pushes (mining_update). Window sizing is backend-driven:
// emit_to_overlay triggers resize_to_content(), which measures the
// #overlay-panel node — keep that id on the panel div.

function fmtCr(n) {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDuration(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const CONTENT_COLOR = { High: 'text-ed-success', Medium: 'text-yellow-400', Low: 'text-ed-muted' }

export default function MiningOverlay() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    const off = window.__edtc?.on('mining_update', payload => setSession(payload ?? null))
    return () => off?.()
  }, [])

  if (!session?.active) {
    return (
      <div className="w-full flex items-start justify-center pt-3 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[300px]">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Mining</span>
          <p className="text-ed-muted text-xs font-mono mt-1">Waiting for mining activity…</p>
        </div>
      </div>
    )
  }

  const lp = session.last_prospect
  const topRefined = (session.refined ?? []).slice(0, 4)

  return (
    <div className="w-full flex items-start justify-center pt-3 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-orange/40 rounded-lg px-4 py-3 shadow-2xl min-w-[300px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Mining</span>
          <span className="text-ed-muted text-[10px] font-mono">{fmtDuration(session.duration)}</span>
        </div>

        {/* Headline numbers */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-ed-orange font-mono text-lg font-bold">{session.total_tons}T</span>
          <span className="text-ed-text font-mono text-xs">
            {session.tons_per_hour != null ? `${session.tons_per_hour} T/hr` : '—'}
          </span>
          <span className="text-ed-success font-mono text-xs">{fmtCr(session.est_value)} cr</span>
        </div>

        {/* Refined breakdown */}
        {topRefined.length > 0 && (
          <div className="space-y-0.5 mb-2">
            {topRefined.map(r => (
              <div key={r.name} className="flex items-center justify-between text-xs font-mono">
                <span className="text-ed-text truncate">{r.name}</span>
                <span className="text-ed-orange font-semibold ml-2 shrink-0">{r.tons}T</span>
              </div>
            ))}
          </div>
        )}

        {/* Last prospect */}
        {lp && (
          <div className="border-t border-ed-border/40 pt-1.5 mb-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
              <span className="text-ed-muted uppercase tracking-wider">Last prospect</span>
              <span className={CONTENT_COLOR[lp.content] ?? 'text-ed-muted'}>{lp.content || '—'}</span>
            </div>
            {lp.motherlode && (
              <p className="text-yellow-400 text-xs font-mono font-semibold">◆ Core: {lp.motherlode}</p>
            )}
            {(lp.materials ?? []).slice(0, 3).map(m => (
              <div key={m.name} className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-ed-text truncate">{m.name}</span>
                <span className="text-ed-muted ml-2 shrink-0">{m.proportion}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer: prospected + merits */}
        <div className="flex items-center justify-between text-[10px] font-mono text-ed-muted">
          <span>
            {session.prospected} prospected
            {session.cracked > 0 && ` · ${session.cracked} cracked`}
          </span>
          {session.merits > 0 && (
            <span className="text-purple-400 font-semibold">+{session.merits} merits</span>
          )}
        </div>
      </div>
    </div>
  )
}
