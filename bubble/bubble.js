/* Bubble Pop — ZKIDZ mini game. Aim and shoot ocean bubbles; match 3+ of a color to pop them.
 * Floating groups fall, and the ceiling drops after missed shots (from level 4). 15 story levels + endless waves.
 *   import { openBubble } from './bubble/bubble.js';
 *   openBubble({ ECO, S, save, artUrl, chars, kit, sfxOn, onWin, onExit, lb });
 * Own save key: zkidz_bubble_v1. Leaderboard mode: 'bubble' (endless pops). */
import { INK, clamp, rand, pick, firstName, injectCss, loadSave, writeSave, makeSfx, creditStarfish, payHtml, chestHtml, starsHtml, showModal, hideModal, toast, confetti, topBar, charMap, artSrc } from '../mini/mini.js?v=20261124-3';
import { STORY_LEVELS, COLS, DANGER_ROW, levelConfig, ENDLESS, shapeHas } from './levels.js?v=20261124-3';
import { drawBgSwim } from '../bgswim/bgswim.js?v=20261124-6';

/* ================= ECONOMY — APPROVED by Zander (Zokenomics' Bubble Pop numbers) ================= */
export const BP_FIRST_CLEAR       = 36;  // first time you clear a story level
export const BP_REPLAY            = 15;  // clearing a level you already beat
export const BP_THREE_STAR_BONUS  = 8;   // once per level, the first time you earn 3 stars
export const BP_ENDLESS_PER_WAVE  = 5;   // per completed endless wave
export const BP_ENDLESS_CAP       = 50;  // endless wave pay never more than this per run
export const BP_WIN_MIN_SECONDS   = 45;  // endless Play-chest win only if the run lasted >= 45 s
export const BP_WIN_MIN_WAVES     = 2;   // …and at least 2 waves were completed
/* Paid through ECO.ensureDay + ECO.cardsEarn (no daily caps). No Treasure chests, no Legendary/Cosmic pity.
   Retries never cost Starfish. A story clear (first or replay) counts as a Play-chest win.
   Star ratings (not a prize change): par = max(6, ceil(starting bubbles × 0.7) + 5);
   3★ if shots ≤ par, 2★ if shots ≤ par + 7, 1★ for any clear. */
export function bpBudget(n){ return Math.max(6, Math.ceil(Math.max(0,n|0)*0.7)+5); }
export function bpStars(shots, budget){ const s=shots|0, b=budget|0; return s<=b?3:s<=b+7?2:1; }
export function bpStoryPay(first, threeStarBonus){
  const clear=first?BP_FIRST_CLEAR:BP_REPLAY, bonus=threeStarBonus?BP_THREE_STAR_BONUS:0;
  return { clear, bonus, first:!!first, total:clear+bonus };
}
export function bpEndlessPay(waves){
  const raw=Math.max(0,waves|0)*BP_ENDLESS_PER_WAVE, run=Math.min(BP_ENDLESS_CAP, raw);
  return { waves:Math.max(0,waves|0), per:BP_ENDLESS_PER_WAVE, capped:raw>BP_ENDLESS_CAP, total:run };
}
export function bpScore(pops){ return Math.max(0, pops|0); }   // leaderboard ranks endless pops, higher is better

const SAVE_KEY='zkidz_bubble_v1';
const DEFAULTS={ v:1, stars:Array(STORY_LEVELS).fill(0), paid3:Array(STORY_LEVELS).fill(0), best:0, bestWaves:0, runs:0, clears:0, tutorial:0 };
const COLORS=['#2bc0ff','#ff4f6d','#5be04a','#ffd52e','#b07aff','#ff9a3c'];
const SQRT3=Math.sqrt(3), MATCH=3, AIM_PAD=.22, SHOT_V=26, RESOLVE_MS=280;
let H=null;

