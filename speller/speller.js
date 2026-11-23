/* Ocean Speller — ZKIDZ mini game. Restyled from Zamer's "Zkidz Ocean Speller" prototype.
 * Pop the floating letter bubbles in order to spell ocean words before the 60s timer runs out.
 * The word's character is the real 3D model (buildOllie + Zharacters' animateChar: wave / happy) standing on the
 * lobby pedestal in the lobby scene, drawn by the game's own renderer (no second WebGL context, no new assets).
 *   import { openSpeller } from './speller/speller.js';
 *   openSpeller({ ECO, S, save, artUrl, chars, kit, sfxOn, onWin, onExit, lb });
 * Own save key: zkidz_speller_v1. Leaderboard mode: 'speller' (score). */
import { V, INK, FONT, clamp, rand, pick, firstName, injectCss, loadSave, writeSave, makeSfx, creditStarfish, payHtml, chestHtml, showModal, hideModal, toast, confetti, topBar, charMap } from '../mini/mini.js?v=20261124-2';
import { WORDS, MAX_LEVEL, levelConfig, poolIsSafe, fillerLetters, blockedIn } from './words.js?v=20261124-2';

/* ================= ECONOMY — APPROVED by Zander (Zokenomics' Ocean Speller numbers) ================= */
export const SP_ROUND_BASE     = 6;    // every finished 60s round
export const SP_PER_WORD       = 3;    // + per word spelled
export const SP_ROUND_CAP      = 30;   // base + words never pays more than this per round
export const SP_NEW_BEST_BONUS = 8;    // new personal-best score (on top of the round cap)
export const SP_WIN_MIN_WORDS  = 2;    // round counts toward the 5-win Play chest only with >= 2 words
export const SP_ROUND_SECONDS  = 60;
/* Paid through ECO.ensureDay + ECO.cardsEarn (no daily caps). No Treasure chests, no Legendary/Cosmic pity. Hints are free. */
export function spPayout(words, newBest){
  const raw=SP_ROUND_BASE + SP_PER_WORD*words, round=Math.min(SP_ROUND_CAP, raw);
  const best=newBest? SP_NEW_BEST_BONUS : 0;
  return { base:SP_ROUND_BASE, perWord:round-SP_ROUND_BASE, capped:raw>SP_ROUND_CAP, best, total:round+best };
}
export function spScore(words, letters){ return words*10 + letters; }   // leaderboard ranks this score only

const SAVE_KEY='zkidz_speller_v1';
const DEFAULTS={ v:1, level:1, best:0, bestWords:0, rounds:0, words:0 };
const PASTEL=['#7fd6ff','#ff9ad8','#8cf26a','#ffe25a','#b9a6ff','#ffb27a','#6ff0d8'];
let H=null;

