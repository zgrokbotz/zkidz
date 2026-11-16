// species-b2.js: batch-2 playables v4 (Pip, Sunny, Jelly, Lulu, Percy, Nova, Kelpie, Giga), rebuilt from the approved
// mockups (mockups/<id>/turnaround.png). Ollie's progression: original design -> mockup -> smooth matte 3D.
//
// How it is built (all cached once per species, nothing per frame, no skinned meshes):
//  - ONE continuous torso per character: an elliptical lathe whose profile was measured from the mockup front/side views
//    (numbers below are in "H" units = fraction of the mockup figure height, scaled by U to rig units). Static features
//    that share the body colour (Sunny's muzzle, Lulu's plates and side legs, Kelpie's ribbons and crown buds, Giga's
//    mantle fins and tentacle skirt, Percy's crest) are displaced/merged INTO that torso mesh, so they bend with the
//    head blend (Ollie C v2's one-torso neck shader) and cost no extra draw calls.
//  - Patterns are fragment-shader paint (Pip's bib, Sunny's spots/whisker dots, Percy's red jaw, Nova's belly).
//  - Parts contract unchanged: rig, body, head (invisible pivot on the torso), hatAnchor, eyeAnchor, sh±1 > arm±1,
//    foot±1 (unit spheres scaled, so shoes still fit), tail (a Group; empty where the mockup has no tail).
import * as THREE from './vendor/three.module.min.js?v=20261116-12';
import { clay, gloss, shineMat, neckTorso, sstep } from './ollie-v2.js?v=20261116-12';

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

// ---------------------------------------------------------------- per-species definitions (H units unless noted)
// prof rows: [y, rx, rz?, zc?]. U = rig units per H. neck = rig-unit blend band (a,b). headY = head pivot (rig units).
export const B2 = {
  pip: { name: 'Pip the Penguin', U: 2.15, color: 0x242f40, sheen: .2, sheenCol: 0x8a96aa, rough: .8, rz: .92, seg: 112, rows: 120,
    prof: [[.035,0],[.04,.12],[.06,.18],[.1,.222],[.125,.245],[.15,.265],[.2,.292],[.25,.309],[.3,.318],[.35,.32],[.4,.318],[.45,.311],[.5,.302],[.55,.292],[.6,.283],[.65,.272],[.7,.266],[.75,.261],[.8,.25],[.85,.233],[.9,.204],[.95,.153],[.975,.111],[1,0]],
    neck: [1.08, 1.27], headY: 1.32, eye: { x: .11, y: .735, s: [.031, .037, .022] }, smile: { y: .62, w: .036, t: .0055, arc: 2.3 },
    sh: [.275, .575, .0], arm: 'pipFlipper', foot: { x: .145, y: .038, z: .085, s: [.105, .05, .15], color: 0xf08a1c, toes: 0xe57a10 }, anim: 'chunky' },
  sunny: { name: 'Sunny the Seal', U: 2.15, color: 0x96a1b7, sheen: .3, sheenCol: 0xf2f5fa, rough: .88, rz: 1, seg: 120, rows: 130,
    prof: [[.07,0,0],[.075,.15,.14],[.1,.24,.2],[.15,.256,.215],[.2,.27,.248],[.25,.287,.27],[.3,.297,.283],[.35,.302,.289],[.4,.302,.287],[.45,.3,.28],[.5,.297,.275],[.6,.294,.265],[.65,.29,.258],[.7,.284,.25],[.75,.274,.232],[.8,.262,.21],[.85,.24,.19],[.9,.212,.155],[.95,.163,.11],[.975,.118,.08],[1,0,0]],
    neck: [1.05, 1.22], headY: 1.3, eye: { x: .108, y: .762, s: [.029, .033, .021] }, smile: null,
    sh: [.272, .55, -.01], arm: 'sunnyFlipper', foot: { x: .163, y: .08, z: .025, s: [.1, .09, .112] }, anim: 'calm' },
  jelly: { name: 'Jelly the Jellyfish', U: 2.1, color: 0xb19cfc, sheen: .34, sheenCol: 0xece4ff, rough: .82, rz: .95, seg: 110, rows: 120,
    prof: [[.37,0],[.375,.12],[.385,.25],[.4,.35],[.415,.405],[.44,.42],[.47,.42],[.5,.405],[.53,.383],[.56,.37],[.6,.3688],[.64,.3648],[.68,.3577],[.72,.3472],[.76,.3328],[.8,.314],[.84,.2897],[.88,.2584],[.92,.217],[.96,.1576],[1.0,.0]],
    neck: [1.0, 1.14], headY: 1.22, eye: { x: .172, y: .6, s: [.028, .034, .021] }, smile: { y: .58, w: .045, t: .0075, arc: 2.2 },
    sh: [.25, .4, .02], arm: 'jellyTent', foot: { x: .138, y: .19, z: .0, s: [.095, .19, .095], color: 0xf2a2c6, leg: true }, pink: 0xf2a2c6, anim: 'playful' },
  lulu: { name: 'Lulu the Lobster', U: 2.41, color: 0x3394ff, sheen: .3, sheenCol: 0xb8dcff, rough: .8, rz: .92, seg: 104, rows: 140,
    prof: [[.045,0],[.05,.12],[.07,.17],[.1,.195],[.125,.205],[.15,.215],[.2,.232],[.25,.24],[.3,.243],[.35,.242],[.4,.24],[.45,.234],[.5,.222],[.525,.212],[.55,.215],[.6,.218],[.65,.205],[.7,.183],[.75,.148],[.775,.12],[.8,.085],[.82,0]],
    neck: [1.27, 1.42], headY: 1.5, eye: { x: .1, y: .63, s: [.026, .031, .02] }, smile: { y: .603, w: .038, t: .0055, arc: 2.3 },
    sh: [.212, .45, .0], arm: 'luluClaw', foot: { x: .145, y: .055, z: .02, s: [.097, .062, .108] }, anim: 'playful' },
  percy: { name: 'Percy the Piranha', U: 2.3, color: 0x7c869d, sheen: .26, sheenCol: 0xe6eaf0, rough: .86, rz: .97, seg: 120, rows: 120,
    prof: [[.08,0],[.085,.1],[.1,.2],[.125,.25],[.15,.271],[.2,.31],[.25,.336],[.3,.35],[.35,.357],[.4,.36],[.45,.36],[.5,.358],[.55,.355],[.6,.343],[.65,.324],[.7,.297],[.75,.26],[.8,.208],[.825,.176],[.85,.128],[.868,.07],[.875,0]],
    neck: [1.02, 1.16], headY: 1.16, eye: { x: .165, y: .52, s: [.034, .038, .025] }, smile: null,
    sh: [.33, .42, .02], arm: 'percyFin', foot: { x: .19, y: .068, z: .03, s: [.105, .072, .135], color: 0xaf0f0e }, red: 0xaf0f0e, anim: 'playful' },
  nova: { name: 'Nova the Narwhal', U: 2.35, color: 0x4edaeb, sheen: .3, sheenCol: 0xd8fffc, rough: .82, rz: 1, seg: 112, rows: 130,
    prof: [[.115,0,0,-.01],[.12,.1,.09,-.015],[.135,.17,.155,-.02],[.16,.205,.19,-.02],[.2,.216,.2,-.02],[.25,.235,.218,-.015],[.3,.249,.232,-.01],[.35,.258,.242,-.005],[.4,.265,.25,0],[.45,.269,.255,0],[.5,.27,.258,0],[.55,.27,.257,0],[.6,.266,.253,0],[.65,.254,.24,0],[.7,.236,.224,0],[.75,.21,.194,0],[.8,.16,.146,0],[.825,.12,.11,0],[.845,.07,.065,0],[.855,0,0,0]],
    neck: [1.02, 1.18], headY: 1.25, eye: { x: .152, y: .575, s: [.031, .038, .023] }, smile: { y: .52, w: .03, t: .005, arc: 2.3 },
    sh: [.258, .43, -.005], arm: 'novaFlipper', foot: { x: .105, y: .088, z: .02, s: [.095, .098, .105] }, anim: 'calm' },
  kelpie: { name: 'Kelpie the Seaweed', U: 2.47, color: 0x5e8a32, sheen: .28, sheenCol: 0xd8f0a8, rough: .86, rz: .96, seg: 96, rows: 110,
    prof: [[.08,0],[.085,.09],[.10,.148],[.12,.168],[.16,.184],[.22,.192],[.30,.194],[.38,.188],[.45,.176],[.50,.160],[.55,.142],[.60,.120],[.63,.100],[.66,.072],[.68,.042],[.69,0]],
    neck: [.98, 1.08], headY: 1.15, eye: { x: .082, y: .47, s: [.024, .028, .018] }, smile: { y: .445, w: .026, t: .0044, arc: 2.3 },
    sh: [.188, .385, .0], arm: 'kelpArm', foot: { x: .095, y: .08, z: .01, s: [.078, .085, .076] }, anim: 'playful' },
  giga: { name: 'Giga the Giant Squid', U: 2.35, color: 0x9e3e3a, sheen: .24, sheenCol: 0xf0a090, rough: .86, rz: 1, seg: 104, rows: 120,
    prof: [[.075,0,0],[.08,.12,.11],[.095,.18,.168],[.12,.2,.186],[.2,.21,.195],[.3,.214,.199],[.4,.218,.203],[.45,.222,.206],[.495,.218,.204],[.503,.226,.212],[.512,.244,.232],[.53,.252,.24],[.56,.248,.236],[.6,.236,.226],[.65,.216,.21],[.7,.196,.193],[.75,.178,.177],[.8,.158,.157],[.85,.133,.132],[.9,.104,.103],[.94,.075,.075],[.97,.048,.048],[.99,.024,.024],[1,0,0]],
    neck: [.88, .98], headY: 1.08, eye: { x: .094, y: .452, s: [.025, .029, .019] }, smile: { y: .43, w: .03, t: .0048, arc: 2.3 },
    sh: [.2, .385, .0], arm: 'gigaTent', foot: { x: .135, y: .05, z: .0, s: [.085, .055, .09] }, anim: 'calm' },
};
export const BATCH2_IDS = Object.keys(B2);

