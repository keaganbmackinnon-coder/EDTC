import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Shared UI ----

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      className="input font-mono text-sm mb-4"
      placeholder={placeholder ?? 'Search…'}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function Tag({ label, color = 'border-ed-border text-ed-muted' }) {
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  )
}

function EmptyState({ icon = '—', message }) {
  return (
    <div className="panel text-center py-8">
      <p className="text-ed-muted text-2xl mb-2">{icon}</p>
      <p className="text-ed-muted text-sm">{message}</p>
    </div>
  )
}

// ---- Tab: Engineers ----

const SPECIALTY_COLORS = {
  FSD: 'border-blue-500/50 text-blue-400',
  Thrusters: 'border-green-500/50 text-green-400',
  Shields: 'border-purple-500/50 text-purple-400',
  Weapons: 'border-red-500/50 text-red-400',
  Sensors: 'border-yellow-500/50 text-yellow-400',
  Armour: 'border-orange-500/50 text-orange-400',
}

function progressBadge(status, rank) {
  if (!status) return null
  if (status === 'Unlocked')
    return <span className="text-xs font-mono text-ed-success border border-ed-success/40 px-1.5 py-0.5 rounded">G{rank} Unlocked</span>
  if (status === 'Invited')
    return <span className="text-xs font-mono text-ed-gold border border-ed-gold/40 px-1.5 py-0.5 rounded">Invited</span>
  if (status === 'Known')
    return <span className="text-xs font-mono text-ed-muted border border-ed-border px-1.5 py-0.5 rounded">Known</span>
  return null
}

