#!/usr/bin/env python3
"""T007: pure static analysis of Docker inspect metadata. NO Docker, network or process launch.

This module is meant for offline review of the immutable legacy image's *private*
container/image metadata, if explicitly authorized in a future operation.
Never supply real inspect JSON to CI or GitHub: it may contain secrets.
Only a strictly allowlisted set of classification strings is returned.
"""
import json
import re

SYNTHETIC_ENV_KEYS=frozenset({
    "NODE_ENV", "FINANCES_PUBLIC_ORIGIN", "FINANCES_API_TOKEN",
    "FINANCES_SESSION_SECRET", "FINANCES_OWNER_PASSWORD_HASH",
})
SENSITIVE=re.compile(r"TOKEN|SECRET|PASS|CREDENTIAL|KEY|AUTH|COOKIE",re.I)
NETWORK_HINT=re.compile(r"HOST|PORT|URL|ORIGIN|DATABASE|DB_|ENDPOINT",re.I)

def _keys(obj):
    env=(obj.get("Config") or {}).get("Env")
    if not isinstance(env,list):
        return None
    result=set()
    for item in env:
        if not isinstance(item,str) or "=" not in item:
            return None
        result.add(item.split("=",1)[0])
    return result

def classify_metadata(container,image):
    """Returns finite vocabulary; never raw image metadata, env keys or values."""
    if not isinstance(container,dict) or not isinstance(image,dict):
        return {"result":"metadata_invalid"}
    c=container.get("Config")
    i=image.get("Config")
    if not isinstance(c,dict) or not isinstance(i,dict):
        return {"result":"metadata_invalid"}
    ck=_keys(container)
    ik=_keys(image)
    if ck is None or ik is None:
        return {"result":"metadata_invalid"}
    if container.get("Image")!=image.get("Id"):
        return {"result":"image_identity_mismatch"}
    if not re.fullmatch(r"sha256:[a-f0-9]{64}",str(image.get("Id",""))):
        return {"result":"metadata_invalid"}
    command=i.get("Entrypoint")
    args=i.get("Cmd")
    if command is not None and (not isinstance(command,list) or not all(isinstance(x,str) for x in command)):
        return {"result":"metadata_invalid"}
    if args is not None and (not isinstance(args,list) or not all(isinstance(x,str) for x in args)):
        return {"result":"metadata_invalid"}
    has_command=bool(command or args)
    delta=ck-ik-SYNTHETIC_ENV_KEYS
    sensitive={k for k in delta if SENSITIVE.search(k)}
    network=any(NETWORK_HINT.search(k) for k in delta)
    return {
        "result":"classified",
        "entrypoint":"present" if has_command else "missing",
        "additional_sensitive_env":"present" if sensitive else "none",
        "additional_network_env":"present" if network else "none",
        "other_env":"present" if delta-sensitive else "none",
        "offline_functional_start":"unverified",
        "production_rollback":"unverified",
    }

def classify_json_strings(container_json,image_json):
    try:
        return classify_metadata(json.loads(container_json),json.loads(image_json))
    except (ValueError,TypeError):
        return {"result":"metadata_invalid"}
