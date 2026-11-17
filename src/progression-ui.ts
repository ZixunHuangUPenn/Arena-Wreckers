import {tr} from './i18n';
import {assetPath} from './paths';
import {levelProgress,levelReward,rewardLines,MAX_LEVEL,partKinds,partNames,partShort,partColors,taskDef,REROLL_COST,achievements,masteryProgress,masteryReward,skillMods,carLabel,challenges,goalText,starMilestones,seasonOf,seasonNames,seasonTier,seasonReward,SEASON_TIERS,SEASON_TIER_XP,titleName,FEATURED_DROP,carUnlockLevel,modeUnlockLevel,arenaUnlockLevel,WEAPON_MAX,type Parts,type PartKind,type LevelReward} from './progression';
import {modeNames,arenas,type ProfileStore,type RewardReport} from './profile';
// Menu markup for everything progression adds: the top-bar rank, the account details page, tasks, achievements,
// mastery, season, save backup, challenges and the match report's rewards. Returns HTML strings only.

const esc=(t:string)=>t.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
export const partIcon=(k:string)=>`<i class="part-icon part-${k}" style="--part:${partColors[k as keyof Parts]}"></i>`;
export const creditIcon='<i class="credit-icon">¢</i>';
export function partsInline(p:Partial<Parts>,zero=false){return partKinds.filter(k=>zero||(p[k]??0)>0).map(k=>`<span class="part-chip">${partIcon(k)}<b>${(p[k]??0).toLocaleString()}</b><small>${partShort[k]}</small></span>`).join('');}
function rewardChips(r:{credits?:number;parts?:Partial<Parts>;title?:string}){return `${r.credits?`<span class="part-chip">${creditIcon}<b>${r.credits}</b></span>`:''}${partsInline(r.parts??{})}${r.title?`<span class="part-chip title-chip">✦ ${titleName(r.title)}</span>`:''}`;}


// ---------------------------------------------------------------- module pages
/** Every progression module is its own page; the tab strip above them switches between modules. */
export const hubPages=['career','tasks','achievements','mastery','season','warehouse','challenges','leaderboard'] as const;
export const hubIcons:Record<string,string>={
 career:'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
 tasks:'<path d="M9 5h10M9 12h10M9 19h10M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2"/>',
 achievements:'<path d="M7 4h10v3a5 5 0 0 1-10 0zM5 5H3v1a4 4 0 0 0 4 4M19 5h2v1a4 4 0 0 1-4 4M10 13h4v3h3v3H7v-3h3z"/>',
 mastery:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 season:'<path d="M5 21V4M5 5h12l-2.5 3.5L17 12H5"/>',
 warehouse:'<path d="M3 9l9-5 9 5v11H3z"/><path d="M8 20v-7h8v7M8 16.5h8"/>',
 challenges:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
 leaderboard:'<path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6"/>'};
