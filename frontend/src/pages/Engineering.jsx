export default function Engineering() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-ui font-semibold text-ed-orange mb-1">Engineering & Outfitting</h1>
      <p className="text-ed-muted text-sm mb-6">Ship builds, blueprints, materials, and theory-crafting.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          'Engineers Database & Blueprints',
          'Experimental Effects Guide',
          'Synthesis Guide',
          'Material Traders Finder',
          'Ship Database & Outfitting Search',
          'Technology Broker',
          'Ship Build Tool (Theory-Crafter)',
          'Pip & Power Distributor Modelling',
          'Thermal Load & Heat Dissipation',
          'Engineering Grade & Roll % Slider',
          'Experimental / Oversized Build Mode',
          'SLEF Import / Export',
          'Module Presets',
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
