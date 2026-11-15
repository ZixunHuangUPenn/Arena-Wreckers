// Generated vehicles: every hull is a lofted set of rounded cross-sections, so the five cars have smooth
// bodywork, real wheel wells and separate spinning wheels instead of stacked boxes.
// Local axes: +X right, +Y up, -Z forward (the game drives cars towards -Z).
import * as THREE from 'three';
import {joinGeometries} from './environment';

type Station={z:number;hw:number;yb:number;yt:number;n?:number;tw?:number};
type Bucket='paint'|'steel'|'dark'|'rubber'|'glass'|'chrome'|'lamp'|'tail'|'hazard'|'glow';
const sgnPow=(v:number,e:number)=>Math.sign(v)*Math.pow(Math.abs(v),e);
/** Skins a row of rounded-rectangle cross-sections. `n` is the squareness (2 = ellipse, 8 = boxy), `tw` narrows the top. */
export function loft(stations:Station[],ring=28){
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 const point=(s:Station,k:number)=>{const a=k/ring*Math.PI*2,e=2/(s.n??5),cx=sgnPow(Math.cos(a),e),cy=sgnPow(Math.sin(a),e),mid=(s.yb+s.yt)/2,hh=(s.yt-s.yb)/2;return [cx*s.hw*(1+((s.tw??1)-1)*(cy+1)/2),mid+cy*hh,s.z];};
 stations.forEach((s,i)=>{for(let k=0;k<ring;k++){const p=point(s,k);positions.push(p[0],p[1],p[2]);uvs.push(k/ring*4,s.z*.5);}if(i)for(let k=0;k<ring;k++){const a=(i-1)*ring+k,b=(i-1)*ring+(k+1)%ring,c=a+ring,d=b+ring;indices.push(a,b,c,b,d,c);}});
 // Flat caps with their own vertices keep a crisp edge at both ends.
 for(const [index,flip] of [[0,false],[stations.length-1,true]] as [number,boolean][]){const s=stations[index],start=positions.length/3;positions.push(0,(s.yb+s.yt)/2,s.z);uvs.push(0,0);for(let k=0;k<ring;k++){const p=point(s,k);positions.push(p[0],p[1],p[2]);uvs.push(p[0],p[1]);}for(let k=0;k<ring;k++){const a=start+1+k,b=start+1+(k+1)%ring;if(flip)indices.push(start,a,b);else indices.push(start,b,a);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
 return outward(g);
}
/** Flips the winding if needed so faces point outwards, then recomputes normals. */
function outward(g:THREE.BufferGeometry){const indices=Array.from(g.index!.array),p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),centre=new THREE.Vector3();g.computeBoundingBox();g.boundingBox!.getCenter(centre);let volume=0;
 for(let i=0;i<indices.length;i+=3){a.fromBufferAttribute(p,indices[i]).sub(centre);b.fromBufferAttribute(p,indices[i+1]).sub(centre);c.fromBufferAttribute(p,indices[i+2]).sub(centre);volume+=a.dot(b.cross(c));}
 if(volume<0){for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}g.setIndex(indices);}
 g.computeVertexNormals();return g;
}
const box=(w:number,h:number,d:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const g=new THREE.BoxGeometry(w,h,d);if(rx)g.rotateX(rx);if(ry)g.rotateY(ry);if(rz)g.rotateZ(rz);g.translate(x,y,z);return g;};
/** Cylinder between two points. */
const rod=(ax:number,ay:number,az:number,bx:number,by:number,bz:number,radius:number,sides=8,radiusEnd=radius)=>{const from=new THREE.Vector3(ax,ay,az),to=new THREE.Vector3(bx,by,bz),length=from.distanceTo(to),g=new THREE.CylinderGeometry(radiusEnd,radius,length,sides);g.translate(0,length/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(ax,ay,az);return g;};
const tube=(points:[number,number,number][],radius:number)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.25),points.length*6,radius,7,false);
const mirror=(g:THREE.BufferGeometry)=>{const m=g.clone();m.scale(-1,1,1);const index=m.index;if(index){const a=index.array as Uint16Array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}}else{const p=m.attributes.position,n=m.attributes.normal,uv=m.attributes.uv;for(let i=0;i<p.count;i+=3)for(const attr of [p,n,uv]){if(!attr)continue;const size=attr.itemSize,arr=attr.array as Float32Array;for(let k=0;k<size;k++){const t=arr[(i+1)*size+k];arr[(i+1)*size+k]=arr[(i+2)*size+k];arr[(i+2)*size+k]=t;}}}return m;};

