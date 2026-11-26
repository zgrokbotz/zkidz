/* Lobby button pictures.
   - CHESTS: a small real 3D common chest (wood body, steel bands from chest-common.jpg, gold lock,
     hinged half-round lid) with an opening/closing loop (glow, coins, a starfish peeking out), baked ONCE
     into a 36-frame strip the same way as the character (same Box3 + ortho + 12% padding fit, offscreen
     target, no setViewport) and played with CSS steps(). The game has no 3D chest model (makeChest is the
     JPG on a plane), so this one is built here. The old CSS-animated JPG stays only as a fallback.
   - CHARACTERS: a small animated bake of the player's CURRENT character (real 3D model).
     The model is rendered once per look into a looping sprite strip (N frames, offscreen
     render target, orthographic camera fitted to the union Box3 of every frame + 12% padding,
     no pixel-ratio setViewport). The strip is played by a CSS steps() animation, so there is
     no per-frame JS or WebGL work in the lobby. It re-bakes only when the selected character
     or its outfit changes. */
import { SPECIES } from '../zkidz-anim.js?v=20261126-1';

const N=12, FH=128, ASPECT=0.9, FW=Math.round(FH*ASPECT), PAD=0.12;
const st={ scene:null, cam:null, rt:null, buf:null, img:null, tmp:null, ink:null, key:'', gen:0, url:null,
  v:null, v2:null, v3:null, col:null, vp:null, scis:null, ready:false };

function lookKey(S){ const eq=(S&&S.equipped)||{}; return ((S&&S.selChar)||'ollie')+'|'+Object.keys(eq).sort().map(s=>s+':'+(eq[s]||'')).join(','); }

export function initLobbyChest(artSrc){ // fallback picture only (shown until the 3D bake is ready, or if it fails)
  const img=document.querySelector('#chestsBtn .la-chest-img');
  if(img && artSrc) img.src=artSrc;
}

function ensure(kit){
  if(st.scene) return;
  const THREE=kit.THREE;
  const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x6a7aa8, 1.55));
  const d=new THREE.DirectionalLight(0xffffff, 2.15); d.position.set(2.4,5,6); sc.add(d);
  const f=new THREE.DirectionalLight(0x9fd8ff, .85); f.position.set(-4,2,-3); sc.add(f);
  st.scene=sc; st.cam=new THREE.OrthographicCamera(-1,1,1,-1,.05,80);
  st.v=new THREE.Vector3(); st.v2=new THREE.Vector3(); st.v3=new THREE.Vector3();
  st.col=new THREE.Color(); st.vp=new THREE.Vector4(); st.scis=new THREE.Vector4();
  st.rt=new THREE.WebGLRenderTarget(FW,FH,{ depthBuffer:true });
  try{ st.rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
  st.buf=new Uint8Array(FW*FH*4);
  st.tmp=document.createElement('canvas'); st.tmp.width=FW; st.tmp.height=FH;
  st.ink=document.createElement('canvas'); st.ink.width=FW; st.ink.height=FH;
}

