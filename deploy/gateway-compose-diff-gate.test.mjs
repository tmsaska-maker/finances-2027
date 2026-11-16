import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateFinanceGatewayCompose} from './gateway-compose-diff-gate.mjs';
const image='finances2027-gateway-candidate:'+'a'.repeat(40);
const env={
 NODE_ENV:'production',FINANCES_GATEWAY_API_ORIGIN:'http://api:8091',
 FINANCES_GATEWAY_BIND_HOST:'0.0.0.0',FINANCES_API_TOKEN:'synthetic-token',
 FINANCES_SESSION_SECRET:'synthetic-session',FINANCES_OWNER_PASSWORD_HASH:'synthetic-hash',
 FINANCES_PUBLIC_ORIGIN:'https://finance.example.test'
};
const source={
 name:'finances2027',
 services:{
  db:{image:'postgres:16-alpine',environment:{POSTGRES_PASSWORD:'synthetic-private-placeholder'}},
  api:{image:'finances2027-api:test',networks:{finances_private:null}},
  gateway:{image:'old-image',networks:['finances_private'],ports:[{host_ip:'127.0.0.1',published:'8092',target:8092}]}
 },
 networks:{finances_private:{}},volumes:{finances_db:{}}
};
const safe=structuredClone(source);
safe.services.gateway={
 image,networks:['finances_private'],ports:[{host_ip:'127.0.0.1',published:'8092',target:8092,protocol:'tcp'}],
 read_only:true,cap_drop:['ALL'],security_opt:['no-new-privileges:true'],environment:env
};
test('offline finance-only docker compose diff accepts strictly isolated candidate shape',()=>{
 assert.equal(validateFinanceGatewayCompose(source,safe,image).decision,'safe_shape_only');
});
test('offline release refuses changing any API/database/networks or exposing gateway host port',()=>{
 const cases=[
  x=>x.services.api.image='wrong-api',
  x=>x.services.db.environment.POSTGRES_PASSWORD='unexpected-database-change',
  x=>x.networks.other={},
  x=>x.services.gateway.ports[0].host_ip='0.0.0.0',
  x=>x.services.gateway.ports.push({host_ip:'127.0.0.1',published:'8093',target:8092}),
  x=>x.services.gateway.networks={other:null},
  x=>x.services.gateway.read_only=false,
  x=>x.services.gateway.security_opt=[],
  x=>x.services.gateway.cap_drop=[],
  x=>x.services.gateway.environment.FINANCES_GATEWAY_API_ORIGIN='http://external.example:8091',
  x=>x.services.gateway.environment.FINANCES_OWNER_PASSWORD_HASH='',
  x=>x.services.unrelated={image:'other'}
 ];
 for(const mutate of cases){
  const candidate=structuredClone(safe);mutate(candidate);
  const result=validateFinanceGatewayCompose(source,candidate,image);
  assert.equal(result.decision,'blocked',JSON.stringify(result.issues));
 }
});
