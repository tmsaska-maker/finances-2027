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
test('single finance DB deploy applies 007/008 and never performs backup, restore or second DB',()=>{
 assert.match(wf,/StrictHostKeyChecking=yes/);
 assert.match(wf,/server\/sql\/00\{7,8\}_\*\.sql/);
 assert.match(wf,/if: inputs.operation == 'deploy'/);
 assert.match(script,/ROOT=\/opt\/finances-2027/);
 assert.match(script,/APP="\$ROOT\/backend\/deploy"/);
 assert.match(script,/finances2027/);
 assert.match(script,/007_monthly_forecast/);
 assert.match(script,/008_forecast_revision_audit/);
 assert.match(script,/final_versions/);
 assert.match(script,/--no-build --no-deps api/);
 assert.match(script,/Forecast|forecast\/monthly/);
 assert.match(script,/Unexpected forecast migration state; abort/);
 for(const unsafe of ['pg_dump','pg_restore','createdb','dropdb','BACKUP_BUCKET','BACKUP_PREFIX','backup-export.dump','offsite-backup-verified.sha256','aws s3','Finance backup and isolated restore test']) {
  assert.ok(!wf.includes(unsafe)&&!script.includes(unsafe),'Forbidden backup/clone operation: '+unsafe);
 }
 assert.doesNotMatch(wf,/snapshot-gateway|probe-gateway-offline|inspect-gateway-snapshot/);
 assert.doesNotMatch(script,/docker\s+compose\s+down/);
 execFileSync('bash',['-n',new URL('./manual-finance-release.sh',import.meta.url).pathname]);
});
test('finance API Docker image includes forecast runtime modules',()=>{
 const docker=readFileSync(new URL('../server/Dockerfile',import.meta.url),'utf8');
 assert.ok(docker.includes("COPY main.mjs http.mjs repository.mjs validation.mjs monthly-planning.mjs monthly-forecast-repository.mjs"));
 assert.doesNotMatch(docker,/COPY\\s+\\.\\s+\\./);
});
test('existing finance stack is reused; no gateway/Caddy/Screening40 writes in release',()=>{
 assert.match(script,/docker compose --env-file "\$APP\/\.env" -f "\$APP\/compose\.yaml" -f "\$override" up -d --no-build --no-deps api/);
 assert.doesNotMatch(script,/docker\s+(?:volume\s+create|run|compose\s+down)|systemctl|caddy\s+reload|postgres\s+-D/);
 assert.match(wf,/github\.ref == 'refs\/heads\/main'/);
 assert.match(wf,/test "\$APPROVED_SHA" = "\$GITHUB_SHA"/);
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

test('T007 anonymous gateway probe is GET-only and never sends cookies, passwords or bodies to logs',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  const probe=edge.split('# Anonymous safety probe.')[1]||'';
  assert.ok(probe.length>400);
  assert.match(probe,/Request\(url,headers=\{"Accept":"application\/json"\},method="GET"\)/);
  assert.match(probe,/timeout=3/);
  assert.match(probe,/anonymous_gateway8092_session_class=/);
  assert.match(probe,/gateway8092_obligations/);
  assert.doesNotMatch(probe,/method="POST"|Authorization|Bearer|Cookie|print\(raw\)|print\(data\)/);
  execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});

test('T007 gateway forensics inspect process identity without exposing process details or response bodies',()=>{
 const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
 const section=edge.split('# Diagnostics of *existing* 8092 service:')[1];
 assert.ok(section && section.length>1600);
 assert.match(section,/tcp_port_8092_identity=/);
 assert.match(section,/tcp_port_8092_workdir=/);
 assert.match(section,/browser-gateway-main\.mjs/);
 assert.match(section,/expected_host/);
 assert.match(section,/expected_https_proxy/);
 assert.match(section,/method="GET"/);
 assert.match(section,/gateway8092_session_.*_response_class=/);
 assert.doesNotMatch(section,/print\((?:args|joined|path|pids|raw|parsed|headers|output)\)/);
 assert.doesNotMatch(section,/method="POST"|FINANCES_API_TOKEN|FINANCES_SESSION_SECRET|\bAuthorization\b|\bBearer\b/);
 const python=section.match(/python3 -c '\n([\s\S]*?)\n' 2>\/dev\/null/)?.[1];
 assert.ok(python,'Expected Python diagnostic script');
 // Syntax validation does not execute network or process queries.
 execFileSync('python3',['-c','import sys;compile(sys.stdin.read(),"<read-only-inspect>","exec")'],{input:python,encoding:'utf8'});
 execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});

test('T007 container owner check is strictly read-only and prints only whitelisted classifications',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  const check=edge.split('# Determine Docker owner of host port 8092')[1]||'';
  assert.match(check,/docker_host8092_project_class=/);
  assert.match(check,/docker_host8092_service_class=/);
  assert.match(check,/\.HostConfig\.PortBindings/);
  assert.match(check,/\.Config\.Labels/);
  assert.doesNotMatch(check,/\.Config\.Env|docker\s+exec|docker\s+stop|docker\s+restart|print\(cid\)|print\(image\)|print\(ports\)|print\(project\)|print\(service\)/);
  const python=check.match(/python3 -c '\n([\s\S]*?)\n' 2>\/dev\/null/)?.[1];
  assert.ok(python,'Expected Python script for port classification');
  execFileSync('python3',['-c','import sys;compile(sys.stdin.read(),"<docker-owner>","exec")'],{input:python,encoding:'utf8'});
  execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});

