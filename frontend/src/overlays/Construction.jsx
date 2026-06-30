import { useEffect, useState } from 'react'

const api = () => window?.pywebview?.api

export default function Construction() {
  const [project, setProject] = useState(null)
  const [shipCargo, setShipCargo] = useState({})

  useEffect(() => {
    api()?.get_construction_projects(true).then(projects => {
      if (projects?.length > 0) setProject(projects[0])
    })
    api()?.get_ship_cargo().then(cargo => {
      if (cargo) setShipCargo(buildCargoMap(cargo))
    })

    const off1 = window.__edtc?.on('construction_update', (payload) => {
      setProject(payload ?? null)
    })
    const off2 = window.__edtc?.on('ship_cargo_update', (payload) => {
      setShipCargo(buildCargoMap(payload?.cargo ?? []))
    })
    return () => { off1?.(); off2?.() }
  }, [])

  if (!project) {
    return (
      <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
        <div className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[320px]">
          <p className="text-ed-muted text-xs font-mono">No active construction project</p>
        </div>
      </div>
    )
  }

  const reqs = project.requirements ?? []
  const totalPct = reqs.length > 0
    ? Math.round(reqs.reduce((s, r) => s + Math.min(r.delivered ?? 0, r.required) / r.required, 0) / reqs.length * 100)
    : 0

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-orange/40 rounded-lg px-4 py-3 shadow-2xl min-w-[400px]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">Construction</span>
          <span className="text-ed-orange text-xs font-mono">{totalPct}%</span>
        </div>
        <p className="text-ed-text font-mono text-sm font-semibold mb-0.5">{project.name}</p>
        {project.system && (
          <p className="text-ed-muted text-[10px] font-mono mb-2">{project.system}</p>
        )}

        {/* Overall progress bar */}
        <div className="h-1 bg-ed-border rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-ed-orange rounded-full transition-all duration-500"
            style={{ width: `${totalPct}%` }}
          />
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 text-[9px] font-mono text-ed-muted/60 uppercase tracking-wider mb-1 px-0.5">
          <span className="flex-1">Commodity</span>
          <span className="w-24 text-right">Delivered</span>
          <span className="w-14 text-right">Remaining</span>
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {reqs.map((r, i) => {
            const delivered = r.delivered ?? 0
            const remaining = Math.max(0, r.required - delivered)
            const onShip = Math.min(shipCargo[r.commodity.toLowerCase()] ?? 0, remaining)
            const deliveredPct = Math.min(100, Math.round((delivered / r.required) * 100))
            const onShipPct = Math.min(100 - deliveredPct, Math.round((onShip / r.required) * 100))
            const done = delivered >= r.required
            return (
              <div key={i}>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className={`flex-1 truncate ${done ? 'text-ed-success' : 'text-ed-text'}`}>
                    {r.commodity}
                  </span>
                  <span className={`w-24 text-right shrink-0 ${done ? 'text-ed-success' : 'text-ed-muted'}`}>
                    {delivered.toLocaleString()}
                    {onShip > 0 && !done && (
                      <span className="text-yellow-400"> +{onShip.toLocaleString()}</span>
                    )}
                  </span>
                  <span className={`w-14 text-right shrink-0 font-semibold ${done ? 'text-ed-success' : 'text-ed-orange'}`}>
                    {done ? 'DONE' : remaining.toLocaleString()}
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
