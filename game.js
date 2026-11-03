(() => {
"use strict";

const $ = id => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const W = 800, H = 500, TILE = 50, COLS = 16, ROWS = 10;
const TAU = Math.PI * 2;
const MAX_WAVE = 20;
const STORAGE = "dont-play-this-game-v1";

const MAPS = [
  { name: "NEON CROSSING", tint: "#52e0ed", points: [[-1,4],[2,4],[2,1],[6,1],[6,7],[10,7],[10,3],[13,3],[13,5],[16,5]] },
  { name: "REDLINE CANYON", tint: "#ff9c68", points: [[-1,2],[4,2],[4,7],[7,7],[7,1],[11,1],[11,8],[14,8],[14,5],[16,5]] },
  { name: "GHOST CIRCUIT", tint: "#b4a0ff", points: [[-1,7],[3,7],[3,2],[8,2],[8,8],[12,8],[12,3],[14,3],[14,7],[16,7]] }
];


const POWER_PADS=[
  [{c:5,r:3,type:"range"},{c:9,r:5,type:"speed"},{c:12,r:1,type:"damage"}],
  [{c:2,r:5,type:"speed"},{c:9,r:4,type:"damage"},{c:13,r:3,type:"range"}],
  [{c:5,r:4,type:"range"},{c:10,r:5,type:"damage"},{c:13,r:1,type:"speed"}]
];
const PAD_TYPES={
  range:{color:"#60e6f7",name:"LONGSHOT PAD",bonus:"+22% range",symbol:"◎"},
  speed:{color:"#c1a8ff",name:"QUICKFIRE PAD",bonus:"+18% fire rate",symbol:"ϟ"},
  damage:{color:"#ffc978",name:"WARHEAD PAD",bonus:"+22% damage",symbol:"✦"}
};
function padAt(c,r){return POWER_PADS[state.mapIndex].find(p=>p.c===c&&p.r===r)||null;}
const TOWERS = [
  { id:"pulse", name:"PULSE CANNON", caption:"Fast, reliable laser fire", cost:85, color:"#61eafb", symbol:"✦", damage:17, range:140, interval:.46 },
  { id:"rail", name:"RAIL DRIVER", caption:"Long-range piercing shots", cost:180, color:"#ffa879", symbol:"⌁", damage:78, range:220, interval:1.6 },
  { id:"cryo", name:"CRYO EMITTER", caption:"Slows enemies to a crawl", cost:145, color:"#a2c6ff", symbol:"❄", damage:11, range:145, interval:.73 },
  { id:"mortar", name:"NOVA MORTAR", caption:"Explosive splash damage", cost:215, color:"#f6c36e", symbol:"✷", damage:57, range:215, interval:1.95 },
  { id:"tesla", name:"ARC TESLA", caption:"Lightning chains between foes", cost:265, color:"#c1a4ff", symbol:"ϟ", damage:36, range:165, interval:1.06 },
  { id:"mint", name:"CREDIT MINE", caption:"Earn credits after each wave", cost:155, color:"#c5f77c", symbol:"◆", damage:0, range:0, interval:0 }
];
const TOWER_BY_ID = Object.fromEntries(TOWERS.map(t => [t.id,t]));

const ENEMIES = {
  drone:    { hp:48, speed:66, reward:12, leak:1, color:"#ff667b", radius:14, armor:0 },
  runner:   { hp:34, speed:124, reward:11, leak:1, color:"#ffbf69", radius:10, armor:0 },
  brute:    { hp:195, speed:43, reward:25, leak:2, color:"#fa788f", radius:19, armor:.16 },
  shield:   { hp:132, speed:71, reward:22, leak:2, color:"#73c9ff", radius:15, armor:0, shield:115 },
  splitter: { hp:127, speed:81, reward:19, leak:1, color:"#bb93ff", radius:15, armor:0 },
  mini:     { hp:30, speed:130, reward:4, leak:1, color:"#d7b9ff", radius:8, armor:0 },
  phantom:  { hp:113, speed:139, reward:24, leak:2, color:"#8ae8dd", radius:11, armor:0 },
  medic:    { hp:108, speed:79, reward:26, leak:2, color:"#9df6a1", radius:14, armor:0 },
  jammer:   { hp:150, speed:65, reward:28, leak:2, color:"#ff89d4", radius:16, armor:.05 },
  carrier:  { hp:330, speed:52, reward:38, leak:3, color:"#ffc08b", radius:20, armor:.12 },
  boss:     { hp:1120, speed:38, reward:200, leak:7, color:"#ff647c", radius:27, armor:.12, shield:180 }
};

let best = { wave:0, score:0 };
try { best = { ...best, ...(JSON.parse(localStorage.getItem(STORAGE)) || {}) }; } catch (_) {}
let soundOn = true;
try { soundOn = localStorage.getItem(STORAGE+"-muted") !== "true"; } catch (_) {}
let audio = null, lastSound = 0;
let chosenMap = 0, chosenDifficulty = 0;
let state = null;
let entityId = 1;
let lastFrame = 0, ambientTime = 0, toastTimer = null;

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function rand(a,b){ return a+Math.random()*(b-a); }
function distance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function money(n){ return Math.floor(n).toLocaleString("en-US"); }
function cellKey(c,r){ return c+","+r; }
function tileCenter(c,r){ return {x:c*TILE+TILE/2,y:r*TILE+TILE/2}; }

function makePath(mapIndex){
  const tiles = new Set();
  const pts = MAPS[mapIndex].points.map(([c,r])=>tileCenter(c,r));
  for(let i=1;i<MAPS[mapIndex].points.length;i++){
    const [c1,r1]=MAPS[mapIndex].points[i-1], [c2,r2]=MAPS[mapIndex].points[i];
    let c=c1,r=r1;
    while(true){
      if(c>=0&&c<COLS&&r>=0&&r<ROWS)tiles.add(cellKey(c,r));
      if(c===c2&&r===r2)break;
      c+=Math.sign(c2-c);r+=Math.sign(r2-r);
    }
  }
  const lengths=[];
  let total=0;
  for(let i=1;i<pts.length;i++){total+=distance(pts[i-1],pts[i]);lengths.push(total);}
  return {points:pts,lengths,total,tiles};
}
function pointAt(path,d){
  let i=0;
  while(i<path.lengths.length-1 && d>path.lengths[i])i++;
  const start=i===0?0:path.lengths[i-1];
  const a=path.points[i],b=path.points[i+1];
  const f=clamp((d-start)/Math.max(1,distance(a,b)),0,1);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function newState(){
  return {
    mapIndex:chosenMap,difficulty:chosenDifficulty,
    path:makePath(chosenMap),mode:"game",wave:0,waveActive:false,endless:false,
    credits:430,lives:25,maxLives:25,score:0,kills:0,spent:0,combo:0,comboUntil:0,bestCombo:0,perfectWaves:0,waveStartLives:25,creditedDamage:0,
    towers:[],enemies:[],projectiles:[],particles:[],beams:[],floaters:[],
    spawning:[],spawnElapsed:0,spawnIndex:0,time:0,hudElapsed:0,
    paused:false,speed:1,selectedBuild:null,selectedTower:null,hover:null,runSeed:Math.random(),
    targetingStrike:false,overdriveUntil:0,shake:0,
    cooldowns:{overdrive:0,emp:0,strike:0},
    perks:{power:0,rapid:0,range:0,cooldown:0},modal:false
  };
}
function playSound(freq=440,duration=.06,type="sine",gain=.018){
  if(!soundOn)return;
  const now=performance.now();
  if(now-lastSound<22)return;
  lastSound=now;
  try{
    const AudioType=window.AudioContext||window.webkitAudioContext;
    if(!AudioType)return;
    if(!audio)audio=new AudioType();
    if(audio.state==="suspended")audio.resume();
    const o=audio.createOscillator(),g=audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(50,freq*.67),audio.currentTime+duration);
    g.gain.setValueAtTime(gain,audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
    o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.01);
  }catch(_){}
}
function saveBest(){
  if(!state)return;
  if(state.wave>best.wave || (state.wave===best.wave&&state.score>best.score)){
    best.wave=state.wave;best.score=state.score;
    try{localStorage.setItem(STORAGE,JSON.stringify(best));}catch(_){}
  }
  $("menuBest").textContent="WAVE "+best.wave;
  $("menuBestScore").textContent=money(best.score)+" POINTS";
}
function showToast(message,bad=false){
  const el=$("floatingMessage");el.textContent=message;el.classList.toggle("bad",bad);
  el.classList.add("visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),1650);
}
function revealMenu(){
  if(state)saveBest();
  state=null;
  hideModal();
  $("gameScreen").classList.add("hidden");
  $("menuScreen").classList.remove("hidden");
  $("menuBest").textContent="WAVE "+best.wave;
  $("menuBestScore").textContent=money(best.score)+" POINTS";
  window.scrollTo({top:0,behavior:"instant"});
}
function startGame(){
  hideModal();
  state=newState();
  $("menuScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  $("sectorName").textContent=MAPS[state.mapIndex].name;
  $("footerMap").textContent=MAPS[state.mapIndex].name;
  $("canvasHint").classList.remove("faded");
  $("speedButton").textContent="1×";
  $("pauseButton").textContent="Ⅱ";
  $("waveButton").disabled=false;
  renderTowerList();
  updateDetails();
  syncHUD();
  window.scrollTo({top:0,behavior:"instant"});
}
function renderTowerList(){
  $("towerList").innerHTML=TOWERS.map((t,i)=>'<button class="tower-option" type="button" data-id="'+t.id+'" title="Hotkey '+(i+1)+'"><span class="tower-glyph" style="color:'+t.color+'">'+t.symbol+'</span><span class="tower-label"><b>'+t.name+'</b><small>'+t.caption+'</small></span><span class="tower-cost">'+t.cost+' <small>¢</small></span></button>').join("");
  refreshTowerList();
}
function refreshTowerList(){
  if(!state)return;
  $("towerList").querySelectorAll(".tower-option").forEach(b=>{
    const type=TOWER_BY_ID[b.dataset.id];
    b.classList.toggle("selected",state.selectedBuild===type.id);
    b.classList.toggle("unaffordable",state.credits<type.cost);
    b.setAttribute("aria-pressed",String(state.selectedBuild===type.id));
  });
}
function chooseBuild(id){
  if(!state||state.modal)return;
  state.targetingStrike=false;state.selectedTower=null;
  state.selectedBuild=state.selectedBuild===id?null:id;
  refreshTowerList();updateDetails();syncHUD();
  playSound(430,.06,"triangle");
}
function upgradeCost(t){
  if(t.level>=4)return 0;
  return Math.round(TOWER_BY_ID[t.id].cost*(.65+t.level*.4)/5)*5;
}

const AUGMENTS={
  pulse:[
    {id:"focus",name:"TARGET LOCK",desc:"Consecutive hits on the same enemy ramp up damage."},
    {id:"ricochet",name:"RICOCHET",desc:"Every hit arcs to a nearby second enemy."}
  ],
  rail:[
    {id:"breaker",name:"TITAN BREAKER",desc:"Deal 75% more damage to bosses and armored units."},
    {id:"piercer",name:"HYPER RAIL",desc:"Pierce 4 extra enemies and extend range."}
  ],
  cryo:[
    {id:"deepfreeze",name:"ABSOLUTE ZERO",desc:"Stronger slows that nearly stop enemies."},
    {id:"brittle",name:"SHATTER POINT",desc:"Frozen enemies take 30% more damage from allies."}
  ],
  mortar:[
    {id:"wildfire",name:"NAPALM ROUND",desc:"Explosions leave a damaging burn on everything hit."},
    {id:"cluster",name:"CLUSTER BOMB",desc:"Much larger explosions, great against swarms."}
  ],
  tesla:[
    {id:"overload",name:"OVERCHARGE",desc:"50% bonus damage to shields and bosses."},
    {id:"fork",name:"CHAIN REACTION",desc:"Lightning chains to four additional enemies."}
  ],
  mint:[
    {id:"compound",name:"COMPOUND YIELD",desc:"Produces 65% more credits per wave."},
    {id:"relay",name:"TACTICAL RELAY",desc:"Nearby towers fire 18% faster."}
  ]
};
function towerStats(t){
  const def=TOWER_BY_ID[t.id],lv=t.level-1;
  const relay=state.towers.some(other=>other!==t&&other.id==="mint"&&other.specialization==="relay"&&distance(other,t)<140);
  const pad=padAt(t.c,t.r);
  return {
    damage:Math.round(def.damage*(1+.42*lv+.1*lv*lv)*(1+.12*state.perks.power)*(t.specialization==="breaker"?1.25:1)*(pad?.type==="damage"?1.22:1)),
    range:(def.range+12*lv)*(1+.08*state.perks.range)*(t.specialization==="piercer"?1.22:1)*(pad?.type==="range"?1.22:1),
    interval:def.interval*(1-.105*lv)/(1+.1*state.perks.rapid)/(relay?1.18:1)/(pad?.type==="speed"?1.18:1),
    income:Math.round((24+lv*18)*(1+.08*state.perks.power)*(t.specialization==="compound"?1.65:1))
  };
}
function updateDetails(){
  const el=$("towerDetails");
  if(!state || !state.selectedTower || !state.towers.includes(state.selectedTower)){
    el.innerHTML='<div class="details-empty"><span class="details-empty-icon">◎</span><b>NO TOWER SELECTED</b><p>Tap a deployed tower to upgrade it, change its target priority, or sell it.</p></div>';
    return;
  }
  const t=state.selectedTower,def=TOWER_BY_ID[t.id],stats=towerStats(t);
  const cost=upgradeCost(t),max=t.level>=4;
  const dmg=t.id==="mint"?"—":stats.damage;
  const range=t.id==="mint"?"—":Math.round(stats.range);
  const rate=t.id==="mint"?"—":(1/stats.interval).toFixed(1)+"/s";
  const choices=t.level===2?AUGMENTS[t.id]:null;
  const spec=t.specialization?AUGMENTS[t.id].find(a=>a.id===t.specialization):null;
  const pad=padAt(t.c,t.r);
  const padHTML=pad?'<div class="spec-active" style="color:'+PAD_TYPES[pad.type].color+';border-color:'+PAD_TYPES[pad.type].color+'65">◈ '+PAD_TYPES[pad.type].name+' · '+PAD_TYPES[pad.type].bonus+'</div>':'';
  const specialHTML=choices?'<div class="spec-heading">CHOOSE A TECH BRANCH · '+cost+'¢</div><div class="spec-grid">'+choices.map(a=>'<button data-action="specialize" data-spec="'+a.id+'" '+(state.credits<cost?'disabled':'')+'><b>'+a.name+'</b><small>'+a.desc+'</small></button>').join("")+'</div>':(spec?'<div class="spec-active">✦ '+spec.name+' ACTIVE</div>':'');
  const info=t.id==="mint" ? "Produces "+stats.income+" credits at the end of every completed wave." :
    t.id==="cryo"?"Shots slow enemies by 45% for 1.8 seconds.":
    t.id==="rail"?"Beams pierce multiple targets in a straight line.":
    t.id==="mortar"?"Explosions damage every enemy in the blast radius.":
    t.id==="tesla"?"Lightning chains through nearby enemies.":
    "A dependable rapid-fire defense turret.";
  el.innerHTML='<div class="detail-top"><div><h3 style="color:'+def.color+'">'+def.name+'</h3><span>GRID '+String(t.c+1).padStart(2,"0")+' / '+String(t.r+1).padStart(2,"0")+'</span></div><span class="level-badge">LVL '+t.level+' / 4</span></div>'+
    '<div class="detail-stats"><div class="detail-stat"><span>Damage</span><b>'+dmg+'</b></div><div class="detail-stat"><span>Range</span><b>'+range+'</b></div><div class="detail-stat"><span>Fire rate</span><b>'+rate+'</b></div><div class="detail-stat"><span>Total spent</span><b>'+t.spent+'¢</b></div></div>'+
    '<div class="detail-actions"><button class="upgrade-button" data-action="upgrade" '+(max||!!choices||state.credits<cost?"disabled":"")+'>'+(max?"MAX LEVEL":choices?"PICK A BRANCH ↓":"↑ UPGRADE "+cost+"¢")+'</button><button data-action="target" '+(t.id==="mint"?"disabled":"")+'>TARGET: '+t.priority.toUpperCase()+'</button></div>'+
    padHTML+specialHTML+'<div class="detail-actions"><button class="sell-button" data-action="sell">SELL +'+Math.floor(t.spent*.7)+'¢</button></div>'+
    '<div class="detail-note">'+info+'</div>';
}
function upgradeSelected(){
  const t=state?.selectedTower;
  if(!t||t.level>=4)return;
  const cost=upgradeCost(t);
  if(state.credits<cost){showToast("NOT ENOUGH CREDITS",true);return;}
  state.credits-=cost;t.spent+=cost;t.level++;
  spawnBurst(t.x,t.y,TOWER_BY_ID[t.id].color,22,130);
  playSound(780,.18,"triangle",.03);
  showToast("TOWER UPGRADED TO LVL "+t.level);
  syncHUD();updateDetails();
}

function specializeSelected(spec){
  const t=state?.selectedTower;
  if(!t||t.level!==2||!AUGMENTS[t.id].some(a=>a.id===spec))return;
  const cost=upgradeCost(t);
  if(state.credits<cost){showToast("NOT ENOUGH CREDITS",true);return;}
  state.credits-=cost;t.spent+=cost;t.level=3;t.specialization=spec;
  spawnBurst(t.x,t.y,TOWER_BY_ID[t.id].color,38,190);
  playSound(1000,.25,"sawtooth",.035);
  showToast("✦ NEW TECH UNLOCKED");
  syncHUD();updateDetails();
}
function sellSelected(){
  const t=state?.selectedTower;
  if(!t)return;
  state.credits+=Math.floor(t.spent*.7);
  spawnBurst(t.x,t.y,"#d6fa70",16,120);
  state.towers.splice(state.towers.indexOf(t),1);
  state.selectedTower=null;
  playSound(260,.12,"sawtooth");
  syncHUD();updateDetails();
}
function placeTower(c,r){
  const id=state.selectedBuild;
  if(!id)return false;
  if(c<0||r<0||c>=COLS||r>=ROWS)return false;
  if(state.path.tiles.has(cellKey(c,r))||state.towers.some(t=>t.c===c&&t.r===r)){showToast("TILE OCCUPIED",true);playSound(160,.08);return false;}
  const def=TOWER_BY_ID[id];
  if(state.credits<def.cost){showToast("NOT ENOUGH CREDITS",true);playSound(160,.08);return false;}
  if(id==="mint"&&state.towers.filter(t=>t.id==="mint").length>=5){showToast("MINE LIMIT: 5",true);return false;}
  const pos=tileCenter(c,r);
  const t={id,c,r,x:pos.x,y:pos.y,level:1,spent:def.cost,cooldown:rand(0,.12),angle:-Math.PI/2,priority:"first",flash:0,specialization:null,jammedUntil:0,kills:0};
  state.towers.push(t);state.credits-=def.cost;state.spent+=def.cost;
  state.selectedTower=t;state.selectedBuild=null;
  spawnBurst(t.x,t.y,def.color,12,85);
  if(padAt(c,r)){spawnBurst(t.x,t.y,PAD_TYPES[padAt(c,r).type].color,26,140);showToast("◈ POWER PAD ACTIVATED");}
  playSound(570,.09,"square",.025);
  $("canvasHint").classList.add("faded");
  syncHUD();updateDetails();return true;
}
function syncHUD(){
  if(!state)return;
  $("creditsValue").textContent=money(state.credits);
  $("livesValue").innerHTML=Math.max(0,state.lives)+' <span class="stat-suffix">HP</span>';
  $("livesValue").style.color=state.lives<=8?"#ff7185":"";
  $("waveValue").innerHTML=state.wave+' <span class="stat-suffix">/ '+(state.endless?"∞":MAX_WAVE)+'</span>';
  $("scoreValue").textContent=money(state.score);
  const planned=state.spawning.length;
  const left=state.enemies.length+planned-state.spawnIndex;
  const complete=state.waveActive?clamp(1-left/Math.max(1,planned),0,1):0;
  $("waveMeterFill").style.width=(complete*100).toFixed(1)+"%";
  $("intelLabel").innerHTML=(state.waveActive?"CURRENT THREAT ":"NEXT THREAT ")+"<b>"+waveTitle(state.wave+(state.waveActive?0:1))+"</b>";
  $("intelCounts").textContent=state.waveActive?left+" HOSTILES REMAIN":"WAVE "+String(state.wave+1).padStart(2,"0")+" / READY";
  $("enemyIntel").textContent=waveDescription(state.wave+(state.waveActive?0:1));
  $("comboIntel").textContent=state.combo>=3?"✦ CHAIN ×"+state.combo:"★ "+state.perfectWaves+" PERFECT WAVES";
  $("comboIntel").classList.toggle("heated",state.combo>=5);
  const titan=state.enemies.find(e=>e.type==="boss"&&!e.dead);
  $("bossBar").classList.toggle("hidden",!titan);
  if(titan){
    $("bossHealthText").textContent=Math.ceil(100*clamp(titan.hp/titan.maxHp,0,1))+"%";
    $("bossHealthFill").style.width=(100*clamp(titan.hp/titan.maxHp,0,1)).toFixed(1)+"%";
  }
  $("battleStatus").textContent=state.paused?"SYSTEM PAUSED":state.waveActive?"HOSTILES INBOUND":"AWAITING DEPLOYMENT";
  $("battleIndicator").textContent=state.waveActive?"THREATS: "+(state.enemies.length+(state.spawning.length-state.spawnIndex)):"THREAT: "+(state.wave>=10?"HIGH":"LOW");
  $("waveProgress").textContent=state.waveActive?"ENEMIES REMAINING: "+(state.enemies.length+(state.spawning.length-state.spawnIndex)):"NEXT WAVE: "+String(state.wave+1).padStart(2,"0");
  $("waveTag").textContent=state.waveActive?"NOW DEFENDING / WAVE "+String(state.wave).padStart(2,"0"):"NEXT UP / WAVE "+String(state.wave+1).padStart(2,"0");
  $("waveDescription").textContent=state.waveActive?"Hold the line. Don't let them through.":waveDescription(state.wave+1);
  $("waveButton").disabled=state.waveActive||state.modal||state.paused;
  $("waveButton").textContent=state.waveActive?"◉ WAVE IN PROGRESS":"▶ START WAVE "+String(state.wave+1).padStart(2,"0");
  const buttons=[
    ["abilityOverdrive","overdrive","cdOverdrive"],
    ["abilityEmp","emp","cdEmp"],
    ["abilityStrike","strike","cdStrike"]
  ];
  buttons.forEach(([button,key,label])=>{
    const remaining=Math.ceil(Math.max(0,state.cooldowns[key]-state.time));
    $(button).disabled=remaining>0||!state.waveActive||state.paused||state.modal;
    $(label).textContent=remaining>0?remaining+"s":"READY";
  });
  $("abilityStrike").classList.toggle("selected",state.targetingStrike);
  refreshTowerList();
}

const WAVE_TITLES=["FIRST CONTACT","RAPID RESPONSE","THE SWARM","HEAVY METAL","THE FIRST TITAN",
  "SHIELDS UP","BORDER RUNNERS","DIVIDE & CONQUER","MEDICAL CORPS","TITAN RELOADED",
  "GHOSTS IN THE WIRE","STATIC STORM","FORTRESS BREAKERS","REINFORCEMENTS","SIEGE ENGINE",
  "TOTAL BLACKOUT","BLITZKRIEG","NO MAN'S LAND","THE LAST STAND","FINAL PROTOCOL"];
function waveTitle(w){return WAVE_TITLES[(w-1)%20] + (w>20?" / "+Math.ceil(w/20):"");}
function waveDescription(w){
  if(w%5===0)return "⚠ TITAN CLASS · Boss encounter";
  if(w>=16)return "Elite jammers and carrier convoys";
  if(w>=12)return "Electronic warfare units incoming";
  if(w>=9)return "Support medics behind the front";
  if(w>=8)return "Splitters and heavy assault";
  if(w>=6)return "Shielded enemy formation";
  if(w>=4)return "Heavy armor spotted on radar";
  if(w>=3)return "Quick-moving assault units incoming";
  return "Scout drones approaching";
}
function seededWaveRandom(w,i){
  const x=Math.sin(w*124.739+i*71.332+state.mapIndex*88.1+state.difficulty*9.7)*43758.5453;
  return x-Math.floor(x);
}
function wavePlan(w){
  const plan=[],count=Math.floor(9+w*2.3),interval=Math.max(.28,.78-w*.017);
  const groups=["drone"];
  if(w>=3)groups.push("runner","runner");
  if(w>=4)groups.push("brute");
  if(w>=6)groups.push("shield");
  if(w>=8)groups.push("splitter");
  if(w>=9)groups.push("medic");
  if(w>=11)groups.push("phantom");
  if(w>=12)groups.push("jammer");
  if(w>=15)groups.push("carrier");
  const signature=w%5===0?"brute":w%4===0?"runner":w%3===0?"shield":"drone";
  for(let i=0;i<count;i++){
    let type=groups[Math.floor(seededWaveRandom(w,i)*groups.length)];
    if(i%9===0)type=signature;
    if(w>=9&&i%16===8)type="medic";
    if(w>=12&&i%17===3)type="jammer";
    if(w>=15&&i%19===5)type="carrier";
    plan.push({type,time:i*interval});
  }
  if(w%5===0)plan.push({type:"boss",time:count*interval+1});
  return plan;
}
function startWave(){
  if(!state||state.waveActive||state.modal||state.paused)return;
  state.wave++;
  state.waveStartLives=state.lives;
  state.combo=0;
  state.spawning=wavePlan(state.wave);
  state.spawnElapsed=0;state.spawnIndex=0;state.waveActive=true;
  state.selectedBuild=null;state.targetingStrike=false;
  state.enemies=state.enemies.filter(e=>!e.dead);
  playSound(380,.22,"sawtooth",.035);
  showToast(state.wave%5===0?"⚠ BOSS WAVE "+state.wave:"WAVE "+state.wave+" INCOMING");
  syncHUD();
}
function spawnEnemy(type,atDist=-30){
  const def=ENEMIES[type];
  const hpScale=1+Math.pow(Math.max(0,state.wave-1),1.15)*.105;
  const diff=[1,1.28,1.58][state.difficulty];
  const bossScale=type==="boss"?1+Math.max(0,state.wave-5)*.15:1;
  const hp=Math.round(def.hp*hpScale*diff*bossScale);
  const d=atDist,point=pointAt(state.path,d);
  state.enemies.push({
    id:entityId++,type,x:point.x,y:point.y,dist:d,hp,maxHp:hp,
    shield:Math.round((def.shield||0)*hpScale*diff),
    maxShield:Math.round((def.shield||0)*hpScale*diff),
    speed:def.speed*(1+Math.min(.24,state.wave*.009))*(state.difficulty===2?1.06:1),
    reward:def.reward,leak:def.leak,armor:def.armor||0,r:def.radius,
    dead:false,slowUntil:0,slowFactor:1,stunUntil:0,hitFlash:0,phase:rand(0,TAU),burnUntil:0,burnDps:0,brittleUntil:0,healClock:0,jamClock:0,bossClock:0,bossPhase:0
  });
}
function spawnBurst(x,y,color,count=10,power=110){
  if(!state)return;
  for(let i=0;i<count;i++){
    const a=rand(0,TAU),speed=rand(power*.2,power);
    state.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:rand(.25,.65),maxLife:.65,r:rand(1.4,4),color});
  }
  if(state.particles.length>480)state.particles.splice(0,state.particles.length-480);
}
function floatingDamage(x,y,value,color="#d9ecff"){
  if(!state||state.floaters.length>50)return;
  state.floaters.push({x:x+rand(-8,8),y:y-13,text:String(Math.round(value)),color,life:.7});
}

function damageEnemy(e,damage,source=null){
  if(!e||e.dead)return;
  let multiplier=1;
  if(e.brittleUntil>state.time && source!=="cryo")multiplier=1.3;
  if(e.type==="boss"&&e.hp<e.maxHp*.35)multiplier*=.88;
  const armor=source==="rail"?e.armor*.25:e.armor;
  const actual=Math.max(1,Math.round(damage*multiplier*(1-armor)));
  let left=actual;
  if(e.shield>0){const absorbed=Math.min(e.shield,left);e.shield-=absorbed;left-=absorbed;}
  e.hp-=left;e.hitFlash=.09;
  state.creditedDamage+=actual;
  if(Math.random()<.28)floatingDamage(e.x,e.y,actual,e.shield>0?"#8be0ff":multiplier>1?"#d6fa70":"#dfefff");
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;
  e.dead=true;
  const chain=state.time<state.comboUntil;
  state.combo=chain?Math.min(99,state.combo+1):1;
  state.comboUntil=state.time+2.7;
  state.bestCombo=Math.max(state.bestCombo,state.combo);
  state.credits+=e.reward;
  const mult=1+Math.min(4,Math.floor(state.combo/5)*.5);
  state.score+=Math.round(e.reward*10*mult);state.kills++;
  if(state.combo===5||state.combo===10||state.combo===20||state.combo===35){
    showToast(state.combo+"× KILL CHAIN  ·  SCORE BOOST!");
    playSound(980,.13,"triangle",.03);
  }
  spawnBurst(e.x,e.y,ENEMIES[e.type].color,e.type==="boss"?60:12,e.type==="boss"?255:115);
  if(e.type==="boss"){
    state.shake=19;playSound(110,.4,"sawtooth",.07);
    showToast("TITAN DOWN! +"+e.reward+"¢");
  }else if(e.type==="brute")playSound(170,.07,"triangle",.02);
  if(e.type==="splitter"||e.type==="carrier"){
    const amount=e.type==="carrier"?5:2,type=e.type==="carrier"?"runner":"mini";
    for(let i=0;i<amount;i++)spawnEnemy(type,e.dist-rand(3,45));
  }
}
function enemyLeak(e){
  e.dead=true;state.combo=0;state.lives-=e.leak;state.shake=Math.min(20,state.shake+8);
  spawnBurst(785,e.y,"#ff697f",22,140);
  playSound(115,.2,"sawtooth",.05);
  if(state.lives<=0){state.lives=0;finishGame(false);}
}
function updateEnemyAbilities(e,dt){
  if(e.burnUntil>state.time&&e.burnDps>0){
    e.burnTick=(e.burnTick||0)+dt;
    if(e.burnTick>.24){damageEnemy(e,e.burnDps*e.burnTick,"burn");e.burnTick=0;}
  }
  if(e.dead)return;
  if(e.type==="medic"){
    e.healClock+=dt;
    if(e.healClock>1.6){
      e.healClock=0;
      const squad=state.enemies.filter(other=>!other.dead&&other!==e&&distance(e,other)<115&&other.hp<other.maxHp);
      squad.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
      for(const ally of squad.slice(0,3)){
        ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.17);
        beamLine(e.x,e.y,ally.x,ally.y,"#9cf9a4",2,.24);
        spawnBurst(ally.x,ally.y,"#a1ffb0",4,45);
      }
    }
  }
  if(e.type==="jammer"){
    e.jamClock+=dt;
    if(e.jamClock>3.6){
      e.jamClock=0;
      const around=state.towers.filter(t=>t.id!=="mint"&&distance(t,e)<155);
      for(const t of around){
        t.jammedUntil=Math.max(t.jammedUntil,state.time+1.45);
        beamLine(e.x,e.y,t.x,t.y,"#ff93d9",1.5,.2);
      }
      if(around.length)spawnBurst(e.x,e.y,"#ff80d2",12,80);
    }
  }
  if(e.type==="boss"){
    e.bossClock+=dt;
    if(e.bossClock>8.5){
      e.bossClock=0;state.shake=12;
      state.enemies.forEach(other=>{if(!other.dead&&other!==e&&distance(e,other)<130)other.shield=Math.min(other.shield+Math.round(other.maxHp*.22),other.maxHp*.55);});
      for(let i=0;i<3+Math.min(4,Math.floor(state.wave/10));i++)spawnEnemy(i%2?"runner":"drone",e.dist-rand(30,110));
      spawnBurst(e.x,e.y,"#ff738a",36,170);
      showToast("⚠ TITAN DEPLOYED REINFORCEMENTS");
      playSound(135,.3,"sawtooth",.05);
    }
    if(e.bossPhase===0&&e.hp<e.maxHp*.5){
      e.bossPhase=1;e.shield+=Math.round(e.maxHp*.28);e.maxShield=Math.max(e.maxShield,e.shield);
      e.speed*=1.35;state.shake=15;
      spawnBurst(e.x,e.y,"#ffcf81",48,210);
      showToast("⚠ TITAN ENRAGED · SHIELD RESTORED");
    }
  }
}

function findTarget(t,range){
  const options=state.enemies.filter(e=>!e.dead&&distance(t,e)<=range);
  if(!options.length)return null;
  options.sort((a,b)=>t.priority==="strong"?b.hp+b.shield-(a.hp+a.shield):t.priority==="last"?a.dist-b.dist:b.dist-a.dist);
  return options[0];
}
function beamLine(x1,y1,x2,y2,color,thickness=3,life=.12){
  state.beams.push({x1,y1,x2,y2,color,thickness,life,maxLife:life});
}
function fireTower(t,target,stats){
  const def=TOWER_BY_ID[t.id];
  t.angle=Math.atan2(target.y-t.y,target.x-t.x);t.flash=.13;
  if(t.id==="pulse"&&t.specialization==="focus"){
    t.focusCount=t.focusTarget===target.id?Math.min(8,(t.focusCount||0)+1):0;
    t.focusTarget=target.id;
  }
  if(t.id==="rail"){
    const vx=Math.cos(t.angle),vy=Math.sin(t.angle);
    const endX=t.x+vx*stats.range,endY=t.y+vy*stats.range;
    beamLine(t.x,t.y,endX,endY,def.color,5,.2);
    let hits=0;
    const candidates=state.enemies.filter(e=>!e.dead).map(e=>{
      const dx=e.x-t.x,dy=e.y-t.y;
      return {e,proj:dx*vx+dy*vy,dist:Math.abs(dx*vy-dy*vx)};
    }).filter(v=>v.proj>0&&v.proj<stats.range&&v.dist<v.e.r+9).sort((a,b)=>a.proj-b.proj);
    for(const c of candidates){
      if(hits>=3+t.level+(t.specialization==="piercer"?4:0))break;
      damageEnemy(c.e,stats.damage*(t.specialization==="breaker"&&(c.e.type==="boss"||c.e.armor>.09)?1.75:1),"rail");hits++;
    }
    spawnBurst(t.x+vx*28,t.y+vy*28,def.color,5,65);
    playSound(280,.13,"sawtooth",.025);
  } else if(t.id==="tesla"){
    let current=target,from={x:t.x,y:t.y},hits=new Set();
    for(let i=0;i<3+t.level+(t.specialization==="fork"?4:0);i++){
      if(!current)break;
      beamLine(from.x,from.y,current.x,current.y,def.color,3.5,.18);
      damageEnemy(current,stats.damage*Math.pow(.84,i)*(t.specialization==="overload"&&(current.shield>0||current.type==="boss")?1.5:1),"tesla");
      hits.add(current);from={x:current.x,y:current.y};
      current=state.enemies.filter(e=>!e.dead&&!hits.has(e)&&distance(e,from)<112)
        .sort((a,b)=>distance(a,from)-distance(b,from))[0]||null;
    }
    playSound(660,.075,"sawtooth",.018);
  } else {
    const aoe=t.id==="mortar"?(65+t.level*7)*(t.specialization==="cluster"?1.55:1):0;
    const p={
      x:t.x,y:t.y,target,tx:target.x,ty:target.y,
      damage:stats.damage,speed:t.id==="mortar"?270:570,
      color:def.color,r:t.id==="mortar"?7:4,
      aoe,slow:t.id==="cryo"?(t.specialization==="deepfreeze"?.2:.46):0,type:t.id,spec:t.specialization,focus:t.focusCount||0
    };
    if(t.id==="mortar"){
      p.tx=target.x+rand(-12,12);p.ty=target.y+rand(-12,12);
    }
    state.projectiles.push(p);
    if(t.id==="mortar")playSound(140,.07,"triangle",.024);
    else if(t.id==="cryo")playSound(720,.035,"sine",.012);
    else playSound(480,.035,"triangle",.009);
  }
}
function projectileImpact(p,e){
  if(p.aoe){
    state.beams.push({x1:p.tx,y1:p.ty,x2:p.tx,y2:p.ty,color:"#ffd080",thickness:p.aoe,life:.28,maxLife:.28,blast:true});
    spawnBurst(p.tx,p.ty,p.color,22,160);
    state.enemies.forEach(enemy=>{
      if(enemy.dead)return;
      const d=Math.hypot(enemy.x-p.tx,enemy.y-p.ty);
      if(d<p.aoe+enemy.r){
        damageEnemy(enemy,p.damage*(1-.35*Math.min(1,d/p.aoe)),"mortar");
        if(!enemy.dead&&p.spec==="wildfire"){enemy.burnUntil=state.time+3.8;enemy.burnDps=Math.max(enemy.burnDps,p.damage*.26);}
      }
    });
    playSound(175,.16,"sawtooth",.035);
  }else if(e&&!e.dead){
    damageEnemy(e,p.damage*(p.spec==="focus"?1+Math.min(1.6,p.focus*.2):1),p.type);
    if(p.spec==="ricochet"){
      const other=state.enemies.find(t=>!t.dead&&t!==e&&distance(e,t)<110);
      if(other){beamLine(e.x,e.y,other.x,other.y,p.color,1.5,.14);damageEnemy(other,p.damage*.75,"pulse");}
    }
    if(!e.dead&&p.slow){e.slowUntil=state.time+1.8;e.slowFactor=Math.min(e.slowFactor,p.slow);if(p.spec==="brittle")e.brittleUntil=state.time+2.5;}
    spawnBurst(p.x,p.y,p.color,3,40);
  }
}
function updateCombat(dt){
  for(const t of state.towers){
    t.flash=Math.max(0,t.flash-dt);
    if(t.id==="mint")continue;
    if(state.time<t.jammedUntil)continue;
    const stats=towerStats(t);
    const speedFactor=state.time<state.overdriveUntil?2:1;
    t.cooldown-=dt;
    if(t.cooldown>0)continue;
    const target=findTarget(t,stats.range);
    if(target){fireTower(t,target,stats);t.cooldown+=stats.interval/speedFactor;}
    else t.cooldown=0;
  }
  for(const p of state.projectiles){
    const dest=p.type==="mortar"?{x:p.tx,y:p.ty}:p.target&&!p.target.dead?p.target:{x:p.tx,y:p.ty};
    const dx=dest.x-p.x,dy=dest.y-p.y,len=Math.hypot(dx,dy);
    const step=p.speed*dt;
    if(len<=step+5){
      p.x=dest.x;p.y=dest.y;p.done=true;
      projectileImpact(p,p.type==="mortar"?null:p.target);
    }else{p.x+=dx/len*step;p.y+=dy/len*step;}
  }
  state.projectiles=state.projectiles.filter(p=>!p.done);
}
function updateEffects(dt){
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.max(0,1-dt*2.1);p.vy*=Math.max(0,1-dt*2.1);p.life-=dt;}
  state.particles=state.particles.filter(p=>p.life>0);
  for(const b of state.beams)b.life-=dt;
  state.beams=state.beams.filter(b=>b.life>0);
  for(const f of state.floaters){f.y-=28*dt;f.life-=dt;}
  state.floaters=state.floaters.filter(f=>f.life>0);
  state.shake=Math.max(0,state.shake-34*dt);
}
function update(dt){
  if(!state||state.paused||state.modal)return;
  state.time+=dt;
  if(state.combo>0&&state.time>state.comboUntil)state.combo=0;
  if(state.waveActive){
    state.spawnElapsed+=dt;
    while(state.spawnIndex<state.spawning.length && state.spawning[state.spawnIndex].time<=state.spawnElapsed){
      spawnEnemy(state.spawning[state.spawnIndex++].type);
    }
    for(const e of state.enemies){
      if(e.dead)continue;
      e.hitFlash=Math.max(0,e.hitFlash-dt);
      updateEnemyAbilities(e,dt);
      if(e.dead)continue;
      if(state.time<e.stunUntil)continue;
      const slow=state.time<e.slowUntil?e.slowFactor:1;
      if(state.time>=e.slowUntil)e.slowFactor=1;
      e.dist+=e.speed*slow*dt;
      const pos=pointAt(state.path,e.dist);e.x=pos.x;e.y=pos.y;
      if(e.dist>=state.path.total-18)enemyLeak(e);
    }
    state.enemies=state.enemies.filter(e=>!e.dead);
    if(state.mode!=="game")return;
    updateCombat(dt);
    if(state.spawnIndex>=state.spawning.length&&state.enemies.length===0)completeWave();
  }
  updateEffects(dt);
  state.hudElapsed+=dt;
  if(state.hudElapsed>.14){state.hudElapsed=0;syncHUD();if(state.selectedTower)updateDetails();}
}
function completeWave(){
  state.waveActive=false;state.projectiles=[];
  const base=Math.round(45+state.wave*9);
  const passive=state.towers.filter(t=>t.id==="mint").reduce((sum,t)=>sum+towerStats(t).income,0);
  const perfect=state.lives===state.waveStartLives;
  const perfectBonus=perfect?35+state.wave*6:0;
  if(perfect){state.perfectWaves++;state.score+=(200+state.wave*40);}
  state.credits+=base+passive+perfectBonus;state.score+=(base+passive)*2;
  playSound(870,.22,"triangle",.035);
  showToast((perfect?"★ PERFECT DEFENSE ":"WAVE CLEARED ")+" +"+money(base+passive+perfectBonus)+"¢");
  saveBest();
  syncHUD();updateDetails();
  if(state.wave===MAX_WAVE&&!state.endless){showEndModal(true);return;}
  if(state.wave%5===0){showPerkModal();return;}
}
function finishGame(won){
  if(!state||state.mode!=="game")return;
  state.waveActive=false;state.mode=won?"won":"lost";
  saveBest();
  syncHUD();
  showEndModal(won);
}
const PERKS = [
  {id:"power",icon:"⚔",name:"HEAVY HITTERS",desc:"All towers deal 12% more damage."},
  {id:"rapid",icon:"ϟ",name:"QUICK TRIGGER",desc:"All towers fire 10% faster."},
  {id:"range",icon:"◎",name:"LONG REACH",desc:"All towers gain 8% more range."},
  {id:"credits",icon:"◆",name:"CASH INJECTION",desc:"Immediately gain 225 credits."},
  {id:"heal",icon:"♥",name:"EMERGENCY PATCH",desc:"Restore 8 reactor HP."},
  {id:"cooldown",icon:"✦",name:"BATTLE NETWORK",desc:"Tactical abilities recharge 15% faster."}
];
function showPerkModal(){
  state.modal=true;state.targetingStrike=false;
  const pool=[...PERKS].sort(()=>Math.random()-.5).slice(0,3);
  $("modalRoot").innerHTML='<div class="modal-panel"><div class="modal-eyebrow">◈ RESEARCH AVAILABLE / WAVE '+state.wave+' COMPLETE</div><h2>CHOOSE AN<br><span style="color:var(--lime)">ADVANTAGE.</span></h2><p class="modal-copy">Command has authorized one system upgrade. Choose wisely. The invasion is only getting worse.</p><div class="perk-grid">'+pool.map(p=>'<button type="button" class="perk-card" data-perk="'+p.id+'"><span class="perk-card-icon">'+p.icon+'</span><b>'+p.name+'</b><small>'+p.desc+'</small><span>CHOOSE UPGRADE ↗</span></button>').join("")+'</div></div>';
  $("modalRoot").classList.remove("hidden");
  $("modalRoot").querySelectorAll(".perk-card").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.perk;
    if(id==="credits")state.credits+=225;
    else if(id==="heal")state.lives=Math.min(state.maxLives,state.lives+8);
    else state.perks[id]++;
    playSound(980,.22,"triangle",.035);
    hideModal();syncHUD();updateDetails();
    showToast("RESEARCH UNLOCKED");
  }));
}
function showEndModal(won){
  if(!state)return;
  state.modal=true;state.targetingStrike=false;
  const victory=won&&state.mode!=="lost";
  $("modalRoot").innerHTML='<div class="modal-panel"><div class="modal-eyebrow">'+(victory?"◈ MISSION COMPLETE / THE CORE SURVIVES":"⚠ SIGNAL LOST / REACTOR DESTROYED")+'</div><h2>'+(victory?'YOU ACTUALLY<br><span style="color:var(--lime)">WON.</span>':'GAME<br><span style="color:var(--red)">OVER.</span>')+'</h2><p class="modal-copy">'+(victory?"Against all odds, your reactor survived 20 waves. But the galaxy has more enemies. A lot more.":"The enemy breached the reactor. Your questionable tactical decisions will be remembered. Want another shot?")+'</p><div class="modal-stats"><div class="modal-stat"><strong>'+state.wave+'</strong><small>WAVES REACHED</small></div><div class="modal-stat"><strong>'+money(state.score)+'</strong><small>FINAL SCORE</small></div><div class="modal-stat"><strong>'+money(state.kills)+'</strong><small>ENEMIES SCRAPPED</small></div></div><div class="modal-actions"><button id="modalRestart" type="button" class="btn btn-primary">↻ PLAY AGAIN</button>'+(victory?'<button id="modalEndless" type="button" class="btn btn-secondary">∞ KEEP GOING</button>':'')+'<button id="modalMenu" type="button" class="btn btn-secondary">⌂ MAIN MENU</button></div>'+(victory?'<p class="modal-warning">ENDLESS MODE: WAVES KEEP SCALING UNTIL THE REACTOR FALLS.</p>':'')+'</div>';
  $("modalRoot").classList.remove("hidden");
  $("modalRestart").addEventListener("click",startGame);
  $("modalMenu").addEventListener("click",revealMenu);
  if(victory)$("modalEndless").addEventListener("click",()=>{state.endless=true;state.mode="game";hideModal();showPerkModal();});
}
function hideModal(){
  $("modalRoot").classList.add("hidden");$("modalRoot").innerHTML="";
  if(state)state.modal=false;
}
function showQuitModal(){
  if(!state||state.modal)return;
  state.modal=true;
  $("modalRoot").innerHTML='<div class="modal-panel"><div class="modal-eyebrow">⚠ ABANDON BATTLE?</div><h2>LEAVING<br><span style="color:var(--red)">ALREADY?</span></h2><p class="modal-copy">Your current run will be lost. No one will judge you. Probably.</p><div class="modal-actions"><button id="continueGame" class="btn btn-primary" type="button">KEEP FIGHTING</button><button id="exitGame" class="btn btn-secondary" type="button">QUIT TO MENU</button></div></div>';
  $("modalRoot").classList.remove("hidden");
  $("continueGame").addEventListener("click",hideModal);
  $("exitGame").addEventListener("click",revealMenu);
}
const ABILITY_CD={overdrive:43,emp:48,strike:56};
function useAbility(id){
  if(!state||state.modal||state.paused||!state.waveActive)return;
  if(state.cooldowns[id]>state.time){showToast("ABILITY RECHARGING",true);return;}
  if(id==="strike"){
    state.targetingStrike=!state.targetingStrike;
    state.selectedBuild=null;state.selectedTower=null;
    refreshTowerList();updateDetails();syncHUD();
    if(state.targetingStrike)showToast("TAP A TARGET FOR ORBITAL STRIKE");
    return;
  }
  state.cooldowns[id]=state.time+ABILITY_CD[id]*Math.pow(.85,state.perks.cooldown);
  if(id==="overdrive"){
    state.overdriveUntil=state.time+8;
    showToast("⚡ OVERDRIVE ENGAGED");
    spawnBurst(400,250,"#ffc576",60,250);playSound(640,.28,"sawtooth",.04);
  }
  if(id==="emp"){
    state.enemies.forEach(e=>{e.stunUntil=Math.max(e.stunUntil,state.time+3);});
    showToast("❄ EMP BLAST / ENEMIES FROZEN");
    state.beams.push({emp:true,life:.6,maxLife:.6,color:"#7ae6ff"});
    playSound(220,.3,"triangle",.05);
  }
  syncHUD();
}
function orbitalStrike(x,y){
  state.cooldowns.strike=state.time+ABILITY_CD.strike*Math.pow(.85,state.perks.cooldown);
  state.targetingStrike=false;
  const blast=120;
  const damage=390+state.wave*20;
  state.enemies.forEach(e=>{
    if(e.dead)return;
    const d=Math.hypot(e.x-x,e.y-y);
    if(d<blast+e.r)damageEnemy(e,damage*(1-.42*Math.min(1,d/blast)));
  });
  state.beams.push({blast:true,x1:x,y1:y,x2:x,y2:y,thickness:blast,color:"#d6fa70",life:.58,maxLife:.58});
  spawnBurst(x,y,"#e2ff9a",65,330);
  state.shake=23;
  playSound(90,.38,"sawtooth",.09);
  showToast("✦ ORBITAL STRIKE CONFIRMED");
  syncHUD();
}
function screenToCell(ev){
  const rect=canvas.getBoundingClientRect();
  const x=(ev.clientX-rect.left)*W/rect.width,y=(ev.clientY-rect.top)*H/rect.height;
  return {x,y,c:Math.floor(x/TILE),r:Math.floor(y/TILE)};
}
function handleFieldClick(ev){
  if(!state||state.modal||state.paused||state.mode!=="game")return;
  ev.preventDefault();
  const p=screenToCell(ev);
  if(p.x<0||p.y<0||p.x>=W||p.y>=H)return;
  if(state.targetingStrike){orbitalStrike(p.x,p.y);return;}
  const match=state.towers.find(t=>t.c===p.c&&t.r===p.r);
  if(match){state.selectedTower=match;state.selectedBuild=null;refreshTowerList();updateDetails();playSound(510,.04,"triangle");return;}
  if(state.selectedBuild){placeTower(p.c,p.r);return;}
  state.selectedTower=null;updateDetails();
}
function initControls(){
  $("startButton").addEventListener("click",startGame);
  $("mapCards").addEventListener("click",ev=>{
    const button=ev.target.closest("[data-map]");
    if(!button)return;
    chosenMap=Number(button.dataset.map);
    $("mapCards").querySelectorAll("[data-map]").forEach(b=>b.classList.toggle("selected",b===button));
    playSound(550,.07,"triangle");
  });
  $("difficultyOptions").addEventListener("click",ev=>{
    const button=ev.target.closest("[data-difficulty]");
    if(!button)return;
    chosenDifficulty=Number(button.dataset.difficulty);
    $("difficultyOptions").querySelectorAll("[data-difficulty]").forEach(b=>b.classList.toggle("active",b===button));
    playSound(480,.07,"triangle");
  });
  $("soundButton").addEventListener("click",()=>{
    soundOn=!soundOn;try{localStorage.setItem(STORAGE+"-muted",String(!soundOn));}catch(_){}
    updateSoundButton();if(soundOn)playSound(660,.1);
  });
  $("towerList").addEventListener("click",ev=>{
    const b=ev.target.closest("[data-id]");if(b)chooseBuild(b.dataset.id);
  });
  $("towerDetails").addEventListener("click",ev=>{
    const b=ev.target.closest("[data-action]");
    if(!b||!state)return;
    if(b.dataset.action==="upgrade")upgradeSelected();
    else if(b.dataset.action==="specialize")specializeSelected(b.dataset.spec);
    else if(b.dataset.action==="sell")sellSelected();
    else if(b.dataset.action==="target"){
      const t=state.selectedTower;if(!t)return;
      const modes=["first","strong","last"];
      t.priority=modes[(modes.indexOf(t.priority)+1)%modes.length];
      updateDetails();playSound(490,.06);
    }
  });
  canvas.addEventListener("pointerdown",handleFieldClick);
  canvas.addEventListener("pointermove",ev=>{if(state)state.hover=screenToCell(ev);});
  canvas.addEventListener("pointerleave",()=>{if(state)state.hover=null;});
  $("waveButton").addEventListener("click",startWave);
  $("speedButton").addEventListener("click",()=>{
    if(!state||state.modal)return;
    state.speed=state.speed===1?2:state.speed===2?3:1;
    $("speedButton").textContent=state.speed+"×";playSound(560,.06);
  });
  $("pauseButton").addEventListener("click",togglePause);
  $("menuButton").addEventListener("click",showQuitModal);
  $("abilityOverdrive").addEventListener("click",()=>useAbility("overdrive"));
  $("abilityEmp").addEventListener("click",()=>useAbility("emp"));
  $("abilityStrike").addEventListener("click",()=>useAbility("strike"));
  window.addEventListener("keydown",ev=>{
    if(!state||state.modal)return;
    if(["Space","ArrowUp","ArrowDown"].includes(ev.code))ev.preventDefault();
    if(ev.code==="Escape"){state.selectedBuild=null;state.selectedTower=null;state.targetingStrike=false;refreshTowerList();updateDetails();syncHUD();}
    else if(ev.code==="Space")togglePause();
    else if(ev.key.toLowerCase()==="f")$("speedButton").click();
    else if(ev.code==="Enter"&&!state.waveActive)startWave();
    else if(/^[1-6]$/.test(ev.key))chooseBuild(TOWERS[Number(ev.key)-1].id);
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden&&state&&!state.paused&&!state.modal){
      state.paused=true;$("pauseButton").textContent="▶";syncHUD();
    }
  });
}
function updateSoundButton(){
  $("soundButton").classList.toggle("muted",!soundOn);
  $("soundButton").textContent=soundOn?"♫":"♪";
  $("soundButton").setAttribute("aria-label",soundOn?"Mute sound":"Enable sound");
}
function togglePause(){
  if(!state||state.modal)return;
  state.paused=!state.paused;
  $("pauseButton").textContent=state.paused?"▶":"Ⅱ";
  playSound(430,.08);syncHUD();
}