const hubNames=():Record<string,string>=>({career:tr('账户','Account'),tasks:tr('任务','Tasks'),achievements:tr('成就','Achievements'),mastery:tr('熟练度','Mastery'),season:tr('赛季','Season'),warehouse:tr('仓库','Warehouse'),challenges:tr('挑战','Challenges'),leaderboard:tr('排行榜','Leaderboard')});
const svg=(id:string,size=15)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${hubIcons[id]??''}</svg>`;
/** Tab strip shown above every module page. Each tab carries its own red dot (`data-dot`). */
export function hubTabs(){const names=hubNames();return hubPages.map(id=>`<button data-nav="${id}" data-hub="${id}" title="${names[id]}">${svg(id)}<span>${names[id]}</span><em data-dot="${id}" hidden></em></button>`).join('');}
/** How many rewards wait in each module. Only modules with something to claim get a red dot. */
export function claimDots(store:ProfileStore):Record<string,number>{return {tasks:store.claimableTasks().length,achievements:store.claimableAchievements().length};}
function hubHead(code:string,title:string,note:string,side=''){return `<div class="hub-head"><div><small>${code}</small><strong>${title}</strong><span>${note}</span></div>${side?`<div class="hub-side">${side}</div>`:''}</div>`;}
const claimAllButton=(kind:string,n:number)=>n>1?`<button class="metal-button claim-all" data-claim-all="${kind}">${tr(`全部领取 (${n})`,`Claim all (${n})`)}</button>`:'';

/** Top bar: level badge and an unnumbered progress bar (exact numbers live in the account page). */
export function rankMarkup(store:ProfileStore){const p=levelProgress(store.data.xp);return {level:String(p.level),ratio:p.ratio,title:titleName(store.data.title)};}

export function accountHero(store:ProfileStore){const d=store.data,p=levelProgress(d.xp);
 return {level:p.level,ratio:p.ratio,text:p.level>=MAX_LEVEL?tr(`经验 ${d.xp.toLocaleString()} · 已满级`,`XP ${d.xp.toLocaleString()} · Max level`):tr(`经验 ${p.into} / ${p.need} · 距 LEVEL ${p.level+1} 还差 ${p.need-p.into}`,`XP ${p.into} / ${p.need} · ${p.need-p.into} to LEVEL ${p.level+1}`),
  wallet:`<span class="wallet-line">${creditIcon}<b>${d.coins.toLocaleString()}</b><small>${tr('信用点','Credits')}</small></span>${partKinds.map(k=>`<span class="wallet-line">${partIcon(k)}<b>${d.parts[k].toLocaleString()}</b><small>${partNames[k]}</small></span>`).join('')}`};}

/** The next levels and what they bring; unlocks are highlighted. */
export function levelRoad(store:ProfileStore){const now=store.level,rows:string[]=[];for(let l=now+1;l<=Math.min(MAX_LEVEL,now+4);l++){const r=levelReward(l),lines=rewardLines(r),unlock=r.car!==undefined||r.mode||r.arena!==undefined||r.feature;rows.push(`<div class="road-step${unlock?' unlock':''}"><b>LV ${l}</b><span>${lines.map(esc).join(' · ')||'—'}</span></div>`);}
 return rows.join('')||`<p class="lb-empty">${tr('已达到最高等级','Top level reached')}</p>`;}

export function statsGrid(store:ProfileStore){const d=store.data;return ([[tr('完成对局','Matches'),d.games],[tr('获胜','Wins'),d.wins],[tr('累计击毁','Total kills'),d.kills],[tr('累计伤害','Damage'),Math.round(d.damage).toLocaleString()],[tr('生存波次','Best wave'),`${d.bestWave}/6`],[tr('回收箱','Crates'),d.crates],[tr('交付旗帜','Flags'),d.flags],[tr('占领据点','Points'),d.captures],[tr('最高连杀','Best combo'),d.bestCombo],[tr('挑战星数','Stars'),`${store.totalStars()}/${challenges.length*3}`]] as [string,string|number][]).map(([label,value])=>`<div class="career-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');}

