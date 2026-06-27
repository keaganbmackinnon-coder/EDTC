export default function Exploration() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Exploration</h1>
      <p className="text-ed-muted text-sm mb-6">Exobiology, body scanning, codex, and journey tracking.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          'Celestial Body Search',
          'Star System Search',
          'Exobiology / Organic Tracker',
          'Exobiology Species Imagery & Predictions',
          'Road to Riches Body Rewards',
          'Codex Bingo / Canonn Challenge Tracker',
          'Journey Tracker with Screenshots',
        ].map(f => (
          <div key={f} className="panel opacity-50 cursor-not-allowed">
            <p className="text-sm text-ed-muted font-mono">[Coming Soon]</p>
            <p className="text-ed-text mt-1">{f}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
