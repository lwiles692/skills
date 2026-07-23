# Reviewer profiles

## Built-in profiles

| ID | acpx agent | PATH executable | Adapter environment |
|---|---|---|---|
| `pi` | `pi` | `pi` | `PI_ACP_PI_COMMAND` |
| `claude` | `claude` | `claude` | `CLAUDE_CODE_EXECUTABLE`; `ACPX_CLAUDE_INCLUDE_USER_SETTINGS=1` |
| `codex` | `codex` | `codex` | `CODEX_PATH` |
| `kimi` | Raw `--agent` command | `kimi` | Absolute executable plus `acp` argument |

Resolve every executable from the current `PATH` with `which` (`where` on Windows) before acpx starts. Inject the absolute path through the adapter's documented environment variable when one exists. For Kimi, pass the absolute executable and `acp` argument through acpx's raw `--agent` option so the recorded path is the process that actually runs.

The Claude profile also asks acpx to include Claude Code user settings. This is required when authentication or a configured API gateway is supplied through the user settings `env` block; the runtime does not read or copy those credentials itself.

All profiles use the same review prompt, result contract, repository-confined read-only policy, chunk planner, and renderer. Profile-specific logic is limited to executable and adapter transport metadata.

## Adding a reviewer

1. Add a profile to `scripts/lib/agents.mjs`.
2. Keep the CLI allowlist explicit.
3. Confirm the acpx adapter can start in one-shot mode.
4. Add the executable name and either an adapter path environment variable or
   a direct ACP command using the resolved absolute path.
5. Verify repository reads work, writes and terminal requests fail, and the workspace fingerprint stays unchanged.
6. Verify full process-tree timeout termination and bounded output.
7. Run schema, authentication, small-diff, and large-diff conformance tests.

Do not add reviewer-specific Git target or finding logic.
