import { useState, useEffect, useMemo } from 'react'

const api = () => window?.pywebview?.api

// Backend (coriolis) core-internal slot order — see build_data.CORE_SLOT_NAMES
const CORE_NAMES = [
  'Power Plant', 'Thrusters', 'Frame Shift Drive', 'Life Support',
  'Power Distributor', 'Sensors', 'Fuel Tank',
]

const PAD_LABEL = { 1: 'Small', 2: 'Medium', 3: 'Large' }

// Hardpoint size → colour + short code + chip footprint (bigger mount = bigger chip)
const HP_STYLE = {
  Huge:   { code: 'H', color: '#f87171', w: 46, h: 32 },
  Large:  { code: 'L', color: '#fb923c', w: 40, h: 28 },
  Medium: { code: 'M', color: '#facc15', w: 34, h: 24 },
  Small:  { code: 'S', color: '#38bdf8', w: 28, h: 20 },
}
const HP_ORDER = ['Huge', 'Large', 'Medium', 'Small']
const HP_BY_SIZE = { 4: 'Huge', 3: 'Large', 2: 'Medium', 1: 'Small' }

// ---------------------------------------------------------------------------
// Ship wireframe — a generated angled 3D "roll cage" in the shape of the hull.
// There are no bundled ship models in the EDCD ecosystem, so each ship is a
// lofted hull: octagonal cross-section rings ("hoops") sampled along the length
// with longitudinal rails, projected at a 3/4 angle with depth-based dimming.
// Shape comes from a per-family profile of [z, halfWidth, halfHeight] stations
// (nose z=0 → tail z=1), scaled by pad size.
// ---------------------------------------------------------------------------

const FAMILY_PROFILES = {
  wedge:     { length: 1.5, stations: [[0,0.05,0.05],[0.30,0.5,0.16],[0.6,0.9,0.20],[0.78,1.0,0.18],[0.90,0.6,0.12],[1,0.34,0.07]] },
  dart:      { length: 1.8, stations: [[0,0.03,0.03],[0.15,0.10,0.06],[0.35,0.20,0.10],[0.55,0.34,0.13],[0.72,0.78,0.14],[0.82,1.0,0.12],[0.92,0.5,0.08],[1,0.22,0.05]] },
  fighter:   { length: 1.7, stations: [[0,0.03,0.04],[0.2,0.14,0.09],[0.45,0.3,0.14],[0.66,0.7,0.16],[0.8,1.0,0.13],[1,0.3,0.06]] },
  vulture:   { length: 1.5, stations: [[0,0.05,0.06],[0.2,0.2,0.14],[0.45,0.4,0.20],[0.62,1.0,0.20],[0.78,0.7,0.14],[1,0.34,0.08]] },
  multirole: { length: 1.9, stations: [[0,0.04,0.05],[0.18,0.16,0.10],[0.40,0.34,0.18],[0.60,0.55,0.24],[0.75,0.80,0.24],[0.86,0.6,0.17],[1,0.3,0.08]] },
  bulk:      { length: 1.9, stations: [[0,0.05,0.06],[0.16,0.22,0.16],[0.4,0.5,0.30],[0.6,0.7,0.34],[0.75,0.85,0.30],[0.88,0.6,0.20],[1,0.32,0.10]] },
  explorer:  { length: 2.1, stations: [[0,0.03,0.04],[0.12,0.10,0.08],[0.30,0.30,0.16],[0.5,0.5,0.22],[0.62,0.62,0.22],[0.78,1.0,0.20],[0.9,0.55,0.12],[1,0.28,0.07]] },
  hauler:    { length: 1.8, stations: [[0,0.05,0.08],[0.18,0.24,0.20],[0.42,0.4,0.34],[0.66,0.44,0.36],[0.84,0.4,0.30],[1,0.26,0.16]] },
  trader:    { length: 2.3, stations: [[0,0.06,0.10],[0.12,0.30,0.24],[0.30,0.55,0.40],[0.55,0.80,0.48],[0.80,1.0,0.50],[0.92,0.8,0.40],[1,0.5,0.22]] },
  liner:     { length: 2.4, stations: [[0,0.03,0.05],[0.12,0.14,0.14],[0.30,0.36,0.34],[0.5,0.52,0.46],[0.66,0.5,0.44],[0.82,0.4,0.34],[1,0.22,0.14]] },
  spear:     { length: 3.1, stations: [[0,0.02,0.03],[0.15,0.08,0.06],[0.4,0.22,0.14],[0.6,0.34,0.18],[0.78,0.5,0.20],[0.88,1.0,0.18],[0.95,0.6,0.12],[1,0.3,0.06]] },
  capital:   { length: 2.8, stations: [[0,0.03,0.04],[0.15,0.14,0.10],[0.38,0.34,0.20],[0.58,0.55,0.28],[0.72,1.0,0.30],[0.85,0.7,0.22],[1,0.35,0.10]] },
}

