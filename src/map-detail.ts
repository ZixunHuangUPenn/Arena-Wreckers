import * as THREE from 'three';
import {terrainHeight,terrainBlocked,fluidSurface,mapLayout,bridgeLocal,bridgeApproach,ringWalls,ARENA} from './terrain';
import {surfaceMaterial,texturedBox,landHeight} from './environment';
type Obstacle={x:number;z:number;w:number;d:number};
export function addMapDetails(world:THREE.Group,style:number,obstacles:Obstacle[]){
 const material=(color:number,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness});
 const concrete=surfaceMaterial('concrete',{color:style===2?0xc9d6dc:0xb4b0a4}),steel=surfaceMaterial('container',{color:0x5d7078,metalness:.55,roughness:.5}),hazard=material(0xd8b23c),rust=surfaceMaterial('container',{color:0xa5583a,metalness:.3,roughness:.7});
 const layout=mapLayout(),walls=layout.rings.flatMap(ringWalls),reserved=[...layout.spawns.map(([x,z])=>({x,z,r:6})),...layout.capture.map(p=>({...p,r:6})),...layout.flags.map(p=>({...p,r:3})),...layout.pickups.map(p=>({...p,r:2.5})),...layout.barrels.map(p=>({...p,r:2})),{...layout.charge,r:3}];
 // Solid props only go where the generated terrain is open: not on decks, liquids, cliffs, ring walls or objectives.
 const free=(x:number,z:number,w:number,d:number)=>{if(Math.abs(x)+w/2>ARENA-1||Math.abs(z)+d/2>ARENA-1)return Math.abs(x)>ARENA||Math.abs(z)>ARENA;for(const [a,b] of [[0,0],[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){const px=x+a*w,pz=z+b*d;if(terrainBlocked(px,pz)||fluidSurface(px,pz)||layout.bridges.some(g=>bridgeLocal(g,px,pz)!==null))return false;}
  if(bridgeApproach(layout,x,z,Math.max(w,d)/2))return false;
  return !walls.some(s=>Math.hypot(x-s.x,z-s.z)<s.length/2+Math.max(w,d)/2+1)&&!reserved.some(r=>Math.abs(x-r.x)<w/2+r.r&&Math.abs(z-r.z)<d/2+r.r)&&!obstacles.some(o=>Math.abs(x-o.x)<(w+o.w)/2+1&&Math.abs(z-o.z)<(d+o.d)/2+1);};
 const block=(x:number,z:number,w:number,d:number,h:number,m:THREE.Material,solid=false,check=true)=>{const mesh=new THREE.Mesh(texturedBox(w,h,d),m);mesh.position.set(x,landHeight(x,z,style)+h/2-.05,z);mesh.castShadow=mesh.receiveShadow=true;if(!solid||!check||free(x,z,w,d)){world.add(mesh);if(solid)obstacles.push({x,z,w,d});}return mesh;};
 // Roads are painted into the ground material (see environment.ts) instead of floating ribbons.
 // Painted chevrons lead onto every bridge from both banks.
 const chevrons:[number,number,number][]=[];for(const b of layout.bridges)for(const end of [-1,1]){const u=end*(b.half+3.5),x=b.x+Math.cos(b.angle)*u,z=b.z+Math.sin(b.angle)*u;chevrons.push([x,z,b.angle+(end>0?Math.PI:0)]);}
 for(const [x,z,angle] of chevrons){const vertices:number[]=[];for(const [du,dv] of [[-1,-1],[1,0],[-1,1],[-.4,0]]){const wx=x+Math.cos(angle)*du*1.3-Math.sin(angle)*dv*1.6,wz=z+Math.sin(angle)*du*1.3+Math.cos(angle)*dv*1.6;vertices.push(wx,terrainHeight(wx,wz)+.06,wz);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();const marker=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xd4c284,side:THREE.DoubleSide}));world.add(marker);}
 for(const {x,z} of [layout.pickups[0],layout.pickups[2]].filter(Boolean)){const g=new THREE.RingGeometry(1.3,1.6,32);g.rotateX(-Math.PI/2);const v=g.attributes.position;for(let j=0;j<v.count;j++)v.setY(j,terrainHeight(x+v.getX(j),z+v.getZ(j))+.07);const marker=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x67be92,side:THREE.DoubleSide}));marker.position.set(x,0,z);world.add(marker);}
 // Broken aircraft / machinery silhouettes, safely outside the playable boundary.
 for(const side of [-1,1]){
  const x=side*(ARENA+11),z=side*30;const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.5,16,10),steel);fuselage.rotation.z=Math.PI/2;fuselage.rotation.y=side*.35;fuselage.position.set(x,landHeight(x,z,style)+1.2,z);fuselage.castShadow=true;world.add(fuselage);const wing=block(x,z,3,19,.35,rust);wing.position.y=landHeight(x,z,style)+1.2;wing.rotation.z=side*.17;
 }
 // Foundry skyline: smokestacks with a hot rim. Canyon walls and snowy peaks are generated terrain (environment.ts).
 if(style===1){const glow=new THREE.MeshBasicMaterial({color:new THREE.Color(1,.42,.12).multiplyScalar(5)});for(let i=0;i<56;i++){const angle=i*Math.PI/28,r=ARENA+16+8*Math.sin(i*8.3),x=Math.sin(angle)*r,z=Math.cos(angle)*r,h=8+(Math.sin(i*14.7)+1)*8,ground=landHeight(x,z,style);
  const stack=new THREE.Mesh(new THREE.CylinderGeometry(1.3,2,h,14),steel);stack.position.set(x,ground+h/2,z);stack.castShadow=true;world.add(stack);if(i%3===0){const rim=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.25,14),glow);rim.position.set(x,ground+h+.05,z);world.add(rim);}block(x,z,7,7,4,concrete);}}
 if(style===1){for(const z of [-ARENA+8,ARENA-8]){const end=ARENA-7;if(![-end,end].every(x=>free(x,z,1.2,1.2)))continue;const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,end*2,12),rust);pipe.rotation.z=Math.PI/2;pipe.position.set(0,Math.max(terrainHeight(-end,z),terrainHeight(end,z))+8,z);world.add(pipe);for(const x of [-end,end])block(x,z,1.2,1.2,8,steel,true,false);}}
}
