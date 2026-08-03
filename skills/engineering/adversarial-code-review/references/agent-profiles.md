# External reviewer profiles

The wrapper supports four explicitly selected reviewer CLIs. It starts one independent process per execution and never routes through acpx.

| ID | CLI | Non-interactive isolation |
|---|---|---|
| `pi` | `pi` | Print mode, ephemeral session, context/skills/extensions disabled, `--no-tools` |
| `claude` | `claude` | Print mode, plan permission mode, empty tool list, no session persistence or slash commands |
| `codex` | `codex exec` | Temporary cwd, read-only sandbox, ephemeral run, project rules ignored, final message captured separately |
| `kimi` | `kimi --prompt` | Temporary cwd and explicit temporary agent file with `tools: []` and `subagents: []` |

Resolve executables from `PATH`, or accept an absolute `--reviewer-bin` override. Run `--version` before repository inspection. Pass `--model` through using each CLI's native model flag.

Pi, Claude, and Codex accept the packet on stdin. Kimi prompt mode requires the packet as one argv value, so reject packets over 128 KiB and tell the caller to lower `--max-unit-bytes`. Keep the default evidence budget at 64 KiB.

Run reviewers in a newly created OS temporary directory, not the repository. Remove that exact temporary directory after the child exits. Bound stdout, stderr, elapsed time, and the full process group.

Adding a reviewer requires:

1. An explicit allowlisted profile and aliases.
2. A non-interactive one-shot mode.
3. A reliable final-response extraction path.
4. Tool/write isolation at least as strong as the existing profiles.
5. Model, timeout, empty-output, nonzero-exit, temporary-cwd, and tool-isolation tests.
