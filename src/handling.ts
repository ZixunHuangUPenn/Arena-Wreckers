export function screenHeading(x:number,y:number){const wx=(x+y)*Math.SQRT1_2,wz=(y-x)*Math.SQRT1_2;return Math.atan2(-wx,-wz);}
export function angleDelta(target:number,current:number){return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
export const vehicles=[
 {id:'mantis',name:'Mantis / 螳螂',role:'轻型突击 / NITRO',description:'低矮赛车底盘、后翼与外露防滚架。近距离机枪压制，利用氮气抢占侧翼。',hp:120,speed:10.6,turn:3.4,damage:12,reload:.16,skill:'氮气加速',cooldown:8,gunHeight:1.67,weapon:0,vision:22,hx:1.30,hz:1.86,color:0xe1b627},
 {id:'punisher',name:'Punisher / 惩罚者',role:'装甲皮卡 / MINE',description:'加固驾驶舱与后货斗。近距离霰弹配合燃烧地雷，适合绕掩体伏击。',hp:165,speed:9.1,turn:2.9,damage:11,reload:.95,skill:'燃烧地雷',cooldown:9,gunHeight:1.83,weapon:1,vision:19,hx:1.35,hz:2.08,color:0x718044},
 {id:'retro',name:'Retro / 复古',role:'低底盘火力 / CHARGE',description:'长车头、低车顶和镀铬保险杠。脉冲弹道较快，以冲撞改变交战距离。',hp:145,speed:9.8,turn:3.1,damage:23,reload:.38,skill:'突进冲撞',cooldown:8,gunHeight:1.61,weapon:2,vision:21,hx:1.35,hz:2.18,color:0x853aa1},
 {id:'pummeler',name:'Pummeler / 粉碎者',role:'八轮装甲 / AIR STRIKE',description:'八轮重装甲平台与多管火箭巢。火箭速度较慢，空袭需要预判敌人位置。',hp:235,speed:7.8,turn:2.5,damage:48,reload:1.45,skill:'空袭标记',cooldown:12,gunHeight:2.02,weapon:3,vision:20,hx:1.43,hz:2.28,color:0xa68e58},
 {id:'bigrig',name:'Bigrig / 重卡',role:'重型卡车 / KINETIC SHOCK',description:'高驾驶舱、双排气管与重炮平台。射程有限，利用冲击波击退近身敌车。',hp:290,speed:7,turn:2.3,damage:70,reload:1.9,skill:'动能冲击波',cooldown:10,gunHeight:2.4,weapon:4,vision:18,hx:1.44,hz:2.43,color:0xa9452e}
];
