// ollie-v2.js: Ollie the Otter V2 ("vision" clay-toy look from Zander's mockup).
// Drop-in replacement for game.js buildOllie(opts) with the SAME parts contract:
//   g.userData.parts = { rig, body, head, hatAnchor, eyeAnchor, 'sh-1', sh1, 'arm-1', arm1, 'foot-1', foot1, tail, headMesh }
// Same hierarchy as today: g > rig > { body, head > {hatAnchor, eyeAnchor, face bits}, sh±1 > arm±1, foot±1, tail }.
// Geometry + materials are built ONCE and cached/shared (buildOllie reruns on every outfit change). No skinned meshes,
// nothing per frame. ghost=true gives the transparent race ghost (own cached materials, no shadows).
//
// Usage (game):  installOllieV2({ CMAP, isPlayable, dressSpecies, addEquipment, getSave: () => S });
//                then buildOllieV2(opts) wherever buildOllie(opts) is called.
// For tees/pants to fit the new silhouette, OLLIE_PROFILE in game.js must be replaced by OLLIE_PROFILE_V2
// (bodyR()/profileSlice() read it). See MERGE_NOTE.md.
import * as THREE from './vendor/three.module.min.js?v=20261116-8';
import { buildSpeciesV2 } from './species-v2.js?v=20261116-8';

