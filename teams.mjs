import {randomInt} from 'node:crypto';
import {teamScore} from './team-score.mjs';
export function createTeams(db){
 db.exec(`CREATE TABLE IF NOT EXISTS rosters(event INTEGER PRIMARY KEY,cutoff INTEGER NOT NULL,frozen INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS attendance(event INTEGER,user TEXT,team INTEGER NOT NULL,seed INTEGER NOT NULL,late INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(event,user));`);
 function ensure(e,cutoff){db.prepare('INSERT OR IGNORE INTO rosters(event,cutoff) VALUES(?,?)').run(e.id,cutoff);}
 function finalize(e,now){
  const roster=db.prepare('SELECT * FROM rosters WHERE event=?').get(e.id);if(!roster||roster.frozen||now<roster.cutoff)return;
  db.exec('BEGIN IMMEDIATE');
  try{
   const people=db.prepare('SELECT user FROM attendance WHERE event=? ORDER BY seed,user').all(e.id);
   const count=Math.max(1,Math.ceil(people.length/4));
   people.forEach((p,i)=>db.prepare('UPDATE attendance SET team=? WHERE event=? AND user=?').run(i%count+1,e.id,p.user));
   db.prepare('UPDATE rosters SET frozen=1 WHERE event=?').run(e.id);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function enroll(e,user,now){
  finalize(e,now);if(now>=e.end)return;
  if(db.prepare('SELECT team FROM attendance WHERE event=? AND user=?').get(e.id,user))return;
  const roster=db.prepare('SELECT * FROM rosters WHERE event=?').get(e.id);
  const sizes=db.prepare('SELECT team,COUNT(*) n FROM attendance WHERE event=? GROUP BY team ORDER BY team').all(e.id);
  let candidates;
  if(!sizes.length)candidates=[{team:1}];
  else if(!roster.frozen&&sizes.every(s=>s.n>=4))candidates=[{team:Math.max(...sizes.map(s=>s.team))+1}];
  else {const min=Math.min(...sizes.map(s=>s.n));candidates=sizes.filter(s=>s.n===min);}
  const team=candidates[randomInt(candidates.length)].team;
  db.prepare('INSERT OR IGNORE INTO attendance(event,user,team,seed,late) VALUES(?,?,?,?,?)').run(e.id,user,team,randomInt(2147483647),roster.frozen?1:0);
 }
 function view(e,user,rank){
  const roster=db.prepare('SELECT * FROM rosters WHERE event=?').get(e.id);
  const people=db.prepare('SELECT a.user,a.team,a.late,u.name FROM attendance a JOIN users u ON u.id=a.user WHERE event=? ORDER BY a.team,u.name').all(e.id);
  const scores=new Map(rank.map(r=>[r.id,r.points]));const mine=people.find(p=>p.user===user);
  const groups=[...new Set(people.map(p=>p.team))].map(id=>{const members=people.filter(p=>p.team===id);const values=members.map(p=>scores.get(p.user)||0),total=values.reduce((n,p)=>n+p,0),stats=teamScore(values);return {id,name:`${id}조`,size:members.length,total,average:Math.round(stats.mean*10)/10,...stats,me:id===mine?.team};}).sort((a,b)=>b.score-a.score||a.id-b.id);
  groups.forEach((g,i)=>{g.rank=i&&g.score===groups[i-1].score?groups[i-1].rank:i+1;});
  return {cutoff:roster.cutoff,finalized:!!roster.frozen,participants:people.length,targetSize:4,groups,mine:mine?{id:mine.team,name:`${mine.team}조`,late:!!mine.late,members:people.filter(p=>p.team===mine.team).map(p=>({name:p.name,points:scores.get(p.user)||0,me:p.user===user}))}:null};
 }
 return {ensure,finalize,enroll,view};
}
