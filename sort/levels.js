/* Reef Sort — level data, seeded generator and solver (pure logic, no DOM; runs in node for tests).
 * Board model: trays[t] = array of layers, layers[0] is the TOP (playable) layer, each layer = 3 slots.
 * A slot holds a character index or -1 (empty). bar = list of character indexes (max BAR_SIZE).
 * Rules: move any top-layer item (or a bar item) into any empty top-layer slot (or the bar).
 * 3 identical in a tray's top layer -> cleared. 3 identical in the bar -> cleared.
 * When a tray's top layer is empty and it has a layer beneath, that layer rises up.
 * Every shipped level is generated from a fixed seed that the solver below has PROVEN solvable while
 * never using more than 3 of the 5 bar slots (2 spare slots of slack for kids). See tools/find-seeds.mjs. */

export const BAR_SIZE = 5;

// Characters ordered so early levels use the most visually distinct friends.
export const SORT_CHARS = [
  ['ollie','Ollie','#7a4a2c'],['finn','Finn','#ff7a1a'],['stella','Stella','#ff7a1f'],['inky','Inky','#7a3ad8'],
  ['pip','Pip','#1f2a55'],['jelly','Jelly','#c9a6f2'],['pinchy','Pinchy','#e8452f'],['puff','Puff','#ffd23a'],
  ['shelly','Shelly','#4caf50'],['sharkie','Sharkie','#6d8fb0'],['coco','Coco','#ff8a1f'],['dash','Dash','#4aa3df'],
  ['lulu','Lulu','#d8302a'],['zippy','Zippy','#3a6fd8'],['angie','Angie','#ffd23a'],['nudi','Nudi','#7a3ad8'],
  ['polly','Polly','#ff7a2a'],['sunny','Sunny','#8a8f99'],['bubbles','Bubbles','#ff8fc2'],['tusk','Tusk','#8a5a3a'],
  ['squirt','Squirt','#ff6a6a'],['hank','Hank','#f2787a'],['milo','Milo','#22306b'],['echo','Echo','#8ad83a'],
  ['mo','Mo','#9aa39a'],['bella','Bella','#e8eef5'],['gus','Gus','#f5f5f5'],['percy','Percy','#b0b8c4'],
  ['oscar','Oscar','#222222'],['nova','Nova','#8fb3ff'],['wally','Wally','#3f9be8'],['wade','Wade','#5c7aa0'],['hammy','Hammy','#7b8da6'],
].map(([id,name,color])=>({id,name,color}));

/* Level curve. trays = grid size, chars = different friends, sets = how many triples to clear,
 * layers = max stacked layers in a tray, slack = guaranteed empty top-layer slots at the start.
 * seed = verified seed (filled by tools/find-seeds.mjs; generator falls back to a search if missing). */
export const LEVELS = [
  { trays:6,  chars:4,  sets:4,  layers:1, slack:5, seed:1000 },
  { trays:7,  chars:5,  sets:5,  layers:1, slack:5, seed:2000 },
  { trays:7,  chars:5,  sets:7,  layers:2, slack:4, seed:3000 },
  { trays:8,  chars:6,  sets:8,  layers:2, slack:4, seed:4000 },
  { trays:9,  chars:6,  sets:10, layers:2, slack:4, seed:5000 },
  { trays:9,  chars:7,  sets:11, layers:2, slack:4, seed:6000 },
  { trays:10, chars:7,  sets:13, layers:3, slack:4, seed:7000 },
  { trays:10, chars:8,  sets:15, layers:3, slack:3, seed:8000 },
  { trays:12, chars:8,  sets:17, layers:3, slack:4, seed:9000 },
  { trays:12, chars:9,  sets:19, layers:3, slack:3, seed:10000 },
  { trays:12, chars:10, sets:21, layers:4, slack:3, seed:11000 },
  { trays:12, chars:11, sets:24, layers:4, slack:3, seed:12000 },
];
export const LEVEL_COUNT = LEVELS.length;

export function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
const shuffle=(a,r)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/** Params for level n (1-based). Past the last level we serve endless "bonus" levels at max difficulty. */
export function levelParams(n){ if(n<=LEVELS.length) return { ...LEVELS[n-1], n }; const last=LEVELS[LEVELS.length-1]; return { ...last, chars:Math.min(12, last.chars+1), seed:null, n, bonus:true }; }

/** Pick which friends appear: early levels draw from the most distinct ones; the pool widens as levels go up. */
function pickChars(p, r){ const poolSize=Math.min(SORT_CHARS.length, p.chars + 2*p.n); const pool=shuffle([...Array(poolSize).keys()], r); return pool.slice(0, p.chars); }

