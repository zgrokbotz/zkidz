/* Reef Diner — canvas diner-dash mini game. Core loop from Zander's Diner Dash (queue, tables, raised-hand orders, kitchen timers, carry 2, trash, bussing, patience, timed shift + star goal). */
const SAVE_KEY = 'zkidz_dash_v1';
const CW = 800, CH = 500;
const MENU = [
  { id:'burger',   em:'🍔', name:'Kelp Burger' },
  { id:'pizza',    em:'🍕', name:'Shell Pizza' },
  { id:'tea',      em:'🧋', name:'Bubble Tea' },
  { id:'smoothie', em:'🥤', name:'Sea-Grape Smoothie' },
  { id:'ice',      em:'🍦', name:'Ice Cream' },
];
const LEVELS = [
  { id:1, name:'Lunch Rush',  time:90, goal:80,  cook:2.4, eat:3.2, read:1.2, queueDrain:2.0, tableDrain:1.8, spawn0:6.5, spawnMin:5.0 },
  { id:2, name:'Dinner Wave', time:90, goal:120, cook:2.8, eat:3.5, read:1.4, queueDrain:2.4, tableDrain:2.3, spawn0:6.0, spawnMin:4.2 },
  { id:3, name:'Star Shift',  time:90, goal:160, cook:3.2, eat:3.8, read:1.5, queueDrain:2.8, tableDrain:2.7, spawn0:5.2, spawnMin:3.8 },
];

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
function loadAvatar(id, url){
  if(avatars[id]) return avatars[id];
  const img = new Image();
  img.decoding = 'async';
  img.src = url || defaultArt(id);
  avatars[id] = img;
  return img;
}
function drawAvatar(ctx, x, y, r, img, color, em){
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath();
  ctx.fillStyle = hex(color);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if(img && img.complete && img.naturalWidth){
    const s = Math.max(r*2/img.naturalWidth, r*2/img.naturalHeight) * 1.08;
    const w = img.naturalWidth*s, h = img.naturalHeight*s;
    ctx.drawImage(img, x-w/2, y-h/2 - r*0.08, w, h);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(r*1.2)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(em||'🐠', x, y+2);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(3, r*0.12);
  ctx.strokeStyle = '#16163a';
  ctx.stroke();
  ctx.restore();
}
function drawPatience(ctx, x, y, w, p){
  const h=8;
  ctx.fillStyle='#16163a';
  ctx.beginPath(); ctx.roundRect(x-w/2-1, y-1, w+2, h+2, 4); ctx.fill();
  const t = clamp(p/100, 0, 1);
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
  ].filter(c=>c.id!==waiterId);
  return list.length ? list : [{id:'stella',name:'Stella the Starfish',em:'⭐',color:0xff7a1f,art:true}];
}

