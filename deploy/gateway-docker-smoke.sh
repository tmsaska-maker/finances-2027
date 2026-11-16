#!/usr/bin/env bash
# Runs on GitHub-hosted CI runner ONLY. Do not transfer/run on Lightsail.
set -Eeuo pipefail
IMAGE="${1:?Pass candidate image tag}"
[[ "$IMAGE" == finances2027-gateway-candidate:* ]] || { echo 'Candidate image required'; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="finances-e2e-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
API_CONTAINER="${NETWORK}-api"
GATE_CONTAINER="${NETWORK}-gateway"
cleanup(){
 docker rm -f "$GATE_CONTAINER" "$API_CONTAINER" >/dev/null 2>&1 || true
 docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create --internal "$NETWORK" >/dev/null
# No host port publication, no AWS, no DB, no persistent volumes, no Docker socket inside a container.
docker run -d --name "$API_CONTAINER" --network "$NETWORK" --network-alias api \
 --read-only --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$ROOT/deploy/gateway-smoke-fake-api.mjs,dst=/fixture.mjs,readonly" \
 --entrypoint node "$IMAGE" /fixture.mjs >/dev/null
HASH="$(node --input-type=module -e "import {passwordHash} from './server/browser-gateway.mjs'; process.stdout.write(passwordHash('synthetic-owner-password-long-enough'))")"
docker run -d --name "$GATE_CONTAINER" --network "$NETWORK" --network-alias gateway \
 --read-only --cap-drop ALL --security-opt no-new-privileges \
 --env NODE_ENV=production --env FINANCES_PUBLIC_ORIGIN=https://finance.example.test \
 --env FINANCES_GATEWAY_BIND_HOST=0.0.0.0 --env FINANCES_GATEWAY_API_ORIGIN=http://api:8091 \
 --env FINANCES_API_TOKEN=synthetic-api-token-that-is-long-1234567890 \
 --env FINANCES_SESSION_SECRET=synthetic-signing-secret-only-for-test-long-enough-0123456789 \
 --env "FINANCES_OWNER_PASSWORD_HASH=$HASH" "$IMAGE" >/dev/null
docker run --rm --network "$NETWORK" --read-only --cap-drop ALL --security-opt no-new-privileges \
 --mount "type=bind,src=$ROOT/deploy/gateway-smoke-client.mjs,dst=/smoke.mjs,readonly" \
 --entrypoint node "$IMAGE" /smoke.mjs