function roundRect(x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function polygon(cx,cy,r,n,rotation=0){
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const a=rotation+i*TAU/n;
    if(i===0)ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
    else ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
  }
  ctx.closePath();
}
function background(){
  const theme=MAPS[state.mapIndex].tint;
  const grad=ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,"#10263b");grad.addColorStop(.5,"#081829");grad.addColorStop(1,"#0b2031");
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#28435a44";ctx.lineWidth=1;
  for(let x=0;x<=W;x+=TILE){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);ctx.stroke();}
  for(let y=0;y<=H;y+=TILE){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);ctx.stroke();}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const hash=(r*31+c*17+r*c*11)%13;
    if(hash===0||hash===4){
      const x=c*TILE+8,y=r*TILE+8;
      ctx.fillStyle=hash===0?"#26466188":"#1b344d77";
      ctx.fillRect(x,y,23,3);ctx.fillRect(x,y,3,19);
      if(hash===0){ctx.fillStyle=theme;ctx.globalAlpha=.24;ctx.fillRect(x+5,y+15,3,3);ctx.globalAlpha=1;}
    }
    if(hash===9){
      ctx.fillStyle="#203b51";ctx.fillRect(c*TILE+37,r*TILE+12,5,5);
    }
  }
}

function drawPowerPads(){
  for(const pad of POWER_PADS[state.mapIndex]){
    const p=tileCenter(pad.c,pad.r),def=PAD_TYPES[pad.type];
    const pulse=.72+Math.sin(ambientTime*2.6+pad.c)*.28;
    ctx.save();ctx.translate(p.x,p.y);
    ctx.globalAlpha=.65+pulse*.3;
    ctx.shadowColor=def.color;ctx.shadowBlur=12+pulse*13;
    ctx.fillStyle="#16263c";ctx.strokeStyle=def.color;ctx.lineWidth=2;
    polygon(0,0,22,6,Math.PI/6);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    ctx.save();ctx.rotate(ambientTime*.6);
    ctx.strokeStyle=def.color;ctx.lineWidth=1.3;polygon(0,0,16,4,Math.PI/4);ctx.stroke();ctx.restore();
    ctx.fillStyle=def.color;ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="900 21px system-ui";ctx.fillText(def.symbol,0,0);
    ctx.restore();
  }
}
function drawAmbience(){
  const tint=MAPS[state.mapIndex].tint;
  ctx.save();ctx.globalAlpha=.055;
  const glow=ctx.createRadialGradient(690,80,10,690,80,335);
  glow.addColorStop(0,tint);glow.addColorStop(1,"#00000000");
  ctx.fillStyle=glow;ctx.fillRect(270,-110,570,480);ctx.globalAlpha=1;
  for(let i=0;i<32;i++){
    const x=(i*177.31+27)%W,y=(i*97.83+63)%H;
    const a=.13+.16*(1+Math.sin(ambientTime*(.48+i%4*.2)+i))*.5;
    ctx.globalAlpha=a;ctx.fillStyle=i%6===0?"#d6fa70":"#89b8cf";
    ctx.fillRect(x,y,1.3+(i%3),1.3+(i%3));
  }
  ctx.globalAlpha=.32;ctx.font="900 11px monospace";ctx.textAlign="left";ctx.fillStyle=tint;
  ctx.fillText("SECTOR "+String(state.mapIndex+1).padStart(2,"0")+" // DEFENSE GRID",13,H-13);
  ctx.textAlign="right";ctx.fillText("POWER GRID ONLINE",W-14,19);
  ctx.restore();
}
function drawPath(){
  const pts=state.path.points;
  ctx.lineCap="square";ctx.lineJoin="round";
  const drawStroke=(width,color)=>{
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  drawStroke(53,"#33536c");
  drawStroke(47,"#172b40");
  drawStroke(36,"#263c50");
  drawStroke(2,"#60809666");
  ctx.lineCap="round";
  ctx.setLineDash([5,19]);drawStroke(2,"#a1c4d75e");ctx.setLineDash([]);
  for(let d=110;d<state.path.total-30;d+=165){
    const p=pointAt(state.path,d),q=pointAt(state.path,d+12);
    const angle=Math.atan2(q.y-p.y,q.x-p.x);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    ctx.fillStyle="#b5dae76b";
    ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-4,-6);ctx.lineTo(-4,-2);ctx.lineTo(-11,-2);ctx.lineTo(-11,2);ctx.lineTo(-4,2);ctx.lineTo(-4,6);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  const exit=pts[pts.length-1];
  const glow=ctx.createRadialGradient(W-10,exit.y,0,W-10,exit.y,95);
  glow.addColorStop(0,"#d6fa704d");glow.addColorStop(1,"#d6fa7000");
  ctx.fillStyle=glow;ctx.fillRect(W-110,exit.y-105,120,210);
  ctx.save();ctx.translate(W-15,exit.y);
  ctx.rotate(ambientTime*.7);
  ctx.strokeStyle="#d6fa70";ctx.lineWidth=3;polygon(0,0,23,6,Math.PI/6);ctx.stroke();
  ctx.restore();
  ctx.fillStyle="#d6fa70";ctx.beginPath();ctx.arc(W-15,exit.y,8,0,TAU);ctx.fill();
  ctx.strokeStyle="#d6fa7044";ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(W-15,exit.y,26+Math.sin(ambientTime*3)*4,0,TAU);ctx.stroke();
  for(let i=0;i<6;i++){
    const a=ambientTime*.8+i*TAU/6;
    ctx.fillStyle="#d6fa7080";ctx.fillRect(W-15+Math.cos(a)*35-2,exit.y+Math.sin(a)*35-2,4,4);
  }
}
function drawTower(t,ghost=false){
  const def=TOWER_BY_ID[t.id];
  ctx.save();ctx.translate(t.x,t.y);
  if(ghost)ctx.globalAlpha=.53;
  const flash=t.flash>0?1:0;
  ctx.shadowBlur=flash?25:12;ctx.shadowColor=def.color;
  roundRect(-20,-20,40,40,8,"#0a192a","#3b6170");
  ctx.shadowBlur=0;
  roundRect(-16,-16,32,32,6,"#19374a",def.color);
  ctx.fillStyle="#0a1526";ctx.fillRect(-20,-20,6,6);ctx.fillRect(14,-20,6,6);ctx.fillRect(-20,14,6,6);ctx.fillRect(14,14,6,6);
  if(t.id==="mint"){
    ctx.save();ctx.rotate(ambientTime*1.4);ctx.strokeStyle=def.color;ctx.lineWidth=3;polygon(0,0,14,4,Math.PI/4);ctx.stroke();ctx.restore();
    ctx.fillStyle=def.color;ctx.font="900 18px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("¢",0,1);
  }else{
    ctx.rotate(t.angle);
    if(t.id==="rail"){
      roundRect(-3,-7,34,14,3,"#415c70",def.color);roundRect(16,-3,18,6,1,def.color);
    }else if(t.id==="mortar"){
      roundRect(-4,-10,28,20,5,"#3d4f63",def.color);roundRect(12,-6,17,12,3,def.color);
    }else if(t.id==="tesla"){
      ctx.fillStyle=def.color;polygon(8,0,16,3,0);ctx.fill();ctx.fillStyle="#152334";polygon(8,0,8,3,0);ctx.fill();
    }else if(t.id==="cryo"){
      roundRect(2,-8,25,16,4,"#6b86ac",def.color);ctx.fillStyle=def.color;ctx.fillRect(23,-12,6,8);ctx.fillRect(23,4,6,8);
    }else{
      roundRect(0,-5,28,10,3,"#49758e",def.color);
      ctx.fillStyle=def.color;ctx.fillRect(20,-7,9,14);
    }
    ctx.fillStyle=flash?"#fff":def.color;ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.fill();
  }
  if(!ghost&&t.jammedUntil>state.time){
    ctx.rotate(-(t.id==="mint"?0:t.angle));
    ctx.strokeStyle="#ff8ad4";ctx.lineWidth=2;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.arc(0,0,24+Math.sin(ambientTime*12)*2,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#ff8ad4";ctx.textAlign="center";ctx.font="900 13px system-ui";ctx.fillText("!",0,-25);
    ctx.rotate(t.id==="mint"?0:t.angle);
  }
  if(!ghost&&t.specialization){
    ctx.rotate(-(t.id==="mint"?0:t.angle));
    ctx.strokeStyle=def.color;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,22,ambientTime%TAU,ambientTime%TAU+Math.PI*.85);ctx.stroke();
    ctx.rotate(t.id==="mint"?0:t.angle);
  }
  if(!ghost&&t.level>1){
    ctx.rotate(-(t.id==="mint"?0:t.angle));
    for(let i=0;i<t.level-1;i++){ctx.fillStyle=def.color;ctx.fillRect(-13+i*9,14,6,3);}
  }
  ctx.restore();
}
function drawEnemies(){
  for(const e of state.enemies){
    if(e.dead)continue;
    const def=ENEMIES[e.type];
    ctx.save();ctx.translate(e.x,e.y);
    const frozen=state.time<e.stunUntil,slowed=state.time<e.slowUntil;
    ctx.shadowColor=frozen?"#b9eeff":def.color;ctx.shadowBlur=12;
    ctx.fillStyle=e.hitFlash>0?"#ffffff":def.color;
    ctx.strokeStyle="#fff8";ctx.lineWidth=1;
    if(e.type==="runner"||e.type==="phantom"){
      polygon(0,0,e.r,3,Math.PI/2);ctx.fill();ctx.stroke();
    }else if(e.type==="brute"||e.type==="boss"){
      polygon(0,0,e.r,e.type==="boss"?8:6,ambientTime*.3);ctx.fill();ctx.stroke();
    }else if(e.type==="splitter"){
      polygon(0,0,e.r,5,ambientTime*.45);ctx.fill();ctx.stroke();
    }else{
      ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();ctx.stroke();
    }
    ctx.shadowBlur=0;
    ctx.fillStyle="#101b30";
    if(e.type==="boss"){
      ctx.save();ctx.rotate(ambientTime*.7);
      ctx.strokeStyle="#ffbf79";ctx.lineWidth=2.2;polygon(0,0,36,8,Math.PI/8);ctx.stroke();
      for(let n=0;n<8;n++){const a=n*TAU/8;ctx.fillStyle="#ff9a66";ctx.fillRect(Math.cos(a)*36-2,Math.sin(a)*36-2,4,4);}
      ctx.restore();
      polygon(0,0,15,6,Math.PI/6);ctx.fill();
      ctx.fillStyle="#fff3c0";ctx.font="900 15px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",0,1);
    }else if(e.type==="medic"){
      ctx.fillStyle="#c8ffd1";ctx.fillRect(-2,-8,4,16);ctx.fillRect(-8,-2,16,4);
    }else if(e.type==="jammer"){
      ctx.strokeStyle="#241029";ctx.lineWidth=2;
      for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,5+k*4,Math.PI*1.17,Math.PI*1.83);ctx.stroke();}
      ctx.fillStyle="#3e194c";ctx.fillRect(-3,0,6,5);
    }else if(e.type==="carrier"){
      roundRect(-10,-8,20,16,3,"#263248");
      ctx.fillStyle="#ffdc9a";ctx.fillRect(-9,-2,5,5);ctx.fillRect(4,-2,5,5);
    }else{
      ctx.beginPath();ctx.arc(0,0,Math.max(3,e.r*.4),0,TAU);ctx.fill();
      ctx.fillStyle="#ffffffbf";ctx.fillRect(-2,-2,4,4);
    }
    if(e.shield>0){
      ctx.beginPath();ctx.arc(0,0,e.r+5,0,TAU);
      ctx.strokeStyle="#7ad4ff";ctx.lineWidth=3;ctx.setLineDash([7,4]);ctx.stroke();ctx.setLineDash([]);
    }
    if(e.burnUntil>state.time){
      ctx.fillStyle="#ffc16d";ctx.globalAlpha=.8;
      ctx.beginPath();ctx.arc(Math.sin(ambientTime*12+e.id)*e.r*.4,-e.r,3,0,TAU);ctx.fill();ctx.globalAlpha=1;
    }
    if(e.brittleUntil>state.time){
      ctx.strokeStyle="#c6ecff";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-e.r-5,-e.r-2);ctx.lineTo(-e.r-12,-e.r-10);ctx.stroke();
    }
    if(slowed||frozen){
      ctx.strokeStyle=frozen?"#e6faff":"#91d4ff";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,e.r+8,0,TAU);ctx.stroke();
    }
    const width=Math.max(23,e.r*2.2);
    ctx.fillStyle="#07121ccf";ctx.fillRect(-width/2,-e.r-13,width,4);
    ctx.fillStyle=e.type==="boss"?"#ffb66a":"#cafa84";
    ctx.fillRect(-width/2,-e.r-13,width*clamp(e.hp/e.maxHp,0,1),4);
    if(e.maxShield&&e.shield>0){ctx.fillStyle="#80d3ff";ctx.fillRect(-width/2,-e.r-18,width*(e.shield/e.maxShield),3);}
    ctx.restore();
  }
}
function drawProjectiles(){
  for(const p of state.projectiles){
    ctx.save();ctx.shadowBlur=18;ctx.shadowColor=p.color;
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.restore();
  }
  for(const b of state.beams){
    const alpha=clamp(b.life/b.maxLife,0,1);
    ctx.save();ctx.globalAlpha=alpha;
    if(b.emp){
      ctx.fillStyle="#a3e7ff";ctx.globalAlpha=alpha*.32;ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="#e1faff";ctx.lineWidth=7;ctx.strokeRect(10,10,W-20,H-20);
    }else if(b.blast){
      const progress=1-alpha;
      ctx.strokeStyle=b.color;ctx.lineWidth=12*alpha;
      ctx.shadowColor=b.color;ctx.shadowBlur=45;
      ctx.beginPath();ctx.arc(b.x1,b.y1,b.thickness*progress,0,TAU);ctx.stroke();
      ctx.globalAlpha=alpha*.36;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x1,b.y1,b.thickness*progress,0,TAU);ctx.fill();
    }else{
      ctx.shadowColor=b.color;ctx.shadowBlur=16;
      ctx.strokeStyle=b.color;ctx.lineWidth=b.thickness;
      ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke();
      ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(1,b.thickness*.28);ctx.stroke();
    }
    ctx.restore();
  }
  for(const p of state.particles){
    ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);
    ctx.fillStyle=p.color;ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r);
  }
  ctx.globalAlpha=1;
  for(const f of state.floaters){
    ctx.globalAlpha=clamp(f.life/.7,0,1);
    ctx.font="900 12px system-ui";ctx.textAlign="center";ctx.fillStyle=f.color;
    ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}
