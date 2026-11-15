import {segmentHit,type Rect} from './physics';
export function hasSight(x:number,z:number,tx:number,tz:number,radius:number,cover:Rect[]){return Math.hypot(tx-x,tz-z)<=radius&&!cover.some(r=>segmentHit(x,z,tx-x,tz-z,r,0)!==null);}
// High ground sees further: +6% range per metre above the target (up to +50%), and a car down in a hollow sees up to 20% less.
export function sightRange(base:number,viewerY:number,targetY:number){return base*Math.max(.8,Math.min(1.5,1+(viewerY-targetY)*.06));}
export function projectileStep(speed:number,remaining:number,dt:number){const distance=Math.max(0,Math.min(remaining,speed*dt));return {distance,time:speed>0?distance/speed:0,remaining:Math.max(0,remaining-distance)};}