export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- three takes on the mockup (same parts contract + same animateChar states) ----------
// A = faithful clay otter (closest to the mockup) · B = chunkier, rounder toy, bigger head · C = sleek: longer body,
// bigger curling tail, cream belly, playful idle/walk. Profiles are [radius, y]; NECK_Y >= 1.1 everywhere so tees fit.
export const VARIANTS = {
  A: { label: 'A · Faithful clay', color: 0x6a4733, neckY: 1.12, headY: 1.5, widen: .03, flat: .02,
    body: [[0,.12],[.279,.125],[.456,.17],[.544,.28],[.572,.44],[.563,.62],[.535,.8],[.502,.96],[.479,1.06],[.472,1.12]],
    head: [[.488,1.16],[.525,1.27],[.549,1.4],[.555,1.52],[.544,1.66],[.507,1.8],[.432,1.94],[.316,2.04],[.158,2.1],[0,2.12]],
    muz: { lx: .19, ly: -.15, lrx: .33, lry: .205, cy: -.28, crx: .4, cry: .15, bump: .06 },
    eye: { x: .28, y: .13, s: [.078, .083, .058] }, nose: { y: -.02, s: [.13, .09, .09] }, mouth: { line: -.12, smile: -.16, w: .052 },
    ear: { y: .24, s: [.135, .135, .095] }, sh: { y: 1.05, z: .13, inset: .045 }, arm: { r: .105, len: .38, rz: .13 },
    foot: { x: .215, y: .14, z: .16, s: [.21, .16, .26] },
    tail: { R: .2, taper: .68, pts: [[0,0,0],[.04,-.13,-.24],[.26,-.22,-.46],[.62,-.24,-.52],[.95,-.22,-.45]], pos: [.03, .33, -.36] },
    hat: { y: .1, s: 1.2 }, eyeA: { p: [0, -.035, 0], s: [1.32, 1.22, 1.12] }, belly: false, anim: 'calm' },
  B: { label: 'B · Chunky toy', color: 0x76492e, neckY: 1.1, headY: 1.56, widen: .05, flat: .03,
    body: [[0,.14],[.3,.145],[.5,.19],[.6,.3],[.63,.46],[.615,.64],[.575,.82],[.53,.97],[.5,1.05],[.495,1.1]],
    head: [[.52,1.15],[.6,1.27],[.655,1.42],[.67,1.58],[.655,1.76],[.6,1.93],[.5,2.07],[.34,2.18],[.16,2.23],[0,2.24]],
    muz: { lx: .21, ly: -.17, lrx: .37, lry: .23, cy: -.32, crx: .45, cry: .16, bump: .075 },
    eye: { x: .3, y: .1, s: [.098, .104, .07] }, nose: { y: -.045, s: [.15, .105, .1] }, mouth: { line: -.15, smile: -.19, w: .056 },
    ear: { y: .3, s: [.17, .17, .11] }, sh: { y: 1.0, z: .12, inset: .055 }, arm: { r: .115, len: .24, rz: .2 },
    foot: { x: .23, y: .15, z: .17, s: [.23, .17, .25] },
    tail: { R: .21, taper: .6, pts: [[0,0,0],[.04,-.13,-.22],[.24,-.21,-.4],[.52,-.22,-.44],[.74,-.2,-.36]], pos: [.03, .33, -.38] },
    hat: { y: .15, s: 1.38 }, eyeA: { p: [0, -.08, .02], s: [1.45, 1.3, 1.24] }, belly: false, anim: 'chunky' },
  C: { label: 'C · Sleek & playful', color: 0x603c28, neckY: 1.24, headY: 1.66, widen: .09, flat: 0,
    body: [[0,.1],[.26,.105],[.42,.15],[.5,.26],[.525,.42],[.515,.62],[.49,.82],[.462,1.0],[.443,1.14],[.437,1.24]],
    head: [[.452,1.28],[.482,1.38],[.5,1.5],[.505,1.64],[.49,1.8],[.45,1.94],[.37,2.07],[.25,2.16],[.11,2.21],[0,2.22]],
    muz: { lx: .15, ly: -.13, lrx: .28, lry: .18, cy: -.25, crx: .34, cry: .13, bump: .1 },
    eye: { x: .245, y: .12, s: [.07, .082, .055] }, nose: { y: -.02, s: [.115, .08, .085] }, mouth: { line: -.11, smile: -.15, w: .046 },
    ear: { y: .2, s: [.11, .11, .08] }, sh: { y: 1.17, z: .1, inset: .04 }, arm: { r: .095, len: .42, rz: .1 },
    foot: { x: .2, y: .12, z: .2, s: [.19, .13, .28] },
    tail: { R: .25, taper: .72, pts: [[0,0,0],[.05,-.15,-.26],[.3,-.25,-.52],[.75,-.27,-.58],[1.12,-.2,-.38],[1.26,.06,-.2]], pos: [.03, .33, -.33] },
    hat: { y: .08, s: 1.1 }, eyeA: { p: [0, -.02, 0], s: [1.18, 1.16, 1.06] }, belly: true, anim: 'playful' },
};
export function spline(pts, n){ return new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(n).map(p => new THREE.Vector2(Math.max(0, p.x), p.y)); }
/** Outer profile per variant for bodyR()/profileSlice() (tees, pants, jacket collar/zip). Replace game.js OLLIE_PROFILE with the chosen one. */
export const OLLIE_PROFILES = {}; for(const k in VARIANTS) OLLIE_PROFILES[k] = spline([...VARIANTS[k].body, ...VARIANTS[k].head], 90);
export const OLLIE_PROFILE_V2 = OLLIE_PROFILES.A;
let VAR = 'C';  // Zander picked C as the base                                            // default variant for buildOllieV2 (opts.variant overrides)
export function setOllieVariant(v){ if(VARIANTS[v]) VAR = v; }
function muzzleE(M, x, y){             // <0 inside, ~-1 at the lobe centres (normalised ellipse distance)
  const a = Math.hypot((Math.abs(x) - M.lx) / M.lrx, (y - M.ly) / M.lry) - 1;
  const b = Math.hypot(x / M.crx, (y - M.cy) / M.cry) - 1;
  return Math.min(a, b); }

