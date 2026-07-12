import { useState, useEffect, useRef } from 'react'

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
        <p className="text-ed-muted text-sm">Live GalNet news feed.</p>
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

// ---- Tab: Community Goals ----

function CGProgressBar({ current, max, tier, maxTier }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-ed-muted">{tier != null ? `Tier ${tier} / ${maxTier ?? '?'}` : 'Progress'}</span>
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
  { name: 'Jerome Archer',         allegiance: 'Federation',  home: 'Nanomam',       ethos: 'Security',  perk: '+100% bounty payouts in controlled systems' },
  { name: 'Li Yong-Rui',          allegiance: 'Independent', home: 'Lembava',       ethos: 'Corporate', perk: 'Discounted outfitting in SiriusGov systems' },
  { name: 'Nakato Kaine',          allegiance: 'Alliance',    home: 'Tionisla',      ethos: 'Reform',    perk: '+50% mining commodity profits in controlled systems' },
  { name: 'Pranav Antal',          allegiance: 'Independent', home: 'Polevnic',      ethos: 'Utopian',   perk: 'Enforcer Cannon' },
  { name: 'Yuri Grom',             allegiance: 'Independent', home: 'Clayakarma',    ethos: 'Military',  perk: 'Pacifier Frag-Cannon' },
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
    return window.__edtc?.on('powerplay_update', p => setStatus(p ?? {}))
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
        <p className="text-ed-muted text-sm">Live community goals data.</p>
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
                ? 'No active community goals right now.'
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

// ---- Tab: Thargoid War ----

const MAELSTROMS = [
  { name: 'Taranis', system: 'HIP 30377',                    region: 'Pleiades',       origin: 'Celtic' },
  { name: 'Leigong', system: 'HIP 20567',                    region: 'Pleiades',       origin: 'Chinese' },
  { name: 'Indra',   system: 'HIP 20818',                    region: 'Pleiades',       origin: 'Hindu' },
  { name: 'Hadad',   system: 'Col 285 Sector BA-A a15-6',    region: 'Pleiades',       origin: 'Mesopotamian' },
  { name: 'Cocijo',  system: 'CPD-51 3323',                  region: 'Perseus',        origin: 'Zapotec' },
  { name: 'Raijin',  system: 'Hyades Sector FB-N b7-6',      region: 'Hyades',         origin: 'Japanese' },
  { name: 'Oya',     system: 'Witch Head Sector HW-W c1-7',  region: 'Witch Head',     origin: 'Yoruba' },
  { name: 'Thor',    system: 'Col 285 Sector SZ-O b6-0',     region: 'Col 285',        origin: 'Norse' },
]

const WAR_STATE_COLOUR = {
  'thargoid war': 'text-red-400',
  'thargoid controlled': 'text-red-500',
  'thargoid invasion': 'text-orange-400',
  'thargoid alert': 'text-yellow-400',
  'recovery': 'text-green-400',
}

function warStateColour(state) {
  return WAR_STATE_COLOUR[(state || '').toLowerCase()] ?? 'text-ed-muted'
}

function ThargoidSystemStatus() {
  const [query, setQuery]   = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    const r = await api()?.get_thargoid_system(query.trim())
    if (!r || Object.keys(r).length === 0) {
      setError('System not found or no data available.')
    } else {
      setResult(r)
    }
    setLoading(false)
  }

  const info     = result?.information ?? {}
  const factions = result?.factions    ?? []
  const thargoids = result?.thargoids  ?? {}

  const thargoidFactions = factions.filter(f =>
    (f.allegiance || '').toLowerCase() === 'thargoid' ||
    (f.activeStates || []).some(s => (typeof s === 'string' ? s : s.state || '').toLowerCase().includes('thargoid')) ||
    (f.pendingStates || []).some(s => (typeof s === 'string' ? s : s.state || '').toLowerCase().includes('thargoid'))
  )

  const warFactions = factions.filter(f =>
    (f.activeStates || []).some(s => (typeof s === 'string' ? s : s.state || '').toLowerCase().includes('thargoid')) ||
    (f.pendingStates || []).some(s => (typeof s === 'string' ? s : s.state || '').toLowerCase().includes('thargoid'))
  )

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="System name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className="btn-primary" onClick={search} disabled={loading}>
          {loading ? 'Searching…' : 'Check'}
        </button>
      </div>

      {error && <ErrorState error={error} />}

      {result && (
        <div className="space-y-4">
          <div className="panel">
            <h3 className="font-ui font-semibold text-ed-orange mb-3">{result.name}</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-ed-muted">Allegiance</span>
              <span className={`font-mono ${(info.allegiance || '').toLowerCase() === 'thargoid' ? 'text-red-400' : 'text-ed-text'}`}>
                {info.allegiance || '—'}
              </span>
              <span className="text-ed-muted">System State</span>
              <span className={`font-mono ${warStateColour(info.factionState)}`}>
                {info.factionState || 'None'}
              </span>
              <span className="text-ed-muted">Security</span>
              <span className="font-mono text-ed-text">{info.security || '—'}</span>
              <span className="text-ed-muted">Population</span>
              <span className="font-mono text-ed-text">{fmtNum(info.population)}</span>
            </div>
          </div>

          {thargoids && Object.keys(thargoids).length > 0 && (
            <div className="panel">
              <h4 className="text-xs font-mono text-ed-muted uppercase tracking-wider mb-2">Thargoid Presence</h4>
              <pre className="text-xs text-ed-text font-mono whitespace-pre-wrap">
                {JSON.stringify(thargoids, null, 2)}
              </pre>
            </div>
          )}

          {warFactions.length > 0 && (
            <div className="panel">
              <h4 className="text-xs font-mono text-ed-muted uppercase tracking-wider mb-3">Factions in Thargoid War State</h4>
              <div className="space-y-2">
                {warFactions.map((f, i) => {
                  const activeStates = (f.activeStates || []).map(s => typeof s === 'string' ? s : s.state || '')
                  const pendingStates = (f.pendingStates || []).map(s => typeof s === 'string' ? s : s.state || '')
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ed-text">{f.name}</span>
                      <span className="text-ed-muted text-xs">{(f.influence * 100).toFixed(1)}%</span>
                      {activeStates.filter(s => s.toLowerCase().includes('thargoid')).map((s, j) => (
                        <span key={j} className={`text-xs font-mono px-2 py-0.5 rounded border border-current ${warStateColour(s)}`}>{s}</span>
                      ))}
                      {pendingStates.filter(s => s.toLowerCase().includes('thargoid')).map((s, j) => (
                        <span key={j} className="text-xs font-mono px-2 py-0.5 rounded border border-yellow-600 text-yellow-500">Pending: {s}</span>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {warFactions.length === 0 && thargoidFactions.length === 0 && (
            <div className="panel">
              <p className="text-ed-muted text-sm">No Thargoid war activity detected in this system.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThargoidMaelstroms() {
  const [copied, setCopied] = useState(null)

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        The 8 Thargoid Titans — Maelstrom locations are community-reported. Verify coords on EDSM or Canonn.
      </p>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ed-muted text-xs font-mono uppercase tracking-wider border-b border-ed-border">
              <th className="text-left pb-2 pr-4">Titan</th>
              <th className="text-left pb-2 pr-4">System</th>
              <th className="text-left pb-2 pr-4">Region</th>
              <th className="text-left pb-2">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ed-border/40">
            {MAELSTROMS.map(m => (
              <tr key={m.name} className="hover:bg-ed-surface/40 transition-colors">
                <td className="py-2 pr-4 font-ui font-semibold text-red-400">{m.name}</td>
                <td className="py-2 pr-4 font-mono text-ed-text">
                  <button
                    onClick={() => copy(m.system, m.name)}
                    className="hover:text-ed-orange transition-colors text-left"
                    title="Copy system name"
                  >
                    {m.system}
                    <span className="ml-2 text-xs text-ed-muted">
                      {copied === m.name ? '✓' : '⧉'}
                    </span>
                  </button>
                </td>
                <td className="py-2 pr-4 text-ed-muted">{m.region}</td>
                <td className="py-2 text-ed-muted">{m.origin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ThargoidNearby({ currentSystem }) {
  const [system, setSystem]   = useState('')
  const [radius, setRadius]   = useState(100)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (currentSystem) setSystem(currentSystem)
  }, [currentSystem])

  async function search() {
    const s = system.trim()
    if (!s) return
    setLoading(true); setError(null); setResults(null)
    const r = await api()?.get_thargoid_nearby(s, radius)
    if (Array.isArray(r)) {
      setResults(r)
    } else {
      setError(r?.error ?? 'Search failed')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="input flex-1 min-w-40"
          placeholder="Reference system…"
          value={system}
          onChange={e => setSystem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <select
          className="input w-32"
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
        >
          {[50, 100, 200, 500].map(r => (
            <option key={r} value={r}>{r} ly</option>
          ))}
        </select>
        <button className="btn-primary" onClick={search} disabled={loading}>
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {error && <ErrorState error={error} />}

      {results && results.length === 0 && (
        <EmptyState message="No Thargoid activity detected within range. EDSM data may not reflect current war state for all systems." />
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-ed-muted text-xs font-mono mb-3">{results.length} system{results.length !== 1 ? 's' : ''} with Thargoid activity</p>
          {results.map((s, i) => (
            <div key={i} className="panel flex items-center justify-between gap-4">
              <div>
                <span className="font-ui text-ed-text">{s.name}</span>
                {s.allegiance?.toLowerCase() === 'thargoid' && (
                  <span className="ml-2 text-xs font-mono text-red-400">CONTROLLED</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`font-mono text-xs ${warStateColour(s.state)}`}>{s.state || '—'}</span>
                <span className="text-ed-muted text-xs font-mono">{s.distance?.toFixed(1)} ly</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results === null && !loading && (
        <EmptyState message="Enter a system name to scan for nearby Thargoid activity." />
      )}
    </div>
  )
}

function ThargoidTab({ currentSystem }) {
  const [sub, setSub] = useState('status')
  const SUBS = [
    { id: 'status',     label: 'System Status' },
    { id: 'maelstroms', label: 'Maelstroms' },
    { id: 'nearby',     label: 'Nearby Threat' },
  ]
  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-ed-border/50">
        {SUBS.map(s => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              sub === s.id
                ? 'border-red-400 text-red-400'
                : 'border-transparent text-ed-muted hover:text-ed-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'status'     && <ThargoidSystemStatus />}
      {sub === 'maelstroms' && <ThargoidMaelstroms />}
      {sub === 'nearby'     && <ThargoidNearby currentSystem={currentSystem} />}
    </div>
  )
}

// ---- Galaxy Map ----

// Deterministic star field (no Math.random — stable across renders)
const BG_STARS = Array.from({ length: 200 }, (_, i) => ({
  x: (Math.sin(i * 1.618) + 1) / 2,
  y: (Math.cos(i * 2.399) + 1) / 2,
  r: ((Math.sin(i * 5.7) + 1) / 2) * 0.7 + 0.1,
}))

const GX_SCALE = 155  // ly per pixel for top-down 600×600 canvas
const SGR_AX   = 25   // Sgr A* X offset from Sol (ly)
const SGR_AZ   = 25900 // Sgr A* Z offset from Sol (ly)

function gxToCanvas(edX, edZ, W, H) {
  return [
    W / 2 + (edX - SGR_AX) / GX_SCALE,
    H / 2 - (edZ - SGR_AZ) / GX_SCALE,
  ]
}

// The 42 official galactic regions (Universal Cartographics, Dec 3304), with
// centroid coords derived by sampling the community region-boundary grid
// (klightspeed/EliteDangerousRegionMap) — approximate label placement only.
// Bounding boxes computed from the same community boundary grid (2048² cells
// of 4096/83 ly, origin -49985/-24105) — used to fit each sector detail map.
const GALACTIC_REGIONS = [
  { name: 'Galactic Centre',                edX: -98,    edZ: 27279, minX: -2906,  maxX: 3608,   minZ: 23616,  maxZ: 30278 },
  { name: 'Empyrean Straits',                edX: 3553,   edZ: 25617, minX: -4781,  maxX: 10123,  minZ: 18582,  maxZ: 35805 },
  { name: "Ryker's Hope",                    edX: 1912,   edZ: 34338, minX: -5028,  maxX: 8001,   minZ: 29636,  maxZ: 39901 },
  { name: "Odin's Hold",                     edX: -6188,  edZ: 24863, minX: -11196, maxX: -1623,  minZ: 16559,  maxZ: 33239 },
  { name: 'Norma Arm',                       edX: 337,    edZ: 16341, minX: -6459,  maxX: 6471,   minZ: 13598,  maxZ: 19816 },
  { name: 'Arcadian Stream',                 edX: 10176,  edZ: 30624, minX: 3559,   maxX: 16291,  minZ: 15078,  maxZ: 44787 },
  { name: 'Izanami',                         edX: -5273,  edZ: 36852, minX: -13466, maxX: 3510,   minZ: 31956,  maxZ: 41727 },
  { name: 'Inner Orion-Perseus Conflux',     edX: -12181, edZ: 28556, minX: -16279, maxX: -5817,  minZ: 21741,  maxZ: 33584 },
  { name: 'Inner Scutum-Centaurus Arm',      edX: -7571,  edZ: 14609, minX: -14305, maxX: 401,    minZ: 7676,   maxZ: 24405 },
  { name: 'Norma Expanse',                   edX: 12963,  edZ: 16743, minX: -1623,  maxX: 23694,  minZ: 8564,   maxZ: 25689 },
  { name: 'Trojan Belt',                     edX: 19977,  edZ: 31525, minX: 14663,  maxX: 25273,  minZ: 24998,  maxZ: 39457 },
  { name: 'The Veils',                       edX: 14176,  edZ: 44466, minX: 2276,   maxX: 23496,  minZ: 36151,  maxZ: 52584 },
  { name: "Newton's Vault",                  edX: -5983,  edZ: 45010, minX: -16970, maxX: 4694,   minZ: 39605,  maxZ: 51794 },
  { name: 'The Conduit',                     edX: -20410, edZ: 42403, minX: -29505, maxX: -11542, minZ: 35756,  maxZ: 49524 },
  { name: 'Outer Orion-Perseus Conflux',     edX: -15685, edZ: 34306, minX: -21264, maxX: -6903,  minZ: 26577,  maxZ: 41530 },
  { name: 'Orion-Cygnus Arm',                edX: -16985, edZ: 19339, minX: -21264, maxX: -11690, minZ: 10834,  maxZ: 27860 },
  { name: 'Temple',                          edX: -12140, edZ: 9097,  minX: -17710, maxX: -7495,  minZ: 3925,   maxZ: 14289 },
  { name: 'Inner Orion Spur',                edX: -2433,  edZ: 3799,  minX: -10111, maxX: 4003,   minZ: -1404,  maxZ: 9255 },
  { name: "Hawking's Gap",                   edX: 17327,  edZ: 9498,  minX: 2918,   maxX: 30109,  minZ: 3185,   maxZ: 17348 },
  { name: "Dryman's Point",                  edX: 29772,  edZ: 23019, minX: 21720,  maxX: 37117,  minZ: 14634,  maxZ: 31265 },
  { name: 'Sagittarius-Carina Arm',          edX: 31874,  edZ: 35514, minX: 22114,  maxX: 40374,  minZ: 28205,  maxZ: 43849 },
  { name: 'Mare Somnia',                     edX: 31624,  edZ: 49028, minX: 18907,  maxX: 43631,  minZ: 38717,  maxZ: 61418 },
  { name: 'Acheron',                         edX: 19969,  edZ: 60433, minX: 5681,   maxX: 35488,  minZ: 48439,  maxZ: 70448 },
  { name: 'Formorian Frontier',              edX: -246,   edZ: 54188, minX: -11098, maxX: 13182,  minZ: 46563,  maxZ: 63441 },
  { name: 'Hieronymus Delta',                edX: -15931, edZ: 55945, minX: -23534, maxX: -9074,  minZ: 45971,  maxZ: 65119 },
  { name: 'Outer Scutum-Centaurus Arm',      edX: -29760, edZ: 54244, minX: -44507, maxX: -14108, minZ: 40197,  maxZ: 68919 },
  { name: 'Outer Arm',                       edX: -30527, edZ: 29076, minX: -39474, maxX: -20573, minZ: 16510,  maxZ: 42369 },
  { name: "Aquila's Halo",                   edX: -40966, edZ: 22331, minX: -46234, maxX: -36019, minZ: 7775,   maxZ: 32449 },
  { name: 'Errant Marches',                  edX: -31331, edZ: 3314,  minX: -43718, maxX: -14799, minZ: -12755, maxZ: 19273 },
  { name: 'Perseus Arm',                     edX: -23463, edZ: 25302, minX: -27926, maxX: -19092, minZ: 16016,  maxZ: 37236 },
  { name: 'Formidine Rift',                  edX: -13492, edZ: -11145, minX: -27728, maxX: -1919, minZ: -19664, maxZ: -2786 },
  { name: 'Vulcan Gate',                     edX: -21167, edZ: 9017,  minX: -27728, maxX: -13911, minZ: -417,   maxZ: 17645 },
  { name: 'Elysian Shore',                   edX: -9100,  edZ: -1693, minX: -18648, maxX: 401,    minZ: -8066,  maxZ: 6393 },
  { name: 'Sanguineous Rim',                 edX: 7652,   edZ: -5395, minX: -1721,  maxX: 17870,  minZ: -10040, maxZ: -664 },
  { name: 'Outer Orion Spur',                edX: 10154,  edZ: 1727,  minX: 2227,   maxX: 19203,  minZ: -2441,  maxZ: 6097 },
  { name: "Achilles's Altar",                edX: 21419,  edZ: -750,  minX: 12294,  maxX: 29418,  minZ: -8708,  maxZ: 6689 },
  { name: 'Xibalba',                         edX: 33398,  edZ: -3147, minX: 18660,  maxX: 46049,  minZ: -14630, maxZ: 11871 },
  { name: "Lyra's Song",                     edX: 31930,  edZ: 7434,  minX: 24829,  maxX: 38696,  minZ: -1750,  maxZ: 15917 },
  { name: 'Tenebrae',                        edX: 41461,  edZ: 23533, minX: 33267,  maxX: 48763,  minZ: 6541,   maxZ: 43356 },
  { name: 'The Abyss',                       edX: -891,   edZ: 66991, minX: -15934, maxX: 13873,  minZ: 58210,  maxZ: 73607 },
  { name: "Kepler's Crest",                  edX: 10338,  edZ: -15023, minX: -2856, maxX: 28974,  minZ: -22082, maxZ: -7228 },
  { name: 'The Void',                        edX: -41138, edZ: 38742, minX: -49245, maxX: -32022, minZ: 31068,  maxZ: 48981 },
]

// Viewport that fits a region's full bounding box with a small margin
function sectorViewport(region) {
  const spanX = region.maxX - region.minX
  const spanZ = region.maxZ - region.minZ
  return {
    cx0: (region.minX + region.maxX) / 2,
    cz0: (region.minZ + region.maxZ) / 2,
    span: Math.max(spanX, spanZ) * 1.08,
  }
}

// Region boundary segments in 600×600 canvas-pixel space, pre-computed by sampling
// the same region-boundary grid at a 3px step and run-length-merging collinear runs.
// Format: vertical [x, y1, y2], horizontal [y, x1, x2].
const REGION_BORDERS_V = [[3,174,183],[3,261,279],[6,168,174],[6,258,261],[9,159,168],[12,153,159],[15,147,153],[15,279,336],[18,141,147],[18,153,156],[18,336,354],[21,135,141],[21,354,366],[21,399,402],[21,420,429],[24,132,135],[24,156,159],[24,366,378],[24,402,411],[24,429,435],[27,126,132],[27,378,387],[27,396,399],[27,411,417],[27,435,441],[30,120,126],[30,159,162],[30,387,396],[30,417,420],[30,441,447],[30,465,468],[33,117,120],[33,261,264],[33,447,453],[33,462,465],[33,468,474],[36,111,117],[36,162,165],[36,414,417],[36,453,456],[36,474,477],[39,108,111],[39,456,462],[39,477,480],[42,105,108],[42,165,168],[42,411,414],[42,480,486],[45,99,105],[45,486,489],[48,168,171],[48,315,339],[48,369,381],[48,408,411],[48,489,492],[51,339,354],[51,381,390],[51,492,498],[54,99,102],[54,171,174],[54,354,366],[54,390,399],[54,498,501],[57,183,195],[57,264,267],[57,366,369],[57,399,408],[57,501,504],[60,99,102],[60,174,183],[60,348,351],[60,504,507],[63,96,99],[63,195,198],[63,507,510],[66,90,96],[66,285,306],[66,510,516],[69,87,90],[69,267,285],[69,306,315],[72,84,87],[72,198,201],[72,345,348],[72,516,522],[75,81,84],[75,522,525],[78,78,81],[78,201,204],[78,525,528],[81,75,78],[81,249,267],[81,528,531],[84,72,75],[84,237,249],[84,345,351],[87,69,72],[87,204,207],[87,225,237],[87,351,360],[90,66,69],[90,219,225],[90,357,360],[90,525,531],[93,63,66],[93,207,219],[96,60,63],[96,204,210],[96,525,528],[99,57,60],[99,195,204],[99,354,357],[99,528,531],[102,54,57],[102,195,198],[102,531,534],[105,534,537],[108,51,54],[108,351,354],[108,537,540],[111,48,51],[111,198,201],[114,45,48],[114,192,198],[114,540,543],[117,189,192],[117,201,204],[117,543,546],[120,45,51],[120,297,309],[120,351,360],[120,546,549],[123,51,54],[123,189,192],[123,204,207],[123,309,330],[123,360,366],[123,390,393],[123,519,522],[126,51,54],[126,330,342],[126,366,375],[126,393,399],[126,516,519],[126,522,525],[129,48,51],[129,186,192],[129,207,210],[129,342,354],[129,375,381],[129,387,390],[129,399,402],[129,510,516],[129,525,528],[129,543,549],[132,45,48],[132,183,186],[132,276,297],[132,354,360],[132,381,387],[132,402,408],[132,507,510],[132,528,531],[132,540,543],[135,177,183],[135,210,213],[135,408,411],[135,504,507],[135,534,540],[135,543,546],[138,42,45],[138,174,177],[138,411,417],[138,501,504],[138,531,534],[141,171,174],[141,213,216],[141,354,357],[141,417,420],[141,429,438],[141,498,501],[141,546,549],[144,39,42],[144,165,171],[144,264,276],[144,354,363],[144,420,423],[144,426,429],[144,438,441],[144,549,552],[147,36,39],[147,162,165],[147,216,219],[147,252,264],[147,363,366],[147,423,426],[147,441,444],[147,498,501],[150,87,90],[150,159,162],[150,243,252],[150,363,366],[150,444,447],[150,501,504],[150,552,555],[153,33,36],[153,84,87],[153,90,96],[153,156,159],[153,219,222],[153,234,243],[153,447,450],[153,555,558],[156,30,33],[156,81,84],[156,96,99],[156,153,156],[156,360,363],[156,450,453],[159,30,36],[159,99,102],[159,120,129],[159,150,153],[159,222,225],[159,234,237],[159,453,456],[159,501,504],[159,558,561],[162,36,42],[162,78,81],[162,102,108],[162,117,120],[162,129,132],[162,147,153],[162,357,360],[162,456,459],[162,498,501],[165,39,42],[165,75,78],[165,108,111],[165,114,117],[165,132,135],[165,144,147],[165,153,156],[165,225,228],[165,234,237],[165,270,321],[165,492,498],[165,561,564],[168,36,39],[168,111,114],[168,135,138],[168,141,144],[168,156,159],[168,228,234],[168,258,270],[168,321,333],[168,354,363],[168,459,462],[168,489,492],[171,72,75],[171,138,141],[171,159,162],[171,228,231],[171,246,258],[171,333,342],[171,363,369],[171,462,465],[171,489,492],[171,564,567],[174,33,36],[174,162,165],[174,240,246],[174,342,351],[174,369,375],[174,465,468],[174,492,495],[177,69,72],[177,165,168],[177,231,240],[177,351,354],[177,375,378],[177,468,471],[177,567,570],[180,30,33],[180,66,69],[180,168,171],[180,378,381],[180,495,498],[183,234,237],[183,381,387],[183,468,474],[186,27,30],[186,63,66],[186,168,171],[186,288,297],[186,387,390],[186,405,408],[186,462,468],[186,474,477],[186,498,501],[186,570,573],[189,165,168],[189,234,237],[189,390,393],[189,402,405],[189,408,411],[189,459,462],[192,60,63],[192,162,165],[192,228,234],[192,393,396],[192,399,402],[192,453,459],[192,477,480],[192,501,504],[192,573,576],[195,24,27],[195,159,162],[195,165,168],[195,222,228],[195,294,297],[195,396,399],[195,411,414],[195,450,453],[198,24,27],[198,168,174],[198,219,222],[198,267,294],[198,297,318],[198,393,396],[198,414,417],[198,444,450],[198,480,483],[198,498,504],[198,576,579],[201,21,24],[201,27,33],[201,57,60],[201,156,159],[201,174,177],[201,216,219],[201,258,267],[201,390,393],[201,417,420],[201,441,444],[201,483,486],[201,492,498],[204,33,42],[204,153,156],[204,177,180],[204,210,216],[204,255,258],[204,420,423],[204,438,441],[204,489,492],[207,42,51],[207,54,57],[207,150,153],[207,180,183],[207,207,210],[207,315,318],[207,387,390],[207,423,426],[207,432,438],[207,486,489],[210,18,21],[210,51,54],[210,183,186],[210,204,207],[210,255,258],[210,315,324],[210,345,351],[210,384,387],[210,429,432],[210,579,582],[213,51,54],[213,147,150],[213,186,192],[213,324,333],[213,342,345],[213,351,354],[213,381,384],[213,426,429],[216,192,195],[216,204,207],[216,252,258],[216,333,339],[216,354,360],[216,378,381],[216,429,432],[216,489,492],[219,144,147],[219,195,198],[219,207,210],[219,246,252],[219,258,261],[219,312,315],[219,339,342],[219,360,363],[219,375,378],[219,582,585],[222,15,18],[222,48,51],[222,198,201],[222,207,210],[222,240,246],[222,315,327],[222,363,366],[222,372,375],[222,378,381],[222,432,435],[222,492,495],[225,141,144],[225,201,207],[225,237,240],[225,258,261],[225,366,372],[225,381,384],[228,48,57],[228,204,207],[228,234,237],[228,252,258],[228,300,306],[228,384,387],[228,435,438],[228,495,498],[228,585,588],[231,12,15],[231,57,66],[231,102,111],[231,138,141],[231,207,210],[231,231,234],[231,252,255],[231,306,318],[231,387,390],[234,0,12],[234,66,78],[234,111,120],[234,210,213],[234,225,231],[234,318,327],[234,438,441],[237,66,69],[237,78,87],[237,120,126],[237,135,138],[237,210,213],[237,255,258],[237,327,333],[237,390,393],[237,447,453],[237,498,501],[240,87,96],[240,99,102],[240,126,135],[240,207,210],[240,222,225],[240,288,300],[240,333,336],[240,393,396],[240,441,447],[240,453,456],[243,96,99],[243,135,141],[243,204,207],[243,219,222],[243,258,261],[243,336,342],[243,432,441],[243,510,513],[243,588,591],[246,141,150],[246,216,219],[246,342,345],[246,396,399],[246,405,411],[246,426,432],[246,501,510],[249,63,66],[249,150,156],[249,201,204],[249,213,216],[249,258,261],[249,345,348],[249,399,405],[249,420,426],[249,456,459],[252,156,165],[252,201,204],[252,255,258],[252,276,288],[252,348,351],[252,411,420],[252,513,516],[255,162,165],[255,204,213],[255,252,255],[255,270,276],[255,351,354],[255,465,471],[258,252,255],[258,264,270],[258,354,357],[258,414,417],[258,459,465],[258,591,594],[261,207,210],[261,255,258],[261,261,264],[261,363,369],[261,471,474],[264,60,63],[264,159,162],[264,258,261],[264,357,363],[264,369,372],[267,204,207],[267,255,258],[267,417,420],[267,516,519],[270,252,258],[270,336,339],[270,357,360],[270,372,375],[270,411,420],[273,249,252],[273,258,261],[273,333,336],[273,354,357],[276,156,159],[276,201,204],[276,261,264],[276,327,333],[276,339,342],[276,345,354],[276,375,378],[276,474,477],[279,60,63],[279,246,249],[279,264,267],[279,315,318],[279,324,327],[279,342,345],[282,63,81],[282,267,270],[282,288,300],[282,312,315],[282,318,324],[282,342,345],[285,198,201],[285,243,246],[285,270,273],[285,282,288],[285,300,306],[285,309,312],[285,552,600],[288,198,210],[288,273,276],[288,279,282],[288,306,312],[288,378,381],[288,519,552],[291,276,279],[291,345,348],[291,381,390],[291,411,414],[291,477,498],[294,312,315],[294,519,522],[297,81,90],[297,231,243],[297,273,276],[300,390,393],[303,393,414],[303,498,531],[306,306,315],[309,303,306],[312,219,231],[312,273,276],[312,300,303],[315,171,177],[315,291,300],[315,411,414],[315,468,477],[318,156,171],[318,219,222],[318,273,279],[318,345,348],[318,465,468],[321,219,222],[321,270,273],[321,279,285],[321,288,291],[321,378,381],[321,411,432],[324,207,219],[324,267,270],[324,285,288],[324,432,453],[327,90,93],[327,177,180],[327,192,207],[327,210,213],[327,261,267],[327,342,345],[327,453,465],[330,156,159],[330,180,192],[330,375,378],[333,0,6],[333,258,261],[333,324,327],[333,339,345],[333,351,354],[333,408,411],[333,441,444],[333,474,477],[336,213,216],[336,255,258],[336,321,324],[336,327,330],[336,336,339],[336,345,351],[336,354,360],[336,528,531],[339,81,93],[339,180,183],[339,252,255],[339,318,321],[339,330,336],[339,360,366],[339,372,375],[342,63,81],[342,159,162],[342,216,219],[342,225,231],[342,249,252],[342,312,318],[342,366,372],[342,405,408],[342,474,483],[345,93,96],[345,219,225],[345,231,234],[345,246,249],[345,303,312],[345,369,372],[345,438,441],[348,6,9],[348,183,186],[348,243,246],[348,297,303],[351,96,108],[351,234,243],[351,366,369],[351,405,408],[354,162,165],[354,186,189],[354,237,240],[354,363,366],[354,408,414],[354,438,441],[354,480,483],[354,525,528],[357,240,243],[357,252,261],[357,282,297],[357,360,363],[357,411,414],[357,441,447],[360,57,63],[360,108,111],[360,165,168],[360,189,192],[360,243,246],[360,249,252],[360,261,264],[360,279,282],[363,9,12],[363,42,57],[363,165,168],[363,246,249],[363,264,273],[363,357,360],[363,408,411],[363,444,447],[366,33,42],[366,159,165],[366,192,195],[366,273,279],[366,354,357],[366,477,480],[369,111,114],[369,153,159],[369,195,198],[369,348,354],[369,405,408],[369,441,444],[369,525,534],[372,33,36],[372,147,153],[372,345,348],[372,531,534],[375,141,147],[375,198,201],[375,342,345],[375,402,405],[375,438,441],[375,474,477],[378,12,15],[378,114,117],[378,135,141],[378,201,204],[378,336,342],[378,399,402],[378,438,444],[381,129,135],[381,204,207],[381,330,336],[381,396,399],[381,444,447],[381,471,477],[384,117,132],[384,207,210],[384,321,330],[384,477,486],[384,528,531],[387,15,18],[387,27,36],[387,210,213],[387,312,321],[387,393,396],[387,444,447],[387,468,471],[387,486,492],[390,18,27],[390,132,135],[390,213,216],[390,309,312],[390,390,393],[390,525,528],[393,216,219],[393,387,390],[393,441,444],[393,465,468],[393,489,492],[396,18,21],[396,135,138],[396,219,222],[396,264,270],[396,384,387],[396,438,441],[399,222,225],[399,240,246],[399,270,288],[399,303,309],[399,384,387],[399,462,465],[399,486,489],[399,522,525],[402,138,141],[402,225,231],[402,237,240],[402,246,252],[402,261,264],[402,288,303],[402,387,390],[402,435,438],[402,486,489],[405,21,24],[405,141,144],[405,231,237],[405,252,261],[405,432,435],[405,459,462],[405,489,495],[405,519,522],[408,387,390],[408,456,459],[408,495,501],[411,15,24],[411,144,147],[411,231,234],[411,384,387],[411,429,432],[411,501,507],[411,516,519],[414,147,150],[414,378,384],[414,429,435],[414,453,456],[414,507,513],[414,597,600],[417,150,153],[417,228,231],[417,375,378],[417,435,438],[417,450,453],[417,513,519],[420,15,18],[420,303,306],[420,372,375],[420,438,441],[420,519,525],[420,594,597],[423,153,156],[423,225,228],[423,366,372],[423,441,444],[423,447,450],[423,522,531],[426,18,21],[426,150,153],[426,156,159],[426,168,174],[426,360,366],[426,444,447],[426,531,537],[429,147,150],[429,159,162],[429,165,168],[429,174,177],[429,222,225],[429,360,363],[429,441,444],[429,519,522],[429,537,543],[429,591,594],[432,21,24],[432,144,147],[432,162,165],[432,177,180],[432,219,222],[432,438,441],[432,543,549],[435,141,144],[435,180,186],[435,363,366],[435,435,438],[435,516,519],[435,549,555],[435,588,591],[438,24,27],[438,138,141],[438,186,189],[438,216,219],[438,360,366],[438,432,435],[438,555,558],[441,132,138],[441,189,192],[441,354,360],[441,429,432],[441,513,516],[441,558,561],[441,585,588],[444,27,30],[444,192,198],[444,213,216],[444,348,354],[444,510,513],[447,132,135],[447,198,201],[447,210,213],[447,216,222],[447,336,348],[447,357,360],[447,429,432],[447,558,561],[450,135,138],[450,201,207],[450,222,228],[450,327,336],[450,432,435],[450,507,510],[450,582,585],[453,24,30],[453,138,141],[453,207,210],[453,228,237],[453,276,285],[453,303,327],[453,360,363],[453,432,435],[453,504,507],[453,555,558],[453,579,582],[456,138,141],[456,210,216],[456,237,246],[456,285,303],[456,429,432],[456,501,504],[459,135,138],[459,216,219],[459,246,255],[459,363,366],[459,426,429],[459,552,555],[459,576,579],[462,24,27],[462,132,135],[462,216,219],[462,255,270],[462,423,426],[462,498,501],[465,129,132],[465,270,288],[465,366,369],[465,420,423],[465,426,429],[465,495,498],[465,549,552],[465,573,576],[468,27,30],[468,126,129],[468,213,216],[468,285,288],[468,414,420],[468,429,432],[468,492,495],[468,546,549],[471,30,33],[471,123,126],[471,411,414],[471,432,435],[471,489,492],[471,570,573],[474,30,33],[474,120,123],[474,210,213],[474,369,372],[474,405,411],[474,435,438],[474,543,546],[474,567,570],[477,24,30],[477,117,120],[477,402,405],[477,456,462],[477,486,489],[477,543,546],[480,114,117],[480,207,210],[480,396,402],[480,438,441],[480,453,456],[480,483,486],[480,546,549],[480,564,567],[483,24,27],[483,111,114],[483,366,372],[483,390,396],[483,441,444],[483,447,453],[483,462,468],[483,480,483],[483,549,555],[483,561,564],[486,27,30],[486,108,111],[486,204,207],[486,363,366],[486,384,390],[486,444,447],[486,477,480],[486,555,558],[489,105,108],[489,378,384],[489,468,471],[489,474,477],[489,558,561],[492,30,33],[492,102,105],[492,201,204],[492,363,366],[492,372,378],[492,471,474],[492,555,558],[495,33,36],[495,99,102],[495,366,372],[495,474,477],[498,36,39],[498,96,99],[498,198,201],[498,273,285],[498,477,480],[498,552,555],[501,93,96],[501,270,273],[501,366,369],[501,477,480],[501,549,552],[504,39,42],[504,90,93],[504,195,198],[504,474,477],[504,546,549],[507,42,45],[507,87,90],[507,369,372],[507,471,474],[510,45,48],[510,84,87],[510,192,195],[510,465,471],[510,543,546],[513,48,51],[513,81,84],[513,462,465],[513,540,543],[516,51,54],[516,78,81],[516,189,192],[516,369,375],[516,459,462],[516,537,540],[519,75,78],[519,360,369],[519,453,459],[519,534,537],[522,54,57],[522,72,75],[522,186,189],[522,348,360],[522,531,534],[525,57,60],[525,69,75],[525,267,270],[525,333,348],[525,375,378],[525,453,456],[525,528,531],[528,60,63],[528,66,69],[528,75,78],[528,186,192],[528,315,333],[528,525,528],[531,63,66],[531,78,81],[531,192,198],[531,522,525],[534,81,87],[534,198,201],[534,378,381],[534,408,417],[534,453,456],[534,519,522],[537,87,90],[537,198,201],[537,402,408],[537,417,420],[537,447,453],[537,516,519],[540,90,93],[540,267,315],[540,381,384],[540,396,402],[540,420,423],[540,444,447],[540,513,516],[543,93,96],[543,198,201],[543,390,396],[543,438,444],[543,510,513],[546,96,99],[546,195,198],[546,201,210],[546,384,390],[546,423,426],[546,432,438],[546,507,510],[549,99,102],[549,210,219],[549,426,432],[549,504,507],[552,102,108],[552,192,195],[552,219,228],[552,423,426],[552,501,504],[555,108,111],[555,228,240],[555,414,423],[555,495,501],[558,111,117],[558,189,192],[558,240,258],[558,408,414],[558,492,495],[561,117,120],[561,258,282],[561,402,408],[561,489,492],[564,120,123],[564,189,195],[564,393,402],[564,483,489],[567,123,129],[567,141,150],[567,186,189],[567,195,204],[567,480,483],[570,129,135],[570,150,156],[570,204,207],[570,477,480],[573,135,141],[573,156,162],[573,183,186],[573,204,207],[573,393,396],[573,471,477],[576,162,168],[576,465,471],[579,168,174],[579,462,465],[582,174,183],[582,204,216],[582,396,399],[582,456,462],[585,216,228],[585,450,456],[588,228,240],[588,393,402],[588,420,423],[588,447,450],[591,240,261],[591,381,393],[591,414,420],[591,441,447],[594,372,381],[594,405,414],[594,423,426],[594,435,441],[597,360,372],[597,402,405],[597,426,435]]
const REGION_BORDERS_H = [[6,333,348],[9,348,363],[12,231,234],[12,363,378],[15,222,231],[15,378,387],[15,411,420],[18,210,222],[18,387,396],[18,420,426],[21,201,210],[21,396,405],[21,426,432],[24,195,201],[24,405,411],[24,432,438],[24,453,462],[24,477,483],[27,186,195],[27,198,201],[27,387,390],[27,438,444],[27,462,468],[27,483,486],[30,156,159],[30,180,186],[30,444,453],[30,468,471],[30,474,477],[30,486,492],[33,153,156],[33,174,180],[33,201,204],[33,366,372],[33,471,474],[33,492,495],[36,147,153],[36,159,162],[36,168,174],[36,372,387],[36,495,498],[39,144,147],[39,165,168],[39,498,504],[42,138,144],[42,162,165],[42,204,207],[42,363,366],[42,504,507],[45,114,120],[45,132,138],[45,507,510],[48,111,114],[48,129,132],[48,222,228],[48,510,513],[51,108,111],[51,120,123],[51,126,129],[51,207,210],[51,213,222],[51,513,516],[54,102,108],[54,123,126],[54,207,213],[54,516,522],[57,99,102],[57,201,207],[57,228,231],[57,360,363],[57,522,525],[60,96,99],[60,192,201],[60,264,279],[60,525,528],[63,93,96],[63,186,192],[63,249,264],[63,279,282],[63,342,360],[63,528,531],[66,90,93],[66,180,186],[66,231,234],[66,237,249],[66,528,531],[69,87,90],[69,177,180],[69,234,237],[69,525,528],[72,84,87],[72,171,177],[72,522,525],[75,81,84],[75,165,171],[75,519,522],[75,525,528],[78,78,81],[78,162,165],[78,234,237],[78,516,519],[78,528,531],[81,75,78],[81,156,162],[81,282,297],[81,339,342],[81,513,516],[81,531,534],[84,72,75],[84,153,156],[84,510,513],[87,69,72],[87,150,153],[87,237,240],[87,507,510],[87,534,537],[90,66,69],[90,150,153],[90,297,327],[90,504,507],[90,537,540],[93,327,345],[93,501,504],[93,540,543],[96,63,66],[96,153,156],[96,240,243],[96,345,351],[96,498,501],[96,543,546],[99,45,54],[99,60,63],[99,156,159],[99,240,243],[99,495,498],[99,546,549],[102,54,60],[102,159,162],[102,231,240],[102,492,495],[102,549,552],[105,42,45],[105,489,492],[108,39,42],[108,162,165],[108,351,360],[108,486,489],[108,552,555],[111,36,39],[111,165,168],[111,231,234],[111,360,369],[111,483,486],[111,555,558],[114,165,168],[114,369,378],[114,480,483],[117,33,36],[117,162,165],[117,378,384],[117,477,480],[117,558,561],[120,30,33],[120,159,162],[120,234,237],[120,474,477],[120,561,564],[123,471,474],[123,564,567],[126,27,30],[126,237,240],[126,468,471],[129,159,162],[129,381,384],[129,465,468],[129,567,570],[132,24,27],[132,162,165],[132,384,390],[132,441,447],[132,462,465],[135,21,24],[135,165,168],[135,237,243],[135,378,381],[135,390,396],[135,447,450],[135,459,462],[135,570,573],[138,168,171],[138,231,237],[138,396,402],[138,438,441],[138,450,453],[138,456,459],[141,18,21],[141,168,171],[141,225,231],[141,243,246],[141,375,378],[141,402,405],[141,435,438],[141,453,456],[141,567,573],[144,165,168],[144,219,225],[144,405,411],[144,432,435],[147,15,18],[147,162,165],[147,213,219],[147,372,375],[147,411,414],[147,429,432],[150,159,162],[150,207,213],[150,246,249],[150,414,417],[150,426,429],[150,567,570],[153,12,18],[153,156,159],[153,162,165],[153,204,207],[153,369,372],[153,417,426],[156,18,24],[156,153,156],[156,165,168],[156,201,204],[156,249,252],[156,276,330],[156,423,426],[156,570,573],[159,9,12],[159,24,30],[159,150,153],[159,168,171],[159,195,201],[159,264,276],[159,330,342],[159,366,369],[159,426,429],[162,30,36],[162,147,150],[162,171,174],[162,192,195],[162,255,264],[162,342,354],[162,429,432],[162,573,576],[165,36,42],[165,144,147],[165,174,177],[165,189,195],[165,252,255],[165,354,360],[165,363,366],[165,429,432],[168,6,9],[168,42,48],[168,177,180],[168,186,189],[168,195,198],[168,360,363],[168,426,429],[168,576,579],[171,48,54],[171,141,144],[171,180,186],[171,315,318],[174,3,6],[174,54,60],[174,138,141],[174,198,201],[174,426,429],[174,579,582],[177,135,138],[177,201,204],[177,315,327],[177,429,432],[180,204,207],[180,327,339],[180,432,435],[183,0,3],[183,57,60],[183,132,135],[183,207,210],[183,339,348],[183,573,582],[186,129,132],[186,210,213],[186,348,354],[186,435,438],[186,522,528],[186,567,573],[189,117,123],[189,354,360],[189,438,441],[189,516,522],[189,558,567],[192,114,117],[192,123,129],[192,213,216],[192,327,330],[192,360,366],[192,441,444],[192,510,516],[192,528,531],[192,552,558],[195,57,63],[195,99,102],[195,216,219],[195,366,369],[195,504,510],[195,546,552],[195,564,567],[198,63,72],[198,102,114],[198,219,222],[198,285,288],[198,369,375],[198,444,447],[198,498,504],[198,531,534],[198,537,546],[201,72,78],[201,111,117],[201,222,225],[201,249,252],[201,276,285],[201,375,378],[201,447,450],[201,492,498],[201,534,537],[201,543,546],[204,78,87],[204,96,99],[204,117,123],[204,210,216],[204,225,228],[204,243,249],[204,252,255],[204,267,276],[204,378,381],[204,486,492],[204,567,570],[204,573,582],[207,87,93],[207,123,129],[207,207,210],[207,216,219],[207,222,225],[207,228,231],[207,240,243],[207,261,267],[207,324,327],[207,381,384],[207,450,453],[207,480,486],[207,570,573],[210,93,96],[210,129,135],[210,204,207],[210,219,222],[210,231,234],[210,237,240],[210,255,261],[210,288,327],[210,384,387],[210,447,456],[210,474,480],[210,546,549],[213,135,141],[213,234,237],[213,249,255],[213,327,336],[213,387,390],[213,444,447],[213,468,474],[216,141,147],[216,201,204],[216,246,249],[216,336,342],[216,390,393],[216,438,447],[216,456,459],[216,462,468],[216,582,585],[219,90,93],[219,147,153],[219,198,201],[219,243,246],[219,312,318],[219,321,324],[219,342,345],[219,393,396],[219,432,438],[219,459,462],[219,549,552],[222,153,159],[222,195,198],[222,240,243],[222,318,321],[222,396,399],[222,429,432],[222,447,450],[225,87,90],[225,159,165],[225,234,240],[225,342,345],[225,399,402],[225,423,429],[228,165,171],[228,192,195],[228,417,423],[228,450,453],[228,552,555],[228,585,588],[231,171,177],[231,231,234],[231,297,312],[231,342,345],[231,402,405],[231,411,417],[234,153,159],[234,165,168],[234,177,183],[234,189,192],[234,228,231],[234,345,351],[234,405,411],[237,84,87],[237,159,165],[237,183,189],[237,225,228],[237,351,354],[237,402,405],[237,453,456],[240,174,177],[240,222,225],[240,354,357],[240,399,402],[240,555,558],[240,588,591],[243,150,153],[243,285,297],[243,348,351],[243,357,360],[246,171,174],[246,219,222],[246,279,285],[246,345,348],[246,360,363],[246,399,402],[246,456,459],[249,81,84],[249,273,279],[249,342,345],[249,360,363],[252,147,150],[252,216,219],[252,228,231],[252,255,258],[252,270,273],[252,339,342],[252,357,360],[252,402,405],[255,204,210],[255,231,237],[255,252,255],[255,258,261],[255,267,270],[255,336,339],[255,459,462],[258,0,6],[258,168,171],[258,201,204],[258,210,219],[258,225,228],[258,237,243],[258,249,252],[258,261,267],[258,270,273],[258,333,336],[258,558,561],[261,3,33],[261,219,225],[261,243,249],[261,261,264],[261,273,276],[261,327,333],[261,357,360],[261,402,405],[261,591,600],[264,33,57],[264,144,147],[264,258,261],[264,276,279],[264,360,363],[264,396,402],[267,57,81],[267,198,201],[267,279,282],[267,324,327],[267,525,540],[270,165,168],[270,255,258],[270,282,285],[270,321,324],[270,396,399],[270,462,465],[270,501,525],[273,285,288],[273,297,312],[273,318,321],[273,363,366],[273,498,501],[276,132,144],[276,252,255],[276,288,297],[276,312,318],[276,453,465],[279,3,15],[279,288,291],[279,318,321],[279,360,366],[282,285,288],[282,357,360],[282,540,561],[285,66,69],[285,321,324],[285,453,456],[285,468,498],[288,186,198],[288,240,252],[288,282,285],[288,321,324],[288,399,402],[288,465,468],[291,315,321],[294,195,198],[297,120,132],[297,165,186],[297,195,198],[297,348,357],[300,228,240],[300,282,285],[300,312,315],[303,309,312],[303,345,348],[303,399,420],[303,453,456],[306,66,69],[306,228,231],[306,285,288],[306,306,309],[306,420,453],[309,120,123],[309,285,288],[309,390,399],[312,219,231],[312,282,285],[312,288,294],[312,342,345],[312,387,390],[315,48,69],[315,207,210],[315,219,222],[315,279,282],[315,294,306],[315,528,540],[318,198,207],[318,231,234],[318,279,282],[318,339,342],[321,165,168],[321,336,339],[321,384,387],[324,210,213],[324,279,282],[324,333,336],[327,213,222],[327,234,237],[327,276,279],[327,333,336],[327,450,453],[330,123,126],[330,336,339],[330,381,384],[333,168,171],[333,213,216],[333,237,240],[333,273,276],[333,525,528],[336,15,18],[336,240,243],[336,270,273],[336,336,339],[336,378,381],[336,447,450],[339,48,51],[339,216,219],[339,270,276],[339,333,336],[342,126,129],[342,171,174],[342,213,219],[342,243,246],[342,276,282],[342,327,333],[342,375,378],[345,72,84],[345,210,213],[345,246,249],[345,276,279],[345,282,291],[345,318,327],[345,333,336],[345,372,375],[348,60,72],[348,249,252],[348,291,318],[348,369,372],[348,444,447],[348,522,525],[351,51,60],[351,84,87],[351,108,120],[351,174,177],[351,210,213],[351,252,255],[351,333,336],[354,18,21],[354,51,54],[354,99,108],[354,129,132],[354,141,144],[354,168,177],[354,213,216],[354,255,258],[354,273,276],[354,333,336],[354,366,369],[354,441,444],[357,90,99],[357,132,141],[357,162,168],[357,258,264],[357,270,273],[357,363,366],[357,441,447],[360,87,90],[360,120,132],[360,156,162],[360,216,219],[360,264,270],[360,336,339],[360,357,363],[360,426,429],[360,438,441],[360,447,453],[360,519,522],[360,597,600],[363,144,147],[363,150,156],[363,168,171],[363,219,222],[363,261,264],[363,354,357],[363,429,435],[363,453,459],[363,486,492],[366,21,24],[366,54,57],[366,123,126],[366,147,150],[366,222,225],[366,339,342],[366,351,354],[366,423,426],[366,435,438],[366,459,465],[366,483,486],[366,492,501],[369,48,57],[369,171,174],[369,261,264],[369,345,351],[369,465,474],[369,501,507],[369,516,519],[372,222,225],[372,264,270],[372,339,345],[372,420,423],[372,474,483],[372,492,495],[372,507,516],[372,594,597],[375,126,129],[375,174,177],[375,219,222],[375,270,276],[375,330,339],[375,417,420],[375,516,525],[378,24,27],[378,177,180],[378,216,222],[378,276,288],[378,321,330],[378,414,417],[378,489,492],[378,525,534],[381,48,51],[381,129,132],[381,180,183],[381,213,216],[381,222,225],[381,288,321],[381,534,540],[381,591,594],[384,210,213],[384,225,228],[384,396,399],[384,411,414],[384,486,489],[384,540,546],[387,27,30],[387,129,132],[387,183,186],[387,207,210],[387,228,231],[387,393,396],[387,399,402],[387,408,411],[390,51,54],[390,123,129],[390,186,189],[390,201,207],[390,231,237],[390,291,300],[390,390,393],[390,402,408],[390,483,486],[390,543,546],[393,123,126],[393,189,192],[393,198,201],[393,237,240],[393,300,303],[393,387,390],[393,564,573],[393,588,591],[396,27,30],[396,192,198],[396,240,246],[396,381,387],[396,480,483],[396,540,543],[396,573,582],[399,21,27],[399,54,57],[399,126,129],[399,192,195],[399,246,249],[399,378,381],[399,582,588],[402,21,24],[402,129,132],[402,189,192],[402,375,378],[402,477,480],[402,537,540],[402,561,564],[402,588,597],[405,186,189],[405,246,249],[405,342,351],[405,369,375],[405,474,477],[405,594,597],[408,48,57],[408,132,135],[408,186,189],[408,333,342],[408,351,354],[408,363,369],[408,534,537],[408,558,561],[411,24,27],[411,42,48],[411,135,138],[411,189,195],[411,246,252],[411,270,291],[411,315,333],[411,357,363],[411,471,474],[414,36,42],[414,195,198],[414,252,258],[414,291,315],[414,354,357],[414,468,471],[414,555,558],[414,591,594],[417,27,36],[417,138,141],[417,198,201],[417,258,267],[417,534,537],[420,21,30],[420,141,144],[420,201,204],[420,249,252],[420,267,270],[420,465,468],[420,537,540],[420,588,591],[423,144,147],[423,204,207],[423,462,465],[423,540,546],[423,552,555],[423,588,594],[426,144,147],[426,207,213],[426,246,249],[426,459,465],[426,546,552],[426,594,597],[429,21,24],[429,141,144],[429,210,216],[429,411,414],[429,441,447],[429,456,459],[429,465,468],[432,207,210],[432,216,222],[432,243,246],[432,321,324],[432,405,411],[432,438,441],[432,447,450],[432,453,456],[432,468,471],[432,546,549],[435,24,27],[435,222,228],[435,402,405],[435,414,417],[435,435,438],[435,450,453],[435,471,474],[435,594,597],[438,141,144],[438,204,207],[438,228,234],[438,345,354],[438,375,378],[438,396,402],[438,417,420],[438,432,435],[438,474,480],[438,543,546],[441,27,30],[441,144,147],[441,201,204],[441,234,243],[441,333,345],[441,354,357],[441,369,375],[441,393,396],[441,420,423],[441,429,432],[441,480,483],[441,591,594],[444,147,150],[444,198,201],[444,324,333],[444,363,369],[444,378,381],[444,387,393],[444,423,429],[444,483,486],[444,540,543],[447,30,33],[447,150,153],[447,237,240],[447,357,363],[447,381,387],[447,423,426],[447,483,486],[447,537,540],[447,588,591],[450,153,156],[450,195,198],[450,417,423],[450,585,588],[453,33,36],[453,156,159],[453,192,195],[453,237,240],[453,324,327],[453,414,417],[453,480,483],[453,519,525],[453,534,537],[456,36,39],[456,159,162],[456,240,249],[456,408,414],[456,477,480],[456,525,534],[456,582,585],[459,162,168],[459,189,192],[459,249,258],[459,405,408],[459,516,519],[462,33,39],[462,168,171],[462,186,189],[462,399,405],[462,477,483],[462,513,516],[462,579,582],[465,30,33],[465,171,174],[465,255,258],[465,318,327],[465,393,399],[465,510,513],[465,576,579],[468,30,33],[468,174,177],[468,183,186],[468,315,318],[468,387,393],[468,483,489],[471,177,183],[471,255,261],[471,381,387],[471,489,492],[471,507,510],[471,573,576],[474,33,36],[474,183,186],[474,261,276],[474,333,342],[474,375,381],[474,489,495],[474,504,507],[477,36,39],[477,186,192],[477,276,333],[477,366,375],[477,381,384],[477,486,489],[477,495,498],[477,501,504],[477,570,573],[480,39,42],[480,192,198],[480,354,366],[480,483,486],[480,498,501],[480,567,570],[483,198,201],[483,342,354],[483,480,483],[483,564,567],[486,42,45],[486,201,207],[486,384,387],[486,399,402],[486,477,480],[489,45,48],[489,168,171],[489,204,216],[489,393,399],[489,402,405],[489,471,477],[489,561,564],[492,48,51],[492,165,168],[492,171,174],[492,201,204],[492,216,222],[492,387,393],[492,468,471],[492,558,561],[495,174,180],[495,222,228],[495,405,408],[495,465,468],[495,555,558],[498,51,54],[498,141,147],[498,162,165],[498,180,186],[498,198,201],[498,228,237],[498,291,303],[498,462,465],[501,54,57],[501,138,141],[501,147,150],[501,159,162],[501,186,192],[501,237,246],[501,408,411],[501,456,462],[501,552,555],[504,57,60],[504,135,138],[504,150,159],[504,192,198],[504,453,456],[504,549,552],[507,60,63],[507,132,135],[507,411,414],[507,450,453],[507,546,549],[510,63,66],[510,129,132],[510,243,246],[510,444,450],[510,543,546],[513,243,252],[513,414,417],[513,441,444],[513,540,543],[516,66,72],[516,126,129],[516,252,267],[516,411,417],[516,435,441],[516,537,540],[519,123,126],[519,267,294],[519,405,411],[519,417,420],[519,429,435],[519,534,537],[522,72,75],[522,123,126],[522,294,303],[522,399,405],[522,423,429],[522,531,534],[525,75,78],[525,90,96],[525,126,129],[525,354,369],[525,390,399],[525,420,423],[525,528,531],[528,78,81],[528,96,99],[528,129,132],[528,336,354],[528,384,390],[528,525,528],[531,81,90],[531,99,102],[531,132,138],[531,303,336],[531,372,384],[531,423,426],[531,522,525],[534,102,105],[534,135,138],[534,369,372],[534,519,522],[537,105,108],[537,426,429],[537,516,519],[540,108,114],[540,132,135],[540,513,516],[543,114,117],[543,129,135],[543,429,432],[543,474,477],[543,510,513],[546,117,120],[546,135,141],[546,468,474],[546,477,480],[546,504,510],[549,120,129],[549,141,144],[549,432,435],[549,465,468],[549,480,483],[549,501,504],[552,144,150],[552,285,288],[552,459,465],[552,498,501],[555,150,153],[555,435,438],[555,453,459],[555,483,486],[555,492,498],[558,153,159],[558,438,441],[558,447,453],[558,486,492],[561,159,165],[561,441,447],[561,483,489],[564,165,171],[564,480,483],[567,171,177],[567,474,480],[570,177,186],[570,471,474],[573,186,192],[573,465,471],[576,192,198],[576,459,465],[579,198,210],[579,453,459],[582,210,219],[582,450,453],[585,219,228],[585,441,450],[588,228,243],[588,435,441],[591,243,258],[591,429,435],[594,258,285],[594,420,429],[597,414,420],[600,282,285],[600,363,366],[600,405,414]]

function drawTopDown(ctx, W, H) {
  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, W, H)

  for (const s of BG_STARS) {
    ctx.fillStyle = `rgba(200,215,255,${(0.25 + s.r * 0.4).toFixed(2)})`
    ctx.beginPath()
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const gcx = W / 2
  const gcy = H / 2
  const discR = 48000 / GX_SCALE

  // Main disc gradient
  const dg = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, discR)
  dg.addColorStop(0,    'rgba(255,250,180,0.90)')
  dg.addColorStop(0.03, 'rgba(255,200, 80,0.70)')
  dg.addColorStop(0.08, 'rgba(220,130, 40,0.45)')
  dg.addColorStop(0.18, 'rgba(180, 85, 22,0.25)')
  dg.addColorStop(0.40, 'rgba(130, 55, 15,0.12)')
  dg.addColorStop(0.70, 'rgba( 80, 35, 10,0.05)')
  dg.addColorStop(1.00, 'rgba(  0,  0,  0,0.00)')
  ctx.fillStyle = dg
  ctx.beginPath()
  ctx.ellipse(gcx, gcy, discR, discR * 0.97, 0, 0, Math.PI * 2)
  ctx.fill()

  // Sgr A* centre dot
  ctx.fillStyle = 'rgba(255,240,100,0.95)'
  ctx.beginPath(); ctx.arc(gcx, gcy, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,240,100,0.75)'
  ctx.font = '9px monospace'
  ctx.fillText('Sgr A*', gcx + 4, gcy - 5)

  // Named galactic regions (sectors) — boundary outlines
  ctx.save()
  ctx.strokeStyle = 'rgba(210,190,150,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const [x, y1, y2] of REGION_BORDERS_V) { ctx.moveTo(x, y1); ctx.lineTo(x, y2) }
  for (const [y, x1, x2] of REGION_BORDERS_H) { ctx.moveTo(x1, y); ctx.lineTo(x2, y) }
  ctx.stroke()
  ctx.restore()

  // Named galactic regions (sectors) — labels
  ctx.save()
  ctx.font = '8px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(210,190,150,0.4)'
  for (const region of GALACTIC_REGIONS) {
    const [rx, ry] = gxToCanvas(region.edX, region.edZ, W, H)
    if (rx < 8 || rx > W - 8 || ry < 8 || ry > H - 8) continue
    ctx.fillText(region.name, rx, ry)
  }
  ctx.restore()

  // Key locations
  const LOCS = [
    { name: 'Sol',          edX: 0,     edZ: 0,     color: '#5599ff', glowR: 16, glowA: 0.30 },
    { name: 'Colonia',      edX: -9530, edZ: 19808, color: '#ff9944', glowR: 0,  glowA: 0 },
    { name: 'Beagle Point', edX: -1112, edZ: 65270, color: '#ff4499', glowR: 0,  glowA: 0 },
  ]
  ctx.font = '9px monospace'
  for (const loc of LOCS) {
    const [cx, cy] = gxToCanvas(loc.edX, loc.edZ, W, H)
    if (cx < 4 || cx > W - 4 || cy < 4 || cy > H - 4) continue
    if (loc.glowR) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, loc.glowR)
      g.addColorStop(0, `rgba(85,153,255,${loc.glowA})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, loc.glowR, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = loc.color
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillText(loc.name, cx + 5, cy - 3)
  }

  // Scale bar
  const barPx = 10000 / GX_SCALE
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(12, H - 22); ctx.lineTo(12 + barPx, H - 22); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, H - 26); ctx.lineTo(12, H - 18)
  ctx.moveTo(12 + barPx, H - 26); ctx.lineTo(12 + barPx, H - 18)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '8px monospace'
  ctx.fillText('10,000 ly', 12, H - 10)
}

function drawCoverage(ctx, W, H, coverage) {
  const cells = coverage?.cells ?? []
  if (cells.length === 0) return
  const cellLy = coverage.cell_ly ?? 300
  const px = Math.max(2, Math.ceil(cellLy / GX_SCALE))
  // Log-scale alpha: 1 report = faint, hundreds = solid
  for (const [gx, gz, count] of cells) {
    const [cx, cy] = gxToCanvas(gx * cellLy + cellLy / 2, gz * cellLy + cellLy / 2, W, H)
    if (cx < -px || cx > W + px || cy < -px || cy > H + px) continue
    const a = Math.min(0.8, 0.18 + 0.20 * Math.log10(count + 1))
    ctx.fillStyle = `rgba(255,60,60,${a.toFixed(2)})`
    ctx.fillRect(cx - px / 2, cy - px / 2, px, px)
  }
}

// Key locations drawn on sector detail maps when in view
const KEY_LOCATIONS = [
  { name: 'Sol',          edX: 0,     edZ: 0,     color: '#5599ff' },
  { name: 'Sgr A*',       edX: 25,    edZ: 25900, color: '#ffee66' },
  { name: 'Colonia',      edX: -9530, edZ: 19808, color: '#ff9944' },
  { name: 'Beagle Point', edX: -1112, edZ: 65270, color: '#ff4499' },
]

const MAIN_HALF = 300          // half-size of the 600px canvas the border data was sampled for

function drawSectorDetail(ctx, W, H, region, coverage, pos) {
  const { cx0, cz0, span } = sectorViewport(region)
  const SC = span / W  // ly per px
  const toC = (edX, edZ) => [W / 2 + (edX - cx0) / SC, H / 2 - (edZ - cz0) / SC]
  const gridStep = span > 24000 ? 5000 : 2000

  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, W, H)
  for (const s of BG_STARS) {
    ctx.fillStyle = `rgba(200,215,255,${(0.20 + s.r * 0.35).toFixed(2)})`
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill()
  }

  // Grid lines aligned to absolute galactic coords
  const minX = cx0 - span / 2, maxX = cx0 + span / 2
  const minZ = cz0 - span / 2, maxZ = cz0 + span / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = Math.ceil(minX / gridStep) * gridStep; x <= maxX; x += gridStep) {
    const [cx] = toC(x, 0); ctx.moveTo(cx, 0); ctx.lineTo(cx, H)
  }
  for (let z = Math.ceil(minZ / gridStep) * gridStep; z <= maxZ; z += gridStep) {
    const [, cy] = toC(0, z); ctx.moveTo(0, cy); ctx.lineTo(W, cy)
  }
  ctx.stroke()

  // Coverage heat cells
  if (coverage?.cells?.length) {
    const cellLy = coverage.cell_ly ?? 300
    const px = Math.max(2, cellLy / SC)
    for (const [gx, gz, count] of coverage.cells) {
      const [cx, cy] = toC(gx * cellLy + cellLy / 2, gz * cellLy + cellLy / 2)
      if (cx < -px || cx > W + px || cy < -px || cy > H + px) continue
      const a = Math.min(0.75, 0.15 + 0.18 * Math.log10(count + 1))
      ctx.fillStyle = `rgba(255,60,60,${a.toFixed(2)})`
      ctx.fillRect(cx - px / 2, cy - px / 2, px, px)
    }
  }

  // Region boundary segments (stored in main-map 600px space → ED coords → here)
  const pxToEdX = x => (x - MAIN_HALF) * GX_SCALE + SGR_AX
  const pyToEdZ = y => (MAIN_HALF - y) * GX_SCALE + SGR_AZ
  ctx.strokeStyle = 'rgba(210,190,150,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (const [x, y1, y2] of REGION_BORDERS_V) {
    const edX = pxToEdX(x)
    if (edX < minX - 500 || edX > maxX + 500) continue
    const [cx, cy1] = toC(edX, pyToEdZ(y1))
    const [, cy2] = toC(edX, pyToEdZ(y2))
    if (Math.max(cy1, cy2) < 0 || Math.min(cy1, cy2) > H) continue
    ctx.moveTo(cx, cy1); ctx.lineTo(cx, cy2)
  }
  for (const [y, x1, x2] of REGION_BORDERS_H) {
    const edZ = pyToEdZ(y)
    if (edZ < minZ - 500 || edZ > maxZ + 500) continue
    const [cx1, cy] = toC(pxToEdX(x1), edZ)
    const [cx2] = toC(pxToEdX(x2), edZ)
    if (Math.max(cx1, cx2) < 0 || Math.min(cx1, cx2) > W) continue
    ctx.moveTo(cx1, cy); ctx.lineTo(cx2, cy)
  }
  ctx.stroke()

  // Region labels — selected bright, neighbours dim
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  for (const r of GALACTIC_REGIONS) {
    const [cx, cy] = toC(r.edX, r.edZ)
    if (cx < 20 || cx > W - 20 || cy < 12 || cy > H - 12) continue
    ctx.fillStyle = r.name === region.name ? 'rgba(240,220,170,0.9)' : 'rgba(210,190,150,0.35)'
    ctx.fillText(r.name, cx, cy)
  }
  ctx.textAlign = 'left'

  // Key locations in view
  ctx.font = '10px monospace'
  for (const loc of KEY_LOCATIONS) {
    const [cx, cy] = toC(loc.edX, loc.edZ)
    if (cx < 4 || cx > W - 4 || cy < 4 || cy > H - 4) continue
    ctx.fillStyle = loc.color
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillText(loc.name, cx + 6, cy - 4)
  }

  // Current position marker
  if (pos?.x != null) {
    const [cx, cy] = toC(pos.x, pos.z)
    if (cx >= 0 && cx <= W && cy >= 0 && cy <= H) {
      ctx.strokeStyle = '#22ddcc'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 7, cy)
      ctx.closePath(); ctx.stroke()
      ctx.fillStyle = '#22ddcc'
      ctx.font = '10px monospace'
      ctx.fillText(`YOU · ${pos.system}`, cx + 10, cy + 4)
    }
  }

  // Scale bar — one grid step
  const barPx = gridStep / SC
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(12, H - 22); ctx.lineTo(12 + barPx, H - 22); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, H - 26); ctx.lineTo(12, H - 18)
  ctx.moveTo(12 + barPx, H - 26); ctx.lineTo(12 + barPx, H - 18)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '8px monospace'
  ctx.fillText(`${gridStep.toLocaleString()} ly`, 12, H - 10)
}

function GalaxyMapTab() {
  const topRef  = useRef(null)
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [overlay,  setOverlay]  = useState('off')
  const [coverage, setCoverage] = useState(null)
  const [covInfo,  setCovInfo]  = useState('')
  const [sector,        setSector]        = useState(null)
  const [sectorCov,     setSectorCov]     = useState(null)
  const [yBand,         setYBand]         = useState(null)  // null = all heights
  const [pos,           setPos]           = useState(null)

  async function loadStats() {
    setLoading(true); setError(null)
    const r = await api()?.get_market_stats()
    if (r) setStats(r)
    else   setError('No data returned')
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])

  async function loadCoverage(layer) {
    const r = await api()?.get_galaxy_coverage(layer)
    setCoverage(r ?? null)
    if (!r || r.cells.length === 0) {
      setCovInfo(layer === 'live'
        ? 'No live data yet — accumulates from the player network while EDTC runs.'
        : 'Data not loaded yet — it imports automatically shortly after launch.')
    } else {
      const total = r.cells.reduce((s, c) => s + c[2], 0)
      setCovInfo(`${total.toLocaleString()} reports in ${r.cells.length.toLocaleString()} sectors`)
    }
  }

  async function loadSectorCoverage(region, layer, band = yBand) {
    const cell = 300
    const { cx0, cz0, span } = sectorViewport(region)
    const bounds = [
      Math.floor((cx0 - span / 2) / cell),
      Math.floor((cx0 + span / 2) / cell),
      Math.floor((cz0 - span / 2) / cell),
      Math.floor((cz0 + span / 2) / cell),
    ]
    const r = await api()?.get_galaxy_coverage(layer, bounds, band)
    setSectorCov(r ?? null)
  }

  function openSector(region) {
    const layer = overlay === 'off' ? 'week' : overlay
    if (overlay === 'off') setOverlay('week')
    setSector(region)
    setSectorCov(null)
    setYBand(null)
    loadSectorCoverage(region, layer, null)
    api()?.get_current_position?.().then(p => setPos(p ?? null))
  }

  // Height-band slicing (sector view): cycle through 400-ly-tall Y slices
  function selectBand(band) {
    setYBand(band)
    if (sector) loadSectorCoverage(sector, overlay === 'off' ? 'week' : overlay, band)
  }

  const bandList = sectorCov?.y_bands?.map(b => b[0]) ?? []  // highest first
  function stepBand(dir) {
    if (bandList.length === 0) return
    if (yBand === null) {
      // Entering slice mode: start at the densest band (the galactic plane,
      // in practice) — outlier bands hold single lone-explorer systems
      const densest = sectorCov.y_bands.reduce((a, b) => (b[1] > a[1] ? b : a))
      selectBand(densest[0])
      return
    }
    const i = bandList.indexOf(yBand)
    const next = i === -1 ? 0 : i - dir  // list is sorted DESC, so ▲(+1) = earlier index
    if (next < 0 || next >= bandList.length) { selectBand(null); return }
    selectBand(bandList[next])
  }

  const bandLy = sectorCov?.y_band_ly ?? 400
  const fmtY = v => (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString())
  const bandLabel = yBand === null
    ? 'All heights'
    : `${fmtY(yBand * bandLy)} to ${fmtY((yBand + 1) * bandLy)} ly`

  // Load coverage when the overlay layer changes; poll every 60s on live
  useEffect(() => {
    if (overlay === 'off') { setCoverage(null); setCovInfo(''); return }
    loadCoverage(overlay)
    if (sector) loadSectorCoverage(sector, overlay)
    if (overlay === 'live') {
      const t = setInterval(() => {
        loadCoverage('live')
        if (sector) loadSectorCoverage(sector, 'live')
      }, 60000)
      return () => clearInterval(t)
    }
  }, [overlay, yBand])

  // Redraw: sector detail when a sector is open, otherwise galaxy + overlay
  useEffect(() => {
    const c = topRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (sector) {
      drawSectorDetail(ctx, c.width, c.height, sector, sectorCov, pos)
    } else {
      drawTopDown(ctx, c.width, c.height)
      if (overlay !== 'off' && coverage) drawCoverage(ctx, c.width, c.height, coverage)
    }
  }, [overlay, coverage, sector, sectorCov, pos])

  // Click a region label on the galaxy view to open its sector map
  function handleCanvasClick(e) {
    if (sector) return
    const c = topRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (c.width / rect.width)
    const py = (e.clientY - rect.top) * (c.height / rect.height)
    let best = null, bestD = 40
    for (const r of GALACTIC_REGIONS) {
      const [cx, cy] = gxToCanvas(r.edX, r.edZ, c.width, c.height)
      const d = Math.hypot(cx - px, cy - py)
      if (d < bestD) { best = r; bestD = d }
    }
    if (best) openSector(best)
  }

  return (
    <div className="space-y-4">
      {/* Local data cache tracker */}
      <div className="panel">
        <div className="flex items-center justify-between mb-2">
          <p className="text-ed-muted text-xs font-mono uppercase tracking-wider">Local Data Cache</p>
          <button className="btn-ghost text-xs" onClick={loadStats} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {loading && <p className="text-ed-muted text-sm font-mono">Reading local database…</p>}
        {error   && <p className="text-ed-danger text-sm font-mono">{error}</p>}
        {stats && !loading && (
          <>
            <p className="font-mono">
              <span className="text-ed-orange font-semibold text-2xl">{fmtNum(stats.systems_with_coords)}</span>
              <span className="text-ed-muted text-sm ml-2">systems tracked</span>
            </p>
            <p className="text-ed-muted text-xs font-mono mt-0.5">
              Populated from your journal (visited systems) and the EDDN network — grows the more you play.
            </p>
            <div className="flex gap-4 mt-3 text-xs font-mono text-ed-muted">
              <span>Stations: <span className="text-ed-text">{fmtNum(stats.stations)}</span></span>
              <span>Commodities: <span className="text-ed-text">{fmtNum(stats.commodities)}</span></span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {sector ? (
          <>
            <button className="btn-ghost text-xs" onClick={() => { setSector(null); setSectorCov(null); setYBand(null) }}>
              ← Back to galaxy
            </button>
            <span className="text-ed-orange font-ui font-semibold text-sm">{sector.name}</span>
            {overlay !== 'off' && (
              <span className="flex items-center gap-1 ml-3">
                <span className="text-ed-muted text-xs font-mono">Height:</span>
                <button
                  className="btn-ghost text-xs px-2"
                  onClick={() => stepBand(1)}
                  disabled={bandList.length === 0}
                  title="Up one slice (toward galactic north)"
                >▲</button>
                <span className="text-xs font-mono text-ed-text w-36 text-center">{bandLabel}</span>
                <button
                  className="btn-ghost text-xs px-2"
                  onClick={() => stepBand(-1)}
                  disabled={bandList.length === 0}
                  title="Down one slice (below the plane)"
                >▼</button>
                {yBand !== null && (
                  <button className="btn-ghost text-xs" onClick={() => selectBand(null)}>All</button>
                )}
              </span>
            )}
          </>
        ) : (
          <select
            className="input font-mono text-xs py-1"
            value=""
            onChange={e => {
              const r = GALACTIC_REGIONS.find(x => x.name === e.target.value)
              if (r) openSector(r)
            }}
          >
            <option value="">Open sector map…</option>
            {[...GALACTIC_REGIONS].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        )}
        <span className="text-ed-muted text-xs font-mono ml-4">Scan activity:</span>
        {[
          { id: 'off',     label: 'Off' },
          { id: 'alltime', label: 'All Time' },
          { id: 'week',    label: 'Last 7 Days' },
          { id: 'live',    label: 'Live (EDDN)' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setOverlay(v.id)}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              overlay === v.id
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'border-ed-border text-ed-muted hover:border-ed-text hover:text-ed-text'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {overlay !== 'off' && (
        <p className="text-xs font-mono text-ed-muted">
          <span className="text-red-400">■</span> = {
            overlay === 'alltime' ? 'every system ever catalogued by players (EDSM all-time)'
            : overlay === 'live'  ? 'systems players are visiting right now (live EDDN traffic)'
            : 'systems players visited/scanned in the last 7 days (EDSM submissions)'
          } — avoid these areas for first discoveries.
          {covInfo && !sector && <span className="text-ed-text ml-2">{covInfo}</span>}
        </p>
      )}

      {/* Canvas */}
      <div className="rounded border border-ed-border overflow-hidden bg-[#050510]">
        <canvas
          ref={topRef}
          width={600}
          height={600}
          onClick={handleCanvasClick}
          className={`w-full block ${sector ? '' : 'cursor-pointer'}`}
        />
      </div>

      <div className="flex justify-between text-xs font-mono text-ed-muted">
        <span>
          {sector
            ? `${sector.name} · ${Math.round(sectorViewport(sector).span).toLocaleString()} ly viewport`
              + (overlay !== 'off' ? ` · heat: ${yBand === null ? 'all heights' : bandLabel}` : '')
            : 'Galactic north = up · Sgr A* at centre · ~155 ly/px · click a region name to open its sector map'}
        </span>
        <span>map: stylized</span>
      </div>
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'galnet',    label: 'GalNet' },
  { id: 'cg',        label: 'Community Goals' },
  { id: 'powerplay', label: 'Powerplay' },
  { id: 'thargoid',  label: 'Thargoid War' },
  { id: 'factions',  label: 'Factions' },
  { id: 'traffic',   label: 'Traffic' },
  { id: 'galmap',    label: 'Galaxy Map' },
]

export default function Galaxy() {
  const [tab, setTab] = useState('galnet')
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
      {tab === 'thargoid'  && <ThargoidTab currentSystem={currentSystem} />}
      {tab === 'factions'  && <FactionsTab currentSystem={currentSystem} />}
      {tab === 'traffic'   && <TrafficTab currentSystem={currentSystem} />}
      {tab === 'galmap'    && <GalaxyMapTab />}
    </div>
  )
}
