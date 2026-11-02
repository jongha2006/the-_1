import test from 'node:test';
import assert from 'node:assert/strict';
import {wasmReady,gradeWasm} from '../wasm-grader.mjs';
test('WASM accepts valid patches and rejects deny-all and forged scores',async()=>{
 assert.equal(await wasmReady(),true);
 assert.deepEqual(await gradeWasm('function getOrder(u,o){return u&&o&&u.id===o.ownerId?o:null;}'),{passed:6,total:6});
 assert.ok((await gradeWasm('function getOrder(){return null;}')).passed<6);
 assert.ok((await gradeWasm('process.stdout.write(JSON.stringify({passed:6,total:6}));')).passed<6);
});
test('WASM bounds loops and memory and exposes no server APIs',async()=>{
 const start=Date.now();const loop=await gradeWasm('while(true){}');assert.ok(loop.error||loop.passed===0);assert.ok(Date.now()-start<8000);
 const memory=await gradeWasm('let x=[];while(true)x.push(new Array(100000).fill(1));');assert.ok(memory.error||memory.passed===0);
 const host=await gradeWasm('if(typeof process!=="undefined"||typeof fetch!=="undefined"||typeof require!=="undefined")throw Error(); function getOrder(u,o){return u&&o&&u.id===o.ownerId?o:null;}');assert.equal(host.passed,6);
 assert.equal((await gradeWasm('function getOrder(){return null;}')).passed<6,true);
});
