#!/usr/bin/env python3
"""Generate a BetterTouchTool preset that remaps Ctrl+Tab for one browser.

Chromium extensions can't bind Tab, so BTT turns Ctrl+Tab / Ctrl+Shift+Tab into
the extension's Ctrl+Q / Ctrl+Shift+Q commands, scoped to a single app.

    python3 btt/make-preset.py com.google.Chrome > btt/tab-switcher.bttpreset
"""
import json
import sys
import uuid

CTRL, SHIFT = 262144, 131072
TAB = 48
SEND_KEYBOARD_SHORTCUT = -1


def trigger(modifiers, send, order):
    trigger_id = str(uuid.uuid4()).upper()
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
            "BTTUUID": str(uuid.uuid4()).upper(),
            "BTTPredefinedActionType": SEND_KEYBOARD_SHORTCUT,
            "BTTShortcutToSend": send,
            "BTTOrder": 0,
        }],
    }


def main():
    if len(sys.argv) != 2:
        sys.exit(f"usage: {sys.argv[0]} <browser-bundle-id>")
    bundle_id = sys.argv[1]
    preset = {
        "BTTPresetName": "MRU Tab Switcher",
        "BTTPresetUUID": str(uuid.uuid4()).upper(),
        "BTTPresetContent": [{
            "BTTAppBundleIdentifier": bundle_id,
            "BTTAppName": bundle_id,
            "BTTTriggers": [
                trigger(CTRL, "59,12", 0),             # Ctrl+Tab       -> Ctrl+Q
                trigger(CTRL | SHIFT, "59,56,12", 1),  # Ctrl+Shift+Tab -> Ctrl+Shift+Q
            ],
        }],
    }
    json.dump(preset, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
