import { useEffect, useState } from 'react'

// NOTE: overlay windows have no pywebview API bridge — all data arrives via
// backend pushes (window.__edtc events): _push_cargo_to_overlay() sends cargo,
// ship_info and the active project when this window opens. Window sizing is
// also backend-driven: emit_to_overlay triggers resize_to_content(), which
// measures the #overlay-panel node below — keep that id on the panel div.
export default function Construction() {
  const [project, setProject] = useState(null)
  const [shipCargo, setShipCargo] = useState({})
  const [shipInfo, setShipInfo] = useState(null)
  const [stationMarket, setStationMarket] = useState(null)
  const [categories, setCategories] = useState({})

  useEffect(() => {
    const off1 = window.__edtc?.on('construction_update', (payload) => {
      setProject(payload ?? null)
    })
    const off2 = window.__edtc?.on('ship_cargo_update', (payload) => {
      setShipCargo(buildCargoMap(payload?.cargo ?? []))
    })
    const off3 = window.__edtc?.on('ship_info', (payload) => {
      if (payload) setShipInfo(payload)
    })
    const off4 = window.__edtc?.on('station_market_update', (payload) => {
      setStationMarket(payload ?? null)
    })
    const off5 = window.__edtc?.on('commodity_categories', (payload) => {
      if (payload) setCategories(payload)
    })
    return () => {
      off1?.(); off2?.(); off3?.(); off4?.(); off5?.()
    }
  }, [])

  const marketMap = buildMarketLookup(stationMarket)

  if (!project) {
    return (
      <div className="w-full flex items-start justify-center pt-3 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[400px]">
          <p className="text-ed-muted text-xs font-mono">No active construction project</p>
        </div>
      </div>
    )
  }

  const reqs = project.requirements ?? []
  // Same order as the in-game station market screen: categories alphabetical,
  // commodities alphabetical within each — so rows line up while buying
  const marketSortKey = r => {
    const cat = categories[normName(r.commodity)] || '￿'
    return `${cat}|${r.commodity}`.toLowerCase()
  }
  const pending = reqs
    .filter(r => (r.delivered ?? 0) < r.required)
    .sort((a, b) => marketSortKey(a).localeCompare(marketSortKey(b)))
  const doneCount = reqs.length - pending.length

  const totalPct = reqs.length > 0
    ? Math.round(reqs.reduce((s, r) => s + Math.min(r.delivered ?? 0, r.required) / r.required, 0) / reqs.length * 100)
    : 0

  const totalRemaining = pending.reduce((s, r) => s + Math.max(0, r.required - (r.delivered ?? 0)), 0)
  const capacity = shipInfo?.cargo_capacity ?? 0
  const trips = capacity && totalRemaining ? Math.ceil(totalRemaining / capacity) : null

  return (
    <div className="w-full flex items-start justify-center pt-3 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border border-ed-orange/40 rounded-lg px-4 py-3 shadow-2xl min-w-[400px]">

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
                const buyHere = !!marketMap[normName(r.commodity)]
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className={`flex-1 truncate ${buyHere ? 'text-blue-400 font-semibold' : 'text-ed-text'}`}>
                        {r.commodity}
                      </span>
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

// Market names arrive as symbols ('ceramiccomposites') and/or display names —
// normalize both to bare alphanumerics so either form matches the project's
const normName = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function buildMarketLookup(stationMarket) {
  const map = {}
  for (const c of (stationMarket?.commodities ?? [])) {
    map[normName(c.name)] = true
    if (c.display) map[normName(c.display)] = true
  }
  return map
}
