import { useState } from 'react'

export default function FleetCarriers() {
  const [tosAccepted, setTosAccepted] = useState(false)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Fleet Carriers</h1>
      <p className="text-ed-muted text-sm mb-6">Stats, fuel, cargo, and route planning.</p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          'Carrier Stats Dashboard (journal data)',
          'Multi-Carrier / Multi-Account Management',
          'Tritium Calculator',
        ].map(f => (
          <div key={f} className="panel opacity-50 cursor-not-allowed">
            <p className="text-sm text-ed-muted font-mono">[Coming Soon]</p>
            <p className="text-ed-text mt-1">{f}</p>
          </div>
        ))}
      </div>

      {/* Auto-jump — ToS warning */}
      <div className="panel border-ed-danger">
        <div className="flex items-start gap-3">
          <span className="text-ed-danger text-xl mt-0.5">⚠</span>
          <div className="flex-1">
            <h2 className="text-ed-danger font-semibold mb-1">Auto-Jump / Autopilot — ToS Warning</h2>
            <p className="text-ed-text text-sm mb-3">
              This feature automates in-game actions that Frontier Developments may consider a violation
              of the <strong>Elite Dangerous Terms of Service</strong>. Using it could result in your
              account being banned. Use at your own risk.
            </p>
            {!tosAccepted ? (
              <button
                className="btn border border-ed-danger text-ed-danger hover:bg-ed-danger hover:text-black"
                onClick={() => setTosAccepted(true)}
              >
                I understand and accept the risk
              </button>
            ) : (
              <div className="panel opacity-50 cursor-not-allowed mt-3">
                <p className="text-sm text-ed-muted font-mono">[Coming Soon]</p>
                <p className="text-ed-text mt-1">Auto-Jump / Autopilot</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