test('T007 gateway runtime provenance is inspect-only and never logs raw Docker metadata',()=>{
  const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
  const segment=edge.split('# Runtime provenance, strictly limited')[1]||'';
  assert.ok(segment.length>1800);
  assert.match(segment,/finance_gateway_runtime_class=/);
  assert.match(segment,/finance_gateway_command_class=/);
  assert.match(segment,/finance_gateway_compose_config_class=/);
  assert.match(segment,/finance_gateway_app_mount_class=/);
  assert.match(segment,/finance_gateway_anonymous_denial_reason_class=/);
  assert.match(segment,/if labels\.get\("com\.docker\.compose\.project"\)!="finances2027"/);
  assert.match(segment,/labels\.get\("com\.docker\.compose\.service"\)!="gateway"/);
  assert.doesNotMatch(segment,/print\((?:obj|cfg|cmd|entry|command|labels|source|mounts|raw|payload|err|cid|ids)\)/);
  assert.doesNotMatch(segment,/docker\s+(?:exec|run|restart|kill|stop|rm)|\.Config\.Env|\.Env\b|method="POST"/);
  const body=segment.match(/python3 -c '\n([\s\S]*?)\n' 2>\/dev\/null/)?.[1];
  assert.ok(body);
  execFileSync('python3',['-c','import sys;compile(sys.stdin.read(),"<gateway-runtime>","exec")'],{input:body,encoding:'utf8'});
  execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});

