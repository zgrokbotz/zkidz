/* Reef Hide & Seek — zones and level ramp. 12 story levels (4 zones x 3), then endless bonus levels. */
export const ZONES = [
  { id:'shallows', name:'Sunny Shallows', em:'☀️', blurb:'Warm water, bright coral, and lots of giggles!',
    water:['#5fe1ff','#1ea7e8','#0a5fae'], sand:['#ffe7a3','#f2c46b'], far:'#2f8fd0', mid:'#2378bd', rays:.55, glow:0,
    covers:['coral','rock','clam','castle'], decor:['fan','branch','anemone','star'], fish:['#ffd23a','#ff7a1a','#ff6ad5','#3ad6c8'] },
  { id:'kelp', name:'Kelp Forest', em:'🌿', blurb:'Tall swaying kelp — perfect for sneaky friends!',
    water:['#58d8b8','#16907e','#0b4d58'], sand:['#d9cf8e','#a99a5a'], far:'#1d7366', mid:'#155e55', rays:.45, glow:0,
    covers:['kelp','rock','kelp','coral'], decor:['kelp','fan','anemone','branch'], fish:['#ffd23a','#8cf26a','#ffb000','#5fd0ff'] },
  { id:'wreck', name:'Shipwreck Cove', em:'⚓', blurb:'An old pirate ship full of hiding spots!',
    water:['#4ab3d6','#1b6e9e','#0d3361'], sand:['#e7c68c','#b58c55'], far:'#1d5a85', mid:'#164a70', rays:.35, glow:0,
    covers:['barrel','chest','plank','rock'], decor:['anchor','branch','fan','star'], fish:['#ffd23a','#c7cbd6','#ff7b7b','#5fd0ff'] },
  { id:'caves', name:'Glow Caves', em:'✨', blurb:'Deep, dark and glowy. Look for the sparkles!',
    water:['#3a3f9e','#211f66','#0c0a2e'], sand:['#5b4a8a','#352a5e'], far:'#2a2470', mid:'#1f1a58', rays:.08, glow:1,
    covers:['crystal','shroom','rock','crystal'], decor:['crystal','shroom','anemone','glowfan'], fish:['#7ff0ff','#ff6ad5','#c9a6f2','#8cf26a'] },
];

/* w,h world size · n hiders · empty extra decoy hiding spots · fish decoys · hide 0..1 (how deep they hide) · peek seconds between peeks · par seconds for 3 stars */
export const LEVELS = [
  { zone:0, name:'Tidepool Hello',    w:1300, h:860,  n:3,  empty:2,  fish:10, hide:.15, peek:2.4, par:35 },
  { zone:0, name:'Coral Playground',  w:1600, h:980,  n:4,  empty:4,  fish:14, hide:.25, peek:2.8, par:45 },
  { zone:0, name:'Sandcastle Bay',    w:1900, h:1120, n:5,  empty:6,  fish:18, hide:.35, peek:3.2, par:60 },
  { zone:1, name:'Kelp Tickles',      w:2000, h:1250, n:5,  empty:7,  fish:20, hide:.35, peek:3.4, par:60 },
  { zone:1, name:'Swaying Maze',      w:2300, h:1380, n:6,  empty:9,  fish:24, hide:.45, peek:3.8, par:75 },
  { zone:1, name:'Otter Grove',       w:2600, h:1500, n:7,  empty:11, fish:28, hide:.5,  peek:4.2, par:90 },
  { zone:2, name:'Captain\'s Deck',   w:2700, h:1600, n:7,  empty:12, fish:30, hide:.5,  peek:4.4, par:90 },
  { zone:2, name:'Barrel Bonanza',    w:3000, h:1750, n:8,  empty:14, fish:34, hide:.55, peek:4.8, par:105 },
  { zone:2, name:'Treasure Hold',     w:3300, h:1900, n:9,  empty:16, fish:38, hide:.6,  peek:5.2, par:120 },
  { zone:3, name:'Twinkle Tunnel',    w:3300, h:1950, n:9,  empty:17, fish:38, hide:.6,  peek:5.4, par:125 },
  { zone:3, name:'Crystal Hollow',    w:3600, h:2100, n:10, empty:19, fish:42, hide:.65, peek:5.8, par:140 },
  { zone:3, name:'The Great Glow',    w:3900, h:2300, n:11, empty:22, fish:46, hide:.7,  peek:6.2, par:155 },
];
export const STORY_LEVELS = LEVELS.length;

export function levelConfig(n){
  if(n<=LEVELS.length) return { ...LEVELS[n-1], level:n, bonus:false };
  const k=n-LEVELS.length-1;                       // 0,1,2…
  const z=k%ZONES.length;
  return { zone:z, name:`Bonus Reef ${k+1}`, level:n, bonus:true,
    w:3000+Math.min(k,12)*120, h:1800+Math.min(k,12)*70, n:Math.min(12,8+Math.floor(k/2)),
    empty:Math.min(26,15+k), fish:Math.min(56,36+k*2), hide:Math.min(.75,.55+k*.02), peek:Math.min(6.5,4.6+k*.15),
    par:Math.round(110+Math.min(12,8+Math.floor(k/2))*6) };
}
