/**
 * T007 release decision model. No network, Docker, AWS, secrets or production writes.
 * Facts MUST come from independently reviewed release evidence, not user input alone.
 * Fail closed: missing/unknown evidence always blocks deploy.
 */
export const GATE_KEYS=Object.freeze([
  'live_finance_owner_unique',
  'live_gateway_config_preserved',
  'live_gateway_image_preserved',
  'rollback_rehearsal_passed',
  'candidate_image_sha_verified',
  'private_https_origin_verified',
  'caddy_finance_only_route_reviewed',
  'finance_api_private_network_verified',
  'authenticated_browser_smoke_passed',
  'session_csrf_and_rate_limit_review_passed',
  'screening_isolation_review_passed',
  'explicit_owner_release_approval'
]);

export function evaluateGatewayRelease(evidence={}) {
  if(!evidence || typeof evidence!=='object' || Array.isArray(evidence))
    throw new Error('Release evidence must be a keyed object');
  const passed=GATE_KEYS.filter(k=>evidence[k]===true);
  const blocked=GATE_KEYS.filter(k=>evidence[k]!==true);
  return Object.freeze({
    decision:blocked.length===0?'eligible_for_controlled_deployment':'blocked',
    passed:Object.freeze(passed),
    blocked:Object.freeze(blocked),
    note:'Eligibility is a planning gate only; this code never performs deployment.'
  });
}
