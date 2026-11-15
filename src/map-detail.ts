import * as THREE from 'three';
import {terrainHeight} from './terrain';
import {surfaceMaterial,texturedBox,landHeight} from './environment';
type Obstacle={x:number;z:number;w:number;d:number};
export function addMapDetails(world:THREE.Group,style:number,obstacles:Obstacle[]){
 const material=(color:number,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness});
 const concrete=surfaceMaterial('concrete',{color:style===2?0xc9d6dc:0xb4b0a4}),steel=surfaceMaterial('container',{color:0x5d7078,metalness:.55,roughness:.5}),hazard=material(0xd8b23c),rust=surfaceMaterial('container',{color:0xa5583a,metalness:.3,roughness:.7});
 const block=(x:number,z:number,w:number,d:number,h:number,m:THREE.Material,solid=false)=>{const mesh=new THREE.Mesh(texturedBox(w,h,d),m);mesh.position.set(x,landHeight(x,z,style)+h/2-.05,z);mesh.castShadow=mesh.receiveShadow=true;const blocksBridge=solid&&Math.abs(z-34)<d/2+4.5&&Math.abs(x)<38+w/2;if(!blocksBridge){world.add(mesh);if(solid)obstacles.push({x,z,w,d});}return mesh;};
 // Roads are painted into the ground material (see environment.ts) instead of floating ribbons.
 // Service yards on the high flanks; every waist-high object has a matching solid box.
 for(const [x,z] of (style===1?[[-37,-25],[37,23],[-36,30]]:style===2?[[-36,18],[34,-17]]:[[-36,-27],[36,28]])){
  for(let j=0;j<3;j++)block(x+j*2.2,z,1.8,3,1.5,j%2?rust:steel,true);
  block(x-2,z+4,5,.7,1.2,concrete,true);block(x-2,z+4,4.7,.74,.15,hazard);
 }
 // Painted route chevrons and repair circles clarify navigable choices without new blockers.
 for(const [x,z,direction] of [[-35,34,1],[35,34,-1],[-24,0,1],[24,0,-1]]){const vertices:number[]=[];for(const [dx,dz] of [[-1,-1],[1,0],[-1,1],[-.4,0]]){const wx=x+dx*direction,wz=z+dz;vertices.push(wx,terrainHeight(wx,wz)+.06,wz);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();const marker=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xd4c284,side:THREE.DoubleSide}));world.add(marker);}
 for(const [x,z] of [[-21,8],[0,17]]){const g=new THREE.RingGeometry(1.3,1.6,32);g.rotateX(-Math.PI/2);const v=g.attributes.position;for(let j=0;j<v.count;j++)v.setY(j,terrainHeight(x+v.getX(j),z+v.getZ(j))+.07);const marker=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x67be92,side:THREE.DoubleSide}));marker.position.set(x,0,z);world.add(marker);}
 // Broken aircraft / machinery silhouettes, safely outside the playable boundary.
 for(const side of [-1,1]){
  const x=side*61,z=side*15;const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.5,16,10),steel);fuselage.rotation.z=Math.PI/2;fuselage.rotation.y=side*.35;fuselage.position.set(x,landHeight(x,z,style)+1.2,z);fuselage.castShadow=true;world.add(fuselage);const wing=block(x,z,3,19,.35,rust);wing.position.y=landHeight(x,z,style)+1.2;wing.rotation.z=side*.17;
 }
 // Foundry skyline: smokestacks with a hot rim. Canyon walls and snowy peaks are generated terrain (environment.ts).
 if(style===1){const glow=new THREE.MeshBasicMaterial({color:new THREE.Color(1,.42,.12).multiplyScalar(5)});for(let i=0;i<32;i++){const angle=i*Math.PI/16,r=66+8*Math.sin(i*8.3),x=Math.sin(angle)*r,z=Math.cos(angle)*r,h=8+(Math.sin(i*14.7)+1)*8,ground=landHeight(x,z,style);
  const stack=new THREE.Mesh(new THREE.CylinderGeometry(1.3,2,h,14),steel);stack.position.set(x,ground+h/2,z);stack.castShadow=true;world.add(stack);if(i%3===0){const rim=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.25,14),glow);rim.position.set(x,ground+h+.05,z);world.add(rim);}block(x,z,7,7,4,concrete);}}
 if(style===1){for(const z of [-42,42]){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,84,12),rust);pipe.rotation.z=Math.PI/2;pipe.position.set(0,8,z);world.add(pipe);for(const x of [-43,43])block(x,z,1.2,1.2,8,steel,true);}}
}
