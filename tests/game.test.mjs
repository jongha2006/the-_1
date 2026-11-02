import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {problems,publicProblem,canSubmit,duration,score,dailyStart,starter} from '../game.mjs';
import {harness} from '../grader.mjs';
test('unpublished problem projection excludes answers and explanations',()=>{for(const p of problems){const view=publicProblem(p);assert.equal(view.answer,undefined);assert.equal(view.explanation,undefined);}});
test('publication and deadline use server boundaries',()=>{const e={start:1000,end:1000+duration},p=problems[1];assert.equal(canSubmit(e,p,e.start+p.offset-1),false);assert.equal(canSubmit(e,p,e.start+p.offset),true);assert.equal(canSubmit(e,p,e.end-1),true);assert.equal(canSubmit(e,p,e.end),false);});
test('KST schedule is stable across UTC date boundary',()=>{assert.equal(new Date(dailyStart(Date.parse('2026-11-02T16:00:00Z'))).toISOString(),'2026-11-03T12:00:00.000Z');});
test('time bonus depends on received timestamp',()=>{assert.equal(score(problems[0],true,1000,1000),100);assert.equal(score(problems[0],false,1000,1000),0);assert.equal(score(problems[0],true,1000+duration-1,1000),90);});
// Only fixed, trusted fixtures are run locally. Real submissions always use Docker.
function fixture(code){const r=spawnSync(process.execPath,['--input-type=module','-e',harness],{input:JSON.stringify({code}),encoding:'utf8',timeout:8000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.split('RESULT:').at(-1));}
test('correct ownership patch passes all checks',()=>assert.equal(fixture('function getOrder(user,order){return user && order && user.id===order.ownerId ? order : null;}').passed,6));
test('starter and deny-all patches fail full acceptance',()=>{assert.ok(fixture(starter).passed<6);assert.ok(fixture('function getOrder(){return null;}').passed<6);});
test('host process is absent from the evaluation context',()=>assert.equal(fixture('const steal=process.env; function getOrder(){return null;}').passed,0));
