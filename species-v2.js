// species-v2.js: the other 5 playables on Ollie C's V2 base (same builder style, smooth clay, same parts contract).
// Replaces game.js dressSpecies(): each species gets its own cached silhouette (body + head lathes), a painted clay
// material (one shader per species: belly/patches/dots/stripes are fragment masks, so no extra meshes or textures),
// and cached fins/tails/gills. buildOllieV2() calls buildSpeciesV2() for every non-otter playable.
import * as THREE from './vendor/three.module.min.js?v=20261124-3';
import { clay, gloss, shineMat, smoothLathe, spline, merge, sstep, torsoLathe, blendArm, neckTorso } from './ollie-v2.js?v=20261127-3';
import { B2, buildB2, b2Profile, clothProfile as b2ClothProfile, CLOTH_FIT as CLOTH_FIT_B2 } from './species-b2.js?v=20261127-3';   // batch 2 (v5 polish + CLOTH_FIT)
import { B3, buildB3, b3Profile, CLOTH_FIT as CLOTH_FIT_B3 } from './species-b3.js?v=20261127-3';   // batch 3 (A: squirt angie bella echo sharkie polly wally nudi)
import { B4, buildB4, b4Profile, CLOTH_FIT as CLOTH_FIT_B4 } from './species-b4.js?v=20261127-3';   // batch 4 (B: pinchy tusk mo gus zippy puff shelly coco)
import { B5, buildB5, b5Profile, CLOTH_FIT as CLOTH_FIT_B5 } from './species-b5.js?v=20261127-3';   // batch 5 (C: stella hank inky milo hammy harbor tango barrie)
import { B6, buildB6, b6Profile, CLOTH_FIT as CLOTH_FIT_B6 } from './species-b6.js?v=20261127-3';   // batch 6 (D: gulliver iggy flip reef sal coral momo toro)
export const CLOTH_FIT = { ...CLOTH_FIT_B2, ...CLOTH_FIT_B3, ...CLOTH_FIT_B4, ...CLOTH_FIT_B5, ...CLOTH_FIT_B6 };
export function clothFit(kind){ return CLOTH_FIT[kind] || {}; }

