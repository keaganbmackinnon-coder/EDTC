import { useState, useEffect, Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div className="p-8 text-red-400 font-mono text-sm">
        <div className="text-ed-orange font-semibold mb-2">Page error</div>
        <pre className="whitespace-pre-wrap">{this.state.error?.message}</pre>
        <button className="mt-4 btn-ghost text-xs" onClick={() => this.setState({ error: null })}>Dismiss</button>
      </div>
    )
    return this.props.children
  }
}
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
  const [version, setVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState(null)   // {latest, download_url}
  const [updateState, setUpdateState] = useState(null) // null | 'downloading' | {pct, downloaded, total} | 'installing' | {error}

  useEffect(() => {
    function init() {
      window?.pywebview?.api?.get_version?.().then(v => {
        setVersion(v ?? '')
        window?.pywebview?.api?.check_for_update?.().then(info => {
          if (info?.update_available) setUpdateInfo({ latest: info.latest, download_url: info.download_url })
        })
      })
    }
    if (window.pywebview?.api) {
      init()
    } else {
      window.addEventListener('pywebviewready', init)
      return () => window.removeEventListener('pywebviewready', init)
    }
  }, [])

  useEffect(() => {
    const off = window.__edtc?.on('update_progress', payload => {
      if (payload.error) {
        setUpdateState({ error: payload.error })
      } else if (payload.status === 'installing') {
        setUpdateState('installing')
      } else {
        setUpdateState({ pct: payload.pct, downloaded: payload.downloaded, total: payload.total })
      }
    })
    return () => off?.()
  }, [])

  function startUpdate() {
    if (!updateInfo?.download_url) return
    setUpdateState('downloading')
    window?.pywebview?.api?.download_and_install_update?.(updateInfo.download_url)
  }

  const overlayKey = new URLSearchParams(window.location.hash.replace(/^#\/?/, '')).get('overlay')
  const OverlayComponent = overlayKey ? OVERLAY_MAP[overlayKey] : null

  if (OverlayComponent) {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
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
        <div className="p-3 border-t border-ed-border text-xs font-mono">
          {updateInfo && updateState === null ? (
            <div>
              <div className="text-ed-muted mb-1">{version ? `v${version}` : ''}</div>
              <button
                onClick={startUpdate}
                className="w-full text-left text-amber-400 hover:text-amber-300 transition-colors"
              >
                ↑ v{updateInfo.latest} available
              </button>
            </div>
          ) : updateState === 'downloading' ? (
            <div className="text-ed-muted">Downloading…</div>
          ) : updateState && typeof updateState === 'object' && updateState.pct !== undefined ? (
            <div>
              <div className="text-ed-muted mb-1">Downloading… {updateState.pct}%</div>
              <div className="w-full bg-ed-border rounded-full h-1">
                <div className="bg-amber-400 h-1 rounded-full transition-all" style={{ width: `${updateState.pct}%` }} />
              </div>
            </div>
          ) : updateState === 'installing' ? (
            <div className="text-amber-400">Installing… restarting</div>
          ) : updateState?.error ? (
            <div>
              <div className="text-red-400 mb-1">Update failed</div>
              <div className="text-ed-muted truncate" title={updateState.error}>{updateState.error}</div>
            </div>
          ) : (
            <div className="text-ed-muted">{version ? `v${version}` : ''}</div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-ed-dark">
        <ErrorBoundary>
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
        </ErrorBoundary>
      </main>
    </div>
  )
}
