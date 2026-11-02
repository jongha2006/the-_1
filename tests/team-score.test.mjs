import test from 'node:test';
import assert from 'node:assert/strict';
import {teamScore} from '../team-score.mjs';
test('uniform teams keep their score regardless of roster size; zero scores count',()=>{
 for(const values of [[90],[90,90],[90,90,90,90,90]])assert.equal(teamScore(values).score,90);
 assert.equal(teamScore([]).score,0);assert.equal(teamScore([0,0,0]).score,0);
 assert.ok(teamScore([0,90,90,90]).score<90);
 assert.ok(teamScore([0,0,0,300]).score<teamScore([300]).score);
});
test('high and low extremes have less influence than in the arithmetic mean',()=>{
 const high=teamScore([90,90,90,300]);assert.ok(high.score<high.mean);assert.ok(high.score>high.median);
 const low=teamScore([0,90,90,90]);assert.ok(low.score>low.mean);assert.ok(low.score<low.median);
 assert.equal(teamScore([0,100,200,300]).score,150);
});
test('same distribution and order changes do not alter team rating',()=>{
 assert.equal(teamScore([90,90,300]).score,teamScore([90,90,90,90,300,300]).score);
 assert.equal(teamScore([300,90,90]).score,teamScore([90,90,300]).score);
});
test('improving a personal score cannot decrease the team rating',()=>{
 const fixtures=[[176,56,291,210],[0,0,0,300],[0,90,90,90],[90,90,90,300],[1],[0,300],[100,100,100]];
 // Deterministic varied distributions, including zeros and ties.
 let seed=1729;for(let k=0;k<1000;k++){const n=2+k%15;const v=[];for(let j=0;j<n;j++){seed=(1664525*seed+1013904223)>>>0;v.push(seed%301);}fixtures.push(v);}
 for(const values of fixtures)for(let i=0;i<values.length;i++){if(values[i]===300)continue;const after=[...values];after[i]++;assert.ok(teamScore(after).score+1e-9>=teamScore(values).score,JSON.stringify(values));}
});
test('invalid points are rejected and the median weight stays bounded',()=>{
 for(const values of [[NaN],[-1],[301],[Infinity]])assert.throws(()=>teamScore(values));
 assert.ok(teamScore([0,300]).medianWeight<=0.325);assert.equal(teamScore([100,100]).stdDev,0);
});
