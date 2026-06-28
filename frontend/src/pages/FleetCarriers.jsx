import { useState, useEffect, useRef } from 'react'

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

  if (carriers.length === 0) {
    return (
      <div className="panel">
        <p className="text-ed-muted text-sm">No carrier data yet.</p>
        <p className="text-ed-muted text-xs font-mono mt-1">
          Open Carrier Management in-game to populate carrier stats.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {carriers.map(c => {
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

            <p className="text-ed-muted text-[10px] font-mono mt-3">
              Updated: {c.updated}
            </p>
          </div>
        )
      })}
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

// ---- Tab: Auto-Jump ----

function AutoJumpTab() {
  const [tosAccepted, setTosAccepted] = useState(false)
  const [status, setStatus] = useState({ active: false, key: 'j', delay: 10 })
  const [key, setKey] = useState('j')
  const [delay, setDelay] = useState(10)
  const [lastEvent, setLastEvent] = useState('')
  const [countdown, setCountdown] = useState(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    api()?.get_auto_jump_status().then(s => {
      if (s) {
        setStatus(s)
        setKey(s.key ?? 'j')
        setDelay(s.delay ?? 10)
      }
    })
  }, [])

  useEffect(() => {
    const off1 = window.__edtc?.on('auto_jump_status', s => setStatus(s ?? {}))
    const off2 = window.__edtc?.on('auto_jump_countdown', payload => {
      setLastEvent(`Jumping to ${payload.next_system} in ${payload.seconds}s…`)
      setCountdown(payload.seconds)
      if (countdownRef.current) clearInterval(countdownRef.current)
      let remaining = payload.seconds
      countdownRef.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) clearInterval(countdownRef.current)
      }, 1000)
    })
    const off3 = window.__edtc?.on('auto_jump_fired', payload => {
      setLastEvent(`Key "${payload.key}" sent → ${payload.next_system}`)
      setCountdown(null)
      if (countdownRef.current) clearInterval(countdownRef.current)
    })
    const off4 = window.__edtc?.on('auto_jump_error', payload => {
      setLastEvent(`Error: ${payload.error}`)
    })
    const off5 = window.__edtc?.on('auto_jump_complete', () => {
      setLastEvent('Route complete — auto-jump stopped.')
      setStatus(s => ({ ...s, active: false }))
    })
    return () => { off1?.(); off2?.(); off3?.(); off4?.(); off5?.() }
  }, [])

  async function start() {
    const s = await api()?.start_auto_jump(key, parseInt(delay, 10))
    if (s) setStatus(s)
  }

  async function stop() {
    const s = await api()?.stop_auto_jump()
    if (s) setStatus(s)
    setCountdown(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  if (!tosAccepted) {
    return (
      <div className="panel border border-ed-danger/60">
        <div className="flex items-start gap-3">
          <span className="text-ed-danger text-xl mt-0.5">⚠</span>
          <div>
            <h2 className="text-ed-danger font-semibold mb-2">
              Auto-Jump — Frontier ToS Warning
            </h2>
            <p className="text-ed-text text-sm mb-2">
              This feature automates in-game keypresses to initiate FSD jumps.
              Frontier Developments may consider this a violation of the{' '}
              <strong>Elite Dangerous Terms of Service</strong>, which could
              result in your account being suspended or banned.
            </p>
            <p className="text-ed-text text-sm mb-4">
              It requires an active route set in the{' '}
              <span className="text-ed-orange font-mono">Navigation</span> page.
              The game window must be in focus when the keypress fires.
            </p>
            <button
              className="btn border border-ed-danger text-ed-danger hover:bg-ed-danger hover:text-black"
              onClick={() => setTosAccepted(true)}
            >
              I understand and accept the risk
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-ed-text font-semibold">Auto-Jump</h2>
            <p className="text-ed-muted text-xs font-mono mt-0.5">
              Requires an active route in Navigation. Game must be in focus.
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-mono border ${
            status.active
              ? 'border-ed-success text-ed-success'
              : 'border-ed-border text-ed-muted'
          }`}>
            {status.active ? 'ACTIVE' : 'INACTIVE'}
          </div>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-28">
            <label className="text-ed-muted text-xs font-mono block mb-1">Jump key</label>
            <input
              className="input font-mono text-sm"
              value={key}
              maxLength={10}
              onChange={e => setKey(e.target.value)}
              disabled={status.active}
              placeholder="j"
            />
          </div>
          <div className="flex-1 min-w-28">
            <label className="text-ed-muted text-xs font-mono block mb-1">
              Delay after jump (seconds)
            </label>
            <input
              type="number"
              className="input font-mono text-sm"
              value={delay}
              min={3}
              max={120}
              onChange={e => setDelay(e.target.value)}
              disabled={status.active}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {!status.active ? (
            <button className="btn-primary" onClick={start}>
              Start Auto-Jump
            </button>
          ) : (
            <button
              className="btn border border-ed-danger text-ed-danger hover:bg-ed-danger hover:text-black"
              onClick={stop}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {(lastEvent || countdown != null) && (
        <div className="panel">
          <p className="text-ed-muted text-xs font-mono mb-1">Status</p>
          {countdown != null && countdown > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-ed-text">Next jump in</span>
                <span className="text-ed-orange">{countdown}s</span>
              </div>
              <Bar pct={((delay - countdown) / delay) * 100} />
            </div>
          )}
          {lastEvent && (
            <p className="text-ed-text text-sm font-mono">{lastEvent}</p>
          )}
        </div>
      )}

      <div className="panel border border-ed-danger/30">
        <p className="text-ed-muted text-xs font-mono mb-1">How it works</p>
        <ul className="text-ed-muted text-xs space-y-1 list-disc list-inside">
          <li>Watches for FSDJump journal events on your active route</li>
          <li>After each jump, waits the configured delay, then sends the key</li>
          <li>Stops automatically when the route is complete</li>
          <li>The game window must be in focus — keys go to the active window</li>
          <li>Default key <span className="font-mono text-ed-orange">J</span> = engage FSD (standard ED binding)</li>
        </ul>
      </div>
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'stats',  label: 'Carrier Stats' },
  { id: 'route',  label: 'Route Planner' },
  { id: 'jump',   label: 'Auto-Jump' },
]

export default function FleetCarriers() {
  const [tab, setTab] = useState('stats')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Fleet Carriers</h1>
      <p className="text-ed-muted text-sm mb-5">Stats, fuel, route planning, and automation.</p>

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

      {tab === 'stats' && <StatsTab />}
      {tab === 'route' && <RoutePlannerTab />}
      {tab === 'jump' && <AutoJumpTab />}
    </div>
  )
}
