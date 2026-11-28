// species-b3.js: batch-3 playables (Batch A: Squirt 18, Angie 20, Bella 21, Echo 22, Sharkie 24, Polly 25, Wally 28, Nudi 32),
// built from the approved hero mockups (mockups/<id>/hero.png) and the numbered chart designs (named/*.jpg).
// Same recipe as species-b2.js (Ollie C style, ONE continuous torso lathe per character, static same-colour features merged
// INTO the torso so they bend with the neck-blend shader, patterns as fragment paint, everything cached per species,
// no skinned meshes, no per-frame allocations). Self-contained: geometry helpers are copied from species-b2.js so the
// live batch-2 module does not change. Parts contract: rig, body, head, hatAnchor, eyeAnchor, sh+-1 > arm+-1, foot+-1, tail.
import * as THREE from './vendor/three.module.min.js?v=20261124-3';
import { clay, gloss, shineMat, neckTorso, sstep } from './ollie-v2.js?v=20261127-3';

const TAU = Math.PI * 2, Zv = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------- geometry helpers
function cr(a, b, c, d, t){ const t2 = t * t, t3 = t2 * t; return .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
function normPts(pts){ return pts.map(p => [p[0], p[1], p[2] ?? p[1], p[3] ?? 0]); }
/** dense Catmull-Rom through [y, rx, rz, zc] rows, then resampled by arc length to `rows` rows (poles at both ends). */
function profileRows(pts0, rows, rzMul = 1){
  const pts = normPts(pts0).map(p => [p[0], p[1], p[2] * rzMul, p[3]]), n = pts.length, P = i => pts[Math.max(0, Math.min(n - 1, i))], dense = [];
  for(let i = 0; i < n - 1; i++) for(let k = 0; k < 30; k++){ const t = k / 30, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2); dense.push([0, 1, 2, 3].map(j => cr(a[j], b[j], c[j], d[j], t))); }
  dense.push(pts[n - 1].slice());
  for(const r of dense){ r[1] = Math.max(0, r[1]); r[2] = Math.max(0, r[2]); }
  const L = [0]; for(let i = 1; i < dense.length; i++){ const a = dense[i - 1], b = dense[i]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], (b[1] + b[2] - a[1] - a[2]) / 2)); }
  const out = [], tot = L[L.length - 1]; let j = 0;
  for(let i = 0; i < rows; i++){ const s = tot * i / (rows - 1); while(j < L.length - 2 && L[j + 1] < s) j++; const f = (s - L[j]) / ((L[j + 1] - L[j]) || 1); out.push([0, 1, 2, 3].map(k => dense[j][k] + (dense[j + 1][k] - dense[j][k]) * f)); }
  out[0][1] = out[0][2] = 0; out[rows - 1][1] = out[rows - 1][2] = 0; return out;
}
/** Elliptical lathe (front = +z, seam at the back). deform(v, nx, nz, th, y) moves v (H units). Returns geometry in H units. */
function lathe(rowsD, seg, deform){
  const R = rowsD.length, pos = [], idx = [], v = new THREE.Vector3();
  const put = (row, th) => { const [y, rx, rz, zc] = row, s = Math.sin(th), c = Math.cos(th); v.set(rx * s, y, zc + rz * c);
    let nx = rz * s, nz = rx * c; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if(deform) deform(v, nx, nz, th, y); pos.push(v.x, v.y, v.z); };
  put(rowsD[0], 0);
  for(let i = 1; i < R - 1; i++) for(let j = 0; j < seg; j++) put(rowsD[i], Math.PI + j / seg * TAU);
  put(rowsD[R - 1], 0);
  const ring = i => 1 + (i - 1) * seg, top = 1 + (R - 2) * seg;
  for(let j = 0; j < seg; j++){ const j1 = (j + 1) % seg; idx.push(0, ring(1) + j, ring(1) + j1); }
  for(let i = 1; i < R - 2; i++) for(let j = 0; j < seg; j++){ const j1 = (j + 1) % seg, a = ring(i) + j, b = ring(i) + j1, c = ring(i + 1) + j, d = ring(i + 1) + j1; idx.push(a, c, b, b, c, d); }
  for(let j = 0; j < seg; j++){ const j1 = (j + 1) % seg; idx.push(top, ring(R - 2) + j1, ring(R - 2) + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  fixWinding(g); return g;
}
function fixWinding(g){ // make sure normals point outward (compare with centroid direction)
  const p = g.attributes.position, n = g.attributes.normal; let s = 0, cx = 0, cy = 0, cz = 0; for(let i = 0; i < p.count; i++){ cx += p.getX(i); cy += p.getY(i); cz += p.getZ(i); } cx /= p.count; cy /= p.count; cz /= p.count;
  for(let i = 0; i < p.count; i += 7) s += (p.getX(i) - cx) * n.getX(i) + (p.getY(i) - cy) * n.getY(i) + (p.getZ(i) - cz) * n.getZ(i);
  if(s < 0){ const ix = g.index.array; for(let i = 0; i < ix.length; i += 3){ const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); } return g; }
/** surface sampler on the (deformed) lathe: point + outward normal at angle th, height y (H units). */
function sampler(rowsD, deform){
  const R = rowsD.length;
  const rowAt = y => { let lo = 1, hi = R - 2; if(y <= rowsD[lo][0]) return rowsD[lo]; if(y >= rowsD[hi][0]) return rowsD[hi];
    while(hi - lo > 1){ const m = (lo + hi) >> 1; if(rowsD[m][0] < y) lo = m; else hi = m; } const a = rowsD[lo], b = rowsD[hi], f = (y - a[0]) / ((b[0] - a[0]) || 1); return [0, 1, 2, 3].map(k => a[k] + (b[k] - a[k]) * f); };
  const P = (th, y, out) => { const [, rx, rz, zc] = rowAt(y), s = Math.sin(th), c = Math.cos(th); out.set(rx * s, y, zc + rz * c); let nx = rz * s, nz = rx * c; const l = Math.hypot(nx, nz) || 1; if(deform) deform(out, nx / l, nz / l, th, y); return out; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  return (th, y) => { const p = P(th, y, new THREE.Vector3()), e = .004; P(th + e, y, a); P(th - e, y, b); P(th, y + e, c); P(th, y - e, d);
    const n = new THREE.Vector3().crossVectors(a.sub(b), c.sub(d)).normalize(); if(n.x * Math.sin(th) + n.z * Math.cos(th) < 0) n.negate(); return { p, n }; };
}
/** merge indexed/non-indexed geometries (position + normal) */
function mergeG(list){
  let nv = 0; const gs = list.filter(Boolean).map(g => { g = g.index ? g : indexify(g); if(g.attributes.uv) g.deleteAttribute('uv'); if(!g.attributes.normal) g.computeVertexNormals(); return g; });
  for(const g of gs) nv += g.attributes.position.count;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = []; let o = 0;
  for(const g of gs){ pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for(const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setIndex(idx); return r; }
/** weld coincident vertices (non-indexed -> indexed) so computeVertexNormals gives smooth shading (extrudes, cones). */
function weld(g, eps = 1e-4){ const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for(let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.round(x / eps) + '_' + Math.round(y / eps) + '_' + Math.round(z / eps);
    let j = map.get(k); if(j === undefined){ j = pos.length / 3; map.set(k, j); pos.push(x, y, z); } idx.push(j); }
  const src = g.index ? Array.from(g.index.array, i => idx[i]) : idx; const out = [];
  for(let i = 0; i < src.length; i += 3){ const a = src[i], b = src[i + 1], c = src[i + 2]; if(a !== b && b !== c && a !== c) out.push(a, b, c); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setIndex(out); r.computeVertexNormals(); return r; }
function indexify(g){ const n = g.attributes.position.count, a = []; for(let i = 0; i < n; i++) a.push(i); g.setIndex(a); return g; }
const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), S4 = new THREE.Vector3(), P4 = new THREE.Vector3();
function xf(g, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], q = null } = {}){ const qq = q || Q4.setFromEuler(E4.set(r[0], r[1], r[2])); M4.compose(P4.set(p[0], p[1], p[2]), qq, S4.set(s[0], s[1], s[2])); g.applyMatrix4(M4); return g; }
function sph(ws = 24, hs = 16){ const g = new THREE.SphereGeometry(1, ws, hs); g.deleteAttribute('uv'); return g; }
function ell(rx, ry, rz, opts = {}, ws = 24, hs = 16){ return xf(sph(ws, hs), { ...opts, s: [rx, ry, rz] }); }
/** tapered tube along points (Vector3 or arrays) with a round cap at the end; r(u) radius */
function tube(pts, r, segs = 28, rad = 12, cap = true){
  const curve = new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segs, 1, rad, false), pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3(), c = new THREE.Vector3();
  for(let i = 0; i < pos.count; i++){ const u = uv.getX(i); curve.getPointAt(Math.min(1, u), c); v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(r(u)).add(c); pos.setXYZ(i, v.x, v.y, v.z); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); const list = [g];
  if(cap){ const e = curve.getPointAt(1), s = sph(14, 10); s.scale(r(1), r(1), r(1)); s.translate(e.x, e.y, e.z); list.push(s); const b = curve.getPointAt(0), s0 = sph(14, 10); s0.scale(r(0), r(0), r(0)); s0.translate(b.x, b.y, b.z); list.push(s0); }
  return mergeG(list); }
/** flat extruded shape (in the x-y plane, thickness along z) with soft bevel; pts = [[x,y],...] polyline (smoothed). */
function slab(pts, depth, bev, smooth = 4){
  const s = new THREE.Shape(); const sp = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1]))).getPoints(pts.length * smooth);
  s.moveTo(sp[0].x, sp[0].y); for(let i = 1; i < sp.length; i++) s.lineTo(sp[i].x, sp[i].y); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * .9, bevelSegments: 4, curveSegments: 6, steps: 1 });
  g.translate(0, 0, -depth / 2); return weld(g); }
