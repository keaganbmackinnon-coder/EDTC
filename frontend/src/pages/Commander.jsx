export default function Commander() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Commander & Social</h1>
      <p className="text-ed-muted text-sm mb-6">Commander lookup, squadrons, logbooks, and screenshots.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          'Commander Lookup (EDSM)',
          'Squadron Management',
          'Logbooks / Commander Stories',
          'Discussion Boards',
          'Screenshot Gallery',
          'Shareable Build Links',
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
