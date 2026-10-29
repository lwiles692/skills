#!/usr/bin/env python3
"""Offline integration checks for the evaluation runner."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

RUNNER = Path(__file__).with_name("run_eval.py")

# A fake CLI reports only the information needed to check the public interface.
FAKE = '''#!/usr/bin/env python3
import json, os, pathlib, sys, time
if "--version" in sys.argv:
    print("fake-cli 1.2.3")
    sys.exit(0)
time.sleep(float(os.environ.get("FAKE_SLEEP", "0")))
p = pathlib.Path.cwd()
engine = "codex" if "exec" in sys.argv else "claude"
skill = p / (".agents" if engine == "codex" else ".claude") / "skills" / "google-dev-standards" / "SKILL.md"
print(json.dumps({"args": sys.argv[1:], "prompt": sys.stdin.buffer.read().decode("utf-8"),
                  "cwd": str(p), "home": os.environ["HOME"], "skill_present": skill.is_file(),
                  "fixture": (p / "src" / "example.cc").read_text() if (p / "src" / "example.cc").is_file() else None,
                  "secret_forwarded": "UNRELATED_SECRET" in os.environ}), flush=True)
print("fake stderr", file=sys.stderr, flush=True)
sys.exit(int(os.environ.get("FAKE_EXIT", "0")))
'''


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.stub = self.root / "fake-cli"
        self.stub.write_text(FAKE, encoding="utf-8")
        self.stub.chmod(0o700)
        self.trigger = self.root / "trigger-cases.json"
        self.quality = self.root / "quality-cases.json"
        self.trigger_prompt = "trigger 中文\nunchanged\n"
        self.quality_prompt = "quality 中文\nunchanged\n"
        self.trigger.write_text(json.dumps({"cases": [{"id": "trigger", "prompt": self.trigger_prompt,
                                                       "should_trigger": False, "expected": "private trigger criterion",
                                                       "files": {"src/example.cc": "fixture 中文\n"}}]}), encoding="utf-8")
        self.quality.write_text(json.dumps([{"id": "quality", "task_prompt": self.quality_prompt,
                                             "criteria": [{"check": "private quality criterion"}]}]), encoding="utf-8")
        self.output = self.root / "results"

    def run_runner(self, *args):
        env = os.environ.copy()
        env["UNRELATED_SECRET"] = "must-not-reach-model"
        return subprocess.run([sys.executable, str(RUNNER), "--cases", str(self.trigger),
                               "--cases", str(self.quality), "--codex-bin", str(self.stub),
                               "--claude-bin", str(self.stub), "--output", str(self.output), *args],
                              text=True, capture_output=True, env=env, timeout=30)

    def test_dry_run_launches_nothing_and_creates_no_output(self):
        result = self.run_runner()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("8 invocations", result.stdout)
        self.assertFalse(self.output.exists())

    def test_paired_traces_preserve_prompts_and_isolate_projects(self):
        result = self.run_runner("--run")
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.output / "manifest.json").read_text())
        self.assertEqual(manifest["sources"][0]["sha256"], hashlib.sha256(self.trigger.read_bytes()).hexdigest())
        self.assertEqual(manifest["versions"]["codex"]["version"], "fake-cli 1.2.3")
        self.assertEqual(len(manifest["skill_snapshot"]["sha256"]), 64)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o700)
        runs = sorted(self.output.glob("[0-9]*"))
        self.assertEqual(len(runs), 8)
        workspaces = set()
        for folder in runs:
            case = json.loads((folder / "case.json").read_text())
            record = json.loads((folder / "run.json").read_text())
            trace = json.loads((folder / "stdout.jsonl").read_text())
            engine = "codex" if "-codex-" in folder.name else "claude"
            skill = folder.name.endswith("-skill")
            prompt = self.trigger_prompt if case["id"] == "trigger" else self.quality_prompt
            expected = prompt
            if skill and case["id"] == "quality":
                expected = ("$" if engine == "codex" else "/") + "google-dev-standards\n\n" + prompt
            self.assertEqual((folder / "prompt.txt").read_bytes(), prompt.encode())
            self.assertEqual((folder / "submitted-prompt.txt").read_bytes(), expected.encode())
            self.assertEqual(trace["prompt"], expected)
            self.assertNotIn("private", trace["prompt"])
            self.assertEqual(trace["skill_present"], skill)
            self.assertEqual(trace["fixture"], "fixture 中文\n" if case["id"] == "trigger" else None)
            self.assertEqual(json.loads((folder / "project.json").read_text())["fixtures_provided"], case["id"] == "trigger")
            self.assertFalse(trace["secret_forwarded"])
            self.assertEqual(record["grading"], "not_assessed")
            self.assertEqual(record["status"], "exit_zero_unverified")
            self.assertEqual((folder / "stderr.txt").read_text(), "fake stderr\n")
            self.assertFalse(Path(trace["cwd"]).exists())
            self.assertFalse(Path(trace["home"]).exists())
            workspaces.add(trace["cwd"])
            if engine == "codex":
                for flag in ("--ephemeral", "--sandbox", "--json", "--skip-git-repo-check"):
                    self.assertIn(flag, trace["args"])
                self.assertIn("read-only", trace["args"])
            else:
                for flag in ("--no-session-persistence", "--output-format", "--verbose", "--permission-mode", "--tools"):
                    self.assertIn(flag, trace["args"])
                self.assertIn("dontAsk", trace["args"])
        self.assertEqual(len(workspaces), 8)
        self.assertEqual(json.loads((self.output / "summary.json").read_text())["grading"], "not_assessed")
        again = self.run_runner("--run")
        self.assertEqual(again.returncode, 2)
        self.assertEqual(len(list(self.output.glob("[0-9]*"))), 8)

    def test_unsafe_fixture_paths_are_rejected_before_creating_output(self):
        for path in ("../outside", "/absolute", ".claude/settings.json", "C:/outside", "src/../outside"):
            with self.subTest(path=path):
                self.trigger.write_text(json.dumps([{"id": "trigger", "prompt": "test", "files": {path: "x"}}]))
                result = self.run_runner("--run")
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertFalse(self.output.exists())

    def test_missing_executable_is_a_recorded_failure(self):
        result = self.run_runner("--run", "--case", "trigger", "--engine", "codex", "--condition", "baseline",
                                 "--codex-bin", str(self.root / "missing"))
        self.assertEqual(result.returncode, 1, result.stderr)
        folder = next(self.output.glob("[0-9]*"))
        record = json.loads((folder / "run.json").read_text())
        self.assertEqual(record["status"], "launch_error")
        self.assertEqual(record["grading"], "not_assessed")
        self.assertEqual(json.loads((self.output / "summary.json").read_text())["nonzero_timeout_or_launch_errors"], 1)

    def test_timeout_is_a_recorded_failure(self):
        os.environ["FAKE_SLEEP"] = "2"
        self.addCleanup(os.environ.pop, "FAKE_SLEEP", None)
        result = self.run_runner("--run", "--case", "trigger", "--engine", "claude", "--condition", "skill",
                                 "--timeout", "0.1", "--env", "FAKE_SLEEP")
        self.assertEqual(result.returncode, 1, result.stderr)
        record = json.loads((next(self.output.glob("[0-9]*")) / "run.json").read_text())
        self.assertEqual(record["status"], "timeout")
        self.assertEqual(record["grading"], "not_assessed")

    def test_nonzero_exit_preserves_stderr(self):
        os.environ["FAKE_EXIT"] = "9"
        self.addCleanup(os.environ.pop, "FAKE_EXIT", None)
        result = self.run_runner("--run", "--case", "trigger", "--engine", "codex", "--condition", "skill",
                                 "--env", "FAKE_EXIT")
        self.assertEqual(result.returncode, 1, result.stderr)
        folder = next(self.output.glob("[0-9]*"))
        record = json.loads((folder / "run.json").read_text())
        self.assertEqual((record["status"], record["exit_code"]), ("exit_nonzero", 9))
        self.assertEqual((folder / "stderr.txt").read_text(), "fake stderr\n")


if __name__ == "__main__":
    unittest.main()
