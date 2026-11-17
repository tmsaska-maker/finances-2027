import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const probe=readFileSync(new URL('./finance-gateway-real-offline-probe.py',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/manual-finance-deploy.yml',import.meta.url),'utf8');
test('only manual finance operation can attempt the genuine old image offline probe',()=>{
 assert.match(workflow,/^  workflow_dispatch:/m);
 assert.match(workflow,/          - probe-gateway-offline/);
 assert.match(workflow,/if: inputs.operation == 'probe-gateway-offline'/);
 assert.match(workflow,/finance-gateway-real-offline-probe\.py/);
 assert.match(workflow,/8bf0f2b0a59909bbff3a667e7c025b192123acdc/);
 assert.doesNotMatch(workflow,/^  push:|^  schedule:/m);
});
test('offline probe has no route to DB/host, uses only preserved image, fails closed',()=>{
 for(const phrase of ['--network","none','--read-only','--cap-drop","ALL',
   '--security-opt","no-new-privileges','--pids-limit','--memory','--cpus',
   '--restart","no','--pull","never','image_contains_sensitive_environment',
   'old_image_declares_volumes','archive.sha256','original-gateway-image.tar',
   'live_gateway_no_longer_matches_snapshot','--tmpfs',
   'FINANCE_GATEWAY_OFFLINE_','PRODUCTION_ROLLBACK","unverified',
   'LIVE_GATEWAY","unchanged','LIVE_API","unchanged',
   'docker","rm','checksum.hexdigest()','functional_start_not_confirmed_without_live_secrets']){
   assert.ok(probe.includes(phrase),'Missing safety control '+phrase);
 }
 assert.doesNotMatch(probe,/["'](?:stop|restart|kill|compose|load|pull|push|prune|system)["']/);
 assert.doesNotMatch(probe,/\bdocker\s+(?:compose|load|pull|push|stop|restart|kill|prune|system)|\baws\b|\bssh\b|\bscp\b/);
 assert.doesNotMatch(probe,/--network","(?:host|bridge)|--publish|-p","/);
 assert.doesNotMatch(probe,/\/etc\/caddy|screening40|FINANCES_DATABASE_URL/);
 assert.doesNotMatch(probe,/print\((?:obj|images|metadata|builtins|img|archive|check_line|old_id|api_id|probe)\)/);
 execFileSync('python3',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:probe,encoding:'utf8'});
});
test('offline diagnostics emit only allowlisted exit and environment-key classifications',()=>{
 for(const p of ['EXIT_CLASS','ENV_KEY_DELTA_CLASS','ENV_KEY_DELTA_COUNT_CLASS','classify_exit','classify_env_key_delta'])
   assert.ok(probe.includes(p),'Missing diagnostic '+p);
 assert.doesNotMatch(probe,/docker\s+logs|["']logs["']|process\.stdout|\bprint\((?:state|keys|missing|entries|builtins|key|value)\b/);
 execFileSync('python3',['-m','unittest','discover','-s','deploy','-p','finance-gateway-offline-diagnostics.test.py','-v'],{
   cwd:new URL('..',import.meta.url).pathname,encoding:'utf8'
 });
});
test('production rollback gate must remain blocked despite old-image isolated launch',()=>{
 const gate=readFileSync(new URL('./gateway-release-gate.mjs',import.meta.url),'utf8');
 const doc=readFileSync(new URL('../docs/T007_REAL_GATEWAY_RECOVERY_CHECK.md',import.meta.url),'utf8');
 assert.match(gate,/rollback_rehearsal_passed/);
 assert.match(doc,/не можна/);
});
