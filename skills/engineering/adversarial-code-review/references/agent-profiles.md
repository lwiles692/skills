# External reviewer profiles

Start one reviewer in the repository and require it to use `$open-code-review-delegate`. Resolve an explicit or user-installed copy first, otherwise use the bundled fallback. Materialize the selected source into a temporary standard skill directory before constructing reviewer arguments.

| ID | CLI | Delegate access and review controls |
|---|---|---|
| `pi` | `pi` | Load the delegate skill explicitly; enable `read`, `bash`, `grep`, `find`, and `ls`; disable sessions, context files, templates, and extensions. |
| `claude` | `claude` | Use print mode, plan permission mode, read/Bash search tools, and no session persistence. |
| `codex` | `codex exec` | Use the repository cwd, a read-only sandbox, an ephemeral run, and capture the final message separately. |
| `kimi` | `kimi --prompt` | Add the delegate skill root through `--skills-dir` and run one prompt-mode review. |

Resolve executables from `PATH`, or accept an absolute `--reviewer-bin` override. Run `--version` before repository inspection. Pass `--model` through using each CLI's native model flag.

Pass only a short trusted task prompt. Do not serialize repository diffs, OCR previews, rules, or source files into the CLI prompt. Let the external host agent invoke OCR Delegate and Git itself.

Pi and Kimi need shell-capable tools to execute OCR and Git and do not expose an equivalent to Codex's OS-enforced read-only sandbox. Keep the prompt review-only and state this weaker enforcement in the user-facing skill contract.

Adding a reviewer requires:

1. An explicit allowlisted profile and aliases.
2. A non-interactive one-shot mode.
3. Native access to the delegate skill.
4. OCR, Git, and surrounding-context read capabilities.
5. Model, timeout, empty-output, nonzero-exit, and skill-loading tests.
