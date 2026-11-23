// node speller/test/blocklist.test.mjs  — kid-safe filler check for Ocean Speller
import { WORDS, blockedIn, poolIsSafe, sequencesOf, fillerLetters } from '../words.js';
let fail=0; const ok=(c,m)=>{ if(!c){ fail++; console.log('FAIL', m); } };
const R13=s=>s.replace(/[a-z]/g,c=>String.fromCharCode((c.charCodeAt(0)-97+13)%26+97));
// 1) known rude strings are caught forwards, backwards, inside longer runs, any case
for(const w of ['fuck','shit','ass','dick','poop','fart','bitch','sex','tit','cum','fag','slut','porn','kill']){
  ok(blockedIn(w), 'catch '+w); ok(blockedIn('xq'+w.toUpperCase()+'zz'), 'catch inside '+w); ok(blockedIn([...w].reverse().join('')), 'catch reversed '+w);
}
// 2) every target word is clean on its own (so a clean round is always possible)
for(const w of WORDS) ok(!blockedIn(w.w), 'word clean '+w.w);
// 3) every word's character exists in the game's 3D roster
const PLAYABLE=['ollie','dash','finn','bubbles','oscar','wade','pip','sunny','jelly','lulu','percy','nova','kelpie','giga'];
for(const w of WORDS) ok(PLAYABLE.includes(w.c), 'playable char for '+w.w);
// 4) planted rude fillers are rejected in every reading order
const mk=(s,xs)=>[...s].map((ch,i)=>({ch, x:xs?xs[i]:i*10, y:(i*37)%50}));
ok(!poolIsSafe(mk('ASSPIP')), 'spawn order');
ok(!poolIsSafe(mk('SAPIPS',[20,10,50,60,70,30])), 'x order');            // A(10) S(20) S(30)
ok(poolIsSafe(mk('PIPLMN')), 'clean pool');
// 5) generator stress: same retry loop as the game, 20k rounds -> 0 unsafe pools reach kids
let unsafe=0, retries=0;
for(let n=0;n<20000;n++){ const w=WORDS[n%WORDS.length].w; let bs;
  for(let t=0;t<60;t++){ const letters=(w+fillerLetters(3+(n%9))).split('').sort(()=>Math.random()-.5);
    bs=letters.map((ch,i)=>({ch, x:Math.random()*800, y:Math.random()*400})); if(poolIsSafe(bs)) break; retries++; }
  if(!poolIsSafe(bs)) unsafe++; }
ok(unsafe===0, 'stress unsafe='+unsafe);
console.log(`blocklist test: ${fail?'FAILED':'PASSED'} (${fail} failures; ${retries} regenerations in 20000 rounds, ${unsafe} unsafe)`);
process.exit(fail?1:0);
