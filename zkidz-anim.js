// zkidz-anim.js (Ollie V2 pass: calmer idle breathing/sway + blink): procedural animation for ZKidz chibi characters.
// Drop-in replacement for game.js animateOllie(o, speed, dt, t).
// Drives the EXISTING parts built by buildOllie()/dressSpecies() by name:
//   rig, head, sh-1/sh1 (shoulders), foot-1/foot1, tail (+ Bubbles' gill groups found under head).
// It never renames, re-parents, creates or removes nodes, so addEquipment() attachments
// (hatAnchor/eyeAnchor on head, sleeves/bracelets/gloves on arms, shoes on feet, tee/pants on rig) ride along.
// No three.js import, no per-frame allocations, no skinned meshes.
//
//   import { animateChar, triggerAnim } from './zkidz-anim.js';
//   animateChar(o, state, speed, dt, t);   // every frame
//   triggerAnim(o, 'jump' | 'tap' | 'happy' | 'wave');  // one-shot overlay, returns to the base state
//
// States (persistent): 'idle' | 'walk' | 'run' | 'move' (idle/walk/run are picked by speed, like animateOllie)
//                      'happy' (celebrate loop) | 'wave' (hello loop) | 'air' (airborne pose, no hop; use when
//                      the game does its own jump physics) | 'jump' | 'tap' (one-shots, auto-fired on state change).
// speed: world units/s (maze max 5.6, race 7.5, dash x1.9). Walk fully on at 4, full run at 8.

// ---- channels ----
const PY=0, RX=1, RY=2, RZ=3, SQ=4, HX=5, HY=6, HZ=7, HPY=8,
      SLX=9, SLY=10, SLZ=11, SRX=12, SRY=13, SRZ=14,
      FLY=15, FLZ=16, FLR=17, FRY=18, FRZ=19, FRR=20,
      TX=21, TY=22, TZ=23, GILL=24, NCH=25;
const TAU = Math.PI*2;

// species touches (kind is read from o.userData.kind, set by buildOllie in the game via charId; we also
// accept opts.kind on first call or detect from parts).
export const SPECIES = {
  ollie:   { tail:'y', tailAmp:.25, tailSpd:2.0, flap:0,   gill:0 },
  dash:    { tail:'x', tailAmp:.32, tailSpd:3.2, flap:.22, gill:0 },   // fin flap + fluke beat
  finn:    { tail:'y', tailAmp:.55, tailSpd:7.0, flap:.08, gill:0 },   // fast tail swish
  bubbles: { tail:'y', tailAmp:.30, tailSpd:2.6, flap:0,   gill:.22 }, // gill wiggle
  oscar:   { tail:'x', tailAmp:.40, tailSpd:2.2, flap:.15, gill:0 },   // big fluke
  wade:    { tail:'y', tailAmp:.38, tailSpd:1.1, flap:.10, gill:0 },   // slow tail sweep
};
// per-character feel (o.userData.animStyle, set by buildOllieV2 variants). Multipliers on the blended pose + extras.
export const STYLES = {
  calm:    { sway: 1,   tilt: 1,   bounce: 1,    tail: 1,   extra: 0 },   // A: calm, cute, breathing
  chunky:  { sway: 1.3, tilt: 1.1, bounce: 1.3,  tail: .8,  extra: 1 },   // B: wobbly vinyl toy (side-to-side waddle)
  playful: { sway: 1.6, tilt: 2.0, bounce: 1.35, tail: 2.0, extra: 2 },   // C: head-tilts, hip sway, big tail flicks
};
const ONESHOT_DUR = { jump:.72, tap:.62, happy:1.6, wave:1.6 };
const LOOP_STATES = { idle:1, walk:1, run:1, move:1, happy:1, wave:1, air:1 };

function neutral(P){ P.fill(0); P[SQ]=1; P[SLZ]=-.15; P[SRZ]=.15; }
function addW(P,T,s){ for(let i=0;i<NCH;i++) P[i]+=T[i]*s; }
const clamp01 = x => x<0?0:x>1?1:x;
const smooth = x => x*x*(3-2*x);

