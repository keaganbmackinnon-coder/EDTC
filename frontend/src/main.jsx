import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Global pywebview event bridge — backend calls window.__edtc.onEvent(...)
window.__edtc = {
  _listeners: {},
  onEvent(event) {
    const handlers = window.__edtc._listeners[event.type] || []
    handlers.forEach(fn => fn(event.payload))
  },
  on(type, handler) {
    if (!window.__edtc._listeners[type]) window.__edtc._listeners[type] = []
    window.__edtc._listeners[type].push(handler)
    return () => {
      window.__edtc._listeners[type] = window.__edtc._listeners[type].filter(h => h !== handler)
    }
  },
}

// Set dark HUD background before React mounts so overlay windows never flash white.
// (Real per-pixel transparency depends on an unreliable pywebview/WebView2 mechanism —
// see core/overlay.py — so overlays use a solid dark background instead.)
const _overlayKey = new URLSearchParams(window.location.hash.replace(/^#\/?/, '')).get('overlay')
if (_overlayKey) {
  document.body.style.background = '#0a0c0f'
  document.documentElement.style.background = '#0a0c0f'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
