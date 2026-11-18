// Procedural game audio. Everything is synthesised with the Web Audio API at run time, so the
// game ships no sound files and has no licensing to track.
//
// Signal flow: every voice -> (optional StereoPanner) -> one of four buses -> master -> compressor -> speakers.
//   engines   : the player's engine (kept quiet) plus a small pool of positional enemy engines
//   sfx       : guns, impacts, crashes, explosions, skills, pickups, UI
//   ambience  : arena wind/bed and distant battlefield events
//   reverb    : a short synthetic room/valley tail that explosions and distant events send into
// The compressor glues everything and stops stacked explosions from clipping on phone speakers.

import {ArenaMusic} from './music';

export type EngineSource={x:number;z:number;revs:number;boost:boolean;loadout:number;alive:boolean};

/** Base engine pitch (Hz at idle), pitch range and brightness per vehicle (mantis, punisher, retro, pummeler, bigrig). */
const ENGINE_PROFILES=[
 {idle:58,range:96,bright:1.25,chug:.18},
 {idle:44,range:70,bright:1,chug:.26},
 {idle:50,range:82,bright:1.1,chug:.22},
 {idle:38,range:58,bright:.85,chug:.32},
 {idle:31,range:44,bright:.72,chug:.38},
];
/** Per-arena ambience: wind level, wind colour (Hz), low bed level and an optional special texture. */
const ARENA_AMBIENCE=[
 {wind:.045,windHz:520,bed:.006,texture:'none'},
 {wind:.03,windHz:380,bed:.01,texture:'metal'},
 {wind:.1,windHz:900,bed:.004,texture:'none'},
 {wind:.03,windHz:300,bed:.014,texture:'lava'},
] as const;
export type MenuSound='car'|'weapon'|'paint'|'upgrade'|'mode'|'arena'|'reroll'|'deny'|'pick';
const ENEMY_VOICES=4,HEARING=34;

type EngineVoice={osc:OscillatorNode[];filter:BiquadFilterNode;chug:OscillatorNode;chugDepth:GainNode;gain:GainNode;pan:StereoPannerNode|null;loadout:number};

/** Screen-space pan for the diagonal top-down camera: screen-right is the world direction (1,0,-1)/sqrt(2). */
export function screenPan(dx:number,dz:number){return Math.max(-1,Math.min(1,(dx-dz)*Math.SQRT1_2/18));}
/** Distance attenuation shared by every positional sound. */
export function falloff(distance:number,reach=14){return 1/(1+distance/reach);}
/** Target gain of the player's own engine: deliberately low so combat and enemy engines stay audible. */
export function playerEngineLevel(revs:number,boost:boolean){return .011+.013*Math.min(1,revs)+(boost?.006:0);}

export class GameAudio{
 ctx:AudioContext|null=null;
 muted=false;
 volume=.65;
 private master!:GainNode;private engines!:GainNode;private sfx!:GainNode;private ambience!:GainNode;private reverb!:ConvolverNode;private reverbSend!:GainNode;
 private noise!:AudioBuffer;private decayNoise!:AudioBuffer;
 private player:EngineVoice|null=null;private enemies:EngineVoice[]=[];
 private wind:{source:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode;lfo:OscillatorNode}|null=null;
 private bed:{osc:OscillatorNode[];gain:GainNode}|null=null;
 private arena=0;private listenerX=0;private listenerZ=0;private nextDistant=3;private nextTexture=2;private intensity=0;private crashCooldown=0;private music:ArenaMusic|null=null;private musicVolume=.6;private active=false;

