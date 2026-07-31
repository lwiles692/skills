# ADR 0001: Adversarial code review runtime

Status: accepted  
Date: 2026-07-23

## Context

The repository needs a portable code-review skill backed by `acpx`. Its
reviewer backends are Pi Coding Agent, Claude Code, Codex, and Kimi. The caller must
control which service receives the repository context, large changes must be
reviewable without silent truncation, and future ACP reviewers should not
require rewriting Git or review-domain logic.

## Decision

- Keep target selection, chunking, and prompt construction inside the skill.
- Treat `acpx` as a replaceable transport behind a small runner module.
- Require exactly one explicit `--agent pi|claude|codex|kimi` per execution. Do not
  define a default reviewer or a multi-reviewer flag.
- Use stateless `acpx <agent> exec` and `--format quiet`. Ask the reviewer for
  Markdown prose and print the final assistant text unchanged. Structured JSON
  output was dropped because models follow strict schema instructions
  unreliably, and a valid review was being discarded over formatting alone.
- Read exactly one token from that prose: an exact `Verdict:` line, required to
  be unambiguous across the whole response. It drops adapter startup noise and
  yields a conservative run-level verdict, so chunked reviews still have a
  single outcome. Anything ambiguous — no verdict, disagreeing verdicts, or a
  unit cut short by a denied permission — is reported as
  `manual-consolidation-required` rather than silently approved.
- Resolve `pi`, `claude`, `codex`, or `kimi` from the caller's `PATH`. Inject
  the absolute path through an adapter-specific executable environment
  variable when supported; otherwise pass it through acpx's raw `--agent`
  command so report metadata always identifies the executable that ran.
- Select staged, unstaged, and untracked changes when the working tree is
  dirty; otherwise compare the current branch from its merge-base with an
  explicit or detected base.
- Split large targets by byte budget alone. A file-count budget was removed
  because it split small many-file changes into several model calls for no
  context-window reason, costing the reviewer the cross-file view that finds
  the strongest findings. Split oversized file entries into ordered labeled
  parts while retaining every source byte.
- Print each unit of an execution as its own section. Keep reports from
  separately invoked reviewers independent.
- Treat review-only as an instruction backed by detection, not as a sandbox.
  Measured 2026-07-29 on acpx 0.12.0: `claude` honors ACP permissions, `pi` and
  `codex` bypass them and will run `write` and `bash` regardless of
  `--deny-all`, `--allowed-tools`, and `--no-terminal`. The controls that do
  hold are the prompt's `<review_only>` section, tool-call recording from the
  event stream, bounded output, full process-tree timeout termination, and
  before/after workspace fingerprints. A sandboxed copy would be the real fix
  and was deliberately deferred.
- Consume acpx's `--format json` event stream rather than its rendered text.
  The transport is the trust boundary: it separates the reviewer's final
  message from adapter banners, reports permission requests independently of
  exit status, and makes tool calls observable.
- Add reviewers through profiles. Reviewer-specific code must not own Git
  target selection or finding semantics.

## Consequences

- The four backends receive the same evidence and output contract.
- Callers can compare reviewers by invoking the skill separately and deciding
  how to consume the independent reports.
- Large-diff review can make several sequential model calls and therefore has
  higher latency and cost.
- A future cross-unit synthesis pass may improve cross-file reasoning, but it
  must remain within one explicitly selected reviewer execution.
- Since `acpx` is alpha, compatibility tests and version metadata are required
  before changing runner arguments or output handling.