/** Lay out a list of items (char indexes) over T trays with up to L layers. Returns trays or null. */
export function layout(items, T, L, slack, r){
  const N=items.length;
  for(let attempt=0; attempt<60; attempt++){
    const totalLayers=Math.max(T, Math.min(T*L, Math.round(N/2.4)));
    const lc=new Array(T).fill(1); let extra=totalLayers-T;
    while(extra>0){ const open=[...Array(T).keys()].filter(i=>lc[i]<L); if(!open.length) break; lc[open[Math.floor(r()*open.length)]]++; extra--; }
    // per-layer item counts: top >=1, hidden >=2, all <=3; top total <= 3T - slack
    const cnt=lc.map(k=>Array.from({length:k},(_,l)=>l===0?1:2));
    let R=N-cnt.flat().reduce((a,b)=>a+b,0); if(R<0) continue;
    const topCap=3*T-slack; let topSum=T;
    const spots=[]; cnt.forEach((ls,t)=>ls.forEach((_,l)=>spots.push([t,l])));
    let guard=0;
    while(R>0 && guard++<5000){ const [t,l]=spots[Math.floor(r()*spots.length)]; if(cnt[t][l]>=3) continue; if(l===0){ if(topSum>=topCap) continue; topSum++; } cnt[t][l]++; R--; }
    if(R>0) continue;
    for(let s=0;s<40;s++){
      const bag=shuffle([...items], r); let k=0, bad=false;
      const trays=cnt.map(ls=>ls.map(c=>{ const lay=[-1,-1,-1]; const pos=shuffle([0,1,2],r).slice(0,c); for(const p of pos) lay[p]=bag[k++]; return lay; }));
      for(const tr of trays) for(const lay of tr){ if(lay[0]>=0 && lay[0]===lay[1] && lay[1]===lay[2]) bad=true; }
      if(!bad) return trays;
    }
  }
  return null;
}

export function generate(p, seed){
  const r=rng(seed); const chars=pickChars(p, r);
  const items=[]; for(let i=0;i<p.sets;i++){ const c=chars[i%chars.length]; items.push(c,c,c); }
  const trays=layout(items, p.trays, p.layers, p.slack, r); if(!trays) return null;
  return { trays, bar:[], chars, seed };
}

/* ---------------- rules on the compact state ---------------- */
export function cloneState(st){ return { trays:st.trays.map(tr=>tr.map(l=>l.slice())), bar:st.bar.slice() }; }
export function itemsLeft(st){ let n=st.bar.length; for(const tr of st.trays) for(const l of tr) for(const x of l) if(x>=0) n++; return n; }
const top=(st,t)=>st.trays[t][0];
function settle(st,t){ const tr=st.trays[t]; while(tr.length>1 && tr[0].every(x=>x<0)) tr.shift(); }
/** move = { from:{t}|{bar:true}, c, to:{t}|{bar:true} }. Mutates st. Returns list of cleared {where,c}. */
export function applyMove(st, mv){
  const cleared=[];
  if(mv.from.bar){ st.bar.splice(st.bar.indexOf(mv.c),1); } else { const l=top(st,mv.from.t); l[l.indexOf(mv.c)]=-1; }
  if(mv.to.bar){ st.bar.push(mv.c); if(st.bar.filter(x=>x===mv.c).length===3){ st.bar=st.bar.filter(x=>x!==mv.c); cleared.push({where:'bar',c:mv.c}); } }
  else { const l=top(st,mv.to.t); l[l.indexOf(-1)]=mv.c; if(l[0]>=0 && l[0]===l[1] && l[1]===l[2]){ l.fill(-1); cleared.push({where:mv.to.t,c:mv.c}); } settle(st,mv.to.t); }
  if(!mv.from.bar) settle(st,mv.from.t);
  return cleared;
}
function key(st){ return st.trays.map(tr=>tr.map(l=>l.filter(x=>x>=0).sort((a,b)=>a-b).join(',')).join('|')).sort().join('/')+'#'+st.bar.slice().sort((a,b)=>a-b).join(','); }

