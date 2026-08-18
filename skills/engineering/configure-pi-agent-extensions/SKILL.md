---
name: configure-pi-agent-extensions
description: Install and verify the curated 10-package Pi Agent extension suite containing Ponytail, web access, subagents, FFF search, context inspection, MCP, side questions, plan review, goal mode, and dynamic workflows. Use when a user asks to reproduce, configure, repair, or validate this Pi extension setup globally or for one project.
---

# Configure Pi Agent Extensions

Configure the fixed package set through Pi's package manager. Preserve unrelated Pi settings and credentials.

## Safety and scope

- Default to user-level installation. Use project-local installation only when the user explicitly requests it.
- Treat every package as third-party executable code. Show the planned sources and obtain any approval required for network access or writes outside the workspace.
- Use `pi install`; do not edit Pi's `settings.json`, package directory, lockfiles, authentication files, or MCP configuration by hand.
- Never read or expose provider keys. The suite does not require adding credentials during installation.
- Treat all ten packages uniformly. Do not add package-specific timeout, retry, or recovery behavior.
- Stop and report the failing source if an installation command fails. Preserve packages already installed.

## Workflow

1. Confirm the requested scope. Use the global default unless the user asks for project-local configuration.
2. Run a read-only preview from this skill directory:

   ```sh
   ./scripts/configure-pi-agent-extensions.sh --dry-run
   ```

   Add `--local` when the user requested project-local configuration.
3. Report that the previewed npm packages can execute code. When the user's request authorizes installation and the environment permits it, run:

   ```sh
   ./scripts/configure-pi-agent-extensions.sh
   ```

   For project-local configuration, run:

   ```sh
   ./scripts/configure-pi-agent-extensions.sh --local
   ```

4. Let the script install missing packages, verify the selected settings scope, print `pi list`, and perform an offline RPC startup check. Do not interpret ordinary no-session delivery notices as load failures when Pi exits successfully.
5. Tell the user to run `/reload` in an existing Pi session or restart Pi. Report the scope, installed sources, skipped existing sources, and any warnings.

Use `--verify-only` to check an existing configuration without installing anything. Use `--help` to show all script options.

## Package set

Install exactly these sources unless the user asks to change the suite:

```text
npm:@dietrichgebert/ponytail
npm:pi-web-access
npm:pi-subagents
npm:@ff-labs/pi-fff
npm:pi-context-view
npm:pi-mcp-adapter
npm:@narumitw/pi-btw
npm:@plannotator/pi-extension
npm:@narumitw/pi-goal
npm:@quintinshaw/pi-dynamic-workflows
```

Require Pi 0.79.1 or newer because the included Plannotator extension depends on that baseline. If Pi is absent or older, stop and ask the user to install or update Pi; do not update Pi automatically.

## Optional post-install configuration

- Leave `pi-web-access` on its zero-configuration fallback unless the user asks for a specific search provider.
- Let `pi-mcp-adapter` discover standard MCP files automatically. Run `/mcp setup` only when the user asks to import or create MCP configuration.
- Do not create optional Ponytail, goal, subagent, or workflow settings unless the user requests customization.
