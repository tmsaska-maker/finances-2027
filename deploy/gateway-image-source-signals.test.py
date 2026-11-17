"""Synthetic-only tests. No authentic images, secrets, Docker or network."""
import importlib.util
import io
import json
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest

SOURCE=Path(__file__).with_name("gateway-image-source-signals.py")
spec=importlib.util.spec_from_file_location("image_signals",SOURCE)
scanner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)

def tar_bytes(entries):
    buf=io.BytesIO()
    with tarfile.open(fileobj=buf,mode="w") as out:
        for name,data in entries:
            ti=tarfile.TarInfo(name)
            ti.size=len(data)
            out.addfile(ti,io.BytesIO(data))
    return buf.getvalue()

def synthetic_image(sources, names=None):
    inner=tar_bytes(sources)
    layer="layer-a/layer.tar"
    manifest=json.dumps([{"Config":"config.json","RepoTags":["fake:latest"],"Layers":[layer]}]).encode()
    return tar_bytes([("manifest.json",manifest),(layer,inner)])

class ImageSignalTests(unittest.TestCase):
    def call(self,archive):
        with TemporaryDirectory() as d:
            p=Path(d)/"synthetic.tar"
            p.write_bytes(archive)
            got=scanner.inspect_archive(p)
            self.assertTrue(scanner.validate_output(got))
            return got

    def test_detects_possible_write_and_env_without_leaking_contents(self):
        src=b'const private_token="TOP_SECRET_VALUE"; process.env["CUSTOM_SECRET"]; fs.writeFileSync("/private/token",private_token);'
        result=self.call(synthetic_image([("app/main.mjs",src)]))
        self.assertEqual(result,{"source_coverage":"scanned",
            "node_env_read_signal":"present","filesystem_write_api_signal":"present"})
        for secret in ("TOP_SECRET_VALUE","CUSTOM_SECRET","/private/token","main.mjs"):
            self.assertNotIn(secret,repr(result))

    def test_no_matches_only_means_not_seen(self):
        got=self.call(synthetic_image([("opt/app/main.js",b"console.log('safe synthetic program')")]))
        self.assertEqual(got["source_coverage"],"scanned")
        self.assertEqual(got["filesystem_write_api_signal"],"not_seen")
        self.assertEqual(got["node_env_read_signal"],"not_seen")

    def test_non_js_is_not_evidence_of_absence(self):
        got=self.call(synthetic_image([("bin/launch",b"SECRET")]))
        self.assertEqual(got["source_coverage"],"no_candidate_source")
        self.assertEqual(got["node_env_read_signal"],"unavailable")
        self.assertEqual(got["filesystem_write_api_signal"],"unavailable")

    def test_corrupt_archive_fails_closed(self):
        got=self.call(b"not a docker tar")
        self.assertEqual(got["source_coverage"],"unsupported")
        self.assertEqual(got["node_env_read_signal"],"unavailable")

    def test_oversized_source_is_never_read(self):
        src=b"A"*(scanner.MAX_SOURCE_FILE+1)
        got=self.call(synthetic_image([("app/huge.js",src)]))
        self.assertEqual(got["source_coverage"],"partial")
        self.assertEqual(got["filesystem_write_api_signal"],"unavailable")

    def test_archive_path_traversal_never_scanned(self):
        got=self.call(synthetic_image([("../private.js",b"process.env.X;fs.writeFileSync('/tmp/x','x')")]))
        self.assertEqual(got["source_coverage"],"no_candidate_source")

    def test_reject_extra_output_fields(self):
        got={"source_coverage":"scanned","node_env_read_signal":"present",
             "filesystem_write_api_signal":"present","private_source":"DO_NOT_LOG"}
        self.assertFalse(scanner.validate_output(got))

    def test_no_runtime_apis(self):
        code=SOURCE.read_text()
        for term in ("subprocess","socket","os.environ","docker run","docker exec",
                     "extractall(","extract(","urllib","requests"):
            self.assertNotIn(term,code)

if __name__=="__main__":
    unittest.main()
