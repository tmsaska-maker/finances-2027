import importlib.util
from pathlib import Path
import unittest

FILE = Path(__file__).with_name("fix-finance-caddy-basic-scope.py")
spec = importlib.util.spec_from_file_location("fix_finance_caddy", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def example(auth_line="    basic_auth bcrypt restricted {", route=True):
    proxy = """    handle /finance-api/* {
        reverse_proxy 127.0.0.1:8092
    }
""" if route else ""
    return """screening40.com.ua {
    respond 200
}
finances.screening40.com.ua {
    root * /opt/finances-2027/site
""" + auth_line + """
        owner $2a$dummy-unchanged
    }
""" + proxy + """    file_server
}
another.example.com {
    respond "untouched"
}
"""


class FinanceCaddyTests(unittest.TestCase):
    def test_isolates_finance_host_and_keeps_password_hash(self):
        source = example()
        result = module.scoped_config(source)
        self.assertEqual(result.split("finances.screening40.com.ua {")[0],
                         source.split("finances.screening40.com.ua {")[0])
        self.assertTrue(result.endswith(source.split("another.example.com {")[1].join(["another.example.com {", ""])))
        self.assertIn("owner $2a$dummy-unchanged", result)
        self.assertIn("@finance_ui_basic_only {", result)
        self.assertIn("not path /finance-api/*", result)
        self.assertIn("basic_auth @finance_ui_basic_only bcrypt restricted {", result)
        self.assertEqual(result.count("reverse_proxy 127.0.0.1:8092"), 1)
        self.assertEqual(result.count("screening40.com.ua {"), 2)

    def test_rejects_missing_api_reverse_proxy(self):
        with self.assertRaisesRegex(ValueError, "reverse proxy"):
            module.scoped_config(example(route=False))

    def test_rejects_preexisting_matcher(self):
        with self.assertRaisesRegex(ValueError, "already exists"):
            module.scoped_config(module.scoped_config(example()))

    def test_rejects_already_scoped_basic(self):
        with self.assertRaisesRegex(ValueError, "has a matcher"):
            module.scoped_config(example("    basic_auth @old bcrypt restricted {"))

    def test_rejects_imported_or_nested_basic(self):
        content = example().replace("    basic_auth bcrypt restricted {", "    route {\n        basic_auth bcrypt restricted {").replace("        owner $2a$dummy-unchanged\n    }", "        owner $2a$dummy-unchanged\n        }\n    }")
        with self.assertRaisesRegex(ValueError, "direct Basic"):
            module.scoped_config(content)

    def test_rejects_multiple_finance_blocks(self):
        with self.assertRaisesRegex(ValueError, "exactly one"):
            module.scoped_config(example() + "finances.screening40.com.ua {\n}\n")


if __name__ == "__main__":
    unittest.main()
