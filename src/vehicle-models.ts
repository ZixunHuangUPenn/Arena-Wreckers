// Generated vehicles, second generation. Each hull is a smooth loft of super-elliptic cross-sections whose
// half-width, sill and roof heights follow monotone splines; wheel arches are carved out of the sill line,
// so the bodywork wraps the tyres the way a real panel does. Trim (pillars, panel gaps, stripes, armour)
// is laid onto the same surface, materials are physically based, and a shared procedural wear map adds
// road dust, grime and edge scratches in the shader. Everything is generated here; no external meshes.
// Local axes: +X right, +Y up, -Z forward (the game drives cars towards -Z).
import * as THREE from 'three';

type V3=[number,number,number];
type Bucket='paint'|'trim'|'steel'|'dark'|'rubber'|'glass'|'chrome'|'lamp'|'tail'|'amber'|'hazard'|'glow'|'well'|'brass'|'olive'|'suit';

/* ------------------------------------------------------------------ geometry helpers */

/** Indexed merge that keeps position, normal and uv. */
function merge(parts:THREE.BufferGeometry[]){
 let vertices=0,indices=0;
 for(const p of parts){vertices+=p.attributes.position.count;indices+=p.index?p.index.count:p.attributes.position.count;}
 const position=new Float32Array(vertices*3),normal=new Float32Array(vertices*3),uv=new Float32Array(vertices*2),index=vertices>65535?new Uint32Array(indices):new Uint16Array(indices);
 let v=0,k=0;
 for(const p of parts){
  if(!p.attributes.normal)p.computeVertexNormals();
  const count=p.attributes.position.count;
  position.set(p.attributes.position.array as Float32Array,v*3);normal.set(p.attributes.normal.array as Float32Array,v*3);
  if(p.attributes.uv)uv.set(p.attributes.uv.array as Float32Array,v*2);
  if(p.index){const a=p.index.array;for(let i=0;i<a.length;i++)index[k++]=a[i]+v;}else for(let i=0;i<count;i++)index[k++]=v+i;
  v+=count;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(index,1));
 g.computeBoundingSphere();return g;
}
const place=(g:THREE.BufferGeometry,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{if(rx)g.rotateX(rx);if(ry)g.rotateY(ry);if(rz)g.rotateZ(rz);g.translate(x,y,z);return g;};
/** Box with rounded edges; normals follow the rounding so highlights roll over the edges. */
export function rbox(w:number,h:number,d:number,r=.03,x=0,y=0,z=0,rx=0,ry=0,rz=0,s=2){
 r=Math.max(.001,Math.min(r,w/2-.001,h/2-.001,d/2-.001));
 const n=2*s+1,g=new THREE.BoxGeometry(2,2,2,n,n,n),p=g.attributes.position,nm=g.attributes.normal,half=[w/2,h/2,d/2];
 const inner=new THREE.Vector3(),pos=new THREE.Vector3(),dir=new THREE.Vector3();
 const map=(c:number,hh:number)=>{const i=Math.round((c+1)/2*n);return i<=s?-hh+r*(i/s):hh-r*((n-i)/s);};
 for(let i=0;i<p.count;i++){
  pos.set(map(p.getX(i),half[0]),map(p.getY(i),half[1]),map(p.getZ(i),half[2]));
  inner.set(THREE.MathUtils.clamp(pos.x,-half[0]+r,half[0]-r),THREE.MathUtils.clamp(pos.y,-half[1]+r,half[1]-r),THREE.MathUtils.clamp(pos.z,-half[2]+r,half[2]-r));
  dir.subVectors(pos,inner);
  if(dir.lengthSq()>1e-10){dir.normalize();pos.copy(inner).addScaledVector(dir,r);nm.setXYZ(i,dir.x,dir.y,dir.z);}
  p.setXYZ(i,pos.x,pos.y,pos.z);
 }
 return place(g,x,y,z,rx,ry,rz);
}
const box=(w:number,h:number,d:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>place(new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
/** Cylinder between two points (radius at a, radius at b). */
function rod(a:V3,b:V3,radius:number,sides=10,radiusEnd=radius,open=false){
 const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=from.distanceTo(to),g=new THREE.CylinderGeometry(radiusEnd,radius,length,sides,1,open);
 g.translate(0,length/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(...a);return g;
}
/** Disc/cylinder along the X axis (wheel style). */
const xcyl=(r:number,w:number,x:number,y:number,z:number,sides=20,r2=r,open=false)=>{const g=new THREE.CylinderGeometry(r2,r,w,sides,1,open);g.rotateZ(Math.PI/2);g.translate(x,y,z);return g;};
/** Cylinder along Z (lamp, barrel, exhaust facing forward/back). */
const zcyl=(r:number,len:number,x:number,y:number,z:number,sides=16,r2=r)=>{const g=new THREE.CylinderGeometry(r2,r,len,sides);g.rotateX(Math.PI/2);g.translate(x,y,z);return g;};
const ycyl=(r:number,h:number,x:number,y:number,z:number,sides=16,r2=r)=>place(new THREE.CylinderGeometry(r2,r,h,sides),x,y,z);
const tube=(points:V3[],radius:number,sides=8,closed=false)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'catmullrom',.3),Math.max(8,points.length*8),radius,sides,closed);
const sphere=(r:number,x:number,y:number,z:number,sx=1,sy=1,sz=1,ws=16,hs=10)=>{const g=new THREE.SphereGeometry(r,ws,hs);g.scale(sx,sy,sz);g.translate(x,y,z);return g;};
/** Coil spring between two points. */
function coil(a:V3,b:V3,radius:number,wire:number,turns=6){
 const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),axis=to.clone().sub(from),len=axis.length();axis.normalize();
 const side=Math.abs(axis.y)<.9?new THREE.Vector3(0,1,0).cross(axis).normalize():new THREE.Vector3(1,0,0),up=axis.clone().cross(side);
 const pts:THREE.Vector3[]=[];for(let i=0;i<=turns*12;i++){const t=i/(turns*12),ang=t*turns*Math.PI*2;pts.push(from.clone().addScaledVector(axis,t*len).addScaledVector(side,Math.cos(ang)*radius).addScaledVector(up,Math.sin(ang)*radius));}
 return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),turns*16,wire,5,false);
}
/** Mirror across X = 0, fixing winding and normals. */
function mirror(g:THREE.BufferGeometry){const m=g.clone();m.scale(-1,1,1);if(!m.index){const count=m.attributes.position.count;m.setIndex(Array.from({length:count},(_,i)=>i));}const a=m.index!.array as Uint16Array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}m.index!.needsUpdate=true;return m;}
/** Arc band (fender flare) lying in the YZ plane at x, around a wheel centre. */
function flare(x:number,y:number,z:number,r:number,width:number,depth:number,from=.08,to=Math.PI-.08){
 const segs=20,pos:number[]=[],idx:number[]=[];
 // Four-corner profile swept around the arc: inner/outer radius × inboard/outboard face, closed into a rounded lip.
 const prof:[number,number][]=[[0,-depth*.2],[0,depth*.6],[width*.55,depth],[width,depth*.55],[width,-depth*.2]];
 for(let i=0;i<=segs;i++){const a=from+(to-from)*i/segs,ca=Math.cos(a),sa=Math.sin(a);for(const [dr,dx] of prof){const rr=r+dr;pos.push(x+dx,y+sa*rr,z+ca*rr);}}
 const pc=prof.length;for(let i=0;i<segs;i++)for(let j=0;j<pc-1;j++){const a=i*pc+j,b=a+1,c=a+pc,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 return orientOut(g,new THREE.Vector3(x,y,z));
}
/** Flip winding so faces point away from a reference point (works for open shells). */
function orientOut(g:THREE.BufferGeometry,centre:THREE.Vector3){
 const p=g.attributes.position,idx=Array.from(g.index!.array),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let score=0;
 for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);const n=b.clone().sub(a).cross(c.clone().sub(a)),m=a.add(b).add(c).multiplyScalar(1/3).sub(centre);score+=Math.sign(n.dot(m));}
 if(score<0){for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}g.setIndex(idx);}g.computeVertexNormals();return g;
}

/* ------------------------------------------------------------------ smooth loft */