export function seasonCard(store:ProfileStore,now=new Date()){const s=seasonOf(now),d=store.data,tier=seasonTier(d.season.xp),into=d.season.xp-tier*SEASON_TIER_XP,next=Math.min(SEASON_TIERS,tier+1);
 const track=Array.from({length:SEASON_TIERS},(_,i)=>{const t=i+1,big=t%5===0;return `<i class="${t<=tier?'on':''}${big?' big':''}" title="${t}: ${esc(rewardLines(seasonReward(t)).join(' · '))}"></i>`;}).join('');
 const cells=Array.from({length:SEASON_TIERS},(_,i)=>{const t=i+1,r=seasonReward(t);return `<div class="season-cell${t<=tier?' on':''}${t===next&&tier<SEASON_TIERS?' next':''}${r.title?' big':''}"><b>${t}</b><span>${esc(rewardLines(r).join(' · '))||'—'}</span>${t<=tier?'<i>✓</i>':''}</div>`;}).join('');
 return hubHead(`SEASON ${s.id}`,seasonNames[s.featured],tr(`剩余 ${s.daysLeft} 天 · 本季主题地图「${arenas[s.featured].name}」普通零件掉落 ×${FEATURED_DROP}`,`${s.daysLeft} days left · Featured arena “${arenas[s.featured].name}” drops ×${FEATURED_DROP} common parts`),`<div class="season-tier"><b>${tier}</b><small>/ ${SEASON_TIERS}</small></div>`)+
 `<div class="season-card"><div class="season-track">${track}</div><p class="season-next">${tier>=SEASON_TIERS?tr('本赛季奖励已全部领取','Every reward this season is yours'):tr(`第 ${next} 级 · ${into} / ${SEASON_TIER_XP} 赛季经验 · 奖励：`,`Tier ${next} · ${into} / ${SEASON_TIER_XP} season XP · Reward: `)+(tier<SEASON_TIERS?esc(rewardLines(seasonReward(next)).join(' · ')):'')}</p><small class="field-note">${tr('赛季经验与对局经验相同，升级奖励自动发放。赛季结束后等级清零，称号永久保留。','Season XP equals match XP and tier rewards arrive automatically. Tiers reset when the season ends; titles stay.')}</small></div>
 <div class="hub-card-head solo"><b>${tr('赛季奖励一览','Season rewards')}</b><small>${tr('到达等级后自动发放','Granted when the tier is reached')}</small></div><div class="season-cells">${cells}</div>`;}

function taskRow(store:ProfileStore,id:string,progress:number,claimed:boolean,daily:boolean){const def=taskDef(id);if(!def)return '';const done=progress>=def.target,reroll=daily&&!claimed&&!store.data.daily.rerolled;
 return `<div class="task${done?' done':''}${claimed?' claimed':''}"><div class="task-main"><h3>${def.name}</h3><p>${def.text}</p><div class="progress-track"><i style="width:${Math.min(100,progress/def.target*100)}%"></i></div><small>${Math.min(progress,def.target).toLocaleString()} / ${def.target.toLocaleString()}</small></div><div class="task-side"><span class="task-reward">${rewardChips(def.reward)}</span>${claimed?`<button class="metal-button" disabled>${tr('已领取','Claimed')}</button>`:done?`<button class="metal-button" data-task-claim="${id}">${tr('领取','Claim')}</button>`:reroll?`<button class="ghost-button small" data-task-reroll="${id}" title="${tr('每天可更换 1 次','One swap per day')}">${tr(`更换 ¢${REROLL_COST}`,`Swap ¢${REROLL_COST}`)}</button>`:''}</div></div>`;}
function untilText(ms:number){const h=Math.max(0,Math.floor(ms/3.6e6)),m=Math.max(0,Math.floor(ms%3.6e6/6e4));if(h>=24)return tr(`${Math.floor(h/24)} 天 ${h%24} 小时后刷新`,`Resets in ${Math.floor(h/24)}d ${h%24}h`);return tr(`${h} 小时 ${m} 分后刷新`,`Resets in ${h}h ${m}m`);}
/** Daily and weekly tasks, each in its own framed box with its own colour, reset countdown and count. */
export function taskBoard(store:ProfileStore,now=new Date()){const ready=store.claimableTasks().length,head=hubHead('TASKS',tr('任务','Tasks'),tr('完成后回到这里领取奖励 · 每日任务可花信用点更换 1 个','Come back here to claim rewards · One daily task can be swapped for credits'),claimAllButton('tasks',ready));
 if(!store.tasksOpen())return head+`<p class="lb-empty locked-note">🔒 ${tr('达到 LEVEL 3 开启每日 / 每周任务','Daily and weekly tasks open at LEVEL 3')}</p>`;const d=store.data;
 const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime(),monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()+7-((now.getDay()+6)%7)).getTime();
 const box=(kind:'daily'|'weekly',list:{id:string;progress:number;claimed:boolean}[])=>{const daily=kind==='daily',done=list.filter(t=>t.progress>=(taskDef(t.id)?.target??1e9)).length;
  return `<section class="task-box ${kind}"><header><i class="task-box-icon">${daily?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/></svg>'}</i><div class="task-box-title"><small>${daily?'DAILY':'WEEKLY'}</small><strong>${daily?tr('每日任务','Daily tasks'):tr('每周任务','Weekly tasks')}</strong></div><span class="task-box-count"><b>${done}</b>/${list.length}</span><em class="task-box-timer">${daily?tr('每天 0 点刷新','Resets at midnight'):tr('每周一刷新','Resets on Monday')} · ${untilText((daily?midnight:monday)-now.getTime())}</em></header>
  <div class="task-list">${list.map(t=>taskRow(store,t.id,t.progress,t.claimed,daily)).join('')}</div><footer>${daily?`<span class="${d.daily.firstWin?'on':''}">${d.daily.firstWin?'✓':'○'} ${tr('每日首胜经验 ×2','First win of the day: double XP')}${d.daily.firstWin?tr(' · 今日已完成',' · Done today'):''}</span>`:`<span>${tr('周任务目标更大，奖励含精密和核心零件','Weekly goals are bigger and pay precision and core parts')}</span>`}</footer></section>`;};
 return head+`<div class="task-board">${box('daily',d.daily.tasks)}${box('weekly',d.weekly.tasks)}</div>`;}

