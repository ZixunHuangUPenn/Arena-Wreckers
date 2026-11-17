export type Mode='team'|'capture'|'elimination'|'horde'|'ctf'|'charge';
/** Capture zone centres; the terrain generator moves them with each layout. */
export const capturePoints:{x:number;z:number}[]=[{x:-25,z:4},{x:0,z:10},{x:26,z:-4}];
/** Capture zone radius (m) and the seconds a team needs alone in a neutral zone to take it. */
export const CAPTURE_RADIUS=10,CAPTURE_TIME=3;
/** Elimination: in the last ZONE_TIME seconds a safe circle closes from ZONE_START to ZONE_END metres, reaching it ZONE_HOLD seconds before time. */
export const ZONE_TIME=60,ZONE_HOLD=10,ZONE_START=120,ZONE_END=14,ZONE_DPS=14;
export class Match {
 mode:Mode; time=180; scores=[0,0]; winner:number|null=null;ended=false;
 points=capturePoints.map(p=>({x:p.x,z:p.z,owner:-1,progress:0,rate:0}));
 /** Centre of the closing circle in elimination; the game sets it to a drivable spot near the middle of the arena. */
 zoneCentre={x:0,z:0};
 /** Radius of the safe circle, or Infinity while it is not closing. */
 zoneRadius(){if(this.mode!=='elimination'||this.time>ZONE_TIME)return Infinity;return ZONE_END+(ZONE_START-ZONE_END)*Math.max(0,(this.time-ZONE_HOLD)/(ZONE_TIME-ZONE_HOLD));}
 /** True where a car is outside the safe circle and takes damage. */
 outsideZone(x:number,z:number){return Math.hypot(x-this.zoneCentre.x,z-this.zoneCentre.z)>this.zoneRadius();}
 /** Seconds until `team` takes point `i` if nothing changes, or null when that team is not capturing it right now. */
 captureCountdown(i:number,team:number){const p=this.points[i],dir=team===0?1:-1;return p&&p.rate===dir&&p.owner!==team?CAPTURE_TIME-dir*p.progress:null;}
 constructor(mode:Mode){this.mode=mode;if(mode==='horde')this.time=600;}
 kill(team:number){if(['capture','ctf','charge'].includes(this.mode))return;this.scores[team]++;if(this.mode==='team'&&this.scores[team]>=20)this.finish(team);}
 finish(winner:number){this.winner=winner;this.ended=true;}
 update(dt:number,cars:{alive:boolean;team:number;hp:number;x:number;z:number}[]){if(this.ended)return;this.time=Math.max(0,this.time-dt);
 if(this.mode==='capture')for(const p of this.points){const blue=cars.some(c=>c.alive&&c.team===0&&Math.hypot(c.x-p.x,c.z-p.z)<CAPTURE_RADIUS),red=cars.some(c=>c.alive&&c.team===1&&Math.hypot(c.x-p.x,c.z-p.z)<CAPTURE_RADIUS);p.rate=blue===red?0:blue?1:-1;if(blue!==red){const dir=blue?1:-1;p.progress=Math.max(-CAPTURE_TIME,Math.min(CAPTURE_TIME,p.progress+dir*dt));if(p.progress===CAPTURE_TIME)p.owner=0;else if(p.progress===-CAPTURE_TIME)p.owner=1;else if((p.owner===0&&p.progress<=0)||(p.owner===1&&p.progress>=0))p.owner=-1;}if(p.owner>=0)this.scores[p.owner]+=dt;}
 if(this.mode==='capture'&&Math.max(...this.scores)>=200)this.finish(this.scores[0]>=200?0:1);
 if(this.mode==='elimination'){const alive=[0,1].map(t=>cars.filter(c=>c.alive&&c.team===t).length);if(!alive[0]||!alive[1])this.finish(alive[0]===alive[1]?-1:alive[0]?0:1);}
 if(this.time===0&&this.mode==='horde'){this.finish(1);return;}if(this.time===0&&!this.ended){const value=this.mode==='elimination'?[0,1].map(t=>cars.filter(c=>c.alive&&c.team===t).reduce((s,c)=>s+1000+c.hp,0)):this.scores;this.finish(value[0]===value[1]?-1:value[0]>value[1]?0:1);}
 }
}
