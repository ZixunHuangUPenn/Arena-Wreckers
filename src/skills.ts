import {tr} from './i18n';
// Vehicle kits: one active skill and one passive per vehicle, the numbers behind them, the text shown in
// the vehicle select menu, and the small pieces of geometry the skills need. No rendering in here.

/** Tuning for every skill. Index order matches `vehicles`. */
export const skillTuning={
 cloak:{duration:5,speed:1.22,revealRange:6,ambush:1.5,ambushTime:1.5,rearBonus:1.3},
 hook:{range:17,cone:.6,damage:25,pullSpeed:24,pullTime:.75,stopAt:4.6,slow:.45,slowTime:2.5,missCooldown:4,armourRange:9,armour:.75},
 overdrive:{duration:5,reload:.55,chainRange:8,chainTargets:2,chain:.45,stack:.06,maxStacks:6,stackTime:2.5},
 barrage:{shells:6,spacing:3.4,delay:.9,interval:.26,radius:3.6,damage:48,aimMin:1,aimMax:20,deployAfter:.8,deployReload:.75},
 dome:{duration:6,radius:7.5,capacity:400,inside:.4,blastBase:25,blastShare:.2,blastMax:85,blastRange:9,ramSpeed:5,ramDamage:5.5,ramMax:50,ramCooldown:.9}
};
const T=skillTuning;
export type SkillKit={tag:string;accent:string;active:{name:string;summary:string;points:string[]};passive:{name:string;summary:string};tips:string;counter:string};
/** Menu copy for each vehicle. Numbers are read from `skillTuning` so the text cannot drift from the rules. */
export const skillKits:SkillKit[]=[
 {tag:tr('隐身刺客','Stealth assassin'),accent:'#63e6d8',
  active:{name:tr('光学迷彩','Optical cloak'),summary:tr(`隐身 ${T.cloak.duration} 秒并提速 ${Math.round((T.cloak.speed-1)*100)}%，敌人只有贴到 ${T.cloak.revealRange} 米内才能发现你。`,`Invisible for ${T.cloak.duration} s and ${Math.round((T.cloak.speed-1)*100)}% faster; enemies only spot you within ${T.cloak.revealRange} m.`),points:[tr('开火或发射导弹会立刻解除迷彩','Firing a gun or missile drops the cloak at once'),tr(`破隐后 ${T.cloak.ambushTime} 秒内伤害 ×${T.cloak.ambush}`,`Damage ×${T.cloak.ambush} for ${T.cloak.ambushTime} s after breaking cloak`),tr('迷彩期间敌方导弹丢失锁定','Enemy missiles lose their lock while you are cloaked')]},
  passive:{name:tr('背刺','Backstab'),summary:tr(`从敌车后方命中时伤害 +${Math.round((T.cloak.rearBonus-1)*100)}%。`,`+${Math.round((T.cloak.rearBonus-1)*100)}% damage when hitting an enemy from behind.`)},
  tips:tr('绕到敌人身后再开火，打完一轮就撤。','Get behind the enemy before firing; unload one burst and leave.'),counter:tr('装甲最薄，怕范围伤害','Thinnest armour; weak to splash damage')},
 {tag:tr('近战控场','Close control'),accent:'#ffab5c',
  active:{name:tr('链钩','Grapple hook'),summary:tr(`向瞄准方向射出钢索，钩住 ${T.hook.range} 米内的敌车并拖到车头前。`,`Fires a cable along your aim, hooks an enemy within ${T.hook.range} m and drags it to your bumper.`),points:[tr('拖动技能键（电脑按住 Q）自选方向，松手射出；轻点则自动找最近的敌车','Drag the skill button (hold Q on a computer) to pick the direction and release to fire; a tap goes for the nearest enemy'),tr(`命中造成 ${T.hook.damage} 伤害，拖拽中目标无法行驶`,`Deals ${T.hook.damage} damage; the target cannot drive while reeled in`),tr(`落地后目标减速 ${Math.round((1-T.hook.slow)*100)}%，持续 ${T.hook.slowTime} 秒`,`Afterwards the target is ${Math.round((1-T.hook.slow)*100)}% slower for ${T.hook.slowTime} s`),tr(`没钩中时冷却缩短为 ${T.hook.missCooldown} 秒`,`A miss shortens the cooldown to ${T.hook.missCooldown} s`)]},
  passive:{name:tr('近身铁甲','Close armour'),summary:tr(`受到 ${T.hook.armourRange} 米内敌人的伤害降低 ${Math.round((1-T.hook.armour)*100)}%。`,`Takes ${Math.round((1-T.hook.armour)*100)}% less damage from enemies within ${T.hook.armourRange} m.`)},
  tips:tr('把远程敌人钩到面前，用霰弹贴脸轰击。','Hook ranged enemies in and shotgun them point-blank.'),counter:tr('怕被远程风筝','Weak to being kited at range')},
 {tag:tr('能量爆发','Energy burst'),accent:'#c48bff',
  active:{name:tr('超载电弧','Overdrive arcs'),summary:tr(`脉冲炮超载 ${T.overdrive.duration} 秒，射速提高 ${Math.round((1/T.overdrive.reload-1)*100)}%。`,`Overdrives the pulse cannon for ${T.overdrive.duration} s: ${Math.round((1/T.overdrive.reload-1)*100)}% faster fire.`),points:[tr(`每次命中向 ${T.overdrive.chainRange} 米内另外 ${T.overdrive.chainTargets} 辆敌车弹射电弧`,`Each hit arcs to ${T.overdrive.chainTargets} more enemies within ${T.overdrive.chainRange} m`),tr(`电弧造成本次伤害的 ${Math.round(T.overdrive.chain*100)}%`,`Arcs deal ${Math.round(T.overdrive.chain*100)}% of the hit's damage`),tr('敌人扎堆时收益最高','Best when enemies bunch up')]},
  passive:{name:tr('蓄能电容','Charge capacitors'),summary:tr(`连续命中同一目标，每发伤害 +${Math.round(T.overdrive.stack*100)}%，最多 +${Math.round(T.overdrive.stack*T.overdrive.maxStacks*100)}%；${T.overdrive.stackTime} 秒未命中清零。`,`Each hit on the same target adds +${Math.round(T.overdrive.stack*100)}% damage, up to +${Math.round(T.overdrive.stack*T.overdrive.maxStacks*100)}%; resets after ${T.overdrive.stackTime} s without a hit.`)},
  tips:tr('盯住一个目标叠满电容，再开超载收割。','Stay on one target to fill the capacitors, then overdrive to clean up.'),counter:tr('怕掩体和断线','Weak to cover and broken line of fire')},
 {tag:tr('远程攻城','Long-range siege'),accent:'#ffd166',
  active:{name:tr('徐进弹幕','Creeping barrage'),summary:tr(`呼叫 ${T.barrage.shells} 发炮弹沿瞄准方向依次落下，覆盖约 ${Math.round((T.barrage.shells-1)*T.barrage.spacing)} 米长的地带。`,`Calls ${T.barrage.shells} shells that land one after another along your aim, covering about ${Math.round((T.barrage.shells-1)*T.barrage.spacing)} m.`),points:[tr(`拖动技能键（电脑按住 Q）在射程圈内任选落点和推进方向，最远 ${T.barrage.aimMax} 米；轻点则自动锁定最近的敌车`,`Drag the skill button (hold Q on a computer) to pick any impact spot inside the reach circle and a heading, up to ${T.barrage.aimMax} m; a tap locks the nearest enemy`),tr(`每发 ${T.barrage.damage} 伤害，半径 ${T.barrage.radius} 米`,`${T.barrage.damage} damage per shell, ${T.barrage.radius} m radius`),tr('落点有黄色预警圈，可以越过掩体','Yellow warning circles mark the impacts; shells go over cover'),tr('适合封路、逼走占点的敌人','Good for blocking roads and clearing capture points')]},
  passive:{name:tr('驻锄架势','Braced stance'),summary:tr(`停稳 ${T.barrage.deployAfter} 秒后进入架设状态，装填时间缩短 ${Math.round((1-T.barrage.deployReload)*100)}%。`,`After ${T.barrage.deployAfter} s standing still it braces, cutting reload time by ${Math.round((1-T.barrage.deployReload)*100)}%.`)},
  tips:tr('在高处停稳输出，用弹幕封住桥头坡道。','Park on high ground and fire; lock down bridges and ramps with the barrage.'),counter:tr('怕被近身和绕后','Weak up close and from behind')},
 {tag:tr('前排坦克','Front-line tank'),accent:'#6fb8ff',
  active:{name:tr('堡垒力场','Fortress dome'),summary:tr(`展开半径 ${T.dome.radius} 米的护罩 ${T.dome.duration} 秒，挡下外面射来的全部子弹和炮弹。`,`Raises a ${T.dome.radius} m dome for ${T.dome.duration} s that stops every bullet and shell fired in from outside.`),points:[tr(`护罩内队友受到的范围伤害降低 ${Math.round((1-T.dome.inside)*100)}%`,`Allies inside take ${Math.round((1-T.dome.inside)*100)}% less splash damage`),tr(`最多吸收 ${T.dome.capacity} 伤害，吸满提前破裂`,`Absorbs up to ${T.dome.capacity} damage, then breaks early`),tr(`结束时把吸收的伤害炸回去，最高 ${T.dome.blastMax}`,`Blasts the absorbed damage back out when it ends, up to ${T.dome.blastMax}`)]},
  passive:{name:tr('碾压','Ram'),summary:tr(`高速撞上敌车造成最高 ${T.dome.ramMax} 伤害并把它撞飞，自己几乎不减速。`,`Hitting an enemy at speed deals up to ${T.dome.ramMax} damage and knocks it away, with almost no slowdown.`)},
  tips:tr('顶在队友前面开护罩，结束前贴近敌人引爆。','Lead your team with the dome up and get close to enemies before it pops.'),counter:tr('怕被绕到护罩里面','Weak to enemies who get inside the dome')}
];
/** True when the attacker stands within 60° of the target's tail. Heading 0 faces −z. */
export function isRearHit(ax:number,az:number,tx:number,tz:number,targetAngle:number){const dx=ax-tx,dz=az-tz,n=Math.hypot(dx,dz);if(n<1e-6)return false;return (dx*-Math.sin(targetAngle)+dz*-Math.cos(targetAngle))/n<-.5;}
/** Where a segment that starts outside a sphere first crosses into it, as a fraction 0..1 of the segment, else null. */
export function sphereEntry(px:number,py:number,pz:number,dx:number,dy:number,dz:number,cx:number,cy:number,cz:number,r:number){const ox=px-cx,oy=py-cy,oz=pz-cz,c=ox*ox+oy*oy+oz*oz-r*r;if(c<=0)return null;const a=dx*dx+dy*dy+dz*dz;if(a<1e-12)return null;const b=ox*dx+oy*dy+oz*dz,disc=b*b-a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;}
/** Impact points and fuse times of a creeping barrage walking along `aim` through (x,z). */
export function barragePoints(x:number,z:number,aim:number,shells=T.barrage.shells){const fx=-Math.sin(aim),fz=-Math.cos(aim),clamp=(v:number)=>Math.max(-96,Math.min(96,v)),b=T.barrage,out:{x:number;z:number;delay:number}[]=[];for(let i=0;i<shells;i++){const along=(i-2)*b.spacing,side=(i%2?1:-1)*1.1;out.push({x:clamp(x+fx*along+fz*side),z:clamp(z+fz*along-fx*side),delay:b.delay+i*b.interval});}return out;}
/** Blast damage released when a dome ends, from what it absorbed. */
export function domeBlast(absorbed:number){return Math.min(T.dome.blastMax,T.dome.blastBase+absorbed*T.dome.blastShare);}
