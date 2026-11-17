// ZKIDZ – Ocean Maze prototype. Three.js, no build step.
import * as THREE from './vendor/three.module.min.js?v=20261116-13';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js?v=20261116-13';
import * as ECO from './economy.js?v=20261116-13';
import { openReefSort } from './sort/reef-sort.js?v=20261116-13';
import { openReefDiner } from './dash/dash.js?v=20261116-13';
import { openHideSeek } from './hide/hide-seek.js?v=20261116-13';
import { buildOllieV2, installOllieV2, setOllieVariant, OLLIE_PROFILES } from './ollie-v2.js?v=20261116-13';
import { animateChar, triggerAnim } from './zkidz-anim.js?v=20261116-13';
import { setupVisionScene, setVisionToneMapping, buildPedestal, addBlobShadow, VISION_ACES, VISION_EXPOSURE } from './zkidz-look.js?v=20261116-13';
import { uTime, uOcc, patch, buildCoralGeos, buildMats, sandMaterial, CORAL_PAL, Instancer, coralHedge, kelp, godRays, specks, farReef, archway, mtx, MATS, CORAL_GEOS } from './gfx.js?v=20261116-13';
import * as LB from './lb.js?v=20261116-13';
import { ITEMS_V2, wrapAddEquipment, installAccessoriesV2, tickAccessories, applyLegacyFraming, outfitMotionPad, HEAVENLY_EQ, LAVA_EQ } from './accessories-v2.js?v=20261116-13';

/* ===================== DATA ===================== */
const RARITIES = [
  { id:'common',    name:'Common',     color:'#b9c2cf', c1:'#c98a4b', c2:'#8a5523', band:'#8b8f99' },
  { id:'uncommon',  name:'Uncommon',   color:'#2ee6d6', c1:'#5ff0ff', c2:'#139bc9', band:'#e8fbff' },
  { id:'rare',      name:'Rare',       color:'#46d14f', c1:'#7bd65a', c2:'#2d7d2a', band:'#8b5a2b' },
  { id:'epic',      name:'Epic',       color:'#ff3fb4', c1:'#ff6ad5', c2:'#8a2be2', band:'#ffe94a' },
  { id:'mythic',    name:'Mythic',     color:'#ff5a1f', c1:'#ff8a3d', c2:'#7a1a0a', band:'#2b2b2b' },
  { id:'ultra',     name:'Ultra Rare', color:'#dfe8f5', c1:'#ffffff', c2:'#8fa3bd', band:'#5a7bd8' },
  { id:'legendary', name:'Legendary',  color:'#ffc933', c1:'#fff3a8', c2:'#e0a100', band:'#ffffff' },
  { id:'cosmic',    name:'Cosmic',     color:'#9b6bff', c1:'#7b5cff', c2:'#1a1450', band:'#5ff6ff' },
];
const RMAP = Object.fromEntries(RARITIES.map((r,i)=>[r.id,{...r,idx:i}]));
const PRICE = ECO.PRICE;            // item prices (characters 2x) — unchanged by economy v1
const CHEST_PRICE = ECO.CHEST_PRICE; // only Common / Uncommon / Rare chests are sold

// slot: hat | eyes | top | bottom | shoes | wrist | hands
const ITEMS = [
  { id:'cap_blue',     name:'Blue Cap',          slot:'hat',   r:'common',   em:'🧢', m:{type:'cap', c:0x2f6fe0} },
  { id:'tee_white',    name:'Comfy Tee',         slot:'top',   r:'common',   em:'👕', m:{type:'tee', c:0xf4f4f4} },
  { id:'sneak_red',    name:'Red Sneakers',      slot:'shoes', r:'common',   em:'👟', m:{type:'shoes', c:0xe8322f} },
  { id:'specs_round',  name:'Round Specs',       slot:'eyes',  r:'common',   em:'👓', m:{type:'specs', c:0x222222} },
  { id:'brace_shell',  name:'Shell Bracelet',    slot:'wrist', r:'common',   em:'🐚', m:{type:'bracelet', c:0xffc9d6} },
  { id:'goggles_aqua', name:'Aqua Goggles',      slot:'eyes',  r:'uncommon', em:'🥽', m:{type:'goggles', c:0x1ec8e0} },
  { id:'tee_wave',     name:'Wave Tee',          slot:'top',   r:'uncommon', em:'🌊', m:{type:'tee', c:0x29c7d8} },
  { id:'shorts_swim',  name:'Swim Shorts',       slot:'bottom',r:'uncommon', em:'🩳', m:{type:'pants', c:0x22a6f0} },
  { id:'beanie_leaf',  name:'Leafy Beanie',      slot:'hat',   r:'rare',     em:'🍃', m:{type:'beanie', c:0x3cae3c, c2:0x8ee05a} },
  { id:'gloves_forest',name:'Forest Gloves',     slot:'hands', r:'rare',     em:'🧤', m:{type:'gloves', c:0x2e8b3a} },
  { id:'eyepatch',     name:'Pirate Eyepatch',   slot:'eyes',  r:'rare',     em:'🏴‍☠️', m:{type:'eyepatch', c:0x111111} },
  { id:'beanie_rainbow',name:'Rainbow Beanie',   slot:'hat',   r:'epic',     em:'🌈', m:{type:'beanie', c:0x9b4dff, rainbow:true} },
  { id:'shades_heart', name:'Heart Shades',      slot:'eyes',  r:'epic',     em:'😍', m:{type:'hearts', c:0xff2a4a} },
  { id:'jacket_denim', name:'Denim Jacket',      slot:'top',   r:'epic',     em:'🧥', m:{type:'jacket', c:0x3d6fb8} },
  { id:'sneak_pop',    name:'Pop Kicks',         slot:'shoes', r:'epic',     em:'👟', m:{type:'shoes', c:0xff3fb4} },
  { id:'jacket_lava',  name:'Lava Jacket',       slot:'top',   r:'mythic',   em:'🌋', m:{type:'jacket', c:0xff5a1f, glow:0x661400} },
  { id:'visor_fire',   name:'Fire Visor',        slot:'eyes',  r:'mythic',   em:'🔥', m:{type:'visor', c:0xff7a00} },
  { id:'pants_magma',  name:'Magma Pants',       slot:'bottom',r:'mythic',   em:'👖', m:{type:'pants', c:0x8a1c0c} },
  { id:'crown_silver', name:'Silver Crown',      slot:'hat',   r:'ultra',    em:'👑', m:{type:'crown', c:0xdfe6f0} },
  { id:'gloves_knight',name:'Knight Gloves',     slot:'hands', r:'ultra',    em:'🛡️', m:{type:'gloves', c:0xc7d2e0, metal:true} },
  { id:'crown_gold',   name:'Golden Crown',      slot:'hat',   r:'legendary',em:'👑', m:{type:'crown', c:0xffc933} },
  { id:'shades_star',  name:'Gold Star Shades',  slot:'eyes',  r:'legendary',em:'🌟', m:{type:'stars', c:0xffc933} },
  { id:'brace_gold',   name:'Halo Bracelet',     slot:'wrist', r:'legendary',em:'✨', m:{type:'bracelet', c:0xffd84a, metal:true} },
  { id:'helmet_astro', name:'Astro Helmet',      slot:'hat',   r:'cosmic',   em:'🧑‍🚀', m:{type:'helmet', c:0xbfefff} },
  { id:'jacket_galaxy',name:'Galaxy Jacket',     slot:'top',   r:'cosmic',   em:'🌌', m:{type:'jacket', c:0x5a2bd8, glow:0x2a0a80} },
  { id:'visor_star',   name:'Starlight Visor',   slot:'eyes',  r:'cosmic',   em:'🔮', m:{type:'visor', c:0x9b6bff} },
];
applyLegacyFraming(ITEMS);
ITEMS.push(...ITEMS_V2); // 26 legacy + 56 v2 = 82; Shop/Closet already iterate ITEMS
ITEMS.forEach(i=>i.price=ECO.ITEM_PRICE[i.r]); // economy v2: Epic items 800 (Zander); everything else = PRICE
const IMAP = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const SLOT_NAMES = { hat:'Headwear', eyes:'Eyewear', top:'Shirts & Jackets', bottom:'Pants', shoes:'Shoes', wrist:'Bracelets', hands:'Gloves' };

const CHARS = [
  { id:'ollie',  name:'Ollie the Otter',      em:'🦦', r:'common',   color:0x7a4a2c },
  { id:'pip',    name:'Pip the Penguin',      em:'🐧', r:'common',   color:0x1f2a55 },
  { id:'sunny',  name:'Sunny the Seal',       em:'🦭', r:'common',   color:0x8a8f99 },
  { id:'shelly', name:'Shelly the Sea Turtle',em:'🐢', r:'uncommon', color:0x4caf50 },
  { id:'pinchy', name:'Pinchy the Crab',      em:'🦀', r:'uncommon', color:0xe8452f },
  { id:'dash',   name:'Dash the Dolphin',     em:'🐬', r:'uncommon', color:0x4aa3df },
  { id:'zippy',  name:'Zippy the Zebrafish',  em:'🐟', r:'uncommon', color:0x3a6fd8 },
  { id:'bubbles',name:'Bubbles the Axolotl',  em:'🦎', r:'rare',     color:0xff8fc2, hue:true },
  { id:'coco',   name:'Coco the Seahorse',    em:'🐴', r:'rare',     color:0xff8a1f, hue:true },
  { id:'squirt', name:'Squirt the Squid',     em:'🦑', r:'rare',     color:0xff6a6a },
  { id:'lulu',   name:'Lulu the Lobster',     em:'🦞', r:'rare',     color:0xd8302a },
  { id:'percy',  name:'Percy the Piranha',    em:'🐠', r:'epic',     color:0xb0b8c4 },
  { id:'sharkie',name:'Sharkie the Shark',    em:'🦈', r:'epic',     color:0x6d8fb0 },
  { id:'nova',   name:'Nova the Narwhal',     em:'🐳', r:'mythic',   color:0x8fb3ff },
  { id:'oscar',  name:'Oscar the Orca',       em:'🐋', r:'mythic',   color:0x222222 },
  { id:'wade',   name:'Wade the Whale Shark', em:'🐋', r:'ultra',    color:0x5c7aa0 },
  { id:'polly',  name:'Polly the Puffin',     em:'🐦', r:'legendary',color:0xff7a2a },
  { id:'hammy',  name:'Hammy the Hammerhead', em:'🦈', r:'cosmic',   color:0x7b8da6 },
  { id:'bella',  name:'Bella the Beluga',     em:'🐳', r:'uncommon', color:0xf2f2f2 },
  { id:'angie',  name:'Angie the Angelfish',  em:'🐠', r:'uncommon', color:0xffd23a },
  { id:'tusk',   name:'Tusk the Walrus',      em:'🦭', r:'rare',     color:0x8a5a3a },
  { id:'mo',     name:'Mo the Manatee',       em:'🦭', r:'rare',     color:0x9aa39a },
  { id:'gus',    name:'Gus the Pelican',      em:'🐦', r:'epic',     color:0xffffff },
  { id:'nudi',   name:'Nudi the Sea Slug',    em:'🐛', r:'epic',     color:0x7a3ad8 },
  { id:'echo',   name:'Echo the Eel',         em:'🐍', r:'mythic',   color:0x8ad83a },
  { id:'jelly',  name:'Jelly the Jellyfish',  em:'🪼', r:'common',   color:0xc9a6f2 },
  { id:'stella', name:'Stella the Starfish',  em:'⭐', r:'common',   color:0xff7a1f },
  { id:'finn',   name:'Finn the Clownfish',   em:'🐠', r:'uncommon', color:0xff7a1a },
  { id:'puff',   name:'Puff the Pufferfish',  em:'🐡', r:'uncommon', color:0xffd23a },
  { id:'hank',   name:'Hank the Hermit Crab', em:'🐚', r:'rare',     color:0xf2787a },
  { id:'inky',   name:'Inky the Octopus',     em:'🐙', r:'rare',     color:0x7a3ad8 },
  { id:'milo',   name:'Milo the Manta Ray',   em:'🐟', r:'epic',     color:0x22306b },
  { id:'wally',  name:'Wally the Whale',      em:'🐋', r:'legendary',color:0x3f9be8 },
  { id:'kelpie', name:'Kelpie the Seaweed',   em:'🌿', r:'rare',     color:0x5c9a3c },
  { id:'giga',   name:'Giga the Giant Squid', em:'🦑', r:'epic',     color:0xc45a3c },
];
const ART_IDS = ['ollie','pip','sunny','bubbles','nova','dash','shelly','pinchy','coco','squirt','lulu','percy','sharkie','oscar','wade','polly','hammy','zippy','bella','tusk','mo','gus','angie','nudi','echo','jelly','stella','finn','puff','hank','inky','milo','wally','kelpie','giga'];
CHARS.forEach(c=>c.art = ART_IDS.includes(c.id));
const CMAP = Object.fromEntries(CHARS.map(c=>[c.id,c]));
function artUrl(id){ return (window.__ART && window.__ART[id]) || `art/${id}.jpg?v=${ASSET_V}`; }
function iconHtml(it, cls='ic'){ if(it.slot && it.m){ const u=itemThumb(it); if(u) return `<div class="${cls} thumbic"><img src="${u}" alt="${it.name}" draggable="false"></div>`; }
  return it.art ? `<div class="${cls} artic"><img src="${artUrl(it.id)}" alt="${it.name}" draggable="false"></div>` : `<div class="${cls}" ${it.hue?`style="filter:hue-rotate(${it.id==='bubbles'?'300deg':'180deg'}) saturate(1.5)"`:''}>${it.em}</div>`; }
CHARS.forEach(c=>c.price = c.id==='ollie'?0:PRICE[c.r]*2);

const SAMPLE_MAZE = [ ['OceanKing',12], ['BubbleBrawler',10], ['Finatic',8], ['CoralCrusher',6], ['DeepDiver99',4] ];
const SAMPLE_RACE = [ ['OceanKing',38.2], ['BubbleBrawler',41.7], ['Finatic',45.0], ['CoralCrusher',49.3], ['DeepDiver99',55.8] ];
/* Sample shop leaderboard looks — labeled as samples. Playable characters + existing ITEMS only. */
const SAMPLE_LOOKS = [
  { n:'OceanKing',      v:12, char:'oscar',   eq:{ hat:'crown_silver', eyes:'visor_fire', top:'jacket_denim', shoes:'sneak_pop' } },
  { n:'BubbleBrawler',  v:10, char:'bubbles', eq:{ hat:'beanie_rainbow', eyes:'shades_heart', top:'tee_wave', bottom:'shorts_swim' } },
  { n:'Finatic',        v:8,  char:'finn',    eq:{ hat:'cap_blue', eyes:'specs_round', top:'tee_white', shoes:'sneak_red' } },
  { n:'CoralCrusher',   v:6,  char:'dash',    eq:{ eyes:'goggles_aqua', top:'jacket_lava', bottom:'shorts_swim', shoes:'sneak_pop' } },
  { n:'DeepDiver99',    v:4,  char:'wade',    eq:{ hat:'beanie_leaf', eyes:'goggles_aqua', top:'tee_wave', wrist:'brace_shell' } },
];


/* ===================== SAVE ===================== */
const SAVE_KEY = 'zkidz_save_v1';
const defaultSave = () => ({ name:'PlayerOne', coins:200, owned:[], chars:['ollie'], selChar:'ollie', equipped:{}, level:1, bestLevel:0, raceTimes:[], ghost:null, cardsRound:1, chestsOpened:0, mode:'maze', music:true });
let S;
try { S = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')); } catch(e){ S = defaultSave(); }
const WAS_V1 = S.econ===1; // existing v1 player → one-time Cosmic notice (economy v2)
ECO.initEconomy(ITEMS, CHARS); ECO.migrateSave(S); const HELLO_TODAY = ECO.ensureDay(S);
if(!WAS_V1) S.cosmicNoticeSeen=true; // new players start on v2, nothing to explain
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} refreshCoins(); }

/* ===================== SAFARI COMPAT ===================== */
(function(){ const P=typeof CanvasRenderingContext2D!=='undefined' && CanvasRenderingContext2D.prototype; if(!P||P.roundRect) return;
  P.roundRect=function(x,y,w,h,r){ if(w<0){ x+=w; w=-w; } if(h<0){ y+=h; h=-h; }
    let rtl,rtr,rbr,rbl; if(typeof r==='number') rtl=rtr=rbr=rbl=r; else if(Array.isArray(r)){ rtl=r[0]||0; rtr=r[1]||r[0]||0; rbr=r[2]||r[0]||0; rbl=r[3]||r[1]||r[0]||0; } else { const o=r||{}; rtl=+o[0]||+o.tl||0; rtr=+o[1]||+o.tr||0; rbr=+o[2]||+o.br||0; rbl=+o[3]||+o.bl||0; }
    const m=Math.min(w,h)/2; rtl=Math.min(Math.max(0,rtl),m); rtr=Math.min(Math.max(0,rtr),m); rbr=Math.min(Math.max(0,rbr),m); rbl=Math.min(Math.max(0,rbl),m);
    this.moveTo(x+rtl,y); this.lineTo(x+w-rtr,y); this.quadraticCurveTo(x+w,y,x+w,y+rtr); this.lineTo(x+w,y+h-rbr); this.quadraticCurveTo(x+w,y+h,x+w-rbr,y+h); this.lineTo(x+rbl,y+h); this.quadraticCurveTo(x,y+h,x,y+h-rbl); this.lineTo(x,y+rtl); this.quadraticCurveTo(x,y,x+rtl,y); this.closePath(); return this; };
})();

/* ===================== AUDIO ===================== */
let AC = null;
function ac(){ try{ if(!AC){ const Ctor=window.AudioContext||window.webkitAudioContext; if(!Ctor) return null; AC=new Ctor(); } if(AC && AC.state==='suspended'){ const p=AC.resume(); if(p&&p.catch) p.catch(()=>{}); } }catch(e){} return AC; }
function tone(f, d=0.12, type='sine', g=0.15, delay=0, slide=0){
  const a = ac(); if(!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), v = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide), t+d);
  v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t+0.01); v.gain.exponentialRampToValueAtTime(0.0001, t+d);
  o.connect(v).connect(a.destination); o.start(t); o.stop(t+d+0.02);
}
const SFX = {
  coin(){ tone(988,.07,'square',.06); tone(1319,.14,'square',.06,.06); },
  click(){ tone(660,.06,'triangle',.12); },
  dash(){ tone(300,.25,'sawtooth',.06,0,600); },
  bump(){ tone(140,.2,'square',.1,0,-60); },
  check(){ tone(784,.08,'triangle',.12); tone(1175,.16,'triangle',.12,.08); },
  flip(){ tone(520,.05,'triangle',.08); },
  match(){ [660,880,1100].forEach((f,i)=>tone(f,.1,'triangle',.1,i*.07)); },
  miss(){ tone(260,.15,'triangle',.08,0,-80); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.18,'triangle',.12,i*.11)); },
  chest(r){ const n = 4 + r; for(let i=0;i<n;i++) tone(400*Math.pow(1.122,i*2),.16,'triangle',.11,i*.08); tone(1600,.6,'sine',.06,n*.08); },
  shake(){ tone(180+Math.random()*80,.05,'square',.05); },
  count(){ tone(440,.15,'square',.08); }, go(){ tone(880,.35,'square',.1); },
};

/* ===================== BACKGROUND MUSIC ===================== */
// HTMLAudioElement (not WebAudio) so iOS plays through the silent switch.
// iPhone Safari cannot play OGG, so we pick m4a/mp3/ogg via canPlayType.
const ASSET_V = '20261116-13';
const MUSIC_KEYS = ['lobby','play','race','sort'];
const MUSIC_VOL = 0.6;
const MUSIC_HOST = 'https://zgrokbotz.github.io/zkidz/';
let musicReady=false, musicKey=null, musicA=null, musicFade=null, musicBgPaused=false, musicExt=null;
const musicPool={};
function musicEnabled(){ return S.music!==false; }
function pickAudioExt(probe){
  const a=probe || document.createElement('audio');
  const can=t=>{ try{ const v=a.canPlayType && a.canPlayType(t); return v==='probably'||v==='maybe'; }catch(e){ return false; } };
  if(can('audio/mp4; codecs="mp4a.40.2"')||can('audio/mp4')||can('audio/aac')||can('audio/x-m4a')) return 'm4a';
  if(can('audio/mpeg')||can('audio/mp3')) return 'mp3';
  if(can('audio/ogg; codecs="vorbis"')||can('audio/ogg')) return 'ogg';
  return 'mp3';
}
function musicFormat(){ if(!musicExt) musicExt=pickAudioExt(); return musicExt; }
function musicUrl(key){
  const file=`audio/${key}.${musicFormat()}?v=${ASSET_V}`;
  if(window.__MUSIC_BASE) return window.__MUSIC_BASE+file;
  if(location.protocol==='file:') return MUSIC_HOST+file;
  return file;
}
function getTrack(key){
  if(musicPool[key]) return musicPool[key];
  const a=new Audio();
  a.loop=true; a.preload='auto'; a.volume=MUSIC_VOL; a.playsInline=true;
  a.setAttribute('playsinline',''); a.setAttribute('webkit-playsinline','');
  a.src=musicUrl(key);
  const box=$('#musicBox')||document.body; box.appendChild(a);
  musicPool[key]=a; return a;
}
function preloadMusic(){ MUSIC_KEYS.forEach(getTrack); }
function musicIsPlaying(){ return !!(musicA && !musicA.paused && !musicA.ended); }
let musicFadeGen=0;
function clampVol(v){ return Math.max(0, Math.min(MUSIC_VOL, v)); }
function fadeMusic(from, to, dur=0.7){ const gen=++musicFadeGen; if(musicFade){ cancelAnimationFrame(musicFade); musicFade=null; } const t0=performance.now(), startFrom=clampVol(from?from.volume:0);
  const tick=(now)=>{ if(gen!==musicFadeGen) return; const k=Math.min(1,(now-t0)/(dur*1000)); if(to) to.volume=clampVol(MUSIC_VOL*k); if(from && from!==to) from.volume=clampVol(startFrom*(1-k));
    if(k<1) musicFade=requestAnimationFrame(tick); else { musicFade=null; if(from && from!==to){ from.pause(); try{ from.currentTime=0; }catch(e){} from.volume=MUSIC_VOL; } if(to) to.volume=MUSIC_VOL; } };
  musicFade=requestAnimationFrame(tick); }