function scaleG(g, U){ g.scale(U, U, U); g.computeVertexNormals(); return g; }
// smooth bump: 1 at centre, 0 at distance 1 (normalised ellipse distance)
const bump = d => d >= 1 ? 0 : (1 - d * d) * (1 - d * d);

/** fin in the side (z-y) plane, thickness along x: pts = [[z, y], ...] H units */
function sideFin(pts, depth, bev){ const g = slab(pts, depth, bev, 5); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; }
/** rounded fin lobe: ellipse sections lofted along a spine ([[x,y,z],[x,y,z]], root->tip). chord(u)/thick(u) = full sizes; side mirrors x. */
function lobe(sp, chord, thick, side, N = 12, K = 16, yz = false){
  const a = new THREE.Vector3(...sp[0]), b = new THREE.Vector3(...sp[1]), s = b.clone().sub(a), D = (yz ? new THREE.Vector3(0, -s.z, s.y) : new THREE.Vector3(-s.y, s.x, 0)).normalize(), pos = [], idx = [];
  for(let i = 0; i <= N; i++){ const u = i / N, c = a.clone().lerp(b, u), ch = chord(u) / 2, th = thick(u) / 2;
    for(let k = 0; k < K; k++){ const f = k / K * TAU, cn = Math.cos(f), sn = Math.sin(f); if(yz) pos.push(c.x + sn * th, c.y + D.y * cn * ch, c.z + D.z * cn * ch); else pos.push(side * (c.x + D.x * cn * ch), c.y + D.y * cn * ch, c.z + sn * th); } }
  for(let i = 0; i < N; i++) for(let k = 0; k < K; k++){ const k1 = (k + 1) % K, p = i * K + k, q = i * K + k1, r = p + K, t = q + K; if(side > 0) idx.push(p, r, q, q, r, t); else idx.push(p, q, r, q, t, r); }
  const c0 = pos.length / 3, c1 = c0 + 1; for(const i of [0, N]){ const u = i / N, c = a.clone().lerp(b, u); pos.push(side * c.x, c.y, c.z); }   // end caps (the root cap can show at the crown)
  for(let k = 0; k < K; k++){ const k1 = (k + 1) % K, tp = (side > 0) === !yz; idx.push(c0, tp ? k1 : k, tp ? k : k1); idx.push(c1, tp ? N * K + k : N * K + k1, tp ? N * K + k1 : N * K + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return fixWinding(g); }
/** soft rounded flipper (ellipsoid, flared toward the tip); limb runs along -y */
function flipper(rx, ry, rz, flare = .25, curl = .012, drop = .8){ const g = ell(rx, ry, rz, {}, 24, 18), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), t = Math.max(0, -y / ry); p.setX(i, p.getX(i) * (1 + flare * t) + curl * (y / ry) ** 2); p.setZ(i, p.getZ(i) * (1 + flare * .6 * t)); }
  g.translate(0, -ry * drop, 0); g.computeVertexNormals(); return g; }

