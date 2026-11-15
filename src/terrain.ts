// Terrain library: every arena is composed from a seeded set of landforms (gorges or rivers that only
// bridges cross, cliff-edged plateaus with ramps, lakes, waterfalls, hills and walled rings), then
// baked into one heightfield that driving, shooting, AI routing and the rendered ground all share.
// Nothing here needs WebGL, so the test suite can generate and check hundreds of layouts headlessly.

export type Fluid='water'|'lava'|'ice'|'toxic'|'molten';
export type Pt={x:number;z:number};
export type Hill={x:number;z:number;rx:number;rz:number;h:number};
export type Lake={x:number;z:number;rx:number;rz:number;rot:number;level:number;depth:number;fluid:Fluid;wobble:number};
export type Plateau={x:number;z:number;rx:number;rz:number;rot:number;height:number;ramps:number[];cliff:number;wobble:number};
/**
 * A carved channel along a wiggling centre line. Points are sampled every 2.5 m along the unit axis (ax,az),
 * starting at axis parameter p0. 'cut' is a drivable sunken road whose depth ramps in over `fade` metres at
 * both ends (t0..t1); gorges and rivers keep their full depth and have impassable floors.
 */
export type Channel={kind:'gorge'|'river'|'cut';points:Pt[];ax:number;az:number;p0:number;lo:number;hi:number;t0:number;t1:number;fade:number;halfWidth:number;floorHalf:number;depth:number;fluid:Fluid|null};
/** A straight deck: `angle` is its driving direction, `half` its half length, h0/h1 the end heights. */
export type Bridge={x:number;z:number;angle:number;half:number;halfWidth:number;h0:number;h1:number;span:number;over?:boolean};
export type Ring={x:number;z:number;radius:number;height:number;gates:number[]};
export type Waterfall={x:number;z:number;dx:number;dz:number;top:number;bottom:number;width:number;fluid:Fluid;stream:Pt};
export type Footprint={x:number;z:number;w:number;d:number};
export type Layout={
 seed:number;style:number;name:string;features:string[];
 hills:Hill[];plateaus:Plateau[];spires:Plateau[];lakes:Lake[];channels:Channel[];bridges:Bridge[];rings:Ring[];waterfalls:Waterfall[];
 cover:Footprint[];
 spawns:[number,number][];capture:Pt[];flags:Pt[];pickups:Pt[];barrels:Pt[];charge:Pt;
};

// ---------------------------------------------------------------- small maths
const clamp=(v:number,a:number,b:number)=>v<a?a:v>b?b:v;
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function rng(seed:number){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function hash(ix:number,iz:number,seed:number){let h=Math.imul(ix,374761393)^Math.imul(iz,668265263)^Math.imul(seed+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x:number,z:number,seed:number){const xf=Math.floor(x),zf=Math.floor(z),fx=x-xf,fz=z-zf,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);return lerp(lerp(hash(xf,zf,seed),hash(xf+1,zf,seed),sx),lerp(hash(xf,zf+1,seed),hash(xf+1,zf+1,seed),sx),sz);}
function fbm(x:number,z:number,octaves:number,seed:number){let sum=0,amp=.5,total=0,f=1;for(let o=0;o<octaves;o++){sum+=amp*vnoise(x*f,z*f,seed+o*31);total+=amp;amp*=.5;f*=2.03;}return sum/total;}
function segmentDistance(x:number,z:number,a:Pt,b:Pt){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);}
/** Distance to a channel centre line. Points are 2.5 m apart along the axis, so only nearby segments are checked (exact up to ~20 m). */
function pathDistance(x:number,z:number,ch:Channel){const q=z*ch.ax-x*ch.az;if(q<ch.lo-22||q>ch.hi+22)return 99;// outside the band the centre line wiggles in
 const points=ch.points,i0=Math.floor((x*ch.ax+z*ch.az-ch.p0)/2.5);let best=Infinity;for(let i=Math.max(1,i0-7);i<=Math.min(points.length-1,i0+8);i++)best=Math.min(best,segmentDistance(x,z,points[i-1],points[i]));return best===Infinity?99:Math.min(best,99);}
/** 0..1 depth along a channel: sunken roads ramp up to ground level at both ends. */
function channelDepth(ch:Channel,x:number,z:number){if(!ch.fade)return 1;const t=x*ch.ax+z*ch.az;return smooth((t-ch.t0)/ch.fade)*smooth((ch.t1-t)/ch.fade);}
/** Distances to every channel of a layout (99 when far away). */
function channelDistances(L:Layout,x:number,z:number){return L.channels.map(ch=>pathDistance(x,z,ch));}
function ellipse(x:number,z:number,cx:number,cz:number,rx:number,rz:number,rot:number){const c=Math.cos(rot),s=Math.sin(rot),dx=x-cx,dz=z-cz,u=dx*c+dz*s,v=-dx*s+dz*c;return {n:Math.hypot(u/rx,v/rz),theta:Math.atan2(v/rz,u/rx)};}
const angleGap=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

// ---------------------------------------------------------------- themes
type Theme={name:string;relief:number;river:number;tributary:number;cut:number;gorgeFluid:Fluid|null;riverFluid:Fluid;lakeFluid:Fluid;fallFluid:Fluid;plateaus:[number,number];lakes:[number,number];ring:number;fall:number;plateauHeight:[number,number]};
const themes:Theme[]=[
 {name:'沙岩荒漠',relief:1,river:.35,tributary:.8,cut:.75,gorgeFluid:null,riverFluid:'water',lakeFluid:'water',fallFluid:'water',plateaus:[1,2],lakes:[0,1],ring:.45,fall:.65,plateauHeight:[4,6]},
 {name:'铸造厂',relief:.35,river:.5,tributary:.65,cut:.9,gorgeFluid:'molten',riverFluid:'toxic',lakeFluid:'toxic',fallFluid:'molten',plateaus:[1,2],lakes:[0,1],ring:.7,fall:.45,plateauHeight:[3.2,4.5]},
 {name:'霜线雪原',relief:.9,river:.6,tributary:.8,cut:.6,gorgeFluid:null,riverFluid:'water',lakeFluid:'ice',fallFluid:'water',plateaus:[1,2],lakes:[1,2],ring:.3,fall:.7,plateauHeight:[4,6.5]},
 {name:'熔岩火山口',relief:1.1,river:.4,tributary:.75,cut:.6,gorgeFluid:'lava',riverFluid:'lava',lakeFluid:'lava',fallFluid:'lava',plateaus:[1,2],lakes:[1,2],ring:.45,fall:.7,plateauHeight:[4,6.5]},
];

