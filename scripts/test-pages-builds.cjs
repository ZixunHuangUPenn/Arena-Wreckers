const {execFileSync}=require('child_process');
for(const base of ['/','/arena-wreckers/']){execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{stdio:'inherit'});execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--base',base],{stdio:'inherit'});execFileSync(process.execPath,['scripts/check-pages.cjs'],{stdio:'inherit'});}
