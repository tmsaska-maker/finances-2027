#!/usr/bin/env python3
"""Static, bounded lookup of the exact Node startup script in saved Docker layers.

Pure classification only: never returns executable paths, source, ENV names or
secret values. No extraction, Docker, network, execution or filesystem writes.
No claim that a textual match executes at runtime.
"""
import json
import posixpath
import re
import tarfile

MAX_MANIFEST=1024*1024
MAX_LAYERS=64
MAX_LAYER_MEMBERS=20000
MAX_ENTRY_BYTES=1024*1024
WRITE=re.compile(rb"\b(?:writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|mkdir|createWriteStream|openSync|renameSync|unlinkSync)\s*\(")
ENV=re.compile(rb"\bprocess\s*\.\s*env\b|\bprocess\s*\[\s*['\"]env['\"]\s*\]")
ALLOWED={
    "startup_locator":{"resolved_node_script","unsupported_command","unsafe_path","metadata_invalid"},
    "startup_source":{"readable","missing","oversized","unavailable"},
    "startup_env_signal":{"present","not_seen","unavailable"},
    "startup_write_signal":{"present","not_seen","unavailable"},
}
def result(locator,source="unavailable",env="unavailable",writes="unavailable"):
    return {"startup_locator":locator,"startup_source":source,
            "startup_env_signal":env,"startup_write_signal":writes}

def validate_output(obj):
    return (type(obj) is dict and set(obj)==set(ALLOWED)
            and all(type(obj[k]) is str and obj[k] in allowed for k,allowed in ALLOWED.items()))

def startup_target(container):
    """Only simple direct Node script execution is supported; no shell inference."""
    if not isinstance(container,dict) or not isinstance(container.get("Config"),dict):
        return None,"metadata_invalid"
    cfg=container["Config"]
    entry=cfg.get("Entrypoint") or []
    cmd=cfg.get("Cmd") or []
    if not isinstance(entry,list) or not isinstance(cmd,list) or not all(type(v) is str for v in entry+cmd):
        return None,"metadata_invalid"
    argv=entry+cmd
    if not argv or posixpath.basename(argv[0]) not in ("node","nodejs"):
        return None,"unsupported_command"
    arguments=argv[1:]
    # Fail closed on flags and eval, loaders, -r, --require, --import, etc.
    if not arguments or arguments[0].startswith("-"):
        return None,"unsupported_command"
    target=arguments[0]
    if not target.endswith((".js",".mjs",".cjs")):
        return None,"unsupported_command"
    cwd=cfg.get("WorkingDir") or "/"
    if not isinstance(cwd,str) or not cwd.startswith("/"):
        return None,"unsafe_path"
    if any(v in (".","..") for v in target.split("/")) or "\\" in target or "\\" in cwd:
        return None,"unsafe_path"
    path=posixpath.normpath(target if target.startswith("/") else posixpath.join(cwd,target))
    if not path.startswith("/") or path=="/":
        return None,"unsafe_path"
    return path.lstrip("/"),"resolved_node_script"

def _safe_ref(name):
    return (type(name) is str and 0<len(name)<=256 and "\\" not in name
            and not name.startswith("/") and all(p not in (".","..","") for p in name.split("/")))

def inspect_startup(archive,container):
    target,locator=startup_target(container)
    if target is None:
        return result(locator)
    try:
        with tarfile.open(archive,mode="r:") as outer:
            mf=outer.getmember("manifest.json")
            if not mf.isfile() or not 0<mf.size<=MAX_MANIFEST:
                return result(locator)
            mfile=outer.extractfile(mf)
            if mfile is None:
                return result(locator)
            manifest=json.loads(mfile.read(MAX_MANIFEST+1))
            if not isinstance(manifest,list) or len(manifest)!=1 or not isinstance(manifest[0],dict):
                return result(locator)
            layers=manifest[0].get("Layers")
            if not isinstance(layers,list) or not 0<len(layers)<=MAX_LAYERS or not all(_safe_ref(n) for n in layers):
                return result(locator)
            current=None
            too_big=False
            for layer_name in layers:
                layer=outer.getmember(layer_name)
                if not layer.isfile():
                    return result(locator)
                stream=outer.extractfile(layer)
                if stream is None:
                    return result(locator)
                with stream,tarfile.open(fileobj=stream,mode="r|*") as inner:
                    for i,member in enumerate(inner):
                        if i>=MAX_LAYER_MEMBERS:
                            return result(locator)
                        name=member.name.removeprefix("./").lstrip("/")
                        # A whiteout may remove this script or a parent directory.
                        base=posixpath.basename(target)
                        directory=posixpath.dirname(target)
                        if name==posixpath.join(directory,".wh."+base):
                            current=None
                            too_big=False
                        if name==posixpath.join(directory,".wh..wh..opq"):
                            return result(locator)
                        if member.name.startswith("/") or ".." in name.split("/") or "\\" in name:
                            continue
                        if name!=target:
                            continue
                        if not member.isfile():
                            return result(locator)
                        if member.size<0 or member.size>MAX_ENTRY_BYTES:
                            current=None
                            too_big=True
                            continue
                        source=inner.extractfile(member)
                        if source is None:
                            return result(locator)
                        data=source.read(MAX_ENTRY_BYTES+1)
                        if len(data)!=member.size:
                            return result(locator)
                        current=data
                        too_big=False
            if too_big:
                return result(locator,"oversized")
            if current is None:
                return result(locator,"missing")
            return result(locator,"readable",
                          "present" if ENV.search(current) else "not_seen",
                          "present" if WRITE.search(current) else "not_seen")
    except (OSError,ValueError,TypeError,UnicodeError,tarfile.TarError,EOFError,KeyError,OverflowError,MemoryError):
        return result(locator)
