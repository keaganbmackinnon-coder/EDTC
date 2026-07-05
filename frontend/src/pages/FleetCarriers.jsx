import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Shared UI ----

function Bar({ pct, color = 'bg-ed-orange' }) {
  return (
    <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="text-ed-muted text-xs font-mono mb-0.5">{label}</p>
      <p className="text-ed-text font-semibold font-ui">{value}</p>
      {sub && <p className="text-ed-muted text-xs font-mono">{sub}</p>}
    </div>
  )
}

// ---- Tab: Stats ----

function StatsTab() {
  const [carriers, setCarriers] = useState([])

  useEffect(() => {
    api()?.get_carriers().then(r => setCarriers(r ?? []))
  }, [])

  useEffect(() => {
    return window.__edtc?.on('carrier_update', payload => {
      const c = payload?.carrier
      if (!c) return
      setCarriers(prev => {
        const idx = prev.findIndex(x => x.carrier_id === c.carrier_id)
        if (idx === -1) return [c, ...prev]
        const next = [...prev]
        next[idx] = c
        return next
      })
    })
  }, [])

  async function notMine(carrierId) {
    const list = await api()?.set_carrier_owned(carrierId, false)
    if (list) setCarriers(list)
  }

  const mine = carriers.filter(c => c.is_mine)

  if (mine.length === 0) {
    return (
      <div className="panel">
        <p className="text-ed-muted text-sm">No carrier data yet.</p>
        <p className="text-ed-muted text-xs font-mono mt-1">
          Open Carrier Management in-game to populate carrier stats.
          Carriers you dock on but don't own show under Visited Carriers.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {mine.map(c => {
        const finance = c.finance ?? {}
        const space = c.space_usage ?? {}
        const services = c.services ?? []
        const fuelPct = Math.round((c.fuel / 1000) * 100)
        const usedSpace = (space.TotalCapacity ?? 0) - (space.FreeSpace ?? 0)
        const spacePct = space.TotalCapacity
          ? Math.round((usedSpace / space.TotalCapacity) * 100)
          : 0
        const balance = finance.CarrierBalance ?? finance.AvailableBalance ?? 0

        return (
          <div key={c.carrier_id} className="panel">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-ed-orange font-ui font-semibold text-lg">
                  {c.name || 'Unknown Carrier'}
                </h2>
                <p className="text-ed-muted text-xs font-mono">{c.callsign}</p>
              </div>
              <div className="text-right">
                <p className="text-ed-muted text-xs font-mono">Location</p>
                <p className="text-ed-text font-mono text-sm">
                  {c.location || '—'}
                </p>
                {c.pending_jump && (
                  <p className="text-ed-gold text-xs font-mono mt-0.5">
                    → {c.pending_jump} (pending)
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-ed-muted">Tritium</span>
                  <span className="text-ed-text">{c.fuel} / 1000 T</span>
                </div>
                <Bar
                  pct={fuelPct}
                  color={c.fuel < 200 ? 'bg-ed-danger' : c.fuel < 500 ? 'bg-ed-gold' : 'bg-ed-success'}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-ed-muted">Cargo Space</span>
                  <span className="text-ed-text">
                    {usedSpace.toLocaleString()} / {(space.TotalCapacity ?? 0).toLocaleString()} T
                  </span>
                </div>
                <Bar pct={spacePct} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat
                label="Carrier Balance"
                value={`${(balance / 1_000_000).toFixed(1)}M Cr`}
              />
              <Stat
                label="Reserve Balance"
                value={`${((finance.ReserveBalance ?? 0) / 1_000_000).toFixed(1)}M Cr`}
                sub={`${finance.ReservePercent ?? 0}% reserved`}
              />
              <Stat
                label="Jump Range"
                value={`${c.jump_range ?? 500} ly`}
              />
            </div>

            {services.length > 0 && (
              <div>
                <p className="text-ed-muted text-xs font-mono mb-2">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s, i) => (
                    <span
                      key={i}
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        s.active
                          ? 'border-ed-orange/50 text-ed-orange'
                          : 'border-ed-border text-ed-muted opacity-50'
                      }`}
                    >
                      {s.role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <p className="text-ed-muted text-[10px] font-mono">
                Updated: {c.updated}
              </p>
              <button
                className="text-ed-muted text-[10px] font-mono hover:text-ed-danger"
                title="Move to Visited Carriers"
                onClick={() => notMine(c.carrier_id)}
              >
                Not my carrier
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Tab: Visited Carriers (docked-on, not owned) ----

function VisitedTab() {
  const [carriers, setCarriers] = useState([])
  const [showRemoved, setShowRemoved] = useState(false)

  function refresh(includeHidden = showRemoved) {
    api()?.get_carriers(includeHidden).then(r => setCarriers(r ?? []))
  }

  useEffect(() => { refresh() }, [showRemoved])

  async function markMine(carrierId) {
    const list = await api()?.set_carrier_owned(carrierId, true)
    if (list) refresh()
  }

  async function remove(carrierId) {
    await api()?.remove_carrier(carrierId)
    refresh()
  }

  async function restore(carrierId) {
    await api()?.restore_carrier(carrierId)
    refresh()
  }

  const visited = carriers.filter(c => !c.is_mine && !c.hidden)
  const removed = carriers.filter(c => !c.is_mine && c.hidden)

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Carriers you've docked on or refuelled but don't own — tracked from
        CarrierJump / CarrierLocation journal events. Remove any you don't care about.
      </p>

      {visited.length === 0 ? (
        <div className="panel">
          <p className="text-ed-muted text-sm">No visited carriers tracked.</p>
          <p className="text-ed-muted text-xs font-mono mt-1">
            Docking on someone else's carrier will add it here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visited.map(c => (
            <div key={c.carrier_id} className="panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-ed-text font-semibold font-ui">
                    {c.name || c.callsign || `Carrier #${c.carrier_id}`}
                  </span>
                  {c.callsign && c.name && (
                    <span className="ml-2 text-ed-muted text-xs font-mono">{c.callsign}</span>
                  )}
                  <p className="text-ed-muted text-xs font-mono mt-0.5">
                    {c.location ? `Last seen in ${c.location}` : 'Location unknown'}
                    {' · '}{c.updated}
                  </p>
                  {c.fuel > 0 && (
                    <p className="text-ed-muted text-xs font-mono mt-0.5">
                      Tritium last known: {c.fuel} T
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-xs font-mono px-2 py-1 rounded border border-ed-border text-ed-muted hover:border-ed-orange/50 hover:text-ed-orange transition-colors"
                    onClick={() => markMine(c.carrier_id)}
                  >
                    This is mine
                  </button>
                  <button
                    className="text-xs font-mono px-2 py-1 rounded border border-ed-danger/40 text-ed-danger hover:bg-ed-danger hover:text-black transition-colors"
                    onClick={() => remove(c.carrier_id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          className="text-ed-muted text-xs font-mono hover:text-ed-text"
          onClick={() => setShowRemoved(v => !v)}
        >
          {showRemoved ? '▲ Hide removed' : `▼ Show removed${removed.length ? ` (${removed.length})` : ''}`}
        </button>
        {showRemoved && (
          removed.length === 0 ? (
            <p className="text-ed-muted text-xs font-mono mt-2">Nothing removed.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {removed.map(c => (
                <div key={c.carrier_id} className="panel opacity-60 flex items-center justify-between">
                  <span className="text-ed-muted text-xs font-mono">
                    {c.name || c.callsign || `Carrier #${c.carrier_id}`}
                    {c.location ? ` · ${c.location}` : ''}
                  </span>
                  <button
                    className="text-ed-orange text-xs font-mono hover:underline shrink-0"
                    onClick={() => restore(c.carrier_id)}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ---- Tab: Route Planner / Tritium Calculator ----

function RoutePlannerTab() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tritiumPerJump, setTritiumPerJump] = useState(50)
  const [currentTritium, setCurrentTritium] = useState('')

  async function plan() {
    if (!origin.trim() || !destination.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api()?.plan_fc_route(origin.trim(), destination.trim())
      if (data?.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setError('Route planning failed. Check system names and try again.')
    }
    setLoading(false)
  }

  const totalTritiumEstimate = result ? result.total_jumps * tritiumPerJump : 0
  const stock = parseInt(currentTritium, 10)
  const hasEnough = !isNaN(stock) && stock >= totalTritiumEstimate
  const deficit = !isNaN(stock) ? totalTritiumEstimate - stock : 0

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Plan a Fleet Carrier jump route via Spansh and estimate tritium requirements.
      </p>

      <div className="panel mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            className="input font-mono text-sm flex-1"
            placeholder="Origin system (e.g. Sol)"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && plan()}
          />
          <input
            className="input font-mono text-sm flex-1"
            placeholder="Destination system (e.g. Colonia)"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && plan()}
          />
          <button
            className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={plan}
            disabled={loading || !origin.trim() || !destination.trim()}
          >
            {loading ? 'Planning…' : 'Plan Route'}
          </button>
        </div>
      </div>

      {error && <p className="text-ed-danger text-sm font-mono mb-3">{error}</p>}

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="panel text-center">
              <p className="text-ed-muted text-xs font-mono mb-1">Total Jumps</p>
              <p className="text-ed-orange text-2xl font-semibold font-ui">{result.total_jumps}</p>
            </div>
            <div className="panel text-center">
              <p className="text-ed-muted text-xs font-mono mb-1">Total Distance</p>
              <p className="text-ed-orange text-2xl font-semibold font-ui">
                {result.total_distance?.toLocaleString()} ly
              </p>
            </div>
            <div className="panel text-center">
              <p className="text-ed-muted text-xs font-mono mb-1">Tritium Estimate</p>
              <p className="text-ed-orange text-2xl font-semibold font-ui">
                {totalTritiumEstimate.toLocaleString()} T
              </p>
            </div>
          </div>

          <div className="panel mb-4">
            <p className="text-ed-text font-semibold mb-3">Fuel Planning</p>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-32">
                <label className="text-ed-muted text-xs font-mono block mb-1">
                  T per jump estimate
                </label>
                <input
                  type="number"
                  className="input font-mono text-sm"
                  value={tritiumPerJump}
                  min={1}
                  max={1000}
                  onChange={e => setTritiumPerJump(Math.max(1, parseInt(e.target.value, 10) || 50))}
                />
              </div>
              <div className="flex-1 min-w-32">
                <label className="text-ed-muted text-xs font-mono block mb-1">
                  Current tritium stock (T)
                </label>
                <input
                  type="number"
                  className="input font-mono text-sm"
                  placeholder="e.g. 750"
                  value={currentTritium}
                  min={0}
                  max={1000}
                  onChange={e => setCurrentTritium(e.target.value)}
                />
              </div>
              {currentTritium !== '' && !isNaN(stock) && (
                <div className="panel flex-1 min-w-32 text-center">
                  {hasEnough ? (
                    <>
                      <p className="text-ed-success font-semibold">ENOUGH</p>
                      <p className="text-ed-muted text-xs font-mono">
                        +{(stock - totalTritiumEstimate).toLocaleString()} T remaining
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-ed-danger font-semibold">SHORT</p>
                      <p className="text-ed-muted text-xs font-mono">
                        Need {deficit.toLocaleString()} T more
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-ed-muted text-xs font-mono mt-2">
              Tritium cost varies by jump distance (~0.1 T/ly typical). Adjust the estimate based on your experience.
            </p>
          </div>

          {result.jumps?.length > 0 && (
            <div className="panel overflow-x-auto">
              <p className="text-ed-text font-semibold mb-3">Route ({result.total_jumps} jumps)</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                    <th className="text-left pb-2 pr-4">#</th>
                    <th className="text-left pb-2 pr-4">System</th>
                    <th className="text-right pb-2">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.jumps.map((j, i) => (
                    <tr key={i} className="border-b border-ed-border/40">
                      <td className="py-1 pr-4 font-mono text-ed-muted text-xs">{i + 1}</td>
                      <td className="py-1 pr-4 font-mono text-ed-text">
                        {j.system ?? j.name ?? '—'}
                      </td>
                      <td className="py-1 text-right font-mono text-ed-muted">
                        {j.distance_jumped != null
                          ? `${j.distance_jumped.toFixed(1)} ly`
                          : j.distance != null
                          ? `${j.distance.toFixed(1)} ly`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'stats',   label: 'My Carrier' },
  { id: 'route',   label: 'Route Planner' },
  { id: 'visited', label: 'Visited Carriers' },
]

export default function FleetCarriers() {
  const [tab, setTab] = useState('stats')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Fleet Carriers</h1>
      <p className="text-ed-muted text-sm mb-5">Stats, fuel, and route planning.</p>

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

      {tab === 'stats'   && <StatsTab />}
      {tab === 'route'   && <RoutePlannerTab />}
      {tab === 'visited' && <VisitedTab />}
    </div>
  )
}