// ---------------------------------------------------------------- per-species definitions (H units unless noted)
// prof rows: [y, rx, rz?, zc?] (H = fraction of the mockup figure height, U = rig units per H). neck = rig-unit blend band.
export const B3 = {
  squirt: { name: 'Squirt the Squid', U: 2.3, color: 0xf27f72, sheen: .3, sheenCol: 0xffd2c8, rough: .84, rz: .94, seg: 104, rows: 130,
    prof: [[0.1,0],[0.104,0.12],[0.114,0.19],[0.135,0.222],[0.17,0.226],[0.2,0.205],[0.235,0.178],[0.26,0.166],[0.29,0.166],[0.31,0.18],[0.33,0.206],[0.35,0.23],[0.37,0.241],[0.42,0.245],[0.46,0.244],[0.5,0.238],[0.5516,0.224],[0.6032,0.205],[0.6548,0.18],[0.7064,0.15],[0.758,0.116],[0.8096,0.078],[0.8526,0.045],[0.887,0.02],[0.9085,0.008],[0.9171,0]],
    neck: [.9, 1.02], headY: 1.1, eye: { x: .115, y: .47, s: [.031, .037, .022] }, smile: { y: .447, w: .026, t: .0046, arc: 2.3 },
    sh: [.15, .265, .02], arm: 'squirtArm', foot: { x: .115, y: .05, z: .15, s: [.08, .066, .1] }, anim: 'playful' },
  angie: { name: 'Angie the Angelfish', U: 2.3, color: 0xffcf1f, sheen: .3, sheenCol: 0xfff2b0, rough: .82, rz: 1, seg: 112, rows: 120,
    prof: [[.055,0,0],[.06,.14,.155],[.08,.2,.222],[.13,.242,.27],[.2,.262,.29],[.3,.266,.294],[.4,.254,.28],[.5,.232,.256],[.6,.2,.22],[.7,.158,.174],[.77,.116,.128],[.82,.074,.081],[.85,.038,.042],[.862,0,0]],
    neck: [.98, 1.12], headY: 1.15, eye: { x: .108, y: .465, s: [.031, .037, .023] }, smile: { y: .432, w: .026, t: .0046, arc: 2.3 },
    sh: [.2, .36, .04], arm: 'angieFin', foot: { x: .1, y: .045, z: .05, s: [.075, .062, .095] }, blue: 0x2a56d8, flat: .9, anim: 'playful' },
  bella: { name: 'Bella the Beluga', U: 2.2, color: 0xf8f7f4, sheen: .34, sheenCol: 0xffffff, rough: .86, rz: .9, seg: 112, rows: 130,
    prof: [[.05,0],[.055,.17],[.08,.27],[.12,.32],[.2,.356],[.28,.366],[.36,.362],[.44,.348],[.5,.336],[.56,.338],[.62,.346],[.67,.345],[.711,.343],[.753,.336],[.794,.323],[.835,.304],[.876,.276],[.917,.237],[.959,.176],[.985,.111],[.996,.059],[1,0]],
    neck: [1.0, 1.16], headY: 1.22, eye: { x: .158, y: .655, s: [.033, .04, .024] }, smile: { y: .618, w: .03, t: .005, arc: 2.3 },
    sh: [.33, .5, .0], arm: 'bellaFlipper', foot: { x: .145, y: .048, z: .04, s: [.1, .07, .11] }, anim: 'calm' },
  echo: { name: 'Echo the Eel', U: 2.25, color: 0x8fd23c, sheen: .3, sheenCol: 0xe8ffc0, rough: .86, rz: .88, seg: 104, rows: 120,
    prof: [[.05,0],[.055,.17],[.08,.25],[.12,.288],[.2,.304],[.3,.298],[.4,.284],[.5,.266],[.6,.25],[.7,.236],[.737,.234],[.775,.229],[.812,.22],[.85,.205],[.887,.185],[.925,.157],[.963,.115],[.985,.074],[.996,.038],[1,0]],
    neck: [1.12, 1.3], headY: 1.36, eye: { x: .126, y: .69, s: [.034, .04, .025] }, smile: { y: .655, w: .03, t: .005, arc: 2.3 },
    sh: [.275, .44, .0], arm: 'echoFlipper', foot: { x: .13, y: .046, z: .03, s: [.1, .07, .115] }, anim: 'playful' },
  sharkie: { name: 'Sharkie the Shark', U: 2.3, color: 0x8e98a8, sheen: .28, sheenCol: 0xe6ecf4, rough: .84, rz: .9, seg: 112, rows: 130,
    prof: [[.04,0],[.045,.17],[.07,.27],[.12,.33],[.2,.358],[.3,.366],[.4,.36],[.5,.346],[.6,.322],[.68,.292],[.75,.248],[.8,.2],[.84,.14],[.865,.07],[.875,0]],
    neck: [.98, 1.12], headY: 1.18, eye: { x: .175, y: .545, s: [.034, .041, .025] }, smile: { y: .5, w: .062, t: .0052, arc: 1.75 },
    sh: [.33, .4, .02], arm: 'sharkFin', foot: { x: .15, y: .044, z: .04, s: [.1, .068, .115] }, anim: 'playful' },
  polly: { name: 'Polly the Puffin', U: 2.2, color: 0x1d1d22, sheen: .2, sheenCol: 0x8a8f9a, rough: .8, rz: .92, seg: 112, rows: 130,
    prof: [[.04,0],[.045,.17],[.07,.27],[.12,.33],[.2,.368],[.3,.382],[.4,.382],[.5,.372],[.6,.356],[.7,.332],[.78,.298],[.85,.25],[.91,.19],[.955,.12],[.985,.05],[1,0]],
    neck: [1.08, 1.26], headY: 1.32, eye: { x: .14, y: .705, s: [.033, .04, .024] }, smile: null,
    sh: [.35, .5, -.02], arm: 'pollyWing', foot: { x: .15, y: .036, z: .09, s: [.105, .05, .15], color: 0xf07a1c, toes: 0xe06a10 }, anim: 'chunky' },
  wally: { name: 'Wally the Whale', U: 2.35, color: 0x3d8fe8, sheen: .3, sheenCol: 0xcfe6ff, rough: .84, rz: .92, seg: 112, rows: 130,
    prof: [[.04,0],[.045,.16],[.07,.25],[.12,.3],[.2,.33],[.3,.34],[.4,.338],[.5,.326],[.58,.306],[.65,.28],[.71,.245],[.76,.198],[.8,.135],[.82,.07],[.828,0]],
    neck: [1.0, 1.16], headY: 1.22, eye: { x: .108, y: .565, s: [.032, .038, .024] }, smile: { y: .54, w: .026, t: .0046, arc: 2.3 },
    sh: [.31, .43, .0], arm: 'wallyFlipper', foot: { x: .14, y: .044, z: .03, s: [.1, .068, .112] }, anim: 'calm' },
  nudi: { name: 'Nudi the Sea Slug', U: 2.3, color: 0x7c46d6, sheen: .3, sheenCol: 0xe0ccff, rough: .84, rz: .9, seg: 100, rows: 96,
    prof: [[.045,0],[.05,.15],[.075,.24],[.12,.29],[.2,.316],[.3,.326],[.4,.324],[.5,.316],[.6,.3],[.68,.278],[.75,.246],[.8,.21],[.845,.16],[.875,.1],[.89,.04],[.894,0]],
    neck: [1.02, 1.18], headY: 1.24, eye: { x: .118, y: .625, s: [.032, .038, .024] }, smile: { y: .597, w: .026, t: .0046, arc: 2.3 },
    sh: [.3, .4, .0], arm: 'nudiArm', foot: { x: .13, y: .044, z: .03, s: [.095, .066, .108] }, orange: 0xf47a1e, anim: 'playful' },
};
export const BATCH3_IDS = Object.keys(B3);

