import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export function makeCases(){const a=randomUUID(),b=randomUUID(),order={id:randomUUID(),ownerId:a,total:127},zeroOrder={id:randomUUID(),ownerId:'0',total:0};return [[{id:a},order,order],[{id:b},order,null],[null,order,null],[{id:a},null,null],[{id:'0'},zeroOrder,zeroOrder],[{id:'01'},{id:randomUUID(),ownerId:'1',total:50},null]];}
// Only inputs enter the container. Expected outputs and score computation stay
// in the trusted worker; a contestant cannot simply print "passed: 6".
export const runner=`import vm from 'node:vm';
let input='';for await(const c of process.stdin)input+=c;
const {code,inputs}=JSON.parse(input);const outputs=[];
try{const ctx=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});new vm.Script(code).runInContext(ctx,{timeout:500});for(const [user,order] of inputs){try{outputs.push(new vm.Script('JSON.stringify(getOrder('+JSON.stringify(user)+','+JSON.stringify(order)+'))').runInContext(ctx,{timeout:500}));}catch{outputs.push(null);}}}catch{for(const _ of inputs)outputs.push(null);}
process.stdout.write(JSON.stringify({outputs}));`;
export function evaluateOutputs(text,cases){const data=JSON.parse(text);if(!Array.isArray(data.outputs)||data.outputs.length!==cases.length)throw Error('Invalid judge output');let passed=0;data.outputs.forEach((s,i)=>{try{if(typeof s==='string'&&isDeepStrictEqual(JSON.parse(s),cases[i][2]))passed++;}catch{}});return {passed,total:cases.length};}
