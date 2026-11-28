// species-b5.js: batch-5 playables (Batch C: Stella 4, Hank 5, Inky 26, Milo 27, Hammy 33, Harbor 34, Tango 36, Barrie 45),
// built from the hero mockups (mockups/<id>/hero.png; 33/34/36/45 new in this batch) and the numbered chart designs (named/*.jpg).
// Same recipe as species-b4.js (Ollie C clay, ONE continuous torso lathe per character, same-colour static features merged
// INTO the torso so they bend with the neck-blend shader, patterns as fragment paint, everything cached per species,
// no skinned meshes, no per-frame allocations). Self-contained (helpers copied from species-b4.js, so b2/b3/b4 do not change).
// Parts contract: rig, body, head, hatAnchor, eyeAnchor, sh+-1 > arm+-1, foot+-1, tail.
import * as THREE from 'three';
import { clay, gloss, shineMat, neckTorso, sstep } from './ollie-v2.js?v=20261127-3';

const rnd = (f, u) => u > .84 ? f(.84) * Math.sqrt(Math.max(0, 1 - ((u - .84) / .16) ** 2)) : f(u);   // round the tip off (closes to a point at u=1)
const STAR = { R: .44, chord: u => rnd(v => .30 * (1 - v) ** .75 + .07, u), thick: u => rnd(v => .2 * (1 - .5 * v), u) };
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
// eye.pos = eyes placed by the species POST hook (hammer ends); cloth = [sx, sz] squash for round clothing slices.
export const B5 = {
  stella: { name: 'Stella the Starfish', U: 2.3, color: 0xff8a1f, sheen: .3, sheenCol: 0xffd0a0, rough: .82, rz: 1, seg: 112, rows: 90,
    // radially even 5-point star: centre (0,.44) H, five identical lobes of length R=.44 at 72 deg spacing (one straight up); this lathe is only the centre disc
    prof: [[.24,0,0],[.25,.1,.05],[.28,.17,.08],[.34,.215,.1],[.44,.235,.105],[.54,.215,.1],[.6,.17,.08],[.63,.1,.05],[.64,0,0]],
    neck: [1.05, 1.3], headY: 1.2, eye: { x: .072, y: .5, s: [.027, .033, .02] }, smile: { y: .435, w: .024, t: .0045, arc: 2.2 },
    sh: [.02, .44, .0], arm: 'starArm', armPaint: true, foot: { x: .2587, y: .04, z: .0, s: [.075, .05, .07] }, cloth: [.9, .6], anim: 'playful' },
  hank: { name: 'Hank the Hermit Crab', U: 2.3, color: 0xa3e2c2, sheen: .3, sheenCol: 0xe8fff4, rough: .82, rz: 1, seg: 112, rows: 110,
    // soft mint body sits INSIDE the big coiled shell (shell = main mass, built in FEAT.hank); only the face + claws + legs show at the front opening
    prof: [[.09,0,0,.1],[.1,.1,.09,.1],[.13,.18,.16,.115],[.18,.225,.2,.12],[.25,.25,.225,.125],[.36,.26,.235,.125],[.47,.25,.225,.12],[.54,.22,.195,.11],[.6,.15,.135,.1],[.64,.07,.06,.09],[.655,0,0,.09]],
    neck: [.7, 1.1], headY: 1.0, eye: { x: .085, y: .42, s: [.03, .037, .022] }, smile: { y: .335, w: .027, t: .0046, arc: 2.2 },
    sh: [.2, .27, .3], arm: 'mitt', armColor: 0xe8463a, foot: { x: .115, y: .07, z: .12, s: [.075, .075, .09], color: 0xe8463a }, clothZ: .115,
    shell: 0xf27f78, shellP: { c: [0, .56, -.05], cR: [.38, .36, .35], cOff: [0, .02, -.08], rOut: .28, k: 1.4, T: 2.8, th1: -Math.PI / 2, ridge: .044, ridgeOut: 1.03 }, anim: 'chunky' },
  inky: { name: 'Inky the Octopus', U: 2.3, color: 0x7b3fbf, sheen: .32, sheenCol: 0xd8b8ff, rough: .8, rz: .92, seg: 112, rows: 120,
    prof: [[.1,0],[.104,.2],[.13,.28],[.19,.3],[.27,.285],[.35,.29],[.44,.335],[.54,.38],[.64,.4],[.74,.385],[.83,.33],[.9,.255],[.95,.17],[.98,.085],[.99,0]],
    neck: [.86, 1.1], headY: 1.3, eye: { x: .135, y: .56, s: [.036, .044, .026] }, smile: { y: .505, w: .03, t: .005, arc: 2.2 },
    sh: [.26, .34, .02], arm: 'tentacle', foot: { x: .14, y: .045, z: .13, s: [.085, .05, .1] }, anim: 'playful' },
  milo: { name: 'Milo the Manta Ray', U: 2.6, color: 0x1e3a6e, sheen: .3, sheenCol: 0xa8c0ff, rough: .8, rz: .62, seg: 112, rows: 110,
    prof: [[.08,0],[.085,.22],[.11,.32],[.17,.38],[.25,.41],[.35,.415],[.45,.4],[.55,.36],[.64,.29],[.71,.195],[.755,.1],[.772,0]],
    neck: [1.06, 1.3], headY: 1.3, eye: { x: .14, y: .5, s: [.027, .033, .02] }, smile: { y: .445, w: .024, t: .0042, arc: 2.2 },
    sh: [.33, .44, -.02], arm: 'wing', foot: { x: .14, y: .036, z: .04, s: [.075, .045, .085] }, white: 0xf3f1ea, cloth: [1, .7], anim: 'calm' },
  hammy: { name: 'Hammy the Hammerhead', U: 2.3, color: 0x2aa8a8, sheen: .3, sheenCol: 0xc8fff8, rough: .8, rz: .86, seg: 112, rows: 120,
    prof: [[.04,0],[.045,.17],[.07,.27],[.12,.32],[.2,.345],[.3,.35],[.4,.34],[.5,.32],[.6,.29],[.7,.262],[.76,.25],[.82,.235],[.87,.2],[.905,.13],[.92,0]],
    neck: [1.24, 1.46], headY: 1.5, eye: { x: .43, y: .81, s: [.034, .04, .024], pos: true }, smile: { y: .7, w: .05, t: .006, arc: 2.0 },
    sh: [.31, .5, .0], arm: 'pec', foot: { x: .15, y: .042, z: .07, s: [.11, .062, .13], color: 0xf6f6f2 }, anim: 'chunky' },
  harbor: { name: 'Harbor the Sea Lion', U: 2.3, color: 0xc4a882, sheen: .28, sheenCol: 0xfff0d8, rough: .84, rz: .9, seg: 112, rows: 120,
    prof: [[.04,0],[.045,.17],[.07,.27],[.12,.33],[.2,.355],[.3,.36],[.4,.345],[.5,.315],[.6,.28],[.68,.256],[.76,.24],[.84,.215],[.9,.17],[.95,.1],[.975,0]],
    neck: [1.3, 1.5], headY: 1.56, eye: { x: .108, y: .78, s: [.03, .036, .022] }, smile: null,
    sh: [.3, .5, .0], arm: 'stub', foot: { x: .155, y: .044, z: .08, s: [.11, .062, .14] }, anim: 'calm' },
  tango: { name: 'Tango the Blue Tang', U: 2.25, color: 0x2f6fe0, sheen: .3, sheenCol: 0xc0d8ff, rough: .8, rz: .82, seg: 112, rows: 120,
    prof: [[.05,0],[.055,.17],[.08,.28],[.12,.34],[.2,.38],[.3,.395],[.4,.395],[.5,.385],[.6,.36],[.7,.32],[.78,.27],[.85,.205],[.91,.13],[.95,.06],[.965,0]],
    neck: [1.2, 1.4], headY: 1.42, eye: { x: .12, y: .56, s: [.034, .041, .025] }, smile: { y: .505, w: .026, t: .0046, arc: 2.2 },
    sh: [.36, .42, .0], arm: 'pec', foot: { x: .15, y: .046, z: .05, s: [.1, .068, .12] }, anim: 'playful' },
  barrie: { name: 'Barrie the Barracuda', U: 2.3, color: 0xa8b4b8, sheen: .3, sheenCol: 0xffffff, rough: .82, rz: .9, seg: 112, rows: 120,
    prof: [[.04,0],[.045,.15],[.07,.24],[.12,.29],[.2,.31],[.3,.31],[.4,.3],[.5,.285],[.6,.27],[.7,.256],[.78,.246],[.85,.226],[.91,.18],[.955,.11],[.98,0]],
    neck: [1.34, 1.54], headY: 1.62, eye: { x: .1, y: .81, s: [.029, .035, .021] }, smile: null,
    sh: [.28, .52, .0], arm: 'stub', foot: { x: .14, y: .044, z: .07, s: [.095, .06, .12] }, dark: 0x4a5153, anim: 'playful' },
};
export const BATCH5_IDS = Object.keys(B5);

