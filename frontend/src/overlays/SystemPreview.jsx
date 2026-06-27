import { useEffect, useState } from 'react'

function pop(n) {
  if (!n) return 'Uninhabited'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

function starClass(cls) {
  const map = {
    O: 'text-blue-300', B: 'text-blue-200', A: 'text-blue-100',
    F: 'text-yellow-100', G: 'text-yellow-300', K: 'text-orange-300',
    M: 'text-red-400', L: 'text-red-600', T: 'text-red-800',
    N: 'text-purple-300', H: 'text-gray-400',
  }
  return map[cls] ?? 'text-ed-text'
}

export default function SystemPreview() {
  const [system, setSystem] = useState(null)

  useEffect(() => {
    const offJump = window.__edtc.on('system_jumped', (payload) => {
      setSystem({ ...payload, body_count: null })
    })

    const offFss = window.__edtc.on('fss_discovery', (payload) => {
      setSystem(prev => prev
        ? { ...prev, body_count: payload.body_count }
        : null
      )
    })

    return () => { offJump(); offFss() }
  }, [])

  if (!system) return null

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[340px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">System Jump</span>
          {system.star_class && (
            <span className={`text-xs font-mono font-bold ${starClass(system.star_class)}`}>
              {system.star_class}-class
            </span>
          )}
        </div>

        <p className="text-ed-orange font-mono text-base font-bold leading-tight mb-2">
          {system.system}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
          {system.body_count != null && (
            <Row label="Bodies" value={system.body_count} />
          )}
          {system.allegiance && <Row label="Allegiance" value={system.allegiance} />}
          {system.security && (
            <Row label="Security" value={system.security.replace('$GAlAXY_MAP_INFO_state_', '').replace(';', '')} />
          )}
          {system.economy && <Row label="Economy" value={system.economy} />}
          {system.population != null && <Row label="Population" value={pop(system.population)} />}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <>
      <span className="text-ed-muted">{label}</span>
      <span className="text-ed-text truncate">{value}</span>
    </>
  )
}