const W = 'vec3(0.97,0.96,0.93)';
// ---------- per-species config (rig coords: y up, +z = face). Profiles are [radius, y]. ----------
export const SPECIES_V2 = {
  wade: { name: 'Wade the Whale Shark', color: 0x4d6277, neckY: 1.14, headY: 1.45, widen: .1, flat: .06,
    body: [[0,.17],[.35,.18],[.58,.25],[.71,.38],[.77,.56],[.78,.76],[.75,.94],[.71,1.06],[.69,1.14]],
    head: [[.7,1.2],[.725,1.33],[.725,1.47],[.7,1.61],[.63,1.75],[.51,1.87],[.33,1.96],[.15,2.0],[0,2.01]],
    eye: { x: .44, y: .02, s: [.07, .075, .055] }, smile: null, hat: { y: .02, s: 1.35 }, eyeA: { p: [0, -.12, .12], s: [1.65, 1.2, 1.3] },
    sh: { y: .95, z: .12, inset: .05 }, arm: { kind: 'paddle', r: .14, len: .2, rz: .75, rx: -.25 }, foot: { x: .32, y: .15, z: .12, s: [.2, .17, .24] },
    tail: { kind: 'crescent', pos: [0, .7, -.68], s: 1.15 }, fins: ['dorsalTall'], anim: 'calm',
    glsl: `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base;
  float front = smoothstep(0.08, 0.3, p.z);
  // cream belly + lower jaw: one big disc on the front, top edge = the mouth line
  // wide OPEN grin: top lip curves up to the corners, bottom lip dips in the middle; tongue inside
  float u2 = pow(abs(p.x) / 0.42, 2.0);
  float yt = 1.30 + 0.07 * u2, yb = 1.37 - 0.2 * (1.0 - u2);
  float mouth = zkAA(yb - p.y) * zkAA(p.y - yt) * zkAA(abs(p.x) - 0.42) * front;
  float tongue = zkAA(length(vec2(p.x / 0.17, (p.y - 1.19) / 0.07)) - 1.0) * mouth;
  float belly = zkAA(length(vec2(p.x / 0.62, (p.y - 0.8) / 0.52)) - 1.0) * front * zkAA(p.y - yb);
  vec3 c = mix(base, vec3(0.93,0.88,0.76), belly);
  c = mix(c, vec3(0.2,0.08,0.1), mouth);
  c = mix(c, vec3(0.85,0.42,0.48), tongue);
  // white polka dots (procedural grid on the back/top, outside the belly)
  float back = 1.0 - smoothstep(0.0, 0.06, belly + mouth);
  float ang = atan(p.x, p.z); vec2 g = vec2(ang * 3.6, p.y * 5.2); g.x += 0.5 * mod(floor(g.y), 2.0);
  vec2 q = fract(g) - 0.5; float dot0 = zkAA(length(q) - 0.17 + 0.03 * sin(floor(g.x) * 3.1));
  float upper = smoothstep(0.75, 1.0, p.y);
  // 2-3 curved white stripes over the shoulders (rings around a point low in front)
  float r = length(p - vec3(0.0, 0.7, 0.75));
  float st = max(zkAA(abs(r - 1.12) - 0.028), max(zkAA(abs(r - 1.32) - 0.026), zkAA(abs(r - 1.52) - 0.024))) * smoothstep(1.15, 1.3, p.y) * smoothstep(0.25, 0.4, abs(p.x));
  return mix(c, ${W}, max(dot0 * upper, st) * back);
}` },
  dash: { name: 'Dash the Dolphin', color: 0x49a9e6, neckY: 1.14, headY: 1.52, widen: .04, flat: .02,
    body: [[0,.12],[.27,.13],[.44,.18],[.52,.3],[.55,.46],[.545,.66],[.52,.86],[.49,1.02],[.47,1.14]],
    head: [[.475,1.2],[.5,1.32],[.51,1.46],[.5,1.6],[.47,1.74],[.4,1.88],[.28,1.98],[.13,2.03],[0,2.04]],
    snout: { y: -.08, rx: .2, ry: .12, amt: .2 }, eye: { x: .27, y: .1, s: [.06, .066, .05] }, smile: { y: -.14, w: .1, r: .9, z: .17 },
    hat: { y: .06, s: 1.12 }, eyeA: { p: [0, -.02, .02], s: [1.2, 1.15, 1.1] },
    sh: { y: 1.02, z: .1, inset: .02 }, arm: { kind: 'flipper', r: .1, len: .3, rz: .35, rx: -.15 }, foot: { x: .2, y: .12, z: .16, s: [.17, .12, .24] },
    tail: { kind: 'fluke', pos: [0, .38, -.45], s: 1 }, fins: ['dorsal'], anim: 'playful',
    glsl: `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base;
  float front = smoothstep(0.1, 0.3, p.z);
  float belly = zkAA(length(vec2(p.x / 0.3, (p.y - 0.74) / 0.44)) - 1.0) * front;
  // white throat UNDER the beak only (beak stays all blue, so it never reads as an open mouth)
  float chin = zkAA(length(vec2(p.x / 0.3, (p.y - 1.2) / 0.11)) - 1.0) * zkAA(p.y - 1.29) * smoothstep(0.2, 0.4, p.z);
  return mix(base, ${W}, max(belly, chin));
}` },
  finn: { name: 'Finn the Clownfish', color: 0xff7414, neckY: 1.16, headY: 1.5, widen: .03, flat: .02,
    body: [[0,.13],[.3,.14],[.48,.21],[.57,.34],[.6,.52],[.6,.72],[.585,.9],[.565,1.06],[.55,1.16]],
    head: [[.55,1.22],[.552,1.36],[.54,1.5],[.51,1.66],[.45,1.82],[.35,1.96],[.2,2.06],[0,2.1]],
    eye: { x: .22, y: .12, s: [.075, .08, .06] }, smile: { y: -.04, w: .07, r: 1.1 }, hat: { y: .06, s: 1.15 }, eyeA: { p: [0, -.02, 0], s: [1.15, 1.15, 1.08] },
    sh: { y: .92, z: .08, inset: .0 }, arm: { kind: 'round', r: .17, len: 0, rz: .25, rx: 0 }, foot: { x: .22, y: .12, z: .12, s: [.18, .13, .22] },
    tail: { kind: 'fish', pos: [0, .7, -.56], s: 1 }, fins: ['topFin'], anim: 'playful',
    glsl: `float zkBand(vec3 p, vec3 c, vec3 n, float w){ float d = abs(dot(p - c, normalize(n))); return zkAA(d - w); }
vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return mix(base, ${W}, zkBand(p, vec3(0.0), vec3(0.0, 0.0, 1.0), 0.28));
  vec3 dark = vec3(0.12, 0.06, 0.05);
  float b1o = zkBand(p, vec3(0.0, 1.5, 0.02), vec3(0.0, -0.5, 1.0), 0.13), b1 = zkBand(p, vec3(0.0, 1.5, 0.02), vec3(0.0, -0.5, 1.0), 0.105);
  float b2o = zkBand(p, vec3(0.0, 0.93, 0.0), vec3(0.0, 1.0, -0.3), 0.085), b2 = zkBand(p, vec3(0.0, 0.93, 0.0), vec3(0.0, 1.0, -0.3), 0.06);
  float b3o = zkBand(p, vec3(0.0, 0.36, 0.0), vec3(0.0, 1.0, -0.2), 0.065), b3 = zkBand(p, vec3(0.0, 0.36, 0.0), vec3(0.0, 1.0, -0.2), 0.042);
  vec3 c = mix(base, dark, max(b1o, max(b2o, b3o)));
  return mix(c, ${W}, max(b1, max(b2, b3)));
}` },
  bubbles: { name: 'Bubbles the Axolotl', color: 0xffa3c4, neckY: 1.14, headY: 1.6, widen: .12, flat: .04,
    body: [[0,.15],[.3,.16],[.48,.22],[.56,.35],[.59,.5],[.585,.7],[.56,.88],[.53,1.02],[.51,1.14]],
    head: [[.52,1.2],[.57,1.32],[.6,1.46],[.605,1.6],[.585,1.74],[.53,1.88],[.42,1.99],[.25,2.06],[0,2.09]],
    eye: { x: .3, y: .02, s: [.065, .07, .055] }, smile: { y: -.12, w: .11, r: .7 }, hat: { y: .02, s: 1.25 }, eyeA: { p: [0, -.12, .03], s: [1.35, 1.2, 1.2] },
    sh: { y: 1.0, z: .12, inset: .02 }, arm: { kind: 'arm', r: .085, len: .26, rz: .18, rx: -.1 }, foot: { x: .23, y: .13, z: .16, s: [.19, .13, .25] },
    tail: { kind: 'axolotl', pos: [0, .4, -.42], s: 1 }, fins: ['gills'], anim: 'playful',
    glsl: `vec3 zkPaint(vec3 p, vec3 base, float part){
  if(part > 0.5) return base;
  float belly = zkAA(length(vec2(p.x / 0.33, (p.y - 0.66) / 0.38)) - 1.0) * smoothstep(0.08, 0.3, p.z);
  return mix(base, vec3(1.0, 0.9, 0.9), belly);
}` },
  oscar: { name: 'Oscar the Orca', color: 0x1b1d22, rough: .5, cc: .35, neckY: 1.16, headY: 1.6, widen: .05, flat: .02,
    body: [[0,.12],[.28,.13],[.46,.18],[.55,.3],[.585,.48],[.585,.7],[.56,.9],[.53,1.06],[.515,1.16]],
    head: [[.52,1.22],[.545,1.36],[.55,1.52],[.53,1.7],[.48,1.86],[.38,2.0],[.22,2.1],[0,2.14]],
    eye: { x: .25, y: .04, s: [.05, .056, .045] }, smile: { y: -.11, w: .13, r: .75, white: false }, hat: { y: .1, s: 1.18 }, eyeA: { p: [0, -.08, .02], s: [1.2, 1.15, 1.12] },
    sh: { y: 1.02, z: .1, inset: .02 }, arm: { kind: 'flipper', r: .11, len: .32, rz: .45, rx: -.1 }, foot: { x: .21, y: .12, z: .15, s: [.18, .13, .24] },
    tail: { kind: 'fluke', pos: [0, .38, -.5], s: 1.05 }, fins: ['dorsalOrca'], anim: 'calm',
    glsl: `vec3 zkPaint(vec3 p, vec3 base, float part){
  vec3 w = vec3(0.96, 0.96, 0.95);
  if(part > 0.5) return mix(base, w, smoothstep(0.1, 0.35, p.z) * zkAA(-p.y - 0.15));   // white toe caps
  float front = smoothstep(0.05, 0.28, p.z);
  // chin/cheek band (cheek to cheek) flowing into the belly
  float jaw = zkAA(length(vec2(p.x / 0.5, (p.y - 1.44) / 0.17)) - 1.0) * front;
  float belly = zkAA(length(vec2(p.x / 0.36, (p.y - 0.78) / 0.56)) - 1.0) * front;
  // eye patches: ovals ABOVE and BEHIND the eyes, tilted up toward the back
  vec2 e = vec2(abs(p.x) - 0.35, p.y - 1.75); float a = 0.55; e = mat2(cos(a), -sin(a), sin(a), cos(a)) * e;
  float epatch = zkAA(length(e / vec2(0.14, 0.08)) - 1.0) * smoothstep(-0.25, 0.0, p.z);
  // grey saddle behind the dorsal fin
  float saddle = zkAA(length(vec2(p.x / 0.36, (p.y - 1.22) / 0.16)) - 1.0) * smoothstep(-0.12, -0.35, p.z);
  vec3 c = mix(base, vec3(0.42, 0.44, 0.48), saddle);
  return mix(c, w, max(max(jaw, belly), epatch));
}` },
};
const KINDS = Object.keys(SPECIES_V2);
export const BATCH2 = ['pip','sunny','jelly','lulu','percy','nova','kelpie','giga'];
export const BATCH3 = ['squirt','angie','bella','echo','sharkie','polly','wally','nudi'];
export const BATCH4 = ['pinchy','tusk','mo','gus','zippy','puff','shelly','coco'];
export const BATCH5 = ['stella','hank','inky','milo','hammy','harbor','tango','barrie'];
export const BATCH6 = ['gulliver','iggy','flip','reef','sal','coral','momo','toro'];

