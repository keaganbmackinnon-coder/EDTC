export default function Trading() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Trading</h1>
      <p className="text-ed-muted text-sm mb-6">Trade routes, commodity prices, and market alerts.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          'Trade Route Planner',
          'Commodity Price Finder (EDDN)',
          'Materials / Components Trading',
          'Station Search',
          'Commodity Market Alerts',
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
