// Synthetic CI end-to-end: browser(client) -> Docker gateway -> isolated fake finance API.
// Never run against the production gateway or any real finance records.
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
const base='http://gateway:8092';
const origin='https://finance.example.test';
async function request(path, options={}) {
 return fetch(base+path,{...options,signal:AbortSignal.timeout(4000)});
}
let ready=false;
for(let i=0;i<45;i++){
 try{const r=await request('/finance-api/session');if(r.status===200){ready=true;break;}}catch{}
 await delay(200);
}
assert.ok(ready,'Docker candidate gateway failed to start');
const session=await request('/finance-api/session');
assert.equal(session.status,200);
assert.deepEqual(await session.json(),{authenticated:false});
for(const path of ['/finance-api/categories?project=personal&type=expense','/finance-api/obligations']){
 assert.equal((await request(path)).status,401,'Anonymous finance access must be denied');
}
const csrf=await request('/finance-api/login',{method:'POST',headers:{origin:'https://other.example'},body:JSON.stringify({password:'synthetic-owner-password-long-enough'})});
assert.equal(csrf.status,403);
const wrong=await request('/finance-api/login',{method:'POST',headers:{origin},body:JSON.stringify({password:'wrong'})});
assert.equal(wrong.status,401);
const login=await request('/finance-api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:'synthetic-owner-password-long-enough'})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie')||'';
assert.match(cookie,/HttpOnly/);
assert.match(cookie,/SameSite=Strict/);
assert.match(cookie,/Secure/);
const headers={cookie};
assert.deepEqual(await (await request('/finance-api/session',{headers})).json(),{authenticated:true});
const categories=await request('/finance-api/categories?project=personal&type=expense',{headers});
assert.equal(categories.status,200);
assert.deepEqual((await categories.json()).records.map(x=>x.id),['synthetic-category']);
const obligations=await request('/finance-api/obligations',{headers});
assert.equal(obligations.status,200);
assert.deepEqual((await obligations.json()).records.map(x=>x.id),['synthetic-only']);
assert.equal((await request('/finance-api/obligations',{method:'POST',headers:{...headers,origin}})).status,405);
assert.equal((await request('/finance-api/session',{headers:{origin:'https://other.example',cookie}})).status,403);
const logout=await request('/finance-api/logout',{method:'POST',headers:{...headers,origin}});
assert.equal(logout.status,200);
assert.deepEqual(await (await request('/finance-api/session',{headers})).json(),{authenticated:false});
assert.equal((await request('/finance-api/obligations',{headers})).status,401);
console.log('SYNTHETIC_GATEWAY_DOCKER_E2E_PASS: login/session/private GET/logout/CSRF/anonymous deny');
