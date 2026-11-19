// Player aiming for the directional skills: turning a drag on the skill button (or the mouse) into a
// direction and distance, and the indicator drawn on the ground while the player is choosing.
import * as THREE from 'three';

/** A drag shorter than this (game-UI px) is still a tap, and dragging back inside it cancels. */
export const AIM_DEADZONE=14;
/** Drag length (game-UI px) that reaches the far end of the skill's range. Everything between the dead zone and this
 * maps linearly onto the range, so any spot inside the reach circle can be picked; the on-screen pad shows the scale. */
export const AIM_FULL=118;
/** What the player chose: heading (0 faces −z, like `car.aim`) and how far along the skill's range, 0..1. */
export type SkillAim={angle:number;power:number};
/** Reads a drag from the skill button. `heading` turns a screen vector into a world heading. */
export function dragAim(dx:number,dy:number,heading:(x:number,y:number)=>number,scale=1){const length=Math.hypot(dx,dy),dead=AIM_DEADZONE*scale,full=AIM_FULL*scale;if(length<=dead)return null;return {angle:heading(dx/length,dy/length),power:Math.min(1,(length-dead)/(full-dead))} as SkillAim;}
/** Distance in metres for a 0..1 drag between the nearest and farthest allowed cast. */
export function aimDistance(power:number,min:number,max:number){return min+(max-min)*Math.max(0,Math.min(1,power));}

type Shape={mesh:THREE.Mesh;flat:Float32Array};
const LIFT=.24,WHITE=new THREE.Color(0xffffff);
/** Ground decals for skill aiming. Every vertex is laid on the terrain each frame, so they follow slopes. */
export class AimIndicator{
 private group=new THREE.Group();private fan:Shape;private shaft:Shape;private head:Shape;private range:Shape;private lock:Shape;private spots:Shape[]=[];private rims:Shape[]=[];private pulse=0;
 constructor(scene:THREE.Scene,private ground:(x:number,z:number)=>number,spots=8){
  const fan:number[]=[],fanIndex:number[]=[],arc=24;for(let i=0;i<=arc;i++){const t=i/arc*2-1;fan.push(Math.sin(t)*.14,Math.cos(t)*.14,Math.sin(t)*.57,Math.cos(t)*.57,Math.sin(t),Math.cos(t));if(i<arc){const k=i*3;fanIndex.push(k,k+1,k+3,k+1,k+4,k+3,k+1,k+2,k+4,k+2,k+5,k+4);}}
  this.fan=this.shape(fan,fanIndex,.16);
  const shaft:number[]=[],shaftIndex:number[]=[],steps=18;for(let i=0;i<=steps;i++){const z=.1+i/steps*.82;shaft.push(-1,z,1,z);if(i<steps){const k=i*2;shaftIndex.push(k,k+1,k+2,k+1,k+3,k+2);}}
  this.shaft=this.shape(shaft,shaftIndex,.75);this.head=this.shape([-2.6,.9,2.6,.9,0,1,0,.9],[0,3,2,3,1,2],.9);
  this.range=this.shape(...ring(.985,1,96),.3);this.lock=this.shape(...ring(.8,1,36),.95);
  for(let i=0;i<spots;i++){this.spots.push(this.shape(...ring(0,.86,28,2),.2));this.rims.push(this.shape(...ring(.88,1,36),.95));}
  this.group.name='fx-skill-aim';this.group.visible=false;scene.add(this.group);}
 private shape(flat:number[],index:number[],opacity:number):Shape{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(flat.length/2*3),3));geometry.setIndex(index);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.frustumCulled=false;mesh.renderOrder=8;mesh.userData.opacity=opacity;this.group.add(mesh);return {mesh,flat:new Float32Array(flat)};}
 /** Lays a template on the ground: local +z points along `angle`, `sx`/`sz` scale across and along. */
 private place(s:Shape,cx:number,cz:number,angle:number,sx:number,sz:number){const fx=-Math.sin(angle),fz=-Math.cos(angle),rx=-fz,rz=fx,out=s.mesh.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<s.flat.length/2;i++){const lx=s.flat[i*2]*sx,lz=s.flat[i*2+1]*sz,x=cx+rx*lx+fx*lz,z=cz+rz*lx+fz*lz;out.setXYZ(i,x,this.ground(x,z)+LIFT,z);}out.needsUpdate=true;s.mesh.visible=true;}
 private begin(color:number,dt:number){this.pulse+=dt;this.group.visible=true;for(const child of this.group.children){child.visible=false;const m=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;m.color.setHex(color).lerp(WHITE,.3);m.opacity=child.userData.opacity;}}
 /** Hook: reach fan, centre arrow and a ring under the car that would be caught. */
 showHook(x:number,z:number,angle:number,range:number,cone:number,color:number,target:{x:number;z:number}|null,dt=0){this.begin(color,dt);
  this.squeeze(this.fan,x,z,angle,range,cone);this.place(this.shaft,x,z,angle,.3,range);this.place(this.head,x,z,angle,.3,range);
  if(target){const beat=1+.12*Math.sin(this.pulse*9);this.place(this.lock,target.x,target.z,0,2.6*beat,2.6*beat);(this.lock.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);}else (this.fan.mesh.material as THREE.MeshBasicMaterial).opacity=.09;}
 /** The fan template spans ±1 rad; re-lay it for the skill's real half-angle. */
 private squeeze(s:Shape,cx:number,cz:number,angle:number,range:number,cone:number){const out=s.mesh.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<s.flat.length/2;i++){const lx=s.flat[i*2],lz=s.flat[i*2+1],r=Math.hypot(lx,lz)*range,a=angle-Math.atan2(lx,lz)*cone,x=cx-Math.sin(a)*r,z=cz-Math.cos(a)*r;out.setXYZ(i,x,this.ground(x,z)+LIFT,z);}out.needsUpdate=true;s.mesh.visible=true;}
 /** Barrage: the reach circle, a line to the chosen spot and one circle per shell. */
 showBarrage(x:number,z:number,angle:number,distance:number,points:{x:number;z:number}[],radius:number,maxRange:number,color:number,dt=0){this.begin(color,dt);
  this.place(this.range,x,z,0,maxRange,maxRange);this.place(this.shaft,x,z,angle,.22,distance);this.place(this.head,x,z,angle,.22,distance);
  points.forEach((p,i)=>{if(i>=this.spots.length)return;const wave=.5+.5*Math.sin(this.pulse*7-i*.9);this.place(this.spots[i],p.x,p.z,0,radius,radius);this.place(this.rims[i],p.x,p.z,0,radius,radius);(this.spots[i].mesh.material as THREE.MeshBasicMaterial).opacity=.14+.2*wave;});}
 hide(){this.group.visible=false;}
 get visible(){return this.group.visible;}
}
/** Flat annulus template in (x,z) pairs with its triangle index. */
function ring(inner:number,outer:number,segments:number,bands=1):[number[],number[]]{const flat:number[]=[],index:number[]=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;for(let b=0;b<=bands;b++){const r=inner+(outer-inner)*b/bands;flat.push(Math.sin(a)*r,Math.cos(a)*r);}}const row=bands+1;for(let i=0;i<segments;i++)for(let b=0;b<bands;b++){const k=i*row+b;index.push(k,k+1,k+row,k+1,k+row+1,k+row);}return [flat,index];}