export const FRAME_EXTENT = {
  ollie: { w:2.04, h:2.23, d:1.72, x0:-0.68, x1:1.36, y0:-0.01, y1:2.22, z0:-1.09, z1:0.63 },
  wade: { w:2.14, h:2.39, d:2.34, x0:-1.07, x1:1.07, y0:-0.02, y1:2.37, z0:-1.56, z1:0.78 },
  dash: { w:1.49, h:2.27, d:1.69, x0:-0.74, x1:0.74, y0:0, y1:2.27, z0:-0.98, z1:0.7 },
  finn: { w:1.63, h:2.21, d:1.52, x0:-0.81, x1:0.81, y0:-0.01, y1:2.2, z0:-0.92, z1:0.6 },
  bubbles: { w:2.22, h:2.28, d:1.92, x0:-1.11, x1:1.11, y0:0, y1:2.28, z0:-1.3, z1:0.62 },
  oscar: { w:1.66, h:2.62, d:1.65, x0:-0.83, x1:0.83, y0:-0.01, y1:2.61, z0:-1.06, z1:0.59 },
  pip: { w:1.52, h:2.18, d:1.37, x0:-0.76, x1:0.76, y0:-0.03, y1:2.15, z0:-0.63, z1:0.74 },
  sunny: { w:1.59, h:2.17, d:1.3, x0:-0.79, x1:0.79, y0:-0.02, y1:2.15, z0:-0.62, z1:0.68 },
  jelly: { w:1.83, h:2.1, d:1.73, x0:-0.92, x1:0.92, y0:0, y1:2.1, z0:-0.84, z1:0.88 },
  lulu: { w:2.4, h:2.42, d:1.11, x0:-1.2, x1:1.2, y0:-0.02, y1:2.42, z0:-0.55, z1:0.55 },
  percy: { w:2.36, h:2.31, d:2.24, x0:-1.18, x1:1.18, y0:-0.01, y1:2.31, z0:-1.38, z1:0.85 },
  nova: { w:1.78, h:2.41, d:1.78, x0:-0.89, x1:0.89, y0:-0.02, y1:2.38, z0:-1.16, z1:0.62 },
  kelpie: { w:1.55, h:2.40, d:0.85, x0:-0.78, x1:0.78, y0:-0.02, y1:2.40, z0:-0.43, z1:0.43 },
  giga: { w:1.61, h:2.36, d:1.28, x0:-0.8, x1:0.8, y0:-0.01, y1:2.35, z0:-0.62, z1:0.66 },
  // batch 3 (A) — measured rest boxes (no outfit)
  squirt: { w:1.75, h:2.18, d:1.22, x0:-0.89, x1:0.86, y0:-0.03, y1:2.15, z0:-0.64, z1:0.58 },
  angie: { w:1.88, h:2.34, d:1.84, x0:-0.94, x1:0.94, y0:-0.04, y1:2.3, z0:-1.14, z1:0.7 },
  bella: { w:2.22, h:2.24, d:1.48, x0:-1.11, x1:1.11, y0:-0.05, y1:2.24, z0:-0.73, z1:0.75 },
  echo: { w:2.31, h:2.29, d:1.24, x0:-1.15, x1:1.16, y0:-0.05, y1:2.29, z0:-0.61, z1:0.63 },
  sharkie: { w:2.56, h:2.40, d:1.83, x0:-1.28, x1:1.28, y0:-0.05, y1:2.40, z0:-1.04, z1:0.79 },
  polly: { w:2.22, h:2.25, d:1.78, x0:-1.11, x1:1.11, y0:-0.03, y1:2.25, z0:-0.78, z1:1.00 },
  wally: { w:2.33, h:2.34, d:1.50, x0:-1.17, x1:1.16, y0:-0.05, y1:2.34, z0:-0.74, z1:0.76 },
  // batch 4 (B) — measured rest boxes (no outfit)
  pinchy: { w:2.84, h:2.02, d:1.35, x0:-1.45, x1:1.39, y0:-0.02, y1:2, z0:-0.75, z1:0.6 },
  tusk: { w:2.43, h:2.34, d:1.58, x0:-1.22, x1:1.21, y0:-0.05, y1:2.29, z0:-0.78, z1:0.8 },
  mo: { w:2.41, h:2.34, d:1.50, x0:-1.21, x1:1.2, y0:-0.05, y1:2.29, z0:-0.74, z1:0.76 },
  gus: { w:2.26, h:2.38, d:1.93, x0:-1.13, x1:1.13, y0:-0.03, y1:2.35, z0:-0.75, z1:1.18 },
  zippy: { w:2.57, h:2.29, d:1.99, x0:-1.29, x1:1.28, y0:-0.05, y1:2.24, z0:-1.17, z1:0.82 },
  puff: { w:2.68, h:2.05, d:1.99, x0:-1.35, x1:1.33, y0:-0.02, y1:2.03, z0:-1.03, z1:0.96 },
  shelly: { w:2.12, h:2.32, d:1.40, x0:-1.06, x1:1.06, y0:-0.05, y1:2.27, z0:-0.72, z1:0.68 },
  coco: { w:1.71, h:2.44, d:2.13, x0:-0.86, x1:0.85, y0:-0.02, y1:2.42, z0:-1.13, z1:1 },
  // batch 5 (C) — measured rest boxes (no outfit)
  stella: { w:2.13, h:2.08, d:0.54, x0:-1.07, x1:1.06, y0:-0.02, y1:2.06, z0:-0.25, z1:0.29 },
  hank: { w:2.03, h:2.35, d:2.35, x0:-1.05, x1:0.98, y0:-0.09, y1:2.26, z0:-1.11, z1:1.24 },
  inky: { w:2.62, h:2.34, d:1.97, x0:-1.31, x1:1.31, y0:-0.01, y1:2.33, z0:-1.09, z1:0.88 },
  milo: { w:4.09, h:2.14, d:1.95, x0:-2.05, x1:2.04, y0:-0.02, y1:2.12, z0:-1.26, z1:0.69 },
  hammy: { w:2.40, h:2.22, d:1.53, x0:-1.21, x1:1.19, y0:-0.05, y1:2.17, z0:-0.81, z1:0.72 },
  harbor: { w:2.28, h:2.32, d:1.92, x0:-1.14, x1:1.14, y0:-0.04, y1:2.28, z0:-1.15, z1:0.77 },
  tango: { w:2.59, h:2.35, d:2.01, x0:-1.3, x1:1.29, y0:-0.05, y1:2.3, z0:-1.25, z1:0.76 },
  barrie: { w:2.20, h:2.33, d:1.75, x0:-1.1, x1:1.1, y0:-0.03, y1:2.3, z0:-1.07, z1:0.68 },
  // batch 6 (D) — measured rest boxes (no outfit)
  gulliver: { w:2.39, h:2.24, d:1.69, x0:-1.19, x1:1.2, y0:-0.01, y1:2.23, z0:-0.79, z1:0.9 },
  iggy: { w:2.51, h:2.39, d:2.24, x0:-1.26, x1:1.25, y0:-0.04, y1:2.35, z0:-1.4, z1:0.84 },
  flip: { w:2.60, h:2.29, d:1.49, x0:-1.3, x1:1.3, y0:-0.04, y1:2.25, z0:-0.71, z1:0.78 },
  reef: { w:2.56, h:2.27, d:2.06, x0:-1.28, x1:1.28, y0:-0.04, y1:2.23, z0:-1.13, z1:0.93 },
  sal: { w:2.65, h:2.27, d:2.25, x0:-1.33, x1:1.32, y0:-0.04, y1:2.23, z0:-1.41, z1:0.84 },
  coral: { w:2.51, h:2.40, d:2.02, x0:-1.26, x1:1.25, y0:-0.04, y1:2.36, z0:-1.23, z1:0.79 },
  momo: { w:2.87, h:2.44, d:1.85, x0:-1.46, x1:1.45, y0:-0.05, y1:2.39, z0:-1.03, z1:0.82 },
  toro: { w:2.19, h:2.31, d:1.33, x0:-1.1, x1:1.09, y0:-0.03, y1:2.28, z0:-0.72, z1:0.61 },
  nudi: { w:2.08, h:2.35, d:1.49, x0:-1.04, x1:1.04, y0:-0.05, y1:2.3, z0:-0.68, z1:0.81 },
};

