import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {makeGateway} from './gateway.mjs';
const token = 'a'.repeat(40), key = 'b'.repeat(40), origin = 'https://finances.screening40.com.ua';
async function harness(run) {
  const calls = [];
  const server = makeGateway({apiToken:token, gatewayKey:key, origin,
    fetchImpl: async (url, init) => {calls.push({url:String(url), init}); return new Response(JSON.stringify({ok:true}),{status:200});}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await run('http://127.0.0.1:'+server.address().port, calls); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
test('rejects direct loopback callers without independent gateway secret', async()=>harness(async(url,calls)=>{
  assert.equal((await fetch(url+'/health')).status,403); assert.equal(calls.length,0);
}));
test('accepts Caddy-injected key, injects backend bearer without forwarding client auth', async()=>harness(async(url,calls)=>{
  const response=await fetch(url+'/obligations',{headers:{'x-finances-gateway-key':key,'authorization':'Basic not-a-token'}});
  assert.equal(response.status,200);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'http://api:8091/obligations');
  assert.equal(calls[0].init.headers.authorization,'Bearer '+token);
}));
test('POST requires matching Origin, same-site fetch metadata and JSON',async()=>harness(async(url,calls)=>{
  const p='/obligations';
  const h={'x-finances-gateway-key':key,'content-type':'application/json'};
  assert.equal((await fetch(url+p,{method:'POST',headers:h,body:'{}'})).status,403);
  assert.equal((await fetch(url+p,{method:'POST',headers:{...h,origin:'https://malicious.example'},body:'{}'})).status,403);
  assert.equal((await fetch(url+p,{method:'POST',headers:{...h,origin,'sec-fetch-site':'cross-site'},body:'{}'})).status,403);
  assert.equal((await fetch(url+p,{method:'POST',headers:{...h,origin,'sec-fetch-site':'same-origin'},body:'{}'})).status,200);
  assert.equal(calls.length,1);
}));
test('blocks unknown endpoints and oversized writes',async()=>harness(async(url,calls)=>{
  const h={'x-finances-gateway-key':key,'content-type':'application/json',origin};
  assert.equal((await fetch(url+'/internal',{headers:h})).status,404);
  assert.equal((await fetch(url+'/payments',{method:'POST',headers:h,body:'x'.repeat(32769)})).status,413);
  assert.equal(calls.length,0);
}));
test('requires different API and gateway secrets',()=>{
  assert.throws(()=>makeGateway({apiToken:token,gatewayKey:token,origin}),/differ/);
});