function makeWorld(){
  return {
    queueSlots: [
      { x:70, y:170, customer:null },
      { x:70, y:270, customer:null },
      { x:70, y:370, customer:null },
    ],
    tables: [
      { id:0, x:300, y:210, state:'empty', customer:null, order:null, timer:0 },
      { id:1, x:540, y:210, state:'empty', customer:null, order:null, timer:0 },
      { id:2, x:300, y:385, state:'empty', customer:null, order:null, timer:0 },
      { id:3, x:540, y:385, state:'empty', customer:null, order:null, timer:0 },
    ],
    kitchenSlots: [
      { x:250, y:70, cooking:false, item:null, tableId:null, timer:0 },
      { x:350, y:70, cooking:false, item:null, tableId:null, timer:0 },
      { x:450, y:70, cooking:false, item:null, tableId:null, timer:0 },
      { x:550, y:70, cooking:false, item:null, tableId:null, timer:0 },
    ],
    trashCan: { x:720, y:70 },
    pendingKitchen: [],
    player: { x:420, y:290, targetX:420, targetY:290, hands:[], speed:320 },
    selectedCustomer: null,
    pendingAction: null,
    bubbles: Array.from({length:18},()=>({ x:Math.random()*CW, y:Math.random()*CH, r:3+Math.random()*7, s:18+Math.random()*36 })),
    floaters: [],
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
    raf:0, lastT:0,
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
          <div class="rd-stat rd-time">⏱ 1:30</div>
          <div class="rd-stat rd-hands">🙌 —</div>
        </div>
      </div>
      <div class="rd-stage"><canvas width="${CW}" height="${CH}"></canvas></div>
    </div>
    <div class="rd-toast"></div>
    <div class="rd-modal"></div>`;
  document.body.appendChild(root);
  const hello=document.getElementById('toast');
  if(hello) hello.classList.remove('on');
  D.canvas = root.querySelector('canvas');
  D.ctx = D.canvas.getContext('2d');
  D.canvas.addEventListener('pointerup', onPointer, {passive:false});
  D.canvas.addEventListener('pointerdown', e=>{ e.preventDefault(); }, {passive:false});
  root.querySelector('.rd-back').onclick = ()=>{ if(D.running){ /* abandon shift, no payout */ } exitToLobby(); };
  showStartOverlay();
  D.lastT = performance.now();
  loop(D.lastT);
  exposeApi();
  return { close: closeReefDiner };
}

export function closeReefDiner(){
  if(!D) return;
  if(D.raf) cancelAnimationFrame(D.raf);
  clearTimeout(D._toastT);
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
      <li>Tap a waiting friend, then an empty table to seat them.</li>
      <li>When they raise a hand, tap the table to take the order.</li>
      <li>Pick up food at the kitchen (you can carry 2) and serve it.</li>
      <li>Bus dirty dishes, and use the trash if you grab the wrong plate.</li>
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
  modal.querySelector('.rd-start').onclick=()=>startShift(D.level);
  modal.querySelector('.rd-lobby').onclick=()=>exitToLobby();
}

function startShift(level){
  if(!D) return;
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
  D.root.querySelector('.rd-lvlname').textContent = cfg.name;
  D.root.querySelector('.rd-modal').classList.add('hidden');
  D.root.querySelector('.rd-modal').innerHTML = '';
  updateHud();
  spawnCustomer();
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
  if(again) again.onclick = ()=>startShift(D.level);
  const next = modal.querySelector('.rd-next');
  if(next) next.onclick = ()=>startShift(D.level+1);
  modal.querySelector('.rd-lobby').onclick = ()=>exitToLobby();
}

function updateHud(){
  if(!D || !D.root) return;
  const cfg = D.cfg || LEVELS[D.level-1];
  const sc = D.root.querySelector('.rd-score');
  const tm = D.root.querySelector('.rd-time');
  const hd = D.root.querySelector('.rd-hands');
  if(sc) sc.textContent = `⭐ ${D.score} / ${D.goal || cfg.goal}`;
  if(tm){
    const t = Math.max(0, Math.ceil(D.timeLeft||0));
    tm.textContent = `⏱ ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  }
  if(hd){
    const hands = (D.world && D.world.player.hands) || [];
    hd.textContent = '🙌 ' + (hands.length ? hands.map(i=>i.em).join(' ') : '—');
  }
}

function canvasPos(e){
  const r = D.canvas.getBoundingClientRect();
  const src = (e.changedTouches && e.changedTouches[0]) || e;
  const x = (src.clientX - r.left) * (CW / r.width);
  const y = (src.clientY - r.top) * (CH / r.height);
  return { x, y };
}

