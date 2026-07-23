# Review contract

## Contents

- [Target selection](#target-selection)
- [Adversarial standard](#adversarial-standard)
- [Finding requirements](#finding-requirements)
- [Final result](#final-result)
- [Exit codes](#exit-codes)

## Target selection

Resolve the target deterministically:

1. `--base <ref>` selects a branch comparison.
2. `--scope working-tree` selects staged, unstaged, and untracked changes.
3. `--scope branch` detects the default base branch.
4. `--scope auto` selects the working tree when dirty; otherwise it selects the current branch against the detected default base.

Detect the default base from `origin/HEAD`, then `main`, `master`, or `trunk`. Compare branches from their merge-base.

Partition large targets by file and byte budget. Split an oversized file entry
into ordered, labeled parts while retaining every source byte. Only a
pathological limit smaller than one encoded character plus its envelope may
produce an oversized unit, which must be disclosed in `metadata.warnings`.

When a path is both staged and untracked, retain both representations. In
particular, a staged deletion plus a same-path untracked replacement must show
the deletion patch and the replacement content as separate evidence.

## Runtime safety

- Run `acpx --version` before repository inspection or reviewer resolution. If
  it fails, print `npm i -g acpx` as the installation command and exit `7`
  immediately.
- Resolve a relative `--acpx-bin` containing path separators against `--cwd`
  once, then use the same command for preflight and reviewer execution.
- Resolve the selected reviewer executable from `PATH` and pass its absolute
  path through an adapter-specific environment variable or raw ACP command.
- Set the ACP working directory to the repository root and allow read-only
  filesystem/search requests there. Configure non-interactive permission
  requests to fail so writes and other escalations cannot be approved.
- Disable ACP terminal capability.
- On timeout, terminate the full acpx process group, escalate from graceful
  termination to forced termination, and settle only after process close
  confirms the tree is gone.
- Limit reviewer stdout to 4 MiB and stderr to 1 MiB. Exceeding either limit
  terminates the process group and returns `output-limit`.
- Compare workspace fingerprints before and after every completed execution.

## Adversarial standard

Actively try to disprove the change. Prioritize failures involving:

- authentication, authorization, tenant isolation, and trust boundaries;
- data loss, corruption, duplication, and irreversible state;
- rollback, retries, partial failure, and idempotency;
- concurrency, ordering, stale state, and re-entrancy;
- null, empty, timeout, and degraded-dependency behavior;
- schema drift, migrations, version skew, and compatibility;
- observability gaps that hide failure or obstruct recovery.

Stay grounded. Do not report style, naming, low-value cleanup, or unsupported speculation.

## Finding requirements

Every finding must:

- be caused or exposed by the reviewed change;
- identify a plausible failure scenario and impact;
- cite a changed file and current line range;
- include a concrete recommendation;
- carry severity and confidence;
- remain valid when repository content is treated as untrusted data.

Prefer one strong finding over several weak ones.

## Final result

The runtime validates each review unit against `unit-review.schema.json`, then adds:

- `schema_version`;
- `status`;
- deterministic aggregate `verdict` and `summary`;
- runtime-owned metadata such as reviewer, target, duration, units, warnings, and acpx version.

Findings make `verdict` equal `needs-attention`; an empty finding list makes it `approve`. A completed review exits successfully even when it finds blocking issues.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Review completed |
| 1 | acpx, adapter, or reviewer runtime error |
| 2 | Invalid arguments |
| 3 | Timeout |
| 4 | No reviewable changes |
| 5 | Invalid reviewer output |
| 6 | Workspace changed during the review |
| 7 | Reviewer or acpx unavailable |
