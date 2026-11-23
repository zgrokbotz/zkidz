/* ZKIDZ mini-game kit — shared by Bubble Pop (bubble/), Endless Swimmer (swim/) and Ocean Speller (speller/).
 * Synth SFX (WebAudio, no files), save helpers with defaults, the shared Starfish payout path
 * (ECO.ensureDay + ECO.cardsEarn, Play-chest win hook), the results card, and small DOM helpers. No CDNs. */
export const V = '20261123-1';
export const INK = '#16163a';
export const FONT = "'Lilita One','Arial Black','Trebuchet MS',system-ui,sans-serif";
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rand=(a,b)=>a+Math.random()*(b-a);
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export function hex(c){ return typeof c==='number' ? '#'+c.toString(16).padStart(6,'0') : (c||'#4aa3df'); }
export function firstName(c){ return String((c&&c.name)||(c&&c.id)||'Friend').split(' the ')[0]; }
export function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* CSS: the standalone build inlines <style id="zkMiniCss"> / per-game ids, so only inject a <link> when missing. */
export function injectCss(id, rel, base){
  if(document.getElementById(id)) return;
  const l=document.createElement('link'); l.id=id; l.rel='stylesheet'; l.href=new URL(rel+'?v='+V, base).href; document.head.appendChild(l);
}
export function artSrc(opts, id){
  if(opts && typeof opts.artUrl==='function'){ try{ return opts.artUrl(id); }catch(e){} }
  if(window.__ART && window.__ART[id]) return window.__ART[id];
  try{ return new URL(`../art/${id}.jpg`, import.meta.url).href; }catch(e){ return `art/${id}.jpg`; }
}

/* ---------- saves: own key, defaults merged so old / missing / broken saves always load ---------- */
export function loadSave(key, defaults){
  const base=JSON.parse(JSON.stringify(defaults));
  try{
    const o=JSON.parse(localStorage.getItem(key)||'{}');
    if(!o || typeof o!=='object' || Array.isArray(o)) return base;
    for(const k of Object.keys(base)){
      if(!(k in o)) continue; const d=base[k], v=o[k];
      if(d && typeof d==='object' && !Array.isArray(d)) base[k] = (v && typeof v==='object' && !Array.isArray(v)) ? v : d;
      else if(typeof d==='number') base[k] = Number.isFinite(+v) ? +v : d;
      else base[k] = v;
    }
    for(const k of Object.keys(o)) if(!(k in base)) base[k]=o[k];   // keep unknown future fields
  }catch(e){}
  return base;
}
export function writeSave(key, P){ try{ localStorage.setItem(key, JSON.stringify(P)); }catch(e){} }

