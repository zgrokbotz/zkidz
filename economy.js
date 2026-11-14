/* ZKIDZ chest & starfish economy v1 — adapted from Zokenomics' chest-dropin.js / chest-economy-v1.md.
 * (Zokenomics' original files live in /workspace/zokenomics and are not modified.)
 * Differences from the drop-in sketch, on purpose:
 *  - Shard crafting is kid-pick (Chests panel), not automatic random.
 *  - Shards are only given for dups while that tier still has gaps (afterwards the collector bonus applies).
 *  - Milestone chests are granted once each, even if the 2 free chests for the day were already used
 *    (levels only move forward, so otherwise a kid could miss a milestone forever). They still count toward the day.
 *  - chestsOpened (trophies) counts every open, not just new prizes. */
export const TIERS = ['common','uncommon','rare','epic','mythic','ultra','legendary','cosmic'];
export const TIDX = Object.fromEntries(TIERS.map((t,i)=>[t,i]));
export const PITY_TIERS = ['rare','epic','mythic','ultra','legendary','cosmic'];
const CLOTHES_SLOTS = new Set(['hat','top','bottom','shoes']);
const ACCESSORY_SLOTS = new Set(['eyes','wrist','hands']);

export const PRICE = { common:100, uncommon:150, rare:250, epic:400, mythic:600, ultra:900, legendary:1300, cosmic:2000 };
export const CHEST_FOR_SALE = ['common','uncommon','rare'];
export const CHEST_PRICE = { common:150, uncommon:280, rare:500 };
export const DUP_REFUND_RATE = 0.40;
export const COLLECTOR_BONUS = { common:10, uncommon:14, rare:18, epic:22, mythic:28, ultra:34, legendary:42, cosmic:50 };
export const SHARDS_PER_DUP = 1, SHARDS_TO_CRAFT = 8;
const PREFER_UNOWNED = 0.85, PREFER_UNOWNED_HIGH = 1.0, PREFER_UNOWNED_FROM = 'ultra';
const FIRST_CHEST_MIN = 'uncommon';
export const MIX = {
  common:{clothes:.60,accessory:.15,character:.25}, uncommon:{clothes:.50,accessory:.20,character:.30},
  rare:{clothes:.45,accessory:.20,character:.35},   epic:{clothes:.40,accessory:.20,character:.40},
  mythic:{clothes:.35,accessory:.20,character:.45}, ultra:{clothes:.35,accessory:.20,character:.45},
  legendary:{clothes:.40,accessory:.25,character:.35}, cosmic:{clothes:.40,accessory:.25,character:.35} };
export const BONUS_STARFISH = { common:[5,10], uncommon:[8,14], rare:[12,18], epic:[16,24], mythic:[22,32], ultra:[28,40], legendary:[36,50], cosmic:[50,75] };
export const LEVEL_BANDS = [
  { id:'tide_pools', name:'Tide Pools', min:1,  max:4,  odds:{ common:.42, uncommon:.28, rare:.16, epic:.08, mythic:.035, ultra:.016, legendary:.007, cosmic:.002 } },
  { id:'reef',       name:'Reef',       min:5,  max:9,  odds:{ common:.32, uncommon:.26, rare:.18, epic:.11, mythic:.07,  ultra:.035, legendary:.018, cosmic:.007 } },
  { id:'deep_sea',   name:'Deep Sea',   min:10, max:19, odds:{ common:.24, uncommon:.24, rare:.20, epic:.13, mythic:.09,  ultra:.055, legendary:.030, cosmic:.015 } },
  { id:'abyss',      name:'Abyss',      min:20, max:Infinity, odds:{ common:.20, uncommon:.22, rare:.20, epic:.14, mythic:.105, ultra:.07, legendary:.045, cosmic:.020 } },
];
export const PITY = { rare:{hard:7}, epic:{hard:12}, mythic:{hard:16}, ultra:{hard:20}, legendary:{hard:24,hardAfterOwned:14}, cosmic:{soft:20,hard:36,hardAfterOwned:18} };
export const MILESTONE_CHEST = { 5:'rare', 10:'epic', 20:'mythic', 30:'ultra', 40:'legendary', 50:'cosmic' };
export const DAILY_LOGIN_STARFISH = 10, MAZE_FINISH_BONUS = 10, RACE_FINISH_BONUS = 10, RACE_COLLECT_CAP = 18;
export const FREE_CHEST_DAILY_CAP = 2, BOUGHT_CHEST_DAILY_CAP = 2, DAILY_FULL_REWARD_ACTIVITIES = 3;
export const OPENING_SHOW = { common:[.8,1.2], uncommon:[1.2,1.6], rare:[1.6,2.0], epic:[2.0,2.6], mythic:[2.4,3.0], ultra:[2.8,3.4], legendary:[3.2,4.0], cosmic:[3.5,4.5] };

let ITEMS=[], CHARS=[];
export function initEconomy(items, chars){ ITEMS=items; CHARS=chars; }

