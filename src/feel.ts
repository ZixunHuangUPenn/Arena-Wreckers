export const smoothing=(dt:number,rate=12)=>1-Math.exp(-Math.max(0,dt)*rate);
export function steeringGain(speed:number,maxSpeed:number){return 1-.22*Math.min(1,Math.abs(speed)/Math.max(1,maxSpeed));}
export function cornerSpeed(steer:number){return 1-.16*Math.min(1,Math.abs(steer));}
export function screenBearing(dx:number,dz:number){return Math.atan2(dx-dz,-(dx+dz));}
export function tacticalGoal(index:number,loadout:number,x:number,z:number,ex:number,ez:number,range:number){const dx=x-ex,dz=z-ez,n=Math.max(1,Math.hypot(dx,dz)),reach=loadout===1?7:range*.67,side=index%2?1:-1,flank=loadout===0||loadout===2?4:1.5;return {x:Math.max(-43,Math.min(43,ex+dx/n*reach-dz/n*flank*side)),z:Math.max(-43,Math.min(43,ez+dz/n*reach+dx/n*flank*side))};}
