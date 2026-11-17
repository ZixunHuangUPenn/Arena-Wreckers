import {tr} from './i18n';
// Progression rules: player level curve, what each level unlocks, weapon upgrade costs, battle salvage drops,
// daily/weekly tasks, achievements, vehicle mastery, challenges and the offline season. Pure data and pure
// functions only, so the numbers can be tuned and tested without touching the game loop or the menus.

export type Parts={common:number;precision:number;core:number};
export type PartKind=keyof Parts;
export const partKinds:PartKind[]=['common','precision','core'];
export const partNames:Record<PartKind,string>={common:tr('普通零件','Common parts'),precision:tr('精密零件','Precision parts'),core:tr('核心零件','Core parts')};
export const partShort:Record<PartKind,string>={common:tr('普通','Common'),precision:tr('精密','Precision'),core:tr('核心','Core')};
export const partColors:Record<PartKind,string>={common:'#d9dde2',precision:'#4fb3ff',core:'#ffc23d'};
export const noParts=():Parts=>({common:0,precision:0,core:0});

// ---------------------------------------------------------------- player level
export const MAX_LEVEL=30;
/** Experience needed to go from `level` to `level+1`. Level 1 → 2 is 200, as before. */
export const xpToNext=(level:number)=>150+50*level;
/** Total experience needed to reach `level`. */
export function xpForLevel(level:number){let total=0;for(let l=1;l<Math.min(level,MAX_LEVEL);l++)total+=xpToNext(l);return total;}
export function levelOf(xp:number){let level=1;while(level<MAX_LEVEL&&xp>=xpForLevel(level+1))level++;return level;}
/** Level, experience into the level, and the size of the level (0 when maxed). */
export function levelProgress(xp:number){const level=levelOf(xp),base=xpForLevel(level);if(level>=MAX_LEVEL)return {level,into:0,need:0,ratio:1};const need=xpToNext(level),into=Math.max(0,xp-base);return {level,into,need,ratio:Math.min(1,into/need)};}

// ---------------------------------------------------------------- unlocks
/** Level at which each vehicle (Kestrel, Grapnel, Arclight, Bombard, Bulwark) opens. */
export const carUnlockLevel=[1,1,4,8,12];
/** Level at which each mode opens. Three modes from the start, then one per level at 2, 3 and 4. */
export const modeUnlockLevel:Record<string,number>={horde:1,team:1,capture:1,elimination:2,ctf:3,charge:4};
/** Level at which each arena (Sandstone, Foundry, Frostline, Caldera) opens. */
export const arenaUnlockLevel=[1,2,3,4];

export type LevelReward={credits?:number;parts?:Partial<Parts>;paint?:number;title?:string;car?:number;mode?:string;arena?:number;feature?:string};
const titleNames:Record<string,string>={
 rookie:tr('新兵','Rookie'),seasoned:tr('老练车手','Seasoned driver'),road:tr('公路战士','Road warrior'),iron:tr('钢铁车魂','Iron soul'),legend:tr('废土传奇','Wasteland legend'),warlord:tr('竞技场霸主','Arena warlord'),
 hunter:tr('猎手','Hunter'),ace:tr('王牌','Ace'),survivor:tr('幸存者','Survivor'),flag:tr('夺旗专家','Flag runner'),scav:tr('拾荒大师','Master scavenger'),combo:tr('连杀狂人','Combo maniac'),
 star:tr('挑战之星','Challenge star'),s_bronze:tr('赛季 · 铜','Season · Bronze'),s_silver:tr('赛季 · 银','Season · Silver'),s_gold:tr('赛季 · 金','Season · Gold'),
 m0:tr('幽隼专家','Kestrel expert'),m1:tr('铁钩专家','Grapnel expert'),m2:tr('弧光专家','Arclight expert'),m3:tr('震岳专家','Bombard expert'),m4:tr('壁垒专家','Bulwark expert')};