/* ---------- save migration + calendar day ---------- */
export function todayStr(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function migrateSave(S){
  S.pity = Object.assign({ rare:0, epic:0, mythic:0, ultra:0, legendary:0, cosmic:0 }, S.pity||{});
  S.shards = Object.assign(Object.fromEntries(TIERS.map(t=>[t,0])), S.shards||{});
  for(const k of ['freeChestsToday','boughtChestsToday','activitiesToday']) if(typeof S[k]!=='number') S[k]=0;
  if(typeof S.playDate!=='string') S.playDate='';
  if(typeof S.loginDate!=='string') S.loginDate='';
  if(!S.gotTier){ S.gotTier={}; for(const i of ITEMS) if(S.owned.includes(i.id)) S.gotTier[i.r]=true; for(const c of CHARS) if(c.id!=='ollie' && S.chars.includes(c.id)) S.gotTier[c.r]=true; }
  if(typeof S.firstChestDone!=='boolean') S.firstChestDone = (S.chestsOpened>0) || S.owned.length>0 || S.chars.length>1;
  if(!Array.isArray(S.milestones)){ // existing players don't get retroactive milestones for levels already cleared
    S.milestones = Object.keys(MILESTONE_CHEST).map(Number).filter(l=>l<=(S.bestLevel||0)); }
  S.econ = 1;
  return S;
}
/** Call often (load, before activities/purchases). Resets daily counters on a new local calendar day.
 *  Returns true when the once-a-day hello (+10) was just granted. No streaks, nothing lost by skipping days. */
export function ensureDay(S){
  const t=todayStr();
  if(S.playDate!==t){ S.playDate=t; S.freeChestsToday=0; S.boughtChestsToday=0; S.activitiesToday=0; }
  if(S.loginDate!==t){ S.loginDate=t; S.coins+=DAILY_LOGIN_STARFISH; return true; }
  return false;
}

/* ---------- starfish earn ---------- */
export function mazeCollectCap(level){ return 10 + 2*Math.min(level,10); }
export function fullPay(S){ return S.activitiesToday < DAILY_FULL_REWARD_ACTIVITIES; }
export function mazeEarn(S, collected, level){ const credited=Math.min(collected, mazeCollectCap(level)); const full=fullPay(S); const base=credited+MAZE_FINISH_BONUS;
  return { credited, bonus:MAZE_FINISH_BONUS, full, earned: full? base : Math.max(10, Math.floor(base/2)) }; }
export function raceEarn(S, collected){ const credited=Math.min(collected, RACE_COLLECT_CAP); const full=fullPay(S); const base=credited+RACE_FINISH_BONUS;
  return { credited, bonus:RACE_FINISH_BONUS, full, earned: full? base : Math.max(5, Math.floor(base/2)) }; }
export function cardsEarn(S, base){ const full=fullPay(S); return { full, earned: full? base : Math.max(5, Math.floor(base/2)) }; }

/* ---------- rarity rolls + pity ---------- */
export function bandFor(level){ return LEVEL_BANDS.find(b=>level>=b.min && level<=b.max) || LEVEL_BANDS[LEVEL_BANDS.length-1]; }
const rollRange = ([lo,hi]) => lo + Math.floor(Math.random()*(hi-lo+1));
const hasTier = (t,S) => !!(S.gotTier && S.gotTier[t]);
export function tierHard(t, S){ const p=PITY[t]; return (hasTier(t,S) && p.hardAfterOwned) ? p.hardAfterOwned : p.hard; }
function applySoftPity(odds, count, soft, hard){
  if(count < soft) return odds;
  const k=Math.min(1,(count-soft)/Math.max(1,hard-soft)); const target=odds.cosmic+(.28-odds.cosmic)*k; const others=1-odds.cosmic; const out={};
  for(const t of TIERS) out[t] = t==='cosmic'? target : (others? odds[t]*(1-target)/others : 0); return out; }
export function rollRarity(level, S, firstFree){
  for(let i=PITY_TIERS.length-1;i>=0;i--){ const t=PITY_TIERS[i]; if(S.pity[t] >= tierHard(t,S)) return { rarity:t, source:'hard_pity' }; }
  let odds={...bandFor(level).odds}; let soft=PITY.cosmic.soft; if(hasTier('cosmic',S)) soft=Math.min(soft,8);
  odds=applySoftPity(odds, S.pity.cosmic, soft, tierHard('cosmic',S));
  let acc=0, x=Math.random(), rarity='common'; for(const t of TIERS){ acc+=odds[t]; if(x<=acc){ rarity=t; break; } }
  if(firstFree && TIDX[rarity] < TIDX[FIRST_CHEST_MIN]) rarity=FIRST_CHEST_MIN;
  return { rarity, source:'roll' };
}
export function updatePityAfterOpen(S, rarity, source){
  if(source==='bought') return; // purchased chests never move pity
  const ri=TIDX[rarity]; for(const t of PITY_TIERS){ if(ri>=TIDX[t]) S.pity[t]=0; else S.pity[t]+=1; }
}
/** Maze clear → { rarity, source } or null (daily free-chest cap reached). */
export function mazeChestRarity(level, S){
  const m=MILESTONE_CHEST[level];
  if(m && !S.milestones.includes(level)) return { rarity:m, source:'milestone' };
  if(S.freeChestsToday >= FREE_CHEST_DAILY_CAP) return null;
  return rollRarity(level, S, !S.firstChestDone);
}
export function noteFreeChest(S, level, source){ S.freeChestsToday++; S.firstChestDone=true; if(source==='milestone' && !S.milestones.includes(level)) S.milestones.push(level); }
/** Closest guarantee for the kid-facing hint, e.g. { tier:'epic', n:3 } = "Epic chest (or better) within 3 maze chests". */
export function pityHint(S){
  let best=null; for(const t of PITY_TIERS){ if(t==='rare') continue; const n=Math.max(1, tierHard(t,S)-S.pity[t]+1); if(!best || n<best.n || (n===best.n && TIDX[t]>TIDX[best.tier])) best={tier:t,n}; }
  return best;
}
export function cosmicLuck(S){ return Math.min(1, S.pity.cosmic / tierHard('cosmic',S)); }
export function nextMilestone(S){ const lv=Object.keys(MILESTONE_CHEST).map(Number).find(l=>!S.milestones.includes(l) && l>=(S.level||1)); return lv? { level:lv, rarity:MILESTONE_CHEST[lv] } : null; }

/* ---------- prizes ---------- */
const isOwned = (S,kind,id) => kind==='item'? S.owned.includes(id) : S.chars.includes(id);
export function tierGaps(S, rarity){
  return [...ITEMS.filter(i=>i.r===rarity && !S.owned.includes(i.id)).map(x=>({kind:'item',x})),
          ...CHARS.filter(c=>c.r===rarity && c.id!=='ollie' && !S.chars.includes(c.id)).map(x=>({kind:'char',x}))];
}
function grant(S, p, rarity){ if(p.kind==='item') S.owned.push(p.x.id); else S.chars.push(p.x.id); S.gotTier[rarity]=true; }
/** Returns { kind, x, dup, bonus, refund, shard }. Mutates S (coins, owned/chars, shards, chestsOpened). */
export function rollPrize(rarity, S){
  const bonus=rollRange(BONUS_STARFISH[rarity]);
  const items=ITEMS.filter(i=>i.r===rarity), chars=CHARS.filter(c=>c.r===rarity && c.id!=='ollie');
  const bag={ clothes:items.filter(i=>CLOTHES_SLOTS.has(i.slot)).map(x=>({kind:'item',x})), accessory:items.filter(i=>ACCESSORY_SLOTS.has(i.slot)).map(x=>({kind:'item',x})), character:chars.map(x=>({kind:'char',x})) };
  const mix=MIX[rarity]; const cats=Object.keys(bag).filter(c=>bag[c].length);
  S.chestsOpened=(S.chestsOpened||0)+1; S.coins+=bonus;
  if(!cats.length) return { bonus, dup:false, refund:0 };
  const wsum=cats.reduce((s,c)=>s+mix[c],0); let u=Math.random()*wsum, cat=cats[cats.length-1]; for(const c of cats){ u-=mix[c]; if(u<=0){ cat=c; break; } }
  const prefer = TIDX[rarity]>=TIDX[PREFER_UNOWNED_FROM] ? PREFER_UNOWNED_HIGH : PREFER_UNOWNED;
  const unownedIn = arr => arr.filter(p=>!isOwned(S,p.kind,p.x.id));
  let pool=bag[cat], unowned=unownedIn(pool);
  if(!unowned.length){ const allUn=cats.flatMap(c=>unownedIn(bag[c])); if(allUn.length && Math.random()<prefer){ pool=allUn; unowned=allUn; } }
  const p = (unowned.length && Math.random()<prefer) ? unowned[Math.floor(Math.random()*unowned.length)] : pool[Math.floor(Math.random()*pool.length)];
  const owned=isOwned(S,p.kind,p.x.id); let refund=0, shard=0;
  if(owned){ const gaps=tierGaps(S,rarity).length>0; if(gaps){ refund=Math.round(PRICE[rarity]*DUP_REFUND_RATE); shard=SHARDS_PER_DUP; S.shards[rarity]=(S.shards[rarity]||0)+shard; } else refund=COLLECTOR_BONUS[rarity]; S.coins+=refund; }
  else grant(S,p,rarity);
  return { ...p, dup:owned, bonus, refund, shard };
}
export function canCraft(S, rarity){ return (S.shards[rarity]||0)>=SHARDS_TO_CRAFT && tierGaps(S,rarity).length>0; }
/** Kid picks a missing prize of that tier; spends 8 shards. */
export function craft(S, rarity, kind, id){
  if(!canCraft(S,rarity)) return null; const p=tierGaps(S,rarity).find(g=>g.kind===kind && g.x.id===id); if(!p) return null;
  S.shards[rarity]-=SHARDS_TO_CRAFT; grant(S,p,rarity); return p;
}
export function showMs(rarity){ const [a,b]=OPENING_SHOW[rarity]; return Math.round((a+Math.random()*(b-a))*1000); }
