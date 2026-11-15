import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const wf=readFileSync(new URL('../.github/workflows/manual-finance-deploy.yml',import.meta.url),'utf8');
const script=readFileSync(new URL('./manual-finance-release.sh',import.meta.url),'utf8');
test('manual finance deploy has no push/schedule trigger and requires main SHA',()=>{
  assert.match(wf,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(wf,/^  push:/m);
  assert.doesNotMatch(wf,/^  schedule:/m);
  assert.match(wf,/github\.ref == 'refs\/heads\/main'/);
  assert.match(wf,/test "\$APPROVED_SHA" = "\$GITHUB_SHA"/);
});
test('restore drill, S3 and finance-only deployment gates are mandatory',()=>{
  for(const key of ['FINANCES_LIGHTSAIL_INSTANCE_NAME','FINANCES_AWS_DEPLOY_ROLE_ARN','FINANCES_BACKUP_BUCKET','--sse AES256','restore test','backup.sha256','offsite-backup-verified.sha256','StrictHostKeyChecking=yes','--no-build --no-deps api']) {
    assert.ok(wf.includes(key)||script.includes(key), 'Missing gate: '+key);
  }
  assert.match(script,/ROOT=\/opt\/finances-2027/);
  assert.match(script,/APP="\$ROOT\/backend"/);
  assert.match(script,/test .+ = finances2027/);
  assert.match(script,/\[\[ -s "\$MARKER" && -s "\$DUMP" \]\]/);
  assert.doesNotMatch(script,/docker\s+compose\s+down/);
  execFileSync('bash',['-n',new URL('./manual-finance-release.sh',import.meta.url).pathname]);
});
