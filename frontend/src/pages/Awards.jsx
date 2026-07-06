import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// Rarity → colour. Tuned for the dark ED theme; legendary gets a glow.
const RARITY = {
  bronze:    { ring: '#c8813e', glow: 'rgba(200,129,62,0.35)',  label: 'Bronze' },
  silver:    { ring: '#b9c4cf', glow: 'rgba(185,196,207,0.30)', label: 'Silver' },
  gold:      { ring: '#f5b942', glow: 'rgba(245,185,66,0.40)',  label: 'Gold' },
  elite:     { ring: '#c084fc', glow: 'rgba(192,132,252,0.45)', label: 'Elite' },
  legendary: { ring: '#4fd1c5', glow: 'rgba(79,209,197,0.55)',  label: 'Legendary' },
}
const LOCKED = { ring: '#3a4048', glow: 'transparent', label: 'Locked' }

function fmtValue(unit, n) {
  if (unit === 'flag') return ''
  if (unit === 'cr') {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
    if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M'
    if (n >= 1e3)  return (n / 1e3).toFixed(0) + 'k'
    return String(n)
  }
  if (unit === 'hours') return n.toLocaleString() + ' h'
  if (unit === 'ly')    return n.toLocaleString() + ' ly'
  return n.toLocaleString()
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Little pips showing which tiers of a ladder you've reached.
function TierPips({ earned, max, ring }) {
  if (max < 1) return null
  return (
    <div className="flex gap-1 mt-1">
      {Array.from({ length: max + 1 }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-4 rounded-full"
          style={{ background: i <= earned ? ring : '#2a2f36' }}
        />
      ))}
    </div>
  )
}

