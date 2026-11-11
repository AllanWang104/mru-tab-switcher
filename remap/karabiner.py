"""Karabiner-Elements remapper: writes the Ctrl+Tab rule into karabiner.json.

Installs Karabiner-Elements with Homebrew if it's missing, then writes the rule straight
into the active profile, which Karabiner reloads on its own. Re-running replaces the rule
instead of adding a second copy.
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from apps import ensure_app_installed

RULE_DESCRIPTION = "MRU Tab Switcher: Ctrl+Tab -> Ctrl+Q, Ctrl+Shift+Tab -> Ctrl+Shift+Q"
CONFIG_PATH = Path.home() / ".config" / "karabiner" / "karabiner.json"
APP_PATH = Path("/Applications/Karabiner-Elements.app")


def build_rule(bundle_ids):
    conditions = [{
        "type": "frontmost_application_if",
        "bundle_identifiers": [f"^{re.escape(bundle_id)}$" for bundle_id in bundle_ids],
    }]

    def remap(from_modifiers, to_modifiers):
        return {
            "type": "basic",
            "from": {"key_code": "tab", "modifiers": {"mandatory": from_modifiers}},
            "to": [{"key_code": "q", "modifiers": to_modifiers}],
            "conditions": conditions,
        }

    # Karabiner uses the first manipulator that matches, so the Shift variant goes first.
    return {
        "description": RULE_DESCRIPTION,
        "manipulators": [
            remap(["control", "shift"], ["left_control", "left_shift"]),
            remap(["control"], ["left_control"]),
        ],
    }


def merge_rule(config, rule):
    merged = json.loads(json.dumps(config))
    profiles = merged.setdefault("profiles", [])
    if not profiles:
        profiles.append({"name": "Default profile", "selected": True})
    target = next((p for p in profiles if p.get("selected")), profiles[0])
    rules = target.setdefault("complex_modifications", {}).setdefault("rules", [])
    rules[:] = [r for r in rules if r.get("description") != RULE_DESCRIPTION]
    rules.append(rule)
    return merged


def read_config(config_path):
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text())
    except json.JSONDecodeError as error:
        sys.exit(f"{config_path} is not valid JSON ({error}); fix or remove it, then re-run.")


def write_config(config_path, config):
    config_path.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file and swap it in, so Karabiner never reloads a half-written file.
    fd, temp_path = tempfile.mkstemp(dir=config_path.parent, suffix=".json")
    with os.fdopen(fd, "w") as temp_file:
        json.dump(config, temp_file, indent=4)
        temp_file.write("\n")
    os.replace(temp_path, config_path)


def install_rule(config_path, bundle_ids):
    write_config(config_path, merge_rule(read_config(config_path), build_rule(bundle_ids)))


def install(bundle_ids):
    ensure_app_installed(APP_PATH, "karabiner-elements", "Karabiner-Elements",
                         "https://karabiner-elements.pqrs.org")
    install_rule(CONFIG_PATH, bundle_ids)
