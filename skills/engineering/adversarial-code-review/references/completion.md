# Review completion and caller continuation

Treat the calling agent as the owner of execution, result collection, and finding assessment. The wrapper waits for the selected external reviewer; it has no connection to the calling agent's conversation that can start another turn.

## When execution yields

1. Retain the execution tool's session or task handle from the original invocation. Keep exactly one reviewer running.
2. Use the host's wait/output operation with bounded waits until the wrapper exits. Continue required progress updates between waits. In Codex, poll `exec_command` sessions with `write_stdin`; when an outer `functions.exec` call yields a cell ID, resume that cell with `functions.wait` to obtain its result first.
3. Check the wrapper's exit code and completion signal. Read the entire file supplied through `--output`; use file reads in sections if the tool truncates output.
4. Return to `SKILL.md`'s result handling before ending the turn.

Use the same ownership rule in Claude Code, Kimi, and other hosts. Prefer foreground execution when no reliable task completion event exists. Use a native background task only when its completion event reaches the calling agent and its output remains retrievable; collect the result on that event. If delivery is uncertain, wait in the current turn.

Avoid detached shell jobs (`&`, `nohup`) and ending with only a promise to check later. If the host offers no way to wait for a yielded job, report that result collection is blocked and preserve its handle and report path; do not start a duplicate review.

## Wrapper signals and report lifetime

- `running` means the reviewer is starting; keep waiting.
- `completed` means the reviewer returned a nonempty report and any requested report file was saved. It tells the caller to read and assess the full report; it does not attest that the findings are correct or that the change is safe.
- `failed` and a nonzero exit mean the review did not complete. Report the failure reason; do not treat missing findings as approval.

Read lifecycle signals from the wrapper's stderr and keep stdout as the reviewer's report. These signals aid collection by an active caller; they do not independently wake a finished agent turn. Save each review to a fresh path, and remove its temporary directory only after the report has been handled and delivered.
