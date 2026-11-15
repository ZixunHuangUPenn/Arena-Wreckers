// Procedural environment: every surface texture, rock, plant and light pool in the arenas is
// generated here at load time. Nothing in this file needs WebGL or the DOM, so the test suite
// can build all three arenas headlessly.
import * as THREE from 'three';
import {terrainHeight,bridgeCenterZ} from './terrain';

export type ArenaLook={
 name:string;
 sun:{color:number;intensity:number;dir:[number,number,number]};
 hemi:{sky:number;ground:number;intensity:number};
 sky:{zenith:number;horizon:number;ground:number};
 haze:number;exposure:number;envIntensity:number;bloom:number;cloud:number;
 grade:{tint:[number,number,number];saturation:number;contrast:number;vignette:number};
};
export const arenaLooks:ArenaLook[]=[
 {name:'sandstone',sun:{color:0xffd6a8,intensity:3.3,dir:[-.66,.5,.42]},hemi:{sky:0x9ab8ea,ground:0x80573a,intensity:.6},sky:{zenith:0x3d6db8,horizon:0xf3c996,ground:0x7a5a3c},haze:0xcfa67c,exposure:1.02,envIntensity:.6,bloom:.28,cloud:.34,grade:{tint:[1.04,1,.94],saturation:1.02,contrast:1.06,vignette:.3}},
 {name:'foundry',sun:{color:0xcdd8ff,intensity:2.4,dir:[-.5,.62,.5]},hemi:{sky:0x8094bd,ground:0x4a3d34,intensity:1.2},sky:{zenith:0x0b1226,horizon:0x4a3a4a,ground:0x16130f},haze:0x191c26,exposure:1.5,envIntensity:.8,bloom:.5,cloud:0,grade:{tint:[.97,1,1.06],saturation:1.08,contrast:1.1,vignette:.42}},
 {name:'frostline',sun:{color:0xfff0dc,intensity:3.2,dir:[-.58,.46,.5]},hemi:{sky:0x8db6ff,ground:0x9aa9bd,intensity:.85},sky:{zenith:0x3f7fd1,horizon:0xdfeeff,ground:0xa9b9cc},haze:0xc4d6e6,exposure:.92,envIntensity:.7,bloom:.22,cloud:.28,grade:{tint:[.97,1,1.05],saturation:1.04,contrast:1.05,vignette:.26}},
];

// Shared animation clock for wind sway and drifting cloud shadows.
export const environmentUniforms={uTime:{value:0}};

