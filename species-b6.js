// species-b6.js: batch-6 playables (Batch D: Gulliver 41, Iggy 42, Flip 46, Reef 48, Sal 49, Coral 50, Momo 60, Toro 62),
// built from the new clay hero mockups (mockups/<id>/hero.png, all 8 new in this batch) and the numbered chart designs (named/*.jpg).
// Same recipe as species-b5.js (Ollie C clay, ONE continuous torso lathe per character, same-colour static features merged
// INTO the torso so they bend with the neck-blend shader, patterns as fragment paint, everything cached per species,
// no skinned meshes, no per-frame allocations). Self-contained (helpers copied from species-b5.js, so b2..b5 do not change).
// Parts contract: rig, body, head, hatAnchor, eyeAnchor, sh+-1 > arm+-1, foot+-1, tail.
import * as THREE from 'three';
import { clay, gloss, shineMat, neckTorso, sstep } from './ollie-v2.js?v=20261127-3';

const rnd = (f, u) => u > .84 ? f(.84) * Math.sqrt(Math.max(0, 1 - ((u - .84) / .16) ** 2)) : f(u);
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
// prof rows: [y, rx, rz?, zc?] (H = fraction of the mockup figure height, U = rig units per H). neck/headY = rig units.
export const B6 = {
  gulliver: { name: 'Gulliver the Seagull', U: 2.3, color: 0xf7f6f1, sheen: .3, sheenCol: 0xffffff, rough: .84, rz: .9, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.29],[.13,.35],[.21,.375],[.31,.38],[.41,.37],[.51,.345],[.61,.31],[.69,.275],[.77,.24],[.84,.195],[.9,.13],[.94,.06],[.952,0]],
    neck: [1.24, 1.44], headY: 1.5, eye: { x: .105, y: .705, s: [.03, .036, .022] }, smile: null,
    sh: [.33, .44, -.01], arm: 'wingNub', armColor: 0xa9adb3, foot: { x: .14, y: .032, z: .11, s: [.1, .04, .14], color: 0xff8a1e, toes: 0xff8a1e }, anim: 'playful' },
  iggy: { name: 'Iggy the Marine Iguana', U: 2.3, color: 0x55604f, sheen: .26, sheenCol: 0xd8e8d0, rough: .86, rz: .88, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.29],[.13,.355],[.21,.385],[.31,.39],[.41,.38],[.51,.36],[.61,.335],[.69,.31],[.77,.28],[.84,.235],[.9,.17],[.94,.09],[.955,0]],
    neck: [1.24, 1.44], headY: 1.5, eye: { x: .135, y: .745, s: [.031, .037, .023] }, smile: null,
    sh: [.36, .44, 0], arm: 'stub', foot: { x: .16, y: .044, z: .07, s: [.11, .062, .13] }, cream: 0xf0e2c2, anim: 'chunky' },
  flip: { name: 'Flip the Flounder', U: 2.3, color: 0xd8b68c, sheen: .26, sheenCol: 0xfff0d8, rough: .86, rz: .78, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.29],[.13,.355],[.21,.385],[.31,.395],[.41,.39],[.51,.375],[.61,.35],[.69,.32],[.77,.285],[.84,.24],[.9,.175],[.945,.095],[.962,0]],
    neck: [1.24, 1.44], headY: 1.5, eye: { x: .132, y: .735, s: [.044, .052, .034] }, smile: null,
    sh: [.37, .46, 0], arm: 'stub', armPaint: true, foot: { x: .15, y: .044, z: .06, s: [.1, .06, .12] }, anim: 'calm' },
  reef: { name: 'Reef the Parrotfish', U: 2.3, color: 0x2bb7a8, sheen: .3, sheenCol: 0xc8fff4, rough: .8, rz: .88, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.29],[.13,.35],[.21,.375],[.31,.38],[.41,.37],[.51,.35],[.61,.32],[.69,.29],[.77,.255],[.84,.21],[.9,.15],[.94,.075],[.953,0]],
    neck: [1.24, 1.44], headY: 1.5, eye: { x: .125, y: .72, s: [.03, .036, .022] }, smile: null,
    sh: [.35, .46, 0], arm: 'pec', foot: { x: .15, y: .044, z: .06, s: [.1, .062, .125] }, beak: 0xf26a8d, anim: 'playful' },
  sal: { name: 'Sal the Salmon', U: 2.3, color: 0xa9aeb4, sheen: .32, sheenCol: 0xffffff, rough: .8, rz: .88, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.3],[.13,.365],[.21,.395],[.31,.4],[.41,.39],[.51,.365],[.61,.33],[.69,.295],[.77,.255],[.84,.205],[.9,.145],[.94,.07],[.952,0]],
    neck: [1.24, 1.44], headY: 1.5, eye: { x: .11, y: .72, s: [.031, .037, .023] }, smile: { y: .67, w: .028, t: .0048, arc: 2.2 },
    sh: [.37, .44, 0], arm: 'pec', foot: { x: .15, y: .044, z: .06, s: [.1, .062, .125] }, anim: 'playful' },
  coral: { name: 'Coral the Lionfish', U: 2.3, color: 0xf4e3c4, sheen: .28, sheenCol: 0xfff6e8, rough: .84, rz: .88, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.18],[.08,.29],[.13,.35],[.21,.375],[.31,.38],[.41,.37],[.51,.345],[.6,.31],[.68,.27],[.75,.225],[.81,.17],[.86,.1],[.885,.04],[.892,0]],
    neck: [1.16, 1.36], headY: 1.42, eye: { x: .11, y: .62, s: [.031, .037, .023] }, smile: { y: .575, w: .026, t: .0046, arc: 2.2 },
    sh: [.36, .42, 0], arm: 'stub', foot: { x: .15, y: .044, z: .06, s: [.1, .062, .125] }, rust: 0xc8572e, anim: 'calm' },
  momo: { name: 'Momo the Sunfish', U: 2.3, color: 0xb6bbc2, sheen: .3, sheenCol: 0xffffff, rough: .82, rz: .8, seg: 112, rows: 120,
    prof: [[.07,0],[.075,.2],[.11,.31],[.18,.38],[.27,.415],[.37,.43],[.47,.425],[.57,.405],[.66,.365],[.74,.305],[.8,.225],[.84,.14],[.862,.06],[.868,0]],
    neck: [1.06, 1.24], headY: 1.3, eye: { x: .125, y: .5, s: [.031, .037, .023] }, smile: { y: .455, w: .028, t: .0048, arc: 2.2 },
    sh: [.42, .4, 0], arm: 'pec', foot: { x: .14, y: .044, z: .03, s: [.1, .066, .12] }, anim: 'chunky' },
  toro: { name: 'Toro the Tuna', U: 2.2, color: 0x2b4ca0, sheen: .32, sheenCol: 0xc8d8ff, rough: .8, rz: .86, seg: 112, rows: 130,
    prof: [[.04,0],[.045,.15],[.07,.235],[.12,.285],[.2,.305],[.3,.31],[.4,.305],[.5,.295],[.6,.28],[.7,.255],[.8,.22],[.88,.175],[.95,.12],[1.0,.06],[1.02,0]],
    neck: [1.36, 1.56], headY: 1.62, eye: { x: .1, y: .77, s: [.029, .035, .021] }, smile: { y: .72, w: .025, t: .0045, arc: 2.2 },
    sh: [.29, .5, 0], arm: 'pec', armColor: 0x2b4ca0, foot: { x: .14, y: .044, z: .06, s: [.095, .06, .12] }, anim: 'playful' },
};
export const BATCH6_IDS = Object.keys(B6);

