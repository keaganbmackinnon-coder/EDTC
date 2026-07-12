import { useEffect, useRef, useState } from 'react'

const SCAN_DOTS = [0, 1, 2]

function fmtM(v) {
  if (!v) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} K`
  return `${v}`
}

// "Bacterium Cerbrus" + genus "Bacterium" -> "Cerbrus"
function speciesShort(name, genus) {
  if (!name) return ''
  if (genus && name.toLowerCase().startsWith(genus.toLowerCase() + ' ')) {
    return name.slice(genus.length + 1)
  }
  return name
}

// "Bacterium Cerbrus - Teal" -> "Teal"
function variantColour(variant) {
  if (!variant) return ''
  const parts = variant.split(' - ')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export default function ExoTracker() {
  const [body, setBody] = useState(null)    // exo_body payload
  const [active, setActive] = useState(null) // exo_scan in progress (count < 3)
  const [dist, setDist] = useState(null)    // exo_distance

  useEffect(() => {
    const offBody = window.__edtc?.on('exo_body', (payload) => {
      if (payload?.clear) {
        setBody(null); setActive(null); setDist(null)
      } else {
        setBody(payload)
      }
    })

    const offScan = window.__edtc?.on('exo_scan', (payload) => {
      if (payload.completed) {
        setActive(null)
        setDist(d => (d && d.species === payload.species ? null : d))
      } else {
        setActive(payload)
      }
    })

    const offDist = window.__edtc?.on('exo_distance', (payload) => setDist(payload))
    const offJump = window.__edtc?.on('system_changed', () => {
      setBody(null); setActive(null); setDist(null)
    })
    return () => { offBody(); offScan(); offDist(); offJump() }
  }, [])

  const total = body?.signal_count ?? 0
  const analysed = body?.analysed ?? 0
  const pct = total ? Math.round((analysed / total) * 100) : 0
  const complete = total > 0 && analysed >= total

  return (
    <div className="w-full h-screen flex items-start justify-center pt-2 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-4 py-2 shadow-2xl min-w-[340px] max-w-[392px]">

        {/* Header: signals | analysed + progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-ed-orange text-xs font-mono">
            Biological signals: <span className="font-semibold">{total}</span>
            <span className="text-ed-muted"> | </span>
            Analyzed: <span className="font-semibold">{analysed}</span>
          </span>
          <div className="flex-1 h-2 bg-ed-dark rounded-sm overflow-hidden border border-ed-border">
            <div className={complete ? 'h-full bg-ed-success' : 'h-full bg-ed-success/80'}
                 style={{ width: `${pct}%` }} />
          </div>
          <span className="text-ed-orange text-xs font-mono w-9 text-right">{pct}%</span>
        </div>

        {/* Genus chips: "Bacterium|500m", struck through when done */}
        {body?.species?.length > 0 && !active && (
          <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs">
            {body.species.map(sp => (
              <span key={sp.genus}
                    className={sp.state === 'done'
                      ? 'text-ed-muted line-through'
                      : 'text-ed-gold'}>
                {sp.genus}{sp.state !== 'done' && sp.distance ? `|${sp.distance}m` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Active sampling card */}
        {active && !complete && <SamplingCard active={active} dist={dist} />}

        {/* Sample-distance radar: exclusion zones around taken samples */}
        {active && !complete && dist?.sample_points?.length > 0 && <Radar dist={dist} />}

        {/* Idle hint / complete banner */}
        {!active && (
          <p className={`mt-1.5 text-center text-[11px] font-mono border-t border-ed-orange/40 pt-1 ${complete ? 'text-ed-orange' : 'text-ed-orange/80'}`}>
            {complete
              ? `All signals scanned${body?.ff ? ' with FF bonus applied' : ''}`
              : body
                ? 'Use Composition Scanner to sample tracker targets'
                : 'No biological signals tracked'}
          </p>
        )}

        {/* Body bio panel: per-species lifecycle rows */}
        {body?.species?.length > 0 && <BioPanel body={body} />}
      </div>
    </div>
  )
}

function SamplingCard({ active, dist }) {
  const ff = active.was_logged === false
  const value = ff ? (active.value || 0) * 5 : (active.value || 0)
  const name = active.variant || active.species || 'Unknown species'
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 shrink-0">
          {SCAN_DOTS.map(i => (
            <span key={i}
                  className={`w-4 h-4 rounded-full border-2 ${
                    i < active.scan_count
                      ? 'bg-ed-orange border-ed-orange'
                      : 'bg-transparent border-ed-orange/60'
                  }`} />
          ))}
        </div>
        <p className="text-ed-text text-base font-ui font-semibold truncate">{name}</p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-ed-success text-xs font-mono shrink-0">
          {fmtM(value)} CR{ff ? ' (FF bonus)' : ''}
        </span>
        {dist && <DistanceBar dist={dist} />}
      </div>
    </div>
  )
}

function DistanceBar({ dist }) {
  const pct = dist.required ? Math.min(100, (dist.distance / dist.required) * 100) : 100
  return (
    <div className="flex-1 flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-ed-dark border border-ed-border overflow-hidden">
        <div className={`h-full ${dist.clear ? 'bg-ed-success' : 'bg-ed-orange'}`}
             style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono shrink-0 ${dist.clear ? 'text-ed-success' : 'text-ed-orange'}`}>
        {dist.clear ? '✓' : `${Math.round(dist.distance)}/`}{dist.required}m
      </span>
    </div>
  )
}

