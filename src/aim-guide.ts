// What the player's gun will do, drawn in the world: a dashed ground line along the shot (a widening fan
// for spread weapons), the arc of a lobbed shell, and a circle where it lands or how wide it bursts.
import * as THREE from 'three';

const LIFT=.2,DASH=.85,GAP=.55,DASHES=28,DOTS=20;
export type GuideShot={
 /** Line start on the ground (the muzzle), its heading (0 faces −z) and length in metres. */
 x:number;z:number;angle:number;length:number;
 /** Half-angle of the weapon's spread; the line widens into a fan by it. */
 spread:number;color:number;
 /** Flight path of a lobbed shell, drawn as dots. */
 arc?:{x:number;y:number;z:number}[];
 /** Landing or burst circle. */
 ring?:{x:number;z:number;radius:number};
 /** Dim the whole guide (nothing in range, or the line stops on cover). */
 dim?:boolean;
};
export class AimGuide{
 private group=new THREE.Group();private dashes:THREE.Mesh;private rim:THREE.Mesh;private fill:THREE.Mesh;private dots:THREE.InstancedMesh;
 private clock=0;private color=new THREE.Color();private matrix=new THREE.Matrix4();
 constructor(scene:THREE.Scene,private ground:(x:number,z:number)=>number){
  const geometry=new THREE.BufferGeometry(),index:number[]=[];for(let i=0;i<DASHES;i++){const k=i*4;index.push(k,k+1,k+2,k+1,k+3,k+2);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(DASHES*4*3),3));geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(DASHES*4*4),4));geometry.setIndex(index);
  this.dashes=new THREE.Mesh(geometry,decal({vertexColors:true}));
  this.rim=new THREE.Mesh(annulus(.86,1,48),decal({opacity:.85}));this.fill=new THREE.Mesh(annulus(0,.86,48),decal({opacity:.16}));
  this.dots=new THREE.InstancedMesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false}),DOTS);
  for(const m of [this.dashes,this.rim,this.fill,this.dots]){m.frustumCulled=false;m.renderOrder=8;this.group.add(m);}
  this.group.name='fx-aim-guide';this.group.visible=false;scene.add(this.group);}
 show(s:GuideShot,dt:number){this.clock+=dt;this.group.visible=true;const fade=s.dim?.45:1;this.color.setHex(s.color);
  // Dashes stream outward along the line so it reads as "shots go this way".
  const fx=-Math.sin(s.angle),fz=-Math.cos(s.angle),rx=-fz,rz=fx,pos=this.dashes.geometry.attributes.position as THREE.BufferAttribute,col=this.dashes.geometry.attributes.color as THREE.BufferAttribute,offset=(this.clock*3.2)%(DASH+GAP),start=1.1;
  const widen=Math.tan(Math.min(.5,s.spread)),base=s.arc?.07:.13,alpha=s.arc?.32:.62;
  for(let i=0;i<DASHES;i++){const a=start+offset+(i-1)*(DASH+GAP),b=a+DASH,s0=Math.max(start,Math.min(s.length,a)),s1=Math.max(start,Math.min(s.length,b));
   for(const [j,d] of [[0,s0],[2,s1]] as const){const w=base+(d-start)*widen,cx=s.x+fx*d,cz=s.z+fz*d;for(const side of [0,1]){const v=i*4+j+side,sign=side?1:-1,x=cx+rx*w*sign,z=cz+rz*w*sign;pos.setXYZ(v,x,this.ground(x,z)+LIFT,z);
    const along=d/Math.max(1,s.length),o=s1-s0>.01?alpha*fade*(1-along*.55)*Math.min(1,(d-start)/1.5+.35)/(1+w*.9):0;col.setXYZW(v,this.color.r,this.color.g,this.color.b,o);}}}
  pos.needsUpdate=true;col.needsUpdate=true;
  if(s.ring){const r=s.ring.radius,beat=1+.05*Math.sin(this.clock*8);for(const [mesh,opacity] of [[this.rim,.85],[this.fill,.13+.07*Math.sin(this.clock*6)]] as const){lay(mesh,s.ring.x,s.ring.z,r*beat,this.ground);const m=mesh.material as THREE.MeshBasicMaterial;m.color.copy(this.color);m.opacity=opacity*fade;mesh.visible=true;}}
  else{this.rim.visible=this.fill.visible=false;}
  if(s.arc&&s.arc.length>1){const n=Math.min(DOTS,s.arc.length);for(let i=0;i<n;i++){const p=s.arc[Math.round(i*(s.arc.length-1)/Math.max(1,n-1))],k=.7+.3*(i/n);this.matrix.makeScale(k,k,k).setPosition(p.x,p.y,p.z);this.dots.setMatrixAt(i,this.matrix);}this.dots.count=n;this.dots.instanceMatrix.needsUpdate=true;(this.dots.material as THREE.MeshBasicMaterial).color.copy(this.color);(this.dots.material as THREE.MeshBasicMaterial).opacity=.8*fade;this.dots.visible=true;}
  else this.dots.visible=false;}
 hide(){this.group.visible=false;}
 get visible(){return this.group.visible;}
}
function decal(extra:THREE.MeshBasicMaterialParameters){return new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,...extra});}
/** Flat ring in the x/z plane, unit outer radius; `lay` drapes it over the terrain. */
function annulus(inner:number,outer:number,segments:number){const g=new THREE.BufferGeometry(),flat:number[]=[],index:number[]=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;for(const r of [inner,outer])flat.push(Math.sin(a)*r,0,Math.cos(a)*r);if(i<segments){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const template=new Float32Array(flat);g.setAttribute('position',new THREE.BufferAttribute(template.slice(),3));g.setIndex(index);g.userData.template=template;return g;}
function lay(mesh:THREE.Mesh,cx:number,cz:number,radius:number,ground:(x:number,z:number)=>number){const g=mesh.geometry,t=g.userData.template as Float32Array,out=g.attributes.position as THREE.BufferAttribute;for(let i=0;i<t.length/3;i++){const x=cx+t[i*3]*radius,z=cz+t[i*3+2]*radius;out.setXYZ(i,x,ground(x,z)+LIFT+.02,z);}out.needsUpdate=true;}