// ---------------------------------------------------------------- the active layout and its baked fields
// The arena is 200 m square (walls at +-100 m); the heightfield is baked every 0.625 m.
const HALF=100,CELL=.625,GRID=Math.round(2*HALF/CELL)+1;
/** Half the side of the walled arena, in metres. */
export const ARENA=HALF;
export const terrainGrid={size:GRID,cell:CELL,half:HALF};
let layout:Layout;let heights=new Float32Array(GRID*GRID);let blockedField=new Uint8Array(GRID*GRID);let fluidLevel=new Float32Array(GRID*GRID);let fluidKind=new Uint8Array(GRID*GRID);
const fluidNames:Fluid[]=['water','lava','ice','toxic','molten'];
export let terrainStyle=0;
let currentSeed=0;
const defaultSeeds=[12,204,27,11];
export function mapLayout(){return layout;}
export function terrainSeed(){return currentSeed;}
/** Builds and bakes the arena of `style`. Without a seed each theme uses its fixed showcase layout. */
export function setTerrain(style:number,seed=defaultSeeds[style]??1){terrainStyle=style;currentSeed=seed>>>0;layout=generateLayout(style,currentSeed);}// the successful attempt is already baked
/** A fresh random seed for the next battle. */
export function randomSeed(){return (Math.floor(Math.random()*0xFFFFFF)+1)>>>0;}

// ---------------------------------------------------------------- analytic shape (also used outside the playable square)
let noiseKey=-1;const noiseGrid=new Float32Array(GRID*GRID);
function baseNoise(L:Layout,x:number,z:number){const key=L.seed%997;if(noiseKey!==key){noiseKey=key;for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)noiseGrid[j*GRID+i]=fbm((-HALF+i*CELL)*.035,(-HALF+j*CELL)*.035,4,key);}
 if(x<-HALF||x>HALF||z<-HALF||z>HALF)return fbm(x*.035,z*.035,4,key);const gx=Math.min((x+HALF)/CELL,GRID-1.0001),gz=Math.min((z+HALF)/CELL,GRID-1.0001),i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,k=j*GRID+i;return lerp(lerp(noiseGrid[k],noiseGrid[k+1],fx),lerp(noiseGrid[k+GRID],noiseGrid[k+GRID+1],fx),fz);}
function baseShape(L:Layout,x:number,z:number){const t=themes[L.style];let h=(baseNoise(L,x,z)-.5)*2.4*t.relief+.12*Math.sin(x*.17)*Math.cos(z*.13);
 for(const k of L.hills){if(Math.abs(x-k.x)>k.rx*1.3||Math.abs(z-k.z)>k.rz*1.3)continue;const d=Math.hypot((x-k.x)/k.rx,(z-k.z)/k.rz);if(d<1.3)h+=k.h*(1-smooth((d-.2)/1.05));}
 return h;}
function ringShape(L:Layout,x:number,z:number,h:number){for(const r of L.rings){const d=Math.hypot(x-r.x,z-r.z);if(d>r.radius+9)continue;const bowl=r.height-.55*(1-Math.min(1,(d/r.radius)**2));h=lerp(h,bowl,smooth((r.radius+8-d)/7));}return h;}
function lakeN(k:Lake,x:number,z:number){const e=ellipse(x,z,k.x,k.z,k.rx,k.rz,k.rot);return e.n>2.2?e.n:e.n*(1+k.wobble*(vnoise(Math.cos(e.theta)*2+k.x,Math.sin(e.theta)*2+k.z,7)-.5));}
function lakeShape(L:Layout,x:number,z:number,h:number){for(const k of L.lakes){const r=Math.max(k.rx,k.rz)*2.6;if(Math.abs(x-k.x)>r||Math.abs(z-k.z)>r)continue;const n=lakeN(k,x,z);if(n>2)continue;
  if(k.fluid==='ice'){h=lerp(h,k.level-.04,smooth((1.25-n)/.35));continue;}
  // Bed below the surface inside the shoreline; outside it a low bank that never dips under the surface.
  const shore=k.level+.22;if(n<1)h=shore-(k.depth+.22)*smooth((1-n)/.55);else h=lerp(Math.max(h,shore),h,smooth((n-1.1)/.8));}
 return h;}
function plateauShape(L:Layout,x:number,z:number,h:number){for(const p of L.plateaus)h=mesa(p,x,z,h);for(const p of L.spires)h=mesa(p,x,z,h);return h;}
function mesa(p:Plateau,x:number,z:number,h:number){{const r=Math.max(p.rx,p.rz)*1.9;if(Math.abs(x-p.x)>r||Math.abs(z-p.z)>r)return h;const e=ellipse(x,z,p.x,p.z,p.rx,p.rz,p.rot);if(e.n>1.8)return h;const theta=e.theta;let ramp=0;for(const a of p.ramps)ramp=Math.max(ramp,Math.exp(-((angleGap(theta,a)/.32)**2)));
  const radius=Math.min(p.rx,p.rz),wobble=1+p.wobble*(fbm(Math.cos(theta)*1.7+p.x*.1,Math.sin(theta)*1.7+p.z*.1,3,13)-.5),s=(1-e.n*wobble)*radius,width=lerp(p.cliff,13,ramp);
  // Cliff faces get a little terracing so they read as layered rock rather than a smooth bump.
  let t=smooth(s/width+.5);if(ramp<.5)t=lerp(t,Math.round(t*3)/3,.25*(1-ramp));h+=p.height*t;}
 return h;}
