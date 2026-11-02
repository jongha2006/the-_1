import {mkdirSync,cpSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {csp,configuredSecret} from '../security.mjs';
export function deploymentConfig(env){
 if(!env.GAME_API_ORIGIN)throw Error('Set GAME_API_ORIGIN to the actual HTTPS game API origin before deploying');
 const origin=new URL(env.GAME_API_ORIGIN);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('GAME_API_ORIGIN must be a bare HTTPS origin');
 if(!configuredSecret(env.GAME_ORIGIN_SECRET))throw Error('Set GAME_ORIGIN_SECRET (at least 32 characters) in Vercel and the backend');
 return {version:3,routes:[
  {src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':csp},continue:true},
  {src:'/api/(.*)',dest:origin.origin+'/api/$1',headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','x-vercel-enable-rewrite-caching':'0'},transforms:[{type:'request.headers',op:'set',target:{key:'x-origin-secret'},args:'$GAME_ORIGIN_SECRET',env:['GAME_ORIGIN_SECRET']}]},
  {handle:'filesystem'}
 ]};
}
export function build({env=process.env,out=resolve('.vercel/output'),source=fileURLToPath(new URL('../public',import.meta.url))}={}){
 const config=deploymentConfig(env);mkdirSync(resolve(out,'static'),{recursive:true});cpSync(source,resolve(out,'static'),{recursive:true});writeFileSync(resolve(out,'config.json'),JSON.stringify(config,null,2));return config;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){build();console.log('Vercel static frontend and authenticated API rewrite prepared');}