// ship name → hull family (fallback by pad size below)
const SHIP_FAMILY = {
  'Sidewinder Mk I': 'wedge', 'Sidewinder': 'wedge',
  'Eagle': 'fighter', 'Imperial Eagle': 'fighter', 'Viper Mk III': 'dart',
  'Viper Mk IV': 'dart', 'Imperial Courier': 'dart', 'Mamba': 'dart',
  'Fer-de-Lance': 'dart',
  'Hauler': 'hauler', 'Adder': 'hauler', 'Dolphin': 'liner',
  'Cobra Mk III': 'multirole', 'Cobra Mk IV': 'multirole', 'Cobra Mk V': 'multirole',
  'Keelback': 'multirole', 'Vulture': 'vulture',
  'Asp Explorer': 'explorer', 'Asp Scout': 'explorer', 'Diamondback Explorer': 'explorer',
  'Diamondback Scout': 'explorer', 'Krait Phantom': 'explorer', 'Mandalay': 'explorer',
  'Caspian Explorer': 'explorer', 'Nomad': 'fighter',
  'Krait Mk II': 'bulk', 'Python': 'bulk', 'Python Mk II': 'bulk',
  'Alliance Chieftain': 'dart', 'Alliance Crusader': 'dart', 'Alliance Challenger': 'dart',
  'Federal Dropship': 'capital', 'Federal Assault Ship': 'capital', 'Federal Gunship': 'capital',
  'Imperial Clipper': 'dart', 'Imperial Corsair': 'spear',
  'Type-6 Transporter': 'trader', 'Type-7 Transporter': 'trader',
  'Type-8 Transporter': 'trader', 'Type-9 Heavy': 'trader', 'Type-10 Defender': 'trader',
  'Type-11 Prospector': 'trader', 'Panther Clipper Mk II': 'trader',
  'Orca': 'liner', 'Beluga Liner': 'liner',
  'Anaconda': 'spear', 'Federal Corvette': 'capital', 'Imperial Cutter': 'capital',
}

function familyFor(ship) {
  return SHIP_FAMILY[ship.name] || ({ 1: 'multirole', 2: 'explorer', 3: 'spear' }[ship.pad_size] || 'multirole')
}

const K = 8            // cross-section resolution (octagonal hull)
const YAW = -0.62      // 3/4 view angles (radians)
const PITCH = 0.34