const tyreCache=new Map<string,{tyre:THREE.BufferGeometry;rim:THREE.BufferGeometry}>();
/** Tyre with rounded shoulders and tread grooves plus a dished five-spoke rim, built around the X axis. */
function wheelGeometry(radius:number,width:number){
 const key=radius+'|'+width;if(tyreCache.has(key))return tyreCache.get(key)!;
 const half=width/2,inner=radius*.58,profile:THREE.Vector2[]=[];
 // Lathe profile (x = distance from axle, y = position across the tread), from inner bead round the tread to the other bead.
 for(const [r,y] of [[inner,-half*.82],[radius*.8,-half],[radius*.95,-half*.9],[radius,-half*.62],[radius*.975,-half*.56],[radius*.975,-half*.44],[radius,-half*.38],[radius,-half*.1],[radius*.975,-half*.04],[radius*.975,half*.04],[radius,half*.1],[radius,half*.38],[radius*.975,half*.44],[radius*.975,half*.56],[radius,half*.62],[radius*.95,half*.9],[radius*.8,half],[inner,half*.82]])profile.push(new THREE.Vector2(r,y));
 const tyre=outward(new THREE.LatheGeometry(profile,28));tyre.rotateZ(Math.PI/2);tyre.userData.shared=true;
 const parts:THREE.BufferGeometry[]=[],barrel=new THREE.CylinderGeometry(inner*1.02,inner*1.02,width*.78,24,1,true);barrel.rotateZ(Math.PI/2);parts.push(barrel);
 for(const side of [-1,1]){const dish=new THREE.CylinderGeometry(inner*.3,inner*1.02,width*.16,24);dish.rotateZ(-side*Math.PI/2);dish.translate(side*half*.5,0,0);parts.push(dish);const hub=new THREE.CylinderGeometry(inner*.24,inner*.3,width*.2,12);hub.rotateZ(-side*Math.PI/2);hub.translate(side*half*.62,0,0);parts.push(hub);for(let i=0;i<5;i++){const spoke=box(width*.1,inner*.8,inner*.2,side*half*.56,inner*.55,0);spoke.rotateX(i/5*Math.PI*2);parts.push(spoke);}}
 const result={tyre,rim:joinGeometries(parts)};result.rim.userData.shared=true;tyreCache.set(key,result);return result;
}

