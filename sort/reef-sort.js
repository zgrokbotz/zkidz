/* ZKIDZ · Reef Sort — a gentle "goods sort / triple match" with the ocean friends.
 * Usage (inside the main game):  import { openReefSort } from './sort/reef-sort.js';
 *   openReefSort({ ECO, S, save, onExit: () => {...} });
 * Standalone harness: sort/index.html (uses makeLocalHost). See INTEGRATION.md. */
import { SORT_CHARS, BAR_SIZE, LEVEL_COUNT, levelParams, buildLevel, solve, reshuffle } from './levels.js?v=20261116-12';

/* ============================================================================================
 * REWARDS — Zokenomics' economy v2, approved by Zander.
 * Base pay + skill bonus go through ECO.reefEarn (no half pay, no daily caps). Every clear is a win for the
 * shared "every 5 wins = a Play chest" counter via opts.onWin() (the chest opens back in the lobby).
 * ============================================================================================ */
export const REEF_SORT_FIRST_CLEAR = 30;          // first clear of each story level 1-12 (mirrors ECO.REEF_SORT_FIRST_CLEAR)
export const REEF_SORT_REPLAY = 15;               // every replay and every endless/bonus level (mirrors ECO.REEF_SORT_REPLAY)
/* Skill bonus (levels 7+ and endless). Paid on top of the base, capped per level (+6). No daily cap in v2. */
export const RS_BONUS_MIN_LEVEL = 7, RS_COMBO2 = 2, RS_COMBO3 = 3, RS_ROW_CLEAR = 3, RS_BONUS_LEVEL_CAP = 6;

/* Own save key — never touches the shape of zkidz_save_v1 (only coins/daily counters via ECO). */
export const SORT_SAVE_KEY = 'zkidz_sort_v1';
const defaultSortSave = () => ({ v:1, unlocked:1, cur:1, stars:{}, bestMoves:{}, clears:0, muted:false });
export function loadSortSave(){ try{ const o=JSON.parse(localStorage.getItem(SORT_SAVE_KEY)||'{}'); return Object.assign(defaultSortSave(), (o && typeof o==='object' && !Array.isArray(o)) ? o : {}); }catch(e){ return defaultSortSave(); } }
function storeSortSave(P){ try{ localStorage.setItem(SORT_SAVE_KEY, JSON.stringify(P)); }catch(e){} }
/** For the lobby picker if Zamer wants it: { unlocked, cur, total } */
export function getReefSortProgress(){ const P=loadSortSave(); return { unlocked:P.unlocked, cur:P.cur, total:LEVEL_COUNT, stars:P.stars }; }

/** Standalone wallet: reads the main save (zkidz_save_v1) and writes back ONLY coins + the daily counters
 *  that ECO.ensureDay/cardsEarn use, re-reading the latest save first so nothing else is overwritten. */
export function makeLocalHost(){
  const MAIN='zkidz_save_v1', FIELDS=['coins','activitiesToday','playDate','loginDate','freeChestsToday','boughtChestsToday','rsBonusToday','playDays','highTreasureToday'];
  const read=()=>{ try{ const o=JSON.parse(localStorage.getItem(MAIN)||'null'); return (o && typeof o==='object') ? o : null; }catch(e){ return null; } };
  const S=Object.assign({ coins:200, activitiesToday:0, playDate:'', loginDate:'', freeChestsToday:0, boughtChestsToday:0, rsBonusToday:0 }, read()||{});
  for(const k of ['coins','activitiesToday','freeChestsToday','boughtChestsToday','rsBonusToday']) if(typeof S[k]!=='number') S[k]=0;
  const save=()=>{ const cur=read()||{}; for(const k of FIELDS) cur[k]=S[k]; try{ localStorage.setItem(MAIN, JSON.stringify(cur)); }catch(e){} };
  return { S, save };
}

/* ===================== AUDIO (WebAudio only, no files) ===================== */
const SND = { ac:null, muted:false,
  ctx(){ if(!this.ac){ try{ this.ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(this.ac.state==='suspended') this.ac.resume(); return this.ac; },
  tone(f, d=.12, type='sine', v=.15, f2=null, delay=0){ if(this.muted) return; const ac=this.ctx(); if(!ac) return; const t=ac.currentTime+delay; const o=ac.createOscillator(), g=ac.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+d); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+.012); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t+d+.05); },
  noise(d=.2, v=.12, f0=800, f1=3000, delay=0){ if(this.muted) return; const ac=this.ctx(); if(!ac) return; const t=ac.currentTime+delay; const n=Math.floor(ac.sampleRate*d); const b=ac.createBuffer(1,n,ac.sampleRate); const ch=b.getChannelData(0); for(let i=0;i<n;i++) ch[i]=Math.random()*2-1; const s=ac.createBufferSource(); s.buffer=b; const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.2; bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+d); const g=ac.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d); s.connect(bp).connect(g).connect(ac.destination); s.start(t); },
  pick(){ this.tone(620,.08,'square',.06,940); },
  place(){ this.tone(330,.09,'triangle',.22,190); this.noise(.05,.05,1800,900); },
  nope(){ this.tone(220,.14,'sine',.12,160); },
  pop(){ this.noise(.09,.18,2400,600); this.tone(880,.1,'sine',.12,1320); },
  chime(){ [1047,1319,1568,2093].forEach((f,i)=>this.tone(f,.22,'triangle',.11,null,.05+i*.06)); },
  reveal(){ this.tone(400,.16,'sine',.1,800); },
  cheer(seed=0){ if(this.muted) return; const ac=this.ctx(); if(!ac) return; const base=300+(seed%7)*35; const t=ac.currentTime+.08;
    // a little "yay!": two detuned saws through vowel-ish formant filters, pitch swooping up with vibrato
    for(const [ff,q,vol] of [[800,6,.09],[1300,8,.06],[2600,10,.03]]){ const o=ac.createOscillator(), o2=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain(), lfo=ac.createOscillator(), lg=ac.createGain();
      o.type=o2.type='sawtooth'; o.frequency.setValueAtTime(base,t); o.frequency.exponentialRampToValueAtTime(base*1.9,t+.18); o.frequency.exponentialRampToValueAtTime(base*1.6,t+.45); o2.frequency.setValueAtTime(base*1.01,t); o2.frequency.exponentialRampToValueAtTime(base*1.92,t+.18);
      lfo.frequency.value=7; lg.gain.value=base*.04; lfo.connect(lg); lg.connect(o.frequency);
      f.type='bandpass'; f.frequency.setValueAtTime(ff*.8,t); f.frequency.linearRampToValueAtTime(ff*1.1,t+.2); f.Q.value=q;
      g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.04); g.gain.setValueAtTime(vol,t+.3); g.gain.exponentialRampToValueAtTime(.0001,t+.5);
      o.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); for(const x of [o,o2,lfo]){ x.start(t); x.stop(t+.55); } } },
  whoosh(){ this.noise(.45,.16,300,4000); },
  hint(){ this.tone(1568,.12,'sine',.1); this.tone(2093,.18,'sine',.1,null,.12); },
  win(){ [523,659,784,1047,784,1047].forEach((f,i)=>this.tone(f,.2,'square',.07,null,i*.11)); [262,330,392,523].forEach((f,i)=>this.tone(f,.5,'triangle',.12,null,.66+i*.02)); this.noise(.3,.08,3000,6000,.66); },
  click(){ this.tone(900,.05,'square',.05); },
};