function bridgePads(L:Layout,x:number,z:number,h:number){for(const b of L.bridges){if(Math.abs(x-b.x)>b.half+9||Math.abs(z-b.z)>b.half+9)continue;const c=Math.cos(b.angle),s=Math.sin(b.angle);for(const [end,height] of [[-1,b.h0],[1,b.h1]] as const){const ex=b.x+c*b.half*end,ez=b.z+s*b.half*end,d=Math.hypot(x-ex,z-ez);if(d<9)h=lerp(h,height-.02,smooth((9-d)/5));}}return h;}
function channelCarve(L:Layout,x:number,z:number,h:number,ds?:number[]){let cut=0;L.channels.forEach((ch,i)=>{let d=ds?ds[i]:pathDistance(x,z,ch);if(d>ch.halfWidth+2)return;const depth=ch.depth*channelDepth(ch,x,z);if(depth<=0)return;if(ch.kind!=='cut')d+=(vnoise(x*.35,z*.35,77)-.5)*1.4;
  const m=1-smooth((d-ch.floorHalf)/(ch.halfWidth-ch.floorHalf));// gorges get stepped rock walls
  cut=Math.max(cut,depth*(ch.kind==='gorge'?lerp(m,Math.round(m*4)/4,.3):m));});
 return h-cut;}
/** Height before baking: valid everywhere, including the generated landscape beyond the walls. */
export function shapeHeight(x:number,z:number,L=layout,ds?:number[]){let h=baseShape(L,x,z);h=ringShape(L,x,z,h);h=lakeShape(L,x,z,h);h=plateauShape(L,x,z,h);h=bridgePads(L,x,z,h);h=streamCarve(L,x,z,h);return channelCarve(L,x,z,h,ds);}
function streamCarve(L:Layout,x:number,z:number,h:number){for(const w of L.waterfalls){const d=segmentDistance(x,z,w.stream,{x:w.x,z:w.z});if(d<2.6)h-=.55*(1-smooth((d-.9)/1.7));}return h;}
/** 1 on a channel floor, fading to 0 beyond its rims (used to cut the gorge through the outer mountains). */
export function channelCut(x:number,z:number){let cut=0;for(const ch of layout.channels){if(ch.kind==='cut')continue;const d=pathDistance(x,z,ch);cut=Math.max(cut,1-smooth((d-ch.halfWidth*.6)/(ch.halfWidth*.9+2)));}return cut;}
/** Fluid surface at a point, or null. */
function fluidAt(L:Layout,x:number,z:number,ds?:number[]):{level:number;fluid:Fluid}|null{
 for(const k of L.lakes){const r=Math.max(k.rx,k.rz)*1.5;if(Math.abs(x-k.x)<r&&Math.abs(z-k.z)<r&&lakeN(k,x,z)<(k.fluid==='ice'?1.15:1.05))return {level:k.level,fluid:k.fluid};}
 for(const w of L.waterfalls){const d=segmentDistance(x,z,w.stream,{x:w.x,z:w.z});if(d<2.4)return {level:w.top,fluid:w.fluid};}
 for(let i=0;i<L.channels.length;i++){const ch=L.channels[i];if(ch.fluid&&(ds?ds[i]:pathDistance(x,z,ch))<ch.halfWidth)return {level:baseShape(L,x,z)-ch.depth+(ch.kind==='river'?1.15:.55),fluid:ch.fluid};}
 return null;}
/** Exported for the renderer: fluid surface height and type at a point (null on dry land). */
export function fluidSurface(x:number,z:number){if(Math.abs(x)<=HALF&&Math.abs(z)<=HALF){const i=index(x,z);if(fluidKind[i]===0)return null;return {level:fluidLevel[i],fluid:fluidNames[fluidKind[i]-1]};}const f=fluidAt(layout,x,z);return f&&f.level>shapeHeight(x,z)?f:null;}

// ---------------------------------------------------------------- baking
const index=(x:number,z:number)=>{const i=clamp(Math.round((x+HALF)/CELL),0,GRID-1),j=clamp(Math.round((z+HALF)/CELL),0,GRID-1);return j*GRID+i;};
function bake(L:Layout){
 heights=new Float32Array(GRID*GRID);blockedField=new Uint8Array(GRID*GRID);fluidLevel=new Float32Array(GRID*GRID);fluidKind=new Uint8Array(GRID*GRID);const floorField=new Uint8Array(GRID*GRID);
 for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){const x=-HALF+i*CELL,z=-HALF+j*CELL,k=j*GRID+i;const ds=channelDistances(L,x,z);heights[k]=shapeHeight(x,z,L,ds);const f=fluidAt(L,x,z,ds);if(f&&f.level>heights[k]-.02){fluidLevel[k]=f.level;fluidKind[k]=fluidNames.indexOf(f.fluid)+1;}
  // Gorge and river floors are impassable; a sunken road's floor is a road.
  for(let c=0;c<ds.length;c++){const ch=L.channels[c];if(ch.kind!=='cut'&&ds[c]<ch.floorHalf+1.2){floorField[k]=1;break;}}}
 const last=GRID-1;
 for(let j=0;j<GRID;j++){const j0=j<2?0:j-2,j1=j>last-2?last:j+2;for(let i=0;i<GRID;i++){const k=j*GRID+i,i0=i<2?0:i-2,i1=i>last-2?last:i+2;
  const slope=Math.max(Math.abs(heights[j*GRID+i1]-heights[j*GRID+i0]),Math.abs(heights[j1*GRID+i]-heights[j0*GRID+i]),Math.abs(heights[j1*GRID+i1]-heights[j0*GRID+i0])/1.414,Math.abs(heights[j0*GRID+i1]-heights[j1*GRID+i0])/1.414)/(4*CELL);
  let block=slope>.95||floorField[k]===1;if(!block&&fluidKind[k]){const fluid=fluidNames[fluidKind[k]-1],depth=fluidLevel[k]-heights[k];if(fluid!=='ice'&&depth>(fluid==='water'||fluid==='toxic'?.45:.02))block=true;}
  blockedField[k]=block?1:0;}}
}
/** Ground height, interpolated on exactly the triangles the ground mesh renders. */
export function terrainHeight(x:number,z:number){
 const gx=clamp((x+HALF)/CELL,0,GRID-1.0001),gz=clamp((z+HALF)/CELL,0,GRID-1.0001),i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,k=j*GRID+i;
 const a=heights[k],b=heights[k+1],c=heights[k+GRID],d=heights[k+GRID+1];
 const inside=fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
 if(Math.abs(x)<=HALF&&Math.abs(z)<=HALF)return inside;return inside;}
