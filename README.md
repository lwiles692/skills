# Skills

Composable skills for coding agents.

## Catalog

### Engineering

- `adversarial-code-review` — challenge a Git change with one explicitly selected ACP reviewer (`pi`, `claude`, or `codex`).

## Layout

```text
skills/
  engineering/
  productivity/
  personal/
  misc/
  in-progress/
  deprecated/
```

Each skill owns its `SKILL.md`, `agents/openai.yaml`, and any runtime-specific `scripts/` or `references/`. Repository-wide conventions and architecture decisions live under `.agents/`.

## Development

```bash
npm test
npm run validate
```