function rng(seed){ let a=seed|0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function loadP(){
  const P=loadSave(SAVE_KEY, DEFAULTS);
  const arr=(v,n,max)=>Array.from({length:n},(_,i)=>clamp(Array.isArray(v)?(v[i]|0):0,0,max));
  P.stars=arr(P.stars, STORY_LEVELS, 3); P.paid3=arr(P.paid3, STORY_LEVELS, 1);
  return P;
}
function saveP(){ if(H) writeSave(SAVE_KEY, H.P); }

/* ================= public API ================= */
export function openBubble(opts={}){
  if(H) closeBubble();
  if(!opts.noCss){ injectCss('zkMiniCss','../mini/mini.css', import.meta.url); injectCss('oceanBubbleCss','./bubble.css', import.meta.url); }
  const root=document.createElement('div'); root.id='oceanBubble'; root.className='zmini';
  root.innerHTML=`<canvas class="zm-cv bp-cv"></canvas>
    ${topBar({ badge:'LEVEL', badgeVal:'1', badgeCls:'pink', extra:`<div class="zm-pill bp-shots hidden">🎯 <b>0</b></div><div class="zm-pill bp-score hidden">⭐ <b>0</b></div>` })}
    <div class="bp-hud2 hidden"><div class="zm-pill bp-next"><i></i><small>NEXT</small></div><div class="zm-pill bp-push hidden"></div></div>
    <div class="bp-help hidden"></div>
    <div class="zm-menu bp-menu hidden"></div>
    <div class="zm-modal hidden"></div><div class="zm-toast"></div>`;
  document.body.appendChild(root);
  H={ opts, root, P:loadP(), cmap:charMap(opts), muted:false, screen:'menu', raf:0, last:performance.now(), t:0,
      cv:root.querySelector('.bp-cv'), cx:null, vw:800, vh:600, dpr:1, run:null, fx:[], drift:[], weeds:[], weedKey:'', aim:-Math.PI/2, aiming:false, reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches };
  H.cx=H.cv.getContext('2d');
  H.sfx=makeSfx(()=>!H.muted && (typeof opts.sfxOn==='function' ? opts.sfxOn() : !(opts.S && opts.S.music===false)));
  root.addEventListener('pointerdown', ()=>H&&H.sfx.unlock(), {passive:true, capture:true});
  root.querySelector('.zm-back').onclick=()=>{ H.sfx.click(); if(H.screen==='play') pause(); else if(H.screen==='menu') exitToLobby(); };
  root.querySelector('.zm-snd').onclick=e=>{ H.muted=!H.muted; e.currentTarget.textContent=H.muted?'🔇':'🔊'; if(!H.muted){ H.sfx.unlock(); H.sfx.click(); } };
  root.querySelector('.bp-next').onclick=()=>{ H.sfx.unlock(); swap(); };
  H.cv.addEventListener('pointerdown', onDown);
  H.cv.addEventListener('pointermove', onMove);
  H.cv.addEventListener('pointerup', onUp);
  H.cv.addEventListener('pointercancel', onUp);
  H._key=e=>onKey(e); addEventListener('keydown', H._key);
  H._rs=()=>fit(); addEventListener('resize', H._rs); if(window.visualViewport) visualViewport.addEventListener('resize', H._rs);
  try{ document.fonts && document.fonts.load(`20px 'Lilita One'`); }catch(e){}
  seedDrift(); fit(); refreshCoins(); toMenu();
  H.raf=requestAnimationFrame(loop);
  window.__bubblePop={ _owned:true, get H(){ return H; }, startLevel, startEndless, fire, swap, winNow, loseNow, finishNow, poseAim,
    bpStoryPay, bpEndlessPay, bpStars, bpBudget, bpScore,
    consts:{ BP_FIRST_CLEAR, BP_REPLAY, BP_THREE_STAR_BONUS, BP_ENDLESS_PER_WAVE, BP_ENDLESS_CAP, BP_WIN_MIN_SECONDS, BP_WIN_MIN_WAVES, STORY_LEVELS, COLS, DANGER_ROW } };
  return { close:closeBubble };
}
export function closeBubble(){
  if(!H) return;
  cancelAnimationFrame(H.raf); removeEventListener('keydown', H._key); removeEventListener('resize', H._rs);
  if(window.visualViewport) visualViewport.removeEventListener('resize', H._rs);
  disposeBpFig();
  if(H.root.parentNode) H.root.parentNode.removeChild(H.root);
  if(window.__bubblePop && window.__bubblePop._owned) window.__bubblePop=null;
  H=null;
}
function exitToLobby(){ const cb=H&&H.opts.onExit; closeBubble(); if(typeof cb==='function') cb(); }
const $=s=>H.root.querySelector(s);
function refreshCoins(){ const S=H.opts.S; H.root.querySelectorAll('.zm-coins').forEach(e=>e.textContent=(S?S.coins:0).toLocaleString()); }
function isTouch(){ return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; }

/* ================= menu ================= */
function toMenu(){
  H.screen='menu'; H.run=null; H.shot=null; hideModal(H.root);
  ['.bp-shots','.bp-score','.bp-hud2','.bp-help'].forEach(s=>$(s).classList.add('hidden'));
  $('.zm-badge small').textContent='BEST'; $('.zm-bv').textContent=(H.P.best|0).toLocaleString();
  const S=H.opts.S||{}, me=H.cmap[S.selChar||'ollie']||{ id:'ollie', name:'Ollie' };
  const next=firstOpen();
  const cells=Array.from({length:STORY_LEVELS},(_,i)=>{
    const n=i+1, st=H.P.stars[i]|0, open=n===1||(H.P.stars[i-1]|0)>0;
    const stars=open?`<span class="zm-s">${[0,1,2].map(j=>`<i class="${j<st?'on':''}">★</i>`).join('')}</span>`:'';
    return `<button class="zm-btn zm-lv ${!open?'lock gray':st?'green':n===next?'yellow cur':'blue'}" data-lv="${n}" ${open?'':'disabled'} aria-label="Level ${n}">${open?n:'🔒'}${stars}</button>`;
  }).join('');
  const M=$('.bp-menu'); M.classList.remove('hidden');
  M.innerHTML=`<div class="zm-title">BUBBLE POP</div>
    <div class="zm-hero"><img src="${artSrc(H.opts, me.id)}" alt=""><div>Pop matching colors with <b>${firstName(me)}</b>!<br><small>${isTouch()?'Drag to aim, let go to shoot. Tap NEXT to swap the next bubble.':'Drag or ← → to aim, Space / ↑ to shoot, ↓ to swap.'}</small></div></div>
    <p class="zm-sub">Match 3 or more. Loose bubbles fall. Don't let them reach the sand!</p>
    <div class="zm-grid">${cells}</div>
    <button class="zm-btn pink big zm-endless" data-act="endless">🌊 ENDLESS WAVES <small>Best ${(H.P.best|0).toLocaleString()}</small></button>
    <div class="zm-btns"><button class="zm-btn blue bp-lobby">◀ LOBBY</button></div>`;
  M.querySelectorAll('.zm-lv').forEach(b=>b.onclick=()=>{ H.sfx.unlock(); H.sfx.click(); startLevel(+b.dataset.lv); });
  M.querySelector('.zm-endless').onclick=()=>{ H.sfx.unlock(); H.sfx.click(); startEndless(); };
  M.querySelector('.bp-lobby').onclick=()=>{ H.sfx.click(); exitToLobby(); };
}
function firstOpen(){ for(let i=0;i<STORY_LEVELS;i++){ if((H.P.stars[i]|0)===0 && (i===0||(H.P.stars[i-1]|0)>0)) return i+1; } return STORY_LEVELS; }

/* ================= run ================= */
function startLevel(n){
  const cfg=levelConfig(n);
  beginRun({ mode:'story', level:n, cfg, colors:cfg.colors, push:cfg.push, rows:cfg.rows, seed:cfg.seed });
  buildStory(H.run);
  afterBuild();
}
function startEndless(){
  const cfg=ENDLESS;
  beginRun({ mode:'endless', level:0, cfg, colors:cfg.colors, push:cfg.pushBase, rows:cfg.rows, seed:(Math.random()*1e9)|0 });
  buildRows(H.run, cfg.rows, cfg.shape||'full');
  afterBuild();
}
function beginRun(base){
  hideModal(H.root); $('.bp-menu').classList.add('hidden');
  H.run={ t:0, shots:0, pops:0, wave:1, wavePops:0, misses:0, shift:0, busy:0, ended:false, paused:false,
          stagger:0, cells:emptyGrid(), cur:-1, nxt:-1, startN:0, budget:0, ...base };
  H.shot=null; H.fx=[]; H.aim=-Math.PI/2; H.screen='play';
  $('.zm-badge small').textContent=H.run.mode==='endless'?'WAVE':'LEVEL';
  $('.bp-shots').classList.remove('hidden');
  $('.bp-score').classList.toggle('hidden', H.run.mode!=='endless');
  $('.bp-hud2').classList.remove('hidden');
  updateHud();
  const help=$('.bp-help');
  if(!H.P.tutorial){ help.textContent=isTouch()?'Drag to aim, let go to shoot! Match 3 or more.':'← → aim · Space shoot · ↓ swap'; help.classList.remove('hidden'); }
  else help.classList.add('hidden');
}
function afterBuild(){
  const r=H.run; r.startN=countAll(); r.budget=bpBudget(r.startN); refillAmmo(true); updateHud(); fit();
}
function emptyGrid(){ return Array.from({length:DANGER_ROW+3},()=>Array(COLS).fill(-1)); }
function colsIn(r, st=H.run.stagger){ return ((r+st)&1)?COLS-1:COLS; }
function get(r,c){ const g=H.run&&H.run.cells; if(!g||r<0||c<0||r>=g.length||c>=COLS) return -1; return g[r][c]; }
function set(r,c,v){ const g=H.run.cells; if(r>=0&&c>=0&&r<g.length&&c<COLS) g[r][c]=v; }
function neighbors(r,c,st=H.run.stagger){
  const odd=(r+st)&1, out=[];
  const add=(rr,cc)=>{ if(rr<0||cc<0||cc>=colsIn(rr,st)||rr>=DANGER_ROW+3) return; out.push([rr,cc]); };
  add(r,c-1); add(r,c+1);
  if(odd){ add(r-1,c); add(r-1,c+1); add(r+1,c); add(r+1,c+1); }
  else { add(r-1,c-1); add(r-1,c); add(r+1,c-1); add(r+1,c); }
  return out;
}
function cellPos(r,c,st,shift){
  const L=H.lay, odd=(r+(st??H.run.stagger))&1;
  const x=L.ox + (odd?L.R:0) + c*2*L.R;
  const y=L.oy + (r+(shift??H.run.shift))*L.R*SQRT3;
  return [x,y];
}
function countAll(){ let n=0; eachCell(()=>{ n++; }); return n; }
function eachCell(fn){ const g=H.run.cells; for(let r=0;r<g.length;r++) for(let c=0;c<COLS;c++) if(g[r][c]>=0) fn(r,c,g[r][c]); }
function colorsOnBoard(){ const s=new Set(); eachCell((r,c,v)=>s.add(v)); return [...s]; }
function buildStory(run){
  const cfg=run.cfg, R=rng(cfg.seed);
  run.stagger=0; run.cells=emptyGrid();
  for(let r=0;r<cfg.rows;r++){
    const n=colsIn(r,0);
    for(let c=0;c<n;c++){
      if(!shapeHas(cfg.shape, r, c, COLS, cfg.rows)) continue;
      let col=-1;
      if(R()<cfg.cluster){ const ns=neighbors(r,c,0).filter(([rr,cc])=>get(rr,cc)>=0); if(ns.length){ const p=ns[Math.floor(R()*ns.length)]; col=get(p[0],p[1]); } }
      if(col<0) col=Math.floor(R()*cfg.colors);
      set(r,c,col);
    }
  }
}
function buildRows(run, rows, shape='full'){
  const R=rng(run.seed); run.stagger=0; run.cells=emptyGrid();
  for(let r=0;r<rows;r++){
    const n=colsIn(r,0);
    for(let c=0;c<n;c++){
      if(shape!=='full' && !shapeHas(shape,r,c,COLS,rows)) continue;
      let col=-1;
      if(R()<.5){ const ns=neighbors(r,c,0).filter(([rr,cc])=>get(rr,cc)>=0); if(ns.length) col=get(...pick(ns)); }
      if(col<0) col=Math.floor(R()*run.colors);
      set(r,c,col);
    }
  }
}
function refillAmmo(force){
  const r=H.run, live=colorsOnBoard();
  const pickC=()=> live.length? live[(Math.random()*live.length)|0] : (Math.random()*r.colors)|0;
  if(force||r.cur<0||!live.includes(r.cur)) r.cur=pickC();
  if(force||r.nxt<0||!live.includes(r.nxt)) r.nxt=pickC();
}
function swap(){ if(!H||!H.run||H.run.busy||H.run.paused||H.shot) return; const r=H.run; const t=r.cur; r.cur=r.nxt; r.nxt=t; H.sfx.bounce(); updateHud(); }

/* ================= shooting ================= */
function clampAim(a){ return clamp(a, -Math.PI+AIM_PAD, -AIM_PAD); }
function muzzle(){ const L=H.lay; return [L.sx + Math.cos(H.aim)*L.R*1.35, L.sy + Math.sin(H.aim)*L.R*1.35]; }
function fire(a){
  if(!H||H.screen!=='play'||!H.run||H.run.busy||H.run.paused||H.run.ended||H.shot) return false;
  H.aim=clampAim(a==null?H.aim:a); const [x,y]=muzzle(); const r=H.run;
  if(!H.P.tutorial){ H.P.tutorial=1; saveP(); $('.bp-help').classList.add('hidden'); }
  H.shot={ x, y, vx:Math.cos(H.aim)*H.lay.R*SHOT_V, vy:Math.sin(H.aim)*H.lay.R*SHOT_V, color:r.cur };
  r.cur=r.nxt; r.nxt=-1; refillAmmo(false); r.shots++; H.sfx.shoot(); updateHud(); return true;
}
function stepShot(dt){
  const s=H.shot, L=H.lay; if(!s) return;
  const step=Math.max(6, L.R/3), dist=Math.hypot(s.vx,s.vy)*dt, n=Math.max(1, Math.ceil(dist/step));
  const dx=s.vx*dt/n, dy=s.vy*dt/n;
  for(let i=0;i<n;i++){
    s.x+=dx; s.y+=dy;
    if(s.x-L.R<=L.left){ s.x=L.left+L.R; s.vx=Math.abs(s.vx); H.sfx.bounce(); }
    if(s.x+L.R>=L.right){ s.x=L.right-L.R; s.vx=-Math.abs(s.vx); H.sfx.bounce(); }
    if(s.y-L.R<=L.ceil){ landCeiling(); return; }
    if(hitGrid()) return;
    if(s.y>L.sy+L.R*2){ H.shot=null; return; } // safety
  }
}
function hitGrid(){
  const s=H.shot, L=H.lay, lim=L.R*1.92; let best=null, bd=lim;
  eachCell((r,c)=>{ const [x,y]=cellPos(r,c); const d=Math.hypot(s.x-x,s.y-y); if(d<bd){ bd=d; best=[r,c]; } });
  if(!best) return false; snapTo(best[0], best[1]); return true;
}
function landCeiling(){
  const s=H.shot; let best=null, bd=1e9;
  for(let c=0;c<colsIn(0);c++) if(get(0,c)<0){ const [x,y]=cellPos(0,c); const d=Math.hypot(s.x-x,s.y-y); if(d<bd){ bd=d; best=c; } }
  if(best==null){ snapAny(); return; }
  place(0,best,s.color);
}
function snapTo(hr,hc){
  const s=H.shot; let best=null, bd=1e9;
  const cand=neighbors(hr,hc).filter(([r,c])=>get(r,c)<0 && r>=0);
  (cand.length?cand:allEmptyNear()).forEach(([r,c])=>{ const [x,y]=cellPos(r,c); const d=Math.hypot(s.x-x,s.y-y); if(d<bd){ bd=d; best=[r,c]; } });
  if(!best){ snapAny(); return; }
  place(best[0], best[1], s.color);
}
function allEmptyNear(){
  const out=[];
  eachCell((r,c)=>neighbors(r,c).forEach(([rr,cc])=>{ if(get(rr,cc)<0 && rr>=0) out.push([rr,cc]); }));
  if(!out.length){ for(let c=0;c<colsIn(0);c++) if(get(0,c)<0) out.push([0,c]); }
  return out;
}
function snapAny(){ const s=H.shot; let best=null, bd=1e9; allEmptyNear().forEach(([r,c])=>{ const [x,y]=cellPos(r,c); const d=Math.hypot(s.x-x,s.y-y); if(d<bd){ bd=d; best=[r,c]; } }); if(best) place(best[0],best[1],s.color); else { H.shot=null; } }
function place(r,c,color){
  H.shot=null; if(get(r,c)>=0){ const n=allEmptyNear(); if(!n.length){ endLose(); return; } [r,c]=n[0]; }
  set(r,c,color); H.sfx.plop(); resolve(r,c);
}

/* ================= resolve matches / drops / ceiling ================= */
function groupAt(r,c){
  const col=get(r,c); if(col<0) return [];
  const seen=new Set(), out=[], st=[ [r,c] ]; seen.add(r+','+c);
  while(st.length){ const [rr,cc]=st.pop(); out.push([rr,cc]);
    neighbors(rr,cc).forEach(([a,b])=>{ const k=a+','+b; if(!seen.has(k)&&get(a,b)===col){ seen.add(k); st.push([a,b]); } }); }
  return out;
}
function hanging(){
  const seen=new Set(), st=[];
  for(let c=0;c<colsIn(0);c++) if(get(0,c)>=0){ st.push([0,c]); seen.add('0,'+c); }
  while(st.length){ const [r,c]=st.pop(); neighbors(r,c).forEach(([a,b])=>{ const k=a+','+b; if(!seen.has(k)&&get(a,b)>=0){ seen.add(k); st.push([a,b]); } }); }
  const drop=[]; eachCell((r,c,v)=>{ if(!seen.has(r+','+c)) drop.push([r,c,v]); });
  return drop;
}
function resolve(sr,sc){
  const r=H.run, g=groupAt(sr,sc);
  const popped=g.length>=MATCH ? g : [];
  if(popped.length){ popped.forEach(([rr,cc],i)=>burst(rr,cc,get(rr,cc),i)); popped.forEach(([rr,cc])=>set(rr,cc,-1)); }
  const drop=hanging();
  drop.forEach(([rr,cc,v],i)=>{ set(rr,cc,-1); fallFx(rr,cc,v,i); });
  const n=popped.length+drop.length;
  if(n){ r.pops+=n; r.misses=0; r.wavePops+=n; if(n>=8) toast(H.root,'REEF RUSH!',1100); else if(n>=5) toast(H.root,'SUPER!',900); else if(popped.length>=3) toast(H.root,'NICE!',700);
    if(r.mode==='endless'){ while(r.wavePops>=ENDLESS.wavePops){ r.wavePops-=ENDLESS.wavePops; r.wave++; onWave(); } } }
  else { r.misses++; if(r.push>0 && r.misses>=r.push){ r.misses=0; pushRow(); } }
  refillAmmo(false); updateHud();
  r.busy=RESOLVE_MS/1000;
  if(crossedDanger()){ r.busy=.35; H._after=endLose; }
  else if(countAll()===0){ r.busy=.4; H._after = r.mode==='endless' ? refillEndless : endWin; }
}
function refillEndless(){
  const r=H.run; if(!r||r.ended) return;
  r.wave++; r.wavePops=0; onWave();
  r.rows=Math.min(6, ENDLESS.rows+1); r.seed=(r.seed+r.wave*997)|0;
  buildRows(r, r.rows, 'full'); refillAmmo(true); updateHud();
}
function burst(r,c,col,i){
  const [x,y]=cellPos(r,c);
  H.fx.push({ typ:'pop', x, y, col, t:0, life:.38, delay:i*.02 });
  for(let k=0;k<7;k++) H.fx.push({ typ:'bit', x, y, vx:rand(-1,1)*H.lay.R*6, vy:rand(-1.2,.2)*H.lay.R*6, col, t:0, life:.45+rand(0,.2) });
  H.sfx.pop(i);
}
function fallFx(r,c,col,i){
  const [x,y]=cellPos(r,c);
  H.fx.push({ typ:'fall', x, y, col, t:0, life:.7, delay:i*.03, vy:0 });
  H.sfx.ding(Math.min(i,7));
}
function pushRow(){
  const r=H.run, g=r.cells, next=emptyGrid(), R=rng((r.seed||1)+r.shots*17+r.wave*91);
  r.stagger^=1;
  for(let rr=0;rr<g.length-1;rr++) for(let c=0;c<COLS;c++) if(g[rr][c]>=0) next[rr+1][c]=g[rr][c];
  const n=colsIn(0,r.stagger);
  for(let c=0;c<n;c++){
    let col=-1;
    if(R()<.45){ const ns=neighbors(0,c,r.stagger).filter(([a,b])=>next[a]&&next[a][b]>=0); if(ns.length) col=next[ns[0][0]][ns[0][1]]; }
    if(col<0) col=Math.floor(R()*r.colors);
    next[0][c]=col;
  }
  r.cells=next; r.shift=-1; // animate down into place
  H.sfx.whoosh(); toast(H.root,'Here come more bubbles!',900);
}
function onWave(){
  const r=H.run; H.sfx.win && H.sfx.ding(r.wave);
  r.colors=Math.min(6, ENDLESS.colors + Math.floor((r.wave-1)/2));
  r.push=Math.max(3, ENDLESS.pushBase - Math.floor((r.wave-1)/3));
  toast(H.root,`WAVE ${r.wave}!`,1200);
  updateHud();
}
function crossedDanger(){ let hit=false; eachCell((r)=>{ if(r>=DANGER_ROW) hit=true; }); return hit; }

/* ================= end / pay ================= */
function endWin(){ if(!H||!H.run||H.run.ended) return; const r=H.run; r.ended=true; r.busy=0;
  $('.bp-hud2').classList.add('hidden');
  if(r.mode==='endless'){ endEndless(false); return; }
  const first=!(H.P.stars[r.level-1]|0), stars=bpStars(r.shots, r.budget), already3=!!(H.P.paid3[r.level-1]|0);
  const bonus=!already3 && stars===3; if(stars>(H.P.stars[r.level-1]|0)) H.P.stars[r.level-1]=stars;
  if(bonus) H.P.paid3[r.level-1]=1; H.P.clears++; H.P.runs++; saveP();
  const pay=bpStoryPay(first, bonus), countsWin=true;
  const { earned, win }=creditStarfish(H.opts, pay.total, countsWin);
  refreshCoins(); confetti(H.root, 28+stars*8); H.sfx.win();
  H.lastResult={ mode:'story', level:r.level, stars, first, bonus, shots:r.shots, budget:r.budget, earned, countsWin, pay };
  const more=r.level<STORY_LEVELS;
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon">${first?'LEVEL CLEAR!':'CLEARED AGAIN!'}</div>
    ${starsHtml(stars)}<p>Level ${r.level} · ${r.shots} shot${r.shots===1?'':'s'} <small>(par ${r.budget})</small></p>
    ${payHtml([[ first?'🎉 First clear':`♻️ Replay · Level ${r.level}`, pay.clear ], bonus?['⭐ First 3-star bonus', pay.bonus, 'new']:null ], earned)}
    ${chestHtml(true, win, '')}
    <div class="zm-btns"><button class="zm-btn blue" data-act="menu">LEVELS</button>${more?`<button class="zm-btn green big" data-act="next">LEVEL ${r.level+1} ▶</button>`:`<button class="zm-btn pink big" data-act="endless">ENDLESS WAVES ▶</button>`}<button class="zm-btn yellow" data-act="again">REPLAY</button></div></div>`,
    { menu:()=>{ H.sfx.click(); hideModal(H.root); toMenu(); }, next:()=>{ H.sfx.click(); hideModal(H.root); startLevel(r.level+1); },
      endless:()=>{ H.sfx.click(); hideModal(H.root); startEndless(); }, again:()=>{ H.sfx.click(); hideModal(H.root); startLevel(r.level); } });
}
function endLose(){ if(!H||!H.run||H.run.ended) return; const r=H.run; r.ended=true; r.busy=0; H.sfx.soft();
  $('.bp-hud2').classList.add('hidden');
  if(r.mode==='endless'){ endEndless(true); return; }
  H.P.runs++; saveP(); H.lastResult={ mode:'story', level:r.level, lost:true, shots:r.shots, earned:0 };
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon pink">SO CLOSE!</div>
    <p>The bubbles reached the sand on Level ${r.level}. Want to try again? It's free!</p>
    <div class="zm-btns"><button class="zm-btn blue" data-act="menu">LEVELS</button><button class="zm-btn green big" data-act="again">TRY AGAIN ▶</button></div></div>`,
    { menu:()=>{ H.sfx.click(); hideModal(H.root); toMenu(); }, again:()=>{ H.sfx.click(); hideModal(H.root); startLevel(r.level); } });
}
function endEndless(lost){
  const r=H.run; if(!r.ended){ r.ended=true; r.busy=0; }
  $('.bp-hud2').classList.add('hidden');
  const waves=Math.max(0, r.wave-1), pops=r.pops|0, score=bpScore(pops), newBest=score>(H.P.best|0);
  if(newBest) H.P.best=score; if(waves>(H.P.bestWaves|0)) H.P.bestWaves=waves; H.P.runs++; saveP();
  const pay=bpEndlessPay(waves), countsWin=r.t>=BP_WIN_MIN_SECONDS && waves>=BP_WIN_MIN_WAVES;
  const { earned, win }=creditStarfish(H.opts, pay.total, countsWin);
  refreshCoins(); if(waves>=1) H.sfx.win(); else H.sfx.soft();
  try{ if((H.P.best|0)>0 && H.opts.lb) H.opts.lb('bubble', H.P.best|0); }catch(e){}
  H.lastResult={ mode:'endless', waves, pops, score, newBest, earned, countsWin, t:r.t, pay, lost:!!lost };
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon ${lost?'pink':''}">${lost?'WAVE OVER!':'GREAT POP!'}</div>
    <div class="zm-big">${pops.toLocaleString()}</div><p>bubbles popped · ${waves} wave${waves===1?'':'s'} · ${Math.floor(r.t)}s</p>
    ${payHtml([[ `🌊 ${waves} wave${waves===1?'':'s'} × ${BP_ENDLESS_PER_WAVE}`, pay.total ], pay.capped?[ `Run max is ${BP_ENDLESS_CAP}`, '✔' ]:null, newBest?['🏆 New best', '✔', 'new']:null ], earned)}
    ${chestHtml(countsWin, win, `Pop for ${BP_WIN_MIN_SECONDS}+ seconds and finish ${BP_WIN_MIN_WAVES} waves to count toward a chest.`)}
    <div class="zm-btns"><button class="zm-btn blue" data-act="menu">LEVELS</button><button class="zm-btn pink" data-act="lobby">◀ LOBBY</button><button class="zm-btn green big" data-act="again">WAVES AGAIN ▶</button></div></div>`,
    { menu:()=>{ H.sfx.click(); hideModal(H.root); toMenu(); }, lobby:()=>{ H.sfx.click(); exitToLobby(); }, again:()=>{ H.sfx.click(); hideModal(H.root); startEndless(); } });
}
function pause(){ if(!H||H.screen!=='play'||!H.run||H.run.paused||H.run.ended) return; H.run.paused=true;
  const r=H.run, endless=r.mode==='endless';
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon blue">PAUSED</div>
    <p>${endless?`${r.pops} popped · Wave ${r.wave}`:`Level ${r.level} · ${r.shots} shot${r.shots===1?'':'s'}`}</p>
    <div class="zm-btns">${endless?`<button class="zm-btn pink" data-act="end">END RUN &amp; COLLECT</button>`:`<button class="zm-btn blue" data-act="menu">LEVELS</button>`}<button class="zm-btn green big" data-act="go">KEEP POPPING ▶</button></div></div>`,
    { go:()=>{ H.sfx.click(); resume(); }, menu:()=>{ H.sfx.click(); hideModal(H.root); toMenu(); }, end:()=>{ H.sfx.click(); hideModal(H.root); endEndless(true); } }); }
