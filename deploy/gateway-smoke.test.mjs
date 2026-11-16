import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

test('gateway Docker integration is synthetic-only, internal and not deployed',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/manual-private-finance-gateway-build.yml',import.meta.url),'utf8');
 const smoke=readFileSync(new URL('./gateway-docker-smoke.sh',import.meta.url),'utf8');
 const fake=readFileSync(new URL('./gateway-smoke-fake-api.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('./gateway-smoke-client.mjs',import.meta.url),'utf8');
 assert.match(workflow,/gateway-docker-smoke.sh/);
 assert.match(workflow,/docker build -f server\/Dockerfile.gateway/);
 assert.match(smoke,/docker network create --internal/);
 assert.match(smoke,/--network "\$NETWORK"/);
 assert.match(smoke,/--read-only --cap-drop ALL/);
 assert.match(smoke,/--network-alias api/);
 assert.match(smoke,/--network-alias gateway/);
 assert.match(smoke,/FINANCES_GATEWAY_API_ORIGIN=http:\/\/api:8091/);
 assert.match(smoke,/trap cleanup EXIT/);
 assert.doesNotMatch(smoke,/-p\s+|--publish|--network host|docker compose up|\bssh\b|\bscp\b|aws |\.env|docker push|\/opt\/finances-2027/);
 assert.doesNotMatch(fake,/FINANCES_DATABASE_URL|postgres|screening40|https?:\/\/(?!127\.0\.0\.1)/);
 assert.match(client,/SYNTHETIC_GATEWAY_DOCKER_E2E_PASS/);
 assert.match(client,/\/finance-api\/logout/);
 assert.match(client,/\/finance-api\/obligations/);
 assert.match(client,/\/finance-api\/session/);
 assert.match(client,/\/finance-api\/login/);
 execFileSync('bash',['-n',new URL('./gateway-docker-smoke.sh',import.meta.url).pathname]);
 for(const path of ['./gateway-smoke-fake-api.mjs','./gateway-smoke-client.mjs','../server/browser-gateway-main.mjs']){
   execFileSync('node',['--check',new URL(path,import.meta.url).pathname]);
 }
});
