#!/usr/bin/env python3
"""Set up the Ctrl+Tab remap that drives the MRU Tab Switcher.

Chromium extensions can't bind Tab, so a key remapper turns Ctrl+Tab / Ctrl+Shift+Tab into
the extension's Ctrl+Q / Ctrl+Shift+Q commands, only while one of the given browsers is the
front app. Asks whether to use Karabiner-Elements or BetterTouchTool unless --with says.

    python3 remap/install.py                                     # asks, then Google Chrome
    python3 remap/install.py $(osascript -e 'id of app "Google Chrome"')
    python3 remap/install.py --with btt com.google.Chrome        # no question asked
"""
import argparse
import sys
from typing import Callable, NamedTuple

import btt
import karabiner


class Remapper(NamedTuple):
    key: str
    label: str
    install: Callable[[list], None]


DEFAULT_BUNDLE_IDS = ["com.google.Chrome"]
REMAPPERS = [
    Remapper("karabiner", "Karabiner-Elements (free)", karabiner.install),
    Remapper("btt", "BetterTouchTool (paid)", btt.install),
]


def parse_args(argv, remappers=REMAPPERS):
    parser = argparse.ArgumentParser(description="Remap Ctrl+Tab to the MRU Tab Switcher.")
    parser.add_argument("--with", dest="remapper", choices=[r.key for r in remappers],
                        help="key remapper to set up; asks when omitted")
    parser.add_argument("bundle_ids", nargs="*", default=DEFAULT_BUNDLE_IDS,
                        help="browser bundle IDs (default: com.google.Chrome)")
    return parser.parse_args(argv)


def choose_remapper(remappers, read_input):
    print("Which key remapper should turn Ctrl+Tab into Ctrl+Q?")
    for number, remapper in enumerate(remappers, start=1):
        print(f"  {number}) {remapper.label}")
    while True:
        try:
            answer = read_input("Choose [1]: ").strip() or "1"
        except EOFError:
            sys.exit("\nNo answer given. Pass --with "
                     f"{'/'.join(r.key for r in remappers)} to skip the question.")
        if answer.isdigit() and 1 <= int(answer) <= len(remappers):
            return remappers[int(answer) - 1]
        print(f"Enter a number from 1 to {len(remappers)}.")


def run(argv, remappers=REMAPPERS, read_input=input):
    args = parse_args(argv, remappers)
    remapper = (next(r for r in remappers if r.key == args.remapper) if args.remapper
                else choose_remapper(remappers, read_input))
    remapper.install(args.bundle_ids)
    print(f"Ctrl+Tab -> Ctrl+Q ({remapper.key}) is on for: {', '.join(args.bundle_ids)}")


if __name__ == "__main__":
    run(sys.argv[1:])