function resume(){ if(!H||!H.run) return; H.run.paused=false; hideModal(H.root); }

/* test hooks */
function winNow(shots){ if(!H||!H.run||H.run.ended) return; const r=H.run; if(shots!=null) r.shots=shots|0; r.cells=emptyGrid(); H.shot=null; r.busy=0; endWin(); }
function loseNow(){ if(!H||!H.run||H.run.ended) return; H.shot=null; H.run.busy=0; endLose(); }
function finishNow(){ if(!H||!H.run||H.run.ended) return; if(H.run.mode==='endless'){ hideModal(H.root); endEndless(true); } else loseNow(); }

function updateHud(){
  if(!H||!H.run) return; const r=H.run;
  $('.zm-bv').textContent=r.mode==='endless'?r.wave:r.level;
  $('.bp-shots b').textContent=r.shots;
  const sc=$('.bp-score'); if(sc){ sc.classList.toggle('hidden', r.mode!=='endless'); sc.querySelector('b').textContent=r.pops; }
  const nx=$('.bp-next i'); if(nx){ nx.style.background=COLORS[r.nxt]||'#fff'; nx.dataset.c=r.nxt; }
  const p=$('.bp-push');
  if(r.push>0){ p.classList.remove('hidden'); const left=Math.max(0, r.push-r.misses); p.innerHTML=`Drop ${Array.from({length:r.push},(_,i)=>`<i class="${i>=left?'on':''}"></i>`).join('')}`; }
  else p.classList.add('hidden');
}

