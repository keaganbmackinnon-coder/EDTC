import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

function parseRoute(text) {
  return text
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

export default function Navigation() {
  const [routeText, setRouteText] = useState('')
  const [routeName, setRouteName] = useState('')
  const [routes, setRoutes] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeRoute, setActiveRoute] = useState(null)

  useEffect(() => {
    api()?.get_routes().then(r => setRoutes(r ?? []))
    api()?.get_active_route().then(r => {
      setActiveRoute(r)
      if (r) setActiveId(r.id)
    })
  }, [])

  async function saveRoute() {
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
      <p className="text-ed-muted text-sm mb-6">Paste a Spansh route to track jumps with the overlay.</p>

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
          <div className="h-1.5 bg-ed-border rounded-full overflow-hidden">
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
            className="mt-3 text-xs font-mono text-ed-orange border border-ed-orange/40 rounded px-3 py-1 hover:bg-ed-orange/10 transition-colors"
          >
            Copy next destination  (Ctrl+Shift+C)
          </button>
        </div>
      )}

      {/* Paste new route */}
      <div className="panel mb-6">
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
          rows={5}
          className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono resize-none focus:outline-none focus:border-ed-orange/60"
        />
        {preview.length > 0 && (
          <p className="text-ed-muted text-xs font-mono mt-1">{preview.length} systems detected</p>
        )}
        <button
          onClick={saveRoute}
          disabled={saving || preview.length === 0}
          className="mt-3 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Route'}
        </button>
      </div>

      {/* Saved routes */}
      {routes.length > 0 && (
        <div>
          <h2 className="text-ed-text font-semibold mb-3">Saved Routes</h2>
          <div className="space-y-2">
            {routes.map(route => (
              <div
                key={route.id}
                className={`panel flex items-center gap-4 ${activeId === route.id ? 'border-ed-orange/50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-ed-text text-sm font-semibold">{route.name}</span>
                    {activeId === route.id && (
                      <span className="text-[10px] font-mono bg-ed-orange/20 text-ed-orange px-1.5 py-0.5 rounded">
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
        </div>
      )}
    </div>
  )
}
