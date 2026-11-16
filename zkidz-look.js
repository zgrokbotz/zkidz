// zkidz-look.js: optional "vision look" for ZKidz characters (soft matte clay figure, warm key light,
// gentle rim, soft contact shadow, ACES tone mapping) + the mockup-style stone pedestal.
// Touches ONLY character rigs passed to applyVisionLook(); never coral/scene meshes.
// Keeps every node, name and hierarchy from buildOllie() unchanged, so addEquipment() and animateChar() keep working.
// All materials/geometries are SHARED + CACHED (buildOllie runs on every outfit change). Nothing runs per frame.
import * as THREE from './vendor/three.module.min.js?v=20261116-12';

/** ONE switch for ACES. Off = game's current LinearToneMapping @ 1.0. */
export const VISION_ACES = true;
export const VISION_EXPOSURE = 1.18;   // ACES darkens mid-tones; 1.15-1.25 keeps the bright reef/UI colours punchy

const MAT_CACHE = new Map(), GEO_CACHE = new Map();
let EYE_MAT = null, BLOB = null;

// soft rim light term, ONE shader program for every vision material (no per-character program compiles)
function addRim(m){
  m.customProgramCacheKey = () => 'zkVisionRim';
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `float zkRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
       outgoingLight += vec3(1.0, 0.93, 0.82) * zkRim * 0.22;
       #include <opaque_fragment>`);
  };
  return m;
}
function clayMat(hex, map){
  const key = hex + (map ? '|map:' + map.uuid : '');
  let m = MAT_CACHE.get(key); if(m) return m;
  const c = new THREE.Color(hex);
  m = addRim(new THREE.MeshPhysicalMaterial({
    color: c, map: map || null, roughness: .82, metalness: 0,
    sheen: .35, sheenRoughness: .8, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), .45),
    clearcoat: .06, clearcoatRoughness: .7 }));
  m.userData.zkShared = true; MAT_CACHE.set(key, m); return m;
}
function eyeMat(){ return EYE_MAT || (EYE_MAT = Object.assign(new THREE.MeshPhysicalMaterial({ color:0x0b0b0e, roughness:.22, clearcoat:.9, clearcoatRoughness:.08 }), { userData:{ zkShared:true } })); }
function smoothSphere(r){ const k='s'+r.toFixed(4); let g=GEO_CACHE.get(k); if(!g){ g=new THREE.SphereGeometry(r, 36, 26); g.userData.shared=true; GEO_CACHE.set(k,g); } return g; }
function smoothCapsule(r,l){ const k='c'+r.toFixed(4)+'_'+l.toFixed(4); let g=GEO_CACHE.get(k); if(!g){ g=new THREE.CapsuleGeometry(r, l, 10, 22); g.userData.shared=true; GEO_CACHE.set(k,g); } return g; }

// species maps (Finn stripes, Wade spots) are canvas textures rebuilt per buildOllie; keep the first one per kind
const MAP_KEEP = new Map();

/**
 * Restyle one character (the Group returned by buildOllie) in place. Call right after buildOllie(), before or after
 * addEquipment (only meshes flagged userData.base by buildOllie are restyled, so accessories are untouched).
 * Ghost rigs (transparent race ghost) are skipped.
 */
export function applyVisionLook(char, kind = 'ollie'){
  const parts = char.userData.parts; if(!parts || char.userData.visionLook) return char;
  if(parts.body && parts.body.material && parts.body.material.transparent) return char;   // ghost=true
  const dispose = new Set();
  char.traverse(o => {
    if(!o.isMesh || !o.userData.base) return;
    const g = o.geometry, p = g.parameters || {};
    // 1) smoother geometry (shared cache; built once per radius, never per frame)
    if(g.type === 'SphereGeometry' && p.widthSegments < 32 && p.phiLength >= Math.PI*2-1e-3 && p.thetaLength >= Math.PI-1e-3){ if(!g.userData.shared) dispose.add(g); o.geometry = smoothSphere(p.radius); }
    else if(g.type === 'CapsuleGeometry' && p.capSegments < 10){ if(!g.userData.shared) dispose.add(g); o.geometry = smoothCapsule(p.radius, p.length); }
    // 2) matte clay materials
    const m = o.material; if(!m || Array.isArray(m) || m.userData.zkShared) return;
    if(m.isMeshBasicMaterial) return;                                    // eye shine stays bright
    if(m.clearcoat === 1){ dispose.add(m); o.material = eyeMat(); return; } // bead eyes / nose / smile
    let map = null;
    if(m.map){ const k = kind + '|' + (o === parts.body ? 'body' : 'map'); if(!MAP_KEEP.has(k)) MAP_KEEP.set(k, m.map); map = MAP_KEEP.get(k); if(map !== m.map) dispose.add(m.map); }
    if(m.alphaMap){ return; }                                             // otter muzzle uses an alpha mask: keep as is
    dispose.add(m); o.material = clayMat(m.color.getHex(), map);
  });
  dispose.forEach(x => { if(!x.userData || !x.userData.zkShared) x.dispose(); });
  char.userData.visionLook = true;
  return char;
}

