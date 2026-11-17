// AI driving: route planning on the 1 m navigation grid, path following, stuck detection and search targets.
// Everything here is pure (no scene access) so the test harness can drive it directly.
import {navOpen,mapLayout,ARENA,type Layout} from './terrain';
import type {Rect} from './physics';

const N=ARENA*2+1,SIZE=N*N,MAX_CLEAR=4;
/** 0 = closed, otherwise the distance in cells (1..4) to the nearest closed cell. */
let clear=new Uint8Array(SIZE),builtFor:Layout|null=null,dirty=true;
const cost=new Float32Array(SIZE),score=new Float32Array(SIZE),from=new Int32Array(SIZE),seen=new Int32Array(SIZE),done=new Int32Array(SIZE);let stamp=0;
// Extra cost per step by clearance: routes keep to the middle of bridges and away from rims, water and walls.
const EDGE=[0,1.7,.65,.2,0];
const cell=(v:number)=>Math.max(0,Math.min(N-1,Math.round(v+ARENA)));

/** Call when the arena or its solid props change; the grid is rebuilt on the next query. */
export function invalidateNav(){dirty=true;}
function ensure(solids:Rect[]){if(!dirty&&builtFor===mapLayout())return;dirty=false;builtFor=mapLayout();
 const open=new Uint8Array(SIZE);for(let j=0;j<N;j++)for(let i=0;i<N;i++)open[j*N+i]=navOpen(i-ARENA,j-ARENA)?1:0;
 // Props, barrels and walls with room for a car body around them. Only each rectangle's own bounding box is visited.
 for(const r of solids){const c=Math.cos(r.angle),s=Math.sin(r.angle),hx=r.hx+1.7,hz=r.hz+1.7,reach=Math.ceil(Math.hypot(hx,hz));for(let j=Math.max(0,cell(r.z)-reach);j<=Math.min(N-1,cell(r.z)+reach);j++)for(let i=Math.max(0,cell(r.x)-reach);i<=Math.min(N-1,cell(r.x)+reach);i++){const dx=i-ARENA-r.x,dz=j-ARENA-r.z;if(Math.abs(dx*c-dz*s)<hx&&Math.abs(dx*s+dz*c)<hz)open[j*N+i]=0;}}
 // Clearance by repeated erosion: a cell gets level L+1 only when all eight neighbours reached level L.
 clear=open;for(let level=1;level<MAX_CLEAR;level++){const next=clear.slice();for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){const k=j*N+i;if(clear[k]!==level)continue;let inner=true;for(let dj=-1;dj<=1&&inner;dj++)for(let di=-1;di<=1;di++)if(clear[k+dj*N+di]<level){inner=false;break;}if(inner)next[k]=level+1;}clear=next;}
 for(let i=0;i<N;i++)clear[i]=clear[(N-1)*N+i]=clear[i*N]=clear[i*N+N-1]=0;}

/** Clearance (cells to the nearest obstacle or drop) at a world point; 0 where an AI car must not drive. */
export function navClearance(solids:Rect[],x:number,z:number){ensure(solids);if(Math.abs(x)>ARENA||Math.abs(z)>ARENA)return 0;return clear[cell(z)*N+cell(x)];}
/** Nearest drivable point to (x,z) within `radius` metres, preferring cells with at least `want` clearance. */
export function nearestOpen(solids:Rect[],x:number,z:number,radius=8,want=1):{x:number;z:number}|null{ensure(solids);const ci=cell(x),cj=cell(z);let best=-1,bestD=Infinity;
 for(let r=0;r<=radius&&best<0;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const i=ci+di,j=cj+dj;if(i<0||j<0||i>=N||j>=N||clear[j*N+i]<want)continue;const d=di*di+dj*dj;if(d<bestD){bestD=d;best=j*N+i;}}
 if(best<0)return want>1?nearestOpen(solids,x,z,radius,1):null;return {x:best%N-ARENA,z:Math.floor(best/N)-ARENA};}
