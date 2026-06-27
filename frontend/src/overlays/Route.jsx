import { useEffect, useState } from 'react'

const api = () => window?.pywebview?.api

export default function RouteOverlay() {
  const [state, setState] = useState(null)

  useEffect(() => {
    api()?.get_active_route().then(r => {
      if (r) setState({ route: r, current_system: '' })
    })

    const off = window.__edtc.on('route_update', (payload) => {
      setState(payload)
    })
    return off
  }, [])

  if (!state?.route) {
    return (
      <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
        <div className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[300px]">
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

  function copyNext() {
    api()?.copy_next_destination()
  }

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-orange/50 rounded-lg px-4 py-3 shadow-2xl min-w-[310px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Route</span>
          <span className="text-ed-muted text-xs font-mono">{current + 1} / {systems.length}</span>
        </div>

        <div className="space-y-1.5">
          <div>
            <p className="text-[10px] text-ed-muted font-mono uppercase">Current</p>
            <p className="text-ed-text font-mono text-sm leading-tight">
              {systems[current] ?? current_system ?? '—'}
            </p>
          </div>

          {next && (
            <div>
              <p className="text-[10px] text-ed-muted font-mono uppercase">Next jump</p>
              <p className="text-ed-orange font-mono text-sm font-bold leading-tight">{next}</p>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-ed-border flex items-center justify-between">
          <span className="text-ed-muted text-xs font-mono">
            {remaining} {remaining === 1 ? 'jump' : 'jumps'} remaining
          </span>
          {next && (
            <button
              onClick={copyNext}
              className="text-[10px] font-mono text-ed-orange border border-ed-orange/40 rounded px-2 py-0.5 hover:bg-ed-orange/10 transition-colors"
            >
              Copy  Ctrl+Shift+C
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-ed-border rounded-full overflow-hidden">
          <div
            className="h-full bg-ed-orange rounded-full transition-all duration-500"
            style={{ width: `${systems.length > 1 ? (current / (systems.length - 1)) * 100 : 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
