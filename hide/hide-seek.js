/* Reef Hide & Seek — ZKIDZ mini game (2D canvas). Adapted from Zander's prototype (net + sonar + decoys + zoom camera).
 * Usage (inside the main game):  import { openHideSeek } from './hide/hide-seek.js';
 *   openHideSeek({ ECO, S, save, artUrl, chars, seekerId, sfxOn, onWin, onExit });
 * Self-contained: own CSS (#hideSeek scope), own save key (zkidz_hide_v1), WebAudio SFX (no files), no CDNs. */
import { ZONES, LEVELS, STORY_LEVELS, levelConfig } from './levels.js?v=20261116-11';

/* ================= ECONOMY — approved by Zander (Zokenomics' final Hide & Seek numbers) ================= */
export const HS_FIRST_CLEAR       = 25;   // story level, first clear: 25 + 2 per hider
export const HS_PER_HIDER_FIRST   = 2;
export const HS_REPLAY            = 10;   // replays: 10 + 1 per hider (hiding spots reshuffle every replay)
export const HS_PER_HIDER_REPLAY  = 1;
export const HS_ENDLESS_BASE      = 15;   // endless bonus levels: 15 + 1 per hider, capped at 35
export const HS_PER_HIDER_ENDLESS = 1;
export const HS_ENDLESS_CAP       = 35;
export const HS_THREE_STAR_BONUS  = 5;    // once per level, the first time it reaches 3 stars
export const HS_ZONE_COMPLETE     = 50;   // one-time, when every story level in a zone is cleared
export const HS_COUNTS_AS_WIN     = true; // clear counts toward the 5-win Play chest if >=30s or >=4 hiders
export const HS_WIN_MIN_SECONDS = 30, HS_WIN_MIN_HIDERS = 4;
/* All Starfish go through ECO.cardsEarn (shared uncapped earn path). Hints are always free. No find-all bonus.
   Leaderboard/best time is tracked separately and never affects Starfish. */
export function hsPayout({ bonus, first, hiders, threeStarNew, zoneNew }){
  let base, per;
  if(bonus){ base=HS_ENDLESS_BASE; per=HS_PER_HIDER_ENDLESS*hiders; const over=Math.max(0, base+per-HS_ENDLESS_CAP); per-=over; }
  else if(first){ base=HS_FIRST_CLEAR; per=HS_PER_HIDER_FIRST*hiders; }
  else { base=HS_REPLAY; per=HS_PER_HIDER_REPLAY*hiders; }
  const star=threeStarNew? HS_THREE_STAR_BONUS : 0, zone=zoneNew? HS_ZONE_COMPLETE : 0;
  return { base, per, star, zone, total:base+per+star+zone };
}

const SAVE_KEY = 'zkidz_hide_v1';
const HR = 38;                                  // hider badge radius (world units)
const LOOKALIKES = [['bubbles','squirt'],['bella','gus']];
const FALLBACK_IDS = ['pip','sunny','shelly','pinchy','dash','zippy','bubbles','coco','squirt','lulu','percy','sharkie','nova','oscar','wade','polly','bella','angie','tusk','mo','gus','nudi','echo','jelly','stella','finn','puff','hank','inky','milo','wally','ollie'];
const INK = '#16163a';
const FONT = "'Lilita One','Arial Black','Trebuchet MS',system-ui,sans-serif";

let H = null;

/* ---------------- utils ---------------- */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-t,3);
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hex(c){ return typeof c==='number' ? '#'+c.toString(16).padStart(6,'0') : (c||'#4aa3df'); }
function shade(h, k){ const n=parseInt(h.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255; const f=k<0?0:255, p=Math.abs(k); r=Math.round(r+(f-r)*p); g=Math.round(g+(f-g)*p); b=Math.round(b+(f-b)*p); return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }
function firstName(c){ return String((c&&c.name)||(c&&c.id)||'Friend').split(' the ')[0]; }
function fmt(s){ s=Math.max(0,Math.floor(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function defaultArt(id){ if(window.__ART && window.__ART[id]) return window.__ART[id]; try{ return new URL(`../art/${id}.jpg?v=20261116-11`, import.meta.url).href; }catch(e){ return `art/${id}.jpg?v=20261116-11`; } }
const $=(s,r)=> (r||(H&&H.root)||document).querySelector(s);
const $$=(s,r)=> [...(r||(H&&H.root)||document).querySelectorAll(s)];

/* ---------------- save (own key; defaults merged so old/missing saves always load) ---------------- */
function loadSave(){
  const base={ v:1, unlocked:1, stars:{}, best:{}, clears:{}, firstPaid:{}, starPaid:{}, zoneAwards:[], endless:STORY_LEVELS+1, zonesSeen:[], plays:0, last:1 };
  try{
    const o=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};
    const P=Object.assign(base, (o && typeof o==='object')?o:{});
    for(const k of ['stars','best','clears','firstPaid','starPaid']) if(!P[k]||typeof P[k]!=='object') P[k]={};
    if(!Array.isArray(P.zonesSeen)) P.zonesSeen=[]; if(!Array.isArray(P.zoneAwards)) P.zoneAwards=[];
    P.unlocked=clamp(P.unlocked|0||1,1,STORY_LEVELS+1); P.endless=Math.max(STORY_LEVELS+1,P.endless|0); P.last=Math.max(1,P.last|0);
    return P;
  }catch(e){ return base; }
}
function writeSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(H.P)); }catch(e){} }

/* ---------------- WebAudio SFX (synth only; follows the game's music toggle) ---------------- */
let AC=null, audioOn=false;
function sfxEnabled(){
  if(!audioOn) return false;
  const o=H&&H.opts; if(o){ if(typeof o.sfxOn==='function') return !!o.sfxOn(); if(o.S && o.S.music===false) return false; }
  if(H && H.muted) return false;
  return true;
}
function unlockAudio(){ audioOn=true; try{ const C=window.AudioContext||window.webkitAudioContext; if(!C) return; if(!AC) AC=new C(); if(AC.state==='suspended') AC.resume(); }catch(e){} }
function tone(f, d, type='sine', v=.12, delay=0, f2=null){
  if(!sfxEnabled()||!AC) return;
  try{ const t=AC.currentTime+delay, o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+.015); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+d+.02); }catch(e){}
}
function noise(d, v=.08, delay=0, freq=900){
  if(!sfxEnabled()||!AC) return;
  try{ const t=AC.currentTime+delay, n=Math.floor(AC.sampleRate*d), b=AC.createBuffer(1,n,AC.sampleRate), ch=b.getChannelData(0); for(let i=0;i<n;i++) ch[i]=(Math.random()*2-1)*(1-i/n);
    const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); s.buffer=b; f.type='bandpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(freq*2.5,t+d); g.gain.value=v; s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); }catch(e){}
}
const SFX={
  click(){ tone(660,.06,'triangle',.08); },
  swoosh(){ noise(.22,.07,0,500); },
  rustle(){ noise(.18,.05,0,1800); tone(240,.08,'triangle',.04); },
  blub(){ tone(300,.12,'sine',.09,0,180); tone(420,.08,'sine',.06,.08,260); },
  giggle(){ const b=900+Math.random()*250; for(let i=0;i<4;i++) tone(b+(i%2)*160,.07,'triangle',.05,i*.075,b*1.15); },
  catch(k=1){ const base=523*Math.pow(1.06,Math.min(k,6)); [0,4,7,12].forEach((s,i)=>tone(base*Math.pow(2,s/12),.16,'triangle',.11,i*.055)); noise(.15,.05,0,2400); },
  sonar(){ tone(1400,.5,'sine',.08,0,700); tone(1400,.4,'sine',.04,.32,700); tone(1400,.3,'sine',.02,.6,700); },
  star(i){ tone(880*Math.pow(1.26,i),.22,'triangle',.12); tone(1760*Math.pow(1.26,i),.18,'sine',.05,.03); },
  win(){ [523,659,784,1047,784,1047].forEach((f,i)=>tone(f,.22,'triangle',.11,i*.11)); },
  zone(){ [392,523,659,784,1047].forEach((f,i)=>tone(f,.3,'square',.05,i*.09)); [523,659,784].forEach(f=>tone(f,.9,'triangle',.06,.5)); },
  whoosh(){ noise(.45,.08,0,300); tone(200,.4,'sine',.05,0,600); },
};

