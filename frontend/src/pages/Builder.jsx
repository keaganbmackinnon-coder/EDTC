import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ShipView, { hasModel } from '../components/ShipView'

const api = () => window?.pywebview?.api

// core-internal slot order — mirrors backend outfitting.CORE_GROUP_ORDER
const CORE = [
  ['pp', 'Power Plant'], ['t', 'Thrusters'], ['fsd', 'Frame Shift Drive'],
  ['ls', 'Life Support'], ['pd', 'Power Distributor'], ['s', 'Sensors'], ['ft', 'Fuel Tank'],
]
const PAD = { 1: 'S', 2: 'M', 3: 'L' }
const HP_SIZE = { 1: 'Small', 2: 'Medium', 3: 'Large', 4: 'Huge' }
const RATING_ORDER = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8 }

function cr(n) { return (n ?? 0).toLocaleString() + ' CR' }

// derive the ordered slot layout for a ship (ships.json entry)
function shipSlots(ship) {
  if (!ship) return []
  const out = []
  ;(ship.core_slots || []).forEach((sz, i) => {
    const [grp, label] = CORE[i] || [`c${i}`, `Core ${i + 1}`]
    out.push({ key: `core:${grp}`, label, family: 'core', grp, size: sz, section: 'Core Internals' })
  })
  ;(ship.hardpoint_sizes || []).forEach((sz, i) =>
    out.push({ key: `hardpoint:${i}`, label: `${HP_SIZE[sz]} Hardpoint`, family: 'hardpoint', size: sz, section: 'Hardpoints' }))
  for (let i = 0; i < (ship.utility_slots || 0); i++)
    out.push({ key: `utility:${i}`, label: 'Utility Mount', family: 'utility', size: 0, section: 'Utility Mounts' })
  ;(ship.optional_slots || []).forEach((sz, i) =>
    out.push({ key: `optional:${i}`, label: `Optional Internal`, family: 'optional', size: sz, section: 'Optional Internals' }))
  ;(ship.military_slots || []).forEach((sz, i) =>
    out.push({ key: `military:${i}`, label: `Military`, family: 'military', size: sz, section: 'Military Slots' }))
  return out
}

// valid modules for a given slot (by family + size ceiling)
function validModules(modules, slot) {
  if (!modules) return []
  let pool = []
  if (slot.family === 'core') pool = modules.core?.[slot.grp] || []
  else if (slot.family === 'hardpoint') pool = Object.values(modules.hardpoint || {}).flat()
  else if (slot.family === 'utility') pool = Object.values(modules.utility || {}).flat()
  else if (slot.family === 'optional') pool = Object.values(modules.optional || {}).flat()
  else if (slot.family === 'military') pool = Object.values(modules.optional || {}).flat().filter(m => m.military_ok)
  return pool
    .filter(m => Number(m.class || 0) <= slot.size || slot.family === 'utility')
    .sort((a, b) => (b.class - a.class) || (RATING_ORDER[a.rating] ?? 9) - (RATING_ORDER[b.rating] ?? 9)
      || (a.group_name || '').localeCompare(b.group_name || ''))
}

const SECTIONS = ['Hardpoints', 'Utility Mounts', 'Core Internals', 'Optional Internals', 'Military Slots']

