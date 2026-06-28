import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Helpers ----

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

function fmtUnix(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

function EmptyState({ message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

function LoadingState() {
  return <p className="text-ed-muted text-sm font-mono">Loading…</p>
}

function ErrorState({ error }) {
  return (
    <div className="panel border border-ed-danger/30">
      <p className="text-ed-danger text-sm font-mono">{error}</p>
    </div>
  )
}

// ---- Tab: GalNet ----

function GalNetTab() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const r = await api()?.get_galnet()
    if (Array.isArray(r)) {
      setArticles(r)
    } else {
      setError(r?.error ?? 'Failed to load news')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">Live GalNet news feed via EDSM.</p>
        <button className="btn-ghost text-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {!loading && articles.length === 0 && !error && (
        <EmptyState message="No articles returned." />
      )}

      {!loading && articles.length > 0 && (
        <div className="space-y-2">
          {articles.map((a, i) => {
            const isOpen = expanded === i
            const content = (a.content ?? a.body ?? '').replace(/<[^>]+>/g, '').trim()
            return (
              <div key={a.id ?? i} className="panel">
                <button
                  className="w-full flex items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-ed-text font-semibold font-ui">{a.title}</p>
                    <p className="text-ed-muted text-xs font-mono mt-0.5">{fmtDate(a.date)}</p>
                  </div>
                  <span className="text-ed-muted text-xs shrink-0 mt-1">{isOpen ? '▲' : '▼'}</span>
                </button>

                {!isOpen && content && (
                  <p className="text-ed-muted text-sm mt-2 line-clamp-2">{content}</p>
                )}

                {isOpen && content && (
                  <div className="mt-3 border-t border-ed-border pt-3">
                    <p className="text-ed-text text-sm whitespace-pre-line">{content}</p>
                    {a.newsUrl && (
                      <p className="text-ed-muted text-xs font-mono mt-3">
                        Source: {a.newsUrl}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Factions ----

const ALLEGIANCE_COLORS = {
  Federation:       'border-blue-500/50 text-blue-400',
  Empire:           'border-purple-500/50 text-purple-400',
  Alliance:         'border-green-500/50 text-green-400',
  Independent:      'border-ed-border text-ed-muted',
  'Pilots Federation': 'border-ed-gold/50 text-ed-gold',
}

const STATE_COLORS = {
  Boom:           'border-green-500/50 text-green-400',
  Expansion:      'border-blue-500/50 text-blue-400',
  War:            'border-red-500/50 text-red-400',
  'Civil War':    'border-red-500/50 text-red-400',
  'Civil Unrest': 'border-yellow-500/50 text-yellow-400',
  Famine:         'border-orange-500/50 text-orange-400',
  Outbreak:       'border-orange-500/50 text-orange-400',
  Bust:           'border-yellow-500/50 text-yellow-400',
  Election:       'border-purple-500/50 text-purple-400',
  Investment:     'border-teal-500/50 text-teal-400',
  Retreat:        'border-red-600/50 text-red-500',
}

function StateChip({ state }) {
  const color = STATE_COLORS[state] ?? 'border-ed-border text-ed-muted'
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {state}
    </span>
  )
}

function FactionsTab({ currentSystem }) {
  const [query, setQuery] = useState(currentSystem ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (currentSystem && !query) setQuery(currentSystem)
  }, [currentSystem])

  async function doSearch(name) {
    const n = (name ?? query).trim()
    if (!n) return
    setLoading(true)
    setResult(null)
    const r = await api()?.get_system_factions(n)
    setResult(r)
    setLoading(false)
  }

  const factions = result?.factions
    ? [...result.factions].sort((a, b) => (b.influence ?? 0) - (a.influence ?? 0))
    : []

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1"
          placeholder="System name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
        {currentSystem && query !== currentSystem && (
          <button
            className="btn-ghost text-sm"
            onClick={() => { setQuery(currentSystem); doSearch(currentSystem) }}
          >
            Current
          </button>
        )}
      </div>

      {result?.error && <ErrorState error={result.error} />}

      {factions.length > 0 && (
        <div className="space-y-2">
          {result?.name && (
            <div className="flex items-center justify-between text-xs font-mono text-ed-muted mb-1">
              <span className="text-ed-orange font-semibold">{result.name}</span>
              {factions[0]?.lastUpdate && (
                <span>Updated {fmtUnix(factions[0].lastUpdate)}</span>
              )}
            </div>
          )}

          {factions.map(f => {
            const pct = Math.round((f.influence ?? 0) * 100)
            const allegColor = ALLEGIANCE_COLORS[f.allegiance] ?? ALLEGIANCE_COLORS.Independent
            const activeStates = f.activeStates?.map(s => s.state ?? s) ?? []
            const pendingStates = f.pendingStates?.map(s => s.state ?? s) ?? []

            return (
              <div key={f.id ?? f.name} className="panel">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ed-text font-semibold font-ui">{f.name}</span>
                      {f.isPlayer && (
                        <span className="text-xs font-mono text-ed-gold border border-ed-gold/40 px-1 rounded">
                          Player Faction
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 text-xs font-mono text-ed-muted mt-0.5">
                      {f.government && <span>{f.government}</span>}
                      {f.allegiance && (
                        <span className={allegColor.split(' ')[1]}>{f.allegiance}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold shrink-0 ${
                    pct >= 50 ? 'text-ed-orange' : 'text-ed-text'
                  }`}>
                    {pct}%
                  </span>
                </div>

                <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-ed-orange"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {(activeStates.length > 0 || pendingStates.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeStates.map(s => <StateChip key={s} state={s} />)}
                    {pendingStates.map(s => (
                      <span key={s} className="text-xs font-mono px-1.5 py-0.5 rounded border border-ed-border text-ed-muted opacity-60">
                        {s} (pending)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!result && !loading && (
        <EmptyState message="Enter a system name and press Search." />
      )}

      {result && factions.length === 0 && !result.error && (
        <EmptyState message="No faction data found for this system." />
      )}
    </div>
  )
}

// ---- Tab: Traffic ----

function TrafficTab({ currentSystem }) {
  const [query, setQuery] = useState(currentSystem ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (currentSystem && !query) setQuery(currentSystem)
  }, [currentSystem])

  async function doSearch(name) {
    const n = (name ?? query).trim()
    if (!n) return
    setLoading(true)
    setResult(null)
    const r = await api()?.get_system_traffic(n)
    setResult(r)
    setLoading(false)
  }

  const traffic = result?.traffic ?? {}
  const breakdown = result?.breakdown ?? {}
  const topShips = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
  const maxCount = topShips[0]?.[1] ?? 1

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1"
          placeholder="System name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
        {currentSystem && query !== currentSystem && (
          <button
            className="btn-ghost text-sm"
            onClick={() => { setQuery(currentSystem); doSearch(currentSystem) }}
          >
            Current
          </button>
        )}
      </div>

      {result?.error && <ErrorState error={result.error} />}

      {result && !result.error && (
        <div className="space-y-3">
          {result.name && (
            <p className="text-ed-orange font-semibold font-ui text-lg">{result.name}</p>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', val: traffic.total },
              { label: 'This Week', val: traffic.week },
              { label: 'Today', val: traffic.day },
            ].map(({ label, val }) => (
              <div key={label} className="panel text-center">
                <p className="text-ed-orange font-semibold font-mono text-xl">{fmtNum(val)}</p>
                <p className="text-ed-muted text-xs font-mono mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Ship breakdown */}
          {topShips.length > 0 && (
            <div className="panel">
              <p className="text-ed-muted text-xs font-mono uppercase tracking-wider mb-3">
                Ship Breakdown
              </p>
              <div className="space-y-2">
                {topShips.map(([ship, count]) => {
                  const pct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={ship}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-ed-text">{ship}</span>
                        <span className="text-ed-muted">{fmtNum(count)}</span>
                      </div>
                      <div className="h-1 bg-ed-dark rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-ed-orange"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState message="Enter a system name to see traffic data." />
      )}
    </div>
  )
}

// ---- Tab: Galaxy Stats ----

const STAT_ITEMS = [
  { key: 'commanders', label: 'Commanders Registered', icon: '👨‍✈️' },
  { key: 'systems',    label: 'Systems Discovered',    icon: '🌌' },
  { key: 'bodies',     label: 'Bodies Catalogued',     icon: '🪐' },
  { key: 'stations',   label: 'Stations Mapped',       icon: '🛸' },
  { key: 'logs',       label: 'CMDR Logs Submitted',   icon: '📋' },
]

function GalaxyStatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const r = await api()?.get_galaxy_stats()
    if (r?.error) {
      setError(r.error)
    } else {
      setStats(r)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">Universe statistics sourced from EDSM.</p>
        <button className="btn-ghost text-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {stats && !loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {STAT_ITEMS.map(({ key, label }) => {
              const val = stats[key]
              if (val == null) return null
              return (
                <div key={key} className="panel flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-ed-muted text-xs font-mono uppercase tracking-wider">{label}</p>
                    <p className="text-ed-orange font-semibold font-mono text-2xl mt-0.5">
                      {fmtNum(val)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {stats.date && (
            <p className="text-ed-muted text-xs font-mono text-right">
              Data as of {fmtDate(stats.date)}
            </p>
          )}

          {/* Show any extra fields not in STAT_ITEMS */}
          {Object.entries(stats)
            .filter(([k]) => !['commanders','systems','bodies','stations','logs','date','timestamp'].includes(k) && typeof stats[k] === 'number')
            .map(([k, v]) => (
              <div key={k} className="panel flex items-center justify-between">
                <p className="text-ed-muted text-sm font-mono capitalize">{k.replace(/_/g, ' ')}</p>
                <p className="text-ed-text font-mono font-semibold">{fmtNum(v)}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Community Goals ----

function CGProgressBar({ current, max, tier, maxTier }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-ed-muted">Tier {tier ?? '?'} / {maxTier ?? '?'}</span>
        <span className="text-ed-text">{pct}%</span>
      </div>
      <div className="h-2 bg-ed-dark rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-ed-orange transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs font-mono text-ed-muted mt-0.5">
        <span>{Number(current ?? 0).toLocaleString()}</span>
        <span>{Number(max ?? 0).toLocaleString()}</span>
      </div>
    </div>
  )
}

// ---- Tab: Powerplay ----

const POWERS = [
  { name: 'Aisling Duval',         allegiance: 'Empire',      home: 'Cubeo',         ethos: 'Patronage', perk: 'Prismatic Shield Generator' },
  { name: 'Archon Delaine',        allegiance: 'Independent', home: 'Harma',         ethos: 'Anarchy',   perk: 'Enforcer Cannon' },
  { name: 'Arissa Lavigny-Duval',  allegiance: 'Empire',      home: 'Kamadhenu',     ethos: 'Law',       perk: 'Pacifier Frag-Cannon' },
  { name: 'Denton Patreus',        allegiance: 'Empire',      home: 'Eotienses',     ethos: 'Military',  perk: 'Incendiary Rounds (laser mod)' },
  { name: 'Edmund Mahon',          allegiance: 'Alliance',    home: 'Gateway',       ethos: 'Trade',     perk: 'Trade bonus in controlled systems' },
  { name: 'Felicia Winters',       allegiance: 'Federation',  home: 'Rhea',          ethos: 'Welfare',   perk: 'Manifest Scanner' },
  { name: 'Li Yong-Rui',          allegiance: 'Independent', home: 'Lembava',       ethos: 'Corporate', perk: 'Discounted outfitting in SiriusGov systems' },
  { name: 'Pranav Antal',          allegiance: 'Independent', home: 'Polevnic',      ethos: 'Utopian',   perk: 'Enforcer Cannon' },
  { name: 'Yuri Grom',             allegiance: 'Independent', home: 'Clayakarma',    ethos: 'Military',  perk: 'Pacifier Frag-Cannon' },
  { name: 'Zachary Hudson',        allegiance: 'Federation',  home: 'Nanoman',       ethos: 'Security',  perk: 'Prismatic Shield Generator' },
  { name: 'Zemina Torval',         allegiance: 'Empire',      home: 'Synteini',      ethos: 'Corporate', perk: 'Mining Lance Beam Laser' },
]

const ALLEGIANCE_COLOR = {
  Empire:      'text-blue-400',
  Federation:  'text-red-400',
  Alliance:    'text-green-400',
  Independent: 'text-yellow-400',
}

const RANK_LABELS = ['', 'Rating 1', 'Rating 2', 'Rating 3', 'Rating 4', 'Rating 5']

function PowerplayTab() {
  const [status, setStatus] = useState(null)
  const [system, setSystem] = useState('')
  const [systemResult, setSystemResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api()?.get_powerplay_status().then(r => setStatus(r ?? {}))
  }, [])

  useEffect(() => {
    return window.__edtc?.on('powerplay_update', e => setStatus(e?.payload ?? {}))
  }, [])

  async function lookupSystem() {
    if (!system.trim()) return
    setLoading(true)
    setError(null)
    setSystemResult(null)
    const r = await api()?.get_system_power(system.trim())
    if (r?.error) setError(r.error)
    else if (!r?.name) setError('System not found')
    else setSystemResult(r)
    setLoading(false)
  }

  const pledgedPower = POWERS.find(p => p.name === status?.power)

  return (
    <div className="space-y-6">

      {/* My Power */}
      <div className="panel">
        <h2 className="text-ed-text font-semibold mb-3">My Power</h2>
        {!status?.power ? (
          <p className="text-ed-muted text-sm font-mono">Not pledged to any power. Log in to Elite Dangerous with EDTC running to detect your status.</p>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className={`text-lg font-semibold font-ui ${ALLEGIANCE_COLOR[pledgedPower?.allegiance] ?? 'text-ed-orange'}`}>
                  {status.power}
                </p>
                {pledgedPower && (
                  <p className="text-ed-muted text-xs font-mono mt-0.5">
                    {pledgedPower.allegiance} · {pledgedPower.ethos} · {pledgedPower.home}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-ed-orange font-mono text-sm">{RANK_LABELS[status.rank] ?? `Rank ${status.rank}`}</p>
                {status.updated && <p className="text-ed-muted text-xs font-mono mt-0.5">Updated {new Date(status.updated).toLocaleString()}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-ed-dark rounded p-3">
                <p className="text-ed-muted text-xs font-mono mb-1">Merits</p>
                <p className="text-ed-text font-mono text-lg">{Number(status.merits ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-ed-dark rounded p-3">
                <p className="text-ed-muted text-xs font-mono mb-1">Votes</p>
                <p className="text-ed-text font-mono text-lg">{Number(status.votes ?? 0).toLocaleString()}</p>
              </div>
            </div>
            {pledgedPower && (
              <p className="text-ed-muted text-xs font-mono mt-3">
                <span className="text-ed-gold">Power perk: </span>{pledgedPower.perk}
              </p>
            )}
          </div>
        )}
      </div>

      {/* System Power Lookup */}
      <div className="panel">
        <h2 className="text-ed-text font-semibold mb-3">System Power State</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="input"
            placeholder="System name…"
            value={system}
            onChange={e => setSystem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupSystem()}
          />
          <button className="btn-primary shrink-0" onClick={lookupSystem} disabled={loading}>
            {loading ? '…' : 'Look up'}
          </button>
        </div>
        {error && <p className="text-ed-danger text-sm font-mono">{error}</p>}
        {systemResult && (
          <div className="bg-ed-dark rounded p-3 space-y-1">
            <p className="text-ed-text font-semibold">{systemResult.name}</p>
            <p className="text-ed-muted text-sm font-mono">
              <span className="text-ed-gold">Power: </span>
              {systemResult.power || 'None'}
            </p>
            <p className="text-ed-muted text-sm font-mono">
              <span className="text-ed-gold">State: </span>
              {systemResult.powerState || 'Unoccupied'}
            </p>
            {systemResult.allegiance && (
              <p className="text-ed-muted text-sm font-mono">
                <span className="text-ed-gold">Allegiance: </span>
                {systemResult.allegiance}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Powers Reference */}
      <div className="panel">
        <h2 className="text-ed-text font-semibold mb-3">Powers Reference</h2>
        <div className="space-y-2">
          {POWERS.map(p => (
            <div key={p.name} className={`flex items-start gap-3 py-2 border-b border-ed-border/40 last:border-0 ${status?.power === p.name ? 'opacity-100' : 'opacity-70'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${ALLEGIANCE_COLOR[p.allegiance] ?? 'text-ed-text'}`}>{p.name}</span>
                  {status?.power === p.name && <span className="text-[10px] font-mono text-ed-orange border border-ed-orange/40 px-1 rounded">PLEDGED</span>}
                </div>
                <p className="text-ed-muted text-xs font-mono">{p.allegiance} · {p.ethos} · {p.home}</p>
                <p className="text-ed-muted text-xs font-mono mt-0.5"><span className="text-ed-gold">Perk: </span>{p.perk}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

function CommunityGoalCard({ goal }) {
  const [expanded, setExpanded] = useState(false)

  const isCompleted = goal.isCompleted
  const expiry = goal.expiry ? new Date(goal.expiry) : null
  const now = new Date()
  const msLeft = expiry ? expiry - now : null
  const daysLeft = msLeft != null ? Math.ceil(msLeft / 86400000) : null
  const isExpired = msLeft != null && msLeft <= 0

  function timeLabel() {
    if (isCompleted) return null
    if (isExpired) return { text: 'Expired', color: 'text-ed-muted' }
    if (daysLeft === 0) return { text: 'Ends today', color: 'text-ed-danger' }
    if (daysLeft === 1) return { text: '1 day left', color: 'text-ed-danger' }
    if (daysLeft <= 3) return { text: `${daysLeft} days left`, color: 'text-yellow-400' }
    return { text: `${daysLeft} days left`, color: 'text-ed-muted' }
  }
  const tl = timeLabel()

  const desc = (goal.description ?? '').replace(/<[^>]+>/g, '').trim()
  const obj  = (goal.objective  ?? '').replace(/<[^>]+>/g, '').trim()

  return (
    <div className={`panel ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-ed-text font-semibold font-ui">{goal.title ?? 'Community Goal'}</p>
            {isCompleted && (
              <span className="text-xs font-mono text-ed-success border border-ed-success/40 px-1.5 rounded">
                Complete
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-mono text-ed-muted mt-0.5">
            {goal.system   && <span>{goal.system}</span>}
            {goal.station  && <span>· {goal.station}</span>}
            {goal.commodity?.name && <span className="text-ed-orange">· {goal.commodity.name}</span>}
          </div>
        </div>
        {tl && (
          <span className={`text-xs font-mono shrink-0 ${tl.color}`}>{tl.text}</span>
        )}
      </div>

      {obj && <p className="text-ed-muted text-sm mb-3">{obj}</p>}

      {!isCompleted && goal.tierCapacity > 0 && (
        <div className="mb-3">
          <CGProgressBar
            current={goal.tierProgress}
            max={goal.tierCapacity}
            tier={goal.currentTier}
            maxTier={goal.maxTier}
          />
        </div>
      )}

      {desc && desc !== obj && (
        <>
          <button
            className="text-xs font-mono text-ed-muted hover:text-ed-text"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? '▲ Hide details' : '▼ Show details'}
          </button>
          {expanded && (
            <p className="text-ed-muted text-sm mt-2 pt-2 border-t border-ed-border whitespace-pre-line">
              {desc}
            </p>
          )}
        </>
      )}

      {goal.rewards && (
        <p className="text-ed-gold text-xs font-mono mt-2">
          Reward: {goal.rewards}
        </p>
      )}
    </div>
  )
}

function CommunityGoalsTab() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('Active')

  async function load() {
    setLoading(true)
    setError(null)
    const r = await api()?.get_community_goals()
    if (Array.isArray(r)) {
      setGoals(r)
    } else {
      setError(r?.error ?? 'Failed to load community goals')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = goals.filter(g => {
    if (filter === 'Active')    return !g.isCompleted
    if (filter === 'Completed') return  g.isCompleted
    return true
  })

  const activeCount    = goals.filter(g => !g.isCompleted).length
  const completedCount = goals.filter(g =>  g.isCompleted).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">Live community goals data via EDSM.</p>
        <button className="btn-ghost text-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {!loading && !error && (
        <>
          <div className="flex gap-1 mb-4">
            {[
              { label: `Active (${activeCount})`,       id: 'Active' },
              { label: `Completed (${completedCount})`, id: 'Completed' },
              { label: 'All',                           id: 'All' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-xs font-mono px-3 py-1 rounded border transition-colors ${
                  filter === f.id
                    ? 'border-ed-orange text-ed-orange'
                    : 'border-ed-border text-ed-muted hover:border-ed-orange/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState message={
              goals.length === 0
                ? 'No community goals data returned from EDSM.'
                : `No ${filter.toLowerCase()} community goals.`
            } />
          ) : (
            <div className="space-y-3">
              {filtered.map((g, i) => (
                <CommunityGoalCard key={g.id ?? i} goal={g} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'galnet',    label: 'GalNet' },
  { id: 'cg',        label: 'Community Goals' },
  { id: 'powerplay', label: 'Powerplay' },
  { id: 'factions',  label: 'Factions' },
  { id: 'traffic',   label: 'Traffic' },
  { id: 'stats',     label: 'Galaxy Stats' },
]

export default function Galaxy() {
  const [tab, setTab] = useState('galnet')
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
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Galaxy & Factions</h1>
      <p className="text-ed-muted text-sm mb-5">GalNet news, faction influence, system traffic, and galaxy statistics.</p>

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

      {tab === 'galnet'    && <GalNetTab />}
      {tab === 'cg'        && <CommunityGoalsTab />}
      {tab === 'powerplay' && <PowerplayTab />}
      {tab === 'factions'  && <FactionsTab currentSystem={currentSystem} />}
      {tab === 'traffic'  && <TrafficTab currentSystem={currentSystem} />}
      {tab === 'stats'    && <GalaxyStatsTab />}
    </div>
  )
}
