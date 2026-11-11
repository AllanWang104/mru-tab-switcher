import io
import unittest
from contextlib import redirect_stdout

from install import DEFAULT_BUNDLE_IDS, Remapper, choose_remapper, parse_args, run


def scripted_input(*answers):
    remaining = list(answers)
    return lambda prompt: remaining.pop(0)


def recording_remappers(calls):
    return [
        Remapper("karabiner", "Karabiner-Elements", lambda ids: calls.append(("karabiner", ids))),
        Remapper("btt", "BetterTouchTool", lambda ids: calls.append(("btt", ids))),
    ]


class ParseArgsTest(unittest.TestCase):
    def test_leaves_remapper_unset_and_defaults_to_chrome(self):
        args = parse_args([])

        self.assertIsNone(args.remapper)
        self.assertEqual(DEFAULT_BUNDLE_IDS, args.bundle_ids)

    def test_picks_btt_and_bundle_ids(self):
        args = parse_args(["--with", "btt", "com.google.Chrome", "com.talon-sec.Work"])

        self.assertEqual("btt", args.remapper)
        self.assertEqual(["com.google.Chrome", "com.talon-sec.Work"], args.bundle_ids)

    def test_rejects_an_unknown_remapper(self):
        with self.assertRaises(SystemExit), redirect_stdout(io.StringIO()):
            parse_args(["--with", "keyboard-maestro"])


class ChooseRemapperTest(unittest.TestCase):
    def setUp(self):
        self.remappers = recording_remappers([])

    def choose(self, *answers):
        with redirect_stdout(io.StringIO()) as output:
            chosen = choose_remapper(self.remappers, scripted_input(*answers))
        return chosen, output.getvalue()

    def test_lists_every_remapper_by_number(self):
        _, output = self.choose("1")

        self.assertIn("1) Karabiner-Elements", output)
        self.assertIn("2) BetterTouchTool", output)

    def test_picks_the_numbered_remapper(self):
        chosen, _ = self.choose("2")

        self.assertEqual("btt", chosen.key)

    def test_enter_picks_the_first_remapper(self):
        chosen, _ = self.choose("")

        self.assertEqual("karabiner", chosen.key)

    def test_asks_again_after_an_invalid_answer(self):
        chosen, output = self.choose("3", "x", "2")

        self.assertEqual("btt", chosen.key)
        self.assertEqual(2, output.count("Enter a number from 1 to 2."))

    def test_exits_when_input_ends(self):
        def closed_input(prompt):
            raise EOFError

        with self.assertRaisesRegex(SystemExit, "--with"), redirect_stdout(io.StringIO()):
            choose_remapper(self.remappers, closed_input)


class RunTest(unittest.TestCase):
    def test_with_flag_skips_the_prompt(self):
        calls = []

        def unexpected_input(prompt):
            raise AssertionError("should not prompt")

        with redirect_stdout(io.StringIO()):
            run(["--with", "btt", "com.brave.Browser"], recording_remappers(calls), unexpected_input)

        self.assertEqual([("btt", ["com.brave.Browser"])], calls)

    def test_without_flag_installs_the_chosen_remapper_only(self):
        calls = []

        with redirect_stdout(io.StringIO()):
            run(["com.talon-sec.Work"], recording_remappers(calls), scripted_input("2"))

        self.assertEqual([("btt", ["com.talon-sec.Work"])], calls)


if __name__ == "__main__":
    unittest.main()