// ---------------------------------------------------------------- torso deformations (H units)
const DEFORM = {
  sunny(v, nx, nz, th, y){ if(v.z <= 0) return; // muzzle: two cheek lobes + chin + nose bridge, pushed out along the normal
    const cx = Math.abs(v.x), f = sstep(.02, .14, v.z);
    const d = .064 * bump(Math.hypot((cx - .066) / .076, (y - .65) / .062)) + .026 * bump(Math.hypot(v.x / .055, (y - .592) / .036)) + .022 * bump(Math.hypot(v.x / .03, (y - .7) / .035));
    const k = d * f; v.x += nx * k; v.z += nz * k; },
  lulu(v, nx, nz, th, y){ // 4 armour plates under the dome: deep grooves, rounded plate bellies
    if(y < .05 || y > .55) return; const G = [.125, .245, .37, .525]; let dm = 9, gi = 0; for(let i = 0; i < 4; i++){ const d = Math.abs(y - G[i]); if(d < dm){ dm = d; gi = i; } }
    const k = -.017 * Math.exp(-((dm / .011) ** 2)) + .006 * sstep(.02, .06, dm); v.x += nx * k; v.z += nz * k; },
  jelly(v, nx, nz, th, y){ // ruffled skirt: 9 scallops in/out + up/down, smooth dome above
    const w = sstep(.37, .44, y) * (1 - sstep(.5, .56, y)); if(w <= 0) return; const c = Math.cos(9 * th);
    const k = .02 * c * w; v.x += nx * k; v.z += nz * k; v.y += .018 * c * w * (1 - sstep(.44, .5, y)); },
  giga(v, nx, nz, th, y){ // lip under the mantle (ledge)
    const k = -.008 * Math.exp(-(((y - .499) / .006) ** 2)); v.x += nx * k; v.z += nz * k; },
};

