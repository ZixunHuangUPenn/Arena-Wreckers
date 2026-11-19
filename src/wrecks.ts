// Staged vehicle damage and wrecks. A car sheds body panels as it loses health, collects bullet holes, burns and
// scorch marks where it is hit, and when it is destroyed it leaves a charred wreck behind: wheels and panels fly
// off, the shell smoulders for a few seconds, can be used as cover, then sinks into the ground and is removed.
// Everything here is visual; main.ts decides when it happens and whether a wreck blocks cars and shots.
import * as THREE from 'three';
import {terrainHeight} from './terrain';
import {tileNoise} from './environment';
import {vehicleWearMap} from './vehicle-models';
import type {CombatEffects} from './combat-effects';

/** How long a wreck stays (seconds), and how long of that it spends sinking out of sight at the end. */
export const WRECK={life:7.5,sink:1.6,maxScars:12,scarGap:.12};
/** Health fractions where the next damage stage starts: panels fly off, black smoke, fire and warning. */
export const DAMAGE_STAGES=[.7,.4,.15];
/** Stage 0 intact, 1 shed panels, 2 smoking, 3 burning. */
export function damageStage(health:number){let stage=0;for(const t of DAMAGE_STAGES)if(health<=t)stage++;return stage;}

type Debris={object:THREE.Object3D;v:THREE.Vector3;spin:THREE.Vector3;age:number;life:number;radius:number;rest:boolean};
export type Wreck={heat:{value:number};group:THREE.Group;x:number;z:number;angle:number;hx:number;hz:number;age:number;materials:THREE.Material[];solid:boolean};