// Loop pose for phase p in [0,2PI): idle base + gentle swim bob / sway / arm paddle / tail wiggle.
function pose(o, p, kit){
  kit.animateChar(o,'idle',0,0.1,0.8);
  const P=o.userData.parts||{}, s=Math.sin(p);
  if(P.rig){ P.rig.position.y+=s*.05; P.rig.rotation.z+=s*.07; P.rig.rotation.y+=Math.sin(p+.7)*.3; }
  if(P.head){ P.head.rotation.z+=Math.sin(p+1.2)*.09; P.head.rotation.x+=Math.sin(2*p)*.04; }
  const flap=(Math.sin(2*p+.4)*.5+.5)*.38;
  if(P['sh-1']) P['sh-1'].rotation.z-=flap;
  if(P.sh1) P.sh1.rotation.z+=flap;
  if(P.tail){ const kind=o.userData.kind||o.userData.charId, sp=SPECIES[kind]||SPECIES.ollie||{};
    const amp=(sp.tailAmp||.2)*1.6, w=Math.sin(2*p+.5)*amp; if(sp.tail==='x') P.tail.rotation.x+=w; else P.tail.rotation.y+=w; }
  o.updateMatrixWorld(true);
}
function worldBox(o, THREE){
  o.updateMatrixWorld(true);
  const box=new THREE.Box3(); box.makeEmpty(); const v=st.v;
  o.traverse(m=>{
    if(!m.isMesh || !m.geometry) return;
    if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b=m.geometry.boundingBox; if(!b) return;
    for(const x of [b.min.x,b.max.x]) for(const y of [b.min.y,b.max.y]) for(const z of [b.min.z,b.max.z]){
      v.set(x,y,z).applyMatrix4(m.matrixWorld); box.expandByPoint(v);
    }
  });
  if(box.isEmpty()) box.setFromObject(o);
  return box;
}
// ortho camera fitted to a world Box3 (all children, hats and gear included) with PAD padding,
// widened/heightened to the fixed icon aspect so every character gets the same frame size.
function frameCam(box, THREE){
  const cam=st.cam, c=box.getCenter(st.v2), sz=box.getSize(st.v3);
  const dir=new THREE.Vector3(0,.2,1).normalize(), dist=Math.max(4, sz.length()*1.6);
  cam.position.copy(c).addScaledVector(dir, dist); cam.up.set(0,1,0); cam.lookAt(c); cam.updateMatrixWorld(true);
  const inv=cam.matrixWorldInverse, v=st.v;
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9;
  for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]){
    v.set(x,y,z).applyMatrix4(inv);
    minX=Math.min(minX,v.x); maxX=Math.max(maxX,v.x); minY=Math.min(minY,v.y); maxY=Math.max(maxY,v.y); minZ=Math.min(minZ,v.z); maxZ=Math.max(maxZ,v.z);
  }
  let hw=(maxX-minX)/2*(1+PAD)+.02, hh=(maxY-minY)/2*(1+PAD)+.02; const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  if(hw/hh<ASPECT) hw=hh*ASPECT; else hh=hw/ASPECT;
  cam.left=cx-hw; cam.right=cx+hw; cam.top=cy+hh; cam.bottom=cy-hh;
  cam.near=Math.max(.05,-maxZ-1); cam.far=Math.max(cam.near+1,-minZ+1); cam.updateProjectionMatrix();
}
function renderFrame(kit, strip, i){
  const THREE=kit.THREE, r=kit.renderer;
  const prevRT=r.getRenderTarget(); r.getClearColor(st.col); const prevA=r.getClearAlpha();
  r.getViewport(st.vp); r.getScissor(st.scis); const prevS=r.getScissorTest();
  r.setClearColor(0x000000,0);
  r.setRenderTarget(st.rt);  // NB: no setViewport on the offscreen target (it is multiplied by pixelRatio)
  r.setScissorTest(false); r.clear(); r.render(st.scene, st.cam);
  r.readRenderTargetPixels(st.rt,0,0,FW,FH,st.buf);
  r.setRenderTarget(prevRT); r.setClearColor(st.col,prevA); r.setViewport(st.vp); r.setScissor(st.scis); r.setScissorTest(prevS);
  const t=st.tmp.getContext('2d'); let im=st.img; if(!im) im=st.img=t.createImageData(FW,FH);
  for(let y=0;y<FH;y++) im.data.set(st.buf.subarray((FH-1-y)*FW*4,(FH-y)*FW*4), y*FW*4);
  t.putImageData(im,0,0);
  const k=st.ink.getContext('2d'); k.clearRect(0,0,FW,FH); const o=3;
  for(let a=0;a<8;a++){ const q=a*Math.PI/4; k.drawImage(st.tmp, Math.round(Math.cos(q)*o), Math.round(Math.sin(q)*o)); }
  k.globalCompositeOperation='source-in'; k.fillStyle='#16163a'; k.fillRect(0,0,FW,FH); k.globalCompositeOperation='source-over';
  const c=strip.getContext('2d'); c.drawImage(st.ink,i*FW,0); c.drawImage(st.tmp,i*FW,0);
}
function apply(blob){
  const el=document.querySelector('#charsBtn .la-char'); if(!el) return;
  const u=URL.createObjectURL(blob), old=st.url; st.url=u;
  el.style.setProperty('--la-img', `url("${u}")`);
  el.style.setProperty('--la-n', String(N));
  el.style.setProperty('--la-end', (100*N/(N-1)).toFixed(3)+'%');
  el.classList.add('ready'); st.ready=true;
  if(old) setTimeout(()=>URL.revokeObjectURL(old), 1500);
}

