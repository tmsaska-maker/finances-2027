"""Synthetic unit tests for metadata-only classification. No Docker / network."""
import importlib.util
from pathlib import Path
import unittest

source=Path(__file__).with_name("finance-gateway-real-offline-probe.py")
spec=importlib.util.spec_from_file_location("offline_probe",source)
probe=importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class OfflineClassificationTests(unittest.TestCase):
    def test_exit_code_buckets(self):
        examples=[
            ({"ExitCode":0},"clean_exit"),
            ({"ExitCode":1},"application_exit_1"),
            ({"ExitCode":2},"application_exit_2"),
            ({"ExitCode":126},"cannot_execute"),
            ({"ExitCode":127},"command_not_found"),
            ({"ExitCode":137},"signal_kill_or_oom"),
            ({"ExitCode":143},"termination_signal"),
            ({"ExitCode":55},"other_nonzero_exit"),
            ({}, "exit_status_unavailable"),
            ({"ExitCode":137,"OOMKilled":True},"oom_killed"),
            ({"ExitCode":1,"Error":"private data that must not leak"},"runtime_error_present"),
        ]
        for state,expected in examples:
            with self.subTest(expected=expected):
                self.assertEqual(probe.classify_exit(state),expected)
    def test_environment_delta_no_raw_names_or_values(self):
        old={"Config":{"Env":[
            "PATH=/usr/local/bin", "FINANCES_API_TOKEN=production-must-not-leak",
            "FINANCES_SESSION_SECRET=production-value",
            "PRIVATE_API_KEY=secret",
            "FINANCES_GATEWAY_PORT=9999"
        ]}}
        image_env=["PATH=/usr/local/bin"]
        result=probe.classify_env_key_delta(old,image_env)
        self.assertEqual(result,("additional_sensitive_key_names","one_or_more"))
        self.assertNotIn("PRIVATE_API_KEY",repr(result))
        self.assertNotIn("production",repr(result))
        ordinary={"Config":{"Env":["PATH=/bin","FINANCES_GATEWAY_PORT=9999"]}}
        self.assertEqual(probe.classify_env_key_delta(ordinary,["PATH=/bin"]),("additional_network_or_runtime_key_names","one_or_more"))
        self.assertEqual(probe.classify_env_key_delta({"Config":{"Env":["PATH=/bin"]}},["PATH=/bin"]),("none","none"))
        self.assertEqual(probe.classify_env_key_delta({"Config":{"Env":None}}),("none","none"))
        self.assertEqual(probe.classify_env_key_delta({"Config":{"Env":[42]}}),("unavailable","unavailable"))

if __name__=="__main__":
    unittest.main()
