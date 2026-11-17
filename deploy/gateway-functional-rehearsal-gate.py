#!/usr/bin/env python3
"""T007: pure, deterministic safety decision for a functional legacy-image rehearsal.

No Docker/AWS/network, no secret access, no automatic runtime execution.
All inputs are fixed-vocabulary findings from separately verified probes.
Even ready_for_isolated_design NEVER authorizes a live change or production deploy.
"""
from collections.abc import Mapping

FIELDS={
    "archive":{"checksum_verified"},
    "image_identity":{"verified"},
    "entrypoint":{"present"},
    "sensitive_env":{"none","present"},
    "network_env":{"none","present"},
    "previous_boot":{"application_exit_1","other_failure","isolated_running"},
    "synthetic_secret_contract":{"complete","incomplete","unverified"},
    "anonymous_endpoint_contract":{"verified_for_authentic_old_image","unverified"},
    "isolated_network_contract":{"no_network_no_volumes","unverified"},
}
RESULTS=frozenset({"blocked_integrity","blocked_unknown_contract","blocked_missing_synthetic_contract","ready_for_isolated_design"})

def assess(evidence):
    """Reject inconsistent or incomplete evidence without reflecting any input back."""
    if not isinstance(evidence,Mapping) or set(evidence)!=set(FIELDS):
        return {"decision":"blocked_unknown_contract","production_release":"blocked","rollback":"unverified"}
    if any(type(evidence[k]) is not str or evidence[k] not in allowed for k,allowed in FIELDS.items()):
        return {"decision":"blocked_unknown_contract","production_release":"blocked","rollback":"unverified"}
    if evidence["archive"]!="checksum_verified" or evidence["image_identity"]!="verified" or evidence["entrypoint"]!="present":
        return {"decision":"blocked_integrity","production_release":"blocked","rollback":"unverified"}
    if (evidence["sensitive_env"]=="present" and evidence["synthetic_secret_contract"]!="complete"):
        return {"decision":"blocked_missing_synthetic_contract","production_release":"blocked","rollback":"unverified"}
    if (evidence["network_env"]!="none" or evidence["isolated_network_contract"]!="no_network_no_volumes"
        or evidence["anonymous_endpoint_contract"]!="verified_for_authentic_old_image"
        or evidence["synthetic_secret_contract"]!="complete"):
        return {"decision":"blocked_unknown_contract","production_release":"blocked","rollback":"unverified"}
    return {"decision":"ready_for_isolated_design","production_release":"blocked","rollback":"unverified"}

# Evidence from T007 snapshots and probes:
# verified archive, image metadata has command, extra sensitive keys, exit 1.
# Critical unknown: exact synthetic replacement contract AND authentic-old HTTP contract.
CURRENT_EVIDENCE={
    "archive":"checksum_verified",
    "image_identity":"verified",
    "entrypoint":"present",
    "sensitive_env":"present",
    "network_env":"none",
    "previous_boot":"application_exit_1",
    "synthetic_secret_contract":"unverified",
    "anonymous_endpoint_contract":"unverified",
    "isolated_network_contract":"no_network_no_volumes",
}

if __name__=="__main__":
    result=assess(CURRENT_EVIDENCE)
    for k in ("decision","production_release","rollback"):
        print("T007_REHEARSAL_"+k.upper()+"="+result[k])
