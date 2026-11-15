// Liquids of the terrain library: lakes, rivers, molten channels, frozen ponds and waterfalls.
// One mesh per liquid type covers every pool of the layout; animation runs on the shared clock.
import * as THREE from 'three';
import {fluidSurface,mapLayout,type Fluid,type Waterfall,ARENA} from './terrain';
import {environmentUniforms,tileNoise,layer,landHeight} from './environment';

const cache=new Map<string,THREE.Texture>();
/** Tileable ripple normals (R,G) with a foam/height mask in B. */
function rippleTexture(){if(cache.has('ripple'))return cache.get('ripple')!;const size=128,h=new Float32Array(size*size),data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)h[y*size+x]=tileNoise(x/size,y/size,4,4,612)*.7+tileNoise(x/size,y/size,12,3,77)*.3;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(a:number,b:number)=>h[((b+size)%size)*size+(a+size)%size],dx=(at(x+1,y)-at(x-1,y))*6,dy=(at(x,y+1)-at(x,y-1))*6,l=1/Math.hypot(dx,dy,1),i=(y*size+x)*4;data[i]=(-dx*l*.5+.5)*255;data[i+1]=(-dy*l*.5+.5)*255;data[i+2]=(l*.5+.5)*255;data[i+3]=h[y*size+x]*255;}
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;cache.set('ripple',t);return t;}
/** Vertical streaks for falling water. */
function streakTexture(){if(cache.has('streak'))return cache.get('streak')!;const w=64,hgt=128,data=new Uint8Array(w*hgt*4);
 for(let y=0;y<hgt;y++)for(let x=0;x<w;x++){const u=x/w,v=y/hgt,streak=tileNoise(u,v*.12,16,3,321),foam=tileNoise(u,v,6,4,99),a=Math.min(1,Math.max(0,(streak-.32)*2.4)*.75+foam*.35),i=(y*w+x)*4;// alphaMap reads the green channel
 data[i]=data[i+1]=data[i+2]=a*255;data[i+3]=255;}
 const t=new THREE.DataTexture(data,w,hgt,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;cache.set('streak',t);return t;}
/** Radial foam mask in the green channel (for alphaMap). */
function foamTexture(){if(cache.has('foam'))return cache.get('foam')!;const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-31.5,y-31.5)/31.5,n=tileNoise(x/size,y/size,6,4,41),a=Math.max(0,1-r)**1.2*Math.min(1,Math.max(0,(n-.3)*2.2)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=a*255;data[i+3]=255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;cache.set('foam',t);return t;}
function softSprite(){if(cache.has('soft'))return cache.get('soft')!;const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-31.5,y-31.5)/31.5,n=tileNoise(x/size,y/size,4,3,5),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.max(0,1-r)**1.5*(.6+.4*n)*255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;cache.set('soft',t);return t;}