// ---------- clips (write absolute pose into P) ----------
function clipIdle(P, t){ neutral(P);           // calm: slow breathing, gentle weight-shift sway, curious head
  const br=Math.sin(t*1.9);                      // ~0.3 Hz breath
  P[SQ]=1+br*.022; P[PY]=(br*.5+.5)*.012;
  P[RZ]=Math.sin(t*.8)*.028; P[RY]=Math.sin(t*.45)*.07; P[RX]=Math.sin(t*1.9+.6)*.012;
  P[HZ]=Math.sin(t*.8+1.1)*.05; P[HY]=Math.sin(t*.55)*.12 + Math.sin(t*.23)*.06; P[HX]=Math.sin(t*1.9+1)*.018 - .02;
  P[SLX]=Math.sin(t*1.9-1)*.04; P[SRX]=Math.sin(t*1.9+1)*.04;
  P[SLZ]=-.12-br*.025; P[SRZ]=.12+br*.025;
}
// walk/run cycle identical in spirit to animateOllie, r=0 walk ... r=1 run
function clipLoco(P, w, r){ neutral(P);
  const lean=.16+.16*r, bob=.11+.08*r, arm=.9+.4*r, stride=.22+.07*r, lift=.12+.07*r;
  P[RZ]=Math.sin(w)*(.1-.03*r); P[RX]=lean+Math.sin(w*2)*.03;
  P[PY]=Math.abs(Math.sin(w))*bob; P[SQ]=1-Math.abs(Math.cos(w))*(.04+.03*r);
  P[HX]=-lean*.45; P[HZ]=-Math.sin(w)*.04;
  const phL=Math.sin(w), phR=-phL;
  P[FLZ]=phL*stride; P[FLY]=Math.max(0,Math.cos(w))*lift; P[FLR]=-phL*.4;
  P[FRZ]=phR*stride; P[FRY]=Math.max(0,Math.cos(w+Math.PI))*lift; P[FRR]=-phR*.4;
  P[SLX]=-phL*arm; P[SRX]=-phR*arm; P[SLZ]=-(.15+.2+.15*r); P[SRZ]=.15+.2+.15*r;
}
function clipHappy(P, t){ neutral(P);           // bouncy cheer, loops every 2*PI/6 s
  const h=t*6, s=Math.sin(h), up=Math.abs(s);
  P[PY]=up*.24; P[SQ]=1+(up-.5)*.12 - (up<.15?.08:0);
  P[RY]=Math.sin(t*3)*.35; P[RZ]=Math.sin(t*3)*.06;
  P[HZ]=Math.sin(t*3+.6)*.14; P[HX]=-.08;
  P[SLZ]=-(2.35+Math.sin(h*2)*.3); P[SRZ]=2.35+Math.sin(h*2+1)*.3;
  P[SLX]=-.2; P[SRX]=-.2;
  P[FLY]=up*.05; P[FRY]=up*.05;
}
function clipWave(P, t){ clipIdle(P, t);       // hello: right arm up and waving, lean in
  P[SRZ]=2.45+Math.sin(t*9)*.38; P[SRX]=-.35; P[SRY]=Math.sin(t*9)*.15;
  P[HZ]=-.14+Math.sin(t*1.5)*.04; P[HY]=.12; P[RZ]=-.05+Math.sin(t*4.5)*.025; P[RX]=.04;
  P[SLZ]=-.2; P[PY]+=Math.abs(Math.sin(t*4.5))*.03;
}
function clipAir(P, t){ neutral(P);            // airborne pose: stretch, arms up, feet tucked
  P[SQ]=1.08; P[SLZ]=-1.9; P[SRZ]=1.9; P[SLX]=-.3; P[SRX]=-.3; P[HX]=-.12;
  P[FLY]=.08; P[FRY]=.08; P[FLR]=.35; P[FRR]=.35; P[TX]=.25+Math.sin(t*8)*.08;
}
function clipJump(P, u, t){                    // u in [0,1): anticipation, hop, landing squash
  if(u<.16){ neutral(P); const k=smooth(u/.16); P[SQ]=1-.2*k; P[SLZ]=-(.15+.5*k); P[SRZ]=.15+.5*k; P[SLX]=P[SRX]=.4*k; P[HX]=.12*k; return; }
  if(u<.80){ const k=(u-.16)/.64; clipAir(P, t); P[PY]=Math.sin(Math.PI*k)*.85; P[SQ]=1+.12*Math.sin(Math.PI*Math.min(1,k*1.6)); P[RX]=-.12*Math.sin(TAU*k*.5); return; }
  neutral(P); const k=(u-.8)/.2; P[SQ]=1-.18*Math.sin(Math.PI*k)*(1-k*.3); P[SLZ]=-(.15+.4*(1-k)); P[SRZ]=.15+.4*(1-k);
}
function clipTap(P, u, t){                     // tapped: boing squash + happy head shake + arm flare
  neutral(P); const d=1-u;
  P[SQ]=1+Math.sin(u*TAU*3)*.16*d*d;
  P[PY]=u<.45? Math.sin(Math.PI*u/.45)*.18 : 0;
  P[HY]=Math.sin(u*TAU*3.5)*.32*d; P[HZ]=Math.sin(u*TAU*1.5)*.1*d;
  const f=Math.sin(Math.PI*Math.min(1,u*2.2)); P[SLZ]=-(.15+1.1*f); P[SRZ]=.15+1.1*f; P[SLX]=P[SRX]=-.4*f;
  P[RZ]=Math.sin(u*TAU*2)*.08*d; P[TX]=.3*f;
}

