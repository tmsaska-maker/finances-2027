#!/usr/bin/env bash
# Single existing finance website, DB and gateway; never touch Screening40 host routes.
set -Eeuo pipefail
umask 077
SHA="$1"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
ROOT=/opt/finances-2027
APP="$ROOT/backend/deploy"
SITE="$ROOT/site"
STAGE="/tmp/finances2027-$SHA"
BASE="$APP/compose.yaml"
ENVFILE="$APP/.env"
OVERLAY="$STAGE/finance-private-gateway.yaml"
UI_TAR="$STAGE/finances2027-private-ui-$SHA.tar.gz"
GATEWAY_TAR="$STAGE/finances2027-private-gateway-$SHA.tar.gz"
test "$(id -u)" = 0
test -d "$SITE" && test -f "$BASE" && test -f "$ENVFILE"
test -s "$UI_TAR" && test -s "$GATEWAY_TAR"
test -f /etc/caddy/Caddyfile
command -v caddy >/dev/null
test "$(docker compose --env-file "$ENVFILE" -f "$BASE" config --format json | python3 -c 'import json,sys;print(json.load(sys.stdin).get("name",""))')" = finances2027
docker compose --env-file "$ENVFILE" -f "$BASE" ps --status running --services | grep -Fxq db
docker compose --env-file "$ENVFILE" -f "$BASE" ps --status running --services | grep -Fxq api
python3 - "$ENVFILE" <<'PY'
import sys
keys=set()
for line in open(sys.argv[1],encoding='utf8'):
 if line.lstrip().startswith('#') or '=' not in line:continue
 key,value=line.split('=',1)
 if key.strip() in ('FINANCES_API_TOKEN','FINANCES_SESSION_SECRET','FINANCES_OWNER_PASSWORD_HASH') and value.strip():keys.add(key.strip())
if len(keys)!=3:raise SystemExit('Existing finance gateway secrets missing; refusing release')
PY
D='$'
cat > "$OVERLAY" <<YAML
services:
  gateway:
    image: finances2027-gateway:$SHA
    restart: unless-stopped
    read_only: true
    environment:
      NODE_ENV: production
      FINANCES_GATEWAY_BIND_HOST: 0.0.0.0
      FINANCES_GATEWAY_API_ORIGIN: http://api:8091
      FINANCES_PUBLIC_ORIGIN: https://finances.screening40.com.ua
      FINANCES_API_TOKEN: $D{FINANCES_API_TOKEN:?Missing_api_token}
      FINANCES_SESSION_SECRET: $D{FINANCES_SESSION_SECRET:?Missing_session_secret}
      FINANCES_OWNER_PASSWORD_HASH: $D{FINANCES_OWNER_PASSWORD_HASH:?Missing_password_hash}
    ports:
      - "127.0.0.1:8092:8092"
    networks:
      - finances_private
    mem_limit: 128m
    pids_limit: 100
    security_opt:
      - no-new-privileges:true
YAML
docker compose --env-file "$ENVFILE" -f "$BASE" -f "$OVERLAY" config -q >/dev/null 2>&1 || { echo 'Finance gateway compose invalid'; exit 1; }
python3 - "$UI_TAR" "$SHA" <<'PY'
import sys,tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1],'r:gz') as tf:
 files=tf.getmembers()
 for f in files:
  p=PurePosixPath(f.name)
  if p.is_absolute() or '..' in p.parts or not(f.isfile() or f.isdir()):raise SystemExit('Unsafe UI archive')
 named={str(PurePosixPath(f.name)).removeprefix('./'):f for f in files if f.isfile()}
 if not {'index.html','revision.txt'}.issubset(named):raise SystemExit('Missing private UI entry or revision')
 if tf.extractfile(named['revision.txt']).read().decode().strip()!=sys.argv[2]:raise SystemExit('Private UI revision mismatch')
PY
python3 - "$STAGE" <<'PY'
import sys,re,stat
from pathlib import Path
original=Path('/etc/caddy/Caddyfile')
s=original.read_text()
matches=list(re.finditer(r'(?m)^[ \t]*finances\.screening40\.com\.ua[ \t]*\{[ \t]*(?:#.*)?$',s))
if len(matches)!=1:raise SystemExit('Expected one finance hostname in Caddyfile')
m=matches[0]
start=s.find('{',m.start());depth=0;end=None
for i in range(start,len(s)):
 if s[i]=='{':depth+=1
 elif s[i]=='}':
  depth-=1
  if depth==0:end=i+1;break
