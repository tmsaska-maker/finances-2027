#!/usr/bin/env python3
"""Manual, finance-only backup of the exact *running* old gateway. NO cutover.

The private snapshot MAY contain credentials. Keep it root-owned on the server.
Only classified allowlisted outputs go to GitHub Actions logs.
This verifies a restorable Docker archive and a no-start container create;
it does NOT prove application-level recovery, so the deployment remains blocked.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time

ROOT=Path("/opt/finances-2027").resolve()
BACKUPS=ROOT/"backups"/"gateway-rollback"
BUDGET_SECONDS=180
def fail(code):
    print("FINANCE_GATEWAY_SNAPSHOT_BLOCKED="+code,flush=True)
    raise SystemExit(1)
def run(*args, timeout=15, capture=True):
    result=subprocess.run(list(args),check=False,capture_output=capture,text=capture,timeout=timeout)
    if result.returncode:fail("docker_or_filesystem_command_failed")
    return result.stdout.strip() if capture else ""
def main():
    if os.geteuid()!=0:fail("root_required")
    if len(sys.argv)!=2 or len(sys.argv[1])!=40 or any(c not in "0123456789abcdef" for c in sys.argv[1]):fail("invalid_approved_sha")
    sha=sys.argv[1]
    ids=run("docker","ps","-q").splitlines()
    matches=[]
    for cid in ids:
        try:obj=json.loads(run("docker","inspect","--type","container",cid))[0]
        except (IndexError,ValueError,KeyError):fail("invalid_docker_metadata")
        labels=(obj.get("Config") or {}).get("Labels") or {}
        if labels.get("com.docker.compose.project")=="finances2027" and labels.get("com.docker.compose.service")=="gateway":
            matches.append(obj)
    if len(matches)!=1:fail("gateway_not_unique")
    obj=matches[0]
    if obj.get("State",{}).get("Running") is not True:fail("gateway_not_running")
    binds=(obj.get("HostConfig") or {}).get("PortBindings") or {}
    assigned=[b for values in binds.values() if isinstance(values,list) for b in values if str(b.get("HostPort",""))=="8092"]
    if len(assigned)!=1 or assigned[0].get("HostIp") not in ("127.0.0.1",):fail("gateway_port_scope_mismatch")
    image=obj.get("Image","")
    if not isinstance(image,str) or not image.startswith("sha256:") or len(image)!=71:fail("image_identity_unavailable")
    inspected=json.loads(run("docker","image","inspect",image))
    if len(inspected)!=1 or inspected[0].get("Id")!=image:fail("image_not_cached")
    labels=(obj.get("Config") or {}).get("Labels") or {}
    raw=str(labels.get("com.docker.compose.project.config_files",""))
    sources=[Path(p.strip()) for p in raw.split(",") if p.strip()]
    if not sources or len(sources)>12:fail("compose_source_unavailable")
    env=ROOT/"backend"/"deploy"/".env"
    sources.append(env)
    allowed=[]
    for path in sources:
        try:
            resolved=path.resolve(strict=True)
            # No symlinks, no external files or directories, no duplicate paths.
            if resolved!=path or not resolved.is_file() or not resolved.is_relative_to(ROOT):fail("unsafe_finance_source")
            if resolved not in allowed:allowed.append(resolved)
        except (OSError,RuntimeError):fail("finance_source_unavailable")
    if not BACKUPS.parent.is_dir():fail("finance_backup_parent_missing")
    BACKUPS.mkdir(mode=0o700,exist_ok=True)
    os.chmod(BACKUPS,0o700)
    target=BACKUPS/sha
    if target.exists():fail("snapshot_already_exists")
    estimated=int(inspected[0].get("Size",0))
    if estimated<=0 or estimated>3*1024**3:fail("image_size_unexpected")
    if shutil.disk_usage(BACKUPS).free < estimated*3+256*1024**2:fail("insufficient_private_disk")
    tmp=BACKUPS/(".partial-"+sha)
    if tmp.exists():fail("partial_snapshot_exists")
    tmp.mkdir(mode=0o700)
    try:
        archive=tmp/"original-gateway-image.tar"
        with archive.open("wb") as output:
            result=subprocess.run(["docker","save",image],stdout=output,stderr=subprocess.DEVNULL,timeout=BUDGET_SECONDS,check=False)
        if result.returncode!=0 or archive.stat().st_size==0:fail("image_save_failed")
        with tarfile.open(archive,"r:") as tar:
            # No extraction or execution. Verify manifest and every member CRC/tar stream.
            names=set()
            manifest=None
            for member in tar:
                names.add(member.name)
                if member.isfile():
                    reader=tar.extractfile(member)
                    if reader is None:fail("invalid_docker_archive")
                    if member.name=="manifest.json":
                        if member.size>1024*1024:fail("invalid_docker_manifest")
                        manifest=json.loads(reader.read())
                    else:
                        for _ in iter(lambda:reader.read(1024*1024),b""):pass
            if "manifest.json" not in names or not isinstance(manifest,list) or not manifest:
                fail("invalid_docker_manifest")
        checksum=hashlib.sha256()
        with archive.open("rb") as input_file:
            for block in iter(lambda:input_file.read(1024*1024),b""):checksum.update(block)
        # Keep all sensitive Docker inspection/config ONLY in root-owned snapshot.
        (tmp/"running-container.json").write_text(json.dumps(obj,indent=2),encoding="utf8")
        (tmp/"running-image.json").write_text(json.dumps(inspected[0],indent=2),encoding="utf8")
        (tmp/"image.sha256").write_text(image+"\n",encoding="ascii")
        (tmp/"archive.sha256").write_text(checksum.hexdigest()+"  original-gateway-image.tar\n",encoding="ascii")
        for index,path in enumerate(allowed):
            shutil.copy2(path,tmp/("finance-config-"+str(index)+".private"))
        (tmp/"source-paths.private").write_text("\n".join(str(p) for p in allowed)+"\n",encoding="utf8")
        for path in tmp.iterdir():os.chmod(path,0o600)
        # Snapshot is immutable by convention; never overwrite.
        tmp.rename(target)
    except BaseException:
        shutil.rmtree(tmp,ignore_errors=True)
        raise
    # Verify Docker engine can construct (but NEVER start) a container from
    # this exact cached old image without credentials, network or published ports.
    check_name="finances2027-gateway-recovery-check-"+sha[:12]
    try:
        run("docker","create","--name",check_name,"--network","none","--read-only",
            "--cap-drop","ALL","--security-opt","no-new-privileges",
            "--entrypoint","/bin/true",image)
        probe=json.loads(run("docker","inspect","--type","container",check_name))[0]
        ports=(probe.get("HostConfig") or {}).get("PortBindings") or {}
        if probe.get("Image")!=image or ports or (probe.get("State") or {}).get("Running"):fail("no_start_recovery_check_failed")
    finally:
        subprocess.run(["docker","rm","-f",check_name],capture_output=True,timeout=15,check=False)
    print("FINANCE_GATEWAY_PRIVATE_ARCHIVE=verified")
    print("FINANCE_GATEWAY_OLD_IMAGE_CREATE_NO_START=verified")
    print("FINANCE_GATEWAY_LIVE_CONTAINER=untouched")
    print("FINANCE_GATEWAY_PRODUCTION_ROLLBACK=unverified")
if __name__=="__main__":
    try:main()
    except (OSError,subprocess.TimeoutExpired,tarfile.TarError,ValueError,KeyError) as exc:
        # Deliberately do not print exceptions: paths / Docker error details might be private.
        fail("private_snapshot_verification_failed")