// ---------------------------------------------------------------- torso deformations (H units)
const DEFORM = {};

// ---------------------------------------------------------------- paint (fragment) shaders; p = rig units, q = p / U
const W = 'vec3(0.955,0.955,0.94)';
const PAINT = {
  squirt: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  echo: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  nudi: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float under = 1.0 - smoothstep(0.05, 0.3, q.y);
  return mix(base, base * vec3(0.92, 0.9, 1.0), under * 0.5);
}`,
  bella: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.1, 0.2, q.z);
  float blush = (1.0 - smoothstep(0.6, 1.0, length(vec2((abs(q.x) - 0.215) / 0.05, (q.y - 0.615) / 0.036)))) * front;
  return mix(base, vec3(0.96, 0.58, 0.6), blush * 0.85);
}`,
  angie: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 blue = vec3(0.025, 0.08, 0.6);
  if(part > 1.5){ float b = zkAA(p.y / ${U.toFixed(3)} + 0.075); return mix(base, blue, b); }   // pectoral fin: blue tip
  if(part > 0.5) return base;
  vec3 q = p / ${U.toFixed(3)};
  float ph = abs(atan(q.x, q.z)) + 0.4 * (q.y - 0.45);   // longitude bands, leaning back; broad like the mockup
  float b = max(max(zkAA((abs(ph - 0.92) - 0.34) * 0.25), zkAA((abs(ph - 2.32) - 0.3) * 0.25)), zkAA((3.0 - ph) * 0.25));
  float sail = step(0.62, q.y) * step(q.z, 0.06) * step(abs(q.x), 0.05);
  b = mix(b, zkAA((q.z + 0.2) * 0.25), sail);
  b *= 1.0 - smoothstep(0.7, 0.8, q.y) * (1.0 - sail);
  return mix(base, blue, b);
}`,
  sharkie: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.04, 0.14, q.z);
  float belly = zkAA(length(vec2(q.x / 0.335, (q.y - 0.2) / 0.235)) - 1.0) * front;
  return mix(base, ${W}, belly);
}`,
  polly: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.03, 0.12, q.z);
  float lobe = zkAA(length(vec2((abs(q.x) - 0.15) / 0.135, (q.y - 0.69) / 0.135)) - 1.0);
  float cheek = zkAA(length(vec2(q.x / 0.26, (q.y - 0.6) / 0.09)) - 1.0);
  float belly = zkAA(length(vec2(q.x / 0.33, (q.y - 0.3) / 0.27)) - 1.0);
  float wedge = zkAA(abs(q.x) - 0.03 - 0.25 * max(0.0, 0.83 - q.y)) * step(0.74, q.y);
  float m = max(max(lobe, cheek), belly) * front * (1.0 - wedge);
  return mix(base, vec3(0.96, 0.96, 0.95), m);
}`,
  wally: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.06, 0.16, q.z);
  float e = length(vec2(q.x / 0.225, (q.y - 0.24) / 0.205)) - 1.0;
  float belly = zkAA(e) * front;
  float pl = 1.0 - smoothstep(0.0025, 0.0065, abs(fract(q.y / 0.021) - 0.5) * 0.021);
  vec3 w = mix(${W}, vec3(0.80, 0.84, 0.88), pl * 0.7 * smoothstep(0.0, -0.06, e));
  return mix(base, w, belly);
}`,
};