/* ================= input ================= */
function pointerAim(e){ const rec=H.cv.getBoundingClientRect(), x=(e.clientX-rec.left)*H.vw/rec.width, y=(e.clientY-rec.top)*H.vh/rec.height; return clampAim(Math.atan2(y-H.lay.sy, x-H.lay.sx)); }
function onDown(e){ if(!H||H.screen!=='play'||!H.run||H.run.paused||H.run.ended) return; if(e.target.closest && e.target.closest('button,.zm-modal')) return;
  H.ptr={ id:e.pointerId, x:e.clientX, y:e.clientY, t:performance.now(), moved:false }; H.aiming=true; H.aim=pointerAim(e); try{ H.cv.setPointerCapture(e.pointerId); }catch(err){} e.preventDefault(); }
function onMove(e){ if(!H||!H.ptr||H.ptr.id!==e.pointerId) return; if(Math.hypot(e.clientX-H.ptr.x,e.clientY-H.ptr.y)>8) H.ptr.moved=true; H.aim=pointerAim(e); e.preventDefault(); }
function onUp(e){ if(!H||!H.ptr||H.ptr.id!==e.pointerId) return; const p=H.ptr; H.ptr=null; H.aiming=false;
  if(H.screen!=='play'||!H.run||H.run.paused||H.run.ended) return;
  H.aim=pointerAim(e); fire(H.aim); }
