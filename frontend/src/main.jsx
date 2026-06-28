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

// Set transparent background before React mounts so overlay windows never flash white
const _overlayKey = new URLSearchParams(window.location.hash.replace(/^#\/?/, '')).get('overlay')
if (_overlayKey) {
  document.body.style.background = 'transparent'
  document.documentElement.style.background = 'transparent'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
