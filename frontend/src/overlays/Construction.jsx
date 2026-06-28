import { useEffect, useState } from 'react'

const api = () => window?.pywebview?.api

export default function Construction() {
  const [project, setProject] = useState(null)

  useEffect(() => {
    api()?.get_construction_projects(true).then(projects => {
      if (projects?.length > 0) setProject(projects[0])
    })

    const off = window.__edtc?.on('construction_update', (payload) => {
      setProject(payload)
    })
    return off
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
      <div className="bg-ed-panel/95 border border-ed-orange/40 rounded-lg px-4 py-3 shadow-2xl min-w-[330px]">
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

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {reqs.map((r, i) => {
            const delivered = r.delivered ?? 0
            const pct = Math.min(Math.round((delivered / r.required) * 100), 100)
            const done = delivered >= r.required
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className={done ? 'text-ed-success' : 'text-ed-text'}>
                    {r.commodity}
                  </span>
                  <span className={done ? 'text-ed-success' : 'text-ed-muted'}>
                    {delivered.toLocaleString()} / {r.required.toLocaleString()}
                  </span>
                </div>
                <div className="h-0.5 bg-ed-border rounded-full overflow-hidden mt-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-ed-success' : 'bg-ed-orange/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