function stopMusic(fade=true){ const prev=musicA; musicKey=null; musicA=null; if(!prev) return; if(!fade){ prev.pause(); try{ prev.currentTime=0; }catch(e){} prev.volume=MUSIC_VOL; return; } fadeMusic(prev, null, 0.4); }
function playMusic(key){
  if(!musicReady || !musicEnabled()){ if(musicA) stopMusic(); return Promise.resolve(); }
  if(!key) return Promise.resolve();
  if(key===musicKey && musicIsPlaying()) return Promise.resolve();
  const next=getTrack(key), prev=musicA; musicKey=key; musicA=next;
  next.muted=false;
  if(!prev || prev===next){ next.volume=MUSIC_VOL; const p=next.play(); if(p&&p.catch) p.catch(()=>{}); return p||Promise.resolve(); }
  next.volume=0;
  const p=next.play(); if(p&&p.catch) p.catch(()=>{});
  fadeMusic(prev, next, 0.7);
  return p||Promise.resolve();
}
function sceneMusicKey(explicit){ if(explicit) return explicit; const screen=document.body.dataset.screen; if(screen==='lobby'||screen==='panel') return 'lobby'; if(screen==='cards') return 'play'; if(screen==='hud') return (G && G.mode==='race')?'race':'play'; return null; }
function syncMusic(explicit){ if(!musicReady) return; if(!musicEnabled() || document.hidden){ if(musicA && !musicA.paused) musicA.pause(); return; } const key=sceneMusicKey(explicit); if(key) playMusic(key); }
function armTracksForIOS(){
  // play/pause every element inside this user gesture so later scene changes can call play()
  MUSIC_KEYS.forEach(k=>{
    const a=getTrack(k);
    try{ const p=a.play(); if(p&&p.catch) p.catch(()=>{}); a.pause(); try{ a.currentTime=0; }catch(e){} a.muted=false; a.volume=MUSIC_VOL; }catch(e){}
  });
}
function unlockMusic(){
  ac();
  preloadMusic();
  if(musicIsPlaying()){ musicReady=true; return; }
  musicReady=true;
  armTracksForIOS();
  if(musicEnabled() && !document.hidden) syncMusic();
}
function setMusicOn(on){ S.music=!!on; save(); if(on){ unlockMusic(); syncMusic(); } else stopMusic(); toast(on?'Music on 🎵':'Music off'); }
['pointerdown','touchend','click'].forEach(ev=>document.addEventListener(ev, unlockMusic, {capture:true}));
document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ if(musicA && !musicA.paused){ musicA.pause(); musicBgPaused=true; } }
  else if(musicBgPaused){ musicBgPaused=false; if(musicReady && musicEnabled() && musicA){ const p=musicA.play(); if(p&&p.catch) p.catch(()=>{}); } else syncMusic(); } });

/* ===================== HELPERS ===================== */
const STAR='<span class="coin-ic" title="Starfish"></span>';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a,b)=>a+Math.random()*(b-a);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if(isTouch) document.body.classList.add('touch');
const isAppleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent||'') || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
function maxPixelRatio(){ try{ if(typeof isLow==='function' && isLow()) return 1; }catch(e){} if(isAppleTouch) return 1.5; if(isTouch) return 1.6; return 2; }
function refreshCoins(){ $$('.coinCount').forEach(e=>e.textContent=S.coins.toLocaleString()); $('#trophies').textContent = S.bestLevel*100 + S.chestsOpened*25; $('#pname').textContent=S.name; }
let toastT; function toast(msg){ const t=$('#toast'); t.innerHTML=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),1800); }
function rarityBadge(r){ const R=RMAP[r]; const bg = r==='cosmic'?'linear-gradient(90deg,#7b5cff,#00e5ff,#ff5fd2)':R.color; return `<span class="rar" style="background:${bg}">${R.name}</span>`; }
function confetti(color){ for(let i=0;i<40;i++){ const d=document.createElement('div'); d.className='conf'; d.style.left=rand(0,100)+'vw'; d.style.background = Math.random()<.5?color:pick(['#ffd52e','#ff4f6d','#2bc0ff','#5be04a','#fff']); d.style.animationDuration=rand(1.6,3)+'s'; d.style.animationDelay=rand(0,.4)+'s'; document.body.appendChild(d); setTimeout(()=>d.remove(),3600);} }

/* ===================== THREE SETUP ===================== */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio||1, maxPixelRatio()));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = 1.0;
function showWebglRecover(){ let el=document.getElementById('webglRecover'); if(!el){ el=document.createElement('div'); el.id='webglRecover'; el.innerHTML='<div class="webgl-card"><h2>The ocean needs a quick splash!</h2><p>Tap to bring the reef back.</p><button type="button" class="btn green">TAP TO CONTINUE</button></div>'; el.querySelector('button').onclick=()=>location.reload(); document.body.appendChild(el); } }
canvas.addEventListener('webglcontextlost', ev=>{ ev.preventDefault(); showWebglRecover(); });
canvas.addEventListener('webglcontextrestored', ()=>{ location.reload(); });
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov = w<h?72:55; camera.updateProjectionMatrix(); updateViewOffset(); invalidateLobbyFrame(); }
addEventListener('resize', resize);

function mat(color, o={}){ return new THREE.MeshStandardMaterial({ color, roughness:o.rough??0.55, metalness:o.metal??0, emissive:o.emissive??0x000000, emissiveIntensity:o.ei??1, transparent:!!o.opacity, opacity:o.opacity??1 }); }
function addLights(scene){
  scene.add(new THREE.HemisphereLight(0xc4ecff, 0x9a7650, .95));
  scene.add(new THREE.AmbientLight(0x5aa0ff, .25));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.9); sun.position.set(6,18,9); sun.castShadow=!isLow(); sun.userData.main=true;
  sun.shadow.mapSize.set(2048,2048); sun.shadow.radius=4; sun.shadow.bias=-.0005; sun.shadow.normalBias=.02; const sc=sun.shadow.camera; sc.left=-12; sc.right=12; sc.top=12; sc.bottom=-12; sc.near=1; sc.far=50;
  const fill = new THREE.DirectionalLight(0x7fc8ff, .7); fill.position.set(-8,6,-10);
  scene.add(sun, sun.target, fill); return sun;
}
function bubbleTexture(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(26,24,2,32,32,30); gr.addColorStop(0,'rgba(255,255,255,.95)'); gr.addColorStop(.35,'rgba(200,240,255,.25)'); gr.addColorStop(.85,'rgba(200,240,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.arc(32,32,30,0,7); g.fill(); g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=2; g.beginPath(); g.arc(32,32,28,0,7); g.stroke(); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const BUBBLE_TEX = bubbleTexture();
function sparkTexture(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,240,150,.9)'); gr.addColorStop(1,'rgba(255,200,0,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); g.fillStyle='#fff'; g.fillRect(30,4,4,56); g.fillRect(4,30,56,4); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const SPARK_TEX = sparkTexture();
function makeBubbles(scene, count, area, h){
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(count*3); const spd=[];
  for(let i=0;i<count;i++){ pos[i*3]=rand(-area,area); pos[i*3+1]=rand(0,h); pos[i*3+2]=rand(-area,area); spd.push(rand(.6,1.6)); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map:BUBBLE_TEX, size:.55, transparent:true, depthWrite:false }));
  pts.userData.update = (dt)=>{ const p=geo.attributes.position.array; for(let i=0;i<count;i++){ p[i*3+1]+=spd[i]*dt; p[i*3]+=Math.sin(performance.now()/700+i)*dt*.2; if(p[i*3+1]>h){ p[i*3+1]=0; } } geo.attributes.position.needsUpdate=true; };
  scene.add(pts); return pts;
}
function gradientBg(top, bottom){ const c=document.createElement('canvas'); c.width=2; c.height=256; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,top); gr.addColorStop(1,bottom); g.fillStyle=gr; g.fillRect(0,0,2,256); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }

/* ===================== OLLIE MODEL ===================== */
// Smooth bean-shaped body+head (lathe), matching the 3D-printed figurine.
const OLLIE_PROFILE = (()=>{ const pts=[[0,.06],[.3,.08],[.45,.16],[.53,.34],[.56,.56],[.55,.78],[.52,.98],[.5,1.1],[.53,1.24],[.565,1.42],[.55,1.6],[.47,1.78],[.3,1.93],[0,1.99]];
  const curve=new THREE.SplineCurve(pts.map(([r,y])=>new THREE.Vector2(r,y))); return curve.getPoints(60).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)); })();
let ACTIVE_PROFILE = OLLIE_PROFILES.C;
function bodyR(y){ const P=ACTIVE_PROFILE||OLLIE_PROFILE; for(let i=1;i<P.length;i++){ if(P[i].y>=y){ const a=P[i-1],b=P[i]; const t=(y-a.y)/((b.y-a.y)||1); return a.x+(b.x-a.x)*t; } } return 0; }
function profileSlice(y0,y1,scale=1.05){ const pts=[]; for(let i=0;i<=16;i++){ const y=y0+(y1-y0)*i/16; pts.push(new THREE.Vector2(bodyR(y)*scale,y)); } return new THREE.LatheGeometry(pts,48); }
const OLLIE_GEO = {};
function ollieGeos(){ if(OLLIE_GEO.body) return OLLIE_GEO;
  OLLIE_GEO.body = new THREE.LatheGeometry(OLLIE_PROFILE, 64);
  OLLIE_GEO.sphere = new THREE.SphereGeometry(1,40,28);
  OLLIE_GEO.arm = new THREE.CapsuleGeometry(.12,.22,10,20);
  // thick tapered tail curving along the ground (tube with taper)
  { const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.03,-.16,-.28),new THREE.Vector3(.14,-.24,-.56),new THREE.Vector3(.32,-.25,-.74)]);
    const tg=new THREE.TubeGeometry(curve,32,.19,20,false); const pos=tg.attributes.position, uv=tg.attributes.uv, v=new THREE.Vector3(), c=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){ const u=uv.getX(i); curve.getPointAt(u,c); v.fromBufferAttribute(pos,i).sub(c).multiplyScalar(1-.58*u); v.add(c); v.y = Math.max(v.y, -.3); pos.setXYZ(i,v.x,v.y,v.z); }
    tg.computeVertexNormals(); const tip=new THREE.SphereGeometry(.19*.42,20,14); const e=curve.getPointAt(1); tip.translate(e.x,e.y,e.z);
    const base=new THREE.SphereGeometry(.19,20,14);
    OLLIE_GEO.tail = mergeGeometries([tg.toNonIndexed(), tip.toNonIndexed(), base.toNonIndexed()].map(g=>{ g.deleteAttribute('uv'); return g; })); }
  // cream muzzle: a patch of a sphere shell hugging the head, shaped by an alpha mask
  { OLLIE_GEO.muzzle = new THREE.SphereGeometry(.577, 48, 24, Math.PI/2-1.12, 2.24, 1.36, .86);
    const c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,256,128); g.fillStyle='#fff';
    g.beginPath(); g.moveTo(14,22); g.quadraticCurveTo(70,4,128,14); g.quadraticCurveTo(186,4,242,22); g.quadraticCurveTo(262,70,200,112); g.quadraticCurveTo(128,134,56,112); g.quadraticCurveTo(-6,70,14,22); g.fill();
    const t=new THREE.CanvasTexture(c); OLLIE_GEO.muzzleMask=t; }
  OLLIE_GEO.smile = new THREE.TorusGeometry(.045,.012,8,20,Math.PI);
  Object.values(OLLIE_GEO).forEach(g=>{ if(g.isBufferGeometry) g.userData.shared=true; });
  return OLLIE_GEO; }
function softMat(color, ghost, o={}){
  const m = new THREE.MeshPhysicalMaterial({ color, roughness:o.rough??.72, metalness:0, sheen:o.sheen??.55, sheenRoughness:.7, sheenColor:new THREE.Color(color).lerp(new THREE.Color(0xffffff),.35) });
  if(ghost){ m.transparent=true; m.opacity=.4; m.depthWrite=false; } else patch(m, { rim:[o.rim??0xffe2c4, o.rimS??.28, 2.6] });
  return m; }
