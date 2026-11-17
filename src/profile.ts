import {tr,lang} from './i18n';
export type Upgrade='armor'|'engine'|'weapon';
export type Settings={control:'twin'|'auto';zoom:number;volume:number;music:number;sensitivity:number;controlScale:number;quality:'low'|'medium'|'high';shake:boolean;difficulty:'easy'|'normal'|'hard'};
import {levelOf,carUnlockLevel,modeUnlockLevel,arenaUnlockLevel,levelReward,weaponCosts,WEAPON_MAX,statCost,matchXp,matchCredits,rating,ratingBonus,addParts,noParts,partKinds,dayKey,weekKey,pickTasks,dailyPool,weeklyPool,DAILY_COUNT,WEEKLY_COUNT,REROLL_COST,taskDef,achievements,masteryOf,masteryReward,variantUnlocked,challenges,starGoalsFor,starCount,STAR_REWARD,starMilestones,seasonOf,seasonTier,seasonReward,encodeSave,decodeSave,type Parts,type LevelReward,type MatchSummary,type Rating,type StatKey} from './progression';
export type TaskState={id:string;progress:number;claimed:boolean};
export type Profile={version:3;mode:'horde'|'team'|'capture'|'elimination'|'ctf'|'charge';coins:number;xp:number;car:number;weapon:number;paints:number[];arena:number;upgrades:{armor:number;engine:number;weapon:number}[];ownedPaint:number[];games:number;wins:number;kills:number;damage:number;bestWave:number;claims:string[];settings:Settings;
 /** Battle salvage. `coins` above are the credits (信用点). */
 parts:Parts;crates:number;flags:number;captures:number;hordeClears:number;bestCombo:number;
 /** Grandfathered unlocks for saves made before levels gated content. */
 legacyCars:number[];legacyAllCars:boolean;legacyMaps:boolean;
 levelClaimed:number;titles:string[];title:string;
 mastery:number[];masteryClaimed:number[];skillMod:number[];variants:number[];
 trial:{day:string;used:number[]};
 daily:{day:string;tasks:TaskState[];rerolled:boolean;firstWin:boolean};
 weekly:{week:string;tasks:TaskState[];winCars:number[]};
 stars:number[];starGoals:number[];starClaims:number[];
 season:{id:number;xp:number;claimed:number}};
export const paintColors=[0x1f8796,0xd2581f,0x5d3a96,0xd8d2c4,0x5a6440,0x2c2f35,0xe2b11f,0xb8261c];
export const paintNames=lang==='en'?['Aurora blue','Lava orange','Phantom violet','Wasteland white','Legion green','Graphite black','Signal yellow','Rally red']:['极光蓝','熔岩橙','幻影紫','荒原白','军团绿','石墨黑','信号黄','赛道红'];
// Factory paint per vehicle (Kestrel, Grapnel, Arclight, Bombard, Bulwark) matching the garage card renders and AI colours; each car's own factory colour is free.
export const defaultPaint=[6,4,2,3,7];
const five=(v=0)=>Array.from({length:5},()=>v);
const defaults=():Profile=>({version:3,mode:'horde',coins:1200,xp:0,car:1,weapon:0,paints:[...defaultPaint],arena:0,upgrades:Array.from({length:5},()=>({armor:0,engine:0,weapon:0})),ownedPaint:[0,1,2],games:0,wins:0,kills:0,damage:0,bestWave:0,claims:[],settings:{control:'twin',zoom:1,volume:65,music:60,sensitivity:1,controlScale:1,quality:'medium',shake:true,difficulty:'normal'},
 parts:{common:20,precision:0,core:0},crates:0,flags:0,captures:0,hordeClears:0,bestCombo:0,legacyCars:[],legacyAllCars:false,legacyMaps:false,levelClaimed:1,titles:['rookie'],title:'rookie',
 mastery:five(),masteryClaimed:five(1),skillMod:five(),variants:five(),trial:{day:'',used:[]},daily:{day:'',tasks:[],rerolled:false,firstWin:false},weekly:{week:'',tasks:[],winCars:[]},stars:Array.from({length:challenges.length},()=>0),starGoals:Array.from({length:challenges.length},()=>0),starClaims:[],season:{id:0,xp:0,claimed:0}});
