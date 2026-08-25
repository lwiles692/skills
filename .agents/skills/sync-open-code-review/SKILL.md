---
name: sync-open-code-review
description: Sync this repository's bundled Open Code Review Delegate fallback with its official upstream skill when asked to update Open Code Review or OCR instructions.
---

# Sync Open Code Review

Update `skills/engineering/adversarial-code-review/references/open-code-review-delegate.md` from the canonical upstream source at `https://raw.githubusercontent.com/alibaba/open-code-review/main/skills/open-code-review-delegate/SKILL.md`.

1. Inspect the working tree and the local fallback before editing. Preserve unrelated changes. The HTML comment immediately after the frontmatter records the bundled source and remains local provenance.
2. Fetch the upstream `SKILL.md` into a temporary file. Do not install or update the `ocr` CLI; this task syncs repository instructions only.
3. Compare the files after excluding the local provenance comment. Apply only substantive upstream differences. If the content already matches, report that no update is needed.
4. Keep the fallback valid as `name: open-code-review-delegate`. Update tests only when an upstream instruction changes behavior asserted by this repository.
5. Check the patch with `git diff --check`, then run `npm test` and `npm run validate`.

Report the upstream source checked, changed files, and validation result. Do not commit, push, or publish unless the user asks.
