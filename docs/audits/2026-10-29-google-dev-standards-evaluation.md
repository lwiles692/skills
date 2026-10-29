# Google development standards skill evaluation

Evaluated on 2026-10-29. These are small-sample observations, not a guarantee of platform compatibility or model behavior.

## Scope and snapshots

The skill covers Google style guides for C++, Go, Python, and Markdown. Its current description restricts automatic use to an explicit request or documented project adoption and says product names such as GoogleTest do not imply adoption. It has 195 Unicode characters. The Claude Help Center documents a 200-character description limit for custom skills; the Anthropic Skills API and OpenAI plugin submission documentation each specify 1,024 characters. Passing local validation does not demonstrate that a particular upload interface will accept the skill.

| Snapshot | `SKILL.md` SHA-256 | Description |
| --- | --- | --- |
| Initial | `7e1ac75b7f90e2eb4f8e3c7cb05f49c7aa376cc648d556442327d1ca40415cb1` | Google style required; no product-name exclusion |
| Current | `238260208debeffa89c2c0d3f8b59c7e17904aa329eaf64ba3e0325e259c7ae3` | Adds GoogleTest/product boundary |
| Alternative | `3e7a57aaaa39187a1d626064435af090ea55aaeae078c43a81e7daeccc2635cb` | Tested experimentally, not adopted |

The initial and current snapshots differ only in the two frontmatter description lines; the skill body, references, and metadata were byte-identical. The original `agents/openai.yaml` listed product names outside the documented plugin-submission values; the policy was removed, leaving default implicit invocation enabled.

## Automatic invocation

Each test ran in a fresh temporary workspace, with a real skill copy and a prompt that did not name the skill. P2 included a real `CONTRIBUTING.md` explicitly adopting Google Go style. A trigger required a successful read of the copied skill or a successful `Skill` invocation; a no-trigger required a completed run, skill-discovery evidence, and no such read or invocation. Explicit controls loaded the Python reference. Codex discovery was separately confirmed with `codex debug prompt-input`; the Claude Code initialization listed the skill but did not disclose the exact model-facing description.

| Case | Expected | Initial Codex | Initial gateway | Current Codex | Current gateway |
| --- | --- | --- | --- | --- | --- |
| Google Python style review | Trigger | Trigger | Trigger | Trigger | **Miss** |
| Repo adopts Google Go style | Trigger | Trigger | **Miss** | Trigger | **Miss** |
| Google Cloud Python client | No trigger | No trigger | No trigger | No trigger | No trigger |
| Firebase README | No trigger | No trigger | No trigger | No trigger | No trigger |
| GoogleTest fixture | No trigger | **False positive** | No trigger | No trigger | No trigger |
| PEP 8 review | No trigger | No trigger | No trigger | No trigger | No trigger |
| General Go review | No trigger | No trigger | No trigger | No trigger | No trigger |
| LLVM C++ style | No trigger | No trigger | No trigger | No trigger | No trigger |
| Google Java style | No trigger | No trigger | No trigger | No trigger | No trigger |

For the current description, the Python positive triggered in 3/3 Codex runs and 0/3 gateway runs. The GoogleTest negative did not trigger in 3/3 runs per client. These are repeated observations, not calibrated trigger probabilities or proof that the description change caused the gateway misses. The alternative description triggered the Python positive in 1/3 gateway runs, triggered neither GoogleTest negative in 2 runs, and missed the adopted-Go positive in 2 runs; exact model-facing metadata delivery was not independently verified. It was not adopted.

Codex CLI 0.164.0 requested `gpt-6.1-terra` through its default OpenAI provider using ChatGPT authentication; the event stream did not independently name the server-side model. Claude Code 2.1.311 requested `tianchicc/claude-opus-5-5` through a local custom magpie gateway. The upstream provider and model were not independently verified. A direct Anthropic probe without the gateway failed with `Not logged in`; **there is no confirmed direct Anthropic Claude model evaluation or claude.ai upload test**. The gateway observations are client-and-gateway results, not evidence of Anthropic model performance.

Exact matrix prompts and project fixtures are in `test/evals/google-dev-standards/executed-trigger-cases.json`. Retained traces, discovery output, prompts, statuses, and configs for all three descriptions are in `test/evals/google-dev-standards/evidence/trigger/`. These traces have machine-specific paths, gateway addresses, and session identifiers sanitized; prompts and substantive results remain unchanged. Temporary credential files were not copied. Each prompt was run with the specific CLI options recorded alongside its trace; the reusable runner may use different isolation and tool options.

## Paired quality comparison

Each task was run once in a fresh Codex session with the target skill explicitly invoked and once with it absent from the isolated project and temporary home. Same task prompt in each pair; the skill condition included an explicit invocation. All four skill runs successfully read the relevant language reference. The comparison used the initial snapshot; its body and reference files are identical to the current snapshot, but it does not test current-description triggering.

| Case | Baseline | Skill | Core checks |
| --- | ---: | ---: | --- |
| C++17 dangling capture | 3/3 | 3/3 | Lifetime, safe capture and count contract, signature/version |
| Go 1.17 context and opaque error | 3/3 | 3/3 | Caller context, error identity, version/signature |
| Python 3.8 optional allowlist | 3/3 | 3/3 | `None` versus empty, ordering and duplicates, annotations |
| GitHub Markdown | 4/4 | 4/4 | Remove unsupported `[TOC]`, link text, nested command, output format |

An extra style check found the skill output used four spaces for list nesting, while the baseline used three spaces, which is still valid GitHub Markdown. The prompt did not explicitly require a replacement table of contents; the baseline added one and the skill output removed the placeholder without replacing it. These observations do not establish a general quality improvement, and the separate future Markdown fixture explicitly requires navigation.

Extracted C++ solutions compiled and executed with `clang++ -std=c++17`. Go solutions passed tests on Go 1.27.1 with `-gcflags=-lang=go1.17`. Python solutions passed behavior and annotation tests on Python 3.9.6 and parsed with Python 3.8 grammar. Actual Go 1.17 and Python 3.8 runtimes and a GitHub renderer were not available. Two discovery `rg` calls in skill runs returned no matches before successful reference reads; they were not treated as successful checks.

The exact task prompts and checkpoints are in `test/evals/google-dev-standards/2026-10-29-quality-executed.json`; the outputs, event traces, commands and verification records are under `test/evals/google-dev-standards/evidence/quality/`. Machine-specific details in those records are sanitized as described above. The additional `quality-cases.json` contains future cases and was not the set used to produce these scores.

## Validation and rerunning

- The Claude skill-creator `quick_validate.py` passed using a temporary PyYAML environment. This checks structure, not model execution or upload acceptance.
- `npm test` passed all 45 tests; `npm run validate` validated 11 skills; `python3 test/evals/google-dev-standards/test_runner.py` passed six offline tests. The dry run of the P2 project-fixture case completed without making a model request.
- `run_eval.py` defaults to a dry run. See `test/evals/google-dev-standards/USAGE.md` for fixtures, real-model runs, authentication, trace review, and baseline limitations. Its temporary homes exclude the user's OAuth login and configured gateways; actual calls need appropriate environment credentials and model/provider settings. Model calls may incur cost. An exit code of zero is not a passing score, and a failed, ambiguous, or missing trace is unassessed.

Official references: [Claude custom skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills), [Anthropic Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide), [OpenAI plugin submission checks](https://developers.openai.com/plugins/deploy/submission-errors), [OpenAI skill evaluations](https://developers.openai.com/blog/eval-skills), and [Anthropic authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