let SPHERE = null;
const V2 = { geo: {}, mats: new Map() };
function geos(vk){
  if(V2.geo[vk]) return V2.geo[vk]; const V = VARIANTS[vk], G = {}, N = V.neckY, M = V.muz;
  const rN = V.body[V.body.length - 1][0];
  // ONE continuous torso: body and head are a single smooth lathe (no neck seam, collar or fold). The head part follows the
  // head group in the vertex shader (see neckTorso), so head turns still carry the face. Rest coords = body coords.
  G.body = torsoLathe(V, (v) => {
    const yl = v.y - V.headY, k = sstep(N - V.headY, N - V.headY + .23, yl);
    v.x *= 1 + V.widen * k; v.z *= 1 - V.flat * k;
    if(v.z > 0){ const e = muzzleE(M, v.x, yl); if(e < .25){ const front = sstep(.05, .32, v.z);
        const r = Math.hypot(v.x, v.z) || 1; const d = M.bump * sstep(.25, -.55, e) * front; v.x += v.x / r * d; v.z += v.z / r * d; } }
  });
  G.sphere = SPHERE || (SPHERE = new THREE.SphereGeometry(1, 28, 18));
  // soft paddle arms hanging along the sides (built with real dims so gloves/bracelets keep scale 1)
  G.arm = blendArm(new THREE.CapsuleGeometry(V.arm.r, V.arm.len, 10, 20), V.arm.r, V.arm.len, [1, .8]);
  // thick tapered tail, curving behind and out to the right, resting on the floor
  { const curve = new THREE.CatmullRomCurve3(V.tail.pts.map(p => new THREE.Vector3(...p)));
    const R = V.tail.R, tg = new THREE.TubeGeometry(curve, 40, R, 18, false), pos = tg.attributes.position, uv = tg.attributes.uv, v = new THREE.Vector3(), c = new THREE.Vector3();
    for(let i = 0; i < pos.count; i++){ const u = uv.getX(i); curve.getPointAt(u, c); v.fromBufferAttribute(pos, i).sub(c);
      const taper = (1 - V.tail.taper * Math.pow(u, 1.25)) * (1 + .3 * (1 - sstep(0, .22, u))); v.multiplyScalar(taper); v.y *= .82; v.add(c); v.y = Math.max(v.y, -.31); pos.setXYZ(i, v.x, v.y, v.z); }
    const end = curve.getPointAt(1), rt = R * (1 - V.tail.taper); const tip = new THREE.SphereGeometry(1, 20, 14); tip.scale(rt, rt * .82, rt); tip.translate(end.x, end.y, end.z);
    const base = new THREE.SphereGeometry(R * .98, 24, 16);
    G.tail = merge([tg, tip, base]); }
  // tiny face bits
  G.smile = new THREE.TorusGeometry(V.mouth.w, .0095, 8, 24, Math.PI);
  G.line = new THREE.CapsuleGeometry(.0095, .055, 4, 8);
  Object.values(G).forEach(g => { g.userData.shared = true; });
  return (V2.geo[vk] = G);
}
/** One smooth lathe for body + head (profile = body pts then head pts, in body coords). fn shapes the vertices. */
export function torsoLathe(V, fn){ return smoothLathe(spline([...V.body, ...V.head], 150), 80, fn); }
/** Arms that blend into the body: the top of the capsule flares and sinks into the torso (no pasted-on seam). */
export function blendArm(g, r, len, sc = [1, 1]){ const p = g.attributes.position, top = len / 2 + r;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), f = 1 + .38 * sstep(.1 * top, top, y); p.setX(i, p.getX(i) * f * sc[0]); p.setZ(i, p.getZ(i) * f * sc[1]); }
  g.translate(0, -.1, 0); g.computeVertexNormals(); return g; }
// ---------- neck blend: the head part of the torso follows the head group (vertex shader, no skinning) ----------
// weight w = smoothstep(a, b, y_rest): 0 = body, 1 = head. zkHead = body^-1 * head * rest^-1 (updated in onBeforeRender/
// onBeforeShadow from preallocated matrices, nothing allocated per frame). Each built character gets its own tiny clone of
// the cached torso material (same program: same customProgramCacheKey) so several characters can be drawn at once.
const NECK_GLSL_N = (a, b) => `float zkW = smoothstep(${a.toFixed(3)}, ${b.toFixed(3)}, position.y);
  objectNormal = normalize(mix(objectNormal, mat3(zkHead) * objectNormal, zkW));`;