const SHOP_STAND = `<svg class="shop-svg" viewBox="0 0 64 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 8h52l-5 16H11L6 8z" fill="#fff4d6" stroke="#16163a" stroke-width="3" stroke-linejoin="round"/><path d="M14 8l4 16h9L23 8z" fill="#ff5b6c"/><path d="M36 8l4 16h9L45 8z" fill="#ff5b6c"/><path d="M6 8h52" fill="none" stroke="#16163a" stroke-width="3"/><circle cx="14" cy="22" r="3.2" fill="#fff4d6" stroke="#16163a" stroke-width="2"/><circle cx="26" cy="22" r="3.2" fill="#ff5b6c" stroke="#16163a" stroke-width="2"/><circle cx="38" cy="22" r="3.2" fill="#fff4d6" stroke="#16163a" stroke-width="2"/><circle cx="50" cy="22" r="3.2" fill="#ff5b6c" stroke="#16163a" stroke-width="2"/><rect x="12" y="28" width="40" height="20" rx="4" fill="#e39a3a" stroke="#16163a" stroke-width="3"/><rect x="20" y="32" width="24" height="10" rx="2" fill="#7fd6ff" stroke="#16163a" stroke-width="2"/><polygon points="32,4 34.2,8.6 39.2,9 35.4,12.4 36.5,17.2 32,14.6 27.5,17.2 28.6,12.4 24.8,9 29.8,8.6" fill="#ffc94a" stroke="#16163a" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const PLAYABLE = new Set(['ollie','dash','finn','bubbles','oscar','wade','pip','sunny','jelly','lulu','percy','nova','kelpie','giga']);
function isPlayable(id){ return PLAYABLE.has(id); }
function flukeGroup(mat){
  const g=new THREE.Group();
  const stem=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.22,8,12), mat); stem.rotation.x=Math.PI/2; stem.position.set(0,.02,-.16); g.add(stem);
  for(const s of [-1,1]){ const f=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12), mat); f.scale.set(.95,.18,.55); f.position.set(.26*s,.02,-.38); f.rotation.y=.35*s; g.add(f); }
  return g;
}
function fishTailGroup(mat){
  const g=new THREE.Group();
  const stem=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.16,8,12), mat); stem.rotation.x=Math.PI/2; stem.position.set(0,.08,-.16); g.add(stem);
  for(const s of [-1,1]){ const f=new THREE.Mesh(new THREE.SphereGeometry(.18,14,10), mat); f.scale.set(.28,1.05,.7); f.position.set(0,.08+.12*s,-.34); f.rotation.x=.5*s; g.add(f); }
  return g;
}
function finnBodyTex(){
  const c=document.createElement('canvas'); c.width=16; c.height=256; const g=c.getContext('2d');
  g.fillStyle='#ff7a1a'; g.fillRect(0,0,16,256);
  g.fillStyle='#fff4e0';
  [[36,26],[80,28],[126,28],[174,24]].forEach(([y,h])=>g.fillRect(0,y,16,h));
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true; return t;
}
function wadeBodyTex(){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const g=c.getContext('2d');
  g.fillStyle='#5c7e9c'; g.fillRect(0,0,256,256);
  g.fillStyle='#f4f7fb';
  const rand=(s)=>{ s|=0; s=(s*1664525+1013904223)|0; return (s>>>0)/4294967296; };
  for(let i=0;i<90;i++){ const u=rand(1000+i), v=rand(2000+i), r=2.2+rand(3000+i)*4.2; g.beginPath(); g.arc(u*256,v*200+8,r,0,Math.PI*2); g.fill(); }
  g.fillStyle='#eef3f8';
  g.fillRect(118,8,6,70); g.fillRect(132,8,6,70);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true; return t;
}
function dressSpecies(kind, rig, parts, ghost, mats){
  const { brown, cream, darker, black } = mats;
  const addBelly=(color, sx,sy,sz, y,z)=>{ const m=softMat(color, ghost, {rim:0xffffff, rimS:.18, sheen:.25}); const b=new THREE.Mesh(new THREE.SphereGeometry(1,28,20), m); b.scale.set(sx,sy,sz); b.position.set(0,y,z); rig.add(b); return b; };
  const addDorsal=(y,z,h,w)=>{ const fin=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12), brown); fin.scale.set(w,.22,h); fin.rotation.x=-.35; fin.position.set(0,y,z); rig.add(fin); };
  if(kind==='dash'){
    addBelly(0xffffff,.42,.5,.22,.78,.36);
    const sn=new THREE.Mesh(new THREE.SphereGeometry(.2,20,14), brown); sn.scale.set(1.05,.72,1.25); sn.position.set(0,-.02,.38); parts.head.add(sn);
    const snw=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12), softMat(0xffffff,ghost,{sheen:.2})); snw.scale.set(1.1,.55,1); snw.position.set(0,-.08,.5); parts.head.add(snw);
    addDorsal(1.78,-.22,.95,.24);
    const fl=flukeGroup(brown); fl.position.set(0,.28,-.28); rig.add(fl); parts.tail=fl;
    for(const s of [-1,1]){ parts['arm'+s].scale.set(1.15,.7,1.7); parts['foot'+s].scale.set(.19,.09,.26); }
  } else if(kind==='finn'){
    const tex=finnBodyTex(); const fm=softMat(0xffffff, ghost); fm.map=tex; fm.sheen=0; fm.needsUpdate=true; parts.body.material=fm;
    for(const s of [-1,1]){ const nub=new THREE.Mesh(new THREE.SphereGeometry(.1,12,10), brown); nub.position.set(.1*s,.4,-.02); parts.head.add(nub); parts['arm'+s].scale.set(1.15,.85,1.25); parts['foot'+s].scale.set(.16,.09,.18); parts['foot'+s].material=softMat(0xff7a1a,ghost); }
    const ft=fishTailGroup(brown); ft.position.set(0,.4,-.28); rig.add(ft); parts.tail=ft;
  } else if(kind==='bubbles'){
    addBelly(0xffe4f2,.45,.5,.24,.8,.34);
    const gill=softMat(0xd44d9a, ghost, {rim:0xffb6d9, rimS:.35}), gill2=softMat(0xc13a84, ghost);
    for(const s of [-1,1]){
      for(let i=0;i<3;i++){
        const br=new THREE.Group(); br.position.set(.58*s,.2+i*.08,.16); br.rotation.z=s*(.85+i*.45); br.rotation.y=-s*.15; parts.head.add(br);
        const stem=new THREE.Mesh(new THREE.CapsuleGeometry(.05,.28,6,8), gill); stem.position.y=.2; br.add(stem);
        for(let k=0;k<4;k++){ const fr=new THREE.Mesh(new THREE.SphereGeometry(.1-k*.01,10,8), k?gill:gill2); fr.position.set((k-1.5)*.05,.22+k*.1,.04); br.add(fr); }
      }
      parts['foot'+s].scale.set(.15,.08,.2);
    }
    const tl=new THREE.Mesh(new THREE.CapsuleGeometry(.1,.36,8,12), brown); tl.rotation.set(.6,0,.4); tl.position.set(.12,.28,-.36); rig.add(tl); parts.tail=tl;
  } else if(kind==='oscar'){
    addBelly(0xf6f6f6,.46,.62,.26,.78,.34);
    for(const s of [-1,1]){
      const p=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12), softMat(0xffffff,ghost,{sheen:.2})); p.scale.set(.95,1.15,.55); p.position.set(.32*s,.12,.4); parts.head.add(p);
      parts['arm'+s].scale.set(1.2,.75,1.65); parts['foot'+s].material=softMat(0xf3f3f3,ghost); parts['foot'+s].scale.set(.18,.09,.22);
    }
    addDorsal(1.95,-.12,.85,.22);
    const fl=flukeGroup(brown); fl.position.set(0,.28,-.3); rig.add(fl); parts.tail=fl;
  } else if(kind==='wade'){
    const tex=wadeBodyTex(); const wm=softMat(0xffffff, ghost); wm.map=tex; wm.needsUpdate=true; parts.body.material=wm;
    addBelly(0xf0e4cc,.5,.48,.26,.72,.34);
    const sn=new THREE.Mesh(new THREE.SphereGeometry(.28,20,14), softMat(0xf0e4cc,ghost,{sheen:.2})); sn.scale.set(1.2,.62,1.1); sn.position.set(0,-.16,.34); parts.head.add(sn);
    addDorsal(1.8,-.28,.8,.22);
    const spotM=softMat(0xf4f7fb,ghost,{sheen:.1});
    [[.28,1.72,.3,.07],[ -.28,1.72,.3,.07],[.38,1.5,.2,.06],[-.38,1.5,.2,.06],[.22,1.88,.12,.055],[-.22,1.88,.12,.055],[.45,1.25,.18,.065],[-.45,1.25,.18,.065]].forEach(([x,y,z,r])=>{ const sp=new THREE.Mesh(new THREE.SphereGeometry(r,10,8), spotM); sp.position.set(x,y,z); rig.add(sp); });
    const fl=flukeGroup(brown); fl.position.set(0,.3,-.3); rig.add(fl); parts.tail=fl;
    for(const s of [-1,1]){ parts['arm'+s].scale.set(1.25,.7,1.8); parts['foot'+s].scale.set(.2,.1,.24); }
  }
}
function buildOllieLegacy(opts={}){
  const { charId=S.selChar, equipped=S.equipped, ghost=false } = opts;
  const rawId = charId || 'ollie'; const kind = isPlayable(rawId) ? rawId : 'ollie';
  const ch = CMAP[kind]||CMAP.ollie; const GEO=ollieGeos(); const otter = kind==='ollie';
  const g = new THREE.Group(); const rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const brown = softMat(ch.color, ghost), cream = softMat(0xfbe6c2, ghost, {rim:0xffffff, rimS:.22, sheen:.3}), darker = softMat(new THREE.Color(ch.color).multiplyScalar(.85).getHex(), ghost);
  const black = new THREE.MeshPhysicalMaterial({ color:0x0a0a0a, roughness:.08, clearcoat:1, clearcoatRoughness:.05 }); if(ghost){ black.transparent=true; black.opacity=.4; }
  const body = new THREE.Mesh(GEO.body, brown); rig.add(body); parts.body=body;
  const head = new THREE.Group(); head.position.y=1.45; rig.add(head); parts.head=head;
  const hatA = new THREE.Group(); hatA.position.y=.02; hatA.scale.setScalar(1.16); head.add(hatA); parts.hatAnchor=hatA;
  const eyeA = new THREE.Group(); eyeA.position.set(0,-.07,0); eyeA.scale.setScalar(1.12); head.add(eyeA); parts.eyeAnchor=eyeA;
  if(otter){ cream.alphaMap=GEO.muzzleMask; cream.alphaTest=.5; cream.side=THREE.DoubleSide; cream.emissive=new THREE.Color(0x5a4a30);
    const face = new THREE.Mesh(GEO.muzzle, cream); face.position.set(0,-.03,0); head.add(face); }
  for(const s of [-1,1]){
    const eye = new THREE.Mesh(GEO.sphere, black); eye.scale.setScalar(.072); eye.position.set(.2*s,.115,.49); head.add(eye);
    const shine = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color:0xffffff})); shine.scale.setScalar(.02); shine.position.set(.2*s+.024,.142,.553); head.add(shine);
    if(otter){ const ear = new THREE.Mesh(GEO.sphere, brown); ear.scale.set(.12,.12,.08); ear.position.set(.41*s,.33,-.02); head.add(ear);
      const earIn = new THREE.Mesh(GEO.sphere, darker); earIn.scale.set(.07,.07,.03); earIn.position.set(.43*s,.33,.045); head.add(earIn); }
    const sh = new THREE.Group(); sh.position.set(.49*s,1.1,.08); rig.add(sh); parts['sh'+s]=sh;
    const arm = new THREE.Mesh(GEO.arm, brown); arm.position.set(.03*s,-.2,0); arm.rotation.z=.12*s; sh.add(arm); parts['arm'+s]=arm;
    const foot = new THREE.Mesh(GEO.sphere, darker); foot.scale.set(.17,.1,.23); foot.position.set(.21*s,.07,.12); rig.add(foot); parts['foot'+s]=foot;
    if(otter){ for(const k of [-1,1]){ const toe=new THREE.Mesh(GEO.sphere, softMat(new THREE.Color(ch.color).multiplyScalar(.6).getHex(), ghost)); toe.scale.set(.05,.35,.12); toe.position.set(.33*k,.1,.92); foot.add(toe); } }
  }
  if(otter){ const nose = new THREE.Mesh(GEO.sphere, black); nose.scale.set(.09,.062,.06); nose.position.set(0,.0,.575); head.add(nose); }
  for(const s of [-1,1]){ const sm = new THREE.Mesh(GEO.smile, black); sm.rotation.z=Math.PI; sm.position.set(.043*s,-.085,.57); sm.rotation.x=-.25; head.add(sm); }
  if(otter){ const tail = new THREE.Mesh(GEO.tail, brown); tail.position.set(.04,.33,-.3); rig.add(tail); parts.tail=tail; }
  else dressSpecies(kind, rig, parts, ghost, { brown, cream, darker, black });
  if(!parts.tail){ const tail = new THREE.Mesh(GEO.tail, brown); tail.position.set(.04,.33,-.3); rig.add(tail); parts.tail=tail; }
  g.traverse(o=>{ if(o.isMesh) o.userData.base=true; });
  if(!ghost) addEquipment(rig, parts, equipped);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=!ghost; } });
  g.userData.parts = parts; g.userData.walk = 0;
  return g;
}
function addEquipmentOriginal(g, parts, eq){
  for(const slot in eq){ const it = IMAP[eq[slot]]; if(!it) continue; const m = it.m;
    const MM = (c,o={}) => { const x=mat(c,{ rough: m.metal?.25:.55, metal: m.metal?.8:0, emissive:m.glow||0, ...o }); return x; };
    const H = ['cap','beanie','crown','helmet'].includes(m.type) ? parts.hatAnchor : parts.eyeAnchor;
    if(m.type==='cap'){ const top=new THREE.Mesh(new THREE.SphereGeometry(.47,32,16,0,Math.PI*2,0,Math.PI/2), MM(m.c)); top.position.y=.22; H.add(top); const brim=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.04,24,1,false,-Math.PI/2,Math.PI), MM(m.c)); brim.scale.set(1.2,1,1.4); brim.position.set(0,.24,.38); H.add(brim); }
    if(m.type==='beanie'){ const top=new THREE.Mesh(new THREE.SphereGeometry(.48,32,16,0,Math.PI*2,0,Math.PI/2), m.rainbow?rainbowMat():MM(m.c)); top.scale.y=1.15; top.position.y=.2; H.add(top); const cuff=new THREE.Mesh(new THREE.TorusGeometry(.46,.08,12,36), MM(m.c2||0x7c3bd8)); cuff.rotation.x=Math.PI/2; cuff.position.y=.22; H.add(cuff); const pom=new THREE.Mesh(new THREE.SphereGeometry(.14,18,12), MM(m.rainbow?0x9b4dff:(m.c2||0xffffff))); pom.position.y=.8; H.add(pom); }
    if(m.type==='crown'){ const band=new THREE.Mesh(new THREE.CylinderGeometry(.34,.32,.2,8,1,true), MM(m.c,{metal:.9,rough:.2})); band.material.side=THREE.DoubleSide; band.position.y=.5; H.add(band); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; const sp=new THREE.Mesh(new THREE.ConeGeometry(.06,.16,8), band.material); sp.position.set(Math.sin(a)*.33,.68,Math.cos(a)*.33); H.add(sp); const gem=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8), mat([0xff2a4a,0x2a8aff,0x2ee66a][i%3],{emissive:[0x550010,0x001a55,0x004010][i%3]})); gem.position.set(Math.sin(a)*.345,.5,Math.cos(a)*.345); H.add(gem);} }
    if(m.type==='helmet'){ const glass=new THREE.Mesh(new THREE.SphereGeometry(.68,32,24), mat(m.c,{opacity:.28,rough:.05})); glass.material.depthWrite=false; glass.position.y=.05; H.add(glass); const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.07,12,32), mat(0xffffff,{metal:.7,rough:.25})); ring.rotation.x=Math.PI/2; ring.position.y=-.42; H.add(ring); const ant=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8), mat(0x5ff6ff,{emissive:0x22aacc})); ant.position.y=.82; H.add(ant); }
    if(m.type==='goggles'||m.type==='specs'){ for(const s of [-1,1]){ const r=new THREE.Mesh(new THREE.TorusGeometry(m.type==='goggles'?.12:.1,.03,10,24), MM(m.c)); r.position.set(.2*s,.15,.5); H.add(r); const l=new THREE.Mesh(new THREE.CircleGeometry(m.type==='goggles'?.11:.09,20), mat(m.type==='goggles'?0xaef4ff:0xffffff,{opacity:.35})); l.position.set(.2*s,.15,.51); H.add(l);} const br=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.03), MM(m.c)); br.position.set(0,.16,.52); H.add(br); if(m.type==='goggles'){ const strap=new THREE.Mesh(new THREE.TorusGeometry(.49,.03,8,36), MM(0x0d6f80)); strap.rotation.x=Math.PI/2; strap.position.y=.15; H.add(strap);} }
    if(m.type==='hearts'||m.type==='stars'){ for(const s of [-1,1]){ const sh=m.type==='hearts'?heartShape():starShape(); const l=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.03,bevelEnabled:true,bevelThickness:.02,bevelSize:.03,bevelSegments:3}), MM(m.c,{emissive:m.type==='stars'?0x553300:0x330008})); l.scale.setScalar(.15); l.position.set(.2*s,.15,.52); H.add(l);} const br=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.03), MM(m.c)); br.position.set(0,.18,.53); H.add(br); }
    if(m.type==='eyepatch'){ const p=new THREE.Mesh(new THREE.CircleGeometry(.1,20), MM(m.c)); p.position.set(.2,.15,.52); H.add(p); const strap=new THREE.Mesh(new THREE.TorusGeometry(.5,.018,6,36), MM(m.c)); strap.rotation.set(Math.PI/2,0,-.35); strap.position.y=.2; H.add(strap); }
    if(m.type==='visor'){ const v=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.14,32,1,true,-Math.PI/2.6,Math.PI/1.3), mat(m.c,{opacity:.7,emissive:m.c,ei:.35,rough:.1})); v.material.side=THREE.DoubleSide; v.position.y=.15; v.scale.set(1.02,1,1.07); H.add(v); }
    if(m.type==='tee'||m.type==='jacket'){
      const isJ=m.type==='jacket';
      const y0=isJ&&ACTIVE_PROFILE&&ACTIVE_PROFILE.jacketBottom!=null?ACTIVE_PROFILE.jacketBottom
            :((ACTIVE_PROFILE&&ACTIVE_PROFILE.teeBottom)!=null?ACTIVE_PROFILE.teeBottom:.6);
      const y1=isJ&&ACTIVE_PROFILE&&ACTIVE_PROFILE.jacketTop!=null?ACTIVE_PROFILE.jacketTop
            :((ACTIVE_PROFILE&&ACTIVE_PROFILE.teeTop)!=null?ACTIVE_PROFILE.teeTop:1.2);
      const sc=isJ?((ACTIVE_PROFILE&&ACTIVE_PROFILE.jacketScale)!=null?ACTIVE_PROFILE.jacketScale:1.07)
            :((ACTIVE_PROFILE&&ACTIVE_PROFILE.teeScale)!=null?ACTIVE_PROFILE.teeScale:1.04);
      const t=new THREE.Mesh(profileSlice(y0,y1,sc), MM(m.c)); t.material.side=THREE.DoubleSide; g.add(t);
      for(const s of [-1,1]){ const sl=new THREE.Mesh(new THREE.CylinderGeometry(.155,.15,.16,20,1,true), MM(m.c)); sl.material.side=THREE.DoubleSide; sl.position.set(.03*s,-.08,0); sl.rotation.z=.12*s; parts['sh'+s].add(sl); }
      if(m.type==='jacket'){
        if(!(ACTIVE_PROFILE&&ACTIVE_PROFILE.jacketCollar===false)){
          const col=new THREE.Mesh(new THREE.TorusGeometry(bodyR(y1)*1.04,.06,10,36), MM(m.c));
          col.rotation.x=Math.PI/2; col.position.y=y1; g.add(col);
        }
        const mid=(y0+y1)/2,
              zip=new THREE.Mesh(new THREE.BoxGeometry(.035,Math.max(.2,y1-y0-.1),.02), mat(0xdddddd,{metal:.8}));
        zip.position.set(0,mid,bodyR(mid)*sc+.005); g.add(zip);
        if(m.glow){ for(let i=0;i<8;i++){ const st=new THREE.Mesh(new THREE.SphereGeometry(.025,6,4), mat(0xffffff,{emissive:0xffffff}));
          const a=rand(-1.3,1.3), y=rand(y0+.1,y1-.05);
          st.position.set(Math.sin(a)*bodyR(y)*sc,y,Math.cos(a)*bodyR(y)*sc); g.add(st); } }
      }
    }
    if(m.type==='pants'){
      const y0=(ACTIVE_PROFILE&&ACTIVE_PROFILE.pantBottom)!=null?ACTIVE_PROFILE.pantBottom:.26,
            y1=(ACTIVE_PROFILE&&ACTIVE_PROFILE.pantTop)!=null?ACTIVE_PROFILE.pantTop:.62,
            sc=(ACTIVE_PROFILE&&ACTIVE_PROFILE.pantScale)!=null?ACTIVE_PROFILE.pantScale:1.05;
      const p=new THREE.Mesh(profileSlice(y0,y1,sc), MM(m.c)); p.material.side=THREE.DoubleSide; g.add(p);
      if(ACTIVE_PROFILE&&ACTIVE_PROFILE.pantTrim!=null){
        const TM=MM(ACTIVE_PROFILE.pantTrim);
        const tr=(ACTIVE_PROFILE.pantTrimR!=null)?ACTIVE_PROFILE.pantTrimR:.035;
        const hem=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.05,bodyR(y0)*sc),tr,10,32), TM);
        hem.rotation.x=Math.PI/2; hem.position.y=y0; g.add(hem);
        const waist=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.05,bodyR(y1)*sc),tr*.85,10,32), TM);
        waist.rotation.x=Math.PI/2; waist.position.y=y1; g.add(waist);
      }
    }
    if(m.type==='shoes'){
      if(!(ACTIVE_PROFILE&&ACTIVE_PROFILE.shoes==='hide')){
        for(const s of [-1,1]){ const f=parts['foot'+s]; f.material=MM(m.c); f.userData.base=false; f.children.forEach(c=>c.visible=false);
          const sole=new THREE.Mesh(new THREE.SphereGeometry(1,24,10,0,Math.PI*2,Math.PI/2,Math.PI/2), MM(0xffffff));
          sole.scale.set(1.06,1.1,1.06); f.add(sole); }
      }
    }
    if(m.type==='bracelet'){ for(const s of [-1,1]){ const b=new THREE.Mesh(new THREE.TorusGeometry(.135,.035,10,24), MM(m.c)); b.rotation.x=Math.PI/2; b.position.set(0,-.1,0); parts['arm'+s].add(b);} }
    if(m.type==='gloves'){ for(const s of [-1,1]){ const h=new THREE.Mesh(new THREE.SphereGeometry(.15,18,12), MM(m.c)); h.position.set(0,-.2,0); parts['arm'+s].add(h);} }
  }
}
function rainbowMat(){ const c=document.createElement('canvas'); c.width=8; c.height=64; const g=c.getContext('2d'); ['#ff4f6d','#ff9a1f','#ffd52e','#5be04a','#2bc0ff','#9b5bff'].forEach((col,i)=>{ g.fillStyle=col; g.fillRect(0,i*64/6,8,64/6+1); }); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({map:t,roughness:.7}); }
function heartShape(){ const s=new THREE.Shape(); s.moveTo(0,-.6); s.bezierCurveTo(-.9,0,-.7,.8,0,.35); s.bezierCurveTo(.7,.8,.9,0,0,-.6); return s; }
function starShape(){ const s=new THREE.Shape(); for(let i=0;i<10;i++){ const r=i%2?.32:.7, a=i/10*Math.PI*2+Math.PI/2; const x=Math.cos(a)*r,y=Math.sin(a)*r; i?s.lineTo(x,y):s.moveTo(x,y);} return s; }
installAccessoriesV2({ getProfile:()=>ACTIVE_PROFILE });
const addEquipment = wrapAddEquipment(addEquipmentOriginal, IMAP);
installOllieV2({ CMAP, isPlayable, dressSpecies, addEquipment, getSave:()=>S, setProfile:P=>{ ACTIVE_PROFILE=P; } });
setOllieVariant('C');
function buildOllie(opts){ return buildOllieV2(opts); }
function animateOllie(o, speed, dt, t){ animateChar(o, 'move', speed, dt, t); tickAccessories(o, dt, t); }
function animateOllieLegacy(o, speed, dt, t){
  const p=o.userData.parts, rig=p.rig; o.userData.walk += dt*speed*2.6;
  const w=o.userData.walk; const target=Math.min(1,speed/4); o.userData.amt = (o.userData.amt||0) + (target-(o.userData.amt||0))*Math.min(1,dt*8); const amt=o.userData.amt;
  const idle = 1-amt;
  rig.rotation.z = Math.sin(w)*.1*amt;                       // waddle
  rig.rotation.x = .16*amt + Math.sin(w*2)*.03*amt;          // lean into the run
  const bob = Math.abs(Math.sin(w))*.11*amt + Math.sin(t*2.4)*.025*idle;
  rig.position.y = bob; o.position.y = (o.userData.baseY||0);
  const sq = 1 + Math.sin(t*2.4)*.015*idle - Math.abs(Math.cos(w))*.04*amt; rig.scale.set(1/Math.sqrt(sq), sq, 1/Math.sqrt(sq));
  for(const s of [-1,1]){ const f=p['foot'+s]; const ph = s<0? Math.sin(w) : -Math.sin(w);
    f.position.z = .12 + ph*.22*amt; f.position.y = .07 + Math.max(0,Math.cos(w + (s<0?0:Math.PI)))*.12*amt; f.rotation.x = -ph*.4*amt;
    p['sh'+s].rotation.x = -ph*.9*amt + Math.sin(t*2.4+s)*.04*idle; p['sh'+s].rotation.z = (.15 + .2*amt)*s; }
  p.tail.rotation.y = Math.sin(w*.5+t*2)*.25;
  p.head.rotation.z = Math.sin(t*1.2)*.04*idle;
}

/* ===================== 3D ITEM THUMBNAILS ===================== */
// Each accessory is rendered from its real in-game mesh (built on Ollie, body hidden) to a transparent PNG, cached per item.
const THUMBS = {}; let thumbScene=null;
function ensureThumbScene(){
  if(thumbScene) return;
  thumbScene=new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff,0x6a7aa8,1.5));
  const d=new THREE.DirectionalLight(0xffffff,2.2); d.position.set(3,5,6); thumbScene.add(d);
  const f=new THREE.DirectionalLight(0x9fd8ff,.8); f.position.set(-4,2,-3); thumbScene.add(f);
}
function disposeThumbR(){ /* thumbs now use the main renderer — no second WebGL context to dispose */ }
function captureThumb(cam, size=224){
  const rt=new THREE.WebGLRenderTarget(size, size, { depthBuffer:true });
  try{ if(rt.texture) rt.texture.colorSpace=THREE.SRGBColorSpace; }catch(e){}
  const prevRT=renderer.getRenderTarget();
  const prevColor=new THREE.Color(); renderer.getClearColor(prevColor);
  const prevAlpha=renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(thumbScene, cam);
  const buf=new Uint8Array(size*size*4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha); rt.dispose();
  const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
  const img=ctx.createImageData(size, size);
  for(let y=0;y<size;y++) img.data.set(buf.subarray((size-1-y)*size*4, (size-y)*size*4), y*size*4);
  ctx.putImageData(img,0,0);
  return c.toDataURL('image/png');
}
function itemThumb(it){
  if(THUMBS[it.id]!==undefined) return THUMBS[it.id];
  try{
    ensureThumbScene();
    const o=buildOllie({ charId:'ollie', equipped:{ [it.slot]:it.id } }); o.updateMatrixWorld(true);
    const P=o.userData.parts, mannequin = (it.slot==='top'||it.slot==='bottom') ? new Set([P.body, P['arm-1'], P.arm1]) : null; const manMat=new THREE.MeshStandardMaterial({ color:0xe9eef8, roughness:.8, transparent:true, opacity:.42, depthWrite:false });
    const box=new THREE.Box3(); o.traverse(m=>{ if(!m.isMesh) return; if(m.userData.base){ if(mannequin && mannequin.has(m)){ m.material=manMat; m.renderOrder=-1; return; } m.layers.set(1); return; } m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
    if(box.isEmpty()){ THUMBS[it.id]=null; return null; }
    thumbScene.add(o); const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3()); const r=Math.max(sz.x,sz.y,sz.z)*.54+.03;
    const cam=new THREE.PerspectiveCamera(28,1,.01,50); const dir=new THREE.Vector3(.62,.38,1).normalize(); cam.position.copy(c).addScaledVector(dir, r/Math.sin(THREE.MathUtils.degToRad(14))); cam.lookAt(c);
    THUMBS[it.id]=captureThumb(cam);
    thumbScene.remove(o); o.traverse(m=>{ if(m.isMesh){ if(!m.geometry.userData.shared && !Object.values(ollieGeos()).includes(m.geometry)) m.geometry.dispose(); } });
  }catch(e){ console.warn('thumb failed', it.id, e); THUMBS[it.id]=null; }
  return THUMBS[it.id];
}
function lookKey(charId, eq){ return (charId||'ollie')+'|'+Object.keys(eq||{}).sort().map(s=>s+':'+(eq[s]||'')).join(','); }
const LOOK_THUMBS = {};
function lookThumb(charId, eq){
  const key=lookKey(charId, eq); if(LOOK_THUMBS[key]!==undefined) return LOOK_THUMBS[key];
  try{
    ensureThumbScene();
    const o=buildOllie({ charId: charId||'ollie', equipped: eq||{} }); o.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty()){ LOOK_THUMBS[key]=null; return null; }
    thumbScene.add(o);
    const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
    const r=Math.max(sz.x,sz.y,sz.z)*.52+.04;
    const cam=new THREE.PerspectiveCamera(28,1,.01,50); const dir=new THREE.Vector3(.45,.28,1).normalize();
    cam.position.copy(c).addScaledVector(dir, r/Math.sin(THREE.MathUtils.degToRad(14))); cam.lookAt(c.x, c.y+sz.y*.04, c.z);
    LOOK_THUMBS[key]=captureThumb(cam);
    thumbScene.remove(o); o.traverse(m=>{ if(m.isMesh){ if(!m.geometry.userData.shared && !Object.values(ollieGeos()).includes(m.geometry)) m.geometry.dispose(); } });
  }catch(e){ console.warn('look thumb failed', charId, e); LOOK_THUMBS[key]=null; }
  return LOOK_THUMBS[key];
}
function warmLookThumbs(rows){ for(const r of rows) lookThumb(r.char, r.eq); disposeThumbR(); }
function warmThumbs(){ RARITIES.forEach(R=>{ const i=new Image(); i.src=artUrl('chest-'+R.id); }); if(isAppleTouch) return; /* iPad: don't build dozens of 32k-tri models at boot; thumbs render lazily on the main context */ try{ for(const it of ITEMS) itemThumb(it); }catch(e){} }

/* ===================== RARITY FILTER CHIPS ===================== */
function effFilter(key, list){ const f=(S.filters||{})[key]||'all'; return f==='all'||list.some(x=>x.r===f)? f : 'all'; }
function filterChips(key, list, ownedFn){ const cur=effFilter(key, list); const cnt=t=>{ const l=t==='all'?list:list.filter(x=>x.r===t); return `${l.filter(ownedFn).length}/${l.length}`; };
  return `<div class="chips">${['all',...RARITIES.map(R=>R.id)].filter(t=>t==='all'||list.some(x=>x.r===t)).map(t=>{ const R=RMAP[t]; const bg=t==='all'?'#2b7fe0':t==='cosmic'?'linear-gradient(90deg,#7b5cff,#00a8d8,#c84fb8)':R.color;
    return `<button class="chip ${t===cur?'on':''} ${t==='ultra'||t==='common'?'lite':''}" data-chip="${t}" style="background:${bg}">${t==='all'?'All':R.name} <b>${cnt(t)}</b></button>`; }).join('')}</div>`; }
function applyFilter(key, list){ const cur=effFilter(key, list); return cur==='all'? list : list.filter(x=>x.r===cur); }
function bindChips(key, rerender){ $$('#panelBody [data-chip]').forEach(b=>b.onclick=()=>{ SFX.click(); S.filters=S.filters||{}; S.filters[key]=b.dataset.chip; save(); rerender(); }); }

/* ===================== DECOR ===================== */
const CORAL_COLS = [0xff5fa8,0xb54cff,0xff7ac6,0x8f3fe0,0xff4f8b,0xd25cff,0x7a47e8];
const CHEST_TEX={};
function getChestTex(r){ if(!CHEST_TEX[r]){ const t=new THREE.TextureLoader().load(artUrl('chest-'+r)); t.colorSpace=THREE.SRGBColorSpace; CHEST_TEX[r]=t; } return CHEST_TEX[r]; }
function makeChest(rarity='legendary'){
  const R=RMAP[rarity]; const g=new THREE.Group();
  const matC=new THREE.MeshBasicMaterial({ map:getChestTex(rarity), toneMapped:false });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.75,1.75), matC); plane.position.y=.95; g.add(plane);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(1.75,1.75), new THREE.MeshBasicMaterial({ color:new THREE.Color(R.c2), toneMapped:false })); back.position.y=.95; back.rotation.y=Math.PI; g.add(back);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.62,24), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.32, depthWrite:false })); shadow.rotation.x=-Math.PI/2; shadow.position.y=.02; g.add(shadow);
  const light=new THREE.PointLight(new THREE.Color(R.color), 6, 9, 1.5); light.position.set(0,1.6,0); g.add(light);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:SPARK_TEX,color:new THREE.Color(R.color),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); glow.scale.set(3.2,3.2,1); glow.position.y=.9; g.add(glow); g.userData.glow=glow; g.userData.lid=plane;
  return g;
}
function starfishShape(){ const s=new THREE.Shape(), tipR=.2, tipD=.8, valR=.32; const tip=i=>{ const a=Math.PI/2+i*2*Math.PI/5; return {a, x:Math.cos(a)*tipD, y:Math.sin(a)*tipD}; };
  for(let i=0;i<5;i++){ const t=tip(i), n=tip(i+1); if(i===0) s.moveTo(t.x+Math.cos(t.a-Math.PI/2)*tipR, t.y+Math.sin(t.a-Math.PI/2)*tipR);
    s.absarc(t.x,t.y,tipR,t.a-Math.PI/2,t.a+Math.PI/2,false); const va=t.a+Math.PI/5; s.quadraticCurveTo(Math.cos(va)*valR,Math.sin(va)*valR, n.x+Math.cos(n.a-Math.PI/2)*tipR, n.y+Math.sin(n.a-Math.PI/2)*tipR); }
  return s; }
const STARFISH_GEO = new THREE.ExtrudeGeometry(starfishShape(), { depth:.14, bevelEnabled:true, bevelThickness:.16, bevelSize:.12, bevelSegments:5, curveSegments:10 }); STARFISH_GEO.center(); 
const STARFISH_MAT = mat(0xffa424,{rough:.4,metal:.1,emissive:0x8a3a00,ei:.6});
const STAR_DOT_MAT = mat(0xffd36a,{rough:.5,emissive:0x553300,ei:.4});
const STAR_DOT_GEO = new THREE.SphereGeometry(.07,8,6);
const STAR_EYE_GEO = new THREE.SphereGeometry(.07,10,8), STAR_EYE_MAT = mat(0x111111,{rough:.2});
const STAR_SMILE_GEO = new THREE.TorusGeometry(.09,.022,6,14,Math.PI);
const COIN_GEO = STARFISH_GEO, COIN_EDGE = STAR_DOT_GEO; // shared geometries kept out of disposal
function makeCoin(){ // a cute chunky starfish collectible
  const c=new THREE.Group(); const body=new THREE.Group(); c.add(body);
  body.add(new THREE.Mesh(STARFISH_GEO, STARFISH_MAT));
  const fz=.23; for(let i=0;i<5;i++){ const a=Math.PI/2+i*2*Math.PI/5; for(const d of [.38,.6]){ for(const z of [fz,-fz]){ const dot=new THREE.Mesh(STAR_DOT_GEO, STAR_DOT_MAT); dot.position.set(Math.cos(a)*d,Math.sin(a)*d,z*(d>.5?.85:.95)); dot.scale.setScalar(d>.5?.8:1); body.add(dot);} } }
  for(const z of [1,-1]){ for(const s of [-1,1]){ const e=new THREE.Mesh(STAR_EYE_GEO, STAR_EYE_MAT); e.position.set(.12*s,.06,fz*z+.01*z); body.add(e);} const sm=new THREE.Mesh(STAR_SMILE_GEO, STAR_EYE_MAT); sm.rotation.z=Math.PI; sm.position.set(0,-.08,fz*z+.005*z); if(z<0) sm.rotation.y=Math.PI; body.add(sm); }
  body.scale.setScalar(.62);
  const tw=new THREE.Sprite(new THREE.SpriteMaterial({map:SPARK_TEX,color:0xffd36a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0})); tw.scale.setScalar(.6); tw.position.set(.3,.35,.2); c.add(tw); c.userData.tw=tw;
  c.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return c; }

/* ===================== SPARKLES ===================== */
const sparkles=[];
function spawnSparkles(scene, pos, color=0xffe066, n=10){ for(let i=0;i<n;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:SPARK_TEX,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); s.position.copy(pos); s.scale.setScalar(.5); s.userData.v=new THREE.Vector3(rand(-2,2),rand(1.5,4),rand(-2,2)); s.userData.life=rand(.4,.8); scene.add(s); sparkles.push(s);} }
function updateSparkles(dt){ for(let i=sparkles.length-1;i>=0;i--){ const s=sparkles[i]; s.userData.life-=dt; s.position.addScaledVector(s.userData.v,dt); s.userData.v.y-=5*dt; s.material.opacity=Math.max(0,s.userData.life*1.6); if(s.userData.life<=0){ s.parent&&s.parent.remove(s); s.material.dispose(); sparkles.splice(i,1);} } }

/* ===================== QUALITY ===================== */
let autoLow=false;
function isLow(){ return S.quality==='low' || ((S.quality||'auto')==='auto' && autoLow); }
function applyQuality(){ const low=isLow(); renderer.setPixelRatio(Math.min(devicePixelRatio||1, maxPixelRatio())); for(const sc of [lobby.scene, G.scene]) if(sc) sc.traverse(o=>{ if(o.isDirectionalLight && o.userData.main) o.castShadow=!low; if(o.userData.isRays) o.visible=!low; }); resize(); }
buildCoralGeos(S.quality==='low'); buildMats();
const ROCK_COLS=[0x6b6fa8,0x5a6b9a,0x7a6fa8,0x5f5a94];
function reefCluster(inst, chunk, x, z, s=1, pal=CORAL_PAL.pinkPurple, n=4, rock=true){
  if(rock) inst.add('rock', chunk, mtx(x, s*.15, z, s*rand(.7,1), s*rand(.6,.9), s*rand(.7,1), 0, rand(0,6), 0), pick(ROCK_COLS));
  for(let i=0;i<n;i++){ const r=Math.random(); const type=r<.3?'finger':r<.55?'branch':r<.7?'tube':r<.85?'brain':'fan'; const a=rand(0,Math.PI*2), d=rand(0,.9)*s; const k=s*rand(.9,1.6);
    inst.add(type, chunk, mtx(x+Math.cos(a)*d, rock? s*.35*rand(.3,1):0, z+Math.sin(a)*d, k, k*(type==='finger'?rand(1,1.5):1), k, 0, rand(0,6), 0), Math.random()<.85?pick(pal):pick(CORAL_PAL.accent)); }
}

/* ===================== LOBBY SCENE ===================== */
const lobby = { scene:new THREE.Scene(), ollie:null, t:0 };
(function buildLobby(){
  const sc=lobby.scene; sc.background=gradientBg('#6fdcff','#0b56a8'); sc.fog=new THREE.Fog(0x2a90d8, 12, 46);
  setupVisionScene(sc, renderer);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(70,64), sandMaterial(16)); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; sc.add(floor);
  // Zharacters V2 stone pedestal (flagstones + pebbles); shop uses a shorter top so the character sits on it
  lobby.pedestal=buildPedestal({ top: .52 }); sc.add(lobby.pedestal);
  const inst=new Instancer();
  for(let i=0;i<9;i++){ const a=rand(-.4,Math.PI+.4); kelp(inst,'p', Math.cos(a)*2.05, 0, Math.sin(a)*2.05+.2, rand(.45,.8)); }
  // reef behind and around
  for(let i=0;i<34;i++){ const a=rand(Math.PI*1.05,Math.PI*1.95), d=rand(4.5,13); reefCluster(inst, 'b'+(i%6), Math.cos(a)*d, Math.sin(a)*d-1, rand(.9,1.8), Math.random()<.7?CORAL_PAL.pinkPurple:CORAL_PAL.warm, 5); }
  for(const sx of [-1,1]) for(let i=0;i<6;i++) reefCluster(inst, 'f'+sx, sx*rand(5,9), rand(-1,4), rand(.8,1.4), CORAL_PAL.pinkPurple, 5);
  for(let i=0;i<46;i++){ const a=rand(Math.PI*1.02,Math.PI*1.98), d=rand(5,16); kelp(inst,'k'+(i%4), Math.cos(a)*d, 0, Math.sin(a)*d-2, rand(3,7)); }
  for(let i=0;i<10;i++) inst.add('rock','r', mtx(rand(-18,18),0,rand(-22,-9), rand(2,4),rand(1.5,3.5),rand(2,4),0,rand(0,6),0), pick(ROCK_COLS));
  inst.build(sc);
  farReef(sc, 30, 36);
  const rays=godRays(11, 9); rays.position.set(0,0,-5); rays.userData.isRays=true; sc.add(rays); lobby.rays=rays;
  lobby.bubbles=makeBubbles(sc,70,10,10); specks(sc,250,14,9);
})();
function setLobbyOllie(){ if(lobby.ollie) lobby.scene.remove(lobby.ollie);
  const shop=viewOffsetMode==='shop';
  const opts = shop ? { charId:shopChar(), equipped:shopEq() } : {};
  if(lobby.pedestal) lobby.scene.remove(lobby.pedestal);
  lobby.pedestal=buildPedestal({ top: shop?.28:.52 }); lobby.scene.add(lobby.pedestal);
  lobby.ollie=buildOllie(opts);
  lobby.ollie.userData.baseY=shop?.28:.52; lobby.ollie.position.y=lobby.ollie.userData.baseY; lobby.ollie.scale.setScalar(shop?1.12:1.6); lobby.scene.add(lobby.ollie);
  addBlobShadow(lobby.ollie); captureLobbyRestBox(); invalidateLobbyFrame(); triggerAnim(lobby.ollie, 'wave'); }
let viewOffsetMode=null;
let shopTryOn=null; // {kind:'item',id} | {kind:'char',id} | {kind:'look',name,char,eq}
function shopChar(){ if(shopTryOn && shopTryOn.kind==='char' && isPlayable(shopTryOn.id)) return shopTryOn.id; return S.selChar; }
function shopEq(){ if(shopTryOn && shopTryOn.kind==='look') return { ...(shopTryOn.eq||{}) }; const eq={ ...(S.equipped||{}) }; if(shopTryOn && shopTryOn.kind==='item'){ const it=IMAP[shopTryOn.id]; if(it) eq[it.slot]=it.id; } return eq; }
function updateViewOffset(){ const w=innerWidth,h=innerHeight; if(viewOffsetMode==='closet') camera.setViewOffset(w,h,w*.3,0,w,h); else if(viewOffsetMode==='shop'){ const left=w>=900 && h>430 ? (w>=1100 && h>=640?0.24:0.25) : 0.22; camera.setViewOffset(w,h,w*(0.50-left*0.48),h*.08,w,h); } else camera.clearViewOffset(); }

/* ===================== GAME STATE ===================== */
const G = { mode:null, scene:null, player:null, yaw:0, pitch:.9, camDist:9.5, vel:new THREE.Vector3(), coins:[], collected:0, time:0, running:false, paused:false, dashT:0, dashCd:0, jellies:[], weeds:[] };
const keys = {};
const joy = { x:0, y:0, active:false, id:null };

function disposeScene(sc){ if(!sc) return; sc.traverse(o=>{ if(o.geometry && !o.geometry.userData.shared && ![STARFISH_GEO,STAR_DOT_GEO,STAR_EYE_GEO,STAR_SMILE_GEO].includes(o.geometry)) o.geometry.dispose(); }); }
function baseGameScene(){ disposeScene(G.scene); const sc=new THREE.Scene(); sc.background=gradientBg('#5fd0ff','#0b56a8'); sc.fog=new THREE.Fog(0x2489d4, 16, 62); G.sun=addLights(sc); G.scene=sc; G.rays=null; G.coins=[]; G.jellies=[]; G.weeds=[]; G.collected=0; G.time=0; G.dashT=0; G.dashCd=0; G.vel.set(0,0,0); G.hitCd=0; G.guide=null; G.exitDist=null; G.lostHelp=false; G.wrongT=0; G.wrongShown=false; return sc; }
function spawnPlayer(x,z,yaw){ G.player=buildOllie(); G.player.position.set(x,0,z); G.player.rotation.y=yaw; G.yaw=yaw; G.pitch=.9; G.scene.add(G.player); }

/* ---------- MAZE ---------- */
const TILE=3.4; // wide paths so kids can see where they're going
function genMaze(n){
  const T=2*n+1, grid=Array.from({length:T},()=>Array(T).fill(1));
  const vis=Array.from({length:n},()=>Array(n).fill(false)); const st=[[0,0]]; vis[0][0]=true; grid[1][1]=0;
  while(st.length){ const [cx,cy]=st[st.length-1]; const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[cx+dx,cy+dy,dx,dy]).filter(([x,y])=>x>=0&&y>=0&&x<n&&y<n&&!vis[x][y]);
    if(!nb.length){ st.pop(); continue; } const [nx,ny,dx,dy]=pick(nb); vis[nx][ny]=true; grid[2*cx+1+dx][2*cy+1+dy]=0; grid[2*nx+1][2*ny+1]=0; st.push([nx,ny]); }
  // extra loops on bigger mazes so it's less punishing for kids
  const loops=Math.floor(n*n*.06); for(let i=0;i<loops;i++){ const x=1+Math.floor(Math.random()*(T-2)), y=1+Math.floor(Math.random()*(T-2)); if(grid[x][y]===1 && ((x%2===1&&y%2===0)||(x%2===0&&y%2===1))) grid[x][y]=0; }
  // BFS distances from start
  const dist=Array.from({length:T},()=>Array(T).fill(-1)); const q=[[1,1]]; dist[1][1]=0; let far=[1,1];
  while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const a=x+dx,b=y+dy; if(grid[a][b]===0&&dist[a][b]<0){ dist[a][b]=dist[x][y]+1; q.push([a,b]); if(a%2&&b%2&&dist[a][b]>dist[far[0]][far[1]]) far=[a,b]; } } }
  return { grid, T, dist, exit:far };
}
// Zinigames: gentler growth (5,6,8,9,11,12,14,15,17,18,20,21…) instead of +2 cells per level; old curve was 3+level*2.
function mazeSize(level){ return Math.min(21, 5 + Math.floor((Math.max(1,level)-1)*1.5)); }
function tileToWorld(i,j,T){ return new THREE.Vector3((i-T/2+.5)*TILE, 0, (j-T/2+.5)*TILE); }
function startMaze(level){ viewOffsetMode=null; updateViewOffset();
  const sc=baseGameScene(); G.mode='maze'; G.level=level; const low=isLow(); const dens=low?.55:1;
  const n=mazeSize(level); const mz=genMaze(n); G.maze=mz; const {grid,T}=mz;
  const half=T*TILE/2;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(T*TILE+90,T*TILE+90), sandMaterial(Math.round((T*TILE+90)/7))); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; sc.add(floor);
  const pal = level%3===1 ? CORAL_PAL.pinkPurple : level%3===2 ? CORAL_PAL.warm : CORAL_PAL.cool;
  const inst=new Instancer(); const CH=8; const ck=(i,j)=>`${Math.floor(i/CH)},${Math.floor(j/CH)}`;
  for(let i=0;i<T;i++) for(let j=0;j<T;j++) if(grid[i][j]){ const p=tileToWorld(i,j,T); const bh=rand(.5,.78); const W=(a,b)=>a<0||b<0||a>=T||b>=T||grid[a][b]===1, e=.56*TILE, n=.4*TILE;
    coralHedge(inst, ck(i,j), p.x, p.z, TILE*.84, bh*.8, pal, dens, .8, [W(i-1,j)?-e:-n, W(i+1,j)?e:n, W(i,j-1)?-e:-n, W(i,j+1)?e:n]);
    if(Math.random()<(low?.05:.11)) kelp(inst, ck(i,j), p.x+rand(-.7,.7), bh*.8-.1, p.z+rand(-.7,.7), rand(2.0,3.6)); }
  // floor detail: shells, pebbles, small sprigs on paths
  const paths=[]; for(let i=1;i<T-1;i++) for(let j=1;j<T-1;j++) if(!grid[i][j] && !(i===1&&j===1) && !(i===mz.exit[0]&&j===mz.exit[1])) paths.push([i,j]);
  for(const [i,j] of paths){ const p=tileToWorld(i,j,T); if(Math.random()<.35) inst.add('shell', ck(i,j), mtx(p.x+rand(-1.1,1.1),.02,p.z+rand(-1.1,1.1),rand(.8,1.3),1,rand(.8,1.3),0,rand(0,6),0), pick([0xffd1dc,0xfff1e0,0xffb38a,0xfff7c2]));
    if(Math.random()<.3) inst.add('rock', ck(i,j), mtx(p.x+rand(-1.1,1.1),.03,p.z+rand(-1.1,1.1),rand(.1,.2),rand(.08,.14),rand(.1,.2),0,rand(0,6),0), pick([0x9a96b8,0x8b8fb5,0xb8a890])); }
  // outside the maze: big reef, rocks, kelp forest
  const ring=(cnt, dmin, dmax, f)=>{ for(let i=0;i<cnt;i++){ const a=rand(0,Math.PI*2), d=half+rand(dmin,dmax); f(Math.cos(a)*d, Math.sin(a)*d, i); } };
  ring(Math.round(70*dens), 3.5, 13, (x,z,i)=>reefCluster(inst,'o'+(i%12),x,z,rand(1.2,2.4),pal,5));
  ring(Math.round(70*dens), 2, 20, (x,z,i)=>kelp(inst,'ok'+(i%8),x,0,z,rand(3.5,8)));
  ring(16, 14, 28, (x,z)=>inst.add('rock','or', mtx(x,0,z,rand(2,5),rand(1.5,4),rand(2,5),0,rand(0,6),0), pick(ROCK_COLS)));
  inst.build(sc, {receive:true});
  farReef(sc, half+26, 44);
  const rays=godRays(12, 13); rays.userData.isRays=true; rays.visible=!low; sc.add(rays); G.rays=rays;
  // starfish on path tiles
  const nCoins=Math.min(paths.length, Math.round(6+n*n*.45));
  [...paths].sort(()=>Math.random()-.5).slice(0,nCoins).forEach(([i,j])=>{ const c=makeCoin(); const p=tileToWorld(i,j,T); c.position.set(p.x,.8,p.z); c.userData.ph=rand(0,6); sc.add(c); G.coins.push(c); });
  // exit: stone archway + glowing chest
  const ex=tileToWorld(mz.exit[0],mz.exit[1],T); const chest=makeChest('legendary'); chest.position.copy(ex); sc.add(chest); G.chest=chest;
  const arch=archway(); arch.position.copy(ex); sc.add(arch);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(!grid[mz.exit[0]+dx][mz.exit[1]+dy]){ chest.rotation.y=Math.atan2(dx,dy); arch.rotation.y=chest.rotation.y; break; }
  // jellyfish obstacles from level 4 (Zinigames follow-up: levels 1-3 stay jelly-free)
  const nJ=Math.max(0,Math.min(8,level-3)); for(let k=0;k<nJ;k++){ const [i,j]=pick(paths.filter(([a,b])=>mz.dist[a][b]>6)); const jf=makeJelly(); const p=tileToWorld(i,j,T); jf.position.set(p.x,1.1,p.z); const horiz = !grid[i+1][j]||!grid[i-1][j]; jf.userData.dir = horiz? new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1); jf.userData.ph=rand(0,6); sc.add(jf); G.jellies.push(jf);} 
  G.bubbles=makeBubbles(sc,low?70:150,half+6,12); specks(sc, low?150:400, half+8, 9);
  const s=tileToWorld(1,1,T); let yaw=0; if(!grid[2][1]) yaw=Math.PI/2; else yaw=0; spawnPlayer(s.x,s.z,yaw);
  G.spawn=s.clone(); G.exitDist=bfsFrom(grid,T,mz.exit); G.guide=makeGuideArrow(); sc.add(G.guide); G.lostHelp=false;
  setupMinimap();
  beginRun(`LEVEL ${level}`);
}
// Zinigames: BFS distances from a tile (used to point the 'lost helper' arrow along the real path to the chest)
function bfsFrom(grid,T,[sx,sy]){ const d=Array.from({length:T},()=>Array(T).fill(-1)); const q=[[sx,sy]]; d[sx][sy]=0; for(let h=0;h<q.length;h++){ const [x,y]=q[h]; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const a=x+dx,b=y+dy; if(a>=0&&b>=0&&a<T&&b<T&&grid[a][b]===0&&d[a][b]<0){ d[a][b]=d[x][y]+1; q.push([a,b]); } } } return d; }
// Zinigames: chunky golden ground arrow that circles Ollie and points where to go (maze helper + race checkpoints)
function makeGuideArrow(){ const s=new THREE.Shape(); s.moveTo(0,.75); s.lineTo(.55,.1); s.lineTo(.22,.1); s.lineTo(.22,-.55); s.lineTo(-.22,-.55); s.lineTo(-.22,.1); s.lineTo(-.55,.1); s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1}); geo.rotateX(-Math.PI/2); geo.rotateY(Math.PI);
  const m=new THREE.Mesh(geo, mat(0xffd52e,{emissive:0xffa000,ei:.7})); m.scale.setScalar(1.1); const g=new THREE.Group(); g.add(m); g.visible=false; g.userData.vis=0; return g; }
function updateGuide(P, tx, tz, show, t, dt){ const g=G.guide; if(!g) return; g.userData.vis += ((show?1:0)-g.userData.vis)*Math.min(1,dt*6); g.visible=g.userData.vis>.03; if(!g.visible) return;
  const a=Math.atan2(tx-P.position.x, tz-P.position.z), r=1.8+Math.sin(t*6)*.12; g.position.set(P.position.x+Math.sin(a)*r, .12, P.position.z+Math.cos(a)*r); g.rotation.y=a; g.scale.setScalar(g.userData.vis); }
function makeJelly(){ const g=new THREE.Group(); const c=pick([0xff8fd8,0xb98cff,0x7fe8ff]); const bell=new THREE.Mesh(new THREE.SphereGeometry(.45,18,12,0,Math.PI*2,0,Math.PI/2), mat(c,{opacity:.75,emissive:c,ei:.3})); g.add(bell); for(let i=0;i<5;i++){ const t=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.5,3,5), mat(c,{opacity:.7})); const a=i/5*Math.PI*2; t.position.set(Math.cos(a)*.25,-.3,Math.sin(a)*.25); g.add(t);} for(const s of [-1,1]){ const e=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6), mat(0x111111)); e.position.set(.15*s,.18,.4); g.add(e);} return g; }
function isWall(x,z){ const mz=G.maze; if(!mz) return false; const i=Math.floor(x/TILE+mz.T/2), j=Math.floor(z/TILE+mz.T/2); if(i<0||j<0||i>=mz.T||j>=mz.T) return true; return mz.grid[i][j]===1; }
function collideMaze(p, r){
  const mz=G.maze, T=mz.T; for(let it=0;it<2;it++){
  const ci=Math.floor(p.x/TILE+T/2), cj=Math.floor(p.z/TILE+T/2);
  for(let i=ci-1;i<=ci+1;i++) for(let j=cj-1;j<=cj+1;j++){ if(i<0||j<0||i>=T||j>=T|| mz.grid[i][j]===0) continue;
    const minx=(i-T/2)*TILE, minz=(j-T/2)*TILE; const qx=Math.max(minx,Math.min(p.x,minx+TILE)), qz=Math.max(minz,Math.min(p.z,minz+TILE)); const dx=p.x-qx, dz=p.z-qz; const d2=dx*dx+dz*dz;
    if(d2<r*r){ const d=Math.sqrt(d2)||.0001; p.x+=dx/d*(r-d); p.z+=dz/d*(r-d); } } }
}

/* ---------- RACE ---------- */
const RA=34, RB=20, LAPS=2, NCP=8;
function ellE(x,z){ return Math.sqrt((x/RA)**2+(z/RB)**2); }
function startRace(){ viewOffsetMode=null; updateViewOffset();
  const sc=baseGameScene(); G.mode='race'; G.level=1; G.maze=null; const low=isLow(); const dens=low?.55:1;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(220,220), sandMaterial(30)); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; sc.add(floor);
  const shape=new THREE.Shape(); const hole=new THREE.Path(); const N=120;
  for(let i=0;i<=N;i++){ const t=i/N*Math.PI*2; const x=Math.cos(t)*RA*1.17, y=Math.sin(t)*RB*1.17; i?shape.lineTo(x,y):shape.moveTo(x,y); const hx=Math.cos(t)*RA*.83, hy=Math.sin(t)*RB*.83; i?hole.lineTo(hx,hy):hole.moveTo(hx,hy); }
  shape.holes.push(hole); const tm=patch(new THREE.MeshStandardMaterial({color:0xfff0cc, map:sandMaterial(1).map, roughness:1}),{caustic:.9}); tm.map.repeat.set(.12,.12);
  const track=new THREE.Mesh(new THREE.ShapeGeometry(shape,64), tm); track.rotation.x=-Math.PI/2; track.position.y=.02; track.receiveShadow=true; sc.add(track);
  const inst=new Instancer(); const pal=CORAL_PAL.pinkPurple;
  const nb=Math.round(150*dens);
  for(let i=0;i<nb;i++){ const t=i/nb*Math.PI*2; for(const e of [.77,1.23]){ const x=Math.cos(t)*RA*e, z=Math.sin(t)*RB*e; const ch='r'+Math.floor(i/(nb/12))+e; inst.add('base', ch, mtx(x,.3,z,1.5,.6,1.5,0,t,0), pick([0x5b3f8f,0x6a4a9e]));
    const k=Math.random(); const type=k<.4?'finger':k<.6?'branch':k<.75?'tube':k<.9?'brain':'fan'; const s=rand(1,1.6); inst.add(type, ch, mtx(x+rand(-.4,.4),.55,z+rand(-.4,.4),s,s,s,0,rand(0,6),0), Math.random()<.85?pick(pal):pick(CORAL_PAL.accent)); } }
  for(let i=0;i<Math.round(40*dens);i++){ const t=rand(0,Math.PI*2), e=rand(.15,.65); reefCluster(inst,'i'+(i%6),Math.cos(t)*RA*e,Math.sin(t)*RB*e,rand(1.2,2.4),Math.random()<.5?pal:CORAL_PAL.warm,5); }
  for(let i=0;i<Math.round(50*dens);i++){ const t=rand(0,Math.PI*2), e=Math.random()<.5?rand(.2,.66):rand(1.32,2.1); kelp(inst,'k'+(i%8),Math.cos(t)*RA*e,0,Math.sin(t)*RB*e,rand(3,7)); }
  for(let i=0;i<Math.round(40*dens);i++){ const t=rand(0,Math.PI*2), e=rand(1.35,2.2); reefCluster(inst,'o'+(i%8),Math.cos(t)*RA*e,Math.sin(t)*RB*e,rand(1.5,3),CORAL_PAL.cool,5); }
  inst.build(sc, {receive:true});
  farReef(sc, 90, 50);
  const rays=godRays(12, 13); rays.userData.isRays=true; rays.visible=!low; sc.add(rays); G.rays=rays;
  G.cps=[]; for(let i=1;i<=NCP;i++){ const t=i/NCP*Math.PI*2; const p=new THREE.Vector3(Math.cos(t)*RA,0,Math.sin(t)*RB); const tan=new THREE.Vector3(-Math.sin(t)*RA,0,Math.cos(t)*RB).normalize();
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.8,.22,14,48), mat(0xffd52e,{emissive:0xffa000,ei:.6,opacity:.9})); ring.position.set(p.x,2.4,p.z); ring.rotation.y=Math.atan2(tan.x,tan.z); sc.add(ring);
    if(i===NCP){ const flag=new THREE.Mesh(new THREE.PlaneGeometry(6,1), new THREE.MeshBasicMaterial({map:checkerTex(),side:THREE.DoubleSide})); flag.position.set(p.x,5.4,p.z); flag.rotation.y=ring.rotation.y; sc.add(flag); }
    G.cps.push({p, ring}); }
  G.cpIdx=0; G.lap=1; G.guide=makeGuideArrow(); sc.add(G.guide); G.wrongT=0;
  for(let i=0;i<48;i++){ const t=(i+.5)/48*Math.PI*2; const off=rand(-.12,.12); const c=makeCoin(); c.position.set(Math.cos(t)*RA*(1+off),.8,Math.sin(t)*RB*(1+off)); c.userData.ph=i*.3; sc.add(c); G.coins.push(c);} 
  G.bubbles=makeBubbles(sc,low?70:150,40,12); specks(sc, low?150:400, 45, 9);
  spawnPlayer(RA,0,0); G.spawn=new THREE.Vector3(RA,0,0);
  G.rec=[]; G.recT=0; G.ghost=null; if(S.ghost && S.ghost.length){ G.ghost=buildOllie({ghost:true}); G.ghost.position.set(RA,0,0); sc.add(G.ghost); }
  setupMinimap();
  beginRun('RACE!');
}
function checkerTex(){ const c=document.createElement('canvas'); c.width=192; c.height=32; const g=c.getContext('2d'); for(let x=0;x<12;x++) for(let y=0;y<2;y++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*16,y*16,16,16);} const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
function updateCheckpoints(){ G.cps.forEach((c,i)=>{ const next=i===G.cpIdx; c.ring.material.color.setHex(next?0xffd52e:0x9fd8ff); c.ring.material.emissive.setHex(next?0xffa000:0x002244); c.ring.material.opacity=next?.95:.35; c.ring.scale.setScalar(next?1+Math.sin(performance.now()/180)*.05:1); }); }

/* ---------- MINIMAP ---------- */
const mm=$('#minimap'), mctx=mm.getContext('2d');
function setupMinimap(){ mm.style.display='block'; }
function drawMinimap(){
  const W=mm.width; mctx.clearRect(0,0,W,W); const p=G.player.position;
  if(G.mode==='maze'){ const {grid,T}=G.maze; const s=W/T; mctx.fillStyle='rgba(233,201,138,.9)'; mctx.fillRect(0,0,W,W); mctx.fillStyle='#b54cff'; for(let i=0;i<T;i++) for(let j=0;j<T;j++) if(grid[i][j]) mctx.fillRect(i*s,j*s,s+.5,s+.5);
    mctx.fillStyle='#ffd52e'; G.coins.forEach(c=>{ if(c.visible){ const i=c.position.x/TILE+T/2, j=c.position.z/TILE+T/2; mctx.fillRect(i*s-1,j*s-1,2.5,2.5);} });
    const e=G.maze.exit; mctx.font=`${Math.max(10,s*1.6)}px serif`; mctx.textAlign='center'; mctx.textBaseline='middle'; mctx.fillText('🎁',(e[0]+.5)*s,(e[1]+.5)*s);
    dot((p.x/TILE+T/2)*s,(p.z/TILE+T/2)*s);
  } else { const sx=W/(RA*2.8), cx=W/2; mctx.fillStyle='rgba(45,143,201,.8)'; mctx.fillRect(0,0,W,W); mctx.strokeStyle='#ecd096'; mctx.lineWidth=RB*.4*sx*2; mctx.beginPath(); mctx.ellipse(cx,cx,RA*sx,RB*sx,0,0,7); mctx.stroke();
    const c=G.cps[G.cpIdx]; if(c){ mctx.fillStyle='#ffd52e'; mctx.beginPath(); mctx.arc(cx+c.p.x*sx,cx+c.p.z*sx,5,0,7); mctx.fill(); }
    if(G.ghost){ mctx.fillStyle='rgba(255,255,255,.6)'; mctx.beginPath(); mctx.arc(cx+G.ghost.position.x*sx,cx+G.ghost.position.z*sx,4,0,7); mctx.fill(); }
    dot(cx+p.x*sx,cx+p.z*sx); }
  function dot(x,y){ mctx.save(); mctx.translate(x,y); mctx.rotate(-G.player.rotation.y); mctx.fillStyle='#ff4f6d'; mctx.strokeStyle='#16163a'; mctx.lineWidth=2; mctx.beginPath(); mctx.moveTo(0,6); mctx.lineTo(-4.5,-4); mctx.lineTo(4.5,-4); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore(); }
}

/* ===================== RUN LIFECYCLE ===================== */
let active='lobby';
function beginRun(label){
  active='game'; showScreen('hud'); G.running=false; G.paused=false; G.countdown = G.mode==='race'?3.2:0;
  $('#hudModeLbl').textContent = G.mode==='race'?'RACE':'LEVEL'; $('#hudLevel').textContent = G.mode==='race'?`${G.lap}/${LAPS}`:G.level;
  $('#hudCoins').textContent='000'; $('#hudTimer').textContent='00:00'; updateInfo();
  if(G.mode==='maze'){ centerMsg(label); setTimeout(()=>centerMsg(''),1300); G.running=true; } 
  if(isTouch){ $('#hint').style.display='none'; }
  for(const k in keys) keys[k]=false; joy.x=joy.y=0;
  resize();
}
function hudCount(){ $('#hudCoins').textContent=String(G.collected).padStart(3,'0'); } // economy v2: no bag cap, every starfish counts
function updateInfo(){ const el=$('#hudInfo'); if(G.mode==='maze') el.innerHTML=`Find the treasure chest! 🎁  ${G.collected}/${G.coins.length} ${STAR}`; else if(G.mode==='race') el.textContent=`Checkpoint ${Math.min(G.cpIdx+1,NCP)}/${NCP} · Lap ${G.lap}/${LAPS}` + (S.ghost?' · beat your ghost! 👻':''); }
let cmT; function centerMsg(t){ const e=$('#centerMsg'); e.textContent=t; e.classList.remove('pop'); void e.offsetWidth; if(t) e.classList.add('pop'); }
function fmtTime(t){ const m=Math.floor(t/60), s=Math.floor(t%60); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
function quitToLobby(){ resetPicks(); G.running=false; active='lobby'; exitPointerLock(); hideModal(); viewOffsetMode=null; updateViewOffset(); showScreen('lobby'); setLobbyOllie(); refreshLobby(); flushChests(); }

/* ===== economy v2: every 5 wins = a Play chest; chests wait in S.pendingChests (reload-safe) until shown ===== */
function noteWin(){ const r=ECO.noteWin(S); if(r){ ECO.incrementPity(S, r.rarity, {high:false}); S.pendingChests.push({ rarity:r.rarity, source:r.source }); } return !!r; }
function winChestHtml(got){ return got ? `<p class="winchest got">🎉 5 wins! A <b>bonus chest</b> is coming! 🎁</p>` : `<p class="winchest">🎁 Bonus chest in <b>${ECO.WINS_PER_CHEST-S.winsTowardChest}</b> more ${ECO.WINS_PER_CHEST-S.winsTowardChest===1?'win':'wins'} ${winDots(S.winsTowardChest)}</p>`; }
function winDots(n){ return `<span class="wdots">${Array.from({length:ECO.WINS_PER_CHEST},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span>`; }
const ALLSTAR_HTML = `<div class="allstar">⭐ ALL STARFISH! ⭐</div>`;
/** Wraps a "what next" action so any waiting bonus chests open first, one after another. */
function afterChests(next){ return ()=>{ const c=S.pendingChests[0]; if(!c){ next(); return; } S.pendingChests.shift(); // openChestModal rolls + saves right away
  const go=afterChests(next); openChestModal(c.rarity, { source:c.source, title:'BONUS CHEST!', coinsHtml:`<p class="winchest got">🎉 You won 5 games! Here's a bonus chest!</p>`, onClose:go, buttons:[['Awesome!','green awesome',go]] }); }; }
function flushChests(){ if(!S.pendingChests.length || active!=='lobby' || !$('#modal').classList.contains('hidden')) return; afterChests(()=>{ hideModal(); refreshLobby(); })(); }
function finishMaze(){
  G.running=false; exitPointerLock(); SFX.win(); ECO.ensureDay(S);
  const lvl=G.level, firstClear = lvl>(S.bestLevel||0), allClear = G.coins.length>0 && G.collected>=G.coins.length;
  const e=ECO.mazeEarn(G.collected, allClear); S.coins+=e.earned; if(allClear) S.mazeAllClears++; S.bestLevel=Math.max(S.bestLevel,lvl); S.level=Math.max(S.level, lvl+1);
  // every clear gives a chest: new level (or a not-yet-claimed milestone) = Treasure chest, replay = Play chest
  const mile = (ECO.MILESTONE_CHEST[lvl] && !S.milestones.includes(lvl)) ? ECO.MILESTONE_CHEST[lvl] : null; const treasure = firstClear || !!mile;
  const ch = treasure ? ECO.rollTreasureRarity(lvl, S, { milestone:mile }) : ECO.rollPlayRarity(S);
  if(treasure) ECO.noteTreasureOpen(S, lvl, ch.source); ECO.incrementPity(S, ch.rarity, { high:ch.high });
  const got=noteWin(); save();
  try{ LB.offerSubmit('maze', S.bestLevel); }catch(e){}
  const coinsHtml=`${allClear?ALLSTAR_HTML:''}<div class="coinsum">${STAR} ${e.credited} starfish + ${e.bonus} finish bonus${allClear?` + ${e.allClear} all-starfish bonus`:''} = <b>${e.earned}</b></div><p class="tinfo">Time ${fmtTime(G.time)}</p>${winChestHtml(got)}`;
  const buttons=[['Awesome!','green awesome',afterChests(quitToLobby)],['NEXT LEVEL ▶','blue',afterChests(()=>{ hideModal(); startMaze(lvl+1); })]];
  if(allClear) confetti('#ffd52e');
  openChestModal(ch.rarity, { source:ch.source, milestone:ch.source==='milestone', level:lvl, title: ch.source==='milestone'?`LEVEL ${lvl} MILESTONE!`:`LEVEL ${lvl} CLEAR!`, coinsHtml, buttons, onClose:buttons[0][2] });
}
function finishRace(){
  G.running=false; exitPointerLock(); SFX.win(); const t=+G.time.toFixed(2);
  ECO.ensureDay(S); const allClear = G.coins.length>0 && G.collected>=G.coins.length; const re=ECO.raceEarn(G.collected, allClear), bonus=re.bonus, earned=re.earned; S.coins+=earned; if(allClear) S.raceAllClears++;
  const prevBest=S.raceTimes[0]; S.raceTimes.push(t); S.raceTimes.sort((a,b)=>a-b); S.raceTimes=S.raceTimes.slice(0,5); // leaderboard stays time-only
  const newBest=!prevBest||t<prevBest; if(newBest) S.ghost=G.rec; const got=noteWin(); save();
  try{ if(S.raceTimes[0]) LB.offerSubmit('race', Math.round(S.raceTimes[0]*1000)); }catch(e){}
  showModal(`<h2>${newBest?'NEW BEST TIME!':'FINISH!'}</h2><div class="prize"><div class="ic">🏁</div><div class="big">${t.toFixed(2)}s</div></div>${allClear?ALLSTAR_HTML:''}<p>${prevBest?`Best: ${Math.min(prevBest,t).toFixed(2)}s`:'Your ghost 👻 will race you next time!'}</p><div class="coinsum">${STAR} ${re.credited} starfish + ${bonus} finish bonus${allClear?` + ${re.allClear} all-starfish bonus`:''} = <b>${earned}</b></div>${winChestHtml(got)}`, [['RACE AGAIN','green',afterChests(()=>{ hideModal(); startRace(); })],['LOBBY','blue',afterChests(quitToLobby)]]);
  if(newBest||allClear) confetti('#ffd52e');
}
function chestHtml(r, opt={}){ const R=RMAP[r]; const burst=opt.noBurst?'':`<div class="burst"${opt.interactive?' id="burst"':''} style="--rc:${R.color}"></div>`; return `<div class="chest-wrap${opt.mini?' mini':''}">${burst}<img class="chest-art ${r==='cosmic'?'cosmic':''}"${opt.interactive?' id="chestEl"':''} src="${artUrl('chest-'+r)}" alt="${R.name} chest" draggable="false" style="--rc:${R.color}"></div>`; }
function pityHintHtml(){ const h=ECO.pityHint(S); return h? `<p class="pity">✨ ${RMAP[h.tier].name} chest in ${h.n}! <small>(maze chests)</small></p>` : ''; }
function bindModalX(fn){ const x=$('#modalX'); if(x) x.onclick=()=>{ SFX.click(); fn(); }; }
function openChestModal(rarity, o){
  const R=RMAP[rarity]; const bg = rarity==='cosmic'?'linear-gradient(90deg,#7b5cff,#00e5ff,#ff5fd2)':R.color; const source=o.source||'roll';
  // roll + save immediately so a reload can't lose the prize; the show below is just presentation
  const p=ECO.rollPrize(rarity, S); save(); // economy v2: pity is moved by the caller when the chest is rolled (bought chests never move it)
  const showMs=ECO.showMs(rarity);
  const onClose = o.onClose || (()=>hideModal());
  const buttons = (o.buttons && o.buttons.length) ? o.buttons : [['Awesome!','green awesome',onClose]];
  const ms = o.milestone ? `<div class="milestone">🏆 MILESTONE CHEST 🏆<small>Level ${o.level} always gives a ${R.name} chest!</small></div>` : '';
  showModal(`${ms}<h2>${o.title}</h2>${o.coinsHtml||''}<p><span class="rbadge" style="background:${bg}">${R.name} Chest</span></p>${chestHtml(rarity,{interactive:true})}<p id="tapMsg">Tap the chest to open it!</p><button class="btn green" id="openChestBtn">OPEN!</button><div id="prizeBox"></div>`, [], { closeX:true, onClose:()=>{} });
  if(o.milestone){ confetti('#ffd52e'); setTimeout(()=>confetti(R.color),350); SFX.chest(5); }
  const ch=$('#chestEl'); let opened=false;
  const shakes=Math.max(2, Math.round((showMs-650)/110));
  const open=()=>{ if(opened) return; opened=true; const ob=$('#openChestBtn'); if(ob) ob.remove(); ch.classList.add('shaking'); let n=0; const iv=setInterval(()=>{ SFX.shake(); if(++n>=shakes){ clearInterval(iv); ch.classList.remove('shaking'); ch.classList.add('open'); const bu=$('#burst'); if(bu) bu.classList.add('on'); SFX.chest(R.idx); confetti(R.color); if(R.idx>=3) setTimeout(()=>confetti('#ffd52e'),300); if(R.idx>=6) setTimeout(()=>confetti('#fff'),600); setTimeout(reveal,650); } },110); };
  const reveal=()=>{ const wrap=ch.parentElement; wrap.style.display='none'; $$('#modalCard .tinfo, #tapMsg').forEach(x=>x.style.display='none'); const ob=$('#openChestBtn'); if(ob) ob.remove(); $$('#modalCard > p').forEach(x=>{ if(x.querySelector('.rbadge')) x.style.display='none'; });
      const it=p.x||{name:'Bonus starfish!', em:'⭐'}; const kind = !p.x?'Bonus': p.kind==='char'?'New Character!':SLOT_NAMES[it.slot];
      let line = !p.x? '' : p.dup ? `<p>Already have it → +${p.refund} ${STAR}${p.shard?` + 1 ${R.name} shell shard 🐚 (${S.shards[rarity]}/${ECO.SHARDS_TO_CRAFT})`:' collector bonus'}</p>` : (p.kind==='item'?'<p>Wear it in the Closet!</p>':'<p>Added to your Characters!</p>');
      if(p.dup && ECO.canCraft(S,rarity)) line+=`<p class="pity">🐚 You can craft a ${R.name} prize in Chests!</p>`;
      $('#tapMsg').textContent=''; $('#prizeBox').innerHTML=`<div class="prize" style="position:relative"><div class="burst on" style="--rc:${R.color};inset:-30%"></div>${iconHtml(it)}<div class="big">${it.name}</div><span class="rbadge" style="background:${bg}">${R.name} · ${kind}</span>${line}<p class="bonusline">+${p.bonus} ${STAR} chest bonus${source!=='bought'?pityHintHtml().replace('<p class="pity">',' · <span class="pity">').replace('</p>','</span>'):''}</p></div><div class="row modal-actions">${buttons.map((b,i)=>`<button class="btn ${b[1]}" data-b="${i}">${b[0]}</button>`).join('')}</div>`;
      refreshCoins(); $$('#prizeBox [data-b]').forEach(el=>el.onclick=()=>{ SFX.click(); buttons[+el.dataset.b][2](); });
      bindModalX(onClose);
  };
  ch.onclick=open; const ob=$('#openChestBtn'); if(ob) ob.onclick=open;
  bindModalX(open); // X before the prize is shown opens the chest so kids never get stuck
  setTimeout(()=>{ if(!opened) open(); }, 1800);
}
function showModal(html, buttons, opts={}){
  const close = opts.onClose || (buttons && buttons.length ? buttons[buttons.length-1][2] : hideModal);
  const x = (opts.closeX!==false && close) ? `<button class="modal-x" id="modalX" type="button" aria-label="Close">✕</button>` : '';
  $('#modal').classList.remove('hidden');
  $('#modalCard').innerHTML = x + html + (buttons&&buttons.length?`<div class="row modal-actions">${buttons.map((b,i)=>`<button class="btn ${b[1]}" data-b="${i}">${b[0]}</button>`).join('')}</div>`:'');
  $$('#modalCard > .row [data-b]').forEach(el=>el.onclick=()=>{ SFX.click(); buttons[+el.dataset.b][2](); });
  bindModalX(close);
}
function hideModal(){ $('#modal').classList.add('hidden'); }
function pauseGame(){ if(!G.running&&G.mode!=='race') return; G.paused=true; exitPointerLock(); showModal('<h2>PAUSED</h2><p>Take a breather! 🫧</p>', [['RESUME','green',()=>{ G.paused=false; hideModal(); }],['RESTART','blue',()=>{ hideModal(); G.mode==='maze'?startMaze(G.level):startRace(); }],['LOBBY','red',quitToLobby]]); }

/* ===================== INPUT ===================== */
addEventListener('keydown', e=>{ keys[e.code]=true; if(active==='game'){ if(e.code==='Space'||e.code==='ShiftLeft'){ tryDash(); e.preventDefault(); } if(e.code==='Escape'||e.code==='KeyP'){ if(G.paused){ G.paused=false; hideModal(); } else pauseGame(); } if(e.code.startsWith('Arrow')) e.preventDefault(); } });
addEventListener('keyup', e=>{ keys[e.code]=false; });
addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });
let locked=false, dragging=null;
function exitPointerLock(){ if(document.pointerLockElement) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', ()=>{ locked = document.pointerLockElement===canvas; if(!locked && active==='game' && G.running && !G.paused && !isTouch && $('#modal').classList.contains('hidden')) pauseGame(); /* Esc released the mouse: pause */ });
canvas.addEventListener('pointerdown', e=>{
  ac();
  if(active!=='game') { if(active==='lobby'){ dragging={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,lobby:true}; } return; }
  if(e.pointerType==='mouse' && !locked){ try{ const r=canvas.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(_){} }
  dragging={id:e.pointerId,x:e.clientX,y:e.clientY};
});
addEventListener('pointermove', e=>{
  if(active==='game' && locked && e.pointerType==='mouse'){ G.yaw -= e.movementX*.0032; G.pitch=Math.max(.45,Math.min(1.3,G.pitch+e.movementY*.0025)); return; }
  if(dragging && dragging.id===e.pointerId){ const dx=e.clientX-dragging.x, dy=e.clientY-dragging.y; dragging.x=e.clientX; dragging.y=e.clientY;
    if(dragging.lobby){ lobby.extra=(lobby.extra||0)+dx*.012; return; }
    G.yaw -= dx*.006; G.pitch=Math.max(.45,Math.min(1.3,G.pitch+dy*.004)); }
});
addEventListener('pointerup', e=>{ if(dragging&&dragging.id===e.pointerId){ if(dragging.lobby && lobby.ollie && Math.hypot((e.clientX-(dragging.sx??dragging.x)),(e.clientY-(dragging.sy??dragging.y)))<12) triggerAnim(lobby.ollie,'tap'); dragging=null; } });
addEventListener('pointercancel', e=>{ if(dragging&&dragging.id===e.pointerId) dragging=null; });
// joystick
const joyEl=$('#joy'), knob=$('#joyKnob');
joyEl.addEventListener('pointerdown', e=>{ ac(); joy.active=true; joy.id=e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', e=>{ if(joy.active&&e.pointerId===joy.id) joyMove(e); });
const joyEnd=e=>{ if(e.pointerId!==joy.id) return; joy.active=false; joy.x=joy.y=0; knob.style.transform=''; };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
function joyMove(e){ const r=joyEl.getBoundingClientRect(); const R=r.width/2; let dx=e.clientX-(r.left+R), dy=e.clientY-(r.top+R); const d=Math.hypot(dx,dy), max=R*.62; if(d>max){ dx*=max/d; dy*=max/d; } knob.style.transform=`translate(${dx}px,${dy}px)`; joy.x=dx/max; joy.y=-dy/max; }
$('#dashBtn').addEventListener('pointerdown', e=>{ e.preventDefault(); ac(); tryDash(); });
$('#pauseBtn').onclick=()=>{ SFX.click(); pauseGame(); };
function tryDash(){ if(!G.running||G.dashCd>0) return; G.dashT=.35; G.dashCd=1.4; SFX.dash(); spawnSparkles(G.scene, G.player.position.clone().add(new THREE.Vector3(0,.6,0)), 0x9fe8ff, 8); }

/* ===================== UPDATE ===================== */
const tmpV=new THREE.Vector3(), camTarget=new THREE.Vector3();
function updateGame(dt, t){
  const P=G.player; if(!P) return;
  // countdown (race)
  if(G.mode==='race' && !G.running && G.countdown>0 && !G.paused){ const before=Math.ceil(G.countdown); G.countdown-=Math.min(.25,realDt); const after=Math.ceil(G.countdown);
    if(after!==before || !G.cdShown){ G.cdShown=true; if(after>0){ centerMsg(String(after)); SFX.count(); } else { centerMsg('GO!'); SFX.go(); G.running=true; setTimeout(()=>centerMsg(''),700); } } }
  let speed=0;
  if(G.running && !G.paused){
    G.time+=dt; $('#hudTimer').textContent=fmtTime(G.time);
    // input → camera-relative
    let f=0,s=0; if(keys.KeyW||keys.ArrowUp) f+=1; if(keys.KeyS||keys.ArrowDown) f-=1; if(keys.KeyD||keys.ArrowRight) s+=1; if(keys.KeyA||keys.ArrowLeft) s-=1;
    if(keys.KeyQ) G.yaw+=2*dt; if(keys.KeyE) G.yaw-=2*dt;
    if(joy.active){ f+=joy.y; s+=joy.x; }
    const mag=Math.min(1,Math.hypot(f,s));
    const fw=new THREE.Vector3(Math.sin(G.yaw),0,Math.cos(G.yaw)), rt=new THREE.Vector3(-Math.cos(G.yaw),0,Math.sin(G.yaw));
    const dir=fw.multiplyScalar(f).addScaledVector(rt,s); if(dir.lengthSq()>0) dir.normalize();
    G.dashT=Math.max(0,G.dashT-dt); G.dashCd=Math.max(0,G.dashCd-dt); $('#dashBtn').classList.toggle('cd',G.dashCd>0);
    const maxSp = (G.mode==='race'?7.5:5.6) * (G.dashT>0?1.9:1);
    const want=dir.multiplyScalar(maxSp*mag); G.vel.lerp(want, Math.min(1,dt*10));
    P.position.addScaledVector(G.vel, dt); speed=G.vel.length();
    if(speed>.3){ const target=Math.atan2(G.vel.x,G.vel.z); let d=target-P.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); P.rotation.y+=d*Math.min(1,dt*12);
      // touch: camera gently swings behind the player when moving forward-ish
      if(isTouch && joy.active && !dragging && joy.y>-.3){ let cd=P.rotation.y-G.yaw; cd=Math.atan2(Math.sin(cd),Math.cos(cd)); G.yaw+=cd*Math.min(1,dt*1.2); } }
    // collisions
    if(G.mode==='maze') collideMaze(P.position,.5);
    else { const e=ellE(P.position.x,P.position.z); const lo=.83, hi=1.17; if(e<lo||e>hi){ const k=(e<lo?lo:hi)/e; P.position.x*=k; P.position.z*=k; } }
    // coins
    for(const c of G.coins){ if(!c.visible) continue; if(Math.hypot(c.position.x-P.position.x,c.position.z-P.position.z)<1){ c.visible=false; G.collected++; SFX.coin(); spawnSparkles(G.scene,c.position,0xffb347,14); hudCount(); updateInfo(); } }
    if(G.mode==='maze'){
      if(G.chest && P.position.distanceTo(G.chest.position)<1.6){ spawnSparkles(G.scene,G.chest.position.clone().setY(1),0xffd52e,30); finishMaze(); }
      for(const j of G.jellies){ if(Math.hypot(j.position.x-P.position.x,j.position.z-P.position.z)<.9 && !(G.hitCd>0)){ G.hitCd=1.2; SFX.bump(); const push=tmpV.subVectors(P.position,j.position).setY(0).normalize().multiplyScalar(6); G.vel.copy(push); if(G.collected>0){ G.collected--; hudCount(); updateInfo(); const back=G.coins.find(c=>!c.visible); if(back){ back.visible=true; spawnSparkles(G.scene,back.position,0xffb347,10); } } toast('Ouch! A jelly bumped you 🪼 – your starfish swam back, go grab it!'); } }
      // lost helper: after 40s a golden arrow points along the real path to the chest
      if(!G.lostHelp && G.time>40){ G.lostHelp=true; toast('Lost? Follow the golden arrow! ✨'); }
      if(G.lostHelp && G.exitDist){ const T=G.maze.T, i=Math.floor(P.position.x/TILE+T/2), j=Math.floor(P.position.z/TILE+T/2); let bi=i,bj=j; for(let step=0;step<2;step++){ const cur=G.exitDist[bi]?.[bj]; if(!(cur>0)) break; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if(G.exitDist[bi+dx]?.[bj+dy]===cur-1){ bi+=dx; bj+=dy; break; } } }
        const w=tileToWorld(bi,bj,T); updateGuide(P, w.x, w.z, (bi!==i||bj!==j), t, dt); }
      G.hitCd=Math.max(0,(G.hitCd||0)-dt);
    } else {
      const cp=G.cps[G.cpIdx]; if(cp && Math.hypot(cp.p.x-P.position.x,cp.p.z-P.position.z)<4.2){ SFX.check(); spawnSparkles(G.scene,cp.ring.position,0xffd52e,16); G.cpIdx++;
        if(G.cpIdx>=NCP){ if(G.lap>=LAPS){ finishRace(); } else { G.lap++; G.cpIdx=0; SFX.match(); centerMsg(G.lap===LAPS?'LAST LAP!':'LAP '+G.lap+'!'); setTimeout(()=>centerMsg(''),900); $('#hudLevel').textContent=`${G.lap}/${LAPS}`; } } updateInfo(); }
      // Zinigames: arrow to the next ring; 'WRONG WAY' if swimming away from it for a moment
      const nc=G.cps[G.cpIdx]; if(nc){ const tx=nc.p.x-P.position.x, tz=nc.p.z-P.position.z, tl=Math.hypot(tx,tz)||1; const away = speed>2 && (G.vel.x*tx+G.vel.z*tz)/(speed*tl) < -.35;
        G.wrongT = away ? G.wrongT+dt : Math.max(0,G.wrongT-dt*2); if(G.wrongT>1 && !G.wrongShown){ G.wrongShown=true; centerMsg('WRONG WAY! ↩'); SFX.miss(); } if(G.wrongT===0 && G.wrongShown){ G.wrongShown=false; centerMsg(''); }
        updateGuide(P, nc.p.x, nc.p.z, true, t, dt); }
      G.recT+=dt; if(G.recT>=.1){ G.recT-=.1; G.rec.push([+P.position.x.toFixed(2),+P.position.z.toFixed(2),+P.rotation.y.toFixed(2)]); }
    }
  }
  if(G.mode==='race' && G.ghost && S.ghost){ const fi=G.time*10, i=Math.floor(fi), a=S.ghost[Math.min(i,S.ghost.length-1)], b=S.ghost[Math.min(i+1,S.ghost.length-1)], u=fi-i; G.ghost.position.set(a[0]+(b[0]-a[0])*u,0,a[1]+(b[1]-a[1])*u); G.ghost.rotation.y=b[2]; animateOllie(G.ghost, G.running&&i<S.ghost.length-1?6:0, dt, t); }
  if(G.mode==='race') updateCheckpoints();
  animateOllie(P, speed, dt, t);
  P.visible = !(G.mode==='maze' && G.running && !G.paused && G.hitCd>0 && Math.floor(t*14)%2===0); // Zinigames: blink while safe after a jelly bump
  // world anim
  for(const c of G.coins) if(c.visible){ c.rotation.y+=dt*2.6; c.rotation.z=Math.sin(t*2+c.userData.ph)*.15; c.position.y=.8+Math.sin(t*3+c.userData.ph)*.12; const k=Math.max(0,Math.sin(t*2.3+c.userData.ph*3)); c.userData.tw.material.opacity=k*k*k*.9; c.userData.tw.scale.setScalar(.3+k*.5); }
  if(G.rays){ G.rays.position.set(P.position.x,0,P.position.z); G.rays.userData.update(t,camera); }
  if(G.chest){ G.chest.userData.glow.material.opacity=.6+Math.sin(t*4)*.3; G.chest.position.y=0; }
  for(const j of G.jellies) j.rotation.y+=dt*.6;
  for(const j of G.jellies){ j.position.y=1.1+Math.sin(t*2+j.userData.ph)*.25; const d=j.userData.dir; const nx=j.position.x+d.x*dt*1.6, nz=j.position.z+d.z*dt*1.6; if(isWall(nx+d.x*.5,nz+d.z*.5)) d.multiplyScalar(-1); else { j.position.x=nx; j.position.z=nz; } }
  G.bubbles?.userData.update(dt);
  // camera
  const dist=G.camDist, h=Math.sin(G.pitch)*dist, back=Math.cos(G.pitch)*dist;
  // high, angled third-person view: look a little ahead of Ollie so he sits in the lower third with the path visible
  const fx=Math.sin(G.yaw), fz=Math.cos(G.yaw), ahead=dist*.32;
  camTarget.set(P.position.x+fx*ahead, .5, P.position.z+fz*ahead);
  const want=new THREE.Vector3(P.position.x-fx*back, h+.6, P.position.z-fz*back);
  camera.position.lerp(want, Math.min(1,dt*10)); camera.lookAt(camTarget);
  // coral between camera and Ollie fades out instead of the camera being pushed in
  uOcc.on.value = G.mode==='maze' ? 1 : 0; uOcc.p.value.set(P.position.x, .9, P.position.z); uOcc.c.value.copy(camera.position);
  if(G.sun){ G.sun.position.set(P.position.x+8,18,P.position.z+6); G.sun.target.position.copy(P.position); }
  drawMinimap();
}
function updateLobby(dt,t){ uOcc.on.value=0;
  const o=lobby.ollie; if(!o) return; animateChar(o,'idle',0,dt,t); tickAccessories(o, dt, t); if(!dragging) lobby.extra=(lobby.extra||0)*(1-Math.min(1,dt*1.2)); o.rotation.y = Math.sin(t*.6)*.12 + (lobby.extra||0);
  lobby.bubbles.userData.update(dt); lobby.rays.userData.update(t,camera);
  applyLobbyCamera();
}
/* Frame the lobby camera ONCE per resize or character/outfit change.
   Uses a rest-pose bounding box (not the waving/idle one) so distance
   never oscillates. No per-frame getBoundingClientRect. */
const lobbyFrame = { key:'', pos:null, look:null };
function invalidateLobbyFrame(){ lobbyFrame.key=''; }
function lobbyFrameKey(){ const eq=S.equipped||{}; return [innerWidth, innerHeight, viewOffsetMode||'', S.selChar||'', eq.hat||'', eq.top||'', eq.shoes||''].join('|'); }
function captureLobbyRestBox(){
  const o=lobby.ollie; if(!o){ lobby.restBox=null; return; }
  const ry=o.rotation.y; o.rotation.y=0; o.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(o);
  const pad=Math.max(0.16, (box.max.y-box.min.y)*0.12);
  box.max.y += pad;
  const eq = viewOffsetMode==='shop' ? shopEq() : (S.equipped||{});
  const mot=outfitMotionPad(eq, IMAP);
  const sc=o.scale.x;
  box.max.y += mot.up * sc;
  box.max.x += mot.side * sc; box.min.x -= mot.side * sc;
  box.min.z -= mot.back * sc;
  box.max.z += (mot.front||0) * sc;
  lobby.restBox=box;
  o.rotation.y=ry; o.updateMatrixWorld(true);
}
function projectRestBox(){
  const box=lobby.restBox; if(!box||!camera) return null;
  const v=new THREE.Vector3();
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9, any=false;
  const xs=[box.min.x,box.max.x], ys=[box.min.y,box.max.y], zs=[box.min.z,box.max.z];
  for(const x of xs) for(const y of ys) for(const z of zs){
    v.set(x,y,z).project(camera);
    if(v.z>1) continue;
    any=true;
    const sx=(v.x*.5+.5)*innerWidth, sy=(-v.y*.5+.5)*innerHeight;
    minX=Math.min(minX,sx); maxX=Math.max(maxX,sx); minY=Math.min(minY,sy); maxY=Math.max(maxY,sy);
  }
  return any?{left:minX,top:minY,right:maxX,bottom:maxY}:null;
}
function frameLobbyCamera(){
  const portrait=innerWidth<innerHeight, phoneLand=!portrait && innerHeight<=500, phonePort=portrait && innerWidth<=600;
  let pos, look;
  if(phonePort){ pos=[0, 3.7, 10.4]; look=[0, 1.45, 0]; }
  else if(phoneLand){ pos=[0, 3.05, 10.4]; look=[0, 0.95, 0]; }
  else if(portrait){ pos=[0, 3.65, 9.6]; look=[0, 1.65, 0]; }
  else { pos=[0, 3.35, 9.5]; look=[0, 1.05, 0]; }
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(look[0], look[1], look[2]);
  camera.updateMatrixWorld();
  if(!lobby.restBox) captureLobbyRestBox();
  const logo=document.querySelector('#lobby .logo');
  const gap=32;
  if(logo && lobby.restBox){
    const need=logo.getBoundingClientRect().bottom + gap;
    for(let i=0;i<16;i++){
      const r=projectRestBox();
      if(!r) break;
      if(r.top>=need && r.top>=4) break;
      camera.position.z += 0.32;
      camera.position.y += 0.06;
      camera.lookAt(look[0], look[1], look[2]);
      camera.updateMatrixWorld();
    }
  }
  lobbyFrame.key=lobbyFrameKey();
  lobbyFrame.pos=camera.position.clone();
  lobbyFrame.look=look.slice();
}
function applyLobbyCamera(){
  const portrait=innerWidth<innerHeight;
  if(window.__lobbyCam){ camera.position.fromArray(window.__lobbyCam[0]); camera.lookAt(...window.__lobbyCam[1]); return; }
  if(viewOffsetMode){ camera.position.set(0, portrait?3.5:2.9, portrait?9:6.6); camera.lookAt(0, portrait?2.0:1.95, 0); return; }
  if(!lobbyFrame.pos || lobbyFrame.key!==lobbyFrameKey()) frameLobbyCamera();
  else { camera.position.copy(lobbyFrame.pos); camera.lookAt(...lobbyFrame.look); }
}
function lobbyProbe(){
  const el=renderer && renderer.domElement;
  return {
    x:camera.position.x, y:camera.position.y, z:camera.position.z,
    fov:camera.fov, aspect:camera.aspect,
    canvas:{ w:el?el.width:0, h:el?el.height:0, cw:el?el.clientWidth:0, ch:el?el.clientHeight:0 }
  };
}
let last=performance.now(), realDt=0; const FPS={n:0,t:0,slow:0};
function fpsMon(d){ if(active!=='game'||document.hidden) { FPS.n=0; FPS.t=0; return; } FPS.n++; FPS.t+=d; if(FPS.t>=2.5){ const fps=FPS.n/FPS.t; FPS.n=0; FPS.t=0; if((S.quality||'auto')==='auto' && !autoLow && fps<34){ if(++FPS.slow>=2){ autoLow=true; applyQuality(); toast('Switched to Low graphics for smoother play'); } } else FPS.slow=0; } }
function loop(now){ requestAnimationFrame(loop); realDt=(now-last)/1000; const dt=Math.min(.05,realDt); last=now; const t=now/1000; uTime.value=t; fpsMon(realDt);
  if(active==='game'){ updateGame(dt,t); updateSparkles(dt); renderer.render(G.scene,camera); }
  else if(active==='lobby'){ updateLobby(dt,t); updateSparkles(dt); renderer.render(lobby.scene,camera); }
}

/* ===================== SCREENS / UI ===================== */

function charScreenRect(){
  const o=lobby.ollie; if(!o||!camera) return null;
  const box=new THREE.Box3().setFromObject(o), v=new THREE.Vector3();
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9, any=false;
  const xs=[box.min.x,box.max.x], ys=[box.min.y,box.max.y], zs=[box.min.z,box.max.z];
  for(const x of xs) for(const y of ys) for(const z of zs){
    v.set(x,y,z).project(camera);
    if(v.z>1) continue;
    any=true;
    const sx=(v.x*.5+.5)*innerWidth, sy=(-v.y*.5+.5)*innerHeight;
    minX=Math.min(minX,sx); maxX=Math.max(maxX,sx); minY=Math.min(minY,sy); maxY=Math.max(maxY,sy);
  }
  return any?{left:minX,top:minY,right:maxX,bottom:maxY}:null;
}
function showScreen(id){ ['lobby','panel','hud','cards'].forEach(s=>$('#'+s).classList.toggle('hidden', s!==id)); document.body.dataset.screen=id; syncMusic(); }
// Level picker: kids can replay any level they've unlocked. Highest unlocked = S.level (maze) / S.cardsRound (cards).
const PICK = { maze:null, cards:null };
function pickMax(m){ return m==='maze'? S.level : S.cardsRound; }
function pickCur(m){ const mx=pickMax(m); if(PICK[m]==null || PICK[m]>mx) PICK[m]=mx; return Math.max(1, PICK[m]); }
function resetPicks(){ PICK.maze=null; PICK.cards=null; }
function refreshPicker(){ const m=S.mode, el=$('#lvlPick'); const show = m==='maze'||m==='cards'; el.classList.toggle('hidden', !show); $('#playRow').classList.toggle('solo', !show); if(!show) return;
  const cur=pickCur(m), mx=pickMax(m); $('#lvlKind').textContent = m==='maze'?'Level':'Round'; $('#lvlNum').textContent=cur; $('#lvlOf').textContent = cur<mx? ' · replay' : '';
  $('#lvlDown').classList.toggle('off', cur<=1); $('#lvlUp').classList.toggle('off', cur>=mx); el.classList.toggle('replay', cur<mx); }
function stepPick(d){ const m=S.mode; if(m!=='maze'&&m!=='cards') return; const nv=Math.max(1, Math.min(pickMax(m), pickCur(m)+d)); if(nv===pickCur(m)){ SFX.miss(); if(d>0) toast(`Finish ${m==='maze'?'Level':'Round'} ${pickMax(m)} to unlock the next one! 🔓`); return; } PICK[m]=nv; SFX.click(); refreshLobby(); }
$('#lvlDown').onclick=()=>stepPick(-1); $('#lvlUp').onclick=()=>stepPick(1);
function refreshLobby(){ refreshCoins(); $$('.mode').forEach(b=>b.classList.toggle('sel', b.dataset.mode===S.mode)); refreshPicker(); $('#playSub').textContent = S.mode==='maze'?`Maze · Level ${pickCur('maze')}`:S.mode==='race'?'Race · beat the clock':S.mode==='sort'?'Reef Sort · match the friends':S.mode==='dash'?'Reef Diner · serve your friends':S.mode==='hide'?'Hide & Seek · find friends':`Match Cards · Round ${pickCur('cards')}`; $('.avatar').innerHTML=`<img src="${artUrl(S.selChar||'ollie')}" alt="${(CMAP[S.selChar]||CMAP.ollie).name.split(' the ')[0]}">`; refreshProgress(); }
/* economy v2 lobby progress (sits next to #playRow; does not touch it) */
function refreshProgress(){ const el=$('#lobbyProg'); if(!el) return; const L=ECO.lobbyProgress(S);
  $('#lpChestLbl').innerHTML=`Chest in <b>${L.winsTowardChest}/${L.winsNeeded}</b> games`; $$('#lpChestBar i').forEach((x,i)=>x.classList.toggle('on', i<L.winsTowardChest));
  $('#lpColLbl').innerHTML=`Collection <b>${L.collectionOwned}/${L.collectionTotal}</b>`; $('#lpColFill').style.width=Math.max(3,L.collectionPct)+'%';
  const m=L.nextMilestone; $('#lpMile').innerHTML = m ? `Next milestone: <b style="color:${RMAP[m.rarity].color}">${RMAP[m.rarity].name}</b> chest at Maze Level ${m.level}` : 'All milestones found!'; }
$('#lobbyProg').onclick=()=>{ SFX.click(); openPanel('chests'); };
$$('.mode').forEach(b=>b.onclick=()=>{ SFX.click(); S.mode=b.dataset.mode; save(); refreshLobby(); });
function startSort(){ active='none'; openReefSort({ ECO, S, save, onWin:()=>{ const ret={ chest:noteWin(), wins:S.winsTowardChest, need:ECO.WINS_PER_CHEST }; queueMicrotask(()=>{ try{ const loc=LB.localScores(); if(loc.sort) LB.offerSubmit('sort', loc.sort); }catch(e){} }); return ret; }, onExit:()=>{ active='lobby'; showScreen('lobby'); setLobbyOllie(); refreshLobby(); flushChests(); } }); syncMusic('sort'); }
function startDash(){ active='none'; openReefDiner({ ECO, S, save, artUrl, chars:CHARS, waiterId:S.selChar||'ollie', sfxOn:()=>S.music!==false, onWin:()=>{ try{ const loc=LB.localScores(); if(loc.diner) LB.offerSubmit('diner', loc.diner); }catch(e){} return { chest:noteWin(), wins:S.winsTowardChest, need:ECO.WINS_PER_CHEST }; }, onExit:()=>{ active='lobby'; showScreen('lobby'); setLobbyOllie(); refreshLobby(); flushChests(); } }); syncMusic('play'); }
function startHide(){ active='none'; openHideSeek({ ECO, S, save, artUrl, chars:CHARS, seekerId:S.selChar||'ollie', sfxOn:()=>S.music!==false, onWin:()=>{ try{ const loc=LB.localScores(); if(loc.hide) LB.offerSubmit('hide', loc.hide); }catch(e){} return { chest:noteWin(), wins:S.winsTowardChest, need:ECO.WINS_PER_CHEST }; }, onExit:()=>{ active='lobby'; showScreen('lobby'); setLobbyOllie(); refreshLobby(); flushChests(); } }); syncMusic('sort'); }
// economy v2: one-time friendly notice for existing players, then any bonus chests that were waiting
function cosmicNotice(){ S.cosmicNoticeSeen=true; save(); const done=()=>{ hideModal(); flushChests(); };
  showModal(`<h2>MORE STARFISH! 🎉</h2><div class="prize"><div class="ic">🌌</div></div><p>Play as much as you like — every game gives starfish, and every <b>5 wins</b> opens a bonus chest! 🎁</p><p class="v2note">The super-rare <b>Cosmic</b> prizes now show up after about <b>2 weeks</b> of play, and in a special chest at <b>Maze Level 80</b>. ✨</p>`, [['YAY!','green awesome',done]], { onClose:done }); }
setTimeout(()=>{ if(active!=='lobby' || !$('#modal').classList.contains('hidden')) return; if(!S.cosmicNoticeSeen) cosmicNotice(); else flushChests(); }, 900);
setTimeout(()=>{ const z=window.__zkidz; if(!z) return; Object.assign(z, { flushChests, refreshProgress, finishRace, cardsWin }); Object.defineProperty(z, 'C', { get:()=>C }); }, 0); // test hooks
$('#playBtn').onclick=()=>{ ac(); SFX.go(); if(S.mode==='maze') startMaze(pickCur('maze')); else if(S.mode==='race') startRace(); else if(S.mode==='sort') startSort(); else if(S.mode==='dash') startDash(); else if(S.mode==='hide') startHide(); else startCards(pickCur('cards')); };
function openSettings(quiet){ if(!quiet) SFX.click(); const cur=S.quality||'auto'; const opt=(k,l)=>[`${k===cur?'✔ ':''}${l}`, k===cur?'green':'blue', ()=>{ S.quality=k; if(k!=='auto') autoLow=false; save(); applyQuality(); hideModal(); toast(`Graphics: ${l}`); }];
  const musicOn=musicEnabled();
  showModal(`<div class="settings-body"><h2>SETTINGS</h2>
    <p class="set-lbl">Music</p>
    <p class="note">Turn the underwater songs on or off. Your choice is saved.</p>
    <div class="set-music-row"><button type="button" class="btn ${musicOn?'green':'gray'} set-music" id="setMusicBtn">${musicOn?'🎵 MUSIC: ON':'🎵 MUSIC: OFF'}</button></div>
    <p>Graphics quality</p><p class="note">AUTO starts on High and switches to Low if the game gets choppy. Low uses fewer corals, no shadows or light rays.</p>
    <div class="credits"><h3>MUSIC CREDITS</h3>
    <p>All songs are CC0 (public domain). Lobby, Closet &amp; Shop: “Underwater Ambient Pad” by isaiah658. Maze &amp; Match Cards: “Happy Vibes” by Ruskerdax. Race: “Frenzied Swimming” by Some Weirdo. Reef Sort: “Aquaria” by cynicmusic.</p></div></div>`,
    [opt('auto','AUTO'),opt('high','HIGH'),opt('low','LOW'),['CLOSE','gray',hideModal]]);
  const mb=$('#setMusicBtn'); if(mb) mb.onclick=()=>{ setMusicOn(!musicEnabled()); openSettings(true); }; }
$('#gearBtn').onclick=()=>openSettings();
$('#profileBtn').onclick=async ()=>{
  const n=prompt('Your player name:', S.name);
  if(!n||!n.trim()) return;
  const name=n.trim();
  let res=null;
  try{ res=await LB.checkNickname(name); }catch(e){ res=LB.checkNicknameLocal(name); }
  if(!res||!res.ok){ toast("Let's pick a different name!"); return; }
  S.name=res.nickname||name; save(); refreshCoins();
};
$$('[data-open]').forEach(b=>b.onclick=()=>{ SFX.click(); openPanel(b.dataset.open); });
$('#panelBack').onclick=()=>{ SFX.click(); closePanel(); };
let panelState={};
function closePanel(){ shopTryOn=null; viewOffsetMode=null; updateViewOffset(); $('#panel').classList.remove('closet','shop'); active='lobby'; showScreen('lobby'); setLobbyOllie(); refreshLobby(); }
function openPanel(which, sub){ panelState.which=which; if(sub) panelState.sub=sub; showScreen('panel'); const P=$('#panel'); P.classList.toggle('closet', which==='closet'); P.classList.toggle('shop', which==='shop'); viewOffsetMode = (which==='closet'||which==='shop')?which:null; updateViewOffset(); active = (which==='closet'||which==='shop')?'lobby':'none'; if(which==='closet'||which==='shop') setLobbyOllie();
  $('#panelTitle').innerHTML = {shop:`<span class="shop-stand mini" aria-hidden="true">${SHOP_STAND}</span>SHOP`,characters:'CHARACTERS',closet:'CLOSET',leaderboard:'LEADERBOARD',chests:'CHESTS'}[which];
  ({shop:renderShop,characters:renderChars,closet:renderCloset,leaderboard:renderLB,chests:renderChests})[which](); refreshCoins(); }
function tabs(list, cur, cb){ return `<div class="tabs">${list.map(([k,l])=>`<button class="btn small ${k===cur?'':'blue'}" data-tab="${k}">${l}</button>`).join('')}</div>`; }
function bindTabs(cb){ $$('#panelBody [data-tab]').forEach(b=>b.onclick=()=>{ SFX.click(); cb(b.dataset.tab); }); }
function itemCard(it, priceHtml, extraCls=''){ const R=RMAP[it.r]; const bg = it.r==='cosmic'?'linear-gradient(160deg,#3a1a8a,#1a7fbf,#a03aa8)':`linear-gradient(160deg,${R.color},${shade(R.color)})`; return `<div class="item ${extraCls}" data-id="${it.id}" style="background:${bg}">${rarityBadge(it.r)}${iconHtml(it)}<div class="nm">${it.name}</div>${priceHtml}</div>`; }
function shade(hex){ const c=new THREE.Color(hex).multiplyScalar(.55); return '#'+c.getHexString(); }
function todaysPicks(){
  const day=(ECO.todayStr&&ECO.todayStr())||''; let h=2166136261; for(let i=0;i<day.length;i++) h=Math.imul(h^day.charCodeAt(i),16777619);
  const pool=ITEMS.filter(i=>i.r!=='legendary'&&i.r!=='cosmic'); const out=[], used=new Set();
  for(let i=0;i<pool.length && out.length<3;i++){ const it=pool[Math.abs(h+i*7)%pool.length]; if(used.has(it.id)||used.has(it.slot)) continue; used.add(it.id); used.add(it.slot); out.push(it); }
  return out;
}
function shopRows(){
  const rows=SAMPLE_LOOKS.map(r=>({ ...r, sample:true }));
  if(S.bestLevel>0) rows.push({ n:S.name, v:S.bestLevel, char:S.selChar||'ollie', eq:{ ...(S.equipped||{}) }, me:true });
  rows.sort((a,b)=>b.v-a.v); return rows;
}
function renderShop(){ const sub=panelState.shopTab||'clothes'; const body=$('#panelBody');
  const look = shopTryOn && shopTryOn.kind==='look' ? shopTryOn : null;
  const selAll = sub==='characters'? CHARS : ITEMS.filter(i=> sub==='eyewear'? i.slot==='eyes' : i.slot!=='eyes');
  const lookIds = look ? Object.values(look.eq||{}) : null;
  const sel = lookIds ? ITEMS.filter(i=>lookIds.includes(i.id)) : applyFilter('shop', selAll);
  const ownFn = sub==='characters'? (c=>S.chars.includes(c.id)) : (i=>S.owned.includes(i.id));
  const cats=[['characters','🐧','CHARACTERS'],['clothes','👕','CLOTHES'],['eyewear','🕶️','EYEWEAR'],['chests','🎁','CHESTS']];
  const lbRows=shopRows(); warmLookThumbs(lbRows);
  const selId = shopTryOn && (shopTryOn.kind==='item'||shopTryOn.kind==='char') ? shopTryOn.id : null;
  const card=(it)=>{
    const isChar=!it.slot; const owned=isChar? S.chars.includes(it.id) : S.owned.includes(it.id);
    const equipped=!isChar && S.equipped[it.slot]===it.id; const chestOnly=!isChar && (it.r==='legendary'||it.r==='cosmic');
    const selected = lookIds ? lookIds.includes(it.id) : selId===it.id;
    const ph = owned? (equipped?'<div class="price owned">EQUIPPED</div>': '<div class="price owned">OWNED</div>') : chestOnly? '<div class="price locked">🎁 Chest only</div>' : `<div class="price">${STAR} ${it.price}</div>`;
    const buy = (!owned && !chestOnly) ? `<button class="btn small buy-btn" data-buy="${it.id}">BUY</button>` : '';
    return itemCard(it, `<div class="buy-row">${ph}${buy}</div>`, (owned?'':'')+(chestOnly?' lock':'')+(selected?' sel':'')+(equipped?' eq':''));
  };
  const picks = (!look && sub!=='characters') ? todaysPicks() : [];
  const lookBar = look ? `<div class="look-banner"><div class="look-name">${look.name}'s look</div><div class="look-items">${Object.values(look.eq||{}).map(id=>{ const it=IMAP[id]; if(!it) return ''; const u=itemThumb(it); return `<button class="look-chip" data-id="${it.id}">${u?`<img src="${u}" alt="">`:it.em}${it.name}</button>`; }).join('')}</div><button class="btn small gray look-x" id="lookClear" aria-label="Clear look">✕</button></div>` : '';
  const feat = picks.length ? `<div class="featured"><div class="featured-h">⭐ TODAY'S PICKS</div><div class="featured-track">${picks.map(card).join('')}</div></div>` : '';
  const grid = (sub==='chests'||look)? '' : filterChips('shop', selAll, ownFn).replace('class="chips"','class="chips one-line"');
  const note = sub==='characters'?'Characters you unlock join your collection. Pick a ready friend in Characters to play as them!':'Tap an item to try it on. Legendary & Cosmic items only come from chests!';
  body.innerHTML = `<div class="shop-layout"><div class="shop-main"><div class="shop-cats cats">${cats.map(([k,ic,l])=>`<button class="cat ${k===sub?'sel':''}" data-tab="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>${lookBar}${sub==='chests'?'':grid}${feat}<div class="shop-grid-wrap"><div class="grid">${sel.map(card).join('')}</div><p class="note shop-note">${look?`Items from ${look.name}'s outfit. Tap one to try it on!` : note}</p></div></div><div class="mini-lb" id="shopLooks"><div class="mlb-title">🏆 TOP DIVERS</div><div class="mlb-sub">Peek at their outfits!</div>${lbRows.slice(0,5).map((r,i)=>{ const src=lookThumb(r.char,r.eq); const on=look && look.name===r.n && !r.me; return `<button class="mlb-row ${r.me?'me':''} ${on?'on':''}" data-look="${i}" type="button"><b>${i+1}</b>${src?`<span class="mlb-look"><img src="${src}" alt=""></span>`:`<span class="mlb-look"></span>`}<div><div class="mlb-n">${r.n}</div><div class="mlb-v">Lv ${r.v}${r.me?'': ' <i>sample</i>'}</div></div></button>`; }).join('')}</div></div>`;

  bindTabs(k=>{ if(k==='chests'){ shopTryOn=null; openPanel('chests'); return; } panelState.shopTab=k; if(shopTryOn && shopTryOn.kind==='look') shopTryOn=null; renderShop(); });
  bindChips('shop', renderShop);
  $$('#panelBody .chips.one-line, #panelBody .featured-track, #panelBody .mini-lb').forEach(hScroll);

  const buyItem=(id)=>{
    const isChar=sub==='characters' && !!CMAP[id]; const it=isChar?CMAP[id]:IMAP[id]; if(!it) return;
    const owned=isChar?S.chars.includes(id):S.owned.includes(id); if(owned){ toast(isChar?'Already in your collection!':'Owned! Equip it in the Closet 👕'); return; }
    if(!isChar && (it.r==='legendary'||it.r==='cosmic')){ toast('Find this in a chest! 🎁'); return; }
    if(S.coins<it.price){ SFX.miss(); toast(`Need ${it.price-S.coins} more starfish ${STAR}`); return; }
    showModal(`<h2>BUY?</h2><div class="prize">${iconHtml(it)}<div class="big">${it.name}</div></div><p>for ${STAR} ${it.price}</p>`, [['BUY!','green',()=>{ S.coins-=it.price; (isChar?S.chars:S.owned).push(id); if(!isChar){ S.equipped[it.slot]=id; } if(isChar && isPlayable(id) && !S.selChar){ S.selChar=id; } save(); SFX.chest(1); confetti(RMAP[it.r].color); hideModal(); toast(isChar?`${it.name} joined your crew!`:`${it.name} equipped!`); shopTryOn=isChar?{kind:'char',id}:{kind:'item',id}; renderShop(); setLobbyOllie(); }],['NO','gray',hideModal]]);
  };
  const tryOn=(id)=>{
    const isChar = !!CMAP[id] && (sub==='characters' || !IMAP[id]);
    const it=isChar?CMAP[id]:IMAP[id]; if(!it) return;
    SFX.click();
    shopTryOn = isChar ? { kind:'char', id } : { kind:'item', id };
    setLobbyOllie();
    $$('#panelBody .item').forEach(el=>el.classList.toggle('sel', el.dataset.id===id));
    $$('#panelBody .mlb-row').forEach(el=>el.classList.remove('on'));
  };
  $$('#panelBody .item').forEach(el=>el.onclick=e=>{
    const buyBtn=e.target.closest('[data-buy]'); const id=(buyBtn?buyBtn.dataset.buy:null)||el.dataset.id;
    if(buyBtn){ e.preventDefault(); e.stopPropagation(); buyItem(id); return; }
    tryOn(id);
  });
  $$('#panelBody .look-chip').forEach(b=>b.onclick=e=>{ e.stopPropagation(); tryOn(b.dataset.id); });
  $('#lookClear')&&($('#lookClear').onclick=()=>{ shopTryOn=null; setLobbyOllie(); renderShop(); });
  $$('#panelBody .mlb-row').forEach(el=>el.onclick=()=>{
    const r=lbRows[el.dataset.look|0]; if(!r||r.me){ if(r&&r.me){ shopTryOn=null; setLobbyOllie(); renderShop(); toast('That is your look!'); } return; }
    SFX.click();
    shopTryOn={ kind:'look', name:r.n, char:r.char, eq:{ ...r.eq } };
    panelState.shopTab='clothes';
    setLobbyOllie();
    renderShop();
    toast(`Trying on ${r.n}'s look — tap Shop items to browse them!`);
  }); }

function renderChars(){ const body=$('#panelBody'); const list=applyFilter('chars', CHARS); body.innerHTML = filterChips('chars', CHARS, c=>S.chars.includes(c.id)) + `<p class="note">Tap an unlocked friend to play as them in the lobby, Maze, and Race! Dash, Finn, Bubbles, Oscar, Wade, and Ollie are ready — more 3D models are on the way.</p><div class="grid">${list.map(c=>{ const own=S.chars.includes(c.id); const ph= c.id===S.selChar?'<div class="price owned">⭐ SELECTED</div>' : own?'<div class="price owned">UNLOCKED</div>':'<div class="price locked">🔒 LOCKED</div>'; return itemCard(c, ph, (own?'':'lock')+(c.id===S.selChar?' eq':'')); }).join('')}</div>`;
  bindChips('chars', renderChars);
  $$('#panelBody .item').forEach(el=>el.onclick=()=>{ const id=el.dataset.id; if(!S.chars.includes(id)){ toast('Unlock in the Shop or from chests!'); return; } if(!isPlayable(id)){ S.favChar=id; save(); SFX.click(); toast(`${CMAP[id].name}: 3D model coming soon!`); return; } S.selChar=id; save(); SFX.click(); setLobbyOllie(); renderChars(); toast(`${CMAP[id].name.split(' the ')[0]} is ready to play!`); }); }
const CLOSET_ROWS = [['Hats',i=>i.slot==='hat'],['Eyewear',i=>i.slot==='eyes'],['Tops & Jackets',i=>i.slot==='top'],['Pants',i=>i.slot==='bottom'],['Shoes',i=>i.slot==='shoes'],['Bracelets & Gloves',i=>i.slot==='wrist'||i.slot==='hands']];
function renderCloset(){ const body=$('#panelBody'); const ownedAll=ITEMS.filter(i=>S.owned.includes(i.id)); const owned=applyFilter('closet', ownedAll);
  const tile=it=>{ const R=RMAP[it.r]; const on=S.equipped[it.slot]===it.id; const bg=it.r==='cosmic'?'linear-gradient(160deg,#3a1a8a,#1a7fbf,#a03aa8)':`linear-gradient(160deg,${R.color},${shade(R.color)})`;
    return `<div class="ctile ${on?'eq':''}" data-id="${it.id}" style="background:${bg}" title="${it.name} (${R.name})">${iconHtml(it)}<div class="ct-nm">${it.name}</div>${on?'<span class="ct-on">✓</span>':''}</div>`; };
  body.innerHTML = ownedAll.length ? filterChips('closet', ITEMS, i=>S.owned.includes(i.id)).replace('class="chips"','class="chips one-line"') + `<div class="crows">${CLOSET_ROWS.map(([label,f])=>{ const its=owned.filter(f); if(!its.length) return ''; return `<div class="crow"><div class="crow-l">${label}</div><div class="crow-track">${its.map(tile).join('')}</div></div>`; }).join('')}</div>` + (owned.length?'':'<p class="note">None of this rarity yet!</p>')
    : `<div class="note" style="font-size:calc(var(--u)*2.4)">Nothing here yet! Win items from maze chests 🎁 or buy them in the Shop 🛒.</div><button class="btn" id="goShop">GO TO SHOP</button>`;
  bindChips('closet', renderCloset);
  $('#goShop')&&($('#goShop').onclick=()=>openPanel('shop'));
  $$('#panelBody .crow-track, #panelBody .chips.one-line').forEach(hScroll);
  $$('#panelBody .ctile').forEach(el=>el.onclick=()=>{ if(el.closest('.crow-track')?.dataset.dragged==='1') return; const it=IMAP[el.dataset.id]; if(S.equipped[it.slot]===it.id) delete S.equipped[it.slot]; else S.equipped[it.slot]=it.id; save(); SFX.click(); setLobbyOllie(); const keep=[...$$('#panelBody .crow-track')].map(t=>t.scrollLeft); renderCloset(); $$('#panelBody .crow-track').forEach((t,i)=>t.scrollLeft=keep[i]||0); }); }
// sideways rows: native touch swipe, mouse wheel → horizontal, mouse drag
function hScroll(t){
  t.addEventListener('wheel', e=>{ if(t.scrollWidth<=t.clientWidth+2) return; if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ t.scrollLeft+=e.deltaY; e.preventDefault(); } }, {passive:false});
  let down=null; t.addEventListener('pointerdown', e=>{ if(e.pointerType!=='mouse' || t.scrollWidth<=t.clientWidth+2) return; down={x:e.clientX, s:t.scrollLeft, id:e.pointerId}; t.dataset.dragged='0'; });
  t.addEventListener('pointermove', e=>{ if(!down) return; const dx=e.clientX-down.x; if(Math.abs(dx)>5 && t.dataset.dragged!=='1'){ t.dataset.dragged='1'; try{ t.setPointerCapture(down.id); }catch(_){} } if(t.dataset.dragged==='1') t.scrollLeft=down.s-dx; });
  const end=()=>{ if(down){ down=null; setTimeout(()=>t.dataset.dragged='0',0); } }; t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end); t.addEventListener('lostpointercapture', end);
}
function hookLB(){ LB.initLB({ getS:()=>S, save, artUrl, lookThumb, isAppleTouch, toast, click:()=>SFX.click() }); }
function renderLB(){
  hookLB();
  const sub=panelState.lbTab||'maze';
  const body=$('#panelBody');
  const gen = ++renderLB._gen || (renderLB._gen=1);
  renderLB._gen = gen;
  body.innerHTML = tabs(LB.LB_TABS, sub) + `<div id="lbJoinSlot"></div><div id="lbTableSlot"><p class="note">Loading the ocean board…</p></div>`;
  bindTabs(k=>{ panelState.lbTab=k; renderLB(); });
  (async ()=>{
    if(!LB.hasNick()){
      let names=['SunnyOtter','CoralRay','HappyPuff'];
      try{ names=await LB.suggestNames(3); }catch(e){}
      if(renderLB._gen!==gen) return;
      const slot=$('#lbJoinSlot');
      if(slot){ slot.innerHTML=LB.pickerHtml(names, S.lbNick||S._lbPendingNick||'', ''); LB.bindPicker(()=>renderLB()); }
    }
    const board=await LB.loadRows(sub);
    if(renderLB._gen!==gen) return;
    const slot=$('#lbTableSlot');
    if(!slot) return;
    const bodyRows = board.rows.length ? board.rows.map((r,i)=>LB.rowHtml(r,i,sub)).join('') : '<tr><td colspan="3">No scores yet — be the first!</td></tr>';
    slot.innerHTML = `<table class="lb">${bodyRows}</table>${LB.noteFor(board,sub,S)}`;
  })();
}
function dots(used,cap){ return Array.from({length:cap},(_,i)=>`<i class="${i<used?'used':''}"></i>`).join(''); }
function renderChests(){ ECO.ensureDay(S); const body=$('#panelBody'); const desc={common:'A simple wooden chest',uncommon:'Aqua ocean theme',rare:'Forest theme',epic:'Music pop vibes',mythic:'Volcanic theme',ultra:'Silvery high-end kingdom',legendary:'Heavenly gold',cosmic:'Futuristic outer space'};
  const wins=S.winsTowardChest||0; const h=ECO.pityHint(S), nm=ECO.nextMilestone(S);
  const bgOf=r=>r==='cosmic'?'linear-gradient(160deg,#3a1a8a,#1a7fbf,#a03aa8)':`linear-gradient(160deg,${RMAP[r].color},${shade(RMAP[r].color)})`;
  body.innerHTML = `<div class="econ-bar">
    <div class="ec-box"><b>🎁 Win chest</b>${winDots(wins)}<span>Chest in ${wins}/${ECO.WINS_PER_CHEST} games — any game counts!</span></div>
    <div class="ec-box"><b>🌀 Maze chests</b><span>Every maze clear gives a chest! New levels give Treasure chests.</span></div>
    <div class="ec-box"><b>🐚 Luck shell</b><div class="meter"><i style="width:${Math.round(ECO.cosmicLuck(S)*100)}%"></i></div><span>${h?`✨ ${RMAP[h.tier].name} chest in ${h.n}!`:''}</span></div></div>
    ${nm?`<p class="note ms-note">🏆 Clear <b>Level ${nm.level}</b> for a guaranteed <b>${RMAP[nm.rarity].name}</b> chest!</p>`:''}
    <div class="grid chest-grid">${RARITIES.map(R=>{ const sale=ECO.CHEST_FOR_SALE.includes(R.id); return `<div class="item ${sale?'':'lock'}" data-r="${R.id}" style="background:${bgOf(R.id)}">${rarityBadge(R.id)}${chestHtml(R.id,{mini:true,noBurst:true})}<div class="nm">${R.name}</div><small style="text-align:center">${desc[R.id]}</small>${sale?`<div class="price">${STAR} ${CHEST_PRICE[R.id]}</div>`:'<div class="price locked">🌀 Maze only</div>'}</div>`; }).join('')}</div>
    <div class="shards"><div class="sh-title">🐚 Shell Shards <small>— get one for each repeat prize. ${ECO.SHARDS_TO_CRAFT} shards = pick a prize you don't have!</small></div><div class="sh-row">${ECO.TIERS.map(t=>{ const n=S.shards[t]||0, ok=ECO.canCraft(S,t); return `<div class="sh ${ok?'ready':''}" style="background:${bgOf(t)}"><span class="sh-n">${RMAP[t].name}</span><span class="sh-c">${Math.min(n,99)}/${ECO.SHARDS_TO_CRAFT}</span>${ok?`<button class="btn small green" data-craft="${t}">CRAFT</button>`:''}</div>`; }).join('')}</div></div>
    <p class="note">Most chests are Common or Uncommon. Deeper mazes hide rarer surprises — and a Cosmic friend always shows up if you've been looking for a while. <button class="btn small blue" id="oddsBtn">ODDS (grown-ups)</button></p>`;
  $$('#panelBody .chest-grid .item').forEach(el=>el.onclick=()=>{ ECO.ensureDay(S); const r=el.dataset.r;
    if(!ECO.CHEST_FOR_SALE.includes(r)){ toast(`${RMAP[r].name} chests come from mazes! 🌀`); return; }
    const cost=CHEST_PRICE[r]; if(S.coins<cost){ SFX.miss(); toast(`Need ${cost-S.coins} more starfish ${STAR}`); return; }
    S.coins-=cost; save(); const back=()=>{ hideModal(); renderChests(); }; openChestModal(r,{source:'bought', title:`${RMAP[r].name.toUpperCase()} CHEST`, onClose:back, buttons:[['Awesome!','green awesome',back]]}); });
  $$('#panelBody [data-craft]').forEach(b=>b.onclick=()=>{ SFX.click(); craftPicker(b.dataset.craft); });
  $('#oddsBtn').onclick=()=>{ SFX.click(); oddsModal(); }; }
