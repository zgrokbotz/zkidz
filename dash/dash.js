/* Reef Diner — 2D canvas diner-dash. Core loop plus Deluxe seating, color match, chaining, combos, party sizes, walk-in/out. Avatars are existing character art (no drawn humans, no 3D). */
(function(){ const P=typeof CanvasRenderingContext2D!=='undefined' && CanvasRenderingContext2D.prototype; if(!P||P.roundRect) return;
  P.roundRect=function(x,y,w,h,r){ if(w<0){ x+=w; w=-w; } if(h<0){ y+=h; h=-h; }
    let rtl,rtr,rbr,rbl; if(typeof r==='number') rtl=rtr=rbr=rbl=r; else if(Array.isArray(r)){ rtl=r[0]||0; rtr=r[1]||r[0]||0; rbr=r[2]||r[0]||0; rbl=r[3]||r[1]||r[0]||0; } else rtl=rtr=rbr=rbl=0;
    const m=Math.min(w,h)/2; rtl=Math.min(Math.max(0,rtl),m); rtr=Math.min(Math.max(0,rtr),m); rbr=Math.min(Math.max(0,rbr),m); rbl=Math.min(Math.max(0,rbl),m);
    this.moveTo(x+rtl,y); this.lineTo(x+w-rtr,y); this.quadraticCurveTo(x+w,y,x+w,y+rtr); this.lineTo(x+w,y+h-rbr); this.quadraticCurveTo(x+w,y+h,x+w-rbr,y+h); this.lineTo(x+rbl,y+h); this.quadraticCurveTo(x,y+h,x,y+h-rbl); this.lineTo(x,y+rtl); this.quadraticCurveTo(x,y,x+rtl,y); this.closePath(); return this; };
})();
const SAVE_KEY = 'zkidz_dash_v1';
const COOK_CAP = 4.0; // never cook longer than this
const MENU = [
  { id:'burger',   em:'🍔', name:'Kelp Burger' },
  { id:'pizza',    em:'🍕', name:'Shell Pizza' },
  { id:'tea',      em:'🧋', name:'Bubble Tea' },
  { id:'smoothie', em:'🥤', name:'Sea-Grape Smoothie' },
  { id:'ice',      em:'🍦', name:'Ice Cream' },
];
const COLORS = [
  { name:'Blue',   hex:'#3a86ff' },
  { name:'Pink',   hex:'#ff6ad5' },
  { name:'Green',  hex:'#2db86a' },
  { name:'Orange', hex:'#fb8c00' },
];
/* Kitchen prep (seconds). Old playtest times were 2.4 / 2.8 / 3.2 and felt slow.
   New: 2.0 / 2.5 / 3.2, hard-capped at COOK_CAP (4.0). */
const LEVELS = [
  { id:1, name:'Lunch Rush',  time:90, goal:80,  cook:2.0, eat:3.2, read:1.2, queueDrain:2.0, tableDrain:1.8, spawn0:6.5, spawnMin:5.0, speed:300 },
  { id:2, name:'Dinner Wave', time:90, goal:120, cook:2.5, eat:3.5, read:1.4, queueDrain:2.4, tableDrain:2.3, spawn0:6.0, spawnMin:4.2, speed:330 },
  { id:3, name:'Star Shift',  time:90, goal:160, cook:3.2, eat:3.8, read:1.5, queueDrain:2.8, tableDrain:2.7, spawn0:5.2, spawnMin:3.8, speed:365 },
];
const COLOR_MATCH_BONUS = 10; // in-game score only; does not change payout formula
const COMBO_CAP = 4;

let D = null;
const avatars = Object.create(null);

