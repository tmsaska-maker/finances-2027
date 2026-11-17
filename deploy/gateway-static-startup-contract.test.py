"""Synthetic, secret-leak-safe unit tests for T007 static image analysis."""
import importlib.util
from pathlib import Path
import unittest

source=Path(__file__).with_name("gateway-static-startup-contract.py")
spec=importlib.util.spec_from_file_location("static_contract",source)
checker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

IMAGE_ID="sha256:"+"a"*64

def fixture(container_env,image_env=None):
    return (
        {"Image":IMAGE_ID,"Config":{"Env":container_env}},
        {"Id":IMAGE_ID,"Config":{"Env":image_env if image_env is not None else ["PATH=/bin"],"Entrypoint":["node"],"Cmd":["main.mjs"]}},
    )

class StaticContractTests(unittest.TestCase):
    def test_clean_synthetic_metadata(self):
        c,i=fixture(["PATH=/bin","NODE_ENV=production","FINANCES_API_TOKEN=private"])
        self.assertEqual(checker.classify_metadata(c,i),{
            "result":"classified","entrypoint":"present",
            "additional_sensitive_env":"none","additional_network_env":"none",
            "other_env":"none","offline_functional_start":"unverified",
            "production_rollback":"unverified"
        })

    def test_missing_key_families_do_not_leak(self):
        c,i=fixture(["PATH=/bin","PRIVATE_SIGNING_KEY=very-private-value",
                     "LEGACY_DATABASE_URL=postgresql://sensitive-host/private-db",
                     "CUSTOM_FLAG=private-note"])
        output=checker.classify_metadata(c,i)
        self.assertEqual(output["additional_sensitive_env"],"present")
        self.assertEqual(output["additional_network_env"],"present")
        self.assertEqual(output["other_env"],"present")
        rendered=repr(output)
        for forbidden in ("PRIVATE_SIGNING_KEY","LEGACY_DATABASE_URL","CUSTOM_FLAG","very-private-value",
                          "sensitive-host","private-db","private-note"):
            self.assertNotIn(forbidden,rendered)

    def test_invalid_metadata_fails_closed(self):
        c,i=fixture(["PATH=/bin"])
        for bad in ({"Config":{"Env":[]}}, {"Image":IMAGE_ID,"Config":{"Env":["BAD"]}},
                    {"Image":IMAGE_ID,"Config":{"Env":None}}):
            self.assertEqual(checker.classify_metadata(bad,i)["result"],"metadata_invalid")
        self.assertEqual(checker.classify_json_strings("{secret", "{}"),{"result":"metadata_invalid"})
        i["Id"]="sha256:"+"b"*64
        self.assertEqual(checker.classify_metadata(c,i),{"result":"image_identity_mismatch"})

    def test_not_a_runtime_or_rollback_claim(self):
        c,i=fixture(["PATH=/bin"])
        i["Config"]["Cmd"]=None
        i["Config"]["Entrypoint"]=None
        result=checker.classify_metadata(c,i)
        self.assertEqual(result["entrypoint"],"missing")
        self.assertEqual(result["offline_functional_start"],"unverified")
        self.assertEqual(result["production_rollback"],"unverified")

if __name__=="__main__":
    unittest.main()
