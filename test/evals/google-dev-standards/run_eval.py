#!/usr/bin/env python3
"""Collect ungraded Codex and Claude traces in disposable projects."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import signal
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SKILL = REPO / "skills" / "engineering" / "google-dev-standards"
NAME = "google-dev-standards"


def timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    path.chmod(0o600)


def fixture_files(entry):
    files = entry.get("files", {})
    if not isinstance(files, dict):
        raise ValueError(f"case {entry.get('id')!r}: files must map relative paths to UTF-8 strings")
    checked = []
    for name, content in files.items():
        if not isinstance(name, str) or not isinstance(content, str) or not name or "\\" in name or "\x00" in name:
            raise ValueError(f"case {entry.get('id')!r}: invalid fixture path or content")
        posix, windows = PurePosixPath(name), PureWindowsPath(name)
        if (posix.is_absolute() or windows.is_absolute() or windows.drive or
                any(part in ("", ".", "..") for part in name.split("/")) or
                any(part.startswith(".") for part in posix.parts)):
            raise ValueError(f"case {entry.get('id')!r}: unsafe fixture path: {name!r}")
        checked.append((posix, content))
    return checked


def load_cases(paths):
    cases, sources, seen = [], [], set()
    for path in paths:
        data = path.read_bytes()
        document = json.loads(data.decode("utf-8"))
        entries = document.get("cases") if isinstance(document, dict) else document
        if not isinstance(entries, list):
            raise ValueError(f"{path}: expected a JSON array or an object containing a cases array")
        sources.append({"path": str(path.resolve()), "sha256": digest(data)})
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError(f"{path}: every case must be an object")
            case_id = entry.get("id")
            prompt = entry.get("prompt", entry.get("task_prompt"))
            if not isinstance(case_id, str) or not case_id or case_id in seen:
                raise ValueError(f"{path}: case id must be a unique nonempty string: {case_id!r}")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError(f"{path}: case {case_id!r} needs a nonempty prompt or task_prompt")
            seen.add(case_id)
            files = fixture_files(entry)
            # Trigger cases are submitted unchanged in both conditions. Quality
            # cases get a separate explicit invocation prefix in the skill arm.
            trigger = "should_trigger" in entry or "trigger" in path.name.lower() or entry.get("type") == "trigger"
            cases.append({"case": entry, "prompt": prompt, "suite": "trigger" if trigger else "quality", "files": files})
    return cases, sources


def snapshot_skill(destination):
    if not (SKILL / "SKILL.md").is_file():
        raise ValueError(f"skill not found: {SKILL}")
    for path in SKILL.rglob("*"):
        if path.is_symlink() or (not path.is_file() and not path.is_dir()):
            raise ValueError(f"skill snapshot cannot contain links or special files: {path}")
    shutil.copytree(SKILL, destination)
    files = []
    for path in sorted(destination.rglob("*")):
        if path.is_file():
            data = path.read_bytes()
            files.append({"path": path.relative_to(destination).as_posix(), "bytes": len(data), "sha256": digest(data)})
    encoded = json.dumps(files, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return {"sha256": digest(encoded), "algorithm": "sha256 of compact UTF-8 JSON file manifest", "files": files}


def child_environment(root, extra_names):
    # Do not serialize the environment or user settings. Keep the usual auth,
    # provider, proxy, and runtime variables; the caller can add other names.
    exact = {"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "LANG", "LC_ALL",
             "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy",
             "all_proxy", "no_proxy", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"}
    prefixes = ("OPENAI_", "ANTHROPIC_", "AZURE_", "AWS_", "GOOGLE_", "CLOUDSDK_", "VERTEX_")
    env = {key: value for key, value in os.environ.items()
           if key in exact or key.startswith(prefixes) or key in extra_names}
    home = root / "home"
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    (home / ".codex").mkdir(exist_ok=True, mode=0o700)
    (home / ".claude").mkdir(exist_ok=True, mode=0o700)
    (root / "tmp").mkdir(exist_ok=True, mode=0o700)
    env.update({"HOME": str(home), "USERPROFILE": str(home), "CODEX_HOME": str(home / ".codex"),
                "CLAUDE_CONFIG_DIR": str(home / ".claude"), "XDG_CONFIG_HOME": str(home / ".config"),
                "XDG_CACHE_HOME": str(home / ".cache"), "XDG_DATA_HOME": str(home / ".local/share"),
                "TMPDIR": str(root / "tmp"), "TMP": str(root / "tmp"), "TEMP": str(root / "tmp")})
    return env


def command_for(engine, executable, model):
    if engine == "codex":
        command = [executable, "--ask-for-approval", "never", "exec", "--ephemeral", "--sandbox", "read-only", "--json",
                   "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules",
                   "-c", 'shell_environment_policy.inherit="none"']
        if model:
            command += ["--model", model]
        return command + ["-"]
    command = [executable, "--print", "--no-session-persistence", "--output-format", "stream-json",
               "--verbose", "--permission-mode", "dontAsk", "--restricted", "--strict-mcp-config",
               "--setting-sources", "project", "--tools", "Read,Glob,Grep,Skill"]
    if model:
        command += ["--model", model]
    return command


def kill_process(proc):
    try:
        if os.name == "posix":
            os.killpg(proc.pid, signal.SIGKILL)
        else:
            proc.kill()
    except ProcessLookupError:
        pass


def collect(command, prompt, cwd, env, output, timeout):
    started = time.monotonic()
    record = {"started_at": timestamp(), "command": command, "timeout_seconds": timeout,
              "status": "starting", "exit_code": None, "grading": "not_assessed"}
    save_json(output / "run.json", record)
    proc = None
    try:
        with (output / "stdout.jsonl").open("xb") as stdout, (output / "stderr.txt").open("xb") as stderr:
            (output / "stdout.jsonl").chmod(0o600)
            (output / "stderr.txt").chmod(0o600)
            try:
                proc = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=stdout,
                                        stderr=stderr, start_new_session=(os.name == "posix"))
                try:
                    proc.communicate(input=prompt.encode("utf-8"), timeout=timeout)
                    record["exit_code"] = proc.returncode
                    record["status"] = "exit_zero_unverified" if proc.returncode == 0 else "exit_nonzero"
                except subprocess.TimeoutExpired:
                    kill_process(proc)
                    proc.communicate()
                    record.update(status="timeout", exit_code=proc.returncode)
                except KeyboardInterrupt:
                    kill_process(proc)
                    proc.communicate()
                    record.update(status="interrupted", exit_code=proc.returncode)
                    raise
            except OSError as error:
                record.update(status="launch_error", error=f"{type(error).__name__}: {error}")
    finally:
        record.update(finished_at=timestamp(), duration_seconds=round(time.monotonic() - started, 3))
        save_json(output / "run.json", record)
    return record


def versions(executables, env, cwd):
    result = {}
    for engine, executable in executables.items():
        if executable is None:
            result[engine] = {"status": "unavailable"}
            continue
        try:
            version = subprocess.run([executable, "--version"], cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10, check=False)
            result[engine] = {"status": "ok" if version.returncode == 0 else "error",
                              "exit_code": version.returncode,
                              "version": version.stdout.decode("utf-8", errors="replace").strip()[:1000]}
        except (OSError, subprocess.TimeoutExpired) as error:
            result[engine] = {"status": "error", "error": type(error).__name__}
    return result


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Dry-run is the default; --run may contact paid remote services. Temporary homes do not include OAuth logins, user config or configured gateways; use environment credentials and provider settings. No automatic scoring is performed.")
    parser.add_argument("--run", action="store_true", help="actually launch model CLIs; otherwise only validate and show the plan")
    parser.add_argument("--cases", type=Path, action="append", help="case JSON path; repeat to combine files")
    parser.add_argument("--case", action="append", help="run only this case id; repeat to select multiple")
    parser.add_argument("--engine", choices=("both", "codex", "claude"), default="both")
    parser.add_argument("--condition", choices=("both", "skill", "baseline"), default="both")
    parser.add_argument("--output", type=Path, help="new output directory; parent must already exist")
    parser.add_argument("--timeout", type=float, default=180, help="seconds per CLI invocation (default: 180)")
    parser.add_argument("--codex-bin", default="codex", help="Codex executable (default: codex on PATH)")
    parser.add_argument("--claude-bin", default="claude", help="Claude executable (default: claude on PATH)")
    parser.add_argument("--codex-model", help="optional Codex model name")
    parser.add_argument("--claude-model", help="optional Claude model name")
    parser.add_argument("--env", action="append", default=[], metavar="NAME", help="pass another environment variable by name, without recording its value")
    args = parser.parse_args()
    if not 0 < args.timeout <= 86400:
        parser.error("--timeout must be greater than zero and at most 86400 seconds")
    return args


def main():
    args = parse_args()
    paths = args.cases or [p for p in (HERE / "trigger-cases.json", HERE / "quality-cases.json", HERE / "behavior-cases.json") if p.exists()]
    if not paths:
        raise ValueError("no case files found; provide --cases")
    cases, sources = load_cases(paths)
    if args.case:
        selected = set(args.case)
        missing = selected - {case["case"]["id"] for case in cases}
        if missing:
            raise ValueError(f"unknown case ids: {', '.join(sorted(missing))}")
        cases = [case for case in cases if case["case"]["id"] in selected]
    if not cases:
        raise ValueError("no cases selected")
    engines = ["codex", "claude"] if args.engine == "both" else [args.engine]
    conditions = ["skill", "baseline"] if args.condition == "both" else [args.condition]
    print(f"Selected {len(cases)} cases, {len(engines)} engines, {len(conditions)} conditions: {len(cases) * len(engines) * len(conditions)} invocations.", flush=True)
    if not args.run:
        print("Dry run only: no CLI launched, no remote request, and no output directory created.")
        return 0
    if args.output:
        output = args.output.absolute()
        output.mkdir(mode=0o700, parents=False, exist_ok=False)
    else:
        parent = Path(tempfile.gettempdir()).resolve()
        if parent == REPO or REPO in parent.parents:
            raise ValueError("temporary directory is inside the repository; specify a safe --output or TMPDIR")
        output = Path(tempfile.mkdtemp(prefix="google-dev-standards-eval-", dir=parent))
    output.chmod(0o700)
    print(f"Output: {output}", flush=True)
    executables = {engine: shutil.which(args.codex_bin if engine == "codex" else args.claude_bin) for engine in engines}
    models = {"codex": args.codex_model, "claude": args.claude_model}
    problems = 0
    with tempfile.TemporaryDirectory(prefix="google-dev-standards-work-") as temp:
        root = Path(temp)
        snapshot = root / "snapshot"
        skill_manifest = snapshot_skill(snapshot)
        env = child_environment(root / "version", args.env)
        save_json(output / "manifest.json", {"created_at": timestamp(), "sources": sources,
                  "skill_snapshot": skill_manifest, "versions": versions(executables, env, root),
                  "models_requested": {engine: models[engine] for engine in engines},
                  "limitations": ["No automatic grading; exit zero does not establish a successful or valid trace.",
                                  "Baseline omits the project skill and uses a fresh temporary home; global or managed discovery may still occur and absence is not proven.",
                                  "Temporary homes isolate ordinary user configuration and may lose login, gateway, model or provider settings; environment credentials are passed through without being recorded.",
                                  "Raw streams and prompts may contain sensitive data; review them before sharing.",
                                  "Explicit quality runs prepend an invocation to the unchanged task in a single message; inspect traces to verify invocation.",
                                  "Codex sandbox constrains model shell commands but is not an OS-level sandbox for the CLI or inherited configuration."]})
        number = 0
        for case in cases:
            for engine in engines:
                for condition in conditions:
                    number += 1
                    folder = output / f"{number:04d}-{engine}-{condition}"
                    folder.mkdir(mode=0o700)
                    save_json(folder / "case.json", case["case"])
                    save_json(folder / "project.json", {"fixtures_provided": bool(case["files"]),
                              "paths": [str(path) for path, _ in case["files"]],
                              "note": "Empty project; references to external files may be unavailable." if not case["files"] else "Only listed fixtures are provided."})
                    prompt = case["prompt"]
                    submitted = prompt
                    if condition == "skill" and case["suite"] == "quality":
                        submitted = ("$" if engine == "codex" else "/") + NAME + "\n\n" + prompt
                    for name, content in (("prompt.txt", prompt), ("submitted-prompt.txt", submitted)):
                        target = folder / name
                        target.write_bytes(content.encode("utf-8"))
                        target.chmod(0o600)
                    workspace = root / f"run-{number:04d}"
                    project = workspace / "project"
                    project.mkdir(parents=True, mode=0o700)
                    for path, content in case["files"]:
                        target = project.joinpath(*path.parts)
                        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                        target.write_bytes(content.encode("utf-8"))
                        target.chmod(0o600)
                    if condition == "skill":
                        parent = project / (".agents" if engine == "codex" else ".claude") / "skills"
                        parent.mkdir(parents=True, mode=0o700)
                        shutil.copytree(snapshot, parent / NAME)
                    env = child_environment(workspace, args.env)
                    executable = executables[engine]
                    command = command_for(engine, executable or (args.codex_bin if engine == "codex" else args.claude_bin), models[engine])
                    print(f"{number}: {case['case']['id']} {engine} {condition}", flush=True)
                    result = collect(command, submitted, project, env, folder, args.timeout)
                    if result["status"] != "exit_zero_unverified":
                        problems += 1
                    shutil.rmtree(workspace)
        save_json(output / "summary.json", {"invocations": number, "nonzero_timeout_or_launch_errors": problems,
                                           "grading": "not_assessed", "finished_at": timestamp()})
    print(f"Finished: {number} invocations, {problems} nonzero exits, timeouts, or launch errors. Review traces manually.")
    return 1 if problems else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(2)
    except KeyboardInterrupt:
        print("Interrupted; partial output is retained.", file=sys.stderr)
        sys.exit(130)
