// Combat effects: fireballs, rolling smoke, sparks, shockwaves, scorch marks, tyre marks and light flashes.
// All particles live in two point clouds (alpha-blended smoke, additive fire) and all ground decals in one
// mesh, so a full-screen firefight costs three draw calls. Fixed caps keep endless matches bounded.
import * as THREE from 'three';
import {terrainHeight} from './terrain';
import {tileNoise} from './environment';

const MAX_PARTICLES=640,MAX_DECALS=220;
const SMOKE=0,FIRE=1;
type Particle={kind:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;life:number;size0:number;size1:number;r0:number;g0:number;b0:number;r1:number;g1:number;b1:number;alpha:number;drag:number;gravity:number;rot:number;spin:number};
type Decal={tile:number;x:number;z:number;y:number|null;size:number;grow:number;rot:number;age:number;life:number;r:number;g:number;b:number;alpha:number;corners:Float32Array|null};
type CarLike={alive:boolean;hp:number;maxHp:number;speed:number;angle:number;mesh:THREE.Group};

function puffTexture(){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=tileNoise(x/size,y/size,4,4,17),m=tileNoise(x/size,y/size,9,3,5);data[i]=n*255;data[i+1]=m*255;data[i+2]=255;data[i+3]=255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
/** Three tiles side by side: solid strip (tyre mark), ragged soft blot (scorch), thin ring (shockwave). */
function decalTexture(){const h=64,w=h*3,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const tile=Math.floor(x/h),u=(x%h+.5)/h*2-1,v=(y+.5)/h*2-1,r=Math.hypot(u,v),i=(y*w+x)*4;let a=0;if(tile===0)a=Math.max(0,1-Math.pow(Math.abs(u),6))*Math.max(0,1-Math.pow(Math.abs(v),10))*(.75+.25*tileNoise(x/h,y/h,8,2,3));else if(tile===1){const n=tileNoise((u+1)/2,(v+1)/2,5,4,29);a=Math.max(0,Math.min(1,(1-r*(.75+n*.6))*2.2));}else a=Math.max(0,1-Math.abs(r-.82)/.13)*(r<.98?1:0);data[i]=data[i+1]=data[i+2]=255;data[i+3]=a*255;}const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
const vertexShader=`attribute vec4 aColor;attribute vec2 aShape;uniform float uScale;varying vec4 vColor;varying vec2 vShape;
void main(){vColor=aColor;vShape=aShape;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(aShape.x*uScale/max(.1,-mv.z),420.);}`;
const fragmentShader=(fire:boolean)=>`uniform sampler2D uNoise;varying vec4 vColor;varying vec2 vShape;
void main(){vec2 c=gl_PointCoord-.5;float s=sin(vShape.y),k=cos(vShape.y);vec2 q=vec2(c.x*k-c.y*s,c.x*s+c.y*k);float r=length(c)*2.;
 vec3 n=texture2D(uNoise,q*.8+.5+vShape.y*.37).rgb;
 ${fire?'float a=pow(max(0.,1.-r),1.4)*(.35+1.1*n.r*n.r+.4*n.g);gl_FragColor=vec4(vColor.rgb*a*vColor.a,1.);':'float a=smoothstep(1.,.25,r+(n.r-.5)*.7)*(.45+.55*n.g);gl_FragColor=vec4(vColor.rgb*(.7+.6*n.r),a*vColor.a);'}}`;

export class CombatEffects{
 /** Upper bound on live particles plus decals. */
 readonly capacity=MAX_PARTICLES+MAX_DECALS;
 private particles:Particle[]=[];private decals:Decal[]=[];private dustClock=0;private dust=new THREE.Color(0x9d8866);
 private clouds:THREE.Points[]=[];private decalMesh:THREE.Mesh;private lights:THREE.PointLight[]=[];private flashes:{light:THREE.PointLight;age:number;life:number;peak:number}[]=[];private lightsOn=false;
 constructor(private scene:THREE.Scene){
  const noise=puffTexture(),uScale={value:400};
  for(const fire of [false,true]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*3),3));g.setAttribute('aColor',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*4),4));g.setAttribute('aShape',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*2),2));g.setDrawRange(0,0);
   const material=new THREE.ShaderMaterial({uniforms:{uNoise:{value:noise},uScale},vertexShader,fragmentShader:fragmentShader(fire),transparent:true,depthWrite:false,blending:fire?THREE.AdditiveBlending:THREE.NormalBlending});
   const cloud=new THREE.Points(g,material);cloud.frustumCulled=false;cloud.renderOrder=fire?8:7;cloud.name=fire?'fx-fire':'fx-smoke';
   // Point sprites are sized in world metres: convert with the live projection and drawing-buffer height.
   cloud.onBeforeRender=(renderer,_scene,camera)=>{uScale.value=renderer.getDrawingBufferSize(new THREE.Vector2()).y*camera.projectionMatrix.elements[5]*.5;};this.clouds.push(cloud);scene.add(cloud);}
  const dg=new THREE.BufferGeometry(),indices:number[]=[];dg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*12),3));dg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*16),4));dg.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*8),2));for(let i=0;i<MAX_DECALS;i++)indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);dg.setIndex(indices);dg.setDrawRange(0,0);
  this.decalMesh=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({map:decalTexture(),vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,side:THREE.DoubleSide}));this.decalMesh.frustumCulled=false;this.decalMesh.renderOrder=3;this.decalMesh.name='fx-decals';scene.add(this.decalMesh);
  for(let i=0;i<2;i++){const light=new THREE.PointLight(0xffa651,0,26,1.6);light.name='fx-light';this.lights.push(light);}
  this.setLights(true);
 }
 /** Number of helper objects this system keeps in the scene while idle. */
 get persistent(){return 3+(this.lightsOn?this.lights.length:0);}
 /** Explosion light flashes cost a little on every lit surface; the low quality tier turns them off. */
 setLights(on:boolean){if(on===this.lightsOn)return;this.lightsOn=on;for(const light of this.lights){light.intensity=0;if(on)this.scene.add(light);else this.scene.remove(light);}this.flashes.length=0;}
 /** Colour of the dust thrown up by tyres and impacts, set per arena. */
 setDust(color:number){this.dust.setHex(color);}
 private emit(kind:number,p:{x:number;y:number;z:number},v:[number,number,number],life:number,size0:number,size1:number,c0:[number,number,number],c1:[number,number,number],alpha:number,drag=1.5,gravity=0){if(this.particles.length>=MAX_PARTICLES)this.particles.shift();this.particles.push({kind,x:p.x,y:p.y,z:p.z,vx:v[0],vy:v[1],vz:v[2],age:0,life,size0,size1,r0:c0[0],g0:c0[1],b0:c0[2],r1:c1[0],g1:c1[1],b1:c1[2],alpha,drag,gravity,rot:Math.random()*6.28,spin:(Math.random()-.5)*2});}
 private decal(tile:number,x:number,z:number,size:number,rot:number,life:number,color:[number,number,number],alpha:number,grow=0,y:number|null=null){if(this.decals.length>=MAX_DECALS)this.decals.shift();this.decals.push({tile,x,z,y,size,grow,rot,age:0,life,r:color[0],g:color[1],b:color[2],alpha,corners:null});}
 private flash(p:THREE.Vector3,peak:number,life:number){if(!this.lightsOn)return;const busy=new Set(this.flashes.map(f=>f.light)),light=this.lights.find(l=>!busy.has(l))??this.flashes.shift()!.light;light.position.set(p.x,p.y+1.2,p.z);this.flashes.push({light,age:0,life,peak});}
 private sparks(p:THREE.Vector3,count:number,speed:number,up=1){for(let i=0;i<count;i++){const a=Math.random()*6.28,s=speed*(.35+Math.random()*.65);this.emit(FIRE,p,[Math.cos(a)*s,(.3+Math.random())*speed*.6*up,Math.sin(a)*s],.35+Math.random()*.55,.22,.06,[4,2.6,1.1],[2.2,.5,.08],1,.6,16);}}
 /** Fireball, smoke column, sparks, shockwave, scorch mark and light flash. `power` 1 is a rocket hit or a barrel. */
 explosion(p:THREE.Vector3,power:number){
  if(power<.4){this.sparks(p,Math.round(4+power*10),7);this.emit(FIRE,p,[0,0,0],.09,.5,1.3,[3,2.2,1.2],[2,.8,.2],.9);this.emit(SMOKE,p,[(Math.random()-.5)*1.5,1+Math.random(),(Math.random()-.5)*1.5],.55,.5,1.4,[.3,.28,.26],[.45,.43,.4],.5);return;}
  const scale=Math.sqrt(power),ground=terrainHeight(p.x,p.z),onGround=p.y-ground<2.5;
  this.emit(FIRE,p,[0,0,0],.14,2.2*scale,6*scale,[5,4.2,2.6],[3,1.2,.2],1); // white-hot core flash
  for(let i=0;i<Math.round(11*scale);i++){const a=Math.random()*6.28,s=(1.5+Math.random()*4.5)*scale;this.emit(FIRE,{x:p.x+Math.cos(a)*.3,y:p.y+Math.random()*.5,z:p.z+Math.sin(a)*.3},[Math.cos(a)*s,1.2+Math.random()*3.4*scale,Math.sin(a)*s],.38+Math.random()*.42,1.1*scale,(2.6+Math.random()*1.4)*scale,[4.2,2.4,.7],[1.4,.22,.03],1,2.6,-1.5);}
  for(let i=0;i<Math.round(9*scale);i++){const a=Math.random()*6.28,s=(.6+Math.random()*2.2)*scale,shade=.05+Math.random()*.08;this.emit(SMOKE,{x:p.x+Math.cos(a)*.5,y:p.y+.3+Math.random()*.8,z:p.z+Math.sin(a)*.5},[Math.cos(a)*s,1.6+Math.random()*2.6,Math.sin(a)*s],1.5+Math.random()*1.6,1.3*scale,(3.6+Math.random()*2)*scale,[shade,shade,shade],[.3,.29,.28],.8,1.1,-.6);}
  this.sparks(p,Math.round(16*scale),13*scale);
  for(let i=0;i<Math.round(6*scale);i++){const a=Math.random()*6.28,s=4+Math.random()*7;this.emit(SMOKE,p,[Math.cos(a)*s,4+Math.random()*7,Math.sin(a)*s],.7+Math.random()*.6,.28,.2,[.05,.045,.04],[.05,.045,.04],1,.3,18);} // debris
  if(onGround){this.decal(2,p.x,p.z,1.2,Math.random()*6.28,.38,[3,2.2,1.4],.9,16*scale);this.decal(1,p.x,p.z,2.6*scale,Math.random()*6.28,16,[.03,.025,.02],.72);for(let i=0;i<Math.round(5*scale);i++){const a=i/5*6.28+Math.random();this.emit(SMOKE,{x:p.x,y:ground+.3,z:p.z},[Math.cos(a)*6*scale,.6,Math.sin(a)*6*scale],.9,1,3.4*scale,[this.dust.r*.8,this.dust.g*.8,this.dust.b*.8],[this.dust.r,this.dust.g,this.dust.b],.5,2.2);}}
  this.flash(p,90*power,.32);
 }
 muzzle(p:THREE.Vector3,aim:number,heavy:boolean){const fx=-Math.sin(aim),fz=-Math.cos(aim),s=heavy?1.7:1;this.emit(FIRE,p,[fx*2,0,fz*2],.06,1.1*s,1.9*s,[5,3.6,1.8],[3,1.2,.2],1);
  for(let i=0;i<(heavy?4:2);i++){const v=(7+Math.random()*9)*s;this.emit(FIRE,p,[fx*v+(Math.random()-.5)*2,(Math.random()-.3)*2,fz*v+(Math.random()-.5)*2],.07+Math.random()*.06,.45*s,.9*s,[4.5,2.8,1],[2,.5,.05],1,4);}
  for(let i=0;i<(heavy?3:1);i++)this.emit(SMOKE,p,[fx*(2+Math.random()*3),.6+Math.random(),fz*(2+Math.random()*3)],.5+Math.random()*.5,.45*s,1.5*s,[.5,.48,.45],[.7,.68,.65],heavy?.5:.28,2.4);
  if(heavy)this.flash(p,26,.1);}
 impact(p:THREE.Vector3,heavy:boolean){const at=p.clone(),ground=terrainHeight(at.x,at.z);if(heavy){if(at.y-ground<2.5)this.decal(1,at.x,at.z,1.4,Math.random()*6.28,10,[.04,.035,.03],.5);return;}
  this.sparks(at,5,6);this.emit(SMOKE,at,[(Math.random()-.5)*1.2,.9+Math.random(),(Math.random()-.5)*1.2],.5,.4,1.3,[this.dust.r*.7,this.dust.g*.7,this.dust.b*.7],[this.dust.r,this.dust.g,this.dust.b],.45,2);if(at.y-ground<1)this.decal(1,at.x,at.z,.5,Math.random()*6.28,6,[.05,.045,.04],.45);}
 trail(p:THREE.Vector3){this.emit(SMOKE,p,[(Math.random()-.5)*.6,.5+Math.random()*.4,(Math.random()-.5)*.6],.7+Math.random()*.4,.35,1.25,[.62,.6,.58],[.8,.79,.77],.42,1.2);this.emit(FIRE,p,[0,0,0],.1,.7,.25,[4,2.2,.6],[2,.4,.05],1);}
 update(dt:number,cars:CarLike[]){
  if(dt>0){
   for(let i=this.particles.length-1;i>=0;i--){const q=this.particles[i];q.age+=dt;if(q.age>=q.life){this.particles.splice(i,1);continue;}const damp=Math.exp(-q.drag*dt);q.vx*=damp;q.vz*=damp;q.vy=q.vy*damp-q.gravity*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.rot+=q.spin*dt;if(q.gravity>0){const floor=terrainHeight(q.x,q.z)+.05;if(q.y<floor){q.y=floor;q.vy*=-.35;q.vx*=.6;q.vz*=.6;}}}
   for(let i=this.decals.length-1;i>=0;i--){const d=this.decals[i];d.age+=dt;if(d.age>=d.life){this.decals.splice(i,1);continue;}if(d.grow){d.size+=d.grow*dt;d.corners=null;}}
   for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.age+=dt;if(f.age>=f.life){f.light.intensity=0;this.flashes.splice(i,1);}else f.light.intensity=f.peak*Math.pow(1-f.age/f.life,2);}
   this.dustClock+=dt;
   if(this.dustClock>=.07){this.dustClock=0;for(const c of cars){if(!c.alive||!c.mesh.visible)continue;const pos=c.mesh.position,health=c.hp/c.maxHp;
    if(health<.4)this.emit(SMOKE,{x:pos.x,y:pos.y+1.5,z:pos.z},[(Math.random()-.5)*.8,1.6+Math.random(),(Math.random()-.5)*.8],1+Math.random()*.6,.6,2,[.08,.08,.08],[.25,.25,.25],health<.2?.75:.5,.8);
    if(health<.2)this.emit(FIRE,{x:pos.x+(Math.random()-.5)*.6,y:pos.y+1.2,z:pos.z+(Math.random()-.5)*.6},[0,1.8+Math.random(),0],.3+Math.random()*.2,.7,.25,[4,2.2,.6],[1.6,.3,.04],1,1);
    if(Math.abs(c.speed)<5)continue;const elevated=pos.y-terrainHeight(pos.x,pos.z)>1;
    for(const side of [-1,1]){const x=pos.x+Math.sin(c.angle)*1.25+Math.cos(c.angle)*side*.9,z=pos.z+Math.cos(c.angle)*1.25-Math.sin(c.angle)*side*.9;this.decal(0,x,z,.62,c.angle,3.2,[.06,.05,.04],.5,0,elevated?pos.y+.04:null);
     if(Math.random()<.8)this.emit(SMOKE,{x,y:(elevated?pos.y:terrainHeight(x,z))+.2,z},[(Math.random()-.5)*1.4,.5+Math.random()*.8,(Math.random()-.5)*1.4],.7+Math.random()*.5,.5,1.9,[this.dust.r*.85,this.dust.g*.85,this.dust.b*.85],[this.dust.r,this.dust.g,this.dust.b],.26,1.6);}}}
  }
  this.write();
 }
 /** Copies live particles and decals into the GPU buffers. */
 private write(){
  const counts=[0,0];for(const q of this.particles){const cloud=this.clouds[q.kind],g=cloud.geometry,i=counts[q.kind]++,t=q.age/q.life,fade=q.kind===FIRE?1-t*t:Math.min(1,t*8)*(1-t);(g.attributes.position as THREE.BufferAttribute).setXYZ(i,q.x,q.y,q.z);(g.attributes.aColor as THREE.BufferAttribute).setXYZW(i,q.r0+(q.r1-q.r0)*t,q.g0+(q.g1-q.g0)*t,q.b0+(q.b1-q.b0)*t,q.alpha*fade);(g.attributes.aShape as THREE.BufferAttribute).setXY(i,q.size0+(q.size1-q.size0)*(1-Math.pow(1-t,2)),q.rot);}
  this.clouds.forEach((cloud,kind)=>{const g=cloud.geometry;g.setDrawRange(0,counts[kind]);if(counts[kind])for(const name of ['position','aColor','aShape'])(g.attributes[name] as THREE.BufferAttribute).needsUpdate=true;cloud.visible=counts[kind]>0;});
  const g=this.decalMesh.geometry,position=g.attributes.position as THREE.BufferAttribute,color=g.attributes.color as THREE.BufferAttribute,uv=g.attributes.uv as THREE.BufferAttribute;
  this.decals.forEach((d,i)=>{if(!d.corners){d.corners=new Float32Array(12);const c=Math.cos(d.rot),s=Math.sin(d.rot),hw=d.tile===0?d.size*.14:d.size,hl=d.tile===0?d.size*.5:d.size;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b],k)=>{const lx=a*hw,lz=b*hl,x=d.x+lx*c+lz*s,z=d.z-lx*s+lz*c;d.corners!.set([x,d.y??terrainHeight(x,z)+.05,z],k*3);});}
   const t=d.age/d.life,alpha=d.alpha*(d.grow?1-t:Math.min(1,(1-t)*4));for(let k=0;k<4;k++){position.setXYZ(i*4+k,d.corners[k*3],d.corners[k*3+1],d.corners[k*3+2]);color.setXYZW(i*4+k,d.r,d.g,d.b,alpha);}const u0=d.tile/3,u1=(d.tile+1)/3;uv.setXY(i*4,u0,0);uv.setXY(i*4+1,u1,0);uv.setXY(i*4+2,u1,1);uv.setXY(i*4+3,u0,1);});
  g.setDrawRange(0,this.decals.length*6);this.decalMesh.visible=this.decals.length>0;if(this.decals.length){position.needsUpdate=color.needsUpdate=uv.needsUpdate=true;}
 }
 clear(){this.particles.length=0;this.decals.length=0;this.dustClock=0;for(const f of this.flashes)f.light.intensity=0;this.flashes.length=0;this.write();}
 get count(){return this.particles.length+this.decals.length;}
}
