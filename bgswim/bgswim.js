/* 2D cutouts of OTHER roster characters drifting behind Bubble Pop.
   Reuses the joystick-buddy snapshot method (main WebGL renderer + render target,
   no second context). #16163a ink outline is baked into each sprite. After that,
   a frame is a handful of 2D drawImage calls. Not shown in the lobby. */
const POOL=['finn','dash','pip','sunny','jelly','lulu','percy','nova','bubbles','oscar','wade','giga'];
const MAX_NARROW=4, MAX_WIDE=5;
const SPR_W=240, SPR_H=168;
const INK='#16163a';

let kit=null, scene=null, cam=null;
const sprites=new Map();
let bakeQ=[], actors=[], frozen=false, lastT=0;

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
  bakeSome(1);
  step(t,w,h,opts);
  paint(ctx,w,h,t,opts);
}

function queueBakes(){
  const me=selChar();
  bakeQ=POOL.filter(id=>id!==me && (!kit.isPlayable||kit.isPlayable(id)) && !sprites.has(id));
}
function selChar(){ return (kit&&kit.getSelChar&&kit.getSelChar())||'ollie'; }
function wanted(w){ return (w>=1000)?MAX_WIDE:MAX_NARROW; }
function bakeSome(n){
  if(!kit) return;
  if(!bakeQ.length) queueBakes();
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
  cam=new THREE.PerspectiveCamera(28, SPR_W/SPR_H, .05, 40);
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
function snapshotChar(id){
  const THREE=kit.THREE, renderer=kit.renderer;
  const o=kit.buildOllie({ charId:id, equipped:{} });
  o.userData.baseY=0;
  poseSwim(o);
  const sc=ensureScene(); sc.add(o);
  const box=new THREE.Box3().setFromObject(o);
  if(box.isEmpty()){ sc.remove(o); return null; }
  const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  const r=Math.max(sz.x,sz.y,sz.z)*1.05+.22;
  const dir=new THREE.Vector3(.12,.28,1).normalize();
  cam.aspect=SPR_W/SPR_H; cam.fov=28;
  cam.position.copy(c).addScaledVector(dir, r/Math.sin(THREE.MathUtils.degToRad(14)));
  cam.lookAt(c.x, c.y+sz.y*.02, c.z); cam.updateProjectionMatrix();
  const w=SPR_W, h=SPR_H;
  const rt=new THREE.WebGLRenderTarget(w,h,{ depthBuffer:true });
  try{ if(rt.texture) rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
  const prevRT=renderer.getRenderTarget();
  const col=new THREE.Color(); renderer.getClearColor(col);
  const prevA=renderer.getClearAlpha();
  const vp=new THREE.Vector4(); renderer.getViewport(vp);
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt); renderer.setViewport(0,0,w,h); renderer.clear();
  renderer.render(sc, cam);
  const buf=new Uint8Array(w*h*4);
  renderer.readRenderTargetPixels(rt,0,0,w,h,buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(col, prevA); renderer.setViewport(vp);
  rt.dispose(); sc.remove(o);
  const src=document.createElement('canvas'); src.width=w; src.height=h;
  const sctx=src.getContext('2d');
  const img=sctx.createImageData(w,h);
  for(let y=0;y<h;y++) img.data.set(buf.subarray((h-1-y)*w*4, (h-y)*w*4), y*w*4);
  sctx.putImageData(img,0,0);
  return outlineAndCrop(src);
}
function outlineAndCrop(src){
  const w=src.width, h=src.height, data=src.getContext('2d').getImageData(0,0,w,h).data;
  let minx=w,miny=h,maxx=0,maxy=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(data[(y*w+x)*4+3]>12){
    if(x<minx)minx=x; if(y<miny)miny=y; if(x>maxx)maxx=x; if(y>maxy)maxy=y;
  }
  if(maxx<minx) return null;
  const pad=Math.max(5, Math.round(Math.min(w,h)/32));
  minx=Math.max(0,minx-pad); miny=Math.max(0,miny-pad);
  maxx=Math.min(w-1,maxx+pad); maxy=Math.min(h-1,maxy+pad);
  const cw=maxx-minx+1, ch=maxy-miny+1;
  const out=document.createElement('canvas'); out.width=cw; out.height=ch;
  const ictx=out.getContext('2d');
  const o=Math.max(3, Math.round(Math.min(cw,ch)/26));
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    ictx.drawImage(src, minx,miny,cw,ch, Math.round(Math.cos(a)*o), Math.round(Math.sin(a)*o), cw,ch);
  }
  ictx.globalCompositeOperation='source-in'; ictx.fillStyle=INK; ictx.fillRect(0,0,cw,ch);
  ictx.globalCompositeOperation='source-over';
  ictx.drawImage(src, minx,miny,cw,ch, 0,0,cw,ch);
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
function paint(ctx,w,h,t,opts){
  const list=actors.slice().sort((a,b)=>b.z-a.z);
  for(const a of list){
    const spr=sprites.get(a.id); if(!spr) continue;
    const sw=sizeFor(a,w,h);
    const sh=sw*(spr.height/spr.width);
    const bob=Math.sin(t*a.bobSp+a.phase)*a.bob*h;
    const x=a.x*w-sw/2;
    const y=a.y*h-sh/2+bob;
    const al=alphaFor(a,opts);
    if(al<.04) continue;
    ctx.save();
    ctx.globalAlpha=al;
    ctx.translate(x+sw/2, y+sh/2);
    if(a.dir<0) ctx.scale(-1,1);
    ctx.drawImage(spr, -sw/2, -sh/2, sw, sh);
    ctx.restore();
  }
}
function hookDebug(){
  window.__bgSwim={
    ready(){ const me=selChar(); return [...sprites.keys()].filter(id=>id!==me).length>=Math.min(6, POOL.filter(id=>id!==me).length); },
    baked(){ return [...sprites.keys()]; },
    actors(){ return actors.map(a=>({ id:a.id, x:+a.x.toFixed(3), y:+a.y.toFixed(3), z:+a.z.toFixed(3), dir:a.dir })); },
    pose(list){
      frozen=true;
      actors=(list||[]).map(s=>({
        id:s.id, x:+s.x, y:+s.y, z:s.z==null?.4:+s.z, dir:s.dir<0?-1:1,
        bob:s.bob==null?0.01:+s.bob, bobSp:s.bobSp==null?1.3:+s.bobSp, phase:s.phase==null?0:+s.phase
      }));
    },
    unfreeze(){ frozen=false; }
  };
}
