/** Works out whether this is a touch device (phone / tablet) or a keyboard-and-mouse computer.
 * The primary pointer is the best signal: phones and tablets report a coarse pointer and no hover,
 * while laptops with touch screens still report a fine primary pointer. */
export type PlayMode='mobile'|'web';
export type PlayChoice='auto'|PlayMode;
export type DeviceSignals={coarse:boolean;fine:boolean;hover:boolean;touchPoints:number;shortSide:number};
export const PLAY_KEY='arena-play-mode';
export function detectPlayMode(s:DeviceSignals):PlayMode{
 if(s.coarse&&!s.hover)return 'mobile';
 if(s.coarse&&!s.fine)return 'mobile';
 if(!s.fine&&s.touchPoints>0)return 'mobile';
 if(s.touchPoints>0&&s.shortSide>0&&s.shortSide<500&&!s.hover)return 'mobile';
 return 'web';
}
export function readDeviceSignals():DeviceSignals{
 const q=(m:string)=>{try{return typeof matchMedia!=='undefined'&&matchMedia(m).matches;}catch{return false;}};
 const nav=typeof navigator!=='undefined'?navigator:undefined,scr=typeof screen!=='undefined'?screen:undefined;
 return {coarse:q('(pointer: coarse)'),fine:q('(any-pointer: fine)'),hover:q('(hover: hover)'),touchPoints:nav?.maxTouchPoints??0,shortSide:scr?Math.min(scr.width,scr.height):0};
}
export function savedPlayChoice():PlayChoice{try{const v=typeof localStorage!=='undefined'?localStorage.getItem(PLAY_KEY):null;return v==='mobile'||v==='web'?v:'auto';}catch{return 'auto';}}
export function savePlayChoice(choice:PlayChoice){try{localStorage.setItem(PLAY_KEY,choice);}catch{}}
export function resolvePlayMode(choice:PlayChoice,signals:DeviceSignals=readDeviceSignals()):PlayMode{return choice==='auto'?detectPlayMode(signals):choice;}
