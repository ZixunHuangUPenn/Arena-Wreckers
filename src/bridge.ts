// Bridges and built landforms (ring arena walls): their drivable decks, projectile hits, collision
// against impassable ground, and the meshes. Decks are generated from the active terrain layout.
import * as THREE from 'three';
import {terrainHeight,terrainBlocked,terrainHazard,terrainPit,blockedness,mapLayout,bridgeLocal,ringWalls,type Bridge} from './terrain';
import type {Rect} from './physics';
import {surfaceMaterial} from './environment';

const ARCH=.45;
function bridgeDeck(b:Bridge,u:number){const t=(u+b.half)/(2*b.half),camber=Math.abs(u)<b.span?ARCH*(1-(u/b.span)**2):0;return b.h0+(b.h1-b.h0)*t+camber;}
/** Height of a bridge deck at a point, or null off every deck. */
export function deckHeight(x:number,z:number){let best:number|null=null;for(const b of mapLayout().bridges){const l=bridgeLocal(b,x,z);if(l){const h=bridgeDeck(b,l.u);if(best===null||h>best)best=h;}}return best;}
/** Surface a car rests on: the deck when it is on (or stepping onto) one, otherwise the ground. */
export function driveHeight(x:number,z:number,previousY:number){const deck=deckHeight(x,z);return deck!==null&&previousY>deck-1.4?deck:terrainHeight(x,z);}
/** Swept projectile test against the deck slabs; returns the fraction of the step, or null. */
export function bridgeHit(x:number,y:number,z:number,dx:number,dy:number,dz:number){for(let i=0;i<=16;i++){const t=i/16,h=deckHeight(x+dx*t,z+dz*t);if(h!==null&&y+dy*t>=h-.6&&y+dy*t<=h+.12)return t;}return null;}
/** True where a car body at height y cannot be (with `fall`, lethal gorges, rivers and lakes are open so the car can drop in): off the deck over a gorge, cliffs, deep water, lava, or a drop (an overpass edge). */
/** True just outside the railed part of a deck, for a body at deck height: the railings are solid, so a car cannot leave a bridge sideways. */
export function railBlocked(x:number,z:number,y:number){for(const b of mapLayout().bridges){const c=Math.cos(b.angle),s=Math.sin(b.angle),dx=x-b.x,dz=z-b.z,u=dx*c+dz*s,v=Math.abs(-dx*s+dz*c);if(Math.abs(u)<=b.span+.6&&v>b.halfWidth&&v<b.halfWidth+2.2&&Math.abs(y-bridgeDeck(b,u))<1.4)return true;}return false;}
/** With `dive` (small cars) the walls and floor of a dry gorge are open: the car drives down into it and climbs back out. */
export function groundBlocked(x:number,z:number,y:number,fall=false,dive=false){const deck=deckHeight(x,z);if(deck!==null&&y>deck-1.4)return false;if((fall||dive)&&railBlocked(x,z,y))return true;if(dive&&terrainPit(x,z))return false;if(fall&&terrainHazard(x,z))return false;// a driver may go over the edge into a river, lake or lava
 return terrainBlocked(x,z)||y-terrainHeight(x,z)>2.8;}
/**
 * Checks a car footprint against impassable ground. Returns the push-out direction (unit x/z) or null.
 * The normal points from the blocked part of the footprint towards its centre, which works for cliff
 * edges and deck edges alike (the deck edge is not part of the terrain field).
 */
export function groundContact(x:number,z:number,angle:number,hx:number,hz:number,y:number,fall=false,dive=false){const c=Math.cos(angle),s=Math.sin(angle);let nx=0,nz=0,hit=false;
 for(const [a,b] of [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1],[.5,1],[-.5,1],[.5,-1],[-.5,-1],[1,.5],[-1,.5],[1,-.5],[-1,-.5]]){const lx=a*hx*.96,lz=b*hz*.96,px=x+lx*c+lz*s,pz=z-lx*s+lz*c;if(!groundBlocked(px,pz,y,fall,dive))continue;hit=true;nx+=x-px;nz+=z-pz;}
 if(!hit)return null;let l=Math.hypot(nx,nz);if(l<1e-6){// blocked symmetrically: fall back to the terrain gradient
  nx=blockedness(x-1,z)-blockedness(x+1,z);nz=blockedness(x,z-1)-blockedness(x,z+1);l=Math.hypot(nx,nz)||1;}
 return {nx:nx/l,nz:nz/l};}