export const titleName=(id:string)=>titleNames[id]??titleNames.rookie;
/** What each level gives. Applied automatically on level-up. */
export function levelReward(level:number):LevelReward{
 const fixed:Record<number,LevelReward>={
  2:{credits:300,paint:6,mode:'elimination',arena:1},
  3:{parts:{precision:5},feature:'tasks',mode:'ctf',arena:2},
  4:{car:2,mode:'charge',arena:3},
  5:{credits:500,parts:{core:1}},
  6:{paint:7,title:'seasoned'},
  7:{parts:{precision:8}},
  8:{car:3},
  9:{credits:800},
  10:{parts:{core:2},feature:'mastery'},
  11:{parts:{precision:10}},
  12:{car:4}};
 if(fixed[level])return fixed[level];
 if(level<=1||level>MAX_LEVEL)return {};
 const r:LevelReward={credits:500+Math.round((level-13)/17*500/50)*50};
 if(level%3===0)r.parts={core:1};
 if(level===15)r.title='road';if(level===20)r.title='iron';if(level===25)r.title='legend';if(level===30)r.title='warlord';
 return r;}
const modeLabel:Record<string,string>={horde:tr('单人生存','Survival'),team:tr('团队歼灭','Team deathmatch'),capture:tr('据点争夺','Capture points'),elimination:tr('单命对决','Elimination'),ctf:tr('夺旗','Capture the flag'),charge:tr('能量争夺','Power core')};
const arenaLabel=[tr('碎石峡谷','Sandstone Gorge'),tr('钢铁厂区','Iron Foundry'),tr('霜冻边境','Frostline Border'),tr('熔岩火山口','Lava Caldera')];
export const carLabel=[tr('幽隼 Kestrel','Kestrel'),tr('铁钩 Grapnel','Grapnel'),tr('弧光 Arclight','Arclight'),tr('震岳 Bombard','Bombard'),tr('壁垒 Bulwark','Bulwark')];
const paintLabel=[tr('极光蓝','Aurora blue'),tr('熔岩橙','Lava orange'),tr('幻影紫','Phantom violet'),tr('荒原白','Wasteland white'),tr('军团绿','Legion green'),tr('石墨黑','Graphite black'),tr('信号黄','Signal yellow'),tr('赛道红','Rally red')];
/** One line per item of a reward, for cards and lists. Unlocks first. */
export function rewardLines(r:LevelReward){const out:string[]=[];
 if(r.car!==undefined)out.push(tr(`解锁战车 · ${carLabel[r.car]}`,`New vehicle · ${carLabel[r.car]}`));
 if(r.mode)out.push(tr(`开放模式 · ${modeLabel[r.mode]}`,`New mode · ${modeLabel[r.mode]}`));
 if(r.arena!==undefined)out.push(tr(`开放地图 · ${arenaLabel[r.arena]}`,`New arena · ${arenaLabel[r.arena]}`));
 if(r.feature==='tasks')out.push(tr('开启每日 / 每周任务','Daily and weekly tasks'));
 if(r.feature==='mastery')out.push(tr('开启车辆熟练度奖励','Vehicle mastery rewards'));
 if(r.credits)out.push(`¢ ${r.credits}`);
 for(const k of partKinds)if(r.parts?.[k])out.push(`${partNames[k]} ×${r.parts[k]}`);
 if(r.paint!==undefined)out.push(tr(`涂装 · ${paintLabel[r.paint]}`,`Paint · ${paintLabel[r.paint]}`));
 if(r.title)out.push(tr(`称号 · ${titleName(r.title)}`,`Title · ${titleName(r.title)}`));
 return out;}

// ---------------------------------------------------------------- weapon upgrades
/** Cost of raising a weapon to level 1..10 (index 0 is level 1). Totals: 500 common, 93 precision, 17 core, ¢5300. */
export const weaponCosts:{parts:Parts;credits:number}[]=[
 [10,0,0,100],[15,0,0,150],[20,2,0,200],[30,4,0,300],[40,6,1,400],[50,8,1,500],[60,12,2,650],[75,16,3,800],[90,20,4,1000],[110,25,6,1200]
].map(([common,precision,core,credits])=>({parts:{common,precision,core},credits}));
export const WEAPON_MAX=10;
/** Decimals that keep a per-level gain visible: whole numbers for steps of 1+, one decimal from 0.1, else two. */
export const statDigits=(step:number)=>Math.abs(step)>=1?0:Math.abs(step)>=.1?1:2;
export const statText=(value:number,step:number)=>value.toFixed(statDigits(step));
export const weaponDamage=(level:number)=>1+.04*Math.max(0,Math.min(WEAPON_MAX,level));
export const weaponReload=(level:number)=>level>=3?.94:1;
export const weaponRange=(level:number)=>level>=6?1.5:0;
/** Level 9 signature mod, one per weapon (index = vehicle). */
export const signatureMods=[
 tr('持续开火 2 秒后射速 +15%','+15% fire rate after 2 s of continuous fire'),
 tr('弹丸 5 → 6 颗','Pellets 5 → 6'),
 tr('连续命中叠层上限 +2','+2 maximum hit stacks'),
 tr('溅射半径 3.5 → 4.2 米','Splash radius 3.5 → 4.2 m'),
 tr('落点留下 2 秒燃烧区','Leaves a 2 s fire patch where it lands')];
