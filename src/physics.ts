export type Rect={x:number;z:number;hx:number;hz:number;angle:number;minY?:number;maxY?:number};
export function overlaps(a:Rect,b:Rect){
 if((a.maxY??Infinity)<=(b.minY??-Infinity)||(b.maxY??Infinity)<=(a.minY??-Infinity))return false;
 const axes=[a.angle,b.angle].flatMap(t=>[[Math.cos(t),-Math.sin(t)],[Math.sin(t),Math.cos(t)]]);
 for(const [x,z] of axes){const radius=(r:Rect)=>r.hx*Math.abs(x*Math.cos(r.angle)-z*Math.sin(r.angle))+r.hz*Math.abs(x*Math.sin(r.angle)+z*Math.cos(r.angle));if(Math.abs((b.x-a.x)*x+(b.z-a.z)*z)>=radius(a)+radius(b)-.00001)return false;}return true;
}
// Slab intersection: earliest impact along a swept projectile, including its radius.
export function segmentHit(x:number,z:number,dx:number,dz:number,r:Rect,padding=.16){
 const c=Math.cos(r.angle),s=Math.sin(r.angle);const p=[(x-r.x)*c-(z-r.z)*s,(x-r.x)*s+(z-r.z)*c],d=[dx*c-dz*s,dx*s+dz*c],h=[r.hx+padding,r.hz+padding];let lo=0,hi=1;
 for(let i=0;i<2;i++){if(Math.abs(d[i])<1e-9){if(Math.abs(p[i])>h[i])return null;}else{let a=(-h[i]-p[i])/d[i],b=(h[i]-p[i])/d[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return null;}}return lo;
}