function defaultArt(id){
  if(window.__ART && window.__ART[id]) return window.__ART[id];
  try{ return new URL(`../art/${id}.jpg`, import.meta.url).href; }
  catch(e){ return `art/${id}.jpg`; }
}
function loadDashSave(){
  const base = { v:1, best:0, bests:{1:0,2:0,3:0}, unlocked:1 };
  try{ return Object.assign(base, { bests:{...base.bests} }, JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')); }
  catch(e){ return base; }
}
function writeDashSave(P){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(P)); }catch(e){} }
function hex(c){
  if(typeof c==='number') return '#'+c.toString(16).padStart(6,'0');
  return c || '#4aa3df';
}
function firstName(c){ return String((c && c.name) || (c && c.id) || 'Friend').split(' the ')[0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function toast(msg){
  if(!D || !D.root) return;
  const el = D.root.querySelector('.rd-toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(D._toastT);
  D._toastT = setTimeout(()=>el.classList.remove('show'), 1600);
}

/* ---------- Web Audio SFX (synthesized; unlocked on first tap; muted with Settings music toggle) ---------- */
let audioCtx = null, audioUnlocked = false;
function sfxEnabled(){
  if(!audioUnlocked) return false;
  if(D && D.opts){
    if(typeof D.opts.sfxOn==='function') return !!D.opts.sfxOn();
    if(D.opts.S && D.opts.S.music===false) return false;
  }
  if(window.__zkidz && window.__zkidz.music && window.__zkidz.music.enabled===false) return false;
  return true;
}
function unlockAudio(){
  audioUnlocked = true;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state==='suspended') audioCtx.resume();
  }catch(e){}
}
function playSound(type){
  if(!sfxEnabled() || !audioCtx) return;
  try{
    if(audioCtx.state==='suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if(type==='pop'){
      osc.type='sine'; osc.frequency.setValueAtTime(420,now); osc.frequency.exponentialRampToValueAtTime(680,now+0.08);
      gain.gain.setValueAtTime(0.12,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.08);
      osc.start(now); osc.stop(now+0.08);
    } else if(type==='serve' || type==='ding'){
      osc.type='triangle'; osc.frequency.setValueAtTime(880,now); osc.frequency.setValueAtTime(1174,now+0.08);
      gain.gain.setValueAtTime(0.13,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.32);
      osc.start(now); osc.stop(now+0.32);
    } else if(type==='coin' || type==='cash'){
      osc.type='sine'; osc.frequency.setValueAtTime(587,now); osc.frequency.setValueAtTime(880,now+0.07);
      gain.gain.setValueAtTime(0.14,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.22);
      osc.start(now); osc.stop(now+0.22);
    } else if(type==='combo'){
      osc.type='triangle'; osc.frequency.setValueAtTime(660,now); osc.frequency.setValueAtTime(880,now+0.06); osc.frequency.setValueAtTime(1320,now+0.12);
      gain.gain.setValueAtTime(0.14,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.28);
      osc.start(now); osc.stop(now+0.28);
    }
  }catch(e){}
}

function loadAvatar(id, url){
  if(avatars[id]) return avatars[id];
  const img = new Image();
  img.decoding = 'async';
  img.src = url || defaultArt(id);
  avatars[id] = img;
  return img;
}
function drawAvatar(ctx, x, y, r, img, color, em, opt){
  opt = opt || {};
  const bob = opt.bob || 0;
  const facing = opt.facing == null ? 1 : opt.facing;
  ctx.save();
  ctx.translate(x, y + bob);
  if(facing < 0) ctx.scale(-1, 1);
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.closePath();
  ctx.fillStyle = hex(color);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if(img && img.complete && img.naturalWidth){
    const s = Math.max(r*2/img.naturalWidth, r*2/img.naturalHeight) * 1.08;
    const w = img.naturalWidth*s, h = img.naturalHeight*s;
    ctx.drawImage(img, -w/2, -h/2 - r*0.08, w, h);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(r*1.2)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(em||'🐠', 0, 2);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(3, r*0.12);
  ctx.strokeStyle = '#16163a';
  ctx.stroke();
  if(opt.ring){
    ctx.lineWidth = Math.max(4, r*0.16);
    ctx.strokeStyle = opt.ring;
    ctx.beginPath(); ctx.arc(0,0,r+3,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#16163a';
    ctx.beginPath(); ctx.arc(0,0,r+5,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}
function drawPatience(ctx, x, y, w, p){
  const h=8;
  ctx.fillStyle='#16163a';
  ctx.beginPath(); ctx.roundRect(x-w/2-1, y-1, w+2, h+2, 4); ctx.fill();
  const t = clamp(p, 0, 1);
  ctx.fillStyle = t>0.45 ? '#2db86a' : t>0.22 ? '#f0b429' : '#e8452f';
  ctx.beginPath(); ctx.roundRect(x-w/2, y, Math.max(2, w*t), h, 3); ctx.fill();
}

function customerPool(opts, waiterId){
  const chars = (opts.chars || []).filter(c=>c && c.art && c.id!==waiterId);
  const list = chars.length ? chars : [
    {id:'ollie',name:'Ollie the Otter',em:'🦦',color:0x7a4a2c,art:true},
    {id:'wade',name:'Wade the Whale Shark',em:'🐋',color:0x5c7aa0,art:true},
    {id:'dash',name:'Dash the Dolphin',em:'🐬',color:0x4aa3df,art:true},
    {id:'finn',name:'Finn the Clownfish',em:'🐠',color:0xff7a1a,art:true},
    {id:'bubbles',name:'Bubbles the Axolotl',em:'🦎',color:0xff8fc2,art:true},
    {id:'oscar',name:'Oscar the Orca',em:'🐋',color:0x222222,art:true},
    {id:'pip',name:'Pip the Penguin',em:'🐧',color:0x1f2a55,art:true},
    {id:'sunny',name:'Sunny the Seal',em:'🦭',color:0x8a8f99,art:true},
  ].filter(c=>c.id!==waiterId);
  return list.length ? list : [{id:'stella',name:'Stella the Starfish',em:'⭐',color:0xff7a1f,art:true}];
}

function computeLayout(W, H){
  const port = H >= W * 1.08;
  const L = { W, H, port };
  if(port){
    const kitY = Math.max(56, H*0.085);
    L.kitchen = { x:W*0.5, y:kitY, w:W-20, h:Math.max(74, H*0.13) };
    const slotR = Math.max(28, Math.min(40, W*0.07));
    L.kitchenSlots = [0.20,0.38,0.56,0.74].map(p=>({ x:W*p, y:kitY+8, r:slotR }));
    L.trash = { x:W-40, y:kitY+8, r:Math.max(26, slotR*0.9) };
    L.queueX = Math.max(50, W*0.11);
    const qTop = kitY + L.kitchen.h*0.55 + 48;
    const qBot = H - 70;
    L.queue = [0,1,2].map(i=>({ x:L.queueX, y: qTop + (qBot-qTop)*(i+0.15)/3 }));
    const midX = W*0.60, midY = (qTop + H-20)*0.52;
    const gapX = Math.max(130, W*0.36), gapY = Math.max(140, H*0.26);
    L.tableR = Math.max(52, Math.min(78, Math.min(gapX, gapY)*0.34));
    L.tables = [
      { x:midX-gapX/2, y:midY-gapY/2 },
      { x:midX+gapX/2, y:midY-gapY/2 },
      { x:midX-gapX/2, y:midY+gapY/2 },
      { x:midX+gapX/2, y:midY+gapY/2 },
    ];
    L.exit = { x:W*0.22, y:H-30 };
    L.playerStart = { x:midX, y:midY };
  } else {
    const kitY = Math.max(48, H*0.12);
    L.kitchen = { x:W*0.5, y:kitY, w:Math.min(W*0.72, 560), h:Math.max(64, H*0.16) };
    const slotR = Math.max(26, Math.min(36, H*0.07));
    const mid = W*0.50;
    L.kitchenSlots = [-1.5,-0.5,0.5,1.5].map(k=>({ x:mid + k*Math.min(110, W*0.12), y:kitY+6, r:slotR }));
    L.trash = { x:Math.min(W-40, mid + 2.6*Math.min(110,W*0.12)), y:kitY+6, r:slotR };
    L.queueX = Math.max(48, W*0.08);
    const qTop = kitY + 70, qBot = H - 50;
    L.queue = [0,1,2].map(i=>({ x:L.queueX, y: qTop + (qBot-qTop)*(i+0.15)/3 }));
    const midX = W*0.52, midY = H*0.58;
    const gapX = Math.max(200, W*0.30), gapY = Math.max(140, H*0.36);
    L.tableR = Math.max(48, Math.min(70, Math.min(gapX, gapY)*0.28));
    L.tables = [
      { x:midX-gapX/2, y:midY-gapY/2 },
      { x:midX+gapX/2, y:midY-gapY/2 },
      { x:midX-gapX/2, y:midY+gapY/2 },
      { x:midX+gapX/2, y:midY+gapY/2 },
    ];
    L.exit = { x:Math.max(60, W*0.08), y:H-28 };
    L.playerStart = { x:midX, y:midY };
  }
  return L;
}
function fitCanvas(){
  if(!D || !D.canvas || !D.root) return;
  const stage = D.root.querySelector('.rd-stage');
  if(!stage) return;
  const r = stage.getBoundingClientRect();
  const w = Math.max(280, Math.floor(r.width));
  const h = Math.max(260, Math.floor(r.height));
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent||'') || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const dpr = Math.min(apple?1.5:2, window.devicePixelRatio || 1);
  D.CW = w; D.CH = h;
  D.canvas.style.width = w+'px';
  D.canvas.style.height = h+'px';
  D.canvas.width = Math.round(w * dpr);
  D.canvas.height = Math.round(h * dpr);
  D.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  D.layout = computeLayout(w, h);
  applyLayoutPositions();
}
function applyLayoutPositions(){
  const L = D.layout, W = D && D.world;
  if(!L) return;
  if(!W) return;
  W.tables.forEach((t,i)=>{
    t.x = L.tables[i].x; t.y = L.tables[i].y; t.r = L.tableR;
  });
  W.kitchenSlots.forEach((k,i)=>{
    k.x = L.kitchenSlots[i].x; k.y = L.kitchenSlots[i].y; k.r = L.kitchenSlots[i].r;
  });
  W.trashCan.x = L.trash.x; W.trashCan.y = L.trash.y; W.trashCan.r = L.trash.r;
  W.exit = L.exit;
  W.queueSlots.forEach((s,i)=>{ s.x = L.queue[i].x; s.y = L.queue[i].y; });
  // remap waiter waypoints to new table/kitchen coords
  if(W.player && W.player.queue){
    W.player.queue.forEach(q=>{
      if(q.type==='table' && q.target){ q.x = q.target.x; q.y = q.target.y - (q.target.r||50) - 8; }
      if(q.type==='kitchen' && q.target){ q.x = q.target.x; q.y = q.target.y + (q.target.r||30) + 16; }
      if(q.type==='trash'){ q.x = W.trashCan.x; q.y = W.trashCan.y + 24; }
    });
  }
}

function makeWorld(){
  const L = D.layout || computeLayout(D.CW||800, D.CH||500);
  D.layout = L;
  const tables = L.tables.map((p,i)=>({
    id:i, x:p.x, y:p.y, r:L.tableR,
    seatColor: COLORS[i % COLORS.length],
    state:'empty', party:null, order:null, timer:0, arriving:0,
  }));
  return {
    tables,
    kitchenSlots: L.kitchenSlots.map(p=>({ x:p.x, y:p.y, r:p.r, cooking:false, item:null, tableId:null, timer:0 })),
    trashCan: { x:L.trash.x, y:L.trash.y, r:L.trash.r },
    exit: L.exit,
    pendingKitchen: [],
    queueSlots: L.queue.map(p=>({ x:p.x, y:p.y, party:null })),
    waiting: [],
    walkers: [],
    floaters: [],
    bubbles: Array.from({length:16},()=>({ x:Math.random()*(L.W||800), y:Math.random()*(L.H||500), r:3+Math.random()*7, s:18+Math.random()*36 })),
    player: {
      x:L.playerStart.x, y:L.playerStart.y,
      targetX:L.playerStart.x, targetY:L.playerStart.y,
      hands:[], speed: (D.cfg && D.cfg.speed) || 300,
      queue:[], facing:1, walkPhase:0, waiting:false,
    },
    selectedParty: null,
    dragging: null, dragPos:{x:0,y:0}, dragMoved:false, dragPointer:null,
    combo:1, lastAction:null, lastColorMatch:null,
  };
}

export function openReefDiner(opts={}){
  closeReefDiner();
  const P = loadDashSave();
  const waiterId = opts.waiterId || (opts.S && opts.S.selChar) || 'ollie';
  const chars = opts.chars || [];
  const waiter = chars.find(c=>c.id===waiterId) || { id:waiterId, name:'Ollie the Otter', em:'🦦', color:0x7a4a2c, art:true };
  const art = opts.artUrl || defaultArt;
  D = {
    opts, P, waiter, waiterId, art,
    pool: customerPool(opts, waiterId),
    nextCust: 0,
    root:null, canvas:null, ctx:null,
    running:false, over:false, paid:false, payout:null, winInfo:null, cheered:false,
    level: Math.min(P.unlocked||1, 3),
    score:0, timeLeft:90, goal:80, cfg:LEVELS[0],
    spawnTimer:1.2, world:null,
    raf:0, lastT:0, CW:800, CH:500, layout:null,
  };
  D.pool.forEach(c=>loadAvatar(c.id, art(c.id)));
  loadAvatar(waiter.id, art(waiter.id));

  if(!document.getElementById('reefDashCss') && !opts.noCss){
    const l=document.createElement('link');
    l.id='reefDashCss'; l.rel='stylesheet';
    l.href=new URL('./dash.css', import.meta.url).href;
    document.head.appendChild(l);
  }

  const root=document.createElement('div');
  root.id='reefDash';
  D.root=root;
  root.innerHTML = `
    <div class="rd-bg">${[0,1,2,3].map(i=>`<div class="ray" style="left:${6+i*24}%;opacity:${.4+.2*(i%2)}"></div>`).join('')}${Array.from({length:12},()=>{ const s=8+Math.random()*22; return `<i style="left:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${8+Math.random()*10}s;animation-delay:${-Math.random()*16}s"></i>`; }).join('')}</div>
    <div class="rd-wrap">
      <div class="rd-top">
        <button class="rd-btn blue rd-back" type="button" aria-label="Back">◀</button>
        <div class="rd-title"><small>REEF DINER</small><b class="rd-lvlname">${LEVELS[D.level-1].name}</b></div>
        <div class="rd-stats">
          <div class="rd-stat rd-score">⭐ 0 / ${LEVELS[D.level-1].goal}</div>
          <div class="rd-stat rd-combo">x1</div>
          <div class="rd-stat rd-time">⏱ 1:30</div>
          <div class="rd-stat rd-hands">🙌 —</div>
        </div>
      </div>
      <div class="rd-stage"><canvas></canvas></div>
    </div>
    <div class="rd-toast"></div>
    <div class="rd-modal"></div>`;
  document.body.appendChild(root);
  const hello=document.getElementById('toast');
  if(hello) hello.classList.remove('on');
  D.canvas = root.querySelector('canvas');
  D.ctx = D.canvas.getContext('2d');
  D.canvas.addEventListener('pointerdown', onPointerDown);
  D.canvas.addEventListener('pointermove', onPointerMove);
  D.canvas.addEventListener('pointerup', onPointerUp);
  D.canvas.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('pointerdown', unlockAudio, {passive:true});
  root.querySelector('.rd-back').onclick = ()=>{ unlockAudio(); exitToLobby(); };
  D._onResize = ()=>fitCanvas();
  window.addEventListener('resize', D._onResize);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', D._onResize);
  D._ro = (typeof ResizeObserver!=='undefined') ? new ResizeObserver(()=>fitCanvas()) : null;
  if(D._ro) D._ro.observe(root.querySelector('.rd-stage'));
  showStartOverlay();
  requestAnimationFrame(()=>{ fitCanvas(); D.lastT = performance.now(); loop(D.lastT); });
  exposeApi();
  return { close: closeReefDiner };
}

export function closeReefDiner(){
  if(!D) return;
  if(D.raf) cancelAnimationFrame(D.raf);
  clearTimeout(D._toastT);
  if(D._onResize){
    window.removeEventListener('resize', D._onResize);
    if(window.visualViewport) window.visualViewport.removeEventListener('resize', D._onResize);
  }
  if(D._ro) try{ D._ro.disconnect(); }catch(e){}
  if(D.root && D.root.parentNode) D.root.parentNode.removeChild(D.root);
  if(window.__reefDiner && window.__reefDiner._owned) window.__reefDiner = null;
  D = null;
}

function exitToLobby(){
  const onExit = D && D.opts && D.opts.onExit;
  closeReefDiner();
  if(typeof onExit==='function') onExit();
}

function showStartOverlay(){
  if(!D) return;
  D.running=false; D.over=false; D.paid=false; D.payout=null; D.winInfo=null; D.cheered=false;
  const P=D.P;
  const modal=D.root.querySelector('.rd-modal');
  modal.classList.remove('hidden');
  const lvls = LEVELS.map(L=>{
    const lock = L.id > (P.unlocked||1);
    const best = (P.bests && P.bests[L.id]) || 0;
    return `<button type="button" class="rd-lvl ${L.id===D.level?'sel':''} ${lock?'lock':''}" data-lvl="${L.id}" ${lock?'disabled':''}>Lv ${L.id}<small>${lock?'🔒': (best?('Best ⭐'+best):L.name)}</small></button>`;
  }).join('');
  modal.innerHTML = `<div class="rd-card">
    <h2>REEF DINER 🍽️</h2>
    <p>Serve your friends at the underwater diner!</p>
    <ul class="rd-how">
      <li>Drag friends from the line onto a table (or tap them, then the table).</li>
      <li>Match their color ring to the table for a starfish bonus!</li>
      <li>Tap several places in a row — numbered waypoints show the route.</li>
      <li>Repeat the same job to build a combo (x2, x3, x4)!</li>
    </ul>
    <div class="rd-levels">${lvls}</div>
    <div class="rd-actions">
      <button type="button" class="rd-btn green rd-start">START SHIFT</button>
      <button type="button" class="rd-btn rd-lobby">BACK TO LOBBY</button>
    </div>
  </div>`;
  modal.querySelectorAll('.rd-lvl').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.lvl; if(id>(P.unlocked||1)) return;
    D.level=id; modal.querySelectorAll('.rd-lvl').forEach(x=>x.classList.toggle('sel', +x.dataset.lvl===id));
    updateHud();
  });
  modal.querySelector('.rd-start').onclick=()=>{ unlockAudio(); startShift(D.level); };
  modal.querySelector('.rd-lobby').onclick=()=>{ unlockAudio(); exitToLobby(); };
}

function startShift(level){
  if(!D) return;
  fitCanvas();
  const cfg = LEVELS[(level||1)-1] || LEVELS[0];
  D.level = cfg.id;
  D.cfg = cfg;
  D.score = 0;
  D.timeLeft = cfg.time;
  D.goal = cfg.goal;
  D.spawnTimer = 0.6;
  D.running = true;
  D.over = false;
  D.paid = false;
  D.payout = null;
  D.winInfo = null;
  D.cheered = false;
  D.world = makeWorld();
  D.world.player.speed = cfg.speed;
  D.root.querySelector('.rd-lvlname').textContent = cfg.name;
  D.root.querySelector('.rd-modal').classList.add('hidden');
  D.root.querySelector('.rd-modal').innerHTML = '';
  updateHud();
  spawnParty();
}

function endGame(){
  if(!D || D.over) return;
  D.running = false;
  D.over = true;
  const won = D.score >= D.goal;
  const P = D.P;
  P.best = Math.max(P.best||0, D.score);
  P.bests = P.bests || {1:0,2:0,3:0};
  P.bests[D.level] = Math.max(P.bests[D.level]||0, D.score);
  if(won && D.level >= (P.unlocked||1) && D.level < 3) P.unlocked = D.level + 1;
  writeDashSave(P);

  let rewardLine = won ? 'You hit the star goal!' : 'Almost! Try to reach the star goal next time.';
  if(!D.paid){
    D.paid = true;
    const host = D.opts || {};
    if(won && host.ECO && host.S){
      try{ host.ECO.ensureDay && host.ECO.ensureDay(host.S); }catch(e){}
      const e = host.ECO.dashEarn ? host.ECO.dashEarn(D.score, D.goal, true) : { earned:15, base:15, bonus:0 };
      host.S.coins = (host.S.coins||0) + e.earned;
      D.payout = e;
      D.winInfo = host.onWin ? host.onWin() : null;
      try{ host.save && host.save(); }catch(err){}
      const chest = D.winInfo && D.winInfo.chest;
      const need = (D.winInfo && D.winInfo.need) || 5;
      const wins = (D.winInfo && D.winInfo.wins) || 0;
      rewardLine = `You earned <b>⭐ ${e.earned}</b> starfish!` + (chest ? ' 🎁 A bonus chest is coming!' : ` 🎁 Chest in ${wins}/${need} wins.`);
    }
  }

  const nextUnlock = won && D.level < 3 && (P.unlocked||1) >= D.level+1;
  const modal = D.root.querySelector('.rd-modal');
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="rd-card">
    <h2>${won ? 'STAR GOAL! ⭐' : 'SHIFT OVER'}</h2>
    <p>You served up <b>⭐ ${D.score}</b>! Goal was ⭐ ${D.goal}.</p>
    <p class="rd-reward">${rewardLine}</p>
    <div class="rd-actions">
      ${nextUnlock ? `<button type="button" class="rd-btn gold rd-next">NEXT LEVEL</button>` : ''}
      <button type="button" class="rd-btn green rd-again">PLAY AGAIN</button>
      <button type="button" class="rd-btn rd-lobby">BACK TO LOBBY</button>
    </div>
  </div>`;
  const again = modal.querySelector('.rd-again');
  if(again) again.onclick = ()=>{ unlockAudio(); startShift(D.level); };
  const next = modal.querySelector('.rd-next');
  if(next) next.onclick = ()=>{ unlockAudio(); startShift(D.level+1); };
  modal.querySelector('.rd-lobby').onclick = ()=>{ unlockAudio(); exitToLobby(); };
}

function updateHud(){
  if(!D || !D.root) return;
  const cfg = D.cfg || LEVELS[D.level-1];
  const sc = D.root.querySelector('.rd-score');
  const tm = D.root.querySelector('.rd-time');
  const hd = D.root.querySelector('.rd-hands');
  const cmb = D.root.querySelector('.rd-combo');
  if(sc) sc.textContent = `⭐ ${D.score} / ${D.goal || cfg.goal}`;
  if(tm){
    const t = Math.max(0, Math.ceil(D.timeLeft||0));
    tm.textContent = `⏱ ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  }
  if(hd){
    const hands = (D.world && D.world.player.hands) || [];
    hd.textContent = '🙌 ' + (hands.length ? hands.map(i=>i.em).join(' ') : '—');
  }
  if(cmb){
    const c = (D.world && D.world.combo) || 1;
    cmb.textContent = `x${c}`;
    cmb.classList.toggle('hot', c>1);
  }
}

function canvasPos(e){
  const r = D.canvas.getBoundingClientRect();
  const src = (e.changedTouches && e.changedTouches[0]) || e;
  const x = (src.clientX - r.left) * ((D.CW||r.width) / r.width);
  const y = (src.clientY - r.top) * ((D.CH||r.height) / r.height);
  return { x, y };
}

function partyAt(mx, my){
  const W = D.world;
  if(!W) return null;
  for(const p of W.waiting){
    const n = p.size || 1;
    const hit = Math.hypot(mx - p.x, my - p.y) < 48 || (n>1 && Math.hypot(mx - (p.x+28), my - p.y) < 42);
    if(hit) return p;
  }
  return null;
}
function tableAt(mx, my, extra){
  const pad = extra || 0;
  return D.world.tables.find(t=>Math.hypot(mx-t.x, my-t.y) < (t.r||56)+pad);
}
function kitchenAt(mx, my){
  return D.world.kitchenSlots.find(k=>Math.hypot(mx-k.x, my-k.y) < (k.r||32)+16);
}

function onPointerDown(e){
  unlockAudio();
  if(!D || !D.running || !D.world) return;
  e.preventDefault();
  const {x,y} = canvasPos(e);
  const W = D.world;
  const p = partyAt(x,y);
  if(p){
    W.dragging = p;
    W.dragPos = {x,y};
    W.dragMoved = false;
    W.dragPointer = e.pointerId;
    try{ D.canvas.setPointerCapture(e.pointerId); }catch(err){}
    playSound('pop');
    return;
  }
  queueWorldTap(x,y);
}

function onPointerMove(e){
  if(!D || !D.world || !D.world.dragging) return;
  e.preventDefault();
  const {x,y} = canvasPos(e);
  if(Math.hypot(x-D.world.dragPos.x, y-D.world.dragPos.y) > 8) D.world.dragMoved = true;
  D.world.dragPos = {x,y};
}

function onPointerUp(e){
  if(!D || !D.world) return;
  const W = D.world;
  if(!W.dragging) return;
  e.preventDefault();
  const {x,y} = canvasPos(e);
  const party = W.dragging;
  const dragged = W.dragMoved;
  W.dragging = null; W.dragMoved = false; W.dragPointer = null;
  try{ D.canvas.releasePointerCapture(e.pointerId); }catch(err){}
  const t = tableAt(x,y, 18);
  if(dragged){
    if(t && t.state==='empty') seatParty(party, t);
    return;
  }
  // tap-then-tap fallback: select, or seat if a party is already selected and this was a light tap on the line
  W.selectedParty = (W.selectedParty===party) ? null : party;
  playSound('pop');
}

function queueWorldTap(x,y){
  const W = D.world;
  const t = tableAt(x,y, 12);
  if(t){
    if(t.state==='empty' && W.selectedParty){
      seatParty(W.selectedParty, t);
      return;
    }
    if(t.state!=='empty' && t.state!=='walkingToTable'){
      enqueue({ type:'table', target:t, x:t.x, y:t.y - (t.r||50) - 8 });
      playSound('pop');
    }
    return;
  }
  const k = kitchenAt(x,y);
  if(k){
    enqueue({ type:'kitchen', target:k, x:k.x, y:k.y + (k.r||30) + 16 });
    playSound('pop');
    return;
  }
  if(Math.hypot(x-W.trashCan.x, y-W.trashCan.y) < (W.trashCan.r||28)+16){
    enqueue({ type:'trash', x:W.trashCan.x, y:W.trashCan.y + 24 });
    playSound('pop');
  }
}

function enqueue(act){
  const W = D.world;
  W.player.queue.push(act);
}

function nextMemberFromPool(){
  const c = D.pool[D.nextCust % D.pool.length];
  D.nextCust++;
  return {
    id:c.id, name:c.name, em:c.em||'🐠', color:c.color, art:c.art,
    img:loadAvatar(c.id, D.art(c.id)),
    walkPhase: Math.random()*6,
  };
}

function spawnParty(opts){
  const W = D.world;
  if(!W) return null;
  if(W.waiting.length >= 3) return null;
  const size = (opts && opts.size) || (Math.random() < 0.55 ? 1 : 2);
  const color = (opts && opts.color) || COLORS[Math.floor(Math.random()*COLORS.length)];
  const members = [];
  for(let i=0;i<size;i++) members.push(nextMemberFromPool());
  const slot = W.queueSlots[W.waiting.length] || W.queueSlots[W.queueSlots.length-1];
  const party = {
    size, color, members,
    patience:100, maxPatience:100,
    x: slot.x, y: slot.y,
  };
  W.waiting.push(party);
  playSound('pop');
  return party;
}

function seatParty(party, table){
  const W = D.world;
  if(!party || !table || table.state!=='empty') return false;
  const idx = W.waiting.indexOf(party);
  if(idx!==-1) W.waiting.splice(idx,1);
  if(W.selectedParty===party) W.selectedParty=null;
  if(W.dragging===party) W.dragging=null;

  let matched = false;
  if(party.color && table.seatColor && party.color.name===table.seatColor.name){
    matched = true;
    addScore(COLOR_MATCH_BONUS, table.x, table.y - (table.r||50) - 20, 'color', `Color match! +${COLOR_MATCH_BONUS} ⭐`);
    W.lastColorMatch = { tableId:table.id, bonus:COLOR_MATCH_BONUS };
    playSound('coin');
  } else {
    playSound('pop');
  }

  table.state = 'walkingToTable';
  table.party = party;
  table.arriving = party.size;
  party.patience = 100;
  party.maxPatience = 100;
  party.members.forEach((m, mIdx)=>{
    const destX = mIdx===0 ? table.x + (table.r||50)*0.72 : table.x - (table.r||50)*0.72;
    const destY = table.y + 2;
    W.walkers.push({
      member:m, party, table,
      x: party.x + mIdx*24, y: party.y,
      targetX: destX, targetY: destY,
      speed: 180, facing: destX>=party.x ? 1 : -1, walkPhase:m.walkPhase||0,
      ring: party.color.hex,
      kind:'seat',
      onArrive: ()=>{
        table.arriving = Math.max(0, (table.arriving||1)-1);
        if(table.state==='walkingToTable' && table.arriving<=0){
          table.state='reading';
          table.timer = D.cfg.read;
        }
      }
    });
  });
  return { ok:true, colorMatch:matched, bonus: matched?COLOR_MATCH_BONUS:0 };
}

function sendPartyExiting(table, happy){
  const W = D.world;
  if(!table.party) return;
  const party = table.party;
  party.members.forEach((m, idx)=>{
    const sx = idx===0 ? table.x + (table.r||50)*0.72 : table.x - (table.r||50)*0.72;
    W.walkers.push({
      member:m, party, table:null,
      x:sx, y:table.y,
      targetX: W.exit.x, targetY: W.exit.y,
      speed: happy? 190 : 240, facing: W.exit.x>=sx ? 1 : -1, walkPhase:m.walkPhase||0,
      ring: party.color && party.color.hex,
      kind:'exit', angry:!happy, onArrive:null,
    });
  });
}

function cookTime(){
  return Math.min(COOK_CAP, (D.cfg && D.cfg.cook) || 2);
}

function sendOrderToKitchen(item, tableId){
  const W = D.world;
  const dur = cookTime();
  const free = W.kitchenSlots.find(k=>!k.cooking && k.item===null);
  if(free){
    free.cooking = true;
    free.item = item;
    free.tableId = tableId;
    free.timer = dur;
    free.cookFor = dur;
  } else {
    W.pendingKitchen.push({ item, tableId });
  }
}
function flushKitchenQueue(){
  const W = D.world;
  while(W.pendingKitchen.length){
    const free = W.kitchenSlots.find(k=>!k.cooking && k.item===null);
    if(!free) break;
    const job = W.pendingKitchen.shift();
    const dur = cookTime();
    free.cooking = true;
    free.item = job.item;
    free.tableId = job.tableId;
    free.timer = dur;
    free.cookFor = dur;
  }
}

function addScore(n, x, y, kind, label){
  D.score += n;
  if(D.score < 0) D.score = 0;
  updateHud();
  if(x!=null){
    D.world.floaters.push({
      x, y, text: label || ((n>=0?'+':'')+n+' ⭐'),
      life:1.2, kind, color: kind==='color' ? '#ffe25a' : (n<0 ? '#ff8a8a' : '#7dfcff'),
    });
  }
  if(!D.cheered && D.score >= D.goal){
    D.cheered = true;
    toast('Star goal reached! ⭐ Keep going!');
  }
}

function awardPoints(base, actionType, x, y){
  const W = D.world;
  if(W.lastAction === actionType) W.combo = Math.min(COMBO_CAP, (W.combo||1)+1);
  else { W.combo = 1; W.lastAction = actionType; }
  const total = base * W.combo;
  const tag = W.combo>1 ? `+${total} ⭐ (x${W.combo}!)` : null;
  addScore(total, x, y, actionType, tag);
  if(W.combo>1) playSound('combo');
  updateHud();
  return total;
}

function processAction(act){
  const W = D.world;
  if(act.type==='table'){
    const t = act.target;
    if(!t) return 'done';
    if(t.state==='ready_to_order' && t.party){
      t.state = 'waiting_food';
      t.party.patience = 100;
      t.party.maxPatience = 100;
      sendOrderToKitchen(t.order, t.id);
      awardPoints(8, 'order', t.x, t.y - (t.r||50) - 16);
      playSound('pop');
      return 'done';
    } else if(t.state==='waiting_food' && t.order){
      const foodIdx = W.player.hands.findIndex(h=>h && t.order && h.id===t.order.id);
      if(foodIdx!==-1){
        W.player.hands.splice(foodIdx,1);
        t.state = 'eating';
        t.timer = D.cfg.eat;
        const add = 25 + Math.floor((t.party? t.party.patience : 0)/5);
        awardPoints(add, 'serve', t.x, t.y - (t.r||50) - 16);
        playSound('serve');
      }
      return 'done';
    } else if(t.state==='dirty'){
      t.state = 'empty';
      t.order = null;
      t.party = null;
      t.timer = 0;
      awardPoints(10, 'bus', t.x, t.y - (t.r||40) - 8);
      playSound('pop');
      return 'done';
    }
    return 'done';
  } else if(act.type==='kitchen'){
    const k = act.target;
    if(!k) return 'done';
    if(k.cooking){
      // Stay here and pick up the instant the dish is ready — no hidden extra wait.
      return 'wait';
    }
    if(k.item!==null && W.player.hands.length<2){
      W.player.hands.push(k.item);
      k.item = null;
      k.tableId = null;
      updateHud();
      playSound('pop');
      return 'done';
    }
    return 'done';
  } else if(act.type==='trash'){
    W.player.hands = [];
    updateHud();
    playSound('pop');
    return 'done';
  }
  return 'done';
}

function tryAdvanceWaiter(dt){
  const W = D.world;
  const p = W.player;
  if(!p.queue.length){
    p.walkPhase = 0;
    p.waiting = false;
    return;
  }
  const act = p.queue[0];
  const dx = act.x - p.x, dy = act.y - p.y, dist = Math.hypot(dx,dy);
  if(dist > 6){
    p.waiting = false;
    const step = p.speed * dt;
    if(dist <= step){ p.x=act.x; p.y=act.y; }
    else { p.x += dx/dist*step; p.y += dy/dist*step; }
    p.walkPhase += dt * 16;
    if(Math.abs(dx) > 2) p.facing = dx>0 ? 1 : -1;
    return;
  }
  p.x = act.x; p.y = act.y;
  const res = processAction(act);
  if(res==='wait'){
    p.waiting = true;
    p.walkPhase = 0;
    return;
  }
  p.waiting = false;
  p.queue.shift();
}

function cancelOrdersForTable(id){
  const W = D.world;
  W.pendingKitchen = W.pendingKitchen.filter(j=>j.tableId!==id);
  for(const k of W.kitchenSlots){
    if(k.tableId===id){ k.cooking=false; k.item=null; k.tableId=null; k.timer=0; }
  }
  // drop queued kitchen pickups for that table
  W.player.queue = W.player.queue.filter(a=>!(a.type==='kitchen' && a.target && a.target.tableId===id && !a.target.item && !a.target.cooking));
}

function update(dt){
  if(!D || !D.running || !D.world) return;
  const W = D.world, cfg = D.cfg;
  D.timeLeft -= dt;
  if(D.timeLeft <= 0){ D.timeLeft=0; updateHud(); endGame(); return; }

  D.spawnTimer -= dt;
  if(D.spawnTimer<=0){
    spawnParty();
    const elapsed = cfg.time - D.timeLeft;
    D.spawnTimer = Math.max(cfg.spawnMin, cfg.spawn0 - elapsed*0.03);
  }

  // waiting line spacing + patience
  for(let i=W.waiting.length-1;i>=0;i--){
    const p = W.waiting[i];
    const slot = W.queueSlots[i] || W.queueSlots[W.queueSlots.length-1];
    p.x += (slot.x - p.x) * Math.min(1, 8*dt);
    p.y += (slot.y - p.y) * Math.min(1, 8*dt);
    if(W.dragging===p) continue;
    p.patience -= cfg.queueDrain * dt;
    if(p.patience<=0){
      p.members.forEach((m,idx)=>{
        W.walkers.push({
          member:m, party:p, table:null,
          x:p.x+idx*24, y:p.y, targetX:W.exit.x, targetY:W.exit.y,
          speed:230, facing:-1, walkPhase:0, ring:p.color.hex, kind:'exit', angry:true,
        });
      });
      if(W.selectedParty===p) W.selectedParty=null;
      if(W.dragging===p) W.dragging=null;
      W.waiting.splice(i,1);
      addScore(-5, p.x, p.y-40, 'leave');
    }
  }

  // walkers
  for(let i=W.walkers.length-1;i>=0;i--){
    const wc = W.walkers[i];
    const dx=wc.targetX-wc.x, dy=wc.targetY-wc.y, dist=Math.hypot(dx,dy);
    if(dist>4){
      const step = wc.speed*dt;
      if(dist<=step){ wc.x=wc.targetX; wc.y=wc.targetY; }
      else { wc.x += dx/dist*step; wc.y += dy/dist*step; }
      wc.walkPhase += dt*13;
      if(Math.abs(dx)>2) wc.facing = dx>0 ? 1 : -1;
    } else {
      if(wc.onArrive) wc.onArrive();
      W.walkers.splice(i,1);
    }
  }

  for(const t of W.tables){
    if(t.state==='reading'){
      t.timer -= dt;
      if(t.timer<=0){
        t.state='ready_to_order';
        t.order = MENU[Math.floor(Math.random()*MENU.length)];
        playSound('pop');
      }
    } else if(t.state==='eating'){
      t.timer -= dt;
      if(t.timer<=0){
        sendPartyExiting(t, true);
        t.state='dirty';
        t.party=null;
        t.timer=0;
      }
    } else if(t.party && (t.state==='ready_to_order' || t.state==='waiting_food')){
      const drain = t.state==='waiting_food' ? cfg.tableDrain*0.75 : cfg.tableDrain;
      t.party.patience -= drain * dt;
      if(t.party.patience<=0){
        cancelOrdersForTable(t.id);
        sendPartyExiting(t, false);
        t.state='empty'; t.party=null; t.order=null; t.timer=0;
        addScore(-8, t.x, t.y-(t.r||50)-10, 'leave');
      }
    }
  }

  for(const k of W.kitchenSlots){
    if(k.cooking){
      k.timer -= dt;
      if(k.timer<=0){
        k.cooking=false; k.timer=0;
        // pick up immediately if the waiter is already standing here
        tryAdvanceWaiter(0);
      }
    }
  }
  flushKitchenQueue();
  tryAdvanceWaiter(dt);

  for(const b of W.bubbles){
    b.y -= b.s*dt;
    if(b.y < -10){ b.y = (D.CH||500)+10; b.x = Math.random()*(D.CW||800); }
  }
  W.floaters = W.floaters.filter(f=>{ f.life-=dt; f.y-=32*dt; return f.life>0; });
  updateHud();
}

function loop(now){
  if(!D) return;
  const dt = Math.min(0.05, Math.max(0, (now - D.lastT)/1000));
  D.lastT = now;
  update(dt);
  draw();
  D.raf = requestAnimationFrame(loop);
}

function chairPos(t, idx){
  const r = t.r||50;
  return { x: idx===0 ? t.x + r*0.72 : t.x - r*0.72, y: t.y+2 };
}

function drawTable(ctx, t, now){
  const W = D.world;
  const hover = W.dragging && t.state==='empty' && Math.hypot(W.dragPos.x-t.x, W.dragPos.y-t.y) < (t.r||56)+16;
  const r = t.r||52;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle='rgba(22,22,58,.22)';
  ctx.beginPath(); ctx.ellipse(0, r*0.28, r*1.05, r*0.38, 0, 0, Math.PI*2); ctx.fill();
  // color chairs
  for(const [sx,sy] of [[-r*0.72, 6],[r*0.72, 6]]){
    ctx.fillStyle = t.seatColor.hex;
    ctx.strokeStyle='#16163a'; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.roundRect(sx-16, sy-14, 32, 28, 8); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = hover ? '#fff3b0' : '#d9854a';
  ctx.strokeStyle = hover ? '#ffb703' : t.seatColor.hex;
  ctx.lineWidth = hover ? 7 : 5;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r*0.48, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
  ctx.stroke();
  ctx.fillStyle='#f0b07a';
  ctx.beginPath(); ctx.ellipse(0, -4, r*0.72, r*0.28, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  if(t.state==='empty'){
    ctx.fillStyle='rgba(22,22,58,.5)';
    ctx.font=`${Math.max(12, Math.round(r*0.22))}px "Lilita One",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OPEN', t.x, t.y-2);
  }
  if(t.party && t.state!=='walkingToTable' && t.state!=='dirty'){
    t.party.members.forEach((m, i)=>{
      const c = chairPos(t, i);
      drawAvatar(ctx, c.x, c.y-6, Math.max(20, r*0.38), m.img, m.color, m.em, { ring:t.party.color.hex, facing: i===0?-1:1 });
    });
    const pr = t.party.patience / (t.party.maxPatience||100);
    drawPatience(ctx, t.x, t.y - r*0.85, Math.max(48, r*0.9), pr);
    if(t.state==='ready_to_order'){
      ctx.font='28px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('✋', t.x, t.y - r*1.05);
    }
    if(t.state==='waiting_food' && t.order){
      ctx.font='24px serif'; ctx.textAlign='center';
      ctx.fillText(t.order.em, t.x + r*0.15, t.y - r*1.0);
    }
    if(t.state==='reading'){
      ctx.font='20px serif'; ctx.textAlign='center';
      ctx.fillText('📋', t.x, t.y - r*0.15);
    }
    if(t.state==='eating' && t.order){
      ctx.font='22px serif'; ctx.textAlign='center';
      ctx.fillText(t.order.em, t.x, t.y-4);
    }
  }
  if(t.state==='dirty'){
    ctx.font='30px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🍽️', t.x, t.y-6);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.font='12px "Lilita One",sans-serif';
    ctx.strokeText('BUS', t.x, t.y+r*0.28); ctx.fillText('BUS', t.x, t.y+r*0.28);
  }
}

function draw(){
  if(!D || !D.ctx) return;
  const ctx=D.ctx, W=D.world, CW=D.CW||800, CH=D.CH||500, L=D.layout;
  ctx.clearRect(0,0,CW,CH);
  const sky = ctx.createLinearGradient(0,0,0,CH);
  sky.addColorStop(0,'#4db7e8'); sky.addColorStop(.22,'#7ed0ef'); sky.addColorStop(.28,'#f3e2b0'); sky.addColorStop(1,'#e8c878');
  ctx.fillStyle=sky; ctx.fillRect(0,0,CW,CH);

  if(W){
    for(const b of W.bubbles){
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.5; ctx.stroke();
    }
  }

  const corals=[[24,CH-18,'#ff6b6b'],[70,CH-8,'#ffa94d'],[120,CH-16,'#ff7eb6'],[CW-50,CH-12,'#51cf66'],[CW-20,CH-8,'#845ef7'],[CW-100,CH-18,'#ff922b']];
  for(const [x,y,c] of corals){
    ctx.fillStyle=c; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-16,y); ctx.quadraticCurveTo(x-10,y-34,x,y-44); ctx.quadraticCurveTo(x+10,y-34,x+16,y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // kitchen counter
  if(L){
    const kw = L.kitchen.w, kx = L.kitchen.x-kw/2, ky = L.kitchen.y - L.kitchen.h*0.45, kh = L.kitchen.h;
    ctx.fillStyle='#c26a3a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.roundRect(kx, ky, kw, kh, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e8a05a';
    ctx.beginPath(); ctx.roundRect(kx+8, ky+8, Math.min(160, kw*0.3), 22, 8); ctx.fill();
    ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
    ctx.font='18px "Lilita One",sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.strokeText('KITCHEN', kx+16, ky+18); ctx.fillText('KITCHEN', kx+16, ky+18);
  }

  // LINE sign + EXIT
  ctx.fillStyle='#2b6fd6'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  const qx = L ? L.queueX : 70;
  ctx.beginPath(); ctx.roundRect(qx-50, (L && L.kitchen ? L.kitchen.y + 28 : 90), 100, 28, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffe25a'; ctx.font='16px "Lilita One",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('LINE', qx, (L && L.kitchen ? L.kitchen.y + 42 : 104));

  if(W && W.exit){
    ctx.fillStyle='#e07a5f'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(W.exit.x-48, W.exit.y-16, 96, 30, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='13px "Lilita One",sans-serif';
    ctx.fillText('EXIT', W.exit.x, W.exit.y);
  }

  if(!W){
    ctx.fillStyle='#fff'; ctx.font='28px "Lilita One",sans-serif'; ctx.textAlign='center';
    ctx.strokeStyle='#16163a'; ctx.lineWidth=5;
    ctx.strokeText('Tap START SHIFT!', CW/2, CH/2);
    ctx.fillText('Tap START SHIFT!', CW/2, CH/2);
    return;
  }

  // trash
  ctx.fillStyle='#5a6b4a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.roundRect(W.trashCan.x-26, W.trashCan.y-20, 52, 46, 12); ctx.fill(); ctx.stroke();
  ctx.font='22px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🗑️', W.trashCan.x, W.trashCan.y);
  ctx.fillStyle='#fff'; ctx.font='11px "Lilita One",sans-serif'; ctx.lineWidth=3; ctx.strokeStyle='#16163a';
  ctx.strokeText('TRASH', W.trashCan.x, W.trashCan.y+26); ctx.fillText('TRASH', W.trashCan.x, W.trashCan.y+26);

  // waypoints (under characters)
  const q = W.player.queue;
  if(q.length){
    ctx.lineWidth=3; ctx.strokeStyle='rgba(255,226,90,.7)';
    ctx.beginPath();
    ctx.moveTo(W.player.x, W.player.y);
    q.forEach(a=>ctx.lineTo(a.x, a.y));
    ctx.stroke();
    q.forEach((a, idx)=>{
      ctx.beginPath(); ctx.arc(a.x, a.y, 14, 0, Math.PI*2);
      ctx.fillStyle='#ffe25a'; ctx.fill();
      ctx.strokeStyle='#16163a'; ctx.lineWidth=3; ctx.stroke();
      ctx.fillStyle='#16163a'; ctx.font='bold 14px "Lilita One",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(idx+1), a.x, a.y+1);
    });
  }

  for(const t of W.tables) drawTable(ctx, t, performance.now());

  // kitchen slots — ready food bounces and glows
  const now = performance.now();
  for(const k of W.kitchenSlots){
    const ready = !k.cooking && k.item;
    const bounce = ready ? Math.sin(now/140)*5 : 0;
    if(ready){
      const glow = 10+Math.sin(now/180)*5;
      ctx.beginPath(); ctx.arc(k.x, k.y+bounce, (k.r||28)+8, 0, Math.PI*2);
      ctx.fillStyle=`rgba(255,226,90,${0.28+0.16*Math.sin(now/180)})`;
      ctx.fill();
      ctx.strokeStyle='#ffe25a'; ctx.lineWidth=4; ctx.stroke();
    }
    ctx.fillStyle = k.cooking ? '#ffe08a' : (k.item ? '#c6f0a8' : '#f4e0b8');
    ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(k.x, k.y+bounce, k.r||28, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    if(k.item){
      ctx.font=`${ready?28:24}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(k.item.em, k.x, k.y+1+bounce);
    } else {
      ctx.fillStyle='rgba(22,22,58,.35)'; ctx.font='11px "Lilita One",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('OPEN', k.x, k.y);
    }
    if(k.cooking){
      const tot = k.cookFor || cookTime(), left=Math.max(0,k.timer), prog=1-left/tot;
      ctx.strokeStyle='#2db86a'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(k.x, k.y, (k.r||28)+5, -Math.PI/2, -Math.PI/2 + prog*Math.PI*2); ctx.stroke();
    }
  }

  // waiting parties
  for(const p of W.waiting){
    if(W.dragging===p) continue;
    p.members.forEach((m,i)=>{
      drawAvatar(ctx, p.x+i*28, p.y, 28, m.img, m.color, m.em, { ring:p.color.hex, facing:1 });
    });
    drawPatience(ctx, p.x+(p.size>1?14:0), p.y+38, 56, p.patience/(p.maxPatience||100));
    if(W.selectedParty===p){
      ctx.strokeStyle='#ffe25a'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(p.x+(p.size>1?14:0), p.y, 40, 0, Math.PI*2); ctx.stroke();
    }
  }

  // walking guests (avatars bob + face direction)
  for(const wc of W.walkers){
    const bob = Math.abs(Math.sin(wc.walkPhase))*5;
    const m = wc.member;
    drawAvatar(ctx, wc.x, wc.y, 26, m.img, m.color, m.em, { bob, facing:wc.facing||1, ring:wc.ring });
    if(wc.angry){
      ctx.font='18px serif'; ctx.textAlign='center';
      ctx.fillText('💢', wc.x, wc.y-32);
    }
  }

  // waiter
  const p=W.player;
  const moving = p.queue.length && !p.waiting && Math.hypot((p.queue[0].x-p.x),(p.queue[0].y-p.y))>4;
  const wbob = moving ? Math.abs(Math.sin(p.walkPhase))*5 : Math.sin(performance.now()/400)*1.5;
  const wimg = loadAvatar(D.waiter.id, D.art(D.waiter.id));
  drawAvatar(ctx, p.x, p.y, 32, wimg, D.waiter.color, D.waiter.em||'🦦', { bob:wbob, facing:p.facing||1 });
  if(p.waiting){
    ctx.font='16px "Lilita One",sans-serif'; ctx.fillStyle='#ffe25a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.textAlign='center';
    ctx.strokeText('…', p.x, p.y-44); ctx.fillText('…', p.x, p.y-44);
  }
  if(p.hands.length){
    ctx.fillStyle='#f4e0b8'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    const hx = p.x + (p.facing>=0?22:-50-p.hands.length*16);
    ctx.beginPath(); ctx.roundRect(hx, p.y-18+wbob, 28+p.hands.length*16, 22, 8); ctx.fill(); ctx.stroke();
    p.hands.forEach((h,i)=>{ ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(h.em, hx+18+i*16, p.y-6+wbob); });
  }
  ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.font='13px "Lilita One",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.strokeText(firstName(D.waiter), p.x, p.y+34); ctx.fillText(firstName(D.waiter), p.x, p.y+34);

  if(W.selectedParty && !W.dragging){
    ctx.fillStyle='rgba(15,25,60,.82)'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(CW/2-200, CH-40, 400, 32, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffe25a'; ctx.font='16px "Lilita One",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Now tap an OPEN table to seat them!', CW/2, CH-24);
  }

  // dragged party under finger
  if(W.dragging){
    W.dragging.members.forEach((m,i)=>{
      drawAvatar(ctx, W.dragPos.x+i*28, W.dragPos.y, 30, m.img, m.color, m.em, { ring:W.dragging.color.hex, bob:Math.sin(now/80)*3, facing:1 });
    });
    // highlight hovered table
    const ht = tableAt(W.dragPos.x, W.dragPos.y, 18);
    if(ht && ht.state==='empty'){
      ctx.strokeStyle='#ffe25a'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(ht.x, ht.y, (ht.r||52)+8, 0, Math.PI*2); ctx.stroke();
    }
  }

  for(const f of W.floaters){
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color || '#ffe25a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
    ctx.font='18px "Lilita One",sans-serif'; ctx.textAlign='center';
    ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

function snapshot(){
  if(!D) return null;
  const W=D.world;
  return {
    running:!!D.running, over:!!D.over, paid:!!D.paid,
    level:D.level, score:D.score, timeLeft:D.timeLeft, goal:D.goal,
    payout:D.payout, winInfo:D.winInfo,
    combo: W? W.combo:1, lastAction: W && W.lastAction,
    cookTime: cookTime(), cookCap:COOK_CAP,
    colorMatch: W && W.lastColorMatch,
    waypoints: W ? W.player.queue.length : 0,
    hands: W ? W.player.hands.map(h=>h.id) : [],
    waiting: W ? W.waiting.map(p=>({ size:p.size, color:p.color&&p.color.name })) : [],
    tables: W ? W.tables.map(t=>({ id:t.id, state:t.state, order:t.order&&t.order.id, partySize:t.party?t.party.size:0, color:t.seatColor&&t.seatColor.name })) : [],
    kitchen: W ? W.kitchenSlots.map(k=>({ cooking:k.cooking, item:k.item&&k.item.id, tableId:k.tableId, timer:k.timer, ready:!(!k.cooking && !k.item) && !k.cooking && !!k.item })) : [],
    walkers: W ? W.walkers.length : 0,
    portrait: !!(D.layout && D.layout.port),
    canvas: { w:D.CW, h:D.CH },
  };
}

function tableById(id){ return D && D.world && D.world.tables.find(t=>t.id===id); }

function arriveWalkers(){
  const W=D.world;
  if(!W) return 0;
  const n=W.walkers.length;
  const copy=W.walkers.slice();
  W.walkers.length=0;
  copy.forEach(wc=>{ wc.x=wc.targetX; wc.y=wc.targetY; if(wc.onArrive) wc.onArrive(); });
  return n;
}

function flushWaiter(){
  const W=D.world;
  if(!W) return;
  let guard=20;
  while(W.player.queue.length && guard--){
    const act=W.player.queue[0];
    W.player.x=act.x; W.player.y=act.y;
    if(act.type==='kitchen' && act.target && act.target.cooking){
      act.target.cooking=false; act.target.timer=0;
    }
    const res=processAction(act);
    if(res==='wait'){
      // should be ready now
      processAction(act);
    }
    W.player.queue.shift();
  }
  updateHud();
}

function simulateDeluxeShift(){
  if(!D) return { ok:false, reason:'no diner' };
  if(!D.running) startShift(D.level||1);
  const W=D.world;
  W.waiting.length=0;
  // 2-guest party whose ring matches table 0
  const t0=W.tables[0], t1=W.tables[1];
  const pA = spawnParty({ size:2, color:t0.seatColor });
  const seatA = seatParty(pA, t0);
  arriveWalkers();
  t0.state='ready_to_order'; t0.order = MENU[0]; t0.timer=0;

  const pB = spawnParty({ size:1, color: COLORS[(COLORS.indexOf(t0.seatColor)+1)%COLORS.length] });
  const seatB = seatParty(pB, t1);
  arriveWalkers();
  t1.state='ready_to_order'; t1.order = MENU[1]; t1.timer=0;

  // chain: take both orders, then kitchen pickups, then both serves, then both buses
  enqueue({ type:'table', target:t0, x:t0.x, y:t0.y-(t0.r||50)-8 });
  enqueue({ type:'table', target:t1, x:t1.x, y:t1.y-(t1.r||50)-8 });
  const chained = W.player.queue.length;
  flushWaiter(); // both orders in (combo on second order)

  // finish cooks if still going and pick up
  W.kitchenSlots.forEach(k=>{ if(k.item){ k.cooking=false; k.timer=0; } });
  W.kitchenSlots.forEach(k=>{
    if(k.item) enqueue({ type:'kitchen', target:k, x:k.x, y:k.y+(k.r||30)+16 });
  });
  flushWaiter();

  enqueue({ type:'table', target:t0, x:t0.x, y:t0.y-(t0.r||50)-8 });
  enqueue({ type:'table', target:t1, x:t1.x, y:t1.y-(t1.r||50)-8 });
  flushWaiter(); // two serves → combo

  // finish eating instantly and bus
  if(t0.state==='eating'){ sendPartyExiting(t0,true); t0.state='dirty'; t0.party=null; t0.timer=0; }
  if(t1.state==='eating'){ sendPartyExiting(t1,true); t1.state='dirty'; t1.party=null; t1.timer=0; }
  enqueue({ type:'table', target:t0, x:t0.x, y:t0.y-(t0.r||40)-8 });
  enqueue({ type:'table', target:t1, x:t1.x, y:t1.y-(t1.r||40)-8 });
  const busWaypoints = W.player.queue.length;
  flushWaiter();

  return {
    ok: true,
    partySize: 2,
    colorMatch: !!(seatA && seatA.colorMatch),
    colorBonus: seatA && seatA.bonus,
    chained,
    combo: W.combo,
    lastAction: W.lastAction,
    served: D.score,
    bussed: t0.state==='empty' && t1.state==='empty',
    tables: [t0.state, t1.state],
    score: D.score,
    cookTime: cookTime(),
    state: snapshot(),
    busWaypoints,
    seatB: !!(seatB && seatB.ok),
  };
}

function exposeApi(){
  window.__reefDiner = {
    _owned:true,
    get running(){ return !!(D && D.running); },
    get state(){ return snapshot(); },
    start(level){ startShift(level||D.level||1); },
    close: closeReefDiner,
    exit: exitToLobby,
    spawn: (o)=>spawnParty(o),
    tick(dt){ update(dt||0.05); draw(); },
    setTime(t){ if(D){ D.timeLeft=t; updateHud(); } },
    addScore(n){ if(D) addScore(n); },
    endNow(){ endGame(); },
    simulateShift(){ return simulateDeluxeShift(); },
    fit: fitCanvas,
    setCombo(n){ if(D&&D.world){ D.world.combo=clamp(n|0,1,4); updateHud(); draw(); } },
    queueWaypoints(n){
      if(!D||!D.world) return 0;
      const W=D.world;
      W.player.queue.length=0;
      const pts = W.tables.slice(0, n||3);
      pts.forEach(t=>enqueue({ type:'table', target:t, x:t.x, y:t.y-(t.r||50)-8 }));
      draw();
      return W.player.queue.length;
    },
    dragSeat(pi, ti){
      const W=D.world; if(!W) return null;
      const party=W.waiting[pi]; const t=tableById(ti);
      if(!party||!t) return null;
      return seatParty(party, t);
    },
    arrive: arriveWalkers,
    flush: flushWaiter,
    cookTimes(){ return { old:[2.4,2.8,3.2], now:LEVELS.map(L=>L.cook), cap:COOK_CAP }; },
  };
}