// ---------- cached geometry per species ----------
const GEO = {};
function lathes(k){
  const V = SPECIES_V2[k], N = V.neckY, rN = V.body[V.body.length - 1][0], S = V.snout;
  const P = spline([...V.body, ...V.head], 90);
  const body = torsoLathe(V, v => {
    const yl = v.y - V.headY, kk = sstep(N - V.headY, N - V.headY + .23, yl); v.x *= 1 + V.widen * kk; v.z *= 1 - V.flat * kk;
    if(S && v.z > 0){ const e = Math.hypot(v.x / S.rx, (yl - S.y) / S.ry); if(e < 1.3) v.z += S.amt * sstep(1.3, .2, e) * sstep(.1, .35, v.z); }
  });
  return { P, body };
}
function fin(shape, depth = .07, bev = .035){ const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: .035, bevelSegments: 4, curveSegments: 14, steps: 1 });
  g.translate(0, 0, -depth / 2); g.deleteAttribute('uv'); g.computeVertexNormals(); return g; }
function finShape(pts){ const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i += 2) s.quadraticCurveTo(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]); return s; }

function geos(k){
  if(GEO[k]) return GEO[k]; const V = SPECIES_V2[k], G = lathes(k);
  G.sphere = new THREE.SphereGeometry(1, 28, 18);
  const A = V.arm;
  if(A.kind === 'round'){ G.arm = new THREE.SphereGeometry(A.r, 22, 14); G.arm.scale(.42, 1, 1); G.arm.translate(0, -.12, 0); }
  else { const fl = A.kind === 'flipper' || A.kind === 'paddle'; G.arm = blendArm(new THREE.CapsuleGeometry(A.r, A.len, 10, 18), A.r, A.len, fl ? [.45, 1.15] : [1, .9]); }
  const T = V.tail.kind;
  if(T === 'fluke'){ const stem = new THREE.CapsuleGeometry(.12, .3, 8, 16); stem.rotateX(Math.PI / 2 - .25); stem.translate(0, .05, -.2);
    const lobe = fin(finShape([[0,0],[.18,.12],[.42,.06],[.5,-.05],[.36,-.12],[.18,-.12],[0,-.06]]), .05); lobe.rotateX(-Math.PI / 2);
    const L = lobe.clone(); L.translate(.02, .12, -.42); const R = lobe.clone(); R.scale(-1, 1, 1); R.translate(-.02, .12, -.42);
    G.tail = merge([stem, L, R]); }
  if(T === 'crescent'){ const stem = new THREE.CapsuleGeometry(.17, .3, 8, 16); stem.rotateX(Math.PI / 2); stem.translate(0, 0, -.12);
    const cres = fin(finShape([[0,-.05],[.15,.25],[.42,.55],[.3,.18],[.2,-.02],[.32,-.24],[.36,-.42],[.12,-.2],[0,-.05]]), .07); cres.rotateY(Math.PI / 2); cres.translate(0, 0, -.32);
    G.tail = merge([stem, cres]); }
  if(T === 'fish'){ const f = fin(finShape([[0,0],[.12,.2],[.3,.24],[.24,0],[.3,-.24],[.12,-.2],[0,0]]), .06); f.rotateY(Math.PI / 2); f.translate(0, 0, -.02); G.tail = merge([f]); }
  if(T === 'axolotl'){ const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(.04,-.08,-.3), new THREE.Vector3(.18,-.14,-.62), new THREE.Vector3(.42,-.12,-.86)]);
    const tg = new THREE.TubeGeometry(curve, 36, .17, 16, false), pos = tg.attributes.position, uv = tg.attributes.uv, v = new THREE.Vector3(), c = new THREE.Vector3();
    for(let i = 0; i < pos.count; i++){ const u = uv.getX(i); curve.getPointAt(u, c); v.fromBufferAttribute(pos, i).sub(c); const tp = 1 - .8 * u; v.x *= tp * .55; v.y *= tp * (1.25 + .4 * u); v.z *= tp; v.add(c); v.y = Math.max(v.y, -.38); pos.setXYZ(i, v.x, v.y, v.z); }
    const base = new THREE.SphereGeometry(.16, 18, 12); G.tail = merge([tg, base]); }
  if(V.fins.includes('dorsalTall')) G.dorsal = fin(finShape([[-.22,0],[-.05,.15],[.02,.42],[.08,.48],[.14,.3],[.18,.12],[.26,0]]), .08);
  if(V.fins.includes('dorsal')) G.dorsal = fin(finShape([[-.18,0],[-.06,.12],[.06,.3],[.12,.33],[.12,.2],[.13,.08],[.2,0]]), .06);
  if(V.fins.includes('dorsalOrca')){
    const s = new THREE.Shape();
    s.moveTo(-.24, 0);
    s.quadraticCurveTo(-.08, .2, 0, .5);
    s.quadraticCurveTo(.06, .56, .12, .3);
    s.quadraticCurveTo(.14, .12, .12, 0);   // steeper trailing; live ended at x=.26 and floated off the back
    s.lineTo(.10, -.18); s.lineTo(.02, -.34); s.lineTo(-.14, -.34); s.lineTo(-.24, -.16); s.closePath();
    G.dorsal = fin(s, .12, .06);            // same depth/bevel; sunk root stays in the head blend (world y≥1.35)
  }
  if(V.fins.includes('topFin')) G.dorsal = fin(finShape([[-.16,0],[-.14,.1],[-.02,.13],[.04,.16],[.12,.1],[.18,.04],[.18,0]]), .07);
  if(V.fins.includes('gills')){ G.stalk = new THREE.CapsuleGeometry(.04, .3, 4, 8); G.stalk.translate(0, .19, 0); G.frond = new THREE.SphereGeometry(.05, 7, 4); G.frond.scale(1.9, .62, .7); G.frond.translate(.07, 0, 0); }
  G.smile = V.smile ? new THREE.TorusGeometry(V.smile.w, .011, 8, 24, V.smile.r * Math.PI / 2) : null;
  if(G.smile) G.smile.rotateZ(Math.PI + (Math.PI - V.smile.r * Math.PI / 2) / 2);
  Object.values(G).forEach(g => { if(g && g.isBufferGeometry) g.userData.shared = true; });
  return (GEO[k] = G);
}
export const SPECIES_PROFILES = {}; for(const k of KINDS) SPECIES_PROFILES[k] = spline([...SPECIES_V2[k].body, ...SPECIES_V2[k].head], 90);
for(const k of BATCH2) Object.defineProperty(SPECIES_PROFILES, k, { enumerable: true, get: () => b2Profile(k) });   // batch 2: measured torso profile (built on first use)
for(const k of BATCH3) Object.defineProperty(SPECIES_PROFILES, k, { enumerable: true, get: () => b3Profile(k) });   // batch 3
for(const k of BATCH4) Object.defineProperty(SPECIES_PROFILES, k, { enumerable: true, get: () => b4Profile(k) });   // batch 4
for(const k of BATCH5) Object.defineProperty(SPECIES_PROFILES, k, { enumerable: true, get: () => b5Profile(k) });   // batch 5
for(const k of BATCH6) Object.defineProperty(SPECIES_PROFILES, k, { enumerable: true, get: () => b6Profile(k) });   // batch 6