const NECK_GLSL_P = (a, b) => `{ float zkW2 = smoothstep(${a.toFixed(3)}, ${b.toFixed(3)}, position.y);
  transformed = mix(transformed, (zkHead * vec4(transformed, 1.0)).xyz, zkW2); }`;
function depthMat(neck, U){ const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.customProgramCacheKey = () => 'zkNeckDepth' + neck.a + '_' + neck.b;
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 zkHead;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + NECK_GLSL_P(neck.a, neck.b)); };
  return m; }
export function neckTorso(mesh, base, head, headY, ghost){
  const neck = base.userData.zkNeck, U = { zkHead: { value: new THREE.Matrix4() } };
  const m = base.clone(); m.onBeforeCompile = base.onBeforeCompile; m.customProgramCacheKey = base.customProgramCacheKey; m.userData = { zkU: U, zkNeck: neck, zkShared: true };   // zkShared: never dispose (disposing would release the shared program -> recompile hitch on rebuild)
  mesh.material = m; if(!ghost){ mesh.customDepthMaterial = depthMat(neck, U); mesh.customDepthMaterial.userData.zkShared = true; }
  const rest = new THREE.Matrix4().makeTranslation(0, -headY, 0), inv = new THREE.Matrix4(), M = U.zkHead.value;
  const upd = () => { mesh.updateMatrix(); head.updateMatrix(); M.copy(inv.copy(mesh.matrix).invert()).multiply(head.matrix).multiply(rest); };
  mesh.onBeforeRender = upd; mesh.onBeforeShadow = upd; mesh.userData.zkNeck = true; return mesh; }
export function smoothLathe(pts, seg, fn){
  let g = new THREE.LatheGeometry(pts, seg, Math.PI, Math.PI * 2);   // seam at the back
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  if(fn){ const p = g.attributes.position, v = new THREE.Vector3(); for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); } }
  g = mergeVerts(g); g.computeVertexNormals(); return g; }
// minimal mergeVertices (position only) so normals are smooth across the lathe seam and poles
function mergeVerts(g){
  const p = g.attributes.position, idx = g.index ? g.index.array : null, map = new Map(), remap = new Uint32Array(p.count), out = [];
  for(let i = 0; i < p.count; i++){ const k = `${Math.round(p.getX(i)*1e4)},${Math.round(p.getY(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`;
    let j = map.get(k); if(j === undefined){ j = out.length / 3; map.set(k, j); out.push(p.getX(i), p.getY(i), p.getZ(i)); } remap[i] = j; }
  const n = idx ? idx.length : p.count, ind = [];
  for(let t = 0; t < n; t += 3){ const a = remap[idx ? idx[t] : t], b = remap[idx ? idx[t+1] : t+1], c = remap[idx ? idx[t+2] : t+2]; if(a !== b && b !== c && a !== c) ind.push(a, b, c); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); r.setIndex(ind); return r; }
export function merge(list){
  const ps = [], ns = []; for(const g0 of list){ const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
    ps.push(...g.attributes.position.array); ns.push(...g.attributes.normal.array); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3)); return r; }