// ---------------------------------------------------------------- torso deformations (H units)
const DEFORM = {};

// ---------------------------------------------------------------- paint (fragment) shaders; p = rig units, q = p / U
const PAINT = {
  plain: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  stella: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 q = p / ${U.toFixed(3)};
  vec2 c = fract(vec2(q.x / 0.05 + 0.5 * floor(q.y / 0.05), q.y / 0.05)) - 0.5;   // staggered low-relief dots, kept off the face
  float d = zkAA((length(c) - 0.2) * 0.05);
  float face = 1.0 - zkAA((length(vec2(q.x / 0.15, (q.y - 0.47) / 0.1)) - 1.0) * 0.2);
  return mix(base, base * 1.18 + vec3(0.06, 0.04, 0.0), d * face * 0.75);
}`,
  milo: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(-0.02, 0.08, q.z);
  float w = zkAA((q.y - (0.27 + 1.3 * q.x * q.x)) * 0.5) * front;   // white belly chevron rising to the sides
  return mix(base, vec3(0.95, 0.94, 0.9), w);
}`,
  hammy: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.04, 0.14, q.z);
  float bl = zkAA((length(vec2(q.x / 0.22, (q.y - 0.36) / 0.27)) - 1.0) * 0.2) * front;
  return mix(base, vec3(0.96, 0.96, 0.94), bl);
}`,
  harbor: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.06, 0.16, q.z);
  float bl = zkAA((length(vec2(q.x / 0.2, (q.y - 0.36) / 0.27)) - 1.0) * 0.2) * front;
  float cape = (1.0 - smoothstep(-0.16, -0.06, q.z)) * zkAA((length(vec2(q.x / 0.28, (q.y - 0.5) / 0.28)) - 1.0) * 0.2);
  vec3 c = mix(base, vec3(0.27, 0.15, 0.075), cape);
  return mix(c, vec3(0.86, 0.74, 0.52), bl);
}`,
  tango: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float L = q.y - (0.6 + 1.0 * q.z);
  float band = zkAA(-L * 0.3) * zkAA((L - 0.3) * 0.3);   // black swoosh over the back
  float side = smoothstep(0.06, 0.14, abs(q.x));
  float hole = zkAA((length(vec2((q.y - 0.47) / 0.1, (q.z + 0.16) / 0.1)) - 1.0) * 0.1) * side;
  band *= 1.0 - hole;
  vec3 c = mix(base, vec3(0.06, 0.06, 0.09), band);
  float ck = zkAA((length(vec2((abs(q.x) - 0.2) / 0.04, (q.y - 0.5) / 0.028)) - 1.0) * 0.06) * smoothstep(0.1, 0.2, q.z);
  return mix(c, vec3(0.92, 0.32, 0.3), ck);
}`,
  barrie: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float th = abs(atan(q.x, q.z)), tc = 1.45 + (0.95 - q.y) * 0.55;
  float s1 = zkAA((abs(th - tc) - 0.16) * 0.3), s2 = zkAA((abs(th - tc - 0.36) - 0.06) * 0.3);
  float st = max(s1, s2) * (1.0 - smoothstep(0.9, 0.96, q.y)) * smoothstep(0.1, 0.16, q.y);
  vec3 c = mix(base, vec3(0.06, 0.07, 0.075), st);
  float ck = zkAA((length(vec2((abs(q.x) - 0.15) / 0.035, (q.y - 0.77) / 0.026)) - 1.0) * 0.06) * smoothstep(0.1, 0.2, q.z);
  return mix(c, vec3(0.92, 0.32, 0.32), ck);
}`,
};

