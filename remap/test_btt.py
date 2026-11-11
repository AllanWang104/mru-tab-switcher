import json
import tempfile
import unittest
from pathlib import Path

from btt import CTRL, SHIFT, build_preset, write_preset


def triggers_by_modifiers(app):
    return {t["BTTShortcutModifierKeys"]: t for t in app["BTTTriggers"]}


class BuildPresetTest(unittest.TestCase):
    def test_one_app_entry_per_bundle_id(self):
        preset = build_preset(["com.google.Chrome", "com.talon-sec.Work"])

        self.assertEqual(
            ["com.google.Chrome", "com.talon-sec.Work"],
            [app["BTTAppBundleIdentifier"] for app in preset["BTTPresetContent"]],
        )

    def test_ctrl_tab_sends_ctrl_q_and_ctrl_shift_tab_sends_ctrl_shift_q(self):
        app = build_preset(["com.google.Chrome"])["BTTPresetContent"][0]
        triggers = triggers_by_modifiers(app)

        self.assertEqual("59,12", triggers[CTRL]["BTTActionsToExecute"][0]["BTTShortcutToSend"])
        self.assertEqual(
            "59,56,12", triggers[CTRL | SHIFT]["BTTActionsToExecute"][0]["BTTShortcutToSend"]
        )
        for trigger in triggers.values():
            self.assertEqual(48, trigger["BTTShortcutKeyCode"])

    def test_actions_point_at_their_parent_trigger(self):
        app = build_preset(["com.google.Chrome"])["BTTPresetContent"][0]

        for trigger in app["BTTTriggers"]:
            self.assertEqual(
                trigger["BTTUUID"], trigger["BTTActionsToExecute"][0]["BTTTriggerParentUUID"]
            )

    def test_uuids_are_stable_so_reimporting_matches_the_previous_preset(self):
        first = build_preset(["com.google.Chrome"])
        second = build_preset(["com.google.Chrome"])

        self.assertEqual(first, second)

    def test_uuids_are_unique_within_a_preset(self):
        preset = build_preset(["com.google.Chrome", "com.brave.Browser"])
        uuids = [preset["BTTPresetUUID"]]
        for app in preset["BTTPresetContent"]:
            for trigger in app["BTTTriggers"]:
                uuids.append(trigger["BTTUUID"])
                uuids.append(trigger["BTTActionsToExecute"][0]["BTTUUID"])

        self.assertEqual(len(uuids), len(set(uuids)))


class WritePresetTest(unittest.TestCase):
    def test_writes_the_preset_as_json(self):
        with tempfile.TemporaryDirectory() as directory:
            preset_path = Path(directory) / "mru-tab-switcher.bttpreset"

            write_preset(preset_path, ["com.google.Chrome"])

            written = json.loads(preset_path.read_text())
            self.assertEqual("MRU Tab Switcher", written["BTTPresetName"])


if __name__ == "__main__":
    unittest.main()
