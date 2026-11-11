"""BetterTouchTool remapper: builds a preset with the Ctrl+Tab triggers and imports it.

Installs BetterTouchTool with Homebrew if it's missing, writes the preset, then opens it
with BetterTouchTool, which asks to import it. Every UUID is derived from the bundle IDs,
so re-importing hands BetterTouchTool the same preset rather than a brand-new one.
"""
import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from apps import ensure_app_installed

PRESET_NAME = "MRU Tab Switcher"
APP_PATH = Path("/Applications/BetterTouchTool.app")
PRESET_PATH = Path(tempfile.gettempdir()) / "mru-tab-switcher.bttpreset"
UUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://github.com/AllanWang104/mru-tab-switcher")

CTRL, SHIFT = 262144, 131072
TAB = 48
SEND_KEYBOARD_SHORTCUT = -1
# BTTShortcutToSend lists macOS key codes: 59 = left Control, 56 = left Shift, 12 = Q.
REMAPS = [
    (CTRL, "59,12"),             # Ctrl+Tab       -> Ctrl+Q
    (CTRL | SHIFT, "59,56,12"),  # Ctrl+Shift+Tab -> Ctrl+Shift+Q
]


def stable_uuid(*parts):
    return str(uuid.uuid5(UUID_NAMESPACE, "/".join(parts))).upper()


def build_trigger(bundle_id, modifiers, send, order):
    trigger_id = stable_uuid(bundle_id, str(modifiers), "trigger")
    return {
        "BTTTriggerType": 0,
        "BTTTriggerClass": "BTTTriggerTypeKeyboardShortcut",
        "BTTUUID": trigger_id,
        "BTTTriggerOnDown": 1,
        "BTTShortcutKeyCode": TAB,
        "BTTShortcutModifierKeys": modifiers,
        "BTTOrder": order,
        "BTTAutoAdaptToKeyboardLayout": 0,
        "BTTActionsToExecute": [{
            "BTTTriggerParentUUID": trigger_id,
            "BTTIsPureAction": True,
            "BTTUUID": stable_uuid(bundle_id, str(modifiers), "action"),
            "BTTPredefinedActionType": SEND_KEYBOARD_SHORTCUT,
            "BTTShortcutToSend": send,
            "BTTOrder": 0,
        }],
    }


def build_preset(bundle_ids):
    return {
        "BTTPresetName": PRESET_NAME,
        "BTTPresetUUID": stable_uuid("preset"),
        "BTTPresetContent": [{
            "BTTAppBundleIdentifier": bundle_id,
            "BTTAppName": bundle_id,
            "BTTTriggers": [
                build_trigger(bundle_id, modifiers, send, order)
                for order, (modifiers, send) in enumerate(REMAPS)
            ],
        } for bundle_id in bundle_ids],
    }


def write_preset(preset_path, bundle_ids):
    preset_path.write_text(json.dumps(build_preset(bundle_ids), indent=2) + "\n")


def install(bundle_ids):
    ensure_app_installed(APP_PATH, "bettertouchtool", "BetterTouchTool", "https://folivora.ai")
    write_preset(PRESET_PATH, bundle_ids)
    subprocess.run(["open", "-a", "BetterTouchTool", str(PRESET_PATH)], check=True)
    print("Confirm the import in BetterTouchTool to turn the remap on.")
