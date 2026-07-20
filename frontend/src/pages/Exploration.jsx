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
  const [sortBy, setSortBy] = useState('route')

  useEffect(() => {
    if (currentSystem && !origin) setOrigin(currentSystem)
  }, [currentSystem])

  async function doRoute() {
    const r = parseFloat(range)
    if (!origin.trim() || isNaN(r) || r <= 0) return
    setLoading(true)
    setResult(null)
    setExpanded(null)
    const res = await api()?.road_to_riches(origin.trim(), dest.trim(), r, parseInt(maxSys, 10) || 50)
    setResult(res ?? { error: 'No response' })
    setLoading(false)
  }

  const bodyValue = b => b.estimated_mapping_value ?? b.estimated_scan_value ?? 0
  const sysVal = s => (s.bodies ?? []).reduce((bs, b) => bs + bodyValue(b), 0)
  const systems = (result?.systems ?? []).map((s, idx) => ({ ...s, _routeIdx: idx }))
  if (sortBy === 'value') systems.sort((a, b) => sysVal(b) - sysVal(a))
  const totalValue = systems.reduce((sum, s) => sum + sysVal(s), 0)

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
            <label className="text-ed-muted text-xs font-mono mb-1 block">Destination (optional)</label>
            <input
              className="input font-mono text-sm w-full"
              value={dest}
              onChange={e => setDest(e.target.value)}
              placeholder="Blank = loop near origin"
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
          disabled={loading || !origin.trim()}
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
            <div className="flex items-center gap-3">
              <p className="text-ed-muted text-sm font-mono">{systems.length} systems</p>
              <div className="flex gap-1">
                {[['route', 'Route Order'], ['value', 'Highest Value']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSortBy(id)}
                    className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${sortBy === id ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-ed-gold font-mono font-semibold">
              Total: {fmtCredits(totalValue)} mapped
            </p>
          </div>

          <div className="space-y-1">
            {systems.map((s, i) => {
              const sysName = s.system ?? s.name ?? `System ${i + 1}`
              const bodies = s.bodies ?? []
              const sysValue = sysVal(s)
              const isOpen = expanded === i

              return (
                <div key={i} className="panel">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-ed-muted font-mono text-xs w-6 shrink-0">{s._routeIdx + 1}</span>
                      <span className="text-ed-text font-ui font-semibold truncate">{sysName}</span>
                      {s.jumps != null && (
                        <span className="text-ed-muted text-xs font-mono shrink-0">
                          {s.jumps} {s.jumps === 1 ? 'jump' : 'jumps'}
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
                        const bVal = bodyValue(b)
                        return (
                          <div key={j} className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-ed-muted w-4 text-center shrink-0">●</span>
                            <span className="text-ed-text flex-1 truncate">{b.name}</span>
                            {b.is_terraformable && (
                              <span className="text-green-300 border border-green-500/40 px-1 rounded shrink-0">
                                Terraformable
                              </span>
                            )}
                            <span className="text-ed-muted shrink-0">{b.subtype ?? b.type ?? ''}</span>
                            {b.distance_to_arrival != null && (
                              <span className="text-ed-muted shrink-0">{fmtDist(b.distance_to_arrival)}</span>
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
// Three sub-views: Tracker (live sampling + what's on nearby bodies),
// Value Reference (target-hunting browser), and Earnings (Vista Genomics).

function ExoProgress({ count, size = 3 }) {
  const cls = size === 3 ? 'w-3 h-3' : 'w-2.5 h-2.5'
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`${cls} rounded-full border ${i < count
            ? 'bg-ed-success border-ed-success'
            : 'bg-transparent border-ed-border'
          }`}
        />
      ))}
    </div>
  )
}

function valueColor(v) {
  return v >= 10_000_000 ? 'text-ed-gold'
    : v >= 3_000_000 ? 'text-ed-orange'
    : 'text-ed-text'
}

// --- Sub-view: Tracker ---

function DistanceMeter({ dist }) {
  // dist: { distance, required, clear, species, samples }
  const pct = dist.required ? Math.min(100, (dist.distance / dist.required) * 100) : 100
  const remaining = Math.max(0, (dist.required ?? 0) - (dist.distance ?? 0))
  return (
    <div className={`rounded border px-3 py-2 ${dist.clear ? 'border-ed-success/50 bg-ed-success/10' : 'border-ed-orange/40 bg-ed-orange/5'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-ed-text truncate">{dist.species}</span>
        <span className={`text-xs font-mono font-semibold ${dist.clear ? 'text-ed-success' : 'text-ed-orange'}`}>
          {dist.clear ? 'Far enough — sample here' : `Move ${Math.round(remaining)} m more`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ed-dark overflow-hidden">
        <div
          className={`h-full transition-all ${dist.clear ? 'bg-ed-success' : 'bg-ed-orange'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-ed-muted font-mono mt-1">
        {Math.round(dist.distance)} m from nearest sample · need {dist.required} m · {dist.samples} taken
      </p>
    </div>
  )
}

function BioSignalCard({ body }) {
  const [open, setOpen] = useState(false)
  const preds = body.predictions ?? []
  const topValue = preds.reduce((m, p) => Math.max(m, p.value ?? 0), 0)
  return (
    <div className="panel">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-ed-text font-ui font-semibold truncate">{body.body}</span>
          <span className="text-xs font-mono text-green-400 border border-green-500/30 px-1 rounded shrink-0">
            {body.count} signal{body.count === 1 ? '' : 's'}
          </span>
          <span className={`text-[10px] font-mono px-1 rounded border shrink-0 ${body.confirmed ? 'border-ed-success/40 text-ed-success' : 'border-ed-orange/40 text-ed-orange'}`}>
            {body.confirmed ? 'DSS confirmed' : 'predicted'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {topValue > 0 && <span className={`text-xs font-mono ${valueColor(topValue)}`}>up to {fmtCredits(topValue)}</span>}
          <span className="text-ed-muted text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {body.confirmed && body.genera?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {body.genera.map(g => <Tag key={g} label={g} color="border-ed-success/40 text-ed-success" />)}
        </div>
      )}

      {open && (
        <div className="mt-3 border-t border-ed-border pt-2 space-y-1">
          {preds.length === 0 ? (
            <p className="text-ed-muted text-xs font-mono">
              {body.confirmed ? 'No value data for these genera.' : 'Map this body (DSS) to confirm species, or scan it in detail for a prediction.'}
            </p>
          ) : preds.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-green-400 shrink-0">●</span>
              <span className="text-ed-text flex-1 truncate">{p.name}</span>
              <span className="text-ed-muted shrink-0">{p.colony_distance} m</span>
              <span className={`shrink-0 font-semibold ${valueColor(p.value)}`}>{fmtCredits(p.value)}</span>
            </div>
          ))}
          {!body.confirmed && preds.length > 0 && (
            <p className="text-[10px] text-ed-muted font-mono pt-1">
              Candidates from body conditions — actual species confirmed after a DSS map.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TrackerView({ currentSystem }) {
  const [scans, setScans] = useState([])
  const [bodies, setBodies] = useState([])
  const [dist, setDist] = useState(null)
  const [carried, setCarried] = useState(null)

  const reload = useCallback(() => {
    api()?.get_exo_scans().then(r => setScans(r ?? []))
    api()?.get_body_bio().then(r => setBodies(r ?? []))
    api()?.get_exo_carried_value().then(r => setCarried(r ?? null))
  }, [])

  useEffect(() => { reload() }, [reload, currentSystem])

  useEffect(() => {
    const offScan = window.__edtc?.on('exo_scan', () => reload())
    const offBio = window.__edtc?.on('bio_signals', () => reload())
    const offSale = window.__edtc?.on('exo_sale', () => reload())
    const offDist = window.__edtc?.on('exo_distance', p => setDist(p))
    return () => { offScan?.(); offBio?.(); offSale?.(); offDist?.() }
  }, [reload])

  async function clearSystem(system) {
    await api()?.clear_exo_scans(system)
    reload()
  }

  // Only show genuinely-started species (>=1 sample). Pre-fix rows were stored
  // at 0/3 because the old code never incremented — hide that stale noise.
  const grouped = {}
  for (const s of scans) {
    if ((s.scan_count ?? 0) < 1) continue
    if (!grouped[s.system]) grouped[s.system] = []
    grouped[s.system].push(s)
  }
  const systems = Object.entries(grouped)

  return (
    <div className="space-y-4">
      {/* Live distance helper */}
      {dist && (
        <div>
          <p className="text-ed-muted text-xs font-mono uppercase tracking-wide mb-1.5">Clonal colony distance</p>
          <DistanceMeter dist={dist} />
        </div>
      )}

      {/* Carried unsold value */}
      {carried && carried.count > 0 && (
        <div className="panel flex items-center justify-between">
          <div>
            <p className="text-ed-text text-sm font-semibold">Unsold data aboard</p>
            <p className="text-ed-muted text-xs font-mono">
              {carried.count} species · sell at Vista Genomics
              {carried.total > (carried.base_total ?? carried.total) && ' · incl. first-footfall ×5'}
            </p>
          </div>
          <p className="text-ed-gold font-mono font-semibold">{fmtCredits(carried.total)}</p>
        </div>
      )}

      {/* Bio signals on nearby bodies */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-ed-text font-ui font-semibold text-sm">
            Bio signals {currentSystem && <span className="text-ed-orange">· {currentSystem}</span>}
          </p>
          <button className="btn-ghost text-xs" onClick={reload}>Refresh</button>
        </div>
        {bodies.length === 0 ? (
          <EmptyState message="No biological signals detected yet. FSS or DSS-map bodies in this system to populate this." />
        ) : (
          <div className="space-y-1">
            {[...bodies].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).map((b, i) => (
              <BioSignalCard key={b.body_id ?? i} body={b} />
            ))}
          </div>
        )}
      </div>

      {/* In-progress sampling */}
      <div>
        <p className="text-ed-text font-ui font-semibold text-sm mb-2">Sampling progress</p>
        <p className="text-ed-muted text-xs mb-2">Each species needs 3 samples (Log → Sample → Analyse), taken at least the colony distance apart.</p>
        {systems.length === 0 ? (
          <EmptyState message="No sampling in progress. Use the Genetic Sampler on organisms in-game." />
        ) : (
          <div className="space-y-3">
            {systems.map(([system, entries]) => (
              <div key={system} className="panel">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-ed-orange font-semibold font-ui">{system}</p>
                  <button className="btn-ghost text-xs text-ed-muted" onClick={() => clearSystem(system)}>Clear</button>
                </div>
                <div className="space-y-2">
                  {entries.map(e => (
                    <div key={`${e.body}-${e.species}`} className="flex items-center gap-3">
                      <ExoProgress count={e.scan_count} />
                      <div className="flex-1 min-w-0">
                        <p className="text-ed-text text-sm font-mono truncate">{e.species}</p>
                        {e.genus && e.genus !== e.species && (
                          <p className="text-ed-muted text-xs font-mono">{e.genus} · Body {e.body}</p>
                        )}
                      </div>
                      {e.value > 0 && <span className={`text-xs font-mono shrink-0 ${valueColor(e.value)}`}>{fmtCredits(e.value)}</span>}
                      <span className={`text-xs font-mono shrink-0 w-8 text-right ${e.scan_count >= 3 ? 'text-ed-success' : 'text-ed-muted'}`}>{e.scan_count}/3</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-view: Value Reference (target hunting) ---

const ATMOS_SHORT = {
  CarbonDioxide: 'CO₂', CarbonDioxideRich: 'CO₂-rich', SulphurDioxide: 'SO₂',
  Ammonia: 'NH₃', Water: 'H₂O', WaterRich: 'H₂O-rich', Methane: 'CH₄',
  MethaneRich: 'CH₄-rich', Nitrogen: 'N₂', Oxygen: 'O₂', Argon: 'Ar',
  ArgonRich: 'Ar-rich', Neon: 'Ne', NeonRich: 'Ne-rich', Helium: 'He',
}

function genusSummary(g) {
  const atmos = new Set(), bodies = new Set()
  let gmax = 0, tmin = Infinity, tmax = 0
  for (const sp of g.species ?? []) {
    for (const rs of sp.conditions ?? []) {
      (rs.atmosphere ?? []).forEach(a => atmos.add(ATMOS_SHORT[a] ?? a))
      ;(rs.body_type ?? []).forEach(b => bodies.add(b.replace(' body', '')))
      if (rs.max_gravity) gmax = Math.max(gmax, rs.max_gravity)
      if (rs.min_temperature) tmin = Math.min(tmin, rs.min_temperature)
      if (rs.max_temperature) tmax = Math.max(tmax, rs.max_temperature)
    }
  }
  return {
    atmos: [...atmos], bodies: [...bodies],
    gmax: gmax || null,
    temp: tmin !== Infinity ? [Math.round(tmin), Math.round(tmax)] : null,
  }
}

function GenusCard({ genus }) {
  const [open, setOpen] = useState(false)
  const s = genusSummary(genus)
  const species = [...(genus.species ?? [])].sort((a, b) => b.value - a.value)
  return (
    <div className="panel">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-ed-orange font-ui font-semibold">{genus.name}</span>
          <span className="text-[10px] font-mono text-ed-muted border border-ed-border px-1 rounded shrink-0">{genus.colony_distance} m apart</span>
          <span className="text-ed-muted text-xs font-mono">{genus.species?.length} species</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono font-semibold ${valueColor(genus.max_value)}`}>
            {fmtCredits(genus.min_value)}–{fmtCredits(genus.max_value)}
          </span>
          <span className="text-ed-muted text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      <div className="flex flex-wrap gap-1 mt-2">
        {s.bodies.map(b => <Tag key={b} label={b} />)}
        {s.atmos.slice(0, 6).map(a => <Tag key={a} label={a} color="border-blue-500/30 text-blue-300" />)}
        {s.gmax && <Tag label={`≤${s.gmax.toFixed(2)}g`} color="border-ed-border text-ed-muted" />}
        {s.temp && <Tag label={`${s.temp[0]}–${s.temp[1]}K`} color="border-ed-border text-ed-muted" />}
      </div>

      {open && (
        <div className="mt-3 border-t border-ed-border pt-2 space-y-1">
          {species.map((sp, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-ed-text flex-1 truncate">{sp.name}</span>
              <span className={`shrink-0 font-semibold ${valueColor(sp.value)}`}>{fmtCredits(sp.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReferenceView() {
  const [data, setData] = useState([])
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('value')

  useEffect(() => {
    api()?.get_exobiology_data().then(r => setData(r ?? []))
  }, [])

  const q = query.trim().toLowerCase()
  let genera = data.filter(g =>
    !q || g.name.toLowerCase().includes(q) ||
    (g.species ?? []).some(sp => sp.name.toLowerCase().includes(q)))
  if (sortBy === 'value') genera = [...genera].sort((a, b) => b.max_value - a.max_value)
  else if (sortBy === 'name') genera = [...genera].sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy === 'distance') genera = [...genera].sort((a, b) => a.colony_distance - b.colony_distance)

  return (
    <div>
      <p className="text-ed-muted text-sm mb-3">
        Base Vista Genomics values. <span className="text-ed-text">First Logged</span> (first CMDR to sample a species) pays <span className="text-ed-gold">5×</span>. Sample colonies at least the listed distance apart.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1 min-w-[180px]"
          placeholder="Search genus or species…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-1">
          {[['value', 'Value'], ['name', 'Name'], ['distance', 'Distance']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${sortBy === id ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            >{label}</button>
          ))}
        </div>
      </div>
      {genera.length === 0 ? (
        <EmptyState message="No genera match your search." />
      ) : (
        <div className="space-y-1">
          {genera.map(g => <GenusCard key={g.id} genus={g} />)}
        </div>
      )}
    </div>
  )
}

// --- Sub-view: Earnings (Vista Genomics) ---

function StatTile({ label, value, sub, color = 'text-ed-text' }) {
  return (
    <div className="panel">
      <p className="text-ed-muted text-xs font-mono">{label}</p>
      <p className={`font-mono font-semibold text-lg ${color}`}>{value}</p>
      {sub && <p className="text-ed-muted text-[10px] font-mono">{sub}</p>}
    </div>
  )
}

function EarningsView() {
  const [summary, setSummary] = useState(null)
  const [sales, setSales] = useState([])
  const [carried, setCarried] = useState(null)

  const reload = useCallback(() => {
    api()?.get_exo_sales_summary().then(r => setSummary(r ?? null))
    api()?.get_exo_sales(200).then(r => setSales(r ?? []))
    api()?.get_exo_carried_value().then(r => setCarried(r ?? null))
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const off = window.__edtc?.on('exo_sale', () => reload())
    return () => off?.()
  }, [reload])

  const total = summary ? (summary.base ?? 0) + (summary.bonus ?? 0) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Total earned" value={fmtCredits(total)} color="text-ed-gold" sub="base + first-logged" />
        <StatTile label="Samples sold" value={summary?.samples ?? 0} sub={`${summary?.species ?? 0} species`} />
        <StatTile label="First Logged" value={summary?.first_logged ?? 0} color="text-ed-orange" sub={fmtCredits(summary?.bonus ?? 0) + ' bonus'} />
        <StatTile label="Carrying (unsold)" value={fmtCredits(carried?.total ?? 0)} color="text-ed-text"
                  sub={`${carried?.count ?? 0} species${(carried?.total ?? 0) > (carried?.base_total ?? carried?.total ?? 0) ? ' · FF ×5' : ''}`} />
      </div>

      <div>
        <p className="text-ed-text font-ui font-semibold text-sm mb-2">Recent sales</p>
        {sales.length === 0 ? (
          <EmptyState message="No Vista Genomics sales recorded yet. Sell exobiology data with EDTC running." />
        ) : (
          <div className="space-y-1">
            {sales.map((s, i) => (
              <div key={s.id ?? i} className="panel py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-ed-text text-sm font-mono truncate">{s.species}</p>
                  <p className="text-ed-muted text-[10px] font-mono truncate">
                    {s.genus}{s.system ? ` · ${s.system}` : ''}{s.ts ? ` · ${s.ts.slice(0, 10)}` : ''}
                  </p>
                </div>
                {s.bonus > 0 && (
                  <span className="text-[10px] font-mono text-ed-orange border border-ed-orange/40 px-1 rounded shrink-0">
                    +{fmtCredits(s.bonus)} first
                  </span>
                )}
                <span className={`text-sm font-mono font-semibold shrink-0 ${valueColor(s.value + s.bonus)}`}>
                  {fmtCredits(s.value + s.bonus)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Exobiology tab shell ---

const EXO_SUBTABS = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'reference', label: 'Value Reference' },
  { id: 'earnings', label: 'Earnings' },
]

function ExobiologyTab({ currentSystem }) {
  const [sub, setSub] = useState('tracker')
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {EXO_SUBTABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${sub === t.id ? 'border-ed-orange text-ed-orange bg-ed-orange/5' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
          >{t.label}</button>
        ))}
      </div>
      {sub === 'tracker' && <TrackerView currentSystem={currentSystem} />}
      {sub === 'reference' && <ReferenceView />}
      {sub === 'earnings' && <EarningsView />}
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
  const [bioFilter, setBioFilter] = useState([])
  const [sortBy, setSortBy]     = useState('route')

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
    setBioFilter([])
    const res = await api()?.plan_exobiology_route(origin.trim(), r, rad, n)
    setResult(res ?? { error: 'No response' })
    setLoading(false)
  }

  const rawSystems = (result?.systems ?? []).filter(s => s.bodies?.length > 0)

  const allBioTypes = [...new Set(rawSystems.flatMap(s =>
    (s.bodies ?? []).flatMap(b => (b.landmarks ?? []).map(lm => lm.type).filter(Boolean))
  ))].sort()

  // Apply bio-type filter: keep only matching landmarks, recompute body values
  // (landmark_value = sum of per-species values — one payout per species per body),
  // and drop bodies/systems with nothing left.
  const sysValue = s => (s.bodies ?? []).reduce((sum, b) => sum + (b.landmark_value ?? 0), 0)
  const systems = rawSystems
    .map((s, idx) => {
      const bodies = (s.bodies ?? [])
        .map(b => {
          const landmarks = (b.landmarks ?? []).filter(lm =>
            bioFilter.length === 0 || bioFilter.includes(lm.type))
          return {
            ...b,
            landmarks,
            landmark_value: landmarks.reduce((sum, lm) => sum + (lm.value ?? 0), 0),
          }
        })
        .filter(b => b.landmarks.length > 0)
      return { ...s, bodies, _routeIdx: idx }
    })
    .filter(s => s.bodies.length > 0)
  if (sortBy === 'value') systems.sort((a, b) => sysValue(b) - sysValue(a))

  const totalValue = systems.reduce((sum, s) => sum + sysValue(s), 0)

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

      {rawSystems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex gap-1">
            {[['route', 'Route Order'], ['value', 'Highest Value']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${sortBy === id ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {allBioTypes.length > 0 && <span className="text-ed-muted text-xs font-mono ml-2">Bio:</span>}
          <div className="flex gap-1 flex-wrap">
            {allBioTypes.map(t => (
              <button
                key={t}
                onClick={() => setBioFilter(f => f.includes(t) ? f.filter(x => x !== t) : [...f, t])}
                className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${bioFilter.includes(t) ? 'border-green-500 text-green-400' : 'border-ed-border text-ed-muted hover:border-green-500/50'}`}
              >
                {t}
              </button>
            ))}
            {bioFilter.length > 0 && (
              <button
                onClick={() => setBioFilter([])}
                className="text-xs font-mono px-2 py-0.5 rounded border border-ed-border text-ed-muted hover:border-ed-orange/50"
              >
                ✕ Clear
              </button>
            )}
          </div>
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
              const speciesCount = (s.bodies ?? []).reduce((sum, b) => sum + (b.landmarks ?? []).length, 0)
              const sVal = sysValue(s)

              return (
                <div key={i} className="panel">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-ed-muted font-mono text-xs w-6 shrink-0">{s._routeIdx + 1}</span>
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
                        {fmtCredits(sVal)}
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
    const offScan = window.__edtc?.on('scan_update', p => {
      setBodies(p?.all_bodies ?? [])
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

// ---- Tab: System Search (attribute filters, Spansh) ----

const SEARCH_ALLEGIANCES = ['Alliance', 'Empire', 'Federation', 'Guardian',
  'Independent', 'Pilots Federation', 'Thargoid']
const SEARCH_GOVERNMENTS = ['Anarchy', 'Communism', 'Confederacy', 'Cooperative',
  'Corporate', 'Democracy', 'Dictatorship', 'Feudal', 'Patronage', 'Prison',
  'Prison Colony', 'Theocracy', 'None']
const SEARCH_SECURITIES = ['Anarchy', 'High', 'Medium', 'Low']
const SEARCH_ECONOMIES = ['Agriculture', 'Colony', 'Extraction', 'High Tech',
  'Industrial', 'Military', 'Refinery', 'Service', 'Terraforming', 'Tourism', 'None']
const SEARCH_POWERS = ['A. Lavigny-Duval', 'Aisling Duval', 'Archon Delaine',
  'Denton Patreus', 'Edmund Mahon', 'Felicia Winters', 'Jerome Archer',
  'Li Yong-Rui', 'Nakato Kaine', 'Pranav Antal', 'Yuri Grom', 'Zemina Torval']
const SEARCH_POWER_STATES = ['Stronghold', 'Fortified', 'Exploited', 'Unoccupied']

// UI star-class groups → Spansh's exact main-star subtype strings (verified
// against /bodies/field_values/subtype 2026-07-19 — exact match required)
const STAR_GROUPS = {
  'O':            ['O (Blue-White) Star'],
  'B':            ['B (Blue-White) Star', 'B (Blue-White super giant) Star'],
  'A':            ['A (Blue-White) Star', 'A (Blue-White super giant) Star'],
  'F':            ['F (White) Star', 'F (White super giant) Star'],
  'G':            ['G (White-Yellow) Star', 'G (White-Yellow super giant) Star'],
  'K':            ['K (Yellow-Orange) Star', 'K (Yellow-Orange giant) Star'],
  'M':            ['M (Red dwarf) Star', 'M (Red giant) Star', 'M (Red super giant) Star'],
  'Scoopable (O-M)': ['O (Blue-White) Star', 'B (Blue-White) Star',
    'B (Blue-White super giant) Star', 'A (Blue-White) Star',
    'A (Blue-White super giant) Star', 'F (White) Star', 'F (White super giant) Star',
    'G (White-Yellow) Star', 'G (White-Yellow super giant) Star',
    'K (Yellow-Orange) Star', 'K (Yellow-Orange giant) Star',
    'M (Red dwarf) Star', 'M (Red giant) Star', 'M (Red super giant) Star'],
  'Brown dwarf (L/T/Y)': ['L (Brown dwarf) Star', 'T (Brown dwarf) Star',
    'Y (Brown dwarf) Star'],
  'Neutron Star': ['Neutron Star'],
  'White Dwarf':  ['White Dwarf (D) Star', 'White Dwarf (DA) Star',
    'White Dwarf (DAB) Star', 'White Dwarf (DAV) Star', 'White Dwarf (DAZ) Star',
    'White Dwarf (DB) Star', 'White Dwarf (DBV) Star', 'White Dwarf (DBZ) Star',
    'White Dwarf (DC) Star', 'White Dwarf (DCV) Star', 'White Dwarf (DQ) Star'],
  'Black Hole':   ['Black Hole', 'Supermassive Black Hole'],
}

const POP_PRESETS = {
  'Uninhabited': { max_population: 0 },
  'Populated':   { min_population: 1 },
  '> 1M':        { min_population: 1_000_000 },
  '> 100M':      { min_population: 100_000_000 },
  '> 1B':        { min_population: 1_000_000_000 },
}

function starShort(subtype) {
  if (!subtype) return '—'
  if (subtype === 'Neutron Star') return 'N'
  if (subtype.includes('Black Hole')) return 'BH'
  if (subtype.startsWith('White Dwarf')) return subtype.match(/\((\w+)\)/)?.[1] || 'D'
  if (subtype.includes('T Tauri')) return 'TTS'
  return subtype[0]
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-ed-muted text-xs font-mono">{label}</span>
      <select className="input w-full mt-0.5" value={value}
        onChange={e => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function SystemSearchTab({ currentSystem }) {
  const [reference, setReference] = useState('')
  const [name, setName] = useState('')
  const [maxDist, setMaxDist] = useState('')
  const [star, setStar] = useState('')
  const [allegiance, setAllegiance] = useState('')
  const [government, setGovernment] = useState('')
  const [security, setSecurity] = useState('')
  const [economy, setEconomy] = useState('')
  const [pop, setPop] = useState('')
  const [permit, setPermit] = useState('')
  const [power, setPower] = useState('')
  const [powerState, setPowerState] = useState('')
  const [sortBy, setSortBy] = useState('distance')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState('')

  const SIZE = 50

  async function search(p = 0) {
    setLoading(true)
    setPage(p)
    const opts = {
      reference: reference.trim() || currentSystem,
      name: name.trim(),
      max_distance: maxDist ? Number(maxDist) : null,
      allegiances: allegiance ? [allegiance] : null,
      governments: government ? [government] : null,
      securities: security ? [security] : null,
      primary_economies: economy ? [economy] : null,
      powers: power ? [power] : null,
      power_states: powerState ? [powerState] : null,
      main_star_subtypes: star ? STAR_GROUPS[star] : null,
      needs_permit: permit === '' ? null : permit === 'permit',
      sort_by: sortBy,
      sort_dir: sortBy === 'population' ? 'desc' : 'asc',
      size: SIZE,
      page: p,
      ...(pop ? POP_PRESETS[pop] : {}),
    }
    const r = await api()?.search_star_systems(opts)
    setResult(r ?? { error: 'No response' })
    setLoading(false)
  }

  function copyName(n) {
    api()?.copy_to_clipboard(n)
    setCopied(n)
    setTimeout(() => setCopied(c => (c === n ? '' : c)), 1500)
  }

  const rows = result?.results ?? []
  const pages = result ? Math.max(1, Math.ceil(result.count / SIZE)) : 0

  return (
    <div>
      <div className="panel mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <label className="block">
            <span className="text-ed-muted text-xs font-mono">Near system</span>
            <input className="input w-full mt-0.5" value={reference}
              placeholder={currentSystem || 'e.g. Sol'}
              onChange={e => setReference(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(0)} />
          </label>
          <label className="block">
            <span className="text-ed-muted text-xs font-mono">System name (* = wildcard)</span>
            <input className="input w-full mt-0.5" value={name}
              placeholder="e.g. Col 285 Sector*"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(0)} />
          </label>
          <label className="block">
            <span className="text-ed-muted text-xs font-mono">Max distance (ly)</span>
            <input className="input w-full mt-0.5" type="number" min="1" value={maxDist}
              placeholder="any" onChange={e => setMaxDist(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <FilterSelect label="Main star" value={star} onChange={setStar}
            options={Object.keys(STAR_GROUPS)} />
          <FilterSelect label="Allegiance" value={allegiance} onChange={setAllegiance}
            options={SEARCH_ALLEGIANCES} />
          <FilterSelect label="Government" value={government} onChange={setGovernment}
            options={SEARCH_GOVERNMENTS} />
          <FilterSelect label="Security" value={security} onChange={setSecurity}
            options={SEARCH_SECURITIES} />
        </div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <FilterSelect label="Primary economy" value={economy} onChange={setEconomy}
            options={SEARCH_ECONOMIES} />
          <FilterSelect label="Population" value={pop} onChange={setPop}
            options={Object.keys(POP_PRESETS)} />
          <FilterSelect label="Controlling power" value={power} onChange={setPower}
            options={SEARCH_POWERS} />
          <FilterSelect label="Power state" value={powerState} onChange={setPowerState}
            options={SEARCH_POWER_STATES} />
        </div>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="text-ed-muted text-xs font-mono">Permit</span>
            <select className="input mt-0.5" value={permit} onChange={e => setPermit(e.target.value)}>
              <option value="">Any</option>
              <option value="open">No permit needed</option>
              <option value="permit">Permit-locked only</option>
            </select>
          </label>
          <label className="block">
            <span className="text-ed-muted text-xs font-mono">Sort by</span>
            <select className="input mt-0.5" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="distance">Distance</option>
              <option value="population">Population</option>
            </select>
          </label>
          <button className="btn-primary" disabled={loading} onClick={() => search(0)}>
            {loading ? 'Searching…' : '🔍 Search'}
          </button>
          {result && !result.error && (
            <span className="text-ed-muted text-xs font-mono pb-2">
              {result.count.toLocaleString()} systems
              {result.reference ? ` near ${result.reference}` : ''}
            </span>
          )}
        </div>
      </div>

      {result?.error && (
        <div className="panel border-ed-danger/60">
          <p className="text-ed-danger text-sm">{result.error}</p>
        </div>
      )}

      {!result && !loading && (
        <EmptyState message="Filter by star class, faction attributes, population, or Powerplay — sorted from your reference system. Use * in the name for sector/boxel searches." />
      )}
      {result && !result.error && rows.length === 0 && (
        <EmptyState message="No systems match those filters." />
      )}

      {rows.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-ed-muted text-xs border-b border-ed-border">
                <th className="text-left py-1.5 pr-3">System</th>
                <th className="text-right pr-3">Dist</th>
                <th className="text-center pr-3">Star</th>
                <th className="text-left pr-3">Allegiance</th>
                <th className="text-left pr-3">Government</th>
                <th className="text-left pr-3">Sec</th>
                <th className="text-left pr-3">Economy</th>
                <th className="text-right pr-3">Pop</th>
                <th className="text-right pr-3">Bodies</th>
                <th className="text-left pr-3">Power</th>
                <th className="text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.name} className="border-b border-ed-border/40 hover:bg-ed-dark/60">
                  <td className="py-1.5 pr-3">
                    <button className="text-ed-orange hover:text-ed-gold text-left"
                      title="Click to copy" onClick={() => copyName(s.name)}>
                      {s.name}
                    </button>
                    {copied === s.name && <span className="text-ed-success text-xs ml-1">copied ✓</span>}
                    {s.permit && <span className="text-ed-danger text-xs ml-1" title="Permit required">🔒</span>}
                  </td>
                  <td className="text-right pr-3 text-ed-muted">{fmtLy(s.distance)}</td>
                  <td className={`text-center pr-3 font-bold ${STAR_COLORS[starShort(s.main_star)?.[0]] || 'text-ed-text'}`}
                    title={s.main_star}>{starShort(s.main_star)}</td>
                  <td className="text-left pr-3">{s.allegiance || '—'}</td>
                  <td className="text-left pr-3">{s.government || '—'}</td>
                  <td className="text-left pr-3">{s.security || '—'}</td>
                  <td className="text-left pr-3">{s.economy || '—'}</td>
                  <td className="text-right pr-3">{s.population ? fmtPop(s.population) : '—'}</td>
                  <td className="text-right pr-3 text-ed-muted">{s.body_count || '—'}</td>
                  <td className="text-left pr-3 text-ed-muted" title={s.power_state}>
                    {s.power || '—'}
                  </td>
                  <td className="text-right text-ed-muted text-xs">{s.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button className="badge border border-ed-border text-ed-muted hover:text-ed-text px-2"
                disabled={page <= 0 || loading} onClick={() => search(page - 1)}>← Prev</button>
              <span className="text-ed-muted text-xs font-mono">page {page + 1} of {pages.toLocaleString()}</span>
              <button className="badge border border-ed-border text-ed-muted hover:text-ed-text px-2"
                disabled={page >= pages - 1 || loading} onClick={() => search(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'system',      label: 'System Lookup' },
  { id: 'search',      label: 'System Search' },
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
    const off = window.__edtc?.on('system_changed', p => {
      setCurrentSystem(p?.system ?? '')
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
      {tab === 'search'      && <SystemSearchTab currentSystem={currentSystem} />}
      {tab === 'r2r'         && <R2RTab currentSystem={currentSystem} />}
      {tab === 'exo-planner' && <ExoPlannerTab currentSystem={currentSystem} />}
      {tab === 'exo'         && <ExobiologyTab currentSystem={currentSystem} />}
      {tab === 'scanner'     && <SessionScannerTab currentSystem={currentSystem} />}
    </div>
  )
}
