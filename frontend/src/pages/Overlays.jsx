import { useState, useEffect } from 'react'

const api = () => window?.pywebview?.api

const OVERLAYS = [
  { id: 'cmdr_ping',     label: 'CMDR Proximity Ping',      badge: 'Live', desc: 'Audio beep + popup when another CMDR appears. Watchlist mode for specific targets.' },
  { id: 'route',         label: 'Route Following',           badge: 'Live', desc: 'Current waypoint, next jump, trip progress. Ctrl+Shift+C copies next system.' },
  { id: 'fss',           label: 'FSS Body Values',           badge: 'Live', desc: 'Real scan + DSS values per body, undiscovered flags, bio genus counts, system completion.' },
  { id: 'system_preview',label: 'System Preview on Jump',    badge: 'Live', desc: 'Star class, body count, economy and security shown on every FSD jump.' },
  { id: 'exo_tracker',   label: 'Exobiology Tracker',        badge: 'Live', desc: 'Bio signals, species predictions/values, sampling progress with FF bonus, and a sample-distance radar.' },
  { id: 'construction',  label: 'Construction Materials',    badge: 'Live', desc: 'Live delivery progress for active colonisation construction projects.' },
  { id: 'mining',        label: 'Mining Session',            badge: 'Live', desc: 'Refined tonnage, tons/hr, last prospector result and Powerplay merits while mining.' },
  { id: 'station_info',  label: 'Station Info on Docking',   badge: 'Live', desc: 'Station type, pads, economy shares, faction influence/rep and services when docking is granted.' },
  { id: 'bio_signals',   label: 'Bio Signals System Panel',  badge: 'Live', desc: 'System-wide biological rollup: per-body genus chips and predicted values with a rewards total.' },
]

