/* Endless Swimmer — ZKIDZ mini game. A 3-lane underwater runner: dodge rocks (jump), jellies (duck) and coral (switch lanes),
 * grab starfish, speed ramps up. The player's own 3D character (buildOllie + Zharacters' animateChar) is drawn by the
 * game's renderer into its own small reef scene (no second WebGL context, no new assets).
 *   import { openSwim } from './swim/swim.js';
 *   openSwim({ ECO, S, save, artUrl, chars, kit, sfxOn, onWin, onExit, lb });
 * Own save key: zkidz_swim_v1. Leaderboard mode: 'swim' (best distance, metres). */
import { clamp, rand, pick, firstName, injectCss, loadSave, writeSave, makeSfx, creditStarfish, payHtml, chestHtml, showModal, hideModal, toast, confetti, topBar, charMap, artSrc } from '../mini/mini.js?v=20261124-2';

/* ================= ECONOMY — APPROVED by Zander (Zokenomics' Endless Swimmer numbers) ================= */
export const SW_PICKUPS_PER_STARFISH = 2;    // every 2 starfish picked up = 1 Starfish
export const SW_METERS_PER_STARFISH  = 200;  // every 200 m swum = 1 Starfish
export const SW_RUN_CAP              = 50;   // pickups + distance pay never more than this per run
export const SW_NEW_BEST_BONUS       = 12;   // beat your best distance (paid on top of the cap)
export const SW_WIN_MIN_SECONDS      = 45;   // run counts toward the 5-win Play chest only if it lasted >= 45 s
export const SW_BEST_MIN_SECONDS     = 15;   // anti-farm guard, APPROVED by Zander (15 s): the new-best bonus only pays on runs >= 15 s,
                                             // so a kid can't stop at best+1 m every few seconds for +12. Set to 0 to drop the guard.
/* No flat finish pay. Paid through ECO.ensureDay + ECO.cardsEarn (no daily caps). No Treasure chests, no Legendary/Cosmic pity.
   The free "keep swimming" and every retry never cost Starfish. */
export function swPayout(pickups, meters, newBest){
  const fromPickups=Math.floor(pickups/SW_PICKUPS_PER_STARFISH), fromMeters=Math.floor(meters/SW_METERS_PER_STARFISH);
  const raw=fromPickups+fromMeters, run=Math.min(SW_RUN_CAP, raw), best=newBest? SW_NEW_BEST_BONUS : 0;
  return { fromPickups, fromMeters, capped:raw>SW_RUN_CAP, run, best, total:run+best };
}
const SAVE_KEY='zkidz_swim_v1';
const DEFAULTS={ v:1, best:0, runs:0, meters:0, pickups:0, tutorial:0 };
/* tuning */
const LANE=2.2, SPEED0=9, SPEED_UP=.08, SPEED_MAX=24, JUMP_V=7.6, GRAV=22, SHIELDS=3;
const PICKUP_EVERY=13, PICKUP_LINE=4;      // a line of 4 every ~13 s + a rare trio -> ~20-22 spawned, ~15-20 caught / minute
const ROCK_COLS=[0x6b6fa8,0x5a6b9a,0x7a6fa8,0x5f5a94], CORAL_COLS=[0xff5fa8,0xd25cff,0xff7ac6,0x8f3fe0,0xff9a3c,0x2ee6d6];

