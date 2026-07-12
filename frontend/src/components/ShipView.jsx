import { Suspense, useMemo, Component } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ShipSchematic, { HP_STYLE, HP_ANCHORS } from './ShipSchematic'

// ---------------------------------------------------------------------------
// ShipView — renders a real 3D ship model as an orange WIREFRAME (matching the
// app aesthetic; low-poly / untextured models are fine) with orbit + zoom.
// Drop a model at frontend/src/ship-models/<ship_id>.glb (or .gltf / .obj) and
// it is auto-detected and bundled by Vite — the file name must equal the ship's
// id (see data/ships.json). Any ship WITHOUT a model file gracefully falls back
// to the 2D procedural schematic, and so does a model that fails to load.
//
// Hardpoint/utility mount markers are raycast onto the real hull surface so
// hovering a slot row lights up where it sits, and clicking a marker opens the
// slot picker — same two-way link as the 2D schematic.
// ---------------------------------------------------------------------------

// Vite bundles every mesh under ship-models/ and hands back its URL.
const _files = import.meta.glob('../ship-models/*.{glb,gltf,obj,stl}', {
  query: '?url', import: 'default', eager: true,
})
const MODELS = {}
for (const path in _files) {
  const m = path.match(/([^/\\]+)\.(glb|gltf|obj|stl)$/i)
  if (m) MODELS[m[1].toLowerCase()] = { url: _files[path], ext: m[2].toLowerCase() }
}

const LOADER = { obj: OBJLoader, stl: STLLoader, glb: GLTFLoader, gltf: GLTFLoader }

export function hasModel(shipId) {
  return !!(shipId && MODELS[String(shipId).toLowerCase()])
}

// per-ship rotation override (radians, [x,y,z]) when the auto lay-flat guess is
// wrong for a particular model
const MODEL_ROTATION = {}
// ships whose model lands flat but belly-up — roll 180° about the length axis.
// The whole Kahnindustries print set shares one orientation convention, so all
// of it gets the flip; flag exceptions by removing an id here.
const FLIP_UPRIGHT = new Set([
  'adder', 'alliance_challenger', 'alliance_chieftain', 'alliance_crusader', 'anaconda',
  'asp', 'asp_scout', 'beluga', 'cobra_mk_iii', 'cobra_mk_iv', 'diamondback',
  'diamondback_explorer', 'dolphin', 'eagle', 'federal_assault_ship', 'federal_corvette',
  'federal_dropship', 'federal_gunship', 'fer_de_lance', 'hauler', 'imperial_clipper',
  'imperial_courier', 'imperial_cutter', 'imperial_eagle', 'keelback', 'krait_mkii',
  'krait_phantom', 'mamba', 'orca', 'python', 'sidewinder', 'type_10_defender',
  'type_6_transporter', 'type_7_transport', 'type_9_heavy', 'viper', 'viper_mk_iv', 'vulture',
  // Pizza42 newer ships — also land belly-up
  'cobramkv', 'imperial_corsair', 'mandalay', 'python_nx', 'type_8_transport',
  'explorer_nx', 'panthermkii',
])

