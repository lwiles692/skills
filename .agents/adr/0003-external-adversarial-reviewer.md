# ADR 0003: External reviewer over OCR Delegate packets

Status: accepted
Date: 2026-08-03

## Context

ADR 0002 correctly replaced acpx with Open CodeReview Delegate for file scope
and rules, but incorrectly assigned the actual review to the current host
agent. That removes the independent perspective required for an adversarial
review.

The installed Pi, Claude Code, Codex, and Kimi CLIs all expose one-shot modes.
They can review a self-contained OCR packet directly without an ACP adapter.

## Decision

- Require one explicit `--agent pi|claude|codex|kimi` on every execution.
- Use OCR only for Delegate preview and rule resolution; never use `ocr review`.
- Build self-contained, byte-bounded packets and start the selected external
  CLI once per packet.
- Run reviewers outside the repository. Disable tools for Pi and Claude, use a
  read-only sandbox for Codex, and provide Kimi an explicit `tools: []` agent
  profile.
- Pass model selection through the reviewer's native flag. Use existing local
  authentication and subscriptions.
- Require an exact leading verdict from every unit and consolidate
  conservatively. Keep different reviewer executions independent.
- Trust OCR Delegate to remain read-only. Do not fingerprint the workspace or
  invalidate a self-contained review when the user edits concurrently.
- Retain worktree-aware default targeting from ADR 0002.

## Consequences

- The review again supplies an independent adversarial perspective without
  restoring acpx or ACP adapter behavior.
- Four reviewer CLIs are supported consistently in code and documentation.
- Review packets are sent to the selected reviewer's model service, while OCR
  remains LLM-free.
- Self-contained packets trade repository exploration for stronger isolation
  and reproducibility.
