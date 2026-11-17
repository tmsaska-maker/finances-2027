#!/usr/bin/env python3
"""Bounded, no-extraction, static analysis of an already verified private Docker-save tar.

Only finite signal classifications leave the host. Never returns paths, bytes,
environment names, source code, layer identifiers or counts.
No Docker, network, process execution, configuration copying or filesystem writes.
Static source tokens are heuristic: no runtime behavior is proven.
"""
import json
from pathlib import PurePosixPath
import re
import tarfile

MAX_MANIFEST=1024*1024
MAX_SOURCE_FILE=1024*1024
MAX_SOURCE_BYTES=16*1024*1024
MAX_LAYERS=64
MAX_INNER_MEMBERS=20000
WRITE_PATTERN=re.compile(
    rb"\b(?:writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|"
    rb"mkdir|createWriteStream|openSync|renameSync|unlinkSync)\s*\("
)
ENV_PATTERN=re.compile(rb"\bprocess\s*\.\s*env\b|\bprocess\s*\[\s*['\"]env['\"]\s*\]")
FIXED={
    "source_coverage":{"scanned","no_candidate_source","partial","unsupported"},
    "node_env_read_signal":{"present","not_seen","unavailable"},
    "filesystem_write_api_signal":{"present","not_seen","unavailable"},
}

def _unavailable(coverage):
    return {"source_coverage":coverage,
            "node_env_read_signal":"unavailable",
            "filesystem_write_api_signal":"unavailable"}

def inspect_archive(archive_path):
    """Returns allowlisted signals; malformed/oversized inputs yield unavailable.

    Only accepts Docker-save manifest layers and scans regular JS source files.
    Refuses extraction, symlinks, unsafe/absolute tar member paths and large
    entries. This is a limited heuristic over stored layer contents.
    """
    try:
        with tarfile.open(archive_path,mode="r:") as outer:
            try:
                mf=outer.getmember("manifest.json")
            except KeyError:
                return _unavailable("unsupported")
            if not mf.isfile() or mf.size>MAX_MANIFEST:
                return _unavailable("unsupported")
            reader=outer.extractfile(mf)
            if reader is None:
                return _unavailable("unsupported")
            manifest=json.loads(reader.read(MAX_MANIFEST+1))
            if not isinstance(manifest,list) or len(manifest)!=1:
                return _unavailable("unsupported")
            names=manifest[0].get("Layers") if isinstance(manifest[0],dict) else None
            if not isinstance(names,list) or not names or len(names)>MAX_LAYERS:
                return _unavailable("unsupported")
            if len(set(names))!=len(names):
                return _unavailable("unsupported")
            scanned=0
            env=False
            writes=False
            partial=False
            candidates=0
            for name in names:
                if not isinstance(name,str) or not name.endswith("/layer.tar"):
                    return _unavailable("unsupported")
                posix=PurePosixPath(name)
                if posix.is_absolute() or ".." in posix.parts or "\\" in name:
                    return _unavailable("unsupported")
                try:
                    layer=outer.getmember(name)
                except KeyError:
                    return _unavailable("unsupported")
                if not layer.isfile():
                    return _unavailable("unsupported")
                stream=outer.extractfile(layer)
                if stream is None:
                    return _unavailable("unsupported")
                with stream, tarfile.open(fileobj=stream,mode="r|*") as inner:
                    members=0
                    for entry in inner:
                        members+=1
                        if members>MAX_INNER_MEMBERS:
                            partial=True
                            break
                        path=PurePosixPath(entry.name)
                        if (not entry.isfile() or path.is_absolute() or
                            ".." in path.parts or "\\" in entry.name):
                            continue
                        if path.suffix not in (".js",".mjs",".cjs"):
                            continue
                        if entry.size>MAX_SOURCE_FILE:
                            partial=True
                            continue
                        if scanned+entry.size>MAX_SOURCE_BYTES:
                            partial=True
                            break
                        f=inner.extractfile(entry)
                        if f is None:
                            partial=True
                            continue
                        data=f.read(MAX_SOURCE_FILE+1)
                        if len(data)!=entry.size:
                            partial=True
                            continue
                        scanned+=len(data)
                        candidates+=1
                        env=env or bool(ENV_PATTERN.search(data))
                        writes=writes or bool(WRITE_PATTERN.search(data))
                    if partial and (members>MAX_INNER_MEMBERS or scanned>=MAX_SOURCE_BYTES):
                        break
            coverage="partial" if partial else ("scanned" if candidates else "no_candidate_source")
            return {
                "source_coverage":coverage,
                "node_env_read_signal":"present" if env else ("not_seen" if candidates and not partial else "unavailable"),
                "filesystem_write_api_signal":"present" if writes else ("not_seen" if candidates and not partial else "unavailable"),
            }
    except (OSError,ValueError,TypeError,UnicodeError,tarfile.TarError,OverflowError,MemoryError):
        return _unavailable("unsupported")

def validate_output(result):
    return (type(result) is dict and set(result)==set(FIXED)
            and all(type(result[k]) is str and result[k] in values
                    for k,values in FIXED.items()))
