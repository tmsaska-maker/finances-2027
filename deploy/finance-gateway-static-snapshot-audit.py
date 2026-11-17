#!/usr/bin/env python3
"""T007: read-only, private static classification of a pinned legacy snapshot.

No Docker, network, process launch, config export or filesystem modification.
Only fixed-vocabulary classifications may leave Lightsail.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path("/opt/finances-2027")
SNAPSHOT_SHA="8bf0f2b0a59909bbff3a667e7c025b192123acdc"
SNAP=ROOT/"backups"/"gateway-rollback"/SNAPSHOT_SHA
EXPECTED_FIELDS={
    "result":{"classified","metadata_invalid","image_identity_mismatch"},
    "entrypoint":{"present","missing"},
    "additional_sensitive_env":{"present","none"},
    "additional_network_env":{"present","none"},
    "other_env":{"present","none"},
    "offline_functional_start":{"unverified"},
    "production_rollback":{"unverified"},
}
MAX_JSON_BYTES=4*1024*1024

def fail(code):
    # Fixed vocabulary only; never print exception details, paths or raw metadata.
    print("FINANCE_GATEWAY_STATIC_RESULT=blocked",flush=True)
    print("FINANCE_GATEWAY_STATIC_REASON="+code,flush=True)
    raise SystemExit(1)

def secure_dir(path):
    if path.is_symlink() or not path.is_dir() or path.resolve()!=path:
        fail("private_snapshot_directory_invalid")
    st=path.stat()
    if st.st_uid!=0 or (st.st_mode & 0o077):
        fail("private_snapshot_permissions_invalid")

def secure_file(path, max_size=None):
    if path.is_symlink() or not path.is_file() or path.resolve()!=path:
        fail("private_snapshot_file_invalid")
    st=path.stat()
    if st.st_uid!=0 or (st.st_mode & 0o077) or st.st_size<=0:
        fail("private_snapshot_permissions_invalid")
    if max_size is not None and st.st_size>max_size:
        fail("private_snapshot_metadata_oversized")
    return path

def read_private_json(path):
    p=secure_file(path,MAX_JSON_BYTES)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (ValueError,UnicodeError):
        fail("private_snapshot_metadata_invalid")

def sha256_file(path):
    h=hashlib.sha256()
    with path.open("rb") as inp:
        for block in iter(lambda:inp.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def validate_and_classify(snap, classifier):
    # Snapshot was saved on-server by the pinned snapshot workflow.
    secure_dir(snap)
    image_id=secure_file(snap/"image.sha256",256).read_text(encoding="ascii").strip()
    if not re.fullmatch(r"sha256:[a-f0-9]{64}",image_id):
        fail("private_snapshot_image_identity_invalid")
    manifest=secure_file(snap/"archive.sha256",256).read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[a-f0-9]{64}  original-gateway-image[.]tar",manifest):
        fail("private_snapshot_checksum_invalid")
    archive=secure_file(snap/"original-gateway-image.tar")
    if sha256_file(archive)!=manifest[:64]:
        fail("private_snapshot_checksum_mismatch")
    old=read_private_json(snap/"running-container.json")
    image=read_private_json(snap/"running-image.json")
    if not isinstance(old,dict) or not isinstance(image,dict):
        fail("private_snapshot_metadata_invalid")
    if old.get("Image")!=image_id or image.get("Id")!=image_id:
        fail("private_snapshot_image_identity_mismatch")
    result=classifier(old,image)
    if not isinstance(result,dict) or result.get("result")!="classified":
        fail("metadata_classification_unavailable")
    if set(result)!=set(EXPECTED_FIELDS):
        fail("unsafe_classifier_output")
    for key,allowed in EXPECTED_FIELDS.items():
        if not isinstance(result[key],str) or result[key] not in allowed:
            fail("unsafe_classifier_output")
    return result

def load_classifier(path):
    # Source file is shipped from the same tested commit, not from snapshot.
    spec=importlib.util.spec_from_file_location("static_gateway_contract",path)
    if spec is None or spec.loader is None:fail("classifier_unavailable")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.classify_metadata

def load_delta_classifier(path):
    spec=importlib.util.spec_from_file_location("startup_delta",path)
    if spec is None or spec.loader is None:fail("startup_delta_classifier_unavailable")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main():
    if os.geteuid()!=0:fail("root_required")
    if sys.argv[1:]!=[SNAPSHOT_SHA]:fail("exact_snapshot_sha_required")
    classifier=load_classifier(Path(__file__).with_name("gateway-static-startup-contract.py"))
    result=validate_and_classify(SNAP,classifier)
    # Static-only comparison of the SAVED live container with immutable image defaults.
    # The verified snapshot is read again from root-owned files, not via Docker.
    compare=load_delta_classifier(Path(__file__).with_name("gateway-saved-startup-delta.py"))
    saved=read_private_json(SNAP/"running-container.json")
    built=read_private_json(SNAP/"running-image.json")
    differences=compare.classify_startup_delta(saved,built)
    if not compare.validate_output(differences):
        fail("unsafe_startup_delta_output")
    source_scanner=load_delta_classifier(Path(__file__).with_name("gateway-image-source-signals.py"))
    source_signals=source_scanner.inspect_archive(SNAP/"original-gateway-image.tar")
    if not source_scanner.validate_output(source_signals):
        fail("unsafe_source_signal_output")
    # Never emit raw JSON, source variables, secrets, image identifiers or commands.
    for key in sorted(EXPECTED_FIELDS):
        print("FINANCE_GATEWAY_STATIC_"+key.upper()+"="+result[key],flush=True)
    for key in sorted(compare.CLASSES):
        print("FINANCE_GATEWAY_STARTUP_"+key.upper()+"="+differences[key],flush=True)
    for key in sorted(source_scanner.FIXED):
        print("FINANCE_GATEWAY_IMAGE_SOURCE_"+key.upper()+"="+source_signals[key],flush=True)
    print("FINANCE_GATEWAY_STATIC_ARCHIVE=checksum_verified",flush=True)
    print("FINANCE_GATEWAY_STATIC_LIVE_SERVICES=not_accessed",flush=True)

if __name__=="__main__":
    try:main()
    except SystemExit:raise
    except Exception:fail("static_check_unavailable")
