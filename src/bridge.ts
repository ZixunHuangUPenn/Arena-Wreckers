import * as THREE from 'three';
import {terrainHeight} from './terrain';
import type {Rect} from './physics';
export const BRIDGE={z:34,halfWidth:4,span:12,end:38,height:9};
export function deckHeight(x:number,z:number){const b=BRIDGE,a=Math.abs(x);if(Math.abs(z-b.z)>b.halfWidth||a>b.end)return null;const t=Math.max(0,(a-b.span)/(b.end-b.span));return b.height*(1-t)+terrainHeight(Math.sign(x)*b.end,z)*t;}
export function driveHeight(x:number,z:number,previousY:number){const deck=deckHeight(x,z);return deck!==null&&(Math.abs(x)>BRIDGE.span||previousY>deck-2.5)?deck:terrainHeight(x,z);}
export function bridgeHit(x:number,y:number,z:number,dx:number,dy:number,dz:number){for(let i=0;i<=16;i++){const t=i/16,h=deckHeight(x+dx*t,z+dz*t);if(h!==null&&y+dy*t>=h-.45&&y+dy*t<=h+.12)return t;}return null;}
export function buildBridge(world:THREE.Group):Rect[]{const b=BRIDGE,steel=new THREE.MeshStandardMaterial({color:0x77817a,metalness:.65,roughness:.65}),yellow=new THREE.MeshStandardMaterial({color:0xc5ad58,roughness:.8}),parts:Rect[]=[];
 const vertices:number[]=[],indices:number[]=[];for(let i=0;i<=76;i++){const x=-38+i;for(const z of [b.z-4,b.z+4])vertices.push(x,deckHeight(x,z)!,z);if(i){const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((_,i)=>i%3===0?[vertices[i]/8,vertices[i+2]/8]:[]),2));g.setIndex(indices);g.computeVertexNormals();steel.side=THREE.DoubleSide;const deck=new THREE.Mesh(g,steel);deck.receiveShadow=deck.castShadow=true;world.add(deck);
 const box=(x:number,z:number,w:number,d:number,bottom:number,top:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,top-bottom,d),m);mesh.position.set(x,(top+bottom)/2,z);mesh.castShadow=mesh.receiveShadow=true;world.add(mesh);parts.push({x,z,hx:w/2,hz:d/2,angle:0,minY:bottom,maxY:top});};
 for(const x of [-10,10])for(const z of [b.z-5,b.z+5])box(x,z,1,1,terrainHeight(x,z),b.height,steel);
 for(let x=-37;x<=37;x+=2){for(const z of [b.z-4.1,b.z+4.1]){const h=deckHeight(x,b.z)!;box(x,z,2,.3,h,h+.65,Math.floor(x)%3===0?yellow:steel);}}
 return parts;
}
