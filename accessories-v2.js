// accessories-v2.js — ZKidz wearables batch 1 (plus the Heavenly set).
// Drop-in item list + builder for new m.types. Old types fall through to the game's addEquipment.
//
// Usage (game):
//   import { ITEMS_V2, wrapAddEquipment, installAccessoriesV2, tickAccessories, outfitFraming,
//            applyLegacyFraming, isHatType, pickAnchor } from './accessories-v2.js';
//   applyLegacyFraming(ITEMS);                 // stamp m.framing onto the 26 existing items
//   const ALL = ITEMS.concat(ITEMS_V2);
//   ALL.forEach(i => i.price = ECO.ITEM_PRICE[i.r]);
//   const IMAP = Object.fromEntries(ALL.map(i => [i.id, i]));
//   installAccessoriesV2({ getProfile: () => ACTIVE_PROFILE });   // or { bodyR }
//   const addEquipment = wrapAddEquipment(addEquipmentOriginal, IMAP);
//   // in the animation loop, after animateChar(...): tickAccessories(o, dt, t);
//   // on resize / outfit change (NOT per frame):
//   //   current main (a3fb9d6+) already frames from a rest-pose Box3 in captureLobbyRestBox.
//   //   Pad that box with outfitMotionPad(eq, IMAP) so halo bob / wing flap can't clip the banner.
//   //   Or, if you frame without measuring the dressed mesh, add outfitFraming(eq, IMAP)
//   //   (max reach beyond a bare character, including bob/flap peaks) to a bare-character box.
//
// Phone-cheap: low segment counts, cached shared geos/mats, no skinned meshes, no per-frame allocs,
// no post-processing / bloom (glow is emissive + additive sprites). Matte clay look, metallic only
// where the item asks for it. Attach to animated parts (hatAnchor, eyeAnchor, sh±1, arm±1, foot±1, rig).
import * as THREE from './vendor/three.module.min.js?v=20261116-14';

/* ---------------- install (bodyR so tees/pants follow the active silhouette) ---------------- */
let _bodyR = null, _getProfile = null;

export function installAccessoriesV2(deps = {}){
  if(deps.bodyR) _bodyR = deps.bodyR;
  if(deps.getProfile) _getProfile = deps.getProfile;
}

function bodyR(y){
  if(_bodyR) return _bodyR(y);
  const P = _getProfile && _getProfile();
  if(!P || !P.length) return .5;
  for(let i = 1; i < P.length; i++){
    if(P[i].y >= y){ const a = P[i-1], b = P[i]; return a.x + (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1); }
  }
  return 0;
}
function yRange(d0, d1, slot){
  const P = _getProfile && _getProfile();
  if(slot === 'top'    && P && P.teeBottom  != null) return [P.teeBottom,  P.teeTop];
  if(slot === 'bottom' && P && P.pantBottom != null) return [P.pantBottom, P.pantTop];
  return [d0, d1];
}
function slotScale(slot, d){
  const P = _getProfile && _getProfile();
  if(!P) return d;
  if(slot === 'top'    && P.teeScale    != null) return P.teeScale;
  if(slot === 'bottom' && P.pantScale   != null) return P.pantScale;
  if(slot === 'wrist'  && P.wristScale  != null) return P.wristScale;
  if(slot === 'hands'  && P.handScale   != null) return P.handScale;
  if(slot === 'shoes'  && P.shoeScale   != null) return P.shoeScale;
  return d;
}
function addPantTrim(g){
  const P = _getProfile && _getProfile();
  if(!P || P.pantTrim == null || P.pantBottom == null) return;
  const y0 = P.pantBottom, y1 = P.pantTop, sc = P.pantScale != null ? P.pantScale : 1.05;
  const TM = M(P.pantTrim, { rough:.6 });
  const tr = P.pantTrimR != null ? P.pantTrimR : .035;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(Math.max(.05, bodyR(y0)*sc), tr, 8, 20), TM);
  hem.rotation.x = Math.PI/2; hem.position.y = y0; g.add(hem);
  const waist = new THREE.Mesh(new THREE.TorusGeometry(Math.max(.05, bodyR(y1)*sc), tr*.85, 8, 20), TM);
  waist.rotation.x = Math.PI/2; waist.position.y = y1; g.add(waist);
}

function profKey(){ return [0.3, 0.6, 0.9, 1.2].map(y => bodyR(y).toFixed(3)).join(','); }

/* ---------------- shared cache (geos tagged userData.shared so rebuilds don't dispose them) ---------------- */
const GEO = {}, MATS = new Map(), TEX = {};

function geo(key, fn){
  if(GEO[key]) return GEO[key];
  const g = fn();
  g.userData.shared = true;
  return GEO[key] = g;
}
function M(c, o = {}){
  const k = (c >>> 0) + ':' + (o.rough ?? '') + ':' + (o.metal ?? 0) + ':' + ((o.emissive || 0) >>> 0) + ':' + (o.ei ?? '') + ':' + (o.opacity ?? '') + ':' + (o.side === THREE.DoubleSide ? 'd' : '') + ':' + (o.mapKey || '') + ':' + (o.emKey || '') + ':' + (o.dw === 0 ? 'n' : '') + ':' + (o.add ? 'a' : '') + ':' + (o.env ? 'e' + (o.envI ?? '') : '');
  if(MATS.has(k)) return MATS.get(k);
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: o.rough ?? .78,
    metalness: o.metal ?? 0,
    emissive: o.emissive || 0x000000,
    emissiveIntensity: o.ei ?? 1,
    transparent: o.opacity != null && o.opacity < 1 || !!o.add,
    opacity: o.opacity ?? 1,
    side: o.side || THREE.FrontSide,
    map: o.map || null,
    emissiveMap: o.emissiveMap || null,
    depthWrite: o.dw === 0 ? false : true,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    envMap: o.env || null,
    envMapIntensity: o.envI ?? 1
  });
  m.userData.zkShared = true;
  MATS.set(k, m);
  return m;
}
function MM(m, c, o = {}){
  const metal = m.metal ? (o.metal ?? .85) : (o.metal ?? 0);
  const rough = m.metal ? (o.rough ?? .22) : (o.rough ?? .78);
  const emissive = o.emissive != null ? o.emissive : (m.glow || 0);
  const ei = o.ei ?? (emissive ? .55 : 1);
  return M(c, { ...o, metal, rough, emissive, ei });
}
function glowM(c, opacity = .4){
  return M(c, { rough: 1, metal: 0, emissive: c, ei: 1, opacity, dw: 0, add: 1, side: THREE.DoubleSide });
}