 /** Create the context lazily from a user gesture (required by iOS Safari). */
 start(){if(!this.ctx){try{const Ctor=(globalThis as any).AudioContext??(globalThis as any).webkitAudioContext;if(!Ctor)return;this.ctx=new Ctor() as AudioContext;this.build();}catch{this.ctx=null;return;}}void this.ctx.resume?.();}
 suspend(){void this.ctx?.suspend?.();}
 resume(){void this.ctx?.resume?.();}
 setVolume(percent:number){this.volume=Math.max(0,Math.min(1,percent/100));this.applyMaster();}
 setMuted(value:boolean){this.muted=value;this.applyMaster();}
 setArena(index:number){this.arena=Math.max(0,Math.min(ARENA_AMBIENCE.length-1,index|0));this.applyAmbience();}
 /** Whether the battle is running; ambience and engines fade out in menus and pauses. */
 setActive(value:boolean){this.active=value;this.applyAmbience();}
 /** In-match music (see ./music): volume 0..100, start with the arena's track, fade out at match end. */
 setMusicVolume(percent:number){this.musicVolume=Math.max(0,Math.min(1,percent/100));this.music?.setVolume(percent);}
 startMusic(arena:number){this.music?.start(arena);}
 stopMusic(){this.music?.stop();}
 setListener(x:number,z:number){this.listenerX=x;this.listenerZ=z;}