// Clothing profile for bodyR()/profileSlice() (tees at y=0.6–1.2, pants at 0.26–0.62).
// Dome/mantle bodies (Jelly starts at y=0.68) must not let bodyR extrapolate below the first
// lathe point — that blew Jelly's tee out to a 20-unit disc. Extend the first substantial
// radius down to y=0 so a shirt becomes a band around the bell, not a giant plane.
function clothProfile(P){
  let i = 0; while(i < P.length && P[i].x < 0.08) i++;
  const skirt = P[Math.min(i, P.length - 1)];
  const out = [];
  if(skirt.y > 0.02) out.push(new THREE.Vector2(skirt.x, 0));
  for(let j = i; j < P.length; j++) out.push(new THREE.Vector2(Math.max(0, P[j].x), P[j].y));
  return out;
}

function headR(P, y){ for(let i = 1; i < P.length; i++){ if(P[i].y >= y){ const a = P[i-1], b = P[i]; return a.x + (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1); } } return 0; }
function surfZ(V, P, x, yl){ const R = headR(P, yl + V.headY), kk = sstep(V.neckY - V.headY, V.neckY - V.headY + .23, yl); const rx = R * (1 + V.widen * kk), rz = R * (1 - V.flat * kk);
  const q = 1 - (x / rx) ** 2; let z = q > 0 ? rz * Math.sqrt(q) : 0; const S = V.snout;
  if(S){ const e = Math.hypot(x / S.rx, (yl - S.y) / S.ry); if(e < 1.3) z += S.amt * sstep(1.3, .2, e) * sstep(.1, .35, z); } return z; }