export function weaponNode(level:number,car:number){
 if(level===3)return tr('装填 −6%','Reload −6%');if(level===5)return tr('解锁速射型','Unlocks Rapid variant');if(level===6)return tr('射程 +1.5 米','Range +1.5 m');if(level===9)return signatureMods[car]??'';if(level===10)return tr('金色枪管','Gold barrel');return '';}

// ---------------------------------------------------------------- armour / engine
export const statCost=(level:number)=>150*(level+1);

// ---------------------------------------------------------------- salvage drops
export type FoeKind='normal'|'elite'|'boss';
export const difficultyDrop:Record<string,number>={easy:.8,normal:1,hard:1.3};
export const difficultyXp:Record<string,number>={easy:.8,normal:1,hard:1.25};
/** Parts in the salvage crate an enemy wreck leaves. `rand` returns 0..1. */
export function rollDrop(kind:FoeKind,rand:()=>number,mult=1,combo=0):Parts{
 const p=noParts();
 if(kind==='boss'){p.common=15;p.precision=3;p.core=1;}
 else if(kind==='elite'){p.common=6+Math.floor(rand()*3);if(rand()<.4)p.precision=1+Math.floor(rand()*2);}
 else{p.common=3+Math.floor(rand()*3);if(rand()<.1)p.precision=1;}
 if(combo>=3){p.common+=2;p.precision+=1;}
 p.common=Math.max(1,Math.round(p.common*mult));if(mult>1.2&&p.precision)p.precision=Math.round(p.precision*mult);
 return p;}
export const crateTier=(p:Parts):PartKind=>p.core?'core':p.precision?'precision':'common';
export const CRATE_LIFE=12,CRATE_RADIUS=2.5,CRATE_RECOVER=.5;
export type Rating='S'|'A'|'B'|'C';
export function rating(score:number,win:boolean):Rating{const s=score+(win?200:0);return s>=1500?'S':s>=900?'A':s>=400?'B':'C';}
export const ratingBonus:Record<Rating,Parts>={C:{common:5,precision:0,core:0},B:{common:10,precision:0,core:0},A:{common:15,precision:1,core:0},S:{common:25,precision:2,core:0}};
export function addParts(a:Parts,b:Partial<Parts>,scale=1){for(const k of partKinds)a[k]+=Math.floor((b[k]??0)*scale);return a;}

// ---------------------------------------------------------------- match summary
/** Everything a finished match reports to the profile. */
export type MatchSummary={score:number;win:boolean;kills:number;damage:number;wave:number;mode:string;arena:number;car:number;difficulty:string;deaths:number;
 parts:Parts;crates:number;flags:number;captures:number;bestCombo:number;seconds:number;trial?:boolean;challenge?:number};
export function matchXp(m:MatchSummary){const base=40+m.kills*15+(m.win?80:0)+Math.floor(m.damage/50)+m.captures*20+m.flags*40+(m.mode==='horde'?Math.max(0,m.wave)*15:0);return Math.round(base*(difficultyXp[m.difficulty]??1));}
export const matchCredits=(m:MatchSummary)=>50+Math.floor(m.score/5)+(m.win?150:0);

