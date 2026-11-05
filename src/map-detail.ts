import * as THREE from 'three';
import {terrainHeight} from './terrain';
type Obstacle={x:number;z:number;w:number;d:number};
export function addMapDetails(world:THREE.Group,style:number,obstacles:Obstacle[]){
 const material=(color:number,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness});
 const concrete=material(style===2?0x9dabb0:0x646258),steel=material(0x445555,.6),hazard=material(0xbbaa57),rust=material(0x775346),road=material(style===2?0x8fabb5:style===1?0x3e4846:0x9c8865);
 const block=(x:number,z:number,w:number,d:number,h:number,m:THREE.Material,solid=false)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,terrainHeight(x,z)+h/2-.05,z);mesh.castShadow=mesh.receiveShadow=true;const blocksBridge=solid&&Math.abs(z-34)<d/2+4.5&&Math.abs(x)<38+w/2;if(!blocksBridge){world.add(mesh);if(solid)obstacles.push({x,z,w,d});}return mesh;};
 // Conforming ribbon geometry follows all slopes rather than covering them with a flat road.
 const ribbon=(points:THREE.Vector2[],width:number,m:THREE.Material)=>{const vertices:number[]=[],indices:number[]=[];points.forEach((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],v=b.clone().sub(a).normalize();for(const sign of [-1,1]){const x=p.x-v.y*width*.5*sign,z=p.y+v.x*width*.5*sign;vertices.push(x,terrainHeight(x,z)+.035,z);}if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;world.add(mesh);};
 for(const offset of [-24,24])ribbon(Array.from({length:81},(_,i)=>{const z=-48+i*1.2;return new THREE.Vector2(offset+Math.sin(z*.065)*5,z);}),5.5,road);
 ribbon(Array.from({length:81},(_,i)=>{const x=-48+i*1.2;return new THREE.Vector2(x,20*Math.sin(x*.045));}),5,road);
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
  const x=side*61,z=side*15;const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.5,16,10),steel);fuselage.rotation.z=Math.PI/2;fuselage.rotation.y=side*.35;fuselage.position.set(x,4,z);fuselage.castShadow=true;world.add(fuselage);const wing=block(x,z,3,19,.35,rust);wing.position.y=4;wing.rotation.z=side*.17;
 }
 // Layered canyon walls, snowy ridges or factory stacks form a real 3D skyline.
 for(let i=0;i<32;i++){const angle=i*Math.PI/16,r=66+8*Math.sin(i*8.3),x=Math.sin(angle)*r,z=Math.cos(angle)*r,h=8+(Math.sin(i*14.7)+1)*8;
  if(style===1){const stack=new THREE.Mesh(new THREE.CylinderGeometry(1.3,2,h,10),steel);stack.position.set(x,h/2,z);world.add(stack);block(x,z,7,7,4,concrete);}
  else {const rock=new THREE.Mesh(new THREE.ConeGeometry(8+i%4,h,6,3),material(style===2?0xc5d1d3:0x7d6b54));rock.position.set(x,h/2-2,z);rock.rotation.y=i;rock.scale.z=1.6;rock.castShadow=true;world.add(rock);}
 }
 if(style===1){for(const z of [-42,42]){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,84,12),rust);pipe.rotation.z=Math.PI/2;pipe.position.set(0,8,z);world.add(pipe);for(const x of [-43,43])block(x,z,1.2,1.2,8,steel,true);}}
}
