import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('synthetic rollback rehearsal pins old image and restores only gateway with no host port',()=>{
 const s=readFileSync(new URL('./gateway-rollback-rehearsal.sh',import.meta.url),'utf8');
 const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 const fixture=readFileSync(new URL('./Dockerfile.gateway-rollback-fixture',import.meta.url),'utf8');
 assert.match(s,/docker network create --internal/);
 assert.match(s,/docker image inspect --format/);
 assert.match(s,/old_gateway\nprobe_old/);
 assert.match(s,/docker rm -f "\$GATE"/);
 assert.match(s,/SYNTHETIC_GATEWAY_ROLLBACK_REHEARSAL_PASS/);
 assert.match(s,/API_ID_BEFORE/);
 assert.match(s,/\{\{json \.HostConfig.PortBindings\}\}/);
 assert.match(s,/trap cleanup EXIT/);
 assert.doesNotMatch(s,/\bdocker\s+(?:compose|system prune|volume prune|network prune|push|pull|stop)|\baws\s|\bssh\s|\bscp\s|\b-p\s+|--publish|--network host|\/opt\/finances-2027|\/etc\/caddy|\.env/);
 assert.match(ci,/bash deploy\/gateway-rollback-rehearsal.sh/);
 assert.match(fixture,/COPY deploy\/gateway-rollback-legacy-fixture.mjs/);
 assert.doesNotMatch(fixture,/FINANCES_API_TOKEN|COPY\s+\.\s+\./);
 execFileSync('bash',['-n',new URL('./gateway-rollback-rehearsal.sh',import.meta.url).pathname]);
 for(const p of ['./gateway-rollback-legacy-fixture.mjs','./gateway-rollback-probe.mjs'])
   execFileSync('node',['--check',new URL(p,import.meta.url).pathname]);
});
