import http from 'node:http';
import {createHmac, pbkdf2Sync, randomBytes, timingSafeEqual} from 'node:crypto';

/**
 * T007 draft, NOT deployed: single-owner browser session boundary for read-only finance API.
 * Must be published behind HTTPS on the SAME origin as the private finance UI.
 * Server bearer token remains server-side; fail-closed if any setting is missing.
 */
const COOKIE='__Host-finances2027';
const SESSION_SECONDS=8*60*60;
const MAX_BODY=4096;

export function passwordHash(password, salt=randomBytes(24).toString('hex')) {
  if(typeof password!=='string' || password.length<16 || password.length>256) throw Error('Use a strong password');
  if(!/^[0-9a-f]{48}$/.test(salt)) throw Error('Invalid salt');
  return salt+':'+pbkdf2Sync(password,Buffer.from(salt,'hex'),310000,32,'sha256').toString('hex');
}
function verifyPassword(password, stored) {
  const [salt,digest]=stored.split(':');
  if(!/^[a-f0-9]{48}$/.test(salt||'')|| !/^[a-f0-9]{64}$/.test(digest||'')) throw Error('Invalid password hash configuration');
  const actual=pbkdf2Sync(password,Buffer.from(salt,'hex'),310000,32,'sha256');
  return timingSafeEqual(actual,Buffer.from(digest,'hex'));
}
function fixedEqual(a,b) {
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function parseSession(cookie,secret,now,active) {
  const token=String(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||!/^\d{10,13}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token))return false;
  const [expiry,nonce,signature]=token.split('.');
  if(Number(expiry)<=now || Number(expiry)>now+SESSION_SECONDS) return false;
  const expected=createHmac('sha256',secret).update(expiry+'.'+nonce).digest('hex');
  return fixedEqual(expected,signature) && active.get(token)===Number(expiry);
}
function newSession(secret,now) {
  const body=(now+SESSION_SECONDS)+'.'+randomBytes(24).toString('hex');
  return body+'.'+createHmac('sha256',secret).update(body).digest('hex');
}
export function createFinanceBrowserGateway({publicOrigin,apiOrigin='http://127.0.0.1:8091',apiToken,sessionSecret,passwordDigest,now=()=>Math.floor(Date.now()/1000)}) {
  const origin=new URL(publicOrigin||'');
  if(origin.protocol!=='https:' || origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash) throw Error('A clean HTTPS finance public origin is required');
  const api=new URL(apiOrigin);
  if(api.protocol!=='http:'||!['127.0.0.1','localhost','api'].includes(api.hostname)||(api.hostname==='api'&&api.port!=='8091')||api.pathname!=='/'||api.search||api.hash||api.username||api.password) throw Error('Only allowlisted private finance API origin is permitted');
  if(typeof apiToken!=='string'||apiToken.length<32||typeof sessionSecret!=='string'||sessionSecret.length<48) throw Error('Missing private finance gateway secrets');
  if(typeof passwordDigest!=='string'|| !/^[a-f0-9]{48}:[a-f0-9]{64}$/.test(passwordDigest)) throw Error('Invalid password hash');
  const failures=new Map();
  // In-memory revocable sessions: restarting the gateway logs out every browser.
  const active=new Map();
  const response=(res,status,body,more={})=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Cookie',...more});
    res.end(JSON.stringify(body));
  };
  return http.createServer(async(req,res)=>{
    const url=new URL(req.url||'/', 'http://localhost');
    if(active.size>10000)for(const [key,expiry] of active)if(expiry<=now())active.delete(key);
    if(req.headers.origin && req.headers.origin!==origin.origin) return response(res,403,{error:'Origin denied'});
    if(url.pathname==='/finance-api/session' && req.method==='GET')
      return response(res,200,{authenticated:parseSession(req.headers.cookie,sessionSecret,now(),active)});
    if(url.pathname==='/finance-api/login' && req.method==='POST') {
      // Browsers send Origin on same-origin POST. Refuse cross-site and nonbrowser login requests.
      if(req.headers.origin!==origin.origin) return response(res,403,{error:'Origin required'});
      const peer=req.socket.remoteAddress||'unknown';
      const state=failures.get(peer)||{count:0,until:0};
      if(state.until>now()) return response(res,429,{error:'Try later'});
      let raw='';
      for await(const part of req){
        raw+=part;
        if(raw.length>MAX_BODY)return response(res,413,{error:'Body too large'});
      }
      let password;
      try{password=JSON.parse(raw).password;}catch{return response(res,400,{error:'Invalid JSON'});}
      if(typeof password!=='string'||password.length>256)return response(res,400,{error:'Invalid password'});
      if(!verifyPassword(password,passwordDigest)){
        const count=state.count+1;
        failures.set(peer,{count,until:count>=5?now()+900:0});
        return response(res,401,{error:'Unauthorized'});
      }
      failures.delete(peer);
      const issuedAt=now();
      const token=newSession(sessionSecret,issuedAt);
      active.set(token,issuedAt+SESSION_SECONDS);
      return response(res,200,{authenticated:true},{'set-cookie':COOKIE+'='+token+'; Max-Age='+SESSION_SECONDS+'; Path=/; Secure; HttpOnly; SameSite=Strict'});
    }
    if(url.pathname==='/finance-api/logout' && req.method==='POST') {
      if(req.headers.origin!==origin.origin)return response(res,403,{error:'Origin required'});
      const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
      if(token) active.delete(token);
      return response(res,200,{authenticated:false},{'set-cookie':COOKIE+'=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict'});
    }
    if(!parseSession(req.headers.cookie,sessionSecret,now(),active))return response(res,401,{error:'Unauthorized'});
    const forecastGet=req.method==='GET' && url.pathname==='/finance-api/forecast/monthly' &&
      [...url.searchParams.keys()].every(k=>k==='month') && url.searchParams.getAll('month').length===1 &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get('month'));
    const forecastHistoryGet=req.method==='GET' && url.pathname==='/finance-api/forecast/monthly/history' &&
      [...url.searchParams.keys()].every(k=>k==='id') && url.searchParams.getAll('id').length===1 &&
      /^[-_a-zA-Z0-9:]{1,120}$/.test(url.searchParams.get('id'));
    const forecastPost=req.method==='POST' && !url.search &&
      ['/finance-api/forecast/monthly/lines','/finance-api/forecast/monthly/preview','/finance-api/forecast/monthly/confirm','/finance-api/forecast/monthly/revise'].includes(url.pathname);
    const allowed=(req.method==='GET' && url.pathname==='/finance-api/obligations'&&!url.search) ||
      (req.method==='GET' && url.pathname==='/finance-api/categories' &&
        [...url.searchParams.keys()].every(k=>['project','type'].includes(k)) &&
        url.searchParams.getAll('project').length===1 &&
        url.searchParams.getAll('type').length<=1) || forecastGet || forecastHistoryGet || forecastPost;
    if(!allowed)return response(res,req.method==='POST'?405:404,{error:'Unknown finance endpoint'});
    let payload;
    if(forecastPost) {
      if(req.headers.origin!==origin.origin)return response(res,403,{error:'Origin required'});
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))
        return response(res,415,{error:'JSON content type required'});
      const chunks=[];let size=0;
      for await(const chunk of req) {
        size+=chunk.length;
        if(size>32768)return response(res,413,{error:'Body too large'});
        chunks.push(chunk);
      }
      payload=Buffer.concat(chunks);
      try{const value=JSON.parse(payload.toString('utf8'));
        if(!value||typeof value!=='object'||Array.isArray(value))return response(res,400,{error:'JSON object required'});
      }catch{return response(res,400,{error:'Invalid JSON'});}
    }
    try{
      const target=url.pathname.slice('/finance-api'.length)+url.search;
      const upstream=await fetch(api.origin+target,{
        method:req.method,
        headers:{authorization:'Bearer '+apiToken,...(forecastPost?{'content-type':'application/json'}:{})},
        ...(forecastPost?{body:payload}:{}),
        signal:AbortSignal.timeout(5000)
      });
      if(!upstream.ok)return response(res,upstream.status,{error:'Finance API rejected or unavailable'});
      const text=await upstream.text();
      if(text.length>1048576)return response(res,502,{error:'Finance response too large'});
      res.writeHead(forecastPost?201:200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
      return res.end(text);
    }catch{
      return response(res,502,{error:'Finance API unavailable'});
    }
  });
}