function movesFor(st, barCap){
  const out=[]; const T=st.trays.length;
  const srcs=[]; for(let t=0;t<T;t++){ const l=top(st,t); const u=[...new Set(l.filter(x=>x>=0))]; for(const c of u) srcs.push({from:{t},c}); }
  for(const c of new Set(st.bar)) srcs.push({from:{bar:true},c});
  const dests=[]; for(let t=0;t<T;t++) if(top(st,t).includes(-1)) dests.push(t);
  for(const s of srcs){
    let srcScore=0;
    if(s.from.bar) srcScore+=50; else { const l=top(st,s.from.t); const n=l.filter(x=>x>=0).length, nc=l.filter(x=>x===s.c).length;
      if(n===1) srcScore+= st.trays[s.from.t].length>1 ? 80 : 20; if(nc>=2 && n===nc) srcScore-=200; else if(nc===1 && n>1) srcScore+=10; }
    for(const d of dests){ if(!s.from.bar && d===s.from.t) continue; const l=top(st,d); const cd=l.filter(x=>x===s.c).length, od=l.filter(x=>x>=0 && x!==s.c).length;
      let sc=srcScore; if(cd===2) sc+=1000; else if(od===0) sc+=100*cd+(cd===0?5:20); else sc-=50; out.push({from:s.from,c:s.c,to:{t:d},sc}); }
    if(!s.from.bar && st.bar.length<barCap){ const cb=st.bar.filter(x=>x===s.c).length; out.push({from:s.from,c:s.c,to:{bar:true},sc: srcScore + (cb===2?900:-60-10*st.bar.length+15*cb)}); }
  }
  // fix: completing moves from a pure pair are great, not "breaking"
  for(const m of out) if(m.sc<0 && m.sc>-400 && m.to.t!==undefined && top(st,m.to.t).filter(x=>x===m.c).length===2) m.sc+=200;
  out.sort((a,b)=>b.sc-a.sc);
  return out;
}

/** Depth-first search with memo. Sound (any returned plan really solves the board), not complete.
 *  barCap limits how many bar slots the plan may use. Returns { ok, moves, maxBar, nodes }. */
export function solve(st0, { barCap=BAR_SIZE, nodeCap=40000 }={}){
  const seen=new Set(); let nodes=0; const path=[]; let best=null;
  const rec=(st, maxBar)=>{
    if(itemsLeft(st)===0){ best={ moves:path.slice(), maxBar }; return true; }
    if(++nodes>nodeCap) return false;
    const k=key(st); if(seen.has(k)) return false; seen.add(k);
    for(const m of movesFor(st, barCap)){
      const ns=cloneState(st); applyMove(ns, m); path.push({from:m.from,c:m.c,to:m.to});
      if(rec(ns, Math.max(maxBar, ns.bar.length))) return true;
      path.pop(); if(nodes>nodeCap) return false;
    }
    return false;
  };
  const ok=rec(cloneState(st0), st0.bar.length);
  return { ok, moves: ok?best.moves:[], maxBar: ok?best.maxBar:null, nodes };
}

/** Build a verified level. Uses the stored seed when present, else searches from a base seed. */
export function buildLevel(n, baseSeed){
  const p=levelParams(n);
  const tryOne=(seed)=>{ const g=generate(p, seed); if(!g) return null; const s=solve(g,{barCap:3}); return s.ok ? { ...g, params:p, plan:s.moves } : null; };
  if(p.seed!=null){ const g=tryOne(p.seed); if(g) return g; }
  const base = baseSeed ?? (p.seed ?? (n*1000));
  for(let k=1;k<400;k++){ const g=tryOne(base+k); if(g) return g; }
  throw new Error('no solvable layout for level '+n);
}

/** Reshuffle all remaining items into a fresh, solver-verified layout (used by the free Shuffle). */
export function reshuffle(st, L, r=Math.random){
  const items=[]; for(const tr of st.trays) for(const l of tr) for(const x of l) if(x>=0) items.push(x); items.push(...st.bar);
  let T=st.trays.length;
  for(let extraTrays=0; extraTrays<4; extraTrays++, T++){
    for(let a=0;a<25;a++){ const trays=layout(items, T, Math.max(1,L), Math.min(3*T-1, 4+extraTrays*3), r); if(!trays) continue; const ns={trays,bar:[]}; if(solve(ns,{barCap:4,nodeCap:15000}).ok) return { state:ns, addedTrays:T-st.trays.length }; }
  }
  // last resort: one item group per tray (always solvable)
  const trays=[]; const byC={}; for(const x of items) (byC[x]=byC[x]||[]).push(x); for(const c in byC){ const xs=byC[c]; for(let i=0;i<xs.length;i+=3){ const l=[-1,-1,-1]; for(let j=0;j<3 && i+j<xs.length;j++) l[j]=xs[i+j]; trays.push([l]); } }
  while(trays.length<st.trays.length) trays.push([[-1,-1,-1]]);
  return { state:{trays,bar:[]}, addedTrays:trays.length-st.trays.length };
}