/* ---------------- portraits (pre-rendered badges from the real character art) ---------------- */
function badgeFor(ch){
  if(H.badges[ch.id]) return H.badges[ch.id];
  const c=document.createElement('canvas'); c.width=c.height=168; const b={canvas:c, ready:false}; H.badges[ch.id]=b;
  const paint=(img)=>{ const x=c.getContext('2d'); x.clearRect(0,0,168,168); const col=hex(ch.color);
    x.beginPath(); x.arc(84,84,78,0,7); x.fillStyle=INK; x.fill();
    x.beginPath(); x.arc(84,84,71,0,7); x.fillStyle=col; x.fill();
    x.beginPath(); x.arc(84,84,64,0,7); x.fillStyle='#fff'; x.fill();
    x.save(); x.beginPath(); x.arc(84,84,62,0,7); x.clip();
    if(img){ x.drawImage(img, 30, 4, 196, 196, 20, 20, 128, 128); }
    else { x.fillStyle=col; x.fillRect(0,0,168,168); x.font='80px serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(ch.em||'🐠',84,90); }
    const g=x.createLinearGradient(0,20,0,90); g.addColorStop(0,'rgba(255,255,255,.35)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(70,48,40,22,-.4,0,7); x.fill();
    x.restore(); b.ready=!!img; };
  paint(null);
  const img=new Image(); img.decoding='async'; img.onload=()=>paint(img); img.src=(H.opts.artUrl||defaultArt)(ch.id);
  return b;
}

/* ---------------- caustics tile ---------------- */
function makeCaustics(){
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); const r=rng(7);
  x.strokeStyle='rgba(255,255,255,.9)'; x.lineCap='round';
  try{ x.filter='blur(1.5px)'; }catch(e){}
  for(let i=0;i<46;i++){ const cx=r()*256, cy=r()*256, rr=14+r()*26; x.lineWidth=1.5+r()*2.5; x.beginPath();
    for(let a=0;a<=6.3;a+=.5){ const q=rr*(.7+.5*Math.sin(a*3+i)); const px=cx+Math.cos(a)*q, py=cy+Math.sin(a)*q*.8; a?x.lineTo(px,py):x.moveTo(px,py); } x.closePath(); x.stroke();
    for(const [dx,dy] of [[-256,0],[256,0],[0,-256],[0,256]]){ x.save(); x.translate(dx,dy); x.stroke(); x.restore(); } }
  return c;
}

/* ================= public API ================= */
export function openHideSeek(opts={}){
  if(H) closeHideSeek();
  if(!document.getElementById('hideSeekCss') && !opts.noCss){ const l=document.createElement('link'); l.id='hideSeekCss'; l.rel='stylesheet'; l.href=new URL('./hide-seek.css?v=20261116-11', import.meta.url).href; document.head.appendChild(l); }
  const seekerId=opts.seekerId||(opts.S&&opts.S.selChar)||'ollie';
  let pool=(opts.chars||[]).filter(c=>c&&c.art!==false&&c.id);
  if(!pool.length) pool=FALLBACK_IDS.map(id=>({id, name:id[0].toUpperCase()+id.slice(1), color:'#4aa3df'}));
  const seeker=pool.find(c=>c.id===seekerId)||{id:seekerId,name:'Ollie the Otter',color:0x7a4a2c};
  H={ opts, P:loadSave(), pool:pool.filter(c=>c.id!==seekerId), seeker, badges:{}, muted:false,
      screen:'map', root:null, cv:null, cx:null, vw:800, vh:600, dpr:1, raf:0, last:0, t:0,
      lvl:1, cfg:null, zone:null, world:null, cam:{x:0,y:0,z:1,tx:0,ty:0,tz:1,vx:0,vy:0}, ptrs:new Map(), drag:null,
      found:0, elapsed:0, running:false, hintCd:0, idle:0, lastFind:-99, sonar:null, fx:[], texts:[], flyers:[], done:false, paid:null, caustic:makeCaustics(), intro:0 };
  const root=document.createElement('div'); root.id='hideSeek'; H.root=root;
  root.innerHTML=`
  <canvas class="hs-cv"></canvas>
  <div class="hs-hud hidden">
    <div class="hs-top">
      <button class="hs-btn blue hs-back" aria-label="Back to map">◀</button>
      <div class="hs-badge"><small class="hs-zn">ZONE</small><b class="hs-ln">1</b></div>
      <div class="hs-tray"></div>
      <div class="hs-right"><div class="hs-pill hs-time"><span class="hs-stars3"><i></i><i></i><i></i></span><b>0:00</b></div><div class="hs-pill"><span class="hs-coin"></span><b class="hs-coins">0</b></div><button class="hs-btn gray hs-snd" aria-label="Sound">🔊</button></div>
    </div>
    <div class="hs-ctl"><button class="hs-btn blue hs-zout" aria-label="Zoom out">－</button><button class="hs-btn blue hs-zin" aria-label="Zoom in">＋</button></div>
    <button class="hs-btn yellow hs-hint"><span>📡</span>HINT<i class="hs-cd"></i></button>
  </div>
  <div class="hs-map hidden"></div>
  <div class="hs-banner hidden"></div>
  <div class="hs-modal hidden"></div>
  <div class="hs-wipe"></div>
  <div class="hs-toast"></div>`;
  document.body.appendChild(root);
  const tt=document.getElementById('toast'); if(tt) tt.classList.remove('on');
  H.cv=$('.hs-cv'); H.cx=H.cv.getContext('2d');
  bindInput();
  $('.hs-back').onclick=()=>{ SFX.click(); toMap(); };
  $('.hs-snd').onclick=()=>{ H.muted=!H.muted; $('.hs-snd').textContent=H.muted?'🔇':'🔊'; if(!H.muted){ unlockAudio(); SFX.click(); } };
  $('.hs-hint').onclick=()=>{ unlockAudio(); hint(); };
  $('.hs-zin').onclick=()=>{ SFX.click(); zoomBy(1.3); };
  $('.hs-zout').onclick=()=>{ SFX.click(); zoomBy(1/1.3); };
  root.addEventListener('pointerdown', unlockAudio, {passive:true});
  H._rs=()=>fit(); addEventListener('resize', H._rs); if(window.visualViewport) visualViewport.addEventListener('resize', H._rs);
  fit();
  try{ document.fonts && document.fonts.load(`20px 'Lilita One'`); }catch(e){}
  showMap();
  H.last=performance.now(); H.raf=requestAnimationFrame(loop);
  window.__hideSeek={ _owned:true, get H(){ return H; }, startLevel, showMap, findOne, findAll, hint, levelConfig, hsPayout, consts:{HS_FIRST_CLEAR,HS_PER_HIDER_FIRST,HS_REPLAY,HS_PER_HIDER_REPLAY,HS_ENDLESS_BASE,HS_PER_HIDER_ENDLESS,HS_ENDLESS_CAP,HS_THREE_STAR_BONUS,HS_ZONE_COMPLETE,HS_COUNTS_AS_WIN} };
  return { close: closeHideSeek };
}
export function closeHideSeek(){
  if(!H) return; cancelAnimationFrame(H.raf); clearTimeout(H._tt);
  removeEventListener('resize', H._rs); if(window.visualViewport) visualViewport.removeEventListener('resize', H._rs);
  if(H._wheel) H.cv.removeEventListener('wheel', H._wheel);
  if(H.root&&H.root.parentNode) H.root.parentNode.removeChild(H.root);
  if(window.__hideSeek&&window.__hideSeek._owned) window.__hideSeek=null;
  H=null;
}
function exitToLobby(){ const cb=H&&H.opts.onExit; closeHideSeek(); if(typeof cb==='function') cb(); }

function fit(){ if(!H) return; const vw=innerWidth, vh=(window.visualViewport?visualViewport.height:innerHeight)||innerHeight; H.vw=vw; H.vh=vh; H.dpr=Math.min(2, window.devicePixelRatio||1); H.cv.width=Math.round(vw*H.dpr); H.cv.height=Math.round(vh*H.dpr); H.cv.style.width=vw+'px'; H.cv.style.height=vh+'px'; if(H.world) clampCam(true); }
function toast(msg){ const el=$('.hs-toast'); el.textContent=msg; el.classList.add('on'); clearTimeout(H._tt); H._tt=setTimeout(()=>el&&el.classList.remove('on'),2200); }

/* ================= LEVEL MAP ================= */
const NODE_X=[22,62,38];
function starsHtml(n,cls='hs-st'){ return `<span class="${cls}">${[0,1,2].map(i=>`<i class="${i<n?'on':''}">★</i>`).join('')}</span>`; }
function showMap(hopFrom){
  H.screen='map'; H.running=false; H.world=null;
  $('.hs-hud').classList.add('hidden'); $('.hs-modal').classList.add('hidden'); $('.hs-banner').classList.add('hidden');
  const P=H.P, cur=Math.min(P.unlocked, STORY_LEVELS), coins=H.opts.S?H.opts.S.coins:0;
  const totalStars=Object.values(P.stars).reduce((a,b)=>a+(b|0),0);
  let html=`<div class="hs-mhead"><button class="hs-btn blue hs-mback" aria-label="Back to lobby">◀</button><div class="hs-mtitle">REEF HIDE &amp; SEEK<small>Find all your friends! ⭐ ${totalStars}/${STORY_LEVELS*3}</small></div><div class="hs-pill"><span class="hs-coin"></span><b>${coins}</b></div></div><div class="hs-path">`;
  ZONES.forEach((Z,zi)=>{
    const first=zi*3+1, locked=first>P.unlocked;
    html+=`<section class="hs-zone ${locked?'locked':''}" style="--w0:${Z.water[0]};--w1:${Z.water[1]};--w2:${Z.water[2]}"><div class="hs-zhead"><span>${Z.em}</span>${Z.name}${locked?`<small>🔒 Clear Level ${first-1} to open</small>`:`<small>${Z.blurb}</small>`}</div>
      <svg class="hs-line" viewBox="0 0 100 480" preserveAspectRatio="none"><path d="M${NODE_X[0]} 150 C ${NODE_X[0]} 212, ${NODE_X[1]} 202, ${NODE_X[1]} 268 S ${NODE_X[2]} 322, ${NODE_X[2]} 386 L ${NODE_X[2]} 480"/></svg>`;
    for(let i=0;i<3;i++){ const n=first+i, L=LEVELS[n-1], lk=n>P.unlocked, st=P.stars[n]|0;
      html+=`<button class="hs-node ${lk?'lock':''} ${n===cur&&!lk?'cur':''} ${st?'done':''}" data-n="${n}" style="left:${NODE_X[i]}%;top:${150+i*118}px" ${lk?'disabled':''}><b>${lk?'🔒':n}</b>${starsHtml(st)}<em>${L.name}</em></button>`; }
    html+=`</section>`;
  });
  const endOpen=P.unlocked>STORY_LEVELS;
  html+=`<section class="hs-zone hs-endless ${endOpen?'':'locked'}"><div class="hs-zhead"><span>♾️</span>Bonus Reefs<small>${endOpen?'Endless hiding fun in every zone!':`🔒 Clear Level ${STORY_LEVELS} to open`}</small></div>
    <button class="hs-btn green hs-endbtn" ${endOpen?'':'disabled'}>BONUS LEVEL ${P.endless} ▶</button></section></div>
    <div class="hs-mfoot"><button class="hs-btn green big hs-mplay">PLAY LEVEL ${endOpen?P.endless:cur} ▶</button></div>
    <img class="hs-seeker" alt="" src="${(H.opts.artUrl||defaultArt)(H.seeker.id)}">`;
  const M=$('.hs-map'); M.innerHTML=html; M.classList.remove('hidden');
  $('.hs-mback').onclick=()=>{ SFX.click(); exitToLobby(); };
  $$('.hs-node').forEach(b=>b.onclick=()=>{ unlockAudio(); SFX.click(); goLevel(+b.dataset.n); });
  const eb=$('.hs-endbtn'); if(eb) eb.onclick=()=>{ unlockAudio(); SFX.click(); goLevel(H.P.endless); };
  $('.hs-mplay').onclick=()=>{ unlockAudio(); SFX.click(); goLevel(endOpen?H.P.endless:cur); };
  // seeker avatar sits on the current node; hops forward after a fresh unlock
  const path=$('.hs-path'), sk=$('.hs-seeker'); path.appendChild(sk);
  const place=(n,anim)=>{ const nd=n>STORY_LEVELS? $('.hs-endbtn') : $(`.hs-node[data-n="${n}"]`); if(!nd) return; const pr=path.getBoundingClientRect(), r=nd.getBoundingClientRect();
    sk.style.transition=anim?'left .9s cubic-bezier(.3,1.4,.5,1), top .9s cubic-bezier(.3,1.4,.5,1)':'none';
    sk.style.left=(r.left-pr.left+r.width/2)+'px'; sk.style.top=(r.top-pr.top+8)+'px'; };
  const target=endOpen?STORY_LEVELS+1:cur;
  requestAnimationFrame(()=>{ if(!H) return;
    const nd=target>STORY_LEVELS? $('.hs-endbtn') : $(`.hs-node[data-n="${target}"]`);
    if(nd) M.scrollTop=Math.max(0, nd.getBoundingClientRect().top - M.getBoundingClientRect().top + M.scrollTop - H.vh*.4);
    if(hopFrom && hopFrom!==target){ place(hopFrom,false); requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(H){ place(target,true); setTimeout(()=>{ if(H){ sk.classList.add('land'); SFX.star(1); } },850); } })); }
    else place(target,false);
  });
}
function toMap(){ const n=H.lvl; wipe(()=>showMap(n)); }
function goLevel(n){ wipe(()=>startLevel(n)); }
function wipe(mid){ const w=$('.hs-wipe'); SFX.whoosh(); w.classList.remove('out'); w.classList.add('in'); setTimeout(()=>{ if(!H) return; mid(); w.classList.remove('in'); w.classList.add('out'); }, 420); }

