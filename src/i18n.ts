/** Two-language text layer. Every visible string is written as tr('中文','English') right where it is used,
 * so both versions sit side by side. The language is fixed for one page load; switching saves and reloads. */
export type Lang='zh'|'en';
export const LANG_KEY='arena-lang';
let saved:Pick<Storage,'getItem'|'setItem'>|undefined;
try{if(typeof localStorage!=='undefined')saved=localStorage;}catch{}
/** Saved choice wins; otherwise the browser's language list decides (any Chinese → zh, else en). */
export function detectLang(stored?:string|null,browser:readonly string[]=[]):Lang{
 if(stored==='zh'||stored==='en')return stored;
 for(const tag of browser){const t=tag.toLowerCase();if(t.startsWith('zh'))return 'zh';if(t.startsWith('en'))return 'en';}
 return browser.length?'en':'zh';
}
let storedLang:string|null=null;try{storedLang=saved?.getItem(LANG_KEY)??null;}catch{}
const browserLangs:readonly string[]=typeof navigator!=='undefined'?(navigator.languages?.length?navigator.languages:[navigator.language??'']):[];
export const lang:Lang=detectLang(storedLang,browserLangs);
export const langChosen=storedLang==='zh'||storedLang==='en';
if(typeof document!=='undefined'&&document.documentElement)document.documentElement.lang=lang==='zh'?'zh-CN':'en';
/** Pick the string for the current language. */
export function tr(zh:string,en:string){return lang==='en'?en:zh;}
/** Save a language. Returns true when it differs from the one on screen (the caller then reloads). */
export function saveLang(next:Lang){try{saved?.setItem(LANG_KEY,next);}catch{}return next!==lang;}
