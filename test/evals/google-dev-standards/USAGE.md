# Google development standards evaluation

`run_eval.py` collects raw Codex and Claude CLI traces; it does not score them. It uses Python 3.7 or later and the standard library. Nothing is installed. Run it from any directory:

```sh
python3 test/evals/google-dev-standards/run_eval.py --help
python3 test/evals/google-dev-standards/run_eval.py
```

The second command is a dry run: it validates and counts cases without launching a CLI, creating output, or contacting a model. To collect traces, explicitly opt in:

```sh
python3 test/evals/google-dev-standards/run_eval.py --run --case trigger-en-cpp-requested-style --engine codex
python3 test/evals/google-dev-standards/run_eval.py --run --engine both --timeout 180
```

Each invocation can cost money and send the prompt to the configured provider. The defaults run every case on both engines in both conditions. Repeat `--case ID` to select cases, or set `--condition skill` or `--condition baseline`. Set `--codex-model NAME` and `--claude-model NAME` to request models, and use `--codex-bin` or `--claude-bin` to select executables. Missing executables, nonzero exits, and timeouts are recorded and make the runner return a nonzero exit status. Review the actual stream even when a CLI exits zero: a zero exit is not a passing evaluation.

By default, output goes to a new private directory under the system temporary directory, outside this repository. The path is printed. To choose a location, use `--output /existing-parent/new-directory`; the parent must exist and the target must not exist. Files are not overwritten. The output retains the original case, exact original prompt, actual submitted prompt, invocation arguments, timestamps, exit status, duration, raw JSONL stdout and raw stderr. The manifest includes case-file and skill-snapshot hashes, the snapshot's file manifest, requested model names and CLI version output. It does not copy environment variables or configuration into the result. Raw prompts and streams can still contain sensitive information; inspect and protect them before sharing. Delete the output directory when finished.

Default inputs are `trigger-cases.json` and `quality-cases.json`. Use repeated `--cases path.json` to select other files. `executed-trigger-cases.json` contains the nine implicit prompts and project fixtures used in the 2026-10-29 trigger matrix; `2026-10-29-quality-executed.json` contains the prompts and checks used in that date's quality comparison. For example:

```sh
python3 test/evals/google-dev-standards/run_eval.py --cases test/evals/google-dev-standards/executed-trigger-cases.json --case P2-adopted-go --engine codex --condition skill
```

A file may be an array or an object with a `cases` array. Each entry needs a unique string `id` and `prompt` or `task_prompt`; arbitrary `expected`, `should_trigger`, `criteria` and other fields are retained only in the output, not sent to the model. Cases with `should_trigger`, `type: "trigger"`, or a filename containing `trigger` are treated as trigger cases. Other cases are treated as quality cases.

Optionally provide `"files": {"CONTRIBUTING.md": "project convention\n", "src/example.cc": "source text\n"}` to place UTF-8 fixture contents in both projects. Paths must be relative, use forward slashes, and contain no hidden, empty, `.` or `..` components. The runner records the paths and whether fixtures were supplied in each `project.json`. The existing cases without `files` run in empty projects. In particular, a prompt mentioning `CONTRIBUTING.md` does not establish actual repository adoption when that file is absent; missing source, snippets, or project context can make a result inconclusive. Supply matching fixtures in a separate case file if the evaluation requires them.

Every case and condition uses a fresh project and home. In the skill condition, the runner copies a single, hashed snapshot of the skill to the CLI's project skill directory. The baseline omits that copy. Both conditions receive the identical, unmodified trigger prompt, so triggering can be observed without a forced invocation. For quality cases the baseline receives the task unchanged; the skill condition submits `$google-dev-standards` to Codex or `/google-dev-standards` to Claude as a prefix followed by the unchanged task. The original task is saved separately. Confirm in the trace whether the intended skill actually loaded; supplying its name is not proof.

For each trigger case, independently compare observed skill loading with `should_trigger` or the provided expectation, including negative cases. For quality cases, compare each criterion between the skill and baseline outputs. Record subjective scores separately, and mark missing or invalid traces, errors, timeouts, and ambiguous skill-loading evidence as unassessed. The runner never counts failures or exit-zero runs as passing scores.

Temporary homes and config directories prevent the runner from changing ordinary user configuration and exclude ordinary user-installed skills. Existing OAuth logins and gateway or model configuration stored in user files are unavailable in these homes; the runner does not copy them. Supply supported API credentials, gateway settings, and model settings through the environment or CLI options; the runner passes common provider/proxy environment variables without recording their values. For a provider-specific variable outside those families, use `--env VARIABLE_NAME`. Do not put secrets in command-line arguments, cases, or expected outputs. Authentication, globally managed configuration, installed CLI versions, gateways, model behavior, and skill discovery vary between machines. Some CLIs or managed policies may still expose globally installed skills; the baseline does **not** prove the skill was hidden. If authentication or skill isolation cannot be verified from the trace, report the comparison as inconclusive rather than claiming a clean baseline. The runner does not read or modify user auth files to work around this.

Codex uses `--ephemeral`, the read-only sandbox, JSON events, no Git check, no approval prompts, and a clean temporary `CODEX_HOME`. Claude uses nonpersistent stream JSON, `dontAsk`, restricted mode, project settings only, strict MCP configuration, and the Read/Glob/Grep/Skill tools. These restrictions reduce side effects, but the runner is not a complete OS sandbox: CLIs, managed configuration, and provider services can have effects beyond the disposable project. Check the installed CLI's help when versions differ. Temporary projects are deleted after each run; interrupted runs may leave partial output. Without a `files` fixture, prompts that refer to existing repository files run in an empty project.
