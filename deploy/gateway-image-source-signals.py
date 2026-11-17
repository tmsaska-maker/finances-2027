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
    "archive_structure":{"docker_save_manifest","manifest_missing","manifest_invalid","archive_unreadable"},
    "layer_reference":{"accepted","rejected","unavailable"},
    "layer_parse":{"readable","unreadable","unavailable"},
}

def _result(coverage, env="unavailable", writes="unavailable",
            structure="docker_save_manifest", reference="unavailable", layer="unavailable"):
    return {
        "source_coverage":coverage,
        "node_env_read_signal":env,
        "filesystem_write_api_signal":writes,
        "archive_structure":structure,
        "layer_reference":reference,
        "layer_parse":layer,
    }

def _safe_layer_name(name):
    if not isinstance(name,str) or not name or len(name)>256:
        return False
    if "\\x00" in name or "\\\\" in name:
        return False
    path=PurePosixPath(name)
    return not path.is_absolute() and all(p not in (".","..") for p in name.split("/")) and len(path.parts)>0

def inspect_archive(archive_path):
    """Read Docker-save manifest layers without extracting or executing content.

    Docker save can name layers as <id>/layer.tar, <id>.tar or digest-addressed
    paths. The manifest, not a hardcoded filename suffix, is authoritative.
    Fail closed on unknown formats; expose only broad fixed diagnostics.
    """
    try:
        with tarfile.open(archive_path,mode="r:") as outer:
            try:
                mf=outer.getmember("manifest.json")
            except KeyError:
                return _result("unsupported",structure="manifest_missing")
            if not mf.isfile() or mf.size<=0 or mf.size>MAX_MANIFEST:
                return _result("unsupported",structure="manifest_invalid")
            reader=outer.extractfile(mf)
            if reader is None:
                return _result("unsupported",structure="manifest_invalid")
            try:
                manifest=json.loads(reader.read(MAX_MANIFEST+1))
            except (ValueError,UnicodeError):
                return _result("unsupported",structure="manifest_invalid")
            if not isinstance(manifest,list) or len(manifest)!=1 or not isinstance(manifest[0],dict):
                return _result("unsupported",structure="manifest_invalid")
            names=manifest[0].get("Layers")
            if not isinstance(names,list) or not names or len(names)>MAX_LAYERS:
                return _result("unsupported",structure="manifest_invalid")
            if not all(_safe_layer_name(n) for n in names) or len(set(names))!=len(names):
                return _result("unsupported",reference="rejected")
            scanned=0
            env=False
            writes=False
            partial=False
            candidates=0
            layer_status="readable"
            for name in names:
                try:
                    entry=outer.getmember(name)
                    if not entry.isfile() or entry.size<=0:
                        layer_status="unreadable"
                        break
                    stream=outer.extractfile(entry)
                    if stream is None:
                        layer_status="unreadable"
                        break
                    with stream, tarfile.open(fileobj=stream,mode="r|*") as inner:
                        members=0
                        for item in inner:
                            members+=1
                            if members>MAX_INNER_MEMBERS:
                                partial=True
                                break
                            path=PurePosixPath(item.name)
                            if (not item.isfile() or path.is_absolute() or
                                ".." in path.parts or "\\\\" in item.name):
                                continue
                            if path.suffix not in (".js",".mjs",".cjs"):
                                continue
                            if item.size<0 or item.size>MAX_SOURCE_FILE:
                                partial=True
                                continue
                            if scanned+item.size>MAX_SOURCE_BYTES:
                                partial=True
                                break
                            f=inner.extractfile(item)
                            if f is None:
                                partial=True
                                continue
                            data=f.read(MAX_SOURCE_FILE+1)
                            if len(data)!=item.size:
                                partial=True
                                continue
                            scanned+=len(data)
                            candidates+=1
                            env=env or bool(ENV_PATTERN.search(data))
                            writes=writes or bool(WRITE_PATTERN.search(data))
                        if partial and (members>MAX_INNER_MEMBERS or scanned>=MAX_SOURCE_BYTES):
                            break
                except (OSError,ValueError,tarfile.TarError,EOFError):
                    layer_status="unreadable"
                    break
            if layer_status!="readable":
                return _result("unsupported",reference="accepted",layer="unreadable")
            coverage="partial" if partial else ("scanned" if candidates else "no_candidate_source")
            return _result(
                coverage,
                "present" if env else ("not_seen" if candidates and not partial else "unavailable"),
                "present" if writes else ("not_seen" if candidates and not partial else "unavailable"),
                reference="accepted",layer="readable")
    except (OSError,ValueError,TypeError,UnicodeError,tarfile.TarError,OverflowError,MemoryError,EOFError):
        return _result("unsupported",structure="archive_unreadable")

def validate_output(result):
    return (type(result) is dict and set(result)==set(FIXED)
            and all(type(result[k]) is str and result[k] in values
                    for k,values in FIXED.items()))
