import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Navigation from './pages/Navigation'
import Trading from './pages/Trading'
import Exploration from './pages/Exploration'
import Engineering from './pages/Engineering'
import Colonisation from './pages/Colonisation'
import FleetCarriers from './pages/FleetCarriers'
import Guardian from './pages/Guardian'
import Galaxy from './pages/Galaxy'
import Commander from './pages/Commander'
import Overlays from './pages/Overlays'
import CmdrPing from './overlays/CmdrPing'
import RouteOverlay from './overlays/Route'
import FssValues from './overlays/FssValues'
import SystemPreview from './overlays/SystemPreview'
import ExoTracker from './overlays/ExoTracker'
import Construction from './overlays/Construction'

const OVERLAY_MAP = {
  'cmdr-ping':      CmdrPing,
  'route':          RouteOverlay,
  'fss':            FssValues,
  'system-preview': SystemPreview,
  'exo-tracker':    ExoTracker,
  'construction':   Construction,
}

const NAV_ITEMS = [
  { path: '/navigation',   label: 'Navigation' },
  { path: '/trading',      label: 'Trading' },
  { path: '/exploration',  label: 'Exploration' },
  { path: '/engineering',  label: 'Engineering' },
  { path: '/colonisation', label: 'Colonisation' },
  { path: '/fleet',        label: 'Fleet Carriers' },
  { path: '/guardian',     label: 'Guardian & POI' },
  { path: '/galaxy',       label: 'Galaxy' },
  { path: '/commander',    label: 'Commander' },
  { path: '/overlays',     label: 'Overlays' },
]

export default function App() {
  const overlayKey = new URLSearchParams(window.location.search).get('overlay')
  const OverlayComponent = overlayKey ? OVERLAY_MAP[overlayKey] : null

  if (OverlayComponent) {
    return <OverlayComponent />
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-48 bg-ed-panel border-r border-ed-border flex flex-col shrink-0">
        <div className="p-4 border-b border-ed-border">
          <span className="font-mono text-ed-orange text-lg font-bold tracking-widest">EDTC</span>
          <p className="text-ed-muted text-xs mt-0.5">Elite Dangerous Tools</p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm transition-colors duration-100 border-l-2 ${
                  isActive
                    ? 'border-ed-orange text-ed-orange bg-ed-dark'
                    : 'border-transparent text-ed-text hover:text-ed-orange hover:border-ed-border'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-ed-border text-ed-muted text-xs font-mono">
          v0.1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-ed-dark">
        <Routes>
          <Route path="/" element={<Navigate to="/navigation" replace />} />
          <Route path="/navigation"   element={<Navigation />} />
          <Route path="/trading"      element={<Trading />} />
          <Route path="/exploration"  element={<Exploration />} />
          <Route path="/engineering"  element={<Engineering />} />
          <Route path="/colonisation" element={<Colonisation />} />
          <Route path="/fleet"        element={<FleetCarriers />} />
          <Route path="/guardian"     element={<Guardian />} />
          <Route path="/galaxy"       element={<Galaxy />} />
          <Route path="/commander"    element={<Commander />} />
          <Route path="/overlays"     element={<Overlays />} />
        </Routes>
      </main>
    </div>
  )
}