type Look={shallow:number;deep:number;opacity:number;rough:number;glow:number;glowColor:number;flow:number};
const looks:Record<Fluid,Look>={
 water:{shallow:0x5fa8a0,deep:0x0f3b4c,opacity:.86,rough:.05,glow:0,glowColor:0,flow:1},
 toxic:{shallow:0x7f9a3a,deep:0x1f3317,opacity:.92,rough:.12,glow:.25,glowColor:0x9cff3a,flow:.6},
 ice:{shallow:0xcfe6f2,deep:0x7fb3cf,opacity:.97,rough:.16,glow:0,glowColor:0,flow:0},
 lava:{shallow:0x2a120a,deep:0x120806,opacity:1,rough:.85,glow:3.4,glowColor:0xff5a14,flow:.25},
 molten:{shallow:0x3a1e0c,deep:0x1a0d06,opacity:1,rough:.6,glow:4,glowColor:0xffa030,flow:.35},
};
function fluidMaterial(fluid:Fluid){const look=looks[fluid],hot=fluid==='lava'||fluid==='molten',ice=fluid==='ice';
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:look.rough,metalness:0,transparent:!hot&&!ice,opacity:1,envMapIntensity:ice?.8:1.4});
 if(ice){const l=layer('ice');material.map=l.albedo;material.normalMap=l.normal;material.normalScale.set(.5,.5);}else material.normalMap=rippleTexture();
 if(hot){const crust=layer('lavacrust');material.map=crust.albedo;material.emissive=new THREE.Color(look.glowColor);material.emissiveMap=crust.albedo;}
 const uniforms={uTime:environmentUniforms.uTime,uShallow:{value:new THREE.Color(look.shallow)},uDeep:{value:new THREE.Color(look.deep)},uOpacity:{value:look.opacity},uFlow:{value:look.flow},uGlow:{value:look.glow},uGlowColor:{value:new THREE.Color(look.glowColor)}};
 material.customProgramCacheKey=()=>'arena-fluid-'+fluid;
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float depth;varying float vDepth;varying vec2 vFluidXZ;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=depth;vFluidXZ=(modelMatrix*vec4(position,1.)).xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime,uOpacity,uFlow,uGlow;uniform vec3 uShallow,uDeep,uGlowColor;varying float vDepth;varying vec2 vFluidXZ;')
   .replace('#include <map_fragment>',hot?`
 vec2 flowUv=vFluidXZ*.09+vec2(uTime*.012,uTime*.007)*uFlow;
 vec4 crustA=texture2D(map,flowUv),crustB=texture2D(map,vFluidXZ*.05-vec2(uTime*.006,-uTime*.01)*uFlow);
 vec4 crust=mix(crustA,crustB,.45);
 float heat=smoothstep(.3,.75,crustA.r-crustA.b*1.5)*.8+smoothstep(.3,.75,crustB.r-crustB.b*1.5)*.5;
 diffuseColor.rgb=mix(uDeep,crust.rgb*.6,.6);`:ice?`
 vec4 iceTex=texture2D(map,vFluidXZ*.11);
 diffuseColor.rgb=mix(uDeep,uShallow,iceTex.r)*mix(.82,1.,smoothstep(0.,.15,vDepth+.1));`:`
 float d=clamp(vDepth,0.,3.);
 float foamMask=texture2D(normalMap,vFluidXZ*.21+vec2(uTime*.03,0.)).a;
 float shore=1.-smoothstep(.02,.32,d);
 vec3 water=mix(uShallow,uDeep,smoothstep(.1,1.8,d));
 water=mix(water,vec3(.92,.95,.93),shore*smoothstep(.45,.7,foamMask)*.85);
 diffuseColor.rgb=water;
 diffuseColor.a=uOpacity*smoothstep(-.02,.22,d)*mix(.55,1.,smoothstep(0.,1.2,d))+shore*.25;`)
   .replace('#include <normal_fragment_maps>',ice?'#include <normal_fragment_maps>':`
 vec3 n1=texture2D(normalMap,vFluidXZ*.07+vec2(uTime*.021,uTime*.013)*uFlow).xyz*2.-1.;
 vec3 n2=texture2D(normalMap,vFluidXZ*.13-vec2(uTime*.017,-uTime*.024)*uFlow).xyz*2.-1.;
 vec3 tn=normalize(vec3((n1.xy+n2.xy)*${hot?'.35':'.55'},1.));
 normal=normalize((viewMatrix*vec4(tn.x,tn.z,-tn.y,0.)).xyz);`)
   .replace('#include <emissivemap_fragment>',hot?`
 float pulse=.75+.25*sin(uTime*1.7+vFluidXZ.x*.3+vFluidXZ.y*.23);
 totalEmissiveRadiance=uGlowColor*uGlow*(heat+.025)*pulse;`:'#include <emissivemap_fragment>');
 };
 return material;}

/** One flat surface mesh per liquid type, clipped to where that liquid exists. */
function fluidMeshes(group:THREE.Group){const style=mapLayout().style;const min=-ARENA-26,max=ARENA+26,step=1,n=Math.round((max-min)/step)+1;const level=new Float32Array(n*n).fill(NaN),kind:(Fluid|null)[]=new Array(n*n).fill(null),depth=new Float32Array(n*n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=min+i*step,z=min+j*step,f=fluidSurface(x,z);if(!f)continue;const ground=landHeight(x,z,style);if(f.level<ground-.02)continue;const k=j*n+i;level[k]=f.level;kind[k]=f.fluid;depth[k]=f.level-ground;}
 const byFluid=new Map<Fluid,{positions:number[];depths:number[];indices:number[];map:Map<number,number>}>();
 const vertex=(f:Fluid,i:number,j:number,ref:number)=>{let b=byFluid.get(f);if(!b){b={positions:[],depths:[],indices:[],map:new Map()};byFluid.set(f,b);}const k=j*n+i;let v=b.map.get(k);if(v===undefined){const x=min+i*step,z=min+j*step,own=kind[k]===f;v=b.positions.length/3;b.positions.push(x,own?level[k]:ref,z);b.depths.push(own?depth[k]:-.3);b.map.set(k,v);}return v;};
 for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const ks=[j*n+i,j*n+i+1,(j+1)*n+i,(j+1)*n+i+1],own=ks.find(k=>kind[k]);if(own===undefined)continue;const f=kind[own]!,ref=level[own];
  const [a,b,c,d]=[vertex(f,i,j,ref),vertex(f,i+1,j,ref),vertex(f,i,j+1,ref),vertex(f,i+1,j+1,ref)];byFluid.get(f)!.indices.push(a,c,b,b,c,d);}
 byFluid.forEach((b,f)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('depth',new THREE.Float32BufferAttribute(b.depths,1));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.positions.map((_,i)=>i%3===1?1:0),3));
  const uv=new Float32Array(b.positions.length/3*2);for(let i=0;i<uv.length/2;i++){uv[i*2]=b.positions[i*3]*.1;uv[i*2+1]=b.positions[i*3+2]*.1;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(b.indices);
  const mesh=new THREE.Mesh(g,fluidMaterial(f));mesh.name='fluid-'+f;mesh.receiveShadow=true;mesh.renderOrder=f==='water'||f==='toxic'?1:0;group.add(mesh);});
}