// ---------------------------------------------------------------- meshes
function placeOnBridge(b:Bridge,u:number,v:number){const c=Math.cos(b.angle),s=Math.sin(b.angle);return {x:b.x+c*u-s*v,z:b.z+s*u+c*v};}
function deckGeometry(b:Bridge,thickness:number){const positions:number[]=[],uvs:number[]=[],indices:number[]=[],steps=Math.ceil(b.half*2/.5);
 const ring=(u:number)=>{const h=bridgeDeck(b,u),corners:[number,number][]=[[-b.halfWidth,0],[b.halfWidth,0],[b.halfWidth,-thickness],[-b.halfWidth,-thickness]];return corners.map(([v,dy])=>{const p=placeOnBridge(b,u,v);return [p.x,h+dy,p.z] as [number,number,number];});};
 // Each face gets its own vertices so the normals stay crisp.
 const faces:[number,number][]=[[0,1],[1,2],[2,3],[3,0]];
 for(const [f,[a0,a1]] of faces.map((f,i)=>[i,f] as [number,[number,number]])){const start=positions.length/3;for(let i=0;i<=steps;i++){const u=-b.half+i*(b.half*2/steps),r=ring(u);positions.push(...r[a0],...r[a1]);const across=f===0?b.halfWidth*2:f===2?b.halfWidth*2:thickness;uvs.push(u/4,0,u/4,across/4);if(i){const k=start+i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;}
/** Builds every bridge and ring arena of the active layout into `world`; returns the extra solid colliders. */
export function buildBridge(world:THREE.Group):Rect[]{const layout=mapLayout(),parts:Rect[]=[];
 const road=surfaceMaterial('asphalt',{repeat:1}),concrete=surfaceMaterial('concrete',{color:0xc9c4b8}),steel=surfaceMaterial('container',{color:0x6f7a7e,metalness:.65,roughness:.42}),paint=surfaceMaterial('container',{color:layout.style===2?0xb8412f:layout.style===3?0x4d5054:0xc89a32,metalness:.4,roughness:.5}),lines=new THREE.MeshStandardMaterial({color:0xe9e2c8,roughness:.7});
 const add=(mesh:THREE.Mesh)=>{mesh.castShadow=mesh.receiveShadow=true;world.add(mesh);return mesh;};
 const beam=(b:Bridge,u0:number,u1:number,v:number,y0:number,y1:number,w:number,m:THREE.Material)=>{// a box from u0 to u1 that follows the deck slope
  const a=placeOnBridge(b,u0,v),c=placeOnBridge(b,u1,v),len=Math.hypot(c.x-a.x,c.z-a.z),ha=bridgeDeck(b,u0),hc=bridgeDeck(b,u1),mesh=new THREE.Mesh(new THREE.BoxGeometry(len,y1-y0,w),m);
  mesh.position.set((a.x+c.x)/2,(ha+hc)/2+(y0+y1)/2,(a.z+c.z)/2);mesh.rotation.order='YZX';mesh.rotation.set(0,-b.angle,Math.atan2(hc-ha,len));return add(mesh);};
 for(const b of layout.bridges){
  add(new THREE.Mesh(deckGeometry(b,.55),road));
  // Painted edge lines and a centre dash keep the deck readable from the high camera.
  for(const v of [-b.halfWidth+.45,b.halfWidth-.45])for(let u=-b.half+.3;u<b.half-.3;u+=2)beam(b,u,Math.min(b.half-.3,u+2),v,.005,.03,.14,lines);
  for(let u=-b.half+1;u<b.half-1;u+=3)beam(b,u,u+1.6,0,.005,.03,.16,lines);
  // Steel box girders under both edges and painted truss railings along the span.
  for(const side of [-1,1]){beam(b,-b.half+.4,b.half-.4,side*(b.halfWidth-.55),-1.35,-.5,.7,steel);
   for(let u=-b.span-.6;u<=b.span+.6;u+=1.6){const p=placeOnBridge(b,u,side*(b.halfWidth-.12)),post=new THREE.Mesh(new THREE.BoxGeometry(.16,1.05,.16),paint);post.position.set(p.x,bridgeDeck(b,u)+.52,p.z);add(post);}
   beam(b,-b.span-.6,b.span+.6,side*(b.halfWidth-.12),.95,1.08,.2,paint);beam(b,-b.span-.6,b.span+.6,side*(b.halfWidth-.12),.45,.55,.12,paint);
  }
 }
 // Ring arenas: concrete barrier segments with hazard caps, gate pylons with lamps.
 const barrier=surfaceMaterial('concrete',{color:0xd8d2c6}),hazard=new THREE.MeshStandardMaterial({color:0xd9ad35,roughness:.6}),lamp=new THREE.MeshBasicMaterial({color:new THREE.Color(1,.8,.5).multiplyScalar(3)});
 for(const ring of layout.rings){for(const s of ringWalls(ring)){const base=terrainHeight(s.x,s.z),wall=new THREE.Mesh(new THREE.BoxGeometry(s.length,1.5,.9),barrier);wall.position.set(s.x,base+.7,s.z);wall.rotation.y=s.angle;add(wall);const cap=new THREE.Mesh(new THREE.BoxGeometry(s.length,.12,.94),hazard);cap.position.set(s.x,base+1.48,s.z);cap.rotation.y=s.angle;add(cap);
   parts.push({x:s.x,z:s.z,hx:s.length/2,hz:.45,angle:s.angle,minY:base-1,maxY:base+1.5});}
  for(const g of ring.gates)for(const side of [-1,1]){const a=g+side*.34,x=ring.x+Math.cos(a)*ring.radius,z=ring.z+Math.sin(a)*ring.radius,base=terrainHeight(x,z),pylon=new THREE.Mesh(new THREE.BoxGeometry(.8,4.2,.8),steel);pylon.position.set(x,base+2.1,z);add(pylon);const head=new THREE.Mesh(new THREE.BoxGeometry(.9,.25,.9),lamp);head.position.set(x,base+4.3,z);world.add(head);parts.push({x,z,hx:.4,hz:.4,angle:0,minY:base-1,maxY:base+4.2});}}
 return parts;
}
