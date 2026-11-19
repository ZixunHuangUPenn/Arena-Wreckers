// Vehicle dynamics: the numbers and small pure helpers behind the grip model in main.ts `moveCar`.
// Each car keeps a forward speed (`Car.speed`) and a sideways slip speed. Steering turns the body; the
// momentum stays in the world frame, so turning hard at speed puts some of it sideways, and tyre grip
// (per car, per surface, much lower on the handbrake) bleeds that slip away. Slopes push along the
// forward axis, the body leaves the ground when the ground falls away faster than gravity can follow,
// and car-to-car hits exchange momentum by mass.
import {mapLayout,fluidSurface,terrainHeight} from './terrain';
import {deckHeight} from './bridge';
import {angleDelta} from './handling';

/** Per-car chassis: mass (Kestrel = 1), sideways tyre grip (1/s), throttle response (1/s), sprung landing feel. */
export type Chassis={mass:number;grip:number;accel:number;bounce:number};
export const chassis:Chassis[]=[
 {mass:1,grip:15,accel:1.9,bounce:1.25},// Kestrel: light race car, sharp but easy to unsettle
 {mass:1.55,grip:13,accel:1.65,bounce:1},// Grapnel: pickup on stiff springs
 {mass:1.3,grip:10.5,accel:1.75,bounce:1.1},// Arclight: long-nosed muscle car, the tail steps out first
 {mass:2.3,grip:17,accel:1.4,bounce:.8},// Bombard: eight wheels, the most planted
 {mass:2.8,grip:12,accel:1.3,bounce:.7},// Bulwark: heavy rig, slides wide once it goes
];
/** Downward acceleration in m/s² (a little above 9.8 so jumps read quickly from the high camera). */
export const GRAVITY=20;
/** How much of gravity acts along a slope on the forward speed. */
export const SLOPE_PULL=11;
/** Grip multiplier while the handbrake is held, and how much quicker the body yaws. */
export const HANDBRAKE_GRIP=.22,HANDBRAKE_YAW=1.3;
/** Largest slip angle the steering can hold the body at (rad): normal driving, and on the handbrake. Past it the tail stops swinging further out. */
export const SLIP_LIMIT=.5,DRIFT_LIMIT=.75;
/** Fastest reverse, m/s. */
export const REVERSE_SPEED=5.5;
/** Height above the ground (m) at which a car counts as airborne: no drive, no steering, no tyre marks. */
export const AIR_GAP=.35;
/** Car-to-car restitution: 0 sticks, 1 is a perfect bounce. */
export const RESTITUTION=.8;
/** Skill cooldown recovered per second of drifting, as a fraction of real time. */
export const DRIFT_CHARGE=.35;

/** Tyre grip factor of the ground at a point: bridge decks and foundry plate grip best, sand and snow less, frozen lakes very little. */
export function surfaceGrip(x:number,z:number,y:number){const deck=deckHeight(x,z);if(deck!==null&&y>deck-1.4)return 1.05;
 const f=fluidSurface(x,z);if(f&&f.fluid==='ice'&&f.level>=terrainHeight(x,z)-.05)return .3;
 return [.84,1,.72,.94][mapLayout().style]??1;}

/** Grip-limited sideways slip: rotates the momentum into the new heading, then lets the tyres bleed the slip. */
export function turnMomentum(speed:number,lat:number,turned:number){const c=Math.cos(turned),s=Math.sin(turned);return {speed:speed*c-lat*s,lat:speed*s+lat*c};}
/**
 * Scales a yaw step so steering cannot wind the body round past `limit` of slip: yaw that would increase the slip
 * fades out over the last 40% before the limit (the tail stops stepping out further), yaw that reduces it is untouched.
 */
export function slipYaw(yaw:number,speed:number,lat:number,limit:number){const slip=Math.atan2(Math.abs(lat),Math.abs(speed)+.5);if(lat!==0&&yaw*lat*(speed<0?-1:1)>0)return yaw*Math.min(1,Math.max(.1,(limit-slip)/(limit*.4)));return yaw;}
export function bleedSlip(lat:number,grip:number,dt:number){return lat*Math.exp(-grip*dt);}

/** Acceleration along the car's forward axis from a slope of `rise` metres over 1 m (positive = nose up). */
export function slopeAcceleration(rise:number){return -SLOPE_PULL*rise/Math.sqrt(1+rise*rise);}

/**
 * Velocity change along the contact normal for two bodies, from the closing speed `closing` (negative when they
 * approach). Returns the change for each body along the normal that points from b to a.
 */
export function collisionImpulse(ma:number,mb:number,closing:number,restitution=RESTITUTION){if(closing>=0)return {a:0,b:0};const j=-(1+restitution)*closing/(1/ma+1/mb);return {a:j/ma,b:-j/mb};}

/**
 * Screen-direction driving with reverse: holding the stick within `cone` of straight behind the car for
 * `hold` seconds switches to reversing towards it instead of swinging round; pushing it back past the side
 * (`release`) drives forwards again. `turn` is the steer input for moveCar, `throttle` is signed.
 */
export type ReverseState={hold:number;reversing:boolean};
export const REVERSE_CONE=50*Math.PI/180,REVERSE_HOLD=.25,REVERSE_RELEASE=80*Math.PI/180;
export function screenDrive(state:ReverseState,heading:number,angle:number,speed:number,magnitude:number,dt:number){
 if(magnitude<=.12){state.hold=0;state.reversing=false;return {turn:0,throttle:0};}
 const ahead=angleDelta(heading,angle),behind=angleDelta(heading,angle+Math.PI);
 if(!state.reversing){state.hold=Math.abs(behind)<REVERSE_CONE?state.hold+dt:0;if(state.hold>=REVERSE_HOLD-1e-9)state.reversing=true;}
 else if(Math.abs(ahead)<Math.PI-REVERSE_RELEASE){state.reversing=false;state.hold=0;}
 // moveCar mirrors the yaw while rolling backwards; flipping the input here keeps the body turning the way the stick asks.
 const flip=speed<-.5?-1:1,clamp=(v:number)=>Math.max(-1,Math.min(1,v));
 return state.reversing?{turn:clamp(-behind*2)*flip,throttle:-magnitude}:{turn:clamp(-ahead*2)*flip,throttle:Math.min(1,magnitude)};}

/**
 * Touch auto-drift: there is no drift button on a phone, so a sudden hard turn at speed pulls the handbrake.
 * It starts when the stick points at least `start` (rad) away from the nose while the car runs at `speed` of its
 * top speed or more, so a gentle sweep that the car keeps up with never slides. Once sliding it holds for at least
 * `min` seconds, then lets go when the nose is back within `keep` of the stick or the car has slowed below `keepSpeed`.
 */
export const AUTO_DRIFT={speed:.6,start:.7,keep:.28,keepSpeed:.3,min:.3};
export type AutoDriftState={on:boolean;time:number};
/** `error` is the angle between stick and nose (rad), `ratio` the forward speed over top speed; returns whether to hold the handbrake. */
export function autoDrift(state:AutoDriftState,error:number,ratio:number,dt:number,reversing=false){const a=AUTO_DRIFT,e=Math.abs(error);
 if(reversing||ratio<=0){state.on=false;state.time=0;return false;}
 if(!state.on){if(ratio>=a.speed&&e>=a.start){state.on=true;state.time=0;}}
 else{state.time+=dt;if(state.time>=a.min&&(e<a.keep||ratio<a.keepSpeed)){state.on=false;state.time=0;}}
 return state.on;}