// ---------- soft matte clay material (one program per variant: plain / muzzle), warm rim, cached ----------
const CREAM = 0xf6e0b5;
export function clay(hex, ghost, { muzzle = null, belly = false, rough = .8, sheen = .42, cc = .05, paint = null, neck = null } = {}){
  const mk = muzzle ? muzzle.key : '', pk = paint ? `P${paint.key}` : '', nk = neck ? `N${neck.a}_${neck.b}` : '';
  const key = `${hex}|${ghost ? 1 : 0}|${mk}|${belly ? 1 : 0}|${rough}|${cc}|${pk}|${paint ? paint.off.join(',') + '|' + paint.part : ''}|${nk}`; let m = V2.mats.get(key); if(m) return m;
  const c = new THREE.Color(hex);
  m = new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, metalness: 0, sheen, sheenRoughness: .75,
    sheenColor: c.clone().lerp(new THREE.Color(0xfff1dc), .5), clearcoat: cc, clearcoatRoughness: cc > .1 ? .25 : .6 });
  if(ghost){ m.transparent = true; m.opacity = .4; m.depthWrite = false; }
  m.customProgramCacheKey = () => 'zkClayV2' + mk + (belly ? 'B' : '') + pk + nk;
  const M = muzzle || VARIANTS.A.muz, oy = (muzzle && muzzle.oy) || 0;
  if(neck) m.userData.zkNeck = neck;
  m.onBeforeCompile = function(sh){
    sh.uniforms.zkCream = { value: new THREE.Color(CREAM) };
    if(neck){ Object.assign(sh.uniforms, (this.userData && this.userData.zkU) || { zkHead: { value: new THREE.Matrix4() } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 zkHead;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + NECK_GLSL_N(neck.a, neck.b))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + NECK_GLSL_P(neck.a, neck.b)); }
    if(paint){ sh.uniforms.zkOff = { value: new THREE.Vector3(...paint.off) }; sh.uniforms.zkPart = { value: paint.part }; }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vZkObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZkObj = position;');
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vZkObj; uniform vec3 zkCream; float zkM = 0.0;
float zkMuz(vec3 p){
  float a = length(vec2((abs(p.x) - ${M.lx.toFixed(3)}) / ${M.lrx.toFixed(3)}, (p.y - (${M.ly.toFixed(3)})) / ${M.lry.toFixed(3)})) - 1.0;
  float b = length(vec2(p.x / ${M.crx.toFixed(3)}, (p.y - (${M.cy.toFixed(3)})) / ${M.cry.toFixed(3)})) - 1.0;
  return min(a, b); }
float zkAA(float e){ float w = max(fwidth(e) * 1.2, 0.006); return 1.0 - smoothstep(-w, w, e); }
${paint ? 'uniform vec3 zkOff; uniform float zkPart;\n' + paint.glsl : ''}`);
    if(paint) f = f.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = zkPaint(vZkObj + zkOff, diffuseColor.rgb, zkPart);`);
    if(muzzle) f = f.replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 hp = vZkObj - vec3(0.0, ${oy.toFixed(3)}, 0.0); float e = zkMuz(hp); float w = max(fwidth(e) * 1.2, 0.055);   // soft muzzle edge
    float m = (1.0 - smoothstep(-w, w * 0.6, e)) * smoothstep(0.02, 0.2, hp.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, zkCream, m); zkM = m; }`);
    if(belly) f = f.replace('#include <color_fragment>', `#include <color_fragment>
  { float e = length(vec2(vZkObj.x / 0.27, (vZkObj.y - 0.6) / 0.34)) - 1.0; float w = max(fwidth(e) * 1.2, 0.012);
    float m = (1.0 - smoothstep(-w, w, e)) * smoothstep(0.05, 0.25, vZkObj.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, zkCream, m); zkM = m * 0.7; }`);
    // soft warm rim + a touch of subsurface-ish warmth in the shadows (clay/vinyl toy feel)
    f = f.replace('#include <opaque_fragment>', `float zkRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
  outgoingLight += vec3(1.0, 0.86, 0.7) * zkRim * 0.2 * diffuseColor.rgb * 1.6;
  outgoingLight += diffuseColor.rgb * vec3(0.10, 0.05, 0.03) + zkCream * zkM * 0.13;
  #include <opaque_fragment>`);
    sh.fragmentShader = f; };
  m.userData.zkShared = true; V2.mats.set(key, m); return m; }
export function gloss(ghost){ const key = 'gloss|' + (ghost ? 1 : 0); let m = V2.mats.get(key); if(m) return m;
  m = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0c, roughness: .18, clearcoat: 1, clearcoatRoughness: .06 });
  if(ghost){ m.transparent = true; m.opacity = .4; m.depthWrite = false; } m.userData.zkShared = true; V2.mats.set(key, m); return m; }
