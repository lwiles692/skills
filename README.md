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

Use Node.js 18.18 or newer and Python 3.6 or newer. Install the development dependencies, then run the local tests and skill validation:

```bash
npm ci
npm test
npm run validate
```

The tests use temporary files and substitute Pi, nftables, OCR, and reviewer executables. They do not install extensions, modify a firewall, or call a review model. Skill validation parses YAML and checks invocation-policy consistency across harness metadata.