/* ================= 3D chest bake ================= */
const CN=36, CF=120, CLOOP=3.6;
const cs={ done:false, started:false };
const ease=(a,b,x)=>{ x=Math.max(0,Math.min(1,(x-a)/(b-a))); return x*x*(3-2*x); };
const backOut=x=>{ x=Math.max(0,Math.min(1,x)); const c=1.9; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); };

function buildChestModel(THREE){
  const g=new THREE.Group();
  const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:.62, metalness:0 },o));
  const wood=M(0xb8733c), woodD=M(0x7a4a26), inner=M(0x3a2112,{ side:THREE.DoubleSide }), steel=M(0x9aa0ab,{ roughness:.45, metalness:.25 }), gold=M(0xffc93a,{ roughness:.35, metalness:.35 });
  const W=1.2, H=.62, D=.8, T=.07, R=D/2;
  const box=(w,h,d,m,x,y,z,par)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); (par||g).add(o); return o; };
  // open-topped body: floor + 4 walls (so the inside shows when the lid is up)
  box(W,T,D,woodD,0,T/2,0); box(W,H,T,wood,0,H/2,D/2-T/2); box(W,H,T,wood,0,H/2,-D/2+T/2);
  box(T,H,D,wood,W/2-T/2,H/2,0); box(T,H,D,wood,-W/2+T/2,H/2,0);
  box(W-2*T,.02,D-2*T,inner,0,H-.12,0);
  // steel bands round the body, gold lock plate
  for(const x of [-.4,.4]){ box(.15,H+.02,D+.03,steel,x,H/2,0); }
  box(.2,.22,.06,gold,0,H-.12,D/2+.035); box(.05,.09,.07,M(0x2a1608),0,H-.13,D/2+.04);
  // treasure mound just under the rim
  const mound=new THREE.Mesh(new THREE.SphereGeometry(.5,18,10,0,Math.PI*2,0,Math.PI/2),gold); mound.scale.set(1.0,.34,.62); mound.position.set(0,H-.2,0); g.add(mound);
  const coinGeo=new THREE.CylinderGeometry(.095,.095,.028,16);
  const coins=[]; const cp=[[-.28,H-.05,.05,.3],[.05,H-.01,-.08,-.2],[.3,H-.07,.1,.5],[-.05,H-.04,.17,.1]];
  for(const [x,y,z,r] of cp){ const c=new THREE.Mesh(coinGeo,gold); c.position.set(x,y,z); c.rotation.set(1.2+r,r*2,.3); g.add(c); }
  for(let i=0;i<3;i++){ const c=new THREE.Mesh(coinGeo,gold); c.position.set(0,H,0); g.add(c); coins.push(c); }
  // starfish (same silhouette recipe as the game's reward starfish)
  const sh=new THREE.Shape(), tipR=.2, tipD=.8, valR=.32; const tip=i=>{ const a=Math.PI/2+i*2*Math.PI/5; return { a, x:Math.cos(a)*tipD, y:Math.sin(a)*tipD }; };
  for(let i=0;i<5;i++){ const t=tip(i), n=tip(i+1); if(i===0) sh.moveTo(t.x+Math.cos(t.a-Math.PI/2)*tipR, t.y+Math.sin(t.a-Math.PI/2)*tipR);
    sh.absarc(t.x,t.y,tipR,t.a-Math.PI/2,t.a+Math.PI/2,false); const va=t.a+Math.PI/5; sh.quadraticCurveTo(Math.cos(va)*valR,Math.sin(va)*valR,n.x+Math.cos(n.a-Math.PI/2)*tipR,n.y+Math.sin(n.a-Math.PI/2)*tipR); }
  const sg=new THREE.ExtrudeGeometry(sh,{ depth:.14, bevelEnabled:true, bevelThickness:.16, bevelSize:.12, bevelSegments:4, curveSegments:8 }); sg.center();
  const star=new THREE.Mesh(sg,M(0xff9d2e,{ roughness:.5 })); star.scale.setScalar(.2); star.position.set(0,H-.1,.02); g.add(star);
  // hinged lid: pivot on the back top edge, half-round shell + underside + bands
  const pivot=new THREE.Group(); pivot.position.set(0,H,-D/2); g.add(pivot);
  const shellGeo=new THREE.CylinderGeometry(R,R,W,28,1,false,0,Math.PI); shellGeo.rotateZ(Math.PI/2);
  const shell=new THREE.Mesh(shellGeo,wood); shell.position.set(0,0,R); pivot.add(shell);
  box(W-.02,.025,D-.02,woodD,0,.012,R,pivot);
  for(const x of [-.4,.4]){ const bg=new THREE.CylinderGeometry(R+.025,R+.025,.15,28,1,false,0,Math.PI); bg.rotateZ(Math.PI/2); const b=new THREE.Mesh(bg,steel); b.position.set(x,0,R); pivot.add(b); }
  const knob=new THREE.Mesh(new THREE.BoxGeometry(.2,.1,.06),gold); knob.position.set(0,.04,D+.02); pivot.add(knob);
  g.userData={ pivot, star, coins, H, D, top:H };
  return g;
}
// timeline u in [0,1): closed+anticipation -> lid opens (back-out) -> hold open (glow, starfish peek, coins hop) -> close -> closed
function poseChest(g, u){
  const U=g.userData, open=ease(.20,.36,u)-ease(.70,.84,u);          // 0 closed .. 1 open
  const lid = u<.5 ? -Math.PI*.64*backOut((u-.2)/.16) : -Math.PI*.64*(1-ease(.70,.84,u));
  U.pivot.rotation.x = (u<.2||u>=.84) ? 0 : lid;
  // anticipation wiggle just before opening, little settle after closing
  const wig = ease(.12,.15,u)*(1-ease(.19,.2,u)); g.rotation.z = Math.sin(u*Math.PI*2*14)*.05*wig + Math.sin((u-.84)*Math.PI*2*6)*.025*Math.max(0,1-(u-.84)/.1)*(u>.84?1:0);
  g.position.y = Math.sin(u*Math.PI*4)*.035 + (open>0?open*.02:0);
  // starfish rises out, spins, sinks back
  const rise=ease(.30,.46,u)*(1-ease(.62,.72,u));
  U.star.visible=rise>.01; U.star.position.y=U.H-.12+rise*.62; U.star.rotation.set(-.15,u*Math.PI*6,Math.sin(u*Math.PI*8)*.12); U.star.scale.setScalar(.12+.12*rise);
  // three coins hop out in staggered arcs
  U.coins.forEach((c,i)=>{ const a=.30+i*.045, b=a+.2, k=(u-a)/(b-a); c.visible=k>0&&k<1;
    if(c.visible){ const x=(i-1)*.28, h=Math.sin(Math.PI*k); c.position.set(x*(.4+k*.8), U.H+h*.55, .08*(i-1)); c.rotation.set(k*9+i, k*7, 0); } });
  g.updateMatrixWorld(true);
}
function bakeChest(kit){
  if(cs.started) return; cs.started=true;
  try{
    ensure(kit); const THREE=kit.THREE;
    const g=buildChestModel(THREE); g.rotation.y=-.5; // 3/4 turn so the front + opening both read
    const wrap=new THREE.Group(); wrap.add(g); st.scene.add(wrap);
    // fit: union of every frame's Box3 (lid up, starfish, hopping coins, bob) + 12% padding, square frame
    const box=new THREE.Box3(); box.makeEmpty();
    for(let i=0;i<CN;i++){ poseChest(g,i/CN); box.union(worldBox(g,THREE)); }
    chestFrameCam(box, THREE);
    // chest uses its own RT/canvases (square) so the character resources stay untouched
    const rt=new THREE.WebGLRenderTarget(CF,CF,{ depthBuffer:true }); try{ rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
    const buf=new Uint8Array(CF*CF*4), tmp=document.createElement('canvas'); tmp.width=tmp.height=CF; const ink=document.createElement('canvas'); ink.width=ink.height=CF;
    const strip=document.createElement('canvas'); strip.width=CF*CN; strip.height=CF;
    const sc=strip.getContext('2d'), r=kit.renderer; let im=null;
    for(let i=0;i<CN;i++){
      const u=i/CN; poseChest(g,u);
      const prevRT=r.getRenderTarget(); r.getClearColor(st.col); const pa=r.getClearAlpha(); r.getViewport(st.vp); r.getScissor(st.scis); const ps=r.getScissorTest();
      r.setClearColor(0x000000,0); r.setRenderTarget(rt); r.setScissorTest(false); r.clear(); r.render(st.scene, st.cam);
      r.readRenderTargetPixels(rt,0,0,CF,CF,buf);
      r.setRenderTarget(prevRT); r.setClearColor(st.col,pa); r.setViewport(st.vp); r.setScissor(st.scis); r.setScissorTest(ps);
      const t=tmp.getContext('2d'); if(!im) im=t.createImageData(CF,CF);
      for(let y=0;y<CF;y++) im.data.set(buf.subarray((CF-1-y)*CF*4,(CF-y)*CF*4), y*CF*4);
      t.putImageData(im,0,0);
      const k=ink.getContext('2d'); k.clearRect(0,0,CF,CF); const o=3;
      for(let a=0;a<8;a++){ const q=a*Math.PI/4; k.drawImage(tmp, Math.round(Math.cos(q)*o), Math.round(Math.sin(q)*o)); }
      k.globalCompositeOperation='source-in'; k.fillStyle='#16163a'; k.fillRect(0,0,CF,CF); k.globalCompositeOperation='source-over';
      // 2D glow behind + sparkles in front, only while the lid is up
      const open=Math.max(0, Math.min(1, ease(.22,.34,u)-ease(.70,.80,u)));
      const x0=i*CF;
      if(open>.01){ const gr=sc.createRadialGradient(x0+CF*.5,CF*.5,CF*.04,x0+CF*.5,CF*.5,CF*.5); gr.addColorStop(0,`rgba(255,236,120,${.85*open})`); gr.addColorStop(.5,`rgba(255,214,90,${.35*open})`); gr.addColorStop(1,'rgba(255,214,90,0)'); sc.fillStyle=gr; sc.fillRect(x0,0,CF,CF); }
      sc.drawImage(ink,x0,0); sc.drawImage(tmp,x0,0);
      if(open>.4){ /* sparkles kept >=18px from every edge (no-crop) */ const tw=[[.2,.24,.8],[.8,.3,.6],[.34,.17,.5],[.7,.18,.9]]; tw.forEach(([px,py,ph],j)=>{ const a=Math.sin((u*6+ph*3+j)*Math.PI)*.5+.5; const s=CF*(.035+.05*a)*open; sc.save(); sc.translate(x0+px*CF,py*CF); sc.fillStyle='#fff6b0'; sc.strokeStyle='#16163a'; sc.lineWidth=1.5; sc.beginPath(); for(let q=0;q<8;q++){ const rr=q%2?s*.38:s; const ang=q*Math.PI/4-Math.PI/2; sc.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr); } sc.closePath(); sc.stroke(); sc.fill(); sc.restore(); }); }
    }
    st.scene.remove(wrap); rt.dispose();
    g.traverse(m=>{ if(m.isMesh){ m.geometry.dispose(); } });
    strip.toBlob(b=>{ if(!b) return; const el=document.querySelector('#chestsBtn .la-chest'); if(!el) return; const u=URL.createObjectURL(b);
      el.style.setProperty('--lc-img',`url("${u}")`); el.style.setProperty('--lc-n',String(CN)); el.style.setProperty('--lc-end',(100*CN/(CN-1)).toFixed(3)+'%'); el.classList.add('ready'); cs.done=true; },'image/png');
  }catch(e){ console.warn('lobby chest anim failed', e); }
}
function chestFrameCam(box, THREE){
  const cam=st.cam, c=box.getCenter(st.v2), sz=box.getSize(st.v3);
  const dir=new THREE.Vector3(0,.5,1).normalize(), dist=Math.max(4, sz.length()*1.6);
  cam.position.copy(c).addScaledVector(dir, dist); cam.up.set(0,1,0); cam.lookAt(c); cam.updateMatrixWorld(true);
  const inv=cam.matrixWorldInverse, v=st.v; let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9;
  for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]){
    v.set(x,y,z).applyMatrix4(inv); minX=Math.min(minX,v.x); maxX=Math.max(maxX,v.x); minY=Math.min(minY,v.y); maxY=Math.max(maxY,v.y); minZ=Math.min(minZ,v.z); maxZ=Math.max(maxZ,v.z);
  }
  let hw=(maxX-minX)/2*(1+PAD)+.02, hh=(maxY-minY)/2*(1+PAD)+.02; const cx=(minX+maxX)/2, cy=(minY+maxY)/2; const h=Math.max(hw,hh); hw=hh=h;
  cam.left=cx-hw; cam.right=cx+hw; cam.top=cy+hh; cam.bottom=cy-hh; cam.near=Math.max(.05,-maxZ-1); cam.far=Math.max(cam.near+1,-minZ+1); cam.updateProjectionMatrix();
}