/* ================= WORLD BUILD ================= */
const COVER={
  coral:{w:170,h:118}, rock:{w:170,h:112}, clam:{w:168,h:108}, castle:{w:176,h:150},
  kelp:{w:150,h:230,mid:.42}, barrel:{w:128,h:136}, chest:{w:172,h:118}, plank:{w:180,h:128},
  crystal:{w:160,h:150}, shroom:{w:176,h:150,mid:.08},
};
function pickHiders(r, n){
  const pool=[...H.pool]; for(let i=pool.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const out=[]; for(const c of pool){ if(out.length>=n) break; if(LOOKALIKES.some(([a,b])=>(c.id===a&&out.some(o=>o.id===b))||(c.id===b&&out.some(o=>o.id===a)))) continue; out.push(c); }
  while(out.length<n && pool.length) out.push(pool[out.length%pool.length]);
  return out;
}
function buildWorld(cfg, seed){
  const r=rng(seed), Z=ZONES[cfg.zone], W=cfg.w, Ht=cfg.h, floor=Ht-170;
  const w={ W, H:Ht, floor, Z, spots:[], ledges:[], decor:[], back:[], fish:[], bubbles:[], snow:[], far:[], mid:[], wave:[], hulk:null, stal:[] };
  for(let x=0;x<=W+40;x+=40) w.wave.push(floor+Math.sin(x*.004+seed)*16+Math.sin(x*.013)*7);
  const floorY=x=>{ const i=clamp(Math.round(x/40),0,w.wave.length-1); return w.wave[i]; };
  w.floorY=floorY;
  // parallax hills
  for(const [arr,step,hh] of [[w.far,260,220],[w.mid,190,150]]){ for(let x=-200;x<=W+400;x+=step*(.7+r()*.6)) arr.push({x, h:hh*(.5+r()*.7), wd:step*(1+r()*.8), bump:r()}); }
  // hiding spots (n hiders + empty decoy spots)
  const total=cfg.n+cfg.empty, spots=[];
  const ledgeShare = cfg.zone===1?.25:.4;
  for(let i=0;i<total;i++){
    let best=null;
    for(let a=0;a<80;a++){
      const onLedge=r()<ledgeShare && Ht>900;
      const x=140+r()*(W-280);
      const y=onLedge? (260+r()*(floor-520)) : floorY(x)+30+r()*60;
      const d=spots.reduce((m,s)=>Math.min(m,Math.hypot(s.x-x,(s.y-y)*1.4)),1e9);
      if(!best||d>best.d) best={x,y,onLedge,d};
      if(d>260) break;
    }
    const kinds=Z.covers; const kind=kinds[Math.floor(r()*kinds.length)]; const C=COVER[kind]; const sc=.9+r()*.25;
    const s={ x:best.x, y:best.y, kind, w:C.w*sc, h:C.h*sc, mid:C.mid||0, sc, seed:r()*1000, flip:r()<.5?-1:1, rustle:0, hue:Math.floor(r()*4), hider:null, ledge:best.onLedge };
    spots.push(s);
    if(best.onLedge) w.ledges.push({x:s.x, y:s.y, w:s.w*1.35, seed:r()*99});
  }
  // assign hiders to random spots
  const chars=pickHiders(r, cfg.n); const order=spots.map((s,i)=>i).sort(()=>r()-.5);
  w.hiders=chars.map((ch,i)=>{ const s=spots[order[i]]; const h={ ch, s, side:(r()-.5)*.5, phase:r()*6, peekT:1+r()*cfg.peek, peek:0, peekHold:0, found:false, ft:0, giggleT:0, glow:0, name:firstName(ch) }; s.hider=h; badgeFor(ch); return h; });
  w.spots=spots.sort((a,b)=>a.y-b.y);
  // background decor
  const nDec=Math.round(W/62);
  for(let i=0;i<nDec;i++){ const x=r()*W; const onF=true; const kind=Z.decor[Math.floor(r()*Z.decor.length)];
    w.decor.push({ kind, x, y:onF? floorY(x)+10+r()*80 : 300+r()*(floor-400), s:.55+r()*.6, seed:r()*99, col:Math.floor(r()*5), front:onF&&r()<.18 }); }
  w.decor.sort((a,b)=>a.y-b.y);
  // tall back kelp / zone landmarks
  const nK=Math.round(W/(cfg.zone===1?55:170)); for(let i=0;i<nK;i++){ const x=r()*W; w.back.push({ x, y:floorY(x)+20, h:(cfg.zone===1? (floor*.55+r()*floor*.35):(160+r()*260)), seed:r()*9, wd:10+r()*10 }); }
  if(cfg.zone===2){ w.hulk={ x:W*(.3+r()*.4), y:floor+20, s:Math.min(1.5,W/2600) }; }
  if(cfg.zone===3){ for(let x=0;x<W;x+=60+r()*90) w.stal.push({x, h:60+r()*190, wd:40+r()*60, gl:r()<.4}); }
  // fish decoys
  for(let i=0;i<cfg.fish;i++){ const kind = cfg.zone===3? (r()<.45?'jelly':'fish') : (r()<.14?'crab':(cfg.zone===1&&r()<.2?'jelly':'fish'));
    const x=r()*W, y= kind==='crab'? floorY(x)+50+r()*60 : 160+r()*(floor-200);
    w.fish.push({ kind, x, y, bx:x, by:y, dir:r()<.5?-1:1, sp:kind==='crab'?18:(30+r()*45), range:80+r()*260, ph:r()*6, s:.7+r()*.5, col:Z.fish[Math.floor(r()*Z.fish.length)], wob:0 }); }
  for(let i=0;i<Math.round(W*Ht/42000);i++) w.bubbles.push({ x:r()*W, y:r()*Ht, r:3+r()*9, sp:20+r()*40, ph:r()*6 });
  for(let i=0;i<Math.round(W*Ht/16000);i++) w.snow.push({ x:r()*W, y:r()*Ht, r:1+r()*2.2, sp:4+r()*10, ph:r()*6 });
  return w;
}

/* ================= LEVEL FLOW ================= */
function startLevel(n){
  if(!H) return;
  const cfg=levelConfig(n); H.lvl=n; H.cfg=cfg; H.zone=ZONES[cfg.zone];
  H.P.last=n; H.P.plays=(H.P.plays|0)+1; writeSave();
  H.world=buildWorld(cfg, n*7919 + (H.P.plays|0)*31);
  H.found=0; H.elapsed=0; H.done=false; H.paid=null; H.fx=[]; H.texts=[]; H.flyers=[]; H.sonar=null; H.hintCd=0; H.idle=0; H.lastFind=-99; H.hintCount=0;
  H.screen='play'; $('.hs-map').classList.add('hidden'); $('.hs-modal').classList.add('hidden'); $('.hs-hud').classList.remove('hidden');
  $('.hs-ln').textContent = cfg.bonus? `B${n-STORY_LEVELS}` : n; $('.hs-zn').textContent = cfg.bonus? 'BONUS' : 'LEVEL';
  H.root.dataset.zone=H.zone.id;
  $('.hs-tray').innerHTML = H.world.hiders.map((h,i)=>`<i data-i="${i}" style="--c:${hex(h.ch.color)}"><img src="${(H.opts.artUrl||defaultArt)(h.ch.id)}" alt="${h.name}"><u>?</u></i>`).join('');
  refreshCoins(); updateHud();
  // camera: start zoomed out on the whole reef, then swoop in
  const c=H.cam; c.z=minZoom(); c.x=H.world.W/2; c.y=H.world.H/2; c.tz=playZoom(); c.vx=c.vy=0;
  const startAt=H.world.hiders[0].s; c.tx=clamp(H.world.W/2*.6+startAt.x*.4,0,H.world.W); c.ty=H.world.floor-H.vh/c.tz*.25; clampCam(true);
  H.running=false; H.intro=1.2;
  const fresh=!H.P.zonesSeen.includes(H.zone.id);
  if(fresh){ H.P.zonesSeen.push(H.zone.id); writeSave(); }
  banner(fresh, cfg);
}
function banner(newZone, cfg){
  const B=$('.hs-banner'), Z=H.zone;
  const hiders=H.world.hiders.map(h=>`<img src="${(H.opts.artUrl||defaultArt)(h.ch.id)}" alt="">`).join('');
  B.className='hs-banner'+(newZone?' newzone':'');
  B.innerHTML = newZone
    ? `<div class="hs-bcard"><div class="hs-newz">NEW ZONE!</div><div class="hs-zem">${Z.em}</div><h2>${Z.name}</h2><p>${Z.blurb}</p><div class="hs-bfr">${hiders}</div><button class="hs-btn green big hs-go">LET'S SEEK! ▶</button></div>`
    : `<div class="hs-bcard small"><small>${Z.em} ${Z.name}</small><h2>${cfg.bonus?'BONUS ':'LEVEL '}${cfg.bonus?cfg.level-STORY_LEVELS:cfg.level}</h2><p>${cfg.name} · ${cfg.n} friends are hiding!</p><div class="hs-bfr">${hiders}</div><button class="hs-btn green big hs-go">GO! ▶</button></div>`;
  newZone? SFX.zone() : SFX.star(0);
  const go=()=>{ if(!H||H.running) return; B.classList.add('hidden'); H.running=true; H.idle=0; };
  $('.hs-go').onclick=()=>{ unlockAudio(); SFX.click(); go(); };
  B.onclick=e=>{ if(e.target===B) go(); };
  if(!newZone) H._bt=setTimeout(go, 2600);
}
function starsFor(t, par){ return t<=par?3 : t<=par*1.6?2 : 1; }
function updateHud(){
  if(!H||!H.cfg) return;
  const t=H.elapsed, st=starsFor(t,H.cfg.par);
  $('.hs-time b').textContent=fmt(t);
  $$('.hs-stars3 i').forEach((x,i)=>x.classList.toggle('on', i<st));
  $('.hs-hint .hs-cd').style.transform=`scaleX(${H.hintCd>0?H.hintCd/3:0})`;
  $('.hs-hint').classList.toggle('cool', H.hintCd>0);
}
function refreshCoins(){ const S=H.opts.S; $$('.hs-coins').forEach(e=>e.textContent=S?S.coins:0); }

function levelDone(){
  H.done=true; H.running=false;
  const cfg=H.cfg, n=H.lvl, P=H.P, t=H.elapsed, stars=starsFor(t,cfg.par), hiders=H.world.hiders.length;
  const first = !cfg.bonus && !P.firstPaid[n];
  const threeStarNew = !cfg.bonus && stars===3 && !P.starPaid[n];
  P.clears[n]=(P.clears[n]|0)+1; P.stars[n]=Math.max(P.stars[n]|0, stars); P.best[n]=P.best[n]? Math.min(P.best[n], Math.round(t)) : Math.round(t);
  if(first) P.firstPaid[n]=1; if(threeStarNew) P.starPaid[n]=1;
  let zoneNew=false;
  if(!cfg.bonus){ const zid=ZONES[cfg.zone].id; const lv=LEVELS.map((L,i)=>i+1).filter(i=>LEVELS[i-1].zone===cfg.zone);
    if(!P.zoneAwards.includes(zid) && lv.every(i=>P.clears[i]>0)){ P.zoneAwards.push(zid); zoneNew=true; } }
  const unlockedNew = !cfg.bonus && n>=P.unlocked; if(unlockedNew) P.unlocked=n+1;
  if(cfg.bonus && n>=P.endless) P.endless=n+1;
  writeSave();
  // ---- pay through the shared economy earn path (same as Reef Sort / Reef Diner) ----
  const pay=hsPayout({ bonus:cfg.bonus, first, hiders, threeStarNew, zoneNew });
  const countsWin = HS_COUNTS_AS_WIN && (t>=HS_WIN_MIN_SECONDS || hiders>=HS_WIN_MIN_HIDERS);
  const o=H.opts; let earned=pay.total, win=null;
  if(o.ECO && o.S){
    try{ o.ECO.ensureDay && o.ECO.ensureDay(o.S); }catch(e){}
    const e = o.ECO.cardsEarn ? o.ECO.cardsEarn(pay.total) : { earned:pay.total };
    earned=e.earned; o.S.coins=(o.S.coins||0)+earned;
    if(countsWin && o.onWin) win=o.onWin();
    try{ o.save && o.save(); }catch(err){}
  }
  H.paid={ ...pay, earned, first, stars, win, countsWin, hiders, zoneNew };
  refreshCoins();
  setTimeout(()=>showComplete(unlockedNew), 1100);
}
function showComplete(unlockedNew){
  if(!H) return;
  const cfg=H.cfg, n=H.lvl, p=H.paid, nx=levelConfig(n+1), nz=ZONES[nx.zone], newZ=nx.zone!==cfg.zone && !H.P.zonesSeen.includes(nz.id);
  const win=p.win, need=(win&&win.need)||5, wins=(win&&win.wins)||0;
  const M=$('.hs-modal');
  M.innerHTML=`<div class="hs-card"><div class="hs-ribbon">${cfg.bonus?'BONUS '+(n-STORY_LEVELS):'LEVEL '+n} CLEAR!</div>
    <div class="hs-bigstars">${[0,1,2].map(i=>`<i class="${i<p.stars?'on':''}" style="--d:${.35+i*.35}s">★</i>`).join('')}</div>
    <p class="hs-sub">Found all ${H.world.hiders.length} friends in <b>${fmt(H.elapsed)}</b>${p.stars<3?` · ⭐⭐⭐ under ${fmt(cfg.par)}`:' · Super seeker!'}</p>
    <div class="hs-pay"><div><span>${cfg.bonus?'Bonus level':p.first?'First clear':'Replay'}</span><b>+${p.base}</b></div><div><span>${p.hiders} friends found</span><b>+${p.per}</b></div>${p.star?`<div><span>⭐⭐⭐ First 3 stars</span><b>+${p.star}</b></div>`:''}${p.zone?`<div class="zone"><span>${ZONES[cfg.zone].em} Zone explored!</span><b>+${p.zone}</b></div>`:''}<div class="tot"><span><span class="hs-coin"></span> Starfish</span><b>+${p.earned}</b></div></div>
    ${p.zoneNew?`<div class="hs-zdone">🗺️ ZONE EXPLORED! ${ZONES[cfg.zone].name} complete</div>`:''}<p class="hs-chest">${!p.countsWin?'🎁 Play 30+ seconds or find 4+ friends to count toward a chest.':win&&win.chest?'🎉 5 wins! A <b>bonus chest</b> is coming! 🎁':`🎁 Chest in <b>${wins}/${need}</b> wins <span class="hs-dots">${Array.from({length:need},(_,i)=>`<i class="${i<wins?'on':''}"></i>`).join('')}</span>`}</p>
    <div class="hs-next"><img src="${(H.opts.artUrl||defaultArt)(H.seeker.id)}" alt=""><div><small>NEXT UP${newZ?' · <b>NEW ZONE!</b>':''}</small>${nz.em} ${nx.bonus?'Bonus '+(nx.level-STORY_LEVELS):'Level '+nx.level} · ${nz.name}<small>${nx.n} friends hiding${nx.n>cfg.n?` (+${nx.n-cfg.n})`:''}</small></div></div>
    <div class="hs-btns"><button class="hs-btn blue hs-mapb">🗺️ MAP</button><button class="hs-btn pink hs-again">↻ AGAIN</button><button class="hs-btn green big hs-nextb">NEXT ▶</button></div></div>`;
  M.classList.remove('hidden');
  for(let i=0;i<p.stars;i++) setTimeout(()=>H&&SFX.star(i), 350+i*350);
  SFX.win();
  $('.hs-mapb').onclick=()=>{ SFX.click(); wipe(()=>showMap(unlockedNew?n:null)); };
  $('.hs-again').onclick=()=>{ SFX.click(); goLevel(n); };
  $('.hs-nextb').onclick=()=>{ SFX.click(); goLevel(n+1); };
}

/* ================= CAMERA + INPUT ================= */
function minZoom(){ const w=H.world; return Math.max(.2, Math.min(H.vw/w.W, H.vh/w.H)); }
function maxZoom(){ return 1.9; }
function playZoom(){ return clamp(Math.min(H.vw,H.vh)/520, minZoom(), 1.35); }
function clampCam(snap){
  const c=H.cam, w=H.world; if(!w) return;
  c.tz=clamp(c.tz, minZoom(), maxZoom()); if(snap) c.z=clamp(c.z, minZoom(), maxZoom());
  const lim=(v,z,size,view)=>{ const half=view/z/2; return size<=half*2? size/2 : clamp(v, half, size-half); };
  c.tx=lim(c.tx,c.tz,w.W,H.vw); c.ty=lim(c.ty,c.tz,w.H,H.vh);
  if(snap){ c.x=lim(c.x,c.z,w.W,H.vw); c.y=lim(c.y,c.z,w.H,H.vh); }
}
function s2w(sx,sy){ const c=H.cam; return { x:c.x+(sx-H.vw/2)/c.z, y:c.y+(sy-H.vh/2)/c.z }; }
function w2s(wx,wy){ const c=H.cam; return { x:(wx-c.x)*c.z+H.vw/2, y:(wy-c.y)*c.z+H.vh/2 }; }
function zoomBy(f, sx=H.vw/2, sy=H.vh/2){
  if(!H.world) return; const c=H.cam, before=s2w(sx,sy); const nz=clamp(c.tz*f, minZoom(), maxZoom());
  c.tz=nz; c.tx=before.x-(sx-H.vw/2)/nz; c.ty=before.y-(sy-H.vh/2)/nz; clampCam(false);
}
function bindInput(){
  const cv=H.cv;
  cv.addEventListener('pointerdown', e=>{ if(H.screen!=='play') return; cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
    H.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});
    if(H.ptrs.size===1){ H.drag={moved:false, x:e.clientX, y:e.clientY, t:performance.now()}; H.cam.vx=H.cam.vy=0; }
    else if(H.ptrs.size===2){ const [a,b]=[...H.ptrs.values()]; H.pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}; if(H.drag) H.drag.moved=true; }
    H.ptr={x:e.clientX,y:e.clientY};
  });
  cv.addEventListener('pointermove', e=>{ H.ptr={x:e.clientX,y:e.clientY,hover:e.pointerType==='mouse'}; const p=H.ptrs.get(e.pointerId); if(!p||H.screen!=='play') return;
    const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; const c=H.cam;
    if(H.ptrs.size>=2 && H.pinch){ const [a,b]=[...H.ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(H.pinch.d>0) zoomBy(d/H.pinch.d,(a.x+b.x)/2,(a.y+b.y)/2); H.pinch.d=d; return; }
    if(H.drag){ if(Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>10) H.drag.moved=true;
      if(H.drag.moved){ c.tx-=dx/c.tz; c.ty-=dy/c.tz; c.x-=dx/c.z; c.y-=dy/c.z; c.vx=-dx/c.z*60; c.vy=-dy/c.z*60; clampCam(false); H.idle=Math.min(H.idle,8); } }
  });
  const up=e=>{ const p=H.ptrs.get(e.pointerId); H.ptrs.delete(e.pointerId); if(H.ptrs.size<2) H.pinch=null; if(!p) return;
    if(H.ptrs.size===0 && H.drag){ if(!H.drag.moved && e.type==='pointerup') tap(e.clientX,e.clientY); H.drag=null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', ()=>{ if(H.ptr) H.ptr.hover=false; });
  H._wheel=e=>{ if(H.screen!=='play') return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY*.0015), e.clientX, e.clientY); };
  cv.addEventListener('wheel', H._wheel, {passive:false});
}

