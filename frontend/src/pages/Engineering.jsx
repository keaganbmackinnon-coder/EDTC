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

// Progress buckets, in "what should I do next" order
const ENGINEER_GROUPS = [
  { key: 'Invited',  title: 'Next up — invited, go unlock them', hint: 'You have the invite; deliver the unlock requirement to gain access.' },
  { key: 'Known',    title: 'Working towards an invite', hint: 'You know of them; meet the invite requirement to get invited.' },
  { key: 'Locked',   title: 'Locked — not discovered yet', hint: 'Meet the invite requirement (some need another engineer at G3-4 first).' },
  { key: 'Unlocked', title: 'Unlocked', hint: '' },
]

function engineerBucket(e) {
  if (e.progress_status === 'Unlocked') return 'Unlocked'
  if (e.progress_status === 'Invited') return 'Invited'
  if (e.progress_status === 'Known') return 'Known'
  return 'Locked'
}

function EngineerCard({ e }) {
  const bucket = engineerBucket(e)
  // The requirement that matters NEXT for this engineer gets the highlight
  const nextIsUnlock = bucket === 'Invited'
  const nextIsInvite = bucket === 'Known' || bucket === 'Locked'
  return (
    <div className={`panel ${bucket === 'Invited' ? 'border border-ed-gold/40' : ''}`}>
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
      {e.invitation && bucket !== 'Unlocked' && (
        <p className={`text-xs font-mono ${nextIsInvite ? 'text-ed-text' : 'text-ed-muted'}`}>
          <span className="text-ed-gold">{nextIsInvite ? '→ Invite: ' : 'Invite: '}</span>{e.invitation}
        </p>
      )}
      {e.unlock && bucket !== 'Unlocked' && (
        <p className={`text-xs font-mono mt-0.5 ${nextIsUnlock ? 'text-ed-text' : 'text-ed-muted'}`}>
          <span className="text-ed-orange">{nextIsUnlock ? '→ Unlock: ' : 'Unlock: '}</span>{e.unlock}
        </p>
      )}
      {bucket === 'Unlocked' && e.progress_rank < (e.max_grade ?? 5) && (
        <p className="text-ed-muted text-xs font-mono">
          Craft or contribute to raise access G{e.progress_rank} → G{e.max_grade ?? 5}
        </p>
      )}
    </div>
  )
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

  const unlockedCount = engineers.filter(e => engineerBucket(e) === 'Unlocked').length
  const invitedCount = engineers.filter(e => engineerBucket(e) === 'Invited').length

  return (
    <div>
      {engineers.length > 0 && (
        <div className="panel mb-4 flex items-center gap-6">
          <div>
            <p className="text-ed-muted text-xs font-mono mb-0.5">Engineers unlocked</p>
            <p className="text-ed-text font-semibold font-ui text-lg">
              <span className="text-ed-success">{unlockedCount}</span>
              <span className="text-ed-muted text-sm"> / {engineers.length}</span>
            </p>
          </div>
          <div className="flex-1">
            <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden">
              <div className="h-full bg-ed-success rounded-full transition-all duration-500"
                style={{ width: `${(unlockedCount / engineers.length) * 100}%` }} />
            </div>
          </div>
          {invitedCount > 0 && (
            <p className="text-ed-gold text-xs font-mono shrink-0">
              {invitedCount} invite{invitedCount === 1 ? '' : 's'} waiting
            </p>
          )}
        </div>
      )}

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
        <div className="space-y-5">
          {ENGINEER_GROUPS.map(group => {
            const members = filtered.filter(e => engineerBucket(e) === group.key)
            if (members.length === 0) return null
            return (
              <div key={group.key}>
                <div className="mb-2">
                  <h3 className="text-ed-text font-ui font-semibold text-sm">
                    {group.title} <span className="text-ed-muted font-mono text-xs">({members.length})</span>
                  </h3>
                  {group.hint && <p className="text-ed-muted text-xs font-mono">{group.hint}</p>}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {members.map(e => <EngineerCard key={e.id} e={e} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Tab: Blueprints ----

const EFFECT_COLOR = (positive) => positive ? 'text-ed-success' : 'text-ed-danger'

// Outfitting-style buckets for the module-type dropdowns. Types missing here
// (future data regens) fall through to an "Other" section instead of vanishing.
const MODULE_CATEGORIES = [
  {
    title: 'Hardpoints',
    modules: ['Pulse Laser', 'Burst Laser', 'Beam Laser', 'Multi-cannon', 'Cannon',
      'Fragment Cannon', 'Rail Gun', 'Plasma Accelerator', 'Missile Rack',
      'Torpedo Pylon', 'Mine Launcher'],
  },
  {
    title: 'Utility Mounts',
    modules: ['Shield Booster', 'Chaff Launcher', 'Electronic Countermeasure',
      'Heat Sink Launcher', 'Point Defence', 'Kill Warrant Scanner',
      'Manifest Scanner', 'Wake Scanner'],
  },
  {
    title: 'Core Internals',
    modules: ['Armour', 'Power Plant', 'Thrusters', 'Frame Shift Drive',
      'Life Support', 'Power Distributor', 'Sensors'],
  },
  {
    title: 'Optional Internals',
    modules: ['Shield Generator', 'Shield Cell Bank', 'Hull Reinforcement Package',
      'Frame Shift Drive Interdictor', 'Fuel Scoop', 'Refinery',
      'Auto Field-Maintenance Unit', 'Surface Scanner',
      'Collector Limpet Controller', 'Fuel Transfer Limpet Controller',
      'Hatch Breaker Limpet Controller', 'Prospector Limpet Controller'],
  },
]

function BlueprintCard({ bp, isOpen, onToggle, matMap, canCraftGrade, highestCraftableGrade, isPinned, togglePin, showModuleTags }) {
  const grades = Object.keys(bp.grades ?? {}).sort()
  const craftable = highestCraftableGrade(bp)

  return (
    <div className="panel">
      <button
        className="w-full flex items-center justify-between gap-3 text-left"
        onClick={onToggle}
      >
        <div>
          <span className="text-ed-text font-semibold font-ui">{bp.name}</span>
          {grades.some(g => isPinned?.(bp.id, g)) && (
            <span className="ml-2 text-xs" title="Pinned">📌</span>
          )}
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

      {showModuleTags && (bp.applies_to?.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {bp.applies_to.map(m => (
            <Tag key={m} label={m} />
          ))}
        </div>
      )}

      {isOpen && (
        <div className="mt-3 space-y-3 border-t border-ed-border pt-3">
          {(bp.engineers?.length > 0) && (
            <p className="text-xs font-mono text-ed-muted">
              Engineers: <span className="text-ed-text">{bp.engineers.join(', ')}</span>
            </p>
          )}
          {grades.map(g => {
            const grade = bp.grades[g]
            const craftable = canCraftGrade(bp, g)
            return (
              <div key={g} className={`rounded p-3 ${craftable ? 'bg-ed-success/5 border border-ed-success/20' : 'bg-ed-dark/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-ed-text font-semibold text-sm">
                    Grade {g}
                    {craftable && <span className="ml-2 text-ed-success text-xs font-mono">✓ craftable</span>}
                  </p>
                  <button
                    className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                      isPinned?.(bp.id, g)
                        ? 'border-ed-orange text-ed-orange'
                        : 'border-ed-border text-ed-muted hover:border-ed-orange/50 hover:text-ed-orange'
                    }`}
                    onClick={() => togglePin?.(bp.id, g)}
                  >
                    {isPinned?.(bp.id, g) ? '📌 Pinned' : '📌 Pin'}
                  </button>
                </div>
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
}

function BlueprintsTab({ materials, isPinned, togglePin }) {
  const [blueprints, setBlueprints] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [openModules, setOpenModules] = useState(() => new Set())

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

  function toggleModule(name) {
    setOpenModules(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const cardProps = { matMap, canCraftGrade, highestCraftableGrade, isPinned, togglePin }

  // Searching flattens the groups so matches are visible immediately.
  const q = search.toLowerCase()
  if (q) {
    const filtered = blueprints.filter(b =>
      b.name?.toLowerCase().includes(q)
      || (b.applies_to ?? []).some(m => m.toLowerCase().includes(q))
    )
    return (
      <div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search blueprints or modules…" />
        {filtered.length === 0 ? (
          <EmptyState message="No blueprints match your search." />
        ) : (
          <div className="space-y-2">
            {filtered.map(bp => (
              <BlueprintCard key={bp.id} bp={bp} isOpen={expanded === bp.id}
                onToggle={() => setExpanded(expanded === bp.id ? null : bp.id)}
                showModuleTags {...cardProps} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const byModule = {}
  for (const bp of blueprints) {
    const mod = bp.applies_to?.[0] ?? 'Other'
    ;(byModule[mod] ??= []).push(bp)
  }
  const known = new Set(MODULE_CATEGORIES.flatMap(c => c.modules))
  const leftovers = Object.keys(byModule).filter(m => !known.has(m)).sort()
  const categories = leftovers.length
    ? [...MODULE_CATEGORIES, { title: 'Other', modules: leftovers }]
    : MODULE_CATEGORIES

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search blueprints or modules…" />

      {blueprints.length === 0 ? (
        <EmptyState message="No blueprints found. Full dataset comes from EDCD blueprints.json." />
      ) : (
        <div className="space-y-5">
          {categories.map(cat => {
            const modules = cat.modules.filter(m => byModule[m]?.length)
            if (modules.length === 0) return null
            return (
              <div key={cat.title}>
                <h3 className="text-ed-text font-ui font-semibold text-sm mb-2">
                  {cat.title}{' '}
                  <span className="text-ed-muted font-mono text-xs">
                    ({modules.reduce((n, m) => n + byModule[m].length, 0)})
                  </span>
                </h3>
                <div className="space-y-1.5">
                  {modules.map(mod => {
                    const bps = byModule[mod]
                    const isOpen = openModules.has(mod)
                    const craftableCount = bps.filter(b => highestCraftableGrade(b) != null).length
                    const hasPin = bps.some(b =>
                      Object.keys(b.grades ?? {}).some(g => isPinned?.(b.id, g)))
                    return (
                      <div key={mod} className="panel !py-2">
                        <button
                          className="w-full flex items-center justify-between gap-3 text-left"
                          onClick={() => toggleModule(mod)}
                        >
                          <div>
                            <span className="text-ed-text font-ui text-sm">{mod}</span>
                            <span className="ml-2 text-ed-muted font-mono text-xs">({bps.length})</span>
                            {hasPin && <span className="ml-2 text-xs" title="Has pinned blueprints">📌</span>}
                            {craftableCount > 0 && (
                              <span className="ml-2 text-xs font-mono text-ed-success">
                                ✓ {craftableCount} craftable
                              </span>
                            )}
                          </div>
                          <span className="text-ed-muted text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-2 space-y-2">
                            {bps.map(bp => (
                              <BlueprintCard key={bp.id} bp={bp} isOpen={expanded === bp.id}
                                onToggle={() => setExpanded(expanded === bp.id ? null : bp.id)}
                                {...cardProps} />
                            ))}
                          </div>
                        )}
                      </div>
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

// ---- Tab: Pinned blueprints ----

const MAT_CAT_COLORS = {
  Raw: 'border-amber-500/50 text-amber-400',
  Manufactured: 'border-sky-500/50 text-sky-400',
  Encoded: 'border-emerald-500/50 text-emerald-400',
}

function PinnedTab({ materials, pins, togglePin, setPinRolls, goToBlueprints }) {
  const [blueprints, setBlueprints] = useState([])

  useEffect(() => {
    api()?.get_blueprints().then(r => setBlueprints(r ?? []))
  }, [])

  const matMap = {}
  for (const m of materials) matMap[m.name.toLowerCase()] = m.count

  const bpMap = {}
  for (const b of blueprints) bpMap[b.id] = b

  // Join pins to blueprint data; drop pins whose blueprint vanished from the dataset
  const entries = pins
    .map(p => {
      const bp = bpMap[p.blueprint_id]
      const grade = bp?.grades?.[p.grade]
      if (!bp || !grade) return null
      const rolls = p.rolls ?? 1
      const mats = (grade.materials ?? []).map(m => {
        const need = m.amount * rolls
        const have = matMap[m.name.toLowerCase()] ?? 0
        return { ...m, need, have, missing: Math.max(0, need - have) }
      })
      return {
        ...p, bp, rolls, mats,
        ready: mats.length > 0 && mats.every(m => m.missing === 0),
      }
    })
    .filter(Boolean)

  // Shopping list: total shortfall per material across every pin
  const missingByMat = {}
  for (const e of entries) {
    for (const m of e.mats) {
      const key = m.name.toLowerCase()
      missingByMat[key] ??= { name: m.name, category: m.category, need: 0 }
      missingByMat[key].need += m.need
    }
  }
  const shopping = Object.values(missingByMat)
    .map(m => ({ ...m, have: matMap[m.name.toLowerCase()] ?? 0 }))
    .map(m => ({ ...m, missing: Math.max(0, m.need - m.have) }))
    .filter(m => m.missing > 0)
    .sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name))

  if (entries.length === 0) {
    return (
      <div>
        <EmptyState message="Nothing pinned yet." />
        <p className="text-ed-muted text-sm text-center">
          Pin blueprint grades from the{' '}
          <button className="text-ed-orange hover:underline" onClick={goToBlueprints}>Blueprints tab</button>
          {' '}to track the materials you still need.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Missing materials across all pins */}
      <div className={`panel ${shopping.length === 0 ? 'border border-ed-success/30' : 'border border-ed-orange/30'}`}>
        <p className="text-ed-muted text-xs font-mono uppercase tracking-wider mb-2">
          Materials still needed
        </p>
        {shopping.length === 0 ? (
          <p className="text-ed-success text-sm font-mono">
            ✓ You have everything for all pinned blueprints
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {shopping.map(m => (
              <div key={m.name} className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Tag label={m.category} color={MAT_CAT_COLORS[m.category] ?? 'border-ed-border text-ed-muted'} />
                  <span className="text-ed-text truncate">{m.name}</span>
                </span>
                <span className="shrink-0 ml-2">
                  <span className="text-ed-danger font-semibold">need {m.missing}</span>
                  <span className="text-ed-muted"> · {m.have}/{m.need}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {shopping.length > 0 && (
          <p className="text-ed-muted text-[10px] font-mono mt-2">
            Short on materials? Check the Traders &amp; Brokers tab for the nearest material trader.
          </p>
        )}
      </div>

      {/* One card per pinned blueprint grade */}
      {entries.map(e => (
        <div key={`${e.blueprint_id}|${e.grade}`}
          className={`panel ${e.ready ? 'border border-ed-success/30' : ''}`}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <span className="text-ed-text font-semibold font-ui">{e.bp.name}</span>
              <span className="ml-2 text-xs font-mono text-ed-orange">G{e.grade}</span>
              {e.ready && <span className="ml-2 text-xs font-mono text-ed-success">✓ ready to craft</span>}
            </div>
            <button className="text-ed-danger text-xs font-mono hover:underline shrink-0"
              onClick={() => togglePin(e.blueprint_id, e.grade)}>
              Unpin
            </button>
          </div>
          {(e.bp.applies_to?.length > 0) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {e.bp.applies_to.map(m => <Tag key={m} label={m} />)}
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-ed-muted text-xs font-mono">Rolls:</span>
            <button className="text-ed-muted border border-ed-border rounded w-5 h-5 text-xs leading-none hover:text-ed-text"
              onClick={() => setPinRolls(e.blueprint_id, e.grade, e.rolls - 1)} disabled={e.rolls <= 1}>−</button>
            <span className="text-ed-text text-xs font-mono w-4 text-center">{e.rolls}</span>
            <button className="text-ed-muted border border-ed-border rounded w-5 h-5 text-xs leading-none hover:text-ed-text"
              onClick={() => setPinRolls(e.blueprint_id, e.grade, e.rolls + 1)}>+</button>
            <span className="text-ed-muted text-[10px] font-mono">
              (each grade usually takes several rolls to max)
            </span>
          </div>

          <div className="space-y-0.5">
            {e.mats.map(m => (
              <div key={m.name} className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Tag label={m.category} color={MAT_CAT_COLORS[m.category] ?? 'border-ed-border text-ed-muted'} />
                  <span className={m.missing === 0 ? 'text-ed-success' : 'text-ed-text'}>{m.name}</span>
                </span>
                <span className="shrink-0 ml-2">
                  <span className={m.missing === 0 ? 'text-ed-success' : 'text-ed-danger'}>
                    {m.have}/{m.need}
                  </span>
                  {m.missing > 0 && <span className="text-ed-danger"> (−{m.missing})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
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

// ---- Tab: Material Traders & Tech Brokers ----

const SEARCH_KINDS = [
  { id: 'traders', label: 'Material Traders' },
  { id: 'brokers', label: 'Tech Brokers' },
]

const KIND_TYPES = {
  traders: [
    { id: '',             label: 'All Traders' },
    { id: 'Raw',          label: 'Raw' },
    { id: 'Manufactured', label: 'Manufactured' },
    { id: 'Encoded',      label: 'Encoded' },
  ],
  brokers: [
    { id: '',         label: 'All Brokers' },
    { id: 'Guardian', label: 'Guardian' },
    { id: 'Human',    label: 'Human' },
  ],
}

const TRADER_COLORS = {
  Raw:          'text-amber-400 border-amber-400/40',
  Manufactured: 'text-sky-400 border-sky-400/40',
  Encoded:      'text-emerald-400 border-emerald-400/40',
  Guardian:     'text-violet-400 border-violet-400/40',
  Human:        'text-ed-orange border-ed-orange/40',
}

function TradersTab() {
  const [system, setSystem] = useState('')
  const [kind, setKind] = useState('traders')
  const [traderType, setTraderType] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api()?.get_current_system?.().then(s => { if (s) setSystem(s) }).catch(() => {})
  }, [])

  async function search(type = traderType, searchKind = kind) {
    setSearching(true)
    setError('')
    const r = searchKind === 'brokers'
      ? await api()?.find_tech_brokers(system, type)
      : await api()?.find_material_traders(system, type)
    setSearching(false)
    if (r?.error) {
      setError(r.error)
      setResult(null)
    } else {
      setResult(r)
    }
  }

  function pickKind(k) {
    setKind(k)
    setTraderType('')
    if (result || system) search('', k)
  }

  function pickType(type) {
    setTraderType(type)
    if (result || system) search(type)
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Find the nearest material traders and technology brokers. Raw traders sit at
        Extraction/Refinery stations, Manufactured at Industrial, Encoded at High Tech/Military.
      </p>

      <div className="panel mb-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex gap-2">
            {SEARCH_KINDS.map(k => (
              <button
                key={k.id}
                onClick={() => pickKind(k.id)}
                className={`text-xs font-mono border rounded px-3 py-2 transition-colors ${
                  kind === k.id
                    ? 'border-ed-orange text-ed-orange bg-ed-orange/10'
                    : 'border-ed-border text-ed-muted hover:text-ed-text'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-ed-muted font-ui mb-1 block">Near system</label>
            <input
              value={system}
              onChange={e => setSystem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') search() }}
              placeholder="Reference system"
              className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
            />
          </div>
          <button
            onClick={() => search()}
            disabled={searching}
            className="btn-primary disabled:opacity-40"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {KIND_TYPES[kind].map(t => (
            <button
              key={t.id}
              onClick={() => pickType(t.id)}
              className={`text-xs font-mono border rounded px-3 py-1.5 transition-colors ${
                traderType === t.id
                  ? 'border-ed-orange text-ed-orange bg-ed-orange/10'
                  : 'border-ed-border text-ed-muted hover:text-ed-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs font-mono mb-3">{error}</p>}

      {result && (
        <div className="panel overflow-x-auto">
          <p className="text-ed-muted text-xs font-mono mb-2">
            {result.results.length} results near {result.reference}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                <th className="text-left pb-2 pr-4">Trader</th>
                <th className="text-left pb-2 pr-4">Station</th>
                <th className="text-left pb-2 pr-4">System</th>
                <th className="text-right pb-2 pr-4">Distance</th>
                <th className="text-right pb-2 pr-4">Arrival</th>
                <th className="text-left pb-2 pr-4">Pad</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((s, i) => (
                <tr key={i} className="border-b border-ed-border/40">
                  <td className="py-1.5 pr-4">
                    <span className={`text-xs font-mono border rounded px-2 py-0.5 ${
                      TRADER_COLORS[s.trader] ?? 'text-ed-muted border-ed-border'
                    }`}>
                      {s.trader || '?'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-ed-text">
                    {s.station}
                    {s.planetary && <span className="text-ed-muted text-xs ml-1.5" title="Planetary">🜨</span>}
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-ed-muted">{s.system}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-text">{s.distance.toLocaleString()} ly</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">{s.arrival.toLocaleString()} ls</td>
                  <td className="py-1.5 pr-4 font-mono text-xs">
                    {s.large_pad === true ? <span className="text-ed-success">L</span>
                      : s.large_pad === false ? <span className="text-amber-400">M</span>
                      : <span className="text-ed-muted">?</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => api()?.copy_to_clipboard(s.system)}
                      title="Copy system name"
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'engineers',   label: 'Engineers' },
  { id: 'blueprints',  label: 'Blueprints' },
  { id: 'pinned',      label: 'Pinned' },
  { id: 'synthesis',   label: 'Synthesis' },
  { id: 'tech_broker', label: 'Tech Broker' },
  { id: 'materials',   label: 'Materials' },
  { id: 'traders',     label: 'Traders & Brokers' },
]

export default function Engineering() {
  const [tab, setTab] = useState('engineers')
  const [materials, setMaterials] = useState([])
  const [pins, setPins] = useState([])

  useEffect(() => {
    api()?.get_materials().then(r => setMaterials(r ?? []))
    api()?.get_pinned_blueprints?.().then(r => setPins(r ?? []))
  }, [])

  const isPinned = (bpId, grade) =>
    pins.some(p => p.blueprint_id === bpId && p.grade === String(grade))

  async function togglePin(bpId, grade) {
    const g = String(grade)
    const next = isPinned(bpId, g)
      ? await api()?.unpin_blueprint(bpId, g)
      : await api()?.pin_blueprint(bpId, g)
    if (next) setPins(next)
  }

  async function setPinRolls(bpId, grade, rolls) {
    const next = await api()?.set_pin_rolls(bpId, String(grade), rolls)
    if (next) setPins(next)
  }

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
            {t.id === 'pinned' && pins.length > 0 ? `${t.label} (${pins.length})` : t.label}
          </button>
        ))}
      </div>

      {tab === 'engineers'   && <EngineersTab />}
      {tab === 'blueprints'  && <BlueprintsTab materials={materials} isPinned={isPinned} togglePin={togglePin} />}
      {tab === 'pinned'      && <PinnedTab materials={materials} pins={pins} togglePin={togglePin} setPinRolls={setPinRolls} goToBlueprints={() => setTab('blueprints')} />}
      {tab === 'synthesis'   && <SynthesisTab materials={materials} />}
      {tab === 'tech_broker' && <TechBrokerTab materials={materials} />}
      {tab === 'materials'   && <MaterialsTab materials={materials} setMaterials={setMaterials} />}
      {tab === 'traders'     && <TradersTab />}
    </div>
  )
}
