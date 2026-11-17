"""Synthetic tests for the root-only static T007 snapshot audit. No Docker/SSH/AWS."""
import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main, mock

DIR=Path(__file__).parent
def load(path,name):
    spec=importlib.util.spec_from_file_location(name,DIR/path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

audit=load("finance-gateway-static-snapshot-audit.py","snapshot_audit")
checker=load("gateway-static-startup-contract.py","contract")
IMAGE_ID="sha256:"+"c"*64

class SnapshotAuditTests(TestCase):
    def fixture(self,base):
        sha=base/"image.sha256"
        sha.write_text(IMAGE_ID+"\n")
        archive=base/"original-gateway-image.tar"
        archive.write_bytes(b"fake synthetic archive")
        (base/"archive.sha256").write_text(
            hashlib.sha256(archive.read_bytes()).hexdigest()+"  original-gateway-image.tar\n"
        )
        (base/"running-container.json").write_text(json.dumps({
            "Image":IMAGE_ID,"Config":{"Env":["PATH=/bin","PRIVATE_SIGNING_KEY=should-never-leak"]}
        }))
        (base/"running-image.json").write_text(json.dumps({
            "Id":IMAGE_ID,"Config":{"Env":["PATH=/bin"],"Entrypoint":["node"],"Cmd":["old.mjs"]}
        }))
        return base

    def call(self,snap):
        # A nonprivileged CI runner uses synthetic files. Never bypass production main() root gate.
        with mock.patch.object(audit,"secure_dir"),mock.patch.object(audit,"secure_file",side_effect=lambda p,max_size=None:p):
            return audit.validate_and_classify(snap,checker.classify_metadata)

    def test_safe_classification_and_no_data_leak(self):
        with TemporaryDirectory() as tmp:
            snap=self.fixture(Path(tmp))
            got=self.call(snap)
            self.assertEqual(got["result"],"classified")
            self.assertEqual(got["additional_sensitive_env"],"present")
            self.assertEqual(got["production_rollback"],"unverified")
            self.assertNotIn("PRIVATE_SIGNING_KEY",repr(got))
            self.assertNotIn("should-never-leak",repr(got))

    def test_checksum_mismatch_blocks(self):
        with TemporaryDirectory() as tmp:
            snap=self.fixture(Path(tmp))
            (snap/"original-gateway-image.tar").write_bytes(b"tampered")
            with self.assertRaises(SystemExit):
                self.call(snap)

    def test_mismatched_image_blocks(self):
        with TemporaryDirectory() as tmp:
            snap=self.fixture(Path(tmp))
            image=json.loads((snap/"running-image.json").read_text())
            image["Id"]="sha256:"+"d"*64
            (snap/"running-image.json").write_text(json.dumps(image))
            with self.assertRaises(SystemExit):
                self.call(snap)

    def test_rejects_classifier_extra_fields_or_secret_value(self):
        with TemporaryDirectory() as tmp:
            snap=self.fixture(Path(tmp))
            bad=lambda _c,_i: {
                "result":"classified","entrypoint":"present","additional_sensitive_env":"present",
                "additional_network_env":"none","other_env":"none",
                "offline_functional_start":"unverified","production_rollback":"unverified",
                "raw_env":"should-never-leak",
            }
            with self.assertRaises(SystemExit):
                with mock.patch.object(audit,"secure_dir"),mock.patch.object(audit,"secure_file",side_effect=lambda p,max_size=None:p):
                    audit.validate_and_classify(snap,bad)

    def test_no_forbidden_apis_in_audit_code(self):
        source=(DIR/"finance-gateway-static-snapshot-audit.py").read_text()
        for forbidden in ("import subprocess","import socket","import requests","docker run","docker exec",
                          "docker inspect","os.system","os.popen","aws ","ssh ","scp "):
            self.assertNotIn(forbidden,source)

if __name__=="__main__":
    main()
