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
function num(n) { return (n ?? 0).toLocaleString() }
function resPct(v) {
  const p = (v ?? 0) * 100
  const r = Math.abs(p) < 10 ? +p.toFixed(1) : Math.round(p)
  return (r > 0 ? '+' : '') + r + '%'
}

function Section({ title, right, children }) {
  return (
    <div className="panel py-2 px-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-ed-orange text-[10px] uppercase tracking-widest">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, unit, tone }) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-sm">
      <span className="text-ed-muted text-xs">{label}</span>
      <span className={`font-mono ${tone || 'text-ed-text'}`}>
        {value}{unit && <span className="text-ed-muted text-[10px] ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

function ResGrid({ res, effective }) {
  const TYPES = [['kinetic', 'Kin'], ['thermal', 'Thm'], ['explosive', 'Exp'], ['caustic', 'Cau']]
  return (
    <table className="w-full text-[11px] font-mono mt-1">
      <thead>
        <tr className="text-ed-muted">
          <th className="text-left font-normal"></th>
          {TYPES.filter(([k]) => res[k] !== undefined).map(([k, l]) => (
            <th key={k} className="text-right font-normal px-1">{l}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-ed-muted">Resist</td>
          {TYPES.filter(([k]) => res[k] !== undefined).map(([k]) => (
            <td key={k} className={`text-right px-1 ${res[k] > 0 ? 'text-green-400' : res[k] < 0 ? 'text-red-400' : 'text-ed-muted'}`}>
              {resPct(res[k])}
            </td>
          ))}
        </tr>
        {effective && (
          <tr>
            <td className="text-ed-muted">Effective</td>
            {TYPES.filter(([k]) => res[k] !== undefined).map(([k]) => (
              <td key={k} className="text-right px-1 text-ed-text">{num(effective[k])}</td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  )
}

const DMG_COLORS = { thermal: '#fb923c', kinetic: '#60a5fa', explosive: '#fbbf24', absolute: '#c084fc', caustic: '#4ade80', other: '#9ca3af' }

function StatsPanel({ stats, ship, build, onBuild }) {
  if (!ship) return null
  if (!stats) return <div className="panel text-ed-muted text-sm">Computing…</div>
  if (stats.error) return <div className="panel text-ed-danger text-sm">{stats.error}</div>
  const pctD = stats.power_capacity ? Math.min(100, (stats.power_deployed / stats.power_capacity) * 100) : 0
  const pctR = stats.power_capacity ? Math.min(100, (stats.power_retracted / stats.power_capacity) * 100) : 0
  const prios = Object.entries(stats.power_priorities || {}).filter(([, v]) => v.deployed > 0)
  const dmgTypes = Object.entries(stats.dps_by_type || {}).sort((a, b) => b[1] - a[1])
  const fuelVal = build?.fuel_t ?? stats.fuel_capacity
  const cargoVal = build?.cargo_t ?? stats.cargo_capacity
  const sliding = build?.fuel_t != null || build?.cargo_t != null
  return (
    <div className="space-y-2">
      {/* ── power ── */}
      <Section title="Power"
        right={<span className={`text-[10px] font-mono ${stats.power_ok ? 'text-ed-success' : 'text-ed-danger'}`}>
          {stats.power_deployed} / {stats.power_capacity} MW
        </span>}>
        <div className="text-[10px] text-ed-muted flex justify-between"><span>Retracted</span><span className="font-mono">{stats.power_retracted} MW</span></div>
        <div className="h-1.5 rounded bg-ed-dark overflow-hidden mb-1">
          <div className="h-full rounded" style={{ width: `${pctR}%`, background: '#4ade80' }} />
        </div>
        <div className="text-[10px] text-ed-muted flex justify-between"><span>Deployed</span><span className="font-mono">{stats.power_deployed} MW</span></div>
        <div className="h-1.5 rounded bg-ed-dark overflow-hidden">
          <div className="h-full rounded" style={{ width: `${pctD}%`, background: stats.power_ok ? '#4ade80' : '#f87171' }} />
        </div>
        {prios.length > 1 && (
          <div className="flex gap-3 mt-1.5 text-[10px] font-mono text-ed-muted">
            {prios.map(([p, v]) => <span key={p}>P{p}: {v.deployed}</span>)}
          </div>
        )}
      </Section>

      {/* ── summary ── */}
      <Section title="Summary">
        <Row label="Jump (laden)" value={stats.jump_range_laden} unit="ly" tone="text-ed-orange" />
        <Row label="Jump (max)" value={stats.jump_range_max} unit="ly" />
        <Row label="Jump (total)" value={stats.jump_range_total} unit="ly" />
        {sliding && <Row label="Jump (current)" value={stats.jump_range_current} unit="ly" tone="text-ed-gold" />}
        <Row label="Mass (unladen)" value={stats.mass_unladen} unit="t" />
        <Row label="Mass (laden)" value={stats.mass_laden} unit="t" />
        <Row label="Cargo" value={stats.cargo_capacity} unit="t" />
        <Row label="Fuel" value={stats.fuel_capacity} unit="t" />
        <Row label="Cost" value={cr(stats.total_cost)} tone="text-ed-gold" />
        <Row label="Rebuy" value={cr(stats.rebuy)} tone="text-ed-gold" />
        {(stats.fuel_capacity > 0 || stats.cargo_capacity > 0) && (
          <div className="mt-1.5 pt-1.5 border-t border-ed-border/40 space-y-1">
            {stats.fuel_capacity > 0 && (
              <div>
                <div className="flex justify-between text-[10px] text-ed-muted">
                  <span>Fuel</span><span className="font-mono">{fuelVal}t / {stats.fuel_capacity}t</span>
                </div>
                <input type="range" className="w-full accent-orange-500" min="0" max={stats.fuel_capacity} step="1"
                  value={fuelVal}
                  onChange={e => onBuild(b => ({ ...b, fuel_t: +e.target.value }))} />
              </div>
            )}
            {stats.cargo_capacity > 0 && (
              <div>
                <div className="flex justify-between text-[10px] text-ed-muted">
                  <span>Cargo</span><span className="font-mono">{cargoVal}t / {stats.cargo_capacity}t</span>
                </div>
                <input type="range" className="w-full accent-orange-500" min="0" max={stats.cargo_capacity} step="1"
                  value={cargoVal}
                  onChange={e => onBuild(b => ({ ...b, cargo_t: +e.target.value }))} />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── offence ── */}
      <Section title="Offence">
        <Row label="DPS" value={stats.dps} tone="text-ed-orange" />
        <Row label="Sustained DPS" value={stats.sustained_dps} />
        <Row label="Energy / s" value={stats.eps} unit="MJ" />
        <Row label="Heat / s" value={stats.hps} />
        {stats.wep_drain_time != null && <Row label="WEP drains in" value={stats.wep_drain_time} unit="s" tone="text-ed-danger" />}
        {dmgTypes.length > 0 && (
          <>
            <div className="flex h-1.5 rounded overflow-hidden mt-1.5">
              {dmgTypes.map(([t, v]) => (
                <div key={t} style={{ width: `${(v / stats.dps) * 100}%`, background: DMG_COLORS[t] || DMG_COLORS.other }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 mt-1 text-[10px] font-mono">
              {dmgTypes.map(([t, v]) => (
                <span key={t} style={{ color: DMG_COLORS[t] || DMG_COLORS.other }}>{t} {v}</span>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ── defence ── */}
      <Section title="Defence">
        <Row label="Shields" value={num(stats.shield_mj)} unit="MJ" tone="text-ed-orange" />
        {stats.shield_mj > 0 && (
          <>
            <ResGrid res={stats.shield_res || {}} effective={stats.shield_effective} />
            {stats.shield_regen_time != null && <Row label="Regen 50→100%" value={stats.shield_regen_time} unit="s" />}
            {stats.shield_broken_time != null && <Row label="Recover (broken)" value={stats.shield_broken_time} unit="s" />}
            {stats.scb_total > 0 && <Row label="SCB reserve" value={num(stats.scb_total)} unit="MJ" tone="text-ed-success" />}
          </>
        )}
        <div className="mt-1.5 pt-1.5 border-t border-ed-border/40">
          <Row label={`Armour · ${stats.bulkhead_name || 'Lightweight'}`} value={num(stats.armour)} tone="text-ed-orange" />
          <ResGrid res={stats.armour_res || {}} effective={stats.armour_effective} />
          {stats.module_protection > 0 && <Row label="Module protection" value={resPct(stats.module_protection)} tone="text-ed-success" />}
          <Row label="Hardness" value={stats.hardness} />
        </div>
      </Section>

      {/* ── movement ── */}
      <Section title="Movement">
        <Row label="Speed" value={stats.speed} unit="m/s" />
        <Row label="Boost" value={stats.boost} unit="m/s" tone={stats.can_boost ? undefined : 'text-ed-danger'} />
        {!stats.can_boost && <div className="text-[10px] text-ed-danger">Distributor too small to boost ({stats.boost_energy} MJ needed)</div>}
        <Row label="Pitch / Roll / Yaw" value={`${stats.pitch} / ${stats.roll} / ${stats.yaw}`} unit="°/s" />
        <Row label="Mass lock" value={stats.masslock} />
      </Section>
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

// ── right drawer: bulkhead picker ─────────────────────────────────────────────
function BulkheadPicker({ ship, current, onPick, onClose }) {
  const base = ship.armour || 0
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-ed-text font-ui font-semibold text-sm">Bulkheads</h3>
        <button onClick={onClose} className="text-ed-muted hover:text-ed-text text-sm">✕</button>
      </div>
      <div className="overflow-y-auto flex-1 space-y-1 pr-1">
        {(ship.bulkheads || []).map((b, i) => (
          <button key={i} onClick={() => onPick(i)}
            className={`w-full text-left px-3 py-2 rounded border ${current === i ? 'border-ed-orange bg-ed-dark' : 'border-ed-border hover:border-ed-orange/60'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ed-text text-sm">{b.name}</span>
              <span className="badge border border-ed-border text-ed-orange shrink-0 font-mono">
                {Math.round(base * (1 + (b.hullboost || 0)))}
              </span>
            </div>
            <div className="text-ed-muted text-[11px] font-mono flex gap-3">
              <span>{b.mass || 0}t</span>
              {b.cost ? <span className="text-ed-gold">{cr(b.cost)}</span> : <span>free</span>}
              <span className={b.kinres > 0 ? 'text-green-400' : b.kinres < 0 ? 'text-red-400' : ''}>K {resPct(b.kinres)}</span>
              <span className={b.thermres > 0 ? 'text-green-400' : b.thermres < 0 ? 'text-red-400' : ''}>T {resPct(b.thermres)}</span>
              <span className={b.explres > 0 ? 'text-green-400' : b.explres < 0 ? 'text-red-400' : ''}>E {resPct(b.explres)}</span>
            </div>
          </button>
        ))}
        {(!ship.bulkheads || ship.bulkheads.length === 0) &&
          <div className="text-ed-muted text-sm text-center py-6">No bulkhead data for this ship — re-run scripts/build_data.py.</div>}
      </div>
    </div>
  )
}

// ── right drawer: engineering editor ──────────────────────────────────────────
function fmtPct(modifier) {
  const p = (modifier - 1) * 100
  const r = Math.abs(p) < 10 ? +p.toFixed(1) : Math.round(p)
  return (r > 0 ? '+' : '') + r + '%'
}

// module group_name → blueprint applies_to type, where the names differ
const BP_TYPE = {
  'Bi-Weave Shield Generator': 'Shield Generator',
  'Prismatic Shield Generator': 'Shield Generator',
  'Frame Shift Wake Scanner': 'Wake Scanner',
  'Detailed Surface Scanner': 'Surface Scanner',
  'Advanced Multi-Cannon': 'Multi-cannon',
  'Advanced Missile Rack': 'Missile Rack',
}

function EngineerEditor({ slot, fitted, module, blueprints, onSave, onClose }) {
  const eng = fitted?.engineering || {}
  const [bp, setBp] = useState(eng.blueprint || '')
  const [grade, setGrade] = useState(eng.grade || 5)
  const [exp, setExp] = useState(eng.experimental || '')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const imported = !!eng.modifiers
  // blueprints that apply to the fitted module's type
  const applicable = useMemo(() => {
    const target = BP_TYPE[module?.group_name] ?? module?.group_name
    if (!target) return []
    return (blueprints || []).filter(b => (b.applies_to || []).includes(target))
  }, [blueprints, module])
  const list = useMemo(() => {
    const pool = (showAll || applicable.length === 0) ? (blueprints || []) : applicable
    const s = q.trim().toLowerCase()
    return pool.filter(b => !s || (b.name || '').toLowerCase().includes(s)).slice(0, 60)
  }, [blueprints, applicable, showAll, q])
  const selected = blueprints?.find(b => b.id === bp)
  // grades this blueprint actually has (many are single-grade)
  const availGrades = useMemo(() => (
    selected ? Object.keys(selected.grades || {}).map(Number).sort((a, b) => a - b) : [1, 2, 3, 4, 5]
  ), [selected])
  // attribute → {grade: effect} across all grades, so every number is visible up front
  const effectRows = useMemo(() => {
    if (!selected) return []
    const rows = new Map()
    for (const g of availGrades) {
      for (const e of (selected.grades?.[String(g)]?.effects || [])) {
        if (!rows.has(e.attribute)) rows.set(e.attribute, {})
        rows.get(e.attribute)[g] = e
      }
    }
    return [...rows.entries()]
  }, [selected, availGrades])
  const pickBlueprint = (b) => {
    setBp(b.id)
    const gs = Object.keys(b.grades || {}).map(Number)
    if (gs.length && !gs.includes(grade)) setGrade(Math.max(...gs))
  }
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
      {applicable.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <button onClick={() => setShowAll(false)}
            className={`badge border px-2 py-1 ${!showAll ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted'}`}>
            {module?.group_name || 'This module'} ({applicable.length})
          </button>
          <button onClick={() => setShowAll(true)}
            className={`badge border px-2 py-1 ${showAll ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted'}`}>
            All blueprints
          </button>
        </div>
      )}
      {applicable.length === 0 && module && (
        <div className="text-[11px] text-ed-muted mb-2">
          No blueprints apply to {module.group_name} — this module can't be engineered (showing all).
        </div>
      )}
      <div className="overflow-y-auto flex-1 space-y-1 pr-1 min-h-0">
        <button onClick={() => setBp('')} className={`w-full text-left px-3 py-1.5 rounded border text-sm ${!bp ? 'border-ed-orange text-ed-orange' : 'border-ed-border text-ed-muted'}`}>
          — No blueprint —
        </button>
        {list.map(b => (
          <button key={b.id} onClick={() => pickBlueprint(b)}
            className={`w-full text-left px-3 py-1.5 rounded border text-sm ${bp === b.id ? 'border-ed-orange bg-ed-dark' : 'border-ed-border hover:border-ed-orange/50'}`}>
            <span className="text-ed-text">{b.name}</span>
            <span className="text-ed-muted text-[10px] ml-2">{(b.applies_to || []).join(', ')}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-ed-border/50 space-y-2">
        {selected && (effectRows.length ? (
          <>
            <div className="max-h-44 overflow-y-auto border border-ed-border/50 rounded">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-ed-muted">
                    <th className="text-left px-2 py-1 font-normal">Effect</th>
                    {availGrades.map(g => (
                      <th key={g} onClick={() => setGrade(g)}
                        className={`px-1.5 py-1 text-right font-normal cursor-pointer ${grade === g ? 'text-ed-orange' : 'hover:text-ed-text'}`}>G{g}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectRows.map(([attr, byGrade]) => (
                    <tr key={attr} className="border-t border-ed-border/30">
                      <td className="px-2 py-0.5 text-ed-muted">{attr}</td>
                      {availGrades.map(g => {
                        const e = byGrade[g]
                        return (
                          <td key={g} className={`px-1.5 py-0.5 text-right ${grade === g ? 'bg-ed-dark' : ''} ${e ? (e.positive ? 'text-green-400' : 'text-red-400') : 'text-ed-muted'}`}>
                            {e ? fmtPct(e.modifier) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-ed-muted">Max-roll values per grade · green helps, red hurts · click a G column to pick it</div>
          </>
        ) : (
          <div className="text-[11px] text-ed-muted">No stat numbers on file for this blueprint.</div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-ed-muted text-xs mr-1">Grade</span>
          {availGrades.map(g => (
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
  const [anchors, setAnchors] = useState({})       // {ship_id: {slotKey: [nx,ny,nz]}} hand-placed mounts
  const [placeSlot, setPlaceSlot] = useState(null) // slot key being placed on the hull (null = not placing)
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
      api()?.get_hardpoint_anchors?.().then(r => setAnchors(r || {}))
      loadSaved()
    }
    if (api()) load()
    else { window.addEventListener('pywebviewready', load, { once: true }); return () => window.removeEventListener('pywebviewready', load) }
  }, [loadSaved])

  const ship = useMemo(() => ships.find(s => s.id === build?.ship_id) || null, [ships, build])
  const slots = useMemo(() => shipSlots(ship), [ship])
  // slots that appear on the schematic and can be hand-placed
  const locatable = useMemo(() => slots.filter(s => s.family === 'hardpoint' || s.family === 'utility'), [slots])
  const shipAnchors = anchors[ship?.id] || null

  // leave placement mode when the ship changes
  useEffect(() => { setPlaceSlot(null) }, [build?.ship_id])

  function placeAnchor(slotKey, pos) {
    if (!ship) return
    api()?.save_hardpoint_anchor?.(ship.id, slotKey, pos)
    setAnchors(a => ({ ...a, [ship.id]: { ...(a[ship.id] || {}), [slotKey]: pos } }))
    const idx = locatable.findIndex(s => s.key === slotKey)
    setPlaceSlot(locatable[idx + 1]?.key ?? null)  // auto-advance; exit after last
  }

  function clearAnchor(slotKey) {
    if (!ship) return
    api()?.save_hardpoint_anchor?.(ship.id, slotKey, null)
    setAnchors(a => {
      const shipA = { ...(a[ship.id] || {}) }
      delete shipA[slotKey]
      return { ...a, [ship.id]: shipA }
    })
  }

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
      setSlot(slot.key, {
        symbol: mod.symbol, engineering: existing?.engineering || null,
        priority: existing?.priority || 1, enabled: existing?.enabled !== false,
      })
    }
    setDrawer(null)
  }

  function patchSlot(key, patch) {
    setBuild(b => {
      const cur = b.slots?.[key]; if (!cur) return b
      return { ...b, slots: { ...b.slots, [key]: { ...cur, ...patch } } }
    })
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

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] xl:grid-cols-[240px_1fr_300px] lg:grid-rows-[minmax(0,1fr)] gap-4 flex-1 min-h-0">
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
          <div className="overflow-y-auto flex-1 space-y-1 pr-1 max-h-48 lg:max-h-none">
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
            <div className="panel h-full min-h-[160px] flex items-center justify-center text-ed-muted text-sm">
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
                {ship && (() => {
                  const placingSlot = locatable.find(s => s.key === placeSlot)
                  const placeIdx = locatable.findIndex(s => s.key === placeSlot)
                  const placedCount = locatable.filter(s => shipAnchors?.[s.key]).length
                  return (
                  <div className="panel p-2 bg-gradient-to-b from-ed-panel to-ed-dark">
                    {/* height-driven (not width-driven) so a wide window can't balloon the
                        schematic and squeeze the module list below out of view */}
                    <div className="w-full flex justify-center" style={{ height: 'clamp(140px, 26vh, 250px)' }}>
                      <div className="h-full max-w-full" style={{ aspectRatio: '340 / 240' }}>
                        <ShipView ship={ship}
                          activeKey={placeSlot || drawer?.slotKey || hoverSlot}
                          onSelectMount={key => setDrawer({ slotKey: key, mode: 'module' })}
                          anchors={shipAnchors} placing={placeSlot} onPlace={placeAnchor} />
                      </div>
                    </div>
                    {placingSlot ? (
                      <div className="flex items-center justify-center gap-2 mt-1 text-[10px] font-mono">
                        <span className="text-ed-orange">
                          {placingSlot.label} {placeIdx + 1}/{locatable.length}
                          {shipAnchors?.[placeSlot] ? ' ✓' : ''}
                        </span>
                        <span className="text-ed-muted">rotate, then click the hull</span>
                        <button className="badge border border-ed-border text-ed-muted hover:text-ed-text px-1.5"
                          disabled={placeIdx <= 0}
                          onClick={() => setPlaceSlot(locatable[placeIdx - 1]?.key)}>←</button>
                        <button className="badge border border-ed-border text-ed-muted hover:text-ed-text px-1.5"
                          disabled={placeIdx >= locatable.length - 1}
                          onClick={() => setPlaceSlot(locatable[placeIdx + 1]?.key)}>→</button>
                        {shipAnchors?.[placeSlot] && (
                          <button className="badge border border-ed-border text-ed-muted hover:text-ed-danger px-1.5"
                            onClick={() => clearAnchor(placeSlot)}>reset</button>
                        )}
                        <button className="badge border border-ed-orange/60 text-ed-orange px-1.5"
                          onClick={() => setPlaceSlot(null)}>done</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 mt-0.5">
                        <span className="text-center text-[10px] font-mono text-ed-muted">
                          {hasModel(ship.id)
                            ? 'drag to rotate · scroll to zoom · hover a hardpoint below to locate it'
                            : 'hover a hardpoint below to locate it · click a marker to fit that slot'}
                        </span>
                        {hasModel(ship.id) && locatable.length > 0 && (
                          <button className="badge border border-ed-border text-ed-muted hover:text-ed-orange px-1.5 text-[10px] shrink-0"
                            title="Click each mount's real position on the hull — placed markers show solid, guesses faint"
                            onClick={() => setPlaceSlot((locatable.find(s => !shipAnchors?.[s.key]) || locatable[0]).key)}>
                            📍 Place mounts{placedCount ? ` ${placedCount}/${locatable.length}` : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })()}
              </div>

              <div className="overflow-y-auto pr-1 min-h-0 space-y-3">
              {/* bulkheads — armour grade slot */}
              {(ship?.bulkheads?.length > 0) && (() => {
                const bhI = build.bulkhead_index ?? 0
                const bh = ship.bulkheads[bhI] || ship.bulkheads[0]
                const bhEng = build.bulkhead_engineering
                return (
                  <section className="panel">
                    <h3 className="text-ed-text font-ui font-semibold text-sm mb-2">Bulkheads</h3>
                    <div className="flex items-center gap-2 py-1.5 rounded px-1 -mx-1">
                      <span className="badge border border-ed-border text-ed-muted shrink-0 w-8 text-center font-mono">BH</span>
                      <button onClick={() => setDrawer({ slotKey: 'bulkhead', mode: 'module' })}
                        className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-ed-text text-sm truncate">{bh.name}</span>
                          <span className="badge border border-ed-border text-ed-orange shrink-0 font-mono">
                            {Math.round((ship.armour || 0) * (1 + (bh.hullboost || 0)))}
                          </span>
                        </div>
                      </button>
                      <button onClick={() => setDrawer({ slotKey: 'bulkhead', mode: 'engineer' })}
                        className={`badge border shrink-0 ${bhEng ? 'border-ed-orange/60 text-ed-orange' : 'border-ed-border text-ed-muted hover:text-ed-text'}`}
                        title="Engineering">
                        {bhEng ? `🔧 ${bhEng.blueprint ? '' : 'G'}${bhEng.grade ?? ''}${bhEng.modifiers && !bhEng.blueprint ? ' ✓' : ''}` : '🔧'}
                      </button>
                    </div>
                  </section>
                )
              })()}
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
                        const hi = (placeSlot || drawer?.slotKey || hoverSlot) === slot.key && locatable
                        return (
                          <div key={slot.key}
                            onMouseEnter={() => locatable && setHoverSlot(slot.key)}
                            onMouseLeave={() => setHoverSlot(h => (h === slot.key ? null : h))}
                            className={`flex items-center gap-2 border-b border-ed-border/40 py-1.5 rounded px-1 -mx-1 ${hi ? 'bg-ed-orange/10' : ''}`}>
                            <span className="badge border border-ed-border text-ed-muted shrink-0 w-8 text-center font-mono">
                              {slot.size || 'U'}
                            </span>
                            <button onClick={() => (placeSlot && locatable)
                                ? setPlaceSlot(slot.key)  // placement mode: arm this slot instead
                                : setDrawer({ slotKey: slot.key, mode: 'module' })}
                              className="flex-1 text-left min-w-0">
                              {mod ? (
                                <div className={`flex items-center gap-2 ${fitted.enabled === false ? 'opacity-40' : ''}`}>
                                  <span className="text-ed-text text-sm truncate">{mod.display || mod.group_name}</span>
                                  <span className="badge border border-ed-border text-ed-orange shrink-0 font-mono">{mod.class}{mod.rating}</span>
                                </div>
                              ) : fitted ? (
                                <span className="text-ed-muted text-sm italic">unknown module</span>
                              ) : (
                                <span className="text-ed-muted text-sm">— {slot.label} —</span>
                              )}
                            </button>
                            {fitted && mod && (mod.power || 0) > 0 && (
                              <>
                                <button
                                  onClick={() => patchSlot(slot.key, { priority: ((fitted.priority || 1) % 5) + 1 })}
                                  className="badge border border-ed-border text-ed-muted hover:text-ed-text shrink-0 font-mono"
                                  title="Power priority (click to cycle)">
                                  P{fitted.priority || 1}
                                </button>
                                <button
                                  onClick={() => patchSlot(slot.key, { enabled: fitted.enabled === false })}
                                  className={`badge border shrink-0 ${fitted.enabled === false ? 'border-ed-border text-ed-muted' : 'border-ed-success/60 text-ed-success'}`}
                                  title={fitted.enabled === false ? 'Module OFF — click to enable' : 'Module ON — click to disable'}>
                                  ⏻
                                </button>
                              </>
                            )}
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
        <div className="overflow-y-auto min-h-0 max-h-[70vh] lg:max-h-none">
          {drawer?.slotKey === 'bulkhead' && ship ? (
            <div className="panel h-full">
              {drawer.mode === 'module'
                ? <BulkheadPicker ship={ship} current={build.bulkhead_index ?? 0}
                    onPick={i => { setBuild(b => ({ ...b, bulkhead_index: i })); setDrawer(null) }}
                    onClose={() => setDrawer(null)} />
                : <EngineerEditor slot={{ label: 'Bulkheads' }} module={{ group_name: 'Armour' }}
                    fitted={{ engineering: build.bulkhead_engineering }} blueprints={blueprints}
                    onSave={eng => { setBuild(b => ({ ...b, bulkhead_engineering: eng })); setDrawer(null) }}
                    onClose={() => setDrawer(null)} />}
            </div>
          ) : drawer && drawerSlot ? (
            <div className="panel h-full">
              {drawer.mode === 'module'
                ? <ModulePicker slot={drawerSlot} modules={modules}
                    onPick={m => pickModule(drawerSlot, m)} onClose={() => setDrawer(null)} />
                : <EngineerEditor slot={drawerSlot} fitted={build.slots?.[drawer.slotKey]}
                    module={moduleBySymbol(build.slots?.[drawer.slotKey]?.symbol)} blueprints={blueprints}
                    onSave={eng => saveEngineering(drawer.slotKey, eng)} onClose={() => setDrawer(null)} />}
            </div>
          ) : (
            <StatsPanel stats={stats} ship={ship} build={build} onBuild={setBuild} />
          )}
        </div>
      </div>
    </div>
  )
}