// ---------------------------------------------------------------- noise
const smooth=(v:number)=>{v=v<0?0:v>1?1:v;return v*v*(3-2*v);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function hash(ix:number,iy:number,seed:number){let h=Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(seed+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const wrap=(n:number,p:number)=>p?((n%p)+p)%p:n;
/** Value noise; `period` (in lattice cells) makes it tile, 0 leaves it unbounded. */
function vnoise(x:number,y:number,period:number,seed:number){const xf=Math.floor(x),yf=Math.floor(y),fx=x-xf,fy=y-yf,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);let x0=xf|0,y0=yf|0,x1=x0+1,y1=y0+1;if(period){x0%=period;if(x0<0)x0+=period;y0%=period;if(y0<0)y0+=period;x1=x0+1===period?0:x0+1;y1=y0+1===period?0:y0+1;}const a=hash(x0,y0,seed),b=hash(x1,y0,seed),c=hash(x0,y1,seed),d=hash(x1,y1,seed);return lerp(lerp(a,b,sx),lerp(c,d,sx),sy);}
function fbm(u:number,v:number,period:number,octaves:number,seed:number){let sum=0,amp=.5,total=0,p=period;for(let o=0;o<octaves;o++){sum+=amp*vnoise(u*p,v*p,p,seed+o*17);total+=amp;amp*=.5;p*=2;}return sum/total;}
/** Tileable cellular noise: distances to the nearest and second-nearest feature points. */
function worley(u:number,v:number,period:number,seed:number):[number,number]{const x=u*period,y=v*period,x0=Math.floor(x),y0=Math.floor(y);let f1=9,f2=9;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=x0+i,cy=y0+j,wx=wrap(cx,period),wy=wrap(cy,period),px=cx+hash(wx,wy,seed),py=cy+hash(wx,wy,seed+91),d=Math.hypot(px-x,py-y);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}return [f1,f2];}
/** Unbounded world-space noise in metres. */
export const worldNoise=(x:number,z:number,scale:number,octaves=4,seed=7)=>fbm(x*scale,z*scale,0,octaves,seed);
function noise3(x:number,y:number,z:number,seed:number){const z0=Math.floor(z),fz=z-z0,sz=fz*fz*(3-2*fz);return lerp(vnoise(x+z0*37.3,y+z0*17.9,0,seed),vnoise(x+(z0+1)*37.3,y+(z0+1)*17.9,0,seed),sz);}
function seeded(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

// ---------------------------------------------------------------- textures
type Layer={albedo:THREE.DataTexture;normal:THREE.DataTexture;roughness:number;metres:number;warp:number};
type RGB=[number,number,number];
const rgb=(hex:number):RGB=>[(hex>>16)&255,(hex>>8)&255,hex&255];
const mix3=(a:RGB,b:RGB,t:number):RGB=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const ramp=(colors:RGB[],t:number):RGB=>{t=Math.max(0,Math.min(.9999,t))*(colors.length-1);const i=Math.floor(t);return mix3(colors[i],colors[i+1],t-i);};
function finishTexture(texture:THREE.DataTexture,color:boolean){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;if(color)texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;}
/** Bakes a tileable height function into an albedo (alpha = height, used for height blending) and a normal map. */
function bakeLayer(size:number,height:(u:number,v:number)=>number,color:(h:number,u:number,v:number)=>RGB,bump:number,roughness:number,metres:number,warp:number):Layer{
 const heights=new Float32Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++)heights[y*size+x]=Math.max(0,Math.min(1,height(x/size,y/size)));
 const albedo=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),at=(x:number,y:number)=>heights[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,h=heights[y*size+x],c=color(h,x/size,y/size),cavity=.72+.28*h;albedo[i]=c[0]*cavity;albedo[i+1]=c[1]*cavity;albedo[i+2]=c[2]*cavity;albedo[i+3]=h*255;
  const dx=(at(x+1,y)-at(x-1,y))*bump,dy=(at(x,y+1)-at(x,y-1))*bump,l=1/Math.hypot(dx,dy,1);normal[i]=(-dx*l*.5+.5)*255;normal[i+1]=(-dy*l*.5+.5)*255;normal[i+2]=(l*.5+.5)*255;normal[i+3]=255;}
 return {albedo:finishTexture(new THREE.DataTexture(albedo,size,size,THREE.RGBAFormat),true),normal:finishTexture(new THREE.DataTexture(normal,size,size,THREE.RGBAFormat),false),roughness,metres,warp};
}
const TAU=Math.PI*2;
const recipes:Record<string,(size:number)=>Layer>={
 sand:size=>bakeLayer(size,(u,v)=>{const w=fbm(u,v,3,4,11),ripple=.5+.5*Math.sin(TAU*(v*9+u*2+w*2.8)),dune=fbm(u,v,2,3,5);return .24+.3*Math.pow(ripple,1.4)*(.3+.7*dune)+.34*fbm(u,v,10,3,29)+.12*vnoise(u*96,v*96,96,3);},(h,u,v)=>ramp([rgb(0x8f7150),rgb(0xb5946a),rgb(0xcfb288),rgb(0xe2cca4)],h*.7+.3*fbm(u,v,5,3,77)),3,.94,10,.5),
 drytrack:size=>bakeLayer(size,(u,v)=>{const [f1,f2]=worley(u,v,9,21),plate=smooth((f2-f1)/.09),[p1]=worley(u,v,34,5);return plate*(.5+.3*fbm(u,v,12,3,8))+.14*(1-Math.min(1,p1*1.6))+.06*vnoise(u*128,v*128,128,2);},(h,u,v)=>ramp([rgb(0x4d3c2c),rgb(0x7f6548),rgb(0xa08462),rgb(0xb89c7a)],h*.8+.2*fbm(u,v,4,3,31)),7,.9,6,.25),
 sandstone:size=>bakeLayer(size,(u,v)=>{const n=fbm(u,v,3,6,41),ridged=1-Math.abs(2*n-1),strata=.5+.5*Math.sin(TAU*(v*7+n*1.6));const [f1,f2]=worley(u,v,5,71);return .5*ridged+.25*strata+.15*fbm(u,v,16,3,6)+.1*smooth((f2-f1)/.05);},(h,u,v)=>{const band=.5+.5*Math.sin(TAU*(v*7+fbm(u,v,3,6,41)*1.6));return mix3(ramp([rgb(0x60483a),rgb(0x93705a),rgb(0xb38e6c),rgb(0xceac88)],h),rgb(0xa0604a),band*.28);},8,.86,9,.2),
 concrete:size=>bakeLayer(size,(u,v)=>{const gx=Math.abs(((u*2)%1)-.5),gy=Math.abs(((v*2)%1)-.5),seam=Math.min(.5-gx,.5-gy),[p1]=worley(u,v,44,13),[c1,c2]=worley(u,v,4,57);return .72+.2*(fbm(u,v,14,4,9)-.5)-(p1<.1?.3*(1-p1/.1):0)-(seam<.012?.45:0)-(c2-c1<.012?.3:0);},(h,u,v)=>{const stain=fbm(u,v,3,5,23),oil=smooth((fbm(u,v,5,4,88)-.62)/.12);return mix3(ramp([rgb(0x3a3d40),rgb(0x6d7072),rgb(0x8d8f8c),rgb(0xa5a59e)],h*.55+stain*.45),rgb(0x23211f),oil*.6);},6,.82,8,0),
 asphalt:size=>bakeLayer(size,(u,v)=>{const [a1]=worley(u,v,56,3),[c1,c2]=worley(u,v,3,19);return .35+.4*Math.min(1,a1*1.5)+.15*vnoise(u*128,v*128,128,9)-(c2-c1<.014?.3:0)+.1*fbm(u,v,6,3,4);},(h,u,v)=>ramp([rgb(0x17181a),rgb(0x2c2e31),rgb(0x45474a),rgb(0x66686a)],h*.7+.3*fbm(u,v,4,4,52)),5,.68,5,0),
 rustplate:size=>bakeLayer(size,(u,v)=>{const cell=(a:number,b:number)=>{const x=((a*14)%1)-.5,y=((b*14)%1)-.5;return Math.max(0,1-Math.hypot(x*1.2+y*1.2,(x-y)*3.4)*3.2);},tread=Math.max(cell(u,v),cell(v+.5/14,1-u+.5/14)),panel=Math.min(Math.abs(((u*2)%1)-.5),Math.abs(((v*2)%1)-.5))>.488?-.4:0,rust=smooth((fbm(u,v,4,5,61)-.46)/.14);return .4+.35*smooth(tread*1.6)+panel+rust*.18*fbm(u,v,24,2,7);},(h,u,v)=>{const rust=smooth((fbm(u,v,4,5,61)-.46)/.14);return mix3(ramp([rgb(0x2c3237),rgb(0x4f585e),rgb(0x717b80)],h),ramp([rgb(0x4a2613),rgb(0x8a4a22),rgb(0xb5703a)],fbm(u,v,18,3,90)),rust*.85);},6,.55,4,0),
 snow:size=>bakeLayer(size,(u,v)=>.25+.45*fbm(u,v,3,5,15)+.22*fbm(u,v,11,3,37)+.08*vnoise(u*128,v*128,128,6),(h,u,v)=>ramp([rgb(0xa9c3de),rgb(0xd4e3f2),rgb(0xf4f8fc),rgb(0xffffff)],h*.8+.2*fbm(u,v,6,3,44)),3.5,.72,9,.5),
 ice:size=>bakeLayer(size,(u,v)=>{const [f1,f2]=worley(u,v,5,27),[g1,g2]=worley(u,v,13,63);return .25+.5*smooth((f2-f1)/.04)*smooth((g2-g1)/.03)+.2*fbm(u,v,6,4,2);},(h,u,v)=>{const [f1,f2]=worley(u,v,5,27),[g1,g2]=worley(u,v,13,63),crack=1-smooth((f2-f1)/.04)*smooth((g2-g1)/.05);return mix3(ramp([rgb(0x4d7f9c),rgb(0x7fb0c8),rgb(0xaed4e2)],fbm(u,v,3,5,81)),rgb(0xeaf6fb),crack*.8);},3,.14,10,.15),
 frostrock:size=>bakeLayer(size,(u,v)=>{const n=fbm(u,v,3,6,47),ridged=1-Math.abs(2*n-1);const [f1,f2]=worley(u,v,6,33);return .55*ridged+.2*fbm(u,v,14,3,12)+.25*smooth((f2-f1)/.08);},(h,u,v)=>{const frost=smooth((h-.62)/.2)*smooth((fbm(u,v,5,3,70)-.35)/.3);return mix3(ramp([rgb(0x24292f),rgb(0x4a525a),rgb(0x7a848c),rgb(0x9ba5ab)],h),rgb(0xf2f7fb),frost*.9);},8,.8,9,.2),
 container:size=>bakeLayer(size,(u,v)=>{const rib=.5+.5*Math.sin(TAU*u*16),scratch=fbm(u*1,v*8,8,3,14);return .3+.5*smooth(rib*1.3)+.12*(scratch-.5)+.08*fbm(u,v,20,2,3);},(h,u,v)=>{const rust=smooth((fbm(u,v,4,5,35)-.55)/.12)+smooth((v-.86)/.1)*.6;return mix3(ramp([rgb(0x86888a),rgb(0xc2c4c4),rgb(0xe4e5e3)],h*.6+.4*fbm(u,v,7,3,5)),rgb(0x6a3a1c),Math.min(1,rust)*.8);},5,.6,3,0),
};
const layerSets=[['sand','drytrack','sandstone'],['concrete','asphalt','rustplate'],['snow','ice','frostrock']];
const cache=new Map<string,unknown>();
function cached<T>(key:string,make:()=>T):T{if(!cache.has(key))cache.set(key,make());return cache.get(key) as T;}
/** Baked texture resolution; the test suite lowers it because it never renders. */
export const textureSettings={size:256};
export const layer=(name:string)=>cached('layer:'+name,()=>recipes[name](textureSettings.size));
/** Low-frequency tileable noise: R/G warp + colour variation, B cloud shadows. */
const macroTexture=()=>cached('macro',()=>{const size=128,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,i=(y*size+x)*4;data[i]=fbm(u,v,4,5,101)*255;data[i+1]=fbm(u,v,4,5,202)*255;data[i+2]=smooth((fbm(u,v,3,5,303)-.42)/.22)*255;data[i+3]=255;}return finishTexture(new THREE.DataTexture(data,size,size,THREE.RGBAFormat),false);});