function onPointer(e){
  if(!D || !D.running || !D.world) return;
  e.preventDefault();
  const {x:mx, y:my} = canvasPos(e);
  const W = D.world;

  for(const slot of W.queueSlots){
    if(slot.customer && Math.hypot(mx-slot.x, my-slot.y) < 48){
      W.selectedCustomer = (W.selectedCustomer===slot) ? null : slot;
      return;
    }
  }
  for(const t of W.tables){
    if(Math.hypot(mx-t.x, my-t.y) < 64){
      if(t.state==='empty' && W.selectedCustomer){
        t.customer = W.selectedCustomer.customer;
        t.customer.patience = 100;
        t.state = 'reading';
        t.timer = D.cfg.read;
        W.selectedCustomer.customer = null;
        W.selectedCustomer = null;
        return;
      }
      W.player.targetX = t.x;
      W.player.targetY = t.y - 48;
      W.pendingAction = { type:'table', target:t };
      return;
    }
  }
  for(const k of W.kitchenSlots){
    if(Math.hypot(mx-k.x, my-k.y) < 50){
      W.player.targetX = k.x;
      W.player.targetY = k.y + 58;
      W.pendingAction = { type:'kitchen', target:k };
      return;
    }
  }
  if(Math.hypot(mx-W.trashCan.x, my-W.trashCan.y) < 50){
    W.player.targetX = W.trashCan.x;
    W.player.targetY = W.trashCan.y + 58;
    W.pendingAction = { type:'trash' };
  }
}

function executePendingAction(){
  const W = D.world;
  if(!W.pendingAction) return;
  const act = W.pendingAction;
  W.pendingAction = null;
  if(act.type==='table'){
    const t = act.target;
    if(t.state==='ready_to_order' && t.customer){
      t.state = 'waiting_food';
      t.customer.patience = 100;
      sendOrderToKitchen(t.order, t.id);
    } else if(t.state==='waiting_food' && t.order){
      const foodIdx = W.player.hands.findIndex(h=>h && t.order && h.id===t.order.id);
      if(foodIdx!==-1){
        W.player.hands.splice(foodIdx,1);
        t.state = 'eating';
        t.timer = D.cfg.eat;
        const add = 25 + Math.floor((t.customer? t.customer.patience : 0)/5);
        addScore(add, t.x, t.y-70, 'serve');
      }
    } else if(t.state==='dirty'){
      t.state = 'empty';
      t.order = null;
      t.customer = null;
      t.timer = 0;
      addScore(10, t.x, t.y-50, 'bus');
    }
  } else if(act.type==='kitchen'){
    const k = act.target;
    if(!k.cooking && k.item!==null && W.player.hands.length<2){
      W.player.hands.push(k.item);
      k.item = null;
      k.tableId = null;
      updateHud();
    }
  } else if(act.type==='trash'){
    W.player.hands = [];
    updateHud();
  }
}

function sendOrderToKitchen(item, tableId){
  const W = D.world;
  const free = W.kitchenSlots.find(k=>!k.cooking && k.item===null);
  if(free){
    free.cooking = true;
    free.item = item;
    free.tableId = tableId;
    free.timer = D.cfg.cook;
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
    free.cooking = true;
    free.item = job.item;
    free.tableId = job.tableId;
    free.timer = D.cfg.cook;
  }
}

function addScore(n, x, y, kind){
  D.score += n;
  if(D.score < 0) D.score = 0;
  updateHud();
  if(x!=null) D.world.floaters.push({ x, y, text:(n>=0?'+':'')+n+' ⭐', life:1, kind });
  if(!D.cheered && D.score >= D.goal){
    D.cheered = true;
    toast('Star goal reached! ⭐ Keep going!');
  }
}

function spawnCustomer(){
  const W = D.world;
  const slot = W.queueSlots.find(s=>!s.customer);
  if(!slot) return false;
  const c = D.pool[D.nextCust % D.pool.length];
  D.nextCust++;
  slot.customer = {
    id:c.id, name:c.name, em:c.em||'🐠', color:c.color, art:c.art,
    patience:100, img:loadAvatar(c.id, D.art(c.id)),
  };
  return true;
}

function cancelOrdersForTable(id){
  const W = D.world;
  W.pendingKitchen = W.pendingKitchen.filter(j=>j.tableId!==id);
  for(const k of W.kitchenSlots){
    if(k.tableId===id){ k.cooking=false; k.item=null; k.tableId=null; k.timer=0; }
  }
}

