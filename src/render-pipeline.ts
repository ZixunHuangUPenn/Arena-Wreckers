// WebGL-only half of the visual upgrade: image-based lighting from a generated sky, filmic tone
// mapping, bloom and a final colour grade. Everything here degrades by quality tier.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {arenaLooks,aimSun,applyArenaLighting,environmentUniforms,Atmosphere} from './environment';

export type Quality='low'|'medium'|'high';
const gradeShader={
 uniforms:{tDiffuse:{value:null as THREE.Texture|null},uTint:{value:new THREE.Vector3(1,1,1)},uSaturation:{value:1},uContrast:{value:1},uVignette:{value:.3},uTime:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 uTint;uniform float uSaturation,uContrast,uVignette,uTime;varying vec2 vUv;
void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*uTint;float luma=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(luma),c,uSaturation);c=(c-.5)*uContrast+.5;
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
  composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(size.x/2,size.y/2),.3,.55,1);composer.addPass(bloom);composer.addPass(new OutputPass());grade=new ShaderPass(gradeShader);composer.addPass(grade);applyLook();}
 function applyLook(){const look=arenaLooks[style];renderer.toneMappingExposure=look.exposure;if(bloom)bloom.strength=look.bloom;if(grade){grade.uniforms.uTint.value.set(...look.grade.tint);grade.uniforms.uSaturation.value=look.grade.saturation;grade.uniforms.uContrast.value=look.grade.contrast;grade.uniforms.uVignette.value=look.grade.vignette;}}
 return {
  /** Environment map for other scenes (the garage turntable reuses the desert sky). */
  environment(arena:number){if(!environments.has(arena))environments.set(arena,skyEnvironment(renderer,arena));return environments.get(arena)!.texture;},
  setArena(arena:number){style=arena;applyArenaLighting(arena,scene,sun,hemisphere);scene.environment=this.environment(arena);scene.environmentIntensity=arenaLooks[arena].envIntensity;atmosphere.setArena(arena);applyLook();},
  setQuality(next:Quality){const shadows=next!=='low',mapSize=next==='high'?2048:1024;renderer.shadowMap.enabled=shadows;sun.castShadow=shadows;if(sun.shadow.mapSize.x!==mapSize){sun.shadow.mapSize.set(mapSize,mapSize);sun.shadow.map?.dispose();sun.shadow.map=null;}atmosphere.points.visible=next!=='low';if(next!==quality||!composer){quality=next;rebuild();}},
  setSize(w:number,h:number){width=w;height=h;composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(w,h);},
  render(dt:number,focus:THREE.Vector3){environmentUniforms.uTime.value+=dt;aimSun(style,sun,focus);atmosphere.update(dt,focus);if(composer){if(grade)grade.uniforms.uTime.value=environmentUniforms.uTime.value%10;composer.render(dt);}else renderer.render(scene,camera);},
 };
}