// ---------------------------------------------------------------- torso extras merged INTO the body mesh (H units)
const EXTRAS = {
  stella(S){ const L = [];
    // three of the five identical lobes are merged into the torso: straight up (the head point) and the two lower ones (legs, feet sit on their tips); the other two are arm+-1
    for(const a of [90, 234, 306]){ const r = a * Math.PI / 180; L.push(lobe([[0, .44, 0], [STAR.R * Math.cos(r), .44 + STAR.R * Math.sin(r), 0]], STAR.chord, STAR.thick, 1, 18, 16)); }
    return L; },
  hank(S){ return []; },
  inky(S){ const L = [];
    // curled tentacle nubs around the base (front two run into foot+-1)
    for(const s of [-1, 1]) for(const a of [1.15, 1.95, 2.7]){
      const d = [Math.sin(a) * s, Math.cos(a)], P = (r, y) => [d[0] * r, y, d[1] * r];
      L.push(tube([P(.22, .24), P(.3, .13), P(.37, .06), P(.44, .05), P(.48, .1), P(.455, .15), P(.415, .13)], u => .07 - .042 * u, 30, 10)); }
    return L; },
  milo(S){ const L = [];
    // two tiny horn nubs (cephalic fins) at the top front
    for(const s of [-1, 1]){ const { p, n } = S(s * .62, .64); L.push(tube([[p.x - n.x * .02, p.y, p.z - n.z * .02], [p.x + n.x * .03, p.y + .03, p.z + n.z * .03 + .02], [p.x + n.x * .04, p.y + .065, p.z + n.z * .04 + .035]], u => .032 - .012 * u, 10, 9)); }
    return L; },
  hammy(S){ const L = [];
    // chunky rounded hammer crossbar close to the skull, bulbous ends (eyes sit on their fronts)
    const bar = tube([[-.39, .8, 0], [0, .812, 0], [.39, .8, 0]], u => .1 + .012 * Math.cos(u * TAU) * 0, 40, 18); bar.scale(1, 1, 1.25); L.push(bar);
    L.push(sideFin([[-.2, .66], [-.27, .74], [-.33, .69], [-.32, .6], [-.22, .6]], .05, .02));   // tiny dorsal nub
    return L; },
  harbor(S){ const L = [];
    for(const s of [-1, 1]){ const { p } = S(s * 1.45, .84); L.push(ell(.034, .042, .03, { p: [p.x * .98, p.y, p.z - .01] }, 14, 10)); }   // ear nubs
    return L; },
  tango(S){ return [sideFin([[.06, .87], [-.02, .975], [-.16, .97], [-.3, .86], [-.38, .68], [-.34, .6], [-.2, .78]], .045, .018)]; },   // dorsal fin
  barrie(S){ return [sideFin([[-.18, .62], [-.27, .72], [-.35, .7], [-.33, .58], [-.24, .54]], .04, .016)]; },
};