/* ===================== STATE ===================== */
let R = null; // the one running instance
const $ = (sel, el) => (el||R.root).querySelector(sel);
const $$ = (sel, el) => [...(el||R.root).querySelectorAll(sel)];
const CHEERS = ['YAY!','WOO-HOO!','SPLASH!','HOORAY!','YIPPEE!','WHEEE!','TA-DA!'];
const defaultArt = (id) => (typeof window!=='undefined' && window.__ART && window.__ART[id]) || new URL(`../art/${id}.jpg?v=20261116-12`, import.meta.url).href;

export function openReefSort(opts={}){
  if(R) closeReefSort();
  if(!document.getElementById('reefSortCss') && !opts.noCss){ const l=document.createElement('link'); l.id='reefSortCss'; l.rel='stylesheet'; l.href=new URL('./reef-sort.css?v=20261116-12', import.meta.url).href; l.onload=()=>{ if(R && R.st){ layoutBoard(); render(false); } }; document.head.appendChild(l); } // re-measure once the stylesheet is in
  const P=loadSortSave(); SND.muted=!!P.muted;
  R = { opts, P, art: opts.artUrl || defaultArt, root:null, st:null, busy:false, sel:null, hist:[], drag:null, timers:new Set(), hintShown:false, idleT:0 };
  const root=document.createElement('div'); root.id='reefSort'; R.root=root;
  root.innerHTML=`<div class="rs-bg">${Array.from({length:4},(_,i)=>`<div class="ray" style="left:${8+i*26}%;opacity:${.5+.5*(i%2)}"></div>`).join('')}${Array.from({length:14},(_,i)=>{ const s=8+Math.random()*26; return `<i style="left:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${7+Math.random()*9}s;animation-delay:${-Math.random()*14}s"></i>`; }).join('')}</div>
  <div class="rs-wrap">
    <div class="rs-top"><button class="rs-btn blue rs-back" aria-label="Back">◀</button><div class="rs-lvl"><small>REEF SORT</small><b class="rs-lvlnum">LEVEL 1</b></div><div class="rs-pill"><span class="rs-star"></span><span class="rs-coins">0</span></div><button class="rs-btn blue rs-mute" aria-label="Sound">🔊</button></div>
    <div class="rs-hud"><div class="rs-orders"></div><div class="rs-barwrap"><div class="rs-bar"></div></div></div>
    <div class="rs-board"><div class="rs-grid"></div></div>
    <div class="rs-tools"><button class="rs-btn rs-tool blue rs-undo"><span>↩️</span>UNDO</button><button class="rs-btn rs-tool rs-hintb"><span>💡</span>HINT</button><button class="rs-btn rs-tool pink rs-shuf"><span>🔀</span>SHUFFLE</button><button class="rs-btn rs-tool green rs-mapb"><span>🗺️</span>LEVELS</button></div>
  </div>
  <div class="rs-fx"></div><div class="rs-toast"></div><div class="rs-modal hidden"><div class="rs-card"></div></div>`;
  (opts.mount||document.body).appendChild(root);
  bindUI();
  startLevel(Math.max(1, Math.min(opts.level || P.cur || 1, P.unlocked || 1)));
  window.__reefSort = api();
  return api();
}
export function closeReefSort(){ if(!R) return; for(const t of R.timers) clearTimeout(t); window.removeEventListener('resize', R.onResize); window.removeEventListener('keydown', R.onKey); window.removeEventListener('pointermove', R.onMove); window.removeEventListener('pointerup', R.onUp); window.removeEventListener('pointercancel', R.onUp); clearHint(); R.root.remove(); R=null; }
function api(){ return { close:closeReefSort, startLevel:(n)=>startLevel(n), get state(){ return R && R.st; }, compact:()=>toCompact(), solveNow:()=>solve(toCompact()), moveByLoc:(a,b)=>tryMove(parseLoc(a), parseLoc(b)), selectLoc:(l)=>handleTapOn($(`.rs-item[data-loc="${l}"]`)), tapLoc:(l)=>handleTapOn(locEl(l)), get busy(){ return R && R.busy; }, nextMove:()=>nextMoveLocs(), left:()=>left(), get level(){ return R && R.level; }, get skill(){ return R && { on:R.bonusOn, chain:R.chain, bonus:R.bonus }; } }; }
const DRAG_PX = 12; // a press must travel this far before it becomes a drag — wiggles during a tap stay taps
const later=(fn,ms)=>{ const t=setTimeout(()=>{ R && R.timers.delete(t); if(R) fn(); },ms); R.timers.add(t); return t; };