/** True when the straight line between two points stays on cells with at least `min` clearance. */
export function lineClear(solids:Rect[],ax:number,az:number,bx:number,bz:number,min=1){ensure(solids);const d=Math.hypot(bx-ax,bz-az),steps=Math.max(1,Math.ceil(d/.5));for(let i=0;i<=steps;i++){const t=i/steps;if(clear[cell(az+(bz-az)*t)*N+cell(ax+(bx-ax)*t)]<min)return false;}return true;}

// Binary heap of cell ids ordered by score[].
const heap:number[]=[];
function push(k:number){let i=heap.length;heap.push(k);while(i>0){const p=(i-1)>>1;if(score[heap[p]]<=score[k])break;heap[i]=heap[p];i=p;}heap[i]=k;}
function pop(){const top=heap[0],last=heap.pop()!;const n=heap.length;if(n){let i=0;for(;;){let c=i*2+1;if(c>=n)break;if(c+1<n&&score[heap[c+1]]<score[heap[c]])c++;if(score[heap[c]]>=score[last])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
const NEIGHBOURS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,-1,Math.SQRT2]];
export type Route={points:number[];length:number};
/**
 * A* over the navigation grid from a car to a goal. Returns world points (x,z pairs) from the first step to the goal, or
 * null when the two are not connected. Start and goal snap to the nearest drivable cell, so a car pushed against a rim
 * or a goal inside a rock still gets a route.
 */
export function findRoute(solids:Rect[],sx:number,sz:number,gx:number,gz:number):Route|null{ensure(solids);const s=nearestOpen(solids,sx,sz,8),g=nearestOpen(solids,gx,gz,10);if(!s||!g)return null;
 const start=cell(s.z)*N+cell(s.x),goal=cell(g.z)*N+cell(g.x),gi=goal%N,gj=Math.floor(goal/N);stamp++;heap.length=0;
 const h=(k:number)=>{const dx=Math.abs(k%N-gi),dz=Math.abs(Math.floor(k/N)-gj);return Math.max(dx,dz)+.4142*Math.min(dx,dz);};
 cost[start]=0;score[start]=h(start);seen[start]=stamp;from[start]=start;push(start);let found=false;
 while(heap.length){const k=pop();if(done[k]===stamp)continue;done[k]=stamp;if(k===goal){found=true;break;}const i=k%N,j=(k-i)/N;
  for(const [di,dj,len] of NEIGHBOURS){const a=i+di,b=j+dj;if(a<0||b<0||a>=N||b>=N)continue;const n=b*N+a,c=clear[n];if(!c||done[n]===stamp)continue;
   if(di&&dj&&(!clear[j*N+a]||!clear[b*N+i]))continue;// no cutting corners
   const next=cost[k]+len*(1+EDGE[c]);if(seen[n]===stamp&&next>=cost[n])continue;seen[n]=stamp;cost[n]=next;from[n]=k;score[n]=next+h(n);push(n);}}
 if(!found)return null;const cells:number[]=[];for(let k=goal;k!==start;k=from[k])cells.push(k);cells.reverse();
 const points:number[]=[];let length=0,px=s.x,pz=s.z;for(const k of cells){const x=k%N-ARENA,z=Math.floor(k/N)-ARENA;length+=Math.hypot(x-px,z-pz);px=x;pz=z;points.push(x,z);}
 if(!points.length)points.push(g.x,g.z);return {points,length};}
/**
 * Path following: from a car at (x,z) currently heading for point `index`, returns the index to steer at. Passed points
 * are dropped and the car looks up to `look` points ahead, taking the furthest one it can reach in a straight line with
 * some room to spare. On a bridge that keeps it lined up with the deck instead of cutting the corner at the bridge head.
 */
export function followRoute(solids:Rect[],route:Route,index:number,x:number,z:number,look=12){const p=route.points,last=p.length/2-1;let i=Math.min(index,last);
 while(i<last&&Math.hypot(p[i*2]-x,p[i*2+1]-z)<2.2)i++;
 const here=navClearance(solids,x,z);for(let j=Math.min(last,i+look);j>i;j--)if(lineClear(solids,x,z,p[j*2],p[j*2+1],here>=2?2:1)){i=j;break;}
 return i;}

// ---------------------------------------------------------------- stuck detection
export type Progress={ax:number;az:number;slow:number;qx:number;qz:number;quick:number};
export function newProgress(x:number,z:number):Progress{return {ax:x,az:z,slow:0,qx:x,qz:z,quick:0};}
/**
 * Feeds one frame of movement. Returns true when a car that is trying to drive is stuck: either it has barely moved for
 * a second (pinned on a rail, a rock or another car), or it has stayed inside a 3.5 m circle for 2.4 s (spinning on the
 * spot or circling a point it cannot reach). Independent of frame rate.
 */
export function stuckCheck(s:Progress,x:number,z:number,dt:number,trying:boolean){if(!trying){s.ax=s.qx=x;s.az=s.qz=z;s.slow=s.quick=0;return false;}
 if(Math.hypot(x-s.ax,z-s.az)>3.5){s.ax=x;s.az=z;s.slow=0;}else s.slow+=dt;
 s.quick+=dt;let pinned=false;if(s.quick>=1){pinned=Math.hypot(x-s.qx,z-s.qz)<.6;s.qx=x;s.qz=z;s.quick=0;}
 if(pinned||s.slow>2.4){s.ax=s.qx=x;s.az=s.qz=z;s.slow=s.quick=0;return true;}return false;}
/** A random nearby point to break away to after getting stuck: 7 to 14 m off in a random direction, reachable in a straight line when possible. */
export function escapePoint(solids:Rect[],x:number,z:number,random:()=>number=Math.random){let fallback:{x:number;z:number}|null=null;
 for(let i=0;i<14;i++){const a=random()*Math.PI*2,d=7+random()*7,tx=x+Math.sin(a)*d,tz=z+Math.cos(a)*d;if(navClearance(solids,tx,tz)<2)continue;if(lineClear(solids,x,z,tx,tz,1))return {x:tx,z:tz};fallback=fallback??{x:tx,z:tz};}
 return fallback??nearestOpen(solids,x,z,12,3);}

// ---------------------------------------------------------------- search and combat positions
/**
 * Where an AI car with no known enemy goes looking next. Candidates are the landmarks of the layout (centre lanes,
 * capture points, pickups, flags, the enemy spawn). Points towards the enemy side score higher, points just visited or
 * already taken by a teammate score lower, and a random term keeps patrols from repeating.
 */
export function searchPoint(L:Layout,team:number,index:number,x:number,z:number,avoid:{x:number;z:number}[],first:boolean,random:()=>number=Math.random){
 const foe=L.spawns.filter((_,i)=>(i<3?0:1)!==team),ex=foe.reduce((a,p)=>a+p[0],0)/Math.max(1,foe.length),ez=foe.reduce((a,p)=>a+p[1],0)/Math.max(1,foe.length);
 const lane=(index%3-1)*16,side=team===0?1:-1;// lanes run across the diagonal between the two spawns
 const mid={x:lane*Math.SQRT1_2*side,z:lane*Math.SQRT1_2*side};if(first)return mid;
 const candidates=[mid,{x:0,z:0},{x:ex*.55,z:ez*.55},{x:ex*.85,z:ez*.85},...L.capture,...L.pickups,...L.flags,L.charge];let best=mid,bestScore=-Infinity;
 for(const p of candidates){const d=Math.hypot(p.x-x,p.z-z);if(d<18)continue;let s=random()*45-Math.hypot(p.x-ex,p.z-ez)*.22-d*.08;for(const a of avoid)if(Math.hypot(a.x-p.x,a.z-p.z)<14)s-=30;if(s>bestScore){bestScore=s;best=p;}}
 return best;}
/**
 * Fighting position around a visible enemy: on a circle at the weapon's preferred distance, a little further round than
 * where the car is now, so it keeps moving around its target instead of parking or spinning in front of it.
 */
export function orbitGoal(index:number,loadout:number,x:number,z:number,ex:number,ez:number,range:number){const reach=loadout===1?7:loadout===4?range*.5:range*.67,side=index%2?1:-1,lead=(loadout===0||loadout===2?.7:.45)*side,a=Math.atan2(x-ex,z-ez)+lead,edge=ARENA-6;
 return {x:Math.max(-edge,Math.min(edge,ex+Math.sin(a)*reach)),z:Math.max(-edge,Math.min(edge,ez+Math.cos(a)*reach)),reach};}