function onKey(e){
  if(!H) return; const c=e.code;
  if(c==='Escape'||c==='KeyP'){ if(H.screen==='play'){ H.run&&H.run.paused?resume():pause(); } e.preventDefault(); return; }
  if(H.screen!=='play'||!H.run||H.run.paused||H.run.ended) return;
  if(c==='ArrowLeft'||c==='KeyA'){ H.aim=clampAim(H.aim-.12); e.preventDefault(); }
  else if(c==='ArrowRight'||c==='KeyD'){ H.aim=clampAim(H.aim+.12); e.preventDefault(); }
  else if(c==='ArrowUp'||c==='KeyW'||c==='Space'){ fire(H.aim); e.preventDefault(); }
  else if(c==='ArrowDown'||c==='KeyS'||c==='KeyQ'){ swap(); e.preventDefault(); }
}

/* ================= layout / draw ================= */
function fit(){
  if(!H) return; const cv=H.cv, dpr=Math.min(2, window.devicePixelRatio||1);
  const w=H.root.clientWidth||innerWidth, h=H.root.clientHeight||innerHeight;
  H.vw=w; H.vh=h; H.dpr=dpr; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.width=w+'px'; cv.style.height=h+'px';
  H.cx.setTransform(dpr,0,0,dpr,0,0);
  const safeT=Math.max(8, readSafe('top')), safeB=Math.max(12, readSafe('bottom'));
  const topMin=70+safeT, botMin=18+safeB, availW=w-16, availH=Math.max(140, h-topMin-botMin);
  const R=clamp(Math.min(availW/(COLS*2), availH/(DANGER_ROW*SQRT3+3.1)), 12, 38);
  const chain=(DANGER_ROW*SQRT3+3.1)*R, slack=Math.max(0, h-topMin-botMin-chain);
  const ox=(w-COLS*2*R)/2+R, oy=topMin+R+slack*0.72;
  const sx=w/2, sy=oy+(DANGER_ROW+1.15)*R*SQRT3, sand=oy+DANGER_ROW*R*SQRT3;
  H.lay={ R, ox, oy, sx, sy, left:ox-R, right:ox-R+COLS*2*R, ceil:oy-R, sand, top:topMin, bot:botMin };
  placeHud(); placeBpFig(); seedWeeds();
}
function placeHud(){
  const el=H&&H.root&&$('.bp-hud2'), L=H&&H.lay; if(!el||!L) return;
  const pad=8, w=el.offsetWidth||120; let x=L.sx+L.R*2.5; if(x+w>H.vw-pad) x=Math.max(pad, L.sx-L.R*2.5-w);
  el.style.left=x+'px'; el.style.top=(L.sy-L.R*1.05)+'px'; el.style.right='auto'; el.style.bottom='auto'; el.style.transform='none';
  const help=$('.bp-help');
  if(help){
    // keep the tip out of the board, the aim line, and the shooter figure
    if(L.left>200){ help.style.left=(L.left*.5)+'px'; help.style.bottom='auto'; help.style.top=Math.max(10,(L.top||70)+6)+'px'; help.style.transform='translateX(-50%)'; }
    else if(H.vh-L.sand<160){ help.style.left='50%'; help.style.bottom='auto'; help.style.top=(L.sand-48)+'px'; help.style.transform='translateX(-50%)'; }
    else { help.style.left='50%'; help.style.top='auto'; help.style.bottom=''; help.style.transform='translateX(-50%)'; }
  }
}
function readSafe(side){ const v=getComputedStyle(H.root).getPropertyValue('padding-'+side) || getComputedStyle(document.documentElement).getPropertyValue('--safe') || '0'; const n=parseFloat(v); return isFinite(n)?n:0; }
function seedDrift(){ H.drift=Array.from({length:18},()=>({ x:rand(0,1), y:rand(0,1), r:rand(4,14), v:rand(.04,.12), a:rand(0,6) })); }