function EngineersTab() {
  const [engineers, setEngineers] = useState([])
  const [search, setSearch] = useState('')
  const [filterSpec, setFilterSpec] = useState('')

  useEffect(() => {
    api()?.get_engineers().then(r => setEngineers(r ?? []))
  }, [])

  useEffect(() => {
    return window.__edtc?.on('engineer_progress_update', () => {
      api()?.get_engineers().then(r => setEngineers(r ?? []))
    })
  }, [])

  const allSpecialties = [...new Set(engineers.flatMap(e => e.specialties ?? []))].sort()

  const filtered = engineers.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name?.toLowerCase().includes(q) || e.system?.toLowerCase().includes(q)
      || (e.specialties ?? []).some(s => s.toLowerCase().includes(q))
    const matchSpec = !filterSpec || (e.specialties ?? []).includes(filterSpec)
    return matchSearch && matchSpec
  })

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, system, specialty…" />

      {allSpecialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${!filterSpec ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            onClick={() => setFilterSpec('')}
          >
            All
          </button>
          {allSpecialties.map(s => (
            <button
              key={s}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterSpec === s ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
              onClick={() => setFilterSpec(f => f === s ? '' : s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="No engineers match. Full dataset comes from EDCD engineers.json." />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(e => (
            <div key={e.id} className="panel">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-ed-text font-semibold font-ui">{e.name}</span>
                  <p className="text-ed-muted text-xs font-mono mt-0.5">{e.location}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {progressBadge(e.progress_status, e.progress_rank)}
                  {e.max_grade && (
                    <span className="text-xs font-mono text-ed-muted">Max G{e.max_grade}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(e.specialties ?? []).map(s => (
                  <Tag key={s} label={s} color={SPECIALTY_COLORS[s] ?? 'border-ed-border text-ed-muted'} />
                ))}
              </div>
              {e.invitation && (
                <p className="text-ed-muted text-xs font-mono">
                  <span className="text-ed-gold">Invite: </span>{e.invitation}
                </p>
              )}
              {e.unlock && (
                <p className="text-ed-muted text-xs font-mono mt-0.5">
                  <span className="text-ed-orange">Unlock: </span>{e.unlock}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Blueprints ----

const EFFECT_COLOR = (positive) => positive ? 'text-ed-success' : 'text-ed-danger'

function BlueprintsTab({ materials }) {
  const [blueprints, setBlueprints] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api()?.get_blueprints().then(r => setBlueprints(r ?? []))
  }, [])

  const matMap = {}
  for (const m of materials) matMap[m.name.toLowerCase()] = m.count

  function canCraftGrade(blueprint, grade) {
    const reqs = blueprint.grades?.[grade]?.materials ?? []
    return reqs.length > 0 && reqs.every(r => (matMap[r.name.toLowerCase()] ?? 0) >= r.amount)
  }

  function highestCraftableGrade(blueprint) {
    const grades = Object.keys(blueprint.grades ?? {}).map(Number).sort((a, b) => b - a)
    return grades.find(g => canCraftGrade(blueprint, g.toString())) ?? null
  }

  const filtered = blueprints.filter(b => {
    const q = search.toLowerCase()
    return !q || b.name?.toLowerCase().includes(q)
      || (b.applies_to ?? []).some(m => m.toLowerCase().includes(q))
  })

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search blueprints or modules…" />

      {filtered.length === 0 ? (
        <EmptyState message="No blueprints found. Full dataset comes from EDCD blueprints.json." />
      ) : (
        <div className="space-y-2">
          {filtered.map(bp => {
            const grades = Object.keys(bp.grades ?? {}).sort()
            const craftable = highestCraftableGrade(bp)
            const isOpen = expanded === bp.id

            return (
              <div key={bp.id} className="panel">
                <button
                  className="w-full flex items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : bp.id)}
                >
                  <div>
                    <span className="text-ed-text font-semibold font-ui">{bp.name}</span>
                    {craftable != null && (
                      <span className="ml-2 text-xs font-mono text-ed-success">
                        ✓ Can craft G{craftable}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-1">
                      {grades.map(g => (
                        <span
                          key={g}
                          className={`text-xs font-mono w-5 h-5 flex items-center justify-center rounded ${
                            canCraftGrade(bp, g)
                              ? 'bg-ed-success/20 text-ed-success'
                              : 'bg-ed-border/20 text-ed-muted'
                          }`}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                    <span className="text-ed-muted text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {(bp.applies_to?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bp.applies_to.map(m => (
                      <Tag key={m} label={m} />
                    ))}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-ed-border pt-3">
                    {grades.map(g => {
                      const grade = bp.grades[g]
                      const craftable = canCraftGrade(bp, g)
                      return (
                        <div key={g} className={`rounded p-3 ${craftable ? 'bg-ed-success/5 border border-ed-success/20' : 'bg-ed-dark/50'}`}>
                          <p className="text-ed-text font-semibold text-sm mb-2">
                            Grade {g}
                            {craftable && <span className="ml-2 text-ed-success text-xs font-mono">✓ craftable</span>}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-ed-muted text-xs font-mono mb-1">Materials</p>
                              {(grade.materials ?? []).map(m => {
                                const have = matMap[m.name.toLowerCase()] ?? 0
                                const ok = have >= m.amount
                                return (
                                  <div key={m.name} className="flex justify-between text-xs font-mono">
                                    <span className={ok ? 'text-ed-success' : 'text-ed-text'}>{m.name}</span>
                                    <span className={ok ? 'text-ed-success' : 'text-ed-danger'}>
                                      {have}/{m.amount}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                            <div>
                              <p className="text-ed-muted text-xs font-mono mb-1">Effects</p>
                              {(grade.effects ?? []).map((ef, i) => (
                                <div key={i} className={`text-xs font-mono ${EFFECT_COLOR(ef.positive)}`}>
                                  {ef.attribute}: ×{ef.modifier}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
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

// ---- Tab: Synthesis ----

function SynthesisTab({ materials }) {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    api()?.get_synthesis_recipes().then(r => setRecipes(r ?? []))
  }, [])

  const matMap = {}
  for (const m of materials) matMap[m.name.toLowerCase()] = m.count

  function canSynth(recipe) {
    return recipe.materials.every(m => (matMap[m.name.toLowerCase()] ?? 0) >= m.amount)
  }

  const allCats = [...new Set(recipes.map(r => r.category))].sort()

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    const matchCat = !filterCat || r.category === filterCat
    return matchSearch && matchCat
  })

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search recipes…" />

      {allCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${!filterCat ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            onClick={() => setFilterCat('')}
          >
            All
          </button>
          {allCats.map(c => (
            <button
              key={c}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterCat === c ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
              onClick={() => setFilterCat(f => f === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="No recipes found. Full dataset comes from synthesis.json." />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const ok = canSynth(r)
            return (
              <div key={r.id} className={`panel ${ok ? 'border border-ed-success/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-ed-text font-semibold font-ui">{r.name}</span>
                    {ok && <span className="ml-2 text-xs font-mono text-ed-success">✓</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <Tag label={r.category} />
                    <Tag label={r.grade} color={
                      r.grade === 'Premium' ? 'border-ed-orange/60 text-ed-orange'
                      : r.grade === 'Standard' ? 'border-ed-gold/60 text-ed-gold'
                      : 'border-ed-border text-ed-muted'
                    } />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(r.materials ?? []).map(m => {
                    const have = matMap[m.name.toLowerCase()] ?? 0
                    const hasIt = have >= m.amount
                    return (
                      <span key={m.name} className={`text-xs font-mono ${hasIt ? 'text-ed-success' : 'text-ed-text'}`}>
                        {m.name} ×{m.amount}
                        {!hasIt && <span className="text-ed-danger ml-1">({have})</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Tech Broker ----

function TechBrokerTab({ materials }) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    api()?.get_tech_broker_items().then(r => setItems(r ?? []))
  }, [])

  const matMap = {}
  for (const m of materials) matMap[m.name.toLowerCase()] = m.count

  function canUnlock(item) {
    return (item.materials ?? []).every(m => (matMap[m.name.toLowerCase()] ?? 0) >= m.amount)
  }

  const allTypes = [...new Set(items.map(i => i.type))].sort()

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q)
    const matchType = !filterType || i.type === filterType
    return matchSearch && matchType
  })

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search tech broker items…" />

      {allTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${!filterType ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
            onClick={() => setFilterType('')}
          >
            All
          </button>
          {allTypes.map(t => (
            <button
              key={t}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterType === t ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted hover:border-ed-orange/50'}`}
              onClick={() => setFilterType(f => f === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="No items found. Full dataset comes from tech_brokers.json." />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const ok = canUnlock(item)
            return (
              <div key={item.id} className={`panel ${ok ? 'border border-ed-success/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-ed-text font-semibold font-ui">{item.name}</span>
                    {ok && <span className="ml-2 text-xs font-mono text-ed-success">✓ unlockable</span>}
                  </div>
                  <Tag label={item.type} color={
                    item.type === 'Guardian' ? 'border-blue-500/50 text-blue-400' : 'border-ed-border text-ed-muted'
                  } />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(item.materials ?? []).map(m => {
                    const have = matMap[m.name.toLowerCase()] ?? 0
                    const hasIt = have >= m.amount
                    return (
                      <span key={m.name} className={`text-xs font-mono ${hasIt ? 'text-ed-success' : 'text-ed-text'}`}>
                        {m.name} ×{m.amount}
                        {!hasIt && <span className="text-ed-danger ml-1">({have})</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Materials ----

const CAT_CAPS = { Raw: 300, Manufactured: 150, Encoded: 100 }
const CAT_ORDER = ['Raw', 'Manufactured', 'Encoded']

function MaterialsTab({ materials, setMaterials }) {
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('Raw')
  const [editing, setEditing] = useState(null) // {name, category, value}
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [saving, setSaving] = useState(false)

  const byCategory = {}
  for (const m of materials) {
    const cat = m.category || 'Unknown'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(m)
  }

  const displayCat = activeCat
  const catMaterials = (byCategory[displayCat] ?? []).filter(m => {
    const q = search.toLowerCase()
    return !q || m.name.toLowerCase().includes(q)
  }).sort((a, b) => a.name.localeCompare(b.name))

  const cap = CAT_CAPS[displayCat] ?? 300
  const totalInCat = (byCategory[displayCat] ?? []).reduce((s, m) => s + m.count, 0)

  async function saveEdit() {
    if (!editing) return
    const count = Math.max(0, parseInt(editing.value, 10) || 0)
    await api()?.set_material_count(editing.name, editing.category, count)
    setMaterials(prev => {
      const idx = prev.findIndex(m => m.name === editing.name)
      if (idx === -1) return count > 0 ? [...prev, { name: editing.name, category: editing.category, count }] : prev
      const next = [...prev]
      next[idx] = { ...next[idx], count }
      return next.filter(m => m.count > 0 || m.name === editing.name)
    })
    setEditing(null)
  }

  async function bulkImport() {
    if (!bulkText.trim()) return
    setSaving(true)
    const lines = bulkText.split('\n')
    for (const line of lines) {
      const [namePart, countPart] = line.split(':').map(s => s.trim())
      if (!namePart || !countPart) continue
      const count = parseInt(countPart, 10)
      if (isNaN(count)) continue
      await api()?.set_material_count(namePart, '', count)
    }
    const updated = await api()?.get_materials()
    if (updated) setMaterials(updated)
    setBulkText('')
    setShowBulk(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          Auto-tracked from journal (MaterialCollected, EngineerCraft, MaterialTrade).
          Set starting counts manually if EDTC wasn&apos;t running during collection.
        </p>
        <button className="btn-ghost text-sm shrink-0" onClick={() => setShowBulk(f => !f)}>
          {showBulk ? 'Cancel' : 'Bulk Import'}
        </button>
      </div>

      {showBulk && (
        <div className="panel mb-4">
          <p className="text-ed-muted text-xs font-mono mb-2">
            Paste material counts (Name: count, one per line):
          </p>
          <textarea
            className="input font-mono text-sm resize-none mb-2"
            rows={6}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={"Sulphur: 200\nNickel: 150\nHeat Conduction Wiring: 50"}
          />
          <button className="btn-primary text-sm disabled:opacity-40" onClick={bulkImport} disabled={saving}>
            {saving ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Filter materials…" />

      <div className="flex gap-1 mb-4 border-b border-ed-border">
        {CAT_ORDER.map(cat => {
          const count = (byCategory[cat] ?? []).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`px-4 py-2 text-sm font-ui font-semibold transition-colors border-b-2 -mb-px ${
                activeCat === cat
                  ? 'border-ed-orange text-ed-orange'
                  : 'border-transparent text-ed-muted hover:text-ed-text'
              }`}
            >
              {cat}
              {count > 0 && (
                <span className="ml-1.5 text-xs font-mono opacity-60">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-ed-muted mb-3">
        <span>{catMaterials.length} materials tracked</span>
        <span>Cap: {cap} per material</span>
      </div>

      {catMaterials.length === 0 ? (
        <EmptyState
          message={search
            ? 'No materials match your search.'
            : `No ${displayCat} materials tracked yet. Play with EDTC running or use Bulk Import.`}
        />
      ) : (
        <div className="space-y-1">
          {catMaterials.map(m => {
            const pct = Math.min(100, Math.round((m.count / cap) * 100))
            const isEditing = editing?.name === m.name
            return (
              <div key={m.name} className="panel py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-ed-text truncate">{m.name}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          className="w-16 bg-ed-dark border border-ed-orange/50 rounded px-1 py-0.5 text-ed-text text-xs font-mono focus:outline-none"
                          value={editing.value}
                          min={0}
                          max={cap}
                          onChange={e => setEditing(v => ({ ...v, value: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                          autoFocus
                        />
                        <button className="text-ed-success text-xs hover:underline" onClick={saveEdit}>✓</button>
                        <button className="text-ed-muted text-xs hover:underline" onClick={() => setEditing(null)}>✕</button>
                      </div>
                    ) : (
                      <button
                        className="text-ed-orange font-semibold hover:underline shrink-0"
                        onClick={() => setEditing({ name: m.name, category: m.category, value: String(m.count) })}
                      >
                        {m.count}
                      </button>
                    )}
                  </div>
                  <div className="h-1 bg-ed-dark rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct > 80 ? 'bg-ed-danger' : pct > 50 ? 'bg-ed-gold' : 'bg-ed-orange'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
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
  { id: 'engineers',   label: 'Engineers' },
  { id: 'blueprints',  label: 'Blueprints' },
  { id: 'synthesis',   label: 'Synthesis' },
  { id: 'tech_broker', label: 'Tech Broker' },
  { id: 'materials',   label: 'Materials' },
]

export default function Engineering() {
  const [tab, setTab] = useState('engineers')
  const [materials, setMaterials] = useState([])

  useEffect(() => {
    api()?.get_materials().then(r => setMaterials(r ?? []))
  }, [])

  useEffect(() => {
    const off1 = window.__edtc?.on('material_update', () => {
      api()?.get_materials().then(r => setMaterials(r ?? []))
    })
    const off2 = window.__edtc?.on('materials_changed', () => {
      api()?.get_materials().then(r => setMaterials(r ?? []))
    })
    return () => { off1?.(); off2?.() }
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Engineering & Outfitting</h1>
      <p className="text-ed-muted text-sm mb-5">Blueprints, materials, synthesis, and engineer reference.</p>

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

      {tab === 'engineers'   && <EngineersTab />}
      {tab === 'blueprints'  && <BlueprintsTab materials={materials} />}
      {tab === 'synthesis'   && <SynthesisTab materials={materials} />}
      {tab === 'tech_broker' && <TechBrokerTab materials={materials} />}
      {tab === 'materials'   && <MaterialsTab materials={materials} setMaterials={setMaterials} />}
    </div>
  )
}
