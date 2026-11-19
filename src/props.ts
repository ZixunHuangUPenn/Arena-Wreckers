// Small breakable props scattered over the open ground: fence runs, lamp posts, stacked drums and road signs.
// They never block a car: driving into one (or a blast going off beside it) knocks it apart into tumbling
// pieces that fade into the ground after a few seconds. Placement follows the arena seed, so a replayed seed
// gets the same props. Each standing prop is one or two merged meshes; pieces exist only while flying.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight,terrainBlocked,fluidSurface,mapLayout,bridgeLocal,ARENA} from './terrain';

type Piece={geo:THREE.BufferGeometry;mat:number;pos:THREE.Vector3;rot:number};
export type Prop={kind:number;x:number;z:number;angle:number;radius:number;group:THREE.Group;pieces:Piece[];alive:boolean};
type Flying={mesh:THREE.Mesh;v:THREE.Vector3;spin:THREE.Vector3;age:number;rest:boolean};
const PROP_COUNT=26,PIECE_LIFE=4.5;
/** Material slots: wood/steel per theme, paint, light, sign face. */
function palette(style:number){const wood=[0x8a6440,0x4a4c50,0x7a6a5a,0x3a3330][style]??0x8a6440,metal=[0x6b6e70,0x55595d,0x7c868c,0x4b4744][style]??0x6b6e70,paint=[0xc8462e,0xd9a320,0x2f6f9a,0xb83a22][style]??0xc8462e;
 return [new THREE.MeshStandardMaterial({color:wood,roughness:.9}),new THREE.MeshStandardMaterial({color:metal,roughness:.5,metalness:.6}),new THREE.MeshStandardMaterial({color:paint,roughness:.55,metalness:.2}),new THREE.MeshStandardMaterial({color:0xfff2cf,emissive:0xffd890,emissiveIntensity:style===1?3:.6}),new THREE.MeshStandardMaterial({color:0xe9e4d6,roughness:.6})];}
const at=(g:THREE.BufferGeometry,x:number,y:number,z:number,ry=0,rz=0)=>{if(rz)g.rotateZ(rz);if(ry)g.rotateY(ry);g.translate(x,y,z);return g;};
/** Pieces of each kind, in the prop's local space (+Y up). */
function design(kind:number):{pieces:Piece[];radius:number}{const P=(geo:THREE.BufferGeometry,mat:number,x:number,y:number,z:number):Piece=>({geo:at(geo,0,0,0),mat,pos:new THREE.Vector3(x,y,z),rot:0});
 if(kind===0){const pieces:Piece[]=[];for(const x of [-2.4,0,2.4])pieces.push(P(new THREE.BoxGeometry(.14,1.1,.14),0,x,.55,0));for(const y of [.35,.8])for(const x of [-1.2,1.2])pieces.push(P(new THREE.BoxGeometry(2.4,.12,.06),0,x,y,0));return {pieces,radius:2.6};} // fence run
 if(kind===1){const pole=new THREE.CylinderGeometry(.07,.09,4,8);return {pieces:[P(pole,1,0,2,0),P(new THREE.BoxGeometry(.9,.08,.12),1,.4,3.95,0),P(new THREE.BoxGeometry(.32,.14,.26),3,.8,3.86,0)],radius:.6};} // lamp post
 if(kind===2){const drum=()=>new THREE.CylinderGeometry(.34,.34,.82,14);return {pieces:[P(drum(),2,-.36,.41,0),P(drum(),2,.36,.41,0),P(drum(),1,0,.41,.6),P(drum(),2,0,1.23,.2)],radius:1};} // drum stack
 return {pieces:[P(new THREE.BoxGeometry(.1,1.8,.1),1,-.45,.9,0),P(new THREE.BoxGeometry(.1,1.8,.1),1,.45,.9,0),P(new THREE.BoxGeometry(1.3,.75,.05),4,0,1.55,0),P(new THREE.BoxGeometry(1.32,.12,.06),2,0,1.15,0)],radius:.9}; // road sign
}

