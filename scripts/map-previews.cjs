// Renders the deploy-menu arena previews from the real game scene.
// Run `npx vite --port 5173` first, then `node scripts/map-previews.cjs`; writes public/assets/maps/arena-N.jpg.
// Uses the dev-only __aerial hook in main.ts, so the cards always match the current terrain.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const out=path.join(__dirname,'..','public','assets','maps');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});p.on('pageerror',e=>console.log('pageerror',e.message));
 await p.goto((process.env.URL||'http://localhost:5173/')+'?quality=high');await p.waitForTimeout(6000);
 await p.evaluate(()=>{const n=document.querySelector('#driverName');if(n)n.value='Preview';document.querySelector('dialog button[value=web]')?.click();});
 const views=[[.78,118,.72],[.78,118,.72],[.78,118,.72],[.78,118,.72]];
 for(let i=0;i<4;i++){await p.evaluate(([i,v])=>globalThis.__aerial(i,...v),[i,views[i]]);await p.waitForTimeout(9000);
  await p.locator('canvas').first().screenshot({path:path.join(out,`arena-${i}.jpg`),type:'jpeg',quality:82,timeout:300000});console.log('arena',i);}
 await b.close();})();
