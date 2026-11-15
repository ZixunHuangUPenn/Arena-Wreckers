// Meshes for the vehicle skills: the fortress dome, the grapple cable and lightning arcs.
// Particles, ground rings and light flashes go through CombatEffects; this file owns the few real meshes.
import * as THREE from 'three';

const domeVertex=`varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;
void main(){vLocal=position;vec4 world=modelMatrix*vec4(position,1.);vNormal=normalize(mat3(modelMatrix)*normal);vView=normalize(cameraPosition-world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}`;
const domeFragment=`uniform vec3 uColor;uniform float uTime;uniform float uFade;uniform float uStrain;uniform vec4 uHits[4];varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;
float hexEdge(vec2 p){p.x*=1.1547;p.y+=mod(floor(p.x),2.)*.5;p=abs(mod(p,1.)-.5);return abs(max(p.x*1.5+p.y,p.y*2.)-1.);}
void main(){vec3 dir=normalize(vLocal);float rim=pow(1.-abs(dot(normalize(vNormal),vView)),2.2);
 vec2 uv=vec2(atan(dir.z,dir.x)*3.82,acos(clamp(dir.y,-1.,1.))*7.);float cells=1.-smoothstep(.0,.09,hexEdge(uv));
 float sweep=pow(.5+.5*sin(dir.y*9.-uTime*3.2),8.);float base=pow(1.-clamp(dir.y,0.,1.),6.)*.55;
 float ripple=0.;for(int i=0;i<4;i++){float age=uHits[i].w;if(age<1.){float d=distance(dir,uHits[i].xyz);ripple+=(1.-age)*(smoothstep(.16,.0,abs(d-age*1.3))+.6*smoothstep(.5,.0,d)*(1.-age));}}
 float flicker=1.-uStrain*.45*step(.5,fract(uTime*11.));
 float a=(.03+rim*.42+cells*(.12+rim*.3)+sweep*.08+base*.6+ripple*1.4)*uFade*flicker;
 gl_FragColor=vec4(mix(uColor,vec3(1.),clamp(ripple*.6+rim*.12,0.,1.))*a,1.);}`;

export type Dome={mesh:THREE.Mesh;uniforms:{uColor:{value:THREE.Color};uTime:{value:number};uFade:{value:number};uStrain:{value:number};uHits:{value:THREE.Vector4[]}};next:number;closing:number};
export type Cable={group:THREE.Group;rope:THREE.Mesh;hook:THREE.Mesh};
type Bolt={mesh:THREE.Mesh;age:number;life:number};