/* ---------- state helpers ---------- */
let UID=1;
function fromCompact(c){ return { trays:c.trays.map(tr=>tr.map(l=>l.map(x=>x>=0?{id:UID++,c:x}:null))), bar:c.bar.map(x=>({id:UID++,c:x})) }; }
function toCompact(st=R.st){ return { trays:st.trays.map(tr=>tr.map(l=>l.map(o=>o?o.c:-1))), bar:st.bar.map(o=>o.c) }; }
const cloneSt = (st) => ({ trays:st.trays.map(tr=>tr.map(l=>l.map(o=>o?{...o}:null))), bar:st.bar.map(o=>({...o})) });
function left(st=R.st){ let n=st.bar.length; for(const tr of st.trays) for(const l of tr) for(const o of l) if(o) n++; return n; }
function charsLeft(){ const m={}; const add=o=>{ if(o) m[o.c]=(m[o.c]||0)+1; }; R.st.trays.forEach(tr=>tr.forEach(l=>l.forEach(add))); R.st.bar.forEach(add); return m; }
function visibleChars(){ const s=new Set(); R.st.trays.forEach(tr=>tr[0].forEach(o=>o&&s.add(o.c))); R.st.bar.forEach(o=>s.add(o.c)); return s; }
function parseLoc(s){ if(!s) return null; const p=String(s).split(':'); return p[0]==='b' ? { bar:true, i:+p[1] } : { t:+p[1], s:+p[2] }; }
const locStr = (l) => l.bar ? `b:${l.i??0}` : `t:${l.t}:${l.s}`;
function itemAt(l){ return l.bar ? R.st.bar[l.i] : R.st.trays[l.t][0][l.s]; }
function locEl(l){ const L=typeof l==='string'?parseLoc(l):l; return L.bar ? $('.rs-barwrap') : $(`.rs-slot[data-loc="t:${L.t}:${L.s}"]`); }

/* ===================== LEVEL FLOW ===================== */
function startLevel(n){
  closeModal(); clearHint(); $('.rs-fx').innerHTML='';
  const lv=buildLevel(n); R.level=n; R.params=lv.params; R.chars=lv.chars;
  R.st=fromCompact(lv); R.sel=null; R.hist=[]; R.moves=0; R.served=0; R.sets=lv.params.sets; R.cleared={}; R.busy=false; R.hintShown=false; R.softStuck=false;
  R.bonusOn = n>=RS_BONUS_MIN_LEVEL; R.chain=0; R.bonus=0; R.rowPaid=new Set(); R.maxShown=false;
  R.orders=[null,null,null]; for(let i=0;i<3;i++) R.orders[i]=pickOrder();
  R.P.cur=n; storeSortSave(R.P);
  for(const c of R.chars){ const im=new Image(); im.src=R.art(SORT_CHARS[c].id); }
  $('.rs-lvlnum').textContent = lv.params.bonus ? `BONUS ${n-LEVEL_COUNT}` : `LEVEL ${n}`;
  layoutBoard(); render(false); layoutBoard(); refreshCoins(); // 2nd pass measures the board once the orders + bar are filled in
  if(n===1) later(()=>{ toast('Make 3 of the same friend on a tray! 🐚'); showHint(true); }, 900);
  bumpIdle();
}
function pickOrder(){ const m=charsLeft(); const vis=visibleChars(); const cand=Object.keys(m).map(Number).filter(c=>m[c]>=3 && !R.orders.includes(c));
  if(!cand.length) return null; const pref=cand.filter(c=>vis.has(c)); const pool=pref.length?pref:cand; return pool[Math.floor(Math.random()*pool.length)]; }

