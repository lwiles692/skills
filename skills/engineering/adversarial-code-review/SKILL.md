---
name: adversarial-code-review
description: Run a read-only adversarial review of Git working-tree or branch changes through one explicitly selected ACP coding-agent backend. Use when the user wants to challenge an implementation, pressure-test design choices or failure modes, review uncommitted work or a branch against a base ref, or asks Pi, Claude Code, Codex, or Kimi to act as an independent reviewer. Supports large-diff chunking while keeping one reviewer backend per execution.
---

# Adversarial Code Review

Run the bundled script to determine the Git target, split large changes and oversized files without truncation, invoke one reviewer through `acpx`, validate its findings, and return a single report. Keep the run review-only: repository reads are allowed for context, while writes and terminal execution are denied.

## Preflight

Before asking for a reviewer or inspecting the repository, run:

```bash
acpx --version
```

If the command is unavailable or fails, tell the user to install it with
`npm i -g acpx`, then stop. Do not continue the review workflow in the same
turn.

## Required choice

Require the caller to name exactly one reviewer:

- `pi`
- `claude`
- `codex`
- `kimi`

Do not guess or select a default reviewer. If the caller requests several reviewers, run one explicit command per reviewer and keep their reports separate.

Require the selected reviewer executable to be installed on `PATH`. Resolve it with `which` (`where` on Windows), then force the ACP adapter to use that absolute path.

## Run the review

Resolve the script path relative to this `SKILL.md`, then run it with the repository under review as the current working directory:

```bash
node <skill-directory>/scripts/review.mjs --agent <pi|claude|codex|kimi>
```

Map user intent to these arguments:

- `--scope auto|working-tree|branch` — default `auto`.
- `--base <ref>` — review the branch from its merge-base with the ref.
- `--focus <text>` — weight a risk area without suppressing other material findings.
- `--model <id>` — request a backend model when supported.
- `--format markdown|json` — default `markdown`.
- `--timeout <seconds>` — default `900`.
- `--cwd <path>` — use only when reviewing a repository other than the current directory.

Examples:

```bash
node <skill-directory>/scripts/review.mjs \
  --agent claude \
  --scope working-tree \
  --focus "challenge retry, concurrency, and rollback safety"
```

```bash
node <skill-directory>/scripts/review.mjs \
  --agent codex \
  --base main \
  --format json
```

```bash
node <skill-directory>/scripts/review.mjs \
  --agent kimi \
  --scope working-tree
```

## Handle the result

- Return the script output as the review report.
- Treat exit `0` as a completed review; read `verdict` to determine whether findings exist.
- Treat exit `4` as no reviewable changes.
- On other nonzero exits, report the diagnostic and do not claim the review completed.
- Do not fix findings in the same step unless the user separately asks for implementation.
- Do not merge or rank reports from separate reviewer executions.

## Load references only when needed

- Read `references/review-contract.md` when interpreting structured output or changing finding rules.
- Read `references/agent-profiles.md` when diagnosing a backend or adding another reviewer.
- Read `references/unit-review.schema.json` when changing prompt or validator fields.