/* ================= public API ================= */
export function openSpeller(opts={}){
  if(H) closeSpeller();
  if(!opts.noCss){ injectCss('zkMiniCss','../mini/mini.css', import.meta.url); injectCss('oceanSpellerCss','./speller.css', import.meta.url); }
  const root=document.createElement('div'); root.id='oceanSpeller'; root.className='zmini';
  root.innerHTML=`<canvas class="zm-cv sp-cv"></canvas>
    ${topBar({ badge:'LEVEL', badgeVal:'1', extra:`<div class="zm-pill sp-time hidden">⏰ <b>60</b></div><div class="zm-pill sp-score hidden">⭐ <b>0</b></div>` })}
    <div class="sp-word hidden"><div class="sp-who"></div><div class="sp-slots"></div></div>
    <button class="zm-btn yellow sp-hint hidden">💡 HINT</button>
    <div class="zm-menu sp-menu hidden"></div>
    <div class="zm-modal hidden"></div><div class="zm-toast"></div>`;
  document.body.appendChild(root);
  const cmap=charMap(opts);
  H={ opts, root, P:loadSave(SAVE_KEY, DEFAULTS), cmap, sfx:null, muted:false, screen:'menu', raf:0, last:performance.now(), t:0,
      cv:root.querySelector('.sp-cv'), cx:null, vw:800, vh:600, dpr:1, bubbles:[], fx:[], word:null, idx:0, timeLeft:SP_ROUND_SECONDS,
      words:0, letters:0, idle:0, char:null, charId:null, cam:null, models:{}, cfg:levelConfig(1), running:false, hintT:0, lastWords:[] };
  H.cx=H.cv.getContext('2d');
  H.sfx=makeSfx(()=>!H.muted && (typeof opts.sfxOn==='function' ? opts.sfxOn() : !(opts.S && opts.S.music===false)));
  root.addEventListener('pointerdown', ()=>H&&H.sfx.unlock(), {passive:true, capture:true});
  root.querySelector('.zm-back').onclick=()=>{ H.sfx.click(); if(H.screen==='play') toMenu(); else exitToLobby(); };
  root.querySelector('.zm-snd').onclick=e=>{ H.muted=!H.muted; e.currentTarget.textContent=H.muted?'🔇':'🔊'; if(!H.muted){ H.sfx.unlock(); H.sfx.click(); } };
  root.querySelector('.sp-hint').onclick=()=>{ H.sfx.unlock(); hint(true); };
  H.cv.addEventListener('pointerdown', onTap);
  H._key=e=>onKey(e); addEventListener('keydown', H._key);
  H._rs=()=>fit(); addEventListener('resize', H._rs); if(window.visualViewport) visualViewport.addEventListener('resize', H._rs);
  setup3D(); fit(); refreshCoins();
  try{ document.fonts && document.fonts.load(`20px 'Lilita One'`); }catch(e){}
  toMenu();
  H.raf=requestAnimationFrame(loop);
  window.__oceanSpeller={ _owned:true, get H(){ return H; }, startRound, tapNext, finishNow:()=>{ if(H&&H.running) H.timeLeft=0.01; }, spPayout, blockedIn, poolIsSafe,
    consts:{ SP_ROUND_BASE, SP_PER_WORD, SP_ROUND_CAP, SP_NEW_BEST_BONUS, SP_WIN_MIN_WORDS, SP_ROUND_SECONDS } };
  return { close:closeSpeller };
}
export function closeSpeller(){
  if(!H) return;
  cancelAnimationFrame(H.raf); removeEventListener('keydown', H._key); removeEventListener('resize', H._rs); if(window.visualViewport) visualViewport.removeEventListener('resize', H._rs);
  teardown3D();
  if(H.root.parentNode) H.root.parentNode.removeChild(H.root);
  if(window.__oceanSpeller && window.__oceanSpeller._owned) window.__oceanSpeller=null;
  H=null;
}
function exitToLobby(){ const cb=H&&H.opts.onExit; closeSpeller(); if(typeof cb==='function') cb(); }
const $=s=>H.root.querySelector(s);
function refreshCoins(){ const S=H.opts.S; H.root.querySelectorAll('.zm-coins').forEach(e=>e.textContent=(S?S.coins:0).toLocaleString()); }

