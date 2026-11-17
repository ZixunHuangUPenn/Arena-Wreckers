import {tr} from './i18n';
import {levelProgress,levelReward,rewardLines,MAX_LEVEL,partKinds,partNames,partShort,partColors,taskDef,REROLL_COST,achievements,masteryProgress,masteryReward,skillMods,carLabel,challenges,goalText,starMilestones,seasonOf,seasonNames,seasonTier,seasonReward,SEASON_TIERS,SEASON_TIER_XP,titleName,FEATURED_DROP,carUnlockLevel,modeUnlockLevel,arenaUnlockLevel,type Parts,type LevelReward} from './progression';
import {modeNames,arenas,type ProfileStore,type RewardReport} from './profile';
// Menu markup for everything progression adds: the top-bar rank, the account details page, tasks, achievements,
// mastery, season, save backup, challenges and the match report's rewards. Returns HTML strings only.

const esc=(t:string)=>t.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
export const partIcon=(k:string)=>`<i class="part-icon part-${k}" style="--part:${partColors[k as keyof Parts]}"></i>`;
export const creditIcon='<i class="credit-icon">¢</i>';
export function partsInline(p:Partial<Parts>,zero=false){return partKinds.filter(k=>zero||(p[k]??0)>0).map(k=>`<span class="part-chip">${partIcon(k)}<b>${(p[k]??0).toLocaleString()}</b><small>${partShort[k]}</small></span>`).join('');}
function rewardChips(r:{credits?:number;parts?:Partial<Parts>;title?:string}){return `${r.credits?`<span class="part-chip">${creditIcon}<b>${r.credits}</b></span>`:''}${partsInline(r.parts??{})}${r.title?`<span class="part-chip title-chip">✦ ${titleName(r.title)}</span>`:''}`;}

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
 return `<div class="season-head"><div><small>SEASON ${s.id}</small><strong>${seasonNames[s.featured]}</strong><span>${tr(`剩余 ${s.daysLeft} 天 · 本季主题地图「${arenas[s.featured].name}」普通零件掉落 ×${FEATURED_DROP}`,`${s.daysLeft} days left · Featured arena “${arenas[s.featured].name}” drops ×${FEATURED_DROP} common parts`)}</span></div><div class="season-tier"><b>${tier}</b><small>/ ${SEASON_TIERS}</small></div></div>
 <div class="season-track">${track}</div><p class="season-next">${tier>=SEASON_TIERS?tr('本赛季奖励已全部领取','Every reward this season is yours'):tr(`第 ${next} 级 · ${into} / ${SEASON_TIER_XP} 赛季经验 · 奖励：`,`Tier ${next} · ${into} / ${SEASON_TIER_XP} season XP · Reward: `)+(tier<SEASON_TIERS?esc(rewardLines(seasonReward(next)).join(' · ')):'')}</p><small class="field-note">${tr('赛季经验与对局经验相同，升级奖励自动发放。赛季结束后等级清零，称号永久保留。','Season XP equals match XP and tier rewards arrive automatically. Tiers reset when the season ends; titles stay.')}</small>`;}

function taskRow(store:ProfileStore,id:string,progress:number,claimed:boolean,daily:boolean){const def=taskDef(id);if(!def)return '';const done=progress>=def.target,reroll=daily&&!claimed&&!store.data.daily.rerolled;
 return `<div class="task${done?' done':''}${claimed?' claimed':''}"><div class="task-main"><h3>${def.name}</h3><p>${def.text}</p><div class="progress-track"><i style="width:${Math.min(100,progress/def.target*100)}%"></i></div><small>${Math.min(progress,def.target).toLocaleString()} / ${def.target.toLocaleString()}</small></div><div class="task-side"><span class="task-reward">${rewardChips(def.reward)}</span>${claimed?`<button class="metal-button" disabled>${tr('已领取','Claimed')}</button>`:done?`<button class="metal-button" data-task-claim="${id}">${tr('领取','Claim')}</button>`:reroll?`<button class="ghost-button small" data-task-reroll="${id}" title="${tr('每天可更换 1 次','One swap per day')}">${tr(`更换 ¢${REROLL_COST}`,`Swap ¢${REROLL_COST}`)}</button>`:''}</div></div>`;}
export function taskBoard(store:ProfileStore){if(!store.tasksOpen())return `<p class="lb-empty locked-note">🔒 ${tr('达到 LEVEL 3 开启每日 / 每周任务','Daily and weekly tasks open at LEVEL 3')}</p>`;const d=store.data;
 return `<div class="task-group"><h4>${tr('每日任务','Daily')}<small>${tr('每天 0 点刷新 · 每日首胜经验 ×2','Resets at midnight · First win of the day: double XP')}${d.daily.firstWin?tr(' · 今日首胜已完成',' · Done today'):''}</small></h4>${d.daily.tasks.map(t=>taskRow(store,t.id,t.progress,t.claimed,true)).join('')}</div>
 <div class="task-group"><h4>${tr('每周任务','Weekly')}<small>${tr('每周一刷新','Resets on Monday')}</small></h4>${d.weekly.tasks.map(t=>taskRow(store,t.id,t.progress,t.claimed,false)).join('')}</div>`;}

