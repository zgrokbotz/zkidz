// ZKIDZ graphics kit: coral reef builders, shader patches (rim light, sway, caustics), god rays, sand.
import * as THREE from './vendor/three.module.min.js?v=20261124-2';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js?v=20261124-2';
import { RoundedBoxGeometry } from './vendor/addons/geometries/RoundedBoxGeometry.js?v=20261124-2';

export const uTime = { value: 0 };
// camera-occlusion fade: geometry between the camera and the player gets dithered out (screen-door transparency)
export const uOcc = { p:{ value:new THREE.Vector3() }, c:{ value:new THREE.Vector3() }, on:{ value:0 } };
const rand = (a,b)=>a+Math.random()*(b-a);
const pick = a => a[Math.floor(Math.random()*a.length)];

/* ---------- shader patching ---------- */
// opts: rim:[color,strength,power], sway:amount, caustic:strength, worldTint
export function patch(mat, opts={}){
  const key = JSON.stringify(opts);
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    if(opts.rim){ sh.uniforms.uRim = { value: new THREE.Color(opts.rim[0]) }; sh.uniforms.uRimS = { value: opts.rim[1] }; sh.uniforms.uRimP = { value: opts.rim[2]||2.5 }; }
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader;
    if(opts.sway){
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = max(position.y, 0.0);
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = modelMatrix[3].xyz;
        #endif
        float ph = ip.x*0.37 + ip.z*0.23;
        transformed.x += sin(uTime*1.3 + ph + hh*0.7) * ${opts.sway.toFixed(3)} * hh*hh;
        transformed.z += cos(uTime*1.05 + ph*1.3 + hh*0.5) * ${(opts.sway*0.7).toFixed(3)} * hh*hh;`);
    }
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vWPos = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;
      #else
        vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;
      #endif`);
    let head = 'uniform float uTime;\nvarying vec3 vWPos;\n';
    if(opts.occ){ sh.uniforms.uOccP=uOcc.p; sh.uniforms.uOccC=uOcc.c; sh.uniforms.uOccOn=uOcc.on;
      head += `uniform vec3 uOccP; uniform vec3 uOccC; uniform float uOccOn;
      float bayer4(vec2 f){ vec2 q=mod(floor(f),4.0); int i=int(q.x)+int(q.y)*4;
        float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); for(int k=0;k<16;k++){ if(k==i) return (m[k]+.5)/16.; } return .5; }\n`;
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(uOccOn>0.5){ vec3 ab=uOccC-uOccP; float L2=dot(ab,ab); float t=clamp(dot(vWPos-uOccP,ab)/L2,0.0,1.0);
          float d=length(vWPos-(uOccP+ab*t)); float rad=mix(1.7,3.0,t);
          float f=(1.0-smoothstep(rad*.6,rad,d))*smoothstep(.03,.16,t)*.9;
          if(f>bayer4(gl_FragCoord.xy)) discard; }`);
    }
    if(opts.rim) head += 'uniform vec3 uRim; uniform float uRimS; uniform float uRimP;\n';
    if(opts.caustic) head += `float causticF(vec2 p, float t){ vec2 i = p; float c = 1.0; float inten = .005;
      for (int n = 0; n < 3; n++) { float tt = t * (1.0 - (3.5 / float(n+1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0/length(vec2(p.x / (sin(i.x+tt)/inten), p.y / (cos(i.y+tt)/inten))); }
      c /= 3.0; c = 1.17 - pow(c, 1.4); return clamp(pow(abs(c), 8.0), 0.0, 2.0); }\n`;
    sh.fragmentShader = head + sh.fragmentShader;
    let add = '';
    if(opts.rim) add += `{ vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), uRimP); totalEmissiveRadiance += uRim * rim * uRimS; }\n`;
    if(opts.caustic) add += `{ float cs = causticF(vWPos.xz*0.22 + 20.0, uTime*0.45) ; totalEmissiveRadiance += vec3(0.55,0.85,1.0) * cs * ${opts.caustic.toFixed(3)} * diffuseColor.rgb; }\n`;
    if(opts.heightFade) add += `{ float hf = clamp(vWPos.y/${opts.heightFade.toFixed(2)}, 0.0, 1.0); diffuseColor.rgb *= mix(0.62, 1.08, hf); }\n`;
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + add);
  };
  return mat;
}

/* ---------- textures ---------- */
function canvasTex(w,h,draw,repeat){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repeat,repeat);} t.anisotropy=4; return t; }
export function sandTexture(repeat=8){
  return canvasTex(512,512,(g,w,h)=>{
    g.fillStyle='#e2b475'; g.fillRect(0,0,w,h);
    const img=g.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=(y*w+x)*4;
      // tileable ripples
      const r = Math.sin((x/w)*Math.PI*2*6 + Math.sin((y/h)*Math.PI*2*2)*1.6) * .5 + .5;
      const n = (Math.random()-.5)*22;
      const k = r*18 + n;
      d[i]+=k; d[i+1]+=k*.85; d[i+2]+=k*.55; }
    g.putImageData(img,0,0);
    for(let k=0;k<260;k++){ g.fillStyle=`rgba(${pick(['190,150,95','255,240,210','170,130,80'])},${rand(.25,.6)})`; g.beginPath(); g.arc(rand(0,w),rand(0,h),rand(.8,2.6),0,7); g.fill(); }
  }, repeat);
}
export function stoneTexture(){
  return canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#a49a8c'; g.fillRect(0,0,w,h); for(let k=0;k<900;k++){ g.fillStyle=`rgba(${pick(['80,70,60','200,190,175','120,110,100'])},${rand(.08,.25)})`; g.beginPath(); g.arc(rand(0,w),rand(0,h),rand(2,12),0,7); g.fill(); }
    g.strokeStyle='rgba(60,50,45,.45)'; g.lineWidth=2; for(let k=0;k<7;k++){ g.beginPath(); let x=rand(0,w),y=rand(0,h); g.moveTo(x,y); for(let s=0;s<5;s++){ x+=rand(-25,25); y+=rand(-25,25); g.lineTo(x,y);} g.stroke(); } }, 0);
}
export function rayTexture(){
  return canvasTex(64,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'rgba(255,255,240,.9)'); gr.addColorStop(.5,'rgba(200,240,255,.35)'); gr.addColorStop(1,'rgba(200,240,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    const sg=g.createLinearGradient(0,0,w,0); sg.addColorStop(0,'rgba(0,0,0,1)'); sg.addColorStop(.5,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(0,0,0,1)'); g.globalCompositeOperation='destination-out'; g.fillStyle=sg; g.fillRect(0,0,w,h); });
}
function fanTexture(){
  return canvasTex(256,256,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='#fff'; g.lineCap='round';
    const cx=w/2, cy=h-6; function br(x,y,a,len,wd,dep){ const x2=x+Math.cos(a)*len, y2=y-Math.sin(a)*len; g.lineWidth=wd; g.beginPath(); g.moveTo(x,y); g.lineTo(x2,y2); g.stroke(); if(dep>0){ br(x2,y2,a+rand(.25,.5),len*.78,wd*.72,dep-1); br(x2,y2,a-rand(.25,.5),len*.78,wd*.72,dep-1);} }
    br(cx,cy,Math.PI/2,60,9,5);
    g.lineWidth=2; for(let r=40;r<240;r+=16){ g.beginPath(); g.arc(cx,cy,r,Math.PI*1.08,Math.PI*1.92); g.globalAlpha=.55; g.stroke(); } g.globalAlpha=1;
    // circle mask
    g.globalCompositeOperation='destination-in'; const rg=g.createRadialGradient(cx,cy,0,cx,cy,w*.5); rg.addColorStop(.85,'#fff'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h); });
}

/* ---------- geometry helpers ---------- */
function gradColor(geo, lo=.5, hi=1.0, yMin=null, yMax=null){
  geo.computeBoundingBox(); const b=geo.boundingBox; const y0=yMin??b.min.y, y1=yMax??b.max.y; const p=geo.attributes.position; const col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){ const t=Math.min(1,Math.max(0,(p.getY(i)-y0)/(y1-y0||1))); const v=lo+(hi-lo)*Math.pow(t,.8); col[i*3]=col[i*3+1]=col[i*3+2]=v; }
  geo.setAttribute('color', new THREE.BufferAttribute(col,3)); return geo;
}
function clean(g){ // make merge-compatible: non-indexed? keep indexed but same attribute set
  const keep=['position','normal','uv']; for(const k of Object.keys(g.attributes)) if(!keep.includes(k)) g.deleteAttribute(k); if(!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2)); return g.index? g : g; }
function capsuleAt(a, b, r, seg=7){ const dir=new THREE.Vector3().subVectors(b,a); const len=dir.length(); const g=new THREE.CapsuleGeometry(r, Math.max(.01,len), 2, seg); const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize()); g.applyQuaternion(q); const m=a.clone().add(b).multiplyScalar(.5); g.translate(m.x,m.y,m.z); return clean(g); }

export const CORAL_GEOS = {};
export function buildCoralGeos(low=false){
  const seg = low?5:7;
  // branching (staghorn-ish)
  { const parts=[]; const grow=(p,dir,len,r,d)=>{ const e=p.clone().addScaledVector(dir,len); parts.push(capsuleAt(p,e,r,seg)); if(d<=0) return; const n=d>=2?3:2; for(let i=0;i<n;i++){ const nd=dir.clone().add(new THREE.Vector3(rand(-.9,.9),rand(.2,.7),rand(-.9,.9))).normalize(); grow(e,nd,len*rand(.65,.85),r*.78,d-1);} };
    grow(new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0), .45, .12, low?1:2); CORAL_GEOS.branch = gradColor(mergeGeometries(parts), .62, 1.0); }
  // finger cluster (mockup hedges)
  { const parts=[]; const n=low?5:8; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+rand(-.3,.3), d=i===0?0:rand(.12,.38); const base=new THREE.Vector3(Math.cos(a)*d,0,Math.sin(a)*d); const top=base.clone().add(new THREE.Vector3(Math.cos(a)*d*.6,rand(.45,.95),Math.sin(a)*d*.6)); parts.push(capsuleAt(base,top,rand(.1,.15),seg)); }
    CORAL_GEOS.finger = gradColor(mergeGeometries(parts), .6, 1.0); }
  // tube coral cluster
  { const parts=[]; const n=low?3:5; for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2), d=i?rand(.12,.3):0, h=rand(.35,.85), r=rand(.09,.14); const g=new THREE.CylinderGeometry(r*1.25,r,h,seg+2,1,true); g.translate(Math.cos(a)*d,h/2,Math.sin(a)*d); parts.push(clean(g)); const rim=new THREE.TorusGeometry(r*1.25,.035,5,seg+2); rim.rotateX(Math.PI/2); rim.translate(Math.cos(a)*d,h,Math.sin(a)*d); parts.push(clean(rim)); const inner=new THREE.CircleGeometry(r*1.2,seg+2); inner.rotateX(-Math.PI/2); inner.translate(Math.cos(a)*d,h-.06,Math.sin(a)*d); parts.push(clean(inner)); }
    const geo=mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p)); CORAL_GEOS.tube = gradColor(geo, .62, 1.0); }
  // brain coral
  { const g=new THREE.SphereGeometry(.5, low?16:28, low?10:18, 0, Math.PI*2, 0, Math.PI*.6); const p=g.attributes.position, v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const th=Math.atan2(v.z,v.x), ph=Math.acos(v.y/.5); const k=1+.07*Math.sin(th*9+Math.sin(ph*7)*2.5)*Math.sin(ph*1.5+.3); v.multiplyScalar(k); v.y=(v.y-.5*Math.cos(Math.PI*.6))*.9; p.setXYZ(i,v.x,v.y,v.z); }
    g.computeVertexNormals(); CORAL_GEOS.brain = gradColor(g, .6, 1.0); }
  // sea fan (textured plane, built separately)
  { const g=new THREE.PlaneGeometry(1.4,1.4); g.translate(0,.7,0); CORAL_GEOS.fan=g; }
  // base rock
  CORAL_GEOS.base = new RoundedBoxGeometry(1,1,1,low?2:3,.32);
  // kelp ribbon
  { const segs=low?8:14; const g=new THREE.PlaneGeometry(.38,1,1,segs); const p=g.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i)+.5; const w=Math.sin(y*Math.PI)*.6+.4; p.setXYZ(i,p.getX(i)*w + Math.sin(y*9)*.05, y, Math.sin(y*6)*.06); } g.computeVertexNormals(); CORAL_GEOS.kelp = gradColor(g, .45, 1.0); }
  // scallop shell
  { const g=new THREE.SphereGeometry(.18,18,6,0,Math.PI,0,Math.PI/2); const p=g.attributes.position, v=new THREE.Vector3(); for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const a=Math.atan2(v.z,v.x); v.multiplyScalar(1+.08*Math.abs(Math.sin(a*8))); v.y*=.45; p.setXYZ(i,v.x,v.y,v.z);} g.computeVertexNormals(); CORAL_GEOS.shell=gradColor(g,.8,1); }
  // rock
  { const g=new THREE.IcosahedronGeometry(1,low?1:2); const p=g.attributes.position, v=new THREE.Vector3(); for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); v.multiplyScalar(1+ (Math.sin(v.x*3.1)*Math.cos(v.z*2.7)+Math.sin(v.y*4.3))*.08); v.y*=.62; p.setXYZ(i,v.x,v.y,v.z);} g.computeVertexNormals(); CORAL_GEOS.rock=g; }
  Object.values(CORAL_GEOS).forEach(g=>g.userData.shared=true);
  return CORAL_GEOS;
}

/* ---------- materials ---------- */
export const MATS = {};
export function buildMats(){
  MATS.coral = patch(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.55, metalness:0 }), { rim:[0xffe6ff,.4,2.6], occ:1 });
  MATS.base = patch(new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.85 }), { rim:[0xffb0ff,.3,2.5], heightFade:1.2, occ:1 });
  MATS.fan = patch(new THREE.MeshStandardMaterial({ map:fanTexture(), alphaTest:.4, side:THREE.DoubleSide, roughness:.7 }), { sway:.04, rim:[0xffffff,.2,2], occ:1 });
  MATS.kelp = patch(new THREE.MeshStandardMaterial({ vertexColors:true, side:THREE.DoubleSide, roughness:.6 }), { sway:.045, rim:[0xc8ff9a,.3,2], occ:1 });
  MATS.shell = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.5 });
  MATS.rock = patch(new THREE.MeshStandardMaterial({ color:0x6b6fa8, roughness:.95, flatShading:false }), { rim:[0xa0c8ff,.2,2.5], heightFade:2.0, occ:1 });
  MATS.far = new THREE.MeshBasicMaterial({ color:0x2a6fb8 });
  MATS.ray = new THREE.MeshBasicMaterial({ map:rayTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false, opacity:.22 });
  MATS.stone = patch(new THREE.MeshStandardMaterial({ map:stoneTexture(), color:0xc8bcae, roughness:.95 }), { rim:[0xbfe6ff,.25,2.5] });
  return MATS;
}
export function sandMaterial(repeat){ return patch(new THREE.MeshStandardMaterial({ map:sandTexture(repeat), roughness:1 }), { caustic:.55 }); }

export const CORAL_PAL = { pinkPurple:[0xff5fa8,0xff7ac6,0xd25cff,0xb54cff,0x8f3fe0,0xff4f8b,0x7a47e8], warm:[0xff7ac6,0xff9a3c,0xffb547,0xff5fa8,0xd25cff], cool:[0x2ee6d6,0x8f3fe0,0x4a7cff,0xff5fa8,0x5fd0ff], accent:[0xff9a3c,0x2ee6d6,0xffcf3c] };

/* ---------- instancer with chunks for culling ---------- */
export class Instancer {
  constructor(){ this.buckets=new Map(); }
  add(type, chunk, matrix, color){ const k=type+'|'+chunk; let b=this.buckets.get(k); if(!b){ b={type,m:[],c:[]}; this.buckets.set(k,b);} b.m.push(matrix.clone()); b.c.push(color); }
  build(parent, opts={}){
    for(const b of this.buckets.values()){ const geo=CORAL_GEOS[b.type]; const mat = b.type==='fan'?MATS.fan : b.type==='kelp'?MATS.kelp : b.type==='base'?MATS.base : b.type==='rock'?MATS.rock : b.type==='shell'?MATS.shell : MATS.coral;
      const im=new THREE.InstancedMesh(geo, mat, b.m.length); const col=new THREE.Color();
      b.m.forEach((m,i)=>{ im.setMatrixAt(i,m); if(b.c[i]!=null){ col.set(b.c[i]); im.setColorAt(i,col);} else { col.set(0xffffff); im.setColorAt(i,col);} });
      im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.computeBoundingSphere(); im.receiveShadow = !!opts.receive && (b.type==='base'); im.castShadow=false; parent.add(im); }
  }
}
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _s=new THREE.Vector3(), _p=new THREE.Vector3();
export function mtx(x,y,z, sx,sy,sz, rx=0,ry=0,rz=0){ _e.set(rx,ry,rz); _q.setFromEuler(_e); _p.set(x,y,z); _s.set(sx,sy,sz); return _m.compose(_p,_q,_s); }

// Fill a square patch (centre x,z, half-size hs) with a coral hedge on a base rock.
export function coralHedge(inst, chunk, x, z, size, baseH, pal, density=1, hMul=1, box=null){
  // box = [x0,x1,z0,z1] base extents relative to centre (lets wall runs join into continuous hedges)
  const bc=new THREE.Color(pick(pal)).lerp(new THREE.Color(0x4a2378),.62);
  if(box) inst.add('base', chunk, mtx(x+(box[0]+box[1])/2, baseH/2-.05, z+(box[2]+box[3])/2, box[1]-box[0], baseH, box[3]-box[2]), bc.getHex());
  else inst.add('base', chunk, mtx(x, baseH/2-.05, z, size*1.02, baseH, size*1.02), bc.getHex());
  const n = Math.max(2, Math.round((4 + Math.random()*2) * density));
  for(let i=0;i<n;i++){ const r=Math.random(); const type = r<.36?'finger': r<.58?'branch': r<.72?'tube': r<.86?'brain':'fan';
    const px=x+rand(-.42,.42)*size, pz=z+rand(-.42,.42)*size; const s = type==='brain'?rand(1,1.4): type==='fan'?rand(.9,1.25): rand(1.05,1.55);
    const col = Math.random()<.85? pick(pal) : pick(CORAL_PAL.accent);
    inst.add(type, chunk, mtx(px, baseH-.08, pz, s, s*hMul*(type==='finger'?rand(.9,1.4):1), s, 0, rand(0,Math.PI*2), 0), col); }
}
export function kelp(inst, chunk, x, y, z, h){ inst.add('kelp', chunk, mtx(x,y,z, rand(.8,1.2), h, 1, 0, rand(0,Math.PI), 0), pick([0x2fae4a,0x46c45a,0x24a35a,0x5fcf45])); }

/* ---------- god rays ---------- */
export function godRays(n=9, spread=18){ const g=new THREE.Group(); const geo=new THREE.PlaneGeometry(1,1); geo.translate(0,-.5,0);
  for(let i=0;i<n;i++){ const m=new THREE.Mesh(geo, MATS.ray.clone()); const w=rand(1.5,4), h=rand(16,26); m.scale.set(w,h,1); m.position.set(rand(-spread,spread), h*.75, rand(-spread,spread)); m.rotation.z=rand(.15,.32); m.userData.ph=rand(0,6); m.userData.base=rand(.12,.26); m.renderOrder=5; g.add(m); }
  g.userData.update=(t,cam)=>{ for(const m of g.children){ m.material.opacity = m.userData.base*(.6+.4*Math.sin(t*.7+m.userData.ph)); m.rotation.y = Math.atan2(cam.position.x-(g.position.x+m.position.x), cam.position.z-(g.position.z+m.position.z)); } };
  return g; }

/* ---------- plankton specks ---------- */
export function specks(scene, n, area, h){ const geo=new THREE.BufferGeometry(); const p=new Float32Array(n*3); for(let i=0;i<n;i++){ p[i*3]=rand(-area,area); p[i*3+1]=rand(0,h); p[i*3+2]=rand(-area,area);} geo.setAttribute('position', new THREE.BufferAttribute(p,3));
  const pts=new THREE.Points(geo, new THREE.PointsMaterial({ color:0xdff6ff, size:.07, transparent:true, opacity:.7, depthWrite:false })); scene.add(pts); return pts; }

/* ---------- distant reef silhouettes ---------- */
export function farReef(parent, radius, n=40){ const geo=new THREE.SphereGeometry(1,12,8); const im=new THREE.InstancedMesh(geo, MATS.far, n); const col=new THREE.Color();
  for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+rand(-.05,.05), r=radius+rand(0,10); const s=rand(4,10); im.setMatrixAt(i, mtx(Math.cos(a)*r, s*.15, Math.sin(a)*r, s*rand(1,1.8), s*rand(.5,1.1), s)); col.setHex(pick([0x2a6fb8,0x3478c0,0x255fa6])); im.setColorAt(i,col);} im.computeBoundingSphere(); parent.add(im); return im; }

/* ---------- stone archway ---------- */
export function archway(){ const g=new THREE.Group(); const S=MATS.stone;
  for(const s of [-1,1]){ for(let k=0;k<3;k++){ const b=new THREE.Mesh(new RoundedBoxGeometry(.7,.75,.7,2,.12), S); b.position.set(s*1.15, .38+k*.74, 0); b.rotation.y=rand(-.12,.12); b.castShadow=true; g.add(b);} }
  const arch=new THREE.Mesh(new THREE.TorusGeometry(1.15,.36,10,24,Math.PI), S); arch.position.y=2.2; g.add(arch);
  const key=new THREE.Mesh(new RoundedBoxGeometry(.55,.6,.8,2,.12), S); key.position.y=3.55; g.add(key);
  const moss=new THREE.MeshStandardMaterial({ color:0x4fb84a, roughness:.9 });
  for(let i=0;i<10;i++){ const m=new THREE.Mesh(new THREE.SphereGeometry(rand(.1,.2),10,8), moss); const a=rand(0,Math.PI); m.position.set(Math.cos(a)*1.15, 2.2+Math.sin(a)*1.15+.25, rand(-.3,.3)); g.add(m);} 
  return g; }