function craftPicker(t){ const gaps=ECO.tierGaps(S,t); const R=RMAP[t];
  showModal(`<h2>CRAFT A ${R.name.toUpperCase()} PRIZE</h2><p>Pick one! It costs ${ECO.SHARDS_TO_CRAFT} shell shards 🐚</p><div class="grid craft-grid">${gaps.map(g=>itemCard(g.x,'<div class="price">PICK</div>').replace('class="item ','class="item craftpick " data-kind="'+g.kind+'" ')).join('')}</div>`, [['CANCEL','gray',hideModal]]);
  $$('#modalCard .craftpick').forEach(el=>el.onclick=()=>{ const p=ECO.craft(S,t,el.dataset.kind,el.dataset.id); if(!p) return; save(); SFX.chest(R.idx); confetti(R.color);
    const back=()=>{ hideModal(); renderChests(); }; showModal(`<h2>CRAFTED!</h2><div class="prize">${iconHtml(p.x)}<div class="big">${p.x.name}</div><span class="rbadge" style="background:${R.color}">${R.name}</span></div>`, [['Awesome!','green awesome',back]], { onClose:back }); }); }
function oddsModal(){ const pct=v=>(v*100).toFixed(v<.01?1:v<.1?1:0)+'%';
  showModal(`<h2>CHEST ODDS</h2><div class="odds"><table><tr><th>Maze levels</th>${RARITIES.map(R=>`<th>${R.name}</th>`).join('')}</tr>${ECO.LEVEL_BANDS.map(b=>`<tr><td>${b.name} (${b.min}${b.max===Infinity?'+':'–'+b.max})</td>${ECO.TIERS.map(t=>`<td>${pct(b.odds[t])}</td>`).join('')}</tr>`).join('')}</table>
  <p>Every maze clear gives a chest! A new level gives a Treasure chest (odds above). Replays and the bonus chest you get every 5 wins are Play chests: Common 50%, Uncommon 28%, Rare 13%, Epic 6%, Mythic 2%, Ultra Rare 1%. Guarantees: Rare within 8 chests, Epic 13, Mythic 17, Ultra Rare 21. Legendary 25 (15 once you have one) and Cosmic 37 (19 once you have one; odds rise from chest 20) count your first new-level chest each day. Cosmic prizes can show up after 14 days of play. Milestones: Level 5 Rare, 10 Epic, 20 Mythic, 30 Ultra Rare, 40 Legendary, 80 Cosmic. First chest is at least Uncommon.</p>
  <p>Shop chests (Common/Uncommon/Rare only) give exactly the chest you pick — starfish only, no real money. Repeats give starfish back and a shell shard.</p></div>`, [['CLOSE','gray',hideModal]]); }

