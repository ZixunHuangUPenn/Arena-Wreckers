// Top-down terrain map, baked from the terrain generator: hill shading, contour lines, cliffs, fluids and bridges.
// The same bake feeds the in-match minimap and the terrain preview on the arena select page.
import {terrainHeight,fluidSurface,terrainBlocked,mapLayout,ARENA,type Fluid} from './terrain';

type RGB=[number,number,number];
/** Ground colours per arena style: low ground, high ground, cliff face. */
const palettes:{low:RGB;high:RGB;cliff:RGB}[]=[
 {low:[120,92,62],high:[214,178,124],cliff:[92,62,44]},     // sandstone
 {low:[70,78,80],high:[150,158,152],cliff:[48,52,54]},      // foundry
 {low:[150,170,190],high:[236,244,250],cliff:[92,108,124]}, // frost
 {low:[52,40,38],high:[128,96,82],cliff:[34,24,22]},        // caldera
];
const fluidColors:Record<Fluid,RGB>={water:[46,120,178],lava:[255,104,32],ice:[188,226,242],toxic:[118,196,70],molten:[255,138,42]};
const mix=(a:RGB,b:RGB,t:number):RGB=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

/** Bakes the active layout into a square canvas (null where 2D canvas is unavailable, e.g. in tests). */
export function bakeTerrainMap(style:number,size=176){
 if(typeof document==='undefined'||typeof document.createElement!=='function')return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext?.('2d');if(!ctx||typeof ctx.createImageData!=='function')return null;
 const pal=palettes[style]??palettes[0],step=ARENA*2/size,world=(p:number)=>-ARENA+(p+.5)*step;
 const heights=new Float32Array(size*size);let lo=Infinity,hi=-Infinity;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const h=terrainHeight(world(i),world(j));heights[j*size+i]=h;if(h<lo)lo=h;if(h>hi)hi=h;}
 const span=Math.max(1,hi-lo),image=ctx.createImageData(size,size),px=image.data;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const k=j*size+i,h=heights[k],x=world(i),z=world(j);
  const hx=heights[j*size+Math.min(size-1,i+1)]-heights[j*size+Math.max(0,i-1)],hz=heights[Math.min(size-1,j+1)*size+i]-heights[Math.max(0,j-1)*size+i];
  // Light from the north-west, like a printed relief map.
  const shade=Math.max(.45,Math.min(1.35,1-(hx+hz)/(step*2)*.55));
  let c=mix(pal.low,pal.high,Math.pow((h-lo)/span,.8));
  const blocked=terrainBlocked(x,z),fluid=fluidSurface(x,z);
  if(fluid&&fluid.level>h-.02){const f=fluidColors[fluid.fluid]??fluidColors.water,depth=Math.min(1,(fluid.level-h)/2);c=mix(f,mix(f,[10,20,30],.45),fluid.fluid==='lava'||fluid.fluid==='molten'?0:depth);}
  else{if(blocked)c=mix(c,pal.cliff,.7);c=[c[0]*shade,c[1]*shade,c[2]*shade];
   // Contour every 2 m.
   const band=Math.floor(h/2);if(i>0&&j>0&&(Math.floor(heights[k-1]/2)!==band||Math.floor(heights[k-size]/2)!==band))c=mix(c,[0,0,0],.18);}
  const o=k*4;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=255;}
 ctx.putImageData(image,0,0);
 // Bridges as light decks with dark rails.
 const scale=size/(ARENA*2);
 for(const b of mapLayout().bridges){ctx.save();ctx.translate((b.x+ARENA)*scale,(b.z+ARENA)*scale);ctx.rotate(b.angle);ctx.fillStyle='#1b1d20';ctx.fillRect(-b.half*scale-1,-b.halfWidth*scale-1,b.half*2*scale+2,b.halfWidth*2*scale+2);ctx.fillStyle=b.over?'#e8d9a8':'#c9ccc8';ctx.fillRect(-b.half*scale,-b.halfWidth*scale,b.half*2*scale,b.halfWidth*2*scale);ctx.restore();}
 return canvas;
}

/** Feature list of the active layout for the arena details ("峡谷 · 2 座桥 · 湖泊"). */
export function layoutFeatures(){return mapLayout().name.split(' · ').filter(Boolean);}
/** Team bases of the active layout, in world coordinates (team 0 first). */
export function layoutSpawns(){return mapLayout().spawns;}
