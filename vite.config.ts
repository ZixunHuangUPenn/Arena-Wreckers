import { defineConfig } from 'vite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export default defineConfig({base:'/',plugins:[{name:'offline-game-cache',configResolved(config){thisBase=config.base;},closeBundle(){
 const walk=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(directory+'/'+entry.name):[directory+'/'+entry.name]);
 const local=['index.html','icon.svg','manifest.webmanifest',...walk('dist/assets').filter(f=>!f.endsWith('.md')).map(f=>f.slice(5))];
 const files=[thisBase,...local.map(f=>thisBase+f)],digest=createHash('sha256');
 for(const path of local)digest.update(path).update(readFileSync('dist/'+path));
 const prefix='arena-'+Buffer.from(thisBase).toString('hex')+'-',cache=prefix+digest.digest('hex').slice(0,12);
 writeFileSync('dist/.nojekyll','');
 writeFileSync('dist/sw.js',`const CACHE=${JSON.stringify(cache)},PREFIX=${JSON.stringify(prefix)},BASE=${JSON.stringify(thisBase)},FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(BASE+'index.html')));return;}e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});`);
}}]});
let thisBase='/';
