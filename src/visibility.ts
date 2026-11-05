import {segmentHit,type Rect} from './physics';
export function hasSight(x:number,z:number,tx:number,tz:number,radius:number,cover:Rect[]){return Math.hypot(tx-x,tz-z)<=radius&&!cover.some(r=>segmentHit(x,z,tx-x,tz-z,r,0)!==null);}
export function projectileStep(speed:number,remaining:number,dt:number){const distance=Math.max(0,Math.min(remaining,speed*dt));return {distance,time:speed>0?distance/speed:0,remaining:Math.max(0,remaining-distance)};}
