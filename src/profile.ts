import {tr,lang} from './i18n';
export type Upgrade='armor'|'engine'|'weapon';
export type Settings={control:'twin'|'wheel';zoom:number;volume:number;music:number;sensitivity:number;controlScale:number;quality:'low'|'medium'|'high';shake:boolean;difficulty:'easy'|'normal'|'hard'};
export type Profile={version:2;mode:'horde'|'team'|'capture'|'elimination'|'ctf'|'charge';coins:number;xp:number;car:number;weapon:number;paint:number;arena:number;upgrades:{armor:number;engine:number;weapon:number}[];ownedPaint:number[];games:number;wins:number;kills:number;damage:number;bestWave:number;claims:string[];settings:Settings};
const defaults=():Profile=>({version:2,mode:'horde',coins:1200,xp:0,car:1,weapon:0,paint:0,arena:0,upgrades:Array.from({length:5},()=>({armor:0,engine:0,weapon:0})),ownedPaint:[0,1,2],games:0,wins:0,kills:0,damage:0,bestWave:0,claims:[],settings:{control:'twin',zoom:1,volume:65,music:60,sensitivity:1,controlScale:1,quality:'medium',shake:true,difficulty:'normal'}});
const number=(value:unknown,max=1e9)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,value)):0;
export class ProfileStore{
 key='arena-profile-v1';data:Profile;storage?:Pick<Storage,'getItem'|'setItem'>;
 constructor(storage?:Pick<Storage,'getItem'|'setItem'>,key='arena-profile-v1'){this.storage=storage;this.key=key;const d=defaults();this.data=d;try{const saved=JSON.parse(storage?.getItem(key)??'null');if(saved?.version===1||saved?.version===2){if(['horde','team','capture','elimination','ctf','charge'].includes(saved.mode))d.mode=saved.mode;for(const key of ['coins','xp','games','wins','kills','damage','bestWave'] as const)d[key]=number(saved[key]);for(const key of ['car','weapon','paint','arena'] as const)d[key]=Math.floor(number(saved[key],key==='paint'?5:key==='car'||key==='weapon'?4:3));if(saved.version===1&&d.car===2)d.car=4;d.upgrades=d.upgrades.map((_,i)=>{const old=saved.version===1?(i===4?2:i>=2?-1:i):i;return {armor:Math.floor(number(saved.upgrades?.[old]?.armor,5)),engine:Math.floor(number(saved.upgrades?.[old]?.engine,5)),weapon:Math.floor(number(saved.upgrades?.[old]?.weapon,5))};});d.ownedPaint=[0,1,2,...(Array.isArray(saved.ownedPaint)?saved.ownedPaint.filter((x:unknown)=>Number.isInteger(x)&&Number(x)>=3&&Number(x)<6):[])];if(!d.ownedPaint.includes(d.paint))d.paint=0;d.claims=Array.isArray(saved.claims)?saved.claims.filter((x:unknown)=>typeof x==='string'):[];const s=saved.settings??{};d.settings={control:s.control==='wheel'?'wheel':'twin',zoom:Math.max(.8,number(s.zoom??1,1.3)),volume:Math.min(100,number(s.volume??65)),music:Math.min(100,number(s.music??60)),sensitivity:Math.max(.6,number(s.sensitivity??1,1.6)),controlScale:Math.max(.8,number(s.controlScale??1,1.3)),quality:['low','medium','high'].includes(s.quality)?s.quality:'medium',shake:typeof s.shake==='boolean'?s.shake:true,difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:'normal'};}}catch{}}
 save(){try{this.storage?.setItem(this.key,JSON.stringify(this.data));return true;}catch{return false;}}
 upgrade(car:number,kind:Upgrade){if(!Number.isInteger(car)||!this.data.upgrades[car]||!['armor','engine','weapon'].includes(kind))return false;const level=this.data.upgrades[car][kind],cost=150*(level+1);if(level>=5||this.data.coins<cost)return false;this.data.coins-=cost;this.data.upgrades[car][kind]++;this.save();return true;}
 paint(index:number){if(!Number.isInteger(index)||index<0||index>5)return false;if(!this.data.ownedPaint.includes(index)){if(this.data.coins<250)return false;this.data.coins-=250;this.data.ownedPaint.push(index);}this.data.paint=index;this.save();return true;}
 reward(stats:{score:number;win:boolean;kills:number;damage:number;wave:number}){const coins=50+Math.floor(number(stats.score)/5)+(stats.win?150:0),xp=40+number(stats.kills)*15+(stats.win?80:0);this.data.coins+=coins;this.data.xp+=xp;this.data.games++;this.data.wins+=stats.win?1:0;this.data.kills+=number(stats.kills);this.data.damage+=number(stats.damage);this.data.bestWave=Math.max(this.data.bestWave,number(stats.wave,6));this.save();return {coins,xp};}
 claim(id:string){const goals:{[key:string]:[number,number,number]}={first:[this.data.games,1,150],hunter:[this.data.kills,25,350],veteran:[this.data.wins,5,500],survivor:[this.data.bestWave,6,800],regular:[this.data.games,10,300],wrecker:[this.data.damage,5000,400],ace:[this.data.kills,100,900]};const goal=goals[id];if(!goal||goal[0]<goal[1]||this.data.claims.includes(id))return false;this.data.claims.push(id);this.data.coins+=goal[2];this.save();return true;}
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
 profileStore.key=key;profileStore.data=loaded.data;
 storage?.setItem('arena-last-driver',name);
}
export const paintColors=[0x1f8796,0xd2581f,0x5d3a96,0xd8d2c4,0x5a6440,0x2c2f35];
export const paintNames=lang==='en'?['Aurora blue','Lava orange','Phantom violet','Wasteland white','Legion green','Graphite black']:['极光蓝','熔岩橙','幻影紫','荒原白','军团绿','石墨黑'];
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
