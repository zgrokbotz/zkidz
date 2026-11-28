// species-b4.js: batch-4 playables (Batch B: Pinchy 6, Tusk 7, Mo 8, Gus 9, Zippy 12, Puff 14, Shelly 15, Coco 16),
// built from the approved hero mockups (mockups/<id>/hero.png) and the numbered chart designs (named/*.jpg).
// Same recipe as species-b3.js (Ollie C clay, ONE continuous torso lathe per character, same-colour static features merged
// INTO the torso so they bend with the neck-blend shader, patterns as fragment paint, everything cached per species,
// no skinned meshes, no per-frame allocations). Self-contained (helpers copied from species-b3.js, so the live b2/b3
// modules do not change). Parts contract: rig, body, head, hatAnchor, eyeAnchor, sh+-1 > arm+-1, foot+-1, tail.
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
// prof rows: [y, rx, rz?, zc?] (H = fraction of the mockup figure height, U = rig units per H). neck/headY = rig units.
// eye.pos (optional) = fixed head eye point in H (stalk eyes); cloth = [sx, sz] squash for round clothing slices.
export const B4 = {
  pinchy: { name: 'Pinchy the Crab', U: 2.3, color: 0xe8352a, sheen: .3, sheenCol: 0xffc0b0, rough: .8, rz: 1, seg: 112, rows: 100,
    prof: [[.1,0,0],[.104,.2,.13],[.13,.31,.2],[.18,.36,.236],[.25,.382,.25],[.32,.376,.246],[.4,.35,.23],[.46,.3,.2],[.51,.222,.15],[.543,.12,.082],[.556,0,0]],
    neck: [1.06, 1.24], headY: 1.2, eye: { x: .12, y: .7, s: [.03, .036, .022], pos: true }, smile: { y: .36, w: .045, t: .005, arc: 2.0 },
    sh: [.33, .34, .0], arm: 'claw', foot: { x: .25, y: .04, z: .1, s: [.07, .05, .085] }, cloth: [1, .66], anim: 'playful' },
  tusk: { name: 'Tusk the Walrus', U: 2.3, color: 0x7b4a2c, sheen: .26, sheenCol: 0xd8b090, rough: .86, rz: .9, seg: 112, rows: 120,
    prof: [[.04,0],[.045,.18],[.07,.285],[.12,.345],[.2,.372],[.3,.376],[.4,.364],[.5,.34],[.6,.31],[.7,.276],[.78,.242],[.85,.196],[.91,.136],[.955,.072],[.975,0]],
    neck: [1.2, 1.38], headY: 1.44, eye: { x: .115, y: .78, s: [.03, .036, .022] }, smile: null,
    sh: [.33, .5, .0], arm: 'stub', foot: { x: .16, y: .044, z: .08, s: [.11, .066, .13] }, anim: 'chunky' },
  mo: { name: 'Mo the Manatee', U: 2.3, color: 0x9ea9a0, sheen: .3, sheenCol: 0xe8eee4, rough: .86, rz: .88, seg: 112, rows: 120,
    prof: [[.04,0],[.045,.17],[.07,.27],[.12,.33],[.2,.358],[.3,.362],[.4,.352],[.5,.334],[.6,.31],[.7,.282],[.78,.252],[.85,.21],[.91,.15],[.955,.082],[.978,0]],
    neck: [1.22, 1.4], headY: 1.46, eye: { x: .13, y: .8, s: [.03, .036, .022] }, smile: { y: .655, w: .026, t: .0046, arc: 2.2 },
    sh: [.32, .52, .0], arm: 'moFlipper', foot: { x: .155, y: .044, z: .07, s: [.12, .066, .14] }, anim: 'calm' },
  gus: { name: 'Gus the Pelican', U: 2.25, color: 0xf6f4ee, sheen: .34, sheenCol: 0xffffff, rough: .86, rz: .92, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.17],[.08,.27],[.12,.325],[.2,.355],[.3,.36],[.4,.346],[.5,.316],[.6,.282],[.7,.25],[.78,.226],[.85,.2],[.91,.165],[.95,.12],[.975,.062],[.986,0]],
    neck: [1.25, 1.42], headY: 1.48, eye: { x: .148, y: .835, s: [.03, .036, .022] }, smile: null,
    sh: [.33, .5, -.02], arm: 'gusWing', foot: { x: .15, y: .036, z: .1, s: [.11, .05, .15], color: 0xf39a1e, toes: 0xe8860e }, anim: 'chunky' },
  zippy: { name: 'Zippy the Zebrafish', U: 2.25, color: 0xf3ead0, sheen: .3, sheenCol: 0xffffff, rough: .84, rz: .9, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.17],[.08,.28],[.12,.34],[.2,.376],[.3,.39],[.4,.386],[.5,.37],[.6,.344],[.7,.304],[.78,.258],[.85,.2],[.91,.136],[.955,.072],[.975,0]],
    neck: [1.2, 1.38], headY: 1.44, eye: { x: .12, y: .68, s: [.033, .04, .024] }, smile: { y: .64, w: .026, t: .0046, arc: 2.2 },
    sh: [.36, .42, .0], arm: 'fan', armColor: 0x2c63d6, foot: { x: .15, y: .046, z: .05, s: [.1, .07, .12], color: 0x2c63d6 }, blue: 0x2c63d6, anim: 'playful' },
  puff: { name: 'Puff the Pufferfish', U: 2.2, color: 0xffcf2a, sheen: .3, sheenCol: 0xfff0b0, rough: .82, rz: .94, seg: 112, rows: 110,
    prof: [[.06,0],[.064,.14],[.09,.26],[.14,.34],[.22,.398],[.32,.43],[.42,.436],[.52,.424],[.62,.39],[.7,.338],[.77,.26],[.82,.16],[.845,.07],[.852,0]],
    neck: [1.32, 1.5], headY: 1.5, eye: { x: .135, y: .5, s: [.036, .043, .026] }, smile: { y: .44, w: .03, t: .005, arc: 2.2 },
    sh: [.4, .42, -.02], arm: 'fan', armColor: 0xffb31f, foot: { x: .14, y: .05, z: .06, s: [.085, .06, .1] }, anim: 'chunky' },
  shelly: { name: 'Shelly the Sea Turtle', U: 2.25, color: 0x7cc45a, sheen: .3, sheenCol: 0xe0ffd0, rough: .84, rz: .92, seg: 112, rows: 130,
    prof: [[.05,0],[.055,.15],[.08,.235],[.13,.28],[.2,.3],[.3,.302],[.4,.288],[.47,.262],[.52,.228],[.56,.215,.215,.02],[.62,.248,.248,.03],[.7,.27,.27,.03],[.78,.272,.272,.03],[.86,.25,.25,.02],[.93,.2,.2,.01],[.975,.12,.12,0],[.995,0,0,0]],
    neck: [1.06, 1.26], headY: 1.34, eye: { x: .108, y: .8, s: [.032, .039, .024] }, smile: { y: .735, w: .03, t: .005, arc: 2.2 },
    sh: [.28, .4, .02], arm: 'shellyFlipper', foot: { x: .14, y: .05, z: .06, s: [.1, .075, .12] }, shell: 0x3f8a3c, anim: 'calm' },
  coco: { name: 'Coco the Seahorse', U: 2.3, color: 0xff7a22, sheen: .3, sheenCol: 0xffd0a8, rough: .82, rz: .92, seg: 112, rows: 130,
    prof: [[.06,0,0,.01],[.065,.13,.13,.02],[.09,.2,.2,.03],[.15,.236,.25,.045],[.25,.25,.27,.05],[.35,.24,.262,.045],[.45,.212,.23,.03],[.55,.18,.19,.01],[.62,.172,.176,0],[.7,.196,.2,0],[.78,.206,.212,0],[.86,.19,.196,-.01],[.92,.15,.156,-.02],[.96,.09,.094,-.025],[.978,0,0,-.03]],
    neck: [1.3, 1.5], headY: 1.56, eye: { x: .1, y: .82, s: [.031, .037, .023] }, smile: null,
    sh: [.22, .44, .02], arm: 'cocoFin', foot: { x: .12, y: .05, z: .07, s: [.085, .06, .1] }, belly: 0xf8c8a2, clothZ: .04, anim: 'playful' },
};
export const BATCH4_IDS = Object.keys(B4);

