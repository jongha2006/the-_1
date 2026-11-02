import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {problems,publicProblem,canSubmit,score,dailyStart,duration} from './game.mjs';
import {createGradingClient} from './grading-client.mjs';
import {csp,sameSecret,clientIP,validateProduction} from './security.mjs';
import {createAuth} from './auth.mjs';
import {createTeams} from './teams.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
if(process.env.DEMO_DEPLOYMENT==='1'&&!process.env.PUBLIC_ORIGIN&&process.env.RENDER_EXTERNAL_URL)process.env.PUBLIC_ORIGIN=process.env.RENDER_EXTERNAL_URL;
validateProduction(process.env);
const databasePath=process.env.SECURITY_GAME_DB||root+'data/game.sqlite';
if(databasePath!==':memory:')mkdirSync(dirname(databasePath),{recursive:true});
const db=new DatabaseSync(databasePath);db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,start INTEGER NOT NULL,end INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY,user TEXT,event INTEGER,problem INTEGER,received INTEGER,status TEXT,score INTEGER DEFAULT 0,detail TEXT,payload TEXT);
CREATE INDEX IF NOT EXISTS submission_lookup ON submissions(event,user,problem);
UPDATE submissions SET status='error',detail='서버 재시작으로 채점이 중단되었습니다. 다시 제출하세요.' WHERE status='pending';`);
const demo=process.argv.includes('--demo');const now=Date.now();const start=demo?now:dailyStart(now);
const freeDemo=process.env.DEMO_DEPLOYMENT==='1';
if(demo&&freeDemo&&process.env.DEMO_FAST==='1')problems.forEach((p,i)=>{p.offset=i*30000;});
function getEvent(start){const old=db.prepare('SELECT * FROM events WHERE start=? ORDER BY id DESC LIMIT 1').get(start);if(old)return old;const r=db.prepare('INSERT INTO events(start,end) VALUES(?,?)').run(start,start+duration);return {id:Number(r.lastInsertRowid),start,end:start+duration};}
const event=getEvent(start);
const auth=createAuth(db),teams=createTeams(db);
const publicOrigin=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).origin:null;
function cookie(token,clear=false){return `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:604800}${publicOrigin?.startsWith('https:')?'; Secure':''}`;}
const grader=createGradingClient();let ready=await grader.isReady(),busy=false;const queue=[];
async function work(){if(busy)return;busy=true;try{while(queue.length){const job=queue.shift();const result=await grader.grade(job.code);const points=result.error?0:score(problems[2],result.passed===result.total,job.received,job.start);db.prepare('UPDATE submissions SET status=?,score=?,detail=? WHERE id=?').run(result.error?'error':'done',points,result.error||`${result.passed}/${result.total} 테스트 통과`,job.id);}}finally{busy=false;}}
function currentEvent(){if(demo&&freeDemo&&Date.now()>=event.end)Object.assign(event,getEvent(Date.now()));else if(!demo&&event.start!==dailyStart(Date.now()))Object.assign(event,getEvent(dailyStart(Date.now())));return event;}
function rankings(e){return db.prepare(`SELECT u.id,u.name,SUM(b.points) points,MAX(b.at) at,COUNT(CASE WHEN b.points>0 THEN 1 END) solved FROM
 (SELECT s.user,s.problem,MAX(s.score) points,MIN(CASE WHEN s.score=(SELECT MAX(t.score) FROM submissions t WHERE t.user=s.user AND t.event=s.event AND t.problem=s.problem) THEN s.received END) at FROM submissions s WHERE s.event=? AND s.status='done' GROUP BY s.user,s.problem) b JOIN users u ON u.id=b.user GROUP BY u.id ORDER BY points DESC,at ASC,u.id ASC`).all(e.id);}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>20000)throw Error('입력이 너무 큽니다.');}return JSON.parse(text||'{}');}
const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/score-help.css':['score-help.css','text/css']};
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',csp);
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/healthz'&&req.method==='GET'){db.prepare('SELECT 1').get();return send(res,200,{ok:true});}
 const proxyVerified=!!process.env.GAME_ORIGIN_SECRET&&sameSecret(req.headers['x-origin-secret'],process.env.GAME_ORIGIN_SECRET);
 if(path.startsWith('/api/')&&process.env.GAME_ORIGIN_SECRET&&!proxyVerified)return send(res,403,{error:'이 경로는 게임 웹사이트를 통해 접속해야 합니다.'});
 if(req.method==='GET'&&assets[path]){const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});return res.end(readFileSync(root+'public/'+file));}
 if(req.method==='POST'){const origin=req.headers.origin;if(!origin||origin!==(publicOrigin||`http://${req.headers.host}`))return send(res,403,{error:'동일 출처에서만 요청할 수 있습니다.'});}
 const e={...currentEvent()},time=Date.now(),user=auth.user(req);
 teams.ensure(e,demo?e.start+60000:e.start-5*60000);teams.finalize(e,time);
 if(user)teams.enroll(e,user.id,time);
 if(path==='/api/state'&&req.method==='GET'){
 ready=await grader.isReady();
 const rank=rankings(e),active=time>=e.start&&time<e.end;
 return send(res,200,{serverTime:time,event:e,active,demo,demoDeployment:freeDemo,demoFast:freeDemo&&process.env.DEMO_FAST==='1',graderReady:ready,user:user?{name:user.name}:null,teams:teams.view(e,user?.id,rank),problems:problems.map(p=>time>=e.start+p.offset?{...publicProblem(p),...(time>=e.end?{explanation:p.explanation}:{}),unlockAt:e.start+p.offset}:{id:p.id,locked:true,unlockAt:e.start+p.offset}),submissions:user?db.prepare('SELECT id,problem,received,status,score,detail FROM submissions WHERE user=? AND event=? ORDER BY id DESC LIMIT 30').all(user.id,e.id):[],ranking:rank.map((r,i)=>({rank:i+1,name:r.name,points:r.points,solved:r.solved,me:r.id===user?.id})),recovery:Math.min(100,Math.round(rank.reduce((n,r)=>n+r.solved,0)/9*100))});}
 if(['/api/register','/api/login'].includes(path)&&req.method==='POST'){
  try{const result=await auth.authenticate(path==='/api/register'?'register':'login',await body(req),clientIP(req,proxyVerified));auth.logout(req);teams.enroll(e,result.user.id,Date.now());return send(res,200,{ok:true},{'Set-Cookie':cookie(result.token)});}catch(error){return send(res,400,{error:error.message});}
 }
 if(path==='/api/logout'&&req.method==='POST'){auth.logout(req);return send(res,200,{ok:true},{'Set-Cookie':cookie('',true)});}
 if(path==='/api/submit'&&req.method==='POST'){
 if(!user)return send(res,401,{error:'먼저 로그인하세요.'});const b=await body(req);const p=problems.find(p=>p.id===b.problem);if(!p||!canSubmit(e,p,time))return send(res,403,{error:'현재 제출할 수 없는 문제입니다.'});
 const last=db.prepare('SELECT received FROM submissions WHERE user=? ORDER BY id DESC LIMIT 1').get(user.id);if(last&&time-last.received<2000)return send(res,429,{error:'2초 뒤 다시 제출하세요.'});
 if(p.type==='code'){ready=await grader.isReady(true);if(!ready)return send(res,503,{error:'코드 채점 서버가 준비되지 않았습니다. 잠시 후 다시 제출하세요.'});}
 if(p.type==='code'&&(queue.length>=10||db.prepare("SELECT id FROM submissions WHERE user=? AND status='pending'").get(user.id)))return send(res,429,{error:'채점 대기 중입니다. 잠시 후 다시 제출하세요.'});
 if(p.type==='choice'&&(!Number.isInteger(b.answer)||b.answer<0||b.answer>=p.options.length))return send(res,400,{error:'답안을 선택하세요.'});if(p.type==='code'&&(typeof b.code!=='string'||b.code.length>12000))return send(res,400,{error:'코드는 12,000자 이내로 입력하세요.'});
 const points=p.type==='choice'?score(p,b.answer===p.answer,time,e.start):0;const detail=p.type==='choice'?(points?'해결 완료 · '+p.explanation:'해결되지 않았습니다. 로그와 권한을 다시 확인하세요.'):'격리 환경에서 채점 대기 중';
 const result=db.prepare('INSERT INTO submissions(user,event,problem,received,status,score,detail,payload) VALUES(?,?,?,?,?,?,?,?)').run(user.id,e.id,p.id,time,p.type==='choice'?'done':'pending',points,detail,JSON.stringify(b));
 if(p.type==='code'){queue.push({id:Number(result.lastInsertRowid),code:b.code,received:time,start:e.start});void work();}return send(res,200,{ok:true});}
 send(res,404,{error:'찾을 수 없습니다.'});
 }catch(err){console.error(err);send(res,400,{error:'요청을 처리하지 못했습니다. 입력을 확인하세요.'});}});
const port=Number(process.env.PORT||3000);server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`보안 당직 http://localhost:${port} | ${demo?'즉시 시작 데모':'매일 21:00 KST'} | 코드 채점 ${ready?'준비됨':'Docker 설정 필요'}`));
server.requestTimeout=30000;server.headersTimeout=10000;