export function achievementBoard(store:ProfileStore){const d=store.data,lines=[...new Set(achievements.map(a=>a.line))];
 return lines.map(line=>{const tiers=achievements.filter(a=>a.line===line),value=store.statValue(tiers[0].stat),current=tiers.find(a=>!d.claims.includes(a.id))??tiers[2],all=tiers.every(a=>d.claims.includes(a.id)),ready=!d.claims.includes(current.id)&&value>=current.target;
  return `<div class="milestone tiered${ready?' ready':''}${all?' complete':''}"><div class="medals">${tiers.map(a=>`<i class="medal t${a.tier}${d.claims.includes(a.id)?' on':''}" title="${esc(a.name)}"></i>`).join('')}</div><h3>${current.name}</h3><p>${current.text} · ${Math.min(value,current.target).toLocaleString()}/${current.target.toLocaleString()}</p><span class="task-reward">${rewardChips(current.reward)}</span><button class="metal-button" data-claim="${current.id}" ${all||!ready?'disabled':''}>${all?tr('全部完成','All done'):d.claims.includes(current.id)?tr('已领取','Claimed'):tr('领取','Claim')}</button><div class="progress-track"><i style="width:${Math.min(100,value/current.target*100)}%"></i></div></div>`;}).join('');}

export function masteryBoard(store:ProfileStore){const d=store.data,active=store.level>=10;
 return `${active?'':`<p class="lb-empty locked-note">🔒 ${tr('熟练度经验一直在累计，LEVEL 10 起奖励和效果生效','Mastery XP builds up all along; rewards and perks switch on at LEVEL 10')}</p>`}`+d.mastery.map((mxp,car)=>{const p=masteryProgress(mxp),next=p.level<10?masteryReward(p.level+1,car):null,mod=d.skillMod[car],can=store.masteryLevel(car)>=10;
  return `<div class="mastery-row"><div class="mastery-level"><b>${p.level}</b><small>/10</small></div><div class="mastery-main"><strong>${carLabel[car]}</strong><div class="progress-track"><i style="width:${p.ratio*100}%"></i></div><small>${p.level>=10?tr('熟练度已满','Mastered'):tr(`${p.into} / ${p.need} · 下一级：`,`${p.into} / ${p.need} · Next: `)+(next?esc([...rewardLines(next),...(next.perk?[next.perk]:[])].join(' · ')):'')}</small></div>
  <div class="mod-pick">${skillMods[car].map((label,k)=>`<button class="mod${mod===k+1?' selected':''}" data-skill-mod="${car}:${k+1}" ${can?'':'disabled'} title="${esc(label)}">${esc(label)}</button>`).join('')}</div></div>`;}).join('');}

export function titleBoard(store:ProfileStore){return store.data.titles.map(id=>`<button class="title-pick${store.data.title===id?' selected':''}" data-title="${id}">${titleName(id)}</button>`).join('');}

/** Lock line for a car, mode or arena card. */
export function lockLabel(level:number){return `<span class="lock-tag">🔒 LV ${level}</span>`;}
export const carLock=(i:number)=>carUnlockLevel[i]??1,modeLock=(m:string)=>modeUnlockLevel[m]??1,arenaLock=(a:number)=>arenaUnlockLevel[a]??1;

export function challengeBoard(store:ProfileStore){const d=store.data,total=store.totalStars();
 const head=`<div class="star-head"><div><small>CHALLENGES</small><strong>${tr('挑战关卡','Challenges')}</strong><span>${tr('每关 3 颗星：获胜得 1 星，完成额外目标各得 1 星。每颗新星 ¢100。','3 stars each: a win earns one, each extra goal one more. ¢100 per new star.')}</span></div><div class="star-total"><b>★ ${total}</b><small>/ ${challenges.length*3}</small></div></div>
 <div class="star-road">${starMilestones.map(m=>`<span class="${total>=m.stars?'on':''}"><b>★ ${m.stars}</b>${rewardChips(m.reward)}</span>`).join('')}</div>`;
 const cards=challenges.map((c,i)=>{const open=store.challengeOpen(i),stars=d.stars[i],why=store.level<c.level?tr(`LEVEL ${c.level} 开放`,`Opens at LEVEL ${c.level}`):i>0&&d.stars[i-1]===0?tr('先通关上一关','Clear the previous one first'):c.car!==undefined&&!store.carUnlocked(c.car)?tr(`需要解锁 ${carLabel[c.car]}`,`Needs ${carLabel[c.car]}`):'';
  return `<div class="challenge-card${open?'':' locked'}${stars===3?' perfect':''}"><img src="" data-arena-img="${c.arena}" alt="" loading="lazy" draggable="false"/><div class="ch-num">${String(i+1).padStart(2,'0')}</div><div class="ch-body"><strong>${c.name}</strong><small>${modeNames[c.mode as keyof typeof modeNames]} · ${arenas[c.arena].name} · ${[tr('轻松','Easy'),tr('标准','Normal'),tr('挑战','Hard')][['easy','normal','hard'].indexOf(c.difficulty)]}${c.car!==undefined?` · ${carLabel[c.car]}`:''}</small>
  <ul>${c.goals.map((g,k)=>`<li class="${stars>k?'on':''}"><i>★</i>${goalText(g)}</li>`).join('')}</ul></div><div class="ch-foot">${open?`<button class="primary-button small" data-challenge="${i}">${stars?tr('再次挑战','Replay'):tr('开始挑战','Start')} ▶</button>`:`<span class="lock-tag">🔒 ${why}</span>`}</div></div>`;}).join('');
 return head+`<div class="challenge-grid">${cards}</div>`;}

