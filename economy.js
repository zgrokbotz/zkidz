/* ZKIDZ chest & starfish economy v2 — from Zokenomics' economy-v2-dropin.js / economy-v2.md (approved by Zander).
 * (Zokenomics' original files live in /workspace/zokenomics and are not modified.)
 * v2: no half pay, no bag caps, no daily earn caps, no daily chest limits. Every maze clear gives a chest
 * (first clear = Treasure chest with level-band odds, replay = Play chest), every 5 wins in any mode = a Play chest,
 * all-starfish bonus on maze/race, lobby progress bar. Soft Cosmic safeguards (not earn caps): only one Treasure
 * chest a day can roll/pity Legendary or Cosmic, Cosmic can't drop before play day 14, Cosmic milestone at level 80.
 * Kept from v1 on purpose: shard crafting is kid-pick (Chests panel); shards only while a tier has gaps;
 * chestsOpened counts every open. Zander's change: Epic shop ITEMS cost 800 (ITEM_PRICE); refunds/characters use PRICE. */
export const TIERS = ['common','uncommon','rare','epic','mythic','ultra','legendary','cosmic'];
export const TIDX = Object.fromEntries(TIERS.map((t,i)=>[t,i]));
export const PITY_TIERS = ['rare','epic','mythic','ultra','legendary','cosmic'];
export const HIGH_PITY_TIERS = ['legendary','cosmic'];
const CLOTHES_SLOTS = new Set(['hat','top','bottom','shoes']);
const ACCESSORY_SLOTS = new Set(['eyes','wrist','hands']);

/* ---------- prices (unchanged except Epic items, see ITEM_PRICE) ---------- */
export const PRICE = { common:100, uncommon:150, rare:250, epic:400, mythic:600, ultra:900, legendary:1300, cosmic:2000 };
export const CHEST_FOR_SALE = ['common','uncommon','rare'];
export const CHEST_PRICE = { common:150, uncommon:280, rare:500 };
export const CHEST_ONLY_TIERS = new Set(['legendary','cosmic']);
/** Shop price for ITEMS. Zander: Epic items 800 (was 400). Characters stay 2x PRICE; dup refunds stay 40% of PRICE. */
export const ITEM_PRICE = { ...PRICE, epic:800 };

/* ---------- payouts (raised; no caps) ---------- */
export const DAILY_LOGIN_STARFISH = 15;     // was 10
export const MAZE_FINISH_BONUS = 20;        // was 10
export const RACE_FINISH_BONUS = 20;        // was 10
export const RACE_SPAWN = 48;               // unchanged spawn; ALL collected now credit
export const CARDS_BASE = 15;               // was 10; cards still 15 + 2*pairs + memory bonus
export const REEF_SORT_FIRST_CLEAR = 30;    // was 20
export const REEF_SORT_REPLAY = 15;         // was 10
export const RS_BONUS_MIN_LEVEL = 7, RS_COMBO2 = 2, RS_COMBO3 = 3, RS_ROW_CLEAR = 3;
export const RS_BONUS_LEVEL_CAP = 6;        // KEEP per-level skill cap
// RS_BONUS_DAILY_CAP removed. REEF_SORT_LEVELS_PER_ACTIVITY removed (no activity half-pay).
// mazeCollectCap, RACE_COLLECT_CAP, DAILY_FULL_REWARD_ACTIVITIES,
// FREE_CHEST_DAILY_CAP, BOUGHT_CHEST_DAILY_CAP all removed.

export const ALL_CLEAR_PCT = 0.25, ALL_CLEAR_FLOOR = 10, ALL_CLEAR_CAP = 40;
export function allClearBonus(collected, finishBonus){
  return Math.max(ALL_CLEAR_FLOOR, Math.min(ALL_CLEAR_CAP, Math.round(ALL_CLEAR_PCT*(collected+finishBonus))));
}

/* ---------- 5-win Play chests ---------- */
export const WINS_PER_CHEST = 5;
/** Lean Common–Rare. Legendary & Cosmic are 0% so Reef Sort grinding cannot rush the top. */
export const PLAY_CHEST_ODDS = { common:.50, uncommon:.28, rare:.13, epic:.06, mythic:.02, ultra:.01, legendary:0, cosmic:0 };