let H=null;
export function openSwim(opts={}){
  if(H) closeSwim();
  if(!opts.noCss){ injectCss('zkMiniCss','../mini/mini.css', import.meta.url); injectCss('oceanSwimCss','./swim.css', import.meta.url); }
  const root=document.createElement('div'); root.id='oceanSwim'; root.className='zmini';
  root.innerHTML=`${topBar({ badge:'METERS', badgeVal:'0', badgeCls:'blue' })}
    <div class="sw-hud2 hidden"><div class="zm-pill sw-shields"></div><div class="zm-pill sw-earn"><span class="zm-coin"></span><b>+0</b></div></div>
    <div class="sw-help hidden"></div><div class="sw-count hidden"></div>
    <div class="zm-menu sw-menu hidden"></div><div class="zm-modal hidden"></div><div class="zm-toast"></div>`;
  document.body.appendChild(root);
  H={ opts, root, P:loadSave(SAVE_KEY, DEFAULTS), cmap:charMap(opts), muted:false, screen:'menu', raf:0, last:performance.now(), t:0, timeScale:1, auto:false };
  H.sfx=makeSfx(()=>!H.muted && (typeof opts.sfxOn==='function' ? opts.sfxOn() : !(opts.S && opts.S.music===false)));
  root.addEventListener('pointerdown', ()=>H&&H.sfx.unlock(), {passive:true, capture:true});
  root.querySelector('.zm-back').onclick=()=>{ H.sfx.click(); if(H.screen==='run') pause(); else if(H.screen==='menu') exitToLobby(); };
  root.querySelector('.zm-snd').onclick=e=>{ H.muted=!H.muted; e.currentTarget.textContent=H.muted?'🔇':'🔊'; if(!H.muted){ H.sfx.unlock(); H.sfx.click(); } };
  H._key=e=>onKey(e); addEventListener('keydown', H._key);
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp);
  H._rs=()=>frameCam(); addEventListener('resize', H._rs);
  buildWorld(); refreshCoins(); toMenu();
  H.raf=requestAnimationFrame(loop);
  window.__oceanSwim={ _owned:true, get H(){ return H; }, startRun, lane:d=>move(d), jump, duck, finishNow:()=>{ if(H&&H.run) endRun(); }, swPayout,
    consts:{ SW_PICKUPS_PER_STARFISH, SW_METERS_PER_STARFISH, SW_RUN_CAP, SW_NEW_BEST_BONUS, SW_WIN_MIN_SECONDS, SW_BEST_MIN_SECONDS } };
  return { close:closeSwim };
}
export function closeSwim(){
  if(!H) return; cancelAnimationFrame(H.raf); removeEventListener('keydown', H._key); removeEventListener('resize', H._rs);
  const k=H.opts.kit;
  if(H.scene){ if(H.char){ H.scene.remove(H.char); try{ k.disposeChar && k.disposeChar(H.char); }catch(e){} }
    H.owned.forEach(x=>{ try{ x.dispose(); }catch(e){} }); }
  if(H.root.parentNode) H.root.parentNode.removeChild(H.root);
  if(window.__oceanSwim && window.__oceanSwim._owned) window.__oceanSwim=null;
  H=null;
}
function exitToLobby(){ const cb=H&&H.opts.onExit; closeSwim(); if(typeof cb==='function') cb(); }
const $=s=>H.root.querySelector(s);
function refreshCoins(){ const S=H.opts.S; H.root.querySelectorAll('.zm-coins').forEach(e=>e.textContent=(S?S.coins:0).toLocaleString()); }
function isTouch(){ return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; }