export function achievementBoard(store:ProfileStore){const d=store.data,lines=[...new Set(achievements.map(a=>a.line))],got=achievements.filter(a=>d.claims.includes(a.id)).length,ready=store.claimableAchievements().length;
 const cards=lines.map(line=>{const tiers=achievements.filter(a=>a.line===line),value=store.statValue(tiers[0].stat),current=tiers.find(a=>!d.claims.includes(a.id))??tiers[2],all=tiers.every(a=>d.claims.includes(a.id)),ready=!d.claims.includes(current.id)&&value>=current.target;
  return `<div class="milestone tiered${ready?' ready':''}${all?' complete':''}"><div class="medals">${tiers.map(a=>`<i class="medal t${a.tier}${d.claims.includes(a.id)?' on':''}" title="${esc(a.name)}"></i>`).join('')}</div><h3>${current.name}</h3><p>${current.text} · ${Math.min(value,current.target).toLocaleString()}/${current.target.toLocaleString()}</p><span class="task-reward">${rewardChips(current.reward)}</span><button class="metal-button" data-claim="${current.id}" ${all||!ready?'disabled':''}>${all?tr('全部完成','All done'):d.claims.includes(current.id)?tr('已领取','Claimed'):ready?tr('领取','Claim'):tr('进行中','In progress')}</button><div class="progress-track"><i style="width:${Math.min(100,value/current.target*100)}%"></i></div></div>`;}).join('');
 return hubHead('ACHIEVEMENTS',tr('成就','Achievements'),tr('每项分铜、银、金三档，达成后在这里领取','Bronze, silver and gold for each; claim them here once reached'),`${claimAllButton('achievements',ready)}<div class="hub-count"><b>${got}</b><small>/ ${achievements.length}</small></div>`)+`<div class="milestones">${cards}</div>`;}

export function masteryBoard(store:ProfileStore){const d=store.data,active=store.level>=10;
 return hubHead('MASTERY',tr('车辆熟练度','Vehicle mastery'),tr('开哪辆车打仗，哪辆车就积累熟练度；满 10 级可选技能改型','Each car gains mastery from the matches you drive it in; level 10 opens a skill mod'))+`<div class="mastery-board">${active?'':`<p class="lb-empty locked-note">🔒 ${tr('熟练度经验一直在累计，LEVEL 10 起奖励和效果生效','Mastery XP builds up all along; rewards and perks switch on at LEVEL 10')}</p>`}`+d.mastery.map((mxp,car)=>{const p=masteryProgress(mxp),next=p.level<10?masteryReward(p.level+1,car):null,mod=d.skillMod[car],can=store.masteryLevel(car)>=10;
  return `<div class="mastery-row"><div class="mastery-level"><b>${p.level}</b><small>/10</small></div><div class="mastery-main"><strong>${carLabel[car]}</strong><div class="progress-track"><i style="width:${p.ratio*100}%"></i></div><small>${p.level>=10?tr('熟练度已满','Mastered'):tr(`${p.into} / ${p.need} · 下一级：`,`${p.into} / ${p.need} · Next: `)+(next?esc([...rewardLines(next),...(next.perk?[next.perk]:[])].join(' · ')):'')}</small></div>
  <div class="mod-pick">${skillMods[car].map((label,k)=>`<button class="mod${mod===k+1?' selected':''}" data-skill-mod="${car}:${k+1}" ${can?'':'disabled'} title="${esc(label)}">${esc(label)}</button>`).join('')}</div></div>`;}).join('')+'</div>';}