function fmtDist(m) {
  if (m == null) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`
}

const ORDINAL = ['1st', '2nd', '3rd']

function Radar({ dist }) {
  const canvasRef = useRef(null)
  const W = 300, H = 210

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { lat, lon, heading, radius, required, sample_points } = dist
    ctx.clearRect(0, 0, W, H)

    // Local tangent-plane offsets (metres) from the player, heading-up view
    const h = ((heading ?? 0) * Math.PI) / 180
    const toRad = Math.PI / 180
    const pts = sample_points.map(p => {
      const dx = (p.lon - lon) * toRad * Math.cos(lat * toRad) * radius // east
      const dy = (p.lat - lat) * toRad * radius                        // north
      return {
        x: dx * Math.cos(h) - dy * Math.sin(h),
        y: -(dy * Math.cos(h) + dx * Math.sin(h)),
        dist: p.dist,
      }
    })

    // Scale: keep the farthest exclusion circle in frame
    const req = required || 100
    const extent = Math.max(req * 1.4, ...pts.map(p => Math.hypot(p.x, p.y) + req * 0.4))
    const scale = (Math.min(W, H) / 2 - 8) / extent
    const cx = W / 2, cy = H / 2

    // Exclusion zone per sample
    pts.forEach(p => {
      const px = cx + p.x * scale, py = cy + p.y * scale
      ctx.beginPath()
      ctx.arc(px, py, Math.max(4, req * scale), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(51, 204, 102, 0.25)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(51, 204, 102, 0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // Heading-up crosshair through the player (north/east axes, rotated)
    ctx.strokeStyle = 'rgba(204, 51, 51, 0.7)'
    ctx.lineWidth = 1
    const L = Math.max(W, H)
    ;[h, h + Math.PI / 2].forEach(a => {
      ctx.beginPath()
      ctx.moveTo(cx - Math.sin(a) * L, cy + Math.cos(a) * L)
      ctx.lineTo(cx + Math.sin(a) * L, cy - Math.cos(a) * L)
      ctx.stroke()
    })

    // Player marker
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.strokeStyle = '#33cc66'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [dist])

  return (
    <div className="mt-1.5 border-t border-ed-orange/40 pt-1">
      <div className="flex justify-between text-[11px] font-mono text-ed-orange px-1">
        <span>Ship: <span className="text-ed-text">{fmtDist(dist.ship_dist)}</span></span>
        <span className={dist.clear ? 'text-ed-success' : 'text-ed-orange'}>
          {dist.clear ? 'Clear to sample ✓' : `Move ${fmtDist(Math.max(0, dist.required - dist.distance))}`}
        </span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="mx-auto block" />
      <div className="flex justify-center gap-4 text-[11px] font-mono text-ed-orange">
        {dist.sample_points.map((p, i) => (
          <span key={i}>{ORDINAL[i] || `${i + 1}th`}: <span className="text-ed-text">{fmtDist(p.dist)}</span></span>
        ))}
      </div>
    </div>
  )
}

function BioPanel({ body }) {
  return (
    <div className="mt-1.5 border-t border-ed-orange/40 pt-1">
      <p className="text-ed-orange text-[11px] font-mono mb-1">
        Body {body.body_name || body.body_id} bio signals: {body.signal_count}
      </p>
      <div className="space-y-1">
        {body.species.map(sp => <SpeciesRow key={sp.genus + sp.name} sp={sp} />)}
      </div>
      <p className="text-ed-orange text-[11px] font-mono mt-1.5">
        Rewards: {fmtM(body.rewards)}
        {body.ff && <span className="text-ed-gold"> (FF bonus: {fmtM(body.rewards * 5)})</span>}
      </p>
    </div>
  )
}

function SpeciesRow({ sp }) {
  const short = speciesShort(sp.name, sp.genus)
  const colour = variantColour(sp.variant)
  const predicted = sp.state === 'predicted'
  const done = sp.state === 'done'
  const sampling = sp.state === 'sampling'
  return (
    <div className={`px-1.5 py-0.5 font-mono text-xs border-l-2 border-r-2 ${
      sampling ? 'border-ed-success bg-ed-success/10' : 'border-transparent'
    } ${done ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate ${
          predicted ? 'text-ed-gold'
            : done ? 'text-ed-muted line-through'
            : 'text-ed-success'
        }`}>
          {predicted
            ? `?${short || sp.genus}${colour ? `: ?${colour}?` : '?'}`
            : `${short}${colour ? `: ${colour}` : ''}`}
        </span>
        {sampling && (
          <span className="text-ed-success text-[10px] shrink-0">{sp.scan_count}/3</span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={done ? 'text-ed-muted' : 'text-ed-text/80'}>{sp.genus}</span>
        <span className={done ? 'text-ed-muted' : 'text-ed-success'}>{fmtM(sp.value)}</span>
      </div>
    </div>
  )
}