/* ================= world ================= */
function own(x){ H.owned.push(x); return x; }
function outlined(T, geo, mat, k=1.1){ const g=new T.Group(); const m=new T.Mesh(geo, mat); m.castShadow=true; const o=new T.Mesh(geo, H.inkMat); o.scale.setScalar(k); g.add(o, m); return g; }
function buildWorld(){
  const k=H.opts.kit; H.owned=[]; if(!k||!k.THREE||!k.renderer){ return; }
  const T=k.THREE, sc=new T.Scene(); H.scene=sc; H.T=T;
  const c=document.createElement('canvas'); c.width=2; c.height=256; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#6fdcff'); gr.addColorStop(1,'#0b56a8'); g.fillStyle=gr; g.fillRect(0,0,2,256);
  const bg=own(new T.CanvasTexture(c)); bg.colorSpace=T.SRGBColorSpace; sc.background=bg; sc.fog=new T.Fog(0x2a90d8, 22, 78);
  H.key = k.setupVisionScene ? k.setupVisionScene(sc, k.renderer) : (()=>{ const l=new T.DirectionalLight(0xffffff,2); sc.add(l, new T.HemisphereLight(0xd6f1ff,0xb48a5c,1.1)); return l; })();
  if(H.key && H.key.shadow){ const s=H.key.shadow.camera; s.left=-9; s.right=9; s.top=14; s.bottom=-14; s.updateProjectionMatrix(); }
  H.inkMat=own(new T.MeshBasicMaterial({ color:0x16163a, side:T.BackSide }));
  // sand (period 15 m so the floor can snap forward seamlessly)
  const fmat = k.sandMaterial ? own(k.sandMaterial(16)) : own(new T.MeshStandardMaterial({ color:0xe2b475, roughness:1 }));
  H.floor=new T.Mesh(own(new T.PlaneGeometry(60,240)), fmat); H.floor.rotation.x=-Math.PI/2; H.floor.receiveShadow=true; sc.add(H.floor);
  // lane path: three lighter lanes with dotted dividers
  const lc=document.createElement('canvas'); lc.width=128; lc.height=64; const lg=lc.getContext('2d');
  lg.fillStyle='rgba(255,240,200,.38)'; lg.fillRect(4,0,120,64); lg.fillStyle='rgba(255,255,255,.75)'; for(const x of [43,85]){ lg.fillRect(x-2,6,4,22); lg.fillRect(x-2,38,4,22); }
  const lt=own(new T.CanvasTexture(lc)); lt.wrapT=T.RepeatWrapping; lt.repeat.set(1,240/3); lt.colorSpace=T.SRGBColorSpace;
  H.path=new T.Mesh(own(new T.PlaneGeometry(LANE*3+.4,240)), own(new T.MeshBasicMaterial({ map:lt, transparent:true, depthWrite:false }))); H.path.rotation.x=-Math.PI/2; H.path.position.y=.02; sc.add(H.path);
  // shared obstacle / pickup parts
  const sh=new T.Shape(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, r=i%2?.22:.5; i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r); } sh.closePath();
  H.G={ star:own(new T.ExtrudeGeometry(sh,{ depth:.16, bevelEnabled:true, bevelThickness:.05, bevelSize:.05, bevelSegments:1 })), rock:own(new T.DodecahedronGeometry(.85,0)),
    dome:own(new T.SphereGeometry(.72,18,10,0,Math.PI*2,0,Math.PI/2)), tent:own(new T.CylinderGeometry(.05,.03,.62,5)), finger:own(new T.CapsuleGeometry(.3,1.6,4,8)),
    kelp:own(new T.CylinderGeometry(.08,.14,1,5)), cone:own(new T.ConeGeometry(.5,1.6,7)), bub:own(new T.BufferGeometry()) };
  H.G.star.center();
  H.M={ star:own(new T.MeshStandardMaterial({ color:0xff8a1f, emissive:0xff6a00, emissiveIntensity:.35, roughness:.45 })),
    jelly:own(new T.MeshStandardMaterial({ color:0xff8fd8, emissive:0xff4fc0, emissiveIntensity:.35, transparent:true, opacity:.82, roughness:.3 })),
    tent:own(new T.MeshStandardMaterial({ color:0xffc2ec, emissive:0xff8fd8, emissiveIntensity:.3 })),
    rock:ROCK_COLS.map(c=>own(new T.MeshStandardMaterial({ color:c, flatShading:true, roughness:.9 }))),
    coral:CORAL_COLS.map(c=>own(new T.MeshStandardMaterial({ color:c, roughness:.6 }))), kelp:own(new T.MeshStandardMaterial({ color:0x2fae4a, roughness:.8 })) };
  // side decor (recycled)
  H.decor=[]; for(let i=0;i<44;i++){ const side=i%2?1:-1, d=makeDecor(T); d.position.set(side*rand(5.2,12), 0, -i*4.5+10); d.userData.side=side; sc.add(d); H.decor.push(d); }
  // floating bubbles
  const n=90, p=new Float32Array(n*3); for(let i=0;i<n;i++){ p[i*3]=rand(-12,12); p[i*3+1]=rand(0,9); p[i*3+2]=rand(-60,8); }
  H.G.bub.setAttribute('position', new T.BufferAttribute(p,3)); const bc=document.createElement('canvas'); bc.width=bc.height=32; const bx=bc.getContext('2d'); bx.strokeStyle='rgba(255,255,255,.95)'; bx.lineWidth=3; bx.beginPath(); bx.arc(16,16,12,0,7); bx.stroke(); bx.fillStyle='rgba(220,245,255,.35)'; bx.fill(); bx.fillStyle='#fff'; bx.beginPath(); bx.arc(11,11,3,0,7); bx.fill();
  H.bubbles=new T.Points(H.G.bub, own(new T.PointsMaterial({ map:own(new T.CanvasTexture(bc)), size:.32, transparent:true, opacity:.85, depthWrite:false }))); sc.add(H.bubbles);
  H.cam=new T.PerspectiveCamera(60,1,.1,120); frameCam();
  const S=H.opts.S||{}; H.charId=S.selChar||'ollie';
  try{ H.char=k.buildChar(H.charId); }catch(e){ H.char=null; }
  if(H.char){ H.char.rotation.y=Math.PI; sc.add(H.char); }
}
function makeDecor(T){
  const g=new T.Group(), r=Math.random();
  if(r<.4){ const n=2+Math.floor(rand(0,3)); for(let i=0;i<n;i++){ const m=new T.Mesh(H.G.kelp, H.M.kelp); const h=rand(2.5,6); m.scale.set(1,h,1); m.position.set(rand(-.6,.6), h/2, rand(-.6,.6)); m.userData.sway=rand(0,6); g.add(m); } }
  else if(r<.8){ for(let i=0;i<3;i++){ const m=new T.Mesh(H.G.finger, pick(H.M.coral)); const s=rand(.6,1.2); m.scale.set(s,s*rand(.8,1.4),s); m.position.set(rand(-.7,.7), s*1.1, rand(-.7,.7)); m.rotation.z=rand(-.3,.3); g.add(m); } }
  else { const m=new T.Mesh(H.G.rock, pick(H.M.rock)); const s=rand(1,2.2); m.scale.set(s,s*.7,s); m.position.y=s*.3; g.add(m); }
  return g;
}
function frameCam(){
  if(!H||!H.cam) return; const k=H.opts.kit, el=k.renderer.domElement; const W=el.clientWidth||innerWidth, Hh=el.clientHeight||innerHeight;
  H.cam.aspect=W/Hh; H.portrait=Hh>W; H.cam.fov=H.portrait?74:58; H.cam.updateProjectionMatrix();
}