type Key={z:number;hw:number;yb:number;yt:number;n?:number;tw?:number;bw?:number};
type Arch={z:number;y:number;r:number};
type Station={z:number;hw:number;yb:number;yt:number;n:number;tw:number;bw:number};
/** Monotone cubic (Fritsch–Carlson) through the samples, so splines never overshoot the keys. */
function monotone(xs:number[],ys:number[]){
 const n=xs.length;if(n===1)return()=>ys[0];
 const d:number[]=[],m:number[]=new Array(n).fill(0);
 for(let i=0;i<n-1;i++)d[i]=(ys[i+1]-ys[i])/(xs[i+1]-xs[i]);
 m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
 for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
 return (x:number)=>{if(x<=xs[0])return ys[0];if(x>=xs[n-1])return ys[n-1];let i=0;while(x>xs[i+1])i++;const h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];};
}
const sgnPow=(v:number,e:number)=>Math.sign(v)*Math.pow(Math.abs(v),e);
class Loft{
 z0:number;z1:number;f:Record<'hw'|'yb'|'yt'|'n'|'tw'|'bw',(z:number)=>number>;arches:Arch[];
 constructor(keys:Key[],arches:Arch[]=[]){
  const zs=keys.map(k=>k.z);this.z0=zs[0];this.z1=zs[zs.length-1];this.arches=arches;
  const field=(get:(k:Key)=>number)=>monotone(zs,keys.map(get));
  this.f={hw:field(k=>k.hw),yb:field(k=>k.yb),yt:field(k=>k.yt),n:field(k=>k.n??5),tw:field(k=>k.tw??1),bw:field(k=>k.bw??1)};
 }
 at(t:number):Station{
  const z=this.z0+(this.z1-this.z0)*t;let yb=this.f.yb(z);const yt=this.f.yt(z);
  for(const a of this.arches){const dz=Math.abs(z-a.z);if(dz<a.r){const top=a.y+Math.sqrt(a.r*a.r-dz*dz);yb=Math.max(yb,Math.min(top,yt-.07));}}
  return {z,hw:this.f.hw(z),yb,yt,n:this.f.n(z),tw:this.f.tw(z),bw:this.f.bw(z)};
 }
 /** Angle a: 0 = +X side, π/2 = top, π = −X side, 3π/2 = bottom. */
 point(s:Station,a:number,out=new THREE.Vector3()){
  const e=2/s.n,cx=sgnPow(Math.cos(a),e),cy=sgnPow(Math.sin(a),e),mid=(s.yb+s.yt)/2,hh=(s.yt-s.yb)/2,k=(cy+1)/2;
  return out.set(cx*s.hw*(s.bw+(s.tw-s.bw)*k),mid+cy*hh,s.z);
 }
 /** Outward unit normal by finite differences. */
 normal(t:number,a:number,out=new THREE.Vector3()){
  const e=1e-3,p=this.point(this.at(t),a),pa=this.point(this.at(t),a+e),pt=this.point(this.at(Math.min(1,t+e)),a),pt2=this.point(this.at(Math.max(0,t-e)),a);
  const da=pa.sub(p),dt=pt.sub(pt2);out.crossVectors(dt,da).normalize();
  const s=this.at(t),radial=new THREE.Vector3(p.x,p.y-(s.yb+s.yt)/2,0);if(out.dot(radial)<0)out.negate();
  return out;
 }
 /** Surface patch over t∈[t0,t1] and a∈[a0,a1], lifted `offset` metres along the normal. */
 patch(t0=0,t1=1,a0=-Math.PI/2,a1=Math.PI*1.5,ts=48,as=40,offset=0){
  const pos:number[]=[],uv:number[]=[],idx:number[]=[],p=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<=ts;i++){const t=t0+(t1-t0)*i/ts,s=this.at(t);for(let j=0;j<=as;j++){const a=a0+(a1-a0)*j/as;this.point(s,a,p);if(offset){this.normal(t,a,n);p.addScaledVector(n,offset);}pos.push(p.x,p.y,p.z);uv.push(j/as,i/ts);}}
  for(let i=0;i<ts;i++)for(let j=0;j<as;j++){const a=i*(as+1)+j,b=a+1,c=a+as+1,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check against the loft axis.
  const probe=this.at((t0+t1)/2),centre=new THREE.Vector3(0,(probe.yb+probe.yt)/2,probe.z);
  return orientPatch(g,centre,this,t0,t1);
 }
 /** Flat end caps so the shell is closed. */
 cap(end:0|1,ring=40){const s=this.at(end),c=new THREE.Vector3(0,(s.yb+s.yt)/2,s.z),pos=[c.x,c.y,c.z],idx:number[]=[],p=new THREE.Vector3();for(let j=0;j<=ring;j++){this.point(s,-Math.PI/2+j/ring*Math.PI*2,p);pos.push(p.x,p.y,p.z);}for(let j=1;j<=ring;j++)idx.push(0,j,j+1);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const n=g.attributes.normal;if((n.getZ(0)>0)!==(end===1)){const a=idx;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.setIndex(a);g.computeVertexNormals();}return g;}
 /** Full closed shell. */
 shell(ts=56,as=44){return [this.patch(0,1,-Math.PI/2,Math.PI*1.5,ts,as),this.cap(0,as),this.cap(1,as)];}
}
function orientPatch(g:THREE.BufferGeometry,centre:THREE.Vector3,_l:Loft,_t0:number,_t1:number){
 const p=g.attributes.position,n=g.attributes.normal;let score=0;
 for(let i=0;i<p.count;i+=7){const dx=p.getX(i)-centre.x,dy=p.getY(i)-centre.y;score+=n.getX(i)*dx+n.getY(i)*dy;}
 if(score<0){const a=Array.from(g.index!.array);for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.setIndex(a);g.computeVertexNormals();}
 return g;
}

/* ------------------------------------------------------------------ procedural wear map + materials */

