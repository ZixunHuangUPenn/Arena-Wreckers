// Vehicle kits: one active skill and one passive per vehicle, the numbers behind them, the text shown in
// the vehicle select menu, and the small pieces of geometry the skills need. No rendering in here.

/** Tuning for every skill. Index order matches `vehicles`. */
export const skillTuning={
 cloak:{duration:5,speed:1.22,revealRange:6,ambush:1.5,ambushTime:1.5,rearBonus:1.3},
 hook:{range:17,cone:.6,damage:25,pullSpeed:24,pullTime:.75,stopAt:4.6,slow:.45,slowTime:2.5,missCooldown:4,armourRange:9,armour:.75},
 overdrive:{duration:5,reload:.55,chainRange:8,chainTargets:2,chain:.45,stack:.06,maxStacks:6,stackTime:2.5},
 barrage:{shells:6,spacing:3.4,delay:.9,interval:.26,radius:3.6,damage:48,deployAfter:.8,deployReload:.75},
 dome:{duration:6,radius:7.5,capacity:400,inside:.4,blastBase:25,blastShare:.2,blastMax:85,blastRange:9,ramSpeed:5,ramDamage:5.5,ramMax:50,ramCooldown:.9}
};
const T=skillTuning;
export type SkillKit={tag:string;accent:string;active:{name:string;summary:string;points:string[]};passive:{name:string;summary:string};tips:string;counter:string};
/** Menu copy for each vehicle. Numbers are read from `skillTuning` so the text cannot drift from the rules. */
export const skillKits:SkillKit[]=[
 {tag:'隐身刺客',accent:'#63e6d8',
  active:{name:'光学迷彩',summary:`隐身 ${T.cloak.duration} 秒并提速 ${Math.round((T.cloak.speed-1)*100)}%，敌人只有贴到 ${T.cloak.revealRange} 米内才能发现你。`,points:['开火或发射导弹会立刻解除迷彩',`破隐后 ${T.cloak.ambushTime} 秒内伤害 ×${T.cloak.ambush}`,'迷彩期间敌方导弹丢失锁定']},
  passive:{name:'背刺',summary:`从敌车后方命中时伤害 +${Math.round((T.cloak.rearBonus-1)*100)}%。`},
  tips:'绕到敌人身后再开火，打完一轮就撤。',counter:'装甲最薄，怕范围伤害'},
 {tag:'近战控场',accent:'#ffab5c',
  active:{name:'链钩',summary:`向瞄准方向射出钢索，钩住 ${T.hook.range} 米内的敌车并拖到车头前。`,points:[`命中造成 ${T.hook.damage} 伤害，拖拽中目标无法行驶`,`落地后目标减速 ${Math.round((1-T.hook.slow)*100)}%，持续 ${T.hook.slowTime} 秒`,`没钩中时冷却缩短为 ${T.hook.missCooldown} 秒`]},
  passive:{name:'近身铁甲',summary:`受到 ${T.hook.armourRange} 米内敌人的伤害降低 ${Math.round((1-T.hook.armour)*100)}%。`},
  tips:'把远程敌人钩到面前，用霰弹贴脸轰击。',counter:'怕被远程风筝'},
 {tag:'能量爆发',accent:'#c48bff',
  active:{name:'超载电弧',summary:`脉冲炮超载 ${T.overdrive.duration} 秒，射速提高 ${Math.round((1/T.overdrive.reload-1)*100)}%。`,points:[`每次命中向 ${T.overdrive.chainRange} 米内另外 ${T.overdrive.chainTargets} 辆敌车弹射电弧`,`电弧造成本次伤害的 ${Math.round(T.overdrive.chain*100)}%`,'敌人扎堆时收益最高']},
  passive:{name:'蓄能电容',summary:`连续命中同一目标，每发伤害 +${Math.round(T.overdrive.stack*100)}%，最多 +${Math.round(T.overdrive.stack*T.overdrive.maxStacks*100)}%；${T.overdrive.stackTime} 秒未命中清零。`},
  tips:'盯住一个目标叠满电容，再开超载收割。',counter:'怕掩体和断线'},
 {tag:'远程攻城',accent:'#ffd166',
  active:{name:'徐进弹幕',summary:`呼叫 ${T.barrage.shells} 发炮弹沿瞄准方向依次落下，覆盖约 ${Math.round((T.barrage.shells-1)*T.barrage.spacing)} 米长的地带。`,points:[`每发 ${T.barrage.damage} 伤害，半径 ${T.barrage.radius} 米`,'落点有黄色预警圈，可以越过掩体','适合封路、逼走占点的敌人']},
  passive:{name:'驻锄架势',summary:`停稳 ${T.barrage.deployAfter} 秒后进入架设状态，装填时间缩短 ${Math.round((1-T.barrage.deployReload)*100)}%。`},
  tips:'在高处停稳输出，用弹幕封住桥头坡道。',counter:'怕被近身和绕后'},
 {tag:'前排坦克',accent:'#6fb8ff',
  active:{name:'堡垒力场',summary:`展开半径 ${T.dome.radius} 米的护罩 ${T.dome.duration} 秒，挡下外面射来的全部子弹和炮弹。`,points:[`护罩内队友受到的范围伤害降低 ${Math.round((1-T.dome.inside)*100)}%`,`最多吸收 ${T.dome.capacity} 伤害，吸满提前破裂`,`结束时把吸收的伤害炸回去，最高 ${T.dome.blastMax}`]},
  passive:{name:'碾压',summary:`高速撞上敌车造成最高 ${T.dome.ramMax} 伤害并把它撞飞，自己几乎不减速。`},
  tips:'顶在队友前面开护罩，结束前贴近敌人引爆。',counter:'怕被绕到护罩里面'}
];
/** True when the attacker stands within 60° of the target's tail. Heading 0 faces −z. */
export function isRearHit(ax:number,az:number,tx:number,tz:number,targetAngle:number){const dx=ax-tx,dz=az-tz,n=Math.hypot(dx,dz);if(n<1e-6)return false;return (dx*-Math.sin(targetAngle)+dz*-Math.cos(targetAngle))/n<-.5;}
/** Where a segment that starts outside a sphere first crosses into it, as a fraction 0..1 of the segment, else null. */
export function sphereEntry(px:number,py:number,pz:number,dx:number,dy:number,dz:number,cx:number,cy:number,cz:number,r:number){const ox=px-cx,oy=py-cy,oz=pz-cz,c=ox*ox+oy*oy+oz*oz-r*r;if(c<=0)return null;const a=dx*dx+dy*dy+dz*dz;if(a<1e-12)return null;const b=ox*dx+oy*dy+oz*dz,disc=b*b-a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;}
/** Impact points and fuse times of a creeping barrage walking along `aim` through (x,z). */
export function barragePoints(x:number,z:number,aim:number){const fx=-Math.sin(aim),fz=-Math.cos(aim),clamp=(v:number)=>Math.max(-46,Math.min(46,v)),b=T.barrage,out:{x:number;z:number;delay:number}[]=[];for(let i=0;i<b.shells;i++){const along=(i-2)*b.spacing,side=(i%2?1:-1)*1.1;out.push({x:clamp(x+fx*along+fz*side),z:clamp(z+fz*along-fx*side),delay:b.delay+i*b.interval});}return out;}
/** Blast damage released when a dome ends, from what it absorbed. */
export function domeBlast(absorbed:number){return Math.min(T.dome.blastMax,T.dome.blastBase+absorbed*T.dome.blastShare);}