/* ================= menu ================= */
function toMenu(){
  H.screen='menu'; H.run=null; hideModal(H.root); resetRun(true);
  ['.sw-hud2','.sw-help','.sw-count'].forEach(s=>$(s).classList.add('hidden'));
  $('.zm-bv').textContent=H.P.best|0;
  const S=H.opts.S||{}, me=H.cmap[H.charId]||{ id:H.charId, name:'Ollie' };
  const M=$('.sw-menu'); M.classList.remove('hidden');
  M.innerHTML=`<div class="sw-card"><div class="zm-title">ENDLESS SWIMMER</div>
    <div class="zm-hero"><img src="${artSrc(H.opts, me.id)}" alt=""><div>Swim with <b>${firstName(me)}</b>!<br><small>${isTouch()?'Swipe ⬅ ➡ to switch lanes · ⬆ jump rocks · ⬇ duck jellies':'⬅ ➡ / A D switch lanes · ⬆ W Space jump · ⬇ S duck'}</small></div></div>
    <p class="zm-sub">Dodge rocks, jellies and coral. Grab the starfish! You have 3 bubble shields 🫧.</p>
    <div class="sw-stats"><div class="zm-pill">🏆 Best <b>${(H.P.best|0).toLocaleString()} m</b></div></div>
    <div class="zm-btns"><button class="zm-btn blue sw-lobby">◀ LOBBY</button><button class="zm-btn green big sw-play">SWIM! ▶</button></div></div>`;
  M.querySelector('.sw-play').onclick=()=>{ H.sfx.unlock(); H.sfx.click(); startRun(); };
  M.querySelector('.sw-lobby').onclick=()=>{ H.sfx.click(); exitToLobby(); };
}
function resetRun(idle){
  if(!H.scene) return;
  (H.obs||[]).forEach(o=>H.scene.remove(o.g)); (H.picks||[]).forEach(p=>H.scene.remove(p.g));
  H.obs=[]; H.picks=[]; H.pz=0; H.px=0; H.lane=0; H.py=0; H.vy=0; H.duckT=0; H.nextRow=-34; H.pickT=4; H.inv=0; H.fx=[];
  H.decor.forEach((d,i)=>d.position.z=-i*4.5+10);
  if(H.char){ H.char.position.set(0,0,0); H.char.scale.set(1,1,1); H.char.visible=true; }
}

