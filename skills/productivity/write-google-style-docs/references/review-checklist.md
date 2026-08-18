# Editorial review checklist

Review in separate passes so that surface edits don't hide technical defects.

## 1. Accuracy and task completion

- Does every instruction match the product, code, and supplied sources?
- Are prerequisites, permissions, supported versions, costs, side effects, and destructive actions stated before they matter?
- Can the reader recognize success and recover from likely failure?
- Are commands runnable and placeholders explained?
- Did the edit preserve identifiers, UI labels, code, links, and quoted text?

Treat an incorrect command, invented behavior, hidden destructive effect, missing prerequisite, or security risk as a must-fix issue.

## 2. Audience and organization

- Is the intended reader clear?
- Does the title match the document's primary purpose?
- Does the introduction state the outcome without restating the title?
- Is content ordered by the reader's task rather than the product's architecture?
- Do headings describe their sections and follow a logical hierarchy?
- Are alternatives, prerequisites, and conceptual detours separated from the main path?

## 3. Sentences and terminology

- Does the text address the reader as **you** and use imperatives for steps?
- Is the actor clear and the voice active where practical?
- Does general behavior use present tense?
- Do conditions, locations, and goals appear before the instructions they govern?
- Can a shorter or more familiar word preserve the meaning?
- Does each concept use one consistent term and capitalization?
- Are requirements, recommendations, optional actions, expected outcomes, and possible outcomes unambiguous?
- Are unfamiliar abbreviations and necessary jargon defined once?

## 4. Structure and formatting

- Are titles, headings, list items, table elements, and captions in sentence case?
- Are sequences numbered and nonsequential sets bulleted?
- Are list items parallel and consistently punctuated?
- Are UI labels bold, code elements in code font, and terms italicized only when appropriate?
- Are code samples, commands, output, and placeholders introduced and visually distinct?
- Are links descriptive, selective, and free of surrounding punctuation?
- Are notices rare and correctly classified?

## 5. Accessibility, inclusion, and global readability

- Does the heading hierarchy avoid skipped levels?
- Do links make sense out of context?
- Does every informative image have useful alt text or a nearby long description?
- Does any meaning rely only on color, position, shape, sound, or an icon?
- Can an equivalent procedure be completed with a keyboard?
- Are tables semantically simple, introduced in prose, and free of merged cells?
- Does the prose avoid directional, idiomatic, culturally specific, gendered, ableist, violent, or dismissive language?
- Are dates, times, units, and examples unambiguous to a global audience?

## 6. Final proof

- Check spelling, serial commas, punctuation, link destinations, code fences, and rendered markup.
- Remove duplicate explanations, filler, needless cross-references, and repeated notices.
- Confirm that examples use fictional data and disclose no personal information or secrets.
- Re-read the final document as a first-time reader completing the task.

## Audit output

Order findings by impact:

1. Accuracy, safety, security, and task blockers.
2. Accessibility and ambiguity.
3. Structure, terminology, and consistency.
4. Minor grammar and formatting.

For each material finding, provide the location or excerpt, the principle, the reader impact, and replacement text. Combine repeated instances under one pattern-level finding. Avoid reporting personal preferences that the guide doesn't support.
