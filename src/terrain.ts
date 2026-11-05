export let terrainStyle=0;
export function setTerrain(style:number){terrainStyle=style;}
const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
// Smooth plateaux and long access ramps: identical sampling for driving and rendering.
export function terrainHeight(x:number,z:number){
 const mound=(cx:number,cz:number,rx:number,rz:number,h:number)=>h*(1-smooth((Math.hypot((x-cx)/rx,(z-cz)/rz)-.25)/.75));
 const ripple=.12*Math.sin(x*.17)*Math.cos(z*.13);
 if(terrainStyle===1){const terrace=4*smooth((Math.abs(x)-17)/16);const rampCut=1-.7*Math.exp(-Math.pow((z+6)/13,2));return terrace*rampCut+mound(0,28,17,16,2.6)-mound(0,-17,15,15,1.1)+ripple*.3;}
 if(terrainStyle===2)return mound(-24,12,23,27,6.4)+mound(25,-19,23,25,5.8)+mound(9,32,22,17,3.2)-1.6*Math.exp(-Math.pow((x-5*Math.sin(z*.07))/7,2))+ripple;
 return mound(-29,-25,23,23,5.5)+mound(31,25,24,25,6.3)+mound(-21,7,19,22,5.1)+mound(22,-18,20,21,4.8)+mound(0,31,20,15,3.3)-1.5*Math.exp(-Math.pow((x+5*Math.sin(z*.08))/8,2))+ripple;
}
