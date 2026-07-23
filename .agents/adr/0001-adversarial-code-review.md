# ADR 0001: Adversarial code review runtime

Status: accepted  
Date: 2026-07-23

## Context

The repository needs a portable code-review skill backed by `acpx`. Its first
reviewer backends are Pi Coding Agent, Claude Code, and Codex. The caller must
control which service receives the repository context, large changes must be
reviewable without silent truncation, and future ACP reviewers should not
require rewriting Git or review-domain logic.

## Decision

- Keep target selection, chunking, prompt construction, result validation,
  aggregation, and rendering inside the skill.
- Treat `acpx` as a replaceable transport behind a small runner module.
- Require exactly one explicit `--agent pi|claude|codex` per execution. Do not
  define a default reviewer or a multi-reviewer flag.
- Use stateless `acpx <agent> exec` and `--format quiet`; validate the final
  assistant text against the skill-owned schema.
- Resolve `pi`, `claude`, or `codex` from the caller's `PATH` and inject the
  absolute path through the adapter-specific executable environment variable.
- Select staged, unstaged, and untracked changes when the working tree is
  dirty; otherwise compare the current branch from its merge-base with an
  explicit or detected base.
- Split large targets by file and byte budget. Split oversized file entries
  into ordered labeled parts while retaining every source byte.
- Merge only units from the same execution. Keep reports from separately
  invoked reviewers independent.
- Enforce review-only behavior with an explicit prompt, an empty tool
  allowlist plus all reviewer tools denied, disabled terminal capability, bounded output, full process-tree
  timeout termination, and before/after workspace fingerprints.
- Add reviewers through profiles. Reviewer-specific code must not own Git
  target selection, finding semantics, or rendering.

## Consequences

- The three initial backends receive the same evidence and output contract.
- Callers can compare reviewers by invoking the skill separately and deciding
  how to consume the independent reports.
- Large-diff review can make several sequential model calls and therefore has
  higher latency and cost.
- A future cross-unit synthesis pass may improve cross-file reasoning, but it
  must remain within one explicitly selected reviewer execution.
- Since `acpx` is alpha, compatibility tests and version metadata are required
  before changing runner arguments or output handling.