export class SkillEffects{
 private domes:Dome[]=[];private bolts:Bolt[]=[];private cables:Cable[]=[];
 private domeGeometry=new THREE.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI*.56);
 private ropeGeometry=new THREE.CylinderGeometry(.045,.045,1,6).rotateX(Math.PI/2).translate(0,0,.5);
 private hookGeometry=new THREE.ConeGeometry(.2,.55,6).rotateX(Math.PI/2);
 private ropeMaterial=new THREE.MeshStandardMaterial({color:0x2a2d30,roughness:.45,metalness:.9,emissive:0x6a2a08,emissiveIntensity:.6});
 private hookMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,1.5,.4)});
 constructor(private scene:THREE.Scene){}
 /** Translucent hex-plated shield. Caller moves `mesh.position` each frame. */
 addDome(radius:number,color:number):Dome{
  const uniforms={uColor:{value:new THREE.Color(color)},uTime:{value:0},uFade:{value:0},uStrain:{value:0},uHits:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,1,0,1))}};
  const mesh=new THREE.Mesh(this.domeGeometry,new THREE.ShaderMaterial({uniforms,vertexShader:domeVertex,fragmentShader:domeFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  mesh.scale.setScalar(radius);mesh.frustumCulled=false;mesh.renderOrder=9;mesh.name='fx-dome';this.scene.add(mesh);const dome={mesh,uniforms,next:0,closing:0};this.domes.push(dome);return dome;}
 /** Ripple where a shot struck the dome. */
 hitDome(dome:Dome,point:THREE.Vector3){const slot=dome.uniforms.uHits.value[dome.next++%4],d=point.clone().sub(dome.mesh.position).normalize();slot.set(d.x,d.y,d.z,0);}
 /** Fades the dome out and removes it. */
 removeDome(dome:Dome){if(!dome.closing)dome.closing=.001;}
 addCable():Cable{const group=new THREE.Group(),rope=new THREE.Mesh(this.ropeGeometry,this.ropeMaterial),hook=new THREE.Mesh(this.hookGeometry,this.hookMaterial);group.add(rope,hook);group.name='fx-cable';this.scene.add(group);const cable={group,rope,hook};this.cables.push(cable);return cable;}
 setCable(cable:Cable,from:THREE.Vector3,to:THREE.Vector3){const length=Math.max(.01,from.distanceTo(to));cable.group.position.copy(from);cable.group.lookAt(to);cable.rope.scale.set(1,1,length);cable.hook.position.set(0,0,length);}
 removeCable(cable:Cable){this.scene.remove(cable.group);const i=this.cables.indexOf(cable);if(i>=0)this.cables.splice(i,1);}
 /** Jagged lightning arc between two points; fades within `life` seconds. */
 bolt(from:THREE.Vector3,to:THREE.Vector3,color=0xb98cff,life=.16,width=.11){
  if(this.bolts.length>=28)this.dropBolt(0);
  const span=to.clone().sub(from),length=span.length(),segments=Math.max(4,Math.min(14,Math.round(length/1.1))),side=new THREE.Vector3(-span.z,0,span.x).normalize(),up=new THREE.Vector3(0,1,0),points:THREE.Vector3[]=[];
  for(let i=0;i<=segments;i++){const t=i/segments,jitter=Math.sin(t*Math.PI)*Math.min(1.3,length*.12),p=from.clone().addScaledVector(span,t);if(i>0&&i<segments)p.addScaledVector(side,(Math.random()-.5)*2*jitter).addScaledVector(up,(Math.random()-.5)*jitter);points.push(p);}
  // Two crossed ribbons so the arc has width from the tilted game camera and from the side.
  const positions:number[]=[],index:number[]=[];for(const axis of [up,side]){const base=positions.length/3;points.forEach((p,i)=>{const w=width*(i===0||i===segments?.4:1);positions.push(p.x+axis.x*w,p.y+axis.y*w,p.z+axis.z*w,p.x-axis.x*w,p.y-axis.y*w,p.z-axis.z*w);if(i<segments){const k=base+i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}});}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(index);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(4),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));mesh.frustumCulled=false;mesh.renderOrder=9;mesh.name='fx-bolt';this.scene.add(mesh);this.bolts.push({mesh,age:0,life});}
 private dropBolt(i:number){const b=this.bolts[i];this.scene.remove(b.mesh);b.mesh.geometry.dispose();(b.mesh.material as THREE.Material).dispose();this.bolts.splice(i,1);}
 private dropDome(i:number){const d=this.domes[i];this.scene.remove(d.mesh);(d.mesh.material as THREE.Material).dispose();this.domes.splice(i,1);}
 update(dt:number){
  for(let i=this.bolts.length-1;i>=0;i--){const b=this.bolts[i];b.age+=dt;if(b.age>=b.life){this.dropBolt(i);continue;}(b.mesh.material as THREE.MeshBasicMaterial).opacity=(1-b.age/b.life)*(Math.random()<.25?.35:1);}
  for(let i=this.domes.length-1;i>=0;i--){const d=this.domes[i],u=d.uniforms;u.uTime.value+=dt;for(const h of u.uHits.value)h.w=Math.min(1,h.w+dt*2.2);
   if(d.closing){d.closing+=dt;u.uFade.value=Math.max(0,1-d.closing/.25);d.mesh.scale.multiplyScalar(1+dt*1.6);if(d.closing>=.25)this.dropDome(i);}else u.uFade.value=Math.min(1,u.uFade.value+dt*5);}
 }
 clear(){while(this.bolts.length)this.dropBolt(0);while(this.domes.length)this.dropDome(0);while(this.cables.length)this.removeCable(this.cables[0]);}
 /** Live helper objects in the scene. */
 get count(){return this.bolts.length+this.domes.length+this.cables.length;}
}
