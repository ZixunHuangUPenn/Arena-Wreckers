// Garage showroom: a dark photo studio with softbox reflections, a turntable and contact shadows.
// The studio environment is rendered once into a prefiltered map, so car paint, chrome and glass pick up
// long strip-light highlights the way they do in automotive photography.
import * as THREE from 'three';

export type Framing='hero'|'tune'|'deploy'|'side';
/** Small studio rendered into a PMREM environment: a big overhead softbox, two strip lights and a warm kicker. */
function studioEnvironment(renderer:THREE.WebGLRenderer){
 const scene=new THREE.Scene(),room=new THREE.Mesh(new THREE.BoxGeometry(30,14,30),new THREE.MeshBasicMaterial({color:0x0b0d10,side:THREE.BackSide}));room.position.y=6;scene.add(room);
 const panel=(w:number,h:number,color:number,intensity:number,x:number,y:number,z:number,rx=0,ry=0)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);scene.add(m);};
 panel(10,4,0xffffff,5,0,12.9,0,Math.PI/2);                 // overhead softbox
 panel(1.2,10,0xe8f0ff,6,-11,5,-4,0,Math.PI/2);            // cool strip left
 panel(1.2,10,0xe8f0ff,6,11,5,-4,0,-Math.PI/2);            // cool strip right
 panel(8,1.4,0xffd6a0,3.2,0,3,14.9);                       // warm rear kicker
 panel(6,.6,0xbfe8ff,4,0,1.4,-14.9);                       // low front fill
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0x14171b}));floor.rotation.x=-Math.PI/2;floor.position.y=-.9;scene.add(floor);
 const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(scene,.02);pmrem.dispose();
 scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
 return target.texture;
}
/** Radial gradient texture used for the contact-shadow blob and the floor light pool. */
function radial(inner:string,outer:string,size=256){
 const data=new Uint8Array(size*size*4),a=new THREE.Color(inner),b=new THREE.Color(outer);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=x/(size-1)*2-1,dy=y/(size-1)*2-1,d=Math.min(1,Math.hypot(dx,dy)),t=1-Math.pow(1-d,1.0)*0;const f=Math.pow(Math.max(0,1-d),1.6);const i=(y*size+x)*4;data[i]=(b.r+(a.r-b.r)*f)*255;data[i+1]=(b.g+(a.g-b.g)*f)*255;data[i+2]=(b.b+(a.b-b.b)*f)*255;data[i+3]=f*255+t*0;}
 const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex;
}
export function createShowroom(renderer:THREE.WebGLRenderer){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x07090b);scene.fog=new THREE.Fog(0x07090b,11,26);
 scene.environment=studioEnvironment(renderer);scene.environmentIntensity=1.35;
 // Key light with soft shadows, a cool rim and a low bounce from the floor.
 const key=new THREE.DirectionalLight(0xfff1de,3.4);key.position.set(-3.5,9,4.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-4;key.shadow.camera.right=key.shadow.camera.top=4;key.shadow.camera.near=2;key.shadow.camera.far=20;key.shadow.bias=-.0004;key.shadow.normalBias=.02;key.shadow.radius=4;scene.add(key);
 const rim=new THREE.DirectionalLight(0x9fd8ff,1.6);rim.position.set(5,3.5,-6);scene.add(rim);
 scene.add(new THREE.HemisphereLight(0x8a9aa8,0x15110d,.6));
 // Floor: dark polished concrete with a soft pool of light under the car.
 const floorMat=new THREE.MeshStandardMaterial({color:0x1b1e21,roughness:.42,metalness:0});
 const floor=new THREE.Mesh(new THREE.CircleGeometry(30,64),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const pool=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({map:radial('#3a4650','#000000'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.position.y=.004;scene.add(pool);
 // Turntable: brushed steel disc, a thin LED ring and engraved index marks.
 const table=new THREE.Group();scene.add(table);
 const disc=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.38,.08,96),new THREE.MeshStandardMaterial({color:0x2a2e33,metalness:.85,roughness:.38}));disc.position.y=.04;disc.receiveShadow=true;table.add(disc);
 const led=new THREE.Mesh(new THREE.TorusGeometry(3.36,.018,8,160),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffc56a).multiplyScalar(1.6)}));led.rotation.x=-Math.PI/2;led.position.y=.07;table.add(led);
 const marks=new THREE.Group();for(let i=0;i<48;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.03,.004,i%4?.12:.26),new THREE.MeshBasicMaterial({color:i%4?0x3a4148:0x8a7650}));const a=i/48*Math.PI*2;m.position.set(Math.sin(a)*3.12,.082,Math.cos(a)*3.12);m.rotation.y=a;marks.add(m);}table.add(marks);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:radial('#000000','#000000'),transparent:true,opacity:.75,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.085;table.add(shadow);
 const stage=new THREE.Group();stage.position.y=.08;table.add(stage);
 // Back wall with vertical light slats gives the reflections and the background some depth.
 const wall=new THREE.Group();scene.add(wall);
 for(let i=-6;i<=6;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.06,5.5,.06),new THREE.MeshBasicMaterial({color:new THREE.Color(i%3===0?0xffc56a:0x6f8796).multiplyScalar(i%3===0?.9:.45)}));slat.position.set(i*1.5,3.2,-11);wall.add(slat);}
 const wallPanel=new THREE.Mesh(new THREE.PlaneGeometry(40,9),new THREE.MeshStandardMaterial({color:0x101317,roughness:.8}));wallPanel.position.set(0,4,-11.2);wall.add(wallPanel);
 const camera=new THREE.PerspectiveCamera(30,1,.1,80);
 // Each step frames the car differently; `shift` moves it on screen (fraction of the viewport) to clear the side panel.
 const framings:Record<Framing,{pos:THREE.Vector3;look:THREE.Vector3;shift:[number,number]}>={
  hero:{pos:new THREE.Vector3(6.6,2.7,7.4),look:new THREE.Vector3(0,.85,0),shift:[.12,.1]},
  tune:{pos:new THREE.Vector3(7.4,3.0,4.6),look:new THREE.Vector3(0,.85,0),shift:[-.2,.02]},
  deploy:{pos:new THREE.Vector3(5.2,3.6,8.4),look:new THREE.Vector3(0,.7,0),shift:[-.2,.06]},
  side:{pos:new THREE.Vector3(8.6,3.4,4.4),look:new THREE.Vector3(0,.8,0),shift:[0,0]},
 };
 const pos=framings.hero.pos.clone(),look=framings.hero.look.clone(),shift=new THREE.Vector2(...framings.hero.shift);let spin=2.4,drag=0,last=0;
 return {
  scene,camera,stage,key,
  /** Fits the camera to the current vehicle footprint (half-length) and viewport. */
  update(now:number,framing:Framing,width:number,height:number,halfLength:number){
   const dt=Math.min(.1,last?(now-last)/1000:0),first=!last;last=now;
   const f=framings[framing],k=first?1:1-Math.exp(-dt*3.4),aspect=width/height,portrait=aspect<1;
   // Wider shots for longer vehicles and narrower screens; in portrait the panel sits below, so shift upwards instead.
   const scale=(.48+halfLength/2.2*.6)*(portrait?1.75:aspect<1.6?1.25:1.12);
   pos.lerp(f.pos.clone().multiplyScalar(scale),k);look.lerp(f.look,k);shift.lerp(portrait?new THREE.Vector2(0,.2):new THREE.Vector2(...f.shift),k);
   camera.position.copy(pos);camera.lookAt(look);camera.aspect=aspect;camera.setViewOffset(width,height,-shift.x*width,shift.y*height,width,height);camera.updateProjectionMatrix();
   spin+=dt*(.14+drag);drag*=Math.exp(-dt*2.2);table.rotation.y=spin;shadow.scale.set(2.9,halfLength*2.5,1);
  },

  /** Lets the player swipe the turntable. */
  nudge(amount:number){drag=THREE.MathUtils.clamp(drag+amount,-6,6);},
  setShadows(on:boolean){key.castShadow=on;},
 };
}
export type Showroom=ReturnType<typeof createShowroom>;