/* ================= GAMEPLAY ================= */
function hiderPos(h, t){
  const s=h.s, r=HR*s.sc, top=s.y-s.h*(1-s.mid), hide=H.cfg.hide;
  const rest=r*(-.1+hide*1.25), out=-r*1.05;
  let y=top+lerp(rest,out,ease(h.peek)) + Math.sin(t*2+h.phase)*3;
  let x=s.x+h.side*s.w*.45*(1-h.peek*.4) + (h.peek>.5? Math.sin(t*14+h.phase)*3*h.peek : 0);
  if(h.found){ const k=clamp(h.ft/0.8,0,1); y=top-r*1.05-ease(k)*r*1.6; }
  return {x,y,r};
}
function tap(sx,sy){
  if(!H.running||H.done) return;
  unlockAudio();
  const p=s2w(sx,sy), z=H.cam.z, t=H.t;
  H.fx.push({k:'net', sx, sy, life:.35, max:.35});
  let best=null, bd=1e9;
  for(const h of H.world.hiders){ if(h.found) continue; const q=hiderPos(h,t), s=h.s;
    const reach=Math.max(q.r*1.25, 34/z); const d=Math.hypot(q.x-p.x,q.y-p.y);
    const inCover = p.x>s.x-s.w/2-10/z && p.x<s.x+s.w/2+10/z && p.y>s.y-s.h-q.r*.6 && p.y<s.y+12;
    if((d<reach||inCover) && d<bd){ bd=d; best=h; } }
  if(best){ catchHider(best); return; }
  // miss: rustle empty spots, wiggle fish
  let said=false;
  for(const s of H.world.spots){ if(!s.hider && p.x>s.x-s.w/2 && p.x<s.x+s.w/2 && p.y>s.y-s.h && p.y<s.y+10){ s.rustle=.6; SFX.rustle(); addText(s.x, s.y-s.h-10, 'Nobody here!', '#ffffff', 22); said=true; break; } }
  for(const f of H.world.fish){ if(Math.hypot(f.x-p.x,f.y-p.y)<60/Math.min(z,1)*f.s){ f.wob=.7; if(!said){ SFX.blub(); addText(f.x, f.y-30, 'Blub!', '#bff6ff', 22); said=true; } } }
  if(!said) SFX.swoosh();
  for(let i=0;i<7;i++){ const a=Math.random()*6.28, sp=40+Math.random()*80; H.fx.push({k:'bub', x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40, r:4+Math.random()*5, life:.6, max:.6}); }
}
function addText(x,y,txt,col,size=28){ H.texts.push({x,y,txt,col,size,life:1.4,max:1.4}); }
function catchHider(h){
  h.found=true; h.ft=0; H.found++; H.idle=0;
  const q=hiderPos(h,H.t), quick=H.elapsed-H.lastFind<6 && H.found>1; H.lastFind=H.elapsed;
  if(H.sonar&&H.sonar.h===h) H.sonar=null;
  SFX.catch(H.found); setTimeout(()=>H&&SFX.giggle(),180);
  const cols=['#ffe25a','#ff6ad5','#5fe1ff','#8cf26a','#ffffff','#ffaa00'];
  for(let i=0;i<34;i++){ const a=i/34*6.28+Math.random()*.2, sp=120+Math.random()*260; H.fx.push({k:i%3?'dot':'star', x:q.x, y:q.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-80, r:5+Math.random()*6, c:cols[i%cols.length], life:.9+Math.random()*.4, max:1.3}); }
  H.fx.push({k:'ring', x:q.x, y:q.y, life:.6, max:.6, r:q.r});
  addText(q.x, q.y-q.r-30, `FOUND ${h.name.toUpperCase()}!`, '#ffe25a', 34);
  if(quick) addText(q.x, q.y-q.r-70, 'SPEEDY! ⚡', '#8cf26a', 26);
  h.s.rustle=.8;
  const idx=H.world.hiders.indexOf(h);
  setTimeout(()=>{ if(!H||!H.world) return; const slot=$(`.hs-tray i[data-i="${idx}"]`); if(!slot) return; const r=slot.getBoundingClientRect(); const q2=hiderPos(h,H.t), s=w2s(q2.x,q2.y);
    H.flyers.push({h, x0:s.x, y0:s.y, x1:r.left+r.width/2, y1:r.top+r.height/2, r0:q2.r*H.cam.z, r1:r.width/2, t:0, slot}); }, 800);
  if(H.found>=H.world.hiders.length){ setTimeout(()=>{ if(H&&H.world){ addText(H.cam.x, H.cam.y-60/H.cam.z, 'ALL FOUND! 🎉', '#ffffff', 52/Math.min(1,H.cam.z)); SFX.win(); } }, 700); levelDone(); }
}
function nearestUnfound(){ let b=null, bd=1e9; for(const h of H.world.hiders){ if(h.found) continue; const d=Math.hypot(h.s.x-H.cam.x,h.s.y-H.cam.y); if(d<bd){bd=d;b=h;} } return b; }
function hint(){
  if(!H||!H.running||H.done) return;
  if(H.hintCd>0){ toast('Sonar is warming up… 📡'); return; }
  const h=(H.sonar&&!H.sonar.h.found)? H.sonar.h : nearestUnfound(); if(!h) return;
  const again=H.sonar&&H.sonar.h===h; H.hintCount++;
  H.sonar={h, life:5}; H.hintCd=3; h.peekHold=3; h.giggleT=.1; SFX.sonar();
  const q=hiderPos(h,H.t), s=w2s(q.x,q.y), off=s.x<0||s.y<0||s.x>H.vw||s.y>H.vh;
  if(again||(off&&H.hintCount>2)){ H.cam.tx=q.x; H.cam.ty=q.y; clampCam(false); toast(`Swimming over to ${h.name}… 🐠`); }
  else toast(off? `Follow the arrow to find a friend! ➜` : `Hee hee! Someone is giggling near the rings! 📡`);
}
function findOne(){ const h=nearestUnfound(); if(h){ H.running=true; catchHider(h); } return !!h; }
function findAll(){ if(!H.world) return 0; H.running=true; let n=0; for(const h of H.world.hiders) if(!h.found){ catchHider(h); n++; } return n; }