/** Call whenever the selection / outfit may have changed (cheap when nothing changed). */
export function syncLobbyChar(kit, S){
  if(!kit||!kit.THREE||!kit.renderer||!kit.buildChar||!kit.animateChar) return;
  if(!cs.started) requestAnimationFrame(()=>requestAnimationFrame(()=>{ try{ ensure(kit); bakeChest(kit); }catch(e){} }));
  const key=lookKey(S); if(key===st.key) return;
  st.key=key; const gen=++st.gen;
  const run=()=>{
    if(gen!==st.gen) return;
    try{
      ensure(kit); const THREE=kit.THREE;
      const o=kit.buildChar((S&&S.selChar)||'ollie'); o.userData.baseY=0; o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.setScalar(1);
      st.scene.add(o);
      for(let i=0;i<4;i++) kit.animateChar(o,'idle',0,0.1,0.8);   // settle the blend weights
      const box=new THREE.Box3(); box.makeEmpty();
      for(let i=0;i<N;i++){ pose(o, i/N*Math.PI*2, kit); box.union(worldBox(o,THREE)); }
      frameCam(box, THREE);
      const strip=document.createElement('canvas'); strip.width=FW*N; strip.height=FH;
      for(let i=0;i<N;i++){ pose(o, i/N*Math.PI*2, kit); renderFrame(kit, strip, i); }
      st.scene.remove(o); try{ kit.disposeChar&&kit.disposeChar(o); }catch(e){}
      if(gen!==st.gen) return;
      strip.toBlob(b=>{ if(b && gen===st.gen) apply(b); }, 'image/png');
    }catch(e){ console.warn('lobby char anim failed', e); st.key=''; }
  };
  requestAnimationFrame(run);   // keep the bake out of the click handler / first paint
}
export const __lobbyAnimDebug={ get state(){ return { key:st.key, ready:st.ready, N, FW, FH }; } };
