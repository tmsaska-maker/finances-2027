#!/usr/bin/env python3
"""T007: compare saved live-container startup metadata with saved image defaults.

Pure functions; no Docker, subprocess, network, filesystem, or ENV access.
Only fixed classifications are returned; raw commands/paths never leave host.
"""
from collections.abc import Mapping

CLASSES={
    "command_override":{"same","different","unavailable"},
    "working_directory_override":{"same","different","unavailable"},
    "user_override":{"same","different","unavailable"},
    "mount_dependency":{"none","present","unavailable"},
    "tmpfs_dependency":{"none","present","unavailable"},
    "live_rootfs_policy":{"read_only","writable","unavailable"},
}
def _command(config,key):
    value=config.get(key)
    if value is None:
        return ()
    if not isinstance(value,list) or not all(isinstance(s,str) for s in value):
        return None
    return tuple(value)

def _scalar(config,key):
    value=config.get(key)
    if value is None:
        return ""
    if not isinstance(value,str):
        return None
    return value

def _compare(a,b,key,parse):
    x=parse(a,key)
    y=parse(b,key)
    if x is None or y is None:
        return "unavailable"
    return "same" if x==y else "different"

def classify_startup_delta(container,image):
    if not isinstance(container,Mapping) or not isinstance(image,Mapping):
        return None
    live=container.get("Config")
    built=image.get("Config")
    host=container.get("HostConfig")
    if not isinstance(live,Mapping) or not isinstance(built,Mapping) or not isinstance(host,Mapping):
        return None
    # Both Entrypoint and Cmd are part of the effective command. Never print either.
    entries=[_compare(live,built,key,_command) for key in ("Entrypoint","Cmd")]
    cmd="unavailable" if "unavailable" in entries else ("different" if "different" in entries else "same")
    mounts=container.get("Mounts")
    binds=host.get("Binds")
    if mounts is None or binds is None:
        mount_state="unavailable"
    elif not isinstance(mounts,list) or not isinstance(binds,list):
        mount_state="unavailable"
    else:
        mount_state="present" if mounts or binds else "none"
    tmpfs=host.get("Tmpfs")
    if tmpfs is None:
        tmpfs_state="none"  # Docker inspect uses null for absence.
    elif not isinstance(tmpfs,dict):
        tmpfs_state="unavailable"
    else:
        tmpfs_state="present" if tmpfs else "none"
    readonly=host.get("ReadonlyRootfs")
    root_state="read_only" if readonly is True else ("writable" if readonly is False else "unavailable")
    return {
        "command_override":cmd,
        "working_directory_override":_compare(live,built,"WorkingDir",_scalar),
        "user_override":_compare(live,built,"User",_scalar),
        "mount_dependency":mount_state,
        "tmpfs_dependency":tmpfs_state,
        "live_rootfs_policy":root_state,
    }

def validate_output(output):
    return (isinstance(output,dict) and set(output)==set(CLASSES)
            and all(type(output[key]) is str and output[key] in allowed
                    for key,allowed in CLASSES.items()))
