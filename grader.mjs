import {spawn,spawnSync} from 'node:child_process';
import {makeCases,runner,evaluateOutputs} from './judge.mjs';
const image=process.env.GRADER_IMAGE||'node:24-alpine';
export function dockerAvailable(){return spawnSync('docker',['image','inspect',image],{timeout:5000,stdio:'ignore'}).status===0;}
// User code is only evaluated inside a disposable container, never in the host process.
export const harness=`import vm from 'node:vm';
let input='';for await(const c of process.stdin)input+=c;
const code=JSON.parse(input).code;
try {
 const ctx=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
 new vm.Script(code).runInContext(ctx,{timeout:500});
 const cases=[
 [{id:'u1'},{id:'a',ownerId:'u1',total:120},true],
 [{id:'u2'},{id:'a',ownerId:'u1',total:120},false],
 [null,{id:'a',ownerId:'u1',total:120},false],
 [{id:'u1'},null,false],
 [{id:'0'},{id:'b',ownerId:'0',total:0},true],
 [{id:'01'},{id:'b',ownerId:'1',total:50},false]
 ];
 let passed=0;for(const [u,o,ok] of cases){try{const expression='JSON.stringify(getOrder('+JSON.stringify(u)+','+JSON.stringify(o)+'))';const r=new vm.Script(expression).runInContext(ctx,{timeout:500});if(ok?r===JSON.stringify(o):r==='null')passed++;}catch{}}
 process.stdout.write('\\nRESULT:'+JSON.stringify({passed,total:cases.length}));
}catch {process.stdout.write('\\nRESULT:'+JSON.stringify({passed:0,total:6}));}`;
export function grade(code){return new Promise(resolve=>{
 const name='shift-'+crypto.randomUUID(),cases=makeCases();
 const args=['run','--rm','--name',name,'--network','none','--read-only','--memory','64m','--memory-swap','64m','--cpus','0.5','--pids-limit','32','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','-i',image,'node','--max-old-space-size=32','--input-type=module','-e',runner];
 const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',bytes=0,done=false;
 const finish=r=>{if(done)return;done=true;clearTimeout(timer);resolve(r);};
 const stop=()=>{child.kill();spawn('docker',['rm','-f',name],{stdio:'ignore'}).on('error',()=>{});};
 const timer=setTimeout(()=>{stop();finish({error:'실행 시간 제한을 초과했습니다.'});},10000);
 child.on('error',()=>finish({error:'Docker 실행기를 사용할 수 없습니다.'}));
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({code,inputs:cases.map(([u,o])=>[u,o])}));
 child.stdout.on('data',b=>{bytes+=b.length;if(bytes>32768){stop();finish({error:'출력 제한을 초과했습니다.'});}else output+=b;});
 child.stderr.on('data',()=>{});
 child.on('close',status=>{if(status!==0)return finish({error:'코드 실행에 실패했습니다.'});try{finish(evaluateOutputs(output,cases));}catch{finish({error:'채점 결과를 읽지 못했습니다.'});}});
});}
