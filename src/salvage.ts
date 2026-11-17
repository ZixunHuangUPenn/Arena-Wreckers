import * as THREE from 'three';
import {CRATE_LIFE,CRATE_RADIUS,CRATE_RECOVER,crateTier,partColors,addParts,noParts,type Parts,type PartKind} from './progression';
// Battle salvage: the crates an enemy wreck leaves behind, and the burning patches of the Bulwark mortar's
// level 9 mod. Only meshes and timers live here; the game loop decides who collects and who takes damage.

export type Crate={group:THREE.Group;x:number;z:number;ttl:number;parts:Parts;tier:PartKind};
export type FirePatch={mesh:THREE.Mesh;x:number;z:number;ttl:number;radius:number;dps:number;team:number;tick:number};
const box=new THREE.BoxGeometry(.9,.62,.9),lid=new THREE.BoxGeometry(.98,.12,.98),band=new THREE.BoxGeometry(.94,.14,.94),beam=new THREE.CylinderGeometry(.28,.5,7,12,1,true),ring=new THREE.RingGeometry(.9,1.25,32),disc=new THREE.CircleGeometry(1,28);
const steel=new THREE.MeshStandardMaterial({color:0x3a3f45,metalness:.75,roughness:.42});
const tierMaterials=Object.fromEntries((['common','precision','core'] as PartKind[]).map(k=>{const c=new THREE.Color(partColors[k]);return [k,{
 glow:new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.6,metalness:.3,roughness:.35}),
 beam:new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),
 ring:new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})}];})) as unknown as Record<PartKind,{glow:THREE.Material;beam:THREE.MeshBasicMaterial;ring:THREE.MeshBasicMaterial}>;
const fireMaterial=new THREE.MeshBasicMaterial({color:0xff6a1c,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});
export class Salvage{
 crates:Crate[]=[];patches:FirePatch[]=[];clock=0;
 constructor(private scene:THREE.Scene,private height:(x:number,z:number)=>number){}
 drop(x:number,z:number,parts:Parts){const tier=crateTier(parts),m=tierMaterials[tier],group=new THREE.Group();
  const body=new THREE.Mesh(box,steel);body.castShadow=true;body.position.y=.31;const top=new THREE.Mesh(lid,steel);top.position.y=.66;const stripe=new THREE.Mesh(band,m.glow);stripe.position.y=.38;
  const crate=new THREE.Group();crate.add(body,top,stripe);crate.name='crate';const light=new THREE.Mesh(beam,m.beam);light.position.y=3.5;const halo=new THREE.Mesh(ring,m.ring);halo.rotation.x=-Math.PI/2;halo.position.y=.06;
  group.add(crate,light,halo);group.position.set(x,this.height(x,z),z);group.scale.setScalar(tier==='core'?1.3:tier==='precision'?1.12:1);this.scene.add(group);
  const c:Crate={group,x,z,ttl:CRATE_LIFE,parts,tier};this.crates.push(c);return c;}
 /** Ages crates and patches. `collect` is asked for each crate in pickup range and returns true when taken. */
 update(dt:number,collector:{x:number;z:number}|null,collect:(c:Crate)=>void){this.clock+=dt;
  for(let i=this.crates.length-1;i>=0;i--){const c=this.crates[i];c.ttl-=dt;const crate=c.group.getObjectByName('crate');if(crate){crate.rotation.y+=dt*1.6;crate.position.y=.25+Math.sin(this.clock*3+c.x)*.12;}
   c.group.visible=c.ttl>3||Math.sin(c.ttl*18)>-.2;
   if(collector&&Math.hypot(collector.x-c.x,collector.z-c.z)<CRATE_RADIUS){collect(c);this.remove(i);continue;}
   if(c.ttl<=0)this.remove(i);}
  for(let i=this.patches.length-1;i>=0;i--){const p=this.patches[i];p.ttl-=dt;(p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,Math.min(.5,p.ttl*.4))*(.8+Math.sin(this.clock*14+i)*.2);if(p.ttl<=0){this.scene.remove(p.mesh);(p.mesh.material as THREE.Material).dispose();this.patches.splice(i,1);}}}
 private remove(i:number){this.scene.remove(this.crates[i].group);this.crates.splice(i,1);}
 /** End of match: the recovery truck brings back half of every crate still on the field. */
 recover(){const total=noParts();for(const c of this.crates)addParts(total,c.parts,CRATE_RECOVER);return total;}
 firePatch(x:number,z:number,radius:number,ttl:number,dps:number,team:number){const mesh=new THREE.Mesh(disc,fireMaterial.clone());mesh.rotation.x=-Math.PI/2;mesh.scale.setScalar(radius);mesh.position.set(x,this.height(x,z)+.08,z);this.scene.add(mesh);this.patches.push({mesh,x,z,ttl,radius,dps,team,tick:0});}
 clear(){for(let i=this.crates.length-1;i>=0;i--)this.remove(i);for(const p of this.patches){this.scene.remove(p.mesh);(p.mesh.material as THREE.Material).dispose();}this.patches.length=0;}
}