// ---------------------------------------------------------------- arms (arm-local, H units; the limb runs along -y)
const ARMS = {
  // star arm: fat flat triangle pointing out and slightly up
  // star arm: the same lobe as the other three points, hung from the centre and turned 108 deg (18 deg above horizontal = 72 deg from the top point)
  starArm(){ return { g: lobe([[0, 0, 0], [0, -(STAR.R - .035), 0]], STAR.chord, STAR.thick, 1, 18, 16), rz: 1.735, rx: 0 }; },
  // red mitt claw: short arm, big rounded mitt with a thumb
  mitt(){ const L = [tube([[0, .02, 0], [0, -.07, 0], [.01, -.12, .01]], u => .045 - .004 * u, 14, 10)];
    L.push(ell(.1, .115, .08, { p: [.02, -.18, .02] }, 24, 18));
    L.push(xf(ell(.045, .07, .048, {}, 16, 12), { p: [-.07, -.15, .04], r: [0, 0, -.6] }));
    return { g: mergeG(L), rz: .1, rx: -.5 }; },
  tentacle(){ return { g: tube([[0, .02, 0], [.01, -.1, 0], [.05, -.18, 0], [.11, -.22, 0], [.155, -.19, 0], [.15, -.14, 0], [.12, -.13, 0]], u => .06 - .034 * u, 30, 10), rz: .5, rx: 0 }; },
  wing(){ // swept manta wing: flat lobe, thick root, rounded tip curling up
    const g = lobe([[0, .04, 0], [0, -.42, 0]], u => .36 * (1 - u) ** .75 + .02, u => .1 * (1 - .65 * u), 1, 14, 16), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const y = p.getY(i), t = Math.max(0, -y / .42); p.setX(i, p.getX(i) - .1 * t * t); p.setZ(i, p.getZ(i) - .06 * t); }
    g.computeVertexNormals(); return { g, rz: 1.85, rx: 0 }; },
  pec(){ return { g: flipper(.045, .13, .085, .4, .012), rz: .7, rx: -.05 }; },
  stub(){ return { g: flipper(.055, .14, .095, .3, .014), rz: .45, rx: 0 }; },
};