/* ===================== MATCH CARDS ===================== */
const CARD_POOL = CHARS.filter(c=>c.id!=='hammy' && c.id!=='wade');
const C = {};
function startCards(r){ active='none'; showScreen('cards'); const round=Math.max(1, Math.min(r||S.cardsRound, S.cardsRound)); const pairs=Math.min(4+round*2,12); const pool=[CMAP.ollie, ...CARD_POOL.filter(c=>c.id!=='ollie').sort(()=>Math.random()-.5)].slice(0,pairs);
  const deck=[...pool,...pool].sort(()=>Math.random()-.5); Object.assign(C,{deck, open:[], done:0, pairs, moves:0, t0:0, lock:false, round, missT:null});
  const grid=$('#cardGrid');
  grid.innerHTML=deck.map((c,i)=>`<div class="card" data-i="${i}"><div class="in"><div class="face back">🫧</div><div class="face front">${iconHtml(c,'em')}<b>${c.name.split(' the ')[0]}</b></div></div></div>`).join('');
  layoutCards(); $('#cardsRound').textContent=round; $('#cardsMoves').textContent=0; refreshCoins();
  $$('.card').forEach(el=>el.onclick=()=>flipCard(el)); clearInterval(C.iv); $('#cardsTime').textContent=0; C.iv=setInterval(()=>{ if(C.t0) $('#cardsTime').textContent=Math.floor((performance.now()-C.t0)/1000); },250); }