function drawSelection(){
  const sel=state.selectedTower,hover=state.hover;
  if(sel&&state.towers.includes(sel)){
    const stats=towerStats(sel);
    if(stats.range>0){
      ctx.fillStyle="#54e5f316";ctx.strokeStyle="#54e5f366";ctx.lineWidth=2;
      ctx.setLineDash([6,7]);ctx.beginPath();ctx.arc(sel.x,sel.y,stats.range,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    }
    ctx.strokeStyle="#d6fa70";ctx.lineWidth=2;ctx.strokeRect(sel.c*TILE+3,sel.r*TILE+3,TILE-6,TILE-6);
  }
  if(!hover||hover.c<0||hover.c>=COLS||hover.r<0||hover.r>=ROWS)return;
  if(state.targetingStrike){
    ctx.strokeStyle="#d6fa70aa";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(hover.x,hover.y,120,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.moveTo(hover.x-15,hover.y);ctx.lineTo(hover.x+15,hover.y);
    ctx.moveTo(hover.x,hover.y-15);ctx.lineTo(hover.x,hover.y+15);ctx.stroke();return;
  }
  if(!state.selectedBuild)return;
  const t=TOWER_BY_ID[state.selectedBuild],valid=!state.path.tiles.has(cellKey(hover.c,hover.r))&&!state.towers.some(x=>x.c===hover.c&&x.r===hover.r)&&state.credits>=t.cost;
  ctx.fillStyle=valid?"#d6fa7024":"#ff647c35";
  ctx.fillRect(hover.c*TILE+2,hover.r*TILE+2,TILE-4,TILE-4);
  ctx.strokeStyle=valid?"#d6fa70":"#ff647c";
  ctx.lineWidth=2;ctx.strokeRect(hover.c*TILE+2,hover.r*TILE+2,TILE-4,TILE-4);
  const stats={id:t.id,x:hover.c*TILE+25,y:hover.r*TILE+25,angle:-Math.PI/2,level:1,flash:0};
  if(t.range){ctx.beginPath();ctx.arc(stats.x,stats.y,t.range*(1+.08*state.perks.range),0,TAU);ctx.strokeStyle=valid?"#d6fa7070":"#ff647c70";ctx.lineWidth=1;ctx.stroke();}
  drawTower(stats,true);
}
function drawPausedOverlay(){
  if(!state.paused)return;
  ctx.fillStyle="#050b19c9";ctx.fillRect(0,0,W,H);
  ctx.textAlign="center";ctx.fillStyle="#d6fa70";ctx.font="900 75px 'Barlow Condensed',Impact,sans-serif";ctx.fillText("PAUSED",W/2,H/2);
  ctx.font="700 13px system-ui";ctx.fillStyle="#9db5d0";ctx.fillText("PRESS SPACE OR ▶ TO RESUME",W/2,H/2+32);
}
function draw(){
  if(!state)return;
  ctx.save();
  if(state.shake>0)ctx.translate(rand(-state.shake,state.shake)*.5,rand(-state.shake,state.shake)*.5);
  background();drawAmbience();drawPath();drawPowerPads();
  for(const t of state.towers)drawTower(t);
  drawEnemies();drawProjectiles();drawSelection();
  if(state.time<state.overdriveUntil){
    ctx.fillStyle="#ffc66b";ctx.font="900 13px system-ui";ctx.textAlign="left";
    ctx.fillText("⚡ OVERDRIVE  "+Math.ceil(state.overdriveUntil-state.time)+"s",15,24);
  }
  drawPausedOverlay();ctx.restore();
}
function loop(timestamp){
  const elapsed=lastFrame?Math.min(.055,(timestamp-lastFrame)/1000):0;
  lastFrame=timestamp;ambientTime+=elapsed;
  if(state){update(elapsed*state.speed);draw();}
  requestAnimationFrame(loop);
}

initControls();
updateSoundButton();
$("menuBest").textContent="WAVE "+best.wave;
$("menuBestScore").textContent=money(best.score)+" POINTS";
requestAnimationFrame(loop);
})();