import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {dockerAvailable,grade} from './grader.mjs';
import {sameSecret,configuredSecret} from './security.mjs';
export function createWorker({key,run=grade,ready=dockerAvailable}={}){
 if(!configuredSecret(key))throw Error('GRADER_KEY must be at least 32 characters, not a placeholder');let running=false;
 return http.createServer(async(req,res)=>{const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(!sameSecret(req.headers.authorization,'Bearer '+key))return send(401,{error:'Unauthorized'});
  if(req.url==='/healthz'&&req.method==='GET')return send(200,{ready:!!ready()});
  if(req.url!=='/grade'||req.method!=='POST')return send(404,{error:'Not found'});
  if(running)return send(429,{error:'Worker busy'});running=true;
  try{let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>20000){send(413,{error:'Payload too large'});return;}}const b=JSON.parse(text);if(typeof b.code!=='string'||b.code.length>12000)return send(400,{error:'Invalid code'});if(!ready())return send(503,{error:'Docker unavailable'});send(200,await run(b.code));}catch{send(400,{error:'Execution failed'});}finally{running=false;}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production'&&process.env.GRADER_REQUIRE_ROOTLESS!=='0'){
  const result=spawnSync('docker',['info','--format','{{json .}}'],{encoding:'utf8',timeout:5000});let info;try{info=JSON.parse(result.stdout);}catch{throw Error('Cannot inspect rootless Docker');}if(!info.SecurityOptions?.some(s=>s.includes('rootless'))||info.CgroupVersion!=='2')throw Error('Production grader requires rootless Docker with cgroup v2');
 }
 const server=createWorker({key:process.env.GRADER_KEY});server.requestTimeout=20000;server.headersTimeout=10000;
 server.listen(Number(process.env.GRADER_PORT||4100),process.env.GRADER_HOST||'127.0.0.1',()=>console.log('Grading worker listening'));
}
