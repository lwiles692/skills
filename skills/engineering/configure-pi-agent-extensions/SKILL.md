---
name: configure-pi-agent-extensions
description: Let the user choose, install, and verify any subset of a curated 10-package Pi Agent extension catalog covering minimal coding, web access, subagents, search, context, MCP, side questions, plan review, goals, and workflows. Use when a user asks to configure, reproduce, repair, or validate these Pi extensions globally or for one project.
---

# Configure Pi Agent Extensions

Collect an explicit package selection, then configure only that selection through Pi's package manager. Preserve unrelated Pi settings, installed packages, and credentials.

## Selection interaction

Reuse package selections and installation scope already supplied in the conversation. Ask only for missing or ambiguous selections; a request to verify existing packages authorizes verification, not installation. Use the host's available input capability and adapt to its question limits and selection support.

When the selection is open, offer the catalog's Core, Context, and Workflow groups and ask for User-level or Project-level scope. Use the catalog descriptions to explain choices. Do not choose a preset or interpret an empty response as all packages. If the user selects no extensions, finish without running the script.

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
2. Resolve the script to an absolute path relative to this `SKILL.md`. Keep the target project as the working directory; do not change into the skill directory. Run a read-only preview with one `--package` argument per selected ID. Replace `ABSOLUTE_SKILL_DIR` with the resolved skill directory:

   ```sh
   sh ABSOLUTE_SKILL_DIR/scripts/configure-pi-agent-extensions.sh --dry-run \
     --package web-access \
     --package subagents
   ```

3. Show the preview and state that the selected npm packages can execute code. When the request authorizes installation and the environment permits it, rerun the same command without `--dry-run`.
4. Let the script install missing selected packages and verify their registrations in the selected settings scope. The script parses JSON with Node.js and does not load extensions or prove that their code works.
5. Report the scope, installed sources, existing registrations, and any unresolved checks. Tell the user to run `/reload` in an existing Pi session or restart Pi. Claim that an extension is ready only after observing its successful load or operation. If the user requests a loading test, use an isolated profile containing only the selected sources; do not load unrelated extensions from the live profile.

Use `--verify-only` with the same `--package` arguments to validate an existing selection. Use `--all` only when the user explicitly selects all ten extensions. Use `--list` to print the catalog of valid Script IDs.

Require Node.js on `PATH` for structured settings checks. Require Pi 0.79.1 or newer when Plannotator is selected. If Pi is absent or too old, stop and ask the user to install or update Pi; do not update Pi automatically.

## Optional post-install configuration

- Leave `pi-web-access` on its zero-configuration fallback unless the user asks for a specific search provider.
- Let `pi-mcp-adapter` discover standard MCP files automatically. Run `/mcp setup` only when the user asks to import or create MCP configuration.
- Do not create optional Ponytail, goal, subagent, or workflow settings unless the user requests customization.
