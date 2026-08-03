# ADR 0002: Open CodeReview delegation runtime

Status: superseded by ADR 0003
Date: 2026-08-03

## Context

ADR 0001 used `acpx` to start one of four external coding-agent backends. In
practice the ACP adapters had inconsistent permission behavior, startup and
event-stream compatibility, and backend-specific executable configuration.
The transport became most of the skill's failure surface.

Open CodeReview (OCR) provides a delegation mode where OCR owns deterministic
file selection, exclusions, and rule resolution while the current host agent
performs the review with its own LLM capability. This removes the need for a
second agent runtime and extra model configuration.

## Decision

- Replace `acpx`, ACP stream parsing, reviewer profiles, and `--agent` selection
  with `ocr delegate preview` and `ocr delegate rule`.
- Keep the current host agent as the sole reviewer. Never call `ocr review` in
  this skill; Delegate mode must remain LLM-free on the OCR side.
- Mirror OCR's native targets. Explicit `--from` plus `--to` selects a range,
  and `--commit` selects one commit. With no target flags, linked worktrees use
  workspace mode; primary checkouts detect the default base and use a range to
  `HEAD`.
- Treat OCR preview as the authority for file scope and rules. Parse its
  documented Markdown fail-closed, require the declared reviewable count to
  match parsed entries, validate refs and repository-confined paths, and stop
  on an incompatible format.
- Obtain diffs with Git according to OCR's reported mode and merge-base.
- Preserve byte-budget packetization. Emit one packet per invocation and let
  the host agent review all units before conservative consolidation.
- Keep review-only safety in the host-agent instructions, JSON-encode all
  repository-derived evidence, and compare workspace fingerprints around
  packet preparation.
- Preflight `ocr --version` before repository inspection. Delegate mode needs
  no OCR model, endpoint, or API key.

## Consequences

- The skill no longer supports choosing Pi, Claude, Codex, or Kimi as a second
  reviewer. The active host agent performs the review.
- OCR provides consistent file filtering and language/project rule resolution,
  while model reasoning and subscription usage stay in the host environment.
- Packet preparation is deterministic and testable without an LLM, but OCR's
  Markdown output is now an integration contract that must be covered by
  compatibility tests.
- Large changes require the host agent to request and review multiple packets;
  packet preparation alone cannot be reported as a completed review.
