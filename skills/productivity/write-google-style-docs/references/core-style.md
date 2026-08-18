# Core editorial style

Use these principles for every document.

## Audience and purpose

- Identify the intended reader and the task or decision that brought them to the document.
- Address the reader as **you**. Use **user** only for a person who uses software that the reader develops.
- Use the imperative for instructions; the subject **you** is implied.
- Provide context that the reader needs, but remove background that doesn't help complete the task or understand the concept.
- Prefer timeless statements. Don't announce unreleased features or use words such as *currently* to imply undocumented future plans.

## Voice and tone

- Sound conversational, friendly, respectful, and knowledgeable—not formal, pushy, cute, or frivolous.
- Use common two-word contractions such as **don't**, **can't**, and **you're** when they sound natural. Don't invent contractions or use complex three-word contractions.
- Don't use **please** in instructions. Direct, respectful imperatives are polite enough.
- Avoid exclamation points, hype, unsupported superlatives, marketing claims, and promises about performance or ease.
- Don't say that a task is easy, simple, quick, or obvious. Those judgments depend on the reader's experience.

## Clarity and grammar

- Use active voice and name the actor. Use passive voice only when the actor is irrelevant, unknown, or appropriately de-emphasized.
- Use present tense for general product behavior. Use future tense only for an event that actually occurs later.
- Keep the main subject and verb near the beginning of the sentence. Prefer one main idea per sentence.
- Put a condition before the instruction it controls: **If X, do Y.**
- Put a goal before its action: **To create the key, click Create.**
- Put the action location before the action: **In the console, click Create.**
- Prefer simple, precise verbs and short sentences. Remove filler such as **in order to**, **at this time**, and **due to the fact that**.
- Avoid phrasal verbs when a familiar single-word verb is clearer.
- Keep terminology, capitalization, formatting, and sentence patterns consistent. Use one term for one concept.
- Add a qualifying noun when it improves comprehension: write **the `example.yaml` file**, not only **`example.yaml`**.
- Use serial commas in English prose.
- Avoid semicolons when two sentences or a list would be clearer.

## Requirements and outcomes

Choose words that state the intended force:

- Use **must** or a direct imperative for a requirement.
- Use **We recommend** or name the recommending organization for a recommendation. Avoid ambiguous **should** unless the recommendation is broadly recognized.
- Use **can** for permission, ability, or an optional action.
- Use **might** or **can** for a possible outcome.
- State expected outcomes directly in present tense.

Don't use **would** for an ordinary outcome. Don't write that a value *should be* something when you mean that the reader must set it, the system sets it, or it is expected to have that value.

## Global and inclusive writing

- Write US English for English developer documentation, but assume that many readers use English as an additional language or read a translation.
- Avoid idioms, slang, jokes, pop-culture references, culturally specific metaphors, and references to seasons when a month or quarter is clearer.
- Use words in their primary, literal sense. Avoid directional references such as **above**, **below**, **left**, and **right** when structure, a label, or a screenshot can locate the item.
- Avoid unnecessarily gendered, ableist, violent, graphic, or divisive language. Use **they** and **their** for an unspecified person.
- Use diverse, fictional names and locations in examples. Never expose real personal data.
- Prefer established, widely understood technical terms. Define necessary jargon on first use or link to a definition.
- If a non-inclusive or obscure term is part of code or an external interface, preserve the literal identifier, format it as code, and explain it with inclusive prose.

## Accessibility in prose

- Never rely only on color, position, shape, sound, or visual styling to convey meaning.
- Use descriptive labels and link text that remain understandable out of context.
- Preserve a logical reading order and heading hierarchy.
- Write parallel structures for comparable items.
- Ensure instructions can be completed with a keyboard when choosing among equivalent procedures.
- Introduce interactive elements, tables, and images in nearby text.
