export type Insets={left:number;right:number;top:number;bottom:number};
export type GameLayout={x:number;y:number;width:number;height:number;scale:number;viewportWidth:number;viewportHeight:number;menuX:number;menuY:number;menuWidth:number;menuHeight:number;menuScale:number;portrait:boolean};
export function fitGameLayout(width:number,height:number,safe:Insets={left:0,right:0,top:0,bottom:0}):GameLayout{
 const portrait=height>width,logicalWidth=portrait?540:960,logicalHeight=portrait?960:540,w=Math.max(1,width-safe.left-safe.right),h=Math.max(1,height-safe.top-safe.bottom),scale=Math.min(w/logicalWidth,h/logicalHeight),menuWidth=portrait?480:800,menuHeight=portrait?900:440,menuScale=Math.min(w/menuWidth,h/menuHeight,1.8);
 return {x:safe.left+(w-logicalWidth*scale)/2,y:safe.top+(h-logicalHeight*scale)/2,width:logicalWidth,height:logicalHeight,scale,viewportWidth:width,viewportHeight:height,menuX:safe.left+(w-menuWidth*menuScale)/2,menuY:safe.top+(h-menuHeight*menuScale)/2,menuWidth,menuHeight,menuScale,portrait};
}
export function projectToGameUI(ndc:{x:number;y:number},layout:GameLayout){return {x:((ndc.x+1)*layout.viewportWidth/2-layout.x)/layout.scale,y:((1-ndc.y)*layout.viewportHeight/2-layout.y)/layout.scale};}
export function uiControlRects(layout:GameLayout){const w=layout.width,h=layout.height;return {drive:{x:24,y:h-174,w:150,h:150},fire:{x:w-144,y:h-144,w:120,h:120},skill:{x:w-230,y:h-100,w:68,h:54},leftHUD:{x:20,y:16,w:240,h:70},rightHUD:{x:w-200,y:16,w:180,h:100},radar:{x:w-106,y:192,w:86,h:86}};}