/* ---------- WebAudio SFX (synth only; follows the game's music toggle + the in-game mute) ---------- */
export function makeSfx(isOn){
  let AC=null, armed=false;
  const on=()=>{ if(!armed || !AC) return false; try{ return isOn ? !!isOn() : true; }catch(e){ return true; } };
  function unlock(){ armed=true; try{ const C=window.AudioContext||window.webkitAudioContext; if(!C) return; if(!AC) AC=new C(); if(AC.state==='suspended') AC.resume(); }catch(e){} }
  function tone(f, d, type='sine', v=.12, delay=0, f2=null){
    if(!on()) return;
    try{ const t=AC.currentTime+delay, o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+d);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+.012); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+d+.02); }catch(e){}
  }
  function noise(d, v=.08, delay=0, freq=900){
    if(!on()) return;
    try{ const t=AC.currentTime+delay, n=Math.max(1,Math.floor(AC.sampleRate*d)), b=AC.createBuffer(1,n,AC.sampleRate), ch=b.getChannelData(0); for(let i=0;i<n;i++) ch[i]=(Math.random()*2-1)*(1-i/n);
      const s=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); s.buffer=b; f.type='bandpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(freq*2.5,t+d); g.gain.value=v; s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); }catch(e){}
  }
  return { unlock, tone, noise,
    click(){ tone(660,.06,'triangle',.08); },
    pop(k=0){ const f=520+Math.min(k,10)*60; tone(f,.09,'sine',.13,0,f*1.9); noise(.06,.05,0,2600); },
    plop(){ tone(240,.12,'sine',.1,0,120); },
    shoot(){ noise(.16,.06,0,700); tone(380,.12,'triangle',.06,0,760); },
    bounce(){ tone(300,.05,'square',.03); },
    star(i=0){ tone(880*Math.pow(1.26,i%4),.18,'triangle',.11); tone(1760*Math.pow(1.26,i%4),.14,'sine',.04,.03); },
    coin(){ tone(1046,.07,'square',.04); tone(1568,.12,'square',.04,.06); },
    bonk(){ tone(160,.25,'sawtooth',.08,0,80); noise(.2,.08,0,400); },
    wrong(){ tone(330,.14,'triangle',.08,0,250); tone(262,.18,'triangle',.06,.1,200); },
    whoosh(){ noise(.35,.07,0,350); tone(220,.3,'sine',.05,0,520); },
    ding(i=0){ const f=[523,587,659,698,784,880,988,1047][i%8]; tone(f,.16,'triangle',.11); },
    win(){ [523,659,784,1047,784,1047].forEach((f,i)=>tone(f,.22,'triangle',.11,i*.11)); },
    soft(){ [392,330,294].forEach((f,i)=>tone(f,.25,'triangle',.07,i*.14)); },
  };
}

/* ---------- Starfish payout: same shared earn path as Reef Sort / Hide & Seek ---------- */
export function creditStarfish(o, total, countsWin){
  let earned=Math.max(0, total|0), win=null;
  if(o && o.ECO && o.S){
    try{ o.ECO.ensureDay && o.ECO.ensureDay(o.S); }catch(e){}
    try{ const e=o.ECO.cardsEarn ? o.ECO.cardsEarn(earned) : { earned }; earned=e.earned|0; }catch(e){}
    o.S.coins=(o.S.coins||0)+earned;
    if(countsWin && typeof o.onWin==='function'){ try{ win=o.onWin(); }catch(e){} }
    try{ o.save && o.save(); }catch(e){}
  }
  return { earned, win };
}
export function payHtml(lines, earned){
  return `<div class="zm-pay">${lines.filter(Boolean).map(([l,v,cls])=>`<div class="${cls||''}"><span>${l}</span><b>${typeof v==='number'?'+'+v:v}</b></div>`).join('')}<div class="tot"><span><span class="zm-coin"></span> Starfish</span><b>+${earned}</b></div></div>`;
}
export function chestHtml(countsWin, win, why){
  if(!countsWin) return `<p class="zm-chest">🎁 ${why}</p>`;
  const need=(win&&win.need)||5, wins=(win&&win.wins)||0;
  if(win && win.chest) return `<p class="zm-chest">🎉 5 wins! A <b>bonus chest</b> is waiting in the lobby! 🎁</p>`;
  return `<p class="zm-chest">🎁 Chest in <b>${wins}/${need}</b> wins <span class="zm-dots">${Array.from({length:need},(_,i)=>`<i class="${i<wins?'on':''}"></i>`).join('')}</span></p>`;
}
export function starsHtml(n){ return `<div class="zm-bigstars">${[0,1,2].map(i=>`<i class="${i<n?'on':''}" style="--d:${.3+i*.3}s">★</i>`).join('')}</div>`; }