// ---------------------------------------------------------------- torso deformations (H units)
const DEFORM = {};

// ---------------------------------------------------------------- paint (fragment) shaders; p = rig units, q = p / U. Colours are LINEAR.
const BLUSH = `float ck = zkAA((length(vec2((abs(q.x) - CX) / 0.04, (q.y - CY) / 0.028)) - 1.0) * 0.06) * smoothstep(0.1, 0.2, q.z);`;
const blush = (cx, cy) => BLUSH.replace('CX', cx.toFixed(3)).replace('CY', cy.toFixed(3));
const PAINT = {
  plain: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  gulliver: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float yb = 0.815 + 0.32 * abs(q.x) - 0.07 * (1.0 - smoothstep(-0.1, 0.12, q.z));   // grey cap with a peak down the forehead
  float cap = zkAA((yb - q.y) * 0.3);
  return mix(base, vec3(0.34, 0.355, 0.38), cap);
}`,
  iggy: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  flip: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float d = 0.0;   // darker, denser spots laid out like the mockup (clear muzzle / face centre)
  d = max(d, zkAA((length((q - vec3(0.07, 0.90, 0.10)) / vec3(1.0, 1.0, 0.9)) - 0.036) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.16, 0.88, 0.08)) / vec3(1.0, 1.0, 0.9)) - 0.042) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.22, 0.84, 0.06)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.11, 0.93, 0.00)) / vec3(1.0, 1.0, 0.9)) - 0.032) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.07, 0.91, 0.10)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.04, 0.94, -0.06)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.19, 0.80, 0.16)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.26, 0.76, 0.08)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.14, 0.84, 0.18)) / vec3(1.0, 1.0, 0.9)) - 0.022) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.15, 0.86, 0.12)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.22, 0.80, 0.08)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.08, 0.86, -0.18)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.20, 0.90, -0.08)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.18, 0.90, -0.04)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.00, 0.88, -0.20)) / vec3(1.0, 1.0, 0.9)) - 0.036) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.24, 0.70, 0.16)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.28, 0.64, 0.10)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.22, 0.66, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.020) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.24, 0.70, 0.16)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.28, 0.62, 0.08)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.18, 0.58, 0.24)) / vec3(1.0, 1.0, 0.9)) - 0.038) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.08, 0.50, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.032) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.10, 0.46, 0.28)) / vec3(1.0, 1.0, 0.9)) - 0.036) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.22, 0.42, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.00, 0.36, 0.32)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.14, 0.30, 0.26)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.16, 0.34, 0.26)) / vec3(1.0, 1.0, 0.9)) - 0.032) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.20, 0.24, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.06, 0.26, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.10, 0.18, 0.24)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.20, 0.52, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.16, 0.64, 0.20)) / vec3(1.0, 1.0, 0.9)) - 0.022) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.14, 0.60, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.26, 0.50, 0.12)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.26, 0.44, 0.12)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.12, 0.40, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.020) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.04, 0.54, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.022) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.04, 0.22, 0.28)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.16, 0.56, -0.22)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.16, 0.48, -0.24)) / vec3(1.0, 1.0, 0.9)) - 0.032) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.00, 0.40, -0.30)) / vec3(1.0, 1.0, 0.9)) - 0.036) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.22, 0.32, -0.18)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.20, 0.28, -0.20)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.08, 0.20, -0.24)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.12, 0.70, -0.22)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.10, 0.66, -0.24)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.00, 0.58, -0.28)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.30, 0.54, 0.06)) / vec3(1.0, 1.0, 0.9)) - 0.018) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.10, 0.44, 0.32)) / vec3(1.0, 1.0, 0.9)) - 0.016) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.22, 0.38, 0.20)) / vec3(1.0, 1.0, 0.9)) - 0.018) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.06, 0.32, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.016) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.24, 0.20, 0.16)) / vec3(1.0, 1.0, 0.9)) - 0.018) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.12, 0.16, 0.24)) / vec3(1.0, 1.0, 0.9)) - 0.020) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.18, 0.74, 0.10)) / vec3(1.0, 1.0, 0.9)) - 0.018) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.12, 0.74, 0.18)) / vec3(1.0, 1.0, 0.9)) - 0.016) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.28, 0.36, 0.16)) / vec3(1.0, 1.0, 0.9)) - 0.016) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.12, 0.42, 0.28)) / vec3(1.0, 1.0, 0.9)) - 0.034) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.08, 0.30, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.028) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.18, 0.24, 0.22)) / vec3(1.0, 1.0, 0.9)) - 0.026) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.06, 0.58, 0.28)) / vec3(1.0, 1.0, 0.9)) - 0.024) * 1.1));
  d = max(d, zkAA((length((q - vec3(-0.20, 0.36, 0.24)) / vec3(1.0, 1.0, 0.9)) - 0.030) * 1.1));
  d = max(d, zkAA((length((q - vec3(0.06, 0.38, 0.30)) / vec3(1.0, 1.0, 0.9)) - 0.022) * 1.1));
  float face = 1.0 - zkAA((length(vec2(q.x / 0.22, (q.y - 0.70) / 0.16)) - 1.0) * 0.25) * smoothstep(0.06, 0.18, q.z);
  return mix(base, vec3(0.22, 0.10, 0.035), d * face);
}`,
  reef: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float th = atan(q.x, q.z), yb = 0.79 + 0.022 * cos(th * 7.0) - 0.04 * (1.0 - smoothstep(-0.1, 0.1, q.z));   // pink cap, wavy lower edge
  return mix(base, vec3(0.89, 0.15, 0.27), zkAA((yb - q.y) * 0.3));
}`,
  sal: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.06, 0.16, q.z);
  float bl = zkAA((length(vec2(q.x / 0.25, (q.y - 0.36) / 0.24)) - 1.0) * 0.2) * front;   // coral-pink belly
  vec3 c = mix(base, vec3(0.87, 0.21, 0.15), bl);
  ${blush(.165, .665)}
  return mix(c, vec3(0.92, 0.32, 0.3), ck);
}`,
  coral: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float th = atan(q.x, q.z);
  float s = sin(abs(th) * 3.2 - 1.2 + q.y * 3.0);                       // curved rust bands, mirrored left/right
  float band = zkAA((0.68 - s) * 0.12);
  float face = 1.0 - zkAA((length(vec2(q.x / 0.19, (q.y - 0.6) / 0.15)) - 1.0) * 0.2) * smoothstep(0.08, 0.2, q.z);
  return mix(base, vec3(0.58, 0.1, 0.03), band * face);
}`,
  momo: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  ${blush(.2, .455)}
  return mix(base, vec3(0.92, 0.36, 0.34), ck);
}`,
  toro: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float th = abs(atan(q.x, q.z)), w = 0.95 - 1.6 * max(0.0, q.y - 0.72);   // silver face + belly, navy back and crown
  float sv = zkAA((th - w) * 0.25) * (1.0 - smoothstep(0.05, 0.1, -q.y + 0.1));
  vec3 c = mix(base, vec3(0.66, 0.69, 0.74), sv);
  ${blush(.15, .715)}
  return mix(c, vec3(0.92, 0.36, 0.34), ck);
}`,
};

// ---------------------------------------------------------------- torso extras merged INTO the body mesh (H units)
const EXTRAS = {
  gulliver(S){ return []; },
  iggy(S){ const L = [];   // low crest of short ROUNDED bumps over the crown and down the back (no spikes)
    for(const y of [.95, .9, .84, .77, .7, .62, .54, .46]){ const th = y > .93 ? 0 : Math.PI, { p, n } = S(th, Math.min(y, .935)); const r = y > .8 ? .036 : .03;
      L.push(ell(r, r * 1.15, r, { p: [p.x + n.x * r * .35, p.y + n.y * r * .35 + (y > .93 ? .012 : 0), p.z + n.z * r * .35] }, 14, 10)); }
    for(const s of [-1, 1]) for(const [th, y] of [[.55, .87], [1.0, .84], [1.5, .8], [2.1, .83]]){ const { p, n } = S(s * th, y); L.push(ell(.026, .03, .026, { p: [p.x + n.x * .009, p.y + n.y * .009, p.z + n.z * .009] }, 12, 8)); }
    return L; },
  flip(S){ return []; },
  reef(S){ return []; },
  sal(S){ const { p, n } = S(Math.PI, .7); return [ell(.035, .04, .05, { p: [p.x, p.y, p.z + n.z * .012] }, 14, 10)]; },   // small adipose nub on the back
  coral(S){ return []; },
  momo(S){ const clavus = sideFin([[-.26, .72], [-.37, .62], [-.41, .46], [-.38, .3], [-.28, .2], [-.2, .3], [-.2, .62]], .12, .04);
    // broad swept rounded-triangle dorsal, thick in x, base pushed into the crown and back so it fuses with no gap (left out under a hat)
    const fin = sideFin([[-.10, .86], [-.14, .94], [-.18, .98], [-.24, .96], [-.30, .88], [-.34, .78], [-.32, .70], [-.22, .70], [-.14, .76], [-.10, .82]], .12, .04);
    return { base: [clavus], top: [fin] }; },
  toro(S){ return []; },
};

// ---------------------------------------------------------------- arms (arm-local, H units; the limb runs along -y)
const ARMS = {
  wingNub(){ return { g: flipper(.05, .155, .1, .35, .012), rz: .4, rx: 0 }; },
  pec(){ return { g: flipper(.045, .13, .085, .4, .012), rz: .7, rx: -.05 }; },
  stub(){ return { g: flipper(.055, .14, .095, .3, .014), rz: .45, rx: 0 }; },
};

// ---------------------------------------------------------------- build + cache
const GEO = {};
function geos(kind){
  if(GEO[kind]) return GEO[kind];
  const V = B6[kind], U = V.U, def = DEFORM[kind];
  const rowsD = profileRows(V.prof, V.rows, V.rz);
  const torsoH = lathe(rowsD, V.seg, def), S = sampler(rowsD, def);
  const ex = EXTRAS[kind] ? EXTRAS[kind](S) : [], extras = Array.isArray(ex) ? ex : ex.base, topX = Array.isArray(ex) ? [] : ex.top;
  const G = { S, U };
  G.body = scaleG(mergeG([torsoH, ...extras, ...topX]), U);
  if(topX.length) G.bodyHat = scaleG(mergeG([lathe(rowsD, V.seg, def), ...extras]), U);   // head-top knobs left out under a hat
  G.prof = rowsD.map(r => new THREE.Vector2(Math.max(r[1], r[2]) * U, r[0] * U));
  G.sphere = sph(28, 18);
  const A = ARMS[V.arm](); G.arm = scaleG(A.g, U); G.armR = A;
  const mesh = new THREE.Mesh(scaleG(lathe(rowsD, V.seg, def), U)); const rc = new THREE.Raycaster();   // torso only
  G.hit = (x, y) => { rc.set(new THREE.Vector3(x, y, 9), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(mesh, false)[0];
    if(!h) return { p: new THREE.Vector3(x, y, 0), n: Zv.clone() }; return { p: h.point.clone(), n: h.face.normal.clone() }; };
  G.S = S; G.feat = FEAT[kind] ? FEAT[kind](G, V) : {};
  Object.values(G).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  Object.values(G.feat).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  return (GEO[kind] = G);
}
const hl = (g, U, V, h, dz = 0) => { const s = scaleG(g, U); s.translate(h.p.x, h.p.y - V.headY, h.p.z + dz * U); return s; };   // H-local geometry -> head-local at hit point

// feature geometries (rig units). *Head = head-local, *Rig = rig-local, tail = tail-local.
const FEAT = {
  gulliver(G, V){ const U = V.U, h = G.hit(0, .64 * U), o = {};
    const b = tube([[0, .012, -.03], [0, 0, .06], [0, -.016, .125]], u => .07 - .04 * u, 18, 14); b.scale(1.15, .74, 1);   // short slim blunt cone bill
    o.billHead = hl(b, U, V, h, -.004); return o; },
  iggy(G, V){ const U = V.U, h = G.hit(0, .64 * U), o = {};
    o.snoutHead = hl(ell(.19, .095, .075, { p: [0, 0, -.035] }, 28, 18), U, V, h, 0);   // wide cream muzzle
    o.noseHead = hl(ell(.048, .032, .032, { p: [0, .028, .038] }, 16, 10), U, V, h, 0);
    const t = new THREE.TorusGeometry(.024, .0042, 8, 22, 2.2); t.deleteAttribute('uv'); t.rotateZ(-Math.PI / 2 - 1.1); t.translate(0, -.03, .043);
    o.mouthHead = hl(t, U, V, h, 0);
    const tl = tube([[0, 0, .06], [0, -.04, -.08], [.03, -.08, -.2], [.08, -.1, -.28]], u => .085 - .06 * u, 24, 12);
    const bumps = [0.2, .4, .6, .8].map(u => ell(.022, .026, .022, { p: [.03 * u * u, .07 - .1 * u - .03 * u, .02 - .3 * u] }, 10, 8));
    o.tail = scaleG(mergeG([tl, ...bumps]), U); return o; },
  flip(G, V){ const U = V.U, h = G.hit(0, .66 * U), o = {};
    o.snoutHead = hl(ell(.16, .10, .062, { p: [0, -.02, .01] }, 28, 18), U, V, h, 0);   // wide, short, rounded seal muzzle
    const t = new THREE.TorusGeometry(.036, .0055, 8, 24, 2.15); t.deleteAttribute('uv'); t.rotateZ(-Math.PI / 2 - 1.075); t.translate(0, -.048, .052);
    o.mouthHead = hl(t, U, V, h, 0); return o; },
  reef(G, V){ const U = V.U, h = G.hit(0, .64 * U), o = {};
    const up = tube([[0, .03, -.03], [0, .02, .04], [0, -.015, .085], [0, -.055, .085]], u => .068 - .03 * u, 22, 14); up.scale(1.12, 1, 1);   // thick hooked wedge beak
    o.beakHead = hl(mergeG([up, ell(.05, .03, .045, { p: [0, -.045, .02] }, 18, 12)]), U, V, h, -.004);
    o.tail = scaleG(sideFin([[.02, -.05], [-.07, -.07], [-.13, -.1], [-.12, 0], [-.13, .1], [-.07, .07], [.02, .05]], .05, .02), U); return o; },
  sal(G, V){ const U = V.U;
    const f = sideFin([[.02, -.05], [-.08, -.08], [-.16, -.15], [-.21, -.08], [-.22, 0], [-.21, .08], [-.16, .15], [-.08, .08], [.02, .05]], .04, .016);
    return { tail: scaleG(f, U) }; },
  coral(G, V){ const U = V.U, Hy = V.headY / U, L = [];   // fan of 6 THICK rounded blades joined at the base, over the crown and down the back
    const C = [0, .5, -.04];
    for(const deg of [0, 20, 40, 60, 80, 100, 120]){ const a = deg * Math.PI / 180, d = [0, Math.cos(a), -Math.sin(a)];
      const P = r => [C[0], C[1] + d[1] * r, C[2] + d[2] * r]; const bl = tube([P(.28), P(.36), P(.45)], u => .07 - .012 * u, 14, 12); bl.scale(.8, 1, 1); L.push(bl); }
    const g = mergeG(L); g.translate(0, -Hy, 0);
    const tl = sideFin([[.02, -.04], [-.07, -.07], [-.12, -.05], [-.12, .05], [-.07, .07], [.02, .04]], .04, .016);
    return { fanHead: scaleG(g, U), tail: scaleG(tl, U) }; },
  momo(G, V){ return {}; },
  toro(G, V){ const U = V.U, L = [];   // row of small yellow rounded finlets down the back
    for(const y of [.32, .41, .5, .59, .68, .77]){ const { p, n } = G.S(Math.PI, y); L.push(tube([[p.x, p.y, p.z + .015], [p.x, p.y - .02, p.z - .075]], u => .03 - .014 * u, 8, 10)); }
    return { finRig: scaleG(mergeG(L), U) }; },
};

// ---------------------------------------------------------------- per-species build hooks (features, tails, extra parts)
const POST = {
  gulliver(c){ const { G, M, addH } = c; addH(G.feat.billHead, M.c(0xffb21f)); },
  iggy(c){ const { G, V, U, M, addH, tail } = c; addH(G.feat.snoutHead, M.c(V.cream)); addH(G.feat.noseHead, M.c(0x1c1a18, { rough: .5 })); addH(G.feat.mouthHead, c.black);
    tail.position.set(.04 * U, .12 * U, -.3 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
  flip(c){ const { G, M, addH } = c; addH(G.feat.snoutHead, M.plain); addH(G.feat.mouthHead, c.black); },
  reef(c){ const { G, V, U, M, addH, tail } = c; addH(G.feat.beakHead, M.c(V.beak)); tail.position.set(0, .2 * U, -.33 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
  sal(c){ const { G, U, M, tail } = c; tail.position.set(0, .36 * U, -.37 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
  coral(c){ const { G, V, U, M, head, tail } = c; const f = new THREE.Mesh(G.feat.fanHead, M.c(V.rust)); f.name = 'fan'; head.add(f); c.parts.fan = f;
    tail.position.set(0, .14 * U, -.33 * U); tail.add(new THREE.Mesh(G.feat.tail, M.c(V.rust))); },
  toro(c){ const { G, M, rig } = c; rig.add(new THREE.Mesh(G.feat.finRig, M.c(0xf2c12e))); },
};

// ---------------------------------------------------------------- material helper
function mats(kind, V, ghost){
  const o = { rough: V.rough ?? .8, cc: .05, sheen: V.sheen ?? .3 }; if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const glsl = (PAINT[kind] || PAINT.plain)(V.U), paint = part => ({ key: 'b6' + kind, glsl, off: [0, 0, 0], part });
  const neck = { a: V.neck[0], b: V.neck[1] };
  return { o, body: clay(V.color, ghost, { ...o, paint: paint(0), neck }), plain: clay(V.color, ghost, o),
    paint, c: (hex, x = {}) => clay(hex, ghost, { ...o, ...x }) };
}

/** Build one batch-6 character (same contract as buildOllie / buildB3). D = installOllieV2 deps. */
export function buildB6(kind, { equipped = {}, ghost = false } = {}, D = {}){
  const V = B6[kind], G = geos(kind), U = V.U, M = mats(kind, V, ghost), black = gloss(ghost);
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const body = new THREE.Mesh((equipped.hat && G.bodyHat) ? G.bodyHat : G.body, M.body); rig.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.y = V.headY; rig.add(head); parts.head = head;
  neckTorso(body, M.body, head, V.headY, ghost); parts.headMesh = body;
  const HY = V.headY, addH = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); if(name) m.name = name; head.add(m); return m; };
  // ---- face (head-local)
  const eyeY = V.eye.y * U, ex = V.eye.x * U, eh = V.eye.pos ? { p: new THREE.Vector3(ex, eyeY + .005 * U, (.02 + .05) * U), n: Zv.clone() } : G.hit(ex, eyeY);
  if(!V.eye.pos) for(const s of [-1, 1]){
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
  const armM = V.armColor != null ? M.c(V.armColor) : V.armPaint ? clay(V.color, ghost, { ...M.o, paint: M.paint(0) }) : M.plain;
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
  if(POST[kind]) POST[kind]({ G, V, U, M, rig, head, parts, tail, addH, black, ghost, equipped });
  g.traverse(m => { if(m.isMesh) m.userData.base = true; });
  if(D.setProfile) D.setProfile(clothProfile(G.prof, kind));
  const nPre = rig.children.length;
  if(!ghost && D.addEquipment) D.addEquipment(rig, parts, equipped);
  if(V.cloth) for(let i = nPre; i < rig.children.length; i++){ rig.children[i].scale.x *= V.cloth[0]; rig.children[i].scale.z *= V.cloth[1]; }   // round clothing slices -> oval body
  if(V.clothZ) for(let i = nPre; i < rig.children.length; i++) rig.children[i].position.z += V.clothZ * U;   // forward belly: centre the clothes on it
  g.traverse(m => { if(m.isMesh) m.castShadow = !ghost; });
  g.userData.parts = parts; g.userData.walk = 0; g.userData.kind = kind; g.userData.v2 = 'C'; g.userData.animStyle = V.anim;
  return g;
}
function radAt(P, y){ for(let i = 1; i < P.length; i++) if(P[i].y >= y){ const a = P[i - 1], b = P[i]; return a.x + (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1); } return P[P.length - 1].x; }


/** Per-species clothing fit (rig units; hatY / eyeY / eyeZ head-local). Same fields as species-b3.js .. b5 CLOTH_FIT. */
export const CLOTH_FIT = {
  gulliver: { teeBottom: 0.58, teeTop: 1.12, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.58, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .95, hatY: .42, hatScale: .9, wristScale: .9, handScale: .9 },
  iggy:     { teeBottom: 0.58, teeTop: 1.12, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.58, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .44, hatScale: .95, wristScale: .9, handScale: .9 },
  flip:     { teeBottom: 0.58, teeTop: 1.12, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.58, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .44, hatScale: .95, wristScale: .9, handScale: .9 },
  reef:     { teeBottom: 0.58, teeTop: 1.1, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.58, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .42, hatScale: .9, wristScale: .9, handScale: .9 },
  sal:      { teeBottom: 0.58, teeTop: 1.12, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.58, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .42, hatScale: .9, wristScale: .9, handScale: .9 },
  coral:    { teeBottom: 0.56, teeTop: 1.06, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.56, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .36, hatScale: .85, hatZ: .04, wristScale: .9, handScale: .9 },
  momo:     { teeBottom: 0.5, teeTop: 0.9, teeScale: 1.04, pantBottom: 0.24, pantTop: 0.5, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1, hatY: .45, hatScale: 1.0, wristScale: .9, handScale: .9 },
  toro:     { teeBottom: 0.6, teeTop: 1.2, teeScale: 1.04, pantBottom: 0.26, pantTop: 0.6, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .95, hatY: .36, hatScale: .78, wristScale: .9, handScale: .9 },
};
export function clothFit(kind){ return CLOTH_FIT[kind] || {}; }
export function clothProfile(P, kind){ let i = 0; while(i < P.length && P[i].x < .08) i++; const sk = P[Math.min(i, P.length - 1)], out = [];
  if(sk.y > .02) out.push(new THREE.Vector2(sk.x, 0)); for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  const fit = CLOTH_FIT[kind]; if(fit) Object.assign(out, fit);
  return out; }
export const B6_PROFILES = {};
export function b6Profile(kind){ return B6_PROFILES[kind] || (B6_PROFILES[kind] = geos(kind).prof); }
