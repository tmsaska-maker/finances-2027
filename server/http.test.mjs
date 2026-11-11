import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { makeServer } from './http.mjs';
const token='test-token-with-32-chars-very-long';
test('API denies unauthenticated calls and unknown routes', async()=>{
 const fake={query:async()=>({rowCount:0,rows:[]})};
 const server=makeServer(fake,token);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
   const url='http://127.0.0.1:'+server.address().port;
   const deny=await fetch(url+'/health');assert.equal(deny.status,401);
   const ok=await fetch(url+'/health',{headers:{authorization:'Bearer '+token}});assert.equal(ok.status,200);
   const missing=await fetch(url+'/unknown',{headers:{authorization:'Bearer '+token}});assert.equal(missing.status,404);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
test('short server token is rejected',()=>assert.throws(()=>makeServer({},'short'),/token/));
