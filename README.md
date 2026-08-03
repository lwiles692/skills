# Skills

Composable skills for coding agents.

## Catalog

### Engineering

- `adversarial-code-review` — challenge Git changes with OCR scope/rules and one external Pi, Claude, Codex, or Kimi reviewer.

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
