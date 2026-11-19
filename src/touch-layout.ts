// Touch button layout editor. The player drags each battle control to a new spot, changes its size and
// opacity, and the result is kept on this device (localStorage), separate from the driver's save, because a
// phone and a tablet want different layouts. Offsets are stored in game-UI pixels relative to the default spot.
import {tr} from './i18n';

export type ButtonLayout={dx:number;dy:number;scale:number;opacity:number};
export type TouchLayout=Record<string,ButtonLayout>;
/** Controls the editor can move, in the order the size/opacity sliders cycle through them. */
export const EDITABLE=['driveStick','fire','skill','missile'];
const KEY='arena-touch-layout';
const storage=():Storage|undefined=>{try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}};
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
/** Reads the saved layout; anything malformed falls back to the default for that button. */
export function loadLayout(source=storage()):TouchLayout{const out:TouchLayout={};try{const raw=JSON.parse(source?.getItem(KEY)??'{}');for(const id of EDITABLE){const b=raw?.[id];if(!b)continue;out[id]={dx:clamp(Number(b.dx)||0,-900,900),dy:clamp(Number(b.dy)||0,-600,600),scale:clamp(Number(b.scale)||1,.7,1.5),opacity:clamp(Number(b.opacity)||1,.3,1)};}}catch{}return out;}
export function saveLayout(layout:TouchLayout,target=storage()){try{target?.setItem(KEY,JSON.stringify(layout));}catch{}}
/** Applies the layout with the individual `translate`/`scale` properties so it composes with inline transforms. */
export function applyLayout(layout:TouchLayout,find:(id:string)=>HTMLElement|null){for(const id of EDITABLE){const el=find(id);if(!el)continue;const b=layout[id];el.style.translate=b?`${b.dx}px ${b.dy}px`:'';el.style.scale=b&&b.scale!==1?String(b.scale):'';el.style.opacity=b&&b.opacity<1?String(b.opacity):'';}}

/**
 * Full-screen editing mode over the battle controls. While open, pointer events on the controls are captured
 * before the game sees them; dragging moves a control, the toolbar sets size and opacity of the selected one.
 */
export class LayoutEditor{
 private layout:TouchLayout=loadLayout();private selected='fire';private drag:{id:string;pointer:number;x:number;y:number;dx:number;dy:number}|null=null;private bar:HTMLElement|null=null;
 constructor(private app:HTMLElement,private controls:HTMLElement,private scale:()=>number,private onClose:()=>void){
  const capture=(e:PointerEvent)=>{if(!this.open)return;e.stopPropagation();e.preventDefault();};
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'] as const)controls.addEventListener(type,e=>{capture(e);if(this.open)this.handle(type,e);},true);
 }
 get open(){return this.app.classList.contains('layout-editing');}
 current(){return this.layout;}
 private find(id:string){return this.controls.querySelector<HTMLElement>('#'+id);}
 private entry(id:string){return this.layout[id]??(this.layout[id]={dx:0,dy:0,scale:1,opacity:1});}
 private handle(type:string,e:PointerEvent){
  if(type==='pointerdown'){const el=(e.target as HTMLElement).closest<HTMLElement>(EDITABLE.map(id=>'#'+id).join(','));if(!el)return;this.select(el.id);const b=this.entry(el.id);this.drag={id:el.id,pointer:e.pointerId,x:e.clientX,y:e.clientY,dx:b.dx,dy:b.dy};try{this.controls.setPointerCapture(e.pointerId);}catch{}return;}
  const d=this.drag;if(!d||d.pointer!==e.pointerId)return;const s=this.scale()||1,b=this.entry(d.id);b.dx=Math.round(d.dx+(e.clientX-d.x)/s);b.dy=Math.round(d.dy+(e.clientY-d.y)/s);applyLayout(this.layout,id=>this.find(id));if(type!=='pointermove')this.drag=null;}
 private select(id:string){this.selected=id;for(const other of EDITABLE)this.find(other)?.classList.toggle('layout-selected',other===id);const b=this.entry(id);const size=this.bar?.querySelector<HTMLInputElement>('[data-layout=scale]'),fade=this.bar?.querySelector<HTMLInputElement>('[data-layout=opacity]');if(size)size.value=String(b.scale);if(fade)fade.value=String(b.opacity);}
 show(){this.layout=loadLayout();this.app.classList.add('layout-editing');if(!this.bar){const bar=document.createElement('div');bar.id='layoutBar';
   bar.innerHTML=`<strong>${tr('拖动按钮调整位置','Drag a control to move it')}</strong><label>${tr('大小','Size')}<input type="range" data-layout="scale" min="0.7" max="1.5" step="0.05"></label><label>${tr('透明度','Opacity')}<input type="range" data-layout="opacity" min="0.3" max="1" step="0.05"></label><button data-layout-action="reset">${tr('恢复默认','Reset')}</button><button data-layout-action="done" class="primary">${tr('完成','Done')}</button>`;
   bar.addEventListener('input',e=>{const input=e.target as HTMLInputElement,key=input.dataset.layout as 'scale'|'opacity'|undefined;if(!key)return;this.entry(this.selected)[key]=Number(input.value);applyLayout(this.layout,id=>this.find(id));});
   bar.addEventListener('click',e=>{const action=(e.target as HTMLElement).closest<HTMLElement>('[data-layout-action]')?.dataset.layoutAction;if(action==='reset'){this.layout={};applyLayout(this.layout,id=>this.find(id));this.select(this.selected);}else if(action==='done')this.hide();});
   this.controls.parentElement?.append(bar);this.bar=bar;}
  this.bar.hidden=false;this.select(this.selected);applyLayout(this.layout,id=>this.find(id));}
 hide(){if(!this.open)return;saveLayout(this.layout);this.app.classList.remove('layout-editing');if(this.bar)this.bar.hidden=true;for(const id of EDITABLE)this.find(id)?.classList.remove('layout-selected');this.drag=null;this.onClose();}
}