/** True where a car cannot be: cliff faces, gorge floors, deep water and lava. */
export function terrainBlocked(x:number,z:number){if(Math.abs(x)>HALF||Math.abs(z)>HALF)return true;return blockedField[index(x,z)]===1;}
/** Smooth "how blocked" value for collision normals. */
export function blockedness(x:number,z:number){const gx=clamp((x+HALF)/CELL,0,GRID-1.0001),gz=clamp((z+HALF)/CELL,0,GRID-1.0001),i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,k=j*GRID+i;return lerp(lerp(blockedField[k],blockedField[k+1],fx),lerp(blockedField[k+GRID],blockedField[k+GRID+1],fx),fz);}
/** Fraction of 0..1 describing which landform a point belongs to, used for ground materials. */
export function featureMask(x:number,z:number){const L=layout;let wet=0,canyon=0,ring=0,cliff=0;
 for(const k of L.lakes){const r=Math.max(k.rx,k.rz)*1.7;if(Math.abs(x-k.x)>r||Math.abs(z-k.z)>r)continue;const e=ellipse(x,z,k.x,k.z,k.rx,k.rz,k.rot);wet=Math.max(wet,1-smooth((e.n-1.05)/.6));}
 for(const w of L.waterfalls){wet=Math.max(wet,1-smooth((segmentDistance(x,z,w.stream,{x:w.x,z:w.z})-1.5)/1.6));}
 for(const ch of L.channels){const d=pathDistance(x,z,ch);if(d>ch.halfWidth+4)continue;canyon=Math.max(canyon,(1-smooth((d-ch.halfWidth+1)/3))*(ch.kind==='cut'?channelDepth(ch,x,z):1));if(ch.fluid==='water'||ch.fluid==='toxic')wet=Math.max(wet,1-smooth((d-ch.floorHalf-1)/2));}
 for(const r of L.rings){if(Math.abs(x-r.x)>r.radius+3||Math.abs(z-r.z)>r.radius+3)continue;const d=Math.hypot(x-r.x,z-r.z);ring=Math.max(ring,1-smooth((d-r.radius+.5)/1.5));}
 for(const p of L.plateaus.concat(L.spires)){const r=Math.max(p.rx,p.rz)*1.3;if(Math.abs(x-p.x)>r||Math.abs(z-p.z)>r)continue;const e=ellipse(x,z,p.x,p.z,p.rx,p.rz,p.rot);cliff=Math.max(cliff,1-smooth(Math.abs(e.n-1)/.25));}
 return {wet,canyon,ring,cliff};}

// ---------------------------------------------------------------- generation
const SPAWN_OFFSETS:[number,number][]=[[0,0],[5,0],[-5,0],[0,5],[0,-5]];
function generateLayout(style:number,seed:number):Layout{
 for(let attempt=0;attempt<40;attempt++){const L=tryLayout(style,seed,attempt,attempt>=30);if(L)return L;}
 return tryLayout(style,seed,99,true,true)!;}