function loop(now){
  if(!H) return; const dt=Math.min(.05,(now-H.last)/1000); H.last=now; H.t+=dt;
  if(H.run && !H.run.paused && !H.run.ended){ H.run.t+=dt; if(H.run.shift<0){ H.run.shift=Math.min(0, H.run.shift+dt*4.2); } if(H.run.busy>0){ H.run.busy-=dt; if(H.run.busy<=0){ H.run.busy=0; const f=H._after; H._after=null; if(f) f(); } } if(H.shot) stepShot(dt); }
  stepFx(dt); draw(); H.raf=requestAnimationFrame(loop);
}
function stepFx(dt){
  H.fx=H.fx.filter(p=>{ if(p.delay>0){ p.delay-=dt; return true; } p.t+=dt; if(p.typ==='bit'||p.typ==='fall'){ p.vy+=(p.typ==='fall'?900:420)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; } return p.t<p.life; });
  H.drift.forEach(b=>{ b.y-=b.v*dt*.15; b.a+=dt; if(b.y<-.05){ b.y=1.05; b.x=rand(0,1); } });
}
function draw(){
  const cx=H.cx, w=H.vw, h=H.vh, L=H.lay; if(!cx||!L) return;
  const g=cx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#7fe0ff'); g.addColorStop(.55,'#1a7ad4'); g.addColorStop(1,'#0b4a96');
  cx.fillStyle=g; cx.fillRect(0,0,w,h);
  H.drift.forEach(b=>{ const x=b.x*w, y=b.y*h, r=b.r; cx.beginPath(); cx.arc(x,y,r,0,7); cx.strokeStyle='rgba(255,255,255,.45)'; cx.lineWidth=2; cx.stroke(); cx.fillStyle='rgba(220,245,255,.18)'; cx.fill(); cx.beginPath(); cx.arc(x-r*.3,y-r*.3,r*.22,0,7); cx.fillStyle='rgba(255,255,255,.5)'; cx.fill(); });
  // other characters swimming behind the board (and behind the sand / seaweed)
  try{ drawBgSwim(cx,w,h,H.t,{ mode: H.screen==='play'?'bubble':'bubble-menu', y0:.10, y1: Math.max(.18, (L.sand/h)-.04), kit:H.opts&&H.opts.kit, S:H.opts&&H.opts.S }); }catch(e){}
  // sand
  cx.fillStyle='#e2b475'; cx.beginPath(); cx.moveTo(0,L.sand+L.R*.4); cx.quadraticCurveTo(w*.25,L.sand-L.R*.2,w*.5,L.sand+L.R*.15); cx.quadraticCurveTo(w*.75,L.sand+L.R*.5,w,L.sand); cx.lineTo(w,h); cx.lineTo(0,h); cx.fill();
  cx.fillStyle='#16163a'; cx.fillRect(0,L.sand,w,4);
  drawSeaweed(cx);
  // danger line (above seaweed; play area stays clear)
  cx.save(); cx.setLineDash([8,8]); cx.strokeStyle='rgba(255,80,80,.85)'; cx.lineWidth=3; cx.beginPath(); cx.moveTo(L.left,L.sand); cx.lineTo(L.right,L.sand); cx.stroke(); cx.restore();
  if(H.screen!=='play'||!H.run){ drawIdleBubbles(); hideBpFig(); return; }
  // ceiling bar
  const cy=L.oy-L.R+(H.run.shift*L.R*SQRT3);
  cx.fillStyle='#16325a'; cx.strokeStyle=INK; cx.lineWidth=4; roundRect(cx, L.left-6, cy-14, L.right-L.left+12, 18, 8); cx.fill(); cx.stroke();
  // grid
  eachCell((r,c,v)=>{ const [x,y]=cellPos(r,c); bubble(cx,x,y,L.R,v); });
  // in-flight
  if(H.shot) bubble(cx,H.shot.x,H.shot.y,L.R,H.shot.color);
  else if(!H.run.busy && !H.run.ended && !H.run.paused) drawAim(cx);
  // fx
  H.fx.forEach(p=>{ if(p.delay>0) return; const k=1-p.t/p.life; if(p.typ==='pop') bubble(cx,p.x,p.y,L.R*Math.max(.1,1-p.t/p.life),p.col,k); else if(p.typ==='fall') bubble(cx,p.x,p.y,L.R,p.col,k); else { cx.globalAlpha=k; cx.fillStyle=COLORS[p.col]||'#fff'; cx.beginPath(); cx.arc(p.x,p.y,L.R*.18,0,7); cx.fill(); cx.globalAlpha=1; } });
  drawShooter(cx);
  syncBpFig();
}
function drawIdleBubbles(){ const L=H.lay; for(let i=0;i<8;i++){ const x=L.ox+(i%9)*L.R*2, y=L.oy+Math.sin(H.t*.7+i)*.4*L.R+L.R*1.2; if(i<COLS) bubble(H.cx,x,y,L.R*.85,i%COLORS.length,.9); } }
function drawAim(cx){
  const L=H.lay, [mx,my]=muzzle(); let x=mx, y=my, vx=Math.cos(H.aim), vy=Math.sin(H.aim);
  cx.save(); cx.setLineDash([5,7]); cx.strokeStyle='rgba(255,255,255,.85)'; cx.fillStyle='rgba(255,255,255,.9)'; cx.lineWidth=3; cx.beginPath(); cx.moveTo(x,y);
  for(let i=0,d=0;i<48 && d<L.R*22;i++){ const step=L.R*.7; x+=vx*step; y+=vy*step; d+=step;
    if(x-L.R<=L.left){ x=L.left+L.R; vx=Math.abs(vx); } if(x+L.R>=L.right){ x=L.right-L.R; vx=-Math.abs(vx); }
    if(y-L.R<=L.ceil) break;
    let hit=false; eachCell((r,c)=>{ const [px,py]=cellPos(r,c); if(Math.hypot(x-px,y-py)<L.R*1.92) hit=true; });
    cx.lineTo(x,y); if(hit) break; }
  cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.arc(x,y,5,0,7); cx.fill(); cx.restore();
}
function drawShooter(cx){
  const L=H.lay, a=H.aim, x=L.sx, y=L.sy, R=L.R;
  cx.save(); cx.translate(x,y);
  // base
  cx.fillStyle='#16325a'; cx.strokeStyle=INK; cx.lineWidth=4; cx.beginPath(); cx.ellipse(0,R*.55,R*1.6,R*.7,0,0,7); cx.fill(); cx.stroke();
  cx.fillStyle='#1e4e86'; cx.beginPath(); cx.ellipse(0,R*.4,R*1.15,R*.45,0,0,7); cx.fill();
  // barrel
  cx.rotate(a+Math.PI/2);
  cx.fillStyle='#ffd52e'; cx.strokeStyle=INK; cx.lineWidth=4; roundRect(cx,-R*.45,-R*1.55,R*.9,R*1.7,R*.3); cx.fill(); cx.stroke();
  cx.restore();
  const [mx,my]=muzzle(); if(H.run && H.run.cur>=0 && !H.shot) bubble(cx, mx, my, R, H.run.cur);
}
function bubble(cx,x,y,R,col,alpha=1){
  const fill=COLORS[col]||'#fff'; cx.save(); cx.globalAlpha=alpha; cx.translate(x,y);
  cx.beginPath(); cx.arc(0,0,R,0,7); cx.fillStyle=INK; cx.fill();
  cx.beginPath(); cx.arc(0,0,R*.86,0,7); cx.fillStyle=fill; cx.fill();
  const g=cx.createRadialGradient(-R*.28,-R*.32,R*.04,0,0,R*.85);
  g.addColorStop(0,'rgba(255,255,255,.75)'); g.addColorStop(.4,'rgba(255,255,255,.12)'); g.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=g; cx.beginPath(); cx.arc(0,0,R*.86,0,7); cx.fill();
  cx.fillStyle='rgba(255,255,255,.55)'; cx.beginPath(); cx.ellipse(-R*.25,-R*.32,R*.28,R*.15,-.5,0,7); cx.fill();
  cx.restore();
}
function roundRect(cx,x,y,w,h,r){ if(cx.roundRect){ cx.beginPath(); cx.roundRect(x,y,w,h,r); return; } const m=Math.min(w,h)/2; r=Math.min(r,m); cx.beginPath(); cx.moveTo(x+r,y); cx.arcTo(x+w,y,x+w,y+h,r); cx.arcTo(x+w,y+h,x,y+h,r); cx.arcTo(x,y+h,x,y,r); cx.arcTo(x,y,x+w,y,r); cx.closePath(); }