// --- Watchlist section ---
function WatchlistManager() {
  const [list, setList] = useState([])
  const [input, setInput] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    api()?.get_watchlist().then(r => setList(r ?? []))
  }, [])

  async function add() {
    if (!input.trim()) return
    const entry = await api()?.add_to_watchlist(input.trim(), note.trim())
    if (entry) {
      setList(prev => [...prev.filter(x => x.cmdr !== entry.cmdr), entry].sort((a, b) => a.cmdr.localeCompare(b.cmdr)))
      setInput('')
      setNote('')
    }
  }

  async function remove(cmdr) {
    await api()?.remove_from_watchlist(cmdr)
    setList(prev => prev.filter(x => x.cmdr !== cmdr))
  }

  return (
    <div className="panel mt-6">
      <h2 className="text-ed-text font-semibold mb-1">CMDR Watchlist</h2>
      <p className="text-ed-muted text-xs mb-3">
        When empty, all CMDRs trigger a ping. Add names to only ping for listed CMDRs.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="CMDR name"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-36 bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
        />
        <button onClick={add} className="btn-primary shrink-0">Add</button>
      </div>
      {list.length === 0 ? (
        <p className="text-ed-muted text-xs font-mono">No CMDRs on watchlist</p>
      ) : (
        <div className="space-y-1">
          {list.map(entry => (
            <div key={entry.cmdr} className="flex items-center gap-3 text-sm font-mono">
              <span className="text-ed-orange flex-1">{entry.cmdr}</span>
              {entry.note && <span className="text-ed-muted text-xs truncate max-w-[180px]">{entry.note}</span>}
              <button
                onClick={() => remove(entry.cmdr)}
                className="text-ed-danger text-xs hover:underline shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Construction project manager ---
function ConstructionManager() {
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({ name: '', system: '', requirements: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api()?.get_construction_projects(false).then(r => setProjects(r ?? []))
  }, [])

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
    if (!form.name || reqs.length === 0) return
    setSaving(true)
    const proj = await api()?.save_construction_project({
      name: form.name,
      system: form.system,
      requirements: reqs,
    })
    if (proj) {
      setProjects(prev => [proj, ...prev.filter(p => p.id !== proj.id)])
      setForm({ name: '', system: '', requirements: '' })
    }
    setSaving(false)
  }

  async function remove(id) {
    await api()?.delete_construction_project(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="panel mt-6">
      <h2 className="text-ed-text font-semibold mb-1">Construction Projects</h2>
      <p className="text-ed-muted text-xs mb-3">
        Add a building's commodity requirements. Contributions are auto-tracked from journal events.
      </p>

      <div className="space-y-2 mb-3">
        <input
          type="text"
          placeholder="Project name (e.g. Coriolis Station)"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
        />
        <input
          type="text"
          placeholder="System name (optional, filters contributions)"
          value={form.system}
          onChange={e => setForm(f => ({ ...f, system: e.target.value }))}
          className="w-full bg-ed-dark border border-ed-border rounded px-3 py-1.5 text-ed-text text-sm font-mono focus:outline-none focus:border-ed-orange/60"
        />
        <textarea
          placeholder={'Commodity: quantity (one per line)\ne.g.\nSteel: 6400\nAluminium: 3200'}
          value={form.requirements}
          onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
          rows={4}
          className="w-full bg-ed-dark border border-ed-border rounded px-3 py-2 text-ed-text text-sm font-mono resize-none focus:outline-none focus:border-ed-orange/60"
        />
      </div>
      <button
        onClick={save}
        disabled={saving || !form.name}
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Add Project'}
      </button>

      {projects.length > 0 && (
        <div className="mt-4 space-y-3">
          {projects.map(p => {
            const reqs = p.requirements ?? []
            const done = reqs.filter(r => (r.delivered ?? 0) >= r.required).length
            return (
              <div key={p.id} className={`rounded border p-3 ${p.active ? 'border-ed-orange/40' : 'border-ed-border opacity-60'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-ed-text text-sm font-semibold">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.active && <span className="text-[10px] font-mono text-ed-orange">ACTIVE</span>}
                    <button onClick={() => remove(p.id)} className="text-ed-danger text-xs hover:underline">Remove</button>
                  </div>
                </div>
                {p.system && <p className="text-ed-muted text-xs font-mono">{p.system}</p>}
                <p className="text-ed-muted text-xs font-mono mt-1">
                  {done}/{reqs.length} commodities complete
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Main Overlays page ---
export default function OverlaysPage() {
  const [states, setStates] = useState({})

  useEffect(() => {
    api()?.get_overlay_states().then(r => setStates(r ?? {}))
  }, [])

  function toggle(id) {
    api()?.toggle_overlay(id)
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], auto_enabled: !prev[id]?.auto_enabled },
    }))
  }

  function setOpacity(id, value) {
    const v = parseFloat(value)
    api()?.set_overlay_opacity(id, v)
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], opacity: v },
    }))
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Live In-Game Overlays</h1>
      <p className="text-ed-muted text-sm mb-6">
        Transparent always-on-top windows that sit over Elite Dangerous.
        Toggle each overlay and adjust its opacity with the controls below.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {OVERLAYS.map(({ id, label, badge, desc }) => {
          const enabled = states[id]?.auto_enabled ?? false
          const opacity = states[id]?.opacity ?? 1.0
          return (
            <div key={id} className="panel">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-ed-text font-semibold">{label}</span>
                    <span className="badge bg-ed-orange text-black">{badge}</span>
                    {enabled && <span className="text-xs font-mono text-ed-success">● ON</span>}
                  </div>
                  <p className="text-ed-muted text-sm">{desc}</p>
                </div>
                <button
                  className={`btn-ghost shrink-0 ${enabled ? 'border-ed-success/50 text-ed-success' : ''}`}
                  onClick={() => toggle(id)}
                >
                  {enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-ed-border/40">
                <span className="text-ed-muted text-xs font-mono w-16 shrink-0">Opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={e => setOpacity(id, e.target.value)}
                  className="flex-1 accent-ed-orange"
                />
                <span className="text-ed-muted text-xs font-mono w-10 text-right shrink-0">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <WatchlistManager />
      <ConstructionManager />
    </div>
  )
}