 private applyMaster(){if(!this.ctx)return;this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.05);}
 private build(){const ctx=this.ctx!;
  const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=10;compressor.ratio.value=5;compressor.attack.value=.004;compressor.release.value=.22;compressor.connect(ctx.destination);
  this.master=ctx.createGain();this.master.connect(compressor);this.applyMaster();
  const bus=(level:number)=>{const g=ctx.createGain();g.gain.value=level;g.connect(this.master);return g;};
  this.engines=bus(1);this.sfx=bus(1);this.ambience=bus(1);
  const length=Math.floor(ctx.sampleRate*1.2);this.noise=ctx.createBuffer(1,length,ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
  const decay=Math.floor(ctx.sampleRate*1.5);this.decayNoise=ctx.createBuffer(1,decay,ctx.sampleRate);const d=this.decayNoise.getChannelData(0);for(let i=0;i<decay;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/decay,1.6);
  // Synthetic stereo impulse response: decaying noise with a darker tail, about 1.6 s.
  const irLength=Math.floor(ctx.sampleRate*1.6),ir=ctx.createBuffer(2,irLength,ctx.sampleRate);for(let c=0;c<2;c++){const ch=ir.getChannelData(c);let lp=0;for(let i=0;i<irLength;i++){const t=i/irLength;lp+=((Math.random()*2-1)-lp)*(.5-.42*t);ch[i]=lp*Math.pow(1-t,2.4)*(i<ctx.sampleRate*.012?0:1);}}
  this.reverb=ctx.createConvolver();this.reverb.buffer=ir;this.reverbSend=ctx.createGain();this.reverbSend.gain.value=.55;this.reverbSend.connect(this.reverb);this.reverb.connect(this.master);
  this.music=new ArenaMusic(ctx,this.master,this.noise);this.music.setVolume(this.musicVolume*100);
  this.player=this.makeEngine(1);for(let i=0;i<ENEMY_VOICES;i++)this.enemies.push(this.makeEngine(1,true));
  this.buildAmbience();}

 private panner(pan:number){const ctx=this.ctx!;if(!ctx.createStereoPanner)return null;const p=ctx.createStereoPanner();p.pan.value=pan;return p;}
 /** Route a voice through a panner to a bus, optionally sending some of it to the reverb. */
 private out(node:AudioNode,pan:number,bus:AudioNode,send=0){const p=this.panner(pan);const head=p??node;if(p)node.connect(p);head.connect(bus);if(send>0){const s=this.ctx!.createGain();s.gain.value=send;head.connect(s).connect(this.reverbSend);}}
 private where(x:number,z:number){const dx=x-this.listenerX,dz=z-this.listenerZ,distance=Math.hypot(dx,dz);return {distance,pan:screenPan(dx,dz)};}

 private makeEngine(loadout:number,positional=false):EngineVoice{const ctx=this.ctx!,filter=ctx.createBiquadFilter(),body=ctx.createGain(),chugDepth=ctx.createGain(),gain=ctx.createGain(),chug=ctx.createOscillator();
  filter.type='lowpass';filter.Q.value=1.6;filter.frequency.value=300;body.gain.value=.75;chugDepth.gain.value=.2;gain.gain.value=0;
  const types:OscillatorType[]=['sawtooth','square','sawtooth'],levels=[1,.45,.22];const osc=types.map((type,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=50;o.detune.value=i===2?7:0;g.gain.value=levels[i];o.connect(g).connect(filter);o.start();return o;});
  // Firing-pulse tremolo: an LFO locked to engine speed modulates the body gain, which gives the "chug" of a real engine.
  chug.type='sine';chug.frequency.value=12;chug.connect(chugDepth).connect(body.gain);chug.start();
  filter.connect(body).connect(gain);const pan=positional?this.panner(0):null;if(pan){gain.connect(pan).connect(this.engines);}else gain.connect(this.engines);
  return {osc,filter,chug,chugDepth,gain,pan,loadout};}
 private driveEngine(v:EngineVoice,loadout:number,revs:number,boost:boolean,level:number,pan:number){const ctx=this.ctx!,t=ctx.currentTime,p=ENGINE_PROFILES[loadout]??ENGINE_PROFILES[1],r=Math.max(0,Math.min(1.2,revs));
  const pitch=p.idle+r*p.range+(boost?p.range*.3:0);v.osc[0].frequency.setTargetAtTime(pitch,t,.09);v.osc[1].frequency.setTargetAtTime(pitch*.5,t,.09);v.osc[2].frequency.setTargetAtTime(pitch*2.01,t,.09);
  v.filter.frequency.setTargetAtTime((180+r*700+(boost?400:0))*p.bright,t,.12);v.chug.frequency.setTargetAtTime(pitch/4,t,.09);v.chugDepth.gain.setTargetAtTime(p.chug*(1-.5*r),t,.15);
  v.gain.gain.setTargetAtTime(level,t,.08);if(v.pan)v.pan.pan.setTargetAtTime(pan,t,.08);v.loadout=loadout;}

 /** Called every frame with the player's engine state and every other vehicle. */
 updateEngines(player:EngineSource|null,others:EngineSource[]){if(!this.ctx||!this.player)return;
  if(player)this.driveEngine(this.player,player.loadout,player.revs,player.boost,this.active&&player.alive?playerEngineLevel(player.revs,player.boost):0,0);
  const heard=others.filter(o=>o.alive).map(o=>({o,...this.where(o.x,o.z)})).filter(e=>e.distance<HEARING).sort((a,b)=>a.distance-b.distance).slice(0,ENEMY_VOICES);
  this.enemies.forEach((voice,i)=>{const e=heard[i];if(!e||!this.active){voice.gain.gain.setTargetAtTime(0,this.ctx!.currentTime,.12);return;}
   const fade=Math.max(0,1-e.distance/HEARING),level=(.016+.02*Math.min(1,e.o.revs))*fade*fade*1.4;
   this.driveEngine(voice,e.o.loadout,e.o.revs,e.o.boost,level,e.pan);});}

 private noiseBurst(opts:{x?:number;z?:number;at?:number;type:BiquadFilterType;freq:number;q?:number;sweepTo?:number;level:number;length:number;attack?:number;bus?:AudioNode;send?:number;decay?:boolean;pan?:number}){const ctx=this.ctx!,t=opts.at??ctx.currentTime,src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  src.buffer=opts.decay?this.decayNoise:this.noise;f.type=opts.type;f.frequency.setValueAtTime(opts.freq,t);if(opts.sweepTo)f.frequency.exponentialRampToValueAtTime(opts.sweepTo,t+opts.length);f.Q.value=opts.q??.7;
  const attack=opts.attack??.002;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(opts.level,t+attack);g.gain.exponentialRampToValueAtTime(.0005,t+opts.length);
  src.connect(f).connect(g);this.out(g,opts.pan??0,opts.bus??this.sfx,opts.send??0);const max=src.buffer!.duration;src.start(t,opts.decay?0:Math.random()*Math.max(0,max-opts.length-.01));src.stop(t+opts.length+.02);}
 private tone(opts:{at?:number;type:OscillatorType;from:number;to?:number;level:number;length:number;pan?:number;bus?:AudioNode;send?:number;attack?:number}){const ctx=this.ctx!,t=opts.at??ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type=opts.type;o.frequency.setValueAtTime(opts.from,t);if(opts.to)o.frequency.exponentialRampToValueAtTime(Math.max(20,opts.to),t+opts.length);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(opts.level,t+(opts.attack??.003));g.gain.exponentialRampToValueAtTime(.0005,t+opts.length);o.connect(g);this.out(g,opts.pan??0,opts.bus??this.sfx,opts.send??0);o.start(t);o.stop(t+opts.length+.02);}
 private ready(){return !!this.ctx&&!this.muted&&this.ctx.state!=='closed';}

 /** Weapon report, one per weapon index: machine gun, shotgun, laser, cannon, mortar. */
 gun(weapon:number,x:number,z:number,own:boolean){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>55)return;try{this.intensity=Math.min(1,this.intensity+.04);
  const v=falloff(distance)*(own?.75:1),dist=Math.min(1,distance/55),[crack,body,length,level]=[[2600,420,.07,.07],[900,150,.2,.13],[3400,880,.12,.07],[700,120,.32,.13],[420,70,.42,.17]][weapon]??[2000,300,.1,.07];
  // Far shots lose their top end and gain more tail, so distance reads by timbre as well as level.
  this.noiseBurst({type:'bandpass',freq:crack*(1-dist*.6),q:.8,level:level*v,length:length*(1+dist*.6),pan,send:.08+dist*.35});
  this.tone({type:weapon===2?'sine':'triangle',from:body,to:body*(weapon===2?.3:.45),level:level*.8*v,length,pan});
  if(weapon===1||weapon>=3)this.noiseBurst({type:'lowpass',freq:260,level:level*.9*v,length:length*1.6,pan,decay:true,send:.2});
  if(weapon===0&&Math.random()<.35)this.tone({at:this.ctx!.currentTime+.09+Math.random()*.08,type:'triangle',from:5200+Math.random()*1400,to:3800,level:.006*v,length:.05,pan});}catch{}}
 /** Missile launch: a rising rocket hiss. */
 missile(x:number,z:number){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>55)return;try{const v=falloff(distance);this.noiseBurst({type:'bandpass',freq:500,sweepTo:2600,q:1.2,level:.09*v,length:.7,attack:.04,pan,send:.25});this.tone({type:'sawtooth',from:90,to:60,level:.04*v,length:.4,pan});}catch{}}
 /** Projectile hitting armour, ground or cover. Rockets get a heavier crack. */
 impact(x:number,z:number,heavy:boolean,armour:boolean){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>45)return;try{const v=falloff(distance,12);
  if(armour){this.tone({type:'square',from:1700+Math.random()*900,to:900,level:.022*v,length:.09,pan});this.tone({type:'sine',from:3200+Math.random()*800,to:2600,level:.012*v,length:.22,pan,send:.1});}
  this.noiseBurst({type:armour?'highpass':'bandpass',freq:armour?2400:900,level:(heavy?.08:.035)*v,length:heavy?.18:.07,pan,send:.1});
  if(heavy)this.noiseBurst({type:'lowpass',freq:400,level:.1*v,length:.35,pan,decay:true,send:.3});}catch{}}
 /** Explosion with sub thump, crackle, debris rattle and a reverb tail. Size ~1 for a car. */
 explosion(x:number,z:number,size=1){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>70)return;try{const ctx=this.ctx!,t=ctx.currentTime,v=falloff(distance,18)*Math.min(1.4,.6+size*.4),far=Math.min(1,distance/70);this.intensity=Math.min(1,this.intensity+.25);if(distance<30)this.music?.duck(.45*Math.min(1,size)*(1-distance/30),.7);
  this.noiseBurst({type:'lowpass',freq:1400*(1-far*.7),sweepTo:220,level:.2*v,length:.55+size*.15,pan,decay:true,send:.35+far*.4});
  this.tone({type:'sine',from:120,to:28,level:.34*v,length:.6,pan,attack:.005});
  this.noiseBurst({type:'bandpass',freq:3000,q:.6,level:.05*v*(1-far),length:.12,pan});
  for(let i=0;i<5;i++)this.noiseBurst({at:t+.12+Math.random()*.6,type:'bandpass',freq:1800+Math.random()*2400,q:3,level:.012*v*(1-far),length:.04+Math.random()*.05,pan:Math.max(-1,Math.min(1,pan+(Math.random()-.5)*.4))});}catch{}}
 /** Car hitting a wall or another car. strength 0..1. */
 crash(x:number,z:number,strength:number){if(!this.ready()||this.crashCooldown>0)return;const {distance,pan}=this.where(x,z);if(distance>35)return;this.crashCooldown=.08;try{const v=falloff(distance,12)*Math.max(.3,Math.min(1,strength));
  this.noiseBurst({type:'lowpass',freq:700,level:.16*v,length:.25,pan,decay:true,send:.12});this.tone({type:'square',from:150+Math.random()*60,to:70,level:.05*v,length:.18,pan});
  this.tone({type:'triangle',from:620+Math.random()*300,to:480,level:.025*v,length:.35,pan,send:.15});}catch{}}
 /** Skill sounds: 0 cloak, 1 grapple launch, 2 overdrive, 3 barrage call, 4 dome up, 5 grapple hit, 6 arc zap, 7 dome blast, 8 cloak break, 9 ram. */
 skill(kind:number,x:number,z:number){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>45)return;try{const v=falloff(distance),t=this.ctx!.currentTime;
  if(kind===0){this.tone({type:'sine',from:1800,to:240,level:.05*v,length:.55,pan,send:.3});this.noiseBurst({type:'highpass',freq:5000,sweepTo:900,level:.04*v,length:.5,attack:.05,pan,send:.3});}
  else if(kind===8){this.tone({type:'sine',from:260,to:1500,level:.045*v,length:.25,pan,send:.2});this.noiseBurst({type:'bandpass',freq:1200,sweepTo:4200,level:.04*v,length:.2,pan});}
  else if(kind===1){this.noiseBurst({type:'bandpass',freq:1800,sweepTo:500,q:2,level:.1*v,length:.22,pan});for(let i=0;i<5;i++)this.tone({at:t+i*.035,type:'square',from:900+Math.random()*500,to:600,level:.018*v,length:.03,pan});}
  else if(kind===5){this.tone({type:'square',from:420,to:160,level:.08*v,length:.16,pan});this.tone({type:'triangle',from:2400,to:1800,level:.03*v,length:.3,pan,send:.2});this.noiseBurst({type:'lowpass',freq:600,level:.12*v,length:.2,pan,decay:true});}
  else if(kind===2){this.tone({type:'sawtooth',from:110,to:440,level:.05*v,length:.5,pan});this.tone({type:'square',from:60,to:62,level:.03*v,length:.6,pan});this.noiseBurst({type:'highpass',freq:3500,level:.05*v,length:.45,attack:.1,pan,send:.2});}
  else if(kind===6){this.noiseBurst({type:'highpass',freq:2800+Math.random()*1500,level:.05*v,length:.09,pan});this.tone({type:'sawtooth',from:1900+Math.random()*600,to:300,level:.025*v,length:.08,pan});}
  else if(kind===3){for(let i=0;i<3;i++)this.tone({at:t+i*.16,type:'square',from:1100,level:.025*v,length:.09,pan});}
  else if(kind===4){this.tone({type:'sine',from:70,to:210,level:.16*v,length:.6,pan,attack:.08,send:.3});this.tone({type:'triangle',from:420,to:840,level:.04*v,length:.5,pan,attack:.1,send:.3});}
  else if(kind===9){this.noiseBurst({type:'lowpass',freq:500,level:.2*v,length:.3,pan,decay:true,send:.15});this.tone({type:'square',from:120,to:50,level:.08*v,length:.25,pan});}
  else{this.tone({type:'sine',from:90,to:30,level:.3*v,length:.7,pan});this.noiseBurst({type:'lowpass',freq:500,sweepTo:120,level:.15*v,length:.7,pan,decay:true,send:.4});}}catch{}}
 /** Incoming airstrike whistle before the telegraphed impact. */
 whistle(x:number,z:number,seconds:number){if(!this.ready())return;const {distance,pan}=this.where(x,z);if(distance>55)return;try{this.tone({type:'sine',from:2100,to:700,level:.025*falloff(distance),length:Math.max(.3,seconds),pan,attack:.2,send:.2});}catch{}}
 pickup(heal:boolean){if(!this.ready())return;try{const t=this.ctx!.currentTime;(heal?[660,880,1100]:[440,660,990]).forEach((f,i)=>this.tone({at:t+i*.07,type:'triangle',from:f,level:.04,length:.18}));}catch{}}
 /** Hit confirmation for the player's own shots: a dry tick for a hit, a bright double tick for a crit, a heavy clunk and ring for a wreck. */
 hitConfirm(kind:'hit'|'crit'|'kill'){if(!this.ready())return;try{const t=this.ctx!.currentTime;
  if(kind==='hit'){this.tone({type:'square',from:2300,to:1500,level:.018,length:.035});return;}
  if(kind==='crit'){this.tone({type:'square',from:2600,to:1800,level:.022,length:.04});this.tone({at:t+.05,type:'triangle',from:3300,to:2500,level:.03,length:.08});return;}
  this.tone({type:'sawtooth',from:180,to:55,level:.06,length:.22});this.tone({at:t+.04,type:'triangle',from:1320,level:.045,length:.4,send:.35});this.tone({at:t+.04,type:'sine',from:1980,level:.025,length:.35,send:.35});}catch{}}
 /** Short UI/score blip (kill confirm etc). */
 /** End-of-match sting: rising major arpeggio for a win, falling minor for a loss, two level notes for a draw. */
 fanfare(result:number){if(!this.ready())return;try{const t=this.ctx!.currentTime,notes=result>0?[523,659,784,1047,1319]:result<0?[392,311,262,196]:[440,440],step=result>0?.13:.24;notes.forEach((f,i)=>{const last=i===notes.length-1,length=last?.9:step*1.6;this.tone({at:t+i*step,type:'triangle',from:f,level:.07,length,send:.3,attack:.01});this.tone({at:t+i*step,type:'sawtooth',from:f/2,level:.022,length,send:.2,attack:.02});});}catch{}}
 blip(freq:number,length:number){if(!this.ready())return;try{this.tone({type:'sawtooth',from:freq,to:Math.max(40,freq*.4),level:.035,length});}catch{}}

 /** Menu sounds, deliberately few: one per kind of choice, the same for every car, weapon and colour.
  *  car      a soft engine rolling in, quiet
  *  weapon   a soft "ka-chak" of a round being chambered, quiet
  *  paint    a spray-can hiss and nothing else
  *  upgrade  a ratchet into a short chime
  *  mode     a two-note radio call
  *  arena    a low thump with a short gust, like a gate dropping on open ground
  *  reroll   a quick rising rattle of four ticks, like terrain plates reshuffling
  *  deny     a low double buzz (not enough parts); pick is the plain click for every other button. */
 menu(kind:MenuSound){if(!this.ready())return;try{const ctx=this.ctx!,t=ctx.currentTime,T=(o:Parameters<GameAudio['tone']>[0])=>this.tone(o),N=(o:Parameters<GameAudio['noiseBurst']>[0])=>this.noiseBurst(o);
  if(kind==='car'){// A car rolling in: a soft, low engine that swells, lifts a little and settles. No metal, no hard edges.
   const f=ctx.createBiquadFilter(),g=ctx.createGain(),lfo=ctx.createOscillator(),depth=ctx.createGain(),body=ctx.createGain();f.type='lowpass';f.Q.value=.7;f.frequency.setValueAtTime(220,t);f.frequency.linearRampToValueAtTime(520,t+.4);f.frequency.exponentialRampToValueAtTime(200,t+1.1);
   ([['triangle',1,1],['sawtooth',.5,.35],['triangle',1.006,.6]] as const).forEach(([type,ratio,mix])=>{const o=ctx.createOscillator(),m=ctx.createGain();o.type=type;m.gain.value=mix;o.frequency.setValueAtTime(52*ratio,t);o.frequency.linearRampToValueAtTime(88*ratio,t+.4);o.frequency.exponentialRampToValueAtTime(60*ratio,t+1.1);o.connect(m).connect(f);o.start(t);o.stop(t+1.25);});
   lfo.type='sine';lfo.frequency.setValueAtTime(13,t);lfo.frequency.linearRampToValueAtTime(22,t+.4);lfo.frequency.linearRampToValueAtTime(15,t+1.1);depth.gain.value=.18;body.gain.value=.8;lfo.connect(depth).connect(body.gain);lfo.start(t);lfo.stop(t+1.25);
   g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.032,t+.16);g.gain.setValueAtTime(.032,t+.45);g.gain.exponentialRampToValueAtTime(.0005,t+1.2);f.connect(body).connect(g);this.out(g,0,this.sfx,.1);
   N({type:'lowpass',freq:240,level:.012,length:.9,attack:.2});}
  else if(kind==='weapon'){// A round being chambered, "ka-chak": two soft filtered clicks with a small low thud, no tones.
   N({type:'bandpass',freq:1500,q:1,level:.028,length:.035,attack:.004});N({at:t+.1,type:'bandpass',freq:950,q:1,level:.04,length:.06,attack:.004});N({at:t+.1,type:'lowpass',freq:320,level:.03,length:.09,decay:true});T({at:t+.1,type:'sine',from:170,to:110,level:.018,length:.07,attack:.006});}
  else if(kind==='paint'){N({type:'bandpass',freq:4200,sweepTo:5600,q:.9,level:.05,length:.34,attack:.04});N({type:'highpass',freq:7500,level:.018,length:.3,attack:.05});}
  else if(kind==='upgrade'){for(let i=0;i<5;i++)N({at:t+i*.05,type:'bandpass',freq:2400+i*260,q:4,level:.045,length:.025});T({at:t+.28,type:'triangle',from:784,level:.045,length:.3,send:.25});T({at:t+.28,type:'sine',from:1568,level:.02,length:.3,send:.25});}
  else if(kind==='mode'){T({type:'triangle',from:440,level:.04,length:.12,send:.2});T({at:t+.11,type:'triangle',from:660,level:.04,length:.24,send:.2});}
  else if(kind==='arena'){T({type:'sine',from:90,to:42,level:.14,length:.35});N({type:'bandpass',freq:500,sweepTo:1100,q:.8,level:.05,length:.4,attack:.12,send:.3});}
  else if(kind==='reroll'){for(let i=0;i<4;i++)N({at:t+i*.05,type:'bandpass',freq:700+i*380,q:2.5,level:.05,length:.035});T({at:t+.22,type:'triangle',from:660,to:990,level:.03,length:.12});}
  else if(kind==='deny'){T({type:'square',from:150,to:140,level:.04,length:.1});T({at:t+.13,type:'square',from:118,to:105,level:.04,length:.16});}
  else{T({type:'sine',from:1100,level:.022,length:.045});N({type:'bandpass',freq:2600,q:3,level:.018,length:.02});}}catch{}}

 private buildAmbience(){const ctx=this.ctx!;
  const windLength=ctx.sampleRate*3,buffer=ctx.createBuffer(2,windLength,ctx.sampleRate);for(let c=0;c<2;c++){const ch=buffer.getChannelData(c);let b=0;for(let i=0;i<windLength;i++){b=(b+.02*(Math.random()*2-1))/1.02;ch[i]=b*3.5;}
   // Crossfade the ends so the loop has no click.
   const fade=Math.floor(ctx.sampleRate*.2);for(let i=0;i<fade;i++){const k=i/fade;ch[i]=ch[i]*k+ch[windLength-fade+i]*(1-k);}}
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.loopEnd=buffer.duration-.2;const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.Q.value=.6;filter.frequency.value=500;const gain=ctx.createGain();gain.gain.value=0;
  const lfo=ctx.createOscillator(),lfoDepth=ctx.createGain();lfo.frequency.value=.07;lfoDepth.gain.value=180;lfo.connect(lfoDepth).connect(filter.frequency);lfo.start();
  source.connect(filter).connect(gain).connect(this.ambience);source.start();this.wind={source,filter,gain,lfo};
  // A very low detuned drone sits under the wind as the arena's "room" tone.
  const bedGain=ctx.createGain();bedGain.gain.value=0;const bedFilter=ctx.createBiquadFilter();bedFilter.type='lowpass';bedFilter.frequency.value=140;bedFilter.connect(bedGain).connect(this.ambience);
  const osc=[41,41.6,61.8].map(f=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=f;o.connect(bedFilter);o.start();return o;});this.bed={osc,gain:bedGain};this.applyAmbience();}
 private applyAmbience(){if(!this.ctx||!this.wind||!this.bed)return;const a=ARENA_AMBIENCE[this.arena],t=this.ctx.currentTime;this.wind.gain.gain.setTargetAtTime(this.active?a.wind:a.wind*.35,t,.6);this.wind.filter.frequency.setTargetAtTime(a.windHz,t,.6);this.bed.gain.gain.setTargetAtTime(this.active?a.bed:0,t,.8);}

 /** Distant battle that is not on screen: far artillery, rolling gunfire, a jet-ish rumble, plus arena textures. */
 private distantEvent(){const ctx=this.ctx!,t=ctx.currentTime,pan=Math.random()*1.6-.8,roll=Math.random(),loud=(.6+this.intensity*.6)*3;
  if(roll<.4){this.noiseBurst({type:'lowpass',freq:260,sweepTo:90,level:.07*loud,length:1.4,attack:.03,pan,bus:this.ambience,decay:true,send:.6});this.tone({type:'sine',from:70,to:30,level:.06*loud,length:1,pan,bus:this.ambience,attack:.03});}
  else if(roll<.8){const shots=4+Math.floor(Math.random()*8),gap=.07+Math.random()*.06;for(let i=0;i<shots;i++)this.noiseBurst({at:t+i*gap+Math.random()*.015,type:'bandpass',freq:900+Math.random()*300,q:1.2,level:.07*loud,length:.06,pan,bus:this.ambience,send:.5});}
  else this.noiseBurst({type:'bandpass',freq:300,sweepTo:900,q:.9,level:.04*loud,length:2.2,attack:.9,pan,bus:this.ambience,send:.3});}
 private texture(){const ctx=this.ctx!,t=ctx.currentTime,kind=ARENA_AMBIENCE[this.arena].texture,pan=Math.random()*1.4-.7;
  if(kind==='lava'){for(let i=0;i<3+Math.floor(Math.random()*4);i++)this.tone({at:t+Math.random()*.6,type:'sine',from:90+Math.random()*120,to:200+Math.random()*200,level:.012,length:.08,pan,bus:this.ambience});}
  else if(kind==='metal'){const f=180+Math.random()*260;this.tone({type:'triangle',from:f,to:f*.97,level:.014,length:1.2,pan,bus:this.ambience,send:.6,attack:.01});this.tone({type:'sine',from:f*2.76,level:.006,length:.9,pan,bus:this.ambience,send:.6});}}

 /** Per-frame housekeeping: schedules ambience and lets combat intensity decay. */
 update(dt:number){if(!this.ctx)return;this.crashCooldown=Math.max(0,this.crashCooldown-dt);this.intensity=Math.max(0,this.intensity-dt*.08);this.music?.setIntensity(this.intensity);if(!this.active||this.muted)return;
  try{this.nextDistant-=dt;if(this.nextDistant<=0){this.distantEvent();this.nextDistant=2.5+Math.random()*5*(1-this.intensity*.5);}
   this.nextTexture-=dt;if(this.nextTexture<=0){this.texture();this.nextTexture=1.5+Math.random()*4;}}catch{}}
}