// ---------------------------------------------------------------- torso extras merged INTO the body mesh (H units)
const EXTRAS = {
  squirt(S){ const L = [];
    // mantle fins: rounded, thick-edged triangular lobes (lofted ellipse sections, no slab edges), tips up and out
    for(const s of [-1, 1]) L.push(lobe([[.15, .58, -.012], [.335, .61, -.02]], u => .24 * Math.pow(1 - u, .72) + .012, u => .066 * Math.pow(1 - u, .55) + .012, s));
    // tentacle skirt: eight FAT stubby tentacles; sides and rear curl their tips up (the two front tips are foot+-1)
    const T = [[.55, [[.1, .22], [.15, .15], [.185, .09], [.2, .07]], .074, .068],
               [1.22, [[.12, .22], [.19, .15], [.26, .095], [.3, .09], [.325, .115], [.325, .15]], .078, .056],
               [2.0, [[.12, .22], [.18, .14], [.235, .095], [.27, .09], [.29, .115], [.29, .145]], .074, .056],
               [2.72, [[.1, .22], [.15, .14], [.195, .095], [.225, .088], [.24, .11]], .07, .056]];
    for(const [a0, pts, r0, r1] of T) for(const sg of [-1, 1]){ const a = a0 * sg, d = [Math.sin(a), Math.cos(a)];
      L.push(tube(pts.map(([r, y]) => [d[0] * r, y, d[1] * r]), u => r0 + (r1 - r0) * u, 26, 12)); }
    return L; },
  angie(S){ const L = [], T = [];
    // tall rounded dorsal crest: a lofted leaf (round sections) sweeping up and back from the crown
    T.push(lobe([[0, .775, -.07], [0, .955, -.24]], u => .34 * Math.pow(1 - u, .6) + .05, u => .1 * Math.pow(1 - u, .5) + .03, 1, 14, 16, true));
    // ventral fin under the back
    L.push(sideFin([[-.08, .2], [-.19, .15], [-.3, .07], [-.34, .03], [-.3, .005], [-.17, .06], [-.06, .1]], .05, .022));
    return { base: L, top: T }; },
  sharkie(S){ // dorsal fin: tall soft triangle leaning back
    return { base: [], top: [sideFin([[.09, .8], [.02, .9], [-.03, .97], [-.06, 1.0], [-.075, .975], [-.085, .9], [-.12, .8], [-.02, .76]], .06, .026)] }; },
  wally(S){ const L = []; // water spout: centre plume + two curled side drops, same blue
    L.push(tube([[0, .78, 0], [0, .86, .005], [0, .925, 0]], u => .028 + .006 * u, 14, 10));
    L.push(ell(.04, .036, .036, { p: [0, .945, 0] }, 18, 12));
    for(const s of [-1, 1]){ L.push(tube([[0, .86, 0], [s * .035, .905, 0], [s * .075, .91, 0], [s * .1, .88, 0]], u => .02 + .006 * u, 16, 10));
      L.push(ell(.032, .03, .03, { p: [s * .105, .872, 0] }, 16, 12)); }
    return { base: [], top: L }; },
  nudi(S){ return []; },
};

// ---------------------------------------------------------------- arms (arm-local, H units; the limb runs along -y)
const ARMS = {
  // short tentacle arm: out, then the tip curls up (+x local = up once rotated out)
  squirtArm(){ return { g: tube([[0, .02, 0], [0, -.06, .004], [.01, -.12, .008], [.036, -.162, .006], [.078, -.18, .002], [.112, -.172, 0], [.134, -.15, 0]], u => .056 - .018 * u, 30, 12), rz: 1.3, rx: -.05 }; },
  angieFin(){ const g = flipper(.03, .12, .092, .6, .012); return { g, rz: .85, rx: -.3 }; },
  bellaFlipper(){ return { g: flipper(.055, .15, .1, .3, .014), rz: .3, rx: .02 }; },
  echoFlipper(){ return { g: flipper(.06, .155, .11, .35, .016), rz: .55, rx: 0 }; },
  sharkFin(){ const g = ell(.042, .15, .085, {}, 24, 18), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const y = p.getY(i), t = Math.max(0, -y / .15); p.setX(i, p.getX(i) * (1 - .45 * t * t)); p.setZ(i, p.getZ(i) * (1 - .35 * t * t) + .03 * t * t); }
    g.translate(0, -.12, 0); g.computeVertexNormals(); return { g, rz: .62, rx: -.1 }; },
  pollyWing(){ const g = ell(.05, .175, .085, {}, 24, 18), p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) + .03 * (y / .175) ** 2 - .01); p.setZ(i, p.getZ(i) * (1 - .25 * Math.max(0, -y / .175))); } g.translate(0, -.13, 0); g.computeVertexNormals(); return { g, rz: .2, rx: .05 }; },
  wallyFlipper(){ return { g: flipper(.045, .13, .088, .35, .014), rz: .5, rx: -.05 }; },
  nudiArm(){ return { g: flipper(.042, .1, .07, .25, .01), rz: .55, rx: 0 }; },
};