/* ===================== LAYOUT + RENDER ===================== */
function layoutBoard(){
  const board=$('.rs-board'); const hud=$('.rs-hud'); const W=R.root.clientWidth, H=R.root.clientHeight;
  hud.classList.toggle('wide', W>=760);
  // Wide screens (desktop / iPad landscape): spread the extra trays out to the sides so every tray fits with no scrolling.
  const wide = W>=900 && W>=H*1.15; board.classList.toggle('wide', wide);
  const land = W>H; // phone landscape: when it can't fit, still use more columns so there is less to scroll
  const bw = wide ? W-24 : Math.min(W-16, 1100), bh=board.clientHeight||(H*.6); const T=R.st.trays.length;
  const cs=getComputedStyle(board), pad=(parseFloat(cs.paddingTop)||6)+(parseFloat(cs.paddingBottom)||10);
  const minFit = (wide||land) ? 44 : 50, cap = 92, maxCols = wide ? 8 : 6;
  let best=null;
  for(let cols=2; cols<=maxCols; cols++){ const rows=Math.ceil(T/cols); if(cols>T) break;
    if(wide && cols>2 && Math.ceil(T/rows)<cols) continue; // wide: keep rows even (12 trays -> 6x2 or 4x3, never 5+5+2)
    // tray width = 3s + 2*.08s + 2*.12s + 6(border) = 3.4s+6 ; gaps .2s ; tray height = s + .36s + .14s + 6 ; row gap .22s
    const sW=(bw-6*cols-4)/(cols*3.4+(cols-1)*.2); const sH=(bh-6*rows-pad-2)/(rows*1.5+(rows-1)*.22);
    const s=Math.min(sW, sH, cap); const sScroll=Math.min(sW,92);
    let score;
    if(s>=minFit) score = wide ? s*(1+.04*cols) : s;   // fits: biggest tiles; on wide screens lean sideways (more columns, fewer rows)
    else score = (land && sScroll>=56) ? cols - 100 : (Math.min(sScroll,64) - 100); // else allow scroll with big tiles
    if(!best || score>best.score) best={cols,s:s>=minFit?s:Math.min(sScroll,64),score};
  }
  const s=Math.max(44, Math.floor(best.s)); R.s=s; R.cols=best.cols;
  const grid=$('.rs-grid'); grid.style.setProperty('--s', s+'px'); grid.style.gridTemplateColumns=`repeat(${best.cols}, auto)`;
  const b=Math.max(40, Math.min(62, Math.floor((Math.min(W,560)-60)/5.3))); R.root.style.setProperty('--b', b+'px');
}
function itemHtml(o, loc, extra=''){ const ch=SORT_CHARS[o.c]; return `<div class="rs-item ${extra}" ${loc?`data-loc="${loc}"`:''} data-id="${o.id}" data-c="${ch.id}" style="--cc:${ch.color}"><img src="${R.art(ch.id)}" alt="${ch.name}" draggable="false"></div>`; }
function render(flip=true, cls={}){
  const before = flip ? rects() : null;
  // orders
  $('.rs-orders').innerHTML = R.orders.map((c,i)=> c==null ? `<div class="rs-order empty" data-o="${i}"></div>` : `<div class="rs-order ${R.newOrder===i?'new':''}" data-o="${i}" data-c="${SORT_CHARS[c].id}">${[0,1,2].map(()=>`<div class="oi" style="--cc:${SORT_CHARS[c].color}"><img src="${R.art(SORT_CHARS[c].id)}" alt="" draggable="false"></div>`).join('')}</div>`).join('');
  R.newOrder=null;
  // bar
  const bar=R.st.bar; $('.rs-bar').innerHTML = Array.from({length:BAR_SIZE},(_,i)=>`<div class="rs-bslot" data-loc="b:${i}">${bar[i]?itemHtml(bar[i],`b:${i}`, cls[bar[i].id]||''):''}</div>`).join('');
  $('.rs-barwrap').classList.toggle('full', bar.length>=BAR_SIZE);
  // trays
  $('.rs-grid').innerHTML = R.st.trays.map((tr,t)=>{ const topL=tr[0], peek=tr[1]; const empty=tr.length===1 && topL.every(o=>!o);
    return `<div class="rs-tray ${empty?'empty':''} ${peek?'layered':''}" data-t="${t}">${peek?`<div class="rs-peek">${peek.map(o=>`<div class="rs-slot rs-pslot">${o?itemHtml(o,null,'rs-pk'):''}</div>`).join('')}</div>`:''}<div class="rs-row">${topL.map((o,s)=>`<div class="rs-slot" data-loc="t:${t}:${s}">${o?itemHtml(o,`t:${t}:${s}`, cls[o.id]||''):''}</div>`).join('')}</div>${tr.length>1?`<div class="rs-layers">+${tr.length-1}</div>`:''}</div>`; }).join('');
  if(R.sel){ const el=$(`.rs-item[data-loc="${locStr(R.sel)}"]`); if(el) el.classList.add('sel'); else R.sel=null; }
  if(before) playFlip(before);
  $('.rs-undo').disabled = !R.hist.length;
}
function rects(){ const m=new Map(); for(const el of $$('[data-id]')) m.set(el.dataset.id, el.getBoundingClientRect()); return m; }
function playFlip(before){
  for(const el of $$('[data-id]')){ const a=before.get(el.dataset.id); if(!a) continue; const b=el.getBoundingClientRect(); const dx=a.left-b.left, dy=a.top-b.top; if(Math.abs(dx)<1 && Math.abs(dy)<1) continue; const sc=a.width/(b.width||1);
    el.animate([{ transform:`translate(${dx}px,${dy}px) scale(${sc})`, zIndex:6 },{ transform:'none', zIndex:6 }], { duration: 240, easing:'cubic-bezier(.25,1.2,.5,1)' }); }
}
function refreshCoins(){ const S=R.opts.S; $('.rs-coins').textContent = S ? S.coins : '—'; $('.rs-mute').textContent = SND.muted ? '🔇' : '🔊'; }

