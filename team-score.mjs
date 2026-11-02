import {problems} from './game.mjs';
export const MAX_PERSONAL_SCORE=problems.length*100;
// A bounded mean/median blend. Keeping sensitivity <= 2/3 preserves
// coordinate-wise monotonicity on [0, MAX_PERSONAL_SCORE]: improving a
// personal score cannot lower the team's score, for a fixed roster.
export const TEAM_SCORE_SENSITIVITY=0.65;
export function teamScore(values){
 if(!Array.isArray(values)||values.some(x=>!Number.isFinite(x)||x<0||x>MAX_PERSONAL_SCORE))throw Error('Invalid team score input');
 if(!values.length)return {score:0,mean:0,median:0,stdDev:0,medianWeight:0};
 const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
 const mean=sorted.reduce((sum,x)=>sum+x,0)/n;
 const median=(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2;
 // Population standard deviation: every enrolled member, including zero scores.
 const stdDev=Math.sqrt(sorted.reduce((sum,x)=>sum+(x-mean)**2,0)/n);
 const medianWeight=TEAM_SCORE_SENSITIVITY*stdDev/MAX_PERSONAL_SCORE;
 return {score:(1-medianWeight)*mean+medianWeight*median,mean,median,stdDev,medianWeight};
}
