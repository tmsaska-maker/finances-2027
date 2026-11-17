#!/usr/bin/env python3
"""T007: isolated startup of the preserved *real old* Docker image, never production.

Explicit manual operation only. No real secrets, network access, volumes or host ports.
Only classified results leave Lightsail. Does not claim full rollback.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT=Path("/opt/finances-2027")
SNAPSHOT_SHA="8bf0f2b0a59909bbff3a667e7c025b192123acdc"
SNAP=ROOT/"backups"/"gateway-rollback"/SNAPSHOT_SHA
NAME="finances2027-rehearsal-offline-"+SNAPSHOT_SHA[:12]

def out(key,value):
    print("FINANCE_GATEWAY_OFFLINE_"+key+"="+value,flush=True)

def fail(code):
    out("RESULT","blocked")
    out("REASON",code)
    raise SystemExit(1)

def docker(*args, timeout=15):
    try:
        result=subprocess.run(["docker",*args],capture_output=True,text=True,timeout=timeout,check=False)
    except (OSError,subprocess.TimeoutExpired):
        fail("docker_unavailable_or_timeout")
    if result.returncode!=0:
        fail("docker_command_failed")
    return result.stdout.strip()

def private_file(path):
    if path.is_symlink() or path.resolve()!=path or not path.is_file():
        fail("snapshot_file_missing_or_unsafe")
    st=path.stat()
    if st.st_uid!=0 or st.st_mode & 0o077:fail("snapshot_permissions_unsafe")
    return path

def one_finance(service):
    ids=docker("ps","-q").splitlines()
    result=[]
    for ident in ids:
        try:info=json.loads(docker("inspect","--type","container",ident))[0]
        except (ValueError,IndexError,KeyError):fail("docker_container_metadata_invalid")
        labels=(info.get("Config") or {}).get("Labels") or {}
        if labels.get("com.docker.compose.project")=="finances2027" and labels.get("com.docker.compose.service")==service:
            result.append(info)
    if len(result)!=1:fail(service+"_not_unique")
    if result[0].get("State",{}).get("Running") is not True:fail(service+"_not_running")
    return result[0]

def assert_running_unchanged(gateway_id,api_id,old_image):
    gw=one_finance("gateway")
    api=one_finance("api")
    if gw.get("Id")!=gateway_id or gw.get("Image")!=old_image or api.get("Id")!=api_id:
        fail("live_finance_container_changed")
    if not gw.get("State",{}).get("Running") or not api.get("State",{}).get("Running"):
        fail("live_finance_service_not_running")

# Categorize only Docker metadata and ENV *key presence*. Never print values,
# raw logs, process args, hostnames, or actual environment-variable names.
SYNTHETIC_KEYS=frozenset({
    "NODE_ENV","FINANCES_PUBLIC_ORIGIN","FINANCES_API_TOKEN",
    "FINANCES_SESSION_SECRET","FINANCES_OWNER_PASSWORD_HASH"
})
def classify_exit(state):
    if state.get("OOMKilled") is True:return "oom_killed"
    if state.get("Error"):return "runtime_error_present"
    code=state.get("ExitCode")
    if code==0:return "clean_exit"
    if code==1:return "application_exit_1"
    if code==2:return "application_exit_2"
    if code==126:return "cannot_execute"
    if code==127:return "command_not_found"
    if code==137:return "signal_kill_or_oom"
    if code==143:return "termination_signal"
    if isinstance(code,int) and 0<=code<=255:return "other_nonzero_exit"
    return "exit_status_unavailable"

def classify_env_key_delta(original,synthetic=SYNTHETIC_KEYS):
    # Inspect only key NAMES. No values or raw dumps leave the host.
    entries=(original.get("Config") or {}).get("Env") or []
    if not isinstance(entries,list):return ("unavailable","unavailable")
    keys=set()
    for item in entries:
        if not isinstance(item,str) or "=" not in item:return ("unavailable","unavailable")
        keys.add(item.split("=",1)[0])
    missing=keys-set(synthetic)
    if not missing:return ("none","none")
    sensitive=any(re.search(r"TOKEN|SECRET|PASS|CREDENTIAL|KEY|AUTH|COOKIE",k,re.I) for k in missing)
    if sensitive:return ("additional_sensitive_key_names","one_or_more")
    if any(re.search(r"HOST|PORT|URL|ORIGIN|NODE_ENV|MODE|CONFIG",k,re.I) for k in missing):
        return ("additional_network_or_runtime_key_names","one_or_more")
    return ("additional_other_key_names","one_or_more")

def main():
    if os.geteuid()!=0:fail("root_required")
    if sys.argv[1:]!=[SNAPSHOT_SHA]:fail("exact_snapshot_sha_required")
    if not SNAP.is_dir() or SNAP.is_symlink() or SNAP.resolve()!=SNAP:fail("private_snapshot_missing")
    st=SNAP.stat()
    if st.st_uid!=0 or st.st_mode&0o077:fail("snapshot_directory_permissions_unsafe")
    img=str(private_file(SNAP/"image.sha256").read_text(encoding="ascii")).strip()
    if re.fullmatch(r"sha256:[a-f0-9]{64}",img) is None:fail("invalid_old_image_identity")
    check_line=private_file(SNAP/"archive.sha256").read_text(encoding="ascii").strip()
    if re.fullmatch(r"[a-f0-9]{64}  original-gateway-image[.]tar",check_line) is None:
        fail("invalid_archive_checksum_manifest")
    archive=private_file(SNAP/"original-gateway-image.tar")
    checksum=hashlib.sha256()
    with archive.open("rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""):checksum.update(chunk)
    if checksum.hexdigest()!=check_line[:64]:fail("archived_image_checksum_mismatch")
    try:metadata=json.loads(private_file(SNAP/"running-container.json").read_text(encoding="utf8"))
    except (ValueError,UnicodeError):fail("original_container_metadata_invalid")
    if metadata.get("Image")!=img:fail("snapshot_image_mismatch")
    old=one_finance("gateway")
    api=one_finance("api")
    if old.get("Image")!=img:fail("live_gateway_no_longer_matches_snapshot")
    binds=(old.get("HostConfig") or {}).get("PortBindings") or {}
    bound=[b for seq in binds.values() if isinstance(seq,list) for b in seq if str(b.get("HostPort"))=="8092"]
    if len(bound)!=1 or bound[0].get("HostIp")!="127.0.0.1":fail("live_gateway_port_scope_mismatch")
    old_id,api_id=old.get("Id"),api.get("Id")
    if not old_id or not api_id:fail("live_container_identity_missing")
    try:images=json.loads(docker("image","inspect",img))
    except (ValueError,TypeError):fail("old_image_not_available")
    if len(images)!=1 or images[0].get("Id")!=img:fail("old_image_digest_not_cached")
    if (images[0].get("Config") or {}).get("Volumes"):fail("old_image_declares_volumes")
    # Image-baked credentials would remain even without --env. Do not run if present.
    builtins=(images[0].get("Config") or {}).get("Env") or []
    for value in builtins:
        key=str(value).split("=",1)[0]
        if re.search(r"TOKEN|SECRET|PASSWORD|CREDENTIAL|DATABASE|PRIVATE_KEY|API_KEY",key,re.I):
            fail("image_contains_sensitive_environment")
    if docker("ps","-a","--filter","name=^/"+NAME+"$","-q"):
        fail("rehearsal_container_name_already_in_use")
    created=False
    boot="unverified"
    http_probe="unverified"
    exit_class="unavailable"
    required_key_class,required_key_count=classify_env_key_delta(old)
    try:
        # IMAGE ENTRYPOINT AND CMD retained. All values synthetic, no real token.
        created=True  # cleanup by reserved unique name even if Docker run returns an error
        docker("run","-d","--name",NAME,"--pull","never","--restart","no",
               "--network","none","--read-only","--cap-drop","ALL",
               "--security-opt","no-new-privileges","--pids-limit","64",
               "--memory","128m","--cpus","0.25","--tmpfs","/tmp:rw,noexec,nosuid,size=8m",
               "--env","NODE_ENV=production",
               "--env","FINANCES_PUBLIC_ORIGIN=https://finance.example.test",
               "--env","FINANCES_API_TOKEN=synthetic-token-for-offline-recovery-12345678",
               "--env","FINANCES_SESSION_SECRET=synthetic-only-no-real-secrets-1234567890123456789",
               "--env","FINANCES_OWNER_PASSWORD_HASH="+("a"*48)+":"+("b"*64),
               img,timeout=45)
        time.sleep(3)
        obj=json.loads(docker("inspect","--type","container",NAME))[0]
        host=obj.get("HostConfig") or {}
        if obj.get("Image")!=img or host.get("NetworkMode")!="none" or host.get("PortBindings"):
            fail("offline_isolation_mismatch")
        if not host.get("ReadonlyRootfs") or host.get("Privileged") or host.get("Binds") or obj.get("Mounts"):
            fail("offline_filesystem_isolation_mismatch")
        state=obj.get("State") or {}
        if state.get("Running"):
            boot="running_with_synthetic_inputs"
            exit_class="process_running"
        else:
            exit_class=classify_exit(state)
            # No logs or response bodies. The old image might lack Node / use another endpoint.
            code=r"""const http=require('node:http');const q=http.get('http://127.0.0.1:8092/finance-api/session',r=>{r.resume();process.stdout.write(String(r.statusCode));});q.setTimeout(1500,()=>q.destroy());q.on('error',()=>process.stdout.write('unavailable'));"""
            probe=subprocess.run(["docker","exec",NAME,"node","-e",code],
                capture_output=True,text=True,timeout=6,check=False)
            if probe.returncode==0 and probe.stdout.strip()=="403":
                http_probe="legacy_anonymous_403"
            elif probe.returncode==0 and probe.stdout.strip()=="401":
                http_probe="legacy_anonymous_401"
            elif probe.returncode==0 and probe.stdout.strip()=="200":
                http_probe="unexpected_anonymous_200"
            else:
                http_probe="unavailable"
        else:
            boot="exited_without_live_secrets"
    finally:
        # Removes ONLY the explicitly-named ephemeral test container.
        if created:
            subprocess.run(["docker","rm","-fv",NAME],capture_output=True,text=True,timeout=20,check=False)
    assert_running_unchanged(old_id,api_id,img)
    out("OLD_IMAGE_ARCHIVE","checksum_verified")
    out("RUNTIME_BOOT",boot)
    out("EXIT_CLASS",exit_class)
    out("ENV_KEY_DELTA_CLASS",required_key_class)
    out("ENV_KEY_DELTA_COUNT_CLASS",required_key_count)
    out("ANONYMOUS_RESPONSE",http_probe)
    out("LIVE_GATEWAY","unchanged")
    out("LIVE_API","unchanged")
    out("PRODUCTION_ROLLBACK","unverified")
    if boot!="running_with_synthetic_inputs" or http_probe!="legacy_anonymous_403":
        fail("functional_start_not_confirmed_without_live_secrets")
    out("RESULT","isolated_old_image_start_verified")

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,IndexError,KeyError,subprocess.TimeoutExpired):
        fail("offline_runtime_probe_error")