test('T007 gateway candidate is package-only and never reaches Lightsail or Screening40',()=>{
 const gateway=readFileSync(new URL('../.github/workflows/manual-private-finance-gateway-build.yml',import.meta.url),'utf8');
 const dockerfile=readFileSync(new URL('../server/Dockerfile.gateway',import.meta.url),'utf8');
 assert.match(gateway,/^on:\n  workflow_dispatch:/m);
 assert.match(gateway,/github.ref == 'refs\/heads\/main'/);
 assert.match(gateway,/node --test.*browser-gateway\.test\.mjs/);
 assert.match(gateway,/docker build -f server\/Dockerfile\.gateway/);
 assert.match(gateway,/--network none --read-only --cap-drop ALL/);
 assert.match(gateway,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(gateway,/aws-actions|aws lightsail|ssh\s|scp\s|docker\s+(?:push|load)|docker compose up|--network host|VITE_FINANCES_PRIVATE_UI/);
 assert.match(dockerfile,/COPY browser-gateway\.mjs browser-gateway-main\.mjs/);
 assert.match(dockerfile,/USER node/);
 assert.doesNotMatch(dockerfile,/FINANCES_API_TOKEN|FINANCES_SESSION_SECRET|FINANCES_OWNER_PASSWORD_HASH|COPY\s+\.\s+\.|COPY\s+\.env/);
 assert.doesNotMatch(dockerfile,/EXPOSE 8091/);
});

test('T007 live finance topology and rollback prerequisites inspection is strictly read-only',()=>{
 const edge=readFileSync(new URL('./finance-edge-readonly-inspect.sh',import.meta.url),'utf8');
 const section=edge.split('# Finance-only deployment readiness:')[1]?.split('FINANCE_EDGE_READONLY_INSPECTION_END')[0]||'';
 assert.ok(section.length>1600);
 for(const name of ['finance_runtime_gateway_count_class','finance_runtime_api_count_class','finance_gateway_rollback_class','finance_gateway_restart_policy_class','finance_gateway_api_network_class'])
   assert.ok(section.includes(name+'='),'Missing classification: '+name);
 assert.match(section,/com\.docker\.compose\.project/);
 assert.match(section,/com\.docker\.compose\.service/);
 assert.match(section,/shared_network_api_alias/);
 assert.match(section,/compose_source_not_verified/);
 assert.match(section,/image_not_cached/);
 assert.match(section,/\/opt\/finances-2027\//);
 assert.doesNotMatch(section,/docker\s+(?:exec|run|stop|restart|rm|rmi|pull|load|save|compose up|network create)|print\((?:cid|ids|gateway|api|obj|labels|paths|image|raw|gw_networks|api_networks|finance)\)/);
 assert.doesNotMatch(section,/\.Env|os\.environ|FINANCES_API_TOKEN|FINANCES_SESSION_SECRET|FINANCES_OWNER_PASSWORD_HASH|docker\s+logs/);
 const body=section.match(/python3 -c '\n([\s\S]*?)\n' 2>\/dev\/null/)?.[1];
 assert.ok(body,'Expected read-only Python classifier');
 execFileSync('python3',['-c','import sys;compile(sys.stdin.read(),"<finance-topology>","exec")'],{input:body,encoding:'utf8'});
 execFileSync('bash',['-n',new URL('./finance-edge-readonly-inspect.sh',import.meta.url).pathname]);
});



test('private finance release keeps one existing website, gateway and DB',()=>{
 const script=readFileSync(new URL('./private-finance-site-release.sh',import.meta.url),'utf8');
 for(const token of ["          - private-ui","if: inputs.operation == 'private-ui'","VITE_FINANCES_PRIVATE_UI: 'true'","finances2027-private-ui-","finances2027-private-gateway-","private-finance-site-release.sh"]) {
  assert.ok(wf.includes(token),'Missing private release workflow step: '+token);
 }
 for(const token of ['SITE="$ROOT/site"','FINANCES_GATEWAY_API_ORIGIN: http://api:8091','127.0.0.1:8092:8092','FINANCES_OWNER_PASSWORD_HASH','handle /finance-api/*','caddy validate','caddy reload','--no-build --no-deps gateway','PRIVATE_FINANCE_SITE_DEPLOY_PASS']) {
  assert.ok(script.includes(token),'Missing private release safeguard: '+token);
 }
 for(const token of ["statuses[-1][1]!='401'",'www-authenticate:', 'realm="restricted"', 'Finance HTTPS outer Basic protection PASS']) {
  assert.ok(script.includes(token),'Private site must preserve existing outer Caddy Basic protection: '+token);
 }
 assert.ok(!script.includes("'--fail','--max-time','8','--resolve'"),'Do not reject expected HTTPS 401 before evaluating its challenge');
 for(const unsafe of ['pg_dump','pg_restore','createdb','dropdb','docker volume','aws s3','snapshot','backup-export','down -v','--remove-orphans']) {
  assert.ok(!script.includes(unsafe),'Forbidden database/backup operation: '+unsafe);
 }
 const blocks=[...script.matchAll(/python3 - <<'PY'\n([\s\S]*?)\nPY/g)].map(match=>match[1]);
 assert.equal(blocks.length,2,'Expected readiness and HTTPS inline Python blocks');
 for(const [index,code] of blocks.entries()){
  execFileSync('python3',['-c','import sys;compile(sys.stdin.read(), "inline-finance-"+sys.argv[1], "exec")',String(index)],{input:code,encoding:'utf8'});
 }
 execFileSync('bash',['-n',new URL('./private-finance-site-release.sh',import.meta.url).pathname]);
});
