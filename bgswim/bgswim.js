/* 2D cutouts of OTHER roster characters drifting behind Bubble Pop.
   Reuses the joystick-buddy snapshot method (main WebGL renderer + render target,
   no second context). #16163a ink outline is baked into each sprite. After that,
   a frame is a handful of 2D drawImage calls. Not shown in the lobby. */
const POOL=['finn','dash','pip','sunny','jelly','lulu','percy','nova','bubbles','oscar','wade','giga'];
const MAX_NARROW=4, MAX_WIDE=5;
const BAKE_MAX=256;
const PAD=0.12;
const INK='#16163a';

let kit=null, scene=null, cam=null;
const sprites=new Map();
let bakeQ=[], actors=[], frozen=false, lastT=0, spawnReady=false;

export function installBgSwim(k){
  kit=k;
  queueBakes();
  hookDebug();
}
export function drawBgSwim(ctx,w,h,t,opts={}){
  if(!ctx) return;
  if(!kit){
    const src=opts.kit, S=opts.S||{};
    if(!src||!src.renderer||!src.THREE||!src.buildChar) return;
    try{
      installBgSwim({
        THREE:src.THREE, renderer:src.renderer, isPlayable:src.isPlayable,
        buildOllie:o=>src.buildChar((o&&o.charId)||o||'ollie'),
        getSelChar:()=>S.selChar||'ollie'
      });
    }catch(e){ console.warn('bg swim install failed', e); return; }
  }
  bakeSome(2);
  step(t,w,h,opts);
  paint(ctx,w,h,t,opts);
}