function poseAim(a){ if(!H||!H.run) return; H.aim=clampAim(a); H.aiming=true; syncBpFig(true); }

/* ================= decorative seaweed (visual only; no collision) ================= */
function weedLayoutKey(){ const L=H.lay; return L?[H.vw|0,H.vh|0,L.left|0,L.right|0,L.sand|0].join('|'):''; }
function seedWeeds(){
  if(!H||!H.lay) return; const key=weedLayoutKey(); if(H.weedKey===key && H.weeds.length) return;
  const L=H.lay, w=H.vw, h=H.vh, rnd=rng((w*13^h*7^L.left*31^L.sand*17)|0);
  const weeds=[], pal=3;
  const plant=(x0,x1,base,hMin,hMax,n)=>{
    if(x1-x0<8||n<=0) return;
    for(let i=0;i<n;i++){
      const u=(i+.35+rnd()*.3)/n, x=x0+(x1-x0)*u;
      weeds.push({ x, base, h:hMin+(hMax-hMin)*rnd(), tw:6+rnd()*12, ph:rnd()*6, col:(rnd()*pal)|0, blades:1+(rnd()>.45?1:0) });
    }
  };
  const keep=L.R*3.4;
  // short tufts on the sand, left and right of the shooter — stay below the sand line
  const sandH=Math.max(16, h-L.sand-4);
  plant(8, L.sx-keep, h, sandH*.45, sandH*.95, 4);
  plant(L.sx+keep, w-8, h, sandH*.45, sandH*.95, 4);
  // tall kelp in the side margins, outside the play field
  const topCap=h-(L.top||70)-8;
  if(L.left>22) plant(8, L.left-6, h, Math.min(topCap, h*0.28), Math.min(topCap, h*0.62), Math.max(3, Math.round((L.left-8)/20)));
  if(w-L.right>22) plant(L.right+6, w-8, h, Math.min(topCap, h*0.28), Math.min(topCap, h*0.62), Math.max(3, Math.round((w-L.right-8)/20)));
  H.weeds=weeds; H.weedKey=key;
}
function drawSeaweed(cx){
  if(!H||!H.weeds||!H.weeds.length) return;
  const t=H.reduceMotion?0:H.t, L=H.lay, sand=L?L.sand:H.vh;
  for(const k of H.weeds){
    const sway=H.reduceMotion?0:Math.sin(t*1.05+k.ph)*k.tw*.55;
    // clip tips so they never cross into the bubble grid
    const maxH=k.x<(L.left-2)||k.x>(L.right+2) ? k.h : Math.min(k.h, Math.max(8, k.base-sand-2));
    if(maxH<8) continue;
    frond(cx, k.x, k.base, maxH, k.tw, sway, k.col, k.blades);
  }
}
function frond(cx, x, base, h, tw, sway, col, blades){
  const pal=[[['#1a6a36','#2fb33a','#8cf26a'],['#176a38','#3cae3c','#b8f08a']],[['#0e5c48','#1fa36a','#8cf2b0'],['#148a60','#2bb88a','#b6f5d4']],[['#1a5a28','#3cae3c','#c4ef6a'],['#2e8b3a','#5bbe4a','#d4f59a']]][col||0];
  for(let b=0;b<blades;b++){
    const s=sway*(b?-.6:1), w=Math.max(10, tw*(b?.75:1.15)), hh=h*(b?.8:1), ox=x+(b?tw*.5:-tw*.12);
    const mid=ox+s*.55, tip=ox+s, yMid=base-hh*.52, y2=base-hh;
    cx.beginPath();
    cx.moveTo(ox-w*.6, base);
    cx.bezierCurveTo(ox-w*.15, base-hh*.28, mid-w*.55, yMid, tip-w*.22, y2);
    cx.quadraticCurveTo(tip, y2-w*.4, tip+w*.22, y2);
    cx.bezierCurveTo(mid+w*.55, yMid, ox+w*.15, base-hh*.28, ox+w*.6, base);
    cx.closePath();
    const g=cx.createLinearGradient(ox, base, tip, y2);
    g.addColorStop(0, pal[b%2][0]); g.addColorStop(.55, pal[b%2][1]); g.addColorStop(1, pal[b%2][2]);
    cx.fillStyle=g; cx.strokeStyle=INK; cx.lineWidth=Math.max(2.2, w*.14); cx.lineJoin='round'; cx.lineCap='round';
    cx.fill(); cx.stroke();
  }
}

/* ================= shooter buddy (2D snapshot of the current player) ================= */
const bpFig={ el:null, ctx:null, src:null, ink:null, img:null, scene:null, char:null, cam:null, rt:null, buf:null,
  key:'', lastAim:NaN, w:0, h:0, dirty:true, side:'left',
  v:null, v2:null, v3:null, box:null, col:null, vp:null, base:null, look:null };