// ---------- per-character state (allocated once per model) ----------
function init(o){
  const p=o.userData.parts, A={};
  A.P=new Float32Array(NCH); A.T=new Float32Array(NCH); A.O=new Float32Array(NCH);
  A.w=new Float32Array(5);           // idle, loco, happy, wave, air
  A.tw=new Float32Array(5);
  A.amt=0; A.walk=0; A.state='idle'; A.one=null; A.oneT=0; A.oneEnv=0;
  const fL=p['foot-1'], fR=p.foot1, tl=p.tail;
  A.base={ fLy:fL.position.y, fLz:fL.position.z, fLr:fL.rotation.x, fRy:fR.position.y, fRz:fR.position.z, fRr:fR.rotation.x,
           tx:tl?tl.rotation.x:0, ty:tl?tl.rotation.y:0, tz:tl?tl.rotation.z:0, hy:p.head.position.y };
  let kind=o.userData.kind || o.userData.charId;
  A.eyes=[]; A.eyeY=[]; for(const c of p.head.children){ if(c.name==='eye'){ A.eyes.push(c); A.eyeY.push(c.scale.y); } }
  A.blinkT=2+Math.random()*2; A.blink=0;
  A.gills=[]; A.gillBase=[];
  for(const c of p.head.children){ if(!c.isMesh && c!==p.hatAnchor && c!==p.eyeAnchor && c.children.length>=2){ A.gills.push(c); A.gillBase.push(c.rotation.z); } }
  if(!kind) kind = A.gills.length ? 'bubbles' : 'ollie';
  A.sp=SPECIES[kind]||SPECIES.ollie; A.kind=kind; A.st=STYLES[o.userData.animStyle]||STYLES.calm;
  o.userData.zkAnim=A; return A;
}

/** Fire a one-shot clip ('jump' | 'tap' | 'happy' | 'wave'); blends back to the current state when done. */
export function triggerAnim(o, name){ const A=o.userData.zkAnim||init(o); if(!ONESHOT_DUR[name]) return; A.one=name; A.oneT=0; }
/** True while a one-shot is playing. */
export function isAnimBusy(o){ const A=o.userData.zkAnim; return !!(A && A.one); }

