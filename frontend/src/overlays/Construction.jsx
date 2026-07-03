import { useEffect, useLayoutEffect, useState, useRef } from 'react'

const api = () => window?.pywebview?.api

export default function Construction() {
  const [project, setProject] = useState(null)
  const [shipCargo, setShipCargo] = useState({})
  const [shipInfo, setShipInfo] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    // window.pywebview.api isn't guaranteed to exist yet on mount — a fresh
    // overlay window is a cold WebView2 start, so this race loses often enough
    // to matter. Wait for pywebviewready like App.jsx does.
    function loadInitial() {
      api()?.get_construction_projects?.(true)?.then(projects => {
        if (projects?.length > 0) setProject(projects[0])
      })
      api()?.get_ship_cargo?.()?.then(cargo => {
        if (cargo) setShipCargo(buildCargoMap(cargo))
      })
    }
    if (window.pywebview?.api) {
      loadInitial()
    } else {
      window.addEventListener('pywebviewready', loadInitial)
    }

    const off1 = window.__edtc?.on('construction_update', (payload) => {
      setProject(payload ?? null)
    })
    const off2 = window.__edtc?.on('ship_cargo_update', (payload) => {
      setShipCargo(buildCargoMap(payload?.cargo ?? []))
    })
    const off3 = window.__edtc?.on('ship_info', (payload) => {
      if (payload) setShipInfo(payload)
    })
    return () => {
      window.removeEventListener('pywebviewready', loadInitial)
      off1?.(); off2?.(); off3?.()
    }
  }, [])

  // Resize the pywebview window to fit content. A plain post-render measurement
  // can miss changes (e.g. commodity rows added/removed after the initial project
  // load), so use a ResizeObserver tied to the actual DOM node instead — it fires
  // on every real layout change regardless of why the content changed.
  useLayoutEffect(() => {
    if (!panelRef.current) return
    const el = panelRef.current
    const applySize = (h) => {
      if (h < 20) return  // guard against zero-height on first paint
      api()?.resize_overlay?.('construction', 460, Math.ceil(h) + 24)
    }
    applySize(el.offsetHeight)
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) applySize(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [project, shipCargo])

  if (!project) {
    return (
      <div className="w-full flex items-start justify-center pt-3 select-none">
        <div ref={panelRef} id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[400px]">
          <p className="text-ed-muted text-xs font-mono">No active construction project</p>
        </div>
      </div>
    )
  }

  const reqs = project.requirements ?? []
  const pending = reqs.filter(r => (r.delivered ?? 0) < r.required)
  const doneCount = reqs.length - pending.length

  const totalPct = reqs.length > 0
    ? Math.round(reqs.reduce((s, r) => s + Math.min(r.delivered ?? 0, r.required) / r.required, 0) / reqs.length * 100)
    : 0

  const totalRemaining = pending.reduce((s, r) => s + Math.max(0, r.required - (r.delivered ?? 0)), 0)
  const capacity = shipInfo?.cargo_capacity ?? 0
  const trips = capacity && totalRemaining ? Math.ceil(totalRemaining / capacity) : null

  return (
    <div className="w-full flex items-start justify-center pt-3 select-none">
      <div ref={panelRef} id="overlay-panel" className="bg-ed-panel/95 border border-ed-orange/40 rounded-lg px-4 py-3 shadow-2xl min-w-[400px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Construction</span>
          <span className="text-ed-orange text-xs font-mono">{totalPct}%</span>
        </div>
        <p className="text-ed-text font-mono text-sm font-semibold mb-0.5">{project.name}</p>
        {project.system && (
          <p className="text-ed-muted text-[10px] font-mono mb-2">{project.system}</p>
        )}

        {/* Overall progress bar */}
        <div className="h-1 bg-ed-border rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full bg-ed-orange rounded-full transition-all duration-500"
            style={{ width: `${totalPct}%` }}
          />
        </div>

        {totalRemaining > 0 && (
          <div className="flex items-center justify-between text-[10px] font-mono text-ed-muted mb-2">
            <span>{totalRemaining.toLocaleString()}T remaining</span>
            {trips != null && (
              <span>
                ~<span className="text-ed-orange font-semibold">{trips}</span>{' '}
                {trips === 1 ? 'trip' : 'trips'} · {capacity}T hold
              </span>
            )}
          </div>
        )}

        {pending.length === 0 ? (
          <p className="text-ed-success text-xs font-mono text-center py-1">
            All commodities delivered!
          </p>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-ed-muted/60 uppercase tracking-wider mb-1 px-0.5">
              <span className="flex-1">Commodity</span>
              <span className="w-24 text-right">Delivered</span>
              <span className="w-14 text-right">Remaining</span>
            </div>

            <div className="space-y-1.5">
              {pending.map((r, i) => {
                const delivered = r.delivered ?? 0
                const remaining = Math.max(0, r.required - delivered)
                const onShip = Math.min(shipCargo[r.commodity.toLowerCase()] ?? 0, remaining)
                const deliveredPct = Math.min(100, Math.round((delivered / r.required) * 100))
                const onShipPct = Math.min(100 - deliveredPct, Math.round((onShip / r.required) * 100))
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="flex-1 truncate text-ed-text">{r.commodity}</span>
                      <span className="w-24 text-right shrink-0 text-ed-muted">
                        {delivered.toLocaleString()}
                        {onShip > 0 && (
                          <span className="text-yellow-400"> +{onShip.toLocaleString()}</span>
                        )}
                      </span>
                      <span className="w-14 text-right shrink-0 font-semibold text-ed-orange">
                        {remaining.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-0.5 bg-ed-border rounded-full overflow-hidden mt-0.5 flex">
                      <div
                        className="h-full bg-ed-success transition-all duration-300"
                        style={{ width: `${deliveredPct}%` }}
                      />
                      {onShipPct > 0 && (
                        <div
                          className="h-full bg-yellow-400 transition-all duration-300"
                          style={{ width: `${onShipPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {doneCount > 0 && (
              <p className="text-ed-success text-[10px] font-mono mt-2 text-right">
                {doneCount === 1 ? '1 commodity complete' : `${doneCount} commodities complete`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function buildCargoMap(inventory) {
  const map = {}
  for (const c of inventory) {
    const name = (c.Name_Localised || c.Name || '').toLowerCase()
    if (name) map[name] = (map[name] ?? 0) + (c.Count ?? 0)
  }
  return map
}