function layoutCards(){ if(!C.deck) return; const grid=$('#cardGrid'); const top=$('.cards-top').getBoundingClientRect().height; const gap=Math.max(6,innerWidth*.012); const availH=innerHeight-top-gap*3, availW=Math.min(1100,innerWidth)-gap*4;
  // Zinigames: try every column count and keep the one with the biggest cards (re-run on resize/rotate)
  const n=C.deck.length, fit=c=>{ const r=Math.ceil(n/c); return Math.min((availH-gap*(r-1))/r*.75, (availW-gap*(c-1))/c); }; let best=2; for(let c=2;c<=8;c++) if(fit(c)>fit(best)+.5) best=c; C.cols=best; C.rows=Math.ceil(n/best);
  const cw=fit(best); grid.style.gridTemplateColumns=`repeat(${C.cols}, ${cw}px)`; grid.style.gridAutoRows=`${cw/.75}px`; grid.style.gap=gap+'px'; grid.style.setProperty('--cw',cw+'px'); }
addEventListener('resize', ()=>{ if(!$('#cards').classList.contains('hidden')) layoutCards(); });
function flipBack(){ if(!C.missT) return; clearTimeout(C.missT.s); clearTimeout(C.missT.b); C.missT.pair.forEach(x=>x.classList.remove('up','shake')); C.missT=null; C.open=[]; C.lock=false; }
function flipCard(el){ if(C.missT && !C.missT.pair.includes(el) && !el.classList.contains('done')) flipBack(); // Zinigames: tap-through on a miss
  if(C.lock||el.classList.contains('up')||el.classList.contains('done')) return; ac(); SFX.flip(); if(!C.t0) C.t0=performance.now(); el.classList.add('up'); C.open.push(el);
  if(C.open.length===2){ C.moves++; $('#cardsMoves').textContent=C.moves; const [a,b]=C.open; const ca=C.deck[a.dataset.i], cb=C.deck[b.dataset.i];
    if(ca.id===cb.id){ C.open=[]; C.done++; const last=C.done===C.pairs; setTimeout(()=>{ a.classList.add('done'); b.classList.add('done'); SFX.match(); if(last) setTimeout(cardsWin,350); },300); } // Zinigames: clear open pair now so a fast 3rd tap can't get stuck face-up
    else { C.lock=true; const pair=[a,b]; C.missT={pair, s:setTimeout(()=>{ SFX.miss(); a.classList.add('shake'); b.classList.add('shake'); },450), b:setTimeout(()=>{ C.missT=null; a.classList.remove('up','shake'); b.classList.remove('up','shake'); C.open=[]; C.lock=false; },1000)}; } } }