/* ================= run ================= */
function startRun(){
  hideModal(H.root); resetRun(false); $('.sw-menu').classList.add('hidden'); $('.sw-hud2').classList.remove('hidden');
  H.run={ t:0, meters:0, pickups:0, speed:SPEED0, shields:SHIELDS, revived:false, paused:false, started:false, countdown:2.4 };
  H.screen='run'; updateHud();
  const help=$('.sw-help'); help.textContent=isTouch()?'Swipe ⬅ ➡ to switch lanes · ⬆ jump · ⬇ duck':'⬅ ➡ switch lanes · ⬆ jump · ⬇ duck';
  help.classList.remove('hidden'); clearTimeout(H._ht); H._ht=setTimeout(()=>H&&$('.sw-help').classList.add('hidden'), 4200);
  $('.sw-count').classList.remove('hidden'); H.sfx.whoosh();
}
function move(d){ if(!H||!H.run||H.run.paused||!H.run.started) return; const n=clamp(H.lane+d,-1,1); if(n!==H.lane){ H.lane=n; H.sfx.bounce(); } }
function jump(){ if(!H||!H.run||H.run.paused||!H.run.started) return; if(H.py<=.001){ H.vy=JUMP_V; H.duckT=0; H.sfx.shoot(); } }
function duck(){ if(!H||!H.run||H.run.paused||!H.run.started) return; H.duckT=.75; if(H.py>0) H.vy=Math.min(H.vy,-9); H.sfx.plop(); }
function onKey(e){
  if(!H) return; const c=e.code;
  if(c==='Escape'||c==='KeyP'){ if(H.screen==='run'){ H.run.paused?resume():pause(); } return; }
  if(H.screen!=='run') return;
  if(c==='ArrowLeft'||c==='KeyA') move(-1); else if(c==='ArrowRight'||c==='KeyD') move(1);
  else if(c==='ArrowUp'||c==='KeyW'||c==='Space') jump(); else if(c==='ArrowDown'||c==='KeyS') duck(); else return;
  e.preventDefault();
}
function onDown(e){ if(!H||H.screen!=='run'||e.target.closest('button,.zm-modal')) return; H.sw={ x:e.clientX, y:e.clientY, id:e.pointerId, done:false }; }
function onMove(e){ const s=H&&H.sw; if(!s||s.done||s.id!==e.pointerId) return; const dx=e.clientX-s.x, dy=e.clientY-s.y, m=Math.max(24, Math.min(innerWidth,innerHeight)*.05);
  if(Math.abs(dx)>m && Math.abs(dx)>Math.abs(dy)){ s.done=true; move(dx>0?1:-1); } else if(Math.abs(dy)>m){ s.done=true; dy<0?jump():duck(); } }