// ---------------------------------------------------------------- terrain shape outside the playable square
const outerRelief=[24,2.5,28];
/** Ground height everywhere: the gameplay heightfield inside the arena, generated mesas, yards or peaks outside it. */
export function landHeight(x:number,z:number,style:number){
 const d=Math.max(Math.abs(x),Math.abs(z))-50;if(d<=0)return terrainHeight(x,z);
 const edge=terrainHeight(Math.max(-50,Math.min(50,x)),Math.max(-50,Math.min(50,z))),t=smooth(d/34),n=worldNoise(x,z,.018,5,style*13+3),ridged=1-Math.abs(2*n-1);
 let relief=style===0?(.35+.65*smooth((n-.38)/.2))*.75+.25*ridged:style===1?n:ridged*ridged*.75+n*.25;
 if(style===0)relief=lerp(relief,Math.round(relief*4)/4,.55); // stepped mesas
 // The camera looks down at roughly 47 degrees; keeping the rim below a 0.55 slope stops it hiding the arena.
 return edge*(1-t*.7)+Math.min(.55*d,t*(outerRelief[style]*relief+(style===1?0:3)));
}
export const roadMask=(x:number,z:number)=>{const a=Math.min(Math.abs(x-24-Math.sin(z*.065)*5),Math.abs(x+24-Math.sin(z*.065)*5)),b=Math.abs(z-20*Math.sin(x*.045));return Math.max(1-smooth((a-2.2)/1.4),1-smooth((b-2)/1.4));};
const channelMask=(x:number,z:number,style:number)=>style===1?0:1-smooth((Math.abs(style===2?x-5*Math.sin(z*.07):x+5*Math.sin(z*.08))-3.5)/4);
/** Blend weights of the three surface layers [base, track, rock] at a world position. */
export function surfaceWeights(x:number,z:number,style:number):RGB{
 const e=.4,sx=(landHeight(x+e,z,style)-landHeight(x-e,z,style))/(2*e),sz=(landHeight(x,z+e,style)-landHeight(x,z-e,style))/(2*e),slope=Math.hypot(sx,sz),h=landHeight(x,z,style),n=worldNoise(x,z,.09,4,style+40),inside=Math.max(Math.abs(x),Math.abs(z))<50;
 let track=inside?roadMask(x,z):0,rock=0;
 if(style===0){rock=smooth((slope-.3)/.3)+smooth((n-.62)/.1)*.6+(inside?0:smooth((h-5)/6)*.6);track=Math.max(track*.95,channelMask(x,z,0)*.7*smooth((n-.3)/.3));}
 else if(style===1){rock=smooth((slope-.12)/.2)*.9+smooth((n-.72)/.06)*.5;}
 else {rock=smooth((slope-.36)/.25)+smooth((n-.68)/.08)*.5;track=Math.max(track*.45,channelMask(x,z,2)*smooth((1.2-h)/1.4));}
 rock=Math.min(1,rock);track=Math.min(1,track)*(1-rock*.8);return [Math.max(.02,1-rock-track),track,rock];
}