function queueBakes(){
  const me=selChar();
  bakeQ=POOL.filter(id=>id!==me && (!kit.isPlayable||kit.isPlayable(id)) && !sprites.has(id));
  spawnReady=false;
}
function selChar(){ return (kit&&kit.getSelChar&&kit.getSelChar())||'ollie'; }
function wanted(w){ return (w>=1000)?MAX_WIDE:MAX_NARROW; }
function neededIds(){
  const me=selChar();
  return POOL.filter(id=>id!==me && (!kit.isPlayable||kit.isPlayable(id)));
}
function allBaked(){
  const need=neededIds();
  return need.length>0 && need.every(id=>sprites.has(id));
}
function bakeSome(n){
  if(!kit) return;
  if(!bakeQ.length && !allBaked()) queueBakes();
  let i=0;
  while(i<n && bakeQ.length){
    const id=bakeQ.shift();
    if(id===selChar()||sprites.has(id)) continue;
    try{ const c=snapshotChar(id); if(c) sprites.set(id,c); }
    catch(e){ console.warn('bg swim bake failed', id, e); }
    i++;
  }
}
function ensureScene(){
  const THREE=kit.THREE;
  if(scene) return scene;
  scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7aa8, 1.55));
  const d=new THREE.DirectionalLight(0xffffff, 2.15); d.position.set(2.4,5,6); scene.add(d);
  const f=new THREE.DirectionalLight(0x9fd8ff, .85); f.position.set(-4,2,-3); scene.add(f);
  cam=new THREE.OrthographicCamera(-1,1,1,-1, 0.05, 80);
  return scene;
}
function poseSwim(o){
  const p=o.userData.parts||{};
  o.position.set(0,0,0);
  // 3/4 view, leaning into a swim so the full body stays recognizable
  o.rotation.set(-.18, .62, -.28);
  if(p.rig){ p.rig.position.y=0; p.rig.rotation.set(.08,.06,-.08); p.rig.quaternion.setFromEuler(p.rig.rotation); }
  if(p.head){ p.head.rotation.set(.12,.16,0); p.head.quaternion.setFromEuler(p.head.rotation); }
  if(p['sh-1']){ p['sh-1'].rotation.set(-1.05,.2,-.9); p['sh-1'].quaternion.setFromEuler(p['sh-1'].rotation); }
  if(p['arm-1']){ p['arm-1'].rotation.set(0,0,0); }
  if(p.sh1){ p.sh1.rotation.set(.55,-.12,.7); p.sh1.quaternion.setFromEuler(p.sh1.rotation); }
  if(p.arm1){ p.arm1.rotation.set(0,0,0); }
  o.updateMatrixWorld(true);
}
function worldBox(o, THREE){
  o.updateMatrixWorld(true);
  const box=new THREE.Box3();
  box.makeEmpty();
  o.traverse(m=>{
    if(!m.isMesh || !m.geometry) return;
    if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b=m.geometry.boundingBox; if(!b) return;
    const v=new THREE.Vector3();
    for(const x of [b.min.x,b.max.x]) for(const y of [b.min.y,b.max.y]) for(const z of [b.min.z,b.max.z]){
      v.set(x,y,z).applyMatrix4(m.matrixWorld);
      box.expandByPoint(v);
    }
  });
  if(box.isEmpty()) box.setFromObject(o);
  return box;
}
function frameCam(box, THREE){
  const c=box.getCenter(new THREE.Vector3());
  const sz=box.getSize(new THREE.Vector3());
  const dir=new THREE.Vector3(.12,.28,1).normalize();
  const dist=Math.max(4, sz.length()*1.6);
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.up.set(0,1,0);
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  const inv=cam.matrixWorldInverse;
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;
  const v=new THREE.Vector3();
  for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]){
    v.set(x,y,z).applyMatrix4(inv);
    if(v.x<minX)minX=v.x; if(v.x>maxX)maxX=v.x;
    if(v.y<minY)minY=v.y; if(v.y>maxY)maxY=v.y;
    if(v.z<minZ)minZ=v.z; if(v.z>maxZ)maxZ=v.z;
  }
  const hw=(maxX-minX)/2, hh=(maxY-minY)/2;
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const padX=Math.max(hw*PAD, (hw+hh)*0.03, 0.04);
  const padY=Math.max(hh*PAD, (hw+hh)*0.03, 0.04);
  cam.left=cx-hw-padX; cam.right=cx+hw+padX;
  cam.top=cy+hh+padY; cam.bottom=cy-hh-padY;
  // camera looks down -Z; objects in front have negative z
  cam.near=Math.max(0.05, -maxZ-1);
  cam.far=Math.max(cam.near+1, -minZ+1);
  cam.updateProjectionMatrix();
  const fw=cam.right-cam.left, fh=cam.top-cam.bottom;
  const aspect=fw/Math.max(1e-6,fh);
  let w,h;
  if(aspect>=1){ w=BAKE_MAX; h=Math.max(48, Math.round(BAKE_MAX/aspect)); }
  else { h=BAKE_MAX; w=Math.max(48, Math.round(BAKE_MAX*aspect)); }
  return { w, h };
}
function snapshotChar(id){
  const THREE=kit.THREE, renderer=kit.renderer;
  const o=kit.buildOllie({ charId:id, equipped:{} });
  o.userData.baseY=0;
  poseSwim(o);
  const sc=ensureScene(); sc.add(o);
  const box=worldBox(o, THREE);
  if(box.isEmpty()){ sc.remove(o); return null; }
  const { w, h }=frameCam(box, THREE);
  const rt=new THREE.WebGLRenderTarget(w,h,{ depthBuffer:true });
  try{ if(rt.texture) rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
  const prevRT=renderer.getRenderTarget();
  const col=new THREE.Color(); renderer.getClearColor(col);
  const prevA=renderer.getClearAlpha();
  const vp=new THREE.Vector4(); renderer.getViewport(vp);
  const scis=new THREE.Vector4(); renderer.getScissor(scis);
  const prevScissorTest=renderer.getScissorTest();
  renderer.setClearColor(0x000000, 0);
  // The RT already has a 0,0,w,h viewport in its own pixels. Do not call
  // setViewport here: the renderer multiplies those values by getPixelRatio(),
  // which clips the top and right of the bake on retina/touch.
  renderer.setRenderTarget(rt);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(sc, cam);
  const buf=new Uint8Array(w*h*4);
  renderer.readRenderTargetPixels(rt,0,0,w,h,buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(col, prevA);
  renderer.setViewport(vp); renderer.setScissor(scis); renderer.setScissorTest(prevScissorTest);
  rt.dispose(); sc.remove(o);
  const src=document.createElement('canvas'); src.width=w; src.height=h;
  const sctx=src.getContext('2d', { alpha:true });
  const img=sctx.createImageData(w,h);
  for(let y=0;y<h;y++) img.data.set(buf.subarray((h-1-y)*w*4, (h-y)*w*4), y*w*4);
  sctx.putImageData(img,0,0);
  return outlineAndCrop(src);
}
function outlineAndCrop(src){
  const w=src.width, h=src.height, data=src.getContext('2d').getImageData(0,0,w,h).data;
  let minx=w,miny=h,maxx=0,maxy=0, edgeHit=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(data[(y*w+x)*4+3]>12){
    if(x<minx)minx=x; if(y<miny)miny=y; if(x>maxx)maxx=x; if(y>maxy)maxy=y;
    if(x===0||y===0||x===w-1||y===h-1) edgeHit++;
  }
  if(maxx<minx) return null;
  // Outline width, then crop with that much room so the ink is never clipped.
  const o=Math.max(4, Math.round(Math.min(w,h)/28));
  const pad=o+2;
  minx=Math.max(0,minx-pad); miny=Math.max(0,miny-pad);
  maxx=Math.min(w-1,maxx+pad); maxy=Math.min(h-1,maxy+pad);
  const cw=maxx-minx+1, ch=maxy-miny+1;
  const out=document.createElement('canvas'); out.width=cw; out.height=ch;
  const ictx=out.getContext('2d', { alpha:true });
  ictx.clearRect(0,0,cw,ch);
  ictx.imageSmoothingEnabled=true;
  try{ ictx.imageSmoothingQuality='high'; }catch(e){}
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    ictx.drawImage(src, minx,miny,cw,ch, Math.round(Math.cos(a)*o), Math.round(Math.sin(a)*o), cw,ch);
  }
  ictx.globalCompositeOperation='source-in'; ictx.fillStyle=INK; ictx.fillRect(0,0,cw,ch);
  ictx.globalCompositeOperation='source-over';
  ictx.drawImage(src, minx,miny,cw,ch, 0,0,cw,ch);
  out._edgeHit=edgeHit;
  out._srcW=w; out._srcH=h;
  return out;
}
function usedIds(){ return new Set(actors.map(a=>a.id)); }
function pickId(){
  const me=selChar(), used=usedIds();
  const baked=[...sprites.keys()].filter(id=>id!==me);
  const fresh=baked.filter(id=>!used.has(id));
  const pool=fresh.length?fresh:baked;
  if(!pool.length) return null;
  return pool[(Math.random()*pool.length)|0];
}
function spawn(w,h,opts,edge){
  const id=pickId(); if(!id) return null;
  const z=Math.random();
  const y0=opts.y0??.12, y1=opts.y1??.78;
  const dir=Math.random()<.5?1:-1;
  const x=edge?(dir>0?-0.12:1.12):(0.08+Math.random()*0.84);
  return {
    id, z, dir, x, y:y0+(y1-y0)*(0.15+Math.random()*0.7),
    bob:0.012+z*0.01, bobSp:1.1+z*0.7, phase:Math.random()*6.28
  };
}
function step(t,w,h,opts){
  if(frozen) return;
  const dt=lastT?Math.min(.05, Math.max(0,t-lastT)):0;
  lastT=t;
  // Don't show anyone until every roster bake is ready, then spawn a varied set.
  if(!allBaked()){ actors.length=0; spawnReady=false; return; }
  if(!spawnReady){ actors.length=0; spawnReady=true; }
  const n=wanted(w);
  while(actors.length<n){ const a=spawn(w,h,opts,false); if(!a) break; actors.push(a); }
  while(actors.length>n) actors.pop();
  const y0=opts.y0??.12, y1=opts.y1??.78;
  for(const a of actors){
    const spd=(0.022+(1-a.z)*0.04)*a.dir;
    a.x+=spd*dt;
    if(a.y<y0) a.y=y0; if(a.y>y1) a.y=y1;
    if(a.x>1.18||a.x<-0.18){
      const nxt=spawn(w,h,opts,true);
      if(nxt){ nxt.dir=a.x>1? -1:1; nxt.x=nxt.dir>0?-0.12:1.12; Object.assign(a,nxt); }
    }
  }
}
function sizeFor(a,w,h){
  const minS=Math.min(w,h);
  return (0.085+(1-a.z)*0.11)*minS;
}
function alphaFor(a,opts){
  const base=0.32+(1-a.z)*0.48;
  if(opts.mode==='bubble') return base*0.82;
  return base;
}
function snap(v, dpr){ return Math.round(v*dpr)/dpr; }
function paint(ctx,w,h,t,opts){
  const dpr=Math.max(1, Math.min(2, window.devicePixelRatio||1));
  const prevSmooth=ctx.imageSmoothingEnabled;
  const prevQ=ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled=true;
  try{ ctx.imageSmoothingQuality='high'; }catch(e){}
  const list=actors.slice().sort((a,b)=>b.z-a.z);
  for(const a of list){
    const spr=sprites.get(a.id); if(!spr) continue;
    const sw=Math.max(1, snap(sizeFor(a,w,h), dpr));
    const sh=Math.max(1, snap(sw*(spr.height/spr.width), dpr));
    const bob=Math.sin(t*a.bobSp+a.phase)*a.bob*h;
    const cx0=snap(a.x*w, dpr), cy0=snap(a.y*h+bob, dpr);
    const al=alphaFor(a,opts);
    if(al<.04) continue;
    ctx.save();
    ctx.globalAlpha=al;
    ctx.translate(cx0, cy0);
    if(a.dir<0) ctx.scale(-1,1);
    ctx.drawImage(spr, snap(-sw/2, dpr), snap(-sh/2, dpr), sw, sh);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled=prevSmooth;
  try{ ctx.imageSmoothingQuality=prevQ; }catch(e){}
}
function clipInfo(spr){
  if(!spr) return { ok:false };
  const w=spr.width, h=spr.height, data=spr.getContext('2d').getImageData(0,0,w,h).data;
  function pix(x,y){ const i=(y*w+x)*4; return [data[i],data[i+1],data[i+2],data[i+3]]; }
  function isInk(p){ return p[3]>16 && Math.abs(p[0]-0x16)+Math.abs(p[1]-0x16)+Math.abs(p[2]-0x3a)<40; }
  function isChar(p){ return p[3]>80 && !isInk(p); }
  const edges={ t:0,b:0,l:0,r:0 };
  for(let x=0;x<w;x++){ if(isChar(pix(x,0))) edges.t++; if(isChar(pix(x,h-1))) edges.b++; }
  for(let y=0;y<h;y++){ if(isChar(pix(0,y))) edges.l++; if(isChar(pix(w-1,y))) edges.r++; }
  const hits=edges.t+edges.b+edges.l+edges.r;
  return { w, h, srcW:spr._srcW||w, srcH:spr._srcH||h, edgeHit:spr._edgeHit||0, edgeChar:hits, edges, clipped:hits>0 || (spr._edgeHit||0)>0 };
}
function hookDebug(){
  window.__bgSwim={
    ready(){ return allBaked(); },
    baked(){ return [...sprites.keys()]; },
    actors(){ return actors.map(a=>({ id:a.id, x:+a.x.toFixed(3), y:+a.y.toFixed(3), z:+a.z.toFixed(3), dir:a.dir })); },
    uniqueActors(){ return new Set(actors.map(a=>a.id)).size; },
    clipCheck(){ const out={}; for(const [id,spr] of sprites) out[id]=clipInfo(spr); return out; },
    pose(list){
      frozen=true;
      actors=(list||[]).map(s=>({
        id:s.id, x:+s.x, y:+s.y, z:s.z==null?.4:+s.z, dir:s.dir<0?-1:1,
        bob:s.bob==null?0.01:+s.bob, bobSp:s.bobSp==null?1.3:+s.bobSp, phase:s.phase==null?0:+s.phase
      }));
    },
    unfreeze(){ frozen=false; spawnReady=allBaked(); },
    sheet(){
      const ids=neededIds().filter(id=>sprites.has(id));
      const cell=280, cols=Math.min(4, Math.max(1,ids.length)), rows=Math.ceil(ids.length/cols)||1;
      const c=document.createElement('canvas'); c.width=cols*cell; c.height=rows*cell;
      const cx=c.getContext('2d');
      cx.imageSmoothingEnabled=true;
      try{ cx.imageSmoothingQuality='high'; }catch(e){}
      cx.fillStyle='#1a7ad4'; cx.fillRect(0,0,c.width,c.height);
      ids.forEach((id,i)=>{
        const spr=sprites.get(id), x=(i%cols)*cell, y=Math.floor(i/cols)*cell;
        // draw at 1:1 if it fits, otherwise downscale (never upscale)
        const sc=Math.min(1, (cell-24)/spr.width, (cell-40)/spr.height);
        const dw=Math.round(spr.width*sc), dh=Math.round(spr.height*sc);
        cx.drawImage(spr, x+Math.round((cell-dw)/2), y+8, dw, dh);
        cx.fillStyle='#fff'; cx.font='16px sans-serif'; cx.textAlign='center';
        cx.fillText(id+'  '+spr.width+'×'+spr.height, x+cell/2, y+cell-10);
      });
      return c.toDataURL('image/png');
    }
  };
}
