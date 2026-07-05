import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

// ---- Helpers ----

function progressPct(delivered, required) {
  if (!required) return 0
  return Math.min(100, Math.round(((delivered ?? 0) / required) * 100))
}

function aggregateShoppingList(projects) {
  const map = {}
  for (const p of projects) {
    if (!p.active) continue
    for (const r of (p.requirements ?? [])) {
      const key = r.commodity.toLowerCase()
      if (!map[key]) map[key] = { commodity: r.commodity, required: 0, delivered: 0 }
      map[key].required += r.required
      map[key].delivered += (r.delivered ?? 0)
    }
  }
  return Object.values(map)
    .map(r => ({ ...r, remaining: Math.max(0, r.required - r.delivered) }))
    .sort((a, b) => a.commodity.localeCompare(b.commodity))
}

// Market names arrive as symbols ('ceramiccomposites') and/or display names —
// normalize both sides to bare alphanumerics so either form matches
const normName = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function buildMarketLookup(stationMarket) {
  const map = {}
  for (const c of (stationMarket?.commodities ?? [])) {
    const entry = { stock: c.stock, buyPrice: c.buyPrice }
    map[normName(c.name)] = entry
    if (c.display) map[normName(c.display)] = entry
  }
  return map
}

// Commodity names buyable at the docked station render blue everywhere
const BUY_HERE_CLASS = 'text-blue-400 font-semibold'

function depotCommodityName(r) {
  return r.Name_Localised || r.Name.replace(/^\$/, '').replace(/_name;$/i, '').replace(/_/g, ' ')
}

function matchDepotName(depotResource, commodityName) {
  const localized = (depotResource.Name_Localised || '').toLowerCase()
  const fallback = depotResource.Name.replace(/^\$/, '').replace(/_name;$/i, '').replace(/_/g, ' ').toLowerCase()
  const target = commodityName.toLowerCase()
  return localized === target || fallback === target
}