export function shineMat(){ let m = V2.mats.get('shine'); if(!m){ m = new THREE.MeshBasicMaterial({ color: 0xffffff }); m.userData.zkShared = true; V2.mats.set('shine', m); } return m; }

// head surface helper (rest shape) for placing face bits on a variant's head
function headR(V, P, yAbs){ for(let i = 1; i < P.length; i++){ if(P[i].y >= yAbs){ const a = P[i-1], b = P[i]; return a.x + (b.x - a.x) * (yAbs - a.y) / ((b.y - a.y) || 1); } } return 0; }
function surfZ(V, P, x, yLocal){ const R = headR(V, P, yLocal + V.headY), k = sstep(V.neckY - V.headY, V.neckY - V.headY + .23, yLocal); const rx = R * (1 + V.widen * k), rz = R * (1 - V.flat * k);
  const q = 1 - (x / rx) ** 2; let z = q > 0 ? rz * Math.sqrt(q) : 0;
  const e = muzzleE(V.muz, x, yLocal); if(e < .25) z += V.muz.bump * sstep(.25, -.55, e) * sstep(.05, .32, z); return z; }
function surfX(V, P, yLocal){ const k = sstep(V.neckY - V.headY, V.neckY - V.headY + .23, yLocal); return headR(V, P, yLocal + V.headY) * (1 + V.widen * k); }

let DEPS = null;
/** Give the builder the game's own helpers (called once). */
export function installOllieV2(deps){ DEPS = deps; return buildOllieV2; }