function emptyLayout(style:number,seed:number):Layout{return {seed,style,name:'',features:[],hills:[],plateaus:[],spires:[],lakes:[],channels:[],bridges:[],rings:[],waterfalls:[],cover:[],spawns:[],capture:[],flags:[],pickups:[],barrels:[],charge:{x:0,z:0}};}
function tryLayout(style:number,seed:number,attempt:number,simple:boolean,bare=false):Layout|null{
 const t=themes[style]??themes[0],R=rng(seed*7919+attempt*104729+style*31),L=emptyLayout(style,seed),pick=(a:number,b:number)=>a+(b-a)*R();
 // Team bases sit in opposite corners: blue bottom-left (-x,+z), red top-right (+x,-z).
 const base0={x:-pick(62,72),z:pick(62,72)},base1={x:pick(62,72),z:-pick(62,72)},bases=[base0,base1];
 const keep:{x:number;z:number;r:number}[]=[{...base0,r:18},{...base1,r:18}];
 const inside=(x:number,z:number,margin:number)=>Math.abs(x)<HALF-margin&&Math.abs(z)<HALF-margin;
 const hard:{x:number;z:number;r:number}[]=[];
 const clear=(x:number,z:number,r:number,extra=hard)=>[...keep,...extra].every(k=>Math.hypot(x-k.x,z-k.z)>r+k.r)&&inside(x,z,r*.6+3);
 const nearChannel=(x:number,z:number,r:number)=>L.channels.some(ch=>pathDistance(x,z,ch)<r+ch.halfWidth);
 // Hills first: they only reshape the drivable ground.
 const hillCount=bare?4:8+Math.floor(R()*6);for(let i=0;i<hillCount;i++)L.hills.push({x:pick(-95,95),z:pick(-95,95),rx:pick(9,22),rz:pick(9,22),h:pick(1.2,3.6)*(style===1?.6:1)});
 /** A channel along `angle` through `origin`, sampled from axis offset `from` to `to`. */
 const channel=(kind:Channel['kind'],angle:number,origin:Pt,from:number,to:number,half:number,depth:number,fluid:Fluid|null,wiggle:number,fade=0,ends?:[number,number],calm?:(s:number)=>number):Channel=>{
  const ax=Math.cos(angle),az=Math.sin(angle),nx=-az,nz=ax,k=pick(.03,.06),phase=pick(0,6.28),pts:Pt[]=[];
  for(let s=from;s<=to;s+=2.5){const w=wiggle*(Math.sin(k*s+phase)+.35*Math.sin(k*2.7*s+phase*1.7))*(calm?calm(s):1);pts.push({x:origin.x+ax*s+nx*w,z:origin.z+az*s+nz*w});}
  const o=origin.x*ax+origin.z*az,perp=pts.map(p=>p.z*ax-p.x*az);return {kind,points:pts,ax,az,p0:o+from,lo:Math.min(...perp),hi:Math.max(...perp),t0:o+(ends?ends[0]:from),t1:o+(ends?ends[1]:to),fade,halfWidth:half,floorHalf:kind==='river'?half*.55:kind==='cut'?half*.56:half*.32,depth,fluid};};
 /** Lays a deck across a channel at point index i, perpendicular to the local direction. */
 const bridge=(ch:Channel,i:number,over=false)=>{const pts=ch.points,a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dir=Math.atan2(b.z-a.z,b.x-a.x),angle=dir+Math.PI/2,p=pts[i],span=ch.halfWidth+.5,half=span+3.2,c0=Math.cos(angle),s0=Math.sin(angle);
  for(const end of [-1,1])if(!inside(p.x+c0*(half+9)*end,p.z+s0*(half+9)*end,3))return false;
  if(L.bridges.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<o.half+half+14))return false;
  L.bridges.push({x:p.x,z:p.z,angle,half,halfWidth:4.3,h0:baseShape(L,p.x-c0*half,p.z-s0*half),h1:baseShape(L,p.x+c0*half,p.z+s0*half),span,over});
  // Keep both approaches clear of other landforms.
  for(const end of [-1,1])hard.push({x:p.x+c0*(half+6)*end,z:p.z+s0*(half+6)*end,r:8});return true;};
 if(!bare){
  // The main gorge or river runs corner to corner between the bases; only bridges cross it.
  const diag=Math.PI/4,nxm=-Math.sin(diag),nzm=Math.cos(diag);
  {const river=R()<t.river,half=river?pick(7,8.5):pick(6.5,8),offset=pick(-8,8);
   const main=channel(river?'river':'gorge',diag,{x:nxm*offset,z:nzm*offset},-320,320,half,river?3:pick(6,8.5),river?t.riverFluid:t.gorgeFluid,pick(4,10),0,undefined,s=>1-smooth((Math.abs(s)-120)/60));
   if(!bases.every(b=>pathDistance(b.x,b.z,main)>half+16))return null;{L.channels.push(main);L.features.push(main.kind);
    const four=!simple&&R()<.5,slots=four?[pick(-88,-72),pick(-42,-26),pick(22,40),pick(70,86)]:[pick(-78,-58),pick(-12,12),pick(58,78)];
    for(const s of slots)bridge(main,Math.round((s+320)/2.5));
    for(const p of main.points)if(inside(p.x,p.z,-10))hard.push({x:p.x,z:p.z,r:half});
    // A tributary of the other kind joins it from one flank.
    if(!simple&&R()<t.tributary){const side=R()<.5?1:-1,s0=(R()<.5?-1:1)*pick(38,66),junction=main.points[Math.round((s0+320)/2.5)],kind=main.kind==='gorge'?'river':'gorge',tHalf=pick(5.4,6.6);
     const trib=channel(kind,Math.atan2(nzm*side,nxm*side)+pick(-.3,.3),junction,-4,260,tHalf,kind==='river'?2.8:pick(5.5,7),kind==='river'?t.riverFluid:t.gorgeFluid,pick(3,7),0,undefined,s=>smooth(s/24));
     if(bases.every(b=>pathDistance(b.x,b.z,trib)>tHalf+16)){L.channels.push(trib);L.features.push('tributary');let placed=0;
      for(const s of [pick(24,34),pick(54,72)]){const i=Math.round((s+4)/2.5),p=trib.points[i];if(p&&inside(p.x,p.z,16)&&bridge(trib,i))placed++;}
      if(!placed)return null;
      for(const p of trib.points)if(inside(p.x,p.z,-10))hard.push({x:p.x,z:p.z,r:tHalf});}}}}
  // A sunken road with an overpass, in one team's half, roughly parallel to the main channel.
  if(!simple&&R()<t.cut){for(let tries=0;tries<12;tries++){const side=R()<.5?1:-1,dist=pick(30,46),shift=pick(-40,40),cx=nxm*side*dist+Math.cos(diag)*shift,cz=nzm*side*dist+Math.sin(diag)*shift,len=pick(72,92),half=pick(7,8),angle=diag+pick(-.3,.3);
    const cut=channel('cut',angle,{x:cx,z:cz},-len/2-20,len/2+20,half,pick(4.6,5.6),null,pick(0,2.5),17,[-len/2,len/2]);
    if(!cut.points.every(p=>Math.hypot(p.x-cx,p.z-cz)>len/2+2||(inside(p.x,p.z,12)&&clear(p.x,p.z,half+2)&&!nearChannel(p.x,p.z,half+6))))continue;
    L.channels.push(cut);L.features.push('cut');const mid=cut.points[Math.round((len/2+20)/2.5)];
    if(!bridge(cut,Math.round((len/2+20)/2.5),true)){L.channels.pop();L.features.pop();continue;}
    L.features.push('overpass');for(const p of cut.points)if(Math.hypot(p.x-mid.x,p.z-mid.z)<len/2+4)hard.push({x:p.x,z:p.z,r:half+1});break;}}
 }
 // Plateaus with cliff edges and ramps; up to two pour a waterfall into a lake below the cliff.
 const plateauCount=bare?0:simple?2:Math.round(pick(t.plateaus[0],t.plateaus[1]))+2;
 for(let i=0,tries=0;i<plateauCount&&tries<60;tries++){const rx=pick(9,15),rz=pick(8,13),x=pick(-85,85),z=pick(-85,85),r=Math.max(rx,rz);
  if(!clear(x,z,r+3)||nearChannel(x,z,r+6)||L.bridges.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.half+8))continue;
  const toCenter=Math.atan2(-z,-x),rot=pick(0,3.14),local=toCenter-rot,ramps=[Math.atan2(Math.sin(local)*rx,Math.cos(local)*rz)];if(R()<.6)ramps.push(ramps[0]+Math.PI*pick(.6,1.4));
  const ground=baseShape(L,x,z),height=pick(t.plateauHeight[0],t.plateauHeight[1]);const p:Plateau={x,z,rx,rz,rot,height,ramps,cliff:pick(1.6,2.4),wobble:pick(.06,.16)};
  L.plateaus.push(p);hard.push({x,z,r:r+2});L.features.push('plateau');i++;
  if(!simple&&L.waterfalls.length<2&&R()<t.fall){// waterfall on the cliff side facing away from the ramps
   let best=0,bestScore=-9;for(let s=0;s<16;s++){const a=s/16*Math.PI*2,wz=Math.cos(a)*rx*Math.sin(rot)+Math.sin(a)*rz*Math.cos(rot),wx=Math.cos(a)*rx*Math.cos(rot)-Math.sin(a)*rz*Math.sin(rot),score=Math.min(...ramps.map(rp=>angleGap(a,rp)))+.9*wz/Math.hypot(wx,wz);// prefer falls facing the camera (+z)
    if(score>bestScore){bestScore=score;best=a;}}
   const dirLocal={x:Math.cos(best)*rx,z:Math.sin(best)*rz},c=Math.cos(rot),s=Math.sin(rot),ex=x+dirLocal.x*c-dirLocal.z*s,ez=z+dirLocal.x*s+dirLocal.z*c,len=Math.hypot(ex-x,ez-z),dx=(ex-x)/len,dz=(ez-z)/len,lr=pick(6.5,9),lx=ex+dx*(lr*.55),lz=ez+dz*(lr*.55);
   if(clear(lx,lz,lr+2,hard.slice(0,-1))&&inside(lx,lz,lr*.5+3)&&!nearChannel(lx,lz,lr+3)){const level=baseShape(L,lx,lz)-.35,fluid=t.fallFluid;
    L.lakes.push({x:lx,z:lz,rx:lr,rz:lr*pick(.75,1),rot:Math.atan2(dz,dx),level,depth:fluid==='water'||fluid==='toxic'?2.2:1.4,fluid,wobble:.25});
    const lip={x:ex-dx*p.cliff*.65,z:ez-dz*p.cliff*.65},stream={x:x+dx*len*.15,z:z+dz*len*.15};
    L.waterfalls.push({x:lip.x,z:lip.z,dx,dz,top:ground+height-.25,bottom:level,width:pick(3,4.2),fluid,stream});hard.push({x:lx,z:lz,r:lr+1});L.features.push('waterfall');}}
 }
 // Rock spires: sheer cliffs with no way up, which block sight and shots like a building.
 const spireCount=bare||simple?0:2+Math.floor(R()*3);
 for(let i=0,tries=0;i<spireCount&&tries<40;tries++){const r=pick(3.6,6),x=pick(-85,85),z=pick(-85,85);if(!clear(x,z,r+5)||nearChannel(x,z,r+6)||L.bridges.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.half+8))continue;
  L.spires.push({x,z,rx:r*pick(.85,1.15),rz:r,rot:pick(0,3.14),height:pick(6,10)*(style===1?.8:1),ramps:[],cliff:1.2,wobble:pick(.14,.24)});hard.push({x,z,r:r+2});L.features.push('spire');i++;}
 // Free-standing lakes (frozen on the frost map, lava in the caldera).
 const lakeCount=bare||simple?0:Math.round(pick(t.lakes[0],t.lakes[1]))+1;
 for(let i=0,tries=0;i<lakeCount&&tries<40;tries++){const rx=pick(7,12.5),rz=pick(6,10.5),x=pick(-82,82),z=pick(-82,82),r=Math.max(rx,rz);if(!clear(x,z,r+2)||nearChannel(x,z,r+4))continue;
  const fluid=t.lakeFluid;L.lakes.push({x,z,rx,rz,rot:pick(0,3.14),level:baseShape(L,x,z)-.3,depth:fluid==='ice'?0:fluid==='lava'?1.3:2,fluid,wobble:pick(.2,.4)});hard.push({x,z,r:r+1});L.features.push(fluid==='ice'?'ice':fluid==='lava'?'lava':'lake');i++;}
 // Walled ring arenas with four gates.
 const ringCount=bare||simple?0:(R()<t.ring?1:0)+(R()<t.ring*.6?1:0);
 for(let n=0;n<ringCount;n++)for(let tries=0;tries<40;tries++){const radius=pick(10,14),x=pick(-72,72),z=pick(-72,72);if(!clear(x,z,radius+3)||nearChannel(x,z,radius+5)||L.bridges.some(b=>Math.hypot(x-b.x,z-b.z)<radius+b.half+6))continue;const g=pick(0,1.57);L.rings.push({x,z,radius,height:baseShape(L,x,z),gates:[g,g+Math.PI/2,g+Math.PI,g+Math.PI*1.5]});hard.push({x,z,r:radius+1});L.features.push('ring');break;}
 if(!L.features.some(f=>f!=='plateau'))L.features.push('hills');
 // Bake once to place the objectives on genuinely drivable ground.
 bake(L);layout=L;
 // Sunken roads and the lanes that lead into their ramps stay clear.
 const inCut=(x:number,z:number,r:number)=>L.channels.some(ch=>{if(ch.kind!=='cut'||pathDistance(x,z,ch)>=ch.halfWidth+r+2)return false;const t2=x*ch.ax+z*ch.az;return t2>ch.t0-14-r&&t2<ch.t1+14+r;});
 const open=(x:number,z:number,r:number)=>{if(!inside(x,z,r+2))return false;for(let a=0;a<8;a++)for(const d of [0,r*.5,r]){const px=x+Math.cos(a*.785)*d,pz=z+Math.sin(a*.785)*d;if(terrainBlocked(px,pz)||onBridge(L,px,pz)||fluidSurface(px,pz))return false;}
  return Math.abs(terrainHeight(x+r,z)-terrainHeight(x-r,z))<r*.6&&Math.abs(terrainHeight(x,z+r)-terrainHeight(x,z-r))<r*.6&&!inRingWall(L,x,z,r)&&!bridgeApproach(L,x,z,r)&&!inCut(x,z,r)&&!L.spires.some(p=>ellipse(x,z,p.x,p.z,p.rx,p.rz,p.rot).n<1.5);};
 const taken:{x:number;z:number;r:number}[]=[];
 const place=(cx:number,cz:number,spread:number,r:number,gap=r):Pt|null=>{for(let i=0;i<260;i++){const s=spread*(.15+i/110),x=cx+(R()-.5)*2*s,z=cz+(R()-.5)*2*s;if(open(x,z,r)&&taken.every(o=>Math.hypot(x-o.x,z-o.z)>gap+o.r)){taken.push({x,z,r});return {x,z};}}return null;};
 // Spawn order in the game: blue 0,1,2 then red 3,4,5; each team lines up across its corner.
 for(let team=0;team<2;team++){const b=bases[team],sign=team===0?1:-1;for(const [ox,oz] of [[0,0],[-7,-7],[7,7]]){const p=place(b.x+ox*sign,b.z+oz*sign,3,5.5,3);if(!p)return null;L.spawns.push([p.x,p.z]);}}
 for(let team=0;team<2;team++){const b=bases[team];const p=place(b.x*.72,b.z*.72,6,2.6);if(!p)return null;L.flags.push(p);}
 // Capture zones beside the main channel (alternating banks), or along the diagonal without one.
 const main=L.channels.find(ch=>ch.kind!=='cut'&&ch.p0<-200);
 for(let n=0;n<3;n++){const s=[-58,0,58][n],side=(n+(R()<.5?0:1))%2?1:-1;let cx=s*Math.SQRT1_2,cz=s*Math.SQRT1_2;
  if(main){const p=main.points[Math.round((s+320)/2.5)];cx=p.x-Math.SQRT1_2*side*(main.halfWidth+11);cz=p.z+Math.SQRT1_2*side*(main.halfWidth+11);}
  const p=place(cx,cz,10,5.5,7);if(!p)return null;L.capture.push(p);}
 for(const [cx,cz] of [[-40,14],[38,-6],[-8,40],[6,-38],[-62,-30],[60,32],[-28,-66],[30,66]]){const p=place(cx,cz,10,2.2,3);if(!p)return null;L.pickups.push(p);}
 {const p=place(pick(-24,24),pick(-24,24),14,2.6,2.5);if(!p)return null;L.barrels.push(p,{x:p.x+3,z:p.z});taken.push({x:p.x+3,z:p.z,r:1.2});if(!open(p.x+3,p.z,1.2))return null;}
 const charge=place(0,0,14,2.5,3);if(!charge)return null;L.charge=charge;
 // Cover: large generated rock outcrops or container stacks on open ground.
 const coverCount=style===1?12:14;for(let i=0,tries=0;i<coverCount&&tries<300;tries++){const w=pick(6,12),d=pick(3,5.5),long=R()<.5,ww=long?w:d,dd=long?d:w,x=pick(-90,90),z=pick(-90,90),r=Math.max(ww,dd)/2+1;
  if(!open(x,z,r)||taken.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.r+3))continue;L.cover.push({x:Math.round(x*2)/2,z:Math.round(z*2)/2,w:Math.round(ww*2)/2,d:Math.round(dd*2)/2});taken.push({x,z,r});i++;}
 // Every bridge needs a clear run-up on both banks.
 for(const b of L.bridges){const c=Math.cos(b.angle),s=Math.sin(b.angle);for(const end of [-1,1])for(let u=b.half;u<=b.half+9;u+=1)for(let v=-b.halfWidth-1.5;v<=b.halfWidth+1.5;v+=1){const x=b.x+c*u*end-s*v,z=b.z+s*u*end+c*v;if(inside(x,z,2)&&(terrainBlocked(x,z)||fluidSurface(x,z)))return null;}}
 if(!connected(L))return null;
 L.name=describe(L);return L;}
