import test from 'node:test';
import assert from 'node:assert/strict';
import {grade,dockerAvailable} from '../grader.mjs';
test('real Docker grader accepts a patch and bounds hostile code execution',{skip:process.env.RUN_DOCKER_TESTS!=='1',timeout:60000},async()=>{
 assert.equal(dockerAvailable(),true,'Prepare the Docker image first');
 assert.deepEqual(await grade('function getOrder(u,o){return u&&o&&u.id===o.ownerId?o:null;}'),{passed:6,total:6});
 assert.ok((await grade('function getOrder(){return null;}')).passed<6);
 const infinite=await grade('while(true){}');assert.ok(infinite.error||infinite.passed===0);
 const forged=await grade('process.stdout.write(JSON.stringify({passed:6,total:6}));');assert.ok(forged.error||forged.passed<6);
});