/* ===================== INPUT ===================== */
function bindUI(){
  const root=R.root;
  root.addEventListener('pointerdown', onDown);
  R.onMove=onMove; R.onUp=onUp; window.addEventListener('pointermove', onMove, {passive:false}); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); // onUp also handles cancel
  R.onResize=()=>{ if(!R) return; layoutBoard(); render(false); }; window.addEventListener('resize', R.onResize);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ if(R && R.st) layoutBoard(); }); // HUD height can change once Lilita One loads
  R.onKey=(e)=>{ if(!R || !$('.rs-modal').classList.contains('hidden')) return; const k=e.key.toLowerCase(); if(k==='z'||k==='u') undo(); else if(k==='h') onHint(); else if(k==='s') doShuffle(); else if(k==='escape') deselect(); };
  window.addEventListener('keydown', R.onKey);
  $('.rs-back').onclick=()=>{ SND.click(); const ex=R.opts.onExit; if(ex){ closeReefSort(); ex(); } else showMap(); };
  $('.rs-mute').onclick=()=>{ SND.muted=!SND.muted; R.P.muted=SND.muted; storeSortSave(R.P); refreshCoins(); SND.click(); };
  $('.rs-undo').onclick=()=>undo();
  $('.rs-hintb').onclick=()=>onHint();
  $('.rs-shuf').onclick=()=>{ SND.click(); doShuffle(); };
  $('.rs-mapb').onclick=()=>{ SND.click(); showMap(); };
}
function onDown(e){
  SND.ctx(); bumpIdle();
  if(e.target.closest('button') || e.target.closest('.rs-modal')) return;
  const it=e.target.closest('.rs-item[data-loc]');
  R.press={ x:e.clientX, y:e.clientY, target:e.target, item:it, id:e.pointerId, moved:false, dist:0 };
  if(it && !R.busy){ try{ it.setPointerCapture?.(e.pointerId); }catch(_){} }
}
function onMove(e){
  const p=R && R.press; if(!p || e.pointerId!==p.id) return;
  p.dist=Math.max(p.dist, Math.hypot(e.clientX-p.x, e.clientY-p.y));
  if(!p.moved && p.item && !R.busy && p.dist>DRAG_PX){ p.moved=true; startDrag(p.item, e); }
  if(R.drag){ e.preventDefault(); R.drag.g.style.left=e.clientX+'px'; R.drag.g.style.top=e.clientY+'px'; }
}
function onUp(e){
  const p=R && R.press; if(!p || e.pointerId!==p.id) return; R.press=null;
  if(R.drag){ endDrag(e); return; }
  // tap = pick up / place. A browser pan (pointercancel) only counts as a tap if the finger barely moved.
  if(!p.moved && (e.type!=='pointercancel' || p.dist<=DRAG_PX)) handleTapOn(p.target);
}
function startDrag(it, e){
  clearHint(); const r=it.getBoundingClientRect(); const g=it.cloneNode(true); g.className='rs-ghost'; g.removeAttribute('data-id'); g.style.cssText+=`;width:${r.width}px;height:${r.height}px;left:${e.clientX}px;top:${e.clientY}px`; R.root.appendChild(g);
  it.classList.add('dragsrc'); R.drag={ g, from:parseLoc(it.dataset.loc), el:it }; R.sel=null; $$('.rs-item.sel').forEach(x=>x.classList.remove('sel')); SND.pick(); markTargets(R.drag.from);
}
function endDrag(e){
  const d=R.drag; R.drag=null; d.g.style.display='none'; const under=document.elementFromPoint(e.clientX, e.clientY); d.g.remove(); unmarkTargets();
  const to=dropTarget(under, d.from);
  if(to && tryMove(d.from, to)) return;
  d.el.classList.remove('dragsrc'); d.el.classList.add('shake'); setTimeout(()=>d.el.classList.remove('shake'),320); if(to!==undefined) SND.nope();
}
function dropTarget(under, from){
  if(!under) return null;
  const slot=under.closest('.rs-slot[data-loc^="t:"]');
  const tray=under.closest('.rs-tray');
  if(tray){ const t=+tray.dataset.t; const L=R.st.trays[t][0]; if(slot){ const s=+slot.dataset.loc.split(':')[2]; if(!L[s]) return {t,s}; } const s=L.findIndex(o=>!o); return s>=0 ? {t,s} : null; }
  if(under.closest('.rs-barwrap')) return from.bar ? undefined : { bar:true };
  return undefined;
}
function markTargets(from){ R.st.trays.forEach((tr,t)=>{ if(tr[0].some(o=>!o) && !(from && !from.bar && from.t===t)) $(`.rs-tray[data-t="${t}"]`)?.classList.add('can'); }); if(from && !from.bar && R.st.bar.length<BAR_SIZE) $('.rs-barwrap').classList.add('can'); }
function unmarkTargets(){ $$('.can').forEach(x=>x.classList.remove('can')); }
function select(l){ R.sel=l; $$('.rs-item.sel').forEach(x=>x.classList.remove('sel')); const el=$(`.rs-item[data-loc="${locStr(l)}"]`); if(el){ el.classList.add('sel'); SND.pick(); } unmarkTargets(); markTargets(l); }
function deselect(){ R.sel=null; $$('.rs-item.sel').forEach(x=>x.classList.remove('sel')); unmarkTargets(); }
function handleTapOn(target){
  if(!target || R.busy) return false;
  const it=target.closest?.('.rs-item[data-loc]'); const tray=target.closest?.('.rs-tray'); const inBar=target.closest?.('.rs-barwrap');
  if(R.sel){
    if(it && it.dataset.loc===locStr(R.sel)){ deselect(); return false; }
    if(it){ select(parseLoc(it.dataset.loc)); return false; } // tapping another friend switches what you're holding
    if(tray){ const to=dropTarget(target, R.sel); if(to) return tryMove(R.sel, to); $(`.rs-tray[data-t="${tray.dataset.t}"]`)?.classList.add('shake'); SND.nope(); later(()=>$$('.rs-tray.shake').forEach(x=>x.classList.remove('shake')),320); return false; }
    if(inBar){ if(R.sel.bar){ deselect(); return false; } return tryMove(R.sel, {bar:true}); }
    deselect(); return false;
  }
  if(it){ clearHint(); select(parseLoc(it.dataset.loc)); }
  return false;
}

