#!/usr/bin/env bash
# Read-only, counts/booleans-only inspection of existing shared Lightsail HTTPS edge.
# Do NOT print Caddyfile contents, env values, domains, IPs, tokens, process args or secrets.
set -Eeuo pipefail
umask 077
test "$(id -u)" = 0 || { echo "Must run through controlled sudo"; exit 1; }
test -d /opt/finances-2027/backend/deploy || { echo "Existing finance backend missing"; exit 1; }
echo "FINANCE_EDGE_READONLY_INSPECTION_BEGIN"
if command -v systemctl >/dev/null 2>&1; then
  case "$(systemctl is-active caddy 2>/dev/null || true)" in
    active) echo "caddy_system_service=active";;
    *) echo "caddy_system_service=inactive_or_unknown";;
  esac
fi
if command -v docker >/dev/null 2>&1; then
  caddy_count="$(docker ps --format '{{.Names}}' | grep -Eic '(^|[-_])caddy([-_]|$)' || true)"
  proxy_count="$(docker ps --format '{{.Names}}' | grep -Eic '(^|[-_])(nginx|traefik)([-_]|$)' || true)"
  echo "running_caddy_containers=$caddy_count"
  echo "running_other_proxy_containers=$proxy_count"
else
  echo "docker_command=unavailable"
fi
if test -f /etc/caddy/Caddyfile; then
  echo "system_caddyfile=present"
else
  echo "system_caddyfile=absent"
fi
for dir in /opt/finances-2027/site /opt/finances-2027/staging/site /opt/screening40; do
  case "$dir" in
    /opt/finances-2027/site) label=finance_public_site;;
    /opt/finances-2027/staging/site) label=finance_staging_site;;
    /opt/screening40) label=screening_directory;;
  esac
  if test -d "$dir"; then echo "$label=present"; else echo "$label=absent"; fi
done
# Only port presence/scope; avoid dumping host IPs or network configuration.
if command -v ss >/dev/null 2>&1; then
  for port in 80 443 8091 8092; do
    state="$(ss -lntH | awk -v p="$port" '
      $4 ~ (":" p "$") {
        if ($4 ~ /^127[.]0[.]0[.]1:/ || $4 ~ /^\[::1\]:/) loopback=1;
        else exposed=1;
      }
      END {if (exposed) print "nonloopback_listener"; else if(loopback) print "loopback_only"; else print "not_listening"; }
    ')"
    echo "tcp_port_${port}=$state"
  done
else
  echo "port_inventory=unavailable"
fi
# Determine the *class* of listener process, never expose PIDs, command lines, hostnames.
if command -v ss >/dev/null 2>&1; then
  ss -lntpH 2>/dev/null | python3 -c '
import re,sys
rows=sys.stdin.read().splitlines()
for port in (8091,8092):
    matches=[line for line in rows if len(line.split())>=4 and re.search(r":"+str(port)+r"$",line.split()[3])]
    names=[]
    for line in matches:
        match=re.search(r"users:\(\(\"([^\"]+)\"",line)
        if match: names.append(match.group(1))
    if not matches: classification="not_listening"
    elif not names: classification="unidentified"
    elif all(n in ("node","docker-proxy","rootlesskit") for n in names):
        classification="node_or_docker"
    elif all(n=="caddy" for n in names): classification="caddy"
    else: classification="other_process"
    print("tcp_port_%s_process_class=%s"%(port,classification))
'
fi
# Caddy's adapter produces JSON; only print a fixed vocabulary of boolean flags.
# Redirect Caddy diagnostics to /dev/null so a parse error cannot expose config.
if command -v caddy >/dev/null 2>&1 && test -f /etc/caddy/Caddyfile; then
  if caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null |
    python3 -c '
import json,sys
try: config=json.load(sys.stdin)
except (ValueError,UnicodeError):
    print("caddy_routes=unavailable")
    sys.exit(0)
http=config.get("apps",{}).get("http",{})
servers=http.get("servers",{})
routes=sum(len(server.get("routes",[])) for server in servers.values())
markers={"finance_api_8091":False,"finance_gateway_8092":False,"finance_static_root":False}
def visit(v):
    if isinstance(v,dict):
        if v.get("handler")=="reverse_proxy":
            for x in v.get("upstreams",[]):
                dial=x.get("dial","")
                if dial.endswith(":8091"): markers["finance_api_8091"]=True
                if dial.endswith(":8092"): markers["finance_gateway_8092"]=True
        if v.get("handler")=="vars" and str(v.get("root","")).startswith("/opt/finances-2027/"):
            markers["finance_static_root"]=True
        for child in v.values():visit(child)
    elif isinstance(v,list):
        for child in v: visit(child)
visit(http)
print("caddy_server_blocks=%d"%len(servers))
print("caddy_route_count=%d"%routes)
for key in sorted(markers):print("caddy_"+key+"="+("present" if markers[key] else "absent"))
'
  then :; else echo "caddy_routes=unavailable"; fi
else
  echo "caddy_routes=unavailable"
fi
# Anonymous safety probe. GET only; do not send credentials, cookies, origin, or print response bodies.
# The existing port 8092 may serve an unrelated process. Classify, do not assume.
python3 -c '
import json,urllib.request,urllib.error
tests=(
 ("api8091_health","http://127.0.0.1:8091/health",False),
 ("gateway8092_session","http://127.0.0.1:8092/finance-api/session",True),
 ("gateway8092_obligations","http://127.0.0.1:8092/finance-api/obligations",False),
 ("gateway8092_categories","http://127.0.0.1:8092/finance-api/categories?project=personal&type=expense",False)
)
for name,url,is_session in tests:
    code="unavailable"
    session="unverified"
    try:
        request=urllib.request.Request(url,headers={"Accept":"application/json"},method="GET")
        with urllib.request.urlopen(request,timeout=3) as response:
            code=str(response.status)
            if is_session and response.status==200:
                # Never echo the body, only whether an anonymous session is correctly rejected.
                raw=response.read(4096)
                try:
                    data=json.loads(raw)
                    session="anonymous" if isinstance(data,dict) and data.get("authenticated") is False else "unexpected"
                except (ValueError,UnicodeError):session="invalid_response"
    except urllib.error.HTTPError as error:
        code=str(error.code)
        error.close()
    except (OSError,ValueError,TimeoutError):
        pass
    print("anonymous_"+name+"_status="+code)
    if is_session: print("anonymous_gateway8092_session_class="+session)
' 2>/dev/null || echo "anonymous_probe=unavailable"
echo "FINANCE_EDGE_READONLY_INSPECTION_END"
