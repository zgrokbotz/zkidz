/* ZKIDZ online leaderboard — anon-key fetch to Supabase REST/RPC only.
   No service key. No extra libraries. Safe to import from game.js. */
export const LB_URL = 'https://wvirgjnypgajfiunlwxe.supabase.co';
export const LB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aXJnam55cGdhamZpdW5sd3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MjU1ODksImV4cCI6MjExMDQwMTU4OX0.rL1cTRUM6ybfgZMQlgKJ7aUYcwc0YJB5PMW7ceFnlHI';
const SELECT = 'id,nickname,character_id,outfit,mode,score,created_at';
export const LB_TABS = [
  ['maze','🌀 Maze'],
  ['race','🏁 Race'],
  ['match','🃏 Match'],
  ['sort','🐚 Sort'],
  ['diner','🍽️ Diner'],
  ['hide','🙈 Hide'],
  ['total','⭐ Total']
];
const LOWER_BETTER = { race:true };
const DEVICE_KEY = 'zkidz_device_id';

let ctx = {
  getS:()=>null, save:()=>{}, artUrl:()=>'', lookThumb:()=>null,
  isAppleTouch:false, toast:()=>{}, click:()=>{}
};

export function initLB(c){ if(c) ctx = Object.assign(ctx, c); }

function S(){ return ctx.getS() || {}; }

export function deviceId(){
  try{
    let id = localStorage.getItem(DEVICE_KEY);
    if(!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
      id = (crypto.randomUUID && crypto.randomUUID()) || ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch=>{
        const r=Math.random()*16|0; return (ch==='x'?r:(r&0x3|0x8)).toString(16);
      }));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }catch(e){
    return '00000000-0000-4000-8000-000000000001';
  }
}

function headers(){
  return { apikey: LB_ANON, Authorization: 'Bearer '+LB_ANON, Accept: 'application/json', 'Content-Type': 'application/json' };
}

async function rpc(fn, body){
  const r = await fetch(`${LB_URL}/rest/v1/rpc/${fn}`, { method:'POST', headers: headers(), body: JSON.stringify(body||{}) });
  const data = await r.json().catch(()=>null);
  if(!r.ok){
    const msg = (data && (data.message || data.error_description)) || ('http '+r.status);
    throw new Error(msg);
  }
  return data;
}

export async function fetchBoard(mode){
  const order = LOWER_BETTER[mode] ? 'score.asc' : 'score.desc';
  const url = `${LB_URL}/rest/v1/scores?mode=eq.${encodeURIComponent(mode)}&select=${SELECT}&order=${order}&limit=50`;
  const r = await fetch(url, { headers: headers() });
  if(!r.ok) throw new Error('http '+r.status);
  const rows = await r.json();
  if(!Array.isArray(rows)) throw new Error('bad board');
  return rows;
}

export async function suggestNames(n=3){
  const out=[], seen=new Set();
  for(let i=0;i<Math.max(n*3, n) && out.length<n;i++){
    const d = await rpc('generate_nickname', {});
    const name = d && d.nickname;
    if(name && !seen.has(name)){ seen.add(name); out.push(name); }
  }
  if(!out.length) out.push('SunnyOtter','CoralRay','HappyPuff');
  return out.slice(0,n);
}

export function hasNick(){
  const s=S();
  return !!(s.lbNick && String(s.lbNick).trim());
}

export function formatScore(mode, score){
  const n = +score;
  if(!isFinite(n)) return '—';
  if(mode==='race') return (n/1000).toFixed(2)+'s';
  if(mode==='diner' || mode==='total') return String(Math.round(n));
  if(mode==='maze' || mode==='sort' || mode==='hide' || mode==='match') return 'Level '+Math.round(n);
  return String(Math.round(n));
}