// ---------------------------------------------------------------- build + cache
const GEO = {};
function geos(kind){
  if(GEO[kind]) return GEO[kind];
  const V = B3[kind], U = V.U, def = DEFORM[kind];
  const rowsD = profileRows(V.prof, V.rows, V.rz);
  const torsoH = lathe(rowsD, V.seg, def), S = sampler(rowsD, def);
  const ex = EXTRAS[kind] ? EXTRAS[kind](S) : [], extras = Array.isArray(ex) ? ex : ex.base, topX = Array.isArray(ex) ? [] : ex.top;
  const G = { S, U };
  G.body = scaleG(mergeG([torsoH, ...extras, ...topX]), U);
  // head-top features (dorsal sail / fin / spout) are left out when a hat is on, so they never poke through the cap
  if(topX.length) G.bodyHat = scaleG(mergeG([lathe(rowsD, V.seg, def), ...extras]), U);
  // clothing profile (rig units): radius = max(rx, rz) per row
  G.prof = rowsD.map(r => new THREE.Vector2(Math.max(r[1], r[2]) * U, r[0] * U));
  G.sphere = sph(28, 18);
  const A = ARMS[V.arm](); G.arm = scaleG(A.g, U); G.armR = A;
  const mesh = new THREE.Mesh(scaleG(lathe(rowsD, V.seg, def), U)); const rc = new THREE.Raycaster();   // torso only (fins never catch the eyes)
  G.hit = (x, y) => { rc.set(new THREE.Vector3(x, y, 9), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(mesh, false)[0];
    if(!h) return { p: new THREE.Vector3(x, y, 0), n: Zv.clone() }; const n = h.face.normal.clone(); return { p: h.point.clone(), n }; };
  G.feat = FEAT[kind] ? FEAT[kind](G, V) : {};
  Object.values(G).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  Object.values(G.feat).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  return (GEO[kind] = G);
}
// feature geometries (rig units). *Head = head-local, *Rig = rig-local, tail = tail-local.
const FEAT = {
  angie(G, V){ const U = V.U; // blue forked fan tail behind the body
    const t = sideFin([[.02, -.05], [-.07, -.09], [-.17, -.16], [-.225, -.15], [-.2, -.04], [-.205, 0], [-.2, .04], [-.225, .15], [-.17, .16], [-.07, .09], [.02, .05]], .05, .022);
    return { tail: scaleG(t, U) }; },
  sharkie(G, V){ const U = V.U; // small crescent tail low on the back
    const t = sideFin([[.03, -.03], [-.05, -.05], [-.11, -.1], [-.12, -.07], [-.09, 0], [-.13, .1], [-.11, .12], [-.05, .05], [.03, .03]], .04, .018);
    return { tail: scaleG(t, U) }; },
  polly(G, V){ const U = V.U, h = G.hit(0, .625 * U);
    // big puffin beak: tall rounded wedge, tip forward and slightly down; lighter base plate
    const b = ell(.094, .13, .1, {}, 28, 20), p = b.attributes.position;
    for(let i = 0; i < p.count; i++){ const z = p.getZ(i), t = Math.max(0, z / .1); p.setX(i, p.getX(i) * (1 - .6 * t)); p.setY(i, p.getY(i) * (1 - .5 * t) - .045 * t * t); p.setZ(i, z * (z > 0 ? 1.15 : .6)); }
    b.computeVertexNormals();
    const beak = scaleG(b, U); beak.translate(h.p.x, h.p.y - V.headY, h.p.z + .01 * U);
    const pl = ell(.1, .135, .03, {}, 26, 16); const plate = scaleG(pl, U); plate.translate(h.p.x, h.p.y - V.headY + .004 * U, h.p.z - .004 * U);
    const ridge = tube([[-.072, .025, .06], [0, .055, .088], [.072, .025, .06]], u => .012, 16, 8); const rg = scaleG(ridge, U); rg.translate(h.p.x, h.p.y - V.headY, h.p.z);
    return { beakHead: beak, plateHead: plate, ridgeHead: rg }; },
  nudi(G, V){ const U = V.U, out = {};
    // rhinophore horns: curved soft cones, leaning out
    const horn = tube([[0, -.03, 0], [.006, .04, 0], [.02, .085, -.004], [.04, .115, -.01]], u => .058 - .036 * u, 20, 12);
    out.hornHead = scaleG(horn, U);
    // side frill: fat serpentine clay ropes, from behind the shoulder down each side and round under the front hem
    // (two ropes per side: a full outer one and a thinner, phase-shifted inner one -> a fuller, wavier ruffle)
    const L = [];
    const path = sd => t => { const side = t < .58, u = t / .58, w = sstep(.58, 1, t);
      return [sd * (Math.PI / 2 + .1 - (Math.PI / 2 + .02) * w), side ? .69 - .5 * sstep(0, 1, u) : .19 - .05 * w + .006 * Math.sin(t * 90), w]; };
    for(const sd of [-1, 1]){
      L.push(rope(G.S, path(sd), 120, .037, .034, 16, .03, 0, 1));
      L.push(rope(G.S, path(sd), 120, .026, .024, 16, .014, 2.1, .88)); }
    out.frillRig = scaleG(mergeG(L), U); return out; },
};

/** serpentine rope along a path on the torso: path(t) -> [theta, y, hem]; r = tube radius, A = in-surface wave amplitude,
 *  k = waves, off = standoff from the surface, ph = wave phase, sc = path scale about the start (1 = same path). H units. */
function rope(S, path, M, r, A, k, off, ph, sc){ const pts = [], T = new THREE.Vector3(), B = new THREE.Vector3();
  for(let i = 0; i <= M; i++){ const t = i / M, [a, y, hem = 0] = path(t), { p, n } = S(a, y), e = .5 / M;
    const [a1, y1] = path(Math.min(1, t + e)), [a0, y0] = path(Math.max(0, t - e)); B.copy(S(a1, y1).p).sub(S(a0, y0).p).normalize(); T.crossVectors(n, B).normalize();
    const env = Math.min(1, Math.sin(Math.PI * t) * 9) ** .6, wv = Math.sin(t * k * TAU + ph), wv2 = Math.cos(t * k * TAU * .5 + ph * 1.7);
    const lat = A * env * wv * (1 + .5 * hem), out = off + .016 * env * wv + .006 * env * wv2;
    pts.push([p.x + n.x * out + T.x * lat, p.y + n.y * out + T.y * lat - .022 * hem * env, p.z + n.z * out + T.z * lat]); }
  return tube(pts, u => r * (.6 + .4 * Math.min(1, Math.sin(Math.PI * u) * 5)) * (1 + .12 * Math.sin(u * k * TAU + ph + 1.1)), Math.round(M * 1.6), 8); }
/** ruffled flange along a path on the torso: path(t) -> [theta, y]; w = width out from the surface, th = half thickness,
 *  A = wave amplitude at the outer edge (along the flange normal), k = number of waves. H units. */
function ruffle(S, path, M, w, th, A, k, side){ const C = 12, pos = [], idx = [], T = new THREE.Vector3(), B = new THREE.Vector3();
  for(let i = 0; i <= M; i++){ const t = i / M, [a, y, hem = 0] = path(t), { p, n } = S(a, y), env = Math.min(1, Math.sin(Math.PI * t) * 6) ** .5;
    const e = .5 / M, [a1, y1] = path(Math.min(1, t + e)), [a0, y0] = path(Math.max(0, t - e)); B.copy(S(a1, y1).p).sub(S(a0, y0).p).normalize();
    T.crossVectors(n, B).normalize();   // flange normal: across the strip, so the ruffle waves read on vertical AND horizontal runs
    const ww = w * env * (.85 + .15 * Math.sin(t * 23)), wave = A * env * (1 + 1.2 * hem) * Math.sin(t * k * TAU), droop = .06 * hem;   // hem: bottom run droops like a skirt edge
    for(let j = 0; j < C; j++){ const f = j / C * TAU, cn = Math.cos(f), sn = Math.sin(f), r = (cn + 1) / 2;   // r: 0 at the body, 1 at the outer edge
      const dn = ww * r - .006, dt = sn * th * env + wave * r * r;
      pos.push(p.x + n.x * dn + T.x * dt, p.y + .01 * r * Math.sin(t * k * TAU + 1.3) - droop * r, p.z + n.z * dn + T.z * dt); } }
  for(let i = 0; i < M; i++) for(let j = 0; j < C; j++){ const a = i * C + j, b = i * C + (j + 1) % C, c = a + C, d = b + C; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  fixWinding(g); return g; }

// ---------------------------------------------------------------- material helper
function mats(kind, V, ghost){
  const o = { rough: V.rough ?? .8, cc: .05, sheen: V.sheen ?? .3 }; if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const glsl = (PAINT[kind] || PAINT.echo)(V.U), paint = part => ({ key: 'b3' + kind, glsl, off: [0, 0, 0], part });
  const neck = { a: V.neck[0], b: V.neck[1] };
  return { o, body: clay(V.color, ghost, { ...o, paint: paint(0), neck }), plain: clay(V.color, ghost, o),
    paint, c: (hex, x = {}) => clay(hex, ghost, { ...o, ...x }) };
}

/** Build one batch-3 character (same contract as buildOllie / buildB2). D = installOllieV2 deps. */
export function buildB3(kind, { equipped = {}, ghost = false } = {}, D = {}){
  const V = B3[kind], G = geos(kind), U = V.U, M = mats(kind, V, ghost), black = gloss(ghost);
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const body = new THREE.Mesh((equipped.hat && G.bodyHat) ? G.bodyHat : G.body, M.body); rig.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.y = V.headY; rig.add(head); parts.head = head;
  neckTorso(body, M.body, head, V.headY, ghost); parts.headMesh = body;
  const HY = V.headY, addH = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); if(name) m.name = name; head.add(m); return m; };
  // ---- face (head-local)
  const eyeY = V.eye.y * U, ex = V.eye.x * U, eh = G.hit(ex, eyeY);
  for(const s of [-1, 1]){
    const eye = new THREE.Mesh(G.sphere, black); eye.name = 'eye'; eye.scale.set(...V.eye.s.map(v => v * U));
    const n = eh.n.clone(); n.x *= s; eye.position.set(eh.p.x * s - n.x * .012, eh.p.y - HY - n.y * .012, eh.p.z - n.z * .012);
    eye.quaternion.setFromUnitVectors(Zv, n); head.add(eye);
    const sh = new THREE.Mesh(G.sphere, shineMat()); sh.scale.set(.2, .2, .2); sh.position.set(.32, .38, .82); eye.add(sh); if(ghost) sh.visible = false;
  }
  if(V.smile){ const sg = G.smile || (G.smile = (() => { const t = new THREE.TorusGeometry(V.smile.w * U, V.smile.t * U, 8, 28, V.smile.arc); t.deleteAttribute('uv'); t.rotateZ(-Math.PI / 2 - V.smile.arc / 2); t.userData.shared = true; return t; })());
    const h = G.hit(0, V.smile.y * U), m = new THREE.Mesh(sg, black); m.position.set(h.p.x, h.p.y - HY + V.smile.w * U * .5, h.p.z - .006); m.quaternion.setFromUnitVectors(Zv, h.n); head.add(m); }
  // ---- accessory anchors from CLOTH_FIT
  const fit = clothFit(kind);
  const top = V.prof[V.prof.length - 1][0] * U, yb0 = top - .44, rb = radAt(G.prof, yb0);
  const hs = fit.hatScale != null ? fit.hatScale : rb * 1.06 / .47;
  const hatA = new THREE.Group();
  hatA.position.set(0, fit.hatY != null ? fit.hatY : (yb0 - .22 * hs - HY), fit.hatZ != null ? fit.hatZ : 0);
  hatA.scale.setScalar(hs); if(fit.hatTiltX) hatA.rotation.x = fit.hatTiltX;
  head.add(hatA); parts.hatAnchor = hatA;
  const es0 = Math.max(.75, eh.p.x / .2);
  const eS = fit.eyeScale != null ? (Array.isArray(fit.eyeScale) ? fit.eyeScale : [fit.eyeScale, fit.eyeScale, fit.eyeScale]) : [es0, es0, es0];
  const eyeA = new THREE.Group();
  eyeA.position.set(0, fit.eyeY != null ? fit.eyeY : (eh.p.y - HY - .15 * eS[1]), fit.eyeZ != null ? fit.eyeZ : (eh.p.z + .035 - .5 * eS[2]));
  eyeA.scale.set(eS[0], eS[1], eS[2]); head.add(eyeA); parts.eyeAnchor = eyeA;
  g.userData.fitDbg = { eyeY: +(eh.p.y - HY).toFixed(3), eyeZ: +eh.p.z.toFixed(3), eyeX: +eh.p.x.toFixed(3), es0: +es0.toFixed(3), headTop: +(top - HY).toFixed(3), rb: +rb.toFixed(3) };
  // ---- arms + feet
  const armM = kind === 'angie' ? clay(V.color, ghost, { ...M.o, paint: M.paint(2) }) : M.plain;
  for(const s of [-1, 1]){
    const shg = new THREE.Group(); shg.position.set(V.sh[0] * U * s, V.sh[1] * U, V.sh[2] * U); rig.add(shg); parts['sh' + s] = shg;
    const arm = new THREE.Mesh(G.arm, armM); arm.rotation.set(G.armR.rx, 0, G.armR.rz * s); if(s < 0) arm.scale.x = -1; shg.add(arm); parts['arm' + s] = arm;
    const F = V.foot, fM = F.color != null ? M.c(F.color) : M.plain;
    const foot = new THREE.Mesh(G.sphere, fM); foot.scale.set(...F.s.map(v => v * U)); foot.position.set(F.x * U * s, F.y * U, F.z * U); rig.add(foot); parts['foot' + s] = foot;
    if(F.toes){ const tM = M.c(F.toes); for(const k of [-1, 0, 1]){ const t = new THREE.Mesh(G.sphere, tM); t.scale.set(.3, .55, .3); t.position.set(.45 * k, -.2, .78 - .08 * Math.abs(k)); foot.add(t); } }
  }
  // ---- tail (Group for every species; empty where the mockup shows none)
  const tail = new THREE.Group(); tail.name = 'tailPivot'; rig.add(tail); parts.tail = tail;
  // ---- species features
  const F = G.feat, hideTop = !!equipped.hat;
  if(kind === 'angie'){ tail.position.set(0, .4 * U, -.27 * U); tail.add(new THREE.Mesh(F.tail, M.c(V.blue))); }
  if(kind === 'sharkie'){ tail.position.set(0, .2 * U, -.3 * U); tail.add(new THREE.Mesh(F.tail, M.plain)); }
  if(kind === 'polly'){ addH(F.plateHead, M.c(0xf4b23a, { rough: .7 })); addH(F.beakHead, M.c(0xf06a18, { rough: .7 })); addH(F.ridgeHead, M.c(0xf9c25a, { rough: .7 })); }
  if(kind === 'nudi'){ const om = M.c(V.orange, { sheenCol: 0xffd0a0 });
    for(const s of [-1, 1]){ const h = new THREE.Mesh(F.hornHead, om); h.name = 'gill'; h.position.set(s * .118 * U, .835 * U - HY, -.01 * U); h.rotation.set(-.12, 0, -s * .38); if(s < 0) h.scale.x = -1; h.visible = !hideTop; head.add(h); }
    // frill follows the neck blend like the torso (own tiny material clone, same cached program)
    const fm = clay(V.orange, ghost, { ...M.o, sheenCol: 0xffd0a0, neck: { a: V.neck[0], b: V.neck[1] } });
    const fr = new THREE.Mesh(F.frillRig, fm); fr.name = 'frill'; rig.add(fr); neckTorso(fr, fm, head, V.headY, ghost); fr.visible = !equipped.top; }
  g.traverse(m => { if(m.isMesh) m.userData.base = true; });
  if(D.setProfile) D.setProfile(clothProfile(G.prof, kind));
  const nPre = rig.children.length;
  if(!ghost && D.addEquipment) D.addEquipment(rig, parts, equipped);
  if(V.flat) for(let i = nPre; i < rig.children.length; i++) rig.children[i].scale.x *= V.flat;   // clothes slices are round: squash them to the flat body
  g.traverse(m => { if(m.isMesh) m.castShadow = !ghost; });
  g.userData.parts = parts; g.userData.walk = 0; g.userData.kind = kind; g.userData.v2 = 'C'; g.userData.animStyle = V.anim;
  return g;
}
function radAt(P, y){ for(let i = 1; i < P.length; i++) if(P[i].y >= y){ const a = P[i - 1], b = P[i]; return a.x + (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1); } return P[P.length - 1].x; }

