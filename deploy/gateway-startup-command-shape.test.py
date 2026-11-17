"""Synthetic-only startup syntax classification tests; no private metadata."""
import importlib.util
from pathlib import Path
import unittest

SOURCE=Path(__file__).with_name("gateway-startup-command-shape.py")
spec=importlib.util.spec_from_file_location("shape",SOURCE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fake(entry=None,cmd=None):
    return {"Config":{"Entrypoint":entry,"Cmd":cmd,"Env":["PRIVATE_KEY=never-print-value"]}}

class StartupShapeTests(unittest.TestCase):
    def check(self,entry,cmd,shape,locator,source):
        out=mod.classify(fake(entry,cmd))
        self.assertTrue(mod.validate_output(out))
        self.assertEqual(out,{"command_shape":shape,"script_locator":locator,
                              "launch_argument_source":source})
        for forbidden in ("PRIVATE_KEY","never-print-value","private", "launch.js"):
            self.assertNotIn(forbidden,repr(out))

    def test_simple_node_from_both(self):
        self.check(["node"],["/private/launch.js"],"direct_node","simple_node_script","entrypoint_and_cmd")

    def test_direct_node_with_entrypoint_only(self):
        self.check(["/usr/bin/node","/app/start.mjs"],None,"direct_node","simple_node_script","entrypoint_only")

    def test_direct_node_cmd_only(self):
        self.check(None,["nodejs","server.cjs"],"direct_node","simple_node_script","cmd_only")

    def test_node_options_fail_closed(self):
        for cmd in (["--require","/private/bootstrap.js","app.js"],
                    ["--import","./setup.mjs","app.mjs"],
                    ["-e","process.env.SECRET"],
                    ["--env-file=/private/secure.env","app.js"],[]):
            self.check(["node"],cmd,"node_with_options","node_options_or_eval",
                       "entrypoint_and_cmd" if cmd else "entrypoint_only")

    def test_shell_and_init_wrappers(self):
        self.check(["/bin/sh","-c"],["node /private/launch.js"],"shell","wrapper_requires_review","entrypoint_and_cmd")
        self.check(["/usr/bin/tini","--"],["node","app.js"],"init_wrapper","wrapper_requires_review","entrypoint_and_cmd")
        self.check(["env"],["NODE_ENV=private","node","app.js"],"env_wrapper","wrapper_requires_review","entrypoint_and_cmd")
        self.check(["npm"],["start"],"package_runner","wrapper_requires_review","entrypoint_and_cmd")

    def test_other_binary_not_assumed_to_be_node(self):
        self.check(["/private/gateway"],["--config","/secret"],"other_executable","non_node","entrypoint_and_cmd")

    def test_missing_and_malformed_inputs(self):
        self.check(None,None,"empty","unavailable","none")
        for value in (None,{},{"Config":None},{"Config":{"Entrypoint":"node","Cmd":["app.js"]}},
                      {"Config":{"Entrypoint":["node",0],"Cmd":[]}},
                      {"Config":{"Entrypoint":["node\x00bad"],"Cmd":[]}}):
            out=mod.classify(value)
            self.assertTrue(mod.validate_output(out))
            self.assertEqual(out["command_shape"],"metadata_invalid")

    def test_strict_output_rejection(self):
        self.assertFalse(mod.validate_output({"command_shape":"node","script_locator":"raw"}))
        self.assertFalse(mod.validate_output(dict(mod.classify(fake(["node"],["app.js"])),command="SECRET")))

    def test_no_host_apis(self):
        source=SOURCE.read_text()
        for forbidden in ("import os","subprocess","socket","requests","urllib","open(","print(","docker "):
            self.assertNotIn(forbidden,source)

if __name__=="__main__":
    unittest.main()