export function localScores(s){
  s = s || S();
  const out = {};
  if((s.bestLevel|0)>0) out.maze = s.bestLevel|0;
  if(Array.isArray(s.raceTimes) && s.raceTimes.length) out.race = Math.round(Number(s.raceTimes[0])*1000);
  if((s.cardsRound|0)>1) out.match = Math.max(1, (s.cardsRound|0)-1);
  try{
    const P=JSON.parse(localStorage.getItem('zkidz_sort_v1')||'{}')||{};
    const cleared=Math.max(0, (P.unlocked|0)-1, ...Object.keys(P.stars||{}).map(Number));
    if(cleared>0) out.sort=cleared;
  }catch(e){}
  try{
    const P=JSON.parse(localStorage.getItem('zkidz_dash_v1')||'{}')||{};
    if((P.best|0)>0) out.diner=P.best|0;
  }catch(e){}
  try{
    const P=JSON.parse(localStorage.getItem('zkidz_hide_v1')||'{}')||{};
    const cleared=Math.max(0, (P.unlocked|0)-1, ...Object.keys(P.clears||{}).map(Number), ...Object.keys(P.stars||{}).map(Number));
    if(cleared>0) out.hide=cleared;
  }catch(e){}
  return out;
}

export async function submitScore(mode, score, nickname){
  const s=S();
  const nick = (nickname || s.lbNick || s.name || '').trim();
  const data = await rpc('submit_score', {
    p_nickname: nick,
    p_character_id: s.selChar || 'ollie',
    p_outfit: s.equipped || {},
    p_mode: mode,
    p_score: score|0,
    p_device_id: deviceId()
  });
  if(data && data.ok){
    s.lbNick = data.nickname || nick;
    if(s.lbNick) s.name = s.lbNick;
    s.lbIds = s.lbIds || {};
    if(data.id) s.lbIds[mode] = data.id;
    ctx.save();
  }
  return data;
}

export async function flushLocalScores(nickname){
  const scores = localScores();
  const results = {};
  for(const mode of Object.keys(scores)){
    try{ results[mode] = await submitScore(mode, scores[mode], nickname); }
    catch(e){ results[mode] = { ok:false, error:'network', message:'Could not reach the board just now.' }; }
  }
  return results;
}

export async function offerSubmit(mode, score){
  if(score==null || !isFinite(+score) || +score<0) return { ok:false, error:'no_score' };
  if(!hasNick()) return { ok:false, error:'need_name' };
  try{ return await submitScore(mode, score|0); }
  catch(e){ return { ok:false, error:'network', message:'Could not reach the board just now.' }; }
}

function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function portraitHtml(charId, outfit){
  const id = charId || 'ollie';
  const eq = outfit && typeof outfit==='object' ? outfit : {};
  let src = '';
  try{ if(!ctx.isAppleTouch && ctx.lookThumb) src = ctx.lookThumb(id, eq) || ''; }catch(e){ src=''; }
  if(!src && ctx.artUrl){ try{ src = ctx.artUrl(id) || ''; }catch(e){ src=''; } }
  if(src) return `<span class="lb-face"><img alt="" src="${escapeHtml(src)}" draggable="false"></span>`;
  return `<span class="lb-face lb-face-em">🐠</span>`;
}

function isYou(row, s){
  if(!row) return false;
  s = s || S();
  if(s.lbIds && row.id && Object.values(s.lbIds).indexOf(row.id)>=0) return true;
  const nick = (s.lbNick || '').trim();
  return !!(nick && row.nickname === nick);
}

const SAMPLE = {
  maze: [['OceanKing',12,'oscar'],['BubbleBrawler',10,'bubbles'],['Finatic',8,'finn'],['CoralCrusher',6,'dash'],['DeepDiver99',4,'wade']],
  race: [['OceanKing',38200,'oscar'],['BubbleBrawler',41700,'bubbles'],['Finatic',45000,'finn'],['CoralCrusher',49300,'dash'],['DeepDiver99',55800,'wade']]
};