/* ================= 3D character (game renderer + lobby scene, passed in as opts.kit) ================= */
function setup3D(){
  const k=H.opts.kit; if(!k||!k.THREE||!k.renderer||!k.scene) return;
  H.cam=new k.THREE.PerspectiveCamera(50, 1, .1, 160);
  if(k.hideLobbyChar) try{ k.hideLobbyChar(true); }catch(e){}
}
function teardown3D(){
  const k=H.opts.kit; if(!k||!k.scene) return;
  for(const id in H.models){ const o=H.models[id]; k.scene.remove(o); try{ k.disposeChar && k.disposeChar(o); }catch(e){} }
  H.models={}; H.char=null;
  if(k.hideLobbyChar) try{ k.hideLobbyChar(false); }catch(e){}
}
function showChar(id, anim='wave'){
  const k=H.opts.kit; if(!k||!k.buildChar) return;
  if(H.char && H.charId===id){ try{ k.triggerAnim(H.char, anim); }catch(e){} return; }
  if(H.char) H.char.visible=false;
  let o=H.models[id];
  if(!o){ try{ o=k.buildChar(id); }catch(e){ o=null; } if(!o) return; o.scale.setScalar(1.6); o.position.set(0,.52,0); k.scene.add(o); H.models[id]=o; }
  o.visible=true; o.rotation.y=0; H.char=o; H.charId=id;
  try{ k.triggerAnim(o, anim); }catch(e){}
}
function frameCam(){
  const k=H.opts.kit; if(!H.cam||!k) return; const w=H.vw, h=H.vh, port=h>w, c=H.cam;
  const el=k.renderer.domElement; const W=el.clientWidth||w, Hh=el.clientHeight||h;
  c.aspect=W/Hh; c.fov=port?58:46;
  if(port){ c.position.set(0, 2.9, 11.6); c.lookAt(0, 1.75, 0); }
  else { c.position.set(0, 2.5, 9.4); c.lookAt(0, 1.5, 0); }
  // put the character in its own corner of the screen: left third (landscape) / upper part (portrait)
  const tx = port ? W*.5 : W*.19, ty = port ? Hh*.24 : Hh*.56;
  c.setViewOffset(W, Hh, W*.5-tx, Hh*.5-ty, W, Hh); c.updateProjectionMatrix();
}

/* ================= layout ================= */
function fit(){
  if(!H) return; const vw=innerWidth, vh=(window.visualViewport?visualViewport.height:innerHeight)||innerHeight;
  H.vw=vw; H.vh=vh; H.dpr=Math.min(2, window.devicePixelRatio||1);
  H.cv.width=Math.round(vw*H.dpr); H.cv.height=Math.round(vh*H.dpr);
  const port=vh>vw, top=Math.max(64, (port?0:0)+ (vh<=500?56:66));
  H.r=clamp(Math.min(vw,vh)*(port?.075:.072), 27, 50);
  const slotsH = clamp(H.r*1.5, 44, 74) + 26;
  if(port){ const sy=vh*.42; H.slotBox={ x:8, y:sy, w:vw-16 }; H.area={ x0:6, x1:vw-6, y0:sy+slotsH+6, y1:vh-6 }; }
  else { const x0=vw*.37; H.slotBox={ x:x0, y:top+2, w:vw-x0-12 }; H.area={ x0, x1:vw-8, y0:top+slotsH+8, y1:vh-6 }; }
  const W=$('.sp-word'); W.style.left=H.slotBox.x+'px'; W.style.top=H.slotBox.y+'px'; W.style.width=H.slotBox.w+'px';
  W.style.setProperty('--slot', clamp(H.r*1.35, 40, 68)+'px');
  const hb=$('.sp-hint'); if(port){ hb.style.left=''; hb.style.right='10px'; hb.style.top=Math.max(70, vh*.42-60)+'px'; hb.style.bottom='auto'; } else { hb.style.right=''; hb.style.left='12px'; hb.style.top=''; hb.style.bottom=''; }
  frameCam();
  if(H.bubbles.length) layoutBubbles(true);
}

/* ================= menu ================= */
function toMenu(){
  H.screen='menu'; H.running=false; H.bubbles=[]; H.fx=[]; hideModal(H.root);
  ['.sp-word','.sp-hint','.sp-time','.sp-score'].forEach(s=>$(s).classList.add('hidden'));
  const P=H.P, cfg=levelConfig(P.level), S=H.opts.S||{}; const me=H.cmap[S.selChar]||H.cmap.ollie||{id:'ollie',name:'Ollie'};
  $('.zm-bk').textContent='LEVEL'; $('.zm-bv').textContent=P.level;
  const M=$('.sp-menu'); M.classList.remove('hidden');
  M.innerHTML=`<div class="sp-mcard"><div class="zm-title">OCEAN SPELLER</div>
    <p class="zm-sub">Pop the letter bubbles <b>in order</b> to spell your friends' names and ocean words. ${SP_ROUND_SECONDS} seconds — how many can you spell?</p>
    <div class="sp-stats"><div class="zm-pill">🔤 Level <b>${P.level}</b>${P.level<MAX_LEVEL?` <small>· spell ${cfg.goal} to level up</small>`:''}</div><div class="zm-pill">🏆 Best <b>${P.best}</b></div></div>
    <div class="zm-btns"><button class="zm-btn blue sp-lobby">◀ LOBBY</button><button class="zm-btn green big sp-play">PLAY ▶</button></div></div>`;
  M.querySelector('.sp-play').onclick=()=>{ H.sfx.unlock(); H.sfx.click(); startRound(); };
  M.querySelector('.sp-lobby').onclick=()=>{ H.sfx.click(); exitToLobby(); };
  showChar(me.id && WORDS.some(w=>w.c===me.id) ? me.id : 'ollie', 'wave');
}