function update(dt){
  H.t+=dt; const c=H.cam, w=H.world; if(!w) return;
  if(H.intro>0){ H.intro-=dt; }
  if(!H.drag && (Math.abs(c.vx)>1||Math.abs(c.vy)>1)){ c.tx+=c.vx*dt; c.ty+=c.vy*dt; c.vx*=Math.pow(.02,dt); c.vy*=Math.pow(.02,dt); clampCam(false); }
  const k=1-Math.exp(-dt*(H.intro>0?2.6:9)); c.x=lerp(c.x,c.tx,k); c.y=lerp(c.y,c.ty,k); c.z=lerp(c.z,c.tz,k);
  if(H.running && !H.done){ H.elapsed+=dt; H.idle+=dt; H.hintCd=Math.max(0,H.hintCd-dt);
    if(H.idle>20){ H.idle=0; const h=nearestUnfound(); if(h){ h.peekHold=2.5; h.glow=3; h.giggleT=.1; toast('Psst… someone is giggling! Look for the sparkles ✨'); } } }
  for(const h of w.hiders){
    if(h.found){ h.ft+=dt; h.peek=1; continue; }
    h.peekT-=dt; h.peekHold=Math.max(0,h.peekHold-dt); h.glow=Math.max(0,h.glow-dt);
    if(h.peekT<=0){ h.peekHold=Math.max(h.peekHold, 1.1+Math.random()*.6); h.peekT=H.cfg.peek*(.7+Math.random()*.7)+1.3; if(Math.random()<.45) h.giggleT=.1; }
    const tgt=h.peekHold>0?1:0; h.peek=clamp(h.peek+(tgt-h.peek)*Math.min(1,dt*7),0,1);
    if(h.giggleT>0){ h.giggleT-=dt; if(h.giggleT<=0){ const q=hiderPos(h,H.t), s=w2s(q.x,q.y); if(s.x>0&&s.x<H.vw&&s.y>0&&s.y<H.vh){ SFX.giggle(); addText(q.x+q.r, q.y-q.r-8, ['hee hee!','tee hee!','giggle!','can\'t see me!'][Math.floor(Math.random()*4)], '#ffd6f0', 20); } } }
  }
  // empty spots rustle on sneakier levels to fool you
  if(H.cfg.hide>=.45 && Math.random()<dt*.35){ const e=w.spots.filter(s=>!s.hider); if(e.length) e[Math.floor(Math.random()*e.length)].rustle=.5; }
  for(const s of w.spots) s.rustle=Math.max(0,s.rustle-dt);
  for(const f of w.fish){ f.wob=Math.max(0,f.wob-dt); f.x+=f.dir*f.sp*dt*(f.wob>0?.2:1); if(Math.abs(f.x-f.bx)>f.range){ f.dir*=-1; f.x=f.bx+Math.sign(f.x-f.bx)*f.range; } if(f.kind!=='crab') f.y=f.by+Math.sin(H.t*.8+f.ph)*(f.kind==='jelly'?26:12); }
  for(const b of w.bubbles){ b.y-=b.sp*dt; b.x+=Math.sin(H.t+b.ph)*.3; if(b.y<-20){ b.y=w.H+10; } }
  for(const p of w.snow){ p.y+=p.sp*dt; p.x+=Math.sin(H.t*.5+p.ph)*.15; if(p.y>w.H) p.y=-5; }
  for(const p of H.fx){ p.life-=dt; if(p.vx!=null){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=(p.k==='bub'?-60:220)*dt; p.vx*=.98; } }
  H.fx=H.fx.filter(p=>p.life>0);
  for(const t of H.texts){ t.life-=dt; t.y-=30*dt; } H.texts=H.texts.filter(t=>t.life>0);
  if(H.sonar){ H.sonar.life-=dt; if(H.sonar.life<=0) H.sonar=null; }
  for(const f of H.flyers){ f.t+=dt/.6; if(f.t>=1&&!f.landed){ f.landed=true; f.slot.classList.add('got'); SFX.star(2); } }
  H.flyers=H.flyers.filter(f=>f.t<1.05);
}

/* ================= DRAWING ================= */
function ink(x, lw=4){ x.lineWidth=lw; x.strokeStyle=INK; x.lineJoin='round'; x.lineCap='round'; x.stroke(); }
function blob(x, cx, cy, rx, ry, seed, n=9, j=.18){ x.beginPath(); for(let i=0;i<=n;i++){ const a=i/n*Math.PI*2, k=1+Math.sin(seed+i*2.3)*j; const px=cx+Math.cos(a)*rx*k, py=cy+Math.sin(a)*ry*k; i?x.lineTo(px,py):x.moveTo(px,py); } x.closePath(); }
function star5(x, cx, cy, R, r, rot=0){ x.beginPath(); for(let i=0;i<10;i++){ const a=rot-Math.PI/2+i*Math.PI/5, q=i%2?r:R; x.lineTo(cx+Math.cos(a)*q, cy+Math.sin(a)*q); } x.closePath(); }
const CORAL_COLS=['#ff6a8f','#ff9f1c','#b07aff','#3ad6c8','#ffd23a'];