// ---------------------------------------------------------------- paint (fragment) shaders; p = rig units, so q = p / U
const W = 'vec3(0.860,0.930,1.000)';
const PAINT = {
  pip: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.03, 0.12, q.z);
  float lobe = zkAA(length(vec2((abs(q.x) - 0.118) / 0.092, (q.y - 0.708) / 0.112)) - 1.0);
  float belly = zkAA(length(vec2(q.x / 0.266, (q.y - 0.335) / 0.262)) - 1.0);
  float bridge = zkAA(length(vec2(q.x / 0.205, (q.y - 0.585) / 0.085)) - 1.0);
  float wedge = zkAA(abs(q.x) - 0.028) * step(0.645, q.y);           // black wedge between the eye lobes down to the beak
  float m = max(max(lobe, belly), bridge) * front * (1.0 - wedge);
  return mix(base, ${W}, m);
}`,
  sunny: U => `float zkHash(vec3 c){ return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float zkSpots(vec3 q, float cell, float keep, float r0, float r1){
  vec3 g = q / cell, id = floor(g); float best = 1e3;
  for(int i = -1; i <= 1; i++) for(int j = -1; j <= 1; j++) for(int k = -1; k <= 1; k++){
    vec3 o = vec3(float(i), float(j), float(k)), c = id + o; float n = zkHash(c); if(n > keep) continue;
    vec3 ctr = c + 0.2 + 0.6 * vec3(zkHash(c + 3.1), zkHash(c + 7.7), zkHash(c + 1.3));   // absolute cell coords: continuous across cells (no fwidth seams)
    float r = (r0 + (r1 - r0) * zkHash(c + 9.9)) / cell;
    best = min(best, (length(g - ctr) - r) * cell); }
  return zkAA(best * ${U.toFixed(3)}); }
vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 dark = vec3(0.045, 0.052, 0.068), ink = vec3(0.018, 0.018, 0.024);
  if(part > 1.5) return mix(base, dark, zkSpots(p / ${U.toFixed(3)} + vec3(3.0, 1.0, 2.0), 0.07, 0.6, 0.012, 0.019));   // flippers
  if(part > 0.5) return mix(base, dark, zkSpots(p * vec3(0.21, 0.16, 0.24) + vec3(5.0), 0.07, 0.55, 0.012, 0.018));      // feet (unit sphere)
  vec3 q = p / ${U.toFixed(3)};
  float front = smoothstep(0.05, 0.16, q.z);
  float face = zkAA(length(vec2(q.x / 0.19, (q.y - 0.69) / 0.135)) - 1.0) * front;   // keep the face clean
  float spots = zkSpots(q, 0.066, 0.84, 0.011, 0.023) * (1.0 - face);
  vec3 c = mix(base, dark, spots);
  // brow dots, whisker dots, open mouth
  float ink1 = zkAA((length(vec2(abs(q.x) - 0.078, q.y - 0.846)) - 0.0115) * ${U.toFixed(3)}) * front;
  vec2 w = vec2(abs(q.x), q.y); float wd = 0.0;
  wd = max(wd, zkAA((length(w - vec2(0.040, 0.664)) - 0.0085) * ${U.toFixed(3)})); wd = max(wd, zkAA((length(w - vec2(0.068, 0.668)) - 0.0085) * ${U.toFixed(3)}));
  wd = max(wd, zkAA((length(w - vec2(0.052, 0.643)) - 0.0085) * ${U.toFixed(3)})); wd = max(wd, zkAA((length(w - vec2(0.082, 0.646)) - 0.0085) * ${U.toFixed(3)}));
  wd = max(wd, zkAA((length(w - vec2(0.066, 0.624)) - 0.0075) * ${U.toFixed(3)}));
  float mouth = zkAA(length(vec2(q.x / 0.036, (q.y - 0.607) / 0.017)) - 1.0) * step(q.y, 0.612);
  return mix(c, ink, max(max(ink1, wd * front), mouth * front));
}`,
  jelly: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float under = 1.0 - smoothstep(0.40, 0.47, q.y);
  return mix(base, base * vec3(1.04, 0.95, 1.0), under * 0.6);
}`,
  lulu: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float g = 0.0; for(int i = 0; i < 4; i++){ float gy = i == 0 ? 0.125 : (i == 1 ? 0.245 : (i == 2 ? 0.37 : 0.525)); g = max(g, 1.0 - smoothstep(0.004, 0.012, abs(q.y - gy))); }
  return mix(base, base * 0.72, g * 0.8);
}`,
  percy: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float a = abs(atan(q.x, q.z));
  float yb = 0.405 + 0.065 * smoothstep(0.0, 1.1, a) - 0.03 * smoothstep(1.4, 2.6, a);
  float red = zkAA(q.y - yb);
  vec3 c = mix(base, vec3(0.542, 0.030, 0.028), red);
  float lip = zkAA(abs(q.y - yb + 0.006) - 0.004) * (1.0 - smoothstep(0.7, 1.0, a));
  return mix(c, vec3(0.45, 0.10, 0.08), lip * 0.55);
}`,
  nova: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float belly = zkAA(length(vec2(q.x / 0.212, (q.y - 0.39) / 0.195)) - 1.0) * smoothstep(0.04, 0.12, q.z);
  return mix(base, ${W}, belly);
}`,
  kelpie: U => `vec3 zkPaint(vec3 p, vec3 base, float part){ return base; }`,
  giga: U => `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base; vec3 q = p / ${U.toFixed(3)};
  float crease = 1.0 - smoothstep(0.0, 0.014, abs(q.y - 0.499));
  return mix(base, base * 0.7, crease * 0.75);
}`,
};

// ---------------------------------------------------------------- torso extras merged INTO the body mesh (H units)
const EXTRAS = {
  lulu(S){ const L = []; // two small walking legs per side
    for(const s of [-1, 1]) for(const [y, a] of [[.305, .55], [.195, .7]]){ const { p, n } = S(s * Math.PI / 2 * .97, y);
      L.push(tube([[p.x - n.x * .02, y + .005, p.z], [p.x + s * .03, y - .01, p.z - .005], [p.x + s * .052, y - .045, p.z - .01]], u => .024 - .006 * u, 12, 10)); }
    return L; },
  kelpie(S){ const L = [];
    // crown buds at the frond bases, sitting on the dome (front-ish)
    for(const [a, y, r] of [[0, .64, .038], [.85, .6, .033], [-.85, .6, .033]]){ const { p, n } = S(a, y); L.push(ell(r, r, r, { p: [p.x + n.x * r * .55, p.y + .012, p.z + n.z * r * .55] }, 18, 12)); }
    return L; },
  giga(S){ const L = [];
    for(const s of [-1, 1]) L.push(mantleFin(s));   // crisp pointed mantle fins (soft tip, no needle)
    // tentacle skirt: fat lobes hanging from y .38, front ones overlap the belly; outer ones flare out
    const A = [.3, -.3, .9, -.9, 1.55, -1.55, 2.3, -2.3, Math.PI];
    for(const a of A){ const side = Math.abs(Math.sin(a)), back = Math.cos(a) < -.3, R0 = .185, flare = .025 + .045 * side, len = back ? .2 : .22 - .03 * side;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a) * (Math.cos(a) > 0 ? 1.05 : 1));
      const pt = (r, y) => [dir.x * r, y, dir.z * r];
      L.push(tube([pt(R0 - .04, .37), pt(R0 + .004, .345), pt(R0 + flare * .8, .29), pt(R0 + flare, .36 - len * .75), pt(R0 + flare * .75, .36 - len)], u => .036 + .02 * sstep(0, .75, u), 20, 10)); }
    return L; },
};
/** raised seaweed strip on the torso: elliptical cross-section swept up the body, centre-line and width wobble,
 *  outer half lifted off the surface (a flap) so it reads as a separate ribbon. Sampler S -> {p, n} (H units). */
function ribbon(S, a0, ph, y0, y1){ const R = 64, C = 12, pos = [], idx = [];
  for(let i = 0; i <= R; i++){ const t = i / R, y = y0 + (y1 - y0) * t, env = Math.sin(Math.PI * Math.min(1, t)) ** .35;
    const ac = a0 + .13 * Math.sin(y * 17 + ph) + .05 * Math.sin(y * 33 + ph * 2), { p, n } = S(ac, y);
    const T = new THREE.Vector3(n.z, 0, -n.x).normalize(), ww = .05 * (.68 + .32 * Math.sin(y * 42 + ph)) * env, th = .02 * env, off = .012 * env;
    for(let j = 0; j < C; j++){ const f = j / C * TAU, cx = Math.cos(f), sy = Math.sin(f), lift = .018 * Math.sin(y * 29 + ph) * cx;
      pos.push(p.x + T.x * cx * ww + n.x * (off + sy * th + lift), p.y + .006 * Math.sin(y * 40 + ph) * cx, p.z + T.z * cx * ww + n.z * (off + sy * th + lift)); } }
  for(let i = 0; i < R; i++) for(let j = 0; j < C; j++){ const a = i * C + j, b = i * C + (j + 1) % C, c = a + C, d = b + C; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // orientation check at the outermost vertex of the middle ring (f = pi/2 -> along n)
  const k = (R >> 1) * C + (C >> 2), mid = S(a0, (y0 + y1) / 2).n, nn = g.attributes.normal;
  if(nn.getX(k) * mid.x + nn.getZ(k) * mid.z < 0){ const ix = g.index.array; for(let q = 0; q < ix.length; q += 3){ const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.computeVertexNormals(); }
  return g; }
/** Giga mantle fin: a crisp pointed flap (soft bevelled tip, not a needle). Grows +y, thin in z. */
function mantleFin(side){
  const pts = [[0, 0], [.02, .01], [.046, .045], [.052, .085], [.04, .125], [.02, .158], [0, .178], [-.014, .145], [-.022, .09], [-.016, .04], [-.006, .008]];
  const g = slab(pts, .02, .012, 3), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), t = Math.max(0, y / .178); p.setZ(i, p.getZ(i) + .014 * t * t); }
  g.computeVertexNormals(); return xf(g, { p: [side * .185, .70, -.02], r: [.2, 0, side * .55], s: [side, 1, 1] }); }
/** Ruffled kale / seaweed leaf (clay-thick continuous blade, not a stem with separate lobes). Grows +y from the origin. */
function kaleLeaf(len, hw, th, opt = {}){
  const o = Object.assign({ lean: .16, curve: .07, zwave: .028, phL: .3, phR: 1.85, f1: 3.3, f2: 6.6, twist: .32, segs: 40, rad: 16,
    lobesL: [[.18, 1.05, .11], [.44, .92, .12], [.68, .72, .11], [.9, .55, .1]],
    lobesR: [[.12, .82, .1], [.38, 1.08, .12], [.6, .82, .11], [.84, .58, .1]] }, opt);
  const mid = [];
  for(let i = 0; i <= o.segs; i++){ const t = i / o.segs;
    const env = (.4 + .6 * sstep(0, .14, t)) * (1 - sstep(.76, 1.02, t));
    mid.push({ t, env, x: o.curve * Math.sin(Math.PI * t) + o.lean * t * t * t + .02 * Math.sin(t * Math.PI * 1.7), y: t * len, z: o.zwave * Math.sin(t * Math.PI * 2.1 + o.phL) }); }
  const width = (t, env, lobes, ph) => { let w = .38 * env;
    for(const [c, a, s] of lobes){ const d = (t - c) / s; w += a * Math.exp(-d * d) * env; }
    w *= .58 + .12 * Math.sin(t * Math.PI * o.f1 + ph) + .06 * Math.sin(t * Math.PI * o.f2 + ph * 1.4);
    return Math.max(.16 * env, w) * hw; };
  const pos = [];
  const V = i => mid[Math.max(0, Math.min(mid.length - 1, i))];
  for(let i = 0; i <= o.segs; i++){
    const a = V(i - 1), b = V(i), c = V(i + 1);
    let tx = c.x - a.x, ty = c.y - a.y, tz = c.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let wx = 1, wy = 0, wz = 0, dt = wx * tx + wy * ty + wz * tz; wx -= dt * tx; wy -= dt * ty; wz -= dt * tz;
    let wl = Math.hypot(wx, wy, wz);
    if(wl < 1e-6){ wx = 0; wy = 0; wz = 1; dt = wx * tx + wy * ty + wz * tz; wx -= dt * tx; wy -= dt * ty; wz -= dt * tz; wl = Math.hypot(wx, wy, wz); }
    wx /= wl; wy /= wl; wz /= wl;
    const ang = o.twist * (b.t - .5), ca = Math.cos(ang), sa = Math.sin(ang), dot = tx * wx + ty * wy + tz * wz;
    const w2x = wx * ca + (ty * wz - tz * wy) * sa + tx * dot * (1 - ca);
    const w2y = wy * ca + (tz * wx - tx * wz) * sa + ty * dot * (1 - ca);
    const w2z = wz * ca + (tx * wy - ty * wx) * sa + tz * dot * (1 - ca);
    let bx = ty * w2z - tz * w2y, by = tz * w2x - tx * w2z, bz = tx * w2y - ty * w2x; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
    const wL = width(b.t, b.env, o.lobesL, o.phL), wR = width(b.t, b.env, o.lobesR, o.phR);
    const thick = th * (.75 + .25 * b.env), puff = 1 + .12 * (Math.max(wL, wR) / (hw || 1) - .5);
    const curlA = .32 * th * Math.sin(b.t * Math.PI * 2.4 + o.phL);
    for(let j = 0; j < o.rad; j++){ const tht = j / o.rad * TAU, cl = Math.cos(tht), sl = Math.sin(tht);
      const wr = cl >= 0 ? wR : wL, xr = wr * cl, zr = thick * puff * sl + curlA * cl * cl;
      pos.push(b.x + w2x * xr + bx * zr, b.y + w2y * xr + by * zr, b.z + w2z * xr + bz * zr); }
  }
  const idx = []; for(let i = 0; i < o.segs; i++) for(let j = 0; j < o.rad; j++){ const a = i * o.rad + j, b = i * o.rad + (j + 1) % o.rad, c = a + o.rad, d = b + o.rad; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  fixWinding(g); return g; }
// kelp leaf blade (x-y plane, thickness z), lobed edges; side mirrors
function leaf(len, hw, lobes, th, side = 1){
  const pts = [], N = 26; for(let i = 0; i <= N; i++){ const t = i / N, env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** .7, w = hw * env * (.5 + .5 * Math.abs(Math.sin(t * Math.PI * lobes + .3)));
    pts.push([w, t * len]); }
  const back = []; for(let i = N; i >= 0; i--){ const t = i / N, env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** .7, w = hw * env * (.5 + .5 * Math.abs(Math.sin(t * Math.PI * lobes + 1.9))); back.push([-w * .95, t * len]); }
  const g = slab([...pts, ...back], th * .4, th * .45, 2), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), t = y / len; p.setX(i, side * (p.getX(i) + Math.sin(t * Math.PI * 1.3) * hw * .25)); p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 40) * th * .25 + Math.sin(t * 5) * th * .3); }
  if(side < 0){ const ix = g.index ? g.index.array : null; if(ix) for(let i = 0; i < ix.length; i += 3){ const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  g.computeVertexNormals(); return g; }

// ---------------------------------------------------------------- arms (arm-local, H units; the limb runs along -y)
const ARMS = {
  pipFlipper(){ const g = ell(.044, .172, .075, {}, 24, 18), p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) + .03 * (y / .172) ** 2 - .01); p.setZ(i, p.getZ(i) * (1 - .25 * Math.max(0, -y / .172))); } g.translate(0, -.135, 0); g.computeVertexNormals(); return { g, rz: .14, rx: .05 }; },
  sunnyFlipper(){ const g = ell(.046, .13, .1, {}, 24, 18), p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) * (1 + .25 * Math.max(0, -y / .13)) + .012 * (y / .13) ** 2); } g.translate(0, -.1, 0); g.computeVertexNormals(); return { g, rz: .22, rx: 0 }; },
  novaFlipper(){ const g = ell(.034, .1, .064, {}, 22, 16); g.translate(0, -.075, 0); g.computeVertexNormals(); return { g, rz: .55, rx: -.05 }; },
  kelpArm(){ const g = ell(.042, .1, .056, {}, 22, 16); g.translate(0, -.075, 0); g.computeVertexNormals(); return { g, rz: .34, rx: .0 }; },
  percyFin(){ const g = ell(.046, .125, .09, {}, 24, 16), p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 + .25 * Math.max(0, -y / .125)) + .015 * (y / .125)); } g.translate(0, -.1, 0); g.computeVertexNormals(); return { g, rz: .72, rx: -.12 }; },
  luluClaw(){ // upper arm out, visible elbow, forearm up to a big mitten claw (outer finger big, inner thumb small)
    const arm = tube([[0, .02, 0], [.01, -.06, .005], [.035, -.115, .015], [.06, -.14, .02], [.07, -.2, .02], [.06, -.24, .015]], u => .044 - .008 * sstep(.45, 1, u), 16, 12, false);
    const palm = ell(.105, .112, .08, { p: [.055, -.29, .015] }, 26, 18);
    const outer = tube([[.085, -.335, .015], [.11, -.395, .01], [.08, -.45, .01]], u => .06 - .022 * u, 14, 12);
    const inner = tube([[.015, -.345, .015], [-.005, -.395, .01], [.015, -.43, .01]], u => .046 - .017 * u, 12, 12);
    return { g: mergeG([arm, palm, outer, inner]), rz: 2.05, rx: -.08 }; },
  jellyTent(){ return { g: tube(jellyCurve(.24, 1, .9), u => .032 - .012 * u, 36, 10), rz: .08, rx: .05 }; },
  gigaTent(){ const g = tube([[0, .03, 0], [.02, -.04, .005], [.045, -.12, .01], [.055, -.2, .005], [.045, -.26, 0]], u => .036 + .02 * sstep(0, .75, u), 24, 12); return { g, rz: .1, rx: 0 }; },
};
// S-curl: down, kink in, out, then the tip curls up and outward (x = outward, y = down, z = tangential wobble)
function jellyCurve(len, side, out = 1){ const K = [[0, 0], [.01, -.25], [-.012, -.45], [.03, -.66], [.07, -.84], [.115, -.87], [.13, -.75], [.11, -.67]];
  return K.map(([x, y], i) => [side * x * out * len / .25, y * len, .008 * Math.sin(i * 1.7)]); }

// ---------------------------------------------------------------- build + cache
const GEO = {};
function geos(kind){
  if(GEO[kind]) return GEO[kind];
  const V = B2[kind], U = V.U, def = DEFORM[kind];
  const rowsD = profileRows(V.prof, V.rows, V.rz);
  const torsoH = lathe(rowsD, V.seg, def), S = sampler(rowsD, def);
  const extras = EXTRAS[kind] ? EXTRAS[kind](S) : [];
  const G = { S, U };
  G.body = scaleG(mergeG([torsoH, ...extras]), U);
  if(kind === 'giga'){ // blunt mantle top used only when a hat is on, so the point does not poke through
    const blunt = V.prof.filter(r => r[0] <= .88).concat([[.90, .07, .07], [.918, 0, 0]]);
    G.bodyHat = scaleG(mergeG([lathe(profileRows(blunt, V.rows, V.rz), V.seg, def), ...extras]), U); }
  // clothing profile (rig units): radius = max(rx, rz) per row (tees/pants follow this silhouette)
  G.prof = rowsD.map(r => new THREE.Vector2(Math.max(r[1], r[2]) * U, r[0] * U));
  G.sphere = sph(28, 18);
  const A = ARMS[V.arm](); G.arm = scaleG(A.g, U); G.armR = A;
  const mesh = new THREE.Mesh(G.body); const rc = new THREE.Raycaster();
  /** front surface hit at (x,y) rig units -> { p, n } */
  G.hit = (x, y) => { rc.set(new THREE.Vector3(x, y, 9), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(mesh, false)[0];
    if(!h) return { p: new THREE.Vector3(x, y, 0), n: Zv.clone() }; const n = h.face.normal.clone(); return { p: h.point.clone(), n }; };
  FEAT[kind] && (G.feat = FEAT[kind](G, V));
  Object.values(G).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  if(G.feat) Object.values(G.feat).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  return (GEO[kind] = G);
}
// feature geometries in rig units (static meshes): returns { name: geometry } where positions are already final (rig or head-local noted)
const FEAT = {
  pip(G, V){ const U = V.U, h = G.hit(0, .69 * U);  // beak: rounded wedge, wide at the top, tip slightly down
    const cone = new THREE.ConeGeometry(.068, .11, 22, 6); cone.deleteAttribute('uv'); cone.rotateX(Math.PI / 2); cone.scale(1, .62, 1); cone.translate(0, 0, .05);
    const base = ell(.068, .042, .03); const beak = mergeG([cone, base]); xf(beak, { r: [.22, 0, 0] }); scaleG(beak, U);
    beak.translate(h.p.x, h.p.y - V.headY, h.p.z - .01); return { beakHead: beak }; },
  sunny(G, V){ const U = V.U, h = G.hit(0, .697 * U); const nose = ell(.04, .026, .024, { r: [-.15, 0, 0] }); { const np = nose.attributes.position; for(let i = 0; i < np.count; i++){ const y = np.getY(i); np.setX(i, np.getX(i) * (1 + .45 * y / .026)); } nose.computeVertexNormals(); } const tri = new THREE.ConeGeometry(.03, .04, 3, 1); tri.deleteAttribute('uv');
    const g = mergeG([nose]); scaleG(g, U); g.translate(h.p.x, h.p.y - V.headY, h.p.z - .005); return { noseHead: g }; },
  lulu(G, V){ const U = V.U, L = []; // antennae (head-local, two wiggle groups) built as geometry at origin pointing up/out (+x)
    const ant = tube([[0, -.02, 0], [.02, .065, .005], [.075, .14, .01], [.14, .185, .01], [.175, .195, .005]], u => .012 - .0024 * u, 24, 8, false);
    const tip = ell(.018, .018, .018, { p: [.175, .195, .005] }, 16, 12); const g = scaleG(mergeG([ant, tip]), U); return { ant: g }; },
  percy(G, V){ const U = V.U, out = {};
    // teeth along the lip (rig-local, below the neck band)
    const T = []; const yb = a => .405 + .065 * sstep(0, 1.1, Math.abs(a));
    for(let i = 0; i < 8; i++){ const a = -.66 + i * (1.32 / 7), y = yb(a), { p, n } = G.S(a, y + .004);
      const t = ell(.027, .036, .019, {}, 14, 10); { const tp = t.attributes.position; for(let k = 0; k < tp.count; k++){ const yy = tp.getY(k); if(yy < 0){ const f = 1 - .6 * (-yy / .036); tp.setX(k, tp.getX(k) * f); tp.setZ(k, tp.getZ(k) * f); } } } t.translate(0, -.022, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(Zv, new THREE.Vector3(n.x, 0, n.z).normalize());
      xf(t, { p: [p.x + n.x * .004, p.y, p.z + n.z * .004], q }); T.push(t); }
    out.teethRig = scaleG(mergeG(T), U);
    // crest on top (head-local): scalloped fan of 5 rounded spikes, sitting along the top curve
    const cr = slab([[-.17, .73], [-.19, .8], [-.17, .865], [-.13, .86], [-.11, .91], [-.07, .935], [-.04, .9], [-.01, .965], [.03, .985], [.06, .935], [.09, .96], [.12, .95], [.14, .9], [.17, .87], [.2, .82], [.21, .76], [.16, .72], [0, .7]], .022, .018, 5);
    cr.scale(.85, 1, 1); cr.rotateY(-Math.PI / 2); out.crestHead = scaleG(cr, U); out.crestHead.translate(0, -V.headY, 0);
    // fan tail (tail-local: attach at origin, fan behind along -z), radial ridges
    const fan = [[.03, 0], [-.02, -.05]]; for(let i = 0; i <= 12; i++){ const a = -.95 + 1.9 * i / 12, r = .215 + .012 * Math.cos(i * Math.PI); fan.push([-.03 - r * Math.cos(a), r * Math.sin(a)]); } fan.push([-.02, .05]);
    let tl = slab(fan, .02, .016, 6); const tp = tl.attributes.position;
    for(let i = 0; i < tp.count; i++){ const x = tp.getX(i), y = tp.getY(i), ang = Math.atan2(y, -x - .03), r = Math.hypot(x + .03, y); tp.setZ(i, tp.getZ(i) * (1 - .35 * sstep(.05, .16, r) * (.5 + .5 * Math.cos(ang * 10.5)))); }
    tl.computeVertexNormals(); tl.rotateY(-Math.PI / 2); out.tail = scaleG(tl, U);
    return out; },
  nova(G, V){ const U = V.U, out = {};
    const horn = new THREE.ConeGeometry(.066, .22, 24, 32); horn.deleteAttribute('uv'); const hp = horn.attributes.position;
    for(let i = 0; i < hp.count; i++){ const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), u = (y + .11) / .22, a = Math.atan2(z, x); const r = 1 + .2 * Math.sin(a + u * Math.PI * 2 * 4.5) * (1 - u * .4); const tip = u > .9 ? 1 + (u - .9) * 3 : 1; hp.setXYZ(i, x * r * tip, y, z * r * tip); }
    let hornW = weld(horn); const hb = ell(.064, .026, .064, { p: [0, -.11, 0] }); const hg = mergeG([hornW, hb]); xf(hg, { p: [0, .095, 0] });
    out.horn = scaleG(hg, U);
    // tail: from the lower back, down to the floor, flat fluke behind (tail-local)
    const t = tube([[0, .03, .06], [0, -.03, -.04], [0, -.075, -.12], [0, -.08, -.19]], u => .09 - .045 * u, 24, 12);
    const fl = []; for(const s of [-1, 1]) fl.push(ell(.1, .03, .055, { p: [s * .075, -.07, -.22], r: [.25, s * .6, -s * .25] }, 20, 12));
    out.tail = scaleG(mergeG([t, ...fl]), U); return out; },
  kelpie(G, V){ const U = V.U, out = {}; // 3 ruffled kale-like crown leaves (head-local, each its own wiggle group) + body ribbons (rig-local, hidden under a top)
    out.frondC = scaleG(kaleLeaf(.27, .10, .028, { lean: .22, curve: .05, phL: .4, phR: 2.1, zwave: .03 }), U);
    out.frondL = scaleG(kaleLeaf(.215, .088, .025, { lean: -.06, curve: .08, phL: 1.2, phR: .2, zwave: .024, twist: .4 }), U);
    out.frondR = scaleG(kaleLeaf(.22, .09, .025, { lean: .1, curve: -.05, phL: 2.0, phR: .8, zwave: .026, twist: -.28 }), U);
    const ribs = []; for(const [a0, ph, y1] of [[1.0, 0, .52], [-1.0, 1.7, .6], [2.25, 2.4, .5], [-2.25, .9, .54]]) ribs.push(ribbon(G.S, a0, ph, .09, y1));
    out.ribbons = scaleG(mergeG(ribs), U); return out; },
  jelly(G, V){ const U = V.U, out = {}; const L = [];
    // under-bell plug that the legs come out of
    out.plug = scaleG(ell(.17, .03, .16, { p: [0, .382, 0] }, 28, 10), U);
    // 8 curly tentacles hanging from the skirt underside (4 groups of 2, group-local origin at the group pivot)
    out.tents = [];
    for(const pair of [[.32, .95], [-.32, -.95], [2.25, 2.85], [-2.25, -2.85]]){ const list = [], ca = (pair[0] + pair[1]) / 2, piv = [Math.sin(ca) * .28, .4, Math.cos(ca) * .28];
      for(const a of pair){ const o = [Math.sin(a), Math.cos(a)], tg = [Math.cos(a), -Math.sin(a)], r = .3, base = [o[0] * r - piv[0], .41 - piv[1], o[1] * r - piv[2]];
        const len = .24 + .04 * Math.abs(Math.cos(a * 3)), out = .5 + .5 * Math.abs(Math.sin(a));
        const c = jellyCurve(len, 1, out).map(p => [base[0] + o[0] * p[0] + tg[0] * p[2], base[1] + p[1], base[2] + o[1] * p[0] + tg[1] * p[2]]);
        list.push(tube(c, u => .033 - .013 * u, 36, 10)); }
      out.tents.push({ g: scaleG(mergeG(list), U), piv: piv.map(v => v * U) }); }
    out.tents.forEach(t => t.g.userData.shared = true); return out; },
};

// ---------------------------------------------------------------- material helper
function mats(kind, V, ghost){
  const o = { rough: V.rough ?? .8, cc: .05, sheen: V.sheen ?? .3 }; if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const glsl = PAINT[kind](V.U), paint = part => ({ key: 'b2' + kind, glsl, off: [0, 0, 0], part });
  const neck = { a: V.neck[0], b: V.neck[1] };
  return { o, body: clay(V.color, ghost, { ...o, paint: paint(0), neck }), plain: clay(V.color, ghost, o),
    paint, c: (hex, x = {}) => clay(hex, ghost, { ...o, ...x }) };
}

/** Build one batch-2 character (same contract as buildOllie). D = installOllieV2 deps. */
export function buildB2(kind, { equipped = {}, ghost = false } = {}, D = {}){
  const V = B2[kind], G = geos(kind), U = V.U, M = mats(kind, V, ghost), black = gloss(ghost);
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const body = new THREE.Mesh((kind === 'giga' && equipped.hat && G.bodyHat) ? G.bodyHat : G.body, M.body); rig.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.y = V.headY; rig.add(head); parts.head = head;
  neckTorso(body, M.body, head, V.headY, ghost); parts.headMesh = body;
  const HY = V.headY, addH = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); if(name) m.name = name; head.add(m); return m; };
  // ---- face (head-local): eyes on the surface, oriented to the normal; smile torus
  const eyeY = V.eye.y * U, ex = V.eye.x * U, eh = G.hit(ex, eyeY);
  for(const s of [-1, 1]){
    const eye = new THREE.Mesh(G.sphere, black); eye.name = 'eye'; eye.scale.set(...V.eye.s.map(v => v * U));
    const n = eh.n.clone(); n.x *= s; eye.position.set(eh.p.x * s - n.x * .012, eh.p.y - HY - n.y * .012, eh.p.z - n.z * .012);
    eye.quaternion.setFromUnitVectors(Zv, n); head.add(eye);
    const sh = new THREE.Mesh(G.sphere, shineMat()); sh.scale.set(.2, .2, .2); sh.position.set(.32, .38, .82); eye.add(sh); if(ghost) sh.visible = false;
  }
  if(V.smile){ const k = 'smile', sg = G[k] || (G[k] = (() => { const t = new THREE.TorusGeometry(V.smile.w * U, V.smile.t * U, 8, 28, V.smile.arc); t.deleteAttribute('uv'); t.rotateZ(-Math.PI / 2 - V.smile.arc / 2); t.userData.shared = true; return t; })());
    const h = G.hit(0, V.smile.y * U), m = new THREE.Mesh(sg, black); m.position.set(h.p.x, h.p.y - HY + V.smile.w * U * .5, h.p.z - .006); m.quaternion.setFromUnitVectors(Zv, h.n); head.add(m); }
  // ---- accessory anchors (fit to the measured head): hat brim ring sits where the head radius matches the cap
  const top = (kind === 'giga' ? .918 : V.prof[V.prof.length - 1][0]) * U, yb = top - (kind === 'giga' ? .22 : .44), rb = radAt(G.prof, yb), hs = rb * 1.06 / .47;
  const hatA = new THREE.Group(); hatA.position.y = yb - .22 * hs - HY; hatA.scale.setScalar(hs); head.add(hatA); parts.hatAnchor = hatA;
  const es = Math.max(.75, eh.p.x / .2), eyeA = new THREE.Group(); eyeA.position.set(0, eh.p.y - HY - .15 * es, eh.p.z + .035 - .5 * es); eyeA.scale.set(es, es, es); head.add(eyeA); parts.eyeAnchor = eyeA;
  // ---- arms
  const armM = kind === 'sunny' ? clay(V.color, ghost, { ...M.o, paint: M.paint(2) }) : (kind === 'jelly' ? M.c(V.pink) : M.plain);
  for(const s of [-1, 1]){
    const shg = new THREE.Group(); shg.position.set(V.sh[0] * U * s, V.sh[1] * U, V.sh[2] * U); rig.add(shg); parts['sh' + s] = shg;
    const arm = new THREE.Mesh(G.arm, armM); arm.rotation.set(G.armR.rx, 0, G.armR.rz * s); if(s < 0) arm.scale.x = -1; shg.add(arm); parts['arm' + s] = arm;
    const F = V.foot, fM = F.color != null ? M.c(F.color) : (kind === 'sunny' ? clay(V.color, ghost, { ...M.o, paint: M.paint(1) }) : M.plain);
    const fg = F.leg ? (G.leg || (G.leg = legGeo())) : G.sphere;
    const foot = new THREE.Mesh(fg, fM); foot.scale.set(...F.s.map(v => v * U)); foot.position.set(F.x * U * s, F.y * U, F.z * U); rig.add(foot); parts['foot' + s] = foot;
    if(F.toes){ const tM = M.c(F.toes); for(const k of [-1, 0, 1]){ const t = new THREE.Mesh(G.sphere, tM); t.scale.set(.3, .55, .3); t.position.set(.45 * k, -.2, .78 - .08 * Math.abs(k)); foot.add(t); } }
  }
  // ---- tail (Group so every species has one; empty where the mockup shows none)
  const tail = new THREE.Group(); tail.name = 'tailPivot'; rig.add(tail); parts.tail = tail;
  // ---- species features
  const F = G.feat || {}, hideTop = !!equipped.hat;
  if(kind === 'pip') addH(F.beakHead, M.c(0xf08a1c));
  if(kind === 'sunny') addH(F.noseHead, M.c(0x121214, { rough: .45 }));
  if(kind === 'lulu'){ for(const s of [-1, 1]){ const gg = new THREE.Group(); gg.name = 'gill'; gg.position.set(s * .045 * U, .785 * U - HY, .0); const m = new THREE.Mesh(F.ant, M.plain); if(s < 0) m.scale.x = -1; gg.add(m); gg.visible = !hideTop; head.add(gg); } }
  if(kind === 'percy'){ const t = new THREE.Mesh(F.teethRig, M.c(0xf4f6fa, { rough: .5, cc: .2 })); rig.add(t);
    const c = addH(F.crestHead, M.plain); c.visible = !hideTop;
    tail.position.set(0, .56 * U, -.33 * U); tail.add(new THREE.Mesh(F.tail, M.plain)); }
  if(kind === 'nova'){ const h = new THREE.Mesh(F.horn, M.c(0xf2cf3a, { rough: .62, sheen: .2 })); h.position.set(0, .8 * U - HY, .035 * U); h.rotation.x = .16; h.visible = !hideTop; head.add(h);
    tail.position.set(0, .17 * U, -.2 * U); tail.add(new THREE.Mesh(F.tail, M.plain)); }
  if(kind === 'kelpie'){ const fm = M.plain;
    for(const [geo, x, y, z, rz, rx] of [[F.frondC, 0, .655, .0, -.02, -.08], [F.frondL, -.1, .625, .01, .52, -.1], [F.frondR, .1, .625, .01, -.52, -.1]]){
      const gg = new THREE.Group(); gg.name = 'frond'; gg.position.set(x * U, y * U - HY, z * U); gg.rotation.set(rx, 0, rz); gg.add(new THREE.Mesh(geo, fm)); gg.visible = !hideTop; head.add(gg); }
    const bl = M.c(0xf0a39a, { rough: .9, sheen: .15 }); for(const s of [-1, 1]){ const h = G.hit(s * .125 * U, .44 * U), b = new THREE.Mesh(G.sphere, bl); b.scale.set(.022 * U, .017 * U, .006 * U); b.position.set(h.p.x - h.n.x * .004, h.p.y - HY, h.p.z - .004); b.quaternion.setFromUnitVectors(Zv, h.n); head.add(b); }
    const rib = new THREE.Mesh(F.ribbons, M.plain); rib.name = 'ribbons'; rib.visible = !equipped.top; rig.add(rib); }
  if(kind === 'giga'){ const bl = M.c(0xf4a49a, { rough: .9, sheen: .15 }); for(const s of [-1, 1]){ const h = G.hit(s * .135 * U, .418 * U), b = new THREE.Mesh(G.sphere, bl); b.scale.set(.02 * U, .02 * U, .005 * U); b.position.set(h.p.x, h.p.y - HY, h.p.z - .003); b.quaternion.setFromUnitVectors(Zv, h.n); head.add(b); } }
  if(kind === 'jelly'){ const pm = M.c(V.pink); rig.add(new THREE.Mesh(F.plug, pm));
    for(const t of F.tents){ const gg = new THREE.Group(); gg.name = 'tent'; gg.position.set(...t.piv); gg.add(new THREE.Mesh(t.g, pm)); rig.add(gg); }
    tail.position.set(0, .41 * U, -.3 * U); }
  g.traverse(m => { if(m.isMesh) m.userData.base = true; });
  if(D.setProfile) D.setProfile(clothProfile(G.prof, kind));
  if(!ghost && D.addEquipment) D.addEquipment(rig, parts, equipped);
  g.traverse(m => { if(m.isMesh) m.castShadow = !ghost; });
  g.userData.parts = parts; g.userData.walk = 0; g.userData.kind = kind; g.userData.v2 = 'C'; g.userData.animStyle = V.anim;
  return g;
}
function radAt(P, y){ for(let i = 1; i < P.length; i++) if(P[i].y >= y){ const a = P[i - 1], b = P[i]; return a.x + (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1); } return P[P.length - 1].x; }
/** unit leg for Jelly (fits the unit sphere so shoes still scale right): flared foot, slim middle */
function legGeo(){ const pts = []; for(let i = 0; i <= 20; i++){ const t = i / 20, y = -1 + 2 * t; pts.push(new THREE.Vector2(t < .02 ? 0 : .66 + .32 * (1 - sstep(0, .32, t)) + .26 * sstep(.5, 1, t), y)); }
  pts[pts.length - 1].x = .92; pts.push(new THREE.Vector2(.6, 1.05), new THREE.Vector2(0, 1.07)); const g = new THREE.LatheGeometry(pts, 24); g.deleteAttribute('uv'); g.computeVertexNormals(); g.userData.shared = true; return g; }
/** tees/pants profile: monotonic in y, never extrapolates below the first radius (dome bodies) */
export function clothProfile(P, kind){ let i = 0; while(i < P.length && P[i].x < .08) i++; const sk = P[Math.min(i, P.length - 1)], out = [];
  if(sk.y > .02) out.push(new THREE.Vector2(sk.x, 0)); for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  if(kind === 'giga'){ out.teeBottom = .50; out.teeTop = .94; }  // face sits at y≈1.01–1.10; default tee 0.6–1.2 would cover it
  return out; }
export const B2_PROFILES = {}; // filled lazily (needs geometry); use b2Profile(kind)
export function b2Profile(kind){ return B2_PROFILES[kind] || (B2_PROFILES[kind] = geos(kind).prof); }