// ── stat panel ───────────────────────────────────────────────────────────────
function Stat({ label, value, unit, tone }) {
  return (
    <div className="panel py-2 px-3">
      <div className="text-ed-muted text-[10px] uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-sm mt-0.5 ${tone || 'text-ed-text'}`}>
        {value}{unit && <span className="text-ed-muted text-xs ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

function StatsPanel({ stats, ship }) {
  if (!ship) return null
  if (!stats) return <div className="panel text-ed-muted text-sm">Computing…</div>
  if (stats.error) return <div className="panel text-ed-danger text-sm">{stats.error}</div>
  const pct = stats.power_capacity ? Math.min(100, (stats.power_deployed / stats.power_capacity) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="panel py-2 px-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-ed-muted">
          <span>Power (deployed)</span>
          <span className={stats.power_ok ? 'text-ed-success' : 'text-ed-danger'}>
            {stats.power_deployed} / {stats.power_capacity} MW
          </span>
        </div>
        <div className="h-2 mt-1 rounded bg-ed-dark overflow-hidden">
          <div className="h-full rounded" style={{ width: `${pct}%`, background: stats.power_ok ? '#4ade80' : '#f87171' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Jump (laden)" value={stats.jump_range_laden} unit="ly" tone="text-ed-orange" />
        <Stat label="Jump (max)" value={stats.jump_range_max} unit="ly" />
        <Stat label="Shields" value={cr(stats.shield_mj).replace(' CR', '')} unit="MJ" />
        <Stat label="Armour" value={cr(stats.armour).replace(' CR', '')} />
        <Stat label="Speed" value={stats.speed} unit="m/s" />
        <Stat label="Boost" value={stats.boost} unit="m/s" />
        <Stat label="DPS" value={stats.dps} />
        <Stat label="Cargo" value={stats.cargo_capacity} unit="t" />
        <Stat label="Unladen mass" value={stats.mass_unladen} unit="t" />
        <Stat label="Fuel" value={stats.fuel_capacity} unit="t" />
        <Stat label="Rebuy" value={cr(stats.rebuy)} tone="text-ed-gold" />
        <Stat label="Total cost" value={cr(stats.total_cost)} tone="text-ed-gold" />
      </div>
    </div>
  )
}

// ── right drawer: module picker ───────────────────────────────────────────────
function ModulePicker({ slot, modules, onPick, onClose }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const all = validModules(modules, slot)
    const s = q.trim().toLowerCase()
    return s ? all.filter(m => (m.display || m.group_name || '').toLowerCase().includes(s)) : all
  }, [modules, slot, q])
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-ed-text font-ui font-semibold text-sm">
          {slot.label}{slot.size ? ` · size ${slot.size}` : ''}
        </h3>
        <button onClick={onClose} className="text-ed-muted hover:text-ed-text text-sm">✕</button>
      </div>
      <input className="input font-mono text-sm mb-2" placeholder="Search modules…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="overflow-y-auto flex-1 space-y-1 pr-1">
        <button onClick={() => onPick(null)} className="w-full text-left px-3 py-2 rounded border border-ed-border hover:border-ed-danger/60 text-ed-muted text-sm">
          — Empty slot —
        </button>
        {list.map((m, i) => (
          <button key={m.symbol || i} onClick={() => onPick(m)}
            className="w-full text-left px-3 py-2 rounded border border-ed-border hover:border-ed-orange/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ed-text text-sm truncate">{m.display || m.group_name}</span>
              <span className="badge border border-ed-border text-ed-orange shrink-0 font-mono">{m.class}{m.rating}</span>
            </div>
            <div className="text-ed-muted text-[11px] font-mono flex gap-3">
              {m.mass != null && <span>{m.mass}t</span>}
              {m.power != null && <span>{m.power}MW</span>}
              {m.mount && <span>{m.mount === 'F' ? 'Fixed' : m.mount === 'G' ? 'Gimbal' : 'Turret'}</span>}
              {m.cost ? <span className="text-ed-gold">{cr(m.cost)}</span> : null}
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="text-ed-muted text-sm text-center py-6">No modules fit this slot.</div>}
      </div>
    </div>
  )
}

// ── right drawer: engineering editor ──────────────────────────────────────────
function EngineerEditor({ slot, fitted, blueprints, onSave, onClose }) {
  const eng = fitted?.engineering || {}
  const [bp, setBp] = useState(eng.blueprint || '')
  const [grade, setGrade] = useState(eng.grade || 5)
  const [exp, setExp] = useState(eng.experimental || '')
  const [q, setQ] = useState('')
  const imported = !!eng.modifiers
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (blueprints || []).filter(b => !s || (b.name || '').toLowerCase().includes(s)).slice(0, 60)
  }, [blueprints, q])
  const selected = blueprints?.find(b => b.id === bp)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-ed-text font-ui font-semibold text-sm">Engineering · {slot.label}</h3>
        <button onClick={onClose} className="text-ed-muted hover:text-ed-text text-sm">✕</button>
      </div>
      {imported && (
        <div className="panel text-[11px] text-ed-muted mb-2">
          Imported from your ship — stats use the game's exact modifiers
          {eng.blueprint ? <> ({eng.blueprint} G{eng.grade})</> : null}. Choosing a blueprint below
          switches this module to a planned (estimated) roll.
        </div>
      )}
      <input className="input font-mono text-sm mb-2" placeholder="Search blueprints…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="overflow-y-auto flex-1 space-y-1 pr-1 min-h-0">
        <button onClick={() => setBp('')} className={`w-full text-left px-3 py-1.5 rounded border text-sm ${!bp ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted'}`}>
          — No blueprint —
        </button>
        {list.map(b => (
          <button key={b.id} onClick={() => setBp(b.id)}
            className={`w-full text-left px-3 py-1.5 rounded border text-sm ${bp === b.id ? 'border-ed-orange bg-ed-dark' : 'border-ed-border hover:border-ed-orange/50'}`}>
            <span className="text-ed-text">{b.name}</span>
            <span className="text-ed-muted text-[10px] ml-2">{(b.applies_to || []).join(', ')}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-ed-border/50 space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-ed-muted text-xs mr-1">Grade</span>
          {[1, 2, 3, 4, 5].map(g => (
            <button key={g} onClick={() => setGrade(g)}
              className={`badge border px-2 py-1 ${grade === g ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted'}`}>{g}</button>
          ))}
        </div>
        <input className="input font-mono text-xs" placeholder="Experimental effect (optional)" value={exp} onChange={e => setExp(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => onSave({ blueprint: bp, grade, experimental: exp })}>Save engineering</button>
          {(eng.blueprint || eng.modifiers) && (
            <button className="btn-ghost" onClick={() => onSave(null)}>Remove</button>
          )}
        </div>
        {selected && (
          <div className="text-[11px] text-ed-muted">
            Engineers: {(selected.engineers || []).join(', ') || '—'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Builder() {
  const [ships, setShips] = useState([])
  const [modules, setModules] = useState(null)
  const [blueprints, setBlueprints] = useState([])
  const [saved, setSaved] = useState([])
  const [build, setBuild] = useState(null)        // working build {id?, name, ship_id, source, unladen_mass?, slots:{}}
  const [stats, setStats] = useState(null)
  const [drawer, setDrawer] = useState(null)       // {slotKey, mode:'module'|'engineer'}
  const [hoverSlot, setHoverSlot] = useState(null) // slot key highlighted on the schematic
  const [newShip, setNewShip] = useState('')
  const [busy, setBusy] = useState('')
  const debounce = useRef(null)

  const loadSaved = useCallback(() => {
    api()?.get_builds?.().then(rows => setSaved((rows || []).map(r => {
      let data = {}
      try { data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}) } catch { data = {} }
      return { id: r.id, name: r.name, ship: r.ship, updated: r.updated, data }
    })))
  }, [])

  useEffect(() => {
    function load() {
      api()?.get_ships?.().then(r => setShips(r || []))
      api()?.get_modules?.().then(r => setModules(r?.modules || null))
      api()?.get_blueprints?.().then(r => setBlueprints(r || []))
      loadSaved()
    }
    if (api()) load()
    else { window.addEventListener('pywebviewready', load, { once: true }); return () => window.removeEventListener('pywebviewready', load) }
  }, [loadSaved])

  const ship = useMemo(() => ships.find(s => s.id === build?.ship_id) || null, [ships, build])
  const slots = useMemo(() => shipSlots(ship), [ship])

  // recompute stats (debounced) whenever the working build changes
  useEffect(() => {
    if (!build?.ship_id) { setStats(null); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      api()?.compute_build?.(build).then(setStats)
    }, 200)
    return () => clearTimeout(debounce.current)
  }, [build])

  function importShip() {
    setBusy('import')
    api()?.import_current_build?.().then(b => {
      setBusy('')
      if (!b || b.error) { alert(b?.error || 'Import failed.'); return }
      if (!b.ship_id) { alert('Imported, but the ship type was not recognised — stats unavailable.'); }
      setBuild(b); setDrawer(null)
    })
  }

  function startNew() {
    if (!newShip) return
    const s = ships.find(x => x.id === newShip)
    setBuild({ name: `${s?.name || 'New'} build`, ship_id: newShip, source: 'manual', slots: {} })
    setDrawer(null)
  }

  function openBuild(b) {
    setBuild({ id: b.id, name: b.name, ...b.data }); setDrawer(null)
  }

  function setSlot(key, fitted) {
    setBuild(b => {
      const s = { ...(b.slots || {}) }
      if (fitted === null) delete s[key]; else s[key] = fitted
      return { ...b, slots: s }
    })
  }

  function pickModule(slot, mod) {
    if (!mod) setSlot(slot.key, null)
    else {
      const existing = build.slots?.[slot.key]
      setSlot(slot.key, { symbol: mod.symbol, engineering: existing?.engineering || null })
    }
    setDrawer(null)
  }

  function saveEngineering(slotKey, eng) {
    setBuild(b => {
      const cur = b.slots?.[slotKey]; if (!cur) return b
      return { ...b, slots: { ...b.slots, [slotKey]: { ...cur, engineering: eng } } }
    })
    setDrawer(null)
  }

  function saveBuild() {
    if (!build?.ship_id) { alert('Nothing to save.'); return }
    setBusy('save')
    const payload = { id: build.id, name: build.name || 'Unnamed build', ship: build.ship_id, data: build }
    api()?.save_build?.(payload).then(res => {
      setBusy('')
      if (res?.id) setBuild(b => ({ ...b, id: res.id }))
      loadSaved()
    })
  }

  function deleteBuild(id) {
    if (!confirm('Delete this build?')) return
    api()?.delete_build?.(id).then(() => { loadSaved(); if (build?.id === id) setBuild(null) })
  }

  const moduleBySymbol = useCallback((sym) => {
    if (!modules || !sym) return null
    const low = String(sym).toLowerCase()
    for (const fam of Object.values(modules))
      for (const grp of Object.values(fam))
        for (const m of grp) if (String(m.symbol).toLowerCase() === low) return m
    return null
  }, [modules])

  const drawerSlot = drawer && slots.find(s => s.key === drawer.slotKey)

  return (
    <div className="p-6 h-full flex flex-col">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-ui font-bold text-ed-text">Ship Builder</h1>
          <p className="text-ed-muted text-sm">Outfit a ship, track engineering per module, and save the build. Import your live ship for exact stats.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-4 flex-1 min-h-0">
        {/* ── builds library ── */}
        <div className="flex flex-col min-h-0">
          <button className="btn-primary mb-2" disabled={busy === 'import'} onClick={importShip}>
            {busy === 'import' ? 'Importing…' : '⬇ Import current ship'}
          </button>
          <div className="flex gap-1 mb-3">
            <select className="input text-xs flex-1" value={newShip} onChange={e => setNewShip(e.target.value)}>
              <option value="">New build from…</option>
              {ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn-ghost px-2" onClick={startNew} disabled={!newShip}>+</button>
          </div>
          <div className="text-ed-muted text-[10px] uppercase tracking-wide mb-1">Saved builds</div>
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {saved.map(b => (
              <div key={b.id}
                className={`px-3 py-2 rounded border cursor-pointer group ${build?.id === b.id ? 'border-ed-orange bg-ed-dark' : 'border-ed-border hover:border-ed-orange/50'}`}
                onClick={() => openBuild(b)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ed-text text-sm truncate">{b.name}</span>
                  <button onClick={e => { e.stopPropagation(); deleteBuild(b.id) }}
                    className="text-ed-muted hover:text-ed-danger text-xs opacity-0 group-hover:opacity-100">✕</button>
                </div>
                <div className="text-ed-muted text-[11px] truncate">
                  {ships.find(s => s.id === b.data?.ship_id)?.name || b.ship}
                  {b.data?.source === 'import' && <span className="text-ed-success ml-1">· imported</span>}
                </div>
              </div>
            ))}
            {saved.length === 0 && <div className="text-ed-muted text-xs text-center py-4">No saved builds yet.</div>}
          </div>
        </div>

        {/* ── slot editor ── */}
        <div className="flex flex-col min-h-0">
          {!build ? (
            <div className="panel h-full flex items-center justify-center text-ed-muted text-sm">
              Import your current ship or start a new build.
            </div>
          ) : (
            <>
              {/* fixed header: name, ship, live schematic */}
              <div className="space-y-2 mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <input className="input font-ui text-lg font-semibold flex-1" value={build.name}
                    onChange={e => setBuild(b => ({ ...b, name: e.target.value }))} />
                  <button className="btn-primary" disabled={busy === 'save'} onClick={saveBuild}>
                    {busy === 'save' ? 'Saving…' : '💾 Save'}
                  </button>
                </div>
                <div className="text-ed-muted text-sm">
                  {ship ? <>{ship.name} · {PAD[ship.pad_size]} pad{build.ship_ident ? ` · ${build.ship_ident}` : ''}</>
                    : <span className="text-ed-danger">Ship type “{build.ship_id || 'unknown'}” not recognised — stats unavailable.</span>}
                </div>
                {ship && (
                  <div className="panel p-2 bg-gradient-to-b from-ed-panel to-ed-dark">
                    <div className="w-full" style={{ aspectRatio: '340 / 240' }}>
                      <ShipView ship={ship}
                        activeKey={drawer?.slotKey || hoverSlot}
                        onSelectMount={key => setDrawer({ slotKey: key, mode: 'module' })} />
                    </div>
                    <div className="text-center text-[10px] font-mono text-ed-muted mt-0.5">
                      {hasModel(ship.id)
                        ? 'drag to rotate · scroll to zoom · hover a hardpoint below to locate it'
                        : 'hover a hardpoint below to locate it · click a marker to fit that slot'}
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-y-auto pr-1 min-h-0 space-y-3">
              {SECTIONS.map(section => {
                const rows = slots.filter(s => s.section === section)
                if (rows.length === 0) return null
                return (
                  <section key={section} className="panel">
                    <h3 className="text-ed-text font-ui font-semibold text-sm mb-2">{section}</h3>
                    <div className="space-y-1">
                      {rows.map(slot => {
                        const fitted = build.slots?.[slot.key]
                        const mod = fitted && moduleBySymbol(fitted.symbol)
                        const eng = fitted?.engineering
                        const locatable = slot.family === 'hardpoint' || slot.family === 'utility'
                        const hi = (drawer?.slotKey || hoverSlot) === slot.key && locatable
                        return (
                          <div key={slot.key}
                            onMouseEnter={() => locatable && setHoverSlot(slot.key)}
                            onMouseLeave={() => setHoverSlot(h => (h === slot.key ? null : h))}
                            className={`flex items-center gap-2 border-b border-ed-border/40 py-1.5 rounded px-1 -mx-1 ${hi ? 'bg-ed-orange/10' : ''}`}>
                            <span className="badge border border-ed-border text-ed-muted shrink-0 w-8 text-center font-mono">
                              {slot.size || 'U'}
                            </span>
                            <button onClick={() => setDrawer({ slotKey: slot.key, mode: 'module' })}
                              className="flex-1 text-left min-w-0">
                              {mod ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-ed-text text-sm truncate">{mod.display || mod.group_name}</span>
                                  <span className="badge border border-ed-border text-ed-orange shrink-0 font-mono">{mod.class}{mod.rating}</span>
                                </div>
                              ) : fitted ? (
                                <span className="text-ed-muted text-sm italic">unknown module</span>
                              ) : (
                                <span className="text-ed-muted text-sm">— {slot.label} —</span>
                              )}
                            </button>
                            {fitted && (
                              <button onClick={() => setDrawer({ slotKey: slot.key, mode: 'engineer' })}
                                className={`badge border shrink-0 ${eng ? 'border-ed-orange/60 text-ed-orange' : 'border-ed-border text-ed-muted hover:text-ed-text'}`}
                                title="Engineering">
                                {eng ? `🔧 ${eng.blueprint ? '' : 'G'}${eng.grade ?? ''}${eng.modifiers && !eng.blueprint ? ' ✓' : ''}` : '🔧'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              </div>
            </>
          )}
        </div>

        {/* ── right column: stats or drawer ── */}
        <div className="overflow-y-auto min-h-0">
          {drawer && drawerSlot ? (
            <div className="panel h-full">
              {drawer.mode === 'module'
                ? <ModulePicker slot={drawerSlot} modules={modules}
                    onPick={m => pickModule(drawerSlot, m)} onClose={() => setDrawer(null)} />
                : <EngineerEditor slot={drawerSlot} fitted={build.slots?.[drawer.slotKey]} blueprints={blueprints}
                    onSave={eng => saveEngineering(drawer.slotKey, eng)} onClose={() => setDrawer(null)} />}
            </div>
          ) : (
            <StatsPanel stats={stats} ship={ship} />
          )}
        </div>
      </div>
    </div>
  )
}