function onUp(e){ const s=H&&H.sw; if(!s||s.id!==e.pointerId) return; if(!s.done && H.screen==='run'){ jump(); } H.sw=null; }   // a plain tap = jump
function pause(){ if(!H.run||H.run.paused) return; H.run.paused=true;
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon blue">PAUSED</div><p>Take a breather! 🫧<br>${Math.floor(H.run.meters)} m so far</p>
    <div class="zm-btns"><button class="zm-btn pink" data-act="end">END RUN &amp; COLLECT</button><button class="zm-btn green big" data-act="go">KEEP SWIMMING ▶</button></div></div>`,
    { go:()=>{ H.sfx.click(); resume(); }, end:()=>{ H.sfx.click(); hideModal(H.root); endRun(); } }); }
function resume(){ if(!H.run) return; hideModal(H.root); H.run.paused=false; }
function spawnRow(z){
  const r=H.run, d=Math.min(1, r.t/150);                      // difficulty 0..1 over 2.5 minutes
  const lanes=[-1,0,1].sort(()=>Math.random()-.5), n = Math.random() < .25+.45*d ? 2 : 1;   // always at least one open lane
  for(let i=0;i<n;i++){ const lane=lanes[i], roll=Math.random(); const kind = roll<.42?'rock':roll<.74?'jelly':'coral'; addObs(kind, lane, z); }
  if(Math.random()<.07 && n===1){ const free=lanes[1+Math.floor(Math.random()*2)]; for(let i=0;i<3;i++) addPick(free, z+2-i*1.6, .9); }   // bonus trio beside it (counts in the ~20/min)
}
function addObs(kind, lane, z){
  const T=H.T; let g;
  if(kind==='rock'){ g=outlined(T, H.G.rock, pick(H.M.rock)); g.scale.set(1.05,.78,.9); g.position.y=.42; }
  else if(kind==='jelly'){ g=new T.Group(); const dome=outlined(T, H.G.dome, H.M.jelly, 1.08); g.add(dome); for(let i=0;i<5;i++){ const t=new T.Mesh(H.G.tent, H.M.tent); const a=i/5*6.28; t.position.set(Math.cos(a)*.38,-.3,Math.sin(a)*.38); g.add(t); } g.position.y=1.85; g.userData.bob=rand(0,6); }
  else { g=new T.Group(); [[-.45,1.35,.9],[.05,1.05,1.15],[.45,1.25,.85]].forEach(([x,s,h],i)=>{ const m=outlined(T, H.G.finger, H.M.coral[(i+Math.floor(rand(0,6)))%6], 1.1); m.position.set(x, 1.15*h, rand(-.2,.2)); m.scale.set(s*.9,h,s*.9); g.add(m); }); }
  g.position.x=lane*LANE; g.position.z=z; H.scene.add(g); H.obs.push({ kind, lane, z, g, hit:false });
}
function addPick(lane, z, y){ const T=H.T; const g=outlined(T, H.G.star, H.M.star, 1.14); g.position.set(lane*LANE, y, z); H.scene.add(g); H.picks.push({ lane, z, y, g, got:false }); }
function spawnPickLine(){
  const z=H.pz-46, busy=new Set(H.obs.filter(o=>Math.abs(o.z-(z-3))<10).map(o=>o.lane));
  const free=[-1,0,1].filter(l=>!busy.has(l)); const lane=free.length?pick(free):pick([-1,0,1]);
  for(let i=0;i<PICKUP_LINE;i++){ const pz=z-i*2.6, blocked=H.obs.some(o=>o.lane===lane&&Math.abs(o.z-pz)<1.6); if(!blocked) addPick(lane, pz, .9); }
}
function step(dt){
  const r=H.run, k=H.opts.kit;
  if(!r.started){ r.countdown-=dt; const n=Math.ceil(r.countdown-0.4); $('.sw-count').textContent=n>0?n:'GO!'; if(r.countdown<=0){ r.started=true; $('.sw-count').classList.add('hidden'); H.sfx.coin(); } return; }
  r.t+=dt; r.speed=Math.min(SPEED_MAX, r.speed+SPEED_UP*dt); if(H.inv>0) H.inv-=dt;
  const ds=r.speed*dt; H.pz-=ds; r.meters+=ds;
  // lanes, jump, duck
  H.px+= (H.lane*LANE-H.px)*Math.min(1, dt*12);
  if(H.py>0||H.vy>0){ H.vy-=GRAV*dt; H.py+=H.vy*dt; if(H.py<=0){ H.py=0; H.vy=0; } }
  H.duckT=Math.max(0,H.duckT-dt);
  // spawn
  while(H.nextRow > H.pz-60){ spawnRow(H.nextRow); H.nextRow -= Math.max(11, 22 - r.speed*.45) * rand(.9,1.25); }
  H.pickT-=dt; if(H.pickT<=0){ H.pickT=PICKUP_EVERY*rand(.85,1.15); spawnPickLine(); }
  if(H.auto) autopilot();
  // collisions
  const ducking=H.duckT>0 && H.py<.05;
  for(const o of H.obs){ if(o.hit) continue; const dz=Math.abs(o.z-H.pz); if(dz>.8 || Math.abs(o.lane*LANE-H.px)>1.1) continue;
    const hit = o.kind==='rock' ? H.py<.62 : o.kind==='jelly' ? !ducking : true;
    if(hit){ o.hit=true; if(H.inv<=0) bonk(o); } }
  for(const p of H.picks){ if(p.got) continue; if(Math.abs(p.z-H.pz)<1 && Math.abs(p.lane*LANE-H.px)<1 && Math.abs(p.y-(H.py+.9))<1.3){ p.got=true; r.pickups++; H.sfx.star(r.pickups); p.g.visible=false; } }
  // recycle
  H.obs=H.obs.filter(o=>{ if(o.z>H.pz+8){ H.scene.remove(o.g); return false; } return true; });
  H.picks=H.picks.filter(p=>{ if(p.z>H.pz+8||p.got){ H.scene.remove(p.g); return false; } return true; });
  updateHud();
}
function bonk(o){
  const r=H.run; r.shields--; H.inv=1.6; r.speed=Math.max(SPEED0, r.speed*.8); H.sfx.bonk(); const k=H.opts.kit; try{ k.triggerAnim(H.char,'tap'); }catch(e){}
  toast(H.root, o.kind==='jelly'?'Squish! Duck under jellies ⬇':o.kind==='rock'?'Bonk! Jump over rocks ⬆':'Oops! Swim around coral ⬅ ➡', 1500);
  if(r.shields<=0){
    if(!r.revived){ r.paused=true; showModal(H.root, `<div class="zm-card"><div class="zm-ribbon pink">OOPS!</div><p>Out of bubble shields — but you can keep going!<br><b>${Math.floor(r.meters)} m</b> so far</p>
      <div class="zm-btns"><button class="zm-btn blue" data-act="end">FINISH</button><button class="zm-btn green big" data-act="go">🫧 KEEP SWIMMING (free)</button></div></div>`,
      { go:()=>{ H.sfx.click(); r.revived=true; r.shields=1; H.inv=2; resume(); }, end:()=>{ H.sfx.click(); hideModal(H.root); endRun(); } }); }
    else endRun();
  }
}
function autopilot(){   // test hook only (window.__oceanSwim.H.auto = true): reads the lanes ahead like a careful kid
  const ahead=H.obs.filter(o=>!o.hit && o.z<H.pz && o.z>H.pz-H.run.speed*.9);
  const blocked=l=>ahead.some(o=>o.lane===l);
  const mine=ahead.filter(o=>o.lane===H.lane).sort((a,b)=>b.z-a.z)[0];
  if(!mine) return;
  const free=[-1,0,1].filter(l=>!blocked(l)).sort((a,b)=>Math.abs(a-H.lane)-Math.abs(b-H.lane))[0];
  if(free!==undefined && Math.abs(free-H.lane)===1) return move(free-H.lane);
  if(free!==undefined) return move(Math.sign(free-H.lane));
  if(mine.kind==='rock' && H.pz-mine.z<H.run.speed*.32) jump(); else if(mine.kind==='jelly') duck();
}
function updateHud(){
  const r=H.run; if(!r) return; const m=Math.floor(r.meters);
  if(m!==H._m){ H._m=m; $('.zm-bv').textContent=m.toLocaleString(); }
  const sh='🫧'.repeat(Math.max(0,r.shields))+'<i>'+'🫧'.repeat(Math.max(0,SHIELDS-r.shields))+'</i>'; if(sh!==H._sh){ H._sh=sh; $('.sw-shields').innerHTML=sh; }
  const live=swPayout(r.pickups, r.meters, false).run; if(live!==H._live){ H._live=live; $('.sw-earn b').textContent='+'+live; if(live) $('.sw-earn').classList.remove('pulse'), void $('.sw-earn').offsetWidth, $('.sw-earn').classList.add('pulse'); }
}

/* ================= end of run: pay + results ================= */
function endRun(){
  const r=H.run; if(!r||H.screen!=='run') return; H.screen='results'; r.paused=true;
  const P=H.P, meters=Math.floor(r.meters), newBest=meters>0 && meters>(P.best|0), bestPays=newBest && r.t>=SW_BEST_MIN_SECONDS;
  P.runs=(P.runs|0)+1; P.meters=(P.meters|0)+meters; P.pickups=(P.pickups|0)+r.pickups; if(newBest) P.best=meters; P.tutorial=1; writeSave(SAVE_KEY, P);
  const pay=swPayout(r.pickups, meters, bestPays), countsWin=r.t>=SW_WIN_MIN_SECONDS;
  const { earned, win }=creditStarfish(H.opts, pay.total, countsWin);
  refreshCoins();
  if(typeof H.opts.lb==='function' && P.best>0){ try{ H.opts.lb('swim', P.best|0); }catch(e){} }
  try{ H.opts.kit.triggerAnim(H.char, 'happy'); }catch(e){}
  $('.sw-hud2').classList.add('hidden'); $('.sw-help').classList.add('hidden');
  const secs=Math.floor(r.t);
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon">GREAT SWIM!</div>
    <div class="zm-big">${meters.toLocaleString()} m</div>
    <p>${newBest?'<b style="color:#2fb33a">NEW BEST DISTANCE!</b>':`Best ${(P.best|0).toLocaleString()} m`} · ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')} swim</p>
    ${payHtml([[ `⭐ ${r.pickups} starfish picked up ÷ ${SW_PICKUPS_PER_STARFISH}`, pay.fromPickups ], [ `📏 ${meters.toLocaleString()} m ÷ ${SW_METERS_PER_STARFISH}`, pay.fromMeters ], pay.capped?[ `Run max is ${SW_RUN_CAP}`, '✔' ]:null, bestPays?[ '🏆 New best distance', pay.best, 'new' ]:newBest?[ `🏆 New best! (bonus on ${SW_BEST_MIN_SECONDS}s+ swims)`, '—' ]:null], earned)}
    ${chestHtml(countsWin, win, `Swim ${SW_WIN_MIN_SECONDS}+ seconds to count toward a chest.`)}
    <div class="zm-btns"><button class="zm-btn blue" data-act="lobby">◀ LOBBY</button><button class="zm-btn green big" data-act="again">SWIM AGAIN ▶</button></div></div>`,
    { lobby:()=>{ H.sfx.click(); exitToLobby(); }, again:()=>{ H.sfx.click(); startRun(); } });
  H.sfx.win(); if(earned) confetti(H.root);
  H.lastResult={ meters, pickups:r.pickups, secs:r.t, newBest, bestPays, pay, earned, countsWin, win };
}

