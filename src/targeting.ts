// Weapon targeting maths shared by the player's auto-aim and the AI gunners: intercept (lead) solving,
// target scoring toward where the gun points, a sticky lock that does not flicker between enemies,
// and measured target velocities that work whatever the driving model does.

/** Headings follow `car.aim`: 0 faces −z, and a heading h points along (−sin h, −cos h). */
export const headingTo=(sx:number,sz:number,tx:number,tz:number)=>Math.atan2(sx-tx,sz-tz);
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

/** Tuning for the player's targeting. Angles in radians, times in seconds. */
export const AIM={
 /** Enemies inside this half-angle of the gun (or aim stick, mouse, or driving direction) are strongly preferred. */
 cone:.62,
 /** A locked target keeps this score bonus, so another enemy must be clearly better to take the lock. */
 sticky:.9,
 /** ...and stay clearly better for this long. */
 switchDelay:.35,
 /** A target the player picked by hand stays chosen this long while it is out of sight or range. */
 manualGrace:2.5,
 /** Hand aiming (aim stick or mouse) within this angle of a target snaps to its lead point. */
 assist:.14,
 /** Longest lead the solver will predict; beyond it the target's path is a guess anyway. */
 maxLead:2.2,
};

/**
 * Flight time for a shot of horizontal speed `speed` fired from (sx,sz) to meet a target at (tx,tz)
 * moving at (vx,vz). Solves |d + v·t| = speed·t; with no real solution (target outrunning the shot)
 * it falls back to the straight-line time. Capped at `maxTime`.
 */
export function interceptTime(sx:number,sz:number,tx:number,tz:number,vx:number,vz:number,speed:number,maxTime=AIM.maxLead){
 const dx=tx-sx,dz=tz-sz,straight=Math.hypot(dx,dz)/Math.max(.001,speed);if(speed<=0)return 0;
 const a=vx*vx+vz*vz-speed*speed,b=2*(dx*vx+dz*vz),c=dx*dx+dz*dz;let t:number;
 if(Math.abs(a)<1e-6)t=b<0?-c/b:straight;
 else{const disc=b*b-4*a*c;if(disc<0)t=straight;else{const r=Math.sqrt(disc),t1=(-b-r)/(2*a),t2=(-b+r)/(2*a),lo=Math.min(t1,t2),hi=Math.max(t1,t2);t=lo>0?lo:hi>0?hi:straight;}}
 return Math.max(0,Math.min(maxTime,t));
}
/** Where to aim so a shot meets the target. `lead` scales the prediction (1 = full, 0 = aim at the car). */
export function leadPoint(sx:number,sz:number,tx:number,tz:number,vx:number,vz:number,speed:number,lead=1){
 const t=interceptTime(sx,sz,tx,tz,vx*lead,vz*lead,speed);const x=tx+vx*lead*t,z=tz+vz*lead*t;
 return {x,z,time:t,distance:Math.hypot(x-sx,z-sz),angle:headingTo(sx,sz,x,z)};
}

/** How much the player probably wants this target; higher is better. `off` is the angle from the reference heading. */
export function targetScore(o:{off:number;distance:number;range:number;hp:number;threat:boolean;locked:boolean}){
 return (o.off<=AIM.cone?2:0)-o.off*1.3-o.distance/Math.max(1,o.range)+(1-Math.max(0,Math.min(1,o.hp)))*.5+(o.threat?.55:0)+(o.locked?AIM.sticky:0);
}
/** Angle between a reference heading and the bearing to a point. */
export function offAngle(heading:number,sx:number,sz:number,tx:number,tz:number){return Math.abs(wrap(headingTo(sx,sz,tx,tz)-heading));}

/**
 * Sticky target lock. Feed it the scored candidates each tick; it keeps its target until the target is
 * gone or another candidate has out-scored it (sticky bonus included) for `switchDelay` seconds.
 * A manual pick holds through short losses of sight and is never replaced automatically.
 */
export class TargetLock<T>{
 target:T|null=null;manual=false;
 /** Seconds since the target was (re)acquired, for the lock-on animation. */
 age=0;
 private challenger:T|null=null;private challenge=0;private missing=0;
 /** Returns the target to shoot this tick (null when none is usable). */
 update(candidates:{item:T;score:number}[],dt:number):T|null{
  this.age+=dt;const best=candidates.reduce<{item:T;score:number}|null>((a,b)=>!a||b.score>a.score?b:a,null);
  const current=this.target===null?undefined:candidates.find(c=>c.item===this.target);
  if(current){this.missing=0;
   if(!this.manual&&best&&best.item!==current.item&&best.score>current.score){if(this.challenger!==best.item){this.challenger=best.item;this.challenge=0;}this.challenge+=dt;if(this.challenge>=AIM.switchDelay)this.set(best.item,false);}
   else{this.challenger=null;this.challenge=0;}
   return this.target;}
  if(this.target!==null&&this.manual){this.missing+=dt;if(this.missing<AIM.manualGrace)return best?.item??null;}
  this.set(best?.item??null,false);return this.target;}
 /** The player chose this target by hand. */
 pick(item:T){this.set(item,true);}
 /** Moves the lock to the next candidate clockwise from the current one (Tab on desktop). */
 cycle(ordered:T[]){if(!ordered.length)return;const i=this.target===null?-1:ordered.indexOf(this.target);this.set(ordered[(i+1)%ordered.length],true);}
 /** Hands the choice back to auto-aim; the current target stays until something better comes along. */
 release(){this.manual=false;this.missing=0;}
 clear(){this.set(null,false);}
 private set(item:T|null,manual:boolean){if(item!==this.target)this.age=0;this.target=item;this.manual=item!==null&&manual;this.challenger=null;this.challenge=0;this.missing=0;}
}

/** Measures each object's ground velocity from its position every tick, lightly smoothed. */
export class VelocityTracker<T>{
 private seen=new Map<T,{x:number;z:number;vx:number;vz:number}>();
 sample(key:T,x:number,z:number,dt:number){const s=this.seen.get(key);if(!s||dt<=0){this.seen.set(key,{x,z,vx:s?.vx??0,vz:s?.vz??0});return;}
  let vx=(x-s.x)/dt,vz=(z-s.z)/dt;// a respawn or teleport is not motion
  if(Math.hypot(vx,vz)>60){s.vx=s.vz=0;s.x=x;s.z=z;return;}const k=1-Math.exp(-dt*14);s.vx+=(vx-s.vx)*k;s.vz+=(vz-s.vz)*k;s.x=x;s.z=z;}
 get(key:T){const s=this.seen.get(key);return {x:s?.vx??0,z:s?.vz??0};}
 forget(key:T){this.seen.delete(key);}
 clear(){this.seen.clear();}
}

/** Upward speed that makes a lobbed shell (horizontal speed `speed`, gravity `g`) cover `distance` and land `rise` higher. */
export function lobSpeed(distance:number,speed:number,g:number,rise=0){const t=Math.max(.2,distance/Math.max(.001,speed));return g*t/2+rise/t;}
/** Points along a lobbed shell's flight, for drawing the arc. */
export function lobPath(x:number,y:number,z:number,heading:number,distance:number,speed:number,g:number,vy:number,steps=16){
 const fx=-Math.sin(heading),fz=-Math.cos(heading),time=Math.max(.2,distance/Math.max(.001,speed)),out:{x:number;y:number;z:number}[]=[];
 for(let i=0;i<=steps;i++){const t=time*i/steps;out.push({x:x+fx*speed*t,y:y+vy*t-.5*g*t*t,z:z+fz*speed*t});}return out;
}
