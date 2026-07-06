import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Shared ship schematic: a generated angled 3D "roll-cage" wireframe in the
// shape of the hull, PLUS hardpoint/utility mount markers placed on the hull
// surface. Clicking (or externally selecting) a mount lights up exactly where
// it sits on the ship. Used by both the Ships page and the Ship Builder.
//
// There are no real ship meshes in the EDCD/coriolis ecosystem and no real
// mount-coordinate data, so the hull is a per-family schematic and the mounts
// are placed in plausible symmetric positions (big guns forward, utilities
// along the upper hull). Mount slot keys match the Builder's: hardpoint:<i>,
// utility:<i>.
// ---------------------------------------------------------------------------

export const FAMILY_PROFILES = {
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

export const SHIP_FAMILY = {
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

export function familyFor(ship) {
  return SHIP_FAMILY[ship.name] || ({ 1: 'multirole', 2: 'explorer', 3: 'spear' }[ship.pad_size] || 'multirole')
}

// hardpoint size → colour + short code + marker radius
export const HP_STYLE = {
  4: { code: 'H', color: '#f87171', name: 'Huge' },
  3: { code: 'L', color: '#fb923c', name: 'Large' },
  2: { code: 'M', color: '#facc15', name: 'Medium' },
  1: { code: 'S', color: '#38bdf8', name: 'Small' },
}
const HP_R = { 4: 11, 3: 9.5, 2: 8, 1: 6.5 }
const UTIL_COLOR = '#9aa7b6'

const K = 8            // cross-section resolution (octagonal hull)
const YAW = -0.62      // 3/4 view angles (radians)
const PITCH = 0.34

// hardpoint mount anchors: [hullFraction 0=nose..1=tail, cross-section angle]
// symmetric port/starboard pairs; earlier (bigger) mounts sit further forward
export const HP_ANCHORS = [
  [0.60, 0.35], [0.60, Math.PI - 0.35],
  [0.55, -0.35], [0.55, Math.PI + 0.35],
  [0.68, 0.78], [0.68, Math.PI - 0.78],
  [0.48, -0.78], [0.48, Math.PI + 0.78],
]

// interpolate [halfWidth, halfHeight] at hull fraction f
function sampleProfile(st, f) {
  f = Math.max(0, Math.min(1, f))
  for (let i = 0; i < st.length - 1; i++) {
    const [z0, w0, h0] = st[i], [z1, w1, h1] = st[i + 1]
    if (f >= z0 && f <= z1) { const t = (f - z0) / ((z1 - z0) || 1); return [w0 + (w1 - w0) * t, h0 + (h1 - h0) * t] }
  }
  const l = st[st.length - 1]; return [l[1], l[2]]
}

// Pure geometry: returns { VB, VH, edges, mounts } in screen coordinates.
export function buildShipModel(ship, { VB = 340, VH = 240 } = {}) {
  const fam = FAMILY_PROFILES[familyFor(ship)] || FAMILY_PROFILES.multirole
  const L = fam.length
  const widthScale = 0.7 + ship.pad_size * 0.12

  const rings = fam.stations.map(([z, w, h]) => {
    const ring = []
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2
      ring.push({ x: Math.cos(a) * w * widthScale, y: Math.sin(a) * h, z: z * L })
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

  const surf = (f, a, push) => {
    const [w, h] = sampleProfile(fam.stations, f)
    return project({ x: Math.cos(a) * w * widthScale * push, y: Math.sin(a) * h * push, z: f * L })
  }

  const mounts = []
  ;(ship.hardpoint_sizes || []).forEach((sz, i) => {
    const [f, a] = HP_ANCHORS[i % HP_ANCHORS.length]
    const p = surf(f, a, 1.16)
    mounts.push({ key: `hardpoint:${i}`, kind: 'hardpoint', size: sz, label: `${HP_STYLE[sz]?.name || ''} Hardpoint`, ...p })
  })
  const nu = ship.utility_slots || 0
  for (let i = 0; i < nu; i++) {
    const f = 0.30 + (nu > 1 ? i / (nu - 1) : 0.5) * 0.30
    const a = Math.PI / 2 + ((i % 2) ? 1 : -1) * (0.35 + 0.12 * Math.floor(i / 2))
    const p = surf(f, a, 1.12)
    mounts.push({ key: `utility:${i}`, kind: 'utility', size: 0, label: 'Utility Mount', ...p })
  }

  // fit hull + mounts to the viewbox
  const pts = [...proj.flat(), ...mounts]
  const xs = pts.map(p => p.sx), ys = pts.map(p => p.sy)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 26
  const scale = Math.min((VB - pad * 2) / (maxX - minX), (VH - pad * 2) / (maxY - minY))
  const ox = (VB - (maxX + minX) * scale) / 2
  const oy = (VH - (maxY + minY) * scale) / 2
  const T = p => [p.sx * scale + ox, p.sy * scale + oy]

  const dMin = Math.min(...edges.map(e => e.depth)), dMax = Math.max(...edges.map(e => e.depth))
  const dR = (dMax - dMin) || 1
  edges.sort((a, b) => a.depth - b.depth) // far first

  const drawEdges = edges.map(e => {
    const [x1, y1] = T(e.a), [x2, y2] = T(e.b)
    const t = (e.depth - dMin) / dR
    return { x1, y1, x2, y2, opacity: 0.26 + t * 0.55, width: e.hoop ? 0.8 + t * 0.7 : 1.0 + t * 1.1 }
  })
  const drawMounts = mounts.map(m => {
    const [x, y] = T(m)
    return { ...m, x, y, near: (m.depth - dMin) / dR }
  })
  return { VB, VH, edges: drawEdges, mounts: drawMounts }
}

// ---------------------------------------------------------------------------

export default function ShipSchematic({ ship, activeKey = null, onSelectMount, showMounts = true, className }) {
  const model = useMemo(() => (ship ? buildShipModel(ship) : null), [ship?.name, ship?.pad_size, ship?.id])
  if (!ship || !model) return null
  const { VB, VH, edges, mounts } = model
  const active = mounts.find(m => m.key === activeKey)

  return (
    <svg viewBox={`0 0 ${VB} ${VH}`} className={className || 'w-full h-full'} role="img"
      aria-label={`${ship.name} schematic`}>
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#ff7b00" strokeOpacity={e.opacity} strokeWidth={e.width} strokeLinecap="round" />
      ))}

      {/* leader line + label for the active mount */}
      {active && (() => {
        const ly = VH - 11, lx = Math.max(34, Math.min(VB - 34, active.x))
        return (
          <g key="leader" style={{ pointerEvents: 'none' }}>
            <line x1={active.x} y1={active.y} x2={lx} y2={ly - 9}
              stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" />
            <text x={lx} y={ly} fill="#fff" fontSize="10" fontFamily="monospace" textAnchor="middle">
              {active.label}{active.kind === 'utility' ? '' : ` · size ${active.size}`}
            </text>
          </g>
        )
      })()}

      {showMounts && mounts.map(m => {
        const isA = m.key === activeKey
        const color = m.kind === 'utility' ? UTIL_COLOR : HP_STYLE[m.size].color
        const code = m.kind === 'utility' ? 'U' : HP_STYLE[m.size].code
        const r = m.kind === 'utility' ? 5 : HP_R[m.size]
        const op = 0.45 + m.near * 0.55
        return (
          <g key={m.key}>
            {isA && (
              <circle cx={m.x} cy={m.y} r={r + 6} fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.9">
                <animate attributeName="r" values={`${r + 3};${r + 10};${r + 3}`} dur="1.3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.3s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={m.x} cy={m.y} r={r} fill={color} fillOpacity={isA ? 0.95 : op * 0.35}
              stroke={isA ? '#fff' : color} strokeWidth={isA ? 2 : 1.4} strokeOpacity={op}
              style={{ cursor: onSelectMount ? 'pointer' : 'default' }}
              onClick={onSelectMount ? () => onSelectMount(m.key) : undefined} />
            <text x={m.x} y={m.y + 3.2} fill={isA ? '#0a0e14' : color}
              fontSize={m.kind === 'utility' ? 8 : 9} fontFamily="monospace" fontWeight="700"
              textAnchor="middle" style={{ pointerEvents: 'none' }}>{code}</text>
          </g>
        )
      })}
    </svg>
  )
}
