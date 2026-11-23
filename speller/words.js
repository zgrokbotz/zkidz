/* Ocean Speller words + kid-safe filler check.
 * Every word is shown by a real ZKIDZ 3D character (only playable models, so buildOllie has a rig to animate). */
export const WORDS = [
  // tier 1: 3-4 letters
  { w:'PIP',  c:'pip', t:1 }, { w:'FINN', c:'finn', t:1 }, { w:'NOVA', c:'nova', t:1 }, { w:'WADE', c:'wade', t:1 },
  { w:'GIGA', c:'giga', t:1 }, { w:'DASH', c:'dash', t:1 }, { w:'LULU', c:'lulu', t:1 }, { w:'SEAL', c:'sunny', t:1 },
  { w:'ORCA', c:'oscar', t:1 }, { w:'WAVE', c:'ollie', t:1 }, { w:'FISH', c:'finn', t:1 }, { w:'CRAB', c:'lulu', t:1 },
  // tier 2: 5 letters
  { w:'OLLIE', c:'ollie', t:2 }, { w:'SUNNY', c:'sunny', t:2 }, { w:'JELLY', c:'jelly', t:2 }, { w:'OSCAR', c:'oscar', t:2 },
  { w:'PERCY', c:'percy', t:2 }, { w:'OTTER', c:'ollie', t:2 }, { w:'WHALE', c:'wade', t:2 }, { w:'SQUID', c:'giga', t:2 },
  { w:'CORAL', c:'finn', t:2 }, { w:'SHELL', c:'sunny', t:2 }, { w:'SHARK', c:'wade', t:2 }, { w:'OCEAN', c:'dash', t:2 },
  // tier 3: 6-7 letters
  { w:'KELPIE', c:'kelpie', t:3 }, { w:'BUBBLES', c:'bubbles', t:3 }, { w:'DOLPHIN', c:'dash', t:3 }, { w:'PENGUIN', c:'pip', t:3 },
  { w:'LOBSTER', c:'lulu', t:3 }, { w:'NARWHAL', c:'nova', t:3 }, { w:'SEAWEED', c:'kelpie', t:3 }, { w:'AXOLOTL', c:'bubbles', t:3 },
];
export const MAX_LEVEL = 10;
export function levelConfig(L){
  L=Math.max(1, Math.min(MAX_LEVEL, L|0));
  return {
    level:L,
    tiers: L===1 ? [1] : L===2 ? [1,1,2] : L<=4 ? [1,2,2] : L<=6 ? [2,2,3] : [2,3,3],
    fillers: Math.min(9, 2 + L),          // extra letter bubbles
    speed: 26 + L*5,                       // px/s drift (scaled by screen)
    ghost: L<=3 ? 'all' : L<=6 ? 'first' : 'none',   // faint letters in the slots
    goal: Math.min(8, 2 + Math.ceil(L/2)), // words in one round to level up
  };
}
/* ---- kid-safe blocklist (ROT13 so the list itself is not readable in the source) ---- */
const R13 = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
const BLOCK = ['nff','nefr','ohgg','cbb','cbbc','crr','sneg','pens','cvff','fuvg','fug','shpx','shx','spx','qvpx','pbpx','phz','gvg','obbo','frk','fyhg','jubef','ubr','ovgpu','onfgneq','avt','snt','phag','gjng','jnax','wvmm','chff','encr','cbea','ahqr','anmv','jgs','gheq','fpebg','xvyy']
  .map(R13);
export function blockedIn(seq){
  const s=String(seq||'').toLowerCase().replace(/[^a-z]/g,''); const r=[...s].reverse().join('');
  for(const b of BLOCK){ if(s.includes(b) || r.includes(b)) return b; }
  return null;
}
/* all the orders a child could "read" the visible bubbles in */
export function sequencesOf(bubbles){
  const L=b=>b.ch;
  const spawn=bubbles.map(L).join('');
  const byX=[...bubbles].sort((a,b)=>a.x-b.x || a.y-b.y).map(L).join('');
  const byY=[...bubbles].sort((a,b)=>a.y-b.y || a.x-b.x).map(L).join('');
  return [spawn, byX, byY];
}
export function poolIsSafe(bubbles){ return sequencesOf(bubbles).every(s=>!blockedIn(s)); }
const FILL = 'ABCDEFGHIJKLMNOPRSTUVWY';   // no Q/X/Z fillers (hard to read for little kids)
export function fillerLetters(n, rnd=Math.random){ let o=''; for(let i=0;i<n;i++) o+=FILL[Math.floor(rnd()*FILL.length)]; return o; }