export function titleBoard(store:ProfileStore){return store.data.titles.map(id=>`<button class="title-pick${store.data.title===id?' selected':''}" data-title="${id}">${titleName(id)}</button>`).join('');}

/** Lock line for a car, mode or arena card. */
export function lockLabel(level:number){return `<span class="lock-tag">🔒 LV ${level}</span>`;}
export const carLock=(i:number)=>carUnlockLevel[i]??1,modeLock=(m:string)=>modeUnlockLevel[m]??1,arenaLock=(a:number)=>arenaUnlockLevel[a]??1;

export function challengeBoard(store:ProfileStore){const d=store.data,total=store.totalStars();
 const head=hubHead('CHALLENGES',tr('挑战关卡','Challenges'),tr('每关 3 颗星，每颗对应一个目标（额外目标需获胜才算），可分多次完成。每颗新星 ¢100。','3 stars each, one per goal (extra goals count only in a win); collect them over several runs. ¢100 per new star.'),`<div class="star-total"><b>★ ${total}</b><small>/ ${challenges.length*3}</small></div>`)+`
 <div class="star-road">${starMilestones.map(m=>`<span class="${total>=m.stars?'on':''}"><b>★ ${m.stars}</b>${rewardChips(m.reward)}</span>`).join('')}</div>`;
 const cards=challenges.map((c,i)=>{const open=store.challengeOpen(i),stars=d.stars[i],why=store.level<c.level?tr(`LEVEL ${c.level} 开放`,`Opens at LEVEL ${c.level}`):i>0&&d.stars[i-1]===0?tr('先通关上一关','Clear the previous one first'):c.car!==undefined&&!store.carUnlocked(c.car)?tr(`需要解锁 ${carLabel[c.car]}`,`Needs ${carLabel[c.car]}`):'';
  return `<div class="challenge-card${open?'':' locked'}${stars===3?' perfect':''}"><img src="${assetPath('assets/')}maps/arena-${c.arena}.jpg" alt="" loading="lazy" draggable="false"/><div class="ch-num">${String(i+1).padStart(2,'0')}</div><div class="ch-body"><strong>${c.name}</strong><small>${modeNames[c.mode as keyof typeof modeNames]} · ${arenas[c.arena].name} · ${[tr('轻松','Easy'),tr('标准','Normal'),tr('挑战','Hard')][['easy','normal','hard'].indexOf(c.difficulty)]}${c.car!==undefined?` · ${carLabel[c.car]}`:''}</small>
  <ul>${c.goals.map((g,k)=>`<li class="${d.starGoals[i]>>k&1?'on':''}"><i>★</i>${goalText(g)}</li>`).join('')}</ul></div><div class="ch-foot">${open?`<button class="primary-button small" data-challenge="${i}">${stars?tr('再次挑战','Replay'):tr('开始挑战','Start')} ▶</button>`:`<span class="lock-tag">🔒 ${why}</span>`}</div></div>`;}).join('');
 return head+`<div class="challenge-grid">${cards}</div>`;}