if end is None:raise SystemExit('Unbalanced finance Caddy block')
block=s[m.start():end]
if '/opt/finances-2027/site' not in block:raise SystemExit('Finance static root differs')
if '/finance-api/' in block:
 if '8092' not in block:raise SystemExit('Unexpected existing API route')
 updated=s
else:
 route='\n    handle /finance-api/* {\n        reverse_proxy 127.0.0.1:8092\n    }\n'
 updated=s[:start+1]+route+s[start+1:]
candidate=Path(sys.argv[1])/'Caddyfile.candidate'
candidate.write_text(updated)
candidate.chmod(stat.S_IMODE(original.stat().st_mode))
print('Finance Caddy block isolated; candidate ready')
PY
caddy validate --config "$STAGE/Caddyfile.candidate" --adapter caddyfile >/dev/null 2>&1 || { echo 'Caddy finance candidate invalid'; exit 1; }
docker load -i "$GATEWAY_TAR" >/dev/null
docker image inspect "finances2027-gateway:$SHA" >/dev/null
docker compose --env-file "$ENVFILE" -f "$BASE" -f "$OVERLAY" up -d --no-build --no-deps gateway
# Docker "Started" is not an HTTP readiness signal. Allow bounded startup time.
# Only check the existing finance gateway endpoint; never print response bodies or secrets.
python3 - <<'PY'
import json,time,urllib.request,urllib.error
endpoint='http://127.0.0.1:8092/finance-api/session'
ready=False
for attempt in range(20):
 try:
  with urllib.request.urlopen(endpoint,timeout=2) as response:
   ready=response.status==200 and json.load(response)=={'authenticated':False}
  if ready:break
 except (OSError,TimeoutError,ValueError,urllib.error.HTTPError):
  pass
 time.sleep(1)
if not ready:raise SystemExit('Finance gateway did not become HTTP-ready within startup window')
print('Private finance gateway session PASS')
PY
if ! docker compose --env-file "$ENVFILE" -f "$BASE" -f "$OVERLAY" ps --status running --services | grep -Fxq gateway; then
 echo 'Finance gateway is not running after readiness check; installation stopped safely'
 exit 1
fi
if ! cmp -s /etc/caddy/Caddyfile "$STAGE/Caddyfile.candidate";then
 caddy reload --config "$STAGE/Caddyfile.candidate" --adapter caddyfile >/dev/null 2>&1 || { echo 'Finance route reload failed'; exit 1; }
 install -m 644 "$STAGE/Caddyfile.candidate" /etc/caddy/Caddyfile
fi
# Preserve the existing Caddy HTTP Basic Authentication. An unauthenticated
# HTTPS probe must receive 401 + the exact known Basic challenge, not 200.
# The inner gateway was independently verified above using 127.0.0.1:8092.
python3 - <<'PY'
import subprocess
host='finances.screening40.com.ua'
p=subprocess.run([
 'curl','--silent','--show-error','--max-time','8',
 '--resolve',host+':443:127.0.0.1',
 '--dump-header','-','--output','/dev/null',
 'https://'+host+'/finance-api/session'
],capture_output=True,text=True,timeout=12)
if p.returncode!=0:
 raise SystemExit('Finance HTTPS transport failed')
lines=p.stdout.splitlines()
statuses=[line.split() for line in lines if line.startswith('HTTP/')]
if not statuses or len(statuses[-1])<2 or statuses[-1][1]!='401':
 raise SystemExit('Expected Caddy outer Basic 401 challenge')
challenges=[line.partition(':')[2].strip() for line in lines if line.lower().startswith('www-authenticate:')]
if not any(value=='Basic realm="restricted"' for value in challenges):
 raise SystemExit('Expected Caddy outer Basic realm restricted')
print('Finance HTTPS outer Basic protection PASS; inner gateway session PASS')
PY
tar -xzf "$UI_TAR" -C "$SITE" --no-same-owner
test "$(cat "$SITE/revision.txt")" = "$SHA"
echo 'PRIVATE_FINANCE_SITE_DEPLOY_PASS: existing site, gateway and finance DB only; no backup.'
