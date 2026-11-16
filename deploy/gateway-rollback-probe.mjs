// Probe only the isolated synthetic rollback network (no credentials/data).
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
let pass=false;
for(let n=0;n<40;n++){
 try{
  const r=await fetch('http://gateway:8092/finance-api/session',{signal:AbortSignal.timeout(1500)});
  const payload=await r.json();
  if(r.status===403&&payload?.error==='Forbidden'){pass=true;break;}
 }catch{}
 await delay(200);
}
assert.ok(pass,'Synthetic old gateway was not restored');
const privateRead=await fetch('http://gateway:8092/finance-api/obligations',{signal:AbortSignal.timeout(2500)});
assert.equal(privateRead.status,403);
console.log('SYNTHETIC_OLD_GATEWAY_RESPONSE_VERIFIED');