export type VehicleVisual=THREE.Group&{userData:{materials:THREE.Material[];turretZ:number;turret:THREE.Group;paint:THREE.MeshPhysicalMaterial;body:THREE.Group;wheels:{mesh:THREE.Group;steer:boolean;radius:number}[]}};
/** Builds one of the five vehicles (0 Mantis, 1 Punisher, 2 Retro, 3 Pummeler, 4 Bigrig) with its weapon on a `Turret` node. */
export function buildVehicle(kind:number,color:number,gunHeight:number):VehicleVisual{
 const materials:Record<Bucket,THREE.Material>={
  paint:new THREE.MeshPhysicalMaterial({name:'Paint',color,metalness:.55,roughness:.38,clearcoat:1,clearcoatRoughness:.12}),
  steel:new THREE.MeshStandardMaterial({color:0x4d565c,metalness:.85,roughness:.42}),
  dark:new THREE.MeshStandardMaterial({color:0x15181b,metalness:.4,roughness:.65}),
  rubber:new THREE.MeshStandardMaterial({color:0x0c0c0d,metalness:0,roughness:.92}),
  glass:new THREE.MeshPhysicalMaterial({color:0x0c1820,metalness:.9,roughness:.06,clearcoat:1,clearcoatRoughness:.03}),
  chrome:new THREE.MeshStandardMaterial({color:0xd8dde0,metalness:1,roughness:.12}),
  lamp:new THREE.MeshStandardMaterial({color:0xfff4d6,emissive:0xffe9b8,emissiveIntensity:5}),
  tail:new THREE.MeshStandardMaterial({color:0x5a0a08,emissive:0xff2a14,emissiveIntensity:3}),
  hazard:new THREE.MeshStandardMaterial({color:0xe0a81e,metalness:.2,roughness:.55}),
  glow:new THREE.MeshStandardMaterial({color:0x0a2a30,emissive:0x3fe8ff,emissiveIntensity:4}),
 };
 const root=new THREE.Group() as VehicleVisual,body=new THREE.Group(),turret=new THREE.Group();body.name='Body';turret.name='Turret';root.add(body);
 const hullParts:Partial<Record<Bucket,THREE.BufferGeometry[]>>={},turretParts:Partial<Record<Bucket,THREE.BufferGeometry[]>>={};
 const add=(bucket:Bucket,...g:THREE.BufferGeometry[])=>{(hullParts[bucket]??=[]).push(...g);};
 const both=(bucket:Bucket,g:THREE.BufferGeometry)=>add(bucket,g,mirror(g));
 const gun=(bucket:Bucket,...g:THREE.BufferGeometry[])=>{(turretParts[bucket]??=[]).push(...g);};
 const wheels:{x:number;z:number;radius:number;width:number;steer:boolean}[]=[];
 const axle=(z:number,x:number,radius:number,width:number,steer:boolean)=>{wheels.push({x,z,radius,width,steer},{x:-x,z,radius,width,steer});add('dark',rod(-x,radius,z,x,radius,z,.07,6));};
 const lights=(x:number,y:number,z:number,tailZ:number,tailY=y)=>{both('lamp',box(.26,.13,.08,x,y,z));both('tail',box(.3,.1,.06,x,tailY,tailZ));};
 let turretZ=0,deck=1;
 if(kind===0){ // Mantis: open-wheel buggy, exposed cage and rear wing
  add('paint',loft([{z:-1.84,hw:.3,yb:.34,yt:.52,n:3},{z:-1.5,hw:.52,yb:.28,yt:.62,n:4},{z:-.7,hw:.7,yb:.25,yt:.76,n:4},{z:.2,hw:.78,yb:.25,yt:.86,n:4},{z:1.1,hw:.74,yb:.27,yt:.94,n:4},{z:1.7,hw:.6,yb:.36,yt:.9,n:3},{z:1.84,hw:.45,yb:.45,yt:.82,n:3}]));
  add('glass',loft([{z:-.78,hw:.44,yb:.7,yt:.78,n:3},{z:-.45,hw:.5,yb:.72,yt:1.08,n:3,tw:.8},{z:-.2,hw:.5,yb:.74,yt:1.14,n:3,tw:.8}],18));
  add('dark',loft([{z:-.2,hw:.5,yb:.6,yt:.9,n:4},{z:.75,hw:.52,yb:.6,yt:.92,n:4}],14)); // cockpit tub
  for(const z of [-.15,.8])add('steel',tube([[-.72,.8,z],[-.62,1.42,z],[0,1.5,z],[.62,1.42,z],[.72,.8,z]],.045));
  both('steel',tube([[.62,1.42,-.15],[.63,1.47,.3],[.62,1.42,.8]],.04));both('steel',rod(.62,1.42,.8,.6,.9,1.55,.04));both('steel',rod(.62,1.42,-.15,.5,.72,-.9,.04));
  add('paint',box(2.1,.05,.46,0,1.5,1.62,.12));both('paint',box(.05,.34,.5,1.03,1.5,1.62));both('steel',rod(.45,.9,1.5,.45,1.5,1.62,.035));
  both('paint',loft([{z:-.5,hw:.2,yb:.3,yt:.62,n:3},{z:.9,hw:.24,yb:.3,yt:.7,n:3}].map(s=>({...s})),14).translate(.86,0,0)); // side pods
  both('chrome',tube([[.3,.86,1.3],[.42,.98,1.7],[.42,1.02,2.0]],.06));add('steel',box(.9,.34,.5,0,.96,1.25));add('dark',box(.7,.1,.34,0,1.16,1.25));
  for(const z of [-1.2,1.15]){both('steel',rod(.55,.5,z-.22,1.02,z<0?.42:.5,z,.03));both('steel',rod(.55,.5,z+.22,1.02,z<0?.42:.5,z,.03));both('chrome',rod(.6,.8,z,.98,z<0?.5:.58,z,.045));}
  add('hazard',box(1.1,.12,.08,0,.36,-1.88));lights(.34,.56,-1.74,1.86,.7);
  axle(-1.2,1.1,.42,.3,true);axle(1.15,1.08,.5,.38,false);turretZ=.3;deck=1.5;
 }else if(kind===1){ // Punisher: armoured pickup
  add('paint',loft([{z:-2.06,hw:.92,yb:.55,yt:.95,n:5},{z:-1.9,hw:1.1,yb:.45,yt:1.14,n:6},{z:-.8,hw:1.14,yb:.42,yt:1.2,n:6},{z:.4,hw:1.14,yb:.42,yt:1.16,n:6},{z:1.9,hw:1.14,yb:.44,yt:1.12,n:6},{z:2.06,hw:1.04,yb:.52,yt:1.04,n:5}]));
  add('glass',loft([{z:-.95,hw:1.0,yb:1.1,yt:1.2,n:5},{z:-.55,hw:1.02,yb:1.14,yt:1.8,n:5,tw:.84},{z:.3,hw:1.02,yb:1.14,yt:1.82,n:5,tw:.84},{z:.42,hw:1.0,yb:1.12,yt:1.7,n:5,tw:.86}],22));
  add('paint',loft([{z:-.66,hw:.9,yb:1.78,yt:1.9,n:5},{z:.36,hw:.9,yb:1.8,yt:1.92,n:5}],18));both('paint',box(.09,.72,.1,.9,1.47,-.62,-.5));both('paint',box(.09,.7,.12,.93,1.47,.36));
  add('dark',box(1.95,.06,1.5,0,1.14,1.25));both('paint',box(.14,.36,1.56,1.07,1.26,1.25));add('paint',box(2.28,.36,.12,0,1.26,2.02));both('steel',tube([[1.07,1.46,.5],[1.07,1.62,.7],[1.07,1.62,1.85],[1.07,1.46,2.0]],.04));
  add('steel',tube([[-.9,.5,-2.1],[-.92,1.15,-2.2],[0,1.22,-2.22],[.92,1.15,-2.2],[.9,.5,-2.1]],.055));add('steel',rod(-.92,.85,-2.2,.92,.85,-2.2,.045));add('steel',box(2.1,.2,.16,0,.52,-2.1),box(2.1,.2,.16,0,.54,2.1));
  both('dark',loft([{z:-1.86,hw:.16,yb:.92,yt:1.1,n:3},{z:-1.3,hw:.2,yb:1.0,yt:1.14,n:3},{z:-.74,hw:.16,yb:.92,yt:1.1,n:3}],12).translate(1.12,0,0));both('dark',loft([{z:.74,hw:.16,yb:.92,yt:1.1,n:3},{z:1.3,hw:.2,yb:1.0,yt:1.14,n:3},{z:1.86,hw:.16,yb:.92,yt:1.1,n:3}],12).translate(1.12,0,0));
  add('hazard',box(1.3,.09,.12,0,1.97,-.5));for(const x of [-.5,-.17,.17,.5])add('lamp',box(.2,.11,.06,x,1.97,-.57));add('dark',box(1.5,.3,.05,0,.86,-1.93));lights(.78,.98,-1.95,2.08,.86);
  add('steel',box(.5,.18,.5,0,1.24,1.2));axle(-1.3,1.1,.52,.4,true);axle(1.3,1.1,.52,.4,false);turretZ=1.2;deck=1.32;
 }else if(kind===2){ // Retro: long-nose muscle car
  add('paint',loft([{z:-2.16,hw:.9,yb:.46,yt:.72,n:4},{z:-1.95,hw:1.14,yb:.36,yt:.86,n:4},{z:-.9,hw:1.2,yb:.32,yt:.97,n:4},{z:.3,hw:1.22,yb:.32,yt:1.02,n:4},{z:1.5,hw:1.2,yb:.34,yt:.98,n:4},{z:2.02,hw:1.1,yb:.4,yt:.86,n:4},{z:2.16,hw:.92,yb:.48,yt:.76,n:4}]));
  add('glass',loft([{z:-.5,hw:.94,yb:.92,yt:1.0,n:4},{z:.05,hw:.98,yb:.95,yt:1.42,n:4,tw:.76},{z:.9,hw:.98,yb:.95,yt:1.44,n:4,tw:.76},{z:1.45,hw:.94,yb:.92,yt:1.02,n:4}],22));
  add('paint',loft([{z:.0,hw:.74,yb:1.4,yt:1.5,n:4},{z:.95,hw:.74,yb:1.42,yt:1.52,n:4}],18));both('paint',box(.08,.52,.09,.8,1.2,-.2,-.9));both('paint',box(.08,.5,.1,.8,1.2,1.18,.85));
  add('chrome',loft([{z:-2.26,hw:1.16,yb:.42,yt:.6,n:3},{z:-2.12,hw:1.2,yb:.4,yt:.62,n:3}],16),loft([{z:2.12,hw:1.2,yb:.42,yt:.62,n:3},{z:2.26,hw:1.16,yb:.44,yt:.6,n:3}],16));
  add('chrome',box(.5,.26,.6,0,1.1,-1.15),box(.56,.08,.66,0,1.26,-1.15));add('dark',box(.44,.12,.08,0,1.14,-1.46));for(const x of [-.32,.32])add('hazard',box(.2,.012,2.0,x,.985,-1.0),box(.2,.012,.6,x,1.0,1.8));
  both('chrome',tube([[1.24,.34,-.5],[1.27,.32,.2],[1.27,.32,1.1],[1.3,.36,1.45]],.06));add('dark',box(1.9,.2,.05,0,.7,-2.14));lights(.8,.72,-2.15,2.17,.72);both('lamp',box(.2,.12,.08,.5,.72,-2.15));
  axle(-1.35,1.12,.45,.36,true);axle(1.3,1.12,.47,.42,false);turretZ=.5;deck=1.5;
 }else if(kind===3){ // Pummeler: eight-wheel armoured carrier
  add('paint',loft([{z:-2.26,hw:.8,yb:.78,yt:1.18,n:6,tw:.8},{z:-1.85,hw:1.2,yb:.52,yt:1.5,n:7,tw:.72},{z:-.6,hw:1.24,yb:.5,yt:1.62,n:7,tw:.72},{z:1.7,hw:1.24,yb:.5,yt:1.62,n:7,tw:.72},{z:2.26,hw:1.0,yb:.72,yt:1.4,n:6,tw:.8}]));
  both('steel',box(.08,.5,3.5,1.27,.78,0,0,0,-.08));add('glass',box(1.1,.16,.06,0,1.3,-2.02,-.5));add('steel',box(1.3,.26,.1,0,1.3,-2.07,-.5));
  for(const [x,z] of [[-.45,-1.1],[.45,-1.1]]){const hatch=new THREE.CylinderGeometry(.3,.33,.1,16);hatch.translate(x,1.66,z);add('steel',hatch);}add('steel',box(1.2,.2,.6,0,1.68,1.75));both('dark',box(.24,.34,.9,1.0,1.5,1.4,0,0,-.3));
  add('steel',rod(.8,1.6,1.9,.8,3.0,2.0,.02,5));add('hazard',box(1.5,.1,.08,0,.76,-2.3));both('steel',tube([[.7,.9,-2.3],[.75,1.0,-2.42],[.75,1.25,-2.36]],.045));lights(.72,1.05,-2.22,2.28,1.1);
  for(const z of [-1.6,-.55,.5,1.55])axle(z,1.2,.5,.4,z<0);turretZ=.4;deck=1.62;
 }else{ // Bigrig: long-nose tractor with a gun platform
  add('dark',loft([{z:-2.4,hw:.8,yb:.55,yt:.9,n:6},{z:2.42,hw:.8,yb:.55,yt:.9,n:6}],14));
  add('paint',loft([{z:-2.42,hw:.7,yb:.8,yt:1.42,n:5},{z:-2.25,hw:.86,yb:.72,yt:1.56,n:5},{z:-1.3,hw:.94,yb:.72,yt:1.64,n:5}]));
  add('paint',loft([{z:-1.3,hw:1.16,yb:.7,yt:1.66,n:6},{z:-.2,hw:1.16,yb:.7,yt:1.66,n:6}]));
  add('glass',loft([{z:-1.36,hw:1.08,yb:1.6,yt:1.7,n:5},{z:-1.2,hw:1.12,yb:1.62,yt:2.3,n:5,tw:.9},{z:-.24,hw:1.12,yb:1.62,yt:2.32,n:5,tw:.92}],22));
  add('paint',loft([{z:-1.44,hw:1.04,yb:2.26,yt:2.36,n:5},{z:-1.2,hw:1.06,yb:2.28,yt:2.46,n:5},{z:-.2,hw:1.06,yb:2.28,yt:2.46,n:5}],18));both('paint',box(.1,.74,.1,1.04,1.96,-1.24,-.2));both('paint',box(.1,.72,.3,1.05,1.96,-.3));add('paint',box(2.2,.72,.08,0,1.96,-.2));
  add('chrome',box(1.2,.62,.08,0,1.14,-2.44));for(let i=0;i<6;i++)add('dark',box(1.1,.04,.03,0,.9+i*.1,-2.49));add('chrome',loft([{z:-2.62,hw:1.3,yb:.5,yt:.78,n:4},{z:-2.46,hw:1.34,yb:.48,yt:.8,n:4}],16));
  both('chrome',rod(1.0,.9,-.05,1.0,3.05,-.05,.085,10));both('dark',rod(1.0,2.4,-.05,1.0,2.95,-.05,.11,10));
  for(const x of [-1,1]){const tank=new THREE.CylinderGeometry(.3,.3,1.0,14);tank.rotateX(Math.PI/2);tank.translate(x*1.02,.72,-.75);add('chrome',tank);}
  add('steel',box(2.6,.14,2.5,0,.98,1.15));both('hazard',box(.06,.1,2.5,1.3,1.02,1.15));both('steel',box(.08,.34,2.5,1.26,1.2,1.15));
  for(const x of [-.6,-.2,.2,.6])add('lamp',box(.12,.07,.05,x,2.5,-1.36));both('dark',loft([{z:-2.2,hw:.2,yb:1.0,yt:1.22,n:3},{z:-1.6,hw:.24,yb:1.12,yt:1.26,n:3},{z:-1.0,hw:.2,yb:1.0,yt:1.22,n:3}],12).translate(1.1,0,0));
  lights(.86,1.02,-2.47,2.44,.8);axle(-1.6,1.15,.56,.4,true);axle(.75,1.12,.56,.58,false);axle(1.9,1.12,.56,.58,false);turretZ=1.15;deck=1.05;
 }
 // Weapon mount: a ring on the deck, a pedestal up to the firing height, then the gun itself pointing at -Z.
 const h=gunHeight,ring=new THREE.CylinderGeometry(.46,.52,.12,20);ring.translate(0,deck+.06,0);gun('steel',ring);if(h-deck>.35)gun('dark',rod(0,deck+.1,0,0,h-.16,0,.16,10));
 if(kind===0){gun('steel',box(.5,.26,.6,0,h,.05));for(const x of [-.14,.14]){gun('dark',rod(x,h+.02,-.2,x,h+.02,-1.25,.045,8));gun('steel',rod(x,h+.02,-1.0,x,h+.02,-1.32,.06,8));}gun('hazard',box(.2,.2,.3,.36,h-.02,.1));}
 else if(kind===1){gun('steel',box(.62,.34,.8,0,h,.1));gun('dark',rod(0,h+.02,-.3,0,h+.02,-1.1,.11,10),rod(0,h+.02,-1.0,0,h+.02,-1.2,.15,10));gun('steel',rod(0,h-.14,-.3,0,h-.14,-.9,.05,8));gun('paint',box(.7,.4,.06,0,h+.02,-.34));}
 else if(kind===2){gun('steel',box(.5,.3,.7,0,h,.1));gun('chrome',rod(0,h,-.25,0,h,-1.5,.07,10));for(let i=0;i<4;i++){const coil=new THREE.TorusGeometry(.15,.035,8,18);coil.translate(0,h,-.5-i*.26);gun('glow',coil);}gun('glow',rod(0,h,-1.5,0,h,-1.58,.09,10));}
 else if(kind===3){gun('steel',box(1.1,.62,1.3,0,h,.15));for(const x of [-.34,0,.34])for(const y of [-.15,.15]){gun('dark',rod(x,h+y,-.5,x,h+y,-.56,.13,10));gun('hazard',rod(x,h+y,-.4,x,h+y,-.53,.09,8));}gun('paint',box(1.16,.06,1.36,0,h+.34,.15));}
 else {gun('steel',loft([{z:-.7,hw:.5,yb:h-.3,yt:h+.3,n:5},{z:.8,hw:.62,yb:h-.34,yt:h+.36,n:5}],16));gun('dark',rod(0,h,-.6,0,h,-2.5,.13,12,.1));gun('steel',rod(0,h,-2.35,0,h,-2.75,.18,12),rod(0,h,-.6,0,h,-1.1,.2,12));gun('paint',box(1.3,.5,.08,0,h+.05,-.74));}
 const emit=(parts:Partial<Record<Bucket,THREE.BufferGeometry[]>>,parent:THREE.Group)=>{for(const key of Object.keys(parts) as Bucket[]){const mesh=new THREE.Mesh(joinGeometries(parts[key]!),materials[key]);mesh.castShadow=mesh.receiveShadow=true;mesh.name=key;parent.add(mesh);parts[key]!.forEach(g=>g.dispose());}};
 emit(hullParts,body);turret.position.z=turretZ;emit(turretParts,turret);body.add(turret);
 root.userData.wheels=wheels.map(w=>{const {tyre,rim}=wheelGeometry(w.radius,w.width),holder=new THREE.Group(),spin=new THREE.Group(),a=new THREE.Mesh(tyre,materials.rubber),b=new THREE.Mesh(rim,materials.chrome);a.castShadow=b.castShadow=true;a.receiveShadow=true;spin.add(a,b);spin.name='spin';holder.add(spin);holder.position.set(w.x,w.radius,w.z);root.add(holder);return {mesh:holder,steer:w.steer,radius:w.radius};});
 root.userData.materials=Object.values(materials);root.userData.turretZ=turretZ;root.userData.turret=turret;root.userData.paint=materials.paint as THREE.MeshPhysicalMaterial;root.userData.body=body;return root;
}
/** Visual-only wheel spin, steering lock, body roll and pitch. `distance` is metres travelled this frame (signed). */
export function animateVehicle(visual:THREE.Object3D,distance:number,steer:number,roll:number,pitch:number){const data=visual.userData;if(!data?.wheels)return;for(const w of data.wheels as {mesh:THREE.Group;steer:boolean;radius:number}[]){w.mesh.children[0].rotation.x-=distance/w.radius;if(w.steer)w.mesh.rotation.y=steer;}const body=data.body as THREE.Group;body.rotation.z=roll;body.rotation.x=pitch;}
