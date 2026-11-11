import json
import tempfile
import unittest
from pathlib import Path

from install import RULE_DESCRIPTION, build_rule, install_rule, merge_rule


def profile(name, selected, rules):
    return {"name": name, "selected": selected, "complex_modifications": {"rules": rules}}


class BuildRuleTest(unittest.TestCase):
    def test_shift_variant_comes_first_so_plain_ctrl_tab_does_not_swallow_it(self):
        manipulators = build_rule(["com.google.Chrome"])["manipulators"]

        self.assertEqual(["control", "shift"], manipulators[0]["from"]["modifiers"]["mandatory"])
        self.assertEqual(["left_control", "left_shift"], manipulators[0]["to"][0]["modifiers"])
        self.assertEqual(["control"], manipulators[1]["from"]["modifiers"]["mandatory"])
        self.assertEqual(["left_control"], manipulators[1]["to"][0]["modifiers"])

    def test_scopes_every_manipulator_to_the_escaped_bundle_ids(self):
        rule = build_rule(["com.google.Chrome", "com.brave.Browser"])

        for manipulator in rule["manipulators"]:
            self.assertEqual(
                [r"^com\.google\.Chrome$", r"^com\.brave\.Browser$"],
                manipulator["conditions"][0]["bundle_identifiers"],
            )


class MergeRuleTest(unittest.TestCase):
    def test_adds_rule_to_selected_profile_only(self):
        config = {"profiles": [profile("Work", False, []), profile("Home", True, [])]}

        merged = merge_rule(config, build_rule(["com.google.Chrome"]))

        self.assertEqual([], merged["profiles"][0]["complex_modifications"]["rules"])
        self.assertEqual(
            [RULE_DESCRIPTION],
            [r["description"] for r in merged["profiles"][1]["complex_modifications"]["rules"]],
        )

    def test_rerunning_replaces_previous_rule_and_keeps_others(self):
        other = {"description": "Caps Lock -> Escape", "manipulators": []}
        config = {"profiles": [profile("Default", True, [other])]}

        once = merge_rule(config, build_rule(["com.google.Chrome"]))
        twice = merge_rule(once, build_rule(["com.brave.Browser"]))

        rules = twice["profiles"][0]["complex_modifications"]["rules"]
        self.assertEqual(["Caps Lock -> Escape", RULE_DESCRIPTION], [r["description"] for r in rules])
        self.assertEqual(
            [r"^com\.brave\.Browser$"],
            rules[1]["manipulators"][0]["conditions"][0]["bundle_identifiers"],
        )

    def test_profile_without_complex_modifications_gets_one(self):
        config = {"profiles": [{"name": "Default", "selected": True}]}

        merged = merge_rule(config, build_rule(["com.google.Chrome"]))

        self.assertEqual(1, len(merged["profiles"][0]["complex_modifications"]["rules"]))

    def test_creates_a_profile_when_config_is_empty(self):
        merged = merge_rule({}, build_rule(["com.google.Chrome"]))

        self.assertTrue(merged["profiles"][0]["selected"])
        self.assertEqual(1, len(merged["profiles"][0]["complex_modifications"]["rules"]))


class InstallRuleTest(unittest.TestCase):
    def test_writes_a_new_config_file_when_none_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "karabiner" / "karabiner.json"

            install_rule(config_path, ["com.google.Chrome"])

            written = json.loads(config_path.read_text())
            self.assertEqual(
                RULE_DESCRIPTION,
                written["profiles"][0]["complex_modifications"]["rules"][0]["description"],
            )

    def test_rejects_a_config_that_is_not_valid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "karabiner.json"
            config_path.write_text("{ not json")

            with self.assertRaisesRegex(SystemExit, "karabiner.json"):
                install_rule(config_path, ["com.google.Chrome"])

            self.assertEqual("{ not json", config_path.read_text())


if __name__ == "__main__":
    unittest.main()