// build an orange wireframe (edges) group in the mesh's own coords + its bbox.
// Also lays the ship flat: 3D-print STLs are often modelled standing up, which
// makes the turntable spin them "like a top" — so we rotate the model's thinnest
// dimension to vertical (Y), which sits any hull level.
function buildWireframe(root, shipId) {
  const src = root.clone(true)
  src.updateMatrixWorld(true)
  const wire = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color: 0xff7b00, transparent: true, opacity: 0.82 })
  const solidGeoms = [] // position-only copies, world coords — for raycasting mounts
  src.traverse(c => {
    if (c.isMesh && c.geometry) {
      const edges = new THREE.EdgesGeometry(c.geometry, 18) // 18° crease threshold
      const ls = new THREE.LineSegments(edges, mat)
      ls.applyMatrix4(c.matrixWorld) // bake the mesh's own transform
      wire.add(ls)
      const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()
      const gg = new THREE.BufferGeometry()
      gg.setAttribute('position', g.getAttribute('position').clone())
      gg.applyMatrix4(c.matrixWorld)
      solidGeoms.push(gg)
    }
  })

  const override = MODEL_ROTATION[String(shipId).toLowerCase()]
  if (override) {
    wire.rotation.set(override[0], override[1], override[2])
  } else {
    // lay flat: bring the thinnest axis to vertical (Y)
    const pre = new THREE.Box3().setFromObject(wire)
    const s = pre.getSize(new THREE.Vector3())
    const arr = [s.x, s.y, s.z]
    const minAxis = arr.indexOf(Math.min(...arr))
    if (minAxis === 0) wire.rotation.z = Math.PI / 2       // X thinnest → up
    else if (minAxis === 2) wire.rotation.x = Math.PI / 2  // Z thinnest → up
  }
  wire.updateMatrixWorld(true)

  // flip belly-up models right-side up: roll 180° about the horizontal length axis
  if (!override && FLIP_UPRIGHT.has(String(shipId).toLowerCase())) {
    const b = new THREE.Box3().setFromObject(wire)
    const sz = b.getSize(new THREE.Vector3())
    const axis = sz.x >= sz.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
    wire.rotateOnWorldAxis(axis, Math.PI)
    wire.updateMatrixWorld(true)
  }

  const box = new THREE.Box3().setFromObject(wire)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  // merge the solid geometry into one mesh (same final transform as the wire) so
  // mount markers can be raycast onto the real hull surface
  let raycastMesh = null
  if (solidGeoms.length) {
    const merged = solidGeoms.length === 1 ? solidGeoms[0] : mergeGeometries(solidGeoms, false)
    if (merged) {
      merged.applyMatrix4(wire.matrix) // same lay-flat / flip as the displayed wire
      // invisible but raycastable — also added to the scene in placement mode
      // so hull clicks land on the real surface
      raycastMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false,
      }))
      raycastMesh.updateMatrixWorld(true)
    }
  }

  return { wire, size, center, maxDim: Math.max(size.x, size.y, size.z) || 1, raycastMesh }
}

// place hardpoint/utility markers on the actual hull surface. The model is laid
// flat (Y = up); length is the longer horizontal axis, width the other. Each
// mount's cross-section angle (0 = starboard, π/2 = top) is raycast inward onto
// the mesh so the marker sits on the skin. Falls back to the bounding box.
function computeMounts3D(ship, size, center, raycastMesh) {
  const s = [size.x, size.y, size.z], c = [center.x, center.y, center.z]
  const upAxis = 1
  const lenAxis = s[0] >= s[2] ? 0 : 2
  const widthAxis = lenAxis === 0 ? 2 : 0
  const ray = new THREE.Raycaster()
  const bigR = (Math.max(s[widthAxis], s[upAxis]) || 1) * 2 + 1

  const place = (frac, ang) => {
    const dW = Math.cos(ang), dU = Math.sin(ang)          // dir in the width/up plane
    const lenPos = c[lenAxis] + (frac - 0.5) * s[lenAxis] * 0.82
    // bounding-box fallback point
    const fb = [0, 0, 0]
    fb[lenAxis] = lenPos
    fb[widthAxis] = c[widthAxis] + dW * 0.5 * s[widthAxis]
    fb[upAxis] = c[upAxis] + dU * 0.5 * s[upAxis]
    if (raycastMesh) {
      const origin = new THREE.Vector3()
      origin.setComponent(lenAxis, lenPos)
      origin.setComponent(widthAxis, c[widthAxis] + dW * bigR)
      origin.setComponent(upAxis, c[upAxis] + dU * bigR)
      const dir = new THREE.Vector3()
      dir.setComponent(widthAxis, -dW); dir.setComponent(upAxis, -dU); dir.normalize()
      ray.set(origin, dir)
      const hit = ray.intersectObject(raycastMesh, false)[0]
      if (hit) {
        const p = hit.point.addScaledVector(dir, -0.02 * bigR) // sit just proud of the skin
        return [p.x, p.y, p.z]
      }
    }
    return fb
  }

  const out = []
  ;(ship?.hardpoint_sizes || []).forEach((sz, i) => {
    const [f, a] = HP_ANCHORS[i % HP_ANCHORS.length]
    out.push({ key: `hardpoint:${i}`, kind: 'hardpoint', size: sz, pos: place(f, a) })
  })
  const nu = ship?.utility_slots || 0
  for (let i = 0; i < nu; i++) {
    const f = 0.30 + (nu > 1 ? i / (nu - 1) : 0.5) * 0.30
    const a = Math.PI / 2 + ((i % 2) ? 1 : -1) * (0.35 + 0.12 * Math.floor(i / 2))
    out.push({ key: `utility:${i}`, kind: 'utility', size: 0, pos: place(f, a) })
  }
  return out
}

