import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const options={N:16384,r:8,p:1,maxmem:64*1024*1024};
export const nameKey=name=>name.normalize('NFKC').toLocaleLowerCase('en-US');
export function credentials(value){
 const name=typeof value.name==='string'?value.name.trim().normalize('NFKC'):'';
 const password=value.password;
 if(!/^[\p{L}\p{N}_ -]{2,16}$/u.test(name))throw Error('닉네임은 한글·영문·숫자·공백·밑줄·하이픈으로 2~16자를 입력하세요.');
 if(typeof password!=='string'||password.length<8||password.length>128)throw Error('비밀번호는 8~128자로 입력하세요.');
 return {name,password,key:nameKey(name)};
}
export async function hashPassword(password,salt=randomBytes(16).toString('hex')){return {salt,hash:Buffer.from(await scrypt(password,salt,64,options)).toString('hex')};}
export async function verifyPassword(password,account){const candidate=await hashPassword(password,account?.salt||'0'.repeat(32));const expected=Buffer.from(account?.hash||'0'.repeat(128),'hex');return timingSafeEqual(Buffer.from(candidate.hash,'hex'),expected)&&!!account;}
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export function createAuth(db){
 db.exec(`CREATE TABLE IF NOT EXISTS accounts(user TEXT PRIMARY KEY,name_key TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user TEXT NOT NULL,expires INTEGER NOT NULL);`);
 const limits=new Map();let pending=0;
 return {
  async authenticate(mode,value,ip){
   const {name,password,key}=credentials(value);const now=Date.now();
   for(const [k,v] of limits)if(v.until<=now)limits.delete(k);
   const keys=['ip:'+ip,'name:'+key];
   for(const k of keys){const row=limits.get(k);if(row&&row.count>=(k.startsWith('ip:')?60:12))throw Error('시도 횟수가 많습니다. 10분 뒤 다시 시도하세요.');}
   if(pending>=4||limits.size>10000)throw Error('로그인 요청이 많습니다. 잠시 후 다시 시도하세요.');
   for(const k of keys){const row=limits.get(k)||{count:0,until:now+600000};row.count++;limits.set(k,row);}
   pending++;
   try{
    let account=db.prepare('SELECT * FROM accounts WHERE name_key=?').get(key);
    if(mode==='register'){
     const passwordRecord=await hashPassword(password);
     if(account)throw Error('이미 사용 중인 닉네임입니다.');
     const id=randomBytes(24).toString('hex');
     db.exec('BEGIN IMMEDIATE');
     try{db.prepare('INSERT INTO users(id,name) VALUES(?,?)').run(id,name);db.prepare('INSERT INTO accounts(user,name_key,salt,hash) VALUES(?,?,?,?)').run(id,key,passwordRecord.salt,passwordRecord.hash);db.exec('COMMIT');}catch{db.exec('ROLLBACK');throw Error('이미 사용 중인 닉네임입니다.');}
     account={user:id};
    }else if(!await verifyPassword(password,account))throw Error('닉네임 또는 비밀번호를 확인하세요.');
    const token=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),account.user,now+7*86400000);
    return {token,user:db.prepare('SELECT * FROM users WHERE id=?').get(account.user)};
   }finally{pending--;}
  },
  token(req){return (req.headers.cookie||'').match(/(?:^|; )sid=([a-f0-9]{64})(?:;|$)/)?.[1];},
  user(req){const token=this.token(req);return token?db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user WHERE s.token_hash=? AND s.expires>?').get(tokenHash(token),Date.now()):null;},
  logout(req){const token=this.token(req);if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));}
 };
}