function drawCover(x, s, t){
  const w=s.w, h=s.h, ro=s.rustle>0? Math.sin(t*40)*.05*s.rustle/.6 : 0, Z=H.world.Z;
  x.save(); x.translate(s.x, s.y); x.rotate(ro); x.scale(s.flip,1);
  const col=CORAL_COLS[s.hue%CORAL_COLS.length];
  switch(s.kind){
    case 'coral': { x.fillStyle=col; blob(x,0,-h*.45,w*.5,h*.5,s.seed,11,.1); x.fill(); ink(x,5);
      x.strokeStyle=shade(col,-.25); x.lineWidth=3; for(let i=0;i<4;i++){ x.beginPath(); x.moveTo(-w*.35+i*w*.12,-h*.15); x.bezierCurveTo(-w*.3+i*w*.12,-h*.6,-w*.1+i*w*.12,-h*.3,-w*.05+i*w*.12,-h*.75); x.stroke(); }
      x.fillStyle='rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(-w*.2,-h*.7,w*.14,h*.08,-.4,0,7); x.fill(); break; }
    case 'rock': { const g=x.createLinearGradient(0,-h,0,0); g.addColorStop(0,Z.id==='caves'?'#7b74b8':'#9fb4c8'); g.addColorStop(1,Z.id==='caves'?'#3d3670':'#5b7088'); x.fillStyle=g; x.beginPath(); x.moveTo(-w*.5,0); x.lineTo(-w*.45,-h*.55); x.lineTo(-w*.2,-h*.95); x.lineTo(w*.15,-h); x.lineTo(w*.42,-h*.65); x.lineTo(w*.5,0); x.closePath(); x.fill(); ink(x,5);
      x.fillStyle=Z.id==='kelp'?'#4fd17a':'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(-w*.08,-h*.85,w*.18,h*.07,.2,0,7); x.fill(); x.fillStyle='rgba(0,0,0,.12)'; x.beginPath(); x.moveTo(w*.15,-h); x.lineTo(w*.42,-h*.65); x.lineTo(w*.5,0); x.lineTo(w*.18,0); x.fill(); break; }
    case 'clam': { x.fillStyle='#c58cff'; x.beginPath(); x.moveTo(-w*.5,0); const N=7; for(let i=0;i<N;i++){ const a0=Math.PI+i/N*Math.PI, a1=Math.PI+(i+1)/N*Math.PI, am=(a0+a1)/2; x.quadraticCurveTo(Math.cos(am)*w*.6, Math.sin(am)*h*1.12, Math.cos(a1)*w*.5, Math.sin(a1)*h); } x.closePath(); x.fill(); ink(x,5);
      x.strokeStyle='#8a4fd8'; x.lineWidth=3; for(let i=1;i<N;i++){ const a=Math.PI+i/N*Math.PI; x.beginPath(); x.moveTo(0,-4); x.lineTo(Math.cos(a)*w*.45, Math.sin(a)*h*.9); x.stroke(); }
      x.fillStyle='#fff6fb'; x.beginPath(); x.arc(w*.2,-10,9,0,7); x.fill(); ink(x,3); break; }
    case 'castle': { x.fillStyle='#ffd88a'; x.fillRect(-w*.45,-h*.55,w*.9,h*.55); x.strokeStyle=INK; x.lineWidth=5; x.strokeRect(-w*.45,-h*.55,w*.9,h*.55);
      for(const tx of [-w*.42,w*.16]){ x.fillStyle='#ffe2a3'; x.fillRect(tx,-h*.95,w*.26,h*.45); x.strokeRect(tx,-h*.95,w*.26,h*.45); for(let k=0;k<3;k++){ x.fillRect(tx+k*w*.09,-h*1.02,w*.07,h*.08); x.strokeRect(tx+k*w*.09,-h*1.02,w*.07,h*.08); } }
      x.fillStyle=INK; x.beginPath(); x.arc(0,-h*.12,w*.09,Math.PI,0); x.lineTo(w*.09,0); x.lineTo(-w*.09,0); x.fill();
      x.strokeStyle=INK; x.lineWidth=3; x.beginPath(); x.moveTo(w*.29,-h*1.02); x.lineTo(w*.29,-h*1.3); x.stroke(); x.fillStyle='#ff5b6c'; x.beginPath(); x.moveTo(w*.29,-h*1.3); x.lineTo(w*.29+24+Math.sin(t*5)*4,-h*1.24); x.lineTo(w*.29,-h*1.18); x.fill(); break; }
    case 'kelp': { for(let i=0;i<7;i++){ const bx=-w*.42+i*w*.14, hh=h*(.75+((i*37+s.seed)%10)/40); const sw=Math.sin(t*1.3+i+s.seed)*16;
        x.fillStyle=i%2?'#2fb86a':'#46d17e'; x.beginPath(); x.moveTo(bx-12,0); x.bezierCurveTo(bx-18+sw*.3,-hh*.4,bx-10+sw,-hh*.7,bx+sw,-hh); x.bezierCurveTo(bx+16+sw,-hh*.7,bx+18+sw*.3,-hh*.4,bx+12,0); x.closePath(); x.fill(); ink(x,4);
        x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=2; x.beginPath(); x.moveTo(bx,-6); x.quadraticCurveTo(bx-6+sw*.5,-hh*.5,bx+sw,-hh+10); x.stroke(); } break; }
    case 'barrel': { x.fillStyle='#b8733a'; x.beginPath(); x.moveTo(-w*.38,0); x.quadraticCurveTo(-w*.55,-h*.5,-w*.38,-h); x.lineTo(w*.38,-h); x.quadraticCurveTo(w*.55,-h*.5,w*.38,0); x.closePath(); x.fill(); ink(x,5);
      x.strokeStyle='#5d6b78'; x.lineWidth=7; for(const yy of [.22,.78]){ x.beginPath(); x.moveTo(-w*.47,-h*yy); x.quadraticCurveTo(0,-h*yy+6,w*.47,-h*yy); x.stroke(); }
      x.strokeStyle='rgba(60,30,10,.45)'; x.lineWidth=3; for(const xx of [-.18,0,.18]){ x.beginPath(); x.moveTo(w*xx,-h*.95); x.lineTo(w*xx,-h*.05); x.stroke(); } break; }
    case 'chest': { x.fillStyle='#a8612b'; x.fillRect(-w*.46,-h*.62,w*.92,h*.62); x.strokeStyle=INK; x.lineWidth=5; x.strokeRect(-w*.46,-h*.62,w*.92,h*.62);
      x.fillStyle='#c27a3a'; x.beginPath(); x.moveTo(-w*.48,-h*.62); x.quadraticCurveTo(0,-h*1.1,w*.48,-h*.62); x.closePath(); x.fill(); ink(x,5);
      x.fillStyle='#ffd23a'; x.fillRect(-w*.08,-h*.7,w*.16,h*.22); x.strokeRect(-w*.08,-h*.7,w*.16,h*.22);
      x.globalAlpha=.6+.4*Math.sin(t*3+s.seed); x.fillStyle='#fff6a0'; star5(x,w*.3,-h*.8,10,4,t); x.fill(); x.globalAlpha=1; break; }
    case 'plank': { x.fillStyle='#9a6a3e'; x.save(); x.rotate(-.12); x.fillRect(-w*.5,-h*.45,w*.6,h*.45); x.strokeStyle=INK; x.lineWidth=5; x.strokeRect(-w*.5,-h*.45,w*.6,h*.45);
      x.beginPath(); x.moveTo(-w*.5,-h*.45); x.lineTo(w*.1,0); x.moveTo(w*.1,-h*.45); x.lineTo(-w*.5,0); x.lineWidth=3; x.stroke(); x.restore();
      x.fillStyle='#b8834f'; x.fillRect(-w*.1,-h*.98,w*.58,h*.98); x.strokeRect(-w*.1,-h*.98,w*.58,h*.98); x.strokeStyle='rgba(60,30,10,.5)'; x.lineWidth=3; for(let k=1;k<4;k++){ x.beginPath(); x.moveTo(-w*.1,-h*.98+k*h*.245); x.lineTo(w*.48,-h*.98+k*h*.245); x.stroke(); } break; }
    case 'crystal': { const cs=['#7ff0ff','#ff8fd8','#b9a6ff']; const P=[[-.3,.75,-.25],[0,1,.05],[.28,.8,.3],[-.12,.55,-.5],[.15,.6,.6]];
      x.save(); x.shadowColor=cs[s.hue%3]; x.shadowBlur=18+8*Math.sin(t*2+s.seed);
      P.forEach((p,i)=>{ x.save(); x.translate(w*p[0],0); x.rotate(p[2]*.5); const hh=h*p[1], ww=w*.13; x.fillStyle=cs[(s.hue+i)%3]; x.beginPath(); x.moveTo(-ww,0); x.lineTo(-ww,-hh*.75); x.lineTo(0,-hh); x.lineTo(ww,-hh*.75); x.lineTo(ww,0); x.closePath(); x.fill(); x.shadowBlur=0; ink(x,4); x.fillStyle='rgba(255,255,255,.5)'; x.fillRect(-ww*.5,-hh*.7,ww*.35,hh*.55); x.restore(); });
      x.restore(); x.fillStyle='#3d3670'; blob(x,0,-6,w*.5,14,s.seed,8,.15); x.fill(); ink(x,4); break; }
    case 'shroom': { x.fillStyle='#e8dcff'; x.fillRect(-w*.12,-h*.6,w*.24,h*.6); x.strokeStyle=INK; x.lineWidth=5; x.strokeRect(-w*.12,-h*.6,w*.24,h*.6);
      x.save(); x.shadowColor='#ff8fd8'; x.shadowBlur=22+10*Math.sin(t*2+s.seed); x.fillStyle=['#ff6ad5','#7ff0ff','#b9a6ff'][s.hue%3]; x.beginPath(); x.ellipse(0,-h*.62,w*.5,h*.38,0,Math.PI,0); x.closePath(); x.fill(); x.restore(); ink(x,5);
      x.fillStyle='rgba(255,255,255,.75)'; for(const [a,b,r] of [[-.25,-.8,9],[.1,-.88,7],[.3,-.72,6]]){ x.beginPath(); x.arc(w*a,h*b,r,0,7); x.fill(); } break; }
  }
  x.restore();
}
function drawLedge(x, L){ x.save(); x.translate(L.x, L.y); const g=x.createLinearGradient(0,-10,0,70); const cave=H.world.Z.id==='caves'; g.addColorStop(0,cave?'#5b52a0':'#7d93a8'); g.addColorStop(1,cave?'#2a2460':'#3d5068'); x.fillStyle=g;
  x.beginPath(); x.moveTo(-L.w/2,0); for(let i=0;i<=8;i++){ const px=-L.w/2+i*L.w/8; x.lineTo(px, (i%2?40:22)+Math.sin(L.seed+i)*14 + (i>0&&i<8?40*Math.sin(i/8*Math.PI):0)); } x.lineTo(L.w/2,0); x.quadraticCurveTo(0,-14,-L.w/2,0); x.fill(); ink(x,5);
  x.fillStyle=cave?'#8a7ff0':'#5bd17e'; x.beginPath(); x.ellipse(0,-4,L.w*.45,8,0,0,7); x.fill(); x.restore(); }
function drawDecor(x, d, t){
  x.save(); x.translate(d.x,d.y); x.scale(d.s,d.s); const c=CORAL_COLS[d.col%CORAL_COLS.length];
  switch(d.kind){
    case 'fan': case 'glowfan': { if(d.kind==='glowfan'){ x.shadowColor='#7ff0ff'; x.shadowBlur=16; } x.fillStyle=d.kind==='glowfan'?'#5fe1ff':c; x.beginPath(); x.moveTo(0,0); x.arc(0,-10,70,-Math.PI*.92+Math.sin(t+d.seed)*.05,-Math.PI*.08+Math.sin(t+d.seed)*.05); x.closePath(); x.globalAlpha=.9; x.fill(); x.globalAlpha=1; x.shadowBlur=0; ink(x,4);
      x.strokeStyle=shade(d.kind==='glowfan'?'#5fe1ff':c,-.3); x.lineWidth=2; for(let i=1;i<6;i++){ const a=-Math.PI+i/6*Math.PI; x.beginPath(); x.moveTo(0,-4); x.lineTo(Math.cos(a)*64,-10+Math.sin(a)*64); x.stroke(); } break; }
    case 'branch': { x.strokeStyle=INK; x.lineWidth=16; const br=(l,a,dpt)=>{ if(dpt>3) return; x.save(); x.rotate(a+Math.sin(t*.8+d.seed+dpt)*.04); x.beginPath(); x.moveTo(0,0); x.lineTo(0,-l); x.stroke(); x.translate(0,-l); br(l*.7,-.5,dpt+1); br(l*.7,.45,dpt+1); x.restore(); };
      x.lineWidth=17; x.strokeStyle=INK; br(42,0,0); x.lineWidth=10; x.strokeStyle=c; br(42,0,0); break; }
    case 'anemone': { for(let i=0;i<9;i++){ const a=-Math.PI*.9+i/8*Math.PI*.8, sw=Math.sin(t*2+i+d.seed)*.15; x.save(); x.rotate(a+Math.PI/2+sw); x.strokeStyle=INK; x.lineWidth=13; x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(8,-26,0,-50); x.stroke(); x.strokeStyle=c; x.lineWidth=7; x.stroke(); x.fillStyle='#fff'; x.beginPath(); x.arc(0,-50,5,0,7); x.fill(); x.restore(); }
      x.fillStyle=shade(c,-.2); x.beginPath(); x.ellipse(0,0,30,14,0,0,7); x.fill(); ink(x,4); break; }
    case 'star': { x.fillStyle=['#ff7a1f','#ff6a8f','#ffd23a'][d.col%3]; star5(x,0,0,24,11,d.seed); x.fill(); ink(x,4); x.fillStyle='rgba(255,255,255,.6)'; for(let i=0;i<5;i++){ const a=d.seed-Math.PI/2+i*1.2566; x.beginPath(); x.arc(Math.cos(a)*12,Math.sin(a)*12,2.5,0,7); x.fill(); } break; }
    case 'kelp': { const sw=Math.sin(t*1.2+d.seed)*18; x.strokeStyle=INK; x.lineWidth=16; x.beginPath(); x.moveTo(0,0); x.bezierCurveTo(-14,-60,14+sw*.5,-110,sw,-170); x.stroke(); x.strokeStyle='#3cc777'; x.lineWidth=10; x.stroke(); break; }
    case 'anchor': { x.rotate(.3); x.strokeStyle=INK; x.lineWidth=16; x.beginPath(); x.moveTo(0,-90); x.lineTo(0,0); x.moveTo(-40,-20); x.quadraticCurveTo(0,30,40,-20); x.moveTo(-25,-70); x.lineTo(25,-70); x.stroke(); x.strokeStyle='#8a97a6'; x.lineWidth=9; x.stroke(); x.beginPath(); x.arc(0,-100,12,0,7); x.lineWidth=12; x.strokeStyle=INK; x.stroke(); x.strokeStyle='#8a97a6'; x.lineWidth=6; x.stroke(); break; }
    case 'crystal': { x.shadowColor='#7ff0ff'; x.shadowBlur=14; x.fillStyle=['#7ff0ff','#ff8fd8','#b9a6ff'][d.col%3]; x.beginPath(); x.moveTo(-12,0); x.lineTo(-12,-40); x.lineTo(0,-56); x.lineTo(12,-40); x.lineTo(12,0); x.closePath(); x.fill(); x.shadowBlur=0; ink(x,4); break; }
    case 'shroom': { x.fillStyle='#d8ccff'; x.fillRect(-7,-36,14,36); x.shadowColor='#ff8fd8'; x.shadowBlur=14; x.fillStyle=['#ff6ad5','#7ff0ff'][d.col%2]; x.beginPath(); x.ellipse(0,-36,32,22,0,Math.PI,0); x.closePath(); x.fill(); x.shadowBlur=0; ink(x,4); break; }
  }
  x.restore();
}
function drawFish(x, f, t){
  x.save(); x.translate(f.x,f.y); const wob=f.wob>0? Math.sin(t*40)*.25 : 0; x.rotate(wob); x.scale(f.s*f.dir,f.s);
  if(f.kind==='fish'){ const tail=Math.sin(t*10+f.ph)*6; x.fillStyle=f.col; x.beginPath(); x.moveTo(-26,0); x.lineTo(-44,-14+tail); x.lineTo(-44,14+tail); x.closePath(); x.fill(); ink(x,3);
    x.beginPath(); x.ellipse(0,0,30,19,0,0,7); x.fill(); ink(x,3.5); x.fillStyle='rgba(255,255,255,.55)'; x.fillRect(-6,-17,7,34);
    x.fillStyle='#fff'; x.beginPath(); x.arc(14,-4,6,0,7); x.fill(); x.fillStyle=INK; x.beginPath(); x.arc(15.5,-4,3.2,0,7); x.fill(); }
  else if(f.kind==='jelly'){ const glow=H.world.Z.glow; if(glow){ x.shadowColor=f.col; x.shadowBlur=20; } x.fillStyle=f.col; x.globalAlpha=.85; x.beginPath(); x.arc(0,0,24,Math.PI,0); x.quadraticCurveTo(0,8,-24,0); x.fill(); x.shadowBlur=0; ink(x,3); x.globalAlpha=1;
    x.strokeStyle=f.col; x.lineWidth=3; for(let i=-2;i<=2;i++){ x.beginPath(); x.moveTo(i*8,4); x.quadraticCurveTo(i*8+Math.sin(t*3+i)*6,22,i*8,40); x.stroke(); }
    x.fillStyle=INK; x.beginPath(); x.arc(-7,-8,2.6,0,7); x.arc(7,-8,2.6,0,7); x.fill(); }
  else { x.fillStyle='#ff5b4a'; x.beginPath(); x.ellipse(0,0,24,15,0,0,7); x.fill(); ink(x,3.5); const cl=Math.sin(t*4+f.ph)*.3; for(const sd of [-1,1]){ x.beginPath(); x.arc(sd*30,-12,9,cl,cl+5); x.fillStyle='#ff5b4a'; x.fill(); ink(x,3); }
    x.fillStyle='#fff'; x.beginPath(); x.arc(-7,-16,5,0,7); x.arc(7,-16,5,0,7); x.fill(); x.fillStyle=INK; x.beginPath(); x.arc(-7,-16,2.5,0,7); x.arc(7,-16,2.5,0,7); x.fill(); }
  x.restore();
}
function drawHider(x, h, t){
  if(h.found && h.ft>0.85) return;
  const q=hiderPos(h,t), b=badgeFor(h.ch), s=h.s;
  x.save();
  if(!h.found){ x.beginPath(); x.rect(s.x-s.w, q.y-q.r*3, s.w*2, (s.y-s.h*s.mid*.5)-(q.y-q.r*3)); x.clip(); }
  if(h.glow>0||(H.sonar&&H.sonar.h===h)||H.world.Z.glow){ x.save(); x.globalAlpha=H.world.Z.glow&&!h.glow?.35:.7; const g=x.createRadialGradient(q.x,q.y,q.r*.5,q.x,q.y,q.r*2); g.addColorStop(0,'rgba(255,240,150,.9)'); g.addColorStop(1,'rgba(255,240,150,0)'); x.fillStyle=g; x.fillRect(q.x-q.r*2,q.y-q.r*2,q.r*4,q.r*4); x.restore(); }
  x.translate(q.x,q.y);
  let sc=1, rot=Math.sin(t*3+h.phase)*.06*h.peek;
  if(h.found){ const k=clamp(h.ft/.8,0,1); sc=1+Math.sin(k*Math.PI)*.45; rot=Math.sin(k*Math.PI*4)*.35; }
  x.rotate(rot); x.scale(sc,sc);
  x.drawImage(b.canvas, -q.r*1.07, -q.r*1.07, q.r*2.14, q.r*2.14);
  x.restore();
}
function drawPaws(x, h, t){ if(h.found||h.peek<.35) return; const q=hiderPos(h,t), s=h.s, top=s.y-s.h*(1-s.mid); const col=hex(h.ch.color);
  for(const sd of [-1,1]){ x.beginPath(); x.ellipse(q.x+sd*q.r*.62, top+3, 10, 8, 0, 0, 7); x.fillStyle=col; x.globalAlpha=Math.min(1,(h.peek-.35)*3); x.fill(); ink(x,3); x.globalAlpha=1; } }
function drawHulk(x, k){ x.save(); x.translate(k.x,k.y); x.scale(k.s,k.s); x.rotate(-.08);
  x.fillStyle='#6b4a2f'; x.beginPath(); x.moveTo(-420,-20); x.quadraticCurveTo(-380,-230,-300,-250); x.lineTo(330,-250); x.quadraticCurveTo(420,-200,440,-60); x.quadraticCurveTo(0,40,-420,-20); x.fill(); ink(x,7);
  x.strokeStyle='rgba(30,15,5,.45)'; x.lineWidth=4; for(let i=1;i<5;i++){ x.beginPath(); x.moveTo(-390,-20-i*45); x.lineTo(420,-20-i*45); x.stroke(); }
  for(let i=0;i<5;i++){ x.beginPath(); x.arc(-220+i*110,-150,22,0,7); x.fillStyle='#203a5a'; x.fill(); ink(x,5); }
  x.fillStyle='#4a3420'; x.beginPath(); x.moveTo(-40,-250); x.lineTo(-20,-620); x.lineTo(0,-620); x.lineTo(10,-250); x.fill(); ink(x,6); x.fillStyle='rgba(240,230,200,.7)'; x.beginPath(); x.moveTo(0,-600); x.quadraticCurveTo(140,-520,10,-380); x.closePath(); x.fill(); ink(x,4);
  x.restore(); }

function render(){
  const x=H.cx, d=H.dpr; x.setTransform(d,0,0,d,0,0);
  const vw=H.vw, vh=H.vh, w=H.world;
  if(!w){ x.fillStyle='#0b4fa6'; x.fillRect(0,0,vw,vh); return; }
  const c=H.cam, Z=w.Z, t=H.t, z=c.z;
  const W2S=()=>x.setTransform(d*z,0,0,d*z,d*(vw/2-c.x*z),d*(vh/2-c.y*z));
  // water (world gradient), outside world
  x.fillStyle=Z.water[2]; x.fillRect(0,0,vw,vh);
  W2S(); const g=x.createLinearGradient(0,0,0,w.H); g.addColorStop(0,Z.water[0]); g.addColorStop(.5,Z.water[1]); g.addColorStop(1,Z.water[2]); x.fillStyle=g; x.fillRect(0,0,w.W,w.H);
  // god rays (screen space, parallax)
  x.setTransform(d,0,0,d,0,0);
  if(Z.rays>0){ x.save(); x.globalCompositeOperation='lighter'; const depth=clamp(1-(c.y/w.H),.25,1);
    for(let i=0;i<6;i++){ const rx=((i*vw/4.2 - c.x*z*.15)%(vw*1.5)+vw*1.5)%(vw*1.5)-vw*.25 + Math.sin(t*.4+i)*30; const rw=60+((i*53)%90);
      const gr=x.createLinearGradient(0,0,0,vh); gr.addColorStop(0,`rgba(255,255,230,${.22*Z.rays*depth})`); gr.addColorStop(1,'rgba(255,255,230,0)'); x.fillStyle=gr;
      x.beginPath(); x.moveTo(rx,0); x.lineTo(rx+rw,0); x.lineTo(rx+rw*2.4+vh*.25,vh); x.lineTo(rx+vh*.25,vh); x.fill(); } x.restore(); }
  // parallax hills (far, mid)
  const groundS=(w.floor-c.y)*z+vh/2;
  for(const [arr,f,col] of [[w.far,.35,Z.far],[w.mid,.62,Z.mid]]){ const base=groundS*f+vh*.82*(1-f); if(base>vh+300) continue; x.fillStyle=col; x.globalAlpha=.85; x.beginPath(); x.moveTo(-10,vh+10);
    for(const p of arr){ const X=(p.x-c.x)*z*f+vw/2; x.lineTo(X-p.wd*z*f*.5, base); x.quadraticCurveTo(X, base-p.h*z*(.6+f), X+p.wd*z*f*.5, base); }
    x.lineTo(vw+10,vh+10); x.closePath(); x.fill(); x.globalAlpha=1; }
  W2S();
  const vx0=c.x-vw/2/z-200, vx1=c.x+vw/2/z+200, vy0=c.y-vh/2/z-300, vy1=c.y+vh/2/z+300; const vis=(px,py)=>px>vx0&&px<vx1&&py>vy0&&py<vy1;
  // caves: stalactites
  for(const s of w.stal){ if(s.x<vx0||s.x>vx1) continue; x.fillStyle='#2a2460'; x.beginPath(); x.moveTo(s.x-s.wd/2,-10); x.lineTo(s.x,s.h); x.lineTo(s.x+s.wd/2,-10); x.fill(); ink(x,4); if(s.gl){ x.save(); x.shadowColor='#7ff0ff'; x.shadowBlur=18; x.fillStyle='#7ff0ff'; x.beginPath(); x.arc(s.x,s.h-6,6+Math.sin(t*2+s.x)*2,0,7); x.fill(); x.restore(); } }
  // back kelp
  for(const k of w.back){ if(k.x<vx0||k.x>vx1) continue; const sw=Math.sin(t*.9+k.seed)*24; x.strokeStyle=Z.id==='caves'?'rgba(120,100,220,.55)':'rgba(20,90,70,.55)'; x.lineWidth=k.wd; x.beginPath(); x.moveTo(k.x,k.y); x.bezierCurveTo(k.x-20,k.y-k.h*.35,k.x+20+sw*.5,k.y-k.h*.7,k.x+sw,k.y-k.h); x.stroke(); }
  if(w.hulk) drawHulk(x,w.hulk);
  // sand floor
  const sg=x.createLinearGradient(0,w.floor-30,0,w.H); sg.addColorStop(0,Z.sand[0]); sg.addColorStop(1,Z.sand[1]); x.fillStyle=sg; x.beginPath(); x.moveTo(0,w.H+20); w.wave.forEach((y,i)=>x.lineTo(i*40,y)); x.lineTo(w.W+40,w.H+20); x.closePath(); x.fill(); ink(x,6);
  x.strokeStyle='rgba(255,255,255,.18)'; x.lineWidth=4; for(let i=0;i<w.W/240;i++){ const sx=i*240+60; if(sx<vx0||sx>vx1) continue; const sy=w.floorY(sx)+50+(i%3)*30; x.beginPath(); x.moveTo(sx,sy); x.quadraticCurveTo(sx+40,sy-10,sx+80,sy); x.stroke(); }
  // caustics
  x.save(); x.beginPath(); x.rect(vx0,w.floor-260,vx1-vx0,w.H); x.clip(); x.globalCompositeOperation='lighter'; x.globalAlpha=Z.glow?.04:.08; const T=420, cx0=Math.floor(vx0/T)*T, cy0=Math.floor(Math.max(w.floor-260,vy0)/T)*T-T;
  for(const [ox,oy] of [[t*14,t*9],[-t*11,t*13]]){ for(let yy=cy0; yy<Math.min(vy1,w.H)+T; yy+=T) for(let xx=cx0-T; xx<vx1; xx+=T) x.drawImage(H.caustic, xx+(ox%T), yy+(oy%T), T, T); }
  x.restore();
  // decor (back)
  for(const dd of w.decor) if(!dd.front && vis(dd.x,dd.y)) drawDecor(x,dd,t);
  for(const L of w.ledges) if(vis(L.x,L.y)) drawLedge(x,L);
  // spots: hider (behind) then cover, then paws
  for(const s of w.spots){ if(!vis(s.x,s.y)) continue; if(s.hider) drawHider(x,s.hider,t); drawCover(x,s,t); if(s.hider) drawPaws(x,s.hider,t); }
  for(const f of w.fish) if(vis(f.x,f.y)) drawFish(x,f,t);
  for(const dd of w.decor) if(dd.front && vis(dd.x,dd.y)) drawDecor(x,dd,t);
  // found hiders popping above everything
  for(const h of w.hiders) if(h.found && h.ft<=.85) drawHider(x,h,t);
  // bubbles + marine snow
  x.fillStyle='rgba(255,255,255,.5)'; for(const p of w.snow) if(vis(p.x,p.y)){ x.globalAlpha=.3+.3*Math.sin(t+p.ph); x.fillRect(p.x,p.y,p.r,p.r); } x.globalAlpha=1;
  x.lineWidth=2; for(const b of w.bubbles){ if(!vis(b.x,b.y)) continue; x.beginPath(); x.arc(b.x,b.y,b.r,0,7); x.fillStyle='rgba(255,255,255,.18)'; x.fill(); x.strokeStyle='rgba(255,255,255,.7)'; x.stroke(); x.fillStyle='rgba(255,255,255,.8)'; x.beginPath(); x.arc(b.x-b.r*.35,b.y-b.r*.35,b.r*.25,0,7); x.fill(); }
  // sonar
  if(H.sonar){ const q=hiderPos(H.sonar.h,t); for(let i=0;i<3;i++){ const k=((t*.9+i/3)%1); x.globalAlpha=1-k; x.lineWidth=6; x.strokeStyle=i%2?'#ff6ad5':'#ffe25a'; x.beginPath(); x.arc(q.x,q.y,q.r+k*260,0,7); x.stroke(); } x.globalAlpha=1; }
  // fx
  for(const p of H.fx){ const a=clamp(p.life/p.max,0,1); x.globalAlpha=a;
    if(p.k==='star'){ x.fillStyle=p.c; star5(x,p.x,p.y,p.r*1.6,p.r*.7,p.life*4); x.fill(); ink(x,2); }
    else if(p.k==='dot'){ x.fillStyle=p.c; x.beginPath(); x.arc(p.x,p.y,p.r,0,7); x.fill(); ink(x,2); }
    else if(p.k==='bub'){ x.strokeStyle='#d8fbff'; x.lineWidth=2.5; x.beginPath(); x.arc(p.x,p.y,p.r,0,7); x.stroke(); }
    else if(p.k==='ring'){ x.strokeStyle='#fff'; x.lineWidth=8*a; x.beginPath(); x.arc(p.x,p.y,p.r+(1-a)*160,0,7); x.stroke(); } }
  x.globalAlpha=1;
  x.textAlign='center'; x.textBaseline='middle';
  for(const tx of H.texts){ const a=clamp(tx.life/tx.max*1.6,0,1), pop=1+Math.max(0,(tx.life-tx.max+.2))*2; x.globalAlpha=a; x.font=`${Math.round(tx.size*pop/Math.min(1,Math.max(.6,z)))}px ${FONT}`; x.lineWidth=7/Math.min(1,Math.max(.6,z)); x.strokeStyle=INK; x.strokeText(tx.txt,tx.x,tx.y); x.fillStyle=tx.col; x.fillText(tx.txt,tx.x,tx.y); }
  x.globalAlpha=1;
  // screen space: depth darkness for caves, vignette
  x.setTransform(d,0,0,d,0,0);
  if(Z.glow){ const vg=x.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.3,vw/2,vh/2,Math.max(vw,vh)*.75); vg.addColorStop(0,'rgba(8,4,30,0)'); vg.addColorStop(1,'rgba(8,4,30,.6)'); x.fillStyle=vg; x.fillRect(0,0,vw,vh); }
  else { const vg=x.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.45,vw/2,vh/2,Math.max(vw,vh)*.8); vg.addColorStop(0,'rgba(0,20,60,0)'); vg.addColorStop(1,'rgba(0,20,60,.35)'); x.fillStyle=vg; x.fillRect(0,0,vw,vh); }
  // sonar off-screen arrow
  if(H.sonar){ const q=hiderPos(H.sonar.h,t), s=w2s(q.x,q.y); if(s.x<0||s.y<0||s.x>vw||s.y>vh){ const a=Math.atan2(s.y-vh/2,s.x-vw/2), m=56; const ex=clamp(vw/2+Math.cos(a)*vw, m, vw-m), ey=clamp(vh/2+Math.sin(a)*vh, m+60, vh-m-20);
    x.save(); x.translate(ex,ey); x.rotate(a); const pu=1+Math.sin(t*8)*.12; x.scale(pu,pu); x.fillStyle='#ffe25a'; x.beginPath(); x.moveTo(30,0); x.lineTo(-16,-24); x.lineTo(-6,0); x.lineTo(-16,24); x.closePath(); x.fill(); ink(x,5); x.restore(); } }
  // net cursor (mouse hover) + tap net
  if(H.ptr&&H.ptr.hover&&H.running){ drawNet(x,H.ptr.x,H.ptr.y,0); }
  for(const p of H.fx) if(p.k==='net') drawNet(x,p.sx,p.sy,1-p.life/p.max);
  // flyers (found friend flies to tray)
  for(const f of H.flyers){ const k=ease(clamp(f.t,0,1)); const fx=lerp(f.x0,f.x1,k), fy=lerp(f.y0,f.y1,k)-Math.sin(k*Math.PI)*80, r=lerp(f.r0,f.r1,k); const b=badgeFor(f.h.ch); x.drawImage(b.canvas,fx-r*1.07,fy-r*1.07,r*2.14,r*2.14); }
}
function drawNet(x, px, py, swing){ x.save(); x.translate(px,py); x.rotate(-.5+swing*1.2); x.strokeStyle=INK; x.lineWidth=9; x.beginPath(); x.moveTo(14,14); x.lineTo(48,48); x.stroke(); x.strokeStyle='#ffb000'; x.lineWidth=5; x.stroke();
  x.beginPath(); x.arc(0,0,22,0,7); x.fillStyle='rgba(255,255,255,.22)'; x.fill(); x.lineWidth=7; x.strokeStyle=INK; x.stroke(); x.lineWidth=4; x.strokeStyle='#ff6ad5'; x.stroke();
  x.strokeStyle='rgba(255,255,255,.6)'; x.lineWidth=1.5; for(let i=-2;i<=2;i++){ x.beginPath(); x.moveTo(i*8,-20); x.lineTo(i*8,20); x.moveTo(-20,i*8); x.lineTo(20,i*8); x.stroke(); } x.restore(); }

function loop(now){
  if(!H) return; const dt=Math.min(.05,(now-H.last)/1000||0); H.last=now;
  try{ if(H.screen==='play'){ update(dt); render(); if((H._hudT=(H._hudT||0)+dt)>.2){ H._hudT=0; updateHud(); } } }catch(e){ console.error(e); }
  H.raf=requestAnimationFrame(loop);
}
