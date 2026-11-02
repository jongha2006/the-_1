import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {createWorker} from '../worker.mjs';
test('production API requires proxy secret and public origin; cookies are Secure',async()=>{
 const secret='b'.repeat(64),key='c'.repeat(64),dir=mkdtempSync(join(tmpdir(),'shift-production-'));
 const worker=createWorker({key,ready:()=>true});worker.listen(0,'127.0.0.1');await once(worker,'listening');
 const base='http://127.0.0.1:31989';const child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:'31989',NODE_ENV:'production',PUBLIC_ORIGIN:'https://game.security-shift.test',GAME_ORIGIN_SECRET:secret,SECURITY_GAME_DB:join(dir,'game.sqlite'),GRADER_URL:'http://127.0.0.1:'+worker.address().port,GRADER_KEY:key,GRADER_ALLOW_HTTP:'1'},stdio:['ignore','pipe','pipe']});
 let error='';child.stderr.on('data',c=>error+=c);
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(error||'Startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error(error));});});
 assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/api/state')).status,403);assert.equal((await fetch(base+'/api/state',{headers:{'x-origin-secret':'bad'}})).status,403);
 const state=await fetch(base+'/api/state',{headers:{'x-origin-secret':secret}}).then(r=>r.json());assert.equal(state.graderReady,true);
 const post=origin=>fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json','x-origin-secret':secret,origin},body:JSON.stringify({name:'ProductionTester',password:'test-password-42'})});
 assert.equal((await post('https://attacker.test')).status,403);const joined=await post('https://game.security-shift.test');assert.equal(joined.status,200);assert.match(joined.headers.get('set-cookie'),/; Secure/);
 }finally{if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}worker.closeAllConnections();await new Promise(r=>worker.close(r));assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});}
});
