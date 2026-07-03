import { useEffect, useState } from 'react'

const SCOOPABLE = new Set(['K', 'G', 'B', 'F', 'O', 'A', 'M'])

// NOTE: overlay windows have no pywebview API bridge — all data arrives via
// backend pushes (window.__edtc events). The active route is pushed by
// _push_route_to_overlay() when this window opens; nothing to fetch on mount.
export default function RouteOverlay() {
  const [state, setState] = useState(null)
  const [fsd, setFsd] = useState(null)

  useEffect(() => {
    const off = window.__edtc?.on('route_update', (payload) => {
      setState(payload)
      setFsd(null)  // stale target info from the previous route
    })
    const offFsd = window.__edtc?.on('fsd_target', (payload) => {
      setFsd(payload)
    })
    return () => { off?.(); offFsd?.() }
  }, [])

  if (!state?.route) {
    return (
      <div className="w-full flex items-start justify-center pt-3 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-2 shadow-2xl w-[648px]">
          <p className="text-ed-muted text-xs font-mono">No active route</p>
        </div>
      </div>
    )
  }

  const { route, current_system } = state
  const systems = route.systems ?? []
  const current = route.current ?? 0
  const remaining = systems.length - current - 1
  const next = systems[current + 1] ?? null
  const dest = systems[systems.length - 1] ?? ''

  // Star class of the next jump: live FSDTarget beats the plotted route's data
  const nextClass = fsd?.star_class || route.star_classes?.[current + 1] || ''
  const scoopable = nextClass ? SCOOPABLE.has(nextClass.toUpperCase()) : null

  return (
    <div className="w-full flex items-start justify-center pt-3 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-orange/50 rounded-lg px-4 py-2 shadow-2xl w-[648px]">
        {/* Single wide row: counter · current → next (+class) · remaining + hotkey hint */}
        <div className="flex items-baseline gap-3 font-mono whitespace-nowrap">
          <span className="text-ed-muted text-[10px] uppercase tracking-widest shrink-0">
            Route {current + 1}/{systems.length}
          </span>
          <span className="text-ed-text text-sm truncate min-w-0" title="Current system">
            {systems[current] ?? current_system ?? '—'}
          </span>
          {next && (
            <>
              <span className="text-ed-muted text-sm shrink-0">→</span>
              <span className="text-ed-orange text-sm font-bold truncate min-w-0" title="Next jump">
                {next}
              </span>
              {nextClass && (
                <span className={`text-[10px] shrink-0 ${
                  scoopable ? 'text-ed-muted' : 'text-amber-400 font-bold'
                }`}>
                  {nextClass.toUpperCase()}{scoopable ? ' · scoopable' : ' · NOT SCOOPABLE'}
                </span>
              )}
            </>
          )}
          {/* No API bridge in overlay windows — the copy runs via the global
              Ctrl+Shift+C hotkey (works even while the game has focus) */}
          <span className="text-ed-muted text-[10px] shrink-0 ml-auto">
            {remaining} {remaining === 1 ? 'jump' : 'jumps'} left
            {next && <span className="text-ed-orange/70"> · Ctrl+Shift+C copies next</span>}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1 bg-ed-border rounded-full overflow-hidden">
          <div
            className="h-full bg-ed-orange rounded-full transition-all duration-500"
            style={{ width: `${systems.length > 1 ? (current / (systems.length - 1)) * 100 : 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
