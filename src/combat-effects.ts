import * as THREE from 'three';
import {terrainHeight} from './terrain';
// Fixed caps keep fire, smoke and tyre marks from growing during endless matches.
export class CombatEffects {
 private live:{mesh:THREE.Mesh;ttl:number;life:number;rise:number;grow:number}[]=[];
 private dustClock=0;
 private ring=new THREE.RingGeometry(.6,.85,24).rotateX(-Math.PI/2);
 private smoke=new THREE.IcosahedronGeometry(.32,0);
 private mark=new THREE.PlaneGeometry(.17,.65).rotateX(-Math.PI/2);
 constructor(private scene:THREE.Scene){}
 private add(geometry:THREE.BufferGeometry,p:THREE.Vector3,color:number,life:number,rise=0,grow=0){if(this.live.length>=150)this.remove(0);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));mesh.position.copy(p);this.scene.add(mesh);this.live.push({mesh,ttl:life,life,rise,grow});return mesh;}
 private remove(i:number){const e=this.live[i];this.scene.remove(e.mesh);(e.mesh.material as THREE.Material).dispose();this.live.splice(i,1);}
 muzzle(p:THREE.Vector3,aim:number,heavy:boolean){const flash=this.add(this.smoke,p,0xffe49a,.075,0,9);flash.scale.set(.7,.7,heavy?3:1.6);flash.rotation.y=aim;}
 impact(p:THREE.Vector3,heavy:boolean){const at=p.clone();at.y=terrainHeight(at.x,at.z)+.07;this.add(this.ring,at,heavy?0xfca352:0xd9bd86,heavy?.45:.15,0,heavy?8:3);this.add(this.smoke,p,0x544e48,heavy?1.3:.35,.8,heavy?2:.7);}
 trail(p:THREE.Vector3){this.add(this.smoke,p,0x96918a,.45,.45,1.5);}
 update(dt:number,cars:{alive:boolean;hp:number;maxHp:number;speed:number;angle:number;mesh:THREE.Group}[]){for(let i=this.live.length-1;i>=0;i--){const e=this.live[i];e.ttl-=dt;if(e.ttl<=0){this.remove(i);continue;}e.mesh.position.y+=e.rise*dt;e.mesh.scale.addScalar(e.grow*dt);(e.mesh.material as THREE.MeshBasicMaterial).opacity=.65*e.ttl/e.life;}
 this.dustClock+=dt;if(this.dustClock<.09)return;this.dustClock=0;for(const c of cars){if(!c.alive||!c.mesh.visible)continue;if(c.hp<c.maxHp*.35){const p=c.mesh.position.clone();p.y+=1.7;this.add(this.smoke,p,0x313334,.9,1.6,1.1);}if(Math.abs(c.speed)<5)continue;for(const side of [-1,1]){const p=c.mesh.position.clone();p.x+=Math.sin(c.angle)*1.25+Math.cos(c.angle)*side*.9;p.z+=Math.cos(c.angle)*1.25-Math.sin(c.angle)*side*.9;p.y=terrainHeight(p.x,p.z)+.06;const mark=this.add(this.mark,p,0x352d25,3);mark.rotation.y=c.angle;if(side===1)this.add(this.smoke,p,0x9d8866,.45,.8,1.2);}}}
 clear(){while(this.live.length)this.remove(0);this.dustClock=0;}
 get count(){return this.live.length;}
}
