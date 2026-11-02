import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {build,deploymentConfig} from '../scripts/build-vercel.mjs';
import {sameSecret,clientIP,validateProduction} from '../security.mjs';
import {createWorker} from '../worker.mjs';
import {createGradingClient} from '../grading-client.mjs';
import {makeCases,runner,evaluateOutputs} from '../judge.mjs';
const key='a'.repeat(64);
test('Vercel exports only static files; API proxy bypasses caching without embedding secrets',()=>{
 const dir=mkdtempSync(join(tmpdir(),'shift-build-'));
 try{const config=build({out:dir,env:{GAME_API_ORIGIN:'https://api.security-shift.test',GAME_ORIGIN_SECRET:key}});const text=readFileSync(join(dir,'config.json'),'utf8');assert.ok(!text.includes(key));assert.ok(text.includes('$GAME_ORIGIN_SECRET'));assert.equal(config.routes[1].dest,'https://api.security-shift.test/api/$1');assert.equal(config.routes[1].headers['Cache-Control'],'private, no-store');const files=readdirSync(join(dir,'static'));assert.ok(files.includes('index.html'));assert.ok(files.includes('score-help.css'));assert.ok(!files.includes('server.mjs'));assert.ok(!files.includes('data'));}finally{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});}
});
test('deployment rejects missing settings and non-HTTPS proxy origins',()=>{
 assert.throws(()=>deploymentConfig({}));assert.throws(()=>deploymentConfig({GAME_API_ORIGIN:'http://api.test',GAME_ORIGIN_SECRET:key}));assert.throws(()=>deploymentConfig({GAME_API_ORIGIN:'https://api.test/path',GAME_ORIGIN_SECRET:key}));assert.throws(()=>validateProduction({NODE_ENV:'production'}));
 assert.doesNotThrow(()=>validateProduction({NODE_ENV:'production',DEMO_DEPLOYMENT:'1',GRADER_MODE:'wasm',PUBLIC_ORIGIN:'https://demo.onrender.com',SECURITY_GAME_DB:join(tmpdir(),'demo.sqlite')}));
 assert.throws(()=>validateProduction({NODE_ENV:'production',DEMO_DEPLOYMENT:'1',GRADER_MODE:'docker',PUBLIC_ORIGIN:'https://demo.onrender.com',SECURITY_GAME_DB:join(tmpdir(),'demo.sqlite')}));
 assert.equal(sameSecret('x',key),false);assert.equal(sameSecret(key,key),true);
 const req={headers:{'x-real-ip':'203.0.113.1'},socket:{remoteAddress:'127.0.0.1'}};assert.equal(clientIP(req,false),'127.0.0.1');assert.equal(clientIP(req,true),'203.0.113.1');
});
test('worker authentication, remote grading client and concurrency limits',async()=>{
 let release;const gate=new Promise(r=>release=r);let running=false;
 const worker=createWorker({key,ready:()=>true,run:async code=>{if(code==='hold'){running=true;await gate;}return {passed:6,total:6};}});worker.listen(0,'127.0.0.1');await once(worker,'listening');const url='http://127.0.0.1:'+worker.address().port;
 try{assert.equal((await fetch(url+'/healthz')).status,401);const client=createGradingClient({GRADER_URL:url,GRADER_KEY:key});assert.equal(await client.isReady(),true);assert.deepEqual(await client.grade('valid fixture'),{passed:6,total:6});
 const held=client.grade('hold');while(!running)await new Promise(r=>setTimeout(r,5));const busy=await client.grade('second');assert.ok(busy.error);release();await held;
 const bad=await fetch(url+'/grade',{method:'POST',headers:{authorization:'Bearer '+key},body:JSON.stringify({code:123})});assert.equal(bad.status,400);
 }finally{release();worker.closeAllConnections();await new Promise(r=>worker.close(r));}
});
test('trusted judge rejects forged pass counts and checks actual outputs',()=>{
 const cases=makeCases();assert.notEqual(cases[0][0].id,makeCases()[0][0].id);assert.throws(()=>evaluateOutputs('{"passed":6,"total":6}',cases));
 const result=spawnSync(process.execPath,['--input-type=module','-e',runner],{input:JSON.stringify({code:'function getOrder(u,o){return u&&o&&u.id===o.ownerId?o:null;}',inputs:cases.map(([u,o])=>[u,o])}),encoding:'utf8',timeout:8000});assert.equal(result.status,0);assert.deepEqual(evaluateOutputs(result.stdout,cases),{passed:6,total:6});
});
