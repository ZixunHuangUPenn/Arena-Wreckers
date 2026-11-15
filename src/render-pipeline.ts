// WebGL-only half of the visual upgrade: image-based lighting from a generated sky, filmic tone
// mapping, bloom and a final colour grade. Everything here degrades by quality tier.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {arenaLooks,aimSun,applyArenaLighting,environmentUniforms,Atmosphere} from './environment';

export type Quality='low'|'medium'|'high';
const gradeShader={
 uniforms:{tDiffuse:{value:null as THREE.Texture|null},uTint:{value:new THREE.Vector3(1,1,1)},uSaturation:{value:1},uContrast:{value:1},uVignette:{value:.3},uTime:{value:0},uBlur:{value:0},uTexel:{value:new THREE.Vector2(1/1280,1/720)}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 uTint;uniform float uSaturation,uContrast,uVignette,uTime,uBlur;uniform vec2 uTexel;varying vec2 vUv;
// Depth of field without a depth buffer: with a fixed-pitch camera, screen height tracks distance along the ground,
// so a Gaussian-weighted disc blur that grows away from the focus band behaves like a lens.
vec3 lens(vec2 uv){float d=uv.y-.46;float radius=uBlur*(d>0.?smoothstep(.2,.56,d)*1.15:smoothstep(.24,.5,-d));if(radius<.35)return texture2D(tDiffuse,uv).rgb;
 vec3 sum=texture2D(tDiffuse,uv).rgb;float total=1.;for(int i=1;i<=16;i++){float f=float(i),r=sqrt(f/16.),a=f*2.39996;float w=exp(-2.*r*r);sum+=texture2D(tDiffuse,uv+vec2(cos(a),sin(a))*r*radius*uTexel).rgb*w;total+=w;}return sum/total;}
void main(){vec3 c=lens(vUv)*uTint;float luma=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(luma),c,uSaturation);c=(c-.5)*uContrast+.5;
 vec2 q=vUv-.5;c*=1.-uVignette*smoothstep(.25,.85,dot(q,q)*2.);
 // A little ordered noise hides banding in the dark foundry gradients.
 c+=(fract(sin(dot(vUv*vec2(1920.,1080.)+uTime,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
 gl_FragColor=vec4(clamp(c,0.,1.),1.);}`,
};
/** Renders a gradient sky with a sun glow into a prefiltered environment map for reflections and ambient light. */
function skyEnvironment(renderer:THREE.WebGLRenderer,style:number){
 const look=arenaLooks[style],scene=new THREE.Scene(),d=look.sun.dir;
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uZenith:{value:new THREE.Color(look.sky.zenith)},uHorizon:{value:new THREE.Color(look.sky.horizon)},uGround:{value:new THREE.Color(look.sky.ground)},uSun:{value:new THREE.Vector3(d[0],d[1],d[2]).normalize()},uSunColor:{value:new THREE.Color(look.sun.color).multiplyScalar(look.sun.intensity)}},
  vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform vec3 uZenith,uHorizon,uGround,uSun,uSunColor;varying vec3 vDir;
void main(){vec3 dir=normalize(vDir);float h=dir.y;vec3 c=h>0.?mix(uHorizon,uZenith,pow(h,.55)):mix(uHorizon,uGround,pow(-h,.4));float s=max(dot(dir,uSun),0.);c+=uSunColor*(pow(s,48.)*.9+pow(s,700.)*12.);gl_FragColor=vec4(c,1.);}`});
 scene.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),material));
 const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(scene,.02);generator.dispose();material.dispose();return target;
}
export function createPipeline(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,sun:THREE.DirectionalLight,hemisphere:THREE.HemisphereLight){
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.type=THREE.PCFSoftShadowMap;scene.add(sun.target);
 const atmosphere=new Atmosphere();scene.add(atmosphere.points);
 const environments=new Map<number,THREE.WebGLRenderTarget>();let style=0,quality:Quality='medium',composer:EffectComposer|null=null,bloom:UnrealBloomPass|null=null,grade:ShaderPass|null=null,width=1,height=1;
 const size=new THREE.Vector2();
 function rebuild(){composer?.dispose();composer=null;bloom=null;grade=null;if(quality==='low')return;
  renderer.getDrawingBufferSize(size);const target=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:quality==='high'?4:0});
  composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  // Ambient occlusion grounds vehicles, rocks and walls; it re-renders depth and normals, so it is high-tier only.
  if(quality==='high'){const ao=new GTAOPass(scene,camera,size.x,size.y);ao.updateGtaoMaterial({radius:1.6,distanceExponent:1.5,thickness:1.5,scale:1.2,samples:12});ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:12});ao.blendIntensity=.9;composer.addPass(ao);}bloom=new UnrealBloomPass(new THREE.Vector2(size.x/2,size.y/2),.3,.55,1);composer.addPass(bloom);composer.addPass(new OutputPass());grade=new ShaderPass(gradeShader);composer.addPass(grade);applyLook();}
 function applyLook(){const look=arenaLooks[style];renderer.toneMappingExposure=look.exposure;if(bloom)bloom.strength=look.bloom;if(grade){grade.uniforms.uTint.value.set(...look.grade.tint);grade.uniforms.uSaturation.value=look.grade.saturation;grade.uniforms.uContrast.value=look.grade.contrast;grade.uniforms.uVignette.value=look.grade.vignette;renderer.getDrawingBufferSize(size);grade.uniforms.uTexel.value.set(1/size.x,1/size.y);grade.uniforms.uBlur.value=size.y/720*(quality==='high'?5:4);}}
 return {
  /** Environment map for other scenes (the garage turntable reuses the desert sky). */
  environment(arena:number){if(!environments.has(arena))environments.set(arena,skyEnvironment(renderer,arena));return environments.get(arena)!.texture;},
  setArena(arena:number){style=arena;applyArenaLighting(arena,scene,sun,hemisphere);scene.environment=this.environment(arena);scene.environmentIntensity=arenaLooks[arena].envIntensity;atmosphere.setArena(arena);applyLook();},
  setQuality(next:Quality){const shadows=next!=='low',mapSize=next==='high'?2048:1024;renderer.shadowMap.enabled=shadows;sun.castShadow=shadows;if(sun.shadow.mapSize.x!==mapSize){sun.shadow.mapSize.set(mapSize,mapSize);sun.shadow.map?.dispose();sun.shadow.map=null;}atmosphere.points.visible=next!=='low';if(next!==quality||!composer){quality=next;rebuild();}},
  setSize(w:number,h:number){width=w;height=h;composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(w,h);applyLook();},
  render(dt:number,focus:THREE.Vector3){environmentUniforms.uTime.value+=dt;aimSun(style,sun,focus);atmosphere.update(dt,focus);if(composer){if(grade)grade.uniforms.uTime.value=environmentUniforms.uTime.value%10;composer.render(dt);}else renderer.render(scene,camera);},
 };
}
