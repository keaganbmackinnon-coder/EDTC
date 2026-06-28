import { useState, useEffect } from 'react'

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

// ---- Tab: Commodity Search ----

const SORT_OPTIONS = [
  { id: 'distance',   label: 'Closest first', fn: (a, b) => {
    if (a.distance == null && b.distance == null) return 0
    if (a.distance == null) return 1
    if (b.distance == null) return -1
    return a.distance - b.distance
  }},
  { id: 'buy_asc',    label: 'Buy ↑',      fn: (a, b) => a.buy_price - b.buy_price },
  { id: 'buy_desc',   label: 'Buy ↓',      fn: (a, b) => b.buy_price - a.buy_price },
  { id: 'sell_asc',   label: 'Sell ↑',     fn: (a, b) => a.sell_price - b.sell_price },
  { id: 'sell_desc',  label: 'Sell ↓',     fn: (a, b) => b.sell_price - a.sell_price },
  { id: 'supply',     label: 'Supply ↓',   fn: (a, b) => b.supply - a.supply },
  { id: 'demand',     label: 'Demand ↓',   fn: (a, b) => b.demand - a.demand },
]

function CommoditySearchTab({ currentSystem, commodities }) {
  const [query, setQuery] = useState('')
  const [system, setSystem] = useState(currentSystem ?? '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [sortId, setSortId] = useState('distance')

  useEffect(() => {
    if (currentSystem && !system) setSystem(currentSystem)
  }, [currentSystem])

  const suggestions = commodities.filter(c =>
    query.length >= 2 && c.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  async function doSearch(commodityName) {
    const name = commodityName ?? query
    const sys = system.trim()
    if (!name || !sys) return
    setLoading(true)
    setResults(null)
    setError(null)
    const r = await api()?.search_commodity_markets(sys, name)
    if (Array.isArray(r)) {
      setResults(r)
    } else {
      setError('Search failed — check system name and try again')
    }
    setLoading(false)
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Find stations buying or selling a commodity. Live data from EDDN (real-time) merged with Spansh (galaxy-wide). Distance from your reference system.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <input
            className="input font-mono text-sm w-full"
            placeholder="Commodity name…"
            value={query}
            onChange={e => { setQuery(e.target.value); setResults(null) }}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            list="commodity-list"
          />
          <datalist id="commodity-list">
            {[...commodities].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div className="flex gap-2">
          <input
            className="input font-mono text-sm flex-1"
            placeholder="Reference system…"
            value={system}
            onChange={e => setSystem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          <button
            className="btn-primary text-sm disabled:opacity-40"
            onClick={() => doSearch()}
            disabled={loading || !query.trim() || !system.trim()}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {currentSystem && system !== currentSystem && (
            <button className="btn-ghost text-sm" onClick={() => setSystem(currentSystem)}>
              Current
            </button>
          )}
        </div>
      </div>

      {suggestions.length > 0 && !results && !loading && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {suggestions.map(c => (
            <button
              key={c.id}
              className="text-xs font-mono px-2 py-0.5 rounded border border-ed-border text-ed-muted hover:border-ed-orange/50 hover:text-ed-text"
              onClick={() => { setQuery(c.name); doSearch(c.name) }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {error && <ErrorBanner error={error} />}

      {results && results.length === 0 && (
        <EmptyState message="No stations found carrying this commodity. Try a different name or check spelling." />
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-ed-muted text-xs font-mono">{results.length} stations · Sort:</span>
            {SORT_OPTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSortId(s.id)}
                className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                  sortId === s.id
                    ? 'border-ed-orange text-ed-orange'
                    : 'border-ed-border text-ed-muted hover:border-ed-orange/50 hover:text-ed-text'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {[...results].sort(SORT_OPTIONS.find(s => s.id === sortId)?.fn).map((r, i) => (
            <div key={i} className="panel">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-ed-text font-semibold font-ui truncate">{r.station}</p>
                    {r.source === 'eddn' && <span className="text-xs font-mono text-ed-success border border-ed-success/30 rounded px-1">EDDN</span>}
                    {r.is_planetary && <span className="text-xs font-mono text-ed-muted border border-ed-border rounded px-1">Planetary</span>}
                    {r.has_large_pad === false && <span className="text-xs font-mono text-yellow-500 border border-yellow-500/30 rounded px-1">No Large Pad</span>}
                  </div>
                  <p className="text-ed-muted text-xs font-mono">
                    {r.system}
                    {r.distance != null ? ` · ${r.distance} ly` : ''}
                    {r.distance_to_arrival > 0 ? ` · ${r.distance_to_arrival.toLocaleString()} ls` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-xs font-mono flex-wrap">
                {r.buy_price > 0 && (
                  <span>
                    <span className="text-ed-muted">Buy </span>
                    <span className="text-ed-success">{fmtCr(r.buy_price)} Cr</span>
                    {r.supply > 0 && <span className="text-ed-muted ml-1">({fmtNum(r.supply)}T)</span>}
                  </span>
                )}
                {r.sell_price > 0 && (
                  <span>
                    <span className="text-ed-muted">Sell </span>
                    <span className="text-ed-orange">{fmtCr(r.sell_price)} Cr</span>
                    {r.demand > 0 && <span className="text-ed-muted ml-1">({fmtNum(r.demand)} demand)</span>}
                  </span>
                )}
                {r.updated_at && (
                  <span className="text-ed-muted ml-auto">Updated {new Date(r.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!results && !loading && !error && (
        <EmptyState message="Enter a commodity and reference system to search." />
      )}
    </div>
  )
}

// ---- Tab: Nearest Service ----

const SERVICES = [
  'Large Pad',
  'Medium Pad',
  'Shipyard',
  'Outfitting',
  'Black Market',
  'Material Trader',
  'Technology Broker',
  'Interstellar Factor',
  'Universal Cartographics',
  'Refuel',
  'Repair',
  'Restock',
]

function NearestServiceTab({ currentSystem }) {
  const [system, setSystem] = useState(currentSystem ?? '')
  const [service, setService] = useState('Large Pad')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (currentSystem && !system) setSystem(currentSystem)
  }, [currentSystem])

  async function doSearch() {
    const sys = system.trim()
    if (!sys) return
    setLoading(true)
    setResult(null)
    setError(null)
    const r = await api()?.find_nearest_service(sys, service)
    if (r?.error) {
      setError(r.error)
    } else {
      setResult(r)
    }
    setLoading(false)
  }

  const stations = result?.stations ?? []

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Find the nearest station with a specific service. Data via Spansh.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2 flex-wrap">
          {SERVICES.map(s => (
            <button
              key={s}
              onClick={() => setService(s)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${service === s ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input font-mono text-sm flex-1"
            placeholder="Reference system…"
            value={system}
            onChange={e => setSystem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          <button
            className="btn-primary text-sm disabled:opacity-40"
            onClick={doSearch}
            disabled={loading || !system.trim()}
          >
            {loading ? 'Searching…' : 'Find Nearest'}
          </button>
          {currentSystem && system !== currentSystem && (
            <button className="btn-ghost text-sm" onClick={() => setSystem(currentSystem)}>
              Current
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {result && !error && (
        <div className="panel">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-ed-orange font-semibold font-ui text-lg">{result.name}</p>
              <p className="text-ed-muted text-xs font-mono mt-0.5">
                {result.distance != null ? `${Number(result.distance).toFixed(2)} ly away` : ''}
              </p>
            </div>
          </div>
          {stations.length > 0 && (
            <div className="space-y-2">
              {stations.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm font-mono">
                  <span className="text-ed-text">{s.name ?? s}</span>
                  <div className="flex gap-3 text-ed-muted text-xs">
                    {s.type && <span>{s.type}</span>}
                    {s.distance_to_star != null && (
                      <span>{Math.round(s.distance_to_star).toLocaleString()} ls</span>
                    )}
                    {s.max_landing_pad && (
                      <span className="text-ed-orange">Pad {s.max_landing_pad}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState message="Select a service type and enter a system." />
      )}
    </div>
  )
}

// ---- Tab: Trade History ----

function TradeHistoryTab() {
  const [log, setLog] = useState([])
  const [filter, setFilter] = useState('All')

  const load = () => api()?.get_trade_log().then(r => setLog(r ?? []))

  useEffect(() => { load() }, [])

  useEffect(() => {
    const off = window.__edtc?.on('trade_log_update', () => load())
    return () => off?.()
  }, [])

  async function clearLog() {
    await api()?.clear_trade_log()
    setLog([])
  }

  const filtered = log.filter(e => filter === 'All' || e.type === filter.toLowerCase())

  const totalBuy  = log.filter(e => e.type === 'buy').reduce((s, e) => s + e.total, 0)
  const totalSell = log.filter(e => e.type === 'sell').reduce((s, e) => s + e.total, 0)
  const totalProfit = log.filter(e => e.type === 'sell').reduce((s, e) => s + e.profit, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          Auto-tracked from journal. Docked then bought/sold = recorded here.
        </p>
        <button className="btn-ghost text-sm text-ed-danger hover:border-ed-danger/50" onClick={clearLog}>
          Clear Log
        </button>
      </div>

      {log.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="panel text-center">
            <p className="text-ed-danger font-mono font-semibold">{fmtCr(totalBuy)} Cr</p>
            <p className="text-ed-muted text-xs font-mono mt-0.5">Spent</p>
          </div>
          <div className="panel text-center">
            <p className="text-ed-success font-mono font-semibold">{fmtCr(totalSell)} Cr</p>
            <p className="text-ed-muted text-xs font-mono mt-0.5">Earned</p>
          </div>
          <div className="panel text-center">
            <p className={`font-mono font-semibold ${totalProfit >= 0 ? 'text-ed-gold' : 'text-ed-danger'}`}>
              {totalProfit >= 0 ? '+' : ''}{fmtCr(totalProfit)} Cr
            </p>
            <p className="text-ed-muted text-xs font-mono mt-0.5">Net Profit</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {['All', 'Buy', 'Sell'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-mono px-3 py-1 rounded border transition-colors ${filter === f ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
          >
            {f}
          </button>
        ))}
        <button className="btn-ghost text-xs ml-auto" onClick={load}>Refresh</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={log.length === 0
          ? "No trades recorded yet. Dock at a station and buy/sell with EDTC running."
          : "No entries match the current filter."
        } />
      ) : (
        <div className="space-y-1">
          {filtered.map(e => (
            <div key={e.id} className="panel py-2 flex items-center gap-3">
              <span className={`text-xs font-mono font-semibold w-7 shrink-0 ${e.type === 'sell' ? 'text-ed-success' : 'text-ed-danger'}`}>
                {e.type === 'sell' ? 'SELL' : 'BUY'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-ed-text text-sm font-mono truncate">{e.commodity}</p>
                <p className="text-ed-muted text-xs font-mono">
                  {e.station || e.system || '—'}
                  {e.station && e.system ? ` · ${e.system}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono text-ed-muted">×{fmtNum(e.quantity)}</p>
                <p className={`text-sm font-mono font-semibold ${e.type === 'sell' ? 'text-ed-success' : 'text-ed-text'}`}>
                  {e.type === 'sell' ? '+' : '-'}{fmtCr(e.total)} Cr
                </p>
                {e.type === 'sell' && e.profit !== 0 && (
                  <p className={`text-xs font-mono ${e.profit >= 0 ? 'text-ed-gold' : 'text-ed-danger'}`}>
                    {e.profit >= 0 ? '+' : ''}{fmtCr(e.profit)} profit
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Commodity Prices ----

function CommodityPricesTab() {
  const [commodities, setCommodities] = useState([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')

  useEffect(() => {
    api()?.get_commodities().then(r => setCommodities(r ?? []))
  }, [])

  const allCats = ['All', ...new Set(commodities.map(c => c.category))].sort((a, b) =>
    a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)
  )

  const filtered = commodities.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.name.toLowerCase().includes(q))
      && (filterCat === 'All' || c.category === filterCat)
  })

  const maxPrice = Math.max(...filtered.map(c => c.average_price ?? 0), 1)

  return (
    <div>
      <div className="panel mb-4">
        <p className="text-ed-muted text-xs font-mono">
          Average prices are indicative only. Live prices vary by station economy and supply/demand.
          Replace <span className="text-ed-text">data/commodities.json</span> with the full EDCD
          commodity dataset for complete coverage.
        </p>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          className="input font-mono text-sm flex-1"
          placeholder="Filter commodities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {allCats.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterCat === c ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No commodities found." />
      ) : (
        <div className="space-y-1">
          {filtered
            .sort((a, b) => (b.average_price ?? 0) - (a.average_price ?? 0))
            .map(c => {
              const pct = Math.round(((c.average_price ?? 0) / maxPrice) * 100)
              return (
                <div key={c.id} className="panel py-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div>
                      <span className="text-ed-text font-mono">{c.name}</span>
                      <span className="text-ed-muted text-xs font-mono ml-2">{c.category}</span>
                    </div>
                    <span className="text-ed-orange font-mono font-semibold">
                      ~{fmtCr(c.average_price)} Cr
                    </span>
                  </div>
                  <div className="h-1 bg-ed-dark rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-ed-orange/50" style={{ width: `${pct}%` }} />
                  </div>
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
  { id: 'search',   label: 'Commodity Search' },
  { id: 'service',  label: 'Nearest Service' },
  { id: 'history',  label: 'Trade History' },
  { id: 'prices',   label: 'Commodity Prices' },
]

export default function Trading() {
  const [tab, setTab] = useState('search')
  const [currentSystem, setCurrentSystem] = useState('')
  const [commodities, setCommodities] = useState([])

  useEffect(() => {
    api()?.get_current_system().then(s => setCurrentSystem(s ?? ''))
    api()?.get_commodities().then(r => setCommodities(r ?? []))
  }, [])

  useEffect(() => {
    const off = window.__edtc?.on('system_changed', e => {
      setCurrentSystem(e?.payload?.system ?? '')
    })
    return () => off?.()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Trading</h1>
      <p className="text-ed-muted text-sm mb-5">Commodity search, station finder, and trade history.</p>

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

      {tab === 'search'  && <CommoditySearchTab currentSystem={currentSystem} commodities={commodities} />}
      {tab === 'service' && <NearestServiceTab currentSystem={currentSystem} />}
      {tab === 'history' && <TradeHistoryTab />}
      {tab === 'prices'  && <CommodityPricesTab />}
    </div>
  )
}
