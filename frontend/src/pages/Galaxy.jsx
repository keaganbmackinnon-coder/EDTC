export default function Galaxy() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Galaxy & Factions</h1>
      <p className="text-ed-muted text-sm mb-6">GalNet, community goals, Powerplay, Thargoid War, and more.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          'GalNet News Feed',
          'Community Goals Tracker',
          'Powerplay Tracker',
          'Thargoid War Tracker',
          'Minor Factions Database',
          'Powers Database',
          'Rankings',
          'Galaxy Statistics',
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
