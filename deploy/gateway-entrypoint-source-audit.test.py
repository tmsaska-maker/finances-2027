"""Synthetic tests for exact entrypoint-source classification."""
import importlib.util
import io
import json
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest

source=Path(__file__).with_name("gateway-entrypoint-source-audit.py")
spec=importlib.util.spec_from_file_location("startup_source",source)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def tar_data(files):
    buf=io.BytesIO()
    with tarfile.open(fileobj=buf,mode="w") as archive:
        for name,data in files:
            header=tarfile.TarInfo(name)
            header.size=len(data)
            archive.addfile(header,io.BytesIO(data))
    return buf.getvalue()

def image(layers):
    manifest=json.dumps([{"Layers":[f"opaque/{i}.tar" for i in range(len(layers))]}]).encode()
    return tar_data([("manifest.json",manifest)]+[(f"opaque/{i}.tar",tar_data(files)) for i,files in enumerate(layers)])

def config(cmd=None,entry=None,cwd="/srv"):
    return {"Config":{"Entrypoint":["node"] if entry is None else entry,
                      "Cmd":["main.mjs"] if cmd is None else cmd,"WorkingDir":cwd}}

class StartupTest(unittest.TestCase):
    def run_scan(self,raw,cfg=None):
        with TemporaryDirectory() as d:
            p=Path(d)/"synthetic.tar"
            p.write_bytes(raw)
            output=mod.inspect_startup(p,config() if cfg is None else cfg)
            self.assertTrue(mod.validate_output(output))
            return output

    def test_only_target_not_dependencies(self):
        raw=image([[("srv/main.mjs",b"console.log('started')"),
                    ("srv/vendor/write.js",b"process.env.SECRET; fs.writeFileSync('/private/key','x')")]])
        got=self.run_scan(raw)
        self.assertEqual(got["startup_locator"],"resolved_node_script")
        self.assertEqual(got["startup_source"],"readable")
        self.assertEqual(got["startup_env_signal"],"not_seen")
        self.assertEqual(got["startup_write_signal"],"not_seen")

    def test_startup_signals_are_redacted(self):
        raw=image([[("srv/main.mjs",b"process.env.MY_SECRET; fs.writeFileSync('/private/key','abc')")]])
        got=self.run_scan(raw)
        self.assertEqual(got["startup_env_signal"],"present")
        self.assertEqual(got["startup_write_signal"],"present")
        self.assertNotIn("MY_SECRET",repr(got))
        self.assertNotIn("/private/key",repr(got))

    def test_later_layer_replacement_wins(self):
        raw=image([[("srv/main.mjs",b"process.env.SECRET")],
                   [("srv/main.mjs",b"console.log('replacement')")]])
        got=self.run_scan(raw)
        self.assertEqual(got["startup_source"],"readable")
        self.assertEqual(got["startup_env_signal"],"not_seen")

    def test_unsupported_launch_forms_fail_closed(self):
        raw=image([[("srv/main.mjs",b"process.env.SECRET")]])
        for cfg in [config(cmd=["-e","process.env.SECRET"]),config(entry=["sh","-c"],cmd=["node main.mjs"]),
                    config(entry=["node","--require","setup.js"]),
                    config(cmd=["../private/main.mjs"]),config(cmd=["main.mjs"],cwd="relative")]:
            got=self.run_scan(raw,cfg)
            self.assertEqual(got["startup_source"],"unavailable")
            self.assertEqual(got["startup_env_signal"],"unavailable")

    def test_missing_or_oversized_target(self):
        self.assertEqual(self.run_scan(image([[("srv/vendor.js",b"process.env.SECRET")]]))["startup_source"],"missing")
        huge=b"x"*(mod.MAX_ENTRY_BYTES+1)
        self.assertEqual(self.run_scan(image([[("srv/main.mjs",huge)]]))["startup_source"],"oversized")

    def test_unrecognized_archive_fails_closed(self):
        got=self.run_scan(b"invalid tar")
        self.assertEqual(got["startup_source"],"unavailable")

    def test_no_unsafe_apis(self):
        txt=source.read_text()
        for bad in ("subprocess","import socket","os.environ","docker run","extractall(","extract(","requests","urllib"):
            self.assertNotIn(bad,txt)

if __name__=="__main__":
    unittest.main()
