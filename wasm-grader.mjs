import {makeCases,evaluateOutputs} from './judge.mjs';
import {Worker} from 'node:worker_threads';
let modulePromise;
async function engine(){if(!modulePromise)modulePromise=Promise.all([import('quickjs-emscripten-core'),import('@jitl/quickjs-wasmfile-release-sync')]).then(([core,variant])=>core.newQuickJSWASMModuleFromVariant(variant.default)).catch(error=>{modulePromise=null;throw error;});return modulePromise;}
export async function wasmReady(){try{await engine();return true;}catch{return false;}}
export function gradeWasm(code){
 if(typeof code!=='string'||code.length>12000)return Promise.resolve({error:'코드는 12,000자 이내로 입력하세요.'});
 return new Promise(resolve=>{let complete=false;const worker=new Worker(new URL('./wasm-thread.mjs',import.meta.url),{workerData:{code},env:{},resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:2}});const finish=value=>{if(complete)return;complete=true;clearTimeout(timer);void worker.terminate().finally(()=>resolve(value));};const timer=setTimeout(()=>finish({error:'코드 실행 시간 제한을 초과했습니다.'}),5000);worker.once('message',finish);worker.once('error',()=>finish({error:'코드 실행 환경의 자원 제한을 초과했습니다.'}));worker.once('exit',()=>{if(!complete)finish({error:'코드 실행이 중단되었습니다.'});});});
}
export async function executeWasm(code){
 if(typeof code!=='string'||code.length>12000)return {error:'코드는 12,000자 이내로 입력하세요.'};
 let runtime,context;
 try{
  const quickjs=await engine();runtime=quickjs.newRuntime();runtime.setMemoryLimit(8*1024*1024);runtime.setMaxStackSize(256*1024);
  const deadline=Date.now()+500;runtime.setInterruptHandler(()=>Date.now()>deadline);context=runtime.newContext();
  // No host functions, module loaders, filesystem, process, network or DB
  // bindings are registered. Player code runs only inside the WASM engine.
  const initial=context.evalCode(code,'solution.js',{type:'global'});
  if(initial.error){initial.error.dispose();return {passed:0,total:6};}initial.value.dispose();
  const cases=makeCases(),outputs=[];let bytes=0;
  for(const [user,order] of cases){
   const result=context.evalCode('JSON.stringify(getOrder('+JSON.stringify(user)+','+JSON.stringify(order)+'))','test.js',{type:'global'});
   if(result.error){result.error.dispose();outputs.push(null);continue;}
   try{const text=context.typeof(result.value)==='string'?context.getString(result.value):null;bytes+=Buffer.byteLength(text||'');if(bytes>32768)return {error:'출력 제한을 초과했습니다.'};outputs.push(text);}finally{result.value.dispose();}
  }
  return evaluateOutputs(JSON.stringify({outputs}),cases);
 }catch{return {error:'코드 실행 제한을 초과했거나 실행 환경을 준비하지 못했습니다.'};}
 finally{context?.dispose();runtime?.dispose();}
}
