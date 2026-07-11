import { useState, useEffect, useRef } from 'react'

const api = () => window?.pywebview?.api

// ---- Helpers ----

function fmtCr(n) {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

function fmtDuration(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function EmptyState({ message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

function ErrorBanner({ error }) {
  return (
    <div className="panel border border-ed-danger/30 mb-3">
      <p className="text-ed-danger text-sm font-mono">{error}</p>
    </div>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="text-ed-muted hover:text-ed-orange transition-colors text-xs shrink-0"
      title={`Copy "${text}"`}
      onClick={() => {
        api()?.copy_to_clipboard(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
            value === o
              ? 'border-ed-orange text-ed-orange bg-ed-orange/10'
              : 'border-ed-border text-ed-muted hover:text-ed-text hover:border-ed-orange/40'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ---- Constants ----

// The 13 commodities that occur as ring hotspots (post-3.3 mining)
const HOTSPOT_COMMODITIES = [
  'Platinum', 'Painite', 'Low Temperature Diamonds', 'Void Opals', 'Tritium',
  'Alexandrite', 'Benitoite', 'Bromellite', 'Grandidierite', 'Monazite',
  'Musgravite', 'Rhodplumsite', 'Serendibite',
]

const RING_TYPES = ['Any', 'Icy', 'Rocky', 'Metal Rich', 'Metallic']
const RESERVES = ['Any', 'Pristine', 'Major', 'Common']
const MIN_HOTSPOTS = ['Any', '2+', '3+']

// Powerplay 2.0 roster
const POWERS = [
  'Aisling Duval', 'Archon Delaine', 'Arissa Lavigny-Duval', 'Denton Patreus',
  'Edmund Mahon', 'Felicia Winters', 'Jerome Archer', 'Li Yong-Rui',
  'Nakato Kaine', 'Pranav Antal', 'Yuri Grom', 'Zemina Torval',
]

const RING_TYPE_COLOR = {
  Icy: 'text-cyan-400', Rocky: 'text-amber-500',
  'Metal Rich': 'text-orange-400', Metallic: 'text-yellow-300',
}

const STATE_COLOR = {
  Stronghold: 'text-purple-400', Fortified: 'text-blue-400',
  Exploited: 'text-teal-400', Unoccupied: 'text-ed-muted',
}

// ---- Shared result tables ----

function RingTable({ rows }) {
  const [expanded, setExpanded] = useState(null)
  if (rows.length === 0) return <EmptyState message="No hotspot rings found — try widening the filters." />
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-ed-muted uppercase tracking-wider text-[10px] border-b border-ed-border">
            <th className="text-left px-3 py-2">System</th>
            <th className="text-left px-3 py-2">Ring</th>
            <th className="text-left px-3 py-2">Type</th>
            <th className="text-left px-3 py-2">Reserves</th>
            <th className="text-right px-3 py-2">Hotspots</th>
            <th className="text-right px-3 py-2">Dist (ly)</th>
            <th className="text-right px-3 py-2">Arrival (ls)</th>
            <th className="text-right px-3 py-2">Signals scanned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <RowPair key={`${r.ring}-${i}`} r={r} expanded={expanded === i}
                     onToggle={() => setExpanded(expanded === i ? null : i)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowPair({ r, expanded, onToggle }) {
  return (
    <>
      <tr
        className="border-b border-ed-border/40 hover:bg-ed-dark/60 cursor-pointer"
        onClick={onToggle}
        title="Click to show all hotspots in this ring"
      >
        <td className="px-3 py-1.5 text-ed-text whitespace-nowrap">
          <span className="mr-1.5">{r.system}</span>
          <CopyBtn text={r.system} />
        </td>
        <td className="px-3 py-1.5 text-ed-muted whitespace-nowrap">{r.ring.replace(`${r.system} `, '')}</td>
        <td className={`px-3 py-1.5 whitespace-nowrap ${RING_TYPE_COLOR[r.ring_type] ?? 'text-ed-muted'}`}>{r.ring_type}</td>
        <td className={`px-3 py-1.5 ${r.reserve === 'Pristine' ? 'text-ed-success' : 'text-ed-muted'}`}>{r.reserve || '—'}</td>
        <td className="px-3 py-1.5 text-right text-ed-orange font-semibold">{'●'.repeat(Math.min(r.count, 4))} {r.count}</td>
        <td className="px-3 py-1.5 text-right text-ed-text">{r.distance}</td>
        <td className="px-3 py-1.5 text-right text-ed-muted">{fmtNum(r.arrival_ls)}</td>
        <td className="px-3 py-1.5 text-right text-ed-muted">{r.updated || '—'}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-ed-border/40 bg-ed-dark/40">
          <td colSpan={8} className="px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {(r.signals ?? []).map(s => (
                <span key={s.name} className="px-2 py-0.5 rounded border border-ed-border text-[11px] text-ed-text">
                  {s.name} <span className="text-ed-orange font-semibold">×{s.count}</span>
                </span>
              ))}
              {r.power && (
                <span className="px-2 py-0.5 rounded border border-purple-400/40 text-[11px] text-purple-400">
                  {r.power} · {r.power_state}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function StationTable({ rows, hideCarriers }) {
  const filtered = hideCarriers ? rows.filter(r => !r.is_carrier) : rows
  if (filtered.length === 0) return <EmptyState message="No stations buying this commodity matched the filters." />
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-ed-muted uppercase tracking-wider text-[10px] border-b border-ed-border">
            <th className="text-left px-3 py-2">Station</th>
            <th className="text-left px-3 py-2">System</th>
            <th className="text-right px-3 py-2">Sell (cr)</th>
            <th className="text-right px-3 py-2">Demand</th>
            <th className="text-center px-3 py-2">Pad</th>
            <th className="text-right px-3 py-2">Dist (ly)</th>
            <th className="text-right px-3 py-2">Arrival (ls)</th>
            <th className="text-right px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s, i) => (
            <tr key={`${s.station}-${i}`} className="border-b border-ed-border/40 hover:bg-ed-dark/60">
              <td className="px-3 py-1.5 text-ed-text whitespace-nowrap">
                {s.station}
                {s.is_carrier && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-ed-border text-ed-muted">FC</span>}
                {s.is_planetary && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-ed-border text-ed-muted">SURFACE</span>}
              </td>
              <td className="px-3 py-1.5 text-ed-muted whitespace-nowrap">
                <span className="mr-1.5">{s.system}</span>
                <CopyBtn text={s.system} />
              </td>
              <td className="px-3 py-1.5 text-right text-ed-success font-semibold">{fmtNum(s.sell_price)}</td>
              <td className="px-3 py-1.5 text-right text-ed-text">{fmtNum(s.demand)}</td>
              <td className="px-3 py-1.5 text-center">{s.has_large_pad ? <span className="text-ed-success">L</span> : <span className="text-ed-muted">M</span>}</td>
              <td className="px-3 py-1.5 text-right text-ed-text">{s.distance}</td>
              <td className="px-3 py-1.5 text-right text-ed-muted">{fmtNum(s.arrival_ls)}</td>
              <td className="px-3 py-1.5 text-right text-ed-muted">{s.updated || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Tab: Hotspot Finder ----

function HotspotsTab({ currentSystem }) {
  const [commodity, setCommodity] = useState('Platinum')
  const [system, setSystem] = useState(currentSystem ?? '')
  const [ringType, setRingType] = useState('Any')
  const [reserve, setReserve] = useState('Any')
  const [minHotspots, setMinHotspots] = useState('Any')
  const [hideCarriers, setHideCarriers] = useState(true)
  const [minDemand, setMinDemand] = useState('100')
  const [loading, setLoading] = useState(false)
  const [rings, setRings] = useState(null)
  const [stations, setStations] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (currentSystem && !system) setSystem(currentSystem)
  }, [currentSystem])

  async function doSearch() {
    const sys = system.trim()
    if (!sys || !commodity) return
    setLoading(true); setError(null); setRings(null); setStations(null)
    const ringOpts = { size: 50 }
    if (ringType !== 'Any') ringOpts.ring_types = [ringType]
    if (reserve !== 'Any')  ringOpts.reserve_levels = [reserve]
    const sellOpts = { min_demand: parseInt(minDemand) || 0, size: 40 }
    const [ringRes, sellRes] = await Promise.all([
      api()?.search_ring_hotspots(sys, commodity, ringOpts),
      api()?.search_mining_sell(sys, commodity, sellOpts),
    ])
    if (ringRes?.error && sellRes?.error) {
      setError(`Search failed: ${ringRes.error}`)
    } else {
      const minCount = minHotspots === 'Any' ? 1 : parseInt(minHotspots)
      setRings((ringRes?.results ?? []).filter(r => r.count >= minCount))
      setStations(sellRes?.results ?? [])
      if (ringRes?.error) setError(`Hotspot search failed: ${ringRes.error}`)
      else if (sellRes?.error) setError(`Sell-station search failed: ${sellRes.error}`)
    }
    setLoading(false)
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-3">
        Find hotspot rings for a mining commodity near a reference system, plus the best places to sell.
        Hotspot data comes from Spansh (player DSS scans) — unscanned rings won't appear.
      </p>

      <div className="panel mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-ed-muted text-xs font-mono mb-1">Commodity</label>
            <select value={commodity} onChange={e => setCommodity(e.target.value)}
                    className="bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60">
              {HOTSPOT_COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-ed-muted text-xs font-mono mb-1">Reference system</label>
            <input type="text" value={system} onChange={e => setSystem(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && doSearch()}
                   placeholder="e.g. current system"
                   className="w-full bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60" />
          </div>
          <button onClick={doSearch} disabled={loading || !system.trim()}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <span className="block text-ed-muted text-xs font-mono mb-1">Ring type</span>
            <Chips options={RING_TYPES} value={ringType} onChange={setRingType} />
          </div>
          <div>
            <span className="block text-ed-muted text-xs font-mono mb-1">Reserves</span>
            <Chips options={RESERVES} value={reserve} onChange={setReserve} />
          </div>
          <div>
            <span className="block text-ed-muted text-xs font-mono mb-1">Hotspots in ring</span>
            <Chips options={MIN_HOTSPOTS} value={minHotspots} onChange={setMinHotspots} />
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {rings != null && (
        <>
          <h2 className="text-ed-orange font-ui font-semibold text-sm uppercase tracking-wider mb-2">
            Hotspot rings — {commodity} ({rings.length})
          </h2>
          <RingTable rows={rings} />

          <div className="flex items-center justify-between mt-6 mb-2">
            <h2 className="text-ed-orange font-ui font-semibold text-sm uppercase tracking-wider">
              Best sell prices — {commodity}
            </h2>
            <div className="flex items-center gap-4 text-xs font-mono text-ed-muted">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={hideCarriers} onChange={e => setHideCarriers(e.target.checked)}
                       className="accent-ed-orange" />
                Hide fleet carriers
              </label>
              <label className="flex items-center gap-1.5">
                Min demand
                <input type="number" value={minDemand} onChange={e => setMinDemand(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && doSearch()}
                       className="w-20 bg-ed-dark border border-ed-border rounded px-2 py-0.5 text-ed-text focus:outline-none focus:border-ed-orange/60" />
              </label>
            </div>
          </div>
          {stations != null && <StationTable rows={stations} hideCarriers={hideCarriers} />}
        </>
      )}
    </div>
  )
}

// ---- Tab: Merit Miner ----

const GOALS = [
  { id: 'reinforce', label: 'Reinforce', desc: 'Mine & sell inside systems your Power controls' },
  { id: 'undermine', label: 'Undermine', desc: 'Mine & sell inside systems controlled by rival Powers' },
  { id: 'acquire',   label: 'Acquire',   desc: 'Mine & sell in unoccupied systems (must be in your Power’s acquisition range — not validated here)' },
]

function MeritTab({ currentSystem }) {
  const [status, setStatus] = useState(null)
  const [power, setPower] = useState('')
  const [goal, setGoal] = useState('reinforce')
  const [commodity, setCommodity] = useState('Platinum')
  const [system, setSystem] = useState(currentSystem ?? '')
  const [loading, setLoading] = useState(false)
  const [combined, setCombined] = useState(null)   // systems with hotspot + buyer
  const [ringOnly, setRingOnly] = useState([])
  const [sellOnly, setSellOnly] = useState([])
  const [showRingOnly, setShowRingOnly] = useState(false)
  const [showSellOnly, setShowSellOnly] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api()?.get_powerplay_status().then(r => {
      setStatus(r ?? null)
      if (r?.power && POWERS.includes(r.power)) setPower(r.power)
      else setPower(POWERS[0])
    })
  }, [])

  useEffect(() => {
    const off = window.__edtc?.on('merits_update', payload => {
      setStatus(prev => prev ? { ...prev, merits: payload?.total ?? prev.merits } : prev)
    })
    return () => off?.()
  }, [])

  useEffect(() => {
    if (currentSystem && !system) setSystem(currentSystem)
  }, [currentSystem])

  async function doSearch() {
    const sys = system.trim()
    if (!sys || !commodity || !power) return
    setLoading(true); setError(null); setCombined(null)
    const opts = { size: 60 }
    if (goal === 'reinforce') opts.powers = [power]
    else if (goal === 'undermine') opts.powers = POWERS.filter(p => p !== power)
    else opts.power_states = ['Unoccupied']
    const [ringRes, sellRes] = await Promise.all([
      api()?.search_ring_hotspots(sys, commodity, opts),
      api()?.search_mining_sell(sys, commodity, { ...opts, min_demand: 1 }),
    ])
    if (ringRes?.error || sellRes?.error) {
      setError(ringRes?.error || sellRes?.error)
      setLoading(false)
      return
    }
    const rings = ringRes?.results ?? []
    const stations = (sellRes?.results ?? []).filter(s => !s.is_carrier)

    // join by system: best ring (most hotspots) + best buyer (highest price)
    const bySystem = {}
    for (const r of rings) {
      const key = r.system.toLowerCase()
      if (!bySystem[key] || r.count > bySystem[key].ring.count) {
        bySystem[key] = { ...bySystem[key], system: r.system, distance: r.distance, ring: r }
      }
    }
    const matched = new Set()
    for (const s of stations) {
      const key = s.system.toLowerCase()
      if (bySystem[key]) {
        if (!bySystem[key].station || s.sell_price > bySystem[key].station.sell_price) {
          bySystem[key].station = s
        }
        matched.add(key)
      }
    }
    const rows = Object.values(bySystem).filter(r => r.station)
      .sort((a, b) => a.distance - b.distance)
    setCombined(rows)
    setRingOnly(Object.values(bySystem).filter(r => !r.station).sort((a, b) => a.distance - b.distance))
    setSellOnly(stations.filter(s => !matched.has(s.system.toLowerCase())))
    setLoading(false)
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-3">
        Powerplay merit mining: find systems where a commodity spawns in a hotspot <em>and</em> a station
        in the same system buys it — mine and sell without leaving the system. Merits from selling mined
        goods scale with sale value.
      </p>

      {status?.power && (
        <div className="panel mb-4 flex items-center gap-4 text-sm font-mono">
          <span className="text-purple-400 font-semibold">{status.power}</span>
          <span className="text-ed-muted">Rating {status.rank || 0}</span>
          <span className="text-ed-muted">{fmtNum(status.merits)} merits</span>
        </div>
      )}

      <div className="panel mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-ed-muted text-xs font-mono mb-1">Your Power</label>
            <select value={power} onChange={e => setPower(e.target.value)}
                    className="bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60">
              {POWERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-ed-muted text-xs font-mono mb-1">Commodity</label>
            <select value={commodity} onChange={e => setCommodity(e.target.value)}
                    className="bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60">
              {HOTSPOT_COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-ed-muted text-xs font-mono mb-1">Reference system</label>
            <input type="text" value={system} onChange={e => setSystem(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && doSearch()}
                   className="w-full bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60" />
          </div>
          <button onClick={doSearch} disabled={loading || !system.trim()}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div>
          <span className="block text-ed-muted text-xs font-mono mb-1">Goal</span>
          <div className="flex flex-wrap gap-1">
            {GOALS.map(g => (
              <button key={g.id} onClick={() => setGoal(g.id)} title={g.desc}
                      className={`px-3 py-1 rounded text-xs font-mono border transition-colors ${
                        goal === g.id
                          ? 'border-purple-400 text-purple-400 bg-purple-400/10'
                          : 'border-ed-border text-ed-muted hover:text-ed-text'
                      }`}>
                {g.label}
              </button>
            ))}
          </div>
          <p className="text-ed-muted text-xs mt-1">{GOALS.find(g => g.id === goal)?.desc}</p>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {combined != null && (
        <>
          <h2 className="text-ed-orange font-ui font-semibold text-sm uppercase tracking-wider mb-2">
            Mine &amp; sell in the same system ({combined.length})
          </h2>
          {combined.length === 0 ? (
            <EmptyState message="No system has both a scanned hotspot and a buyer for this goal — check the hotspot-only and buyer-only lists below." />
          ) : (
            <div className="panel overflow-x-auto p-0">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-ed-muted uppercase tracking-wider text-[10px] border-b border-ed-border">
                    <th className="text-left px-3 py-2">System</th>
                    <th className="text-left px-3 py-2">Power state</th>
                    <th className="text-left px-3 py-2">Best ring</th>
                    <th className="text-right px-3 py-2">Hotspots</th>
                    <th className="text-left px-3 py-2">Sell at</th>
                    <th className="text-right px-3 py-2">Sell (cr)</th>
                    <th className="text-right px-3 py-2">Demand</th>
                    <th className="text-center px-3 py-2">Pad</th>
                    <th className="text-right px-3 py-2">Dist (ly)</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map(row => (
                    <tr key={row.system} className="border-b border-ed-border/40 hover:bg-ed-dark/60">
                      <td className="px-3 py-1.5 text-ed-text whitespace-nowrap">
                        <span className="mr-1.5">{row.system}</span>
                        <CopyBtn text={row.system} />
                      </td>
                      <td className={`px-3 py-1.5 whitespace-nowrap ${STATE_COLOR[row.ring.power_state] ?? 'text-ed-muted'}`}>
                        {goal === 'undermine' && row.ring.power ? `${row.ring.power} · ` : ''}{row.ring.power_state ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-ed-muted whitespace-nowrap">
                        {row.ring.ring.replace(`${row.system} `, '')}
                        <span className={`ml-1.5 ${RING_TYPE_COLOR[row.ring.ring_type] ?? ''}`}>{row.ring.ring_type}</span>
                        {row.ring.reserve === 'Pristine' && <span className="ml-1.5 text-ed-success">Pristine</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-ed-orange font-semibold">{row.ring.count}</td>
                      <td className="px-3 py-1.5 text-ed-text whitespace-nowrap">
                        {row.station.station}
                        {row.station.is_planetary && <span className="ml-1 text-[9px] px-1 rounded bg-ed-border text-ed-muted">SURFACE</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-ed-success font-semibold">{fmtNum(row.station.sell_price)}</td>
                      <td className="px-3 py-1.5 text-right text-ed-text">{fmtNum(row.station.demand)}</td>
                      <td className="px-3 py-1.5 text-center">{row.station.has_large_pad ? <span className="text-ed-success">L</span> : <span className="text-ed-muted">M</span>}</td>
                      <td className="px-3 py-1.5 text-right text-ed-text">{row.distance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {ringOnly.length > 0 && (
              <div>
                <button onClick={() => setShowRingOnly(v => !v)}
                        className="text-xs font-mono text-ed-muted hover:text-ed-text">
                  {showRingOnly ? '▾' : '▸'} {ringOnly.length} systems with hotspots but no buyer
                </button>
                {showRingOnly && (
                  <div className="mt-2">
                    <RingTable rows={ringOnly.map(r => r.ring)} />
                  </div>
                )}
              </div>
            )}
            {sellOnly.length > 0 && (
              <div>
                <button onClick={() => setShowSellOnly(v => !v)}
                        className="text-xs font-mono text-ed-muted hover:text-ed-text">
                  {showSellOnly ? '▾' : '▸'} {sellOnly.length} buyers with no scanned hotspot in-system
                </button>
                {showSellOnly && (
                  <div className="mt-2">
                    <StationTable rows={sellOnly} hideCarriers={false} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---- Tab: Session Tracker ----

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="panel text-center">
      <p className="text-ed-muted text-[10px] font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-mono text-xl font-bold ${accent ?? 'text-ed-text'}`}>{value}</p>
      {sub && <p className="text-ed-muted text-[10px] font-mono mt-0.5">{sub}</p>}
    </div>
  )
}

function SessionTab() {
  const [session, setSession] = useState(null)
  const receivedAt = useRef(Date.now())
  const [, forceTick] = useState(0)

  useEffect(() => {
    api()?.get_mining_session().then(s => { receivedAt.current = Date.now(); setSession(s ?? null) })
    const off = window.__edtc?.on('mining_update', payload => {
      receivedAt.current = Date.now()
      setSession(payload ?? null)
    })
    const t = setInterval(() => forceTick(n => n + 1), 1000)
    return () => { off?.(); clearInterval(t) }
  }, [])

  async function reset() {
    const s = await api()?.reset_mining_session()
    receivedAt.current = Date.now()
    setSession(s ?? null)
  }

  if (!session?.active) {
    return (
      <div>
        <p className="text-ed-muted text-sm mb-3">
          Live session stats from the journal — starts automatically on your first prospector limpet,
          refined tonne, or cracked asteroid with EDTC running.
        </p>
        <EmptyState message="No mining activity yet this session. Fire a prospector limpet to start tracking." />
      </div>
    )
  }

  const liveDuration = session.duration + Math.floor((Date.now() - receivedAt.current) / 1000)
  const totalProspects = session.content.High + session.content.Medium + session.content.Low

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-ed-muted text-sm">
          Live journal-tracked session. Value estimated at galactic average prices.
        </p>
        <button onClick={reset} className="btn-ghost text-xs text-ed-danger shrink-0">Reset session</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Duration" value={fmtDuration(liveDuration)} />
        <StatCard label="Refined" value={`${session.total_tons}T`} accent="text-ed-orange"
                  sub={session.tons_per_hour != null ? `${session.tons_per_hour} T/hr` : null} />
        <StatCard label="Est. value" value={`${fmtCr(session.est_value)} cr`} accent="text-ed-success"
                  sub={session.tons_per_hour != null && session.total_tons > 0
                    ? `~${fmtCr(Math.round(session.est_value / session.total_tons * session.tons_per_hour))} cr/hr` : null} />
        <StatCard label="Merits" value={fmtNum(session.merits)} accent="text-purple-400"
                  sub={session.merits_per_hour != null ? `${fmtNum(session.merits_per_hour)}/hr` : null} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Refined breakdown */}
        <div>
          <h2 className="text-ed-orange font-ui font-semibold text-sm uppercase tracking-wider mb-2">Refined</h2>
          {session.refined.length === 0 ? (
            <EmptyState message="Nothing refined yet." />
          ) : (
            <div className="panel p-0 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-ed-muted uppercase tracking-wider text-[10px] border-b border-ed-border">
                    <th className="text-left px-3 py-2">Commodity</th>
                    <th className="text-right px-3 py-2">Tonnes</th>
                    <th className="text-right px-3 py-2">Est. value</th>
                  </tr>
                </thead>
                <tbody>
                  {session.refined.map(r => (
                    <tr key={r.name} className="border-b border-ed-border/40">
                      <td className="px-3 py-1.5 text-ed-text">{r.name}</td>
                      <td className="px-3 py-1.5 text-right text-ed-orange font-semibold">{r.tons}</td>
                      <td className="px-3 py-1.5 text-right text-ed-success">{fmtCr(r.value)} cr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Prospecting */}
        <div>
          <h2 className="text-ed-orange font-ui font-semibold text-sm uppercase tracking-wider mb-2">Prospecting</h2>
          <div className="panel space-y-3">
            <div className="flex items-center justify-between text-sm font-mono">
              <span className="text-ed-muted">Asteroids prospected</span>
              <span className="text-ed-text font-semibold">{session.prospected}</span>
            </div>
            {session.cracked > 0 && (
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="text-ed-muted">Cores cracked</span>
                <span className="text-yellow-400 font-semibold">{session.cracked}</span>
              </div>
            )}
            {totalProspects > 0 && (
              <div>
                <div className="flex h-2 rounded-full overflow-hidden bg-ed-border">
                  <div className="bg-ed-success" style={{ width: `${session.content.High / totalProspects * 100}%` }} />
                  <div className="bg-yellow-400" style={{ width: `${session.content.Medium / totalProspects * 100}%` }} />
                  <div className="bg-ed-border" style={{ width: `${session.content.Low / totalProspects * 100}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-ed-muted mt-1">
                  <span className="text-ed-success">High {session.content.High}</span>
                  <span className="text-yellow-400">Med {session.content.Medium}</span>
                  <span>Low {session.content.Low}</span>
                </div>
              </div>
            )}
            {Object.keys(session.motherlodes ?? {}).length > 0 && (
              <div>
                <p className="text-ed-muted text-[10px] font-mono uppercase tracking-wider mb-1">Motherlodes found</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(session.motherlodes).map(([name, count]) => (
                    <span key={name} className="px-2 py-0.5 rounded border border-yellow-400/40 text-yellow-400 text-[11px] font-mono">
                      ◆ {name} ×{count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {session.last_prospect && (
              <div className="border-t border-ed-border/40 pt-2">
                <p className="text-ed-muted text-[10px] font-mono uppercase tracking-wider mb-1">
                  Last prospect — {session.last_prospect.content || '?'} content
                  {session.last_prospect.remaining < 100 && ` · ${session.last_prospect.remaining}% remaining`}
                </p>
                {session.last_prospect.motherlode && (
                  <p className="text-yellow-400 text-xs font-mono font-semibold mb-1">◆ Core: {session.last_prospect.motherlode}</p>
                )}
                {(session.last_prospect.materials ?? []).map(m => (
                  <div key={m.name} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-ed-text">{m.name}</span>
                    <span className="text-ed-muted">{m.proportion}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'hotspots', label: 'Hotspot Finder' },
  { id: 'merit',    label: 'Merit Miner' },
  { id: 'session',  label: 'Session Tracker' },
]

export default function Mining() {
  const [tab, setTab] = useState('hotspots')
  const [currentSystem, setCurrentSystem] = useState('')

  useEffect(() => {
    api()?.get_current_system().then(s => setCurrentSystem(s ?? ''))
  }, [])

  useEffect(() => {
    const off = window.__edtc?.on('system_changed', payload => {
      setCurrentSystem(payload?.system ?? '')
    })
    return () => off?.()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Mining</h1>
      <p className="text-ed-muted text-sm mb-5">Hotspot finder, Powerplay merit mining, and a live session tracker.</p>

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

      {tab === 'hotspots' && <HotspotsTab currentSystem={currentSystem} />}
      {tab === 'merit'    && <MeritTab currentSystem={currentSystem} />}
      {tab === 'session'  && <SessionTab />}
    </div>
  )
}