function depotAgo(updated) {
  if (!updated) return ''
  const then = new Date(updated.replace(' ', 'T') + 'Z')
  const mins = Math.round((Date.now() - then.getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

function findMatchingProject(depot, projects) {
  // A project linked to this depot's market wins; unlinked projects fall back
  // to the system match. A project linked to a DIFFERENT depot in the same
  // system never matches (two sites in one system used to cross-sync).
  return projects.find(p => p.market_id && p.market_id === depot.market_id)
    ?? projects.find(p =>
      !p.market_id && p.system && depot.system &&
      p.system.toLowerCase() === depot.system.toLowerCase()
    )
}

async function importDepotAsProject(depot, setProjects) {
  const reqs = depot.resources.map(r => ({
    commodity: depotCommodityName(r),
    required: r.RequiredAmount,
    delivered: r.ProvidedAmount,
  }))
  const proj = await api()?.save_construction_project({
    name: depot.station || depot.system,
    system: depot.system,
    market_id: depot.market_id,
    requirements: reqs,
  })
  if (proj) setProjects(prev => [proj, ...prev.filter(p => p.id !== proj.id)])
  return proj
}

async function syncDepotToProject(depot, existing, setProjects) {
  const requirements = existing.requirements.map(r => {
    const match = depot.resources.find(d => matchDepotName(d, r.commodity))
    return match ? { ...r, delivered: match.ProvidedAmount } : r
  })
  const proj = await api()?.save_construction_project({
    ...existing,
    market_id: existing.market_id ?? depot.market_id,
    requirements,
  })
  if (proj) setProjects(prev => prev.map(p => p.id === proj.id ? proj : p))
  return proj
}

// Greedy largest-remaining-first fill of one cargo hold
function planNextLoad(list, capacity) {
  if (!capacity) return null
  const open = list.filter(r => r.remaining > 0).sort((a, b) => b.remaining - a.remaining)
  if (open.length === 0) return null
  const load = []
  let space = capacity
  for (const r of open) {
    if (space <= 0) break
    const take = Math.min(r.remaining, space)
    load.push({ commodity: r.commodity, amount: take })
    space -= take
  }
  return { load, tonnes: capacity - space }
}

function HaulPlanner({ list, shipInfo }) {
  const capacity = shipInfo?.cargo_capacity ?? 0
  const totalRemaining = list.reduce((s, r) => s + r.remaining, 0)
  if (!totalRemaining) return null
  const trips = capacity ? Math.ceil(totalRemaining / capacity) : null
  const plan = planNextLoad(list, capacity)
  return (
    <div className="panel mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-ed-muted text-xs font-mono uppercase tracking-wider">Haul Planner</p>
        <span className="text-xs font-mono text-ed-muted">
          {capacity
            ? `${shipInfo.ship ?? 'ship'} · ${capacity}T hold`
            : 'ship cargo capacity unknown — launch the game'}
        </span>
      </div>
      <p className="font-mono text-sm">
        <span className="text-ed-orange font-semibold text-xl">{totalRemaining.toLocaleString()}T</span>
        <span className="text-ed-muted ml-2">still to haul</span>
        {trips != null && (
          <span className="text-ed-text ml-3">
            ≈ <span className="font-semibold">{trips}</span> {trips === 1 ? 'trip' : 'trips'} in this ship
          </span>
        )}
      </p>
      {plan && (
        <p className="text-xs font-mono text-ed-muted mt-1.5">
          Next load ({plan.tonnes.toLocaleString()}T):{' '}
          {plan.load.map((l, i) => (
            <span key={l.commodity} className="text-ed-text">
              {i > 0 && <span className="text-ed-muted"> · </span>}
              {l.amount.toLocaleString()} {l.commodity}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

// ---- Shared UI ----

function Bar({ pct }) {
  return (
    <div className="h-1.5 bg-ed-dark rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${pct >= 100 ? 'bg-ed-success' : 'bg-ed-orange'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---- Depot Banner ----

function DepotBanner({ depot, projects, setProjects, onDismiss, onAction }) {
  const existing = findMatchingProject(depot, projects)
  const progressVal = Math.round((depot.progress ?? 0) * 100)

  return (
    <div className="mb-5 border border-ed-orange/40 rounded bg-ed-orange/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-ed-orange font-ui font-semibold text-sm">
            {depot.station || 'Construction Depot'} — {depot.system}
            <span className="text-ed-muted font-mono font-normal ml-2">{progressVal}% built</span>
            {depot.complete && <span className="text-ed-success font-mono font-normal ml-2">COMPLETE</span>}
          </div>
          <p className="text-ed-muted text-xs font-mono mt-0.5">
            {depot.resources.length} commodities ·{' '}
            {existing
              ? `matching project "${existing.name}" found`
              : 'no matching project — import to track progress'}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          {existing ? (
            <button className="btn-ghost text-xs"
              onClick={async () => { await syncDepotToProject(depot, existing, setProjects); onAction() }}>
              Sync Delivered
            </button>
          ) : (
            <button className="btn-primary text-xs"
              onClick={async () => { await importDepotAsProject(depot, setProjects); onAction() }}>
              Import as Project
            </button>
          )}
          <button className="text-ed-muted hover:text-ed-text text-sm px-1" onClick={onDismiss}>✕</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {depot.resources.map(r => {
          const name = depotCommodityName(r)
          const pct = r.RequiredAmount
            ? Math.min(100, Math.round((r.ProvidedAmount / r.RequiredAmount) * 100))
            : 0
          const done = r.ProvidedAmount >= r.RequiredAmount
          return (
            <div key={r.Name}>
              <div className="flex items-center justify-between text-xs font-mono mb-0.5">
                <span className={done ? 'text-ed-success' : 'text-ed-text'}>{name}</span>
                <span className="text-ed-muted ml-2 shrink-0">
                  {r.ProvidedAmount.toLocaleString()} / {r.RequiredAmount.toLocaleString()}
                </span>
              </div>
              <Bar pct={pct} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Tab: Projects ----

function ProjectsTab({ projects, setProjects }) {
  const [form, setForm] = useState({ name: '', system: '', requirements: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  function parseReqs(text) {
    return text.split('\n').map(line => {
      const [commodity, req] = line.split(':').map(s => s.trim())
      const required = parseInt(req, 10)
      if (!commodity || isNaN(required)) return null
      return { commodity, required, delivered: 0 }
    }).filter(Boolean)
  }

  async function save() {
    const reqs = parseReqs(form.requirements)
    if (!form.name || !reqs.length) return
    setSaving(true)
    const proj = await api()?.save_construction_project({
      name: form.name,
      system: form.system,
      requirements: reqs,
    })
    if (proj) {
      setProjects(prev => [proj, ...prev.filter(p => p.id !== proj.id)])
      setForm({ name: '', system: '', requirements: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function remove(id) {
    await api()?.delete_construction_project(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  async function toggleActive(proj) {
    const updated = await api()?.save_construction_project({ ...proj, active: proj.active ? 0 : 1 })
    if (updated) setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">Track commodity delivery progress for each colonisation build.</p>
        <button className="btn-ghost text-sm" onClick={() => setShowForm(f => !f)}>
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <div className="panel mb-4 space-y-2">
          <input
            className="input font-mono text-sm"
            placeholder="Project name (e.g. Coriolis Station)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input font-mono text-sm"
            placeholder="System name (optional — filters contributions to this system only)"
            value={form.system}
            onChange={e => setForm(f => ({ ...f, system: e.target.value }))}
          />
          <textarea
            className="input font-mono text-sm resize-none"
            placeholder={"Commodity: quantity (one per line)\ne.g.\nSteel: 6400\nAluminium: 3200\nPlastics: 2560"}
            rows={5}
            value={form.requirements}
            onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
          />
          <button
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={save}
            disabled={saving || !form.name}
          >
            {saving ? 'Saving…' : 'Add Project'}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-ed-muted text-sm font-mono mt-4">No construction projects yet. Click &quot;+ New Project&quot; to add one.</p>
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const reqs = p.requirements ?? []
            const totalRequired = reqs.reduce((s, r) => s + r.required, 0)
            const totalDelivered = reqs.reduce((s, r) => s + Math.min(r.delivered ?? 0, r.required), 0)
            const totalPct = totalRequired ? Math.round((totalDelivered / totalRequired) * 100) : 0
            const completedCount = reqs.filter(r => (r.delivered ?? 0) >= r.required).length

            return (
              <div key={p.id} className={`panel transition-opacity ${!p.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-ed-text font-semibold font-ui">{p.name}</span>
                    {p.system && (
                      <span className="text-ed-muted text-xs font-mono ml-2">{p.system}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                        p.active
                          ? 'border-ed-orange text-ed-orange hover:bg-ed-orange/10'
                          : 'border-ed-border text-ed-muted hover:border-ed-orange hover:text-ed-orange'
                      }`}
                      onClick={() => toggleActive(p)}
                      title={p.active ? 'Mark as done' : 'Reactivate'}
                    >
                      {p.active ? 'ACTIVE' : 'DONE'}
                    </button>
                    <button
                      className="text-ed-danger text-xs hover:underline"
                      onClick={() => remove(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Bar pct={totalPct} />
                  <span className="text-xs font-mono text-ed-muted shrink-0 w-28 text-right">
                    {totalPct}% &nbsp;({completedCount}/{reqs.length} done)
                  </span>
                </div>

                <div className="space-y-1.5">
                  {reqs.map(r => {
                    const pct = progressPct(r.delivered, r.required)
                    const done = (r.delivered ?? 0) >= r.required
                    return (
                      <div key={r.commodity}>
                        <div className="flex items-center justify-between text-xs font-mono mb-0.5">
                          <span className={done ? 'text-ed-success' : 'text-ed-text'}>{r.commodity}</span>
                          <span className="text-ed-muted">
                            {(r.delivered ?? 0).toLocaleString()} / {r.required.toLocaleString()}
                          </span>
                        </div>
                        <Bar pct={pct} />
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

// ---- Tab: Shopping List ----

function ShoppingListTab({ projects, fcCargo, shipInfo, stationMarket }) {
  const list = aggregateShoppingList(projects)
  const totalRemaining = list.reduce((s, r) => s + r.remaining, 0)

  const cargoMap = {}
  for (const c of fcCargo) {
    cargoMap[c.commodity.toLowerCase()] = c.count
  }
  const marketMap = buildMarketLookup(stationMarket)
  const showHereCol = !!stationMarket
  const withFc = list.map(r => ({
    ...r,
    afterFc: Math.max(0, r.remaining - (cargoMap[r.commodity.toLowerCase()] ?? 0)),
    here: marketMap[normName(r.commodity)] ?? null,
  }))
  const totalAfterFc = withFc.reduce((s, r) => s + r.afterFc, 0)
  const showFcCol = fcCargo.length > 0

  async function copyList() {
    const text = list
      .filter(r => r.remaining > 0)
      .map(r => `${r.commodity}: ${r.remaining}`)
      .join('\n')
    await api()?.copy_to_clipboard(text)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          Net remaining across all active projects. Delivered counts are summed and shared.
        </p>
        {list.some(r => r.remaining > 0) && (
          <button className="btn-ghost text-sm" onClick={copyList}>Copy Remaining</button>
        )}
      </div>

      {showHereCol && (
        <p className="text-sm font-mono mb-3">
          <span className="text-blue-400">◉ Docked at {stationMarket.station}</span>
          <span className="text-ed-muted ml-2">
            — blue commodities are sold at this station
            {stationMarket.source === 'cache' && ' (cached market data — open the commodities screen for live stock)'}
          </span>
        </p>
      )}

      <HaulPlanner list={list} shipInfo={shipInfo} />

      {list.length === 0 ? (
        <p className="text-ed-muted text-sm font-mono">No active projects or all requirements met.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                <th className="text-left pb-2 pr-4">Commodity</th>
                <th className="text-right pb-2 pr-4">Required</th>
                <th className="text-right pb-2 pr-4">Delivered</th>
                <th className="text-right pb-2 pr-4">Remaining</th>
                {showFcCol && <th className="text-right pb-2 pr-4">After FC Stock</th>}
                {showHereCol && <th className="text-right pb-2 pr-4">Sold Here</th>}
                <th className="pb-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {withFc.map(r => (
                <tr
                  key={r.commodity}
                  className={`border-b border-ed-border/40 ${r.remaining === 0 ? 'opacity-40' : ''}`}
                >
                  <td className={`py-1.5 pr-4 font-mono ${
                    r.here && r.remaining > 0 ? BUY_HERE_CLASS : 'text-ed-text'
                  }`}>
                    {r.commodity}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                    {r.required.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                    {r.delivered.toLocaleString()}
                  </td>
                  <td className={`py-1.5 pr-4 text-right font-mono font-semibold ${
                    r.remaining === 0 ? 'text-ed-success' : 'text-ed-orange'
                  }`}>
                    {r.remaining.toLocaleString()}
                  </td>
                  {showFcCol && (
                    <td className={`py-1.5 pr-4 text-right font-mono ${
                      r.afterFc === 0 ? 'text-ed-success' : 'text-ed-text'
                    }`}>
                      {r.remaining === 0 ? '—' : r.afterFc === 0 ? 'ON FC' : r.afterFc.toLocaleString()}
                    </td>
                  )}
                  {showHereCol && (
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {r.here ? (
                        <span className="text-blue-400">
                          {r.here.stock.toLocaleString()}
                          <span className="text-ed-muted"> @ {r.here.buyPrice.toLocaleString()} cr</span>
                        </span>
                      ) : (
                        <span className="text-ed-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-1.5">
                    <Bar pct={progressPct(r.delivered, r.required)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-ed-muted text-xs font-mono">
                <td className="pt-3 text-ed-muted" colSpan={3}>Total units still needed</td>
                <td className="pt-3 text-right font-semibold text-ed-orange">
                  {totalRemaining.toLocaleString()}
                </td>
                {showFcCol && (
                  <td className="pt-3 text-right font-semibold text-ed-text">
                    {totalAfterFc.toLocaleString()}
                  </td>
                )}
                {showHereCol && <td></td>}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Tab: FC Cargo ----

function FCCargoTab({ projects, fcCargo, setFcCargo }) {
  const [editText, setEditText] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const shoppingList = aggregateShoppingList(projects)

  const cargoMap = {}
  for (const c of fcCargo) {
    cargoMap[c.commodity.toLowerCase()] = c.count
  }

  function buildRows() {
    const keys = new Set([
      ...shoppingList.filter(r => r.remaining > 0).map(r => r.commodity.toLowerCase()),
      ...fcCargo.map(c => c.commodity.toLowerCase()),
    ])
    return [...keys].sort().map(key => {
      const shopItem = shoppingList.find(r => r.commodity.toLowerCase() === key)
      const cargoItem = fcCargo.find(c => c.commodity.toLowerCase() === key)
      const have = cargoMap[key] ?? 0
      const need = shopItem ? shopItem.remaining : 0
      const diff = have - need
      return {
        commodity: shopItem?.commodity ?? cargoItem?.commodity ?? key,
        need,
        have,
        diff,
      }
    })
  }

  const rows = buildRows()

  function startEdit() {
    const text = fcCargo.map(c => `${c.commodity}: ${c.count}`).join('\n')
    setEditText(text)
    setEditing(true)
  }

  async function saveEdit() {
    const items = editText.split('\n').map(line => {
      const [commodity, cnt] = line.split(':').map(s => s.trim())
      const count = parseInt(cnt, 10)
      if (!commodity || isNaN(count)) return null
      return { commodity: commodity.toLowerCase(), count }
    }).filter(Boolean)
    setSaving(true)
    const updated = await api()?.set_fc_cargo(items)
    if (updated !== undefined) setFcCargo(updated ?? [])
    setSaving(false)
    setEditing(false)
  }

  async function clearCargo() {
    await api()?.clear_fc_cargo()
    setFcCargo([])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-ed-muted text-sm">
          Compare Fleet Carrier cargo against open requirements.
          Auto-tracked from CargoTransfer journal events.
        </p>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={startEdit}>Edit Manually</button>
          {fcCargo.length > 0 && (
            <button
              className="btn-ghost text-sm"
              style={{ borderColor: 'rgb(204 51 51 / 0.5)', color: '#cc3333' }}
              onClick={clearCargo}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="panel mb-4">
          <p className="text-ed-muted text-xs mb-2">
            Enter current FC cargo (Commodity: quantity, one per line). Overwrites auto-tracked values.
          </p>
          <textarea
            className="input font-mono text-sm resize-none mb-2"
            rows={6}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder={"Steel: 2000\nAluminium: 1500\nPlastics: 800"}
          />
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-ed-muted text-sm font-mono">
          No data yet. Add a project and transfer cargo to your FC in-game, or use &quot;Edit Manually&quot; above.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                <th className="text-left pb-2 pr-4">Commodity</th>
                <th className="text-right pb-2 pr-4">Need</th>
                <th className="text-right pb-2 pr-4">FC Has</th>
                <th className="text-right pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.commodity} className="border-b border-ed-border/40">
                  <td className="py-1.5 pr-4 font-mono text-ed-text">{r.commodity}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                    {r.need.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                    {r.have.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs">
                    {r.diff === 0 && r.need === 0 ? (
                      <span className="text-ed-muted">extra</span>
                    ) : r.diff >= 0 ? (
                      <span className="text-ed-success">
                        {r.diff === 0 ? 'COVERED' : `+${r.diff.toLocaleString()}`}
                      </span>
                    ) : (
                      <span className="text-ed-danger">{r.diff.toLocaleString()}</span>
                    )}
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

// ---- Tab: Depot View (all known sites) ----

function DepotCard({ depot, fcCargo, projects, setProjects, shipInfo, stationMarket, onRemove, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const existing = findMatchingProject(depot, projects)
  const progressVal = Math.round((depot.progress ?? 0) * 100)
  const capacity = shipInfo?.cargo_capacity ?? 0
  const trips = capacity && depot.remaining ? Math.ceil(depot.remaining / capacity) : null

  const cargoMap = {}
  for (const c of fcCargo) {
    cargoMap[c.commodity.toLowerCase()] = c.count
  }
  const marketMap = buildMarketLookup(stationMarket)

  // Incomplete commodities first (largest gap first), completed at the bottom
  const sorted = [...depot.resources].sort((a, b) => {
    const remA = Math.max(0, a.RequiredAmount - a.ProvidedAmount)
    const remB = Math.max(0, b.RequiredAmount - b.ProvidedAmount)
    if ((remA === 0) !== (remB === 0)) return remA === 0 ? 1 : -1
    return remB - remA
  })

  return (
    <div className="panel">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left flex-1" onClick={() => setOpen(o => !o)}>
          <div className="text-ed-text font-ui font-semibold text-sm">
            <span className="text-ed-muted mr-1.5">{open ? '▾' : '▸'}</span>
            {depot.station || 'Construction Depot'}
            <span className="text-ed-muted font-mono font-normal text-xs ml-2">{depot.system}</span>
            {depot.complete ? (
              <span className="text-ed-success font-mono font-normal text-xs ml-2">COMPLETE</span>
            ) : (
              <span className="text-ed-orange font-mono font-normal text-xs ml-2">{progressVal}%</span>
            )}
          </div>
          <p className="text-ed-muted text-xs font-mono mt-0.5">
            updated {depotAgo(depot.updated)}
            {depot.remaining > 0 && ` · ${depot.remaining.toLocaleString()}T remaining`}
            {trips != null && ` · ~${trips} ${trips === 1 ? 'trip' : 'trips'}`}
            {depot.rate_per_hour && ` · your pace ${depot.rate_per_hour.toLocaleString()} T/h`}
            {depot.eta_hours && ` · ~${depot.eta_hours} h to finish`}
          </p>
        </button>
        <div className="flex gap-2 items-center shrink-0">
          {!depot.complete && (existing ? (
            <button className="btn-ghost text-xs"
              onClick={() => syncDepotToProject(depot, existing, setProjects)}>
              Sync Delivered
            </button>
          ) : (
            <button className="btn-primary text-xs"
              onClick={() => importDepotAsProject(depot, setProjects)}>
              Import as Project
            </button>
          ))}
          <button className="text-ed-danger text-xs hover:underline" onClick={onRemove}>Remove</button>
        </div>
      </div>

      <div className="mt-2">
        <Bar pct={progressVal} />
      </div>

      {open && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                <th className="text-left pb-2 pr-4">Commodity</th>
                <th className="text-right pb-2 pr-4">Required</th>
                <th className="text-right pb-2 pr-4">Delivered</th>
                <th className="text-right pb-2 pr-4">Still Needed</th>
                <th className="text-right pb-2 pr-4">FC Has</th>
                <th className="pb-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const name = depotCommodityName(r)
                const remaining = Math.max(0, r.RequiredAmount - r.ProvidedAmount)
                const fcHas = cargoMap[name.toLowerCase()] ?? 0
                const done = remaining === 0
                const pct = r.RequiredAmount
                  ? Math.min(100, Math.round((r.ProvidedAmount / r.RequiredAmount) * 100))
                  : 0
                return (
                  <tr key={r.Name} className={`border-b border-ed-border/40 ${done ? 'opacity-50' : ''}`}>
                    <td className={`py-1.5 pr-4 font-mono ${
                      !done && marketMap[normName(name)] ? BUY_HERE_CLASS : 'text-ed-text'
                    }`}>
                      {name}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                      {r.RequiredAmount.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                      {r.ProvidedAmount.toLocaleString()}
                    </td>
                    <td className={`py-1.5 pr-4 text-right font-mono font-semibold ${
                      done ? 'text-ed-success' : 'text-ed-orange'
                    }`}>
                      {remaining.toLocaleString()}
                    </td>
                    <td className={`py-1.5 pr-4 text-right font-mono ${
                      fcHas > 0
                        ? (fcHas >= remaining ? 'text-ed-success' : 'text-ed-text')
                        : 'text-ed-muted'
                    }`}>
                      {fcHas > 0 ? fcHas.toLocaleString() : '—'}
                    </td>
                    <td className="py-1.5">
                      <Bar pct={pct} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DepotTab({ depots, setDepots, fcCargo, projects, setProjects, shipInfo, stationMarket }) {
  if (depots.length === 0) {
    return (
      <p className="text-ed-muted text-sm font-mono">
        No depot data yet. Dock at a construction site in-game — the requirements are saved here automatically.
      </p>
    )
  }

  async function remove(marketId) {
    await api()?.delete_construction_depot(marketId)
    setDepots(prev => prev.filter(d => d.market_id !== marketId))
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">
        Every construction site you dock at, saved with its latest progress. Data refreshes while you're docked.
      </p>
      <div className="space-y-3">
        {depots.map((d, i) => (
          <DepotCard
            key={d.market_id}
            depot={d}
            fcCargo={fcCargo}
            projects={projects}
            setProjects={setProjects}
            shipInfo={shipInfo}
            stationMarket={stationMarket}
            onRemove={() => remove(d.market_id)}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  )
}

// ---- Tab: Market Finder ----

function MarketFinderTab({ projects }) {
  const [system, setSystem] = useState('')
  const [commodity, setCommodity] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api()?.get_current_system?.().then(s => {
      if (s) setSystem(prev => prev || s)
    })
  }, [])

  const shoppingList = aggregateShoppingList(projects).filter(r => r.remaining > 0)

  async function search() {
    if (!system.trim() || !commodity.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await api()?.search_commodity_markets(system.trim(), commodity.trim())
      setResults(data ?? [])
    } catch {
      setError('Search failed. Check the system name and try again.')
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter') search()
  }

  return (
    <div>
      <p className="text-ed-muted text-sm mb-4">Find nearest stations with stock via Spansh. Results sorted by distance.</p>

      <div className="panel mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            className="input font-mono text-sm flex-1"
            placeholder="Current system (e.g. Sol)"
            value={system}
            onChange={e => setSystem(e.target.value)}
            onKeyDown={handleKey}
          />
          <div className="relative flex-1">
            <input
              className="input font-mono text-sm"
              placeholder="Commodity (e.g. Steel)"
              value={commodity}
              onChange={e => setCommodity(e.target.value)}
              list="market-commodity-options"
              onKeyDown={handleKey}
            />
            <datalist id="market-commodity-options">
              {shoppingList.map(r => (
                <option key={r.commodity} value={r.commodity} />
              ))}
            </datalist>
          </div>
          <button
            className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={search}
            disabled={loading || !system.trim() || !commodity.trim()}
          >
            {loading ? 'Searching…' : 'Find'}
          </button>
        </div>
        {shoppingList.length > 0 && (
          <p className="text-ed-muted text-xs font-mono">
            Quick select: {shoppingList.map(r => (
              <button
                key={r.commodity}
                className="text-ed-orange hover:underline mr-2"
                onClick={() => setCommodity(r.commodity)}
              >
                {r.commodity}
              </button>
            ))}
          </p>
        )}
      </div>

      {error && <p className="text-ed-danger text-sm font-mono mb-3">{error}</p>}

      {results !== null && (
        results.length === 0 ? (
          <p className="text-ed-muted text-sm font-mono">No stations found with &quot;{commodity}&quot; in stock.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ed-muted text-xs font-mono border-b border-ed-border">
                  <th className="text-left pb-2 pr-4">Station</th>
                  <th className="text-left pb-2 pr-4">System</th>
                  <th className="text-right pb-2 pr-4">Arrival</th>
                  <th className="text-right pb-2 pr-4">Supply</th>
                  <th className="text-right pb-2">Buy Price</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-ed-border/40">
                    <td className="py-1.5 pr-4 font-mono text-ed-text">
                      <span>{r.station ?? '—'}</span>
                      {r.source === 'inara' && (
                        <span className="ml-1 text-xs font-mono text-blue-400 border border-blue-400/30 rounded px-1">Inara</span>
                      )}
                      {r.has_large_pad && (
                        <span className="ml-1 text-xs text-ed-muted font-mono">L</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-ed-muted">
                      <span>{r.system ?? '—'}</span>
                      {r.distance != null && (
                        <span className="text-xs ml-1">{r.distance} ly</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                      {r.distance_to_arrival != null
                        ? `${Math.round(r.distance_to_arrival).toLocaleString()} ls`
                        : '—'}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-ed-muted">
                      {r.supply != null ? r.supply.toLocaleString() : '—'}
                    </td>
                    <td className="py-1.5 text-right font-mono text-ed-muted">
                      {r.buy_price ? `${r.buy_price.toLocaleString()} Cr` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

// ---- Main ----

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'shopping', label: 'Shopping List' },
  { id: 'fc_cargo', label: 'FC Cargo' },
  { id: 'depot',    label: 'Depot View' },
  { id: 'market',   label: 'Market Finder' },
]

export default function Colonisation() {
  const [tab, setTab] = useState('projects')
  const [projects, setProjects] = useState([])
  const [fcCargo, setFcCargo] = useState([])
  const [depots, setDepots] = useState([])
  const [shipInfo, setShipInfo] = useState(null)
  const [stationMarket, setStationMarket] = useState(null)
  const [bannerId, setBannerId] = useState(null)      // market_id the banner shows
  const [dismissedId, setDismissedId] = useState(null)

  useEffect(() => {
    api()?.get_construction_projects(false).then(r => setProjects(r ?? []))
    api()?.get_fc_cargo().then(r => setFcCargo(r ?? []))
    api()?.get_ship_info?.().then(r => setShipInfo(r ?? null))
    api()?.get_station_market?.().then(r => setStationMarket(r ?? null))
    // Depots are persisted — docking events are no longer missed when this
    // page isn't open. Surface the banner for a freshly-visited site.
    api()?.get_construction_depots?.().then(r => {
      const list = r ?? []
      setDepots(list)
      const latest = list[0]
      if (latest && !latest.complete) {
        const mins = (Date.now() - new Date(latest.updated.replace(' ', 'T') + 'Z').getTime()) / 60000
        if (mins < 15) setBannerId(latest.market_id)
      }
    })
  }, [])

  useEffect(() => {
    const off1 = window.__edtc?.on('construction_update', proj => {
      if (!proj) return
      setProjects(prev => {
        const idx = prev.findIndex(p => p.id === proj.id)
        if (idx === -1) return [proj, ...prev]
        const next = [...prev]
        next[idx] = proj
        return next
      })
    })
    const off2 = window.__edtc?.on('fc_cargo_update', payload => {
      setFcCargo(payload?.cargo ?? [])
    })
    const off3 = window.__edtc?.on('construction_depot', payload => {
      if (!payload?.market_id) return
      setDepots(prev => [payload, ...prev.filter(d => d.market_id !== payload.market_id)])
      setBannerId(payload.market_id)
    })
    const off4 = window.__edtc?.on('ship_changed', payload => {
      if (payload) setShipInfo(payload)
    })
    const off5 = window.__edtc?.on('station_market_update', payload => {
      setStationMarket(payload ?? null)
    })
    return () => { off1?.(); off2?.(); off3?.(); off4?.(); off5?.() }
  }, [])

  const bannerDepot = bannerId !== dismissedId
    ? depots.find(d => d.market_id === bannerId)
    : null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Colonisation</h1>
      <p className="text-ed-muted text-sm mb-5">System planning, build tracking, and logistics.</p>

      {bannerDepot && (
        <DepotBanner
          depot={bannerDepot}
          projects={projects}
          setProjects={setProjects}
          onDismiss={() => setDismissedId(bannerId)}
          onAction={() => { setDismissedId(bannerId); setTab('projects') }}
        />
      )}

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

      {tab === 'projects' && (
        <ProjectsTab projects={projects} setProjects={setProjects} />
      )}
      {tab === 'shopping' && (
        <ShoppingListTab projects={projects} fcCargo={fcCargo} shipInfo={shipInfo}
          stationMarket={stationMarket} />
      )}
      {tab === 'fc_cargo' && (
        <FCCargoTab projects={projects} fcCargo={fcCargo} setFcCargo={setFcCargo} />
      )}
      {tab === 'depot' && (
        <DepotTab depots={depots} setDepots={setDepots} fcCargo={fcCargo}
          projects={projects} setProjects={setProjects} shipInfo={shipInfo}
          stationMarket={stationMarket} />
      )}
      {tab === 'market' && (
        <MarketFinderTab projects={projects} />
      )}
    </div>
  )
}