export function localFallbackRows(mode){
  const s=S();
  const rows=[];
  const samples = SAMPLE[mode] || [];
  for(const [n,v,ch] of samples) rows.push({ n, v, char:ch||'ollie', eq:{}, sample:true });
  const loc = localScores(s);
  if(mode==='total'){
    // no local total without server math; skip sample
  }else if(loc[mode]!=null){
    rows.push({ n: s.lbNick||s.name||'You', v: loc[mode], char:s.selChar||'ollie', eq:{...(s.equipped||{})}, me:true });
  }
  if(LOWER_BETTER[mode]) rows.sort((a,b)=>a.v-b.v);
  else rows.sort((a,b)=>b.v-a.v);
  return rows;
}

export async function loadRows(mode){
  try{
    const remote = await fetchBoard(mode);
    const s=S();
    const rows = remote.map(r=>({
      id:r.id, n:r.nickname, v:r.score, char:r.character_id||'ollie',
      eq:r.outfit||{}, me:isYou(r,s), online:true
    }));
    // If "you" are not in the top 50, append a local row so the player still sees themselves.
    if(hasNick() && !rows.some(r=>r.me)){
      const loc=localScores(s)[mode];
      if(loc!=null){
        rows.push({ n:s.lbNick||s.name, v:loc, char:s.selChar||'ollie', eq:{...(s.equipped||{})}, me:true, local:true });
        if(LOWER_BETTER[mode]) rows.sort((a,b)=>a.v-b.v);
        else rows.sort((a,b)=>b.v-a.v);
      }
    }
    return { ok:true, online:true, rows: rows.slice(0,50) };
  }catch(e){
    return { ok:false, online:false, rows: localFallbackRows(mode), error:String(e&&e.message||e) };
  }
}

export function rowHtml(r, i, mode){
  const tag = r.sample ? '<span class="tag">(sample)</span>' : r.me ? ' <span class="tag">(you)</span>' : '';
  return `<tr class="${r.me?'me':''}"><td>${i+1}.</td><td class="lb-who">${portraitHtml(r.char,r.eq)} <span class="lb-n">${escapeHtml(r.n)}</span>${tag}</td><td>${escapeHtml(formatScore(mode,r.v))}</td></tr>`;
}

