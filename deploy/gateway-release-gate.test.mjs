import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {evaluateGatewayRelease,GATE_KEYS} from './gateway-release-gate.mjs';

test('T007 release blocks unknown or unproven production conditions',()=>{
 const none=evaluateGatewayRelease({});
 assert.equal(none.decision,'blocked');
 assert.deepEqual(none.blocked,GATE_KEYS);
 assert.equal(evaluateGatewayRelease(Object.fromEntries(GATE_KEYS.map(k=>[k,'yes']))).decision,'blocked');
 assert.throws(()=>evaluateGatewayRelease(null),/evidence/);
 assert.throws(()=>evaluateGatewayRelease([]),/evidence/);
});
test('T007 release requires every independently evidenced gate, not just network/CI success',()=>{
 const complete=Object.fromEntries(GATE_KEYS.map(k=>[k,true]));
 assert.equal(evaluateGatewayRelease(complete).decision,'eligible_for_controlled_deployment');
 for(const gate of GATE_KEYS){
   const evidence={...complete,[gate]:false};
   assert.equal(evaluateGatewayRelease(evidence).decision,'blocked',gate);
   assert.deepEqual(evaluateGatewayRelease(evidence).blocked,[gate],gate);
 }
});
test('existing automatic finance API deploy cannot be confused with gateway release',()=>{
 const wf=readFileSync(new URL('../.github/workflows/manual-finance-deploy.yml',import.meta.url),'utf8');
 const source=readFileSync(new URL('./gateway-release-gate.mjs',import.meta.url),'utf8');
 assert.match(wf,/Deploy only finance SQL migrations and API/);
 assert.doesNotMatch(wf,/gateway-release-gate\.mjs/);
 assert.doesNotMatch(source,/docker\s+(?:run|stop|restart|compose)|ssh\s|scp\s|aws\s|FINANCES_API_TOKEN|\.env/);
});
