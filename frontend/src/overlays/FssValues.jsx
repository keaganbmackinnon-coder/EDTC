import { useEffect, useState } from 'react'

function formatCr(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

function bodyColor(cls) {
  const c = cls?.toLowerCase() ?? ''
  if (c.includes('earthlike')) return 'text-ed-success'
  if (c.includes('ammonia')) return 'text-purple-400'
  if (c.includes('water world')) return 'text-blue-400'
  if (c.includes('metal rich')) return 'text-yellow-400'
  if (c.includes('terraformable') || c.includes('terraform')) return 'text-ed-gold'
  return 'text-ed-text'
}

export default function FssValues() {
  const [bodies, setBodies] = useState([])

  useEffect(() => {
    const off = window.__edtc?.on('body_scanned', (payload) => {
      setBodies(payload.all_bodies ?? [])
    })

    // Clear on new system
    const offJump = window.__edtc?.on('system_jumped', () => setBodies([]))

    return () => { off(); offJump() }
  }, [])

  const valuable = [...bodies].sort((a, b) => b.value - a.value).slice(0, 8)
  const total = bodies.reduce((s, b) => s + b.value, 0)

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-border rounded-lg px-4 py-3 shadow-2xl min-w-[290px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">FSS Values</span>
          {total > 0 && (
            <span className="text-ed-gold text-xs font-mono">~{formatCr(total)} total</span>
          )}
        </div>

        {valuable.length === 0 ? (
          <p className="text-ed-muted text-xs font-mono">Scanning…</p>
        ) : (
          <div className="space-y-1">
            {valuable.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-mono truncate ${bodyColor(b.class)}`}>
                    {b.body.split(' ').pop()}
                    {b.terraformable && <span className="ml-1 text-ed-gold text-[10px]">TF</span>}
                  </p>
                  <p className="text-[10px] text-ed-muted truncate">{b.class}</p>
                </div>
                <span className="text-ed-orange text-xs font-mono shrink-0">
                  {formatCr(b.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
