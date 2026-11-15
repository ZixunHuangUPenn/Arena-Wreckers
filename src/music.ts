// Procedural in-match music. Every note is synthesised with the Web Audio API from patterns generated
// here, so the soundtrack is original and ships no audio files.
//
// Each arena has its own key, tempo, chord loop, instrument colour and seeded patterns. The song cycles
// through sections (intro, groove, drive, break with a riser, peak); combat intensity from the SFX system
// pushes it into the fuller sections sooner. The kick side-chains the pad, bass and arp for the "pump"
// of electronic action music, and explosions briefly duck the whole mix so effects stay on top.

type ArenaStyle={root:number;bpm:number;progression:number[];arp:OscillatorType;bassType:OscillatorType;bell:boolean;metal:boolean;seed:number;swing:number};
export const MUSIC_STYLES:ArenaStyle[]=[
 {root:50,bpm:126,progression:[0,5,2,6],arp:'square',bassType:'sawtooth',bell:false,metal:false,seed:11,swing:0},
 {root:52,bpm:132,progression:[0,0,5,6],arp:'sawtooth',bassType:'square',bell:false,metal:true,seed:23,swing:0},
 {root:45,bpm:120,progression:[0,5,3,4],arp:'triangle',bassType:'sawtooth',bell:true,metal:false,seed:37,swing:.08},
 {root:48,bpm:140,progression:[0,5,6,4],arp:'sawtooth',bassType:'sawtooth',bell:false,metal:false,seed:53,swing:0},
];
const MINOR=[0,2,3,5,7,8,10];
type Section='intro'|'groove'|'drive'|'break'|'peak';
const SONG:Section[]=['intro','groove','drive','drive','break','groove','drive','peak'];
const BARS_PER_SECTION=4;
/** Which layers play in each section (an intensity boost can lift intro/groove up a level). */
const LAYERS:Record<Section,{kick:boolean;clap:boolean;hats:number;bass:number;arp:boolean;pad:boolean;lead:boolean;riser:boolean}>={
 intro:{kick:false,clap:false,hats:1,bass:1,arp:false,pad:true,lead:false,riser:false},
 groove:{kick:true,clap:true,hats:2,bass:2,arp:false,pad:true,lead:false,riser:false},
 drive:{kick:true,clap:true,hats:2,bass:2,arp:true,pad:false,lead:false,riser:false},
 break:{kick:false,clap:false,hats:0,bass:0,arp:true,pad:true,lead:false,riser:true},
 peak:{kick:true,clap:true,hats:3,bass:2,arp:true,pad:true,lead:true,riser:false},
};