/* ---------- DOM bits ---------- */
export function showModal(root, html, actions){
  const M=root.querySelector('.zm-modal'); M.innerHTML=html; M.classList.remove('hidden');
  M.querySelectorAll('[data-act]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); const f=actions&&actions[b.dataset.act]; if(f) f(); });
  return M;
}
export function hideModal(root){ const M=root.querySelector('.zm-modal'); if(M){ M.classList.add('hidden'); M.innerHTML=''; } }
export function toast(root, msg, ms=1800){ const el=root.querySelector('.zm-toast'); if(!el) return; el.textContent=msg; el.classList.add('on'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('on'), ms); }
export function confetti(root, n=36){ const cols=['#ffd52e','#ff4f6d','#2bc0ff','#5be04a','#fff','#ff9ad8']; for(let i=0;i<n;i++){ const d=document.createElement('div'); d.className='zm-conf'; d.style.left=rand(0,100)+'%'; d.style.background=pick(cols); d.style.animationDuration=rand(1.6,3)+'s'; d.style.animationDelay=rand(0,.4)+'s'; root.appendChild(d); setTimeout(()=>d.remove(),3600); } }
export function topBar({ badge='LEVEL', badgeVal='1', badgeCls='', extra='' }){
  return `<div class="zm-top"><button class="zm-btn blue zm-back" aria-label="Back">◀</button><div class="zm-badge ${badgeCls}"><small class="zm-bk">${badge}</small><b class="zm-bv">${badgeVal}</b></div>${extra}<div class="zm-right"><div class="zm-pill"><span class="zm-coin"></span><b class="zm-coins">0</b></div><button class="zm-btn gray zm-snd" aria-label="Sound">🔊</button></div></div>`;
}
/* round character badge from the real art (cached canvas) */
const BADGES={};
export function badge(opts, ch, size=128){
  const key=ch.id+'|'+size; if(BADGES[key]) return BADGES[key];
  const c=document.createElement('canvas'); c.width=c.height=size; const b={ canvas:c, ready:false }; BADGES[key]=b;
  const paint=(img)=>{ const x=c.getContext('2d'), h=size/2, col=hex(ch.color); x.clearRect(0,0,size,size);
    x.beginPath(); x.arc(h,h,h*.97,0,7); x.fillStyle=INK; x.fill();
    x.beginPath(); x.arc(h,h,h*.86,0,7); x.fillStyle=col; x.fill();
    x.save(); x.beginPath(); x.arc(h,h,h*.74,0,7); x.clip(); x.fillStyle='#fff'; x.fillRect(0,0,size,size);
    if(img){ const s=Math.min(img.width,img.height)*.78, sx=(img.width-s)/2, sy=Math.max(0,(img.height-s)*.18); x.drawImage(img, sx, sy, s, s, h*.26, h*.26, size-h*.52, size-h*.52); }
    else { x.fillStyle=col; x.fillRect(0,0,size,size); x.font=`${size*.45}px serif`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(ch.em||'🐠',h,h*1.06); }
    x.restore();
    const g=x.createLinearGradient(0,0,0,size*.6); g.addColorStop(0,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(h*.78,h*.5,h*.42,h*.22,-.5,0,7); x.fill();
    b.ready=!!img; };
  paint(null);
  const img=new Image(); img.decoding='async'; img.onload=()=>paint(img); img.src=artSrc(opts, ch.id);
  return b;
}
/* character list fallback (when opened outside the main game) */
export const FALLBACK = [['ollie','Ollie the Otter',0x7a4a2c,'🦦'],['pip','Pip the Penguin',0x1f2a55,'🐧'],['pinchy','Pinchy the Crab',0xe8452f,'🦀'],['angie','Angie the Angelfish',0xffd23a,'🐠'],['dash','Dash the Dolphin',0x4aa3df,'🐬'],['shelly','Shelly the Sea Turtle',0x4caf50,'🐢'],['bubbles','Bubbles the Axolotl',0xff8fc2,'🦎'],['inky','Inky the Octopus',0x7a3ad8,'🐙'],['finn','Finn the Clownfish',0xff7a1a,'🐠'],['jelly','Jelly the Jellyfish',0xc9a6f2,'🪼']].map(([id,name,color,em])=>({id,name,color,em}));
export function charMap(opts){ const list=(opts&&opts.chars&&opts.chars.length)?opts.chars:FALLBACK; return Object.fromEntries(list.map(c=>[c.id,c])); }
