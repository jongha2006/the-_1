import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
test('API protects unpublished data and records a real scored submission',async()=>{
 const port=31987,base=`http://127.0.0.1:${port}`;
 const temp=mkdtempSync(join(tmpdir(),'security-shift-test-'));const database=join(temp,'game.sqlite');
 const child=spawn(process.execPath,['server.mjs','--demo'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),SECURITY_GAME_DB:database},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',b=>stderr+=b);
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out: '+stderr)),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 const get=()=>fetch(base+'/api/state').then(r=>r.json());
 const post=(path,data,cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',origin,cookie},body:JSON.stringify(data)});
 const state=await get();assert.equal(state.problems[1].locked,true);assert.equal(state.problems[1].description,undefined);assert.equal(state.problems[0].answer,undefined);
 assert.equal((await post('/api/submit',{problem:1,answer:1})).status,401);
 assert.equal((await post('/api/register',{name:'tester',password:'test-password-42'},'','https://other.example')).status,403);
 assert.equal((await post('/api/register',{name:'테스트 대원',password:'short'})).status,400);
 const joined=await post('/api/register',{name:'테스트 대원',password:'test-password-42'});assert.equal(joined.status,200);const cookie=joined.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/api/register',{name:'테스트 대원',password:'different-password'})).status,400);
 assert.equal((await post('/api/login',{name:'테스트 대원',password:'wrong-password'})).status,400);
 const enrolled=await fetch(base+'/api/state',{headers:{cookie}}).then(r=>r.json());assert.equal(enrolled.teams.participants,1);assert.equal(enrolled.teams.mine.members[0].name,'테스트 대원');
 assert.equal((await post('/api/submit',{problem:2,answer:2},cookie)).status,403);
 assert.equal((await post('/api/submit',{problem:1,answer:1},cookie)).status,200);
 const after=await get();assert.equal(after.ranking[0].name,'테스트 대원');assert.ok(after.ranking[0].points>=90);assert.equal(after.ranking[0].solved,1);assert.equal(after.recovery,11);
 const mine=await fetch(base+'/api/state',{headers:{cookie}}).then(r=>r.json());assert.equal(mine.submissions.length,1);assert.equal(mine.submissions[0].status,'done');
 assert.equal((await post('/api/submit',{problem:1,answer:1},cookie)).status,429);
 assert.equal((await post('/api/logout',{},cookie)).status,200);
 assert.equal((await fetch(base+'/api/state',{headers:{cookie}}).then(r=>r.json())).user,null);
 const login=await post('/api/login',{name:'테스트 대원',password:'test-password-42'});assert.equal(login.status,200);const newCookie=login.headers.get('set-cookie').split(';')[0];assert.notEqual(cookie,newCookie);
 const resumed=await fetch(base+'/api/state',{headers:{cookie:newCookie}}).then(r=>r.json());assert.equal(resumed.teams.mine.id,enrolled.teams.mine.id);assert.equal(resumed.teams.participants,1);assert.equal(resumed.submissions.length,1);
 const disk=new DatabaseSync(database);assert.equal(disk.prepare('SELECT COUNT(*) AS n FROM submissions').get().n,1);assert.equal(disk.prepare('SELECT name FROM users').get().name,'테스트 대원');const account=disk.prepare('SELECT * FROM accounts').get();assert.notEqual(account.hash,'test-password-42');assert.equal(account.hash.length,128);assert.equal(disk.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);assert.notEqual(disk.prepare('SELECT token_hash FROM sessions').get().token_hash,newCookie.slice(4));disk.close();
 }finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;for(const name of ['game.sqlite','game.sqlite-wal','game.sqlite-shm'])rmSync(join(temp,name),{force:true});rmdirSync(temp);}
});
