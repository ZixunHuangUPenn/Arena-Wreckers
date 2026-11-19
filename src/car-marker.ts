// Marks the player's own car: a team-coloured ring with a heading arrow on the ground under it, and an x-ray
// silhouette in the same colour wherever cover, a bridge deck or a cliff hides the car from the camera.
import * as THREE from 'three';

function ringTexture(){const n=128,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v),i=(y*n+x)*4;
 // Soft inner glow, a crisp ring, and a chevron at +V, which lands on the car's nose (-Z).
 let a=Math.max(0,1-Math.abs(r-.8)/.06)+Math.max(0,.78-r)*.22;const cu=Math.abs(u);if(v>.66&&v<.98){const half=(.98-v)/.32*.24;if(cu<half)a=Math.max(a,1);}
 a*=r<.995||v>.6?1:0;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.min(1,a)*255;}const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}

export class CarMarker{
 readonly ring:THREE.Mesh;private xray:THREE.ShaderMaterial;private target:THREE.Object3D|null=null;private ghosts:THREE.Mesh[]=[];private pulse=0;
 constructor(scene:THREE.Scene,color=0x5fd2ff){
  const g=new THREE.PlaneGeometry(4.4,4.4).rotateX(-Math.PI/2);
  this.ring=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:ringTexture(),color,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,blending:THREE.AdditiveBlending}));this.ring.renderOrder=5;this.ring.name='player-marker';this.ring.visible=false;void scene;
  this.xray=new THREE.ShaderMaterial({depthWrite:false,depthFunc:THREE.GreaterDepth,uniforms:{uColor:{value:new THREE.Color(color)}},
   vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
   fragmentShader:'uniform vec3 uColor;varying vec3 vN;varying vec3 vV;void main(){float rim=1.-abs(dot(normalize(vN),normalize(vV)));gl_FragColor=vec4(uColor*(.28+1.1*pow(rim,2.)),1.);}'});
 }
 setColor(color:number){(this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);this.xray.uniforms.uColor.value.setHex(color);}
 /**
  * Attaches the x-ray copy to the car model. Every mesh gets a child that shares its geometry and is drawn after
  * the world but before the car itself, with an inverted depth test, so it only shows where the car is hidden.
  */
 attach(visual:THREE.Object3D|undefined){if(this.target===visual)return;for(const g of this.ghosts)g.removeFromParent();this.ghosts=[];this.target=visual??null;if(!visual)return;
  const meshes:THREE.Mesh[]=[];visual.traverse(o=>{if(o instanceof THREE.Mesh&&o.name!=='scar'&&o.name!=='xray'&&o.name!=='glass'&&o.name!=='beam'&&o.name!=='pool')meshes.push(o);});
  for(const m of meshes){m.renderOrder=Math.max(m.renderOrder,3);const ghost=new THREE.Mesh(m.geometry,this.xray);ghost.name='xray';ghost.renderOrder=2;ghost.castShadow=ghost.receiveShadow=false;ghost.frustumCulled=false;m.add(ghost);this.ghosts.push(ghost);}}
 /** Rides on the car (so it tilts with the ground under it). Hidden when the match is not running. */
 update(dt:number,car:THREE.Object3D,show:boolean){this.pulse+=dt;if(this.ring.parent!==car){car.add(this.ring);this.ring.position.set(0,.07,0);}this.ring.visible=show;for(const g of this.ghosts)g.visible=show;if(!show)return;const k=1+Math.sin(this.pulse*3.2)*.04;this.ring.scale.set(k,1,k);(this.ring.material as THREE.MeshBasicMaterial).opacity=.62+Math.sin(this.pulse*3.2)*.12;}
}
