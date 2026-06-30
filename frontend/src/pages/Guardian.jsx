import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Helpers ----

function EmptyState({ message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

function copyText(text) {
  try {
    navigator.clipboard.writeText(text)
  } catch {
    api()?.copy_to_clipboard(text)
  }
}

// ---- Tab: Sites ----

const TYPE_COLORS = {
  Alpha: 'border-blue-500/50 text-blue-400',
  Beta:  'border-purple-500/50 text-purple-400',
  Gamma: 'border-green-500/50 text-green-400',
  Fistbump:    'border-yellow-500/50 text-yellow-400',
  Bear:        'border-orange-500/50 text-orange-400',
  Hammerbot:   'border-red-500/50 text-red-400',
  Lacrosse:    'border-teal-500/50 text-teal-400',
  Crossroads:  'border-cyan-500/50 text-cyan-400',
  Turtle:      'border-lime-500/50 text-lime-400',
  Bowl:        'border-emerald-500/50 text-emerald-400',
  Squid:       'border-violet-500/50 text-violet-400',
  Stickyhand:  'border-pink-500/50 text-pink-400',
  Robolobster: 'border-rose-500/50 text-rose-400',
}

const BLUEPRINT_INFO = {
  Bear:        { label: 'Weapon Blueprint', color: 'text-red-400',    items: ['Gauss Cannon', 'Plasma Charger', 'Shard Cannon'] },
  Hammerbot:   { label: 'Weapon Blueprint', color: 'text-red-400',    items: ['Gauss Cannon', 'Plasma Charger', 'Shard Cannon'] },
  Bowl:        { label: 'Weapon Blueprint', color: 'text-red-400',    items: ['Gauss Cannon', 'Plasma Charger', 'Shard Cannon'] },
  Turtle:      { label: 'Module Blueprint', color: 'text-blue-400',   items: ['FSD Booster', 'Power Distributor', 'Shield Generator', 'Hull Reinforcement'] },
  Stickyhand:  { label: 'Vessel Blueprint', color: 'text-violet-400', items: ['Enhanced FSD', 'Pulse Laser', 'Multi-Cannon'] },
  Robolobster: { label: 'Vessel Blueprint', color: 'text-violet-400', items: ['Enhanced FSD', 'Pulse Laser', 'Multi-Cannon'] },
  Squid:       { label: 'Vessel Blueprint', color: 'text-violet-400', items: ['Enhanced FSD', 'Pulse Laser', 'Multi-Cannon'] },
}

function SiteCard({ site, kind, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(site.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function toggle(field) {
    const next = {
      visited: field === 'visited' ? !site.visited : site.visited,
      data_collected: field === 'data_collected' ? !site.data_collected : site.data_collected,
    }
    await api()?.set_guardian_visit(site.id, next.visited, next.data_collected, site.notes ?? '')
    onUpdate()
  }

  async function saveNotes() {
    setSaving(true)
    await api()?.set_guardian_visit(site.id, site.visited, site.data_collected, notes)
    setSaving(false)
    setEditing(false)
    onUpdate()
  }

  const typeColor = TYPE_COLORS[site.type] ?? 'border-ed-border text-ed-muted'

  return (
    <div className={`panel ${site.visited ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-ed-text font-semibold font-ui">{site.system}</span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${typeColor}`}>
              {site.type}
            </span>
            <span className="text-xs font-mono text-ed-muted">{kind}</span>
          </div>
          <p className="text-ed-muted text-xs font-mono mt-0.5">
            Body: {site.body}
            {site.coordinates && (
              <span className="ml-2">
                {site.coordinates.lat?.toFixed(4)}°, {site.coordinates.lon?.toFixed(4)}°
              </span>
            )}
          </p>
          {BLUEPRINT_INFO[site.type] && (() => {
            const bp = BLUEPRINT_INFO[site.type]
            return (
              <p className="text-xs font-mono mt-1">
                <span className={`font-semibold ${bp.color}`}>{bp.label}</span>
                <span className="text-ed-muted ml-1">→ {bp.items.join(' · ')}</span>
              </p>
            )
          })()}
        </div>
        <button
          className="btn-ghost text-xs shrink-0"
          onClick={() => copyText(site.system)}
        >
          Copy System
        </button>
      </div>

      {site.notes && !editing && (
        <p className="text-ed-muted text-xs font-mono italic mb-2">{site.notes}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!site.visited}
            onChange={() => toggle('visited')}
            className="accent-ed-orange"
          />
          <span className="text-xs font-mono text-ed-muted">Visited</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!site.data_collected}
            onChange={() => toggle('data_collected')}
            className="accent-ed-orange"
          />
          <span className="text-xs font-mono text-ed-muted">Data Collected</span>
        </label>
        <button
          className="btn-ghost text-xs ml-auto"
          onClick={() => { setEditing(e => !e); setNotes(site.notes ?? '') }}
        >
          {editing ? 'Cancel' : 'Notes'}
        </button>
      </div>

      {editing && (
        <div className="mt-2">
          <textarea
            className="input font-mono text-xs w-full resize-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Personal notes…"
          />
          <button className="btn-ghost text-xs mt-1 disabled:opacity-40" onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

function SitesTab() {
  const [sites, setSites] = useState({ ruins: [], structures: [] })
  const [filter, setFilter] = useState('All')
  const [kind, setKind] = useState('All')
  const [hideVisited, setHideVisited] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => api()?.get_guardian_sites().then(r => setSites(r ?? { ruins: [], structures: [] }))
  useEffect(() => { load() }, [])

  const allRuins = sites.ruins ?? []
  const allStructures = sites.structures ?? []
  const allSites = [
    ...allRuins.map(s => ({ ...s, _kind: 'Ruins' })),
    ...allStructures.map(s => ({ ...s, _kind: 'Structure' })),
  ]

  const allTypes = ['All', ...new Set(allSites.map(s => s.type))]

  const filtered = allSites.filter(s => {
    if (filter !== 'All' && s.type !== filter) return false
    if (kind !== 'All' && s._kind !== kind) return false
    if (hideVisited && s.visited) return false
    if (search && !s.system.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const visitedCount = allSites.filter(s => s.visited).length
  const dataCount = allSites.filter(s => s.data_collected).length

  return (
    <div>
      <div className="panel mb-4">
        <p className="text-ed-muted text-xs font-mono mb-2">
          Site data sourced from Canonn community — replace{' '}
          <span className="text-ed-text">data/guardian_sites.json</span>{' '}
          with the full Canonn dataset for complete coverage.
        </p>
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-ed-text">{allSites.length} sites total</span>
          <span className="text-ed-success">{visitedCount} visited</span>
          <span className="text-ed-orange">{dataCount} data collected</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          className="input font-mono text-sm flex-1 min-w-32"
          placeholder="Filter by system…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['All', 'Ruins', 'Structure'].map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${kind === k ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {allTypes.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${filter === t ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-ed-muted">
          <input
            type="checkbox"
            checked={hideVisited}
            onChange={e => setHideVisited(e.target.checked)}
            className="accent-ed-orange"
          />
          Hide visited
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No sites match the current filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <SiteCard key={s.id} site={s} kind={s._kind} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Materials ----

const GUARDIAN_MATERIALS = [
  {
    name: 'Guardian Power Cell',
    category: 'Commodity',
    where: 'Power Cells at Guardian ruins — activate obelisk pylons',
    use: 'FSD Booster, Guardian module unlocks',
  },
  {
    name: 'Guardian Power Conduit',
    category: 'Commodity',
    where: 'Power Conduits at Guardian ruins',
    use: 'Guardian module/weapon unlocks',
  },
  {
    name: 'Guardian Sentinel Weapon Parts',
    category: 'Commodity',
    where: 'Destroy Guardian Sentinels at ruins/structures',
    use: 'Guardian weapon unlocks',
  },
  {
    name: 'Guardian Sentinel Wreckage Components',
    category: 'Commodity',
    where: 'Loot Sentinel wrecks after destroying them',
    use: 'Guardian module unlocks',
  },
  {
    name: 'Guardian Technology Component',
    category: 'Commodity',
    where: 'Guardian Structure tech sites — shoot activated pylons',
    use: 'Guardian tech broker items (Gauss Cannon, Plasma Charger)',
  },
  {
    name: 'Guardian Module Blueprint Fragment',
    category: 'Data',
    where: 'Scan data terminals at Guardian ruins after activating them',
    use: 'Required for all Guardian module unlocks at Tech Broker',
  },
  {
    name: 'Guardian Vessel Blueprint Fragment',
    category: 'Data',
    where: 'Scan data terminals at Guardian structures',
    use: 'Guardian ship enhancement unlocks',
  },
  {
    name: 'Guardian Weapon Blueprint Fragment',
    category: 'Data',
    where: 'Scan data terminals at Guardian structures (weapon sites)',
    use: 'Guardian weapon unlocks (Gauss Cannon, Plasma Charger, Shard Cannon)',
  },
  {
    name: 'Ancient Relic',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Orb',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Totem',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Casket',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Tablet',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Urn',
    category: 'Relic',
    where: 'Interact with obelisks at Guardian ruins',
    use: 'Ram Tah missions, material trading',
  },
  {
    name: 'Ancient Key',
    category: 'Relic',
    where: 'Interact with specific obelisks at Guardian ruins',
    use: 'Ram Tah missions',
  },
]

const CAT_COLORS = {
  Commodity: 'border-ed-orange/50 text-ed-orange',
  Data:      'border-blue-500/50 text-blue-400',
  Relic:     'border-purple-500/50 text-purple-400',
}

function MaterialsTab() {
  const [techItems, setTechItems] = useState([])
  const [filterCat, setFilterCat] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api()?.get_tech_broker_items().then(r => setTechItems((r ?? []).filter(i => i.type === 'Guardian')))
  }, [])

  const cats = ['All', 'Commodity', 'Data', 'Relic']
  const filtered = GUARDIAN_MATERIALS.filter(m => {
    if (filterCat !== 'All' && m.category !== filterCat) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1 min-w-32"
          placeholder="Filter materials…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${filterCat === c ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2 mb-6">
        {filtered.map(m => (
          <div key={m.name} className="panel">
            <div className="flex items-start justify-between gap-3 mb-1">
              <span className="text-ed-text font-semibold font-ui">{m.name}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded border shrink-0 ${CAT_COLORS[m.category] ?? 'border-ed-border text-ed-muted'}`}>
                {m.category}
              </span>
            </div>
            <p className="text-xs font-mono text-ed-muted mb-0.5">
              <span className="text-ed-orange">Where: </span>{m.where}
            </p>
            <p className="text-xs font-mono text-ed-muted">
              <span className="text-ed-gold">Use: </span>{m.use}
            </p>
          </div>
        ))}
      </div>

      {techItems.length > 0 && (
        <>
          <p className="text-ed-muted text-xs font-mono uppercase tracking-wider mb-3">
            Tech Broker — Guardian Unlocks
          </p>
          <div className="space-y-2">
            {techItems.map(item => (
              <div key={item.id} className="panel">
                <p className="text-ed-text font-semibold font-ui mb-2">{item.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(item.materials ?? []).map(m => (
                    <span key={m.name} className="text-xs font-mono text-ed-muted">
                      {m.name} ×{m.amount}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- Tab: Landmarks ----

const LANDMARKS = [
  {
    id: 'sol',
    name: 'Sol',
    description: 'Home system of humanity. Starting location for most commanders.',
    coords: { x: 0, y: 0, z: 0 },
    tags: ['Origin', 'Human'],
  },
  {
    id: 'sag_a',
    name: 'Sagittarius A*',
    system: 'Sagittarius A*',
    description: 'The supermassive black hole at the centre of the Milky Way. ~26,000 ly from Sol.',
    coords: { x: 25.21875, y: -20.90625, z: 25899.96875 },
    tags: ['Black Hole', 'Galactic Centre', 'Elite'],
  },
  {
    id: 'beagle_point',
    name: 'Beagle Point',
    system: 'Beagle Point',
    description: 'Named after Darwin\'s ship. The furthest point most commanders have reached — ~65,647 ly from Sol.',
    coords: { x: -1111.5625, y: -134.21875, z: 65269.75 },
    tags: ['Distant', 'Exploration', 'Elite'],
  },
  {
    id: 'colonia',
    name: 'Colonia',
    system: 'Colonia',
    description: 'Independent colony hub ~22,000 ly from Sol. Has full station services. Jumping-off point for the outer galaxy.',
    coords: { x: -9530.5, y: -910.28125, z: 19808.125 },
    tags: ['Colony', 'Human', 'Services'],
  },
  {
    id: 'jaques',
    name: 'Jaques Station',
    system: 'Colonia',
    description: 'Famous mobile station that got stranded in Colonia. Owned by Jaques the bartender. Has all services.',
    coords: { x: -9530.5, y: -910.28125, z: 19808.125 },
    tags: ['Station', 'Human', 'Lore'],
  },
  {
    id: 'hutton',
    name: 'Hutton Orbital',
    system: 'Alpha Centauri',
    description: 'Infamously distant station at 0.22 ly from the nav point (~90 min supercruise). Free Anaconda rumour is false — but mugs are real.',
    coords: { x: 3.03125, y: -0.09375, z: 3.15625 },
    tags: ['Station', 'Human', 'Meme'],
  },
  {
    id: 'eta_carinae',
    name: 'Eta Carinae',
    system: 'Eta Carinae',
    description: 'One of the most massive and luminous stars known. A hypernova candidate. ~7,500 ly from Sol.',
    coords: { x: -3407.53125, y: -47.1875, z: 6659.28125 },
    tags: ['Star', 'Exploration'],
  },
  {
    id: 'great_annihilator',
    name: 'The Great Annihilator',
    system: 'Great Annihilator',
    description: 'A black hole and pulsar binary near the galactic core. One of the most famous systems in the game.',
    coords: { x: 354.75, y: 149.34375, z: 24987.40625 },
    tags: ['Black Hole', 'Pulsar', 'Exploration'],
  },
  {
    id: 'skaude_aa_a_h94',
    name: 'Skaude AA-A h94',
    system: 'Skaude AA-A h94',
    description: 'Famous system near Colonia containing multiple black holes. Popular sightseeing stop.',
    coords: { x: -9480.28125, y: -243.09375, z: 19358.09375 },
    tags: ['Black Hole', 'Exploration'],
  },
  {
    id: 'explorers_anchorage',
    name: "Explorer's Anchorage",
    system: 'Stuemeae FG-Y d7561',
    description: 'Outpost near Sagittarius A* built by the Distant Worlds 2 expedition. Provides fleet carrier services near the core.',
    coords: { x: 49.46875, y: -54.09375, z: 25860.71875 },
    tags: ['Station', 'Expedition', 'Services'],
  },
]

const LANDMARK_TAG_COLORS = {
  'Black Hole': 'border-gray-500/50 text-gray-400',
  'Elite':      'border-ed-gold/50 text-ed-gold',
  'Origin':     'border-blue-500/50 text-blue-400',
  'Human':      'border-blue-400/50 text-blue-300',
  'Colony':     'border-green-500/50 text-green-400',
  'Services':   'border-green-400/50 text-green-300',
  'Station':    'border-ed-border text-ed-muted',
  'Exploration':'border-purple-500/50 text-purple-400',
  'Distant':    'border-orange-500/50 text-orange-400',
  'Star':       'border-yellow-500/50 text-yellow-400',
  'Expedition': 'border-teal-500/50 text-teal-400',
  'Pulsar':     'border-blue-600/50 text-blue-300',
  'Meme':       'border-ed-orange/50 text-ed-orange',
  'Lore':       'border-purple-400/50 text-purple-300',
}

function LandmarksTab() {
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')

  const allTags = [...new Set(LANDMARKS.flatMap(l => l.tags))].sort()

  const filtered = LANDMARKS.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.name.toLowerCase().includes(q)
      || (l.system ?? l.name).toLowerCase().includes(q)
      || l.description.toLowerCase().includes(q)
    const matchTag = !filterTag || l.tags.includes(filterTag)
    return matchSearch && matchTag
  })

  function fmtCoords(c) {
    if (!c) return null
    return `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}`
  }

  function distFromSol(c) {
    if (!c) return null
    const d = Math.sqrt(c.x ** 2 + c.y ** 2 + c.z ** 2)
    return d >= 1000 ? `${(d / 1000).toFixed(1)}K ly` : `${d.toFixed(0)} ly`
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input font-mono text-sm flex-1 min-w-32"
          placeholder="Search landmarks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilterTag('')}
          className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${!filterTag ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
        >
          All
        </button>
        {allTags.map(t => (
          <button
            key={t}
            onClick={() => setFilterTag(f => f === t ? '' : t)}
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterTag === t ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(l => (
          <div key={l.id} className="panel">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-ed-text font-semibold font-ui">{l.name}</p>
                {l.system && l.system !== l.name && (
                  <p className="text-ed-muted text-xs font-mono">System: {l.system}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {l.coords && (
                  <span className="text-ed-muted text-xs font-mono">{distFromSol(l.coords)} from Sol</span>
                )}
                <button
                  className="btn-ghost text-xs"
                  onClick={() => copyText(l.system ?? l.name)}
                >
                  Copy
                </button>
              </div>
            </div>

            <p className="text-ed-muted text-sm mb-2">{l.description}</p>

            <div className="flex flex-wrap gap-1.5 items-center">
              {l.tags.map(t => (
                <span
                  key={t}
                  className={`text-xs font-mono px-1.5 py-0.5 rounded border ${LANDMARK_TAG_COLORS[t] ?? 'border-ed-border text-ed-muted'}`}
                >
                  {t}
                </span>
              ))}
              {l.coords && (
                <span className="text-ed-muted text-xs font-mono ml-auto">
                  {fmtCoords(l.coords)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'sites',     label: 'Sites' },
  { id: 'materials', label: 'Materials' },
  { id: 'landmarks', label: 'Landmarks' },
]

export default function Guardian() {
  const [tab, setTab] = useState('sites')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Guardian & POI</h1>
      <p className="text-ed-muted text-sm mb-5">Guardian ruins, structures, materials, and notable landmarks.</p>

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

      {tab === 'sites'     && <SitesTab />}
      {tab === 'materials' && <MaterialsTab />}
      {tab === 'landmarks' && <LandmarksTab />}
    </div>
  )
}
