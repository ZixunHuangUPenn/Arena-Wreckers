export type Mode='team'|'capture'|'elimination'|'horde'|'ctf'|'charge';
export class Match {
 mode:Mode; time=180; scores=[0,0]; winner:number|null=null;ended=false;
 points=[{x:-25,z:4,owner:-1,progress:0},{x:0,z:10,owner:-1,progress:0},{x:26,z:-4,owner:-1,progress:0}];
 constructor(mode:Mode){this.mode=mode;if(mode==='horde')this.time=600;}
 kill(team:number){if(['capture','ctf','charge'].includes(this.mode))return;this.scores[team]++;if(this.mode==='team'&&this.scores[team]>=20)this.finish(team);}
 finish(winner:number){this.winner=winner;this.ended=true;}
 update(dt:number,cars:{alive:boolean;team:number;hp:number;x:number;z:number}[]){if(this.ended)return;this.time=Math.max(0,this.time-dt);
 if(this.mode==='capture')for(const p of this.points){const blue=cars.some(c=>c.alive&&c.team===0&&Math.hypot(c.x-p.x,c.z-p.z)<5),red=cars.some(c=>c.alive&&c.team===1&&Math.hypot(c.x-p.x,c.z-p.z)<5);if(blue!==red){const dir=blue?1:-1;p.progress=Math.max(-3,Math.min(3,p.progress+dir*dt));if(p.progress===3)p.owner=0;else if(p.progress===-3)p.owner=1;else if((p.owner===0&&p.progress<=0)||(p.owner===1&&p.progress>=0))p.owner=-1;}if(p.owner>=0)this.scores[p.owner]+=dt;}
 if(this.mode==='capture'&&Math.max(...this.scores)>=200)this.finish(this.scores[0]>=200?0:1);
 if(this.mode==='elimination'){const alive=[0,1].map(t=>cars.filter(c=>c.alive&&c.team===t).length);if(!alive[0]||!alive[1])this.finish(alive[0]===alive[1]?-1:alive[0]?0:1);}
 if(this.time===0&&this.mode==='horde'){this.finish(1);return;}if(this.time===0&&!this.ended){const value=this.mode==='elimination'?[0,1].map(t=>cars.filter(c=>c.alive&&c.team===t).reduce((s,c)=>s+1000+c.hp,0)):this.scores;this.finish(value[0]===value[1]?-1:value[0]>value[1]?0:1);}
 }
}
