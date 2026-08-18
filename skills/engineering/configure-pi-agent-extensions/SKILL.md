---
name: configure-pi-agent-extensions
description: Let the user choose, install, and verify any subset of a curated 10-package Pi Agent extension catalog covering minimal coding, web access, subagents, search, context, MCP, side questions, plan review, goals, and workflows. Use when a user asks to configure, reproduce, repair, or validate these Pi extensions globally or for one project.
---

# Configure Pi Agent Extensions

Collect an explicit package selection, then configure only that selection through Pi's package manager. Preserve unrelated Pi settings, installed packages, and credentials.

## Selection interaction

Before previewing or installing anything, call the host's `askUserQuestion` tool (`AskUserQuestion` in hosts that capitalize tool names). Do not silently choose a preset.

Use one call containing these four questions:

1. Header `Core`, question "Which core extensions do you want to install?", `multiSelect: true`: Ponytail, Web access, Subagents, FFF search.
2. Header `Context`, question "Which context extensions do you want to install?", `multiSelect: true`: Context view, MCP adapter, BTW.
3. Header `Workflow`, question "Which workflow extensions do you want to install?", `multiSelect: true`: Plannotator, Goal mode, Dynamic workflows.
4. Header `Scope`, question "Where should the selected extensions be installed?", `multiSelect: false`: User-level (recommended; available across projects) or Project-level (current project's `.pi/settings.json`).

Give every extension option the description from the catalog below. If `askUserQuestion` is unavailable, present the same grouped choices in plain text and wait for the response. If a custom response cannot be mapped unambiguously to the catalog, ask again instead of guessing. If the user selects no extensions, stop without running the script. Never infer that an empty response means all packages.

## Extension catalog

| Group | Choice | Script ID | Pi source | Description |
| --- | --- | --- | --- | --- |
| Core | Ponytail | `ponytail` | `npm:@dietrichgebert/ponytail` | Prefer existing code, standard libraries, and minimal implementations. |
| Core | Web access | `web-access` | `npm:pi-web-access` | Add web search and access to pages, repositories, PDFs, and videos. |
| Core | Subagents | `subagents` | `npm:pi-subagents` | Delegate focused work to child agents and parallel workflows. |
| Core | FFF search | `fff` | `npm:@ff-labs/pi-fff` | Add indexed fuzzy file and content search. |
| Context | Context view | `context-view` | `npm:pi-context-view` | Inspect context usage, prompts, tools, and extension injections. |
| Context | MCP adapter | `mcp-adapter` | `npm:pi-mcp-adapter` | Discover MCP tools on demand without loading every schema. |
| Context | BTW | `btw` | `npm:@narumitw/pi-btw` | Ask side questions without adding detours to the main conversation. |
| Workflow | Plannotator | `plannotator` | `npm:@plannotator/pi-extension` | Review and annotate plans through a browser UI. |
| Workflow | Goal mode | `goal` | `npm:@narumitw/pi-goal` | Persist one objective across turns until completion or pause. |
| Workflow | Dynamic workflows | `dynamic-workflows` | `npm:@quintinshaw/pi-dynamic-workflows` | Orchestrate routing, subagents, isolation, cross-checks, and recovery. |

## Safety and scope

- Treat every package as third-party executable code. Show the chosen sources and obtain any approval required for network access or writes outside the workspace.
- Use `pi install`; do not edit Pi's `settings.json`, package directory, lockfiles, authentication files, or MCP configuration by hand.
- Never read or expose provider keys. Installation does not require adding credentials.
- Treat every selected package uniformly. Do not add package-specific timeout, retry, or recovery behavior.
- Stop and report the failing source if installation fails. Preserve packages already installed.
- Do not remove, disable, or verify unselected packages.

## Workflow

1. Convert each selected choice to its Script ID. Add `--local` only for Project-level scope.
2. Run a read-only preview with one `--package` argument per selected ID. For example:

   ```sh
   ./scripts/configure-pi-agent-extensions.sh --dry-run \
     --package web-access \
     --package subagents
   ```

3. Show the preview and state that the selected npm packages can execute code. When the request authorizes installation and the environment permits it, rerun the same command without `--dry-run`.
4. Let the script install missing selected packages, verify the selected settings scope, print `pi list`, and perform an offline RPC startup check. Treat ordinary no-session delivery notices as non-fatal when Pi exits successfully.
5. Tell the user to run `/reload` in an existing Pi session or restart Pi. Report the scope, installed sources, skipped existing sources, and warnings.

Use `--verify-only` with the same `--package` arguments to validate an existing selection. Use `--all` only when the user explicitly selects all ten extensions. Use `--list` to print the catalog of valid Script IDs.

Require Pi 0.79.1 or newer when Plannotator is selected. If Pi is absent or too old, stop and ask the user to install or update Pi; do not update Pi automatically.

## Optional post-install configuration

- Leave `pi-web-access` on its zero-configuration fallback unless the user asks for a specific search provider.
- Let `pi-mcp-adapter` discover standard MCP files automatically. Run `/mcp setup` only when the user asks to import or create MCP configuration.
- Do not create optional Ponytail, goal, subagent, or workflow settings unless the user requests customization.
