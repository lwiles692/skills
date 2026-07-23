# Repository guidance

This repository contains composable coding-agent skills.

## Structure

- Place stable skills under `skills/<category>/<skill-name>/`.
- Use `engineering`, `productivity`, `personal`, or `misc` for stable skills.
- Use `in-progress` for unfinished skills and `deprecated` for retained obsolete skills.
- Keep every skill self-contained. Do not deep-link from one skill into another skill's files.
- Put repository-wide conventions in `.agents/`.

## Skill requirements

- Name skill folders with lowercase letters, digits, and hyphens.
- Include `SKILL.md` and `agents/openai.yaml`.
- Keep `SKILL.md` concise and move detailed contracts into `references/`.
- Put deterministic repeated behavior in `scripts/`.
- Do not add README, changelog, or installation files inside an individual skill.
- Use imperative wording in skill instructions.
- Keep user-invoked/model-invoked policy consistent across supported harness metadata.

## Verification

Run both checks before committing:

```bash
npm test
npm run validate
```

Preserve unrelated work and do not publish, commit, or push unless the user asks.

