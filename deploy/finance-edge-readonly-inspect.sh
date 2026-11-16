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
        if ($4 ~ /^127\\.0\\.0\\.1:/ || $4 ~ /^\\[::1\\]:/) loopback=1;
        else exposed=1;
      }
      END {if (exposed) print "nonloopback_listener"; else if(loopback) print "loopback_only"; else print "not_listening"; }
    ')"
    echo "tcp_port_${port}=$state"
  done
else
  echo "port_inventory=unavailable"
fi
echo "FINANCE_EDGE_READONLY_INSPECTION_END"
