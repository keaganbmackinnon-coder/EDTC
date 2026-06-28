import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Rank tables ----

const COMBAT_RANKS   = ['Harmless','Mostly Harmless','Novice','Competent','Expert','Master','Dangerous','Deadly','Elite']
const TRADE_RANKS    = ['Penniless','Mostly Penniless','Peddler','Dealer','Merchant','Broker','Entrepreneur','Tycoon','Elite']
const EXPLORE_RANKS  = ['Aimless','Mostly Aimless','Scout','Surveyor','Trailblazer','Pathfinder','Ranger','Pioneer','Elite']
const SOLDIER_RANKS  = ['Rank 0','Rank 1','Rank 2','Rank 3','Rank 4','Rank 5','Rank 6','Rank 7','Rank 8']
const EXOBIO_RANKS   = ['Rank 0','Rank 1','Rank 2','Rank 3','Rank 4','Rank 5','Rank 6','Rank 7','Rank 8']
const EMPIRE_RANKS   = ['None','Outsider','Serf','Master','Squire','Knight','Lord','Baron','Viscount','Count','Earl','Marquis','Duke','Prince','King']
const FEDERATION_RANKS = ['None','Recruit','Cadet','Midshipman','Petty Officer','Chief Petty Officer','Warrant Officer','Ensign','Lieutenant','Lieutenant Commander','Post Commander','Post Captain','Rear Admiral','Vice Admiral','Admiral']
const CQC_RANKS      = ['Helpless','Mostly Helpless','Amateur','Semi Professional','Professional','Champion','Hero','Gladiator','Elite']

const RANK_META = [
  { key: 'Combat',       label: 'Combat',       table: COMBAT_RANKS },
  { key: 'Trade',        label: 'Trade',        table: TRADE_RANKS },
  { key: 'Explore',      label: 'Exploration',  table: EXPLORE_RANKS },
  { key: 'Soldier',      label: 'Mercenary',    table: SOLDIER_RANKS },
  { key: 'Exobiologist', label: 'Exobiologist', table: EXOBIO_RANKS },
  { key: 'Empire',       label: 'Empire',       table: EMPIRE_RANKS },
  { key: 'Federation',   label: 'Federation',   table: FEDERATION_RANKS },
  { key: 'CQC',          label: 'CQC',          table: CQC_RANKS },
]

// ---- Helpers ----

function fmtCredits(n) {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B Cr`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M Cr`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K Cr`
  return `${n} Cr`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function EmptyState({ message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

// ---- Tab: CMDR Lookup ----

function LookupTab() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function doLookup() {
    const name = query.trim()
    if (!name) return
    setLoading(true)
    setResult(null)
    const r = await api()?.lookup_commander(name)
    setResult(r ?? { error: 'No response' })
    setLoading(false)
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Looks up a commander&apos;s last known location via EDSM (only works if the CMDR has
        opted in to sharing their position publicly).
      </p>

      <div className="flex gap-2 mb-6">
        <input
          className="input font-mono text-sm flex-1"
          placeholder="CMDR name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLookup()}
        />
        <button
          className="btn-primary text-sm disabled:opacity-40"
          onClick={doLookup}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {result && !result.error && (
        <div className="panel">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-ed-orange font-semibold font-ui text-lg">CMDR {query.toUpperCase()}</p>
              {result.firstDiscover && (
                <span className="text-xs font-mono text-ed-gold border border-ed-gold/40 px-1.5 py-0.5 rounded">
                  First Discoverer
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm font-mono">
            <div>
              <p className="text-ed-muted text-xs mb-0.5">Last System</p>
              <p className="text-ed-text">{result.system ?? '—'}</p>
            </div>
            <div>
              <p className="text-ed-muted text-xs mb-0.5">Last Seen</p>
              <p className="text-ed-text">{fmtDate(result.date)}</p>
            </div>
            {result.coordinates && (
              <div className="col-span-2">
                <p className="text-ed-muted text-xs mb-0.5">Coordinates</p>
                <p className="text-ed-text">
                  {result.coordinates.x?.toFixed(2)}, {result.coordinates.y?.toFixed(2)}, {result.coordinates.z?.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {result?.error && (
        <div className="panel border border-ed-danger/30">
          <p className="text-ed-danger text-sm font-mono">{result.error}</p>
        </div>
      )}
    </div>
  )
}

// ---- Tab: My Stats ----

function RankBar({ label, rank, progress, table }) {
  const name = table?.[rank] ?? `Rank ${rank}`
  const pct = progress ?? 0
  const isElite = name === 'Elite'
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-ed-muted">{label}</span>
        <span className={isElite ? 'text-ed-gold' : 'text-ed-text'}>{name}</span>
      </div>
      <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isElite ? 'bg-ed-gold' : 'bg-ed-orange'}`}
          style={{ width: `${isElite ? 100 : pct}%` }}
        />
      </div>
      {!isElite && (
        <p className="text-ed-muted text-xs font-mono mt-0.5 text-right">{pct}% to next</p>
      )}
    </div>
  )
}

