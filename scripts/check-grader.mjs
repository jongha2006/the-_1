import assert from 'node:assert/strict';
import {createGradingClient} from '../grading-client.mjs';
if(!process.env.GRADER_URL)throw Error('Set the deployed GRADER_URL and GRADER_KEY first');
const client=createGradingClient();assert.equal(await client.isReady(true),true,'Worker is not healthy');
const good=await client.grade('function getOrder(user,order){return user && order && user.id===order.ownerId ? order : null;}');assert.equal(good.passed,6,JSON.stringify(good));
const deny=await client.grade('function getOrder(){return null;}');assert.ok(deny.passed<6,JSON.stringify(deny));
const loop=await client.grade('while(true){}');assert.ok(loop.error||loop.passed===0,JSON.stringify(loop));
console.log('Remote worker verified: valid patch, deny-all rejection, execution timeout');