let wearTexture:THREE.DataTexture|null=null;
/** Tileable 256² map: R = large grime blotches, G = fine scratches, B = grain. Shared by every vehicle. */
export function vehicleWearMap(){
 if(wearTexture)return wearTexture;
 const N=256,data=new Uint8Array(N*N*4);let seed=1337;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const lattice=(size:number)=>{const v=new Float32Array(size*size);for(let i=0;i<v.length;i++)v[i]=rnd();return (x:number,y:number)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),g=(a:number,b:number)=>v[((b%size+size)%size)*size+((a%size+size)%size)];return THREE.MathUtils.lerp(THREE.MathUtils.lerp(g(xi,yi),g(xi+1,yi),sx),THREE.MathUtils.lerp(g(xi,yi+1),g(xi+1,yi+1),sx),sy);};};
 const octaves=[4,8,16,32,64].map(s=>({s,f:lattice(s)}));
 const scratch=new Float32Array(N*N);
 for(let k=0;k<420;k++){let x=rnd()*N,y=rnd()*N;const ang=(rnd()<.6?rnd()*.5-.25:rnd()*Math.PI),len=4+rnd()*26,strength=.4+rnd()*.6;for(let s=0;s<len;s++){const xi=((Math.floor(x)%N)+N)%N,yi=((Math.floor(y)%N)+N)%N;scratch[yi*N+xi]=Math.max(scratch[yi*N+xi],strength);x+=Math.cos(ang);y+=Math.sin(ang);}}
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  let f=0,amp=.5,tot=0;for(const o of octaves){f+=o.f(x/N*o.s,y/N*o.s)*amp;tot+=amp;amp*=.55;}f/=tot;
  const i=(y*N+x)*4;data[i]=Math.round(THREE.MathUtils.clamp((f-.5)*1.9+.5,0,1)*255);data[i+1]=Math.round(scratch[y*N+x]*255);data[i+2]=Math.round(octaves[4].f(x/N*64,y/N*64)*255);data[i+3]=255;
 }
 wearTexture=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);wearTexture.wrapS=wearTexture.wrapT=THREE.RepeatWrapping;wearTexture.magFilter=THREE.LinearFilter;wearTexture.minFilter=THREE.LinearMipmapLinearFilter;wearTexture.generateMipmaps=true;wearTexture.needsUpdate=true;
 return wearTexture;
}
type Wear={dirt:number;scratch:number;dust?:number;top?:number;battle?:{value:number}};
/** Adds object-space triplanar grime, dust on horizontal faces and edge scratches to a standard/physical material. */
function weathered<T extends THREE.MeshStandardMaterial>(material:T,wear:Wear){
 const uniforms={uWear:{value:vehicleWearMap()},uDust:{value:new THREE.Color(wear.dust??0x8a7a62)},uDirt:{value:wear.dirt},uScratch:{value:wear.scratch},uDirtTop:{value:wear.top??1.1},uBattle:wear.battle??{value:0}};
 material.userData.wear=uniforms;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vObjPos;varying vec3 vObjNrm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvObjPos=position;vObjNrm=normalize(objectNormal);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D uWear;uniform vec3 uDust;uniform float uDirt,uScratch,uDirtTop,uBattle;varying vec3 vObjPos;varying vec3 vObjNrm;
vec4 wearTri(vec3 p,vec3 n,float s){vec3 w=pow(abs(n),vec3(4.));w/=(w.x+w.y+w.z+1e-4);return texture2D(uWear,p.zy*s)*w.x+texture2D(uWear,p.xz*s)*w.y+texture2D(uWear,p.xy*s)*w.z;}`)
  .replace('#include <color_fragment>',`#include <color_fragment>
vec4 wA=wearTri(vObjPos,vObjNrm,.32),wB=wearTri(vObjPos,vObjNrm,1.35);
float low=clamp((uDirtTop-vObjPos.y)/uDirtTop,0.,1.);
float dirt=uDirt*smoothstep(.25,.95,low*1.15+(wA.r-.5)*1.1);
dirt=max(dirt,uDirt*.6*smoothstep(.55,.95,vObjNrm.y)*smoothstep(.45,.8,wA.r));
float scratch=uScratch*smoothstep(.35,.85,wB.g)*(1.-dirt);
diffuseColor.rgb=mix(diffuseColor.rgb,uDust*(.75+.5*wB.b),clamp(dirt,0.,1.));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.5,.5,.49),scratch);
diffuseColor.rgb*=.94+.12*wB.b;
// Battle damage grows as the hull loses health: soot blooms out of the grime pattern and bare metal shows in fresh gouges.
float soot=uBattle*smoothstep(.75-uBattle*.6,.95-uBattle*.5,wA.r*.7+wB.b*.3);
float gouge=uBattle*smoothstep(.55,.9,wB.g)*smoothstep(.3,.7,wA.b);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03,.028,.025),clamp(soot*.85,0.,1.));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.42,.41,.4),gouge*(1.-soot));
dirt=max(dirt,soot);scratch=max(scratch,gouge);`)
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(mix(roughnessFactor,.96,dirt)+(wA.b-.5)*.1-scratch*.2,.04,1.);')
  .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(mix(metalnessFactor,0.,dirt),.85,scratch);')
  .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+uBattle*.45*vec3(wA.r-.5,wB.b-.5,wA.g-.5));')
  .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=clamp(1.-dirt*1.4-scratch,0.,1.);\n#endif');
 };
 material.customProgramCacheKey=()=>'aw-wear';
 return material;
}
type Finish={metal:number;rough:number;coat:number;coatRough:number;dirt:number;scratch:number;dust:number};
const finishes:Finish[]=[
 {metal:.15,rough:.42,coat:1,coatRough:.06,dirt:.62,scratch:.35,dust:0x9c8667}, // Mantis: race gloss, desert-dusted
 {metal:.1,rough:.55,coat:.45,coatRough:.25,dirt:.5,scratch:.55,dust:0x857560},  // Punisher: worn satin
 {metal:.55,rough:.3,coat:1,coatRough:.04,dirt:.22,scratch:.18,dust:0x8a7d68},   // Retro: metallic show paint
 {metal:0,rough:.82,coat:0,coatRough:.5,dirt:.75,scratch:.4,dust:0x8d7d63},     // Pummeler: matte military
 {metal:.25,rough:.38,coat:1,coatRough:.08,dirt:.42,scratch:.3,dust:0x80705b},  // Bigrig: fleet gloss
];
function materialSet(kind:number,color:number):Record<Bucket,THREE.Material>{
 const f=finishes[kind]??finishes[1],dust=f.dust;
 const battle={value:0},w=(dirt:number,scratch:number,top=1.1):Wear=>({dirt,scratch,dust,top,battle});
 const glass=new THREE.MeshPhysicalMaterial({name:'Glass',color:0x0d1519,metalness:0,roughness:.05,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.5,ior:1.52});
 const well=new THREE.MeshStandardMaterial({name:'Wheel well',color:0x0b0b0c,roughness:.95,side:THREE.DoubleSide});
 return {
  paint:weathered(new THREE.MeshPhysicalMaterial({name:'Paint',color,metalness:f.metal,roughness:f.rough,clearcoat:f.coat,clearcoatRoughness:f.coatRough}),w(f.dirt,f.scratch,kind===3?1.25:1)),
  trim:weathered(new THREE.MeshStandardMaterial({name:'Satin black',color:0x18191b,metalness:.2,roughness:.6}),w(f.dirt*.9,f.scratch*.5)),
  steel:weathered(new THREE.MeshStandardMaterial({name:'Gunmetal',color:0x5c6266,metalness:.85,roughness:.42}),w(f.dirt*.8,.6)),
  dark:weathered(new THREE.MeshStandardMaterial({name:'Black plastic',color:0x1c1d1f,metalness:0,roughness:.78}),w(f.dirt,.15)),
  rubber:weathered(new THREE.MeshStandardMaterial({name:'Rubber',color:0x171717,metalness:0,roughness:.9}),w(Math.min(.85,f.dirt+.15),0,.9)),
  glass,
  chrome:weathered(new THREE.MeshStandardMaterial({name:'Chrome',color:0xe4e6e8,metalness:1,roughness:.1}),w(f.dirt*.35,.05)),
  lamp:new THREE.MeshStandardMaterial({name:'Headlamp',color:0xf4f2ea,emissive:0xfff1d0,emissiveIntensity:3.2,roughness:.2}),
  tail:new THREE.MeshStandardMaterial({name:'Tail lamp',color:0x4a0605,emissive:0xff1a0c,emissiveIntensity:2.2,roughness:.25}),
  amber:new THREE.MeshStandardMaterial({name:'Marker lamp',color:0x6a3a04,emissive:0xff9a1a,emissiveIntensity:2,roughness:.3}),
  hazard:weathered(new THREE.MeshStandardMaterial({name:'Hazard',color:0xd9a320,metalness:.1,roughness:.55}),w(f.dirt*.8,.5)),
  glow:new THREE.MeshStandardMaterial({name:'Energy',color:0x0a2a30,emissive:0x3fe8ff,emissiveIntensity:3.5}),
  well,
  brass:weathered(new THREE.MeshStandardMaterial({name:'Brass',color:0xb48a46,metalness:1,roughness:.32}),w(.2,.2)),
  olive:weathered(new THREE.MeshStandardMaterial({name:'Olive drab',color:0x4c5233,metalness:.05,roughness:.75}),w(f.dirt,.35)),
  suit:new THREE.MeshStandardMaterial({name:'Driver',color:0x2a2d33,metalness:.1,roughness:.6}),
 };
}

/* ------------------------------------------------------------------ wheels */

type RimStyle='race'|'beadlock'|'mag'|'military'|'truck';
const wheelCache=new Map<string,{tyre:THREE.BufferGeometry;rim:THREE.BufferGeometry;rimDark:THREE.BufferGeometry;brake:THREE.BufferGeometry}>();
/** Tyre with sidewall bulge and an off-road block tread, plus one of five rim designs. Built around the X axis. */
function wheelParts(radius:number,width:number,style:RimStyle){
 const key=`${radius}|${width}|${style}`;if(wheelCache.has(key))return wheelCache.get(key)!;
 const half=width/2,rimR=radius*(style==='truck'||style==='military'?.6:.64),U=96,blocks=style==='mag'?32:20;
 // Cross-section from inner bead, over the shoulder and tread, back to the other bead: [radius, axial offset, tread?]
 const prof:[number,number,number][]=[[rimR*.98,-half*.86,0],[rimR+radius*.06,-half*.98,0],[radius*.86,-half*1.02,0],[radius*.95,-half*.96,0],[radius*.99,-half*.82,1],[radius,-half*.55,1],[radius,-half*.2,1],[radius,half*.2,1],[radius,half*.55,1],[radius*.99,half*.82,1],[radius*.95,half*.96,0],[radius*.86,half*1.02,0],[rimR+radius*.06,half*.98,0],[rimR*.98,half*.86,0]];
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];
 for(let i=0;i<=U;i++){const th=i/U*Math.PI*2;for(let j=0;j<prof.length;j++){const [r0,ax,tr]=prof[j];let r=r0;if(tr){const side=ax<0?-1:1,phase=(i/U*blocks+(Math.abs(ax)>half*.5?.5:0)+side*.25)%1;const groove=style==='mag'?(phase<.22?1:0):(phase<.3?1:0);r-=groove*radius*(style==='mag'?.018:.045);}pos.push(ax,Math.cos(th)*r,Math.sin(th)*r);uv.push(j/(prof.length-1),i/U);}}
 const pc=prof.length;for(let i=0;i<U;i++)for(let j=0;j<pc-1;j++){const a=i*pc+j,b=a+1,c=a+pc,d=c+1;idx.push(a,b,c,b,d,c);}
 let tyre=new THREE.BufferGeometry();tyre.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));tyre.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));tyre.setIndex(idx);tyre=orientOut(tyre,new THREE.Vector3());
 const rim:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[],face=half*.62;
 rim.push(xcyl(rimR,width*.9,0,0,0,32,rimR,true)); // barrel
 dark.push(xcyl(rimR*.97,width*.86,0,0,0,24,rimR*.97,true));
 for(const side of [-1,1]){
  const sx=side*face;
  rim.push(place(new THREE.TorusGeometry(rimR*.99,radius*.035,6,40),sx,0,0,0,Math.PI/2)); // outer lip
  if(style==='race'){
   rim.push(xcyl(rimR*.9,.03,sx,0,0,32),xcyl(rimR*.22,.08,sx+side*.03,0,0,16));
   for(let k=0;k<6;k++){const s=rbox(.05,rimR*.78,rimR*.16,.015,sx+side*.02,rimR*.48,0);s.rotateX(k/6*Math.PI*2);rim.push(s);}
   for(let k=0;k<12;k++){const a=k/12*Math.PI*2;rim.push(xcyl(.018,.04,sx+side*.025,Math.cos(a)*rimR*.94,Math.sin(a)*rimR*.94,6));} // beadlock bolts
   dark.push(xcyl(rimR*.85,.02,sx-side*.01,0,0,24));
  }else if(style==='beadlock'){
   rim.push(xcyl(rimR*.92,.035,sx,0,0,32),xcyl(rimR*.3,.07,sx+side*.025,0,0,8));
   rim.push(place(new THREE.TorusGeometry(rimR*.9,.035,5,40),sx+side*.03,0,0,0,Math.PI/2));
   for(let k=0;k<16;k++){const a=k/16*Math.PI*2;rim.push(xcyl(.02,.05,sx+side*.05,Math.cos(a)*rimR*.9,Math.sin(a)*rimR*.9,6));}
   for(let k=0;k<6;k++){const a=k/6*Math.PI*2;dark.push(xcyl(rimR*.13,.045,sx+side*.012,Math.cos(a)*rimR*.58,Math.sin(a)*rimR*.58,14));}
   for(let k=0;k<6;k++){const a=(k+.5)/6*Math.PI*2;rim.push(xcyl(.022,.06,sx+side*.05,Math.cos(a)*rimR*.2,Math.sin(a)*rimR*.2,6));}
  }else if(style==='mag'){
   rim.push(xcyl(rimR*.3,.06,sx+side*.02,0,0,20),xcyl(rimR*.95,.02,sx-side*.03,0,0,32));
   for(let k=0;k<5;k++){const a=k/5*Math.PI*2,s=rbox(.06,rimR*.62,rimR*.36,.03,sx+side*.012,rimR*.55,0);s.rotateX(a);dark.push(s);}
   for(let k=0;k<5;k++){const a=(k+.5)/5*Math.PI*2,s=rbox(.065,rimR*.7,rimR*.2,.03,sx+side*.015,rimR*.55,0);s.rotateX(a);rim.push(s);}
   for(let k=0;k<5;k++){const a=k/5*Math.PI*2;rim.push(xcyl(.02,.05,sx+side*.05,Math.cos(a)*rimR*.18,Math.sin(a)*rimR*.18,6));}
  }else if(style==='military'){
   rim.push(xcyl(rimR*.92,.04,sx,0,0,28),xcyl(rimR*.42,.12,sx+side*.04,0,0,10),xcyl(rimR*.18,.18,sx+side*.06,0,0,8));
   for(let k=0;k<8;k++){const a=k/8*Math.PI*2;rim.push(xcyl(.022,.08,sx+side*.06,Math.cos(a)*rimR*.33,Math.sin(a)*rimR*.33,6));dark.push(xcyl(rimR*.09,.05,sx+side*.012,Math.cos(a)*rimR*.66,Math.sin(a)*rimR*.66,10));}
   rim.push(rod([sx+side*.09,0,0],[sx+side*.05,rimR*.85,rimR*.2],.012,5)); // tyre inflation line
  }else{
   rim.push(xcyl(rimR*.94,.04,sx-side*.05,0,0,32,rimR*.94),xcyl(rimR*.56,.1,sx-side*.01,0,0,24,rimR*.7),xcyl(rimR*.34,.14,sx+side*.03,0,0,20,rimR*.28));
   for(let k=0;k<10;k++){const a=k/10*Math.PI*2;rim.push(xcyl(.022,.06,sx+side*.06,Math.cos(a)*rimR*.45,Math.sin(a)*rimR*.45,6));}
   for(let k=0;k<5;k++){const a=k/5*Math.PI*2;dark.push(xcyl(rimR*.1,.03,sx-side*.025,Math.cos(a)*rimR*.74,Math.sin(a)*rimR*.74,12));}
  }
 }
 const brake=merge([xcyl(rimR*.72,.025,0,0,0,28)]);
 const result={tyre,rim:merge(rim),rimDark:merge(dark),brake};
 for(const g of Object.values(result))g.userData.shared=true;
 wheelCache.set(key,result);return result;
}

/* ------------------------------------------------------------------ vehicle assembly */

export type VehicleVisual=THREE.Group&{userData:{materials:THREE.Material[];turretZ:number;turret:THREE.Group;paint:THREE.MeshPhysicalMaterial;body:THREE.Group;wheels:{mesh:THREE.Group;steer:boolean;radius:number}[]}};
type WheelSpec={x:number;z:number;radius:number;width:number;steer:boolean;style:RimStyle};

/** Builds one of the five vehicles (0 Mantis, 1 Punisher, 2 Retro, 3 Pummeler, 4 Bigrig) with its weapon on a `Turret` node. */
export function buildVehicle(kind:number,color:number,gunHeight:number):VehicleVisual{
 const materials=materialSet(kind,color);
 const root=new THREE.Group() as VehicleVisual,body=new THREE.Group(),turret=new THREE.Group();body.name='Body';turret.name='Turret';root.add(body);
 const hull:Partial<Record<Bucket,THREE.BufferGeometry[]>>={},gunParts:Partial<Record<Bucket,THREE.BufferGeometry[]>>={};
 const add=(b:Bucket,...g:THREE.BufferGeometry[])=>{(hull[b]??=[]).push(...g);};
 const both=(b:Bucket,...gs:THREE.BufferGeometry[])=>{for(const g of gs)add(b,g,mirror(g));};
 const gun=(b:Bucket,...g:THREE.BufferGeometry[])=>{(gunParts[b]??=[]).push(...g);};
 const wheels:WheelSpec[]=[];
 const axle=(z:number,x:number,radius:number,width:number,steer:boolean,style:RimStyle)=>{wheels.push({x,z,radius,width,steer,style},{x:-x,z,radius,width,steer,style});add('dark',rod([-x+width*.4,radius,z],[x-width*.4,radius,z],.05,8));};
 /** Wheel-well liner: dark half tube across the body so no daylight shows through a carved arch. */
 const well=(z:number,y:number,r:number,halfWidth:number)=>{const g=new THREE.CylinderGeometry(r,r,halfWidth*2,20,1,true,-Math.PI/2,Math.PI);g.rotateZ(Math.PI/2);g.translate(0,y,z);add('well',g);};
 /** Round headlamp: housing, chrome reflector, glowing bulb and a clear lens. */
 const roundLamp=(x:number,y:number,z:number,r:number,dir=-1,bucket:Bucket='lamp')=>{both('trim',zcyl(r*1.18,.07,x,y,z-dir*.02,20));both('chrome',zcyl(r*1.02,.02,x,y,z+dir*.02,20,r*.7));both(bucket,zcyl(r*.42,.03,x,y,z+dir*.035,14));both('glass',sphere(r*.98,x,y,z+dir*.02,1,1,.25,18,8));};
 const rectLamp=(x:number,y:number,z:number,w:number,h:number,dir=-1,bucket:Bucket='lamp')=>{both('trim',rbox(w+.05,h+.05,.06,.02,x,y,z-dir*.01));both(bucket,rbox(w,h,.04,.015,x,y,z+dir*.02));};
 const mirrorArm=(x:number,y:number,z:number,size=1)=>{both('trim',rod([x-.12*size,y-.04,z],[x,y,z],.018,6),rbox(.09*size,.12*size,.2*size,.03,x+.03,y+.03,z+.02,0,.25,0));both('glass',box(.012,.09*size,.15*size,x+.08,y+.03,z+.03,0,.25,0));};
 const bolts=(points:V3[],axis:'x'|'y'|'z',r=.016,b:Bucket='steel')=>{for(const [x,y,z] of points){const g=new THREE.CylinderGeometry(r,r*1.1,r*1.2,6);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);g.translate(x,y,z);add(b,g);}};
 const helmet=(x:number,y:number,z:number)=>{add('paint',sphere(.15,x,y,z,1,1.05,1.12,18,12));add('glass',sphere(.152,x,y+.01,z-.03,.92,.55,1,16,8).translate(0,0,-.04));add('suit',rbox(.42,.34,.3,.1,x,y-.33,z+.04),rbox(.12,.12,.1,.04,x,y-.16,z+.02));};
 const gloss=(l:Loft)=>{add('paint',...l.shell());};
 let turretZ=0,deck=1;

 if(kind===0){ /* ---------------- Mantis: mid-engine desert trophy buggy with long-travel suspension */
  const tub=new Loft([{z:-1.86,hw:.28,yb:.4,yt:.52,n:3},{z:-1.62,hw:.46,yb:.32,yt:.62,n:4},{z:-1.05,hw:.58,yb:.28,yt:.7,n:5,tw:.9},{z:-.3,hw:.66,yb:.27,yt:.76,n:5,tw:.85},{z:.55,hw:.7,yb:.28,yt:.84,n:5,tw:.85},{z:1.25,hw:.64,yb:.32,yt:.9,n:5,tw:.85},{z:1.72,hw:.5,yb:.4,yt:.86,n:4},{z:1.84,hw:.36,yb:.46,yt:.78,n:3}]);
  add('paint',tub.patch(0,1,-.25,Math.PI+.25,64,40));add('trim',tub.patch(0,1,Math.PI+.25,Math.PI*2-.25,64,14),tub.cap(0),tub.cap(1));
  // Hood scoop, racing number board and a carbon-black splitter.
  add('trim',rbox(.9,.05,.5,.02,0,.38,-1.82));add('paint',rbox(.5,.1,.5,.05,0,.72,-.9,.08));add('dark',rbox(.36,.06,.06,.02,0,.73,-1.15,.08));
  both('trim',tub.patch(.33,.62,-.05,.18,26,6,.006));
  // Cockpit: dark tub, seats, steering wheel and a helmeted driver for scale.
  add('dark',rbox(1.0,.16,1.15,.07,0,.78,.05));add('trim',rbox(.48,.62,.16,.06,0,1.0,.42,-.18));helmet(0,1.24,.18);
  add('trim',place(new THREE.TorusGeometry(.13,.02,6,20),0,1.0,-.32,-1.05));add('trim',rod([0,.92,-.12],[0,.98,-.28],.02,6));
  add('trim',rbox(.8,.02,.22,.01,0,.95,-.6,-.9));for(let i=0;i<5;i++)add('steel',rod([-.38+i*.19,.9,-.52],[-.38+i*.19,1.02,-.68],.008,4));
  // Tube-frame roll cage in satin black with gusset plates.
  const cage:V3[][]=[[[-.66,.8,-.55],[-.6,1.36,-.32],[0,1.44,-.28],[.6,1.36,-.32],[.66,.8,-.55]],[[-.68,.86,.72],[-.62,1.42,.66],[0,1.48,.66],[.62,1.42,.66],[.68,.86,.72]]];
  for(const c of cage)add('trim',tube(c,.042,8));
  both('trim',tube([[.6,1.36,-.32],[.62,1.44,.15],[.62,1.42,.66]],.04,8),rod([.62,1.42,.66],[.5,.95,1.55],.036,8),rod([.6,1.36,-.32],[.55,.72,-1.25],.036,8),rod([.66,.82,-.55],[.68,.86,.72],.036,8));
  add('trim',rod([-.6,1.4,.1],[.6,1.4,.62],.03,6),rod([-.6,1.42,.66],[.6,.92,1.5],.03,6));
  // Roof light pod: four off-road lamps.
  add('trim',rbox(1.0,.1,.14,.04,0,1.52,-.3));for(const x of [-.36,-.12,.12,.36]){add('trim',zcyl(.075,.1,x,1.62,-.33,16));add('chrome',zcyl(.066,.02,x,1.62,-.39,16,.045));add('lamp',zcyl(.03,.02,x,1.62,-.4,10));}
  // Rear engine bay, intercooler and exhausts.
  add('steel',rbox(.82,.38,.62,.06,0,1.02,1.25));add('dark',rbox(.86,.08,.66,.03,0,1.24,1.25));for(let i=0;i<6;i++)add('trim',box(.7,.012,.03,0,1.08+i*.025,1.57));
  both('chrome',tube([[.24,.86,1.5],[.34,.98,1.74],[.36,1.04,1.98]],.05,10));both('dark',zcyl(.04,.06,.36,1.045,2.0,10));
  // Rear wing on swan-neck stands.
  add('paint',rbox(2.0,.05,.42,.02,0,1.52,1.62,.12));both('trim',rbox(.04,.34,.48,.015,.98,1.5,1.62),rod([.42,1.08,1.5],[.42,1.5,1.6],.025,6));
  // Long-travel suspension: A-arms, hub carriers and coil-over dampers on all four corners.
  for(const [z,x,top] of [[-1.25,1.0,.4],[1.15,1.0,.46]] as const){
   both('steel',rod([.5,.42,z-.24],[x-.12,top,z],.028,6),rod([.5,.42,z+.24],[x-.12,top,z],.028,6),rod([.52,.62,z-.18],[x-.14,top+.16,z],.022,6),rod([.52,.62,z+.18],[x-.14,top+.16,z],.022,6));
   both('chrome',rod([.6,1.0,z],[x-.18,top+.12,z],.03,8));both('hazard',coil([.62,.98,z],[x-.2,top+.16,z],.06,.012,6));
   both('trim',flare(x,top,z,top+.07,.16,.24,.2,Math.PI-.15));
  }
  // Front bumper hoop and skid plate, tow strap, tail lamps.
  add('trim',tube([[-.62,.45,-1.86],[-.5,.5,-2.0],[0,.52,-2.04],[.5,.5,-2.0],[.62,.45,-1.86]],.035,8));add('steel',rbox(.9,.04,.6,.02,0,.26,-1.45,.15));
  add('hazard',rbox(.12,.04,.2,.01,0,.5,1.86));rectLamp(.3,.82,1.84,.14,.06,1,'tail');
  roundLamp(.3,.52,-1.78,.06);
  axle(-1.25,1.0,.4,.3,true,'race');axle(1.15,1.0,.46,.38,false,'race');
  turretZ=.15;deck=1.5;
 }else if(kind===1){ /* ---------------- Punisher: armoured single-cab pickup */
  const arches=[{z:-1.35,y:.43,r:.53},{z:1.35,y:.43,r:.53}];
  const lower=new Loft([{z:-2.08,hw:.9,yb:.5,yt:.9,n:4},{z:-2.0,hw:.98,yb:.42,yt:1.0,n:6},{z:-1.6,hw:1.0,yb:.4,yt:1.06,n:7},{z:-.8,hw:1.01,yb:.4,yt:1.12,n:8},{z:.4,hw:1.01,yb:.4,yt:1.14,n:8},{z:1.9,hw:1.01,yb:.42,yt:1.14,n:8},{z:2.05,hw:.98,yb:.46,yt:1.1,n:6}],arches);
  add('paint',lower.patch(0,1,-.55,Math.PI+.55,72,44));add('trim',lower.patch(0,1,Math.PI+.55,Math.PI*2-.55,72,12),lower.cap(0),lower.cap(1));
  for(const a of arches){well(a.z,a.y,a.r,.95);both('trim',flare(1.0,a.y,a.z,a.r,.12,.08));}
  const cab=new Loft([{z:-.92,hw:.97,yb:1.08,yt:1.14,n:6,tw:.9},{z:-.4,hw:.96,yb:1.08,yt:1.76,n:6,tw:.82},{z:.3,hw:.96,yb:1.08,yt:1.8,n:6,tw:.82},{z:.44,hw:.96,yb:1.08,yt:1.74,n:6,tw:.84}]);
  add('glass',cab.patch(0,1,-.1,Math.PI+.1,30,32));
  add('paint',cab.patch(.3,1,.52,Math.PI-.52,24,18,.012));                            // roof skin
  both('paint',cab.patch(.28,.42,-.05,.75,10,12,.01),cab.patch(.86,1,-.05,.85,10,12,.01)); // A and B/C pillars
  add('paint',cab.patch(.88,1,.6,Math.PI-.6,8,16,.01));
  both('trim',cab.patch(0,1,-.06,.03,30,3,.014));                                     // window belt seal
  // Door seams, handle and armour plate with rivets.
  both('trim',lower.patch(.465,.469,.08,1.05,2,10,.004),lower.patch(.6,.604,.08,1.1,2,10,.004));
  both('steel',rbox(.03,.42,1.0,.02,1.04,.78,-.25));bolts([[1.06,.6,-.7],[1.06,.6,-.25],[1.06,.6,.2],[1.06,.96,-.7],[1.06,.96,-.25],[1.06,.96,.2]],'x',.018);bolts([[-1.06,.6,-.7],[-1.06,.6,-.25],[-1.06,.6,.2],[-1.06,.96,-.7],[-1.06,.96,-.25],[-1.06,.96,.2]],'x',.018);
  both('chrome',rbox(.03,.035,.16,.01,1.03,1.04,.15));
  // Steel mesh guards over side windows.
  for(const side of [-1,1]){for(let i=0;i<6;i++){const z=-.25+i*.11;add('steel',rod([side*.95,1.16,z],[side*.85,1.66,z],.01,4));}add('steel',rod([side*.95,1.36,-.3],[side*.95,1.36,.36],.01,4));}
  // Bed: rails, tailgate cap, floor, roll bar, spare tyre and jerry cans.
  both('paint',rbox(.08,.24,1.48,.03,.95,1.25,1.26));add('paint',rbox(1.98,.22,.08,.03,0,1.24,2.0));add('trim',rbox(1.82,.04,1.42,.02,0,1.16,1.26));
  both('chrome',rbox(.1,.025,1.5,.01,.95,1.38,1.26));
  add('trim',tube([[-.9,1.36,.55],[-.86,1.9,.56],[.86,1.9,.56],[.9,1.36,.55]],.045,10));
  const spare=wheelParts(.38,.28,'beadlock');add('rubber',spare.tyre.clone().rotateZ(Math.PI/2).translate(-.42,1.32,1.62));add('steel',spare.rim.clone().rotateZ(Math.PI/2).translate(-.42,1.32,1.62));
  for(const z of [1.55,1.8])add('olive',rbox(.18,.36,.26,.025,.72,1.36,z));
  // Front: steel push bar, winch, grille with slats, twin round lamps, fog lamps, skid plate.
  add('steel',rbox(2.04,.24,.18,.05,0,.56,-2.1));add('steel',tube([[-.78,.62,-2.15],[-.82,1.2,-2.2],[-.4,1.26,-2.22],[.4,1.26,-2.22],[.82,1.2,-2.2],[.78,.62,-2.15]],.05,10));add('steel',rod([-.82,.95,-2.2],[.82,.95,-2.2],.04,8));
  add('trim',rbox(.36,.18,.2,.04,0,.56,-2.2));add('steel',rbox(1.6,.04,.7,.02,0,.32,-1.8,.18));
  add('trim',rbox(1.2,.36,.08,.03,0,.82,-2.08));for(let i=0;i<5;i++)add('chrome',rbox(1.1,.025,.03,.01,0,.69+i*.065,-2.12));
  roundLamp(.74,.86,-2.1,.1);both('amber',rbox(.14,.06,.05,.02,.74,.68,-2.1));
  // Roof light bar and antenna, side mirrors, side steps, tail lamps, rear bumper, mud flaps, tow hooks.
  add('trim',rbox(1.4,.1,.16,.04,0,1.9,-.38));for(const x of [-.5,-.25,0,.25,.5])add('lamp',rbox(.16,.06,.02,.01,x,1.9,-.47));add('amber',rbox(.12,.06,.06,.02,.0,1.97,-.3));
  add('trim',rod([.82,1.82,.3],[.82,2.9,.38],.008,4));mirrorArm(1.03,1.28,-.82,1.1);
  both('steel',rbox(.14,.04,1.3,.02,1.06,.38,-.1));rectLamp(.88,.98,2.05,.14,.3,1,'tail');add('steel',rbox(2.04,.18,.16,.04,0,.56,2.1));
  both('dark',rbox(.3,.34,.02,.01,.82,.32,1.85));both('hazard',rod([.4,.48,-2.2],[.4,.48,-2.3],.03,8));
  add('chrome',zcyl(.04,.1,.55,.36,2.05,10));
  axle(-1.35,1.0,.43,.34,true,'beadlock');axle(1.35,1.0,.43,.34,false,'beadlock');
  turretZ=1.25;deck=1.18;
 }else if(kind===2){ /* ---------------- Retro: long-hood 1970s fastback muscle coupe */
  const arches=[{z:-1.42,y:.36,r:.45},{z:1.38,y:.38,r:.47}];
  const lower=new Loft([{z:-2.18,hw:.9,yb:.36,yt:.68,n:5},{z:-2.08,hw:.97,yb:.3,yt:.78,n:7},{z:-1.4,hw:.99,yb:.28,yt:.84,n:8},{z:-.4,hw:.99,yb:.28,yt:.88,n:8},{z:.6,hw:1.0,yb:.28,yt:.9,n:8},{z:1.38,hw:1.07,yb:.3,yt:.92,n:8},{z:1.98,hw:1.02,yb:.34,yt:.92,n:7},{z:2.16,hw:.96,yb:.4,yt:.9,n:5}],arches);
  add('paint',lower.patch(0,1,-.4,Math.PI+.4,80,46));add('trim',lower.patch(0,1,Math.PI+.4,Math.PI*2-.4,80,12),lower.cap(0),lower.cap(1));
  for(const a of arches)well(a.z,a.y,a.r,.92);
  const cab=new Loft([{z:-.62,hw:.92,yb:.86,yt:.9,n:6,tw:.86},{z:-.12,hw:.9,yb:.86,yt:1.3,n:6,tw:.76},{z:.5,hw:.9,yb:.86,yt:1.34,n:6,tw:.76},{z:1.2,hw:.92,yb:.88,yt:1.12,n:6,tw:.8},{z:1.86,hw:.94,yb:.9,yt:.93,n:6,tw:.86}]);
  add('glass',cab.patch(0,1,-.12,Math.PI+.12,40,32));
  add('paint',cab.patch(.22,.62,.5,Math.PI-.5,24,16,.012),cab.patch(.62,1,.22,Math.PI-.22,20,18,.008));        // roof + fastback sail
  both('paint',cab.patch(.2,.27,-.05,.8,6,12,.01),cab.patch(.45,.8,-.05,.3,16,6,.009));
  both('chrome',cab.patch(0,1,-.06,.0,40,2,.014));                                                              // drip rail trim
  // Long hood with a shaker scoop, twin stripes, chrome bumpers, quad lamps in a black grille.
  add('trim',rbox(.5,.16,.62,.07,0,.93,-1.0),rbox(.42,.05,.04,.02,0,.97,-1.31));add('chrome',rbox(.52,.03,.64,.01,0,1.02,-1.0));
  for(const x of [-.17,.17])add('trim',lower.patch(.03,.38,Math.PI/2+x*.95-.05,Math.PI/2+x*.95+.05,40,3,.003),cab.patch(.15,.98,Math.PI/2+x*.6-.04,Math.PI/2+x*.6+.04,30,2,.016),lower.patch(.86,1,Math.PI/2+x*.95-.05,Math.PI/2+x*.95+.05,10,3,.003));
  add('chrome',rbox(2.04,.12,.14,.05,0,.46,-2.2),rbox(2.04,.12,.14,.05,0,.5,2.2));both('chrome',rbox(.08,.12,.4,.04,1.0,.46,-2.02),rbox(.08,.12,.4,.04,1.0,.5,2.02));
  add('trim',rbox(1.62,.28,.06,.03,0,.66,-2.14));for(let i=0;i<7;i++)add('dark',box(1.5,.012,.02,0,.55+i*.035,-2.17));
  roundLamp(.6,.66,-2.16,.075);roundLamp(.36,.66,-2.16,.06);
  rectLamp(.52,.76,2.15,.62,.1,1,'tail');add('trim',rbox(.3,.12,.04,.02,0,.76,2.16));add('paint',rbox(1.8,.05,.18,.02,0,.95,2.06,-.25));    // ducktail
  // Side pipes, door seam, mirrors, chrome window trim, cowl vent, wipers.
  both('chrome',tube([[1.02,.3,-.65],[1.03,.28,.0],[1.03,.28,.8],[1.04,.3,1.0]],.05,10));both('dark',xcyl(.03,.02,1.04,.3,1.02,8).rotateY(Math.PI/2));
  both('trim',lower.patch(.4,.403,.06,1.2,2,10,.003),lower.patch(.62,.623,.06,1.2,2,10,.003));both('chrome',rbox(.03,.03,.13,.01,1.0,.8,.5));
  mirrorArm(.98,1.0,-.42,.9);add('trim',rbox(1.6,.02,.12,.01,0,.89,-.66));add('trim',rod([-.6,.9,-.58],[.05,.95,-.52],.01,4),rod([.1,.9,-.58],[.75,.95,-.52],.01,4));
  add('chrome',rbox(.3,.04,.1,.02,0,.72,-2.18));
  axle(-1.42,.98,.36,.3,true,'mag');axle(1.38,.98,.38,.4,false,'mag');
  turretZ=.25;deck=1.36;
 }else if(kind===3){ /* ---------------- Pummeler: 8×8 armoured personnel carrier */
  const zs=[-1.62,-.55,.52,1.6],arches=zs.map(z=>({z,y:.45,r:.53}));
  const hullL=new Loft([{z:-2.28,hw:.92,yb:.72,yt:.98,n:9,tw:.85,bw:.92},{z:-2.0,hw:1.12,yb:.62,yt:1.28,n:10,tw:.8},{z:-1.35,hw:1.2,yb:.6,yt:1.56,n:12,tw:.76,bw:.94},{z:1.85,hw:1.2,yb:.6,yt:1.6,n:12,tw:.76,bw:.94},{z:2.28,hw:1.12,yb:.68,yt:1.52,n:10,tw:.78}],arches);
  add('paint',...hullL.shell(72,48));for(const a of arches)well(a.z,a.y,a.r,1.05);
  // Applique armour panels with bolt rows along the sides and glacis.
  for(const side of [-1,1]){add('paint',rbox(.05,.42,3.7,.02,side*1.17,1.05,.1,0,0,side*-.12));const pts:V3[]=[];for(let i=0;i<12;i++){const z=-1.7+i*.32;pts.push([side*1.2,.88,z],[side*1.15,1.24,z]);}bolts(pts,'x',.02);}
  add('paint',rbox(1.7,.04,.7,.02,0,1.18,-2.08,-.95));{const pts:V3[]=[];for(let i=0;i<8;i++)pts.push([-.75+i*.214,1.05,-2.25]);bolts(pts,'z',.02);}
  // Roof: driver hatch with vision blocks, commander hatch, stowage box, antennas.
  add('steel',ycyl(.3,.06,-.42,1.6,-1.1,20),ycyl(.24,.05,-.42,1.65,-1.1,20));add('steel',ycyl(.28,.06,.42,1.62,-.2,20));
  for(const x of [-.6,-.42,-.24])add('glass',rbox(.12,.06,.05,.01,x,1.58,-1.42,-.4));add('steel',rbox(.6,.1,.08,.02,-.42,1.57,-1.45,-.4));
  add('olive',rbox(1.4,.22,.55,.04,0,1.71,1.7));for(let i=0;i<3;i++)add('trim',rbox(1.42,.02,.04,.005,0,1.72,1.5+i*.2));
  both('trim',rod([.95,1.6,1.95],[.95,3.1,2.05],.009,4));both('steel',ycyl(.04,.1,.95,1.65,1.95,8));
  // Smoke-grenade dischargers, headlamp guards, hazard-striped bumper, tow eyes, side stowage, jerry cans.
  for(const side of [-1,1])for(let i=0;i<3;i++){const g=rod([side*.86,1.55+i*.09,-1.62],[side*1.02,1.62+i*.09,-1.86],.045,10);add('steel',g);add('trim',zcyl(.035,.02,side*1.03,1.63+i*.09,-1.87,8));}
  roundLamp(.72,1.06,-2.18,.07);both('steel',rod([.62,1.16,-2.24],[.82,1.16,-2.24],.012,4),rod([.62,.96,-2.24],[.82,.96,-2.24],.012,4));
  add('hazard',rbox(2.0,.14,.1,.02,0,.74,-2.3));for(let i=0;i<9;i++)add('trim',box(.08,.145,.105,-.88+i*.22,.74,-2.3,0,0,.6));
  both('steel',place(new THREE.TorusGeometry(.07,.022,6,14),.55,.72,-2.36));both('olive',rbox(.08,.34,.6,.02,1.21,1.28,1.2));add('olive',rbox(.18,.36,.26,.025,-.7,1.8,2.05),rbox(.18,.36,.26,.025,-.45,1.8,2.05));
  rectLamp(.8,1.26,2.28,.12,.1,1,'tail');add('steel',rbox(1.0,.9,.05,.02,0,1.08,2.27));both('chrome',rbox(.03,.1,.04,.01,.38,1.08,2.3));
  for(const z of zs)axle(z,1.08,.45,.34,z<0,'military');
  turretZ=.25;deck=1.62;
 }else{ /* ---------------- Bigrig: conventional long-nose tractor with a gun bed */
  add('dark',rbox(1.0,.24,4.6,.03,0,.72,.05));for(const z of [-.4,.4,1.2,2.0])add('dark',rbox(1.0,.06,.1,.02,0,.62,z));
  const hood=new Loft([{z:-2.42,hw:.68,yb:.82,yt:1.42,n:7,tw:.92},{z:-2.3,hw:.74,yb:.78,yt:1.52,n:7,tw:.9},{z:-1.6,hw:.78,yb:.8,yt:1.6,n:7,tw:.86},{z:-.98,hw:.8,yb:.82,yt:1.66,n:7,tw:.84}]);
  add('paint',...hood.shell(40,40));
  for(const side of [-1,1]){const f=new Loft([{z:-2.28,hw:.22,yb:.92,yt:1.0,n:3},{z:-1.95,hw:.26,yb:1.0,yt:1.16,n:3},{z:-1.55,hw:.27,yb:1.06,yt:1.2,n:3},{z:-1.15,hw:.26,yb:1.0,yt:1.15,n:3},{z:-.95,hw:.22,yb:.75,yt:.95,n:3}]);for(const g of f.shell(30,20))add('paint',g.translate(side*.98,0,0));add('well',new THREE.CylinderGeometry(.6,.6,.42,20,1,true,-Math.PI/2,Math.PI).rotateZ(Math.PI/2).translate(side*1.02,.52,-1.55));}
  const cab=new Loft([{z:-1.0,hw:1.1,yb:.8,yt:1.66,n:9,tw:.95},{z:-.12,hw:1.1,yb:.8,yt:1.68,n:9,tw:.95}]);add('paint',...cab.shell(8,44));
  const glassL=new Loft([{z:-1.04,hw:1.05,yb:1.64,yt:1.7,n:7,tw:.92},{z:-.92,hw:1.06,yb:1.64,yt:2.28,n:7,tw:.9},{z:-.14,hw:1.06,yb:1.64,yt:2.32,n:7,tw:.9}]);add('glass',glassL.patch(0,1,-.12,Math.PI+.12,16,32));
  add('paint',glassL.patch(.15,1,.6,Math.PI-.6,14,16,.014),glassL.patch(.86,1,-.1,Math.PI+.1,6,30,.012));both('paint',glassL.patch(.1,.22,-.06,.9,4,12,.012),glassL.patch(.55,.6,-.06,.9,4,12,.012));
  add('paint',rbox(2.14,.18,.95,.06,0,2.38,-.56));add('trim',rbox(2.0,.06,.24,.02,0,2.33,-1.08,.25));for(const x of [-.6,-.3,0,.3,.6])add('amber',rbox(.1,.05,.06,.02,x,2.48,-1.0));
  // Chrome grille with vertical bars, bumper, round lamps, emblem, air horns, exhaust stacks, fuel tanks, steps, mirrors.
  add('chrome',rbox(1.24,.66,.06,.03,0,1.14,-2.44));for(let i=0;i<11;i++)add('trim',box(.035,.56,.04,-.5+i*.1,1.14,-2.46));add('chrome',rbox(.28,.07,.03,.02,0,1.52,-2.45));
  add('chrome',rbox(2.3,.24,.2,.06,0,.62,-2.5));add('trim',rbox(.6,.08,.05,.02,0,.62,-2.61));
  for(const side of [-1,1]){add('trim',zcyl(.13,.1,side*.98,1.1,-2.22,18));add('chrome',zcyl(.12,.03,side*.98,1.1,-2.28,18,.08));add('lamp',zcyl(.05,.02,side*.98,1.1,-2.3,12));add('glass',sphere(.115,side*.98,1.1,-2.28,1,1,.3,16,8));}
  both('chrome',zcyl(.04,.4,.5,2.47,-.7,12,.07));
  both('chrome',rod([1.12,.9,-.18],[1.12,3.15,-.18],.08,14),place(new THREE.TorusGeometry(.081,.012,5,16),1.12,2.0,-.18,Math.PI/2));both('dark',ycyl(.07,.04,1.12,3.16,-.18,12));both('steel',rbox(.12,.9,.16,.03,1.12,2.0,-.08));
  for(const side of [-1,1]){add('chrome',xcyl(.3,.9,side*.82,.72,-.55,24).rotateY(Math.PI/2).translate(0,0,0));}
  both('chrome',zcyl(.3,.9,.85,.72,-.5,24));both('steel',rbox(.06,.66,.06,.01,.85,.72,-.85),rbox(.06,.66,.06,.01,.85,.72,-.2));
  both('steel',rbox(.36,.04,.24,.01,1.0,.55,-.88));mirrorArm(1.12,1.95,-1.0,1.6);both('steel',rod([1.12,1.6,-1.0],[1.24,2.1,-1.0],.016,6));
  both('trim',glassL.patch(0,1,-.07,.03,16,2,.016));
  // Gun bed: steel deck with tread plate, side rails with hazard edges, tail lamps, mud flaps.
  add('steel',rbox(2.4,.14,2.36,.03,0,1.0,1.22));both('hazard',rbox(.06,.1,2.36,.02,1.2,1.04,1.22));both('steel',rbox(.06,.3,2.36,.02,1.17,1.22,1.22));
  for(let i=0;i<10;i++)for(let j=0;j<4;j++)add('steel',rbox(.14,.012,.04,.006,-.75+j*.5+(i%2)*.25,1.075,.25+i*.2,0,.6));
  rectLamp(.95,.84,2.42,.24,.1,1,'tail');both('dark',rbox(.5,.46,.02,.01,.95,.42,2.4));
  axle(-1.55,1.02,.52,.36,true,'truck');
  for(const z of [.85,1.95]){wheels.push({x:.88,z,radius:.52,width:.3,steer:false,style:'truck'},{x:-.88,z,radius:.52,width:.3,steer:false,style:'truck'},{x:1.2,z,radius:.52,width:.3,steer:false,style:'truck'},{x:-1.2,z,radius:.52,width:.3,steer:false,style:'truck'});add('dark',rod([-1.1,.52,z],[1.1,.52,z],.07,8));both('paint',flare(1.04,.52,z,.6,.42,.06,.25,Math.PI-.25));}
  turretZ=1.25;deck=1.08;
 }

 /* ---------------- weapon mount: ring, pedestal up to firing height, then the gun pointing at −Z */
 const h=gunHeight;gun('steel',ycyl(.36,.08,0,deck+.04,0,28,.4),ycyl(.28,.08,0,deck+.12,0,24));{const pts:V3[]=[];for(let k=0;k<10;k++){const t=k/10*Math.PI*2;pts.push([Math.cos(t)*.36,deck+.09,Math.sin(t)*.36]);}for(const [x,y,z] of pts)gun('chrome',ycyl(.018,.03,x,y,z,6));}if(h-deck>.4)gun('dark',ycyl(.13,h-deck-.25,0,(deck+h-.15)/2+.04,0,12,.17));
 if(kind===0){ // twin machine guns with perforated jackets and belt feed
  gun('steel',rbox(.42,.24,.62,.04,0,h,.04));gun('trim',rbox(.48,.06,.66,.02,0,h+.15,.04));
  for(const x of [-.12,.12]){gun('trim',zcyl(.05,.5,x,h+.02,-.48,12));for(let i=0;i<5;i++)gun('dark',zcyl(.054,.03,x,h+.02,-.3-i*.08,12));gun('steel',zcyl(.022,.42,x,h+.02,-.92,8),zcyl(.04,.08,x,h+.02,-1.14,10,.032));}
  gun('olive',rbox(.2,.2,.28,.02,.36,h-.04,.12));gun('brass',tube([[.28,h+.02,.1],[.2,h+.06,.02],[.14,h+.03,-.04]],.02,6));gun('steel',rbox(.6,.34,.04,.02,0,h+.05,-.24));
 }else if(kind===1){ // auto-shotgun with drum, muzzle brake and gun shield
  gun('steel',rbox(.5,.3,.78,.05,0,h,.08));gun('trim',ycyl(.18,.14,0,h-.18,.0,20).rotateZ(0));gun('dark',zcyl(.1,.75,0,h+.03,-.6,16));gun('steel',rbox(.24,.2,.22,.04,0,h+.03,-1.0),zcyl(.06,.4,0,h-.1,-.5,10));
  for(const x of [-.07,.07])gun('trim',box(.02,.12,.12,x,h+.03,-1.0));
  gun('paint',rbox(.86,.48,.05,.02,0,h+.06,-.32));gun('glass',rbox(.2,.08,.02,.01,0,h+.2,-.35));
 }else if(kind===2){ // pulse cannon
  gun('steel',rbox(.42,.28,.66,.06,0,h,.1));gun('chrome',zcyl(.06,1.3,0,h,-.68,14));
  for(let i=0;i<4;i++)gun('glow',place(new THREE.TorusGeometry(.13,.03,8,22),0,h,-.4-i*.24));
  gun('trim',zcyl(.1,.12,0,h,-1.34,14));gun('glow',zcyl(.07,.02,0,h,-1.41,12));gun('paint',rbox(.5,.08,.7,.03,0,h+.18,.1));
 }else if(kind===3){ // six-tube rocket pod
  gun('paint',rbox(1.06,.6,1.1,.05,0,h,.2));gun('trim',rbox(1.08,.02,1.12,.01,0,h+.12,.2));gun('trim',rbox(1.12,.66,.08,.03,0,h,-.36));for(const x of [-.55,.55])for(const y of [-.27,.27])gun('trim',rbox(.05,.06,1.16,.02,x,h+y,.18));gun('hazard',rbox(.9,.04,.05,.01,0,h+.33,-.38));
  for(const x of [-.32,0,.32])for(const y of [-.14,.14]){gun('steel',zcyl(.125,.06,x,h+y,-.42,16));gun('dark',zcyl(.1,.05,x,h+y,-.44,16));gun('hazard',zcyl(.075,.16,x,h+y,-.42,12,.012));}
  gun('steel',rbox(.3,.3,.4,.04,.62,h-.08,.3));gun('glass',rbox(.02,.1,.18,.01,.78,h-.02,.24));
 }else{ // howitzer with muzzle brake, recoil cylinders and shield
  gun('steel',rbox(.86,.6,1.36,.06,0,h,.18));gun('dark',zcyl(.13,1.95,0,h+.02,-1.4,16,.1));gun('steel',zcyl(.2,.42,0,h+.02,-.62,16));
  gun('steel',rbox(.32,.22,.36,.04,0,h+.02,-2.38));for(const x of [-.09,.09])gun('trim',box(.04,.18,.2,x*1.9,h+.02,-2.38));
  for(const x of [-.17,.17])gun('chrome',zcyl(.045,.7,x,h-.12,-.75,10));
  gun('paint',rbox(1.4,.6,.06,.03,0,h+.05,-.5));gun('hazard',rbox(1.4,.06,.07,.01,0,h+.32,-.5));
 }
 const emit=(parts:Partial<Record<Bucket,THREE.BufferGeometry[]>>,parent:THREE.Group)=>{for(const key of Object.keys(parts) as Bucket[]){const geo=merge(parts[key]!);const mesh=new THREE.Mesh(geo,materials[key]);mesh.castShadow=key!=='glass'&&key!=='lamp'&&key!=='tail'&&key!=='amber';mesh.receiveShadow=true;mesh.name=key;parent.add(mesh);parts[key]!.forEach(g=>{if(!g.userData.shared)g.dispose();});}};
 emit(hull,body);turret.position.z=turretZ;emit(gunParts,turret);body.add(turret);
 root.userData.wheels=wheels.map(w=>{
  const parts=wheelParts(w.radius,w.width,w.style),holder=new THREE.Group(),spin=new THREE.Group();
  const tyre=new THREE.Mesh(parts.tyre,materials.rubber),rim=new THREE.Mesh(parts.rim,w.style==='mag'||w.style==='truck'?materials.chrome:w.style==='military'?materials.paint:materials.steel),rimDark=new THREE.Mesh(parts.rimDark,materials.trim);
  tyre.castShadow=rim.castShadow=true;tyre.receiveShadow=true;spin.add(tyre,rim,rimDark);spin.name='spin';holder.add(spin);
  const disc=new THREE.Mesh(parts.brake,materials.steel);disc.position.x=-Math.sign(w.x)*w.width*.05;holder.add(disc);
  const caliper=new THREE.Mesh(rbox(w.width*.3,w.radius*.32,w.radius*.22,.02),kind===0||kind===2?materials.hazard:materials.trim);caliper.position.set(Math.sign(w.x)*w.width*.08,w.radius*.32,w.radius*.25);caliper.rotation.x=.6;holder.add(caliper);
  holder.position.set(w.x,w.radius,w.z);root.add(holder);return {mesh:holder,steer:w.steer,radius:w.radius};
 });
 root.userData.materials=Object.values(materials);root.userData.turretZ=turretZ;root.userData.turret=turret;root.userData.paint=materials.paint as THREE.MeshPhysicalMaterial;root.userData.body=body;
 return root;
}
/** Visual-only wheel spin, steering lock, body roll and pitch. `distance` is metres travelled this frame (signed). */
export function animateVehicle(visual:THREE.Object3D,distance:number,steer:number,roll:number,pitch:number){const data=visual.userData;if(!data?.wheels)return;for(const w of data.wheels as {mesh:THREE.Group;steer:boolean;radius:number}[]){w.mesh.children[0].rotation.x-=distance/w.radius;if(w.steer)w.mesh.rotation.y=steer;}const body=data.body as THREE.Group;body.rotation.z=roll;body.rotation.x=pitch;}

/* ------------------------------------------------------------------ live condition: battle damage, arena dust, headlights */

type WearUniforms={uBattle:{value:number};uDust:{value:THREE.Color}};
const wearOf=(visual:THREE.Object3D)=>((visual.userData.materials??[]) as THREE.Material[]).map(m=>m.userData.wear as WearUniforms|undefined).filter((w):w is WearUniforms=>!!w);
/** 0 = factory fresh, 1 = nearly wrecked: soot, bare-metal gouges and dented normals on every weathered surface. */
export function setVehicleCondition(visual:THREE.Object3D,battle:number){const w=wearOf(visual)[0];if(w)w.uBattle.value=THREE.MathUtils.clamp(battle,0,1);}
/** Tints the road dust caked on the lower body to the arena's ground (sand, slag, snow, ash). */
export function setVehicleDust(visual:THREE.Object3D,color:number){for(const w of wearOf(visual))w.uDust.value.setHex(color);}

let beamTexture:THREE.DataTexture|null=null;
/** Soft radial pool used for the ground spot of a headlight and the cone's falloff. */
function beamPool(){if(beamTexture)return beamTexture;const n=64,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.min(1,Math.hypot(u*1.25,v));const a=Math.pow(1-r,1.6),i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=a*255;}beamTexture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);beamTexture.magFilter=beamTexture.minFilter=THREE.LinearFilter;beamTexture.needsUpdate=true;return beamTexture;}
const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uColor:{value:new THREE.Color(0xffe6b8)},uStrength:{value:.15}},
 vertexShader:'varying float vAlong;varying vec3 vN;varying vec3 vV;void main(){vAlong=uv.y;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 uColor;uniform float uStrength;varying float vAlong;varying vec3 vN;varying vec3 vV;void main(){float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.4);float a=uStrength*pow(vAlong,2.4)*edge*edge;gl_FragColor=vec4(uColor*a,1.);}'});
const poolMaterial=new THREE.MeshBasicMaterial({color:0xffdcaa,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
/**
 * Fake headlight beams for the night arena: two additive volumetric cones out of the front lamps and a light
 * pool on the ground ahead. Costs four transparent draws per car instead of real spot lights on every surface.
 */
export function addHeadlights(visual:THREE.Object3D){
 const body=visual.userData.body as THREE.Object3D|undefined;if(!body||visual.getObjectByName('headlights'))return visual.getObjectByName('headlights')!;
 const box=new THREE.Box3().setFromObject(body),size=box.getSize(new THREE.Vector3()),group=new THREE.Group();group.name='headlights';
 const front=box.min.z+.1,y=Math.min(box.min.y+size.y*.42,1.1);
 for(const side of [-1,1]){const length=7.5,cone=new THREE.ConeGeometry(1.5,length,18,1,true);cone.translate(0,-length/2,0);cone.rotateX(Math.PI/2-.13);const mesh=new THREE.Mesh(cone,beamMaterial);mesh.position.set(side*size.x*.32,y,front);mesh.renderOrder=9;mesh.name='beam';group.add(mesh);}
 const pool=new THREE.Mesh(new THREE.PlaneGeometry(5.5,8).rotateX(-Math.PI/2),poolMaterial.clone());(pool.material as THREE.MeshBasicMaterial).map=beamPool();pool.position.set(0,.06,front-5.2);pool.renderOrder=4;pool.name='pool';group.add(pool);
 visual.add(group);return group;
}
