export type Upgrade='armor'|'engine'|'weapon';
export type Settings={control:'twin'|'wheel';zoom:number;volume:number;sensitivity:number;controlScale:number;quality:'low'|'medium'|'high';shake:boolean;difficulty:'easy'|'normal'|'hard'};
export type Profile={version:2;mode:'horde'|'team'|'capture'|'elimination'|'ctf'|'charge';coins:number;xp:number;car:number;weapon:number;paint:number;arena:number;upgrades:{armor:number;engine:number;weapon:number}[];ownedPaint:number[];games:number;wins:number;kills:number;damage:number;bestWave:number;claims:string[];settings:Settings};
const defaults=():Profile=>({version:2,mode:'horde',coins:1200,xp:0,car:1,weapon:0,paint:0,arena:0,upgrades:Array.from({length:5},()=>({armor:0,engine:0,weapon:0})),ownedPaint:[0,1,2],games:0,wins:0,kills:0,damage:0,bestWave:0,claims:[],settings:{control:'twin',zoom:1,volume:65,sensitivity:1,controlScale:1,quality:'medium',shake:true,difficulty:'normal'}});
const number=(value:unknown,max=1e9)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,value)):0;
export class ProfileStore{
 key='arena-profile-v1';data:Profile;storage?:Pick<Storage,'getItem'|'setItem'>;
 constructor(storage?:Pick<Storage,'getItem'|'setItem'>,key='arena-profile-v1'){this.storage=storage;this.key=key;const d=defaults();this.data=d;try{const saved=JSON.parse(storage?.getItem(key)??'null');if(saved?.version===1||saved?.version===2){if(['horde','team','capture','elimination','ctf','charge'].includes(saved.mode))d.mode=saved.mode;for(const key of ['coins','xp','games','wins','kills','damage','bestWave'] as const)d[key]=number(saved[key]);for(const key of ['car','weapon','paint','arena'] as const)d[key]=Math.floor(number(saved[key],key==='paint'?5:key==='car'||key==='weapon'?4:2));if(saved.version===1&&d.car===2)d.car=4;d.upgrades=d.upgrades.map((_,i)=>{const old=saved.version===1?(i===4?2:i>=2?-1:i):i;return {armor:Math.floor(number(saved.upgrades?.[old]?.armor,5)),engine:Math.floor(number(saved.upgrades?.[old]?.engine,5)),weapon:Math.floor(number(saved.upgrades?.[old]?.weapon,5))};});d.ownedPaint=[0,1,2,...(Array.isArray(saved.ownedPaint)?saved.ownedPaint.filter((x:unknown)=>Number.isInteger(x)&&Number(x)>=3&&Number(x)<6):[])];if(!d.ownedPaint.includes(d.paint))d.paint=0;d.claims=Array.isArray(saved.claims)?saved.claims.filter((x:unknown)=>typeof x==='string'):[];const s=saved.settings??{};d.settings={control:s.control==='wheel'?'wheel':'twin',zoom:Math.max(.8,number(s.zoom??1,1.3)),volume:Math.min(100,number(s.volume??65)),sensitivity:Math.max(.6,number(s.sensitivity??1,1.6)),controlScale:Math.max(.8,number(s.controlScale??1,1.3)),quality:['low','medium','high'].includes(s.quality)?s.quality:'medium',shake:typeof s.shake==='boolean'?s.shake:true,difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:'normal'};}}catch{}}
 save(){try{this.storage?.setItem(this.key,JSON.stringify(this.data));return true;}catch{return false;}}
 upgrade(car:number,kind:Upgrade){if(!Number.isInteger(car)||!this.data.upgrades[car]||!['armor','engine','weapon'].includes(kind))return false;const level=this.data.upgrades[car][kind],cost=150*(level+1);if(level>=5||this.data.coins<cost)return false;this.data.coins-=cost;this.data.upgrades[car][kind]++;this.save();return true;}
 paint(index:number){if(!Number.isInteger(index)||index<0||index>5)return false;if(!this.data.ownedPaint.includes(index)){if(this.data.coins<250)return false;this.data.coins-=250;this.data.ownedPaint.push(index);}this.data.paint=index;this.save();return true;}
 reward(stats:{score:number;win:boolean;kills:number;damage:number;wave:number}){const coins=50+Math.floor(number(stats.score)/5)+(stats.win?150:0),xp=40+number(stats.kills)*15+(stats.win?80:0);this.data.coins+=coins;this.data.xp+=xp;this.data.games++;this.data.wins+=stats.win?1:0;this.data.kills+=number(stats.kills);this.data.damage+=number(stats.damage);this.data.bestWave=Math.max(this.data.bestWave,number(stats.wave,6));this.save();return {coins,xp};}
 claim(id:string){const goals:{[key:string]:[number,number,number]}={first:[this.data.games,1,150],hunter:[this.data.kills,25,350],veteran:[this.data.wins,5,500],survivor:[this.data.bestWave,6,800]};const goal=goals[id];if(!goal||goal[0]<goal[1]||this.data.claims.includes(id))return false;this.data.claims.push(id);this.data.coins+=goal[2];this.save();return true;}
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
export const paintColors=[0x21c6ce,0xff733b,0x9666ef,0xe6dcc3,0x697a4b,0x353a44];
export const paintNames=['极光蓝','熔岩橙','幻影紫','荒原白','军团绿','石墨黑'];
export const weapons=[
 {name:'Mantis · 旋转机枪',tag:'短点射 / 压制',damage:1,reload:1,speed:34,range:16,spread:.055,pellets:1,gravity:0,color:0xffdc82,splash:0},
 {name:'Punisher · 爆裂霰弹炮',tag:'近距离 / 散射',damage:1,reload:1,speed:26,range:11,spread:.19,pellets:5,gravity:0,color:0xffa66d,splash:0},
 {name:'Retro · 脉冲炮',tag:'中距离 / 高弹速',damage:1,reload:1,speed:52,range:20,spread:.024,pellets:1,gravity:0,color:0x89deef,splash:0},
 {name:'Pummeler · 火箭巢',tag:'预判 / 爆炸',damage:1,reload:1,speed:18,range:22,spread:.04,pellets:1,gravity:0,color:0xff7841,splash:3.5},
 {name:'Bigrig · 重型榴弹',tag:'抛物线 / 区域压制',damage:1,reload:1,speed:15,range:18,spread:.04,pellets:1,gravity:7,color:0xffd07c,splash:4.5}
];
export const arenas=[{name:'碎石峡谷',tag:'SANDSTONE / 01',description:'山脊、下切谷地和盘山土路，沿坡道登上高地绕行。',color:'#c4a070'},{name:'钢铁厂区',tag:'FOUNDRY / 02',description:'高台、下沉作业区、跨区管线与堆料场，坡道串联不同高度。',color:'#77aeb5'},{name:'霜冻边境',tag:'FROSTLINE / 03',description:'高耸雪坡、弯曲低地与冻土道路，借山坡切断敌方视线。',color:'#b5d0e5'}];