/** True on a deck or its run-up lanes, which objectives and props must keep clear. */
export function bridgeApproach(L:Layout,x:number,z:number,r=0){return L.bridges.some(b=>{const c=Math.cos(b.angle),s=Math.sin(b.angle),dx=x-b.x,dz=z-b.z,u=dx*c+dz*s,v=-dx*s+dz*c;return Math.abs(u)<=b.half+9+r&&Math.abs(v)<=b.halfWidth+2.5+r;});}
function onBridge(L:Layout,x:number,z:number){return L.bridges.some(b=>bridgeLocal(b,x,z)!==null);}
export function bridgeLocal(b:Bridge,x:number,z:number){const c=Math.cos(b.angle),s=Math.sin(b.angle),dx=x-b.x,dz=z-b.z,u=dx*c+dz*s,v=-dx*s+dz*c;if(Math.abs(u)>b.half||Math.abs(v)>b.halfWidth)return null;return {u,v};}
export function ringWalls(r:Ring){const segments:{x:number;z:number;angle:number;length:number}[]=[],count=28;for(let i=0;i<count;i++){const a=(i+.5)/count*Math.PI*2;if(r.gates.some(g=>angleGap(a,g)<.3))continue;const len=2*Math.PI*r.radius/count*.92;segments.push({x:r.x+Math.cos(a)*r.radius,z:r.z+Math.sin(a)*r.radius,angle:-a-Math.PI/2,length:len});}return segments;}
function inRingWall(L:Layout,x:number,z:number,r:number){return L.rings.some(g=>Math.abs(Math.hypot(x-g.x,z-g.z)-g.radius)<r+1.2);}
/** Navigation grid (1 m) with car clearance, rebuilt with each layout; bridges count as open. */
let navOpenField=new Uint8Array(0);const NAV=HALF*2+1;
function buildNav(L:Layout){
 // Rasterise everything solid onto a 0.5 m mask first (bridge decks punch through it), then each 1 m cell is
 // open when the mask is clear around it, which gives the planner about a car's half width of clearance.
 const F=HALF*4+1,mask=new Uint8Array(F*F),fx=(x:number)=>Math.round((x+HALF)*2),box=(x0:number,z0:number,x1:number,z1:number,fill:(x:number,z:number,k:number)=>void)=>{for(let j=Math.max(0,fx(z0));j<=Math.min(F-1,fx(z1));j++)for(let i=Math.max(0,fx(x0));i<=Math.min(F-1,fx(x1));i++)fill(i/2-HALF,j/2-HALF,j*F+i);};
 for(let j=0;j<F;j++)for(let i=0;i<F;i++)mask[j*F+i]=terrainBlocked(i/2-HALF,j/2-HALF)?1:0;
 for(const c of L.cover)box(c.x-c.w/2-.2,c.z-c.d/2-.2,c.x+c.w/2+.2,c.z+c.d/2+.2,(_x,_z,k)=>{mask[k]=1;});
 for(const r of L.rings)box(r.x-r.radius-1.5,r.z-r.radius-1.5,r.x+r.radius+1.5,r.z+r.radius+1.5,(x,z,k)=>{if(Math.abs(Math.hypot(x-r.x,z-r.z)-r.radius)<1.2)mask[k]=1;});
 for(const b of L.bridges){const reach=b.half+b.halfWidth;box(b.x-reach,b.z-reach,b.x+reach,b.z+reach,(x,z,k)=>{if(bridgeLocal(b,x,z))mask[k]=0;});}
 const field=new Uint8Array(NAV*NAV),offsets=[[0,0],[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]];
 for(let j=0;j<NAV;j++)for(let i=0;i<NAV;i++){const x=i-HALF,z=j-HALF;if(Math.abs(x)>=HALF-1.5||Math.abs(z)>=HALF-1.5)continue;const ci=i*2,cj=j*2;let ok=true;for(const [di,dj] of offsets)if(mask[(cj+dj)*F+ci+di]){ok=false;break;}field[j*NAV+i]=ok?1:0;}
 // Under an overpass the sunken road is closed to the planner, so a route never jumps between deck and road.
 for(const b of L.bridges){if(!b.over)continue;const c=Math.cos(b.angle),s=Math.sin(b.angle),reach=Math.ceil(b.half+b.halfWidth+3);for(let j=Math.max(0,Math.round(b.z+HALF)-reach);j<=Math.min(NAV-1,Math.round(b.z+HALF)+reach);j++)for(let i=Math.max(0,Math.round(b.x+HALF)-reach);i<=Math.min(NAV-1,Math.round(b.x+HALF)+reach);i++){const dx=i-HALF-b.x,dz=j-HALF-b.z,u=dx*c+dz*s,v=-dx*s+dz*c;if(Math.abs(u)<=b.half&&Math.abs(v)<=b.halfWidth+2.6)field[j*NAV+i]=0;}}
 // Decks are narrower than the clearance ring; the deck centre line is always open.
 for(const b of L.bridges)for(let u=-b.half;u<=b.half;u+=.5)for(let v=-b.halfWidth+1.4;v<=b.halfWidth-1.4;v+=.5){const x=b.x+Math.cos(b.angle)*u-Math.sin(b.angle)*v,z=b.z+Math.sin(b.angle)*u+Math.cos(b.angle)*v,i=Math.round(x+HALF),j=Math.round(z+HALF);if(i>=0&&j>=0&&i<NAV&&j<NAV)field[j*NAV+i]=1;}
 navOpenField=field;}