export function saveBackup(){return `<div class="save-backup"><button class="metal-button" id="exportSave">${tr('生成存档码','Create save code')}</button><button class="metal-button" id="copySave" hidden>${tr('复制','Copy')}</button><textarea id="saveCode" rows="3" spellcheck="false" placeholder="${tr('在这里粘贴存档码，然后点「导入」','Paste a save code here, then press Import')}"></textarea><button class="ghost-button" id="importSave">${tr('导入存档码','Import save code')}</button><small class="field-note" id="saveNote">${tr('存档只保存在本浏览器。换设备或清理浏览器前，生成存档码并保存好；导入会覆盖当前车手的存档。','Saves live only in this browser. Before switching devices or clearing data, create a code and keep it; importing replaces this driver’s save.')}</small></div>`;}

/** Match report rewards: rating, credits, XP, parts, level bar, then level-ups, unlocks, tasks, season and stars. */
export function reportRewards(store:ProfileStore,r:RewardReport){const p=levelProgress(store.data.xp),cards:string[]=[];
 for(const {level,reward} of r.levelRewards){const lines=rewardLines(reward as LevelReward);cards.push(`<div class="levelup-card"><small>LEVEL UP</small><b>LEVEL ${level}</b><ul>${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></div>`);}
 const extras:string[]=[];
 if(r.challenge)extras.push(`<span class="report-note star">${'★'.repeat(r.challenge.stars)}${'☆'.repeat(3-r.challenge.stars)} ${challenges[r.challenge.id].name}${r.challenge.gained?tr(` · 新星 +${r.challenge.gained}`,` · +${r.challenge.gained} new`):''}</span>`);
 for(const id of r.tasksDone){const def=taskDef(id);if(def)extras.push(`<span class="report-note task">✓ ${def.name}</span>`);}
 if(r.seasonAfter>r.seasonBefore)extras.push(`<span class="report-note season">${tr(`赛季等级 ${r.seasonAfter}`,`Season tier ${r.seasonAfter}`)}</span>`);
 for(const m of r.masteryUps)extras.push(`<span class="report-note mastery">${carLabel[m.car]} · ${tr(`熟练度 ${m.level}`,`Mastery ${m.level}`)}</span>`);
 const bonus={common:r.parts.common-r.salvage.common,precision:r.parts.precision-r.salvage.precision,core:r.parts.core-r.salvage.core};
 return `<div class="reward-row"><span class="grade grade-${r.rating}" title="${tr('评级','Rating')}">${r.rating}</span><span class="gain coins">${creditIcon}<b>+${r.credits}</b>${tr('信用点','Credits')}</span><span class="gain xp"><i>✦</i><b>+${r.xp}</b>${tr('经验','XP')}${r.firstWin?`<em class="x2">${tr('首胜 ×2','First win ×2')}</em>`:''}</span></div>
 <div class="reward-parts"><small>${tr('零件','Parts')}</small>${partsInline(r.parts)||`<span class="part-chip">—</span>`}<em>${tr(`战场回收 ${r.salvage.common+r.salvage.precision+r.salvage.core} · 评级补给 ${bonus.common+bonus.precision+bonus.core}`,`Salvaged ${r.salvage.common+r.salvage.precision+r.salvage.core} · Rating bonus ${bonus.common+bonus.precision+bonus.core}`)}</em></div>
 <span class="level"><small>${tr(`等级 ${p.level}`,`Level ${p.level}`)}<em>${p.level>=MAX_LEVEL?'MAX':`${p.into} / ${p.need}`}</em></small><span class="level-track"><i style="width:${(p.ratio*100).toFixed(1)}%"></i></span></span>
 ${extras.length?`<div class="report-notes">${extras.join('')}</div>`:''}${cards.length?`<div class="levelup-cards">${cards.join('')}</div>`:''}`;}
