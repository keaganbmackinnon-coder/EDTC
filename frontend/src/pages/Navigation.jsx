import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

function parseRoute(text) {
  return text
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

export default function Navigation() {
  const [tab, setTab] = useState('planner')

  // Ship info
  const [shipInfo, setShipInfo] = useState(null)

  // Planner state
  const [fromSystem, setFromSystem] = useState('')
  const [toSystem, setToSystem] = useState('')
  const [jumpRange, setJumpRange] = useState('')
  const [efficiency, setEfficiency] = useState(60)
  // 'exact' = Spansh Galaxy Plotter (every jump, uses live ship loadout);
  // 'neutron' = neutron plotter (waypoints are boost stops only)
  const [plotMode, setPlotMode] = useState('exact')
  const [planning, setPlanning] = useState(false)
  const [planResult, setPlanResult] = useState(null)
  const [planError, setPlanError] = useState('')

  // Paste route state
  const [routeText, setRouteText] = useState('')
  const [routeName, setRouteName] = useState('')
  const [saving, setSaving] = useState(false)

  // Active route + saved routes
  const [routes, setRoutes] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [activeRoute, setActiveRoute] = useState(null)

  useEffect(() => {
    const a = api()
    if (a) {
      a.get_current_system().then(s => { if (s) setFromSystem(s) }).catch(() => {})
      a.get_ship_info().then(info => {
        if (info && Object.keys(info).length) {
          setShipInfo(info)
          const range = info.current_jump_range ?? info.max_jump_range
          if (range) setJumpRange(range.toFixed(2))
        }
      }).catch(() => {})
      a.get_routes().then(r => setRoutes(r ?? [])).catch(() => {})
      a.get_active_route().then(r => {
        setActiveRoute(r)
        if (r) setActiveId(r.id)
      }).catch(() => {})
    }

    const off1 = window.__edtc?.on('system_changed', payload => {
      setFromSystem(payload?.system ?? payload ?? '')
    })
    const off2 = window.__edtc?.on('ship_changed', payload => {
      setShipInfo(payload)
      const range = payload?.current_jump_range ?? payload?.max_jump_range
      if (range) setJumpRange(range.toFixed(2))
    })
    const off3 = window.__edtc?.on('route_update', payload => {
      setActiveRoute(payload)
      if (payload?.id) setActiveId(payload.id)
    })
    return () => { off1?.(); off2?.(); off3?.() }
  }, [])

  async function planRoute() {
    const range = parseFloat(jumpRange)
    if (!fromSystem || !toSystem) return
    if (plotMode === 'neutron' && !range) return
    setPlanning(true)
    setPlanResult(null)
    setPlanError('')
    const result = plotMode === 'exact'
      ? await api()?.plan_galaxy_route(fromSystem, toSystem)
      : await api()?.plan_neutron_route(fromSystem, toSystem, range, efficiency)
    setPlanning(false)
    if (result?.error) {
      setPlanError(result.error)
    } else {
      setPlanResult(result)
    }
  }

  async function activatePlan() {
    if (!planResult) return
    const systems = planResult.systems.map(s => s.system)
    setSaving(true)
    const route = await api()?.save_route({
      name: `${fromSystem} → ${toSystem}`,
      systems,
      current: 0,
    })
    if (route) {
      setRoutes(prev => [route, ...prev.filter(r => r.id !== route.id)])
      await api()?.set_active_route(route.id)
      setActiveId(route.id)
      const updated = await api()?.get_active_route()
      setActiveRoute(updated)
    }
    setSaving(false)
  }

  async function saveManualRoute() {
    const systems = parseRoute(routeText)
    if (!systems.length) return
    setSaving(true)
    const route = await api()?.save_route({
      name: routeName || `Route ${new Date().toLocaleDateString()}`,
      systems,
      current: 0,
    })
    if (route) {
      setRoutes(prev => [route, ...prev.filter(r => r.id !== route.id)])
      setRouteText('')
      setRouteName('')
    }
    setSaving(false)
  }

  async function activateRoute(route) {
    await api()?.set_active_route(route.id)
    setActiveId(route.id)
    const updated = await api()?.get_active_route()
    setActiveRoute(updated)
  }

  async function copyNext() {
    await api()?.copy_next_destination()
  }

  const preview = parseRoute(routeText)

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Navigation & Routing</h1>
      <p className="text-ed-muted text-sm mb-6">Plan routes and track jumps with the overlay.</p>

      {/* Active route status */}
      {activeRoute && (
        <div className="panel border-ed-orange/40 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ed-orange text-sm font-semibold">{activeRoute.name}</span>
            <span className="text-ed-muted text-xs font-mono">
              {activeRoute.current + 1} / {activeRoute.systems?.length ?? 0}
            </span>
          </div>
          <div className="text-xs font-mono text-ed-muted mb-2">
            Next: <span className="text-ed-text">
              {activeRoute.systems?.[activeRoute.current + 1] ?? 'Destination reached'}
            </span>
          </div>
          <div className="h-1.5 bg-ed-border rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-ed-orange rounded-full transition-all"
              style={{
                width: `${activeRoute.systems?.length > 1
                  ? (activeRoute.current / (activeRoute.systems.length - 1)) * 100
                  : 100}%`,
              }}
            />
          </div>
          <button
            onClick={copyNext}
            className="text-xs font-mono text-ed-orange border border-ed-orange/40 rounded px-3 py-1 hover:bg-ed-orange/10 transition-colors"
          >
            Copy next destination  (Ctrl+Shift+C)
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ed-border pb-1">
        {[['planner', 'Route Planner'], ['paste', 'Paste Route'], ['saved', `Saved (${routes.length})`]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 text-sm font-ui rounded-t transition-colors ${
              tab === id ? 'text-ed-orange border-b-2 border-ed-orange' : 'text-ed-muted hover:text-ed-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Route Planner tab */}
      {tab === 'planner' && (
        <div>
          {/* Ship info card */}
          {shipInfo?.ship && (
            <div className="panel mb-4 flex items-center gap-4 border-ed-orange/20">
              <div className="text-ed-orange text-xl">🚀</div>
              <div className="flex-1">
                <div className="text-ed-text text-sm font-semibold">
                  {shipInfo.ship_name ? `${shipInfo.ship_name} ` : ''}<span className="text-ed-muted font-normal">{shipInfo.ship}</span>
                  {shipInfo.ship_ident && <span className="text-ed-muted text-xs font-mono ml-2">[{shipInfo.ship_ident}]</span>}
                </div>
                <div className="flex gap-4 mt-0.5 flex-wrap">
                  {shipInfo.current_jump_range != null ? (
                    <span className="text-xs font-mono text-ed-muted">
                      Current jump <span className="text-ed-orange font-semibold">{shipInfo.current_jump_range.toFixed(2)} ly</span>
                      {shipInfo.max_jump_range != null && (
                        <span className="text-ed-muted/60 ml-1">(max {shipInfo.max_jump_range.toFixed(2)} ly)</span>
                      )}
                    </span>
                  ) : shipInfo.max_jump_range != null && (
                    <span className="text-xs font-mono text-ed-muted">Max jump <span className="text-ed-orange">{shipInfo.max_jump_range.toFixed(2)} ly</span></span>
                  )}
                  {shipInfo.fuel_main != null && (
                    <span className="text-xs font-mono text-ed-muted">Fuel <span className="text-ed-text">{shipInfo.fuel_main}T</span>{shipInfo.fuel_capacity != null && <span className="text-ed-muted/60">/{shipInfo.fuel_capacity}T</span>}</span>
                  )}
                  {shipInfo.cargo != null && shipInfo.cargo > 0 && (
                    <span className="text-xs font-mono text-ed-muted">Cargo <span className="text-ed-text">{shipInfo.cargo}T</span></span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="panel mb-4">
            <div className="flex gap-2 mb-4">
              {[
                ['exact', 'Every Jump', 'Full jump-by-jump route from your live ship loadout'],
                ['neutron', 'Neutron Waypoints', 'Boost stops only — plot each leg in the galaxy map'],
              ].map(([val, label, hint]) => (
                <button
                  key={val}
                  onClick={() => setPlotMode(val)}
                  title={hint}
                  className={`flex-1 text-xs font-mono border rounded px-2 py-1.5 transition-colors ${
                    plotMode === val
                      ? 'border-ed-orange text-ed-orange bg-ed-orange/10'
                      : 'border-ed-border text-ed-muted hover:text-ed-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {plotMode === 'exact' && (
              <p className="text-ed-muted text-xs font-mono mb-3">
                Plots every jump using your live ship loadout (range, fuel, tank) — includes neutron boosts when they help.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-ed-muted font-ui mb-1 block">From</label>
                <input
                  value={fromSystem}
                  onChange={e => setFromSystem(e.target.value)}
                  placeholder="Current system"
                  className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
                />
              </div>
              <div>
                <label className="text-xs text-ed-muted font-ui mb-1 block">To</label>
                <input
                  value={toSystem}
                  onChange={e => setToSystem(e.target.value)}
                  placeholder="Destination system"
                  className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
                />
              </div>
            </div>
            <div className={`grid grid-cols-2 gap-3 mb-4 ${plotMode === 'exact' ? 'hidden' : ''}`}>
              <div>
                <label className="text-xs text-ed-muted font-ui mb-1 block">
                  Jump range (ly)
                  {(shipInfo?.current_jump_range || shipInfo?.max_jump_range) && <span className="ml-1 text-ed-orange/60">· auto-filled from game</span>}
                </label>
                <input
                  type="number"
                  value={jumpRange}
                  onChange={e => setJumpRange(e.target.value)}
                  placeholder="e.g. 56.4"
                  min="1"
                  max="500"
                  step="0.1"
                  className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
                />
              </div>
              <div>
                <label className="text-xs text-ed-muted font-ui mb-1 block">Efficiency</label>
                <div className="flex gap-2 mt-1">
                  {[
                    [60, 'Balanced'],
                    [80, 'Fast'],
                    [100, 'Maximum'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setEfficiency(val)}
                      className={`flex-1 text-xs font-mono border rounded px-2 py-1.5 transition-colors ${
                        efficiency === val
                          ? 'border-ed-orange text-ed-orange bg-ed-orange/10'
                          : 'border-ed-border text-ed-muted hover:text-ed-text'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={planRoute}
              disabled={planning || !fromSystem || !toSystem || (plotMode === 'neutron' && !jumpRange)}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {planning ? 'Planning route… (this can take 10–30s)' : 'Plan Route'}
            </button>
            {planError && (
              <p className="text-red-400 text-xs font-mono mt-2">{planError}</p>
            )}
          </div>

          {/* Route result */}
          {planResult && (
            <div className="panel">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-ed-text font-semibold text-sm">
                    {planResult.systems.length} {planResult.systems.some(s => s.scoopable != null) ? 'systems' : 'waypoints'}
                  </span>
                  <span className="text-ed-muted text-xs font-mono ml-3">{planResult.total_jumps} jumps · {planResult.total_distance.toLocaleString()} ly</span>
                </div>
                <button
                  onClick={activatePlan}
                  disabled={saving}
                  className="btn-primary text-xs disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save & Activate'}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {planResult.systems.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-1 border-b border-ed-border/40 last:border-0">
                    <span className="text-ed-muted text-xs font-mono w-6 text-right shrink-0">{i + 1}</span>
                    {s.neutron_star && (
                      <span className="text-yellow-400 text-xs shrink-0" title="Neutron star boost">⚡</span>
                    )}
                    {s.scoopable && !s.neutron_star && (
                      <span className="text-ed-orange/70 text-xs shrink-0" title="Scoopable star">☀</span>
                    )}
                    <span className={`text-sm font-mono flex-1 ${s.neutron_star ? 'text-yellow-300' : 'text-ed-text'}`}>
                      {s.system}
                    </span>
                    {s.must_refuel && (
                      <span className="text-amber-400 text-xs font-mono shrink-0" title="Scoop fuel here or you won't make the next jumps">⛽ REFUEL</span>
                    )}
                    <span className="text-ed-muted text-xs font-mono shrink-0">{s.distance_jumped} ly</span>
                    <span className="text-ed-muted text-xs font-mono shrink-0 w-20 text-right">{s.distance_remaining.toLocaleString()} ly left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paste Route tab */}
      {tab === 'paste' && (
        <div className="panel">
          <h2 className="text-ed-text font-semibold mb-3">Paste Spansh Route</h2>
          <input
            type="text"
            placeholder="Route name (optional)"
            value={routeName}
            onChange={e => setRouteName(e.target.value)}
            className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono mb-2 focus:outline-none focus:border-ed-orange/60"
          />
          <textarea
            placeholder="Paste system names here — one per line or comma-separated"
            value={routeText}
            onChange={e => setRouteText(e.target.value)}
            rows={6}
            className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono resize-none focus:outline-none focus:border-ed-orange/60"
          />
          {preview.length > 0 && (
            <p className="text-ed-muted text-xs font-mono mt-1">{preview.length} systems detected</p>
          )}
          <button
            onClick={saveManualRoute}
            disabled={saving || preview.length === 0}
            className="mt-3 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Route'}
          </button>
        </div>
      )}

      {/* Saved routes tab */}
      {tab === 'saved' && (
        <div>
          {routes.length === 0 ? (
            <p className="text-ed-muted text-sm">No saved routes.</p>
          ) : (
            <div className="space-y-2">
              {routes.map(route => (
                <div
                  key={route.id}
                  className={`panel flex items-center gap-4 ${activeId === route.id ? 'border-ed-orange/50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-ed-text text-sm font-semibold truncate">{route.name}</span>
                      {activeId === route.id && (
                        <span className="text-[10px] font-mono bg-ed-orange/20 text-ed-orange px-1.5 py-0.5 rounded shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-ed-muted text-xs font-mono">
                      {route.systems?.length ?? 0} systems
                      {activeId === route.id && ` · jump ${(route.current ?? 0) + 1}`}
                    </p>
                  </div>
                  <button
                    onClick={() => activateRoute(route)}
                    disabled={activeId === route.id}
                    className="btn-ghost shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {activeId === route.id ? 'Active' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