/** True where an AI car can drive (with clearance for its body). */
export function navOpen(x:number,z:number){const i=Math.round(x+HALF),j=Math.round(z+HALF);if(i<0||j<0||i>=NAV||j>=NAV)return false;return navOpenField[j*NAV+i]===1;}
function connected(L:Layout){buildNav(L);const start=L.spawns[0],seen=new Uint8Array(NAV*NAV),queue=[Math.round(start[1]+HALF)*NAV+Math.round(start[0]+HALF)];if(!navOpenField[queue[0]])return false;seen[queue[0]]=1;
 for(let q=0;q<queue.length;q++){const k=queue[q],i=k%NAV,j=(k-i)/NAV;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,n=b*NAV+a;if(a<0||b<0||a>=NAV||b>=NAV||seen[n]||!navOpenField[n])continue;seen[n]=1;queue.push(n);}}
 const reach=(p:Pt)=>{for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=Math.round(p.x+HALF)+di,j=Math.round(p.z+HALF)+dj;if(i>=0&&j>=0&&i<NAV&&j<NAV&&seen[j*NAV+i])return true;}return false;};
 const targets=[...L.spawns.map(([x,z])=>({x,z})),...L.capture,...L.flags,...L.pickups,L.charge];if(!targets.every(reach))return false;
 // At least half the arena must stay drivable.
 return queue.length>NAV*NAV*.5;}
const featureNames:Record<string,string>={tributary:'支流',cut:'下沉公路',overpass:'立交桥',spire:'石柱峭壁',gorge:'峡谷',river:'河谷',plateau:'台地悬崖',waterfall:'瀑布',lake:'湖泊',ice:'冰湖',lava:'熔岩湖',ring:'环形竞技场',hills:'丘陵'};
function describe(L:Layout){const parts=L.features.filter((f,i)=>L.features.indexOf(f)===i).map(f=>featureNames[f]);if(L.bridges.length)parts.splice(1,0,`${L.bridges.length} 座桥`);return parts.join(' · ');}
/** Reserved spawn offsets used by respawning (kept here so tests can check the clearance). */
export const spawnOffsets=SPAWN_OFFSETS;
setTerrain(0);
