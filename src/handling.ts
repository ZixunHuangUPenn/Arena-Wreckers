export function screenHeading(x:number,y:number){const wx=(x+y)*Math.SQRT1_2,wz=(y-x)*Math.SQRT1_2;return Math.atan2(-wx,-wz);}
export function angleDelta(target:number,current:number){return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
export const vehicles=[
 {id:'mantis',name:'Kestrel / 幽隼',role:'隐身刺客 / STEALTH',description:'低矮赛车底盘、后翼与外露防滚架。全队最快也最脆，靠迷彩绕到敌人背后，用机枪打出一轮爆发后脱离。',hp:120,speed:10.6,turn:3.4,damage:8,reload:.16,skill:'光学迷彩',cooldown:14,gunHeight:1.67,weapon:0,vision:22,hx:1.30,hz:1.86,color:0xe1b627},
 {id:'punisher',name:'Grapnel / 铁钩',role:'近战控场 / GRAPPLE',description:'加固驾驶舱与后货斗里的绞盘。用链钩把敌车拖到面前，近距离霰弹一轮带走，贴身时自己更耐打。',hp:165,speed:9.1,turn:2.9,damage:9.5,reload:.95,skill:'链钩',cooldown:10,gunHeight:1.83,weapon:1,vision:19,hx:1.35,hz:2.08,color:0x718044},
 {id:'retro',name:'Arclight / 弧光',role:'能量爆发 / OVERDRIVE',description:'长车头、低车顶和外露的电容组。脉冲炮弹速快，盯住一个目标越打越痛，超载后电弧在敌群间弹射。',hp:145,speed:9.8,turn:3.1,damage:19,reload:.38,skill:'超载电弧',cooldown:13,gunHeight:1.61,weapon:2,vision:21,hx:1.35,hz:2.18,color:0x853aa1},
 {id:'pummeler',name:'Bombard / 震岳',role:'远程攻城 / BARRAGE',description:'八轮重装甲平台与多管火箭巢。停稳后装填更快，弹幕沿瞄准线推进，隔着掩体封锁桥头和坡道。',hp:235,speed:7.8,turn:2.5,damage:72.5,reload:1.45,skill:'徐进弹幕',cooldown:14,gunHeight:2.02,weapon:3,vision:20,hx:1.43,hz:2.28,color:0xa68e58},
 {id:'bigrig',name:'Bulwark / 壁垒',role:'前排坦克 / FORTRESS',description:'高驾驶舱、双排气管与力场发生器。护罩为全队挡下炮火并把吸收的伤害炸回去，车头本身就是武器。',hp:290,speed:7,turn:2.3,damage:95,reload:1.9,skill:'堡垒力场',cooldown:16,gunHeight:2.4,weapon:4,vision:18,hx:1.44,hz:2.43,color:0xa9452e}
];
