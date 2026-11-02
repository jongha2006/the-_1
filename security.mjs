import {createHash,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {isAbsolute} from 'node:path';
export const csp="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
export function sameSecret(actual,expected){if(typeof actual!=='string'||!expected)return false;const digest=s=>createHash('sha256').update(s).digest();return timingSafeEqual(digest(actual),digest(expected));}
export const configuredSecret=value=>typeof value==='string'&&value.length>=32&&!/REPLACE|CHANGEME|EXAMPLE/i.test(value);
export function validateProduction(env){
 if(env.NODE_ENV!=='production')return;
 if(!env.PUBLIC_ORIGIN)throw Error('Production requires HTTPS PUBLIC_ORIGIN');const origin=new URL(env.PUBLIC_ORIGIN);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('Production requires a bare HTTPS PUBLIC_ORIGIN');
 if(!configuredSecret(env.GAME_ORIGIN_SECRET))throw Error('Production requires GAME_ORIGIN_SECRET of at least 32 characters');
 if(!env.GRADER_URL||!configuredSecret(env.GRADER_KEY))throw Error('Production requires remote GRADER_URL and GRADER_KEY');
 if(!env.SECURITY_GAME_DB||!isAbsolute(env.SECURITY_GAME_DB))throw Error('Production requires an absolute persistent SECURITY_GAME_DB path');
}
export function clientIP(req,proxyVerified){const forwarded=req.headers['x-real-ip'];return proxyVerified&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:req.socket.remoteAddress;}
