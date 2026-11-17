import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from copy import deepcopy

path=Path(__file__).with_name("gateway-functional-rehearsal-gate.py")
spec=importlib.util.spec_from_file_location("t007_gate",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RehearsalGateTest(unittest.TestCase):
    def setUp(self):
        self.current=deepcopy(mod.CURRENT_EVIDENCE)
    def test_current_real_evidence_is_blocked(self):
        result=mod.assess(self.current)
        self.assertEqual(result["decision"],"blocked_missing_synthetic_contract")
        self.assertEqual(result["production_release"],"blocked")
        self.assertEqual(result["rollback"],"unverified")
    def test_improving_one_unknown_never_opens_gate(self):
        self.current["synthetic_secret_contract"]="complete"
        self.assertEqual(mod.assess(self.current)["decision"],"blocked_unknown_contract")
        self.current["anonymous_endpoint_contract"]="verified_for_authentic_old_image"
        self.assertEqual(mod.assess(self.current)["decision"],"ready_for_isolated_design")
        self.assertEqual(mod.assess(self.current)["production_release"],"blocked")
    def test_malformed_or_extra_evidence_fails_closed_without_leakage(self):
        for payload in (None,[],{},dict(self.current,VERY_PRIVATE_TOKEN="do-not-log"),
                        dict(self.current,archive="stolen-value"),
                        dict(self.current,network_env={"secret":"no"})):
            decision=mod.assess(payload)
            self.assertEqual(decision["decision"],"blocked_unknown_contract")
            self.assertNotIn("do-not-log",repr(decision))
            self.assertNotIn("stolen-value",repr(decision))
    def test_network_contradiction_blocks(self):
        self.current["synthetic_secret_contract"]="complete"
        self.current["anonymous_endpoint_contract"]="verified_for_authentic_old_image"
        self.current["network_env"]="present"
        self.assertEqual(mod.assess(self.current)["decision"],"blocked_unknown_contract")
    def test_no_side_effect_apis(self):
        source=path.read_text()
        for danger in ("import subprocess","import socket","import requests","docker run",
                       "os.system","os.environ","urllib","AWS","ssh "):
            self.assertNotIn(danger,source)
if __name__=="__main__":
    unittest.main()