function Mount3D({ m, maxDim, active, onSelect }) {
  const color = m.kind === 'utility' ? '#9aa7b6' : HP_STYLE[m.size].color
  const r = (m.kind === 'utility' ? 0.028 : 0.04) * maxDim
  return (
    <mesh position={m.pos} scale={active ? 1.8 : 1}
      onPointerDown={onSelect ? e => { e.stopPropagation(); onSelect(m.key) } : undefined}
      onPointerOver={onSelect ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onSelect ? () => (document.body.style.cursor = 'default') : undefined}>
      <sphereGeometry args={[r, 16, 16]} />
      {/* hand-placed anchors render solid; procedural guesses stay faint */}
      <meshBasicMaterial color={active ? '#ffffff' : color} transparent
        opacity={active ? 1 : m.placed ? 0.95 : 0.5} />
    </mesh>
  )
}

function ModelScene({ url, ext, ship, activeKey, onSelectMount, anchors, placing, onPlace }) {
  const loaded = useLoader(LOADER[ext] || GLTFLoader, url)
  const root = useMemo(() => {
    if (ext === 'stl') return new THREE.Mesh(loaded)   // STLLoader returns a geometry
    if (ext === 'obj') return loaded
    return loaded.scene                                 // glb / gltf
  }, [loaded, ext])
  const { wire, size, center, maxDim, raycastMesh } = useMemo(() => buildWireframe(root, ship?.id), [root, ship?.id])
  const mounts = useMemo(() => {
    const guessed = computeMounts3D(ship, size, center, raycastMesh)
    // hand-placed anchors (bbox-normalised [nx,ny,nz]) override the guesses
    return guessed.map(m => {
      const a = anchors?.[m.key]
      if (!Array.isArray(a) || a.length !== 3) return m
      return { ...m, placed: true, pos: [
        center.x - size.x / 2 + a[0] * size.x,
        center.y - size.y / 2 + a[1] * size.y,
        center.z - size.z / 2 + a[2] * size.z,
      ] }
    })
  }, [ship, size, center, raycastMesh, anchors])
  const placeOnHull = (e) => {
    if (e.delta > 6) return          // orbit drag, not a click
    e.stopPropagation()
    const p = raycastMesh.worldToLocal(e.point.clone())
    onPlace?.(placing, [
      (p.x - (center.x - size.x / 2)) / (size.x || 1),
      (p.y - (center.y - size.y / 2)) / (size.y || 1),
      (p.z - (center.z - size.z / 2)) / (size.z || 1),
    ])
  }
  return (
    <group scale={3 / maxDim}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={wire} />
        {placing && raycastMesh && (
          <primitive object={raycastMesh} onClick={placeOnHull}
            onPointerOver={() => (document.body.style.cursor = 'crosshair')}
            onPointerOut={() => (document.body.style.cursor = 'default')} />
        )}
        {mounts.map(m => (
          <Mount3D key={m.key} m={m} maxDim={maxDim}
            active={m.key === activeKey}
            onSelect={placing ? undefined : onSelectMount} />
        ))}
      </group>
    </group>
  )
}

function Ship3D({ url, ext, ship, activeKey, onSelectMount, anchors, placing, onPlace }) {
  return (
    <Canvas camera={{ position: [2.8, 1.7, 3.4], fov: 42 }} gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
      <Suspense fallback={null}>
        <ModelScene url={url} ext={ext} ship={ship} activeKey={activeKey} onSelectMount={onSelectMount}
          anchors={anchors} placing={placing} onPlace={onPlace} />
      </Suspense>
      <OrbitControls enablePan={false} autoRotate={!placing} autoRotateSpeed={0.5}
        minDistance={2} maxDistance={11} />
    </Canvas>
  )
}

// if the model can't load (bad file, no WebGL, draco-compressed…), show the 2D schematic
class ModelBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.warn('ShipView: 3D model failed, using 2D schematic —', err?.message) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function ShipView({ ship, activeKey = null, onSelectMount, className,
                                    anchors = null, placing = null, onPlace = null }) {
  const entry = ship && MODELS[String(ship.id).toLowerCase()]
  const fallback = (
    <ShipSchematic ship={ship} activeKey={activeKey} onSelectMount={onSelectMount} className={className} />
  )
  if (!entry) return fallback
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Ship3D url={entry.url} ext={entry.ext} ship={ship}
          activeKey={activeKey} onSelectMount={onSelectMount}
          anchors={anchors} placing={placing} onPlace={onPlace} />
      </Suspense>
    </ModelBoundary>
  )
}