/* ================= loop ================= */
function loop(now){
  if(!H) return; H.raf=requestAnimationFrame(loop);
  let dt=Math.min(.05,(now-H.last)/1000)*H.timeScale; H.last=now; H.t+=dt;
  const r=H.run;
  if(r && H.screen==='run' && !r.paused){ while(dt>0 && H.run && H.screen==='run' && !H.run.paused){ const s=Math.min(dt,1/60); step(s); dt-=s; } }
  render(Math.min(.05,(now-(H._lr||now))/1000)); H._lr=now;
}
function render(dt){
  const k=H.opts.kit; if(!k||!H.scene) return; const t=H.t, r=H.run;
  // floor + path snap forward (texture period 15 m / 3 m)
  H.floor.position.z=Math.round(H.pz/15)*15-70; H.path.position.z=Math.round(H.pz/3)*3-70;
  for(const d of H.decor){ if(d.position.z>H.pz+12){ d.position.z-=44*4.5; d.position.x=d.userData.side*rand(5.2,12); } d.children.forEach(m=>{ if(m.userData.sway!=null) m.rotation.z=Math.sin(t*1.4+m.userData.sway)*.12; }); }
  for(const o of H.obs) if(o.kind==='jelly'){ o.g.position.y=1.85+Math.sin(t*2.4+o.g.userData.bob)*.12; o.g.scale.y=1+Math.sin(t*4+o.g.userData.bob)*.08; }
  for(const p of H.picks){ p.g.rotation.y=t*3+p.z; p.g.position.y=p.y+Math.sin(t*3+p.z)*.08; }
  const bp=H.bubbles.geometry.attributes.position, a=bp.array; for(let i=0;i<a.length;i+=3){ a[i+1]+=dt*1.2; if(a[i+1]>9) a[i+1]=0; if(a[i+2]>H.pz+8) a[i+2]-=68; } bp.needsUpdate=true;
  if(H.char){ const o=H.char, running=r&&r.started&&!r.paused&&H.screen==='run';
    o.position.set(H.px, H.py, H.pz); o.rotation.z=(H.lane*LANE-H.px)*-.12; o.rotation.y=Math.PI;
    const sq = H.duckT>0&&H.py<.05 ? .55 : 1; o.scale.y += (sq-o.scale.y)*Math.min(1,dt*18);
    o.visible = !(H.inv>0 && Math.floor(H.inv*10)%2===0);
    try{ k.animateChar(o, !r||H.screen!=='run'? (H.screen==='results'?'happy':'idle') : !running? 'idle' : H.py>0? 'air' : 'move', running? Math.min(9, r.speed*.6) : 0, dt, t); k.tickAccessories && k.tickAccessories(o, dt, t); }catch(e){}
    if(H.screen==='menu') o.rotation.y=Math.sin(t*.6)*.35;   // menu: face the camera and sway
  }
  if(H.key){ H.key.position.set(H.px+5, 14, H.pz+9); H.key.target.position.set(H.px, 0, H.pz-3); H.key.target.updateMatrixWorld(); }
  const c=H.cam, menu=H.screen==='menu';
  if(menu){ c.position.set(0, 2.1, H.pz+(H.portrait?6.6:5.2)); c.lookAt(H.portrait?0:1.7, H.portrait?.35:1.15, H.pz); }
  else { const back=H.portrait?7.4:6.2, up=H.portrait?4.4:3.4; c.position.set(H.px*.55, up+H.py*.3, H.pz+back); c.lookAt(H.px*.55, 1.1, H.pz-7); }
  try{ k.renderer.render(H.scene, c); }catch(e){ if(!H._warned){ H._warned=true; console.warn('swim render', e); } }
}
