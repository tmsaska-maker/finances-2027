#!/usr/bin/env bash
# Ephemeral GitHub runner ONLY: synthetic old gateway -> new candidate -> old gateway.
# No production image, production Compose, AWS, SSH, host ports, DB or Caddy.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANDIDATE="${1:?Candidate image required}"
[[ "$CANDIDATE" =~ ^finances2027-gateway-candidate:[a-f0-9]{40}$ ]] || { echo 'Invalid candidate image tag'; exit 2; }
NET="finance-rollback-ci-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
GATE="${NET}-gateway"
API="${NET}-api"
cleanup(){
 docker rm -f "$GATE" "$API" >/dev/null 2>&1 || true
 docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker build -q -f "$ROOT/deploy/Dockerfile.gateway-rollback-fixture" -t "finance-synthetic-old:${GITHUB_SHA:-local}" "$ROOT" >/dev/null
# Pin exact immutable image ID. Rollback MUST use this ID, not a mutable latest tag.
OLD_ID="$(docker image inspect --format '{{.Id}}' "finance-synthetic-old:${GITHUB_SHA:-local}")"
[[ "$OLD_ID" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo 'Old synthetic image not pinned'; exit 2; }
docker network create --internal "$NET" >/dev/null
docker run -d --name "$API" --network "$NET" --network-alias api \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=bind,src=$ROOT/deploy/gateway-smoke-fake-api.mjs,dst=/fixture.mjs,readonly" \
  --entrypoint node "$CANDIDATE" /fixture.mjs >/dev/null
API_ID_BEFORE="$(docker inspect --format '{{.Id}}' "$API")"
old_gateway(){
 docker run -d --name "$GATE" --network "$NET" --network-alias gateway \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  "$OLD_ID" >/dev/null
}
probe_old(){
 docker run --rm --network "$NET" --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=bind,src=$ROOT/deploy/gateway-rollback-probe.mjs,dst=/probe.mjs,readonly" \
  --entrypoint node "$CANDIDATE" /probe.mjs
}
old_gateway
probe_old
docker rm -f "$GATE" >/dev/null
HASH="$(node --input-type=module -e "import {passwordHash} from './server/browser-gateway.mjs';process.stdout.write(passwordHash('synthetic-owner-password-long-enough'))")"
docker run -d --name "$GATE" --network "$NET" --network-alias gateway \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env NODE_ENV=production --env FINANCES_PUBLIC_ORIGIN=https://finance.example.test \
  --env FINANCES_GATEWAY_BIND_HOST=0.0.0.0 --env FINANCES_GATEWAY_API_ORIGIN=http://api:8091 \
  --env FINANCES_API_TOKEN=synthetic-api-token-that-is-long-1234567890 \
  --env FINANCES_SESSION_SECRET=synthetic-signing-secret-only-for-test-long-enough-0123456789 \
  --env "FINANCES_OWNER_PASSWORD_HASH=$HASH" "$CANDIDATE" >/dev/null
docker run --rm --network "$NET" --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=bind,src=$ROOT/deploy/gateway-smoke-client.mjs,dst=/smoke.mjs,readonly" \
  --entrypoint node "$CANDIDATE" /smoke.mjs
# Simulate failed post-cutover acceptance and revert the gateway ONLY.
docker rm -f "$GATE" >/dev/null
old_gateway
probe_old
[[ "$(docker inspect --format '{{.Image}}' "$GATE")" == "$OLD_ID" ]] || { echo 'Rollback image changed'; exit 1; }
[[ "$(docker inspect --format '{{.Id}}' "$API")" == "$API_ID_BEFORE" ]] || { echo 'Synthetic API was recreated'; exit 1; }
[[ "$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$GATE")" == '{}' ]] || { echo 'Unexpected host port publication'; exit 1; }
echo 'SYNTHETIC_GATEWAY_ROLLBACK_REHEARSAL_PASS: pinned old image restored, API untouched, no host ports'