/* ===================== MOVES ===================== */
function tryMove(from, to){
  if(!R || R.busy || !from || !to) return false;
  const o=itemAt(from); if(!o) return false;
  if(to.bar){ if(from.bar || R.st.bar.length>=BAR_SIZE){ SND.nope(); toast('The holding bar is full!'); return false; } }
  else { if(R.st.trays[to.t][0][to.s]) return false; if(!from.bar && from.t===to.t){ /* just slide within a tray */ } }
  clearHint(); deselect();
  R.hist.push({ st:cloneSt(R.st), orders:R.orders.slice(), served:R.served, moves:R.moves, cleared:{...R.cleared} }); if(R.hist.length>60) R.hist.shift();
  const before=rects();
  if(from.bar) R.st.bar.splice(from.i,1); else R.st.trays[from.t][0][from.s]=null;
  if(to.bar) R.st.bar.push(o); else R.st.trays[to.t][0][to.s]=o;
  R.moves++; R.busy=true;
  render(false, { [o.id]:'land' }); playFlip(before); SND.place();
  // what clears?
  let clearSet=null;
  if(to.bar){ const same=R.st.bar.filter(x=>x.c===o.c); if(same.length===3) clearSet={ where:'bar', ids:same.map(x=>x.id), c:o.c }; }
  else { const L=R.st.trays[to.t][0]; if(L.every(x=>x && x.c===o.c)) clearSet={ where:to.t, ids:L.map(x=>x.id), c:o.c }; }
  const srcT = from.bar ? null : from.t;
  // skill chain: a move is "wasted" unless it lands next to the same friend (or clears) — wasted breaks the combo
  if(!clearSet){ const dest = to.bar ? R.st.bar : R.st.trays[to.t][0]; if(dest.filter(x=>x && x.c===o.c).length<2) R.chain=0; }
  if(clearSet) later(()=>doClear(clearSet, srcT), 230);
  else later(()=>{ settleAndRender([srcT]); finishMove(); }, srcT!=null && needsSettle(srcT) ? 160 : 0);
  return true;
}
function needsSettle(t){ const tr=R.st.trays[t]; return tr.length>1 && tr[0].every(o=>!o); }
function settleAndRender(ts){ const risen={}; let any=false; for(const t of new Set(ts.filter(x=>x!=null))){ const tr=R.st.trays[t]; while(tr.length>1 && tr[0].every(o=>!o)){ tr.shift(); any=true; tr[0].forEach(o=>o&&(risen[o.id]='rise')); } } if(any){ const b=rects(); render(false, risen); playFlip(b); SND.reveal(); } return any; }
function doClear(cs, srcT){
  const els=cs.ids.map(id=>$(`.rs-item[data-id="${id}"]`)).filter(Boolean);
  const pts=els.map(el=>{ const r=el.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; });
  els.forEach(el=>el.classList.add('pop')); SND.pop(); later(()=>SND.chime(), 90);
  pts.forEach(([x,y],i)=>sparkle(x,y, SORT_CHARS[cs.c].color, i));
  R.cleared[cs.c]=(R.cleared[cs.c]||0)+1;
  const oi=R.orders.indexOf(cs.c);
  if(oi>=0){ R.served++; const card=$(`.rs-order[data-o="${oi}"]`); card?.classList.add('done'); const [x,y]=pts[1]||pts[0]; floatText(x,y,'ORDER! ✓'); }
  else if(pts[1]) floatText(pts[1][0], pts[1][1], 'NICE!');
  cheer(cs.c);
  R.chain++; if(R.chain>=2){ const [x,y]=pts[2]||pts[0]; later(()=>skillBonus(R.chain>=3?RS_COMBO3:RS_COMBO2, `COMBO x${R.chain}!`, x, y-40), 250); }
  later(()=>{
    if(cs.where==='bar') R.st.bar=R.st.bar.filter(x=>!cs.ids.includes(x.id)); else R.st.trays[cs.where][0]=[null,null,null];
    if(oi>=0){ R.orders[oi]=null; R.orders[oi]=pickOrder(); R.newOrder=oi; }
    // refill any empty order slots (e.g. a friend became available again)
    for(let i=0;i<3;i++) if(R.orders[i]==null){ R.orders[i]=pickOrder(); }
    const b=rects(); render(false); playFlip(b);
    settleAndRender([cs.where==='bar'?null:cs.where, srcT]);
    checkRows();
    finishMove();
  }, 400);
}
function finishMove(){
  R.busy=false; bumpIdle();
  if(left()===0){ R.busy=true; later(levelComplete, 650); return; }
  // stuck checks — never a fail state, always a free way out
  const anyTraySpace=R.st.trays.some(tr=>tr[0].some(o=>!o));
  if(!anyTraySpace && R.st.bar.length>=BAR_SIZE){ later(()=>showModal(`<h2>CROWDED REEF!</h2><p>No room left to move. Let's give the reef a magic shuffle — it's free! 🌀</p>`, [['SHUFFLE!','pink',()=>{ closeModal(); doShuffle(); }],['UNDO','blue',()=>{ closeModal(); undo(); }]]), 300); return; }
  const snap=R.moves; later(()=>{ if(!R || R.moves!==snap || R.busy) return; const ok=solve(toCompact(), { nodeCap:6000 }).ok; R.softStuck=!ok; $('.rs-hintb').classList.toggle('need', !ok); if(!ok) toast('Tricky! Tap 💡 HINT for help'); }, 150);
}
function undo(){
  if(!R || R.busy || !R.hist.length) return; const h=R.hist.pop(); clearHint(); deselect(); SND.whoosh(); R.chain=0;
  const b=rects(); R.st=h.st; R.orders=h.orders; R.served=h.served; R.moves=h.moves; R.cleared=h.cleared; render(false); playFlip(b); $('.rs-hintb').classList.remove('need'); bumpIdle();
}

/* ===================== HINT / SHUFFLE (the kind "no fail state" helpers) ===================== */
function onHint(){ if(!R || R.busy) return; SND.click(); R.chain=0; showHint(false); }
function showHint(quiet){
  clearHint(); const res=solve(toCompact(), { nodeCap:20000 });
  if(!res.ok || !res.moves.length){ if(quiet) return; showModal(`<h2>HMM, TRICKY!</h2><p>This reef got tangled. Let's shuffle it so it works out — it's free! 🌀</p>`, [['SHUFFLE!','pink',()=>{ closeModal(); doShuffle(); }],['UNDO','blue',()=>{ closeModal(); undo(); }]]); return; }
  const { from, to } = planToLocs(res.moves[0]);
  R.hint={ from, to };
  const se=$(`.rs-item[data-loc="${locStr(from)}"]`); const de= to.bar ? $('.rs-barwrap') : $(`.rs-slot[data-loc="t:${to.t}:${to.s}"]`);
  if(!se || !de) return; se.classList.add('rs-hint-src'); de.classList.add('rs-hint-dst'); if(!quiet) SND.hint();
  se.scrollIntoView?.({ block:'nearest', behavior:'smooth' });
  const a=se.getBoundingClientRect(), b=de.getBoundingClientRect(); const h=document.createElement('div'); h.className='rs-hand'; h.textContent='👆';
  h.style.left='0px'; h.style.top='0px'; h.style.setProperty('--x0',(a.left+a.width*.35)+'px'); h.style.setProperty('--y0',(a.top+a.height*.45)+'px'); h.style.setProperty('--x1',(b.left+b.width*.35)+'px'); h.style.setProperty('--y1',(b.top+b.height*.45)+'px'); R.root.appendChild(h);
  R.hintShown=true;
}
function planToLocs(m){ return { from: m.from.bar ? { bar:true, i:R.st.bar.findIndex(o=>o.c===m.c) } : { t:m.from.t, s:R.st.trays[m.from.t][0].findIndex(o=>o && o.c===m.c) },
  to: m.to.bar ? { bar:true } : { t:m.to.t, s:R.st.trays[m.to.t][0].findIndex(o=>!o) } }; }
