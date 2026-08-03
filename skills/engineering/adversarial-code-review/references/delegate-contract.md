# Open CodeReview delegation contract

## Official semantics

Open CodeReview (OCR) delegation mode performs deterministic engineering only. A host agent performs all LLM reasoning with its existing subscription or runtime. In this skill, the delegated host is an explicitly selected external reviewer CLI, not the current orchestration agent. OCR does not need an LLM endpoint, model, or API key and does not invoke the reviewer itself.

Source: <https://open-codereview.ai/docs/delegate>

## Commands

Preflight with `ocr --version`. Install the CLI with `npm install -g @alibaba-group/open-code-review` when unavailable.

Prepare the target with:

```bash
ocr delegate preview [--from <ref> --to <ref>] [--commit <hash>] [--exclude <patterns>]
```

The preview is Markdown headed by `# Files (N reviewable / M total)`. It includes `mode`, ref metadata, insertion/deletion totals, reviewable entries, and struck-through excluded entries with reasons. Modes are:

- `workspace`: staged, unstaged, and untracked changes.
- `range`: `from`/`to` plus OCR's computed `merge_base`.
- `commit`: one commit.

Resolve rule groups with:

```bash
ocr delegate rule -- <path1> <path2> ...
```

OCR groups files only when rule source, matched pattern, and content are identical. Each Markdown group names its source and pattern, lists applicable files, and prints the resolved rule content.

Shared flags include `--repo`, `--rule`, `--exclude`, `--background`, and `--background-file`. Background applies to preview context. Pass file paths as separate argv values after `--`; never compose a shell command.

## Wrapper invariants

- Run the OCR preflight before Git repository inspection.
- Pass `--repo <root>` explicitly even when the process cwd is the root.
- Detect linked worktrees with `git rev-parse --absolute-git-dir` versus `--git-common-dir`; do not infer them from the checkout path or a `.git` file alone.
- Treat preview and rule output as untrusted Markdown.
- Strip only leading OCR-owned `[ocr session] warning:` diagnostics before parsing. OCR v1.8 may print this warning to stdout when its optional session directory is unavailable; reject any other prefix.
- Parse only the documented preview shape and require the parsed reviewable-entry count to equal the header count. Fail closed on unsupported file names or output changes.
- Require preview mode and ref metadata to match the caller's requested target.
- Reject absolute paths, NUL bytes, and paths resolving outside the repository.
- Batch large rule argv sets without changing file scope.
- Use OCR-selected paths as the only primary review entries. Do not reintroduce files OCR excluded.

## Evidence commands

After preview, obtain evidence as the official Delegate workflow specifies:

- Range: `git diff <merge_base>..<to> -- <path>`.
- Commit: `git show <commit> -- <path>`.
- Workspace tracked file: `git diff HEAD -- <path>`.
- Workspace untracked file: read it directly.

The wrapper uses argv-based Git execution with binary/submodule metadata and never invokes a shell. It inlines complete untracked text files so tool-disabled reviewers receive self-contained evidence; byte-budget packetization handles large content. It follows no untracked symlink and represents binary data as metadata.