/** Scar atlas: 0 rotary-gun holes, 1 shotgun pellet spray, 2 pulse burn, 3 blast scorch. */
function scarTexture(){const f=64,w=f*4,data=new Uint8Array(w*f*4);let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const holes:[number,number,number][][]=[[],[]];for(let i=0;i<4;i++)holes[0].push([.25+rnd()*.5,.25+rnd()*.5,.07+rnd()*.03]);for(let i=0;i<14;i++)holes[1].push([.12+rnd()*.76,.12+rnd()*.76,.03+rnd()*.02]);
 for(let y=0;y<f;y++)for(let x=0;x<w;x++){const tile=Math.floor(x/f),u=(x%f+.5)/f,v=(y+.5)/f,cu=u*2-1,cv=v*2-1,r=Math.hypot(cu,cv),i=(y*w+x)*4;let a=0,shade=0;
  if(tile<2){for(const [hx,hy,hr] of holes[tile]){const d=Math.hypot(u-hx,v-hy);if(d<hr){a=1;shade=Math.max(shade,0);}else if(d<hr*2.1){const ring=1-(d-hr)/(hr*1.1);if(ring>a){a=ring*.85;shade=110+ring*90;}}}}
  else if(tile===2){const n=tileNoise(u,v,5,4,13),ang=Math.atan2(cv,cu),streak=Math.pow(Math.abs(Math.sin(ang*5+n*5)),8);a=Math.max(0,Math.min(1,(1-r*(.8+n*.5))*1.6+streak*(1-r)*.8));shade=20+streak*40;}
  else{const n=tileNoise(u,v,4,4,57);a=Math.max(0,Math.min(1,(1-r*(.7+n*.7))*1.7));shade=12;}
  data[i]=data[i+1]=data[i+2]=shade;data[i+3]=Math.max(0,Math.min(1,a))*255;}
 const t=new THREE.DataTexture(data,w,f,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}

/** Charred body shader: soot black with glowing embers in the cracks that cool down over the wreck's life. */
function charMaterial(base:THREE.Color,metal:boolean,heat:{value:number}){const m=new THREE.MeshStandardMaterial({name:'Charred',color:base,roughness:metal?.75:.97,metalness:metal?.3:0});
 m.onBeforeCompile=shader=>{shader.uniforms.uWear={value:vehicleWearMap()};shader.uniforms.uHeat=heat;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCharPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCharPos=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uWear;uniform float uHeat;varying vec3 vCharPos;')
   .replace('#include <color_fragment>','#include <color_fragment>\nvec4 cw=texture2D(uWear,vCharPos.xz*.7+vCharPos.y*.3);float ash=smoothstep(.45,.85,cw.r);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.042,.04),ash*.7);')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.6,.45,.08)*uHeat*smoothstep(.62,.9,cw.g+cw.b*.4)*(1.-ash);');};
 m.customProgramCacheKey=()=>'aw-char';return m;}

export class Wrecks{
 readonly wrecks:Wreck[]=[];private debris:Debris[]=[];private scarMat:THREE.MeshStandardMaterial;private panelGeo=[new THREE.BoxGeometry(.9,.05,.6),new THREE.BoxGeometry(.5,.05,1),new THREE.BoxGeometry(.35,.3,.05)];private panelMats=new Map<number,THREE.MeshStandardMaterial>();private ray=new THREE.Raycaster();private scarGeo=new THREE.PlaneGeometry(1,1);
 constructor(private scene:THREE.Scene,private fx:CombatEffects){this.scarMat=new THREE.MeshStandardMaterial({name:'Scar',map:scarTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,roughness:.85,metalness:.3});}
 private panelMaterial(color:number){let m=this.panelMats.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.25});this.panelMats.set(color,m);}return m;}
 private fling(object:THREE.Object3D,v:THREE.Vector3,life:number,radius:number){object.traverse(o=>{o.castShadow=true;});this.scene.add(object);this.debris.push({object,v,spin:new THREE.Vector3((Math.random()-.5)*14,(Math.random()-.5)*10,(Math.random()-.5)*14),age:0,life,radius,rest:false});}
 /** A body panel (or the bumper) torn off a car at the first damage stage. */
 shed(at:THREE.Vector3,angle:number,color:number,count=2){for(let i=0;i<count;i++){const side=Math.random()<.5?-1:1,mesh=new THREE.Mesh(this.panelGeo[i%this.panelGeo.length],this.panelMaterial(color)),out=new THREE.Vector3(Math.cos(angle)*side,0,-Math.sin(angle)*side);
  mesh.position.copy(at).add(new THREE.Vector3(0,.9,0)).addScaledVector(out,.9);mesh.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);this.fling(mesh,out.multiplyScalar(3+Math.random()*3).add(new THREE.Vector3(0,4+Math.random()*3,0)),5,.1);}
  for(let i=0;i<6;i++){const a=Math.random()*6.28;this.fx.spray(true,{x:at.x,y:at.y+.9,z:at.z},[Math.cos(a)*6,2+Math.random()*3,Math.sin(a)*6],.35,.14,.05,[5,3.4,1.4],[2,.6,.08],1,1,14);}}
 /**
  * Bullet holes, pellet sprays, pulse burns and blast scorch where a shot struck the car. The mark is projected
  * onto the real body with a ray, so it sits on the panel and moves with it.
  */
 scar(visual:THREE.Object3D,hit:THREE.Vector3,dir:THREE.Vector3,kind:number,now:number){const body=visual.userData.body as THREE.Object3D|undefined;if(!body)return;
  if(now-((visual.userData.lastScar as number|undefined)??-1)<WRECK.scarGap)return;visual.userData.lastScar=now;
  const centre=new THREE.Vector3();body.getWorldPosition(centre);centre.y+=.7;const along=dir.clone().setY(0);if(along.lengthSq()<1e-6)along.subVectors(centre,hit).setY(0);along.normalize();
  // Aim the ray from outside the car through the hit height, a little jittered so repeated hits spread out.
  const from=hit.clone().addScaledVector(along,-3);from.y=Math.max(centre.y-.45,Math.min(centre.y+.5,hit.y))+(Math.random()-.5)*.35;const side=new THREE.Vector3(-along.z,0,along.x).multiplyScalar((Math.random()-.5)*.8);from.add(side);
  this.ray.set(from,along);this.ray.far=8;const targets:THREE.Object3D[]=[];body.traverse(o=>{if(o instanceof THREE.Mesh&&o.name!=='glass'&&o.name!=='scar'&&o.visible)targets.push(o);});
  const hitInfo=this.ray.intersectObjects(targets,false)[0];if(!hitInfo||!hitInfo.face)return;const mesh=hitInfo.object;
  const scars=(visual.userData.scars??=[]) as THREE.Mesh[];if(scars.length>=WRECK.maxScars){const old=scars.shift()!;old.parent?.remove(old);old.geometry.dispose();}
  const size=[.55,.75,.85,1.3][kind]??.6,geo=this.scarGeo.clone(),uv=geo.attributes.uv as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setX(i,(kind+uv.getX(i))/4);
  const scar=new THREE.Mesh(geo,this.scarMat);scar.name='scar';scar.renderOrder=2;const normal=hitInfo.face.normal.clone();
  const local=mesh.worldToLocal(hitInfo.point.clone());scar.position.copy(local).addScaledVector(normal,.012);scar.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);scar.rotateZ(Math.random()*6.28);scar.scale.setScalar(size*(.8+Math.random()*.4));mesh.add(scar);scars.push(scar);}
 /** Removes every scar from a car (on respawn). */
 clearScars(visual:THREE.Object3D){for(const s of (visual.userData.scars??[]) as THREE.Mesh[]){s.parent?.remove(s);s.geometry.dispose();}visual.userData.scars=[];}
 /**
  * Leaves a charred copy of the car's model in place: wheels on one side and a couple of panels fly off.
  * `push` is the direction of the killing blow (unit vector, horizontal). Returns the wreck for collision.
  */
 spawn(car:THREE.Object3D,visual:THREE.Object3D,paint:number,hx:number,hz:number,push:THREE.Vector3):Wreck{
  const keep=visual.userData;visual.userData={};const shell=visual.clone(true);visual.userData=keep;
  const heat={value:1},paintChar=charMaterial(new THREE.Color(paint).multiplyScalar(.05).add(new THREE.Color().setRGB(.008,.007,.006)),false,heat),metal=charMaterial(new THREE.Color().setRGB(.014,.013,.012),true,heat),glass=new THREE.MeshStandardMaterial({color:0x050505,roughness:.35,metalness:.2});
  shell.traverse(o=>{if(o instanceof THREE.Mesh&&o.name!=='scar'){o.material=o.name==='paint'?paintChar:o.name==='glass'?glass:metal;}});
  // Strip the beams of the night headlights; a wreck has no power.
  shell.getObjectByName('headlights')?.removeFromParent();
  const group=new THREE.Group();car.updateMatrixWorld(true);visual.updateMatrixWorld(true);group.position.setFromMatrixPosition(car.matrixWorld);group.quaternion.setFromRotationMatrix(car.matrixWorld);
  shell.position.copy(visual.position);shell.quaternion.copy(visual.quaternion);group.add(shell);
  // Wheels: the holders are the root's children other than the body. Two of them fly off, the rest stay.
  const holders=shell.children.filter(o=>o.name!=='Body'&&o.name!=='headlights');const sideOut=Math.random()<.5?1:-1;let flown=0;
  for(const h of holders){if(flown<2&&Math.sign(h.position.x)===sideOut){h.updateMatrixWorld(true);const world=new THREE.Vector3();h.getWorldPosition(world);const q=new THREE.Quaternion();h.getWorldQuaternion(q);h.removeFromParent();h.position.copy(world);h.quaternion.copy(q);
    const out=new THREE.Vector3(sideOut,0,0).applyQuaternion(group.quaternion).setY(0).normalize();this.fling(h,out.multiplyScalar(4+Math.random()*4).addScaledVector(push,3).add(new THREE.Vector3(0,5+Math.random()*3,0)),WRECK.life,.45);flown++;}}
  const body=shell.getObjectByName('Body');if(body){body.rotation.z+=(Math.random()-.5)*.14+sideOut*.08;body.position.y-=.12;}
  group.rotation.y+=(Math.random()-.5)*.25;this.scene.add(group);
  this.shed(group.position,group.rotation.y,paint,3);
  const wreck:Wreck={heat,group,x:group.position.x,z:group.position.z,angle:group.rotation.y,hx,hz,age:0,materials:[paintChar,metal,glass],solid:false};this.wrecks.push(wreck);return wreck;}
 /** Advances debris and wrecks; returns wrecks that just expired so the caller can drop their colliders. */
 update(dt:number):Wreck[]{const gone:Wreck[]=[];if(dt<=0)return gone;
  for(let i=this.debris.length-1;i>=0;i--){const d=this.debris[i],o=d.object;d.age+=dt;
   if(!d.rest){d.v.y-=20*dt;o.position.addScaledVector(d.v,dt);o.rotation.x+=d.spin.x*dt;o.rotation.y+=d.spin.y*dt;o.rotation.z+=d.spin.z*dt;const floor=terrainHeight(o.position.x,o.position.z)+d.radius;
    if(o.position.y<floor){o.position.y=floor;if(Math.abs(d.v.y)<2.2){d.rest=true;const wheel=d.radius>.3;o.rotation.set(0,o.rotation.y,wheel?Math.PI/2:0);o.position.y=floor-d.radius+(wheel?.18:.03);}else{d.v.y*=-.32;d.v.x*=.55;d.v.z*=.55;d.spin.multiplyScalar(.5);}}}
   if(d.age>d.life-1)o.position.y-=dt*.6;if(d.age>=d.life){this.scene.remove(o);this.debris.splice(i,1);}}
  for(let i=this.wrecks.length-1;i>=0;i--){const w=this.wrecks[i];w.age+=dt;const heat=Math.max(0,1-w.age/4);w.heat.value=heat;
   if(w.age<WRECK.life-WRECK.sink)this.fx.smolder(w.group.position,heat,dt);
   else w.group.position.y-=dt*1.9/WRECK.sink;
   if(w.age>=WRECK.life){this.remove(w);this.wrecks.splice(i,1);gone.push(w);}}
  return gone;}
 private remove(w:Wreck){this.scene.remove(w.group);for(const m of w.materials)m.dispose();}
 clear(){for(const w of this.wrecks)this.remove(w);this.wrecks.length=0;for(const d of this.debris)this.scene.remove(d.object);this.debris.length=0;}
 get count(){return this.wrecks.length+this.debris.length;}
}
