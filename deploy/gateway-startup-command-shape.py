#!/usr/bin/env python3
"""T007 static classification of a preserved Docker startup command.

Pure, finite-class output. Never returns argv, paths, script names, flags,
command fragments, environment names or any other private metadata.
This describes syntax, not the process' effective runtime behavior.
"""
from collections.abc import Mapping
import posixpath

FIELDS={
    "command_shape":{"direct_node","node_with_options","shell","init_wrapper","env_wrapper",
                     "package_runner","other_executable","empty","metadata_invalid"},
    "script_locator":{"simple_node_script","node_options_or_eval","wrapper_requires_review",
                      "non_node","unavailable"},
    "launch_argument_source":{"entrypoint_only","cmd_only","entrypoint_and_cmd","none","unavailable"},
}

def _exe(value):
    if not isinstance(value,str) or not value or "\x00" in value:
        return None
    return posixpath.basename(value).lower()

def _argv(value):
    if value is None:
        return []
    if not isinstance(value,list) or not all(isinstance(s,str) and "\x00" not in s for s in value):
        return None
    return value

def classify(container):
    if not isinstance(container,Mapping):
        return _result("metadata_invalid")
    cfg=container.get("Config")
    if not isinstance(cfg,Mapping):
        return _result("metadata_invalid")
    entry=_argv(cfg.get("Entrypoint"))
    cmd=_argv(cfg.get("Cmd"))
    if entry is None or cmd is None:
        return _result("metadata_invalid")
    if not entry and not cmd:
        return _result("empty",argument_source="none")
    if entry and cmd:
        source="entrypoint_and_cmd"
    elif entry:
        source="entrypoint_only"
    else:
        source="cmd_only"
    argv=entry+cmd
    executable=_exe(argv[0])
    if executable is None:
        return _result("metadata_invalid")
    if executable in ("sh","bash","dash","ash","zsh","busybox"):
        return _result("shell","wrapper_requires_review",source)
    if executable in ("tini","dumb-init"):
        return _result("init_wrapper","wrapper_requires_review",source)
    if executable=="env":
        return _result("env_wrapper","wrapper_requires_review",source)
    if executable in ("npm","npx","yarn","pnpm","corepack"):
        return _result("package_runner","wrapper_requires_review",source)
    if executable in ("node","nodejs"):
        args=argv[1:]
        # Only a first positional JS argument without Node flags is statically
        # resolvable by the previous source scanner. Do not interpret options,
        # eval, preloaders, unknown positional paths, or other launch modes.
        if args and not args[0].startswith("-") and args[0].endswith((".js",".mjs",".cjs")):
            return _result("direct_node","simple_node_script",source)
        return _result("node_with_options","node_options_or_eval",source)
    return _result("other_executable","non_node",source)

def _result(shape,locator="unavailable",argument_source="unavailable"):
    return {"command_shape":shape,"script_locator":locator,"launch_argument_source":argument_source}

def validate_output(value):
    return (type(value) is dict and set(value)==set(FIELDS)
            and all(type(value[key]) is str and value[key] in choices
                    for key,choices in FIELDS.items()))
