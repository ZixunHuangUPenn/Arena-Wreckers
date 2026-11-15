// AI difficulty profiles. Each level tunes enemy and allied AI separately, so
// teammates pull their weight on every level and only enemies get harder.
export type Difficulty='easy'|'normal'|'hard';
export type AiTuning={damage:number;hp:number;aimError:number;lead:number;reaction:number;fireRate:number;vision:number;sharedIntel:boolean};
export const difficultyTuning:Record<Difficulty,{enemy:AiTuning;ally:AiTuning;horde:number}>={
 easy:{enemy:{damage:.6,hp:.8,aimError:.22,lead:0,reaction:.85,fireRate:.7,vision:.9,sharedIntel:false},ally:{damage:1.3,hp:1.25,aimError:.03,lead:1,reaction:.15,fireRate:1.1,vision:1.1,sharedIntel:true},horde:.8},
 normal:{enemy:{damage:.85,hp:1,aimError:.12,lead:.4,reaction:.5,fireRate:.85,vision:1,sharedIntel:true},ally:{damage:1.15,hp:1.15,aimError:.05,lead:.9,reaction:.25,fireRate:1,vision:1.05,sharedIntel:true},horde:1},
 hard:{enemy:{damage:1.15,hp:1.15,aimError:.05,lead:.85,reaction:.25,fireRate:1,vision:1.05,sharedIntel:true},ally:{damage:1,hp:1,aimError:.07,lead:.7,reaction:.3,fireRate:1,vision:1,sharedIntel:true},horde:1.2}};
export function aiTuning(level:string,ally:boolean):AiTuning{const set=difficultyTuning[(level in difficultyTuning?level:'normal') as Difficulty];return ally?set.ally:set.enemy;}
// Turret heading for an AI gunner: leads a moving target by `lead` (0..1) and adds a slow, per-car wobble scaled by aimError (radians).
export function aiAim(sx:number,sz:number,tx:number,tz:number,vx:number,vz:number,shotSpeed:number,lead:number,aimError:number,time:number,seed:number){const t=shotSpeed>0?Math.min(1.5,Math.hypot(tx-sx,tz-sz)/shotSpeed):0;const px=tx+vx*t*lead,pz=tz+vz*t*lead;return Math.atan2(sx-px,sz-pz)+aimError*(Math.sin(time*1.9+seed*2.1)*.7+Math.sin(time*4.3+seed)*.3);}