function nextMoveLocs(){ const r=solve(toCompact(), { nodeCap:20000 }); if(!r.ok || !r.moves.length) return null; const { from, to }=planToLocs(r.moves[0]); return { from:locStr(from), to: to.bar ? 'b' : locStr(to) }; }
function clearHint(){ if(!R) return; R.hint=null; R.root.querySelectorAll('.rs-hint-src,.rs-hint-dst').forEach(x=>x.classList.remove('rs-hint-src','rs-hint-dst')); R.root.querySelectorAll('.rs-hand').forEach(x=>x.remove()); }
function doShuffle(){
  if(!R || R.busy) return; clearHint(); deselect();
  const res=reshuffle(toCompact(), R.params.layers);
  // keep each item's identity so the FLIP animation shows friends swimming to new spots
  const pools={}; const put=o=>{ (pools[o.c]=pools[o.c]||[]).push(o); }; R.st.trays.forEach(tr=>tr.forEach(l=>l.forEach(o=>o&&put(o)))); R.st.bar.forEach(put);
  R.hist.push({ st:cloneSt(R.st), orders:R.orders.slice(), served:R.served, moves:R.moves, cleared:{...R.cleared} });
  const b=rects();
  R.st={ trays:res.state.trays.map(tr=>tr.map(l=>l.map(x=>x>=0?pools[x].pop():null))), bar:[] };
  if(res.addedTrays>0) layoutBoard();
  R.chain=0; checkRows(true);
  render(false); playFlip(b); SND.whoosh(); $('.rs-hintb').classList.remove('need');
  toast(res.addedTrays>0 ? `Shuffled! +${res.addedTrays} bonus tray 🎁` : 'Shuffled! 🌀');
}
function bumpIdle(){ if(!R) return; clearTimeout(R.idleT); if(R.level<=3) R.idleT=later(()=>{ if(!R.busy && $('.rs-modal').classList.contains('hidden') && !R.sel) showHint(true); }, 11000); }

/* ===================== FX ===================== */
function sparkle(x,y,color,k=0){ const fx=$('.rs-fx'); for(let i=0;i<11;i++){ const d=document.createElement('div'); d.className='rs-spark'+(i%3===0?' st':''); const a=Math.random()*Math.PI*2, v=40+Math.random()*70; d.style.left=x+'px'; d.style.top=y+'px'; d.style.background= i%2 ? color : ['#ffe25a','#fff','#7dfcff','#ff8fd0'][(i+k)%4]; d.style.setProperty('--dx', Math.cos(a)*v+'px'); d.style.setProperty('--dy', Math.sin(a)*v+'px'); fx.appendChild(d); setTimeout(()=>d.remove(),750); } }
function floatText(x,y,t){ const d=document.createElement('div'); d.className='rs-float'; d.textContent=t; d.style.left=x+'px'; d.style.top=y+'px'; $('.rs-fx').appendChild(d); setTimeout(()=>d.remove(),950); }
function cheer(c){ const ch=SORT_CHARS[c]; $$('.rs-cheer').forEach(x=>x.remove()); const d=document.createElement('div'); d.className='rs-cheer'; d.style.setProperty('--cc', ch.color); d.innerHTML=`<div class="pic"><img src="${R.art(ch.id)}" alt=""></div><b>${CHEERS[Math.floor(Math.random()*CHEERS.length)]}</b>`; $('.rs-fx').appendChild(d); setTimeout(()=>d.remove(),1350); SND.cheer(c); }
function confetti(){ const fx=$('.rs-fx'); for(let i=0;i<70;i++){ const d=document.createElement('div'); d.className='rs-conf'; d.style.left=Math.random()*100+'%'; d.style.background=['#ffd52e','#ff4f6d','#2bc0ff','#5be04a','#fff','#ff8fd0'][i%6]; d.style.setProperty('--dx',(Math.random()*160-80)+'px'); d.style.setProperty('--r',(Math.random()*900)+'deg'); d.style.animationDuration=(1.6+Math.random()*1.6)+'s'; d.style.animationDelay=(Math.random()*.5)+'s'; fx.appendChild(d); setTimeout(()=>d.remove(),4000); } }
let toastT; function toast(msg){ const t=$('.rs-toast'); t.innerHTML=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>R && t.classList.remove('on'),1900); }
function showModal(html, buttons=[]){ const m=$('.rs-modal'); m.classList.remove('hidden'); const c=$('.rs-card'); c.innerHTML=html+(buttons.length?`<div class="row">${buttons.map((b,i)=>`<button class="rs-btn ${b[1]}" data-b="${i}">${b[0]}</button>`).join('')}</div>`:''); c.style.animation='none'; void c.offsetWidth; c.style.animation=''; $$('[data-b]', c).forEach(el=>el.onclick=()=>{ SND.click(); buttons[+el.dataset.b][2](); }); }
function closeModal(){ R && $('.rs-modal').classList.add('hidden'); }

/* ===================== SKILL BONUS (levels 7+) ===================== */
/** Earn a skill bonus during play. Held on the level and paid at level clear (see payStarfish). */
function skillBonus(amount, label, x, y){
  if(!R || !R.bonusOn) return;
  const room=RS_BONUS_LEVEL_CAP - R.bonus; // per-level cap only (economy v2)
  if(room<=0) return;
  const amt=Math.min(amount, room); R.bonus+=amt; bonusPop(x, y, `${label} +${amt}`); SND.chime();
}
function bonusPop(x, y, text, muted=false){ const d=document.createElement('div'); d.className='rs-float rs-bonuspop'+(muted?' max':''); d.innerHTML=`${muted?'':'<span class="rs-star"></span>'}${text}`; d.style.left=Math.max(90, Math.min(R.root.clientWidth-90, x))+'px'; d.style.top=Math.max(60, y)+'px'; $('.rs-fx').appendChild(d); setTimeout(()=>d.remove(),1500); }
/** A whole visual row of trays emptied (with friends still left elsewhere) → +RS_ROW_CLEAR once per row.
 *  quiet=true just marks already-empty rows (after a shuffle) without paying. */
