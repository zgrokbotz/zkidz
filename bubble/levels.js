/* Bubble Pop levels: 15 story levels (3 colors -> 6 colors, more rows, the ceiling starts dropping at level 4),
 * then an endless "Waves" mode. Each level is generated from a fixed seed, so a level always looks the same. */
export const STORY_LEVELS = 15;
export const COLS = 9;          // bubbles in a wide row (narrow rows have COLS-1)
export const DANGER_ROW = 10;   // a bubble below row 10 reaches the sand line
const SHAPES = ['full','full','pyramid','full','zigzag','full','diamond','full','pyramid','zigzag','full','diamond','full','zigzag','full'];
export function levelConfig(n){
  n=Math.max(1, n|0);
  const i=Math.min(n, STORY_LEVELS)-1;
  return {
    level:n,
    rows: Math.min(8, 3 + Math.ceil(n/2)),
    colors: n<=2 ? 3 : n<=6 ? 4 : n<=11 ? 5 : 6,
    push: n<=3 ? 0 : Math.max(5, 10 - Math.floor(n/3)),   // misses before a new row drops in (0 = never)
    shape: SHAPES[i],
    seed: 1009*n + 77,
    cluster: n<=4 ? .62 : n<=9 ? .52 : .44,               // chance a bubble copies a neighbour's color (easier groups)
  };
}
export const ENDLESS = { rows:5, colors:4, pushBase:7, wavePops:24 };
export function shapeHas(shape, r, c, cols, rows){
  const mid=(cols-1)/2;
  if(shape==='pyramid') return Math.abs(c-mid) <= mid - r*0.55 + 0.6 || r===0;
  if(shape==='diamond'){ const h=(rows-1)/2; return r===0 || Math.abs(c-mid) <= mid - Math.abs(r-h)*1.1 + 0.6; }
  if(shape==='zigzag') return r===0 || ((c + r) % 4 !== 3);
  return true;
}