function cardsWin(){ clearInterval(C.iv); const secs=C.t0?Math.round((performance.now()-C.t0)/1000):0; const perfect=C.pairs; const bonus=Math.max(0, C.pairs*3 - (C.moves-perfect)); ECO.ensureDay(S); const ce=ECO.cardsEarn(ECO.CARDS_BASE+C.pairs*2+bonus), earned=ce.earned; S.coins+=earned; S.cardsRound=Math.max(S.cardsRound, C.round+1); const got=noteWin(); save();
  try{ LB.offerSubmit('match', Math.max(1, C.round)); }catch(e){} SFX.win(); confetti('#2ee6d6');
  showModal(`<h2>ALL MATCHED!</h2><div class="prize"><div class="ic">🃏</div><div class="big">${C.moves} moves · ${secs}s</div></div><div class="coinsum">${STAR} ${ECO.CARDS_BASE+C.pairs*2} for finishing + ${bonus} sharp-memory bonus = <b>${earned}</b></div>${winChestHtml(got)}`, [['NEXT ROUND','green',afterChests(()=>{ hideModal(); startCards(C.round+1); })],['LOBBY','blue',afterChests(()=>{ hideModal(); quitToLobby(); })]]); }
$('#cardsQuit').onclick=()=>{ SFX.click(); clearInterval(C.iv); flipBack(); quitToLobby(); };