export function animateChar(o, state='idle', speed=0, dt=1/60, t=0){
  const p=o.userData.parts; if(!p) return; const A=o.userData.zkAnim||init(o);
  if(state!==A.state){ if(state==='jump'||state==='tap') triggerAnim(o,state); A.state=state; }
  const base = LOOP_STATES[state] ? state : 'idle';
  // locomotion amount, as in animateOllie
  A.walk += dt*speed*2.6;
  const loco = base==='idle'||base==='walk'||base==='run'||base==='move';
  const target = loco ? Math.min(1, speed/4) : 0;
  A.amt += (target-A.amt)*Math.min(1, dt*8);
  const run = clamp01((speed-4)/4);
  // target weights
  A.tw.fill(0);
  if(loco){ A.tw[0]=1; } else if(base==='happy') A.tw[2]=1; else if(base==='wave') A.tw[3]=1; else if(base==='air') A.tw[4]=1;
  const k=Math.min(1, dt*9); let sum=0;
  for(let i=0;i<5;i++){ A.w[i]+=(A.tw[i]-A.w[i])*k; sum+=A.w[i]; }
  // blend loops
  const P=A.P, T=A.T; P.fill(0);
  const wIdle=A.w[0]*(1-A.amt), wLoco=A.w[0]*A.amt;
  if(wIdle>1e-4){ clipIdle(T,t); addW(P,T,wIdle/sum); }
  if(wLoco>1e-4){ clipLoco(T,A.walk,run); addW(P,T,wLoco/sum); }
  if(A.w[2]>1e-4){ clipHappy(T,t); addW(P,T,A.w[2]/sum); }
  if(A.w[3]>1e-4){ clipWave(T,t); addW(P,T,A.w[3]/sum); }
  if(A.w[4]>1e-4){ clipAir(T,t); addW(P,T,A.w[4]/sum); }
  // one-shot overlay with fade in/out
  if(A.one){ const D=ONESHOT_DUR[A.one]; A.oneT+=dt; const u=A.oneT/D;
    if(u>=1){ A.one=null; }
    else { const O=A.O;
      if(A.one==='jump') clipJump(O,u,t); else if(A.one==='tap') clipTap(O,u,t); else if(A.one==='happy') clipHappy(O,A.oneT); else clipWave(O,A.oneT);
      const env = A.one==='jump'||A.one==='tap' ? Math.min(1,u/.06, (1-u)/.1) : Math.min(1,u/.12,(1-u)/.15);
      const e=smooth(clamp01(env));
      // keep the stride going under a jump/tap while moving: blend feet less
      for(let i=0;i<NCH;i++) P[i]+=(O[i]-P[i])*e;
    } }
  // species touches (additive)
  const sp=A.sp, mv=A.amt, act=A.w[2]+A.w[3];
  const tw = Math.sin(t*sp.tailSpd*(1+mv*.8) + A.walk*.5)*sp.tailAmp*(1+.3*act);
  if(sp.tail==='x') P[TX]+=tw; else P[TY]+=tw;
  if(sp.flap){ const f=Math.sin(t*(5+mv*3))*sp.flap*(.6+act); P[SLZ]-=f; P[SRZ]+=f; }
  if(sp.gill) P[GILL]+=Math.sin(t*5.2)*sp.gill*(1+act+mv*.5);
  // style (cheap scalar multipliers, no allocation)
  const ST=A.st; if(ST!==STYLES.calm){ P[RZ]*=ST.sway; P[HZ]*=ST.tilt; P[PY]*=ST.bounce; P[TX]*=ST.tail; P[TY]*=ST.tail;
    const idleW=A.w[0]*(1-A.amt);
    if(ST.extra===1){ P[RZ]+=Math.sin(t*1.6)*.03*idleW; P[SQ]+=Math.sin(t*3.2)*.01*idleW; }                       // toy wobble
    if(ST.extra===2){ const tl=Math.sin(t*.7); P[HZ]+=(.12*Math.sign(tl)*Math.pow(Math.abs(tl),.4))*idleW;        // playful head-tilt holds
      P[RY]+=Math.sin(t*1.1)*.08*idleW; P[TX]+=(.15+Math.sin(t*3.1)*.12)*idleW; P[SRZ]+=.12*idleW; P[SRX]-=.15*idleW;
      P[PY]+=Math.abs(Math.sin(A.walk))*.04*A.amt; } }
  // ---- write to parts ----
  const B=A.base, rig=p.rig;
  rig.position.y=P[PY]; rig.rotation.set(P[RX],P[RY],P[RZ]);
  const sq=P[SQ], inv=1/Math.sqrt(sq); rig.scale.set(inv,sq,inv);
  o.position.y=(o.userData.baseY||0);
  p.head.rotation.set(P[HX],P[HY],P[HZ]); p.head.position.y=B.hy+P[HPY];
  p['sh-1'].rotation.set(P[SLX],P[SLY],P[SLZ]); p.sh1.rotation.set(P[SRX],P[SRY],P[SRZ]);
  const fL=p['foot-1'], fR=p.foot1;
  fL.position.y=B.fLy+P[FLY]; fL.position.z=B.fLz+P[FLZ]; fL.rotation.x=B.fLr+P[FLR];
  fR.position.y=B.fRy+P[FRY]; fR.position.z=B.fRz+P[FRZ]; fR.rotation.x=B.fRr+P[FRR];
  if(p.tail){ p.tail.rotation.set(B.tx+P[TX], B.ty+P[TY], B.tz+P[TZ]); }
  for(let i=0;i<A.gills.length;i++){ const g=A.gills[i]; g.rotation.z=A.gillBase[i]+Math.sign(g.position.x)*P[GILL]*(1+(i%3)*.25); }
  // blink every ~3-5 s (V2 eyes only; no allocation)
  if(A.eyes.length){ A.blinkT-=dt; if(A.blinkT<=0){ A.blink=.16; A.blinkT=2.6+Math.random()*2.6; } if(A.blink>0) A.blink-=dt;
    const c=A.blink>0? 1-Math.sin(Math.PI*A.blink/.16)*.9 : 1; for(let i=0;i<A.eyes.length;i++) A.eyes[i].scale.y=A.eyeY[i]*c; }
  // optional blob shadow (zkidz-look.js addBlobShadow): shrink/fade with height
  const bl=o.userData.blob; if(bl){ const h=P[PY]; const s=1-Math.min(.5,h*.6); bl.scale.set(s,s,s); bl.material.opacity=bl.userData.op*(1-Math.min(.6,h*.7)); }
}

/** Exact drop-in signature of game.js animateOllie(o, speed, dt, t). */
export function animateOllieCompat(o, speed, dt, t){ animateChar(o, 'move', speed, dt, t); }
export const CLIPS = ['idle','walk','run','jump','happy','wave','tap','air'];