/** Same signature + parts contract as game.js buildOllie(opts). opts.variant = 'A' | 'B' | 'C' (default setOllieVariant()). */
export function buildOllieV2(opts = {}){
  const D = DEPS; const S = D.getSave ? D.getSave() : {};
  const { charId = S.selChar, equipped = S.equipped || {}, ghost = false } = opts;
  const vk = VARIANTS[opts.variant] ? opts.variant : VAR, V = VARIANTS[vk], P = OLLIE_PROFILES[vk];
  const rawId = charId || 'ollie'; const kind = D.isPlayable(rawId) ? rawId : 'ollie';
  if(kind !== 'ollie' && !opts.legacySpecies) return buildSpeciesV2(kind, { equipped, ghost }, D);   // V2 species (replaces dressSpecies)
  const ch = D.CMAP[kind] || D.CMAP.ollie, otter = kind === 'ollie', G = geos(vk);
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const col = otter ? V.color : ch.color;   // otter: a touch less orange than CMAP (0x7a4a2c) so ACES + warm key lands on the mockup's chocolate
  const neck = { a: +(V.neckY - .06).toFixed(3), b: +(V.neckY + .14).toFixed(3) };
  const torsoM = clay(col, ghost, { belly: otter && V.belly, muzzle: otter ? { ...V.muz, key: vk, oy: V.headY } : null, neck });
  const brown = clay(col, ghost, { belly: otter && V.belly });
  const limb = V.belly ? clay(col, ghost) : brown;
  const cream = clay(CREAM, ghost, { sheen: .3 }), darker = clay(new THREE.Color(col).multiplyScalar(.82).getHex(), ghost);
  const black = gloss(ghost);
  const body = new THREE.Mesh(G.body, torsoM); rig.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.y = V.headY; rig.add(head); parts.head = head;
  neckTorso(body, torsoM, head, V.headY, ghost); parts.headMesh = body;   // head + body are one mesh now
  // accessory anchors: same scale/offset convention as the game, re-fit per head shape
  const hatA = new THREE.Group(); hatA.position.y = V.hat.y; hatA.scale.setScalar(V.hat.s); head.add(hatA); parts.hatAnchor = hatA;
  const eyeA = new THREE.Group(); eyeA.position.set(...V.eyeA.p); eyeA.scale.set(...V.eyeA.s); head.add(eyeA); parts.eyeAnchor = eyeA;
  for(const s of [-1, 1]){
    const ex = V.eye.x * s, ey = V.eye.y, eye = new THREE.Mesh(G.sphere, black); eye.name = 'eye'; eye.scale.set(...V.eye.s); eye.position.set(ex, ey, surfZ(V, P, ex, ey) - .012); head.add(eye);
    const shine = new THREE.Mesh(G.sphere, shineMat()); shine.scale.set(.018 / V.eye.s[0], .018 / V.eye.s[1], .018 / V.eye.s[2]); shine.position.set(.3, .38, .78); eye.add(shine);   // child of the eye so blinks squash it too
    if(ghost) shine.visible = false;
    if(otter){ const ey2 = V.ear.y, ex2 = surfX(V, P, ey2) - .02;
      const ear = new THREE.Mesh(G.sphere, limb); ear.scale.set(...V.ear.s); ear.position.set(ex2 * s, ey2, -.01); head.add(ear);
      const earIn = new THREE.Mesh(G.sphere, darker); earIn.scale.set(V.ear.s[0] * .6, V.ear.s[1] * .6, V.ear.s[2] * .37); earIn.position.set((ex2 + .025) * s, ey2 + .005, .055); earIn.rotation.y = .5 * s; head.add(earIn); }
    const shx = headR(V, P, V.sh.y) - V.sh.inset;
    const sh = new THREE.Group(); sh.position.set(shx * s, V.sh.y, V.sh.z); rig.add(sh); parts['sh' + s] = sh;
    const arm = new THREE.Mesh(G.arm, limb); arm.position.set(.03 * s, -.2, 0); arm.rotation.z = V.arm.rz * s; sh.add(arm); parts['arm' + s] = arm;
    const foot = new THREE.Mesh(G.sphere, otter ? limb : darker); foot.scale.set(...V.foot.s); foot.position.set(V.foot.x * s, V.foot.y, V.foot.z); rig.add(foot); parts['foot' + s] = foot;
    if(otter){ const toeM = clay(new THREE.Color(col).multiplyScalar(.55).getHex(), ghost); for(const k of [-1, 1]){ const toe = new THREE.Mesh(G.sphere, toeM); toe.scale.set(.045, .32, .12); toe.position.set(.3 * k, .18, .9); foot.add(toe); } }
  }
  if(otter){
    const ny = V.nose.y, nose = new THREE.Mesh(G.sphere, black); nose.scale.set(...V.nose.s); nose.position.set(0, ny, surfZ(V, P, 0, ny) - .02); head.add(nose);
    const ly = V.mouth.line, line = new THREE.Mesh(G.line, black); line.position.set(0, ly, surfZ(V, P, 0, ly) - .002); line.rotation.x = -.25; head.add(line);
    for(const s of [-1, 1]){ const my = V.mouth.smile, mx = V.mouth.w * s, sm = new THREE.Mesh(G.smile, black); sm.rotation.set(-.35, 0, Math.PI); sm.position.set(mx, my, surfZ(V, P, mx, my) - .004); head.add(sm); }
    const tail = new THREE.Mesh(G.tail, limb); tail.position.set(...V.tail.pos); rig.add(tail); parts.tail = tail;
  } else {
    // other species: plain head (no cream muzzle) + their own features. Mats keep the dressSpecies() contract.
    D.dressSpecies(kind, rig, parts, ghost, { brown, cream, darker, black });
  }
  if(!parts.tail){ const tail = new THREE.Mesh(G.tail, brown); tail.position.set(...V.tail.pos); rig.add(tail); parts.tail = tail; }
  g.traverse(o => { if(o.isMesh) o.userData.base = true; });
  if(D.setProfile) D.setProfile(P);                     // tees/pants (bodyR/profileSlice) follow this character's silhouette
  if(!ghost) D.addEquipment(rig, parts, equipped);
  g.traverse(o => { if(o.isMesh) o.castShadow = !ghost; });
  g.userData.parts = parts; g.userData.walk = 0; g.userData.kind = kind; g.userData.v2 = vk; g.userData.animStyle = V.anim;
  return g;
}