/** Per-species clothing fit (rig units; hatY / eyeY / eyeZ head-local). Same fields as species-b2.js CLOTH_FIT, read by
 *  game.js addEquipmentOriginal and accessories-v2.js (yRange / slotScale / hide-shoes / pant trim hooks already live). */
export const CLOTH_FIT = {
  // Every batch-3 kind has an explicit entry (judged in the 72° portrait lobby camera, checked at 55° landscape).
  // Eyewear: lens centres sit on the eye beads (anchor = eye - 0.15*sy, lens plane just in front of the face; sx = eyeX / 0.2).
  squirt:  { teeBottom: .44, teeTop: .96, teeScale: 1.04,                 // tee ends under the smile (≈1.03)
             pantBottom: .24, pantTop: .44, pantScale: 1.06, pantTrim: null, // shorts ride the tentacle skirt
             shoes: 'feet', shoeScale: .9,                                // front tentacle tips are foot±1
             hatY: .47, hatScale: .72,                                    // small cap on the mantle tip
             eyeY: -.177, eyeZ: 0.0, eyeScale: [1.32, 1.05, 1.0], wristScale: .85, handScale: .85 },
  angie:   { teeBottom: .5, teeTop: .94, teeScale: 1.02, pantBottom: .2, pantTop: .5, pantScale: 1.04, pantTrim: null,
             shoes: 'feet', shoeScale: .9,
             hatY: .4, hatScale: .76,                                     // dorsal crest is dropped while a hat is on (bodyHat)
             eyeY: -.239, eyeZ: .086, eyeScale: [1.24, 1.05, 1.0], wristScale: .85, handScale: .85 },
  bella:   { teeBottom: .6, teeTop: 1.2, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,
             hatY: .41, hatScale: 1.35,                                   // wide melon head: bigger cap, sits on the crown
             eyeY: .049, eyeZ: .124, eyeScale: [1.74, 1.15, 1.05], wristScale: 1, handScale: 1 },
  echo:    { teeBottom: .6, teeTop: 1.24, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,
             hatY: .45, hatScale: 1.05,
             eyeY: .027, eyeZ: -.062, eyeScale: [1.42, 1.1, 1.0], wristScale: 1, handScale: 1 },
  sharkie: { teeBottom: .52, teeTop: 1.0, teeScale: 1.04, pantBottom: .24, pantTop: .52, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,
             hatY: .29, hatScale: 1.28,                                   // dorsal fin is dropped while a hat is on (bodyHat)
             eyeY: -.099, eyeZ: .11, eyeScale: [2.01, 1.15, 1.05], wristScale: 1, handScale: 1 },
  polly:   { teeBottom: .6, teeTop: 1.16, teeScale: 1.04, pantBottom: .26, pantTop: .6, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,
             hatY: .38, hatScale: 1.2,
             eyeY: .066, eyeZ: .155, eyeScale: [1.54, 1.1, 1.0], wristScale: 1, handScale: 1 },
  wally:   { teeBottom: .56, teeTop: 1.1, teeScale: 1.04, pantBottom: .24, pantTop: .56, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,
             hatY: .19, hatScale: 1.28,                                   // spout is dropped while a hat is on (bodyHat)
             eyeY: -.05, eyeZ: .169, eyeScale: [1.27, 1.05, 1.0], wristScale: 1, handScale: 1 },
  nudi:    { teeBottom: .56, teeTop: 1.24, teeScale: 1.04, pantBottom: .24, pantTop: .56, pantScale: 1.05, pantTrim: null,
             shoes: 'feet', shoeScale: 1,                                 // side frill hides while a top is on (like Kelpie's ribbons)
             hatY: .32, hatScale: 1.18,                                   // horns hide under a hat
             eyeY: .04, eyeZ: .098, eyeScale: [1.36, 1.05, 1.0], wristScale: 1, handScale: 1 },
};
export function clothFit(kind){ return CLOTH_FIT[kind] || {}; }
export function clothProfile(P, kind){ let i = 0; while(i < P.length && P[i].x < .08) i++; const sk = P[Math.min(i, P.length - 1)], out = [];
  if(sk.y > .02) out.push(new THREE.Vector2(sk.x, 0)); for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  const fit = CLOTH_FIT[kind]; if(fit) Object.assign(out, fit);
  return out; }
export const B3_PROFILES = {};
export function b3Profile(kind){ return B3_PROFILES[kind] || (B3_PROFILES[kind] = geos(kind).prof); }