function kit3(){ return H&&H.opts&&H.opts.kit; }
function bpLookKey(){ const S=H&&H.opts&&H.opts.S||{}; const eq=S.equipped||{}; return (S.selChar||'ollie')+'|'+Object.keys(eq).sort().map(s=>s+':'+(eq[s]||'')).join(','); }
function figWanted(){ return !!(H && H.screen==='play' && H.run && !H.run.ended && kit3() && kit3().renderer && kit3().THREE && kit3().buildChar); }
function hideBpFig(){ if(bpFig.el) bpFig.el.classList.remove('on'); }
function disposeBpFig(){
  hideBpFig();
  if(bpFig.char && bpFig.char.parent) bpFig.char.parent.remove(bpFig.char);
  if(bpFig.rt){ try{ bpFig.rt.dispose(); }catch(e){} }
  if(bpFig.el && bpFig.el.parentNode) bpFig.el.parentNode.removeChild(bpFig.el);
  bpFig.el=bpFig.ctx=bpFig.src=bpFig.ink=bpFig.img=bpFig.scene=bpFig.char=bpFig.cam=bpFig.rt=bpFig.buf=null;
  bpFig.key=''; bpFig.lastAim=NaN; bpFig.dirty=true;
}
function ensureBpFig(){
  if(bpFig.el) return; const kit=kit3(); if(!kit) return;
  const THREE=kit.THREE;
  const el=document.createElement('canvas'); el.className='bp-fig'; el.setAttribute('aria-hidden','true');
  H.root.appendChild(el);
  bpFig.el=el; bpFig.ctx=el.getContext('2d');
  bpFig.src=document.createElement('canvas'); bpFig.ink=document.createElement('canvas');
  const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x6a7aa8, 1.55));
  const d=new THREE.DirectionalLight(0xffffff, 2.15); d.position.set(2.4,5,6); sc.add(d);
  const f=new THREE.DirectionalLight(0x9fd8ff, .85); f.position.set(-4,2,-3); sc.add(f);
  bpFig.scene=sc; bpFig.cam=new THREE.PerspectiveCamera(30, .8, .05, 40);
  bpFig.v=new THREE.Vector3(); bpFig.v2=new THREE.Vector3(); bpFig.v3=new THREE.Vector3();
  bpFig.box=new THREE.Box3(); bpFig.col=new THREE.Color(); bpFig.vp=new THREE.Vector4();
  bpFig.base=new THREE.Vector3(); bpFig.look=new THREE.Vector3();
}
function syncBpChar(){
  const kit=kit3(), key=bpLookKey(); if(!kit) return;
  if(bpFig.char && bpFig.key===key) return;
  if(bpFig.char && bpFig.char.parent) bpFig.char.parent.remove(bpFig.char);
  const S=H.opts.S||{}, id=S.selChar||'ollie';
  const o=kit.buildChar(id);
  o.userData.baseY=0; o.position.set(0,0,0); o.rotation.set(0,0,0);
  bpFig.scene.add(o); bpFig.char=o; bpFig.key=key; bpFig.dirty=true;
  frameBpCam();
  bpFig.base.copy(o.position);
}
function frameBpCam(){
  const o=bpFig.char, cam=bpFig.cam, THREE=kit3().THREE; if(!o||!cam) return;
  const side=bpFig.side==='right'?1:-1;
  o.position.copy(bpFig.base||{x:0,y:0,z:0}); o.rotation.set(0, .28*side, 0);
  o.updateMatrixWorld(true);
  const box=bpFig.box.setFromObject(o); if(box.isEmpty()) return;
  const c=box.getCenter(bpFig.v), sz=box.getSize(bpFig.v2);
  const look=bpFig.look.copy(c); look.y+=sz.y*.02;
  const r=Math.max(sz.x,sz.y,sz.z)*1.02+.16;
  const dir=bpFig.v3.set(-.1*side, .18, 1).normalize();
  cam.aspect=(bpFig.w||160)/(bpFig.h||200);
  cam.fov=30; cam.position.copy(look).addScaledVector(dir, r/Math.sin(THREE.MathUtils.degToRad(15)));
  cam.lookAt(look); cam.updateProjectionMatrix();
}
function poseBpBuddy(aim){
  const o=bpFig.char; if(!o) return;
  const p=o.userData.parts||{}, side=bpFig.side==='right'?1:-1;
  // 0 = straight up, -1 = left, +1 = right
  const span=Math.PI/2-AIM_PAD, t=clamp((aim+Math.PI/2)/span, -1, 1);
  o.position.copy(bpFig.base); o.rotation.set(0, .28*side, 0);
  if(p.rig){ p.rig.position.y=0; p.rig.rotation.set(.08, t*.12, -t*.2); p.rig.quaternion.setFromEuler(p.rig.rotation); }
  if(p.head){ p.head.rotation.set(-.12, t*.45, -t*.08); p.head.quaternion.setFromEuler(p.head.rotation); }
  // the inward arm (toward the shooter) follows the aim; the far arm stays casual
  const inn=side<0?'sh1':'sh-1', out=side<0?'sh-1':'sh1';
  const innA=side<0?'arm1':'arm-1', outA=side<0?'arm-1':'arm1';
  if(p[outA]) p[outA].rotation.set(0,0,0);
  if(p[innA]) p[innA].rotation.set(0,0,0);
  if(p[out]){ p[out].rotation.set(-.2, 0, -.28*side); p[out].quaternion.setFromEuler(p[out].rotation); }
  if(p[inn]){
    // inward arm follows the aim (t: -1 left, 0 up, +1 right)
    p[inn].rotation.set(-.55-t*.7*side, .08*side, (1.2+t*.55*side)*side);
    p[inn].quaternion.setFromEuler(p[inn].rotation);
  }
  o.updateMatrixWorld(true);
}
function blitBpFig(){
  const kit=kit3(), w=bpFig.w, h=bpFig.h; if(!kit||!w||!h) return;
  const THREE=kit.THREE, renderer=kit.renderer;
  if(!bpFig.rt || bpFig.rt.width!==w || bpFig.rt.height!==h){
    if(bpFig.rt) bpFig.rt.dispose();
    bpFig.rt=new THREE.WebGLRenderTarget(w,h,{ depthBuffer:true });
    try{ if(bpFig.rt.texture) bpFig.rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
    bpFig.buf=new Uint8Array(w*h*4);
  }
  if(bpFig.src.width!==w){ bpFig.src.width=w; bpFig.src.height=h; }
  if(bpFig.ink.width!==w){ bpFig.ink.width=w; bpFig.ink.height=h; }
  const prevRT=renderer.getRenderTarget();
  renderer.getClearColor(bpFig.col); const prevA=renderer.getClearAlpha();
  renderer.getViewport(bpFig.vp);
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(bpFig.rt); renderer.setViewport(0,0,w,h); renderer.clear();
  renderer.render(bpFig.scene, bpFig.cam);
  renderer.readRenderTargetPixels(bpFig.rt, 0, 0, w, h, bpFig.buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(bpFig.col, prevA); renderer.setViewport(bpFig.vp);
  const sctx=bpFig.src.getContext('2d');
  let img=bpFig.img; if(!img||img.width!==w||img.height!==h){ img=sctx.createImageData(w,h); bpFig.img=img; }
  for(let y=0;y<h;y++) img.data.set(bpFig.buf.subarray((h-1-y)*w*4,(h-y)*w*4), y*w*4);
  sctx.putImageData(img,0,0);
  const ictx=bpFig.ink.getContext('2d'); ictx.clearRect(0,0,w,h);
  const o=Math.max(2, Math.round(Math.min(w,h)/64));
  for(let i=0;i<8;i++){ const a=i*Math.PI/4; ictx.drawImage(bpFig.src, Math.round(Math.cos(a)*o), Math.round(Math.sin(a)*o)); }
  ictx.globalCompositeOperation='source-in'; ictx.fillStyle='#16163a'; ictx.fillRect(0,0,w,h); ictx.globalCompositeOperation='source-over';
  const ctx=bpFig.ctx; ctx.clearRect(0,0,w,h); ctx.drawImage(bpFig.ink,0,0); ctx.drawImage(bpFig.src,0,0);
}
function placeBpFig(){
  if(!figWanted()){ hideBpFig(); return; }
  ensureBpFig(); if(!bpFig.el) return;
  const L=H.lay, hud=$('.bp-hud2');
  let side='left';
  if(hud && !hud.classList.contains('hidden')){
    const hr=hud.getBoundingClientRect(), rr=H.root.getBoundingClientRect();
    if((hr.left+hr.width/2) < rr.left+L.sx) side='right';
  }
  if(side!==bpFig.side){ bpFig.side=side; bpFig.dirty=true; }
  // sit fully on the sand, under the danger line, so the aim line and board stay clear
  const band=Math.max(72, H.vh-L.sand+12), ratio=1.22;
  const css=clamp(Math.min(L.R*5.2, band/ratio), 64, 150);
  const fw=css, fh=Math.min(css*ratio, band);
  let left=side==='left' ? L.sx-L.R*1.45-fw : L.sx+L.R*1.45;
  left=clamp(left, 2, H.vw-fw-2);
  let top=L.sy+L.R*.8-fh;
  top=clamp(top, L.sand-Math.min(16, fh*.12), H.vh-fh-2);
  const el=bpFig.el;
  el.style.left=left+'px'; el.style.top=top+'px'; el.style.width=fw+'px'; el.style.height=fh+'px';
  const dpr=Math.min(2, H.dpr||window.devicePixelRatio||1);
  let w=Math.max(8, Math.round(fw*dpr)), h=Math.max(8, Math.round(fh*dpr));
  const cap=220; if(w>cap){ h=Math.round(h*cap/w); w=cap; } if(h>cap){ w=Math.round(w*cap/h); h=cap; }
  if(el.width!==w||el.height!==h){ el.width=w; el.height=h; bpFig.w=w; bpFig.h=h; bpFig.dirty=true; }
  else { bpFig.w=w; bpFig.h=h; }
}
function syncBpFig(force){
  if(!figWanted()){ hideBpFig(); return; }
  try{
    ensureBpFig(); placeBpFig(); syncBpChar();
    const aim=H.aim;
    if(!force && !bpFig.dirty && bpFig.lastAim===aim && bpFig.el.classList.contains('on')) return;
    if(bpFig.cam && bpFig.cam.aspect!==(bpFig.w/(bpFig.h||1))) frameBpCam();
    poseBpBuddy(aim); blitBpFig();
    bpFig.lastAim=aim; bpFig.dirty=false; bpFig.el.classList.add('on');
  }catch(e){ console.warn('bubble fig failed', e); hideBpFig(); }
}