export class Props{
 readonly props:Prop[]=[];private flying:Flying[]=[];private materials:THREE.MeshStandardMaterial[]=[];private root=new THREE.Group();
 constructor(private scene:THREE.Scene){this.root.name='props';scene.add(this.root);}
 /**
  * Scatters props for the current layout. `avoid` lists solid cover (centre and half extents); props keep clear
  * of it, of objectives, liquids, cliffs and bridges.
  */
 build(style:number,seed:number,avoid:{x:number;z:number;hx:number;hz:number}[]){this.clear();for(const m of this.materials)m.dispose();this.materials=palette(style);
  let s=(Math.abs(seed|0)%2147483646)+1;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
  const L=mapLayout(),reserved=[...L.spawns.map(([x,z])=>({x,z,r:9})),...L.capture.map(p=>({...p,r:7})),...L.flags.map(p=>({...p,r:4})),...L.pickups.map(p=>({...p,r:3})),...L.barrels.map(p=>({...p,r:3})),{...L.charge,r:4}];
  const clearAt=(x:number,z:number,r:number)=>{if(Math.abs(x)>ARENA-6||Math.abs(z)>ARENA-6)return false;for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]){const px=x+dx,pz=z+dz;if(terrainBlocked(px,pz)||fluidSurface(px,pz)||L.bridges.some(b=>bridgeLocal(b,px,pz)!==null))return false;}
   return !reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r)&&!avoid.some(o=>Math.abs(x-o.x)<o.hx+r+1&&Math.abs(z-o.z)<o.hz+r+1)&&!this.props.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+r+3);};
  for(let tries=0;tries<PROP_COUNT*30&&this.props.length<PROP_COUNT;tries++){const kind=this.props.length%4,{pieces,radius}=design(kind),x=(rnd()*2-1)*(ARENA-8),z=(rnd()*2-1)*(ARENA-8),angle=rnd()*Math.PI;if(!clearAt(x,z,radius)){pieces.forEach(p=>p.geo.dispose());continue;}
   const group=new THREE.Group(),byMat=new Map<number,THREE.BufferGeometry[]>();for(const p of pieces){const g=p.geo.clone().translate(p.pos.x,p.pos.y,p.pos.z);(byMat.get(p.mat)??byMat.set(p.mat,[]).get(p.mat)!).push(g);}
   for(const [mat,list] of byMat){const merged=mergeGeometries(list)!;list.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,this.materials[mat]);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
   group.position.set(x,terrainHeight(x,z)-.03,z);group.rotation.y=angle;this.root.add(group);this.props.push({kind,x,z,angle,radius,group,pieces,alive:true});}
 }
 /** Knocks a standing prop apart; `v` is the push velocity (m/s) at the prop. */
 knock(prop:Prop,v:THREE.Vector3){if(!prop.alive)return;prop.alive=false;prop.group.updateMatrixWorld(true);
  for(const piece of prop.pieces){const mesh=new THREE.Mesh(piece.geo,piece.mat===3?this.materials[1]:this.materials[piece.mat]);mesh.position.copy(piece.pos).applyMatrix4(prop.group.matrixWorld);mesh.rotation.y=prop.angle;mesh.castShadow=true;this.root.add(mesh);
   const kick=v.clone().multiplyScalar(.6+Math.random()*.6).add(new THREE.Vector3((Math.random()-.5)*3,2.5+Math.random()*3.5+v.length()*.15,(Math.random()-.5)*3));this.flying.push({mesh,v:kick,spin:new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*6,(Math.random()-.5)*10),age:0,rest:false});}
  this.root.remove(prop.group);prop.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
 /** Props within `radius` of a car footprint centre that a moving car smashes. Returns how many it hit. */
 ram(x:number,z:number,reach:number,vx:number,vz:number){let hit=0;if(Math.hypot(vx,vz)<1.5)return 0;for(const p of this.props)if(p.alive&&Math.hypot(p.x-x,p.z-z)<p.radius*.7+reach){this.knock(p,new THREE.Vector3(vx,0,vz));hit++;}return hit;}
 /** Blast: everything inside `radius` is thrown away from the centre. */
 blast(x:number,z:number,radius:number){for(const p of this.props){if(!p.alive)continue;const dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);if(d<radius+p.radius*.5){const k=(1-d/(radius+p.radius))*12+4;this.knock(p,new THREE.Vector3(dx/(d||1)*k,0,dz/(d||1)*k));}}}
 update(dt:number){if(dt<=0)return;for(let i=this.flying.length-1;i>=0;i--){const f=this.flying[i],m=f.mesh;f.age+=dt;
  if(!f.rest){f.v.y-=20*dt;m.position.addScaledVector(f.v,dt);m.rotation.x+=f.spin.x*dt;m.rotation.y+=f.spin.y*dt;m.rotation.z+=f.spin.z*dt;const floor=terrainHeight(m.position.x,m.position.z)+.08;if(m.position.y<floor){m.position.y=floor;if(Math.abs(f.v.y)<2){f.rest=true;}else{f.v.y*=-.3;f.v.x*=.5;f.v.z*=.5;f.spin.multiplyScalar(.5);}}}
  if(f.age>PIECE_LIFE-1)m.position.y-=dt*.5;if(f.age>=PIECE_LIFE){this.root.remove(m);this.flying.splice(i,1);}}}
 clear(){for(const p of this.props){this.root.remove(p.group);p.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});p.pieces.forEach(q=>q.geo.dispose());}this.props.length=0;for(const f of this.flying)this.root.remove(f.mesh);this.flying.length=0;}
 get standing(){return this.props.filter(p=>p.alive).length;}
}