// ---------------------------------------------------------------- dates (local time, no server)
export const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
/** Monday of the date's week. */
export function weekKey(d:Date){const m=new Date(d.getFullYear(),d.getMonth(),d.getDate());m.setDate(m.getDate()-((m.getDay()+6)%7));return dayKey(m);}
export function hashString(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function seededRandom(seed:number){let s=seed>>>0||1;return ()=>{s=Math.imul(s^(s>>>15),2246822507)>>>0;s=Math.imul(s^(s>>>13),3266489909)>>>0;s^=s>>>16;return (s>>>0)/4294967296;};}

// ---------------------------------------------------------------- daily and weekly tasks
export type TaskDef={id:string;name:string;text:string;target:number;metric:(m:MatchSummary)=>number;reward:{credits?:number;parts?:Partial<Parts>}};
export const dailyPool:TaskDef[]=[
 {id:'d-crates',name:tr('废土清道夫','Scavenger'),text:tr('拾取 20 个回收箱','Pick up 20 salvage crates'),target:20,metric:m=>m.crates,reward:{credits:150,parts:{common:10}}},
 {id:'d-heavy',name:tr('远程压制','Heavy pressure'),text:tr('用震岳或壁垒造成 1500 伤害','Deal 1500 damage with Bombard or Bulwark'),target:1500,metric:m=>m.car>=3?m.damage:0,reward:{credits:200}},
 {id:'d-flag',name:tr('夺旗好手','Flag runner'),text:tr('夺旗模式交付 1 次','Deliver 1 flag in Capture the flag'),target:1,metric:m=>m.flags,reward:{parts:{precision:2}}},
 {id:'d-combo',name:tr('连杀','Chain wrecks'),text:tr('单局打出 3 连杀','Get a 3-wreck combo in one match'),target:1,metric:m=>m.bestCombo>=3?1:0,reward:{credits:200,parts:{precision:1}}},
 {id:'d-win',name:tr('首胜','First win'),text:tr('赢得 1 场战斗','Win 1 battle'),target:1,metric:m=>m.win?1:0,reward:{credits:150,parts:{common:8}}},
 {id:'d-kills',name:tr('猎杀','Hunt'),text:tr('击毁 8 辆敌车','Wreck 8 enemy cars'),target:8,metric:m=>m.kills,reward:{credits:150,parts:{common:12}}},
 {id:'d-damage',name:tr('火力全开','All guns'),text:tr('造成 3000 伤害','Deal 3000 damage'),target:3000,metric:m=>m.damage,reward:{credits:200}},
 {id:'d-capture',name:tr('据点之主','Point holder'),text:tr('占领 3 个据点','Capture 3 points'),target:3,metric:m=>m.captures,reward:{parts:{common:10,precision:1}}},
 {id:'d-waves',name:tr('守住防线','Hold the line'),text:tr('单人生存累计撑过 4 波','Survive 4 waves in Survival'),target:4,metric:m=>m.mode==='horde'?m.wave:0,reward:{credits:200,parts:{common:6}}},
 {id:'d-matches',name:tr('出勤','Clock in'),text:tr('完成 3 场战斗','Finish 3 battles'),target:3,metric:()=>1,reward:{credits:250}},
 {id:'d-light',name:tr('轻装上阵','Travel light'),text:tr('用幽隼或铁钩击毁 5 辆敌车','Wreck 5 cars with Kestrel or Grapnel'),target:5,metric:m=>m.car<=1?m.kills:0,reward:{credits:150,parts:{common:8}}},
 {id:'d-clean',name:tr('零阵亡','Untouchable'),text:tr('一局不阵亡并获胜','Win a match without being wrecked'),target:1,metric:m=>m.win&&m.deaths===0?1:0,reward:{credits:250,parts:{precision:1}}}];
export const weeklyPool:TaskDef[]=[
 {id:'w-survive',name:tr('生存专家','Survival expert'),text:tr('困难难度通关单人生存 6 波','Clear all 6 Survival waves on Hard'),target:1,metric:m=>m.mode==='horde'&&m.win&&m.difficulty==='hard'?1:0,reward:{parts:{core:2}}},
 {id:'w-variety',name:tr('全能车手','All-rounder'),text:tr('用 3 辆不同的车各赢 1 局','Win with 3 different vehicles'),target:3,metric:()=>0,reward:{credits:600,parts:{core:1}}},
 {id:'w-wins',name:tr('连胜周','Winning week'),text:tr('赢得 10 场战斗','Win 10 battles'),target:10,metric:m=>m.win?1:0,reward:{credits:800,parts:{precision:4}}},
 {id:'w-crates',name:tr('回收狂潮','Salvage rush'),text:tr('拾取 120 个回收箱','Pick up 120 salvage crates'),target:120,metric:m=>m.crates,reward:{parts:{common:40,precision:3}}},
 {id:'w-kills',name:tr('百车斩','Hundred wrecks'),text:tr('击毁 60 辆敌车','Wreck 60 enemy cars'),target:60,metric:m=>m.kills,reward:{credits:700,parts:{core:1}}},
 {id:'w-objective',name:tr('目标优先','Objectives first'),text:tr('占点或交付旗帜共 12 次','Capture points or deliver flags 12 times'),target:12,metric:m=>m.captures+m.flags,reward:{credits:500,parts:{precision:4}}},
 {id:'w-challenge',name:tr('挑战者','Challenger'),text:tr('在挑战关卡中获得 5 颗星','Earn 5 stars in challenges'),target:5,metric:()=>0,reward:{credits:500,parts:{core:1}}},
 {id:'w-damage',name:tr('重炮周','Heavy week'),text:tr('累计造成 20000 伤害','Deal 20000 damage'),target:20000,metric:m=>m.damage,reward:{credits:600,parts:{precision:3}}}];
export const DAILY_COUNT=3,WEEKLY_COUNT=5,REROLL_COST=100;
export function pickTasks(pool:TaskDef[],count:number,key:string,exclude:string[]=[]){const rand=seededRandom(hashString(key)),list=pool.filter(t=>!exclude.includes(t.id));for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list.slice(0,count).map(t=>t.id);}
export const taskDef=(id:string)=>dailyPool.find(t=>t.id===id)??weeklyPool.find(t=>t.id===id);

// ---------------------------------------------------------------- achievements (11 lines × bronze/silver/gold)
export type StatKey='games'|'kills'|'wins'|'damage'|'hordeClears'|'crates'|'flags'|'captures'|'level'|'weaponLevels'|'bestCombo';
export type Achievement={id:string;line:string;tier:0|1|2;name:string;text:string;stat:StatKey;target:number;reward:{credits?:number;parts?:Partial<Parts>;title?:string}};
const lines:[string,StatKey,string,string,[number,number,number],[string,string,string]][]=[
 ['games','games',tr('出勤记录','Attendance'),tr('完成 {n} 场战斗','Finish {n} battles'),[1,10,100],['first','regular','games-3']],
 ['kills','kills',tr('猎手之路','Hunter'),tr('累计击毁 {n} 辆敌车','Wreck {n} enemy cars'),[25,100,500],['hunter','ace','kills-3']],
 ['wins','wins',tr('常胜车手','Winner'),tr('赢得 {n} 场战斗','Win {n} battles'),[5,25,100],['veteran','wins-2','wins-3']],
 ['damage','damage',tr('重火力','Heavy hitter'),tr('累计造成 {n} 点伤害','Deal {n} damage in total'),[5000,25000,100000],['wrecker','damage-2','damage-3']],
 ['horde','hordeClears',tr('独行不败','Lone survivor'),tr('通关单人生存 {n} 次','Clear Survival {n} times'),[1,5,20],['survivor','horde-2','horde-3']],
 ['crates','crates',tr('拾荒者','Scavenger'),tr('拾取 {n} 个回收箱','Pick up {n} salvage crates'),[50,300,1000],['crates-1','crates-2','crates-3']],
 ['flags','flags',tr('夺旗手','Flag runner'),tr('交付 {n} 面旗帜','Deliver {n} flags'),[1,10,40],['flags-1','flags-2','flags-3']],
 ['captures','captures',tr('据点指挥','Point commander'),tr('占领 {n} 个据点','Capture {n} points'),[5,30,100],['captures-1','captures-2','captures-3']],
 ['level','level',tr('车手生涯','Career'),tr('达到等级 {n}','Reach level {n}'),[5,15,30],['level-1','level-2','level-3']],
 ['forge','weaponLevels',tr('军械师','Armourer'),tr('武器等级合计 {n}','Total weapon levels {n}'),[10,25,50],['forge-1','forge-2','forge-3']],
 ['combo','bestCombo',tr('连杀狂人','Combo maniac'),tr('单局最高连杀 {n}','Best combo {n}'),[3,5,8],['combo-1','combo-2','combo-3']]];
const lineTitles:Record<string,string>={kills:'ace',horde:'survivor',flags:'flag',crates:'scav',combo:'combo',wins:'hunter'};
export const achievements:Achievement[]=lines.flatMap(([line,stat,name,text,targets,ids])=>targets.map((target,tier)=>({id:ids[tier],line,tier:tier as 0|1|2,name:`${name} ${['I','II','III'][tier]}`,stat,target,
 reward:tier===0?{credits:[150,350,500,400,800,200,200,200,300,300,200][lines.findIndex(l=>l[0]===line)]}:tier===1?{credits:600,parts:{precision:3}}:{credits:1200,parts:{core:2},title:lineTitles[line]},
 text:text.replace('{n}',target.toLocaleString())})));

// ---------------------------------------------------------------- vehicle mastery
/** Mastery experience needed for levels 1..10. */
export const masteryThresholds=[0,200,500,900,1400,2000,2700,3500,4400,5400];
export const masteryOf=(mxp:number)=>{let l=1;while(l<10&&mxp>=masteryThresholds[l])l++;return l;};
export function masteryProgress(mxp:number){const level=masteryOf(mxp);if(level>=10)return {level,ratio:1,into:0,need:0};const base=masteryThresholds[level-1],need=masteryThresholds[level]-base;return {level,into:mxp-base,need,ratio:(mxp-base)/need};}
export function masteryReward(level:number,car:number):LevelReward&{perk?:string}{
 switch(level){case 2:return {credits:300};case 3:return {perk:tr('技能冷却 −1 秒','Skill cooldown −1 s')};case 4:return {parts:{precision:5}};case 5:return {perk:tr('车体强化 · 生命 +5%','Hull plating · +5% health')};
  case 6:return {perk:tr('解锁重击型武器','Unlocks Heavy weapon variant')};case 7:return {credits:500,parts:{core:1}};case 8:return {title:'m'+car};case 9:return {credits:800};case 10:return {perk:tr('技能改型二选一','Choose a skill mod')};}return {};}
export const masteryCooldown=(level:number)=>level>=3?1:0;
export const masteryHp=(level:number)=>level>=5?1.05:1;
/** Mastery 10 skill mods per vehicle: [extended effect, quick recharge]. */
export const skillMods:[string,string][]=[
 [tr('长效迷彩 · 隐身 +1.5 秒','Long cloak · +1.5 s cloak'),tr('速返 · 冷却 −3 秒','Quick return · −3 s cooldown')],
 [tr('重钩 · 射程 +4 米、伤害 +10','Heavy hook · +4 m range, +10 damage'),tr('速返 · 冷却 −3 秒','Quick return · −3 s cooldown')],
 [tr('持久超载 · 超载 +1.5 秒','Long overdrive · +1.5 s'),tr('速返 · 冷却 −3 秒','Quick return · −3 s cooldown')],
 [tr('加长弹幕 · 炮弹 6 → 8 发','Long barrage · 6 → 8 shells'),tr('速返 · 冷却 −3 秒','Quick return · −3 s cooldown')],
 [tr('厚盾 · 力场 +2 秒','Thick dome · +2 s dome'),tr('速返 · 冷却 −3 秒','Quick return · −3 s cooldown')]];
/** Weapon variants: 0 standard (always), 1 rapid (weapon level 5), 2 heavy (mastery 6). */
export const variantUnlocked=(variant:number,weaponLevel:number,mastery:number)=>variant===0||variant===1&&weaponLevel>=5||variant===2&&mastery>=6;

// ---------------------------------------------------------------- challenges
export type StarGoal={kind:'win'|'deaths'|'kills'|'time'|'damage'|'score'|'wave'|'flags'|'captures';value:number};
export type Challenge={id:number;name:string;mode:string;arena:number;difficulty:'easy'|'normal'|'hard';car?:number;level:number;goals:[StarGoal,StarGoal,StarGoal]};
const C=(name:string,mode:string,arena:number,difficulty:'easy'|'normal'|'hard',level:number,g2:StarGoal,g3:StarGoal,car?:number)=>({name,mode,arena,difficulty,level,car,goals:[{kind:'win',value:1},g2,g3] as [StarGoal,StarGoal,StarGoal]});
export const challenges:Challenge[]=[
 C(tr('初次上路','First drive'),'team',0,'easy',1,{kind:'kills',value:4},{kind:'deaths',value:0}),
 C(tr('铁钩开道','Hook and drag'),'team',0,'normal',1,{kind:'kills',value:6},{kind:'time',value:150},1),
 C(tr('幽影突袭','Shadow raid'),'team',0,'normal',1,{kind:'kills',value:6},{kind:'deaths',value:1},0),
 C(tr('守住据点','Hold the points'),'capture',0,'normal',1,{kind:'captures',value:3},{kind:'deaths',value:1}),
 C(tr('三波防线','Three waves'),'horde',0,'easy',1,{kind:'wave',value:6},{kind:'deaths',value:0}),
 C(tr('厂区单挑','Foundry duel'),'elimination',1,'normal',2,{kind:'kills',value:2},{kind:'deaths',value:0}),
 C(tr('钢铁车阵','Steel convoy'),'team',1,'normal',2,{kind:'score',value:1000},{kind:'time',value:140}),
 C(tr('冰原夺旗','Frozen flag'),'ctf',2,'normal',3,{kind:'flags',value:1},{kind:'flags',value:2}),
 C(tr('雪坡伏击','Snow ambush'),'team',2,'normal',3,{kind:'kills',value:8},{kind:'deaths',value:1}),
 C(tr('弧光过载','Arc overload'),'team',1,'normal',4,{kind:'score',value:1200},{kind:'kills',value:8},2),
 C(tr('火山口能核','Caldera core'),'charge',3,'normal',4,{kind:'kills',value:4},{kind:'deaths',value:1}),
 C(tr('熔岩生存','Lava survival'),'horde',3,'normal',4,{kind:'wave',value:6},{kind:'deaths',value:0}),
 C(tr('据点拉锯','Point tug-of-war'),'capture',2,'hard',5,{kind:'captures',value:4},{kind:'deaths',value:2}),
 C(tr('孤胆夺旗','Lone flag'),'ctf',1,'hard',6,{kind:'flags',value:2},{kind:'deaths',value:1}),
 C(tr('徐进弹幕','Creeping fire'),'team',2,'normal',8,{kind:'score',value:1600},{kind:'kills',value:8},3),
 C(tr('困难生存','Hard survival'),'horde',1,'hard',8,{kind:'wave',value:6},{kind:'deaths',value:0}),
 C(tr('铁壁推进','Iron wall'),'capture',3,'hard',12,{kind:'captures',value:4},{kind:'score',value:1200},4),
 C(tr('火山决斗','Caldera duel'),'elimination',3,'hard',10,{kind:'kills',value:3},{kind:'deaths',value:0}),
 C(tr('快攻歼灭','Blitz'),'team',3,'hard',12,{kind:'time',value:150},{kind:'deaths',value:1}),
 C(tr('终极考验','Final exam'),'horde',2,'hard',15,{kind:'wave',value:6},{kind:'deaths',value:0})
].map((c,id)=>({...c,id}));
export function goalText(g:StarGoal){switch(g.kind){case 'win':return tr('获胜','Win');case 'deaths':return g.value?tr(`获胜且阵亡不超过 ${g.value} 次`,`Win with at most ${g.value} deaths`):tr('获胜且不阵亡','Win without dying');case 'kills':return tr(`击毁 ${g.value} 辆敌车`,`Wreck ${g.value} cars`);case 'time':return tr(`${Math.floor(g.value/60)}:${String(g.value%60).padStart(2,'0')} 内获胜`,`Win within ${Math.floor(g.value/60)}:${String(g.value%60).padStart(2,'0')}`);case 'damage':return tr(`造成 ${g.value} 伤害`,`Deal ${g.value} damage`);case 'score':return tr(`获得 ${g.value} 积分`,`Earn ${g.value} points`);case 'wave':return tr(`撑过全部 ${g.value} 波`,`Survive all ${g.value} waves`);case 'flags':return tr(`亲自交付 ${g.value} 面旗`,`Deliver ${g.value} flags yourself`);case 'captures':return tr(`亲自占领 ${g.value} 个据点`,`Capture ${g.value} points yourself`);}}
export function goalMet(g:StarGoal,m:MatchSummary){switch(g.kind){case 'win':return m.win;case 'deaths':return m.win&&m.deaths<=g.value;case 'kills':return m.kills>=g.value;case 'time':return m.win&&m.seconds<=g.value;case 'damage':return m.damage>=g.value;case 'score':return m.score>=g.value;case 'wave':return m.mode==='horde'&&m.win;case 'flags':return m.flags>=g.value;case 'captures':return m.captures>=g.value;}}
/** Stars earned: a star needs a win, the other goals each add one. */
export function starsFor(c:Challenge,m:MatchSummary){if(!m.win)return 0;return 1+(goalMet(c.goals[1],m)?1:0)+(goalMet(c.goals[2],m)?1:0);}
export const STAR_REWARD=100;
export const starMilestones:{stars:number;reward:{credits?:number;parts?:Partial<Parts>;title?:string}}[]=[
 {stars:10,reward:{parts:{core:1}}},{stars:20,reward:{parts:{core:2}}},{stars:30,reward:{parts:{core:2},credits:1000}},{stars:40,reward:{parts:{core:3}}},{stars:50,reward:{parts:{core:3},credits:2000}},{stars:60,reward:{parts:{core:5},title:'star'}}];

// ---------------------------------------------------------------- offline season
/** Seasons are six weeks long, counted in local time from Monday 16 November 2026. */
export const SEASON_EPOCH=[2026,10,16] as const,SEASON_DAYS=42,SEASON_TIERS=30,SEASON_TIER_XP=300;
export function seasonOf(d:Date){const epoch=new Date(SEASON_EPOCH[0],SEASON_EPOCH[1],SEASON_EPOCH[2]),day=Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()-epoch.getTime())/864e5+.5),id=Math.max(1,Math.floor(day/SEASON_DAYS)+1),start=new Date(epoch);start.setDate(start.getDate()+(id-1)*SEASON_DAYS);const end=new Date(start);end.setDate(end.getDate()+SEASON_DAYS);return {id,featured:(id-1)%4,daysLeft:Math.max(0,Math.ceil((end.getTime()-d.getTime())/864e5)),start,end};}
export const seasonNames=[tr('碎石季','Sandstone season'),tr('铸铁季','Foundry season'),tr('冻土季','Frostline season'),tr('熔岩季','Caldera season')];
export function seasonReward(tier:number):LevelReward{if(tier===10)return {title:'s_bronze',parts:{core:1}};if(tier===20)return {title:'s_silver',parts:{core:2}};if(tier===30)return {title:'s_gold',parts:{core:3},credits:2000};if(tier%5===0)return {parts:{core:1}};return [{credits:200},{parts:{common:10}},{credits:300},{parts:{precision:2}}][tier%4];}
export const seasonTier=(sxp:number)=>Math.min(SEASON_TIERS,Math.floor(sxp/SEASON_TIER_XP));
/** Featured arena of the season drops twice the common parts. */
export const FEATURED_DROP=2;

