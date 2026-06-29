import { useState, useEffect, useCallback } from 'react'

const api = () => window?.pywebview?.api

// ---- Helpers ----

function fmtCredits(n) {
  if (n == null || n === 0) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B Cr`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M Cr`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K Cr`
  return `${n} Cr`
}

function fmtDist(d) {
  if (d == null) return '—'
  return `${Math.round(d).toLocaleString()} ls`
}

function fmtLy(d) {
  if (d == null) return '—'
  return `${Number(d).toFixed(1)} ly`
}

function fmtPop(n) {
  if (!n) return 'Uninhabited'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function Tag({ label, color = 'border-ed-border text-ed-muted' }) {
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  )
}

function EmptyState({ message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

// ---- Tab: System Lookup ----

const STAR_COLORS = {
  O: 'text-blue-300', B: 'text-blue-200', A: 'text-white',
  F: 'text-yellow-100', G: 'text-yellow-300', K: 'text-orange-300',
  M: 'text-red-400', L: 'text-red-600', T: 'text-red-800',
  N: 'text-blue-400', D: 'text-gray-300',
}

function BodyTypeIcon({ type, subType }) {
  if (type === 'Star') return '★'
  if (subType?.includes('Earthlike')) return '🌍'
  if (subType?.includes('Ammonia')) return '⚗'
  if (subType?.includes('Water world')) return '💧'
  if (subType?.includes('gas giant')) return '🪐'
  return '●'
}

function SystemLookupTab({ currentSystem }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [expandBodies, setExpandBodies] = useState(false)

  async function doLookup(name) {
    const n = (name ?? query).trim()
    if (!n) return
    setLoading(true)
    setResult(null)
    setExpandBodies(false)
    const r = await api()?.lookup_system(n)
    setResult(r ?? { error: 'No response' })
    setLoading(false)
  }

  function useCurrentSystem() {
    const sys = currentSystem
    if (sys) {
      setQuery(sys)
      doLookup(sys)
    }
  }

  const sys = result?.system
  const bodies = result?.bodies ?? []
  const stars = bodies.filter(b => b.type === 'Star')
  const planets = bodies.filter(b => b.type !== 'Star')

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1"
          placeholder="System name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLookup()}
        />
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={() => doLookup()}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Looking up…' : 'Search'}
        </button>
        {currentSystem && (
          <button className="btn-ghost text-sm" onClick={useCurrentSystem}>
            Current System
          </button>
        )}
      </div>

      {result?.error && (
        <div className="panel border border-ed-danger/30">
          <p className="text-ed-danger text-sm font-mono">{result.error}</p>
        </div>
      )}

      {sys && (
        <div className="space-y-3">
          {/* System info card */}
          <div className="panel">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-ed-orange font-semibold font-ui text-xl">{sys.name}</p>
                {sys.coords && (
                  <p className="text-ed-muted text-xs font-mono mt-0.5">
                    {sys.coords.x?.toFixed(2)}, {sys.coords.y?.toFixed(2)}, {sys.coords.z?.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {stars.map(s => (
                  <span
                    key={s.name}
                    className={`text-sm font-mono ${STAR_COLORS[s.spectral_class?.[0]] ?? 'text-ed-text'}`}
                  >
                    {s.spectral_class ?? s.sub_type ?? 'Star'}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Allegiance', val: sys.allegiance },
                { label: 'Government', val: sys.government },
                { label: 'Economy',    val: sys.economy },
                { label: 'Security',   val: sys.security },
                { label: 'Population', val: fmtPop(sys.population) },
              ].filter(x => x.val).map(({ label, val }) => (
                <div key={label}>
                  <p className="text-ed-muted text-xs font-mono">{label}</p>
                  <p className="text-ed-text">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bodies */}
          {bodies.length > 0 && (
            <div className="panel">
              <button
                className="w-full flex items-center justify-between mb-2"
                onClick={() => setExpandBodies(e => !e)}
              >
                <p className="text-ed-text font-semibold font-ui text-sm">
                  Bodies <span className="text-ed-muted font-normal">({bodies.length})</span>
                </p>
                <span className="text-ed-muted text-xs">{expandBodies ? '▲' : '▼'}</span>
              </button>

              {expandBodies && (
                <div className="space-y-1 mt-2 border-t border-ed-border pt-2">
                  {bodies.map(b => (
                    <div key={b.name} className="flex items-center gap-3 text-xs font-mono py-0.5">
                      <span className="text-ed-muted w-4 text-center shrink-0">
                        <BodyTypeIcon type={b.type} subType={b.sub_type} />
                      </span>
                      <span className="text-ed-text flex-1 truncate">{b.name}</span>
                      <span className="text-ed-muted shrink-0">{b.sub_type ?? b.type}</span>
                      {b.distance && (
                        <span className="text-ed-muted shrink-0">{fmtDist(b.distance)}</span>
                      )}
                      {b.earth_masses && (
                        <span className="text-ed-muted shrink-0">{b.earth_masses?.toFixed(2)} EM</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!expandBodies && (
                <div className="flex flex-wrap gap-1.5">
                  {planets.slice(0, 8).map(b => (
                    <Tag key={b.name} label={b.sub_type ?? b.type} />
                  ))}
                  {planets.length > 8 && (
                    <span className="text-ed-muted text-xs font-mono">+{planets.length - 8} more</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState message="Enter a system name and press Search, or click 'Current System'." />
      )}
    </div>
  )
}

// ---- Tab: Road to Riches ----

const HIGH_VALUE = 500_000
const ELITE_VALUE = 1_000_000

function R2RTab({ currentSystem }) {
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [range, setRange] = useState('30')
  const [maxSys, setMaxSys] = useState('50')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (currentSystem && !origin) setOrigin(currentSystem)
  }, [currentSystem])

  async function doRoute() {
    const r = parseFloat(range)
    if (!origin.trim() || !dest.trim() || isNaN(r) || r <= 0) return
    setLoading(true)
    setResult(null)
    setExpanded(null)
    const res = await api()?.road_to_riches(origin.trim(), dest.trim(), r, parseInt(maxSys, 10) || 50)
    setResult(res ?? { error: 'No response' })
    setLoading(false)
  }

  const systems = result?.systems ?? []
  const totalValue = systems.reduce((sum, s) => {
    return sum + (s.bodies ?? []).reduce((bs, b) => bs + (b.valueMapped ?? b.value ?? 0), 0)
  }, 0)

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Find systems with valuable bodies between two points. Values are pre-mapped estimates.
      </p>

      <div className="panel mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Origin</label>
            <input
              className="input font-mono text-sm w-full"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="Sol"
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Destination</label>
            <input
              className="input font-mono text-sm w-full"
              value={dest}
              onChange={e => setDest(e.target.value)}
              placeholder="Colonia"
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Jump Range (ly)</label>
            <input
              className="input font-mono text-sm w-full"
              type="number"
              min="5"
              max="100"
              value={range}
              onChange={e => setRange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Max Systems</label>
            <input
              className="input font-mono text-sm w-full"
              type="number"
              min="10"
              max="200"
              value={maxSys}
              onChange={e => setMaxSys(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={doRoute}
          disabled={loading || !origin.trim() || !dest.trim()}
        >
          {loading ? 'Plotting route (may take ~30s)…' : 'Plot Route'}
        </button>
      </div>

      {result?.error && (
        <div className="panel border border-ed-danger/30 mb-3">
          <p className="text-ed-danger text-sm font-mono">{result.error}</p>
        </div>
      )}

      {systems.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-ed-muted text-sm font-mono">{systems.length} systems</p>
            <p className="text-ed-gold font-mono font-semibold">
              Total: {fmtCredits(totalValue)} mapped
            </p>
          </div>

          <div className="space-y-1">
            {systems.map((s, i) => {
              const sysName = s.system ?? s.name ?? `System ${i + 1}`
              const bodies = s.bodies ?? []
              const sysValue = bodies.reduce((sum, b) => sum + (b.valueMapped ?? b.value ?? 0), 0)
              const isOpen = expanded === i

              return (
                <div key={i} className="panel">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-ed-muted font-mono text-xs w-6 shrink-0">{i + 1}</span>
                      <span className="text-ed-text font-ui font-semibold truncate">{sysName}</span>
                      {s.distance_to_destination != null && (
                        <span className="text-ed-muted text-xs font-mono shrink-0">
                          {fmtLy(s.distance_to_destination)} remaining
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono text-sm font-semibold ${sysValue >= ELITE_VALUE ? 'text-ed-gold' : sysValue >= HIGH_VALUE ? 'text-ed-orange' : 'text-ed-text'}`}>
                        {fmtCredits(sysValue)}
                      </span>
                      <span className="text-ed-muted text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isOpen && bodies.length > 0 && (
                    <div className="mt-3 border-t border-ed-border pt-3 space-y-1">
                      {bodies.map((b, j) => {
                        const bVal = b.valueMapped ?? b.value ?? 0
                        return (
                          <div key={j} className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-ed-muted w-4 text-center shrink-0">●</span>
                            <span className="text-ed-text flex-1 truncate">{b.name ?? b.bodyName}</span>
                            <span className="text-ed-muted shrink-0">{b.subType ?? b.type ?? ''}</span>
                            {b.distanceToArrival != null && (
                              <span className="text-ed-muted shrink-0">{fmtDist(b.distanceToArrival)}</span>
                            )}
                            <span className={`shrink-0 font-semibold ${bVal >= ELITE_VALUE ? 'text-ed-gold' : bVal >= HIGH_VALUE ? 'text-ed-orange' : 'text-ed-text'}`}>
                              {fmtCredits(bVal)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {!result && !loading && (
        <EmptyState message="Set origin, destination, and jump range, then click Plot Route." />
      )}
    </div>
  )
}

// ---- Tab: Exobiology ----

function ExoProgress({ count }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border ${i < count
            ? 'bg-ed-success border-ed-success'
            : 'bg-transparent border-ed-border'
          }`}
        />
      ))}
    </div>
  )
}

function ExobiologyTab() {
  const [scans, setScans] = useState([])

  const reload = useCallback(() => {
    // false = include all (completed + in-progress)
    api()?.get_exo_scans().then(inProgress => {
      api()?.get_exo_scans(null).then(all => {
        // get_exo_scans() with no arg returns incomplete only; we want all
        // but API only takes system param — call with undefined to get all incomplete
        // For history we'd need to modify the API. Use in-progress for now.
        setScans(inProgress ?? [])
      })
    })
    // Actually just call it once — get_exo_scans with no system returns incomplete
    api()?.get_exo_scans().then(r => setScans(r ?? []))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const off = window.__edtc?.on('exo_scan', () => reload())
    return () => off?.()
  }, [reload])

  async function clearSystem(system) {
    await api()?.clear_exo_scans(system)
    reload()
  }

  // Group by system
  const grouped = {}
  for (const s of scans) {
    if (!grouped[s.system]) grouped[s.system] = []
    grouped[s.system].push(s)
  }
  const systems = Object.entries(grouped)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          In-progress scans (3 samples needed per species). Synced live from journal.
        </p>
        <button className="btn-ghost text-sm" onClick={reload}>Refresh</button>
      </div>

      {systems.length === 0 ? (
        <EmptyState message="No active exo scans. Start scanning organisms in-game with EDTC running." />
      ) : (
        <div className="space-y-3">
          {systems.map(([system, entries]) => (
            <div key={system} className="panel">
              <div className="flex items-center justify-between mb-3">
                <p className="text-ed-orange font-semibold font-ui">{system}</p>
                <button
                  className="btn-ghost text-xs text-ed-muted"
                  onClick={() => clearSystem(system)}
                >
                  Clear System
                </button>
              </div>
              <div className="space-y-2">
                {entries.map(e => (
                  <div key={`${e.body}-${e.species}`} className="flex items-center gap-3">
                    <ExoProgress count={e.scan_count} />
                    <div className="flex-1 min-w-0">
                      <p className="text-ed-text text-sm font-mono truncate">{e.species}</p>
                      {e.genus && e.genus !== e.species && (
                        <p className="text-ed-muted text-xs font-mono">
                          {e.genus} · Body {e.body}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${
                      e.scan_count >= 3 ? 'text-ed-success' : 'text-ed-muted'
                    }`}>
                      {e.scan_count}/3
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Exo Planner ----

function fmtLandmarkValue(v) {
  if (!v) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M Cr`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K Cr`
  return `${v} Cr`
}

function ExoPlannerTab({ currentSystem }) {
  const [origin, setOrigin]     = useState('')
  const [range, setRange]       = useState('30')
  const [radius, setRadius]     = useState('10000')
  const [maxSys, setMaxSys]     = useState('20')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (currentSystem && !origin) setOrigin(currentSystem)
  }, [currentSystem])

  useEffect(() => {
    api()?.get_ship_info?.().then(info => {
      if (info?.current_jump_range) setRange(info.current_jump_range.toFixed(1))
      else if (info?.max_jump_range) setRange(info.max_jump_range.toFixed(1))
    })
  }, [])

  async function doRoute() {
    const r = parseFloat(range)
    const rad = parseFloat(radius)
    const n = parseInt(maxSys, 10)
    if (!origin.trim() || isNaN(r) || isNaN(rad) || isNaN(n)) return
    setLoading(true)
    setResult(null)
    setExpanded(null)
    const res = await api()?.plan_exobiology_route(origin.trim(), r, rad, n)
    setResult(res ?? { error: 'No response' })
    setLoading(false)
  }

  const systems = (result?.systems ?? []).filter(s => s.bodies?.length > 0)
  const totalValue = systems.reduce((sum, s) =>
    sum + (s.bodies ?? []).reduce((bs, b) => bs + (b.landmark_value ?? 0), 0), 0)

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Plots a multi-system route through bodies with biological signals near your origin. Powered by Spansh.
      </p>

      <div className="panel mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Origin System</label>
            <input
              className="input font-mono text-sm w-full"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="Sol"
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Jump Range (ly)</label>
            <input
              className="input font-mono text-sm w-full"
              type="number" min="5" max="100"
              value={range}
              onChange={e => setRange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Search Radius (ly)</label>
            <input
              className="input font-mono text-sm w-full"
              type="number" min="100" max="50000"
              value={radius}
              onChange={e => setRadius(e.target.value)}
            />
          </div>
          <div>
            <label className="text-ed-muted text-xs font-mono mb-1 block">Max Systems</label>
            <input
              className="input font-mono text-sm w-full"
              type="number" min="5" max="100"
              value={maxSys}
              onChange={e => setMaxSys(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={doRoute}
          disabled={loading || !origin.trim()}
        >
          {loading ? 'Planning route (may take ~30s)…' : 'Plan Exo Route'}
        </button>
      </div>

      {result?.error && (
        <div className="panel border border-ed-danger/30 mb-3">
          <p className="text-ed-danger text-sm font-mono">{result.error}</p>
        </div>
      )}

      {systems.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-ed-muted text-sm font-mono">{systems.length} systems with bio signals</p>
            <p className="text-ed-gold font-mono font-semibold">{fmtCredits(totalValue)} total</p>
          </div>

          <div className="space-y-1">
            {systems.map((s, i) => {
              const isOpen = expanded === i
              const sysValue = (s.bodies ?? []).reduce((sum, b) => sum + (b.landmark_value ?? 0), 0)
              const speciesCount = (s.bodies ?? []).reduce((sum, b) => sum + (b.landmarks ?? []).length, 0)

              return (
                <div key={i} className="panel">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-ed-muted font-mono text-xs w-6 shrink-0">{i + 1}</span>
                      <span className="text-ed-text font-ui font-semibold truncate">{s.name}</span>
                      <span className="text-ed-muted text-xs font-mono shrink-0">
                        {s.jumps} {s.jumps === 1 ? 'jump' : 'jumps'}
                      </span>
                      <span className="text-xs font-mono text-green-400 border border-green-500/30 px-1 rounded shrink-0">
                        {speciesCount} species
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-ed-gold font-mono text-sm font-semibold">
                        {fmtCredits(sysValue)}
                      </span>
                      <span className="text-ed-muted text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 border-t border-ed-border pt-3 space-y-3">
                      {(s.bodies ?? []).map((b, j) => (
                        <div key={j}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-ed-orange text-xs font-semibold font-ui">{b.name}</span>
                            <span className="text-ed-muted text-xs font-mono">{b.subtype}</span>
                            <span className="text-ed-muted text-xs font-mono ml-auto">{fmtDist(b.distance_to_arrival)}</span>
                          </div>
                          <div className="space-y-1 pl-2">
                            {(b.landmarks ?? []).map((lm, k) => (
                              <div key={k} className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-green-400 shrink-0">●</span>
                                <span className="text-ed-text flex-1 truncate">{lm.subtype}</span>
                                <span className="text-ed-muted shrink-0">{lm.count}×</span>
                                <span className="text-ed-gold shrink-0">{fmtLandmarkValue(lm.value)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-right text-xs font-mono text-ed-muted mt-1">
                            Body total: <span className="text-ed-gold">{fmtCredits(b.landmark_value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {!result && !loading && (
        <EmptyState message="Set your origin and jump range, then click Plan Exo Route." />
      )}
    </div>
  )
}

// ---- Tab: Session Scanner ----

const CLASS_COLORS = {
  'Earthlike body': 'text-green-400',
  'Ammonia world': 'text-purple-400',
  'Water world': 'text-blue-400',
  'Metal rich body': 'text-yellow-400',
  'High metal content body': 'text-orange-300',
}

function SessionScannerTab({ currentSystem }) {
  const [bodies, setBodies] = useState([])

  useEffect(() => {
    api()?.get_fss_bodies().then(r => setBodies(r ?? []))
  }, [])

  useEffect(() => {
    const offScan = window.__edtc?.on('scan_update', e => {
      setBodies(e?.payload?.all_bodies ?? [])
    })
    const offJump = window.__edtc?.on('system_changed', () => {
      setBodies([])
    })
    return () => { offScan?.(); offJump?.() }
  }, [])

  const totalValue = bodies.reduce((sum, b) => sum + (b.value ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-ed-muted text-sm">
            Live FSS scan log for the current session.
            {currentSystem && <span className="text-ed-text ml-1">System: <span className="text-ed-orange">{currentSystem}</span></span>}
          </p>
          <p className="text-ed-muted text-xs mt-0.5">Resets on each FSD jump. Stars are excluded.</p>
        </div>
        {totalValue > 0 && (
          <p className="text-ed-gold font-mono font-semibold shrink-0">{fmtCredits(totalValue)}</p>
        )}
      </div>

      {bodies.length === 0 ? (
        <EmptyState message="No bodies scanned this session. Scan bodies in-game with EDTC running." />
      ) : (
        <div className="space-y-1">
          {bodies.map((b, i) => {
            const colorClass = CLASS_COLORS[b.class?.toLowerCase()] ?? CLASS_COLORS[b.class] ?? 'text-ed-text'
            return (
              <div key={i} className="panel py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-ed-text text-sm font-mono truncate">{b.body}</p>
                    {b.terraformable && (
                      <span className="text-xs font-mono text-green-300 border border-green-500/40 px-1 rounded shrink-0">
                        Terraformable
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-mono mt-0.5 ${colorClass}`}>{b.class}</p>
                </div>
                <p className={`text-sm font-mono font-semibold shrink-0 ${
                  (b.value ?? 0) >= 1_000_000 ? 'text-ed-gold'
                  : (b.value ?? 0) >= 200_000 ? 'text-ed-orange'
                  : 'text-ed-muted'
                }`}>
                  ~{fmtCredits(b.value)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'system',      label: 'System Lookup' },
  { id: 'r2r',         label: 'Road to Riches' },
  { id: 'exo-planner', label: 'Exo Planner' },
  { id: 'exo',         label: 'Exobiology' },
  { id: 'scanner',     label: 'Session Scanner' },
]

export default function Exploration() {
  const [tab, setTab] = useState('system')
  const [currentSystem, setCurrentSystem] = useState('')

  useEffect(() => {
    api()?.get_current_system().then(s => setCurrentSystem(s ?? ''))
  }, [])

  useEffect(() => {
    const off = window.__edtc?.on('system_changed', e => {
      setCurrentSystem(e?.payload?.system ?? '')
    })
    return () => off?.()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Exploration</h1>
      <p className="text-ed-muted text-sm mb-5">System lookup, body scanning, exobiology, and route planning.</p>

      <div className="flex gap-1 mb-6 border-b border-ed-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-ui font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-ed-orange text-ed-orange'
                : 'border-transparent text-ed-muted hover:text-ed-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'system'      && <SystemLookupTab currentSystem={currentSystem} />}
      {tab === 'r2r'         && <R2RTab currentSystem={currentSystem} />}
      {tab === 'exo-planner' && <ExoPlannerTab currentSystem={currentSystem} />}
      {tab === 'exo'         && <ExobiologyTab />}
      {tab === 'scanner'     && <SessionScannerTab currentSystem={currentSystem} />}
    </div>
  )
}