function StatsTab() {
  const [stats, setStats] = useState({})

  useEffect(() => {
    api()?.get_cmdr_stats().then(r => setStats(r ?? {}))
  }, [])

  useEffect(() => {
    return window.__edtc?.on('cmdr_stats_update', () => {
      api()?.get_cmdr_stats().then(r => setStats(r ?? {}))
    })
  }, [])

  const ranks = stats.ranks ?? {}
  const progress = stats.rank_progress ?? {}
  const hasRanks = Object.keys(ranks).length > 0

  const statisticsGroups = stats.statistics
    ? Object.entries(stats.statistics).filter(([, v]) => typeof v === 'object' && v !== null)
    : []

  if (!stats.name && !hasRanks) {
    return (
      <EmptyState message="No stats tracked yet. Launch Elite Dangerous with EDTC running — stats are read from your journal on game start." />
    )
  }

  return (
    <div>
      {/* CMDR card */}
      <div className="panel mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-ed-orange font-semibold font-ui text-xl">
              CMDR {stats.name ?? '—'}
            </p>
            {stats.ship && (
              <p className="text-ed-muted text-sm font-mono mt-0.5">
                {stats.ship}
                {stats.ship_ident && <span className="text-ed-text ml-2">[{stats.ship_ident}]</span>}
                {stats.ship_name && <span className="text-ed-gold ml-2">"{stats.ship_name}"</span>}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-ed-gold font-mono font-semibold text-lg">{fmtCredits(stats.credits)}</p>
            {stats.gamemode && (
              <p className="text-ed-muted text-xs font-mono">{stats.gamemode}</p>
            )}
            {stats.fuel_level != null && stats.fuel_capacity != null && (
              <p className="text-ed-muted text-xs font-mono">
                Fuel {stats.fuel_level?.toFixed(1)}/{stats.fuel_capacity?.toFixed(1)}T
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Ranks */}
      {hasRanks && (
        <div className="panel mb-4">
          <p className="text-ed-muted text-xs font-mono mb-3 uppercase tracking-wider">Ranks</p>
          <div className="grid grid-cols-2 gap-x-6">
            {RANK_META.map(r => ranks[r.key] != null ? (
              <RankBar
                key={r.key}
                label={r.label}
                rank={ranks[r.key]}
                progress={progress[r.key]}
                table={r.table}
              />
            ) : null)}
          </div>
        </div>
      )}

      {/* Statistics groups */}
      {statisticsGroups.length > 0 && (
        <div className="space-y-3">
          {statisticsGroups.map(([group, values]) => (
            <details key={group} className="panel">
              <summary className="cursor-pointer text-ed-text font-ui font-semibold text-sm select-none">
                {group}
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(values).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs font-mono">
                    <span className="text-ed-muted">{k.replace(/_/g, ' ')}</span>
                    <span className="text-ed-text">{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Logbook ----

const BLANK_ENTRY = { title: '', system: '', body: '' }

function LogbookTab() {
  const [entries, setEntries] = useState([])
  const [editing, setEditing] = useState(null) // null | entry object
  const [expanded, setExpanded] = useState(null)
  const [currentSystem, setCurrentSystem] = useState('')

  useEffect(() => {
    api()?.get_logbook().then(r => setEntries(r ?? []))
    api()?.get_current_system().then(s => setCurrentSystem(s ?? ''))
  }, [])

  function startNew() {
    setEditing({ ...BLANK_ENTRY, system: currentSystem })
    setExpanded(null)
  }

  async function saveEntry() {
    if (!editing) return
    const saved = await api()?.save_log_entry(editing)
    if (saved) {
      setEntries(prev => {
        const idx = prev.findIndex(e => e.id === saved.id)
        if (idx === -1) return [saved, ...prev]
        const next = [...prev]
        next[idx] = saved
        return next
      })
    }
    setEditing(null)
  }

  async function deleteEntry(id) {
    await api()?.delete_log_entry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">Personal log entries — dates, systems, notes.</p>
        {!editing && (
          <button className="btn-primary text-sm" onClick={startNew}>+ New Entry</button>
        )}
      </div>

      {editing && (
        <div className="panel border border-ed-orange/30 mb-4">
          <p className="text-ed-orange font-semibold font-ui text-sm mb-3">
            {editing.id ? 'Edit Entry' : 'New Log Entry'}
          </p>
          <div className="space-y-2 mb-3">
            <input
              className="input font-mono text-sm w-full"
              placeholder="Title…"
              value={editing.title}
              onChange={e => setEditing(v => ({ ...v, title: e.target.value }))}
            />
            <input
              className="input font-mono text-sm w-full"
              placeholder="System (optional)…"
              value={editing.system}
              onChange={e => setEditing(v => ({ ...v, system: e.target.value }))}
            />
            <textarea
              className="input font-mono text-sm w-full resize-none"
              rows={6}
              placeholder="Log entry…"
              value={editing.body}
              onChange={e => setEditing(v => ({ ...v, body: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={saveEntry}>Save</button>
            <button className="btn-ghost text-sm" onClick={() => setEditing(null)}>Cancel</button>
            {currentSystem && !editing.id && (
              <button
                className="btn-ghost text-sm ml-auto text-ed-muted"
                onClick={() => setEditing(v => ({ ...v, system: currentSystem }))}
              >
                Use current system
              </button>
            )}
          </div>
        </div>
      )}

      {entries.length === 0 && !editing ? (
        <EmptyState message="No log entries yet. Click 'New Entry' to start writing." />
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="panel">
              <button
                className="w-full flex items-start justify-between gap-3 text-left"
                onClick={() => setExpanded(x => x === e.id ? null : e.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ed-text font-semibold font-ui text-sm truncate">
                    {e.title || 'Untitled'}
                  </p>
                  <div className="flex gap-3 text-xs font-mono text-ed-muted mt-0.5">
                    {e.system && <span className="text-ed-orange">{e.system}</span>}
                    <span>{new Date(e.created).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="text-ed-muted text-xs shrink-0">{expanded === e.id ? '▲' : '▼'}</span>
              </button>

              {expanded === e.id && (
                <div className="mt-3 border-t border-ed-border pt-3">
                  <p className="text-ed-text text-sm font-mono whitespace-pre-wrap mb-3">{e.body || '(no content)'}</p>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => { setEditing({ ...e }); setExpanded(null) }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-ghost text-xs text-ed-danger hover:border-ed-danger/50"
                      onClick={() => deleteEntry(e.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Screenshots ----

function ScreenshotsTab() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api()?.get_screenshots().then(r => {
      setFiles(r ?? [])
      setLoading(false)
    })
  }, [])

  function refresh() {
    setLoading(true)
    api()?.get_screenshots().then(r => {
      setFiles(r ?? [])
      setLoading(false)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          Screenshots from{' '}
          <span className="font-mono text-ed-text">
            %USERPROFILE%\Pictures\Frontier Developments\Elite Dangerous\
          </span>
        </p>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost text-sm" onClick={refresh}>Refresh</button>
          <button className="btn-primary text-sm" onClick={() => api()?.open_screenshots_folder()}>
            Open Folder
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-ed-muted text-sm font-mono">Loading…</p>
      ) : files.length === 0 ? (
        <EmptyState message="No screenshots found. In-game press F10 (default) to take a screenshot." />
      ) : (
        <div className="space-y-1">
          {files.map(f => (
            <div
              key={f.path}
              className="panel py-2 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-ed-text text-sm font-mono truncate">{f.name}</p>
                <p className="text-ed-muted text-xs font-mono">
                  {new Date(f.modified * 1000).toLocaleString()}
                </p>
              </div>
              <button
                className="btn-ghost text-xs shrink-0"
                onClick={() => api()?.open_file(f.path)}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'lookup',      label: 'CMDR Lookup' },
  { id: 'stats',       label: 'My Stats' },
  { id: 'logbook',     label: 'Logbook' },
  { id: 'screenshots', label: 'Screenshots' },
]

export default function Commander() {
  const [tab, setTab] = useState('lookup')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Commander</h1>
      <p className="text-ed-muted text-sm mb-5">CMDR lookup, stats, personal log, and screenshots.</p>

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

      {tab === 'lookup'      && <LookupTab />}
      {tab === 'stats'       && <StatsTab />}
      {tab === 'logbook'     && <LogbookTab />}
      {tab === 'screenshots' && <ScreenshotsTab />}
    </div>
  )
}