const carIds=['mantis','punisher','retro','pummeler','bigrig'];
const partSource=():Record<PartKind,string>=>({common:tr('每个回收箱都有，对局评级再补一批','In every salvage crate, plus a batch from the match rating'),precision:tr('精英和首领的回收箱、3 连杀以上的回收箱、A / S 评级、等级与任务奖励','Elite and boss crates, crates from 3+ combos, A / S ratings, level and task rewards'),core:tr('首领回收箱、等级奖励、周任务与金档成就','Boss crates, level rewards, weekly tasks and gold achievements')});
const partUse=():Record<PartKind,string>=>({common:tr('每一级武器升级都要用','Needed for every weapon level'),precision:tr('武器 LV 3 起需要','Needed from weapon LV 3'),core:tr('武器 LV 5 起需要','Needed from weapon LV 5')});
/** Warehouse: parts in stock, where each kind comes from, and what every weapon's next level asks for. */
export function warehouseBoard(store:ProfileStore,cars:{name:string;weapon:string}[]){const d=store.data,need=store.weaponNeed(),source=partSource(),use=partUse();
 const stock=partKinds.map((k,i)=>{const have=d.parts[k],want=need.parts[k];return `<div class="stock-card stock-${k}" style="--part:${partColors[k]}"><div class="stock-top"><i class="stock-gem"></i><div><small>TIER ${i+1}</small><strong>${partNames[k]}</strong></div><b class="stock-count">${have.toLocaleString()}</b></div><div class="progress-track"><i style="width:${want?Math.min(100,have/want*100):100}%"></i></div><small class="stock-need">${want?tr(`已解锁武器全部升满还需 ${want.toLocaleString()}`,`${want.toLocaleString()} needed to max every unlocked weapon`):tr('已解锁的武器都已升满','Every unlocked weapon is maxed')}</small><p><em>${tr('来源','From')}</em>${source[k]}</p><p><em>${tr('用途','Use')}</em>${use[k]}</p></div>`;}).join('');
 const rows=cars.map((c,car)=>{const open=store.carUnlocked(car),lv=d.upgrades[car]?.weapon??0,cost=store.weaponCost(car),can=!!cost&&open&&store.canAfford(cost);
  const chips=cost?`${partKinds.filter(k=>cost.parts[k]>0).map(k=>`<span class="part-chip${d.parts[k]<cost.parts[k]?' short':''}">${partIcon(k)}<b>${d.parts[k]}/${cost.parts[k]}</b></span>`).join('')}<span class="part-chip${d.coins<cost.credits?' short':''}">${creditIcon}<b>${cost.credits}</b></span>`:'';
  return `<div class="demand-row${open?'':' locked'}${can?' ready':''}"><img src="${assetPath('assets/')}models/weapon-${carIds[car]}-preview.png" alt="" loading="lazy" draggable="false"/><div class="demand-main"><strong>${esc(c.weapon)}<small>${esc(c.name)}</small></strong><div class="pips ten">${Array.from({length:WEAPON_MAX},(_,k)=>`<i class="${k<lv?'on':''}"></i>`).join('')}</div><span class="cost-line"><small>LV ${lv} / ${WEAPON_MAX}${cost?tr(' · 下一级需要',' · Next level needs'):''}</small>${chips}</span></div>${!open?`<span class="lock-tag">🔒 LV ${carUnlockLevel[car]??1}</span>`:!cost?`<span class="demand-tag max">${tr('已满级','Maxed')}</span>`:`<button class="${can?'primary-button':'ghost-button'} small" data-warehouse-car="${car}">${can?tr('去升级','Upgrade'):tr('材料不足','Short')} ›</button>`}</div>`;}).join('');
 return hubHead('WAREHOUSE',tr('仓库','Warehouse'),tr('战场回收的零件都存放在这里，用来升级武器','Parts salvaged in battle are kept here and spent on weapon levels'),`<span class="wallet-line">${creditIcon}<b>${d.coins.toLocaleString()}</b><small>${tr('信用点','Credits')}</small></span>`)+
 `<div class="stock-grid">${stock}</div><div class="hub-card-head solo"><b>${tr('武器升级需求','Weapon upgrade needs')}</b><small>${tr('红色表示库存不足 · 点按钮前往改装','Red means short in stock · The button opens the loadout')}</small></div><div class="demand-list">${rows}</div>`;}

