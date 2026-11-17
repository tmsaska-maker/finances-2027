"""Synthetic tests: startup-difference outputs cannot leak saved commands/paths."""
import importlib.util
from pathlib import Path
import unittest

source=Path(__file__).with_name("gateway-saved-startup-delta.py")
spec=importlib.util.spec_from_file_location("saved_delta",source)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fake():
    return (
        {"Config":{"Entrypoint":["node"],"Cmd":["private-launch.js"],"WorkingDir":"/private/live",
                   "User":"root"},
         "HostConfig":{"Binds":[],"Tmpfs":None,"ReadonlyRootfs":False},
         "Mounts":[]},
        {"Config":{"Entrypoint":["node"],"Cmd":["original-launch.js"],"WorkingDir":"/app",
                   "User":"node"}}
    )

class DeltaTests(unittest.TestCase):
    def test_override_classes_and_no_private_text(self):
        live,image=fake()
        result=mod.classify_startup_delta(live,image)
        self.assertTrue(mod.validate_output(result))
        self.assertEqual(result["command_override"],"different")
        self.assertEqual(result["working_directory_override"],"different")
        self.assertEqual(result["user_override"],"different")
        self.assertEqual(result["mount_dependency"],"none")
        self.assertEqual(result["tmpfs_dependency"],"none")
        self.assertEqual(result["live_rootfs_policy"],"writable")
        for secret in ("private-launch","original-launch","/private/live","/app","root","node"):
            self.assertNotIn(secret,repr(result))
    def test_same_configuration(self):
        live,image=fake()
        live["Config"]=image["Config"].copy()
        live["HostConfig"]["ReadonlyRootfs"]=True
        result=mod.classify_startup_delta(live,image)
        for field in ("command_override","working_directory_override","user_override"):
            self.assertEqual(result[field],"same")
        self.assertEqual(result["live_rootfs_policy"],"read_only")
    def test_mount_and_tmpfs_presence(self):
        live,image=fake()
        live["Mounts"]=[{"Source":"/secret/data"}]
        live["HostConfig"]["Tmpfs"]={"/secret/location":"rw"}
        result=mod.classify_startup_delta(live,image)
        self.assertEqual(result["mount_dependency"],"present")
        self.assertEqual(result["tmpfs_dependency"],"present")
        self.assertNotIn("/secret",repr(result))
    def test_missing_or_malformed_metadata_fails_closed(self):
        live,image=fake()
        self.assertIsNone(mod.classify_startup_delta(None,image))
        self.assertIsNone(mod.classify_startup_delta(live,{"Config":None}))
        live["Config"]["Cmd"]={"secret":"do-not-print"}
        self.assertEqual(mod.classify_startup_delta(live,image)["command_override"],"unavailable")
        self.assertFalse(mod.validate_output(dict(mod.classify_startup_delta(live,image),raw="secrets")))
        self.assertFalse(mod.validate_output({"command_override":"secret"}))
    def test_pure_module_has_no_runtime_apis(self):
        text=source.read_text()
        for term in ("subprocess","socket","os.environ","docker ","requests","urllib"):
            self.assertNotIn(term,text)

if __name__=="__main__":
    unittest.main()