// ---------------------------------------------------------------- torso deformations (H units)
const DEFORM = {};

// ---------------------------------------------------------------- paint (fragment) shaders; p = rig units, q = p / U
const PAINT = {
  plain: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  zippy: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float s = (abs(fract((q.y - 0.052) / 0.092) - 0.5) - 0.24) * 0.3;   // horizontal blue bands, cream crown
  float b = zkAA(s) * (1.0 - smoothstep(0.83, 0.85, q.y));
  return mix(base, vec3(0.03, 0.16, 0.66), b);
}`,
  shelly: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 q = p / ${U.toFixed(3)};
  if(part > 0.5){   // back shell: darker scutes with soft light seams (centre plate ring + radial seams)
    vec2 c = vec2(q.x / 0.3, (q.y - 0.33) / 0.27); float r = length(c), a = atan(c.x, c.y);
    float seam = max(1.0 - smoothstep(0.015, 0.04, abs(r - 0.48) * 0.5), (1.0 - smoothstep(0.03, 0.09, abs(sin(a * 3.0)))) * step(0.48, r) * (1.0 - step(0.98, r)));
    return mix(base, base * 1.45 + vec3(0.04, 0.06, 0.0), seam * 0.8); }
  float front = smoothstep(0.02, 0.12, q.z);
  float pl = zkAA((length(vec2(q.x / 0.205, (q.y - 0.27) / 0.2)) - 1.0) * 0.2) * front * step(q.y, 0.5);
  float ln = max(1.0 - smoothstep(0.004, 0.009, abs(q.x)), 1.0 - smoothstep(0.004, 0.009, abs(fract((q.y - 0.17) / 0.09) - 0.5) * 0.09 - 0.036));
  vec3 cream = mix(vec3(0.93, 0.86, 0.6), vec3(0.66, 0.56, 0.3), ln);
  return mix(base, cream, pl);
}`,
  coco: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.08, 0.18, q.z);
  float bl = zkAA((length(vec2(q.x / 0.15, (q.y - 0.33) / 0.24)) - 1.0) * 0.2) * front;
  float band = 1.0 - smoothstep(0.003, 0.007, abs(fract((q.y - 0.12) / 0.06) - 0.5) * 0.06 - 0.025);
  vec3 cream = mix(vec3(0.98, 0.8, 0.66), vec3(0.93, 0.62, 0.46), band * 0.8);
  return mix(base, cream, bl);
}`,
};

// ---------------------------------------------------------------- torso extras merged INTO the body mesh (H units)
const EXTRAS = {
  pinchy(S){ const L = [];
    // three walking legs per side (thick bent clay tubes from the body rim to pointed-round tips on the floor)
    for(const s of [-1, 1]) for(const [a, out] of [[1.42, .17], [1.82, .15], [2.2, .12]]){
      const d = [Math.sin(a) * s, Math.cos(a)], P = (r, y) => [d[0] * r, y, d[1] * r];
      L.push(tube([P(.3, .2), P(.38 + out * .3, .22), P(.42 + out * .5, .14), P(.44 + out * .5, .06), P(.43 + out * .5, .02)], u => .045 - .02 * u, 20, 10)); }
    // front legs run into foot+-1
    for(const s of [-1, 1]) L.push(tube([[s * .26, .2, .14], [s * .33, .2, .17], [s * .3, .1, .14], [s * .26, .05, .11]], u => .045 - .008 * u, 18, 10));
    return L; },
  tusk(S){ return []; },
  mo(S){ return []; },
  gus(S){ return { base: [], top: [ell(.055, .05, .06, { p: [0, .975, -.01] }, 18, 12)] }; },   // head bump (dropped under a hat)
  zippy(S){ return []; },
  puff(S){ const L = [];
    const spike = (th, y, h = .06, r = .032) => { const { p, n } = S(th, y); L.push(tube([[p.x - n.x * .01, p.y - n.y * .01, p.z - n.z * .01], [p.x + n.x * h * .55, p.y + n.y * h * .55, p.z + n.z * h * .55], [p.x + n.x * h, p.y + n.y * h, p.z + n.z * h]], u => r * (1 - .9 * u * u), 6, 9, false)); };
    // short fat rounded spikes, golden-angle spread, kept off the face and the bottom
    const n = 46; for(let i = 0; i < n; i++){ const y = .16 + .64 * (i + .5) / n, th = i * 2.39996;
      if((Math.cos(th) > .5 && y > .3 && y < .64) || y > .8) continue; spike(th, y); }
    for(const [th, y] of [[0, .835], [1.3, .815], [-1.3, .815], [2.6, .815], [-2.6, .815]]) spike(th, y, .065, .034);
    return L; },
  shelly(S){ return []; },
  coco(S){ const L = [], T = [];
    // crown knobs along the top of the head (dropped under a hat) + a ridge of small knobs down the back
    for(const [z, y, r] of [[.07, .965, .034], [.0, .985, .04], [-.07, .975, .038], [-.13, .935, .034], [-.17, .87, .03]]) T.push(ell(r, r * 1.25, r, { p: [0, y, z] }, 14, 10));
    for(const [y, r] of [[.78, .026], [.7, .024], [.62, .022], [.52, .022], [.42, .02]]){ const { p } = S(Math.PI, y); L.push(ell(r * .8, r, r, { p: [0, y, p.z - .006] }, 12, 8)); }
    // dorsal fan fin on the back
    L.push(sideFin([[-.16, .5], [-.24, .56], [-.29, .5], [-.3, .42], [-.27, .36], [-.16, .38]], .035, .015));
    return { base: L, top: T }; },
};

// ---------------------------------------------------------------- arms (arm-local, H units; the limb runs along -y)
const ARMS = {
  // crab claw: short arm up to a big two-finger pincer (fingers open); +x local = up once raised
  claw(){ const L = [tube([[0, .02, 0], [0, -.08, 0], [.02, -.17, 0], [.03, -.22, 0]], u => .045 - .006 * u, 18, 10)];
    L.push(xf(ell(.072, .095, .055, {}, 22, 16), { p: [.035, -.3, 0] }));
    L.push(tube([[.0, -.36, 0], [-.025, -.42, 0], [-.01, -.47, 0]], u => .036 - .022 * u, 14, 10));   // inner finger
    L.push(tube([[.06, -.37, 0], [.075, -.44, 0], [.05, -.5, 0]], u => .048 - .03 * u, 14, 10));    // outer finger
    return { g: mergeG(L), rz: 2.45, rx: -.15 }; },
  stub(){ return { g: flipper(.06, .14, .1, .3, .014), rz: .45, rx: 0 }; },
  moFlipper(){ return { g: flipper(.055, .19, .1, .38, .016), rz: .28, rx: .02 }; },
  gusWing(){ const g = ell(.055, .18, .09, {}, 24, 18), p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) + .03 * (y / .18) ** 2 - .01); p.setZ(i, p.getZ(i) * (1 - .2 * Math.max(0, -y / .18))); } g.translate(0, -.14, 0); g.computeVertexNormals(); return { g, rz: .22, rx: .05 }; },
  fan(){ // fish pectoral: short stalk to a ribbed fan
    const L = [ell(.03, .05, .04, { p: [0, -.03, 0] }, 16, 12)];
    const f = sideFin([[0, 0], [-.05, -.06], [-.07, -.12], [-.03, -.16], [.03, -.16], [.07, -.12], [.05, -.06]], .028, .012); f.rotateY(Math.PI / 2); f.translate(0, -.02, 0); L.push(f);
    for(const a of [-.5, -.17, .17, .5]) L.push(tube([[0, -.04, .0], [Math.sin(a) * .075, -.04 - Math.cos(a) * .11, 0]], u => .011, 8, 6, false));
    return { g: mergeG(L), rz: .95, rx: -.2 }; },
  shellyFlipper(){ return { g: flipper(.055, .13, .09, .35, .014), rz: .5, rx: 0 }; },
  cocoFin(){ return { g: flipper(.035, .09, .07, .45, .01), rz: .7, rx: -.1 }; },
};

// ---------------------------------------------------------------- build + cache
const GEO = {};
function geos(kind){
  if(GEO[kind]) return GEO[kind];
  const V = B4[kind], U = V.U, def = DEFORM[kind];
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
  G.feat = FEAT[kind] ? FEAT[kind](G, V) : {};
  Object.values(G).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  Object.values(G.feat).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  return (GEO[kind] = G);
}
const hl = (g, U, V, h, dz = 0) => { const s = scaleG(g, U); s.translate(h.p.x, h.p.y - V.headY, h.p.z + dz * U); return s; };   // H-local geometry -> head-local at hit point
// feature geometries (rig units). *Head = head-local, *Rig = rig-local, tail = tail-local.
const FEAT = {
  pinchy(G, V){ const U = V.U, s = [];
    // eye stalks: red stalk + ball (one per side, built for +x; mirrored at build time); eye bead sits on the ball front
    const st = mergeG([tube([[0, .48, 0], [.008, .58, .01], [.012, .645, .015]], u => .028 - .006 * u, 14, 10), ell(.052, .052, .05, { p: [.012, .685, .02] }, 20, 14)]);
    st.translate(-.012, -.685, -.02); return { stalk: scaleG(st, U) }; },
  tusk(G, V){ const U = V.U, h = G.hit(0, .645 * U), o = {};
    o.padHead = hl(mergeG([ell(.085, .066, .06, { p: [-.066, 0, .0] }, 22, 16), ell(.085, .066, .06, { p: [.066, 0, .0] }, 22, 16)]), U, V, h, -.012);
    o.noseHead = hl(ell(.04, .026, .022, { p: [0, .052, .045] }, 16, 10), U, V, h, -.012);
    const W = []; for(const sd of [-1, 1]) for(const k of [0, 1, 2]){ const y = .015 - k * .022, x0 = sd * .05, x1 = sd * .118;
      W.push(tube([[x0, y, .058], [(x0 + x1) / 2, y - .004, .06], [x1, y - .01 - k * .006, .045]], u => .0045, 8, 5)); }
    o.whiskHead = hl(mergeG(W), U, V, h, -.012);
    const T = []; for(const sd of [-1, 1]) T.push(tube([[sd * .048, -.04, .04], [sd * .054, -.1, .05], [sd * .058, -.17, .045], [sd * .055, -.215, .035]], u => .024 - .011 * u, 18, 10));
    o.tuskHead = hl(mergeG(T), U, V, h, -.012); return o; },
  mo(G, V){ const U = V.U, h = G.hit(0, .7 * U), o = {};
    o.snoutHead = hl(ell(.13, .078, .07, {}, 26, 18), U, V, h, -.03);
    o.dotHead = hl(mergeG([ell(.012, .009, .008, { p: [-.035, .052, .045] }, 10, 8), ell(.012, .009, .008, { p: [.035, .052, .045] }, 10, 8),
      ...[-1, 1].flatMap(sd => [[.075, .015], [.095, -.005], [.07, -.02], [.1, .02]].map(([x, y]) => ell(.006, .006, .005, { p: [sd * x, y, .055 - Math.abs(x) * .25] }, 8, 6)))]), U, V, h, -.03);
    const W = []; for(const sd of [-1, 1]) for(const k of [0, 1]){ const y = .0 - k * .022; W.push(tube([[sd * .115, y, .02], [sd * .16, y - .006 - k * .006, .0]], u => .004, 6, 5)); }
    o.whiskHead = hl(mergeG(W), U, V, h, -.03); return o; },
  gus(G, V){ const U = V.U, h = G.hit(0, .69 * U), o = {};
    // big pouch beak: upper bill from the face, deep pouch hanging below, tip forward and down
    const b = ell(.13, .17, .12, {}, 32, 24), p = b.attributes.position;
    for(let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y / .17 + 1) / 2, fz = z / .12;   // t: 0 bottom .. 1 top
      const w = (.62 + .45 * t) * (1 - .3 * Math.max(0, fz) * (1 - t));                       // wide at the top, narrower toward the tip
      p.setX(i, x * w); p.setZ(i, (z > 0 ? z * (1.0 + .9 * (1 - t)) : z * .5) + .03 * (1 - t)); p.setY(i, y - .03 * Math.max(0, fz) * (1 - t)); }
    b.scale(1.05, 1.22, 1.15); b.computeVertexNormals(); o.beakHead = hl(b, U, V, h, .05);
    // smile: front of the beak near the top (beak front at t=.75 is ~ z .12*(1+.9*.25)+.0075 = .155 from its centre)
    o.smileAt = new THREE.Vector3(h.p.x, h.p.y - V.headY + .104 * U, h.p.z + (.05 + .182) * U);
    return o; },
  zippy(G, V){ const U = V.U;
    const t = sideFin([[.02, -.05], [-.07, -.1], [-.17, -.17], [-.22, -.15], [-.2, -.05], [-.205, 0], [-.2, .05], [-.22, .15], [-.17, .17], [-.07, .1], [.02, .05]], .045, .02);
    const R = []; for(const a of [-.55, -.25, .05, .35]){ R.push(tube([[0, .0, -.02], [0, Math.sin(a) * .16, -.02 - Math.cos(a) * .17]], u => .01, 8, 6, false)); }
    return { tail: scaleG(mergeG([t, ...R]), U) }; },
  shelly(G, V){ const U = V.U;
    // domed back shell (separate darker-green part, own paint part 1): sits on the back of the body
    const d = ell(.32, .29, .2, {}, 40, 28), p = d.attributes.position;
    for(let i = 0; i < p.count; i++){ const z = p.getZ(i); if(z > 0) p.setZ(i, z * .35); }
    d.computeVertexNormals(); d.translate(0, .32, -.12);
    const rim = tube(Array.from({ length: 33 }, (_, i) => { const a = -Math.PI / 2 + Math.PI * i / 32 * 2; return [Math.cos(a) * .315, .32 + Math.sin(a) * .285, -.1]; }), u => .022, 64, 8, false);
    return { shellRig: scaleG(mergeG([d, rim]), U) }; },
  coco(G, V){ const U = V.U, h = G.hit(0, .79 * U), o = {};
    // tubular snout with a flared trumpet tip, pointing forward
    const sn = tube([[0, 0, -.03], [0, -.008, .06], [0, -.012, .14], [0, -.01, .2]], u => .045 - .01 * u, 20, 12);
    const tip = new THREE.TorusGeometry(.036, .016, 8, 18); tip.deleteAttribute('uv'); tip.translate(0, -.01, .205);
    const cap = ell(.042, .042, .014, { p: [0, -.01, .205] }, 16, 8);
    o.snoutHead = hl(mergeG([sn, tip, cap]), U, V, h);
    // curled tail behind the base (tail group): down and back, then a spiral curling up
    const P = [[0, .0, 0], [0, -.05, -.06], [0, -.08, -.14]]; for(let i = 0; i <= 14; i++){ const a = Math.PI * .5 + i / 14 * Math.PI * 1.7, r = .085 - i * .003; P.push([0, -.0 + Math.sin(a) * r - .02, -.2 + Math.cos(a) * r]); }
    o.tail = scaleG(tube(P, u => .05 - .032 * u, 60, 12), U); return o; },
};

// ---------------------------------------------------------------- per-species build hooks (features, tails, extra parts)
const POST = {
  pinchy(c){ const { G, V, U, M, head, black } = c;
    for(const s of [-1, 1]){ const g = new THREE.Group(); g.name = 'gill'; g.position.set(s * V.eye.x * U, V.eye.y * U - V.headY, .02 * U); g.rotation.z = -s * .08; head.add(g);
      const st = new THREE.Mesh(G.feat.stalk, M.plain); if(s < 0) st.scale.x = -1; g.add(st);
      const e = new THREE.Mesh(G.sphere, black); e.name = 'eye'; e.scale.set(...V.eye.s.map(v => v * U)); e.position.set(0, .005 * U, .05 * U); g.add(e);
      const sh = new THREE.Mesh(G.sphere, shineMat()); sh.scale.set(.2, .2, .2); sh.position.set(.32, .38, .82); e.add(sh); if(c.ghost) sh.visible = false; } },
  tusk(c){ const { G, M, addH } = c; addH(G.feat.padHead, M.plain); addH(G.feat.noseHead, M.c(0x3a2214, { rough: .6 })); addH(G.feat.whiskHead, M.c(0x3a2214));
    addH(G.feat.tuskHead, M.c(0xf6f1e4, { rough: .5 })); },
  mo(c){ const { G, M, addH } = c; addH(G.feat.snoutHead, M.plain); addH(G.feat.dotHead, M.c(0x3c4239, { rough: .6 })); addH(G.feat.whiskHead, M.c(0x5a6157)); },
  gus(c){ const { G, M, addH, black, U } = c; addH(G.feat.beakHead, M.c(0xf2b21e, { rough: .7, sheenCol: 0xffe9a0 }));
    const t = new THREE.TorusGeometry(.036 * U, .0055 * U, 8, 28, 2.2); t.rotateZ(-Math.PI / 2 - 1.1); const m = addH(t, black); m.position.copy(G.feat.smileAt); },
  zippy(c){ const { G, V, U, M, tail } = c; tail.position.set(0, .44 * U, -.3 * U); tail.add(new THREE.Mesh(G.feat.tail, M.c(V.blue))); },
  shelly(c){ const { G, V, M, rig, ghost } = c; const sm = clay(V.shell, ghost, { ...M.o, paint: M.paint(1) }); const sh = new THREE.Mesh(G.feat.shellRig, sm); sh.name = 'shell'; rig.add(sh); c.parts.shell = sh; },
  coco(c){ const { G, U, M, addH, tail } = c; addH(G.feat.snoutHead, M.plain); tail.position.set(0, .2 * U, -.18 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
};

// ---------------------------------------------------------------- material helper
function mats(kind, V, ghost){
  const o = { rough: V.rough ?? .8, cc: .05, sheen: V.sheen ?? .3 }; if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const glsl = (PAINT[kind] || PAINT.plain)(V.U), paint = part => ({ key: 'b4' + kind, glsl, off: [0, 0, 0], part });
  const neck = { a: V.neck[0], b: V.neck[1] };
  return { o, body: clay(V.color, ghost, { ...o, paint: paint(0), neck }), plain: clay(V.color, ghost, o),
    paint, c: (hex, x = {}) => clay(hex, ghost, { ...o, ...x }) };
}

/** Build one batch-4 character (same contract as buildOllie / buildB3). D = installOllieV2 deps. */
export function buildB4(kind, { equipped = {}, ghost = false } = {}, D = {}){
  const V = B4[kind], G = geos(kind), U = V.U, M = mats(kind, V, ghost), black = gloss(ghost);
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
  const armM = V.armColor != null ? M.c(V.armColor) : M.plain;
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

/** Per-species clothing fit (rig units; hatY / eyeY / eyeZ head-local). Same fields as species-b3.js CLOTH_FIT. */
export const CLOTH_FIT = {
  pinchy: { teeBottom: .42, teeTop: .76, teeScale: 1.03, pantBottom: .24, pantTop: .42, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .85,
            eyeY: .264, eyeZ: -.30, eyeScale: [1.38, 1.05, 1.0], hatY: .12, hatScale: .55, hatZ: -.12, wristScale: .85, handScale: .85 },
  tusk:   { teeBottom: .62, teeTop: 1.3, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: .196, eyeZ: -.019, eyeScale: [1.32, 1.05, 1.0], hatY: 0.4, hatScale: 0.95, wristScale: 1, handScale: 1 },
  mo:     { teeBottom: .62, teeTop: 1.32, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: .222, eyeZ: -.047, eyeScale: [1.5, 1.08, 1.0], hatY: 0.37, hatScale: 1.0, wristScale: 1, handScale: 1 },
  gus:    { teeBottom: .62, teeTop: 1.3, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: .241, eyeZ: -.162, eyeScale: [1.66, 1.08, 1.0], hatY: 0.38, hatScale: 0.85, wristScale: 1, handScale: 1 },
  zippy:  { teeBottom: .62, teeTop: 1.26, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: -.068, eyeZ: .126, eyeScale: [1.35, 1.05, 1.0], hatY: 0.376, hatScale: 0.9, wristScale: .9, handScale: .9 },
  puff:   { teeBottom: .42, teeTop: .88, teeScale: 1.08, pantBottom: .2, pantTop: .42, pantScale: 1.06, pantTrim: null, shoes: 'feet', shoeScale: .9,
            eyeY: -.558, eyeZ: .38, eyeScale: [1.49, 1.08, 1.0], hatY: -0.11, hatScale: 1.15, wristScale: .9, handScale: .9 },
  shelly: { teeBottom: .5, teeTop: 1.04, teeScale: 1.04, pantBottom: .24, pantTop: .5, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: .302, eyeZ: .113, eyeScale: [1.22, 1.05, 1.0], hatY: 0.48, hatScale: 1.0, wristScale: 1, handScale: 1 },
  coco:   { teeBottom: .56, teeTop: 1.2, teeScale: 1.05, pantBottom: .26, pantTop: .56, pantScale: 1.06, pantTrim: null, shoes: 'feet', shoeScale: .9,
            eyeY: .168, eyeZ: -.089, eyeScale: [1.15, 1.05, 1.0], hatY: 0.353, hatScale: 0.8, wristScale: .85, handScale: .85 },
};
export function clothFit(kind){ return CLOTH_FIT[kind] || {}; }
export function clothProfile(P, kind){ let i = 0; while(i < P.length && P[i].x < .08) i++; const sk = P[Math.min(i, P.length - 1)], out = [];
  if(sk.y > .02) out.push(new THREE.Vector2(sk.x, 0)); for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  const fit = CLOTH_FIT[kind]; if(fit) Object.assign(out, fit);
  return out; }
export const B4_PROFILES = {};
export function b4Profile(kind){ return B4_PROFILES[kind] || (B4_PROFILES[kind] = geos(kind).prof); }