export function saveBackup(){return `<div class="save-backup"><button class="metal-button" id="exportSave">${tr('生成存档码','Create save code')}</button><button class="metal-button" id="copySave" hidden>${tr('复制','Copy')}</button><textarea id="saveCode" rows="3" spellcheck="false" placeholder="${tr('在这里粘贴存档码，然后点「导入」','Paste a save code here, then press Import')}"></textarea><button class="ghost-button" id="importSave">${tr('导入存档码','Import save code')}</button><small class="field-note" id="saveNote">${tr('存档只保存在本浏览器。换设备或清理浏览器前，生成存档码并保存好；导入会覆盖当前车手的存档。','Saves live only in this browser. Before switching devices or clearing data, create a code and keep it; importing replaces this driver’s save.')}</small></div>`;}

/** Match report rewards: rating, credits, XP, parts, level bar, then level-ups, unlocks, tasks, season and stars. */
export function reportRewards(store:ProfileStore,r:RewardReport){const p=levelProgress(store.data.xp),cards:string[]=[];
 for(const {level,reward} of r.levelRewards){const lines=rewardLines(reward as LevelReward);cards.push(`<span class="levelup-card"><b>LEVEL UP · LV ${level}</b>${lines.map(esc).join(' · ')}</span>`);}
 const extras:string[]=[];
 if(r.challenge)extras.push(`<span class="report-note star">${[0,1,2].map(k=>r.challenge!.goals>>k&1?'★':'☆').join('')} ${challenges[r.challenge.id].name}${r.challenge.gained?tr(` · 新星 +${r.challenge.gained}`,` · +${r.challenge.gained} new`):''}</span>`);
 for(const id of r.tasksDone){const def=taskDef(id);if(def)extras.push(`<span class="report-note task">✓ ${def.name}</span>`);}
 if(r.seasonAfter>r.seasonBefore)extras.push(`<span class="report-note season">${tr(`赛季等级 ${r.seasonAfter}`,`Season tier ${r.seasonAfter}`)}</span>`);
 for(const m of r.masteryUps)extras.push(`<span class="report-note mastery">${carLabel[m.car]} · ${tr(`熟练度 ${m.level}`,`Mastery ${m.level}`)}</span>`);
 const bonus={common:r.parts.common-r.salvage.common,precision:r.parts.precision-r.salvage.precision,core:r.parts.core-r.salvage.core};
 return `<div class="reward-row"><span class="grade grade-${r.rating}" title="${tr('评级','Rating')}">${r.rating}</span><span class="gain coins">${creditIcon}<b>+${r.credits}</b>${tr('信用点','Credits')}</span><span class="gain xp"><i>✦</i><b>+${r.xp}</b>${tr('经验','XP')}${r.firstWin?`<em class="x2">${tr('首胜 ×2','First win ×2')}</em>`:''}</span></div>
 <div class="reward-parts"><small>${tr('零件','Parts')}</small>${partsInline(r.parts)||`<span class="part-chip">—</span>`}<em>${tr(`战场回收 ${r.salvage.common+r.salvage.precision+r.salvage.core} · 评级补给 ${bonus.common+bonus.precision+bonus.core}`,`Salvaged ${r.salvage.common+r.salvage.precision+r.salvage.core} · Rating bonus ${bonus.common+bonus.precision+bonus.core}`)}</em></div>
 <span class="level"><small>${tr(`等级 ${p.level}`,`Level ${p.level}`)}<em>${p.level>=MAX_LEVEL?'MAX':`${p.into} / ${p.need}`}</em></small><span class="level-track"><i style="width:${(p.ratio*100).toFixed(1)}%"></i></span></span>
 ${extras.length||cards.length?`<div class="report-notes">${cards.join('')}${extras.join('')}</div>`:''}`;}
