# Reviewer profiles

## Built-in profiles

| ID | acpx agent | PATH executable | Adapter environment |
|---|---|---|---|
| `pi` | `pi` | `pi` | `PI_ACP_PI_COMMAND` |
| `claude` | `claude` | `claude` | `CLAUDE_CODE_EXECUTABLE`; `ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1` |
| `codex` | `codex` | `codex` | `CODEX_PATH` |

All profiles resolve their executable from the current `PATH` with `which` (`where` on Windows) before acpx starts. The absolute path is injected through the adapter's documented environment variable, preventing an adapter's bundled CLI from silently replacing the selected local installation.

The Claude profile also asks acpx to include Claude Code user settings. This is required when authentication or a configured API gateway is supplied through the user settings `env` block; the runtime does not read or copy those credentials itself.

All profiles use the same review prompt, result contract, repository-confined read-only policy, chunk planner, and renderer. Profile-specific logic is limited to executable and adapter transport metadata.

## Adding a reviewer

1. Add a profile to `scripts/lib/agents.mjs`.
2. Keep the CLI allowlist explicit.
3. Confirm the acpx adapter can start in one-shot mode.
4. Add the executable name and adapter path environment variable.
5. Verify repository reads work, writes and terminal requests fail, and the workspace fingerprint stays unchanged.
6. Verify full process-tree timeout termination and bounded output.
7. Run schema, authentication, small-diff, and large-diff conformance tests.

Do not add reviewer-specific Git target or finding logic.