// ---------------------------------------------------------------- ground material
const macroTints:[number,number][]=[[0xd9c7b6,0xfff0d8],[0xc9cdd2,0xf2efe8],[0xdfe9f6,0xffffff]];
function groundMaterial(style:number){
 const layers=layerSets[style].map(layer),look=arenaLooks[style];
 const material=new THREE.MeshStandardMaterial({roughness:1,metalness:0,map:layers[0].albedo,normalMap:layers[0].normal});
 const uniforms={tA1:{value:layers[1].albedo},tA2:{value:layers[2].albedo},tN1:{value:layers[1].normal},tN2:{value:layers[2].normal},tMacro:{value:macroTexture()},uTile:{value:new THREE.Vector3(...layers.map(l=>1/l.metres))},uWarp:{value:new THREE.Vector3(...layers.map(l=>l.warp))},uRough:{value:new THREE.Vector3(...layers.map(l=>l.roughness))},uTintA:{value:new THREE.Color(macroTints[style][0])},uTintB:{value:new THREE.Color(macroTints[style][1])},uCloud:{value:look.cloud},uTime:environmentUniforms.uTime};
 material.customProgramCacheKey=()=>'arena-ground-v2';
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 splat;attribute float shade;varying vec3 vSplat;varying float vShade;varying vec3 vGroundPos;varying vec3 vGroundNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSplat=splat;vShade=shade;vGroundPos=(modelMatrix*vec4(position,1.)).xyz;vGroundNormal=normalize(mat3(modelMatrix)*normal);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D tA1,tA2,tN1,tN2,tMacro;uniform vec3 uTile,uWarp,uRough,uTintA,uTintB;uniform float uCloud,uTime;
varying vec3 vSplat;varying float vShade;varying vec3 vGroundPos;varying vec3 vGroundNormal;
vec3 gBlend;vec3 gTangentNormal;float gHeight;`).replace('#include <map_fragment>',`
 vec4 macro=texture2D(tMacro,vGroundPos.xz*.011);
 vec2 warp=(macro.rg-.5)*2.4;
 vec2 uv0=vGroundPos.xz*uTile.x+warp*uWarp.x,uv1=vGroundPos.xz*uTile.y+warp*uWarp.y,uv2=vGroundPos.xz*uTile.z+warp*uWarp.z;
 vec4 a0=texture2D(map,uv0),a1=texture2D(tA1,uv1),a2=texture2D(tA2,uv2);
 // Height blending: the taller layer wins near a boundary, so sand settles into cracks instead of cross-fading.
 vec3 lift=vSplat+vec3(a0.a,a1.a,a2.a)*.55;float top=max(lift.x,max(lift.y,lift.z))-.16;
 gBlend=max(lift-top,0.)*step(.004,vSplat);gBlend/=max(1e-4,gBlend.x+gBlend.y+gBlend.z);
 gHeight=dot(gBlend,vec3(a0.a,a1.a,a2.a));
 vec3 albedo=a0.rgb*gBlend.x+a1.rgb*gBlend.y+a2.rgb*gBlend.z;
 albedo*=mix(uTintA,uTintB,texture2D(tMacro,vGroundPos.xz*.0043+.37).r)*vShade;
 float cloud=texture2D(tMacro,vGroundPos.xz*.0052+uTime*vec2(.0045,.0028)).b;
 albedo*=1.-uCloud*cloud;
 diffuseColor.rgb*=albedo;
 gTangentNormal=normalize((texture2D(normalMap,uv0).xyz*2.-1.)*gBlend.x+(texture2D(tN1,uv1).xyz*2.-1.)*gBlend.y+(texture2D(tN2,uv2).xyz*2.-1.)*gBlend.z);`)
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=clamp(dot(gBlend,uRough)+(.5-gHeight)*.12,.04,1.);')
   .replace('#include <normal_fragment_maps>',`
 vec3 groundN=normalize(vGroundNormal);vec3 groundT=normalize(cross(vec3(0.,0.,1.),groundN)),groundB=cross(groundN,groundT);
 normal=normalize((viewMatrix*vec4(groundT*gTangentNormal.x-groundB*gTangentNormal.y+groundN*gTangentNormal.z,0.)).xyz);`);
 };
 return material;
}
/** A lit material for props that reuses one of the baked surface layers. */
export function surfaceMaterial(name:string,options:{color?:number;repeat?:number;metalness?:number;roughness?:number;normalScale?:number}={}){
 const l=layer(name),repeat=options.repeat??1,map=l.albedo.clone(),normalMap=l.normal.clone();for(const t of [map,normalMap]){t.repeat.set(repeat,repeat);t.needsUpdate=true;}
 return new THREE.MeshStandardMaterial({map,normalMap,color:options.color??0xffffff,roughness:options.roughness??l.roughness,metalness:options.metalness??0,normalScale:new THREE.Vector2(options.normalScale??1,options.normalScale??1)});
}
/** Box whose texture coordinates are in metres, so every crate and wall shares one texel density. */
export function texturedBox(w:number,h:number,d:number,metres=3,plainRoof=false){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,sizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),s=sizes[face];if(plainRoof&&(face===2||face===3))uv.setXY(i,0,0);else uv.setXY(i,uv.getX(i)*s[0]/metres,uv.getY(i)*s[1]/metres);}return g;}

function gridGeometry(style:number,min:number,max:number,step:number,skipInside:boolean,rects:Footprint[]){
 const n=Math.round((max-min)/step),side=n+1,positions=new Float32Array(side*side*3),splat=new Float32Array(side*side*3),shade=new Float32Array(side*side),indices:number[]=[];
 for(let j=0;j<side;j++)for(let i=0;i<side;i++){const x=min+i*step,z=min+j*step,k=j*side+i;positions.set([x,landHeight(x,z,style),z],k*3);splat.set(surfaceWeights(x,z,style),k*3);
  // Baked contact shadow: ground darkens where it meets rocks, crates and walls.
  let ao=1;for(const r of rects){const dx=Math.max(0,Math.abs(x-r.x)-r.w/2),dz=Math.max(0,Math.abs(z-r.z)-r.d/2),dist=Math.hypot(dx,dz);if(dist<2.4)ao=Math.min(ao,.42+.58*smooth(dist/2.4));}
  shade[k]=ao*(.93+.14*worldNoise(x,z,.4,2,90));}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(skipInside){const x=min+i*step,z=min+j*step;if(x>=-50&&x+step<=50&&z>=-50&&z+step<=50)continue;}const a=j*side+i,b=a+1,c=a+side,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('splat',new THREE.BufferAttribute(splat,3));g.setAttribute('shade',new THREE.BufferAttribute(shade,1));g.setIndex(indices);g.computeVertexNormals();return g;
}

// ---------------------------------------------------------------- generated meshes
/** Appends geometries that share the position/normal/uv layout (the addon merger is not available headlessly). */
function joinGeometries(parts:THREE.BufferGeometry[],colors?:RGB[]){const flat=parts.map(p=>p.index?p.toNonIndexed():p),count=flat.reduce((n,p)=>n+p.attributes.position.count,0),position=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2),color=new Float32Array(count*3);let o=0;flat.forEach((p,index)=>{position.set(p.attributes.position.array,o*3);normal.set(p.attributes.normal.array,o*3);if(p.attributes.uv)uv.set(p.attributes.uv.array,o*2);const c=colors?.[index]??[255,255,255];for(let i=0;i<p.attributes.position.count;i++)color.set([c[0]/255,c[1]/255,c[2]/255],(o+i)*3);o+=p.attributes.position.count;});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('color',new THREE.BufferAttribute(color,3));return g;}
/** Weathered boulder: a noise-displaced sphere with smooth normals and box-projected texture coordinates. */
export function boulderGeometry(seed:number,sx=1,sy=1,sz=1,detail=3,metres=4){
 const g=new THREE.IcosahedronGeometry(1,detail),p=g.attributes.position,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=noise3(v.x*1.3+seed,v.y*1.3,v.z*1.3,seed)*.55+noise3(v.x*3.1,v.y*3.1+seed,v.z*3.1,seed+5)*.22+noise3(v.x*7,v.y*7,v.z*7+seed,seed+9)*.08;let r=.62+n;const shelf=Math.round(v.y*3)/3;v.y=lerp(v.y,shelf,.35);if(v.y<-.55)v.y=lerp(v.y,-.55,.8);v.multiplyScalar(r);p.setXYZ(i,v.x*sx,v.y*sy,v.z*sz);}
 // Smooth normals: accumulate face normals on shared positions.
 const key=(i:number)=>`${Math.round(p.getX(i)*500)},${Math.round(p.getY(i)*500)},${Math.round(p.getZ(i)*500)}`,sums=new Map<string,THREE.Vector3>(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),face=new THREE.Vector3(),normals=new Float32Array(p.count*3),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);face.copy(b).sub(a).cross(c.sub(a));for(let k=0;k<3;k++){const id=key(i+k);if(!sums.has(id))sums.set(id,new THREE.Vector3());sums.get(id)!.add(face);}
  const ax=Math.abs(face.x),ay=Math.abs(face.y),az=Math.abs(face.z);for(let k=0;k<3;k++){const x=p.getX(i+k),y=p.getY(i+k),z=p.getZ(i+k);if(ay>=ax&&ay>=az)uv.set([x/metres,z/metres],(i+k)*2);else if(ax>=az)uv.set([z/metres,y/metres],(i+k)*2);else uv.set([x/metres,y/metres],(i+k)*2);}}
 for(let i=0;i<p.count;i++){const n=sums.get(key(i))!;face.copy(n).normalize();normals.set([face.x,face.y,face.z],i*3);}
 g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
function tuftTexture(){return cached('tuft',()=>{const w=64,h=64,data=new Uint8Array(w*h*4),random=seeded(77);const blades=Array.from({length:11},()=>({x:.15+random()*.7,lean:(random()-.5)*.5,height:.45+random()*.5,width:.035+random()*.03,tone:random()}));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,i=(y*w+x)*4;let alpha=0,tone=0;for(const b of blades){const t=v/b.height;if(t>1)continue;const centre=b.x+b.lean*t*t,half=b.width*(1-t*.85);if(Math.abs(u-centre)<half){alpha=255;tone=b.tone;}}data[i]=200+tone*55;data[i+1]=200+tone*55;data[i+2]=200+tone*55;data[i+3]=alpha;}
 const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;});}
function tuftGeometry(){const parts:THREE.BufferGeometry[]=[];for(let i=0;i<6;i++){const quad=new THREE.PlaneGeometry(1,1);quad.translate(0,.5,0);quad.rotateY(i*Math.PI/3);parts.push(quad);}const g=joinGeometries(parts),n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);g.deleteAttribute('color');return g;}
function swayMaterial(color:number){const m=new THREE.MeshStandardMaterial({map:tuftTexture(),color,alphaTest:.5,roughness:.9});m.customProgramCacheKey=()=>'arena-tuft';m.onBeforeCompile=shader=>{shader.uniforms.uTime=environmentUniforms.uTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat swayPhase=instanceMatrix[3].x*.7+instanceMatrix[3].z*.9;\n#else\nfloat swayPhase=0.;\n#endif\ntransformed.x+=sin(uTime*1.9+swayPhase)*.1*uv.y*uv.y;transformed.z+=cos(uTime*1.3+swayPhase*1.7)*.06*uv.y*uv.y;');};return m;}
function pineGeometry(){const trunk=new THREE.CylinderGeometry(.12,.2,1.2,6);trunk.translate(0,.6,0);const parts:THREE.BufferGeometry[]=[trunk],colors:RGB[]=[rgb(0x3b2a1f)];for(let i=0;i<4;i++){const cone=new THREE.ConeGeometry(1.25-i*.26,1.5,9);cone.translate(0,1.5+i*.85,0);parts.push(cone);colors.push(rgb(0x1f4a35));}
 const g=joinGeometries(parts,colors),p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;for(let i=0;i<p.count;i++){if(p.getY(i)<1)continue;const snow=smooth((n.getY(i)-.2)/.3)*smooth((Math.sin(p.getX(i)*9)+Math.cos(p.getZ(i)*8)+1.6)/2);c.setXYZ(i,lerp(c.getX(i),.92,snow),lerp(c.getY(i),.96,snow),lerp(c.getZ(i),1,snow));}return g;}
function drapedDisc(x:number,z:number,radius:number,style:number,color:THREE.Color){const rings=7,segments=28,positions:number[]=[x,landHeight(x,z,style)+.06,z],colors:number[]=[color.r,color.g,color.b],indices:number[]=[];for(let r=1;r<=rings;r++)for(let s=0;s<segments;s++){const a=s/segments*TAU,px=x+Math.cos(a)*radius*r/rings,pz=z+Math.sin(a)*radius*r/rings,f=Math.pow(1-r/rings,2);positions.push(px,landHeight(px,pz,style)+.06,pz);colors.push(color.r*f,color.g*f,color.b*f);}
 for(let s=0;s<segments;s++){indices.push(0,1+(s+1)%segments,1+s);for(let r=1;r<rings;r++){const a=1+(r-1)*segments+s,b=1+(r-1)*segments+(s+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);return g;}

// ---------------------------------------------------------------- arena assembly
export type Footprint={x:number;z:number;w:number;d:number};
const dummy=new THREE.Object3D();
function scatter(geometry:THREE.BufferGeometry,material:THREE.Material,count:number,place:(i:number,random:()=>number)=>{x:number;y:number;z:number;scale:number;scaleY?:number;rotation?:number;tilt?:number}|null,seed:number,shadows:boolean){
 const random=seeded(seed),mesh=new THREE.InstancedMesh(geometry,material,count);let used=0;for(let i=0;i<count*4&&used<count;i++){const spot=place(i,random);if(!spot)continue;dummy.position.set(spot.x,spot.y,spot.z);dummy.rotation.set(spot.tilt??0,spot.rotation??random()*TAU,0);dummy.scale.set(spot.scale,spot.scaleY??spot.scale,spot.scale);dummy.updateMatrix();mesh.setMatrixAt(used++,dummy.matrix);}
 mesh.count=used;mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
}
const colourCrates=[0x2f7f86,0xa5482f,0xc79a2e,0x51616c,0x3d6a44];
/**
 * Builds everything that is purely visual: ground, generated landscape beyond the walls, cover meshes
 * for the collision footprints, scattered rocks and plants, and the boundary barrier.
 * `cover` are the gameplay obstacles that need a mesh; `footprints` are all solid rectangles (for contact shading and to keep plants clear).
 */
export function buildEnvironment(style:number,cover:Footprint[],footprints:Footprint[]){
 const group=new THREE.Group(),names=layerSets[style],ground=groundMaterial(style);group.name='environment';
 const inner=new THREE.Mesh(gridGeometry(style,-50,50,.5,false,footprints),ground);inner.name='terrain';inner.receiveShadow=true;group.add(inner);
 const outer=new THREE.Mesh(gridGeometry(style,-150,150,5,true,[]),ground);outer.name='landscape';outer.receiveShadow=true;outer.castShadow=true;group.add(outer);
 const rockMaterial=surfaceMaterial(names[2],{repeat:1}),bridgeZ=bridgeCenterZ();
 const blocked=(x:number,z:number,margin:number)=>footprints.some(r=>Math.abs(x-r.x)<r.w/2+margin&&Math.abs(z-r.z)<r.d/2+margin)||(Math.abs(z-bridgeZ)<6+margin&&Math.abs(x)<40);
 // Cover: one generated boulder cluster (or a stack of shipping containers in the foundry) per collision footprint.
 cover.forEach((r,index)=>{const base=terrainHeight(r.x,r.z);
  if(style===1){const long=r.w>r.d,length=Math.max(r.w,r.d),unit=Math.min(6,length),count=Math.max(1,Math.round(length/unit)),each=length/count;for(let i=0;i<count;i++)for(let level=0;level<2;level++){if(level&&((index+i)%3===0))continue;const w=long?each-.12:r.w,d=long?r.d:each-.12,h=level?1.6:1.9,crate=new THREE.Mesh(texturedBox(w,h,d,3),surfaceMaterial('container',{color:colourCrates[(index*3+i+level*2)%colourCrates.length],metalness:.35,roughness:.55}));const offset=(i-(count-1)/2)*each;crate.position.set(r.x+(long?offset:0),base+(level?1.9+h/2:h/2)-.05,r.z+(long?0:offset));if(level)crate.rotation.y=((index+i)%2?.04:-.05);crate.castShadow=crate.receiveShadow=true;group.add(crate);}}
  else {const main=new THREE.Mesh(boulderGeometry(index*7+style*31+1,r.w*.62,2.5,r.d*.62,4),rockMaterial);main.position.set(r.x,base+1.25,r.z);main.castShadow=main.receiveShadow=true;group.add(main);
   const random=seeded(index*97+13);for(let i=0;i<3;i++){const s=.7+random()*.55,side=random()<.5?-1:1,along=(random()-.5)*.8,small=new THREE.Mesh(boulderGeometry(index*11+i*5+3,s,s*.8,s,3),rockMaterial);const px=r.x+(r.w>r.d?along*r.w:side*(r.w/2-s*.5)),pz=r.z+(r.w>r.d?side*(r.d/2-s*.5):along*r.d);small.position.set(px,terrainHeight(px,pz)+s*.3,pz);small.rotation.y=random()*TAU;small.castShadow=small.receiveShadow=true;group.add(small);}}
 });
 // Loose stones stay below tyre clearance, so none of them needs a collider.
 group.add(scatter(boulderGeometry(5,1,1,1,2,1.2),rockMaterial,style===1?90:260,(_,random)=>{const x=(random()-.5)*98,z=(random()-.5)*98;if(roadMask(x,z)>.3||blocked(x,z,.3))return null;const scale=.1+random()*random()*.3;return {x,y:terrainHeight(x,z)+scale*.12,z,scale,scaleY:scale*.6};},style*100+1,true));
 // Boulders on the generated slopes outside the walls.
 if(style!==1)group.add(scatter(boulderGeometry(9,1,1,1,3,3),rockMaterial,70,(_,random)=>{const a=random()*TAU,r=58+random()*60,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.max(Math.abs(x),Math.abs(z))<54)return null;const scale=1+random()*2.6;return {x,y:landHeight(x,z,style)+scale*.2,z,scale,scaleY:scale*(.6+random()*.5)};},style*100+2,true));
 if(style===0){
  const tuft=tuftGeometry();
  group.add(scatter(tuft,swayMaterial(0xd9c27a),1100,(_,random)=>{const x=(random()-.5)*150,z=(random()-.5)*150,inside=Math.max(Math.abs(x),Math.abs(z))<49.5;if(inside&&(roadMask(x,z)>.15||blocked(x,z,.5)))return null;const w=surfaceWeights(x,z,0);if(w[2]>.35||worldNoise(x,z,.06,3,55)<.47)return null;const scale=.5+random()*.5;return {x,y:landHeight(x,z,0)-.02,z,scale,scaleY:scale*(.8+random()*.6)};},31,false));
  group.add(scatter(tuft,swayMaterial(0x8f9a55),170,(_,random)=>{const x=(random()-.5)*170,z=(random()-.5)*170,inside=Math.max(Math.abs(x),Math.abs(z))<49.5;if(inside&&(roadMask(x,z)>.05||blocked(x,z,1)))return null;if(surfaceWeights(x,z,0)[2]>.3)return null;const scale=.9+random()*.7;return {x,y:landHeight(x,z,0)-.03,z,scale,scaleY:scale*.75};},32,true));
 }
 if(style===2){
  group.add(scatter(tuftGeometry(),swayMaterial(0xa89868),420,(_,random)=>{const x=(random()-.5)*98,z=(random()-.5)*98;if(roadMask(x,z)>.1||blocked(x,z,.5))return null;const w=surfaceWeights(x,z,2);if(w[1]>.2||worldNoise(x,z,.07,3,58)<.5)return null;const scale=.3+random()*.3;return {x,y:terrainHeight(x,z)-.03,z,scale};},41,false));
  group.add(scatter(pineGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}),190,(_,random)=>{const x=(random()-.5)*230,z=(random()-.5)*230,d=Math.max(Math.abs(x),Math.abs(z))-50;if(d<((x>0&&x>=Math.abs(z))||(z>0&&z>=Math.abs(x))?7:2.5)||worldNoise(x,z,.03,3,61)<.42)return null;const scale=.9+random()*.9;return {x,y:landHeight(x,z,2)-.1,z,scale,scaleY:scale*(.9+random()*.5)};},42,true));
 }
 if(style===1){
  // Sodium lamps: a real mesh for the fitting, an additive pool on the ground for its light.
  const pole=new THREE.CylinderGeometry(.09,.13,6,6);pole.translate(0,3,0);const arm=new THREE.BoxGeometry(1.5,.1,.14);arm.translate(.7,5.95,0);const head=new THREE.BoxGeometry(.6,.12,.3);head.translate(1.3,5.86,0);
  const lamps:[number,number,number][]=[];for(let i=-3;i<=3;i++){lamps.push([-49,i*14,0],[49,i*14+7,Math.PI]);lamps.push([i*14+7,-49,-Math.PI/2],[i*14,49,Math.PI/2]);}for(const [x,z] of [[-12,10],[13,-6],[0,-31],[-28,16],[27,18],[0,12]])if(!blocked(x,z,.6))lamps.push([x,z,x>0?Math.PI:0]);
  const fittings=new THREE.InstancedMesh(joinGeometries([pole,arm,head]),new THREE.MeshStandardMaterial({color:0x2b3136,metalness:.7,roughness:.5}),lamps.length),bulbGeometry=new THREE.BoxGeometry(.46,.05,.2);bulbGeometry.translate(1.3,5.78,0);
  const bulbs=new THREE.InstancedMesh(bulbGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(1,.62,.24).multiplyScalar(2.2)}),lamps.length),pools:THREE.BufferGeometry[]=[];
  lamps.forEach(([x,z,rotation],i)=>{dummy.position.set(x,landHeight(x,z,1),z);dummy.rotation.set(0,rotation,0);dummy.scale.setScalar(1);dummy.updateMatrix();fittings.setMatrixAt(i,dummy.matrix);bulbs.setMatrixAt(i,dummy.matrix);pools.push(drapedDisc(x+Math.cos(rotation)*1.3,z-Math.sin(rotation)*1.3,8.5,1,new THREE.Color(.55,.3,.1)));});
  fittings.castShadow=true;group.add(fittings,bulbs);
  const light=new THREE.Mesh(joinColored(pools),new THREE.MeshBasicMaterial({vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));light.renderOrder=2;group.add(light);
  // Lit factory blocks beyond the fence; the emissive windows feed the bloom pass.
  const windows=windowTexture(),wall=surfaceMaterial('concrete',{repeat:1,color:0x7c8288});wall.emissiveMap=windows;wall.emissive=new THREE.Color(1,.66,.3);wall.emissiveIntensity=3.2;
  const random=seeded(404);for(let i=0;i<34;i++){const a=i/34*TAU+random()*.1,r=66+random()*26,x=Math.cos(a)*r,z=Math.sin(a)*r,d=Math.max(Math.abs(x),Math.abs(z))-50,near=x+z>0,h=Math.min(near?d*.7:30,7+random()*17),w=7+random()*8,depth=7+random()*8,box=new THREE.Mesh(texturedBox(w,h,depth,8,true),wall);box.position.set(x,landHeight(x,z,1)+h/2-.5,z);box.rotation.y=Math.round(random()*2)*Math.PI/2;box.castShadow=box.receiveShadow=true;group.add(box);}
 }
 group.add(boundary(style));
 return group;
}
function joinColored(parts:THREE.BufferGeometry[]){const flat=parts.map(p=>p.toNonIndexed()),count=flat.reduce((n,p)=>n+p.attributes.position.count,0),position=new Float32Array(count*3),color=new Float32Array(count*3);let o=0;for(const p of flat){position.set(p.attributes.position.array,o*3);color.set(p.attributes.color.array,o*3);o+=p.attributes.position.count;}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('color',new THREE.BufferAttribute(color,3));return g;}
function windowTexture(){return cached('windows',()=>{const size=128,data=new Uint8Array(size*size*4),random=seeded(909),lit=Array.from({length:16*16},()=>random()<.32?(.5+random()*.5):0);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const cx=Math.floor(x/8),cy=Math.floor(y/8),inPane=x%8>1&&x%8<6&&y%8>2&&y%8<6,v=inPane?lit[cy*16+cx]*255:0,i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;});}
/** Barrier that follows the ground along the edge of the playable square and hides the seam to the outer landscape. */
function boundary(style:number){const positions:number[]=[],uvs:number[]=[],indices:number[]=[],height=1.5,half=.35;
 const strip=(points:[number,number][],nx:number,nz:number)=>{for(const side of [-1,1,0]){const start=positions.length/3;points.forEach(([x,z],i)=>{const base=Math.min(landHeight(x-nx*half,z-nz*half,style),landHeight(x+nx*half,z+nz*half,style))-.4,top=Math.max(terrainHeight(x,z),landHeight(x+nx*half,z+nz*half,style))+height;
   if(side){const px=x+nx*half*side,pz=z+nz*half*side;positions.push(px,base,pz,px,top,pz);uvs.push(i/3,0,i/3,(top-base)/3);}else{positions.push(x-nx*half,top,z-nz*half,x+nx*half,top,z+nz*half);uvs.push(i/3,0,i/3,.25);}
   if(i){const k=start+i*2;if(side===1)indices.push(k-2,k,k-1,k-1,k,k+1);else indices.push(k-2,k-1,k,k-1,k+1,k);}});}};
 const line=Array.from({length:101},(_,i)=>-50+i);strip(line.map(x=>[x,-50]),0,-1);strip(line.map(x=>[x,50]).reverse() as [number,number][],0,1);strip(line.map(z=>[-50,z]).reverse() as [number,number][],-1,0);strip(line.map(z=>[50,z]),1,0);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
 const material=surfaceMaterial(style===1?'concrete':layerSets[style][2],{color:style===1?0xe8e4dc:0xffffff});material.side=THREE.DoubleSide;const mesh=new THREE.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='boundary';return mesh;}

// ---------------------------------------------------------------- lighting and atmosphere
/** Applies an arena's time of day to the scene's sun, sky light and background. */
export function applyArenaLighting(style:number,scene:THREE.Scene,sun:THREE.DirectionalLight,hemisphere:THREE.HemisphereLight){const look=arenaLooks[style];sun.color.setHex(look.sun.color);sun.intensity=look.sun.intensity;hemisphere.color.setHex(look.hemi.sky);hemisphere.groundColor.setHex(look.hemi.ground);hemisphere.intensity=look.hemi.intensity;scene.background=new THREE.Color(look.haze);scene.fog=new THREE.Fog(look.haze,95,210);return look;}
/** Keeps a tight, texel-snapped shadow frustum centred on the camera focus so shadows stay sharp everywhere. */
export function aimSun(style:number,sun:THREE.DirectionalLight,focus:THREE.Vector3,extent=34){const d=arenaLooks[style].sun.dir,direction=new THREE.Vector3(d[0],d[1],d[2]).normalize(),right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right),texel=extent*2/Math.max(1,sun.shadow.mapSize.x);
 const snapped=right.clone().multiplyScalar(Math.round(focus.dot(right)/texel)*texel).add(up.clone().multiplyScalar(Math.round(focus.dot(up)/texel)*texel)).add(direction.clone().multiplyScalar(focus.dot(direction)));
 sun.target.position.copy(snapped);sun.position.copy(snapped).addScaledVector(direction,80);sun.target.updateMatrixWorld();const camera=sun.shadow.camera;if(camera.right!==extent){camera.left=camera.bottom=-extent;camera.right=camera.top=extent;camera.near=1;camera.far=190;camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.normalBias=.05;}}
/** Drifting snow, dust or embers in a volume that follows the camera. */
export class Atmosphere{
 readonly points:THREE.Points;private style=-1;private readonly count=320;private readonly seeds:Float32Array;private clock=0;
 constructor(){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.count*3),3));this.seeds=new Float32Array(this.count*3);const random=seeded(5150);for(let i=0;i<this.seeds.length;i++)this.seeds[i]=random();
  const size=32,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-15.5,y-15.5)/15.5,i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.pow(Math.max(0,1-r),1.6)*255;}const sprite=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);sprite.magFilter=sprite.minFilter=THREE.LinearFilter;sprite.needsUpdate=true;
  this.points=new THREE.Points(geometry,new THREE.PointsMaterial({map:sprite,transparent:true,depthWrite:false,sizeAttenuation:false,size:5}));this.points.frustumCulled=false;this.points.renderOrder=5;}
 setArena(style:number){this.style=style;const m=this.points.material as THREE.PointsMaterial;if(style===1){m.color.setRGB(3.2,1.3,.35);m.blending=THREE.AdditiveBlending;m.opacity=.8;m.size=2.5;}else if(style===2){m.color.setRGB(1,1,1);m.blending=THREE.NormalBlending;m.opacity=.85;m.size=5;}else {m.color.setRGB(.95,.8,.6);m.blending=THREE.NormalBlending;m.opacity=.3;m.size=4;}this.points.geometry.setDrawRange(0,style===1?90:style===2?this.count:160);m.needsUpdate=true;}
 update(dt:number,focus:THREE.Vector3){if(this.style<0)return;this.clock+=dt;const p=this.points.geometry.attributes.position as THREE.BufferAttribute,t=this.clock,s=this.seeds,style=this.style,span=64,tall=22,mod=(v:number,m:number)=>((v%m)+m)%m;
  for(let i=0;i<this.count;i++){const a=s[i*3],b=s[i*3+1],c=s[i*3+2];let x:number,y:number,z:number;
   if(style===2){x=a*span+t*(1.6+b)+Math.sin(t*.9+c*9)*.8;y=b*tall-t*(1.8+c*1.4);z=c*span+t*.6;}
   else if(style===1){x=a*span+Math.sin(t*.7+b*20)*1.5;y=b*tall+t*(.8+a*1.3);z=c*span+Math.cos(t*.6+a*20)*1.5;}
   else {x=a*span+t*(3+b*2.5);y=b*6+Math.sin(t*.8+c*12)*.6;z=c*span+t*(.8+a);}
   p.setXYZ(i,focus.x+mod(x-focus.x,span)-span/2,mod(y,tall)-1,focus.z+mod(z-focus.z,span)-span/2);}
  p.needsUpdate=true;}
}