// ---------------------------------------------------------------- save code
export function checksum(text:string){return hashString(text).toString(36);}
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8(text:string){const out:number[]=[];const raw=unescape(encodeURIComponent(text));for(let i=0;i<raw.length;i++)out.push(raw.charCodeAt(i));return out;}
function toBase64(bytes:number[]){let s='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);s+=B64[n>>18&63]+B64[n>>12&63]+(i+1<bytes.length?B64[n>>6&63]:'=')+(i+2<bytes.length?B64[n&63]:'=');}return s;}
function fromBase64(text:string){const clean=text.replace(/=+$/,''),bytes:number[]=[];let bits=0,acc=0;for(const ch of clean){const v=B64.indexOf(ch);if(v<0)throw new Error('bad');acc=(acc<<6)|v;bits+=6;if(bits>=8){bits-=8;bytes.push((acc>>bits)&255);}}return bytes;}
/** Save code: "AW1.<base64 of the JSON save>.<checksum>". Copy-paste safe, survives typos by failing the checksum. */
export function encodeSave(json:string){const body=toBase64(utf8(json));return `AW1.${body}.${checksum(body)}`;}
export function decodeSave(code:string){const parts=code.trim().replace(/\s+/g,'').split('.');if(parts.length!==3||parts[0]!=='AW1'||checksum(parts[1])!==parts[2])return null;try{return decodeURIComponent(escape(String.fromCharCode(...fromBase64(parts[1]))));}catch{return null;}}