function ShipWireframe({ ship }) {
  const VB = 300, VH = 210
  const family = familyFor(ship)

  const geom = useMemo(() => {
    const fam = FAMILY_PROFILES[family] || FAMILY_PROFILES.multirole
    const L = fam.length
    const widthScale = 0.7 + ship.pad_size * 0.12

    // build cross-section rings along the hull
    const rings = fam.stations.map(([z, w, h]) => {
      const ring = []
      for (let k = 0; k < K; k++) {
        const a = (k / K) * Math.PI * 2
        ring.push({
          x: Math.cos(a) * w * widthScale,
          y: Math.sin(a) * h,
          z: z * L,
        })
      }
      return ring
    })

    const project = (p) => {
      const x = p.x, y = p.y, z = p.z - L / 2
      const cx1 = x * Math.cos(YAW) + z * Math.sin(YAW)
      const cz1 = -x * Math.sin(YAW) + z * Math.cos(YAW)
      const cy2 = y * Math.cos(PITCH) - cz1 * Math.sin(PITCH)
      const cz2 = y * Math.sin(PITCH) + cz1 * Math.cos(PITCH)
      return { sx: cx1, sy: -cy2, depth: cz2 }
    }

    const proj = rings.map(r => r.map(project))

    // edges: hoops (within a ring) + rails (ring i → ring i+1)
    const edges = []
    proj.forEach((ring, i) => {
      for (let k = 0; k < K; k++) {
        const a = ring[k], b = ring[(k + 1) % K]
        edges.push({ a, b, depth: (a.depth + b.depth) / 2, hoop: true })
        if (i < proj.length - 1) {
          const c = proj[i + 1][k]
          edges.push({ a, b: c, depth: (a.depth + c.depth) / 2, hoop: false })
        }
      }
    })

    // fit to viewbox
    const xs = proj.flat().map(p => p.sx), ys = proj.flat().map(p => p.sy)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const pad = 20
    const scale = Math.min((VB - pad * 2) / (maxX - minX), (VH - pad * 2) / (maxY - minY))
    const ox = (VB - (maxX + minX) * scale) / 2
    const oy = (VH - (maxY + minY) * scale) / 2
    const T = p => [p.sx * scale + ox, p.sy * scale + oy]

    const dMin = Math.min(...edges.map(e => e.depth)), dMax = Math.max(...edges.map(e => e.depth))
    const dRange = dMax - dMin || 1
    edges.sort((e1, e2) => e1.depth - e2.depth) // far first

    return edges.map(e => {
      const [x1, y1] = T(e.a), [x2, y2] = T(e.b)
      const t = (e.depth - dMin) / dRange           // 0 far … 1 near
      return {
        x1, y1, x2, y2,
        opacity: 0.28 + t * 0.62,
        width: e.hoop ? 0.8 + t * 0.7 : 1.0 + t * 1.1,
      }
    })
  }, [family, ship.pad_size, ship.name])

  return (
    <svg viewBox={`0 0 ${VB} ${VH}`} className="w-full h-full" role="img" aria-label={`${ship.name} wireframe`}>
      {geom.map((e, i) => (
        <line
          key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#ff7b00" strokeOpacity={e.opacity} strokeWidth={e.width}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------

function StatBox({ label, value, unit }) {
  return (
    <div className="panel py-2 px-3">
      <div className="text-ed-muted text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-ed-text font-mono text-sm mt-0.5">
        {value}{unit && <span className="text-ed-muted text-xs ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

// a single mount as a size-scaled chip
function MountChip({ name }) {
  const st = HP_STYLE[name]
  return (
    <div
      className="flex flex-col items-center justify-center rounded border font-mono shrink-0"
      style={{ width: st.w, height: st.h, borderColor: st.color, color: st.color, background: `${st.color}14` }}
      title={name}
    >
      <span className="font-bold leading-none">{st.code}</span>
    </div>
  )
}

function UtilityChip() {
  return (
    <div
      className="flex items-center justify-center rounded-sm border border-ed-muted text-ed-muted font-mono shrink-0"
      style={{ width: 18, height: 18, fontSize: 9 }}
      title="Utility mount"
    >
      U
    </div>
  )
}

function SlotPill({ size, label }) {
  return (
    <span className="badge border border-ed-border text-ed-text bg-ed-dark">
      {label ? `${label} ` : ''}<span className="text-ed-orange">{size}</span>
    </span>
  )
}

function ShipDetail({ ship }) {
  if (!ship) return (
    <div className="panel h-full flex items-center justify-center text-ed-muted text-sm">
      Select a ship to view its module layout.
    </div>
  )
  const fmt = n => (n ?? 0).toLocaleString()
  const mounts = (ship.hardpoint_sizes || []).map(sz => HP_BY_SIZE[sz])
  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-ui font-semibold text-ed-orange flex items-center gap-2">
            {ship.name}
            {ship.is_current && (
              <span className="badge border border-ed-success/50 text-ed-success">flying now</span>
            )}
          </h2>
          <p className="text-ed-muted text-sm">{ship.manufacturer}</p>
        </div>
        <div className="text-right">
          <div className="text-ed-muted text-[10px] uppercase tracking-wide">Base cost</div>
          <div className="font-mono text-ed-gold text-sm">{fmt(ship.cost)} CR</div>
        </div>
      </div>

      {/* wireframe + key stats */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        <div className="panel p-2 bg-gradient-to-b from-ed-panel to-ed-dark">
          <div className="w-full" style={{ aspectRatio: '300 / 210' }}>
            <ShipWireframe ship={ship} />
          </div>
          <div className="text-center text-[10px] font-mono text-ed-muted mt-1">
            {PAD_LABEL[ship.pad_size]} pad · schematic
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
          <StatBox label="Landing pad" value={PAD_LABEL[ship.pad_size] || '—'} />
          <StatBox label="Crew" value={ship.crew} />
          <StatBox label="Hull mass" value={fmt(ship.hull_mass)} unit="t" />
          <StatBox label="Top speed" value={ship.speed} unit="m/s" />
          <StatBox label="Boost" value={ship.boost} unit="m/s" />
          <StatBox label="Base shields" value={ship.shields} unit="MJ" />
          <StatBox label="Base armour" value={ship.armour} />
          <StatBox label="Hardpoints" value={mounts.length} />
          <StatBox label="Utility mounts" value={ship.utility_slots} />
        </div>
      </div>

      {/* Hardpoints — size-scaled mount rack */}
      <section className="panel">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-ed-text font-ui font-semibold text-sm">Weapon hardpoints</h3>
          <div className="flex gap-2 text-[10px] font-mono text-ed-muted">
            {HP_ORDER.map(k => (ship.hardpoint_counts?.[k] ? (
              <span key={k} style={{ color: HP_STYLE[k].color }}>{ship.hardpoint_counts[k]}×{HP_STYLE[k].code}</span>
            ) : null))}
          </div>
        </div>
        {mounts.length === 0 ? (
          <p className="text-ed-muted text-sm">No weapon hardpoints.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {mounts.map((name, i) => <MountChip key={i} name={name} />)}
          </div>
        )}
        {ship.utility_slots > 0 && (
          <div className="mt-3 pt-3 border-t border-ed-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-ed-muted text-xs mr-1">Utility mounts</span>
              {Array.from({ length: ship.utility_slots }).map((_, i) => <UtilityChip key={i} />)}
            </div>
            <div className="text-ed-muted text-[10px] mt-1">chaff, heat sinks, shield boosters, scanners…</div>
          </div>
        )}
      </section>

      {/* Core internals */}
      <section className="panel">
        <h3 className="text-ed-text font-ui font-semibold mb-2 text-sm">Core internals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {(ship.core_slots || []).map((size, i) => (
            <div key={i} className="flex items-center justify-between border-b border-ed-border/50 py-1">
              <span className="text-ed-text text-sm">{CORE_NAMES[i] || `Core ${i + 1}`}</span>
              <span className="font-mono text-ed-orange text-sm">Class {size}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Optional internals */}
      <section className="panel">
        <h3 className="text-ed-text font-ui font-semibold mb-2 text-sm">
          Optional internals <span className="text-ed-muted font-normal">({(ship.optional_slots || []).length} slots)</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(ship.optional_slots || []).map((size, i) => <SlotPill key={i} size={size} />)}
        </div>
        {(ship.military_slots?.length > 0 || ship.planetary_slots?.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {ship.military_slots?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-ed-muted">Military:</span>
                {ship.military_slots.map((s, i) => <SlotPill key={i} size={s} />)}
              </div>
            )}
            {ship.planetary_slots?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-ed-muted">Planetary suite:</span>
                {ship.planetary_slots.map((s, i) => <SlotPill key={i} size={s} />)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function Ships() {
  const [ships, setShips] = useState([])
  const [query, setQuery] = useState('')
  const [pad, setPad] = useState(0)          // 0 = all
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    function load() { api()?.get_ships?.().then(r => setShips(r ?? [])) }
    if (api()) load()
    else {
      window.addEventListener('pywebviewready', load, { once: true })
      return () => window.removeEventListener('pywebviewready', load)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ships.filter(s =>
      (pad === 0 || s.pad_size === pad) &&
      (!q || s.name.toLowerCase().includes(q) || (s.manufacturer || '').toLowerCase().includes(q))
    )
  }, [ships, query, pad])

  // default selection: the ship being flown, else the first in the list
  useEffect(() => {
    if (selectedId || ships.length === 0) return
    setSelectedId((ships.find(s => s.is_current) || ships[0]).id)
  }, [ships, selectedId])

  const selected = ships.find(s => s.id === selectedId) || null

  return (
    <div className="p-6 h-full flex flex-col">
      <header className="mb-4">
        <h1 className="text-2xl font-ui font-bold text-ed-text">Ships</h1>
        <p className="text-ed-muted text-sm">Every ship in the galaxy — module slots, sizing and hull schematic.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 flex-1 min-h-0">
        {/* list */}
        <div className="flex flex-col min-h-0">
          <input
            className="input font-mono text-sm mb-2"
            placeholder="Search ship or manufacturer…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex gap-1.5 mb-2">
            {[[0, 'All'], [1, 'S'], [2, 'M'], [3, 'L']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPad(v)}
                className={`badge border px-2 py-1 ${pad === v ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:text-ed-text'}`}
              >
                {l}
              </button>
            ))}
            <span className="ml-auto text-ed-muted text-xs self-center font-mono">{filtered.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  s.id === selectedId
                    ? 'border-ed-orange bg-ed-dark'
                    : 'border-ed-border hover:border-ed-orange/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ed-text text-sm truncate">{s.name}</span>
                  <span className="badge border border-ed-border text-ed-muted shrink-0">{PAD_LABEL[s.pad_size]?.[0]}</span>
                </div>
                <div className="text-ed-muted text-xs truncate">{s.manufacturer}</div>
                {s.is_current && <span className="text-ed-success text-[10px] font-mono">● flying now</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-ed-muted text-sm text-center py-8">No ships match.</div>
            )}
          </div>
        </div>

        {/* detail */}
        <div className="overflow-y-auto pr-1">
          <ShipDetail ship={selected} />
        </div>
      </div>
    </div>
  )
}
