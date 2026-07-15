import { useEffect, useRef, useState } from 'react'

export default function CmdrPing() {
  const [ping, setPing] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const off = window.__edtc?.on('cmdr_detected', (payload) => {
      setPing(payload)
      // the window stays on screen — the ping card clears itself back to
      // the idle state after a few seconds (a fresh ping restarts the timer)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setPing(null), 8000)
    })
    return () => { off?.(); clearTimeout(timerRef.current) }
  }, [])

  if (!ping) {
    return (
      <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
        <div className="bg-ed-panel/95 border border-ed-border/70 rounded-lg px-4 py-3 shadow-2xl backdrop-blur-sm min-w-[280px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ed-muted/60 shrink-0" />
            <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">
              Listening for CMDRs…
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex items-start justify-center pt-3 select-none">
      <div className="bg-ed-panel/95 border border-ed-orange/70 rounded-lg px-4 py-3 shadow-2xl backdrop-blur-sm min-w-[280px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-ed-danger animate-pulse shrink-0" />
          <span className="text-ed-muted text-xs font-mono uppercase tracking-widest">CMDR Detected</span>
          {ping.on_watchlist && (
            <span className="ml-auto text-[10px] font-mono bg-ed-danger/20 text-ed-danger px-1.5 py-0.5 rounded">
              WATCHLIST
            </span>
          )}
        </div>
        <p className="text-ed-orange font-mono text-lg font-bold leading-tight">
          CMDR {ping.cmdr}
        </p>
        {ping.ship && (
          <p className="text-ed-text text-sm mt-0.5">{ping.ship}</p>
        )}
      </div>
    </div>
  )
}
