import { useEffect, useState } from 'react'

const SCOOPABLE = new Set(['K', 'G', 'B', 'F', 'O', 'A', 'M'])

// Star-class colour, roughly matching the in-game hues
function classColour(cls) {
  const c = (cls || '').toUpperCase()
  if (!c) return 'text-ed-muted'
  if ('OBA'.includes(c[0])) return 'text-blue-300'
  if (c[0] === 'F') return 'text-ed-text'
  if (c[0] === 'G') return 'text-yellow-200'
  if (c[0] === 'K') return 'text-amber-300'
  if (c[0] === 'M') return 'text-orange-400'
  if (c[0] === 'N' || c[0] === 'H') return 'text-cyan-300'
  if (c[0] === 'D') return 'text-slate-300'
  return 'text-ed-gold'
}

function legLy(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

// NOTE: overlay windows have no pywebview API bridge — all data arrives via
// backend pushes (window.__edtc events). The active route is pushed by
// _push_route_to_overlay() when this window opens; nothing to fetch on mount.
export default function RouteOverlay() {
  const [state, setState] = useState(null)
  const [fsd, setFsd] = useState(null)
  const [jump, setJump] = useState(null) // StartJump + EDSM enrichment

  useEffect(() => {
    const off = window.__edtc?.on('route_update', (payload) => {
      setState(payload)
      setFsd(null)  // stale target info from the previous route
    })
    const offFsd = window.__edtc?.on('fsd_target', (payload) => setFsd(payload))
    const offJump = window.__edtc?.on('jump_info', (payload) => {
      // arrival is signalled by route_update / the next FSDTarget — keep the
      // card until fresher data replaces it
      setJump(payload)
    })
    return () => { off?.(); offFsd?.(); offJump?.() }
  }, [])

  const route = state?.route
  const systems = route?.systems ?? []
  const current = route?.current ?? 0

  if (!route && !jump) {
    return (
      <div className="w-full flex items-start justify-center pt-3 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-2 shadow-2xl w-[648px]">
          <p className="text-ed-muted text-xs font-mono">No active route</p>
        </div>
      </div>
    )
  }

  const remaining = systems.length - current - 1
  const next = systems[current + 1] ?? null

  // Star class of the next jump: StartJump beats FSDTarget beats plotted route
  const nextClass = (jump?.star_class || fsd?.star_class || route?.star_classes?.[current + 1] || '').toUpperCase()
  const scoopable = nextClass ? SCOOPABLE.has(nextClass[0]) : null

  // Remaining distance from the plotted coords (NavRoute carries StarPos)
  let remainingLy = null
  if (route?.coords?.length === systems.length && current < systems.length - 1) {
    remainingLy = 0
    for (let i = current; i < systems.length - 1; i++) {
      remainingLy += legLy(route.coords[i], route.coords[i + 1])
    }
  }

  const jumpName = jump?.system || next

  return (
    <div className="w-full flex items-start justify-center pt-3 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-4 py-2 shadow-2xl w-[648px] font-mono">

        {/* Header: next jump + star class */}
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-ed-orange text-xs shrink-0">Next jump:</span>
          <span className="text-ed-orange text-base font-bold truncate min-w-0">
            {jumpName || (route ? `${systems[current] ?? ''} (arrived)` : '—')}
          </span>
          {nextClass && (
            <span className="text-xs shrink-0">
              <span className="text-ed-muted">class: </span>
              <span className={`font-bold ${classColour(nextClass)}`}>{nextClass}</span>
              {scoopable === false && <span className="text-amber-400 font-bold"> · NOT SCOOPABLE</span>}
            </span>
          )}
          {route && (
            <span className="text-ed-muted text-[10px] shrink-0 ml-auto">
              {remaining} {remaining === 1 ? 'jump' : 'jumps'} left · Ctrl+Shift+C copies next
            </span>
          )}
        </div>

        {/* Tick progress bar: one tick per jump, arrow at current position */}
        {route && systems.length > 1 && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-ed-orange text-[11px] shrink-0">#{current + 1} of {systems.length}</span>
            <TickBar count={systems.length} current={current} />
            {remainingLy != null && (
              <span className="text-ed-orange text-[11px] shrink-0">
                {Math.round(remainingLy).toLocaleString()} ly
              </span>
            )}
          </div>
        )}

        {/* EDSM enrichment for the jump target */}
        {jump && (jump.known_to_edsm != null || jump.traffic) && (
          <div className="mt-1 text-[11px] leading-snug">
            {jump.known_to_edsm === false ? (
              <p className="text-ed-gold">▸ Undiscovered system — not on EDSM</p>
            ) : (
              <p className="text-ed-text/90 truncate">
                {jump.discovered_by && (
                  <>▸ Discovered by <span className="text-ed-gold">{jump.discovered_by}</span> {jump.discovered_date}</>
                )}
                {jump.updated && <span className="text-ed-muted"> ▸ Last updated: {jump.updated}</span>}
              </p>
            )}
            <p className="text-ed-text/90">
              {jump.traffic && (
                <>▸ Traffic 24h: {jump.traffic.day}, week: {jump.traffic.week}, ever: {jump.traffic.total} <span className="text-ed-muted">(EDSM)</span></>
              )}
              {jump.body_count != null && <span className="ml-2">▸ Bodies: {jump.body_count}</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TickBar({ count, current }) {
  // One tick per jump up to 120; longer routes get a smooth bar
  if (count > 120) {
    const pct = (current / (count - 1)) * 100
    return (
      <div className="flex-1 h-2 bg-ed-dark border border-ed-border rounded-sm overflow-hidden">
        <div className="h-full bg-ed-success" style={{ width: `${pct}%` }} />
      </div>
    )
  }
  return (
    <div className="flex-1 flex items-center h-3">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`flex-1 mx-px h-full ${
            i < current ? 'bg-ed-success'
              : i === current ? 'bg-ed-orange'
              : 'bg-ed-border'
          }`}
          style={{ minWidth: 1 }}
        />
      ))}
    </div>
  )
}