function update(dt){
  if(!D || !D.running || !D.world) return;
  const W = D.world, cfg = D.cfg;
  D.timeLeft -= dt;
  if(D.timeLeft <= 0){ D.timeLeft=0; updateHud(); endGame(); return; }

  D.spawnTimer -= dt;
  if(D.spawnTimer<=0){
    spawnCustomer();
    const elapsed = cfg.time - D.timeLeft;
    D.spawnTimer = Math.max(cfg.spawnMin, cfg.spawn0 - elapsed*0.03);
  }

  for(const slot of W.queueSlots){
    if(!slot.customer) continue;
    slot.customer.patience -= cfg.queueDrain * dt;
    if(slot.customer.patience<=0){
      if(W.selectedCustomer===slot) W.selectedCustomer=null;
      slot.customer=null;
      addScore(-5, slot.x, slot.y-40, 'leave');
    }
  }

  for(const t of W.tables){
    if(t.state==='reading'){
      t.timer -= dt;
      if(t.timer<=0){
        t.state='ready_to_order';
        t.order = MENU[Math.floor(Math.random()*MENU.length)];
      }
    } else if(t.state==='eating'){
      t.timer -= dt;
      if(t.timer<=0){
        t.state='dirty';
        t.customer=null;
        t.timer=0;
      }
    } else if(t.customer && (t.state==='ready_to_order' || t.state==='waiting_food')){
      const drain = t.state==='waiting_food' ? cfg.tableDrain*0.75 : cfg.tableDrain;
      t.customer.patience -= drain * dt;
      if(t.customer.patience<=0){
        cancelOrdersForTable(t.id);
        t.state='empty'; t.customer=null; t.order=null; t.timer=0;
        addScore(-8, t.x, t.y-60, 'leave');
      }
    }
  }

  for(const k of W.kitchenSlots){
    if(k.cooking){
      k.timer -= dt;
      if(k.timer<=0){ k.cooking=false; k.timer=0; }
    }
  }
  flushKitchenQueue();

  const p = W.player;
  const dx=p.targetX-p.x, dy=p.targetY-p.y, dist=Math.hypot(dx,dy);
  if(dist < p.speed*dt){ p.x=p.targetX; p.y=p.targetY; executePendingAction(); }
  else if(dist>0){ p.x += dx/dist*p.speed*dt; p.y += dy/dist*p.speed*dt; }

  for(const b of W.bubbles){
    b.y -= b.s*dt;
    if(b.y < -10){ b.y = CH+10; b.x = Math.random()*CW; }
  }
  W.floaters = W.floaters.filter(f=>{ f.life-=dt; f.y-=28*dt; return f.life>0; });
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

function drawTable(ctx, t){
  ctx.save();
  ctx.translate(t.x, t.y);
  // shadow
  ctx.fillStyle='rgba(22,22,58,.22)';
  ctx.beginPath(); ctx.ellipse(0, 18, 62, 22, 0, 0, Math.PI*2); ctx.fill();
  // coral/wood table
  ctx.fillStyle='#d9854a';
  ctx.strokeStyle='#16163a'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.ellipse(0, 0, 58, 28, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#f0b07a';
  ctx.beginPath(); ctx.ellipse(0, -4, 46, 18, 0, 0, Math.PI*2); ctx.fill();
  // seats
  for(const [sx,sy] of [[-44,16],[44,16],[-20,28],[20,28]]){
    ctx.fillStyle='#c9a36a';
    ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(sx,sy,10,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  if(t.state==='empty'){
    ctx.fillStyle='rgba(22,22,58,.45)';
    ctx.font='13px "Lilita One",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OPEN', t.x, t.y-4);
  }
  if(t.customer && t.state!=='dirty'){
    const img = t.customer.img || loadAvatar(t.customer.id, D.art(t.customer.id));
    drawAvatar(ctx, t.x, t.y-36, 28, img, t.customer.color, t.customer.em);
    drawPatience(ctx, t.x, t.y-70, 56, t.customer.patience);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
    ctx.font='12px "Lilita One",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.strokeText(firstName(t.customer), t.x, t.y-86);
    ctx.fillText(firstName(t.customer), t.x, t.y-86);
    if(t.state==='ready_to_order'){
      ctx.font='28px serif';
      ctx.fillText('✋', t.x+26, t.y-58);
    }
    if(t.state==='waiting_food' && t.order){
      ctx.font='22px serif';
      ctx.fillText(t.order.em, t.x+28, t.y-54);
    }
    if(t.state==='reading'){
      ctx.font='18px serif';
      ctx.fillText('📋', t.x+26, t.y-54);
    }
    if(t.state==='eating' && t.order){
      ctx.font='20px serif';
      ctx.fillText(t.order.em, t.x, t.y-6);
    }
  }
  if(t.state==='dirty'){
    ctx.font='28px serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🍽️', t.x, t.y-8);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.font='12px "Lilita One",sans-serif';
    ctx.strokeText('BUS', t.x, t.y+16);
    ctx.fillText('BUS', t.x, t.y+16);
  }
}

function draw(){
  if(!D || !D.ctx) return;
  const ctx=D.ctx, W=D.world;
  ctx.clearRect(0,0,CW,CH);

  // water + sandy floor
  const sky = ctx.createLinearGradient(0,0,0,CH);
  sky.addColorStop(0,'#4db7e8'); sky.addColorStop(.28,'#7ed0ef'); sky.addColorStop(.34,'#f3e2b0'); sky.addColorStop(1,'#e8c878');
  ctx.fillStyle=sky; ctx.fillRect(0,0,CW,CH);

  if(W){
    for(const b of W.bubbles){
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.5; ctx.stroke();
    }
  }

  // coral decor
  const corals=[[40,470,'#ff6b6b'],[90,485,'#ffa94d'],[150,475,'#ff7eb6'],[700,475,'#51cf66'],[760,485,'#845ef7'],[640,470,'#ff922b']];
  for(const [x,y,c] of corals){
    ctx.fillStyle=c; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-16,y); ctx.quadraticCurveTo(x-10,y-34,x,y-44); ctx.quadraticCurveTo(x+10,y-34,x+16,y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // kitchen counter
  ctx.fillStyle='#c26a3a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.roundRect(160, 18, 500, 78, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e8a05a';
  ctx.beginPath(); ctx.roundRect(170, 26, 480, 22, 8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.font='18px "Lilita One",sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.strokeText('KITCHEN', 178, 38); ctx.fillText('KITCHEN', 178, 38);

  // queue sign
  ctx.fillStyle='#2b6fd6'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.roundRect(20, 86, 100, 32, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffe25a'; ctx.font='16px "Lilita One",sans-serif'; ctx.textAlign='center';
  ctx.fillText('LINE', 70, 103);

  if(!W){
    ctx.fillStyle='#fff'; ctx.font='28px "Lilita One",sans-serif'; ctx.textAlign='center';
    ctx.strokeStyle='#16163a'; ctx.lineWidth=5;
    ctx.strokeText('Tap START SHIFT!', CW/2, CH/2);
    ctx.fillText('Tap START SHIFT!', CW/2, CH/2);
    return;
  }

  // trash
  ctx.fillStyle='#5a6b4a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.roundRect(W.trashCan.x-28, W.trashCan.y-22, 56, 50, 12); ctx.fill(); ctx.stroke();
  ctx.font='22px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🗑️', W.trashCan.x, W.trashCan.y); 
  ctx.fillStyle='#fff'; ctx.font='11px "Lilita One",sans-serif'; ctx.lineWidth=3; ctx.strokeStyle='#16163a';
  ctx.strokeText('TRASH', W.trashCan.x, W.trashCan.y+28); ctx.fillText('TRASH', W.trashCan.x, W.trashCan.y+28);

  for(const t of W.tables) drawTable(ctx, t);

  // kitchen slots
  for(const k of W.kitchenSlots){
    ctx.fillStyle = k.cooking ? '#ffe08a' : (k.item ? '#c6f0a8' : '#f4e0b8');
    ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(k.x, k.y, 28, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    if(k.item){
      ctx.font='24px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(k.item.em, k.x, k.y+1);
    } else {
      ctx.fillStyle='rgba(22,22,58,.35)'; ctx.font='11px "Lilita One",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('OPEN', k.x, k.y);
    }
    if(k.cooking){
      const tot = D.cfg.cook, left=Math.max(0,k.timer), p=1-left/tot;
      ctx.strokeStyle='#2db86a'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(k.x, k.y, 32, -Math.PI/2, -Math.PI/2 + p*Math.PI*2); ctx.stroke();
    }
  }

  // queue customers
  for(const slot of W.queueSlots){
    ctx.strokeStyle = W.selectedCustomer===slot ? '#ffe25a' : 'rgba(22,22,58,.25)';
    ctx.lineWidth = W.selectedCustomer===slot ? 5 : 2;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(slot.x, slot.y, 36, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    if(slot.customer){
      const img = slot.customer.img || loadAvatar(slot.customer.id, D.art(slot.customer.id));
      drawAvatar(ctx, slot.x, slot.y, 30, img, slot.customer.color, slot.customer.em);
      drawPatience(ctx, slot.x, slot.y+40, 56, slot.customer.patience);
      if(W.selectedCustomer===slot){
        ctx.strokeStyle='#ffe25a'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(slot.x, slot.y, 36, 0, Math.PI*2); ctx.stroke();
      }
    }
  }

  // waiter
  const p=W.player;
  const wimg = loadAvatar(D.waiter.id, D.art(D.waiter.id));
  const bob = Math.sin(performance.now()/180)*2;
  drawAvatar(ctx, p.x, p.y+bob, 32, wimg, D.waiter.color, D.waiter.em||'🦦');
  // tray / hands
  if(p.hands.length){
    ctx.fillStyle='#f4e0b8'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(p.x+20, p.y-18, 28+p.hands.length*16, 22, 8); ctx.fill(); ctx.stroke();
    p.hands.forEach((h,i)=>{ ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(h.em, p.x+36+i*16, p.y-6); });
  }
  ctx.fillStyle='#fff'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
  ctx.font='13px "Lilita One",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.strokeText(firstName(D.waiter), p.x, p.y+34); ctx.fillText(firstName(D.waiter), p.x, p.y+34);

  // hint
  if(W.selectedCustomer){
    ctx.fillStyle='rgba(15,25,60,.82)'; ctx.strokeStyle='#16163a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(200, 454, 400, 32, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffe25a'; ctx.font='16px "Lilita One",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Now tap an OPEN table to seat them!', 400, 470);
  }

  for(const f of W.floaters){
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle='#ffe25a'; ctx.strokeStyle='#16163a'; ctx.lineWidth=4;
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
    hands: W ? W.player.hands.map(h=>h.id) : [],
    queue: W ? W.queueSlots.map(s=>s.customer && s.customer.id) : [],
    tables: W ? W.tables.map(t=>({ id:t.id, state:t.state, order:t.order&&t.order.id, hasCustomer:!!t.customer })) : [],
    kitchen: W ? W.kitchenSlots.map(k=>({ cooking:k.cooking, item:k.item&&k.item.id, tableId:k.tableId, timer:k.timer })) : [],
  };
}

function tableById(id){ return D && D.world && D.world.tables.find(t=>t.id===id); }
function kitByI(i){ return D && D.world && D.world.kitchenSlots[i]; }

function simulateOneCycle(){
  if(!D) return { ok:false, reason:'no diner' };
  if(!D.running) startShift(D.level||1);
  const W=D.world;
  if(!W.queueSlots[0].customer) spawnCustomer();
  const slot = W.queueSlots.find(s=>s.customer);
  const table = W.tables.find(t=>t.state==='empty');
  if(!slot || !table) return { ok:false, reason:'no seat', state:snapshot() };
  // seat
  W.selectedCustomer = slot;
  table.customer = slot.customer; table.customer.patience=100;
  table.state='reading'; table.timer=0;
  slot.customer=null; W.selectedCustomer=null;
  // finish reading + take order
  table.state='ready_to_order';
  table.order = table.order || MENU[0];
  table.state='waiting_food';
  table.customer.patience=100;
  sendOrderToKitchen(table.order, table.id);
  // finish cook + pickup
  const k = W.kitchenSlots.find(s=>s.tableId===table.id) || W.kitchenSlots.find(s=>s.item);
  if(k){ k.cooking=false; k.timer=0; }
  if(k && k.item && W.player.hands.length<2){ W.player.hands.push(k.item); k.item=null; k.tableId=null; }
  // warp waiter and serve
  W.player.x = table.x; W.player.y = table.y-48; W.player.targetX=W.player.x; W.player.targetY=W.player.y;
  W.pendingAction = { type:'table', target:table };
  executePendingAction();
  // finish eating + bus
  table.state='dirty'; table.customer=null; table.timer=0;
  W.pendingAction = { type:'table', target:table };
  executePendingAction();
  updateHud();
  return { ok:true, state:snapshot() };
}

function exposeApi(){
  window.__reefDiner = {
    _owned:true,
    get running(){ return !!(D && D.running); },
    get state(){ return snapshot(); },
    start(level){ startShift(level||D.level||1); },
    close: closeReefDiner,
    exit: exitToLobby,
    spawn: spawnCustomer,
    tick(dt){ update(dt||0.05); draw(); },
    setTime(t){ if(D){ D.timeLeft=t; updateHud(); } },
    addScore(n){ if(D) addScore(n); },
    endNow(){ endGame(); },
    simulateShift(){ return simulateOneCycle(); },
    seat(qi, ti){
      if(!D||!D.world) return false;
      const slot=D.world.queueSlots[qi]; const t=tableById(ti);
      if(!slot||!slot.customer||!t||t.state!=='empty') return false;
      t.customer=slot.customer; t.customer.patience=100; t.state='reading'; t.timer=D.cfg.read;
      slot.customer=null; if(D.world.selectedCustomer===slot) D.world.selectedCustomer=null;
      return true;
    },
    forceReady(ti){
      const t=tableById(ti); if(!t||!t.customer) return false;
      t.state='ready_to_order'; t.timer=0; t.order=t.order||MENU[0]; return true;
    },
    takeOrder(ti){
      const t=tableById(ti); if(!t||t.state!=='ready_to_order') return false;
      t.state='waiting_food'; t.customer.patience=100; sendOrderToKitchen(t.order,t.id); return true;
    },
    finishCook(i){
      const k=kitByI(i); if(!k) return false; k.cooking=false; k.timer=0; return true;
    },
    pickup(i){
      const k=kitByI(i); if(!k||k.cooking||!k.item) return false;
      if(D.world.player.hands.length>=2) return false;
      D.world.player.hands.push(k.item); k.item=null; k.tableId=null; updateHud(); return true;
    },
    serve(ti){
      const t=tableById(ti); if(!t) return false;
      D.world.player.x=t.x; D.world.player.y=t.y-48;
      D.world.pendingAction={type:'table',target:t}; executePendingAction(); return t.state==='eating';
    },
    bus(ti){
      const t=tableById(ti); if(!t) return false;
      if(t.state==='eating'){ t.state='dirty'; t.customer=null; t.timer=0; }
      D.world.pendingAction={type:'table',target:t}; executePendingAction(); return t.state==='empty';
    },
  };
}