function Medal({ a }) {
  const earned = a.earned_tier >= 0
  const r = earned ? (RARITY[a.style] || RARITY.gold) : LOCKED
  return (
    <div
      className="panel flex gap-3 items-start"
      style={{ opacity: earned ? 1 : 0.72, borderColor: earned ? r.ring + '55' : undefined }}
    >
      {/* Medal disc */}
      <div className="shrink-0 relative">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{
            border: `2px solid ${r.ring}`,
            boxShadow: earned ? `0 0 14px ${r.glow}` : 'none',
            background: earned
              ? `radial-gradient(circle at 30% 25%, ${r.ring}33, #12151a 70%)`
              : '#14171c',
            filter: earned ? 'none' : 'grayscale(1)',
          }}
        >
          <span style={{ opacity: earned ? 1 : 0.5 }}>{a.icon}</span>
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-ui font-semibold text-ed-text">{a.name}</span>
          {earned && (
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: r.ring, border: `1px solid ${r.ring}66` }}
            >
              {r.label}
            </span>
          )}
        </div>
        <p className="text-ed-muted text-xs mt-0.5">{a.desc}</p>

        {!a.is_single && <TierPips earned={a.earned_tier} max={a.max_tier} ring={r.ring} />}

        {/* Progress / status line */}
        <div className="mt-2">
          {a.next_threshold != null ? (
            <>
              <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${a.next_pct}%`, background: earned ? r.ring : '#5a6672' }}
                />
              </div>
              <p className="text-[11px] font-mono text-ed-muted mt-1">
                {a.unit === 'flag'
                  ? 'Not yet earned'
                  : <>
                      <span className="text-ed-text">{fmtValue(a.unit, a.value)}</span>
                      {' / '}{fmtValue(a.unit, a.next_threshold)}
                      <span className="text-ed-muted"> to {RARITY[nextStyle(a)]?.label ?? 'next'}</span>
                    </>}
              </p>
            </>
          ) : (
            <p className="text-[11px] font-mono" style={{ color: r.ring }}>
              ★ Maxed out{a.earned_at ? ` · ${fmtDate(a.earned_at)}` : ''}
            </p>
          )}
          {earned && a.next_threshold != null && a.earned_at && (
            <p className="text-[10px] font-mono text-ed-muted mt-0.5">earned {fmtDate(a.earned_at)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Rarity name of the *next* tier (for "X to Gold").
function nextStyle(a) {
  const order = ['bronze', 'silver', 'gold', 'elite', 'legendary']
  const nextIdx = a.earned_tier + 1
  if (a.style === 'legendary' || a.is_single) return 'legendary'
  return order[Math.min(nextIdx, order.length - 1)]
}

function Toast({ items, onDone }) {
  useEffect(() => {
    if (!items.length) return
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [items, onDone])
  if (!items.length) return null
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {items.map((n, i) => {
        const r = RARITY[n.style] || RARITY.gold
        return (
          <div
            key={i}
            className="panel flex items-center gap-3 animate-[fadeIn_0.3s_ease]"
            style={{ borderColor: r.ring, boxShadow: `0 0 18px ${r.glow}` }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ border: `2px solid ${r.ring}`, boxShadow: `0 0 10px ${r.glow}` }}
            >
              {n.icon}
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: r.ring }}>
                Award unlocked · {n.tier_label}
              </p>
              <p className="font-ui font-semibold text-ed-text text-sm">{n.name}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'progress', label: 'In Progress' },
]

export default function Awards() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [cat, setCat] = useState('All')
  const [toast, setToast] = useState([])

  useEffect(() => {
    api()?.get_awards?.().then(d => {
      setData(d)
      if (d?.newly?.length) setToast(d.newly)
    })
    const off = window.__edtc?.on('awards_earned', payload => {
      const n = payload?.newly ?? []
      if (n.length) {
        setToast(n)
        // refresh the grid so the medal updates in place
        api()?.get_awards?.().then(setData)
      }
    })
    return () => off?.()
  }, [])

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Commendations</h1>
        <p className="text-ed-muted text-sm font-mono mt-4">
          Loading… (awards populate once you've logged into Elite with EDTC running).
        </p>
      </div>
    )
  }

  const cats = ['All', ...(data.categories ?? [])]
  const overallPct = data.total_count ? Math.round((data.earned_count / data.total_count) * 100) : 0

  const shown = (data.awards ?? []).filter(a => {
    if (cat !== 'All' && a.category !== cat) return false
    if (filter === 'earned' && a.earned_tier < 0) return false
    if (filter === 'progress' && (a.earned_tier === a.max_tier)) return false
    return true
  })

  // group by category for display
  const groups = {}
  for (const a of shown) (groups[a.category] ??= []).push(a)

  return (
    <div className="p-6">
      <Toast items={toast} onDone={() => setToast([])} />

      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Commendations</h1>
      <p className="text-ed-muted text-sm mb-5">Milestones earned across your career, CMDR. Keep flying.</p>

      {/* Summary */}
      <div className="panel mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-6">
            <div>
              <p className="text-ed-orange font-mono text-2xl font-semibold leading-none">
                {data.earned_count}<span className="text-ed-muted text-base">/{data.total_count}</span>
              </p>
              <p className="text-ed-muted text-xs mt-1">awards earned</p>
            </div>
            <div>
              <p className="text-ed-text font-mono text-2xl font-semibold leading-none">{data.medals}</p>
              <p className="text-ed-muted text-xs mt-1">total medals</p>
            </div>
          </div>
          <div className="flex-1 min-w-[180px] max-w-sm">
            <div className="h-2 bg-ed-dark rounded-full overflow-hidden">
              <div className="h-full bg-ed-orange rounded-full transition-all duration-500"
                   style={{ width: `${overallPct}%` }} />
            </div>
            <p className="text-ed-muted text-xs font-mono mt-1 text-right">{overallPct}% complete</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
              filter === f.id
                ? 'border-ed-orange text-ed-orange'
                : 'border-ed-border text-ed-muted hover:text-ed-text'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="w-px h-4 bg-ed-border mx-1" />
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
              cat === c
                ? 'border-ed-orange text-ed-orange'
                : 'border-ed-border text-ed-muted hover:text-ed-text'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-ed-muted text-sm font-mono">Nothing here with those filters.</p>
      ) : (
        Object.entries(groups).map(([category, list]) => (
          <div key={category} className="mb-6">
            <h2 className="text-ed-muted text-xs font-mono uppercase tracking-wider mb-2">{category}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map(a => <Medal key={a.id} a={a} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