// ---------------------------------------------------------------- build + cache
const GEO = {};
function geos(kind){
  if(GEO[kind]) return GEO[kind];
  const V = B5[kind], U = V.U, def = DEFORM[kind];
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
// feature geometries (rig units). *Head = head-local, *Rig = rig-local, tail = tail-local.
const FEAT = {
  hank(G, V){ const U = V.U, Hy = V.headY / U, H = V.shellP;
    // SOLID coral dome (closed ellipsoid, FrontSide) with shallow spiral ridges sitting on the ±x surfaces:
    // from the side the ridges read as packed concentric circles; no hollow tube, no inner faces, no gaps.
    const [cx, cy, cz] = H.c, [rx, ry, rz] = H.cR, [ox, oy, oz] = H.cOff, Cx = cx + ox, Cy = cy + oy, Cz = cz + oz;
    const core = ell(rx, ry, rz, { p: [Cx, Cy, Cz] }, 32, 24), ridges = [];
    for(const sign of [-1, 1]){ const P = [];
      for(let i = 0; i <= 180; i++){ const t = i / 180, th = H.th1 - TAU * H.T * (1 - t), r = H.rOut * H.k ** ((th - H.th1) / TAU);
        const y = Cy + r * Math.sin(th), z = Cz + r * Math.cos(th), q = 1 - ((y - Cy) / ry) ** 2 - ((z - Cz) / rz) ** 2;
        if(q < .05) continue; P.push([sign * rx * Math.sqrt(q) * H.ridgeOut, y, z]); }
      if(P.length > 4) ridges.push(tube(P, () => H.ridge, 150, 8, true)); }
    const g = mergeG([core, ...ridges]); g.translate(0, -Hy, 0); return { shellHead: scaleG(g, U) }; },
  inky(G, V){ return {}; },
  milo(G, V){ const U = V.U;
    const t = tube([[0, 0, 0], [0, -.02, -.1], [0, -.03, -.2], [0, -.02, -.28]], u => .024 - .016 * u, 16, 8);
    return { tail: scaleG(t, U) }; },
  hammy(G, V){ return {}; },
  harbor(G, V){ const U = V.U, h = G.hit(0, .705 * U), o = {};
    o.snoutHead = hl(mergeG([ell(.075, .056, .06, { p: [-.04, 0, 0] }, 20, 14), ell(.075, .056, .06, { p: [.04, 0, 0] }, 20, 14), ell(.05, .04, .05, { p: [0, -.04, -.005] }, 16, 12)]), U, V, h, -.006);
    o.noseHead = hl(ell(.036, .024, .022, { p: [0, .045, .05] }, 16, 10), U, V, h, -.006);
    o.dotHead = hl(mergeG([-1, 1].flatMap(sd => [[.05, .012], [.075, .0], [.06, -.016]].map(([x, y]) => ell(.0065, .0065, .005, { p: [sd * x, y, .057 - Math.abs(x) * .3] }, 8, 6)))), U, V, h, -.006);
    const t = new THREE.TorusGeometry(.022, .004, 8, 22, 2.2); t.deleteAttribute('uv'); t.rotateZ(-Math.PI / 2 - 1.1); t.translate(0, -.012, .062);
    o.mouthHead = hl(t, U, V, h, -.006);
    const tl = ell(.13, .03, .12, {}, 22, 12), q = tl.attributes.position; for(let i = 0; i < q.count; i++){ const z = q.getZ(i); q.setX(i, q.getX(i) * (1 + Math.max(0, -z) * 2.2)); } tl.computeVertexNormals();
    tl.translate(0, 0, -.1); o.tail = scaleG(tl, U); return o; },
  tango(G, V){ const U = V.U;
    const f = sideFin([[.02, -.05], [-.08, -.08], [-.17, -.17], [-.23, -.14], [-.21, -.05], [-.215, 0], [-.21, .05], [-.23, .14], [-.17, .17], [-.08, .08], [.02, .05]], .045, .02);
    const R = []; for(const a of [-.55, -.25, .05, .35]) R.push(tube([[0, .0, -.04], [0, Math.sin(a) * .15, -.04 - Math.cos(a) * .16]], u => .009, 8, 6, false));
    const st = ell(.05, .06, .07, { p: [0, 0, .0] }, 16, 12);
    return { tail: scaleG(mergeG([f, ...R]), U), tailBase: scaleG(st, U) }; },
  barrie(G, V){ const U = V.U, h = G.hit(0, .735 * U), o = {};
    o.snoutHead = hl(mergeG([ell(.068, .05, .055, { p: [-.038, 0, 0] }, 20, 14), ell(.068, .05, .055, { p: [.038, 0, 0] }, 20, 14)]), U, V, h, -.004);
    o.noseHead = hl(ell(.026, .018, .018, { p: [0, .036, .048] }, 14, 10), U, V, h, -.004);
    o.dotHead = hl(mergeG([...[-1, 1].flatMap(sd => [[.035, .01], [.058, .014], [.045, -.01], [.07, -.004]].map(([x, y]) => ell(.006, .006, .005, { p: [sd * x, y, .052 - Math.abs(x) * .3] }, 8, 6))),
      ...[-1, 1].map(sd => ell(.008, .008, .006, { p: [sd * .05, .14, .02] }, 8, 6))]), U, V, h, -.004);
    o.mouthHead = hl(ell(.03, .02, .016, { p: [0, -.048, .03] }, 16, 10), U, V, h, -.004);   // goofy open under-bite mouth
    o.tongueHead = hl(ell(.018, .009, .01, { p: [0, -.056, .04] }, 12, 8), U, V, h, -.004);
    const f = sideFin([[.02, -.03], [-.08, -.05], [-.17, -.13], [-.14, -.03], [-.12, 0], [-.14, .03], [-.17, .13], [-.08, .05], [.02, .03]], .04, .016);
    o.tail = scaleG(f, U); return o; },
  stella(G, V){ return {}; },
};

// ---------------------------------------------------------------- per-species build hooks (features, tails, extra parts)
const POST = {
  hank(c){ const { G, V, M, head, ghost } = c; const sm = clay(V.shell, ghost, { ...M.o, sheenCol: 0xffe0d8 }); const sh = new THREE.Mesh(G.feat.shellHead, sm); sh.name = 'shell'; head.add(sh); c.parts.shell = sh; },
  milo(c){ const { G, U, M, tail } = c; tail.position.set(0, .2 * U, -.2 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
  hammy(c){ const { G, V, U, head, black } = c;
    for(const s of [-1, 1]){ const e = new THREE.Mesh(G.sphere, black); e.name = 'eye'; e.scale.set(...V.eye.s.map(v => v * U));
      e.position.set(s * V.eye.x * U, V.eye.y * U - V.headY, .095 * U); e.quaternion.setFromUnitVectors(Zv, new THREE.Vector3(s * .45, 0, 1).normalize()); head.add(e);
      const sh = new THREE.Mesh(G.sphere, shineMat()); sh.scale.set(.2, .2, .2); sh.position.set(.32, .38, .82); e.add(sh); if(c.ghost) sh.visible = false; } },
  harbor(c){ const { G, U, M, addH, tail } = c; addH(G.feat.snoutHead, M.c(0xf0e2c4)); addH(G.feat.noseHead, M.c(0x2a1c14, { rough: .5 }));
    addH(G.feat.dotHead, M.c(0x3a2a20)); addH(G.feat.mouthHead, c.black);
    tail.position.set(0, .07 * U, -.28 * U); tail.add(new THREE.Mesh(G.feat.tail, M.plain)); },
  tango(c){ const { G, U, M, tail } = c; tail.position.set(0, .46 * U, -.33 * U); tail.add(new THREE.Mesh(G.feat.tail, M.c(0xffcf1f)));
    const b = new THREE.Mesh(G.feat.tailBase, M.c(0x15161c)); b.position.z = .02 * U; tail.add(b); },
  barrie(c){ const { G, V, U, M, addH, tail } = c; addH(G.feat.snoutHead, M.plain); addH(G.feat.noseHead, M.c(0x1e2224, { rough: .5 }));
    addH(G.feat.dotHead, M.c(0x2a2e30)); addH(G.feat.mouthHead, M.c(0x3a1a1e, { rough: .6 })); addH(G.feat.tongueHead, M.c(0xf08a90));
    tail.position.set(0, .14 * U, -.28 * U); tail.add(new THREE.Mesh(G.feat.tail, M.c(V.dark))); },
};

// ---------------------------------------------------------------- material helper
function mats(kind, V, ghost){
  const o = { rough: V.rough ?? .8, cc: .05, sheen: V.sheen ?? .3 }; if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const glsl = (PAINT[kind] || PAINT.plain)(V.U), paint = part => ({ key: 'b5' + kind, glsl, off: [0, 0, 0], part });
  const neck = { a: V.neck[0], b: V.neck[1] };
  return { o, body: clay(V.color, ghost, { ...o, paint: paint(0), neck }), plain: clay(V.color, ghost, o),
    paint, c: (hex, x = {}) => clay(hex, ghost, { ...o, ...x }) };
}

/** Build one batch-5 character (same contract as buildOllie / buildB3). D = installOllieV2 deps. */
export function buildB5(kind, { equipped = {}, ghost = false } = {}, D = {}){
  const V = B5[kind], G = geos(kind), U = V.U, M = mats(kind, V, ghost), black = gloss(ghost);
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


/** Per-species clothing fit (rig units; hatY / eyeY / eyeZ head-local). Same fields as species-b3.js / b4 CLOTH_FIT. */
export const CLOTH_FIT = {
  stella: { teeBottom: .6, teeTop: .92, teeScale: 1.04, pantBottom: .45, pantTop: .6, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .8,
            eyeY: -.2, eyeZ: -.239, eyeScale: [.85, 1.0, 1.0], hatY: .61, hatScale: .5, wristScale: .85, handScale: .85 },
  hank:   { teeBottom: .4, teeTop: .74, teeScale: 1.04, pantBottom: .26, pantTop: .4, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .85,
            eyeY: -.19, eyeZ: .322, eyeScale: [1.0, 1.05, 1.0], hatY: .65, hatScale: 1.0, hatZ: -.12, wristScale: .85, handScale: .85 },
  inky:   { teeBottom: .5, teeTop: .94, teeScale: 1.04, pantBottom: .26, pantTop: .5, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .9,
            eyeY: -0.174, eyeZ: 0.305, eyeScale: [1.55, 1.08, 1.0], hatY: .62, hatScale: 1.1, wristScale: .9, handScale: .9 },
  milo:   { teeBottom: .44, teeTop: .98, teeScale: 1.04, pantBottom: .2, pantTop: .44, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .8,
            eyeY: -0.162, eyeZ: 0.116, eyeScale: [1.82, 1.08, 1.0], hatY: .3, hatScale: .9, wristScale: .85, handScale: .85 },
  hammy:  { teeBottom: .62, teeTop: 1.3, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: 0.198, eyeZ: -0.24, eyeScale: [5.0, 1.1, 1.0], hatY: .2, hatScale: .9, wristScale: .9, handScale: .9 },
  harbor: { teeBottom: .62, teeTop: 1.22, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: 0.076, eyeZ: -0.028, eyeScale: [1.25, 1.05, 1.0], hatY: .4, hatScale: .95, wristScale: 1, handScale: 1 },
  tango:  { teeBottom: .5, teeTop: 1.06, teeScale: 1.04, pantBottom: .24, pantTop: .5, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: 1,
            eyeY: -0.318, eyeZ: 0.189, eyeScale: [1.35, 1.05, 1.0], hatY: .4, hatScale: .9, wristScale: .9, handScale: .9 },
  barrie: { teeBottom: .62, teeTop: 1.26, teeScale: 1.04, pantBottom: .26, pantTop: .62, pantScale: 1.05, pantTrim: null, shoes: 'feet', shoeScale: .95,
            eyeY: 0.085, eyeZ: -0.009, eyeScale: [1.15, 1.05, 1.0], hatY: .4, hatScale: .85, wristScale: .9, handScale: .9 },
};
export function clothFit(kind){ return CLOTH_FIT[kind] || {}; }
export function clothProfile(P, kind){ let i = 0; while(i < P.length && P[i].x < .08) i++; const sk = P[Math.min(i, P.length - 1)], out = [];
  if(sk.y > .02) out.push(new THREE.Vector2(sk.x, 0)); for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  const fit = CLOTH_FIT[kind]; if(fit) Object.assign(out, fit);
  return out; }
export const B5_PROFILES = {};
export function b5Profile(kind){ return B5_PROFILES[kind] || (B5_PROFILES[kind] = geos(kind).prof); }
