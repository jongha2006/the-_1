import {dockerAvailable,grade as localGrade} from './grader.mjs';
import {configuredSecret} from './security.mjs';
export function createGradingClient(env=process.env){
 let base;
 if(env.GRADER_URL){base=new URL(env.GRADER_URL);if(base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('GRADER_URL must be an origin');if(base.protocol!=='https:'&&!(base.protocol==='http:'&&(env.NODE_ENV!=='production'||env.GRADER_ALLOW_HTTP==='1')))throw Error('GRADER_URL requires HTTPS or explicitly private HTTP');if(!configuredSecret(env.GRADER_KEY))throw Error('GRADER_KEY must be at least 32 characters');}
 let available=false,checked=0,pending;
 async function isReady(force=false){if(pending)return pending;if(!force&&Date.now()-checked<5000)return available;pending=(async()=>{try{if(!base)available=dockerAvailable();else{const r=await fetch(new URL('/healthz',base),{headers:{authorization:'Bearer '+env.GRADER_KEY},signal:AbortSignal.timeout(2000),redirect:'error'});available=r.ok&&(await r.json()).ready===true;}}catch{available=false;}return available;})().finally(()=>{checked=Date.now();pending=null;});return pending;}
 async function grade(code){if(!base)return localGrade(code);try{const r=await fetch(new URL('/grade',base),{method:'POST',headers:{authorization:'Bearer '+env.GRADER_KEY,'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(15000),redirect:'error'});const text=await r.text();if(!r.ok||text.length>2048)throw Error();const result=JSON.parse(text);if(result.error)return {error:'채점 서버에서 코드를 실행하지 못했습니다. 잠시 후 다시 제출하세요.'};if(result.total!==6||!Number.isInteger(result.passed)||result.passed<0||result.passed>6)throw Error();return {passed:result.passed,total:result.total};}catch{return {error:'채점 서버 연결에 실패했습니다. 잠시 후 다시 제출하세요.'};}}
 return {isReady,grade,remote:!!base};
}