const number=(value:unknown,max=1e9)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,value)):0;
const ints=(value:unknown,length:number,max:number,fallback=0)=>Array.from({length},(_,i)=>Array.isArray(value)&&typeof value[i]==='number'?Math.floor(number(value[i],max)):fallback);
const tasks=(value:unknown):TaskState[]=>Array.isArray(value)?value.filter(t=>t&&typeof t.id==='string'&&taskDef(t.id)).slice(0,6).map(t=>({id:t.id,progress:number(t.progress),claimed:!!t.claimed})):[];
const str=(value:unknown)=>typeof value==='string'?value.slice(0,40):'';
export type RewardReport={credits:number;xp:number;firstWin:boolean;rating:Rating;parts:Parts;salvage:Parts;levelBefore:number;levelAfter:number;levelRewards:{level:number;reward:LevelReward}[];masteryUps:{car:number;level:number}[];seasonBefore:number;seasonAfter:number;tasksDone:string[];challenge?:{id:number;stars:number;goals:number;gained:number;best:number}};
export class ProfileStore{
 key='arena-profile-v1';data:Profile;storage?:Pick<Storage,'getItem'|'setItem'>;
 constructor(storage?:Pick<Storage,'getItem'|'setItem'>,key='arena-profile-v1'){this.storage=storage;this.key=key;this.data=defaults();try{this.data=ProfileStore.parse(storage?.getItem(key)??'null')??this.data;}catch{}}
 /** Validates a saved profile (any version) into the current shape; null when it is not a profile. */
 static parse(text:string):Profile|null{const d=defaults();const saved=JSON.parse(text);if(!(saved?.version===1||saved?.version===2||saved?.version===3))return null;
  if(['horde','team','capture','elimination','ctf','charge'].includes(saved.mode))d.mode=saved.mode;for(const key of ['coins','xp','games','wins','kills','damage','bestWave','crates','flags','captures','hordeClears','bestCombo'] as const)d[key]=number(saved[key]);for(const key of ['car','weapon','arena'] as const)d[key]=Math.floor(number(saved[key],key==='car'||key==='weapon'?4:3));if(saved.version===1&&d.car===2)d.car=4;
  const legacy=saved.version<3,weaponScale=legacy?2:1;
  d.upgrades=d.upgrades.map((_,i)=>{const old=saved.version===1?(i===4?2:i>=2?-1:i):i;return {armor:Math.floor(number(saved.upgrades?.[old]?.armor,5)),engine:Math.floor(number(saved.upgrades?.[old]?.engine,5)),weapon:Math.min(WEAPON_MAX,Math.floor(number(saved.upgrades?.[old]?.weapon,WEAPON_MAX))*weaponScale)};});
  d.ownedPaint=[0,1,2,...(Array.isArray(saved.ownedPaint)?saved.ownedPaint.filter((x:unknown,i:number,a:unknown[])=>Number.isInteger(x)&&Number(x)>=3&&Number(x)<paintColors.length&&a.indexOf(x)===i):[])];const usable=(car:number,x:unknown)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<paintColors.length&&(d.ownedPaint.includes(Number(x))||defaultPaint[car]===x);if(Array.isArray(saved.paints))d.paints=d.paints.map((p,i)=>usable(i,saved.paints[i])?Number(saved.paints[i]):p);else if(saved.paint!==0&&usable(d.car,saved.paint))d.paints[d.car]=Number(saved.paint);d.claims=Array.isArray(saved.claims)?saved.claims.filter((x:unknown)=>typeof x==='string'):[];const s=saved.settings??{};d.settings={control:s.control==='auto'||s.control==='wheel'?'auto':'twin',zoom:Math.max(.8,number(s.zoom??1,1.3)),volume:Math.min(100,number(s.volume??65)),music:Math.min(100,number(s.music??60)),sensitivity:Math.max(.6,number(s.sensitivity??1,1.6)),controlScale:Math.max(.8,number(s.controlScale??1,1.3)),quality:['low','medium','high'].includes(s.quality)?s.quality:'medium',shake:typeof s.shake==='boolean'?s.shake:true,difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:'normal'};
  if(legacy){
   // Old saves: coins become credits, plus a tenth of them in common parts; cars already tuned (or in use) stay open.
   d.parts={common:20+Math.floor(d.coins/10),precision:0,core:0};
   d.legacyCars=[d.car,...d.upgrades.map((u,i)=>u.armor||u.engine||u.weapon?i:-1).filter(i=>i>=0)].filter((v,i,a)=>a.indexOf(v)===i);
   d.legacyAllCars=d.games>=10;d.legacyMaps=d.games>=3;d.hordeClears=d.bestWave>=6?1:0;
   d.levelClaimed=levelOf(d.xp);for(let l=2;l<=d.levelClaimed;l++){const r=levelReward(l);if(r.paint!==undefined&&!d.ownedPaint.includes(r.paint))d.ownedPaint.push(r.paint);if(r.title&&!d.titles.includes(r.title))d.titles.push(r.title);}
   return d;}
  d.parts={common:number(saved.parts?.common),precision:number(saved.parts?.precision),core:number(saved.parts?.core)};
  d.legacyCars=ints(saved.legacyCars,Array.isArray(saved.legacyCars)?Math.min(5,saved.legacyCars.length):0,4);d.legacyAllCars=!!saved.legacyAllCars;d.legacyMaps=!!saved.legacyMaps;
  d.levelClaimed=Math.max(1,Math.floor(number(saved.levelClaimed??1,99)));d.titles=['rookie',...(Array.isArray(saved.titles)?saved.titles.filter((t:unknown)=>typeof t==='string'&&t!=='rookie').slice(0,40):[])];d.title=d.titles.includes(saved.title)?saved.title:'rookie';
  d.mastery=ints(saved.mastery,5,1e7);d.masteryClaimed=ints(saved.masteryClaimed,5,10,1).map(v=>Math.max(1,v));d.skillMod=ints(saved.skillMod,5,2);d.variants=ints(saved.variants,5,2);
  d.trial={day:str(saved.trial?.day),used:ints(saved.trial?.used,Array.isArray(saved.trial?.used)?Math.min(5,saved.trial.used.length):0,4)};
  d.daily={day:str(saved.daily?.day),tasks:tasks(saved.daily?.tasks),rerolled:!!saved.daily?.rerolled,firstWin:!!saved.daily?.firstWin};
  d.weekly={week:str(saved.weekly?.week),tasks:tasks(saved.weekly?.tasks),winCars:ints(saved.weekly?.winCars,Array.isArray(saved.weekly?.winCars)?Math.min(5,saved.weekly.winCars.length):0,4)};
  // Each star belongs to one goal (bit mask). Saves from before kept only a count: read n stars as the first n goals.
  {const counts=ints(saved.stars,challenges.length,3);d.starGoals=Array.isArray(saved.starGoals)?ints(saved.starGoals,challenges.length,7):counts.map(n=>(1<<n)-1);d.stars=d.starGoals.map(starCount);}d.starClaims=Array.isArray(saved.starClaims)?saved.starClaims.filter((x:unknown)=>typeof x==='number'&&starMilestones.some(m=>m.stars===x)):[];
  d.season={id:Math.floor(number(saved.season?.id,1e4)),xp:number(saved.season?.xp),claimed:Math.floor(number(saved.season?.claimed,30))};
  return d;}
 save(){try{this.storage?.setItem(this.key,JSON.stringify(this.data));return true;}catch{return false;}}
 get level(){return levelOf(this.data.xp);}
 carUnlocked(car:number){const d=this.data;return d.legacyAllCars||d.legacyCars.includes(car)||this.level>=(carUnlockLevel[car]??99);}
 modeUnlocked(mode:string){return this.data.legacyMaps||this.level>=(modeUnlockLevel[mode]??99);}
 arenaUnlocked(arena:number){return this.data.legacyMaps||this.level>=(arenaUnlockLevel[arena]??99);}
 /** A locked car can be test-driven for one match per day. */
 trialAvailable(car:number,now=new Date()){return !this.carUnlocked(car)&&!(this.data.trial.day===dayKey(now)&&this.data.trial.used.includes(car));}
 useTrial(car:number,now=new Date()){if(!this.trialAvailable(car,now))return false;const day=dayKey(now);if(this.data.trial.day!==day)this.data.trial={day,used:[]};this.data.trial.used.push(car);this.save();return true;}
 /** Mastery level that is in effect: mastery perks switch on at player level 10. */
 masteryLevel(car:number){return this.level>=10?masteryOf(this.data.mastery[car]??0):1;}
 variantOpen(car:number,variant:number){return variantUnlocked(variant,this.data.upgrades[car]?.weapon??0,this.masteryLevel(car));}
 setVariant(car:number,variant:number){if(!this.data.upgrades[car]||!this.variantOpen(car,variant))return false;this.data.variants[car]=variant;this.save();return true;}
 variantOf(car:number){const v=this.data.variants[car]??0;return this.variantOpen(car,v)?v:0;}
 chooseSkillMod(car:number,mod:number){if(this.masteryLevel(car)<10||![1,2].includes(mod))return false;this.data.skillMod[car]=mod;this.save();return true;}
 skillModOf(car:number){return this.masteryLevel(car)>=10?this.data.skillMod[car]??0:0;}
 setTitle(id:string){if(!this.data.titles.includes(id))return false;this.data.title=id;this.save();return true;}
 /** Next weapon upgrade's cost, or null when maxed. */
 weaponCost(car:number){const lv=this.data.upgrades[car]?.weapon??WEAPON_MAX;return lv>=WEAPON_MAX?null:weaponCosts[lv];}
 canAfford(cost:{parts:Parts;credits:number}){return this.data.coins>=cost.credits&&partKinds.every(k=>this.data.parts[k]>=cost.parts[k]);}
 upgrade(car:number,kind:Upgrade){if(!Number.isInteger(car)||!this.data.upgrades[car]||!['armor','engine','weapon'].includes(kind)||!this.carUnlocked(car))return false;
  if(kind==='weapon'){const cost=this.weaponCost(car);if(!cost||!this.canAfford(cost))return false;this.data.coins-=cost.credits;for(const k of partKinds)this.data.parts[k]-=cost.parts[k];this.data.upgrades[car].weapon++;this.save();return true;}
  const level=this.data.upgrades[car][kind],cost=statCost(level);if(level>=5||this.data.coins<cost)return false;this.data.coins-=cost;this.data.upgrades[car][kind]++;this.save();return true;}
 paintOf(car=this.data.car){return this.data.paints[car]??defaultPaint[car]??0;}
 paintOwned(index:number,car=this.data.car){return this.data.ownedPaint.includes(index)||defaultPaint[car]===index;}
 paint(index:number,car=this.data.car){if(!Number.isInteger(index)||index<0||index>=paintColors.length||!this.data.upgrades[car])return false;if(!this.paintOwned(index,car)){if(this.data.coins<250)return false;this.data.coins-=250;this.data.ownedPaint.push(index);}this.data.paints[car]=index;this.save();return true;}
 /** Adds a reward's credits, parts, paint and title. */
 grant(r:LevelReward){const d=this.data;d.coins+=r.credits??0;addParts(d.parts,r.parts??{});if(r.paint!==undefined&&!d.ownedPaint.includes(r.paint))d.ownedPaint.push(r.paint);if(r.title&&!d.titles.includes(r.title))d.titles.push(r.title);}
 /** Rolls the daily / weekly task lists and the season over when their period has changed. */
 refreshPeriods(now=new Date()){const d=this.data,day=dayKey(now),week=weekKey(now),season=seasonOf(now).id;let changed=false;
  if(d.daily.day!==day){d.daily={day,tasks:pickTasks(dailyPool,DAILY_COUNT,'d'+day).map(id=>({id,progress:0,claimed:false})),rerolled:false,firstWin:false};changed=true;}
  if(d.weekly.week!==week){d.weekly={week,tasks:pickTasks(weeklyPool,WEEKLY_COUNT,'w'+week).map(id=>({id,progress:0,claimed:false})),winCars:[]};changed=true;}
  if(d.season.id!==season){d.season={id:season,xp:0,claimed:0};changed=true;}
  if(changed)this.save();return changed;}
 tasksOpen(){return this.level>=3;}
 rerollTask(id:string,now=new Date()){this.refreshPeriods(now);const d=this.data,i=d.daily.tasks.findIndex(t=>t.id===id);if(i<0||d.daily.rerolled||d.daily.tasks[i].claimed||d.coins<REROLL_COST)return false;const next=pickTasks(dailyPool,1,'r'+d.daily.day+id,d.daily.tasks.map(t=>t.id))[0];if(!next)return false;d.coins-=REROLL_COST;d.daily.tasks[i]={id:next,progress:0,claimed:false};d.daily.rerolled=true;this.save();return true;}
 claimTask(id:string){const d=this.data,t=[...d.daily.tasks,...d.weekly.tasks].find(x=>x.id===id),def=taskDef(id);if(!t||!def||t.claimed||t.progress<def.target)return false;t.claimed=true;this.grant(def.reward);this.save();return true;}
 statValue(stat:StatKey){const d=this.data;if(stat==='level')return this.level;if(stat==='weaponLevels')return d.upgrades.reduce((s,u)=>s+u.weapon,0);return d[stat];}
 claim(id:string){const a=achievements.find(x=>x.id===id);if(!a||this.statValue(a.stat)<a.target||this.data.claims.includes(id))return false;this.data.claims.push(id);this.grant(a.reward);this.save();return true;}
 /** Achievement tiers that are reached but not yet claimed. */
 claimableAchievements(){return achievements.filter(a=>!this.data.claims.includes(a.id)&&this.statValue(a.stat)>=a.target);}
 /** Finished daily and weekly tasks whose reward is still waiting. */
 claimableTasks(){return this.tasksOpen()?[...this.data.daily.tasks,...this.data.weekly.tasks].filter(t=>!t.claimed&&t.progress>=(taskDef(t.id)?.target??1e9)):[];}
 claimable(){return this.claimableAchievements().length+this.claimableTasks().length;}
 /** Claims every waiting reward of one module; returns how many were claimed. */
 claimAll(kind:'tasks'|'achievements'){let n=0;if(kind==='tasks'){for(const t of this.claimableTasks())if(this.claimTask(t.id))n++;}else for(const a of this.claimableAchievements())if(this.claim(a.id))n++;return n;}
 /** Parts and credits still needed to take every unlocked weapon to the top level. */
 weaponNeed(){const need={parts:noParts(),credits:0};this.data.upgrades.forEach((u,car)=>{if(!this.carUnlocked(car))return;for(let l=u.weapon;l<WEAPON_MAX;l++){addParts(need.parts,weaponCosts[l].parts);need.credits+=weaponCosts[l].credits;}});return need;}
 totalStars(){return this.data.stars.reduce((a,b)=>a+b,0);}
 challengeOpen(i:number){const c=challenges[i];return !!c&&this.level>=c.level&&(i===0||this.data.stars[i-1]>0)&&(c.car===undefined||this.carUnlocked(c.car));}
 /** Books a finished match: credits, experience, parts, stats, level-ups, mastery, season, tasks and challenge stars. */
 reward(input:Partial<MatchSummary>&{score:number;win:boolean;kills:number;damage:number;wave:number},now=new Date()):RewardReport{
  const d=this.data;this.refreshPeriods(now);
  const m:MatchSummary={mode:d.mode,arena:d.arena,car:d.car,difficulty:d.settings.difficulty,deaths:0,parts:noParts(),crates:0,flags:0,captures:0,bestCombo:0,seconds:0,...input,score:number(input.score),kills:number(input.kills),damage:number(input.damage),wave:number(input.wave,6)};
  const levelBefore=this.level,seasonBefore=seasonTier(d.season.xp),masteryBefore=d.mastery.map(masteryOf);
  let xp=matchXp(m);const firstWin=m.win&&!d.daily.firstWin;if(firstWin){xp*=2;d.daily.firstWin=true;}
  let credits=matchCredits(m);const grade=rating(m.score,m.win),salvage={...m.parts},parts=addParts({...m.parts},ratingBonus[grade]);
  let challenge:RewardReport['challenge'];
  if(m.challenge!==undefined&&challenges[m.challenge]){const c=challenges[m.challenge],goals=starGoalsFor(c,m),before=d.stars[c.id];d.starGoals[c.id]|=goals;d.stars[c.id]=starCount(d.starGoals[c.id]);const best=d.stars[c.id],gained=best-before;credits+=gained*STAR_REWARD;challenge={id:c.id,stars:starCount(goals),goals,gained,best};
   for(const ms of starMilestones)if(this.totalStars()>=ms.stars&&!d.starClaims.includes(ms.stars)){d.starClaims.push(ms.stars);this.grant(ms.reward);}}
  d.coins+=credits;d.xp+=xp;addParts(d.parts,parts);d.games++;d.wins+=m.win?1:0;d.kills+=m.kills;d.damage+=m.damage;d.bestWave=Math.max(d.bestWave,m.wave);d.crates+=m.crates;d.flags+=m.flags;d.captures+=m.captures;d.bestCombo=Math.max(d.bestCombo,m.bestCombo);if(m.mode==='horde'&&m.win)d.hordeClears++;
  d.mastery[m.car]=(d.mastery[m.car]??0)+xp;d.season.xp+=xp;
  const levelAfter=this.level,levelRewards:RewardReport['levelRewards']=[];
  for(let l=d.levelClaimed+1;l<=levelAfter;l++){const r=levelReward(l);this.grant(r);levelRewards.push({level:l,reward:r});}d.levelClaimed=Math.max(d.levelClaimed,levelAfter);
  const masteryUps:RewardReport['masteryUps']=[];
  if(levelAfter>=10)for(let car=0;car<5;car++){const lv=masteryOf(d.mastery[car]);for(let l=d.masteryClaimed[car]+1;l<=lv;l++){const r=masteryReward(l,car);this.grant(r);if(l>masteryBefore[car]||levelBefore<10)masteryUps.push({car,level:l});}d.masteryClaimed[car]=Math.max(d.masteryClaimed[car],lv);}
  const seasonAfter=seasonTier(d.season.xp);for(let t=Math.max(d.season.claimed,seasonBefore)+1;t<=seasonAfter;t++)this.grant(seasonReward(t));d.season.claimed=Math.max(d.season.claimed,seasonAfter);
  const tasksDone:string[]=[];
  if(this.tasksOpen()){if(m.win&&!d.weekly.winCars.includes(m.car))d.weekly.winCars.push(m.car);
   for(const t of [...d.daily.tasks,...d.weekly.tasks]){const def=taskDef(t.id);if(!def||t.claimed)continue;const before=t.progress;
    if(t.id==='w-variety')t.progress=d.weekly.winCars.length;else if(t.id==='w-challenge')t.progress+=challenge?.gained??0;else t.progress+=def.metric(m);
    t.progress=Math.min(def.target,t.progress);if(before<def.target&&t.progress>=def.target)tasksDone.push(t.id);}}
  this.save();
  return {credits,xp,firstWin,rating:grade,parts,salvage,levelBefore,levelAfter,levelRewards,masteryUps,seasonBefore,seasonAfter,tasksDone,challenge};}
 exportCode(){return encodeSave(JSON.stringify(this.data));}
 /** Replaces this driver's save with a pasted code. False (and nothing changes) when the code is damaged. */
 importCode(code:string){const json=decodeSave(code);if(!json)return false;try{const parsed=ProfileStore.parse(json);if(!parsed)return false;this.data=parsed;this.save();return true;}catch{return false;}}
}
let storage:Storage|undefined;try{if(typeof localStorage!=='undefined')storage=localStorage;}catch{}
export const profileStore=new ProfileStore(storage);
export function loadDriver(name:string){
 const key='arena-driver:'+name;
 if(storage && !storage.getItem(key) && !storage.getItem('arena-first-driver')){
   const legacy=storage.getItem('arena-profile-v1');
   if(legacy)storage.setItem(key,legacy);
   storage.setItem('arena-first-driver',name);
 }
 const loaded=new ProfileStore(storage,key);
 // Weapon variants used to live in their own key; carry them into the profile once.
 try{const old=storage?.getItem('arena-variants:'+name);if(old&&!loaded.data.variants.some(Boolean)){const v=JSON.parse(old);if(Array.isArray(v))loaded.data.variants=loaded.data.variants.map((_,i)=>[0,1,2].includes(v[i])?v[i]:0);}}catch{}
 profileStore.key=key;profileStore.data=loaded.data;profileStore.refreshPeriods();
 storage?.setItem('arena-last-driver',name);
}