/** Build a V2 species (same contract as buildOllie). deps = the installOllieV2 deps (addEquipment, setProfile). */
export function buildSpeciesV2(kind, { equipped = {}, ghost = false } = {}, D){
  if(B2[kind]){ const g = buildB2(kind, { equipped, ghost }, D); g.userData.extent = FRAME_EXTENT[kind]; return g; }
  if(B3[kind]){ const g = buildB3(kind, { equipped, ghost }, D); g.userData.extent = FRAME_EXTENT[kind]; return g; }
  if(B4[kind]){ const g = buildB4(kind, { equipped, ghost }, D); g.userData.extent = FRAME_EXTENT[kind]; return g; }
  if(B5[kind]){ const g = buildB5(kind, { equipped, ghost }, D); g.userData.extent = FRAME_EXTENT[kind]; return g; }
  if(B6[kind]){ const g = buildB6(kind, { equipped, ghost }, D); g.userData.extent = FRAME_EXTENT[kind]; return g; }
  const V = SPECIES_V2[kind], G = geos(kind), P = SPECIES_PROFILES[kind];
  const paint = off => ({ key: kind, glsl: V.glsl, off, part: 0 });
  const o = { rough: V.rough ?? .8, cc: V.cc ?? .05, sheen: V.sheen ?? (V.cc ? .15 : .42) };
  if(V.sheenCol != null) o.sheenCol = V.sheenCol;
  const neck = { a: +(V.neckY - .06).toFixed(3), b: +(V.neckY + .14).toFixed(3) };
  const bodyM = clay(V.color, ghost, { ...o, paint: paint([0, 0, 0]), neck });
  const plain = clay(V.color, ghost, o);
  const armM = V.armColor != null ? clay(V.armColor, ghost, o) : plain;
  const footM = V.foot && V.foot.color != null ? clay(V.foot.color, ghost, o) : clay(V.color, ghost, { ...o, paint: { ...paint([0, 0, 0]), part: 1 } });
  const black = gloss(ghost);
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); const parts = { rig };
  const body = new THREE.Mesh(G.body, bodyM); rig.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.y = V.headY; rig.add(head); parts.head = head;
  neckTorso(body, bodyM, head, V.headY, ghost); parts.headMesh = body;
  const hatA = new THREE.Group(); hatA.position.y = V.hat.y; hatA.scale.setScalar(V.hat.s); head.add(hatA); parts.hatAnchor = hatA;
  const eyeA = new THREE.Group(); eyeA.position.set(...V.eyeA.p); eyeA.scale.set(...V.eyeA.s); head.add(eyeA); parts.eyeAnchor = eyeA;
  for(const s of [-1, 1]){
    const ex = V.eye.x * s, ey = V.eye.y, eye = new THREE.Mesh(G.sphere, black); eye.name = 'eye'; eye.scale.set(...V.eye.s); eye.position.set(ex, ey, surfZ(V, P, ex, ey) - .01); eye.rotation.y = Math.asin(Math.min(.9, ex / (headR(P, ey + V.headY) || 1))) * .6; head.add(eye);
    const shine = new THREE.Mesh(G.sphere, shineMat()); shine.scale.set(.016 / V.eye.s[0], .016 / V.eye.s[1], .016 / V.eye.s[2]); shine.position.set(.3, .38, .8); eye.add(shine); if(ghost) shine.visible = false;
    const shx = headR(P, V.sh.y) - V.sh.inset, sh = new THREE.Group(); sh.position.set(shx * s, V.sh.y, V.sh.z); rig.add(sh); parts['sh' + s] = sh;
    const arm = new THREE.Mesh(G.arm, armM); arm.position.set(.03 * s, -.16, 0); arm.rotation.set(V.arm.rx, 0, V.arm.rz * s);
    if((V.arm.kind === 'tentacle' || V.arm.kind === 'frond') && s < 0) arm.scale.x = -1;
    sh.add(arm); parts['arm' + s] = arm;
    const foot = new THREE.Mesh(G.sphere, footM); foot.scale.set(...V.foot.s); foot.position.set(V.foot.x * s, V.foot.y, V.foot.z); rig.add(foot); parts['foot' + s] = foot;
    if(kind === 'bubbles'){ const toeM = clay(0xe0789c, ghost); for(const k of [-1, 0, 1]){ const toe = new THREE.Mesh(G.sphere, toeM); toe.scale.set(.2, .5, .22); toe.position.set(.42 * k, -.35, .82); foot.add(toe); } }
    if(G.stalk){
      const gillM = clay(0xff8fb8, ghost), frondM = clay(0xd64485, ghost);
      for(let i = 0; i < 3; i++){ const gg = new THREE.Group(); gg.name = 'gill'; const yl = -.06 + i * .15, x0 = (headR(P, yl + V.headY) * (1 + V.widen) - .05) * s;
        gg.position.set(x0, yl, -.04); gg.rotation.z = s * (-1.75 + i * .55); gg.rotation.y = -.35 * s;
        const st = new THREE.Mesh(G.stalk, gillM); gg.add(st);
        for(let j = 0; j < 8; j++){ const t = j / 7, len = .7 + .55 * Math.sin(Math.PI * (.15 + .7 * t)); for(const side of [-1, 1]){
          const fr = new THREE.Mesh(G.frond, frondM); fr.position.set(side * .02, .06 + j * .042, (j % 2 ? .012 : -.012)); fr.rotation.z = side > 0 ? .55 : Math.PI - .55; fr.scale.setScalar(len); gg.add(fr); } }
        const tip = new THREE.Mesh(G.frond, frondM); tip.position.set(0, .38, 0); tip.rotation.z = Math.PI / 2; tip.scale.setScalar(.8); gg.add(tip);
        head.add(gg); } }
  }
  if(G.smile){ const sm = new THREE.Mesh(G.smile, black); const y = V.smile.y; sm.position.set(0, y + V.smile.w * .55, surfZ(V, P, 0, y) + (V.smile.z || 0) * 0 - .004); sm.rotation.x = -.3; head.add(sm); }
  if(G.dorsal){ const d = new THREE.Mesh(G.dorsal, plain); d.rotation.y = Math.PI / 2;
    if(kind === 'wade'){ d.position.set(0, 1.84 - V.headY, -.3); d.rotation.x = -.3; head.add(d); }
    if(kind === 'dash'){ d.position.set(0, 1.86 - V.headY, -.28); d.rotation.x = -.45; head.add(d); }
    if(kind === 'oscar'){ d.position.set(0, 1.84 - V.headY, -.26); d.rotation.x = -.2; d.scale.setScalar(1.3); head.add(d); }
    if(kind === 'finn'){ d.position.set(0, .5, -.1); d.rotation.x = -.15; head.add(d); } }
  const tail = new THREE.Mesh(G.tail, plain); tail.position.set(...V.tail.pos); tail.scale.setScalar(V.tail.s); rig.add(tail); parts.tail = tail;
  g.traverse(m => { if(m.isMesh) m.userData.base = true; });
  if(D.setProfile) D.setProfile(clothProfile(P));
  if(!ghost) D.addEquipment(rig, parts, equipped);
  g.traverse(m => { if(m.isMesh) m.castShadow = !ghost; });
  g.userData.parts = parts; g.userData.walk = 0; g.userData.kind = kind; g.userData.v2 = 'C'; g.userData.animStyle = V.anim;
  g.userData.extent = FRAME_EXTENT[kind] || V.extent;
  return g;
}