function checkRows(quiet=false){
  if(!R || !R.bonusOn) return; const T=R.st.trays.length, cols=R.cols||3; const isEmpty=t=>{ const tr=R.st.trays[t]; return tr.length===1 && tr[0].every(o=>!o); };
  for(let r0=0; r0<T; r0+=cols){ const row=[...Array(Math.min(cols, T-r0)).keys()].map(i=>r0+i); if(row.length<2 || !row.every(isEmpty) || row.every(t=>R.rowPaid.has(t))) continue;
    row.forEach(t=>R.rowPaid.add(t)); if(quiet || left()===0) continue;
    const el=$(`.rs-tray[data-t="${row[Math.floor(row.length/2)]}"]`); const b=el? el.getBoundingClientRect() : { left:R.root.clientWidth/2, width:0, top:R.root.clientHeight/2, height:0 };
    skillBonus(RS_ROW_CLEAR, 'ROW CLEAR!', b.left+b.width/2, b.top+b.height/2); }
}

/* ===================== WIN + REWARD ===================== */
function payStarfish(firstClear){
  const { ECO, S, save } = R.opts; if(!ECO || !S) return null;
  ECO.ensureDay(S);
  const r = ECO.reefEarn ? ECO.reefEarn(firstClear, R.bonus||0) // economy v2: 30 first clear / 15 replay + skill (max +6/level)
    : { base:firstClear ? REEF_SORT_FIRST_CLEAR : REEF_SORT_REPLAY, skill:Math.min(RS_BONUS_LEVEL_CAP, R.bonus||0) };
  S.coins+=r.base+r.skill;
  const win = R.opts.onWin ? R.opts.onWin() : null; // shared "every 5 wins = a Play chest" counter (host saves the chest)
  if(save) save();
  return { earned:r.base, base:r.base, bonus:r.skill, win };
}
function levelComplete(){
  const n=R.level; const ratio=R.sets? R.served/R.sets : 1; const stars= ratio>=.7 ? 3 : ratio>=.4 ? 2 : 1;
  const P=R.P; const firstClear = n<=LEVEL_COUNT && !P.stars[n];
  P.clears=(P.clears||0)+1;
  const pay=payStarfish(firstClear);
  P.stars[n]=Math.max(P.stars[n]||0, stars); P.bestMoves[n]=Math.min(P.bestMoves[n]||Infinity, R.moves); P.unlocked=Math.max(P.unlocked, n+1); P.cur=n+1; storeSortSave(P);
  refreshCoins(); SND.win(); confetti(); later(()=>SND.cheer(7), 700);
  const hero = Object.entries(R.cleared).sort((a,b)=>b[1]-a[1])[0]; const hc=SORT_CHARS[hero? +hero[0] : R.chars[0]];
  const last = n===LEVEL_COUNT;
  const w = pay && pay.win; const left = w ? w.need - w.wins : 0;
  const payHtml = pay ? `<div class="rs-coinsum"><span class="rs-star"></span>+${pay.earned}</div>`
    + (pay.bonus>0 ? `<div class="rs-coinsum rs-skill"><span class="rs-star"></span>Skill bonus +${pay.bonus}</div>` : '')
    + (w ? (w.chest ? `<p class="rs-winchest got">🎉 5 wins! A bonus chest is waiting in the lobby! 🎁</p>` : `<p class="rs-winchest">🎁 Bonus chest in ${left} more ${left===1?'win':'wins'}</p>`) : '') : '';
  showModal(`<h2>${last?'REEF MASTER!':'LEVEL CLEAR!'}</h2><div class="rs-stars">${[1,2,3].map(i=>`<i class="${i<=stars?'on':''}" style="animation-delay:${.2+i*.18}s">★</i>`).join('')}</div>
    <div class="rs-hero" style="--cc:${hc.color}"><img src="${R.art(hc.id)}" alt="${hc.name}"></div>
    <p>${hc.name} says <b>THANK YOU!</b> 🎉</p><p>Orders served: ${R.served} / ${R.sets} · Moves: ${R.moves}</p>${payHtml}${last?'<p>You beat all 12 levels! Bonus reefs unlocked 🌊</p>':''}`,
    [[last?'BONUS!':'NEXT ▶','green',()=>startLevel(n+1)],['REPLAY','blue',()=>startLevel(n)],['LEVELS','gray',()=>showMap()]]);
  R.busy=false;
}
function showMap(){
  const P=R.P; const max=Math.max(LEVEL_COUNT, Math.min(P.unlocked, LEVEL_COUNT+1));
  const cells=Array.from({length:LEVEL_COUNT},(_,i)=>{ const n=i+1; const lock=n>P.unlocked; const st=P.stars[n]||0; return `<button class="${lock?'lock':''} ${n===R.level?'cur':''}" data-lv="${n}" ${lock?'disabled':''}>${lock?'🔒':n}<small>${lock?'':'★'.repeat(st)+'☆'.repeat(3-st)}</small></button>`; }).join('');
  const bonus = P.unlocked>LEVEL_COUNT ? `<div class="row"><button class="rs-btn pink" data-lv="${LEVEL_COUNT+1}">🌊 BONUS REEF</button></div>` : '';
  showModal(`<h2>REEF SORT</h2><p>Pick a level!</p><div class="rs-map">${cells}</div>${bonus}`, R.opts.onExit ? [['PLAY','green',()=>{ closeModal(); }],['EXIT','blue',()=>{ const ex=R.opts.onExit; closeReefSort(); ex(); }]] : [['PLAY','green',()=>{ closeModal(); }]]);
  $$('[data-lv]', $('.rs-card')).forEach(b=>b.onclick=()=>{ SND.click(); startLevel(+b.dataset.lv); });
}