/** Mode names and one-line taglines for the deploy cards and results. */
export const modeNames={horde:tr('单人生存','Survival'),team:tr('团队歼灭','Team deathmatch'),capture:tr('据点争夺','Capture points'),elimination:tr('单命对决','Elimination'),ctf:tr('夺旗','Capture the flag'),charge:tr('能量争夺','Power core')};
export const modeTaglines={horde:tr('6 波进攻 · 重装首领','6 waves · Heavy boss'),team:tr('无限复活 · 20 次击毁','Endless respawns · 20 kills'),capture:tr('争夺 A · B · C','Hold A · B · C'),elimination:tr('全歼敌队','Wipe the enemy team'),ctf:tr('夺取敌旗 · 3 次交付','Steal the flag · 3 captures'),charge:tr('抢夺电池 · 持有得分','Grab the core · Hold to score')};
export const weapons=[
 {name:tr('Kestrel · 旋转机枪','Kestrel · Rotary gun'),tag:tr('短点射 / 压制','Short bursts / Suppression'),damage:1,reload:1,speed:34,range:16,spread:.055,pellets:1,gravity:0,color:0xffdc82,splash:0},
 {name:tr('Grapnel · 爆裂霰弹炮','Grapnel · Burst shotgun'),tag:tr('近距离 / 散射','Close range / Spread'),damage:1,reload:1,speed:26,range:11,spread:.19,pellets:5,gravity:0,color:0xffa66d,splash:0},
 {name:tr('Arclight · 脉冲炮','Arclight · Pulse cannon'),tag:tr('中距离 / 高弹速','Mid range / Fast rounds'),damage:1,reload:1,speed:52,range:20,spread:.024,pellets:1,gravity:0,color:0x89deef,splash:0},
 {name:tr('Bombard · 火箭巢','Bombard · Rocket pod'),tag:tr('预判 / 爆炸','Lead your shots / Explosive'),damage:1,reload:1,speed:18,range:22,spread:.04,pellets:1,gravity:0,color:0xff7841,splash:3.5},
 {name:tr('Bulwark · 重型榴弹','Bulwark · Heavy mortar'),tag:tr('抛物线 / 区域压制','Arcing / Area denial'),damage:1,reload:1,speed:15,range:18,spread:.04,pellets:1,gravity:7,color:0xffd07c,splash:4.5}
];
export const arenas=[{name:tr('碎石峡谷','Sandstone Gorge'),tag:'SANDSTONE / 01',description:tr('山脊、下切谷地和盘山土路，沿坡道登上高地绕行。','Ridges, a sunken gorge and winding dirt roads. Take the ramps to the high ground to flank.'),color:'#c4a070'},{name:tr('钢铁厂区','Iron Foundry'),tag:'FOUNDRY / 02',description:tr('高台、下沉作业区、跨区管线与堆料场，坡道串联不同高度。','Raised decks, a sunken work pit, pipelines and stockyards, linked by ramps between levels.'),color:'#77aeb5'},{name:tr('霜冻边境','Frostline Border'),tag:'FROSTLINE / 03',description:tr('高耸雪坡、弯曲低地与冻土道路，借山坡切断敌方视线。','Tall snow slopes, winding lowlands and frozen roads. Use the hills to break line of sight.'),color:'#b5d0e5'},{name:tr('熔岩火山口','Lava Caldera'),tag:'CALDERA / 04',description:tr('环形熔岩裂谷围住中央高地，四角山肩俯瞰火口，裂缝在夜色里发光。','A ring of lava rifts circles the central plateau; four shoulders overlook the crater, glowing in the night.'),color:'#e0703a'}];