/** Soft blob contact shadow under a character (one shared geometry+material). Animated by animateChar via o.userData.blob. */
export function addBlobShadow(char, radius = .62, opacity = .42){
  if(!BLOB){ const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64,64,4,64,64,62); gr.addColorStop(0,'rgba(10,30,50,1)'); gr.addColorStop(.55,'rgba(10,30,50,.55)'); gr.addColorStop(1,'rgba(10,30,50,0)');
    x.fillStyle = gr; x.fillRect(0,0,128,128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    BLOB = { geo: new THREE.PlaneGeometry(2,2), tex: t }; BLOB.geo.rotateX(-Math.PI/2); }
  const mat = new THREE.MeshBasicMaterial({ map: BLOB.tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(BLOB.geo, mat); m.scale.setScalar(1); m.position.y = .012; m.renderOrder = 1;
  const holder = new THREE.Group(); holder.scale.set(radius, 1, radius*.85); holder.position.z = .02; holder.add(m);
  m.userData.op = opacity; char.add(holder); char.userData.blob = m; return m;
}

/**
 * Lights + tone mapping ONLY (no pedestal, no background). Use INSTEAD of game.js addLights(scene); returns the key
 * light like addLights returns `sun` (so `G.sun = setupVisionScene(sc, renderer)` keeps the shadow-follow code working).
 * The key light is tagged userData.main so applyQuality() can switch its shadow off on low-end devices.
 */
export function setupVisionScene(scene, renderer, { aces = VISION_ACES, exposure = VISION_EXPOSURE, castShadow = true } = {}){
  const hemi = new THREE.HemisphereLight(0xd6f1ff, 0xb48a5c, 1.05); hemi.userData.zkVision = true;
  const key = new THREE.DirectionalLight(0xffe0b0, 2.35); key.position.set(5, 14, 9); key.userData.main = true; key.userData.zkVision = true;
  key.castShadow = castShadow; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -.0006; key.shadow.normalBias = .025;
  const sc = key.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
  const rim = new THREE.DirectionalLight(0x9edcff, 1.1); rim.position.set(-6, 7, -10); rim.userData.zkVision = true;   // cool back/rim, no shadow
  scene.add(hemi, key, key.target, rim);
  setVisionToneMapping(renderer, aces, exposure);
  return key;
}
export function setVisionToneMapping(renderer, on = VISION_ACES, exposure = VISION_EXPOSURE){
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.LinearToneMapping;
  renderer.toneMappingExposure = on ? exposure : 1.0;
}

// ---------- stone pedestal (mockup style) ----------
let PED = null;
function flagstoneTexture(){            // irregular sandy flagstones (Voronoi), like the mockup pedestal top
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = []; for(let i = 0; i < 26; i++){ const a = r() * 6.283, d = Math.sqrt(r()) * S * .52; P.push([S/2 + Math.cos(a) * d, S/2 + Math.sin(a) * d, 188 + r() * 40 | 0, r()]); }
  const img = x.createImageData(S, S), D = img.data;
  for(let y = 0; y < S; y++) for(let X = 0; X < S; X++){ let d1 = 1e9, d2 = 1e9, k = 0;
    for(let i = 0; i < P.length; i++){ const dx = X - P[i][0], dy = y - P[i][1], d = dx*dx + dy*dy; if(d < d1){ d2 = d1; d1 = d; k = i; } else if(d < d2) d2 = d; }
    const edge = Math.sqrt(d2) - Math.sqrt(d1), t = P[k][2], n = ((X * 7 + y * 13) % 5) * 1.5;
    const g = edge < 2.2 ? .55 : edge < 4 ? .8 + (edge - 2.2) * .1 : 1;
    const o = (y * S + X) * 4; D[o] = (t + 14 + n) * g; D[o+1] = (t + 2 + n) * g; D[o+2] = (t - 26 + n) * g; D[o+3] = 255; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function pedAssets(){
  if(PED) return PED;
  const stone = new THREE.MeshStandardMaterial({ color: 0xbfae94, roughness: .95 });
  const top = new THREE.MeshStandardMaterial({ map: flagstoneTexture(), roughness: .92 });
  const rock = new THREE.MeshStandardMaterial({ roughness: .9, flatShading: false });
  const moss = new THREE.MeshStandardMaterial({ color: 0x4fae3c, roughness: .85 });
  const prof = [[0,0],[1.74,0],[1.82,.07],[1.85,.27],[1.8,.42],[1.7,.49],[1.56,.515],[1.5,.52]].map(([a,b]) => new THREE.Vector2(a,b));
  const side = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(24), 56);
  const cap = new THREE.CircleGeometry(1.52, 56); cap.rotateX(-Math.PI/2);
  const rockG = new THREE.IcosahedronGeometry(1, 2); const pos = rockG.attributes.position, v = new THREE.Vector3();
  for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); const n = 1 + .12*Math.sin(v.x*5.1+v.y*3.3) + .08*Math.sin(v.z*7.7); pos.setXYZ(i, v.x*n, v.y*n*.8, v.z*n); } rockG.computeVertexNormals();
  const mossG = new THREE.SphereGeometry(1, 14, 10);
  PED = { stone, top, rock, moss, side, cap, rockG, mossG }; return PED;
}
/**
 * Stone pedestal like the mockup: rounded slab with flagstone top, a ring of rocks and moss tufts.
 * Top surface is at y = `top` (default .52 = lobby baseY; use { top:.28 } for shop mode). Returns a Group.
 */
export function buildPedestal({ top = .52, radius = 1.8 } = {}){
  const A = pedAssets(), g = new THREE.Group(); g.name = 'zkPedestal';
  const k = radius / 1.8, ys = top / .52;
  const side = new THREE.Mesh(A.side, A.stone); side.scale.set(k, ys, k); side.castShadow = side.receiveShadow = true; g.add(side);
  const cap = new THREE.Mesh(A.cap, A.top); cap.position.y = top + .002; cap.scale.set(k,1,k); cap.receiveShadow = true; g.add(cap);
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = 18, rocks = new THREE.InstancedMesh(A.rockG, A.rock, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for(let i=0;i<N;i++){ const a = i/N*6.283 + r()*.2, d = (1.95 + r()*.18)*k, s = (.2 + r()*.16)*Math.max(.7,ys);
    q.setFromEuler(e.set(r()*.5, r()*6.28, r()*.5)); m4.compose(new THREE.Vector3(Math.cos(a)*d, s*.45, Math.sin(a)*d), q, new THREE.Vector3(s*1.3, s, s*1.1));
    rocks.setMatrixAt(i, m4); rocks.setColorAt(i, c.setHSL(.62 + r()*.06, .08 + r()*.08, .42 + r()*.12)); }
  rocks.castShadow = rocks.receiveShadow = true; g.add(rocks);
  const M = 10, moss = new THREE.InstancedMesh(A.mossG, A.moss, M);
  for(let i=0;i<M;i++){ const a = r()*6.283, d = (1.86 + r()*.12)*k, s = .1 + r()*.09;
    m4.compose(new THREE.Vector3(Math.cos(a)*d, .06 + r()*.12*ys, Math.sin(a)*d), q.identity(), new THREE.Vector3(s*1.6, s*.7, s*1.6)); moss.setMatrixAt(i, m4);
    moss.setColorAt(i, c.setHSL(.27 + r()*.06, .55, .38 + r()*.1)); }
  g.add(moss);
  return g;
}