/* ===================== INIT ===================== */
resize(); warmThumbs(); setLobbyOllie(); save(); refreshLobby(); showScreen('lobby'); requestAnimationFrame(loop);
if(HELLO_TODAY) setTimeout(()=>toast(`Hi ${S.name}! Here's ${ECO.DAILY_LOGIN_STARFISH} ${STAR} for saying hello 👋`),600);
hookLB();
window.__zkidzLB = LB;
window.__zkidz = { S, G, ECO, ITEMS, CHARS, PLAYABLE, isPlayable, quitToLobby, startMaze, startRace, startCards, startSort, startDash, startHide, openPanel, finishMaze, renderChests, openChestModal, hideModal, showModal, setLobbyOllie, buildOllie, charScreenRect, lobbyProbe, get shopTryOn(){ return shopTryOn; }, SAMPLE_LOOKS, lookThumb, HEAVENLY_EQ, LAVA_EQ, IMAP, music:{ get key(){ return musicKey; }, get ready(){ return musicReady; }, get enabled(){ return musicEnabled(); }, get ext(){ return musicFormat(); }, get el(){ return musicA; }, vol:MUSIC_VOL, pickExt:pickAudioExt, unlock:unlockMusic, sync:syncMusic, play:playMusic, setOn:setMusicOn } };
