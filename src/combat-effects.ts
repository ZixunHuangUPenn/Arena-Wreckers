// Combat effects: fireballs, rolling smoke, sparks, shockwaves, scorch marks, tyre marks and light flashes.
// All particles live in two point clouds (alpha-blended smoke, additive fire) and all ground decals in one
// mesh, so a full-screen firefight costs three draw calls. Fixed caps keep endless matches bounded.
import * as THREE from 'three';
import {terrainHeight} from './terrain';
import {deckHeight} from './bridge';
import {tileNoise} from './environment';

const MAX_PARTICLES=900,MAX_DECALS=260,TILES=6;
const SMOKE=0,FIRE=1,FLAME=2;
type Particle={kind:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;life:number;size0:number;size1:number;r0:number;g0:number;b0:number;r1:number;g1:number;b1:number;alpha:number;drag:number;gravity:number;rot:number;spin:number};
type Decal={rise?:boolean;tile:number;x:number;z:number;y:number|null;size:number;grow:number;rot:number;age:number;life:number;r:number;g:number;b:number;alpha:number;corners:Float32Array|null};
type CarLike={alive:boolean;hp:number;maxHp:number;speed:number;angle:number;mesh:THREE.Group};

function puffTexture(){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=tileNoise(x/size,y/size,4,4,17),m=tileNoise(x/size,y/size,9,3,5);data[i]=n*255;data[i+1]=m*255;data[i+2]=255;data[i+3]=255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
/**
 * Six tiles side by side: 0 solid strip (tyre mark), 1 ragged soft blot (scorch), 2 thin ring (shockwave),
 * 3 crater with a raised ejecta rim, 4 thick dashed warning ring (incoming shell), 5 branching electric burn.
 */
function decalTexture(){const h=64,w=h*TILES,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const tile=Math.floor(x/h),u=(x%h+.5)/h*2-1,v=(y+.5)/h*2-1,r=Math.hypot(u,v),i=(y*w+x)*4;let a=0,shade=255;
 if(tile===0)a=Math.max(0,1-Math.pow(Math.abs(u),6))*Math.max(0,1-Math.pow(Math.abs(v),10))*(.75+.25*tileNoise(x/h,y/h,8,2,3));
 else if(tile===1){const n=tileNoise((u+1)/2,(v+1)/2,5,4,29);a=Math.max(0,Math.min(1,(1-r*(.75+n*.6))*2.2));}
 else if(tile===2)a=Math.max(0,1-Math.abs(r-.82)/.13)*(r<.98?1:0);
 else if(tile===3){const n=tileNoise((u+1)/2,(v+1)/2,6,4,41),ray=Math.pow(Math.abs(Math.sin(Math.atan2(v,u)*7+n*4)),6);const pit=Math.max(0,1-r/(.55+n*.12)),rim=Math.max(0,1-Math.abs(r-.62-n*.1)/.16);a=Math.min(1,pit*1.6+rim*.65+ray*Math.max(0,1-r)*.55)*(r<.99?1:0);shade=Math.round(255*(1-pit*.55));}
 else if(tile===4){const ang=Math.atan2(v,u),dash=Math.sin(ang*12)>-.35?1:.25;a=Math.max(0,1-Math.abs(r-.84)/.1)*dash*(r<.99?1:0)+Math.max(0,.9-r)*.18;}
 else{const ang=Math.atan2(v,u);let best=0;for(let k=0;k<7;k++){const base=k/7*6.283+.4*Math.sin(k*3.7),wig=Math.sin(r*9+k*2.1)*.22+tileNoise((u+1)/2,(v+1)/2,8,2,60+k)*.3-.15,d=Math.abs(((ang-base-wig+9.42)%6.283)-3.14);best=Math.max(best,Math.max(0,1-d/(.09+.05*(1-r)))*Math.max(0,1-r*1.05));}a=Math.min(1,best*1.4+Math.max(0,.35-r)*1.6);}
 data[i]=data[i+1]=data[i+2]=shade;data[i+3]=Math.max(0,Math.min(1,a))*255;}const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
/** 4×4 flipbook of a billowing fireball that breaks up as it burns out. R = density, G = heat. */
function flameBook(){const f=64,n=f*4,data=new Uint8Array(n*n*4);for(let k=0;k<16;k++){const t=k/15,fx=(k%4)*f,fy=Math.floor(k/4)*f;for(let y=0;y<f;y++)for(let x=0;x<f;x++){const u=(x+.5)/f*2-1,v=(y+.5)/f*2-1,r=Math.hypot(u,v);
 const d=tileNoise((x+.5)/f,((y+.5)/f+t*.35)%1,4,4,71)*.75+tileNoise((x+.5)/f,(y+.5)/f,9,2,90+k)*.25,body=d+.55-r*(1.05+t*.25),th=.12+t*.55,a=Math.max(0,Math.min(1,(body-th)/.22)),heat=Math.max(0,Math.min(1,(body-th-.18)/.25))*(1-t*.8);
 const i=((fy+y)*n+fx+x)*4;data[i]=a*255;data[i+1]=heat*255;data[i+2]=0;data[i+3]=255;}}const tex=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex;}
const vertexShader=`attribute vec4 aColor;attribute vec3 aShape;uniform float uScale;varying vec4 vColor;varying vec3 vShape;
void main(){vColor=aColor;vShape=aShape;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(aShape.x*uScale/max(.1,-mv.z),420.);}`;
const flameShader=`uniform sampler2D uNoise;varying vec4 vColor;varying vec3 vShape;
void main(){vec2 c=gl_PointCoord-.5;float s=sin(vShape.y),k=cos(vShape.y);vec2 q=vec2(c.x*k-c.y*s,c.x*s+c.y*k)+.5;if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)discard;float f=min(15.,floor(vShape.z*16.));vec2 cell=vec2(mod(f,4.),floor(f/4.));vec4 t=texture2D(uNoise,(cell+q)/4.);
 gl_FragColor=vec4(vColor.rgb*(.55+1.4*t.g)*t.r*vColor.a,1.);}`;
const fragmentShader=(fire:boolean)=>`uniform sampler2D uNoise;varying vec4 vColor;varying vec3 vShape;
void main(){vec2 c=gl_PointCoord-.5;float s=sin(vShape.y),k=cos(vShape.y);vec2 q=vec2(c.x*k-c.y*s,c.x*s+c.y*k);float r=length(c)*2.;
 vec3 n=texture2D(uNoise,q*.8+.5+vShape.y*.37).rgb;
 ${fire?'float a=pow(max(0.,1.-r),1.4)*(.35+1.1*n.r*n.r+.4*n.g);gl_FragColor=vec4(vColor.rgb*a*vColor.a,1.);':'float a=smoothstep(1.,.25,r+(n.r-.5)*.7)*(.45+.55*n.g);gl_FragColor=vec4(vColor.rgb*(.7+.6*n.r),a*vColor.a);'}}`;

export class CombatEffects{
 /** Upper bound on live particles plus decals. */
 readonly capacity=MAX_PARTICLES+MAX_DECALS;
 private particles:Particle[]=[];private decals:Decal[]=[];private dustClock=0;private dust=new THREE.Color(0x9d8866);private track=new THREE.Color(0x3a3020);private theme=0;private rates=new Map<string,number>();
 private clouds:THREE.Points[]=[];private decalMesh:THREE.Mesh;private lights:THREE.PointLight[]=[];private flashes:{light:THREE.PointLight;age:number;life:number;peak:number}[]=[];private lightsOn=false;
 constructor(private scene:THREE.Scene){
  const noise=puffTexture(),book=flameBook(),uScale={value:400};
  for(const kind of [SMOKE,FIRE,FLAME]){const fire=kind!==SMOKE,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*3),3));g.setAttribute('aColor',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*4),4));g.setAttribute('aShape',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*3),3));g.setDrawRange(0,0);
   const material=new THREE.ShaderMaterial({uniforms:{uNoise:{value:kind===FLAME?book:noise},uScale},vertexShader,fragmentShader:kind===FLAME?flameShader:fragmentShader(fire),transparent:true,depthWrite:false,blending:fire?THREE.AdditiveBlending:THREE.NormalBlending});
   const cloud=new THREE.Points(g,material);cloud.frustumCulled=false;cloud.renderOrder=kind===SMOKE?7:kind===FLAME?8:9;cloud.name=['fx-smoke','fx-fire','fx-flame'][kind];
   // Point sprites are sized in world metres: convert with the live projection and drawing-buffer height.
   cloud.onBeforeRender=(renderer,_scene,camera)=>{uScale.value=renderer.getDrawingBufferSize(new THREE.Vector2()).y*camera.projectionMatrix.elements[5]*.5;};this.clouds.push(cloud);scene.add(cloud);}
  const dg=new THREE.BufferGeometry(),indices:number[]=[];dg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*12),3));dg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*16),4));dg.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(MAX_DECALS*8),2));for(let i=0;i<MAX_DECALS;i++)indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);dg.setIndex(indices);dg.setDrawRange(0,0);
  this.decalMesh=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({map:decalTexture(),vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,side:THREE.DoubleSide}));this.decalMesh.frustumCulled=false;this.decalMesh.renderOrder=3;this.decalMesh.name='fx-decals';scene.add(this.decalMesh);
  for(let i=0;i<2;i++){const light=new THREE.PointLight(0xffa651,0,26,1.6);light.name='fx-light';this.lights.push(light);}
  this.setLights(true);
 }
 /** Number of helper objects this system keeps in the scene while idle. */
 get persistent(){return 4+(this.lightsOn?this.lights.length:0);}
 /** Explosion light flashes cost a little on every lit surface; the low quality tier turns them off. */
 setLights(on:boolean){if(on===this.lightsOn)return;this.lightsOn=on;for(const light of this.lights){light.intensity=0;if(on)this.scene.add(light);else this.scene.remove(light);}this.flashes.length=0;}
 /** Colour of the dust thrown up by tyres and impacts, set per arena. */
 setDust(color:number){this.dust.setHex(color);this.track.setHex(color).multiplyScalar(.42);}
 /** Arena theme for themed debris: 0 desert sand, 1 foundry metal sparks, 2 frost snow, 3 caldera embers and ash. */
 setTheme(style:number){this.theme=style;}
 private emit(kind:number,p:{x:number;y:number;z:number},v:[number,number,number],life:number,size0:number,size1:number,c0:[number,number,number],c1:[number,number,number],alpha:number,drag=1.5,gravity=0){if(this.particles.length>=MAX_PARTICLES)this.particles.shift();this.particles.push({kind,x:p.x,y:p.y,z:p.z,vx:v[0],vy:v[1],vz:v[2],age:0,life,size0,size1,r0:c0[0],g0:c0[1],b0:c0[2],r1:c1[0],g1:c1[1],b1:c1[2],alpha,drag,gravity,rot:Math.random()*6.28,spin:(Math.random()-.5)*2});}
 private decal(tile:number,x:number,z:number,size:number,rot:number,life:number,color:[number,number,number],alpha:number,grow=0,y:number|null=null,rise=false){if(this.decals.length>=MAX_DECALS)this.decals.shift();this.decals.push({tile,x,z,y,size,grow,rot,age:0,life,r:color[0],g:color[1],b:color[2],alpha,corners:null,rise});}
 private flash(p:THREE.Vector3,peak:number,life:number){if(!this.lightsOn)return;const busy=new Set(this.flashes.map(f=>f.light)),light=this.lights.find(l=>!busy.has(l))??this.flashes.shift()!.light;light.position.set(p.x,p.y+1.2,p.z);this.flashes.push({light,age:0,life,peak});}
 private sparks(p:THREE.Vector3,count:number,speed:number,up=1){for(let i=0;i<count;i++){const a=Math.random()*6.28,s=speed*(.35+Math.random()*.65);this.emit(FIRE,p,[Math.cos(a)*s,(.3+Math.random())*speed*.6*up,Math.sin(a)*s],.35+Math.random()*.55,.22,.06,[4,2.6,1.1],[2.2,.5,.08],1,.6,16);}}
 /**
  * Layered blast: white flash → flipbook fireball → rolling black smoke → falling embers, plus sparks, debris, a
  * shockwave, a crater and scorch on the ground and a light flash. `power` 1 is a rocket hit or a barrel.
  */
 explosion(p:THREE.Vector3,power:number){
  if(power<.4){this.sparks(p,Math.round(4+power*10),7);this.emit(FIRE,p,[0,0,0],.09,.5,1.3,[3,2.2,1.2],[2,.8,.2],.9);this.emit(SMOKE,p,[(Math.random()-.5)*1.5,1+Math.random(),(Math.random()-.5)*1.5],.55,.5,1.4,[.3,.28,.26],[.45,.43,.4],.5);return;}
  const scale=Math.sqrt(power),ground=terrainHeight(p.x,p.z),onGround=p.y-ground<2.5;
  this.emit(FIRE,p,[0,0,0],.12,2.6*scale,7*scale,[6,5.2,3.6],[3,1.4,.3],1); // white-hot flash
  for(let i=0;i<Math.round(7*scale);i++){const a=Math.random()*6.28,s=(1+Math.random()*3)*scale;this.emit(FLAME,{x:p.x+Math.cos(a)*.4*scale,y:p.y+.2+Math.random()*.6,z:p.z+Math.sin(a)*.4*scale},[Math.cos(a)*s,1.4+Math.random()*2.6*scale,Math.sin(a)*s],.55+Math.random()*.4,1.5*scale,(3.1+Math.random()*1.4)*scale,[2.3,1.35,.5],[1,.28,.05],.85,2.4,-1.2);}
  for(let i=0;i<Math.round(6*scale);i++){const a=Math.random()*6.28,s=(1.5+Math.random()*4.5)*scale;this.emit(FIRE,{x:p.x+Math.cos(a)*.3,y:p.y+Math.random()*.5,z:p.z+Math.sin(a)*.3},[Math.cos(a)*s,1.2+Math.random()*3.4*scale,Math.sin(a)*s],.3+Math.random()*.3,1*scale,(2.2+Math.random()*1.2)*scale,[4.2,2.4,.7],[1.4,.22,.03],1,2.6,-1.5);}
  for(let i=0;i<Math.round(9*scale);i++){const a=Math.random()*6.28,s=(.6+Math.random()*2.2)*scale,shade=.04+Math.random()*.07;this.emit(SMOKE,{x:p.x+Math.cos(a)*.5,y:p.y+.5+Math.random()*.9,z:p.z+Math.sin(a)*.5},[Math.cos(a)*s,1.4+Math.random()*2.4,Math.sin(a)*s],1.8+Math.random()*1.8,1.4*scale,(3.8+Math.random()*2.2)*scale,[shade,shade,shade],[.28,.27,.26],.82,1,-.7);}
  this.sparks(p,Math.round((this.theme===1?26:16)*scale),13*scale);
  for(let i=0;i<Math.round(10*scale);i++){const a=Math.random()*6.28,s=1+Math.random()*4;this.emit(FIRE,{x:p.x,y:p.y+.5+Math.random(),z:p.z},[Math.cos(a)*s,3+Math.random()*5,Math.sin(a)*s],1.3+Math.random()*1.2,.14,.06,[4,1.8,.4],[1.5,.25,.03],1,.9,4);} // embers
  for(let i=0;i<Math.round(6*scale);i++){const a=Math.random()*6.28,s=4+Math.random()*7;this.emit(SMOKE,p,[Math.cos(a)*s,4+Math.random()*7,Math.sin(a)*s],.7+Math.random()*.6,.28,.2,[.05,.045,.04],[.05,.045,.04],1,.3,18);} // debris
  if(onGround){this.decal(2,p.x,p.z,1.2,Math.random()*6.28,.38,[3,2.2,1.4],.9,16*scale);this.decal(1,p.x,p.z,2.8*scale,Math.random()*6.28,16,[.03,.025,.02],.72);this.decal(3,p.x,p.z,1.5*scale,Math.random()*6.28,18,[.16,.13,.1],.85);
   for(let i=0;i<Math.round(5*scale);i++){const a=i/5*6.28+Math.random();this.emit(SMOKE,{x:p.x,y:ground+.3,z:p.z},[Math.cos(a)*6*scale,.6,Math.sin(a)*6*scale],.9,1,3.4*scale,[this.dust.r*.8,this.dust.g*.8,this.dust.b*.8],[this.dust.r,this.dust.g,this.dust.b],.5,2.2);}
   this.themeSpray(p.x,ground,p.z,scale);}
  this.flash(p,90*power,.32);
 }
 /** Ground thrown up by a blast, per arena: sand clods, molten metal, snow, lava embers and ash. */
 private themeSpray(x:number,y:number,z:number,scale:number){const at={x,y:y+.2,z},n=Math.round(10*scale);
  if(this.theme===2){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=2+Math.random()*5;this.emit(SMOKE,at,[Math.cos(a)*s,4+Math.random()*6,Math.sin(a)*s],1+Math.random()*.6,.5,2.2,[.95,.97,1],[.85,.9,.95],.75,1.6,7);}for(let i=0;i<n;i++){const a=Math.random()*6.28,s=3+Math.random()*6;this.emit(SMOKE,at,[Math.cos(a)*s,5+Math.random()*6,Math.sin(a)*s],.9,.16,.12,[.96,.98,1],[.9,.94,1],1,.4,16);}}
  else if(this.theme===3){for(let i=0;i<n*1.5;i++){const a=Math.random()*6.28,s=2+Math.random()*6;this.emit(FIRE,at,[Math.cos(a)*s,5+Math.random()*8,Math.sin(a)*s],1+Math.random(),.2,.08,[4.5,1.6,.25],[1.2,.15,.02],1,.5,14);}for(let i=0;i<n/2;i++)this.emit(SMOKE,{x:x+(Math.random()-.5)*3,y:y+1,z:z+(Math.random()-.5)*3},[(Math.random()-.5)*2,2+Math.random()*2,(Math.random()-.5)*2],2.5,.8,3.6,[.18,.16,.15],[.32,.3,.29],.55,.8,-.3);}
  else if(this.theme===1){for(let i=0;i<n*1.5;i++){const a=Math.random()*6.28,s=6+Math.random()*10;this.emit(FIRE,at,[Math.cos(a)*s,3+Math.random()*7,Math.sin(a)*s],.5+Math.random()*.6,.16,.05,[6,5,3.4],[3,1.1,.2],1,.6,20);}}
  else for(let i=0;i<n;i++){const a=Math.random()*6.28,s=2+Math.random()*5;this.emit(SMOKE,at,[Math.cos(a)*s,4+Math.random()*6,Math.sin(a)*s],.9,.22,.16,[this.dust.r*.7,this.dust.g*.7,this.dust.b*.7],[this.dust.r*.8,this.dust.g*.8,this.dust.b*.8],1,.4,16);}
 }
 muzzle(p:THREE.Vector3,aim:number,heavy:boolean){const fx=-Math.sin(aim),fz=-Math.cos(aim),s=heavy?1.7:1;this.emit(FIRE,p,[fx*2,0,fz*2],.06,1.1*s,1.9*s,[5,3.6,1.8],[3,1.2,.2],1);
  for(let i=0;i<(heavy?4:2);i++){const v=(7+Math.random()*9)*s;this.emit(FIRE,p,[fx*v+(Math.random()-.5)*2,(Math.random()-.3)*2,fz*v+(Math.random()-.5)*2],.07+Math.random()*.06,.45*s,.9*s,[4.5,2.8,1],[2,.5,.05],1,4);}
  for(let i=0;i<(heavy?3:1);i++)this.emit(SMOKE,p,[fx*(2+Math.random()*3),.6+Math.random(),fz*(2+Math.random()*3)],.5+Math.random()*.5,.45*s,1.5*s,[.5,.48,.45],[.7,.68,.65],heavy?.5:.28,2.4);
  if(heavy)this.flash(p,26,.1);}
 impact(p:THREE.Vector3,heavy:boolean){const at=p.clone(),ground=terrainHeight(at.x,at.z);if(heavy){if(at.y-ground<2.5)this.decal(1,at.x,at.z,1.4,Math.random()*6.28,10,[.04,.035,.03],.5);return;}
  this.sparks(at,5,6);this.emit(SMOKE,at,[(Math.random()-.5)*1.2,.9+Math.random(),(Math.random()-.5)*1.2],.5,.4,1.3,[this.dust.r*.7,this.dust.g*.7,this.dust.b*.7],[this.dust.r,this.dust.g,this.dust.b],.45,2);if(at.y-ground<1)this.decal(1,at.x,at.z,.5,Math.random()*6.28,6,[.05,.045,.04],.45);}
 /** One particle with explicit motion and colours, for skill effects that are not explosions. */
 spray(fire:boolean,p:{x:number;y:number;z:number},v:[number,number,number],life:number,size0:number,size1:number,c0:[number,number,number],c1:[number,number,number],alpha=1,drag=1.5,gravity=0){this.emit(fire?FIRE:SMOKE,p,v,life,size0,size1,c0,c1,alpha,drag,gravity);}
 /** Expanding ground ring: skill pulses and shockwaves. */
 ring(x:number,z:number,size:number,grow:number,life:number,color:[number,number,number],alpha=.9){this.decal(2,x,z,size,Math.random()*6.28,life,color,alpha,grow);}
 /** Short light flash without an explosion. */
 glint(p:THREE.Vector3,peak:number,life:number){this.flash(p,peak,life);}
 /** Tyre smoke and dark rubber from a sliding car; `slip` is its sideways speed in m/s. */
 skid(p:THREE.Vector3,angle:number,slip:number,onDeck:boolean){const k=Math.min(1,slip/7);for(const side of [-1,1]){const x=p.x+Math.sin(angle)*1.25+Math.cos(angle)*side*.9,z=p.z+Math.cos(angle)*1.25-Math.sin(angle)*side*.9,y=onDeck?p.y:terrainHeight(x,z);
  this.decal(0,x,z,.85,angle,5,[.02,.018,.015],.45+.45*k,0,onDeck?p.y+.04:null);
  if(Math.random()<.4+.6*k)this.emit(SMOKE,{x,y:y+.25,z},[(Math.random()-.5)*1.2,.6+Math.random()*.6,(Math.random()-.5)*1.2],.9+Math.random()*.6,.7,2.6,[.5,.49,.47],[.68,.67,.65],.18+.25*k,1.4);}}
 /** Dust thrown up where a car lands from a jump; power 0..1. */
 landing(p:THREE.Vector3,power:number){const d=this.dust;this.ring(p.x,p.z,1.2,5+8*power,.45,[d.r,d.g,d.b],.25+.45*power);
  for(let i=0,n=6+Math.round(12*power);i<n;i++){const a=Math.random()*Math.PI*2,v=2+Math.random()*4*(.5+power);this.emit(SMOKE,{x:p.x+Math.cos(a)*1.2,y:p.y+.2,z:p.z+Math.sin(a)*1.2},[Math.cos(a)*v,.5+Math.random()*1.2,Math.sin(a)*v],.8+Math.random()*.6,.6,2.4,[d.r*.85,d.g*.85,d.b*.85],[d.r,d.g,d.b],.3+.2*power,2.2);}}
 trail(p:THREE.Vector3){this.emit(SMOKE,p,[(Math.random()-.5)*.6,.5+Math.random()*.4,(Math.random()-.5)*.6],.7+Math.random()*.4,.35,1.25,[.62,.6,.58],[.8,.79,.77],.42,1.2);this.emit(FIRE,p,[0,0,0],.1,.7,.25,[4,2.2,.6],[2,.4,.05],1);}
 /* ---- Per-weapon looks. 0 rotary gun, 1 shotgun, 2 pulse cannon, 3 rocket pod, 4 mortar. */
 /** Muzzle signature for each gun on top of the shared flash: shotgun fan, blue pulse ring, mortar smoke ring. */
 weaponMuzzle(weapon:number,p:THREE.Vector3,aim:number){const fx=-Math.sin(aim),fz=-Math.cos(aim);
  if(weapon===1)for(let i=0;i<9;i++){const a=aim+(Math.random()-.5)*.7,v=10+Math.random()*10;this.emit(FIRE,p,[-Math.sin(a)*v,(Math.random()-.2)*2,-Math.cos(a)*v],.08+Math.random()*.08,.16,.05,[5,3.2,1.2],[2.4,.6,.08],1,3);}
  else if(weapon===2){this.emit(FIRE,p,[fx*3,0,fz*3],.1,.9,2.2,[1.2,3.4,5.5],[.2,1.2,3],1);for(let i=0;i<5;i++){const a=Math.random()*6.28,v=3+Math.random()*4;this.emit(FIRE,p,[Math.cos(a)*v+fx*4,Math.sin(a)*v*.6,Math.sin(a)*v+fz*4],.12,.14,.04,[1.5,3.6,6],[.3,1.4,3.4],1,4);}}
  else if(weapon===4)for(let i=0;i<10;i++){const a=i/10*6.28,v=2.6;this.emit(SMOKE,p,[Math.cos(a)*v+fx*2,Math.sin(a)*v*.5+.6,Math.sin(a)*v+fz*2],1.1+Math.random()*.4,.6,1.8,[.42,.4,.37],[.62,.6,.57],.42,2.2);}
 }
 /** A spent brass case (or a red shotgun hull) kicked out of the side of the gun; bounces on the ground. */
 casing(p:THREE.Vector3,aim:number,shell=false){const side=Math.random()<.5?1:-1,rx=Math.cos(aim)*side,rz=-Math.sin(aim)*side,v=2.5+Math.random()*2;
  this.emit(SMOKE,p,[rx*v+(Math.random()-.5),2.5+Math.random()*2,rz*v+(Math.random()-.5)],.9+Math.random()*.5,shell?.16:.11,shell?.14:.1,shell?[.62,.12,.08]:[.85,.62,.24],shell?[.4,.08,.05]:[.6,.42,.16],1,.4,20);}
 /** Called every frame for each projectile in flight. */
 projectileTrail(weapon:number,p:THREE.Vector3,dt:number,key:object){const rate=[0,0,70,26,16][weapon]??0;if(!rate||dt<=0)return;const due=(this.rates.get(String(weapon))??0)+rate*dt;let n=Math.floor(due);this.rates.set(String(weapon),due-n);void key;
  for(;n>0;n--){if(weapon===2){this.emit(FIRE,{x:p.x+(Math.random()-.5)*.12,y:p.y+(Math.random()-.5)*.12,z:p.z+(Math.random()-.5)*.12},[(Math.random()-.5)*.8,(Math.random()-.5)*.8,(Math.random()-.5)*.8],.16+Math.random()*.08,.5,.12,[.9,2.6,4.6],[.2,.8,2.4],1,2);}
   else if(weapon===3)this.trail(p);
   else this.emit(SMOKE,p,[(Math.random()-.5)*.3,.3+Math.random()*.3,(Math.random()-.5)*.3],.8+Math.random()*.4,.22,.9,[.55,.53,.5],[.75,.74,.72],.3,1.2);}}
 /**
  * Impact look for each gun. `dir` is the shot's travel direction; `onCar` true when it struck a vehicle (sparks
  * off metal, no ground mark). Rockets and shells also get the full explosion from the caller.
  */
 weaponImpact(weapon:number,p:THREE.Vector3,dir:THREE.Vector3,onCar:boolean){const at=p.clone(),ground=terrainHeight(at.x,at.z),low=at.y-ground<1.2,back=dir.clone().setY(0).normalize().multiplyScalar(-1);
  if(weapon===0){for(let i=0;i<5;i++){const v=4+Math.random()*7;this.emit(FIRE,at,[back.x*v+(Math.random()-.5)*5,1+Math.random()*4,back.z*v+(Math.random()-.5)*5],.2+Math.random()*.25,.12,.04,[5,3.6,1.6],[2.4,.7,.1],1,1,14);}
   if(!onCar){this.emit(SMOKE,at,[back.x,.9+Math.random(),back.z],.45,.3,1,[this.dust.r*.7,this.dust.g*.7,this.dust.b*.7],[this.dust.r,this.dust.g,this.dust.b],.4,2);if(low)this.decal(1,at.x,at.z,.28,Math.random()*6.28,5,[.05,.045,.04],.5);}}
  else if(weapon===1){for(let i=0;i<7;i++){const a=Math.atan2(back.x,back.z)+(Math.random()-.5)*2.2,v=3+Math.random()*6;this.emit(FIRE,at,[Math.sin(a)*v,.5+Math.random()*3,Math.cos(a)*v],.15+Math.random()*.2,.1,.03,[5,2.8,1],[2,.5,.06],1,1.2,12);}
   if(!onCar){this.emit(SMOKE,at,[0,.7,0],.5,.35,1.2,[this.dust.r*.75,this.dust.g*.75,this.dust.b*.75],[this.dust.r,this.dust.g,this.dust.b],.45,2);if(low)this.decal(1,at.x,at.z,.4,Math.random()*6.28,6,[.05,.045,.04],.4);}}
  else if(weapon===2){this.emit(FIRE,at,[0,0,0],.12,.6,2.4,[1.4,3.6,6],[.2,1,2.6],1);for(let i=0;i<8;i++){const a=Math.random()*6.28,v=3+Math.random()*6;this.emit(FIRE,at,[Math.cos(a)*v,1+Math.random()*3,Math.sin(a)*v],.25+Math.random()*.2,.12,.04,[1.6,3.8,6],[.3,1.2,3],1,1.5,8);}
   this.arc(at,1.3+Math.random()*.6);this.arc(at,1+Math.random()*.6);this.flash(at,14,.12);if(!onCar&&low)this.decal(5,at.x,at.z,.9,Math.random()*6.28,9,[.03,.04,.06],.7);}
  else if(low&&!onCar){const theme=this.theme;if(theme===2)for(let i=0;i<6;i++){const a=Math.random()*6.28,v=2+Math.random()*3;this.emit(SMOKE,at,[Math.cos(a)*v,3+Math.random()*3,Math.sin(a)*v],.8,.4,1.6,[.95,.97,1],[.85,.9,.95],.6,1.6,6);}}
 }
 /** A short jagged electric arc from `p` towards a random nearby point, drawn as a chain of blue sparks. */
 arc(p:THREE.Vector3,length:number,to?:THREE.Vector3){const end=to??p.clone().add(new THREE.Vector3((Math.random()-.5)*2,Math.random()*.8,(Math.random()-.5)*2).normalize().multiplyScalar(length));const steps=Math.max(5,Math.round(p.distanceTo(end)*5));let x=p.x,y=p.y,z=p.z;
  for(let i=1;i<=steps;i++){const t=i/steps,j=(1-Math.abs(t*2-1))*.35;x=p.x+(end.x-p.x)*t+(Math.random()-.5)*j;y=p.y+(end.y-p.y)*t+(Math.random()-.5)*j;z=p.z+(end.z-p.z)*t+(Math.random()-.5)*j;this.emit(FIRE,{x,y,z},[0,0,0],.1+Math.random()*.05,.22,.1,[1.8,4,6.5],[.4,1.4,3.4],1,0);}}
 /** Pulsing dashed ring where a lobbed shell will land, alive until it does. */
 warn(x:number,z:number,radius:number,life:number,enemy:boolean){this.decal(4,x,z,radius,Math.random()*6.28,Math.max(.2,life),enemy?[2.4,.5,.25]:[1.6,1.3,.6],enemy?.9:.55,0,null,true);}
 /** Smoke and small flames rising from a burnt-out wreck; `heat` 1 just destroyed, 0 cold. */
 smolder(p:THREE.Vector3,heat:number,dt:number){const due=(this.rates.get('wreck')??0)+dt*(4+heat*10);let n=Math.floor(due);this.rates.set('wreck',due-n);
  for(;n>0;n--){const x=p.x+(Math.random()-.5)*1.6,z=p.z+(Math.random()-.5)*2.2;this.emit(SMOKE,{x,y:p.y+.9,z},[(Math.random()-.5)*.6,1.4+Math.random(),(Math.random()-.5)*.6],2+Math.random(),.7,2.8,[.06,.06,.06],[.3,.3,.3],.55,.7,-.2);
   if(Math.random()<heat*.6)this.emit(FLAME,{x,y:p.y+.7,z},[0,1.2+Math.random(),0],.45+Math.random()*.25,.6,1.1,[1.7,.85,.25],[.7,.18,.03],.7,1);}}
 /**
  * Weather close to the camera: wind-blown sand streaks on the desert, sparks and steam in the foundry, falling
  * snow on the frost arena and ash with rising embers in the caldera. A few dozen particles at most.
  */
 ambient(dt:number,focus:{x:number;z:number}){if(dt<=0)return;const rate=[18,6,34,16][this.theme]??0,due=(this.rates.get('air')??0)+rate*dt;let n=Math.floor(due);this.rates.set('air',due-n);
  for(;n>0;n--){const x=focus.x+(Math.random()-.5)*44,z=focus.z+(Math.random()-.5)*36,g=terrainHeight(x,z);
   if(this.theme===0)this.emit(SMOKE,{x,y:g+.15+Math.random()*.5,z},[5+Math.random()*3,.15,2+Math.random()],1.6+Math.random(),.5,2.6,[this.dust.r*.95,this.dust.g*.95,this.dust.b*.95],[this.dust.r,this.dust.g,this.dust.b],.13,.2);
   else if(this.theme===2)this.emit(SMOKE,{x,y:g+5+Math.random()*7,z},[1.5+Math.random(),-1.6-Math.random(),.6],4,.12,.1,[.96,.98,1],[.96,.98,1],.85,.05);
   else if(this.theme===3){if(Math.random()<.6)this.emit(SMOKE,{x,y:g+4+Math.random()*6,z},[1+Math.random(),-.8,.4],4.5,.1,.08,[.2,.19,.18],[.3,.29,.28],.8,.05);else this.emit(FIRE,{x,y:g+.3,z},[.6,1.2+Math.random(),.3],2.6,.1,.04,[4,1.4,.25],[1.4,.2,.02],1,.1);}
   else if(Math.random()<.5)this.emit(SMOKE,{x,y:g+.3,z},[.4,.9+Math.random()*.5,.2],2.6,.6,2.8,[.5,.5,.52],[.62,.62,.64],.12,.3);else this.emit(FIRE,{x,y:g+3+Math.random()*4,z},[(Math.random()-.5)*2,-1.5,(Math.random()-.5)*2],1.4,.08,.03,[5,3.6,1.6],[2,.6,.1],1,.2,4);}}
 update(dt:number,cars:CarLike[]){
  if(dt>0){
   for(let i=this.particles.length-1;i>=0;i--){const q=this.particles[i];q.age+=dt;if(q.age>=q.life){this.particles.splice(i,1);continue;}const damp=Math.exp(-q.drag*dt);q.vx*=damp;q.vz*=damp;q.vy=q.vy*damp-q.gravity*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.rot+=q.spin*dt;if(q.gravity>0){const floor=terrainHeight(q.x,q.z)+.05;if(q.y<floor){q.y=floor;q.vy*=-.35;q.vx*=.6;q.vz*=.6;}}}
   for(let i=this.decals.length-1;i>=0;i--){const d=this.decals[i];d.age+=dt;if(d.age>=d.life){this.decals.splice(i,1);continue;}if(d.grow){d.size+=d.grow*dt;d.corners=null;}}
   for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.age+=dt;if(f.age>=f.life){f.light.intensity=0;this.flashes.splice(i,1);}else f.light.intensity=f.peak*Math.pow(1-f.age/f.life,2);}
   this.dustClock+=dt;
   if(this.dustClock>=.07){this.dustClock=0;for(const c of cars){if(!c.alive||!c.mesh.visible)continue;const pos=c.mesh.position,health=c.hp/c.maxHp;
    if(health<.4)this.emit(SMOKE,{x:pos.x,y:pos.y+1.5,z:pos.z},[(Math.random()-.5)*.8,1.6+Math.random(),(Math.random()-.5)*.8],1+Math.random()*.6,.6,2,[.08,.08,.08],[.25,.25,.25],health<.15?.8:.5,.8);
    if(health<.15){this.emit(FLAME,{x:pos.x+(Math.random()-.5)*.7,y:pos.y+1.15,z:pos.z+(Math.random()-.5)*.7},[0,2+Math.random(),0],.45+Math.random()*.25,.8,1.5,[3.2,1.7,.5],[1.4,.35,.05],.9,1);if(Math.random()<.5)this.emit(FIRE,{x:pos.x+(Math.random()-.5)*.6,y:pos.y+1.3,z:pos.z+(Math.random()-.5)*.6},[(Math.random()-.5),2.5+Math.random()*2,(Math.random()-.5)],.6,.12,.05,[4,2.2,.6],[1.6,.3,.04],1,.6,-1);}
    if(Math.abs(c.speed)<5)continue;const deck=deckHeight(pos.x,pos.z),elevated=deck!==null&&pos.y>deck-1.4;if(pos.y-(elevated?deck!:terrainHeight(pos.x,pos.z))>.5)continue;/* in the air: no marks */
    for(const side of [-1,1]){const x=pos.x+Math.sin(c.angle)*1.25+Math.cos(c.angle)*side*.9,z=pos.z+Math.cos(c.angle)*1.25-Math.sin(c.angle)*side*.9;this.decal(0,x,z,.62,c.angle,3.2,[this.track.r,this.track.g,this.track.b],.5,0,elevated?pos.y+.04:null);
     if(Math.random()<.8)this.emit(SMOKE,{x,y:(elevated?pos.y:terrainHeight(x,z))+.2,z},[(Math.random()-.5)*1.4,.5+Math.random()*.8,(Math.random()-.5)*1.4],.7+Math.random()*.5,.5,1.9,[this.dust.r*.85,this.dust.g*.85,this.dust.b*.85],[this.dust.r,this.dust.g,this.dust.b],.26,1.6);}}}
  }
  this.write();
 }
 /** Copies live particles and decals into the GPU buffers. */
 private write(){
  const counts=[0,0,0];for(const q of this.particles){const cloud=this.clouds[q.kind],g=cloud.geometry,i=counts[q.kind]++,t=q.age/q.life,fade=q.kind===SMOKE?Math.min(1,t*8)*(1-t):q.kind===FLAME?Math.min(1,t*12)*(1-t*t*t):1-t*t;(g.attributes.position as THREE.BufferAttribute).setXYZ(i,q.x,q.y,q.z);(g.attributes.aColor as THREE.BufferAttribute).setXYZW(i,q.r0+(q.r1-q.r0)*t,q.g0+(q.g1-q.g0)*t,q.b0+(q.b1-q.b0)*t,q.alpha*fade);(g.attributes.aShape as THREE.BufferAttribute).setXYZ(i,q.size0+(q.size1-q.size0)*(1-Math.pow(1-t,2)),q.rot,t);}
  this.clouds.forEach((cloud,kind)=>{const g=cloud.geometry;g.setDrawRange(0,counts[kind]);if(counts[kind])for(const name of ['position','aColor','aShape'])(g.attributes[name] as THREE.BufferAttribute).needsUpdate=true;cloud.visible=counts[kind]>0;});
  const g=this.decalMesh.geometry,position=g.attributes.position as THREE.BufferAttribute,color=g.attributes.color as THREE.BufferAttribute,uv=g.attributes.uv as THREE.BufferAttribute;
  this.decals.forEach((d,i)=>{if(!d.corners){d.corners=new Float32Array(12);const c=Math.cos(d.rot),s=Math.sin(d.rot),hw=d.tile===0?d.size*.14:d.size,hl=d.tile===0?d.size*.5:d.size;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b],k)=>{const lx=a*hw,lz=b*hl,x=d.x+lx*c+lz*s,z=d.z-lx*s+lz*c;d.corners!.set([x,d.y??terrainHeight(x,z)+.05,z],k*3);});}
   const t=d.age/d.life,alpha=d.alpha*(d.rise?Math.min(1,t*2.2)*(.7+.3*Math.sin(d.age*18))*Math.min(1,(1-t)*12):d.grow?1-t:Math.min(1,(1-t)*4));for(let k=0;k<4;k++){position.setXYZ(i*4+k,d.corners[k*3],d.corners[k*3+1],d.corners[k*3+2]);color.setXYZW(i*4+k,d.r,d.g,d.b,alpha);}const u0=d.tile/TILES,u1=(d.tile+1)/TILES;uv.setXY(i*4,u0,0);uv.setXY(i*4+1,u1,0);uv.setXY(i*4+2,u1,1);uv.setXY(i*4+3,u0,1);});
  g.setDrawRange(0,this.decals.length*6);this.decalMesh.visible=this.decals.length>0;if(this.decals.length){position.needsUpdate=color.needsUpdate=uv.needsUpdate=true;}
 }
 clear(){this.particles.length=0;this.decals.length=0;this.dustClock=0;this.rates.clear();for(const f of this.flashes)f.light.intensity=0;this.flashes.length=0;this.write();}
 get count(){return this.particles.length+this.decals.length;}
}
