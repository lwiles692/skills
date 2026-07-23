# Skill invocation

Classify each skill by who may invoke it:

- **Model-invoked** skills may be selected by a user or reached automatically by an agent. Give their `description` rich trigger phrasing and omit opt-out invocation policy.
- **User-invoked** skills run only when a human explicitly names them. Keep the opt-out flags for every supported harness in sync.

Prefer model invocation when an agent can safely and usefully recognize the workflow on its own. Keep provider-specific invocation metadata in `agents/`; keep the portable workflow in `SKILL.md`.

