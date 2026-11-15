import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createFinanceBrowserGateway,passwordHash} from './browser-gateway.mjs';

const owner='very-long-development-password-just-for-unit-tests';
const API_TOKEN='server-secret-api-token-only-123456789';
const sessionSecret='session-signing-secret-that-is-long-enough-for-tests-987654321';
const publicOrigin='https://finance.example.test';
const upToken='Bearer '+API_TOKEN;

async function listen(server) {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+server.address().port;
}
async function close(server) { server.closeAllConnections(); server.close(); }
test('finance read gateway fails closed on bad deployment configuration',()=>{
 assert.throws(()=>createFinanceBrowserGateway({publicOrigin:'http://finance.example.test',apiToken:API_TOKEN,sessionSecret,passwordDigest:passwordHash(owner)}),/HTTPS/);
 assert.throws(()=>createFinanceBrowserGateway({publicOrigin,apiOrigin:'http://example.org',apiToken:API_TOKEN,sessionSecret,passwordDigest:passwordHash(owner)}),/loopback/);
 assert.throws(()=>createFinanceBrowserGateway({publicOrigin,apiToken:API_TOKEN,sessionSecret,passwordDigest:'invalid'}),/password hash/);
});
test('browser session is cookie-only and finance bearer stays on server',async()=>{
 let upstreamCount=0;
 const upstream=(await import('node:http')).createServer((req,res)=>{
  upstreamCount++;
  assert.equal(req.headers.authorization,upToken);
  assert.ok(req.url.startsWith('/categories'));
  res.setHeader('content-type','application/json');res.end(JSON.stringify({project:'personal',economicType:'expense',records:[]}));
 });
 const apiOrigin=await listen(upstream);
 const gate=createFinanceBrowserGateway({publicOrigin,apiOrigin,apiToken:API_TOKEN,sessionSecret,passwordDigest:passwordHash(owner)});
 const base=await listen(gate);
 try {
  const anonymous=await fetch(base+'/finance-api/categories?project=personal&type=expense');
  assert.equal(anonymous.status,401);assert.equal(upstreamCount,0);
  const status=await (await fetch(base+'/finance-api/session')).json();
  assert.equal(status.authenticated,false);
  const cross=await fetch(base+'/finance-api/login',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({password:owner})});
  assert.equal(cross.status,403);
  const denied=await fetch(base+'/finance-api/login',{method:'POST',headers:{origin:publicOrigin},body:JSON.stringify({password:'wrong'})});
  assert.equal(denied.status,401);
  const login=await fetch(base+'/finance-api/login',{method:'POST',headers:{origin:publicOrigin,'content-type':'application/json'},body:JSON.stringify({password:owner})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/Secure/);
  assert.ok(!cookie.includes(API_TOKEN));
  const authenticated=await (await fetch(base+'/finance-api/session',{headers:{cookie}})).json();
  assert.equal(authenticated.authenticated,true);
  const read=await fetch(base+'/finance-api/categories?project=personal&type=expense',{headers:{cookie}});
  assert.equal(read.status,200);assert.equal(upstreamCount,1);
  assert.equal((await read.json()).records.length,0);
  const noPosts=await fetch(base+'/finance-api/obligations',{method:'POST',headers:{cookie,origin:publicOrigin}});
  assert.equal(noPosts.status,405);
  const unknown=await fetch(base+'/finance-api/transactions',{headers:{cookie}});
  assert.equal(unknown.status,404);
  const old=await fetch(base+'/finance-api/categories?project=personal&admin=1',{headers:{cookie}});
  assert.equal(old.status,404);
  const forgedToken=cookie.split(';')[0].replace(/.$/,'x');
  const forged=await fetch(base+'/finance-api/categories?project=personal',{headers:{cookie:forgedToken}});
  assert.equal(forged.status,401);
  const logout=await fetch(base+'/finance-api/logout',{method:'POST',headers:{cookie,origin:publicOrigin}});
  assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  const afterLogout=await fetch(base+'/finance-api/categories?project=personal',{headers:{cookie}});
  assert.equal(afterLogout.status,401);
 }finally {await close(gate);await close(upstream);}
});
test('gateway blocks repeated wrong passwords',async()=>{
 const g=createFinanceBrowserGateway({publicOrigin,apiToken:API_TOKEN,sessionSecret,passwordDigest:passwordHash(owner)});
 const base=await listen(g);
 try{
  const send=()=>fetch(base+'/finance-api/login',{method:'POST',headers:{origin:publicOrigin},body:JSON.stringify({password:'wrong'})});
  for(let i=0;i<5;i++) assert.equal((await send()).status,401);
  assert.equal((await send()).status,429);
 }finally{await close(g);}
});
