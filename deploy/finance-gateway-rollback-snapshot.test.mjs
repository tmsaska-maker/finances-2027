import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const snapshot=readFileSync(new URL('./finance-gateway-rollback-snapshot.py',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/manual-finance-deploy.yml',import.meta.url),'utf8');

test('manual finance workflow no longer exposes snapshot operation',()=>{
 assert.match(workflow,/^  workflow_dispatch:/m);
 assert.match(workflow,/          - snapshot-gateway/);
 assert.match(workflow,/if: inputs.operation == 'snapshot-gateway'/);
 assert.match(workflow,/finance-gateway-rollback-snapshot\.py/);
 assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/concurrency:/);
 assert.doesNotMatch(workflow,/^  push:|^  schedule:/m);
});
test('real gateway no-start recovery exercise strictly preserves existing finance services',()=>{
 const markers=[
  'com.docker.compose.project','com.docker.compose.service',
  'finances2027','gateway','127.0.0.1','8092',
  'docker","save','docker","create','--network","none',
  '--read-only','--cap-drop','no-new-privileges',
  'image.sha256','archive.sha256',
  'FINANCE_GATEWAY_LIVE_CONTAINER=untouched',
  'FINANCE_GATEWAY_PRODUCTION_ROLLBACK=unverified'
 ];
 for(const marker of markers)assert.ok(snapshot.includes(marker),'Missing guard: '+marker);
 assert.match(snapshot,/tmp\.rename\(target\)/);
 assert.match(snapshot,/snapshot_already_exists/);
 assert.match(snapshot,/insufficient_private_disk/);
 assert.match(snapshot,/os\.chmod\(BACKUPS,0o700\)/);
 assert.match(snapshot,/os\.chmod\(path,0o600\)/);
 assert.match(snapshot,/docker","rm","-f",check_name/);
 assert.doesNotMatch(snapshot,/["'](?:run|start|restart|stop|kill|compose|load|pull|push)["']/);
 assert.doesNotMatch(snapshot,/\b(?:print|logging\.info)\s*\(\s*(?:obj|image|inspected|raw|labels|sources|env|archive|cid|target|tmp)\b/);
 assert.doesNotMatch(snapshot,/screening40|\/(?:etc\/caddy|opt\/screening40)/i);
 execFileSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:snapshot,encoding:'utf8'});
});
test('no production rollback pass is claimed by image snapshot alone',()=>{
 const doc=readFileSync(new URL('../docs/T007_REAL_GATEWAY_RECOVERY_CHECK.md',import.meta.url),'utf8');
 assert.match(doc,/rollback_rehearsal_passed/);
 assert.match(doc,/не можна/);
 assert.match(doc,/не запускається|не перезапускається/);
});
