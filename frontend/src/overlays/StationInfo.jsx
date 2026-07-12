import { useEffect, useState } from 'react'

export default function StationInfo() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const off = window.__edtc?.on('station_info', (payload) => {
      // Spansh enrichment can land after the journal Docked payload — never
      // let the approach card overwrite richer docked data for the same station
      setInfo(prev => {
        if (prev && prev.station === payload.station
            && prev.services?.length && !payload.services?.length) return prev
        return payload
      })
    })
    const offJump = window.__edtc?.on('system_changed', () => setInfo(null))
    return () => { off(); offJump() }
  }, [])

  if (!info) {
    return (
      <div className="w-full flex items-start justify-center pt-2 select-none">
        <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-2 shadow-2xl w-[296px]">
          <p className="text-ed-muted text-xs font-mono">Awaiting docking…</p>
        </div>
      </div>
    )
  }

  const pads = info.pads
  const padLabel = pads?.large ? 'Large' : pads?.medium ? 'Medium' : pads?.small ? 'Small' : null

  return (
    <div className="w-full flex items-start justify-center pt-2 select-none">
      <div id="overlay-panel" className="bg-ed-panel/95 border-y-2 border-ed-orange/70 px-3 py-2 shadow-2xl w-[296px] font-mono">

        <p className="text-ed-text text-base font-ui font-semibold truncate">{info.station}</p>
        {info.type && <p className="text-ed-success text-xs">{info.type}</p>}
        <p className="text-ed-muted text-xs">
          {info.pad != null && <>Pad: <span className="text-ed-text">{info.pad}</span></>}
          {info.pad != null && padLabel && ' · '}
          {padLabel && <>Pads: <span className="text-ed-success">{padLabel} ✓</span></>}
        </p>

        {info.economies?.length > 0 && (
          <div className="mt-1.5">
            <p className="text-ed-muted text-[11px]">Economy:</p>
            {info.economies.map(e => (
              <p key={e.name} className="pl-2 text-xs">
                <span className="text-ed-orange">{e.name}:</span>{' '}
                <span className="text-ed-success">{e.share}%</span>
              </p>
            ))}
          </div>
        )}

        {info.faction?.name && (
          <div className="mt-1.5">
            <p className="text-ed-muted text-[11px]">Faction:</p>
            <p className="pl-2 text-ed-orange text-sm truncate">{info.faction.name}</p>
            <p className="pl-2 text-[11px]">
              {info.faction.influence != null && (
                <><span className="text-ed-muted">Inf: </span>
                  <span className="text-ed-success">{info.faction.influence}%</span></>
              )}
              {info.faction.reputation && (
                <><span className="text-ed-muted"> | Rep: </span>
                  <span className="text-ed-success">{info.faction.reputation}</span></>
              )}
            </p>
          </div>
        )}

        {info.services?.length > 0 && (
          <div className="mt-1.5">
            <p className="text-ed-muted text-[11px]">Relevant services:</p>
            {info.services.map(s => (
              <p key={s} className="pl-2 text-ed-orange text-xs">- {s}</p>
            ))}
          </div>
        )}

        <p className="text-ed-muted/70 text-[10px] mt-1.5 border-t border-ed-border pt-1">
          Data: {info.source === 'spansh' ? 'Spansh.co.uk' : 'journal'}
          {info.updated && ` · Updated: ${info.updated}`}
          {info.dist_ls != null && ` · ${Math.round(info.dist_ls).toLocaleString()} ls`}
        </p>
      </div>
    </div>
  )
}