export type DriverRecord={name:string;wins:number;games:number;kills:number;bestWave:number;best:number};
/** Every driver saved on this device, best first. Read straight from localStorage so it needs no network or sign-in. */
export function localDrivers(source:Pick<Storage,'getItem'|'key'|'length'>|undefined=storage):DriverRecord[]{
 const rows:DriverRecord[]=[];if(!source)return rows;
 try{for(let i=0;i<source.length;i++){const key=source.key(i);if(!key?.startsWith('arena-driver:'))continue;const name=key.slice(13);if(!name.trim())continue;const d=new ProfileStore({getItem:k=>source.getItem(k),setItem(){}},key).data;rows.push({name:name.slice(0,24),wins:d.wins,games:d.games,kills:d.kills,bestWave:d.bestWave,best:Number(source.getItem('arena-best:'+name))||0});}}catch{}
 return rows.sort((a,b)=>b.wins-a.wins||b.best-a.best||b.games-a.games||a.name.localeCompare(b.name));
}

/** Upgrade tuning: each level adds this share of the base value (armour and top speed over 5 levels, damage per shot over 10 weapon levels; see progression.ts weaponDamage). */
export const upgradeGain=[.08,.03,.04];
/** Decimals needed so that one upgrade level always changes the number shown (a small per-level step is never rounded away). */
export function statDigits(step:number){return step>=1?0:step>=.1?1:2;}
/** The value an upgrade card shows for stat `kind` (0 armour, 1 top speed, 2 damage per shot) at `level`. */
export function upgradeText(kind:number,base:number,level:number){return (base*(1+level*upgradeGain[kind])).toFixed(statDigits(base*upgradeGain[kind]));}