export function pickerHtml(suggestions, typed, err){
  const chips = (suggestions||[]).map(n=>`<button type="button" class="btn small green lb-sug" data-nick="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('');
  return `<div class="lb-join" id="lbJoin">
    <h3>Join the online board!</h3>
    <p>Pick a wholesome ocean name. This is how other families will see you — letters, numbers, and spaces only.</p>
    <div class="lb-sugs">${chips}<button type="button" class="btn small blue" id="lbShuffle">MORE NAMES</button></div>
    <p class="note">or type your own (3–12 letters and numbers)</p>
    <div class="lb-type"><input id="lbNickIn" class="lb-in" maxlength="12" placeholder="Your name" value="${escapeHtml(typed||'')}" autocomplete="off" spellcheck="false"><button type="button" class="btn small green" id="lbUseNick">USE THIS NAME</button></div>
    <p class="lb-err" id="lbNickErr">${escapeHtml(err||'')}</p>
  </div>`;
}

export function bindPicker(onChanged){
  const inp = document.getElementById('lbNickIn');
  const errEl = document.getElementById('lbNickErr');
  const setErr = msg=>{ if(errEl) errEl.textContent = msg||''; };
  document.querySelectorAll('.lb-sug').forEach(b=>{
    b.onclick = ()=>{ ctx.click(); if(inp) inp.value = b.getAttribute('data-nick')||''; setErr(''); };
  });
  const sh = document.getElementById('lbShuffle');
  if(sh) sh.onclick = async ()=>{
    ctx.click();
    sh.disabled = true;
    try{
      const names = await suggestNames(3);
      const wrap = document.querySelector('.lb-sugs');
      if(wrap){
        wrap.querySelectorAll('.lb-sug').forEach(el=>el.remove());
        const more = document.getElementById('lbShuffle');
        names.forEach(n=>{
          const b=document.createElement('button');
          b.type='button'; b.className='btn small green lb-sug'; b.setAttribute('data-nick',n); b.textContent=n;
          b.onclick=()=>{ ctx.click(); if(inp) inp.value=n; setErr(''); };
          wrap.insertBefore(b, more);
        });
      }
    }catch(e){ setErr('Could not get new names just now.'); }
    sh.disabled = false;
  };
  const use = document.getElementById('lbUseNick');
  if(use) use.onclick = async ()=>{
    ctx.click();
    const nick = (inp && inp.value || '').trim();
    if(!nick){ setErr('Pick a suggested name or type one!'); return; }
    use.disabled = true;
    try{
      const check = await rpc('check_nickname', { p_nickname: nick });
      if(!check || !check.ok){
        setErr((check && check.message) || "Let's pick a different name!");
        use.disabled=false; return;
      }
      const accepted = check.nickname || nick;
      const loc = localScores();
      const modes = Object.keys(loc);
      if(modes.length){
        const results = await flushLocalScores(accepted);
        const first = results[modes[0]];
        if(first && first.error==='bad_name'){
          setErr(first.message || "Let's pick a different name!");
          use.disabled=false; return;
        }
      }else{
        const s=S(); s.lbNick = accepted; s.name = accepted; ctx.save();
      }
      ctx.toast && ctx.toast('You are on the board as '+accepted+'!');
      if(onChanged) onChanged();
      return;
    }catch(e){
      setErr((e&&e.message) || 'Could not reach the board just now.');
    }
    use.disabled = false;
  };
}

export function noteFor(board, mode, s){
  s=s||S();
  const allStar = mode==='maze' ? s.mazeAllClears : mode==='race' ? s.raceAllClears : 0;
  const star = allStar>0 ? `<p class="note allstar-note">⭐ ALL STARFISH runs: <b>${allStar}</b> <small>(ranking is by ${mode==='maze'?'level':'time'} only)</small></p>` : '';
  if(board.online){
    return star + `<p class="note">Online top 50 — wholesome names only. Your row is highlighted when you are on the board.</p>`;
  }
  return star + `<p class="note">Showing this device only — could not reach the online board. Sample players are placeholders.</p>`;
}


/* ---------- kid-safe name check (profile button + offline fallback) ---------- */
export const NICK_FRIENDLY = "Let's pick a different name!";

const LOCAL_BLOCK = new Set([
  // profanity
  'fuck','fucking','fucked','fucker','fuckers','fucks','motherfucker','motherfuck',
  'fck','fuk','fuc','fuq','fvck','phuck','phuk','fcuk','fukc','fucc','fuckin','fock',
  'shit','shits','shitty','shitting','bullshit','shithead','shyt','sht','shlt',
  'bitch','bitches','bitchy','biatch','btch','bytch','bich',
  'damn','dammit','damnit','goddamn','goddam',
  'ass','asses','asshole','assholes','asshat','dumbass','badass','jackass','smartass','fatass','lazyass',
  'arse','arses','arsehole','azz','bastard','bastards',
  'piss','pisses','pissed','pisser','pissoff',
  'dick','dicks','dickhead','dickheads','dck',
  'cock','cocks','cocky','cocksuck','cocksucker',
  'pussy','pussies','puss','cunt','cunts','cnt','twat','twats',
  'wank','wanker','wanking','wankers','prick','pricks',
  'bollocks','bugger','bloodyhell','crap','crappy','craps',
  'slut','sluts','slutty','whore','whores','hooker','hookers',
  'tit','tits','titties','titty','boob','boobs','boobies','boobie','nipple','nipples',
  'jerkoff','jackoff','handjob','blowjob','blowjobs','handjobs','suckmydick','suckdick',
  // sexual
  'sex','sexy','sexual','sexist','sexing','sexed',
  'porn','porno','pornos','pornography','xxx','xxxl','nsfw',
  'nude','nudes','naked','nudity','nudist',
  'penis','penile','vagina','vaginal','clit','clitoris','vulva',
  'orgasm','orgasms','horny','hornier',
  'onlyfans','milf','dilf','dildo','dildos','vibrator',
  'anal','analsex','oral','oralsex','cum','cumming','semen','sperm','ejaculate',
  'rape','raped','rapist','raping','rapes',
  'molest','molester','molesting','molested',
  'hentai','erotica','erotic','orgy','orgies','incest','incestuous',
  'threesome','bondage','fetish','fetishes','bdsm','kinky','kink',
  'stripper','strippers','stripclub','brothel','masturbate','masturbating','masturbation',
  'jizz','dong','wang','boner','boners','hardon','erection','condom','condoms','viagra',
  'pedo','pedophile','pedophilia','paedo','paedophile','pedobear',
  'childporn','childsex','kiddieporn','loli','lolita','lolicon','shotacon','shota',
  'preteen','underage','jailbait','jbail','bestiality','zoophile','necrophile','necrophilia',
  // slurs / hate
  'nigger','niggers','nigga','niggas','nigg','negro','negros','darkie','darky',
  'chink','chinks','gook','gooks','spic','spics','spick',
  'kike','kikes','wetback','wetbacks','beaner','beaners',
  'paki','pakis','honky','honkie','redskin','redskins','squaw',
  'fag','fags','faggot','faggots','fagot','homos','homo',
  'dyke','dykes','tranny','trannies','shemale','shemales',
  'retard','retards','retarded','mongoloid',
  'cripple','cripples','spaz','spazz','spastic',
  'nazi','nazis','nazism','hitler','swastika','swastikas','kkk','klan','klansman',
  'racist','racism','whitepower','siegheil','heilhitler','terrorist','terrorists','isis',
  // drugs
  'weed','weedz','marijuana','marihuana','cannabis','cannibus',
  'cocaine','cocain','heroin','meth','methhead','crystalmeth',
  'fentanyl','fent','crackhead','crackheads','lsd','ecstasy','molly','mdma',
  'xanax','oxy','oxycodone','percocet','vicodin',
  'vape','vaping','vapes','vaper','bong','bongs','blunt','blunts',
  'stoned','stoner','stoners','highaf','dealer','dealers','drugdealer','drugs','dope','doped',
  'opium','opioid','opioids','ketamine','shrooms','pothead','potheads','ganja','blazeit','420blaze',
  // violence / gore
  'killer','killers','killing','killthem','killme',
  'murder','murderer','murderers','murdering','murdered',
  'suicide','suicidal','kys','kms','killyourself',
  'gore','gory','gored','bloody','bloodbath','bloodlust',
  'shooter','shooters','schoolshoot','gun','gunman','firearm','firearms',
  'stab','stabber','stabbing','stabbed','bomb','bombs','bomber','bombing','terror',
  'torture','torturer','torturing','tortured','abuse','abuser','abusing','abused',
  'die','death','deaths','slaughter','massacre','genocide',
  'hangyourself','cutyourself','bleedout','behead','beheading','decapitate','dismember',
  // bathroom
  'poop','poops','poopy','poo','poos','pooping','pooped',
  'pee','pees','peeing','peed','peepee',
  'fart','farts','farting','farted','farty',
  'toilet','toilets','urinal','urinals','diarrhea','diarrhoea','turd','turds',
  'butthole','buttholes','booty','booties','fartface','poopface','poohead',
  'dung','feces','faeces','urine','urinating','stinkybutt','stinkypoop',
  // insults often blocked in kids games
  'stfu','wtf','omfg','gtfo','loser','losers','idiot','idiots','stupid','stupidass',
  'dumb','dumbo','hateyou','ihateyou','ihate','ugly','ugliest','fatso','fatty','shut','shutup','shutit',
  // urls / socials
  'http','https','www','html','instagram','insta','tiktok','ticktock','facebook',
  'snapchat','discord','youtube','youtuber','twitch','whatsapp','telegram',
  'reddit','pornhub','xvideos','xnxx','dotcom','dotnet','dotorg','dotio','hell'
]);

const LOCAL_ALLOW = new Set([
  'class','classes','classic','classical','classify','classroom',
  'grass','grassy','grasses','hello','hallo','hellos',
  'shell','shells','seashell','seashells','shelly','shellie',
  'grape','grapes','grapefruit','scunthorpe',
  'little','littlest','title','titles','stitch','stitches','titan','titans','titanium',
  'cucumber','cucumbers','document','documents',
  'peacock','peacocks','cocktail','cockatoo','cockatoos',
  'skill','skills','skilled','skillet','killian',
  'lollipop','lollipops','lolipop','amongus','among',
  'bass','basses','passion','passionate','passage','passages','pass','passed','passing',
  'assume','assumption','assistant','assist','cassette','cassie','cassidy',
  'michelle','mitchell','shelley','therapy','therapist','therapeutic',
  'scrape','scrapes','scrap','scraps','scrappy','draper','drapes',
  'firecracker','firecrackers','butterfly','butterflies','butter',
  'button','buttons','cannon','cannons','island','islands','sunset','sunsets',
  'student','students','studying','study','underwater','understand','understanding',
  'japanese','chinese','english','hotdog','hotdogs','arsenal',
  'glass','glasses','grasshopper','associate','associates',
  'balloon','balloons','ballerina','sunny','sunshine',
  'coral','corals','coralreef','choral','floral','pastoral','moral','morally','orally','oracle','oracles',
  'tweed','tweedy'
]);

function _leet(t, one){
  return String(t||'').toLowerCase()
    .replace(/0/g,'o').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s')
    .replace(/7/g,'t').replace(/@/g,'a').replace(/\$/g,'s').replace(/8/g,'b')
    .replace(/2/g,'z').replace(/1/g, one).replace(/ph/g,'f');
}
function _strip(t){ return String(t||'').toLowerCase().replace(/[^a-z]+/g,''); }
function _collapse(t, minRun){
  const n=Math.max(minRun,2);
  const re=new RegExp('([a-z])\\1{'+(n-1)+',}','g');
  return String(t||'').replace(re,'$1');
}
function _variants(raw){
  const out=[];
  for(const one of ['i','l']){
    const mapped=_leet(raw, one);
    const stripped=_strip(mapped);
    out.push(stripped, _collapse(stripped,3), _collapse(stripped,2));
  }
  return out;
}
function _tokens(raw){
  const toks=[];
  for(const one of ['i','l']){
    const mapped=_leet(raw, one);
    for(const tok of mapped.trim().split(/\s+/)){
      const t=_collapse(_strip(tok),2);
      if(t) toks.push(t);
    }
  }
  return toks;
}
function _allowCovers(norm, word){
  for(const a of LOCAL_ALLOW){
    if(a.includes(word) && norm.includes(a)) return true;
  }
  return false;
}

export function checkNicknameLocal(raw, max=12){
  const n=String(raw||'').trim();
  if(!n || n.length<3 || n.length>max) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
  if(!/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(n)) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
  const compact=n.replace(/\s+/g,'');
  if(/[0-9]{7,}/.test(compact)) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
  if(/(https?|www|dotcom|dotnet|dotorg|instagram|tiktok|facebook|snapchat|discord|youtube|whatsapp|telegram)/i.test(compact)){
    return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
  }
  if(n.length>12 && /\s/.test(n)) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
  const variants=_variants(n);
  const tokens=_tokens(n);
  for(const w of LOCAL_BLOCK){
    for(const v of variants){
      if(w.length>=4){ if(v.includes(w) && !_allowCovers(v,w)) return { ok:false, error:'bad_name', message:NICK_FRIENDLY }; }
      else if(v===w) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
    }
    for(const tok of tokens){
      if(tok===w) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
      if(w.length>=4 && tok.includes(w) && !_allowCovers(tok,w)) return { ok:false, error:'bad_name', message:NICK_FRIENDLY };
    }
  }
  return { ok:true, nickname:n };
}

export async function checkNickname(raw, max=12){
  const n=String(raw||'').trim();
  try{
    const data=await rpc('check_nickname', { p_nickname:n });
    if(data && typeof data.ok==='boolean') return data;
  }catch(e){}
  return checkNicknameLocal(n, max);
}