function waterfallMesh(w:Waterfall,group:THREE.Group){const hot=w.fluid==='lava'||w.fluid==='molten',rows=26,cols=8,positions:number[]=[],uvs:number[]=[],indices:number[]=[],drop=w.top-w.bottom,reach=1.2+drop*.32,side={x:-w.dz,z:w.dx};
 for(let r=0;r<=rows;r++){const s=r/rows,out=reach*Math.pow(s,.55)+.15,y=w.top+.05-drop*Math.pow(s,1.35),width=w.width*(1+.25*s);for(let c=0;c<=cols;c++){const t=c/cols-.5,wave=Math.sin(c*1.7+r*.6)*.12*s;positions.push(w.x+w.dx*(out+wave)+side.x*t*width,y,w.z+w.dz*(out+wave)+side.z*t*width);uvs.push(t*width*.35+.5,s*drop*.18);if(r&&c){const k=r*(cols+1)+c;indices.push(k-cols-2,k-cols-1,k-1,k-cols-1,k,k-1);}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
 const streak=streakTexture().clone();streak.needsUpdate=true;streak.repeat.set(1,1);
 const material=hot?new THREE.MeshBasicMaterial({color:new THREE.Color(w.fluid==='lava'?0xff6a1c:0xffb040).multiplyScalar(2.6),alphaMap:streak,transparent:true,depthWrite:false,side:THREE.DoubleSide})
  :new THREE.MeshStandardMaterial({color:0xe8f4f6,roughness:.25,metalness:0,alphaMap:streak,transparent:true,depthWrite:false,side:THREE.DoubleSide,emissive:new THREE.Color(0x6d8c96),emissiveIntensity:.35});
 const sheet=new THREE.Mesh(g,material);sheet.name='waterfall';sheet.renderOrder=3;sheet.onBeforeRender=()=>{streak.offset.y=environmentUniforms.uTime.value*(hot?.35:1.25);};group.add(sheet);
 // Back sheet: darker, slower, gives the fall body and thickness.
 const back=new THREE.Mesh(g,hot?new THREE.MeshBasicMaterial({color:new THREE.Color(0xff3a08).multiplyScalar(1.6),alphaMap:streak,transparent:true,depthWrite:false,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:0x7aa7b5,roughness:.3,alphaMap:streak,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
 back.position.set(-w.dx*.25,0,-w.dz*.25);back.scale.set(1,1,1);back.renderOrder=2;group.add(back);
 // Foam and mist where the fall meets the pool.
 const fx=w.x+w.dx*(reach+.15),fz=w.z+w.dz*(reach+.15),sprite=softSprite(),mist:THREE.Sprite[]=[];
 for(let i=0;i<7;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:sprite,color:hot?new THREE.Color(1.6,.55,.18):new THREE.Color(.92,.96,1),transparent:true,depthWrite:false,opacity:hot?.35:.55,blending:hot?THREE.AdditiveBlending:THREE.NormalBlending}));m.renderOrder=4;group.add(m);mist.push(m);}
 const foam=new THREE.Mesh(new THREE.CircleGeometry(w.width*1.1,28),new THREE.MeshBasicMaterial({color:hot?new THREE.Color(2.2,.9,.25):new THREE.Color(.95,.98,1),alphaMap:foamTexture(),transparent:true,depthWrite:false,opacity:hot?.7:.85}));foam.rotation.x=-Math.PI/2;foam.position.set(fx,w.bottom+.04,fz);foam.renderOrder=3;
 foam.onBeforeRender=()=>{const t=environmentUniforms.uTime.value;foam.rotation.z=t*.2;mist.forEach((m,i)=>{const phase=(t*(.35+i*.05)+i/7)%1,a=i*2.4;m.position.set(fx+Math.cos(a)*w.width*.45*phase,w.bottom+.4+phase*(hot?3.5:2.6),fz+Math.sin(a)*w.width*.45*phase);m.scale.setScalar((hot?2.2:2.6)+phase*3.2);(m.material as THREE.SpriteMaterial).opacity=(hot?.32:.5)*Math.sin(phase*Math.PI);});};
 group.add(foam);
}
/** Adds every liquid surface and waterfall of the active layout. */
export function buildFluids(group:THREE.Group){fluidMeshes(group);for(const w of mapLayout().waterfalls)waterfallMesh(w,group);}
