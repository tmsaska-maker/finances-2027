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
  assert.match(script,/APP="\$ROOT\/backend\/deploy"/);
  assert.match(script,/test .+ = finances2027/);
  assert.match(script,/\[\[ -s "\$MARKER" && -s "\$DUMP" \]\]/);
  assert.doesNotMatch(script,/docker\s+compose\s+down/);
  execFileSync('bash',['-n',new URL('./manual-finance-release.sh',import.meta.url).pathname]);
});

test('shared existing S3 bucket is used with finance-only prefix and repo-scoped OIDC trust',()=>{
  const trust=JSON.parse(readFileSync(new URL('../infra/aws/finance-github-oidc-trust.template.json',import.meta.url),'utf8'));
  const permissions=JSON.parse(readFileSync(new URL('../infra/aws/finance-deploy-policy.template.json',import.meta.url),'utf8'));
  assert.equal(trust.Statement[0].Condition.StringEquals['token.actions.githubusercontent.com:sub'],'repo:tmsaska-maker@258178043/finances-2027@1450410210:ref:refs/heads/main');
  const objectPermissions=permissions.Statement.filter(s=>String(s.Resource).includes('/*'));
  assert.ok(objectPermissions.length>=2);
  assert.ok(objectPermissions.every(s=>s.Resource === 'arn:aws:s3:::screening40-staging-backups/finance/postgresql/*'));
  assert.match(wf,/BACKUP_PREFIX: finance\/postgresql/);
  assert.match(wf,/OBJECT_KEY="\$BACKUP_PREFIX\//);
  assert.doesNotMatch(wf,/\.Value == "Finances2027"/);
});

test('finance deploy S3 permissions cannot write screening backups',()=>{
  const policy=JSON.parse(readFileSync(new URL('../infra/aws/finance-s3-backup-inline-policy.json',import.meta.url),'utf8'));
  const statements=policy.Statement;
  assert.equal(statements.length,3);
  for(const s of statements.filter(v=>String(v.Resource).includes('/*'))) {
    assert.equal(s.Resource,'arn:aws:s3:::screening40-staging-backups/finance/postgresql/*');
  }
  assert.ok(statements.find(v=>v.Action==='s3:PutObject').Condition.StringEquals['s3:x-amz-server-side-encryption']==='AES256');
  assert.match(wf,/--metadata "sha256=\$EXPECTED"/);
  assert.match(wf,/\.Metadata\.sha256 == \$sha/);
  assert.match(script,/rm -f -- "\$DUMP"/);
  assert.ok(script.lastIndexOf('rm -f -- "$DUMP"')>script.indexOf('Finance API smoke PASS'));
});

test('backup verification checksum is SSH-readable but finance dump stays private',()=>{
  assert.match(script,/chown "\$\{SUDO_USER:\?SUDO_USER required\}" "\$STAGE\/backup\.sha256"/);
  assert.match(script,/chmod 600 "\$STAGE\/backup\.sha256"/);
  assert.ok(script.indexOf('chown "${SUDO_USER:?SUDO_USER required}" "$STAGE/backup.sha256"') >
    script.indexOf('sha256sum "$DUMP" > "$STAGE/backup.sha256"'));
  assert.match(script,/chown "\$SUDO_USER" "\$STAGE\/backup-export\.dump"/);
});

test('live finance audit is manual, counts-only, and refuses writes',()=>{
  const audit=readFileSync(new URL('./finance-live-readonly-audit.sh',import.meta.url),'utf8');
  assert.match(wf,/          - audit/);
  assert.match(wf,/if: inputs.operation == 'audit'/);
  assert.match(wf,/finance-live-readonly-audit\.sh/);
  assert.match(audit,/BEGIN TRANSACTION READ ONLY;/);
  assert.match(audit,/data_rows\|accounts/);
  assert.match(audit,/data_rows\|transactions/);
  assert.match(audit,/data_rows\|obligations/);
  assert.match(audit,/data_rows\|payments/);
  assert.doesNotMatch(audit,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\s+(?:INTO|TABLE|FROM|finance_|accounts|transactions|obligations|payments)/i);
  execFileSync('bash',['-n',new URL('./finance-live-readonly-audit.sh',import.meta.url).pathname]);
});

test('T007 edge preflight is manual, read-only, and never dumps Caddy secrets or mutates shared server',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  assert.match(wf,/          - inspect-edge/);
  assert.match(wf,/if: inputs.operation == 'inspect-edge'/);
  assert.match(wf,/finance-edge-readonly-inspect\.sh/);
  assert.match(edge,/FINANCE_EDGE_READONLY_INSPECTION_BEGIN/);
  assert.match(edge,/FINANCE_EDGE_READONLY_INSPECTION_END/);
  assert.match(edge,/tcp_port_\$\{port\}/);
  const executable=edge.split('\n').filter(line=>!/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(executable,/\b(?:cat|sed|head|tail|printenv|env|docker inspect|docker logs|systemctl cat|jq)\s+.*(?:Caddyfile|\.env|secrets|token)/i);
  assert.doesNotMatch(edge,/\b(?:systemctl restart|systemctl reload|docker compose up|docker compose down|iptables|ufw|tee|chown|chmod|rm -rf|curl)\b/);
  execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});

test('T007 edge classifier recognizes genuine loopback and non-loopback listeners',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  assert.match(edge,/127\[\.\]0\[\.\]0\[\.\]1/);
  assert.match(edge,/\[::1/);
  assert.doesNotMatch(edge,/127\\\\\.0\\\\\.0\\\\\.1/);
  const awkBody = edge.match(/state="\$\(ss -lntH \| awk -v p="\$port" '\n([\s\S]*?)\n    '\)"/)?.[1];
  assert.ok(awkBody,'Expected listener classifier');
  const sample = ['LISTEN 0 128 127.0.0.1:8091 0.0.0.0:*','LISTEN 0 128 [::1]:8092 [::]:*','LISTEN 0 128 0.0.0.0:443 0.0.0.0:*'].join('\n')+'\n';
  const awk = execFileSync('awk',['-v','p=8091',awkBody],{input:sample,encoding:'utf8'}).trim();
  assert.equal(awk,'loopback_only');
  assert.equal(execFileSync('awk',['-v','p=8092',awkBody],{input:sample,encoding:'utf8'}).trim(),'loopback_only');
  assert.equal(execFileSync('awk',['-v','p=443',awkBody],{input:sample,encoding:'utf8'}).trim(),'nonloopback_listener');
});

test('T007 route diagnostics emit only allowlisted classifications, never domains or raw Caddyfile',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  assert.match(edge,/tcp_port_%s_process_class=%s/);
  assert.match(edge,/classification="other_process"/);
  assert.match(edge,/caddy_server_blocks=%d/);
  assert.match(edge,/caddy_route_count=%d/);
  assert.match(edge,/finance_gateway_8092/);
  assert.match(edge,/caddy adapt --config \/etc\/caddy\/Caddyfile --adapter caddyfile 2>\/dev\/null/);
  assert.doesNotMatch(edge,/print\(config\)|print\(servers\)|print\(http\)|print\(dial\)|print\(line\)/);
  execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});