export const midiToHz=(m:number)=>440*Math.pow(2,(m-69)/12);
/** Scale degree (can exceed 7 or go negative) to a MIDI note in natural minor above root. */
export function degreeToMidi(root:number,degree:number){const octave=Math.floor(degree/7),step=((degree%7)+7)%7;return root+octave*12+MINOR[step];}
function rng(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/** Seeded 16-step patterns for one arena, so each arena always has the same recognisable tune. */
export function makePatterns(style:ArenaStyle){const r=rng(style.seed);
 const bass=Array.from({length:16},(_,i)=>i%4===2?1:i%4===0?(r()<.35?1:0):r()<.3?1:0);bass[0]=0;bass[2]=1;
 const arpOrder=Array.from({length:16},()=>Math.floor(r()*4));
 const arpGate=Array.from({length:16},(_,i)=>i%2===0||r()<.55?1:0);
 const lead=Array.from({length:4},()=>Array.from({length:8},()=>r()<.6?Math.floor(r()*5)-1:null));
 const hatAccent=Array.from({length:16},(_,i)=>i%4===2?1:r()<.2?1:0);
 return {bass,arpOrder,arpGate,lead,hatAccent};}

export class ArenaMusic{
 private ctx:AudioContext;private out:GainNode;private duckBus:GainNode;private pumpBus:GainNode;private drums:GainNode;private delay:DelayNode;private noise:AudioBuffer;
 private style=MUSIC_STYLES[0];private patterns=makePatterns(MUSIC_STYLES[0]);private timer:ReturnType<typeof setInterval>|null=null;private step=0;private nextTime=0;private intensity=0;private level=.6;private playing=false;

 constructor(ctx:AudioContext,destination:AudioNode,noise:AudioBuffer){this.ctx=ctx;this.noise=noise;
  this.out=ctx.createGain();this.out.gain.value=0;this.out.connect(destination);
  this.duckBus=ctx.createGain();this.duckBus.connect(this.out);
  this.drums=ctx.createGain();this.drums.connect(this.duckBus);
  this.pumpBus=ctx.createGain();this.pumpBus.connect(this.duckBus);
  // Dotted-eighth feedback echo for the arp and lead.
  this.delay=ctx.createDelay(1);const feedback=ctx.createGain(),wet=ctx.createGain(),tone=ctx.createBiquadFilter();feedback.gain.value=.32;wet.gain.value=.28;tone.type='lowpass';tone.frequency.value=2200;this.delay.connect(tone).connect(feedback).connect(this.delay);tone.connect(wet).connect(this.pumpBus);}

 /** Music volume 0..100 from settings. */
 setVolume(percent:number){this.level=Math.max(0,Math.min(1,percent/100));if(this.playing)this.out.gain.setTargetAtTime(.32*this.level,this.ctx.currentTime,.3);}
 /** 0..1 combat intensity; above about 0.55 the song moves into its fuller layers. */
 setIntensity(value:number){this.intensity=Math.max(0,Math.min(1,value));}
 /** Briefly pull the music down under a big sound effect. */
 duck(amount=.5,seconds=.6){const t=this.ctx.currentTime,g=this.duckBus.gain;g.cancelScheduledValues(t);g.setValueAtTime(Math.max(.05,Math.min(g.value,1-amount)),t);g.linearRampToValueAtTime(1,t+seconds);}

 start(arena:number){this.style=MUSIC_STYLES[Math.max(0,Math.min(MUSIC_STYLES.length-1,arena|0))];this.patterns=makePatterns(this.style);this.step=0;this.nextTime=this.ctx.currentTime+.1;this.delay.delayTime.value=60/this.style.bpm*.75;this.playing=true;
  const t=this.ctx.currentTime;this.out.gain.cancelScheduledValues(t);this.out.gain.setValueAtTime(this.out.gain.value,t);this.out.gain.linearRampToValueAtTime(.32*this.level,t+1.5);
  if(!this.timer)this.timer=setInterval(()=>this.schedule(),25);}
 stop(fade=1.2){if(!this.playing)return;this.playing=false;const t=this.ctx.currentTime;this.out.gain.cancelScheduledValues(t);this.out.gain.setValueAtTime(this.out.gain.value,t);this.out.gain.linearRampToValueAtTime(0,t+fade);
  // Keep scheduling through the fade, then stop the clock unless a new match started meanwhile.
  setTimeout(()=>{if(!this.playing&&this.timer){clearInterval(this.timer);this.timer=null;}},fade*1000+100);}
 get isPlaying(){return this.playing;}

 private schedule(){const now=this.ctx.currentTime;if(this.ctx.state!=='running')return;
  // After a stall (background tab, long frame) skip ahead instead of firing a burst of late notes.
  if(this.nextTime<now-.1)this.nextTime=now+.05;
  const stepLength=60/this.style.bpm/4;while(this.nextTime<now+.15){const swing=this.step%2?stepLength*this.style.swing:0;this.playStep(this.step,this.nextTime+swing,stepLength);this.nextTime+=stepLength;this.step++;}}

 private section(step:number):Section{const bar=Math.floor(step/16),base=SONG[Math.floor(bar/BARS_PER_SECTION)%SONG.length];
  if(this.intensity>.55&&(base==='intro'||base==='groove'))return 'drive';if(this.intensity>.85&&base==='drive')return 'peak';return base;}

 private playStep(step:number,t:number,len:number){try{const s=step%16,bar=Math.floor(step/16),section=this.section(step),layer=LAYERS[section],style=this.style,p=this.patterns;
  const chord=style.progression[bar%style.progression.length],barInSection=bar%BARS_PER_SECTION;
  if(layer.kick&&s%4===0)this.kick(t);
  if(layer.kick&&section==='peak'&&s===14&&bar%2)this.kick(t,.6);
  if(layer.clap&&(s===4||s===12))this.clap(t,style.metal);
  if(layer.hats>0){if(s%2===0&&layer.hats>=1&&(layer.hats>1||s%4===2))this.hat(t,.035,.06);if(layer.hats>=2&&s%2===1)this.hat(t,.02,p.hatAccent[s]?.05:.03);if(layer.hats>=3&&s%4===2)this.hat(t,.14,.04);}
  if(layer.bass===1&&s===0)this.bass(t,degreeToMidi(style.root-12,chord),len*7,.9);
  if(layer.bass===2&&p.bass[s])this.bass(t,degreeToMidi(style.root-12,chord)+(s===14&&bar%2?12:0),len*.85,1);
  if(layer.arp&&p.arpGate[s]){const tones=[0,2,4,7],deg=chord+tones[p.arpOrder[s]];this.arp(t,degreeToMidi(style.root+12,deg),len*.9,section==='break'?.5:1);}
  if(layer.pad&&s===0)this.pad(t,style.root,chord,len*16);
  if(layer.lead&&s%2===0){const note=p.lead[bar%4][s/2];if(note!==null)this.lead(t,degreeToMidi(style.root+24,chord+[0,2,4,7,9][Math.max(0,note)]),len*(s%4===0?1.8:.9));}
  if(layer.riser&&barInSection===BARS_PER_SECTION-2&&s===0)this.riser(t,len*32);
  if(section!=='break'&&barInSection===0&&s===0&&this.section(step-16)==='break')this.crash(t);}catch{}}

 private env(g:GainNode,t:number,peak:number,attack:number,length:number){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(peak,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+length);}
 private noiseHit(t:number,type:BiquadFilterType,freq:number,q:number,peak:number,length:number,dest:AudioNode,sweepTo?:number,attack=.001){const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=this.noise;f.type=type;f.frequency.setValueAtTime(freq,t);if(sweepTo)f.frequency.exponentialRampToValueAtTime(sweepTo,t+length);f.Q.value=q;this.env(g,t,peak,attack,length);src.connect(f).connect(g).connect(dest);const offset=Math.random()*Math.max(0,this.noise.duration-length-.02);src.start(t,offset,length+.02);}
 private kick(t:number,level=1){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(44,t+.11);this.env(g,t,.95*level,.002,.32);o.connect(g).connect(this.drums);o.start(t);o.stop(t+.34);
  this.noiseHit(t,'highpass',3000,.7,.08*level,.012,this.drums);
  // Side-chain pump on the melodic bus.
  const pump=this.pumpBus.gain;pump.cancelScheduledValues(t);pump.setValueAtTime(.3,t);pump.linearRampToValueAtTime(1,t+.2);}
 private clap(t:number,metal:boolean){for(let i=0;i<3;i++)this.noiseHit(t+i*.011,'bandpass',metal?2600:1400,metal?6:1.1,.22,i===2?.16:.02,this.drums);if(metal){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=870;this.env(g,t,.035,.001,.12);o.connect(g).connect(this.drums);o.start(t);o.stop(t+.14);}}
 private hat(t:number,length:number,level:number){this.noiseHit(t,'highpass',7500,.8,level*2,length,this.drums);}
 private crash(t:number){this.noiseHit(t,'highpass',4500,.5,.12,1.4,this.drums,undefined,.002);}
 private riser(t:number,length:number){this.noiseHit(t,'bandpass',300,1.5,.09,length,this.pumpBus,6000,length*.9);}
 private bass(t:number,midi:number,length:number,level:number){const f=midiToHz(midi),o=this.ctx.createOscillator(),sub=this.ctx.createOscillator(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),sg=this.ctx.createGain();
  o.type=this.style.bassType;o.frequency.value=f;sub.type='sine';sub.frequency.value=f/2;sg.gain.value=.6;filter.type='lowpass';filter.Q.value=6;filter.frequency.setValueAtTime(180,t);filter.frequency.exponentialRampToValueAtTime(1100,t+.02);filter.frequency.exponentialRampToValueAtTime(200,t+Math.min(length,.25));
  this.env(g,t,.22*level,.004,Math.max(.08,length));o.connect(filter);sub.connect(sg).connect(g);filter.connect(g).connect(this.pumpBus);o.start(t);sub.start(t);o.stop(t+length+.05);sub.stop(t+length+.05);}
 private arp(t:number,midi:number,length:number,level:number){const f=midiToHz(midi),o=this.ctx.createOscillator(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain();o.type=this.style.arp;o.frequency.value=f;filter.type='lowpass';filter.Q.value=3;filter.frequency.setValueAtTime(3200,t);filter.frequency.exponentialRampToValueAtTime(700,t+length);
  this.env(g,t,(this.style.arp==='triangle'?.09:.05)*level,.003,length);o.connect(filter).connect(g);g.connect(this.pumpBus);g.connect(this.delay);o.start(t);o.stop(t+length+.02);
  if(this.style.bell){const b=this.ctx.createOscillator(),bg=this.ctx.createGain();b.type='sine';b.frequency.value=f*2.76;this.env(bg,t,.025*level,.002,length*2.5);b.connect(bg).connect(this.delay);bg.connect(this.pumpBus);b.start(t);b.stop(t+length*2.5+.02);}}
 private pad(t:number,root:number,chord:number,length:number){const filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain();filter.type='lowpass';filter.frequency.value=1100;filter.Q.value=.5;this.env(g,t,.05,length*.3,length);filter.connect(g).connect(this.pumpBus);
  for(const tone of [0,2,4])for(const detune of [-8,8]){const o=this.ctx.createOscillator();o.type='sawtooth';o.frequency.value=midiToHz(degreeToMidi(root,chord+tone));o.detune.value=detune;o.connect(filter);o.start(t);o.stop(t+length+.05);}}
 private lead(t:number,midi:number,length:number){const o=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),vib=this.ctx.createOscillator(),vibDepth=this.ctx.createGain();const f=midiToHz(midi);
  o.type='sawtooth';o2.type='square';o.frequency.value=f;o2.frequency.value=f;o2.detune.value=12;vib.frequency.value=5.5;vibDepth.gain.value=f*.006;vib.connect(vibDepth);vibDepth.connect(o.frequency);vibDepth.connect(o2.frequency);
  filter.type='lowpass';filter.frequency.value=2600;this.env(g,t,.045,.01,length);o.connect(filter);o2.connect(filter);filter.connect(g);g.connect(this.pumpBus);g.connect(this.delay);for(const n of [o,o2,vib]){n.start(t);n.stop(t+length+.03);}}
}