/* ================= round ================= */
function startRound(){
  if(!H) return; hideModal(H.root);
  H.cfg=levelConfig(H.P.level); H.screen='play'; H.running=true; H.timeLeft=SP_ROUND_SECONDS; H.words=0; H.letters=0; H.lastWords=[]; H.elapsed=0;
  $('.sp-menu').classList.add('hidden'); ['.sp-word','.sp-hint','.sp-time','.sp-score'].forEach(s=>$(s).classList.remove('hidden'));
  $('.zm-bv').textContent=H.P.level; updateHud(); nextWord(); H.sfx.whoosh();
}
function pickWord(){
  const tiers=H.cfg.tiers, t=pick(tiers); let pool=WORDS.filter(w=>w.t===t && !H.lastWords.includes(w.w));
  if(!pool.length) pool=WORDS.filter(w=>!H.lastWords.includes(w.w));
  const w=pick(pool); H.lastWords.push(w.w); if(H.lastWords.length>6) H.lastWords.shift(); return w;
}
function nextWord(){
  H.word=pickWord(); H.idx=0; H.idle=0; H.hintT=0;
  const ch=H.cmap[H.word.c]||{ id:H.word.c, name:H.word.c };
  const ghost=H.cfg.ghost;
  $('.sp-who').innerHTML=`Spell it! <b>${firstName(ch)}</b> <small>${(ch.name||'').split(' the ')[1]?'the '+ch.name.split(' the ')[1]:''}</small>`;
  $('.sp-slots').innerHTML=[...H.word.w].map((L,i)=>`<i class="${ghost==='all'||(ghost==='first'&&i===0)?'gh':''}" data-l="${L}"><span></span></i>`).join('');
  spawnBubbles(); showChar(H.word.c, 'wave');
}
function spawnBubbles(){
  const word=H.word.w; let best=null;
  for(let tries=0; tries<60; tries++){
    const letters=(word+fillerLetters(H.cfg.fillers)).split('');
    for(let i=letters.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [letters[i],letters[j]]=[letters[j],letters[i]]; }
    const bs=letters.map((ch,i)=>({ ch, i, x:0, y:0, col:pick(PASTEL), ph:rand(0,6.3), wob:rand(.8,1.4), popped:false, shake:0, glow:0, sc:0 }));
    best=bs; layoutBubbles(false, bs);
    if(poolIsSafe(bs)) break;   // kid-safe: regenerate if any reading order spells a blocked word
  }
  H.bubbles=best; H.safeTries=(H.safeTries|0);
}
function layoutBubbles(keep, bs=H.bubbles){
  const A=H.area, r=H.r, n=bs.length, w=A.x1-A.x0, ht=A.y1-A.y0;
  const cols=Math.max(3, Math.min(n, Math.floor(w/(r*2+10)))), per=Math.ceil(n/cols), colW=w/cols;
  const order=[...Array(cols).keys()]; for(let i=cols-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
  bs.forEach((b,k)=>{ const c=order[k%cols], lane=Math.floor(k/cols);
    b.cx=A.x0+colW*(c+.5); b.amp=Math.max(0, Math.min(10, colW/2-r-2));
    b.vy=(H.cfg.speed*(.85+((c*37)%10)/30))*clamp(ht/420,.75,1.5);
    if(!keep){ b.y=A.y0+r+((lane/per)+rand(.05,.25))*(ht+2*r); b.x=b.cx; b.sc=0; }
    else { b.x=b.cx; b.y=clamp(b.y, A.y0-r, A.y1+r); } });
  // same speed inside a column keeps lanes from overlapping
  const byCol={}; bs.forEach(b=>{ (byCol[b.cx]=byCol[b.cx]||[]).push(b); }); Object.values(byCol).forEach(l=>{ const v=l[0].vy; l.forEach(b=>b.vy=v); });
}
function expected(){ return H.word ? H.word.w[H.idx] : null; }
function onTap(e){
  if(!H||H.screen!=='play'||!H.running) return; e.preventDefault();
  const rc=H.cv.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top; let hit=null, hd=1e9;
  for(const b of H.bubbles){ if(b.popped) continue; const d=Math.hypot(b.x-x, b.y-y); if(d<H.r*1.15 && d<hd){ hd=d; hit=b; } }
  if(hit) tryPop(hit);
}
function onKey(e){
  if(!H) return;
  if(e.key==='Escape'){ if(H.screen==='play') toMenu(); return; }
  if(H.screen!=='play'||!H.running||e.ctrlKey||e.metaKey||e.altKey) return;
  const k=(e.key||'').toUpperCase(); if(!/^[A-Z]$/.test(k)) return; H.sfx.unlock();
  const want=expected(); const cands=H.bubbles.filter(b=>!b.popped&&b.ch===k&&b.y<H.area.y1+H.r);
  if(!cands.length){ H.sfx.wrong(); return; }
  tryPop(k===want ? cands.sort((a,b)=>a.y-b.y)[0] : cands[0]);
}
function tryPop(b){
  if(b.ch===expected()){
    b.popped=true; burst(b.x, b.y, b.col); H.sfx.pop(H.idx); H.idle=0; H.hintT=0;
    const slot=$('.sp-slots').children[H.idx]; if(slot){ slot.classList.add('on'); slot.querySelector('span').textContent=b.ch; }
    H.idx++; H.letters++;
    if(H.idx>=H.word.w.length) wordDone();
    updateHud();
  } else { b.shake=.45; H.sfx.wrong(); }
}
function wordDone(){
  H.words++; updateHud(); H.sfx.win(); confetti(H.root, 22);
  const k=H.opts.kit; if(H.char&&k) try{ k.triggerAnim(H.char,'happy'); }catch(e){}
  $('.sp-slots').classList.add('done'); toast(H.root, pick(['Great job!','Super speller!','You did it!','Awesome!','Yay!'])+' ⭐');
  H.bubbles.forEach(b=>{ if(!b.popped){ b.popped=true; burst(b.x,b.y,b.col,4); } });
  H.busy=true;
  setTimeout(()=>{ if(!H||H.screen!=='play') return; H.busy=false; $('.sp-slots').classList.remove('done'); if(H.running) nextWord(); }, 1100);
}
function hint(manual){
  const want=expected(); if(!want||!H.running) return;
  const b=H.bubbles.filter(b=>!b.popped&&b.ch===want).sort((a,c)=>Math.abs(a.y-(H.area.y0+H.area.y1)/2)-Math.abs(c.y-(H.area.y0+H.area.y1)/2))[0];
  if(b){ b.glow=2.4; if(manual) H.sfx.ding(H.idx); }
}
function tapNext(){ const want=expected(); const b=H&&H.bubbles.find(b=>!b.popped&&b.ch===want); if(b) tryPop(b); return !!b; }
function updateHud(){ $('.sp-time b').textContent=Math.ceil(Math.max(0,H.timeLeft)); $('.sp-score b').textContent=spScore(H.words,H.letters); $('.sp-time').classList.toggle('low', H.timeLeft<=10); }

/* ================= end of round: pay + results ================= */
function endRound(){
  H.running=false; H.screen='results';
  const P=H.P, words=H.words, score=spScore(words, H.letters), newBest=score>0 && score>(P.best|0);
  const cfg=H.cfg, levelUp = words>=cfg.goal && P.level<MAX_LEVEL;
  P.rounds=(P.rounds|0)+1; P.words=(P.words|0)+words; if(newBest) P.best=score; P.bestWords=Math.max(P.bestWords|0, words); if(levelUp) P.level++;
  writeSave(SAVE_KEY, P);
  const pay=spPayout(words, newBest), countsWin=words>=SP_WIN_MIN_WORDS;
  const { earned, win }=creditStarfish(H.opts, pay.total, countsWin);
  refreshCoins();
  if(typeof H.opts.lb==='function' && P.best>0){ try{ H.opts.lb('speller', P.best|0); }catch(e){} }
  const k=H.opts.kit; if(H.char&&k&&words>0) try{ k.triggerAnim(H.char,'happy'); }catch(e){}
  ['.sp-word','.sp-hint'].forEach(s=>$(s).classList.add('hidden')); H.bubbles.forEach(b=>{ if(!b.popped){ b.popped=true; burst(b.x,b.y,b.col,3); } });
  showModal(H.root, `<div class="zm-card"><div class="zm-ribbon ${words?'':'blue'}">TIME'S UP!</div>
    <p>You spelled</p><div class="zm-big">${words} word${words===1?'':'s'}</div>
    <p>Score <b>${score}</b>${newBest?' · <b style="color:#2fb33a">NEW BEST!</b>':` · Best ${P.best}`}${levelUp?`<br>🎉 <b>LEVEL UP!</b> Speller level ${P.level}`:''}</p>
    ${payHtml([[ 'Round played', pay.base ], [ `${words} word${words===1?'':'s'} × ${SP_PER_WORD}${pay.capped?' (max)':''}`, pay.perWord ], newBest?[ '🏆 New best score', pay.best, 'new' ]:null], earned)}
    ${chestHtml(countsWin, win, `Spell ${SP_WIN_MIN_WORDS}+ words in a round to count toward a chest.`)}
    <div class="zm-btns"><button class="zm-btn blue" data-act="lobby">◀ LOBBY</button><button class="zm-btn pink" data-act="menu">MENU</button><button class="zm-btn green big" data-act="again">PLAY AGAIN ▶</button></div></div>`,
    { lobby:()=>{ H.sfx.click(); exitToLobby(); }, menu:()=>{ H.sfx.click(); toMenu(); }, again:()=>{ H.sfx.click(); startRound(); } });
  if(words>0){ H.sfx.win(); confetti(H.root); } else H.sfx.soft();
  H.lastResult={ words, score, newBest, levelUp, earned, pay, countsWin, win };
}

/* ================= loop + drawing ================= */
function burst(x,y,col,n=9){ for(let i=0;i<n;i++){ const a=i/n*6.283+rand(-.2,.2), s=rand(80,190); H.fx.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:.55, max:.55, r:rand(3,7), col }); } H.fx.push({ ring:true, x, y, life:.35, max:.35, r:H.r, col:'#fff' }); }
function loop(now){
  if(!H) return; H.raf=requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-H.last)/1000); H.last=now; H.t+=dt;
  if(H.running){
    H.timeLeft-=dt; H.elapsed+=dt; H.idle+=dt;
    if(H.idle>7 && H.hintT<=0){ hint(false); H.hintT=5; } H.hintT-=dt;
    if(Math.ceil(H.timeLeft)!==H._lastSec){ H._lastSec=Math.ceil(H.timeLeft); updateHud(); if(H.timeLeft<=5 && H.timeLeft>0) H.sfx.bounce(); }
    if(H.timeLeft<=0){ H.timeLeft=0; updateHud(); endRound(); }
  }
  const A=H.area, r=H.r;
  for(const b of H.bubbles){
    if(b.popped) continue;
    b.sc=Math.min(1, b.sc+dt*3); b.y-=b.vy*dt; b.x=b.cx+Math.sin(H.t*b.wob+b.ph)*b.amp;
    if(b.y < A.y0-r*0.2){ b.y=A.y1+r; b.sc=.4; }          // drift off the top, come back from the sand
    b.shake=Math.max(0,b.shake-dt); b.glow=Math.max(0,b.glow-dt);
  }
  for(const f of H.fx){ f.life-=dt; if(!f.ring){ f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=200*dt; } }
  H.fx=H.fx.filter(f=>f.life>0);
  draw();
  const k=H.opts.kit;
  if(k && k.renderer && H.cam && k.scene){
    try{ if(H.char){ k.animateChar(H.char, 'idle', 0, dt, H.t); k.tickAccessories && k.tickAccessories(H.char, dt, H.t); H.char.rotation.y=Math.sin(H.t*.6)*.15; }
      k.tickScene && k.tickScene(dt, H.t, H.cam); k.renderer.render(k.scene, H.cam); }catch(e){ if(!H._warned){ H._warned=true; console.warn('speller 3d', e); } }
  }
}
function draw(){
  const x=H.cx, d=H.dpr; x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,H.vw,H.vh);
  if(!H.opts.kit){ const g=x.createLinearGradient(0,0,0,H.vh); g.addColorStop(0,'#6fdcff'); g.addColorStop(1,'#0b56a8'); x.fillStyle=g; x.fillRect(0,0,H.vw,H.vh); }
  if(H.screen==='play'||H.screen==='results'){
    const A=H.area; x.save(); x.fillStyle='rgba(10,40,110,.28)'; x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=3;
    x.beginPath(); x.roundRect(A.x0-2, A.y0-6, A.x1-A.x0+4, A.y1-A.y0+8, 22); x.fill(); x.stroke(); x.restore();
    x.save(); x.beginPath(); x.rect(A.x0-2, A.y0-6, A.x1-A.x0+4, A.y1-A.y0+8); x.clip();
    for(const b of H.bubbles) if(!b.popped) drawBubble(x,b);
    x.restore();
  }
  for(const f of H.fx){ const k=f.life/f.max; x.globalAlpha=k;
    if(f.ring){ x.strokeStyle='#fff'; x.lineWidth=4; x.beginPath(); x.arc(f.x,f.y,f.r*(1.6-k*.6),0,7); x.stroke(); }
    else { x.fillStyle=f.col; x.beginPath(); x.arc(f.x,f.y,f.r,0,7); x.fill(); x.strokeStyle=INK; x.lineWidth=2; x.stroke(); } }
  x.globalAlpha=1;
}
function drawBubble(x,b){
  const r=H.r*(.6+.4*b.sc), sx=b.shake? Math.sin(b.shake*60)*6 : 0, px=b.x+sx, py=b.y;
  const sq=1+Math.sin(H.t*3+b.ph)*.04;
  x.save(); x.translate(px,py); x.scale(sq, 2-sq);
  if(b.glow>0){ x.shadowColor='#ffe25a'; x.shadowBlur=28; }
  const g=x.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r); g.addColorStop(0,'rgba(255,255,255,.95)'); g.addColorStop(.45,b.col); g.addColorStop(1,shadeA(b.col));
  x.fillStyle=g; x.beginPath(); x.arc(0,0,r,0,7); x.fill(); x.shadowBlur=0;
  x.lineWidth=Math.max(3,r*.12); x.strokeStyle=b.glow>0?'#ffe25a':INK; x.stroke();
  x.fillStyle='rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(-r*.38,-r*.45,r*.26,r*.14,-.6,0,7); x.fill();
  x.font=`${Math.round(r*1.12)}px ${FONT}`; x.textAlign='center'; x.textBaseline='middle';
  x.lineJoin='round'; x.lineWidth=Math.max(4,r*.2); x.strokeStyle=INK; x.strokeText(b.ch,0,r*.07); x.fillStyle='#fff'; x.fillText(b.ch,0,r*.07);
  x.restore();
}
function shadeA(h){ const n=parseInt(h.slice(1),16); const f=v=>Math.round(v*.62); return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`; }
