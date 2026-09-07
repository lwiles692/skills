---
name: write-google-style-docs
description: Write, rewrite, edit, or review developer-facing and technical documentation according to the Google developer documentation style guide. This skill is mandatory for every task that creates, changes, or evaluates such documentation, including when documentation is only one part of a larger coding or product task. Use for tutorials, how-to guides, conceptual documentation, API and CLI documentation, UI instructions, release notes, README content, migration guides, troubleshooting content, and editorial audits. Apply the full guide to English prose and language-independent principles to translated documentation without imposing US-English grammar or punctuation.
---

# Write Google-style docs

Produce developer documentation that is accurate, task-oriented, easy to scan, and consistent with the Google developer documentation style guide.

## Treat this workflow as mandatory

Use this skill whenever a task creates, rewrites, edits, or reviews developer-facing or technical documentation. Apply it even when documentation is a small part of a broader implementation, refactoring, release, or review task.

Apply the style guidance to every technical-documentation task, scaling reference reads and checks to the change. Reuse guidance already read and still available in the conversation. For a local correction, read the core guidance and only the rule sections needed to verify that correction; for new documents, substantial rewrites, and formal audits, load the applicable references and use the review passes below. If a higher-priority user or project rule conflicts with this skill, follow the authority order below and state the exception when it affects the delivered document.

## Resolve authority

Apply guidance in this order:

1. Follow the user's explicit requirements and preserve technical truth.
2. Follow the project's documented terminology and style exceptions.
3. Follow this skill and the Google developer documentation style guide.
4. For unresolved English spelling, use the first spelling in Merriam-Webster.

Use formal written language for all prose. This project rule overrides the Google guide's conversational-tone guidance; see `references/core-style.md` for its application. Preserve literal source content, such as product names, UI labels, API identifiers, commands, and quotations.

Depart from the guide when doing so clearly helps the intended readers. Keep any departure consistent within the document. Do not silently rewrite product names, UI labels, API identifiers, commands, code, or quoted text to satisfy prose rules.

## Select a mode

- **Draft:** Create publication-ready content from requirements or source material.
- **Revise:** Return improved copy while preserving meaning, technical behavior, document structure when useful, and the source format.
- **Audit:** Report concrete issues and proposed fixes without rewriting unless the user asks for a rewrite.

Infer the mode from the request. Ask a question only when a missing fact would materially change the result; otherwise, make the smallest reasonable assumption and identify it briefly.

## Load the guidance

Read [references/core-style.md](references/core-style.md), or reuse it if already available in the current context.

For a local correction, consult only the relevant sections below and verify the changed text, technical facts, and affected links or examples. Do not load whole references because an unchanged document happens to contain a heading, table, or command. For new documents, substantial rewrites, or formal audits, read the references that apply:

- Read [references/structure-and-procedures.md](references/structure-and-procedures.md) for headings, lists, tutorials, how-to guides, tables, or notices.
- Read [references/technical-elements.md](references/technical-elements.md) for code, commands, placeholders, output, API references, UI instructions, links, images, or accessibility markup.
- Read [references/word-choice.md](references/word-choice.md) for terminology, abbreviations, recommendations, requirements, or an editorial review.
- Read [references/review-checklist.md](references/review-checklist.md) when revising or auditing existing content.
- Read [references/official-sources.md](references/official-sources.md) when the task turns on a narrow rule or current word-list entry. If internet access is available and recency matters, verify the rule on the linked official page.

## Review substantial work

Use these passes for new documents, substantial rewrites, and formal audits:

1. Identify the audience, task, prerequisites, document type, source format, and required outcome.
2. Verify technical statements against the supplied sources or repository. Do not invent behavior to make prose flow.
3. Organize content around reader goals. Put prerequisites and context before the action that depends on them.
4. Rewrite for directness, active voice, present tense, parallel structure, and consistent terminology.
5. Apply semantic formatting for headings, links, UI labels, code, commands, lists, tables, and notices.
6. Check accessibility, inclusive language, global readability, and rendering in the target format.
7. Proofread once for accuracy and once for style. Use the review checklist for substantial edits.

## Handle language scope

Treat the official guide as a US-English editorial standard.

- For English content, apply the full guide, including grammar, spelling, capitalization, punctuation, and date conventions.
- For non-English content, apply transferable principles such as audience focus, clear structure, accessibility, precision, inclusive language, and consistent terminology. Follow the target language's grammar, punctuation, capitalization, and localization conventions.
- For mixed-language content, preserve code and UI strings exactly and apply the appropriate prose convention to each language segment.

## Deliver the result

For drafting and revision, lead with clean, usable copy rather than an explanation of the editing process. Preserve Markdown, HTML, or other source markup unless a format change is requested. Mention unresolved technical gaps after the copy.

For an audit, prioritize findings by reader impact. For each material issue, identify the location or excerpt, name the violated principle, explain the reader impact, and propose replacement text. Do not bury factual, safety, accessibility, or task-blocking defects among minor style preferences.

Do not claim strict compliance when project-specific rules conflict with the guide or when required source facts remain unverified. State the applicable exception or limitation.