const GOLD = 0xffe27a, GOLD_DEEP = 0xe8b01a, GOLD_SOFT = 0xfff6c8, CREAM = 0xfff6e8, WHITE = 0xfffdf8;
function goldEnv(){
  if(TEX.goldEnv) return TEX.goldEnv;
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, '#fffce8'); gr.addColorStop(.18, '#ffe7a0'); gr.addColorStop(.4, '#e8a020'); gr.addColorStop(.7, '#6a3a10'); gr.addColorStop(1, '#1a0c04');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 32);
  // tight bright specular blob — reads as a polished highlight, not a cool sky
  const rg = x.createRadialGradient(48, 6, 0, 48, 6, 11);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.25, 'rgba(255,248,220,1)'); rg.addColorStop(.55, 'rgba(255,200,60,.5)'); rg.addColorStop(1, 'rgba(255,160,20,0)');
  x.fillStyle = rg; x.beginPath(); x.arc(48, 6, 11, 0, 6.3); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  return TEX.goldEnv = t;
}
function goldM(o = {}){
  // Keep metal at .92 (previous helper always overwrote a caller metal after ...o).
  return M(o.c || GOLD, {
    metal: .92,
    rough: o.rough ?? .12,
    emissive: o.emissive ?? 0xffb020,
    ei: o.ei ?? .55,
    env: goldEnv(),
    envI: o.envI ?? 2.3,
    opacity: o.opacity,
    side: o.side,
    dw: o.dw,
    add: o.add,
    map: o.map,
    mapKey: o.mapKey,
    emissiveMap: o.emissiveMap,
    emKey: o.emKey
  });
}
function goldGlowTex(){
  return tex('goldglow', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,250,200,1)');
    rg.addColorStop(.15, 'rgba(255,210,70,.85)');
    rg.addColorStop(.4, 'rgba(255,160,20,.28)');
    rg.addColorStop(.7, 'rgba(255,140,0,0)');
    rg.addColorStop(1, 'rgba(255,140,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  });
}
function goldGlow(radius, opacity = .55){
  const mat = M(0xffffff, { map: goldGlowTex(), mapKey: 'goldglow', opacity, dw: 0, add: 1, emissive: 0xffcc44, ei: 1, rough: 1, metal: 0, side: THREE.DoubleSide });
  return new THREE.Mesh(geo('gglow:' + radius, () => new THREE.CircleGeometry(radius, 16)), mat);
}
function creamM(o = {}){ return M(o.c || CREAM, { rough: o.rough ?? .82, metal: 0, ...o }); }
function lavaAlbedo(){
  return tex('lavaAlb', 128, 128, (g, w, h) => {
    g.fillStyle = '#14110f'; g.fillRect(0, 0, w, h);
    const blobs = ['#1c1614', '#0c0a09', '#2a2018', '#161210'];
    for(let i = 0; i < 28; i++){ g.fillStyle = blobs[i % 4]; g.beginPath(); g.ellipse((i*41+6)%w, (i*67+9)%h, 16, 11, i, 0, 6.3); g.fill(); }
    g.strokeStyle = '#0a0807'; g.lineWidth = 2;
    [[10,12,70,50],[24,90,100,30],[50,20,120,100],[80,110,30,50],[110,40,50,120],[4,60,90,80]].forEach(([a,b,c,d]) => { g.beginPath(); g.moveTo(a,b); g.quadraticCurveTo((a+c)/2+6,(b+d)/2-5,c,d); g.stroke(); });
  });
}
function lavaGlowMap(){
  return tex('lavaEm', 128, 128, (g, w, h) => {
    g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
    const cracks = [[8,10,60,40],[20,80,90,20],[40,30,120,90],[70,110,20,40],[100,50,40,120],[12,70,80,100],[90,8,60,70],[30,50,110,60],[50,100,90,40]];
    g.lineWidth = 5; g.strokeStyle = '#ff4a00';
    cracks.forEach(([a,b,c,d]) => { g.beginPath(); g.moveTo(a,b); g.quadraticCurveTo((a+c)/2+8,(b+d)/2-6,c,d); g.stroke(); });
    g.lineWidth = 2.4; g.strokeStyle = '#ff9a18';
    cracks.forEach(([a,b,c,d]) => { g.beginPath(); g.moveTo(a,b); g.quadraticCurveTo((a+c)/2+8,(b+d)/2-6,c,d); g.stroke(); });
    g.lineWidth = 1; g.strokeStyle = '#ffe56a';
    cracks.forEach(([a,b,c,d]) => { g.beginPath(); g.moveTo(a,b); g.quadraticCurveTo((a+c)/2+8,(b+d)/2-6,c,d); g.stroke(); });
  });
}
function lavaM(o = {}){
  return M(0xffffff, {
    map: lavaAlbedo(), mapKey:'lavaAlb',
    emissiveMap: lavaGlowMap(), emKey:'lavaEm',
    rough: o.rough ?? .72,
    metal: o.metal ?? .08,
    emissive: o.emissive ?? 0xff8a1a,
    ei: o.ei ?? 1.45,
    side: o.side,
    opacity: o.opacity,
    dw: o.dw,
    add: o.add
  });
}
function magmaM(o = {}){ return M(o.c || 0xff8a14, { rough: o.rough ?? .28, metal: 0, emissive: o.emissive ?? 0xff5a00, ei: o.ei ?? 1.7 }); }

function tex(key, w, h, draw, opts = {}){
  if(TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if(opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.userData.shared = true;
  return TEX[key] = t;
}
function slice(y0, y1, scale){
  const P = _getProfile && _getProfile();
  const arc = P && (P.teeArc != null ? P.teeArc : P.jacketArc);
  const phi0 = arc != null ? -arc / 2 : 0, phiL = arc != null ? arc : Math.PI * 2;
  const key = `ps:${profKey()}:${y0}:${y1}:${scale}:${phi0}:${phiL}`;
  return geo(key, () => {
    const pts = [];
    for(let i = 0; i <= 10; i++){ const y = y0 + (y1 - y0) * i / 10; pts.push(new THREE.Vector2(bodyR(y) * scale, y)); }
    return new THREE.LatheGeometry(pts, 24, phi0, phiL);
  });
}
function flare(yWaist, yHem, s0, s1){
  const key = `fl:${profKey()}:${yWaist}:${yHem}:${s0}:${s1}`;
  return geo(key, () => {
    const pts = [];
    for(let i = 0; i <= 10; i++){
      const t = i / 10, y = yWaist + (yHem - yWaist) * t, s = s0 + (s1 - s0) * t * t;
      pts.push(new THREE.Vector2(bodyR(y) * s, y));
    }
    return new THREE.LatheGeometry(pts, 24);
  });
}

function footHold(f){
  const h = new THREE.Group();
  h.scale.set(1 / Math.max(f.scale.x, 1e-6), 1 / Math.max(f.scale.y, 1e-6), 1 / Math.max(f.scale.z, 1e-6));
  f.add(h);
  return h;
}
function hideToes(f, mat){
  f.material = mat; f.userData.base = false;
  f.children.forEach(c => { if(c.isMesh) c.visible = false; });
}
function accFx(parts){ return parts.accFx || (parts.accFx = {}); }
function addBoth(parts, key, fn){ for(const s of [-1, 1]) fn(parts[key + s], s); }

/** Bake a mesh's local (or parent*local) matrix into a cloned geometry. Does not mutate the shared source geo. */
function bakeMesh(m, parentMatrix){
  if(!m.userData.keepMatrix) m.updateMatrix();
  const mx = parentMatrix ? parentMatrix.clone().multiply(m.matrix) : m.matrix;
  const g = m.geometry.clone();
  g.applyMatrix4(mx);
  return g;
}
function copyAttr(src, dst, dstOffset, itemSize){
  const n = src.count;
  if(src.array && src.array.length === n * itemSize && (src.offset || 0) === 0){
    dst.set(src.array, dstOffset * itemSize);
    return;
  }
  for(let i = 0; i < n; i++){
    for(let k = 0; k < itemSize; k++) dst[(dstOffset + i) * itemSize + k] = src.getComponent(i, k);
  }
}
/** Merge baked BufferGeometries into one indexed geometry. Does not dispose inputs. */
function mergeGeos(geos){
  if(!geos.length) return new THREE.BufferGeometry();
  let vCount = 0, iCount = 0;
  const useUV = geos.every(g => g.attributes.uv);
  const useN = geos.every(g => g.attributes.normal);
  for(const g of geos){
    const vc = g.attributes.position.count;
    vCount += vc;
    iCount += g.index ? g.index.count : vc;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = useN ? new Float32Array(vCount * 3) : null;
  const uv = useUV ? new Float32Array(vCount * 2) : null;
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for(const g of geos){
    const p = g.attributes.position, vc = p.count;
    copyAttr(p, pos, vo, 3);
    if(nrm) copyAttr(g.attributes.normal, nrm, vo, 3);
    if(uv) copyAttr(g.attributes.uv, uv, vo, 2);
    if(g.index){
      const ia = g.index.array;
      for(let i = 0; i < ia.length; i++) idx[io++] = ia[i] + vo;
    } else {
      for(let i = 0; i < vc; i++) idx[io++] = vo + i;
    }
    vo += vc;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if(nrm) out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  else out.computeVertexNormals();
  if(uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.userData.shared = true;
  return out;
}
/** One cached mesh from unattached, pre-transformed meshes that share a material. */
function mergedMesh(meshes, mat, key){
  const g = geo(key, () => {
    const baked = meshes.map(m => bakeMesh(m));
    const out = mergeGeos(baked);
    baked.forEach(b => b.dispose());
    return out;
  });
  return new THREE.Mesh(g, mat);
}
/** One cached mesh with material groups. groups: [{ meshes, mat }, ...]. Optional parentMatrix per mesh via mesh._parentMx. */
function mergedMulti(groups, key){
  const mats = groups.map(gr => gr.mat);
  const g = geo(key, () => {
    const bakedAll = [];
    const ranges = [];
    let i0 = 0;
    for(const gr of groups){
      let count = 0;
      for(const m of gr.meshes){
        const b = bakeMesh(m, m._parentMx);
        bakedAll.push(b);
        count += b.index ? b.index.count : b.attributes.position.count;
      }
      ranges.push({ start: i0, count });
      i0 += count;
    }
    const out = mergeGeos(bakedAll);
    bakedAll.forEach(b => b.dispose());
    out.clearGroups();
    ranges.forEach((r, i) => out.addGroup(r.start, r.count, i));
    return out;
  });
  return new THREE.Mesh(g, mats);
}

function heartSh(){
  return geo('heart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -.6); s.bezierCurveTo(-.9, 0, -.7, .8, 0, .35); s.bezierCurveTo(.7, .8, .9, 0, 0, -.6);
    return new THREE.ExtrudeGeometry(s, { depth: .25, bevelEnabled: false });
  });
}
function starSh(){
  return geo('star', () => {
    const s = new THREE.Shape();
    for(let i = 0; i < 10; i++){ const r = i % 2 ? .32 : .7, a = i / 10 * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
    return new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: false });
  });
}

/* ---------------- textures (tiny canvases, created once) ---------------- */
function sailorMap(){ return tex('sailor', 8, 64, (g, w, h) => {
  for(let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#1e4f9a' : '#f4f7ff'; g.fillRect(0, i * h / 8, w, h / 8 + 1); }
}); }
function hawaiiMap(){ return tex('hawaii', 64, 64, (g, w, h) => {
  g.fillStyle = '#1ea37a'; g.fillRect(0, 0, w, h);
  const cols = ['#ff5a7a', '#ffd24a', '#ff8a3d', '#fff6e8'];
  for(let i = 0; i < 10; i++){
    const x = (i * 17 + 8) % w, y = (i * 23 + 10) % h, c = cols[i % cols.length];
    g.fillStyle = '#3cbf5a'; g.beginPath(); g.ellipse(x + 6, y + 4, 6, 3, .4, 0, 6.3); g.fill();
    g.fillStyle = c;
    for(let p = 0; p < 5; p++){ const a = p / 5 * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 2, a, 0, 6.3); g.fill(); }
    g.fillStyle = '#ffe36b'; g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill();
  }
}); }
function starMap(){ return tex('stars', 256, 256, (g, w, h) => {
  g.fillStyle = '#1a0a40'; g.fillRect(0, 0, w, h);
  for(let i = 0; i < 120; i++){ const x = (i * 47 + 11) % w, y = (i * 89 + 19) % h, r = 1.2 + (i % 4) * .7;
    g.fillStyle = i % 6 === 0 ? '#ffe7a0' : '#e8d6ff'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    if(i % 7 === 0){ g.strokeStyle = '#ffe7a0'; g.lineWidth = 1.2; g.beginPath();
      for(let k = 0; k < 5; k++){ const a = k / 5 * 6.283 - 1.57, R = k?2.2:5; const px = x+Math.cos(a)*R, py = y+Math.sin(a)*R; k?g.lineTo(px,py):g.moveTo(px,py); } g.closePath(); g.stroke(); }
  }
}); }
function nebulaMap(){ return tex('nebula', 256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a1450'); gr.addColorStop(.45, '#5a2bd8'); gr.addColorStop(.7, '#9b4dff'); gr.addColorStop(1, '#ff4fb8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.9)';
  for(let i = 0; i < 80; i++){ g.beginPath(); g.arc((i * 37 + 9) % w, (i * 53 + 17) % h, i % 5 === 0 ? 2.2 : 1, 0, 6.3); g.fill(); }
}); }
function partyMap(){ return tex('party', 16, 64, (g, w, h) => {
  const cols = ['#ff4f8a', '#ffd24a', '#4fd0ff', '#9b4dff', '#5be04a'];
  for(let i = 0; i < 8; i++){ g.fillStyle = cols[i % cols.length]; g.fillRect(0, i * h / 8, w, h / 8 + 1); }
}); }
function wizardMap(){ return tex('wizard', 32, 64, (g, w, h) => {
  g.fillStyle = '#3b1e8a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffc933';
  for(let i = 0; i < 12; i++){ const x = (i * 9 + 4) % w, y = 8 + (i * 13) % (h - 12);
    g.beginPath(); for(let k = 0; k < 5; k++){ const a = k / 5 * 6.283 - 1.57, r = k ? 1.2 : 2.4; k ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x, y - 2.4); } g.fill(); }
}); }
function sunsetMap(){ return tex('sunset', 8, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(.5, '#ff5a1f'); gr.addColorStop(1, '#9b1a40');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}); }

/* ---------------- item list ----------------
   m.framing = { up, side, back, front? } in rig units: ADDITIONAL clearance beyond a bare
   character of the same species. Values are the MAXIMUM reach (halo bob peak, wing flap peak)
   so the lobby camera can be framed once per outfit change / resize with no animation jitter.
   `front` is optional (flippers); default 0. See outfitFraming() and MERGE_NOTE.md.
*/
const F = (up, side, back, front = 0, motion = null) => {
  const f = { up, side, back, front };
  if(motion) f.motion = motion;  // animation overshoot (halo bob, wing flap) to pad a rest-pose box
  return f;
};

export const ITEMS_V2 = [
  // ----- common -----
  { id:'shorts_cargo',  name:'Cargo Shorts',        slot:'bottom', r:'common',    em:'🩳', m:{ type:'cargo',      c:0xc4a46a, framing:F(0, .12, 0) } },
  { id:'sandals_tan',   name:'Beach Sandals',       slot:'shoes',  r:'common',    em:'🩴', m:{ type:'sandals',    c:0xd2a56c, framing:F(0, .04, 0, .06) } },
  { id:'band_friend',   name:'Friendship Band',     slot:'wrist',  r:'common',    em:'💗', m:{ type:'friendship', c:0xff7aa8, framing:F(0, .04, 0) } },
  { id:'hat_bucket',    name:'Sun Bucket Hat',      slot:'hat',    r:'common',    em:'👒', m:{ type:'bucket',     c:0xffd24a, framing:F(.45, .35, .25) } },
  { id:'tee_sailor',    name:'Sailor Shirt',        slot:'top',    r:'common',    em:'⚓', m:{ type:'sailor',     c:0x1e4f9a, c2:0xf4f7ff, framing:F(.02, .08, .04) } },
  // ----- uncommon -----
  { id:'overalls_denim',name:'Denim Overalls',      slot:'bottom', r:'uncommon',  em:'👖', m:{ type:'overalls',   c:0x3d6fb8, framing:F(.02, .1, .04) } },
  { id:'boots_rain',    name:'Rain Boots',          slot:'shoes',  r:'uncommon',  em:'👢', m:{ type:'rainboots',  c:0xffd52e, framing:F(0, .06, 0, .08) } },
  { id:'mittens_cozy',  name:'Cozy Mittens',        slot:'hands',  r:'uncommon',  em:'🧤', m:{ type:'mittens',    c:0xe85a4a, c2:0xf4f0e6, framing:F(0, .12, 0) } },
  { id:'hat_party',     name:'Party Cone',          slot:'hat',    r:'uncommon',  em:'🎉', m:{ type:'party',      c:0xff4f8a, c2:0xffe36b, framing:F(1.05, .25, .15) } },
  { id:'vest_life',     name:'Life Vest',           slot:'top',    r:'uncommon',  em:'🦺', m:{ type:'vest',       c:0xff7a1a, framing:F(.04, .18, .1) } },
  // ----- rare -----
  { id:'skirt_shell',   name:'Shell Skirt',         slot:'bottom', r:'rare',      em:'👗', m:{ type:'skirt',      c:0xffb3d0, c2:0xfff0c8, framing:F(0, .22, .08) } },
  { id:'watch_smart',   name:'Diver Watch',         slot:'wrist',  r:'rare',      em:'⌚', m:{ type:'watch',      c:0x1a2a3a, c2:0x2ee6d6, framing:F(0, .06, 0) } },
  { id:'hat_pirate',    name:'Pirate Hat',          slot:'hat',    r:'rare',      em:'🏴‍☠️', m:{ type:'pirate',    c:0x1a1a22, c2:0xffc933, framing:F(.55, .5, .35) } },
  { id:'mask_snorkel',  name:'Snorkel Mask',        slot:'eyes',   r:'rare',      em:'🤿', m:{ type:'snorkel',    c:0x1ec8e0, framing:F(.55, .2, .08) } },
  { id:'apron_chef',    name:'Chef Apron',          slot:'top',    r:'rare',      em:'🧑‍🍳', m:{ type:'apron',      c:0xf7f4ee, c2:0xd12a2a, framing:F(.04, .08, 0, .12) } },
  // ----- epic -----
  { id:'sneak_high',    name:'High-Tops',           slot:'shoes',  r:'epic',      em:'👟', m:{ type:'hightops',   c:0xff3fb4, c2:0xffffff, framing:F(0, .07, 0, .08) } },
  { id:'brace_coral',   name:'Coral Bangle',        slot:'wrist',  r:'epic',      em:'🪸', m:{ type:'coral',      c:0xff6b6b, framing:F(0, .08, 0) } },
  { id:'gloves_box',    name:'Boxing Gloves',       slot:'hands',  r:'epic',      em:'🥊', m:{ type:'boxing',     c:0xe8322f, framing:F(0, .24, 0) } },
  { id:'glasses_3d',    name:'3D Glasses',          slot:'eyes',   r:'epic',      em:'👓', m:{ type:'glasses3d',  c:0x222222, framing:F(.04, .16, 0, .08) } },
  { id:'shirt_hawaii',  name:'Hawaiian Shirt',      slot:'top',    r:'epic',      em:'🌺', m:{ type:'hawaii',     c:0x1ea37a, framing:F(.02, .08, .04) } },
  // ----- mythic -----
  { id:'hoodie_sunset', name:'Sunset Hoodie',       slot:'top',    r:'mythic',    em:'🌅', m:{ type:'hoodie',     c:0xff5a1f, glow:0x661400, framing:F(.4, .22, .28) } },
  { id:'claws_crab',    name:'Crab Claws',          slot:'hands',  r:'mythic',    em:'🦀', m:{ type:'claws',      c:0xff6a2a, framing:F(0, .38, 0, .2) } },
  { id:'goggles_ski',   name:'Ember Goggles',       slot:'eyes',   r:'mythic',    em:'🥽', m:{ type:'skigoggles', c:0xff7a00, glow:0x551800, framing:F(.06, .22, .08, .1) } },
  { id:'hat_flower',    name:'Bloom Crown',         slot:'hat',    r:'mythic',    em:'🌸', m:{ type:'flower',     c:0xff6aa8, c2:0xffe36b, glow:0x4a1028, framing:F(.42, .32, .22) } },
  // ----- ultra -----
  { id:'brace_pearl',   name:'Pearl Cuff',          slot:'wrist',  r:'ultra',     em:'🤍', m:{ type:'pearl',      c:0xf4efe6, metal:true, framing:F(0, .08, 0) } },
  { id:'glasses_mono',  name:'Silver Monocle',      slot:'eyes',   r:'ultra',     em:'🧐', m:{ type:'monocle',    c:0xdfe6f0, metal:true, framing:F(.02, .16, 0, .08) } },
  { id:'fins_turbo',    name:'Turbo Flippers',      slot:'shoes',  r:'ultra',     em:'🌀', m:{ type:'flippers',   c:0x5ff0ff, metal:true, glow:0x113344, framing:F(0, .1, .08, .62) } },
  { id:'hat_phones',    name:'Chrome Headphones',   slot:'hat',    r:'ultra',     em:'🎧', m:{ type:'headphones', c:0xc7d2e0, metal:true, framing:F(.5, .42, .18) } },
  // ----- legendary (batch 1) -----
  { id:'hat_wizard',    name:'Wizard Hat',          slot:'hat',    r:'legendary', em:'🪄', m:{ type:'wizard',     c:0x3b1e8a, c2:0xffc933, framing:F(1.08, .48, .32) } },
  { id:'gloves_sparkle',name:'Sparkle Gloves',      slot:'hands',  r:'legendary', em:'✨', m:{ type:'sparkle',    c:0x7b5cff, glow:0x2a1060, framing:F(0, .14, 0) } },
  { id:'cape_hero',     name:'Hero Cape',           slot:'top',    r:'legendary', em:'🦸', m:{ type:'cape',       c:0xe8322f, c2:0xffc933, framing:F(.12, .28, .8) } },
  // ----- cosmic -----
  { id:'pants_stars',   name:'Star Leggings',       slot:'bottom', r:'cosmic',    em:'🌟', m:{ type:'starlegs',   c:0x2a1450, glow:0x1a0840, framing:F(0, .06, 0) } },
  { id:'boots_rocket',  name:'Rocket Boots',        slot:'shoes',  r:'cosmic',    em:'🚀', m:{ type:'rocket',     c:0x9b6bff, glow:0x2a0a80, framing:F(0, .1, .4, .1) } },
  { id:'shorts_nebula', name:'Nebula Board Shorts', slot:'bottom', r:'cosmic',    em:'🌌', m:{ type:'board',      c:0x5a2bd8, glow:0x2a0a80, framing:F(0, .1, 0) } },
  // ----- extra everyday pieces so every slot has 10+ after merge -----
  { id:'pants_jogger',  name:'Cozy Joggers',        slot:'bottom', r:'common',    em:'👖', m:{ type:'joggers',    c:0x4a5a6a, framing:F(0, .08, 0) } },
  { id:'wrap_kelp',     name:'Kelp Wrap',           slot:'bottom', r:'rare',      em:'🌿', m:{ type:'kelpwrap',   c:0x3cae3c, c2:0x8ee05a, framing:F(0, .22, .08) } },
  { id:'tutu_pop',      name:'Pop Tutu',            slot:'bottom', r:'epic',      em:'🩰', m:{ type:'tutu',       c:0xff6ad5, c2:0xffe6fa, framing:F(0, .38, .12) } },
  { id:'slippers_cloud',name:'Cloud Slippers',      slot:'shoes',  r:'uncommon',  em:'☁️', m:{ type:'slippers',   c:0xf4f7ff, framing:F(0, .08, 0, .1) } },
  { id:'skates_ice',    name:'Ice Skates',          slot:'shoes',  r:'rare',      em:'⛸️', m:{ type:'iceskates',  c:0xdfe8f5, metal:true, framing:F(0, .08, 0, .12) } },
  { id:'wrap_ribbon',   name:'Reef Ribbon',         slot:'wrist',  r:'common',    em:'🎀', m:{ type:'ribbon',     c:0xff5a8a, framing:F(0, .08, 0) } },
  { id:'band_sport',    name:'Sport Band',          slot:'wrist',  r:'uncommon',  em:'💪', m:{ type:'sportband',  c:0x2f6fe0, framing:F(0, .05, 0) } },
  { id:'brace_charm',   name:'Charm Bracelet',      slot:'wrist',  r:'rare',      em:'🔔', m:{ type:'charm',      c:0xffd84a, metal:true, framing:F(0, .1, 0) } },
  { id:'gloves_finger', name:'Fingerless Gloves',   slot:'hands',  r:'common',    em:'✋', m:{ type:'fingerless', c:0x3a3a44, framing:F(0, .1, 0) } },
  { id:'mitts_oven',    name:'Oven Mitts',          slot:'hands',  r:'rare',      em:'🍳', m:{ type:'oven',       c:0xd12a2a, c2:0xf4f0e6, framing:F(0, .2, 0) } },
  { id:'poms_cheer',    name:'Cheer Poms',          slot:'hands',  r:'epic',      em:'🎊', m:{ type:'poms',       c:0xff4f8a, c2:0xffe36b, framing:F(0, .32, 0) } },
  // ----- Lava set (mythic; completes jacket_lava + visor_fire + pants_magma) -----
  { id:'helm_volcano',  name:'Volcano Helm',        slot:'hat',    r:'mythic',    em:'🌋', m:{ type:'volcano',    c:0x3a0a08, glow:0xff4a00, framing:F(1.0, .5, .35) } },
  { id:'boots_lava',    name:'Magma Boots',         slot:'shoes',  r:'mythic',    em:'🥾', m:{ type:'lavaboots',  c:0x3a0a08, glow:0xff4a00, framing:F(0, .1, .08, .1) } },
  { id:'gloves_lava',   name:'Magma Mitts',         slot:'hands',  r:'mythic',    em:'🔥', m:{ type:'lavagloves', c:0x3a0a08, glow:0xff4a00, framing:F(0, .16, 0) } },
  { id:'brace_lava',    name:'Magma Cuff',          slot:'wrist',  r:'mythic',    em:'🪨', m:{ type:'lavacuff',   c:0x3a0a08, glow:0xff4a00, framing:F(0, .08, 0) } },
  // ----- Heavenly set (legendary, chest-only; matches the gold/white heavenly chest) -----
  { id:'halo_heaven',      name:'Heavenly Halo',       slot:'hat',    r:'legendary', em:'😇', m:{ type:'halo',      c:0xffe27a, metal:true, glow:0xffb020, framing:F(.62, .42, .22, 0, { up:.04, side:0, back:0, front:0 }) } },
  { id:'robe_heaven',      name:'Heavenly Robe',       slot:'top',    r:'legendary', em:'🪽', m:{ type:'robe',      c:0xfff6e8, c2:0xffe27a, metal:true, glow:0xffb020, framing:F(.35, .92, .70, 0, { up:.04, side:.12, back:.08, front:0 }) } },
  { id:'drape_heaven',     name:'Heavenly Drapes',     slot:'bottom', r:'legendary', em:'✨', m:{ type:'drape',     c:0xfff6e8, c2:0xffc933, metal:true, framing:F(0, .24, .08) } },
  { id:'sandals_icarus',   name:'Icarus Sandals',      slot:'shoes',  r:'legendary', em:'👡', m:{ type:'icarus',    c:0xffc933, metal:true, glow:0x553300, framing:F(0, .2, .16, .1, { up:0, side:.04, back:.03, front:0 }) } },
  { id:'gauntlets_heaven', name:'Heavenly Gauntlets',  slot:'hands',  r:'legendary', em:'🙌', m:{ type:'gauntlets', c:0xffc933, metal:true, glow:0x553300, framing:F(0, .16, 0) } },
  { id:'cuff_heaven',      name:'Radiant Cuff',        slot:'wrist',  r:'legendary', em:'💫', m:{ type:'radiant',   c:0xffc933, metal:true, glow:0x664400, framing:F(0, .14, 0) } },
  { id:'visor_heaven',     name:'Heavenly Visor',      slot:'eyes',   r:'legendary', em:'🌅', m:{ type:'goldvisor', c:0xffc933, metal:true, glow:0x664400, framing:F(.08, .2, .06, .1) } },
];

export const HEAVENLY_EQ = { hat:'halo_heaven', top:'robe_heaven', bottom:'drape_heaven', shoes:'sandals_icarus', hands:'gauntlets_heaven', wrist:'cuff_heaven', eyes:'visor_heaven' };
export const LAVA_EQ = { hat:'helm_volcano', eyes:'visor_fire', top:'jacket_lava', bottom:'pants_magma', shoes:'boots_lava', hands:'gloves_lava', wrist:'brace_lava' };

export const OUTFITS_V2 = [
  { name:'No outfit', eq:{} },
  { name:'Beach Day', eq:{ hat:'hat_bucket', top:'shirt_hawaii', bottom:'shorts_nebula', shoes:'sandals_tan', wrist:'band_friend' } },
  { name:'Diver', eq:{ eyes:'mask_snorkel', top:'vest_life', shoes:'fins_turbo', wrist:'watch_smart', bottom:'shorts_cargo' } },
  { name:'Pirate', eq:{ hat:'hat_pirate', eyes:'glasses_mono', top:'tee_sailor', bottom:'shorts_cargo', shoes:'sandals_tan' } },
  { name:'Chef', eq:{ hat:'hat_party', top:'apron_chef', bottom:'shorts_cargo', shoes:'sandals_tan' } },
  { name:'Boxer', eq:{ hat:'hat_phones', top:'hoodie_sunset', hands:'gloves_box', shoes:'sneak_high' } },
  { name:'Wizard', eq:{ hat:'hat_wizard', eyes:'glasses_mono', hands:'gloves_sparkle', bottom:'pants_stars', wrist:'brace_pearl' } },
  { name:'Hero', eq:{ top:'cape_hero', shoes:'sneak_high', hands:'gloves_box', bottom:'shorts_cargo' } },
  { name:'Space Cadet', eq:{ hat:'hat_phones', top:'hoodie_sunset', bottom:'shorts_nebula', shoes:'boots_rocket', eyes:'glasses_3d' } },
  { name:'Rainy Day', eq:{ hat:'hat_bucket', hands:'mittens_cozy', shoes:'boots_rain', bottom:'overalls_denim' } },
  { name:'Lava Set', eq:LAVA_EQ },
  { name:'Heavenly Set', eq:HEAVENLY_EQ },
];

/** One worn example per rarity, for the rarity step-up sheet. */
export const RARITY_EXAMPLES = [
  { r:'common',    id:'hat_bucket' },
  { r:'uncommon',  id:'hat_party' },
  { r:'rare',      id:'hat_pirate' },
  { r:'epic',      id:'tutu_pop' },
  { r:'mythic',    id:'helm_volcano' },
  { r:'ultra',     id:'crown_silver' },
  { r:'legendary', id:'halo_heaven' },
  { r:'cosmic',    id:'jacket_galaxy' },
];

/* Framing for the original 26 items (same units). applyLegacyFraming(ITEMS) stamps these on. */
export const LEGACY_FRAMING = {
  cap_blue:        F(.40, .22, .18, .22),
  tee_white:       F(.02, .08, .04),
  sneak_red:       F(0, .06, 0, .06),
  specs_round:     F(.02, .14, 0, .08),
  brace_shell:     F(0, .04, 0),
  goggles_aqua:    F(.04, .16, .08, .08),
  tee_wave:        F(.02, .08, .04),
  shorts_swim:     F(0, .06, 0),
  beanie_leaf:     F(.85, .22, .18),
  gloves_forest:   F(0, .12, 0),
  eyepatch:        F(.02, .12, .08, .08),
  beanie_rainbow:  F(.85, .22, .18),
  shades_heart:    F(.04, .16, 0, .1),
  jacket_denim:    F(.06, .12, .08),
  sneak_pop:       F(0, .06, 0, .06),
  jacket_lava:     F(.06, .12, .08),
  visor_fire:      F(.06, .16, .04, .1),
  pants_magma:     F(0, .06, 0),
  crown_silver:    F(.72, .28, .22),
  gloves_knight:   F(0, .12, 0),
  crown_gold:      F(.72, .28, .22),
  shades_star:     F(.06, .16, 0, .1),
  brace_gold:      F(0, .04, 0),
  helmet_astro:    F(.95, .45, .4, .4),
  jacket_galaxy:   F(.06, .12, .08),
  visor_star:      F(.06, .16, .04, .1),
};

export function applyLegacyFraming(items){
  for(const it of items){ if(it.m && !it.m.framing && LEGACY_FRAMING[it.id]) it.m.framing = LEGACY_FRAMING[it.id]; }
}

export function outfitFraming(eq, IMAP){
  let up = 0, side = 0, back = 0, front = 0;
  if(!eq) return { up, side, back, front };
  for(const slot in eq){
    const f = IMAP && IMAP[eq[slot]] && IMAP[eq[slot]].m && IMAP[eq[slot]].m.framing;
    if(!f) continue;
    if((f.up || 0) > up) up = f.up;
    if((f.side || 0) > side) side = f.side;
    if((f.back || 0) > back) back = f.back;
    if((f.front || 0) > front) front = f.front;
  }
  return { up, side, back, front };
}

/** Animation overshoot only (halo bob, wing flap). Add this to a rest-pose Box3
    captured before tickAccessories runs — this is the hook for game.js captureLobbyRestBox. */
export function outfitMotionPad(eq, IMAP){
  let up = 0, side = 0, back = 0, front = 0;
  if(!eq) return { up, side, back, front };
  for(const slot in eq){
    const m = IMAP && IMAP[eq[slot]] && IMAP[eq[slot]].m && IMAP[eq[slot]].m.framing && IMAP[eq[slot]].m.framing.motion;
    if(!m) continue;
    if((m.up || 0) > up) up = m.up;
    if((m.side || 0) > side) side = m.side;
    if((m.back || 0) > back) back = m.back;
    if((m.front || 0) > front) front = m.front;
  }
  return { up, side, back, front };
}

/* ---------------- public API ---------------- */
export const HAT_TYPES = { cap:1, beanie:1, crown:1, helmet:1, bucket:1, party:1, pirate:1, headphones:1, flower:1, wizard:1, halo:1, volcano:1, flame:1 };
export function isHatType(t){ return !!HAT_TYPES[t]; }
export function pickAnchor(m, parts){ return isHatType(m.type) ? parts.hatAnchor : parts.eyeAnchor; }

export function addEquipmentV2(m, parts, g, H){
  const fn = BUILDERS[m.type];
  if(!fn) return false;
  fn(m, parts, g, H);
  return true;
}

export function wrapAddEquipment(originalAdd, IMAP){
  return function addEquipment(g, parts, eq){
    const leftover = {};
    const P = _getProfile && _getProfile();
    for(const slot in eq){
      const it = IMAP[eq[slot]]; if(!it) continue;
      if(slot === 'shoes' && P && P.shoes === 'hide') continue;
      if(addEquipmentV2(it.m, parts, g, pickAnchor(it.m, parts))){
        if(slot === 'bottom') addPantTrim(g);
        const sc = slotScale(slot, 1);
        if((slot === 'wrist' || slot === 'hands' || slot === 'shoes') && sc !== 1){
          const roots = slot === 'shoes' ? [parts['foot-1'], parts.foot1] : [parts['arm-1'], parts.arm1];
          for(const r of roots){ if(!r) continue; r.traverse(o => { if(o.isMesh && !o.userData.base) o.scale.multiplyScalar(sc); }); }
        }
        continue;
      }
      leftover[slot] = eq[slot];
    }
    if(Object.keys(leftover).length) originalAdd(g, parts, leftover);
  };
}

/** Cheap idle/move motion for halo bob + wing flap. Call AFTER animateChar. No allocations. */
export function tickAccessories(o, dt, t){
  const p = o && o.userData && o.userData.parts;
  const fx = p && p.accFx;
  if(!fx) return;
  if(fx.halo){
    fx.halo.position.y = fx.haloY + Math.sin(t * 2.2) * fx.haloAmp;
    // Keep the ring world-level (head idle/walk tilts hatAnchor). Yaw still follows the character.
    const par = fx.halo.parent;
    if(par && fx._qWanted){
      par.updateWorldMatrix(true, false);
      par.getWorldQuaternion(fx._qParent);
      fx._eu.setFromQuaternion(fx._qParent, 'YXZ');
      // Slight +X tilt: front edge down so the lobby camera (above, in front) sees the ring opening.
      fx._eu.x = fx.haloTiltX || 0; fx._eu.z = 0;
      fx._qWanted.setFromEuler(fx._eu);
      fx.halo.quaternion.copy(fx._qParent).invert().premultiply(fx._qWanted);
    }
  }
  const amt = (o.userData.zkAnim && o.userData.zkAnim.amt) || 0;
  if(fx.wingL){
    const a = Math.sin(t * (2.3 + amt * 2.2)) * fx.flapAmp * (.7 + amt * .45);
    fx.wingL.rotation.z = fx.wingLZ + a;
    fx.wingR.rotation.z = fx.wingRZ - a;
  }
  if(fx.ankleL){
    const a = Math.sin(t * (3.1 + amt * 2)) * .12 * (.6 + amt * .5);
    fx.ankleL.rotation.z = fx.ankleLZ + a;
    fx.ankleR.rotation.z = fx.ankleRZ - a;
  }
  // WIP Flame Crown flicker (no-op unless a flame item is equipped)
  if(fx.flames){
    const arr = fx.flames, n = fx.flameN;
    for(let i = 0; i < n; i++){
      const f = arr[i], s0 = fx.flameS0[i];
      const w1 = Math.sin(t * fx.flameF1[i] + fx.flameP[i]);
      const w2 = Math.sin(t * fx.flameF2[i] + fx.flameP[i] + 1.7);
      const sy = s0 * (1 + w1 * .14);
      f.scale.set(fx.flameSX0[i] * (1 + w2 * .08), sy, fx.flameSZ0[i] * (1 + w2 * .05));
      f.rotation.z = fx.flameZ0[i] + w1 * .08;
      f.rotation.x = fx.flameX0[i] + w2 * .06;
    }
    if(fx.flameGlow){
      const g = 1 + Math.sin(t * 6.2832 * 2) * .1 + Math.sin(t * 6.2832) * .05;
      fx.flameGlow.scale.setScalar(g);
    }
  }
}

/* ---------------- builders ---------------- */
const BUILDERS = {
  cargo(m, parts, g){
    const mat = MM(m, m.c, { side:THREE.DoubleSide });
    g.add(new THREE.Mesh(slice(...yRange(.36, .62, 'bottom'), slotScale('bottom', 1.05)), mat));
    const pocket = geo('cpocket', () => new THREE.BoxGeometry(.16, .12, .05));
    const flap = geo('cflap', () => new THREE.BoxGeometry(.16, .04, .05));
    const btn = geo('cbtn', () => new THREE.SphereGeometry(.018, 8, 6));
    const den = M(0x8a6a3a, { rough:.8 });
    for(const s of [-1, 1]){
      const y = .46, x = bodyR(y) * 1.08;
      const p = new THREE.Mesh(pocket, mat); p.position.set(x * s, y, .02); p.rotation.y = .15 * s; g.add(p);
      const f = new THREE.Mesh(flap, den); f.position.set(x * s, y + .07, .03); f.rotation.y = .15 * s; g.add(f);
      const b = new THREE.Mesh(btn, den); b.position.set(x * s, y + .07, .06); g.add(b);
    }
  },
  overalls(m, parts, g){
    const mat = MM(m, m.c, { side:THREE.DoubleSide });
    g.add(new THREE.Mesh(slice(...yRange(.26, .62, 'bottom'), slotScale('bottom', 1.05)), mat));
    const bib = new THREE.Mesh(geo('bib', () => new THREE.BoxGeometry(.4, .46, .05)), mat);
    bib.position.set(0, .84, bodyR(.9) * 1.06 + .01); g.add(bib);
    const btn = geo('obtn', () => new THREE.SphereGeometry(.03, 8, 6));
    const gold = M(0xffd24a, { metal:.7, rough:.3 });
    for(const s of [-1, 1]){
      const b = new THREE.Mesh(btn, gold); b.position.set(.12 * s, 1.02, bodyR(1.02) * 1.06 + .03); g.add(b);
      const st = new THREE.Mesh(geo('ovstrap', () => new THREE.TorusGeometry(.38, .032, 8, 16, Math.PI)), mat);
      st.rotation.set(0, Math.PI / 2, .15 * s); st.position.set(.15 * s, 1.16, 0); st.scale.set(1, 1, bodyR(1.16) / .45 + .15); g.add(st);
    }
    const pocket = new THREE.Mesh(geo('ovpocket', () => new THREE.BoxGeometry(.18, .12, .03)), M(0x2c5288, { rough:.8 }));
    pocket.position.set(0, .78, bodyR(.8) * 1.06 + .03); g.add(pocket);
  },
  skirt(m, parts, g){
    const mat = MM(m, m.c, { side:THREE.DoubleSide });
    g.add(new THREE.Mesh(flare(.6, .28, 1.04, 1.62), mat));
    const hem = new THREE.Mesh(geo(`skhem:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.3) * 1.58, .03, 8, 24)), MM(m, m.c2 || 0xfff0c8));
    hem.rotation.x = Math.PI / 2; hem.position.y = .3; g.add(hem);
    const bump = geo('skshell', () => new THREE.SphereGeometry(.07, 10, 8));
    const shell = MM(m, m.c2 || 0xfff0c8, { rough:.7 });
    for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2, r = bodyR(.32) * 1.6; const b = new THREE.Mesh(bump, shell); b.scale.set(1, .55, 1.1); b.position.set(Math.sin(a) * r, .3, Math.cos(a) * r); g.add(b); }
  },
  board(m, parts, g){
    const map = nebulaMap();
    const mat = MM(m, 0xffffff, { map, mapKey:'nebula', side:THREE.DoubleSide, emissive:m.glow || 0x2a0a80, ei:.35, rough:.72 });
    g.add(new THREE.Mesh(slice(...yRange(.34, .62, 'bottom'), slotScale('bottom', 1.05)), mat));
    const stripe = new THREE.Mesh(geo(`bstr:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.48) * 1.06, .02, 8, 20)), M(0x5ff6ff, { emissive:0x5ff6ff, ei:.5, rough:.4 }));
    stripe.rotation.x = Math.PI / 2; stripe.position.y = .48; g.add(stripe);
  },
  starlegs(m, parts, g){
    const mat = MM(m, 0xffffff, { map:starMap(), mapKey:'stars', side:THREE.DoubleSide, emissive:m.glow || 0x1a0840, ei:.4, rough:.7 });
    g.add(new THREE.Mesh(slice(...yRange(.22, .62, 'bottom'), slotScale('bottom', 1.05)), mat));
  },
  drape(m, parts, g){
    g.add(new THREE.Mesh(flare(.62, .32, 1.05, 1.42), creamM({ c:0xfffdf8, side:THREE.DoubleSide })));
    // wide gold hem band
    g.add(new THREE.Mesh(flare(.44, .30, 1.34, 1.5), goldM({ ei:.65 })));
  },

  sandals(m, parts){
    const soleM = MM(m, m.c, { rough:.7 }); const strapM = MM(m, 0x6a4a28, { rough:.75 });
    addBoth(parts, 'foot', (f, s) => {
      const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const sole = new THREE.Mesh(geo('ssole', () => new THREE.BoxGeometry(1, .22, 1)), soleM);
      sole.scale.set(sx * 2.05, .045, sz * 2.15); sole.position.y = -sy - .01; hold.add(sole);
      const st = geo('sstrap', () => new THREE.TorusGeometry(.2, .025, 8, 16, Math.PI));
      const a = new THREE.Mesh(st, strapM); a.scale.set(sx / .2 * .95, 1, sz / .2 * .7); a.rotation.x = .4; a.position.set(0, .02, .04); hold.add(a);
      const b = new THREE.Mesh(st, strapM); b.scale.set(sx / .2 * .85, 1, sz / .2 * .55); b.rotation.x = -.2; b.position.set(0, .02, -.06); hold.add(b);
    });
  },
  rainboots(m, parts){
    const boot = MM(m, m.c); const soleM = M(0x222222, { rough:.85 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, boot); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const shaft = new THREE.Mesh(geo('rshaft', () => new THREE.CylinderGeometry(1, 1.05, 1, 16, 1, true)), boot);
      shaft.material.side = THREE.DoubleSide;
      shaft.scale.set(sx * 1.05, .22, sz * 1.05); shaft.position.y = .08; hold.add(shaft);
      const rim = new THREE.Mesh(geo('rrim', () => new THREE.TorusGeometry(1, .1, 8, 16)), M(0xffffff, { rough:.7 }));
      rim.scale.set(sx * 1.05, sx * 1.05, sz * 1.05); rim.rotation.x = Math.PI / 2; rim.position.y = .19; hold.add(rim);
      const sole = new THREE.Mesh(geo('rsole', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), soleM);
      sole.scale.set(sx * 1.12, sy * 1.15, sz * 1.12); hold.add(sole);
    });
  },
  hightops(m, parts){
    const up = MM(m, m.c); const wh = MM(m, m.c2 || 0xffffff, { rough:.7 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, up); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const cuff = new THREE.Mesh(geo('hcuff', () => new THREE.CylinderGeometry(1, 1.02, 1, 16, 1, true)), up);
      cuff.material.side = THREE.DoubleSide; cuff.scale.set(sx * 1.08, .14, sz * 1.02); cuff.position.y = .07; hold.add(cuff);
      const sole = new THREE.Mesh(geo('hsole', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), wh);
      sole.scale.set(sx * 1.12, sy * 1.2, sz * 1.12); hold.add(sole);
      const lace = geo('hlace', () => new THREE.BoxGeometry(1, .04, .04));
      for(let i = 0; i < 3; i++){ const l = new THREE.Mesh(lace, wh); l.scale.x = sx * 1.1; l.position.set(0, .02 + i * .04, sz * .55); hold.add(l); }
    });
  },
  flippers(m, parts){
    const fin = MM(m, m.c, { metal:m.metal ? .85 : .15, rough:m.metal ? .2 : .55, emissive:m.glow || 0, ei:.4 });
    const ridgeM = M(0xffffff, { metal:.55, rough:.28, emissive:0x88e0ff, ei:.45 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, fin); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const blade = new THREE.Mesh(geo('finblade2', () => {
        const sh = new THREE.Shape();
        sh.moveTo(-.14, 0); sh.lineTo(.14, 0); sh.lineTo(.28, .42); sh.quadraticCurveTo(0, .58, -.28, .42); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth:.07, bevelEnabled:true, bevelThickness:.02, bevelSize:.018, bevelSegments:1 });
        g.rotateX(-Math.PI / 2);
        return g;
      }), fin);
      blade.position.set(0, -sy * .05, sz * .35); blade.rotation.x = -.35; hold.add(blade);
      const ridge = new THREE.Mesh(geo('finridge2', () => new THREE.BoxGeometry(.055, .035, .4)), ridgeM);
      ridge.position.set(0, .02, sz * .35 + .2); ridge.rotation.x = -.35; hold.add(ridge);
    });
  },
  rocket(m, parts){
    const boot = MM(m, m.c, { emissive:m.glow || 0x2a0a80, ei:.45 });
    const jet = M(0xffb040, { emissive:0xff8020, ei:1, rough:.35, metal:0 });
    const ring = M(0xc7d2e0, { metal:.8, rough:.25 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, boot); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const cuff = new THREE.Mesh(geo('rcuff', () => new THREE.CylinderGeometry(1, 1.02, 1, 14, 1, true)), boot);
      cuff.material.side = THREE.DoubleSide; cuff.scale.set(sx * 1.08, .16, sz * 1.02); cuff.position.y = .08; hold.add(cuff);
      const sole = new THREE.Mesh(geo('rsole2', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), M(0x1a1450, { rough:.6, metal:.2 }));
      sole.scale.set(sx * 1.12, sy * 1.15, sz * 1.12); hold.add(sole);
      for(const k of [-1, 1]){
        const noz = new THREE.Mesh(geo('rnoz', () => new THREE.CylinderGeometry(.07, .1, .16, 10)), ring);
        noz.rotation.x = Math.PI / 2; noz.position.set(k * sx * .45, 0, -sz - .06); hold.add(noz);
        const fl = new THREE.Mesh(geo('rflame', () => new THREE.ConeGeometry(.07, .18, 8)), jet);
        fl.rotation.x = Math.PI / 2; fl.position.set(k * sx * .45, 0, -sz - .2); hold.add(fl);
      }
    });
  },
  icarus(m, parts){
    const gold = goldM(); const strap = goldM({ c:GOLD_SOFT, metal:.7, rough:.25 });
    addBoth(parts, 'foot', (f, s) => {
      const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const sole = new THREE.Mesh(geo('isole', () => new THREE.BoxGeometry(1, .22, 1)), gold);
      sole.scale.set(sx * 2.05, .04, sz * 2.1); sole.position.y = -sy - .01;
      const st = geo('istrap', () => new THREE.TorusGeometry(.2, .022, 8, 16, Math.PI));
      const a = new THREE.Mesh(st, strap); a.scale.set(sx / .2 * .95, 1, sz / .2 * .7); a.rotation.x = .45; a.position.set(0, .015, .04);
      const b = new THREE.Mesh(st, strap); b.scale.set(sx / .2 * .8, 1, sz / .2 * .5); b.rotation.x = -.15; b.position.set(0, .015, -.05);
      const key = `icarus-shoe:${sx.toFixed(3)}:${sy.toFixed(3)}:${sz.toFixed(3)}`;
      hold.add(mergedMulti([{ meshes:[sole], mat:gold }, { meshes:[a, b], mat:strap }], key));
      const wing = makeSmallWing();
      wing.position.set(s * (sx + .04), .04, -sz * .2); wing.rotation.y = -s * .3; hold.add(wing);
      const fx = accFx(parts);
      if(s < 0){ fx.ankleL = wing; fx.ankleLZ = wing.rotation.z; }
      else { fx.ankleR = wing; fx.ankleRZ = wing.rotation.z; }
    });
  },

  friendship(m, parts){
    const a = MM(m, m.c); const b = MM(m, 0x4fd0ff); const bead = MM(m, 0xffe36b);
    addBoth(parts, 'arm', (arm) => {
      const t1 = new THREE.Mesh(geo('fb1', () => new THREE.TorusGeometry(.125, .018, 8, 16)), a);
      t1.rotation.x = Math.PI / 2; t1.position.y = -.08; arm.add(t1);
      const t2 = new THREE.Mesh(geo('fb2', () => new THREE.TorusGeometry(.125, .018, 8, 16)), b);
      t2.rotation.x = Math.PI / 2; t2.position.y = -.12; arm.add(t2);
      const h = new THREE.Mesh(heartSh(), bead); h.scale.setScalar(.07); h.position.set(0, -.1, .14); arm.add(h);
    });
  },
  watch(m, parts){
    const band = MM(m, m.c, { rough:.55, metal:.2 }); const face = M(m.c2 || 0x2ee6d6, { emissive:m.c2 || 0x2ee6d6, ei:.7, rough:.25, metal:.1 });
    const bezel = M(0xc7d2e0, { metal:.8, rough:.25 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('wband', () => new THREE.TorusGeometry(.13, .022, 8, 16)), band);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const z = new THREE.Mesh(geo('wbezel', () => new THREE.CylinderGeometry(.07, .07, .03, 14)), bezel);
      z.rotation.x = Math.PI / 2; z.position.set(0, -.1, .13); arm.add(z);
      const sc = new THREE.Mesh(geo('wface', () => new THREE.CircleGeometry(.055, 14)), face);
      sc.position.set(0, -.1, .148); arm.add(sc);
    });
  },
  coral(m, parts){
    const mat = MM(m, m.c, { rough:.7 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('cband', () => new THREE.TorusGeometry(.132, .03, 8, 16)), mat);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const nub = geo('cnub', () => new THREE.SphereGeometry(.04, 8, 6));
      const br = geo('cbr', () => new THREE.ConeGeometry(.025, .08, 6));
      for(let i = 0; i < 6; i++){
        const a = i / 6 * Math.PI * 2, n = new THREE.Mesh(nub, mat);
        n.position.set(Math.sin(a) * .14, -.1 + (i % 2 ? .03 : -.02), Math.cos(a) * .14); arm.add(n);
        const c = new THREE.Mesh(br, mat); c.position.copy(n.position); c.position.y += .05; c.rotation.z = .4 * (i % 2 ? 1 : -1); arm.add(c);
      }
    });
  },
  pearl(m, parts){
    const cuff = goldM({ c:0xe8d9b0, metal:.75, rough:.22 }); const p = M(0xf4efe6, { rough:.35, metal:.15, emissive:0x332211, ei:.15 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('pcuff', () => new THREE.TorusGeometry(.135, .028, 8, 16)), cuff);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const pearl = geo('pearl', () => new THREE.SphereGeometry(.032, 10, 8));
      for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; const s = new THREE.Mesh(pearl, p); s.position.set(Math.sin(a) * .15, -.1, Math.cos(a) * .15); arm.add(s); }
    });
  },
  radiant(m, parts){
    const gold = goldM({ ei:.7, emissive:0x886600 });
    const glow = glowM(0xffe7a0, .35);
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('rcuff2', () => new THREE.TorusGeometry(.135, .032, 8, 16)), gold);
      t.rotation.x = Math.PI / 2; t.position.y = -.1;
      const ring = new THREE.Mesh(geo('rglow', () => new THREE.TorusGeometry(.135, .05, 8, 16)), glow);
      ring.rotation.x = Math.PI / 2; ring.position.y = -.1;
      const ray = geo('rray', () => new THREE.BoxGeometry(.018, .09, .012));
      const rays = [];
      for(let i = 0; i < 8; i++){
        const a = i / 8 * Math.PI * 2; const r = new THREE.Mesh(ray, gold);
        r.position.set(Math.sin(a) * .2, -.1, Math.cos(a) * .2); r.lookAt(0, -.1, 0); rays.push(r);
      }
      arm.add(mergedMulti([{ meshes:[t, ...rays], mat:gold }, { meshes:[ring], mat:glow }], 'radiant'));
    });
  },

  mittens(m, parts){
    const mat = MM(m, m.c); const cuff = MM(m, m.c2 || 0xf4f0e6);
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('mit', () => new THREE.SphereGeometry(.155, 12, 10)), mat);
      h.scale.set(1.05, 1, 1.15); h.position.set(0, -.22, 0); arm.add(h);
      const th = new THREE.Mesh(geo('mthumb', () => new THREE.SphereGeometry(.06, 8, 6)), mat);
      th.position.set(.1, -.2, .06); arm.add(th);
      const c = new THREE.Mesh(geo('mcuff', () => new THREE.CylinderGeometry(.12, .13, .08, 12)), cuff);
      c.position.y = -.12; arm.add(c);
    });
  },
  boxing(m, parts){
    const mat = MM(m, m.c, { rough:.7 }); const cuff = M(0x222222, { rough:.7 }); const lac = M(0xf4f4f4, { rough:.6 });
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('boxg', () => new THREE.SphereGeometry(.2, 12, 10)), mat);
      h.scale.set(1.05, 1, 1.15); h.position.set(0, -.24, .02); arm.add(h);
      const c = new THREE.Mesh(geo('boxc', () => new THREE.CylinderGeometry(.11, .12, .1, 12)), cuff);
      c.position.y = -.12; arm.add(c);
      const l = new THREE.Mesh(geo('boxl', () => new THREE.BoxGeometry(.16, .03, .03)), lac);
      l.position.set(0, -.12, .12); arm.add(l);
    });
  },
  claws(m, parts){
    const mat = MM(m, m.c, { rough:.65 });
    addBoth(parts, 'arm', (arm, s) => {
      const palm = new THREE.Mesh(geo('cpalm', () => new THREE.SphereGeometry(.11, 10, 8)), mat);
      palm.position.set(0, -.2, 0); arm.add(palm);
      const pin = geo('cpin', () => { const g = new THREE.CapsuleGeometry(.045, .2, 6, 8); return g; });
      const p1 = new THREE.Mesh(pin, mat); p1.position.set(.05 * s, -.32, .04); p1.rotation.z = .7 * s; p1.rotation.x = -.15; arm.add(p1);
      const p2 = new THREE.Mesh(pin, mat); p2.position.set(-.02 * s, -.32, .06); p2.rotation.z = .25 * s; p2.rotation.x = .2; arm.add(p2);
    });
  },
  sparkle(m, parts){
    const mat = MM(m, m.c, { emissive:m.glow || 0x2a1060, ei:.5, rough:.55 });
    const star = M(0xffe7a0, { emissive:0xffe7a0, ei:1, rough:.3 });
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('sglove', () => new THREE.SphereGeometry(.15, 12, 10)), mat);
      h.position.set(0, -.2, 0); arm.add(h);
      const sg = starSh();
      for(let i = 0; i < 4; i++){
        const st = new THREE.Mesh(sg, star); st.scale.setScalar(.05);
        const a = i / 4 * Math.PI * 2;
        st.position.set(Math.sin(a) * .14, -.2 + (i % 2 ? .05 : -.04), Math.cos(a) * .14); arm.add(st);
      }
    });
  },
  gauntlets(m, parts){
    const gold = goldM(); const soft = goldM({ c:GOLD_SOFT, metal:.7, rough:.25 });
    const gemM = M(0x5ff6ff, { emissive:0x2288aa, ei:.8, metal:.3, rough:.2 });
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('gglove', () => new THREE.SphereGeometry(.15, 10, 8)), gold);
      h.position.set(0, -.2, 0);
      const c = new THREE.Mesh(geo('gcuff', () => new THREE.CylinderGeometry(.14, .11, .1, 12, 1, true)), gold);
      c.material.side = THREE.DoubleSide; c.position.y = -.1;
      const gem = new THREE.Mesh(geo('ggem', () => new THREE.SphereGeometry(.03, 8, 6)), gemM);
      gem.position.set(0, -.18, .14);
      const rim = new THREE.Mesh(geo('grim', () => new THREE.TorusGeometry(.14, .015, 8, 14)), soft);
      rim.rotation.x = Math.PI / 2; rim.position.y = -.05;
      arm.add(mergedMulti([
        { meshes:[h, c], mat:gold },
        { meshes:[rim], mat:soft },
        { meshes:[gem], mat:gemM }
      ], 'gauntlet'));
    });
  },

  bucket(m, parts, g, H){
    const mat = MM(m, m.c);
    const crown = new THREE.Mesh(geo('buck', () => new THREE.CylinderGeometry(.42, .5, .28, 20, 1, true)), mat);
    crown.material.side = THREE.DoubleSide; crown.position.y = .34; H.add(crown);
    const top = new THREE.Mesh(geo('bucktop', () => new THREE.CircleGeometry(.42, 20)), mat);
    top.rotation.x = -Math.PI / 2; top.position.y = .48; H.add(top);
    const brim = new THREE.Mesh(geo('buckbrim', () => new THREE.CylinderGeometry(.62, .62, .04, 20)), mat);
    brim.position.y = .22; H.add(brim);
    const band = new THREE.Mesh(geo('buckband', () => new THREE.TorusGeometry(.46, .025, 8, 20)), M(0x3cae3c, { rough:.75 }));
    band.rotation.x = Math.PI / 2; band.position.y = .3; H.add(band);
  },
  party(m, parts, g, H){
    const mat = MM(m, 0xffffff, { map:partyMap(), mapKey:'party', rough:.7 });
    const cone = new THREE.Mesh(geo('pcone', () => new THREE.ConeGeometry(.28, .85, 16)), mat);
    cone.position.y = .62; H.add(cone);
    const pom = new THREE.Mesh(geo('ppom', () => new THREE.SphereGeometry(.08, 10, 8)), MM(m, m.c2 || 0xffe36b));
    pom.position.y = 1.08; H.add(pom);
    const brim = new THREE.Mesh(geo('pbrim', () => new THREE.TorusGeometry(.28, .03, 8, 16)), MM(m, m.c));
    brim.rotation.x = Math.PI / 2; brim.position.y = .22; H.add(brim);
  },
  pirate(m, parts, g, H){
    const mat = MM(m, m.c, { rough:.7 }); const gold = goldM({ c:m.c2 || GOLD });
    const grp = new THREE.Group(); H.add(grp);
    const cap = new THREE.Mesh(geo('pcrown', () => new THREE.SphereGeometry(.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat);
    cap.scale.y = .75; cap.position.y = .26; grp.add(cap);
    // wide cocked brim (readable tricorne stand-in): an oval disc tipped up at the sides
    const brim = new THREE.Mesh(geo('pbrim2', () => new THREE.CylinderGeometry(.62, .66, .05, 20)), mat);
    brim.scale.set(1.15, 1, .85); brim.rotation.z = .18; brim.position.set(0, .24, .04); grp.add(brim);
    const fold = geo('pfold', () => new THREE.BoxGeometry(.08, .16, .55));
    const f1 = new THREE.Mesh(fold, mat); f1.position.set(-.5, .34, 0); f1.rotation.z = .55; grp.add(f1);
    const f2 = new THREE.Mesh(fold, mat); f2.position.set(.5, .34, 0); f2.rotation.z = -.55; grp.add(f2);
    const band = new THREE.Mesh(geo('pband', () => new THREE.TorusGeometry(.36, .025, 8, 16)), gold);
    band.rotation.x = Math.PI / 2; band.position.y = .25; grp.add(band);
    const buckle = new THREE.Mesh(geo('pbuck', () => new THREE.TorusGeometry(.05, .012, 8, 12)), gold);
    buckle.position.set(0, .26, .4); grp.add(buckle);
    const fe = new THREE.Mesh(geo('pfeather', () => new THREE.CapsuleGeometry(.022, .38, 6, 8)), M(0xe8322f, { rough:.7 }));
    fe.position.set(.22, .58, .05); fe.rotation.z = -.55; fe.rotation.x = -.25; grp.add(fe);
  },
  headphones(m, parts, g, H){
    const metal = MM(m, m.c, { metal:.85, rough:.22 });
    const pad = M(0x222230, { rough:.7 });
    const band = new THREE.Mesh(geo('hpband', () => new THREE.TorusGeometry(.5, .035, 8, 20, Math.PI)), metal);
    band.rotation.z = Math.PI / 2; band.position.y = .15; H.add(band);
    const cup = geo('hpcup', () => new THREE.CylinderGeometry(.14, .16, .1, 14));
    const cush = geo('hpcush', () => new THREE.TorusGeometry(.12, .035, 8, 14));
    for(const s of [-1, 1]){
      const c = new THREE.Mesh(cup, metal); c.rotation.z = Math.PI / 2; c.position.set(.5 * s, .14, 0); H.add(c);
      const p = new THREE.Mesh(cush, pad); p.rotation.y = Math.PI / 2; p.position.set(.44 * s, .14, 0); H.add(p);
    }
  },
  flower(m, parts, g, H){
    const stem = MM(m, 0x3cae3c);
    const band = new THREE.Mesh(geo('flband', () => new THREE.TorusGeometry(.46, .03, 8, 20)), stem);
    band.rotation.x = Math.PI / 2; band.position.y = .32; H.add(band);
    const petal = geo('flpetal', () => new THREE.SphereGeometry(.07, 8, 6));
    const mid = geo('flmid', () => new THREE.SphereGeometry(.035, 8, 6));
    const cols = [m.c, 0xff8ab0, 0xffe36b, 0xff7a3d, 0xc77dff];
    for(let i = 0; i < 7; i++){
      const a = i / 7 * Math.PI * 2, y = .34, r = .46;
      const grp = new THREE.Group(); grp.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      const pm = M(cols[i % cols.length], { rough:.7, emissive:m.glow || 0x4a1028, ei:.25 });
      for(let p = 0; p < 5; p++){ const pa = p / 5 * Math.PI * 2; const pe = new THREE.Mesh(petal, pm); pe.scale.set(1, .5, 1); pe.position.set(Math.cos(pa) * .06, .02, Math.sin(pa) * .06); grp.add(pe); }
      const ce = new THREE.Mesh(mid, MM(m, m.c2 || 0xffe36b, { emissive:0x553300, ei:.4 })); ce.position.y = .03; grp.add(ce);
      H.add(grp);
    }
  },
  wizard(m, parts, g, H){
    const mat = MM(m, 0xffffff, { map:wizardMap(), mapKey:'wizard', rough:.72 });
    const cone = new THREE.Mesh(geo('wcone', () => new THREE.ConeGeometry(.34, .92, 16)), mat);
    cone.position.y = .72; cone.rotation.z = -.1; H.add(cone);
    const brim = new THREE.Mesh(geo('wbrim', () => new THREE.CylinderGeometry(.62, .62, .05, 20)), MM(m, m.c, { rough:.72 }));
    brim.position.y = .26; H.add(brim);
    const band = new THREE.Mesh(geo('wband', () => new THREE.TorusGeometry(.37, .03, 8, 16)), goldM({ c:m.c2 || GOLD }));
    band.rotation.x = Math.PI / 2; band.position.y = .3; H.add(band);
    const buckle = new THREE.Mesh(starSh(), goldM({ c:m.c2 || GOLD, ei:.6, emissive:0x553300 }));
    buckle.scale.setScalar(.1); buckle.position.set(0, .3, .4); H.add(buckle);
  },
  halo(m, parts, g, H){
    const grp = new THREE.Group();
    // hatAnchor is scaled per species (Ollie C 1.1, Wade 1.35). Build in world-sized
    // units, and sit the ring just ABOVE the measured head crown (a fixed lift buries
    // it inside Wade's tall head).
    const hs = Math.max((H && H.scale && H.scale.x) || 1, .001);
    const inv = 1 / hs;
    const ringR = .24 * inv, tube = .055 * inv;
    const lift = haloLiftAboveHead(H) + .20 * inv;
    const ringM = goldM({ ei:.75, emissive:0xffc433, envI:2.6, rough:.1 });
    const lipM = goldM({ c:0xfff6c8, ei:1, emissive:0xffe7a0, envI:2.4, rough:.08 });
    const sm = goldM({ c:0xfff6c8, ei:1.2, emissive:0xffe7a0, rough:.1 });
    const key = 'halo4:' + hs.toFixed(3);
    const ring = new THREE.Mesh(geo(key + ':ring', () => new THREE.TorusGeometry(ringR, tube, 8, 22)), ringM);
    ring.rotation.x = Math.PI / 2;
    const lip = new THREE.Mesh(geo(key + ':lip', () => new THREE.TorusGeometry(ringR, tube * .42, 6, 18)), lipM);
    lip.rotation.x = Math.PI / 2;
    const spark = geo(key + ':spark', () => new THREE.SphereGeometry(.024 * inv, 6, 5));
    const sparks = [];
    for(let i = 0; i < 6; i++){
      const a = i / 6 * Math.PI * 2 + .3, s = new THREE.Mesh(spark, sm);
      const rr = ringR + tube + (i % 2 ? .025 : .01) * inv;
      s.position.set(Math.cos(a) * rr, (i % 2 ? .035 : -.025) * inv, Math.sin(a) * rr);
      s.scale.setScalar(i % 2 ? 1 : .65); sparks.push(s);
    }
    // Modest warm glow in the ring plane — small enough not to read as a soap bubble.
    const glow = goldGlow(ringR + tube * 1.8, .40); glow.rotation.x = -Math.PI / 2;
    grp.add(mergedMulti([
      { meshes: [ring], mat: ringM },
      { meshes: [lip, ...sparks], mat: sm },
      { meshes: [glow], mat: glow.material }
    ], key + ':set'));
    grp.position.y = lift; H.add(grp);
    const fx = accFx(parts);
    fx.halo = grp; fx.haloY = lift; fx.haloAmp = .02; fx.haloTiltX = .38;
    if(!fx._qWanted){
      fx._qWanted = new THREE.Quaternion();
      fx._qParent = new THREE.Quaternion();
      fx._eu = new THREE.Euler();
    }
  },

  snorkel(m, parts, g, H){
    const frame = MM(m, m.c); const glass = M(0xaef4ff, { opacity:.35, rough:.1, metal:.1, dw:0 });
    const skirt = MM(m, 0x0d6f80);
    for(const s of [-1, 1]){
      const r = new THREE.Mesh(geo('snring', () => new THREE.TorusGeometry(.13, .03, 8, 16)), frame);
      r.position.set(.18 * s, .15, .5); H.add(r);
      const l = new THREE.Mesh(geo('snglass', () => new THREE.CircleGeometry(.12, 16)), glass);
      l.position.set(.18 * s, .15, .51); H.add(l);
    }
    const br = new THREE.Mesh(geo('snbr', () => new THREE.BoxGeometry(.12, .03, .03)), frame);
    br.position.set(0, .16, .52); H.add(br);
    const strap = new THREE.Mesh(geo('snstrap', () => new THREE.TorusGeometry(.49, .025, 8, 20)), skirt);
    strap.rotation.x = Math.PI / 2; strap.position.y = .15; H.add(strap);
    // tube goes UP from the left, not forward into a snout
    const tubeM = MM(m, m.c);
    const tube = new THREE.Mesh(geo('sntube', () => new THREE.CylinderGeometry(.03, .03, .42, 10)), tubeM);
    tube.position.set(-.28, .38, .42); H.add(tube);
    const bend = new THREE.Mesh(geo('snbend', () => new THREE.TorusGeometry(.06, .03, 8, 10, Math.PI / 2)), tubeM);
    bend.position.set(-.28, .17, .46); bend.rotation.set(Math.PI / 2, 0, 0); H.add(bend);
    const cap = new THREE.Mesh(geo('sncap', () => new THREE.SphereGeometry(.04, 8, 6)), tubeM);
    cap.position.set(-.28, .59, .42); H.add(cap);
  },
  glasses3d(m, parts, g, H){
    const frame = MM(m, m.c);
    const lens = geo('3dlens', () => new THREE.BoxGeometry(.2, .14, .03));
    const left = new THREE.Mesh(lens, M(0xff2a4a, { opacity:.45, emissive:0x440010, ei:.3, rough:.2, dw:0 }));
    const right = new THREE.Mesh(lens, M(0x2ac0ff, { opacity:.45, emissive:0x002244, ei:.3, rough:.2, dw:0 }));
    left.position.set(-.2, .16, .52); right.position.set(.2, .16, .52); H.add(left, right);
    const br = new THREE.Mesh(geo('3dbr', () => new THREE.BoxGeometry(.1, .03, .03)), frame); br.position.set(0, .16, .52); H.add(br);
    const rim = geo('3drim', () => new THREE.BoxGeometry(.22, .16, .02));
    for(const s of [-1, 1]){ const r = new THREE.Mesh(rim, frame); r.position.set(.2 * s, .16, .505); H.add(r); }
    const arm = geo('3darm', () => new THREE.BoxGeometry(.03, .03, .28));
    for(const s of [-1, 1]){ const a = new THREE.Mesh(arm, frame); a.position.set(.3 * s, .16, .38); H.add(a); }
  },
  monocle(m, parts, g, H){
    const metal = MM(m, m.c, { metal:.9, rough:.18 });
    const glass = M(0xe8f4ff, { opacity:.3, rough:.05, metal:.1, dw:0 });
    const r = new THREE.Mesh(geo('monr', () => new THREE.TorusGeometry(.1, .02, 8, 16)), metal);
    r.position.set(.2, .15, .52); H.add(r);
    const l = new THREE.Mesh(geo('mong', () => new THREE.CircleGeometry(.09, 16)), glass);
    l.position.set(.2, .15, .525); H.add(l);
    // chain hanging back toward the ear — a few pearls, not a snout-crossing strap
    const bead = geo('monbead', () => new THREE.SphereGeometry(.018, 8, 6));
    for(let i = 0; i < 6; i++){ const b = new THREE.Mesh(bead, metal); b.position.set(.28 + i * .02, .12 - i * .05, .48 - i * .05); H.add(b); }
  },
  skigoggles(m, parts, g, H){
    const frame = MM(m, m.c, { rough:.45, metal:.15, emissive:m.glow || 0x551800, ei:.4 });
    const glass = M(0xff8a3d, { opacity:.28, emissive:0xff5a1f, ei:.4, rough:.1, dw:0 });
    const strap = M(0x2a1810, { rough:.7 });
    for(const s of [-1, 1]){
      const r = new THREE.Mesh(geo('skring', () => new THREE.TorusGeometry(.15, .04, 8, 16)), frame);
      r.scale.set(1.15, .85, 1); r.position.set(.18 * s, .16, .5); H.add(r);
      const l = new THREE.Mesh(geo('skglass', () => new THREE.CircleGeometry(.14, 16)), glass);
      l.scale.set(1.15, .85, 1); l.position.set(.18 * s, .16, .515); H.add(l);
    }
    const br = new THREE.Mesh(geo('skbr', () => new THREE.BoxGeometry(.1, .05, .04)), frame);
    br.position.set(0, .16, .52); H.add(br);
    const st = new THREE.Mesh(geo('skstrap', () => new THREE.TorusGeometry(.5, .035, 8, 20)), strap);
    st.rotation.x = Math.PI / 2; st.position.y = .16; H.add(st);
  },
  // Override the original solid visor so bead eyes stay visible (Wade / Bubbles especially).
  visor(m, parts, g, H){
    makeVisor(H, MM(m, m.c, { metal:.4, rough:.25, emissive:m.c, ei:.45 }),
      M(m.c, { opacity:.22, emissive:m.c, ei:.35, rough:.08, metal:.1, dw:0, side:THREE.DoubleSide }));
  },
  goldvisor(m, parts, g, H){
    makeVisor(H, goldM({ ei:1, emissive:0xffc033 }),
      M(0xfff4c4, { opacity:.2, emissive:0xffe7a0, ei:.4, rough:.08, metal:.25, dw:0, side:THREE.DoubleSide, env:goldEnv(), envI:.8 }));
  },

  sailor(m, parts, g){
    const mat = MM(m, 0xffffff, { map:sailorMap(), mapKey:'sailor', side:THREE.DoubleSide, rough:.75 });
    g.add(new THREE.Mesh(slice(...yRange(.6, 1.2, 'top'), slotScale('top', 1.04)), mat));
    addSleeves(parts, mat);
    const collar = M(m.c2 || 0xf4f7ff, { rough:.75, side:THREE.DoubleSide });
    const flap = geo('scollar', () => new THREE.BoxGeometry(.55, .02, .28));
    const f = new THREE.Mesh(flap, collar); f.position.set(0, 1.16, -bodyR(1.16) * .3); f.rotation.x = .4; g.add(f);
    const v = new THREE.Mesh(geo('sv', () => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.16, .22); s.lineTo(-.16, .22); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth:.02, bevelEnabled:false });
    }), collar);
    v.position.set(0, 1.0, bodyR(1.08) * 1.04 + .01); g.add(v);
    const tie = new THREE.Mesh(geo('stie', () => new THREE.BoxGeometry(.06, .16, .02)), M(0xe8322f, { rough:.7 }));
    tie.position.set(0, 1.02, bodyR(1.02) * 1.04 + .02); g.add(tie);
  },
  vest(m, parts, g){
    const mat = MM(m, m.c, { side:THREE.DoubleSide, rough:.7 });
    g.add(new THREE.Mesh(slice(...yRange(.62, 1.18, 'top'), slotScale('top', 1.14)), mat));
    const tape = M(0xf4f4f4, { rough:.6, emissive:0x333333, ei:.08 });
    for(const y of [.75, 1.05]){
      const t = new THREE.Mesh(geo(`vtape:${profKey()}:${y}`, () => new THREE.TorusGeometry(bodyR(y) * 1.15, .025, 8, 20)), tape);
      t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t);
    }
    const buck = new THREE.Mesh(geo('vbuck', () => new THREE.BoxGeometry(.14, .08, .04)), M(0x222222, { metal:.5, rough:.4 }));
    buck.position.set(0, .9, bodyR(.9) * 1.16 + .02); g.add(buck);
    const col = new THREE.Mesh(geo(`vcol:${profKey()}`, () => new THREE.TorusGeometry(bodyR(1.18) * 1.1, .05, 8, 20)), mat);
    col.rotation.x = Math.PI / 2; col.position.y = 1.18; g.add(col);
  },
  apron(m, parts, g){
    const cloth = MM(m, m.c, { rough:.8 }); const red = MM(m, m.c2 || 0xd12a2a);
    const panel = new THREE.Mesh(geo('apron', () => new THREE.BoxGeometry(.55, .8, .04)), cloth);
    panel.position.set(0, .82, bodyR(.85) * 1.04 + .02); g.add(panel);
    const pocket = new THREE.Mesh(geo('apock', () => new THREE.BoxGeometry(.22, .14, .03)), cloth);
    pocket.position.set(0, .58, bodyR(.6) * 1.04 + .04); g.add(pocket);
    const strap = new THREE.Mesh(geo('astrap', () => new THREE.TorusGeometry(.28, .02, 8, 16, Math.PI)), cloth);
    strap.position.set(0, 1.22, 0); strap.rotation.x = .2; g.add(strap);
    const ker = new THREE.Mesh(geo('aker', () => new THREE.BoxGeometry(.22, .08, .02)), red);
    ker.position.set(0, 1.2, bodyR(1.18) * 1.02 + .02); g.add(ker);
  },
  hawaii(m, parts, g){
    const mat = MM(m, 0xffffff, { map:hawaiiMap(), mapKey:'hawaii', side:THREE.DoubleSide, rough:.75 });
    g.add(new THREE.Mesh(slice(...yRange(.6, 1.2, 'top'), slotScale('top', 1.05)), mat));
    addSleeves(parts, mat, .18);
  },
  hoodie(m, parts, g, H){
    const map = sunsetMap();
    const mat = MM(m, 0xffffff, { map, mapKey:'sunset', side:THREE.DoubleSide, rough:.75, emissive:m.glow || 0x661400, ei:.3 });
    g.add(new THREE.Mesh(slice(...yRange(.58, 1.22, 'top'), slotScale('top', 1.07)), mat));
    addSleeves(parts, mat, .2);
    const pocket = new THREE.Mesh(geo('hpock', () => new THREE.BoxGeometry(.42, .16, .06)), mat);
    pocket.position.set(0, .72, bodyR(.72) * 1.08 + .01); g.add(pocket);
    const cord = geo('hcord', () => new THREE.SphereGeometry(.025, 8, 6));
    const cm = M(0xffe36b, { rough:.6 });
    for(const s of [-1, 1]){ const k = new THREE.Mesh(cord, cm); k.position.set(.08 * s, 1.14, bodyR(1.14) * 1.08); g.add(k); }
    // hood sits on hatAnchor (not H — hoodie is a top, so H is eyeAnchor) so it scales with the head
    const HP = parts.hatAnchor;
    if(HP){
      const hood = new THREE.Mesh(geo('hood', () => new THREE.SphereGeometry(.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)), mat);
      hood.scale.set(1.05, 1.05, .95); hood.rotation.x = Math.PI; hood.position.set(0, .28, -.12); HP.add(hood);
      const rim = new THREE.Mesh(geo('hoodrim', () => new THREE.TorusGeometry(.42, .04, 8, 16, Math.PI)), mat);
      rim.rotation.set(.3, 0, 0); rim.position.set(0, .22, .15); HP.add(rim);
    }
  },
  cape(m, parts, g){
    const cloth = MM(m, m.c, { side:THREE.DoubleSide, rough:.78 });
    const gold = goldM({ c:m.c2 || GOLD });
    const cape = new THREE.Mesh(capeGeo(), cloth);
    cape.position.set(0, 1.05, -bodyR(1.1) - .04); g.add(cape);
    const trim = new THREE.Mesh(capeGeo(), gold);
    trim.scale.set(1.04, 1.02, .96); trim.position.set(0, 1.05, -bodyR(1.1) - .06); g.add(trim);
    const clasp = new THREE.Mesh(geo('cclasp', () => new THREE.SphereGeometry(.05, 10, 8)), gold);
    clasp.position.set(0, 1.2, bodyR(1.2) * 1.02); g.add(clasp);
    const col = new THREE.Mesh(geo(`ccol:${profKey()}`, () => new THREE.TorusGeometry(bodyR(1.2) * 1.02, .04, 8, 16)), gold);
    col.rotation.x = Math.PI / 2; col.position.y = 1.2; g.add(col);
  },
  robe(m, parts, g){
    const cloth = creamM({ c:0xfffdf8, side:THREE.DoubleSide, rough:.78 });
    const gold = goldM({ ei:.65 });
    // white / cream toga with BIG gold trim so gold is the dominant read
    const body = new THREE.Mesh(flare(1.18, .48, 1.06, 1.38), cloth);
    const hem = new THREE.Mesh(flare(.62, .48, 1.32, 1.46), gold);
    const sash = new THREE.Mesh(slice(.78, .9, 1.12), gold);
    addSleevesAndPauldrons(parts, cloth, gold, .18);
    // gold necklace + hem + sash share the body gold material (pendant gem is a 2nd group)
    addHeavenNecklace(g, gold, [hem, sash]);
    g.add(body);
    // Upper back, just behind the shoulders, so the fan is visible from the front.
    const wr = bodyR(1.08) * .62;
    const wingL = makeWing(-1), wingR = makeWing(1);
    wingL.position.set(-wr, 1.06, -.16); wingR.position.set(wr, 1.06, -.16);
    g.add(wingL, wingR);
    const fx = accFx(parts);
    fx.wingL = wingL; fx.wingR = wingR; fx.wingLZ = 0; fx.wingRZ = 0; fx.flapAmp = .10;
  },

  joggers(m, parts, g){
    const mat = MM(m, m.c, { side:THREE.DoubleSide, rough:.8 });
    g.add(new THREE.Mesh(slice(...yRange(.22, .62, 'bottom'), slotScale('bottom', 1.05)), mat));
    const cuff = geo(`jocuff:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.26) * 1.08, .03, 8, 16));
    const c = new THREE.Mesh(cuff, MM(m, 0x2e3a44, { rough:.75 }));
    c.rotation.x = Math.PI / 2; c.position.y = .26; g.add(c);
    const draw = new THREE.Mesh(geo(`jodraw:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.6) * 1.05, .015, 8, 16)), M(0xf4f0e6, { rough:.7 }));
    draw.rotation.x = Math.PI / 2; draw.position.y = .6; g.add(draw);
  },
  kelpwrap(m, parts, g){
    const leaf = geo('kelpleaf', () => {
      const g = new THREE.SphereGeometry(1, 10, 8); g.scale(.16, .42, .05); g.translate(0, -.35, 0); return g;
    });
    const a = MM(m, m.c, { rough:.8 }); const b = MM(m, m.c2 || 0x8ee05a, { rough:.8 });
    const waist = new THREE.Mesh(geo(`kelpw:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.58) * 1.06, .03, 8, 16)), a);
    waist.rotation.x = Math.PI / 2; waist.position.y = .58; g.add(waist);
    for(let i = 0; i < 8; i++){
      const ang = i / 8 * Math.PI * 2, L = new THREE.Mesh(leaf, i % 2 ? b : a);
      L.position.set(Math.sin(ang) * bodyR(.5) * 1.05, .55, Math.cos(ang) * bodyR(.5) * 1.05);
      L.rotation.y = ang; L.rotation.x = .25 + (i % 3) * .1; L.scale.setScalar(.9 + (i % 3) * .2); g.add(L);
    }
  },
  tutu(m, parts, g){
    const poof = MM(m, m.c, { side:THREE.DoubleSide, rough:.75 });
    const under = MM(m, m.c2 || 0xffe6fa, { side:THREE.DoubleSide, rough:.8 });
    g.add(new THREE.Mesh(flare(.62, .4, 1.08, 2.05), poof));
    g.add(new THREE.Mesh(flare(.6, .36, 1.15, 2.25), under));
    const waist = new THREE.Mesh(geo(`tutuw:${profKey()}`, () => new THREE.TorusGeometry(bodyR(.62) * 1.08, .035, 8, 16)), MM(m, 0xffffff, { rough:.7 }));
    waist.rotation.x = Math.PI / 2; waist.position.y = .62; g.add(waist);
  },
  slippers(m, parts){
    const fluff = MM(m, m.c, { rough:.9 }); const sole = M(0xdde6f4, { rough:.8 });
    addBoth(parts, 'foot', (f) => {
      const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const puff = new THREE.Mesh(geo('slpuff', () => new THREE.SphereGeometry(1, 12, 10)), fluff);
      puff.scale.set(sx * 1.15, sy * 1.2, sz * 1.25); hold.add(puff);
      const s = new THREE.Mesh(geo('slsole', () => new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), sole);
      s.scale.set(sx * 1.2, sy * 1.15, sz * 1.25); hold.add(s);
    });
  },
  iceskates(m, parts){
    const boot = MM(m, m.c, { metal:.25, rough:.4 }); const blade = M(0xc7d2e0, { metal:.9, rough:.18 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, boot); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const cuff = new THREE.Mesh(geo('skcuff', () => new THREE.CylinderGeometry(1, 1.02, 1, 14, 1, true)), boot);
      cuff.material.side = THREE.DoubleSide; cuff.scale.set(sx * 1.05, .12, sz * 1.0); cuff.position.y = .06; hold.add(cuff);
      const bl = new THREE.Mesh(geo('skblade', () => new THREE.BoxGeometry(1, .06, 1)), blade);
      bl.scale.set(sx * .35, 1, sz * 2.3); bl.position.set(0, -sy - .05, 0); hold.add(bl);
    });
  },
  lavaboots(m, parts){
    const boot = lavaM({ ei:.9 }); const sole = M(0xff6a1a, { emissive:0xff4a00, ei:.9, rough:.5 });
    addBoth(parts, 'foot', (f) => {
      hideToes(f, boot); const hold = footHold(f); const sx = f.scale.x, sy = f.scale.y, sz = f.scale.z;
      const shaft = new THREE.Mesh(geo('lvshaft', () => new THREE.CylinderGeometry(1, 1.05, 1, 14, 1, true)), boot);
      shaft.material.side = THREE.DoubleSide; shaft.scale.set(sx * 1.08, .18, sz * 1.04); shaft.position.y = .08; hold.add(shaft);
      const s = new THREE.Mesh(geo('lvsole', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), sole);
      s.scale.set(sx * 1.14, sy * 1.2, sz * 1.14); hold.add(s);
    });
  },
  ribbon(m, parts){
    const mat = MM(m, m.c, { rough:.7 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('ribbt', () => new THREE.TorusGeometry(.13, .016, 8, 16)), mat);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const loop = geo('ribloop', () => new THREE.TorusGeometry(.05, .014, 8, 12));
      for(const s of [-1, 1]){ const b = new THREE.Mesh(loop, mat); b.position.set(.05 * s, -.1, .14); b.scale.set(1, 1, .6); b.rotation.y = .5 * s; arm.add(b); }
    });
  },
  sportband(m, parts){
    const mat = MM(m, m.c, { rough:.7 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('spband', () => new THREE.TorusGeometry(.132, .04, 8, 16)), mat);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
    });
  },
  charm(m, parts){
    const band = goldM({ c:m.c || GOLD });
    const charms = [0xff2a4a, 0x2a8aff, 0x2ee66a, 0xffe36b];
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('chband', () => new THREE.TorusGeometry(.13, .018, 8, 16)), band);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const star = starSh();
      for(let i = 0; i < 4; i++){
        const a = (i / 4) * Math.PI - .4, c = new THREE.Mesh(star, M(charms[i], { metal:.3, rough:.4, emissive:charms[i], ei:.25 }));
        c.scale.setScalar(.045); c.position.set(Math.sin(a) * .14, -.16, Math.cos(a) * .14); arm.add(c);
      }
    });
  },
  lavacuff(m, parts){
    const mat = lavaM({ ei:1 });
    addBoth(parts, 'arm', (arm) => {
      const t = new THREE.Mesh(geo('lvcuff', () => new THREE.TorusGeometry(.135, .032, 8, 16)), mat);
      t.rotation.x = Math.PI / 2; t.position.y = -.1; arm.add(t);
      const glow = new THREE.Mesh(geo('lvcglow', () => new THREE.TorusGeometry(.135, .02, 8, 12)), glowM(0xff6a1a, .45));
      glow.rotation.x = Math.PI / 2; glow.position.y = -.1; arm.add(glow);
    });
  },
  fingerless(m, parts){
    const mat = MM(m, m.c, { rough:.75 });
    addBoth(parts, 'arm', (arm) => {
      const c = new THREE.Mesh(geo('fgcuff', () => new THREE.CylinderGeometry(.12, .13, .08, 12)), mat);
      c.position.y = -.1; arm.add(c);
      const pad = new THREE.Mesh(geo('fgpad', () => new THREE.SphereGeometry(.1, 10, 8, 0, Math.PI, 0, Math.PI)), mat);
      pad.position.set(0, -.18, .02); pad.rotation.x = .3; arm.add(pad);
    });
  },
  oven(m, parts){
    const mat = MM(m, m.c, { rough:.8 }); const st = MM(m, m.c2 || 0xf4f0e6, { rough:.8 });
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('ovmitt', () => new THREE.BoxGeometry(.22, .26, .16)), mat);
      h.position.set(0, -.24, 0); arm.add(h);
      const q = geo('ovquilt', () => new THREE.BoxGeometry(.08, .08, .02));
      for(const [x, y] of [[-.04, -.2], [.04, -.2], [-.04, -.28], [.04, -.28]]){
        const p = new THREE.Mesh(q, st); p.position.set(x, y, .09); arm.add(p);
      }
    });
  },
  poms(m, parts){
    const a = MM(m, m.c); const b = MM(m, m.c2 || 0xffe36b);
    const ball = geo('pomfluff', () => new THREE.SphereGeometry(.045, 8, 6));
    addBoth(parts, 'arm', (arm) => {
      const root = new THREE.Group(); root.position.set(0, -.22, 0); arm.add(root);
      for(let i = 0; i < 14; i++){
        const f = new THREE.Mesh(ball, i % 2 ? b : a);
        const th = i / 14 * Math.PI * 2, ph = (i % 5) / 5 * Math.PI;
        f.position.set(Math.sin(th) * Math.sin(ph) * .16, Math.cos(ph) * .16, Math.cos(th) * Math.sin(ph) * .16);
        root.add(f);
      }
    });
  },
  lavagloves(m, parts){
    const mat = lavaM({ ei:.9 });
    addBoth(parts, 'arm', (arm) => {
      const h = new THREE.Mesh(geo('lvglove', () => new THREE.SphereGeometry(.155, 12, 10)), mat);
      h.position.set(0, -.2, 0); arm.add(h);
      const c = new THREE.Mesh(geo('lvgcu', () => new THREE.CylinderGeometry(.12, .13, .08, 12)), mat);
      c.position.y = -.1; arm.add(c);
    });
  },
  volcano(m, parts, g, H){
    // dark basalt dome, glowing crack map, small crater and a lava drip — no party cone / propeller disc
    const rock = lavaM({ ei:.8, side:THREE.DoubleSide });
    const pitM = M(0x1a0504, { emissive:0xff3a00, ei:.9, rough:.6 });
    const dripM = M(0xff6a1a, { emissive:0xff4a00, ei:1.15, rough:.35 });
    const cap = new THREE.Mesh(geo('volcap2', () => new THREE.SphereGeometry(.48, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), rock);
    cap.position.y = .22;
    const rim = new THREE.Mesh(geo('volrim', () => new THREE.TorusGeometry(.48, .04, 8, 16)), rock);
    rim.rotation.x = Math.PI / 2; rim.position.y = .22;
    const lip = new THREE.Mesh(geo('vollip', () => new THREE.TorusGeometry(.14, .045, 8, 14)), rock);
    lip.rotation.x = Math.PI / 2; lip.position.y = .68;
    const pit = new THREE.Mesh(geo('volpit', () => new THREE.CircleGeometry(.12, 12)), pitM);
    pit.rotation.x = -Math.PI / 2; pit.position.y = .665;
    const blob = new THREE.Mesh(geo('volblob', () => new THREE.SphereGeometry(.07, 8, 6)), dripM);
    blob.position.y = .70;
    const drip = new THREE.Mesh(geo('voldrip', () => new THREE.SphereGeometry(.055, 8, 6)), dripM);
    drip.scale.set(.7, 1.6, .7); drip.position.set(0, .42, .46);
    const drip2 = new THREE.Mesh(geo('voldrip2', () => new THREE.SphereGeometry(.035, 8, 6)), dripM);
    drip2.position.set(0, .30, .49);
    H.add(mergedMulti([
      { meshes:[cap, rim, lip], mat:rock },
      { meshes:[pit], mat:pitM },
      { meshes:[blob, drip, drip2], mat:dripM }
    ], 'volcano'));
  },
  // WIP, not shipped — Flame Crown builder kept for a later rework. Not in ITEMS_V2.
  flame(m, parts, g, H){
    // short glowing band / cap — stays above the eyes
    const bandM = magmaM({ ei:1.7, c:0xff4a0a });
    const cap = new THREE.Mesh(geo('flamecap', () => new THREE.SphereGeometry(.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3)), bandM);
    cap.position.y = .28; H.add(cap);
    const band = new THREE.Mesh(geo('flameband', () => new THREE.TorusGeometry(.4, .045, 8, 20)), bandM);
    band.rotation.x = Math.PI / 2; band.position.y = .28; H.add(band);
    // 7 clay flame tongues in a slightly flared column
    const tongue = flameTongueGeo(), mat = flameM();
    const flames = [], s0 = [], z0 = [], x0 = [], sx0 = [], sz0 = [], f1 = [], f2 = [], ph = [];
    // flattened teardrop blades in a jagged column (not a ring of cone spikes)
    const specs = [
      { a: .12,  r: .03, s: .98, lean: .05, flat: .52, yaw: .15 },
      { a: 1.15, r: .11, s: .80, lean: .20, flat: .46, yaw: .55 },
      { a:-1.05, r: .12, s: .72, lean: .22, flat: .58, yaw: -.45 },
      { a: 2.25, r: .13, s: .56, lean: .34, flat: .44, yaw: .95 },
      { a:-2.10, r: .13, s: .64, lean: .30, flat: .50, yaw: -.85 },
      { a: 3.20, r: .09, s: .70, lean: .16, flat: .48, yaw: 1.15 },
      { a:-2.95, r: .11, s: .48, lean: .28, flat: .54, yaw: -1.05 },
      { a: .35,  r: .16, s: .38, lean: .40, flat: .42, yaw: .25 }
    ];
    const TWO_PI = 6.28318530718;
    for(let i = 0; i < specs.length; i++){
      const sp = specs[i], f = new THREE.Mesh(tongue, mat);
      f.position.set(Math.sin(sp.a) * sp.r, .30, Math.cos(sp.a) * sp.r);
      f.rotation.order = 'YXZ';
      f.rotation.y = sp.yaw;
      f.rotation.z = -Math.sin(sp.a) * sp.lean;
      f.rotation.x = Math.cos(sp.a) * sp.lean;
      const sx = sp.s * sp.flat, sz = sp.s * .92;
      f.scale.set(sx, sp.s, sz);
      H.add(f);
      flames.push(f); s0.push(sp.s); sx0.push(sx); sz0.push(sz);
      z0.push(f.rotation.z); x0.push(f.rotation.x);
      f1.push(TWO_PI * (2 + (i % 3))); f2.push(TWO_PI * (3 + (i % 2))); ph.push(i * .9);
    }
    // small warm glow behind the column (radial sprite, not a pale disc)
    const glow = flameGlow(.5, .55);
    glow.position.set(0, .85, -.06); H.add(glow);
    const fx = accFx(parts);
    fx.flames = flames; fx.flameN = flames.length; fx.flameS0 = s0;
    fx.flameSX0 = sx0; fx.flameSZ0 = sz0;
    fx.flameZ0 = z0; fx.flameX0 = x0; fx.flameF1 = f1; fx.flameF2 = f2;
    fx.flameP = ph; fx.flameGlow = glow;
  },
};

function flameTongueGeo(){
  return geo('flametongue4', () => {
    const pts = [];
    // fat red base, thin yellow tip — a clay teardrop, not a cone spike
    const profile = [[0,0],[.16,.02],[.28,.12],[.27,.26],[.22,.42],[.17,.58],[.13,.72],[.095,.86],[.065,.98],[.04,1.07],[.016,1.13],[0,1.16]];
    for(let i = 0; i < profile.length; i++) pts.push(new THREE.Vector2(profile[i][0], profile[i][1]));
    return new THREE.LatheGeometry(pts, 8);
  });
}
function flameTex(){
  return tex('flameGrad2', 16, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, '#c01000');
    gr.addColorStop(.12, '#ff2200');
    gr.addColorStop(.32, '#ff4e00');
    gr.addColorStop(.52, '#ff8a10');
    gr.addColorStop(.72, '#ffc420');
    gr.addColorStop(.88, '#ffe98a');
    gr.addColorStop(1, '#fffce8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function flameM(){
  const map = flameTex();
  return M(0xffffff, { map, mapKey:'flameGrad2', emissiveMap: map, emKey:'flameGrad2', emissive: 0xffffff, ei: 1.45, rough: .42, metal: 0, side: THREE.DoubleSide });
}
function flameGlowTex(){
  return tex('flameglow', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,240,160,1)');
    rg.addColorStop(.18, 'rgba(255,160,40,.85)');
    rg.addColorStop(.45, 'rgba(255,80,0,.3)');
    rg.addColorStop(.72, 'rgba(255,40,0,0)');
    rg.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  });
}
function flameGlow(radius, opacity = .55){
  const mat = M(0xffffff, { map: flameGlowTex(), mapKey:'flameglow', opacity, dw: 0, add: 1, emissive: 0xff8a1a, ei: 1, rough: 1, metal: 0, side: THREE.DoubleSide });
  return new THREE.Mesh(geo('fglow:' + radius, () => new THREE.CircleGeometry(radius, 20)), mat);
}
function addHeavenNecklace(g, gold, extras = []){
  // beads sit on the body surface; y dips at the front so the chain reads as a V, not a hoop
  const beadR = .024;
  const bead = geo('nbead3', () => new THREE.SphereGeometry(beadR, 6, 5));
  const ySide = 1.18, yFront = .96;
  // robe uses flare(1.18, .48, 1.06, 1.38) — beads must sit outside that surface
  const robeS = (y) => {
    const t = (y - 1.18) / (.48 - 1.18);
    const tt = t < 0 ? 0 : t > 1 ? 1 : t;
    return 1.06 + .32 * tt * tt;
  };
  const n = Math.max(28, Math.round(bodyR(ySide) * 56));
  const beads = [];
  for(let i = 0; i < n; i++){
    const a = (i / n) * Math.PI * 2;
    const dip = Math.max(0, Math.cos(a));
    const y = ySide - (ySide - yFront) * dip * dip;
    const r = bodyR(y) * robeS(y) + beadR * .85;
    const b = new THREE.Mesh(bead, gold);
    b.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    beads.push(b);
  }
  const yP = yFront, rP = bodyR(yP) * robeS(yP) + .036;
  const medal = new THREE.Mesh(geo('nmedal', () => new THREE.SphereGeometry(.048, 10, 8)), gold);
  medal.scale.set(1, 1, .75); medal.position.set(0, yP, rP);
  const gemM = M(0xfff4c4, { metal: .35, rough: .12, emissive: 0xffd24a, ei: 1.25, env: goldEnv(), envI: 2 });
  const gem = new THREE.Mesh(geo('ngem', () => new THREE.SphereGeometry(.026, 8, 6)), gemM);
  gem.position.set(0, yP, rP + .028);
  const star = new THREE.Mesh(starSh(), gold);
  star.scale.setScalar(.055); star.position.set(0, yP, rP + .014);
  g.add(mergedMulti([
    { meshes: [...extras, ...beads, medal, star], mat: gold },
    { meshes: [gem], mat: gemM }
  ], `nchain:${profKey()}`));
}

function addSleeves(parts, mat, len = .16){
  const sl = geo('sleeve:' + len, () => new THREE.CylinderGeometry(.155, .15, len, 14, 1, true));
  for(const s of [-1, 1]){
    const m = new THREE.Mesh(sl, mat); m.material.side = THREE.DoubleSide; m.position.set(.03 * s, -.08, 0); m.rotation.z = .12 * s; parts['sh' + s].add(m);
  }
}
function addSleevesAndPauldrons(parts, cloth, gold, len = .18){
  const sl = geo('sleeve:' + len, () => new THREE.CylinderGeometry(.155, .15, len, 12, 1, true));
  const paul = geo('gpaul', () => new THREE.SphereGeometry(.18, 10, 6, 0, Math.PI, 0, Math.PI / 1.5));
  for(const s of [-1, 1]){
    const sleeve = new THREE.Mesh(sl, cloth);
    sleeve.material.side = THREE.DoubleSide;
    sleeve.position.set(.03 * s, -.08, 0); sleeve.rotation.z = .12 * s;
    const p = new THREE.Mesh(paul, gold);
    p.rotation.y = s * Math.PI / 2; p.position.set(.02 * s, -.02, .02);
    parts['sh' + s].add(mergedMulti([
      { meshes:[sleeve], mat:cloth },
      { meshes:[p], mat:gold }
    ], 'shorn:' + (s < 0 ? 'L' : 'R') + ':' + len));
  }
}
function capeGeo(){
  return geo('cape', () => {
    const g = new THREE.PlaneGeometry(1.2, 1.05, 6, 6);
    const pos = g.attributes.position;
    for(let i = 0; i < pos.count; i++){
      const x = pos.getX(i), y = pos.getY(i), v = .5 - y;
      pos.setZ(i, v * v * .38 + Math.abs(x) * .08);
      pos.setX(i, x * (1 + v * .12));
    }
    g.computeVertexNormals();
    return g;
  });
}
function wingFeatherGeo(){
  return geo('wfeather', () => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(.11, .64, .045); g.translate(0, .64, 0);
    return g;
  });
}
function wingCovertGeo(){
  return geo('wcover8', () => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(.12, .50, .045); g.translate(0, .50, 0);
    return g;
  });
}
function wingFlightGeo(){
  return geo('wflight8', () => {
    const g = new THREE.SphereGeometry(1, 8, 7);
    g.scale(.11, .68, .042); g.translate(0, .68, 0);
    return g;
  });
}
/** Head-crown Y in hatAnchor-local units, so the halo can sit just above it.
 *  Local matrices only (matrixWorld is often stale at equip time). Uses each
 *  mesh bounding-box corner so we don't miss the true crown by undersampling. */
function haloLiftAboveHead(H){
  const hs = Math.max((H && H.scale && H.scale.x) || 1, .001);
  const head = H && H.parent;
  if(!head) return .55 / hs;
  const v = new THREE.Vector3();
  const mx = new THREE.Matrix4();
  let yMaxHead = -Infinity;
  head.traverse(m => {
    if(!m.isMesh || !m.geometry) return;
    let q = m, underH = false;
    while(q && q !== head){ if(q === H){ underH = true; break; } q = q.parent; }
    if(underH) return;
    m.updateMatrix();
    mx.copy(m.matrix);
    let p = m.parent;
    while(p && p !== head){
      p.updateMatrix();
      mx.premultiply(p.matrix);
      p = p.parent;
    }
    if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const min = m.geometry.boundingBox.min, max = m.geometry.boundingBox.max;
    for(let ix = 0; ix < 2; ix++) for(let iy = 0; iy < 2; iy++) for(let iz = 0; iz < 2; iz++){
      v.set(ix ? max.x : min.x, iy ? max.y : min.y, iz ? max.z : min.z).applyMatrix4(mx);
      if(v.y > yMaxHead) yMaxHead = v.y;
    }
  });
  if(!(yMaxHead > -Infinity)) return .55 / hs;
  return (yMaxHead - H.position.y) / hs;
}
function featherGeo(){
  return geo('feather', () => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(.22, .55, .08); g.translate(0, .55, 0);
    return g;
  });
}
function makeVisor(H, frameMat, glassMat){
  // thin brow sits ABOVE the eyes (eye beads are ~y=.14 in eyeAnchor space)
  const brow = new THREE.Mesh(geo('visbrow', () => new THREE.TorusGeometry(.5, .016, 8, 20, Math.PI / 1.2)), frameMat);
  brow.rotation.set(Math.PI / 2, 0, 0); brow.position.y = .3; brow.scale.set(1.02, 1, 1.06);
  // very transparent glass over the eyes; depthWrite off so bead eyes show through
  const glass = new THREE.Mesh(geo('visglass', () => new THREE.CylinderGeometry(.5, .5, .2, 20, 1, true, -Math.PI / 2.5, Math.PI / 1.2)), glassMat);
  glass.position.y = .14; glass.scale.set(1.02, 1, 1.06);
  H.add(mergedMulti([{ meshes:[brow], mat:frameMat }, { meshes:[glass], mat:glassMat }], 'visor'));
}
function makeWing(s){
  // Angel wings: two layered, curved, scalloped feather rows spreading OUT and
  // slightly up from the upper back at ~30–40° from vertical. Mild back sweep
  // only — a deep X tilt made them read as edge-on paddles / bunny ears from
  // the lobby camera. Feather geometry is along +Y. Tips stay below head-top.
  const grp = new THREE.Group();
  const white = creamM({ c:0xfff8ee, rough:.74 });
  const gold = goldM({ ei:1 });
  const root = new THREE.Mesh(geo('wingroot8', () => new THREE.SphereGeometry(.07, 8, 6)), gold);
  const quillG = geo('quill8', () => new THREE.CylinderGeometry(.007, .0035, .85, 6));
  const coverG = wingCovertGeo(), flightG = wingFlightGeo();
  const whites = [], golds = [root];
  const addFeather = (geo, t, ang, x, y, z, sx, sy, tip) => {
    const f = new THREE.Mesh(geo, white);
    f.position.set(s * x, y, z);
    f.rotation.z = -s * ang;
    f.rotation.x = -.14 - t * .08;
    f.rotation.y = s * (.05 + t * .02);
    f.scale.set(sx, sy, 1);
    f.updateMatrix();
    whites.push(f);
    if(tip){
      const gtip = new THREE.Mesh(geo, gold);
      gtip.position.y = .58; gtip.scale.set(.7, .4, 1.05);
      gtip._parentMx = f.matrix.clone();
      golds.push(gtip);
    }
    const q = new THREE.Mesh(quillG, gold);
    q.position.copy(f.position); q.rotation.copy(f.rotation);
    q.scale.set(1, sy * .8, 1);
    golds.push(q);
  };
  // Inner coverts: shorter front layer, ~28–36° from vertical.
  for(let i = 0; i < 6; i++){
    const t = i / 5, ang = .49 + t * .14;
    addFeather(coverG, t, ang,
      .025 + t * .045 + t * t * .02,
      .08 + t * .045,
      -.03 - t * .025,
      1.0, .46 + t * .10, false);
  }
  // Flight feathers: longer back layer, scalloped lengths, 32–40°, gold tips.
  for(let i = 0; i < 8; i++){
    const t = i / 7, ang = .56 + t * .14;
    const scallop = .60 + Math.sin((t * .85 + .08) * Math.PI) * .18;
    addFeather(flightG, t, ang,
      .05 + t * .065 + t * t * .035,
      .01 + t * .055,
      -.08 - t * .05,
      1.0 + t * .06, scallop, true);
  }
  grp.add(mergedMulti([{ meshes:whites, mat:white }, { meshes:golds, mat:gold }], 'wing8:' + (s < 0 ? 'L' : 'R')));
  return grp;
}
function makeSmallWing(){
  const grp = new THREE.Group();
  const white = creamM({ c:WHITE, rough:.78 });
  const gold = goldM({ rough:.22 });
  const root = new THREE.Mesh(geo('awroot', () => new THREE.SphereGeometry(.03, 8, 6)), gold);
  const whites = [], golds = [root];
  for(let i = 0; i < 3; i++){
    const f = new THREE.Mesh(featherGeo(), i === 2 ? gold : white);
    f.scale.setScalar(.14 + i * .05); f.position.set(0, i * .01, -i * .008); f.rotation.z = .85 + i * .2; f.rotation.x = -.25;
    (i === 2 ? golds : whites).push(f);
  }
  grp.add(mergedMulti([{ meshes:whites, mat:white }, { meshes:golds, mat:gold }], 'awing'));
  return grp;
}

export const SLOT_ORDER = ['hat', 'eyes', 'top', 'bottom', 'shoes', 'wrist', 'hands'];