/* ---------- Cosmic / Legendary soft safeguards (not earn caps) ---------- */
export const COSMIC_UNLOCK_PLAY_DAYS = 14;  // earliest calendar play-day a Cosmic can drop
export const HIGH_TREASURE_PER_DAY = 1;     // Treasure chests that can roll / pity Leg+Cosmic per day

/* ---------- chest tables, pity, mix (v1, plus Cosmic milestone moved to 80) ---------- */
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
export const MILESTONE_CHEST = { 5:'rare', 10:'epic', 20:'mythic', 30:'ultra', 40:'legendary', 80:'cosmic' }; // Cosmic was 50
export const OPENING_SHOW = { common:[.8,1.2], uncommon:[1.2,1.6], rare:[1.6,2.0], epic:[2.0,2.6], mythic:[2.4,3.0], ultra:[2.8,3.4], legendary:[3.2,4.0], cosmic:[3.5,4.5] };
export const VANITY_SINK = { unlockHintDay:25, minBalance:900, price:180 }; // repeating cosmetic; needed as a late-game sink

let ITEMS=[], CHARS=[];
export function initEconomy(items, chars){ ITEMS=items; CHARS=chars; }

/* ---------- save migration + calendar day ---------- */
export function todayStr(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function migrateSave(S){
  S.pity = Object.assign({ rare:0, epic:0, mythic:0, ultra:0, legendary:0, cosmic:0 }, S.pity||{});
  S.shards = Object.assign(Object.fromEntries(TIERS.map(t=>[t,0])), S.shards||{});
  if(typeof S.playDate!=='string') S.playDate='';
  if(typeof S.loginDate!=='string') S.loginDate='';
  if(typeof S.playDays!=='number') S.playDays=0;
  if(typeof S.winsTowardChest!=='number') S.winsTowardChest=0;          // 0..4, then a Play chest and reset
  if(typeof S.highTreasureToday!=='boolean') S.highTreasureToday=false; // high-pity Treasure already used today
  if(typeof S.mazeAllClears!=='number') S.mazeAllClears=0;
  if(typeof S.raceAllClears!=='number') S.raceAllClears=0;
  if(!Array.isArray(S.pendingChests)) S.pendingChests=[];                // rolled Play/Treasure chests waiting to open (survives reload)
  if(typeof S.cosmicNoticeSeen!=='boolean') S.cosmicNoticeSeen=false;  // one-time "Cosmic needs ~2 weeks + Maze 80" notice for v1 players
  // legacy daily counters: keep for compatibility, but v2 does not gate on them
  for(const k of ['freeChestsToday','boughtChestsToday','activitiesToday','rsBonusToday']) if(typeof S[k]!=='number') S[k]=0;
  if(!S.gotTier){ S.gotTier={}; for(const i of ITEMS) if(S.owned.includes(i.id)) S.gotTier[i.r]=true; for(const c of CHARS) if(c.id!=='ollie' && S.chars.includes(c.id)) S.gotTier[c.r]=true; }
  if(typeof S.firstChestDone!=='boolean') S.firstChestDone = (S.chestsOpened>0) || S.owned.length>0 || S.chars.length>1;
  if(!Array.isArray(S.milestones)) S.milestones = Object.keys(MILESTONE_CHEST).map(Number).filter(l=>l<=(S.bestLevel||0) && l!==80);
  // Players who already passed old Cosmic milestone 50 do not get a free Cosmic; they wait for 80 or a natural drop after day 14.
  S.econ = 2;
  return S;
}
/** Call often. Resets the once-per-day high-treasure flag. Grants the hello Starfish. No streaks. */
export function ensureDay(S){
  const t=todayStr();
  if(S.playDate!==t){ S.playDate=t; S.highTreasureToday=false; S.freeChestsToday=0; S.boughtChestsToday=0; S.activitiesToday=0; S.rsBonusToday=0; }
  if(S.loginDate!==t){ S.loginDate=t; S.playDays=(S.playDays||0)+1; S.coins+=DAILY_LOGIN_STARFISH; return true; }
  return false;
}
export function cosmicUnlocked(S){ return (S.playDays||0) >= COSMIC_UNLOCK_PLAY_DAYS; }

/* ---------- starfish earn (uncapped) ---------- */
export function mazeEarn(collected, allClear=false){
  const bonus=MAZE_FINISH_BONUS; const clear=allClear? allClearBonus(collected, bonus):0;
  return { credited:collected, bonus, allClear:clear, earned:collected+bonus+clear };
}
export function raceEarn(collected, allClear=false){
  const bonus=RACE_FINISH_BONUS; const clear=allClear? allClearBonus(collected, bonus):0;
  return { credited:collected, bonus, allClear:clear, earned:collected+bonus+clear };
}
export function cardsEarn(base){ return { earned:base }; } // no half-pay
export function reefEarn(firstClear, skillBonus=0){
  const base=firstClear? REEF_SORT_FIRST_CLEAR : REEF_SORT_REPLAY;
  const skill=Math.max(0, Math.min(RS_BONUS_LEVEL_CAP, skillBonus|0));
  return { base, skill, earned:base+skill };
}

/* ---------- rarity rolls + pity ---------- */
export function bandFor(level){ return LEVEL_BANDS.find(b=>level>=b.min && level<=b.max) || LEVEL_BANDS[LEVEL_BANDS.length-1]; }
const rollRange = ([lo,hi]) => lo + Math.floor(Math.random()*(hi-lo+1));
const hasTier = (t,S) => !!(S.gotTier && S.gotTier[t]);
export function tierHard(t, S){ const p=PITY[t]; return (hasTier(t,S) && p.hardAfterOwned) ? p.hardAfterOwned : p.hard; }
function applySoftPity(odds, count, soft, hard){
  if(count < soft) return odds;
  const k=Math.min(1,(count-soft)/Math.max(1,hard-soft)); const target=odds.cosmic+(.28-odds.cosmic)*k; const others=1-odds.cosmic; const out={};
  for(const t of TIERS) out[t] = t==='cosmic'? target : (others? odds[t]*(1-target)/others : 0); return out; }
function zeroHigh(odds){ const out={...odds}; const bump=(out.legendary||0)+(out.cosmic||0); out.legendary=0; out.cosmic=0; out.common+=bump; return out; }
function zeroCosmic(odds){ const out={...odds}; out.legendary+=out.cosmic; out.cosmic=0; return out; }
function pickOdds(odds){ let acc=0, x=Math.random(), rarity='common'; for(const t of TIERS){ acc+=odds[t]; if(x<=acc){ rarity=t; break; } } return rarity; }

/** incrementPity(S, rarity, {high}): high=false skips Legendary/Cosmic counters. */
export function incrementPity(S, rarity, {high=true}={}){
  const ri=TIDX[rarity];
  for(const t of PITY_TIERS){
    if(!high && HIGH_PITY_TIERS.includes(t)) continue;
    if(ri>=TIDX[t]) S.pity[t]=0; else S.pity[t]+=1;
  }
}

function hardPityHit(S, {high}){
  const list = high ? [...PITY_TIERS].reverse() : ['ultra','mythic','epic','rare'];
  for(const t of list){
    if(t==='cosmic' && !cosmicUnlocked(S)) continue;
    if(S.pity[t] >= tierHard(t,S)) return t;
  }
  return null;
}

/**
 * Treasure chest (maze first-clear of a level, or a milestone).
 * The first Treasure of the local calendar day may roll Legendary/Cosmic and
 * increments high pity. Later Treasures the same day use the same band with
 * Leg/Cosmic zeroed, and only increment Rare–Ultra pity.
 */
export function rollTreasureRarity(level, S, {milestone}={}){
  const high = !S.highTreasureToday;
  if(high) S.highTreasureToday=true;
  if(milestone){
    let r=milestone;
    if(r==='cosmic' && !cosmicUnlocked(S)) r='legendary';
    return { rarity:r, source:'milestone', high };
  }
  const hit=hardPityHit(S,{high});
  if(hit) return { rarity:hit, source:'hard_pity', high };
  let odds={...bandFor(level).odds};
  if(!high) odds=zeroHigh(odds);
  if(!cosmicUnlocked(S)) odds=zeroCosmic(odds);
  else if(high){
    let soft=PITY.cosmic.soft; if(hasTier('cosmic',S)) soft=Math.min(soft,8);
    odds=applySoftPity(odds, S.pity.cosmic, soft, tierHard('cosmic',S));
  }
  let rarity=pickOdds(odds);
  if(!S.firstChestDone && TIDX[rarity] < TIDX[FIRST_CHEST_MIN]) rarity=FIRST_CHEST_MIN;
  return { rarity, source:'roll', high };
}

/** Play chest (every 5 wins, and maze replays). Never increments high pity. Never Cosmic/Legendary. */
export function rollPlayRarity(S){
  const hit=hardPityHit(S,{high:false});
  if(hit) return { rarity:hit, source:'play_pity', high:false };
  return { rarity:pickOdds(PLAY_CHEST_ODDS), source:'play', high:false };
}

export function noteTreasureOpen(S, level, source){
  S.firstChestDone=true;
  if(source==='milestone' && !S.milestones.includes(level)) S.milestones.push(level);
}

/** Call after every maze/race/cards/Reef Sort completion. Returns a Play roll or null. */
export function noteWin(S){
  S.winsTowardChest=(S.winsTowardChest||0)+1;
  if(S.winsTowardChest>=WINS_PER_CHEST){ S.winsTowardChest=0; return rollPlayRarity(S); }
  return null;
}

export function pityHint(S){
  let best=null; for(const t of PITY_TIERS){ if(t==='rare') continue; const n=Math.max(1, tierHard(t,S)-S.pity[t]+1); if(!best || n<best.n || (n===best.n && TIDX[t]>TIDX[best.tier])) best={tier:t,n}; }
  return best;
}
export function cosmicLuck(S){ return Math.min(1, S.pity.cosmic / tierHard('cosmic',S)); }
export function nextMilestone(S){ const lv=Object.keys(MILESTONE_CHEST).map(Number).sort((a,b)=>a-b).find(l=>!S.milestones.includes(l) && l>=1); return lv? { level:lv, rarity:MILESTONE_CHEST[lv] } : null; }

/** Lobby progress snapshot. */
export function lobbyProgress(S){
  const total=ITEMS.length+CHARS.length; // includes Ollie
  const owned=(S.owned?.length||0)+(S.chars?.length||0);
  const mile=nextMilestone(S);
  return {
    winsTowardChest: S.winsTowardChest||0,
    winsNeeded: WINS_PER_CHEST,
    collectionOwned: owned,
    collectionTotal: total,
    collectionPct: total? Math.round(100*owned/total) : 0,
    nextMilestone: mile, // {level, rarity} or null
    playDays: S.playDays||0,
    cosmicUnlocked: cosmicUnlocked(S),
  };
}

/* ---------- prizes (same as v1) ---------- */
const isOwned = (S,kind,id) => kind==='item'? S.owned.includes(id) : S.chars.includes(id);
export function tierGaps(S, rarity){
  return [...ITEMS.filter(i=>i.r===rarity && !S.owned.includes(i.id)).map(x=>({kind:'item',x})),
          ...CHARS.filter(c=>c.r===rarity && c.id!=='ollie' && !S.chars.includes(c.id)).map(x=>({kind:'char',x}))];
}
function grant(S, p, rarity){ if(p.kind==='item') S.owned.push(p.x.id); else S.chars.push(p.x.id); S.gotTier[rarity]=true; }
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
export function craft(S, rarity, kind, id){
  if(!canCraft(S,rarity)) return null; const p=tierGaps(S,rarity).find(g=>g.kind===kind && g.x.id===id); if(!p) return null;
  S.shards[rarity]-=SHARDS_TO_CRAFT; grant(S,p,rarity); return p;
}
export function showMs(rarity){ const [a,b]=OPENING_SHOW[rarity]; return Math.round((a+Math.random()*(b-a))*1000); }
